// Pantopus — Calendarly · G · My Packages / Remaining Credits (customer) — 4 frames
// Buyer-side counterpart to the owner Packages list. A10.8 credit/tier paper-card
// + policy footnote; A10.10 grouped rows for redemption history; A09.4 receipt feel.
// Buyer pillar chrome is Personal sky; each card carries the owner's accent.
//
// Frames: 1 active credits · 2 empty · 3 expired/used (greyed) · 4 expiring-soon.

const { E } = window;
const { C, Frame, TopBar, Scroll, EmptyHero } = window;
const SKY = E.personal, BIZ = C.biz;

function Meter({ left, total, color, full }) {
  const pct = full!=null ? full : (left/total)*100;
  return <div style={{ height:6, borderRadius:9999, background:E.sunken, overflow:'hidden' }}><div style={{ width:`${pct}%`, height:'100%', borderRadius:9999, background:color }}/></div>;
}

function OwnerRow({ name, grad, accent }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:9 }}>
      <div style={{ width:28, height:28, borderRadius:9, background:grad, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0 }}>{name[0]}</div>
      <span style={{ fontSize:12, fontWeight:700, color:E.fg1 }}>{name}</span>
      <i data-lucide="badge-check" style={{ width:13, height:13, color:accent }}/>
    </div>
  );
}

function HistoryRow({ date, service, last }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom: last?'none':`1px solid ${E.borderSub||'#f3f4f6'}` }}>
      <i data-lucide="check" style={{ width:13, height:13, color:C.ok, flexShrink:0 }}/>
      <div style={{ flex:1, fontSize:11.5, color:E.fg2 }}>{service}</div>
      <span style={{ fontSize:10.5, color:E.fg4 }}>{date}</span>
      <span style={{ fontSize:10, fontWeight:700, color:E.fg3 }}>1 credit</span>
    </div>
  );
}

function PkgCard({ owner, grad, accent, name, left, total, expires, state, expiringSoon, history }) {
  const spent = state === 'expired' || state === 'used';
  return (
    <div style={{ background:E.surface, border:`1px solid ${E.border}`, borderRadius:16, boxShadow:'0 1px 3px rgba(0,0,0,0.04)', overflow:'hidden', opacity:spent?0.7:1 }}>
      {expiringSoon && (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 13px', background:C.warnBg, borderBottom:`1px solid ${C.warnBorder}` }}>
          <i data-lucide="clock-alert" style={{ width:14, height:14, color:C.warn, flexShrink:0 }}/>
          <span style={{ fontSize:11, color:C.warn, fontWeight:600 }}>2 credits expire in 9 days — book soon.</span>
        </div>
      )}
      <div style={{ padding:'13px 14px' }}>
        <OwnerRow name={owner} grad={grad} accent={accent}/>
        <div style={{ fontSize:14, fontWeight:700, color:E.fg1, marginTop:10 }}>{name}</div>
        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginTop:8, marginBottom:6 }}>
          <span style={{ fontSize:18, fontWeight:800, color:spent?E.fg3:E.fg1, letterSpacing:-0.4 }}>{state==='used'?'0 of 5 left':`${left} of ${total} left`}</span>
          {state==='expired' ? <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:9999, background:E.sunken, color:E.fg3, textTransform:'uppercase' }}>Expired</span>
            : state==='used' ? <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:9999, background:E.sunken, color:E.fg3, textTransform:'uppercase' }}>All used</span> : null}
        </div>
        <Meter left={left} total={total} color={spent?E.borderStrong:SKY} full={state==='used'?100:state==='expired'?100:null}/>
        <div style={{ fontSize:10.5, color:E.fg3, marginTop:7 }}>{spent?`Ended ${expires}`:`Expires ${expires}`}</div>
        {spent
          ? <button style={{ width:'100%', height:40, borderRadius:11, border:`1px solid ${E.border}`, background:E.surface, color:E.blue600, fontSize:13, fontWeight:700, cursor:'pointer', marginTop:11 }}>Buy again</button>
          : <button style={{ width:'100%', height:42, borderRadius:11, border:'none', background:SKY, color:'#fff', fontSize:13.5, fontWeight:700, cursor:'pointer', marginTop:11, boxShadow:'0 6px 16px rgba(2,132,199,0.22)', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7 }}><i data-lucide="calendar-plus" style={{ width:15, height:15 }}/>Book with a credit</button>}
        {history && (
          <div style={{ marginTop:12, paddingTop:10, borderTop:`1px solid ${E.border}` }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:E.fg3 }}>Redemption history</span>
              <i data-lucide="chevron-up" style={{ width:14, height:14, color:E.fg4 }}/>
            </div>
            {history.map((h, i) => <HistoryRow key={i} {...h} last={i===history.length-1}/>)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FRAME 1 · ACTIVE CREDITS ───────────────────────────────────────────────

function FrameActive() {
  return (
    <Frame label="My packages · Active">
      <TopBar title="My packages"/>
      <Scroll>
        <div style={{ fontSize:11.5, color:E.fg3, lineHeight:'16px', padding:'0 4px' }}>Tap a credit to book your next session.</div>
        <PkgCard owner="Marlow & Co." grad="linear-gradient(135deg,#a78bfa,#6d28d9)" accent={BIZ} name="5-session cleaning" left={3} total={5} expires="Mar 12, 2027" state="active"
          history={[{date:'Jun 8', service:'Haircut'}, {date:'May 21', service:'Beard trim'}]}/>
        <PkgCard owner="Pawfect" grad="linear-gradient(135deg,#34d399,#047857)" accent={C.home} name="10 dog walks" left={6} total={10} expires="Jan 4, 2027" state="active"/>
      </Scroll>
    </Frame>
  );
}

// ─── FRAME 2 · EMPTY ────────────────────────────────────────────────────────

function FrameEmpty() {
  return (
    <Frame label="My packages · Empty">
      <TopBar title="My packages"/>
      <EmptyHero icon="ticket" tintBg={E.personalBg} tint={SKY} title="No packages yet"
        body="When you buy a package, your credits show up here."
        action={<button style={{ height:40, padding:'0 18px', borderRadius:11, border:`1px solid ${E.border}`, background:E.surface, color:E.blue600, fontSize:13, fontWeight:700, cursor:'pointer' }}>Browse services</button>}/>
    </Frame>
  );
}

// ─── FRAME 3 · EXPIRED / USED ───────────────────────────────────────────────

function FrameSpent() {
  return (
    <Frame label="My packages · Expired / used">
      <TopBar title="My packages"/>
      <Scroll>
        <PkgCard owner="Marlow & Co." grad="linear-gradient(135deg,#a78bfa,#6d28d9)" accent={BIZ} name="5-session cleaning" left={0} total={5} expires="Mar 12, 2026" state="used"/>
        <PkgCard owner="Glow Studio" grad="linear-gradient(135deg,#fbbf24,#b45309)" accent={C.warn} name="3 facials" left={1} total={3} expires="Feb 1, 2026" state="expired"/>
      </Scroll>
    </Frame>
  );
}

// ─── FRAME 4 · EXPIRING SOON ────────────────────────────────────────────────

function FrameExpiring() {
  return (
    <Frame label="My packages · Expiring soon">
      <TopBar title="My packages"/>
      <Scroll>
        <PkgCard owner="Marlow & Co." grad="linear-gradient(135deg,#a78bfa,#6d28d9)" accent={BIZ} name="5-session cleaning" left={2} total={5} expires="Jun 22, 2026" state="active" expiringSoon
          history={[{date:'Jun 8', service:'Haircut'}]}/>
        <PkgCard owner="Pawfect" grad="linear-gradient(135deg,#34d399,#047857)" accent={C.home} name="10 dog walks" left={6} total={10} expires="Jan 4, 2027" state="active"/>
      </Scroll>
    </Frame>
  );
}

Object.assign(window, { MP_FrameActive:FrameActive, MP_FrameEmpty:FrameEmpty, MP_FrameSpent:FrameSpent, MP_FrameExpiring:FrameExpiring });
