/**
 * Evidence purge: once a claim is decided or withdrawn, the stored
 * documents are deleted from S3 and the rows are stamped (never the file).
 */
jest.mock('../../config/supabaseAdmin', () => jest.requireActual('../__mocks__/supabaseAdmin'));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../services/s3Service', () => ({ deleteFromS3: jest.fn(async () => ({})) }));
const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');
const s3 = require('../../services/s3Service');
const { purgeClaimEvidence, isS3Key } = require('../../services/evidencePurge');

beforeEach(() => { resetTables(); jest.clearAllMocks(); });

it('deletes S3 objects, stamps the rows, skips URLs and already-purged rows', async () => {
  seedTable('HomeVerificationEvidence', [
    { id: 'e1', claim_id: 'c1', evidence_type: 'utility_bill', status: 'pending', storage_ref: 'ownership-evidence/h1/c1/a.pdf', metadata: { content_hash: 'x' } },
    { id: 'e2', claim_id: 'c1', evidence_type: 'lease', status: 'pending', storage_ref: 'https://example.com/not-ours.pdf', metadata: {} },
    { id: 'e3', claim_id: 'c1', evidence_type: 'idv', status: 'pending', storage_ref: 'ownership-evidence/h1/c1/b.jpg', metadata: { purged_at: '2026-01-01T00:00:00Z' } },
    { id: 'e4', claim_id: 'OTHER', evidence_type: 'deed', status: 'pending', storage_ref: 'ownership-evidence/h9/c9/z.pdf', metadata: {} },
  ]);
  const out = await purgeClaimEvidence('c1', 'approved');
  expect(out).toEqual({ purged: 1, skipped: 2, failed: 0 });
  expect(s3.deleteFromS3).toHaveBeenCalledTimes(1);
  expect(s3.deleteFromS3).toHaveBeenCalledWith('ownership-evidence/h1/c1/a.pdf');
  const e1 = getTable('HomeVerificationEvidence').find((r) => r.id === 'e1');
  expect(e1.storage_ref).toBeNull();
  expect(e1.metadata.purged_at).toBeTruthy();
  expect(e1.metadata.purge_reason).toBe('approved');
  expect(e1.metadata.content_hash).toBe('x'); // the audit trail stays
  expect(getTable('HomeVerificationEvidence').find((r) => r.id === 'e4').storage_ref).toBe('ownership-evidence/h9/c9/z.pdf');
});

it('leaves a row unstamped when the delete fails, so a sweep can retry', async () => {
  s3.deleteFromS3.mockRejectedValueOnce(new Error('boom'));
  seedTable('HomeVerificationEvidence', [{ id: 'e1', claim_id: 'c1', storage_ref: 'ownership-evidence/h1/c1/a.pdf', metadata: {} }]);
  const out = await purgeClaimEvidence('c1', 'rejected');
  expect(out).toEqual({ purged: 0, skipped: 0, failed: 1 });
  expect(getTable('HomeVerificationEvidence')[0].storage_ref).toBe('ownership-evidence/h1/c1/a.pdf');
});

it('isS3Key', () => {
  expect(isS3Key('ownership-evidence/a/b/c.pdf')).toBe(true);
  expect(isS3Key('https://x/y.pdf')).toBe(false);
  expect(isS3Key('')).toBe(false);
  expect(isS3Key(null)).toBe(false);
});
