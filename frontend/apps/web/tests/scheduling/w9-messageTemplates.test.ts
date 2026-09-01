// W9 · E7 + E11 — Message composer helpers (templates, limit, audience sizing).

import {
  NUDGE_LIMIT,
  audienceCount,
  canSendNudge,
  charsRemaining,
  followUpTemplate,
  isOverLimit,
} from "@/components/scheduling/bookings-extras/messageTemplates";
import type { BookingAttendee } from "@pantopus/types";

function att(rsvp: BookingAttendee["rsvp_status"]): BookingAttendee {
  return { rsvp_status: rsvp } as BookingAttendee;
}

describe("followUpTemplate", () => {
  it("greets by first name when known", () => {
    expect(followUpTemplate("completed", "Mara Reyes")).toMatch(/^Hi Mara —/);
  });
  it("works without a name", () => {
    const t = followUpTemplate("no_show");
    expect(t).toMatch(/sorry we missed/i);
    expect(t.startsWith("Hi")).toBe(false);
  });
  it("has copy for every outcome", () => {
    expect(followUpTemplate("completed")).not.toBe("");
    expect(followUpTemplate("no_show")).not.toBe("");
    expect(followUpTemplate("rebook")).not.toBe("");
  });
});

describe("character limit", () => {
  it("counts remaining down from the limit", () => {
    expect(charsRemaining("")).toBe(NUDGE_LIMIT);
    expect(charsRemaining("hello")).toBe(NUDGE_LIMIT - 5);
  });
  it("flags over-limit", () => {
    expect(isOverLimit("a".repeat(NUDGE_LIMIT))).toBe(false);
    expect(isOverLimit("a".repeat(NUDGE_LIMIT + 1))).toBe(true);
  });
});

describe("audienceCount", () => {
  const attendees = [
    att("going"),
    att("going"),
    att("pending"),
    att("declined"),
  ];
  it("'all' excludes declined", () => {
    expect(audienceCount("all", attendees)).toBe(3);
  });
  it("'confirmed' counts only going", () => {
    expect(audienceCount("confirmed", attendees)).toBe(2);
  });
  it("'no_shows' counts declined", () => {
    expect(audienceCount("no_shows", attendees)).toBe(1);
  });
});

describe("canSendNudge", () => {
  it("requires recipients, content, and within-limit", () => {
    expect(canSendNudge("hi", 3)).toBe(true);
    expect(canSendNudge("hi", 0)).toBe(false); // no recipients
    expect(canSendNudge("   ", 3)).toBe(false); // blank
    expect(canSendNudge("a".repeat(NUDGE_LIMIT + 1), 3)).toBe(false); // over
  });
});
