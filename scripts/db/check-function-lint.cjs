#!/usr/bin/env node
// Keep the pinned CLI's complete scan. Only exact, reviewed stock-extension
// diagnostics may survive it, after provenance and real runtime checks.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const canonical = value => JSON.stringify(value, (_, item) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);

function validate(cli, status, provenance, review) {
  if (![0, 1].includes(status)) throw new Error('CLI execution failed');
  const results = Array.isArray(cli) ? cli : cli?.results;
  if (!Array.isArray(results) || provenance?.formatVersion !== 1 ||
      !provenance.routines || review?.formatVersion !== 1 || !review.entries?.length) {
    throw new Error('Incomplete lint evidence');
  }
  const allowed = new Map();
  const identities = new Set();
  for (const entry of review.entries) {
    if (identities.has(entry.identity) || !entry.reason || entry.extension !== 'postgis' ||
        !/^[a-f0-9]{64}$/.test(entry.definitionHash) || entry.issue?.level !== 'error') {
      throw new Error('Invalid extension diagnostic review');
    }
    identities.add(entry.identity);
    const actual = provenance.routines[entry.identity];
    if (!actual || ['function', 'extension', 'extensionVersion', 'definitionHash']
      .some(key => actual[key] !== entry[key])) {
      throw new Error('Reviewed extension provenance changed');
    }
    // CLI output omits argument types. Never let an application overload borrow
    // a stock routine's exception, even if its diagnostic happens to be identical.
    if (Object.values(provenance.routines).some(r =>
      r.function === entry.function && r.extension !== entry.extension)) {
      throw new Error('Application routine collides with a reviewed extension name');
    }
    const key = canonical({ function: entry.function, issue: entry.issue });
    allowed.set(key, (allowed.get(key) || 0) + 1);
  }
  let errors = 0;
  let warnings = 0;
  for (const result of results) {
    if (typeof result?.function !== 'string' || !Array.isArray(result.issues)) {
      throw new Error('Malformed CLI result');
    }
    for (const issue of result.issues) {
      if (!['error', 'warning', 'warning extra', 'warning performance'].includes(issue?.level) ||
          typeof issue.message !== 'string') throw new Error('Malformed CLI issue');
      if (issue.level !== 'error') { warnings++; continue; }
      errors++;
      const key = canonical({ function: result.function, issue });
      if (!allowed.get(key)) throw new Error('Unreviewed database lint error');
      allowed.set(key, allowed.get(key) - 1);
    }
  }
  if ((status === 1) !== (errors > 0)) throw new Error('CLI status does not match its diagnostics');
  return { reviewedExtensionErrors: errors, warnings };
}

function localPort(config) {
  const db = /^\[db\]\s*$([\s\S]*?)(?=^\[|$(?![\s\S]))/m.exec(config)?.[1];
  const port = /^port\s*=\s*(\d+)\s*$/m.exec(db || '')?.[1];
  if (!port || +port < 1024 || +port > 65535) throw new Error('Explicit local database port required');
  return port;
}

function validateApplication(summary, provenance, review) {
  if (!summary || !(summary.functions > 0) || summary.errors !== 0 ||
      !Array.isArray(summary.unattachedTriggerFunctions) ||
      !Array.isArray(review.unattachedApplicationTriggers)) {
    throw new Error('Application lint did not verify any functions');
  }
  const expected = review.unattachedApplicationTriggers;
  if (canonical([...summary.unattachedTriggerFunctions].sort()) !==
      canonical(expected.map(entry => entry.summaryName).sort()) || expected.some(entry =>
    provenance.routines[entry.identity]?.definitionHash !== entry.definitionHash ||
    provenance.routines[entry.identity]?.extension !== null)) {
    throw new Error('Unreviewed unattached application trigger');
  }
}

function main(args) {
  if (args.length && (args.length !== 2 || args[0] !== '--workdir')) {
    throw new Error('Usage: check-function-lint.cjs [--workdir LOCAL_SUPABASE_DIRECTORY]');
  }
  const workdir = path.resolve(args[1] || process.cwd());
  const port = localPort(fs.readFileSync(path.join(workdir, 'supabase/config.toml'), 'utf8'));
  const scriptDir = __dirname;
  const review = JSON.parse(fs.readFileSync(path.join(scriptDir, 'postgis-lint-review.json')));
  const version = spawnSync('supabase', ['--version'], { encoding: 'utf8' });
  if (version.status !== 0 || version.stdout.trim() !== review.cliVersion) {
    throw new Error('Use the reviewed pinned Supabase CLI version');
  }
  const reports = fs.mkdtempSync(path.join(os.tmpdir(), 'pantopus-function-lint-'));
  fs.chmodSync(reports, 0o700);
  const run = (label, command, commandArgs, input) => {
    const result = spawnSync(command, commandArgs, {
      input, encoding: 'utf8', timeout: 180000, maxBuffer: 16 * 1024 * 1024,
      // Explicit connection parameters below must not inherit a hosted service,
      // custom psql startup file or connection options from the operator shell.
      env: { ...Object.fromEntries(Object.entries(process.env).filter(([key]) =>
        !key.startsWith('PG') && !key.startsWith('SUPABASE_'))),
      ...(command === 'psql' ? { PGPASSWORD: 'postgres', PGPASSFILE: '/dev/null' } : {}) },
    });
    fs.writeFileSync(path.join(reports, `${label}.stdout`), result.stdout || '', { mode: 0o600 });
    fs.writeFileSync(path.join(reports, `${label}.stderr`), result.stderr || '', { mode: 0o600 });
    if (result.error || result.signal) throw new Error(`${label} failed to execute`);
    return result;
  };
  const sql = (label, relative) => {
    const result = run(label, 'psql', ['-X', '-w', '-h', '127.0.0.1', '-p', port,
      '-U', 'postgres', '-d', 'postgres', '-Atq', '-v', 'ON_ERROR_STOP=1'],
    fs.readFileSync(path.join(scriptDir, relative), 'utf8'));
    if (result.status !== 0) throw new Error(`${label} failed; inspect the private local report`);
    return result.stdout;
  };
  // psql uses the isolated stack's default local credential. The CLI resolves the same
  // project's port. No --linked / hosted URL option is exposed by this runner.
  const cli = run('cli', 'supabase', ['db', 'lint', '--local', '--fail-on', 'error',
    '--output', 'json', '--workdir', workdir]);
  const provenance = JSON.parse(sql('provenance', 'lint-provenance.sql'));
  const result = validate(JSON.parse(cli.stdout), cli.status, provenance, review);
  const app = sql('application', 'lint-application-functions.sql');
  const summary = app.split('\n').filter(Boolean).map(line => JSON.parse(line))[0];
  validateApplication(summary, provenance, review);
  sql('postgis-runtime', 'contracts/postgis-lint-runtime.sql');
  console.log(JSON.stringify({ result: 'pass', ...result, applicationFunctions: summary.functions,
    triggerBindings: summary.triggerBindings, unattachedTriggerFunctions: summary.unattachedTriggerFunctions }));
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error instanceof SyntaxError ? 'Malformed private lint evidence' : error.message); process.exitCode = 1; }
}
module.exports = { validate, validateApplication, localPort };
