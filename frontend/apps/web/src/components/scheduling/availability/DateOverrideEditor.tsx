"use client";

// B6 — Date overrides & holidays. A month calendar to pick a date, a picker
// block to mark it Unavailable or set Custom hours, a "block a date range"
// affordance, the list of existing overrides (delete each), and a US public-
// holiday set that imports/removes the 11 federal holidays as a group.
// The parent owns persistence: every mutation calls onChange with the full,
// replacement override set (PUT /availability/:id/overrides is whole-set).

import { useMemo, useState } from "react";
import {
  CalendarOff,
  CalendarRange,
  CalendarX,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import clsx from "clsx";
import type { AvailabilityOverride } from "@pantopus/types";
import { Card, FieldLabel, Segmented, ToggleRow } from "./primitives";
import {
  formatDateLabel,
  formatMonthLabel,
  parseISODate,
  toISODate,
  todayISO,
  rangeLabel,
} from "./format";
import { usFederalHolidays } from "./serialize";

const WEEK_HEADER = ["S", "M", "T", "W", "T", "F", "S"];

function monthCursor(iso: string): { year: number; month: number } {
  const d = parseISODate(iso);
  return { year: d.getFullYear(), month: d.getMonth() }; // month 0-11
}

function upsert(
  overrides: AvailabilityOverride[],
  next: AvailabilityOverride,
): AvailabilityOverride[] {
  const without = overrides.filter((o) => o.date !== next.date);
  return [...without, next].sort((a, b) => a.date.localeCompare(b.date));
}

function MonthCalendar({
  cursorISO,
  selected,
  overrides,
  holidayDates,
  onCursor,
  onSelect,
}: {
  cursorISO: string;
  selected: string | null;
  overrides: AvailabilityOverride[];
  holidayDates: Set<string>;
  onCursor: (next: string) => void;
  onSelect: (iso: string) => void;
}) {
  const { year, month } = monthCursor(cursorISO);
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = first.getDay();
  const overrideDates = useMemo(
    () => new Map(overrides.map((o) => [o.date, o])),
    [overrides],
  );

  const cells: Array<string | null> = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++)
    cells.push(toISODate(new Date(year, month, d)));

  const shift = (delta: number) =>
    onCursor(toISODate(new Date(year, month + delta, 1)));

  return (
    <Card>
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[13.5px] font-bold text-app-text">
          {formatMonthLabel(cursorISO)}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => shift(-1)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-app-text-secondary hover:bg-app-hover"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => shift(1)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-app-text-secondary hover:bg-app-hover"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7">
        {WEEK_HEADER.map((w, i) => (
          <div
            key={i}
            className="py-1 text-center text-[9.5px] font-bold text-app-text-muted"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((iso, i) => {
          if (!iso) return <div key={i} />;
          const day = parseISODate(iso).getDate();
          const sel = iso === selected;
          const ov = overrideDates.get(iso);
          const holiday = holidayDates.has(iso);
          const marked = !!ov || holiday;
          return (
            <div key={i} className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => onSelect(iso)}
                aria-pressed={sel}
                aria-label={formatDateLabel(iso)}
                className={clsx(
                  "relative flex h-8 w-8 items-center justify-center rounded-full text-[12px] tabular-nums",
                  sel
                    ? "bg-app-personal font-bold text-white"
                    : "font-medium text-app-text hover:bg-app-hover",
                )}
              >
                {day}
                {marked && !sel && (
                  <span
                    className={clsx(
                      "absolute bottom-1 h-1 w-1 rounded-full",
                      ov && !ov.is_unavailable
                        ? "bg-app-personal"
                        : "bg-app-text-muted",
                    )}
                  />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function DateOverrideEditor({
  overrides,
  onChange,
  saving,
}: {
  overrides: AvailabilityOverride[];
  onChange: (next: AvailabilityOverride[]) => void;
  saving?: boolean;
}) {
  const [cursorISO, setCursorISO] = useState<string>(() => {
    const t = todayISO();
    return `${t.slice(0, 8)}01`;
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [choice, setChoice] = useState<"unavailable" | "custom">("unavailable");
  // Design (AVAIL-08): custom hours are a LIST of blocks with a "+ Add a block" affordance —
  // each block becomes its own override row for the date (the engine honors split windows).
  const [customBlocks, setCustomBlocks] = useState<
    Array<{ start: string; end: string }>
  >([{ start: "10:00", end: "14:00" }]);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [rangeOpen, setRangeOpen] = useState(false);

  const year = monthCursor(cursorISO).year;
  const holidays = useMemo(() => usFederalHolidays(year), [year]);
  const holidayDates = useMemo(
    () => new Set(holidays.map((h) => h.date)),
    [holidays],
  );
  const holidaySetOn = holidays.every((h) =>
    overrides.some((o) => o.date === h.date && o.is_unavailable),
  );

  const applyForSelected = () => {
    if (!selected) return;
    const without = overrides.filter((o) => o.date !== selected);
    const rows: AvailabilityOverride[] =
      choice === "unavailable"
        ? [
            {
              date: selected,
              is_unavailable: true,
              start_time: null,
              end_time: null,
            },
          ]
        : customBlocks
            .filter((b) => b.start && b.end && b.start < b.end)
            .map((b) => ({
              date: selected,
              is_unavailable: false,
              start_time: b.start,
              end_time: b.end,
            }));
    if (rows.length === 0) return;
    onChange(
      [...without, ...rows].sort((a, b) => a.date.localeCompare(b.date)),
    );
    setSelected(null);
  };

  const removeDate = (date: string) =>
    onChange(overrides.filter((o) => o.date !== date));

  const blockRange = () => {
    if (!rangeStart || !rangeEnd) return;
    const start = parseISODate(rangeStart);
    const end = parseISODate(rangeEnd);
    if (end < start) return;
    let next = overrides;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      next = upsert(next, {
        date: toISODate(d),
        is_unavailable: true,
        start_time: null,
        end_time: null,
      });
    }
    onChange(next);
    setRangeStart("");
    setRangeEnd("");
    setRangeOpen(false);
  };

  const toggleHolidaySet = (on: boolean) => {
    if (on) {
      let next = overrides;
      for (const h of holidays) {
        next = upsert(next, {
          date: h.date,
          is_unavailable: true,
          start_time: null,
          end_time: null,
        });
      }
      onChange(next);
    } else {
      onChange(overrides.filter((o) => !holidayDates.has(o.date)));
    }
  };

  const sorted = useMemo(
    () => [...overrides].sort((a, b) => a.date.localeCompare(b.date)),
    [overrides],
  );

  return (
    <div
      className={clsx("space-y-3", saving && "pointer-events-none opacity-70")}
    >
      <MonthCalendar
        cursorISO={cursorISO}
        selected={selected}
        overrides={overrides}
        holidayDates={holidayDates}
        onCursor={setCursorISO}
        onSelect={(iso) => {
          setSelected(iso);
          const existing = overrides.filter(
            (o) => o.date === iso && !o.is_unavailable,
          );
          if (existing.length > 0) {
            setChoice("custom");
            setCustomBlocks(
              existing.map((o) => ({
                start: o.start_time || "10:00",
                end: o.end_time || "14:00",
              })),
            );
          } else {
            setChoice("unavailable");
            setCustomBlocks([{ start: "10:00", end: "14:00" }]);
          }
        }}
      />

      {selected && (
        <Card>
          <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-app-personal">
            {formatDateLabel(selected)}
          </div>
          <Segmented
            options={[
              { value: "unavailable", label: "Unavailable" },
              { value: "custom", label: "Custom hours" },
            ]}
            value={choice}
            onChange={setChoice}
          />
          {choice === "custom" ? (
            <div className="mt-3">
              <FieldLabel>Hours for this day</FieldLabel>
              <div className="space-y-2">
                {customBlocks.map((block, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg border border-app-border bg-app-surface px-2.5 py-1.5 shadow-sm"
                  >
                    <Clock
                      className="h-3.5 w-3.5 text-app-personal"
                      aria-hidden
                    />
                    <input
                      type="time"
                      aria-label={`Block ${i + 1} start time`}
                      value={block.start}
                      onChange={(e) =>
                        setCustomBlocks((bs) =>
                          bs.map((b, j) =>
                            j === i ? { ...b, start: e.target.value } : b,
                          ),
                        )
                      }
                      className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold tabular-nums text-app-text outline-none"
                    />
                    <span className="text-app-text-muted">–</span>
                    <input
                      type="time"
                      aria-label={`Block ${i + 1} end time`}
                      value={block.end}
                      onChange={(e) =>
                        setCustomBlocks((bs) =>
                          bs.map((b, j) =>
                            j === i ? { ...b, end: e.target.value } : b,
                          ),
                        )
                      }
                      className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold tabular-nums text-app-text outline-none"
                    />
                    {customBlocks.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Remove block ${i + 1}`}
                        onClick={() =>
                          setCustomBlocks((bs) => bs.filter((_, j) => j !== i))
                        }
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-app-text-muted hover:bg-app-hover"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    )}
                  </div>
                ))}
                {/* Design: "+ Add a block" affordance (AVAIL-08). */}
                <button
                  type="button"
                  onClick={() =>
                    setCustomBlocks((bs) => [
                      ...bs,
                      { start: "16:00", end: "18:00" },
                    ])
                  }
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-app-border-strong py-1.5 text-[12px] font-semibold text-app-personal hover:bg-app-hover"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Add a block
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-[11.5px] text-app-text-secondary">
              People can&apos;t book you on this date.
            </p>
          )}
          <button
            type="button"
            onClick={applyForSelected}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-app-personal py-2.5 text-[13px] font-bold text-white shadow-sm"
          >
            {choice === "custom" ? (
              <Clock className="h-[15px] w-[15px]" aria-hidden />
            ) : (
              <CalendarOff className="h-[15px] w-[15px]" aria-hidden />
            )}
            {choice === "custom"
            ? "Add custom hours for this day"
            : "Block this date"}
          </button>
        </Card>
      )}

      {/* Block a date range */}
      {rangeOpen ? (
        <Card>
          <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-app-personal">
            Block a date range
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <FieldLabel>From</FieldLabel>
              <input
                type="date"
                aria-label="Range start"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                className="w-full rounded-lg border border-app-border bg-app-surface px-2.5 py-2 text-[13px] text-app-text outline-none focus:border-app-personal"
              />
            </div>
            <div className="flex-1">
              <FieldLabel>To</FieldLabel>
              <input
                type="date"
                aria-label="Range end"
                value={rangeEnd}
                min={rangeStart || undefined}
                onChange={(e) => setRangeEnd(e.target.value)}
                className="w-full rounded-lg border border-app-border bg-app-surface px-2.5 py-2 text-[13px] text-app-text outline-none focus:border-app-personal"
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setRangeOpen(false)}
              className="flex-1 rounded-xl border border-app-border py-2 text-[13px] font-semibold text-app-text-secondary hover:bg-app-hover"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={blockRange}
              disabled={!rangeStart || !rangeEnd}
              className="flex-1 rounded-xl bg-app-personal py-2 text-[13px] font-bold text-white disabled:opacity-50"
            >
              Block range
            </button>
          </div>
        </Card>
      ) : (
        <button
          type="button"
          onClick={() => setRangeOpen(true)}
          className="flex w-full items-center gap-3 rounded-2xl border border-app-border bg-app-surface p-3 text-left shadow-sm hover:border-app-personal/40"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-app-surface-sunken text-app-text-secondary">
            <CalendarRange className="h-4 w-4" aria-hidden />
          </span>
          <span className="flex-1 text-[13px] font-semibold text-app-text">
            Block a date range
          </span>
          <ChevronRight className="h-4 w-4 text-app-text-muted" aria-hidden />
        </button>
      )}

      {/* Holiday set toggle */}
      <Card overline="Holiday sets">
        <ToggleRow
          icon={<Flag className="h-4 w-4" aria-hidden />}
          label="US public holidays"
          sub={
            holidaySetOn
              ? `Adds ${holidays.length} days off in ${year}`
              : "Block major US holidays automatically"
          }
          on={holidaySetOn}
          onChange={toggleHolidaySet}
          last
        />
      </Card>

      {/* When the holiday set is on: section label + holiday list + footnote
          (date-overrides-frames.jsx FrameHolidays lines 352–370) */}
      {holidaySetOn && (
        <>
          <div className="px-0.5 pt-1 text-[9.5px] font-bold uppercase tracking-wider text-app-text-muted">
            From US public holidays
          </div>
          <div className="rounded-2xl border border-app-border bg-app-surface px-3.5 shadow-sm">
            {holidays.map((h, i) => (
              <div
                key={h.date}
                className={clsx(
                  "flex items-center gap-3 py-2.5",
                  i !== holidays.length - 1 && "border-b border-app-border",
                )}
              >
                <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-app-surface-sunken text-app-text-secondary">
                  <CalendarOff className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-app-text">
                    {formatDateLabel(h.date)}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-app-text-secondary">
                    {h.name}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-app-surface-sunken px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-app-text-muted">
                  Holiday
                </span>
              </div>
            ))}
          </div>
          <p className="px-0.5 text-[11px] leading-relaxed text-app-text-secondary">
            Holidays are blocked as a set. Turn the set off to remove them all
            at once.
          </p>
        </>
      )}

      {/* Existing overrides */}
      <div className="px-0.5 pt-1 text-[9.5px] font-bold uppercase tracking-wider text-app-text-muted">
        Overrides
      </div>
      <div className="rounded-2xl border border-app-border bg-app-surface px-3.5 shadow-sm">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center px-3 py-6 text-center">
            <span className="mb-2.5 flex h-11 w-11 items-center justify-center rounded-xl bg-app-surface-sunken text-app-text-muted">
              <CalendarX className="h-5 w-5" aria-hidden />
            </span>
            <p className="max-w-[15rem] text-[12.5px] text-app-text-secondary">
              No date overrides yet. Pick a date to add one.
            </p>
          </div>
        ) : (
          sorted.map((o, i) => {
            const custom = !o.is_unavailable;
            const detail = custom
              ? rangeLabel(o.start_time || "", o.end_time || "")
              : "Unavailable";
            return (
              <div
                key={o.date}
                className={clsx(
                  "flex items-center gap-3 py-2.5",
                  i !== sorted.length - 1 && "border-b border-app-border",
                )}
              >
                <span
                  className={clsx(
                    "flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg",
                    custom
                      ? "bg-app-personal-bg text-app-personal"
                      : "bg-app-surface-sunken text-app-text-secondary",
                  )}
                >
                  {custom ? (
                    <Clock className="h-4 w-4" aria-hidden />
                  ) : (
                    <CalendarOff className="h-4 w-4" aria-hidden />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-app-text">
                    {formatDateLabel(o.date)}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-app-text-secondary">
                    {detail}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`Delete override for ${formatDateLabel(o.date)}`}
                  onClick={() => removeDate(o.date)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-app-text-muted hover:bg-app-hover hover:text-app-error"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
