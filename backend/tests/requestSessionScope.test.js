const { getRequestSessionScope, requireExpectedSessionScope } = require('../utils/requestSessionScope');
const req = (actor = 'synthetic-actor', session = 'synthetic-session', token = 'synthetic-token') => ({ user: { id: actor }, session: { id: session }, headers: { authorization: `Bearer ${token}` } });
const res = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
test('stable registered session fingerprint survives JWT refresh without exposing credentials', () => {
  const scope = getRequestSessionScope(req());
  expect(scope.session_scope).toMatch(/^[a-f0-9]{64}$/);
  expect(scope).toEqual(getRequestSessionScope(req(undefined, undefined, 'rotated-token')));
  expect(JSON.stringify(scope)).not.toMatch(/synthetic-session|synthetic-token/);
});
test('different account or replacement session never matches a retained screen', () => {
  expect(getRequestSessionScope(req('replacement-actor')).session_scope).not.toBe(getRequestSessionScope(req()).session_scope);
  expect(getRequestSessionScope(req(undefined, 'replacement-session')).session_scope).not.toBe(getRequestSessionScope(req()).session_scope);
});
test('verified legacy tokens bind by digest and fail closed across token replacement', () => {
  expect(getRequestSessionScope(req(undefined, null, 'one')).session_scope).not.toBe(getRequestSessionScope(req(undefined, null, 'two')).session_scope);
});
test('missing verified identity material cannot mint a scope', () => {
  expect(() => getRequestSessionScope({ user: { id: 'actor' } })).toThrow();
});
test('supplied expected scope is checked even when old clients may omit it', () => {
  const request = req(); const response = res(); request.headers['x-pantopus-session-scope'] = 'a'.repeat(64);
  expect(requireExpectedSessionScope(request, response)).toBe(false);
  expect(response.status).toHaveBeenCalledWith(409); expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SESSION_SCOPE_CHANGED' }));
});
test('required scope refuses omission, exact scope succeeds', () => {
  const request = req(); expect(requireExpectedSessionScope(request, res(), { required: true })).toBe(false);
  request.headers['x-pantopus-session-scope'] = getRequestSessionScope(request).session_scope;
  expect(requireExpectedSessionScope(request, res(), { required: true })).toBe(true);
});
