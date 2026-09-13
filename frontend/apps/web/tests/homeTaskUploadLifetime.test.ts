import apiClient from '../../../packages/api/src/client';
import { assertHomeTaskSession } from '../../../packages/api/src/taskSessionScope';
import { uploadHomeTaskMedia } from '../../../packages/api/src/endpoints/upload';

jest.mock('../../../packages/api/src/client', () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock('../../../packages/api/src/taskSessionScope', () => ({
  assertHomeTaskSession: jest.fn(), taskSessionHeaders: () => ({}), rethrowTaskSessionError: (error: unknown) => { throw error; },
}));
const id = '53000000-0000-4000-8000-000000000003';
const scope = { home_id: 'home', actor_id: 'actor', session_scope: 'a'.repeat(64) };
beforeEach(() => jest.resetAllMocks());

test('closing during helper session preflight prevents the upload POST', async () => {
  let resolve!: () => void;
  (assertHomeTaskSession as jest.Mock).mockReturnValue(new Promise<void>(done => { resolve = done; }));
  let current = true;
  const uploading = uploadHomeTaskMedia('home', 'task', [new File(['private'], 'private.txt')], [id], scope,
    () => { if (!current) throw new Error('Panel closed'); });
  current = false; resolve();
  await expect(uploading).rejects.toThrow('Panel closed');
  expect(apiClient.post).not.toHaveBeenCalled();
});

test('background after an already dispatched upload cannot start the next file', async () => {
  let current = true;
  (assertHomeTaskSession as jest.Mock).mockResolvedValue(undefined);
  (apiClient.post as jest.Mock).mockImplementation(async () => { current = false; return { data: { media: [] } }; });
  await expect(uploadHomeTaskMedia('home', 'task', [new File(['one'], 'one.txt'), new File(['two'], 'two.txt')], [id, id], scope,
    () => { if (!current) throw new Error('Panel hidden'); })).rejects.toThrow('Panel hidden');
  expect(apiClient.post).toHaveBeenCalledTimes(1);
});
