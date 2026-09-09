const test = require('node:test');
const assert = require('node:assert/strict');
const review = require('./postgis-lint-review.json');
const { validate, validateApplication, localPort } = require('./check-function-lint.cjs');
const copy = value => structuredClone(value);
function fixture() {
  return {
    cli: review.entries.map(entry => ({ function: entry.function, issues: [copy(entry.issue)] })),
    provenance: { formatVersion: 1, routines: Object.fromEntries(review.entries.map(entry =>
      [entry.identity, Object.fromEntries(['function', 'extension', 'extensionVersion', 'definitionHash']
        .map(key => [key, entry[key]]))])) },
  };
}
test('accepts only the six reviewed stock diagnostics with matching provenance', () => {
  const { cli, provenance } = fixture();
  assert.equal(validate(cli, 1, provenance, review).reviewedExtensionErrors, 6);
  assert.equal(validate([], 0, provenance, review).reviewedExtensionErrors, 0);
});
test('never accepts an application error', () => {
  const { cli, provenance } = fixture();
  cli.push({ function: 'public.broken_app', issues: [copy(review.entries[0].issue)] });
  assert.throws(() => validate(cli, 1, provenance, review), /Unreviewed/);
});
test('rejects changed extension errors, SQLSTATE, context and occurrence counts', () => {
  for (const change of [issue => { issue.message += ' changed'; },
    issue => { issue.sqlState = 'XXXXX'; }, issue => { issue.context = 'new context'; }]) {
    const { cli, provenance } = fixture();
    change(cli[0].issues[0]);
    assert.throws(() => validate(cli, 1, provenance, review), /Unreviewed/);
  }
  const { cli, provenance } = fixture();
  cli.push(copy(cli.at(-1))); // A third ST_FindExtent error cannot borrow either overload's allowance.
  assert.throws(() => validate(cli, 1, provenance, review), /Unreviewed/);
});
test('rejects modified code, extension upgrades, lost membership and missing routines', () => {
  for (const [key, value] of [['definitionHash', 'a'.repeat(64)],
    ['extensionVersion', 'changed'], ['extension', null]]) {
    const { cli, provenance } = fixture();
    provenance.routines[review.entries[0].identity][key] = value;
    assert.throws(() => validate(cli, 1, provenance, review), /provenance changed/);
  }
  const { cli, provenance } = fixture();
  delete provenance.routines[review.entries[0].identity];
  assert.throws(() => validate(cli, 1, provenance, review), /provenance changed/);
});
test('rejects a same-name application overload even with identical error text', () => {
  const { cli, provenance } = fixture();
  provenance.routines['public.st_findextent(integer)'] = {
    function: 'public.st_findextent', extension: null, extensionVersion: null, definitionHash: 'b'.repeat(64),
  };
  assert.throws(() => validate(cli, 1, provenance, review), /collides/);
});
test('fails closed on crashes, inconsistent exit status and malformed evidence', () => {
  const { cli, provenance } = fixture();
  for (const status of [null, 2, 127]) assert.throws(() => validate(cli, status, provenance, review), /execution/);
  assert.throws(() => validate([], 1, provenance, review), /status/);
  assert.throws(() => validate(cli, 0, provenance, review), /status/);
  for (const bad of [null, {}, { results: {} }, [{ function: 'public.f' }]]) {
    assert.throws(() => validate(bad, 1, provenance, review));
  }
  cli[0].issues[0].level = 'unknown';
  assert.throws(() => validate(cli, 1, provenance, review), /Malformed/);
});
test('requires a local DB port without confusing API, shadow or pooler ports', () => {
  assert.equal(localPort('[api]\nport = 54321\n[db]\nport = 56322\nshadow_port = 56320\n[db.pooler]\nport = 56329\n'), '56322');
  for (const text of ['[api]\nport = 54321\n', '[db]\nport = 65536\n', '[db]\nport = 22\n']) {
    assert.throws(() => localPort(text), /Explicit local/);
  }
});
test('cannot accumulate unverified triggers or silently alter the two legacy orphans', () => {
  const provenance = { routines: Object.fromEntries(review.unattachedApplicationTriggers
    .map(entry => [entry.identity, { definitionHash: entry.definitionHash, extension: null }])) };
  const summary = { functions: 111, errors: 0,
    unattachedTriggerFunctions: review.unattachedApplicationTriggers.map(entry => entry.summaryName) };
  validateApplication(summary, provenance, review);
  assert.throws(() => validateApplication({ ...summary, functions: 0 }, provenance, review), /did not verify/);
  assert.throws(() => validateApplication({ ...summary, errors: 1 }, provenance, review), /did not verify/);
  assert.throws(() => validateApplication({ ...summary, unattachedTriggerFunctions: [...summary.unattachedTriggerFunctions, 'new_trigger()'] }, provenance, review), /Unreviewed/);
  provenance.routines[review.unattachedApplicationTriggers[0].identity].definitionHash = 'c'.repeat(64);
  assert.throws(() => validateApplication(summary, provenance, review), /Unreviewed/);
});
