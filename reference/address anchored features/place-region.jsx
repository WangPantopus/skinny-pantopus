// ─────────────────────────────────────────────────────────────
// Place — A6 · Coming to your region (non-U.S.)
// The non-U.S. home/address state. Never a dead end: honest about
// what's U.S.-only and why, a "notify me" hook, and a clear path
// to what already works everywhere (follow on Beacon, browse).
// Reuses place-components atoms + place-address ActionRow.
// Home-green for the place, sky for Beacon actions.
// ─────────────────────────────────────────────────────────────

// ── Header — back + detected region ────────────────────────────
function RegionHeader({ region = 'United Kingdom' }) {
  return (
    <div style={{ padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <button className="lx-back" style={{ width: 36, height: 36, borderRadius: 9999, background: '#fff', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        <Icon name="arrow-left" size={18} color={INK2} strokeWidth={2.25} />
      </button>
      <RegionPill region={region} />
    </div>
  );
}

// ── Hero mark — green address tile with a "coming" clock badge ──
function ComingMark() {
  return (
    <div style={{ position: 'relative', width: 64, height: 64 }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: HOME_GREEN_BG, border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="map-pinned" size={30} color={HOME_GREEN} strokeWidth={2} />
      </div>
      <div style={{ position: 'absolute', right: -6, bottom: -6, width: 28, height: 28, borderRadius: 9999, background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 2px 6px rgba(17,24,39,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="clock" size={16} color="#0369a1" strokeWidth={2.25} />
      </div>
    </div>
  );
}

// ── Notify CTA — sky, bell ─────────────────────────────────────
function NotifyButton() {
  return (
    <button className="rg-primary" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      width: '100%', height: 52, background: SKY, color: '#fff', border: 'none', borderRadius: 13,
      fontFamily: 'inherit', fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', cursor: 'pointer',
      boxShadow: '0 6px 16px rgba(2,132,199,0.20)',
    }}>
      <Icon name="bell" size={17} color="#fff" strokeWidth={2.25} />
      Notify me when it's available
    </button>
  );
}

// ── Notified confirmation (after tapping) ──────────────────────
function NotifiedCard({ region = 'United Kingdom' }) {
  return (
    <div className="pl-card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, background: '#F0FDF4', borderColor: '#bbf7d0' }}>
      <div style={{ width: 38, height: 38, borderRadius: 9999, background: HOME_GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name="check" size={20} color="#fff" strokeWidth={3} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#15803d', letterSpacing: '-0.01em' }}>You're on the list</div>
        <div style={{ fontSize: 13, color: '#3f7a52', marginTop: 2, lineHeight: '18px' }}>We'll email you the day Home opens in {region}. One note — no spam.</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ComingToRegion — the assembled non-U.S. screen
//   notified=true → CTA becomes the confirmation card
// ─────────────────────────────────────────────────────────────
function ComingToRegion({ region = 'United Kingdom', notified = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f6f7f9', paddingTop: 56 }}>
      <RegionHeader region={region} />

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '24px 18px 28px' }}>
        {/* hero — honest, calm */}
        <ComingMark />
        <h1 style={{ margin: '20px 0 0', fontSize: 25, fontWeight: 700, letterSpacing: '-0.025em', color: INK, lineHeight: '31px' }}>
          Home features are coming to your region.
        </h1>
        <p style={{ margin: '12px 0 0', fontSize: 14.5, color: INK2, lineHeight: '21px', letterSpacing: '-0.005em' }}>
          Records, risks, and home details come from U.S. public-data sources — county records, FEMA, the Census. We haven't connected the equivalents in {region} yet.
        </p>

        {/* the hook */}
        <div style={{ marginTop: 22 }}>
          {notified ? <NotifiedCard region={region} /> : <NotifyButton />}
          {!notified && (
            <p style={{ margin: '11px 4px 0', fontSize: 12.5, color: MUTE, lineHeight: '17px', textAlign: 'center' }}>
              One email when Home lands in {region}. Nothing else.
            </p>
          )}
        </div>

        {/* path out — what already works everywhere */}
        <div style={{ marginTop: 30 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: FAINT, padding: '0 2px', marginBottom: 9 }}>Available everywhere now</div>
          <div className="pl-card" style={{ padding: 4 }}>
            <ActionRow icon="users-round" label="Follow people and places" sub="Creators, shops, and communities on Beacon" />
            <ActionRow icon="compass" label="Browse the map" sub="See who's verified and what's happening nearby" />
          </div>
        </div>

        {/* footnote — quiet, region-aware */}
        <div style={{ marginTop: 22, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 6, padding: '0 8px' }}>
          <Icon name="globe" size={13} color={FAINT} strokeWidth={2} style={{ marginTop: 1 }} />
          <span style={{ fontSize: 12.5, color: MUTE, lineHeight: '17px', textAlign: 'center' }}>Following, fanning, and messaging verified people work in {region} today.</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ComingToRegion, RegionHeader, ComingMark, NotifyButton, NotifiedCard });
