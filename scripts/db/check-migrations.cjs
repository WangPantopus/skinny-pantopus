#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function validate(policy, files) {
  const errors = [];
  if (!['legacy', 'baselined'].includes(policy.mode)) return ['Unknown database adoption mode'];
  if (!/^\d+\.\d+\.\d+$/.test(policy.cliVersion)) errors.push('Pin an exact Supabase CLI version');
  const legacy = policy.legacyFiles;
  if (!legacy || Object.keys(legacy).length === 0) return ['Missing immutable legacy inventory'];
  const expectedLegacy = new Set();
  for (const [name, digest] of Object.entries(legacy)) {
    const current = policy.mode === 'baselined' ? name.replace('supabase/migrations/', 'supabase/migrations-archive/') : name;
    expectedLegacy.add(current);
    if (files[current] === undefined || hash(files[current]) !== digest) errors.push(`Historical migration changed or missing: ${current}`);
  }
  const runnable = Object.keys(files).filter(name => name.startsWith('supabase/migrations/'));
  if (policy.mode === 'legacy') {
    for (const name of Object.keys(files)) if (!expectedLegacy.has(name)) errors.push(`Finish baseline adoption before adding migration: ${name}`);
    return errors;
  }
  const baselineFiles = policy.baselineFiles || {};
  if (Object.keys(baselineFiles).length === 0) errors.push('A verified baseline and its hashes are required');
  for (const [name, digest] of Object.entries(baselineFiles)) {
    if (!runnable.includes(name) || hash(files[name] || '') !== digest) errors.push(`Baseline changed or missing: ${name}`);
  }
  const versions = new Set();
  const baselineVersions = Object.keys(baselineFiles).map(name => path.basename(name).slice(0, 14));
  const latestBaseline = baselineVersions.sort().at(-1);
  for (const name of runnable) {
    const match = /^supabase\/migrations\/(\d{14})_[a-z0-9_]+\.sql$/.exec(name);
    if (!match) { errors.push(`Invalid migration path: ${name}`); continue; }
    if (versions.has(match[1])) errors.push(`Duplicate migration version: ${match[1]}`);
    versions.add(match[1]);
    const sql = String(files[name]);
    if (!sql.trim()) errors.push(`Empty migration: ${name}`);
    if (/^\s*\\/m.test(sql)) errors.push(`psql commands are not supported: ${name}`);
    if (!Object.hasOwn(baselineFiles, name)) {
      if (match[1] <= latestBaseline) errors.push(`Migration precedes the baseline: ${name}`);
      if (!/backwards compatible:\s*yes/i.test(sql)) errors.push(`Document compatibility with the currently deployed app: ${name}`);
      if (!/lock_timeout/i.test(sql)) errors.push(`Set a bounded lock_timeout: ${name}`);
    }
  }
  for (const name of Object.keys(files)) {
    if (!expectedLegacy.has(name) && !runnable.includes(name)) errors.push(`Only supabase/migrations accepts new SQL: ${name}`);
  }
  return errors;
}

function collect(root) {
  const files = {};
  function walk(relative) {
    const dir = path.join(root, relative);
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const name = `${relative}/${entry.name}`;
      if (entry.isDirectory()) walk(name);
      else if (entry.isFile() && entry.name.endsWith('.sql')) files[name] = fs.readFileSync(path.join(root, name));
      else if (relative === 'supabase/migrations' && !['README.md', '.gitkeep'].includes(entry.name)) files[name] = Buffer.from('invalid entry');
    }
  }
  for (const dir of ['supabase/migrations', 'supabase/migrations-archive', 'backend/database/migrations']) walk(dir);
  return files;
}

function check(root, base) {
  const policy = JSON.parse(fs.readFileSync(path.join(root, 'supabase/migration-policy.json')));
  const files = collect(root);
  const errors = validate(policy, files);
  if (policy.mode === 'baselined') {
    const testsDir = path.join(root, 'supabase/tests');
    if (!fs.existsSync(testsDir) || !fs.readdirSync(testsDir, { recursive: true }).some(name => name.endsWith('.sql'))) {
      errors.push('Baseline activation requires real SQL contracts under supabase/tests');
    }
  }
  if (base && policy.mode === 'baselined') {
    const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
    let previous;
    try { previous = JSON.parse(git(['show', `${base}:supabase/migration-policy.json`])); } catch { /* first adoption PR */ }
    if (previous?.mode === 'baselined') {
      const names = git(['ls-tree', '-r', '--name-only', base, 'supabase/migrations']).trim().split('\n').filter(n => n.endsWith('.sql'));
      const newest = names.map(n => path.basename(n).slice(0, 14)).sort().at(-1);
      for (const name of names) {
        const original = execFileSync('git', ['show', `${base}:${name}`], { cwd: root });
        if (files[name] === undefined || !original.equals(files[name])) errors.push(`Applied migrations are immutable: ${name}`);
      }
      for (const name of Object.keys(files).filter(n => n.startsWith('supabase/migrations/') && !names.includes(n))) {
        if (path.basename(name).slice(0, 14) <= newest) errors.push(`New migrations must sort after ${newest}: ${name}`);
      }
    }
  }
  return { policy, errors };
}
if (require.main === module) {
  const { policy, errors } = check(process.cwd(), process.env.MIGRATION_BASE_SHA);
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  else console.log(policy.mode === 'legacy' ? 'Migration history unchanged. Hosted migration execution is disabled until baseline adoption.' : 'Migration policy passed; fresh-database replay is required.');
}
module.exports = { hash, validate, collect, check };
