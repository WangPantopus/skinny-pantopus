"use client";

// W9 · E8 — Group Event Roster & Seats. Loads the booking + its event type
// (for the seat cap) + the event-type waitlist, derives capacity, and renders
// the roster: seated attendees, the promotable waitlist, "Message all" (E11
// group nudge), and a seat-cap stepper. 1:1 bookings (seat cap ≤ 1) get a calm
// "not a group event" state rather than an empty roster.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarDays, CloudOff, RotateCw } from "lucide-react";
import * as api from "@pantopus/api";
import type {
  BookingAttendee,
  BookingDetail,
  EventType,
  WaitlistEntry,
} from "@pantopus/types";
import { ShimmerBlock } from "@/components/ui/Shimmer";
import { toast } from "@/components/ui/toast-store";
import {
  ownerFromQuery,
  ownerQueryString,
} from "@/components/scheduling/bookings/owners";
import { pillarForOwner } from "@/components/scheduling/pillarTokens";
import { decodeError } from "@/components/scheduling/decodeError";
import RosterSeats from "@/components/scheduling/bookings-extras/RosterSeats";
import NudgeSheet from "@/components/scheduling/bookings-extras/NudgeSheet";
import { PillarBadge } from "@/components/scheduling/bookings-extras/ui";
import { computeCapacity } from "@/components/scheduling/bookings-extras/roster";
import { fmtDateTime } from "@/components/scheduling/bookings-extras/format";

const SEARCH_PATH = "/app/scheduling/bookings/search";

export default function RosterPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params?.id;
  // Owner context is carried from the inbox/search row via ?ot=&oid= so a
  // home/business group booking loads under the right owner (not personal).
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
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [eventType, setEventType] = useState<EventType | null>(null);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [nudgeOpen, setNudgeOpen] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    let alive = true;
    setPhase("loading");
    api.scheduling
      .getBooking(id, owner)
      .then(async (d) => {
        if (!alive) return;
        setDetail(d);
        const etId = d.booking.event_type_id;
        if (etId) {
          const [etDetail, wl] = await Promise.all([
            api.scheduling.getEventType(etId, owner).catch(() => null),
            api.scheduling
              .getEventTypeWaitlist(etId, owner)
              .catch(() => ({ waitlist: [] as WaitlistEntry[] })),
          ]);
          if (!alive) return;
          setEventType(etDetail?.eventType ?? null);
          setWaitlist(wl.waitlist ?? []);
        } else {
          setEventType(null);
          setWaitlist([]);
        }
        setPhase("ready");
      })
      .catch(() => {
        if (alive) setPhase("error");
      });
    return () => {
      alive = false;
    };
  }, [id, owner]);

  useEffect(() => load(), [load]);

  const promote = async (entry: WaitlistEntry) => {
    setPromotingId(entry.id);
    try {
      await api.scheduling.promoteWaitlist(entry.id, owner);
      toast.success(
        `${entry.invitee_name ?? "They"}’re promoted — we let them know a seat opened.`,
      );
      setWaitlist((list) => list.filter((w) => w.id !== entry.id));
    } catch (err) {
      toast.error(decodeError(err).message);
    } finally {
      setPromotingId(null);
    }
  };

  const adjustCapacity = async (next: number) => {
    if (!eventType) return;
    const prev = eventType.seat_cap;
    setEventType({ ...eventType, seat_cap: next });
    try {
      await api.scheduling.updateEventType(
        eventType.id,
        { seat_cap: next },
        owner,
      );
      toast.success("Capacity updated.");
    } catch (err) {
      setEventType((et) => (et ? { ...et, seat_cap: prev } : et));
      toast.error(decodeError(err).message);
    }
  };

  const seatCap = eventType?.seat_cap ?? 1;
  const attendees: BookingAttendee[] = detail?.attendees ?? [];
  const waiting = waitlist.filter((w) => w.status === "waiting");
  const capacity = computeCapacity(attendees, seatCap, waiting.length);
  const isGroup = seatCap > 1;
  const title = detail?.eventType?.name ?? "Booking";

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
        <h1 className="text-xl font-bold text-app-text">Roster</h1>
        {detail && (
          <p className="mt-0.5 text-sm text-app-text-secondary">
            {title} ·{" "}
            {fmtDateTime(
              detail.booking.start_at,
              detail.booking.invitee_timezone,
            )}
          </p>
        )}
      </header>

      {phase === "loading" && (
        <div className="flex flex-col gap-3">
          <ShimmerBlock className="h-28 rounded-2xl" />
          <ShimmerBlock className="h-10 w-40 rounded-lg" />
          {[0, 1, 2].map((i) => (
            <ShimmerBlock key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      )}

      {phase === "error" && (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-app-error-bg text-app-error">
            <CloudOff className="h-8 w-8" strokeWidth={1.8} aria-hidden />
          </span>
          <div>
            <h3 className="text-base font-bold text-app-text">
              Couldn&apos;t load the roster
            </h3>
            <p className="mt-1.5 max-w-xs text-sm text-app-text-secondary">
              Check your connection and try again.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-xl border border-app-border bg-app-surface px-4 py-2.5 text-sm font-semibold text-app-text transition hover:bg-app-hover"
          >
            <RotateCw className="h-4 w-4" aria-hidden />
            Try again
          </button>
        </div>
      )}

      {phase === "ready" && !isGroup && (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-app-surface-sunken text-app-text-muted">
            <CalendarDays className="h-7 w-7" strokeWidth={1.7} aria-hidden />
          </span>
          <h2 className="mb-1.5 text-base font-semibold text-app-text">
            This isn’t a group event
          </h2>
          <p className="mb-5 max-w-xs text-sm text-app-text-secondary">
            Rosters and seats apply to events with more than one seat. This is a
            one-on-one booking.
          </p>
          <button
            type="button"
            onClick={() => router.push(backToBookings)}
            className="rounded-lg border border-app-border bg-app-surface px-4 py-2 text-sm font-semibold text-primary-700 transition hover:bg-app-hover"
          >
            Back to bookings
          </button>
        </div>
      )}

      {phase === "ready" && isGroup && detail && (
        <RosterSeats
          pillar={pillar}
          capacity={capacity}
          attendees={attendees}
          waitlist={waiting}
          promotingId={promotingId}
          onPromote={promote}
          onMessageAll={() => setNudgeOpen(true)}
          onAdjustCapacity={adjustCapacity}
          onAddAttendee={() => {
            // Navigate to the manual booking wizard pre-scoped to this event type.
            // The manual booking wizard (E12) handles the full invite flow.
            router.push(
              `/app/scheduling/manual?et=${detail.booking.event_type_id ?? ""}&${
                ownerQueryString(owner).replace(/^\?/, "")
              }`,
            );
          }}
        />
      )}

      {detail && (
        <NudgeSheet
          open={nudgeOpen}
          onClose={() => setNudgeOpen(false)}
          booking={{
            id: detail.booking.id,
            title,
            subtitle: `${title} · ${attendees.length} attendees`,
            inviteeName: detail.booking.invitee_name,
            attendees,
          }}
          owner={owner}
        />
      )}
    </div>
  );
}
