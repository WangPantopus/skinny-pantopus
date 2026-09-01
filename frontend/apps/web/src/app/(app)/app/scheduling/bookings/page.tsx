"use client";

// W8 · E1 — Bookings Inbox. Owner-polymorphic home base: every booking across
// Personal / Home / Business, organized by lifecycle. Scope pills re-scope the
// owner context (accent follows scope); a segmented control switches
// Upcoming / Pending / Past / Cancelled with a warning badge on Pending. Rows
// group under day buckets; pending rows offer inline approve/decline. Every
// fetchable surface ships loading / empty / loaded / error+Retry.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  History,
  Inbox as InboxIcon,
  Link2,
  Search,
  UserCheck,
  X,
} from "lucide-react";
import clsx from "clsx";
import * as api from "@pantopus/api";
import type { Booking, SchedulingOwnerRef } from "@pantopus/types";
import { ShimmerBlock } from "@/components/ui/Shimmer";
import ErrorState from "@/components/ui/ErrorState";
import { toast } from "@/components/ui/toast-store";
import { decodeError } from "@/components/scheduling/decodeError";
import {
  pillarForOwner,
  pillarTokens,
  PRIMARY_BLUE_CLS,
  type Pillar,
} from "@/components/scheduling/pillarTokens";
import BookingRow, {
  type InboxRow,
} from "@/components/scheduling/bookings/BookingRow";
import ScopePills from "@/components/scheduling/bookings/ScopePills";
import ShareBookingSheet from "@/components/scheduling/bookings/ShareBookingSheet";
import { SegmentedTabs } from "@/components/scheduling/bookings/primitives";
import { useScopeOwners } from "@/components/scheduling/bookings/useScopeOwners";
import {
  availablePillars,
  ownerQueryString,
  ownersForScope,
  type Scope,
} from "@/components/scheduling/bookings/owners";
import {
  groupBookings,
  viewerTz,
} from "@/components/scheduling/bookings/format";

type Tab = "upcoming" | "pending" | "past" | "cancelled";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "upcoming", label: "Upcoming" },
  { key: "pending", label: "Pending" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
];

function toRow(
  booking: Booking,
  ownerRef: SchedulingOwnerRef,
  ownerName: string,
  eventNames: Record<string, string>,
): Row {
  const pillar = pillarForOwner(booking.owner_type);
  const assignedLabel =
    pillar === "business"
      ? booking.host_user_id
        ? "Assigned"
        : "Unassigned"
      : null;
  return {
    booking,
    pillar,
    ownerLabel: ownerName,
    eventName:
      (booking.event_type_id && eventNames[booking.event_type_id]) ||
      (booking.event_type_id ? "Booking" : "Resource booking"),
    assignedLabel,
    ownerRef,
  };
}

interface Row extends InboxRow {
  ownerRef: SchedulingOwnerRef;
}

export default function BookingsInboxPage() {
  const { owners } = useScopeOwners();
  const tz = useMemo(() => viewerTz(), []);

  const [scope, setScope] = useState<Scope>("all");
  const [tab, setTab] = useState<Tab>("upcoming");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const [phase, setPhase] = useState<"loading" | "error" | "ready">("loading");
  const [rows, setRows] = useState<Row[]>([]);
  const [eventNames, setEventNames] = useState<Record<string, string>>({});
  const [pendingCount, setPendingCount] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const pillars = availablePillars(owners);
  const multiOwner = pillars.length > 1;
  const activePillar: Pillar | null = scope === "all" ? null : scope;
  const tk = activePillar ? pillarTokens(activePillar) : null;
  const accentText = tk ? tk.text : "text-primary-700";

  // Debounce the search query.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  // Owner-scoped meta: event-type names (for row subtitles) + pending badge.
  useEffect(() => {
    let alive = true;
    const targets = ownersForScope(scope, owners);
    if (targets.length === 0) return;
    Promise.allSettled(
      targets.map((t) => api.scheduling.listEventTypes(t.owner)),
    ).then((results) => {
      if (!alive) return;
      const map: Record<string, string> = {};
      for (const r of results) {
        if (r.status === "fulfilled") {
          for (const et of r.value.eventTypes ?? []) map[et.id] = et.name;
        }
      }
      setEventNames(map);
    });
    // Pending badge: the wire summary carries no pendingCount — count the
    // pending list directly (the same query the Pending tab renders).
    Promise.allSettled(
      targets.map((t) =>
        api.scheduling.listBookings({ status: "pending" }, t.owner),
      ),
    ).then((results) => {
      if (!alive) return;
      let n = 0;
      for (const r of results) {
        if (r.status === "fulfilled") n += (r.value.bookings ?? []).length;
      }
      setPendingCount(n);
    });
    return () => {
      alive = false;
    };
  }, [owners, scope, reloadKey]);

  // Bookings for the active scope + tab + search.
  useEffect(() => {
    let alive = true;
    setPhase("loading");
    const targets = ownersForScope(scope, owners);
    if (targets.length === 0) {
      setRows([]);
      setPhase("ready");
      return;
    }
    Promise.allSettled(
      targets.map((t) =>
        api.scheduling
          .listBookings({ status: tab, q: debouncedQ || undefined }, t.owner)
          .then((r) => ({ t, bookings: r.bookings ?? [] })),
      ),
    ).then((results) => {
      if (!alive) return;
      const ok = results.flatMap((r) =>
        r.status === "fulfilled" ? [r.value] : [],
      );
      if (ok.length === 0) {
        setPhase("error");
        return;
      }
      const merged: Row[] = [];
      for (const { t, bookings } of ok) {
        for (const b of bookings)
          merged.push(toRow(b, t.owner, t.name, eventNames));
      }
      const asc = tab === "upcoming" || tab === "pending";
      merged.sort((a, b) =>
        asc
          ? a.booking.start_at.localeCompare(b.booking.start_at)
          : b.booking.start_at.localeCompare(a.booking.start_at),
      );
      setRows(merged);
      setPhase("ready");
    });
    return () => {
      alive = false;
    };
    // eventNames intentionally excluded — it only enriches subtitles and would
    // otherwise refetch the list; rows re-render with names as they arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owners, scope, tab, debouncedQ, reloadKey]);

  // Re-map subtitles when names resolve without refetching bookings.
  const displayRows = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        eventName:
          (r.booking.event_type_id && eventNames[r.booking.event_type_id]) ||
          r.eventName,
      })),
    [rows, eventNames],
  );

  const quickAction = useCallback(
    async (row: Row, action: "approve" | "decline") => {
      setBusyId(row.booking.id);
      try {
        if (action === "approve") {
          await api.scheduling.approveBooking(row.booking.id, row.ownerRef);
          toast.success("Booking approved.");
        } else {
          await api.scheduling.declineBooking(
            row.booking.id,
            undefined,
            row.ownerRef,
          );
          toast.success("Request declined.");
        }
        setRows((rs) => rs.filter((r) => r.booking.id !== row.booking.id));
        setPendingCount((c) => Math.max(0, c - 1));
      } catch (err) {
        toast.error(decodeError(err).message);
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  const past = tab === "past" || tab === "cancelled";
  const groups =
    tab === "pending"
      ? displayRows.length
        ? [{ key: "pending", label: "Needs your approval", items: displayRows }]
        : []
      : groupBookings(displayRows, (r) => r.booking.start_at, tz, past);

  // hidePending: design Frame 8 hides the Pending segment when the owner has
  // only auto-confirm event types. TODO: derive from event-type config once
  // the API exposes an auto_confirm flag per owner. For now always false.
  const hidePending = false;

  const tabOptions = TABS.filter(
    (t) => !(hidePending && t.key === "pending"),
  ).map((t) => ({
    key: t.key,
    label: t.label,
    badge: t.key === "pending" ? pendingCount : undefined,
  }));

  return (
    <div className="pb-24">
      <header className="mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p
              className={clsx(
                "text-xs font-bold uppercase tracking-wider",
                accentText,
              )}
            >
              Calendarly
            </p>
            <h1 className="text-xl font-bold text-app-text">Bookings</h1>
            <p className="mt-0.5 text-sm text-app-text-secondary">
              Every booking across your spaces, organized by lifecycle.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSearchOpen((v) => {
                if (v) setQ("");
                return !v;
              });
            }}
            aria-label={searchOpen ? "Close search" : "Search bookings"}
            aria-pressed={searchOpen}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-app-border bg-app-surface text-app-text-secondary transition hover:bg-app-hover"
          >
            {searchOpen ? (
              <X className="h-4 w-4" aria-hidden />
            ) : (
              <Search className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>

        {searchOpen && (
          <div className="mt-3">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by invitee name…"
              className="w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text placeholder:text-app-text-muted focus:border-app-border-strong focus:outline-none"
            />
          </div>
        )}

        {multiOwner && (
          <div className="mt-4">
            <ScopePills scope={scope} onScope={setScope} owners={owners} />
          </div>
        )}

        {/* MemberBanner — shown when viewer is a member (Frame 9).
            TODO: wire isMember from API owner role once backend provides it.
            Currently no viewer_role field exists on SchedulingOwnerRef.
            Scaffold is present so it renders immediately once field is added. */}
        {false /* isMember */ && (
          <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-app-info-light bg-app-info-bg px-3 py-2.5">
            <UserCheck className="h-4 w-4 shrink-0 text-app-info" aria-hidden />
            <span className="text-[11px] font-semibold leading-[15px] text-app-text-secondary">
              You&apos;re seeing bookings assigned to you
            </span>
          </div>
        )}

        <div className="mt-3">
          <SegmentedTabs
            options={tabOptions}
            value={tab}
            onChange={(k) => setTab(k as Tab)}
            accentText={accentText}
          />
        </div>
      </header>

      {phase === "loading" && (
        <div className="flex flex-col gap-2">
          <ShimmerBlock className="mb-1 h-3 w-20 rounded" />
          {[0, 1, 2].map((i) => (
            <ShimmerBlock key={i} className="h-[84px] rounded-2xl" />
          ))}
        </div>
      )}

      {phase === "error" && (
        <ErrorState
          message="We couldn't load your bookings."
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      )}

      {phase === "ready" && groups.length === 0 && (
        <EmptyInbox tab={tab} onShare={() => setShareOpen(true)} />
      )}

      {phase === "ready" && groups.length > 0 && (
        <div className="flex flex-col gap-5">
          {groups.map((g) => (
            <section key={g.key}>
              <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-app-text-muted">
                {g.label}
              </h2>
              <div className="flex flex-col gap-2">
                {g.items.map((row) => (
                  <BookingRow
                    key={row.booking.id}
                    row={row}
                    tz={tz}
                    href={`/app/scheduling/bookings/${row.booking.id}${ownerQueryString(row.ownerRef)}`}
                    unread={tab === "pending"}
                    quickActions={tab === "pending"}
                    busy={busyId === row.booking.id}
                    onApprove={() => quickAction(row, "approve")}
                    onDecline={() => quickAction(row, "decline")}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Share-link FAB — fixed PRIMARY blue regardless of active scope */}
      <button
        type="button"
        onClick={() => setShareOpen(true)}
        className={clsx(
          "fixed bottom-6 right-6 z-30 inline-flex h-12 items-center gap-2 rounded-full px-5 text-sm font-bold shadow-lg transition",
          PRIMARY_BLUE_CLS.bg,
          PRIMARY_BLUE_CLS.textOn,
        )}
      >
        <Link2 className="h-4 w-4" strokeWidth={2.4} aria-hidden />
        Share booking link
      </button>

      <ShareBookingSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        owner={ownersForScope(scope, owners)[0]?.owner ?? { ownerType: "user" }}
        pillar={activePillar ?? "personal"}
      />
    </div>
  );
}

function EmptyInbox({ tab, onShare }: { tab: Tab; onShare: () => void }) {
  if (tab === "pending") {
    return (
      <Empty
        icon={InboxIcon}
        title="You're all caught up"
        body="No requests are waiting for your approval."
      />
    );
  }
  if (tab === "past") {
    return (
      <Empty
        icon={History}
        title="Nothing in your history yet"
        body="Completed and past bookings collect here once you've met with someone."
      />
    );
  }
  if (tab === "cancelled") {
    return (
      <Empty
        icon={History}
        title="No cancelled bookings"
        body="Cancelled and declined bookings show up here."
      />
    );
  }
  return (
    <Empty
      icon={CalendarClock}
      title="No bookings yet"
      body="When people book time with you, they show up here."
      cta="Share your booking link"
      onCta={onShare}
    />
  );
}

function Empty({
  icon: Icon,
  title,
  body,
  cta,
  onCta,
}: {
  icon: typeof InboxIcon;
  title: string;
  body: string;
  cta?: string;
  onCta?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 text-primary-600">
        <Icon className="h-7 w-7" strokeWidth={1.8} aria-hidden />
      </span>
      <h2 className="mb-1.5 text-base font-semibold text-app-text">{title}</h2>
      <p className="mb-5 max-w-xs text-sm leading-relaxed text-app-text-secondary">
        {body}
      </p>
      {cta && onCta && (
        <button
          type="button"
          onClick={onCta}
          className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
        >
          <Link2 className="h-4 w-4" strokeWidth={2.2} aria-hidden />
          {cta}
        </button>
      )}
    </div>
  );
}
