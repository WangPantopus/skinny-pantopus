import { act, renderHook, waitFor } from '@testing-library/react';
import * as api from '@pantopus/api';
import { useClaimUploadSession } from '../src/components/home/useClaimUploadSession';
const listeners = new Set<() => void>();
jest.mock('@pantopus/api', () => ({ onTokenChange: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); },
  AUTH_SESSION_CHANGE_KEY: 'test-session', homeOwnership: { getMyOwnershipClaims: jest.fn() } }));
const read = jest.mocked(api.homeOwnership.getMyOwnershipClaims);
const scope = { actor_id: 'actor-a', session_scope: 'a'.repeat(64) };
const result = { claims: [], upload_session: scope };
beforeEach(() => { jest.clearAllMocks(); listeners.clear(); read.mockResolvedValue(result); });
test('file controls wait for an authenticated opening read, then writes recheck the exact server fingerprint', async () => {
  let resolve!: (value: typeof result) => void;
  read.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const view = renderHook(() => useClaimUploadSession('home-a'));
  expect(view.result.current.scope).toBeNull();
  await act(async () => { resolve(result); });
  expect(view.result.current.scope).toMatchObject({ ...scope, homeId: 'home-a' });
  await act(async () => { await view.result.current.assertCurrent(); });
  expect(read).toHaveBeenLastCalledWith(scope.session_scope);
});
test('a replacement server session before browser notification cannot pass an action check', async () => {
  const view = renderHook(() => useClaimUploadSession('home-a'));
  await waitFor(() => expect(view.result.current.scope).not.toBeNull());
  read.mockResolvedValue({ claims: [], upload_session: { ...scope, session_scope: 'b'.repeat(64) } });
  await expect(view.result.current.assertCurrent()).rejects.toThrow('session changed');
});
test('changed Home removes the old file scope and discards its delayed opening read', async () => {
  let resolve!: (value: typeof result) => void;
  read.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const view = renderHook(({ home }) => useClaimUploadSession(home), { initialProps: { home: 'home-a' } });
  view.rerender({ home: 'home-b' });
  await act(async () => { resolve(result); });
  expect(view.result.current.scope?.homeId).toBe('home-b');
});
test.each(['same-tab', 'cross-tab'])('%s session change retires the original read and hides file controls', async mode => {
  const view = renderHook(() => useClaimUploadSession('home-a'));
  await waitFor(() => expect(view.result.current.scope).not.toBeNull());
  const retained = view.result.current.assertCurrent;
  act(() => mode === 'same-tab' ? [...listeners].forEach(fn => fn()) : window.dispatchEvent(new StorageEvent('storage', { key: 'test-session' })));
  expect(view.result.current.scope).toBeNull();
  await expect(retained()).rejects.toThrow('session changed');
});
test('a failed initial identity read offers retry and does not enable upload', async () => {
  read.mockRejectedValueOnce(new Error('Temporary unavailable'));
  const view = renderHook(() => useClaimUploadSession('home-a'));
  await waitFor(() => expect(view.result.current.error).toBe('Temporary unavailable'));
  expect(view.result.current.scope).toBeNull();
  act(() => view.result.current.retry());
  await waitFor(() => expect(view.result.current.scope?.actor_id).toBe(scope.actor_id));
});
