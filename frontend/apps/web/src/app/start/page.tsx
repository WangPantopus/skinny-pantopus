// ============================================================
// /start — the public Place preview landing (the sidewalk QR target).
// pantopus.com/start serves this. Server component so it can export
// SEO metadata + OG tags; the interactive funnel is the client child
// <StartFunnel/>. The shell is static (no cookies/headers read) and
// the preview endpoint persists nothing, so this is edge/CDN cacheable.
// ============================================================

import type { Metadata, Viewport } from 'next';
import StartFunnel from '@/components/place/StartFunnel';

const TITLE = "See what's true about your address";
const DESCRIPTION =
  "Public records, local risks, and who's verified nearby — free, no account. Look up any U.S. address, then save your place to get daily updates.";

// /start?address=… is the share card's landing page (Wedge v2 D5): the
// preview of THAT address, with an OG image rendered on the fly by
// /api/og/place. Reading searchParams makes this route dynamic; the bare
// /start (no address) keeps the static metadata below.
export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const params = await searchParams;
  const raw = params?.address;
  const address = (Array.isArray(raw) ? raw[0] : raw ?? '').trim().slice(0, 200);
  const base: Metadata = {
    metadataBase: new URL('https://pantopus.com'),
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: '/start' },
    robots: { index: true, follow: true },
    openGraph: { type: 'website', url: '/start', siteName: 'Pantopus', title: TITLE, description: DESCRIPTION },
    twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
  };
  if (!address) return base;
  const shareTitle = `What's true about ${address}`;
  const image = `/api/og/place?address=${encodeURIComponent(address)}`;
  const url = `/start?address=${encodeURIComponent(address)}`;
  return {
    ...base,
    title: shareTitle,
    alternates: { canonical: '/start' },
    robots: { index: false, follow: true },
    openGraph: { type: 'website', url, siteName: 'Pantopus', title: shareTitle, description: DESCRIPTION, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title: shareTitle, description: DESCRIPTION, images: [image] },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f6f7f9',
};

export default function StartPage() {
  return <StartFunnel />;
}
