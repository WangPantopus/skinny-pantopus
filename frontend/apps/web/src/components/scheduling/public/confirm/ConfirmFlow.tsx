// W6 · D1 + D2 — the public booking commit flow. Owns the intake → review →
// (payment) → create path. STOPS at create: on success it persists the one-time
// manageToken (W0 helper, keyed by page slug) and routes to D3 (/booking/:token/
// confirmed). 409 conflicts surface the W0 SlotConflictAlternatives (never a dead
// end); 400 validation maps to field errors; the paid path (behind
// schedulingPaid + Stripe TEST) confirms a PaymentIntent before routing.
//
// W6 owns confirm/** ONLY — W5 owns [eventType]/page.tsx (the slot picker that
// hands off here with ?start&end&tz&duration).

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CalendarSearch,
  Check,
  ChevronLeft,
  ClockAlert,
  Clock,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import clsx from "clsx";
import { publicBooking } from "@pantopus/api";
import type {
  BookingSlot,
  PublicPageView,
  SlotConflict,
} from "@pantopus/types";
import { buildBookingEventPath, buildBookingManagePath } from "@pantopus/utils";
import {
  asSlotConflict,
  CancellationPolicy,
  decodeError,
  fieldErrors,
  pillarForOwner,
  pillarTokens,
  saveManageToken,
  SlotConflictAlternatives,
  TimezoneSelector,
} from "@/components/scheduling";
import { webFeatureFlags } from "@/lib/featureFlags";
import BookingSummaryCard, { type SummaryAnswer } from "./BookingSummaryCard";
import CheckoutPanel from "./CheckoutPanel";
import IntakeForm from "./IntakeForm";
import ReviewSummary from "./ReviewSummary";
import {
  type AnswerValue,
  buildBookingInput,
  durationLabelFromMinutes,
  emptyIntake,
  type IntakeValues,
  type PublicEventTypeWithQuestions,
  priceMode,
  readQuestions,
  reviewCtaLabel,
  validateIntake,
} from "./confirmUtils";

const HOLD_SECONDS = 5 * 60;

type Step = "details" | "review" | "payment";

interface ConfirmFlowProps {
  slug: string;
  eventTypeSlug: string;
  eventType: PublicEventTypeWithQuestions;
  page: PublicPageView;
  hostName: string;
  startAt: string | null;
  endAt: string | null;
  initialTz: string;
  durationMin: number | null;
}

function HoldRow({ secondsLeft }: { secondsLeft: number }) {
  const m = Math.floor(secondsLeft / 60);
  const s = String(secondsLeft % 60).padStart(2, "0");
  return (
    <div className="-mt-1 flex items-center justify-center gap-1.5">
      <Clock className="h-3.5 w-3.5 text-app-text-secondary" aria-hidden />
      <span className="text-[11px] text-app-text-secondary">
        We&rsquo;re holding this time for{" "}
        <b className="font-bold tabular-nums text-app-text-strong">
          {m}:{s}
        </b>
      </span>
    </div>
  );
}

export default function ConfirmFlow({
  slug,
  eventTypeSlug,
  eventType,
  page,
  hostName,
  startAt,
  endAt,
  initialTz,
  durationMin,
}: ConfirmFlowProps) {
  const router = useRouter();
  const pillar = pillarForOwner(page.owner_type);
  const tk = pillarTokens(pillar);
  const questions = useMemo(() => readQuestions(eventType), [eventType]);
  const paidEnabled =
    webFeatureFlags.schedulingPaid && priceMode(eventType) !== "free";

  const [step, setStep] = useState<Step>("details");
  const [values, setValues] = useState<IntakeValues>(emptyIntake);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showErrors, setShowErrors] = useState(false);
  const [tz, setTz] = useState(initialTz || "UTC");
  const [tzOpen, setTzOpen] = useState(false);
  const [slot, setSlot] = useState<{ start: string; end: string }>({
    start: startAt ?? "",
    end: endAt ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [conflict, setConflict] = useState<SlotConflict | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [manageToken, setManageToken] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(HOLD_SECONDS);

  const holdExpired = secondsLeft <= 0;
  const eventName = eventType.name;
  const durLabel = durationLabelFromMinutes(
    durationMin ?? eventType.default_duration,
  );
  const lineLabel = [eventName, durLabel].filter(Boolean).join(" · ");

  // When the handoff didn't carry a tz, default to the invitee's browser zone
  // after mount (avoids an SSR/CSR hydration mismatch from detecting on render).
  useEffect(() => {
    if (!initialTz) {
      try {
        setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
      } catch {
        /* keep UTC */
      }
    }
  }, [initialTz]);

  // Soft slot-hold countdown (client-only — there is no server hold token; the
  // real guard is the 409 on create).
  useEffect(() => {
    if (step === "payment") return; // stop counting once payment is in flight
    const id = window.setInterval(() => {
      setSecondsLeft((v) => (v > 0 ? v - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [step]);

  const liveErrors = useMemo(
    () => validateIntake(values, questions),
    [values, questions],
  );
  const isValid = Object.keys(liveErrors).length === 0;

  const onPatch = useCallback((patch: Partial<IntakeValues>) => {
    setValues((v) => ({ ...v, ...patch }));
  }, []);
  const onAnswer = useCallback((key: string, value: AnswerValue) => {
    setValues((v) => ({ ...v, answers: { ...v.answers, [key]: value } }));
  }, []);

  const goBackToPicker = () =>
    router.push(buildBookingEventPath(slug, eventTypeSlug));

  const answersSummary: SummaryAnswer[] = useMemo(
    () =>
      questions
        .map((q, i) => {
          const v = values.answers[q.id || `q${i}`];
          if (v == null || v === "" || (Array.isArray(v) && v.length === 0))
            return null;
          return {
            label: q.label,
            value: Array.isArray(v)
              ? v.join(", ")
              : v === true
                ? "Yes"
                : String(v),
          };
        })
        .filter((x): x is SummaryAnswer => x !== null),
    [questions, values.answers],
  );

  const submit = useCallback(
    async (overrideSlot?: { start: string; end: string }) => {
      const useSlot = overrideSlot ?? slot;
      setSubmitting(true);
      setErrorMsg(null);
      setConflict(null);
      try {
        const body = buildBookingInput(values, {
          startAt: useSlot.start,
          durationMin: durationMin ?? undefined,
          timezone: tz,
          questions,
        });
        const res = await publicBooking.createPublicBooking(
          slug,
          eventTypeSlug,
          body,
        );
        saveManageToken(slug, res.manageToken);
        setManageToken(res.manageToken);
        // Stash one-shot context for the confirmed screen (confetti + message).
        try {
          window.sessionStorage.setItem(
            `pantopus.calendarly.justBooked.${res.manageToken}`,
            JSON.stringify({
              confirmationMessage: res.page?.confirmation_message ?? null,
              celebrate: true,
            }),
          );
        } catch {
          /* ignore */
        }

        if (paidEnabled && res.clientSecret) {
          setClientSecret(res.clientSecret);
          setStep("payment");
          setSubmitting(false);
          return;
        }
        router.push(`${buildBookingManagePath(res.manageToken)}/confirmed`);
      } catch (err) {
        const decoded = decodeError(err);
        const c = asSlotConflict(decoded);
        if (c) {
          setConflict(c);
        } else if (decoded.kind === "validation") {
          setErrors(fieldErrors(decoded));
          setShowErrors(true);
          setStep("details");
          setErrorMsg(decoded.message);
        } else {
          setErrorMsg(decoded.message);
        }
        setSubmitting(false);
      }
    },
    [
      slot,
      values,
      durationMin,
      tz,
      questions,
      slug,
      eventTypeSlug,
      paidEnabled,
      router,
    ],
  );

  const handlePrimary = () => {
    if (holdExpired) {
      goBackToPicker();
      return;
    }
    if (step === "details") {
      setShowErrors(true);
      setErrors(liveErrors);
      if (!isValid) return;
      setStep("review");
      return;
    }
    if (step === "review") {
      void submit();
    }
  };

  const handlePickAlternative = (alt: BookingSlot) => {
    setConflict(null);
    setSlot({ start: alt.start, end: alt.end });
    setStep("review");
    void submit({ start: alt.start, end: alt.end });
  };

  const shownErrors = showErrors ? errors : {};

  // Missing slot params → send them back to pick a time.
  if (!slot.start || !slot.end) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16 text-center">
        <CalendarSearch
          className="mx-auto h-8 w-8 text-app-text-muted"
          aria-hidden
        />
        <p className="mt-3 text-sm font-semibold text-app-text">
          Pick a time first
        </p>
        <p className="mt-1 text-xs text-app-text-secondary">
          Choose a slot and we&rsquo;ll bring your details here.
        </p>
        <button
          type="button"
          onClick={goBackToPicker}
          className={clsx(
            "mt-4 rounded-lg px-4 py-2 text-sm font-semibold",
            tk.bg,
            tk.textOn,
          )}
        >
          See available times
        </button>
      </div>
    );
  }

  const title =
    step === "details"
      ? "Your details"
      : step === "payment"
        ? "Payment"
        : "Review & confirm";
  const ctaLabel = holdExpired
    ? "Pick another time"
    : step === "details"
      ? "Review booking"
      : reviewCtaLabel(eventType, paidEnabled);

  return (
    <div className="mx-auto w-full max-w-md">
      {/* Top bar */}
      <div className="flex h-12 items-center border-b border-app-border bg-app-surface px-2">
        <button
          type="button"
          aria-label="Back"
          onClick={() =>
            step === "review" ? setStep("details") : goBackToPicker()
          }
          className="flex h-9 w-9 items-center justify-center rounded-lg text-app-text hover:bg-app-hover"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <h1 className="flex-1 text-center text-[15px] font-semibold text-app-text">
          {title}
        </h1>
        <span className="h-9 w-9" aria-hidden />
      </div>

      <div className="space-y-3.5 px-4 py-4 pb-28">
        {holdExpired && (
          <div className="flex items-start gap-2.5 rounded-xl border border-app-warning-light bg-app-warning-bg px-3 py-3">
            <ClockAlert
              className="mt-0.5 h-4 w-4 shrink-0 text-app-warning"
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-app-warning">
                This held time just expired
              </p>
              <p className="mt-0.5 text-[11px] leading-4 text-app-warning">
                Someone else can book it now. Pick another time to keep going.
              </p>
            </div>
          </div>
        )}

        {conflict && (
          <SlotConflictAlternatives
            conflict={conflict}
            pillar={pillar}
            onPick={handlePickAlternative}
            onPickAnother={goBackToPicker}
          />
        )}

        {errorMsg && !conflict && (
          <div className="flex items-start gap-2.5 rounded-xl border border-app-error-light bg-app-error-bg px-3 py-2.5">
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0 text-app-error"
              aria-hidden
            />
            <p className="text-[12px] leading-4 text-app-error">{errorMsg}</p>
          </div>
        )}

        <BookingSummaryCard
          hostName={hostName}
          eventName={eventName}
          pillar={pillar}
          startISO={slot.start}
          endISO={slot.end}
          tz={tz}
          locationMode={eventType.location_mode}
          locationDetail={eventType.location_detail}
          inviteeName={
            step !== "details" && (values.firstName || values.lastName)
              ? `${values.firstName} ${values.lastName}`.trim()
              : undefined
          }
          guests={step !== "details" ? values.guests : []}
          answers={step !== "details" ? answersSummary : []}
          onEdit={
            step !== "details" ? () => setStep("details") : goBackToPicker
          }
          onChangeTz={!holdExpired ? () => setTzOpen(true) : undefined}
          dimmed={holdExpired}
        />

        {step === "details" && !holdExpired && (
          <HoldRow secondsLeft={secondsLeft} />
        )}

        {step === "details" && (
          <div
            className={clsx(holdExpired && "pointer-events-none opacity-50")}
          >
            <IntakeForm
              values={values}
              errors={shownErrors}
              questions={questions}
              onPatch={onPatch}
              onAnswer={onAnswer}
              disabled={holdExpired || submitting}
            />
          </div>
        )}

        {step === "review" && !holdExpired && (
          <>
            <ReviewSummary
              eventType={eventType}
              lineLabel={lineLabel}
              pillar={pillar}
            />
            {page.cancellation_policy ? (
              <CancellationPolicy policy={page.cancellation_policy} />
            ) : (
              <div className="flex items-center gap-1.5">
                <ShieldCheck
                  className="h-3.5 w-3.5 shrink-0 text-app-text-muted"
                  aria-hidden
                />
                <span className="text-[11px] text-app-text-secondary">
                  You can manage or cancel this booking anytime from your email.
                </span>
              </div>
            )}
            {paidEnabled && (
              <p className="flex items-center justify-center gap-1.5 text-[10px] text-app-text-muted">
                <RefreshCw className="h-3 w-3" aria-hidden />
                We&rsquo;ll confirm once payment clears.
              </p>
            )}
          </>
        )}

        {step === "payment" && clientSecret && (
          <CheckoutPanel
            clientSecret={clientSecret}
            payLabel={reviewCtaLabel(eventType, true)}
            pillar={pillar}
            onPaid={() => {
              if (manageToken) {
                router.push(`${buildBookingManagePath(manageToken)}/confirmed`);
              }
            }}
          />
        )}
      </div>

      {/* Sticky CTA — hidden on the payment step (CheckoutPanel owns its button) */}
      {step !== "payment" && (
        <div className="sticky bottom-0 border-t border-app-border bg-app-surface/95 px-4 py-3 pb-5 backdrop-blur">
          {submitting ? (
            <div className="flex h-12 w-full items-center justify-center rounded-xl bg-app-surface-sunken text-[13px] font-semibold text-app-text-muted">
              Submitting your booking…
            </div>
          ) : (
            <button
              type="button"
              onClick={handlePrimary}
              disabled={step === "details" && !holdExpired && !isValid}
              className={clsx(
                "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-bold transition",
                step === "details" && !holdExpired && !isValid
                  ? "cursor-not-allowed bg-app-surface-sunken text-app-text-muted"
                  : clsx(tk.bg, tk.textOn, "shadow-sm hover:opacity-95"),
              )}
            >
              {holdExpired && (
                <CalendarSearch className="h-4 w-4" aria-hidden />
              )}
              {step === "review" &&
                !holdExpired &&
                priceMode(eventType) === "free" && (
                  <Check className="h-4 w-4" aria-hidden />
                )}
              {ctaLabel}
            </button>
          )}
        </div>
      )}

      <TimezoneSelector
        open={tzOpen}
        value={tz}
        onClose={() => setTzOpen(false)}
        onSelect={setTz}
        pillar={pillar}
      />
    </div>
  );
}
