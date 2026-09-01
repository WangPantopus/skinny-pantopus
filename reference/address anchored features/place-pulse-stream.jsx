// ─────────────────────────────────────────────────────────────
// Place — C10 · Today's Pulse / full stream
// The feed sibling to the structured dashboard. The same address-
// anchored signals, flattened into one priority-ranked stream and
// expanded from the hero. A calm all-clear summary tops the list
// when nothing is urgent; alerts rise above it when something is.
// Reuses DetailHeader / Source / Chip / TextButton / Icon (window).
// ─────────────────────────────────────────────────────────────

// Tone palette for a signal card — tile + emphasis wash.
const SIGNAL_TONES = {
  home:    { tile: '#DCFCE7', tbd: '#bbf7d0', fg: '#16A34A', wash: '#F0FDF4', washBd: '#bbf7d0' },
  sky:     { tile: '#E0F2FE', tbd: '#bae6fd', fg: '#0284C7', wash: '#F0F9FF', washBd: '#bae6fd' },
  warning: { tile: '#FEF3C7', tbd: '#fde68a', fg: '#b45309', wash: '#FFFBEB', washBd: '#fde68a' },
  muted:   { tile: '#f1f3f5', tbd: '#e7eaee', fg: '#9ca3af', wash: '#fafbfc', washBd: '#e7eaee' },
};

// ── One ranked signal: icon · title · one-line detail · one action ──
function SignalCard({
  icon = 'bell',
  tone = 'home',
  title,
  detail,
  action,
  onAction,
  meta,
  chip,
  emphasis = false,
}) {
  const t = SIGNAL_TONES[tone] || SIGNAL_TONES.home;
  return (
    <div
      className="pl-signal"
      style={{
        padding: 15,
        background: emphasis ? t.wash : '#fff',
        borderColor: emphasis ? t.washBd : '#e5e7eb',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: t.tile, border: `1px solid ${t.tbd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name={icon} size={20} color={t.fg} strokeWidth={2} />
        </div>

        <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0, fontSize: 15.5, fontWeight: 600, color: INK, letterSpacing: '-0.012em', lineHeight: '20px' }}>{title}</div>
            {meta && <span style={{ fontSize: 12, color: FAINT, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>{meta}</span>}
          </div>

          <div style={{ fontSize: 13.5, color: INK2, lineHeight: '19px', marginTop: 4 }}>{detail}</div>

          {chip && (
            <div style={{ marginTop: 9 }}>
              <Chip tone={chip.tone} icon={chip.icon}>{chip.text}</Chip>
            </div>
          )}

          {action && (
            <div style={{ marginTop: 11 }}>
              <TextButton onClick={onAction}>{action}</TextButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── The calm top card: nothing urgent, here's why ──
function AllClearSummary() {
  const cleared = [
    { icon: 'wind', label: 'Air quality good' },
    { icon: 'bell-off', label: 'No active alerts' },
    { icon: 'cloud-sun', label: 'Mild, clear weather' },
  ];
  return (
    <div className="pl-card" style={{ padding: 18, marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
        <div style={{ width: 46, height: 46, borderRadius: 14, background: HOME_GREEN_BG, border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="shield-check" size={24} color={HOME_GREEN} strokeWidth={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: INK, letterSpacing: '-0.015em', lineHeight: '23px' }}>All clear today</div>
          <div style={{ fontSize: 14, color: MUTE, lineHeight: '20px', marginTop: 3 }}>Nothing needs your attention on your block right now. Here's what's worth a look when you have a minute.</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '9px 18px', marginTop: 15, paddingTop: 14, borderTop: '1px solid #f1f3f5' }}>
        {cleared.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 18, height: 18, borderRadius: '50%', background: HOME_GREEN_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="check" size={11} color={HOME_GREEN} strokeWidth={3} />
            </span>
            <span style={{ fontSize: 13, fontWeight: 500, color: INK2 }}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── A priority tier — the ranking made legible, never a fake number ──
function Tier({ label, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <GroupLabel>{label}</GroupLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>{children}</div>
    </div>
  );
}

// ── The assembled stream ──
function PulseStream({ urgent = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f6f7f9' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <DetailHeader title="Today's Pulse" address="1421 SE Oak St · Portland" onBack={() => {}} />

        <div style={{ padding: '8px 16px 40px' }}>
          {urgent ? (
            <Tier label="Needs attention">
              <SignalCard
                tone="warning" emphasis icon="wind" meta="Live"
                title="Air quality is unhealthy for sensitive groups"
                detail="AQI 112 right now. Limit time outdoors this afternoon — it should clear by evening."
                action="See air quality"
              />
              <SignalCard
                tone="warning" emphasis icon="triangle-alert" meta="NWS"
                title="Wind Advisory until 6:00 PM"
                detail="Southwest gusts up to 45 mph. Secure loose outdoor objects on your property."
                action="See alert details"
              />
            </Tier>
          ) : (
            <AllClearSummary />
          )}

          <Tier label="Worth a look">
            <SignalCard
              tone="sky" icon="badge-percent" meta="New"
              title="A heat-pump rebate may apply to your home"
              detail="You could be eligible for up to $1,600 back. Verify a few details to confirm."
              action="Check your eligibility"
            />
            <SignalCard
              tone="warning" icon="zap"
              title="Your electric bill runs high"
              detail="About 12% above similar verified homes near you this season."
              chip={{ tone: 'warning', text: '12% above', icon: 'trending-up' }}
              action="See where it's going"
            />
          </Tier>

          <Tier label="Around you">
            <SignalCard
              tone="home" icon="house" meta="2d ago"
              title="A new home verified on your block"
              detail="Two doors down on SE Oak St. Your block is starting to form — 3 verified homes now."
              action="See your block"
            />
            <SignalCard
              tone="sky" icon="vote" meta="In 34 days"
              title="Your next election is in 34 days"
              detail="Ballots mail out May 2. Your polling place and districts are confirmed."
              action="Preview your sample ballot"
            />
          </Tier>

          <Tier label="When you have a minute">
            <SignalCard
              tone="muted" icon="life-buoy"
              title="You haven't set up an emergency plan"
              detail="Three quick steps to a household plan — meeting spot, contacts, and where the shutoffs are."
              action="Build your plan"
            />
            <SignalCard
              tone="muted" icon="file-text"
              title="Generate a residency letter"
              detail="Verified proof of address, ready whenever a landlord, school, or office needs it."
              action="Generate a letter"
            />
          </Tier>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PulseStream, SignalCard, AllClearSummary, Tier, SIGNAL_TONES });
