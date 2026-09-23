"use client";

// E13 — Waitlist Join (invitee). The bottom sheet a visitor opens from "Get
// notified when times open" on a public booking page. Self-contained +
// reusable: the public event-type page mounts it with a real `onJoin`
// (POST /api/public/book/:slug/:eventTypeSlug/waitlist, email required, name
// optional); the host waitlist page mounts it in `preview` mode so the host
// can see exactly what visitors get. The host promotes people by hand, and a
// promotion emails the visitor, or notifies them in the app when they joined
// signed in with their account's email. Shows join → joined states.

import { useEffect, useRef, useState } from "react";
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
  /** How a promotion reaches them: in the app when the join was linked to
   *  their signed-in account, otherwise by email. */
  notifyVia?: "email" | "app";
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Plain copy for the statuses the join endpoint returns. */
function joinErrorMessage(err: unknown): string {
  const status = (err as { statusCode?: number } | null)?.statusCode;
  if (status === 400) return "Check your email address and try again.";
  if (status === 404) return "This booking page isn’t available anymore.";
  if (status === 429) return "Too many tries. Wait a few minutes, then try again.";
  return "We couldn’t add you to the waitlist. Try again.";
}

export default function WaitlistJoinSheet({
  open,
  onClose,
  hostName,
  eventTypeName,
  pillar = "personal",
  preview = false,
  defaultEmail,
  defaultName,
  onJoin,
}: {
  open: boolean;
  onClose: () => void;
  hostName?: string;
  eventTypeName?: string;
  pillar?: Pillar;
  preview?: boolean;
  /** A signed-in visitor's email, filled in when the field is still empty. */
  defaultEmail?: string;
  /** A signed-in visitor's name, filled in when the field is still empty. */
  defaultName?: string;
  onJoin?: (data: {
    email: string;
    name: string;
  }) => Promise<WaitlistJoinResult>;
}) {
  const tk = pillarTokens(pillar);
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [name, setName] = useState(defaultName ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WaitlistJoinResult | null>(null);
  // State updates land after the click that set them, so a second click in the
  // same moment would still see `submitting === false`. The ref blocks it.
  const inFlight = useRef(false);

  useEffect(() => {
    if (defaultEmail) setEmail((v) => v || defaultEmail);
  }, [defaultEmail]);
  useEffect(() => {
    if (defaultName) setName((v) => v || defaultName);
  }, [defaultName]);

  if (!open) return null;

  const host = hostName || "the host";
  const canSubmit =
    !preview && EMAIL_SHAPE.test(email.trim()) && !!onJoin;

  const submit = async () => {
    if (!onJoin || !canSubmit || inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const r = await onJoin({
        email: email.trim(),
        name: name.trim(),
      });
      setResult(r);
    } catch (err) {
      setError(joinErrorMessage(err));
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  // Joined / already-on-waitlist confirmation
  if (result) {
    const already = result.alreadyJoined;
    const notifyLine =
      result.notifyVia === "app"
        ? `We’ll notify you in Pantopus if ${host} opens a spot.`
        : result.notifyVia === "email"
          ? `We’ll email you if ${host} opens a spot.`
          : `We’ll let you know if ${host} opens a spot.`;
    const alreadySubtitle = result.joinedAt
      ? `You joined this waitlist on ${fmtDate(result.joinedAt)}. ${notifyLine}`
      : notifyLine;
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        footer={
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-app-border bg-app-surface px-4 py-3 text-sm font-semibold text-app-text-strong transition hover:bg-app-hover"
          >
            Done
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
              {already ? alreadySubtitle : notifyLine}
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
          No open times
        </span>
        <h3 className="text-base font-bold text-app-text">
          {eventTypeName ? `Waitlist for ${eventTypeName}` : "Join the waitlist"}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-app-text-secondary">
          Join the waitlist and we’ll let you know if {host} opens a spot.
        </p>

        {preview && (
          <p className="mt-3 rounded-lg bg-app-surface-sunken px-3 py-2 text-xs font-medium text-app-text-muted">
            Preview — this is what invitees see. Submitting is disabled here.
          </p>
        )}

        <div className="mt-4 space-y-3">
          <Field label="Email">
            <TextInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
              required
              disabled={preview || submitting}
            />
          </Field>
          <Field label="Your name">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Optional"
              autoComplete="name"
              disabled={preview || submitting}
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
