"use client";

// W14 · Scheduling Payments home — G6 (Stripe Connect & Tax) + G7 (Payouts &
// Earnings), scheduling-scoped. The entire surface sits behind
// webFeatureFlags.schedulingPaid (Stripe TEST mode) and themes to the business
// (violet) pillar. A segmented control switches Setup ↔ Earnings; the
// cancellation/refund policy editor (G14) is one tap away.

import { Suspense, useState } from "react";
import Link from "next/link";
import { CreditCard, ScrollText, WalletCards } from "lucide-react";
import clsx from "clsx";
import BusinessOwnerBoundary from "@/components/scheduling/business/BusinessOwnerBoundary";
import { webFeatureFlags } from "@/lib/featureFlags";
import {
  PayoutsEarnings,
  SchedulingConnectPanel,
} from "@/components/scheduling/payments";

type Tab = "setup" | "earnings";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "setup", label: "Setup" },
  { key: "earnings", label: "Earnings" },
];

function PaymentsDisabled() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-app-business-bg text-app-business">
        <WalletCards className="h-7 w-7" strokeWidth={1.8} aria-hidden />
      </span>
      <h2 className="mb-1.5 text-base font-semibold text-app-text">
        Paid scheduling is turned off
      </h2>
      <p className="max-w-sm text-sm leading-relaxed text-app-text-secondary">
        Connecting Stripe, payouts, and priced bookings are disabled for this
        workspace. Turn on paid scheduling to set up payments.
      </p>
    </div>
  );
}

function PaymentsContent() {
  const [tab, setTab] = useState<Tab>("setup");

  return (
    <div className="pb-8">
      <header className="mb-5">
        <p className="text-xs font-bold uppercase tracking-wider text-app-business">
          Calendarly · Payments
        </p>
        <h1 className="text-xl font-bold text-app-text">Payments</h1>
        <p className="mt-0.5 text-sm text-app-text-secondary">
          Connect Stripe to take booking payments, then track payouts and
          earnings.
        </p>
      </header>

      {/* Segmented control. */}
      <div
        role="tablist"
        aria-label="Payments sections"
        className="mb-5 inline-flex gap-1 rounded-lg bg-app-surface-sunken p-1"
      >
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={clsx(
                "rounded-md px-4 py-2 text-sm font-semibold transition-colors",
                active
                  ? "bg-app-surface text-app-business shadow-sm"
                  : "text-app-text-secondary hover:text-app-text",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <BusinessOwnerBoundary>
        {(owner) =>
          tab === "setup" ? (
            <SchedulingConnectPanel owner={owner} />
          ) : (
            <PayoutsEarnings owner={owner} />
          )
        }
      </BusinessOwnerBoundary>

      {/* Policy editor handoff (G14). */}
      <Link
        href="/app/scheduling/payments/policy"
        className="mt-5 flex items-center gap-3 rounded-2xl border border-app-border bg-app-surface px-4 py-3 shadow-sm transition hover:bg-app-hover"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-app-business-bg text-app-business">
          <ScrollText className="h-4.5 w-4.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-app-text">
            Cancellation &amp; refund policy
          </div>
          <div className="text-xs text-app-text-secondary">
            Choose how refunds work when someone cancels.
          </div>
        </div>
        <CreditCard className="h-4 w-4 text-app-text-muted" aria-hidden />
      </Link>
    </div>
  );
}

export default function SchedulingPaymentsPage() {
  if (!webFeatureFlags.schedulingPaid) {
    return <PaymentsDisabled />;
  }
  return (
    <Suspense>
      <PaymentsContent />
    </Suspense>
  );
}
