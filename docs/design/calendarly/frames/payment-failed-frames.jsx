// Pantopus — Calendarly · Payment failed / retry sheet — 4 frames
// Archetype: ErrorState + Stripe PaymentSheet (reuses the gig-checkout infra).
// A bottom sheet over /book/[slug]/review on a paid-booking payment failure. It
// holds the slot while the invitee retries — preventing "paid but lost my slot".
//
// Mirrors the A18 error halo + dock, the A14.6 Payments saved-card row, and the
// Slot Taken sheet's hold-countdown pattern. Neutral error chrome; host pillar
// (Personal sky) only on the retry CTA. Card entry is always the native Stripe
// PaymentSheet — never a hand-drawn form. We never charge twice. Lucide stroke-2,
// no emoji. Copy is reassuring, plainspoken, never blames the user.
//
// Frames: declined-retry · slot-hold-expired · network-timeout (idempotent) ·
// succeeded-after-retry (success morph → Booking Confirmed).

const { E, SH } = window;

const ACCENT = E.blue600;
const ERR = '#DC2626', ERR_BG = '#FEF2F2', ERR_RING = '#FCA5A5', ERR_DK = '#991B1B';
const WARN = '#D97706', WARN_BG = '#FFFBEB', WARN_RING = '#FDE68A', WARN_DK = '#92400E';
const INFO = '#0284C7', INFO_BG = '#F0F9FF', INFO_RING = '#BAE6FD', INFO_DK = '#0369A1';
const SUCCESS = '#059669', SUCCESS_BG = '#F0FDF4', SUCCESS_RING = '#A7F3D0', SUCCESS_DK = '#047857';
const HOST_AV = 'linear-gradient(135deg,#38bdf8,#0369a1)';

const TONES = {
  error:   { fg:ERR, bg:ERR_BG, ring:ERR_RING, dk:ERR_DK },
  warn:    { fg:WARN, bg:WARN_BG, ring:WARN_RING, dk:WARN_DK },
  info:    { fg:INFO, bg:INFO_BG, ring:INFO_RING, dk:INFO_DK },
  success: { fg:SUCCESS, bg:SUCCESS_BG, ring:SUCCESS_RING, dk:SUCCESS_DK },
};

// ─── Phone shell with dimmed backdrop + sheet ───────────────────────────────

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

function Backdrop() {
  return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column' }}>
      <DarkStatusBar/>
      <div style={{ display:'flex', alignItems:'center', padding:'6px 8px', height:46, boxSizing:'border-box', background:E.surface, borderBottom:`1px solid ${E.border}` }}>
        <i data-lucide="chevron-left" style={{ width:20, height:20, color:E.fg3, margin:'0 7px' }}/>
        <div style={{ flex:1, textAlign:'center', fontSize:15, fontWeight:600, color:E.fg2, letterSpacing:-0.2 }}>Review &amp; confirm</div>
        <div style={{ width:34 }}/>
      </div>
      <div style={{ padding:'12px 13px', display:'flex', flexDirection:'column', gap:12 }}>
        <div style={{ background:E.surface, border:`1px solid ${E.border}`, borderRadius:16, padding:'12px 13px', display:'flex', alignItems:'center', gap:11 }}>
          <div style={{ width:34, height:34, borderRadius:'50%', background:HOST_AV, flexShrink:0 }}/>
          <div style={{ flex:1 }}>
            <div style={{ height:11, width:'55%', background:E.sunken, borderRadius:5 }}/>
            <div style={{ height:9, width:'40%', background:E.sunken, borderRadius:5, marginTop:6 }}/>
          </div>
        </div>
        <div style={{ background:E.surface, border:`1px solid ${E.border}`, borderRadius:12, padding:'12px 13px', display:'flex', flexDirection:'column', gap:9 }}>
          <div style={{ height:10, width:'70%', background:E.sunken, borderRadius:5 }}/>
          <div style={{ height:10, width:'50%', background:E.sunken, borderRadius:5 }}/>
        </div>
      </div>
    </div>
  );
}

function Phone({ label, children, sheetHeight = 440 }) {
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
        <Backdrop/>
        <div style={{ position:'absolute', inset:0, background:'rgba(17,24,39,0.45)', zIndex:10 }}/>
        <div style={{
          position:'absolute', left:0, right:0, bottom:0, zIndex:20, height:sheetHeight,
          background:E.surface, borderTopLeftRadius:20, borderTopRightRadius:20,
          boxShadow:'0 -12px 40px rgba(17,24,39,0.22)', display:'flex', flexDirection:'column',
        }}>
          <div style={{ display:'flex', justifyContent:'center', paddingTop:9, paddingBottom:2, flexShrink:0 }}>
            <div style={{ width:38, height:4.5, borderRadius:9999, background:E.borderStrong }}/>
          </div>
          {children}
        </div>
        <div style={{ position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)', width:100, height:4, borderRadius:4, background:'rgba(255,255,255,0.5)', zIndex:70 }}/>
      </div>
    </div>
  );
}

// ─── Error halo block (A18) ─────────────────────────────────────────────────

function HaloBlock({ tone = 'error', icon, title, body }) {
  const t = TONES[tone];
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', gap:11, padding:'6px 18px 2px' }}>
      <div style={{ position:'relative', width:66, height:66, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:t.bg, opacity:0.6 }}/>
        <div style={{ position:'relative', width:52, height:52, borderRadius:'50%', background:t.bg, border:`2px solid ${t.ring}`, display:'flex', alignItems:'center', justifyContent:'center', color:t.fg }}>
          <i data-lucide={icon} style={{ width:25, height:25, strokeWidth:2 }}/>
        </div>
      </div>
      <div>
        <h2 style={{ margin:0, fontSize:17, fontWeight:700, color:E.fg1, letterSpacing:-0.2, lineHeight:'22px' }}>{title}</h2>
        <p style={{ margin:'6px 0 0', fontSize:12, color:E.fg2, lineHeight:'17px', maxWidth:232, letterSpacing:-0.03 }}>{body}</p>
      </div>
    </div>
  );
}

// ─── Slot-hold countdown chip (Slot Taken pattern) ──────────────────────────

function HoldChip({ released, time = '4:48' }) {
  const t = released ? TONES.error : TONES.warn;
  return (
    <div style={{
      display:'inline-flex', alignItems:'center', gap:8, alignSelf:'center',
      padding:'8px 13px', borderRadius:9999, background:t.bg, border:`1px solid ${t.ring}`,
    }}>
      <i data-lucide={released ? 'timer-off' : 'timer'} style={{ width:14, height:14, color:t.fg, flexShrink:0, strokeWidth:2.2 }}/>
      {released ? (
        <span style={{ fontSize:11.5, fontWeight:700, color:t.dk, letterSpacing:-0.03 }}>Hold released</span>
      ) : (
        <span style={{ fontSize:11.5, fontWeight:600, color:t.dk, letterSpacing:-0.03 }}>
          Holding your 2:00 PM time for <b style={{ fontWeight:800, fontVariantNumeric:'tabular-nums' }}>{time}</b>
        </span>
      )}
    </div>
  );
}

// ─── A14.6 saved-card row ────────────────────────────────────────────────────

function BrandBadge({ kind }) {
  const config = { visa:{ label:'VISA', bg:'#1A1F71', fg:'#fff' }, mastercard:{ label:'MC', bg:'#fef3c7', fg:'#B45309', dot:true } }[kind];
  return (
    <div style={{ width:38, height:26, borderRadius:6, background:config.bg, flexShrink:0, position:'relative', display:'flex', alignItems:'center', justifyContent:'center', color:config.fg, fontSize:10, fontWeight:800, letterSpacing:0.4, boxShadow:'inset 0 0 0 1px rgba(0,0,0,0.04)' }}>
      {config.dot && <span style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', width:10, height:10, borderRadius:'50%', background:'#EB001B', opacity:0.85 }}/>}
      {config.dot && <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', width:10, height:10, borderRadius:'50%', background:'#F79E1B', opacity:0.85 }}/>}
      {!config.dot && config.label}
    </div>
  );
}

function SavedCardRow({ kind = 'visa', label, sub, declined }) {
  return (
    <div style={{
      width:'100%', display:'flex', alignItems:'center', gap:11,
      background:E.surface, border:`1px solid ${declined ? ERR_RING : E.border}`, borderRadius:10, padding:'11px 12px',
      boxShadow:'0 1px 2px rgba(0,0,0,0.03)',
    }}>
      <BrandBadge kind={kind}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12.5, fontWeight:600, color:E.fg1, letterSpacing:-0.1 }}>{label}</div>
        <div style={{ fontSize:10.5, color: declined ? ERR : E.fg3, marginTop:1, fontWeight: declined ? 600 : 400 }}>{sub}</div>
      </div>
      {declined && (
        <span style={{ fontSize:9.5, fontWeight:700, letterSpacing:0.02, color:ERR, background:ERR_BG, border:`1px solid ${ERR_RING}`, padding:'2px 7px', borderRadius:9999 }}>Declined</span>
      )}
    </div>
  );
}

// ─── Buttons ─────────────────────────────────────────────────────────────────

function PrimaryCTA({ icon, label }) {
  return (
    <button style={{
      width:'100%', height:46, borderRadius:12, border:'none', cursor:'pointer',
      background:ACCENT, color:'#fff', fontSize:14, fontWeight:700, letterSpacing:-0.1,
      boxShadow:'0 6px 16px rgba(2,132,199,0.28)', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7,
    }}>
      <i data-lucide={icon} style={{ width:16, height:16, strokeWidth:2.2 }}/>{label}
    </button>
  );
}

function GhostCTA({ icon, label }) {
  return (
    <button style={{
      width:'100%', height:44, borderRadius:12, cursor:'pointer',
      background:E.surface, border:`1px solid ${E.border}`, color:E.fg1, fontSize:13, fontWeight:700, letterSpacing:-0.1,
      display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7,
    }}>
      <i data-lucide={icon} style={{ width:15, height:15, strokeWidth:2.1 }}/>{label}
    </button>
  );
}

function SheetBody({ children }) {
  return <div style={{ flex:1, overflow:'auto', padding:'4px 14px 12px', display:'flex', flexDirection:'column', gap:13 }}>{children}</div>;
}

// Reassuring footer note.
function ReassureNote({ icon = 'shield-check', children }) {
  return (
    <div style={{ flexShrink:0, borderTop:`1px solid ${E.border}`, padding:'10px 14px 18px', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
      <i data-lucide={icon} style={{ width:13, height:13, color:E.fg4, flexShrink:0 }}/>
      <span style={{ fontSize:11, color:E.fg3, fontWeight:600, letterSpacing:-0.03 }}>{children}</span>
    </div>
  );
}

// ─── FRAME 1 · DECLINED — RETRY ─────────────────────────────────────────────

function FrameDeclined() {
  return (
    <Phone label="Payment failed · Declined" sheetHeight={464}>
      <SheetBody>
        <HaloBlock tone="error" icon="credit-card" title="Your payment didn't go through"
          body="Your card was declined — not enough funds. Nothing was charged." />
        <HoldChip time="4:48"/>
        <SavedCardRow kind="visa" label="Visa •• 4421" sub="Declined · not enough funds" declined/>
        <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
          <PrimaryCTA icon="credit-card" label="Try another card"/>
          <GhostCTA icon="calendar-search" label="Use a different time"/>
        </div>
      </SheetBody>
      <ReassureNote>Your time is still held. Try another card.</ReassureNote>
    </Phone>
  );
}

// ─── FRAME 2 · SLOT HOLD EXPIRED ────────────────────────────────────────────

function FrameHoldExpired() {
  return (
    <Phone label="Payment failed · Hold expired" sheetHeight={420}>
      <SheetBody>
        <HaloBlock tone="error" icon="credit-card" title="Your payment didn't go through"
          body="Your time opened back up while we waited. You can grab a new one — still nothing charged." />
        <HoldChip released/>
        <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
          <PrimaryCTA icon="calendar-search" label="Pick a time again"/>
          <GhostCTA icon="x" label="Not now"/>
        </div>
      </SheetBody>
      <ReassureNote>We never charge twice.</ReassureNote>
    </Phone>
  );
}

// ─── FRAME 3 · NETWORK TIMEOUT (idempotent retry) ───────────────────────────

function FrameTimeout() {
  return (
    <Phone label="Payment failed · Network timeout" sheetHeight={448}>
      <SheetBody>
        <HaloBlock tone="info" icon="credit-card" title="We're not sure that went through"
          body="The connection dropped before we heard back. We won't double-charge you — check again to see where it landed." />
        <HoldChip time="4:31"/>
        <div style={{
          display:'flex', alignItems:'flex-start', gap:9, padding:'10px 12px',
          background:INFO_BG, border:`1px solid ${INFO_RING}`, borderRadius:10,
        }}>
          <i data-lucide="shield-check" style={{ width:15, height:15, color:INFO, flexShrink:0, marginTop:1, strokeWidth:2.1 }}/>
          <span style={{ fontSize:11, color:INFO_DK, lineHeight:'15px', fontWeight:500 }}>
            If the first try did go through, checking again won't charge you a second time.
          </span>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
          <PrimaryCTA icon="rotate-ccw" label="Check again"/>
          <GhostCTA icon="calendar-search" label="Use a different time"/>
        </div>
      </SheetBody>
      <ReassureNote>We never charge twice.</ReassureNote>
    </Phone>
  );
}

// ─── FRAME 4 · SUCCEEDED AFTER RETRY (success morph) ────────────────────────

function FrameSucceeded() {
  return (
    <Phone label="Payment failed · Succeeded" sheetHeight={400}>
      <SheetBody>
        <HaloBlock tone="success" icon="check-circle-2" title="Payment went through"
          body="Your second card worked. Taking you to your booking." />
        <div style={{
          display:'inline-flex', alignItems:'center', gap:8, alignSelf:'center',
          padding:'8px 13px', borderRadius:9999, background:SUCCESS_BG, border:`1px solid ${SUCCESS_RING}`,
        }}>
          <i data-lucide="badge-check" style={{ width:14, height:14, color:SUCCESS, flexShrink:0, strokeWidth:2.2 }}/>
          <span style={{ fontSize:11.5, fontWeight:700, color:SUCCESS_DK, letterSpacing:-0.03 }}>Paid $48.00 · receipt on its way</span>
        </div>
        {/* auto-advance indicator */}
        <div style={{ marginTop:2, display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
          <div style={{ width:'70%', height:5, borderRadius:9999, background:E.sunken, overflow:'hidden' }}>
            <div style={{ width:'62%', height:'100%', borderRadius:9999, background:SUCCESS }}/>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:SUCCESS, animation:'payPulse 1.4s ease-in-out infinite' }}/>
            <span style={{ fontSize:11, color:E.fg3, fontWeight:600, letterSpacing:-0.03 }}>Confirming your booking</span>
          </div>
        </div>
      </SheetBody>
      <ReassureNote icon="lock">Payments secured by Stripe</ReassureNote>
    </Phone>
  );
}

Object.assign(window, { FrameDeclined, FrameHoldExpired, FrameTimeout, FrameSucceeded });
