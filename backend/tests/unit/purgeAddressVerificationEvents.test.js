/**
 * PRV — AddressVerificationEvent grew without bound. No job touched it and
 * there was no retention policy, leaving an unbounded record of who tried to
 * verify what and when.
 */

const { resetTables, getTable, seedTable } = require('../__mocks__/supabaseAdmin');
const purge = require('../../jobs/purgeAddressVerificationEvents');

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

beforeEach(() => resetTables());

test('removes events past the retention window', async () => {
  seedTable('AddressVerificationEvent', [
    { id: 'e1', created_at: daysAgo(120) },
    { id: 'e2', created_at: daysAgo(91) },
    { id: 'e3', created_at: daysAgo(10) },
  ]);

  const res = await purge();

  expect(res.deleted).toBe(2);
  expect(getTable('AddressVerificationEvent').map((e) => e.id)).toEqual(['e3']);
});

test('keeps everything inside the window', async () => {
  seedTable('AddressVerificationEvent', [
    { id: 'e1', created_at: daysAgo(5) },
    { id: 'e2', created_at: daysAgo(89) },
  ]);

  const res = await purge();

  expect(res.deleted).toBe(0);
  expect(getTable('AddressVerificationEvent')).toHaveLength(2);
});

test('honours a custom retention window', async () => {
  seedTable('AddressVerificationEvent', [
    { id: 'e1', created_at: daysAgo(40) },
    { id: 'e2', created_at: daysAgo(20) },
  ]);

  const res = await purge({ retentionDays: 30 });

  expect(res.deleted).toBe(1);
  expect(getTable('AddressVerificationEvent').map((e) => e.id)).toEqual(['e2']);
});

test('dry run reports without deleting', async () => {
  seedTable('AddressVerificationEvent', [{ id: 'e1', created_at: daysAgo(200) }]);

  const res = await purge({ dryRun: true });

  expect(res.dry_run).toBe(true);
  expect(res.scanned).toBe(1);
  expect(res.deleted).toBe(0);
  expect(getTable('AddressVerificationEvent')).toHaveLength(1);
});

test('bounds a single run so a first pass on a large table is safe', () => {
  // The in-memory mock does not implement .limit() on selects, so assert the
  // bound structurally: the query must carry a limit, or a first run against a
  // table with millions of rows would try to load all of them.
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(
    path.join(__dirname, '../../jobs/purgeAddressVerificationEvents.js'), 'utf8',
  );
  expect(src).toContain('.limit(limit)');
  expect(src).toMatch(/BATCH_LIMIT|ADDRESS_EVENT_PURGE_BATCH/);
});
