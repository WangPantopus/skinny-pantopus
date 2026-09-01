// ─────────────────────────────────────────────────────────────
// Place — B1 · Prompt to verify (T3 claimed → T4 verified)
// A sheet over the claimed dashboard. Three rows of what verifying
// adds (SectionCard rows, no chevrons) → three selectable methods
// (radio) → a calm "this can take a few days" note → Start
// verification. The Band-D unlock — nothing you have now is taken
// away while you wait. Home-green for the place, sky for the CTA.
// Reuses place-components atoms (Icon, IconTile, colors).
// ─────────────────────────────────────────────────────────────

// ── Benefit row — a SectionCard row with no chevron, no value ──
// "What this unlocks" — purely informational, so it reads as a
// promise, not a tappable destination.
function BenefitRow({ icon, label, sub, isLast = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: isLast ? 'none' : '1px solid #f1f3f5' }}>
      <IconTile name={icon} tone="home" size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: INK, letterSpacing: '-0.01em' }}>{label}</div>
        {sub && <div style={{ fontSize: 12.5, color: MUTE, marginTop: 1, lineHeight: '17px' }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Selectable radio (sky filled-dot when on) ──────────────────
function Radio({ selected = false }) {
  return (
    <span style={{
      width: 22, height: 22, borderRadius: 9999, flexShrink: 0,
      background: '#fff', boxSizing: 'border-box',
      border: selected ? `6.5px solid ${SKY}` : '2px solid #d1d5db',
      boxShadow: selected ? '0 0 0 3px rgba(2,132,199,0.12)' : 'none',
      transition: 'border-color .15s ease, border-width .12s ease, box-shadow .15s ease',
    }} />
  );
}

// ── Method row — selectable, radio trailing ────────────────────
function MethodRow({ icon, label, sub, selected = false, isLast = false }) {
  return (
    <div className="vf-method" style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', cursor: 'pointer',
      borderBottom: isLast ? 'none' : '1px solid #f1f3f5',
      background: selected ? '#F0F9FF' : 'transparent',
      transition: 'background .15s ease',
    }}>
      <IconTile name={icon} tone={selected ? 'sky' : 'muted'} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: INK, letterSpacing: '-0.01em' }}>{label}</div>
        <div style={{ fontSize: 12.5, color: MUTE, marginTop: 1, lineHeight: '17px' }}>{sub}</div>
      </div>
      <Radio selected={selected} />
    </div>
  );
}

// ── Section overline ───────────────────────────────────────────
function SheetOverline({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: FAINT, marginBottom: 9, padding: '0 2px' }}>{children}</div>
  );
}

// ── Primary CTA — "Start verification" (sky) ───────────────────
function StartButton({ label = 'Start verification' }) {
  return (
    <button className="vf-primary" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      width: '100%', height: 52, background: SKY, color: '#fff', border: 'none', borderRadius: 13,
      fontFamily: 'inherit', fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', cursor: 'pointer',
      boxShadow: '0 6px 16px rgba(2,132,199,0.20)',
    }}>
      <Icon name="shield-check" size={17} color="#fff" strokeWidth={2.25} />
      {label}
    </button>
  );
}

const VERIFY_BENEFITS = [
  { icon: 'message-circle', label: 'Message your verified neighbors', sub: 'Direct messages with the people on your block' },
  { icon: 'badge-check', label: 'Your verified badge', sub: 'The address-proven check on your profile' },
  { icon: 'mailbox', label: 'Your digital mailbox', sub: 'Packages, civic notices, and permits in one place' },
];

const VERIFY_METHODS = [
  { id: 'mail', icon: 'send', label: 'Mail a code to my address', sub: 'We send a postcard with a code. Most common.' },
  { id: 'records', icon: 'file-search', label: 'Match property records', sub: 'Instant if your name is on the deed or lease' },
  { id: 'document', icon: 'upload', label: 'Upload a document', sub: 'A utility bill, lease, or bank statement' },
];

// ─────────────────────────────────────────────────────────────
// VerifySheet — the sheet body
//   selected: which method radio is on ('mail' by default)
// ─────────────────────────────────────────────────────────────
function VerifySheet({ selected = 'mail', address = '1421 SE Oak St, Portland' }) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 46,
      background: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22,
      boxShadow: '0 -10px 44px rgba(17,24,39,0.20)',
      padding: '8px 20px 30px',
    }}>
      {/* grabber */}
      <div style={{ width: 40, height: 5, borderRadius: 9999, background: '#d8dce1', margin: '0 auto 12px' }} />

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: HOME_GREEN_BG, border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="shield-check" size={20} color={HOME_GREEN} strokeWidth={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: INK, letterSpacing: '-0.02em', lineHeight: '22px' }}>Verify your address</div>
          <div style={{ fontSize: 13, color: MUTE, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{address}</div>
        </div>
        <button className="vf-x" style={{ width: 30, height: 30, borderRadius: 9999, background: '#f1f3f5', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <Icon name="x" size={16} color={MUTE} strokeWidth={2.5} />
        </button>
      </div>

      {/* what verifying adds — SectionCard rows, no chevrons */}
      <div style={{ marginBottom: 18 }}>
        <SheetOverline>What this unlocks</SheetOverline>
        <div className="pl-card" style={{ padding: 0, overflow: 'hidden' }}>
          {VERIFY_BENEFITS.map((b, i) => (
            <BenefitRow key={b.label} icon={b.icon} label={b.label} sub={b.sub} isLast={i === VERIFY_BENEFITS.length - 1} />
          ))}
        </div>
      </div>

      {/* method picker */}
      <div style={{ marginBottom: 16 }}>
        <SheetOverline>Choose how</SheetOverline>
        <div className="pl-card" style={{ padding: 0, overflow: 'hidden' }}>
          {VERIFY_METHODS.map((m, i) => (
            <MethodRow key={m.id} icon={m.icon} label={m.label} sub={m.sub} selected={selected === m.id} isLast={i === VERIFY_METHODS.length - 1} />
          ))}
        </div>
      </div>

      {/* calm note — nothing is taken away while you wait */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 16, padding: '0 2px' }}>
        <Icon name="clock" size={15} color={FAINT} strokeWidth={2} style={{ marginTop: 1 }} />
        <span style={{ fontSize: 12.5, color: MUTE, lineHeight: '18px', letterSpacing: '-0.003em' }}>
          This can take a few days. Everything you have now stays available while you wait.
        </span>
      </div>

      {/* primary */}
      <StartButton />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// VerifyPrompt — assembled: the claimed dashboard, dimmed, + sheet
// ─────────────────────────────────────────────────────────────
function VerifyPrompt({ selected = 'mail' }) {
  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
      {/* the claimed dashboard behind */}
      <PlaceDashboard hero="allclear" />
      {/* scrim — starts below the status bar so the clock stays legible */}
      <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 0, background: 'rgba(17,24,39,0.42)', zIndex: 45 }} />
      {/* the sheet */}
      <VerifySheet selected={selected} />
    </div>
  );
}

Object.assign(window, {
  VerifyPrompt, VerifySheet, BenefitRow, MethodRow, Radio, StartButton, SheetOverline,
});
