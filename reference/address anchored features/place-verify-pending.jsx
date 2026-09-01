// ─────────────────────────────────────────────────────────────
// Place — B2 · Verification in progress / pending
// The calm status screen after Start verification. Method-specific:
//   postcard → "your code is on the way" + a 6-cell code entry
//   records  → a shimmer skeleton ("Checking property records…"),
//              never the word "Loading…"
// Both carry the same promise: the dashboard stays fully available
// while you wait. Home-green for the place, sky for the action.
// Reuses place-components atoms (Icon, IconTile, Skel, colors).
// ─────────────────────────────────────────────────────────────

// ── Header — back + centered "Verification" ────────────────────
function PendingHeader() {
  return (
    <div style={{ padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <button className="lx-back" style={{ width: 36, height: 36, borderRadius: 9999, background: '#fff', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        <Icon name="arrow-left" size={18} color={INK2} strokeWidth={2.25} />
      </button>
      <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: FAINT }}>Verification</span>
      <div style={{ width: 36 }} />
    </div>
  );
}

// ── Status mark — green address tile + method badge ────────────
//   variant: 'mail' (clock) · 'records' (spinning loader)
function StatusMark({ variant = 'mail' }) {
  const records = variant === 'records';
  return (
    <div style={{ position: 'relative', width: 64, height: 64 }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: HOME_GREEN_BG, border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={records ? 'file-search' : 'mailbox'} size={30} color={HOME_GREEN} strokeWidth={2} />
      </div>
      <div style={{ position: 'absolute', right: -6, bottom: -6, width: 28, height: 28, borderRadius: 9999, background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 2px 6px rgba(17,24,39,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {records
          ? <span className="vf-spin" style={{ display: 'inline-flex' }}><Icon name="loader-2" size={16} color="#0369a1" strokeWidth={2.5} /></span>
          : <Icon name="clock" size={16} color="#0369a1" strokeWidth={2.25} />}
      </div>
    </div>
  );
}

// ── Code entry — 6 cells, active cell gets sky ring + caret ─────
function CodeBoxes({ value = '', active = false }) {
  const cells = 6;
  return (
    <div style={{ display: 'flex', gap: 9 }}>
      {Array.from({ length: cells }).map((_, i) => {
        const ch = value[i];
        const isActive = active && i === value.length && value.length < cells;
        const filled = ch != null && ch !== '';
        return (
          <div key={i} style={{
            flex: 1, height: 56, borderRadius: 13, background: '#fff',
            border: `1.5px solid ${isActive ? SKY : filled ? '#cbd5e1' : BORDER}`,
            boxShadow: isActive ? '0 0 0 4px rgba(2,132,199,0.12)' : '0 1px 2px rgba(0,0,0,0.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 600, color: INK, letterSpacing: '0.02em',
            transition: 'border-color .15s ease, box-shadow .15s ease',
          }}>
            {filled ? ch : (isActive ? <span className="lx-caret" style={{ display: 'inline-block', width: 2, height: 26, background: SKY, borderRadius: 1 }} /> : '')}
          </div>
        );
      })}
    </div>
  );
}

// ── Source row being checked (records method) — shimmer value ──
function SourceRow({ icon, label, isLast = false, done = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderBottom: isLast ? 'none' : '1px solid #f1f3f5' }}>
      <IconTile name={icon} tone={done ? 'home' : 'muted'} size={32} />
      <div style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 600, color: INK, letterSpacing: '-0.01em' }}>{label}</div>
      {done
        ? <Chip tone="success" icon="check">Matched</Chip>
        : <Skel w={62} h={11} r={6} />}
    </div>
  );
}

// ── Reassurance card — the dashboard stays available ───────────
function ReassuranceCard() {
  return (
    <div className="pl-card" style={{ background: '#F0F9FF', borderColor: '#bae6fd', padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 11 }}>
      <Icon name="shield-check" size={20} color="#0369a1" strokeWidth={2} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 500, color: '#0c5181', lineHeight: '19px', letterSpacing: '-0.005em' }}>Your dashboard stays fully available while you wait.</span>
    </div>
  );
}

// ── Footer primary — back to dashboard (sky) ───────────────────
function DashboardButton() {
  return (
    <button className="vf-primary" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      width: '100%', height: 52, background: SKY, color: '#fff', border: 'none', borderRadius: 13,
      fontFamily: 'inherit', fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', cursor: 'pointer',
      boxShadow: '0 6px 16px rgba(2,132,199,0.20)',
    }}>
      Go to your dashboard
      <Icon name="arrow-right" size={17} color="#fff" strokeWidth={2.5} />
    </button>
  );
}

// ── Quiet text link (resend / cancel) ──────────────────────────
function QuietLink({ children, icon }) {
  return (
    <button className="pl-textbtn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: SKY, fontWeight: 600, fontSize: 13.5, fontFamily: 'inherit' }}>
      {icon && <Icon name={icon} size={14} color={SKY} strokeWidth={2.25} />}
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// VerifyPending — assembled screen
//   method: 'mail' | 'records'
//   code:   typed digits for the postcard cell field
//   active: whether the code field shows a focused/caret cell
// ─────────────────────────────────────────────────────────────
function VerifyPending({ method = 'mail', code = '', active = false }) {
  const records = method === 'records';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f6f7f9', paddingTop: 56 }}>
      <PendingHeader />

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '24px 18px 24px' }}>
        <StatusMark variant={method} />

        <h1 style={{ margin: '20px 0 0', fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em', color: INK, lineHeight: '30px' }}>
          {records ? 'Checking property records…' : 'Your code is on the way'}
        </h1>
        <p style={{ margin: '11px 0 0', fontSize: 14.5, color: INK2, lineHeight: '21px', letterSpacing: '-0.005em' }}>
          {records
            ? "We're matching your name to county records. This usually takes a few minutes — you can leave this screen."
            : 'A postcard with your code is on the way — usually 5–7 days. Enter the code when it arrives.'}
        </p>

        {/* method-specific body */}
        {records ? (
          <div style={{ marginTop: 22 }}>
            <div className="pl-card" style={{ padding: 0, overflow: 'hidden' }}>
              <SourceRow icon="landmark" label="County deed record" done />
              <SourceRow icon="receipt" label="Tax assessor roll" />
              <SourceRow icon="map-pin" label="USPS address match" isLast />
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: FAINT, marginBottom: 10, padding: '0 2px' }}>Enter your 6-digit code</div>
            <CodeBoxes value={code} active={active} />
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12.5, color: MUTE }}>Didn't arrive in 7 days?</span>
              <QuietLink icon="rotate-cw">Mail a new code</QuietLink>
            </div>
          </div>
        )}

        {/* reassurance */}
        <div style={{ marginTop: 24 }}>
          <ReassuranceCard />
        </div>
      </div>

      {/* footer */}
      <div style={{ padding: '12px 16px 14px' }}>
        <DashboardButton />
      </div>
    </div>
  );
}

Object.assign(window, {
  VerifyPending, PendingHeader, StatusMark, CodeBoxes, SourceRow,
  ReassuranceCard, DashboardButton, QuietLink,
});
