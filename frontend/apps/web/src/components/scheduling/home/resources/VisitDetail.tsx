"use client";

// F14 — Visit detail. A scheduled household visit (a HomeCalendarEvent created
// by POST /visits). Header + status timeline + host members + entry note, with
// reschedule (partial PUT) and cancel (delete) for admins. The design's
// shareable-booking-link states (offered/reserved/active-link/expired/revoked)
// aren't backed by the visits endpoint and are intentionally omitted.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  CalendarClock,
  Check,
  CloudOff,
  Clock,
  KeyRound,
  Loader2,
  Repeat,
  RotateCw,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import type { HomeCalendarUnionEvent } from "@pantopus/types";
import { confirmStore } from "@/components/ui/confirm-store";
import { decodeError } from "@/components/scheduling/decodeError";
import {
  AvatarStack,
  deleteHomeEvent,
  getHomeEventDetail,
  isoToLocalInput,
  localInputToIso,
  resolveMembers,
  updateHomeEvent,
  type HomeMember,
} from "@/components/scheduling/home";
import {
  Banner,
  Card,
  Overline,
  PrimaryButton,
  SecondaryButton,
  Stepper,
  ValueRow,
} from "./primitives";

const STEPS = ["Offered", "Reserved", "Confirmed", "Done"];

function formatRange(startIso: string, endIso: string | null): string {
  const s = new Date(startIso);
  const day = s.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const t = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (!endIso) return `${day} · ${t(s)}`;
  return `${day} · ${t(s)}–${t(new Date(endIso))}`;
}

function StatusTimeline({ current }: { current: number }) {
  return (
    <Card>
      <Overline>Status</Overline>
      <div className="mt-3 flex items-start">
        {STEPS.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <div key={s} className="flex flex-1 items-start">
              <div className="flex w-12 shrink-0 flex-col items-center gap-1.5">
                <div
                  className={`flex h-[22px] w-[22px] items-center justify-center rounded-full ${
                    done || active
                      ? "bg-app-home text-white"
                      : "bg-app-surface-sunken text-app-text-muted"
                  } ${active ? "ring-2 ring-app-home ring-offset-2 ring-offset-app-surface" : ""}`}
                >
                  {done ? (
                    <Check className="h-3 w-3" strokeWidth={3} />
                  ) : (
                    <span className="text-[10px] font-bold">{i + 1}</span>
                  )}
                </div>
                <span
                  className={`text-center text-[9px] ${
                    active
                      ? "font-bold text-app-home"
                      : done
                        ? "font-medium text-app-text-secondary"
                        : "text-app-text-muted"
                  }`}
                >
                  {s}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`mt-2.5 h-0.5 flex-1 rounded ${i < current ? "bg-app-home" : "bg-app-border"}`}
                />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function VisitDetail({
  homeId,
  visitId,
  canEdit,
  membersById,
  onBack,
  onBookAgain,
}: {
  homeId: string;
  visitId: string;
  canEdit: boolean;
  membersById: Map<string, HomeMember>;
  onBack: () => void;
  onBookAgain: () => void;
}) {
  const [event, setEvent] = useState<HomeCalendarUnionEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [reschedOpen, setReschedOpen] = useState(false);
  const [startLocal, setStartLocal] = useState("");
  const [lengthHr, setLengthHr] = useState(1);
  const [savingResched, setSavingResched] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await getHomeEventDetail(homeId, visitId);
      setEvent(res.event);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [homeId, visitId]);

  useEffect(() => {
    void load();
  }, [load]);

  const isPast = useMemo(
    () => !!event?.end_at && new Date(event.end_at).getTime() < Date.now(),
    [event],
  );

  const openReschedule = () => {
    if (!event) return;
    setStartLocal(isoToLocalInput(event.start_at));
    if (event.end_at) {
      const ms =
        new Date(event.end_at).getTime() - new Date(event.start_at).getTime();
      setLengthHr(Math.max(1, Math.round(ms / 3_600_000)));
    } else {
      setLengthHr(1);
    }
    setActionError(null);
    setReschedOpen(true);
  };

  const saveReschedule = async () => {
    const startIso = localInputToIso(startLocal);
    if (!startIso) return;
    const endIso = new Date(
      new Date(startIso).getTime() + lengthHr * 3_600_000,
    ).toISOString();
    setSavingResched(true);
    setActionError(null);
    try {
      await updateHomeEvent(homeId, visitId, {
        start_at: startIso,
        end_at: endIso,
      });
      setReschedOpen(false);
      await load();
    } catch (err) {
      setActionError(decodeError(err).message);
    } finally {
      setSavingResched(false);
    }
  };

  const cancelVisit = async () => {
    if (!event) return;
    const ok = await confirmStore.open({
      title: "Cancel this visit?",
      description: "It will be removed from the household calendar.",
      confirmLabel: "Cancel visit",
      cancelLabel: "Keep",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await deleteHomeEvent(homeId, visitId);
      onBack();
    } catch (err) {
      setActionError(decodeError(err).message);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-2.5">
        <Card>
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-app-surface-sunken" />
            <div className="flex-1">
              <div className="h-3.5 w-1/2 animate-pulse rounded bg-app-surface-sunken" />
              <div className="mt-2 h-3.5 w-16 animate-pulse rounded-full bg-app-surface-sunken" />
            </div>
          </div>
          <div className="mt-3 h-8 animate-pulse rounded-lg bg-app-surface-sunken" />
        </Card>
        <Card>
          <div className="h-12 animate-pulse rounded bg-app-surface-sunken" />
        </Card>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex flex-col items-center justify-center px-7 py-16 text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-app-error-bg">
          <CloudOff className="h-7 w-7 text-app-error" />
        </div>
        <div className="text-[15.5px] font-bold text-app-text">
          Couldn&apos;t load this visit
        </div>
        <div className="mt-4 w-40">
          <PrimaryButton icon={RotateCw} onClick={() => void load()}>
            Retry
          </PrimaryButton>
        </div>
      </div>
    );
  }

  const isGuest = event.event_type === "guest";
  const TypeIcon = isGuest ? UserRound : Wrench;
  const typeLabel = isGuest ? "Guest" : "Vendor";
  const hosts = resolveMembers(event.assigned_to, membersById);
  const timeLabel = isPast
    ? `Done · ${new Date(event.start_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    : formatRange(event.start_at, event.end_at);

  return (
    <div className="flex flex-col gap-2.5 pb-24">
      {/* Header */}
      <Card className="flex flex-col gap-2.5">
        <div className="flex items-center gap-3">
          {/* Avatar: teal gradient — linear-gradient(135deg, #2dd4bf, #0d9488) */}
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white"
            style={{ background: "linear-gradient(135deg, #2dd4bf, #0d9488)" }}
          >
            {(event.title || "V").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[16px] font-bold tracking-tight text-app-text">
              {event.title}
            </div>
            {/* Type chip: teal-100 bg / teal-700 text — distinct from Home green */}
            <span
              className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ background: "#ccfbf1", color: "#0f766e" }}
            >
              <TypeIcon className="h-2.5 w-2.5" />
              {typeLabel}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-app-surface-sunken px-3 py-2">
          <Clock
            className={`h-3.5 w-3.5 ${isPast ? "text-app-text-secondary" : "text-app-home"}`}
          />
          <span
            className={`text-[12.5px] font-bold ${isPast ? "text-app-text-secondary" : "text-app-home"}`}
          >
            {timeLabel}
          </span>
        </div>
      </Card>

      {!isPast && (
        <Banner tone="home" icon={CalendarCheck} title="On the home calendar">
          This visit shows on the family schedule.
        </Banner>
      )}

      <StatusTimeline current={isPast ? 3 : 2} />

      {/* Hosts */}
      {hosts.length > 0 && (
        <Card>
          <Overline>Host members</Overline>
          <div className="mt-2 flex items-center gap-2.5">
            <AvatarStack members={hosts} size={30} />
            <span className="text-[12.5px] font-semibold text-app-text">
              {hosts.length === 1
                ? `${hosts[0].name} must be home`
                : `${hosts.map((h) => h.name).join(", ")} must be home`}
            </span>
          </div>
        </Card>
      )}

      {/* Access / entry note */}
      {event.location_notes && (
        <Card className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-app-surface-sunken text-app-text-secondary">
            <KeyRound className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-app-text-muted">
              Entry note
            </div>
            <div className="mt-0.5 text-[12.5px] font-semibold text-app-text">
              {event.location_notes}
            </div>
          </div>
        </Card>
      )}

      {/* Reschedule panel */}
      {reschedOpen && (
        <Card>
          <Overline>Reschedule</Overline>
          <div className="mt-2">
            <ValueRow label="Starts">
              <input
                type="datetime-local"
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
                className="rounded-lg bg-app-surface-sunken px-2.5 py-1.5 text-[12px] font-semibold text-app-text outline-none"
              />
            </ValueRow>
            <ValueRow label="Visit length" last>
              <Stepper
                value={lengthHr}
                onChange={setLengthHr}
                min={1}
                max={12}
                unit="hr"
              />
            </ValueRow>
          </div>
          {actionError && (
            <p className="mt-2 text-[11px] text-app-error">{actionError}</p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setReschedOpen(false)}
              className="h-9 flex-1 rounded-lg border border-app-border bg-app-surface text-[12.5px] font-bold text-app-text-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveReschedule}
              disabled={savingResched || !startLocal}
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-app-home text-[12.5px] font-bold text-white disabled:opacity-50"
            >
              {savingResched ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save new time"
              )}
            </button>
          </div>
        </Card>
      )}

      {!reschedOpen && actionError && (
        <p className="px-1 text-[11px] text-app-error">{actionError}</p>
      )}

      {/* Sticky footer */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-app-border bg-app-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-2.5 px-4 py-3">
          {isPast ? (
            <SecondaryButton icon={Repeat} onClick={onBookAgain}>
              Book again
            </SecondaryButton>
          ) : canEdit ? (
            <>
              <SecondaryButton icon={X} onClick={cancelVisit}>
                Cancel
              </SecondaryButton>
              <PrimaryButton icon={CalendarClock} onClick={openReschedule}>
                Reschedule
              </PrimaryButton>
            </>
          ) : (
            <PrimaryButton icon={CalendarClock} onClick={onBack}>
              Back to calendar
            </PrimaryButton>
          )}
        </div>
      </div>
    </div>
  );
}
