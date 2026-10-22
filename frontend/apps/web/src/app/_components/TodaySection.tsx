'use client';

// 07:30 → 20:00 — Today, on a phone. The sky card is the Living Sky;
// dragging the slider (or picking a moment) moves it through the day,
// and the rows under it change the way Today's do: the morning's task,
// the midday "done", the pickup eve with the bins at the curb.

import { useState } from 'react';
import Link from 'next/link';
import LivingSky from './LivingSky';
import TimeMark from './TimeMark';
import { formatHour, isNightHour } from './skyScene';
import styles from './home.module.css';

type RowKind = 'pickup' | 'done' | 'due' | 'radon' | 'later';
type Row = { kind: RowKind; label: string; title: string; body: string };

const ROWS: Record<RowKind, Row> = {
  due: { kind: 'due', label: 'Due today', title: 'Replace the furnace filter', body: 'Assigned to Alex · reminder this morning' },
  done: { kind: 'done', label: 'Done · 12:40 PM', title: 'Alex finished “Replace the furnace filter”', body: 'Everyone in the household sees it.' },
  radon: { kind: 'radon', label: 'Test for radon?', title: 'Your county is EPA radon zone 1', body: 'Only a test tells you about your home. Add a test-kit task.' },
  pickup: { kind: 'pickup', label: 'Pickup tomorrow', title: 'Garbage and recycling', body: 'Bins out tonight. Your household confirmed this day.' },
  later: { kind: 'later', label: 'Due Saturday', title: 'Clean the gutters', body: 'Assigned to you · reminder that morning' },
};

const TINT: Record<RowKind, [string, string]> = {
  pickup: ['#FFF4DE', '#8A5A06'],
  done: ['#E5F4EC', '#1F7A4D'],
  due: ['#E6EFF7', '#0A5C8C'],
  radon: ['#E6EFF7', '#0A5C8C'],
  later: ['#EEF0FA', '#4B4FA0'],
};

const MOMENTS = [
  { hour: 7, time: '07:00', title: 'Morning brief', text: 'The weather and air, and what’s due: replace the furnace filter.' },
  { hour: 12.75, time: '12:40', title: 'A task gets done', text: 'Alex finished the filter. Nobody has to ask.' },
  { hour: 19.5, time: '19:30', title: 'Pickup eve', text: 'Garbage and recycling tomorrow. Bins out tonight.' },
];

function RowIcon({ kind }: { kind: RowKind }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      {kind === 'pickup' ? (
        <>
          <path d="M6 8H18L17 21H7Z" />
          <path d="M4.5 8H19.5M10 5H14V8H10Z" />
        </>
      ) : kind === 'done' ? (
        <path d="M5 12.5L10 17.5L19 7" strokeWidth={2.2} />
      ) : kind === 'due' || kind === 'later' ? (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12L15 14" />
        </>
      ) : (
        <>
          <path d="M3 20H21M5 20V10L12 4L19 10V20" />
          <circle cx="12" cy="14" r="2.2" />
        </>
      )}
    </svg>
  );
}

export default function TodaySection() {
  const [hour, setHour] = useState(7);
  const evening = hour >= 17 || hour < 5;
  const midday = hour >= 11 && hour < 17;
  const rows = evening ? [ROWS.pickup, ROWS.done, ROWS.later] : midday ? [ROWS.done, ROWS.radon, ROWS.later] : [ROWS.due, ROWS.radon, ROWS.later];
  const activeMoment = evening ? 2 : midday ? 1 : 0;
  const temp = Math.round(46 + 12 * Math.max(0, Math.sin((Math.PI * (hour - 7)) / 14)));
  const daylight = hour > 6.8 && hour < 18.6;
  const skyInk = isNightHour(hour) ? '#F3F6FB' : '#0F1A28';

  return (
    <section className={styles.today} aria-labelledby="today-title">
      <div className={`${styles.wrap} ${styles.split}`}>
        <div className={styles.copy}>
          <TimeMark time="07:30 → 20:00 · Through the day" topic="Today" icon="sun" />
          <h2 id="today-title" className={styles.h2}>A little less to keep in your head.</h2>
          <p className={styles.lede}>
            Today puts the weather outside next to what’s due inside. Confirm your pickup day once and get a reminder the
            evening before. Turn a radon zone into a test-kit task. Briefings come only when there’s something useful.
          </p>
          <p className={styles.kicker}>Remember the bins. Share the task. Know what’s handled.</p>
          <div className={styles.moments} role="group" aria-label="Moments of the day">
            {MOMENTS.map((m, i) => (
              <button
                key={m.time}
                type="button"
                aria-pressed={activeMoment === i}
                className={activeMoment === i ? styles.momentActive : styles.moment}
                onClick={() => setHour(m.hour)}
              >
                <span className={styles.momentTime}>{m.time}</span>
                <span className={styles.momentText}>
                  <span style={{ fontWeight: 600, fontSize: 15.5 }}>{m.title}</span>
                  <span style={{ fontSize: 14.5, color: '#4F5D6E' }}>{m.text}</span>
                </span>
              </button>
            ))}
          </div>
          <p className={styles.note}>Pickup reminders go out only for a day your household confirmed. Examples shown.</p>
          <div className={styles.ctaRow}>
            <Link href="/start" className={styles.btn}>Start with your home</Link>
          </div>
        </div>

        <div className={styles.phoneCol}>
          <div className={styles.phone}>
            <div className={styles.screen}>
              <div className={styles.appBar}>
                <span className={styles.appMenu} aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F1A28" strokeWidth={1.8}>
                    <path d="M4 7H20M4 12H20M4 17H20" />
                  </svg>
                </span>
                Today
              </div>
              <div className={styles.skyCard}>
                <LivingSky
                  className={styles.sky}
                  hour={hour}
                  rise={false}
                  homes={0.5}
                  houseX={0.4}
                  houseXNarrow={0.4}
                  scale={0.95}
                  label={`The Today sky at ${formatHour(hour)}`}
                />
                <div className={styles.skyReadout} style={{ color: skyInk }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span className={styles.label} style={{ fontSize: 11 }}>{formatHour(hour)}</span>
                    <span className={styles.skyTemp}>{temp}°</span>
                    <span style={{ fontSize: 13 }}>{daylight ? 'Clear' : 'Clear night'} · Air moderate</span>
                  </div>
                  {hour >= 17 && hour < 23.9 ? <span className={styles.binsChip}>Bins out tonight</span> : null}
                </div>
              </div>
              <div className={styles.rows} aria-live="polite">
                {rows.map((r, i) => (
                  <div key={r.kind} className={i === 0 && r.kind === 'pickup' ? styles.rowHot : styles.row}>
                    <span className={styles.rowIcon} style={{ background: TINT[r.kind][0], color: TINT[r.kind][1] }}>
                      <RowIcon kind={r.kind} />
                    </span>
                    <span className={styles.rowText}>
                      <span className={styles.rowLabel}>{r.label}</span>
                      <span className={styles.rowTitle}>{r.title}</span>
                      <span className={styles.rowBody}>{r.body}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className={styles.scrub}>
            <div className={styles.scrubHead}>
              <label htmlFor="today-hour" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>Drag through the day</label>
              <span style={{ fontVariantNumeric: 'tabular-nums', color: '#0F1A28' }}>{formatHour(hour)}</span>
            </div>
            <input
              id="today-hour"
              type="range"
              min={0}
              max={23.75}
              step={0.25}
              value={hour}
              onChange={(e) => setHour(Number(e.target.value))}
              aria-valuetext={formatHour(hour)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
