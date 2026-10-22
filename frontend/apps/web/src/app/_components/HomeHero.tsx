'use client';

// ============================================================
// The hero — "Your place, alive."
//
// The Living Sky drawn for the visitor's own clock behind the
// headline, and the address field that does what the page promises:
// pick an address and three sourced facts about it appear over the
// scene, from the same public preview /start shows. "See everything"
// opens /start for that address, which reads the cached preview. If the
// preview takes longer than LOOKUP_PATIENCE_MS, the visitor goes
// straight to /start instead of waiting here.
// ============================================================

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import AddressAutocomplete, { type SelectedAddress } from '@/components/place/AddressAutocomplete';
import { PantopusMark } from '@/components/brand/PantopusMark';
import LivingSky from './LivingSky';
import ScaleGlyph from './ScaleGlyph';
import { heroFacts, scaleWord } from './heroFacts';
import { HERO_ID, formatHour, isNightHour, skyColorsAt } from './skyScene';
import styles from './home.module.css';

const LOOKUP_PATIENCE_MS = 2500;

function startHref(label: string): string {
  return `/start?address=${encodeURIComponent(label)}`;
}

export default function HomeHero() {
  const router = useRouter();
  const [hour, setHour] = useState<number | null>(null);
  const [selected, setSelected] = useState<SelectedAddress | null>(null);
  const [submitted, setSubmitted] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setHour(n.getHours() + n.getMinutes() / 60);
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const preview = useQuery({
    queryKey: ['place', 'public-preview', submitted],
    queryFn: () => api.place.getPublicPlacePreview(submitted as string),
    enabled: !!submitted,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const looking = !!submitted && preview.isFetching && !preview.data;

  // A slow preview shouldn't keep anyone waiting on the homepage.
  useEffect(() => {
    if (!submitted || !looking) return;
    const id = window.setTimeout(() => router.push(startHref(submitted)), LOOKUP_PATIENCE_MS);
    return () => window.clearTimeout(id);
  }, [submitted, looking, router]);

  // Funnel: a preview seen on the homepage. The route is kept unless an
  // earlier visit (a mailed card's ?r=) already set one.
  const status = preview.data?.status ?? null;
  useEffect(() => {
    if (!submitted || !status) return;
    if (!api.getFunnelRoute()) api.rememberFunnelRoute('home');
    api.recordFunnelEvent('t0_preview_viewed', { status, surface: 'home' });
  }, [submitted, status]);

  const phase = hour === null ? undefined : isNightHour(hour) ? 'night' : 'day';
  const colors = hour === null ? null : skyColorsAt(hour);
  const skyVars = colors ? ({ '--sky-top': colors[0], '--sky-bot': colors[2] } as CSSProperties) : undefined;

  const choose = (place: SelectedAddress) => {
    setSelected(place);
    setSubmitted(place.label);
  };
  const go = () => {
    if (!selected) {
      router.push('/start');
    } else if (submitted === selected.label && preview.data) {
      router.push(startHref(selected.label));
    } else {
      setSubmitted(selected.label);
    }
  };

  const data = preview.data;
  const ready = data && (data.status === 'ready' || data.status === 'partial');
  const facts = ready ? heroFacts(data) : [];
  const placeLine = data?.place ? [data.place.address, data.place.city].filter(Boolean).join(', ') : submitted;

  return (
    <header id={HERO_ID} className={styles.hero} data-phase={phase} style={skyVars} suppressHydrationWarning>
      <LivingSky
        className={styles.sky}
        hour={hour ?? undefined}
        houseX={0.66}
        houseXNarrow={0.42}
        horizon={0.84}
        arcNarrow={0.3}
        label={`An illustrated sky at ${hour === null ? 'this hour' : formatHour(hour)} over a house and an apartment block`}
      />

      <nav className={styles.nav} aria-label="Main">
        <Link href="/" className={styles.brand} aria-label="Pantopus home">
          <PantopusMark size={26} variant={phase === 'day' ? 'auto' : 'reverse'} />
          <span className={styles.brandWord}>Pantopus</span>
        </Link>
        <div className={styles.navLinks}>
          <a href="#how-it-works" className={`${styles.navLink} ${styles.navHideSm}`}>How it works</a>
          <a href="#plans" className={`${styles.navLink} ${styles.navHideSm}`}>Plans</a>
          <a href="#boundaries" className={`${styles.navLink} ${styles.navHideSm}`}>Privacy</a>
          <Link href="/about" className={`${styles.navLink} ${styles.navHideSm}`}>About</Link>
          <Link href="/login" className={styles.navLink}>Sign in</Link>
          <Link href="/start" className={styles.navCta}>See your place</Link>
        </div>
      </nav>

      <div className={styles.heroMain}>
        <div className={styles.heroCopy}>
          <span className={styles.heroEyebrow}>Your home and neighborhood, connected</span>
          <h1 className={styles.heroTitle}>
            Your place, <em>alive.</em>
          </h1>
          <p className={styles.heroSub}>
            Pantopus starts with your address. See what’s true about it, keep your household’s everyday on track, and make
            small plans with people nearby.
          </p>
          <div className={styles.lookup}>
            <span className={styles.lookupLabel} aria-hidden="true">Your address</span>
            <div className={styles.lookupRow}>
              <div className={styles.lookupField}>
                <AddressAutocomplete
                  ariaLabel="Your address"
                  placeholder="Start typing your address"
                  onSelect={choose}
                  onClear={() => {
                    setSelected(null);
                    setSubmitted(null);
                  }}
                  onSubmit={go}
                />
              </div>
              <button type="button" className={styles.lookupBtn} onClick={go}>
                {looking ? 'Looking…' : 'See your place'}
              </button>
            </div>
            <div className={styles.scanTrack} aria-hidden="true">
              <div key={submitted ?? 'idle'} className={looking || facts.length ? styles.scanBarRunning : styles.scanBar} />
            </div>
          </div>
          {looking ? (
            <p className={styles.heroStatus} role="status">Reading public records, the sky and civic boundaries for this address…</p>
          ) : preview.isError ? (
            <p className={styles.heroNote} role="alert">
              We couldn’t load this address just now.{' '}
              <button type="button" className={styles.textBtn} onClick={() => preview.refetch()}>Try again</button>
            </p>
          ) : data?.status === 'could_not_place' ? (
            <p className={styles.heroNote} role="alert">We couldn’t find that address. Adding the city and state usually does it.</p>
          ) : data?.status === 'unsupported_region' ? (
            <p className={styles.heroNote} role="alert">Home features are U.S.-only for now. Records and risks come from U.S. public sources.</p>
          ) : (
            <p className={styles.heroNote}>Free to look. No account needed. What’s available varies by location.</p>
          )}
        </div>

        <div className={styles.facts}>
          {ready && submitted ? (
            <div className={styles.factsStack} aria-live="polite">
              <span className={styles.factsHead}>{placeLine}</span>
              {facts.map((f, i) => (
                <div key={f.key} className={styles.fact} style={{ '--delay': `${i * 0.3}s` } as CSSProperties}>
                  <ScaleGlyph scale={f.scale} size={24} />
                  <div className={styles.factText}>
                    <span className={styles.factLabel}>{f.label} · {scaleWord(f.scale)}</span>
                    <span className={styles.factValue}>{f.value}</span>
                    <span className={styles.factSource}>{f.source}</span>
                  </div>
                </div>
              ))}
              <Link
                href={startHref(submitted)}
                className={styles.factsMore}
                style={{ '--delay': `${facts.length * 0.3}s` } as CSSProperties}
              >
                See everything for this address →
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      <div className={styles.heroSpace} aria-hidden="true" />

      <div className={styles.heroFoot}>
        <span>{hour === null ? 'The sky follows your clock' : `Sky drawn for ${formatHour(hour)}, your time`}</span>
        <a href="#how-it-works">See how it works ↓</a>
      </div>
    </header>
  );
}
