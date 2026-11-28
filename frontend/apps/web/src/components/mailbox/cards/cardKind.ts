'use client';

// ============================================================
// Thank-you cards (Wave 5, card improvements): a card whose read carries `kind: 'thank_you'` is called by the server's
// `name` ("thank-you card") wherever a Christmas card is called "Christmas card", prints the server's `strip` ("THANK
// YOU, 2026", the year it was sent) where a Christmas card prints "CHRISTMAS, 2026", and lies on the cream linen
// envelope (`envelope: 'cream'`). A card without those fields is drawn exactly as before. No date or word here comes
// from the browser's clock.
// ============================================================

import { createContext } from 'react';

/** What the card on screen prints under its picture and on its back's last line; null: "CHRISTMAS, {year}" as before. */
export const CardStripContext = createContext<string | null>(null);

type Kinded = { kind?: string | null; name?: string | null } | null | undefined;

/** A thank-you card's read (Wave 5). */
export const isThankYouCard = (card: Kinded): boolean => card?.kind === 'thank_you';

/** What to call the card, lower case: the server's `name` for a thank-you card, else "Christmas card". */
export const cardKindName = (card: Kinded): string => (isThankYouCard(card) && card?.name ? card.name : 'Christmas card');

/** The same with its first letter up ("Thank-you card"), for the start of a sentence or a label. */
export const cardKindTitle = (card: Kinded): string => {
  const name = cardKindName(card);
  return name.charAt(0).toUpperCase() + name.slice(1);
};

/** The back's last line: "PANTOPUS POST · THANK YOU 2026" for a strip, as "CHRISTMAS 2026" is printed today. */
export const stripFooter = (strip: string): string => strip.replace(/,\s*/, ' ');
