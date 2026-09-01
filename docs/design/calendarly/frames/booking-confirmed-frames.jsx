// Pantopus — Calendarly · Booking Confirmed / Thank-You (invitee) — 8 frames
// Archetype: SuccessHeroBlock / ContentDetail success + RsvpCluster add-to-
// calendar; ConfettiSpray on mount (suppressed under prefers-reduced-motion).
// Lives at /book/[slug]/confirmed — returned-from-Stripe success / email link.
//
// Mirrors the A18 status-screen anatomy (Claim Submitted / Verify Email Sent):
// centered halo with soft pulse rings, headline + body, detail chip, optional
// 3-step timeline, sticky dock. Halo recolors to success green (--color-success)
// with a check-circle glyph for confirmed states; info blue hourglass for
// pending approval. Paid frames insert an A09.4-style receipt capsule.
// Host pillar = Personal sky on secondary chips. Lucide stroke-2, no emoji.
//
// Frames: confirmed-free · confirmed-paid · deposit-paid · package-credit-
// redeemed · pending-host-approval · with-redirect · email-sending · app-user.

const { E, SH } = window;

const PILLAR = E.blue600;
const SUCCESS = '#059669', SUCCESS_DK = '#047857', SUCCESS_BG = '#F0FDF4', SUCCESS_RING = '#A7F3D0', SUCCESS_100 = '#D1FAE5';
const INFO = E.blue600, INFO_DK = '#0369A1', INFO_BG = '#F0F9FF', INFO_RING = '#BAE6FD';
const WARN_BG = '#FFFBEB', WARN = '#B45309', WARN_BORDER = '#FDE68A';
const HOST_AV = 'linear-gradient(135deg,#38bdf8,#0369a1)';

// ─── Phone shell ────────────────────────────────────────────────────────────

function DarkStatusBar() {
  const c = E.fg1;
  return (
    <div style={{
      display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'12px 22px 0', height:34, boxSizing:'border-box', flexShrink:0, position:'relative', zIndex:5,
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
      display:'flex', alignItems:'center', padding:'6px 8px', height:46, boxSizing:'border-box',
      background:'transparent', flexShrink:0, position:'relative', zIndex:6,
    }}>
      <button aria-label="Close" style={{
        width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center',
        background:'transparent', border:'none', cursor:'pointer', color:E.fg2, padding:0,
      }}><i data-lucide="x" style={{ width:20, height:20 }}/></button>
      <div style={{ flex:1 }}/>
    </div>
  );
}

// ConfettiSpray — plays on mount, hidden under prefers-reduced-motion (CSS).
function Confetti() {
  const colors = [PILLAR, SUCCESS, '#f59e0b', '#7c3aed', '#38bdf8'];
  const bits = [];
  for (let i = 0; i < 16; i++) {
    const left = 6 + (i * 5.6) % 88;
    const delay = (i % 8) * 0.12;
    const dur = 1.8 + (i % 5) * 0.25;
    const c = colors[i % colors.length];
    const w = i % 3 === 0 ? 5 : 6, h = i % 2 === 0 ? 9 : 6;
    bits.push(
      <span key={i} style={{
        position:'absolute', top:-14, left:`${left}%`, width:w, height:h, borderRadius:1.5,
        background:c, opacity:0, animation:`confettiFall ${dur}s cubic-bezier(.3,.5,.5,1) ${delay}s forwards`,
      }}/>
    );
  }
  return (
    <div className="confetti-layer" style={{
      position:'absolute', top:40, left:0, right:0, height:280, zIndex:3, pointerEvents:'none', overflow:'hidden',
    }}>{bits}</div>
  );
}

function Phone({ label, children, footer, confetti }) {
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
        {confetti && <Confetti/>}
        <DarkStatusBar/>
        <TopBar/>
        <div style={{ flex:1, overflow:'auto', padding:'4px 16px 100px', display:'flex', flexDirection:'column', gap:16 }}>
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

// ─── Hero: halo + headline + body ───────────────────────────────────────────

function Halo({ kind = 'success', icon }) {
  const c = kind === 'success' ? { bg:SUCCESS_BG, ring:SUCCESS_RING, color:SUCCESS }
          :                       { bg:INFO_BG, ring:INFO_RING, color:INFO };
  return (
    <div style={{ position:'relative', width:104, height:104, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:c.bg, opacity:0.55, animation:'haloPulse 2.4s ease-in-out infinite' }}/>
      <div style={{ position:'absolute', inset:10, borderRadius:'50%', background:c.bg }}/>
      <div style={{
        position:'relative', width:80, height:80, borderRadius:'50%', background:c.bg, border:`2px solid ${c.ring}`,
        display:'flex', alignItems:'center', justifyContent:'center', color:c.color, boxShadow:`0 8px 22px ${c.bg}`,
      }}>
        <i data-lucide={icon} style={{ width:38, height:38, strokeWidth:1.9 }}/>
      </div>
    </div>
  );
}

function Hero({ kind, icon, title, children }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', gap:16, paddingTop:6 }}>
      <Halo kind={kind} icon={icon}/>
      <div>
        <h2 style={{ margin:0, fontSize:21, fontWeight:700, color:E.fg1, letterSpacing:-0.4, lineHeight:'26px' }}>{title}</h2>
        <p style={{ margin:'8px 0 0', fontSize:12.5, color:E.fg2, lineHeight:'18px', maxWidth:248, letterSpacing:-0.05 }}>{children}</p>
      </div>
    </div>
  );
}

// ─── Summary card ───────────────────────────────────────────────────────────

function Row({ icon, children, last }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'9px 0', borderBottom: last ? 'none' : `1px solid ${E.border}` }}>
      <i data-lucide={icon} style={{ width:15, height:15, color:E.fg3, flexShrink:0, marginTop:1 }}/>
      <div style={{ flex:1, minWidth:0 }}>{children}</div>
    </div>
  );
}

function SummaryCard({ pending }) {
  return (
    <div style={{
      background:E.surface, border:`1px solid ${E.border}`, borderRadius:16,
      boxShadow:'0 1px 3px rgba(0,0,0,0.04)', padding:'4px 13px',
    }}>
      <Row icon="user">
        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
          <div style={{ width:30, height:30, borderRadius:'50%', flexShrink:0, background:HOST_AV, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:11, fontWeight:700 }}>MK</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:700, color:E.fg1, letterSpacing:-0.1 }}>Intro call</div>
            <div style={{ fontSize:11, color:E.fg3, marginTop:1 }}>with Maria Kessler</div>
          </div>
        </div>
      </Row>
      <Row icon="calendar">
        <div style={{ fontSize:12.5, fontWeight:600, color:E.fg1, letterSpacing:-0.1, fontVariantNumeric:'tabular-nums' }}>Wed, Jun 17 · 9:30&ndash;10:00 AM</div>
        <div style={{ display:'inline-flex', alignItems:'center', gap:6, marginTop:6, padding:'4px 9px', borderRadius:9999, background:E.blue100, color:E.blue700, fontSize:10.5, fontWeight:600 }}>
          <i data-lucide="globe" style={{ width:11, height:11, strokeWidth:2.2 }}/>Pacific time (PDT)
        </div>
      </Row>
      <Row icon="video" last>
        {pending ? (
          <React.Fragment>
            <div style={{ fontSize:12.5, fontWeight:600, color:E.fg1, letterSpacing:-0.1 }}>Pantopus video</div>
            <div style={{ fontSize:11, color:E.fg3, marginTop:1 }}>Join link is sent once the host confirms.</div>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <div style={{ fontSize:12.5, fontWeight:600, color:E.fg1, letterSpacing:-0.1 }}>Pantopus video</div>
            <div style={{ fontSize:11, color:E.fg3, marginTop:1 }}>Join link is in your email and calendar invite.</div>
          </React.Fragment>
        )}
      </Row>
    </div>
  );
}

// ─── Receipt capsule (A09.4 paid state) ─────────────────────────────────────

function ReceiptCapsule({ mode = 'paid' }) {
  return (
    <div style={{ background:SUCCESS_BG, border:`1px solid ${SUCCESS_RING}`, borderRadius:12, padding:'11px 13px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <i data-lucide="badge-check" style={{ width:16, height:16, color:SUCCESS, flexShrink:0, strokeWidth:2.2 }}/>
        <span style={{ flex:1, fontSize:12, fontWeight:700, color:SUCCESS_DK, letterSpacing:-0.05 }}>
          {mode === 'deposit' ? 'Deposit received' : 'Payment received'}
        </span>
        <span style={{ fontSize:15, fontWeight:800, color:SUCCESS_DK, letterSpacing:-0.3, fontVariantNumeric:'tabular-nums' }}>
          {mode === 'deposit' ? '$20.00' : '$48.00'}
        </span>
      </div>
      {mode === 'deposit' && (
        <div style={{ fontSize:11, color:SUCCESS_DK, marginTop:3, fontWeight:500 }}>$40.00 due at your visit</div>
      )}
      <div style={{ fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize:10, color:E.fg3, marginTop:8, letterSpacing:0.02 }}>
        TXN_4F9C20A1 · Jun 13, 2026 · 9:41 AM
      </div>
      <div style={{ height:1, background:SUCCESS_RING, opacity:0.6, margin:'9px 0 8px' }}/>
      {mode === 'sending' ? (
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <i data-lucide="mail" style={{ width:13, height:13, color:E.fg4, flexShrink:0 }}/>
          <div style={{ flex:1, height:11, borderRadius:6, ...SH }}/>
        </div>
      ) : (
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <i data-lucide="mail-check" style={{ width:13, height:13, color:SUCCESS, flexShrink:0 }}/>
          <span style={{ fontSize:11, color:E.fg2, fontWeight:500 }}>Receipt emailed to maya.chen@gmail.com</span>
        </div>
      )}
    </div>
  );
}

function CreditUsedRow() {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:9, padding:'11px 13px',
      background:SUCCESS_BG, border:`1px solid ${SUCCESS_RING}`, borderRadius:12,
    }}>
      <i data-lucide="ticket-check" style={{ width:16, height:16, color:SUCCESS, flexShrink:0, strokeWidth:2.2 }}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:700, color:SUCCESS_DK, letterSpacing:-0.05 }}>1 session credit used</div>
        <div style={{ fontSize:11, color:SUCCESS_DK, marginTop:1, fontWeight:500 }}>No charge · 4 sessions left in your pack</div>
      </div>
    </div>
  );
}

// ─── Add-to-calendar cluster (RsvpCluster) ──────────────────────────────────

function CalendarCluster() {
  const items = ['Google', 'Apple', 'Outlook'];
  return (
    <div>
      <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:E.fg3, marginBottom:9 }}>Add to your calendar</div>
      <div style={{ display:'flex', gap:8 }}>
        {items.map((it) => (
          <button key={it} style={{
            flex:1, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
            height:38, borderRadius:9999, background:E.surface, border:`1px solid ${E.border}`,
            cursor:'pointer', color:E.fg1, fontSize:11.5, fontWeight:600, letterSpacing:-0.05,
            boxShadow:'0 1px 2px rgba(0,0,0,0.03)',
          }}>
            <i data-lucide="calendar" style={{ width:13, height:13, color:PILLAR, strokeWidth:2.1 }}/>{it}
          </button>
        ))}
      </div>
      <button style={{
        display:'inline-flex', alignItems:'center', gap:6, marginTop:9, background:'transparent', border:'none',
        padding:'2px 2px', cursor:'pointer', color:E.fg3, fontSize:11.5, fontWeight:600, letterSpacing:-0.05,
      }}>
        <i data-lucide="download" style={{ width:13, height:13, strokeWidth:2.1 }}/>Download .ics
      </button>
    </div>
  );
}

function ManageNote() {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'0 2px' }}>
      <i data-lucide="settings-2" style={{ width:14, height:14, color:E.fg4, flexShrink:0, marginTop:1 }}/>
      <span style={{ fontSize:11.5, color:E.fg3, lineHeight:'16px' }}>
        Need to change it? <span style={{ color:PILLAR, fontWeight:700 }}>Reschedule or cancel</span> anytime.
      </span>
    </div>
  );
}

// ─── Timeline (A18) ─────────────────────────────────────────────────────────

function Timeline({ steps }) {
  const currentIdx = steps.findIndex((s) => s.state === 'current');
  const fill = steps.every((s) => s.state === 'done') ? '66.66%' : currentIdx > 0 ? '33.33%' : '0%';
  return (
    <div style={{ background:E.surface, border:`1px solid ${E.border}`, borderRadius:14, boxShadow:'0 1px 2px rgba(0,0,0,0.04)', padding:'16px 10px 12px' }}>
      <div style={{ position:'relative', display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div style={{ position:'absolute', top:14, left:'16.66%', right:'16.66%', height:2, background:E.border, zIndex:0 }}/>
        <div style={{ position:'absolute', top:14, left:'16.66%', width:fill, height:2, background:INFO, zIndex:1 }}/>
        {steps.map((s, i) => {
          const bg = s.state === 'done' ? SUCCESS : s.state === 'current' ? INFO : E.surface;
          const ring = s.state === 'done' ? SUCCESS_BG : s.state === 'current' ? INFO_BG : 'transparent';
          return (
            <div key={i} style={{ width:'33.33%', display:'flex', flexDirection:'column', alignItems:'center', gap:7, zIndex:2 }}>
              <div style={{
                width:28, height:28, borderRadius:'50%', background:bg,
                border: s.state === 'pending' ? `1.5px solid ${E.borderStrong}` : 'none', color:'#fff',
                display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 0 0 4px ${ring}`,
              }}>
                {s.state === 'done' && <i data-lucide="check" style={{ width:14, height:14, strokeWidth:3, color:'#fff' }}/>}
                {s.state === 'current' && <span style={{ width:8, height:8, borderRadius:'50%', background:'#fff', animation:'haloPulse 1.6s ease-in-out infinite' }}/>}
              </div>
              <div style={{ textAlign:'center', maxWidth:78 }}>
                <div style={{ fontSize:10.5, fontWeight: s.state !== 'pending' ? 700 : 500, color: s.state === 'pending' ? E.fg3 : E.fg1, lineHeight:'13px', letterSpacing:-0.05 }}>{s.label}</div>
                {s.sub && <div style={{ fontSize:9, color:E.fg3, marginTop:2, fontWeight:500 }}>{s.sub}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EtaPill({ icon, children, tone = 'info' }) {
  const t = tone === 'success' ? { bg:SUCCESS_BG, fg:SUCCESS_DK, bd:SUCCESS_RING } : { bg:INFO_BG, fg:INFO_DK, bd:INFO_RING };
  return (
    <div style={{
      display:'inline-flex', alignItems:'center', gap:6, alignSelf:'center', padding:'6px 12px', borderRadius:9999,
      background:t.bg, border:`1px solid ${t.bd}`, color:t.fg, fontSize:11, fontWeight:700, letterSpacing:-0.02,
    }}>
      <i data-lucide={icon} style={{ width:12, height:12, strokeWidth:2.4 }}/>{children}
    </div>
  );
}

// ─── Nudge / banners ────────────────────────────────────────────────────────

function NudgeCard() {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:11, padding:'11px 13px',
      background:E.blue50, border:`1px solid ${E.blue100}`, borderRadius:12,
    }}>
      <div style={{ width:32, height:32, borderRadius:9, flexShrink:0, background:'#fff', color:PILLAR, display:'flex', alignItems:'center', justifyContent:'center', border:`1px solid ${E.blue100}` }}>
        <i data-lucide="user-plus" style={{ width:16, height:16, strokeWidth:2.1 }}/>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:700, color:E.fg1, letterSpacing:-0.1 }}>Create an account to manage your bookings</div>
        <div style={{ fontSize:10.5, color:E.fg3, marginTop:1 }}>Reschedule, cancel, and rebook in one place.</div>
      </div>
      <i data-lucide="chevron-right" style={{ width:15, height:15, color:E.blue600, flexShrink:0 }}/>
    </div>
  );
}

function AppBanner() {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
      background:'#0b0f17', borderRadius:12,
    }}>
      <div style={{ width:30, height:30, borderRadius:8, flexShrink:0, background:'rgba(255,255,255,0.1)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <i data-lucide="smartphone" style={{ width:15, height:15, strokeWidth:2.1 }}/>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'#fff', letterSpacing:-0.1 }}>Open in Pantopus to manage</div>
        <div style={{ fontSize:10.5, color:'rgba(255,255,255,0.6)', marginTop:1 }}>Your booking is in the app</div>
      </div>
      <span style={{ fontSize:11, fontWeight:700, color:'#fff', background:'rgba(255,255,255,0.14)', padding:'5px 11px', borderRadius:9999 }}>Open</span>
    </div>
  );
}

function RedirectPill() {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:9, padding:'9px 12px',
      background:E.sunken, border:`1px solid ${E.border}`, borderRadius:9999,
    }}>
      <i data-lucide="external-link" style={{ width:14, height:14, color:E.fg3, flexShrink:0 }}/>
      <span style={{ flex:1, fontSize:11.5, color:E.fg2, fontWeight:600, letterSpacing:-0.05 }}>Returning to acme.com in 5…</span>
      <button style={{ background:'transparent', border:'none', padding:'2px 2px', cursor:'pointer', color:PILLAR, fontSize:11.5, fontWeight:700 }}>Go now</button>
    </div>
  );
}

// ─── Dock ───────────────────────────────────────────────────────────────────

function Dock({ primary, primaryIcon = 'calendar-plus', secondary = 'Done', extra }) {
  return (
    <div style={{
      position:'absolute', left:0, right:0, bottom:0, zIndex:15,
      background:'rgba(255,255,255,0.97)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
      borderTop:`1px solid ${E.border}`, padding:'10px 16px 18px', display:'flex', flexDirection:'column', gap:8,
    }}>
      {extra}
      <button style={{
        width:'100%', height:46, borderRadius:12, border:'none', cursor:'pointer',
        background:PILLAR, color:'#fff', fontSize:14, fontWeight:700, letterSpacing:-0.1,
        boxShadow:'0 6px 16px rgba(2,132,199,0.28)', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7,
      }}>
        <i data-lucide={primaryIcon} style={{ width:16, height:16, strokeWidth:2.2 }}/>{primary}
      </button>
      {secondary && (
        <button style={{ width:'100%', height:38, background:'transparent', border:'none', cursor:'pointer', color:E.fg2, fontSize:13, fontWeight:600, letterSpacing:-0.05 }}>{secondary}</button>
      )}
    </div>
  );
}

const SENT_TO = 'maya.chen@gmail.com';

// ─── FRAME 1 · CONFIRMED — FREE ─────────────────────────────────────────────

function FrameConfirmedFree() {
  return (
    <Phone label="Confirmed · Free" confetti footer={<Dock primary="Add to calendar"/>}>
      <Hero kind="success" icon="check-circle-2" title="You're booked">
        We sent the details to <b style={{ color:E.fg1, fontWeight:700 }}>{SENT_TO}</b>.
      </Hero>
      <SummaryCard/>
      <CalendarCluster/>
      <ManageNote/>
      <NudgeCard/>
    </Phone>
  );
}

// ─── FRAME 2 · CONFIRMED — PAID (receipt) ───────────────────────────────────

function FrameConfirmedPaid() {
  return (
    <Phone label="Confirmed · Paid" confetti footer={<Dock primary="Add to calendar"/>}>
      <Hero kind="success" icon="check-circle-2" title="You're booked">
        We sent the details and receipt to <b style={{ color:E.fg1, fontWeight:700 }}>{SENT_TO}</b>.
      </Hero>
      <SummaryCard/>
      <ReceiptCapsule mode="paid"/>
      <CalendarCluster/>
      <ManageNote/>
    </Phone>
  );
}

// ─── FRAME 3 · DEPOSIT PAID (balance due) ───────────────────────────────────

function FrameDepositPaid() {
  return (
    <Phone label="Confirmed · Deposit paid" confetti footer={<Dock primary="Add to calendar"/>}>
      <Hero kind="success" icon="check-circle-2" title="You're booked">
        Your deposit is in. The rest is due when you arrive.
      </Hero>
      <SummaryCard/>
      <ReceiptCapsule mode="deposit"/>
      <CalendarCluster/>
      <ManageNote/>
    </Phone>
  );
}

// ─── FRAME 4 · PACKAGE CREDIT REDEEMED ──────────────────────────────────────

function FrameCreditRedeemed() {
  return (
    <Phone label="Confirmed · Credit redeemed" confetti footer={<Dock primary="Add to calendar"/>}>
      <Hero kind="success" icon="check-circle-2" title="You're booked">
        We used one of your session credits — no charge today.
      </Hero>
      <SummaryCard/>
      <CreditUsedRow/>
      <CalendarCluster/>
      <ManageNote/>
    </Phone>
  );
}

// ─── FRAME 5 · PENDING HOST APPROVAL ────────────────────────────────────────

function FramePending() {
  return (
    <Phone label="Confirmed · Pending approval" footer={<Dock primary="Done" primaryIcon="check" secondary="Message host"/>}>
      <Hero kind="info" icon="hourglass" title="Request sent">
        Maria reviews each request before it's confirmed. We'll email you the moment it's set.
      </Hero>
      <Timeline steps={[
        { label:'Submitted', state:'done', sub:'Just now' },
        { label:'Awaiting host', state:'current' },
        { label:'Confirmed', state:'pending' },
      ]}/>
      <EtaPill icon="clock" tone="info">Hosts usually reply within a day</EtaPill>
      <SummaryCard pending/>
      <ManageNote/>
    </Phone>
  );
}

// ─── FRAME 6 · WITH REDIRECT (countdown) ────────────────────────────────────

function FrameRedirect() {
  return (
    <Phone label="Confirmed · With redirect" confetti footer={<Dock primary="Add to calendar" extra={<RedirectPill/>}/>}>
      <Hero kind="success" icon="check-circle-2" title="You're booked">
        We sent the details to <b style={{ color:E.fg1, fontWeight:700 }}>{SENT_TO}</b>.
      </Hero>
      <SummaryCard/>
      <CalendarCluster/>
      <ManageNote/>
    </Phone>
  );
}

// ─── FRAME 7 · CONFIRMATION EMAIL SENDING ───────────────────────────────────

function FrameEmailSending() {
  return (
    <Phone label="Confirmed · Email sending" confetti footer={<Dock primary="Add to calendar"/>}>
      <Hero kind="success" icon="check-circle-2" title="You're booked">
        We're sending the details to <b style={{ color:E.fg1, fontWeight:700 }}>{SENT_TO}</b>.
      </Hero>
      <SummaryCard/>
      <ReceiptCapsule mode="sending"/>
      <CalendarCluster/>
      <ManageNote/>
    </Phone>
  );
}

// ─── FRAME 8 · APP USER (routes into native detail) ─────────────────────────

function FrameAppUser() {
  return (
    <Phone label="Confirmed · App user" confetti footer={<Dock primary="Open in Pantopus" primaryIcon="smartphone" secondary="Stay on web"/>}>
      <Hero kind="success" icon="check-circle-2" title="You're booked">
        We sent the details to <b style={{ color:E.fg1, fontWeight:700 }}>{SENT_TO}</b>.
      </Hero>
      <AppBanner/>
      <SummaryCard/>
      <CalendarCluster/>
      <ManageNote/>
    </Phone>
  );
}

Object.assign(window, {
  FrameConfirmedFree, FrameConfirmedPaid, FrameDepositPaid, FrameCreditRedeemed,
  FramePending, FrameRedirect, FrameEmailSending, FrameAppUser,
});
