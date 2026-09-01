"use client";

// E11 — Send a Nudge / Message attendees. A message composer opened from a
// booking row ("Nudge") or a group roster ("Message all"). Sends a reminder via
// POST /bookings/:id/nudge. Group mode shows audience chips that size the
// recipient count and disable send when nobody is in the chosen group.
// Success state shows a full overlay (72px disc + dark toast row) matching
// the design's Frame 3 (Nudge · Sent).

import { useMemo, useState } from "react";
import {
  Bell,
  Check,
  CheckCircle2,
  FileText,
  Mail,
  Send,
  UsersRound,
} from "lucide-react";
import clsx from "clsx";
import * as api from "@pantopus/api";
import type { BookingAttendee, SchedulingOwnerRef } from "@pantopus/types";
import BottomSheet from "@/components/ui/BottomSheet";
import { decodeError } from "@/components/scheduling/decodeError";
import { FilterChip, InlineError, SectionOverline, TextArea } from "./ui";
import {
  NUDGE_AUDIENCES,
  NUDGE_LIMIT,
  type NudgeAudience,
  audienceCount,
  canSendNudge,
  isOverLimit,
} from "./messageTemplates";

export interface NudgeTarget {
  id: string;
  title: string;
  subtitle?: string;
  inviteeName?: string | null;
  /** Provided for group events → enables audience chips + counts. */
  attendees?: BookingAttendee[];
}

export default function NudgeSheet({
  open,
  onClose,
  booking,
  owner,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  booking: NudgeTarget | null;
  owner: SchedulingOwnerRef;
  onSent?: () => void;
}) {
  const [text, setText] = useState("");
  const [audience, setAudience] = useState<NudgeAudience>("all");
  const [pushOn, setPushOn] = useState(true);
  const [emailOn, setEmailOn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [didSend, setDidSend] = useState(false);

  const attendees = booking?.attendees;
  const isGroup = (attendees?.length ?? 0) > 1;

  const recipientCount = useMemo(() => {
    if (!booking) return 0;
    if (isGroup && attendees) return audienceCount(audience, attendees);
    return 1; // single invitee
  }, [booking, isGroup, attendees, audience]);

  if (!open || !booking) return null;

  const over = isOverLimit(text);
  const sendable = canSendNudge(text, recipientCount);
  const ctaLabel = isGroup
    ? `Send to ${recipientCount}`
    : booking.inviteeName
      ? `Send to ${booking.inviteeName.split(/\s+/)[0]}`
      : "Send reminder";

  const reset = () => {
    setText("");
    setAudience("all");
    setError(null);
    setDidSend(false);
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api.scheduling.nudgeBooking(booking.id, text.trim(), owner);
      setDidSend(true);
      onSent?.();
      // Auto-close after 1.5s so user sees the success overlay.
      setTimeout(() => {
        onClose();
        reset();
      }, 1500);
    } catch (err) {
      setError(decodeError(err).message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success overlay (Frame 3: Nudge · Sent) ──────────────────
  if (didSend) {
    const sentCount = isGroup ? recipientCount : null;
    return (
      <BottomSheet
        open={open}
        onClose={() => {
          onClose();
          reset();
        }}
      >
        <div className="relative flex flex-col items-center justify-center gap-4 py-10 text-center">
          <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-app-success-bg ring-1 ring-app-success/30">
            <Check className="h-9 w-9 text-app-success" strokeWidth={2.6} aria-hidden />
          </span>
          <p className="text-base font-bold text-app-text">Update sent</p>
          {/* Dark toast row */}
          <div className="mt-4 flex w-full items-center gap-2.5 rounded-xl bg-app-text px-4 py-3">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-app-success-bg" aria-hidden />
            <span className="text-xs font-semibold text-white">
              Update sent
              {sentCount != null
                ? ` to ${sentCount} attendee${sentCount === 1 ? "" : "s"}`
                : booking.inviteeName
                  ? ` to ${booking.inviteeName.split(/\s+/)[0]}`
                  : ""}
            </span>
          </div>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      open={open}
      onClose={() => {
        if (!submitting) onClose();
      }}
      footer={
        <button
          type="button"
          onClick={submit}
          disabled={!sendable || submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-app-surface-sunken disabled:text-app-text-muted"
        >
          <Send className="h-4 w-4" aria-hidden />
          {submitting ? "Sending…" : ctaLabel}
        </button>
      }
    >
      <div className="px-1">
        {/* Header always "Message attendees" per design */}
        <div className="mb-4">
          <h3 className="text-base font-bold text-app-text">
            Message attendees
          </h3>
          {booking.subtitle && (
            <p className="mt-1 text-xs text-app-text-muted">
              {booking.subtitle}
            </p>
          )}
        </div>

        {/* Template button + composer */}
        <div className="relative mb-4">
          <button
            type="button"
            onClick={() =>
              setText(
                "Quick reminder about your upcoming booking — see you then.",
              )
            }
            className="mb-2 inline-flex h-7 items-center gap-1.5 rounded-full border border-app-border bg-app-surface px-3 text-[11px] font-semibold text-primary-600"
          >
            <FileText className="h-3 w-3" aria-hidden />
            Use a template
          </button>
          <TextArea
            value={text}
            invalid={over}
            maxLength={NUDGE_LIMIT * 2}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a short reminder…"
            aria-label="Reminder message"
          />
          <span
            className={clsx(
              "pointer-events-none absolute bottom-2.5 right-3 text-[10px] font-semibold tabular-nums",
              over ? "text-app-error" : "text-app-text-muted",
            )}
          >
            {text.length}/{NUDGE_LIMIT}
          </span>
        </div>
        {over && (
          <p className="mb-4 text-xs font-medium text-app-error">
            Shorten your message — it&apos;s over {NUDGE_LIMIT} characters.
          </p>
        )}

        {/* Audience chips — always shown (unconditional per design) */}
        <div className="mb-4">
          <SectionOverline className="mb-2">Audience</SectionOverline>
          <div className="flex flex-wrap gap-2">
            {NUDGE_AUDIENCES.map((a) => (
              <FilterChip
                key={a.id}
                label={a.label}
                count={audienceCount(a.id, attendees ?? [])}
                tone="neutral"
                active={audience === a.id}
                onClick={() => setAudience(a.id)}
              />
            ))}
          </div>
          {recipientCount === 0 && (
            <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-app-border bg-app-surface-sunken px-3 py-2.5">
              <UsersRound className="h-3.5 w-3.5 shrink-0 text-app-text-muted" aria-hidden />
              <span className="text-[11px] font-semibold text-app-text-muted">
                No one to message in this group
              </span>
            </div>
          )}
        </div>

        {/* Channel toggles (Push ON by default, Email OFF) */}
        <div className="space-y-2">
          {(
            [
              { label: "Push", icon: Bell, on: pushOn, toggle: () => setPushOn((v) => !v) },
              { label: "Email", icon: Mail, on: emailOn, toggle: () => setEmailOn((v) => !v) },
            ] as const
          ).map(({ label, icon: Icon, on, toggle }) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-xl border border-app-border bg-app-surface px-3 py-2.5"
            >
              <Icon className="h-4 w-4 shrink-0 text-app-text-secondary" aria-hidden />
              <span className="flex-1 text-sm font-medium text-app-text">
                {label}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                onClick={toggle}
                className={clsx(
                  "relative h-6 w-10 shrink-0 rounded-full transition-colors",
                  on ? "bg-primary-600" : "bg-app-border-strong",
                )}
              >
                <span
                  className={clsx(
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
                    on ? "right-0.5" : "left-0.5",
                  )}
                />
              </button>
            </div>
          ))}
        </div>

        {error && (
          <div className="mt-4">
            <InlineError message={error} />
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
