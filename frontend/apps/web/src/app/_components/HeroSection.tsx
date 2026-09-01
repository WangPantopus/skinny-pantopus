// ─────────────────────────────────────────────────────────────────────────────
// HeroSection — Marketing homepage redesign
// The wedge promise ("See what's true about your address") with an
// address-field-shaped door into the /start funnel. Server component.
// ─────────────────────────────────────────────────────────────────────────────

import Link from 'next/link';

export default function HeroSection() {
  return (
    <section
      id="hero"
      className="relative overflow-hidden flex items-center"
      style={{ minHeight: '100vh', padding: '140px 0 80px' }}
    >
      <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-10">
        <div className="grid gap-12 lg:gap-16 items-center" style={{ gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 0.95fr)' }}>
          {/* Text */}
          <div className="max-w-[720px]">
            <p
              className="mh-reveal mb-8 inline-flex items-center gap-3 uppercase"
              style={{
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.14em',
                color: 'var(--ink-3)',
              }}
            >
              <span
                className="inline-block w-[6px] h-[6px] rounded-full"
                style={{
                  background: 'var(--color-primary)',
                  boxShadow: '0 0 0 4px rgba(2,132,199,0.14)',
                }}
                aria-hidden="true"
              />
              Your address, answered · Early access
            </p>

            <h1 className="mh-display-hero mh-reveal mh-reveal-d1 mb-8">
              See what&rsquo;s true about your address.
            </h1>

            <p className="mh-lede mh-reveal mh-reveal-d2 mb-10 max-w-[560px]">
              Public records, local risks, today&rsquo;s air, and the neighbors who&rsquo;ve proven they&rsquo;re real — free, no account. Then claim it: every address has exactly one page.
            </p>

            <div className="mh-reveal mh-reveal-d3 flex flex-col gap-5 max-w-[520px]">
              {/* The CTA is the funnel: an address-field-shaped door into /start,
                  where the real autocomplete autofocuses. */}
              <Link
                href="/start"
                className="flex items-center gap-3 h-16 px-5 rounded-[16px] no-underline transition-transform hover:scale-[1.01]"
                style={{
                  background: '#fff',
                  border: '1px solid var(--rule)',
                  boxShadow: '0 1px 2px rgba(15,23,42,0.05), 0 10px 30px rgba(15,23,42,0.07)',
                }}
                aria-label="Type your address to see your free preview"
              >
                <span aria-hidden="true" style={{ color: 'var(--color-primary)', fontSize: '20px' }}>⌖</span>
                <span className="flex-1" style={{ color: 'var(--ink-3)', fontSize: '16px' }}>
                  Type your address…
                </span>
                <span
                  className="inline-flex items-center justify-center h-11 px-5 rounded-[12px] text-white font-semibold text-[15px]"
                  style={{
                    background: 'var(--color-primary)',
                    boxShadow: '0 1px 0 rgba(255,255,255,0.2) inset, var(--shadow-primary)',
                    letterSpacing: '-0.005em',
                  }}
                >
                  See your place
                </span>
              </Link>
              <a
                href="#primitive"
                className="inline-flex items-center gap-2 font-semibold text-[15px] no-underline group"
                style={{ color: 'var(--color-primary)' }}
              >
                See how it works
                <span className="inline-block transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>
              </a>
            </div>

            <div
              className="mh-reveal mh-reveal-d4 mt-16 flex flex-wrap items-center gap-x-6 gap-y-2"
              style={{ color: 'var(--ink-3)', fontSize: '13px', letterSpacing: '0.04em' }}
            >
              <span>Free, no account</span>
              <span
                className="inline-block w-1 h-1 rounded-full"
                style={{ background: 'var(--ink-4)' }}
                aria-hidden="true"
              />
              <span>One page per address</span>
              <span
                className="inline-block w-1 h-1 rounded-full"
                style={{ background: 'var(--ink-4)' }}
                aria-hidden="true"
              />
              <span>Verified by physical mail</span>
            </div>
          </div>

          {/* Envelope visual */}
          <div className="relative w-full aspect-square max-w-[560px] ml-auto mh-reveal mh-reveal-d2" aria-hidden="true">
            <div
              className="mh-hero-glow absolute inset-0 rounded-full pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle at 50% 50%, rgba(212,156,87,0.28) 0%, rgba(212,156,87,0.08) 30%, transparent 60%)',
              }}
            />
            <svg
              className="absolute"
              style={{
                inset: '8% 6%',
                width: '88%',
                height: '84%',
                filter:
                  'drop-shadow(0 24px 40px rgba(60,30,15,0.18)) drop-shadow(0 6px 12px rgba(60,30,15,0.08))',
              }}
              viewBox="0 0 400 280"
              aria-label="Sealed envelope"
            >
              <defs>
                <linearGradient id="heroPaper" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#F1E2C2" />
                  <stop offset="0.6" stopColor="#E6D2A4" />
                  <stop offset="1" stopColor="#CFB585" />
                </linearGradient>
                <linearGradient id="heroFlap" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#E7D5AE" />
                  <stop offset="1" stopColor="#C9A974" />
                </linearGradient>
                <radialGradient id="heroSeal" cx="35%" cy="30%" r="70%">
                  <stop offset="0" stopColor="#C75B40" />
                  <stop offset="1" stopColor="#7A2A1A" />
                </radialGradient>
              </defs>
              <rect x="20" y="50" width="360" height="210" rx="10" fill="url(#heroPaper)" stroke="rgba(60,30,15,0.22)" strokeWidth="1.2" />
              <rect x="32" y="62" width="336" height="186" rx="6" fill="none" stroke="rgba(60,30,15,0.08)" strokeWidth="0.8" />
              <path d="M20 60 L200 200 L380 60 Z" fill="url(#heroFlap)" stroke="rgba(60,30,15,0.28)" strokeWidth="1.2" strokeLinejoin="round" />
              <path d="M20 260 L200 200 L380 260" fill="none" stroke="rgba(60,30,15,0.18)" strokeWidth="1" />
              <g className="mh-seal-lift">
                <circle cx="200" cy="200" r="32" fill="url(#heroSeal)" stroke="rgba(0,0,0,0.32)" strokeWidth="1.4" />
                <circle cx="200" cy="200" r="26" fill="none" stroke="rgba(255,255,255,0.32)" strokeWidth="0.8" strokeDasharray="2 3" />
                <text
                  x="200"
                  y="212"
                  textAnchor="middle"
                  fontFamily='Iowan Old Style, Hoefler Text, Georgia, serif'
                  fontStyle="italic"
                  fontSize="32"
                  fill="rgba(255,236,210,0.95)"
                  fontWeight="500"
                >
                  P
                </text>
              </g>
              <ellipse cx="120" cy="80" rx="80" ry="10" fill="rgba(255,255,255,0.16)" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
