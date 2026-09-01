"use client";

// F3 — Home add / edit event form. Grouped sections (title, category, schedule,
// recurrence, assign-to, reminder, request-RSVP, notes). Pure form: the parent
// supplies the chrome (a BottomSheet for the calendar FAB, or a page shell for
// the /events/new route). Create → POST, edit → partial PUT.

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, Loader2, WifiOff } from "lucide-react";
import type { HomeCalendarUnionEvent } from "@pantopus/types";
import { confirmStore } from "@/components/ui/confirm-store";
import { decodeError, fieldErrors } from "@/components/scheduling/decodeError";
import { Avatar } from "./Avatars";
import { createHomeEvent, updateHomeEvent, type HomeEventInput } from "./api";
import {
  PICKABLE_CATEGORIES,
  REMINDER_OPTIONS,
  REPEAT_OPTIONS,
  isoToLocalInput,
  localInputToIso,
  remindersToMinutes,
  repeatToRule,
  ruleToRepeat,
  type HomeMember,
  type RepeatOption,
} from "./helpers";

function defaultStart(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return isoToLocalInput(d.toISOString());
}
function plusHour(local: string): string {
  const iso = localInputToIso(local);
  if (!iso) return "";
  const d = new Date(iso);
  d.setHours(d.getHours() + 1);
  return isoToLocalInput(d.toISOString());
}

export default function AddEditEventForm({
  homeId,
  members,
  event,
  onSaved,
  onCancel,
}: {
  homeId: string;
  members: HomeMember[];
  /** Present → edit mode (partial PUT). */
  event?: HomeCalendarUnionEvent | null;
  onSaved: (event: HomeCalendarUnionEvent) => void;
  onCancel: () => void;
}) {
  const editing = !!event;

  const initialStart = event ? isoToLocalInput(event.start_at) : defaultStart();
  const [title, setTitle] = useState(event?.title ?? "");
  const [category, setCategory] = useState(event?.event_type ?? "other");
  const [allDay, setAllDay] = useState(false);
  const [startLocal, setStartLocal] = useState(initialStart);
  const [endLocal, setEndLocal] = useState(
    event?.end_at ? isoToLocalInput(event.end_at) : plusHour(initialStart),
  );
  const [repeat, setRepeat] = useState<RepeatOption>(
    ruleToRepeat(event?.recurrence_rule),
  );
  const [assignees, setAssignees] = useState<string[]>(
    event?.assigned_to ?? [],
  );
  const [reminders, setReminders] = useState<number[]>(
    remindersToMinutes(event?.reminders),
  );
  const [requestRsvp, setRequestRsvp] = useState<boolean>(
    !!event?.request_rsvp,
  );
  const [notes, setNotes] = useState(event?.description ?? "");

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
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

  // Snapshot of the initial values, captured once, to detect unsaved edits.
  const initialRef = useRef({
    title: event?.title ?? "",
    category: event?.event_type ?? "other",
    startLocal: initialStart,
    endLocal: event?.end_at
      ? isoToLocalInput(event.end_at)
      : plusHour(initialStart),
    repeat: ruleToRepeat(event?.recurrence_rule),
    assignees: JSON.stringify(event?.assigned_to ?? []),
    reminders: JSON.stringify(remindersToMinutes(event?.reminders)),
    requestRsvp: !!event?.request_rsvp,
    notes: event?.description ?? "",
    allDay: false,
  });

  const endBeforeStart = useMemo(() => {
    if (allDay) return false;
    const s = localInputToIso(startLocal);
    const e = localInputToIso(endLocal);
    if (!s || !e) return false;
    return new Date(e).getTime() <= new Date(s).getTime();
  }, [allDay, startLocal, endLocal]);

  const titleError = errors.title;
  const canSave = title.trim().length > 0 && !endBeforeStart && !saving;

  const isDirty = () => {
    const i = initialRef.current;
    return (
      title !== i.title ||
      category !== i.category ||
      allDay !== i.allDay ||
      startLocal !== i.startLocal ||
      endLocal !== i.endLocal ||
      repeat !== i.repeat ||
      JSON.stringify(assignees) !== i.assignees ||
      JSON.stringify(reminders) !== i.reminders ||
      requestRsvp !== i.requestRsvp ||
      notes !== i.notes
    );
  };

  const handleCancel = async () => {
    if (saving) return;
    if (isDirty()) {
      const ok = await confirmStore.open({
        title: "Discard changes?",
        description: "Your edits to this event won't be saved.",
        confirmLabel: "Discard",
        cancelLabel: "Keep editing",
        variant: "destructive",
      });
      if (!ok) return;
    }
    onCancel();
  };

  const toggleAssignee = (id: string) =>
    setAssignees((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  const toggleReminder = (min: number) =>
    setReminders((prev) =>
      prev.includes(min) ? prev.filter((x) => x !== min) : [...prev, min],
    );

  const handleSave = async () => {
    const nextErrors: Record<string, string> = {};
    if (!title.trim()) nextErrors.title = "Add a title to save this event";
    if (endBeforeStart) nextErrors.end = "End time is before the start time";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    let startIso = localInputToIso(startLocal);
    let endIso: string | null = localInputToIso(endLocal);
    if (allDay) {
      const base = startIso ? new Date(startIso) : new Date();
      const s = new Date(base);
      s.setHours(0, 0, 0, 0);
      const e = new Date(base);
      e.setHours(23, 59, 0, 0);
      startIso = s.toISOString();
      endIso = e.toISOString();
    }
    if (!startIso) {
      setErrors({ start: "Choose a start time" });
      return;
    }

    const payload: HomeEventInput = {
      event_type: category,
      title: title.trim(),
      description: notes.trim() || null,
      start_at: startIso,
      end_at: endIso,
      recurrence_rule: repeatToRule(repeat),
      assigned_to: assignees,
      alerts_enabled: reminders.length > 0,
      request_rsvp: requestRsvp,
      reminders: reminders.slice().sort((a, b) => a - b),
    };

    setSaving(true);
    setFormError(null);
    try {
      const res = editing
        ? await updateHomeEvent(homeId, event!.id, payload)
        : await createHomeEvent(homeId, payload);
      onSaved(res.event);
    } catch (err) {
      const decoded = decodeError(err);
      if (decoded.kind === "validation") {
        setErrors(fieldErrors(decoded));
      } else {
        setFormError(decoded.message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* sheet bar */}
      <div className="flex items-center justify-between border-b border-app-border-subtle px-3 py-2.5">
        <button
          type="button"
          onClick={handleCancel}
          disabled={saving}
          className="min-w-[52px] text-left text-sm font-semibold text-app-text-secondary disabled:opacity-50"
        >
          Cancel
        </button>
        <div className="text-[14.5px] font-bold tracking-tight text-app-text">
          {editing ? "Edit event" : "New event"}
        </div>
        <div className="min-w-[52px] text-right">
          {saving ? (
            <Loader2 className="ml-auto h-4 w-4 animate-spin text-app-text-muted" />
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="text-sm font-bold text-app-home disabled:text-app-text-muted"
            >
              Save
            </button>
          )}
        </div>
      </div>

      {/* body wrapper — relative so the saving overlay can be absolutely positioned */}
      <div className="relative flex-1 overflow-hidden">
        {/* dimmed content when saving */}
        <div
          className={`h-full overflow-auto transition-opacity ${
            saving ? "pointer-events-none opacity-[0.45]" : "opacity-100"
          }`}
        >
          <div className="space-y-3 p-3.5">
        {!isOnline && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <div className="text-[12px] font-bold text-amber-800">
                You&apos;re offline
              </div>
              <div className="mt-0.5 text-[11.5px] leading-[15px] text-amber-700">
                This event saves when you reconnect.
              </div>
            </div>
          </div>
        )}

        {formError && (
          <div className="flex items-start gap-2 rounded-xl border border-app-error/30 bg-app-error-bg px-3 py-2.5 text-[12px] text-app-error">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {formError}
          </div>
        )}

        {/* Title */}
        <Section>
          <FieldLabel>Title</FieldLabel>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (errors.title) setErrors((p) => ({ ...p, title: "" }));
            }}
            placeholder="Add a title"
            className={`w-full rounded-lg border bg-app-surface px-3 py-2.5 text-[13px] text-app-text outline-none placeholder:text-app-text-muted focus:ring-2 focus:ring-app-home/40 ${
              titleError
                ? "border-app-error ring-2 ring-app-error-bg"
                : "border-app-border"
            }`}
          />
          {titleError && (
            <p className="mt-1.5 flex items-center gap-1 text-[10.5px] text-app-error">
              <AlertCircle className="h-3 w-3" />
              {titleError}
            </p>
          )}
        </Section>

        {/* Category */}
        <Section overline="Category">
          <div className="flex flex-wrap gap-1.5">
            {PICKABLE_CATEGORIES.map((c) => {
              const on = c.value === category;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
                    on
                      ? "border-transparent bg-app-home-bg text-app-home"
                      : "border-app-border bg-app-surface text-app-text-secondary"
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: c.color }}
                  />
                  {c.label}
                </button>
              );
            })}
          </div>
        </Section>

        {/* When */}
        <Section overline="When">
          <ValueRow label="All-day">
            <Switch on={allDay} onClick={() => setAllDay((v) => !v)} />
          </ValueRow>
          {!allDay && (
            <>
              <ValueRow label="Starts">
                <input
                  type="datetime-local"
                  value={startLocal}
                  onChange={(e) => {
                    setStartLocal(e.target.value);
                    if (
                      endLocal &&
                      new Date(e.target.value) >= new Date(endLocal)
                    ) {
                      setEndLocal(plusHour(e.target.value));
                    }
                  }}
                  className="rounded-lg bg-app-surface-sunken px-2.5 py-1.5 text-[12px] font-semibold text-app-text outline-none"
                />
              </ValueRow>
              <ValueRow label="Ends" last error={endBeforeStart}>
                <input
                  type="datetime-local"
                  value={endLocal}
                  onChange={(e) => setEndLocal(e.target.value)}
                  className={`rounded-lg px-2.5 py-1.5 text-[12px] font-semibold outline-none ${
                    endBeforeStart
                      ? "border border-app-error/40 bg-app-error-bg text-app-error"
                      : "bg-app-surface-sunken text-app-text"
                  }`}
                />
              </ValueRow>
              {endBeforeStart && (
                <p className="mt-1.5 flex items-center gap-1 text-[10.5px] text-app-error">
                  <AlertCircle className="h-3 w-3" />
                  End time is before the start time
                </p>
              )}
            </>
          )}
        </Section>

        {/* Repeats */}
        <Section overline="Repeats">
          <Segmented
            options={REPEAT_OPTIONS}
            value={repeat}
            onChange={(v) => setRepeat(v as RepeatOption)}
          />
        </Section>

        {/* Assign to */}
        {members.length > 0 && (
          <Section overline="Assign to">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11.5px] font-semibold text-app-text-secondary">
                Members
              </span>
              <span className="text-[10.5px] font-bold text-app-home">
                {assignees.length} selected
              </span>
            </div>
            {members.map((m, i) => {
              const on = assignees.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleAssignee(m.id)}
                  className={`flex w-full items-center gap-3 py-2.5 text-left ${
                    i === members.length - 1 ? "" : "border-b border-app-border"
                  }`}
                >
                  <Avatar member={m} size={32} />
                  <span className="flex-1 truncate text-[13px] font-semibold text-app-text">
                    {m.name}
                  </span>
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      on
                        ? "border-app-home bg-app-home text-white"
                        : "border-app-border-strong"
                    }`}
                  >
                    {on && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </Section>
        )}

        {/* Reminder */}
        <Section overline="Reminder">
          <div className="flex flex-wrap gap-1.5">
            {REMINDER_OPTIONS.map((r) => {
              const on = reminders.includes(r.minutes);
              return (
                <button
                  key={r.minutes}
                  type="button"
                  onClick={() => toggleReminder(r.minutes)}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
                    on
                      ? "border-transparent bg-app-home-bg text-app-home"
                      : "border-app-border bg-app-surface text-app-text-secondary"
                  }`}
                >
                  {on && <Check className="h-3 w-3" strokeWidth={3} />}
                  {r.label}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Request RSVP */}
        <Section>
          <ValueRow label="Request RSVP from attendees" last>
            <Switch
              on={requestRsvp}
              onClick={() => setRequestRsvp((v) => !v)}
            />
          </ValueRow>
          <p className="mt-1 text-[10.5px] text-app-text-secondary">
            Members get a Going / Maybe / Can&apos;t prompt
          </p>
        </Section>

        {/* Notes */}
        <Section overline="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Add notes for attendees"
            className="w-full resize-none rounded-lg border border-app-border bg-app-surface px-3 py-2 text-[13px] text-app-text outline-none placeholder:text-app-text-muted focus:ring-2 focus:ring-app-home/40"
          />
        </Section>
          </div>{/* end space-y-3 */}
        </div>{/* end dimmed-content wrapper */}

        {/* saving overlay — centered card over dimmed content */}
        {saving && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2.5 rounded-2xl bg-white/90 px-6 py-[18px] shadow-[0_8px_24px_rgba(0,0,0,0.1)]">
              <Loader2 className="h-[26px] w-[26px] animate-spin text-app-home" />
              <span className="text-[12.5px] font-semibold text-app-text-secondary">
                Saving event
              </span>
            </div>
          </div>
        )}
      </div>{/* end relative body wrapper */}
    </div>
  );
}

// ─── Local form primitives ────────────────────────────────────
function Section({
  overline,
  children,
}: {
  overline?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-app-border bg-app-surface p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      {overline && (
        <div className="mb-2.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-app-home">
          {overline}
        </div>
      )}
      {children}
    </div>
  );
}
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 text-[11px] font-semibold text-app-text-secondary">
      {children}
    </div>
  );
}
function ValueRow({
  label,
  children,
  last,
  error,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
  error?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2.5 py-2.5 ${
        last ? "" : "border-b border-app-border"
      }`}
    >
      <span
        className={`text-[12.5px] font-semibold ${
          error ? "text-app-error" : "text-app-text-secondary"
        }`}
      >
        {label}
      </span>
      {children}
    </div>
  );
}
function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className={`relative h-5 w-9 shrink-0 rounded-full transition ${
        on ? "bg-app-home" : "bg-app-border-strong"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
          on ? "left-[18px]" : "left-0.5"
        }`}
      />
    </button>
  );
}
function Segmented({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-0.5 rounded-lg bg-app-surface-sunken p-0.5">
      {options.map((o) => {
        const on = o === value;
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`h-8 flex-1 rounded-md text-[12px] font-semibold transition ${
              on
                ? "bg-app-home text-white shadow-sm"
                : "text-app-text-secondary"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}
