// Pantopus — Calendarly · Mark No-Show (modal) — 4 frames
// Archetype: Confirmation dialog (.confirmationDialog — same as EventDetail
// delete). Compact centered white card over a dimmed Booking Detail, max ~280px.
// Host-side; accent follows owner context. Only surfaces after start time.
//
// Frames: 1 default (1:1) · 2 group-select-attendee (checkbox roster) · 3
// submitting (right button spinner, non-dismissible) · 4 error.

const { E, SH } = window;

const AV = { personal:'linear-gradient(135deg,#38bdf8,#0369a1)', business:'linear-gradient(135deg,#a78bfa,#6d28d9)' };
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

function Spinner() { return <span style={{ width:15, height:15, borderRadius:'50%', border:'2.5px solid rgba(255,255,255,0.4)', borderTopColor:'#fff', display:'inline-block', animation:'sh-spin 0.7s linear infinite' }}/>; }

function Modal({ label, children, dialogMax=280 }) {
  return (
    <div style={{ width:300, height:620, borderRadius:40, padding:8, background:'#0b0f17', boxShadow:'0 24px 50px rgba(17,24,39,0.20), 0 0 0 1px rgba(0,0,0,0.12)', flexShrink:0 }} data-screen-label={label}>
      <div style={{ width:'100%', height:'100%', background:E.bg, borderRadius:32, overflow:'hidden', position:'relative', display:'flex', flexDirection:'column', fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div style={{ position:'absolute', top:7, left:'50%', transform:'translateX(-50%)', width:88, height:24, borderRadius:16, background:'#000', zIndex:50 }}/>
        <DarkStatusBar/>
        <div style={{ flex:1, padding:'14px 16px', opacity:0.4 }}>
          <div style={{ height:24 }}><i data-lucide="chevron-left" style={{ width:20, height:20, color:E.fg2 }}/></div>
          <div style={{ fontSize:21, fontWeight:700, color:E.fg1, marginTop:10 }}>Coffee chat</div>
          <div style={{ fontSize:13, color:E.fg2, marginTop:6 }}>Today · 1:00 PM · PT</div>
        </div>
        <div style={{ position:'absolute', inset:0, background:'rgba(17,24,39,0.5)', zIndex:18, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 22px' }}>
          <div style={{ width:'100%', maxWidth:dialogMax, background:E.surface, borderRadius:20, boxShadow:'0 20px 50px rgba(0,0,0,0.3)', padding:'20px 18px 16px', boxSizing:'border-box' }}>{children}</div>
        </div>
        <div style={{ position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)', width:100, height:4, borderRadius:4, background:'rgba(255,255,255,0.5)', zIndex:70 }}/>
      </div>
    </div>
  );
}

function IconDisc() {
  return (
    <div style={{ display:'flex', justifyContent:'center', marginBottom:14 }}>
      <div style={{ width:40, height:40, borderRadius:'50%', background:ERR_BG, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="user-x" style={{ width:20, height:20, color:ERR }}/></div>
    </div>
  );
}

function Title({ children }) { return <h3 style={{ margin:'0 0 8px', fontSize:16.5, fontWeight:700, color:E.fg1, textAlign:'center', letterSpacing:-0.2 }}>{children}</h3>; }
function Body({ children }) { return <p style={{ margin:'0 0 16px', fontSize:13, color:E.fg2, textAlign:'center', lineHeight:'19px' }}>{children}</p>; }

function Buttons({ confirmLabel='Mark no-show', submitting }) {
  return (
    <div style={{ display:'flex', gap:9 }}>
      <button disabled={submitting} style={{ flex:1, height:44, borderRadius:12, border:`1px solid ${E.borderStrong}`, background:E.surface, color:E.fg2, fontSize:13.5, fontWeight:700, cursor:submitting?'default':'pointer', opacity:submitting?0.5:1 }}>Keep open</button>
      <button disabled={submitting} style={{ flex:1, height:44, borderRadius:12, border:'none', background:ERR, color:'#fff', fontSize:13.5, fontWeight:700, cursor:submitting?'default':'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7 }}>
        {submitting ? <Spinner/> : confirmLabel}
      </button>
    </div>
  );
}

function AttendeeCheck({ initials, name, checked }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 9px', borderRadius:11, background: checked?ERR_BG:E.surface, border:`1px solid ${checked?ERR_LIGHT:E.border}` }}>
      <div style={{ width:30, height:30, borderRadius:'50%', background:AV.personal, color:'#fff', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{initials}</div>
      <span style={{ flex:1, fontSize:13, fontWeight:600, color:E.fg1 }}>{name}</span>
      <div style={{ width:21, height:21, borderRadius:6, background: checked?ERR:E.surface, border:`1.5px solid ${checked?ERR:E.borderStrong}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{checked && <i data-lucide="check" style={{ width:13, height:13, color:'#fff', strokeWidth:3 }}/>}</div>
    </div>
  );
}

// ─── FRAME 1 · DEFAULT (1:1) ────────────────────────────────────────────────

function FrameDefault() {
  return (
    <Modal label="Mark no-show · 1:1">
      <IconDisc/>
      <Title>Mark as no-show?</Title>
      <Body>This closes the booking. You can still message the invitee or send a rebook link afterward.</Body>
      <Buttons/>
    </Modal>
  );
}

// ─── FRAME 2 · GROUP SELECT ATTENDEE ────────────────────────────────────────

function FrameGroup() {
  return (
    <Modal label="Mark no-show · Group" dialogMax={284}>
      <IconDisc/>
      <Title>Who didn't show?</Title>
      <p style={{ margin:'0 0 13px', fontSize:12.5, color:E.fg3, textAlign:'center', lineHeight:'17px' }}>Select the attendees who didn't attend.</p>
      <div style={{ display:'flex', flexDirection:'column', gap:7, marginBottom:13 }}>
        <AttendeeCheck initials="JL" name="Jordan Liu" checked/>
        <AttendeeCheck initials="SN" name="Sam Nguyen" checked/>
        <AttendeeCheck initials="BD" name="Bea Dunn"/>
      </div>
      <div style={{ marginBottom:14, width:'100%', minHeight:38, boxSizing:'border-box', padding:'9px 12px', background:E.sunken, border:`1px solid ${E.border}`, borderRadius:8, fontSize:12, color:E.fg4 }}>Add a note (optional)</div>
      <Buttons confirmLabel="Mark 2 as no-show"/>
    </Modal>
  );
}

// ─── FRAME 3 · SUBMITTING ───────────────────────────────────────────────────

function FrameSubmitting() {
  return (
    <Modal label="Mark no-show · Submitting">
      <IconDisc/>
      <Title>Mark as no-show?</Title>
      <Body>This closes the booking. You can still message the invitee or send a rebook link afterward.</Body>
      <Buttons submitting/>
    </Modal>
  );
}

// ─── FRAME 4 · ERROR ────────────────────────────────────────────────────────

function FrameError() {
  return (
    <Modal label="Mark no-show · Error">
      <IconDisc/>
      <Title>Mark as no-show?</Title>
      <Body>This closes the booking. You can still message the invitee or send a rebook link afterward.</Body>
      <div style={{ display:'flex', alignItems:'center', gap:7, justifyContent:'center', marginBottom:13, padding:'8px 10px', background:ERR_BG, border:`1px solid ${ERR_LIGHT}`, borderRadius:10 }}>
        <i data-lucide="alert-circle" style={{ width:14, height:14, color:ERR, flexShrink:0 }}/>
        <span style={{ fontSize:11.5, color:ERR, fontWeight:600 }}>Couldn't update — try again</span>
      </div>
      <Buttons/>
    </Modal>
  );
}

Object.assign(window, { FrameDefault, FrameGroup, FrameSubmitting, FrameError });
