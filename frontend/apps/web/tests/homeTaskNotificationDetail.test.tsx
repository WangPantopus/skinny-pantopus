import { act, render, screen, waitFor } from '@testing-library/react';
import * as api from '@pantopus/api';
import HomeTaskPage from '../src/app/(app)/app/homes/[id]/tasks/[taskId]/page';
import HomeTaskNotificationDetail from '../src/components/home/HomeTaskNotificationDetail';

const home = 'ddf18400-0000-4000-8000-000000000100';
const taskId = 'ddf18400-0000-4000-8000-000000000200';
const actor = 'ddf18400-0000-4000-8000-000000000001';
let token: string | null = 'opening-token';
let origin = 'https://synthetic.invalid';
let changed: () => void;
jest.mock('next/navigation', () => ({ useParams: () => ({ id: home, taskId }) }));
jest.mock('@pantopus/api', () => ({
  get: jest.fn(), users: { getMyProfile: jest.fn() },
  AUTH_SESSION_CHANGE_KEY: 'synthetic-session-marker',
  getAuthToken: () => token, getApiBaseUrl: () => origin,
  onTokenChange: (callback: () => void) => { changed = callback; return jest.fn(); },
  taskSessionHeaders: (scope?: { session_scope: string }) => scope ? { 'x-pantopus-session-scope': scope.session_scope } : undefined,
}));
jest.mock('../src/components/home/TaskAttachmentList', () => ({ __esModule: true,
  default: ({ homeId, taskId: exact, openingScope }: { homeId: string; taskId: string; openingScope: { actor_id: string } }) =>
    <div data-testid="attachments">{homeId}:{exact}:{openingScope.actor_id}</div>,
}));
const get = api.get as jest.Mock;
const profile = api.users.getMyProfile as jest.Mock;
function response(overrides: Record<string, unknown> = {}) {
  return { task: { id: taskId, home_id: home, title: 'Exact Home task', status: 'open', description: 'Current private notes' },
    task_session: { actor_id: actor, home_id: home, session_scope: 'a'.repeat(64) }, ...overrides };
}
function visibility(value: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value });
  document.dispatchEvent(new Event('visibilitychange'));
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => {
  jest.clearAllMocks(); token = 'opening-token'; origin = 'https://synthetic.invalid';
  localStorage.clear(); localStorage.setItem(api.AUTH_SESSION_CHANGE_KEY, 'opening-session');
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  profile.mockResolvedValue({ id: actor }); get.mockResolvedValue(response());
});
test('actual nested route reads only its exact task and binds authorized attachment scope', async () => {
  render(<HomeTaskPage />);
  await screen.findByRole('heading', { name: 'Exact Home task' });
  expect(get).toHaveBeenCalledWith(`/api/homes/${home}/tasks/${taskId}`, undefined, { headers: undefined });
  expect(screen.getByTestId('attachments')).toHaveTextContent(`${home}:${taskId}:${actor}`);
  expect(screen.queryByRole('button', { name: /save|create|complete|delete/i })).not.toBeInTheDocument();
});
test.each([403, 404])('denied/missing task %s hides content and attachments', async statusCode => {
  get.mockRejectedValue({ statusCode }); render(<HomeTaskPage />);
  await screen.findByText('This task is unavailable or your access has changed.');
  expect(screen.queryByTestId('attachments')).not.toBeInTheDocument();
  expect(screen.queryByText('Current private notes')).not.toBeInTheDocument();
});
test.each([
  response({ task: { id: actor, home_id: home, title: 'Wrong task', status: 'open' } }),
  response({ task: { id: taskId, home_id: actor, title: 'Wrong Home', status: 'open' } }),
  response({ task: { id: taskId, home_id: home, title: 'Malformed', description: {}, status: 'open' } }),
])('mismatched or malformed task cannot render', async value => {
  get.mockResolvedValue(value); render(<HomeTaskPage />); await screen.findByRole('alert');
  expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  expect(screen.queryByTestId('attachments')).not.toBeInTheDocument();
});
test('backgrounding clears content and restoration rechecks access with the original server session', async () => {
  render(<HomeTaskPage />); await screen.findByRole('heading');
  act(() => visibility('hidden'));
  expect(screen.queryByText('Current private notes')).not.toBeInTheDocument();
  get.mockRejectedValueOnce({ statusCode: 403 }); act(() => visibility('visible'));
  await screen.findByRole('alert');
  expect(get).toHaveBeenLastCalledWith(`/api/homes/${home}/tasks/${taskId}`, undefined,
    { headers: { 'x-pantopus-session-scope': 'a'.repeat(64) } });
  expect(screen.queryByTestId('attachments')).not.toBeInTheDocument();
});
test('a late background response cannot show content and a queued visible return makes a fresh read', async () => {
  const pending = deferred<ReturnType<typeof response>>(); get.mockReturnValueOnce(pending.promise);
  render(<HomeTaskPage />); await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
  act(() => { visibility('hidden'); visibility('visible'); });
  await act(async () => pending.resolve(response({ task: { id: taskId, home_id: home, title: 'Old private reply', status: 'open' } })));
  await screen.findByRole('heading', { name: 'Exact Home task' });
  expect(get).toHaveBeenCalledTimes(2); expect(screen.queryByText('Old private reply')).not.toBeInTheDocument();
});
test.each(['token', 'same-cookie-session', 'origin'])('replacement %s during first profile read cannot bind the old page', async kind => {
  const pending = deferred<{ id: string }>(); profile.mockReturnValueOnce(pending.promise);
  render(<HomeTaskPage />);
  if (kind === 'token') token = 'replacement';
  if (kind === 'same-cookie-session') localStorage.setItem(api.AUTH_SESSION_CHANGE_KEY, 'replacement');
  if (kind === 'origin') origin = 'https://replacement.invalid';
  await act(async () => pending.resolve({ id: actor }));
  await screen.findByText(/signed-in session changed/);
  expect(get).not.toHaveBeenCalled();
});
test('same-session server scope drift clears the previously visible task', async () => {
  render(<HomeTaskPage />); await screen.findByRole('heading');
  act(() => visibility('hidden'));
  get.mockResolvedValueOnce(response({ task_session: { actor_id: actor, home_id: home, session_scope: 'b'.repeat(64) } }));
  act(() => visibility('visible')); await screen.findByText(/signed-in session changed/);
  expect(screen.queryByRole('heading')).not.toBeInTheDocument();
});
test('logout notification immediately clears private task content', async () => {
  render(<HomeTaskPage />); await screen.findByRole('heading'); act(() => changed());
  expect(screen.queryByText('Current private notes')).not.toBeInTheDocument();
  expect(screen.queryByTestId('attachments')).not.toBeInTheDocument();
});
test('invalid route does not read a profile or task', async () => {
  render(<HomeTaskNotificationDetail homeId="../foreign" taskId={taskId} />);
  await screen.findByText('This task link is invalid.'); expect(profile).not.toHaveBeenCalled(); expect(get).not.toHaveBeenCalled();
});
test('old task reply cannot populate a reused component after navigation', async () => {
  const pending = deferred<ReturnType<typeof response>>(); get.mockReturnValueOnce(pending.promise);
  const next = 'ddf18400-0000-4000-8000-000000000201';
  const view = render(<HomeTaskNotificationDetail homeId={home} taskId={taskId} />);
  await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
  get.mockResolvedValueOnce(response({ task: { id: next, home_id: home, title: 'Next exact task', status: 'open' } }));
  view.rerender(<HomeTaskNotificationDetail homeId={home} taskId={next} />);
  await screen.findByRole('heading', { name: 'Next exact task' });
  await act(async () => pending.resolve(response()));
  expect(screen.queryByText('Current private notes')).not.toBeInTheDocument();
});
