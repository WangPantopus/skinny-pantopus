// Pantopus — Calendarly · Reschedule / Reassign Sheet — 8 frames
// Archetype: Sheet wrapping the shared availability slot picker (weekday strip +
// stacked slot rows) reused from the booking flow & Support Trains. Host or
// member; accent follows owner context. Member view hides the authority toggle.
//
// Frames: 1 loading-availability (shimmer) · 2 slots-available · 3 no-
// availability · 4 member-picker (Business reassign) · 5 proposed · 6 conflict
// · 7 saving · 8 error.

const { E, SH } = window;

const ID = {
  personal: { color:'#0284c7', bg:'#e0f2fe' },
  home:     { color:'#16a34a', bg:'#dcfce7' },
  business: { color:'#7c3aed', bg:'#f3e8ff' },
};
const AV = { business:'linear-gradient(135deg,#a78bfa,#6d28d9)' };
const WARN = '#B45309', WARN_BG = '#FFFBEB', WARN_LIGHT = '#FDE68A', WARN_SOLID = '#D97706';
const ERR = '#DC2626', ERR_BG = '#FEF2F2', ERR_LIGHT = '#FCA5A5';
const SUCCESS = '#059669', SUCCESS_DK='#047857', SUCCESS_BG = '#F0FDF4', SUCCESS_LIGHT='#A7F3D0';
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

function Sheet({ label, children, accent='#7c3aed', cta, ctaIcon, ctaTone, saving }) {
  return (
    <div style={{ width:300, height:620, borderRadius:40, padding:8, background:'#0b0f17', boxShadow:'0 24px 50px rgba(17,24,39,0.20), 0 0 0 1px rgba(0,0,0,0.12)', flexShrink:0 }} data-screen-label={label}>
      <div style={{ width:'100%', height:'100%', background:E.bg, borderRadius:32, overflow:'hidden', position:'relative', display:'flex', flexDirection:'column', fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div style={{ position:'absolute', top:7, left:'50%', transform:'translateX(-50%)', width:88, height:24, borderRadius:16, background:'#000', zIndex:50 }}/>
        <DarkStatusBar/>
        <div style={{ flex:1, padding:'14px 16px', opacity:0.4 }}>
          <div style={{ height:24, display:'flex', alignItems:'center' }}><i data-lucide="chevron-left" style={{ width:20, height:20, color:E.fg2 }}/></div>
          <div style={{ fontSize:21, fontWeight:700, color:E.fg1, marginTop:10 }}>Studio consultation</div>
          <div style={{ fontSize:13, color:E.fg2, marginTop:6 }}>Sat, Jun 14 · 10:00 AM · PT</div>
        </div>
        <div style={{ position:'absolute', inset:0, background:'rgba(17,24,39,0.42)', zIndex:18 }}/>
        <div style={{ position:'absolute', left:0, right:0, bottom:0, top:64, zIndex:20, background:E.surface, borderTopLeftRadius:24, borderTopRightRadius:24, boxShadow:'0 -8px 30px rgba(0,0,0,0.18)', display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', justifyContent:'center', paddingTop:9, paddingBottom:4, flexShrink:0 }}><div style={{ width:36, height:5, borderRadius:9999, background:E.borderStrong }}/></div>
          <div style={{ flex:1, overflow:'auto', padding:'4px 16px 14px' }}>{children}</div>
          {cta && (
            <div style={{ flexShrink:0, padding:'10px 16px 20px', borderTop:`1px solid ${E.border}`, background:E.surface }}>
              <button disabled={saving} style={{ width:'100%', height:48, borderRadius:13, border:'none', background: ctaTone==='success'?SUCCESS:accent, color:'#fff', fontSize:14.5, fontWeight:700, cursor:saving?'default':'pointer', boxShadow:`0 6px 16px ${accent==='#7c3aed'?'rgba(124,58,237,0.28)':'rgba(2,132,199,0.28)'}`, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                {saving ? <><Spinner/>Saving</> : <><i data-lucide={ctaIcon} style={{ width:17, height:17 }}/>{cta}</>}
              </button>
            </div>
          )}
        </div>
        <div style={{ position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)', width:100, height:4, borderRadius:4, background:'rgba(255,255,255,0.5)', zIndex:70 }}/>
      </div>
    </div>
  );
}

function Spinner() { return <span style={{ width:16, height:16, borderRadius:'50%', border:'2.5px solid rgba(255,255,255,0.4)', borderTopColor:'#fff', display:'inline-block', animation:'sh-spin 0.7s linear infinite' }}/>; }

function CurrentSlot({ target='New time', filled }) {
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ padding:'10px 12px', background:E.sunken, borderRadius:11, display:'flex', alignItems:'center', gap:9 }}>
        <i data-lucide="calendar" style={{ width:16, height:16, color:E.fg4 }}/>
        <span style={{ fontSize:12.5, color:E.fg3, textDecoration:'line-through' }}>Sat, Jun 14 · 10:00 AM · PT</span>
      </div>
      <div style={{ display:'flex', justifyContent:'center', margin:'4px 0' }}><i data-lucide="arrow-down" style={{ width:16, height:16, color:E.fg4 }}/></div>
      <div style={{ padding:'10px 12px', background: filled?ID.business.bg:E.surface, border:`1.5px ${filled?'solid':'dashed'} ${filled?'#7c3aed':E.borderStrong}`, borderRadius:11, display:'flex', alignItems:'center', gap:9 }}>
        <i data-lucide="calendar-clock" style={{ width:16, height:16, color: filled?'#7c3aed':E.fg4 }}/>
        <span style={{ fontSize:12.5, fontWeight: filled?700:500, color: filled?E.fg1:E.fg4 }}>{filled ? 'Tue, Oct 22 · 2:00–2:30 PM · PT' : target}</span>
      </div>
    </div>
  );
}

function TzChip() {
  return (
    <button style={{ display:'inline-flex', alignItems:'center', gap:6, height:28, padding:'0 11px', borderRadius:9999, border:`1px solid ${E.border}`, background:E.surface, cursor:'pointer', fontSize:11, fontWeight:600, color:E.fg2, marginBottom:11 }}>
      <i data-lucide="globe" style={{ width:13, height:13 }}/>Times in Pacific · tap to change
    </button>
  );
}

function DayStrip({ accent='#7c3aed' }) {
  const days = [
    { d:'Mon', n:'20' }, { d:'Tue', n:'21', on:true }, { d:'Wed', n:'22' }, { d:'Thu', n:'23' }, { d:'Fri', n:'24' },
  ];
  return (
    <div style={{ display:'flex', gap:8, overflowX:'auto', marginBottom:13, paddingBottom:2 }}>
      {days.map((x) => (
        <div key={x.n} style={{ flexShrink:0, width:48, height:58, borderRadius:13, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, cursor:'pointer', background: x.on?accent:E.surface, border: x.on?'none':`1px solid ${E.border}`, color: x.on?'#fff':E.fg2 }}>
          <span style={{ fontSize:10.5, fontWeight:600, opacity:0.8 }}>{x.d}</span>
          <span style={{ fontSize:16, fontWeight:700 }}>{x.n}</span>
        </div>
      ))}
    </div>
  );
}

function SlotRow({ label, on, accent='#7c3aed' }) {
  return (
    <button style={{ width:'100%', minHeight:46, padding:'0 14px', borderRadius:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, background: on?ID.business.bg:E.surface, border:`1.5px solid ${on?accent:E.border}`, color:E.fg1 }}>
      <span style={{ fontSize:12.5, fontWeight: on?700:600, letterSpacing:-0.1 }}>{label}</span>
      {on && <i data-lucide="check-circle-2" style={{ width:18, height:18, color:accent }}/>}
    </button>
  );
}

function SlotList({ accent='#7c3aed' }) {
  const slots = [
    { l:'Tue Oct 21 · 1:00–1:30 PM · PT' },
    { l:'Tue Oct 21 · 2:00–2:30 PM · PT', on:true },
    { l:'Tue Oct 21 · 3:30–4:00 PM · PT' },
    { l:'Tue Oct 21 · 4:30–5:00 PM · PT' },
  ];
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {slots.map((s) => <SlotRow key={s.l} label={s.l} on={s.on} accent={accent}/>)}
    </div>
  );
}

function Explainer() {
  return <div style={{ fontSize:10.5, color:E.fg3, marginTop:11, lineHeight:'15px', display:'flex', gap:6, alignItems:'flex-start' }}><i data-lucide="info" style={{ width:12, height:12, marginTop:1, flexShrink:0 }}/>Times come from each member's personal availability.</div>;
}

function AuthorityToggle() {
  return (
    <div style={{ marginTop:15 }}>
      <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:E.fg3, marginBottom:8 }}>How to apply</div>
      <div style={{ display:'flex', gap:3, padding:3, background:E.sunken, borderRadius:10 }}>
        {[['Propose to invitee', true], ['Reschedule now', false]].map(([l, on]) => (
          <button key={l} style={{ flex:1, height:38, borderRadius:7, border:'none', cursor:'pointer', background: on?E.surface:'transparent', color: on?'#7c3aed':E.fg3, boxShadow: on?'0 1px 2px rgba(0,0,0,0.08)':'none', fontSize:11, fontWeight: on?700:600, lineHeight:'13px', padding:'0 4px' }}>{l}</button>
        ))}
      </div>
      <div style={{ fontSize:10, color:E.fg4, marginTop:5 }}>Propose sends the new time for the invitee to accept.</div>
    </div>
  );
}

function NotifySwitch() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:11, marginTop:14, padding:'11px 12px', background:E.surface, border:`1px solid ${E.border}`, borderRadius:12 }}>
      <i data-lucide="bell" style={{ width:17, height:17, color:E.fg2 }}/>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:12.5, fontWeight:600, color:E.fg1 }}>Notify invitee</div>
        <div style={{ fontSize:10.5, color:E.fg3, marginTop:1 }}>Push + message</div>
      </div>
      <div style={{ width:42, height:25, borderRadius:9999, background:'#7c3aed', position:'relative', flexShrink:0 }}><div style={{ position:'absolute', top:2.5, right:2.5, width:20, height:20, borderRadius:'50%', background:'#fff' }}/></div>
    </div>
  );
}

function MsgInput() {
  return <div style={{ marginTop:14, width:'100%', minHeight:50, boxSizing:'border-box', padding:'10px 12px', background:E.sunken, border:`1px solid ${E.border}`, borderRadius:8, fontSize:12.5, color:E.fg4 }}>Add a message (optional)</div>;
}

function SectionTitle({ children }) { return <div style={{ fontSize:16.5, fontWeight:700, color:E.fg1, letterSpacing:-0.2, margin:'2px 2px 13px' }}>{children}</div>; }

// ─── FRAME 1 · LOADING AVAILABILITY ─────────────────────────────────────────

function FrameLoading() {
  return (
    <Sheet label="Reschedule · Loading">
      <SectionTitle>Pick a new time</SectionTitle>
      <CurrentSlot/>
      <div style={{ display:'flex', gap:8, marginBottom:13 }}>{[0,1,2,3,4].map(i=><div key={i} style={{ width:48, height:58, borderRadius:13, ...SH }}/>)}</div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>{[0,1,2,3].map(i=><div key={i} style={{ width:'100%', height:46, borderRadius:12, ...SH }}/>)}</div>
    </Sheet>
  );
}

// ─── FRAME 2 · SLOTS AVAILABLE ──────────────────────────────────────────────

function FrameSlots() {
  return (
    <Sheet label="Reschedule · Slots" cta="Send proposal" ctaIcon="send">
      <SectionTitle>Pick a new time</SectionTitle>
      <CurrentSlot filled/>
      <TzChip/>
      <DayStrip/>
      <SlotList/>
      <AuthorityToggle/>
      <NotifySwitch/>
    </Sheet>
  );
}

// ─── FRAME 3 · NO AVAILABILITY ──────────────────────────────────────────────

function FrameNoAvail() {
  return (
    <Sheet label="Reschedule · No availability">
      <SectionTitle>Pick a new time</SectionTitle>
      <CurrentSlot/>
      <TzChip/>
      <DayStrip/>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', padding:'30px 24px', gap:14 }}>
        <div style={{ width:64, height:64, borderRadius:'50%', background:E.sunken, color:E.fg3, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="calendar-x" style={{ width:28, height:28, strokeWidth:1.8 }}/></div>
        <div>
          <div style={{ fontSize:14.5, fontWeight:700, color:E.fg1 }}>No open times in this range</div>
          <div style={{ fontSize:12, color:E.fg3, marginTop:5, maxWidth:200, lineHeight:'17px' }}>Widen the window or message the invitee.</div>
        </div>
      </div>
    </Sheet>
  );
}

// ─── FRAME 4 · MEMBER PICKER (Business reassign) ────────────────────────────

function FrameMemberPicker() {
  const members = [
    { i:'PR', n:'Priya', on:true }, { i:'DV', n:'Devon' }, { i:'AK', n:'Aria' }, { i:'+', n:'All' },
  ];
  return (
    <Sheet label="Reschedule · Member picker" cta="Send proposal" ctaIcon="send">
      <SectionTitle>Reschedule &amp; reassign</SectionTitle>
      <CurrentSlot filled/>
      <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:E.fg3, marginBottom:9 }}>Assign to</div>
      <div style={{ display:'flex', gap:9, marginBottom:14, overflowX:'auto', paddingBottom:2 }}>
        {members.map((m) => (
          <div key={m.i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5, flexShrink:0 }}>
            <div style={{ width:46, height:46, borderRadius:'50%', background:m.i==='+'?E.sunken:AV.business, color:m.i==='+'?E.fg3:'#fff', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', border: m.on?'2.5px solid #7c3aed':'2.5px solid transparent' }}>{m.i}</div>
            <span style={{ fontSize:10, fontWeight:600, color: m.on?'#7c3aed':E.fg3 }}>{m.n}</span>
          </div>
        ))}
      </div>
      <TzChip/>
      <DayStrip/>
      <SlotList/>
      <Explainer/>
    </Sheet>
  );
}

// ─── FRAME 5 · PROPOSED ─────────────────────────────────────────────────────

function FrameProposed() {
  return (
    <Sheet label="Reschedule · Proposed">
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', padding:'40px 24px', gap:16 }}>
        <div style={{ width:72, height:72, borderRadius:'50%', background:SUCCESS_BG, border:`1px solid ${SUCCESS_LIGHT}`, color:SUCCESS, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="send" style={{ width:30, height:30 }}/></div>
        <div>
          <div style={{ fontSize:17, fontWeight:700, color:E.fg1 }}>Proposal sent</div>
          <div style={{ fontSize:12.5, color:E.fg3, marginTop:7, maxWidth:210, lineHeight:'18px' }}>Rosa will get a push and a message to accept Tue, Oct 22 · 2:00 PM.</div>
        </div>
        <div style={{ padding:'10px 14px', background:E.sunken, borderRadius:11, fontSize:12, color:E.fg2, fontWeight:600 }}>Waiting on Rosa to accept</div>
      </div>
    </Sheet>
  );
}

// ─── FRAME 6 · CONFLICT ─────────────────────────────────────────────────────

function FrameConflict() {
  return (
    <Sheet label="Reschedule · Conflict" cta="Reschedule now" ctaIcon="calendar-check">
      <SectionTitle>Pick a new time</SectionTitle>
      <CurrentSlot filled/>
      <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:13, padding:'10px 12px', background:WARN_BG, border:`1px solid ${WARN_LIGHT}`, borderRadius:12 }}>
        <i data-lucide="triangle-alert" style={{ width:17, height:17, color:WARN_SOLID, flexShrink:0 }}/>
        <span style={{ fontSize:11.5, color:WARN, fontWeight:600, flex:1, lineHeight:'15px' }}>This time overlaps "Brand strategy"</span>
        <button style={{ background:'transparent', border:'none', color:WARN, fontSize:11, fontWeight:700, cursor:'pointer', padding:0 }}>View</button>
      </div>
      <DayStrip/>
      <SlotList/>
    </Sheet>
  );
}

// ─── FRAME 7 · SAVING ───────────────────────────────────────────────────────

function FrameSaving() {
  return (
    <Sheet label="Reschedule · Saving" cta="Reschedule now" ctaIcon="calendar-check" saving>
      <SectionTitle>Pick a new time</SectionTitle>
      <CurrentSlot filled/>
      <TzChip/>
      <DayStrip/>
      <SlotList/>
      <NotifySwitch/>
    </Sheet>
  );
}

// ─── FRAME 8 · ERROR ────────────────────────────────────────────────────────

function FrameError() {
  return (
    <Sheet label="Reschedule · Error" cta="Try again" ctaIcon="rotate-cw">
      <SectionTitle>Pick a new time</SectionTitle>
      <CurrentSlot filled/>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:13, padding:'10px 12px', background:ERR_BG, border:`1px solid ${ERR_LIGHT}`, borderRadius:12 }}>
        <i data-lucide="alert-circle" style={{ width:16, height:16, color:ERR, flexShrink:0 }}/>
        <span style={{ fontSize:11.5, color:ERR, fontWeight:600 }}>Couldn't save the new time — try again</span>
      </div>
      <DayStrip/>
      <SlotList/>
    </Sheet>
  );
}

Object.assign(window, { FrameLoading, FrameSlots, FrameNoAvail, FrameMemberPicker, FrameProposed, FrameConflict, FrameSaving, FrameError });
