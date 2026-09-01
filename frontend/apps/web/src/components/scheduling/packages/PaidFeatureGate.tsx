"use client";

// W15 — gates the paid host surfaces (packages, invoices) behind
// webFeatureFlags.schedulingPaid. When off, renders a calm "not available yet"
// panel instead of the feature (these surfaces stay behind the flag + Stripe
// TEST mode; payout settlement is deferred). Default ON in non-prod.

import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { webFeatureFlags } from "@/lib/featureFlags";

export default function PaidFeatureGate({
  feature,
  children,
}: {
  feature: string;
  children: ReactNode;
}) {
  if (webFeatureFlags.schedulingPaid) return <>{children}</>;
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-app-surface-sunken text-app-text-muted">
        <Lock className="h-6 w-6" strokeWidth={1.8} aria-hidden />
      </span>
      <h1 className="mb-1.5 text-[15px] font-semibold text-app-text">
        {feature} aren&apos;t available yet
      </h1>
      <p className="max-w-xs text-sm text-app-text-secondary">
        Paid scheduling is being rolled out. Check back soon to start selling
        and invoicing.
      </p>
    </div>
  );
}
