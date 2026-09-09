const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hash, validate } = require('./check-migrations.cjs');
const historical = 'supabase/migrations/20250101000000_old.sql';
const original = 'ALTER TABLE public.missing ADD COLUMN x int;';
const policy = { mode: 'legacy', cliVersion: '2.116.0', legacyFiles: { [historical]: hash(original) } };
test('legacy inventory passes without claiming the old stream can replay', () => {
  assert.deepEqual(validate(policy, { [historical]: original }), []);
});
test('blocks edited history and premature new migrations', () => {
  assert.match(validate(policy, { [historical]: 'changed' }).join(), /Historical migration changed/);
  assert.match(validate(policy, { [historical]: original, 'supabase/migrations/20260906000000_new.sql': 'select 1;' }).join(), /Finish baseline adoption/);
});
test('activation requires a preserved archive and verified baseline', () => {
  assert.match(validate({ ...policy, mode: 'baselined' }, {}).join(), /verified baseline/);
});
test('baselined mode rejects duplicate versions, nested SQL and psql commands', () => {
  const baseline = 'supabase/migrations/20260906000000_baseline.sql';
  const sql = 'CREATE TABLE example(id int);';
  const active = { ...policy, mode: 'baselined', baselineFiles: { [baseline]: hash(sql) } };
  const files = { [historical.replace('/migrations/', '/migrations-archive/')]: original, [baseline]: sql };
  assert.deepEqual(validate(active, files), []);
  assert.match(validate(active, { ...files, 'supabase/migrations/20260906000000_duplicate.sql': '\\connect production' }).join(), /Duplicate migration/);
  assert.match(validate(active, { ...files, 'supabase/migrations/nested/20260907000000_x.sql': 'select 1;' }).join(), /Invalid migration path/);
  assert.match(validate(active, { ...files, 'supabase/migrations/20260907000000_x.sql': '\\connect production' }).join(), /psql commands/);
});
test('changing the inventory cannot hide an edit to historical SQL', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const os = require('node:os');
  const { execFileSync } = require('node:child_process');
  const { check } = require('./check-migrations.cjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-history-test-'));
  const git = args => execFileSync('git', args, { cwd: dir, stdio: 'pipe' });
  try {
    fs.mkdirSync(path.join(dir, 'supabase/migrations'), { recursive: true });
    fs.writeFileSync(path.join(dir, historical), original);
    fs.writeFileSync(path.join(dir, 'supabase/migration-policy.json'), JSON.stringify(policy));
    git(['init']); git(['add', '.']);
    git(['-c', 'user.name=CI', '-c', 'user.email=ci@example.invalid', 'commit', '-m', 'Original inventory']);
    fs.writeFileSync(path.join(dir, historical), 'changed SQL');
    fs.writeFileSync(path.join(dir, 'supabase/migration-policy.json'), JSON.stringify({ ...policy, legacyFiles: { [historical]: hash('changed SQL') } }));
    assert.match(check(dir, 'HEAD').errors.join(), /historical inventory is immutable/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('adopted history enforces append-only SQL and merge ordering even for baselines larger than 1 MiB', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const os = require('node:os');
  const { execFileSync } = require('node:child_process');
  const { check } = require('./check-migrations.cjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-order-test-'));
  const git = args => execFileSync('git', args, { cwd: dir, stdio: 'pipe' });
  const baseline = 'supabase/migrations/20260906000000_baseline.sql';
  const existing = 'supabase/migrations/20260908000000_existing.sql';
  const sql = "-- Backwards compatible: yes\nset local lock_timeout='5s';\nselect 1;";
  const baselineSql = 'create table example(id int);\n-- ' + 'baseline source '.repeat(100_000);
  const put = (name, content) => {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), content);
  };
  try {
    put(historical.replace('/migrations/', '/migrations-archive/'), original);
    put(baseline, baselineSql); put(existing, sql);
    put('supabase/tests/contracts.sql', 'select plan(1); select ok(true); select * from finish();');
    put('supabase/migration-policy.json', JSON.stringify({ ...policy, mode: 'baselined', baselineFiles: { [baseline]: hash(baselineSql) } }));
    git(['init']); git(['add', '.']);
    git(['-c', 'user.name=CI', '-c', 'user.email=ci@example.invalid', 'commit', '-m', 'Adopted history']);
    const late = 'supabase/migrations/20260907000000_late.sql';
    put(late, sql);
    assert.match(check(dir, 'HEAD').errors.join(), /must sort after 20260908000000/);
    fs.renameSync(path.join(dir, late), path.join(dir, 'supabase/migrations/20260909000000_new.sql'));
    assert.deepEqual(check(dir, 'HEAD').errors, []);
    put(existing, sql + '\nselect 2;');
    assert.match(check(dir, 'HEAD').errors.join(), /Applied migrations are immutable/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
