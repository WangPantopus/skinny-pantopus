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

it('quarantines decided legacy refs without deleting caller-selected objects or claiming purge', async () => {
  seed(); const before = JSON.parse(JSON.stringify(getTable('HomeVerificationEvidence')));
  const out = await sweep();
  expect(out).toMatchObject({ live_objects: 5, claims_checked: 5, candidate_claims: 4, claims_purged: 0, objects_purged: 0, quarantined: 4, failed: 0 });
  expect(s3.deleteFromS3).not.toHaveBeenCalled(); expect(getTable('HomeVerificationEvidence')).toEqual(before);
});

it('dry run counts but deletes nothing', async () => {
  seed();
  const out = await sweep({ dryRun: true });
  expect(out.candidate_claims).toBe(4);
  expect(out.claims_purged).toBe(0);
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
