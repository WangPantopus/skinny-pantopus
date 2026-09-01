"use client";

// W15 · G10 — Buy Package (public / customer). Checkout reusing the read-only
// components/payments/StripeProvider + PaymentElement (never a hand-drawn card
// form), exactly like the W6 booking checkout — only the order reference
// differs. Flow: summary → POST /packages/:id/buy (creates the PackageCredit +
// returns a Stripe TEST clientSecret when priced) → confirm the PaymentIntent →
// credits granted. Free packages skip straight to success.
//
// The buy endpoint is authed (httpOnly cookie); a signed-out visitor gets a
// sign-in prompt. Package summary fields arrive via the link query params (no
// public single-package read exists) — display only; the charged amount is the
// server-created PaymentIntent, so it can't be tampered from the client.

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  BadgeCheck,
  CheckCircle2,
  CloudOff,
  Lock,
  LogIn,
  RotateCcw,
  Ticket,
  TicketCheck,
} from "lucide-react";
import {
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import * as api from "@pantopus/api";
import type {
  CancellationPolicyValue,
  SchedulingOwnerRef,
} from "@pantopus/types";
import StripeProvider from "@/components/payments/StripeProvider";
import {
  CancellationPolicy,
  pillarTokens,
  type Pillar,
} from "@/components/scheduling";
import { decodeError } from "@/components/scheduling/decodeError";
import {
  formatCents,
  perSessionLabel,
} from "@/components/scheduling/packages/money";

export interface BuyPackageProps {
  packageId: string;
  ownerRef: SchedulingOwnerRef;
  name: string;
  sessionsCount: number;
  priceCents: number;
  currency: string;
  ownerName: string;
  ownerSubtitle: string | null;
  pillar: Pillar;
  eligibleLabel: string | null;
  /** Wire value — object or string; the CancellationPolicy renderer tolerates both. */
  policy: CancellationPolicyValue | null;
  returnPath: string;
}

type Phase = "summary" | "checkout" | "success" | "signin" | "owned";

export default function BuyPackage(props: BuyPackageProps) {
  const {
    packageId,
    ownerRef,
    name,
    sessionsCount,
    priceCents,
    currency,
    ownerName,
    ownerSubtitle,
    pillar,
    eligibleLabel,
    policy,
    returnPath,
  } = props;

  const tk = pillarTokens(pillar);
  const [phase, setPhase] = useState<Phase>("summary");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [grantedSessions, setGrantedSessions] = useState(sessionsCount);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Pre-purchase credit detection: inline upsell if credits already exist.
  const [existingCredits, setExistingCredits] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    api.scheduling
      .getMyPackages(ownerRef)
      .then((res) => {
        if (!alive) return;
        const credits = (res.credits ?? []).filter(
          (c) => c.package_id === packageId && Number(c.remaining_sessions) > 0,
        );
        if (credits.length > 0) {
          setExistingCredits(
            credits.reduce(
              (sum, c) => sum + Math.max(0, Number(c.remaining_sessions) || 0),
              0,
            ),
          );
        }
      })
      .catch(() => {
        /* best-effort; gate stays hidden if unavailable */
      });
    return () => {
      alive = false;
    };
  }, [ownerRef, packageId]);

  const perSession = perSessionLabel(priceCents, sessionsCount, currency);
  const totalLabel = formatCents(priceCents, currency);

  const startPurchase = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.scheduling.buyPackage(packageId, ownerRef);
      if (res.credit?.remaining_sessions != null) {
        setGrantedSessions(res.credit.remaining_sessions);
      }
      if (res.clientSecret) {
        setClientSecret(res.clientSecret);
        setPhase("checkout");
      } else {
        setPhase("success");
      }
    } catch (err) {
      const decoded = decodeError(err);
      const code = decoded.kind === "error" ? decoded.code : null;
      if (code === "ALREADY_OWNED") {
        setPhase("owned");
      } else if (
        code === "UNAUTHORIZED" ||
        /sign in|log in|unauthor|not authenticated/i.test(decoded.message)
      ) {
        setPhase("signin");
      } else {
        setError(decoded.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (phase === "success") {
    return (
      <Shell pillar={pillar}>
        <div className="flex flex-col items-center py-8 text-center">
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-app-success-bg text-app-success">
            <CheckCircle2 className="h-8 w-8" aria-hidden />
          </span>
          <h1 className="text-lg font-bold text-app-text">
            You&apos;re all set
          </h1>
          <p className="mt-1.5 max-w-xs text-sm text-app-text-secondary">
            {grantedSessions} {grantedSessions === 1 ? "credit" : "credits"} for{" "}
            <span className="font-semibold text-app-text">{name}</span>{" "}
            {grantedSessions === 1 ? "is" : "are"} ready to use.
          </p>
          <Link
            href="/app/scheduling/my-packages"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-primary-700"
          >
            View my packages
          </Link>
        </div>
      </Shell>
    );
  }

  if (phase === "signin") {
    return (
      <Shell pillar={pillar}>
        <div className="flex flex-col items-center py-8 text-center">
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-app-surface-sunken text-app-text-secondary">
            <LogIn className="h-7 w-7" aria-hidden />
          </span>
          <h1 className="text-lg font-bold text-app-text">Sign in to buy</h1>
          <p className="mt-1.5 max-w-xs text-sm text-app-text-secondary">
            We&apos;ll send your receipt and credits to your account. Sign in to
            finish buying{" "}
            <span className="font-semibold text-app-text">{name}</span>.
          </p>
          <Link
            href={`/login?redirect=${encodeURIComponent(returnPath)}`}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-primary-700"
          >
            <LogIn className="h-4 w-4" aria-hidden />
            Sign in
          </Link>
        </div>
      </Shell>
    );
  }

  if (phase === "checkout" && clientSecret) {
    return (
      <Shell pillar={pillar}>
        <OwnerCard name={ownerName} subtitle={ownerSubtitle} pillar={pillar} />
        <SummaryCard
          name={name}
          sessionsCount={sessionsCount}
          perSession={perSession}
          total={totalLabel}
        />
        <Checkout
          clientSecret={clientSecret}
          payLabel={`Pay ${totalLabel}`}
          pillar={pillar}
          onPaid={() => setPhase("success")}
        />
      </Shell>
    );
  }

  // ── Summary ──────────────────────────────────────────────────
  // When ALREADY_OWNED is returned post-click, treat same as inline upsell.
  const displayedCredits =
    phase === "owned" ? (existingCredits ?? 1) : existingCredits;

  const free = priceCents <= 0;
  return (
    <Shell pillar={pillar}>
      <p className="text-[12px] leading-4 text-app-text-secondary">
        Save by buying {sessionsCount} sessions up front.
      </p>

      <OwnerCard name={ownerName} subtitle={ownerSubtitle} pillar={pillar} />

      {displayedCredits != null && displayedCredits > 0 && (
        <div className="flex flex-col gap-2.5 rounded-xl border border-app-info-light bg-app-info-bg p-3">
          <div className="flex items-start gap-2.5">
            <Ticket
              className="mt-0.5 h-4 w-4 shrink-0 text-app-info"
              aria-hidden
            />
            <span className="text-[11.5px] font-semibold leading-4 text-app-text-secondary">
              You already have {displayedCredits}{" "}
              {displayedCredits === 1 ? "credit" : "credits"} left on this
              package.
            </span>
          </div>
          <Link
            href="/app/scheduling/my-packages"
            className="flex h-9 w-full items-center justify-center rounded-[9px] border border-app-border-strong bg-app-surface text-[12.5px] font-bold text-app-text transition hover:bg-app-hover"
          >
            Use a credit instead
          </Link>
        </div>
      )}

      <SummaryCard
        name={name}
        sessionsCount={sessionsCount}
        perSession={perSession}
        total={totalLabel}
      />

      {eligibleLabel && (
        <div
          className={clsx("flex items-start gap-2.5 rounded-xl p-3", tk.bgSoft)}
        >
          <TicketCheck
            className={clsx("mt-0.5 h-4 w-4 shrink-0", tk.text)}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-[11.5px] font-bold text-app-text">
              Use credits on
            </p>
            <p className="mt-0.5 text-[11px] leading-4 text-app-text-secondary">
              {eligibleLabel}
            </p>
            <p className="mt-1 text-[10.5px] text-app-text-muted">
              Credits expire 1 year after purchase
            </p>
          </div>
        </div>
      )}

      {policy && <CancellationPolicy policy={policy} />}

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-app-error-light bg-app-error-bg px-3 py-2.5">
          <RotateCcw
            className="mt-0.5 h-4 w-4 shrink-0 text-app-error"
            aria-hidden
          />
          <p className="text-[11.5px] font-medium leading-4 text-app-error">
            {error}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={startPurchase}
        disabled={submitting}
        className={clsx(
          "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14.5px] font-bold transition disabled:cursor-not-allowed disabled:opacity-60",
          tk.bg,
          tk.textOn,
          "shadow-sm hover:opacity-95",
        )}
      >
        {submitting ? (
          "Starting checkout…"
        ) : (
          <>
            <Lock className="h-4 w-4" aria-hidden />
            {free ? "Get package" : `Pay ${totalLabel}`}
          </>
        )}
      </button>
    </Shell>
  );
}

function Shell({ children }: { pillar: Pillar; children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 py-8">
      <div className="flex flex-col gap-3">{children}</div>
    </main>
  );
}

function OwnerCard({
  name,
  subtitle,
  pillar,
}: {
  name: string;
  subtitle: string | null;
  pillar: Pillar;
}) {
  const tk = pillarTokens(pillar);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-app-border bg-app-surface p-3 shadow-sm">
      <span
        className={clsx(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[15px] font-bold text-white",
          tk.bg,
        )}
        aria-hidden
      >
        {name.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13.5px] font-bold text-app-text">
            {name}
          </span>
          <BadgeCheck
            className={clsx("h-3.5 w-3.5 shrink-0", tk.text)}
            aria-hidden
          />
        </div>
        {subtitle && (
          <p className="truncate text-[11px] text-app-text-muted">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  name,
  sessionsCount,
  perSession,
  total,
}: {
  name: string;
  sessionsCount: number;
  perSession: string | null;
  total: string;
}) {
  return (
    <div className="rounded-2xl border border-app-border bg-app-surface p-4 shadow-sm">
      <p className="mb-2 text-[14px] font-bold text-app-text">{name}</p>
      <Line
        label={`${sessionsCount} ${sessionsCount === 1 ? "session" : "sessions"}`}
        value={total}
      />
      {perSession && (
        <Line label="Per session" value={perSession.replace(" each", "")} />
      )}
      <div className="my-2 h-px bg-app-border" />
      <Line label="Total" value={total} strong />
    </div>
  );
}

function Line({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span
        className={clsx(
          strong
            ? "text-[13.5px] font-bold text-app-text"
            : "text-[12.5px] font-medium text-app-text-secondary",
        )}
      >
        {label}
      </span>
      <span
        className={clsx(
          "tabular-nums",
          strong
            ? "text-[16px] font-extrabold text-app-text"
            : "text-[13px] font-bold text-app-text",
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Stripe checkout (mirrors W6 CheckoutPanel) ─────────────────────────

function Checkout({
  clientSecret,
  payLabel,
  pillar,
  onPaid,
}: {
  clientSecret: string;
  payLabel: string;
  pillar: Pillar;
  onPaid: () => void;
}) {
  const [cardError, setCardError] = useState<string | null>(null);

  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-app-info-light bg-app-info-bg px-3 py-3">
        <CloudOff
          className="mt-0.5 h-4 w-4 shrink-0 text-app-info"
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-[12px] font-bold text-app-info">
            Card payments are briefly unavailable
          </p>
          <p className="mt-0.5 text-[11px] leading-4 text-app-text-secondary">
            Your package is reserved — try again in a moment, no need to start
            over.
          </p>
        </div>
      </div>
    );
  }

  return (
    <StripeProvider clientSecret={clientSecret}>
      <CheckoutInner
        payLabel={payLabel}
        pillar={pillar}
        onPaid={onPaid}
        cardError={cardError}
        setCardError={setCardError}
      />
    </StripeProvider>
  );
}

function CheckoutInner({
  payLabel,
  pillar,
  onPaid,
  cardError,
  setCardError,
}: {
  payLabel: string;
  pillar: Pillar;
  onPaid: () => void;
  cardError: string | null;
  setCardError: (v: string | null) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const tk = pillarTokens(pillar);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setCardError(null);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      });
      if (error) {
        setCardError(
          error.message || "That payment didn't go through. Try another card.",
        );
        setSubmitting(false);
        return;
      }
      const status = paymentIntent?.status;
      if (
        status === "succeeded" ||
        status === "processing" ||
        status === "requires_capture"
      ) {
        onPaid();
        return;
      }
      setCardError(
        "Your card needs another step. Check the card or try a different one.",
      );
      setSubmitting(false);
    } catch {
      setCardError(
        "Something went wrong taking the payment. Your package is still reserved.",
      );
      setSubmitting(false);
    }
  };

  return (
    <section>
      <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-app-text-secondary">
        Payment
      </p>

      {cardError && (
        <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-app-error-light bg-app-error-bg px-3 py-2.5">
          <RotateCcw
            className="mt-0.5 h-4 w-4 shrink-0 text-app-error"
            aria-hidden
          />
          <p className="text-[11.5px] font-medium leading-4 text-app-error">
            {cardError}
          </p>
        </div>
      )}

      <div className="rounded-xl border border-app-border bg-app-surface p-3">
        <PaymentElement options={{ layout: "tabs" }} />
      </div>

      <button
        type="button"
        onClick={handlePay}
        disabled={!stripe || !elements || submitting}
        className={clsx(
          "mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14.5px] font-bold transition",
          submitting || !stripe
            ? "cursor-not-allowed bg-app-surface-sunken text-app-text-muted"
            : clsx(tk.bg, tk.textOn, "shadow-sm hover:opacity-95"),
        )}
      >
        {submitting ? (
          "Confirming payment…"
        ) : (
          <>
            <Lock className="h-4 w-4" aria-hidden />
            {payLabel}
          </>
        )}
      </button>

      <div className="mt-2.5 flex items-center justify-center gap-1.5">
        <Lock className="h-3 w-3 text-app-text-muted" aria-hidden />
        <span className="text-[10.5px] font-medium text-app-text-muted">
          Payments secured by Stripe
        </span>
      </div>
    </section>
  );
}
