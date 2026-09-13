import { webcrypto } from 'node:crypto';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import * as api from '@pantopus/api';
import { useRemoval } from '../src/components/home/member-removals/useRemoval';
import MemberRemovalRecovery from '../src/components/home/member-removals/MemberRemovalRecovery';
import type { RemovalSnapshot } from '../src/components/home/member-removals/PendingRemovalStore';
import type { RemovalDraft } from '../src/components/home/member-removals/removalModel';

jest.mock('@pantopus/api', () => ({ getApiBaseUrl: jest.fn(() => 'http://127.0.0.1:18080'), getAuthToken: jest.fn(() => 'synthetic'),
  AUTH_SESSION_CHANGE_KEY: 'session-marker', onTokenChange: jest.fn(),
  apiClient: { get: jest.fn(), post: jest.fn(), request: jest.fn() }, users: { getMyProfile: jest.fn() } }));
let mockSaved: RemovalSnapshot | null = null, mockRevision = 0;
jest.mock('../src/components/home/member-removals/PendingRemovalStore', () => ({ PendingRemovalStore: jest.fn().mockImplementation(() => ({
  load: async () => mockSaved,
  save: async (draft: RemovalDraft, expected: RemovalSnapshot | null, current: () => boolean) => {
    if (!current() || (expected?.revision ?? null) !== (mockSaved?.revision ?? null)) throw Error('Changed');
    mockSaved = { draft: structuredClone(draft), revision: String(++mockRevision) }; return mockSaved;
  },
  clear: async () => { mockSaved = null; },
})) }));
const actor = '10000000-0000-4000-8000-000000000001', home = '10000000-0000-4000-8000-000000000002';
const target = '10000000-0000-4000-8000-000000000003', occupancy = '10000000-0000-4000-8000-000000000004';
const session = { actor_id: actor, session_scope: 'a'.repeat(64) }, decision = 'b'.repeat(64), input = { home_id: home, target_user_id: target };
const context = { ...input, occupancy_id: occupancy, action: 'remove', decision_token: decision, session,
  home: { id: home, name: 'Fixture household' }, target: { id: target, name: null, username: 'fixture_member', role_base: 'member',
    is_self: false, is_active: true, verification_status: 'verified', start_at: null, end_at: null, access_start_at: null, access_end_at: null } };
let sessionChange: () => void;
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear(); mockSaved = null; mockRevision = 0;
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
  Object.defineProperty(globalThis, 'structuredClone', { configurable: true, value: (v: unknown) => JSON.parse(JSON.stringify(v)) });
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  jest.mocked(api.getAuthToken).mockReturnValue('synthetic');
  jest.mocked(api.onTokenChange).mockImplementation(callback => { sessionChange = () => callback(null); return () => {}; });
  jest.mocked(api.apiClient.get).mockResolvedValue({ data: { session } } as never);
  jest.mocked(api.users.getMyProfile).mockResolvedValue({ id: actor, name: 'Fixture account' } as never);
  jest.mocked(api.apiClient.post).mockResolvedValue({ data: context } as never);
  jest.mocked(api.apiClient.request).mockRejectedValue(Error('Lost reply'));
});
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
test.each(['failure', 'changed-list'])('an older roster success cannot overwrite a newer %s', async next => {
  const { result } = renderHook(() => useRemoval('selection'));
  await waitFor(() => expect(result.current.ready).toBe(true));
  const old = deferred<unknown>(); let rosterReads = 0;
  jest.mocked(api.apiClient.get).mockImplementation(async url => {
    if (!String(url).endsWith('/occupants')) return { data: { session } } as never;
    if (++rosterReads === 1) return await old.promise as never;
    if (next === 'failure') throw Object.assign(Error('Current read unavailable'), { statusCode: 503 });
    return { data: { occupants: [] } } as never;
  });
  let first: Promise<void>;
  act(() => { first = result.current.checkRoster(input); });
  await waitFor(() => expect(rosterReads).toBe(1));
  await act(async () => { await result.current.checkRoster(input); });
  expect(result.current.roster).toMatchObject(next === 'failure' ? { state: 'unavailable' } : { state: 'checked', listed: false });
  await act(async () => {
    old.resolve({ data: { occupants: [{ id: occupancy, home_id: home, user_id: target, is_active: true }] } }); await first!;
  });
  expect(result.current.roster).toMatchObject(next === 'failure' ? { state: 'unavailable' } : { state: 'checked', listed: false });
});
test('a held roster reply cannot survive account retirement', async () => {
  const { result } = renderHook(() => useRemoval('selection'));
  await waitFor(() => expect(result.current.ready).toBe(true));
  const old = deferred<unknown>(); let started = false;
  jest.mocked(api.apiClient.get).mockImplementation(async url => {
    if (String(url).endsWith('/occupants')) { started = true; return await old.promise as never; }
    return { data: { session } } as never;
  });
  let first: Promise<void>;
  act(() => { first = result.current.checkRoster(input); });
  await waitFor(() => expect(started).toBe(true));
  await act(async () => { jest.mocked(api.getAuthToken).mockReturnValue(null); sessionChange(); });
  await act(async () => { old.resolve({ data: { occupants: [] } }); await first!; });
  expect(result.current.roster.state).toBe('unchecked'); expect(result.current.blocked).toBe(true);
});
test('a named review cancels without a removal request and a lost reply exposes explicit recovery', async () => {
  render(<MemberRemovalRecovery homeId={home} targetId={target}/>);
  fireEvent.click(await screen.findByRole('button', { name: 'Review removal' }));
  await screen.findByRole('alertdialog', { name: 'Review member removal' });
  expect(screen.getByRole('heading', { name: 'Review member removal' })).toHaveFocus();
  expect(screen.getByText('@fixture_member')).toBeVisible(); expect(screen.getByText('Fixture household')).toBeVisible();
  fireEvent.keyDown(screen.getByRole('heading', { name: 'Review member removal' }), { key: 'Escape' });
  expect(api.apiClient.request).not.toHaveBeenCalled(); expect(mockSaved).toBeNull();
  expect(screen.getByRole('button', { name: 'Review removal' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Review removal' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm removal' }));
  await screen.findByRole('heading', { name: 'Recover your removal' });
  expect(screen.getByRole('button', { name: 'Check saved result' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Retry original removal' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Cancel this attempt' })).toBeVisible();
  expect(api.apiClient.request).toHaveBeenCalledTimes(1); expect(mockSaved?.draft.outcome).toBeUndefined();
  expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
});
test('cold recovery without a Home selection keeps historical success separate from an unavailable roster', async () => {
  const { result, unmount } = renderHook(() => useRemoval('selection'));
  await waitFor(() => expect(result.current.ready).toBe(true));
  await act(async () => { await result.current.prepare(input); });
  await act(async () => { await result.current.submit(decision); });
  const original = mockSaved!.draft;
  unmount();
  jest.mocked(api.apiClient.request).mockResolvedValue({ status: 200, data: { state: 'completed', ...input, occupancy_id: occupancy,
    action: 'remove', decision_token: decision, completed_at: '2026-09-13T12:00:00Z', code: null, status: null,
    command: { actor_id: actor, request_id: original.request_id, created_at: '2026-09-13T12:00:00Z', updated_at: '2026-09-13T12:00:00Z' }, session } } as never);
  render(<MemberRemovalRecovery/>);
  await screen.findByRole('heading', { name: 'Removal recorded' });
  expect(screen.getByText('Current membership has not been checked.')).toBeVisible();
  jest.mocked(api.apiClient.get).mockImplementation(async url => {
    if (String(url).endsWith('/occupants')) throw Object.assign(Error('Denied'), { statusCode: 403 });
    return { data: { session } } as never;
  });
  fireEvent.click(screen.getByRole('button', { name: 'Check current roster' }));
  await screen.findByText(/Current membership is unknown; your saved removal result is kept/);
  expect(screen.getByRole('heading', { name: 'Removal recorded' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled();
  expect(jest.mocked(api.apiClient.request).mock.calls[1][0].method).toBe('GET');
  expect(api.apiClient.request).toHaveBeenCalledTimes(2);
});
