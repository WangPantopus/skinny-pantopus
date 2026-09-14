const db = require('../__mocks__/supabaseAdmin');
jest.mock('../../services/notificationService', () => ({ notifyOwnershipClaimApproved: jest.fn(), notifyOwnershipClaimRejected: jest.fn(), notifyOwnershipClaimNeedsMoreInfo: jest.fn() }));
const notification = require('../../services/notificationService');
const service = require('../../services/homeClaimReviewService');
const approved = { ok: true, homeId: 'home', claimId: 'claim', claimantId: 'target', action: 'approve', state: 'approved', replayed: false,
  occupancy: { id: 'occupancy', home_id: 'home', user_id: 'target', role_base: 'lease_resident' } };
beforeEach(() => { db.resetTables(); jest.clearAllMocks(); });
test('binds actor, exact Home/claim, displayed snapshot and explicit platform gateway', async () => {
  const rpc = jest.fn(async () => ({ data: approved })); db.setRpcMock(rpc); const from = jest.spyOn(db, 'from');
  await service.mutate({ homeId: 'home', claimId: 'claim', actorId: 'actor', action: 'approve', reviewToken: 'a'.repeat(64), note: 'Reviewed' });
  expect(rpc).toHaveBeenCalledWith('mutate_home_claim_review', { p_home_id: 'home', p_claim_id: 'claim', p_actor_id: 'actor', p_action: 'approve',
    p_review_token: 'a'.repeat(64), p_note: 'Reviewed', p_platform_admin: false, p_validity_days: 365 });
  expect(from).not.toHaveBeenCalled(); expect(notification.notifyOwnershipClaimApproved).not.toHaveBeenCalled(); from.mockRestore();
});
test('platform authority is explicit and notification failure does not invent rollback', async () => {
  const rpc = jest.fn(async () => ({ data: approved })); db.setRpcMock(rpc); notification.notifyOwnershipClaimApproved.mockRejectedValueOnce(new Error('transport'));
  await expect(service.mutate({ claimId: 'claim', actorId: 'admin', action: 'approve', reviewToken: 'a'.repeat(64), platformAdmin: true })).resolves.toEqual(approved);
  expect(rpc.mock.calls[0][1]).toMatchObject({ p_home_id: null, p_actor_id: 'admin', p_platform_admin: true });
});
test.each([null, {}, { ok: true }, { ...approved, homeId: 'foreign' }, { ...approved, claimId: 'foreign' }, { ...approved, action: 'reject' },
  { ...approved, occupancy: { ...approved.occupancy, user_id: 'actor' } }, { ...approved, occupancy: { ...approved.occupancy, home_id: 'foreign' } },
  { ok: false, code: 'toString', status: 403 }, { ok: false, code: 'private object key', status: 409 }])('malformed receipt stays private/retryable (%#)', async data => {
  db.setRpcMock(async () => ({ data }));
  await expect(service.mutate({ homeId: 'home', claimId: 'claim', actorId: 'actor', action: 'approve' })).rejects.toMatchObject({ code: 'CLAIM_REVIEW_UNAVAILABLE', statusCode: 503 });
  expect(notification.notifyOwnershipClaimApproved).not.toHaveBeenCalled();
});
test.each(['CLAIM_REVIEW_CHANGED','CLAIM_NOT_ELIGIBLE','CLAIM_VERIFIED_EVIDENCE_REQUIRED','CLAIM_EVIDENCE_PRIVATE_REUPLOAD_REQUIRED','IDENTITY_CONFIRMATION_REQUIRED'])('known %s remains denied', async code => {
  db.setRpcMock(async () => ({ data: { ok: false, code, status: 409 } })); const from = jest.spyOn(db, 'from');
  await expect(service.mutate({ homeId: 'home', claimId: 'claim', actorId: 'actor', action: 'approve' })).rejects.toMatchObject({ code, statusCode: 409 });
  expect(from).not.toHaveBeenCalled(); from.mockRestore();
});
test.each(['55P03','40001','XX000'])('database %s does not produce a partial success', async code => {
  db.setRpcMock(async () => ({ error: { code, message: 'private provider location' } }));
  await expect(service.mutate({ homeId: 'home', claimId: 'claim', actorId: 'actor', action: 'withdraw' })).rejects.toMatchObject({ code: 'CLAIM_REVIEW_UNAVAILABLE', statusCode: 503 });
});
test('thrown auth-state transport failure is retryable', async () => {
  db.setRpcMock(async () => { throw new Error('private host'); });
  await expect(service.read({ homeId: 'home', claimId: 'claim', actorId: 'actor' })).rejects.toMatchObject({ code: 'CLAIM_REVIEW_UNAVAILABLE', statusCode: 503 });
});
test('review read requires snapshot and matching source identity', async () => {
  const receipt = { ok: true, homeId: 'home', claimId: 'claim', claim: { id: 'claim', home_id: 'home', review_token: 'a'.repeat(64) }, evidence: [] };
  db.setRpcMock(async () => ({ data: receipt })); await expect(service.read({ homeId: 'home', claimId: 'claim', actorId: 'actor' })).resolves.toEqual(receipt);
  receipt.claim.home_id = 'other'; await expect(service.read({ homeId: 'home', claimId: 'claim', actorId: 'actor' })).rejects.toMatchObject({ statusCode: 503 });
});
test('withdrawal cannot confirm a hard-delete or opaque boolean receipt', async () => {
  db.setRpcMock(async () => ({ data: { ok: true, homeId: 'home', claimId: 'claim', action: 'withdraw', state: 'revoked', replayed: false, deleted: true } }));
  await expect(service.mutate({ homeId: 'home', claimId: 'claim', actorId: 'actor', action: 'withdraw' })).rejects.toMatchObject({ statusCode: 503 });
});
test('provider callback binds exact current claimant and provider facts', async () => {
  const rpc = jest.fn(async () => ({ data: { ok: true, homeId: 'home', claimId: 'claim', evidenceId: 'evidence' } })); db.setRpcMock(rpc);
  await service.recordProvider({ homeId: 'home', claimId: 'claim', actorId: 'actor', result: { provider: 'attom', matched: true, confidence: 83, details: { matched: true } } });
  expect(rpc).toHaveBeenCalledWith('record_home_claim_provider_evidence', { p_home_id: 'home', p_claim_id: 'claim', p_actor_id: 'actor', p_provider: 'attom', p_matched: true, p_confidence: 83, p_details: { matched: true }, p_apn: null });
});
test.each(['approve','reject'])('exact %s replay never duplicates notification or direct authority writes', async action => {
  const receipt = { ...approved, action, state: action === 'approve' ? 'approved' : 'rejected', replayed: true };
  db.setRpcMock(async () => ({ data: receipt })); const from = jest.spyOn(db, 'from');
  await expect(service.mutate({ homeId: 'home', claimId: 'claim', actorId: 'actor', action, platformAdmin: true })).resolves.toEqual(receipt);
  expect(notification.notifyOwnershipClaimApproved).not.toHaveBeenCalled(); expect(notification.notifyOwnershipClaimRejected).not.toHaveBeenCalled();
  expect(from).not.toHaveBeenCalled(); from.mockRestore();
});
