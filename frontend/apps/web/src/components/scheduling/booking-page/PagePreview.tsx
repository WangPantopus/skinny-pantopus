"use client";

// C2 — Public booking page preview. The owner flips into a read-only "preview as
// invitee" render wrapped in dark preview chrome. It fetches the REAL public read
// (GET /api/public/book/:slug via the publicBooking namespace) so paused / hidden
// states render honestly — nothing here is bookable. W4 owns only this preview;
// the live public flow (book/[slug]) belongs to W5/W6/W7.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  CalendarOff,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  HelpCircle,
  MapPin,
  Moon,
  Phone,
  RefreshCw,
  Video,
  X,
} from "lucide-react";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import { publicBooking, scheduling } from "@pantopus/api";
import type { PublicBookingPage, PublicEventType } from "@pantopus/types";
import { buildBookingPageUrl } from "@pantopus/utils";
import { useSchedulingOwner } from "@/components/scheduling/SchedulingOwnerProvider";
import {
  pillarForOwner,
  pillarTokens,
} from "@/components/scheduling/pillarTokens";
import { decodeError } from "@/components/scheduling/decodeError";
import ErrorState from "@/components/ui/ErrorState";
import { initialsOf } from "./controls";

type Phase = "loading" | "ready" | "draft" | "error";

function modeMeta(et: PublicEventType): { icon: LucideIcon; label: string } {
  switch (et.location_mode) {
    case "video":
      return { icon: Video, label: "Video call" };
    case "phone":
      return { icon: Phone, label: "Phone call" };
    case "in_person":
      return { icon: MapPin, label: et.location_detail || "In person" };
    case "ask":
      return { icon: HelpCircle, label: "They'll choose" };
    default:
      return { icon: Clock, label: et.location_detail || "Custom" };
  }
}

export default function PagePreview() {
  const owner = useSchedulingOwner();
  const pillar = pillarForOwner(owner.ownerType);
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("loading");
  const [slug, setSlug] = useState<string>("");
  const [data, setData] = useState<PublicBookingPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    setPhase("loading");
    setError(null);
    try {
      const { page } = await scheduling.getBookingPage(owner);
      setSlug(page.slug);
      try {
        const tz =
          typeof Intl !== "undefined"
            ? Intl.DateTimeFormat().resolvedOptions().timeZone
            : undefined;
        const pub = await publicBooking.getPublicPage(page.slug, tz);
        setData(pub);
        setPhase("ready");
      } catch (err) {
        const d = decodeError(err);
        // Draft / not-live pages 404 publicly — show a "not published" notice.
        if (d.kind === "not_found" || d.kind === "unavailable") {
          setPhase("draft");
        } else {
          setError(d.message);
          setPhase("error");
        }
      }
    } catch (err) {
      setError(decodeError(err).message);
      setPhase("error");
    }
  }, [owner]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner.ownerType, owner.ownerId, owner.homeId, reloadKey]);

  if (phase === "error") {
    return (
      <ErrorState
        message={error ?? "Could not load the preview."}
        onRetry={() => setReloadKey((k) => k + 1)}
      />
    );
  }

  const paused = data?.status === "paused";
  const eventTypes = data?.eventTypes ?? [];
  const hidden = phase === "ready" && !paused && eventTypes.length === 0;

  return (
    <div>
      {/* Out-of-frame controls */}
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm font-semibold text-app-text hover:bg-app-hover"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Refresh
        </button>
        {slug && (
          <a
            href={buildBookingPageUrl(slug)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm font-semibold text-app-text hover:bg-app-hover"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            Open public page
          </a>
        )}
      </div>

      <PreviewFrame
        showCta={phase === "ready" && !paused && !hidden}
        onDismiss={() => router.back()}
      >
        {phase === "loading" && <PreviewSkeleton />}

        {phase === "draft" && (
          <Notice
            icon={EyeOff}
            title="Not published yet"
            body="Publish your booking link to see the live preview here."
          >
            <Link
              href="/app/scheduling/booking-page"
              className={clsx(
                "mt-4 inline-flex items-center gap-1.5 text-sm font-semibold",
                pillarTokens(pillar).text,
              )}
            >
              Go to Booking link
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Notice>
        )}

        {paused && (
          <Notice
            icon={Moon}
            title="Your page is paused"
            body="Turn it back on in Booking link to take bookings."
          />
        )}

        {phase === "ready" && !paused && (
          <>
            <PublicHeader
              pillar={pillar}
              name={data?.page.title || "Your name"}
              headline={data?.page.tagline || ""}
              blurb={data?.page.intro || ""}
              avatarUrl={data?.page.avatar_url || undefined}
            />
            {hidden ? (
              <div className="rounded-2xl border border-dashed border-app-border-strong bg-app-surface px-5 py-6 text-center">
                <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-app-surface-sunken text-app-text-secondary">
                  <CalendarOff className="h-5 w-5" aria-hidden />
                </div>
                <p className="text-sm font-semibold text-app-text-strong">
                  No services are visible yet
                </p>
                <p className="mx-auto mt-1 max-w-[210px] text-xs text-app-text-secondary">
                  Turn one on so people see something to book.
                </p>
              </div>
            ) : (
              eventTypes.map((et, i) => (
                <EventTypeCard key={et.id} et={et} selected={i === 0} />
              ))
            )}
          </>
        )}
      </PreviewFrame>
    </div>
  );
}

// ── Preview chrome ──────────────────────────────────────────────

function PreviewFrame({
  children,
  showCta,
  onDismiss,
}: {
  children: React.ReactNode;
  showCta: boolean;
  onDismiss?: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-[360px]">
      <div className="overflow-hidden rounded-[28px] border border-app-border bg-app shadow-xl">
        {/* dark preview bar — bg-app-text = #111827 (fg1) per design */}
        <div className="bg-app-text px-4 py-3">
          <div className="flex items-center gap-2 text-app-text-inverse">
            <Eye className="h-4 w-4 shrink-0" aria-hidden />
            <span className="flex-1 text-sm font-semibold">
              Previewing your booking page
            </span>
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Exit preview"
                className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full"
                style={{ background: "rgba(255,255,255,0.12)" }}
              >
                <X className="h-[15px] w-[15px]" strokeWidth={2.4} aria-hidden />
              </button>
            )}
          </div>
        </div>
        {/* preview-only caption */}
        <div className="flex justify-center pt-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-app-surface-sunken px-3 py-1 text-[11px] font-semibold text-app-text-secondary">
            <EyeOff className="h-3 w-3" aria-hidden />
            Preview only. Nothing here is bookable.
          </span>
        </div>
        {/* inert public render */}
        <div
          className="flex max-h-[560px] min-h-[420px] flex-col gap-3.5 overflow-auto px-4 pb-5 pt-3"
          aria-hidden
        >
          <div className="pointer-events-none flex flex-1 flex-col gap-3.5 select-none">
            {children}
          </div>
        </div>
        {showCta && (
          <div className="border-t border-app-border bg-app-surface/95 px-4 py-3 backdrop-blur">
            <div className="flex w-full cursor-default items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-bold text-white opacity-95">
              Pick a time
              <ArrowRight className="h-4 w-4" aria-hidden />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PublicHeader({
  pillar,
  name,
  headline,
  blurb,
  avatarUrl,
}: {
  pillar: "personal" | "home" | "business";
  name: string;
  headline?: string;
  blurb?: string;
  avatarUrl?: string;
}) {
  const tk = pillarTokens(pillar);
  const grad =
    pillar === "business"
      ? "linear-gradient(135deg,#a78bfa,#7c3aed)"
      : pillar === "home"
        ? "linear-gradient(135deg,#4ade80,#16a34a)"
        : "linear-gradient(135deg,#38bdf8,#0284c7)";
  return (
    <div className="flex flex-col items-center gap-1 pt-1 text-center">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          className="mb-1.5 h-16 w-16 rounded-full object-cover shadow"
        />
      ) : (
        <div
          className="mb-1.5 flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white shadow"
          style={{ background: grad }}
        >
          {initialsOf(name)}
        </div>
      )}
      <div className="text-lg font-bold text-app-text-strong">{name}</div>
      {headline && (
        <div className={clsx("text-sm font-semibold", tk.text)}>{headline}</div>
      )}
      {blurb && (
        <div className="mt-1 max-w-[230px] text-xs leading-relaxed text-app-text-secondary">
          {blurb}
        </div>
      )}
    </div>
  );
}

function EventTypeCard({
  et,
  selected,
}: {
  et: PublicEventType;
  selected?: boolean;
}) {
  const { icon: Icon, label } = modeMeta(et);
  const ModeIcon = Icon;
  return (
    <div
      className={clsx(
        "flex items-center gap-3 rounded-2xl border bg-app-surface p-3",
        selected
          ? "border-primary-600 ring-2 ring-primary-600/10"
          : "border-app-border",
      )}
    >
      <span
        className={clsx(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          selected
            ? "bg-primary-50 text-primary-600"
            : "bg-app-surface-sunken text-app-text-secondary",
        )}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-app-text-strong">
          {et.name}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs text-app-text-secondary">
            <Clock className="h-3 w-3" aria-hidden />
            {et.default_duration} min
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-bold text-primary-700">
            <ModeIcon className="h-2.5 w-2.5" aria-hidden />
            {label}
          </span>
        </div>
      </div>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-app-text-muted"
        aria-hidden
      />
    </div>
  );
}

function Notice({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-app-surface-sunken text-app-text-secondary">
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <div className="text-base font-bold text-app-text-strong">{title}</div>
      <div className="mt-1.5 max-w-[220px] text-xs leading-relaxed text-app-text-secondary">
        {body}
      </div>
      {children}
    </div>
  );
}

function PreviewSkeleton() {
  return (
    <div className="flex flex-col items-center gap-2.5 pt-2">
      <div className="h-16 w-16 animate-pulse rounded-full bg-app-surface-muted" />
      <div className="mt-1 h-4 w-36 animate-pulse rounded bg-app-surface-muted" />
      <div className="h-3 w-28 animate-pulse rounded bg-app-surface-muted" />
      <div className="mt-3 h-16 w-full animate-pulse rounded-2xl bg-app-surface-muted" />
      <div className="h-16 w-full animate-pulse rounded-2xl bg-app-surface-muted" />
      <div className="h-16 w-full animate-pulse rounded-2xl bg-app-surface-muted" />
    </div>
  );
}
