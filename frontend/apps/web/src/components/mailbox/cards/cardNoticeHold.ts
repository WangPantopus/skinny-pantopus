'use client';

// ============================================================
// Wave 4.1 (card improvements, only while `improved`): no "Your daily briefings" notice and no guidance card over a
// Christmas card for someone who just came to it.
//  - The web's own path from a card's link: /open/[mailId] sets a session flag (only from a read that said
//    `improved`), and while the person stays on that card or on the send flow it opened, nothing is put over it.
//  - Any later load: while a piece with `card.joined_for` is on screen.
// They wait for the next visit outside the card: leaving the card's pages clears the flag.
// ============================================================

import { useEffect, useSyncExternalStore } from 'react';

const KEY = 'pantopus:card-claim-path';
const listeners = new Set<() => void>();
let pieces = 0;

const emit = () => { for (const listener of listeners) listener(); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

function claimedCard(): string | null {
  try { return window.sessionStorage.getItem(KEY); } catch { return null; }
}

/** The card's link page opened this card (its read said `improved`): hold the notices on its way to the mailbox. */
export function markCardClaimPath(mailId: string) {
  try { window.sessionStorage.setItem(KEY, mailId); } catch { /* storage off: the piece's joined_for still holds them */ }
  emit();
}

/** A piece with `card.joined_for` is on screen; the returned function lets go. */
export function holdForCard(): () => void {
  pieces += 1;
  emit();
  return () => { pieces -= 1; emit(); };
}

/** Still on the card's own pages: the piece itself, or the send flow it led to (Write back, Send a card). */
const onCardPath = (pathname: string, mailId: string) => pathname.includes(mailId) || pathname.startsWith('/app/mailbox/cards');

/** True while the briefing notice and guidance cards should wait. */
export function useCardNoticeHold(pathname: string): boolean {
  const held = useSyncExternalStore(subscribe, () => pieces, () => 0);
  const mailId = useSyncExternalStore(subscribe, claimedCard, () => null);
  const onPath = Boolean(mailId && onCardPath(pathname, mailId));
  useEffect(() => {
    if (!mailId || onPath) return;
    try { window.sessionStorage.removeItem(KEY); } catch { /* storage off */ }
    emit();
  }, [mailId, onPath]);
  return held > 0 || onPath;
}
