"use client";

// E10 — Double-Book Warning. Surfaced when a manual/on-behalf create returns a
// 409 SLOT_CONFLICT. Two variants per design:
//
//   SOFT (SLOT_TAKEN): "This time overlaps" — amber disc + CalendarClock,
//   ConflictCard (linked event row), Cancel + "Book anyway" CTA.
//   NOTE: Backend has no force-book endpoint — "Book anyway" is rendered as the
//   design specifies but triggers onPickAnother (re-pick flow) since the backend
//   can't honour an override. We keep the slot-alternatives below for quick
//   re-pick convenience.
//
//   HARD (SLOT_UNAVAILABLE): "Member is unavailable" — error disc + Lock icon,
//   green member note, disabled lock button, Cancel + "Pick another member" CTA.
//
// For SLOT_FULL a separate "fully booked" state is handled upstream.

import { CalendarClock, Lock, Users, Wrench } from "lucide-react";
import clsx from "clsx";
import type { BookingSlot, SlotConflict } from "@pantopus/types";
import BottomSheet from "@/components/ui/BottomSheet";
import SlotConflictAlternatives from "@/components/scheduling/SlotConflictAlternatives";
import type { Pillar } from "@/components/scheduling/pillarTokens";
import { IconDisc } from "./ui";

export default function DoubleBookWarning({
  open,
  onClose,
  conflict,
  pillar = "personal",
  onPick,
  onPickAnother,
  loadingAlternatives = false,
}: {
  open: boolean;
  onClose: () => void;
  conflict: SlotConflict | null;
  pillar?: Pillar;
  onPick: (slot: BookingSlot) => void;
  onPickAnother?: () => void;
  loadingAlternatives?: boolean;
}) {
  if (!open || !conflict) return null;

  // SLOT_UNAVAILABLE = hard conflict (member unavailable). Anything else = soft overlap.
  const isHard = conflict.error === "SLOT_UNAVAILABLE";

  if (isHard) {
    // ── Hard conflict frame (design Frame 2) ──────────────────────────────
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        footer={
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-app-border bg-app-surface px-4 py-2.5 text-sm font-semibold text-app-text-strong transition hover:bg-app-hover"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onPickAnother?.();
              }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-transparent px-4 py-2.5 text-sm font-semibold text-primary-600 transition hover:bg-app-hover"
            >
              <Users className="h-4 w-4" aria-hidden />
              Pick another member
            </button>
          </div>
        }
      >
        <div className="px-1 text-center">
          <div className="mb-3 flex justify-center">
            <IconDisc icon={Lock} tone="error" />
          </div>
          <h3 className="text-base font-bold text-app-text">
            Member is unavailable
          </h3>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-app-text-secondary">
            {conflict.message ||
              "This time conflicts with a member's personal availability."}
          </p>
          {/* Green member note */}
          <div className="mx-auto mt-3 flex max-w-xs items-center gap-2 rounded-xl bg-green-50 px-3 py-2.5">
            <span className="h-2 w-2 shrink-0 rounded-full bg-green-600" aria-hidden />
            <span className="text-xs font-semibold text-green-700">
              Conflicts with member availability
            </span>
          </div>
          {/* Disabled lock button */}
          <button
            type="button"
            disabled
            className="mt-4 inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-app-surface-sunken px-4 py-2.5 text-sm font-semibold text-app-text-muted"
          >
            <Lock className="h-4 w-4" aria-hidden />
            Can&apos;t book — member unavailable
          </button>
        </div>
      </BottomSheet>
    );
  }

  // ── Soft overlap frame (design Frame 1) ───────────────────────────────
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-app-border bg-app-surface px-4 py-2.5 text-sm font-semibold text-app-text-strong transition hover:bg-app-hover"
          >
            Cancel
          </button>
          {/* "Book anyway" per design — no force-book endpoint, so re-directs
              to pick another time (the safest available resolution path). */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onPickAnother?.();
            }}
            className="flex-1 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700"
          >
            Book anyway
          </button>
        </div>
      }
    >
      <div className="px-1">
        <div className="mb-3 flex justify-center">
          <IconDisc icon={CalendarClock} tone="warning" />
        </div>
        <h3 className="text-center text-base font-bold text-app-text">
          This time overlaps
        </h3>
        <p className="mx-auto mt-2 max-w-xs text-center text-sm leading-relaxed text-app-text-secondary">
          {conflict.message ||
            "Another booking already holds this slot."}
        </p>

        {/* ConflictCard — tappable linked event row */}
        <button
          type="button"
          onClick={onPickAnother}
          className="mt-3 flex w-full items-center gap-3 rounded-xl border border-app-border bg-app-surface-sunken px-3 py-2.5 text-left transition hover:bg-app-hover"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-app-warning-bg text-app-warning">
            <Wrench className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-app-text">
              Conflicting event
            </span>
            <span className="block text-[11px] text-app-text-muted">
              {conflict.message || "This calendar"}
            </span>
          </span>
          <svg className="h-4 w-4 shrink-0 text-app-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M9 18l6-6-6-6"/></svg>
        </button>

        {/* Nearest open times (convenience — not in design but aids re-pick) */}
        {conflict.alternatives && conflict.alternatives.length > 0 && (
          <div className={clsx("mt-4", "opacity-80")}>
            <SlotConflictAlternatives
              conflict={conflict}
              pillar={pillar}
              loading={loadingAlternatives}
              onPick={onPick}
              onPickAnother={onPickAnother}
            />
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
