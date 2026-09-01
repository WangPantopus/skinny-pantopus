"use client";

// F7 — Who's Free heat grid. Composed from each member's personal availability
// (GET /whos-free returns free slots per member). We only know FREE windows, so
// every cell is one of: free (member has a free slot covering it), busy (no free
// slot), or unknown (member isn't in the response — hasn't shared free/busy).
// Tapping a free cell opens a small popover to plan something there.

import { useMemo, useRef, useState } from "react";
import { CalendarPlus, Users } from "lucide-react";
import clsx from "clsx";
import type { BookingSlot } from "@pantopus/types";
import MemberAvatar from "./MemberAvatar";
import { weekdayOf, MONTHS } from "./format";
import { shortName, type MemberView } from "./members";
import {
  BUCKETS,
  BUCKET_LABELS,
  bucketLabelFull,
  dayCellState,
  toSpans,
  weekCellState,
  type CellState,
  type SlotSpan,
} from "./gridState";

function Cell({
  state,
  onClick,
}: {
  state: CellState;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}) {
  const base = "relative h-7 rounded-md";

  if (state === "free") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="Free — plan something"
        className={clsx(
          base,
          "bg-app-home-bg transition hover:ring-2 hover:ring-app-home",
        )}
      >
        <span className="absolute left-1 top-1 h-1.5 w-1.5 rounded-full bg-app-home" />
      </button>
    );
  }

  // busy — solid neutral (#f3f4f6 per design)
  if (state === "busy") {
    return <div className={clsx(base, "bg-[#f3f4f6]")} />;
  }

  // tentative — amber (#fef3c7 per design)
  if (state === "tentative") {
    return <div className={clsx(base, "bg-[#fef3c7]")} />;
  }

  // off-hours — light with 45° hatch pattern (#f9fafb + diagonal stripe per design)
  if (state === "off") {
    return (
      <div
        className={clsx(base)}
        style={{
          background: "#f9fafb",
          backgroundImage:
            "repeating-linear-gradient(45deg, transparent, transparent 3px, #e8eaed 3px, #e8eaed 4px)",
        }}
      />
    );
  }

  // unknown — diagonal hatch (different stripe color per design)
  if (state === "unknown") {
    return (
      <div
        className={clsx(base, "flex items-center justify-center")}
        style={{
          background: "#f1f3f5",
          backgroundImage:
            "repeating-linear-gradient(45deg, #e2e5e9, #e2e5e9 3px, #f1f3f5 3px, #f1f3f5 6px)",
        }}
      >
        <span className="text-[10px] font-bold text-app-text-muted">?</span>
      </div>
    );
  }

  return <div className={clsx(base, "bg-app-surface-muted/60")} />;
}

function Legend({ hasOptedOut }: { hasOptedOut?: boolean }) {
  // Design: standard frame shows Free/Busy/Tentative/Off-hours.
  //         Opted-out frame replaces Off-hours with Unknown.
  const items: Array<[CellState, string]> = hasOptedOut
    ? [
        ["free", "Free"],
        ["busy", "Busy"],
        ["tentative", "Tentative"],
        ["unknown", "Unknown"],
      ]
    : [
        ["free", "Free"],
        ["busy", "Busy"],
        ["tentative", "Tentative"],
        ["off", "Off-hours"],
      ];

  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-app-border pt-3">
      {items.map(([s, label]) => (
        <div key={s} className="flex items-center gap-1.5">
          <div className="h-3.5 w-3.5 overflow-hidden rounded-[3px]">
            <Cell state={s} />
          </div>
          <span className="text-[11px] font-semibold text-app-text-secondary">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function WhosFreeGrid({
  members,
  freeByMember,
  known,
  view,
  dayKey,
  rangeDays,
  onFindTime,
  onAddEvent,
}: {
  members: MemberView[];
  freeByMember: Record<string, BookingSlot[]>;
  /** Set of member userIds present in the response (others render as unknown). */
  known: Set<string>;
  view: "day" | "week";
  dayKey: string;
  rangeDays: string[];
  onFindTime: (member: MemberView) => void;
  onAddEvent: (member: MemberView, dateKey: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [popover, setPopover] = useState<{
    left: number;
    top: number;
    member: MemberView;
    dateKey: string;
    label: string;
  } | null>(null);

  const spansByMember = useMemo(() => {
    const map: Record<string, SlotSpan[]> = {};
    for (const m of members) map[m.userId] = toSpans(freeByMember[m.userId]);
    return map;
  }, [members, freeByMember]);

  const cols = view === "day" ? BUCKETS.length : rangeDays.length;
  const colLabels =
    view === "day"
      ? BUCKET_LABELS
      : rangeDays.map((d) => `${weekdayOf(d)} ${Number(d.slice(8, 10))}`);

  const openPopover = (
    e: React.MouseEvent<HTMLElement>,
    member: MemberView,
    dateKey: string,
    label: string,
  ) => {
    const wrap = wrapRef.current?.getBoundingClientRect();
    const cell = e.currentTarget.getBoundingClientRect();
    if (!wrap) return;
    setPopover({
      left: Math.min(cell.left - wrap.left, wrap.width - 150),
      top: cell.bottom - wrap.top + 4,
      member,
      dateKey,
      label,
    });
  };

  return (
    <div ref={wrapRef} className="relative">
      <div
        className="grid items-center gap-1.5"
        style={{ gridTemplateColumns: `64px repeat(${cols}, minmax(0, 1fr))` }}
      >
        <div />
        {colLabels.map((c) => (
          <div
            key={c}
            className="text-center text-[9px] font-bold text-app-text-muted"
          >
            {c}
          </div>
        ))}
        {members.map((m) => {
          const isKnown = known.has(m.userId);
          const spans = spansByMember[m.userId] ?? [];
          return (
            <div key={m.userId} className="contents">
              <div className="flex min-w-0 items-center gap-1.5">
                <MemberAvatar member={m} size="xs" dim={!isKnown} />
                <span className="truncate text-[10.5px] font-semibold text-app-text">
                  {shortName(m.name)}
                </span>
              </div>
              {view === "day"
                ? BUCKETS.map((b, ci) => {
                    const state = dayCellState(spans, isKnown, dayKey, b);
                    return (
                      <Cell
                        key={ci}
                        state={state}
                        onClick={
                          state === "free"
                            ? (e) =>
                                openPopover(
                                  e,
                                  m,
                                  dayKey,
                                  `${shortName(m.name)} · ${bucketLabelFull(b)} · free`,
                                )
                            : undefined
                        }
                      />
                    );
                  })
                : rangeDays.map((d, ci) => {
                    const state = weekCellState(spans, isKnown, d);
                    return (
                      <Cell
                        key={ci}
                        state={state}
                        onClick={
                          state === "free"
                            ? (e) =>
                                openPopover(
                                  e,
                                  m,
                                  d,
                                  `${shortName(m.name)} · ${weekdayOf(d)} ${MONTHS[+d.slice(5, 7) - 1]} ${+d.slice(8, 10)} · free`,
                                )
                            : undefined
                        }
                      />
                    );
                  })}
            </div>
          );
        })}
      </div>

      <Legend hasOptedOut={members.some((m) => !known.has(m.userId))} />

      {popover && (
        <>
          <button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setPopover(null)}
          />
          <div
            className="absolute z-20 w-[150px] rounded-xl border border-app-border bg-app-surface p-2 shadow-lg"
            style={{ left: popover.left, top: popover.top }}
          >
            <p className="px-1 pb-1.5 pt-0.5 text-[10.5px] font-bold text-app-text">
              {popover.label}
            </p>
            <button
              type="button"
              onClick={() => {
                onFindTime(popover.member);
                setPopover(null);
              }}
              className="mb-1 flex w-full items-center gap-1.5 rounded-lg bg-app-home-bg px-2 py-1.5 text-[11px] font-bold text-app-home"
            >
              <Users className="h-3 w-3" aria-hidden /> Find a time here
            </button>
            <button
              type="button"
              onClick={() => {
                onAddEvent(popover.member, popover.dateKey);
                setPopover(null);
              }}
              className="flex w-full items-center gap-1.5 rounded-lg border border-app-border bg-app-surface px-2 py-1.5 text-[11px] font-bold text-app-text-secondary"
            >
              <CalendarPlus className="h-3 w-3" aria-hidden /> Add event
            </button>
          </div>
        </>
      )}
    </div>
  );
}
