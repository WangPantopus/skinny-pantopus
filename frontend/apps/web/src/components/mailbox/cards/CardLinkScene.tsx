'use client';

// ============================================================
// The page a Christmas card's link opens (launch key card_table): the table and,
// on it, the card's front lying on its open envelope, as the public /cards/<slug>
// page draws it (the stock picture the sender picked, in its own cloth's colour).
// A card sealed until Christmas is the shut envelope with its wax seal on the
// default slate cloth. Never the note, signature, photo or voice. Look it over
// draws the same page in a frame.
// ============================================================

import type { ReactNode } from 'react';
import type { CardLinkFront } from '@pantopus/api';
import { TABLE_ART, tableEdge, tableTint } from './cardArt';
import { PaperFront } from './CardPaper';
import { useDarkPage } from './useDarkPage';
import TravelPostmarks from './TravelPostmarks';
import { cardStampFile } from './cardArt';
import styles from './CardLinkScene.module.css';

const SLATE = '#3b4c6e';
const art = (name: string) => `${TABLE_ART}${name}`;

export const cardLinkStyles = styles;

/** The card's front as the page lays it out: the stock picture, the season's year and the day it was sent (its postmark). */
export type CardLinkSceneFront = CardLinkFront & { year: number; mailedOn: string | null };

export default function CardLinkScene({
  framed = false,
  envelope = true,
  front = null,
  postmarks = null,
  improved = false,
  children,
}: {
  /** The card improvements of November 28 (the read's `improved`): the guest page's tighter layout. */
  improved?: boolean;
  /** A travelling card (Part 7): its envelope, address side up with these postmarks and no names, behind the card. */
  postmarks?: { town: string; state: string | null; on: string }[] | null;
  /** Inside Look it over, in place of the whole page. */
  framed?: boolean;
  envelope?: boolean;
  /** The card's front lying on its open envelope, in place of the shut envelope. */
  front?: CardLinkSceneFront | null;
  children: ReactNode;
}) {
  const cloth = front?.table ?? SLATE;
  useDarkPage(!framed, tableEdge(cloth));

  return (
    <main className={`${styles.scene} ${framed ? styles.framed : ''} ${improved ? styles.improved : ''}`} data-testid="cardLinkPage">
      <div className={styles.layers} aria-hidden="true" style={front ? { backgroundColor: tableEdge(cloth) } : undefined}>
        <div className={styles.table} style={{ backgroundImage: `url(${art('table-cloth.webp')})`, backgroundColor: tableTint(cloth) }} />
        <div className={styles.light} style={{ backgroundImage: `url(${art('light.webp')})` }} />
        <div className={styles.vignette} />
        <div className={styles.grain} style={{ backgroundImage: `url(${art('grain.png')})` }} />
      </div>
      <div className={styles.column}>
        {envelope && front ? (
          <div className={`${styles.lying} ${postmarks?.length ? styles.lyingTravel : ''}`} role="img" aria-label={`A Christmas card: ${front.caption}`} data-testid="cardLinkFront">
            {postmarks?.length ? (
              <div className={styles.addressed} aria-hidden="true" data-testid="cardLinkPostmarks">
                {/* eslint-disable @next/next/no-img-element */}
                <img src={art('env-front.webp')} alt="" />
                <img src={cardStampFile(null, front.design, front.mood)} alt="" className={styles.addressedStamp} />
                {/* eslint-enable @next/next/no-img-element */}
                <span className={styles.addressedKind}>Christmas card</span>
                <TravelPostmarks marks={postmarks} />
              </div>
            ) : null}
            <div className={styles.open}>
              {/* eslint-disable @next/next/no-img-element */}
              <img src={art('env-flap-in.webp')} alt="" className={styles.flapIn} />
              <img src={art('env-inside.webp')} alt="" />
              <img src={art('env-pocket-shadow.webp')} alt="" />
              <img src={art('env-pocket.webp')} alt="" />
              {/* eslint-enable @next/next/no-img-element */}
            </div>
            <div className={styles.card}>
              <PaperFront design={front.design} caption={front.caption} paper={front.paper} year={front.year} mailedOn={front.mailedOn} />
            </div>
          </div>
        ) : envelope ? (
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
