// components/bundle.js: the web app's own components as one classic script.
//
// Each module is transpiled with the repo's TypeScript and wired into a tiny
// CommonJS registry inside an IIFE that reads window.React / window.ReactDOM
// and assigns window.<namespace>. Only the lucide icons actually imported are
// included. No bundler dependency, no network.

import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { PACKAGES, WEB_SRC, packageDir, read, webRequire } from './repo.mjs';

const SHIMS = {
  react: 'module.exports = window.React;',
  'react-dom': 'module.exports = window.ReactDOM;',
  'react/jsx-runtime': [
    'var R = window.React;',
    'exports.Fragment = R.Fragment;',
    'exports.jsx = exports.jsxs = function (t, p, k) { return R.createElement(t, k === undefined ? p : Object.assign({}, p, { key: k })); };',
  ].join('\n'),
  // DetailHeader reads the router only when no onBack is given. The preview
  // frame has no Next.js router, so navigation is inert in the bundle.
  'next/navigation': [
    'exports.useRouter = function () { return { push: function () {}, replace: function () {}, back: function () {}, prefetch: function () {} }; };',
    "exports.usePathname = function () { return '/'; };",
    'exports.useSearchParams = function () { return new URLSearchParams(); };',
  ].join('\n'),
};

const EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js', '.mjs'];

function resolveFile(base) {
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const ext of EXTENSIONS) if (existsSync(base + ext)) return base + ext;
  for (const ext of EXTENSIONS) if (existsSync(join(base, `index${ext}`))) return join(base, `index${ext}`);
  throw new Error(`Cannot resolve ${base}`);
}

/** Workspace packages (@pantopus/<name>) resolve to their package.json main. */
function workspaceEntry(spec) {
  const name = spec.slice('@pantopus/'.length);
  const dir = join(PACKAGES, name);
  const pkg = JSON.parse(read(join(dir, 'package.json')));
  return resolveFile(join(dir, pkg.main ?? 'src/index.ts'));
}

function resolveSpec(spec, fromFile) {
  if (Object.hasOwn(SHIMS, spec)) return `shim:${spec}`;
  if (spec === 'lucide-react') return 'virtual:lucide';
  if (spec.startsWith('@/')) return resolveFile(join(WEB_SRC, spec.slice(2)));
  if (/^@pantopus\/[\w-]+$/.test(spec)) return workspaceEntry(spec);
  if (spec.startsWith('.')) return resolveFile(resolve(dirname(fromFile), spec));
  throw new Error(`Unsupported import "${spec}" in ${fromFile}. Shim it in lib/bundle.mjs or keep that component out of the bundle.`);
}

let lucideCache;

/** Lucide export name → its ESM icon file. */
function lucideIndex() {
  if (lucideCache) return lucideCache;
  const esm = join(packageDir('lucide-react'), 'dist/esm');
  const map = new Map();
  for (const line of read(join(esm, 'lucide-react.js')).split('\n')) {
    const m = /^export \{([^}]*)\} from '(\.\/icons\/[^']+)';/.exec(line);
    if (!m) continue;
    for (const part of m[1].split(',')) {
      const alias = /default as (\w+)/.exec(part.trim());
      if (alias) map.set(alias[1], join(esm, m[2]));
    }
  }
  lucideCache = map;
  return map;
}

export function lucideIconFile(name) {
  const file = lucideIndex().get(name);
  if (!file) throw new Error(`lucide-react has no icon named ${name}`);
  return file;
}

function lucideImports(source) {
  const names = new Set();
  for (const m of source.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s*from\s*['"]lucide-react['"]/g)) {
    if (m[1]) continue;
    for (let item of m[2].split(',')) {
      item = item.trim();
      if (item && !item.startsWith('type ')) names.add(item.split(/\s+as\s+/)[0].trim());
    }
  }
  return names;
}

/**
 * @param {{ entry: string, namespace: string, components: string[] }} options
 * @returns {{ code: string, sourceFiles: string[], icons: number }}
 */
export function buildBundle({ entry, namespace, components }) {
  const ts = webRequire('typescript');
  const transpile = (file, source) =>
    ts
      .transpileModule(source, {
        fileName: file,
        reportDiagnostics: false,
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2019,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
          isolatedModules: true,
          removeComments: true,
          allowJs: true,
        },
      })
      .outputText.replace(/\/\/# sourceMappingURL=.*$/gm, '');

  const modules = new Map();
  const sourceFiles = [];
  const icons = new Set();
  let nextId = 0;

  const add = (key) => {
    if (modules.has(key)) return modules.get(key).id;
    const record = { id: nextId++, code: '' };
    modules.set(key, record);
    if (key.startsWith('shim:')) {
      record.code = SHIMS[key.slice('shim:'.length)];
      return record.id;
    }
    if (key === 'virtual:lucide') return record.id; // filled once every import is known
    const source = read(key);
    if (!key.includes('/node_modules/')) {
      for (const name of lucideImports(source)) icons.add(name);
      sourceFiles.push(key);
    }
    record.code = transpile(key, source).replace(/require\((["'])([^"']+)\1\)/g, (_, q, spec) => `__req(${add(resolveSpec(spec, key))})`);
    return record.id;
  };

  add(resolve(entry));

  if (modules.has('virtual:lucide')) {
    const index = lucideIndex();
    modules.get('virtual:lucide').code = [...icons]
      .sort()
      .map((name) => {
        const file = index.get(name);
        if (!file) throw new Error(`lucide-react has no icon named ${name}`);
        return `exports[${JSON.stringify(name)}] = __req(${add(file)}).default;`;
      })
      .join('\n');
  }

  let body = '';
  for (const record of modules.values()) body += `${record.id}: function (module, exports, __req) {\n${record.code.trim()}\n},\n`;

  const header = `/* @ds-bundle: ${JSON.stringify({ format: 4, namespace, components: components.map((name) => ({ name })) })} */`;
  const code = `${header}
(function () {
var __defs = {
${body}};
var __cache = {};
function __req(id) {
  var c = __cache[id];
  if (c) return c.exports;
  c = __cache[id] = { exports: {} };
  __defs[id].call(c.exports, c, c.exports, __req);
  return c.exports;
}
var api = __req(0);
var ns = window[${JSON.stringify(namespace)}] = window[${JSON.stringify(namespace)}] || {};
Object.keys(api).forEach(function (k) { if (k !== '__esModule' && k !== 'default') ns[k] = api[k]; });
})();
`;

  // The page inlines the bundle, and the preview CSP has no unsafe-eval.
  if (/<\/script/i.test(code) || code.includes('<!--')) throw new Error('bundle contains </script or <!--');
  if (/\beval\s*\(|new Function\s*\(/.test(code)) throw new Error('bundle contains eval or new Function');

  return { code, sourceFiles, icons: icons.size };
}
