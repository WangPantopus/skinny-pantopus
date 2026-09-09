import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { UserNotificationPreferences } from '@pantopus/types';
import * as api from '@pantopus/api';
import NotificationPreferencesPage from '../src/app/(app)/app/settings/notifications/page';

const mockRouter = { replace: jest.fn(), back: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter }));
jest.mock('@pantopus/api', () => ({
  getAuthToken: jest.fn(() => 'synthetic-session'),
  getHubPreferences: jest.fn(), updateHubPreferences: jest.fn(),
}));
const read = jest.mocked(api.getHubPreferences);
const save = jest.mocked(api.updateHubPreferences);
let stored: UserNotificationPreferences;
const beacon = () => screen.getByRole('switch', { name: 'Beacon Push Notifications' });
const tick = async () => { await act(async () => { jest.advanceTimersByTime(600); }); };
const load = async () => { await act(async () => { render(<NotificationPreferencesPage />); }); };

beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks();
  stored = { user_id: 'synthetic-user', daily_briefing_enabled: false,
    daily_briefing_time_local: '07:30', daily_briefing_timezone: 'America/Los_Angeles',
    evening_briefing_enabled: false, evening_briefing_time_local: '18:00',
    weather_alerts_enabled: true, aqi_alerts_enabled: true, mail_summary_enabled: true,
    gig_updates_enabled: true, beacon_push_enabled: true, home_reminders_enabled: true,
    quiet_hours_start_local: null, quiet_hours_end_local: null,
    location_mode: 'primary_home', custom_latitude: null, custom_longitude: null, custom_label: null };
  read.mockImplementation(async () => ({ preferences: { ...stored } }));
  save.mockImplementation(async patch => {
    stored = { ...stored, ...patch };
    return { preferences: { ...stored } };
  });
});
afterEach(() => { cleanup(); jest.clearAllTimers(); jest.useRealTimers(); });

test('renders persisted Beacon opt-out and explains that in-app updates remain', async () => {
  stored.beacon_push_enabled = false;
  await load();
  expect(beacon()).toHaveAttribute('aria-checked', 'false');
  expect(screen.getByText(/Updates stay in the app when off/)).toBeInTheDocument();
  fireEvent.click(beacon()); await tick();
  expect(save).toHaveBeenCalledWith({ beacon_push_enabled: true });
  expect(beacon()).toHaveAttribute('aria-checked', 'true');
});

test('a rapid second toggle cannot discard the Beacon opt-out', async () => {
  await load();
  fireEvent.click(beacon());
  fireEvent.click(screen.getByRole('switch', { name: 'Gig Updates' }));
  await tick();
  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith({ beacon_push_enabled: false, gig_updates_enabled: false });
  expect(stored.beacon_push_enabled).toBe(false);
});

test('serializes overlapping saves so an older opt-in cannot overwrite the latest opt-out', async () => {
  stored.beacon_push_enabled = false;
  let release!: () => void;
  save.mockImplementationOnce(async patch => {
    await new Promise<void>(resolve => { release = resolve; });
    stored = { ...stored, ...patch };
    return { preferences: { ...stored } };
  });
  await load();
  fireEvent.click(beacon()); await tick();
  fireEvent.click(beacon()); await tick();
  expect(save).toHaveBeenCalledTimes(1);
  await act(async () => { release(); });
  expect(save).toHaveBeenCalledTimes(2);
  expect(save).toHaveBeenLastCalledWith({ beacon_push_enabled: false });
  expect(stored.beacon_push_enabled).toBe(false);
  expect(beacon()).toHaveAttribute('aria-checked', 'false');
});

test('failed opt-out reloads server truth and shows a save failure', async () => {
  save.mockRejectedValueOnce(new Error('Synthetic save failure'));
  await load(); fireEvent.click(beacon());
  expect(beacon()).toHaveAttribute('aria-checked', 'false');
  await tick();
  expect(beacon()).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByText('Failed to save')).toBeInTheDocument();
});
