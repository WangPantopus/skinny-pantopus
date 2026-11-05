"use client";

// W14 · G14 — Cancellation & Refund Policy editor page. Behind
// webFeatureFlags.schedulingPaid; business (violet) pillar. Writes
// cancellation_policy to the booking page via PUT /booking-page.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import BusinessOwnerBoundary from "@/components/scheduling/business/BusinessOwnerBoundary";
import { webFeatureFlags } from "@/lib/featureFlags";
import { RefundPolicyEditor } from "@/components/scheduling/payments";

export default function RefundPolicyPage() {
  if (!webFeatureFlags.schedulingPaid) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <h2 className="mb-1.5 text-base font-semibold text-app-text">
          Paid scheduling is turned off
        </h2>
        <p className="max-w-sm text-sm leading-relaxed text-app-text-secondary">
          The cancellation &amp; refund policy editor is available once paid
          scheduling is enabled.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <header className="mb-5">
        <Link
          href="/app/scheduling/payments"
          className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-app-text-secondary transition hover:text-app-text"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Payments
        </Link>
        <p className="text-xs font-bold uppercase tracking-wider text-app-business">
          Calendarly · Policy
        </p>
        <h1 className="text-xl font-bold text-app-text">
          Cancellation &amp; refund policy
        </h1>
        <p className="mt-0.5 text-sm text-app-text-secondary">
          Pick how refunds work when someone cancels. Invitees see this wording
          before they pay.
        </p>
      </header>

      <BusinessOwnerBoundary>
        {(owner) => <RefundPolicyEditor owner={owner} />}
      </BusinessOwnerBoundary>
    </div>
  );
}
