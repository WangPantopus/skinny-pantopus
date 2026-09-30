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

// From this version on, a migration that creates or replaces a SECURITY DEFINER function in
// public must revoke EXECUTE on it from PUBLIC, anon and authenticated in the same file.
// PostgREST exposes every function a client role can execute as /rest/v1/rpc/<name>, a DEFINER
// function runs as its owner past row-level security, and the project's default privileges grant
// new functions to anon and authenticated explicitly, so revoking PUBLIC alone is not enough
// (#996). An explicit GRANT to anon or authenticated in the same file marks a deliberate
// exception, such as a boolean helper that row-level-security policies call.
const DEFINER_REVOKE_REQUIRED_FROM = '20260930176000';
// Row-level-security policies call these boolean helpers, so client roles must keep EXECUTE on them.
// Redefining one does not require a revoke; this is the complete set of SECURITY DEFINER functions the
// policies referenced on 2026-09-30, plus the chat membership helper added in 20260930182000.
const RLS_POLICY_HELPERS = new Set(['gig_creator_has_current_authority', 'has_home_permission',
  'home_bill_has_finance_permission', 'home_can_see_visibility', 'home_has_permission', 'home_is_active_member',
  'home_member_can', 'is_active_chat_participant', 'is_home_member']);
function definerFunctions(sql) {
  const text = withoutLineComments(sql);
  const create = new RegExp(String.raw`\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:${IDENT}\s*\.\s*)?${IDENT}\s*\(`, 'gi');
  const names = [];
  for (const match of text.matchAll(create)) {
    if (match[1] && identifier(match[1]) !== 'public') continue;
    const body = /\bAS\s+(\$[A-Za-z0-9_]*\$)/ig; body.lastIndex = match.index + match[0].length;
    const start = body.exec(text);
    if (!start) continue;
    const end = text.indexOf(start[1], start.index + start[0].length);
    const tail = end < 0 ? '' : text.slice(end + start[1].length, text.indexOf(';', end + start[1].length) + 1 || undefined);
    if (/\bSECURITY\s+DEFINER\b/i.test(text.slice(match.index, start.index) + tail)) names.push(identifier(match[2]));
  }
  return names;
}
function clientsCannotExecute(sql, fn) {
  const text = withoutLineComments(sql);
  const named = list => [...list.matchAll(new RegExp(String.raw`(?:${IDENT}\s*\.\s*)?${IDENT}\s*\(`, 'g'))]
    .some(match => (!match[1] || identifier(match[1]) === 'public') && identifier(match[2]) === fn);
  const revoked = new Set();
  for (const match of text.matchAll(/\bREVOKE\s+(?:ALL(?:\s+PRIVILEGES)?|EXECUTE)\s+ON\s+(?:FUNCTION|ROUTINE)\s+([\s\S]*?)\s+FROM\s+([^;]*);/gi)) {
    if (named(match[1])) for (const role of match[2].split(',')) revoked.add(role.trim().toLowerCase());
  }
  if (['public', 'anon', 'authenticated'].every(role => revoked.has(role))) return true;
  return grantedToClients(text, fn);
}
function grantedToClients(text, fn) {
  const named = list => [...list.matchAll(new RegExp(String.raw`(?:${IDENT}\s*\.\s*)?${IDENT}\s*\(`, 'g'))]
    .some(match => (!match[1] || identifier(match[1]) === 'public') && identifier(match[2]) === fn);
  return [...text.matchAll(/\bGRANT\s+(?:ALL(?:\s+PRIVILEGES)?|EXECUTE)\s+ON\s+(?:FUNCTION|ROUTINE)\s+([\s\S]*?)\s+TO\s+([^;]*);/gi)]
    .some(match => named(match[1]) && /\b(?:anon|authenticated)\b/i.test(match[2]));
}

// From this version on, a SECURITY DEFINER function with a parameter that defaults to auth.uid() may be granted to
// anon or authenticated only if it is a reviewed caller-bound helper below. The default doesn't bind a function to
// its caller: it still answers for any value a client passes. business_get_user_permissions did, after #996's scan
// counted it as caller-bound (20260930183000). The helpers below were reviewed as caller-bound, and
// home-effective-permissions asserts the Home ones answer nothing about another user.
const AUTH_UID_DEFAULT_GRANTS_REFUSED_FROM = '20260930183000';
const CALLER_BOUND_HELPERS = new Set([...RLS_POLICY_HELPERS, 'home_get_user_permissions', 'home_has_role_at_least',
  'home_my_role']);
function authUidDefaultGrants(sql) {
  const text = withoutLineComments(sql);
  const create = new RegExp(String.raw`\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:${IDENT}\s*\.\s*)?${IDENT}\s*\(`, 'gi');
  const found = [];
  for (const match of text.matchAll(create)) {
    if (match[1] && identifier(match[1]) !== 'public') continue;
    const fn = identifier(match[2]);
    let depth = 1; let i = match.index + match[0].length;
    for (; i < text.length && depth > 0; i++) depth += text[i] === '(' ? 1 : text[i] === ')' ? -1 : 0;
    if (!/\bDEFAULT\s+auth\s*\.\s*uid\s*\(\s*\)/i.test(text.slice(match.index + match[0].length, i - 1))) continue;
    const body = /\bAS\s+(\$[A-Za-z0-9_]*\$)/ig; body.lastIndex = i;
    const start = body.exec(text);
    if (!start) continue;
    const end = text.indexOf(start[1], start.index + start[0].length);
    const tail = end < 0 ? '' : text.slice(end + start[1].length, text.indexOf(';', end + start[1].length) + 1 || undefined);
    if (!/\bSECURITY\s+DEFINER\b/i.test(text.slice(i, start.index) + tail)) continue;
    if (!CALLER_BOUND_HELPERS.has(fn) && grantedToClients(text, fn)) found.push(fn);
  }
  return found;
}

// From this version on, a migration may not give anon or PUBLIC any privilege on a public table,
// view or sequence, including through ALTER DEFAULT PRIVILEGES. 20260930181000 revoked all of them
// from anon (writes were already gone since #992), and no app reads with the anon key, so such a
// grant would only reopen direct PostgREST access for anyone who has it. Function, schema and type
// grants are not covered here; the DEFINER rule above handles functions.
const ANON_TABLE_GRANTS_REFUSED_FROM = '20260930181000';
// From this version on the rule covers authenticated too: 20260930182000 revoked its table and
// sequence privileges, and no app reads or writes as a signed-in user through PostgREST.
const AUTHENTICATED_TABLE_GRANTS_REFUSED_FROM = '20260930182000';
function clientTableGrants(sql, roles) {
  const skip = /^(?:FUNCTIONS?|ROUTINES?|PROCEDURES?|ALL\s+(?:FUNCTIONS|ROUTINES|PROCEDURES)\b|SCHEMAS?|TYPES?|DOMAIN|LANGUAGE|FOREIGN|DATABASE|TABLESPACE|LARGE\s+OBJECT|PARAMETER)\b/i;
  const grantee = new RegExp(String.raw`\b(?:${roles.join('|')})\b`, 'i');
  return [...withoutLineComments(sql).matchAll(/\bGRANT\s+([^;]*?)\s+ON\s+([^;]*?)\s+TO\s+([^;]*);/gi)]
    .filter(match => !skip.test(match[2].trim()) && grantee.test(match[3]))
    .map(match => match[2].trim().replace(/\s+/g, ' '));
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
      if (match[1] >= DEFINER_REVOKE_REQUIRED_FROM) {
        for (const fn of definerFunctions(sql)) {
          if (!RLS_POLICY_HELPERS.has(fn) && !clientsCannotExecute(sql, fn)) {
            errors.push(`Revoke EXECUTE on SECURITY DEFINER function public."${fn}" from PUBLIC, anon and authenticated in the same migration: ${name}`);
          }
        }
      }
      if (match[1] >= AUTH_UID_DEFAULT_GRANTS_REFUSED_FROM) {
        for (const fn of authUidDefaultGrants(sql)) {
          errors.push(`SECURITY DEFINER function public."${fn}" is granted to clients with a parameter defaulting to auth.uid(), which doesn't bind it to the caller; keep it service-only, or bind it to the caller and add it to CALLER_BOUND_HELPERS with a contract: ${name}`);
        }
      }
      if (match[1] >= RLS_REQUIRED_FROM) {
        for (const table of createdPublicTables(sql)) {
          if (!enablesRowLevelSecurity(sql, table)) {
            errors.push(`Enable row-level security on public."${table}" in the migration that creates it: ${name}`);
          }
        }
      }
      if (match[1] >= ANON_TABLE_GRANTS_REFUSED_FROM) {
        const roles = match[1] >= AUTHENTICATED_TABLE_GRANTS_REFUSED_FROM ? ['anon', 'authenticated', 'public'] : ['anon', 'public'];
        for (const target of clientTableGrants(sql, roles)) {
          errors.push(`Do not grant ${roles.slice(0, -1).join(', ')} or PUBLIC privileges on ${target}; clients read and write through the API: ${name}`);
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
