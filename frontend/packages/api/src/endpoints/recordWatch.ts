// ============================================================
// HOME RECORD WATCH — the rate-watch half (Wave 2b)
//
// A verified resident enters the month their loan was recorded; the
// backend freezes that month's Freddie Mac PMMS 30-year average as
// the baseline and compares the current weekly average against it,
// pushing when the refi window (a 0.75pp drop) opens. Averages and
// deltas only — never advice. The deed/lien half of Record Watch is
// deliberately not built yet (ATTOM recorder contract pending).
//
// Watches are PERSONAL per home+user.
// ============================================================

import { get, put, del } from '../client';

export interface RecordWatchEvaluation {
  baseline_rate: number;
  current_rate: number;
  current_as_of: string;
  /** current − baseline, in percentage points (negative = below). */
  delta_pp: number;
  refi_window: boolean;
}

export interface RecordWatch {
  id: string;
  home_id: string;
  /** 'YYYY-MM' as entered. */
  loan_recorded_month: string;
  baseline_rate: number;
  created_at: string;
  /** Null when the rate history is temporarily unreachable. */
  evaluation: RecordWatchEvaluation | null;
}

/** PUT /api/homes/:id/record-watch — set or replace (verified residents only). */
export async function setRecordWatch(homeId: string, loanRecordedMonth: string): Promise<RecordWatch> {
  const res = await put<{ watch: RecordWatch }>(`/api/homes/${homeId}/record-watch`, {
    loan_recorded_month: loanRecordedMonth,
  });
  return res.watch;
}

/** GET /api/homes/:id/record-watch — the caller's watch here, or null. */
export async function getRecordWatch(homeId: string): Promise<RecordWatch | null> {
  const res = await get<{ watch: RecordWatch | null }>(`/api/homes/${homeId}/record-watch`);
  return res.watch;
}

/** DELETE /api/homes/:id/record-watch */
export async function deleteRecordWatch(homeId: string): Promise<void> {
  await del<{ removed: boolean }>(`/api/homes/${homeId}/record-watch`);
}
