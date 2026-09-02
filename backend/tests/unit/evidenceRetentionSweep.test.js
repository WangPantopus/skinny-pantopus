/**
 * Evidence retention sweep — the net under "deleted once your claim is
 * decided": purges any live object whose claim is decided; leaves open
 * claims alone.
 */
jest.mock('../../config/supabaseAdmin', () => jest.requireActual('../__mocks__/supabaseAdmin'));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../services/s3Service', () => ({ deleteFromS3: jest.fn(async () => ({})) }));
const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');
const s3 = require('../../services/s3Service');
const sweep = require('../../jobs/evidenceRetentionSweep');

beforeEach(() => { resetTables(); jest.clearAllMocks(); });

function seed() {
  seedTable('HomeOwnershipClaim', [
    { id: 'approved', state: 'approved', claim_phase_v2: 'verified' },
    { id: 'rejected', state: 'rejected', claim_phase_v2: 'rejected' },
    { id: 'expired', state: 'submitted', claim_phase_v2: 'expired' },
    { id: 'open', state: 'pending_review', claim_phase_v2: 'in_review' },
  ]);
  seedTable('HomeVerificationEvidence', [
    { id: 'e1', claim_id: 'approved', storage_ref: 'ownership-evidence/h/approved/a.pdf', metadata: {} },
    { id: 'e2', claim_id: 'rejected', storage_ref: 'ownership-evidence/h/rejected/b.pdf', metadata: {} },
    { id: 'e3', claim_id: 'expired', storage_ref: 'ownership-evidence/h/expired/c.pdf', metadata: {} },
    { id: 'e4', claim_id: 'open', storage_ref: 'ownership-evidence/h/open/d.pdf', metadata: {} },
    { id: 'e5', claim_id: 'approved', storage_ref: null, metadata: { purged_at: '2026-09-01T00:00:00Z' } },
    { id: 'e6', claim_id: 'gone', storage_ref: 'ownership-evidence/h/gone/e.pdf', metadata: {} },
    { id: 'e7', claim_id: 'open', storage_ref: 'https://example.com/theirs.pdf', metadata: {} },
  ]);
}

it('purges every live object of a decided (or vanished) claim and leaves open claims alone', async () => {
  seed();
  const out = await sweep();
  expect(out).toMatchObject({ live_objects: 5, claims_checked: 5, claims_purged: 4, objects_purged: 4, failed: 0, dry_run: false });
  const keys = s3.deleteFromS3.mock.calls.map(([k]) => k).sort();
  expect(keys).toEqual([
    'ownership-evidence/h/approved/a.pdf',
    'ownership-evidence/h/expired/c.pdf',
    'ownership-evidence/h/gone/e.pdf',
    'ownership-evidence/h/rejected/b.pdf',
  ]);
  const rows = Object.fromEntries(getTable('HomeVerificationEvidence').map((r) => [r.id, r]));
  expect(rows.e1.metadata.purge_reason).toBe('retention');
  expect(rows.e4.storage_ref).toBe('ownership-evidence/h/open/d.pdf'); // still under review
  expect(rows.e7.storage_ref).toBe('https://example.com/theirs.pdf'); // not our object
});

it('dry run counts but deletes nothing', async () => {
  seed();
  const out = await sweep({ dryRun: true });
  expect(out.claims_purged).toBe(4);
  expect(out.objects_purged).toBe(0);
  expect(s3.deleteFromS3).not.toHaveBeenCalled();
});

it('is a no-op with nothing live', async () => {
  seedTable('HomeVerificationEvidence', [{ id: 'e', claim_id: 'c', storage_ref: null, metadata: {} }]);
  expect(await sweep()).toMatchObject({ live_objects: 0, claims_purged: 0 });
});

it('isDecided', () => {
  expect(sweep.isDecided(null)).toBe(true);
  expect(sweep.isDecided({ state: 'revoked' })).toBe(true);
  expect(sweep.isDecided({ state: 'submitted', claim_phase_v2: 'expired' })).toBe(true);
  expect(sweep.isDecided({ state: 'pending_review', claim_phase_v2: 'in_review' })).toBe(false);
});
