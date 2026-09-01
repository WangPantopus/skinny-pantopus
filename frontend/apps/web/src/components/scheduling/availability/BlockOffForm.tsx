"use client";

// B9 — Block off time. Drops an ad-hoc personal busy hold so the engine stops
// offering that window. A reason (private), a date, an all-day toggle or a
// start/end window, and an optional repeat (mapped to an RRULE). It is NOT a
// bookable event and NOT a whole-day date override — it posts to
// /availability/blocks. The parent owns the api call + the created-this-session
// list (there is no list-blocks endpoint).

import { useState } from "react";
import { Calendar, ChevronDown, Clock, Lock, Repeat, Sun } from "lucide-react";
import { Card, FieldLabel, ToggleRow } from "./primitives";
import { todayISO, formatDateLabel, to12h } from "./format";

export interface BlockPayload {
  title?: string;
  start_at: string;
  end_at: string;
  recurrence_rule?: string;
}

const REPEAT_OPTIONS: Array<{ value: string; label: string; rrule?: string }> =
  [
    { value: "none", label: "Does not repeat" },
    { value: "daily", label: "Daily", rrule: "FREQ=DAILY" },
    { value: "weekly", label: "Weekly", rrule: "FREQ=WEEKLY" },
    { value: "monthly", label: "Monthly", rrule: "FREQ=MONTHLY" },
  ];

function toISO(date: string, time: string): string {
  // Interpret as local wall-clock, store as UTC ISO (block is personal).
  return new Date(`${date}T${time}`).toISOString();
}

export default function BlockOffForm({
  onCreate,
  creating,
}: {
  onCreate: (payload: BlockPayload) => Promise<void> | void;
  creating: boolean;
}) {
  const [reason, setReason] = useState("");
  const [date, setDate] = useState<string>(() => todayISO());
  const [allDay, setAllDay] = useState(false);
  const [start, setStart] = useState("14:00");
  const [end, setEnd] = useState("15:00");
  const [repeat, setRepeat] = useState("none");
  const [error, setError] = useState<string | null>(null);

  const disabled = creating;

  const submit = () => {
    setError(null);
    if (!date) {
      setError("Pick a date for this block.");
      return;
    }
    if (!allDay && (!start || !end)) {
      setError("Set a start and end time, or choose all day.");
      return;
    }
    if (!allDay && end <= start) {
      setError("The end time must be after the start time.");
      return;
    }
    const start_at = allDay ? toISO(date, "00:00") : toISO(date, start);
    const end_at = allDay ? toISO(date, "23:59") : toISO(date, end);
    const rrule = REPEAT_OPTIONS.find((r) => r.value === repeat)?.rrule;
    void onCreate({
      title: reason.trim() || undefined,
      start_at,
      end_at,
      recurrence_rule: rrule,
    });
  };

  // FieldButton — design: icon + value text + chevron-down in a bordered button.
  // Native inputs are overlaid absolutely so their click opens the platform picker.
  const fieldBtnBase =
    "relative flex w-full items-center gap-2 rounded-lg border border-app-border bg-app-surface px-2.5 py-2 text-left shadow-sm transition focus-within:border-app-personal";

  const dateLabel = date
    ? formatDateLabel(date)
    : "Pick a date";
  const startLabel = start ? to12h(start) : "Start time";
  const endLabel = end ? to12h(end) : "End time";
  const repeatLabel =
    REPEAT_OPTIONS.find((o) => o.value === repeat)?.label ?? "Does not repeat";

  return (
    <div className="space-y-3">
      <Card>
        <div className="space-y-3">
          <div>
            <FieldLabel>Reason</FieldLabel>
            <input
              type="text"
              value={reason}
              disabled={disabled}
              placeholder="Dentist"
              aria-label="Reason"
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-app-border bg-app-surface px-2.5 py-2 text-[13px] text-app-text outline-none focus:border-app-personal disabled:opacity-70"
            />
            <p className="mt-1.5 text-[11px] text-app-text-secondary">
              Optional · only you can see this.
            </p>
          </div>

          {/* Date — FieldButton style */}
          <div>
            <FieldLabel>Date</FieldLabel>
            <div className={fieldBtnBase}>
              <Calendar className="h-4 w-4 shrink-0 text-app-personal" aria-hidden />
              <span className="flex-1 text-[13px] font-semibold text-app-text">
                {dateLabel}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-app-text-muted" aria-hidden />
              {/* Native date input overlaid for platform picker access */}
              <input
                type="date"
                value={date}
                disabled={disabled}
                min={todayISO()}
                onChange={(e) => setDate(e.target.value)}
                aria-label="Date"
                className="absolute inset-0 cursor-pointer opacity-0"
                tabIndex={-1}
              />
            </div>
          </div>

          <ToggleRow
            icon={<Sun className="h-4 w-4" aria-hidden />}
            label="All day"
            sub="Block the whole day"
            on={allDay}
            onChange={setAllDay}
            disabled={disabled}
            last
          />

          {!allDay && (
            <div className="flex gap-2.5">
              {/* Starts — FieldButton style */}
              <div className="flex-1">
                <FieldLabel>Starts</FieldLabel>
                <div className={fieldBtnBase}>
                  <Clock className="h-4 w-4 shrink-0 text-app-personal" aria-hidden />
                  <span className="flex-1 text-[13px] font-semibold tabular-nums text-app-text">
                    {startLabel}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-app-text-muted" aria-hidden />
                  <input
                    type="time"
                    value={start}
                    disabled={disabled}
                    onChange={(e) => setStart(e.target.value)}
                    aria-label="Start time"
                    className="absolute inset-0 cursor-pointer opacity-0"
                    tabIndex={-1}
                  />
                </div>
              </div>
              {/* Ends — FieldButton style */}
              <div className="flex-1">
                <FieldLabel>Ends</FieldLabel>
                <div className={fieldBtnBase}>
                  <Clock className="h-4 w-4 shrink-0 text-app-personal" aria-hidden />
                  <span className="flex-1 text-[13px] font-semibold tabular-nums text-app-text">
                    {endLabel}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-app-text-muted" aria-hidden />
                  <input
                    type="time"
                    value={end}
                    disabled={disabled}
                    onChange={(e) => setEnd(e.target.value)}
                    aria-label="End time"
                    className="absolute inset-0 cursor-pointer opacity-0"
                    tabIndex={-1}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Repeats — FieldButton style with native <select> overlaid */}
      <Card>
        <FieldLabel>Repeats</FieldLabel>
        <div className={fieldBtnBase}>
          <Repeat className="h-4 w-4 shrink-0 text-app-personal" aria-hidden />
          <span className="flex-1 text-[13px] font-semibold text-app-text">
            {repeatLabel}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-app-text-muted" aria-hidden />
          <select
            value={repeat}
            disabled={disabled}
            onChange={(e) => setRepeat(e.target.value)}
            aria-label="Repeats"
            className="absolute inset-0 cursor-pointer appearance-none opacity-0"
          >
            {REPEAT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {repeat !== "none" && (
          <p className="mt-2 text-[11px] text-app-text-secondary">
            Repeats {repeat} until you delete this block.
          </p>
        )}
      </Card>

      {error && (
        <p className="flex items-center gap-1.5 text-[12px] font-medium text-app-error">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={disabled}
        className="w-full rounded-xl bg-app-personal py-2.5 text-[13.5px] font-bold text-white shadow-sm disabled:opacity-60"
      >
        {creating ? "Saving…" : "Save block"}
      </button>

      <div className="flex items-start gap-2 px-0.5">
        <Lock
          className="mt-0.5 h-3 w-3 shrink-0 text-app-text-muted"
          aria-hidden
        />
        <p className="text-[10.5px] text-app-text-secondary">
          This time won&apos;t be offered for booking. It&apos;s private to you.
        </p>
      </div>
    </div>
  );
}
