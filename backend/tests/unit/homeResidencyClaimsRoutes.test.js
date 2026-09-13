// Direct middleware/handler checks; no listening HTTP server or database.
jest.mock('express', () => ({ Router: () => ({ stack: [], get(path, ...handlers) { this.stack.push({ path, handlers }); } }) }));
jest.mock('../../services/homeResidencyClaimsService', () => ({ list: jest.fn(), sendError: jest.fn() }));
const router = require('../../routes/homeResidencyClaims');
const service = require('../../services/homeResidencyClaimsService');
const { getRequestSessionScope } = require('../../utils/requestSessionScope');
const actor = 'ddc27300-0000-4000-8000-000000000001';
const home = 'ddc27300-0000-4000-8000-000000000100';
const request = () => ({ user: { id: actor }, headers: { authorization: 'Bearer synthetic-unit-only' }, query: {}, params: { homeId: home } });
const response = () => { const r = { set: jest.fn(), json: jest.fn(), status: jest.fn() }; r.status.mockReturnValue(r); return r; };
beforeEach(() => jest.clearAllMocks());
test('both session and legacy queue routes set no-store before authentication and all validation', () => {
  expect(router.stack.map(route => route.path)).toEqual(['/residency-claims/session', '/:homeId/claims']);
  for (const route of router.stack) {
    const res = response(), next = jest.fn(); route.handlers[0]({}, res, next);
    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'private, no-store'); expect(next).toHaveBeenCalled();
    expect(route.handlers[1]).toBe(require('../__mocks__/verifyToken'));
  }
});
test('session bootstrap returns only authenticated binding and never reads private claims', () => {
  const req = request(), res = response(); router.stack[0].handlers[2](req, res);
  expect(res.json).toHaveBeenCalledWith({ session: getRequestSessionScope(req) }); expect(service.list).not.toHaveBeenCalled();
});
test('legacy no-header and strict matching-header callers receive the same guarded envelope', async () => {
  service.list.mockResolvedValue({ home_id: home, actor_id: actor, claims: [] });
  for (const includeScope of [false, true]) {
    const req = request(), res = response();
    if (includeScope) req.headers['x-pantopus-session-scope'] = getRequestSessionScope(req).session_scope;
    await router.stack[1].handlers[2](req, res);
    expect(service.list).toHaveBeenLastCalledWith({ homeId: home, actorId: actor });
    expect(res.json).toHaveBeenCalledWith({ home_id: home, actor_id: actor, claims: [], residency_session: { ...getRequestSessionScope(req), home_id: home } });
  }
});
test('malformed, old-session and foreign expected scopes stop before SQL without false empty', async () => {
  for (const scope of ['', [], 'a'.repeat(64), null]) {
    const req = request(), res = response(); req.headers['x-pantopus-session-scope'] = scope;
    await router.stack[1].handlers[2](req, res);
    expect(res.status).toHaveBeenCalledWith(409); expect(res.json.mock.calls[0][0]).not.toHaveProperty('claims');
  }
  const req = request(), res = response(); req.headers['x-pantopus-session-scope'] = getRequestSessionScope(req).session_scope;
  req.headers.authorization = 'Bearer synthetic-new-session'; await router.stack[1].handlers[2](req, res);
  expect(res.status).toHaveBeenCalledWith(409); expect(service.list).not.toHaveBeenCalled();
});
test('unknown query, unavailable session and SQL failures never become an empty collection', async () => {
  for (const route of router.stack) {
    const req = request(), res = response(); req.query = { status: 'verified' }; await route.handlers[2](req, res);
    expect(service.sendError).toHaveBeenCalledWith(res, { code: 'RESIDENCY_CLAIMS_INVALID', statusCode: 400 });
  }
  expect(service.list).not.toHaveBeenCalled();
  const req = request(), res = response(); delete req.headers.authorization; await router.stack[1].handlers[2](req, res);
  expect(service.list).not.toHaveBeenCalled(); expect(res.json).not.toHaveBeenCalled();
  const error = Error('upstream unavailable'); service.list.mockRejectedValue(error);
  await router.stack[1].handlers[2](request(), res); expect(service.sendError).toHaveBeenLastCalledWith(res, error);
  expect(res.json).not.toHaveBeenCalled();
});
