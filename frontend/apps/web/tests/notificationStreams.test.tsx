/**
 * P2.3 — two-stream notification UI (bell + megaphone).
 *
 * Asserts:
 *   1. NotificationBell mode='personal' shows the bell icon + sums
 *      personal+platform from byContext.
 *   2. NotificationBell mode='audience' shows the megaphone icon + uses
 *      byContext.audience only.
 *   3. NotificationBell mode='all' (legacy) keeps the combined count.
 *   4. The dropdown for personal mode requests context=personal AND
 *      context=platform; for audience mode requests context=audience.
 *      Cross-context rows are never interleaved.
 *   5. Notifications page renders zone tabs with the right active state
 *      and data-zone attributes.
 *   6. Notifications page hides the Audience tab when the flag is off.
 */

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, prefetch: jest.fn() }),
  usePathname: () => '/app/notifications',
  useSearchParams: () => ({
    get: (k: string) => (k === 'context' ? 'personal' : null),
    entries: () => [].entries(),
  }),
}));

// BadgeContext is consumed by NotificationBell. Stub it to provide the
// per-context counts the bell renders.
jest.mock('@/contexts/BadgeContext', () => ({
  useBadges: () => ({
    unreadMessages: 0,
    totalMessages: 0,
    pendingOffers: 0,
    notifications: 12,
    notificationsByContext: { personal: 9, audience: 3, platform: 0 },
    connected: false,
    socket: null,
    setUnreadMessages: () => {},
    setTotalMessages: () => {},
  }),
  BadgeProvider: ({ children }: any) => children,
}));

jest.mock('@/contexts/SocketContext', () => ({
  useSocket: () => null,
  useSocketConnected: () => false,
  SocketProvider: ({ children }: any) => children,
}));

const apiMock = require('@pantopus/api');

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  apiMock.featureFlags.getFeatureFlag.mockResolvedValue({ enabled: false });
  apiMock.notifications.getNotifications.mockResolvedValue({
    notifications: [], unreadCount: 0, hasMore: false,
  });
});

afterEach(() => cleanup());

describe('NotificationBell — split by firewall mode (P2.3)', () => {
  function loadBell(mode: 'all' | 'personal' | 'audience') {
    const NotificationBell = require('../src/components/NotificationBell').default;
    return renderWithClient(<NotificationBell mode={mode} />);
  }

  test('mode=personal renders the bell icon and the personal+platform count', () => {
    loadBell('personal');
    const button = screen.getByTestId('notification-bell-personal');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Personal notifications');
    expect(button).toHaveAttribute('data-mode', 'personal');
    // 9 personal + 0 platform = 9
    expect(screen.getByTestId('notification-badge-personal')).toHaveTextContent('9');
    // No megaphone in personal mode.
    expect(screen.queryByTestId('notification-bell-audience')).not.toBeInTheDocument();
  });

  test('mode=audience renders the megaphone with the audience count and teal accent', () => {
    loadBell('audience');
    const button = screen.getByTestId('notification-bell-audience');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Audience notifications');
    expect(button).toHaveAttribute('data-mode', 'audience');
    const badge = screen.getByTestId('notification-badge-audience');
    expect(badge).toHaveTextContent('3');
    expect(badge.className).toMatch(/bg-teal-500/);
  });

  test('mode=all (legacy) shows the combined count', () => {
    loadBell('all');
    expect(screen.getByTestId('notification-badge-all')).toHaveTextContent('12');
  });

  test('opening the personal dropdown fans out personal + platform queries', async () => {
    apiMock.notifications.getNotifications.mockImplementation((opts: any) => {
      if (opts?.context === 'personal') {
        return Promise.resolve({
          notifications: [{
            id: 'n-personal', title: 'Personal one', body: 'x',
            is_read: false, created_at: '2026-05-08T10:00:00Z', type: 'gig',
          }],
          unreadCount: 1, hasMore: false,
        });
      }
      if (opts?.context === 'platform') {
        return Promise.resolve({
          notifications: [{
            id: 'n-platform', title: 'Platform one', body: 'y',
            is_read: false, created_at: '2026-05-08T11:00:00Z', type: 'subscription_renewed',
          }],
          unreadCount: 1, hasMore: false,
        });
      }
      return Promise.resolve({ notifications: [], unreadCount: 0, hasMore: false });
    });

    loadBell('personal');
    act(() => {
      screen.getByTestId('notification-bell-personal').click();
    });

    await waitFor(() => {
      expect(apiMock.notifications.getNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ context: 'personal' }),
      );
      expect(apiMock.notifications.getNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ context: 'platform' }),
      );
    });

    // No call ever requests audience from the personal bell.
    const audienceCalls = apiMock.notifications.getNotifications.mock.calls.filter(
      ([opts]: any[]) => opts?.context === 'audience',
    );
    expect(audienceCalls).toHaveLength(0);

    // Both rows render in the merged feed.
    await waitFor(() => {
      expect(screen.getByText('Personal one')).toBeInTheDocument();
      expect(screen.getByText('Platform one')).toBeInTheDocument();
    });
  });

  test('opening the audience dropdown only requests context=audience', async () => {
    apiMock.notifications.getNotifications.mockResolvedValue({
      notifications: [{
        id: 'n-audience', title: 'Audience one', body: 'fan stuff',
        is_read: false, created_at: '2026-05-08T10:00:00Z', type: 'persona_dm_received_creator',
      }],
      unreadCount: 1, hasMore: false,
    });

    loadBell('audience');
    act(() => {
      screen.getByTestId('notification-bell-audience').click();
    });

    await waitFor(() => {
      expect(apiMock.notifications.getNotifications).toHaveBeenCalled();
    });

    const calls = apiMock.notifications.getNotifications.mock.calls.map(([opts]: any[]) => opts?.context);
    // Audience bell ONLY ever asks for audience — never personal/platform.
    expect(calls.every((c: string) => c === 'audience')).toBe(true);
    expect(calls.length).toBeGreaterThan(0);
  });
});

describe('Notifications page zone tabs (P2.3)', () => {
  function loadPage() {
    const NotificationsPage = require('../src/app/(app)/app/notifications/page').default;
    return renderWithClient(<NotificationsPage />);
  }

  test('flag ON renders both Personal and Audience tabs', async () => {
    apiMock.featureFlags.getFeatureFlag.mockResolvedValue({ enabled: true });
    loadPage();

    await waitFor(() => {
      expect(screen.getByTestId('zone-tab-personal')).toBeInTheDocument();
      expect(screen.getByTestId('zone-tab-audience')).toBeInTheDocument();
    });
    expect(screen.getByTestId('zone-tab-personal')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('zone-tab-audience')).toHaveAttribute('data-active', 'false');
  });

  test('flag OFF hides the Audience tab', async () => {
    apiMock.featureFlags.getFeatureFlag.mockResolvedValue({ enabled: false });
    loadPage();

    await waitFor(() => {
      expect(screen.getByTestId('zone-tab-personal')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('zone-tab-audience')).not.toBeInTheDocument();
  });

  test('switching to the Audience tab requests context=audience without personal/platform', async () => {
    apiMock.featureFlags.getFeatureFlag.mockResolvedValue({ enabled: true });
    apiMock.notifications.getNotifications.mockResolvedValue({
      notifications: [], unreadCount: 0, hasMore: false,
    });
    loadPage();

    // Wait for the initial personal-tab fetches to settle, then drop them.
    const audienceTab = await screen.findByTestId('zone-tab-audience');
    await waitFor(() => {
      expect(apiMock.notifications.getNotifications).toHaveBeenCalled();
    });
    apiMock.notifications.getNotifications.mockClear();

    act(() => {
      audienceTab.click();
    });

    await waitFor(() => {
      expect(audienceTab).toHaveAttribute('data-active', 'true');
      expect(apiMock.notifications.getNotifications).toHaveBeenCalled();
    });

    const calls = apiMock.notifications.getNotifications.mock.calls.map(([opts]: any[]) => opts?.context);
    // Cross-zone leak check: never request personal/platform from the
    // audience tab.
    expect(calls.includes('personal')).toBe(false);
    expect(calls.includes('platform')).toBe(false);
    expect(calls.includes('audience')).toBe(true);
  });
});
