// W15 — My Packages / credits (G11). Framework-free helpers for the buyer's
// remaining-credit cards. Source is `GET /my-packages`, whose rows carry
// remaining_sessions + nested BookingPackage metadata (name, sessions_count,
// owner). The backend exposes no expiry or redemption history, so the
// "expiring soon" banner and per-credit history from the design have no data to
// render — we surface remaining credits honestly rather than fabricate dates.

import type { MyPackageCredit, SchedulingOwnerType } from "@pantopus/types";

export type CreditState = "active" | "used";

export interface CreditProgress {
  left: number;
  total: number;
  /** 0–100, share of sessions remaining. */
  pct: number;
  state: CreditState;
}

export function creditProgress(credit: MyPackageCredit): CreditProgress {
  const left = Math.max(0, Number(credit.remaining_sessions) || 0);
  const total = Math.max(
    left,
    Number(credit.BookingPackage?.sessions_count) || left || 0,
  );
  const pct = total > 0 ? Math.round((left / total) * 100) : 0;
  return { left, total, pct, state: left <= 0 ? "used" : "active" };
}

export function creditName(credit: MyPackageCredit): string {
  return credit.BookingPackage?.name?.trim() || "Session package";
}

export function creditOwnerType(credit: MyPackageCredit): SchedulingOwnerType {
  return credit.BookingPackage?.owner_type ?? "business";
}

/** "3 of 5 left" / "0 of N left". The 'All used' chip is rendered separately. */
export function creditCountLabel(progress: CreditProgress): string {
  return `${progress.left} of ${progress.total} left`;
}

/** Sort active credits ahead of spent ones; newest purchase first within each. */
export function sortCredits(credits: MyPackageCredit[]): MyPackageCredit[] {
  return [...credits].sort((a, b) => {
    const sa = creditProgress(a).state === "active" ? 0 : 1;
    const sb = creditProgress(b).state === "active" ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return (
      new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime()
    );
  });
}
