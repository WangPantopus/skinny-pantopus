// Pantopus — Calendarly · Waitlist Join & Waitlist Management — 7 frames
// Archetype: Bottom sheet (invitee join, CloseTrainSheet shell) + ListOfRows
// with ManageTrain capacity header (host promote). Invitee (host-branded) for
// join; owner-polymorphic for the host view.
//
// Frames: 1 invitee join · 2 invitee joined-confirmation · 3 invitee already-on-
// waitlist · 4 host list (capacity open, promote enabled) · 5 host capacity-full
// (promote disabled) · 6 loading · 7 error.

const { E, SH } = window;

const ID = { business:{color:'#7c3aed', bg:'#f3e8ff'} };
const AV = { business:'linear-gradient(135deg,#a78bfa,#6d28d9)' };
const ACCENT = '#7c3aed';
const ERR = '#DC2626', ERR_BG = '#FEF2F2', ERR_LIGHT = '#FCA5A5';
const SUCCESS = '#059669', SUCCESS_DK='#047857', SUCCESS_LIGHT='#A7F3D0', SUCCESS_BG='#F0FDF4';
const WARN = '#B45309', WARN_BG='#FFFBEB', WARN_LIGHT='#FDE68A';
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

// Invitee-facing sheet (host-branded public booking page behind)
function JoinSheet({ label, children, cta, ctaIcon, ctaTone }) {
  return (
    <div style={{ width:300, height:620, borderRadius:40, padding:8, background:'#0b0f17', boxShadow:'0 24px 50px rgba(17,24,39,0.20), 0 0 0 1px rgba(0,0,0,0.12)', flexShrink:0 }} data-screen-label={label}>
      <div style={{ width:'100%', height:'100%', background:'#faf9fc', borderRadius:32, overflow:'hidden', position:'relative', display:'flex', flexDirection:'column', fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div style={{ position:'absolute', top:7, left:'50%', transform:'translateX(-50%)', width:88, height:24, borderRadius:16, background:'#000', zIndex:50 }}/>
        <DarkStatusBar/>
        {/* host-branded public page behind */}
        <div style={{ flex:1, padding:'16px', opacity:0.4 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:42, height:42, borderRadius:'50%', background:AV.business, color:'#fff', fontSize:14, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>AS</div>
            <div><div style={{ fontSize:14, fontWeight:700, color:E.fg1 }}>Acme Studio</div><div style={{ fontSize:11, color:E.fg3 }}>Group class · 60 min</div></div>
          </div>
        </div>
        <div style={{ position:'absolute', inset:0, background:'rgba(17,24,39,0.42)', zIndex:18 }}/>
        <div style={{ position:'absolute', left:0, right:0, bottom:0, zIndex:20, background:E.surface, borderTopLeftRadius:24, borderTopRightRadius:24, boxShadow:'0 -8px 30px rgba(0,0,0,0.18)', maxHeight:'90%', display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', justifyContent:'center', paddingTop:9, paddingBottom:4, flexShrink:0 }}><div style={{ width:36, height:5, borderRadius:9999, background:E.borderStrong }}/></div>
          <div style={{ flex:1, overflow:'auto', padding:'6px 18px 14px' }}>{children}</div>
          {cta && (
            <div style={{ flexShrink:0, padding:'10px 18px 20px', borderTop:`1px solid ${E.border}`, background:E.surface }}>
              <button style={{ width:'100%', height:48, borderRadius:13, border: ctaTone==='ghost'?`1px solid ${E.borderStrong}`:'none', background: ctaTone==='ghost'?E.surface:ACCENT, color: ctaTone==='ghost'?E.fg1:'#fff', fontSize:14.5, fontWeight:700, cursor:'pointer', boxShadow: ctaTone==='ghost'?'none':'0 6px 16px rgba(124,58,237,0.28)', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8 }}>{ctaIcon && <i data-lucide={ctaIcon} style={{ width:17, height:17 }}/>}{cta}</button>
            </div>
          )}
        </div>
        <div style={{ position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)', width:100, height:4, borderRadius:4, background:'rgba(255,255,255,0.5)', zIndex:70 }}/>
      </div>
    </div>
  );
}

// Host management — full screen
function HostPhone({ label, children }) {
  return (
    <div style={{ width:300, height:620, borderRadius:40, padding:8, background:'#0b0f17', boxShadow:'0 24px 50px rgba(17,24,39,0.20), 0 0 0 1px rgba(0,0,0,0.12)', flexShrink:0 }} data-screen-label={label}>
      <div style={{ width:'100%', height:'100%', background:E.bg, borderRadius:32, overflow:'hidden', position:'relative', display:'flex', flexDirection:'column', fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div style={{ position:'absolute', top:7, left:'50%', transform:'translateX(-50%)', width:88, height:24, borderRadius:16, background:'#000', zIndex:50 }}/>
        <DarkStatusBar/>
        <div style={{ display:'flex', alignItems:'center', padding:'6px 8px', height:46, boxSizing:'border-box', background:E.surface, borderBottom:`1px solid ${E.border}`, flexShrink:0 }}>
          <button aria-label="Back" style={{ width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'none', cursor:'pointer', color:E.fg1, padding:0 }}><i data-lucide="chevron-left" style={{ width:21, height:21 }}/></button>
          <div style={{ flex:1, textAlign:'center', fontSize:15.5, fontWeight:600, color:E.fg1 }}>Waitlist</div>
          <div style={{ width:34 }}/>
        </div>
        <div style={{ flex:1, overflow:'auto', padding:'12px 14px 20px' }}>{children}</div>
        <div style={{ position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)', width:100, height:4, borderRadius:4, background:'rgba(0,0,0,0.22)', zIndex:70 }}/>
      </div>
    </div>
  );
}

function TzChip() {
  return <button style={{ display:'inline-flex', alignItems:'center', gap:6, height:28, padding:'0 11px', borderRadius:9999, border:`1px solid ${E.border}`, background:E.surface, cursor:'pointer', fontSize:11, fontWeight:600, color:E.fg2 }}><i data-lucide="globe" style={{ width:13, height:13 }}/>Times in Pacific · tap to change</button>;
}

function Field({ label, placeholder, icon }) {
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ fontSize:10.5, fontWeight:700, color:E.fg3, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
      <div style={{ display:'flex', alignItems:'center', gap:9, padding:'0 12px', height:44, background:E.sunken, border:`1px solid ${E.border}`, borderRadius:8 }}>
        {icon && <i data-lucide={icon} style={{ width:16, height:16, color:E.fg4 }}/>}<span style={{ fontSize:13, color:E.fg4 }}>{placeholder}</span>
      </div>
    </div>
  );
}

function CapacityHeader({ filled, total, waiting, full }) {
  const pct = Math.round((filled/total)*100);
  return (
    <div style={{ background:E.surface, border:`1px solid ${E.border}`, borderRadius:16, boxShadow:'0 1px 3px rgba(0,0,0,0.04)', padding:'13px 14px', marginBottom:4 }}>
      <div style={{ fontSize:14, fontWeight:700, color:E.fg1, marginBottom:9 }}>{filled} of {total} seats filled · {waiting} waiting</div>
      <div style={{ height:9, borderRadius:9999, background:E.sunken, overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background: full?E.fg4:ACCENT, borderRadius:9999 }}/>
      </div>
    </div>
  );
}

function Overline({ children }) { return <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:E.fg3, margin:'15px 4px 8px' }}>{children}</div>; }

function WaitRow({ initials, name, meta, disabled }) {
  return (
    <div style={{ background:E.surface, border:`1px solid ${E.border}`, borderRadius:14, boxShadow:'0 1px 3px rgba(0,0,0,0.04)', padding:'10px 12px', display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ display:'flex', alignItems:'center', gap:11 }}>
        <div style={{ width:36, height:36, borderRadius:'50%', background:AV.business, color:'#fff', fontSize:12.5, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{initials}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:700, color:E.fg1 }}>{name}</div>
          <div style={{ fontSize:10.5, color:E.fg3, marginTop:2 }}>{meta}</div>
        </div>
        <button aria-label="Row actions" style={{ width:22, height:22, display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'none', cursor:'pointer', color:E.fg4, padding:0 }}><i data-lucide="more-vertical" style={{ width:16, height:16 }}/></button>
      </div>
      <button disabled={disabled} style={{ width:'100%', height:34, borderRadius:9, border:'none', cursor:disabled?'default':'pointer', background: disabled?E.sunken:ID.business.bg, color: disabled?E.fg4:ACCENT, fontSize:12, fontWeight:700, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6 }}><i data-lucide="arrow-up" style={{ width:14, height:14 }}/>Promote to seat</button>
      {disabled && <div style={{ fontSize:10, color:E.fg4, marginTop:-4, textAlign:'center' }}>Open a seat to promote</div>}
    </div>
  );
}

// ─── FRAME 1 · INVITEE JOIN ─────────────────────────────────────────────────

function FrameJoin() {
  return (
    <JoinSheet label="Waitlist · Invitee join" cta="Join waitlist" ctaIcon="user-plus">
      <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 10px', background:WARN_BG, border:`1px solid ${WARN_LIGHT}`, borderRadius:9999, marginBottom:12 }}>
        <i data-lucide="users-round" style={{ width:13, height:13, color:WARN }}/><span style={{ fontSize:11, fontWeight:700, color:WARN }}>Fully booked</span>
      </div>
      <div style={{ fontSize:16.5, fontWeight:700, color:E.fg1, letterSpacing:-0.2 }}>Sat, Jun 14 · 10:00 AM</div>
      <div style={{ fontSize:12.5, color:E.fg3, marginTop:8, lineHeight:'18px', marginBottom:16 }}>Join the waitlist and we'll text you the moment a spot opens.</div>
      <div style={{ marginBottom:14 }}><TzChip/></div>
      <Field label="Your name" placeholder="Full name" icon="user"/>
      <Field label="Mobile" placeholder="For a text when a spot opens" icon="phone"/>
      <div style={{ marginBottom:4 }}>
        <div style={{ fontSize:10.5, fontWeight:700, color:E.fg3, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>Preferred time</div>
        <div style={{ width:'100%', minHeight:42, boxSizing:'border-box', padding:'10px 12px', background:E.sunken, border:`1px solid ${E.border}`, borderRadius:8, fontSize:12, color:E.fg4 }}>Any morning works (optional)</div>
      </div>
    </JoinSheet>
  );
}

// ─── FRAME 2 · JOINED CONFIRMATION ──────────────────────────────────────────

function FrameJoined() {
  return (
    <JoinSheet label="Waitlist · Joined" cta="Leave waitlist" ctaTone="ghost">
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', padding:'24px 10px 8px', gap:16 }}>
        <div style={{ width:74, height:74, borderRadius:'50%', background:SUCCESS_BG, border:`1px solid ${SUCCESS_LIGHT}`, color:SUCCESS, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="check" style={{ width:34, height:34, strokeWidth:2.6 }}/></div>
        <div>
          <div style={{ fontSize:17.5, fontWeight:700, color:E.fg1, letterSpacing:-0.2 }}>You're on the waitlist</div>
          <div style={{ fontSize:13, color:E.fg3, marginTop:8, maxWidth:220, lineHeight:'19px' }}>You're #3 — we'll text you if a spot frees up.</div>
        </div>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'8px 14px', background:ID.business.bg, borderRadius:11 }}>
          <span style={{ fontSize:13, fontWeight:800, color:ACCENT }}>#3</span><span style={{ fontSize:11.5, color:E.fg2, fontWeight:600 }}>in line</span>
        </div>
      </div>
    </JoinSheet>
  );
}

// ─── FRAME 3 · ALREADY ON WAITLIST ──────────────────────────────────────────

function FrameAlready() {
  return (
    <JoinSheet label="Waitlist · Already joined" cta="Leave waitlist" ctaTone="ghost">
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', padding:'24px 10px 8px', gap:16 }}>
        <div style={{ width:74, height:74, borderRadius:'50%', background:ID.business.bg, color:ACCENT, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="clock" style={{ width:32, height:32, strokeWidth:1.8 }}/></div>
        <div>
          <div style={{ fontSize:17, fontWeight:700, color:E.fg1, letterSpacing:-0.2 }}>You're already waiting</div>
          <div style={{ fontSize:13, color:E.fg3, marginTop:8, maxWidth:220, lineHeight:'19px' }}>You joined this waitlist on Jun 11. We'll text you the moment a seat opens.</div>
        </div>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'8px 14px', background:ID.business.bg, borderRadius:11 }}>
          <span style={{ fontSize:13, fontWeight:800, color:ACCENT }}>#3</span><span style={{ fontSize:11.5, color:E.fg2, fontWeight:600 }}>in line</span>
        </div>
      </div>
    </JoinSheet>
  );
}

// ─── FRAME 4 · HOST LIST (capacity open) ────────────────────────────────────

function FrameHostOpen() {
  return (
    <HostPhone label="Waitlist · Host promote">
      <CapacityHeader filled={11} total={12} waiting={3}/>
      <Overline>1 seat open · promote available</Overline>
      <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
        <WaitRow initials="RC" name="Rosa Calderón" meta="#1 · joined Jun 11"/>
        <WaitRow initials="SN" name="Sam Nguyen" meta="#2 · joined Jun 12"/>
        <WaitRow initials="BD" name="Bea Dunn" meta="#3 · joined Jun 12"/>
      </div>
    </HostPhone>
  );
}

// ─── FRAME 5 · HOST CAPACITY FULL ───────────────────────────────────────────

function FrameHostFull() {
  return (
    <HostPhone label="Waitlist · Capacity full">
      <CapacityHeader filled={12} total={12} waiting={3} full/>
      <Overline>All seats filled</Overline>
      <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
        <WaitRow initials="RC" name="Rosa Calderón" meta="#1 · joined Jun 11" disabled/>
        <WaitRow initials="SN" name="Sam Nguyen" meta="#2 · joined Jun 12" disabled/>
        <WaitRow initials="BD" name="Bea Dunn" meta="#3 · joined Jun 12" disabled/>
      </div>
    </HostPhone>
  );
}

// ─── FRAME 6 · LOADING ──────────────────────────────────────────────────────

function FrameLoading() {
  const SkRow = () => (
    <div style={{ background:E.surface, border:`1px solid ${E.border}`, borderRadius:14, boxShadow:'0 1px 3px rgba(0,0,0,0.04)', padding:'10px 12px', display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ display:'flex', alignItems:'center', gap:11 }}>
        <div style={{ width:36, height:36, borderRadius:'50%', flexShrink:0, ...SH }}/>
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6 }}><div style={{ width:'55%', height:10, borderRadius:5, ...SH }}/><div style={{ width:'35%', height:8, borderRadius:5, ...SH }}/></div>
      </div>
      <div style={{ width:'100%', height:34, borderRadius:9, ...SH }}/>
    </div>
  );
  return (
    <HostPhone label="Waitlist · Loading">
      <div style={{ height:74, borderRadius:16, marginBottom:4, ...SH }}/>
      <div style={{ width:120, height:9, borderRadius:5, margin:'15px 4px 8px', ...SH }}/>
      <div style={{ display:'flex', flexDirection:'column', gap:9 }}><SkRow/><SkRow/><SkRow/></div>
    </HostPhone>
  );
}

// ─── FRAME 7 · ERROR ────────────────────────────────────────────────────────

function FrameError() {
  return (
    <HostPhone label="Waitlist · Error">
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'80px 30px', gap:18 }}>
        <div style={{ width:72, height:72, borderRadius:'50%', background:ERR_BG, color:ERR, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="cloud-off" style={{ width:32, height:32, strokeWidth:1.8 }}/></div>
        <div>
          <div style={{ fontSize:16.5, fontWeight:700, color:E.fg1 }}>Couldn't load the waitlist</div>
          <div style={{ fontSize:12.5, color:E.fg3, marginTop:7, maxWidth:210 }}>Check your connection and try again.</div>
        </div>
        <button style={{ height:44, padding:'0 18px', borderRadius:12, border:`1px solid ${E.borderStrong}`, cursor:'pointer', background:E.surface, color:E.fg1, fontSize:13.5, fontWeight:700, display:'inline-flex', alignItems:'center', gap:7 }}><i data-lucide="rotate-cw" style={{ width:16, height:16 }}/>Try again</button>
      </div>
    </HostPhone>
  );
}

Object.assign(window, { FrameJoin, FrameJoined, FrameAlready, FrameHostOpen, FrameHostFull, FrameLoading, FrameError });
