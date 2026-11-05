'use client';

import type { CrewDayAddress } from '@pantopus/types';

// A household's choices between Your price and Review and book (the home, its option and add-ons), kept in this
// browser for a day, so signing up in between (even through the confirmation email in another tab) doesn't lose
// them. The booking's request id rides along, so a retry after a lost answer books once. Cleared once booked.

export type CrewDayDraft = {
  v: 1;
  saved_at: number;
  /** Set when the home is one of the person's homes in Pantopus. */
  home_id: string | null;
  address: CrewDayAddress;
  option_id: string;
  add_on_ids: string[];
  /** The quote's price; null while the crew confirms it after a look. */
  price_cents: number | null;
  needs_look: boolean;
  access_note?: string;
  client_request_id?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const key = (code: string) => `pantopus:crew-day:draft:${code}`;
// Where storage is refused (some private windows), the choices last while this tab stays in the app.
const inMemory = new Map<string, CrewDayDraft>();

export function readCrewDayDraft(code: string): CrewDayDraft | null {
  const kept = inMemory.get(code);
  if (kept && Date.now() - kept.saved_at <= DAY_MS) return kept;
  try {
    const raw = window.localStorage.getItem(key(code));
    if (!raw) return null;
    const draft = JSON.parse(raw) as CrewDayDraft;
    if (draft?.v !== 1 || !draft.address || !draft.option_id || Date.now() - draft.saved_at > DAY_MS) {
      window.localStorage.removeItem(key(code));
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function saveCrewDayDraft(code: string, draft: Omit<CrewDayDraft, 'v' | 'saved_at'>): void {
  const kept: CrewDayDraft = { ...draft, v: 1, saved_at: Date.now() };
  inMemory.set(code, kept);
  try {
    window.localStorage.setItem(key(code), JSON.stringify(kept));
  } catch {
    // Private windows and full storage: the choices then last only while this page is open.
  }
}

export function clearCrewDayDraft(code: string): void {
  inMemory.delete(code);
  try {
    window.localStorage.removeItem(key(code));
  } catch {
    // Nothing kept.
  }
}
