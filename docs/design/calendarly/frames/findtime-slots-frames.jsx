// F5 — Find a Time · Suggested Slots (full screen) · 300×620 · Home green
// Frames: composing · results · no-overlap empty · single best-match · sent-as-proposal

const { N, H, M } = window;
const { Phone, TopBar, Card, Avatar, Shimmer, PrimaryBtn, SecondaryBtn, StickyFooter, EmptyState } = window;

function SubHead({ note='3 people · 30 min · this week', tz='PT · America/Los_Angeles' }) {
  return (
    <div style={{ padding:'10px 12px 8px', background:N.surface, borderBottom:`1px solid ${N.border}`, flexShrink:0 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
        <span style={{ fontSize:12.5, fontWeight:600, color:N.fg1 }}>{note}</span>
        <button style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 9px', borderRadius:9999, background:N.sunken, border:'none', cursor:'pointer', color:N.fg2, fontSize:10.5, fontWeight:700 }}>
          <i data-lucide="clock" style={{ width:12, height:12 }}/>{tz}<i data-lucide="chevron-down" style={{ width:11, height:11 }}/>
        </button>
      </div>
      <div style={{ fontSize:10.5, color:N.fg3, marginTop:5, display:'flex', alignItems:'center', gap:4 }}><i data-lucide="layers" style={{ width:11, height:11, color:H.accent }}/>From everyone's personal availability.</div>
    </div>
  );
}

// member dots: array of {m, free}
function AvailMini({ people, label }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:7 }}>
      <div style={{ display:'flex' }}>
        {people.map((p, i) => (
          <div key={i} style={{ marginLeft:i===0?0:-6, position:'relative' }}>
            <Avatar m={p.m} size={20} dim={!p.free}/>
            <span style={{ position:'absolute', bottom:-1, right:-1, width:8, height:8, borderRadius:'50%', background:p.free?H.accent:N.borderStrong, border:'1.5px solid #fff' }}/>
          </div>
        ))}
      </div>
      <span style={{ fontSize:10.5, fontWeight:600, color: label.startsWith('All')?H.accent700:N.fg3 }}>{label}</span>
    </div>
  );
}

function SlotRow({ day, date, time, people, label, best, assignee, expanded }) {
  return (
    <div style={{ background:N.surface, border:`1.5px solid ${best||expanded?H.accent:N.border}`, borderRadius:16, boxShadow: best||expanded?`0 2px 10px ${H.bg200}`:'0 1px 3px rgba(0,0,0,0.04)', overflow:'hidden' }}>
      <div style={{ padding:'11px 13px', display:'flex', alignItems:'center', gap:11, cursor:'pointer' }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            <span style={{ fontSize:13.5, fontWeight:700, color:N.fg1, letterSpacing:-0.2 }}>{day} {date} · {time}</span>
            {best && <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 7px', borderRadius:9999, background:H.bg100, color:H.accent700, fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:0.04 }}><i data-lucide="star" style={{ width:9, height:9 }}/>Best</span>}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:7 }}>
            <AvailMini people={people} label={label}/>
            {assignee && <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 7px', borderRadius:9999, background:'#ede9fe', color:'#6d28d9', fontSize:9.5, fontWeight:700 }}><i data-lucide="user-check" style={{ width:10, height:10 }}/>{assignee} covers</span>}
          </div>
        </div>
        <i data-lucide={expanded?'chevron-up':'chevron-down'} style={{ width:17, height:17, color:N.fg4, flexShrink:0 }}/>
      </div>
      {expanded && (
        <div style={{ borderTop:`1px solid ${N.border}`, padding:'11px 13px', background:H.bg50 }}>
          <div style={{ fontSize:11.5, color:N.fg2, marginBottom:9, display:'flex', alignItems:'center', gap:6 }}><i data-lucide="calendar-check" style={{ width:14, height:14, color:H.accent }}/>Book {day} {date} · {time} · 30 min</div>
          <PrimaryBtn icon="check">Book it</PrimaryBtn>
        </div>
      )}
    </div>
  );
}

const PPL = (a, b, c) => [{ m:M.mom, free:a }, { m:M.dad, free:b }, { m:M.ava, free:c }];

function SlotBody({ children }) {
  return <div style={{ flex:1, overflow:'auto', padding:'10px 12px 78px', display:'flex', flexDirection:'column', gap:9 }}>{children}</div>;
}

// ─── FRAME 1 · COMPOSING ───────────────────────────────────────
function FrameComposing() {
  return (
    <Phone label="Suggested times · Composing">
      <TopBar title="Suggested times" right={{ text:'Edit', muted:true }}/>
      <SubHead/>
      <SlotBody>
        <div style={{ textAlign:'center', padding:'14px 0 4px' }}>
          <div style={{ fontSize:13, fontWeight:700, color:N.fg1 }}>Finding times that work for everyone</div>
          <div style={{ fontSize:11, color:N.fg3, marginTop:3 }}>Composing Mom, Dad and Ava</div>
        </div>
        {[0,1,2,3].map(i => (
          <Card key={i} pad="11px 13px"><Shimmer w="62%" h={12}/><div style={{ display:'flex', alignItems:'center', gap:8, marginTop:9 }}><Shimmer w={56} h={20} r={10}/><Shimmer w={50} h={9}/></div></Card>
        ))}
      </SlotBody>
    </Phone>
  );
}

// ─── FRAME 2 · RESULTS ─────────────────────────────────────────
function FrameResults() {
  return (
    <Phone label="Suggested times · Results">
      <TopBar title="Suggested times" right={{ text:'Edit' }}/>
      <SubHead/>
      <SlotBody>
        <SlotRow day="Sun" date="Jun 22" time="2:00 PM" people={PPL(1,1,1)} label="All 3 free" best expanded/>
        <SlotRow day="Sun" date="Jun 22" time="6:00 PM" people={PPL(1,1,1)} label="All 3 free"/>
        <SlotRow day="Tue" date="Jun 24" time="7:30 PM" people={PPL(1,1,0)} label="2 of 3 free"/>
        <SlotRow day="Wed" date="Jun 25" time="12:00 PM" people={PPL(1,0,1)} label="2 of 3 free"/>
        <SlotRow day="Thu" date="Jun 26" time="8:00 PM" people={PPL(1,1,1)} label="All 3 free"/>
      </SlotBody>
      <StickyFooter><SecondaryBtn icon="send">Send proposal to members</SecondaryBtn></StickyFooter>
    </Phone>
  );
}

// ─── FRAME 3 · NO-OVERLAP EMPTY ────────────────────────────────
function FrameNoOverlap() {
  return (
    <Phone label="Suggested times · No overlap">
      <TopBar title="Suggested times" right={{ text:'Edit' }}/>
      <SubHead/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'24px 26px' }}>
        <div style={{ width:56, height:56, borderRadius:'50%', background:N.warningBg, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12 }}><i data-lucide="calendar-x" style={{ width:26, height:26, color:N.warning }}/></div>
        <div style={{ fontSize:15.5, fontWeight:700, color:N.fg1 }}>No time works for all 3</div>
        <div style={{ fontSize:12.5, color:N.fg3, lineHeight:'18px', maxWidth:220, marginTop:5 }}>Their free hours don't overlap this week. Loosen a constraint to see options.</div>
        <div style={{ marginTop:16, width:'100%', display:'flex', flexDirection:'column', gap:9 }}>
          <PrimaryBtn icon="user-minus">Make someone optional</PrimaryBtn>
          <SecondaryBtn icon="calendar-plus">Widen the window</SecondaryBtn>
        </div>
      </div>
    </Phone>
  );
}

// ─── FRAME 4 · SINGLE BEST-MATCH ───────────────────────────────
function FrameSingle() {
  return (
    <Phone label="Suggested times · Single best">
      <TopBar title="Suggested times" right={{ text:'Edit' }}/>
      <SubHead note="3 people · 30 min · this week"/>
      <SlotBody>
        <div style={{ fontSize:11.5, color:N.fg3, padding:'4px 2px', fontWeight:600 }}>One time works for everyone</div>
        <div style={{ background:N.surface, border:`1.5px solid ${H.accent}`, borderRadius:18, boxShadow:`0 4px 16px ${H.bg200}`, padding:'18px 16px', textAlign:'center' }}>
          <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 9px', borderRadius:9999, background:H.bg100, color:H.accent700, fontSize:9.5, fontWeight:700, textTransform:'uppercase', letterSpacing:0.04 }}><i data-lucide="star" style={{ width:10, height:10 }}/>Best match</span>
          <div style={{ fontSize:19, fontWeight:700, color:N.fg1, letterSpacing:-0.3, marginTop:12 }}>Sun Jun 22</div>
          <div style={{ fontSize:15, fontWeight:600, color:H.accent700, marginTop:2 }}>2:00 PM · 30 min</div>
          <div style={{ display:'flex', justifyContent:'center', marginTop:14 }}><AvailMini people={PPL(1,1,1)} label="All 3 free"/></div>
          <div style={{ marginTop:16 }}><PrimaryBtn icon="check">Book it</PrimaryBtn></div>
        </div>
      </SlotBody>
      <StickyFooter><SecondaryBtn icon="send">Send proposal to members</SecondaryBtn></StickyFooter>
    </Phone>
  );
}

// ─── FRAME 5 · SENT-AS-PROPOSAL SUCCESS ────────────────────────
function FrameSent() {
  return (
    <Phone label="Suggested times · Proposal sent">
      <TopBar title="Suggested times"/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'24px 28px' }}>
        <div style={{ position:'relative', width:84, height:84, marginBottom:20 }}>
          <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:`radial-gradient(circle at 30% 30%, ${H.bg50}, ${H.bg100})` }}/>
          <div style={{ position:'absolute', inset:16, borderRadius:'50%', background:H.accent, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 8px 20px ${H.shadow}` }}><i data-lucide="check" style={{ width:28, height:28, color:'#fff', strokeWidth:3 }}/></div>
        </div>
        <div style={{ fontSize:18, fontWeight:700, color:N.fg1, letterSpacing:-0.3 }}>Proposal sent to 3 people</div>
        <div style={{ fontSize:13, color:N.fg3, lineHeight:'19px', maxWidth:240, marginTop:7 }}>We'll notify you as they respond. The most-picked time gets booked.</div>
        <div style={{ marginTop:18, width:'100%', display:'flex', flexDirection:'column', gap:9 }}>
          <PrimaryBtn icon="house">Back to calendar</PrimaryBtn>
          <SecondaryBtn icon="bar-chart-3">View responses</SecondaryBtn>
        </div>
      </div>
    </Phone>
  );
}

Object.assign(window, { FrameComposing, FrameResults, FrameNoOverlap, FrameSingle, FrameSent });
