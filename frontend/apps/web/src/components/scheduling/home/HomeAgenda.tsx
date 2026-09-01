"use client";

// F1 — Household calendar / agenda over the booking UNION (events + live
// booking rows), with the three W10 additions: a member filter row, per-row
// assignee avatar stacks, and a create menu (Add event / Find a time / Book a
// resource / Schedule a visit). Also serves the F15 gated render-mode: when
// canEdit is false the FAB is gone, a hint bar explains the gating with an
// "Ask to manage" action, and the member's own assignments are pinned as
// actionable Accept / Decline rows.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarPlus,
  CalendarSearch,
  Check,
  CloudOff,
  DoorOpen,
  Eye,
  Package,
  Plus,
  RotateCw,
  ShieldPlus,
  Clock,
  Users,
  UserCheck,
  WifiOff,
  X,
} from "lucide-react";
import * as api from "@pantopus/api";
import type { HomeCalendarUnionEvent } from "@pantopus/types";
import BottomSheet from "@/components/ui/BottomSheet";
import { toast } from "@/components/ui/toast-store";
import { decodeError } from "@/components/scheduling/decodeError";
import AddEditEventForm from "./AddEditEventForm";
import UnionEventRow from "./UnionEventRow";
import { listHomeEvents, rsvpHomeEvent } from "./api";
import {
  formatTimeParts,
  groupByDay,
  monthLabel,
  resolveMembers,
  startOfDay,
  toMember,
  weekStrip,
  dayKey,
  type HomeMember,
} from "./helpers";

type Filter = "all" | "mine" | string;

const ACCESS_KEY = (homeId: string) => `pantopus.home-sched-access.${homeId}`;

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}
function startOfWeek(d: Date): Date {
  return addDays(startOfDay(d), -d.getDay());
}

export default function HomeAgenda({
  homeId,
  canEdit,
  currentUserId,
  accessRequested,
  onRequestAccess,
}: {
  homeId: string;
  canEdit: boolean;
  currentUserId: string | null;
  /** Controlled from the parent page so the pill renders in the top bar. When
   *  provided the internal localStorage state is overridden. */
  accessRequested?: boolean;
  onRequestAccess?: () => void;
}) {
  const router = useRouter();

  const [events, setEvents] = useState<HomeCalendarUnionEvent[]>([]);
  const [membersById, setMembersById] = useState<Map<string, HomeMember>>(
    new Map(),
  );
  const [members, setMembers] = useState<HomeMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = useMemo(() => startOfDay(new Date()), []);
  const [weekAnchor, setWeekAnchor] = useState<Date>(() =>
    startOfWeek(new Date()),
  );
  const [selectedKey, setSelectedKey] = useState<string>(dayKey(new Date()));
  const [filter, setFilter] = useState<Filter>("all");

  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const [accessRequestedInternal, setAccessRequestedInternal] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setAccessRequestedInternal(
        window.localStorage.getItem(ACCESS_KEY(homeId)) === "1",
      );
    }
  }, [homeId]);

  // Use controlled prop if provided (parent page renders the pill in the top bar),
  // otherwise fall back to internal localStorage state.
  const accessRequestedEffective =
    accessRequested !== undefined ? accessRequested : accessRequestedInternal;

  const load = useCallback(async () => {
    const from = startOfWeek(weekAnchor);
    const to = addDays(from, 56);
    const [evRes, occRes] = await Promise.allSettled([
      listHomeEvents(homeId, {
        start_after: from.toISOString(),
        start_before: to.toISOString(),
      }),
      api.homes.getHomeOccupants(homeId),
    ]);

    if (occRes.status === "fulfilled") {
      const ms = (occRes.value.occupants || [])
        .filter((o) => o.user)
        .map((o) => toMember(o.user));
      const map = new Map<string, HomeMember>();
      for (const m of ms) map.set(m.id, m);
      setMembers(ms);
      setMembersById(map);
    }

    if (evRes.status === "fulfilled") {
      setEvents(evRes.value.events || []);
      setError(null);
    } else {
      setError(decodeError(evRes.reason).message);
    }
  }, [homeId, weekAnchor]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  // ─── derived ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (filter === "all") return events;
    return events.filter((e) => {
      if (e.source === "booking") return false; // bookings only show under "All"
      if (filter === "mine") {
        return (
          (currentUserId && (e.assigned_to ?? []).includes(currentUserId)) ||
          e.created_by === currentUserId
        );
      }
      return (e.assigned_to ?? []).includes(filter);
    });
  }, [events, filter, currentUserId]);

  const groups = useMemo(() => groupByDay(filtered, today), [filtered, today]);

  const myAssignments = useMemo(() => {
    if (canEdit || !currentUserId) return [];
    return events.filter(
      (e) =>
        e.source !== "booking" &&
        (e.assigned_to ?? []).includes(currentUserId) &&
        e.request_rsvp &&
        new Date(e.start_at).getTime() >= today.getTime(),
    );
  }, [events, canEdit, currentUserId, today]);

  const daysWithEvents = useMemo(() => {
    const set = new Set<string>();
    for (const e of filtered) set.add(dayKey(new Date(e.start_at)));
    return set;
  }, [filtered]);

  const strip = useMemo(() => weekStrip(addDays(weekAnchor, 3)), [weekAnchor]);

  const filterChips: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    ...(currentUserId ? [{ key: "mine" as Filter, label: "Mine" }] : []),
    ...members.map((m) => ({ key: m.id as Filter, label: m.name })),
  ];
  const filterActive = filter !== "all";

  const requestAccess = () => {
    if (onRequestAccess) {
      onRequestAccess();
      return;
    }
    window.localStorage.setItem(ACCESS_KEY(homeId), "1");
    setAccessRequestedInternal(true);
    toast.success("We asked an admin to give you scheduling access");
  };

  const openEvent = (e: HomeCalendarUnionEvent) => {
    if (e.source === "booking") {
      if (e.booking_id) router.push(`/app/scheduling/bookings/${e.booking_id}`);
      return;
    }
    router.push(`/app/homes/${homeId}/scheduling/events/${e.id}`);
  };

  const respondAssignment = async (
    e: HomeCalendarUnionEvent,
    status: "going" | "declined",
  ) => {
    // optimistic: drop it from the actionable list
    setEvents((prev) =>
      prev.map((x) => (x.id === e.id ? { ...x, request_rsvp: false } : x)),
    );
    try {
      await rsvpHomeEvent(homeId, e.id, status);
      toast.success(status === "going" ? "Accepted" : "Declined");
    } catch (err) {
      setEvents((prev) =>
        prev.map((x) => (x.id === e.id ? { ...x, request_rsvp: true } : x)),
      );
      toast.error(decodeError(err).message || "Couldn't respond");
    }
  };

  // ─── render ────────────────────────────────────────────────
  return (
    <div className="relative">
      {/* gated hint bar (F15) — eye icon + text only; access pill is in the
          page top bar when accessRequested/onRequestAccess props are provided */}
      {!canEdit && (
        <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-app-info-light bg-app-info-bg px-3 py-2.5">
          <Eye className="h-4 w-4 shrink-0 text-app-info" />
          <span className="flex-1 text-[11.5px] font-medium leading-[15px] text-app-info">
            You can view the schedule. Ask an admin to make changes.
          </span>
          {/* Inline pill fallback — only shown when parent does NOT control the pill */}
          {onRequestAccess === undefined && (
            accessRequestedEffective ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-app-surface-sunken px-2.5 py-1 text-[11px] font-bold text-app-text-muted">
                <Clock className="h-3 w-3" /> Request sent
              </span>
            ) : (
              <button
                onClick={requestAccess}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-app-home/30 bg-app-home-bg px-2.5 py-1 text-[11px] font-bold text-app-home"
              >
                <ShieldPlus className="h-3 w-3" /> Ask to manage
              </button>
            )
          )}
        </div>
      )}

      {/* offline banner */}
      {!isOnline && (
        <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <div className="text-[12px] font-bold text-amber-800">
              You&apos;re offline
            </div>
            <div className="mt-0.5 text-[11.5px] leading-[15px] text-amber-700">
              Showing the last synced schedule. Changes save when you reconnect.
            </div>
          </div>
        </div>
      )}

      {/* month strip */}
      <div className="rounded-2xl border border-app-border bg-app-surface px-3 pb-3 pt-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="mb-2 flex items-center justify-between px-1">
          <div className="text-[13px] font-bold tracking-tight text-app-text">
            {monthLabel(addDays(weekAnchor, 3))}
          </div>
          <div className="flex gap-1">
            <button
              aria-label="Previous week"
              onClick={() => setWeekAnchor((d) => addDays(d, -7))}
              className="rounded-md p-1 text-app-text-muted hover:bg-app-surface-sunken"
            >
              <ChevronGlyph dir="left" />
            </button>
            <button
              aria-label="Next week"
              onClick={() => setWeekAnchor((d) => addDays(d, 7))}
              className="rounded-md p-1 text-app-text-secondary hover:bg-app-surface-sunken"
            >
              <ChevronGlyph dir="right" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {strip.map((day) => {
            const k = dayKey(day.date);
            const sel = k === selectedKey;
            const isToday = k === dayKey(today);
            const has = daysWithEvents.has(k);
            return (
              <button
                key={k}
                onClick={() => setSelectedKey(k)}
                className="flex flex-col items-center gap-1 py-0.5"
              >
                <span className="text-[10px] font-semibold text-app-text-muted">
                  {day.weekday}
                </span>
                <span
                  className={`flex h-[30px] w-[30px] items-center justify-center rounded-full text-[13px] font-semibold ${
                    sel
                      ? "bg-app-home text-white"
                      : isToday
                        ? "text-app-text ring-[1.5px] ring-app-home"
                        : "text-app-text"
                  }`}
                >
                  {day.dayNum}
                </span>
                <span
                  className={`h-1 w-1 rounded-full ${
                    has && !sel ? "bg-app-home" : "bg-transparent"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* filter chips */}
      <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
        {filterChips.map((c) => {
          const on = c.key === filter;
          return (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition ${
                on
                  ? "border-transparent bg-app-home-bg text-app-home"
                  : "border-app-border bg-app-surface text-app-text-secondary"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* body */}
      <div className="mt-3">
        {loading ? (
          <AgendaSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center justify-center px-7 py-16 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-app-error-bg">
              <CloudOff className="h-7 w-7 text-app-error" />
            </div>
            <div className="text-base font-bold text-app-text">
              Couldn&apos;t load the calendar
            </div>
            <p className="mt-1.5 max-w-[230px] text-[12.5px] text-app-text-secondary">
              Something went wrong on our side. Check your connection and try
              again.
            </p>
            <button
              onClick={() => {
                setLoading(true);
                load().finally(() => setLoading(false));
              }}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-app-home px-5 py-2.5 text-sm font-bold text-white"
            >
              <RotateCw className="h-4 w-4" /> Retry
            </button>
          </div>
        ) : filtered.length === 0 && myAssignments.length === 0 ? (
          filterActive ? (
            <FilteredEmpty onClear={() => setFilter("all")} />
          ) : (
            <EmptyAgenda canEdit={canEdit} onAdd={() => setAddOpen(true)} />
          )
        ) : (
          <div className="space-y-2">
            {/* F15: pinned my-assignments */}
            {myAssignments.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 px-0.5 pt-0.5">
                  <UserCheck className="h-3.5 w-3.5 text-app-info" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-app-info">
                    My assignments · {myAssignments.length}
                  </span>
                </div>
                {myAssignments.map((e) => (
                  <AssignmentRow
                    key={e.id}
                    event={e}
                    onAccept={() => respondAssignment(e, "going")}
                    onDecline={() => respondAssignment(e, "declined")}
                  />
                ))}
                <div className="h-1" />
              </div>
            )}

            {/* day-grouped agenda */}
            {groups.map((g) => (
              <div key={g.key} className="space-y-2">
                <div className="px-0.5 pt-1 text-[11px] font-bold text-app-text-secondary">
                  {g.heading}
                </div>
                {g.events.map((e) => (
                  <div
                    key={e.id}
                    className={isOnline ? undefined : "opacity-50"}
                  >
                    <UnionEventRow
                      event={e}
                      members={resolveMembers(e.assigned_to, membersById)}
                      onClick={() => openEvent(e)}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB (only when editable and online) */}
      {canEdit && !loading && isOnline && (
        <button
          aria-label="Create"
          onClick={() => setCreateMenuOpen(true)}
          className="fixed bottom-24 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-app-home text-white shadow-[0_8px_20px_rgba(22,163,74,0.4)] md:bottom-8"
        >
          <Plus className="h-6 w-6" strokeWidth={2.4} />
        </button>
      )}

      {/* create menu sheet */}
      <BottomSheet
        open={createMenuOpen}
        onClose={() => setCreateMenuOpen(false)}
        title="Create"
      >
        <div className="space-y-0.5 pb-2">
          <CreateMenuItem
            icon={<CalendarPlus className="h-5 w-5" />}
            label="Add event"
            sub="A one-off or repeating event"
            onClick={() => {
              setCreateMenuOpen(false);
              setAddOpen(true);
            }}
          />
          <CreateMenuItem
            icon={<Users className="h-5 w-5" />}
            label="Find a time"
            sub="Pick a slot that works for everyone"
            onClick={() =>
              router.push(`/app/homes/${homeId}/scheduling/find-a-time`)
            }
          />
          <CreateMenuItem
            icon={<Package className="h-5 w-5" />}
            label="Book a resource"
            sub="Guest room, EV charger, tools"
            onClick={() =>
              router.push(`/app/homes/${homeId}/scheduling/resources`)
            }
          />
          <CreateMenuItem
            icon={<DoorOpen className="h-5 w-5" />}
            label="Schedule a visit"
            sub="Offer a vendor or guest a window"
            onClick={() =>
              router.push(`/app/homes/${homeId}/scheduling/visits/new`)
            }
          />
        </div>
      </BottomSheet>

      {/* add event sheet */}
      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)}>
        <div className="h-[80vh]">
          <AddEditEventForm
            homeId={homeId}
            members={members}
            onCancel={() => setAddOpen(false)}
            onSaved={() => {
              setAddOpen(false);
              toast.success("Event added");
              setLoading(true);
              load().finally(() => setLoading(false));
            }}
          />
        </div>
      </BottomSheet>
    </div>
  );
}

// ─── Local pieces ─────────────────────────────────────────────
function ChevronGlyph({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d={dir === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CreateMenuItem({
  icon,
  label,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-app-surface-sunken"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-app-home-bg text-app-home">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-bold tracking-tight text-app-text">
          {label}
        </div>
        <div className="mt-0.5 text-[11px] text-app-text-secondary">{sub}</div>
      </div>
      <ChevronGlyph dir="right" />
    </button>
  );
}

function AssignmentRow({
  event,
  onAccept,
  onDecline,
}: {
  event: HomeCalendarUnionEvent;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { time, ampm } = formatTimeParts(event.start_at);
  return (
    <div className="rounded-2xl border-[1.5px] border-app-personal/40 bg-app-personal-bg/40 p-3 shadow-[0_1px_3px_rgba(2,132,199,0.08)]">
      <div className="flex items-center gap-3">
        <div className="w-10 shrink-0 text-center">
          <div className="text-[13px] font-bold tabular-nums text-app-text">
            {time}
          </div>
          <div className="mt-0.5 text-[9.5px] font-semibold text-app-text-muted">
            {ampm}
          </div>
        </div>
        <div className="h-8 w-px shrink-0 self-stretch bg-app-personal/30" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-bold tracking-tight text-app-text">
            {event.title}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-app-personal-bg px-2 py-0.5 text-[9.5px] font-bold text-app-personal">
              <UserCheck className="h-2.5 w-2.5" /> Your slot
            </span>
            {event.location_notes && (
              <span className="truncate text-[10.5px] text-app-text-secondary">
                {event.location_notes}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-2.5 flex gap-2">
        <button
          onClick={onAccept}
          className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-app-home text-[12px] font-bold text-white"
        >
          <Check className="h-3.5 w-3.5" /> Accept
        </button>
        <button
          onClick={onDecline}
          className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-app-border-strong bg-app-surface text-[12px] font-bold text-app-text-secondary"
        >
          <X className="h-3.5 w-3.5" /> Decline
        </button>
      </div>
    </div>
  );
}

function EmptyAgenda({
  canEdit,
  onAdd,
}: {
  canEdit: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-7 py-16 text-center">
      <div className="mb-2.5 flex h-14 w-14 items-center justify-center rounded-full bg-app-home-bg">
        <CalendarPlus className="h-7 w-7 text-app-home" />
      </div>
      <div className="text-base font-bold text-app-text">Nothing scheduled</div>
      <p className="mt-1 max-w-[230px] text-[12.5px] text-app-text-secondary">
        {canEdit
          ? "Add your first event and it shows up here for the whole household."
          : "There's nothing on the household calendar in this range."}
      </p>
      {canEdit && (
        <button
          onClick={onAdd}
          className="mt-3.5 inline-flex items-center gap-2 rounded-xl bg-app-home px-5 py-2.5 text-sm font-bold text-white"
        >
          <Plus className="h-4 w-4" /> Add an event
        </button>
      )}
    </div>
  );
}

function FilteredEmpty({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-7 py-16 text-center">
      <div className="mb-2.5 flex h-14 w-14 items-center justify-center rounded-full bg-app-home-bg">
        <CalendarSearch className="h-7 w-7 text-app-home" />
      </div>
      <div className="text-base font-bold text-app-text">
        No events in this range
      </div>
      <p className="mt-1 max-w-[230px] text-[12.5px] text-app-text-secondary">
        Nothing matches this filter.
      </p>
      <button
        onClick={onClear}
        className="mt-3.5 inline-flex items-center gap-1.5 rounded-full border border-app-home/30 bg-app-home-bg px-4 py-2 text-[12.5px] font-bold text-app-home"
      >
        <X className="h-3 w-3" /> Clear filter
      </button>
    </div>
  );
}

function AgendaSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="mx-0.5 my-1 h-3 w-32 rounded bg-app-surface-sunken" />
      {[0, 1, 2].map((i) => (
        <SkeletonRow key={i} />
      ))}
      <div className="mx-0.5 mb-1 mt-2 h-3 w-28 rounded bg-app-surface-sunken" />
      {[0, 1].map((i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-app-border bg-app-surface px-3 py-3">
      <div className="flex w-10 shrink-0 flex-col items-center gap-1">
        <div className="h-3 w-7 rounded bg-app-surface-sunken" />
        <div className="h-2 w-5 rounded bg-app-surface-sunken" />
      </div>
      <div className="h-9 w-px self-stretch bg-app-border" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-3/5 rounded bg-app-surface-sunken" />
        <div className="h-2.5 w-2/5 rounded bg-app-surface-sunken" />
      </div>
      <div className="h-6 w-6 rounded-full bg-app-surface-sunken" />
    </div>
  );
}
