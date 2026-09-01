// C5 — "Book a time" event-type list. Each row links to the slot picker
// (C6) at /book/:slug/:eventTypeSlug. Presentational + server-safe (no hooks):
// renders inside the server landing page. Single-type pages show a calm
// "going straight to pick a time" note. Reuses the shared design tokens.

import Link from "next/link";
import { ChevronRight, Clock, ArrowRightCircle } from "lucide-react";
import type { PublicEventType } from "@pantopus/types";
import { buildBookingEventPath } from "@pantopus/utils";
import type { Pillar } from "@/components/scheduling";
import { durationLabel, locationIcon, locationLabel } from "./discoveryUtils";

function EventTypeRow({
  slug,
  eventType,
}: {
  slug: string;
  eventType: PublicEventType;
}) {
  const LocationIcon = locationIcon(eventType.location_mode);
  const dur = durationLabel(eventType.default_duration);
  return (
    <Link
      href={buildBookingEventPath(slug, eventType.slug)}
      className="flex items-center gap-3 rounded-2xl border border-app-border bg-app-surface px-3 py-3 shadow-sm transition-colors hover:bg-app-hover"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-app-surface-sunken text-app-text-secondary">
        <LocationIcon className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-app-text">
          {eventType.name}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-2">
          {dur && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-app-text-secondary">
              <Clock className="h-3 w-3" aria-hidden />
              {dur}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-app-info-bg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-app-info">
            <LocationIcon className="h-2.5 w-2.5" aria-hidden />
            {locationLabel(eventType.location_mode, eventType.location_detail)}
          </span>
        </span>
      </span>
      <ChevronRight
        className="h-[18px] w-[18px] shrink-0 text-app-text-muted"
        aria-hidden
      />
    </Link>
  );
}

export default function EventTypeMenu({
  slug,
  eventTypes,
}: {
  slug: string;
  eventTypes: PublicEventType[];
  pillar: Pillar;
}) {
  const single = eventTypes.length === 1;
  return (
    <section className="flex flex-col gap-2.5 px-4 pt-4">
      <p className="px-0.5 text-[10px] font-bold uppercase tracking-wider text-app-text-secondary">
        Book a time
      </p>
      {eventTypes.map((et) => (
        <EventTypeRow key={et.id} slug={slug} eventType={et} />
      ))}
      {single && (
        <div className="flex items-center gap-2 rounded-xl border border-app-info-light bg-app-info-bg px-3 py-2.5">
          <ArrowRightCircle
            className="h-3.5 w-3.5 shrink-0 text-app-info"
            aria-hidden
          />
          <span className="text-xs font-semibold text-app-info">
            Going straight to pick a time.
          </span>
        </div>
      )}
    </section>
  );
}
