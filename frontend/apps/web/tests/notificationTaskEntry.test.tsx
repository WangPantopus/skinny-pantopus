import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import NotificationBell from '../src/components/NotificationBell';
import NotificationsPage from '../src/app/(app)/app/notifications/page';

const push = jest.fn();
const router = { push, replace: jest.fn() };
const search = { get: () => null, entries: () => [].entries() };
jest.mock('next/navigation', () => ({ useRouter: () => router, useSearchParams: () => search }));
jest.mock('@/contexts/SocketContext', () => ({ useSocket: () => null }));
jest.mock('@/contexts/BadgeContext', () => ({ useBadges: () => ({ notifications: 1,
  notificationsByContext: { personal: 1, platform: 0, audience: 0 } }) }));
jest.mock('@/hooks/useFeatureFlag', () => ({ useFeatureFlagState: () => ({ enabled: false, isFetched: true }) }));
jest.mock('@tanstack/react-virtual', () => ({ useVirtualizer: ({ count }: { count: number }) => ({
  getVirtualItems: () => Array.from({ length: count }, (_, index) => ({ index, key: index, start: index * 80, size: 80 })),
  getTotalSize: () => count * 80, measureElement: () => {},
}) }));
const home = 'ddf18400-0000-4000-8000-000000000100';
const task = 'ddf18400-0000-4000-8000-000000000200';
const actor = 'ddf18400-0000-4000-8000-000000000001';
const note = { id: 'exact-task-note', user_id: actor, type: 'task_assigned', title: 'Current task assignment',
  body: 'Open the current Home task', is_read: false, created_at: '2026-09-10T12:00:00Z', context: 'personal',
  link: `/app/homes/${home}/dashboard?tab=tasks`, metadata: { home_id: home, task_id: task } };
const mark = api.notifications.markAsRead as jest.Mock;
const profile = api.users.getMyProfile as jest.Mock;
function deferred() { let resolve!: (value: unknown) => void;
  const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
async function show(surface: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const view = render(<QueryClientProvider client={client}>
    {surface === 'bell' ? <NotificationBell /> : <NotificationsPage />}
  </QueryClientProvider>);
  if (surface === 'bell') fireEvent.click(screen.getByTestId('notification-bell-all'));
  await screen.findByText(note.title);
  return view;
}
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  (api.getAuthToken as jest.Mock).mockReturnValue('__session__');
  (api.notifications.getNotifications as jest.Mock).mockResolvedValue({ notifications: [note], unreadCount: 1, hasMore: false });
  profile.mockResolvedValue({ id: actor }); mark.mockResolvedValue({});
});
afterEach(() => cleanup());
describe.each(['bell', 'list'])('%s actual notification entry', surface => {
  test('opens the exact task from metadata after marking its notification read', async () => {
    await show(surface); fireEvent.click(screen.getByText(note.title));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/app/homes/${home}/tasks/${task}`));
    expect(mark).toHaveBeenCalledWith(note.id);
  });
  test('replacing a cookie session during mark-read cannot navigate the old tap', async () => {
    const pending = deferred(); mark.mockReturnValue(pending.promise);
    await show(surface); fireEvent.click(screen.getByText(note.title));
    await waitFor(() => expect(mark).toHaveBeenCalled());
    localStorage.setItem(api.AUTH_SESSION_CHANGE_KEY, 'replacement');
    await act(async () => pending.resolve({})); expect(push).not.toHaveBeenCalled();
  });
  test('leaving while mark-read is pending cannot navigate the departed view', async () => {
    const pending = deferred(); mark.mockReturnValue(pending.promise);
    const view = await show(surface); fireEvent.click(screen.getByText(note.title));
    await waitFor(() => expect(mark).toHaveBeenCalled()); view.unmount();
    await act(async () => pending.resolve({})); expect(push).not.toHaveBeenCalled();
  });
  test('an old account notification cannot open under another current recipient', async () => {
    profile.mockResolvedValue({ id: home }); await show(surface);
    await act(async () => fireEvent.click(screen.getByText(note.title)));
    expect(mark).not.toHaveBeenCalled(); expect(push).not.toHaveBeenCalled();
  });
});
