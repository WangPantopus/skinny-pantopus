// Exercise middleware and handlers directly: no HTTP server or database runtime.
jest.mock('express', () => ({ Router: () => ({ stack: [], use(...handlers) { this.stack.push({ kind: 'use', handlers }); },
  get(path, ...handlers) { this.stack.push({ kind: 'get', path, handlers }); } }) }));
jest.mock('../../services/homeResidencyReviewHistoryService', () => ({ list: jest.fn(), read: jest.fn(), sendError: jest.fn() }));
const router = require('../../routes/homeResidencyReviewHistory');
const service = require('../../services/homeResidencyReviewHistoryService');
const { getRequestSessionScope } = require('../../utils/requestSessionScope');
const actor = 'ddc27100-0000-4000-8000-000000000001';
const home = 'ddc27100-0000-4000-8000-000000000100';
const req = () => ({ user: { id: actor }, headers: { authorization: 'Bearer synthetic-unit-only' }, query: {}, params: { homeId: home, receiptId: home } });
const res = () => { const r = { set: jest.fn(), json: jest.fn(), status: jest.fn() }; r.status.mockReturnValue(r); return r; };
beforeEach(() => jest.clearAllMocks());
test('private no-store runs before authentication; session entry precedes required-scope domain reads', () => {
  const r = res(), next = jest.fn(); router.stack[0].handlers[0]({}, r, next); expect(r.set).toHaveBeenCalledWith('Cache-Control', 'private, no-store'); expect(next).toHaveBeenCalled();
  expect(router.stack[1].kind).toBe('use'); expect(router.stack[1].handlers[0]).toBe(require('../__mocks__/verifyToken'));
  expect(router.stack[2].path).toBe('/session'); expect(router.stack[3].kind).toBe('use');
  expect(router.stack.filter(s => s.kind === 'get').map(s => s.path)).toEqual(['/session', '/:homeId', '/:homeId/:receiptId']);
});
test('session scope identity grants no domain read and mismatched/absent scope stops before service', () => {
  const request = req(), response = res(), next = jest.fn();
  router.stack[2].handlers[0](request, response); expect(response.json).toHaveBeenCalledWith({ session: getRequestSessionScope(request) });
  router.stack[3].handlers[0](request, response, next); expect(next).not.toHaveBeenCalled(); expect(response.status).toHaveBeenCalledWith(409);
  expect(service.list).not.toHaveBeenCalled(); expect(service.read).not.toHaveBeenCalled();
});
test('exact current scope permits list/read; success envelope binds server session', async () => {
  const request = req(), response = res(), next = jest.fn(); request.headers['x-pantopus-session-scope'] = getRequestSessionScope(request).session_scope;
  router.stack[3].handlers[0](request, response, next); expect(next).toHaveBeenCalled();
  service.list.mockResolvedValue({ home_id: home, actor_id: actor, items: [], next_cursor: null });
  await router.stack[4].handlers[0](request, response);
  expect(service.list).toHaveBeenCalledWith({ actorId: actor, homeId: home, after: undefined });
  expect(response.json).toHaveBeenCalledWith({ home_id: home, actor_id: actor, items: [], next_cursor: null, session: getRequestSessionScope(request) });
  service.read.mockResolvedValue({ home_id: home, actor_id: actor, item: {} }); await router.stack[5].handlers[0](request, response);
  expect(service.read).toHaveBeenCalledWith({ actorId: actor, homeId: home, receiptId: home });
});
test('unexpected query fields and service failures do not substitute an empty list', async () => {
  const request = req(), response = res(); request.query = { actor_id: 'another' };
  await router.stack[4].handlers[0](request, response); expect(service.list).not.toHaveBeenCalled(); expect(service.sendError).toHaveBeenCalledWith(response, { code: 'RESIDENCY_HISTORY_INVALID', statusCode: 400 });
  request.query = {}; const error = Error('upstream unavailable'); service.list.mockRejectedValue(error);
  await router.stack[4].handlers[0](request, response); expect(service.sendError).toHaveBeenCalledWith(response, error); expect(response.json).not.toHaveBeenCalled();
});
