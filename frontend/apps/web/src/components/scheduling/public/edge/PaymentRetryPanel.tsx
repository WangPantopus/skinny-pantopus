"use client";

// D6 — Payment Failed / Retry (paid bookings, behind webFeatureFlags.schedulingPaid
// + Stripe TEST). A sheet body that HOLDS the slot while the invitee retries —
// preventing "paid but lost my slot". Card entry stays in the native Stripe
// element (the parent wraps StripeProvider and drives onRetry); this surface owns
// the calm error framing, the live hold countdown, and the never-charge-twice copy.

import { useEffect, useState } from "react";
import {
  CreditCard,
  Timer,
  TimerOff,
  CheckCircle2,
  CalendarSearch,
  RotateCcw,
  ShieldCheck,
  BadgeCheck,
  Lock,
  X,
} from "lucide-react";
import clsx from "clsx";
import { money } from "./edgeUtils";

export type PaymentRetryState =
  | "declined"
  | "hold_expired"
  | "timeout"
  | "succeeded";

type Tone = "error" | "warn" | "info" | "success";

const TONES: Record<Tone, { halo: string; ring: string; icon: string }> = {
  error: {
    halo: "bg-app-error-bg",
    ring: "border-app-error-light",
    icon: "text-app-error",
  },
  warn: {
    halo: "bg-app-warning-bg",
    ring: "border-app-warning-light",
    icon: "text-app-warning",
  },
  info: {
    halo: "bg-app-info-bg",
    ring: "border-app-info-light",
    icon: "text-app-info",
  },
  success: {
    halo: "bg-app-success-bg",
    ring: "border-app-success-light",
    icon: "text-app-success",
  },
};

function mmss(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function Halo({
  tone,
  icon: Icon,
  title,
  body,
}: {
  tone: Tone;
  icon: typeof CreditCard;
  title: string;
  body: string;
}) {
  const t = TONES[tone];
  return (
    <div className="flex flex-col items-center gap-3 px-4 text-center">
      <span
        className={clsx(
          "flex h-14 w-14 items-center justify-center rounded-full border-2",
          t.halo,
          t.ring,
        )}
      >
        <Icon className={clsx("h-6 w-6", t.icon)} aria-hidden />
      </span>
      <div>
        <h2 className="text-lg font-bold text-app-text-strong">{title}</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-xs leading-snug text-app-text-secondary">
          {body}
        </p>
      </div>
    </div>
  );
}

function HoldChip({
  seconds,
  timeLabel,
}: {
  seconds: number | null;
  timeLabel?: string;
}) {
  const released = seconds != null && seconds <= 0;
  const tone = released ? TONES.error : TONES.warn;
  return (
    <div
      className={clsx(
        "mx-auto inline-flex items-center gap-2 rounded-full border px-3 py-2",
        tone.halo,
        tone.ring,
      )}
    >
      {released ? (
        <>
          <TimerOff className="h-3.5 w-3.5 text-app-error" aria-hidden />
          <span className="text-xs font-bold text-app-error">
            Hold released
          </span>
        </>
      ) : (
        <>
          <Timer className="h-3.5 w-3.5 text-app-warning" aria-hidden />
          <span className="text-xs font-semibold text-app-text">
            Holding your {timeLabel || "time"} for{" "}
            <b className="font-extrabold tabular-nums">{mmss(seconds ?? 0)}</b>
          </span>
        </>
      )}
    </div>
  );
}

export default function PaymentRetryPanel({
  state,
  reason,
  holdSeconds = 300,
  timeLabel,
  amountCents,
  currency = "USD",
  onRetry,
  onPickAnotherTime,
  onDismiss,
  retrying = false,
  className,
}: {
  state: PaymentRetryState;
  /** Decline reason, e.g. "Your card was declined — not enough funds." */
  reason?: string;
  /** Initial hold seconds (counts down live). Ignored once expired/succeeded. */
  holdSeconds?: number;
  /** Slot label for the hold chip, e.g. "2:00 PM time". */
  timeLabel?: string;
  amountCents?: number | null;
  currency?: string;
  onRetry?: () => void;
  onPickAnotherTime?: () => void;
  onDismiss?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  const [remaining, setRemaining] = useState(holdSeconds);

  useEffect(() => {
    if (state !== "declined" && state !== "timeout") return;
    setRemaining(holdSeconds);
    const id = window.setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [state, holdSeconds]);

  if (state === "succeeded") {
    return (
      <div className={clsx("space-y-4 py-2", className)}>
        <Halo
          tone="success"
          icon={CheckCircle2}
          title="Payment went through"
          body="Your second card worked. Taking you to your booking."
        />

        {/* Amount chip — BadgeCheck capsule (design: success-toned capsule) */}
        {amountCents != null && (
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-app-success-light bg-app-success-bg px-3 py-2">
            <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-app-success" aria-hidden />
            <span className="text-[11.5px] font-bold text-app-success">
              Paid {money(amountCents, currency)} · receipt on its way
            </span>
          </div>
        )}

        {/* Auto-advance progress bar + pulsing indicator (design Frame 4) */}
        <div className="flex flex-col items-center gap-2 pt-0.5">
          {/* 70%-wide track, 62%-fill success bar */}
          <div
            className="h-[5px] overflow-hidden rounded-full bg-app-surface-sunken"
            style={{ width: "70%" }}
          >
            <div
              className="h-full rounded-full bg-app-success"
              style={{ width: "62%" }}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-app-success"
              aria-hidden
            />
            <span className="text-[11px] font-semibold text-app-text-muted">
              Confirming your booking
            </span>
          </div>
        </div>

        <p className="flex items-center justify-center gap-1.5 text-xs text-app-text-muted">
          <Lock className="h-3 w-3" aria-hidden />
          Payments secured by Stripe
        </p>
      </div>
    );
  }

  if (state === "hold_expired") {
    return (
      <div className={clsx("space-y-4 py-2", className)}>
        <Halo
          tone="error"
          icon={CreditCard}
          title="Your payment didn’t go through"
          body="Your time opened back up while we waited. You can grab a new one — still nothing charged."
        />
        <HoldChip seconds={0} timeLabel={timeLabel} />
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onPickAnotherTime}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-app-personal px-4 py-3 text-sm font-bold text-white"
          >
            <CalendarSearch className="h-4 w-4" aria-hidden />
            Pick a time again
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm font-bold text-app-text hover:bg-app-hover"
            >
              <X className="h-4 w-4" aria-hidden />
              Not now
            </button>
          )}
        </div>
        <p className="text-center text-xs font-semibold text-app-text-muted">
          We never charge twice.
        </p>
      </div>
    );
  }

  const isTimeout = state === "timeout";
  return (
    <div className={clsx("space-y-4 py-2", className)}>
      <Halo
        tone={isTimeout ? "info" : "error"}
        icon={CreditCard}
        title={
          isTimeout
            ? "We’re not sure that went through"
            : "Your payment didn’t go through"
        }
        body={
          isTimeout
            ? "The connection dropped before we heard back. We won’t double-charge you — check again to see where it landed."
            : reason || "Your card was declined. Nothing was charged."
        }
      />
      <HoldChip seconds={remaining} timeLabel={timeLabel} />
      {isTimeout && (
        <div className="flex items-start gap-2 rounded-xl border border-app-info-light bg-app-info-bg p-3">
          <ShieldCheck
            className="mt-0.5 h-4 w-4 shrink-0 text-app-info"
            aria-hidden
          />
          <p className="text-xs leading-snug text-app-text-secondary">
            If the first try did go through, checking again won’t charge you a
            second time.
          </p>
        </div>
      )}
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-app-personal px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {isTimeout ? (
            <RotateCcw className="h-4 w-4" aria-hidden />
          ) : (
            <CreditCard className="h-4 w-4" aria-hidden />
          )}
          {retrying
            ? "Checking…"
            : isTimeout
              ? "Check again"
              : "Try another card"}
        </button>
        <button
          type="button"
          onClick={onPickAnotherTime}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm font-bold text-app-text hover:bg-app-hover"
        >
          <CalendarSearch className="h-4 w-4" aria-hidden />
          Use a different time
        </button>
      </div>
      <p className="text-center text-xs font-semibold text-app-text-muted">
        {isTimeout ? "We never charge twice." : "Your time is still held."}
      </p>
    </div>
  );
}
