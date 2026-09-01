// D12 — Recurring / multi-session setup (customer-side). Authed; the scheduling
// layout supplies the chrome + SchedulingOwnerProvider. The recurrence builder
// (which reads its event-type context from the query string) lives in the
// client RecurringSetup, wrapped in Suspense for useSearchParams().

import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { RecurringSetup } from "@/components/scheduling/public/edge";

export const metadata = {
  title: "Set up a series · Scheduling",
};

export default function RecurringRoute() {
  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <Link
          href="/app/scheduling/my-bookings"
          aria-label="Back to my bookings"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-app-border bg-app-surface text-app-text hover:bg-app-hover"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-app-text-strong">
            Set up your series
          </h1>
          <p className="mt-0.5 text-sm text-app-text-secondary">
            Book repeating sessions in one go.
          </p>
        </div>
      </div>
      <Suspense
        fallback={
          <div className="h-64 animate-pulse rounded-2xl bg-app-surface-muted" />
        }
      >
        <RecurringSetup />
      </Suspense>
    </div>
  );
}
