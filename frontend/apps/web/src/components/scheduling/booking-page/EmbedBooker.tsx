"use client";

// The embeddable inline booker rendered by /book/[slug]/embed (the iframe target
// the C9 snippet points at). It fetches the public page client-side, lets the
// visitor choose a service and pick a time via the W0 SlotPicker, then hands off
// to the full public booking flow (book/[slug]/[eventType], owned by W5/W6) —
// the booking "starts" here. First-class paused / unavailable states use the W0
// state views. Brand color + hideHeader come from the embed query params.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  HelpCircle,
  MapPin,
  Phone,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { publicBooking } from "@pantopus/api";
import type { PublicBookingPage, PublicEventType } from "@pantopus/types";
import { buildBookingEventPath } from "@pantopus/utils";
import SlotPicker from "@/components/scheduling/SlotPicker";
import PausedView from "@/components/scheduling/states/PausedView";
import UnavailableView from "@/components/scheduling/states/UnavailableView";
import {
  pillarForOwner,
  type Pillar,
} from "@/components/scheduling/pillarTokens";
import { decodeError } from "@/components/scheduling/decodeError";
import { initialsOf } from "./controls";

function detectTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

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

export default function EmbedBooker({
  slug,
  hideHeader = false,
  primary,
}: {
  slug: string;
  hideHeader?: boolean;
  primary?: string;
}) {
  const router = useRouter();
  const [data, setData] = useState<PublicBookingPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorKind, setErrorKind] = useState<"none" | "paused" | "unavailable">(
    "none",
  );
  const [selected, setSelected] = useState<PublicEventType | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    publicBooking
      .getPublicPage(slug, detectTz())
      .then((res) => {
        if (cancelled) return;
        if (res.status === "paused") setErrorKind("paused");
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        const d = decodeError(err);
        setErrorKind(d.kind === "paused" ? "paused" : "unavailable");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const pillar: Pillar = useMemo(
    () => pillarForOwner(data?.page.owner_type),
    [data],
  );

  const accent = primary
    ? ({ "--embed-accent": primary } as React.CSSProperties)
    : undefined;

  if (loading) {
    return (
      <Shell>
        <div className="space-y-3" aria-busy="true">
          <div className="mx-auto h-16 w-16 animate-pulse rounded-full bg-app-surface-muted" />
          <div className="mx-auto h-4 w-40 animate-pulse rounded bg-app-surface-muted" />
          <div className="h-16 w-full animate-pulse rounded-2xl bg-app-surface-muted" />
          <div className="h-16 w-full animate-pulse rounded-2xl bg-app-surface-muted" />
        </div>
      </Shell>
    );
  }

  if (errorKind === "paused") {
    return <PausedView pillar={pillar} />;
  }
  if (errorKind === "unavailable" || !data) {
    return <UnavailableView pillar={pillar} />;
  }

  const eventTypes = data.eventTypes ?? [];

  return (
    <Shell style={accent}>
      {!selected ? (
        <>
          {!hideHeader && (
            <Header
              pillar={pillar}
              name={data.page.title || "Book a time"}
              tagline={data.page.tagline || undefined}
              intro={data.page.intro || undefined}
              avatarUrl={data.page.avatar_url || undefined}
            />
          )}
          {eventTypes.length === 0 ? (
            <p className="rounded-2xl border border-app-border bg-app-surface px-4 py-8 text-center text-sm text-app-text-secondary">
              No services are available to book right now.
            </p>
          ) : (
            <div className="space-y-2.5">
              {eventTypes.map((et) => {
                const { icon: Icon, label } = modeMeta(et);
                return (
                  <button
                    key={et.id}
                    type="button"
                    onClick={() => setSelected(et)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-app-border bg-app-surface p-3.5 text-left transition-colors hover:bg-app-hover"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-app-surface-sunken text-app-text-secondary">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-app-text-strong">
                        {et.name}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-app-text-secondary">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" aria-hidden />
                          {et.default_duration} min
                        </span>
                        <span>· {label}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-app-text-secondary hover:text-app-text"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            All services
          </button>
          <div className="mb-3">
            <h2 className="text-base font-bold text-app-text-strong">
              {selected.name}
            </h2>
            <p className="text-xs text-app-text-secondary">
              {selected.default_duration} min · {modeMeta(selected).label}
            </p>
          </div>
          <SlotPicker
            slug={slug}
            eventTypeSlug={selected.slug}
            pillar={pillar}
            onPick={(slot) =>
              router.push(
                `${buildBookingEventPath(slug, selected.slug)}?start=${encodeURIComponent(
                  slot.start,
                )}`,
              )
            }
          />
        </div>
      )}
    </Shell>
  );
}

function Shell({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className="min-h-screen bg-app-surface" style={style}>
      <div className="mx-auto w-full max-w-md px-4 py-6">{children}</div>
    </div>
  );
}

function Header({
  pillar,
  name,
  tagline,
  intro,
  avatarUrl,
}: {
  pillar: Pillar;
  name: string;
  tagline?: string;
  intro?: string;
  avatarUrl?: string;
}) {
  const grad =
    pillar === "business"
      ? "linear-gradient(135deg,#a78bfa,#7c3aed)"
      : pillar === "home"
        ? "linear-gradient(135deg,#4ade80,#16a34a)"
        : "linear-gradient(135deg,#38bdf8,#0284c7)";
  return (
    <div className="mb-5 flex flex-col items-center gap-1 text-center">
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
      {tagline && (
        <div className="text-sm font-semibold text-app-text-secondary">
          {tagline}
        </div>
      )}
      {intro && (
        <div className="mt-1 max-w-xs text-xs leading-relaxed text-app-text-secondary">
          {intro}
        </div>
      )}
    </div>
  );
}
