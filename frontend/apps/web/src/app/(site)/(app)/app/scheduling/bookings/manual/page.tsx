"use client";

// W9 · E12 — Manual / On-Behalf Booking. Loads the host's event types + booking
// page slug (the slug feeds the wizard's live availability), then hands off to
// the ManualBooking wizard. A 409 on create surfaces the Double-Book warning
// (E10) inside the wizard.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import * as api from "@pantopus/api";
import type { EventType } from "@pantopus/types";
import { ShimmerBlock } from "@/components/ui/Shimmer";
import ErrorState from "@/components/ui/ErrorState";
import {
  ownerFromQuery,
  ownerQueryString,
} from "@/components/scheduling/bookings/owners";
import { pillarForOwner } from "@/components/scheduling/pillarTokens";
import ManualBooking from "@/components/scheduling/bookings-extras/ManualBooking";
import { PillarBadge } from "@/components/scheduling/bookings-extras/ui";

const SEARCH_PATH = "/app/scheduling/bookings/search";

export default function ManualBookingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Owner context arrives via ?ot=&oid= (threaded from the inbox / search).
  const ownerType = searchParams?.get("ot") ?? null;
  const ownerId = searchParams?.get("oid") ?? null;
  const owner = useMemo(
    () =>
      ownerFromQuery((k) =>
        k === "ot" ? ownerType : k === "oid" ? ownerId : null,
      ),
    [ownerType, ownerId],
  );
  const backToBookings = `${SEARCH_PATH}${ownerQueryString(owner)}`;
  const pillar = pillarForOwner(owner.ownerType);

  const [phase, setPhase] = useState<"loading" | "error" | "ready">("loading");
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [pageSlug, setPageSlug] = useState<string | null>(null);

  const load = useCallback(() => {
    let alive = true;
    setPhase("loading");
    Promise.all([
      api.scheduling.listEventTypes(owner),
      api.scheduling.getBookingPage(owner).catch(() => null),
    ])
      .then(([ets, page]) => {
        if (!alive) return;
        setEventTypes((ets.eventTypes ?? []).filter((e) => e.is_active));
        setPageSlug(page?.page?.slug ?? null);
        setPhase("ready");
      })
      .catch(() => {
        if (alive) setPhase("error");
      });
    return () => {
      alive = false;
    };
  }, [owner]);

  useEffect(() => load(), [load]);

  return (
    <div>
      <header className="mb-5">
        <button
          type="button"
          onClick={() => router.push(backToBookings)}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-app-text-secondary transition hover:text-app-text"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Bookings
        </button>
        <div className="mb-2">
          <PillarBadge pillar={pillar} />
        </div>
        <h1 className="text-xl font-bold text-app-text">Book someone in</h1>
        <p className="mt-0.5 text-sm text-app-text-secondary">
          Add a booking on someone’s behalf — they’ll get the confirmation.
        </p>
      </header>

      {phase === "loading" && (
        <div className="flex flex-col gap-3">
          <ShimmerBlock className="h-8 w-48 rounded-lg" />
          {[0, 1, 2].map((i) => (
            <ShimmerBlock key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      )}

      {phase === "error" && (
        <ErrorState
          message="We couldn't load your event types."
          onRetry={load}
        />
      )}

      {phase === "ready" && (
        <ManualBooking
          owner={owner}
          pillar={pillar}
          pageSlug={pageSlug}
          eventTypes={eventTypes}
          onBackToBookings={() => router.push(backToBookings)}
        />
      )}
    </div>
  );
}
