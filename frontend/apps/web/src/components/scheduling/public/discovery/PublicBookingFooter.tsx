// C5 — public booking footer. Optional "View [name]'s profile" link in sky blue
// above the "Powered by Pantopus" wordmark — present whenever the host name is
// known. Matches booking-landing-frames.jsx:374-393. Presentational + server-safe.

import Link from "next/link";
import { ArrowUpRight, CalendarClock } from "lucide-react";

export default function PublicBookingFooter({ name }: { name?: string }) {
  return (
    <footer className="flex flex-col items-center gap-2.5 px-4 pb-8 pt-6">
      {name && (
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs font-bold text-app-info hover:opacity-80"
        >
          <span>View {name}&apos;s profile</span>
          <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden />
        </Link>
      )}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-app-text-muted hover:text-app-text-secondary"
      >
        <CalendarClock className="h-3 w-3" aria-hidden />
        <span className="text-[11px] font-semibold tracking-wide">
          Powered by Pantopus
        </span>
      </Link>
    </footer>
  );
}
