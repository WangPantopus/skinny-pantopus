'use client';

// ============================================================
// From Write on the back onward, you are at the table (design plan Part 9, launch key card_table): the steps lie on
// the chosen card's cloth under the table's window light, the card bright under the lamp. Only the place changes; the
// steps, their order and their words are the same.
// ============================================================

import type { ReactNode } from 'react';
import { TABLE_ART, tableTint } from './cardArt';
import styles from './AtTheTable.module.css';

/** Cream words and glass buttons for the cloth. */
export const ON_CLOTH_TEXT = 'text-[#f6ecd9]';
export const ON_CLOTH_MUTED = 'text-[#f6ecd9]/80';
export const ON_CLOTH_BUTTON = 'inline-flex min-h-[40px] items-center rounded-full border border-[#f6ecd9]/25 bg-[#18100e]/35 px-3.5 text-[14px] font-semibold text-[#f6ecd9] backdrop-blur hover:bg-[#18100e]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8b76f]';

export default function AtTheTable({ table, children }: { table: string | null | undefined; children: ReactNode }) {
  return (
    <div
      className={styles.cloth}
      data-testid="sendAtTable"
      style={{ backgroundColor: tableTint(table), backgroundImage: `url(${TABLE_ART}table-cloth.webp)` }}
    >
      <div className={styles.light} style={{ backgroundImage: `url(${TABLE_ART}light.webp)` }} aria-hidden="true" />
      <div className={styles.vignette} aria-hidden="true" />
      <div className={styles.on}>{children}</div>
    </div>
  );
}

/** "When should it arrive?" on a cream slip lying on the cloth. */
export function Slip({ children }: { children: ReactNode }) {
  return (
    <div className={styles.slip} style={{ backgroundImage: `url(${TABLE_ART}paper.webp)` }}>
      {children}
    </div>
  );
}

/** The steps at the table when `on`, else just the steps (the key is off, or no card is chosen yet). */
export function StepsAtTable({ on, table, children }: { on: boolean; table: string | null | undefined; children: ReactNode }) {
  return on ? <AtTheTable table={table}>{children}</AtTheTable> : <>{children}</>;
}
