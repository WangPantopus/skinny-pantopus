'use client';

// 18:30 — Plans. An example plan plays itself when the section comes
// into view: someone asks to join, the host accepts, and the soft area
// on the map sharpens into the exact spot with the plan chat. Before
// acceptance only the area and the time are shown, as in the app.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getStoreDownloadCta, type StoreDownloadCta } from '@/lib/publicShare';
import TimeMark from './TimeMark';
import { useInViewOnce } from './useInViewOnce';
import styles from './home.module.css';

type Phase = 'idle' | 'requested' | 'accepted';

const ACCEPT_AFTER_MS = 1700;

function Cup({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#9A4F2E" strokeWidth={1.7} aria-hidden="true">
      <path d="M5 9H16V14A5 5 0 0 1 11 19H10A5 5 0 0 1 5 14Z" />
      <path d="M16 10H18A2 2 0 0 1 18 14H16M8 3V6M12 3V6" />
    </svg>
  );
}

const KINDS = [
  { name: 'Walk and coffee', icon: <Cup /> },
  {
    name: 'Pickup game',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9A4F2E" strokeWidth={1.7} aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M3.5 12H20.5M12 3.5C9 6.5 9 17.5 12 20.5M12 3.5C15 6.5 15 17.5 12 20.5" />
      </svg>
    ),
  },
  {
    name: 'Watch party',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9A4F2E" strokeWidth={1.7} aria-hidden="true">
        <rect x="3" y="5" width="18" height="12" rx="2" />
        <path d="M8 21H16M12 17V21" />
      </svg>
    ),
  },
  {
    name: 'Study group',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9A4F2E" strokeWidth={1.7} aria-hidden="true">
        <path d="M4 5H10A2 2 0 0 1 12 7V20A2 2 0 0 0 10 18H4Z" />
        <path d="M20 5H14A2 2 0 0 0 12 7V20A2 2 0 0 1 14 18H20Z" />
      </svg>
    ),
  },
];

export default function PlansSection() {
  const ref = useRef<HTMLElement | null>(null);
  const seen = useInViewOnce(ref);
  const [phase, setPhase] = useState<Phase>('idle');
  const [store, setStore] = useState<StoreDownloadCta | null>(null);

  useEffect(() => {
    setStore(getStoreDownloadCta(navigator.userAgent));
  }, []);

  // Seen for the first time: the example asks to join on its own.
  useEffect(() => {
    if (!seen) return;
    const id = window.setTimeout(() => setPhase((p) => (p === 'idle' ? 'requested' : p)), 1000);
    return () => window.clearTimeout(id);
  }, [seen]);

  useEffect(() => {
    if (phase !== 'requested') return;
    const id = window.setTimeout(() => setPhase('accepted'), ACCEPT_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  const accepted = phase === 'accepted';

  return (
    <section ref={ref} id="plans" className={styles.plans} aria-labelledby="plans-title">
      <div className={`${styles.wrap} ${styles.split}`}>
        <div className={styles.copy}>
          <TimeMark time="18:30 · Golden hour" topic="Plans" icon="golden" />
          <h2 id="plans-title" className={styles.h2}>Good company can start with a small plan.</h2>
          <p className={styles.lede}>
            Walk and coffee. A pickup game. A watch party. A study group. Find one nearby, ask to join, and get the exact
            spot once the host says yes.
          </p>
          <div className={styles.kinds}>
            {KINDS.map((k) => (
              <span key={k.name} className={styles.kind}>{k.icon}{k.name}</span>
            ))}
            <span className={styles.kindExtra}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9A4F2E" strokeWidth={1.7} aria-hidden="true">
                <rect x="4" y="12" width="7" height="7" rx="1.5" />
                <rect x="13" y="12" width="7" height="7" rx="1.5" />
                <rect x="8.5" y="4.5" width="7" height="7" rx="1.5" />
              </svg>
              Playdate, with extra rules
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: '#4A4452' }}>
            Hosts choose how people join: they approve each person, or let in verified neighbors, people they’ve hosted
            before, or anyone nearby for walks and pickup games. Playdates need verified addresses and a public place, the
            host approves each family, and a parent stays.
          </p>

          <div className={styles.share}>
            <span className={styles.label} style={{ color: '#5E4E58' }}>Send a plan to a friend</span>
            <span className={styles.bubble}>Want to come along on Saturday?</span>
            <span className={styles.linkCard}>
              <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true" style={{ flex: '0 0 auto', borderRadius: 12 }}>
                <rect width="64" height="64" fill="#EEE7DE" />
                <path d="M-4 48C14 42 30 54 48 46S68 42 70 44V70H-4Z" fill="#BFD7E8" />
                <rect x="18" y="16" width="30" height="22" rx="4" fill="#CFE2C6" />
                <circle cx="33" cy="27" r="16" fill="#0A5C8C" opacity={0.16} />
                <circle cx="33" cy="27" r="16" fill="none" stroke="#0A5C8C" strokeWidth={1.2} strokeDasharray="2 3" />
              </svg>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontWeight: 600, fontSize: 14.5 }}>Walk and coffee · Sat 10:00 AM</span>
                <span style={{ fontSize: 13, color: '#5E5866' }}>Near the riverfront park</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#6E6878' }}>pantopus.com/plans/…</span>
              </span>
            </span>
            <span style={{ fontSize: 13.5, color: '#5E5866' }}>The link shows the area and the time, even before they have the app.</span>
          </div>

          <div className={styles.ctaRow}>
            {store ? (
              <a href={store.href} className={styles.btnInk} rel="noopener">{store.label}</a>
            ) : (
              <>
                <Link href="/start" className={styles.btnInk}>Start with your place</Link>
                <span className={styles.note} style={{ color: '#5E5866' }}>Plans is in the Pantopus app for iPhone and Android.</span>
              </>
            )}
          </div>
        </div>

        <div className={styles.visual}>
          <div className={styles.mapPanel}>
            <div className={styles.map}>
              <svg
                viewBox="0 0 640 400"
                preserveAspectRatio="xMidYMid slice"
                role="img"
                aria-label={accepted ? 'A map with the exact meeting spot marked, shown after the host accepted' : 'A map with a soft circle around the park: the plan’s area, without the exact spot'}
              >
                <rect width="640" height="400" fill="#EEE7DE" />
                {[[30, 20, 110, 70], [190, 20, 150, 60], [540, 30, 90, 80], [30, 140, 110, 120], [540, 150, 90, 110]].map(([x, y, w, h]) => (
                  <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx="6" fill="#E4DACD" />
                ))}
                <path d="M-20 330C110 300 250 370 390 336S590 296 680 312V420H-20Z" fill="#BFD7E8" />
                <path d="M210 120L430 104L470 262L240 286Z" fill="#CFE2C6" />
                <path d="M260 150C300 130 400 130 420 180S380 260 320 250 230 200 260 150Z" fill="none" stroke="#B2CFA6" strokeWidth={4} />
                <circle cx="338" cy="190" r="12" fill="#BFD7E8" stroke="#A6C4D8" strokeWidth={2} />
                <path d="M-10 108H660M-10 296H660M170 -10V420M505 -10V420" stroke="#FFFFFF" strokeWidth={12} strokeLinecap="round" />
                <path d="M-10 40L170 108M505 108L660 60M330 -10V104" stroke="#FFFFFF" strokeWidth={6} strokeLinecap="round" />
                <text x="252" y="278" fill="#6E8466" fontSize="11" letterSpacing="1.5" style={{ fontFamily: 'var(--mono)' }}>RIVERFRONT PARK</text>
                <g className={accepted ? styles.areaGone : styles.area}>
                  <circle cx="335" cy="186" r="92" fill="#0A5C8C" opacity={0.14} />
                  <circle cx="335" cy="186" r="92" fill="none" stroke="#0A5C8C" strokeWidth={2} strokeDasharray="5 7" />
                </g>
                <g className={accepted ? styles.pinShown : styles.pin}>
                  <ellipse cx="338" cy="168" rx="9" ry="3.5" fill="#1A1724" opacity={0.25} />
                  <path d="M338 168C329 157 324 150 324 143A14 14 0 1 1 352 143C352 150 347 157 338 168Z" fill="#C2410C" />
                  <circle cx="338" cy="143" r="5" fill="#FFFFFF" />
                </g>
              </svg>
              <span className={accepted ? styles.mapLegendIn : styles.mapLegend}>
                {accepted ? 'Accepted · exact spot and chat' : 'Public preview · area and time only'}
              </span>
            </div>

            <div className={styles.planSheet} aria-live="polite">
              <div className={styles.planTop}>
                <span className={styles.planName}><span className={styles.planIcon}><Cup size={18} /></span>Walk and coffee</span>
                <span className={styles.label} style={{ color: '#6E6878', fontSize: 11 }}>Example plan</span>
              </div>
              <div className={styles.planMeta}>
                <span>Saturday, 10:00 AM · about an hour</span>
                <span>Hosted by Maya · 3 going</span>
              </div>
              <div className={styles.planPlace}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accepted ? '#C2410C' : '#0A5C8C'} strokeWidth={1.8} aria-hidden="true" style={{ flex: '0 0 auto', marginTop: 2 }}>
                  <path d="M12 22C8.5 17.5 6 14.2 6 10.5A6 6 0 1 1 18 10.5C18 14.2 15.5 17.5 12 22Z" />
                  <circle cx="12" cy="10.5" r="2" />
                </svg>
                {accepted ? 'North entrance, by the fountain' : 'Near the riverfront park'}
              </div>
              {phase === 'idle' ? (
                <div className={styles.ctaRow}>
                  <button type="button" className={styles.btnInk} onClick={() => setPhase('requested')}>Ask to join</button>
                  <span style={{ fontSize: 13.5, color: '#5E5866' }}>Maya approves each person.</span>
                </div>
              ) : phase === 'requested' ? (
                <span className={styles.planStatus}><span className={styles.dot} />Request sent. Maya reviews each request.</span>
              ) : (
                <>
                  <span className={styles.planIn}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
                      <path d="M5 12.5L10 17.5L19 7" />
                    </svg>
                    Maya said yes. You’re in.
                  </span>
                  <span className={styles.chatLine}><b style={{ fontWeight: 600 }}>Maya</b> · Look for the red umbrella. See you at 10.</span>
                  <button type="button" className={styles.textBtn} style={{ alignSelf: 'flex-start', color: '#5E4E58' }} onClick={() => setPhase('idle')}>
                    Play again
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
