"use client";

// One-off / single-use link landing (/book/o/:token). Reuses the W0 SlotPicker
// (slots fetched via getOneOff — offered slots or computed availability), then a
// compact intake → create. Single-use/expired links and 409 conflicts surface
// here (D5/D7). Paid one-offs (TEST, behind schedulingPaid) hand off to the
// Stripe CheckoutPanel; a payment failure shows the D6 PaymentRetryPanel.

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Ticket, CheckCircle2, ArrowLeft } from "lucide-react";
import clsx from "clsx";
import type {
  BookingSlot,
  PublicEventType,
  SlotConflict,
} from "@pantopus/types";
import { publicBooking } from "@pantopus/api";
import { buildBookingManagePath } from "@pantopus/utils";
import {
  SlotPicker,
  decodeError,
  asSlotConflict,
  saveManageToken,
  type Pillar,
} from "@/components/scheduling";
import { webFeatureFlags } from "@/lib/featureFlags";
import ConflictView from "./ConflictView";
import StateRouter from "./StateRouter";
import AddToCalendarPanel from "./AddToCalendarPanel";
import CheckoutPanel from "./CheckoutPanel";
import PaymentRetryPanel from "./PaymentRetryPanel";
import {
  durationLabel,
  eventTypeSummary,
  formatRange,
  formatTime,
  locationIcon,
  money,
  viewerTimezone,
} from "./edgeUtils";

type Step = "pick" | "intake" | "conflict" | "checkout" | "success" | "used";

interface CreatedState {
  manageToken: string;
  clientSecret: string | null;
  slot: BookingSlot;
}

function validEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export default function OneOffLanding({
  token,
  eventType,
  pillar = "personal",
}: {
  token: string;
  eventType: PublicEventType;
  pillar?: Pillar;
}) {
  const [tz, setTz] = useState<string>(() => viewerTimezone());
  const [step, setStep] = useState<Step>("pick");
  const [picked, setPicked] = useState<BookingSlot | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [conflict, setConflict] = useState<SlotConflict | null>(null);
  const [created, setCreated] = useState<CreatedState | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const LocationIcon = locationIcon(eventType.location_mode);
  const priced = eventType.price_cents > 0;
  const paidEnabled = webFeatureFlags.schedulingPaid;

  const fetchSlots = useMemo(
    () => async (range: { from: string; to: string; tz: string }) => {
      const res = await publicBooking.getOneOff(token, range);
      return res.slots ?? [];
    },
    [token],
  );

  const create = async (slot: BookingSlot) => {
    setSubmitting(true);
    setSubmitError(null);
    setConflict(null);
    try {
      const res = await publicBooking.createOneOffBooking(token, {
        start_at: slot.start,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        timezone: tz,
      });
      saveManageToken(`oneoff:${token}`, res.manageToken);
      const next: CreatedState = {
        manageToken: res.manageToken,
        clientSecret: res.clientSecret,
        slot,
      };
      setCreated(next);
      if (next.clientSecret && priced && paidEnabled) setStep("checkout");
      else setStep("success");
    } catch (err) {
      const d = decodeError(err);
      const c = asSlotConflict(d);
      if (c) {
        setConflict(c);
        setStep("conflict");
        return;
      }
      if (
        d.kind === "expired" ||
        (d.kind === "error" && d.code === "LINK_USED")
      ) {
        setStep("used");
        return;
      }
      setSubmitError(d.message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitIntake = () => {
    const next: { name?: string; email?: string } = {};
    if (!name.trim()) next.name = "Enter your name.";
    if (!validEmail(email)) next.email = "Enter a valid email.";
    setErrors(next);
    if (Object.keys(next).length || !picked) return;
    create(picked);
  };

  if (step === "used") {
    return (
      <StateRouter
        state="expired"
        pillar={pillar}
        message="This single-use link has already been used or has expired. Ask your host for a fresh one."
      />
    );
  }

  // ── Success ───────────────────────────────────────────────────────────
  if (step === "success" && created) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-6">
        <div className="py-2 text-center">
          <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-app-success-bg">
            <CheckCircle2 className="h-8 w-8 text-app-success" aria-hidden />
          </span>
          <h1 className="text-xl font-bold text-app-text-strong">
            You’re booked
          </h1>
          <p className="mx-auto mt-2 max-w-xs text-sm text-app-text-muted">
            {eventType.name} ·{" "}
            {formatRange(created.slot.start, created.slot.end, tz)}
          </p>
        </div>
        <div className="mt-6 space-y-4">
          <AddToCalendarPanel
            event={{
              title: eventType.name,
              start: created.slot.start,
              end: created.slot.end,
            }}
            tz={tz}
            icsUrl={publicBooking.getIcsUrl(created.manageToken)}
          />
          <Link
            href={buildBookingManagePath(created.manageToken)}
            className="block w-full rounded-xl bg-app-personal px-4 py-3 text-center text-sm font-bold text-white"
          >
            Manage your booking
          </Link>
        </div>
      </div>
    );
  }

  // ── Checkout (paid) ───────────────────────────────────────────────────
  if (step === "checkout" && created?.clientSecret) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-6">
        <h1 className="text-lg font-bold text-app-text-strong">
          Complete your payment
        </h1>
        <p className="mt-1 text-sm text-app-text-muted">
          {eventType.name} · {money(eventType.price_cents, eventType.currency)}
        </p>
        {payError ? (
          <div className="mt-4">
            <PaymentRetryPanel
              state="declined"
              reason={payError}
              amountCents={eventType.price_cents}
              currency={eventType.currency}
              timeLabel={formatTime(created.slot.start, tz)}
              onRetry={() => setPayError(null)}
              onPickAnotherTime={() => {
                setPayError(null);
                setCreated(null);
                setStep("pick");
              }}
            />
          </div>
        ) : (
          <div className="mt-4">
            <CheckoutPanel
              clientSecret={created.clientSecret}
              payLabel={`Pay ${money(eventType.price_cents, eventType.currency)}`}
              onPaid={() => setStep("success")}
              onError={(m) => setPayError(m)}
            />
          </div>
        )}
      </div>
    );
  }

  // ── Pick / intake / conflict ──────────────────────────────────────────
  const summary = (
    <div className="flex items-center gap-3 rounded-2xl border border-app-border bg-app-surface px-3 py-3 shadow-sm">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-app-personal-bg text-app-personal">
        <LocationIcon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-app-text">
          {eventType.name}
        </p>
        <p className="mt-0.5 truncate text-xs text-app-text-secondary">
          {eventTypeSummary(eventType) ||
            durationLabel(eventType.default_duration)}
        </p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-app-surface-muted px-2 py-1 text-[10px] font-bold uppercase text-app-text-muted">
        <Ticket className="h-3 w-3" aria-hidden />
        Invite
      </span>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="flex h-12 items-center border-b border-app-border bg-app-surface px-2">
        {step === "intake" ? (
          <button
            type="button"
            aria-label="Back to times"
            onClick={() => setStep("pick")}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-app-text hover:bg-app-hover"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
        ) : (
          <span className="h-9 w-9" aria-hidden />
        )}
        <h1 className="flex-1 text-center text-[15px] font-semibold text-app-text">
          {step === "intake" ? "Your details" : "Pick a time"}
        </h1>
        <span className="h-9 w-9" aria-hidden />
      </div>

      <div className="space-y-4 px-4 py-4">
        {summary}

        {priced && !paidEnabled && (
          <div className="rounded-xl border border-app-warning-light bg-app-warning-bg p-3 text-xs font-semibold text-app-warning">
            Online payment isn’t available right now. Reach out to your host to
            book this paid time.
          </div>
        )}

        {step === "conflict" && conflict ? (
          <ConflictView
            conflict={conflict}
            pillar={pillar}
            onPick={(slot) => {
              setPicked(slot);
              create(slot);
            }}
            onPickAnother={() => {
              setConflict(null);
              setStep("pick");
            }}
          />
        ) : step === "intake" ? (
          <div className="space-y-3">
            {picked && (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-app-personal-bg px-3 py-2.5">
                <span className="text-[13px] font-semibold text-app-text">
                  {formatRange(picked.start, picked.end, tz)}
                </span>
                <button
                  type="button"
                  onClick={() => setStep("pick")}
                  className="inline-flex items-center gap-1 text-xs font-bold text-app-personal"
                >
                  <ArrowLeft className="h-3 w-3" aria-hidden />
                  Change
                </button>
              </div>
            )}
            <div>
              <label
                htmlFor="oneoff-name"
                className="mb-1 block text-xs font-semibold text-app-text-secondary"
              >
                Name
              </label>
              <input
                id="oneoff-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={clsx(
                  "w-full rounded-xl border bg-app-surface px-3 py-2.5 text-sm text-app-text focus:outline-none",
                  errors.name
                    ? "border-app-error"
                    : "border-app-border focus:border-app-personal",
                )}
              />
              {errors.name && (
                <p className="mt-1 text-xs text-app-error">{errors.name}</p>
              )}
            </div>
            <div>
              <label
                htmlFor="oneoff-email"
                className="mb-1 block text-xs font-semibold text-app-text-secondary"
              >
                Email
              </label>
              <input
                id="oneoff-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={clsx(
                  "w-full rounded-xl border bg-app-surface px-3 py-2.5 text-sm text-app-text focus:outline-none",
                  errors.email
                    ? "border-app-error"
                    : "border-app-border focus:border-app-personal",
                )}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-app-error">{errors.email}</p>
              )}
            </div>
            <div>
              <label
                htmlFor="oneoff-phone"
                className="mb-1 block text-xs font-semibold text-app-text-secondary"
              >
                Phone (optional)
              </label>
              <input
                id="oneoff-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-app-border bg-app-surface px-3 py-2.5 text-sm text-app-text focus:border-app-personal focus:outline-none"
              />
            </div>

            {submitError && (
              <div className="rounded-xl border border-app-error-light bg-app-error-bg p-3 text-xs font-semibold text-app-error">
                {submitError}
              </div>
            )}

            <button
              type="button"
              onClick={submitIntake}
              disabled={submitting || (priced && !paidEnabled)}
              className="w-full rounded-xl bg-app-personal px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {submitting
                ? "Booking…"
                : priced && paidEnabled
                  ? `Continue to payment`
                  : "Confirm booking"}
            </button>
          </div>
        ) : (
          <SlotPicker
            fetchSlots={fetchSlots}
            pillar={pillar}
            tz={tz}
            onTzChange={setTz}
            selected={picked?.start ?? null}
            onPick={(slot) => {
              setPicked(slot);
              setStep("intake");
            }}
          />
        )}
      </div>
    </div>
  );
}
