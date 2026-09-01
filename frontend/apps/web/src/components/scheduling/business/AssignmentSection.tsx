"use client";

// Assignment & rotation — the surface the W2 event editor links here for "Who
// can be booked". Lists the business's event types with their current
// assignment mode and opens the Round-Robin (G1) or Collective (G2) sheets to
// configure assignees. Keeps G1/G2 reachable + wired with real data without
// editing W2's frozen editor.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, Plus, Repeat, User, UsersRound } from "lucide-react";
import * as api from "@pantopus/api";
import type {
  AssignmentMode,
  EventType,
  EventTypeAssignee,
  SchedulingOwnerRef,
} from "@pantopus/types";
import { decodeError } from "@/components/scheduling/decodeError";
import { toast } from "@/components/ui/toast-store";
import ErrorState from "@/components/ui/ErrorState";
import { AccentOverline, Card, Chip, IconDisc, RuleTile, Skeleton } from "./ui";
import type { TeamMemberView } from "./members";
import RoundRobinSheet from "./RoundRobinSheet";
import CollectiveSetup from "./CollectiveSetup";

const MODE_LABEL: Record<AssignmentMode, string> = {
  one_on_one: "One-on-one",
  round_robin: "Round robin",
  collective: "Collective",
  group: "Group",
};

interface OpenSheet {
  kind: "round_robin" | "collective";
  eventType: EventType;
  assignees: EventTypeAssignee[];
}

export default function AssignmentSection({
  owner,
  roster,
}: {
  owner: SchedulingOwnerRef;
  roster: TeamMemberView[];
}) {
  const [eventTypes, setEventTypes] = useState<EventType[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [sheet, setSheet] = useState<OpenSheet | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { eventTypes: list } = await api.scheduling.listEventTypes(owner);
      setEventTypes(list);
    } catch (err) {
      setError(decodeError(err).message);
    } finally {
      setLoading(false);
    }
  }, [owner]);

  useEffect(() => {
    void load();
  }, [load]);

  const openConfigure = useCallback(
    async (et: EventType, kind: "round_robin" | "collective") => {
      setOpening(et.id);
      try {
        const detail = await api.scheduling.getEventType(et.id, owner);
        setSheet({
          kind,
          eventType: detail.eventType,
          assignees: detail.assignees,
        });
        setExpandedId(null);
      } catch (err) {
        toast.error(decodeError(err).message || "Couldn’t load assignment");
      } finally {
        setOpening(null);
      }
    },
    [owner],
  );

  const setOneOnOne = useCallback(
    async (et: EventType) => {
      setOpening(et.id);
      try {
        await api.scheduling.updateEventType(
          et.id,
          { assignment_mode: "one_on_one" },
          owner,
        );
        await api.scheduling.updateAssignees(et.id, [], owner);
        toast.success("Set to one-on-one");
        setExpandedId(null);
        void load();
      } catch (err) {
        toast.error(decodeError(err).message || "Couldn’t update assignment");
      } finally {
        setOpening(null);
      }
    },
    [owner, load],
  );

  return (
    <section>
      <AccentOverline className="pb-2 pt-4">Assignment</AccentOverline>

      {loading ? (
        <Card>
          {[0, 1].map((i) => (
            <div
              key={i}
              className={
                "flex items-center gap-3 px-4 py-3" +
                (i === 1 ? "" : " border-b border-app-border")
              }
            >
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-3 w-2/5" />
                <Skeleton className="mt-1.5 h-2 w-1/4" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </Card>
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : !eventTypes || eventTypes.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-app-business-bg text-app-business">
              <CalendarClock className="h-5 w-5" aria-hidden />
            </span>
            <p className="text-sm font-semibold text-app-text">
              No services yet
            </p>
            <p className="max-w-xs text-xs text-app-text-secondary">
              Create an event type, then choose how bookings are assigned across
              your team.
            </p>
            <Link
              href="/app/scheduling/event-types"
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-app-business-bg px-3 py-1.5 text-xs font-bold text-app-business"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden /> New event type
            </Link>
          </div>
        </Card>
      ) : (
        <Card>
          {eventTypes.map((et, i) => {
            const expanded = expandedId === et.id;
            const isTeam =
              et.assignment_mode === "round_robin" ||
              et.assignment_mode === "collective";
            return (
              <div
                key={et.id}
                className={
                  i === eventTypes.length - 1
                    ? ""
                    : "border-b border-app-border"
                }
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : et.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-app-hover"
                  aria-expanded={expanded}
                >
                  <IconDisc
                    icon={
                      et.assignment_mode === "collective"
                        ? UsersRound
                        : et.assignment_mode === "round_robin"
                          ? Repeat
                          : User
                    }
                    tone={isTeam ? "business" : "neutral"}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-app-text">
                      {et.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-app-text-secondary">
                      {et.default_duration} min
                    </p>
                  </div>
                  <Chip tone={isTeam ? "business" : "neutral"}>
                    {MODE_LABEL[et.assignment_mode] ?? "One-on-one"}
                  </Chip>
                </button>

                {expanded && (
                  <div className="space-y-2 border-t border-app-border bg-app-surface-muted px-3 py-3">
                    <RuleTile
                      icon={User}
                      name="One-on-one"
                      desc="A single host takes the booking"
                      selected={et.assignment_mode === "one_on_one"}
                      radio={false}
                      onClick={() => void setOneOnOne(et)}
                    />
                    <RuleTile
                      icon={Repeat}
                      name="Round robin"
                      desc="Rotate bookings across members"
                      selected={et.assignment_mode === "round_robin"}
                      radio={false}
                      onClick={() => void openConfigure(et, "round_robin")}
                    />
                    <RuleTile
                      icon={UsersRound}
                      name="Collective"
                      desc="Several members must all be free"
                      selected={et.assignment_mode === "collective"}
                      radio={false}
                      onClick={() => void openConfigure(et, "collective")}
                    />
                    {opening === et.id && (
                      <p className="px-1 text-[11px] text-app-text-muted">
                        Loading…
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}

      {sheet?.kind === "round_robin" && (
        <RoundRobinSheet
          open
          onClose={() => setSheet(null)}
          owner={owner}
          eventTypeId={sheet.eventType.id}
          eventTypeName={sheet.eventType.name}
          roster={roster}
          initialAssignees={sheet.assignees}
          onSaved={() => {
            setSheet(null);
            void load();
          }}
        />
      )}
      {sheet?.kind === "collective" && (
        <CollectiveSetup
          open
          onClose={() => setSheet(null)}
          owner={owner}
          eventTypeId={sheet.eventType.id}
          eventTypeName={sheet.eventType.name}
          roster={roster}
          initialAssignees={sheet.assignees}
          initialSeatCap={sheet.eventType.seat_cap}
          onSaved={() => {
            setSheet(null);
            void load();
          }}
        />
      )}
    </section>
  );
}
