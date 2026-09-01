// Pantopus — Calendarly · G · Round-Robin Assignment Sheet — 4 frames
// Archetype: Bottom sheet reusing businessSeats roster rows (A10.7) + the
// selectable-tile rule picker (A12.11). Lives in Service Editor → assignment
// mode "Anyone"/"Specific members". Business violet accent on active states;
// CTA stays product sky (functional chrome). No emoji; lucide stroke 2.
//
// Frames: 1 default (4 seats, weights) · 2 loading (shimmer rows) ·
// 3 none-selected (amber warning + disabled Done) · 4 single-member (info).

const { E, SH } = window;
const BIZ = E.business, BIZ_BG = E.businessBg;
const WARN = '#B45309', WARN_BG = '#FFFBEB', WARN_BORDER = '#FDE68A';

const SEATS = [
  { name:'Dana Reyes',   role:'Senior stylist',   grad:'linear-gradient(135deg,#a78bfa,#6d28d9)', initials:'DR', weight:2 },
  { name:'Marcus Lee',   role:'Stylist',          grad:'linear-gradient(135deg,#38bdf8,#0369a1)', initials:'ML', weight:1 },
  { name:'Priya Nair',   role:'Color specialist', grad:'linear-gradient(135deg,#34d399,#047857)', initials:'PN', weight:1 },
  { name:'Sam Whitfield',role:'Junior stylist',   grad:'linear-gradient(135deg,#fbbf24,#b45309)', initials:'SW', weight:1 },
];

function DarkStatusBar() {
  const c = E.fg1;
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 22px 0', height:34, boxSizing:'border-box', flexShrink:0, fontFamily:'-apple-system, system-ui', fontWeight:600, fontSize:12.5, color:c }}>
      <span>9:41</span>
      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
        <svg width="15" height="10" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={c}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={c}/><rect x="9" y="2" width="3" height="9" rx="0.6" fill={c}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={c}/></svg>
        <svg width="13" height="10" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={c}/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={c}/><circle cx="7.5" cy="9" r="1.3" fill={c}/></svg>
        <svg width="21" height="10" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={c} strokeOpacity="0.35" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill={c}/><path d="M22.5 3.8v3.4c.6-.2 1-.8 1-1.7s-.4-1.5-1-1.7z" fill={c} fillOpacity="0.4"/></svg>
      </div>
    </div>
  );
}

function Sheet({ label, children, doneLabel='Done', doneDisabled }) {
  return (
    <div style={{ width:300, height:620, borderRadius:40, padding:8, background:'#0b0f17', boxShadow:'0 24px 50px rgba(17,24,39,0.20), 0 0 0 1px rgba(0,0,0,0.12)', flexShrink:0 }} data-screen-label={label}>
      <div style={{ width:'100%', height:'100%', background:E.bg, borderRadius:32, overflow:'hidden', position:'relative', display:'flex', flexDirection:'column', fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div style={{ position:'absolute', top:7, left:'50%', transform:'translateX(-50%)', width:88, height:24, borderRadius:16, background:'#000', zIndex:50 }}/>
        <DarkStatusBar/>
        {/* Dimmed Service Editor behind */}
        <div style={{ flex:1, padding:'14px 16px', opacity:0.4 }}>
          <div style={{ height:22 }}><i data-lucide="chevron-left" style={{ width:20, height:20, color:E.fg2 }}/></div>
          <div style={{ fontSize:19, fontWeight:700, color:E.fg1, marginTop:10 }}>Haircut · 45 min</div>
          <div style={{ fontSize:12, color:E.fg2, marginTop:6 }}>Assignment · Specific members</div>
        </div>
        <div style={{ position:'absolute', inset:0, background:'rgba(17,24,39,0.42)', zIndex:18 }}/>
        <div style={{ position:'absolute', left:0, right:0, bottom:0, zIndex:20, background:E.surface, borderTopLeftRadius:24, borderTopRightRadius:24, boxShadow:'0 -8px 30px rgba(0,0,0,0.18)', height:'88%', display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', justifyContent:'center', paddingTop:9, paddingBottom:6, flexShrink:0 }}><div style={{ width:36, height:5, borderRadius:9999, background:E.borderStrong }}/></div>
          <div style={{ padding:'2px 18px 8px', flexShrink:0 }}>
            <div style={{ fontSize:18, fontWeight:700, color:E.fg1, letterSpacing:-0.3 }}>Assign bookings</div>
            <div style={{ fontSize:12, color:E.fg3, marginTop:4, lineHeight:'17px' }}>New bookings rotate across the members you pick.</div>
          </div>
          <div style={{ flex:1, overflow:'auto', padding:'4px 16px 12px' }}>{children}</div>
          <div style={{ flexShrink:0, padding:'10px 16px 20px', borderTop:`1px solid ${E.border}`, background:E.surface }}>
            <button disabled={doneDisabled} style={{ width:'100%', height:46, borderRadius:13, border:'none', background:E.blue600, color:'#fff', fontSize:14.5, fontWeight:700, cursor:doneDisabled?'default':'pointer', opacity:doneDisabled?0.45:1, boxShadow:doneDisabled?'none':'0 6px 16px rgba(2,132,199,0.28)' }}>{doneLabel}</button>
          </div>
        </div>
        <div style={{ position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)', width:100, height:4, borderRadius:4, background:'rgba(255,255,255,0.5)', zIndex:70 }}/>
      </div>
    </div>
  );
}

function Overline({ children, top=16 }) {
  return <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:E.fg3, margin:`${top}px 2px 8px` }}>{children}</div>;
}

function RuleCard({ name, desc, icon, selected }) {
  return (
    <button style={{
      width:'100%', textAlign:'left', display:'flex', alignItems:'center', gap:11, cursor:'pointer',
      padding:'11px 12px', borderRadius:14, marginBottom:8,
      border:`${selected?1.5:1}px solid ${selected?BIZ:E.border}`,
      background:selected?BIZ_BG:E.surface, boxShadow:selected?'none':'0 1px 2px rgba(0,0,0,0.03)',
    }}>
      <div style={{ width:32, height:32, borderRadius:9, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background:selected?'#fff':E.sunken, color:selected?BIZ:E.fg3 }}>
        <i data-lucide={icon} style={{ width:16, height:16, strokeWidth:2 }}/>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:700, color:E.fg1, letterSpacing:-0.1 }}>{name}</div>
        <div style={{ fontSize:11, color:E.fg3, marginTop:1, lineHeight:'14px' }}>{desc}</div>
      </div>
      <span style={{ width:20, height:20, borderRadius:'50%', flexShrink:0, display:'inline-flex', alignItems:'center', justifyContent:'center', background:selected?BIZ:'transparent', border:selected?'none':`1.5px solid ${E.borderStrong}` }}>
        {selected && <i data-lucide="check" style={{ width:12, height:12, color:'#fff', strokeWidth:3.2 }}/>}
      </span>
    </button>
  );
}

function Checkbox({ on }) {
  return (
    <span style={{ width:22, height:22, borderRadius:7, flexShrink:0, display:'inline-flex', alignItems:'center', justifyContent:'center', background:on?BIZ:'transparent', border:on?'none':`1.5px solid ${E.borderStrong}` }}>
      {on && <i data-lucide="check" style={{ width:13, height:13, color:'#fff', strokeWidth:3.2 }}/>}
    </span>
  );
}

function Disc({ grad, initials, dim }) {
  return <div style={{ width:34, height:34, borderRadius:'50%', flexShrink:0, background:grad, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, opacity:dim?0.5:1 }}>{initials}</div>;
}

function WeightStepper({ value }) {
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:3, flexShrink:0 }}>
      <button aria-label="Lower weight" style={{ width:22, height:22, borderRadius:9999, border:`1px solid ${E.border}`, background:E.surface, color:E.fg2, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}><i data-lucide="minus" style={{ width:11, height:11 }}/></button>
      <span style={{ minWidth:28, textAlign:'center', padding:'3px 6px', borderRadius:9999, background:BIZ_BG, color:BIZ, fontSize:11.5, fontWeight:700, fontVariantNumeric:'tabular-nums' }}>×{value}</span>
      <button aria-label="Raise weight" style={{ width:22, height:22, borderRadius:9999, border:`1px solid ${E.border}`, background:E.surface, color:BIZ, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}><i data-lucide="plus" style={{ width:11, height:11 }}/></button>
    </div>
  );
}

function SeatRow({ seat, checked, mode, hideTrailing, dim, last }) {
  return (
    <button aria-label={`${seat.name}, ${seat.role}, weight ${seat.weight}`} style={{
      width:'100%', textAlign:'left', display:'flex', alignItems:'center', gap:11, cursor:'pointer',
      padding:'10px 2px', borderBottom: last?'none':`1px solid ${E.border}`, background:'transparent', opacity:dim?0.55:1,
    }}>
      <Checkbox on={checked}/>
      <Disc grad={seat.grad} initials={seat.initials} dim={dim}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600, color:E.fg1, letterSpacing:-0.1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{seat.name}</div>
        <div style={{ fontSize:10.5, color:E.fg3, marginTop:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>Uses personal availability</div>
      </div>
      {!hideTrailing && (mode==='balanced'
        ? <WeightStepper value={seat.weight}/>
        : <i data-lucide="grip-vertical" style={{ width:20, height:20, color:E.fg4, flexShrink:0 }}/>)}
    </button>
  );
}

function SeatCard({ children }) {
  return <div style={{ background:E.surface, border:`1px solid ${E.border}`, borderRadius:16, boxShadow:'0 1px 3px rgba(0,0,0,0.04)', padding:'4px 13px' }}>{children}</div>;
}

function Blurb({ text }) {
  return (
    <div style={{ marginTop:14, display:'flex', alignItems:'flex-start', gap:9, padding:'11px 12px', background:BIZ_BG, borderRadius:12 }}>
      <i data-lucide="repeat" style={{ width:16, height:16, color:BIZ, flexShrink:0, marginTop:1 }}/>
      <span style={{ fontSize:11.5, color:E.fg2, lineHeight:'16px', fontWeight:500 }}>{text}</span>
    </div>
  );
}

// ─── FRAME 1 · DEFAULT (Balanced, 4 seats, weights) ─────────────────────────

function FrameDefault() {
  return (
    <Sheet label="Round-robin · Balanced">
      <RuleCard name="Balanced" desc="Spread bookings by weight" icon="scale" selected/>
      <RuleCard name="Priority order" desc="Fill the top of the list first" icon="list-ordered"/>
      <RuleCard name="Strict round-robin" desc="One each, strictly in turn" icon="repeat"/>
      <Overline>Bookable members</Overline>
      <SeatCard>
        {SEATS.map((s, i) => <SeatRow key={s.name} seat={s} checked mode="balanced" last={i===SEATS.length-1}/>)}
      </SeatCard>
      <Blurb text="New bookings rotate across 4 members, weighted by your settings."/>
    </Sheet>
  );
}

// ─── FRAME 2 · LOADING (shimmer seat rows) ──────────────────────────────────

function ShimmerRow({ last }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:11, padding:'12px 2px', borderBottom: last?'none':`1px solid ${E.border}` }}>
      <div style={{ width:22, height:22, borderRadius:7, ...SH }}/>
      <div style={{ width:34, height:34, borderRadius:'50%', ...SH }}/>
      <div style={{ flex:1 }}>
        <div style={{ width:'52%', height:11, borderRadius:6, ...SH }}/>
        <div style={{ width:'72%', height:8, borderRadius:5, marginTop:6, ...SH }}/>
      </div>
      <div style={{ width:54, height:24, borderRadius:9999, ...SH }}/>
    </div>
  );
}

function FrameLoading() {
  return (
    <Sheet label="Round-robin · Loading" doneDisabled>
      <RuleCard name="Balanced" desc="Spread bookings by weight" icon="scale" selected/>
      <RuleCard name="Priority order" desc="Fill the top of the list first" icon="list-ordered"/>
      <RuleCard name="Strict round-robin" desc="One each, strictly in turn" icon="repeat"/>
      <Overline>Bookable members</Overline>
      <SeatCard>
        {[0,1,2,3].map(i => <ShimmerRow key={i} last={i===3}/>)}
      </SeatCard>
    </Sheet>
  );
}

// ─── FRAME 3 · NONE SELECTED (warning + disabled Done) ──────────────────────

function FrameNone() {
  return (
    <Sheet label="Round-robin · None selected" doneDisabled>
      <RuleCard name="Balanced" desc="Spread bookings by weight" icon="scale" selected/>
      <RuleCard name="Priority order" desc="Fill the top of the list first" icon="list-ordered"/>
      <RuleCard name="Strict round-robin" desc="One each, strictly in turn" icon="repeat"/>
      <Overline>Bookable members</Overline>
      <div style={{ display:'flex', alignItems:'center', gap:9, padding:'10px 12px', background:WARN_BG, border:`1px solid ${WARN_BORDER}`, borderRadius:12, marginBottom:10 }}>
        <i data-lucide="alert-triangle" style={{ width:16, height:16, color:WARN, flexShrink:0 }}/>
        <span style={{ fontSize:11.5, color:WARN, fontWeight:600, lineHeight:'15px' }}>Pick at least one member to take bookings.</span>
      </div>
      <SeatCard>
        {SEATS.map((s, i) => <SeatRow key={s.name} seat={s} checked={false} mode="balanced" hideTrailing last={i===SEATS.length-1}/>)}
      </SeatCard>
    </Sheet>
  );
}

// ─── FRAME 4 · SINGLE MEMBER (rotation disabled, informational) ─────────────

function FrameSingle() {
  return (
    <Sheet label="Round-robin · Single member">
      <RuleCard name="Balanced" desc="Spread bookings by weight" icon="scale" selected/>
      <RuleCard name="Priority order" desc="Fill the top of the list first" icon="list-ordered"/>
      <RuleCard name="Strict round-robin" desc="One each, strictly in turn" icon="repeat"/>
      <Overline>Bookable members</Overline>
      <SeatCard>
        <SeatRow seat={SEATS[0]} checked mode="balanced" hideTrailing last/>
      </SeatCard>
      <div style={{ marginTop:14, display:'flex', alignItems:'flex-start', gap:9, padding:'11px 12px', background:BIZ_BG, borderRadius:12 }}>
        <i data-lucide="info" style={{ width:16, height:16, color:BIZ, flexShrink:0, marginTop:1 }}/>
        <span style={{ fontSize:11.5, color:E.fg2, lineHeight:'16px', fontWeight:500 }}>Rotation needs two or more members. Bookings go to Dana for now.</span>
      </div>
    </Sheet>
  );
}

Object.assign(window, { RR_FrameDefault:FrameDefault, RR_FrameLoading:FrameLoading, RR_FrameNone:FrameNone, RR_FrameSingle:FrameSingle });
