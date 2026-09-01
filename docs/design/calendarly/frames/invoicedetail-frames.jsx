// Pantopus — Calendarly · G · Invoice Detail (owner) — 7 frames
// ContentDetail matching A09.4 Invoice closely, adding owner lifecycle actions.
// Status pill in top bar; mono header; total hero; payer→payee identity-tinted
// cards + linked booking; line-items + tax + service-fee; payment timeline
// (A10.10 feel); terms + sender note; receipt capsule when paid.
// Business violet payee dot; payer dot in their pillar (sky personal).
//
// Frames: draft · sent · paid · partially-paid · overdue · void · refunded.

const { E } = window;
const { C, Frame, TopBar } = window;
const BIZ = C.biz, BIZ_BG = C.bizBg, SKY = E.personal;

const PILL = {
  draft:{ bg:E.sunken, fg:E.fg3, label:'Draft' },
  sent:{ bg:'#e0f2fe', fg:'#0369a1', label:'Sent' },
  paid:{ bg:C.okBg, fg:C.ok, label:'Paid' },
  partial:{ bg:C.warnBg, fg:C.warn, label:'Deposit paid' },
  overdue:{ bg:C.warnBg, fg:C.warn, label:'Overdue' },
  void:{ bg:E.sunken, fg:E.fg3, label:'Void' },
  refunded:{ bg:BIZ_BG, fg:BIZ, label:'Refunded' },
};

function StatusPill({ s }) {
  const p = PILL[s];
  return <span style={{ fontSize:9.5, fontWeight:700, padding:'4px 9px', borderRadius:9999, background:p.bg, color:p.fg, textTransform:'uppercase', letterSpacing:0.04 }}>{p.label}</span>;
}

function PayerPayee() {
  const cards = [
    { label:'From', name:'Marlow & Co.', sub:'Business · Verified', color:BIZ },
    { label:'To', name:'Marcus Chen', sub:'Personal', color:SKY },
  ];
  return (
    <div style={{ display:'flex', gap:8, marginTop:14 }}>
      {cards.map(c => (
        <div key={c.label} style={{ flex:1, padding:'10px 11px', border:`1px solid ${E.border}`, borderRadius:12, background:E.surface }}>
          <div style={{ fontSize:8.5, fontWeight:700, letterSpacing:0.1, textTransform:'uppercase', color:E.fg4 }}>{c.label}</div>
          <div style={{ fontSize:12.5, fontWeight:700, color:E.fg1, marginTop:5 }}>{c.name}</div>
          <div style={{ display:'inline-flex', alignItems:'center', gap:4, marginTop:4, fontSize:9.5, color:c.color, fontWeight:600 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:c.color }}/>{c.sub}
          </div>
        </div>
      ))}
    </div>
  );
}

function BookingRow() {
  return (
    <div role="button" style={{ display:'flex', alignItems:'center', gap:10, marginTop:8, padding:'10px 12px', border:`1px solid ${E.border}`, borderRadius:12, background:E.surface, cursor:'pointer' }}>
      <div style={{ width:30, height:30, borderRadius:8, background:BIZ_BG, color:BIZ, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i data-lucide="calendar" style={{ width:15, height:15 }}/></div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:600, color:E.fg1 }}>Haircut</div>
        <div style={{ fontSize:10.5, color:E.fg3, marginTop:1 }}>Sat Jun 14, 2:00 PM</div>
      </div>
      <i data-lucide="chevron-right" style={{ width:16, height:16, color:E.fg4 }}/>
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <div style={{ marginTop:16 }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
        <i data-lucide={icon} style={{ width:13, height:13, color:E.fg3 }}/>
        <span style={{ fontSize:9.5, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:E.fg3 }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function ItemsTable({ totalColor, totalLabel='Total' }) {
  const items = [
    { item:'Haircut · 45 min', qty:'1', unit:'$48', total:'$48.00' },
    { item:'5-session package', qty:'1', unit:'$220', total:'$220.00' },
    { item:'Deposit · paid Jun 4', qty:'1', unit:'$120', total:'$120.00' },
    { item:'Balance due', qty:'1', unit:'$254.85', total:'$254.85' },
  ];
  const fees = [{ k:'Subtotal', v:'$590.00' }, { k:'Service fee (3%)', v:'$17.70' }, { k:'Tax (5.7%)', v:'$35.15' }];
  return (
    <div style={{ border:`1px solid ${E.border}`, borderRadius:12, background:E.surface, overflow:'hidden' }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 24px 52px 56px', padding:'7px 11px', background:E.raised, borderBottom:`1px solid ${E.border}`, fontSize:8.5, fontWeight:700, letterSpacing:0.08, textTransform:'uppercase', color:E.fg4 }}>
        <span>Item</span><span style={{ textAlign:'center' }}>Qty</span><span style={{ textAlign:'right' }}>Unit</span><span style={{ textAlign:'right' }}>Total</span>
      </div>
      {items.map((r, i) => (
        <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 24px 52px 56px', padding:'9px 11px', borderBottom:`1px solid ${E.borderSub||'#f3f4f6'}`, fontSize:11, color:E.fg1, alignItems:'center' }}>
          <span style={{ fontWeight:500 }}>{r.item}</span>
          <span style={{ textAlign:'center', color:E.fg3 }}>{r.qty}</span>
          <span style={{ textAlign:'right', color:E.fg3, fontVariantNumeric:'tabular-nums' }}>{r.unit}</span>
          <span style={{ textAlign:'right', fontWeight:600, fontVariantNumeric:'tabular-nums' }}>{r.total}</span>
        </div>
      ))}
      <div style={{ background:E.raised, padding:'8px 11px' }}>
        {fees.map((f, i) => (
          <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0', fontSize:11, color:E.fg2, fontWeight:500 }}><span>{f.k}</span><span style={{ fontVariantNumeric:'tabular-nums' }}>{f.v}</span></div>
        ))}
        <div style={{ height:1, background:E.border, margin:'6px 0 4px' }}/>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', padding:'2px 0' }}>
          <span style={{ fontSize:12, fontWeight:700, color:E.fg1 }}>{totalLabel}</span>
          <span style={{ fontSize:15, fontWeight:800, color:totalColor||E.blue600, fontVariantNumeric:'tabular-nums' }}>$642.85</span>
        </div>
      </div>
    </div>
  );
}

function Timeline({ events }) {
  return (
    <div style={{ border:`1px solid ${E.border}`, borderRadius:12, background:E.surface, padding:'12px 13px' }}>
      {events.map((e, i) => (
        <div key={i} style={{ display:'flex', gap:10, paddingBottom: i===events.length-1?0:12, position:'relative' }}>
          {i!==events.length-1 && <div style={{ position:'absolute', left:6, top:14, bottom:0, width:1.5, background:E.border }}/>}
          <div style={{ width:13, height:13, borderRadius:'50%', flexShrink:0, marginTop:1, background:e.color, display:'flex', alignItems:'center', justifyContent:'center', zIndex:1 }}>
            {e.done && <i data-lucide="check" style={{ width:8, height:8, color:'#fff', strokeWidth:4 }}/>}
          </div>
          <div style={{ flex:1, display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
            <span style={{ fontSize:12, fontWeight:600, color:E.fg1 }}>{e.label}</span>
            <span style={{ fontSize:10, color:E.fg4, fontFamily:'ui-monospace, Menlo, monospace' }}>{e.time}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReceiptCapsule() {
  return (
    <div style={{ marginTop:16, display:'flex', alignItems:'center', gap:10, padding:'12px 13px', background:C.okBg, border:`1px solid ${C.okBorder}`, borderRadius:12 }}>
      <div style={{ width:30, height:30, borderRadius:8, background:C.ok, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i data-lucide="shield-check" style={{ width:16, height:16 }}/></div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:12, fontWeight:700, color:C.okDk }}>Paid with Pantopus Pay</div>
        <div style={{ fontSize:10.5, color:C.okDk, opacity:0.85, marginTop:1, fontFamily:'ui-monospace, Menlo, monospace' }}>rcpt_8KQ2 · Jun 12, 9:04 AM</div>
      </div>
    </div>
  );
}

function Dock({ children }) {
  return <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:10, padding:'10px 14px 22px', background:'rgba(255,255,255,0.97)', backdropFilter:'blur(12px)', borderTop:`1px solid ${E.border}`, display:'flex', gap:8 }}>{children}</div>;
}
function Primary({ children, icon }) { return <button style={{ flex:1, height:46, borderRadius:12, border:'none', background:E.blue600, color:'#fff', fontSize:13.5, fontWeight:700, cursor:'pointer', boxShadow:'0 6px 16px rgba(2,132,199,0.28)', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7 }}>{icon&&<i data-lucide={icon} style={{ width:15, height:15 }}/>}{children}</button>; }
function Ghost({ children, icon }) { return <button style={{ flex:1, height:46, borderRadius:12, border:`1px solid ${E.borderStrong}`, background:E.surface, color:E.fg1, fontSize:13.5, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7 }}>{icon&&<i data-lucide={icon} style={{ width:15, height:15 }}/>}{children}</button>; }
function Overflow() { return <button aria-label="More" style={{ width:46, height:46, borderRadius:12, border:`1px solid ${E.borderStrong}`, background:E.surface, color:E.fg2, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}><i data-lucide="ellipsis" style={{ width:18, height:18 }}/></button>; }

const T = {
  created:{ label:'Created', time:'Jun 4', color:E.fg4, done:true },
  sent:{ label:'Sent to Marcus', time:'Jun 4', color:SKY, done:true },
  paid:{ label:'Paid in full', time:'Jun 12', color:C.ok, done:true },
  deposit:{ label:'Deposit paid · $120', time:'Jun 4', color:C.warn, done:true },
  refunded:{ label:'Refunded · $642.85', time:'Jun 13', color:BIZ, done:true },
  voided:{ label:'Voided', time:'Jun 6', color:E.fg4, done:true },
};

function Detail({ status, note, totalColor, totalLabel, hero, timeline, paid, dock }) {
  return (
    <Frame label={`Invoice · ${status}`}>
      <TopBar title="Invoice" trailing={<StatusPill s={status}/>}/>
      <div style={{ flex:1, overflow:'auto', padding:'8px 16px 92px' }}>
        <div style={{ fontFamily:'ui-monospace, Menlo, monospace', fontSize:10.5, color:E.fg3, letterSpacing:0.04 }}>INV-00318 · issued Jun 4 · due Jun 18</div>
        {hero}
        <PayerPayee/>
        <BookingRow/>
        <Section title="Line items" icon="list"><ItemsTable totalColor={totalColor} totalLabel={totalLabel}/></Section>
        <Section title="Timeline" icon="activity"><Timeline events={timeline}/></Section>
        {paid && <ReceiptCapsule/>}
        <Section title="Payment terms" icon="file-text"><div style={{ fontSize:11.5, color:E.fg2, lineHeight:'16px' }}>Net 14 from issue. Pantopus Pay, card, or ACH.</div></Section>
        {note && <Section title="Note from sender" icon="message-square-quote"><div style={{ padding:'9px 11px', background:E.raised, border:`1px solid ${E.border}`, borderRadius:10, fontSize:11.5, color:E.fg2, fontStyle:'italic', lineHeight:'16px' }}>"Thanks Marcus — see you Saturday."</div></Section>}
        <div style={{ height:10 }}/>
      </div>
      <Dock>{dock}</Dock>
    </Frame>
  );
}

function HeroNum({ color, prefixCheck, split }) {
  if (split) return (
    <div style={{ marginTop:16 }}>
      <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
        <span style={{ fontSize:28, fontWeight:800, color:E.fg1, letterSpacing:-1, fontVariantNumeric:'tabular-nums' }}>$522.85</span>
        <span style={{ fontSize:11.5, color:E.fg3, fontWeight:500 }}>balance · USD</span>
      </div>
      <div style={{ fontSize:11, color:C.ok, fontWeight:700, marginTop:3 }}>Paid $120.00 · Balance $522.85</div>
    </div>
  );
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:16 }}>
      {prefixCheck && <div style={{ width:26, height:26, borderRadius:'50%', background:C.ok, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i data-lucide="check" style={{ width:15, height:15, strokeWidth:3 }}/></div>}
      <span style={{ fontSize:30, fontWeight:800, color:color||E.fg1, letterSpacing:-1.1, fontVariantNumeric:'tabular-nums' }}>$642.85</span>
      <span style={{ fontSize:11.5, color:E.fg3, fontWeight:500 }}>total · USD</span>
    </div>
  );
}

const FrameDraft = () => <Detail status="draft" hero={<HeroNum/>} timeline={[T.created]} note dock={<Primary icon="send">Send</Primary>}/>;
const FrameSent = () => <Detail status="sent" hero={<HeroNum/>} timeline={[T.created, T.sent]} note dock={<><Ghost icon="check">Mark paid</Ghost><Primary icon="send">Resend</Primary><Overflow/></>}/>;
const FramePaid = () => <Detail status="paid" hero={<HeroNum color={C.ok} prefixCheck/>} totalColor={C.ok} timeline={[T.created, T.sent, T.paid]} paid note dock={<><Ghost icon="share-2">Share</Ghost><Primary icon="download">Download PDF</Primary></>}/>;
const FramePartial = () => <Detail status="partial" hero={<HeroNum split/>} totalLabel="Balance due" timeline={[T.created, T.sent, T.deposit]} note dock={<><Ghost icon="check">Mark paid</Ghost><Primary icon="send">Send balance</Primary></>}/>;
const FrameOverdue = () => <Detail status="overdue" hero={<HeroNum color={C.warn}/>} timeline={[T.created, T.sent]} note dock={<><Ghost icon="check">Mark paid</Ghost><Primary icon="send">Resend</Primary><Overflow/></>}/>;
const FrameVoid = () => <Detail status="void" hero={<HeroNum color={E.fg3}/>} timeline={[T.created, T.voided]} dock={<Ghost icon="share-2">Share</Ghost>}/>;
const FrameRefunded = () => <Detail status="refunded" hero={<HeroNum color={BIZ}/>} totalColor={BIZ} timeline={[T.created, T.sent, T.paid, T.refunded]} note dock={<><Ghost icon="share-2">Share</Ghost><Primary icon="download">Download PDF</Primary></>}/>;

Object.assign(window, { ID_FrameDraft:FrameDraft, ID_FrameSent:FrameSent, ID_FramePaid:FramePaid, ID_FramePartial:FramePartial, ID_FrameOverdue:FrameOverdue, ID_FrameVoid:FrameVoid, ID_FrameRefunded:FrameRefunded });
