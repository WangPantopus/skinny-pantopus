// ─────────────────────────────────────────────────────────────────────────────
// StripesSection — Five alternating "who it's for" stripes with line-art visuals
// ─────────────────────────────────────────────────────────────────────────────

import type { ReactNode } from 'react';

type Stripe = {
  num: string;
  title: string;
  body: string;
  visual: ReactNode;
  reverse?: boolean;
};

const STRIPES: Stripe[] = [
  {
    num: '01',
    title: 'People who hire from where they live.',
    body: 'Verified hosts, verified workers, verified pay. No more handles you can’t check.',
    visual: (
      <svg viewBox="0 0 280 180" fill="none" stroke="#1B1815" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="40" y="60" width="140" height="86" rx="4" />
        <path d="M40 66 L110 116 L180 66" />
        <g transform="translate(150 90)">
          <circle cx="0" cy="0" r="16" />
          <circle cx="0" cy="0" r="7" />
          <line x1="16" y1="0" x2="84" y2="0" />
          <line x1="64" y1="0" x2="64" y2="14" />
          <line x1="78" y1="0" x2="78" y2="10" />
        </g>
      </svg>
    ),
  },
  {
    num: '02',
    title: 'People who sell from where they live.',
    body: 'Marketplaces where both sides are accountable to a real address.',
    reverse: true,
    visual: (
      <svg viewBox="0 0 280 200" fill="none" stroke="#1B1815" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M80 180 L80 50 a60 60 0 0 1 120 0 L200 180" />
        <path d="M96 180 L96 60 a44 44 0 0 1 88 0 L184 180" />
        <g stroke="#D6CFC0" strokeWidth="0.8" strokeDasharray="2 3">
          <line x1="140" y1="80" x2="140" y2="178" />
          <line x1="124" y1="80" x2="124" y2="178" />
          <line x1="156" y1="80" x2="156" y2="178" />
        </g>
        <circle cx="172" cy="124" r="3" fill="#1B1815" />
        <line x1="60" y1="180" x2="220" y2="180" />
        <line x1="220" y1="180" x2="260" y2="178" strokeDasharray="3 4" />
        <line x1="220" y1="170" x2="258" y2="160" strokeDasharray="3 4" />
        <line x1="220" y1="160" x2="254" y2="142" strokeDasharray="3 4" />
      </svg>
    ),
  },
  {
    num: '03',
    title: 'Creators who serve a real audience.',
    body: 'Subscribers who actually exist, on the other end of a verifiable line.',
    visual: (
      <svg viewBox="0 0 280 200" fill="none" stroke="#1B1815" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M100 180 L100 110 L180 110 L180 180 Z" />
        <line x1="100" y1="180" x2="180" y2="180" />
        <rect x="84" y="180" width="112" height="6" rx="1" />
        <g transform="rotate(-4 140 100)">
          <rect x="108" y="60" width="64" height="50" rx="1" />
          <line x1="116" y1="74" x2="160" y2="74" />
          <line x1="116" y1="82" x2="156" y2="82" />
          <line x1="116" y1="90" x2="148" y2="90" />
          <line x1="116" y1="98" x2="140" y2="98" />
        </g>
        <g fill="#1B1815">
          <circle cx="40" cy="170" r="3" />
          <circle cx="56" cy="174" r="3" />
          <circle cx="220" cy="170" r="3" />
          <circle cx="236" cy="174" r="3" />
          <circle cx="250" cy="172" r="3" />
        </g>
        <line x1="30" y1="178" x2="80" y2="178" stroke="#D6CFC0" />
        <line x1="200" y1="178" x2="260" y2="178" stroke="#D6CFC0" />
      </svg>
    ),
  },
  {
    num: '04',
    title: 'Professionals whose reputation depends on being who they say they are.',
    body: 'Identity that compounds across years, not platforms.',
    reverse: true,
    visual: (
      <svg viewBox="0 0 280 200" fill="none" stroke="#1B1815" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="40" y="40" width="200" height="130" rx="3" />
        <line x1="60" y1="100" x2="220" y2="100" stroke="#D6CFC0" />
        <path d="M64 96 C 72 78, 92 84, 96 100 S 116 116, 124 100 S 144 84, 152 100 S 170 116, 180 100 L210 100" strokeWidth="1.6" />
        <g transform="translate(196 138) rotate(-12)">
          <circle cx="0" cy="0" r="22" strokeWidth="1.5" />
          <circle cx="0" cy="0" r="15" stroke="#D6CFC0" />
          <text x="0" y="4" textAnchor="middle" fontFamily="ui-sans-serif" fontSize="6" letterSpacing="1" stroke="none" fill="#1B1815" fontWeight="600">
            VERIFIED
          </text>
        </g>
      </svg>
    ),
  },
  {
    num: '05',
    title: 'Organizations that need to coordinate verified parties.',
    body: 'From households to regions, structured around real accountability.',
    visual: (
      <svg viewBox="0 0 280 200" fill="none" stroke="#1B1815" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="140" cy="100" rx="110" ry="62" />
        <ellipse cx="140" cy="100" rx="86" ry="48" stroke="#7A736A" />
        <ellipse cx="140" cy="100" rx="62" ry="34" stroke="#4A4640" />
        <ellipse cx="140" cy="100" rx="38" ry="22" stroke="#1B1815" />
        <ellipse cx="140" cy="100" rx="18" ry="10" />
        <circle cx="140" cy="100" r="2.4" fill="#1B1815" />
        <line x1="140" y1="22" x2="140" y2="30" stroke="#1B1815" />
        <text x="140" y="20" textAnchor="middle" fontFamily="ui-sans-serif" fontSize="9" stroke="none" fill="#7A736A" letterSpacing="1">
          N
        </text>
      </svg>
    ),
  },
];

export default function StripesSection() {
  return (
    <section id="stripes" style={{ background: 'var(--paper)' }}>
      {STRIPES.map((s, i) => (
        <div
          key={i}
          className={`mh-reveal grid items-center ${s.reverse ? 'lg:[grid-template-columns:1fr_1fr]' : 'lg:[grid-template-columns:1fr_1fr]'}`}
          style={{
            borderTop: '1px solid var(--rule)',
            borderBottom: i === STRIPES.length - 1 ? '1px solid var(--rule)' : undefined,
            minHeight: '540px',
          }}
        >
          <div
            className={s.reverse ? 'order-1 lg:order-1' : 'order-1 lg:order-1'}
            style={{
              padding: '64px 48px',
              maxWidth: '620px',
              justifySelf: s.reverse ? 'start' : 'end',
              order: s.reverse ? 2 : 1,
            }}
          >
            <span
              className="inline-flex items-center gap-3"
              style={{
                fontFamily: 'ui-sans-serif, system-ui',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.16em',
                color: 'var(--color-primary)',
                marginBottom: '24px',
              }}
            >
              <span className="inline-block" style={{ width: '22px', height: '1px', background: 'var(--color-primary)' }} />
              {s.num}
            </span>
            <h3
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '38px',
                lineHeight: 1.12,
                fontWeight: 500,
                letterSpacing: '-0.02em',
                margin: '0 0 20px',
                color: 'var(--ink-1)',
                textWrap: 'balance',
              }}
            >
              {s.title}
            </h3>
            <p style={{ margin: 0, fontSize: '17px', lineHeight: '28px', color: 'var(--ink-2)', maxWidth: '460px' }}>{s.body}</p>
          </div>
          <div
            className="flex items-center justify-center"
            style={{ padding: '32px 48px', order: s.reverse ? 1 : 2 }}
          >
            <div style={{ width: '100%', maxWidth: '360px' }}>{s.visual}</div>
          </div>
        </div>
      ))}
    </section>
  );
}
