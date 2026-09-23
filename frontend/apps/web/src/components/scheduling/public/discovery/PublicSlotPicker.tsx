"use client";

// C6 — Date + time slot picker for a chosen event type. Wraps the W0 SlotPicker
// (which owns the calendar, the timezone chip → C7 TimezoneSelector sheet, the
// per-month loading / no-availability / fully-booked states — C8) and adds the
// event-type summary header. Slots are fetched client-side (no-store) by the W0
// picker. tz defaults to the browser zone, is user-overridable, and is threaded
// into the slot reads + the handoff. Picking a slot STOPS here and hands off to
// W6 via the [eventType]/confirm route (carrying the chosen start/end/tz).
// A month with no open times offers "Get notified when times open", which
// opens the E13 waitlist sheet and joins the event type's waitlist.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import type { BookingSlot, PublicEventType } from "@pantopus/types";
import { hasActiveSession, publicBooking, users } from "@pantopus/api";
import { buildBookingEventPath } from "@pantopus/utils";
import {
  SlotPicker,
  detectTimezone,
  pillarTokens,
  type Pillar,
} from "@/components/scheduling";
import WaitlistJoinSheet from "@/components/scheduling/bookings-extras/WaitlistJoinSheet";
import { durationLabel, locationIcon } from "./discoveryUtils";

interface PublicSlotPickerProps {
  slug: string;
  eventTypeSlug: string;
  eventType: PublicEventType;
  hostName: string;
  pillar: Pillar;
}

export default function PublicSlotPicker({
  slug,
  eventTypeSlug,
  eventType,
  hostName,
  pillar,
}: PublicSlotPickerProps) {
  const router = useRouter();
  const tk = pillarTokens(pillar);
  const [tz, setTz] = useState<string>(() => detectTimezone());
  const [picked, setPicked] = useState<string | null>(null);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [viewer, setViewer] = useState<{ email?: string; name?: string } | null>(
    null,
  );
  const LocationIcon = locationIcon(eventType.location_mode);
  const dur = durationLabel(eventType.default_duration);

  // A signed-in visitor gets their email filled in. The join links the entry
  // to their account when the emails match (trimmed, case-insensitive), so a
  // promotion reaches them in the app; everyone else is emailed.
  useEffect(() => {
    if (!waitlistOpen || viewer || !hasActiveSession()) return;
    let alive = true;
    users
      .getMyProfile()
      .then((me) => {
        if (!alive) return;
        setViewer({
          email: me.email || undefined,
          name: me.name?.trim() || undefined,
        });
      })
      .catch(() => {
        // Signed out after all, or the profile didn't load: the visitor types
        // their email.
      });
    return () => {
      alive = false;
    };
  }, [waitlistOpen, viewer]);

  const joinWaitlist = async ({
    email,
    name,
  }: {
    email: string;
    name: string;
  }) => {
    await publicBooking.joinWaitlistPublic(slug, eventTypeSlug, {
      email,
      name: name || null,
    });
    const same = (a: string) => a.trim().toLowerCase();
    const linked = !!viewer?.email && same(viewer.email) === same(email);
    return { notifyVia: linked ? ("app" as const) : ("email" as const) };
  };

  const handlePick = (slot: BookingSlot) => {
    setPicked(slot.start);
    // Hand off to W6 (confirm). The route 404s until W6 merges — expected
    // during parallel build.
    const params = new URLSearchParams({
      start: slot.start,
      end: slot.end,
      tz,
      duration: String(eventType.default_duration),
    });
    router.push(
      `${buildBookingEventPath(slug, eventTypeSlug)}/confirm?${params.toString()}`,
    );
  };

  return (
    <div className="space-y-3">
      {/* Event-type summary */}
      <div className="flex items-center gap-3 rounded-2xl border border-app-border bg-app-surface px-3 py-3 shadow-sm">
        <span
          className={clsx(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            tk.bgSoft,
            tk.text,
          )}
        >
          <LocationIcon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-app-text">
            {eventType.name}
          </p>
          <p className="mt-0.5 text-xs text-app-text-secondary">
            {[dur, `with ${hostName}`].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      <SlotPicker
        slug={slug}
        eventTypeSlug={eventTypeSlug}
        pillar={pillar}
        tz={tz}
        onTzChange={setTz}
        onPick={handlePick}
        selected={picked}
        onNotifyMe={() => setWaitlistOpen(true)}
      />

      <WaitlistJoinSheet
        open={waitlistOpen}
        onClose={() => setWaitlistOpen(false)}
        hostName={hostName}
        eventTypeName={eventType.name}
        pillar={pillar}
        defaultEmail={viewer?.email}
        defaultName={viewer?.name}
        onJoin={joinWaitlist}
      />
    </div>
  );
}
