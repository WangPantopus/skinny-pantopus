// ─────────────────────────────────────────────────────────────────────────────
// PillarsSection — Three numbered principles (Anchored / Unforgeable / Layered)
// ─────────────────────────────────────────────────────────────────────────────

const PILLARS = [
  {
    num: '01',
    title: 'Anchored.',
    body: 'Every identity in Pantopus traces back to a verified physical address. There is no anonymous tier.',
  },
  {
    num: '02',
    title: 'Unforgeable.',
    body: 'Verification methods are physical — postcards, deeds, leases, on-site confirmation. Models cannot fabricate the inputs.',
    delay: 1 as const,
  },
  {
    num: '03',
    title: 'Layered.',
    body: 'One root identity supports many faces. Privacy is by default; linking is by choice.',
    delay: 2 as const,
  },
];

export default function PillarsSection() {
  return (
    <section id="pillars" style={{ padding: '160px 0', background: 'var(--paper)' }}>
      <div className="w-full max-w-[1280px] mx-auto px-6 sm:px-10 lg:px-16">
        <div className="text-center mx-auto" style={{ maxWidth: '880px', marginBottom: '96px' }}>
          <p className="mh-overline mh-reveal mb-5">Why it holds</p>
          <h2 className="mh-h2 mh-reveal mh-reveal-d1">Three principles, every surface.</h2>
        </div>

        <div className="grid gap-14 md:grid-cols-3">
          {PILLARS.map((p) => (
            <div
              key={p.num}
              className={`mh-reveal ${p.delay === 1 ? 'mh-reveal-d1' : p.delay === 2 ? 'mh-reveal-d2' : ''}`}
              style={{
                borderTop: '1px solid var(--rule-strong)',
                paddingTop: '40px',
              }}
            >
              <span
                className="block"
                style={{
                  fontFamily: 'ui-sans-serif, system-ui',
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.16em',
                  color: 'var(--ink-3)',
                  marginBottom: '18px',
                }}
              >
                {p.num}
              </span>
              <h3
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '36px',
                  fontWeight: 500,
                  letterSpacing: '-0.018em',
                  margin: '0 0 28px',
                  color: 'var(--ink-1)',
                }}
              >
                {p.title}
              </h3>
              <p style={{ margin: 0, fontSize: '16px', lineHeight: '28px', color: 'var(--ink-2)' }}>{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
