// Pantopus — Calendarly · G · Team Booking Availability — 5 frames
// Section inside the Team tab: which members are bookable + the weekly hours
// that feed round-robin. ListOfRows over businessSeats (A10.7) + A14.6 grouped
// chevron-row / gated patterns. Business violet accent.
//
// Frames: 1 default (mixed bookable) · 2 loading (shimmer) · 3 member-not-
// bookable · 4 gaps-warning (amber coverage) · 5 permission-gated (read-only).

const { E, SH } = window;
const { C, Frame, TopBar, Scroll, Overline, Card, Disc, IToggle, Chip, Note, Sk } = window;
const BIZ = C.biz, BIZ_BG = C.bizBg;

const ROSTER = [
  { name:'Marisol Vega', grad:'linear-gradient(135deg,#a78bfa,#6d28d9)', initials:'MV', hours:'Mon–Fri · 9:00–5:00', bound:true, on:true },
  { name:'Dana Reyes', grad:'linear-gradient(135deg,#38bdf8,#0369a1)', initials:'DR', hours:'Tue–Sat · 10:00–6:00', bound:true, on:true },
  { name:'Priya Nair', grad:'linear-gradient(135deg,#34d399,#047857)', initials:'PN', hours:'Business hours', bound:false, on:true },
  { name:'Sam Whitfield', grad:'linear-gradient(135deg,#fbbf24,#b45309)', initials:'SW', hours:'Mon, Wed, Fri · 12:00–4:00', bound:true, on:true },
];

function Explainer() {
  return (
    <Note tone="info" icon="info">Bookings use each member's personal availability. Edit a member's hours to change when they can be booked.</Note>
  );
}

function RosterRow({ m, last, gated, notBookable }) {
  const on = notBookable ? false : m.on;
  const dim = notBookable;
  return (
    <div role="button" aria-label={`${m.name}, ${notBookable?'not taking bookings':m.hours}, ${on?'bookable':'off'}`} style={{ display:'flex', alignItems:'center', gap:11, padding:'12px 2px', borderBottom: last?'none':`1px solid ${E.border}`, opacity:dim?0.55:1, cursor:'pointer' }}>
      <Disc grad={m.grad} initials={m.initials} size={36}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600, color:E.fg1, letterSpacing:-0.1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{m.name}</div>
        <div style={{ fontSize:11, color:E.fg3, marginTop:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{notBookable ? 'Not taking bookings' : m.hours}</div>
        <div style={{ marginTop:5 }}>
          {m.bound
            ? <Chip tone="biz" icon="user">Personal hours</Chip>
            : <Chip tone="neutral" icon="building-2">Business hours</Chip>}
        </div>
      </div>
      {!gated && <IToggle on={on} color={BIZ}/>}
      <i data-lucide="chevron-right" style={{ width:16, height:16, color:E.fg4, flexShrink:0 }}/>
    </div>
  );
}

function Coverage({ tone='neutral' }) {
  if (tone === 'warning') {
    return <Note tone="warning" icon="calendar-x">Thursdays have no coverage — add hours for at least one member.</Note>;
  }
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 13px', background:E.surface, border:`1px solid ${E.border}`, borderRadius:16, boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ width:32, height:32, borderRadius:9, background:E.sunken, color:E.fg3, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i data-lucide="calendar-x" style={{ width:16, height:16 }}/></div>
      <span style={{ fontSize:12, color:E.fg2, fontWeight:500, lineHeight:'15px' }}>No one is available Sundays.</span>
    </div>
  );
}

// ─── FRAME 1 · DEFAULT ──────────────────────────────────────────────────────

function FrameDefault() {
  return (
    <Frame label="Team availability · Default">
      <TopBar title="Booking availability"/>
      <Scroll>
        <Explainer/>
        <div>
          <Overline color={BIZ}>Team</Overline>
          <div style={{ marginTop:8 }}><Card>{ROSTER.map((m, i) => <RosterRow key={m.name} m={m} last={i===ROSTER.length-1}/>)}</Card></div>
        </div>
        <Coverage/>
      </Scroll>
    </Frame>
  );
}

// ─── FRAME 2 · LOADING ──────────────────────────────────────────────────────

function ShimRow({ last }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:11, padding:'14px 2px', borderBottom: last?'none':`1px solid ${E.border}` }}>
      <div style={{ width:36, height:36, borderRadius:'50%', ...SH }}/>
      <div style={{ flex:1 }}>
        <Sk w="46%" h={11}/>
        <Sk w="68%" h={9} mt={6}/>
        <Sk w={84} h={16} r={9999} mt={7}/>
      </div>
      <div style={{ width:46, height:28, borderRadius:9999, ...SH }}/>
    </div>
  );
}

function FrameLoading() {
  return (
    <Frame label="Team availability · Loading">
      <TopBar title="Booking availability"/>
      <Scroll>
        <Explainer/>
        <div>
          <Overline color={BIZ}>Team</Overline>
          <div style={{ marginTop:8 }}><Card>{[0,1,2,3].map(i => <ShimRow key={i} last={i===3}/>)}</Card></div>
        </div>
      </Scroll>
    </Frame>
  );
}

// ─── FRAME 3 · MEMBER NOT BOOKABLE ──────────────────────────────────────────

function FrameNotBookable() {
  return (
    <Frame label="Team availability · Not bookable">
      <TopBar title="Booking availability"/>
      <Scroll>
        <Explainer/>
        <div>
          <Overline color={BIZ}>Team</Overline>
          <div style={{ marginTop:8 }}><Card>
            <RosterRow m={ROSTER[0]}/>
            <RosterRow m={ROSTER[1]} notBookable/>
            <RosterRow m={ROSTER[2]}/>
            <RosterRow m={ROSTER[3]} last/>
          </Card></div>
        </div>
        <Coverage/>
      </Scroll>
    </Frame>
  );
}

// ─── FRAME 4 · GAPS WARNING ─────────────────────────────────────────────────

function FrameGaps() {
  return (
    <Frame label="Team availability · Gaps">
      <TopBar title="Booking availability"/>
      <Scroll>
        <Explainer/>
        <div>
          <Overline color={BIZ}>Team</Overline>
          <div style={{ marginTop:8 }}><Card>{ROSTER.map((m, i) => <RosterRow key={m.name} m={m} last={i===ROSTER.length-1}/>)}</Card></div>
        </div>
        <Coverage tone="warning"/>
      </Scroll>
    </Frame>
  );
}

// ─── FRAME 5 · PERMISSION GATED ─────────────────────────────────────────────

function FrameGated() {
  return (
    <Frame label="Team availability · Gated">
      <TopBar title="Booking availability"/>
      <Scroll>
        <Explainer/>
        <div>
          <Overline color={BIZ}>Team</Overline>
          <div style={{ marginTop:8 }}><Card>{ROSTER.map((m, i) => <RosterRow key={m.name} m={m} last={i===ROSTER.length-1} gated/>)}</Card></div>
        </div>
        <Coverage/>
        <div style={{ display:'flex', alignItems:'center', gap:7, padding:'2px 4px', color:E.fg4 }}>
          <i data-lucide="lock" style={{ width:13, height:13 }}/>
          <span style={{ fontSize:11, fontWeight:500 }}>Only admins can change booking hours (team.manage).</span>
        </div>
      </Scroll>
    </Frame>
  );
}

Object.assign(window, { TA_FrameDefault:FrameDefault, TA_FrameLoading:FrameLoading, TA_FrameNotBookable:FrameNotBookable, TA_FrameGaps:FrameGaps, TA_FrameGated:FrameGated });
