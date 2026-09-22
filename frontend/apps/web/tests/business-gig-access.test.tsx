import { act, renderHook, waitFor } from '@testing-library/react';
import * as api from '@pantopus/api';
import { useBusinessGigAccess } from '../src/hooks/useBusinessGigAccess';

let token = '__session__';
let origin = 'https://app.test';
const listeners = new Set<() => void>();
jest.mock('@pantopus/api', () => ({
  getAuthToken: () => token, getApiBaseUrl: () => origin,
  AUTH_SESSION_CHANGE_KEY: 'session-change',
  onTokenChange: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); },
  businessIam: { getMyBusinessAccess: jest.fn() },
}));
const grant = { hasAccess: true, isOwner: false, permissions: ['gigs.manage'] };
const response = (value: unknown) => value as Awaited<ReturnType<typeof api.businessIam.getMyBusinessAccess>>;
const props = { actor: 'actor-a', owner: 'business-a', business: true, revision: 1 };
function show() {
  return renderHook(({ actor, owner, business, revision }) => useBusinessGigAccess(actor, owner, business, revision), { initialProps: props });
}
beforeEach(() => {
  jest.clearAllMocks(); listeners.clear(); token = '__session__'; origin = 'https://app.test';
  jest.mocked(api.businessIam.getMyBusinessAccess).mockResolvedValue(response(grant));
});
test.each([
  [grant, true], [{ hasAccess: true, isOwner: true, permissions: [] }, true],
  [{ hasAccess: true, permissions: ['gigs.post'] }, true],
  [{ hasAccess: false, isOwner: true, permissions: ['gigs.manage'] }, false],
  [{ hasAccess: true, permissions: ['gigs.view'] }, false], [null, false],
])('only current authorized business permissions expose manager actions: %j', async (access, allowed) => {
  jest.mocked(api.businessIam.getMyBusinessAccess).mockResolvedValue(response(access));
  const view = show(); await act(async () => {});
  expect(view.result.current).toBe(allowed);
});
test('failed permission lookup hides actions', async () => {
  jest.mocked(api.businessIam.getMyBusinessAccess).mockRejectedValue(new Error('Unavailable'));
  const view = show(); await act(async () => {}); expect(view.result.current).toBe(false);
});
test.each(['owner', 'actor'] as const)('a delayed grant cannot cross a changed %s', async (field) => {
  let resolve!: (value: ReturnType<typeof response>) => void;
  jest.mocked(api.businessIam.getMyBusinessAccess).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  jest.mocked(api.businessIam.getMyBusinessAccess).mockResolvedValueOnce(response({ hasAccess: false }));
  const view = show(); view.rerender({ ...props, [field]: `${field}-b` });
  await act(async () => { resolve(response(grant)); });
  expect(view.result.current).toBe(false);
});
test.each(['same-tab', 'cross-tab', 'cleared-storage'])('a %s session change stays retired across data refreshes with an identical cookie marker', async (signal) => {
  const view = show(); await waitFor(() => expect(view.result.current).toBe(true));
  act(() => {
    if (signal === 'same-tab') [...listeners].forEach((fn) => fn());
    else window.dispatchEvent(new StorageEvent('storage', { key: signal === 'cross-tab' ? api.AUTH_SESSION_CHANGE_KEY : null }));
  });
  expect(view.result.current).toBe(false);
  view.rerender({ ...props, revision: 2 }); await act(async () => {});
  expect(api.businessIam.getMyBusinessAccess).toHaveBeenCalledTimes(1);
  expect(view.result.current).toBe(false);
});
test.each(['token', 'origin'])('changed %s retires the old actor even without a notification', async (field) => {
  const view = show(); await waitFor(() => expect(view.result.current).toBe(true));
  if (field === 'token') token = 'replacement'; else origin = 'https://another.test';
  view.rerender({ ...props, revision: 2 }); await act(async () => {});
  expect(view.result.current).toBe(false); expect(api.businessIam.getMyBusinessAccess).toHaveBeenCalledTimes(1);
});
test('a newly loaded actor can obtain its own permissions after retirement', async () => {
  const view = show(); await waitFor(() => expect(view.result.current).toBe(true));
  act(() => [...listeners].forEach((fn) => fn()));
  view.rerender({ ...props, actor: 'actor-b' });
  await waitFor(() => expect(view.result.current).toBe(true));
  expect(api.businessIam.getMyBusinessAccess).toHaveBeenCalledTimes(2);
});
test('same-task refresh keeps recovery mounted until current permissions arrive, then applies revocation', async () => {
  const view = show(); await waitFor(() => expect(view.result.current).toBe(true));
  let resolve!: (value: ReturnType<typeof response>) => void;
  jest.mocked(api.businessIam.getMyBusinessAccess).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  view.rerender({ ...props, revision: 2 }); expect(view.result.current).toBe(true);
  await act(async () => { resolve(response({ hasAccess: false })); });
  expect(view.result.current).toBe(false);
});
