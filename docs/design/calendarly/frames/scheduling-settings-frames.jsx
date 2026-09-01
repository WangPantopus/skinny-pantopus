// Pantopus — Calendarly · Scheduling Settings Root ("Booking settings")
// GroupedList settings index built on the A14 settings-archetype primitives
// (TopBar, Overline, Card, Row, Chip, ChipChevron, Chevron, MonoFooter,
// loaded from settings-archetype.jsx via window globals). Context-aware:
// overline labels + accent key off the active pillar.
//
// 5 frames: loaded (Personal) · fresh (all defaults) · saving · saved ·
//           Business variant (adds TEAM group + auto-confirm segmented).

const PILLAR = {
  personal: { accent:'#0284c7', accentBg:'#f0f9ff', tone:'personal', label:'Personal' },
  home:     { accent:'#15803d', accentBg:'#f0fdf4', tone:'home',     label:'Home' },
  business: { accent:'#6d28d9', accentBg:'#f5f3ff', tone:'business', label:'Business' },
};

// Accent-tinted overline (A14 Overline, recolored per pillar).
function AccentOverline({ accent, children }) {
  return (
    <div style={{
      padding:'18px 16px 8px', fontSize:11, fontWeight:700, color:accent,
      letterSpacing:'0.08em', textTransform:'uppercase',
    }}>{children}</div>
  );
}

function Shimmer({ w='100%', h=12, r=6, style={} }) {
  return (
    <div style={{
      width:w, height:h, borderRadius:r,
      background:'linear-gradient(90deg, #eef0f3 0%, #f6f7f9 50%, #eef0f3 100%)',
      backgroundSize:'200% 100%', animation:'sh-shimmer 1.4s ease-in-out infinite',
      display:'inline-block', ...style,
    }}/>
  );
}

// Right cluster: timezone-lock affordance + chevron.
function TzRight({ accent, locked }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <span style={{
        width:30, height:30, borderRadius:8, flexShrink:0,
        display:'inline-flex', alignItems:'center', justifyContent:'center',
        background: locked ? PILLAR.personal.accentBg : '#f3f4f6',
        color: locked ? accent : '#9ca3af',
        border: locked ? `1px solid ${accent}33` : '1px solid #e5e7eb',
      }}>
        <i data-lucide={locked ? 'lock' : 'lock-open'} style={{ width:14, height:14, strokeWidth:2.2 }}/>
      </span>
      <Chevron/>
    </div>
  );
}

// Inline Connect CTA pill (fresh payments row).
function ConnectPill({ accent }) {
  return (
    <button style={{
      padding:'7px 14px', borderRadius:9999, border:'none', background:accent, color:'#fff',
      fontSize:12.5, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
      boxShadow:`0 2px 6px ${accent}44`,
    }}>Connect</button>
  );
}

// "Saved" success chip (right of the written row).
function SavedChip() {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4, padding:'4px 9px', borderRadius:9999,
      background:'#d1fae5', color:'#047857', fontSize:11, fontWeight:700,
    }}>
      <i data-lucide="check" style={{ width:12, height:12, strokeWidth:3 }}/> Saved
    </span>
  );
}

// Segmented control (Business · auto-confirm vs approve).
function Segmented({ accent, options, active }) {
  return (
    <div style={{
      display:'flex', gap:4, padding:3, background:'#f3f4f6', borderRadius:10, marginTop:10,
    }}>
      {options.map((o) => {
        const on = o === active;
        return (
          <button key={o} style={{
            flex:1, height:32, borderRadius:8, border:'none', cursor:'pointer',
            background:on?'#fff':'transparent', color:on?accent:'#6b7280',
            fontSize:12.5, fontWeight:on?700:600, letterSpacing:-0.05,
            boxShadow:on?'0 1px 2px rgba(0,0,0,0.08)':'none',
          }}>{o}</button>
        );
      })}
    </div>
  );
}

// Danger-zone card (red-tinted, pinned last) + mono footer.
function DangerZone({ accent }) {
  const rows = [
    { icon:'rotate-ccw', label:'Reset booking link' },
    { icon:'calendar-x', label:'Disable scheduling' },
  ];
  return (
    <>
      <AccentOverline accent="#b91c1c">Danger zone</AccentOverline>
      <div style={{ padding:'0 12px' }}>
        <div style={{
          background:'#fef2f2', border:'1px solid #fecaca', borderRadius:12, overflow:'hidden',
        }}>
          {rows.map((r, i) => (
            <div key={r.label} style={{
              minHeight:48, padding:'14px 16px', display:'flex', alignItems:'center', gap:12,
              cursor:'pointer', boxSizing:'border-box',
              borderBottom: i < rows.length-1 ? '1px solid #fecaca' : 'none',
            }}>
              <i data-lucide={r.icon} style={{ width:17, height:17, color:'#dc2626', strokeWidth:2 }}/>
              <span style={{ flex:1, fontSize:15, fontWeight:600, color:'#dc2626', letterSpacing:-0.1 }}>{r.label}</span>
            </div>
          ))}
        </div>
      </div>
      <MonoFooter>pantopus.com/book/maria-k · owner #PT-4821</MonoFooter>
    </>
  );
}

// ─── Group renderers ──────────────────────────────────────────

function AutomationGroup({ p, mode }) {
  const fresh = mode === 'fresh';
  return (
    <>
      <AccentOverline accent={p.accent}>Automation</AccentOverline>
      <Card helper="Reminders go out automatically before each booking.">
        <Row
          label="Default reminders"
          sub={fresh ? null : '1 day · 1 hr'}
          right={fresh
            ? <ChipChevron><Chip tone="warning">Off</Chip></ChipChevron>
            : <Chevron/>}
        />
        <Row
          label="Workflows & follow-ups"
          sub={fresh ? 'No workflows yet' : null}
          right={fresh
            ? <ChipChevron><Chip tone="warning" icon="plus">Set up</Chip></ChipChevron>
            : <ChipChevron><Chip tone="success">3 active</Chip></ChipChevron>}
        />
        <Row
          label="Message templates"
          sub={fresh ? 'No templates yet' : '5 templates'}
          right={fresh
            ? <ChipChevron><Chip tone="warning" icon="plus">Set up</Chip></ChipChevron>
            : <Chevron/>}
        />
        <Row
          label="Booking notifications"
          sub={fresh ? 'Using defaults' : 'Push · Email'}
          right={<Chevron/>}
        />
      </Card>
    </>
  );
}

function DefaultsGroup({ p, mode }) {
  const fresh = mode === 'fresh';
  // Cancellation policy is the row being written in saving/saved.
  let cancelSub = '24-hour notice';
  let cancelRight = <Chevron/>;
  if (fresh) { cancelSub = null; cancelRight = <ChipChevron><Chip tone="warning" icon="plus">Set up</Chip></ChipChevron>; }
  if (mode === 'saving') { cancelSub = null; cancelRight = <Shimmer w={84} h={14} r={7}/>; }
  if (mode === 'saved')  { cancelSub = '48-hour notice'; cancelRight = <div style={{display:'flex',alignItems:'center',gap:8}}><SavedChip/><Chevron/></div>; }
  return (
    <>
      <AccentOverline accent={p.accent}>Scheduling defaults</AccentOverline>
      <Card>
        <Row
          label="Default timezone"
          sub={mode === 'saving' ? null : 'America/New_York · auto'}
          right={mode === 'saving'
            ? <Shimmer w={70} h={14} r={7}/>
            : <TzRight accent={p.accent} locked={!fresh}/>}
        />
        <Row label="Default availability" sub="Mon–Fri, 9–5" right={<Chevron/>}/>
        <Row label="Cancellation policy" sub={cancelSub} right={cancelRight}/>
      </Card>
    </>
  );
}

function PaymentsGroup({ p, mode }) {
  const fresh = mode === 'fresh';
  return (
    <>
      <AccentOverline accent={p.accent}>Payments</AccentOverline>
      <Card helper="Required only for paid event types.">
        <Row
          label="Payments & payouts"
          sub={fresh ? 'Take payment at booking' : 'Stripe · ••4821'}
          right={fresh
            ? <ConnectPill accent={p.accent}/>
            : <ChipChevron><Chip tone="success" icon="check">Connected</Chip></ChipChevron>}
        />
      </Card>
    </>
  );
}

function TeamGroup({ p }) {
  return (
    <>
      <AccentOverline accent={p.accent}>Team</AccentOverline>
      <Card>
        <Row label="Team & seats" sub="4 members · 2 booking seats" right={<Chevron/>}/>
        <div style={{ padding:'14px 16px' }}>
          <div style={{ fontSize:15, fontWeight:500, color:'#111827', letterSpacing:-0.1 }}>New bookings</div>
          <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>Choose how incoming bookings are handled.</div>
          <Segmented accent={p.accent} options={['Auto-confirm','Approve first']} active="Approve first"/>
        </div>
      </Card>
    </>
  );
}

// "Saved" toast pinned to top of the scroll area.
function SavedToast() {
  return (
    <div style={{
      position:'absolute', top:104, left:'50%', transform:'translateX(-50%)', zIndex:30,
      display:'inline-flex', alignItems:'center', gap:8, padding:'10px 16px', borderRadius:9999,
      background:'#111827', color:'#fff', fontSize:13, fontWeight:600,
      boxShadow:'0 10px 24px rgba(17,24,39,0.28)', whiteSpace:'nowrap',
    }}>
      <i data-lucide="check" style={{ width:15, height:15, strokeWidth:3, color:'#34d399' }}/>
      Changes saved
    </div>
  );
}

// ─── Frame composer ───────────────────────────────────────────

function SettingsScreen({ pillarKey, mode }) {
  const p = PILLAR[pillarKey];
  const labelMap = {
    loaded:'A3 Booking settings — Loaded (Personal)',
    fresh:'A3 Booking settings — Fresh (defaults)',
    saving:'A3 Booking settings — Saving',
    saved:'A3 Booking settings — Saved',
    business:'A3 Booking settings — Business (team)',
  };
  return (
    <Phone>
      <div data-screen-label={labelMap[mode]} style={{ display:'contents' }}/>
      <TopBar title="Booking settings"/>
      {mode === 'saved' && <SavedToast/>}
      <div style={{ flex:1, overflow:'auto', paddingBottom:32 }}>
        {pillarKey === 'business' && <TeamGroup p={p}/>}
        <AutomationGroup p={p} mode={mode}/>
        <DefaultsGroup p={p} mode={mode}/>
        <PaymentsGroup p={p} mode={mode}/>
        <DangerZone accent={p.accent}/>
      </div>
    </Phone>
  );
}

function FrameLoaded()   { return <SettingsScreen pillarKey="personal" mode="loaded"/>; }
function FrameFresh()    { return <SettingsScreen pillarKey="personal" mode="fresh"/>; }
function FrameSaving()   { return <SettingsScreen pillarKey="personal" mode="saving"/>; }
function FrameSaved()    { return <SettingsScreen pillarKey="personal" mode="saved"/>; }
function FrameBusiness() { return <SettingsScreen pillarKey="business" mode="loaded"/>; }

Object.assign(window, { FrameLoaded, FrameFresh, FrameSaving, FrameSaved, FrameBusiness });
