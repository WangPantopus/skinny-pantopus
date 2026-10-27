'use client';

// The Ballot band, shown through Election Day (page.tsx leaves it out
// after BALLOT_BAND_UNTIL). The day count uses the visitor's own date,
// so it is filled in after hydration.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './home.module.css';

export default function BallotBand() {
  const [days, setDays] = useState<number | null>(null);

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const electionDay = new Date(2026, 10, 3);
    setDays(Math.round((electionDay.getTime() - today.getTime()) / 86_400_000));
  }, []);

  if (days !== null && days < 0) return null;

  return (
    <div className={styles.ballot}>
      <div className={styles.ballotCopy}>
        <span className={styles.label} style={{ color: '#FFC867' }}>Your ballot · through November 3</span>
        <span className={styles.ballotTitle}>Election Day is Tuesday, November 3.</span>
        <span style={{ fontSize: 15.5, lineHeight: 1.55, color: '#C9D4E3' }}>
          See the governments on your ballot and the dates that apply where you live.
        </span>
      </div>
      <div className={styles.ballotCount}>
        {days !== null ? (
          <div className={styles.ballotDays}>
            <span className={styles.ballotNumber}>{days === 0 ? 'Today' : days}</span>
            {days === 0 ? null : <span className={styles.label} style={{ color: '#A9B6C8' }}>{days === 1 ? 'day to go' : 'days to go'}</span>}
          </div>
        ) : null}
        <Link href="/start" className={styles.btnLamp}>See your ballot</Link>
      </div>
    </div>
  );
}
