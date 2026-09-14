const db = require('../__mocks__/supabaseAdmin');
const service = require('../../services/homeAccessSecretService');
beforeEach(() => { db.resetTables(); jest.clearAllMocks(); });

test('read binds Home and authenticated actor to one RPC', async () => {
  const secrets = [{ id: 'secret', secret_value: 'synthetic-value' }];
  const rpc = jest.fn(async () => ({ data: { ok: true, secrets }, error: null }));
  db.setRpcMock(rpc);
  await expect(service.list('home', 'actor')).resolves.toEqual(secrets);
  expect(rpc).toHaveBeenCalledWith('get_home_access_secrets', { p_home_id: 'home', p_actor_id: 'actor' });
});

test.each(['create', 'bootstrap_wifi', 'update', 'delete'])('%s is one atomic actor-bound call', async action => {
  const rpc = jest.fn(async () => ({ data: { ok: true, deleted: true,
    secret: { id: 'secret', secret_value: '', has_secret: true } }, error: null }));
  db.setRpcMock(rpc);
  const payload = action === 'update' ? { notes: 'Omitted password' } : {};
  await service.mutate({ homeId: 'home', actorId: 'actor', secretId: 'secret', action, payload });
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('mutate_home_access_secret', {
    p_home_id: 'home', p_actor_id: 'actor', p_secret_id: 'secret', p_action: action, p_payload: payload,
  });
});

test.each([
  [{ code: '23505', message: 'secret provider detail' }, 'HOME_SECRET_DUPLICATE', 409],
  [{ code: '22P02', message: 'secret provider detail' }, 'HOME_SECRET_INVALID', 400],
  [{ code: '55P03', message: 'secret provider detail' }, 'HOME_SECRET_UNAVAILABLE', 503],
])('database failures are bounded and do not expose credential details', async (error, code, status) => {
  db.setRpcMock(async () => ({ error, data: null }));
  await expect(service.list('home', 'actor')).rejects.toMatchObject({ code, statusCode: status });
  await expect(service.list('home', 'actor')).rejects.not.toHaveProperty('message', 'secret provider detail');
});

test('permission denial never falls back to a direct secret read', async () => {
  db.setRpcMock(async () => ({ data: { ok: false, code: 'HOME_SECRET_ACCESS_DENIED', status: 403 }, error: null }));
  const from = jest.spyOn(db, 'from');
  await expect(service.list('home', 'actor')).rejects.toMatchObject({ statusCode: 403 });
  expect(from).not.toHaveBeenCalled();
  from.mockRestore();
});

test.each([null, {}, { ok: true }, { ok: false, code: 'foreign provider details', status: 403 }])('malformed RPC result fails closed', async data => {
  db.setRpcMock(async () => ({ data, error: null }));
  await expect(service.list('home', 'actor')).rejects.toMatchObject({ code: 'HOME_SECRET_UNAVAILABLE' });
});

test('thrown transport errors never include their raw message', async () => {
  db.setRpcMock(async () => { throw new Error('synthetic confidential provider details'); });
  await expect(service.list('home', 'actor')).rejects.toMatchObject({ code: 'HOME_SECRET_UNAVAILABLE' });
});
