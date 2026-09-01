"use client";

// E13 — Waitlist Join (invitee). The bottom sheet an invitee sees on a fully
// booked event type. Self-contained + reusable: the public booking flow (W7) can
// mount it with a real `onJoin` (POST /book/:slug/:eventTypeSlug/waitlist); the
// host waitlist page mounts it in `preview` mode so the host can see exactly
// what invitees get. Shows join → joined (#position) states.

import { useState } from "react";
import { Check, Clock, UserPlus, Users } from "lucide-react";
import BottomSheet from "@/components/ui/BottomSheet";
import type { Pillar } from "@/components/scheduling/pillarTokens";
import { pillarTokens } from "@/components/scheduling/pillarTokens";
import { Field, InlineError, TextInput } from "./ui";
import { fmtDate } from "./format";

export interface WaitlistJoinResult {
  position?: number | null;
  alreadyJoined?: boolean;
  /** ISO date string when the invitee joined (if already on waitlist). */
  joinedAt?: string | null;
}

export default function WaitlistJoinSheet({
  open,
  onClose,
  hostName,
  eventTypeName,
  pillar = "personal",
  preview = false,
  onJoin,
}: {
  open: boolean;
  onClose: () => void;
  hostName?: string;
  eventTypeName?: string;
  pillar?: Pillar;
  preview?: boolean;
  onJoin?: (data: {
    name: string;
    phone: string;
    note: string;
  }) => Promise<WaitlistJoinResult>;
}) {
  const tk = pillarTokens(pillar);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WaitlistJoinResult | null>(null);

  if (!open) return null;

  const canSubmit = !preview && name.trim().length > 0 && !!onJoin;

  const submit = async () => {
    if (!onJoin) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await onJoin({
        name: name.trim(),
        phone: phone.trim(),
        note: note.trim(),
      });
      setResult(r);
    } catch {
      setError("We couldn’t add you to the waitlist. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Joined / already-on-waitlist confirmation
  if (result) {
    const already = result.alreadyJoined;
    // Build the subtitle: for "already" state include join date if available.
    const alreadySubtitle = result.joinedAt
      ? `You joined this waitlist on ${fmtDate(result.joinedAt)}. We’ll text you the moment a seat opens.`
      : "We’ll text you the moment a spot opens.";
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        footer={
          // Design (Frame 2): "Leave waitlist" ghost CTA (no backend endpoint —
          // rendered as designed but pressing it closes the sheet).
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-app-border bg-app-surface px-4 py-3 text-sm font-semibold text-app-text-strong transition hover:bg-app-hover"
          >
            Leave waitlist
          </button>
        }
      >
        <div className="flex flex-col items-center gap-4 px-2 py-4 text-center">
          <span
            className={
              already
                ? `flex items-center justify-center rounded-full ${tk.bgSoft} ${tk.text}`
                : "flex items-center justify-center rounded-full bg-app-success-bg ring-1 ring-app-success/30 text-app-success"
            }
            style={{ width: 74, height: 74 }}
          >
            {already ? (
              <Clock className="h-8 w-8" strokeWidth={1.8} aria-hidden />
            ) : (
              <Check className="h-9 w-9" strokeWidth={2.6} aria-hidden />
            )}
          </span>
          <div>
            <p className="text-lg font-bold text-app-text">
              {already ? "You’re already waiting" : "You’re on the waitlist"}
            </p>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-app-text-secondary">
              {already
                ? alreadySubtitle
                : "We’ll text you the moment a spot opens."}
            </p>
          </div>
          {typeof result.position === "number" && result.position > 0 && (
            <span
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 ${tk.bgSoft}`}
            >
              <span className={`text-sm font-extrabold ${tk.text}`}>
                #{result.position}
              </span>
              <span className="text-xs font-semibold text-app-text-secondary">
                in line
              </span>
            </span>
          )}
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
          disabled={!canSubmit || submitting}
          className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:bg-app-surface-sunken disabled:text-app-text-muted ${tk.bg} ${tk.textOn}`}
        >
          <UserPlus className="h-4 w-4" aria-hidden />
          {preview
            ? "Join waitlist (preview)"
            : submitting
              ? "Joining…"
              : "Join waitlist"}
        </button>
      }
    >
      <div className="px-1">
        <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-app-warning-bg px-2.5 py-1 text-[11px] font-bold text-app-warning">
          <Users className="h-3 w-3" aria-hidden />
          Fully booked
        </span>
        <h3 className="text-base font-bold text-app-text">
          {eventTypeName ? `${eventTypeName} is full` : "This time is full"}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-app-text-secondary">
          Join the waitlist{hostName ? ` for ${hostName}` : ""} and we’ll text
          you the moment a spot opens.
        </p>

        {preview && (
          <p className="mt-3 rounded-lg bg-app-surface-sunken px-3 py-2 text-xs font-medium text-app-text-muted">
            Preview — this is what invitees see. Submitting is disabled here.
          </p>
        )}

        <div className="mt-4 space-y-3">
          <Field label="Your name">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              disabled={preview}
            />
          </Field>
          <Field label="Mobile" hint="For a text when a spot opens">
            <TextInput
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 012-3456"
              inputMode="tel"
              disabled={preview}
            />
          </Field>
          <Field label="Preferred time">
            <TextInput
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Any morning works (optional)"
              disabled={preview}
            />
          </Field>
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
