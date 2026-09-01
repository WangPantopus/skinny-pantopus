export type IdentityAnalyticsEventName =
  | 'identity_privacy_preview_opened'
  | 'identity_profile_link_changed'
  | 'identity_public_profile_saved'
  | 'identity_update_published'
  | 'identity_public_profile_follow_changed';

type IdentityAnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

type AnalyticsWindow = Window & {
  analytics?: { track?: (eventName: string, properties?: Record<string, unknown>) => void };
  posthog?: { capture?: (eventName: string, properties?: Record<string, unknown>) => void };
  gtag?: (command: 'event', eventName: string, properties?: Record<string, unknown>) => void;
};

function compactProperties(properties: IdentityAnalyticsProperties): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined),
  );
}

export function trackIdentityEvent(
  eventName: IdentityAnalyticsEventName,
  properties: IdentityAnalyticsProperties = {},
): void {
  if (typeof window === 'undefined') return;

  const payload = compactProperties(properties);
  const analyticsWindow = window as AnalyticsWindow;

  window.dispatchEvent(new CustomEvent('pantopus:identity-analytics', {
    detail: { eventName, properties: payload },
  }));

  try {
    analyticsWindow.analytics?.track?.(eventName, payload);
    analyticsWindow.posthog?.capture?.(eventName, payload);
    analyticsWindow.gtag?.('event', eventName, payload);
  } catch {
    // Product analytics are best-effort and must never affect privacy flows.
  }
}
