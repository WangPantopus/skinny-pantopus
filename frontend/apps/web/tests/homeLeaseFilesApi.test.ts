import apiClient, { del, get, post, uploadFile } from '../../../packages/api/src/client';
import * as tenant from '../../../packages/api/src/endpoints/tenant';
jest.mock('../../../packages/api/src/client', () => ({
  __esModule: true, default: { get: jest.fn() }, get: jest.fn(), post: jest.fn(), del: jest.fn(), uploadFile: jest.fn(),
}));
const home = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const actor = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const other = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const scope: tenant.LeaseFileSession = { home_id: home, actor_id: actor, session_scope: 'a'.repeat(64) };
const file: tenant.LeaseFile = { id, home_id: home, file_name: 'lease.txt', file_size: 5, mime_type: 'text/plain', available: true, lease_id: null };
const context = { home_id: home, actor_id: actor, lease_id: null, lease_state: null };
const headers = { 'x-pantopus-session-scope': scope.session_scope };
const blob = new Blob(['lease'], { type: 'text/plain' });
beforeEach(() => {
  jest.clearAllMocks();
  (get as jest.Mock).mockImplementation(async (path: string) => path.endsWith('/session') ? scope : { file: { ...file } });
  (uploadFile as jest.Mock).mockResolvedValue({ file });
  (apiClient.get as jest.Mock).mockResolvedValue({ data: blob });
  (del as jest.Mock).mockResolvedValue({ deleted: true, cleanup_pending: true });
});
test('private upload uses the caller-retained File identity, request context and opening session', async () => {
  const picked = new File(['lease'], 'lease.txt', { type: 'text/plain' });
  expect(await tenant.uploadLeaseFile(scope, id, picked, context)).toEqual(file);
  expect(uploadFile).toHaveBeenCalledWith(`/api/v1/tenant/home/${home}/lease-files`, picked,
    { upload_id: id, request_context: context }, { headers });
  expect(post).not.toHaveBeenCalled();
});
test.each(['other-account', 'other-home', 'invalid-id', 'empty', 'unsupported'])('%s cannot start a private upload', async kind => {
  const picked = new File(kind === 'empty' ? [] : ['lease'], 'lease.txt', { type: kind === 'unsupported' ? 'text/html' : 'text/plain' });
  const observed = { ...context, ...(kind === 'other-account' ? { actor_id: other } : {}), ...(kind === 'other-home' ? { home_id: other } : {}) };
  await expect(tenant.uploadLeaseFile(scope, kind === 'invalid-id' ? '../elsewhere' : id, picked, observed)).rejects.toThrow();
  expect(uploadFile).not.toHaveBeenCalled();
});
test.each(['other-file', 'other-home', 'incomplete', 'invalid-size'])('an %s upload receipt is not accepted', async kind => {
  (uploadFile as jest.Mock).mockResolvedValue({ file: { ...file,
    ...(kind === 'other-file' ? { id: other } : {}), ...(kind === 'other-home' ? { home_id: other } : {}),
    ...(kind === 'incomplete' ? { available: false } : {}), ...(kind === 'invalid-size' ? { file_size: 0 } : {}),
  } });
  await expect(tenant.uploadLeaseFile(scope, id, new File(['lease'], 'lease.txt', { type: 'text/plain' }), context)).rejects.toThrow();
});
test('a changed server session cannot be silently adopted by an existing reader', async () => {
  (get as jest.Mock).mockResolvedValue({ ...scope, session_scope: 'b'.repeat(64) });
  await expect(tenant.getLeaseFileSession(home, scope)).rejects.toThrow('session changed');
});
test('bytes are returned only after the exact file is reauthorized with the same session', async () => {
  expect(await tenant.downloadLeaseFile(scope, id)).toEqual({ file, bytes: blob });
  expect(get).toHaveBeenCalledTimes(2);
  for (const call of (get as jest.Mock).mock.calls) expect(call[2]).toEqual({ headers });
  expect(apiClient.get).toHaveBeenCalledWith(`/api/v1/tenant/home/${home}/lease-files/${id}/content`, { responseType: 'blob', headers });
});
test.each(['denied', 'changed', 'wrong-size', 'wrong-type'])('a %s read cannot return already-downloaded bytes', async kind => {
  if (kind === 'denied') (get as jest.Mock).mockResolvedValueOnce({ file }).mockRejectedValueOnce(new Error('Access denied'));
  if (kind === 'changed') (get as jest.Mock).mockResolvedValueOnce({ file }).mockResolvedValueOnce({ file: { ...file, lease_id: other } });
  if (kind === 'wrong-size') (apiClient.get as jest.Mock).mockResolvedValue({ data: new Blob(['longer bytes']) });
  if (kind === 'wrong-type') (apiClient.get as jest.Mock).mockResolvedValue({ data: new Blob(['lease'], { type: 'text/html' }) });
  await expect(tenant.downloadLeaseFile(scope, id)).rejects.toThrow();
});
test('confirmed draft retirement succeeds while provider cleanup remains pending', async () => {
  await tenant.removeLeaseFile(scope, id);
  expect(del).toHaveBeenCalledWith(`/api/v1/tenant/home/${home}/lease-files/${id}`, undefined, { headers });
  (del as jest.Mock).mockResolvedValue({ deleted: false });
  await expect(tenant.removeLeaseFile(scope, id)).rejects.toThrow();
});
test('attachment submission preserves the opening account/Home/session and the saved file ID', async () => {
  const data = { home_id: home, request_context: context, lease_file_id: id };
  await tenant.requestApproval(data, scope);
  expect(post).toHaveBeenCalledWith('/api/v1/tenant/request-approval', data, { headers });
  (post as jest.Mock).mockClear();
  await expect(tenant.requestApproval({ ...data, request_context: { ...context, actor_id: other } }, scope)).rejects.toThrow();
  expect(post).not.toHaveBeenCalled();
});
