// C5 — Booking landing / booker profile (public, no auth). Server component:
// the page shell is fetched server-side via fetchPublicBooking for SEO +
// generateMetadata (mirrors support-trains/[id]/page.tsx). Slots are fetched
// client-side later (C6). First-class page states are honored: not-found /
// unavailable → W0 UnavailableView; paused / no-event-types → the host profile
// stays visible with an inline state card; 5xx → retryable error.

import type { Metadata } from "next";
import { headers } from "next/headers";
import { Moon, CalendarOff } from "lucide-react";
import type { PublicBookingPage } from "@pantopus/types";
import {
  buildBookingPageAppUrl,
  buildBookingPagePath,
  buildBookingPageUrl,
} from "@pantopus/utils";
import {
  absoluteMediaUrl,
  buildShareMetadata,
  fetchPublicBooking,
  getStoreDownloadCta,
  summarizeText,
} from "@/lib/publicShare";
import { UnavailableView, pillarForOwner } from "@/components/scheduling";
import {
  BookerProfileHeader,
  EventTypeMenu,
  ProfileStateCard,
  PublicBookingFooter,
  PublicErrorState,
  hostNameFrom,
} from "@/components/scheduling/public/discovery";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await fetchPublicBooking(slug);
  const data = result.data as PublicBookingPage | null;

  if (!data) {
    return {
      title: "Booking page not available | Pantopus",
      description: "This booking link may have been turned off or moved.",
    };
  }

  const page = data.page;
  const name = hostNameFrom(page.title, "a Pantopus host");
  return buildShareMetadata({
    title: page.title ? `Book time with ${page.title}` : "Book a time",
    description: summarizeText(
      page.intro || page.tagline,
      160,
      `Pick a time to meet with ${name}.`,
    ),
    path: buildBookingPagePath(slug),
    image: absoluteMediaUrl(page.avatar_url),
    appArgument: buildBookingPageAppUrl(slug),
  });
}

export default async function PublicBookingLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await fetchPublicBooking(slug);
  const data = result.data as PublicBookingPage | null;
  const userAgent = (await headers()).get("user-agent") || "";
  const fallbackUrl = getStoreDownloadCta(userAgent)?.href ?? null;

  // Hard failures: 5xx is retryable; anything else (404 etc.) = link gone.
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
  const name = hostNameFrom(page.title, "this host");

  if (data.status === "unavailable") {
    return (
      <UnavailableView
        title="This link isn't available"
        message="It may have been turned off or moved. Double-check the link with whoever sent it."
        pillar={pillar}
      />
    );
  }

  const eventTypes = Array.isArray(data.eventTypes) ? data.eventTypes : [];
  const isPaused = data.status === "paused";
  const isEmpty = !isPaused && eventTypes.length === 0;

  return (
    <div className="mx-auto w-full max-w-md pb-2">
      <BookerProfileHeader
        page={page}
        pillar={pillar}
        avatarUrl={absoluteMediaUrl(page.avatar_url)}
        pageUrl={buildBookingPageUrl(slug)}
        appUrl={buildBookingPageAppUrl(slug)}
        fallbackUrl={fallbackUrl}
        showAppBanner={!isPaused && eventTypes.length > 1}
      />

      {isPaused ? (
        <ProfileStateCard
          icon={Moon}
          title="This page isn't taking bookings right now"
          body={`Check back later, or reach out to ${name} directly.`}
        />
      ) : isEmpty ? (
        <ProfileStateCard
          icon={CalendarOff}
          title="No times are set up yet"
          body={`${name} hasn't added any availability. Check back soon.`}
          dashed
        />
      ) : (
        <EventTypeMenu slug={slug} eventTypes={eventTypes} pillar={pillar} />
      )}

      <PublicBookingFooter name={name} />
    </div>
  );
}
