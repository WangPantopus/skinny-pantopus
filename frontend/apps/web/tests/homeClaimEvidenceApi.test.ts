import apiClient, { get, post } from '../../../packages/api/src/client';
import { assertClaimSession, inspectClaimEvidence, readClaimEvidence, verifyClaimEvidence } from '../../../packages/api/src/endpoints/claimEvidence';
jest.mock('../../../packages/api/src/client', () => ({ __esModule: true, default: { get: jest.fn() }, get: jest.fn(), post: jest.fn() }));
const scope = { actor_id: 'actor-a', home_id: 'home-a', claim_id: 'claim-a', session_scope: 'a'.repeat(64) };
const reviewToken = 'b'.repeat(64); const inspection = 'c'.repeat(64);
const record = { id: 'upload-a', home_id: 'home-a', claim_id: 'claim-a', status: 'verified', eligible_for_review: true };
const receipt = { ok: true, action: 'verify_evidence', home_id: 'home-a', claim_id: 'claim-a', upload_id: 'upload-a', record, review_token: 'd'.repeat(64), replayed: false };
beforeEach(() => {
  jest.clearAllMocks(); (get as jest.Mock).mockResolvedValue({ claim_session: scope });
  (apiClient.get as jest.Mock).mockResolvedValue({ data: new Blob(['exact bytes']), headers: { 'x-claim-evidence-inspection': inspection } });
  (post as jest.Mock).mockResolvedValue(receipt);
});
test('inspection uses an exact authenticated snapshot and rechecks session after actual byte response', async () => {
  await inspectClaimEvidence(scope, 'upload-a', reviewToken, true);
  expect(get).toHaveBeenCalledTimes(2);
  expect(apiClient.get).toHaveBeenCalledWith('/api/upload/home-claim-evidence/home-a/claim-a/upload-a/download', {
    responseType: 'blob', headers: { 'x-pantopus-session-scope': scope.session_scope }, params: { review: 'platform', review_token: reviewToken },
  });
  expect(post).not.toHaveBeenCalled();
});
test.each(['actor_id', 'home_id', 'claim_id', 'session_scope'])('a changed %s before bytes cannot start download', async field => {
  (get as jest.Mock).mockResolvedValue({ claim_session: { ...scope, [field]: 'replacement' } });
  await expect(inspectClaimEvidence(scope, 'upload-a', reviewToken)).rejects.toThrow('session changed');
  expect(apiClient.get).not.toHaveBeenCalled();
});
test('a replaced session after bytes cannot return those bytes or receipt', async () => {
  (get as jest.Mock).mockResolvedValueOnce({ claim_session: scope }).mockResolvedValueOnce({ claim_session: { ...scope, session_scope: 'e'.repeat(64) } });
  await expect(inspectClaimEvidence(scope, 'upload-a', reviewToken)).rejects.toThrow('session changed');
});
test('plain reading a verified file does not request a new inspection capability', async () => {
  await readClaimEvidence(scope, 'upload-a', true);
  expect(apiClient.get).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ params: { review: 'platform' } }));
  expect(post).not.toHaveBeenCalled();
});
test('explicit verification sends exact proof and accepts only its saved evidence receipt', async () => {
  await expect(verifyClaimEvidence(scope, 'upload-a', reviewToken, inspection, true)).resolves.toEqual(receipt);
  expect(post).toHaveBeenCalledWith('/api/upload/home-claim-evidence/home-a/claim-a/upload-a/verify?review=platform',
    { review_token: reviewToken, inspection }, { headers: { 'x-pantopus-session-scope': scope.session_scope } });
});
test.each([
  { claim_id: 'other' }, { upload_id: 'other' }, { action: 'approve' }, { record: { ...record, status: 'pending' } },
  { record: { ...record, eligible_for_review: false } }, { review_token: 'malformed' }, { replayed: undefined },
])('mismatched evidence mutation receipt cannot report verification %j', async change => {
  (post as jest.Mock).mockResolvedValue({ ...receipt, ...change });
  await expect(verifyClaimEvidence(scope, 'upload-a', reviewToken, inspection)).rejects.toThrow('Could not confirm');
});
test('malformed opening fingerprint cannot issue a metadata request', async () => {
  await expect(assertClaimSession({ ...scope, session_scope: 'invalid' })).rejects.toThrow('Reopen the claim');
  expect(get).not.toHaveBeenCalled();
});
