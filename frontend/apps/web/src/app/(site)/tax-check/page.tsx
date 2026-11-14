// ============================================================
// /tax-check — where a property-tax postcard or ad lands. It is the /start
// lookup (same funnel, same preview, same `?r=` route codes) with its first
// words about the county's value. The comparison itself is shown only to a
// home's owner after they add it, in counties where it is switched on, so
// the page promises a look, never a result.
// ============================================================

import type { Metadata, Viewport } from 'next';
import StartFunnel from '@/components/place/StartFunnel';

const TITLE = 'Does the county value your home above similar homes on your street?';
const DESCRIPTION =
  "Where county records allow it, Pantopus compares the county's value for your home, per square foot, with similar houses on your street. Look up your address free.";

export const metadata: Metadata = {
  metadataBase: new URL('https://pantopus.com'),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/tax-check' },
  robots: { index: true, follow: true },
  openGraph: { type: 'website', url: '/tax-check', siteName: 'Pantopus', title: TITLE, description: DESCRIPTION },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f6f7f9',
};

export default function TaxCheckPage() {
  return <StartFunnel topic="tax" />;
}
