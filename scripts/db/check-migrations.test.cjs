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
