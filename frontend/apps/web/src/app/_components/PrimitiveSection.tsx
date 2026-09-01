// ─────────────────────────────────────────────────────────────────────────────
// PrimitiveSection — "What a verified address means."
// Two-column layout: copy on left, diagram on right.
// ─────────────────────────────────────────────────────────────────────────────

export default function PrimitiveSection() {
  return (
    <section
      id="primitive"
      className="relative mh-paper-grain"
      style={{
        background: 'var(--paper-warm)',
        padding: '160px 0',
        isolation: 'isolate',
      }}
    >
      <div className="relative z-[1] w-full max-w-[1280px] mx-auto px-6 sm:px-10 lg:px-16">
        <div className="grid gap-16 lg:gap-24 items-center" style={{ gridTemplateColumns: '0.85fr 1.15fr' }}>
          <div>
            <p className="mh-overline mh-reveal mb-6">The foundation</p>
            <h2 className="mh-h2 mh-reveal mh-reveal-d1 mb-8">What a verified address means.</h2>
            <p
              className="mh-reveal mh-reveal-d2"
              style={{ fontSize: '18px', lineHeight: '30px', color: 'var(--ink-2)', margin: '0 0 20px', maxWidth: '460px' }}
            >
              An address is the one identity attribute that survives every form of synthesis. A face can be generated. A voice can be cloned. A document can be forged. An address can be checked against physical mail, deeds, leases, and a postcard sent in the actual post.
            </p>
            <p
              className="mh-reveal mh-reveal-d3"
              style={{ fontSize: '18px', lineHeight: '30px', color: 'var(--ink-2)', margin: 0, maxWidth: '460px' }}
            >
              It is the only piece of identity that ties a digital account to a real, accountable person — one who can be reached, named, and held to what they said.
            </p>
          </div>
          <div className="mh-reveal mh-reveal-d2 w-full" style={{ aspectRatio: '4 / 3' }} aria-hidden="true">
            <svg viewBox="0 0 600 450" fill="none" stroke="#1B1815" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <g stroke="#D6CFC0" strokeWidth="0.6" strokeDasharray="2 4">
                <line x1="0" y1="225" x2="600" y2="225" />
                <line x1="300" y1="0" x2="300" y2="450" />
              </g>

              {/* postcard */}
              <g transform="translate(50, 120)">
                <rect x="0" y="0" width="160" height="110" rx="3" />
                <rect x="124" y="10" width="26" height="32" strokeDasharray="3 3" />
                <line x1="14" y1="58" x2="100" y2="58" />
                <line x1="14" y1="72" x2="80" y2="72" />
                <g fontFamily="ui-monospace, Menlo, monospace" fontSize="14" fill="#1B1815" stroke="none" fontWeight="600">
                  <text x="14" y="35">7M·QH4·9V</text>
                </g>
                <text x="14" y="98" fontFamily="var(--font-serif)" fontSize="9" fill="#7A736A" stroke="none">
                  VERIFICATION POSTCARD
                </text>
              </g>

              {/* envelope */}
              <g transform="translate(220, 90)">
                <rect x="0" y="20" width="160" height="115" rx="4" />
                <path d="M0 30 L80 90 L160 30" />
                <circle cx="80" cy="90" r="11" />
                <text x="80" y="94" textAnchor="middle" fontFamily="Iowan Old Style, Georgia, serif" fontStyle="italic" fontSize="10" stroke="none" fill="#1B1815">P</text>
                <text x="0" y="160" fontFamily="var(--font-serif)" fontSize="9" fill="#7A736A" stroke="none">
                  DEED · LEASE · UTILITY
                </text>
              </g>

              {/* profile -> address */}
              <g transform="translate(400, 110)">
                <circle cx="35" cy="35" r="28" />
                <circle cx="35" cy="28" r="9" />
                <path d="M16 56 a19 19 0 0 1 38 0" />
                <path d="M75 35 L115 35" strokeDasharray="2 3" />
                <path d="M108 30 L115 35 L108 40" />
                <rect x="120" y="14" width="30" height="42" rx="2" />
                <line x1="125" y1="22" x2="145" y2="22" />
                <line x1="125" y1="29" x2="142" y2="29" />
                <line x1="125" y1="36" x2="145" y2="36" />
                <line x1="125" y1="43" x2="138" y2="43" />
                <text x="0" y="100" fontFamily="var(--font-serif)" fontSize="9" fill="#7A736A" stroke="none">
                  PROFILE · ADDRESS · MATCH
                </text>
              </g>

              <path d="M215 175 C 230 175, 230 145, 220 145" strokeDasharray="3 4" />
              <path d="M384 145 C 395 145, 395 175, 405 175" strokeDasharray="3 4" />

              <g transform="translate(220, 320)">
                <circle cx="80" cy="40" r="40" />
                <path d="M62 42 L75 55 L100 28" strokeWidth="1.8" />
                <text x="80" y="105" textAnchor="middle" fontFamily="ui-sans-serif" fontSize="10" letterSpacing="1.2" fill="#1B1815" stroke="none" fontWeight="600">
                  VERIFIED · ANCHORED
                </text>
              </g>
              <line x1="130" y1="240" x2="130" y2="300" strokeDasharray="2 3" />
              <line x1="300" y1="225" x2="300" y2="300" strokeDasharray="2 3" />
              <line x1="470" y1="220" x2="470" y2="300" strokeDasharray="2 3" />
              <line x1="130" y1="300" x2="470" y2="300" />
              <line x1="300" y1="300" x2="300" y2="320" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
