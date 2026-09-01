// Pantopus — Calendarly · Cancel & Refund Sheet — 8 frames
// Archetype: Destructive bottom sheet (ManageTrain close pattern) + Gigs
// CancelGigReason chips, driven by the paymentStateMachine refund path. Shared
// host + member; accent follows owner context. Money rows match A14.6 Payments /
// A09.4 Invoice style.
//
// Frames: 1 default (free-window) · 2 paid-with-refund (full) · 3 partial/policy
// refund · 4 non-refundable deposit (disabled + explainer) · 5 credit-redeemed
// (restore switch) · 6 submitting · 7 refund-failed (banner + retry) · 8
// already-cancelled (read-only).

const { E, SH } = window;

const ID = { personal:{color:'#0284c7'}, home:{color:'#16a34a'}, business:{color:'#7c3aed'} };
const AV = { personal:'linear-gradient(135deg,#38bdf8,#0369a1)' };
const WARN = '#B45309', WARN_BG = '#FFFBEB', WARN_LIGHT = '#FDE68A', WARN_SOLID='#D97706';
const ERR = '#DC2626', ERR_BG = '#FEF2F2', ERR_LIGHT = '#FCA5A5';
const SUCCESS = '#059669', SUCCESS_DK='#047857', SUCCESS_BG='#F0FDF4', SUCCESS_LIGHT='#A7F3D0';
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

function Sheet({ label, children, confirm='Cancel booking', confirmIcon='x-circle', confirmDisabled, saving, readOnly }) {
  return (
    <div style={{ width:300, height:620, borderRadius:40, padding:8, background:'#0b0f17', boxShadow:'0 24px 50px rgba(17,24,39,0.20), 0 0 0 1px rgba(0,0,0,0.12)', flexShrink:0 }} data-screen-label={label}>
      <div style={{ width:'100%', height:'100%', background:E.bg, borderRadius:32, overflow:'hidden', position:'relative', display:'flex', flexDirection:'column', fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div style={{ position:'absolute', top:7, left:'50%', transform:'translateX(-50%)', width:88, height:24, borderRadius:16, background:'#000', zIndex:50 }}/>
        <DarkStatusBar/>
        <div style={{ flex:1, padding:'14px 16px', opacity:0.4 }}>
          <div style={{ height:24 }}><i data-lucide="chevron-left" style={{ width:20, height:20, color:E.fg2 }}/></div>
          <div style={{ fontSize:21, fontWeight:700, color:E.fg1, marginTop:10 }}>30-min intro call</div>
          <div style={{ fontSize:13, color:E.fg2, marginTop:6 }}>Thu, Jun 18 · 2:00 PM · PT</div>
        </div>
        <div style={{ position:'absolute', inset:0, background:'rgba(17,24,39,0.42)', zIndex:18 }}/>
        <div style={{ position:'absolute', left:0, right:0, bottom:0, zIndex:20, background:E.surface, borderTopLeftRadius:24, borderTopRightRadius:24, boxShadow:'0 -8px 30px rgba(0,0,0,0.18)', maxHeight:'90%', display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', justifyContent:'center', paddingTop:9, paddingBottom:4, flexShrink:0 }}><div style={{ width:36, height:5, borderRadius:9999, background:E.borderStrong }}/></div>
          <div style={{ flex:1, overflow:'auto', padding:'4px 16px 12px' }}>{children}</div>
          {!readOnly && (
            <div style={{ flexShrink:0, padding:'10px 16px 20px', borderTop:`1px solid ${E.border}`, background:E.surface }}>
              <button disabled={confirmDisabled||saving} style={{ width:'100%', height:48, borderRadius:13, border:'none', background:ERR, color:'#fff', fontSize:14.5, fontWeight:700, cursor:(confirmDisabled||saving)?'default':'pointer', opacity:confirmDisabled?0.5:1, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                {saving ? <><Spinner/>Cancelling</> : <><i data-lucide={confirmIcon} style={{ width:17, height:17 }}/>{confirm}</>}
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

function HeaderBlock() {
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:18, fontWeight:700, color:E.fg1, letterSpacing:-0.3 }}>Cancel this booking?</div>
      <div style={{ fontSize:12, color:E.fg3, marginTop:6 }}>30-min intro call · Dana Whitfield · Thu, Jun 18 · 2:00 PM</div>
    </div>
  );
}

function ReasonChips({ otherOpen }) {
  const chips = [
    { l:'Changed plans', on:true }, { l:'Emergency' }, { l:'Found someone else' }, { l:'Other', on:otherOpen },
  ];
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:E.fg3, marginBottom:9 }}>Reason</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
        {chips.map((c) => (
          <button key={c.l} style={{ height:34, padding:'0 14px', borderRadius:9999, cursor:'pointer', fontSize:12, fontWeight:700, border: c.on ? 'none' : `1px solid ${E.border}`, background: c.on ? ERR_BG : E.surface, color: c.on ? ERR : E.fg2 }}>{c.l}</button>
        ))}
      </div>
      {otherOpen && <div style={{ marginTop:10, width:'100%', minHeight:46, boxSizing:'border-box', padding:'10px 12px', background:E.sunken, border:`1px solid ${E.border}`, borderRadius:8, fontSize:12, color:E.fg4 }}>Tell us what happened</div>}
    </div>
  );
}

function NoteInput() {
  return <div style={{ marginBottom:14, width:'100%', minHeight:46, boxSizing:'border-box', padding:'10px 12px', background:E.sunken, border:`1px solid ${E.border}`, borderRadius:8, fontSize:12, color:E.fg4 }}>Note to the other party (optional)</div>;
}

function MoneyRow({ label, value, strong, color }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0' }}>
      <span style={{ fontSize: strong?13.5:12.5, fontWeight: strong?700:500, color: strong?E.fg1:E.fg2 }}>{label}</span>
      <span style={{ fontSize: strong?15:13, fontWeight:700, color: color||E.fg1, fontVariantNumeric:'tabular-nums' }}>{value}</span>
    </div>
  );
}

function RefundSection({ preset='Full', amount='$40.00', policy="You're within the free-cancellation window — full refund", disabled }) {
  const presets = ['Full', 'Partial', 'Per policy'];
  return (
    <div style={{ marginBottom:14, padding:'12px 13px', background:E.surface, border:`1px solid ${E.border}`, borderRadius:14, opacity:disabled?0.55:1 }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:11 }}>
        <i data-lucide="receipt" style={{ width:13, height:13, color:E.fg3 }}/>
        <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:E.fg3 }}>Refund</span>
      </div>
      <div style={{ display:'flex', gap:3, padding:3, background:E.sunken, borderRadius:9, marginBottom:11 }}>
        {presets.map((p) => { const on = p === preset; return (
          <button key={p} disabled={disabled} style={{ flex:1, height:30, borderRadius:6, border:'none', cursor:disabled?'default':'pointer', background: on?E.surface:'transparent', color: on?E.fg1:E.fg3, boxShadow: on?'0 1px 2px rgba(0,0,0,0.08)':'none', fontSize:11, fontWeight: on?700:600 }}>{p}</button>
        ); })}
      </div>
      <MoneyRow label="Paid" value="$40.00"/>
      <div style={{ height:1, background:E.border, margin:'2px 0' }}/>
      <MoneyRow label="Refund to card" value={amount} strong color={disabled?E.fg4:SUCCESS_DK}/>
      <div style={{ fontSize:10.5, color:E.fg3, marginTop:8, lineHeight:'15px' }}>{policy}</div>
    </div>
  );
}

function CreditSwitch() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:11, marginBottom:14, padding:'12px 13px', background:E.surface, border:`1px solid ${E.border}`, borderRadius:14 }}>
      <div style={{ width:36, height:36, borderRadius:10, background:E.blue50, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i data-lucide="ticket" style={{ width:18, height:18, color:E.blue600 }}/></div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, fontWeight:700, color:E.fg1 }}>Restore 1 session credit</div>
        <div style={{ fontSize:10.5, color:E.fg3, marginTop:1 }}>Paid with a 5-session package</div>
      </div>
      <div style={{ width:42, height:25, borderRadius:9999, background:E.blue600, position:'relative', flexShrink:0 }}><div style={{ position:'absolute', top:2.5, right:2.5, width:20, height:20, borderRadius:'50%', background:'#fff' }}/></div>
    </div>
  );
}

function NotifySwitch() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:11, marginBottom:6, padding:'11px 12px', background:E.surface, border:`1px solid ${E.border}`, borderRadius:12 }}>
      <i data-lucide="bell" style={{ width:17, height:17, color:E.fg2 }}/>
      <div style={{ flex:1, fontSize:12.5, fontWeight:600, color:E.fg1 }}>Notify invitee</div>
      <div style={{ width:42, height:25, borderRadius:9999, background:E.blue600, position:'relative', flexShrink:0 }}><div style={{ position:'absolute', top:2.5, right:2.5, width:20, height:20, borderRadius:'50%', background:'#fff' }}/></div>
    </div>
  );
}

// ─── FRAME 1 · DEFAULT (free window) ────────────────────────────────────────

function FrameDefault() {
  return (
    <Sheet label="Cancel · Free window">
      <HeaderBlock/>
      <ReasonChips/>
      <NoteInput/>
      <NotifySwitch/>
    </Sheet>
  );
}

// ─── FRAME 2 · PAID WITH REFUND (full) ──────────────────────────────────────

function FramePaidRefund() {
  return (
    <Sheet label="Cancel · Paid refund" confirm="Cancel & refund $40">
      <HeaderBlock/>
      <ReasonChips/>
      <RefundSection/>
      <NotifySwitch/>
    </Sheet>
  );
}

// ─── FRAME 3 · PARTIAL / POLICY REFUND ──────────────────────────────────────

function FramePartial() {
  return (
    <Sheet label="Cancel · Partial refund" confirm="Cancel & refund $20">
      <HeaderBlock/>
      <ReasonChips/>
      <RefundSection preset="Per policy" amount="$20.00" policy="Within 24h of start — 50% refund per your cancellation policy"/>
      <NotifySwitch/>
    </Sheet>
  );
}

// ─── FRAME 4 · NON-REFUNDABLE DEPOSIT ───────────────────────────────────────

function FrameNonRefundable() {
  return (
    <Sheet label="Cancel · Non-refundable">
      <HeaderBlock/>
      <ReasonChips/>
      <RefundSection preset="Per policy" amount="$0.00" policy="This deposit is non-refundable" disabled/>
      <NotifySwitch/>
    </Sheet>
  );
}

// ─── FRAME 5 · CREDIT REDEEMED ──────────────────────────────────────────────

function FrameCredit() {
  return (
    <Sheet label="Cancel · Credit redeemed">
      <HeaderBlock/>
      <ReasonChips/>
      <CreditSwitch/>
      <NotifySwitch/>
    </Sheet>
  );
}

// ─── FRAME 6 · SUBMITTING ───────────────────────────────────────────────────

function FrameSubmitting() {
  return (
    <Sheet label="Cancel · Submitting" confirm="Cancel & refund $40" saving>
      <HeaderBlock/>
      <ReasonChips/>
      <RefundSection/>
      <NotifySwitch/>
    </Sheet>
  );
}

// ─── FRAME 7 · REFUND FAILED ────────────────────────────────────────────────

function FrameFailed() {
  return (
    <Sheet label="Cancel · Refund failed" confirm="Retry refund" confirmIcon="rotate-cw">
      <HeaderBlock/>
      <div style={{ display:'flex', alignItems:'flex-start', gap:9, marginBottom:14, padding:'11px 12px', background:ERR_BG, border:`1px solid ${ERR_LIGHT}`, borderRadius:12 }}>
        <i data-lucide="alert-circle" style={{ width:17, height:17, color:ERR, flexShrink:0, marginTop:1 }}/>
        <span style={{ fontSize:11.5, color:ERR, fontWeight:600, lineHeight:'16px' }}>Refund couldn't be processed — try again or contact support</span>
      </div>
      <RefundSection/>
    </Sheet>
  );
}

// ─── FRAME 8 · ALREADY CANCELLED (read-only) ────────────────────────────────

function FrameAlready() {
  return (
    <Sheet label="Cancel · Already cancelled" readOnly>
      <div style={{ opacity:0.85 }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', padding:'18px 24px 8px', gap:14 }}>
          <div style={{ width:64, height:64, borderRadius:'50%', background:E.sunken, color:E.fg3, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="circle-slash" style={{ width:28, height:28 }}/></div>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:E.fg1 }}>Already cancelled</div>
            <div style={{ fontSize:12, color:E.fg3, marginTop:6, maxWidth:210, lineHeight:'17px' }}>This booking was cancelled on Jun 11 and refunded in full.</div>
          </div>
        </div>
        <div style={{ padding:'12px 13px', background:E.surface, border:`1px solid ${E.border}`, borderRadius:14, marginTop:6 }}>
          <MoneyRow label="Refunded to card" value="$40.00" strong color={SUCCESS_DK}/>
        </div>
        <button style={{ width:'100%', height:46, borderRadius:13, border:`1px solid ${E.borderStrong}`, background:E.surface, color:E.fg1, fontSize:14, fontWeight:700, cursor:'pointer', marginTop:14 }}>Done</button>
      </div>
    </Sheet>
  );
}

Object.assign(window, { FrameDefault, FramePaidRefund, FramePartial, FrameNonRefundable, FrameCredit, FrameSubmitting, FrameFailed, FrameAlready });
