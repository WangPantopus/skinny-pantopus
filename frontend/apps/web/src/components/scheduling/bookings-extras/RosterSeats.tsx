"use client";

// E8 — Group Event Roster & Seats. Presentational: a capacity header (seats
// filled + bar + confirmed/pending/waitlisted stats), the seated attendee list,
// and the waitlist with per-row "Promote to seat" (enabled only while a seat is
// open). The host can message everyone and nudge the seat cap. Data + actions
// are wired by the roster page.

import { ArrowUp, Megaphone, Minus, Plus, UserPlus, Users } from "lucide-react";
import clsx from "clsx";
import type { BookingAttendee, WaitlistEntry } from "@pantopus/types";
import type { Pillar } from "@/components/scheduling/pillarTokens";
import { pillarTokens } from "@/components/scheduling/pillarTokens";
import { Avatar, CapacityBar, SectionOverline, Stat } from "./ui";
import { fmtDate } from "./format";
import type { Capacity } from "./roster";

function RsvpChip({ status }: { status: BookingAttendee["rsvp_status"] }) {
  const cfg =
    status === "going"
      ? { label: "Confirmed", cls: "bg-app-success-bg text-app-success" }
      : status === "declined"
        ? { label: "Declined", cls: "bg-app-error-bg text-app-error" }
        : { label: "Pending", cls: "bg-app-warning-bg text-app-warning" };
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold",
        cfg.cls,
      )}
    >
      {cfg.label}
    </span>
  );
}

export default function RosterSeats({
  pillar,
  capacity,
  attendees,
  waitlist,
  promotingId,
  onPromote,
  onMessageAll,
  onAdjustCapacity,
  onAddAttendee,
}: {
  pillar: Pillar;
  capacity: Capacity;
  attendees: BookingAttendee[];
  waitlist: WaitlistEntry[];
  promotingId: string | null;
  onPromote: (entry: WaitlistEntry) => void;
  onMessageAll?: () => void;
  onAdjustCapacity?: (next: number) => void;
  onAddAttendee?: () => void;
}) {
  const tk = pillarTokens(pillar);
  const seated = attendees.filter((a) => a.rsvp_status !== "declined");

  return (
    <div className="space-y-4">
      {/* Capacity header */}
      <div className="rounded-2xl border border-app-border bg-app-surface p-4 shadow-sm">
        <div className="mb-2.5 flex items-baseline justify-between gap-3">
          <span className="text-sm font-bold text-app-text">
            {capacity.filled} of {capacity.total} seats filled
            {capacity.waiting > 0 && ` · ${capacity.waiting} waiting`}
          </span>
          {capacity.full && (
            <span className="text-[10px] font-bold uppercase tracking-wide text-app-text-muted">
              All seats filled
            </span>
          )}
        </div>
        <CapacityBar pct={capacity.pct} full={capacity.full} pillar={pillar} />
        <div className="mt-3 flex gap-2">
          <Stat value={capacity.confirmed} label="Confirmed" tone="success" />
          <Stat value={capacity.pending} label="Pending" tone="warning" />
          <Stat value={capacity.waiting} label="Waitlisted" tone="neutral" />
        </div>
      </div>

      {/* Seated */}
      <div>
        <SectionOverline className="mb-2">
          Seated · {seated.length}
        </SectionOverline>
        {seated.length === 0 ? (
          <EmptySeats pillar={pillar} />
        ) : (
          <ul className="space-y-2">
            {seated.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-xl border border-app-border bg-app-surface px-3 py-2.5 shadow-sm"
              >
                <Avatar name={a.name} pillar={pillar} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-app-text">
                    {a.name || a.email || "Guest"}
                  </p>
                  {a.email && (
                    <p className="truncate text-[11px] text-app-text-muted">
                      {a.email}
                    </p>
                  )}
                </div>
                <RsvpChip status={a.rsvp_status} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Waitlist */}
      {waitlist.length > 0 && (
        <div>
          <SectionOverline className="mb-2">
            Waitlist · {waitlist.length}
            {capacity.open > 0 &&
              ` · ${capacity.open} seat${capacity.open === 1 ? "" : "s"} open`}
          </SectionOverline>
          <ul className="space-y-2">
            {waitlist.map((w, i) => {
              const canPromoteRow = capacity.open > 0;
              const busy = promotingId === w.id;
              return (
                <li
                  key={w.id}
                  className="rounded-xl border border-app-border bg-app-surface p-3 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={w.invitee_name} pillar={pillar} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-app-text">
                        {w.invitee_name || w.invitee_email || "Guest"}
                      </p>
                      <p className="truncate text-[11px] text-app-text-muted">
                        #{i + 1} · joined {fmtDate(w.created_at)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onPromote(w)}
                    disabled={!canPromoteRow || busy}
                    className={clsx(
                      "mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition",
                      canPromoteRow
                        ? clsx(tk.bgSoft, tk.text)
                        : "cursor-not-allowed bg-app-surface-sunken text-app-text-muted",
                    )}
                  >
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                    {busy ? "Promoting…" : "Promote to seat"}
                  </button>
                  {!canPromoteRow && (
                    <p className="mt-1.5 text-center text-[10px] text-app-text-muted">
                      Open a seat to promote
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Host controls — at bottom per design order (CapacityHeader → Seated → Waitlist → HostControls) */}
      {(onAddAttendee || onAdjustCapacity || onMessageAll) && (
        <div className="flex flex-col gap-2">
          {onMessageAll && (
            <button
              type="button"
              onClick={onMessageAll}
              disabled={seated.length === 0}
              className={clsx(
                "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
                tk.bg,
                tk.textOn,
              )}
            >
              <Megaphone className="h-4 w-4" aria-hidden />
              Message all
            </button>
          )}
          {onAddAttendee && (
            <button
              type="button"
              onClick={onAddAttendee}
              className="flex items-center gap-3 rounded-2xl border border-app-border bg-app-surface px-3.5 py-3 text-left transition hover:bg-app-hover"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                <UserPlus className="h-4 w-4" aria-hidden />
              </span>
              <span className="flex-1 text-sm font-semibold text-app-text">
                Add or invite attendee
              </span>
              <svg className="h-4 w-4 text-app-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M9 18l6-6-6-6"/></svg>
            </button>
          )}
          {onAdjustCapacity && (
            <div className="flex items-center gap-3 rounded-2xl border border-app-border bg-app-surface px-3.5 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-app-surface-sunken text-app-text-secondary">
                <Users className="h-4 w-4" aria-hidden />
              </span>
              <span className="flex-1 text-sm font-semibold text-app-text">
                Capacity
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Decrease capacity"
                  onClick={() => onAdjustCapacity(Math.max(1, capacity.total - 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-app-border text-app-text-secondary hover:bg-app-hover"
                >
                  <Minus className="h-3.5 w-3.5" aria-hidden />
                </button>
                <span className="min-w-[1.5rem] text-center text-sm font-bold tabular-nums text-app-text">
                  {capacity.total}
                </span>
                <button
                  type="button"
                  aria-label="Increase capacity"
                  onClick={() => onAdjustCapacity(capacity.total + 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-app-border text-app-text-secondary hover:bg-app-hover"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmptySeats({ pillar }: { pillar: Pillar }) {
  const tk = pillarTokens(pillar);
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-app-border bg-app-surface px-6 py-10 text-center">
      <span
        className={clsx(
          "flex h-14 w-14 items-center justify-center rounded-full",
          tk.bgSoft,
          tk.text,
        )}
      >
        <Users className="h-6 w-6" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-app-text">No signups yet</p>
      <p className="max-w-xs text-xs text-app-text-muted">
        Share the booking link to fill seats.
      </p>
    </div>
  );
}
