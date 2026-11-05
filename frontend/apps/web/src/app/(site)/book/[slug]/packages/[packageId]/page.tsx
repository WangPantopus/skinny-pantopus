// W15 · G10 — Buy Package (public / customer). Server component for SEO +
// generateMetadata (fetchPublicBooking gives the host identity, pillar, and
// cancellation policy). The interactive checkout is the client BuyPackage.
//
// Package summary fields ride in via link query params — there is no public
// single-package read endpoint, and they're display-only (the charged amount is
// the server-created PaymentIntent). Missing essentials → a clean unavailable
// state. Everything stays behind schedulingPaid + Stripe TEST mode.

import type { Metadata } from "next";
import type {
  PublicBookingPage,
  SchedulingOwnerRef,
  SchedulingOwnerType,
} from "@pantopus/types";
import { webFeatureFlags } from "@/lib/featureFlags";
import { fetchPublicBooking } from "@/lib/publicShare";
import { UnavailableView, pillarForOwner } from "@/components/scheduling";
import { BuyPackage } from "@/components/scheduling/packages";

type RouteParams = { slug: string; packageId: string };
type Search = {
  name?: string;
  sessions?: string;
  price_cents?: string;
  currency?: string;
  owner_type?: string;
  owner_id?: string;
  event_type_id?: string;
};

function hostName(
  title: string | null | undefined,
  fallback = "this host",
): string {
  const t = String(title ?? "").trim();
  return t || fallback;
}

function intParam(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
}

function ownerTypeOf(raw: string | undefined): SchedulingOwnerType {
  if (raw === "business") return "business";
  if (raw === "home") return "home";
  return "user";
}

function buildOwnerRef(
  ownerType: SchedulingOwnerType,
  ownerId: string | undefined,
): SchedulingOwnerRef {
  if (ownerType === "home" && ownerId) {
    return { ownerType: "home", homeId: ownerId };
  }
  if (ownerType === "business" && ownerId) {
    return { ownerType: "business", ownerId };
  }
  return { ownerType: "user" };
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<Search>;
}): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const result = await fetchPublicBooking(slug);
  const data = result.data as PublicBookingPage | null;
  const host = hostName(data?.page.title, "a Pantopus host");
  const name = sp.name?.trim() || "a session package";
  return {
    title: `Buy ${name} from ${host} | Pantopus`,
    description: "Prepay for a bundle of sessions and book any time.",
    robots: { index: false, follow: false },
  };
}

export default async function BuyPackagePage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<Search>;
}) {
  const [{ slug, packageId }, sp] = await Promise.all([params, searchParams]);

  if (!webFeatureFlags.schedulingPaid) {
    return (
      <UnavailableView
        title="Packages aren't available"
        message="This way of paying isn't enabled yet. Try booking directly instead."
      />
    );
  }

  const result = await fetchPublicBooking(slug);
  const data = result.data as PublicBookingPage | null;

  if (!data) {
    return (
      <UnavailableView
        title={
          result.status >= 500
            ? "Something went wrong"
            : "This link isn't available"
        }
        message="It may have been turned off or moved. Double-check the link with whoever sent it."
      />
    );
  }

  const page = data.page;
  const pillar = pillarForOwner(page.owner_type);
  const host = hostName(page.title);

  const name = sp.name?.trim();
  const priceCents = Number(sp.price_cents);
  if (!name || !Number.isFinite(priceCents) || priceCents < 0) {
    // No public single-package read — without the summary params we can't show
    // an honest order. Send them back to the host's page rather than guess.
    return (
      <UnavailableView
        title="This package isn't available"
        message={`Pick a package from ${host}'s page to get started.`}
        pillar={pillar}
      />
    );
  }

  const sessionsCount = intParam(sp.sessions, 1);
  const currency = (sp.currency || "USD").toUpperCase().slice(0, 3);
  const ownerType = sp.owner_type
    ? ownerTypeOf(sp.owner_type)
    : page.owner_type;
  const ownerRef = buildOwnerRef(ownerType, sp.owner_id);

  // Resolve eligibility from the public event-type list when the package is
  // scoped to one; otherwise it redeems against any booking.
  const eventType = sp.event_type_id
    ? (data.eventTypes ?? []).find((e) => e.id === sp.event_type_id)
    : null;
  const eligibleLabel = sp.event_type_id
    ? (eventType?.name ?? null)
    : "Any service from this host";

  const qs = new URLSearchParams(
    Object.entries(sp).filter(([, v]) => v != null) as [string, string][],
  ).toString();
  const returnPath = `/book/${encodeURIComponent(slug)}/packages/${encodeURIComponent(packageId)}${qs ? `?${qs}` : ""}`;

  return (
    <BuyPackage
      packageId={packageId}
      ownerRef={ownerRef}
      name={name}
      sessionsCount={sessionsCount}
      priceCents={Math.round(priceCents)}
      currency={currency}
      ownerName={host}
      ownerSubtitle={page.tagline ?? null}
      pillar={pillar}
      eligibleLabel={eligibleLabel}
      policy={page.cancellation_policy}
      returnPath={returnPath}
    />
  );
}
