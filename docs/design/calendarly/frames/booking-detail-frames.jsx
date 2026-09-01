// Pantopus — Calendarly · Booking Detail (host & member) — 10 frames
// Archetype: ContentDetail (back + overflow, status pill, header, scroll
// SectionCards, sticky CTA dock). Reuses EventDetail attendees + ManageTrain
// destructive-sheet pattern. Owner-polymorphic — accent + identity strip follow
// the booking's owner context.
//
// Frames: 1 confirmed-upcoming · 2 pending (Approve/Decline dock) · 3
// past-needs-followup · 4 cancelled (dimmed + refund line) · 5 no-show · 6
// conflict-warning banner · 7 reassigning (Business) · 8 member view (reduced
// dock) · 9 loading shimmer · 10 error.

const { E, SH } = window;

const ID = {
  personal: { color:'#0284c7', bg:'#e0f2fe', label:'Personal' },
  home:     { color:'#16a34a', bg:'#dcfce7', label:'Home · Riverside' },
  business: { color:'#7c3aed', bg:'#f3e8ff', label:'Business · Acme' },
};
const AV = {
  personal: 'linear-gradient(135deg,#38bdf8,#0369a1)',
  home:     'linear-gradient(135deg,#4ade80,#15803d)',
  business: 'linear-gradient(135deg,#a78bfa,#6d28d9)',
};
const SUCCESS = '#059669', SUCCESS_DK = '#047857', SUCCESS_BG = '#F0FDF4', SUCCESS_LIGHT = '#A7F3D0';
const WARN = '#B45309', WARN_BG = '#FFFBEB', WARN_LIGHT = '#FDE68A', WARN_SOLID = '#D97706';
const ERR = '#DC2626', ERR_BG = '#FEF2F2', ERR_LIGHT = '#FCA5A5';
const PRIMARY = E.blue600;

// ─── Phone shell ────────────────────────────────────────────────────────────

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

function StatusPill({ kind }) {
  const map = {
    confirmed: { label:'Confirmed', bg:SUCCESS_BG, fg:SUCCESS_DK, bd:SUCCESS_LIGHT },
    pending:   { label:'Pending approval', bg:WARN_BG, fg:WARN, bd:WARN_LIGHT },
    cancelled: { label:'Cancelled', bg:E.sunken, fg:E.fg3, bd:E.border },
    completed: { label:'Completed', bg:E.sunken, fg:E.fg3, bd:E.border },
    noshow:    { label:'No-show', bg:ERR_BG, fg:ERR, bd:ERR_LIGHT },
  }[kind];
  return <span style={{ display:'inline-flex', alignItems:'center', padding:'3px 9px', borderRadius:9999, background:map.bg, color:map.fg, border:`1px solid ${map.bd}`, fontSize:10, fontWeight:700, whiteSpace:'nowrap' }}>{map.label}</span>;
}

function TopBar({ status }) {
  return (
    <div style={{ display:'flex', alignItems:'center', padding:'6px 8px', height:46, boxSizing:'border-box', background:E.surface, borderBottom:`1px solid ${E.border}`, flexShrink:0, zIndex:5 }}>
      <button aria-label="Back" style={{ width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'none', cursor:'pointer', color:E.fg1, padding:0 }}><i data-lucide="chevron-left" style={{ width:21, height:21 }}/></button>
      <div style={{ flex:1 }}/>
      {status && <StatusPill kind={status}/>}
      <button aria-label="More actions" style={{ width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'none', cursor:'pointer', color:E.fg2, padding:0, marginLeft:6 }}><i data-lucide="more-vertical" style={{ width:19, height:19 }}/></button>
    </div>
  );
}

function Phone({ label, children }) {
  return (
    <div style={{ width:300, height:620, borderRadius:40, padding:8, background:'#0b0f17', boxShadow:'0 24px 50px rgba(17,24,39,0.20), 0 0 0 1px rgba(0,0,0,0.12)', flexShrink:0 }} data-screen-label={label}>
      <div style={{ width:'100%', height:'100%', background:E.bg, borderRadius:32, overflow:'hidden', position:'relative', display:'flex', flexDirection:'column', fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div style={{ position:'absolute', top:7, left:'50%', transform:'translateX(-50%)', width:88, height:24, borderRadius:16, background:'#000', zIndex:50 }}/>
        <DarkStatusBar/>
        {children}
        <div style={{ position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)', width:100, height:4, borderRadius:4, background:'rgba(0,0,0,0.22)', zIndex:70 }}/>
      </div>
    </div>
  );
}

// ─── Header + section cards ─────────────────────────────────────────────────

function Header({ title, time, pillar, dim }) {
  const s = ID[pillar];
  return (
    <div style={{ padding:'16px 16px 14px', opacity: dim ? 0.62 : 1 }}>
      <h1 style={{ margin:0, fontSize:21, fontWeight:700, color:E.fg1, letterSpacing:-0.4, lineHeight:'26px' }}>{title}</h1>
      <div style={{ fontSize:13, color:E.fg2, marginTop:6, fontWeight:500 }}>{time}</div>
      <div style={{ display:'inline-flex', alignItems:'center', gap:6, marginTop:11, padding:'4px 10px', background:s.bg, borderRadius:9999 }}>
        <span style={{ width:7, height:7, borderRadius:'50%', background:s.color }}/>
        <span style={{ fontSize:11, fontWeight:700, color:s.color }}>{s.label}</span>
      </div>
    </div>
  );
}

function Card({ overline, icon, children, accent }) {
  return (
    <div style={{ background:E.surface, border:`1px solid ${E.border}`, borderRadius:16, boxShadow:'0 1px 3px rgba(0,0,0,0.04)', padding:'13px 13px', margin:'0 16px 11px' }}>
      {overline && (
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:11 }}>
          <i data-lucide={icon} style={{ width:13, height:13, color:accent||E.fg3 }}/>
          <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:E.fg3 }}>{overline}</span>
        </div>
      )}
      {children}
    </div>
  );
}

function Avatar({ pillar, initials, size=40 }) {
  return (
    <div style={{ position:'relative', flexShrink:0 }}>
      <div style={{ width:size, height:size, borderRadius:'50%', background:AV[pillar], display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:size*0.34, fontWeight:700, letterSpacing:-0.3 }}>{initials}</div>
      <div style={{ position:'absolute', right:-2, bottom:-2, width:16, height:16, borderRadius:'50%', background:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <i data-lucide="badge-check" style={{ width:15, height:15, color:ID[pillar].color }}/>
      </div>
    </div>
  );
}

function AttendeeRow({ pillar, initials, name, sub }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:11 }}>
      <Avatar pillar={pillar} initials={initials}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:14, fontWeight:700, color:E.fg1, letterSpacing:-0.1 }}>{name}</div>
        <div style={{ fontSize:11.5, color:E.fg3, marginTop:2 }}>{sub}</div>
      </div>
      <button aria-label="Message" style={{ width:36, height:36, borderRadius:10, border:`1px solid ${E.border}`, background:E.surface, color:E.blue600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="message-circle" style={{ width:17, height:17 }}/></button>
    </div>
  );
}

function InfoRow({ icon, label, value, accent }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:11 }}>
      <div style={{ width:34, height:34, borderRadius:9, background:E.sunken, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i data-lucide={icon} style={{ width:16, height:16, color:accent||E.fg2 }}/></div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600, color:E.fg1 }}>{value}</div>
        <div style={{ fontSize:11, color:E.fg3, marginTop:1 }}>{label}</div>
      </div>
    </div>
  );
}

function Accordion({ label, count }) {
  return (
    <button style={{ width:'100%', display:'flex', alignItems:'center', gap:10, background:'transparent', border:'none', padding:0, cursor:'pointer' }}>
      <div style={{ width:34, height:34, borderRadius:9, background:E.sunken, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i data-lucide="clipboard-list" style={{ width:16, height:16, color:E.fg2 }}/></div>
      <div style={{ flex:1, textAlign:'left' }}>
        <div style={{ fontSize:13, fontWeight:600, color:E.fg1 }}>Intake answers</div>
        <div style={{ fontSize:11, color:E.fg3, marginTop:1 }}>{count} answers</div>
      </div>
      <i data-lucide="chevron-down" style={{ width:18, height:18, color:E.fg4 }}/>
    </button>
  );
}

function Timeline({ steps }) {
  return (
    <div style={{ display:'flex', flexDirection:'column' }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display:'flex', gap:11, alignItems:'flex-start' }}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
            <div style={{ width:18, height:18, borderRadius:'50%', background: s.done ? SUCCESS : E.surface, border: s.done ? 'none' : `2px dashed ${E.borderStrong}`, display:'flex', alignItems:'center', justifyContent:'center' }}>{s.done && <i data-lucide="check" style={{ width:11, height:11, color:'#fff', strokeWidth:3 }}/>}</div>
            {i < steps.length - 1 && <div style={{ width:2, height:22, background: s.done ? SUCCESS_LIGHT : E.border, borderRadius:2, margin:'2px 0' }}/>}
          </div>
          <div style={{ paddingBottom: i < steps.length - 1 ? 6 : 0 }}>
            <div style={{ fontSize:12.5, fontWeight:600, color: s.done ? E.fg1 : E.fg3 }}>{s.label}</div>
            {s.time && <div style={{ fontSize:10.5, color:E.fg4, marginTop:1 }}>{s.time}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Scroll({ children, dim }) {
  return <div style={{ flex:1, overflow:'auto', paddingBottom:96, opacity: dim ? 0.96 : 1 }}>{children}</div>;
}

// Sticky CTA dock
function Dock({ children }) {
  return (
    <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:30, padding:'12px 16px 22px', background:'rgba(255,255,255,0.97)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', borderTop:`1px solid ${E.border}`, display:'flex', gap:9 }}>{children}</div>
  );
}
function BtnGhost({ children, tone }) {
  const color = tone === 'danger' ? ERR : E.fg2;
  return <button style={{ flex:1, height:46, borderRadius:12, border:`1px solid ${tone==='danger'?ERR_LIGHT:E.borderStrong}`, background:E.surface, color, fontSize:14, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6 }}>{children}</button>;
}
function BtnPrimary({ children }) {
  return <button style={{ flex:1, height:46, borderRadius:12, border:'none', background:PRIMARY, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', boxShadow:'0 6px 16px rgba(2,132,199,0.28)', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6 }}>{children}</button>;
}

function ConflictBanner() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:9, margin:'0 16px 11px', padding:'10px 12px', background:WARN_BG, border:`1px solid ${WARN_LIGHT}`, borderRadius:12 }}>
      <i data-lucide="triangle-alert" style={{ width:17, height:17, color:WARN_SOLID, flexShrink:0 }}/>
      <span style={{ fontSize:11.5, color:WARN, fontWeight:600, lineHeight:'15px', flex:1 }}>This overlaps another booking</span>
      <button style={{ background:'transparent', border:'none', color:WARN, fontSize:11.5, fontWeight:700, cursor:'pointer', padding:0 }}>View</button>
    </div>
  );
}

// ─── FRAME 1 · CONFIRMED / UPCOMING ─────────────────────────────────────────

function FrameConfirmed() {
  return (
    <Phone label="Booking detail · Confirmed">
      <TopBar status="confirmed"/>
      <Scroll>
        <Header title="30-min intro call" time="Thu, Jun 18 · 2:00–2:30 PM · PT" pillar="personal"/>
        <Card overline="Requester" icon="user" accent={ID.personal.color}>
          <AttendeeRow pillar="personal" initials="DA" name="Dana Whitfield" sub="Verified neighbor · Riverside"/>
        </Card>
        <Card overline="Location" icon="video" accent={ID.personal.color}>
          <InfoRow icon="video" label="Video call · link sent on confirm" value="Pantopus Video" accent={E.blue600}/>
        </Card>
        <Card><Accordion count="3"/></Card>
        <Card overline="Status" icon="activity" accent={ID.personal.color}>
          <Timeline steps={[
            { label:'Requested', time:'Jun 12 · 9:04 AM', done:true },
            { label:'Confirmed', time:'Jun 12 · 9:11 AM', done:true },
            { label:'Reminder sent', time:'24h before', done:false },
            { label:'Meeting', time:'Jun 18 · 2:00 PM', done:false },
          ]}/>
        </Card>
      </Scroll>
      <Dock>
        <BtnGhost><i data-lucide="calendar-clock" style={{ width:16, height:16 }}/>Reschedule</BtnGhost>
        <BtnPrimary><i data-lucide="message-circle" style={{ width:16, height:16 }}/>Message</BtnPrimary>
      </Dock>
    </Phone>
  );
}

// ─── FRAME 2 · PENDING ──────────────────────────────────────────────────────

function FramePending() {
  return (
    <Phone label="Booking detail · Pending">
      <TopBar status="pending"/>
      <Scroll>
        <Header title="Studio consultation" time="Mon, Jun 16 · 11:00–11:45 AM · PT" pillar="business"/>
        <Card overline="Requester" icon="user" accent={ID.business.color}>
          <AttendeeRow pillar="business" initials="RC" name="Rosa Calderón" sub="Verified · first-time booker"/>
        </Card>
        <Card overline="Assigned member" icon="user-round" accent={ID.business.color}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:30, height:30, borderRadius:'50%', background:AV.business, color:'#fff', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>PR</div>
            <div style={{ flex:1, fontSize:13, fontWeight:600, color:E.fg1 }}>Priya R.</div>
            <button style={{ fontSize:12, fontWeight:700, color:'#7c3aed', background:'transparent', border:'none', cursor:'pointer' }}>Reassign</button>
          </div>
        </Card>
        <Card><Accordion count="4"/></Card>
      </Scroll>
      <Dock>
        <BtnGhost tone="danger"><i data-lucide="x" style={{ width:16, height:16 }}/>Decline</BtnGhost>
        <BtnPrimary><i data-lucide="check" style={{ width:16, height:16 }}/>Approve</BtnPrimary>
      </Dock>
    </Phone>
  );
}

// ─── FRAME 3 · PAST · NEEDS FOLLOW-UP ───────────────────────────────────────

function FramePast() {
  return (
    <Phone label="Booking detail · Past follow-up">
      <TopBar status="completed"/>
      <Scroll>
        <Header title="Garden walkthrough" time="Mon, Jun 9 · 4:30–5:00 PM · PT" pillar="home"/>
        <div style={{ display:'flex', alignItems:'flex-start', gap:9, margin:'0 16px 11px', padding:'11px 12px', background:E.blue50, border:`1px solid ${E.blue200}`, borderRadius:12 }}>
          <i data-lucide="sparkles" style={{ width:16, height:16, color:E.blue600, flexShrink:0, marginTop:1 }}/>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12.5, fontWeight:700, color:E.fg1 }}>Send a follow-up</div>
            <div style={{ fontSize:11, color:E.fg3, marginTop:2, lineHeight:'15px' }}>Thank Mara and offer a time to book again.</div>
          </div>
        </div>
        <Card overline="Attendee" icon="user" accent={ID.home.color}>
          <AttendeeRow pillar="home" initials="MR" name="Mara Reyes" sub="Verified neighbor"/>
        </Card>
        <Card overline="Status" icon="activity" accent={ID.home.color}>
          <Timeline steps={[
            { label:'Confirmed', time:'Jun 4', done:true },
            { label:'Met', time:'Jun 9 · 4:30 PM', done:true },
            { label:'Follow-up', time:'Pending', done:false },
          ]}/>
        </Card>
      </Scroll>
      <Dock>
        <BtnGhost><i data-lucide="rotate-ccw" style={{ width:16, height:16 }}/>Rebook</BtnGhost>
        <BtnPrimary><i data-lucide="send" style={{ width:16, height:16 }}/>Follow up</BtnPrimary>
      </Dock>
    </Phone>
  );
}

// ─── FRAME 4 · CANCELLED ────────────────────────────────────────────────────

function FrameCancelled() {
  return (
    <Phone label="Booking detail · Cancelled">
      <TopBar status="cancelled"/>
      <Scroll dim>
        <Header title="Brand strategy session" time="Fri, Jun 13 · 1:30–2:30 PM · PT" pillar="business" dim/>
        <div style={{ display:'flex', alignItems:'center', gap:9, margin:'0 16px 11px', padding:'10px 12px', background:E.sunken, border:`1px solid ${E.border}`, borderRadius:12 }}>
          <i data-lucide="circle-slash" style={{ width:16, height:16, color:E.fg3, flexShrink:0 }}/>
          <span style={{ fontSize:11.5, color:E.fg2, fontWeight:600, lineHeight:'15px' }}>Cancelled by host on Jun 11 · "Schedule conflict"</span>
        </div>
        <Card overline="Refund" icon="receipt" accent={E.fg3}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:13, color:E.fg2 }}>Refunded to card</span>
            <span style={{ fontSize:14, fontWeight:700, color:SUCCESS_DK, fontVariantNumeric:'tabular-nums' }}>$120.00</span>
          </div>
          <div style={{ fontSize:11, color:E.fg3, marginTop:6 }}>Full refund issued · within free-cancellation window</div>
        </Card>
        <Card overline="Attendee" icon="user" accent={E.fg3}>
          <AttendeeRow pillar="business" initials="LM" name="Lena Marsh" sub="Verified neighbor"/>
        </Card>
      </Scroll>
      <Dock>
        <BtnPrimary><i data-lucide="rotate-ccw" style={{ width:16, height:16 }}/>Rebook this time</BtnPrimary>
      </Dock>
    </Phone>
  );
}

// ─── FRAME 5 · NO-SHOW ──────────────────────────────────────────────────────

function FrameNoShow() {
  return (
    <Phone label="Booking detail · No-show">
      <TopBar status="noshow"/>
      <Scroll>
        <Header title="Coffee chat" time="Sat, Jun 7 · 1:00–1:30 PM · PT" pillar="personal"/>
        <div style={{ display:'flex', alignItems:'center', gap:9, margin:'0 16px 11px', padding:'10px 12px', background:ERR_BG, border:`1px solid ${ERR_LIGHT}`, borderRadius:12 }}>
          <i data-lucide="user-x" style={{ width:16, height:16, color:ERR, flexShrink:0 }}/>
          <span style={{ fontSize:11.5, color:ERR, fontWeight:600, lineHeight:'15px' }}>Marked no-show · Jordan didn't attend</span>
        </div>
        <Card overline="Attendee" icon="user" accent={ID.personal.color}>
          <AttendeeRow pillar="personal" initials="JL" name="Jordan Liu" sub="Verified neighbor"/>
        </Card>
        <Card overline="Status" icon="activity" accent={ID.personal.color}>
          <Timeline steps={[
            { label:'Confirmed', time:'Jun 3', done:true },
            { label:'No-show', time:'Jun 7 · 1:15 PM', done:true },
          ]}/>
        </Card>
      </Scroll>
      <Dock>
        <BtnGhost><i data-lucide="message-circle" style={{ width:16, height:16 }}/>Message</BtnGhost>
        <BtnPrimary><i data-lucide="link" style={{ width:16, height:16 }}/>Send rebook link</BtnPrimary>
      </Dock>
    </Phone>
  );
}

// ─── FRAME 6 · CONFLICT WARNING ─────────────────────────────────────────────

function FrameConflict() {
  return (
    <Phone label="Booking detail · Conflict">
      <TopBar status="pending"/>
      <Scroll>
        <Header title="Discovery call" time="Sat, Jun 14 · 3:00–3:45 PM · PT" pillar="business"/>
        <Card overline="Requester" icon="user" accent={ID.business.color}>
          <AttendeeRow pillar="business" initials="WH" name="Wes Holt" sub="Verified · first-time booker"/>
        </Card>
        <Card overline="Assigned member" icon="user-round" accent={ID.business.color}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:30, height:30, borderRadius:'50%', background:AV.business, color:'#fff', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>DV</div>
            <div style={{ flex:1, fontSize:13, fontWeight:600, color:E.fg1 }}>Devon M.</div>
            <button style={{ fontSize:12, fontWeight:700, color:'#7c3aed', background:'transparent', border:'none', cursor:'pointer' }}>Reassign</button>
          </div>
        </Card>
      </Scroll>
      <ConflictBanner/>
      <Dock>
        <BtnGhost tone="danger"><i data-lucide="x" style={{ width:16, height:16 }}/>Decline</BtnGhost>
        <BtnPrimary><i data-lucide="check" style={{ width:16, height:16 }}/>Approve</BtnPrimary>
      </Dock>
    </Phone>
  );
}

// ─── FRAME 7 · REASSIGNING (Business) ───────────────────────────────────────

function FrameReassigning() {
  const members = [
    { i:'PR', n:'Priya R.', meta:'Open · 2 today', on:true },
    { i:'DV', n:'Devon M.', meta:'Open · 1 today', on:false },
    { i:'AK', n:'Aria K.', meta:'Busy · 5 today', on:false, busy:true },
  ];
  return (
    <Phone label="Booking detail · Reassigning">
      <TopBar status="confirmed"/>
      <Scroll>
        <Header title="Studio consultation" time="Sat, Jun 14 · 10:00–10:45 AM · PT" pillar="business"/>
        <Card overline="Reassign to" icon="users" accent={ID.business.color}>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {members.map((m) => (
              <div key={m.i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 9px', borderRadius:11, border:`1.5px solid ${m.on?'#7c3aed':E.border}`, background:m.on?ID.business.bg:E.surface, opacity:m.busy?0.55:1 }}>
                <div style={{ width:30, height:30, borderRadius:'50%', background:AV.business, color:'#fff', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>{m.i}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12.5, fontWeight:700, color:E.fg1 }}>{m.n}</div>
                  <div style={{ fontSize:10.5, color:m.busy?ERR:E.fg3, marginTop:1 }}>{m.meta}</div>
                </div>
                {m.on && <i data-lucide="check-circle-2" style={{ width:18, height:18, color:'#7c3aed' }}/>}
              </div>
            ))}
          </div>
        </Card>
      </Scroll>
      <Dock>
        <BtnGhost>Cancel</BtnGhost>
        <BtnPrimary><i data-lucide="user-check" style={{ width:16, height:16 }}/>Reassign</BtnPrimary>
      </Dock>
    </Phone>
  );
}

// ─── FRAME 8 · MEMBER VIEW (reduced dock) ───────────────────────────────────

function FrameMember() {
  return (
    <Phone label="Booking detail · Member view">
      <TopBar status="confirmed"/>
      <Scroll>
        <Header title="Studio consultation" time="Today · 10:00–10:45 AM · PT" pillar="business"/>
        <div style={{ display:'flex', alignItems:'center', gap:9, margin:'0 16px 11px', padding:'9px 12px', background:E.blue50, border:`1px solid ${E.blue200}`, borderRadius:12 }}>
          <i data-lucide="user-check" style={{ width:16, height:16, color:E.blue600, flexShrink:0 }}/>
          <span style={{ fontSize:11, color:E.fg2, fontWeight:600 }}>This booking is assigned to you</span>
        </div>
        <Card overline="Requester" icon="user" accent={ID.business.color}>
          <AttendeeRow pillar="business" initials="TK" name="Theo Kemp" sub="Verified neighbor"/>
        </Card>
        <Card overline="Location" icon="map-pin" accent={ID.business.color}>
          <InfoRow icon="map-pin" label="Acme Studio · 4th & Main" value="In person" accent="#7c3aed"/>
        </Card>
        <Card><Accordion count="3"/></Card>
      </Scroll>
      <Dock>
        <BtnGhost><i data-lucide="calendar-clock" style={{ width:16, height:16 }}/>Reschedule</BtnGhost>
        <BtnPrimary><i data-lucide="message-circle" style={{ width:16, height:16 }}/>Message</BtnPrimary>
      </Dock>
    </Phone>
  );
}

// ─── FRAME 9 · LOADING ──────────────────────────────────────────────────────

function FrameLoading() {
  const SkCard = ({ h }) => (
    <div style={{ background:E.surface, border:`1px solid ${E.border}`, borderRadius:16, boxShadow:'0 1px 3px rgba(0,0,0,0.04)', padding:'13px', margin:'0 16px 11px', display:'flex', alignItems:'center', gap:11 }}>
      <div style={{ width:40, height:40, borderRadius:'50%', flexShrink:0, ...SH }}/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:7 }}>
        <div style={{ width:'60%', height:11, borderRadius:5, ...SH }}/>
        <div style={{ width:'40%', height:9, borderRadius:5, ...SH }}/>
      </div>
    </div>
  );
  return (
    <Phone label="Booking detail · Loading">
      <TopBar/>
      <Scroll>
        <div style={{ padding:'16px' }}>
          <div style={{ width:'70%', height:20, borderRadius:6, ...SH }}/>
          <div style={{ width:'55%', height:12, borderRadius:5, marginTop:10, ...SH }}/>
          <div style={{ width:90, height:22, borderRadius:9999, marginTop:12, ...SH }}/>
        </div>
        <SkCard/><SkCard/><SkCard/>
      </Scroll>
    </Phone>
  );
}

// ─── FRAME 10 · ERROR ───────────────────────────────────────────────────────

function FrameError() {
  return (
    <Phone label="Booking detail · Error">
      <TopBar/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'20px 30px 60px', gap:18 }}>
        <div style={{ width:72, height:72, borderRadius:'50%', background:ERR_BG, color:ERR, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <i data-lucide="cloud-off" style={{ width:32, height:32, strokeWidth:1.8 }}/>
        </div>
        <div>
          <h2 style={{ margin:0, fontSize:17, fontWeight:700, color:E.fg1, letterSpacing:-0.2 }}>Couldn't load this booking</h2>
          <p style={{ margin:'8px 0 0', fontSize:12.5, color:E.fg3, lineHeight:'18px', maxWidth:220 }}>Check your connection and try again.</p>
        </div>
        <button style={{ height:44, padding:'0 18px', borderRadius:12, border:`1px solid ${E.borderStrong}`, cursor:'pointer', background:E.surface, color:E.fg1, fontSize:13.5, fontWeight:700, display:'inline-flex', alignItems:'center', gap:7 }}>
          <i data-lucide="rotate-cw" style={{ width:16, height:16, strokeWidth:2.2 }}/>Try again
        </button>
      </div>
    </Phone>
  );
}

Object.assign(window, {
  FrameConfirmed, FramePending, FramePast, FrameCancelled, FrameNoShow,
  FrameConflict, FrameReassigning, FrameMember, FrameLoading, FrameError,
});
