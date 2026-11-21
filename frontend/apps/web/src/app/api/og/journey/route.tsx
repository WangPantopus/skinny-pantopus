// ============================================================
// /api/og/journey?id=<journey id> — a travelling card journey's link preview picture (docs/product/
// travelling-card-2026-11-21, Part 5): 1200 x 630, the map with the three figures (miles, towns, states). Towns and
// dates only; no town is named on the picture. Read from the public journey route; nothing is stored.
// ============================================================

import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import type { CardJourney } from '@pantopus/api';
import { journeyMapSvg } from '@/components/mailbox/cards/journeyMap';

export const runtime = 'edge';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const toBase64 = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') || '';
  let journey: CardJourney | null = null;
  if (UUID.test(id)) {
    try {
      const res = await fetch(`${API_BASE}/api/mailbox/cards/journeys/${encodeURIComponent(id)}`, { headers: { accept: 'application/json' }, cache: 'no-store' });
      if (res.ok) journey = ((await res.json()) as { journey: CardJourney }).journey;
    } catch {
      journey = null;
    }
  }
  if (!journey) return new Response('Not found', { status: 404 });
  const map = `data:image/svg+xml;base64,${toBase64(journeyMapSvg(journey, { labels: false, width: 760 }))}`;
  const figure = (value: string, label: string, small?: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', marginTop: 26 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 64, lineHeight: 1, color: '#f4ecdd' }}>
        {value}
        {small ? <span style={{ fontSize: 28, marginLeft: 10, color: 'rgba(244,233,214,0.68)' }}>{small}</span> : null}
      </div>
      <div style={{ fontSize: 18, letterSpacing: 4, textTransform: 'uppercase', color: 'rgba(244,233,214,0.68)', marginTop: 6 }}>{label}</div>
    </div>
  );
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: 'linear-gradient(#241a12, #17110c)', padding: '56px 48px 56px 64px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: 340 }}>
          <div style={{ fontSize: 20, letterSpacing: 7, textTransform: 'uppercase', color: '#dcb96c' }}>Pantopus Post</div>
          <div style={{ fontSize: 46, fontStyle: 'italic', color: '#f4ecdd', marginTop: 10, lineHeight: 1.1 }}>This card’s journey</div>
          {figure(journey.miles.toLocaleString('en-US'), 'miles')}
          {figure(String(journey.towns), 'towns')}
          {figure(String(journey.states), 'states', `of ${journey.states_of}`)}
        </div>
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={map} width={760} height={475} />
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { 'Cache-Control': 'public, max-age=300' } },
  );
}
