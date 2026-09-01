// ─────────────────────────────────────────────────────────────────────────────
// ProblemSection — Theatrical one-liner ("theatre") section
// "AI can fake a face. It can't fake an address."
// ─────────────────────────────────────────────────────────────────────────────

export default function ProblemSection() {
  return (
    <section
      id="problem"
      className="relative flex items-center justify-center"
      style={{ minHeight: '92vh', background: 'var(--paper-cool)', padding: '120px 0' }}
    >
      <div className="text-center max-w-[1200px] px-6 sm:px-10">
        <div
          className="mh-reveal mx-auto"
          style={{ width: '48px', height: '1px', background: 'var(--ink-4)', marginBottom: '56px' }}
        />
        <h2 className="mh-display-theatre mh-reveal mh-reveal-d1">
          AI can fake a face.<br />
          It can&rsquo;t fake an address.
        </h2>
        <p
          className="mh-reveal mh-reveal-d2 mx-auto"
          style={{
            marginTop: '48px',
            maxWidth: '520px',
            fontSize: '18px',
            lineHeight: '30px',
            color: 'var(--ink-3)',
          }}
        >
          Pantopus starts where every other identity system ends — at the physical world.
        </p>
      </div>
    </section>
  );
}
