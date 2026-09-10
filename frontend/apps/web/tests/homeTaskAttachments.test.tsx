import { serialize, deserialize } from 'node:v8';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as api from '@pantopus/api';
import TaskSlidePanel from '../src/components/home/TaskSlidePanel';
import TaskAttachmentList from '../src/components/home/TaskAttachmentList';
jest.mock('@pantopus/api', () => ({ getApiBaseUrl: () => 'http://localhost:18081', getAuthToken: jest.fn(() => 'synthetic-session'), AUTH_SESSION_CHANGE_KEY: 'task-session-marker', onTokenChange: jest.fn(() => jest.fn()), taskSessionHeaders: (scope: unknown) => scope, users: { getMyProfile: jest.fn() }, get: jest.fn(), post: jest.fn(), put: jest.fn(), del: jest.fn(), assertHomeTaskSession: jest.fn(), taskSessionChanged: () => Object.assign(new Error('Session changed'), { code: 'SESSION_SCOPE_CHANGED' }), upload: { getHomeTaskMedia: jest.fn(), uploadHomeTaskMedia: jest.fn(), downloadHomeTaskMedia: jest.fn(), deleteHomeTaskMedia: jest.fn() } }));
jest.mock('../src/components/home/SlidePanel', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
// The rendered form uses the actual client/controller. This test double isolates
// storage failures; real encrypted IndexedDB is exercised in browser acceptance.
beforeAll(() => { globalThis.structuredClone = value => deserialize(serialize(value)); });
const mockDraftStore = { value: null as import('../src/components/home/tasks/PendingHomeTaskStore').TaskDraftSnapshot | null, revision: 0 };
jest.mock('../src/components/home/tasks/PendingHomeTaskStore', () => ({ PendingHomeTaskStore: class {
 async load() { return structuredClone(mockDraftStore.value); }
 async save(draft: unknown, expected: { revision: string } | null, current: () => boolean) {
  if (!current() || (mockDraftStore.value?.revision || null) !== (expected?.revision || null)) throw new Error('Saved request changed');
  mockDraftStore.value = { draft: structuredClone(draft), revision: `revision-${++mockDraftStore.revision}` } as typeof mockDraftStore.value;
  return structuredClone(mockDraftStore.value);
 }
 async clear(expected: { revision: string }, current: () => boolean) {
  if (!current() || mockDraftStore.value?.revision !== expected.revision) throw new Error('Saved request changed');
  mockDraftStore.value = null;
 }
} }));
const mocked = api.upload as jest.Mocked<typeof api.upload>;
const homeId = 'ddf10001-0000-4000-8000-000000000100'; const taskId = 'ddf10001-0000-4000-8000-000000000200';
const mediaId = 'ddf10001-0000-4000-8000-000000000300';
const actor = 'ddf10001-0000-4000-8000-000000000400';
const requestId = 'ddf10001-0000-4000-8000-000000000500';
const openingScope = { actor_id: actor, home_id: homeId, session_scope: 'a'.repeat(64) }; const saved = { id: taskId, home_id: homeId, created_by: actor, title: 'Exact task', task_type: 'chore' as const, status: 'open' as const, priority: 'medium' as const, capabilities: { can_edit: true, can_complete: true, can_delete: true } };
const receipt = (command: Record<string, unknown>) => ({ task: saved, task_session: openingScope, replayed: false, creation_receipt: { home_id: homeId, actor_id: actor, request_id: command.request_id, task_id: taskId, payload_hash: 'c'.repeat(64), created_at: '2026-09-10T12:00:00Z' } });
const ready = { id: mediaId, home_id: homeId, task_id: taskId, uploaded_by: 'actor', file_name: 'private.txt', file_type: 'document',
 mime_type: 'text/plain', file_size: 4, created_at: '', state: 'ready' as const, available: true };
beforeEach(() => { jest.resetAllMocks(); mockDraftStore.value = null; mockDraftStore.revision = 0; localStorage.clear();
 (api.getAuthToken as jest.Mock).mockReturnValue('synthetic-session'); (api.onTokenChange as jest.Mock).mockReturnValue(jest.fn());
 (api.users.getMyProfile as jest.Mock).mockResolvedValue({ id: actor });
 (api.get as jest.Mock).mockImplementation(async (path: string) => path.endsWith(taskId) ? { task: saved, task_session: openingScope } : { tasks: [], task_session: openingScope, collection_capabilities: { can_create: true } });
 (api.post as jest.Mock).mockImplementation(async (_path: string, body: Record<string, unknown>) => receipt(body)); (api.assertHomeTaskSession as jest.Mock).mockResolvedValue(undefined); mocked.getHomeTaskMedia.mockResolvedValue({ media: [], can_upload: true });
 mocked.uploadHomeTaskMedia.mockResolvedValue({ media: [ready] });
 Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: jest.fn().mockReturnValue(mediaId) }); });
async function select(files: File[]) {
 await screen.findByRole('button', { name: 'Create Task' });
 fireEvent.change(screen.getByPlaceholderText('e.g., Fix leaky faucet'), { target: { value: 'Exact task' } });
 fireEvent.click(screen.getByLabelText('Attachments (optional)'));
 fireEvent.change(screen.getByLabelText('Attachments (optional)'), { target: { files } });
 fireEvent.click(screen.getByRole('button', { name: 'Create Task' }));
}
test('partial failure retains task ID and per-file IDs, retries only remaining file', async () => {
 const one = new File(['one'], 'one.txt', { type: 'text/plain' }); const two = new File(['two'], 'two.txt', { type: 'text/plain' });
 const secondId = 'ddf10001-0000-4000-8000-000000000301';
 (crypto.randomUUID as jest.Mock).mockReturnValueOnce(requestId).mockReturnValueOnce(mediaId).mockReturnValueOnce(secondId);
 mocked.uploadHomeTaskMedia.mockResolvedValueOnce({ media: [ready] }).mockRejectedValueOnce(new Error('lost reply'));
 const onClose = jest.fn(); const onSave = jest.fn();
 render(<TaskSlidePanel openingScope={openingScope} open onClose={onClose} onSaved={onSave} members={[]} homeId={homeId} />);
 await select([one, two]); await screen.findByText(/The task is saved. Some attachments were not confirmed/);
 expect(onClose).not.toHaveBeenCalled();
 await waitFor(() => expect(screen.getAllByRole('button', { name: 'Remove selected file' })).toHaveLength(1));
 fireEvent.click(screen.getByRole('button', { name: 'Save Task' }));
 await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
 expect(api.post).toHaveBeenCalledTimes(1); expect(api.put).not.toHaveBeenCalled();
 expect(mocked.uploadHomeTaskMedia.mock.calls.map(call => [call[2][0].name, call[3]?.[0]])).toEqual([
  ['one.txt', mediaId], ['two.txt', secondId], ['two.txt', secondId],
 ]);
});
test('closing while task save waits prevents subsequent attachment writes', async () => {
 let resolve!: (value: ReturnType<typeof receipt>) => void;
 (api.post as jest.Mock).mockImplementation(() => new Promise(done => { resolve = done; }));
 const props = { onClose: jest.fn(), onSaved: jest.fn(), members: [], homeId, openingScope };
 const view = render(<TaskSlidePanel open {...props} />); await select([new File(['test'], 'one.txt', { type: 'text/plain' })]);
 await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
 view.rerender(<TaskSlidePanel open={false} {...props} />); resolve(receipt({ request_id: mediaId }));
 await waitFor(() => expect(mocked.uploadHomeTaskMedia).not.toHaveBeenCalled());
 expect(props.onSaved).not.toHaveBeenCalled(); expect(mockDraftStore.value).not.toBeNull();
});
test('read-only viewer can download without mutation controls', async () => {
 mocked.getHomeTaskMedia.mockResolvedValue({ media: [ready], can_upload: false });
 render(<TaskAttachmentList openingScope={openingScope} homeId={homeId} taskId={taskId} onAccess={jest.fn()} />);
 expect(await screen.findByRole('button', { name: 'Download' })).toBeInTheDocument();
 expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
});
test('failed removal retains row for retry, successful retry removes it', async () => {
 mocked.getHomeTaskMedia.mockResolvedValue({ media: [ready], can_upload: true });
 mocked.deleteHomeTaskMedia.mockRejectedValueOnce(new Error('Removal pending. Retry it.')).mockResolvedValueOnce({ media: { ...ready, state: 'retired', available: false, cleanup_pending: false } });
 render(<TaskAttachmentList openingScope={openingScope} homeId={homeId} taskId={taskId} onAccess={jest.fn()} />);
 fireEvent.click(await screen.findByRole('button', { name: 'Remove' })); await screen.findByText(/Removal pending/);
 expect(screen.getByText('private.txt')).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
 await waitFor(() => expect(screen.queryByText('private.txt')).not.toBeInTheDocument());
});
test('legacy public attachment has no download or URL link', async () => {
 mocked.getHomeTaskMedia.mockResolvedValue({ media: [{ ...ready, state: 'legacy', available: false }], can_upload: true });
 render(<TaskAttachmentList openingScope={openingScope} homeId={homeId} taskId={taskId} onAccess={jest.fn()} />);
 expect(await screen.findByText(/Re-upload required/)).toBeInTheDocument();
 expect(screen.queryByRole('link')).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument();
});

test('same-Home replacement session hides retained panel and suppresses late upload continuation', async () => {
 let resolve!: (value: ReturnType<typeof receipt>) => void;
 (api.post as jest.Mock).mockImplementation(() => new Promise(done => { resolve = done; }));
 const props = { onClose: jest.fn(), onSaved: jest.fn(), members: [], homeId };
 const view = render(<TaskSlidePanel open {...props} openingScope={openingScope} />);
 await select([new File(['test'], 'one.txt', { type: 'text/plain' })]); await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
 view.rerender(<TaskSlidePanel open {...props} openingScope={{ ...openingScope, session_scope: 'b'.repeat(64) }} />);
 resolve(receipt({ request_id: mediaId })); expect(await screen.findByText(/Your signed-in session changed or could not be verified/)).toBeInTheDocument();
 expect(mocked.uploadHomeTaskMedia).not.toHaveBeenCalled(); expect(props.onClose).not.toHaveBeenCalled(); expect(props.onSaved).not.toHaveBeenCalled();
});
test('opening read fingerprint cannot bind a replacement account', async () => {
 (api.users.getMyProfile as jest.Mock).mockResolvedValue({ id: mediaId });
 const onSaved = jest.fn();
 render(<TaskSlidePanel open onClose={jest.fn()} onSaved={onSaved} members={[]} homeId={homeId} openingScope={openingScope} />);
 expect(await screen.findByText(/Your signed-in session changed or could not be verified/)).toBeInTheDocument();
 expect(api.post).not.toHaveBeenCalled(); expect(onSaved).not.toHaveBeenCalled(); expect(mocked.uploadHomeTaskMedia).not.toHaveBeenCalled();
});
test('no opening context still requires a fresh current authorized collection before creation', async () => {
 let resolve!: (value: unknown) => void;
 (api.get as jest.Mock).mockReturnValue(new Promise(done => { resolve = done; }));
 render(<TaskSlidePanel open onClose={jest.fn()} onSaved={jest.fn()} members={[]} homeId={homeId} openingScope={null} />);
 expect(screen.queryByRole('button', { name: 'Create Task' })).not.toBeInTheDocument();
 await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
 resolve({ tasks: [], task_session: openingScope, collection_capabilities: { can_create: false } });
 expect(await screen.findByRole('button', { name: 'Create Task' })).toBeDisabled(); expect(api.post).not.toHaveBeenCalled();
});
test('session changed during byte download prevents browser download', async () => {
 mocked.getHomeTaskMedia.mockResolvedValue({ media: [ready], can_upload: true });
 let resolve!: (value: Blob) => void; mocked.downloadHomeTaskMedia.mockImplementation(() => new Promise<Blob>(done => { resolve = done; }));
 const createUrl = jest.fn(); Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createUrl });
 render(<TaskAttachmentList openingScope={openingScope} homeId={homeId} taskId={taskId} onAccess={jest.fn()} />);
 fireEvent.click(await screen.findByRole('button', { name: 'Download' }));
 await waitFor(() => expect(mocked.downloadHomeTaskMedia).toHaveBeenCalledTimes(1));
 (api.assertHomeTaskSession as jest.Mock).mockRejectedValueOnce(api.taskSessionChanged()); resolve(new Blob(['private bytes']));
 expect(await screen.findByText(/Your signed-in session changed. Reopen this task/)).toBeInTheDocument();
 expect(createUrl).not.toHaveBeenCalled();
});
test('same-turn duplicate form submits cannot start two task saves', async () => {
 const onSaved = jest.fn();
 const { container } = render(<TaskSlidePanel open onClose={jest.fn()} onSaved={onSaved} members={[]} homeId={homeId} openingScope={openingScope} />);
 await screen.findByRole('button', { name: 'Create Task' });
 fireEvent.change(screen.getByPlaceholderText('e.g., Fix leaky faucet'), { target: { value: 'Exact task' } });
 fireEvent.submit(container.querySelector('form')!); fireEvent.submit(container.querySelector('form')!);
 await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1)); expect(api.post).toHaveBeenCalledTimes(1);
});
test('same-turn duplicate attachment removals start only one mutation', async () => {
 mocked.getHomeTaskMedia.mockResolvedValue({ media: [ready], can_upload: true });
 let resolve!: () => void; const gate = new Promise<void>(done => { resolve = done; });
 render(<TaskAttachmentList openingScope={openingScope} homeId={homeId} taskId={taskId} onAccess={jest.fn()} />);
 const button = await screen.findByRole('button', { name: 'Remove' });
 (api.assertHomeTaskSession as jest.Mock).mockReturnValueOnce(gate);
 mocked.deleteHomeTaskMedia.mockResolvedValue({ media: { ...ready, state: 'retired', available: false } });
 fireEvent.click(button); fireEvent.click(button); resolve();
 await waitFor(() => expect(mocked.deleteHomeTaskMedia).toHaveBeenCalledTimes(1));
});

test('closing and reopening an interrupted create replays the encrypted original command', async () => {
 (api.post as jest.Mock).mockRejectedValueOnce(new Error('Lost create reply'));
 const props = { onClose: jest.fn(), onSaved: jest.fn(), homeId, openingScope, members: [] };
 const view = render(<TaskSlidePanel open {...props} />);
 await select([]); await screen.findByRole('button', { name: 'Retry original request' });
 const original = (api.post as jest.Mock).mock.calls[0][1];
 expect(mockDraftStore.value?.draft.request_id).toBe(original.request_id);
 view.unmount(); render(<TaskSlidePanel open {...props} />);
 const retry = await screen.findByRole('button', { name: 'Retry original request' });
 expect(screen.getByPlaceholderText('e.g., Fix leaky faucet')).toHaveValue('Exact task');
 expect(screen.getByPlaceholderText('e.g., Fix leaky faucet')).toBeDisabled();
 fireEvent.click(retry); await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
 expect((api.post as jest.Mock).mock.calls[1][1]).toEqual(original); expect(mockDraftStore.value).toBeNull();
});

test('unverified creation receipt retains the original request without success or acknowledgment', async () => {
 (api.post as jest.Mock).mockImplementation(async (_: string, body: Record<string, unknown>) => ({ ...receipt(body), creation_receipt: { ...receipt(body).creation_receipt, request_id: requestId } }));
 const onSaved = jest.fn();
 render(<TaskSlidePanel open onClose={jest.fn()} onSaved={onSaved} homeId={homeId} openingScope={openingScope} members={[]} />);
 await select([]); await screen.findByRole('button', { name: 'Retry original request' });
 expect(onSaved).not.toHaveBeenCalled(); expect(mockDraftStore.value).not.toBeNull();
 expect(screen.queryByRole('button', { name: 'Acknowledge unavailable request' })).not.toBeInTheDocument();
});

test('explicit retired create can be acknowledged without any replacement POST', async () => {
 (api.post as jest.Mock).mockRejectedValue(Object.assign(new Error('Retired task'), { statusCode: 409, code: 'HOME_TASK_CREATE_RETIRED' }));
 const onClose = jest.fn();
 render(<TaskSlidePanel open onClose={onClose} onSaved={jest.fn()} homeId={homeId} openingScope={openingScope} members={[]} />);
 await select([]); fireEvent.click(await screen.findByRole('button', { name: 'Acknowledge unavailable request' }));
 await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
 expect(mockDraftStore.value).toBeNull(); expect(api.post).toHaveBeenCalledTimes(1); expect(api.del).not.toHaveBeenCalled();
});

test('sparse title edit preserves untouched exact timestamp, recurrence and zero budget', async () => {
 const original = { ...saved, due_at: '2026-10-02T14:32:15.125Z', recurrence_rule: 'FREQ=WEEKLY;BYDAY=FR', budget: 0 };
 let current = original;
 (api.get as jest.Mock).mockImplementation(async () => ({ task: current, task_session: openingScope }));
 (api.put as jest.Mock).mockImplementation(async (_: string, body: Partial<typeof original>) => ({ task: current = { ...current, ...body } }));
 const onSaved = jest.fn();
 render(<TaskSlidePanel open task={saved} onClose={jest.fn()} onSaved={onSaved} homeId={homeId} openingScope={openingScope} members={[]} />);
 await screen.findByRole('button', { name: 'Save Task' });
 expect(screen.getByRole('spinbutton')).toHaveValue(0);
 fireEvent.change(screen.getByPlaceholderText('e.g., Fix leaky faucet'), { target: { value: 'Changed title' } });
 fireEvent.click(screen.getByRole('button', { name: 'Save Task' }));
 await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
 expect((api.put as jest.Mock).mock.calls[0][1]).toEqual({ title: 'Changed title' });
 expect(onSaved.mock.calls[0][0]).toMatchObject({ due_at: original.due_at, recurrence_rule: original.recurrence_rule, budget: 0 });
});

test('explicit date and budget clears are sparse nulls; a mismatched PUT cannot claim success', async () => {
 const original = { ...saved, due_at: '2026-10-02T14:32:15.125Z', budget: 7.5 };
 (api.get as jest.Mock).mockResolvedValue({ task: original, task_session: openingScope });
 (api.put as jest.Mock).mockResolvedValue({ task: original });
 const onSaved = jest.fn();
 const view = render(<TaskSlidePanel open task={saved} onClose={jest.fn()} onSaved={onSaved} homeId={homeId} openingScope={openingScope} members={[]} />);
 await screen.findByRole('button', { name: 'Save Task' });
 fireEvent.change(view.container.querySelector('input[type="date"]')!, { target: { value: '' } });
 fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '' } });
 fireEvent.click(screen.getByRole('button', { name: 'Save Task' }));
 await screen.findByText(/task update was not confirmed/);
 expect((api.put as jest.Mock).mock.calls[0][1]).toEqual({ due_at: null, budget: null }); expect(onSaved).not.toHaveBeenCalled();
});

test('fresh permission loss blocks editing even when the opening task allowed it', async () => {
 let current = saved;
 (api.get as jest.Mock).mockImplementation(async () => ({ task: current, task_session: openingScope }));
 render(<TaskSlidePanel open task={saved} onClose={jest.fn()} onSaved={jest.fn()} homeId={homeId} openingScope={openingScope} members={[]} />);
 await screen.findByRole('button', { name: 'Save Task' });
 fireEvent.change(screen.getByPlaceholderText('e.g., Fix leaky faucet'), { target: { value: 'Changed title' } });
 current = { ...saved, capabilities: { can_edit: false, can_complete: false, can_delete: false } };
 fireEvent.click(screen.getByRole('button', { name: 'Save Task' }));
 await screen.findByText(/no longer have permission to edit/); expect(api.put).not.toHaveBeenCalled();
});

test('competing saved request survives a stale retry and never gets a new POST', async () => {
 (api.post as jest.Mock).mockRejectedValueOnce(new Error('Lost reply'));
 render(<TaskSlidePanel open onClose={jest.fn()} onSaved={jest.fn()} homeId={homeId} openingScope={openingScope} members={[]} />);
 await select([]); await screen.findByRole('button', { name: 'Retry original request' });
 mockDraftStore.value = { revision: 'other-tab', draft: { ...mockDraftStore.value!.draft, request_id: requestId } };
 fireEvent.click(screen.getByRole('button', { name: 'Retry original request' }));
 await screen.findByText(/saved request changed in another tab/);
 expect(api.post).toHaveBeenCalledTimes(1); expect(mockDraftStore.value.draft.request_id).toBe(requestId);
});

test('queued picker selection is discarded after the actual cookie marker changes', async () => {
 render(<TaskSlidePanel open onClose={jest.fn()} onSaved={jest.fn()} homeId={homeId} openingScope={openingScope} members={[]} />);
 await screen.findByRole('button', { name: 'Create Task' });
 const picker = screen.getByLabelText('Attachments (optional)'); fireEvent.click(picker);
 localStorage.setItem(api.AUTH_SESSION_CHANGE_KEY, 'replacement-before-storage-event');
 fireEvent.change(picker, { target: { files: [new File(['private'], 'old-selection.txt', { type: 'text/plain' })] } });
 expect(screen.queryByText('old-selection.txt')).not.toBeInTheDocument(); expect(mocked.uploadHomeTaskMedia).not.toHaveBeenCalled();
});

test('retired upload acknowledgment clears only its original file without a replacement upload', async () => {
 mocked.uploadHomeTaskMedia.mockRejectedValueOnce(Object.assign(new Error('Removed upload'), { statusCode: 409, code: 'HOME_TASK_UPLOAD_RETIRED' }));
 render(<TaskSlidePanel open onClose={jest.fn()} onSaved={jest.fn()} homeId={homeId} openingScope={openingScope} members={[]} />);
 await select([new File(['private'], 'retired.txt', { type: 'text/plain' })]);
 fireEvent.click(await screen.findByRole('button', { name: 'Acknowledge removed upload' }));
 await waitFor(() => expect(screen.queryByRole('button', { name: 'Acknowledge removed upload' })).not.toBeInTheDocument());
 expect(mocked.uploadHomeTaskMedia).toHaveBeenCalledTimes(1); expect(mocked.deleteHomeTaskMedia).not.toHaveBeenCalled();
 expect(api.post).toHaveBeenCalledTimes(1); expect(api.put).not.toHaveBeenCalled();
});
