'use client';

// 19:45 — Nearby, at dusk. The far hill's windows are the verified homes
// around you, one ~1 km cell at a time (Neighborhood's density map);
// when the section comes into view more cells light, the way the hill
// fills in as neighbors join. Below: Pulse and a Support Train.

import { useEffect, useRef, useState } from 'react';
import LivingSky from './LivingSky';
import TimeMark from './TimeMark';
import { useInViewOnce } from './useInViewOnce';
import styles from './home.module.css';

const CELLS = 8;
const FIRST_LIT = 3;
const LAST_LIT = 6;
/** Example counts of verified homes for each number of lit cells. */
const HOMES_FOR_CELLS = [0, 4, 9, 14, 19, 23, 28, 33, 37];

const POSTS = [
  { tag: 'Question', tagBg: '#2C3B73', tagInk: '#C9D7FF', who: 'Dana', where: 'Maple St', when: '18 min', text: 'Does anyone know when leaf pickup starts on the east side?', foot: '4 replies' },
  { tag: 'Useful update', tagBg: '#1F4A3A', tagInk: '#BDEBD2', who: 'Priya', where: '33rd St', when: '1 hr', text: 'The crosswalk signal by the elementary school is working again.', foot: '2 replies' },
  { tag: 'Local news', tagBg: '#4A3A1F', tagInk: '#FFE2A8', who: 'Pantopus Local', where: 'labeled publisher', when: '2 hr', text: 'Library story time moves to 10:30 this Saturday.', foot: 'Source linked' },
];

const TRAIN_DAYS = ['S', 'S', 'M', 'T', 'W', 'T', 'F', 'S', 'S', 'M', 'T', 'W', 'T', 'F'];
const TRAIN_COVERED = new Set([0, 1, 2, 3, 5, 6, 8, 10, 12]);

export default function NearbySection() {
  const ref = useRef<HTMLElement | null>(null);
  const seen = useInViewOnce(ref, 0.25);
  const [lit, setLit] = useState(FIRST_LIT);

  useEffect(() => {
    if (!seen) return;
    const id = window.setInterval(() => {
      setLit((n) => {
        if (n >= LAST_LIT) {
          window.clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, 800);
    return () => window.clearInterval(id);
  }, [seen]);

  return (
    <section ref={ref} className={styles.nearby} aria-labelledby="nearby-title">
      <div className={styles.dusk}>
        <LivingSky
          className={styles.sky}
          hour={19.75}
          rise={false}
          homes={lit / CELLS}
          cells
          houseX={0.72}
          houseXNarrow={0.4}
          horizon={0.88}
          label="The hill at dusk, with a window lit for each verified home nearby"
        />
        <div className={styles.duskInner}>
          <div className={styles.copy} style={{ maxWidth: 600 }}>
            <TimeMark time="19:45 · Dusk" topic="Nearby" icon="moon" night />
            <h2 id="nearby-title" className={styles.h2}>Get to know the life around you.</h2>
            <p className={styles.lede}>
              Pulse is the local conversation: questions, useful updates and nearby news, with no crime or
              suspicious-person alerts. Neighborhood shows how many verified homes are around you, and fills in as
              neighbors join.
            </p>
          </div>
          <div className={styles.meter}>
            <span className={styles.label} style={{ color: '#FFC867', fontSize: 11 }}>Neighborhood · ~1 km cells around you</span>
            <div className={styles.meterCount}>
              <span className={styles.meterNumber}>{HOMES_FOR_CELLS[lit]}</span>
              <span style={{ fontSize: 15, color: '#C9D3E3' }}>verified homes nearby</span>
            </div>
            <div className={styles.cells} aria-hidden="true">
              {Array.from({ length: CELLS }, (_, i) => (
                <svg key={i} width="30" height="30" viewBox="0 0 30 30">
                  <polygon
                    className={styles.cell}
                    points="27,22 15,29 3,22 3,8 15,1 27,8"
                    fill={i < lit ? 'rgba(255, 200, 103, 0.85)' : 'rgba(255, 200, 103, 0.06)'}
                    stroke="#FFC867"
                    strokeWidth={1.2}
                  />
                </svg>
              ))}
            </div>
            <span style={{ fontSize: 14, color: '#C9D3E3' }} aria-live="polite">{lit} of {CELLS} cells around you have verified homes</span>
            <span style={{ fontSize: 14, lineHeight: 1.5, color: '#C9D3E3' }}>
              Invite your neighbors from Neighborhood, and the hill fills in.
            </span>
            <span className={styles.label} style={{ color: '#9FB0C6', fontSize: 11 }}>Example numbers</span>
          </div>
        </div>
        <div className={styles.duskSpace} aria-hidden="true" />
      </div>

      <div className={styles.nearbyBody}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 32 }}>
          <div className={styles.pulse}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px 16px' }}>
              <span className={styles.label} style={{ color: '#FFC867' }}>Pulse · example posts</span>
              <span style={{ fontSize: 14, color: '#B9C4D6' }}>Calm by design. No crime or suspicious-person alerts.</span>
            </div>
            {POSTS.map((p) => (
              <article key={p.text} className={styles.post}>
                <div className={styles.postMeta}>
                  <span className={styles.tag} style={{ background: p.tagBg, color: p.tagInk }}>{p.tag}</span>
                  <span className={styles.postWho}>{p.who}</span>
                  <span>{p.where}</span>
                  <span>· {p.when}</span>
                </div>
                <p className={styles.postText}>{p.text}</p>
                <span className={styles.postFoot}>{p.foot}</span>
              </article>
            ))}
          </div>

          <div className={styles.train}>
            <span className={styles.label} style={{ color: '#8A5A06', fontSize: 12 }}>Support Train · example</span>
            <span className={styles.trainTitle}>Dinners for a neighbor after surgery</span>
            <span style={{ fontSize: 14, color: '#5E5866' }}>Organized by Lee · two weeks of dinners</span>
            <div className={styles.slots} role="img" aria-label="Fourteen dinner slots, nine of them covered">
              {TRAIN_DAYS.map((d, i) => (
                <span key={i} className={TRAIN_COVERED.has(i) ? styles.slotFilled : styles.slot}>{d}</span>
              ))}
            </div>
            <span style={{ fontSize: 15, fontWeight: 600 }}>9 of 14 dinners covered</span>
            <span style={{ fontSize: 14.5, lineHeight: 1.5, color: '#4A4452' }}>
              When someone needs help, a Support Train organizes meals and practical help. Friends can sign up by email, no
              app needed.
            </span>
          </div>
        </div>
        <p className={styles.coldStart}>
          Your place, Today and household tools work for one person on day one. Nearby fills in as neighbors join.
        </p>
      </div>
    </section>
  );
}
