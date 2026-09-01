// Pantopus — Calendarly · Group Event Roster & Seats — 6 frames
// Archetype: ListOfRows + ManageTrain capacity/stat header (Support Trains
// SlotPreview capacity fill). Owner-polymorphic; accent follows owner context.
// Top bar: back chevron, "Roster", overflow. 1:1 bookings never reach this.
//
// Frames: 1 under-capacity · 2 full · 3 waitlist-active · 4 loading (shimmer) ·
// 5 empty (no signups) · 6 error.

const { E, SH } = window;

const ID = { business:{color:'#7c3aed', bg:'#f3e8ff'} };
const AV = { business:'linear-gradient(135deg,#a78bfa,#6d28d9)' };
const ACCENT = '#7c3aed';
const WARN = '#B45309', WARN_BG = '#FFFBEB', WARN_LIGHT = '#FDE68A';
const ERR = '#DC2626', ERR_BG = '#FEF2F2', ERR_LIGHT = '#FCA5A5';
const SUCCESS = '#059669', SUCCESS_DK='#047857', SUCCESS_BG='#F0FDF4', SUCCESS_LIGHT='#A7F3D0';
const PRIMARY = E.blue600;

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

function TopBar() {
  return (
    <div style={{ display:'flex', alignItems:'center', padding:'6px 8px', height:46, boxSizing:'border-box', background:E.surface, borderBottom:`1px solid ${E.border}`, flexShrink:0, zIndex:5 }}>
      <button aria-label="Back" style={{ width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'none', cursor:'pointer', color:E.fg1, padding:0 }}><i data-lucide="chevron-left" style={{ width:21, height:21 }}/></button>
      <div style={{ flex:1, textAlign:'center', fontSize:15.5, fontWeight:600, color:E.fg1, letterSpacing:-0.2 }}>Roster</div>
      <button aria-label="More actions" style={{ width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'none', cursor:'pointer', color:E.fg2, padding:0 }}><i data-lucide="more-vertical" style={{ width:19, height:19 }}/></button>
    </div>
  );
}

function Phone({ label, children, fab }) {
  return (
    <div style={{ width:300, height:620, borderRadius:40, padding:8, background:'#0b0f17', boxShadow:'0 24px 50px rgba(17,24,39,0.20), 0 0 0 1px rgba(0,0,0,0.12)', flexShrink:0 }} data-screen-label={label}>
      <div style={{ width:'100%', height:'100%', background:E.bg, borderRadius:32, overflow:'hidden', position:'relative', display:'flex', flexDirection:'column', fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div style={{ position:'absolute', top:7, left:'50%', transform:'translateX(-50%)', width:88, height:24, borderRadius:16, background:'#000', zIndex:50 }}/>
        <DarkStatusBar/>
        <TopBar/>
        {children}
        {fab && (
          <button style={{ position:'absolute', bottom:22, right:16, zIndex:30, height:46, padding:'0 18px', borderRadius:9999, border:'none', cursor:'pointer', background:PRIMARY, color:'#fff', fontSize:13, fontWeight:700, boxShadow:'0 8px 20px rgba(2,132,199,0.34)', display:'inline-flex', alignItems:'center', gap:8 }}><i data-lucide="megaphone" style={{ width:16, height:16 }}/>Message all</button>
        )}
        <div style={{ position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)', width:100, height:4, borderRadius:4, background:'rgba(0,0,0,0.22)', zIndex:70 }}/>
      </div>
    </div>
  );
}

function CapacityHeader({ filled, total, confirmed, pending, waitlisted, full }) {
  const pct = Math.min(100, Math.round((filled/total)*100));
  const barColor = full ? E.fg4 : ACCENT;
  return (
    <div style={{ background:E.surface, border:`1px solid ${E.border}`, borderRadius:16, boxShadow:'0 1px 3px rgba(0,0,0,0.04)', padding:'13px 14px', margin:'12px 14px 4px' }}>
      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:9 }}>
        <span style={{ fontSize:14, fontWeight:700, color:E.fg1 }}>{filled} of {total} seats filled{waitlisted ? ` · ${waitlisted} waiting` : ''}</span>
        {full && <span style={{ fontSize:10.5, fontWeight:700, color:E.fg3 }}>All seats filled</span>}
      </div>
      <div style={{ height:9, borderRadius:9999, background:E.sunken, overflow:'hidden', marginBottom:13 }}>
        <div style={{ width:`${pct}%`, height:'100%', background:barColor, borderRadius:9999 }}/>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        {[['Confirmed', confirmed, SUCCESS_DK], ['Pending', pending, WARN], ['Waitlisted', waitlisted||0, E.fg3]].map(([l, n, c]) => (
          <div key={l} style={{ flex:1, background:E.sunken, borderRadius:11, padding:'8px 6px', textAlign:'center' }}>
            <div style={{ fontSize:17, fontWeight:800, color:c, fontVariantNumeric:'tabular-nums' }}>{n}</div>
            <div style={{ fontSize:9, fontWeight:600, color:E.fg3, marginTop:2, textTransform:'uppercase', letterSpacing:'0.04em' }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Overline({ children }) {
  return <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:E.fg3, margin:'15px 18px 8px' }}>{children}</div>;
}

function AttendeeRow({ initials, name, meta, status, promote, promoteDisabled }) {
  const chip = {
    confirmed: { label:'Confirmed', bg:SUCCESS_BG, fg:SUCCESS_DK, bd:SUCCESS_LIGHT },
    pending:   { label:'Pending', bg:WARN_BG, fg:WARN, bd:WARN_LIGHT },
    waitlisted:{ label:'Waitlisted', bg:E.sunken, fg:E.fg3, bd:E.border },
  }[status];
  return (
    <div style={{ background:E.surface, border:`1px solid ${E.border}`, borderRadius:14, boxShadow:'0 1px 3px rgba(0,0,0,0.04)', padding:'10px 12px', display:'flex', flexDirection:'column', gap: promote ? 10 : 0 }}>
      <div style={{ display:'flex', alignItems:'center', gap:11 }}>
        <div style={{ position:'relative', flexShrink:0 }}>
          <div style={{ width:38, height:38, borderRadius:'50%', background:AV.business, color:'#fff', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>{initials}</div>
          <div style={{ position:'absolute', right:-2, bottom:-2, width:15, height:15, borderRadius:'50%', background:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="badge-check" style={{ width:14, height:14, color:ACCENT }}/></div>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:700, color:E.fg1 }}>{name}</div>
          <div style={{ fontSize:10.5, color:E.fg3, marginTop:2 }}>{meta}</div>
        </div>
        {chip && <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:9999, background:chip.bg, color:chip.fg, border:`1px solid ${chip.bd}`, fontSize:9.5, fontWeight:700, whiteSpace:'nowrap' }}>{chip.label}</span>}
        <button aria-label="Row actions" style={{ width:22, height:22, display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'none', cursor:'pointer', color:E.fg4, padding:0, marginLeft:2 }}><i data-lucide="more-vertical" style={{ width:16, height:16 }}/></button>
      </div>
      {promote && (
        <div style={{ paddingTop:10, borderTop:`1px solid ${E.border}` }}>
          <button disabled={promoteDisabled} style={{ width:'100%', height:34, borderRadius:9, border:'none', cursor:promoteDisabled?'default':'pointer', background: promoteDisabled?E.sunken:ID.business.bg, color: promoteDisabled?E.fg4:ACCENT, fontSize:12, fontWeight:700, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6 }}><i data-lucide="arrow-up" style={{ width:14, height:14 }}/>Promote to seat</button>
          {promoteDisabled && <div style={{ fontSize:10, color:E.fg4, marginTop:6, textAlign:'center' }}>Open a seat to promote</div>}
        </div>
      )}
    </div>
  );
}

function HostControls() {
  return (
    <div style={{ margin:'13px 14px 0', display:'flex', flexDirection:'column', gap:9 }}>
      <button style={{ width:'100%', display:'flex', alignItems:'center', gap:11, padding:'11px 13px', background:E.surface, border:`1px solid ${E.border}`, borderRadius:14, cursor:'pointer' }}>
        <div style={{ width:32, height:32, borderRadius:9, background:E.blue50, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i data-lucide="user-plus" style={{ width:16, height:16, color:E.blue600 }}/></div>
        <span style={{ flex:1, textAlign:'left', fontSize:13, fontWeight:600, color:E.fg1 }}>Add or invite attendee</span>
        <i data-lucide="chevron-right" style={{ width:16, height:16, color:E.fg4 }}/>
      </button>
      <div style={{ display:'flex', alignItems:'center', gap:11, padding:'11px 13px', background:E.surface, border:`1px solid ${E.border}`, borderRadius:14 }}>
        <div style={{ width:32, height:32, borderRadius:9, background:E.sunken, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i data-lucide="users" style={{ width:16, height:16, color:E.fg2 }}/></div>
        <span style={{ flex:1, fontSize:13, fontWeight:600, color:E.fg1 }}>Capacity</span>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button style={{ width:28, height:28, borderRadius:8, border:`1px solid ${E.border}`, background:E.surface, color:E.fg2, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="minus" style={{ width:14, height:14 }}/></button>
          <span style={{ fontSize:14, fontWeight:700, color:E.fg1, minWidth:18, textAlign:'center' }}>16</span>
          <button style={{ width:28, height:28, borderRadius:8, border:`1px solid ${E.border}`, background:E.surface, color:E.fg2, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="plus" style={{ width:14, height:14 }}/></button>
        </div>
      </div>
    </div>
  );
}

function Scroll({ children }) { return <div style={{ flex:1, overflow:'auto', paddingBottom:88 }}>{children}</div>; }
function Group({ children }) { return <div style={{ display:'flex', flexDirection:'column', gap:9, padding:'0 14px' }}>{children}</div>; }

// ─── FRAME 1 · UNDER CAPACITY ───────────────────────────────────────────────

function FrameUnderCapacity() {
  return (
    <Phone label="Roster · Under capacity" fab>
      <Scroll>
        <CapacityHeader filled={12} total={16} confirmed={10} pending={2} waitlisted={3}/>
        <Overline>Seated · 12</Overline>
        <Group>
          <AttendeeRow initials="TK" name="Theo Kemp" meta="Joined Jun 8" status="confirmed"/>
          <AttendeeRow initials="LM" name="Lena Marsh" meta="Joined Jun 9" status="confirmed"/>
          <AttendeeRow initials="WH" name="Wes Holt" meta="Joined Jun 10" status="pending"/>
        </Group>
        <Overline>Waitlist · 3</Overline>
        <Group>
          <AttendeeRow initials="RC" name="Rosa Calderón" meta="#1 · joined Jun 11" status="waitlisted" promote/>
        </Group>
        <HostControls/>
      </Scroll>
    </Phone>
  );
}

// ─── FRAME 2 · FULL ─────────────────────────────────────────────────────────

function FrameFull() {
  return (
    <Phone label="Roster · Full" fab>
      <Scroll>
        <CapacityHeader filled={16} total={16} confirmed={16} pending={0} waitlisted={3} full/>
        <Overline>Seated · 16</Overline>
        <Group>
          <AttendeeRow initials="TK" name="Theo Kemp" meta="Joined Jun 8" status="confirmed"/>
          <AttendeeRow initials="LM" name="Lena Marsh" meta="Joined Jun 9" status="confirmed"/>
        </Group>
        <Overline>Waitlist · 3</Overline>
        <Group>
          <AttendeeRow initials="RC" name="Rosa Calderón" meta="#1 · joined Jun 11" status="waitlisted" promote promoteDisabled/>
        </Group>
      </Scroll>
    </Phone>
  );
}

// ─── FRAME 3 · WAITLIST ACTIVE ──────────────────────────────────────────────

function FrameWaitlist() {
  return (
    <Phone label="Roster · Waitlist active" fab>
      <Scroll>
        <CapacityHeader filled={15} total={16} confirmed={14} pending={1} waitlisted={3}/>
        <Overline>Waitlist · 3 · 1 seat open</Overline>
        <Group>
          <AttendeeRow initials="RC" name="Rosa Calderón" meta="#1 · joined Jun 11" status="waitlisted" promote/>
          <AttendeeRow initials="SN" name="Sam Nguyen" meta="#2 · joined Jun 12" status="waitlisted" promote/>
          <AttendeeRow initials="BD" name="Bea Dunn" meta="#3 · joined Jun 12" status="waitlisted" promote/>
        </Group>
      </Scroll>
    </Phone>
  );
}

// ─── FRAME 4 · LOADING ──────────────────────────────────────────────────────

function FrameLoading() {
  const SkRow = () => (
    <div style={{ background:E.surface, border:`1px solid ${E.border}`, borderRadius:14, boxShadow:'0 1px 3px rgba(0,0,0,0.04)', padding:'10px 12px', display:'flex', alignItems:'center', gap:11 }}>
      <div style={{ width:38, height:38, borderRadius:'50%', flexShrink:0, ...SH }}/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:7 }}><div style={{ width:'55%', height:10, borderRadius:5, ...SH }}/><div style={{ width:'35%', height:8, borderRadius:5, ...SH }}/></div>
      <div style={{ width:54, height:16, borderRadius:9999, ...SH }}/>
    </div>
  );
  return (
    <Phone label="Roster · Loading">
      <Scroll>
        <div style={{ margin:'12px 14px 4px', height:118, borderRadius:16, ...SH }}/>
        <div style={{ width:70, height:9, borderRadius:5, margin:'15px 18px 8px', ...SH }}/>
        <Group><SkRow/><SkRow/><SkRow/></Group>
      </Scroll>
    </Phone>
  );
}

// ─── FRAME 5 · EMPTY ────────────────────────────────────────────────────────

function FrameEmpty() {
  return (
    <Phone label="Roster · Empty">
      <Scroll>
        <CapacityHeader filled={0} total={16} confirmed={0} pending={0} waitlisted={0}/>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', padding:'40px 30px', gap:16 }}>
          <div style={{ width:72, height:72, borderRadius:'50%', background:ID.business.bg, color:ACCENT, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="users" style={{ width:32, height:32, strokeWidth:1.8 }}/></div>
          <div>
            <div style={{ fontSize:16.5, fontWeight:700, color:E.fg1 }}>No signups yet</div>
            <div style={{ fontSize:12.5, color:E.fg3, marginTop:7, maxWidth:200, lineHeight:'18px' }}>Share the booking link to fill seats.</div>
          </div>
          <button style={{ height:44, padding:'0 18px', borderRadius:12, border:'none', cursor:'pointer', background:PRIMARY, color:'#fff', fontSize:13.5, fontWeight:700, boxShadow:'0 6px 16px rgba(2,132,199,0.28)', display:'inline-flex', alignItems:'center', gap:7 }}><i data-lucide="link" style={{ width:16, height:16 }}/>Share booking link</button>
        </div>
      </Scroll>
    </Phone>
  );
}

// ─── FRAME 6 · ERROR ────────────────────────────────────────────────────────

function FrameError() {
  return (
    <Phone label="Roster · Error">
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'20px 30px 60px', gap:18 }}>
        <div style={{ width:72, height:72, borderRadius:'50%', background:ERR_BG, color:ERR, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="cloud-off" style={{ width:32, height:32, strokeWidth:1.8 }}/></div>
        <div>
          <div style={{ fontSize:16.5, fontWeight:700, color:E.fg1 }}>Couldn't load the roster</div>
          <div style={{ fontSize:12.5, color:E.fg3, marginTop:7, maxWidth:210 }}>Check your connection and try again.</div>
        </div>
        <button style={{ height:44, padding:'0 18px', borderRadius:12, border:`1px solid ${E.borderStrong}`, cursor:'pointer', background:E.surface, color:E.fg1, fontSize:13.5, fontWeight:700, display:'inline-flex', alignItems:'center', gap:7 }}><i data-lucide="rotate-cw" style={{ width:16, height:16 }}/>Try again</button>
      </div>
    </Phone>
  );
}

Object.assign(window, { FrameUnderCapacity, FrameFull, FrameWaitlist, FrameLoading, FrameEmpty, FrameError });
