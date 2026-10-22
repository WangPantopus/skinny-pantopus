'use client';

// 12:40 — the household. A window is lit for each person; when the
// section comes into view, Sam finishes a task and every lit window
// glows, the way the household sees a task completed.

import { useEffect, useRef, useState } from 'react';
import TimeMark from './TimeMark';
import { useInViewOnce } from './useInViewOnce';
import styles from './home.module.css';

const PEOPLE = [
  { name: 'You', role: 'Owner', initial: 'Y', color: '#0A5C8C' },
  { name: 'Alex', role: 'Member', initial: 'A', color: '#7A4FA0' },
  { name: 'Sam', role: 'Member', initial: 'S', color: '#1F7A4D' },
];

/** Window positions; the fourth room has nobody in it yet. */
const WINDOWS: Array<[number, number]> = [[150, 116], [298, 116], [150, 210], [330, 210]];

function Check({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} aria-hidden="true">
      <path d="M5 12.5L10 17.5L19 7" />
    </svg>
  );
}

export default function HouseholdSection() {
  const ref = useRef<HTMLElement | null>(null);
  const seen = useInViewOnce(ref);
  const [run, setRun] = useState(0);
  const [done, setDone] = useState(false);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!seen) return;
    setDone(false);
    const a = window.setTimeout(() => {
      setDone(true);
      setPulse(true);
    }, 1400);
    const b = window.setTimeout(() => setPulse(false), 2800);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [seen, run]);

  return (
    <section ref={ref} className={styles.household} aria-labelledby="household-title">
      <div className={`${styles.wrap} ${styles.splitCenter}`}>
        <div className={styles.copy}>
          <TimeMark time="12:40 · Midday" topic="Household" icon="sun" />
          <h2 id="household-title" className={styles.h2}>You don’t have to be the household’s memory.</h2>
          <p className={styles.lede}>
            Invite the people you live with. Give a task an owner and a due date, keep documents where the right people can
            find them, and see when something’s done. For the place you own, rent or share.
          </p>
          <p className={styles.note}>An accepted invitation gives household tools. Address verification is a separate step.</p>
        </div>

        <div className={styles.visual} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className={styles.houseCard}>
            <svg viewBox="0 0 520 290" role="img" aria-label="A house with three lit windows, one for each person in the household">
              <defs>
                <filter id="household-glow" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="10" />
                </filter>
              </defs>
              <rect x="110" y="96" width="300" height="194" fill="#F3F6FA" stroke="#C5D0DD" strokeWidth={2} />
              <polygon points="92,100 260,18 428,100" fill="#2B3A55" />
              <rect x="330" y="34" width="22" height="52" fill="#2B3A55" />
              <rect x="326" y="30" width="30" height="8" fill="#2B3A55" />
              {WINDOWS.map(([x, y], i) => {
                const lit = i < PEOPLE.length;
                return (
                  <g key={`${x}-${y}`}>
                    <rect
                      x={x - 16}
                      y={y - 14}
                      width="104"
                      height="84"
                      rx="12"
                      fill="#FFC867"
                      filter="url(#household-glow)"
                      className={styles.windowGlow}
                      opacity={lit ? (pulse ? 0.95 : 0.38) : 0}
                    />
                    <rect x={x} y={y} width="72" height="56" rx="4" fill={lit ? '#FFD27A' : '#CFD9E5'} stroke="#AEBBCB" strokeWidth={2} />
                    <path d={`M${x + 36} ${y}V${y + 56}`} stroke="#AEBBCB" strokeWidth={2} />
                  </g>
                );
              })}
              <rect x="236" y="214" width="48" height="76" rx="4" fill="#2B3A55" />
              <circle cx="276" cy="254" r="3" fill="#FFC867" />
            </svg>
          </div>

          <div className={styles.people}>
            {PEOPLE.map((p) => (
              <span key={p.name} className={styles.person}>
                <span className={styles.avatar} style={{ background: p.color }} aria-hidden="true">{p.initial}</span>
                <span className={styles.personName}>
                  {p.name}
                  <span className={styles.personRole}>{p.role}</span>
                </span>
              </span>
            ))}
          </div>

          <ul className={styles.tasks} aria-live="polite" style={{ listStyle: 'none', margin: 0 }}>
            <li className={styles.task}>
              <span className={styles.taskIcon} style={{ background: '#E5F4EC' }}><Check color="#1F7A4D" /></span>
              <span className={styles.taskText}>
                <span className={styles.taskTitle}>Replace the furnace filter</span>
                <span className={styles.taskMeta}>Alex · done at 12:40 PM</span>
              </span>
            </li>
            <li className={styles.task}>
              <span className={styles.taskIcon} style={{ background: done ? '#E5F4EC' : '#FFF4DE' }}>
                {done ? (
                  <Check color="#1F7A4D" />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A5A06" strokeWidth={2} aria-hidden="true">
                    <circle cx="12" cy="12" r="8.5" />
                    <path d="M12 7.5V12L15 14" />
                  </svg>
                )}
              </span>
              <span className={styles.taskText}>
                <span className={styles.taskTitle}>Order a radon test kit</span>
                <span className={styles.taskMeta}>{done ? 'Sam · done just now · the household sees it' : 'Sam · due Saturday · reminder that morning'}</span>
              </span>
              {done ? (
                <button type="button" className={styles.textBtn} onClick={() => setRun((r) => r + 1)}>Play again</button>
              ) : null}
            </li>
            <li className={styles.task}>
              <span className={styles.taskIcon} style={{ background: '#E6EFF7', borderRadius: 9 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0A5C8C" strokeWidth={1.8} aria-hidden="true">
                  <path d="M7 3H14L19 8V21H7Z" />
                  <path d="M14 3V8H19" />
                </svg>
              </span>
              <span className={styles.taskText}>
                <span className={styles.taskTitle}>Home insurance policy</span>
                <span className={styles.taskMeta}>Document · visible to you and Alex</span>
              </span>
            </li>
          </ul>
          <span className={styles.label} style={{ color: '#5B6878' }}>Example household</span>
        </div>
      </div>
    </section>
  );
}
