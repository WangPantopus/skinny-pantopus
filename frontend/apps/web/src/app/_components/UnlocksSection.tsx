// ─────────────────────────────────────────────────────────────────────────────
// UnlocksSection — Six-card grid: what follows from anchored identity.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReactNode } from 'react';

type Card = {
  title: string;
  desc: string;
  delay?: 0 | 1 | 2;
  icon: ReactNode;
};

const CARDS: Card[] = [
  {
    title: 'Commerce that holds up.',
    desc: 'Buy and sell with people whose existence is checkable, not assumed.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 14 L20 8 L34 14 L34 28 L20 34 L6 28 Z" />
        <path d="M6 14 L20 20 L34 14" />
        <line x1="20" y1="20" x2="20" y2="34" />
        <circle cx="20" cy="20" r="2.2" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    title: 'Work between real parties.',
    desc: 'Hire, get hired, and contract with verified accountability on both sides.',
    delay: 1,
    icon: (
      <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="7" y="9" width="18" height="24" rx="1.5" />
        <line x1="11" y1="15" x2="21" y2="15" />
        <line x1="11" y1="19" x2="21" y2="19" />
        <line x1="11" y1="23" x2="18" y2="23" />
        <path d="M22 30 L34 18 L31 15 L19 27 L19 30 L22 30 Z" />
      </svg>
    ),
  },
  {
    title: 'Mail that means something.',
    desc: 'Send and receive correspondence to verified addresses, with the ceremony it deserves.',
    delay: 2,
    icon: (
      <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="11" width="30" height="20" rx="1.5" />
        <path d="M5 13 L20 24 L35 13" />
        <circle cx="20" cy="24" r="3.4" fill="currentColor" stroke="none" opacity="0.18" />
        <circle cx="20" cy="24" r="3.4" />
        <text x="20" y="26.6" textAnchor="middle" fontFamily="Iowan Old Style, Georgia, serif" fontStyle="italic" fontSize="5" stroke="none" fill="currentColor">P</text>
      </svg>
    ),
  },
  {
    title: 'Identity you can layer.',
    desc: 'Personal, household, professional, persona — every face you wear, anchored to the same root.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="6" y="6" width="22" height="22" rx="2" />
        <rect x="11" y="11" width="22" height="22" rx="2" fill="white" />
        <rect x="11" y="11" width="22" height="22" rx="2" />
        <circle cx="22" cy="22" r="3" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    title: 'Audiences built on trust.',
    desc: 'Creators publish to verified followers. Followers pay knowing the person on the other end is real.',
    delay: 1,
    icon: (
      <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="20" cy="22" r="3" fill="currentColor" stroke="none" />
        <path d="M13 26 a8 8 0 0 1 14 0" />
        <path d="M9 28 a13 13 0 0 1 22 0" />
        <path d="M5 30 a18 18 0 0 1 30 0" />
      </svg>
    ),
  },
  {
    title: 'Coordination at scale.',
    desc: 'From a household to a region, structured around verified parties instead of anonymous handles.',
    delay: 2,
    icon: (
      <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="20" cy="9" r="2.6" fill="currentColor" stroke="none" />
        <circle cx="9" cy="28" r="2.6" fill="currentColor" stroke="none" />
        <circle cx="31" cy="28" r="2.6" fill="currentColor" stroke="none" />
        <circle cx="20" cy="22" r="2.6" fill="currentColor" stroke="none" />
        <line x1="20" y1="11.6" x2="20" y2="19.4" />
        <line x1="17.8" y1="23.6" x2="11.2" y2="26.4" />
        <line x1="22.2" y1="23.6" x2="28.8" y2="26.4" />
        <line x1="11.6" y1="28" x2="28.4" y2="28" />
      </svg>
    ),
  },
];

export default function UnlocksSection() {
  return (
    <section id="unlocks" style={{ padding: '160px 0' }}>
      <div className="w-full max-w-[1280px] mx-auto px-6 sm:px-10 lg:px-16">
        <div className="text-center max-w-[880px] mx-auto" style={{ marginBottom: '80px' }}>
          <p className="mh-overline mh-reveal mb-5">What follows</p>
          <h2 className="mh-h2 mh-reveal mh-reveal-d1 mx-auto" style={{ maxWidth: '880px' }}>
            When identity is anchored, everything downstream becomes possible.
          </h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((c, i) => (
            <div
              key={i}
              className={`mh-reveal ${c.delay === 1 ? 'mh-reveal-d1' : c.delay === 2 ? 'mh-reveal-d2' : ''} flex flex-col gap-5 p-8 rounded-2xl bg-white transition-colors`}
              style={{
                border: '1px solid var(--rule)',
                minHeight: '280px',
              }}
            >
              <div className="w-10 h-10" style={{ color: 'var(--ink-1)' }} aria-hidden="true">
                {c.icon}
              </div>
              <h3
                className="m-0"
                style={{
                  fontFamily: 'ui-sans-serif, system-ui',
                  fontSize: '20px',
                  lineHeight: '28px',
                  fontWeight: 600,
                  letterSpacing: '-0.005em',
                  color: 'var(--ink-1)',
                }}
              >
                {c.title}
              </h3>
              <p className="m-0" style={{ fontSize: '14px', lineHeight: '22px', color: 'var(--ink-3)' }}>
                {c.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
