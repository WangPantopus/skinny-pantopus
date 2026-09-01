// Pantopus — Calendarly · Unavailable / Expired / Paused / Secret states — 6 frames
// Archetype: ONE status-driven terminal screen. Reuses publicShare.ts's
// "not shareable" / notFound rendering from support-trains/[id]/page.tsx — a
// SINGLE component whose icon, headline, and body switch on the HTTP status
// code. This is one route with a status switch — NOT separate routes per state.
//
// Lives in: any booking/manage/poll route returning 403/404/410/closed, expired
// manage tokens, and the invitee landing when a host has paused. Mirrors the
// Support Train public "not shareable" layout (centered icon halo, reason
// headline, one-line body, Back-to-Pantopus + Get-the-app dock) and the A18
// empty/error halo. Neutral chrome; pillar color only on the Get-the-app CTA.
// Lucide stroke-2, no emoji. Copy is plainspoken, neutral, no blame.
//
// Statuses: not-found (404) · private/secret (403) · expired (410) ·
// host-paused · fully-booked · booking-already-cancelled.

const { E } = window;

const PILLAR = E.blue600;

// One config map — the only thing that changes per status.
const STATUS = {
  notFound:    { label:'404 · Not found',         icon:'search-x',     title:"We can't find that page",      body:'The link may be mistyped, or this page no longer exists.' },
  private:     { label:'403 · Private link',       icon:'lock',         title:'This is a private link',       body:'Ask the host for the right link, or enter your access code below.' },
  expired:     { label:'410 · Expired',            icon:'clock',        title:'This link has expired',        body:'For your security, these links stop working after a while.' },
  paused:      { label:'Host paused',              icon:'pause-circle', title:'Bookings are paused',          body:"Maria isn't taking new bookings at the moment." },
  fullyBooked: { label:'No availability',          icon:'calendar-x',   title:'No times are open right now',   body:'Every slot is taken for now — new times open up regularly.' },
  cancelled:   { label:'Booking cancelled',        icon:'x-circle',     title:'This booking was cancelled',    body:'The slot was released. Nothing further is owed.' },
};

// ─── Phone shell ────────────────────────────────────────────────────────────

function DarkStatusBar() {
  const c = E.fg1;
  return (
    <div style={{
      display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'12px 22px 0', height:34, boxSizing:'border-box', flexShrink:0,
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

function TopBar() {
  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'center', padding:'6px 8px', height:46, boxSizing:'border-box',
      background:E.surface, borderBottom:`1px solid ${E.border}`, flexShrink:0,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:7 }}>
        <div style={{ width:18, height:18, borderRadius:'50%', background:`linear-gradient(135deg,${E.blue600},${E.blue700})`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="11" height="11" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8.5" stroke="#fff" strokeOpacity="0.35" strokeWidth="1"/><circle cx="10" cy="10" r="5" stroke="#fff" strokeWidth="1.4"/><circle cx="10" cy="10" r="1.6" fill="#fff"/></svg>
        </div>
        <span style={{ fontSize:13.5, fontWeight:700, color:E.fg1, letterSpacing:-0.2 }}>Pantopus</span>
      </div>
    </div>
  );
}

function Phone({ label, children, dock }) {
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
        <DarkStatusBar/>
        <TopBar/>
        <div style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'20px 22px', gap:16 }}>
          {children}
        </div>
        {dock}
        <div style={{ position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)', width:100, height:4, borderRadius:4, background:'rgba(0,0,0,0.22)', zIndex:70 }}/>
      </div>
    </div>
  );
}

// ─── Shared chrome pieces ───────────────────────────────────────────────────

function IconHalo({ icon }) {
  return (
    <div style={{ width:84, height:84, borderRadius:'50%', background:E.sunken, color:E.fg3, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      <i data-lucide={icon} style={{ width:36, height:36, strokeWidth:1.8 }}/>
    </div>
  );
}

function HeadBody({ title, body }) {
  return (
    <div>
      <h2 style={{ margin:0, fontSize:19, fontWeight:700, color:E.fg1, letterSpacing:-0.3, lineHeight:'24px' }}>{title}</h2>
      <p style={{ margin:'8px 0 0', fontSize:12.5, color:E.fg3, lineHeight:'18px', maxWidth:230, letterSpacing:-0.03 }}>{body}</p>
    </div>
  );
}

// Shared dock — identical chrome on every status.
function Dock({ children }) {
  return (
    <div style={{
      position:'absolute', left:0, right:0, bottom:0, zIndex:15,
      background:E.surface, borderTop:`1px solid ${E.border}`, padding:'12px 16px 20px',
      display:'flex', flexDirection:'column', gap:8,
    }}>
      {children}
      <button style={{
        width:'100%', height:46, borderRadius:12, border:'none', cursor:'pointer',
        background:PILLAR, color:'#fff', fontSize:14, fontWeight:700, letterSpacing:-0.1,
        boxShadow:'0 6px 16px rgba(2,132,199,0.28)', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7,
      }}>
        <i data-lucide="smartphone" style={{ width:16, height:16, strokeWidth:2.2 }}/>Get the app
      </button>
      <button style={{ width:'100%', height:40, background:'transparent', border:'none', cursor:'pointer', color:E.fg2, fontSize:13, fontWeight:600, letterSpacing:-0.05 }}>Back to Pantopus</button>
    </div>
  );
}

// ─── Per-status affordances (extra content blocks) ──────────────────────────

function CodeInput() {
  return (
    <div style={{ width:'100%', maxWidth:236 }}>
      <div style={{ fontSize:11, fontWeight:600, color:E.fg3, marginBottom:7, letterSpacing:-0.03 }}>Have a code?</div>
      <div style={{ display:'flex', gap:8 }}>
        <div style={{ flex:1, display:'flex', alignItems:'center', height:42, padding:'0 12px', background:E.surface, border:`1px solid ${E.border}`, borderRadius:8, boxShadow:'0 1px 2px rgba(0,0,0,0.03)' }}>
          <span style={{ fontSize:13, color:E.fg4, letterSpacing:0.1, fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace' }}>Enter access code</span>
        </div>
        <button aria-label="Submit code" style={{ width:42, height:42, borderRadius:8, flexShrink:0, border:'none', cursor:'pointer', background:E.blue50, color:PILLAR, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <i data-lucide="arrow-right" style={{ width:17, height:17, strokeWidth:2.3 }}/>
        </button>
      </div>
    </div>
  );
}

function SecondaryButton({ icon, label }) {
  return (
    <button style={{
      height:42, padding:'0 16px', borderRadius:10, cursor:'pointer',
      background:E.surface, border:`1px solid ${E.borderStrong}`, color:E.fg1, fontSize:12.5, fontWeight:700, letterSpacing:-0.05,
      display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7,
    }}>
      <i data-lucide={icon} style={{ width:14, height:14, strokeWidth:2.1 }}/>{label}
    </button>
  );
}

function PausedCard() {
  return (
    <div style={{ width:'100%', maxWidth:240, background:E.sunken, border:`1px solid ${E.border}`, borderRadius:14, padding:'13px 14px', textAlign:'left' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
        <div style={{ width:24, height:24, borderRadius:'50%', background:`linear-gradient(135deg,#38bdf8,#0369a1)`, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:9, fontWeight:700 }}>MK</div>
        <span style={{ fontSize:11, fontWeight:700, color:E.fg2, letterSpacing:-0.05 }}>A note from Maria</span>
      </div>
      <p style={{ margin:0, fontSize:12, color:E.fg2, lineHeight:'17px', fontStyle:'italic', letterSpacing:-0.03 }}>
        "Out of office for a bit — back to taking bookings soon. Thanks for your patience."
      </p>
      <div style={{ display:'inline-flex', alignItems:'center', gap:6, marginTop:10, padding:'4px 10px', borderRadius:9999, background:E.surface, border:`1px solid ${E.border}`, color:E.fg2, fontSize:11, fontWeight:600 }}>
        <i data-lucide="calendar" style={{ width:12, height:12, color:E.fg3 }}/>Reopens Jun 20
      </div>
    </div>
  );
}

function CancelledLink() {
  return (
    <button style={{ display:'inline-flex', alignItems:'center', gap:6, background:'transparent', border:'none', padding:'2px 2px', cursor:'pointer', color:PILLAR, fontSize:13, fontWeight:700, letterSpacing:-0.05, whiteSpace:'nowrap' }}>
      <i data-lucide="rotate-ccw" style={{ width:14, height:14, strokeWidth:2.3 }}/>Book again
    </button>
  );
}

// ─── The single status-driven screen ────────────────────────────────────────

function TerminalState({ status }) {
  const s = STATUS[status];
  let extra = null;
  let dockExtra = null;

  if (status === 'private') extra = <CodeInput/>;
  if (status === 'expired') dockExtra = <SecondaryButton icon="mail" label="Request a new link"/>;
  if (status === 'paused') {
    extra = <PausedCard/>;
    dockExtra = <SecondaryButton icon="bell" label="Notify me when it reopens"/>;
  }
  if (status === 'fullyBooked') dockExtra = <SecondaryButton icon="bell" label="Notify me when times open"/>;
  if (status === 'cancelled') extra = <CancelledLink/>;

  return (
    <Phone label={`Unavailable · ${s.label}`} dock={<Dock>{dockExtra}</Dock>}>
      <IconHalo icon={s.icon}/>
      <HeadBody title={s.title} body={s.body}/>
      {extra}
    </Phone>
  );
}

function FrameNotFound()    { return <TerminalState status="notFound"/>; }
function FramePrivate()     { return <TerminalState status="private"/>; }
function FrameExpired()     { return <TerminalState status="expired"/>; }
function FramePaused()      { return <TerminalState status="paused"/>; }
function FrameFullyBooked() { return <TerminalState status="fullyBooked"/>; }
function FrameCancelled()   { return <TerminalState status="cancelled"/>; }

Object.assign(window, {
  TerminalState, FrameNotFound, FramePrivate, FrameExpired, FramePaused, FrameFullyBooked, FrameCancelled,
});
