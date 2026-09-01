// A14.7 — Privacy (src/app/settings/privacy.tsx)
// Mixed-control variant: this is the screen that exercises the full
// vocabulary. Radios for visibility & address granularity, a stepped
// SLIDER for map location fuzz (the unique control in this archetype),
// toggles for activity visibility, chevrons for data export.
//
// Two frames:
//   1) Populated — the everyday default: verified-only profile, street
//      shown on profile, "Block" location fuzz, balanced activity.
//   2) Secondary — Stealth: every control at its most private. A small
//      stealth banner up top notes that strict mode is active; nothing
//      is locked but the helpers reflect the trade-offs.

// ─── Stepped slider ──────────────────────────────────────────────────────
// Used for "Map location fuzz". Four labeled stops along a track. Fill
// from start to thumb in primary, unfilled portion in border-subtle.
// Each stop is a tiny dot on the track + a label below.
function StepSlider({ value, stops }) {
  const last = stops.length - 1;
  const pct = (value / last) * 100;
  return (
    <div style={{ padding: '14px 22px 18px' }}>
      <div style={{ position: 'relative', height: 28 }}>
        {/* track */}
        <div style={{
          position: 'absolute', top: 12, left: 0, right: 0, height: 4,
          borderRadius: 9999, background: S.border,
        }}/>
        {/* fill */}
        <div style={{
          position: 'absolute', top: 12, left: 0, width: `${pct}%`,
          height: 4, borderRadius: 9999, background: S.primary600,
        }}/>
        {/* stop ticks */}
        {stops.map((_, i) => {
          const stopPct = (i / last) * 100;
          const filled = i <= value;
          return (
            <div key={i} style={{
              position: 'absolute', top: 11, left: `${stopPct}%`,
              width: 6, height: 6, borderRadius: '50%',
              transform: 'translateX(-3px)',
              background: filled ? '#fff' : S.borderStrong,
              boxShadow: filled ? `0 0 0 1.5px ${S.primary600}` : 'none',
            }}/>
          );
        })}
        {/* thumb */}
        <div style={{
          position: 'absolute', top: 2, left: `${pct}%`,
          width: 24, height: 24, borderRadius: '50%',
          transform: 'translateX(-12px)',
          background: '#fff', border: `2px solid ${S.primary600}`,
          boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
        }}/>
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        marginTop: 10, padding: '0 2px',
      }}>
        {stops.map((s, i) => (
          <div key={i} style={{
            fontSize: 10.5,
            color: i === value ? S.fg1 : S.fg4,
            fontWeight: i === value ? 700 : 500,
            letterSpacing: 0.04, textAlign: 'center',
            transform: i === 0 ? 'translateX(-2px)' : i === last ? 'translateX(2px)' : 'none',
          }}>{s}</div>
        ))}
      </div>
    </div>
  );
}

// ─── Map fuzz preview ────────────────────────────────────────────────────
// Tiny inline map strip — gray ground + a primary fuzz circle that grows
// with the slider. Sits between the slider and the helper inside the card.
function FuzzMap({ value, stops }) {
  const radii = [4, 18, 36, 60, 88]; // grows roughly with stop
  const r = radii[Math.min(value, radii.length - 1)];
  return (
    <div style={{
      margin: '0 16px 14px', height: 92, borderRadius: 10,
      background: '#eef2f7',
      border: `1px solid ${S.border}`,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* faint street grid */}
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        <g stroke="#dbe1ea" strokeWidth="1" fill="none">
          <line x1="0" y1="22" x2="320" y2="22"/>
          <line x1="0" y1="50" x2="320" y2="50"/>
          <line x1="0" y1="78" x2="320" y2="78"/>
          <line x1="60" y1="0" x2="60" y2="92"/>
          <line x1="140" y1="0" x2="140" y2="92"/>
          <line x1="220" y1="0" x2="220" y2="92"/>
          <line x1="280" y1="0" x2="280" y2="92"/>
        </g>
      </svg>
      {/* fuzz circle */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: r * 2, height: r * 2, borderRadius: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'rgba(2,132,199,0.18)',
        border: '1.5px solid rgba(2,132,199,0.55)',
        transition: 'all 200ms ease-out',
      }}/>
      {/* center pin */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: 10, height: 10, borderRadius: '50%',
        transform: 'translate(-50%, -50%)',
        background: S.primary600,
        boxShadow: '0 0 0 2px #fff',
      }}/>
      {/* corner tag */}
      <div style={{
        position: 'absolute', top: 8, left: 10,
        fontSize: 9.5, fontWeight: 700, color: S.fg3,
        letterSpacing: 0.06, textTransform: 'uppercase',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        background: 'rgba(255,255,255,0.85)', padding: '2px 6px',
        borderRadius: 4,
      }}>{stops[value]}</div>
    </div>
  );
}

// ─── Stealth banner (secondary frame only) ───────────────────────────────
function StealthBanner() {
  return (
    <div style={{ padding: '14px 12px 0' }}>
      <div style={{
        background: '#0b1220', color: '#fff',
        borderRadius: 14, padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, color: '#7dd3fc',
        }}>
          <i data-lucide="eye-off" style={{ width: 16, height: 16, strokeWidth: 2 }}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: '18px' }}>
            Stealth mode is on
          </div>
          <div style={{
            fontSize: 11.5, color: 'rgba(255,255,255,0.65)',
            marginTop: 1, lineHeight: '15px',
          }}>
            Your profile is hidden from search. Existing connections still see you.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Reusable Radio card ─────────────────────────────────────────────────
function RadioCard({ options, value, helper }) {
  return (
    <Card helper={helper}>
      {options.map((o, i) => (
        <Row
          key={i}
          label={o.label}
          sub={o.sub}
          right={<Radio selected={value === o.key}/>}
        />
      ))}
    </Card>
  );
}

// ─── Frame body ──────────────────────────────────────────────────────────
function PrivacyFrame({ stealth, values }) {
  const visibilityOpts = [
    { key: 'public',   label: 'Public',
      sub: 'Anyone with the link can see your profile' },
    { key: 'verified', label: 'Verified neighbors only',
      sub: 'People with a verified address can see you' },
    { key: 'connections', label: 'Connections only',
      sub: 'Only people you\'ve interacted with' },
    { key: 'hidden',   label: 'Hidden',
      sub: 'Profile not browsable. Existing chats still work' },
  ];
  const addressOpts = [
    { key: 'full',         label: 'Full address',
      sub: '14 Elm Park Lane, Brooklyn NY' },
    { key: 'street',       label: 'Street only',
      sub: 'Elm Park Lane, Brooklyn' },
    { key: 'neighborhood', label: 'Neighborhood',
      sub: 'Park Slope, Brooklyn' },
    { key: 'hidden',       label: 'Hidden',
      sub: 'Verified badge shown, address not' },
  ];
  const fuzzStops = ['Exact', 'Block', 'Quarter mile', 'Half mile', 'Neighborhood'];
  const activity = [
    { l: 'Show online status',     sub: 'Green dot when you\'re active', k: 'online' },
    { l: 'Show recent activity',   sub: '"Posted a task 2h ago" on profile', k: 'recent' },
    { l: 'Appear in nearby search',sub: 'Neighbors can find you by proximity', k: 'nearby' },
    { l: 'Show ratings publicly',                                              k: 'ratings' },
  ];

  return (
    <Phone>
      <TopBar title="Privacy"/>
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 24 }}>

        {stealth && <StealthBanner/>}

        <Overline>Profile visibility</Overline>
        <RadioCard
          options={visibilityOpts}
          value={values.visibility}
          helper={stealth
            ? 'Hidden — your profile won\'t show in search or recommendations.'
            : 'Verified neighbors can find you and start a conversation.'}
        />

        <Overline>Address on profile</Overline>
        <RadioCard
          options={addressOpts}
          value={values.address}
          helper={stealth
            ? 'Address hidden everywhere. Deliveries still route correctly.'
            : 'Street name shows on your profile; full address only to people you hire or sell to.'}
        />

        <Overline>Map location fuzz</Overline>
        <div style={{ padding: '0 12px' }}>
          <div style={{
            background: S.surface, border: `1px solid ${S.border}`,
            borderRadius: 12, overflow: 'hidden',
          }}>
            <div style={{
              padding: '14px 16px 4px',
              fontSize: 13.5, fontWeight: 500, color: S.fg2, lineHeight: '18px',
            }}>
              How exact your task and listing pins appear on the map.
            </div>
            <StepSlider value={values.fuzz} stops={fuzzStops}/>
            <div style={{ height: 1, background: S.borderSub, marginLeft: 16 }}/>
            <FuzzMap value={values.fuzz} stops={fuzzStops}/>
          </div>
          <div style={{ padding: '8px 4px 0', fontSize: 11.5, color: S.fg3, lineHeight: '16px' }}>
            {stealth
              ? 'Pins fuzz to your neighborhood — buyers see only "Park Slope", never your block.'
              : 'Pins drop within a block of you. Exact address only shared after a task is accepted.'}
          </div>
        </div>

        <Overline>Activity</Overline>
        <Card>
          {activity.map((r, i) => (
            <Row key={i} label={r.l} sub={r.sub} right={<Toggle on={values[r.k]}/>}/>
          ))}
        </Card>

        <Overline>Your data</Overline>
        <Card>
          <Row
            leading={
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: S.primary50, color: S.primary600,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i data-lucide="download" style={{ width: 16, height: 16, strokeWidth: 2 }}/>
              </div>
            }
            label="Download your data"
            sub="ZIP of profile, tasks, messages — emailed to you"
            right={<Chevron/>}
          />
          <Row
            leading={
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: S.primary50, color: S.primary600,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i data-lucide="file-text" style={{ width: 16, height: 16, strokeWidth: 2 }}/>
              </div>
            }
            label="What we collect"
            sub="Full data policy & current categories"
            right={<Chevron/>}
          />
        </Card>

        <div style={{ height: 18 }}/>
        <Card>
          <Row label="Delete account" sub="Permanent. 30-day grace period." destructive/>
        </Card>

        <MonoFooter>
          {stealth ? 'Stealth · auto-applied May 26, 2026' : 'Last updated · Mar 12, 2024'}
        </MonoFooter>
      </div>
    </Phone>
  );
}

// ─── Frame 1 — Default privacy ───────────────────────────────────────────
function FramePrivacyPopulated() {
  return (
    <PrivacyFrame
      stealth={false}
      values={{
        visibility: 'verified',
        address: 'street',
        fuzz: 1, // Block
        online: true,
        recent: true,
        nearby: true,
        ratings: true,
      }}
    />
  );
}

// ─── Frame 2 — Stealth (secondary state) ─────────────────────────────────
function FramePrivacyStealth() {
  return (
    <PrivacyFrame
      stealth={true}
      values={{
        visibility: 'hidden',
        address: 'hidden',
        fuzz: 4, // Neighborhood — max
        online: false,
        recent: false,
        nearby: false,
        ratings: false,
      }}
    />
  );
}

Object.assign(window, { FramePrivacyPopulated, FramePrivacyStealth });
