// Pantopus — Calendarly · Approve / Decline Request Sheet — 5 frames
// Archetype: Bottom sheet (CloseTrainSheet pattern from ManageTrain) + Gigs
// cancel-reason chips for progressive disclosure. Host-side; accent follows the
// booking's owner context. Only renders for approval-required event types.
//
// Frames: 1 default (requester + slot + intake preview) · 2 decline-expanded
// (reason chips + propose-time link) · 3 conflict-warning · 4 submitting
// (inline spinner) · 5 error (inline message, actions re-enabled).

const { E, SH } = window;

const ID = {
  personal: { color:'#0284c7', bg:'#e0f2fe', label:'Personal' },
  home:     { color:'#16a34a', bg:'#dcfce7', label:'Home · Riverside' },
  business: { color:'#7c3aed', bg:'#f3e8ff', label:'Business · Acme' },
};
const AV = { business:'linear-gradient(135deg,#a78bfa,#6d28d9)', personal:'linear-gradient(135deg,#38bdf8,#0369a1)', home:'linear-gradient(135deg,#4ade80,#15803d)' };
const WARN = '#B45309', WARN_BG = '#FFFBEB', WARN_LIGHT = '#FDE68A', WARN_SOLID = '#D97706';
const ERR = '#DC2626', ERR_BG = '#FEF2F2', ERR_LIGHT = '#FCA5A5';
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

// Dimmed Booking-Detail backdrop with a sheet rising over it.
function Sheet({ label, children, dimTitle='Studio consultation', pillar='business' }) {
  return (
    <div style={{ width:300, height:620, borderRadius:40, padding:8, background:'#0b0f17', boxShadow:'0 24px 50px rgba(17,24,39,0.20), 0 0 0 1px rgba(0,0,0,0.12)', flexShrink:0 }} data-screen-label={label}>
      <div style={{ width:'100%', height:'100%', background:E.bg, borderRadius:32, overflow:'hidden', position:'relative', display:'flex', flexDirection:'column', fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div style={{ position:'absolute', top:7, left:'50%', transform:'translateX(-50%)', width:88, height:24, borderRadius:16, background:'#000', zIndex:50 }}/>
        <DarkStatusBar/>
        {/* dimmed underlying detail */}
        <div style={{ flex:1, padding:'14px 16px', opacity:0.45, filter:'saturate(0.9)' }}>
          <div style={{ height:30, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <i data-lucide="chevron-left" style={{ width:20, height:20, color:E.fg2 }}/>
            <span style={{ padding:'3px 9px', borderRadius:9999, background:WARN_BG, color:WARN, border:`1px solid ${WARN_LIGHT}`, fontSize:10, fontWeight:700 }}>Pending approval</span>
          </div>
          <div style={{ fontSize:21, fontWeight:700, color:E.fg1, marginTop:12 }}>{dimTitle}</div>
          <div style={{ fontSize:13, color:E.fg2, marginTop:6 }}>Mon, Jun 16 · 11:00 AM · PT</div>
        </div>
        {/* scrim */}
        <div style={{ position:'absolute', inset:0, background:'rgba(17,24,39,0.42)', zIndex:18 }}/>
        {/* sheet */}
        <div style={{ position:'absolute', left:0, right:0, bottom:0, zIndex:20, background:E.surface, borderTopLeftRadius:24, borderTopRightRadius:24, boxShadow:'0 -8px 30px rgba(0,0,0,0.18)', maxHeight:'88%', display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', justifyContent:'center', paddingTop:9, paddingBottom:3, flexShrink:0 }}>
            <div style={{ width:36, height:5, borderRadius:9999, background:E.borderStrong }}/>
          </div>
          <div style={{ overflow:'auto', padding:'6px 16px 18px' }}>{children}</div>
        </div>
        <div style={{ position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)', width:100, height:4, borderRadius:4, background:'rgba(255,255,255,0.5)', zIndex:70 }}/>
      </div>
    </div>
  );
}

function Requester({ pillar='business', initials='RC', name='Rosa Calderón', sub='Verified · first-time booker' }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:11, padding:'11px 12px', background:E.raised, border:`1px solid ${E.border}`, borderRadius:14 }}>
      <div style={{ position:'relative', flexShrink:0 }}>
        <div style={{ width:40, height:40, borderRadius:'50%', background:AV[pillar], display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:14, fontWeight:700 }}>{initials}</div>
        <div style={{ position:'absolute', right:-2, bottom:-2, width:16, height:16, borderRadius:'50%', background:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="badge-check" style={{ width:15, height:15, color:ID[pillar].color }}/></div>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:14, fontWeight:700, color:E.fg1 }}>{name}</div>
        <div style={{ fontSize:11.5, color:E.fg3, marginTop:2 }}>{sub}</div>
      </div>
    </div>
  );
}

function SlotLine() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:11, marginTop:11, padding:'12px 12px', background:E.surface, border:`1.5px solid ${ID.business.bg}`, borderRadius:14 }}>
      <div style={{ width:38, height:38, borderRadius:10, background:ID.business.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i data-lucide="calendar-clock" style={{ width:19, height:19, color:'#7c3aed' }}/></div>
      <div>
        <div style={{ fontSize:13.5, fontWeight:700, color:E.fg1, letterSpacing:-0.1 }}>Mon, Jun 16 · 11:00–11:45 AM</div>
        <div style={{ fontSize:11, color:E.fg3, marginTop:2 }}>Pacific Time · 45 min</div>
      </div>
    </div>
  );
}

function IntakePreview() {
  return (
    <button style={{ width:'100%', display:'flex', alignItems:'center', gap:10, marginTop:9, padding:'10px 12px', background:E.surface, border:`1px solid ${E.border}`, borderRadius:12, cursor:'pointer' }}>
      <i data-lucide="clipboard-list" style={{ width:16, height:16, color:E.fg2 }}/>
      <span style={{ flex:1, textAlign:'left', fontSize:12.5, fontWeight:600, color:E.fg1 }}>Intake answers</span>
      <span style={{ fontSize:11, color:E.fg3 }}>3 answers</span>
      <i data-lucide="chevron-down" style={{ width:16, height:16, color:E.fg4 }}/>
    </button>
  );
}

function NoteInput() {
  return (
    <div style={{ marginTop:12 }}>
      <div style={{ width:'100%', minHeight:58, boxSizing:'border-box', padding:'10px 12px', background:E.sunken, border:`1px solid ${E.border}`, borderRadius:8, fontSize:12.5, color:E.fg4 }}>Add a note (optional)</div>
    </div>
  );
}

function ConflictBanner() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:9, marginTop:12, padding:'10px 12px', background:WARN_BG, border:`1px solid ${WARN_LIGHT}`, borderRadius:12 }}>
      <i data-lucide="triangle-alert" style={{ width:17, height:17, color:WARN_SOLID, flexShrink:0 }}/>
      <span style={{ fontSize:11.5, color:WARN, fontWeight:600, flex:1, lineHeight:'15px' }}>This slot overlaps a confirmed booking</span>
      <button style={{ background:'transparent', border:'none', color:WARN, fontSize:11.5, fontWeight:700, cursor:'pointer', padding:0 }}>View conflict</button>
    </div>
  );
}

function Actions({ declineLabel='Decline', approveLabel='Approve', submitting, approveSpinner }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:9, marginTop:16 }}>
      <button disabled={submitting} style={{ height:48, borderRadius:13, border:'none', background:PRIMARY, color:'#fff', fontSize:14.5, fontWeight:700, cursor:submitting?'default':'pointer', boxShadow:'0 6px 16px rgba(2,132,199,0.28)', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8, opacity:submitting?0.92:1 }}>
        {approveSpinner ? <><Spinner/>Approving</> : <><i data-lucide="check" style={{ width:17, height:17 }}/>{approveLabel}</>}
      </button>
      <button disabled={submitting} style={{ height:46, borderRadius:13, border:'none', background:'transparent', color:ERR, fontSize:14, fontWeight:700, cursor:submitting?'default':'pointer', opacity:submitting?0.5:1 }}>{declineLabel}</button>
    </div>
  );
}

function Spinner() {
  return <span style={{ width:16, height:16, borderRadius:'50%', border:'2.5px solid rgba(255,255,255,0.4)', borderTopColor:'#fff', display:'inline-block', animation:'sh-spin 0.7s linear infinite' }}/>;
}

function ReasonChips() {
  const chips = [
    { l:'Time doesn\u2019t work', on:true },
    { l:'Fully booked', on:false },
    { l:'Not a fit', on:false },
    { l:'Other', on:false },
  ];
  return (
    <div style={{ marginTop:14 }}>
      <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:E.fg3, marginBottom:9 }}>Reason</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
        {chips.map((c) => (
          <button key={c.l} style={{ height:34, padding:'0 14px', borderRadius:9999, cursor:'pointer', fontSize:12, fontWeight:700, border: c.on ? 'none' : `1px solid ${E.border}`, background: c.on ? ERR_BG : E.surface, color: c.on ? ERR : E.fg2 }}>{c.l}</button>
        ))}
      </div>
      <button style={{ display:'inline-flex', alignItems:'center', gap:6, marginTop:13, background:'transparent', border:'none', padding:0, cursor:'pointer', color:PRIMARY, fontSize:12.5, fontWeight:700 }}>
        <i data-lucide="calendar-plus" style={{ width:15, height:15 }}/>Propose another time
      </button>
    </div>
  );
}

function Title({ children }) {
  return <div style={{ fontSize:17, fontWeight:700, color:E.fg1, letterSpacing:-0.2, margin:'2px 2px 13px' }}>{children}</div>;
}

// ─── FRAME 1 · DEFAULT ──────────────────────────────────────────────────────

function FrameDefault() {
  return (
    <Sheet label="Approve/Decline · Default">
      <Title>Review request</Title>
      <Requester/>
      <SlotLine/>
      <IntakePreview/>
      <NoteInput/>
      <Actions/>
    </Sheet>
  );
}

// ─── FRAME 2 · DECLINE EXPANDED ─────────────────────────────────────────────

function FrameDeclineExpanded() {
  return (
    <Sheet label="Approve/Decline · Decline expanded">
      <Title>Decline request</Title>
      <Requester/>
      <SlotLine/>
      <ReasonChips/>
      <NoteInput/>
      <div style={{ marginTop:16 }}>
        <button style={{ width:'100%', height:48, borderRadius:13, border:'none', background:ERR, color:'#fff', fontSize:14.5, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8 }}><i data-lucide="x" style={{ width:17, height:17 }}/>Decline request</button>
      </div>
    </Sheet>
  );
}

// ─── FRAME 3 · CONFLICT WARNING ─────────────────────────────────────────────

function FrameConflict() {
  return (
    <Sheet label="Approve/Decline · Conflict">
      <Title>Review request</Title>
      <Requester/>
      <SlotLine/>
      <ConflictBanner/>
      <NoteInput/>
      <Actions/>
    </Sheet>
  );
}

// ─── FRAME 4 · SUBMITTING ───────────────────────────────────────────────────

function FrameSubmitting() {
  return (
    <Sheet label="Approve/Decline · Submitting">
      <Title>Review request</Title>
      <Requester/>
      <SlotLine/>
      <IntakePreview/>
      <Actions submitting approveSpinner/>
    </Sheet>
  );
}

// ─── FRAME 5 · ERROR ────────────────────────────────────────────────────────

function FrameError() {
  return (
    <Sheet label="Approve/Decline · Error">
      <Title>Review request</Title>
      <Requester/>
      <SlotLine/>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:12, padding:'10px 12px', background:ERR_BG, border:`1px solid ${ERR_LIGHT}`, borderRadius:12 }}>
        <i data-lucide="alert-circle" style={{ width:16, height:16, color:ERR, flexShrink:0 }}/>
        <span style={{ fontSize:11.5, color:ERR, fontWeight:600 }}>Couldn't approve — try again</span>
      </div>
      <Actions/>
    </Sheet>
  );
}

Object.assign(window, { FrameDefault, FrameDeclineExpanded, FrameConflict, FrameSubmitting, FrameError });
