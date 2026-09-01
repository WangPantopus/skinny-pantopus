// Pantopus — Calendarly · G · Payouts & Earnings (Wallet, extended) — 4 frames
// Extends the EXISTING A10.10 Wallet (dark balance hero + glass Pending/This-
// month split + concentric arcs, grouped-by-day tx rows, payout-method tile,
// tax-docs row, sticky Withdraw). ADDS a source-filter chip row + booking
// earnings rows (violet-tinted, calendar-check) + Booking-earnings filter (A10.11).
// Wallet chrome stays neutral; only the booking source/category go violet.
//
// Frames: 1 populated (booking filter) · 2 on-hold/re-verify · 3 payouts-not-
// enabled (Withdraw gated) · 4 empty.

const { E } = window;
const { C, Frame, TopBar } = window;
const BIZ = C.biz, BIZ_BG = C.bizBg;
const W = { p600:'#0284c7', p700:'#0369a1', p800:'#075985', p200:'#bae6fd',
  amberDeep:'#92400e', warnBg:'#fef3c7', warnRing:'#fcd34d', warn:'#d97706',
  ok:'#047857', okBg:'#d1fae5', home:'#16a34a', homeBg:'#dcfce7', homeDeep:'#15803d' };

function Overline({ children, action }) {
  return (
    <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginTop:14, marginBottom:7 }}>
      <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:E.fg3 }}>{children}</div>
      {action && <button style={{ background:'none', border:'none', padding:0, cursor:'pointer', fontSize:11, color:W.p600, fontWeight:600 }}>{action}</button>}
    </div>
  );
}

function Hero({ available, holdTone }) {
  return (
    <div style={{ position:'relative', borderRadius:18, overflow:'hidden', background:`linear-gradient(155deg, ${W.p800} 0%, ${W.p700} 55%, ${W.p600} 100%)`, boxShadow:'0 10px 24px rgba(2,132,199,0.28)', color:'#fff', padding:'14px 16px 13px' }}>
      <svg width="180" height="180" viewBox="0 0 200 200" style={{ position:'absolute', right:-36, top:-46, opacity:0.18, pointerEvents:'none' }}>
        <circle cx="100" cy="100" r="90" stroke="#fff" strokeWidth="1" fill="none"/>
        <circle cx="100" cy="100" r="60" stroke="#fff" strokeWidth="1" fill="none"/>
        <circle cx="100" cy="100" r="30" stroke="#fff" strokeWidth="1" fill="none"/>
      </svg>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:0.08, textTransform:'uppercase', color:W.p200 }}>Available to withdraw</div>
        <div style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 7px', borderRadius:9999, background:'rgba(255,255,255,0.16)', fontSize:9.5, fontWeight:700, textTransform:'uppercase', color:'#fff' }}>
          <i data-lucide="shield-check" style={{ width:10, height:10, strokeWidth:2.5 }}/>USD
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'baseline', gap:3, marginTop:3 }}>
        <span style={{ fontSize:19, fontWeight:700, color:W.p200, alignSelf:'flex-start', marginTop:7 }}>$</span>
        <span style={{ fontSize:38, fontWeight:800, letterSpacing:-1.2, color:'#fff', lineHeight:1 }}>{available}</span>
      </div>
      <div style={{ marginTop:12, padding:'9px 11px', background:'rgba(255,255,255,0.10)', border:'1px solid rgba(255,255,255,0.14)', borderRadius:12, display:'flex' }}>
        <div style={{ flex:1, paddingRight:10 }}>
          <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', color:W.p200, opacity:0.85, display:'flex', alignItems:'center', gap:4 }}><i data-lucide="clock" style={{ width:9, height:9, strokeWidth:2.5 }}/>Pending</div>
          <div style={{ fontSize:15, fontWeight:700, color:'#fff', letterSpacing:-0.2, marginTop:2 }}>$268.00</div>
          <div style={{ fontSize:9.5, color:W.p200, opacity:0.8, marginTop:1 }}>2 bookings</div>
        </div>
        <div style={{ width:1, background:'rgba(255,255,255,0.16)' }}/>
        <div style={{ flex:1, paddingLeft:10 }}>
          <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', color:W.p200, opacity:0.85, display:'flex', alignItems:'center', gap:4 }}><i data-lucide="trending-up" style={{ width:9, height:9, strokeWidth:2.5 }}/>This month</div>
          <div style={{ fontSize:15, fontWeight:700, color:'#fff', letterSpacing:-0.2, marginTop:2 }}>$1,642.00</div>
          <div style={{ fontSize:9.5, color:W.p200, opacity:0.8, marginTop:1 }}>▲ 18% vs May</div>
        </div>
      </div>
      {holdTone && (
        <div style={{ marginTop:11, background:'rgba(252,211,77,0.18)', border:'1px solid rgba(252,211,77,0.45)', borderRadius:10, padding:'8px 10px', display:'flex', alignItems:'center', gap:8 }}>
          <i data-lucide="alert-triangle" style={{ width:13, height:13, color:'#fde68a', strokeWidth:2.4 }}/>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#fef3c7' }}>Withdrawals paused</div>
            <div style={{ fontSize:10, color:'#fde68a', opacity:0.9, marginTop:1 }}>Funds are safe while we re-verify your bank.</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Filter({ active }) {
  const opts = ['All', 'Gigs', 'Booking earnings', 'Packages'];
  return (
    <div style={{ display:'flex', gap:7, overflowX:'auto', padding:'2px 0' }}>
      {opts.map(o => {
        const on = o === active;
        const biz = on && (o === 'Booking earnings');
        return <button key={o} style={{ flexShrink:0, height:30, padding:'0 12px', borderRadius:9999, border:on?'none':`1px solid ${E.border}`, background:on?(biz?BIZ:W.p600):E.surface, color:on?'#fff':E.fg2, fontSize:11.5, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>{o}</button>;
      })}
    </div>
  );
}

const CAT = {
  booking:{ bg:BIZ_BG, fg:BIZ, icon:'calendar-check' },
  package:{ bg:BIZ_BG, fg:BIZ, icon:'layers' },
  payout:{ bg:'#e0e7ff', fg:'#3730a3', icon:'building-2' },
  fee:{ bg:E.sunken, fg:E.fg3, icon:'receipt' },
};

const ROWS = [
  { day:'Today', desc:'Haircut · Dana R.', who:'2:14 PM', amt:48, dir:'in', cat:'booking', status:'pending' },
  { day:'Today', desc:'Color & cut · Marcus L.', who:'11:02 AM', amt:96, dir:'in', cat:'booking', status:'available' },
  { day:'Yesterday', desc:'5-session package · Priya N.', who:'4:30 PM', amt:220, dir:'in', cat:'package', status:'available' },
  { day:'Jun 9', desc:'Beard trim · Tom B.', who:'1:00 PM', amt:24, dir:'in', cat:'booking', status:'available' },
  { day:'Jun 7', desc:'Service fee', who:'Pantopus', amt:6.6, dir:'out', cat:'fee', status:'complete' },
];

function TxRow({ tx, last }) {
  const isOut = tx.dir === 'out', isPending = tx.status === 'pending', cat = CAT[tx.cat];
  return (
    <div style={{ display:'flex', alignItems:'center', gap:11, padding:'10px 13px', borderBottom: last?'none':`1px solid ${E.borderSub||'#f3f4f6'}` }}>
      <div style={{ width:32, height:32, borderRadius:9, background:cat.bg, color:cat.fg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i data-lucide={cat.icon} style={{ width:15, height:15, strokeWidth:2 }}/></div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, color:E.fg1 }}>
          <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{tx.desc}</span>
          {isPending && <span style={{ padding:'1px 6px', borderRadius:9999, background:W.warnBg, color:W.amberDeep, fontSize:8.5, fontWeight:700, textTransform:'uppercase', flexShrink:0 }}>Pending</span>}
        </div>
        <div style={{ fontSize:10.5, color:E.fg3, marginTop:1 }}>{tx.who}</div>
      </div>
      <div style={{ textAlign:'right', flexShrink:0 }}>
        <div style={{ fontSize:13, fontWeight:700, letterSpacing:-0.2, color: isOut?E.fg2:(isPending?W.amberDeep:W.ok), fontVariantNumeric:'tabular-nums' }}>{isOut?'−':'+'}${tx.amt.toFixed(2)}</div>
        <div style={{ fontSize:9.5, color:E.fg4, marginTop:1 }}>{tx.cat==='fee'?'Fee':isOut?'Payout':isPending?'Pending':'Cleared'}</div>
      </div>
    </div>
  );
}

function TxList({ items }) {
  return (
    <div style={{ background:E.surface, border:`1px solid ${E.border}`, borderRadius:14, overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.03)' }}>
      {items.map((tx, i) => (
        <React.Fragment key={i}>
          {(i===0 || items[i-1].day !== tx.day) && (
            <div style={{ padding:'8px 13px 4px', fontSize:9, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:E.fg4, borderTop: i===0?'none':`1px solid ${E.borderSub||'#f3f4f6'}` }}>{tx.day}</div>
          )}
          <TxRow tx={tx} last={i===items.length-1}/>
        </React.Fragment>
      ))}
    </div>
  );
}

function PayoutTile({ warn }) {
  return (
    <div style={{ background:E.surface, border:`1px solid ${warn?W.warnRing:E.border}`, borderRadius:14, padding:'11px 13px', display:'flex', alignItems:'center', gap:11, boxShadow:'0 1px 3px rgba(0,0,0,0.03)' }}>
      <div style={{ width:42, height:28, borderRadius:6, background:warn?`linear-gradient(135deg,${W.warnBg},#fde68a)`:'linear-gradient(135deg,#1e3a8a,#2563eb)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:8, fontWeight:800, letterSpacing:0.04 }}>{warn?<span style={{color:W.amberDeep}}>CHASE</span>:'CHASE'}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:700, color:E.fg1, display:'flex', alignItems:'center', gap:5 }}>Chase checking <span style={{ fontFamily:'ui-monospace, Menlo, monospace', color:E.fg3, fontWeight:600 }}>••7421</span></div>
        <div style={{ fontSize:10.5, marginTop:1, color:warn?W.amberDeep:E.fg3, display:'flex', alignItems:'center', gap:4 }}>
          {warn ? <><i data-lucide="alert-circle" style={{ width:10, height:10 }}/>Verification expired</> : <><i data-lucide="zap" style={{ width:10, height:10, color:W.home }}/>Instant payout · 1–3 min</>}
        </div>
      </div>
      <button style={{ height:28, padding:'0 10px', borderRadius:8, background:warn?W.amberDeep:'transparent', color:warn?'#fff':W.p600, border:'none', cursor:'pointer', fontSize:11, fontWeight:700 }}>{warn?'Re-verify':'Manage'}</button>
    </div>
  );
}

function TaxRow({ ready }) {
  return (
    <div style={{ background:E.surface, border:`1px solid ${E.border}`, borderRadius:14, padding:'11px 13px', display:'flex', alignItems:'center', gap:11, cursor:'pointer' }}>
      <div style={{ width:32, height:32, borderRadius:9, background:ready?W.homeBg:E.sunken, color:ready?W.homeDeep:E.fg2, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i data-lucide="file-text" style={{ width:16, height:16 }}/></div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:700, color:E.fg1, display:'flex', alignItems:'center', gap:5 }}>Tax documents {ready && <span style={{ padding:'1px 6px', borderRadius:9999, background:W.homeBg, color:W.homeDeep, fontSize:8.5, fontWeight:700, textTransform:'uppercase' }}>New</span>}</div>
        <div style={{ fontSize:10.5, color:E.fg3, marginTop:1 }}>{ready?'1099-NEC for 2025 ready':'YTD $4,180 · docs mid-Jan'}</div>
      </div>
      <i data-lucide="chevron-right" style={{ width:16, height:16, color:E.fg4 }}/>
    </div>
  );
}

function BottomBar({ children }) {
  return <div style={{ flexShrink:0, padding:'10px 16px 22px', background:'linear-gradient(180deg, rgba(246,247,249,0) 0%, #f6f7f9 40%)', borderTop:`1px solid ${E.borderSub||'#f3f4f6'}` }}>{children}</div>;
}

function Withdraw({ amount }) {
  return (
    <button style={{ width:'100%', height:48, borderRadius:13, border:'none', background:W.p600, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', boxShadow:'0 6px 16px rgba(2,132,199,.28)' }}>
      <span style={{ display:'inline-flex', alignItems:'center', gap:8 }}><i data-lucide="arrow-down-to-line" style={{ width:16, height:16 }}/>Withdraw</span>
      <span style={{ fontVariantNumeric:'tabular-nums' }}>${amount}</span>
    </button>
  );
}

function WithdrawLocked({ amount, sub }) {
  return (
    <div>
      <button disabled style={{ width:'100%', height:48, borderRadius:13, border:`1px solid ${E.border}`, background:E.sunken, color:E.fg4, fontSize:14, fontWeight:700, cursor:'not-allowed', display:'inline-flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px' }}>
        <span style={{ display:'inline-flex', alignItems:'center', gap:8 }}><i data-lucide="lock" style={{ width:15, height:15 }}/>Withdraw</span>
        <span style={{ fontVariantNumeric:'tabular-nums' }}>${amount}</span>
      </button>
      <div style={{ marginTop:6, textAlign:'center', fontSize:10, color:E.fg3 }}>{sub}</div>
    </div>
  );
}

function Body({ children }) {
  return <div style={{ flex:1, overflow:'auto', padding:'12px 16px 8px' }}>{children}</div>;
}

// ─── FRAME 1 · POPULATED ────────────────────────────────────────────────────

function FramePopulated() {
  return (
    <Frame label="Wallet · Booking earnings">
      <TopBar title="Wallet" trailing={<i data-lucide="history" style={{ width:19, height:19, color:E.fg1 }}/>}/>
      <Body>
        <Hero available="847.50"/>
        <div style={{ marginTop:12 }}><Filter active="Booking earnings"/></div>
        <Overline action="See all">Booking earnings</Overline>
        <TxList items={ROWS}/>
        <Overline>Payout method</Overline>
        <PayoutTile/>
        <Overline>Taxes</Overline>
        <TaxRow/>
        <div style={{ height:8 }}/>
      </Body>
      <BottomBar><Withdraw amount="847.50"/></BottomBar>
    </Frame>
  );
}

// ─── FRAME 2 · ON HOLD / RE-VERIFY ──────────────────────────────────────────

function FrameOnHold() {
  return (
    <Frame label="Wallet · On hold">
      <TopBar title="Wallet" trailing={<i data-lucide="history" style={{ width:19, height:19, color:E.fg1 }}/>}/>
      <Body>
        <div style={{ marginBottom:12, background:W.warnBg, border:`1px solid ${W.warnRing}`, borderRadius:14, padding:'11px 13px', display:'flex', alignItems:'flex-start', gap:11 }}>
          <div style={{ width:30, height:30, borderRadius:9, background:W.warn, color:'#fff', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="shield-alert" style={{ width:16, height:16 }}/></div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12.5, fontWeight:700, color:W.amberDeep }}>Your bank needs re-verifying</div>
            <div style={{ fontSize:11, color:W.amberDeep, lineHeight:'15px', opacity:0.92, marginTop:2 }}>A 2-minute check unlocks payouts. Earnings keep landing — they're safe.</div>
          </div>
        </div>
        <Hero available="847.50" holdTone/>
        <div style={{ marginTop:12 }}><Filter active="Booking earnings"/></div>
        <Overline action="See all">Booking earnings</Overline>
        <TxList items={ROWS.slice(0,4)}/>
        <Overline>Payout method</Overline>
        <PayoutTile warn/>
        <div style={{ height:8 }}/>
      </Body>
      <BottomBar><WithdrawLocked amount="847.50" sub="Re-verify your bank above to unlock payouts."/></BottomBar>
    </Frame>
  );
}

// ─── FRAME 3 · PAYOUTS NOT ENABLED ──────────────────────────────────────────

function FrameNotEnabled() {
  return (
    <Frame label="Wallet · Payouts not enabled">
      <TopBar title="Wallet" trailing={<i data-lucide="history" style={{ width:19, height:19, color:E.fg1 }}/>}/>
      <Body>
        <Hero available="847.50"/>
        <div style={{ marginTop:12 }}><Filter active="Booking earnings"/></div>
        <Overline action="See all">Booking earnings</Overline>
        <TxList items={ROWS}/>
        <Overline>Payout method</Overline>
        <div style={{ background:E.surface, border:`1px dashed ${E.borderStrong}`, borderRadius:14, padding:'12px 13px', display:'flex', alignItems:'center', gap:11 }}>
          <div style={{ width:32, height:32, borderRadius:9, background:C.stripeBg, color:C.stripe, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i data-lucide="credit-card" style={{ width:16, height:16 }}/></div>
          <div style={{ flex:1, fontSize:11.5, color:E.fg2, fontWeight:600 }}>Connect Stripe to get paid out</div>
          <i data-lucide="chevron-right" style={{ width:16, height:16, color:E.fg4 }}/>
        </div>
        <div style={{ height:8 }}/>
      </Body>
      <BottomBar><WithdrawLocked amount="847.50" sub="Finish Stripe setup to withdraw"/></BottomBar>
    </Frame>
  );
}

// ─── FRAME 4 · EMPTY ────────────────────────────────────────────────────────

function FrameEmpty() {
  return (
    <Frame label="Wallet · Empty">
      <TopBar title="Wallet" trailing={<i data-lucide="history" style={{ width:19, height:19, color:E.fg1 }}/>}/>
      <Body>
        <Hero available="0.00"/>
        <div style={{ marginTop:12 }}><Filter active="Booking earnings"/></div>
        <Overline>Booking earnings</Overline>
        <div style={{ background:E.surface, border:`1px dashed ${E.borderStrong}`, borderRadius:14, padding:'28px 20px', display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', gap:10 }}>
          <div style={{ width:54, height:54, borderRadius:'50%', background:BIZ_BG, color:BIZ, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="calendar-check" style={{ width:24, height:24, strokeWidth:1.8 }}/></div>
          <div style={{ fontSize:13, fontWeight:700, color:E.fg1 }}>No booking earnings yet</div>
          <div style={{ fontSize:11.5, color:E.fg3, lineHeight:'16px', maxWidth:200 }}>Your booking earnings will show up here next to your gigs.</div>
        </div>
        <Overline>Payout method</Overline>
        <PayoutTile/>
      </Body>
      <BottomBar><WithdrawLocked amount="0.00" sub="Take a booking to start earning"/></BottomBar>
    </Frame>
  );
}

Object.assign(window, { WE_FramePopulated:FramePopulated, WE_FrameOnHold:FrameOnHold, WE_FrameNotEnabled:FrameNotEnabled, WE_FrameEmpty:FrameEmpty });
