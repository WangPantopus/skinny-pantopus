#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

// An applied migration that shipped without its compatibility line cannot be
// edited, so its statement is recorded in the policy instead, pinned to the
// file's exact bytes.
function documentedCompatibility(policy, name, bytes) {
  const note = (policy.compatibilityNotes || {})[name];
  return Boolean(note && note.backwardsCompatible === 'yes' && typeof note.reason === 'string'
    && note.reason.trim() && note.sha256 === hash(bytes));
}

// From this version on, a migration that creates a public table must turn on its
// row-level security in the same file. anon and authenticated keep SELECT on public
// tables, so a table without it can be read by anyone who has the anon key (#985).
const RLS_REQUIRED_FROM = '20260930174000';
const IDENT = String.raw`("(?:[^"]|"")+"|[A-Za-z_][A-Za-z0-9_$]*)`;
const identifier = raw => (raw.startsWith('"') ? raw.slice(1, -1).replaceAll('""', '"') : raw.toLowerCase());
const withoutLineComments = sql => sql.replace(/--[^\n]*/g, '');
function createdPublicTables(sql) {
  const create = new RegExp(String.raw`\bCREATE\s+(?:UNLOGGED\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:${IDENT}\s*\.\s*)?${IDENT}`, 'gi');
  return [...withoutLineComments(sql).matchAll(create)]
    .filter(match => !match[1] || identifier(match[1]) === 'public').map(match => identifier(match[2]));
}
function enablesRowLevelSecurity(sql, table) {
  const enable = new RegExp(String.raw`\bALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(?:${IDENT}\s*\.\s*)?${IDENT}\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY`, 'gi');
  return [...withoutLineComments(sql).matchAll(enable)]
    .some(match => (!match[1] || identifier(match[1]) === 'public') && identifier(match[2]) === table);
}

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
      if (!/backwards compatible:\s*yes/i.test(sql) && !documentedCompatibility(policy, name, files[name])) {
        errors.push(`Document compatibility with the currently deployed app: ${name}`);
      }
      if (!/lock_timeout/i.test(sql)) errors.push(`Set a bounded lock_timeout: ${name}`);
      if (match[1] >= RLS_REQUIRED_FROM) {
        for (const table of createdPublicTables(sql)) {
          if (!enablesRowLevelSecurity(sql, table)) {
            errors.push(`Enable row-level security on public."${table}" in the migration that creates it: ${name}`);
          }
        }
      }
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
  if (base && !/^0+$/.test(base)) {
    const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    let previous;
    try { previous = JSON.parse(git(['show', `${base}:supabase/migration-policy.json`])); } catch { /* first adoption PR */ }
    const canonical = value => JSON.stringify(Object.entries(value || {}).sort(([a], [b]) => a.localeCompare(b)));
    if (previous && canonical(previous.legacyFiles) !== canonical(policy.legacyFiles)) {
      errors.push('The historical inventory is immutable; do not regenerate hashes to accept edits');
    }
    if (previous?.mode === 'baselined' && policy.mode !== 'baselined') {
      errors.push('Database adoption cannot be reverted to legacy mode');
    }
    if (previous?.mode === 'baselined' && canonical(previous.baselineFiles) !== canonical(policy.baselineFiles)) {
      errors.push('The adopted baseline inventory is immutable');
    }
    if (previous?.mode === 'baselined') {
      const names = git(['ls-tree', '-r', '--name-only', base, 'supabase/migrations']).trim().split('\n').filter(n => n.endsWith('.sql'));
      const newest = names.map(n => path.basename(n).slice(0, 14)).sort().at(-1);
      for (const name of names) {
        // Compare exact Git blob identities without buffering a complete schema
        // dump through stdout (canonical baselines can exceed Node's 1 MiB cap).
        const original = git(['rev-parse', `${base}:${name}`]).trim();
        const current = files[name] === undefined ? null : execFileSync('git', ['hash-object', '--no-filters', '--', name], {
          cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
        }).trim();
        if (current !== original) errors.push(`Applied migrations are immutable: ${name}`);
      }
      for (const name of Object.keys(files).filter(n => n.startsWith('supabase/migrations/') && !names.includes(n))) {
        if (path.basename(name).slice(0, 14) <= newest) errors.push(`New migrations must sort after ${newest}: ${name}`);
      }
      for (const name of Object.keys(policy.compatibilityNotes || {})) {
        if (!names.includes(name)) errors.push(`Compatibility notes are only for applied migrations; write "Backwards compatible: yes" in ${name}`);
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
