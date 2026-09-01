"use client";

// F11 — Resource detail / booking calendar. Header card + rules chips + the
// resource's upcoming bookings (read from the home bookings list, filtered by
// resource_id — never created here) + an admin approval queue + a sticky "Book
// this". Fully-booked-today surfaces the next opening.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CalendarX,
  Check,
  ChevronRight,
  Clock,
  CloudOff,
  Plus,
  RotateCw,
  Timer,
  Users,
  X,
} from "lucide-react";
import { scheduling } from "@pantopus/api";
import type { Booking, Resource } from "@pantopus/types";
import { useSchedulingOwner } from "@/components/scheduling";
import { decodeError } from "@/components/scheduling/decodeError";
import {
  Avatar,
  formatDayHeading,
  type HomeMember,
} from "@/components/scheduling/home";
import { Banner, Card, PrimaryButton } from "./primitives";
import {
  WEEKDAY_SHORT,
  formatHm,
  generateResourceSlots,
  parseAvailableHours,
  resourceTypeMeta,
  rulesSummary,
} from "./resourceMeta";

type ResourceBookingRow = Booking & { resource_id?: string | null };

const RULE_ICONS = [Timer, Check, Users];

function formatRange(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const hm = (d: Date) => {
    let h = d.getHours();
    const m = d.getMinutes();
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12 === 0 ? 12 : h % 12;
    return {
      t: m === 0 ? `${h}:00` : `${h}:${String(m).padStart(2, "0")}`,
      ap,
    };
  };
  const a = hm(s);
  const b = hm(e);
  return a.ap === b.ap
    ? `${a.t}–${b.t} ${b.ap}`
    : `${a.t} ${a.ap}–${b.t} ${b.ap}`;
}

function dayKeyOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ResourceDetail({
  rid,
  canEdit,
  membersById,
  onBook,
  onTitle,
}: {
  rid: string;
  canEdit: boolean;
  membersById: Map<string, HomeMember>;
  onBook: (opts?: { date?: string }) => void;
  onTitle?: (title: string) => void;
}) {
  const owner = useSchedulingOwner();
  const [resource, setResource] = useState<Resource | null>(null);
  const [bookings, setBookings] = useState<ResourceBookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [resRes, bookRes] = await Promise.all([
        scheduling.listResources(owner),
        scheduling
          .listBookings({}, owner)
          .catch(() => ({ bookings: [] as Booking[] })),
      ]);
      const found = resRes.resources.find((r) => r.id === rid) ?? null;
      setResource(found);
      setBookings(
        (bookRes.bookings as ResourceBookingRow[]).filter(
          (b) => b.resource_id === rid,
        ),
      );
      if (!found) setError(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [owner, rid]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (resource && onTitle) onTitle(resource.name);
  }, [resource, onTitle]);

  // Captured once per mount — "now" only drives free/booked display, which does
  // not need second-by-second precision; a reload re-mounts this view anyway.
  const now = useMemo(() => new Date(), []);

  const confirmed = useMemo(
    () =>
      bookings
        .filter((b) => b.status === "confirmed" && new Date(b.end_at) >= now)
        .sort(
          (a, b) =>
            new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
        ),
    [bookings, now],
  );

  const pending = useMemo(
    () =>
      bookings
        .filter((b) => b.status === "pending")
        .sort(
          (a, b) =>
            new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
        ),
    [bookings],
  );

  const dayGroups = useMemo(() => {
    const map = new Map<string, ResourceBookingRow[]>();
    for (const b of confirmed) {
      const k = dayKeyOf(b.start_at);
      const arr = map.get(k);
      if (arr) arr.push(b);
      else map.set(k, [b]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [confirmed]);

  const nextOpening = useMemo(() => {
    if (!resource) return null;
    const from = dayKeyOf(now.toISOString());
    const toDate = new Date(now);
    toDate.setDate(toDate.getDate() + 14);
    const slots = generateResourceSlots({
      availableHours: parseAvailableHours(resource.available_hours),
      durationMin: Math.min(resource.max_duration_min ?? 60, 60),
      bufferMin: resource.buffer_min,
      existingBookings: bookings.filter(
        (b) => b.status === "confirmed" || b.status === "pending",
      ),
      fromDate: from,
      toDate: dayKeyOf(toDate.toISOString()),
      intervalMin: 60,
      minStart: now,
    });
    return slots[0] ?? null;
  }, [resource, bookings, now]);

  const fullyBookedToday = useMemo(() => {
    if (!nextOpening) return confirmed.length > 0;
    const todayKey = dayKeyOf(now.toISOString());
    const freeToday = dayKeyOf(nextOpening.start) === todayKey;
    const bookedToday = confirmed.some(
      (b) => dayKeyOf(b.start_at) === todayKey,
    );
    return !freeToday && bookedToday;
  }, [nextOpening, confirmed, now]);

  const act = async (id: string, kind: "approve" | "decline") => {
    setActing(id);
    try {
      if (kind === "approve") await scheduling.approveBooking(id, owner);
      else await scheduling.declineBooking(id, undefined, owner);
      await load();
    } catch (err) {
      // Non-fatal: surface as a transient row state by reloading; log decoded msg.
      void decodeError(err);
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-2.5">
        <Card>
          <div className="flex items-center gap-3">
            <div className="h-[46px] w-[46px] shrink-0 animate-pulse rounded-xl bg-app-surface-sunken" />
            <div className="flex-1">
              <div className="h-3.5 w-1/2 animate-pulse rounded bg-app-surface-sunken" />
              <div className="mt-2 h-3.5 w-14 animate-pulse rounded-full bg-app-surface-sunken" />
            </div>
          </div>
          <div className="mt-3 flex gap-1.5">
            <div className="h-5 w-16 animate-pulse rounded-full bg-app-surface-sunken" />
            <div className="h-5 w-20 animate-pulse rounded-full bg-app-surface-sunken" />
          </div>
        </Card>
        {[0, 1, 2].map((i) => (
          <Card key={i} className="!p-3">
            <div className="flex items-center gap-3">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-app-surface-sunken" />
              <div className="flex-1">
                <div className="h-3 w-1/2 animate-pulse rounded bg-app-surface-sunken" />
                <div className="mt-1.5 h-2.5 w-1/3 animate-pulse rounded bg-app-surface-sunken" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !resource) {
    return (
      <div className="flex flex-col items-center justify-center px-7 py-16 text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-app-error-bg">
          <CloudOff className="h-7 w-7 text-app-error" />
        </div>
        <div className="text-[15.5px] font-bold text-app-text">
          Couldn&apos;t load this resource
        </div>
        <p className="mt-1.5 max-w-[220px] text-[12.5px] text-app-text-secondary">
          Check your connection and try again.
        </p>
        <div className="mt-4 w-40">
          <PrimaryButton icon={RotateCw} onClick={() => void load()}>
            Retry
          </PrimaryButton>
        </div>
      </div>
    );
  }

  const meta = resourceTypeMeta(resource.resource_type);
  const chips = rulesSummary(resource);

  return (
    <div className="flex flex-col gap-2.5 pb-24">
      {/* Header */}
      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl bg-app-home-bg text-app-home">
            <meta.Icon className="h-[23px] w-[23px]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[16px] font-bold tracking-tight text-app-text">
              {resource.name}
            </div>
            <span className="mt-1 inline-flex rounded-full bg-app-surface-sunken px-2 py-0.5 text-[10px] font-semibold text-app-text-secondary">
              {meta.label}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c, i) => {
            const Icon = RULE_ICONS[i];
            return (
              <span
                key={c}
                className="inline-flex items-center gap-1 rounded-full bg-app-home-bg px-2.5 py-1 text-[10.5px] font-semibold text-app-home"
              >
                <Icon className="h-[11px] w-[11px]" />
                {c}
              </span>
            );
          })}
        </div>
        {canEdit && pending.length > 0 && (
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2 rounded-xl border border-app-warning/30 bg-app-warning-bg px-3 py-2 text-left transition hover:brightness-[0.97]"
            onClick={() => {
              const el = document.getElementById("approval-queue");
              el?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <Clock className="h-3.5 w-3.5 shrink-0 text-app-warning" />
            <span className="flex-1 text-[12px] font-bold text-app-warning">
              Pending approval ({pending.length})
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-app-warning" />
          </button>
        )}
      </Card>

      {fullyBookedToday && nextOpening && (
        <Banner tone="amber" icon={CalendarX} title="Fully booked today">
          Next opening is {WEEKDAY_SHORT[new Date(nextOpening.start).getDay()]}{" "}
          {formatHm(nextOpening.startLocal.slice(11, 16))}. You can still book
          that.
        </Banner>
      )}

      {/* Approval queue */}
      {canEdit && pending.length > 0 && (
        <Card>
          <div className="mb-2.5 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-app-warning" />
            <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-app-warning">
              Approval queue · {pending.length}
            </span>
          </div>
          {pending.map((b, i) => {
            const member = b.invitee_user_id
              ? membersById.get(b.invitee_user_id)
              : undefined;
            return (
              <div
                key={b.id}
                className={`py-3 ${i === pending.length - 1 ? "" : "border-b border-app-border"}`}
              >
                <div className="mb-2.5 flex items-center gap-2.5">
                  {member && <Avatar member={member} size={30} />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-bold text-app-text">
                      {b.invitee_name || member?.name || "Member"}
                    </div>
                    <div className="mt-0.5 text-[11px] text-app-text-secondary">
                      {WEEKDAY_SHORT[new Date(b.start_at).getDay()]}{" "}
                      {new Date(b.start_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      · {formatRange(b.start_at, b.end_at)}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={acting === b.id}
                    onClick={() => act(b.id, "approve")}
                    className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-app-home text-[12px] font-bold text-white transition hover:brightness-105 disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={acting === b.id}
                    onClick={() => act(b.id, "decline")}
                    className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-app-border-strong bg-app-surface text-[12px] font-bold text-app-text-secondary transition hover:bg-app-surface-sunken disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    Decline
                  </button>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* Bookings agenda */}
      <div className="px-0.5 pt-1 text-[11px] font-bold uppercase tracking-[0.06em] text-app-text-secondary">
        {pending.length > 0 && canEdit ? "Confirmed" : "Upcoming bookings"}
      </div>
      {dayGroups.length === 0 ? (
        <Card className="text-center">
          <div className="text-[13px] font-semibold text-app-text">
            No bookings yet
          </div>
          <p className="mt-1 text-[11.5px] text-app-text-secondary">
            This resource is free. Tap Book this to reserve a time.
          </p>
        </Card>
      ) : (
        dayGroups.map(([key, rows]) => (
          <div key={key} className="flex flex-col gap-2">
            <div className="px-0.5 pt-1 text-[11px] font-bold text-app-text-secondary">
              {formatDayHeading(new Date(`${key}T00:00:00`), now)}
            </div>
            {rows.map((b) => {
              const member = b.invitee_user_id
                ? membersById.get(b.invitee_user_id)
                : undefined;
              return (
                <Card key={b.id} className="!p-3">
                  <div className="flex items-center gap-3">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-app-success" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold tracking-tight text-app-text">
                        {formatRange(b.start_at, b.end_at)}
                      </div>
                      {(b.invitee_name || member) && (
                        <div className="mt-0.5 text-[11px] text-app-text-secondary">
                          For: {b.invitee_name || member?.name}
                        </div>
                      )}
                    </div>
                    {member && <Avatar member={member} size={26} />}
                  </div>
                </Card>
              );
            })}
          </div>
        ))
      )}

      {/* Sticky footer */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-app-border bg-app-surface/95 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 py-3">
          {fullyBookedToday && nextOpening ? (
            <PrimaryButton
              icon={CalendarClock}
              onClick={() => onBook({ date: dayKeyOf(nextOpening.start) })}
            >
              Book next opening ·{" "}
              {WEEKDAY_SHORT[new Date(nextOpening.start).getDay()]}{" "}
              {formatHm(nextOpening.startLocal.slice(11, 16))}
            </PrimaryButton>
          ) : (
            <PrimaryButton icon={Plus} onClick={() => onBook()}>
              Book this
            </PrimaryButton>
          )}
        </div>
      </div>
    </div>
  );
}
