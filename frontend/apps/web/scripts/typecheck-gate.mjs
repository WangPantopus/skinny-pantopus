#!/usr/bin/env node
// ============================================================
// TYPECHECK GATE — makes `tsc` a real CI gate without demanding the
// pre-existing error backlog be fixed first.
//
// The CI step used to be `continue-on-error: true`, which is a decoy:
// every new type error sailed through while the log claimed a check
// ran. This gate grandfathers the known backlog and fails ONLY on new
// errors: it runs tsc, reduces each error to a signature of
// `<file>|<TS code>` (no line numbers, so moving code doesn't churn
// the baseline), and compares per-signature counts against
// tsc-baseline.json.
//
//   node scripts/typecheck-gate.mjs            # gate (CI)
//   node scripts/typecheck-gate.mjs --update   # rewrite the baseline
//
// Shrink the baseline whenever you fix old errors: run --update and
// commit the diff. Never run --update to absorb NEW errors — fix them.
// ============================================================

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = join(root, 'tsc-baseline.json');
const update = process.argv.includes('--update');

let output = '';
try {
  output = execSync('pnpm exec tsc --noEmit', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
} catch (err) {
  // tsc exits non-zero when errors exist — the output is what we want.
  output = `${err.stdout || ''}${err.stderr || ''}`;
}

// "src/app/foo/page.tsx(12,7): error TS2345: ..." → "src/app/foo/page.tsx|TS2345"
const counts = {};
for (const line of output.split('\n')) {
  const m = /^(.+?)\(\d+,\d+\): error (TS\d+):/.exec(line.trim());
  if (!m) continue;
  const sig = `${m[1]}|${m[2]}`;
  counts[sig] = (counts[sig] || 0) + 1;
}

if (update) {
  const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(baselinePath, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`Baseline updated: ${Object.values(counts).reduce((a, b) => a + b, 0)} errors across ${Object.keys(counts).length} signatures.`);
  process.exit(0);
}

let baseline = {};
try {
  baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
} catch {
  console.error(`Missing or unreadable ${baselinePath} — run \`node scripts/typecheck-gate.mjs --update\` once and commit it.`);
  process.exit(1);
}

const regressions = [];
for (const [sig, n] of Object.entries(counts)) {
  const allowed = baseline[sig] || 0;
  if (n > allowed) regressions.push({ sig, n, allowed });
}

const totalNow = Object.values(counts).reduce((a, b) => a + b, 0);
const totalBase = Object.values(baseline).reduce((a, b) => a + b, 0);

if (regressions.length > 0) {
  console.error(`\nTYPECHECK GATE FAILED — ${regressions.length} signature(s) exceed the baseline:\n`);
  for (const { sig, n, allowed } of regressions) {
    const [file, code] = sig.split('|');
    console.error(`  ${file} — ${code}: ${n} now vs ${allowed} allowed`);
  }
  console.error('\nFix the new errors (run `pnpm exec tsc --noEmit` for details).');
  console.error('If you fixed OLD errors elsewhere, refresh with `node scripts/typecheck-gate.mjs --update`.\n');
  process.exit(1);
}

console.log(`Typecheck gate passed: ${totalNow} errors, all within the ${totalBase}-error baseline.`);
if (totalNow < totalBase) {
  console.log('The backlog shrank — run `node scripts/typecheck-gate.mjs --update` and commit the smaller baseline.');
}
