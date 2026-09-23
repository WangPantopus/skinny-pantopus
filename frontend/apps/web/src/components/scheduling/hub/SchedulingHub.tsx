"use client";

// A1 — Scheduling Hub. The owner-polymorphic front door: an identity switcher
// re-scopes Personal / Home / Business, the booking link is the hero, a master
// pause toggle opens/pauses bookings, a Today & upcoming agenda, and A14.3
// manage rows. Powered by GET /booking-page + /bookings/summary + /event-types
// + /bookings. States: loading · first-run · loaded · paused · unavailable.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import {
  ArrowRight,
  CalendarPlus,
  Clock,
  Inbox,
  Info,
  LayoutGrid,
  Settings,
  Share2,
  Users,
  Wand2,
} from "lucide-react";
import type { Booking, BookingPage, EventType } from "@pantopus/types";
import * as api from "@pantopus/api";
import { useSchedulingOwner } from "@/components/scheduling/SchedulingOwnerProvider";
import { PillarThemeProvider } from "@/components/scheduling/PillarThemeProvider";
import {
  pillarForOwner,
  pillarTokens,
  type Pillar,
} from "@/components/scheduling/pillarTokens";
import { decodeError } from "@/components/scheduling/decodeError";
import ErrorState from "@/components/ui/ErrorState";
import { toast } from "@/components/ui/toast-store";
import { confirmStore } from "@/components/ui/confirm-store";
import BookingLinkCard from "./BookingLinkCard";
import AcceptingBookingsCard from "./AcceptingBookingsCard";
import SchedulingSummaryCard from "./SchedulingSummaryCard";
import AgendaSection from "./AgendaSection";
import ManageRows, { type ManageItem } from "./ManageRows";
import HubSkeleton from "./HubSkeleton";
import IdentitySwitcher from "./IdentitySwitcher";
import { useHubOwners } from "./owners";

const BASE = "/app/scheduling";

export default function SchedulingHub() {
  const router = useRouter();
  const routeOwner = useSchedulingOwner();
  const { owners, loading: ownersLoading } = useHubOwners();
  const [pillar, setPillar] = useState<Pillar>(
    pillarForOwner(routeOwner.ownerType),
  );

  const owner = owners[pillar].owner;

  const [page, setPage] = useState<BookingPage | null>(null);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const loadGeneration = useRef(0);

  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    if (!owner) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setAccessDenied(false);
    setCanEdit(false);
    setBusy(false);
    try {
      const { page: loaded } = await api.scheduling.getBookingPage(owner);
      if (generation !== loadGeneration.current) return;
      let editable = true;
      if (owner.ownerType === "home") {
        try {
          const access = await api.homeIam.getMyHomeAccess(owner.homeId!);
          editable = access.hasAccess && access.permissions.includes("calendar.edit");
        } catch {
          if (generation !== loadGeneration.current) return;
          setError("Couldn't check your Home scheduling access. Try again.");
          return;
        }
      }
      if (generation !== loadGeneration.current) return;
      setCanEdit(editable);
      setPage(loaded);
      // Enrichment — tolerate failures (e.g. view-only contexts).
      const [etRes, upRes, pendRes] = await Promise.allSettled([
        api.scheduling.listEventTypes(owner),
        api.scheduling.listBookings({ status: "upcoming" }, owner),
        api.scheduling.listBookings({ status: "pending" }, owner),
      ]);
      if (generation !== loadGeneration.current) return;
      setEventTypes(etRes.status === "fulfilled" ? etRes.value.eventTypes : []);
      const upcoming = upRes.status === "fulfilled" ? upRes.value.bookings : [];
      const pending =
        pendRes.status === "fulfilled" ? pendRes.value.bookings : [];
      setPendingCount(pending.length);
      setBookings([...upcoming, ...pending].slice(0, 12));
    } catch (err) {
      if (generation !== loadGeneration.current) return;
      const denied = (err as { statusCode?: number })?.statusCode === 403;
      setAccessDenied(denied);
      setError(denied
        ? "You don't have access to this scheduling hub. Ask an owner for access, or choose another profile above."
        : decodeError(err).message);
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }, [owner]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchPage = useCallback(
    async (
      patch: Parameters<typeof api.scheduling.updateBookingPage>[0],
      successMsg: string,
    ) => {
      if (!owner || !canEdit) return;
      const generation = loadGeneration.current;
      setBusy(true);
      try {
        const { page: updated } = await api.scheduling.updateBookingPage(
          patch,
          owner,
        );
        if (generation !== loadGeneration.current) return;
        setPage(updated);
        toast.success(successMsg);
      } catch (err) {
        if (generation !== loadGeneration.current) return;
        const decoded = decodeError(err);
        toast.error(decoded.message || "Something went wrong");
      } finally {
        if (generation === loadGeneration.current) setBusy(false);
      }
    },
    [owner, canEdit],
  );

  const handleTogglePause = useCallback(
    (nextPaused: boolean) => {
      void patchPage(
        { is_paused: nextPaused },
        nextPaused ? "Bookings paused" : "Bookings resumed",
      );
    },
    [patchPage],
  );

  const handleTurnOn = useCallback(() => {
    void patchPage(
      { is_live: true, is_paused: false },
      "Your booking page is live",
    );
  }, [patchPage]);

  const handleRegenerate = useCallback(async () => {
    if (!owner || !canEdit) return;
    const generation = loadGeneration.current;
    const ok = await confirmStore.open({
      title: "Regenerate booking link?",
      description:
        "Your current link will stop working immediately. Anyone you’ve already shared it with will need the new one.",
      confirmLabel: "Regenerate",
      cancelLabel: "Keep current",
      variant: "destructive",
    });
    if (!ok || generation !== loadGeneration.current) return;
    setBusy(true);
    try {
      const { page: updated } = await api.scheduling.resetSlug(owner);
      if (generation !== loadGeneration.current) return;
      setPage(updated);
      toast.success("New booking link generated");
    } catch (err) {
      if (generation !== loadGeneration.current) return;
      toast.error(decodeError(err).message || "Couldn’t regenerate the link");
    } finally {
      if (generation === loadGeneration.current) setBusy(false);
    }
  }, [owner, canEdit]);

  const ownerName = owners[pillar].name;
  const subtitle =
    pillar === "personal"
      ? "Your booking link and upcoming bookings"
      : ownerName;

  const manageItems: ManageItem[] = useMemo(() => {
    const activeTypes = eventTypes.filter((e) => e.is_active).length;
    const items: ManageItem[] = [
      {
        icon: LayoutGrid,
        label: "Event types",
        href: `${BASE}/event-types`,
        value: activeTypes ? `${activeTypes} active` : undefined,
      },
      pillar === "home"
        ? {
            icon: Users,
            label: "Member availability",
            href: `${BASE}/availability`,
          }
        : { icon: Clock, label: "Availability", href: `${BASE}/availability` },
      {
        icon: CalendarPlus,
        label: "Connected calendars",
        href: `${BASE}/connected-calendars`,
      },
      {
        icon: Inbox,
        label: "Bookings",
        href: `${BASE}/bookings`,
        value: pendingCount ? `${pendingCount} need approval` : undefined,
        alert: pendingCount > 0,
      },
      {
        icon: Settings,
        label: "Settings",
        href:
          pillar === "personal"
            ? `${BASE}/settings`
            : `${BASE}/settings?pillar=${pillar}`,
      },
    ];
    return items;
  }, [eventTypes, pendingCount, pillar]);

  const Header = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-app-text">Scheduling</h1>
        <p className="truncate text-sm text-app-text-secondary">{subtitle}</p>
      </div>
      <div className="sm:w-[340px] sm:shrink-0">
        <IdentitySwitcher active={pillar} onSelect={setPillar} />
      </div>
    </div>
  );

  // Non-personal pillar with no resolved owner → first-class "not set up" state.
  const showUnavailable = pillar !== "personal" && !owner && !ownersLoading;
  const isLoading = loading || (pillar !== "personal" && ownersLoading);
  const needsSetup = !!page && eventTypes.length === 0;

  return (
    <PillarThemeProvider pillar={pillar}>
      <div className="relative space-y-5 pb-24">
        {Header}

        {showUnavailable ? (
          <UnavailablePillar pillar={pillar} />
        ) : isLoading ? (
          <HubSkeleton />
        ) : error ? (
          <ErrorState
            title={accessDenied ? "Scheduling access needed" : undefined}
            message={error}
            onRetry={() => void load()}
          />
        ) : !page ? (
          <ErrorState
            message="No booking page found."
            onRetry={() => void load()}
          />
        ) : needsSetup ? (
          <FirstRunHub
            pillar={pillar}
            readOnly={!canEdit}
            onSetup={() =>
              router.push(
                pillar === "personal"
                  ? `${BASE}/setup`
                  : `${BASE}/setup/onboarding?pillar=${pillar}`,
              )
            }
          />
        ) : (
          <>
            {!canEdit && (
              <div className="flex items-center gap-2 rounded-xl bg-app-info-bg px-3 py-3 text-xs text-app-text-strong">
                <Info className="h-4 w-4 shrink-0 text-app-info" aria-hidden />
                You have view-only access. Ask an owner to make changes.
              </div>
            )}
            {/* A5 summary card — sits atop the rest of the Hub per design */}
            {owner && (
              <SchedulingSummaryCard
                owner={owner}
                pillar={pillar}
                eventTypes={eventTypes}
                readOnly={!canEdit}
                onShare={canEdit ? () => router.push(`${BASE}/booking-page`) : undefined}
              />
            )}
            <BookingLinkCard
              page={page}
              pillar={pillar}
              name={page.title || ownerName}
              role={page.tagline || "Book time"}
              readOnly={!canEdit}
              eventTypeSlug={eventTypes.find((type) => type.is_active)?.slug}
              onTurnOn={handleTurnOn}
              onRegenerate={handleRegenerate}
            />
            <AcceptingBookingsCard
              page={page}
              pillar={pillar}
              busy={busy}
              readOnly={!canEdit}
              onTogglePause={handleTogglePause}
            />
            <AgendaSection
              bookings={bookings}
              eventTypes={eventTypes}
              tz={page.timezone}
              paused={page.is_paused}
              readOnly={!canEdit}
            />
            <ManageRows items={manageItems} readOnly={!canEdit} />
            {/* pinned footer CTA — matches design FooterCTA; pb-28 on wrapper accounts for this */}
            {canEdit && <HubFooterCTA
              pillar={pillar}
              paused={page.is_paused}
              onShare={() => router.push(`${BASE}/booking-page`)}
              onResume={() => handleTogglePause(false)}
            />}
          </>
        )}
      </div>
    </PillarThemeProvider>
  );
}

/** A1 design FooterCTA — pillar-accented, pinned to bottom of the hub scroll area. */
function HubFooterCTA({
  pillar,
  paused,
  onShare,
  onResume,
}: {
  pillar: Pillar;
  paused: boolean;
  onShare: () => void;
  onResume: () => void;
}) {
  const tk = pillarTokens(pillar);
  return (
    <div className="fixed bottom-[var(--fab-lift,0px)] left-0 right-0 z-20 border-t border-app-border bg-white/90 px-4 pb-6 pt-3 backdrop-blur-md">
      <button
        type="button"
        onClick={paused ? onResume : onShare}
        className={clsx(
          "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14.5px] font-bold text-white shadow-lg",
          tk.bg,
        )}
      >
        <Share2 className="h-[17px] w-[17px]" strokeWidth={2.2} aria-hidden />
        {paused ? "Resume bookings" : "Share booking link"}
      </button>
    </div>
  );
}

function FirstRunHub({
  pillar,
  readOnly,
  onSetup,
}: {
  pillar: Pillar;
  onSetup: () => void;
  readOnly?: boolean;
}) {
  const tk = pillarTokens(pillar);
  return (
    <div>
      <div className="flex flex-col items-center px-6 pb-2 pt-6 text-center">
        <div
          className={clsx(
            "mb-4 flex h-20 w-20 items-center justify-center rounded-full",
            tk.bgSoft,
            tk.text,
          )}
        >
          <CalendarPlus className="h-9 w-9" strokeWidth={1.7} aria-hidden />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-app-text">
          {readOnly ? "No event types yet" : "Set up your booking link"}
        </h2>
        <p className="mt-2 max-w-sm text-[13px] leading-5 text-app-text-secondary">
          {readOnly ? "You have view-only access. Ask an owner to set up scheduling." : "Create a link anyone can use to book time with you. Pick your hours and the meeting types you offer."}
        </p>
      </div>

      {!readOnly && <div className="mt-4 rounded-2xl border border-app-warning-light bg-app-warning-bg p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-app-warning-bg text-app-warning ring-1 ring-app-warning-light">
            <Wand2 className="h-[19px] w-[19px]" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-app-text">Three quick steps</p>
            <p className="mt-0.5 text-xs leading-4 text-app-text-strong">
              Set your hours, add a meeting type, then share your link.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onSetup}
          className={clsx(
            "mt-3.5 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold shadow-sm",
            tk.bg,
            tk.textOn,
          )}
        >
          Set up your booking link
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </div>}

      <div className="mt-5 space-y-2 opacity-50">
        {[
          { icon: LayoutGrid, label: "Event types" },
          { icon: Clock, label: "Availability" },
          { icon: CalendarPlus, label: "Connected calendars" },
        ].map((r) => (
          <div
            key={r.label}
            className="flex items-center gap-3 rounded-xl border border-dashed border-app-border-strong bg-app-surface px-3.5 py-3"
          >
            <r.icon
              className="h-[18px] w-[18px] text-app-text-muted"
              aria-hidden
            />
            <span className="flex-1 text-[13px] font-semibold text-app-text-secondary">
              {r.label}
            </span>
            <span className="text-[11px] font-semibold text-app-text-muted">
              Not set up
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function UnavailablePillar({ pillar }: { pillar: Pillar }) {
  const tk = pillarTokens(pillar);
  const label = pillar === "home" ? "household" : "business";
  return (
    <div className="flex flex-col items-center rounded-2xl border border-app-border bg-app-surface px-6 py-12 text-center">
      <div
        className={clsx(
          "mb-4 flex h-16 w-16 items-center justify-center rounded-full",
          tk.bgSoft,
          tk.text,
        )}
      >
        <CalendarPlus className="h-7 w-7" aria-hidden />
      </div>
      <h2 className="text-lg font-semibold text-app-text">
        No {label} scheduling yet
      </h2>
      <p className="mt-1 max-w-xs text-sm text-app-text-secondary">
        {pillar === "home"
          ? "Join or create a household to schedule for your family."
          : "Set up a business profile to take bookings for your team."}
      </p>
      <Link
        href={pillar === "home" ? "/app/homes" : "/app/businesses"}
        className={clsx(
          "mt-5 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold",
          tk.bg,
          tk.textOn,
        )}
      >
        {pillar === "home" ? "Go to homes" : "Go to businesses"}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}
