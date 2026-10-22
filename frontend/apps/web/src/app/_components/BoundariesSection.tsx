'use client';

// 21:30 — what each kind of person sees. One house, redrawn through
// three lenses: someone looking up the address, a household member, and
// an accepted plan guest.

import { useState } from 'react';
import Link from 'next/link';
import TimeMark from './TimeMark';
import styles from './home.module.css';

type Lens = 'visitor' | 'household' | 'guest';

const LENSES: Array<{ id: Lens; name: string }> = [
  { id: 'visitor', name: 'A visitor' },
  { id: 'household', name: 'A household member' },
  { id: 'guest', name: 'A plan guest' },
];

const ROWS = [
  'Public facts about the address',
  'Who lives there',
  'Household tasks and documents',
  'The plan’s area and time',
  'The plan’s exact spot and chat',
];

const SEES: Record<Lens, boolean[]> = {
  visitor: [true, false, false, true, false],
  household: [true, true, true, true, false],
  guest: [true, false, false, true, true],
};

const NOTES: Record<Lens, string[]> = {
  visitor: ['', '', '', '', ''],
  household: ['', 'their household', 'by role', '', 'if they join'],
  guest: ['', '', '', '', 'after the host accepts'],
};

const LINES: Record<Lens, string> = {
  visitor: 'Someone who types an address sees public facts, and a plan’s area and time. Nothing about who lives there.',
  household: 'A household member sees the home’s facts, and the tasks and documents their role allows.',
  guest: 'An accepted plan guest gets the exact meeting spot and the plan chat. Nothing about the host’s home.',
};

export default function BoundariesSection() {
  const [lens, setLens] = useState<Lens>('visitor');
  const sees = SEES[lens];
  const fade = (on: boolean) => ({ opacity: on ? 1 : 0.12 });

  return (
    <section id="boundaries" className={styles.nightSection} aria-labelledby="boundaries-title">
      <div className={`${styles.wrap} ${styles.stack32}`}>
        <div className={styles.head}>
          <TimeMark time="21:30 · Night" topic="Boundaries" icon="moon" night />
          <h2 id="boundaries-title" className={styles.h2}>A nearby world. Clear boundaries.</h2>
          <p className={styles.lede}>
            Looking up an address shows public information. It never opens a household’s tasks or documents. Household
            members see what their role allows. Plan guests get the exact spot after the host accepts.
          </p>
        </div>

        <div className={styles.lensSwitch} role="group" aria-label="See it as">
          {LENSES.map((l) => (
            <button key={l.id} type="button" className={styles.lensBtn} aria-pressed={lens === l.id} onClick={() => setLens(l.id)}>
              {l.name}
            </button>
          ))}
        </div>

        <div className={styles.lensView}>
          <div className={styles.lensArt}>
            <svg viewBox="0 0 440 260" role="img" aria-label={LINES[lens]}>
              <rect width="440" height="260" rx="16" fill="#0E1729" />
              <circle cx="170" cy="130" r="118" fill="none" stroke="#7CC0EA" strokeWidth={1.5} strokeDasharray="4 6" />
              <text x="66" y="34" fill="#7CC0EA" fontSize="11" letterSpacing="1" style={{ fontFamily: 'var(--mono)' }}>PUBLIC FACTS</text>
              <rect x="104" y="112" width="132" height="100" fill="#1E2A44" stroke="#33415F" strokeWidth={2} />
              <polygon points="94,114 170,62 246,114" fill="#26344F" />
              {[[122, 128, 34, 28], [184, 128, 34, 28], [156, 170, 28, 42]].map(([x, y, w, h]) => (
                <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx="3" fill={sees[2] ? '#FFC867' : '#2A3653'} className={styles.lensFade} />
              ))}
              <text x="104" y="232" fill="#FFC867" fontSize="11" letterSpacing="1" className={styles.lensFade} style={{ fontFamily: 'var(--mono)', ...fade(sees[2]) }}>
                TASKS · DOCUMENTS
              </text>
              <line x1="246" y1="212" x2="420" y2="212" stroke="#33415F" strokeWidth={2} />
              <g className={styles.lensFade} style={fade(sees[3])}>
                <circle cx="350" cy="140" r="46" fill="#7CC0EA" opacity={0.12} />
                <circle cx="350" cy="140" r="46" fill="none" stroke="#7CC0EA" strokeWidth={1.5} strokeDasharray="3 5" />
                <text x="306" y="80" fill="#7CC0EA" fontSize="11" letterSpacing="1" style={{ fontFamily: 'var(--mono)' }}>PLAN AREA</text>
              </g>
              <g className={styles.lensFade} style={fade(sees[4])}>
                <path d="M350 152C343 143 339 138 339 132A11 11 0 1 1 361 132C361 138 357 143 350 152Z" fill="#F2B24E" />
                <circle cx="350" cy="132" r="4" fill="#0E1729" />
                <text x="316" y="178" fill="#F2B24E" fontSize="11" letterSpacing="1" style={{ fontFamily: 'var(--mono)' }}>EXACT SPOT</text>
              </g>
            </svg>
            <span aria-live="polite">{LINES[lens]}</span>
          </div>
          <ul className={styles.lensRows}>
            {ROWS.map((text, i) => (
              <li key={text} className={sees[i] ? styles.lensRowSeen : styles.lensRow}>
                <span className={styles.lensMark} aria-hidden="true">{sees[i] ? '✓' : '–'}</span>
                <span>{text}</span>
                <span className={styles.lensState}>{NOTES[lens][i] || (sees[i] ? 'sees' : 'hidden')}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.promises}>
          <div className={styles.promise}>
            <strong>A first name and a street, at most</strong>
            <span>Neighbors never see your house number or unit.</span>
          </div>
          <div className={styles.promise}>
            <strong>Never sold, never used for ads</strong>
            <span>Your address stays yours.</span>
          </div>
          <div className={styles.promise}>
            <strong>Verification has one purpose</strong>
            <span>It unlocks features that need it, like messaging verified neighbors. Ownership is confirmed separately.</span>
          </div>
        </div>
        <Link href="/privacy" className={styles.nightLink}>Read about privacy</Link>
      </div>
    </section>
  );
}
