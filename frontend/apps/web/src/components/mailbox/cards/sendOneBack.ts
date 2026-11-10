// ============================================================
// Send one back (launch key card_table, design plan Part 3): from a card on
// the table to the send flow at Pick a card, with its sender already chosen.
// The address carries only their id; the name they're shown by rides in this
// tab's session storage, so it never goes in a link or a log. Without it (a
// new tab, storage off), the flow starts at Who it's for as usual.
// ============================================================

const KEY = 'pantopus_card_send_to';

export type ChosenPerson = { userId: string; name: string };

/** Where the send flow opens for this person. */
export function sendOneBackPath(person: ChosenPerson): string {
  try { window.sessionStorage.setItem(KEY, JSON.stringify(person)); } catch { /* storage off: the flow asks who it's for */ }
  return `/app/mailbox/cards?to=${encodeURIComponent(person.userId)}`;
}

/** The person the flow was opened for, if it's the one the address names. */
export function chosenPersonFor(userId: string | null | undefined): ChosenPerson | null {
  if (!userId) return null;
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(KEY) || 'null') as ChosenPerson | null;
    return saved && saved.userId === userId && typeof saved.name === 'string' && saved.name ? saved : null;
  } catch {
    return null;
  }
}
