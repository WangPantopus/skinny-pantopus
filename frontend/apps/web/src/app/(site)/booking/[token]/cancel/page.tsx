// D10 — Cancel your booking (/booking/:token/cancel) — public, token. Thin
// server shell; the refund framing, policy gate and confirm live in the client
// CancelFlow.

import type { Metadata } from "next";
import { CancelFlow } from "@/components/scheduling/public/edge";

export const metadata: Metadata = {
  title: "Cancel booking · Pantopus",
  robots: { index: false, follow: false },
};

export default async function CancelRoute({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <CancelFlow token={token} />;
}
