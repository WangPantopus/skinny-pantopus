// ─────────────────────────────────────────────────────────────────────────────
// FrameSection — "What it is" centered statement on white paper.
// ─────────────────────────────────────────────────────────────────────────────

export default function FrameSection() {
  return (
    <section
      id="frame"
      className="flex items-center justify-center"
      style={{
        background: 'var(--paper-pure)',
        minHeight: '86vh',
        padding: '160px 0',
        borderTop: '1px solid var(--rule)',
      }}
    >
      <div className="text-center mx-auto" style={{ maxWidth: '880px', padding: '0 24px' }}>
        <p className="mh-overline mh-reveal" style={{ marginBottom: '32px' }}>What it is</p>
        <h2 className="mh-h2 mh-reveal mh-reveal-d1 mx-auto" style={{ maxWidth: '780px', margin: '0 auto 32px' }}>
          Pantopus is identity infrastructure. The applications come second.
        </h2>
        <p
          className="mh-reveal mh-reveal-d2 mx-auto"
          style={{ maxWidth: '580px', fontSize: '16px', lineHeight: '28px', color: 'var(--ink-3)' }}
        >
          Built so that what you do digitally, you do as the person you actually are — to people who actually are.
        </p>
      </div>
    </section>
  );
}
