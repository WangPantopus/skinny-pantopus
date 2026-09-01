// D10 — Reschedule your booking (/booking/:token/reschedule) — public, token.
// Thin server shell; the policy gate (cutoff / not-online), slot picker, 409
// recovery and confirm live in the client RescheduleFlow.

import type { Metadata } from "next";
import { RescheduleFlow } from "@/components/scheduling/public/edge";

export const metadata: Metadata = {
  title: "Reschedule · Pantopus",
  robots: { index: false, follow: false },
};

export default async function RescheduleRoute({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <RescheduleFlow token={token} />;
}
