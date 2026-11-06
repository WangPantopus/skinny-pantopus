// C6 — Date + time slot picker for a chosen event type (public, no auth).
// Server component for SEO + generateMetadata; the interactive picker (calendar,
// timezone C7, no-availability C8) is the client PublicSlotPicker wrapping the
// W0 SlotPicker. Picking a slot hands off to W6 via the …/confirm route.

import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { PublicBookingPage } from "@pantopus/types";
import {
  buildBookingEventPath,
  buildBookingPageAppUrl,
  buildBookingPagePath,
} from "@pantopus/utils";
import {
  absoluteMediaUrl,
  buildShareMetadata,
  fetchPublicBooking,
  summarizeText,
} from "@/lib/publicShare";
import {
  PausedView,
  UnavailableView,
  pillarForOwner,
} from "@/components/scheduling";
import {
  PublicErrorState,
  PublicSlotPicker,
  hostNameFrom,
} from "@/components/scheduling/public/discovery";

type RouteParams = { slug: string; eventType: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { slug, eventType } = await params;
  const result = await fetchPublicBooking(slug);
  const data = result.data as PublicBookingPage | null;

  if (!data) {
    return {
      title: "Pick a time | Pantopus",
      description: "Choose a time that works for you.",
    };
  }

  const host = hostNameFrom(data.page.title, "a Pantopus host");
  const et = (data.eventTypes ?? []).find((e) => e.slug === eventType);
  return buildShareMetadata({
    title: et ? `${et.name} with ${host}` : `Book a time with ${host}`,
    description: summarizeText(
      et?.description || data.page.intro,
      160,
      `Pick a time to meet with ${host}.`,
    ),
    path: buildBookingEventPath(slug, eventType),
    image: absoluteMediaUrl(data.page.avatar_url),
    appArgument: buildBookingPageAppUrl(slug),
  });
}

export default async function PublicSlotPickerPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug, eventType } = await params;
  const result = await fetchPublicBooking(slug);
  const data = result.data as PublicBookingPage | null;

  if (!data) {
    if (result.status >= 500) return <PublicErrorState />;
    return (
      <UnavailableView
        title="This link isn't available"
        message="It may have been turned off or moved. Double-check the link with whoever sent it."
      />
    );
  }

  const page = data.page;
  const pillar = pillarForOwner(page.owner_type);
  const host = hostNameFrom(page.title, "this host");

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

  const et = (data.eventTypes ?? []).find((e) => e.slug === eventType);
  if (!et) {
    return (
      <UnavailableView
        title="This time isn't available"
        message="This booking option may have been removed. Try picking another from the host's page."
        pillar={pillar}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="flex h-12 items-center border-b border-app-border bg-app-surface px-2">
        <Link
          href={buildBookingPagePath(slug)}
          aria-label="Back to the booking page"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-app-text hover:bg-app-hover"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Link>
        <h1 className="flex-1 text-center text-[15px] font-semibold text-app-text">
          Pick a time
        </h1>
        <span className="h-9 w-9" aria-hidden />
      </div>

      <div className="px-4 py-3">
        <PublicSlotPicker
          slug={slug}
          eventTypeSlug={eventType}
          eventType={et}
          hostName={host}
          pillar={pillar}
        />
      </div>
    </div>
  );
}
