// W14 · pure Stripe Connect state machine (no React) so it's unit-testable.
// Maps GET /payments/status + the platform StripeAccount into the five A18
// states the G6 panel renders.

import type { PaymentsStatus, StripeAccount } from "@pantopus/types";

export type ConnectState =
  | "not_applicable"
  | "not_connected"
  | "incomplete"
  | "restricted"
  | "ready";

export function deriveConnectState(
  status: PaymentsStatus | null | undefined,
  account: StripeAccount | null | undefined,
): ConnectState {
  if (status && status.applicable === false) return "not_applicable";
  if (!account) {
    if (status?.connected && status.charges_enabled && status.payouts_enabled)
      return "ready";
    if (status?.connected) return "incomplete";
    return "not_connected";
  }
  if (account.charges_enabled && account.payouts_enabled) return "ready";
  if (!account.details_submitted) return "incomplete";
  if (account.charges_enabled && !account.payouts_enabled) return "restricted";
  return "incomplete";
}
