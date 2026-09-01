// Pantopus — Calendarly · G · Invoices List (owner) — 5 frames
// The financial hub for bookings. Reuses A10.10 Wallet row styling + A09.4 status
// pills; A14.6 Stripe gate. Business violet pillar.
//
// Frames: 1 mixed statuses · 2 empty · 3 filtered (overdue) · 4 loading ·
// 5 Stripe-not-connected gate.

const { E, SH } = window;
const { C, Frame, TopBar, Scroll, Card, EmptyHero, Sk } = window;
const BIZ = C.biz, BIZ_BG = C.bizBg;

const STATUS = {
  paid:{ bg:C.okBg, fg:C.ok, label:'Paid' },
  sent:{ bg:'#e0f2fe', fg:'#0369a1', label:'Sent' },
  overdue:{ bg:C.warnBg, fg:C.warn, label:'Overdue' },
  void:{ bg:E.sunken, fg:E.fg3, label:'Void' },
  refunded:{ bg:BIZ_BG, fg:BIZ, label:'Refunded' },
};

function Summary({ overdue }) {
  return (
    <Card pad="12px 14px">
      <div style={{ display:'flex' }}>
        <div style={{ flex:1, paddingRight:12 }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:overdue?C.warn:E.fg3 }}>Outstanding</div>
          <div style={{ fontSize:21, fontWeight:800, color:overdue?C.warn:E.fg1, letterSpacing:-0.5, marginTop:2 }}>$642</div>
        </div>
        <div style={{ width:1, background:E.border }}/>
        <div style={{ flex:1, paddingLeft:12 }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:E.fg3 }}>Collected · month</div>
          <div style={{ fontSize:21, fontWeight:800, color:E.fg1, letterSpacing:-0.5, marginTop:2 }}>$3,180</div>
        </div>
      </div>
    </Card>
  );
}

function FilterChips({ active }) {
  const opts = ['All', 'Paid', 'Sent', 'Overdue', 'Refunded'];
  return (
    <div style={{ display:'flex', gap:7, overflowX:'auto', padding:'2px 0' }}>
      {opts.map(o => { const on = o === active; return <button key={o} style={{ flexShrink:0, height:30, padding:'0 12px', borderRadius:9999, border:on?'none':`1px solid ${E.border}`, background:on?BIZ:E.surface, color:on?'#fff':E.fg2, fontSize:11.5, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>{o}</button>; })}
    </div>
  );
}

function InvRow({ payer, grad, initials, num, service, amount, status, last }) {
  const s = STATUS[status];
  return (
    <div role="button" style={{ display:'flex', alignItems:'center', gap:11, padding:'11px 2px', borderBottom: last?'none':`1px solid ${E.border}`, cursor:'pointer' }}>
      <div style={{ width:34, height:34, borderRadius:'50%', background:grad, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 }}>{initials}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600, color:E.fg1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{payer}</div>
        <div style={{ fontSize:10.5, color:E.fg3, marginTop:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}><span style={{ fontFamily:'ui-monospace, Menlo, monospace' }}>{num}</span> · {service}</div>
      </div>
      <div style={{ textAlign:'right', flexShrink:0 }}>
        <div style={{ fontSize:13.5, fontWeight:700, color:E.fg1, fontVariantNumeric:'tabular-nums' }}>{amount}</div>
        <span style={{ display:'inline-block', marginTop:3, fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:9999, background:s.bg, color:s.fg, textTransform:'uppercase' }}>{s.label}</span>
      </div>
    </div>
  );
}

const ROWS = [
  { day:'Today', payer:'Marcus Chen', grad:'linear-gradient(135deg,#38bdf8,#0369a1)', initials:'MC', num:'INV-00318', service:'Haircut', amount:'$642.85', status:'overdue' },
  { day:'Today', payer:'Dana Reyes', grad:'linear-gradient(135deg,#34d399,#047857)', initials:'DR', num:'INV-00317', service:'Color & cut', amount:'$96.00', status:'paid' },
  { day:'Jun 11', payer:'Priya Nair', grad:'linear-gradient(135deg,#a78bfa,#6d28d9)', initials:'PN', num:'INV-00316', service:'5-session package', amount:'$220.00', status:'sent' },
  { day:'Jun 11', payer:'Tom Brewer', grad:'linear-gradient(135deg,#fbbf24,#b45309)', initials:'TB', num:'INV-00315', service:'Beard trim', amount:'$24.00', status:'refunded' },
  { day:'Jun 9', payer:'Sam Whitfield', grad:'linear-gradient(135deg,#f472b6,#be185d)', initials:'SW', num:'INV-00314', service:'Kids cut', amount:'$30.00', status:'void' },
];

function Grouped({ items }) {
  return (
    <Card>
      {items.map((r, i) => (
        <React.Fragment key={r.num}>
          {(i===0 || items[i-1].day !== r.day) && <div style={{ padding:'8px 0 4px', fontSize:9, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:E.fg4, borderTop: i===0?'none':`1px solid ${E.borderSub||'#f3f4f6'}` }}>{r.day}</div>}
          <InvRow {...r} last={i===items.length-1}/>
        </React.Fragment>
      ))}
    </Card>
  );
}

const SearchBtn = <button aria-label="Search" style={{ width:32, height:32, borderRadius:'50%', border:'none', background:'transparent', color:E.fg1, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}><i data-lucide="search" style={{ width:19, height:19 }}/></button>;

// ─── FRAME 1 · MIXED ────────────────────────────────────────────────────────

function FrameMixed() {
  return (
    <Frame label="Invoices · Mixed">
      <TopBar title="Invoices" trailing={SearchBtn}/>
      <Scroll>
        <Summary/>
        <FilterChips active="All"/>
        <Grouped items={ROWS}/>
      </Scroll>
    </Frame>
  );
}

// ─── FRAME 2 · EMPTY ────────────────────────────────────────────────────────

function FrameEmpty() {
  return (
    <Frame label="Invoices · Empty">
      <TopBar title="Invoices" trailing={SearchBtn}/>
      <EmptyHero icon="receipt" tintBg={BIZ_BG} tint={BIZ} title="No invoices yet"
        body="Invoices appear here once you take a booking or sell a package."/>
    </Frame>
  );
}

// ─── FRAME 3 · FILTERED (OVERDUE) ───────────────────────────────────────────

function FrameOverdue() {
  return (
    <Frame label="Invoices · Overdue">
      <TopBar title="Invoices" trailing={SearchBtn}/>
      <Scroll>
        <Summary overdue/>
        <FilterChips active="Overdue"/>
        <Grouped items={[
          ROWS[0],
          { day:'Jun 8', payer:'Lena Park', grad:'linear-gradient(135deg,#60a5fa,#1d4ed8)', initials:'LP', num:'INV-00309', service:'Consultation', amount:'$120.00', status:'overdue' },
        ]}/>
      </Scroll>
    </Frame>
  );
}

// ─── FRAME 4 · LOADING ──────────────────────────────────────────────────────

function FrameLoading() {
  return (
    <Frame label="Invoices · Loading">
      <TopBar title="Invoices" trailing={SearchBtn}/>
      <Scroll>
        <Card pad="14px"><div style={{ display:'flex', gap:12 }}><div style={{ flex:1 }}><Sk w="60%" h={9}/><Sk w="50%" h={18} mt={6}/></div><div style={{ flex:1 }}><Sk w="60%" h={9}/><Sk w="50%" h={18} mt={6}/></div></div></Card>
        <Card>{[0,1,2,3].map(i => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:11, padding:'13px 2px', borderBottom: i===3?'none':`1px solid ${E.border}` }}>
            <div style={{ width:34, height:34, borderRadius:'50%', ...SH }}/>
            <div style={{ flex:1 }}><Sk w="50%" h={11}/><Sk w="68%" h={8} mt={6}/></div>
            <div style={{ width:50, height:24, borderRadius:9999, ...SH }}/>
          </div>
        ))}</Card>
      </Scroll>
    </Frame>
  );
}

// ─── FRAME 5 · STRIPE NOT CONNECTED ─────────────────────────────────────────

function FrameGate() {
  return (
    <Frame label="Invoices · Stripe gate">
      <TopBar title="Invoices" trailing={SearchBtn}/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'0 18px' }}>
        <div style={{ background:C.warnBg, border:`1px solid ${C.warnBorder}`, borderRadius:16, padding:'18px 16px', display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', gap:11 }}>
          <div style={{ width:48, height:48, borderRadius:'50%', background:'#fff', color:C.warn, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="receipt" style={{ width:23, height:23 }}/></div>
          <div style={{ fontSize:13.5, fontWeight:700, color:C.warn }}>Connect payments to invoice for services</div>
          <div style={{ fontSize:11.5, color:C.warn, opacity:0.9, lineHeight:'16px' }}>Pantopus uses Stripe to send and collect invoices.</div>
          <button style={{ marginTop:2, height:40, padding:'0 22px', borderRadius:11, border:'none', background:E.blue600, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6 }}><i data-lucide="external-link" style={{ width:15, height:15 }}/>Connect</button>
        </div>
      </div>
    </Frame>
  );
}

Object.assign(window, { IL_FrameMixed:FrameMixed, IL_FrameEmpty:FrameEmpty, IL_FrameOverdue:FrameOverdue, IL_FrameLoading:FrameLoading, IL_FrameGate:FrameGate });
