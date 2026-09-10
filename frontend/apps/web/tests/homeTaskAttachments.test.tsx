import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as api from '@pantopus/api';
import TaskSlidePanel from '../src/components/home/TaskSlidePanel';
import TaskAttachmentList from '../src/components/home/TaskAttachmentList';
jest.mock('@pantopus/api', () => ({ assertHomeTaskSession: jest.fn(), taskSessionChanged: () => Object.assign(new Error('Session changed'), { code: 'SESSION_SCOPE_CHANGED' }), upload: { getHomeTaskMedia: jest.fn(), uploadHomeTaskMedia: jest.fn(), downloadHomeTaskMedia: jest.fn(), deleteHomeTaskMedia: jest.fn() } }));
jest.mock('../src/components/home/SlidePanel', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
const mocked = api.upload as jest.Mocked<typeof api.upload>;
const homeId = 'ddf10001-0000-4000-8000-000000000100'; const taskId = 'ddf10001-0000-4000-8000-000000000200';
const mediaId = 'ddf10001-0000-4000-8000-000000000300';
const openingScope = { actor_id: 'actor', home_id: homeId, session_scope: 'a'.repeat(64) }; const saved = { id: taskId, home_id: homeId, title: 'Exact task' };
const ready = { id: mediaId, home_id: homeId, task_id: taskId, uploaded_by: 'actor', file_name: 'private.txt', file_type: 'document',
 mime_type: 'text/plain', file_size: 4, created_at: '', state: 'ready' as const, available: true };
beforeEach(() => { jest.clearAllMocks(); (api.assertHomeTaskSession as jest.Mock).mockResolvedValue(undefined); mocked.getHomeTaskMedia.mockResolvedValue({ media: [], can_upload: true });
 mocked.uploadHomeTaskMedia.mockResolvedValue({ media: [ready] });
 Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: jest.fn().mockReturnValue(mediaId) }); });
function select(files: File[]) {
 fireEvent.change(screen.getByPlaceholderText('e.g., Fix leaky faucet'), { target: { value: 'Exact task' } });
 fireEvent.change(screen.getByLabelText('Attachments (optional)'), { target: { files } });
 fireEvent.click(screen.getByRole('button', { name: 'Create Task' }));
}
test('partial failure retains task ID and per-file IDs, retries only remaining file', async () => {
 const one = new File(['one'], 'one.txt', { type: 'text/plain' }); const two = new File(['two'], 'two.txt', { type: 'text/plain' });
 const secondId = 'ddf10001-0000-4000-8000-000000000301';
 (crypto.randomUUID as jest.Mock).mockReturnValueOnce(mediaId).mockReturnValueOnce(secondId);
 mocked.uploadHomeTaskMedia.mockResolvedValueOnce({ media: [ready] }).mockRejectedValueOnce(new Error('lost reply'));
 const onClose = jest.fn(); const onSave = jest.fn(async (_: Record<string, unknown>) => saved);
 render(<TaskSlidePanel openingScope={openingScope} open onClose={onClose} onSave={onSave} members={[]} homeId={homeId} />);
 select([one, two]); await screen.findByText(/The task is saved. Some attachments were not confirmed/);
 expect(onClose).not.toHaveBeenCalled();
 await waitFor(() => expect(screen.getAllByRole('button', { name: 'Remove selected file' })).toHaveLength(1));
 fireEvent.click(screen.getByRole('button', { name: 'Update Task' }));
 await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
 expect(onSave.mock.calls[1][0]._savedTaskId).toBe(taskId);
 expect(mocked.uploadHomeTaskMedia.mock.calls.map(call => [call[2][0].name, call[3]?.[0]])).toEqual([
  ['one.txt', mediaId], ['two.txt', secondId], ['two.txt', secondId],
 ]);
});
test('closing while task save waits prevents subsequent attachment writes', async () => {
 let resolve!: (value: typeof saved) => void; const pending = new Promise<typeof saved>(done => { resolve = done; });
 const props = { onClose: jest.fn(), onSave: () => pending, members: [], homeId, openingScope };
 const view = render(<TaskSlidePanel open {...props} />); select([new File(['test'], 'one.txt', { type: 'text/plain' })]);
 view.rerender(<TaskSlidePanel open={false} {...props} />); resolve(saved);
 await waitFor(() => expect(mocked.uploadHomeTaskMedia).not.toHaveBeenCalled());
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
 let resolve!: (value: typeof saved) => void; const pending = new Promise<typeof saved>(done => { resolve = done; });
 const onClose = jest.fn(); const onSave = jest.fn(() => pending);
 const view = render(<TaskSlidePanel open onClose={onClose} onSave={onSave} members={[]} homeId={homeId} openingScope={openingScope} />);
 select([new File(['test'], 'one.txt', { type: 'text/plain' })]); await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
 view.rerender(<TaskSlidePanel open onClose={onClose} onSave={onSave} members={[]} homeId={homeId} openingScope={{ ...openingScope, session_scope: 'b'.repeat(64) }} />);
 resolve(saved); expect(await screen.findByText(/Your signed-in session changed or could not be verified/)).toBeInTheDocument();
 expect(mocked.uploadHomeTaskMedia).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
});
test('opening read fingerprint is required; a late first check cannot bind a replacement account', async () => {
 (api.assertHomeTaskSession as jest.Mock).mockRejectedValueOnce(api.taskSessionChanged());
 const onSave = jest.fn(async () => saved);
 render(<TaskSlidePanel open onClose={jest.fn()} onSave={onSave} members={[]} homeId={homeId} openingScope={openingScope} />);
 select([new File(['test'], 'one.txt', { type: 'text/plain' })]);
 expect(await screen.findByText(/Your signed-in session changed or could not be verified/)).toBeInTheDocument();
 expect(onSave).not.toHaveBeenCalled(); expect(mocked.uploadHomeTaskMedia).not.toHaveBeenCalled();
});
test('no opening context cannot initiate task creation', () => {
 const onSave = jest.fn(async () => saved);
 render(<TaskSlidePanel open onClose={jest.fn()} onSave={onSave} members={[]} homeId={homeId} openingScope={null} />);
 expect(screen.getByRole('alert')).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Create Task' })).not.toBeInTheDocument();
 expect(onSave).not.toHaveBeenCalled();
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
 let resolve!: () => void; const gate = new Promise<void>(done => { resolve = done; });
 (api.assertHomeTaskSession as jest.Mock).mockReturnValueOnce(gate);
 const onSave = jest.fn(async () => saved);
 const { container } = render(<TaskSlidePanel open onClose={jest.fn()} onSave={onSave} members={[]} homeId={homeId} openingScope={openingScope} />);
 fireEvent.change(screen.getByPlaceholderText('e.g., Fix leaky faucet'), { target: { value: 'Exact task' } });
 fireEvent.submit(container.querySelector('form')!); fireEvent.submit(container.querySelector('form')!); resolve();
 await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
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
