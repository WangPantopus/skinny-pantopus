/**
 * Persistent login — /app/settings/security ("Where you're logged in").
 *
 * Asserts docs/persistent-login/CONTRACT.md from the web side:
 *   1. Devices + web sessions + events render from GET /api/auth/devices;
 *      the current browser is pinned first, current devices get no Remove.
 *   2. Remove device → password step-up (purpose `revoke_device`) →
 *      DELETE /api/auth/devices/:id with the token.
 *   3. "Sign out of all other devices" → step-up `revoke_sessions` → revoke-others.
 *   4. "Sign out everywhere" → step-up → revoke-all → local logout → /login.
 *   5. Security prefs → step-up `change_security_prefs` → PATCH; nothing is
 *      sent when the modal is cancelled.
 *   6. An expired token (403 STEP_UP_REQUIRED on the retry) surfaces a
 *      "confirmation expired" toast; accounts without a password are told to
 *      set one instead of being shown a password field.
 */

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';

const apiMock = require('@pantopus/api');
const mockPush = jest.fn();
// Stable router object (like the real hook) so `useCallback([router])` deps do not churn.
const mockRouter = { push: mockPush, replace: jest.fn(), prefetch: jest.fn(), back: jest.fn() };

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/app/settings/security',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    require('react').createElement('a', { href: String(href), ...props }, children),
}));

const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('@/components/ui/toast-store', () => ({ toast: mockToast }));

const DEVICES = {
  devices: [
    {
      id: 'dev-row-1',
      deviceId: 'client-uuid-1',
      platform: 'ios',
      name: "Ying's iPhone",
      model: 'iPhone16,2',
      osVersion: '18.5',
      appVersion: '1.4.0 (312)',
      isCurrent: false,
      trustLevel: 'trusted',
      trustedAt: '2026-08-01T10:00:00Z',
      lastSeenAt: '2026-08-18T09:00:00Z',
      lastIp: '203.0.113.9',
      createdAt: '2026-08-01T10:00:00Z',
    },
    {
      id: 'dev-row-2',
      deviceId: 'client-uuid-2',
      platform: 'android',
      name: 'Pixel 9',
      model: 'Pixel 9',
      osVersion: '15',
      appVersion: '1.4.0 (312)',
      isCurrent: false,
      trustLevel: 'unverified',
      trustedAt: null,
      lastSeenAt: '2026-08-17T09:00:00Z',
      createdAt: '2026-08-10T10:00:00Z',
    },
  ],
  sessions: [
    {
      id: 'sess-web-current',
      platform: 'web',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      isCurrent: true,
      lastSeenAt: '2026-08-18T09:30:00Z',
      issuedAt: '2026-08-18T08:00:00Z',
    },
    {
      id: 'sess-web-other',
      platform: 'web',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
      isCurrent: false,
      lastSeenAt: '2026-08-16T09:30:00Z',
      issuedAt: '2026-08-15T08:00:00Z',
    },
  ],
  events: [
    { id: 1, type: 'login', createdAt: '2026-08-18T08:00:00Z', meta: { platform: 'web', ip: '203.0.113.9' } },
    { id: 2, type: 'refresh_reuse', createdAt: '2026-08-17T08:00:00Z', meta: { deviceName: 'Pixel 9' } },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  apiMock.getAuthToken.mockReturnValue('__session__');
  apiMock.authDevices.getDevices.mockResolvedValue(JSON.parse(JSON.stringify(DEVICES)));
  apiMock.authDevices.getSecurityPrefs.mockResolvedValue({ allowRestoreGrants: true, newDeviceEmail: true });
  apiMock.auth.getAuthMethods.mockResolvedValue({ providers: ['email'], hasPassword: true });
  apiMock.authDevices.stepUpWithPassword.mockResolvedValue({
    stepUpToken: 'stepup.token',
    expiresAt: '2026-08-18T10:05:00Z',
    purpose: 'revoke_device',
  });
  apiMock.authDevices.revokeDevice.mockResolvedValue({ ok: true });
  apiMock.authDevices.revokeOtherSessions.mockResolvedValue({ revoked: 3 });
  apiMock.authDevices.revokeAllSessions.mockResolvedValue({ ok: true });
  apiMock.authDevices.updateSecurityPrefs.mockImplementation((prefs: any) => Promise.resolve(prefs));
  apiMock.authDevices.getSecurityEvents.mockResolvedValue({ events: DEVICES.events });
  apiMock.auth.logout.mockResolvedValue({ success: true });
});

afterEach(() => cleanup());

function loadPage() {
  const Page = require('../src/app/(app)/app/settings/security/page').default;
  return render(<Page />);
}

async function completeStepUp(password = 'correct horse') {
  const input = await screen.findByLabelText('Password');
  fireEvent.change(input, { target: { value: password } });
  // The modal is rendered after <main>, so its confirm button is the last match
  // (the page has its own "Sign out everywhere" / "Save preferences" buttons).
  const buttons = screen.getAllByRole('button', {
    name: /^(Confirm|Remove device|Sign out others|Sign out everywhere|Save preferences)$/,
  });
  fireEvent.click(buttons[buttons.length - 1]);
}

function deviceRow(name: string) {
  return within(screen.getByTestId('session-list')).getByText(name);
}

describe('Security settings page', () => {
  test('renders devices, sessions and events; pins the current browser; no Remove on current rows', async () => {
    loadPage();

    expect(await screen.findByRole('heading', { name: 'Security' })).toBeInTheDocument();
    expect(apiMock.authDevices.getDevices).toHaveBeenCalledTimes(1);

    const list = screen.getByTestId('session-list');
    const rows = within(list).getAllByRole('listitem');
    // current web session first, then devices, then other web sessions
    expect(rows[0]).toHaveTextContent('Chrome on macOS');
    expect(rows[0]).toHaveTextContent('This device');
    expect(within(rows[0]).queryByRole('button', { name: /Remove/i })).not.toBeInTheDocument();

    expect(within(list).getByText("Ying's iPhone")).toBeInTheDocument();
    expect(within(list).getByText('Pixel 9')).toBeInTheDocument();
    expect(within(list).getByText('Trusted')).toBeInTheDocument();
    expect(within(list).getByText('Unverified')).toBeInTheDocument();
    expect(within(list).getByText('Firefox on Windows')).toBeInTheDocument();
    expect(within(list).getAllByRole('button', { name: /^Remove / })).toHaveLength(2);

    const events = screen.getByTestId('event-list');
    expect(within(events).getByText('Signed in')).toBeInTheDocument();
    expect(within(events).getByText('Session token reuse detected — session revoked')).toBeInTheDocument();
    expect(within(events).getByText(/Pixel 9/)).toBeInTheDocument();
  });

  test('Remove device → password step-up (revoke_device) → DELETE with X-Step-Up token', async () => {
    loadPage();
    await screen.findByRole('button', { name: "Remove Ying's iPhone" });

    fireEvent.click(screen.getByRole('button', { name: "Remove Ying's iPhone" }));
    expect(await screen.findByText("Remove Ying's iPhone?")).toBeInTheDocument();
    // Nothing is sent before the password is confirmed.
    expect(apiMock.authDevices.revokeDevice).not.toHaveBeenCalled();

    await completeStepUp('hunter2!');

    await waitFor(() => expect(apiMock.authDevices.stepUpWithPassword).toHaveBeenCalledWith('revoke_device', 'hunter2!'));
    await waitFor(() => expect(apiMock.authDevices.revokeDevice).toHaveBeenCalledWith('dev-row-1', 'stepup.token'));
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith("Ying's iPhone removed"));
    await waitFor(() => expect(screen.queryByText("Remove Ying's iPhone?")).not.toBeInTheDocument());
    // list is reloaded after a successful revoke
    await waitFor(() => expect(apiMock.authDevices.getDevices).toHaveBeenCalledTimes(2));
  });

  test('cancelling the step-up modal sends nothing', async () => {
    loadPage();
    await screen.findByRole('button', { name: 'Remove Pixel 9' });

    fireEvent.click(screen.getByRole('button', { name: 'Remove Pixel 9' }));
    await screen.findByText('Remove Pixel 9?');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByText('Remove Pixel 9?')).not.toBeInTheDocument());
    expect(apiMock.authDevices.stepUpWithPassword).not.toHaveBeenCalled();
    expect(apiMock.authDevices.revokeDevice).not.toHaveBeenCalled();
  });

  test('wrong password shows an inline error and keeps the modal open', async () => {
    apiMock.authDevices.stepUpWithPassword.mockRejectedValueOnce({ statusCode: 401, message: 'Invalid password' });
    loadPage();
    await screen.findByRole('button', { name: 'Remove Pixel 9' });

    fireEvent.click(screen.getByRole('button', { name: 'Remove Pixel 9' }));
    await completeStepUp('nope');

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect password');
    expect(screen.getByText('Remove Pixel 9?')).toBeInTheDocument();
    expect(apiMock.authDevices.revokeDevice).not.toHaveBeenCalled();
  });

  test('Sign out of all other devices → step-up revoke_sessions → revoke-others', async () => {
    loadPage();
    await screen.findByRole('button', { name: "Remove Ying's iPhone" });

    fireEvent.click(screen.getByRole('button', { name: /Sign out of all other devices/ }));
    await screen.findByText('Sign out of all other devices?');
    await completeStepUp();

    await waitFor(() =>
      expect(apiMock.authDevices.stepUpWithPassword).toHaveBeenCalledWith('revoke_sessions', 'correct horse'),
    );
    await waitFor(() => expect(apiMock.authDevices.revokeOtherSessions).toHaveBeenCalledWith('stepup.token'));
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('Signed out of 3 other sessions'));
    expect(apiMock.authDevices.revokeAllSessions).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalledWith('/login');
  });

  test('Sign out everywhere → revoke-all → local logout → /login', async () => {
    loadPage();
    await screen.findByRole('button', { name: "Remove Ying's iPhone" });

    fireEvent.click(screen.getByRole('button', { name: /^Sign out everywhere$/ }));
    await screen.findByText('Sign out everywhere?');
    await completeStepUp();

    await waitFor(() => expect(apiMock.authDevices.revokeAllSessions).toHaveBeenCalledWith('stepup.token'));
    await waitFor(() => expect(apiMock.auth.logout).toHaveBeenCalled());
    await waitFor(() => expect(apiMock.clearAuthToken).toHaveBeenCalled());
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/login'));
  });

  test('security prefs → step-up change_security_prefs → PATCH; Save disabled until dirty', async () => {
    loadPage();
    const save = await screen.findByRole('button', { name: 'Save preferences' });
    expect(save).toBeDisabled();

    fireEvent.click(screen.getByRole('switch', { name: 'Allow one-tap restore after reinstall (Android)' }));
    expect(save).toBeEnabled();
    fireEvent.click(save);

    await screen.findByText('Update security preferences?');
    await completeStepUp();

    await waitFor(() =>
      expect(apiMock.authDevices.stepUpWithPassword).toHaveBeenCalledWith('change_security_prefs', 'correct horse'),
    );
    await waitFor(() =>
      expect(apiMock.authDevices.updateSecurityPrefs).toHaveBeenCalledWith(
        { allowRestoreGrants: false, newDeviceEmail: true },
        'stepup.token',
      ),
    );
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('Security preferences saved'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save preferences' })).toBeDisabled());
  });

  test('a 403 STEP_UP_REQUIRED on the gated call is reported as an expired confirmation', async () => {
    apiMock.authDevices.revokeDevice.mockRejectedValueOnce({
      statusCode: 403,
      message: 'Step-up required',
      data: { error: 'Step-up required', code: 'STEP_UP_REQUIRED', purpose: 'revoke_device', methods: ['password'] },
    });
    loadPage();
    await screen.findByRole('button', { name: 'Remove Pixel 9' });

    fireEvent.click(screen.getByRole('button', { name: 'Remove Pixel 9' }));
    await completeStepUp();

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('Your confirmation expired. Please try again.'));
    // Device stays in the list (nothing was removed).
    expect(deviceRow('Pixel 9')).toBeInTheDocument();
  });

  test('accounts without a password are asked to set one (no password field, confirm disabled)', async () => {
    apiMock.auth.getAuthMethods.mockResolvedValue({ providers: ['google'], hasPassword: false });
    loadPage();
    await screen.findByRole('button', { name: 'Remove Pixel 9' });

    fireEvent.click(screen.getByRole('button', { name: 'Remove Pixel 9' }));
    expect(await screen.findByText('This account has no password yet.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Set a password/ })).toHaveAttribute('href', '/app/profile/settings/password');
    expect(screen.getByRole('button', { name: 'Remove device' })).toBeDisabled();
  });

  test('device list failure shows a retry banner and still allows sign-out actions', async () => {
    apiMock.authDevices.getDevices.mockRejectedValueOnce({ statusCode: 404, message: 'Not found' });
    loadPage();

    expect(await screen.findByText('Could not load your devices')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign out of all other devices/ })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(apiMock.authDevices.getDevices).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: "Remove Ying's iPhone" })).toBeInTheDocument();
  });

  test('redirects to login when there is no session', async () => {
    apiMock.getAuthToken.mockReturnValue(null);
    loadPage();
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/login?redirectTo=%2Fapp%2Fsettings%2Fsecurity'));
    expect(apiMock.authDevices.getDevices).not.toHaveBeenCalled();
  });
});
