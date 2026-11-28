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
  /**
   * A card Pantopus AI put together in the assistant's chat (startAssistantCard): the flow opens it on Look it over,
   * once. Gone from the draft as soon as the flow keeps it again.
   */
  fromAssistant?: boolean;
  /** A photo card's front (Wave 4.2): its frame, caption and the photo's shape (width / height). */
  front?: { frame: 'heirloom' | 'midnight' | 'arch'; caption: string; aspect: number } | null;
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
      front: d.front && ['heirloom', 'midnight', 'arch'].includes(d.front.frame) && isText(d.front.caption, 200) && Number.isFinite(d.front.aspect)
        ? { frame: d.front.frame, caption: d.front.caption, aspect: d.front.aspect } : null,
      listIds: Array.isArray(d.listIds) ? d.listIds.filter((pair) => Array.isArray(pair) && isText(pair[0], 400) && isText(pair[1], 64)) : [],
    };
  } catch {
    return null;
  }
}

export function saveCardDraft(draft: Omit<CardDraft, 'v' | 'savedAt'>): void {
  try { sessionStorage.setItem(KEY, JSON.stringify({ ...draft, v: 1, savedAt: Date.now() })); } catch { /* storage unavailable: no draft */ }
}

/**
 * A card the assistant put together, kept as this tab's draft so "Send a Christmas card" opens with it: the picture,
 * who it is for, the note and the arrival. It replaces a card left half-written in this tab, as starting any new card
 * does. Nothing is sent: the person looks it over and seals it on that screen. False when it can't be kept.
 */
export function startAssistantCard(user: string, card: {
  designId: string;
  to: DraftEntry;
  message: string;
  arrival: HolidayCardArrival;
}): boolean {
  if (!user || !isEntry(card.to) || !isText(card.designId, 120) || !isText(card.message, 5000)) return false;
  saveCardDraft({
    user,
    step: 'seal',
    to: card.to,
    designId: card.designId,
    message: card.message,
    signature: null,
    photo: null,
    photoAlt: '',
    voice: null,
    arrival: card.arrival,
    requestId: null,
    listIds: [],
    fromAssistant: true,
  });
  return readCardDraft(user)?.fromAssistant === true;
}

/** Sent, taken back, started over, or signed out. */
export function clearCardDraft(): void {
  try { sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}
