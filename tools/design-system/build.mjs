#!/usr/bin/env node
// Pantopus design system: rebuild every file of the published Design System
// artifact from this repository.
//
//   node tools/design-system/build.mjs            # build into tools/design-system/out
//   node tools/design-system/build.mjs --check    # also render every preview and type-check
//   node tools/design-system/build.mjs --strict   # fail on drift warnings too
//   node tools/design-system/build.mjs --out DIR  # build somewhere else
//
// Output: out/project/** (the system's files), out/publish-plan.json (what to
// upload and publish), out/renders/ (with --check). See README.md.

import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { ASSET_GROUPS, LIBRARIES, SYSTEM } from './config.mjs';
import { buildAssets } from './lib/assets.mjs';
import { buildBundle } from './lib/bundle.mjs';
import { renderCheck, typeCheck } from './lib/check.mjs';
import { catalogueNames, writeContent } from './lib/pages.mjs';
import { TOOL, repoPath, sha256, sourceInfo, write } from './lib/repo.mjs';
import { buildStyles } from './lib/styles.mjs';
import { buildTokens } from './lib/tokens.mjs';
import { buildTypes } from './lib/types.mjs';

const { values: args } = parseArgs({
  options: {
    out: { type: 'string' },
    check: { type: 'boolean', default: false },
    strict: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});
if (args.help) {
  console.log('Usage: node tools/design-system/build.mjs [--check] [--strict] [--out DIR]');
  process.exit(0);
}

const MARKER = '.design-system-out';
const MEDIA = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.pdf': 'application/pdf' };
const LOCK = join(TOOL, 'assets.lock.json');

// ── Output directory ────────────────────────────────────────────
const out = resolve(args.out ?? join(TOOL, 'out'));
if (existsSync(out) && readdirSync(out).length && !existsSync(join(out, MARKER))) {
  console.error(`Refusing to build into ${out}: it is not empty and was not created by this tool.`);
  process.exit(1);
}
for (const entry of ['project', '.build', 'renders', 'publish-plan.json']) rmSync(join(out, entry), { recursive: true, force: true });
write(join(out, MARKER), 'Created by tools/design-system/build.mjs; its contents are rebuilt on every run.\n');
const projectDir = join(out, 'project');
const buildDir = join(out, '.build');
const rendersDir = join(out, 'renders');

const info = sourceInfo();
const errors = [];
const warnings = [];

// ── 1. Tokens ───────────────────────────────────────────────────
const tokens = buildTokens(info);
errors.push(...tokens.report.errors);
warnings.push(...tokens.report.warnings);
write(join(projectDir, 'tokens.json'), `${JSON.stringify(tokens.tokens, null, 2)}\n`);
write(join(buildDir, 'tokens.css'), tokens.css);
const color = (name, theme = 'light') => tokens.resolve(name, theme);

// ── 2. Authored content ─────────────────────────────────────────
const content = writeContent({ projectDir, info, color });
warnings.push(...content.warnings);

// ── 3. Assets ───────────────────────────────────────────────────
const assets = buildAssets({ projectDir, color });

// ── 4. Component bundle ─────────────────────────────────────────
const components = catalogueNames();
const bundle = buildBundle({ entry: join(TOOL, 'src/entry.tsx'), namespace: SYSTEM.namespace, components });
write(join(projectDir, 'components/bundle.js'), bundle.code);

// ── 5. Styles ───────────────────────────────────────────────────
buildStyles({
  content: [...bundle.sourceFiles.filter((f) => !f.includes('/frontend/packages/')), ...content.previews],
  buildDir,
  outFile: join(projectDir, 'components/bundle.css'),
});

// ── 6. Types ────────────────────────────────────────────────────
const types = buildTypes({ entry: join(TOOL, 'src/entry.tsx'), components });
warnings.push(...types.warnings);
write(join(projectDir, 'components/index.d.ts'), types.text);

// ── 7. Publish plan ─────────────────────────────────────────────
const lock = existsSync(LOCK) ? JSON.parse(readFileSync(LOCK, 'utf8')) : { artifact: SYSTEM.artifact, uploads: {} };
const uploads = [];
const assetGroups = {};
for (const group of ASSET_GROUPS) {
  const files = {};
  for (const asset of assets[group.name]) {
    const bytes = readFileSync(join(projectDir, asset.path));
    const digest = sha256(bytes);
    const known = lock.uploads[asset.path];
    const reusable = known && known.sha256 === digest ? known : null;
    const type = MEDIA[extname(asset.name)];
    uploads.push({ group: group.name, name: asset.name, path: `project/${asset.path}`, type, bytes: bytes.length, sha256: digest, blob: reusable?.blob ?? null });
    if (reusable) files[asset.name] = { name: asset.name, blob: reusable.blob, size: reusable.size, type };
  }
  assetGroups[group.name] = { name: group.name, tile: group.tile, order: assets[group.name].map((a) => a.name), files };
}
const uploadPaths = new Set(uploads.map((u) => u.path));
const files = {};
const walk = (dir) => {
  for (const name of readdirSync(dir).sort()) {
    const file = join(dir, name);
    if (statSync(file).isDirectory()) walk(file);
    else {
      const rel = relative(out, file);
      if (uploadPaths.has(rel)) continue;
      files[rel] = rel.endsWith('.d.ts') ? { from: rel, contentType: 'text/plain' } : rel;
    }
  }
};
walk(projectDir);
const pending = uploads.filter((u) => !u.blob);
const plan = {
  artifact: SYSTEM.artifact,
  source: info,
  root: out,
  files,
  uploads,
  index: {
    title: SYSTEM.title,
    namespace: SYSTEM.namespace,
    libraries: LIBRARIES,
    groups: ASSET_GROUPS.map((g) => g.name),
    assetGroups,
    lastChange: {
      by: info.author,
      at: info.at,
      via: info.repo ? `GitHub · ${info.repo}@${info.commit}` : 'tools/design-system',
      note: `Rebuilt by tools/design-system from ${info.branch}@${info.commit}${info.dirty ? ' (with uncommitted changes)' : ''}.`,
    },
  },
};
write(join(out, 'publish-plan.json'), `${JSON.stringify(plan, null, 2)}\n`);

// ── 8. Checks ───────────────────────────────────────────────────
const problems = [];
let rendered = 0;
if (args.check) {
  problems.push(...typeCheck({ dtsFile: join(projectDir, 'components/index.d.ts'), buildDir }));
  const result = await renderCheck({ projectDir, tokensCss: tokens.css, rendersDir, themes: tokens.tokens.color.themes.map((t) => t.id) });
  rendered = result.rendered;
  problems.push(...result.problems);
}

// ── Report ──────────────────────────────────────────────────────
const t = tokens.tokens;
const kb = (n) => `${Math.round(n / 1024)} KB`;
const styles = t.type.groups.reduce((n, g) => n + g.styles.length, 0);
console.log(`Pantopus design system · ${info.branch}@${info.commit}${info.dirty ? ' (uncommitted changes)' : ''}`);
console.log(`  tokens      ${t.color.tokens.length} colors × ${t.color.themes.length} themes · ${styles} text styles · ${t.spacing.tokens.length} spacing · ${t.radius.tokens.length} radius · ${t.shadow.tokens.length} shadows`);
console.log(`  components  ${components.length} (bundle.js ${kb(bundle.code.length)}, ${bundle.icons} icons) · bundle.css ${kb(statSync(join(projectDir, 'components/bundle.css')).size)} · index.d.ts`);
console.log(`  assets      ${assets.Logos.length} logos · ${assets.Icons.length} icons · ${pending.length ? `${pending.length} to upload: ${pending.map((u) => u.name).join(', ')}` : 'all already uploaded'}`);
if (args.check) console.log(`  check       ${rendered} renders · ${problems.length ? `${problems.length} problems` : 'clean, types OK'}`);
console.log(`  output      ${repoPath(out)}/ (publish-plan.json${args.check ? ', renders/' : ''})`);
if (tokens.report.lowContrast.length) console.log(`  contrast    ${tokens.report.lowContrast.length} sub-4.5:1 pairs, each flagged in its token note`);
for (const [label, list] of [['errors', errors], ['warnings', warnings], ['check problems', problems]]) {
  if (!list.length) continue;
  console.log(`\n${label} (${list.length}):`);
  for (const line of list) console.log(`  - ${line}`);
}

process.exitCode = errors.length || problems.length || (args.strict && warnings.length) ? 1 : 0;
