// ─────────────────────────────────────────────────────────────────────────────
// FinalCTASection — "Anchor your identity." closing CTA on soft sky-tinted card.
// Keeps the iOS / Android badges and QR codes from the prior design.
// ─────────────────────────────────────────────────────────────────────────────

import Image from 'next/image';
import Link from 'next/link';
import { IOS_APP_STORE_URL, ANDROID_PLAY_STORE_URL } from '@pantopus/utils';

export default function FinalCTASection() {
  return (
    <section
      id="cta"
      className="text-center"
      style={{
        background: 'var(--color-primary-50)',
        padding: '140px 0 160px',
        borderTop: '1px solid #DDEBF6',
      }}
    >
      <div className="w-full max-w-[1280px] mx-auto px-6 sm:px-10">
        <h2
          className="mh-reveal"
          style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 500,
            fontSize: 'clamp(40px, 4vw, 60px)',
            lineHeight: 1.04,
            letterSpacing: '-0.024em',
            margin: '0 0 24px',
            color: 'var(--ink-1)',
          }}
        >
          Claim your address.
        </h2>

        <p
          className="mh-reveal mh-reveal-d1 mx-auto"
          style={{
            maxWidth: '540px',
            margin: '0 auto 48px',
            color: 'var(--ink-2)',
            fontSize: '18px',
            lineHeight: '28px',
          }}
        >
          Every address has exactly one page. See yours free — no account — then claim it before your
          neighbors do.
        </p>

        <div className="mh-reveal mh-reveal-d2 inline-flex flex-wrap items-center justify-center gap-8">
          <Link
            href="/start"
            className="inline-flex items-center justify-center gap-2 h-14 px-6 rounded-[14px] text-white font-semibold text-base transition-transform hover:scale-[1.02] no-underline"
            style={{
              background: 'var(--color-primary)',
              boxShadow: '0 1px 0 rgba(255,255,255,0.2) inset, var(--shadow-primary)',
              letterSpacing: '-0.005em',
              border: 0,
            }}
          >
            See your place — free
          </Link>
          <a
            href="#pillars"
            className="inline-flex items-center gap-2 font-semibold text-[15px] no-underline group"
            style={{ color: 'var(--color-primary)' }}
          >
            Read the trust model
            <span className="inline-block transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>
          </a>
        </div>

        {/* App store badges & QR codes — preserved from prior design */}
        <div className="mh-reveal mh-reveal-d3 mt-16 flex flex-col items-center gap-6">
          <div className="flex items-center gap-3">
            <a
              href={IOS_APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Download on the App Store"
            >
              <Image src="/landing/badge-appstore.svg" alt="Download on the App Store" width={132} height={44} />
            </a>
            <a
              href={ANDROID_PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Get it on Google Play"
            >
              <Image src="/landing/badge-playstore.svg" alt="Get it on Google Play" width={140} height={44} />
            </a>
          </div>

          <div className="flex justify-center gap-10">
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-40 h-40 bg-white rounded-xl p-2"
                style={{ border: '1px solid var(--rule)' }}
              >
                <Image src="/landing/qr-ios.png" alt="QR code for iOS App Store" width={160} height={160} className="w-full h-full" />
              </div>
              <span style={{ fontSize: '11px', color: 'var(--ink-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>iOS</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-40 h-40 bg-white rounded-xl p-2"
                style={{ border: '1px solid var(--rule)' }}
              >
                <Image src="/landing/qr-android.png" alt="QR code for Google Play Store" width={160} height={160} className="w-full h-full" />
              </div>
              <span style={{ fontSize: '11px', color: 'var(--ink-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Android</span>
            </div>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--ink-3)', margin: 0 }}>Scan to download</p>
        </div>
      </div>
    </section>
  );
}
