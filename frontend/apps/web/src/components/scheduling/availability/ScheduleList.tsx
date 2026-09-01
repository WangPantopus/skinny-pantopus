"use client";

// B4 — Availability schedule list. White cards with a calendar-clock icon, the
// schedule name + an optional filled "Default" pill, a one-line hours summary +
// timezone badge, and an overflow menu (set as default / rename / duplicate /
// delete). Loading shimmer + calm empty state live alongside.

import { useEffect, useRef, useState } from "react";
import {
  CalendarClock,
  CalendarCheck,
  Copy,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import type { AvailabilitySchedule, AvailabilityRule } from "@pantopus/types";
import { ShimmerBlock, ShimmerLine } from "@/components/ui/Shimmer";
import { summarizeSchedule, rowsForSchedule } from "./serialize";
import { tzShort } from "./format";

function DefaultPill() {
  return (
    <span className="inline-flex items-center rounded-full bg-app-personal px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
      Default
    </span>
  );
}

function OverflowMenu({
  isDefault,
  onSetDefault,
  onRename,
  onDuplicate,
  onDelete,
  onClose,
}: {
  isDefault: boolean;
  onSetDefault: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose]);

  const item =
    "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] font-semibold transition-colors hover:bg-app-hover";
  return (
    <div
      ref={ref}
      role="menu"
      className="absolute right-1.5 top-10 z-30 w-44 overflow-hidden rounded-xl border border-app-border bg-app-surface py-1 shadow-xl"
    >
      {!isDefault && (
        <button
          className={`${item} text-app-text`}
          onClick={onSetDefault}
          role="menuitem"
        >
          <CalendarCheck
            className="h-4 w-4 text-app-text-secondary"
            aria-hidden
          />
          Set as default
        </button>
      )}
      <button
        className={`${item} text-app-text`}
        onClick={onRename}
        role="menuitem"
      >
        <Pencil className="h-4 w-4 text-app-text-secondary" aria-hidden />
        Rename
      </button>
      <button
        className={`${item} text-app-text`}
        onClick={onDuplicate}
        role="menuitem"
      >
        <Copy className="h-4 w-4 text-app-text-secondary" aria-hidden />
        Duplicate
      </button>
      <div className="my-1 h-px bg-app-border" />
      <button
        className={`${item} text-app-error`}
        onClick={onDelete}
        role="menuitem"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        Delete
      </button>
    </div>
  );
}

function ScheduleRow({
  schedule,
  summary,
  menuOpen,
  onToggleMenu,
  onOpen,
  onSetDefault,
  onRename,
  onDuplicate,
  onDelete,
}: {
  schedule: AvailabilitySchedule;
  summary: string;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onOpen: () => void;
  onSetDefault: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="relative rounded-2xl border border-app-border bg-app-surface shadow-sm transition-colors hover:border-app-personal/40">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-start gap-3 p-3 text-left"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-app-personal-bg text-app-personal">
          <CalendarClock className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 pt-0.5 pr-8">
          <span className="flex items-center gap-2">
            <span className="truncate text-[13.5px] font-semibold text-app-text">
              {schedule.name}
            </span>
            {schedule.is_default && <DefaultPill />}
          </span>
          <span className="mt-1 block text-[11.5px] text-app-text-secondary">
            {summary}
            <span className="text-app-text-muted"> · </span>
            <span className="font-semibold text-app-text-strong">
              {tzShort(schedule.timezone)}
            </span>
          </span>
        </span>
      </button>

      <button
        type="button"
        aria-label={`Options for ${schedule.name}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={onToggleMenu}
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-app-text-muted hover:bg-app-hover hover:text-app-text"
      >
        <MoreVertical className="h-[18px] w-[18px]" aria-hidden />
      </button>

      {menuOpen && (
        <OverflowMenu
          isDefault={schedule.is_default}
          onSetDefault={onSetDefault}
          onRename={onRename}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onClose={onToggleMenu}
        />
      )}
    </div>
  );
}

export function ScheduleListSkeleton() {
  return (
    <div className="space-y-2.5" aria-hidden>
      {[0, 1].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-2xl border border-app-border bg-app-surface p-3 shadow-sm"
        >
          <ShimmerBlock className="h-9 w-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <ShimmerLine width="w-1/2" className="h-3" />
            <ShimmerLine width="w-3/4" className="h-2.5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ScheduleList({
  schedules,
  rules,
  onOpen,
  onSetDefault,
  onRename,
  onDuplicate,
  onDelete,
}: {
  schedules: AvailabilitySchedule[];
  rules: AvailabilityRule[];
  onOpen: (id: string) => void;
  onSetDefault: (s: AvailabilitySchedule) => void;
  onRename: (s: AvailabilitySchedule) => void;
  onDuplicate: (s: AvailabilitySchedule) => void;
  onDelete: (s: AvailabilitySchedule) => void;
}) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  return (
    <div className="space-y-2.5">
      {schedules.map((s) => (
        <ScheduleRow
          key={s.id}
          schedule={s}
          summary={summarizeSchedule(rowsForSchedule(rules, s.id))}
          menuOpen={openMenu === s.id}
          onToggleMenu={() =>
            setOpenMenu((cur) => (cur === s.id ? null : s.id))
          }
          onOpen={() => onOpen(s.id)}
          onSetDefault={() => {
            setOpenMenu(null);
            onSetDefault(s);
          }}
          onRename={() => {
            setOpenMenu(null);
            onRename(s);
          }}
          onDuplicate={() => {
            setOpenMenu(null);
            onDuplicate(s);
          }}
          onDelete={() => {
            setOpenMenu(null);
            onDelete(s);
          }}
        />
      ))}
    </div>
  );
}
