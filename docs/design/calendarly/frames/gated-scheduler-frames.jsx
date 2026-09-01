// F15 — Permission-Gated Scheduler View (member, read-only) · 300×620 · Home green
// A render-mode of the Home Calendar/Agenda for a member lacking calendar.edit.
// Frames: read-only · own-assignments-actionable · access-requested-pending

const { N, H, M } = window;
const { Phone, Card, Banner, MonthStrip, DaySection, EventRow, CatChip, AvatarStack } = window;

const SKY = '#0284c7', SKYBG = '#f0f9ff', SKYBG2 = '#bae6fd';

// Gated top bar — title left, right = request-access affordance.
function GatedTopBar({ requested }) {
  return (
    <div style={{ display:'flex', alignItems:'center', padding:'6px 10px', height:46, boxSizing:'border-box', background:N.surface, borderBottom:`1px solid ${N.border}`, flexShrink:0 }}>
      <div style={{ flex:1, fontSize:15.5, fontWeight:600, color:N.fg1, letterSpacing:-0.2 }}>Calendar</div>
      {requested ? (
        <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:9999, background:N.sunken, color:N.fg4, fontSize:11, fontWeight:700 }}><i data-lucide="clock" style={{ width:12, height:12 }}/>Request sent</span>
      ) : (
        <button style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:9999, background:H.bg50, border:`1px solid ${H.bg200}`, color:H.accent700, fontSize:11, fontWeight:700, cursor:'pointer' }}><i data-lucide="shield-plus" style={{ width:12, height:12 }}/>Ask to manage</button>
      )}
    </div>
  );
}

function HintBar({ text='You can view the schedule. Ask an admin to make changes.' }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:N.infoBg, borderBottom:`1px solid ${N.infoLight}`, flexShrink:0 }}>
      <i data-lucide="eye" style={{ width:14, height:14, color:N.info, flexShrink:0 }}/>
      <span style={{ fontSize:11, color:'#075985', fontWeight:500, lineHeight:'15px' }}>{text}</span>
    </div>
  );
}

// "Your slot" actionable row — Support-train sky-outline pattern.
function AssignmentRow({ time, ampm, title, loc, cat }) {
  return (
    <div style={{ background:SKYBG, border:`1.5px solid ${SKYBG2}`, borderRadius:16, padding:'11px 12px', boxShadow:'0 1px 3px rgba(2,132,199,0.08)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:11 }}>
        <div style={{ width:42, flexShrink:0, textAlign:'center' }}>
          <div style={{ fontSize:13, fontWeight:700, color:N.fg1, fontVariantNumeric:'tabular-nums' }}>{time}</div>
          <div style={{ fontSize:9.5, fontWeight:600, color:N.fg4, marginTop:1 }}>{ampm}</div>
        </div>
        <div style={{ width:1, alignSelf:'stretch', background:SKYBG2 }}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:13.5, fontWeight:700, color:N.fg1, letterSpacing:-0.2 }}>{title}</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:7, marginTop:4 }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 7px', borderRadius:9999, background:'#dbeafe', color:SKY, fontSize:9.5, fontWeight:700, whiteSpace:'nowrap', flexShrink:0 }}><i data-lucide="user-check" style={{ width:10, height:10 }}/>Your slot</span>
            {loc && <span style={{ fontSize:10.5, color:N.fg3 }}>{loc}</span>}
          </div>
        </div>
      </div>
      <div style={{ display:'flex', gap:8, marginTop:10 }}>
        <button style={{ flex:1, height:34, borderRadius:9, border:'none', background:H.accent, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:5 }}><i data-lucide="check" style={{ width:13, height:13 }}/>Accept</button>
        <button style={{ flex:1, height:34, borderRadius:9, border:`1px solid ${N.borderStrong}`, background:N.surface, color:N.fg2, fontSize:12, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:5 }}><i data-lucide="x" style={{ width:13, height:13 }}/>Decline</button>
      </div>
    </div>
  );
}

function AgendaBody({ children }) {
  return <div style={{ flex:1, overflow:'auto', padding:'10px 12px 20px', display:'flex', flexDirection:'column', gap:8 }}>{children}</div>;
}

const DAY1 = [
  { time:'8:00', ampm:'AM', title:'Trash out', loc:'Curb', cat:'chore', members:[M.dad] },
  { time:'3:30', ampm:'PM', title:'Pediatrician — Ava', loc:'Northside', cat:'health', members:[M.mom, M.ava] },
  { time:'6:30', ampm:'PM', title:'Family dinner', loc:'Kitchen', cat:'meal', members:[M.mom, M.dad, M.ava] },
];

// ─── FRAME 1 · READ-ONLY ───────────────────────────────────────
function FrameReadOnly() {
  return (
    <Phone label="Gated scheduler · Read-only">
      <GatedTopBar/>
      <HintBar/>
      <MonthStrip/>
      <AgendaBody>
        <DaySection>Today · Mon Jun 16</DaySection>
        {DAY1.map((e, i) => <EventRow key={i} {...e}/>)}
        <DaySection>Tomorrow · Tue Jun 17</DaySection>
        <EventRow time="9:00" ampm="AM" title="School drop-off" loc="Lincoln" cat="school" members={[M.dad]}/>
        <EventRow time="7:00" ampm="PM" title="Soccer practice" loc="Field 3" cat="family" members={[M.ava]}/>
      </AgendaBody>
    </Phone>
  );
}

// ─── FRAME 2 · OWN-ASSIGNMENTS-ACTIONABLE ──────────────────────
function FrameAssignments() {
  return (
    <Phone label="Gated scheduler · My assignments">
      <GatedTopBar/>
      <HintBar/>
      <AgendaBody>
        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'2px 2px 0' }}>
          <i data-lucide="user-check" style={{ width:13, height:13, color:SKY }}/>
          <span style={{ fontSize:11, fontWeight:700, color:SKY, textTransform:'uppercase', letterSpacing:0.06 }}>My assignments · 2</span>
        </div>
        <AssignmentRow time="5:00" ampm="PM" title="Let the plumber in" loc="Front door" cat="visit"/>
        <AssignmentRow time="8:00" ampm="AM" title="Trash out" loc="Curb" cat="chore"/>
        <div style={{ height:4 }}/>
        <DaySection>Rest of the schedule</DaySection>
        {DAY1.slice(1).map((e, i) => <EventRow key={i} {...e}/>)}
      </AgendaBody>
    </Phone>
  );
}

// ─── FRAME 3 · ACCESS-REQUESTED-PENDING ────────────────────────
function FramePending() {
  return (
    <Phone label="Gated scheduler · Request pending">
      <GatedTopBar requested/>
      <div style={{ padding:'10px 12px 0', flexShrink:0 }}>
        <Banner tone="info" icon="clock" title="Request sent">We asked an admin to give you scheduling access. You'll be notified when they respond.</Banner>
      </div>
      <MonthStrip/>
      <AgendaBody>
        <DaySection>Today · Mon Jun 16</DaySection>
        {DAY1.map((e, i) => <EventRow key={i} {...e}/>)}
      </AgendaBody>
    </Phone>
  );
}

Object.assign(window, { FrameReadOnly, FrameAssignments, FramePending });
