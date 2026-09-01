"use client";

// W8 · E4 — Reschedule / Reassign sheet (local). Wraps the W0 SlotPicker with a
// host slot fetch (bookings/:id/available-slots, tz-aware, excludes this
// booking). Honors the wiring contract: tz on reads, render startLocal, 409
// SLOT_CONFLICT → SlotConflictAlternatives (never a dead end). The authority
// toggle chooses "Reschedule now" vs "Propose to invitee". Reassign (member
// picker) is business/home only; an invalid assignee returns INVALID_HOST.

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  Bell,
  Calendar,
  CalendarCheck,
  CalendarClock,
  Send,
  Users,
} from "lucide-react";
import clsx from "clsx";
import * as api from "@pantopus/api";
import type {
  Booking,
  BookingSlot,
  SchedulingOwnerRef,
  SlotConflict,
} from "@pantopus/types";
import BottomSheet from "@/components/ui/BottomSheet";
import SlotPicker from "@/components/scheduling/SlotPicker";
import SlotConflictAlternatives from "@/components/scheduling/SlotConflictAlternatives";
import { decodeError } from "@/components/scheduling/decodeError";
import {
  pillarTokens,
  type Pillar,
} from "@/components/scheduling/pillarTokens";
import { toast } from "@/components/ui/toast-store";
import { canReassign } from "./owners";
import { formatRange, initials, viewerTz } from "./format";

interface Member {
  id: string;
  name: string;
}

export default function RescheduleReassignSheet({
  open,
  onClose,
  booking,
  owner,
  pillar = "personal",
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  booking: Booking;
  owner: SchedulingOwnerRef;
  pillar?: Pillar;
  onDone: () => void;
}) {
  const tk = pillarTokens(pillar);
  const reassignable = canReassign(owner);

  const [tz, setTz] = useState<string>(viewerTz);
  const [selected, setSelected] = useState<BookingSlot | null>(null);
  const [authority, setAuthority] = useState<"now" | "propose">("now");
  const [members, setMembers] = useState<Member[]>([]);
  const [host, setHost] = useState<string | null>(booking.host_user_id ?? null);
  const [conflict, setConflict] = useState<SlotConflict | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposed, setProposed] = useState(false);
  const [notifyInvitee, setNotifyInvitee] = useState(true);

  useEffect(() => {
    if (!open) return;
    setTz(viewerTz());
    setSelected(null);
    setAuthority("now");
    setConflict(null);
    setError(null);
    setProposed(false);
    setSubmitting(false);
    setNotifyInvitee(true);
    setHost(booking.host_user_id ?? null);
    if (!reassignable) {
      setMembers([]);
      return;
    }
    let alive = true;
    // Best-effort names for the reassign picker. The team-insights payload
    // carries host ids only (no names), so the business members endpoint is
    // the names source; reassign still works by id if this is empty.
    const load = async (): Promise<Member[]> => {
      if (owner.ownerType === "business" && owner.ownerId) {
        const res = await api.businessIam.getTeamMembers(owner.ownerId);
        return (res.members ?? []).map((m) => ({
          id: m.user.id,
          name: m.user.name || m.user.username,
        }));
      }
      return [];
    };
    load()
      .then((list) => {
        if (alive) setMembers(list);
      })
      .catch(() => {
        if (alive) setMembers([]);
      });
    return () => {
      alive = false;
    };
  }, [open, owner, reassignable, booking.id, booking.host_user_id]);

  const fetchSlots = useCallback(
    async (range: { from: string; to: string; tz: string }) => {
      const res = await api.scheduling.getBookingAvailableSlots(
        booking.id,
        { from: range.from, to: range.to, tz: range.tz },
        owner,
      );
      return res.slots ?? [];
    },
    [booking.id, owner],
  );

  const hostChanged = !!host && host !== (booking.host_user_id ?? null);
  const canSubmit = !!selected || hostChanged;

  // Show the current assignee in the picker even if insights didn't return it.
  const memberList: Member[] = (() => {
    const list = [...members];
    if (
      booking.host_user_id &&
      !list.some((m) => m.id === booking.host_user_id)
    ) {
      list.unshift({ id: booking.host_user_id, name: "Current" });
    }
    return list;
  })();

  const ctaLabel = selected
    ? authority === "propose"
      ? "Send proposal"
      : "Reschedule now"
    : "Reassign";
  const ctaIcon = selected
    ? authority === "propose"
      ? Send
      : CalendarCheck
    : Users;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setConflict(null);
    const hostArg = hostChanged ? host! : undefined;
    try {
      if (selected && authority === "propose") {
        await api.scheduling.proposeReschedule(
          booking.id,
          { start_at: selected.start, host_user_id: hostArg },
          owner,
        );
        setProposed(true);
        setSubmitting(false);
        return;
      }
      if (selected) {
        await api.scheduling.rescheduleBooking(
          booking.id,
          { start_at: selected.start, host_user_id: hostArg },
          owner,
        );
        toast.success("Booking rescheduled.");
      } else {
        await api.scheduling.reassignBooking(
          booking.id,
          { host_user_id: host! },
          owner,
        );
        toast.success("Booking reassigned.");
      }
      onDone();
      onClose();
    } catch (err) {
      const d = decodeError(err);
      if (d.kind === "conflict") setConflict(d.conflict);
      else setError(d.message);
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => !submitting && onClose()}
      title={reassignable ? "Reschedule & reassign" : "Pick a new time"}
    >
      {proposed ? (
        <div className="flex flex-col items-center gap-4 px-6 py-8 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full border border-app-success-light bg-app-success-bg text-app-success">
            <Send className="h-7 w-7" aria-hidden />
          </span>
          <div>
            <h3 className="text-base font-bold text-app-text">Proposal sent</h3>
            <p className="mt-1.5 max-w-xs text-sm text-app-text-secondary">
              {inviteeFirst(booking.invitee_name)} will get a message to accept
              the new time.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onDone();
              onClose();
            }}
            className="h-11 w-full rounded-xl border border-app-border text-sm font-bold text-app-text transition hover:bg-app-hover"
          >
            Done
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Current → new */}
          <div>
            <div className="flex items-center gap-2.5 rounded-xl bg-app-surface-sunken px-3 py-2.5">
              <Calendar className="h-4 w-4 text-app-text-muted" aria-hidden />
              <span className="text-[13px] text-app-text-muted line-through">
                {formatRange(booking.start_at, booking.end_at, tz)}
              </span>
            </div>
            <div className="flex justify-center py-1">
              <ArrowDown className="h-4 w-4 text-app-text-muted" aria-hidden />
            </div>
            <div
              className={clsx(
                "flex items-center gap-2.5 rounded-xl border px-3 py-2.5",
                selected
                  ? clsx(tk.border, tk.bgSoft)
                  : "border-dashed border-app-border-strong bg-app-surface",
              )}
            >
              <CalendarClock
                className={clsx(
                  "h-4 w-4",
                  selected ? tk.text : "text-app-text-muted",
                )}
                aria-hidden
              />
              <span
                className={clsx(
                  "text-[13px]",
                  selected ? "font-bold text-app-text" : "text-app-text-muted",
                )}
              >
                {selected
                  ? formatRange(selected.start, selected.end, tz)
                  : "Pick a new time"}
              </span>
            </div>
          </div>

          {/* Reassign member picker (business / home only) */}
          {reassignable && memberList.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-app-text-muted">
                Assign to
              </p>
              <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
                {memberList.map((m) => {
                  const on = host === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setHost(m.id)}
                      aria-pressed={on}
                      className="flex shrink-0 flex-col items-center gap-1.5"
                    >
                      <span
                        className={clsx(
                          "flex h-11 w-11 items-center justify-center rounded-full text-[13px] font-bold ring-2",
                          tk.bg,
                          tk.textOn,
                          on ? tk.ring : "ring-transparent",
                        )}
                      >
                        {initials(m.name)}
                      </span>
                      <span
                        className={clsx(
                          "max-w-[56px] truncate text-[10px] font-semibold",
                          on ? tk.text : "text-app-text-muted",
                        )}
                      >
                        {m.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Conflict (409) → nearest open times */}
          {conflict && (
            <SlotConflictAlternatives
              conflict={conflict}
              pillar={pillar}
              onPick={(slot) => {
                setSelected(slot);
                setConflict(null);
              }}
              onPickAnother={() => setConflict(null)}
            />
          )}

          {!conflict && (
            <SlotPicker
              fetchSlots={fetchSlots}
              tz={tz}
              onTzChange={setTz}
              onPick={setSelected}
              selected={selected?.start ?? null}
              pillar={pillar}
            />
          )}

          {/* Authority toggle (only when changing the time) */}
          {selected && (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-app-text-muted">
                How to apply
              </p>
              <div className="flex gap-0.5 rounded-[10px] bg-app-surface-sunken p-1">
                {(
                  [
                    ["propose", "Propose to invitee"],
                    ["now", "Reschedule now"],
                  ] as const
                ).map(([key, label]) => {
                  const on = authority === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setAuthority(key)}
                      aria-pressed={on}
                      className={clsx(
                        "h-9 flex-1 rounded-md text-[11px] font-semibold transition",
                        on
                          ? clsx("bg-app-surface shadow-sm", tk.text)
                          : "text-app-text-secondary hover:text-app-text",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px] text-app-text-muted">
                {authority === "propose"
                  ? "The invitee gets the new time to accept."
                  : "Reschedules immediately with no proposal step."}
              </p>
            </div>
          )}

          {/* Notify invitee toggle — always visible once in the picking flow */}
          <button
            type="button"
            onClick={() => setNotifyInvitee((v) => !v)}
            className="flex w-full items-center gap-3 rounded-xl border border-app-border bg-app-surface px-3 py-2.5 text-left transition hover:bg-app-hover"
          >
            <Bell className="h-[17px] w-[17px] shrink-0 text-app-text-secondary" aria-hidden />
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-semibold text-app-text">Notify invitee</div>
              <div className="text-[10.5px] text-app-text-muted">Push + message</div>
            </div>
            <div
              className={clsx(
                "relative h-[25px] w-[42px] shrink-0 rounded-full transition",
                notifyInvitee ? tk.bg : "bg-app-border-strong",
              )}
            >
              <div
                className={clsx(
                  "absolute top-[2.5px] h-5 w-5 rounded-full bg-white shadow transition-all",
                  notifyInvitee ? "right-[2.5px]" : "left-[2.5px]",
                )}
              />
            </div>
          </button>

          {error && (
            <div className="rounded-xl border border-app-error-light bg-app-error-bg px-3 py-2.5">
              <p className="flex items-center gap-2 text-xs font-medium text-app-error">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                {error}
              </p>
            </div>
          )}

          <button
            type="button"
            disabled={!canSubmit || submitting}
            onClick={submit}
            className={clsx(
              "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition disabled:opacity-50",
              tk.bg,
              tk.textOn,
            )}
          >
            {submitting ? (
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                aria-hidden
              />
            ) : (
              (() => {
                const Icon = ctaIcon;
                return <Icon className="h-[18px] w-[18px]" aria-hidden />;
              })()
            )}
            {submitting ? "Saving" : ctaLabel}
          </button>
        </div>
      )}
    </BottomSheet>
  );
}

function inviteeFirst(name?: string | null): string {
  const n = (name || "").trim();
  if (!n) return "The invitee";
  return n.split(/\s+/)[0];
}
