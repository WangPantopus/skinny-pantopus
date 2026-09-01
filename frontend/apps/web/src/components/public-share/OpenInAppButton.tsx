'use client';

import { useCallback } from 'react';
import type { MouseEvent, ReactNode } from 'react';

/** Strip leading `www.` so apex and www count as the same site (shared links often differ from the bar). */
function canonicalSiteHost(hostname: string): string {
  return hostname.replace(/^www\./i, '').toLowerCase();
}

/**
 * Use https universal URL instead of `pantopus://` when it is safe — avoids Safari’s
 * “address is invalid” for custom schemes when the app is not installed.
 * Same registrable host with or without `www` counts as the same site; localhost still
 * must match exactly so dev doesn’t jump to prod.
 */
function universalUrlIfSameOrigin(linkHref: string | null | undefined): string | null {
  if (!linkHref || typeof window === 'undefined') return null;
  try {
    const u = new URL(linkHref);
    const page = window.location;
    if (u.protocol !== 'https:' || page.protocol !== 'https:') return null;

    const linkHost = canonicalSiteHost(u.hostname);
    const pageHost = canonicalSiteHost(page.hostname);

    if (linkHost === pageHost) {
      return u.href;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * If the user is already on this exact public page in Safari, `location.assign(https)`
 * mostly reloads the same URL — it feels like a “jump”, often does **not** open the app,
 * and `pagehide` can cancel the App Store fallback. In that case use the custom scheme
 * so the open-app / store flow still runs.
 */
function pickOpenTargetUrl(linkHref: string | null | undefined, appUrl: string): string {
  const universal = universalUrlIfSameOrigin(linkHref ?? null);
  if (!universal) return appUrl;
  try {
    const target = new URL(universal);
    const here = new URL(window.location.href);
    if (
      target.pathname === here.pathname &&
      target.search === here.search
    ) {
      return appUrl;
    }
  } catch {
    /* ignore */
  }
  return universal;
}

type OpenInAppButtonProps = {
  /** Custom scheme when `linkHref` is missing or points at another origin (e.g. pantopus:///post/…). */
  appUrl: string;
  /**
   * Canonical https URL for this screen. Used for navigation and `href` only when its
   * origin matches `window.location` (production/staging). Otherwise ignored to avoid
   * jumping from local dev to prod and hitting 404.
   */
  linkHref?: string | null;
  /** App Store / Play Store URL when the app is not installed (unchanged behavior). */
  fallbackUrl?: string | null;
  className?: string;
  children: ReactNode;
};

export default function OpenInAppButton({
  appUrl,
  linkHref,
  fallbackUrl,
  className,
  children,
}: OpenInAppButtonProps) {
  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();

      let didLeavePage = false;

      const markHidden = () => {
        didLeavePage = true;
      };

      const cleanup = () => {
        window.removeEventListener('pagehide', markHidden);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
          markHidden();
        }
      };

      window.addEventListener('pagehide', markHidden, { once: true });
      document.addEventListener('visibilitychange', handleVisibilityChange);

      const fallbackTimer = window.setTimeout(() => {
        cleanup();
        if (!didLeavePage && fallbackUrl) {
          window.location.assign(fallbackUrl);
        }
      }, 1200);

      window.setTimeout(() => {
        if (didLeavePage) {
          window.clearTimeout(fallbackTimer);
          cleanup();
        }
      }, 1400);

      const targetUrl = pickOpenTargetUrl(linkHref ?? null, appUrl);
      window.location.assign(targetUrl);
    },
    [appUrl, linkHref, fallbackUrl]
  );

  return (
    <a href={linkHref || appUrl} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}
