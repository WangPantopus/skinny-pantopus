import { serialize, deserialize } from 'node:v8';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as api from '@pantopus/api';
import { HomeTaskClient } from '../src/components/home/tasks/HomeTaskClient';
import { HomeTaskRecurrenceController } from '../src/components/home/tasks/HomeTaskRecurrenceController';
import { HomeTaskRecurrenceCard } from '../src/components/home/tasks/HomeTaskRecurrenceCard';
import { validPendingRecurrence, type RecurrenceCommand, type RecurrenceState } from '../src/components/home/tasks/homeTaskRecurrenceModel';
import { recurrenceStatusText, validTask, type HomeTask } from '../src/components/home/tasks/homeTaskModel';
import type { RecurrenceSnapshot } from '../src/components/home/tasks/PendingRecurrenceStore';

jest.mock('@pantopus/api', () => ({ getApiBaseUrl: () => 'http://localhost:18081', getAuthToken: jest.fn(() => 'synthetic-session'), AUTH_SESSION_CHANGE_KEY: 'session-marker',
  taskSessionHeaders: (scope: unknown) => scope, taskSessionChanged: () => Object.assign(new Error('Session changed'), { code: 'SESSION_SCOPE_CHANGED' }),
  users: { getMyProfile: jest.fn() }, get: jest.fn(), post: jest.fn() }));
// Real IndexedDB encryption/CAS is covered by Chrome acceptance. This store
// isolates interrupted replies, competing tabs and component lifetime here.
const mockStore = { value: null as RecurrenceSnapshot | null, revision: 0, failure: false };
jest.mock('../src/components/home/tasks/PendingRecurrenceStore', () => ({ PendingRecurrenceStore: class {
  async load() { if (mockStore.failure) throw new Error('Unreadable original'); return structuredClone(mockStore.value); }
  async save(draft: RecurrenceSnapshot['draft'], expected: RecurrenceSnapshot | null, current: () => boolean) {
    if (!current() || (mockStore.value?.revision || null) !== (expected?.revision || null)) throw new Error('Another tab changed the saved schedule change.');
    mockStore.value = { draft: structuredClone(draft), revision: `store-${++mockStore.revision}` };
    return structuredClone(mockStore.value);
  }
  async clear(expected: RecurrenceSnapshot, current: () => boolean) {
    if (!current() || mockStore.value?.revision !== expected.revision) throw new Error('Another tab changed the saved schedule change.');
    mockStore.value = null;
  }
} }));
const home = 'ddf21000-0000-4000-8000-000000000100', taskId = 'ddf21000-0000-4000-8000-000000000200';
const actor = 'ddf21000-0000-4000-8000-000000000001', requestId = 'ddf21000-0000-4000-8000-000000000300';
const scope = { home_id: home, actor_id: actor, session_scope: 'a'.repeat(64) };
const updated = '2026-09-10T12:00:00Z';
const task: HomeTask = { id: taskId, home_id: home, created_by: actor, updated_at: updated, title: 'Exact original', task_type: 'chore', priority: 'medium', status: 'open', due_at: updated,
  capabilities: { can_edit: true, can_complete: true, can_delete: true } };
const start: RecurrenceCommand = { action: 'start', expected_revision: 0, expected_task_updated_at: updated, frequency: 'WEEKLY', interval: 2, timezone: 'America/Los_Angeles' };
let state: RecurrenceState;
const open = () => HomeTaskRecurrenceController.open(new HomeTaskClient(home, scope), taskId);
function response(body: Record<string, unknown>, replayed = false) {
  return { ...state, replayed, receipt: { request_id: body.request_id, actor_id: actor, home_id: home, task_id: taskId,
    action: body.action, revision: Number(body.expected_revision) + (body.action === 'start' || Number(body.expected_revision) > 0 ? 1 : 0),
    request_hash: 'c'.repeat(64), created_at: updated } };
}
function active() {
  state = { ...state, revision: 1, configuration: { id: requestId, revision: 1, state: 'active', reason: null,
    frequency: 'WEEKLY', interval: 2, timezone: 'America/Los_Angeles', anchor_at: updated, next_due_at: '2026-09-24T12:00:00Z',
    last_due_at: null, last_task_id: null, generated_count: 0 } };
}
beforeAll(() => { globalThis.structuredClone = value => deserialize(serialize(value)); });
beforeEach(() => {
  jest.resetAllMocks(); localStorage.clear(); mockStore.value = null; mockStore.revision = 0; mockStore.failure = false;
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: jest.fn().mockReturnValue(requestId) });
  (api.getAuthToken as jest.Mock).mockReturnValue('synthetic-session');
  (api.users.getMyProfile as jest.Mock).mockResolvedValue({ id: actor });
  state = { ok: true, home_id: home, task_id: taskId, revision: 0, configuration: null, task_updated_at: updated, can_manage: true, task_session: scope };
  (api.get as jest.Mock).mockImplementation(async (path: string) => path.endsWith('/recurrence') ? structuredClone(state) : { task, task_session: scope });
  (api.post as jest.Mock).mockImplementation(async (_: string, body: Record<string, unknown>) => { active(); return response(body); });
});

test('lost committed reply and cold reopen retain the original command; an old start cannot hide a later pause', async () => {
  const first = await open();
  (api.post as jest.Mock).mockImplementationOnce(async () => { active(); throw new Error('Lost committed reply'); });
  await expect(first.submit(start)).rejects.toThrow('Lost committed reply');
  const original = structuredClone(mockStore.value!.draft);
  first.client.retire();
  state = { ...state, revision: 2, configuration: { ...state.configuration!, revision: 2, state: 'paused', next_due_at: null } };
  (api.post as jest.Mock).mockImplementation(async (_: string, body: Record<string, unknown>) => response(body, true));
  const reopened = await open();
  expect(reopened.pending).toEqual(original);
  await reopened.retry();
  expect((api.post as jest.Mock).mock.calls.map(call => call[1])).toEqual([ { request_id: requestId, ...start }, { request_id: requestId, ...start } ]);
  expect(reopened.state.configuration?.state).toBe('paused');
  expect(reopened.pending?.confirmed?.revision).toBe(1);
  reopened.client.retire();
  const confirmed = await open();
  expect(confirmed.pending?.confirmed?.revision).toBe(1);
  await expect(confirmed.retry()).rejects.toThrow('no unconfirmed');
  await confirmed.acknowledge();
  expect(mockStore.value).toBeNull(); expect(api.post).toHaveBeenCalledTimes(2);
});

test('another tab clearing an acknowledged command during retry preflight prevents dispatch', async () => {
  (api.post as jest.Mock).mockRejectedValueOnce(new Error('Lost reply'));
  const first = await open(); await expect(first.submit(start)).rejects.toThrow();
  const second = await open();
  let finish!: (value: RecurrenceState) => void;
  (api.get as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const retry = second.retry();
  await waitFor(() => expect(finish).toBeDefined());
  mockStore.value = null; finish(state);
  await expect(retry).rejects.toThrow('Another tab'); expect(api.post).toHaveBeenCalledTimes(1);
});

test('a competing newly reserved request is neither overwritten nor submitted', async () => {
  const first = await open(), second = await open();
  await first.submit(start);
  const saved = structuredClone(mockStore.value);
  await expect(second.submit(start)).rejects.toThrow('Another tab');
  expect(mockStore.value).toEqual(saved); expect(api.post).toHaveBeenCalledTimes(1);
});

test.each(['close', 'account', 'background'])('%s during permission preflight keeps saved identity and prevents POST', async cause => {
  const controller = await open();
  let finish!: (value: RecurrenceState) => void;
  (api.get as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const operation = controller.submit(start);
  await waitFor(() => expect(finish).toBeDefined());
  if (cause === 'close') controller.client.retire();
  if (cause === 'account') (api.getAuthToken as jest.Mock).mockReturnValue('replacement');
  if (cause === 'background') Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  finish(state); await expect(operation).rejects.toThrow();
  expect(mockStore.value?.draft.command).toEqual(start); expect(api.post).not.toHaveBeenCalled();
});

test('a mismatched receipt remains unresolved and cannot be acknowledged', async () => {
  (api.post as jest.Mock).mockImplementation(async (_: string, body: Record<string, unknown>) => { active(); const r = response(body); return { ...r, receipt: { ...r.receipt, actor_id: taskId } }; });
  const controller = await open(); await expect(controller.submit(start)).rejects.toThrow('not confirmed');
  expect(controller.pending?.confirmed).toBeUndefined();
  await expect(controller.acknowledge()).rejects.toThrow('Retry the original');
});

test.each([[409, 'HOME_TASK_RECURRENCE_STALE', true], [400, 'HOME_RECORD_INVALID', true], [409, 'HOME_TASK_RECURRENCE_CONFLICT', false], [503, 'UNAVAILABLE', false]])(
  'only a definitive rejected command may be dismissed (%s %s)', async (statusCode, code, allowed) => {
    (api.post as jest.Mock).mockRejectedValue(Object.assign(new Error('Rejected'), { statusCode, code }));
    const controller = await open(); await expect(controller.submit(start)).rejects.toThrow('Rejected');
    expect(controller.canDiscard).toBe(allowed);
    if (allowed) { await controller.acknowledge(); expect(mockStore.value).toBeNull(); }
    else { await expect(controller.acknowledge()).rejects.toThrow(); expect(mockStore.value).not.toBeNull(); }
    expect(api.post).toHaveBeenCalledTimes(1);
  });

test('unreadable recovery prevents controls or a replacement request', async () => {
  mockStore.failure = true;
  render(<HomeTaskRecurrenceCard task={task} scope={scope} busy={false} hasUnsavedChanges={false} onTaskReload={jest.fn()} onTaskUpdated={jest.fn()} />);
  await screen.findByText('Unreadable original');
  expect(screen.queryByRole('button', { name: 'Start repeating' })).not.toBeInTheDocument(); expect(api.post).not.toHaveBeenCalled();
});

test('unsaved source edits block activation; confirmation survives close until explicit acknowledgment', async () => {
  const props = { task, scope, busy: false, onTaskReload: jest.fn(), onTaskUpdated: jest.fn() };
  const view = render(<HomeTaskRecurrenceCard {...props} hasUnsavedChanges />);
  expect(await screen.findByRole('button', { name: 'Start repeating' })).toBeDisabled();
  view.rerender(<HomeTaskRecurrenceCard {...props} hasUnsavedChanges={false} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start repeating' }));
  await screen.findByRole('button', { name: 'Done reviewing saved change' });
  await waitFor(() => expect(props.onTaskUpdated).toHaveBeenCalledWith(task));
  expect(mockStore.value?.draft.confirmed?.request_id).toBe(requestId);
  view.unmount(); render(<HomeTaskRecurrenceCard {...props} hasUnsavedChanges={false} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Done reviewing saved change' }));
  await screen.findByRole('button', { name: 'Pause repeats' });
  expect(mockStore.value).toBeNull(); expect(api.post).toHaveBeenCalledTimes(1);
});

test('source changing between panel read and schedule read reloads before any activation', async () => {
  state.task_updated_at = '2026-09-10T12:01:00Z';
  const reload = jest.fn();
  render(<HomeTaskRecurrenceCard task={task} scope={scope} busy={false} hasUnsavedChanges={false} onTaskReload={reload} onTaskUpdated={jest.fn()} />);
  await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole('button', { name: 'Start repeating' })).not.toBeInTheDocument(); expect(api.post).not.toHaveBeenCalled();
});

test('current read denial retires schedule controls and reloads the parent task', async () => {
  const reload = jest.fn();
  render(<HomeTaskRecurrenceCard task={task} scope={scope} busy={false} hasUnsavedChanges={false} onTaskReload={reload} onTaskUpdated={jest.fn()} />);
  const button = await screen.findByRole('button', { name: 'Start repeating' });
  (api.get as jest.Mock).mockRejectedValueOnce(Object.assign(new Error('Access ended'), { statusCode: 403, code: 'HOME_RECORD_FORBIDDEN' }));
  fireEvent.click(button); await screen.findByText('Access ended');
  expect(reload).toHaveBeenCalledTimes(1); expect(screen.queryByRole('button', { name: 'Start repeating' })).not.toBeInTheDocument(); expect(api.post).not.toHaveBeenCalled();
});

test('losing manage capability during preflight reloads the task and never posts', async () => {
  const reload = jest.fn();
  render(<HomeTaskRecurrenceCard task={task} scope={scope} busy={false} hasUnsavedChanges={false} onTaskReload={reload} onTaskUpdated={jest.fn()} />);
  const button = await screen.findByRole('button', { name: 'Start repeating' });
  state.can_manage = false;
  fireEvent.click(button);
  await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole('button', { name: 'Start repeating' })).not.toBeInTheDocument(); expect(api.post).not.toHaveBeenCalled();
});

test('a source changed during command confirmation reloads visible fields before another activation', async () => {
  const reload = jest.fn();
  (api.get as jest.Mock).mockImplementation(async (path: string) => path.endsWith('/recurrence') ? structuredClone(state)
    : { task: { ...task, title: 'Changed elsewhere', updated_at: '2026-09-10T12:01:00Z' }, task_session: scope });
  render(<HomeTaskRecurrenceCard task={task} scope={scope} busy={false} hasUnsavedChanges={false} onTaskReload={reload} onTaskUpdated={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Start repeating' }));
  await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  expect(mockStore.value?.draft.confirmed?.request_id).toBe(requestId); expect(api.post).toHaveBeenCalledTimes(1);
});

test('recovery rejects credentials and foreign identities; a malformed active projection cannot render as a task', () => {
  const pending = { version: 1, origin: 'http://localhost:18081', actor_id: actor, home_id: home, task_id: taskId, request_id: requestId, command: start };
  expect(validPendingRecurrence(pending, pending.origin, actor, home, taskId)).toBe(true);
  expect(validPendingRecurrence({ ...pending, token: 'secret' }, pending.origin, actor, home, taskId)).toBe(false);
  expect(validPendingRecurrence({ ...pending, command: { ...start, session_scope: 'a'.repeat(64) } }, pending.origin, actor, home, taskId)).toBe(false);
  expect(validPendingRecurrence(pending, pending.origin, taskId, home, taskId)).toBe(false);
  active();
  const automatic = { state: 'active' as const, frequency: 'WEEKLY' as const, interval: 2, timezone: 'UTC', next_due_at: '2026-09-24T12:00:00Z' };
  expect(validTask({ ...task, automatic_recurrence: automatic }, home)).toBe(true);
  expect(validTask({ ...task, automatic_recurrence: { ...automatic, next_due_at: null } }, home)).toBe(false);
  expect(recurrenceStatusText(automatic)).toBe('Automatic repeats are on: every 2 weeks.');
  expect(recurrenceStatusText(null, 'FREQ=DAILY')).toBe('A repeat preference is saved. Automatic repeats are off.');
});
