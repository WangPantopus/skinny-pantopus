jest.mock('../../config/supabaseAdmin', () => jest.requireActual('../__mocks__/supabaseAdmin'));
jest.mock('../../services/s3Service', () => ({ deleteFromS3: jest.fn() }));
const db = require('../__mocks__/supabaseAdmin');
const s3 = require('../../services/s3Service');
const { purgeClaimEvidence } = require('../../services/evidencePurge');
beforeEach(() => { db.resetTables(); jest.clearAllMocks(); });
test.each(['foreign/account/private.pdf','ownership-evidence/home/claim/actor/document.pdf','https://example.invalid/foreign.pdf'])('legacy %s quarantines without provider deletion or metadata stamp', async storage_ref => {
  const row = { id: 'e', claim_id: 'claim', storage_ref, metadata: { file_url: 'https://example.invalid', status: 'verified', storage_contract: 'forged-trust' } };
  db.seedTable('HomeVerificationEvidence', [row]);
  expect(await purgeClaimEvidence('claim', 'approved')).toEqual({ purged: 0, skipped: 1, failed: 0, quarantined: 1 });
  expect(s3.deleteFromS3).not.toHaveBeenCalled(); expect(db.getTable('HomeVerificationEvidence')).toEqual([row]);
});
test('failed retirement read is retryable rather than reporting no evidence', async () => {
  const spy = jest.spyOn(db, 'from').mockReturnValue({ select: () => ({ eq: async () => ({ data: null, error: { message: 'private connection' } }) }) });
  await expect(purgeClaimEvidence('claim')).rejects.toMatchObject({ code: 'EVIDENCE_RETIREMENT_UNAVAILABLE' });
  expect(s3.deleteFromS3).not.toHaveBeenCalled(); spy.mockRestore();
});
