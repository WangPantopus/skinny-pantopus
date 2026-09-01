// D7 — Unavailable / Expired / Paused / Secret (+ not-found, fully-booked,
// already-cancelled). ONE catch-all terminal-state presenter that switches only
// its icon / headline / body on a status code, reusing the W0 state views (which
// share the Support-Train "not shareable" chrome). This is a single component
// with a status switch — never separate routes per state.

import type { ReactNode } from "react";
import Link from "next/link";
import { XCircle } from "lucide-react";
import {
  PausedView,
  SecretView,
  ExpiredView,
  UnavailableView,
  NoAvailabilityView,
  TerminalState,
  type Pillar,
} from "@/components/scheduling";

export type ManageState =
  | "not_found"
  | "secret"
  | "expired"
  | "paused"
  | "fully_booked"
  | "cancelled";

export interface StateRouterProps {
  state: ManageState;
  pillar?: Pillar;
  /** Override the body copy (e.g. the host's pause message). */
  message?: string;
  /** Pause reopen date label (paused state). */
  reopenAt?: string | null;
  /** "Book again" target for the cancelled state. */
  bookAgainHref?: string | null;
  /** State-specific affordance (e.g. a code input for secret links). */
  children?: ReactNode;
}

export default function StateRouter({
  state,
  pillar,
  message,
  reopenAt,
  bookAgainHref,
  children,
}: StateRouterProps) {
  switch (state) {
    case "secret":
      return (
        <SecretView pillar={pillar} message={message || undefined}>
          {children}
        </SecretView>
      );
    case "expired":
      return (
        <ExpiredView pillar={pillar} message={message || undefined}>
          {children}
        </ExpiredView>
      );
    case "paused":
      return (
        <PausedView
          pillar={pillar}
          title="Bookings are paused"
          message={message || undefined}
          reopenAt={reopenAt}
        >
          {children}
        </PausedView>
      );
    case "fully_booked":
      return (
        <NoAvailabilityView pillar={pillar} message={message || undefined}>
          {children}
        </NoAvailabilityView>
      );
    case "cancelled":
      return (
        <TerminalState
          icon={XCircle}
          pillar={pillar}
          title="This booking was cancelled"
          body={message || "This time is no longer reserved."}
        >
          {bookAgainHref ? (
            <Link
              href={bookAgainHref}
              className="text-sm font-semibold text-app-text-secondary underline hover:text-app-text"
            >
              Book again
            </Link>
          ) : (
            children
          )}
        </TerminalState>
      );
    case "not_found":
    default:
      return (
        <UnavailableView
          pillar={pillar}
          title="We can’t find that page"
          message={
            message ||
            "The link may be mistyped, or it’s been turned off. Double-check it with whoever sent it."
          }
        >
          {children}
        </UnavailableView>
      );
  }
}
