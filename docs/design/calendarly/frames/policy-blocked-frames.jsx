// Pantopus — Calendarly · Reschedule/Cancel cutoff & Policy-blocked state — 5 frames
// Archetype: ErrorState / policy-notice inside ContentDetail. This is the moment
// INSIDE Manage Your Booking where the host's cutoff forbids the reschedule or
// cancel the invitee just tapped — the highest support-ticket-generating gap in
// scheduling, so the copy states the exact rule and always offers a fallback.
// It is NOT a dead link (that's Unavailable States) and NOT where the host sets
// policy.
//
// Mirrors the A18 "review paused" amber note-card pattern, the Manage Your
// Booking summary card, and the host-contact fallback row. Neutral chrome, amber
// policy tone; host pillar (Personal sky) on the Message-host fallback. Lucide
// stroke-2, no emoji. Copy is honest, names the rule and dollar figures, no
// blame, no exclamations.
//
// Frames: cancel-window-closed · reschedule-window-closed · partial-refund-only ·
// change-not-allowed-online · within-policy (baseline, controls enabled).

const { E } = window;

const PILLAR = E.blue600;
const WARN = '#D97706', WARN_DK = '#92400E', WARN_BG = '#FFFBEB', WARN_LIGHT = '#FDE68A';
const ERR = '#DC2626', ERR_DK = '#991B1B', ERR_BG = '#FEF2F2', ERR_LIGHT = '#FCA5A5';
const SUCCESS = '#059669', SUCCESS_DK = '#047857', SUCCESS_BG = '#F0FDF4', SUCCESS_LIGHT = '#A7F3D0';
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

function TopBar() {
  return (
    <div style={{
      display:'flex', alignItems:'center', padding:'6px 8px', height:46, boxSizing:'border-box',
      background:E.surface, borderBottom:`1px solid ${E.border}`, flexShrink:0, zIndex:5,
    }}>
      <button aria-label="Back" style={{ width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'none', cursor:'pointer', color:E.fg1, padding:0 }}>
        <i data-lucide="chevron-left" style={{ width:20, height:20 }}/>
      </button>
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
        <div style={{ position:'absolute', top:7, left:'50%', transform:'translateX(-50%)', width:88, height:24, borderRadius:16, background:'#000', zIndex:50 }}/>
        <DarkStatusBar/>
        <TopBar/>
        <div style={{ flex:1, overflow:'auto', padding:'14px 14px 24px', display:'flex', flexDirection:'column', gap:13 }}>
          {children}
        </div>
        {footer}
        <div style={{ position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)', width:100, height:4, borderRadius:4, background:'rgba(0,0,0,0.22)', zIndex:70 }}/>
      </div>
    </div>
  );
}

// ─── Status badge + compact summary card ────────────────────────────────────

function StatusBadge() {
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:6, alignSelf:'flex-start', padding:'5px 11px 5px 9px', borderRadius:9999, background:SUCCESS_BG, color:SUCCESS_DK, border:`1px solid ${SUCCESS_LIGHT}`, fontSize:11.5, fontWeight:700, letterSpacing:-0.02 }}>
      <i data-lucide="check-circle-2" style={{ width:13, height:13, strokeWidth:2.3 }}/>Confirmed
    </div>
  );
}

function SummaryCard() {
  return (
    <div style={{ background:E.surface, border:`1px solid ${E.border}`, borderRadius:16, boxShadow:'0 1px 3px rgba(0,0,0,0.04)', padding:'12px 13px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:11, paddingBottom:10, borderBottom:`1px solid ${E.border}` }}>
        <div style={{ width:34, height:34, borderRadius:'50%', flexShrink:0, background:HOST_AV, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:12, fontWeight:700 }}>MK</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13.5, fontWeight:700, color:E.fg1, letterSpacing:-0.15 }}>Intro call</div>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
            <span style={{ fontSize:11, color:E.fg3 }}>Maria Kessler</span>
            <span style={{ width:5, height:5, borderRadius:'50%', background:PILLAR }}/>
            <span style={{ fontSize:9.5, fontWeight:600, color:PILLAR }}>Personal</span>
          </div>
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8, paddingTop:10 }}>
        <i data-lucide="calendar" style={{ width:15, height:15, color:E.fg3, flexShrink:0 }}/>
        <span style={{ fontSize:12.5, fontWeight:600, color:E.fg1, letterSpacing:-0.1, fontVariantNumeric:'tabular-nums' }}>Wed, Jun 17 · 9:30&ndash;10:00 AM</span>
        <span style={{ flex:1 }}/>
        <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:9999, background:E.blue100, color:E.blue700, fontSize:10, fontWeight:600 }}>
          <i data-lucide="globe" style={{ width:10, height:10, strokeWidth:2.2 }}/>PDT
        </span>
      </div>
    </div>
  );
}

// ─── Policy-block card (A18 amber note-card) ────────────────────────────────

const POLICY_TONES = {
  warn:    { fg:WARN, dk:WARN_DK, bg:WARN_BG, bd:WARN_LIGHT },
  success: { fg:SUCCESS, dk:SUCCESS_DK, bg:SUCCESS_BG, bd:SUCCESS_LIGHT },
};

function PolicyCard({ tone = 'warn', icon, title, body, still }) {
  const t = POLICY_TONES[tone];
  return (
    <div style={{ background:t.bg, border:`1px solid ${t.bd}`, borderRadius:12, padding:'12px 13px', display:'flex', gap:11 }}>
      <div style={{ width:30, height:30, borderRadius:9, flexShrink:0, background:'rgba(255,255,255,0.7)', color:t.fg, display:'flex', alignItems:'center', justifyContent:'center', border:`1px solid ${t.bd}` }}>
        <i data-lucide={icon} style={{ width:16, height:16, strokeWidth:2.1 }}/>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:700, color:t.dk, letterSpacing:-0.1, lineHeight:'17px' }}>{title}</div>
        <div style={{ fontSize:11.5, color:t.fg, marginTop:4, lineHeight:'16px' }}>{body}</div>
        {still && (
          <div style={{ display:'flex', alignItems:'flex-start', gap:6, marginTop:8, paddingTop:8, borderTop:`1px solid ${t.bd}` }}>
            <i data-lucide="info" style={{ width:12, height:12, color:t.fg, flexShrink:0, marginTop:2 }}/>
            <span style={{ fontSize:11, color:t.dk, fontWeight:600, lineHeight:'15px' }}>{still}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Buttons ─────────────────────────────────────────────────────────────────

function Button({ kind, icon, label }) {
  const map = {
    primary:    { bg:PILLAR, fg:'#fff', bd:'none', shadow:'0 6px 16px rgba(2,132,199,0.28)' },
    ghost:      { bg:E.surface, fg:E.fg1, bd:`1px solid ${E.border}`, shadow:'none' },
    hostGhost:  { bg:E.surface, fg:PILLAR, bd:`1px solid ${E.blue200}`, shadow:'none' },
    destructive:{ bg:ERR_BG, fg:ERR, bd:`1.5px solid ${ERR_LIGHT}`, shadow:'none' },
  }[kind];
  return (
    <button style={{
      width:'100%', height:46, borderRadius:12, cursor:'pointer',
      background:map.bg, color:map.fg, border:map.bd, boxShadow:map.shadow,
      fontSize:13.5, fontWeight:700, letterSpacing:-0.1,
      display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7,
    }}>
      {icon && <i data-lucide={icon} style={{ width:16, height:16, strokeWidth:2.1 }}/>}{label}
    </button>
  );
}

function InlineLink({ icon, label }) {
  return (
    <button style={{ display:'inline-flex', alignItems:'center', gap:6, alignSelf:'center', background:'transparent', border:'none', padding:'4px 4px', cursor:'pointer', color:PILLAR, fontSize:12.5, fontWeight:700, letterSpacing:-0.05 }}>
      <i data-lucide={icon} style={{ width:14, height:14, strokeWidth:2.3 }}/>{label}
    </button>
  );
}

function Dock({ children }) {
  return (
    <div style={{ position:'absolute', left:0, right:0, bottom:0, zIndex:15, background:'rgba(255,255,255,0.97)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', borderTop:`1px solid ${E.border}`, padding:'10px 14px 18px', display:'flex', flexDirection:'column', gap:8 }}>
      {children}
    </div>
  );
}

// Manage action row (baseline frame).
function ActionRow({ icon, label, sub, tone }) {
  const isErr = tone === 'error';
  return (
    <button style={{ width:'100%', display:'flex', alignItems:'center', gap:11, textAlign:'left', background:E.surface, border:`1.5px solid ${isErr ? ERR_LIGHT : E.borderStrong}`, borderRadius:12, padding:'11px 12px', cursor:'pointer', boxShadow:'0 1px 2px rgba(0,0,0,0.03)' }}>
      <div style={{ width:32, height:32, borderRadius:9, flexShrink:0, background: isErr ? ERR_BG : E.blue50, color: isErr ? ERR : PILLAR, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <i data-lucide={icon} style={{ width:16, height:16, strokeWidth:2.1 }}/>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:700, color: isErr ? ERR : E.fg1, letterSpacing:-0.1 }}>{label}</div>
        <div style={{ fontSize:10.5, color:E.fg3, marginTop:1 }}>{sub}</div>
      </div>
      <i data-lucide="chevron-right" style={{ width:15, height:15, color:E.fg4, flexShrink:0 }}/>
    </button>
  );
}

function Overline({ children }) {
  return <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:E.fg3, marginBottom:9 }}>{children}</div>;
}

// ─── FRAME 1 · CANCEL WINDOW CLOSED (no refund) ─────────────────────────────

function FrameCancelClosed() {
  return (
    <Phone label="Policy · Cancel window closed" footer={<Dock><Button kind="ghost" label="Keep my booking"/><Button kind="hostGhost" icon="message-circle" label="Message host"/></Dock>}>
      <StatusBadge/>
      <SummaryCard/>
      <PolicyCard tone="warn" icon="file-warning"
        title="It's too late to cancel for a refund"
        body="Free cancellation ended 24 hours before your visit, on Jun 16 at 9:30 AM."
        still="You can still cancel without a refund, or message Maria."/>
    </Phone>
  );
}

// ─── FRAME 2 · RESCHEDULE WINDOW CLOSED ─────────────────────────────────────

function FrameRescheduleClosed() {
  return (
    <Phone label="Policy · Reschedule window closed" footer={<Dock><Button kind="ghost" label="Keep my booking"/><Button kind="hostGhost" icon="message-circle" label="Message host"/></Dock>}>
      <StatusBadge/>
      <SummaryCard/>
      <PolicyCard tone="warn" icon="clock-alert"
        title="Reschedule window has closed"
        body="Free reschedules ended 24 hours before your visit, on Jun 16 at 9:30 AM."
        still="Cancelling is still open until 2 hours before."/>
      <InlineLink icon="x-circle" label="Cancel instead"/>
    </Phone>
  );
}

// ─── FRAME 3 · PARTIAL REFUND ONLY ──────────────────────────────────────────

function FramePartialRefund() {
  return (
    <Phone label="Policy · Partial refund only" footer={<Dock><Button kind="destructive" icon="x-circle" label="Cancel and refund $24"/><Button kind="ghost" label="Keep my booking"/></Dock>}>
      <StatusBadge/>
      <SummaryCard/>
      <PolicyCard tone="warn" icon="file-warning"
        title="You'll get a 50% refund"
        body="Cancelling now, within 24 hours of your visit, refunds half — $24 of the $48 you paid."
        still="Cancel before Jun 16 at 9:30 AM for a full refund."/>
    </Phone>
  );
}

// ─── FRAME 4 · CHANGE NOT ALLOWED ONLINE ────────────────────────────────────

function FrameNotOnline() {
  return (
    <Phone label="Policy · Change not allowed online" footer={<Dock><Button kind="primary" icon="message-circle" label="Message host"/><Button kind="ghost" label="Keep my booking"/></Dock>}>
      <StatusBadge/>
      <SummaryCard/>
      <PolicyCard tone="warn" icon="file-warning"
        title="This booking can't be changed online"
        body="Your host handles reschedules and cancellations directly for this event type."
        still="Message Maria and she'll sort out any change with you."/>
    </Phone>
  );
}

// ─── FRAME 5 · WITHIN POLICY (baseline) ─────────────────────────────────────

function FrameWithinPolicy() {
  return (
    <Phone label="Policy · Within policy (baseline)">
      <StatusBadge/>
      <SummaryCard/>
      <PolicyCard tone="success" icon="shield-check"
        title="You're free to change this"
        body="Reschedule or cancel at no charge until Jun 16 at 9:30 AM — 24 hours before your visit."/>
      <div>
        <Overline>Manage</Overline>
        <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
          <ActionRow icon="calendar-clock" label="Reschedule" sub="Pick a new time that works for you."/>
          <ActionRow icon="x-circle" label="Cancel booking" sub="Free until Jun 16 · full refund." tone="error"/>
        </div>
      </div>
    </Phone>
  );
}

Object.assign(window, {
  FrameCancelClosed, FrameRescheduleClosed, FramePartialRefund, FrameNotOnline, FrameWithinPolicy,
});
