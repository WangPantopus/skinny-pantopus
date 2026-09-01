"use client";

// E7 — Post-Meeting Follow-up. Opened on a past booking. Pick an outcome to
// start from a plainspoken template, edit the message, and send it to the
// invitee via POST /bookings/:id/nudge. Private note is local-only (no backend
// persistence endpoint); it is still rendered as the design specifies.

import { useState } from "react";
import { Bell, Check, CheckCircle2, EyeOff, Link2, Lock, RotateCw, Send } from "lucide-react";
import clsx from "clsx";
import * as api from "@pantopus/api";
import type { SchedulingOwnerRef } from "@pantopus/types";
import BottomSheet from "@/components/ui/BottomSheet";
import { decodeError } from "@/components/scheduling/decodeError";
import { pillarTokens, type Pillar } from "@/components/scheduling/pillarTokens";
import { FilterChip, InlineError, SectionOverline, TextArea } from "./ui";
import {
  FOLLOWUP_OUTCOMES,
  type FollowUpOutcome,
  followUpTemplate,
  isOverLimit,
} from "./messageTemplates";

export interface FollowUpTarget {
  id: string;
  title: string;
  subtitle?: string;
  inviteeName?: string | null;
}

export default function FollowUpSheet({
  open,
  onClose,
  booking,
  owner,
  pillar = "personal",
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  booking: FollowUpTarget | null;
  owner: SchedulingOwnerRef;
  pillar?: Pillar;
  onSent?: () => void;
}) {
  const [outcome, setOutcome] = useState<FollowUpOutcome | null>(null);
  const [text, setText] = useState("");
  const [privateNote, setPrivateNote] = useState("");
  const [pushEnabled, setPushEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [didSend, setDidSend] = useState(false);

  const tk = pillarTokens(pillar);

  if (!open || !booking) return null;

  const pickOutcome = (o: FollowUpOutcome) => {
    setOutcome(o);
    // Only overwrite when the message is empty or still a template.
    const isTemplate = FOLLOWUP_OUTCOMES.some(
      (x) => followUpTemplate(x.id, booking.inviteeName) === text,
    );
    if (!text.trim() || isTemplate) {
      setText(followUpTemplate(o, booking.inviteeName));
    }
  };

  const over = isOverLimit(text);
  const sendable = text.trim().length > 0 && !over;
  // When no outcome and no message: ghost "Save note only" CTA; otherwise solid send.
  const isSaveOnly = !outcome && !text.trim();

  const reset = () => {
    setOutcome(null);
    setText("");
    setPrivateNote("");
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
      // Auto-close after 1.5s so the user sees the success overlay.
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

  // ── Success overlay (Frame 4) ────────────────────────────────
  if (didSend) {
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
          <p className="text-base font-bold text-app-text">Follow-up sent</p>
          {/* Dark toast row */}
          <div className="mt-4 flex w-full items-center gap-2.5 rounded-xl bg-app-text px-4 py-3">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-app-success-bg" aria-hidden />
            <span className="text-xs font-semibold text-white">
              Follow-up sent
              {booking.inviteeName ? ` to ${booking.inviteeName.split(/\s+/)[0]}` : ""}
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
        isSaveOnly ? (
          // Ghost "Save note only" button when no outcome + no message
          <button
            type="button"
            onClick={() => {
              // Local save only — no API call when message is empty.
              // If there's a private note, we just close (no persistence endpoint).
              onClose();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-app-border bg-app-surface px-4 py-3 text-sm font-semibold text-app-text transition hover:bg-app-hover"
          >
            <Lock className="h-4 w-4" aria-hidden />
            Save note only
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!sendable || submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-app-surface-sunken disabled:text-app-text-muted"
          >
            {error ? (
              <RotateCw className="h-4 w-4" aria-hidden />
            ) : (
              <Send className="h-4 w-4" aria-hidden />
            )}
            {submitting ? "Sending…" : error ? "Try again" : "Send follow-up"}
          </button>
        )
      }
    >
      <div className="px-1">
        <div className="mb-4">
          <h3 className="text-base font-bold text-app-text">Follow up</h3>
          {booking.subtitle && (
            <p className="mt-1 text-xs text-app-text-muted">
              {booking.subtitle}
            </p>
          )}
        </div>

        {/* Outcome chips — pillar accent for active */}
        <div className="mb-4">
          <SectionOverline className="mb-2">Outcome</SectionOverline>
          <div className="flex flex-wrap gap-2">
            {FOLLOWUP_OUTCOMES.map((o) => {
              const active = outcome === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => pickOutcome(o.id)}
                  className={clsx(
                    "inline-flex h-8 items-center rounded-full px-3.5 text-xs font-semibold transition-colors",
                    active
                      ? clsx(tk.bgSoft, tk.text)
                      : "border border-app-border bg-app-surface text-app-text-secondary hover:bg-app-hover",
                  )}
                >
                  {active && (
                    <span
                      className={clsx("mr-1.5 h-1.5 w-1.5 rounded-full", tk.bg)}
                      aria-hidden
                    />
                  )}
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Message composer */}
        <div className="mb-3">
          <SectionOverline className="mb-2">
            Message to {booking.inviteeName?.split(/\s+/)[0] ?? "invitee"}
          </SectionOverline>
          <TextArea
            value={text}
            invalid={over}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a message, or pick an outcome above to start from a template."
            aria-label="Follow-up message"
          />
          <button
            type="button"
            onClick={() =>
              setText((t) =>
                t.includes("rebook")
                  ? t
                  : `${t}${t ? "\n\n" : ""}Here's a link to grab another time.`,
              )
            }
            className="mt-2 inline-flex h-7 items-center gap-1.5 rounded-full border border-app-border bg-app-surface px-3 text-[11px] font-semibold text-primary-600"
          >
            <Link2 className="h-3 w-3" aria-hidden />
            Send rebook link
          </button>
        </div>

        {/* Private note section (local only — no persistence endpoint) */}
        <div className="mb-3 border-t border-app-border pt-3">
          <div className="mb-2 flex items-center gap-1.5">
            <Lock className="h-3 w-3 text-app-text-muted" aria-hidden />
            <SectionOverline>Private note</SectionOverline>
          </div>
          <textarea
            value={privateNote}
            onChange={(e) => setPrivateNote(e.target.value)}
            placeholder="Outcome notes, next steps…"
            rows={2}
            className="w-full resize-none rounded-lg border border-app-border bg-app-surface-sunken px-3 py-2 text-sm text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/40"
          />
          <p className="mt-1.5 flex items-center gap-1 text-[10px] text-app-text-muted">
            <EyeOff className="h-2.5 w-2.5" aria-hidden />
            Only you can see this
          </p>
        </div>

        {/* Push toggle */}
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-app-border bg-app-surface px-3 py-2.5">
          <Bell className="h-4 w-4 shrink-0 text-app-text-secondary" aria-hidden />
          <span className="flex-1 text-sm font-medium text-app-text">
            Send via push + message
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={pushEnabled}
            onClick={() => setPushEnabled((v) => !v)}
            className={clsx(
              "relative h-6 w-10 shrink-0 rounded-full transition-colors",
              pushEnabled ? "bg-primary-600" : "bg-app-border-strong",
            )}
          >
            <span
              className={clsx(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
                pushEnabled ? "right-0.5" : "left-0.5",
              )}
            />
          </button>
        </div>

        {error && <InlineError message={error} />}
      </div>
    </BottomSheet>
  );
}
