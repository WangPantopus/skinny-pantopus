// Pantopus — Calendarly · Manage your booking (token-authed) — 6 frames
// Archetype: ContentDetail; reuses TokenAccept's routing/validation shell for
// the token states. Lives at /book/manage/:token (web token view, signed-out)
// and pantopus://book/manage/:token / in-app booking list.
//
// Mirrors A09.4 Invoice's summary-card layout for the booking body, the A18
// status badge + halo for the confirmed/past/cancelled pills and the token-error
// state, and TokenAccept's expired/invalid error anatomy. Host pillar = Personal
// sky on accents; chrome stays neutral. Lucide stroke-2, no emoji.
//
// Frames: confirmed (both actions) · past (read-only) · already-cancelled ·
// reschedule/cancel-window-closed · token-expired/invalid · loading (skeleton).

const { E, SH } = window;

const PILLAR = E.blue600;
const SUCCESS = '#059669', SUCCESS_DK = '#047857', SUCCESS_BG = '#F0FDF4', SUCCESS_RING = '#A7F3D0';
const ERR = E.error, ERR_DK = '#991B1B', ERR_BG = '#FEF2F2', ERR_BORDER = '#FCA5A5';
const WARN = '#B45309', WARN_DK = '#92400E', WARN_BG = '#FFFBEB', WARN_RING = '#FDE68A';
const HOST_AV = 'linear-gradient(135deg,#38bdf8,#0369a1)';

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

function TopBar({ inApp }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', padding:'6px 8px', height:46, boxSizing:'border-box',
      background:E.surface, borderBottom:`1px solid ${E.border}`, flexShrink:0, zIndex:5,
    }}>
      {inApp ? (
        <button aria-label="Back" style={{ width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'none', cursor:'pointer', color:E.fg1, padding:0 }}>
          <i data-lucide="chevron-left" style={{ width:20, height:20 }}/>
        </button>
      ) : <div style={{ width:34 }}/>}
      <div style={{ flex:1, textAlign:'center', fontSize:15, fontWeight:600, color:E.fg1, letterSpacing:-0.2 }}>Your booking</div>
      <div style={{ width:34 }}/>
    </div>
  );
}

function Phone({ label, children, footer }) {
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
        <div style={{
          position:'absolute', top:7, left:'50%', transform:'translateX(-50%)',
          width:88, height:24, borderRadius:16, background:'#000', zIndex:50,
        }}/>
        <DarkStatusBar/>
        <TopBar/>
        <div style={{ flex:1, overflow:'auto', padding:'14px 14px 28px', display:'flex', flexDirection:'column', gap:14 }}>
          {children}
        </div>
        {footer}
        <div style={{
          position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)',
          width:100, height:4, borderRadius:4, background:'rgba(0,0,0,0.22)', zIndex:70,
        }}/>
      </div>
    </div>
  );
}

function Overline({ children }) {
  return <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:E.fg3, marginBottom:9 }}>{children}</div>;
}

// ─── Status badge (A18) ─────────────────────────────────────────────────────

function StatusBadge({ kind }) {
  const map = {
    confirmed: { label:'Confirmed', icon:'check-circle-2', bg:SUCCESS_BG, fg:SUCCESS_DK, bd:SUCCESS_RING },
    past:      { label:'Past',      icon:'history',        bg:E.sunken,   fg:E.fg3,      bd:E.border },
    cancelled: { label:'Cancelled', icon:'x-circle',       bg:ERR_BG,     fg:ERR,        bd:ERR_BORDER },
  }[kind];
  return (
    <div style={{
      display:'inline-flex', alignItems:'center', gap:6, alignSelf:'flex-start',
      padding:'5px 11px 5px 9px', borderRadius:9999, background:map.bg, color:map.fg, border:`1px solid ${map.bd}`,
      fontSize:11.5, fontWeight:700, letterSpacing:-0.02,
    }}>
      <i data-lucide={map.icon} style={{ width:13, height:13, strokeWidth:2.3 }}/>{map.label}
    </div>
  );
}

// ─── Summary card (A09.4 layout) ────────────────────────────────────────────

function Row({ icon, children, last }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 0', borderBottom: last ? 'none' : `1px solid ${E.border}` }}>
      <i data-lucide={icon} style={{ width:15, height:15, color:E.fg3, flexShrink:0, marginTop:1 }}/>
      <div style={{ flex:1, minWidth:0 }}>{children}</div>
    </div>
  );
}

function SummaryCard({ dimmed, struck }) {
  const strikeStyle = struck ? { textDecoration:'line-through', textDecorationColor:E.fg4 } : {};
  return (
    <div style={{
      background:E.surface, border:`1px solid ${E.border}`, borderRadius:16,
      boxShadow:'0 1px 3px rgba(0,0,0,0.04)', padding:'4px 13px', opacity: dimmed ? 0.6 : 1,
    }}>
      <Row icon="user">
        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
          <div style={{ width:30, height:30, borderRadius:'50%', flexShrink:0, background:HOST_AV, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:11, fontWeight:700 }}>MK</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:700, color:E.fg1, letterSpacing:-0.1, ...strikeStyle }}>Intro call</div>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
              <span style={{ fontSize:11, color:E.fg3 }}>Maria Kessler</span>
              <span style={{ width:5, height:5, borderRadius:'50%', background:PILLAR }}/>
              <span style={{ fontSize:9.5, fontWeight:600, color:PILLAR }}>Personal</span>
            </div>
          </div>
        </div>
      </Row>
      <Row icon="calendar">
        <div style={{ fontSize:12.5, fontWeight:600, color:E.fg1, letterSpacing:-0.1, fontVariantNumeric:'tabular-nums', ...strikeStyle }}>Wed, Jun 17 · 9:30&ndash;10:00 AM</div>
        <div style={{ display:'inline-flex', alignItems:'center', gap:6, marginTop:6, padding:'4px 9px', borderRadius:9999, background:E.blue100, color:E.blue700, fontSize:10.5, fontWeight:600 }}>
          <i data-lucide="globe" style={{ width:11, height:11, strokeWidth:2.2 }}/>Pacific time (PDT)
        </div>
      </Row>
      <Row icon="video">
        <div style={{ fontSize:12.5, fontWeight:600, color:E.fg1, letterSpacing:-0.1 }}>Pantopus video</div>
        <div style={{ fontSize:11, color:E.fg3, marginTop:1 }}>Join link is in your email and calendar invite.</div>
      </Row>
      <Row icon="users" last>
        <div style={{ fontSize:12.5, fontWeight:600, color:E.fg1, letterSpacing:-0.1 }}>Maya Chen <span style={{ color:E.fg3, fontWeight:500 }}>(you)</span></div>
        <div style={{ fontSize:11, color:E.fg3, marginTop:1 }}>+ Sam Rivera</div>
      </Row>
    </div>
  );
}

// ─── Action buttons ─────────────────────────────────────────────────────────

function ActionButton({ icon, label, sub, tone = 'neutral', disabled }) {
  const isErr = tone === 'error';
  const border = disabled ? E.border : (isErr ? ERR_BORDER : E.borderStrong);
  const tileBg = disabled ? E.sunken : (isErr ? ERR_BG : E.blue50);
  const tileFg = disabled ? E.fg4 : (isErr ? ERR : PILLAR);
  const labelColor = disabled ? E.fg4 : (isErr ? ERR : E.fg1);
  return (
    <button disabled={disabled} style={{
      width:'100%', display:'flex', alignItems:'center', gap:11, textAlign:'left',
      background:E.surface, border:`1.5px solid ${border}`, borderRadius:12, padding:'11px 12px',
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.75 : 1,
      boxShadow: disabled ? 'none' : '0 1px 2px rgba(0,0,0,0.03)',
    }}>
      <div style={{ width:32, height:32, borderRadius:9, flexShrink:0, background:tileBg, color:tileFg, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <i data-lucide={icon} style={{ width:16, height:16, strokeWidth:2.1 }}/>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:700, color:labelColor, letterSpacing:-0.1 }}>{label}</div>
        <div style={{ fontSize:10.5, color:E.fg3, marginTop:1, lineHeight:'14px' }}>{sub}</div>
      </div>
      {!disabled && <i data-lucide="chevron-right" style={{ width:15, height:15, color:E.fg4, flexShrink:0 }}/>}
    </button>
  );
}

function ActionRegion({ children }) {
  return (
    <div>
      <Overline>Manage</Overline>
      <div style={{ display:'flex', flexDirection:'column', gap:9 }}>{children}</div>
    </div>
  );
}

// ─── Add-to-calendar cluster (RsvpCluster) ──────────────────────────────────

function CalendarCluster() {
  return (
    <div>
      <Overline>Add to your calendar</Overline>
      <div style={{ display:'flex', gap:8 }}>
        {['Google', 'Apple', 'Outlook'].map((it) => (
          <button key={it} style={{
            flex:1, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
            height:38, borderRadius:9999, background:E.surface, border:`1px solid ${E.border}`,
            cursor:'pointer', color:E.fg1, fontSize:11.5, fontWeight:600, letterSpacing:-0.05, boxShadow:'0 1px 2px rgba(0,0,0,0.03)',
          }}>
            <i data-lucide="calendar" style={{ width:13, height:13, color:PILLAR, strokeWidth:2.1 }}/>{it}
          </button>
        ))}
      </div>
      <button style={{ display:'inline-flex', alignItems:'center', gap:6, marginTop:9, background:'transparent', border:'none', padding:'2px 2px', cursor:'pointer', color:E.fg3, fontSize:11.5, fontWeight:600, letterSpacing:-0.05 }}>
        <i data-lucide="download" style={{ width:13, height:13, strokeWidth:2.1 }}/>Download .ics
      </button>
    </div>
  );
}

// ─── Policy notice card ─────────────────────────────────────────────────────

function PolicyCard({ children }) {
  return (
    <div style={{ background:E.sunken, border:`1px solid ${E.border}`, borderRadius:12, padding:'11px 13px' }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:9 }}>
        <i data-lucide="info" style={{ width:14, height:14, color:E.fg3, flexShrink:0, marginTop:1 }}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:11.5, color:E.fg2, lineHeight:'16px' }}>{children}</div>
          <button style={{ marginTop:7, display:'inline-flex', alignItems:'center', gap:5, background:'transparent', border:'none', padding:0, cursor:'pointer', color:PILLAR, fontSize:11.5, fontWeight:700, letterSpacing:-0.05 }}>
            <i data-lucide="mail" style={{ width:12, height:12, strokeWidth:2.2 }}/>Contact Maria
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Token-error halo (TokenAccept / A18) ───────────────────────────────────

function ErrorHalo({ icon }) {
  return (
    <div style={{ position:'relative', width:96, height:96, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:WARN_BG, opacity:0.6 }}/>
      <div style={{ position:'absolute', inset:10, borderRadius:'50%', background:WARN_BG }}/>
      <div style={{ position:'relative', width:74, height:74, borderRadius:'50%', background:WARN_BG, border:`2px solid ${WARN_RING}`, display:'flex', alignItems:'center', justifyContent:'center', color:WARN }}>
        <i data-lucide={icon} style={{ width:34, height:34, strokeWidth:1.9 }}/>
      </div>
    </div>
  );
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

function Sk({ w, h, r = 8, style }) { return <div style={{ width:w, height:h, borderRadius:r, ...SH, ...style }}/>; }

// ─── FRAME 1 · CONFIRMED ────────────────────────────────────────────────────

function FrameConfirmed() {
  return (
    <Phone label="Manage · Confirmed">
      <StatusBadge kind="confirmed"/>
      <SummaryCard/>
      <ActionRegion>
        <ActionButton icon="calendar-clock" label="Reschedule" sub="Pick a new time that works for you."/>
        <ActionButton icon="x-circle" label="Cancel booking" sub="Cancelling frees the slot for someone else." tone="error"/>
      </ActionRegion>
      <CalendarCluster/>
      <PolicyCard>You can reschedule or cancel up to <b style={{ color:E.fg1, fontWeight:700 }}>24 hours before</b> the start time.</PolicyCard>
    </Phone>
  );
}

// ─── FRAME 2 · PAST (read-only) ─────────────────────────────────────────────

function FramePast() {
  return (
    <Phone label="Manage · Past">
      <StatusBadge kind="past"/>
      <SummaryCard dimmed/>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0 2px' }}>
        <i data-lucide="check" style={{ width:14, height:14, color:E.fg3, flexShrink:0 }}/>
        <span style={{ fontSize:11.5, color:E.fg3 }}>This call has already happened.</span>
      </div>
      <CalendarCluster/>
      <PolicyCard>Booked a follow-up? Manage it from the new confirmation email.</PolicyCard>
    </Phone>
  );
}

// ─── FRAME 3 · ALREADY CANCELLED ────────────────────────────────────────────

function FrameCancelled() {
  return (
    <Phone label="Manage · Cancelled">
      <StatusBadge kind="cancelled"/>
      <SummaryCard dimmed struck/>
      <div style={{ display:'flex', alignItems:'flex-start', gap:9, padding:'11px 13px', background:ERR_BG, border:`1px solid ${ERR_BORDER}`, borderRadius:12 }}>
        <i data-lucide="x-circle" style={{ width:15, height:15, color:ERR, flexShrink:0, marginTop:1, strokeWidth:2.2 }}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12, fontWeight:700, color:ERR_DK, letterSpacing:-0.05 }}>This booking was cancelled on Jun 9</div>
          <div style={{ fontSize:11, color:ERR, marginTop:2, lineHeight:'15px' }}>The slot was released. Nothing further is owed.</div>
          <button style={{ marginTop:8, display:'inline-flex', alignItems:'center', gap:5, background:'transparent', border:'none', padding:0, cursor:'pointer', color:PILLAR, fontSize:12, fontWeight:700, letterSpacing:-0.05 }}>
            <i data-lucide="rotate-ccw" style={{ width:13, height:13, strokeWidth:2.3 }}/>Book again
          </button>
        </div>
      </div>
    </Phone>
  );
}

// ─── FRAME 4 · WINDOW CLOSED ────────────────────────────────────────────────

function FrameWindowClosed() {
  return (
    <Phone label="Manage · Window closed">
      <StatusBadge kind="confirmed"/>
      <SummaryCard/>
      <ActionRegion>
        <ActionButton icon="calendar-clock" label="Reschedule" sub="Pick a new time that works for you." disabled/>
        <ActionButton icon="x-circle" label="Cancel booking" sub="Cancelling frees the slot for someone else." tone="error" disabled/>
        <div style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'2px 2px' }}>
          <i data-lucide="lock" style={{ width:13, height:13, color:WARN, flexShrink:0, marginTop:1 }}/>
          <span style={{ fontSize:11, color:WARN_DK, lineHeight:'15px', fontWeight:500 }}>Too late to change online — contact your host to reschedule or cancel.</span>
        </div>
      </ActionRegion>
      <CalendarCluster/>
      <PolicyCard>Changes close <b style={{ color:E.fg1, fontWeight:700 }}>24 hours before</b> the start time. Maria can still help directly.</PolicyCard>
    </Phone>
  );
}

// ─── FRAME 5 · TOKEN EXPIRED / INVALID ──────────────────────────────────────

function FrameTokenExpired() {
  return (
    <Phone label="Manage · Token expired" footer={
      <div style={{ position:'absolute', left:0, right:0, bottom:0, zIndex:15, background:E.surface, borderTop:`1px solid ${E.border}`, padding:'12px 16px 20px', display:'flex', flexDirection:'column', gap:8 }}>
        <button style={{ width:'100%', height:46, borderRadius:12, border:'none', cursor:'pointer', background:PILLAR, color:'#fff', fontSize:14, fontWeight:700, letterSpacing:-0.1, boxShadow:'0 6px 16px rgba(2,132,199,0.28)', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7 }}>
          <i data-lucide="mail" style={{ width:16, height:16, strokeWidth:2.2 }}/>Request a new link
        </button>
        <button style={{ width:'100%', height:38, background:'transparent', border:'none', cursor:'pointer', color:E.fg2, fontSize:13, fontWeight:600, letterSpacing:-0.05 }}>Contact host</button>
      </div>
    }>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', gap:18, padding:'0 8px 60px' }}>
        <ErrorHalo icon="link-2-off"/>
        <div>
          <h2 style={{ margin:0, fontSize:20, fontWeight:700, color:E.fg1, letterSpacing:-0.3, lineHeight:'25px' }}>This link has expired</h2>
          <p style={{ margin:'8px 0 0', fontSize:12.5, color:E.fg2, lineHeight:'18px', maxWidth:230, letterSpacing:-0.05 }}>
            For your security, manage links expire after a while. Request a fresh one and we'll email it to you.
          </p>
        </div>
      </div>
    </Phone>
  );
}

// ─── FRAME 6 · LOADING (skeleton) ───────────────────────────────────────────

function FrameLoading() {
  return (
    <Phone label="Manage · Loading">
      <Sk w={96} h={24} r={9999}/>
      <div style={{ background:E.surface, border:`1px solid ${E.border}`, borderRadius:16, boxShadow:'0 1px 3px rgba(0,0,0,0.04)', padding:'13px', display:'flex', flexDirection:'column', gap:13 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <Sk w={30} h={30} r={9999}/>
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6 }}>
            <Sk w="55%" h={11}/>
            <Sk w="40%" h={9}/>
          </div>
        </div>
        <div style={{ height:1, background:E.border }}/>
        <Sk w="75%" h={11}/>
        <Sk w={120} h={22} r={9999}/>
        <div style={{ height:1, background:E.border }}/>
        <Sk w="60%" h={11}/>
      </div>
      <Sk w={70} h={11} style={{ marginTop:2 }}/>
      <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
        <Sk w="100%" h={56} r={12}/>
        <Sk w="100%" h={56} r={12}/>
      </div>
    </Phone>
  );
}

Object.assign(window, {
  FrameConfirmed, FramePast, FrameCancelled, FrameWindowClosed, FrameTokenExpired, FrameLoading,
});
