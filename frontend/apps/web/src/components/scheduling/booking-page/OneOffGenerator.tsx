"use client";

// C4 — One-off / single-use link generator. Configures an event type, expiry,
// single-use, and optional offered times, then POST /booking-page/one-off-links
// → { token, path, expires_at, single_use }. The result URL is shown with copy +
// share targets. Functional chrome stays sky; the pillar chip marks the owner.

import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  CalendarClock,
  CalendarPlus,
  Check,
  CircleAlert,
  ClipboardList,
  Copy,
  Link as LinkIcon,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  RotateCcw,
  Share2,
  Ticket,
  User,
  Video,
  X,
} from "lucide-react";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import { scheduling } from "@pantopus/api";
import type { EventType, OneOffLink } from "@pantopus/types";
import {
  APP_WEB_URL,
  buildOneOffBookingPath,
  copyToClipboard,
} from "@pantopus/utils";
import { useSchedulingOwner } from "@/components/scheduling/SchedulingOwnerProvider";
import {
  pillarForOwner,
  pillarTokens,
} from "@/components/scheduling/pillarTokens";
import { decodeError } from "@/components/scheduling/decodeError";
import ErrorState from "@/components/ui/ErrorState";
import EmptyState from "@/components/ui/EmptyState";
import { toast } from "@/components/ui/toast-store";
import { Card, Chips, Toggle } from "./controls";
import { EXPIRY_OPTIONS, buildOfferedSlots } from "./logic";

function locationIcon(mode: EventType["location_mode"]): LucideIcon {
  if (mode === "video") return Video;
  if (mode === "phone") return Phone;
  if (mode === "in_person") return MapPin;
  return CalendarClock;
}

function fullUrl(link: OneOffLink): string {
  if (link.path) return `${APP_WEB_URL}${link.path}`;
  return `${APP_WEB_URL}${buildOneOffBookingPath(link.token)}`;
}

function fmtExpiry(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface OfferedSlot {
  id: string;
  startLocal: string; // value of <input type="datetime-local">
}

export default function OneOffGenerator() {
  const owner = useSchedulingOwner();
  const pillar = pillarForOwner(owner.ownerType);

  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [selectedId, setSelectedId] = useState<string>("");
  const [expiresMin, setExpiresMin] = useState<string>(String(7 * 24 * 60));
  const [singleUse, setSingleUse] = useState(true);
  const [askIntake, setAskIntake] = useState(false);
  const [offerTimes, setOfferTimes] = useState(false);
  const [slots, setSlots] = useState<OfferedSlot[]>([]);

  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [result, setResult] = useState<OneOffLink | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    scheduling
      .listEventTypes(owner)
      .then((res) => {
        if (cancelled) return;
        const list = res.eventTypes ?? [];
        setEventTypes(list);
        setSelectedId((prev) => prev || list[0]?.id || "");
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(decodeError(err).message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner.ownerType, owner.ownerId, owner.homeId, reloadKey]);

  const selected = useMemo(
    () => eventTypes.find((e) => e.id === selectedId) ?? null,
    [eventTypes, selectedId],
  );

  const addSlot = () =>
    setSlots((s) => [
      ...s,
      { id: Math.random().toString(36).slice(2), startLocal: "" },
    ]);
  const updateSlot = (id: string, startLocal: string) =>
    setSlots((s) => s.map((x) => (x.id === id ? { ...x, startLocal } : x)));
  const removeSlot = (id: string) =>
    setSlots((s) => s.filter((x) => x.id !== id));

  const generate = async () => {
    if (!selectedId || generating) return;
    setGenerating(true);
    setGenError(null);
    try {
      const link = await scheduling.createOneOffLink(
        {
          event_type_id: selectedId,
          expires_in_min: Number(expiresMin),
          single_use: singleUse,
          offered_slots: buildOfferedSlots(
            slots,
            selected?.default_duration ?? 30,
            offerTimes,
          ),
        },
        owner,
      );
      setResult(link);
      setCopied(false);
    } catch (err) {
      setGenError(decodeError(err).message);
    } finally {
      setGenerating(false);
    }
  };

  const reset = () => {
    setResult(null);
    setGenError(null);
    setCopied(false);
  };

  const copy = async () => {
    if (!result) return;
    const ok = await copyToClipboard(fullUrl(result));
    if (ok) {
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Could not copy the link");
    }
  };

  // ── Loading / error / empty ─────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl border border-app-border bg-app-surface"
          />
        ))}
      </div>
    );
  }
  if (loadError) {
    return (
      <ErrorState
        message={loadError}
        onRetry={() => setReloadKey((k) => k + 1)}
      />
    );
  }
  if (eventTypes.length === 0) {
    return (
      <EmptyState
        icon={CalendarPlus}
        title="Add a service first"
        description="One-off links book a specific service. Create one to get started."
        actionLabel="Go to services"
        onAction={() => {
          window.location.href = "/app/scheduling/event-types";
        }}
      />
    );
  }

  // ── Result ──────────────────────────────────────────────────
  if (result) {
    const url = fullUrl(result);
    return (
      <div className="space-y-4">
        <Card>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-app-success text-white ring-4 ring-app-success/15">
              <Check className="h-5 w-5" strokeWidth={3} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-app-text-strong">
                Link ready
              </p>
              <p className="mt-0.5 text-xs text-app-text-secondary">
                {result.single_use
                  ? "A private link for one person."
                  : "A private link you can reuse."}
              </p>
            </div>
          </div>
        </Card>

        <div className="flex items-center gap-2 rounded-2xl border border-app-border bg-app-surface p-2 pl-3 shadow-sm">
          <span className="min-w-0 flex-1 truncate font-mono text-[13px] font-semibold text-app-text-strong">
            {url}
          </span>
          <button
            type="button"
            onClick={copy}
            className={clsx(
              "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-bold text-white",
              copied ? "bg-app-success" : "bg-primary-600 hover:bg-primary-700",
            )}
          >
            {copied ? (
              <Check className="h-4 w-4" aria-hidden />
            ) : (
              <Copy className="h-4 w-4" aria-hidden />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <div className="inline-flex flex-wrap items-center gap-2 rounded-full bg-app-surface-sunken px-3 py-1.5 text-xs font-semibold text-app-text-secondary">
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden />
            Expires {fmtExpiry(result.expires_at)}
          </span>
          <span className="h-1 w-1 rounded-full bg-app-text-muted" />
          <span className="inline-flex items-center gap-1.5">
            <Ticket className="h-3.5 w-3.5" aria-hidden />
            {result.single_use ? "Single use" : "Reusable"}
          </span>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-app-text-muted">
            Send via
          </p>
          <div className="flex gap-2.5">
            <ShareTarget
              icon={Share2}
              label="Share"
              onClick={async () => {
                if (typeof navigator !== "undefined" && navigator.share) {
                  try {
                    await navigator.share({ title: "Book a time", url });
                  } catch {
                    /* dismissed */
                  }
                } else {
                  copy();
                }
              }}
            />
            <ShareTarget
              icon={MessageCircle}
              label="Messages"
              href={`sms:?&body=${encodeURIComponent(url)}`}
            />
            <ShareTarget
              icon={Mail}
              label="Email"
              href={`mailto:?subject=${encodeURIComponent(
                "Book a time with me",
              )}&body=${encodeURIComponent(url)}`}
            />
          </div>
        </div>

        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-primary-600 hover:text-primary-700"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Create another
          </button>
        </div>
      </div>
    );
  }

  // ── Config ──────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-app-text-secondary">
          Send a private link for one person — it can expire and be limited to a
          single booking.
        </p>
        <PillarChip pillar={pillar} />
      </div>

      <section>
        <SectionLabel>Event type</SectionLabel>
        <div className="space-y-2">
          {eventTypes.map((et) => {
            const Icon = locationIcon(et.location_mode);
            const on = et.id === selectedId;
            return (
              <button
                key={et.id}
                type="button"
                onClick={() => setSelectedId(et.id)}
                aria-pressed={on}
                className={clsx(
                  "flex w-full items-center gap-3 rounded-2xl border bg-app-surface p-3 text-left transition-colors",
                  on
                    ? "border-primary-600 ring-2 ring-primary-600/10"
                    : "border-app-border hover:bg-app-hover",
                )}
              >
                <span
                  className={clsx(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    on
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
                  <div className="mt-0.5 text-xs text-app-text-secondary">
                    {et.default_duration} min
                  </div>
                </div>
                {on && (
                  <Check
                    className="h-4 w-4 shrink-0 text-primary-600"
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {genError && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-app-error/40 bg-app-error-bg p-3">
          <CircleAlert
            className="mt-0.5 h-4 w-4 shrink-0 text-app-error"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-app-error">
              Couldn&apos;t create the link. Try again.
            </p>
            <p className="mt-0.5 text-xs text-app-error/90">
              Your settings are saved — nothing was lost.
            </p>
            <button
              type="button"
              onClick={generate}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-app-error"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Try again
            </button>
          </div>
        </div>
      )}

      <section>
        <SectionLabel>Availability</SectionLabel>
        <Card className="p-0">
          <div
            className={clsx(
              "flex items-center gap-3 p-3",
              offerTimes && "border-b border-app-border",
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-app-text-strong">
                Offer specific times
              </p>
              <p className="mt-0.5 text-xs text-app-text-secondary">
                {offerTimes
                  ? "They pick from the times you propose."
                  : "We'll show your full availability."}
              </p>
            </div>
            <Toggle
              on={offerTimes}
              onChange={setOfferTimes}
              label="Offer specific times"
            />
          </div>
          {offerTimes && (
            <div className="p-3">
              {slots.length === 0 && (
                <p className="mb-2 text-xs text-app-text-secondary">
                  Add one or more times you&apos;re offering.
                </p>
              )}
              <div className="space-y-2">
                {slots.map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <input
                      type="datetime-local"
                      value={s.startLocal}
                      onChange={(e) => updateSlot(s.id, e.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
                    />
                    <button
                      type="button"
                      onClick={() => removeSlot(s.id)}
                      aria-label="Remove time"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-app-text-muted hover:bg-app-hover hover:text-app-text"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addSlot}
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-primary-600 hover:text-primary-700"
              >
                <Plus className="h-4 w-4" aria-hidden />
                Add a time
              </button>
              {selected && (
                <p className="mt-2 text-[11px] text-app-text-muted">
                  Each time runs {selected.default_duration} min (this
                  service&apos;s length).
                </p>
              )}
            </div>
          )}
        </Card>
      </section>

      <section>
        <SectionLabel>Link expires</SectionLabel>
        <Chips
          options={EXPIRY_OPTIONS}
          value={expiresMin}
          onChange={setExpiresMin}
        />
      </section>

      <section>
        <SectionLabel>Options</SectionLabel>
        <Card className="p-0">
          <div className="flex items-center gap-3 border-b border-app-border p-3">
            <span
              className={clsx(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                singleUse
                  ? "bg-primary-50 text-primary-600"
                  : "bg-app-surface-sunken text-app-text-muted",
              )}
            >
              <Ticket className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-app-text-strong">
                Single use
              </p>
              <p className="mt-0.5 text-xs text-app-text-secondary">
                Link stops working after one booking.
              </p>
            </div>
            <Toggle on={singleUse} onChange={setSingleUse} label="Single use" />
          </div>
          <div className="flex items-center gap-3 p-3">
            <span
              className={clsx(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                askIntake
                  ? "bg-primary-50 text-primary-600"
                  : "bg-app-surface-sunken text-app-text-muted",
              )}
            >
              <ClipboardList className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-app-text-strong">
                Ask intake questions
              </p>
              <p className="mt-0.5 text-xs text-app-text-secondary">
                Collect details before they book.
              </p>
            </div>
            <Toggle
              on={askIntake}
              onChange={setAskIntake}
              label="Ask intake questions"
            />
          </div>
        </Card>
      </section>

      <button
        type="button"
        onClick={generate}
        disabled={generating || !selectedId}
        className={clsx(
          "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors",
          generating || !selectedId
            ? "cursor-not-allowed bg-app-surface-sunken text-app-text-muted"
            : "bg-primary-600 text-white hover:bg-primary-700",
        )}
      >
        {generating ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Generating
          </>
        ) : (
          <>
            <LinkIcon className="h-4 w-4" aria-hidden />
            Generate link
          </>
        )}
      </button>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-app-text-muted">
      {children}
    </p>
  );
}

function PillarChip({ pillar }: { pillar: "personal" | "home" | "business" }) {
  const tk = pillarTokens(pillar);
  const Icon = pillar === "business" ? Briefcase : User;
  const label =
    pillar === "business"
      ? "Business"
      : pillar === "home"
        ? "Home"
        : "Personal";
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
        tk.bgSoft,
        tk.text,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}

function ShareTarget({
  icon: Icon,
  label,
  onClick,
  href,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  href?: string;
}) {
  const inner = (
    <>
      <span className="flex aspect-square w-full max-w-[54px] items-center justify-center rounded-2xl border border-app-border bg-app-surface text-primary-600 shadow-sm">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="text-[11px] font-semibold text-app-text-secondary">
        {label}
      </span>
    </>
  );
  const cls = "flex flex-1 flex-col items-center gap-1.5 text-center";
  if (href) {
    return (
      <a href={href} className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}
