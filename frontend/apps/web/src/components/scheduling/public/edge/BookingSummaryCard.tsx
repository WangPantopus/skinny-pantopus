"use client";

// The compact booking recap card shown at the top of every manage/edge surface
// (reschedule, cancel, policy-blocked, states). Host avatar + event name +
// pillar dot, the date/time line with a tz chip, and the W0 status pill.
// Mirrors the "Your booking" summary card from the policy-blocked design.

import clsx from "clsx";
import { Calendar, Globe } from "lucide-react";
import type { Booking, PublicEventType, PublicPageView } from "@pantopus/types";
import {
  BookingStatusPill,
  pillarTokens,
  type Pillar,
} from "@/components/scheduling";
import { formatRange, hostName, tzAbbrev } from "./edgeUtils";

function initials(name?: string | null): string {
  const n = (name || "").trim();
  if (!n) return "•";
  const parts = n.split(/\s+/);
  return (parts[0]?.[0] || "") + (parts[1]?.[0] || "");
}

export default function BookingSummaryCard({
  booking,
  eventType,
  page,
  tz,
  pillar,
  className,
}: {
  booking: Pick<Booking, "status" | "start_at" | "end_at" | "invitee_name">;
  eventType?: Pick<PublicEventType, "name"> | null;
  page?: Pick<PublicPageView, "title" | "owner_type"> | null;
  tz?: string;
  pillar: Pillar;
  className?: string;
}) {
  const tk = pillarTokens(pillar);
  const host = hostName(page?.title);
  const pillarLabel =
    pillar === "home"
      ? "Home"
      : pillar === "business"
        ? "Business"
        : "Personal";

  return (
    <div
      className={clsx(
        "rounded-2xl border border-app-border bg-app-surface p-3 shadow-sm",
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-app-border-subtle pb-3">
        <span
          className={clsx(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase",
            tk.bg,
            tk.textOn,
          )}
          aria-hidden
        >
          {initials(host)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-app-text-strong">
            {eventType?.name || "Your booking"}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-app-text-muted">
            <span className="truncate">{host}</span>
            <span
              className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", tk.bg)}
              aria-hidden
            />
            <span className={clsx("shrink-0 font-semibold", tk.text)}>
              {pillarLabel}
            </span>
          </p>
        </div>
        <BookingStatusPill status={booking.status} />
      </div>
      <div className="flex items-center gap-2 pt-3">
        <Calendar
          className="h-4 w-4 shrink-0 text-app-text-muted"
          aria-hidden
        />
        <span className="text-[13px] font-semibold tabular-nums text-app-text">
          {formatRange(booking.start_at, booking.end_at, tz)}
        </span>
        <span className="flex-1" />
        {tz && (
          <span
            className={clsx(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
              tk.bgSoft,
              tk.text,
            )}
          >
            <Globe className="h-2.5 w-2.5" aria-hidden />
            {tzAbbrev(tz)}
          </span>
        )}
      </div>
    </div>
  );
}
