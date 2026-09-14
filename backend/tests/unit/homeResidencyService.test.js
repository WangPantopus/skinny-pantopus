const db = require('../__mocks__/supabaseAdmin');
const service = require('../../services/homeResidencyService');
const verificationAge = require('../../utils/verificationAge');
const request = { homeId: 'home', actorId: 'actor', targetId: 'target', action: 'attach' };
beforeEach(() => { db.resetTables(); jest.clearAllMocks(); });
test('binds admission identity and server verification metadata to one transaction', async () => {
  const result = { ok: true, target_id: 'target', replayed: false, occupancy: { id: 'occ' }, user: { id: 'target' } };
  const rpc = jest.fn(async () => ({ data: result, error: null }));
  db.setRpcMock(rpc);
  expect(await service.review(request)).toEqual(result);
  expect(rpc).toHaveBeenCalledWith('review_home_residency', { p_home_id: 'home', p_actor_id: 'actor',
    p_action: 'attach', p_payload: { target_id: 'target' }, p_validity_days: verificationAge.validityDays() });
});
test.each(['55P03','40P01','08006','42501','XX000'])('SQL failure %s remains retryable and never falls back to a template', async code => {
  db.setRpcMock(async () => ({ data: null, error: { code, message: 'private database detail' } }));
  await expect(service.review(request)).rejects.toMatchObject({ statusCode: 503, code: 'HOME_ADMISSION_UNAVAILABLE' });
  expect(db.getTable('HomeOccupancy')).toHaveLength(0);
});
test('a thrown transport failure stays retryable', async () => {
  db.setRpcMock(async () => { throw new Error('private transport detail'); });
  await expect(service.review(request)).rejects.toMatchObject({ statusCode: 503 });
});
test.each([null, {}, { ok: true }, { ok: true, target_id: 'target', replayed: false },
  { ok: false, code: 'arbitrary server message', status: 403 }])('malformed result fails closed: %j', async data => {
  db.setRpcMock(async () => ({ data, error: null }));
  await expect(service.review(request)).rejects.toMatchObject({ statusCode: 503, code: 'HOME_ADMISSION_UNAVAILABLE' });
});
test.each([
  ['MEMBERS_MANAGE_REQUIRED',403], ['SELF_ADMISSION_FORBIDDEN',403], ['CLAIM_NOT_FOUND',404],
  ['MEMBERSHIP_RENEWAL_REQUIRED',409], ['CLAIM_NOT_PENDING',409], ['RESIDENCY_ROLE_FORBIDDEN',403],
])('known policy result %s preserves its status', async (code,status) => {
  db.setRpcMock(async () => ({ data: { ok: false, code, status }, error: null }));
  await expect(service.review(request)).rejects.toMatchObject({ statusCode: status, code });
});
test('review target comes from the claim; an extra caller target is not forwarded', async () => {
  const rpc = jest.fn(async () => ({ data: { ok: true, target_id: 'claimant', replayed: false }, error: null }));
  db.setRpcMock(rpc);
  await service.review({ ...request, action: 'reject', claimId: 'claim', reason: 'review note' });
  expect(rpc.mock.calls[0][1].p_payload).toEqual({ claim_id: 'claim', reason: 'review note' });
});
