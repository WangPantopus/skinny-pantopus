"use client";

// D5 — Slot Taken / Conflict. The 409-recovery surface that never dead-ends.
// Wraps the W0 SlotConflictAlternatives (calm amber block → re-fetched nearest
// open rows → "Pick another time", or a waitlist offer when fully booked) and
// adds the reassuring "Your details are saved" footer note from the design.

import { ShieldCheck } from "lucide-react";
import clsx from "clsx";
import type { BookingSlot, SlotConflict } from "@pantopus/types";
import { SlotConflictAlternatives, type Pillar } from "@/components/scheduling";

export default function ConflictView({
  conflict,
  onPick,
  onPickAnother,
  onJoinWaitlist,
  loading,
  pillar = "personal",
  detailsSaved = true,
  className,
}: {
  conflict: SlotConflict;
  onPick: (slot: BookingSlot) => void;
  onPickAnother?: () => void;
  onJoinWaitlist?: () => void;
  /** True while the nearest-open times are being re-fetched. */
  loading?: boolean;
  pillar?: Pillar;
  /** Show the "Your details are saved" reassurance footer. */
  detailsSaved?: boolean;
  className?: string;
}) {
  return (
    <div className={clsx("space-y-3", className)}>
      <SlotConflictAlternatives
        conflict={conflict}
        onPick={onPick}
        onPickAnother={onPickAnother}
        onJoinWaitlist={onJoinWaitlist}
        loading={loading}
        pillar={pillar}
      />
      {detailsSaved && (
        <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-app-text-muted">
          <ShieldCheck className="h-3.5 w-3.5 text-app-success" aria-hidden />
          Your details are saved.
        </p>
      )}
    </div>
  );
}
