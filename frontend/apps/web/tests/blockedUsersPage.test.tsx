import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as api from '@pantopus/api';
import BlockedUsersPage from '@/app/(app)/app/profile/settings/blocked/page';
import { confirmStore } from '@/components/ui/confirm-store';

jest.mock('@pantopus/api', () => ({
  getAuthToken: jest.fn(() => 'session-a'),
  onTokenChange: jest.fn(() => jest.fn()),
  AUTH_SESSION_CHANGE_KEY: 'auth-change',
  blocks: { getBlockedUsers: jest.fn(), unblockUser: jest.fn() },
  relationships: { getBlockedUsers: jest.fn(), unblock: jest.fn() },
  privacy: { getBlocks: jest.fn(), removeBlock: jest.fn() },
}));
jest.mock('next/navigation', () => { const router = { push: jest.fn(), back: jest.fn() }; return { useRouter: () => router }; });
jest.mock('next/image', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/ui/toast-store', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock('@/components/ui/confirm-store', () => ({ confirmStore: { open: jest.fn() } }));
const mocked = api as jest.Mocked<typeof api>;
const personal = { blocked: [{ id: 'block-a', user_id: 'bob', name: 'Bob' }] };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
beforeEach(() => {
  jest.clearAllMocks();
  (mocked.getAuthToken as jest.Mock).mockReturnValue('session-a');
  (api.blocks.getBlockedUsers as jest.Mock).mockResolvedValue({ blocked: [] });
  (api.relationships.getBlockedUsers as jest.Mock).mockResolvedValue({ blocked: [] });
  (api.privacy.getBlocks as jest.Mock).mockResolvedValue({ blocks: [] });
  (confirmStore.open as jest.Mock).mockResolvedValue(true);
  (api.blocks.unblockUser as jest.Mock).mockResolvedValue({ success: true });
});

test.each(['personal', 'relationship'])('%s unavailable is not confirmed emptiness and can retry', async which => {
  const load = which === 'personal' ? api.blocks.getBlockedUsers : api.relationships.getBlockedUsers;
  (load as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  render(<BlockedUsersPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t load/i);
  expect(screen.queryByText('No Blocked Users')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /retry/i }));
  expect(await screen.findByText('No Blocked Users')).toBeInTheDocument();
});

test('partial rows stay usable and removing the last row does not confirm emptiness', async () => {
  (api.blocks.getBlockedUsers as jest.Mock).mockResolvedValue(personal);
  (api.relationships.getBlockedUsers as jest.Mock).mockRejectedValue(new Error('offline'));
  render(<BlockedUsersPage />);
  expect(await screen.findByText('Bob')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Unblock' }));
  await waitFor(() => expect(screen.queryByText('Bob')).not.toBeInTheDocument());
  expect(api.blocks.unblockUser).toHaveBeenCalledWith('bob');
  expect(screen.queryByText('No Blocked Users')).not.toBeInTheDocument();
});

test('relationship row uses the server-selected counterparty, not the viewer', async () => {
  (api.relationships.getBlockedUsers as jest.Mock).mockResolvedValue({ blocked: [{
    id: 'r1', blocked_user: { name: 'Alice' }, requester: { name: 'Alice' }, addressee: { name: 'Me' },
  }] });
  render(<BlockedUsersPage />);
  expect(await screen.findByText('Alice')).toBeInTheDocument();
  expect(screen.queryByText('Me')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Unblock' }));
  await waitFor(() => expect(api.relationships.unblock).toHaveBeenCalledWith('r1'));
});

test('session replacement retires a pending list even with the same cookie sentinel', async () => {
  const old = deferred<typeof personal>();
  (api.blocks.getBlockedUsers as jest.Mock).mockReturnValueOnce(old.promise);
  render(<BlockedUsersPage />);
  const change = (api.onTokenChange as jest.Mock).mock.calls[0]?.[0];
  expect(change).toBeDefined();
  await act(async () => { change('session-a'); });
  expect(await screen.findByText('No Blocked Users')).toBeInTheDocument();
  await act(async () => { old.resolve(personal); });
  expect(screen.queryByText('Bob')).not.toBeInTheDocument();
});

test('confirmation from a retired account cannot issue an unblock for the new account', async () => {
  (api.blocks.getBlockedUsers as jest.Mock).mockResolvedValueOnce(personal);
  const confirmation = deferred<boolean>();
  (confirmStore.open as jest.Mock).mockReturnValueOnce(confirmation.promise);
  render(<BlockedUsersPage />);
  await screen.findByText('Bob');
  fireEvent.click(screen.getByRole('button', { name: 'Unblock' }));
  const change = (api.onTokenChange as jest.Mock).mock.calls[0]?.[0];
  expect(change).toBeDefined();
  await act(async () => { change('session-a'); });
  await act(async () => { confirmation.resolve(true); });
  expect(api.blocks.unblockUser).not.toHaveBeenCalled();
});
