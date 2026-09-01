"use client";

// F5 — Find a Time · Suggested Slots. Renders the ranked common-free times from
// GET /find-a-time. Each row composes the selected members' availability from the
// slot's `eligibleHosts`: solid dots for whoever's free, dimmed for who isn't,
// plus an "All N free" / "K of N free" label. The earliest match is flagged Best.
// "Book it" hands the chosen time to the household add-event flow (W10); the
// footer turns the whole set into a poll proposal members can vote on (F6).

import { useState } from "react";
import {
  CalendarCheck,
  CalendarPlus,
  CalendarX,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Send,
  Star,
  UserCheck,
  UserMinus,
} from "lucide-react";
import clsx from "clsx";
import type { BookingSlot, FindATimeMode } from "@pantopus/types";
import MemberAvatar from "./MemberAvatar";
import { slotLabelFor } from "./format";
import { shortName, type MemberView } from "./members";

function eligibleSet(slot: BookingSlot, fallback: string[]): Set<string> {
  return new Set(
    slot.eligibleHosts && slot.eligibleHosts.length
      ? slot.eligibleHosts
      : fallback,
  );
}

function AvailDots({
  members,
  eligible,
  mode,
}: {
  members: MemberView[];
  eligible: Set<string>;
  mode: FindATimeMode;
}) {
  const freeCount = members.filter((m) => eligible.has(m.userId)).length;
  const all = freeCount === members.length;
  const cover =
    mode === "round_robin" ? members.find((m) => eligible.has(m.userId)) : null;
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex">
        {members.map((m, i) => (
          <div key={m.userId} className={clsx("relative", i > 0 && "-ml-1.5")}>
            <MemberAvatar
              member={m}
              size="sm"
              dim={!eligible.has(m.userId)}
              className="ring-2 ring-app-surface"
            />
          </div>
        ))}
      </div>
      {cover ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-app-home-bg px-2 py-0.5 text-[10px] font-bold text-app-home">
          <UserCheck className="h-2.5 w-2.5" aria-hidden />{" "}
          {shortName(cover.name)} covers
        </span>
      ) : (
        <span
          className={clsx(
            "text-[11px] font-semibold",
            all ? "text-app-home" : "text-app-text-secondary",
          )}
        >
          {all
            ? `All ${members.length} free`
            : `${freeCount} of ${members.length} free`}
        </span>
      )}
    </div>
  );
}

function SlotRow({
  slot,
  members,
  mode,
  requiredIds,
  durationMin,
  best,
  onBook,
}: {
  slot: BookingSlot;
  members: MemberView[];
  mode: FindATimeMode;
  requiredIds: string[];
  durationMin: number;
  best?: boolean;
  onBook: (slot: BookingSlot) => void;
}) {
  const [open, setOpen] = useState(Boolean(best));
  const l = slotLabelFor(slot);
  const eligible = eligibleSet(slot, requiredIds);
  return (
    <div
      className={clsx(
        "overflow-hidden rounded-2xl border bg-app-surface transition-shadow",
        best || open ? "border-app-home shadow-sm" : "border-app-border",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-app-text">
              {l.weekday} {l.monthDay} · {l.time}
            </span>
            {best && (
              <span className="inline-flex items-center gap-1 rounded-full bg-app-home-bg px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-app-home">
                <Star className="h-2.5 w-2.5" aria-hidden /> Best
              </span>
            )}
          </div>
          <div className="mt-1.5">
            <AvailDots members={members} eligible={eligible} mode={mode} />
          </div>
        </div>
        {open ? (
          <ChevronUp
            className="h-4 w-4 flex-shrink-0 text-app-text-muted"
            aria-hidden
          />
        ) : (
          <ChevronDown
            className="h-4 w-4 flex-shrink-0 text-app-text-muted"
            aria-hidden
          />
        )}
      </button>
      {open && (
        <div className="border-t border-app-border bg-app-home-bg/40 px-3.5 py-3">
          <p className="mb-2.5 flex items-center gap-1.5 text-xs text-app-text-secondary">
            <CalendarCheck className="h-3.5 w-3.5 text-app-home" aria-hidden />
            Book {l.weekday} {l.monthDay} · {l.time} · {durationMin} min
          </p>
          <button
            type="button"
            onClick={() => onBook(slot)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-app-home px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
          >
            <Check className="h-4 w-4" aria-hidden /> Book it
          </button>
        </div>
      )}
    </div>
  );
}

export default function SuggestedSlots({
  slots,
  members,
  requiredIds,
  mode,
  durationMin,
  peopleCount,
  windowLabel,
  tz,
  onChangeTz,
  onEdit,
  onBook,
  onSendProposal,
  sending,
}: {
  slots: BookingSlot[];
  members: MemberView[];
  requiredIds: string[];
  mode: FindATimeMode;
  durationMin: number;
  peopleCount: number;
  windowLabel: string;
  tz: string;
  onChangeTz: () => void;
  /** Edit is handled by the page's top-bar button; kept for API compat */
  onEdit: () => void;
  onBook: (slot: BookingSlot) => void;
  onSendProposal: () => void;
  sending: boolean;
}) {
  const durationLabel = durationMin === 60 ? "1 hr" : `${durationMin} min`;

  return (
    <div className="space-y-4">
      {/* Sub-head */}
      <div className="flex flex-col gap-2 rounded-2xl border border-app-border bg-app-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm font-semibold text-app-text">
          {peopleCount} {peopleCount === 1 ? "person" : "people"} ·{" "}
          {durationLabel} · {windowLabel}
        </span>
        <button
          type="button"
          onClick={onChangeTz}
          className="inline-flex w-fit items-center gap-1.5 rounded-full bg-app-surface-muted px-2.5 py-1 text-[11px] font-bold text-app-text-secondary hover:bg-app-hover"
        >
          <Clock className="h-3 w-3" aria-hidden /> {tz}
          <ChevronDown className="h-3 w-3" aria-hidden />
        </button>
      </div>

      {slots.length === 0 ? (
        // No-overlap empty — never a dead end; both actions return to setup.
        <div className="flex flex-col items-center rounded-2xl border border-app-border bg-app-surface px-6 py-12 text-center">
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-app-warning-bg text-app-warning">
            <CalendarX className="h-7 w-7" aria-hidden />
          </span>
          <h2 className="text-base font-bold text-app-text">
            No time works for all {peopleCount}
          </h2>
          <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-app-text-secondary">
            Their free hours don&apos;t overlap in this window. Loosen a
            constraint to see options.
          </p>
          <div className="mt-5 flex w-full max-w-xs flex-col gap-2.5">
            <button
              type="button"
              onClick={onEdit}
              className="flex items-center justify-center gap-2 rounded-xl bg-app-home px-4 py-2.5 text-sm font-bold text-white hover:opacity-90"
            >
              <UserMinus className="h-4 w-4" aria-hidden /> Make someone
              optional
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="flex items-center justify-center gap-2 rounded-xl border border-app-border bg-app-surface px-4 py-2.5 text-sm font-bold text-app-text-secondary hover:bg-app-hover"
            >
              <CalendarPlus className="h-4 w-4" aria-hidden /> Widen the window
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-app-text-secondary">
            <span className="inline-flex items-center gap-1 text-app-home">
              <Star className="h-3 w-3" aria-hidden />
            </span>
            {slots.length === 1
              ? "One time works for everyone"
              : "Tap a time to book it, or send all as a poll"}
          </p>
          <div className="space-y-2.5">
            {slots.map((slot, i) => (
              <SlotRow
                key={`${slot.start}-${slot.end}`}
                slot={slot}
                members={members}
                mode={mode}
                requiredIds={requiredIds}
                durationMin={durationMin}
                best={i === 0}
                onBook={onBook}
              />
            ))}
          </div>
          {/* Sticky footer: design shows a single full-width SecondaryBtn "Send proposal to members" */}
          <div className="sticky bottom-0 -mx-1 bg-gradient-to-t from-app-bg via-app-bg/95 to-transparent pb-1 pt-3">
            <button
              type="button"
              onClick={onSendProposal}
              disabled={sending}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-app-home bg-app-surface px-4 py-3 text-sm font-bold text-app-home transition hover:bg-app-home-bg disabled:opacity-60"
            >
              <Send className="h-4 w-4" aria-hidden />
              {sending ? "Sending…" : "Send proposal to members"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
