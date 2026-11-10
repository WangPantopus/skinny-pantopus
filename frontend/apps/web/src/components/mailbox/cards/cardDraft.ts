/**
 * The card being written, kept in this tab across a reload (memories plan step 4, "Drafts"): who it's for, the
 * picture, the note, the signature, the uploaded photo and voice greeting (their references, never the files) with the
 * photo's description, the arrival chosen, the step, and the draft's request ID, so a send whose answer was lost and
 * is tried again after a reload finds the card it stored. Raw photos and recordings are not kept: a reload mid-upload
 * means adding them again. Per tab and per person (sessionStorage), and gone on sign-out, once the card is sent or
 * taken back, and after the 72 hours an upload can be sent in.
 */
import type { CardMediaRef, CardSignature, HolidayCardArrival } from '@pantopus/api';

const KEY = 'pantopus:card-draft';
/** An upload is sendable for 72 hours (memories contract): a draft older than that would only be refused. */
const TTL = 72 * 60 * 60_000;

export type DraftEntry = { kind: 'person'; userId: string; name: string } | { kind: 'email'; email: string };
export type DraftRecipient = DraftEntry | { kind: 'link' } | { kind: 'list'; entries: DraftEntry[] };

export type CardDraft = {
  v: 1;
  user: string;
  savedAt: number;
  step: 'to' | 'pick' | 'write' | 'seal';
  to: DraftRecipient | null;
  designId: string | null;
  message: string;
  signature: CardSignature | null;
  photo: CardMediaRef | null;
  photoAlt: string;
  voice: CardMediaRef | null;
  arrival: HolidayCardArrival | null;
  requestId: string | null;
  /** A list's request ID for each person or address on it. */
  listIds: [string, string][];
};

const isText = (x: unknown, max = 2000): x is string => typeof x === 'string' && x.length <= max;
const isEntry = (x: unknown): x is DraftEntry => {
  const e = x as DraftEntry | null;
  return Boolean(e) && ((e!.kind === 'person' && isText(e!.userId, 64) && isText(e!.name, 200)) || (e!.kind === 'email' && isText(e!.email, 320)));
};
const isRecipient = (x: unknown): x is DraftRecipient => {
  const r = x as DraftRecipient | null;
  if (!r) return false;
  if (r.kind === 'link') return true;
  if (r.kind === 'list') return Array.isArray(r.entries) && r.entries.length > 0 && r.entries.length <= 50 && r.entries.every(isEntry);
  return isEntry(r);
};
const isMedia = (x: unknown, kind: 'photo' | 'voice'): x is CardMediaRef => {
  const m = x as CardMediaRef | null;
  return Boolean(m) && m!.kind === kind && isText(m!.file_id, 64);
};

/** This person's draft in this tab, if there is one still worth keeping. */
export function readCardDraft(user: string): CardDraft | null {
  try {
    const d = JSON.parse(sessionStorage.getItem(KEY) || 'null') as CardDraft | null;
    if (!d || d.v !== 1 || d.user !== user || !Number.isFinite(d.savedAt) || Date.now() - d.savedAt > TTL) return null;
    if (!['to', 'pick', 'write', 'seal'].includes(d.step) || !isText(d.message, 5000) || !isText(d.photoAlt ?? '', 400)) return null;
    return {
      ...d,
      to: isRecipient(d.to) ? d.to : null,
      designId: isText(d.designId, 120) ? d.designId : null,
      photo: isMedia(d.photo, 'photo') ? d.photo : null,
      voice: isMedia(d.voice, 'voice') ? d.voice : null,
      requestId: isText(d.requestId, 64) ? d.requestId : null,
      listIds: Array.isArray(d.listIds) ? d.listIds.filter((pair) => Array.isArray(pair) && isText(pair[0], 400) && isText(pair[1], 64)) : [],
    };
  } catch {
    return null;
  }
}

export function saveCardDraft(draft: Omit<CardDraft, 'v' | 'savedAt'>): void {
  try { sessionStorage.setItem(KEY, JSON.stringify({ ...draft, v: 1, savedAt: Date.now() })); } catch { /* storage unavailable: no draft */ }
}

/** Sent, taken back, started over, or signed out. */
export function clearCardDraft(): void {
  try { sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}
