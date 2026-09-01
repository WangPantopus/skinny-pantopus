// ─────────────────────────────────────────────────────────────
// Place — B3 · Verified (success)
// The quiet payoff. No confetti — a calm trust moment: a green
// verified seal, "Your address is verified.", and a soft reveal
// of the three rows that just unlocked. One way forward: go to
// your place. Home-green carries the win; sky carries the action.
// Reuses place-components atoms (Icon, IconTile, colors).
// ─────────────────────────────────────────────────────────────

// ── Verified seal — green disc + soft halo, calm not loud ──────
function VerifiedSeal() {
  return (
    <div className="vd-seal" style={{ position: 'relative', width: 108, height: 108, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* halo rings */}
      <div style={{ position: 'absolute', width: 108, height: 108, borderRadius: '50%', background: 'rgba(22,163,74,0.07)' }} />
      <div style={{ position: 'absolute', width: 92, height: 92, borderRadius: '50%', background: 'rgba(22,163,74,0.11)' }} />
      {/* disc */}
      <div style={{ width: 78, height: 78, borderRadius: '50%', background: 'linear-gradient(135deg,#22c55e,#15803d)', boxShadow: '0 10px 24px rgba(22,163,74,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="check" size={42} color="#fff" strokeWidth={3} />
      </div>
    </div>
  );
}

// ── Available row — a now-unlocked destination, green + chevron ─
function AvailableRow({ icon, label, sub, isLast = false, index = 0 }) {
  return (
    <div className="vd-row" style={{ '--i': index, display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', cursor: 'pointer', borderBottom: isLast ? 'none' : '1px solid #f1f3f5' }}>
      <IconTile name={icon} tone="home" size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: INK, letterSpacing: '-0.01em' }}>{label}</div>
        {sub && <div style={{ fontSize: 12.5, color: MUTE, marginTop: 1, lineHeight: '17px' }}>{sub}</div>}
      </div>
      <Icon name="chevron-right" size={18} color="#c4c8cf" strokeWidth={2.25} />
    </div>
  );
}

// ── Footer primary — "Go to your place" (sky) ──────────────────
function GoToPlaceButton({ label = 'Go to your place' }) {
  return (
    <button className="vf-primary" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      width: '100%', height: 52, background: SKY, color: '#fff', border: 'none', borderRadius: 13,
      fontFamily: 'inherit', fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', cursor: 'pointer',
      boxShadow: '0 6px 16px rgba(2,132,199,0.20)',
    }}>
      {label}
      <Icon name="arrow-right" size={17} color="#fff" strokeWidth={2.5} />
    </button>
  );
}

const VERIFIED_ROWS = [
  { icon: 'message-circle', label: 'Message neighbors', sub: 'Start a conversation with people on your block' },
  { icon: 'mailbox', label: 'Your mailbox', sub: 'Track packages, civic notices, and permits' },
  { icon: 'file-text', label: 'Generate a residency letter', sub: 'Proof of address, ready to download' },
];

// ─────────────────────────────────────────────────────────────
// VerifiedSuccess — the assembled screen
// ─────────────────────────────────────────────────────────────
function VerifiedSuccess({ address = '1421 SE Oak St' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f6f7f9', paddingTop: 56 }}>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '40px 20px 24px', display: 'flex', flexDirection: 'column' }}>
        {/* centerpiece */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <VerifiedSeal />
          <h1 className="vd-title" style={{ margin: '22px 0 0', fontSize: 25, fontWeight: 700, letterSpacing: '-0.025em', color: INK, lineHeight: '31px' }}>
            Your address is verified.
          </h1>
          <p className="vd-title" style={{ margin: '11px 0 0', fontSize: 14.5, color: INK2, lineHeight: '21px', letterSpacing: '-0.005em', maxWidth: 290 }}>
            You're now an address-proven neighbor at {address}.
          </p>
        </div>

        {/* the reveal */}
        <div style={{ marginTop: 34 }}>
          <div className="vd-title" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: FAINT, marginBottom: 10, padding: '0 2px' }}>Now available</div>
          <div className="pl-card" style={{ padding: 0, overflow: 'hidden' }}>
            {VERIFIED_ROWS.map((r, i) => (
              <AvailableRow key={r.label} icon={r.icon} label={r.label} sub={r.sub} index={i} isLast={i === VERIFIED_ROWS.length - 1} />
            ))}
          </div>
        </div>
      </div>

      {/* footer */}
      <div className="vd-footer" style={{ padding: '12px 16px 14px' }}>
        <GoToPlaceButton />
      </div>
    </div>
  );
}

Object.assign(window, {
  VerifiedSuccess, VerifiedSeal, AvailableRow, GoToPlaceButton,
});
