"use client";

// C5 — Booking landing / booker profile header. Pillar-themed gradient banner,
// host avatar with a verified check, name + headline + blurb, a share affordance
// (opens the W0 ShareLink in a bottom sheet) and the dismissible open-in-app
// banner. Reuses W0 ShareLink + pillarTokens; never hardcodes colors.

import { useState } from "react";
import { Check, Share2, Smartphone, X } from "lucide-react";
import clsx from "clsx";
import type { PublicPageView } from "@pantopus/types";
import { ShareLink, pillarTokens, type Pillar } from "@/components/scheduling";
import BottomSheet from "@/components/ui/BottomSheet";
import OpenInAppButton from "@/components/public-share/OpenInAppButton";
import {
  PILLAR_AVATAR,
  PILLAR_BANNER,
  hostNameFrom,
  initialsFromName,
} from "./discoveryUtils";

interface BookerProfileHeaderProps {
  page: PublicPageView;
  pillar: Pillar;
  /** Absolute avatar URL (resolved server-side), or null for initials. */
  avatarUrl: string | null;
  /** Canonical https URL for this booking page (share + open-in-app). */
  pageUrl: string;
  /** pantopus:/// deep link for this page. */
  appUrl: string;
  /** Store download fallback (resolved from the request UA). */
  fallbackUrl: string | null;
  /**
   * Whether to show the open-in-app banner. Design restricts it to multi-type
   * landing pages only (FrameMulti) — single, paused, empty, loading, and error
   * frames all omit it.
   */
  showAppBanner?: boolean;
}

export default function BookerProfileHeader({
  page,
  pillar,
  avatarUrl,
  pageUrl,
  appUrl,
  fallbackUrl,
  showAppBanner = false,
}: BookerProfileHeaderProps) {
  const tk = pillarTokens(pillar);
  const [shareOpen, setShareOpen] = useState(false);
  const [appBannerOpen, setAppBannerOpen] = useState(true);
  const name = hostNameFrom(page.title, "Pantopus host");

  return (
    <header>
      {/* Pillar gradient banner with soft light glows. */}
      <div
        className={clsx(
          "relative h-28 w-full overflow-hidden rounded-t-2xl",
          PILLAR_BANNER[pillar],
        )}
      >
        <div className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/25 blur-xl" />
        <div className="absolute -bottom-10 left-6 h-32 w-32 rounded-full bg-white/20 blur-xl" />
      </div>

      <div className="-mt-9 px-4">
        <div className="relative rounded-2xl border border-app-border bg-app-surface p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="-mt-12 relative">
              {avatarUrl ? (
                // Native img keeps public avatars working across storage hosts.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-16 w-16 rounded-full border-[3px] border-app-surface object-cover shadow-sm"
                />
              ) : (
                <span
                  className={clsx(
                    "flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-app-surface text-lg font-bold text-white shadow-sm",
                    PILLAR_AVATAR[pillar],
                  )}
                >
                  {initialsFromName(name)}
                </span>
              )}
              <span
                className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-app-surface bg-app-success"
                aria-label="Verified host"
              >
                <Check
                  className="h-2.5 w-2.5 text-white"
                  strokeWidth={4}
                  aria-hidden
                />
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShareOpen(true)}
              aria-label="Share this booking page"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-app-border bg-app-surface text-app-text-secondary hover:bg-app-hover"
            >
              <Share2 className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <h1 className="mt-2.5 text-lg font-bold tracking-tight text-app-text">
            {name}
          </h1>
          {page.tagline && (
            <p className={clsx("mt-0.5 text-sm font-semibold", tk.text)}>
              {page.tagline}
            </p>
          )}
          {page.intro && (
            <p className="mt-2 text-sm leading-relaxed text-app-text-secondary">
              {page.intro}
            </p>
          )}
        </div>
      </div>

      {showAppBanner && appBannerOpen && (
        <div className="mx-4 mt-3 flex items-center gap-2.5 rounded-2xl border border-app-info-light bg-app-info-bg px-3 py-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-app-surface text-app-info">
            <Smartphone className="h-4 w-4" aria-hidden />
          </span>
          <p className="min-w-0 flex-1 text-xs font-semibold text-app-text">
            Get a faster booking experience
          </p>
          <OpenInAppButton
            appUrl={appUrl}
            linkHref={pageUrl}
            fallbackUrl={fallbackUrl}
            className="shrink-0 rounded-lg bg-app-info px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
          >
            Open
          </OpenInAppButton>
          <button
            type="button"
            onClick={() => setAppBannerOpen(false)}
            aria-label="Dismiss"
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-app-text-muted hover:text-app-text"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}

      <BottomSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Share this booking page"
      >
        <ShareLink
          url={pageUrl}
          label="Booking link"
          shareTitle={`Book time with ${name}`}
          pillar={pillar}
        />
      </BottomSheet>
    </header>
  );
}
