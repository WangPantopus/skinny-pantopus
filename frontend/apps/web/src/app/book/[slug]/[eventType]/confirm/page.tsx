// W6 · D1 + D2 — the public confirm route (intake → review → checkout → create).
// W6 owns confirm/** ONLY; W5 owns the sibling [eventType]/page.tsx (slot picker)
// that hands off here with ?start&end&tz&duration. Server component for the shell
// + page-state handling (mirrors W5); the interactive ConfirmFlow is the client.
// noindex — a transient step; the canonical surface is the event page.

import type { Metadata } from "next";
import type { PublicBookingPage } from "@pantopus/types";
import { fetchPublicBooking } from "@/lib/publicShare";
import {
  PausedView,
  UnavailableView,
  pillarForOwner,
} from "@/components/scheduling";
import { ConfirmFlow } from "@/components/scheduling/public/confirm";
import type { PublicEventTypeWithQuestions } from "@/components/scheduling/public/confirm";

type RouteParams = { slug: string; eventType: string };
type Search = { start?: string; end?: string; tz?: string; duration?: string };

function hostName(
  title: string | null | undefined,
  fallback = "this host",
): string {
  const t = String(title ?? "").trim();
  return t || fallback;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { slug, eventType } = await params;
  const result = await fetchPublicBooking(slug);
  const data = result.data as PublicBookingPage | null;
  const et = (data?.eventTypes ?? []).find((e) => e.slug === eventType);
  const host = hostName(data?.page.title, "a Pantopus host");
  return {
    title: et
      ? `Confirm your ${et.name} with ${host} | Pantopus`
      : "Confirm your booking | Pantopus",
    description: "Add your details and confirm your time.",
    robots: { index: false, follow: false },
  };
}

export default async function ConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<Search>;
}) {
  const { slug, eventType } = await params;
  const sp = await searchParams;
  const result = await fetchPublicBooking(slug);
  const data = result.data as PublicBookingPage | null;

  if (!data) {
    if (result.status >= 500) {
      return (
        <UnavailableView
          title="Something went wrong"
          message="We couldn't load this booking page. Please try again."
        />
      );
    }
    return (
      <UnavailableView
        title="This link isn't available"
        message="It may have been turned off or moved. Double-check the link with whoever sent it."
      />
    );
  }

  const page = data.page;
  const pillar = pillarForOwner(page.owner_type);
  const host = hostName(page.title);

  if (data.status === "unavailable") {
    return (
      <UnavailableView
        title="This link isn't available"
        message="It may have been turned off or moved. Double-check the link with whoever sent it."
        pillar={pillar}
      />
    );
  }

  if (data.status === "paused") {
    return (
      <PausedView
        title="This page isn't taking bookings right now"
        message={`Check back later, or reach out to ${host} directly.`}
        pillar={pillar}
      />
    );
  }

  const et = (data.eventTypes ?? []).find((e) => e.slug === eventType) as
    | PublicEventTypeWithQuestions
    | undefined;
  if (!et) {
    return (
      <UnavailableView
        title="This time isn't available"
        message="This booking option may have been removed. Try picking another from the host's page."
        pillar={pillar}
      />
    );
  }

  const duration = Number(sp.duration);

  return (
    <ConfirmFlow
      slug={slug}
      eventTypeSlug={eventType}
      eventType={et}
      page={page}
      hostName={host}
      startAt={sp.start ?? null}
      endAt={sp.end ?? null}
      initialTz={sp.tz ?? page.timezone ?? ""}
      durationMin={Number.isFinite(duration) && duration > 0 ? duration : null}
    />
  );
}
