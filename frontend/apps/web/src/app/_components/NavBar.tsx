'use client';

// ─────────────────────────────────────────────────────────────────────────────
// NavBar — Marketing homepage redesign
// Serif wordmark, paper backdrop, anchor links + auth CTAs.
// Adds a subtle bottom shadow once the user scrolls past 8px.
// ─────────────────────────────────────────────────────────────────────────────

import Link from 'next/link';
import { useEffect, useState } from 'react';

const NAV_ANCHORS = [
  { label: 'Product', href: '#unlocks' },
  { label: 'Trust',   href: '#pillars' },
] as const;

export default function NavBar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-[100] h-16 transition-shadow"
      style={{
        background: 'rgba(250, 249, 246, 0.82)',
        backdropFilter: 'saturate(140%) blur(14px)',
        WebkitBackdropFilter: 'saturate(140%) blur(14px)',
        boxShadow: scrolled ? '0 1px 0 var(--rule)' : 'none',
      }}
    >
      <div className="h-full max-w-[1440px] mx-auto px-6 sm:px-10 flex items-center justify-between">
        {/* Wordmark — from another page, navigates home; from home, scrolls to top. */}
        <Link
          href="/"
          onClick={(e) => {
            if (typeof window !== 'undefined' && window.location.pathname === '/') {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
          className="inline-flex items-center gap-2.5 no-underline"
          aria-label="Pantopus home"
        >
          <span className="inline-flex items-center justify-center w-[22px] h-[22px]" style={{ color: 'var(--ink-1)' }} aria-hidden="true">
            <svg viewBox="0 0 22 22" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4">
              <circle cx="11" cy="11" r="9" />
              <circle cx="11" cy="11" r="3.2" fill="currentColor" stroke="none" />
              <line x1="11" y1="2" x2="11" y2="5" />
              <line x1="11" y1="17" x2="11" y2="20" />
              <line x1="2" y1="11" x2="5" y2="11" />
              <line x1="17" y1="11" x2="20" y2="11" />
            </svg>
          </span>
          <span
            className="mh-serif text-[22px]"
            style={{ color: 'var(--ink-1)', letterSpacing: '-0.015em' }}
          >
            Pantopus
          </span>
        </Link>

        {/* Anchor links + auth */}
        <div className="flex items-center gap-6 sm:gap-9">
          <div className="hidden md:flex items-center gap-9">
            {NAV_ANCHORS.map(({ label, href }) => (
              <a
                key={href}
                href={href}
                className="text-sm no-underline transition-colors hover:text-[color:var(--ink-1)]"
                style={{ color: 'var(--ink-2)', letterSpacing: '-0.005em' }}
              >
                {label}
              </a>
            ))}
            <Link
              href="/about"
              className="text-sm no-underline transition-colors hover:text-[color:var(--ink-1)]"
              style={{ color: 'var(--ink-2)', letterSpacing: '-0.005em' }}
            >
              About
            </Link>
          </div>
          <Link
            href="/login"
            className="hidden sm:inline text-sm no-underline transition-colors hover:text-[color:var(--ink-1)]"
            style={{ color: 'var(--ink-2)', letterSpacing: '-0.005em' }}
          >
            Sign in
          </Link>
          <Link
            href="/start"
            className="inline-flex items-center h-9 px-3.5 rounded-[10px] text-white font-semibold text-sm transition-all hover:-translate-y-px"
            style={{
              background: 'var(--color-primary)',
              boxShadow: '0 1px 0 rgba(255,255,255,0.2) inset',
            }}
          >
            See your place
          </Link>
        </div>
      </div>
    </nav>
  );
}
