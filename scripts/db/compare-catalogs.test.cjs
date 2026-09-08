const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compare } = require('./compare-catalogs.cjs');
function inventory() {
  return { formatVersion: 1, scope: 'test', tables: { Post: { rls: true, columns: { id: { notNull: true } } } },
    indexes: {}, routines: {}, triggers: {}, policies: {}, types: {}, views: {}, sequences: {},
    defaultPrivileges: {}, schemas: {}, extensions: {} };
}
test('key order does not cause drift; sequence and enum order remain significant', () => {
  const a = inventory(); const b = inventory();
  b.tables.Post = { columns: { id: { notNull: true } }, rls: true };
  assert.equal(compare(a, b).equal, true);
  a.types.tier = { labels: ['free', 'member'] };
  b.types.tier = { labels: ['member', 'free'] };
  assert.equal(compare(a, b).equal, false);
});
test('equal table counts cannot conceal missing objects or changed access', () => {
  const a = inventory(); const b = inventory();
  a.tables.Secret = { rls: true }; b.tables.Replacement = { rls: true };
  b.tables.Post.rls = false;
  b.tables.Post.acl = ['private embedded value'];
  const report = compare(a, b);
  assert.equal(report.counts.tables.before, report.counts.tables.after);
  assert.deepEqual(report.changes, [
    { kind: 'added', path: '/tables/Post/acl' },
    { kind: 'changed', path: '/tables/Post/rls' },
    { kind: 'added', path: '/tables/Replacement' },
    { kind: 'removed', path: '/tables/Secret' },
  ]);
  assert.equal(JSON.stringify(report).includes('private embedded value'), false);
});
test('detects RPC grants, trigger state, invalid indexes and default-privilege drift', () => {
  const a = inventory();
  a.routines.rpc = { acl: [{ role: 'service_role', privilege: 'EXECUTE' }] };
  a.triggers.update = { enabled: 'O' }; a.indexes.unique = { valid: true };
  a.defaultPrivileges.postgres = ['service_role'];
  const b = structuredClone(a);
  b.routines.rpc.acl[0].role = 'PUBLIC'; b.triggers.update.enabled = 'D';
  b.indexes.unique.valid = false; b.defaultPrivileges.postgres.push('anon');
  assert.equal(compare(a, b).changes.length, 4);
});
test('paths escape unusual names and never include changed private values', () => {
  const a = inventory(); const b = inventory();
  a.policies['table/a~b'] = { qual: 'private value A' };
  b.policies['table/a~b'] = { qual: 'private value B' };
  assert.deepEqual(compare(a, b).changes, [{ kind: 'changed', path: '/policies/table~1a~0b/qual' }]);
});
test('rejects incomplete, empty, incompatible or differently scoped inventories', () => {
  const a = inventory();
  for (const b of [null, {}, { ...a, formatVersion: 2 }, { ...a, indexes: null },
    { ...a, tables: {} }, { ...a, scope: 'different' }, { ...a, unrecognizedCoverage: {} }]) {
    assert.throws(() => compare(a, b));
  }
});
