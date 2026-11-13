// ─────────────────────────────────────────────────────────────────────────────
// Pantopus homepage — one day at one place.
//
// The page follows a single day under the Living Sky (the Today tab's sky,
// drawn for the web): the visitor's own hour in the hero, then morning
// (understand your place), the day (Today, the household), the evening
// (Plans, Nearby) and the night (how it fits, boundaries, questions).
// Only features that are live are shown; see
// docs/launch-scope-flags-2026-10-01.md for what is switched off.
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from 'next';
import { IBM_Plex_Mono } from 'next/font/google';
import localFont from 'next/font/local';
import { IOS_APP_STORE_APP_ID } from '@pantopus/utils';
import HomeHero from './_components/HomeHero';
import UnderstandSection from './_components/UnderstandSection';
import BallotBand from './_components/BallotBand';
import TodaySection from './_components/TodaySection';
import HouseholdSection from './_components/HouseholdSection';
import PlansSection from './_components/PlansSection';
import NearbySection from './_components/NearbySection';
import HowItFitsSection from './_components/HowItFitsSection';
import BoundariesSection from './_components/BoundariesSection';
import StartAndQuestions from './_components/StartAndQuestions';
import CloseSection from './_components/CloseSection';
import HomeFooter from './_components/HomeFooter';
import { HERO_ID, skyPhaseScript } from './_components/skyScene';
import styles from './_components/home.module.css';

// Newsreader with every weight, optical size and both styles. The page loads a cut of Google's Latin file holding
// every English letter and digit and the punctuation headings use, with all its axes, kerning and figure styles, so
// those glyphs draw exactly as from the whole file at about half the bytes. Every other character still draws in
// Newsreader, from Google's own files in home.module.css, fetched only when a text uses one; its fallback while
// loading is there too. Files and ranges come from scripts/newsreader-subset.py.
//
// Not preloaded: first paint waits for the stylesheets, and on a slow connection these 152 KB, requested alongside
// them, usually reach the wire first (about a second's delay at 1.5 Mbit/s). A first visit paints the heading in its
// size-matched fallback and swaps when the font lands; a return visit has the font from the cache before first paint.
const serif = localFont({
  src: [
    { path: './_components/fonts/newsreader-core.woff2', weight: '200 800', style: 'normal' },
    { path: './_components/fonts/newsreader-italic-core.woff2', weight: '200 800', style: 'italic' },
  ],
  // next/font/local would otherwise name the family after this constant ("serif").
  declarations: [{ prop: 'font-family', value: 'Newsreader' }],
  variable: '--home-serif',
  display: 'swap',
  adjustFontFallback: false,
  preload: false,
});
// Plex Mono's fallbacks are in home.module.css (adjustFontFallback is off): next/font's Arial-based one has wider
// capitals than Plex Mono, so when the page painted before Plex Mono arrived, the hero's eyebrow wrapped
// differently and the hero moved when the font landed. A Courier New face with Plex Mono's advance stands in.
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--home-mono', display: 'swap', adjustFontFallback: false });

const TITLE = 'Pantopus · Real life, connected';
const DESCRIPTION =
  'See what’s true about your address, keep your household’s everyday on track, and make small plans with people nearby. Free to look, no account needed.';

export const metadata: Metadata = {
  metadataBase: new URL('https://pantopus.com'),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'Pantopus',
    title: 'Your place, alive.',
    description: DESCRIPTION,
    images: [{ url: '/api/og/home', width: 1200, height: 630, alt: 'A house and an apartment block under a night sky, with the words “Your place, alive.”' }],
  },
  twitter: { card: 'summary_large_image', title: 'Your place, alive.', description: DESCRIPTION, images: ['/api/og/home'] },
  // Safari on an iPhone offers the app in its own banner above the page.
  ...(IOS_APP_STORE_APP_ID ? { itunes: { appId: IOS_APP_STORE_APP_ID } } : {}),
};

// Re-rendered hourly, so the Ballot band leaves on its own after Election Day.
export const revalidate = 3600;

/** Midnight Pacific after Election Day, November 3, 2026. */
const BALLOT_BAND_UNTIL = Date.UTC(2026, 10, 4, 8);

export default function HomePage() {
  const showBallot = Date.now() < BALLOT_BAND_UNTIL;

  return (
    <div className={`${styles.page} ${serif.variable} ${mono.variable}`}>
      <HomeHero />
      {/* Paints the hero for the visitor's hour before React loads. */}
      <script dangerouslySetInnerHTML={{ __html: skyPhaseScript(HERO_ID) }} />
      <main>
        <UnderstandSection ballot={showBallot ? <BallotBand /> : null} />
        <TodaySection />
        <HouseholdSection />
        <PlansSection />
        <NearbySection />
        <div className={styles.night}>
          <HowItFitsSection />
          <BoundariesSection />
          <StartAndQuestions />
          <CloseSection />
        </div>
      </main>
      <HomeFooter />
    </div>
  );
}
