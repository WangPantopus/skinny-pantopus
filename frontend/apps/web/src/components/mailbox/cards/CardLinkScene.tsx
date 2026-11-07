'use client';

// ============================================================
// The page a Christmas card's link opens (launch key card_table): the table in
// the default slate colour and the shut envelope with its wax seal. It never
// shows the picture or the note. Look it over draws the same page in a frame.
// ============================================================

import type { ReactNode } from 'react';
import { TABLE_ART, tableEdge, tableTint } from './cardArt';
import { useDarkPage } from './useDarkPage';
import styles from './CardLinkScene.module.css';

const SLATE = '#3b4c6e';
const art = (name: string) => `${TABLE_ART}${name}`;

export const cardLinkStyles = styles;

export default function CardLinkScene({
  framed = false,
  envelope = true,
  children,
}: {
  /** Inside Look it over, in place of the whole page. */
  framed?: boolean;
  envelope?: boolean;
  children: ReactNode;
}) {
  useDarkPage(!framed, tableEdge(SLATE));

  return (
    <main className={`${styles.scene} ${framed ? styles.framed : ''}`} data-testid="cardLinkPage">
      <div className={styles.layers} aria-hidden="true">
        <div className={styles.table} style={{ backgroundImage: `url(${art('table-cloth.webp')})`, backgroundColor: tableTint(SLATE) }} />
        <div className={styles.light} style={{ backgroundImage: `url(${art('light.webp')})` }} />
        <div className={styles.vignette} />
        <div className={styles.grain} style={{ backgroundImage: `url(${art('grain.png')})` }} />
      </div>
      <div className={styles.column}>
        {envelope ? (
          <div className={styles.envelope} aria-hidden="true">
            {/* eslint-disable @next/next/no-img-element */}
            <img src={art('env-pocket.webp')} alt="" />
            <img src={art('env-flap-shadow.webp')} alt="" />
            <img src={art('env-flap-out.webp')} alt="" className={styles.flap} />
            <img src={art('wax-gold.webp')} alt="" className={styles.wax} />
            {/* eslint-enable @next/next/no-img-element */}
          </div>
        ) : null}
        {children}
      </div>
    </main>
  );
}
