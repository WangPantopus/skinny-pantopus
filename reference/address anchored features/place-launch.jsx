// ─────────────────────────────────────────────────────────────
// Place — A2 · Onboarding launch hero (U.S. default)
// The very first screen, before an address is typed. Flat background.
// Reuses place-components.jsx atoms (Icon, colors). Home-green accent,
// sky CTA. Plainspoken, second person, verbs-first, sentence case.
// ─────────────────────────────────────────────────────────────

// ── Brand lockup (green Place mark + Pantopus wordmark) ────────
function BrandLockup() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, background: HOME_GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 6px rgba(22,163,74,0.28)' }}>
        <Icon name="map-pinned" size={17} color="#fff" strokeWidth={2.25} />
      </div>
      <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: INK }}>Pantopus</span>
    </div>
  );
}

// ── Detected-region pill (region inferred; tap to change) ──────
function RegionPill({ region = 'United States' }) {
  return (
    <button className="lx-region" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 9999, padding: '5px 9px 5px 8px', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
      <Icon name="globe" size={14} color={MUTE} strokeWidth={2} />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: INK2, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>{region}</span>
      <Icon name="chevron-down" size={13} color={FAINT} strokeWidth={2.25} />
    </button>
  );
}

// ── Address field — resting | typing ───────────────────────────
function AddressField({ typing = false }) {
  const active = typing;
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, height: 54, padding: '0 14px', background: '#fff', borderRadius: 13, border: `1.5px solid ${active ? SKY : BORDER}`, boxShadow: active ? '0 0 0 4px rgba(2,132,199,0.12)' : '0 1px 3px rgba(0,0,0,0.04)' }}>
      <Icon name="map-pin" size={19} color={active ? SKY : FAINT} strokeWidth={2} />
      {typing ? (
        <span style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 500, color: INK, letterSpacing: '-0.01em', display: 'inline-flex', alignItems: 'center' }}>
          1421 SE Oak
          <span className="lx-caret" style={{ display: 'inline-block', width: 2, height: 20, background: SKY, marginLeft: 1, borderRadius: 1 }} />
        </span>
      ) : (
        <span style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 400, color: FAINT, letterSpacing: '-0.01em' }}>Enter your address</span>
      )}
    </div>
  );
}

// ── Primary CTA ────────────────────────────────────────────────
function SeePlaceButton({ compact = false }) {
  return (
    <button className="lx-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', height: compact ? 50 : 54, background: SKY, color: '#fff', border: 'none', borderRadius: 13, fontFamily: 'inherit', fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', cursor: 'pointer', boxShadow: '0 6px 16px rgba(2,132,199,0.20)' }}>
      See your place
      <Icon name="arrow-right" size={17} color="#fff" strokeWidth={2.5} />
    </button>
  );
}

// ── Trust line ─────────────────────────────────────────────────
function TrustLine() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 6, padding: '0 8px' }}>
      <Icon name="lock" size={13} color={FAINT} strokeWidth={2} style={{ marginTop: 1 }} />
      <span style={{ fontSize: 12.5, color: MUTE, lineHeight: '17px', textAlign: 'center' }}>
        Private by default. Verification builds trust, not exposure.
      </span>
    </div>
  );
}

// ── Address autocomplete (typing state) ────────────────────────
function AddressSuggestions() {
  const rows = [
    { line: '1421 SE Oak St', sub: 'Portland, OR 97214', best: true },
    { line: '1421 SE Oakway Ct', sub: 'Portland, OR 97215' },
    { line: '1421 Oakdale Ave', sub: 'Gresham, OR 97030' },
  ];
  return (
    <div className="pl-card" style={{ padding: 4, marginTop: 8 }}>
      {rows.map((r, i) => (
        <div key={i} className="lx-sugg" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 10px', borderRadius: 10, background: r.best ? '#F0F9FF' : 'transparent', borderBottom: i < rows.length - 1 ? `1px solid ${r.best ? 'transparent' : '#f1f3f5'}` : 'none' }}>
          <Icon name="map-pin" size={16} color={r.best ? SKY : FAINT} strokeWidth={2} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: INK, letterSpacing: '-0.01em' }}>{r.line}</div>
            <div style={{ fontSize: 12.5, color: MUTE, marginTop: 1 }}>{r.sub}</div>
          </div>
          {r.best && <Icon name="corner-down-left" size={15} color={SKY} strokeWidth={2} />}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// LaunchHero — resting (centered) | typing (top-aligned + keyboard)
// ─────────────────────────────────────────────────────────────
function LaunchHero({ state = 'resting' }) {
  const typing = state === 'typing';

  // top chrome (brand + region) — shared
  const topBar = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px' }}>
      <BrandLockup />
      <RegionPill />
    </div>
  );

  if (typing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f6f7f9', paddingTop: 56 }}>
        <div style={{ paddingBottom: 6 }}>{topBar}</div>
        <div style={{ padding: '18px 18px 0' }}>
          <h1 style={{ margin: 0, fontSize: 25, fontWeight: 700, letterSpacing: '-0.025em', color: INK, lineHeight: '30px' }}>See what's true about your address.</h1>
          <div style={{ marginTop: 14 }}>
            <AddressField typing />
            <AddressSuggestions />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f6f7f9', paddingTop: 56, paddingBottom: 34 }}>
      <div style={{ paddingTop: 8 }}>{topBar}</div>

      {/* centered hero block */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 22px' }}>
        <h1 style={{ margin: 0, fontSize: 31, fontWeight: 700, letterSpacing: '-0.028em', color: INK, lineHeight: '37px' }}>See what's true about your address.</h1>
        <p style={{ margin: '14px 0 0', fontSize: 15.5, color: MUTE, lineHeight: '23px', letterSpacing: '-0.005em' }}>
          Public records, local risks, and who's verified nearby — free, no account. Save your place and get daily updates when you sign up.
        </p>

        <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <AddressField />
          <SeePlaceButton />
        </div>

        <div style={{ marginTop: 16 }}>
          <TrustLine />
        </div>
      </div>

      {/* secondary, low-key — pinned near bottom */}
      <div style={{ padding: '0 22px', display: 'flex', justifyContent: 'center' }}>
        <button className="lx-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', padding: '8px 4px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 500, color: MUTE, letterSpacing: '-0.005em' }}>
          Just here to follow someone or browse?
          <Icon name="arrow-right" size={14} color={SKY} strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );
}

// ── Create-account CTA (global framing) ────────────────────────
function CreateAccountButton() {
  return (
    <button className="lx-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', height: 54, background: SKY, color: '#fff', border: 'none', borderRadius: 13, fontFamily: 'inherit', fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', cursor: 'pointer', boxShadow: '0 6px 16px rgba(2,132,199,0.20)' }}>
      Create your account
      <Icon name="arrow-right" size={17} color="#fff" strokeWidth={2.5} />
    </button>
  );
}

// ── Beacon motif — concentric rings behind a follow glyph ──────
function Beacon() {
  return (
    <div className="lx-beacon" style={{ position: 'relative', width: 96, height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
      <span className="lx-ring lx-ring-2" />
      <span className="lx-ring lx-ring-1" />
      <div style={{ position: 'relative', width: 60, height: 60, borderRadius: 9999, background: SKY, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 22px rgba(2,132,199,0.30)' }}>
        <Icon name="radio" size={28} color="#fff" strokeWidth={2.25} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// GlobalHero — non-U.S. default. Beacon/global framing: follow
// people and places. No address job here; account leads.
// ─────────────────────────────────────────────────────────────
function GlobalHero({ region = 'United Kingdom' }) {
  const topBar = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px' }}>
      <BrandLockup />
      <RegionPill region={region} />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f6f7f9', paddingTop: 56, paddingBottom: 34 }}>
      <div style={{ paddingTop: 8 }}>{topBar}</div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 22px' }}>
        <Beacon />
        <h1 style={{ margin: '24px 0 0', fontSize: 30, fontWeight: 700, letterSpacing: '-0.028em', color: INK, lineHeight: '36px', textAlign: 'center' }}>Follow the people and places you care about.</h1>
        <p style={{ margin: '14px 0 0', fontSize: 15.5, color: MUTE, lineHeight: '23px', letterSpacing: '-0.005em', textAlign: 'center' }}>
          Find verified creators, shops, and communities. Follow them, fan the ones you love, and message the people you trust.
        </p>

        <div style={{ marginTop: 26 }}>
          <CreateAccountButton />
        </div>

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
          <button className="lx-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', padding: '8px 4px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 500, color: INK2, letterSpacing: '-0.005em' }}>
            Have a U.S. address? Look it up
            <Icon name="arrow-right" size={14} color={SKY} strokeWidth={2.25} />
          </button>
        </div>
      </div>

      {/* footnote — quiet, region-aware */}
      <div style={{ padding: '0 22px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <Icon name="clock" size={13} color={FAINT} strokeWidth={2} />
        <span style={{ fontSize: 12.5, color: FAINT, letterSpacing: '-0.005em' }}>Home features are coming to your region.</span>
      </div>
    </div>
  );
}

Object.assign(window, { LaunchHero, GlobalHero, BrandLockup, RegionPill, AddressField, SeePlaceButton, CreateAccountButton, Beacon, TrustLine, AddressSuggestions });
