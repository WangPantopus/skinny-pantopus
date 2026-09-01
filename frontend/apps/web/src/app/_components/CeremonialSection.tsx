'use client';

// ─────────────────────────────────────────────────────────────────────────────
// CeremonialSection — Three-state envelope animation driven by scroll position.
// State 1: sealed · State 2: breaking · State 3: read.
// Client component because state transitions depend on window scroll.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';

export default function CeremonialSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    const onScroll = () => {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = rect.height + vh;
      const passed = vh - rect.top;
      const p = Math.max(0, Math.min(1, passed / total));
      let next: 1 | 2 | 3 = 1;
      if (p > 0.42) next = 2;
      if (p > 0.62) next = 3;
      setState(next);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <section
      id="ceremonial"
      ref={sectionRef}
      className="relative mh-porch-grain overflow-hidden"
      style={{
        background: 'var(--porch-fall)',
        padding: '180px 0 200px',
        color: '#F6ECD8',
        isolation: 'isolate',
      }}
    >
      <div className="relative z-[1] w-full max-w-[1280px] mx-auto px-6 sm:px-10">
        <div className="text-center">
          <p
            className="mh-overline mh-reveal"
            style={{ color: 'rgba(246,236,216,0.62)', marginBottom: '24px', letterSpacing: '0.18em' }}
          >
            The product, in a single gesture
          </p>
          <h2
            className="mh-reveal mh-reveal-d1 mx-auto"
            style={{
              fontFamily: 'var(--font-serif)',
              fontWeight: 500,
              fontSize: 'clamp(36px, 3.4vw, 52px)',
              lineHeight: 1.1,
              color: '#F6ECD8',
              letterSpacing: '-0.018em',
              margin: '0 auto 80px',
              maxWidth: '760px',
            }}
          >
            Every action in Pantopus carries the weight of a real address.
          </h2>

          <div
            className="relative mx-auto"
            style={{ width: 'min(480px, 90vw)', height: 'min(600px, 110vw)', perspective: '1400px' }}
            aria-hidden="true"
          >
            {/* State 1 */}
            <div
              className="absolute inset-0 flex items-center justify-center transition-opacity duration-700"
              style={{ opacity: state === 1 ? 1 : 0 }}
            >
              <div
                className="mh-hero-glow absolute"
                style={{
                  width: '86%',
                  height: '70%',
                  left: '7%',
                  top: '12%',
                  background:
                    'radial-gradient(ellipse at 50% 50%, rgba(255,210,140,0.45) 0%, rgba(255,180,90,0.18) 30%, transparent 60%)',
                  filter: 'blur(6px)',
                }}
              />
              <svg
                viewBox="0 0 400 280"
                width="100%"
                height="auto"
                style={{ maxHeight: '100%', filter: 'drop-shadow(0 30px 50px rgba(0,0,0,0.45))' }}
              >
                <defs>
                  <linearGradient id="cePaper1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#F1E2C2" />
                    <stop offset="1" stopColor="#CFB585" />
                  </linearGradient>
                  <linearGradient id="ceFlap1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#E7D5AE" />
                    <stop offset="1" stopColor="#B5994E" />
                  </linearGradient>
                  <radialGradient id="ceSeal1" cx="35%" cy="30%" r="70%">
                    <stop offset="0" stopColor="#D26749" />
                    <stop offset="1" stopColor="#7A2A1A" />
                  </radialGradient>
                </defs>
                <rect x="20" y="50" width="360" height="210" rx="10" fill="url(#cePaper1)" stroke="rgba(0,0,0,0.35)" strokeWidth="1.2" />
                <path d="M20 60 L200 200 L380 60 Z" fill="url(#ceFlap1)" stroke="rgba(0,0,0,0.4)" strokeWidth="1.2" strokeLinejoin="round" />
                <g className="mh-seal-lift">
                  <circle cx="200" cy="200" r="36" fill="url(#ceSeal1)" stroke="rgba(0,0,0,0.45)" strokeWidth="1.4" />
                  <circle cx="200" cy="200" r="30" fill="none" stroke="rgba(255,255,255,0.32)" strokeWidth="0.8" strokeDasharray="2 3" />
                  <text x="200" y="214" textAnchor="middle" fontFamily="Iowan Old Style, Hoefler Text, Georgia, serif" fontStyle="italic" fontSize="36" fill="rgba(255,236,210,0.96)">
                    P
                  </text>
                </g>
              </svg>
            </div>

            {/* State 2 */}
            <div
              className="absolute inset-0 flex items-center justify-center transition-opacity duration-700"
              style={{ opacity: state === 2 ? 1 : 0 }}
            >
              <svg
                viewBox="0 0 400 280"
                width="100%"
                height="auto"
                style={{ maxHeight: '100%', filter: 'drop-shadow(0 30px 50px rgba(0,0,0,0.5))' }}
              >
                <defs>
                  <linearGradient id="cePaper2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#F1E2C2" />
                    <stop offset="1" stopColor="#CFB585" />
                  </linearGradient>
                  <linearGradient id="ceFlap2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#D9C290" />
                    <stop offset="1" stopColor="#A88B45" />
                  </linearGradient>
                </defs>
                <rect x="20" y="50" width="360" height="210" rx="10" fill="url(#cePaper2)" stroke="rgba(0,0,0,0.35)" strokeWidth="1.2" />
                <path d="M20 60 L200 200 L380 60" fill="none" stroke="rgba(0,0,0,0.18)" />
                <rect x="40" y="80" width="320" height="140" rx="2" fill="#FAF1DC" stroke="rgba(0,0,0,0.18)" />
                <line x1="60" y1="108" x2="320" y2="108" stroke="rgba(0,0,0,0.12)" />
                <line x1="60" y1="128" x2="300" y2="128" stroke="rgba(0,0,0,0.12)" />
                <line x1="60" y1="148" x2="280" y2="148" stroke="rgba(0,0,0,0.12)" />
                <g transform="rotate(-38 200 60)">
                  <path d="M20 60 L200 200 L380 60 Z" fill="url(#ceFlap2)" stroke="rgba(0,0,0,0.45)" strokeWidth="1.2" strokeLinejoin="round" />
                  <path d="M180 196 L200 178 L200 200 Z" fill="#8B2E1F" stroke="rgba(0,0,0,0.45)" strokeWidth="0.8" />
                  <path d="M200 200 L200 178 L220 196 Z" fill="#A23A29" stroke="rgba(0,0,0,0.45)" strokeWidth="0.8" />
                  <text x="190" y="200" textAnchor="middle" fontFamily="Iowan Old Style, Georgia, serif" fontStyle="italic" fontSize="22" fill="rgba(255,236,210,0.6)" opacity="0.6">
                    P
                  </text>
                </g>
              </svg>
            </div>

            {/* State 3 */}
            <div
              className="absolute inset-0 flex items-center justify-center transition-opacity duration-700"
              style={{ opacity: state === 3 ? 1 : 0 }}
            >
              <svg
                viewBox="0 0 400 320"
                width="100%"
                height="auto"
                style={{ maxHeight: '100%', filter: 'drop-shadow(0 30px 50px rgba(0,0,0,0.5))' }}
              >
                <defs>
                  <linearGradient id="cePaper3" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#F1E2C2" />
                    <stop offset="1" stopColor="#CFB585" />
                  </linearGradient>
                  <linearGradient id="ceFlap3" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#D9C290" />
                    <stop offset="1" stopColor="#A88B45" />
                  </linearGradient>
                  <linearGradient id="ceLetter3" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#FBF3DE" />
                    <stop offset="1" stopColor="#EFE0BD" />
                  </linearGradient>
                </defs>
                <g transform="translate(0 -10)">
                  <rect x="48" y="34" width="304" height="220" rx="3" fill="url(#ceLetter3)" stroke="rgba(74,31,26,0.25)" strokeWidth="1" />
                  <line x1="64" y1="64" x2="336" y2="64" stroke="rgba(74,31,26,0.25)" />
                  <text x="200" y="56" textAnchor="middle" fontFamily="Iowan Old Style, Hoefler Text, Georgia, serif" fontStyle="italic" fontSize="13" fill="rgba(74,31,26,0.7)">
                    — Pantopus —
                  </text>
                  <text x="200" y="120" textAnchor="middle" fontFamily="Iowan Old Style, Hoefler Text, Georgia, serif" fontStyle="italic" fontSize="18" fill="rgba(74,31,26,0.92)">
                    Susan B. — 412 Elm St —
                  </text>
                  <text x="200" y="148" textAnchor="middle" fontFamily="Iowan Old Style, Hoefler Text, Georgia, serif" fontStyle="italic" fontSize="18" fill="rgba(74,31,26,0.92)">
                    Sealed and sent.
                  </text>
                  <g transform="translate(200 185)" stroke="rgba(74,31,26,0.5)" fill="none" strokeWidth="0.8">
                    <line x1="-44" y1="0" x2="-8" y2="0" />
                    <line x1="44" y1="0" x2="8" y2="0" />
                    <path d="M-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0" />
                  </g>
                  <text x="200" y="232" textAnchor="middle" fontFamily="ui-sans-serif, system-ui" fontSize="9" letterSpacing="2" fill="rgba(74,31,26,0.5)">
                    VERIFIED ADDRESS · MAR 14
                  </text>
                </g>
                <rect x="20" y="200" width="360" height="100" rx="10" fill="url(#cePaper3)" stroke="rgba(0,0,0,0.4)" strokeWidth="1.2" />
                <g transform="rotate(-180 200 50)" opacity="0.85">
                  <path d="M20 50 L200 200 L380 50 Z" fill="url(#ceFlap3)" stroke="rgba(0,0,0,0.4)" strokeWidth="1" />
                </g>
              </svg>
            </div>
          </div>

          {/* Progress dots */}
          <div className="flex items-center justify-center mt-14 gap-3.5" aria-hidden="true">
            {[1, 2, 3].map((n, i) => (
              <div key={n} className="flex items-center gap-3.5">
                <span
                  className="w-1.5 h-1.5 rounded-full transition-all duration-500"
                  style={{
                    background: state === n ? 'rgba(246,236,216,0.95)' : 'rgba(246,236,216,0.25)',
                    transform: state === n ? 'scale(1.4)' : 'scale(1)',
                  }}
                />
                <span
                  className="uppercase"
                  style={{
                    fontSize: '11px',
                    letterSpacing: '0.14em',
                    color: 'rgba(246,236,216,0.6)',
                    margin: '0 8px 0 0',
                  }}
                >
                  {['Sealed', 'Breaking', 'Read'][i]}
                </span>
              </div>
            ))}
          </div>

          <p
            className="mh-reveal mh-reveal-d3 mx-auto"
            style={{
              marginTop: '96px',
              maxWidth: '580px',
              fontSize: '16px',
              lineHeight: '26px',
              color: 'rgba(246,236,216,0.72)',
              fontStyle: 'italic',
              fontFamily: 'var(--font-serif)',
            }}
          >
            Mail is the most literal example. Every other surface — commerce, work, audience — inherits the same weight.
          </p>
        </div>
      </div>
    </section>
  );
}
