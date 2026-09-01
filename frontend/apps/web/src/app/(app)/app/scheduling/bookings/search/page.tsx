"use client";

// W9 · E9 — Booking Search & Filter (host). A searchable, filterable bookings
// list that doubles as the launch point for the stream's lifecycle extras:
// each row can open Nudge (E11), Follow-up (E7), Mark no-show (E6), or jump to
// the group Roster (E8); the header links to Manual booking (E12). Filters are
// debounced into GET /bookings (status/event_type/from/to/q) and reflected in
// the URL; the no-show facet is refined client-side over the past bucket.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import {
  Bell,
  CalendarX2,
  Inbox,
  MessageSquare,
  SlidersHorizontal,
  Users,
  UserPlus,
  UserX,
} from "lucide-react";
import * as api from "@pantopus/api";
import type { Booking, EventType } from "@pantopus/types";
import { ShimmerBlock } from "@/components/ui/Shimmer";
import ErrorState from "@/components/ui/ErrorState";
import { toast } from "@/components/ui/toast-store";
import {
  ownerFromQuery,
  ownerQueryString,
} from "@/components/scheduling/bookings/owners";
import { pillarForOwner } from "@/components/scheduling/pillarTokens";
import BookingStatusPill from "@/components/scheduling/BookingStatusPill";
import BookingSearchFilter from "@/components/scheduling/bookings-extras/BookingSearchFilter";
import NudgeSheet, {
  type NudgeTarget,
} from "@/components/scheduling/bookings-extras/NudgeSheet";
import FollowUpSheet, {
  type FollowUpTarget,
} from "@/components/scheduling/bookings-extras/FollowUpSheet";
import NoShowSheet, {
  type NoShowTarget,
} from "@/components/scheduling/bookings-extras/NoShowSheet";
import {
  PillarBadge,
  SectionOverline,
  Avatar,
} from "@/components/scheduling/bookings-extras/ui";
import { fmtDateTime } from "@/components/scheduling/bookings-extras/format";
import {
  type BookingFilters,
  buildBookingListParams,
  countActiveFilters,
  parseFilters,
  refineBookings,
  serializeFilters,
} from "@/components/scheduling/bookings-extras/filters";

const MANUAL_PATH = "/app/scheduling/bookings/manual";

export default function BookingsSearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Owner context travels in the URL (?ot=&oid=), same convention the inbox uses
  // when it deep-links a row. Falls back to personal when absent.
  const ownerType = searchParams?.get("ot") ?? null;
  const ownerId = searchParams?.get("oid") ?? null;
  const owner = useMemo(
    () =>
      ownerFromQuery((k) =>
        k === "ot" ? ownerType : k === "oid" ? ownerId : null,
      ),
    [ownerType, ownerId],
  );
  const pillar = pillarForOwner(owner.ownerType);

  const [filters, setFilters] = useState<BookingFilters>(() =>
    parseFilters(searchParams?.toString()),
  );
  const [phase, setPhase] = useState<"loading" | "error" | "ready">("loading");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);

  // Sheets
  const [nudge, setNudge] = useState<NudgeTarget | null>(null);
  const [followUp, setFollowUp] = useState<FollowUpTarget | null>(null);
  const [noShow, setNoShow] = useState<NoShowTarget | null>(null);

  const eventTypeName = useMemo(() => {
    const map = new Map<string, string>();
    for (const et of eventTypes) map.set(et.id, et.name);
    return (id: string | null) => (id ? (map.get(id) ?? "Booking") : "Booking");
  }, [eventTypes]);

  // Event types (for the filter facet + row titles) — best effort.
  useEffect(() => {
    let alive = true;
    api.scheduling
      .listEventTypes(owner)
      .then((res) => {
        if (alive) setEventTypes(res.eventTypes ?? []);
      })
      .catch(() => {
        /* filter facet just hides */
      });
    return () => {
      alive = false;
    };
  }, [owner]);

  // Debounced fetch keyed on the serialized filters.
  const key = serializeFilters(filters);
  const reqRef = useRef(0);
  const fetchBookings = useCallback(() => {
    const reqId = ++reqRef.current;
    setPhase("loading");
    api.scheduling
      .listBookings(buildBookingListParams(filters), owner)
      .then((res) => {
        if (reqRef.current !== reqId) return; // stale
        setBookings(refineBookings(res.bookings ?? [], filters));
        setPhase("ready");
      })
      .catch(() => {
        if (reqRef.current !== reqId) return;
        setPhase("error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, owner]);

  useEffect(() => {
    const t = setTimeout(fetchBookings, 300);
    return () => clearTimeout(t);
  }, [fetchBookings]);

  // Reflect filters into the URL for shareability (no history spam).
  useEffect(() => {
    const qs = serializeFilters(filters);
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const activeCount = countActiveFilters(filters);

  const onSent = () => fetchBookings();

  return (
    <div>
      <header className="mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2">
              <PillarBadge pillar={pillar} />
            </div>
            <h1 className="text-xl font-bold text-app-text">Bookings</h1>
            <p className="mt-0.5 text-sm text-app-text-secondary">
              Search, filter, and act on your bookings.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push(`${MANUAL_PATH}${ownerQueryString(owner)}`)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
          >
            <UserPlus className="h-4 w-4" strokeWidth={2.2} aria-hidden />
            Book someone in
          </button>
        </div>

        {/* Search + filters */}
        <div className="mt-4 flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-app-border bg-app-surface-sunken px-3">
            <svg
              className="h-4 w-4 text-app-text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="m21 21-4.3-4.3" />
            </svg>
            <input
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder="Search invitee name"
              aria-label="Search invitee name"
              className="w-full bg-transparent py-2.5 text-sm text-app-text placeholder:text-app-text-muted focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            className="relative inline-flex items-center gap-1.5 rounded-lg border border-app-border bg-app-surface px-3.5 py-2 text-sm font-semibold text-app-text transition hover:bg-app-hover"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            Filters
            {activeCount > 0 && (
              <span className="ml-0.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary-600 px-1 text-[11px] font-bold text-white">
                {activeCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {phase === "loading" && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <ShimmerBlock key={i} className="h-[68px] rounded-2xl" />
          ))}
        </div>
      )}

      {phase === "error" && (
        <ErrorState
          message="We couldn't load your bookings."
          onRetry={fetchBookings}
        />
      )}

      {phase === "ready" && bookings.length === 0 && (
        <EmptyResults
          hasFilters={activeCount > 0}
          onClear={() =>
            setFilters((f) => ({
              ...f,
              q: "",
              status: "all",
              eventTypeId: null,
              date: "all",
              from: null,
              to: null,
            }))
          }
          onBook={() => router.push(`${MANUAL_PATH}${ownerQueryString(owner)}`)}
        />
      )}

      {phase === "ready" && bookings.length > 0 && (
        <div>
          <SectionOverline className="mb-2">
            {bookings.length} booking{bookings.length === 1 ? "" : "s"}
          </SectionOverline>
          <ul className="flex flex-col gap-2">
            {bookings.map((b) => (
              <BookingRow
                key={b.id}
                booking={b}
                title={eventTypeName(b.event_type_id)}
                pillar={pillar}
                onNudge={() =>
                  setNudge({
                    id: b.id,
                    title: eventTypeName(b.event_type_id),
                    subtitle: `${b.invitee_name ?? "Invitee"} · ${fmtDateTime(b.start_at, b.invitee_timezone)}`,
                    inviteeName: b.invitee_name,
                  })
                }
                onFollowUp={() =>
                  setFollowUp({
                    id: b.id,
                    title: eventTypeName(b.event_type_id),
                    subtitle: `${b.invitee_name ?? "Invitee"} · ${fmtDateTime(b.start_at, b.invitee_timezone)}`,
                    inviteeName: b.invitee_name,
                  })
                }
                onNoShow={() =>
                  setNoShow({
                    id: b.id,
                    status: b.status,
                    start_at: b.start_at,
                    end_at: b.end_at,
                    invitee_name: b.invitee_name,
                  })
                }
                onRoster={() =>
                  router.push(
                    `/app/scheduling/bookings/${b.id}/roster${ownerQueryString(owner)}`,
                  )
                }
              />
            ))}
          </ul>
        </div>
      )}

      {/* Filter sheet */}
      <BookingSearchFilter
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onChange={setFilters}
        eventTypes={eventTypes.map((e) => ({ id: e.id, name: e.name }))}
        resultCount={phase === "ready" ? bookings.length : null}
        loading={phase === "loading"}
        onClear={() =>
          setFilters({
            q: "",
            status: "all",
            scope: "all",
            eventTypeId: null,
            date: "all",
            from: null,
            to: null,
          })
        }
      />

      {/* Action sheets */}
      <NudgeSheet
        open={!!nudge}
        onClose={() => setNudge(null)}
        booking={nudge}
        owner={owner}
        onSent={onSent}
      />
      <FollowUpSheet
        open={!!followUp}
        onClose={() => setFollowUp(null)}
        booking={followUp}
        owner={owner}
        pillar={pillar}
        onSent={onSent}
      />
      <NoShowSheet
        open={!!noShow}
        onClose={() => setNoShow(null)}
        booking={noShow}
        owner={owner}
        pillar={pillar}
        onDone={(updated) => {
          setBookings((list) =>
            list.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)),
          );
          toast.success("Booking updated.");
        }}
      />
    </div>
  );
}

function BookingRow({
  booking,
  title,
  pillar,
  onNudge,
  onFollowUp,
  onNoShow,
  onRoster,
}: {
  booking: Booking;
  title: string;
  pillar: ReturnType<typeof pillarForOwner>;
  onNudge: () => void;
  onFollowUp: () => void;
  onNoShow: () => void;
  onRoster: () => void;
}) {
  const ended = new Date(booking.end_at).getTime() <= Date.now();
  const canNoShow = booking.status === "confirmed" && ended;

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-app-border bg-app-surface px-3 py-3 shadow-sm">
      <Avatar name={booking.invitee_name} pillar={pillar} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-app-text">
          {booking.invitee_name || booking.invitee_email || "Guest"}
        </p>
        <p className="truncate text-xs text-app-text-muted">
          {title} · {fmtDateTime(booking.start_at, booking.invitee_timezone)}
        </p>
      </div>
      <BookingStatusPill
        status={booking.status}
        className="hidden sm:inline-flex"
      />
      <div className="flex shrink-0 items-center gap-0.5">
        <RowAction label="Send a nudge" onClick={onNudge} icon={Bell} />
        {ended && (
          <RowAction
            label="Post-meeting follow-up"
            onClick={onFollowUp}
            icon={MessageSquare}
          />
        )}
        {canNoShow && (
          <RowAction
            label="Mark no-show"
            onClick={onNoShow}
            icon={UserX}
            danger
          />
        )}
        <RowAction label="View roster" onClick={onRoster} icon={Users} />
      </div>
    </li>
  );
}

function RowAction({
  label,
  onClick,
  icon: Icon,
  danger,
}: {
  label: string;
  onClick: () => void;
  icon: typeof Bell;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={clsx(
        "flex h-8 w-8 items-center justify-center rounded-lg text-app-text-secondary transition hover:bg-app-hover",
        danger ? "hover:text-app-error" : "hover:text-app-text",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}

function EmptyResults({
  hasFilters,
  onClear,
  onBook,
}: {
  hasFilters: boolean;
  onClear: () => void;
  onBook: () => void;
}) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-app-surface-sunken text-app-text-muted">
          <CalendarX2 className="h-7 w-7" strokeWidth={1.7} aria-hidden />
        </span>
        <h2 className="mb-1.5 text-base font-semibold text-app-text">
          No bookings match these filters
        </h2>
        <p className="mb-5 max-w-xs text-sm text-app-text-secondary">
          Try widening the date range or clearing a filter.
        </p>
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg border border-app-border bg-app-surface px-4 py-2 text-sm font-semibold text-primary-700 transition hover:bg-app-hover"
        >
          Clear all filters
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 text-primary-600">
        <Inbox className="h-7 w-7" strokeWidth={1.7} aria-hidden />
      </span>
      <h2 className="mb-1.5 text-base font-semibold text-app-text">
        No bookings yet
      </h2>
      <p className="mb-5 max-w-xs text-sm text-app-text-secondary">
        When people book you they’ll show up here. You can also add one
        yourself.
      </p>
      <button
        type="button"
        onClick={onBook}
        className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
      >
        <UserPlus className="h-4 w-4" aria-hidden />
        Book someone in
      </button>
    </div>
  );
}
