// E7 (follow-up) + E11 (nudge): the message composer's pure helpers — outcome
// templates, the character limit + counter, and audience sizing. The nudge
// backend (POST /bookings/:id/nudge) takes an optional message (<= 1000 chars);
// we keep the composer to a friendlier 280 so a nudge stays short.

import type { BookingAttendee } from "@pantopus/types";

export const NUDGE_LIMIT = 280;

export type FollowUpOutcome = "completed" | "no_show" | "rebook";

export const FOLLOWUP_OUTCOMES: ReadonlyArray<{
  id: FollowUpOutcome;
  label: string;
}> = [
  { id: "completed", label: "Completed" },
  { id: "no_show", label: "No-show" },
  { id: "rebook", label: "Rebook needed" },
];

/** Plainspoken starter copy for a chosen outcome (sentence case, no exclaims). */
export function followUpTemplate(
  outcome: FollowUpOutcome,
  inviteeName?: string | null,
): string {
  const name = inviteeName?.trim().split(/\s+/)[0];
  const hi = name ? `Hi ${name} — ` : "";
  switch (outcome) {
    case "completed":
      return `${hi}thanks for the time today, good to connect. Want to book again?`;
    case "no_show":
      return `${hi}sorry we missed each other today. Here's a link to grab another time.`;
    case "rebook":
      return `${hi}let's find a better time. Here's a link to rebook whenever works for you.`;
    default:
      return "";
  }
}

export type NudgeAudience = "all" | "confirmed" | "no_shows";

export const NUDGE_AUDIENCES: ReadonlyArray<{
  id: NudgeAudience;
  label: string;
}> = [
  { id: "all", label: "All attendees" },
  { id: "confirmed", label: "Confirmed only" },
  { id: "no_shows", label: "No-shows" },
];

/** How many recipients an audience resolves to (drives "Send to N" + disabling). */
export function audienceCount(
  audience: NudgeAudience,
  attendees: BookingAttendee[],
): number {
  switch (audience) {
    case "confirmed":
      return attendees.filter((a) => a.rsvp_status === "going").length;
    case "no_shows":
      return attendees.filter((a) => a.rsvp_status === "declined").length;
    case "all":
    default:
      return attendees.filter((a) => a.rsvp_status !== "declined").length;
  }
}

export function charsRemaining(text: string): number {
  return NUDGE_LIMIT - text.length;
}

export function isOverLimit(text: string): boolean {
  return text.length > NUDGE_LIMIT;
}

/** A nudge is sendable when it has recipients and a within-limit message. */
export function canSendNudge(text: string, recipientCount: number): boolean {
  return recipientCount > 0 && !isOverLimit(text) && text.trim().length > 0;
}
