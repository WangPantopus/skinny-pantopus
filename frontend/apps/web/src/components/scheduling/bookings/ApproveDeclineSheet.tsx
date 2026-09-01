"use client";

// W8 · E3 — Approve / Decline request sheet (local, no global route). Renders
// for approval-required bookings. Review mode shows the requester + slot +
// intake preview with Approve (primary) / Decline (ghost). Decline expands to
// reason chips + note. Errors surface inline and re-enable the actions.

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CalendarPlus,
  Check,
  ChevronDown,
  ClipboardList,
  TriangleAlert,
  X,
} from "lucide-react";
import clsx from "clsx";
import * as api from "@pantopus/api";
import type { Booking, SchedulingOwnerRef } from "@pantopus/types";
import BottomSheet from "@/components/ui/BottomSheet";
import { decodeError } from "@/components/scheduling/decodeError";
import {
  pillarTokens,
  PRIMARY_BLUE_CLS,
  type Pillar,
} from "@/components/scheduling/pillarTokens";
import { Avatar, Banner, ReasonChips } from "./primitives";
import { durationLabel, formatRange, inviteeDisplay, viewerTz } from "./format";

const DECLINE_REASONS = [
  "Time doesn’t work",
  "Fully booked",
  "Not a fit",
  "Other",
];

export default function ApproveDeclineSheet({
  open,
  onClose,
  booking,
  eventName,
  owner,
  pillar = "personal",
  initialMode = "review",
  onDone,
  onProposeTime,
}: {
  open: boolean;
  onClose: () => void;
  booking: Booking;
  eventName: string;
  owner: SchedulingOwnerRef;
  pillar?: Pillar;
  initialMode?: "review" | "decline";
  onDone: () => void;
  /** Optional: called when the host taps "Propose another time" in decline mode. */
  onProposeTime?: () => void;
}) {
  const tk = pillarTokens(pillar);
  const tz = viewerTz();
  const [mode, setMode] = useState<"review" | "decline">(initialMode);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intakeOpen, setIntakeOpen] = useState(false);
  // hasConflict: TODO wire from booking detail API once backend provides it.
  // Scaffold renders the banner when true.
  const hasConflict = false;

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setReason(null);
      setNote("");
      setError(null);
      setSubmitting(false);
      setIntakeOpen(false);
    }
  }, [open, initialMode]);

  const intakeCount = booking.intake_answers
    ? Object.keys(booking.intake_answers).length
    : 0;

  const approve = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api.scheduling.approveBooking(booking.id, owner);
      onDone();
      onClose();
    } catch (err) {
      setError(decodeError(err).message);
      setSubmitting(false);
    }
  };

  const decline = async () => {
    setSubmitting(true);
    setError(null);
    const combined = [reason, note.trim()].filter(Boolean).join(" — ");
    try {
      await api.scheduling.declineBooking(
        booking.id,
        combined || undefined,
        owner,
      );
      onDone();
      onClose();
    } catch (err) {
      setError(decodeError(err).message);
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => !submitting && onClose()}
      title={mode === "decline" ? "Decline request" : "Review request"}
    >
      <div className="space-y-4">
        {/* Requester */}
        <div className="flex items-center gap-3 rounded-2xl border border-app-border bg-app-surface-raised p-3">
          <Avatar pillar={pillar} name={booking.invitee_name} />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-app-text">
              {inviteeDisplay(booking.invitee_name)}
            </div>
            <div className="truncate text-xs text-app-text-muted">
              {booking.invitee_email || "Verified requester"}
            </div>
          </div>
        </div>

        {/* Slot line */}
        <div className="flex items-center gap-3 rounded-2xl border border-app-border bg-app-surface p-3">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${tk.bgSoft}`}
          >
            <Calendar className={`h-[18px] w-[18px] ${tk.text}`} aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-app-text">
              {formatRange(booking.start_at, booking.end_at, tz)}
            </div>
            <div className="text-xs text-app-text-muted">
              {eventName}
              {durationLabel(booking.start_at, booking.end_at) &&
                ` · ${durationLabel(booking.start_at, booking.end_at)}`}
            </div>
          </div>
        </div>

        {/* Conflict banner (Frame 3) — shown between SlotLine and inputs */}
        {hasConflict && (
          <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            <TriangleAlert
              className="h-[17px] w-[17px] shrink-0 text-amber-600"
              aria-hidden
            />
            <span className="flex-1 text-[11.5px] font-semibold leading-[15px] text-amber-700">
              This slot overlaps a confirmed booking
            </span>
            <button
              type="button"
              className="text-[11.5px] font-bold text-amber-700"
              onClick={() => {}}
            >
              View conflict
            </button>
          </div>
        )}

        {mode === "review" ? (
          <>
            {/* Expandable intake answers disclosure (design spec: tappable chevron) */}
            {intakeCount > 0 && (
              <button
                type="button"
                onClick={() => setIntakeOpen((v) => !v)}
                aria-expanded={intakeOpen}
                className="flex w-full items-center gap-2.5 rounded-xl border border-app-border bg-app-surface px-3 py-2.5"
              >
                <ClipboardList
                  className="h-4 w-4 text-app-text-secondary"
                  aria-hidden
                />
                <span className="flex-1 text-left text-[13px] font-semibold text-app-text">
                  Intake answers
                </span>
                <span className="text-xs text-app-text-muted">
                  {intakeCount} {intakeCount === 1 ? "answer" : "answers"}
                </span>
                <ChevronDown
                  className={clsx(
                    "h-4 w-4 text-app-text-muted transition-transform",
                    intakeOpen && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>
            )}
            {intakeOpen && booking.intake_answers && (
              <dl className="space-y-2 rounded-xl border border-app-border bg-app-surface-sunken px-3 py-2.5">
                {Object.entries(booking.intake_answers).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-app-text-muted">
                      {k}
                    </dt>
                    <dd className="mt-0.5 text-[13px] text-app-text">
                      {Array.isArray(v)
                        ? v.join(", ")
                        : v == null
                          ? "—"
                          : String(v)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note (optional)"
              rows={2}
              className="w-full resize-none rounded-lg border border-app-border bg-app-surface-sunken px-3 py-2.5 text-[13px] text-app-text placeholder:text-app-text-muted focus:border-app-border-strong focus:outline-none"
            />
            {error && (
              <Banner tone="error" icon={AlertCircle}>
                {error}
              </Banner>
            )}
            <div className="space-y-2.5">
              {/* Approve: fixed PRIMARY blue per design spec (not pillar accent) */}
              <button
                type="button"
                disabled={submitting}
                onClick={approve}
                className={clsx(
                  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition disabled:opacity-70",
                  PRIMARY_BLUE_CLS.bg,
                  PRIMARY_BLUE_CLS.textOn,
                )}
              >
                {submitting ? (
                  <Spinner />
                ) : (
                  <Check className="h-[18px] w-[18px]" aria-hidden />
                )}
                {submitting ? "Approving" : "Approve"}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setMode("decline")}
                className="h-11 w-full rounded-xl text-sm font-bold text-app-error transition hover:bg-app-error-bg disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-app-text-muted">
                Reason
              </p>
              <ReasonChips
                options={DECLINE_REASONS}
                value={reason}
                onChange={setReason}
                tone="error"
              />
              {/* "Propose another time" link — design Frame 2, below chip row */}
              {onProposeTime && (
                <button
                  type="button"
                  onClick={onProposeTime}
                  className={clsx(
                    "mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-bold",
                    PRIMARY_BLUE_CLS.text,
                  )}
                >
                  <CalendarPlus className="h-[15px] w-[15px]" aria-hidden />
                  Propose another time
                </button>
              )}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note for the requester (optional)"
              rows={2}
              className="w-full resize-none rounded-lg border border-app-border bg-app-surface-sunken px-3 py-2.5 text-[13px] text-app-text placeholder:text-app-text-muted focus:border-app-border-strong focus:outline-none"
            />
            {error && (
              <Banner tone="error" icon={AlertCircle}>
                {error}
              </Banner>
            )}
            {/* Design: decline mode shows only a single "Decline request" button (no Back) */}
            <button
              type="button"
              disabled={submitting}
              onClick={decline}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-app-error text-sm font-bold text-white transition disabled:opacity-70"
            >
              {submitting ? (
                <Spinner />
              ) : (
                <X className="h-[18px] w-[18px]" aria-hidden />
              )}
              {submitting ? "Declining" : "Decline request"}
            </button>
          </>
        )}
      </div>
    </BottomSheet>
  );
}

function Spinner() {
  return (
    <span
      className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
      aria-hidden
    />
  );
}
