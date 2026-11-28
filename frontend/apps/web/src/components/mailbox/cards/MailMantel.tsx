'use client';

// ============================================================
// The mantel (mail-cards-experience Part 7; the founder approved its sample on November 17): this season's opened
// Christmas cards stand on a shelf at the top of the Mailbox's personal list, as cards stand on a mantel at home. Only
// cards the person received and opened (not unopened, sealed, replies or sent ones), newest opened at the left, 30 at
// most, from the list already loaded; through January 6 by the person's clock. The shelf and the fir sprig are the
// approved art; the cards are the app's own small card faces. Nothing on it moves by itself.
// ============================================================

import type { CSSProperties } from 'react';
import type { MailItemV2 } from '@/types/mailbox';
import { PaperFront } from './CardPaper';
import { firstNameOf, seededRandom, TABLE_ART } from './cardArt';
import styles from './MailMantel.module.css';

const MOST = 30;
const FIRST_LEFT = 74;
const CARD_W = 88;
const GAP = 13;
const AFTER = 16;

/** The season the shelf belongs to now: this year's, and last year's through January 6. Null once it's over. */
function seasonNow(now: Date): number | null {
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  return now < new Date(year + 1, 0, 7) ? year : null;
}

/** The opened cards the shelf shows, newest opened first. */
export function mantelCards(items: MailItemV2[], now = new Date()): MailItemV2[] {
  const season = seasonNow(now);
  if (season === null) return [];
  return items
    // Christmas cards alone: a thank-you card (Wave 5) never stands on the mantel.
    .filter((item) => item.card && !item.card.sealed && item.opened_at && !item.removed && item.card.year === season && item.card.kind !== 'thank_you')
    .sort((a, b) => Date.parse(b.opened_at as string) - Date.parse(a.opened_at as string))
    .slice(0, MOST);
}

/**
 * A card's turn on the shelf, −2.4° to +2.4°, from its number with the note's seeded numbers (penWords): the draw its
 * first word's turn takes, the second. The first barely changes from one small seed to the next (every card would lean
 * left by under 1.3°); the second spreads across the whole range. The same every time.
 */
function turnOf(number: number | null | undefined): number {
  const random = seededRandom((number ?? 1) * 7 + 3);
  random();
  return (random() - 0.5) * 4.8;
}

export default function MailMantel({ items, onOpen }: { items: MailItemV2[]; onOpen: (item: MailItemV2) => void }) {
  const cards = mantelCards(items);
  if (!cards.length) return null;
  const rowWidth = FIRST_LEFT + cards.length * CARD_W + (cards.length - 1) * GAP + AFTER;
  return (
    <section className={styles.mantel} data-testid="mailMantel">
      <div className={styles.glow} aria-hidden="true" />
      {/* The shelf stays where it is while the cards scroll along it. */}
      <div className={styles.shelf} aria-hidden="true" />
      <div className={styles.scroller}>
        <div className={styles.row} style={{ width: rowWidth }} role="list" aria-label={`Your Christmas cards, ${cards.length}`}>
          {cards.map((item, i) => {
            const card = item.card!;
            const left = FIRST_LEFT + i * (CARD_W + GAP);
            return (
              <div key={item.id} role="listitem">
                <span className={styles.foot} style={{ left }} aria-hidden="true" />
                <button
                  type="button"
                  className={styles.card}
                  style={{ left, '--rz': `${turnOf(card.number).toFixed(2)}deg` } as CSSProperties}
                  aria-label={`Card from ${firstNameOf(item.sender_display) || 'someone'}: ${card.caption || 'A Christmas card'}`}
                  data-testid="mailMantelCard"
                  onClick={() => onOpen(item)}
                >
                  <PaperFront
                    design={card.design}
                    caption={card.caption}
                    paper={card.paper}
                    year={card.year}
                    mailedOn={item.postmark?.date || item.created_at}
                    className={styles.face}
                  />
                </button>
              </div>
            );
          })}
          {/* The fir sprig lies on the shelf in front of the cards and scrolls with them. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${TABLE_ART}mantel-sprig.webp`} alt="" className={styles.sprig} draggable={false} />
        </div>
      </div>
    </section>
  );
}
