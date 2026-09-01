// F11 — Resource Detail / Booking Calendar (full screen, v2) · 300×620 · Home green
// Mirrors SupportTrainDetail: header card + agenda body + sticky CTA.
// Frames: loaded · loading · fully-booked · approval-pending · error

const { N, H, M } = window;
const { Phone, TopBar, Card, DaySection, Avatar, PrimaryBtn, StickyFooter, Shimmer, Banner } = window;

function HeaderCard({ pendingBadge }) {
  return (
    <Card style={{ display:'flex', flexDirection:'column', gap:11 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:46, height:46, borderRadius:13, flexShrink:0, background:H.bg50, color:H.accent, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="zap" style={{ width:23, height:23 }}/></div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:16, fontWeight:700, color:N.fg1, letterSpacing:-0.3 }}>EV charger</div>
          <span style={{ display:'inline-flex', marginTop:5, padding:'2px 8px', borderRadius:9999, background:N.sunken, color:N.fg3, fontSize:10, fontWeight:600 }}>Charger</span>
        </div>
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
        {['4 hr max', 'No approval', 'All members'].map((c, i) => (
          <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'4px 9px', borderRadius:9999, background:H.bg50, color:H.accent700, fontSize:10.5, fontWeight:600 }}><i data-lucide={['timer','check','users'][i]} style={{ width:11, height:11 }}/>{c}</span>
        ))}
      </div>
      {pendingBadge && (
        <button style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'9px 11px', borderRadius:10, border:`1px solid ${N.warningLight}`, background:N.warningBg, cursor:'pointer' }}>
          <i data-lucide="clock" style={{ width:15, height:15, color:N.warning }}/>
          <span style={{ flex:1, textAlign:'left', fontSize:12, fontWeight:700, color:N.warning700 }}>Pending approval (2)</span>
          <i data-lucide="chevron-right" style={{ width:15, height:15, color:N.warning }}/>
        </button>
      )}
    </Card>
  );
}

function BookingRow({ time, who, m, status='confirmed', dim }) {
  return (
    <Card pad="10px 12px" style={{ display:'flex', alignItems:'center', gap:11, opacity:dim?0.55:1 }}>
      <div style={{ width:5, height:5, borderRadius:'50%', background: status==='confirmed'?N.success:N.warning, flexShrink:0 }}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:700, color:N.fg1, letterSpacing:-0.2 }}>{time}</div>
        <div style={{ fontSize:11, color:N.fg3, marginTop:2 }}>For: {who}</div>
      </div>
      {m && <Avatar m={m} size={26}/>}
    </Card>
  );
}

function ApprovalRequest({ m, who, time, last }) {
  return (
    <div style={{ padding:'11px 2px', borderBottom: last?'none':`1px solid ${N.border}` }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:9 }}>
        <Avatar m={m} size={30}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12.5, fontWeight:700, color:N.fg1 }}>{who}</div>
          <div style={{ fontSize:11, color:N.fg3, marginTop:1 }}>{time}</div>
        </div>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button style={{ flex:1, height:34, borderRadius:9, border:'none', background:H.accent, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:5 }}><i data-lucide="check" style={{ width:13, height:13 }}/>Approve</button>
        <button style={{ flex:1, height:34, borderRadius:9, border:`1px solid ${N.borderStrong}`, background:N.surface, color:N.fg2, fontSize:12, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:5 }}><i data-lucide="x" style={{ width:13, height:13 }}/>Decline</button>
      </div>
    </div>
  );
}

function Body({ children }) {
  return <div style={{ flex:1, overflow:'auto', padding:'12px 12px 80px', display:'flex', flexDirection:'column', gap:9 }}>{children}</div>;
}

// ─── FRAME 1 · LOADED ──────────────────────────────────────────
function FrameLoaded() {
  return (
    <Phone label="Resource detail · Loaded">
      <TopBar title="EV charger" right={{ text:'Edit' }}/>
      <Body>
        <HeaderCard/>
        <div style={{ fontSize:11, fontWeight:700, color:N.fg3, textTransform:'uppercase', letterSpacing:0.06, padding:'4px 2px 0' }}>Upcoming bookings</div>
        <DaySection>Today · Mon Jun 16</DaySection>
        <BookingRow time="9:00–11:00 AM" who="Dad" m={M.dad}/>
        <BookingRow time="2:00–4:00 PM" who="Mom" m={M.mom}/>
        <DaySection>Tomorrow · Tue Jun 17</DaySection>
        <BookingRow time="7:00–9:00 AM" who="Ava" m={M.ava}/>
        <DaySection>Wed Jun 18</DaySection>
        <BookingRow time="6:00–8:00 PM" who="Dad" m={M.dad}/>
      </Body>
      <StickyFooter><PrimaryBtn icon="plus">Book this</PrimaryBtn></StickyFooter>
    </Phone>
  );
}

// ─── FRAME 2 · LOADING ─────────────────────────────────────────
function FrameLoading() {
  return (
    <Phone label="Resource detail · Loading">
      <TopBar title="EV charger" right={{ text:'Edit', muted:true }}/>
      <Body>
        <Card style={{ display:'flex', flexDirection:'column', gap:11 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}><Shimmer w={46} h={46} r={13}/><div style={{ flex:1 }}><Shimmer w="50%" h={14}/><Shimmer w={52} h={14} r={9} style={{ marginTop:7 }}/></div></div>
          <div style={{ display:'flex', gap:6 }}><Shimmer w={60} h={20} r={10}/><Shimmer w={70} h={20} r={10}/><Shimmer w={64} h={20} r={10}/></div>
        </Card>
        <Shimmer w={120} h={11} style={{ margin:'4px 2px' }}/>
        {[0,1,2].map(i => <Card key={i} pad="10px 12px" style={{ display:'flex', alignItems:'center', gap:11 }}><Shimmer w={5} h={5} r={3}/><div style={{ flex:1 }}><Shimmer w="55%" h={12}/><Shimmer w="35%" h={9} style={{ marginTop:6 }}/></div><Shimmer w={26} h={26} r={13}/></Card>)}
      </Body>
    </Phone>
  );
}

// ─── FRAME 3 · FULLY BOOKED ────────────────────────────────────
function FrameFullyBooked() {
  return (
    <Phone label="Resource detail · Fully booked">
      <TopBar title="EV charger" right={{ text:'Edit' }}/>
      <Body>
        <HeaderCard/>
        <Banner tone="amber" icon="calendar-x" title="Fully booked through Fri">Next opening is Sat 9 AM. You can still book that.</Banner>
        <DaySection>Today · Mon Jun 16</DaySection>
        <BookingRow time="8:00 AM–12:00 PM" who="Dad" m={M.dad}/>
        <BookingRow time="12:00–4:00 PM" who="Mom" m={M.mom}/>
        <BookingRow time="4:00–8:00 PM" who="Ava" m={M.ava}/>
        <DaySection>Tomorrow · Tue Jun 17</DaySection>
        <BookingRow time="7:00–11:00 AM" who="Dad" m={M.dad}/>
      </Body>
      <StickyFooter><PrimaryBtn icon="calendar-clock">Book next opening · Sat 9 AM</PrimaryBtn></StickyFooter>
    </Phone>
  );
}

// ─── FRAME 4 · APPROVAL-PENDING ────────────────────────────────
function FrameApproval() {
  return (
    <Phone label="Resource detail · Approval pending">
      <TopBar title="EV charger" right={{ text:'Edit' }}/>
      <Body>
        <HeaderCard pendingBadge/>
        <Card>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:9 }}><i data-lucide="clock" style={{ width:13, height:13, color:N.warning }}/><span style={{ fontSize:10.5, fontWeight:700, color:N.warning700, textTransform:'uppercase', letterSpacing:0.06 }}>Approval queue · 2</span></div>
          <ApprovalRequest m={M.ava} who="Ava" time="Sat Jun 21 · 10 AM–12 PM"/>
          <ApprovalRequest m={M.tom} who="Tomek" time="Sun Jun 22 · 2–4 PM" last/>
        </Card>
        <div style={{ fontSize:11, fontWeight:700, color:N.fg3, textTransform:'uppercase', letterSpacing:0.06, padding:'4px 2px 0' }}>Confirmed</div>
        <BookingRow time="9:00–11:00 AM" who="Dad" m={M.dad}/>
      </Body>
      <StickyFooter><PrimaryBtn icon="plus">Book this</PrimaryBtn></StickyFooter>
    </Phone>
  );
}

// ─── FRAME 5 · ERROR ───────────────────────────────────────────
function FrameError() {
  return (
    <Phone label="Resource detail · Error">
      <TopBar title="EV charger"/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'24px 28px' }}>
        <div style={{ width:56, height:56, borderRadius:'50%', background:N.errorBg, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12 }}><i data-lucide="cloud-off" style={{ width:26, height:26, color:N.error }}/></div>
        <div style={{ fontSize:15.5, fontWeight:700, color:N.fg1 }}>Couldn't load this resource</div>
        <div style={{ fontSize:12.5, color:N.fg3, lineHeight:'18px', maxWidth:220, marginTop:5 }}>Check your connection and try again.</div>
        <div style={{ marginTop:16, width:160 }}><PrimaryBtn icon="rotate-cw">Retry</PrimaryBtn></div>
      </div>
    </Phone>
  );
}

Object.assign(window, { FrameLoaded, FrameLoading, FrameFullyBooked, FrameApproval, FrameError });
