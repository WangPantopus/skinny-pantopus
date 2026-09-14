const db = require('../__mocks__/supabaseAdmin');
const service = require('../../services/homeAuthorityService');
beforeEach(() => { db.resetTables(); });
test.each([null, { data: null }, { data: null, error: { code: '08006', message: 'private SQL' } }])(
  'missing/failed transaction result is retryable (%j)', async result => {
    db.setRpcMock(async () => result);
    await expect(service.mutateMember({ homeId: 'home', actorId: 'actor', targetId: 'target', action: 'role' }))
      .rejects.toMatchObject({ statusCode: 503, code: 'HOME_AUTHORITY_UNAVAILABLE' });
  });
test('transport rejection is retryable without leaking its details', async () => {
  db.setRpcMock(async () => { throw new Error('private SQL'); });
  await expect(service.deleteHome('home', 'actor')).rejects.toMatchObject({ statusCode: 503, code: 'HOME_AUTHORITY_UNAVAILABLE' });
});
test.each([
  ['HOME_DELETE_STORAGE_CLEANUP_REQUIRED', 409], ['HOME_DELETE_LINKED_DATA', 409],
  ['HOME_DELETE_ESTABLISHED_HOUSEHOLD', 409], ['HOME_DELETE_ACCESS_DENIED', 403],
  ['DELETE_HOME_NOT_PRIMARY', 403], ['HOME_NOT_FOUND', 404],
  ['HOME_DELETE_RETRY', 503], ['HOME_DELETE_FAILED', 503],
])('deletion maps %s to truthful status %i', async (code, statusCode) => {
  db.setRpcMock(async () => ({ data: { allowed: false, deleted: false, code }, error: null }));
  await expect(service.deleteHome('home', 'actor')).rejects.toMatchObject({ code, statusCode });
});
test('deletion does not claim success for an eligibility-only result', async () => {
  db.setRpcMock(async () => ({ data: { allowed: true, deleted: false, code: 'HOME_DELETE_ALLOWED' }, error: null }));
  await expect(service.deleteHome('home', 'actor')).rejects.toMatchObject({ statusCode: 503, code: 'HOME_AUTHORITY_UNAVAILABLE' });
});
test('deletion binds exact identity and requires confirmed transaction completion', async () => {
  const home = 'ddf10001-0000-4000-8000-000000000100';
  const rpc = jest.fn(async name => ({ data: name === 'prepare_home_task_media_home_delete'
    ? { allowed: true, deleted: false, home_id: home, cleanup: [] }
    : { allowed: true, deleted: true, code: 'HOME_DELETED' }, error: null }));
  db.setRpcMock(rpc);
  await expect(service.deleteHome(home, 'actor')).resolves.toMatchObject({ deleted: true });
  expect(rpc.mock.calls.map(call => call[0])).toEqual(['prepare_home_task_media_home_delete', 'delete_home_authorized']);
  expect(rpc).toHaveBeenCalledWith('delete_home_authorized', { p_home_id: home, p_user_id: 'actor' });
});
test('Home deletion rejects another Home retirement receipt before deletion', async () => {
  const rpc = jest.fn(async () => ({ data: { allowed: true, deleted: false, home_id: 'other', cleanup: [] }, error: null }));
  db.setRpcMock(rpc);
  await expect(service.deleteHome('home', 'actor')).rejects.toMatchObject({ statusCode: 503 }); expect(rpc).toHaveBeenCalledTimes(1);
});
test('new task attachment at final Home deletion gets one bounded retirement retry', async () => {
  const home = 'ddf10001-0000-4000-8000-000000000100'; let finals = 0;
  const rpc = jest.fn(async name => ({ data: name === 'prepare_home_task_media_home_delete'
    ? { allowed: true, deleted: false, home_id: home, cleanup: [] }
    : ++finals === 1 ? { allowed: false, deleted: false, code: 'HOME_DELETE_TASK_MEDIA_CLEANUP_REQUIRED' }
      : { allowed: true, deleted: true, code: 'HOME_DELETED' }, error: null }));
  db.setRpcMock(rpc); await expect(service.deleteHome(home, 'actor')).resolves.toMatchObject({ deleted: true });
  expect(rpc).toHaveBeenCalledTimes(4);
});
test.each(['HOME_DELETE_RETRY', 'HOME_DELETE_FAILED'])('eligibility %s is not a permanent no-access result', async code => {
  db.setRpcMock(async () => ({ data: { allowed: false, deleted: false, code }, error: null }));
  await expect(service.deleteEligibility('home', 'actor')).rejects.toMatchObject({ statusCode: 503 });
});
