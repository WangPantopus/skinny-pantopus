// D5/D7 — Manage-flow state presenter (/booking/:token/states?status=…).
// A SINGLE route with a status switch (never separate routes per state). The
// status query selects the W0 state view via the W7 StateRouter; the manage
// path is offered as the "book again" target for the cancelled state.

import type { Metadata } from "next";
import { buildBookingManagePath } from "@pantopus/utils";
import {
  StateRouter,
  type ManageState,
} from "@/components/scheduling/public/edge";

export const metadata: Metadata = {
  title: "Booking · Pantopus",
  robots: { index: false, follow: false },
};

const ALLOWED: ManageState[] = [
  "not_found",
  "secret",
  "expired",
  "paused",
  "fully_booked",
  "cancelled",
];

function coerce(value: string | undefined): ManageState {
  return value && (ALLOWED as string[]).includes(value)
    ? (value as ManageState)
    : "not_found";
}

export default async function BookingStatesRoute({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const statusRaw = Array.isArray(sp.status) ? sp.status[0] : sp.status;
  const messageRaw = Array.isArray(sp.message) ? sp.message[0] : sp.message;
  const reopenRaw = Array.isArray(sp.reopenAt) ? sp.reopenAt[0] : sp.reopenAt;

  return (
    <StateRouter
      state={coerce(statusRaw)}
      message={messageRaw}
      reopenAt={reopenRaw}
      bookAgainHref={buildBookingManagePath(token)}
    />
  );
}
