// ─────────────────────────────────────────────────────────────
// Place — preview (anonymous, signed out)
// Same shell as the ProfileDashboard archetype, at the preview tier.
// What a stranger sees right after typing their address. No account.
// Reuses place-components.jsx atoms; new header / hero / pinned bar.
// ─────────────────────────────────────────────────────────────

// ── Header — no avatar, a quiet "Sign in" text link ────────────
function PreviewHeader({ address = '1421 SE Oak St, Portland' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '0 18px', gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: '#111827', lineHeight: '32px' }}>Your Place</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5, color: '#6b7280' }}>
          <Icon name="map-pin" size={14} color="#9ca3af" strokeWidth={2} />
          <span style={{ fontSize: 14, fontWeight: 500 }}>{address}</span>
        </div>
      </div>
      <button className="pl-textbtn" style={{ background: 'none', border: 'none', padding: '2px 0', marginTop: 3, cursor: 'pointer', color: SKY, fontWeight: 600, fontSize: 14, fontFamily: 'inherit', lineHeight: '20px', whiteSpace: 'nowrap', flexShrink: 0 }}>Sign in</button>
    </div>
  );
}

// ── Hero — welcoming, framed for a stranger (not a personal claim) ──
function PreviewHero() {
  return (
    <div className="pl-card pl-hero" style={{ padding: '16px 16px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: MUTE }}>Public preview</span>
        <Chip tone="success" icon="check">Free · one-time look</Chip>
      </div>

      <div style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#DCFCE7', border: '1px solid #bbf7d0' }}>
          <Icon name="map-pinned" size={22} color={HOME_GREEN} strokeWidth={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: INK, lineHeight: '23px', letterSpacing: '-0.012em' }}>
            Here's what's public about your address — a free, one-time look.
          </div>
          <div style={{ fontSize: 13.5, color: MUTE, lineHeight: '19px', marginTop: 7 }}>
            Create an account to save this place and keep it updated every day.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pinned bottom bar — the only CTA on a pre-account screen ────
function CreateAccountBar() {
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 40, padding: '13px 16px 30px', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(14px) saturate(180%)', WebkitBackdropFilter: 'blur(14px) saturate(180%)', borderTop: '1px solid #ececef' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: INK, letterSpacing: '-0.01em', lineHeight: '19px' }}>Create a free account to save this place and get daily updates</div>
          <div style={{ fontSize: 12.5, color: MUTE, marginTop: 2 }}>Free. Takes a minute.</div>
        </div>
        <button style={{ flexShrink: 0, background: SKY, color: '#fff', border: 'none', borderRadius: 12, padding: '12px 18px', fontFamily: 'inherit', fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', cursor: 'pointer', boxShadow: '0 6px 16px rgba(2,132,199,0.18)', whiteSpace: 'nowrap' }}>Create account</button>
      </div>
    </div>
  );
}

// ── Group (overline label + stacked cards) ─────────────────────
function Group({ label, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <GroupLabel>{label}</GroupLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PlacePreview — the assembled signed-out screen
// block: 'warm' (a few verified homes) | 'cold' (no activity yet)
// ─────────────────────────────────────────────────────────────
function PlacePreview({ block = 'warm' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'auto', background: '#f6f7f9', paddingTop: 54, paddingBottom: 116 }}>
        <PreviewHeader />

        <div style={{ padding: '14px 16px 2px' }}>
          <PreviewHero />
        </div>

        <div style={{ padding: '20px 16px 0' }}>
          {/* FREE — the one-shot demonstration, real content */}
          <Group label="Risk & readiness">
            <SectionCard icon="waves" title="Flood" value="Zone X — minimal risk" chip={{ tone: 'success', text: 'Minimal risk' }} caption="FEMA flood zone, area-level" />
          </Group>

          <Group label="Your block">
            <DensityCard bucket={block === 'cold' ? 'none' : 'few'} />
            <SectionCard icon="house" title="Homes here" value="Median built 1985" caption="Census, area-level — not your home" />
          </Group>

          {/* LOCKED — everything recurring or exact is account-gated */}
          <Group label="Daily conditions">
            <LockedCard icon="cloud-sun" title="Daily conditions" reason="Create an account to get daily weather, air quality, and alerts — updated every day." cta="Create account" />
          </Group>

          <Group label="Home details & value">
            <LockedCard icon="home" title="Home details & value" reason="Save this place to see your home's exact details and value." cta="Create account" />
          </Group>

          <Group label="Health & environment">
            <LockedCard icon="flask-conical" title="Health & environment" reason="Create an account to see lead, radon, water, and nearby environmental records for your address." cta="Create account" />
          </Group>

          <Group label="Money signals">
            <LockedCard icon="zap" title="Money signals" reason="Create an account to see bill benchmarks and rebates you may be eligible for." cta="Create account" />
          </Group>

          <Group label="Civic">
            <LockedCard icon="landmark" title="Civic" reason="Create an account to see your voting districts, elections, and a residency letter." cta="Create account" />
          </Group>
        </div>
      </div>

      <CreateAccountBar />
    </div>
  );
}

Object.assign(window, { PlacePreview, PreviewHeader, PreviewHero, CreateAccountBar, Group });
