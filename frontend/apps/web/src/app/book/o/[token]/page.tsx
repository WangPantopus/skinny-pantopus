// One-off / single-use booking link (/book/o/:token) — public, no auth.
// Server component: the eventType + link state are fetched server-side
// (fetchPublicOneOff). Expired / used links render the W0 expired state
// (D7); a live link renders the client OneOffLanding (W0 SlotPicker → intake →
// create; 409 + paid checkout handled there). A web smart-banner (D9) offers
// the app hand-off.

import type { Metadata } from "next";
import { headers } from "next/headers";
import type { PublicOneOff } from "@pantopus/types";
import { fetchPublicOneOff, getStoreDownloadCta } from "@/lib/publicShare";
import {
  OneOffLanding,
  StateRouter,
  OpenInAppHandoff,
} from "@/components/scheduling/public/edge";

export const metadata: Metadata = {
  title: "Your invite · Pantopus",
  description: "A personal invite to book a time.",
  robots: { index: false, follow: false },
};

export default async function OneOffBookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await fetchPublicOneOff(token);
  const data = result.data as PublicOneOff | null;
  const userAgent = (await headers()).get("user-agent") || "";
  const fallbackUrl = getStoreDownloadCta(userAgent)?.href ?? null;

  // Invalid / expired / consumed single-use link → first-class expired state.
  if (!data || data.status === "expired" || data.error || !data.eventType) {
    return (
      <StateRouter
        state="expired"
        message={
          data?.message ||
          "This link is invalid, already used, or expired. Ask your host for a fresh one."
        }
      />
    );
  }

  return (
    <div>
      <OpenInAppHandoff
        appUrl={`pantopus:///book/o/${encodeURIComponent(token)}`}
        fallbackUrl={fallbackUrl}
        subtitle="Faster, with your saved details"
      />
      <OneOffLanding token={token} eventType={data.eventType} />
    </div>
  );
}
