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
import { IBM_Plex_Mono, Newsreader } from 'next/font/google';
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

const serif = Newsreader({ subsets: ['latin'], style: ['normal', 'italic'], axes: ['opsz'], variable: '--home-serif', display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--home-mono', display: 'swap' });

const TITLE = 'Pantopus · Your home and neighborhood, connected';
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
