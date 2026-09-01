"use client";

// W8 · E2 — the scrollable booking-detail body: header + identity strip, a
// status-specific banner, requester / assigned / location / intake cards, and a
// lifecycle timeline. The sticky action dock + overflow + sheets live in the
// page; this is the read surface.

import { useState } from "react";
import {
  Activity,
  ChevronDown,
  CircleSlash,
  HelpCircle,
  MapPin,
  MessageCircle,
  Phone,
  Receipt,
  User,
  UserRound,
  UserX,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import clsx from "clsx";
import type { BookingDetail, EventTypeLocationMode } from "@pantopus/types";
import {
  pillarTokens,
  type Pillar,
} from "@/components/scheduling/pillarTokens";
import {
  Avatar,
  Banner,
  IdentityStrip,
  InfoRow,
  SectionCard,
  Timeline,
  type TimelineStep,
} from "./primitives";
import {
  durationLabel,
  formatRange,
  formatWhen,
  inviteeDisplay,
} from "./format";
import { isPast } from "./bookingActions";

const LOCATION: Record<
  EventTypeLocationMode,
  { icon: LucideIcon; label: string }
> = {
  video: { icon: Video, label: "Video call" },
  phone: { icon: Phone, label: "Phone call" },
  in_person: { icon: MapPin, label: "In person" },
  custom: { icon: MapPin, label: "Custom location" },
  ask: { icon: HelpCircle, label: "Location to be decided" },
};

export default function BookingDetailView({
  detail,
  pillar,
  tz,
  ownerLabel,
}: {
  detail: BookingDetail;
  pillar: Pillar;
  tz: string;
  ownerLabel: string;
}) {
  const { booking, eventType } = detail;
  const tk = pillarTokens(pillar);
  const past = isPast(booking);
  const title = eventType?.name || "Booking";
  const loc = eventType?.location_mode
    ? LOCATION[eventType.location_mode]
    : null;
  const intakeEntries = booking.intake_answers
    ? Object.entries(booking.intake_answers)
    : [];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold leading-tight text-app-text-strong">
          {title}
        </h1>
        <p className="mt-1 text-sm font-medium text-app-text-secondary">
          {formatRange(booking.start_at, booking.end_at, tz)}
        </p>
        <div className="mt-2.5">
          <IdentityStrip pillar={pillar} label={ownerLabel} />
        </div>
      </div>

      {/* Status banner */}
      {booking.status === "cancelled" && (
        <Banner tone="neutral" icon={CircleSlash}>
          Cancelled
          {booking.cancel_reason ? ` · ${booking.cancel_reason}` : ""}
        </Banner>
      )}
      {/* Dedicated Refund card for cancelled bookings (design Frame 4) */}
      {booking.status === "cancelled" && booking.refund_issued && (
        <SectionCard overline="Refund" icon={Receipt} accentClass="text-app-text-muted">
          <div className="flex items-center justify-between">
            <span className="text-sm text-app-text-secondary">
              Refunded to card
            </span>
            <span className="text-sm font-bold text-app-success tabular-nums">
              Refunded
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-app-text-muted">
            Full refund issued · within free-cancellation window
          </p>
        </SectionCard>
      )}

      {booking.status === "declined" && (
        <Banner tone="neutral" icon={CircleSlash}>
          Request declined
          {booking.cancel_reason ? ` · ${booking.cancel_reason}` : ""}
        </Banner>
      )}
      {booking.status === "no_show" && (
        <Banner tone="error" icon={UserX}>
          Marked no-show
          {booking.no_show_fee_applied ? " · no-show fee applied" : ""}
        </Banner>
      )}

      {/* Requester */}
      <SectionCard overline="Requester" icon={User} accentClass={tk.text}>
        <div className="flex items-center gap-3">
          <Avatar pillar={pillar} name={booking.invitee_name} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-app-text">
              {inviteeDisplay(booking.invitee_name)}
            </div>
            <div className="truncate text-xs text-app-text-muted">
              {booking.invitee_email || "Verified requester"}
            </div>
          </div>
          {booking.invitee_email && (
            <a
              href={`mailto:${booking.invitee_email}`}
              aria-label={`Email ${inviteeDisplay(booking.invitee_name)}`}
              className={clsx(
                "flex h-9 w-9 items-center justify-center rounded-lg border border-app-border bg-app-surface transition hover:bg-app-hover",
                tk.text,
              )}
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
            </a>
          )}
        </div>
      </SectionCard>

      {/* Assigned member (business/home, when assigned) */}
      {pillar !== "personal" && booking.host_user_id && (
        <SectionCard
          overline="Assigned member"
          icon={UserRound}
          accentClass={tk.text}
        >
          <InfoRow
            icon={UserRound}
            value="Team member"
            label="Assigned"
            accentClass={tk.text}
          />
        </SectionCard>
      )}

      {/* Location */}
      {loc && (
        <SectionCard overline="Location" icon={loc.icon} accentClass={tk.text}>
          <InfoRow
            icon={loc.icon}
            value={loc.label}
            label={
              durationLabel(booking.start_at, booking.end_at) ||
              "Details on confirm"
            }
            accentClass={tk.text}
          />
        </SectionCard>
      )}

      {/* Intake answers */}
      {intakeEntries.length > 0 && (
        <SectionCard>
          <IntakeAnswers entries={intakeEntries} />
        </SectionCard>
      )}

      {/* Lifecycle timeline */}
      <SectionCard overline="Status" icon={Activity} accentClass={tk.text}>
        <Timeline steps={buildTimeline(detail, tz, past)} />
      </SectionCard>
    </div>
  );
}

function IntakeAnswers({ entries }: { entries: Array<[string, unknown]> }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-app-surface-sunken">
          <Receipt className="h-4 w-4 text-app-text-secondary" aria-hidden />
        </span>
        <span className="flex-1 text-left">
          <span className="block text-sm font-semibold text-app-text">
            Intake answers
          </span>
          <span className="block text-xs text-app-text-muted">
            {entries.length} {entries.length === 1 ? "answer" : "answers"}
          </span>
        </span>
        <ChevronDown
          className={clsx(
            "h-[18px] w-[18px] text-app-text-muted transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open && (
        <dl className="mt-3 space-y-2.5 border-t border-app-border pt-3">
          {entries.map(([key, value]) => (
            <div key={key}>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-app-text-muted">
                {key}
              </dt>
              <dd className="mt-0.5 text-sm text-app-text">
                {formatAnswer(value)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function formatAnswer(value: unknown): string {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function buildTimeline(
  detail: BookingDetail,
  tz: string,
  past: boolean,
): TimelineStep[] {
  const { booking } = detail;
  const steps: TimelineStep[] = [
    {
      label: "Requested",
      time: formatWhen(booking.created_at, tz),
      done: true,
    },
  ];

  if (booking.status === "pending") {
    steps.push({ label: "Awaiting approval", done: false });
  } else if (booking.status === "declined") {
    steps.push({ label: "Declined", done: true, tone: "error" });
    return steps;
  } else if (booking.status === "cancelled") {
    steps.push({ label: "Confirmed", done: true });
    steps.push({ label: "Cancelled", done: true, tone: "error" });
    return steps;
  } else {
    steps.push({ label: "Confirmed", done: true });
  }

  const met = past && booking.status !== "pending";
  steps.push({
    label: met ? "Met" : "Meeting",
    time: formatWhen(booking.start_at, tz),
    done: met && booking.status !== "no_show",
  });

  if (booking.status === "no_show") {
    steps.push({ label: "No-show", done: true, tone: "error" });
  }

  return steps;
}
