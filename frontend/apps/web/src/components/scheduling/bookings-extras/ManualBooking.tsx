"use client";

// E12 — Manual / On-Behalf Booking (+ E10 inline). A 4-step wizard: pick an
// event type → choose a time (the shared SlotPicker, fed by the host's own
// public availability) → invitee details → review → create via POST /bookings.
// A 409 SLOT_CONFLICT routes into the DoubleBookWarning (E10) with nearest open
// times for a one-tap re-pick — never a dead end.

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  MapPin,
  Phone,
  Video,
} from "lucide-react";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import * as api from "@pantopus/api";
import type {
  BookingSlot,
  EventType,
  SchedulingOwnerRef,
  SlotConflict,
} from "@pantopus/types";
import SlotPicker from "@/components/scheduling/SlotPicker";
import { detectTimezone } from "@/components/scheduling/TimezoneSelector";
import { decodeError } from "@/components/scheduling/decodeError";
import {
  pillarTokens,
  type Pillar,
} from "@/components/scheduling/pillarTokens";
import { Field, InlineError, TextInput, ToggleRow } from "./ui";
import { durationLabel, fmtDateTime } from "./format";
import DoubleBookWarning from "./DoubleBookWarning";

type Step = 1 | 2 | 3 | 4;
const STEP_LABELS = ["Event", "Time", "Details", "Review"] as const;

function locationMeta(et: EventType): { icon: LucideIcon; label: string } {
  switch (et.location_mode) {
    case "video":
      return { icon: Video, label: "Video" };
    case "in_person":
      return { icon: MapPin, label: "In person" };
    case "phone":
      return { icon: Phone, label: "Phone" };
    default:
      return { icon: Calendar, label: "Meeting" };
  }
}

function StepRail({ step, pillar }: { step: Step; pillar: Pillar }) {
  const tk = pillarTokens(pillar);
  return (
    <ol className="flex items-center gap-1.5" aria-label={`Step ${step} of 4`}>
      {STEP_LABELS.map((label, i) => {
        const idx = (i + 1) as Step;
        const on = idx === step;
        const done = idx < step;
        return (
          <li key={label} className="flex flex-1 items-center gap-1.5">
            <span
              className={clsx(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                on
                  ? clsx(tk.bg, tk.textOn)
                  : done
                    ? clsx(tk.bgSoft, tk.text)
                    : "bg-app-surface-sunken text-app-text-muted",
              )}
            >
              {done ? (
                <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
              ) : (
                idx
              )}
            </span>
            {on && (
              <span className={clsx("text-xs font-bold", tk.text)}>
                {label}
              </span>
            )}
            {i < STEP_LABELS.length - 1 && (
              <span
                className={clsx(
                  "h-0.5 flex-1 rounded-full",
                  done ? tk.bg : "bg-app-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default function ManualBooking({
  owner,
  pillar,
  pageSlug,
  eventTypes,
  onCreated,
  onBackToBookings,
}: {
  owner: SchedulingOwnerRef;
  pillar: Pillar;
  pageSlug: string | null;
  eventTypes: EventType[];
  onCreated?: (bookingId: string) => void;
  onBackToBookings?: () => void;
}) {
  const tk = pillarTokens(pillar);
  const [step, setStep] = useState<Step>(1);
  const [eventTypeId, setEventTypeId] = useState<string | null>(
    eventTypes[0]?.id ?? null,
  );
  const [slot, setSlot] = useState<BookingSlot | null>(null);
  const [tz, setTz] = useState<string>(() => detectTimezone());
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<SlotConflict | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  // Step 4 toggles (designed in onbehalf-frames.jsx Frame 5).
  const [skipApproval, setSkipApproval] = useState(true);
  const [skipNotifications, setSkipNotifications] = useState(false);

  const selectedEventType = useMemo(
    () => eventTypes.find((e) => e.id === eventTypeId) ?? null,
    [eventTypes, eventTypeId],
  );

  const canNext =
    (step === 1 && !!selectedEventType) ||
    (step === 2 && !!slot) ||
    (step === 3 && (name.trim().length > 0 || email.trim().length > 0)) ||
    step === 4;

  const create = async () => {
    if (!selectedEventType || !slot) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.scheduling.createBooking(
        {
          event_type_id: selectedEventType.id,
          start_at: slot.start,
          invitee_name: name.trim() || undefined,
          invitee_email: email.trim() || undefined,
          invitee_phone: phone.trim() || undefined,
          invitee_timezone: tz,
          intake_answers: note.trim() ? { note: note.trim() } : undefined,
        },
        owner,
      );
      setCreatedId(res.booking.id);
    } catch (err) {
      const d = decodeError(err);
      if (d.kind === "conflict") {
        setConflict(d.conflict);
      } else if (d.kind === "validation") {
        setError(d.message);
      } else {
        setError(d.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Created confirmation ────────────────────────────────────
  if (createdId) {
    return (
      <div className="flex flex-col items-center gap-5 px-6 py-12 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-app-success-bg text-app-success">
          <Check className="h-9 w-9" strokeWidth={2.6} aria-hidden />
        </span>
        <div>
          <h2 className="text-xl font-bold text-app-text">Booking created</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-app-text-secondary">
            {name.trim()
              ? `We've added it${email.trim() ? ` and notified ${name.trim().split(/\s+/)[0]}` : ""}.`
              : "We've added it to your calendar."}
          </p>
        </div>
        <div className="flex w-full max-w-xs flex-col gap-2">
          {/* Primary CTA: "View booking" per design (onbehalf-frames.jsx:270) */}
          <button
            type="button"
            onClick={() => {
              if (createdId && onCreated) onCreated(createdId);
              else onBackToBookings?.();
            }}
            className={clsx(
              "w-full rounded-xl px-5 py-2.5 text-sm font-semibold transition",
              tk.bg,
              tk.textOn,
            )}
          >
            View booking
          </button>
          <button
            type="button"
            onClick={() => {
              setCreatedId(null);
              setStep(1);
              setSlot(null);
              setName("");
              setEmail("");
              setPhone("");
              setNote("");
            }}
            className="w-full rounded-xl border border-app-border bg-app-surface px-5 py-2.5 text-sm font-semibold text-app-text transition hover:bg-app-hover"
          >
            Book another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <StepRail step={step} pillar={pillar} />
      </div>

      {/* Step 1 — event type */}
      {step === 1 && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-app-text">
            Pick an event type
          </h2>
          {eventTypes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-app-border bg-app-surface px-4 py-8 text-center text-sm text-app-text-secondary">
              You don’t have any event types yet. Create one first to book
              someone in.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {eventTypes.map((et) => {
                const on = et.id === eventTypeId;
                const { icon: Icon, label } = locationMeta(et);
                return (
                  <button
                    key={et.id}
                    type="button"
                    onClick={() => {
                      setEventTypeId(et.id);
                      setSlot(null);
                    }}
                    className={clsx(
                      "flex items-center gap-3 rounded-2xl border-[1.5px] px-3.5 py-3 text-left transition",
                      on
                        ? clsx(tk.border, tk.bgSoft)
                        : "border-app-border bg-app-surface hover:bg-app-hover",
                    )}
                  >
                    <span
                      className={clsx(
                        "flex h-10 w-10 items-center justify-center rounded-xl",
                        on
                          ? clsx("bg-app-surface", tk.text)
                          : "bg-app-surface-sunken text-app-text-secondary",
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-app-text">
                        {et.name}
                      </span>
                      <span className="block text-xs text-app-text-muted">
                        {et.default_duration} min · {label}
                      </span>
                    </span>
                    {on && (
                      <CheckCircle2
                        className={clsx("h-5 w-5", tk.text)}
                        aria-hidden
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Step 2 — time */}
      {step === 2 && selectedEventType && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-app-text">
            Choose a time
          </h2>
          {pageSlug ? (
            <SlotPicker
              slug={pageSlug}
              eventTypeSlug={selectedEventType.slug}
              pillar={pillar}
              tz={tz}
              onTzChange={setTz}
              selected={slot?.start ?? null}
              onPick={(s) => setSlot(s)}
            />
          ) : (
            <p className="rounded-xl border border-dashed border-app-border bg-app-surface px-4 py-8 text-center text-sm text-app-text-secondary">
              Set up your booking page to pull live availability, then you can
              book people in here.
            </p>
          )}
          <p className="mt-3 flex items-start gap-1.5 text-[11px] text-app-text-muted">
            <Calendar className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            Times come from your published availability.
          </p>
        </section>
      )}

      {/* Step 3 — invitee details */}
      {step === 3 && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-app-text">
            Who’s it for?
          </h2>
          <div className="space-y-3">
            <Field label="Invitee name">
              <TextInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                autoComplete="off"
              />
            </Field>
            <Field label="Email" hint="They’ll get the confirmation here">
              <TextInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                inputMode="email"
                autoComplete="off"
              />
            </Field>
            <Field label="Phone (optional)">
              <TextInput
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 012-3456"
                inputMode="tel"
                autoComplete="off"
              />
            </Field>
            <Field label="Note for the invitee (optional)">
              <TextInput
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note"
              />
            </Field>
          </div>
          <p className="mt-3 text-[11px] text-app-text-muted">
            Add a name or email so the invitee gets their confirmation.
          </p>
        </section>
      )}

      {/* Step 4 — review */}
      {step === 4 && selectedEventType && slot && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-app-text">
            Review &amp; confirm
          </h2>
          <dl className="overflow-hidden rounded-2xl border border-app-border bg-app-surface">
            {[
              [
                "Event",
                `${selectedEventType.name} · ${durationLabel(slot.start, slot.end) || `${selectedEventType.default_duration} min`}`,
              ],
              ["Time", fmtDateTime(slot.startLocal || slot.start, tz)],
              ["Invitee", name.trim() || email.trim() || "—"],
              ...(email.trim() ? ([["Email", email.trim()]] as const) : []),
            ].map(([k, v], i) => (
              <div
                key={k}
                className={clsx(
                  "flex justify-between gap-4 px-4 py-3",
                  i > 0 && "border-t border-app-border",
                )}
              >
                <dt className="text-xs font-semibold text-app-text-muted">
                  {k}
                </dt>
                <dd className="text-right text-sm font-semibold text-app-text">
                  {v}
                </dd>
              </div>
            ))}
          </dl>
          {/* Skip approval + Skip notifications toggles (design Frame 5) */}
          <div className="mt-3 flex flex-col gap-2.5">
            <ToggleRow
              label="Skip approval"
              sub="Confirm the booking now"
              checked={skipApproval}
              onChange={setSkipApproval}
              pillar={pillar}
            />
            <ToggleRow
              label="Skip notifications"
              sub="Don't notify the invitee"
              checked={skipNotifications}
              onChange={setSkipNotifications}
              pillar={pillar}
            />
          </div>
          {error && (
            <div className="mt-4">
              <InlineError message={error} />
            </div>
          )}
        </section>
      )}

      {/* Footer nav */}
      <div className="mt-6 flex items-center gap-3">
        {step > 1 && (
          <button
            type="button"
            onClick={() => setStep((s) => (s - 1) as Step)}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-app-border bg-app-surface px-4 py-2.5 text-sm font-semibold text-app-text transition hover:bg-app-hover disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back
          </button>
        )}
        {step < 4 ? (
          <button
            type="button"
            onClick={() => setStep((s) => (s + 1) as Step)}
            disabled={!canNext}
            className={clsx(
              "ml-auto inline-flex items-center justify-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
              tk.bg,
              tk.textOn,
            )}
          >
            Continue
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={create}
            disabled={submitting}
            className={clsx(
              "ml-auto inline-flex items-center justify-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-semibold transition disabled:opacity-60",
              tk.bg,
              tk.textOn,
            )}
          >
            <Check className="h-4 w-4" aria-hidden />
            {submitting ? "Creating…" : "Create booking"}
          </button>
        )}
      </div>

      <DoubleBookWarning
        open={!!conflict}
        conflict={conflict}
        pillar={pillar}
        onClose={() => setConflict(null)}
        onPick={(s) => {
          setSlot(s);
          setConflict(null);
          setStep(4);
        }}
        onPickAnother={() => {
          setConflict(null);
          setStep(2);
        }}
      />
    </div>
  );
}
