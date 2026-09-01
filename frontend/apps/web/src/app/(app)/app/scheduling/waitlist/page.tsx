"use client";

// W9 · E13 — Waitlist (host). Pick an event type to see who's waiting
// (GET /event-types/:id/waitlist) and promote anyone (POST /waitlist/:id/promote,
// which notifies them a seat opened). A "Preview invitee view" button shows the
// exact join sheet invitees get when an event type is full.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, Plus, Users } from "lucide-react";
import * as api from "@pantopus/api";
import type { EventType, WaitlistEntry } from "@pantopus/types";
import { ShimmerBlock } from "@/components/ui/Shimmer";
import ErrorState from "@/components/ui/ErrorState";
import { toast } from "@/components/ui/toast-store";
import { confirmStore } from "@/components/ui/confirm-store";
import { ownerFromQuery } from "@/components/scheduling/bookings/owners";
import { pillarForOwner } from "@/components/scheduling/pillarTokens";
import { decodeError } from "@/components/scheduling/decodeError";
import WaitlistManager, {
  type WaitlistCapacity,
} from "@/components/scheduling/bookings-extras/WaitlistManager";
import WaitlistJoinSheet from "@/components/scheduling/bookings-extras/WaitlistJoinSheet";
import {
  FilterChip,
  PillarBadge,
} from "@/components/scheduling/bookings-extras/ui";

const NEW_EVENT_TYPE = "/app/scheduling/event-types/new";

export default function WaitlistPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Honor owner context from the URL (?ot=&oid=); defaults to personal.
  const ownerType = searchParams?.get("ot") ?? null;
  const ownerId = searchParams?.get("oid") ?? null;
  const owner = useMemo(
    () =>
      ownerFromQuery((k) =>
        k === "ot" ? ownerType : k === "oid" ? ownerId : null,
      ),
    [ownerType, ownerId],
  );
  const pillar = pillarForOwner(owner.ownerType);

  const [phase, setPhase] = useState<"loading" | "error" | "ready">("loading");
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [wlPhase, setWlPhase] = useState<"loading" | "error" | "ready">(
    "loading",
  );
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const loadEventTypes = useCallback(() => {
    let alive = true;
    setPhase("loading");
    api.scheduling
      .listEventTypes(owner)
      .then((res) => {
        if (!alive) return;
        const ets = (res.eventTypes ?? []).filter((e) => e.is_active);
        setEventTypes(ets);
        setSelectedId((prev) => prev ?? ets[0]?.id ?? null);
        setPhase("ready");
      })
      .catch(() => {
        if (alive) setPhase("error");
      });
    return () => {
      alive = false;
    };
  }, [owner]);

  useEffect(() => loadEventTypes(), [loadEventTypes]);

  const loadWaitlist = useCallback(
    (etId: string) => {
      let alive = true;
      setWlPhase("loading");
      api.scheduling
        .getEventTypeWaitlist(etId, owner)
        .then((res) => {
          if (!alive) return;
          setWaitlist(res.waitlist ?? []);
          setWlPhase("ready");
        })
        .catch(() => {
          if (alive) setWlPhase("error");
        });
      return () => {
        alive = false;
      };
    },
    [owner],
  );

  useEffect(() => {
    if (selectedId) return loadWaitlist(selectedId);
  }, [selectedId, loadWaitlist]);

  const selected = eventTypes.find((e) => e.id === selectedId) ?? null;

  // Derive capacity for the WaitlistManager header card.
  const waitingCount = waitlist.filter((w) => w.status === "waiting").length;
  const seatCap = selected?.seat_cap ?? 0;
  // Filled = all waitlist entries that are NOT in "waiting" status (promoted/confirmed).
  // Without a booking count in scope, use seat_cap - waiting as an approximation.
  const filledCount = Math.max(0, seatCap - waitingCount);
  const wlCapacity: WaitlistCapacity | null =
    seatCap > 0
      ? {
          filled: filledCount,
          total: seatCap,
          pct: seatCap > 0 ? Math.min(100, Math.round((filledCount / seatCap) * 100)) : 0,
          full: filledCount >= seatCap,
          waiting: waitingCount,
        }
      : null;

  const promote = async (entry: WaitlistEntry) => {
    const ok = await confirmStore.open({
      title: `Promote ${entry.invitee_name ?? "this person"}?`,
      description:
        "We’ll notify them that a seat opened so they can confirm their spot.",
      confirmLabel: "Promote",
      cancelLabel: "Cancel",
    });
    if (!ok) return;
    setPromotingId(entry.id);
    try {
      await api.scheduling.promoteWaitlist(entry.id, owner);
      toast.success("Promoted — we let them know.");
      setWaitlist((list) =>
        list.map((w) => (w.id === entry.id ? { ...w, status: "promoted" } : w)),
      );
    } catch (err) {
      toast.error(decodeError(err).message);
    } finally {
      setPromotingId(null);
    }
  };

  return (
    <div>
      <header className="mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2">
              <PillarBadge pillar={pillar} />
            </div>
            <h1 className="text-xl font-bold text-app-text">Waitlist</h1>
            <p className="mt-0.5 text-sm text-app-text-secondary">
              People waiting for a spot. Promote anyone when a seat opens.
            </p>
          </div>
          {selected && (
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-app-border bg-app-surface px-3.5 py-2 text-sm font-semibold text-app-text transition hover:bg-app-hover"
            >
              <Eye className="h-4 w-4" aria-hidden />
              Preview invitee view
            </button>
          )}
        </div>
      </header>

      {phase === "loading" && (
        <div className="flex flex-col gap-3">
          <ShimmerBlock className="h-9 w-full rounded-full" />
          {[0, 1, 2].map((i) => (
            <ShimmerBlock key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      )}

      {phase === "error" && (
        <ErrorState
          message="We couldn't load your event types."
          onRetry={loadEventTypes}
        />
      )}

      {phase === "ready" && eventTypes.length === 0 && (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 text-primary-600">
            <Users className="h-7 w-7" strokeWidth={1.7} aria-hidden />
          </span>
          <h2 className="mb-1.5 text-base font-semibold text-app-text">
            No event types yet
          </h2>
          <p className="mb-5 max-w-xs text-sm text-app-text-secondary">
            Create an event type with limited seats so people can join a
            waitlist when it’s full.
          </p>
          <button
            type="button"
            onClick={() => router.push(NEW_EVENT_TYPE)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New event type
          </button>
        </div>
      )}

      {phase === "ready" && eventTypes.length > 0 && (
        <>
          {/* Event-type picker */}
          <div className="mb-5 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {eventTypes.map((et) => (
              <FilterChip
                key={et.id}
                label={et.name}
                active={selectedId === et.id}
                onClick={() => setSelectedId(et.id)}
              />
            ))}
          </div>

          {wlPhase === "loading" && (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <ShimmerBlock key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          )}

          {wlPhase === "error" && selectedId && (
            <ErrorState
              message="We couldn't load this waitlist."
              onRetry={() => loadWaitlist(selectedId)}
            />
          )}

          {wlPhase === "ready" && selected && (
            <WaitlistManager
              pillar={pillar}
              eventTypeName={selected.name}
              waitlist={waitlist}
              promotingId={promotingId}
              onPromote={promote}
              capacity={wlCapacity}
            />
          )}
        </>
      )}

      <WaitlistJoinSheet
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        eventTypeName={selected?.name}
        pillar={pillar}
        preview
      />
    </div>
  );
}
