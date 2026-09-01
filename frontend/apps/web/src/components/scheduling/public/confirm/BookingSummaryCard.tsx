// W6 — the booking summary card (who / what / when / where), shared across the
// intake (D1), review (D2), confirmed (D3), and manage (D4) surfaces. Mirrors
// the A09.4 Invoice summary-card rhythm: identity row, calendar + timezone chip,
// location, attendees, and an optional collapsible answers disclosure. Pillar
// accents come from the host's identity tokens only. Presentational — no fetch.

"use client";

import { useState } from "react";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Globe,
  MapPin,
  MessageSquareText,
  Phone,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";
import type { EventTypeLocationMode } from "@pantopus/types";
import { pillarTokens, type Pillar } from "@/components/scheduling";
import {
  formatSlotRange,
  initialsFromName,
  locationLabel,
  pillarLabel,
  tzChipLabel,
} from "./confirmUtils";

export interface SummaryAnswer {
  label: string;
  value: string;
}

interface BookingSummaryCardProps {
  hostName: string;
  eventName: string;
  pillar: Pillar;
  startISO: string;
  endISO: string;
  tz: string;
  locationMode?: EventTypeLocationMode | null;
  locationDetail?: string | null;
  inviteeName?: string | null;
  guests?: string[];
  answers?: SummaryAnswer[];
  /** Render the small "Personal/Home/Business" tag beside the host. */
  showPillarTag?: boolean;
  /** "Edit" affordance (e.g. back to the slot picker). Omit to hide. */
  onEdit?: () => void;
  /** When set, the timezone chip becomes a "Change" control (D1/D2 only). */
  onChangeTz?: () => void;
  dimmed?: boolean;
  struck?: boolean;
  className?: string;
}

function locationIconFor(mode?: EventTypeLocationMode | null): LucideIcon {
  switch (mode) {
    case "video":
      return Video;
    case "phone":
      return Phone;
    case "in_person":
      return MapPin;
    default:
      return Globe;
  }
}

function Row({
  icon: Icon,
  last,
  children,
}: {
  icon: LucideIcon;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        "flex items-start gap-2.5 py-2.5",
        !last && "border-b border-app-border-subtle",
      )}
    >
      <Icon
        className="mt-0.5 h-[15px] w-[15px] shrink-0 text-app-text-secondary"
        aria-hidden
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export default function BookingSummaryCard({
  hostName,
  eventName,
  pillar,
  startISO,
  endISO,
  tz,
  locationMode,
  locationDetail,
  inviteeName,
  guests = [],
  answers = [],
  showPillarTag = true,
  onEdit,
  onChangeTz,
  dimmed,
  struck,
  className,
}: BookingSummaryCardProps) {
  const tk = pillarTokens(pillar);
  const [answersOpen, setAnswersOpen] = useState(false);
  const LocationIcon = locationIconFor(locationMode);
  const loc = locationLabel(locationMode, locationDetail);
  const strike = struck ? "line-through decoration-app-text-muted" : "";
  const cleanGuests = guests.map((g) => g.trim()).filter(Boolean);
  const hasAttendees = Boolean(inviteeName) || cleanGuests.length > 0;

  return (
    <div
      className={clsx(
        "rounded-2xl border border-app-border bg-app-surface px-3.5 shadow-sm",
        dimmed && "opacity-60",
        className,
      )}
    >
      {/* Identity */}
      <div className="flex items-center gap-3 border-b border-app-border-subtle py-3">
        <span
          className={clsx(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
            tk.bg,
          )}
          aria-hidden
        >
          {initialsFromName(hostName)}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={clsx("truncate text-sm font-bold text-app-text", strike)}
          >
            {eventName}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="truncate text-xs text-app-text-secondary">
              with {hostName}
            </span>
            {showPillarTag && (
              <span className="inline-flex items-center gap-1">
                <span
                  className={clsx("h-1.5 w-1.5 rounded-full", tk.bg)}
                  aria-hidden
                />
                <span className={clsx("text-[10px] font-semibold", tk.text)}>
                  {pillarLabel(pillar)}
                </span>
              </span>
            )}
          </div>
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className={clsx(
              "shrink-0 rounded px-1 text-xs font-bold hover:underline",
              tk.text,
            )}
          >
            Edit
          </button>
        )}
      </div>

      {/* When */}
      <Row
        icon={Calendar}
        last={!locationMode && !hasAttendees && answers.length === 0}
      >
        <p
          className={clsx(
            "text-[13px] font-semibold tabular-nums text-app-text",
            strike,
          )}
        >
          {formatSlotRange(startISO, endISO, tz)}
        </p>
        {onChangeTz ? (
          <button
            type="button"
            onClick={onChangeTz}
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold hover:opacity-90"
            style={{ background: "var(--color-primary-100)", color: "var(--color-primary-700)" }}
          >
            <Globe className="h-3 w-3" aria-hidden />
            {tzChipLabel(tz, startISO)}
            <span className="font-bold">Change</span>
          </button>
        ) : (
          <span
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold"
            style={{ background: "var(--color-primary-100)", color: "var(--color-primary-700)" }}
          >
            <Globe className="h-3 w-3" aria-hidden />
            {tzChipLabel(tz, startISO)}
          </span>
        )}
      </Row>

      {/* Where */}
      {locationMode && (
        <Row icon={LocationIcon} last={!hasAttendees && answers.length === 0}>
          <p className="text-[13px] font-semibold text-app-text">{loc.label}</p>
          {loc.sub && (
            <p className="mt-0.5 text-xs text-app-text-secondary">{loc.sub}</p>
          )}
        </Row>
      )}

      {/* Who */}
      {hasAttendees && (
        <Row icon={Users} last={answers.length === 0}>
          {inviteeName && (
            <p className="text-[13px] font-semibold text-app-text">
              {inviteeName}{" "}
              <span className="font-medium text-app-text-secondary">(you)</span>
            </p>
          )}
          {cleanGuests.length > 0 && (
            <p className="mt-0.5 text-xs text-app-text-secondary">
              {inviteeName ? "+ " : ""}
              {cleanGuests.join(", ")}
            </p>
          )}
        </Row>
      )}

      {/* Answers disclosure */}
      {answers.length > 0 && (
        <div className="py-2.5">
          <button
            type="button"
            onClick={() => setAnswersOpen((v) => !v)}
            aria-expanded={answersOpen}
            className="flex w-full items-center gap-2.5 text-left"
          >
            <MessageSquareText
              className="h-[15px] w-[15px] shrink-0 text-app-text-secondary"
              aria-hidden
            />
            <span className="flex-1 text-[13px] font-semibold text-app-text">
              Your answers
            </span>
            <span className="text-xs text-app-text-muted">
              {answers.length}
            </span>
            {answersOpen ? (
              <ChevronUp
                className="h-[15px] w-[15px] text-app-text-muted"
                aria-hidden
              />
            ) : (
              <ChevronDown
                className="h-[15px] w-[15px] text-app-text-muted"
                aria-hidden
              />
            )}
          </button>
          {answersOpen && (
            <dl className="mt-2.5 space-y-2.5 pl-[25px]">
              {answers.map((a, i) => (
                <div key={i}>
                  <dt className="text-[10.5px] font-semibold text-app-text-secondary">
                    {a.label}
                  </dt>
                  <dd className="mt-0.5 text-xs leading-4 text-app-text">
                    {a.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </div>
  );
}
