const db = require('../__mocks__/supabaseAdmin');
const home = require('../../routes/home');
function handler(method, path) {
  return home.stack.find(l => l.route?.path === path && l.route.methods[method]).route.stack.at(-1).handle;
}
function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}
beforeEach(() => { db.resetTables(); jest.clearAllMocks(); });

test.each([
  ['get', '/:id/access', null, 200], ['post', '/:id/access', 'create', 201],
  ['put', '/:id/access/:secretId', 'update', 200], ['delete', '/:id/access/:secretId', 'delete', 200],
])('%s %s uses authenticated identity and preserves response contract', async (method, path, action, status) => {
  const secret = { id: 'secret', secret_value: '', has_secret: true };
  const rpc = jest.fn(async () => ({ data: { ok: true, secret, secrets: [secret], deleted: true }, error: null }));
  db.setRpcMock(rpc);
  const res = response();
  const body = method === 'delete' ? { actorId: 'forged' } : { notes: 'Metadata only' };
  await handler(method, path)({ params: { id: 'home', secretId: 'secret' }, user: { id: 'real-actor' }, body }, res);
  expect(res.statusCode).toBe(status);
  expect(rpc).toHaveBeenCalledTimes(1);
  if (!action) {
    expect(rpc).toHaveBeenCalledWith('get_home_access_secrets', { p_home_id: 'home', p_actor_id: 'real-actor' });
    expect(res.body).toEqual({ secrets: [secret] });
  } else {
    expect(rpc).toHaveBeenCalledWith('mutate_home_access_secret', expect.objectContaining({
      p_home_id: 'home', p_actor_id: 'real-actor', p_action: action,
      p_secret_id: ['update', 'delete'].includes(action) ? 'secret' : null,
      p_payload: action === 'delete' ? {} : body,
    }));
    expect(res.body).toEqual(action === 'delete' ? { message: 'Access secret deleted' } : { secret });
  }
});

test.each(['get', 'post', 'put', 'delete'])('%s propagates the transaction denial without success or fallback', async method => {
  db.setRpcMock(async () => ({ data: { ok: false, code: 'HOME_SECRET_WRITE_DENIED', status: 403 }, error: null }));
  const res = response();
  const from = jest.spyOn(db, 'from');
  await handler(method, ['put','delete'].includes(method) ? '/:id/access/:secretId' : '/:id/access')({
    params: { id: 'home', secretId: 'secret' }, user: { id: 'actor' }, body: {},
  }, res);
  expect(res.statusCode).toBe(403);
  expect(res.body.code).toBe('HOME_SECRET_WRITE_DENIED');
  expect(from).not.toHaveBeenCalled();
  from.mockRestore();
});
