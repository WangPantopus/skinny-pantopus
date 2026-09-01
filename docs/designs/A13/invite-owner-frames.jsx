// Pantopus — A13.2 · Invite owner (simple form variant)
// File: src/app/homes/[id]/owners/invite.tsx
// Inherits A13 scaffolding. Canonical archetype reference (FrameInvite from
// Form.html is literally this screen) — top-bar "Send" text action, NOT sticky.
//
// Two frames:
//   FrameInviteOwnerFilled    — populated + valid, "Send" enabled
//   FrameInviteOwnerConflict  — cumulative ownership exceeds 100%, "Send"
//                               disabled, inline conflict message + rebalance link

const {
  F, Phone, TopBar, OverlineLabel, FieldLabel,
  Input, Textarea, Section, ScrollArea, Card,
} = window;

// ─── Local atoms ───────────────────────────────────────────────

// Home-context strip — same shape as A13.1 but tinted for the Owners surface
function HomeContextStrip() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px', background: F.primary50,
      border: `1px solid ${F.primary100}`,
      borderRadius: 10,
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8,
        background: 'linear-gradient(135deg,#16a34a,#15803d)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', flexShrink: 0,
      }}>
        <i data-lucide="home" style={{ width: 15, height: 15 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: F.fg1, letterSpacing: -0.1 }}>412 Elm St · Apt 3B</div>
        <div style={{ fontSize: 11, color: F.fg3, marginTop: 1 }}>Kovács household</div>
      </div>
      <span style={{
        fontSize: 9.5, fontWeight: 700, letterSpacing: 0.1,
        color: F.primary700, background: F.primary100,
        padding: '3px 7px', borderRadius: 4, textTransform: 'uppercase',
      }}>Owner invite</span>
    </div>
  );
}

// Slider with a state prop — track + thumb + pill all swap on error
function StatefulSlider({ value = 25, max = 100, state = 'default' }) {
  const pct = (value / max) * 100;
  const trackOn   = state === 'error' ? F.error600 : F.primary600;
  const thumbBd   = state === 'error' ? F.error600 : F.primary600;
  const pillBg    = state === 'error' ? F.errorBg  : F.primary50;
  const pillFg    = state === 'error' ? F.error    : F.primary700;
  const thumbSh   = state === 'error'
    ? '0 2px 6px rgba(220,38,38,0.25), 0 1px 2px rgba(0,0,0,0.08)'
    : '0 2px 6px rgba(2,132,199,0.25), 0 1px 2px rgba(0,0,0,0.08)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ flex: 1, position: 'relative', height: 24, display: 'flex', alignItems: 'center' }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2,
          background: F.sunken,
        }} />
        <div style={{
          position: 'absolute', left: 0, width: `${pct}%`, height: 4, borderRadius: 2,
          background: trackOn,
        }} />
        <div style={{
          position: 'absolute', left: `calc(${pct}% - 12px)`, width: 24, height: 24,
          borderRadius: '50%', background: F.surface,
          border: `2px solid ${thumbBd}`, boxShadow: thumbSh,
        }} />
      </div>
      <div style={{
        minWidth: 44, padding: '4px 10px', borderRadius: 9999,
        background: pillBg, color: pillFg,
        fontSize: 13, fontWeight: 700, textAlign: 'center', letterSpacing: -0.1,
        fontFamily: 'ui-monospace, Menlo, monospace',
      }}>{value}%</div>
    </div>
  );
}

// Existing-owners summary bar shown above the slider — gives the constraint context
function OwnershipSummary({ owners, available, conflict }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px', background: F.sunken,
      borderRadius: 8, marginBottom: 12,
    }}>
      <div style={{ display: 'flex', gap: -8, marginRight: 4 }}>
        {owners.map((o, i) => (
          <div key={i} style={{
            width: 22, height: 22, borderRadius: '50%', background: o.bg,
            border: '2px solid #fff', marginLeft: i === 0 ? 0 : -8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 9, fontWeight: 700, letterSpacing: -0.2,
          }}>{o.initials}</div>
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 0, fontSize: 11, color: F.fg3, lineHeight: '15px' }}>
        {owners.map((o, i) => (
          <span key={i}>
            <span style={{ color: F.fg1, fontWeight: 600 }}>{o.name}</span>{' '}
            <span style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{o.pct}%</span>
            {i < owners.length - 1 ? ' · ' : ''}
          </span>
        ))}
      </div>
      <span style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: 0.1,
        color: conflict ? F.error : F.success,
        background: conflict ? F.errorBg : F.successBg,
        padding: '3px 7px', borderRadius: 4, textTransform: 'uppercase',
        fontFamily: 'ui-monospace, Menlo, monospace',
      }}>{available}% left</span>
    </div>
  );
}

// ─── FRAME · POPULATED (valid, ready to send) ──────────────────

function FrameInviteOwnerFilled() {
  const owners = [
    { initials: 'MK', name: 'You',   pct: 75, bg: 'linear-gradient(135deg,#0ea5e9,#0369a1)' },
  ];
  return (
    <Phone>
      <TopBar title="Invite owner" rightLabel="Send" rightDisabled={false} />
      <ScrollArea bottomPad={32}>

        <HomeContextStrip />

        <Section overline="Contact info">
          <div>
            <FieldLabel required>Email</FieldLabel>
            <Input value="maya.fortune@pantopus.app" state="valid" type="email" />
          </div>
          <div>
            <FieldLabel>Phone (optional)</FieldLabel>
            <Input value="(415) 555-0198" leading="+1" helper="Used only for SMS verification code." />
          </div>
        </Section>

        <Section overline="Ownership share">
          <div>
            <OwnershipSummary owners={owners} available={25} />
            <FieldLabel required>Share to grant</FieldLabel>
            <StatefulSlider value={25} />
            <div style={{ fontSize: 11, color: F.fg3, marginTop: 8, fontStyle: 'italic' }}>
              Used for bill splits and decision quorum. You keep 75%.
            </div>
          </div>
        </Section>

        <Section overline="Role">
          <div>
            <FieldLabel>What Maya is responsible for (optional)</FieldLabel>
            <Textarea
              value="Books — invoices, bill splits, taxes. Co-signer on the lease renewal in March."
              height={92}
              charCount="90 / 240"
            />
            <div style={{ fontSize: 11, color: F.fg3, marginTop: 6, fontStyle: 'italic' }}>
              Visible to other owners. Helps avoid stepping on each other.
            </div>
          </div>
        </Section>

      </ScrollArea>
    </Phone>
  );
}

// ─── FRAME · OWNERSHIP CONFLICT ────────────────────────────────

function FrameInviteOwnerConflict() {
  const owners = [
    { initials: 'MK', name: 'Maria',  pct: 50, bg: 'linear-gradient(135deg,#0ea5e9,#0369a1)' },
    { initials: 'MK', name: 'Marcus', pct: 30, bg: 'linear-gradient(135deg,#16a34a,#15803d)' },
  ];
  return (
    <Phone>
      <TopBar title="Invite owner" rightLabel="Send" rightDisabled={true} />
      <ScrollArea bottomPad={32}>

        <HomeContextStrip />

        <Section overline="Contact info">
          <div>
            <FieldLabel required>Email</FieldLabel>
            <Input value="priya.shah@pantopus.app" state="valid" type="email" />
          </div>
          <div>
            <FieldLabel>Phone (optional)</FieldLabel>
            <Input value="" placeholder="(415) 555-…" leading="+1" helper="Used only for SMS verification code." />
          </div>
        </Section>

        <Section overline="Ownership share">
          <div>
            <OwnershipSummary owners={owners} available={20} conflict />
            <FieldLabel required>Share to grant</FieldLabel>
            <StatefulSlider value={30} state="error" />

            {/* Conflict block — same vocabulary as Input error but constraint-level */}
            <div style={{
              marginTop: 10, padding: '10px 12px',
              background: F.errorBg, border: `1px solid ${F.errorLight}`,
              borderRadius: 8,
            }}>
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                fontSize: 12, color: F.error, lineHeight: '17px',
              }}>
                <i data-lucide="alert-circle" style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
                <span>
                  <span style={{ fontWeight: 600 }}>Total would be 110%.</span>{' '}
                  Maria holds 50% and Marcus holds 30%. Pick 20% or less, or rebalance existing shares.
                </span>
              </div>
              <div style={{ display: 'flex', gap: 14, marginTop: 8, paddingLeft: 22 }}>
                <button style={{
                  background: 'transparent', border: 'none', padding: 0,
                  color: F.error, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  letterSpacing: -0.1,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  Snap to 20%
                  <i data-lucide="arrow-down-to-line" style={{ width: 12, height: 12 }} />
                </button>
                <button style={{
                  background: 'transparent', border: 'none', padding: 0,
                  color: F.error, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  letterSpacing: -0.1,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  Rebalance shares
                  <i data-lucide="arrow-right" style={{ width: 12, height: 12 }} />
                </button>
              </div>
            </div>
          </div>
        </Section>

        <Section overline="Role">
          <div>
            <FieldLabel>What Priya is responsible for (optional)</FieldLabel>
            <Textarea
              value=""
              placeholder="e.g. Maintenance lead, deals with the super and contractors."
              height={92}
            />
          </div>
        </Section>

      </ScrollArea>
    </Phone>
  );
}

Object.assign(window, { FrameInviteOwnerFilled, FrameInviteOwnerConflict });
