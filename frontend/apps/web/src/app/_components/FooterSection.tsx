'use client';

// ─────────────────────────────────────────────────────────────────────────────
// FooterSection — Five-column footer with serif wordmark + paper background.
// Link destinations preserved from prior design where applicable.
// ─────────────────────────────────────────────────────────────────────────────

import Link from 'next/link';

const PRODUCT_LINKS = [
  { label: 'Verification', href: '#primitive' },
  { label: 'Mail',         href: '#ceremonial' },
  { label: 'Commerce',     href: '#unlocks' },
  { label: 'Personas',     href: '#stripes' },
];

const TRUST_LINKS = [
  { label: 'Trust model',          href: '#pillars' },
  { label: 'Privacy',              href: '/privacy', internal: true },
  { label: 'Verification methods', href: '#primitive' },
];

const COMPANY_LINKS = [
  { label: 'About',   href: '/about',   internal: true },
  { label: 'Careers', href: '/about',   internal: true },
  { label: 'Contact', href: '/contact', internal: true },
];

const LEGAL_LINKS = [
  { label: 'Terms',          href: '/terms',         internal: true },
  { label: 'Privacy policy', href: '/privacy',       internal: true },
  { label: 'Child Safety',   href: '/child-safety',  internal: true },
];

function Wordmark() {
  return (
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
        className="mh-serif"
        style={{ fontSize: '22px', color: 'var(--ink-1)', letterSpacing: '-0.015em' }}
      >
        Pantopus
      </span>
    </Link>
  );
}

function Column({ heading, items }: { heading: string; items: { label: string; href: string; internal?: boolean }[] }) {
  return (
    <div>
      <h4
        className="m-0 uppercase"
        style={{
          fontFamily: 'ui-sans-serif, system-ui',
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.1em',
          color: 'var(--ink-3)',
          marginBottom: '20px',
        }}
      >
        {heading}
      </h4>
      <ul className="list-none m-0 p-0">
        {items.map((it) => (
          <li key={`${heading}-${it.label}`} style={{ margin: '0 0 12px' }}>
            {it.internal ? (
              <Link href={it.href} className="no-underline transition-colors hover:text-[color:var(--color-primary)]" style={{ color: 'var(--ink-1)', fontSize: '14px' }}>
                {it.label}
              </Link>
            ) : (
              <a href={it.href} className="no-underline transition-colors hover:text-[color:var(--color-primary)]" style={{ color: 'var(--ink-1)', fontSize: '14px' }}>
                {it.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function FooterSection() {
  return (
    <footer
      style={{
        background: 'var(--paper)',
        borderTop: '1px solid var(--rule)',
        padding: '80px 0 40px',
      }}
    >
      <div className="w-full max-w-[1280px] mx-auto px-6 sm:px-10">
        <div className="grid gap-12 sm:grid-cols-2 lg:[grid-template-columns:2fr_1fr_1fr_1fr_1fr]" style={{ marginBottom: '64px' }}>
          <div>
            <div style={{ marginBottom: '16px' }}>
              <Wordmark />
            </div>
            <p style={{ margin: 0, color: 'var(--ink-3)', fontSize: '14px', lineHeight: '22px', maxWidth: '280px' }}>
              Identity, anchored to a verified physical address.
            </p>
          </div>
          <Column heading="Product" items={PRODUCT_LINKS} />
          <Column heading="Trust"   items={TRUST_LINKS} />
          <Column heading="Company" items={COMPANY_LINKS} />
          <Column heading="Legal"   items={LEGAL_LINKS} />
        </div>

        <div
          className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3"
          style={{
            paddingTop: '32px',
            borderTop: '1px solid var(--rule)',
            fontSize: '11px',
            color: 'var(--ink-3)',
            letterSpacing: '0.02em',
          }}
        >
          <span>© 2026 Pantopus, Inc.</span>
          <span className="inline-flex items-center gap-2">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ color: 'var(--color-primary)' }} aria-hidden="true">
              <circle cx="5.5" cy="5.5" r="4.6" />
              <circle cx="5.5" cy="5.5" r="1.6" fill="currentColor" stroke="none" />
            </svg>
            Pantopus, Inc. · Verified by address.
          </span>
        </div>
      </div>
    </footer>
  );
}
