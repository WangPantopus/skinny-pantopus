"use client";

// W8 — a single booking row in the inbox. White card, no left accent: verified
// invitee avatar, event type, day·time·tz, status chip, owner-context glyph and
// (on Business) an assigned-member chip, plus a kebab. Pending rows can render
// inline Decline / Approve quick actions.

import Link from "next/link";
import clsx from "clsx";
import { Check, MoreVertical, X } from "lucide-react";
import type { Booking } from "@pantopus/types";
import BookingStatusPill from "@/components/scheduling/BookingStatusPill";
import {
  PRIMARY_BLUE_CLS,
  type Pillar,
} from "@/components/scheduling/pillarTokens";
import { Avatar, AssignedChip, OwnerGlyph } from "./primitives";
import { formatWhen, inviteeDisplay, viewerTz } from "./format";

export interface InboxRow {
  booking: Booking;
  pillar: Pillar;
  ownerLabel: string;
  eventName: string;
  assignedLabel?: string | null;
}

export default function BookingRow({
  row,
  href,
  tz = viewerTz(),
  unread = false,
  quickActions = false,
  busy = false,
  onApprove,
  onDecline,
}: {
  row: InboxRow;
  href: string;
  tz?: string;
  unread?: boolean;
  quickActions?: boolean;
  busy?: boolean;
  onApprove?: () => void;
  onDecline?: () => void;
}) {
  const { booking, pillar, ownerLabel, eventName, assignedLabel } = row;
  const showActions = quickActions && !!onApprove && !!onDecline;

  return (
    <div className="rounded-2xl border border-app-border bg-app-surface p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <Link href={href} className="flex min-w-0 flex-1 items-start gap-3">
          <Avatar pillar={pillar} name={booking.invitee_name} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {unread && (
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-app-warning"
                  aria-hidden
                />
              )}
              <span className="truncate text-[13px] font-bold text-app-text">
                {inviteeDisplay(booking.invitee_name)}
              </span>
            </div>
            <div className="mt-0.5 truncate text-xs text-app-text-secondary">
              {eventName}
            </div>
            <div className="mt-0.5 text-[11px] text-app-text-muted">
              {formatWhen(booking.start_at, tz)}
            </div>
            {(ownerLabel || assignedLabel) && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                {ownerLabel && (
                  <OwnerGlyph pillar={pillar} label={ownerLabel} />
                )}
                {assignedLabel && <AssignedChip label={assignedLabel} />}
              </div>
            )}
          </div>
        </Link>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <BookingStatusPill status={booking.status} />
          <Link
            href={href}
            aria-label="Open booking"
            className="flex h-6 w-6 items-center justify-center rounded text-app-text-muted hover:bg-app-hover hover:text-app-text"
          >
            <MoreVertical className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>

      {showActions && (
        <div className="mt-2.5 flex gap-2 border-t border-app-border pt-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={onDecline}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-app-border bg-app-surface text-xs font-bold text-app-text-secondary transition hover:bg-app-hover disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Decline
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onApprove}
            className={clsx(
              "inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition disabled:opacity-60",
              PRIMARY_BLUE_CLS.bg,
              PRIMARY_BLUE_CLS.textOn,
            )}
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
            Approve
          </button>
        </div>
      )}
    </div>
  );
}
