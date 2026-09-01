// F7 — Who's Free · Household Availability heat grid (v2) · 300×620 · Home green
// A bespoke glanceable heat grid composed from members' personal availability.
// Frames: composing · loaded (Day, popover) · empty · member-opted-out · offline-cached

const { N, H, M } = window;
const { Phone, TopBar, Card, Avatar, Segmented, Shimmer, Banner } = window;

const COLS = ['8a', '10a', '12p', '2p', '4p', '6p'];

function Cell({ state, q }) {
  let style = { height:26, borderRadius:6, position:'relative' };
  if (state === 'free') style.background = '#dcfce7';
  else if (state === 'busy') style.background = '#f3f4f6';
  else if (state === 'tent') style.background = '#fef3c7';
  else if (state === 'off') { style.background = '#f9fafb'; style.backgroundImage = 'repeating-linear-gradient(45deg, transparent, transparent 3px, #e8eaed 3px, #e8eaed 4px)'; }
  else if (state === 'unknown') { style.background = '#f1f3f5'; style.backgroundImage = 'repeating-linear-gradient(45deg, #e2e5e9, #e2e5e9 3px, #f1f3f5 3px, #f1f3f5 6px)'; }
  return (
    <div style={style}>
      {state === 'free' && <span style={{ position:'absolute', top:3, left:4, width:5, height:5, borderRadius:'50%', background:H.accent }}/>}
      {q && <span style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:N.fg4 }}>?</span>}
    </div>
  );
}

function HeatGrid({ rows, popover }) {
  return (
    <div style={{ position:'relative' }}>
      <div style={{ display:'grid', gridTemplateColumns:'58px repeat(6, 1fr)', gap:3, alignItems:'center' }}>
        <div/>
        {COLS.map(c => <div key={c} style={{ fontSize:9, fontWeight:700, color:N.fg4, textAlign:'center' }}>{c}</div>)}
        {rows.map((r, ri) => (
          <React.Fragment key={ri}>
            <div style={{ display:'flex', alignItems:'center', gap:5, minWidth:0 }}>
              <Avatar m={r.m} size={18}/>
              <span style={{ fontSize:10.5, fontWeight:600, color:N.fg1, whiteSpace:'nowrap', overflow:'hidden' }}>{r.m.name}</span>
            </div>
            {r.cells.map((s, ci) => <Cell key={ci} state={s} q={s==='unknown'}/>)}
          </React.Fragment>
        ))}
      </div>
      {popover && (
        <div style={{ position:'absolute', top:popover.top, left:popover.left, zIndex:5, background:N.surface, borderRadius:12, boxShadow:'0 8px 24px rgba(0,0,0,0.18)', border:`1px solid ${N.border}`, padding:'8px', width:134 }}>
          <div style={{ fontSize:10.5, fontWeight:700, color:N.fg1, padding:'2px 4px 7px' }}>{popover.label}</div>
          <button style={{ display:'flex', alignItems:'center', gap:7, width:'100%', padding:'7px 8px', borderRadius:8, border:'none', background:H.bg50, color:H.accent700, fontSize:11, fontWeight:700, cursor:'pointer', marginBottom:5 }}><i data-lucide="users" style={{ width:13, height:13 }}/>Find a time here</button>
          <button style={{ display:'flex', alignItems:'center', gap:7, width:'100%', padding:'7px 8px', borderRadius:8, border:`1px solid ${N.border}`, background:N.surface, color:N.fg2, fontSize:11, fontWeight:700, cursor:'pointer' }}><i data-lucide="calendar-plus" style={{ width:13, height:13 }}/>Add event</button>
        </div>
      )}
    </div>
  );
}

function Legend() {
  const items = [
    { state:'free', label:'Free' },
    { state:'busy', label:'Busy' },
    { state:'tent', label:'Tentative' },
    { state:'off', label:'Off-hours' },
  ];
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:'7px 12px', paddingTop:11, marginTop:11, borderTop:`1px solid ${N.border}` }}>
      {items.map(it => (
        <div key={it.state} style={{ display:'flex', alignItems:'center', gap:5 }}>
          <div style={{ width:13, height:13, borderRadius:4 }}><Cell state={it.state}/></div>
          <span style={{ fontSize:10, color:N.fg3, fontWeight:600 }}>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

function FilterChips({ active='All', extra }) {
  const chips = ['All', 'Mom', 'Dad', 'Ava', 'Tomek'];
  return (
    <div style={{ display:'flex', gap:6, overflowX:'auto', padding:'2px 0 2px' }}>
      {chips.map(c => {
        const on = c === active;
        return <button key={c} style={{ flexShrink:0, padding:'5px 11px', borderRadius:9999, border:`1px solid ${on?'transparent':N.border}`, background:on?H.bg100:N.surface, color:on?H.accent700:N.fg2, fontSize:11, fontWeight:on?700:600, cursor:'pointer' }}>{c}</button>;
      })}
    </div>
  );
}

function ExplainerLine() {
  return <div style={{ fontSize:10.5, color:N.fg3, display:'flex', alignItems:'center', gap:5, padding:'0 2px' }}><i data-lucide="layers" style={{ width:11, height:11, color:H.accent }}/>Composed from each member's personal availability.</div>;
}

const ROWS = [
  { m:M.mom, cells:['free','free','busy','free','free','busy'] },
  { m:M.dad, cells:['busy','free','free','busy','free','free'] },
  { m:M.ava, cells:['off','off','free','free','tent','free'] },
  { m:M.tom, cells:['off','off','busy','free','free','free'] },
];

function Head({ view='Day' }) {
  return (
    <div style={{ padding:'10px 12px 9px', background:N.surface, borderBottom:`1px solid ${N.border}`, flexShrink:0, display:'flex', flexDirection:'column', gap:9 }}>
      <Segmented options={['Day', 'Week']} value={view} small full/>
      <ExplainerLine/>
    </div>
  );
}

function Body({ children }) {
  return <div style={{ flex:1, overflow:'auto', padding:'10px 12px 16px', display:'flex', flexDirection:'column', gap:11 }}>{children}</div>;
}

// ─── FRAME 1 · COMPOSING ───────────────────────────────────────
function FrameComposing() {
  return (
    <Phone label="Who's free · Composing">
      <TopBar title="Who's free" right={{ text:'Add', muted:true }}/>
      <Head/>
      <Body>
        <div style={{ textAlign:'center', padding:'10px 0 2px' }}><div style={{ fontSize:12.5, fontWeight:700, color:N.fg1 }}>Building this week's availability</div></div>
        <Card>
          <div style={{ display:'grid', gridTemplateColumns:'58px repeat(6, 1fr)', gap:3, alignItems:'center' }}>
            <div/>{COLS.map(c => <div key={c} style={{ fontSize:9, fontWeight:700, color:N.fg4, textAlign:'center' }}>{c}</div>)}
            {[0,1,2,3].map(ri => <React.Fragment key={ri}><div style={{ display:'flex', alignItems:'center', gap:5 }}><Shimmer w={18} h={18} r={9}/><Shimmer w={28} h={9}/></div>{[0,1,2,3,4,5].map(ci => <Shimmer key={ci} h={26} r={6}/>)}</React.Fragment>)}
          </div>
        </Card>
      </Body>
    </Phone>
  );
}

// ─── FRAME 2 · LOADED (Day, popover) ───────────────────────────
function FrameLoaded() {
  return (
    <Phone label="Who's free · Loaded">
      <TopBar title="Who's free" right={{ text:'Add' }}/>
      <Head/>
      <Body>
        <FilterChips active="All"/>
        <Card>
          <HeatGrid rows={ROWS} popover={{ top:62, left:150, label:'Dad · 4–6 PM · free' }}/>
          <Legend/>
        </Card>
        <div style={{ fontSize:10.5, color:N.fg3, textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}><i data-lucide="hand-pointer" style={{ width:12, height:12 }}/>Tap a free block to plan something</div>
      </Body>
    </Phone>
  );
}

// ─── FRAME 3 · EMPTY ───────────────────────────────────────────
function FrameEmpty() {
  const busyRows = ROWS.map(r => ({ m:r.m, cells:r.cells.map(c => c==='free'?'busy':c==='tent'?'busy':c) }));
  return (
    <Phone label="Who's free · Empty">
      <TopBar title="Who's free" right={{ text:'Add' }}/>
      <Head/>
      <Body>
        <FilterChips active="All"/>
        <Banner tone="info" icon="calendar-x" title="No overlapping free time this week">Everyone's booked up. Try next week to find a shared opening.</Banner>
        <Card>
          <HeatGrid rows={busyRows}/>
          <Legend/>
        </Card>
        <button style={{ width:'100%', height:42, borderRadius:11, border:`1px solid ${H.bg200}`, background:H.bg50, color:H.accent700, fontSize:12.5, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6 }}><i data-lucide="chevron-right" style={{ width:14, height:14 }}/>Try next week</button>
      </Body>
    </Phone>
  );
}

// ─── FRAME 4 · MEMBER OPTED-OUT ────────────────────────────────
function FrameOptedOut() {
  const rows = [ROWS[0], ROWS[1], { m:M.ava, cells:['unknown','unknown','unknown','unknown','unknown','unknown'] }, ROWS[3]];
  return (
    <Phone label="Who's free · Opted-out">
      <TopBar title="Who's free" right={{ text:'Add' }}/>
      <Head/>
      <Body>
        <FilterChips active="All"/>
        <Card>
          <HeatGrid rows={rows}/>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'7px 12px', paddingTop:11, marginTop:11, borderTop:`1px solid ${N.border}` }}>
            {[['free','Free'],['busy','Busy'],['tent','Tentative'],['unknown','Unknown']].map(([s,l]) => <div key={s} style={{ display:'flex', alignItems:'center', gap:5 }}><div style={{ width:13, height:13, borderRadius:4 }}><Cell state={s} q={s==='unknown'}/></div><span style={{ fontSize:10, color:N.fg3, fontWeight:600 }}>{l}</span></div>)}
          </div>
        </Card>
        <Banner tone="amber" icon="eye-off" title="Ava hasn't shared free/busy">You can't see Ava's availability or include her in Find a time until she shares it.</Banner>
      </Body>
    </Phone>
  );
}

// ─── FRAME 5 · OFFLINE-CACHED ──────────────────────────────────
function FrameOffline() {
  return (
    <Phone label="Who's free · Offline-cached">
      <TopBar title="Who's free" right={{ text:'Add', muted:true }}/>
      <Head/>
      <Body>
        <Banner tone="amber" icon="wifi-off" title="Showing last synced">Last updated 2h ago. Reconnect to refresh availability.</Banner>
        <FilterChips active="All"/>
        <Card>
          <div style={{ opacity:0.6 }}><HeatGrid rows={ROWS}/><Legend/></div>
        </Card>
      </Body>
    </Phone>
  );
}

Object.assign(window, { FrameComposing, FrameLoaded, FrameEmpty, FrameOptedOut, FrameOffline });
