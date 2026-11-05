// Shared by the notification bell (NotificationBell.tsx) and its on-demand panel
// (NotificationPanel.tsx), so the bell itself stays small.

/**
 * The firewall slice a bell represents (P2.3 / unified-IA §6.1): `personal`
 * (bell icon, the Personal zone) and `audience` (megaphone icon, behind the
 * audience_profile flag). `all` is the legacy, single-bell behavior kept so
 * non-flagged users see exactly what they saw before.
 */
export type NotificationBellMode = 'all' | 'personal' | 'audience';

/**
 * The dropdown panel. Hung from the bell it ran off a phone's left edge, so on phones it drops from the top bar
 * across the screen, no taller than the screen (its list scrolls). Below the desktop layout it stays 384 px
 * wide at any text size, so it fits beside the bell.
 */
export const NOTIFICATION_PANEL_CLASS = 'absolute right-0 top-full mt-2 w-96 max-lg:w-[384px] max-sm:fixed max-sm:inset-x-2 max-sm:top-14 max-sm:w-auto max-sm:flex max-sm:flex-col max-sm:max-h-[calc(100dvh-4.5rem)] bg-surface rounded-xl shadow-2xl border border-app z-[100] overflow-hidden';
