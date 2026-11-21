// ============================================================
// A travelling card's journey (docs/product/travelling-card-2026-11-21, Part 5): /cards/journey/<journey id>, public,
// opened from the card ("See its journey"), Sent, a notice or a shared link, and inside the phone apps (D6). "PANTOPUS
// POST", "This card's journey", miles, towns and states, the map, the stops newest first, the days on the road, the goal
// line (D3) and "Start a card of your own". Towns and dates only: no names, addresses, notes or ids of people or mail.
// A server component: nothing of it needs the visitor's browser.
// ============================================================

import Link from 'next/link';
import type { CardJourney } from '@pantopus/api';
import { cardPicture } from './cardArt';
import { daysLine, journeyMapSvg, legMiles, stopDay, stopLabel } from './journeyMap';
import styles from './JourneyPage.module.css';

const fmt = (n: number) => n.toLocaleString('en-US');

export default function JourneyPage({ journey }: { journey: CardJourney }) {
  const newest = journey.stops.length - 1;
  const stops = journey.stops.map((stop, i) => ({ stop, i })).reverse();
  return (
    <main className={styles.page} data-testid="journeyPage">
      <div className={styles.column}>
        {journey.card ? (
          <div className={styles.picture} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cardPicture(journey.card.design, 'thumb')} alt="" width={240} height={Math.round((240 * journey.card.height) / 960)} />
          </div>
        ) : null}
        <div className={styles.head}>
          <p className={styles.eyebrow}>Pantopus Post</p>
          <h1 className={styles.title}>This card’s journey</h1>
          <div className={styles.stats}>
            <div><b>{fmt(journey.miles)}</b><span>miles</span></div>
            <div><b>{fmt(journey.towns)}</b><span>towns</span></div>
            <div><b>{journey.states} <i>of {journey.states_of}</i></b><span>states</span></div>
          </div>
        </div>
        <div className={styles.map} dangerouslySetInnerHTML={{ __html: journeyMapSvg(journey) }} />
        <ol className={styles.stops} aria-label="Its towns, newest first" data-testid="journeyStops">
          {stops.map(({ stop, i }) => (
            <li key={i} className={`${styles.stop} ${i === newest ? styles.now : ''}`}>
              <i aria-hidden="true" />
              <b>{stopLabel(stop)}</b>
              <span>{stopDay(stop.on)} · {stop.from == null ? 'started here' : stop.lat == null || journey.stops[stop.from].lat == null ? 'abroad' : `+${fmt(legMiles(journey.stops[stop.from], stop))} mi`}</span>
            </li>
          ))}
        </ol>
        <p className={styles.fine}>{daysLine(journey.days)}</p>
        <p className={styles.goal} data-testid="journeyGoal">{journey.goal.line}</p>
        <Link href="/cards" className={styles.start} data-testid="journeyStart">Start a card of your own</Link>
      </div>
    </main>
  );
}

export function JourneyTrouble() {
  return (
    <main className={styles.page}>
      <div className={styles.column}>
        <p className={styles.eyebrow}>Pantopus Post</p>
        <p className={styles.trouble}>Couldn’t load this journey just now. Try again in a moment.</p>
      </div>
    </main>
  );
}
