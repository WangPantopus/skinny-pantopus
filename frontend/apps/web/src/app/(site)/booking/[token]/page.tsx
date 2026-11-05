// W6 · D4 — Manage your booking (token-authed, signed-out). The route file is
// W6's; the actual reschedule/cancel UIs at /booking/:token/reschedule and
// /cancel are owned by W7 (this surface links to them). Server wrapper sets
// noindex (private, token-scoped) and renders the client ManageBookingPanel,
// which loads the booking from the manage token.

import type { Metadata } from "next";
import { ManageBookingPanel } from "@/components/scheduling/public/confirm";

export const metadata: Metadata = {
  title: "Your booking | Pantopus",
  description: "View, reschedule, or cancel your booking.",
  robots: { index: false, follow: false },
};

export default async function ManageBookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ManageBookingPanel token={token} />;
}
