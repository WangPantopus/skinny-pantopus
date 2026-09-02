// ============================================================
// /api/og/place?address=… — the share card (Wedge v2 D5).
//
// "Your address, graded": one image a person can drop into the Camas
// Facebook group. Rendered on the fly from the same anonymous preview
// the /start funnel shows — the aha headline plus three grades — and
// NOTHING is stored: the address lives only in this request. Each
// share lands on /start?address=…, the most personal landing page there
// is (the preview of THAT address).
// ============================================================

import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

export const runtime = 'edge';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type Section = { id: string; status: string; data: Record<string, unknown> | null };
type Preview = {
  status: string;
  place?: { address: string | null; city: string | null; state: string | null };
  aha?: { tone: string; grade: string | null; headline: string; detail: string } | null;
  sections?: Section[];
};

const TONE: Record<string, { bg: string; fg: string }> = {
  alert: { bg: '#fde8cc', fg: '#8a4b00' },
  watch: { bg: '#dbeafe', fg: '#1e3a8a' },
  info: { bg: '#e5e7eb', fg: '#374151' },
  calm: { bg: '#dcfce7', fg: '#14532d' },
};

function grade(sections: Section[], id: string, pick: (d: Record<string, unknown>) => string | null): string | null {
  const s = sections.find((x) => x.id === id);
  if (!s || !s.data) return null;
  try {
    return pick(s.data);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const address = (req.nextUrl.searchParams.get('address') || '').trim().slice(0, 200);
  let preview: Preview | null = null;
  if (address) {
    try {
      const res = await fetch(`${API_BASE}/api/public/place?address=${encodeURIComponent(address)}`, {
        headers: { accept: 'application/json' },
        cache: 'no-store',
      });
      if (res.ok) preview = (await res.json()) as Preview;
    } catch {
      preview = null;
    }
  }

  const line = preview?.place ? [preview.place.address, preview.place.city].filter(Boolean).join(', ') : address || 'Your address';
  const sections = preview?.sections ?? [];
  const chips = [
    { label: 'Flood', value: grade(sections, 'flood', (d) => (d.risk_level ? String(d.risk_level) : null)) },
    { label: 'Wildfire', value: grade(sections, 'wildfire', (d) => (d.hazard_label ? String(d.hazard_label) : null)) },
    { label: 'Air today', value: grade(sections, 'air_quality', (d) => (d.category_label ? String(d.category_label) : null)) },
    { label: 'Radon', value: grade(sections, 'lead_radon', (d) => (d.radon_zone != null ? `Zone ${d.radon_zone}` : null)) },
  ].filter((c) => c.value);
  const aha = preview?.aha ?? null;
  const tone = TONE[aha?.tone ?? 'info'] ?? TONE.info;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 56,
          background: 'linear-gradient(160deg, #f6f7fb 0%, #ffffff 60%)',
          color: '#171a2e',
          fontFamily: 'Helvetica, Arial, sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 22, letterSpacing: 2, textTransform: 'uppercase', color: '#61667f', fontWeight: 700 }}>
            What&apos;s true about
          </div>
          <div style={{ fontSize: 48, fontWeight: 800, marginTop: 8, lineHeight: 1.1 }}>{line}</div>
        </div>

        {aha ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, marginTop: 24 }}>
            {aha.grade ? (
              <div style={{ display: 'flex', background: tone.bg, color: tone.fg, fontSize: 30, fontWeight: 800, padding: '14px 22px', borderRadius: 16 }}>
                {aha.grade}
              </div>
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.2 }}>{aha.headline}</div>
              {aha.detail ? <div style={{ fontSize: 22, color: '#3c4059', marginTop: 10, lineHeight: 1.35 }}>{aha.detail.slice(0, 140)}</div> : null}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 34, fontWeight: 700 }}>Risks, records, air, and who&apos;s verified nearby.</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            {chips.map((c) => (
              <div key={c.label} style={{ display: 'flex', flexDirection: 'column', background: '#eef0f7', borderRadius: 14, padding: '10px 16px' }}>
                <div style={{ fontSize: 14, color: '#61667f', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>{c.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>{c.value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#5527ad' }}>pantopus.com/start</div>
            <div style={{ fontSize: 16, color: '#61667f' }}>Free · no account · every address has one page</div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
