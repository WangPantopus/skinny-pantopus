'use client';

// ============================================================
// You: one cache entry each for your profile (GET /api/users/profile), your
// notification preferences and your privacy settings.
//
// Screens read them with useMe(), useNotificationPreferences() and
// usePrivacySettings(); effects, handlers and controllers read the profile
// with fetchMe(), which answers from the entry while it is fresh and otherwise
// shares one request. Edits put the server's copy back (setMe() and friends)
// or mark the profile out of date with refreshMe(), so every screen shows the
// same values. Freshness follows the Instant Screens contract §4 ("You":
// 10 minutes). All three live under ['me', …], so the server's `profile:me`
// change signal can mark them out of date together. The entries live in the
// session's query client, which sign-out and account switches replace
// (lib/query-provider.tsx).
// ============================================================

import { useQuery } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import { queryKeys } from '@/lib/query-keys';
import { activeQueryClient } from '@/lib/active-query-client';

export type Me = Awaited<ReturnType<typeof api.users.getMyProfile>>;
export type NotificationPreferences = Awaited<ReturnType<typeof api.getHubPreferences>>['preferences'];
export type PrivacySettings = Awaited<ReturnType<typeof api.privacy.getPrivacySettings>>['settings'];

export const ME_FRESH_MS = 10 * 60 * 1000;

function meQuery() {
  return { queryKey: queryKeys.me(), queryFn: () => api.users.getMyProfile(), staleTime: ME_FRESH_MS };
}

/** The signed-in account's profile, shown at once when it was loaded before. */
export function useMe(options?: { enabled?: boolean }) {
  return useQuery({ ...meQuery(), ...options });
}

/** The profile for code outside rendering: the cached copy while fresh, else one shared request. */
export function fetchMe(): Promise<Me> {
  const client = activeQueryClient();
  return client ? client.fetchQuery(meQuery()) : api.users.getMyProfile();
}

/** Puts a profile the server just returned (after an edit) into the entry. */
export function setMe(user: Partial<Me> | null | undefined): void {
  if (!user) return;
  activeQueryClient()?.setQueryData<Me>(queryKeys.me(), (old) => (old ? { ...old, ...user } : (user as Me)));
}

/** Marks the profile out of date after an edit whose reply doesn't carry it; shown screens refetch. */
export function refreshMe(): Promise<void> {
  return activeQueryClient()?.invalidateQueries({ queryKey: queryKeys.me(), exact: true }) ?? Promise.resolve();
}

/** Your notification preferences (Settings → Notifications, Today's briefing card). */
export function useNotificationPreferences(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.notificationPreferences(),
    queryFn: async () => (await api.getHubPreferences()).preferences,
    staleTime: ME_FRESH_MS,
    ...options,
  });
}

/** Puts the preferences the server just saved into the entry. */
export function setNotificationPreferences(preferences: NotificationPreferences | null | undefined): void {
  if (preferences) activeQueryClient()?.setQueryData(queryKeys.notificationPreferences(), preferences);
}

/** Your privacy settings (Settings → Advanced Privacy & Blocks). */
export function usePrivacySettings(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.privacySettings(),
    queryFn: async () => (await api.privacy.getPrivacySettings()).settings,
    staleTime: ME_FRESH_MS,
    ...options,
  });
}

/** Puts the privacy settings the server just saved into the entry. */
export function setPrivacySettings(settings: PrivacySettings | null | undefined): void {
  if (settings) activeQueryClient()?.setQueryData(queryKeys.privacySettings(), settings);
}
