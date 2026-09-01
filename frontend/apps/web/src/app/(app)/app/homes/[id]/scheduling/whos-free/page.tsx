"use client";

// F7 — Who's Free. A glanceable household availability heat grid composed from
// each member's personal free/busy (GET /whos-free, home alias). Day view buckets
// a single day into 2-hour columns; Week view spreads the range across days. Tap a
// free cell to plan something there (find-a-time / add event). Members who haven't
// shared free/busy render as "unknown".

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarX,
  ChevronRight,
  Clock,
  EyeOff,
  Plus,
} from "lucide-react";
import clsx from "clsx";
import * as api from "@pantopus/api";
import { getAuthToken } from "@pantopus/api";
import type { WhosFree } from "@pantopus/types";
import ErrorState from "@/components/ui/ErrorState";
import { useSchedulingOwner } from "@/components/scheduling/SchedulingOwnerProvider";
import { decodeError } from "@/components/scheduling/decodeError";
import TimezoneSelector, {
  detectTimezone,
  zoneLabel,
} from "@/components/scheduling/TimezoneSelector";
import WhosFreeGrid from "@/components/scheduling/home/find-a-time/WhosFreeGrid";
import Segmented from "@/components/scheduling/home/find-a-time/Segmented";
import {
  readMembers,
  shortName,
  type MemberView,
} from "@/components/scheduling/home/find-a-time/members";
import {
  todayKey,
  addDaysKey,
  weekdayOf,
} from "@/components/scheduling/home/find-a-time/format";

export default function WhosFreePage() {
  const router = useRouter();
  const owner = useSchedulingOwner();
  const params = useParams<{ id: string }>();
  const homeId = params?.id ?? "";

  const [tz, setTz] = useState<string>(() => detectTimezone());
  const [tzOpen, setTzOpen] = useState(false);
  const [view, setView] = useState<"day" | "week">("day");
  const [weekOffset, setWeekOffset] = useState(0);
  const [filter, setFilter] = useState<string>("all");

  const [members, setMembers] = useState<MemberView[]>([]);
  const [data, setData] = useState<WhosFree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const from = useMemo(
    () => addDaysKey(todayKey(tz), weekOffset * 7),
    [tz, weekOffset],
  );
  const to = useMemo(() => addDaysKey(from, 6), [from]);
  const rangeDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysKey(from, i)),
    [from],
  );
  const [dayKey, setDayKey] = useState<string>(from);

  // Keep the selected day inside the visible range when the week shifts.
  useEffect(() => {
    setDayKey((d) => (rangeDays.includes(d) ? d : from));
  }, [rangeDays, from]);

  const load = useCallback(async () => {
    if (!getAuthToken()) {
      router.push("/login");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [memRes, wf] = await Promise.all([
        api.homeIam
          .getHomeMembers(homeId)
          .catch(() => ({ members: [] as unknown[] })),
        api.scheduling.getWhosFree({ from, to, tz }, owner),
      ]);
      setMembers(readMembers(memRes.members ?? []));
      setData(wf);
    } catch (err) {
      setError(decodeError(err).message);
    } finally {
      setLoading(false);
    }
  }, [homeId, owner, from, to, tz, router]);

  useEffect(() => {
    load();
  }, [load]);

  const known = useMemo(() => {
    const s = new Set<string>(data?.members ?? []);
    for (const k of Object.keys(data?.freeByMember ?? {})) s.add(k);
    return s;
  }, [data]);

  // Roster is the source of truth for rows; members absent from /whos-free show
  // as "unknown". If /whos-free returned ids we don't have a roster row for, add
  // a placeholder so they still appear.
  const allRows = useMemo(() => {
    const byId = new Map(members.map((m) => [m.userId, m]));
    for (const id of known) {
      if (!byId.has(id))
        byId.set(id, {
          userId: id,
          name: "Member",
          sub: "Member",
          avatarUrl: null,
        });
    }
    return [...byId.values()];
  }, [members, known]);

  const visibleRows = useMemo(
    () =>
      filter === "all" ? allRows : allRows.filter((m) => m.userId === filter),
    [allRows, filter],
  );

  const freeByMember = useMemo(() => data?.freeByMember ?? {}, [data]);
  const anyFree = useMemo(
    () =>
      Object.values(freeByMember).some(
        (arr) => Array.isArray(arr) && arr.length > 0,
      ),
    [freeByMember],
  );
  const optedOut = useMemo(
    () => allRows.filter((m) => !known.has(m.userId)),
    [allRows, known],
  );

  const goFindTime = () =>
    router.push(`/app/homes/${homeId}/scheduling/find-a-time`);
  const goAddEvent = (_m: MemberView, date: string) =>
    router.push(
      `/app/homes/${homeId}/scheduling/events/new?date=${encodeURIComponent(date)}`,
    );

  return (
    <div className="mx-auto max-w-2xl pb-10">
      <header className="mb-4">
        <button
          type="button"
          onClick={() => router.push(`/app/homes/${homeId}/calendar`)}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-app-text-secondary hover:text-app-text"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Calendar
        </button>
        <p className="text-xs font-bold uppercase tracking-wider text-app-home">
          Calendarly · Household
        </p>
        {/* Title row mirrors design TopBar: title + trailing "Add" action */}
        <div className="mt-0.5 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-app-text">Who&apos;s free</h1>
          <button
            type="button"
            onClick={() =>
              router.push(
                `/app/homes/${homeId}/scheduling/events/new?date=${encodeURIComponent(todayKey(tz))}`,
              )
            }
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-bold text-app-home hover:bg-app-home-bg disabled:opacity-40"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <p className="text-sm text-app-text-secondary">
            Composed from each member&apos;s personal availability.
          </p>
          <button
            type="button"
            onClick={() => setTzOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-app-border bg-app-surface px-2.5 py-1.5 text-[11px] font-bold text-app-text-secondary hover:bg-app-hover"
          >
            <Clock className="h-3 w-3" aria-hidden /> {zoneLabel(tz)}
          </button>
        </div>
      </header>

      {/* Controls */}
      <div className="mb-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="w-40">
            <Segmented
              options={[
                { value: "day", label: "Day" },
                { value: "week", label: "Week" },
              ]}
              value={view}
              onChange={setView}
              size="sm"
              ariaLabel="Day or week view"
            />
          </div>
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w + 1)}
            className="inline-flex items-center gap-1 text-xs font-bold text-app-home hover:underline"
          >
            {weekOffset === 0 ? "This week" : `Week +${weekOffset}`}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>

        {view === "day" && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {rangeDays.map((d) => {
              const on = d === dayKey;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDayKey(d)}
                  className={clsx(
                    "flex-shrink-0 rounded-lg px-3 py-1.5 text-center text-[11px] font-bold transition-colors",
                    on
                      ? "bg-app-home text-white"
                      : "bg-app-surface text-app-text-secondary hover:bg-app-hover",
                  )}
                >
                  {weekdayOf(d)} {Number(d.slice(8, 10))}
                </button>
              );
            })}
          </div>
        )}

        {allRows.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {[
              { id: "all", label: "All" },
              ...allRows.map((m) => ({
                id: m.userId,
                label: shortName(m.name),
              })),
            ].map((c) => {
              const on = c.id === filter;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setFilter(c.id)}
                  className={clsx(
                    "flex-shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold transition-colors",
                    on
                      ? "border-transparent bg-app-home-bg text-app-home"
                      : "border-app-border bg-app-surface text-app-text-secondary hover:bg-app-hover",
                  )}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-app-border bg-app-surface p-4">
          <p className="mb-3 text-center text-sm font-bold text-app-text">
            Building this week&apos;s availability
          </p>
          <div
            className="space-y-1.5"
            aria-busy="true"
            aria-label="Loading availability"
          >
            {[0, 1, 2, 3].map((r) => (
              <div
                key={r}
                className="grid items-center gap-1.5"
                style={{ gridTemplateColumns: "64px repeat(6, 1fr)" }}
              >
                <div className="flex items-center gap-1.5">
                  <div className="h-[18px] w-[18px] animate-pulse rounded-full bg-app-surface-muted" />
                  <div className="h-2 w-7 animate-pulse rounded bg-app-surface-muted" />
                </div>
                {[0, 1, 2, 3, 4, 5].map((c) => (
                  <div
                    key={c}
                    className="h-7 animate-pulse rounded-md bg-app-surface-muted"
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : allRows.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-app-border bg-app-surface px-6 py-12 text-center">
          <CalendarX
            className="mb-3 h-10 w-10 text-app-text-muted"
            aria-hidden
          />
          <h2 className="text-base font-bold text-app-text">
            No household members yet
          </h2>
          <p className="mt-1.5 max-w-xs text-sm text-app-text-secondary">
            Invite people to your home to see when everyone&apos;s free.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {!anyFree && (
            <div className="flex items-start gap-2.5 rounded-xl border border-app-info-light bg-app-info-bg p-3">
              <CalendarX
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-app-info"
                aria-hidden
              />
              <div>
                <p className="text-xs font-bold text-app-info">
                  No overlapping free time this{" "}
                  {view === "day" ? "day" : "week"}
                </p>
                <p className="mt-0.5 text-[11px] text-app-text-secondary">
                  Everyone&apos;s booked up. Try the next week to find a shared
                  opening.
                </p>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-app-border bg-app-surface p-4">
            <WhosFreeGrid
              members={visibleRows}
              freeByMember={freeByMember}
              known={known}
              view={view}
              dayKey={dayKey}
              rangeDays={rangeDays}
              onFindTime={goFindTime}
              onAddEvent={goAddEvent}
            />
          </div>

          <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-app-text-secondary">
            Tap a free block to plan something
          </p>

          {optedOut.length > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-app-warning-light bg-app-warning-bg p-3">
              <EyeOff
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-app-warning"
                aria-hidden
              />
              <div>
                <p className="text-xs font-bold text-app-warning">
                  {optedOut.map((m) => shortName(m.name)).join(", ")}{" "}
                  {optedOut.length === 1 ? "hasn’t" : "haven’t"} shared
                  free/busy
                </p>
                <p className="mt-0.5 text-[11px] text-app-text-secondary">
                  You can&apos;t see their availability or include them in Find
                  a time until they share it.
                </p>
              </div>
            </div>
          )}

          {!anyFree && (
            <button
              type="button"
              onClick={() => setWeekOffset((w) => w + 1)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-app-home bg-app-home-bg px-4 py-3 text-sm font-bold text-app-home"
            >
              <ChevronRight className="h-4 w-4" aria-hidden /> Try next week
            </button>
          )}
        </div>
      )}

      <TimezoneSelector
        open={tzOpen}
        onClose={() => setTzOpen(false)}
        value={tz}
        onSelect={setTz}
        pillar="home"
      />
    </div>
  );
}
