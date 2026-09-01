"use client";

// W8 · E5 — Cancel & refund sheet (local, destructive). Reason chips + note +
// notify. The refund affordance only shows behind webFeatureFlags.schedulingPaid
// when the booking was paid (else cancel-only). Surfaces the response's
// refund_issued, and the guarded states: ALREADY_CANCELLED (read-only terminal),
// PAST_DEADLINE (policy-blocked), REFUND_FAILED (banner + retry).
// Credit-redeemed path: CreditSwitch replaces the RefundSection when the
// booking was paid with a package credit.

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Bell,
  CircleSlash,
  Receipt,
  RotateCw,
  Ticket,
  XCircle,
} from "lucide-react";
import * as api from "@pantopus/api";
import type { Booking, SchedulingOwnerRef } from "@pantopus/types";
import BottomSheet from "@/components/ui/BottomSheet";
import { decodeError } from "@/components/scheduling/decodeError";
import type { Pillar } from "@/components/scheduling/pillarTokens";
import { Banner, ReasonChips } from "./primitives";
import { formatWhen, inviteeDisplay, viewerTz } from "./format";

const CANCEL_REASONS = [
  "Changed plans",
  "Emergency",
  "Found someone else",
  "Other",
];

// Design-spec refund presets
type RefundPreset = "Full" | "Partial" | "Per policy";

export default function CancelRefundSheet({
  open,
  onClose,
  booking,
  eventName,
  owner,
  paid,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  booking: Booking;
  eventName: string;
  owner: SchedulingOwnerRef;
  pillar?: Pillar;
  paid: boolean;
  onDone: () => void;
}) {
  const tz = viewerTz();
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refundFailed, setRefundFailed] = useState(false);
  const [alreadyCancelled, setAlreadyCancelled] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [refundIssued, setRefundIssued] = useState(false);
  const [notifyInvitee, setNotifyInvitee] = useState(true);
  // Refund section state
  const [refundPreset, setRefundPreset] = useState<RefundPreset>("Full");

  // Detect payment context.
  const refundable = paid && !!booking.payment_id;
  // Credit-redeemed path: booking was paid with a package credit (no payment_id
  // but has package_credit_id). The API field may not yet exist in the type;
  // we cast via unknown to avoid a TypeScript error while keeping the runtime
  // branch ready.
  const creditRedeemed =
    paid &&
    !booking.payment_id &&
    !!((booking as unknown as Record<string, unknown>).package_credit_id);
  const [restoreCredit, setRestoreCredit] = useState(true);

  useEffect(() => {
    if (open) {
      setReason(null);
      setNote("");
      setError(null);
      setRefundFailed(false);
      setAlreadyCancelled(false);
      setSucceeded(false);
      setRefundIssued(false);
      setSubmitting(false);
      setNotifyInvitee(true);
      setRefundPreset("Full");
      setRestoreCredit(true);
    }
  }, [open]);

  const confirmLabel = refundable ? "Cancel & refund" : "Cancel booking";

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    setRefundFailed(false);
    const combined =
      [reason === "Other" ? null : reason, note.trim()]
        .filter(Boolean)
        .join(" — ") ||
      reason ||
      undefined;
    try {
      const res = await api.scheduling.cancelBooking(
        booking.id,
        combined,
        owner,
      );
      const issued = !!res.booking?.refund_issued;
      setRefundIssued(issued);
      setSucceeded(true);
      setSubmitting(false);
      onDone();
    } catch (err) {
      const d = decodeError(err);
      if (d.kind === "error" && d.code === "ALREADY_CANCELLED") {
        setAlreadyCancelled(true);
      } else if (d.kind === "error" && d.code === "REFUND_FAILED") {
        setRefundFailed(true);
        setError(
          "Refund couldn't be processed — try again or contact support",
        );
      } else if (d.kind === "error" && d.code === "PAST_DEADLINE") {
        setError(
          "This booking is past the cancellation cutoff — you can still message the invitee.",
        );
      } else {
        setError(d.message);
      }
      setSubmitting(false);
    }
  };

  // ── Terminal: already-cancelled or succeeded ──────────────────────────────
  const terminalState = alreadyCancelled
    ? "already"
    : succeeded
      ? "done"
      : null;

  return (
    <BottomSheet
      open={open}
      onClose={() => !submitting && onClose()}
      title="Cancel booking"
    >
      {terminalState ? (
        <div className="flex flex-col items-center gap-4 px-6 py-8 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-app-surface-sunken text-app-text-muted">
            <CircleSlash className="h-7 w-7" aria-hidden />
          </span>
          <div>
            <h3 className="text-base font-bold text-app-text">
              {terminalState === "already"
                ? "Already cancelled"
                : "Booking cancelled"}
            </h3>
            <p className="mt-1.5 max-w-xs text-sm text-app-text-secondary">
              {terminalState === "already"
                ? "This booking has already been cancelled."
                : refundIssued
                  ? "The booking has been cancelled and a refund has been issued to the card on file."
                  : "The booking has been cancelled."}
            </p>
          </div>

          {/* Refund row in terminal (for success with refund) */}
          {terminalState === "done" && refundIssued && (
            <div className="w-full rounded-2xl border border-app-border bg-app-surface p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-app-text-secondary">
                  Refunded to card
                </span>
                <span className="text-sm font-bold text-app-success">
                  Refunded
                </span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => onClose()}
            className="h-11 w-full rounded-xl border border-app-border text-sm font-bold text-app-text transition hover:bg-app-hover"
          >
            Done
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-app-text">
              Cancel this booking?
            </h3>
            <p className="mt-1 text-xs text-app-text-muted">
              {eventName} · {inviteeDisplay(booking.invitee_name)} ·{" "}
              {formatWhen(booking.start_at, tz)}
            </p>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-app-text-muted">
              Reason
            </p>
            <ReasonChips
              options={CANCEL_REASONS}
              value={reason}
              onChange={setReason}
              tone="error"
            />
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              reason === "Other"
                ? "Tell the invitee what happened"
                : "Note to the invitee (optional)"
            }
            rows={2}
            className="w-full resize-none rounded-lg border border-app-border bg-app-surface-sunken px-3 py-2.5 text-[13px] text-app-text placeholder:text-app-text-muted focus:border-app-border-strong focus:outline-none"
          />

          {/* Refund section — full UI (paid card path) */}
          {refundable && !refundFailed && (
            <div className="rounded-2xl border border-app-border bg-app-surface p-3">
              <div className="mb-2.5 flex items-center gap-1.5">
                <Receipt
                  className="h-3.5 w-3.5 text-app-text-muted"
                  aria-hidden
                />
                <span className="text-[11px] font-bold uppercase tracking-wider text-app-text-muted">
                  Refund
                </span>
              </div>
              {/* Segmented preset control */}
              <div className="mb-2.5 flex gap-0.5 rounded-[9px] bg-app-surface-sunken p-0.5">
                {(["Full", "Partial", "Per policy"] as RefundPreset[]).map(
                  (p) => {
                    const on = refundPreset === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setRefundPreset(p)}
                        className={`h-[30px] flex-1 rounded-[6px] text-[11px] font-${on ? "bold" : "semibold"} transition ${on ? "bg-app-surface text-app-text shadow-sm" : "text-app-text-muted"}`}
                      >
                        {p}
                      </button>
                    );
                  },
                )}
              </div>
              {/* Money rows */}
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[12.5px] text-app-text-secondary">
                  Paid
                </span>
                <span className="text-[13px] font-bold text-app-text tabular-nums">
                  —
                </span>
              </div>
              <div className="my-0.5 h-px bg-app-border" />
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[13.5px] font-bold text-app-text">
                  Refund to card
                </span>
                <span
                  className={`text-[15px] font-bold tabular-nums ${refundPreset === "Per policy" ? "text-app-success" : "text-app-success"}`}
                >
                  {refundPreset === "Per policy" ? "Per policy" : "—"}
                </span>
              </div>
              <p className="mt-2 text-[10.5px] leading-[15px] text-app-text-muted">
                {refundPreset === "Full"
                  ? "Full refund issued per your cancellation policy."
                  : refundPreset === "Partial"
                    ? "Partial refund issued per your cancellation policy."
                    : "Refund calculated per your cancellation policy."}
              </p>
            </div>
          )}

          {/* Refund failed — error banner + refund section shown for retry */}
          {refundFailed && refundable && (
            <div className="rounded-2xl border border-app-border bg-app-surface p-3">
              <div className="mb-2.5 flex items-center gap-1.5">
                <Receipt
                  className="h-3.5 w-3.5 text-app-text-muted"
                  aria-hidden
                />
                <span className="text-[11px] font-bold uppercase tracking-wider text-app-text-muted">
                  Refund
                </span>
              </div>
              <p className="text-xs text-app-text-secondary">
                Booking was cancelled. The refund will be retried.
              </p>
            </div>
          )}

          {/* Credit-redeemed path — restore session credit switch */}
          {creditRedeemed && (
            <button
              type="button"
              onClick={() => setRestoreCredit((v) => !v)}
              className="flex w-full items-center gap-3 rounded-2xl border border-app-border bg-app-surface px-3 py-3 text-left transition hover:bg-app-hover"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-app-info-bg">
                <Ticket
                  className="h-[18px] w-[18px] text-app-info"
                  aria-hidden
                />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-app-text">
                  Restore 1 session credit
                </div>
                <div className="text-[10.5px] text-app-text-muted">
                  Paid with a session package
                </div>
              </div>
              <div
                className={`relative h-[25px] w-[42px] shrink-0 rounded-full transition ${restoreCredit ? "bg-app-info" : "bg-app-border-strong"}`}
              >
                <div
                  className={`absolute top-[2.5px] h-5 w-5 rounded-full bg-white shadow transition-all ${restoreCredit ? "right-[2.5px]" : "left-[2.5px]"}`}
                />
              </div>
            </button>
          )}

          {/* Notify invitee toggle */}
          <button
            type="button"
            onClick={() => setNotifyInvitee((v) => !v)}
            className="flex w-full items-center gap-3 rounded-xl border border-app-border bg-app-surface px-3 py-2.5 text-left transition hover:bg-app-hover"
          >
            <Bell
              className="h-[17px] w-[17px] shrink-0 text-app-text-secondary"
              aria-hidden
            />
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-semibold text-app-text">
                Notify invitee
              </div>
            </div>
            <div
              className={`relative h-[25px] w-[42px] shrink-0 rounded-full transition ${notifyInvitee ? "bg-app-info" : "bg-app-border-strong"}`}
            >
              <div
                className={`absolute top-[2.5px] h-5 w-5 rounded-full bg-white shadow transition-all ${notifyInvitee ? "right-[2.5px]" : "left-[2.5px]"}`}
              />
            </div>
          </button>

          {error && (
            <Banner tone="error" icon={AlertCircle}>
              {error}
            </Banner>
          )}

          <button
            type="button"
            disabled={submitting}
            onClick={submit}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-app-error text-sm font-bold text-white transition disabled:opacity-70"
          >
            {submitting ? (
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                aria-hidden
              />
            ) : refundFailed ? (
              <RotateCw className="h-[18px] w-[18px]" aria-hidden />
            ) : (
              <XCircle className="h-[18px] w-[18px]" aria-hidden />
            )}
            {submitting
              ? "Cancelling"
              : refundFailed
                ? "Retry refund"
                : confirmLabel}
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
