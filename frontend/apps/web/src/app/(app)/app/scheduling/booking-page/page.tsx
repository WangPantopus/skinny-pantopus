// C1 — Booking link / public page management (+ H16 empty/zero-state).
// The scheduling layout supplies AppShell chrome, the section nav, and the
// SchedulingOwnerProvider; this route owns the management surface itself.

import Link from "next/link";
import { ExternalLink, Eye } from "lucide-react";
import PageManager from "@/components/scheduling/booking-page/PageManager";

export const metadata = {
  title: "Booking link · Scheduling",
};

export default function BookingPageManagementRoute() {
  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-app-text-strong">
            Booking link
          </h1>
          <p className="mt-0.5 text-sm text-app-text-secondary">
            Manage your public booking page and what people can book.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/app/scheduling/booking-page/preview"
            className="inline-flex items-center gap-1.5 rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm font-semibold text-app-text hover:bg-app-hover"
          >
            <Eye className="h-4 w-4" aria-hidden />
            Preview
          </Link>
          <Link
            href="/app/scheduling/booking-page/embed"
            className="hidden items-center gap-1.5 rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm font-semibold text-app-text hover:bg-app-hover sm:inline-flex"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            Embed
          </Link>
        </div>
      </div>
      <PageManager />
    </div>
  );
}
