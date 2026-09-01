"use client";

// W2 — Event Types. B1 list row: accent dot, name (+ team badge), meta line
// (duration · location · price), product-blue active toggle, and an overflow
// menu (copy link, duplicate, share, hide/show, delete). Tokens-only chrome;
// the accent dot uses the event type's own data color.
// B1 FRAME 6 (`reorder`): a leading grip-vertical handle replaces the overflow
// button, row interactions freeze, and the dragged row lifts (shadow + tilt)
// while the rest dim to 0.55.

import { useState } from "react";
import clsx from "clsx";
import {
  Copy,
  EllipsisVertical,
  EyeOff,
  Eye,
  GripVertical,
  Link2,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import type { EventType } from "@pantopus/types";
import { Toggle } from "./fields";

const LOCATION_LABEL: Record<string, string> = {
  video: "Video",
  phone: "Phone",
  in_person: "In person",
  custom: "Custom",
  ask: "Ask invitee",
};

export function metaLine(et: EventType, showPrice: boolean): string {
  const parts = [`${et.default_duration} min`];
  parts.push(LOCATION_LABEL[et.location_mode] ?? "Video");
  if (showPrice && et.price_cents > 0) {
    parts.push(formatPrice(et.price_cents, et.currency));
  }
  return parts.join(" · ");
}

export function formatPrice(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(0)}`;
  }
}

const isTeam = (mode: EventType["assignment_mode"]) =>
  mode === "round_robin" || mode === "collective" || mode === "group";

export default function EventTypeCard({
  eventType,
  showPrice,
  busy,
  disabled,
  reorder,
  lifted,
  dimmed,
  onOpen,
  onToggleActive,
  onCopyLink,
  onDuplicate,
  onShare,
  onDelete,
}: {
  eventType: EventType;
  showPrice: boolean;
  busy?: boolean;
  disabled?: boolean;
  /** FRAME 6 reorder mode: leading grip, overflow hidden, toggle inert. */
  reorder?: boolean;
  /** The row currently being dragged (blue border, shadow, slight lift). */
  lifted?: boolean;
  /** Non-dragged rows dim to 55% while a drag is active. */
  dimmed?: boolean;
  onOpen: () => void;
  onToggleActive: () => void;
  onCopyLink?: () => void;
  onDuplicate: () => void;
  onShare?: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const et = eventType;

  const close = () => setMenuOpen(false);
  const run = (fn?: () => void) => {
    close();
    fn?.();
  };

  const menuItems = [
    onCopyLink && {
      icon: Link2,
      label: "Copy booking link",
      onClick: onCopyLink,
      primary: true,
    },
    { icon: Copy, label: "Duplicate", onClick: onDuplicate },
    onShare && { icon: Share2, label: "Share", onClick: onShare },
    {
      icon: et.is_active ? EyeOff : Eye,
      label: et.is_active ? "Hide" : "Show",
      onClick: onToggleActive,
    },
    { icon: Trash2, label: "Delete", onClick: onDelete, danger: true },
  ].filter(Boolean) as Array<{
    icon: typeof Copy;
    label: string;
    onClick: () => void;
    primary?: boolean;
    danger?: boolean;
  }>;

  return (
    <div
      className={clsx(
        "relative flex items-center gap-3 rounded-[14px] border bg-app-surface p-3 transition",
        lifted
          ? "z-10 -translate-y-0.5 scale-[1.012] border-primary-200 shadow-xl"
          : "border-app-border shadow-sm",
        busy && "opacity-60",
        !et.is_active && !dimmed && "opacity-90",
        dimmed && "opacity-[0.55]",
      )}
    >
      {reorder && (
        <GripVertical
          className="h-4 w-4 shrink-0 cursor-grab text-app-text-muted"
          aria-hidden
        />
      )}
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: et.color ?? "#0284c7" }}
        aria-hidden
      />

      <button
        type="button"
        onClick={onOpen}
        disabled={disabled || reorder}
        className="min-w-0 flex-1 text-left disabled:cursor-not-allowed"
      >
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13.5px] font-semibold text-app-text">
            {et.name}
          </span>
          {isTeam(et.assignment_mode) && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-app-surface-sunken px-1.5 py-0.5 text-[9.5px] font-bold text-app-text-secondary">
              <Users className="h-2.5 w-2.5" strokeWidth={2.4} aria-hidden />
              {/* "N hosts" per the design frame; "Team" only when the response
                  predates the aggregated assignee_count (single-row fetches). */}
              {typeof et.assignee_count === "number" && et.assignee_count > 0
                ? `${et.assignee_count} ${et.assignee_count === 1 ? "host" : "hosts"}`
                : "Team"}
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-app-text-secondary">
          {metaLine(et, showPrice)}
        </span>
      </button>

      <Toggle
        on={et.is_active}
        onChange={disabled || reorder ? undefined : onToggleActive}
        disabled={disabled || busy || reorder}
        label={`${et.is_active ? "Hide" : "Show"} ${et.name}`}
      />

      {!disabled && !reorder && (
        <div className="relative">
          <button
            type="button"
            aria-label="More actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-app-text-muted hover:bg-app-hover"
          >
            <EllipsisVertical className="h-4 w-4" aria-hidden />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={close} aria-hidden />
              <div
                role="menu"
                className="absolute right-0 top-9 z-30 w-48 overflow-hidden rounded-xl border border-app-border bg-app-surface p-1 shadow-lg"
              >
                {menuItems.map((it) => {
                  const Icon = it.icon;
                  return (
                    <button
                      key={it.label}
                      type="button"
                      role="menuitem"
                      onClick={() => run(it.onClick)}
                      className={clsx(
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium transition",
                        it.danger
                          ? "mt-1 border-t border-app-border text-app-error hover:bg-app-error-bg"
                          : it.primary
                            ? "bg-primary-50 font-semibold text-primary-700"
                            : "text-app-text hover:bg-app-hover",
                      )}
                    >
                      <Icon
                        className={clsx(
                          "h-4 w-4 shrink-0",
                          it.danger
                            ? "text-app-error"
                            : it.primary
                              ? "text-primary-600"
                              : "text-app-text-secondary",
                        )}
                        aria-hidden
                      />
                      {it.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
