// Pantopus — Calendarly · G · Buy Package (invitee/customer) — 4 frames
// Checkout sheet reusing the single-booking checkout machinery; only the order
// reference differs. A09.4 line-items + total + Pay CTA; A10.8 paper-card +
// policy footnote; A18 SCA/declined framing. Owner pillar = Business violet.
//
// Frames: 1 logged-in · 2 guest · 3 declined/SCA · 4 already-owns-credits upsell.

const { E } = window;
const { C, SheetFrame, Card } = window;
const BIZ = C.biz, BIZ_BG = C.bizBg;

function OwnerCard() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:11, padding:'11px 13px', background:E.surface, border:`1px solid ${E.border}`, borderRadius:16, boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ width:38, height:38, borderRadius:11, background:'linear-gradient(135deg,#a78bfa,#6d28d9)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, flexShrink:0 }}>M</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ fontSize:13.5, fontWeight:700, color:E.fg1 }}>Marlow &amp; Co.</span>
          <i data-lucide="badge-check" style={{ width:14, height:14, color:BIZ }}/>
        </div>
        <div style={{ fontSize:11, color:E.fg3, marginTop:1 }}>Hair studio · Oakland</div>
      </div>
    </div>
  );
}

function Line({ label, value, strong }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 0' }}>
      <span style={{ fontSize: strong?13.5:12.5, fontWeight: strong?700:500, color: strong?E.fg1:E.fg2 }}>{label}</span>
      <span style={{ fontSize: strong?16:13, fontWeight:700, color:E.fg1, fontVariantNumeric:'tabular-nums' }}>{value}</span>
    </div>
  );
}

function SummaryCard() {
  return (
    <Card pad="13px 14px">
      <div style={{ fontSize:14, fontWeight:700, color:E.fg1, marginBottom:8 }}>5-session cleaning</div>
      <Line label="5 sessions × $44.00" value="$220.00"/>
      <Line label="Per session" value="$44.00"/>
      <div style={{ height:1, background:E.border, margin:'7px 0' }}/>
      <Line label="Total" value="$220.00" strong/>
    </Card>
  );
}

function EligibleRow() {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'11px 13px', background:BIZ_BG, borderRadius:12 }}>
      <i data-lucide="ticket-check" style={{ width:16, height:16, color:BIZ, flexShrink:0, marginTop:1 }}/>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:11.5, fontWeight:700, color:E.fg1 }}>Use credits on</div>
        <div style={{ fontSize:11, color:E.fg2, marginTop:2, lineHeight:'15px' }}>Haircut · Beard trim · Kids cut</div>
        <div style={{ fontSize:10.5, color:E.fg3, marginTop:4 }}>Credits expire 1 year after purchase</div>
      </div>
    </div>
  );
}

function PayMethod() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:11, padding:'11px 13px', background:E.surface, border:`1px solid ${E.border}`, borderRadius:14, cursor:'pointer' }}>
      <div style={{ width:34, height:24, borderRadius:5, background:'linear-gradient(135deg,#1e3a8a,#2563eb)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:8, fontWeight:800 }}>VISA</div>
      <div style={{ flex:1, fontSize:12.5, fontWeight:600, color:E.fg1 }}>Visa <span style={{ fontFamily:'ui-monospace, Menlo, monospace', color:E.fg3 }}>••4242</span></div>
      <i data-lucide="chevron-right" style={{ width:16, height:16, color:E.fg4 }}/>
    </div>
  );
}

function Footnote() {
  return <div style={{ fontSize:10.5, color:E.fg3, lineHeight:'15px', padding:'0 4px' }}>Free cancellation up to 24 hours before. After that, no refund. Use your credits any time before they expire.</div>;
}

function PayBtn({ label='Pay $220.00' }) {
  return <button style={{ width:'100%', height:48, borderRadius:13, border:'none', background:E.blue600, color:'#fff', fontSize:14.5, fontWeight:700, cursor:'pointer', boxShadow:'0 6px 16px rgba(2,132,199,0.28)', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8 }}><i data-lucide="lock" style={{ width:15, height:15 }}/>{label}</button>;
}

function GuestEmail() {
  return (
    <Card pad="12px 13px">
      <div style={{ fontSize:11, fontWeight:600, color:E.fg2, marginBottom:6 }}>Email</div>
      <div style={{ background:E.surface, border:`1.5px solid ${E.border}`, borderRadius:8, padding:'10px 11px', fontSize:12.5, color:E.fg4 }}>you@email.com</div>
      <div style={{ fontSize:10.5, color:E.fg3, marginTop:7, lineHeight:'14px' }}>We'll send your receipt and credits here. <span style={{ color:E.blue600, fontWeight:700 }}>Sign in</span></div>
    </Card>
  );
}

// ─── FRAME 1 · LOGGED IN ────────────────────────────────────────────────────

function FrameLoggedIn() {
  return (
    <SheetFrame label="Buy package · Logged in" footer={<PayBtn/>}>
      <div style={{ display:'flex', flexDirection:'column', gap:12, paddingTop:4 }}>
        <div style={{ fontSize:11.5, color:E.fg3, lineHeight:'16px', padding:'0 2px' }}>Save by buying 5 sessions up front.</div>
        <OwnerCard/>
        <SummaryCard/>
        <EligibleRow/>
        <PayMethod/>
        <Footnote/>
      </div>
    </SheetFrame>
  );
}

// ─── FRAME 2 · GUEST ────────────────────────────────────────────────────────

function FrameGuest() {
  return (
    <SheetFrame label="Buy package · Guest" footer={<PayBtn/>}>
      <div style={{ display:'flex', flexDirection:'column', gap:12, paddingTop:4 }}>
        <OwnerCard/>
        <SummaryCard/>
        <EligibleRow/>
        <GuestEmail/>
        <PayMethod/>
        <Footnote/>
      </div>
    </SheetFrame>
  );
}

// ─── FRAME 3 · DECLINED / SCA ───────────────────────────────────────────────

function FrameDeclined() {
  return (
    <SheetFrame label="Buy package · Declined" footer={<PayBtn label="Try payment again"/>}>
      <div style={{ display:'flex', flexDirection:'column', gap:12, paddingTop:4 }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:9, padding:'11px 12px', background:C.errBg, border:`1px solid ${C.errBorder}`, borderRadius:12 }}>
          <i data-lucide="credit-card" style={{ width:16, height:16, color:C.err, flexShrink:0, marginTop:1 }}/>
          <span style={{ fontSize:11.5, color:C.err, fontWeight:600, lineHeight:'16px' }}>That payment didn't go through. Try another card.</span>
        </div>
        <OwnerCard/>
        <SummaryCard/>
        <PayMethod/>
        <Footnote/>
      </div>
    </SheetFrame>
  );
}

// ─── FRAME 4 · ALREADY OWNS CREDITS (upsell) ────────────────────────────────

function FrameUpsell() {
  return (
    <SheetFrame label="Buy package · Already owns credits" footer={<PayBtn/>}>
      <div style={{ display:'flex', flexDirection:'column', gap:12, paddingTop:4 }}>
        <OwnerCard/>
        <div style={{ display:'flex', flexDirection:'column', gap:10, padding:'12px 13px', background:C.infoBg, border:`1px solid ${C.infoBorder}`, borderRadius:14 }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:9 }}>
            <i data-lucide="ticket" style={{ width:16, height:16, color:C.info, flexShrink:0, marginTop:1 }}/>
            <span style={{ fontSize:11.5, color:E.fg2, fontWeight:600, lineHeight:'16px' }}>You already have 2 credits left on this package.</span>
          </div>
          <button style={{ width:'100%', height:38, borderRadius:9, border:`1px solid ${E.borderStrong}`, background:E.surface, color:E.fg1, fontSize:12.5, fontWeight:700, cursor:'pointer' }}>Use a credit instead</button>
        </div>
        <SummaryCard/>
        <PayMethod/>
        <Footnote/>
      </div>
    </SheetFrame>
  );
}

Object.assign(window, { BP_FrameLoggedIn:FrameLoggedIn, BP_FrameGuest:FrameGuest, BP_FrameDeclined:FrameDeclined, BP_FrameUpsell:FrameUpsell });
