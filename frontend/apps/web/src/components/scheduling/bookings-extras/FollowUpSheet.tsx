"use client";

// E7 — Post-Meeting Follow-up. Opened on a past booking. Pick an outcome to
// start from a plainspoken template, edit the message, and send it to the
// invitee via POST /bookings/:id/nudge. Rebooking links use the existing
// owner-scoped one-off endpoint; drafts are scoped to one open booking.

import { useEffect, useRef, useState } from "react";
import { Check, CheckCircle2, Link2, RotateCw, Send } from "lucide-react";
import clsx from "clsx";
import * as api from "@pantopus/api";
import type { SchedulingOwnerRef } from "@pantopus/types";
import { APP_WEB_URL, buildOneOffBookingPath } from "@pantopus/utils";
import { ownerKey } from "@/components/scheduling/bookings/owners";
import BottomSheet from "@/components/ui/BottomSheet";
import { decodeError } from "@/components/scheduling/decodeError";
import { pillarTokens, type Pillar } from "@/components/scheduling/pillarTokens";
import { InlineError, SectionOverline, TextArea } from "./ui";
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
  eventTypeId?: string | null;
}

interface FollowUpSheetProps {
  open: boolean;
  onClose: () => void;
  booking: FollowUpTarget | null;
  owner: SchedulingOwnerRef;
  pillar?: Pillar;
  onSent?: () => void;
}

export default function FollowUpSheet(props: FollowUpSheetProps) {
  if (!props.open || !props.booking) return null;
  return (
    <FollowUpComposer
      key={`${ownerKey(props.owner)}:${props.booking.id}`}
      {...props}
      booking={props.booking}
    />
  );
}

function FollowUpComposer({
  open,
  onClose,
  booking,
  owner,
  pillar = "personal",
  onSent,
}: FollowUpSheetProps & { booking: FollowUpTarget }) {
  const [outcome, setOutcome] = useState<FollowUpOutcome | null>(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [didSend, setDidSend] = useState(false);
  const [creatingLink, setCreatingLink] = useState(false);
  const [rebookLink, setRebookLink] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const active = useRef(false);
  const inFlight = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const tk = pillarTokens(pillar);

  const pickOutcome = (o: FollowUpOutcome) => {
    setOutcome(o);
    // Only overwrite when the message is empty or still a template.
    const withLink = (draft: string) => rebookLink ? `${draft}\n\n${rebookLink}` : draft;
    const isTemplate = FOLLOWUP_OUTCOMES.some(
      (x) => withLink(followUpTemplate(x.id, booking.inviteeName)) === text,
    );
    if (!text.trim() || isTemplate) {
      setText(withLink(followUpTemplate(o, booking.inviteeName)));
    }
  };

  const over = isOverLimit(text);
  const sendable = text.trim().length > 0 && !over;
  const linkAdded = !!rebookLink && text.includes(rebookLink);

  const addRebookLink = async () => {
    if (inFlight.current || !booking.eventTypeId || linkAdded) return;
    if (rebookLink) {
      setText((draft) => `${draft.trim()}${draft.trim() ? "\n\n" : ""}${rebookLink}`);
      return;
    }
    inFlight.current = true;
    setCreatingLink(true);
    setLinkError(null);
    try {
      const link = await api.scheduling.createOneOffLink(
        { event_type_id: booking.eventTypeId },
        owner,
      );
      if (!active.current) return;
      const url = `${APP_WEB_URL}${link.path || buildOneOffBookingPath(link.token)}`;
      setRebookLink(url);
      setText((draft) => `${draft.trim()}${draft.trim() ? "\n\n" : ""}${url}`);
    } catch {
      if (active.current) setLinkError("Couldn't create a rebooking link. Try again.");
    } finally {
      if (active.current) {
        inFlight.current = false;
        setCreatingLink(false);
      }
    }
  };

  const submit = async () => {
    if (inFlight.current || !sendable) return;
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await api.scheduling.nudgeBooking(booking.id, text.trim(), owner);
      if (!active.current) return;
      setDidSend(true);
      onSent?.();
      closeTimer.current = setTimeout(() => {
        if (active.current) onClose();
      }, 1500);
    } catch (err) {
      if (active.current) setError(decodeError(err).message);
    } finally {
      if (active.current) {
        inFlight.current = false;
        setSubmitting(false);
      }
    }
  };

  // ── Success overlay (Frame 4) ────────────────────────────────
  if (didSend) {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
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
        <button
          type="button"
          onClick={submit}
          disabled={!sendable || submitting || creatingLink}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-app-surface-sunken disabled:text-app-text-muted"
        >
          {error ? (
            <RotateCw className="h-4 w-4" aria-hidden />
          ) : (
            <Send className="h-4 w-4" aria-hidden />
          )}
          {submitting ? "Sending…" : error ? "Try again" : "Send follow-up"}
        </button>
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
            onClick={addRebookLink}
            disabled={submitting || creatingLink || !booking.eventTypeId || linkAdded}
            className="mt-2 inline-flex h-7 items-center gap-1.5 rounded-full border border-app-border bg-app-surface px-3 text-[11px] font-semibold text-primary-600"
          >
            <Link2 className="h-3 w-3" aria-hidden />
            {creatingLink ? "Creating link…" : linkAdded ? "Link added" : linkError ? "Try link again" : "Add rebooking link"}
          </button>
        </div>

        {over && <InlineError message="Keep your message to 280 characters or fewer." />}
        {linkError && <InlineError message={linkError} />}
        {error && <InlineError message={error} />}
      </div>
    </BottomSheet>
  );
}
