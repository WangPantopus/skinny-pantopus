"use client";

// E6 — Mark No-Show. A confirm modal opened from a booking row/detail. The
// no-show action is only offered once the booking's end time has passed; before
// then the primary is disabled with the reason (mirroring the backend's
// 409 NOT_APPLICABLE_YET). Marks the whole booking no_show via
// POST /bookings/:id/no-show (there is no per-attendee no-show endpoint, so
// group events are marked as a whole and we say so). The group checkbox roster
// is rendered for the designed UX even though the backend marks the whole booking
// — the selection is intentional UI even without a per-attendee API.

import { useState } from "react";
import { Check, UserX } from "lucide-react";
import clsx from "clsx";
import * as api from "@pantopus/api";
import type { Booking, SchedulingOwnerRef } from "@pantopus/types";
import BottomSheet from "@/components/ui/BottomSheet";
import { toast } from "@/components/ui/toast-store";
import { decodeError } from "@/components/scheduling/decodeError";
import { pillarTokens, type Pillar } from "@/components/scheduling/pillarTokens";
import { IconDisc, InlineError } from "./ui";
import { canMarkNoShow, noShowBlockedReason } from "./noShow";
import { initials } from "./format";

export interface NoShowAttendee {
  id: string;
  name: string | null;
}

export interface NoShowTarget {
  id: string;
  status: Booking["status"];
  start_at: string;
  end_at: string;
  invitee_name: string | null;
  /** > 1 ⇒ a group event (the whole booking is marked). */
  attendeeCount?: number;
  /** Attendee list for group checkbox roster. */
  attendees?: NoShowAttendee[];
}

export default function NoShowSheet({
  open,
  onClose,
  booking,
  owner,
  pillar,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  booking: NoShowTarget | null;
  owner: SchedulingOwnerRef;
  pillar: Pillar;
  onDone?: (updated: Booking) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  // Group checkbox roster: track which attendees are selected (default all).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() =>
    new Set((booking?.attendees ?? []).map((a) => a.id)),
  );

  if (!open || !booking) return null;

  const blocked = noShowBlockedReason(booking);
  const allowed = canMarkNoShow(booking);
  const isGroup = (booking.attendeeCount ?? 1) > 1;
  const tk = pillarTokens(pillar);

  const toggleAttendee = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedCount = selectedIds.size;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.scheduling.noShowBooking(booking.id, owner);
      toast.success("Marked as no-show.");
      onDone?.(res.booking);
      onClose();
    } catch (err) {
      const d = decodeError(err);
      setError(
        d.kind === "error" && d.code === "NOT_APPLICABLE_YET"
          ? "You can mark a no-show after the booking's end time."
          : d.message,
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Destructive action stays semantic-red regardless of pillar; tk used for avatars.
  const confirmLabel = isGroup && booking.attendees && booking.attendees.length > 0
    ? `Mark ${selectedCount > 0 ? selectedCount : booking.attendees.length} as no-show`
    : "Mark no-show";

  return (
    <BottomSheet
      open={open}
      onClose={() => {
        if (!submitting) onClose();
      }}
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-lg border border-app-border bg-app-surface px-4 py-2.5 text-sm font-semibold text-app-text-strong transition hover:bg-app-hover disabled:opacity-50"
          >
            Keep open
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !allowed}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-app-error px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <svg
                className="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      }
    >
      <div className="px-1 pb-2">
        <div className="mb-3 flex justify-center">
          <IconDisc icon={UserX} tone="error" />
        </div>
        <h3 className="text-center text-base font-bold text-app-text">
          {isGroup ? "Who didn't show?" : "Mark as no-show?"}
        </h3>

        {isGroup && booking.attendees && booking.attendees.length > 0 ? (
          <>
            <p className="mt-1.5 text-center text-xs text-app-text-muted">
              Select the attendees who didn't attend.
            </p>
            {/* Attendee checkbox roster */}
            <ul className="mt-3 flex flex-col gap-2">
              {booking.attendees.map((a) => {
                const checked = selectedIds.has(a.id);
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => toggleAttendee(a.id)}
                      className={clsx(
                        "flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition",
                        checked
                          ? "border-app-error/40 bg-app-error-bg"
                          : "border-app-border bg-app-surface hover:bg-app-hover",
                      )}
                    >
                      <span
                        className={clsx(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                          tk.bg,
                          tk.textOn,
                        )}
                      >
                        {initials(a.name)}
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-semibold text-app-text">
                        {a.name ?? "Guest"}
                      </span>
                      <span
                        className={clsx(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[1.5px] transition",
                          checked
                            ? "border-app-error bg-app-error"
                            : "border-app-border-strong bg-app-surface",
                        )}
                        aria-hidden
                      >
                        {checked && (
                          <Check
                            className="h-3 w-3 text-white"
                            strokeWidth={3}
                          />
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {/* Note field */}
            <div className="mt-3">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note (optional)"
                rows={2}
                className="w-full resize-none rounded-lg border border-app-border bg-app-surface-sunken px-3 py-2 text-sm text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>
          </>
        ) : (
          <>
            <p className="mx-auto mt-2 max-w-xs text-center text-sm leading-relaxed text-app-text-secondary">
              This closes the booking. You can still message the invitee or send
              a rebook link afterward.
            </p>
            {booking.invitee_name && (
              <div className="mx-auto mt-4 flex max-w-xs items-center gap-3 rounded-xl border border-app-border bg-app-surface px-3 py-2.5">
                <span
                  className={clsx(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    tk.bg,
                    tk.textOn,
                  )}
                >
                  {initials(booking.invitee_name)}
                </span>
                <span className="min-w-0 text-sm font-semibold text-app-text">
                  {booking.invitee_name}
                </span>
              </div>
            )}
          </>
        )}

        {blocked && (
          <p className="mx-auto mt-4 max-w-xs rounded-lg bg-app-warning-bg px-3 py-2 text-xs font-medium text-app-warning">
            {blocked}
          </p>
        )}

        {error && (
          <div className="mt-4">
            <InlineError message={error} />
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
