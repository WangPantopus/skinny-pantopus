// W6 · D3 — Booking confirmed / thank-you (token-scoped). Reached after create
// or from the email-receipt link. Server wrapper sets noindex (private) and
// renders the client ConfirmedView, which loads the booking from the manage
// token (so it works on refresh / from email, not just right after POST).

import type { Metadata } from "next";
import { ConfirmedView } from "@/components/scheduling/public/confirm";

export const metadata: Metadata = {
  title: "Booking confirmed | Pantopus",
  description: "Your booking is confirmed.",
  robots: { index: false, follow: false },
};

export default async function ConfirmedPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ConfirmedView token={token} />;
}
