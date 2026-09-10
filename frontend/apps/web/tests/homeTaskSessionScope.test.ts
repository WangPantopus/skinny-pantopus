import { get } from '../../../packages/api/src/client';
import { assertHomeTaskSession, taskSessionHeaders } from '../../../packages/api/src/taskSessionScope';
jest.mock('../../../packages/api/src/client', () => ({ get: jest.fn() }));
const scope = { actor_id: 'actor', home_id: 'home', session_scope: 'a'.repeat(64) };
beforeEach(() => { jest.clearAllMocks(); });
test('sends the opening fingerprint and exact requested task with a successful current response', async () => {
 (get as jest.Mock).mockResolvedValue({ ...scope, task_id: 'task' });
 await assertHomeTaskSession(scope, 'task');
 expect(get).toHaveBeenCalledWith('/api/upload/home-task-media-session/home', { task_id: 'task' },
  { headers: { 'x-pantopus-session-scope': scope.session_scope } });
});
test.each([
 { actor_id: 'other' }, { home_id: 'other' }, { task_id: 'other' }, { session_scope: 'b'.repeat(64) },
])('rejects mismatched current identity/resource response %o', async change => {
 (get as jest.Mock).mockResolvedValue({ ...scope, task_id: 'task', ...change });
 await expect(assertHomeTaskSession(scope, 'task')).rejects.toMatchObject({ code: 'SESSION_SCOPE_CHANGED' });
});
test.each([
 { code: 'Human message', data: { code: 'SESSION_SCOPE_CHANGED' }, statusCode: 409 },
 { statusCode: 401 }, { code: 'SESSION_SCOPE_CHANGED' },
])('normalizes the existing API transport error into a terminal opening-scope change %o', async error => {
 (get as jest.Mock).mockRejectedValue(error);
 await expect(assertHomeTaskSession(scope)).rejects.toMatchObject({ code: 'SESSION_SCOPE_CHANGED' });
});
test('retains a retryable transport failure instead of pretending the account changed', async () => {
 const error = Object.assign(new Error('Unavailable'), { statusCode: 503 }); (get as jest.Mock).mockRejectedValue(error);
 await expect(assertHomeTaskSession(scope)).rejects.toBe(error);
});
test('invalid fingerprint cannot start the current-session request', async () => {
 expect(() => taskSessionHeaders({ ...scope, session_scope: 'invalid' })).toThrow(); expect(get).not.toHaveBeenCalled();
});
