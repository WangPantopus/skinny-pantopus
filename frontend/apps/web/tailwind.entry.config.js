// Tailwind for src/app/globals.css, the stylesheet every page loads (root layout). Its utilities come only from
// what the homepage, the sign-in pages, not-found and error render: the import closure of those files. So those
// pages block on a light stylesheet, while every other page also loads src/app/(site)/site.css, whose utilities
// include all of these in the same order (tailwind.site.config.js), so it renders exactly as with one stylesheet.
//
// The closure follows `@/` and relative imports, `export … from`, `import()` and `require()`, so a component one
// of those pages renders can't be missed. In development the whole app is scanned instead, so a component added
// to one of them is styled before the dev server restarts.
const fs = require('node:fs');
const path = require('node:path');
const base = require('./tailwind.config.js');

const SRC = path.join(__dirname, 'src');
const APP = path.join(SRC, 'app');
const EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.cjs'];
// Only files the full stylesheet scans as well (tailwind.config.js `content`), so this one is a subset of it.
const SCANNED = /[\\/]src[\\/](app|components|pages)[\\/]/;
const SPECIFIER =
  /(?:import|export)\s+(?:[\w*{}\s,$]+\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;

function filesIn(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return filesIn(file);
    return EXTENSIONS.includes(path.extname(file)) ? [file] : [];
  });
}

function resolve(specifier, from) {
  let target;
  if (specifier.startsWith('@/')) target = path.join(SRC, specifier.slice(2));
  else if (specifier.startsWith('.')) target = path.resolve(path.dirname(from), specifier);
  else return null; // packages
  const candidates = [target, ...EXTENSIONS.map((ext) => target + ext), ...EXTENSIONS.map((ext) => path.join(target, `index${ext}`))];
  return candidates.find((file) => EXTENSIONS.includes(path.extname(file)) && fs.existsSync(file) && fs.statSync(file).isFile()) ?? null;
}

function importClosure(entries) {
  const seen = new Set();
  const pending = [...entries];
  while (pending.length > 0) {
    const file = pending.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const match of fs.readFileSync(file, 'utf8').matchAll(SPECIFIER)) {
      const target = resolve(match[1] ?? match[2] ?? match[3], file);
      if (target) pending.push(target);
    }
  }
  return [...seen];
}

const entries = ['layout.tsx', 'page.tsx', 'not-found.tsx', 'error.tsx', 'global-error.tsx']
  .map((file) => path.join(APP, file))
  .filter((file) => fs.existsSync(file))
  .concat(filesIn(path.join(APP, '_components')), filesIn(path.join(APP, '(auth)')));

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...base,
  content:
    process.env.NODE_ENV === 'production'
      ? importClosure(entries).filter((file) => SCANNED.test(file))
      : base.content,
};
