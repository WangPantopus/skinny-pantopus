"use client";

// B5 — Weekly hours grid. One row per weekday (Monday-first) with a left on/off
// toggle. When on, one or more time-range blocks (start + end native time
// inputs) plus "Add a block" and a "Copy to other days" popover that clones the
// row's hours onto chosen days. All controls stay product/personal sky.

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Clock, Copy, Plus, X } from "lucide-react";
import clsx from "clsx";
import { Toggle } from "./primitives";
import { dayName, to12h, WEEK_ORDER_MON_FIRST } from "./format";
import { DEFAULT_BLOCK, type DayModel, type DayBlock } from "./serialize";

/**
 * TimeBlockRow — Design: a labeled button (clock + "9:00 AM – 5:00 PM" + chevron-down)
 * that opens an inline expanded editor with the actual time inputs. Matches the
 * weekly-hours-frames.jsx TimeRangeButton idiom on web without a native time-range picker.
 */
function TimeBlockRow({
  block,
  removable,
  disabled,
  onChange,
  onRemove,
}: {
  block: DayBlock;
  removable: boolean;
  disabled?: boolean;
  onChange: (next: DayBlock) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const invalid = block.start && block.end && block.end <= block.start;
  const rangeText =
    block.start && block.end
      ? `${to12h(block.start)} – ${to12h(block.end)}`
      : "Set time range";

  return (
    <div className="flex flex-col gap-0">
      <div className="flex items-center gap-2">
        {/* Labeled time-range button per design's TimeRangeButton */}
        <button
          type="button"
          aria-label={`Time block: ${rangeText}. Edit time range.`}
          disabled={disabled}
          onClick={() => !disabled && setExpanded((v) => !v)}
          className={clsx(
            "flex flex-1 items-center gap-2 rounded-lg border bg-app-surface px-2.5 py-2 text-left shadow-sm transition",
            invalid
              ? "border-app-error"
              : expanded
                ? "border-app-personal"
                : "border-app-border hover:border-app-personal/50",
            disabled && "cursor-default opacity-70",
          )}
        >
          <Clock
            className="h-3.5 w-3.5 shrink-0 text-app-personal"
            aria-hidden
          />
          <span className="flex-1 text-[13px] font-semibold tabular-nums text-app-text">
            {rangeText}
          </span>
          <ChevronDown
            className={clsx(
              "h-3.5 w-3.5 text-app-text-muted transition-transform",
              expanded && "rotate-180",
            )}
            aria-hidden
          />
        </button>
        {removable && !disabled && (
          <button
            type="button"
            aria-label="Remove time block"
            onClick={onRemove}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-app-text-muted hover:bg-app-hover hover:text-app-text"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      {/* Inline time inputs — shown when the labeled button is expanded */}
      {expanded && !disabled && (
        <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-app-personal/40 bg-app-surface px-2.5 py-1.5">
          <input
            type="time"
            aria-label="Start time"
            value={block.start}
            onChange={(e) => onChange({ ...block, start: e.target.value })}
            className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold tabular-nums text-app-text outline-none"
          />
          <span className="text-app-text-muted">–</span>
          <input
            type="time"
            aria-label="End time"
            value={block.end}
            onChange={(e) => onChange({ ...block, end: e.target.value })}
            className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold tabular-nums text-app-text outline-none"
          />
        </div>
      )}
    </div>
  );
}

function CopyMenu({
  sourceWeekday,
  onCopy,
  onClose,
}: {
  sourceWeekday: number;
  onCopy: (targets: number[]) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const targets = WEEK_ORDER_MON_FIRST.filter((wd) => wd !== sourceWeekday);
  const [checked, setChecked] = useState<Set<number>>(new Set());

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose]);

  const toggle = (wd: number) =>
    setChecked((cur) => {
      const next = new Set(cur);
      if (next.has(wd)) next.delete(wd);
      else next.add(wd);
      return next;
    });

  return (
    <div
      ref={ref}
      className="absolute right-0 top-9 z-30 w-52 overflow-hidden rounded-xl border border-app-border bg-app-surface shadow-xl"
    >
      <div className="border-b border-app-border px-3 py-2.5">
        <div className="text-[12.5px] font-bold text-app-text">
          Copy to other days
        </div>
        <div className="mt-0.5 text-[10.5px] text-app-text-secondary">
          {dayName(sourceWeekday)}&apos;s hours
        </div>
      </div>
      <div className="max-h-44 overflow-auto py-1">
        {targets.map((wd) => {
          const on = checked.has(wd);
          return (
            <button
              key={wd}
              type="button"
              onClick={() => toggle(wd)}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-app-hover"
            >
              <span
                className={clsx(
                  "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border",
                  on
                    ? "border-app-personal bg-app-personal text-white"
                    : "border-app-border-strong bg-app-surface",
                )}
              >
                {on && (
                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                )}
              </span>
              <span className="text-[12.5px] font-medium text-app-text">
                {dayName(wd)}
              </span>
            </button>
          );
        })}
      </div>
      <div className="border-t border-app-border p-2">
        <button
          type="button"
          disabled={checked.size === 0}
          onClick={() => {
            onCopy([...checked]);
            onClose();
          }}
          className="w-full rounded-lg bg-app-personal py-2 text-[12px] font-bold text-white disabled:opacity-50"
        >
          Copy to {checked.size} {checked.size === 1 ? "day" : "days"}
        </button>
      </div>
    </div>
  );
}

function DayRow({
  day,
  disabled,
  onChange,
  onCopyTo,
  last,
}: {
  day: DayModel;
  disabled?: boolean;
  onChange: (next: DayModel) => void;
  onCopyTo: (targets: number[], blocks: DayBlock[]) => void;
  last?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const setBlock = (i: number, next: DayBlock) =>
    onChange({
      ...day,
      blocks: day.blocks.map((b, idx) => (idx === i ? next : b)),
    });
  const removeBlock = (i: number) =>
    onChange({ ...day, blocks: day.blocks.filter((_, idx) => idx !== i) });
  const addBlock = () =>
    onChange({
      ...day,
      blocks: [...day.blocks, { ...DEFAULT_BLOCK }],
    });

  return (
    <div
      className={clsx(
        "py-3",
        !last && "border-b border-app-border",
        disabled && "opacity-70",
      )}
    >
      <div className="relative flex items-center gap-3">
        <Toggle
          on={day.on}
          disabled={disabled}
          label={dayName(day.weekday)}
          onChange={(on) =>
            onChange({
              ...day,
              on,
              blocks:
                on && day.blocks.length === 0
                  ? [{ ...DEFAULT_BLOCK }]
                  : day.blocks,
            })
          }
        />
        <span
          className={clsx(
            "text-[13px] font-semibold",
            day.on ? "text-app-text" : "text-app-text-secondary",
          )}
        >
          {dayName(day.weekday)}
        </span>
        <span className="flex-1" />
        {day.on ? (
          <button
            type="button"
            aria-label={`Copy ${dayName(day.weekday)}'s hours to other days`}
            disabled={disabled}
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-app-text-muted hover:bg-app-hover hover:text-app-text"
          >
            <Copy className="h-4 w-4" aria-hidden />
          </button>
        ) : (
          <span className="text-[11.5px] font-medium text-app-text-muted">
            Unavailable
          </span>
        )}
        {menuOpen && (
          <CopyMenu
            sourceWeekday={day.weekday}
            onCopy={(targets) => onCopyTo(targets, day.blocks)}
            onClose={() => setMenuOpen(false)}
          />
        )}
      </div>

      {day.on && (
        <div className="mt-2.5 flex flex-col gap-2 pl-12">
          {day.blocks.map((b, i) => (
            <TimeBlockRow
              key={i}
              block={b}
              removable={day.blocks.length > 1}
              disabled={disabled}
              onChange={(next) => setBlock(i, next)}
              onRemove={() => removeBlock(i)}
            />
          ))}
          {!disabled && (
            <button
              type="button"
              onClick={addBlock}
              className="inline-flex items-center gap-1.5 self-start py-0.5 text-[12px] font-semibold text-app-personal"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden /> Add
              a block
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function WeeklyHoursGrid({
  days,
  disabled,
  onChange,
}: {
  days: DayModel[];
  disabled?: boolean;
  onChange: (next: DayModel[]) => void;
}) {
  const setDay = (weekday: number, next: DayModel) =>
    onChange(days.map((d) => (d.weekday === weekday ? next : d)));

  const copyTo = (
    sourceWeekday: number,
    targets: number[],
    blocks: DayBlock[],
  ) =>
    onChange(
      days.map((d) =>
        targets.includes(d.weekday)
          ? {
              ...d,
              on: blocks.length > 0,
              blocks: blocks.map((b) => ({ ...b })),
            }
          : d,
      ),
    );

  return (
    <div>
      {days.map((day, i) => (
        <DayRow
          key={day.weekday}
          day={day}
          disabled={disabled}
          last={i === days.length - 1}
          onChange={(next) => setDay(day.weekday, next)}
          onCopyTo={(targets, blocks) => copyTo(day.weekday, targets, blocks)}
        />
      ))}
    </div>
  );
}
