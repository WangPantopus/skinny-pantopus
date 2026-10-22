// ============================================================
// /api/og/home — the homepage's share card.
//
// The Living Sky at night (a house and an apartment block, a few lit
// windows, lights on the far hill) under "Your place, alive." Rendered
// once at build time: nothing in it depends on the request.
// ============================================================

import { ImageResponse } from 'next/og';
import { markDataUri } from '../_mark';

export const dynamic = 'force-static';

// The scene as one SVG, handed to Satori as an image: literals only,
// since Satori resolves no CSS variables.
const SCENE = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0A1230"/><stop offset="0.62" stop-color="#1A2350"/><stop offset="1" stop-color="#3A3767"/></linearGradient></defs>
<rect width="1200" height="630" fill="url(#s)"/>
<g fill="#FFFFFF" opacity="0.7"><circle cx="90" cy="70" r="1.4"/><circle cx="240" cy="40" r="1.1"/><circle cx="420" cy="96" r="1.3"/><circle cx="610" cy="34" r="1"/><circle cx="760" cy="120" r="1.2"/><circle cx="930" cy="60" r="1.5"/><circle cx="1110" cy="100" r="1.1"/><circle cx="1040" cy="30" r="1"/><circle cx="330" cy="150" r="0.9"/><circle cx="520" cy="180" r="1"/></g>
<circle cx="1010" cy="140" r="26" fill="#EEF2F8"/><circle cx="1022" cy="132" r="24" fill="#141C46"/>
<path d="M0 470 C200 420 380 450 600 440 S1000 400 1200 430 V630 H0 Z" fill="#232B4E"/>
<path d="M0 500 C240 470 420 500 640 486 S1000 470 1200 492 V630 H0 Z" fill="#141B33"/>
<g fill="#FFD27F"><rect x="120" y="500" width="3" height="3"/><rect x="150" y="510" width="3" height="3"/><rect x="236" y="496" width="3" height="3"/><rect x="300" y="506" width="3" height="3"/><rect x="980" y="490" width="3" height="3"/><rect x="1040" y="500" width="3" height="3"/><rect x="1100" y="494" width="3" height="3"/><rect x="560" y="492" width="3" height="3"/></g>
<rect x="0" y="560" width="1200" height="70" fill="#0C1220"/>
<g fill="#0B1119"><rect x="690" y="470" width="160" height="92"/><polygon points="678,470 770,410 862,470"/><rect x="800" y="420" width="16" height="40"/><rect x="900" y="350" width="110" height="212"/></g>
<rect x="712" y="490" width="30" height="24" fill="#FFC867"/><rect x="800" y="490" width="30" height="24" fill="#FFC867"/><rect x="758" y="516" width="22" height="46" fill="#FFC867" opacity="0.55"/>
<g fill="#FFC867"><rect x="916" y="372" width="18" height="12"/><rect x="976" y="414" width="18" height="12"/><rect x="946" y="456" width="18" height="12"/></g>
</svg>`;

export async function GET() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', fontFamily: 'Helvetica, Arial, sans-serif' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/svg+xml;utf8,${encodeURIComponent(SCENE)}`} width={1200} height={630} alt="" style={{ position: 'absolute', top: 0, left: 0 }} />
        <div style={{ display: 'flex', flexDirection: 'column', padding: 64, color: '#F3F6FB' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={markDataUri(44)} width={44} height={44} alt="" />
            <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -0.6 }}>Pantopus</div>
          </div>
          <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -3, lineHeight: 1, marginTop: 56 }}>Your place, alive.</div>
          <div style={{ fontSize: 30, color: '#C9D3E3', marginTop: 24, maxWidth: 640, lineHeight: 1.3 }}>
            Your home and neighborhood, connected. Free to look, no account needed.
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
