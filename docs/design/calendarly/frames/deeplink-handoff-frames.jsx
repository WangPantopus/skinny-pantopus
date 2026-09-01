// Pantopus — Calendarly · Open-in-App / Booking deep-link hand-off — 5 frames
// Archetype: Continue-in-app interstitial + web smart-banner. Extends
// DeepLinkRouter with NEW booking routes (pantopus://book/... and /manage) so an
// app-having invitee lands in the native flow with identity, timezone, and saved
// details — instead of a degraded signed-out web flow.
//
// Two surfaces in one file. (A) Web smart-banner strip over a dimmed public
// booking page. (B) Native continue-in-app interstitial. Mirrors the A18 Verify
// Email landing interstitial (resolving/continue), the public web app-banner
// strip, and Token Accept's link-resolution + fallback routing. Host pillar =
// Personal sky on the Continue-in-app primary; neutral resolving chrome. Lucide
// stroke-2, no emoji. Voice: plainspoken, second person, sentence case.
//
// Frames: web smart-banner · native resolving (skeleton) · resolved continue-in-
// app · resolve-failed (fallback to web) · stay-on-web (banner collapses).

const { E, SH } = window;

const PILLAR = E.blue600;
const WARN = '#D97706', WARN_DK = '#92400E', WARN_BG = '#FFFBEB', WARN_RING = '#FDE68A';
const HOST_AV = 'linear-gradient(135deg,#38bdf8,#0369a1)';

// ─── Shell ──────────────────────────────────────────────────────────────────

function DarkStatusBar({ onLight }) {
  const c = E.fg1;
  return (
    <div style={{
      display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'12px 22px 0', height:34, boxSizing:'border-box', flexShrink:0, position:'relative', zIndex:30,
      fontFamily:'-apple-system, system-ui', fontWeight:600, fontSize:12.5, color:c,
    }}>
      <span>9:41</span>
      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
        <svg width="15" height="10" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={c}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={c}/><rect x="9" y="2" width="3" height="9" rx="0.6" fill={c}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={c}/></svg>
        <svg width="13" height="10" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={c}/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={c}/><circle cx="7.5" cy="9" r="1.3" fill={c}/></svg>
        <svg width="21" height="10" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={c} strokeOpacity="0.35" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill={c}/><path d="M22.5 3.8v3.4c.6-.2 1-.8 1-1.7s-.4-1.5-1-1.7z" fill={c} fillOpacity="0.4"/></svg>
      </div>
    </div>
  );
}

function Phone({ label, children }) {
  return (
    <div style={{
      width:300, height:620, borderRadius:40, padding:8, background:'#0b0f17',
      boxShadow:'0 24px 50px rgba(17,24,39,0.20), 0 0 0 1px rgba(0,0,0,0.12)', flexShrink:0,
    }} data-screen-label={label}>
      <div style={{
        width:'100%', height:'100%', background:E.bg, borderRadius:32,
        overflow:'hidden', position:'relative', display:'flex', flexDirection:'column',
        fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{ position:'absolute', top:7, left:'50%', transform:'translateX(-50%)', width:88, height:24, borderRadius:16, background:'#000', zIndex:50 }}/>
        {children}
        <div style={{ position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)', width:100, height:4, borderRadius:4, background:'rgba(0,0,0,0.22)', zIndex:70 }}/>
      </div>
    </div>
  );
}

function PantopusMark({ size = 30 }) {
  return (
    <div style={{ width:size, height:size, borderRadius:size*0.28, background:`linear-gradient(135deg,${E.blue600},${E.blue700})`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 3px 8px rgba(2,132,199,0.28)' }}>
      <svg width={size*0.62} height={size*0.62} viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8.5" stroke="#fff" strokeOpacity="0.35" strokeWidth="1"/><circle cx="10" cy="10" r="5" stroke="#fff" strokeWidth="1.4"/><circle cx="10" cy="10" r="1.6" fill="#fff"/></svg>
    </div>
  );
}

// ─── Web booking page backdrop (dimmed behind the banner) ───────────────────

function BookingBackdrop({ dim }) {
  return (
    <div style={{ flex:1, overflow:'hidden', padding:'14px 14px', display:'flex', flexDirection:'column', gap:12, opacity: dim ? 0.55 : 1, filter: dim ? 'saturate(0.95)' : 'none' }}>
      <div style={{ display:'flex', alignItems:'center', gap:11 }}>
        <div style={{ width:46, height:46, borderRadius:'50%', background:HOST_AV, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:15, fontWeight:700 }}>DL</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:15, fontWeight:700, color:E.fg1, letterSpacing:-0.2 }}>Dr. Lee</div>
          <div style={{ fontSize:11.5, color:E.fg3, marginTop:2 }}>Book a time</div>
        </div>
      </div>
      <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:E.fg3, marginTop:2 }}>Choose a visit</div>
      {[['Consultation', '30 min · $120'], ['Follow-up', '20 min · $80'], ['Lab review', '15 min']].map(([n, d], i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:11, padding:'12px 13px', background:E.surface, border:`1px solid ${E.border}`, borderRadius:14, boxShadow:'0 1px 2px rgba(0,0,0,0.03)' }}>
          <div style={{ width:34, height:34, borderRadius:9, flexShrink:0, background:E.blue50, color:PILLAR, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="video" style={{ width:16, height:16 }}/></div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:700, color:E.fg1, letterSpacing:-0.1 }}>{n}</div>
            <div style={{ fontSize:11, color:E.fg3, marginTop:1 }}>{d}</div>
          </div>
          <i data-lucide="chevron-right" style={{ width:16, height:16, color:E.fg4 }}/>
        </div>
      ))}
    </div>
  );
}

// ─── Native interstitial pieces ─────────────────────────────────────────────

function HostAvatar({ size = 64 }) {
  return (
    <div style={{ position:'relative', flexShrink:0 }}>
      <div style={{ width:size, height:size, borderRadius:'50%', background:HOST_AV, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:size*0.34, fontWeight:700, letterSpacing:-0.5, boxShadow:'0 6px 16px rgba(2,132,199,0.22)' }}>DL</div>
      <div style={{ position:'absolute', right:-2, bottom:-2, width:22, height:22, borderRadius:'50%', background:PILLAR, border:'2.5px solid #fff', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <i data-lucide="user" style={{ width:11, height:11, color:'#fff', strokeWidth:2.6 }}/>
      </div>
    </div>
  );
}

function EventPreviewCard() {
  return (
    <div style={{ width:'100%', background:E.surface, border:`1px solid ${E.border}`, borderRadius:14, boxShadow:'0 1px 3px rgba(0,0,0,0.05)', padding:'13px 14px', display:'flex', alignItems:'center', gap:12 }}>
      <div style={{ width:38, height:38, borderRadius:10, flexShrink:0, background:E.blue50, color:PILLAR, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="calendar" style={{ width:18, height:18, strokeWidth:2 }}/></div>
      <div style={{ flex:1, minWidth:0, textAlign:'left' }}>
        <div style={{ fontSize:13.5, fontWeight:700, color:E.fg1, letterSpacing:-0.1 }}>Consultation</div>
        <div style={{ fontSize:11, color:E.fg3, marginTop:2 }}>30 min · $120 · with Dr. Lee</div>
      </div>
    </div>
  );
}

function IdentityLine() {
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'7px 12px', borderRadius:9999, background:E.sunken, border:`1px solid ${E.border}` }}>
      <div style={{ width:18, height:18, borderRadius:'50%', background:'linear-gradient(135deg,#a78bfa,#7c3aed)', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:8, fontWeight:700 }}>MC</div>
      <span style={{ fontSize:11, color:E.fg2, fontWeight:600, letterSpacing:-0.03 }}>Continuing as Maya Chen · times in PT</span>
    </div>
  );
}

function PrimaryCTA({ icon, label }) {
  return (
    <button style={{ width:'100%', height:48, borderRadius:12, border:'none', cursor:'pointer', background:PILLAR, color:'#fff', fontSize:14, fontWeight:700, letterSpacing:-0.1, boxShadow:'0 6px 16px rgba(2,132,199,0.28)', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8 }}>
      <i data-lucide={icon} style={{ width:16, height:16, strokeWidth:2.2 }}/>{label}
    </button>
  );
}

function GhostCTA({ label }) {
  return (
    <button style={{ width:'100%', height:42, background:'transparent', border:'none', cursor:'pointer', color:E.fg2, fontSize:13, fontWeight:600, letterSpacing:-0.05 }}>{label}</button>
  );
}

function Interstitial({ children, dock }) {
  return (
    <React.Fragment>
      <DarkStatusBar/>
      <div style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'20px 24px 8px', gap:18 }}>
        {children}
      </div>
      <div style={{ flexShrink:0, padding:'10px 18px 22px', display:'flex', flexDirection:'column', gap:8 }}>{dock}</div>
    </React.Fragment>
  );
}

// ─── FRAME 1 · WEB SMART-BANNER ─────────────────────────────────────────────

function FrameSmartBanner() {
  return (
    <Phone label="Hand-off · Web smart-banner">
      <DarkStatusBar/>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:E.surface, borderBottom:`1px solid ${E.border}`, boxShadow:'0 2px 8px rgba(17,24,39,0.05)', position:'relative', zIndex:20 }}>
        <button aria-label="Dismiss" style={{ width:20, height:20, flexShrink:0, background:'transparent', border:'none', cursor:'pointer', color:E.fg4, padding:0, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="x" style={{ width:15, height:15 }}/></button>
        <PantopusMark size={32}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12.5, fontWeight:700, color:E.fg1, letterSpacing:-0.1 }}>Open in Pantopus</div>
          <div style={{ fontSize:10.5, color:E.fg3, marginTop:1 }}>Faster, with your saved details</div>
        </div>
        <button style={{ flexShrink:0, height:30, padding:'0 14px', borderRadius:9999, border:'none', cursor:'pointer', background:PILLAR, color:'#fff', fontSize:12, fontWeight:700, letterSpacing:-0.05 }}>Open</button>
      </div>
      <BookingBackdrop/>
    </Phone>
  );
}

// ─── FRAME 2 · NATIVE RESOLVING (skeleton) ──────────────────────────────────

function FrameResolving() {
  return (
    <Phone label="Hand-off · Resolving">
      <Interstitial dock={null}>
        <PantopusMark size={52}/>
        <div style={{ width:'100%', background:E.surface, border:`1px solid ${E.border}`, borderRadius:14, boxShadow:'0 1px 3px rgba(0,0,0,0.05)', padding:'13px 14px', display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:38, height:38, borderRadius:10, flexShrink:0, ...SH }}/>
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:7 }}>
            <div style={{ width:'60%', height:11, borderRadius:5, ...SH }}/>
            <div style={{ width:'80%', height:9, borderRadius:5, ...SH }}/>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
          <span style={{ width:7, height:7, borderRadius:'50%', background:PILLAR, animation:'dlPulse 1.4s ease-in-out infinite' }}/>
          <span style={{ fontSize:12, color:E.fg3, fontWeight:600, letterSpacing:-0.03 }}>Opening your booking</span>
        </div>
      </Interstitial>
    </Phone>
  );
}

// ─── FRAME 3 · RESOLVED — CONTINUE IN APP ───────────────────────────────────

function FrameResolved() {
  return (
    <Phone label="Hand-off · Continue in app">
      <Interstitial dock={<React.Fragment><PrimaryCTA icon="smartphone" label="Continue in app"/><GhostCTA label="Stay on web"/></React.Fragment>}>
        <HostAvatar/>
        <div>
          <h2 style={{ margin:0, fontSize:19, fontWeight:700, color:E.fg1, letterSpacing:-0.3, lineHeight:'24px' }}>Pick up where you left off</h2>
          <p style={{ margin:'8px 0 0', fontSize:12.5, color:E.fg3, lineHeight:'18px', maxWidth:228, letterSpacing:-0.03 }}>Your timezone and details come with you.</p>
        </div>
        <EventPreviewCard/>
        <IdentityLine/>
      </Interstitial>
    </Phone>
  );
}

// ─── FRAME 4 · RESOLVE FAILED (fallback to web) ─────────────────────────────

function FrameFailed() {
  return (
    <Phone label="Hand-off · Resolve failed">
      <Interstitial dock={<React.Fragment><PrimaryCTA icon="arrow-right" label="Continue on the web"/><GhostCTA label="Try the app again"/></React.Fragment>}>
        <div style={{ position:'relative', width:84, height:84, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:WARN_BG, opacity:0.6 }}/>
          <div style={{ position:'relative', width:66, height:66, borderRadius:'50%', background:WARN_BG, border:`2px solid ${WARN_RING}`, display:'flex', alignItems:'center', justifyContent:'center', color:WARN }}>
            <i data-lucide="smartphone" style={{ width:30, height:30, strokeWidth:1.9 }}/>
          </div>
        </div>
        <div>
          <h2 style={{ margin:0, fontSize:19, fontWeight:700, color:E.fg1, letterSpacing:-0.3, lineHeight:'24px' }}>We couldn't open this in the app</h2>
          <p style={{ margin:'8px 0 0', fontSize:12.5, color:E.fg3, lineHeight:'18px', maxWidth:232, letterSpacing:-0.03 }}>No problem — you can keep going on the web. Your booking is right where you left it.</p>
        </div>
      </Interstitial>
    </Phone>
  );
}

// ─── FRAME 5 · STAY ON WEB (banner collapses) ───────────────────────────────

function FrameStayWeb() {
  return (
    <Phone label="Hand-off · Stay on web">
      <DarkStatusBar/>
      {/* collapsed banner — a quiet minimized strip */}
      <div style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 12px', background:E.sunken, borderBottom:`1px solid ${E.border}`, position:'relative', zIndex:20 }}>
        <PantopusMark size={20}/>
        <span style={{ flex:1, fontSize:11, color:E.fg3, fontWeight:600, letterSpacing:-0.03 }}>Continuing on the web</span>
        <button style={{ background:'transparent', border:'none', padding:'2px 2px', cursor:'pointer', color:PILLAR, fontSize:11, fontWeight:700, letterSpacing:-0.03 }}>Open in app</button>
      </div>
      <div style={{ position:'relative', flex:1, overflow:'hidden' }}>
        <BookingBackdrop/>
        {/* quiet confirmation toast */}
        <div style={{ position:'absolute', left:14, right:14, bottom:18, display:'flex', alignItems:'center', gap:9, padding:'11px 13px', background:'#0b0f17', borderRadius:12, boxShadow:'0 8px 24px rgba(17,24,39,0.28)' }}>
          <i data-lucide="check" style={{ width:15, height:15, color:'#fff', flexShrink:0, strokeWidth:2.6 }}/>
          <span style={{ fontSize:11.5, color:'#fff', fontWeight:500, lineHeight:'15px' }}>Staying on the web — you can open the app anytime.</span>
        </div>
      </div>
    </Phone>
  );
}

Object.assign(window, { FrameSmartBanner, FrameResolving, FrameResolved, FrameFailed, FrameStayWeb });
