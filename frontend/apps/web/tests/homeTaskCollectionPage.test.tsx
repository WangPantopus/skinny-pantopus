import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as api from '@pantopus/api';
import TasksPage from '../src/app/(app)/app/homes/[id]/tasks/page';

const home = 'ddf25100-0000-4000-8000-000000000100';
const actor = 'ddf25100-0000-4000-8000-000000000001';
const taskId = 'ddf25100-0000-4000-8000-000000000200';
let changed: () => void;
jest.mock('next/navigation', () => ({ useParams: () => ({ id: home }), useRouter: () => ({ back: jest.fn() }) }));
jest.mock('../src/components/home/TaskSlidePanel', () => ({ __esModule: true, default: () => null }));
jest.mock('@pantopus/api', () => ({
  get: jest.fn(), users: { getMyProfile: jest.fn() }, homes: { getHomeOccupants: jest.fn() },
  getAuthToken: () => 'synthetic-session', getApiBaseUrl: () => 'https://synthetic.invalid',
  AUTH_SESSION_CHANGE_KEY: 'synthetic-marker', onTokenChange: (fn: () => void) => { changed = fn; return jest.fn(); },
  taskSessionHeaders: () => ({}), taskSessionChanged: () => new Error('Session changed'),
}));
const get = api.get as jest.Mock;
const scope = { actor_id: actor, home_id: home, session_scope: 'a'.repeat(64) };
const task = { id: taskId, home_id: home, title: 'Private household task', task_type: 'chore', priority: 'medium', status: 'open' };
const collection = (tasks: unknown[] = []) => ({ tasks, task_session: scope, collection_capabilities: { can_create: true } });
function visibility(state: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  document.dispatchEvent(new Event('visibilitychange'));
}
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  (api.users.getMyProfile as jest.Mock).mockResolvedValue({ id: actor });
  (api.homes.getHomeOccupants as jest.Mock).mockResolvedValue({ occupants: [] });
  get.mockResolvedValue(collection());
});
function expectNoCollectionClaims() {
  expect(screen.queryByText(/No (active|completed|recurring) tasks/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^(Active|Done|Recurring) \(/ })).not.toBeInTheDocument();
  expect(screen.queryByText(task.title)).not.toBeInTheDocument();
}

test.each([403, 503])('a %s response shows retry without claiming an empty collection', async statusCode => {
  get.mockRejectedValueOnce({ statusCode }); render(<TasksPage />);
  await screen.findByRole('alert'); expectNoCollectionClaims();
  expect(screen.getByRole('button', { name: 'Add Task' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Reload tasks' }));
  await screen.findByText('No active tasks');
  expect(screen.getByRole('button', { name: 'Active (0)' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add Task' })).toBeEnabled();
});

test('malformed success cannot establish an empty collection', async () => {
  get.mockResolvedValueOnce({ ...collection(), tasks: null }); render(<TasksPage />);
  await screen.findByRole('alert'); expectNoCollectionClaims();
});

test('a failed foreground refresh retires the old tasks and their counts', async () => {
  get.mockResolvedValueOnce(collection([task])); render(<TasksPage />);
  await screen.findByText(task.title);
  get.mockRejectedValueOnce({ statusCode: 503 });
  act(() => visibility('hidden')); expectNoCollectionClaims();
  act(() => visibility('visible')); await screen.findByRole('alert'); expectNoCollectionClaims();
});

test('an account change during a pending read cannot establish an empty list', async () => {
  let resolve!: (value: unknown) => void;
  get.mockReturnValueOnce(new Promise(done => { resolve = done; })); render(<TasksPage />);
  await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
  act(() => changed());
  await act(async () => resolve(collection()));
  await screen.findByRole('alert'); expectNoCollectionClaims();
});

test('unavailable optional member names do not hide independently verified tasks', async () => {
  (api.homes.getHomeOccupants as jest.Mock).mockRejectedValue({ statusCode: 403 });
  get.mockResolvedValueOnce(collection([task])); render(<TasksPage />);
  await screen.findByText(task.title);
  expect(screen.getByRole('button', { name: 'Active (1)' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add Task' })).toBeEnabled();
});
