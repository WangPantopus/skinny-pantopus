// F14 — Visit Detail (full screen, v2) · 300×620 · Home green
// EventDetail/SupportTrainDetail header + status timeline + folded-in Share/Manage.
// 9 states: offered · reserved · confirmed · completed · cancelled · no-show
//           · active-link · expired-link · revoked

const { N, H, M } = window;
const { Phone, TopBar, Card, Overline, Avatar, AvatarStack, PrimaryBtn, SecondaryBtn, TextBtn, StickyFooter, Banner } = window;

const STEPS = ['Offered', 'Reserved', 'Confirmed', 'Done'];

function StatusTimeline({ current, terminal }) {
  // current: index of active step (0..3). terminal: {label, tone} replaces forward steps.
  return (
    <Card>
      <Overline color={H.accent700} style={{ marginBottom:12 }}>Status</Overline>
      <div style={{ display:'flex', alignItems:'flex-start' }}>
        {STEPS.map((s, i) => {
          const done = i < current;
          const active = i === current;
          const tcol = terminal && i > current ? N.fg4 : (done||active ? H.accent : N.fg4);
          return (
            <React.Fragment key={s}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5, flex:'0 0 auto', width:46 }}>
                <div style={{ width:22, height:22, borderRadius:'50%', background:(done||active)&&!terminal?H.accent:(done||active)?H.accent:N.sunken, color:(done||active)?'#fff':N.fg4, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:active?`0 0 0 2px ${H.accent}, 0 0 0 4px ${H.bg100}`:'none' }}>
                  {done ? <i data-lucide="check" style={{ width:11, height:11, strokeWidth:3 }}/> : <span style={{ fontSize:10, fontWeight:700 }}>{i+1}</span>}
                </div>
                <span style={{ fontSize:9, fontWeight:active?700:500, color:active?H.accent700:(done?N.fg2:N.fg4), textAlign:'center' }}>{s}</span>
              </div>
              {i < STEPS.length-1 && <div style={{ flex:1, height:2, background: i<current?H.accent:N.border, marginTop:10, borderRadius:2 }}/>}
            </React.Fragment>
          );
        })}
      </div>
    </Card>
  );
}

function HeaderCard({ time, timeTone, terminalChip }) {
  const tc = timeTone==='muted'?N.fg3:timeTone==='warn'?N.warning:timeTone==='error'?N.error:H.accent700;
  return (
    <Card style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:44, height:44, borderRadius:'50%', background:CATV, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:700, flexShrink:0 }}>PV</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:16, fontWeight:700, color:N.fg1, letterSpacing:-0.3 }}>Plumber visit</div>
          <span style={{ display:'inline-flex', alignItems:'center', gap:4, marginTop:5, padding:'2px 8px', borderRadius:9999, background:'#ccfbf1', color:'#0f766e', fontSize:10, fontWeight:700 }}><i data-lucide="wrench" style={{ width:10, height:10 }}/>Vendor</span>
        </div>
        {terminalChip && <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'4px 9px', borderRadius:9999, background:terminalChip.bg, color:terminalChip.fg, fontSize:10, fontWeight:700 }}><i data-lucide={terminalChip.icon} style={{ width:11, height:11 }}/>{terminalChip.label}</span>}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 11px', background:N.sunken, borderRadius:9 }}>
        <i data-lucide="clock" style={{ width:14, height:14, color:tc }}/>
        <span style={{ fontSize:12.5, fontWeight:700, color:tc }}>{time}</span>
      </div>
    </Card>
  );
}
const CATV = 'linear-gradient(135deg, #2dd4bf, #0d9488)';

function HostsCard() {
  return (
    <Card>
      <Overline style={{ marginBottom:9 }}>Host members</Overline>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <AvatarStack members={[M.dad]} size={30}/>
        <span style={{ fontSize:12.5, fontWeight:600, color:N.fg1 }}>Dad must be home</span>
      </div>
    </Card>
  );
}

function AccessCard() {
  return (
    <Card style={{ display:'flex', alignItems:'center', gap:11 }}>
      <div style={{ width:32, height:32, borderRadius:9, flexShrink:0, background:N.sunken, color:N.fg2, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="key-round" style={{ width:16, height:16 }}/></div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:N.fg4 }}>Entry note</div>
        <div style={{ fontSize:12.5, fontWeight:600, color:N.fg1, marginTop:2 }}>Front door · code 4827</div>
      </div>
      <i data-lucide="chevron-right" style={{ width:16, height:16, color:N.fg4 }}/>
    </Card>
  );
}

function ShareManage({ linkState='active', reserved=3, open=5 }) {
  const map = {
    active:  { tone:'ok', bg:N.successBg, fg:'#047857', dot:N.success, label:'Link active', code:'pantopus.com/visit/maple-plumber' },
    expired: { tone:'muted', bg:N.sunken, fg:N.fg3, dot:N.fg4, label:'Link expired', code:'pantopus.com/visit/maple-plumber' },
    revoked: { tone:'error', bg:N.errorBg, fg:'#b91c1c', dot:N.error, label:'Link revoked', code:'pantopus.com/visit/maple-plumber' },
  }[linkState];
  return (
    <Card>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <Overline color={H.accent700}>Share &amp; manage</Overline>
        <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:9999, background:map.bg, color:map.fg, fontSize:9.5, fontWeight:700 }}><span style={{ width:6, height:6, borderRadius:'50%', background:map.dot }}/>{map.label}</span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8, background:N.surface, border:`1px solid ${N.border}`, borderRadius:10, padding:'9px 10px', opacity:linkState==='active'?1:0.6 }}>
        <i data-lucide="link" style={{ width:15, height:15, color:linkState==='active'?H.accent:N.fg4, flexShrink:0 }}/>
        <code style={{ flex:1, minWidth:0, fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize:11, color:N.fg2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textDecoration: linkState==='revoked'?'line-through':'none' }}>{map.code}</code>
      </div>
      {linkState==='active' && (
        <div style={{ display:'flex', gap:8, marginTop:9 }}>
          <button style={{ flex:1, height:36, borderRadius:9, border:`1px solid ${H.bg200}`, background:H.bg50, color:H.accent700, fontSize:12, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:5 }}><i data-lucide="copy" style={{ width:13, height:13 }}/>Copy</button>
          <button style={{ flex:1, height:36, borderRadius:9, border:`1px solid ${N.border}`, background:N.surface, color:N.fg2, fontSize:12, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:5 }}><i data-lucide="qr-code" style={{ width:13, height:13 }}/>QR</button>
        </div>
      )}
      <div style={{ display:'flex', alignItems:'center', gap:7, marginTop:11, padding:'8px 10px', background:N.muted, borderRadius:9 }}>
        <i data-lucide="calendar-clock" style={{ width:14, height:14, color:H.accent }}/>
        <span style={{ fontSize:11.5, fontWeight:600, color:N.fg2 }}>Slots: {reserved} reserved · {open} open</span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:14, marginTop:11, paddingTop:11, borderTop:`1px solid ${N.border}` }}>
        {linkState==='active' && <><TextBtn tone={N.error} icon="ban">Revoke</TextBtn><TextBtn tone={N.fg2} icon="calendar-plus">Extend</TextBtn></>}
        {linkState==='expired' && <button style={{ flex:1, height:36, borderRadius:9, border:'none', background:H.accent, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:5 }}><i data-lucide="calendar-plus" style={{ width:13, height:13 }}/>Extend the window</button>}
        {linkState==='revoked' && <button style={{ flex:1, height:36, borderRadius:9, border:'none', background:H.accent, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:5 }}><i data-lucide="rotate-cw" style={{ width:13, height:13 }}/>Re-issue link</button>}
        {linkState==='active' && <div style={{ flex:1, textAlign:'right' }}><TextBtn tone={H.accent700} icon="external-link">Preview</TextBtn></div>}
      </div>
    </Card>
  );
}

function Body({ children }) {
  return <div style={{ flex:1, overflow:'auto', padding:'12px 12px 80px', display:'flex', flexDirection:'column', gap:11 }}>{children}</div>;
}

function Footer({ primary, secondary, message=true }) {
  return (
    <StickyFooter>
      {secondary && <div style={{ flex:1 }}><SecondaryBtn icon={secondary.icon}>{secondary.label}</SecondaryBtn></div>}
      {primary && <div style={{ flex:1 }}><PrimaryBtn icon={primary.icon}>{primary.label}</PrimaryBtn></div>}
      {message && <TextBtn tone={N.fg2} icon="message-circle"/>}
    </StickyFooter>
  );
}

// ─── STATES ────────────────────────────────────────────────────
function VisitOffered() {
  return (
    <Phone label="Visit · Offered">
      <TopBar title="Visit" right={{ text:'Edit' }}/>
      <Body>
        <HeaderCard time="Awaiting a time" timeTone="muted"/>
        <StatusTimeline current={0}/>
        <HostsCard/>
        <ShareManage linkState="active" reserved={0} open={8}/>
      </Body>
      <Footer secondary={{ label:'Cancel', icon:'x' }} primary={{ label:'Reschedule', icon:'calendar-clock' }}/>
    </Phone>
  );
}

function VisitReserved() {
  return (
    <Phone label="Visit · Reserved">
      <TopBar title="Visit" right={{ text:'Edit' }}/>
      <Body>
        <HeaderCard time="Reserved · Sat Jun 21, 9 AM" timeTone="warn"/>
        <Banner tone="amber" icon="bell" title="Visitor picked a time">Confirm Sat Jun 21 · 9 AM to lock it in.</Banner>
        <StatusTimeline current={1}/>
        <HostsCard/>
        <ShareManage linkState="active" reserved={3} open={5}/>
      </Body>
      <Footer primary={{ label:'Confirm', icon:'check' }} secondary={{ label:'Decline', icon:'x' }}/>
    </Phone>
  );
}

function VisitConfirmed() {
  return (
    <Phone label="Visit · Confirmed">
      <TopBar title="Visit" right={{ text:'Edit' }}/>
      <Body>
        <HeaderCard time="Sat Jun 21 · 9:00–10:00 AM"/>
        <Banner tone="home" icon="calendar-check" title="On the home calendar">This visit shows on the family schedule.</Banner>
        <StatusTimeline current={2}/>
        <HostsCard/>
        <AccessCard/>
      </Body>
      <Footer secondary={{ label:'Cancel', icon:'x' }} primary={{ label:'Reschedule', icon:'calendar-clock' }}/>
    </Phone>
  );
}

function VisitCompleted() {
  return (
    <Phone label="Visit · Completed">
      <TopBar title="Visit" right={{ text:'Edit', muted:true }}/>
      <Body>
        <HeaderCard time="Done · Jun 12" timeTone="muted" terminalChip={{ label:'Completed', icon:'check', bg:N.successBg, fg:'#047857' }}/>
        <StatusTimeline current={3}/>
        <HostsCard/>
        <AccessCard/>
      </Body>
      <Footer secondary={{ label:'Book again', icon:'repeat' }}/>
    </Phone>
  );
}

function VisitCancelled() {
  return (
    <Phone label="Visit · Cancelled">
      <TopBar title="Visit" right={{ text:'Edit', muted:true }}/>
      <Body>
        <HeaderCard time="Cancelled" timeTone="error" terminalChip={{ label:'Cancelled', icon:'x', bg:N.errorBg, fg:'#b91c1c' }}/>
        <Banner tone="error" icon="x-circle" title="This visit was cancelled">No one will be able to book the link anymore.</Banner>
        <StatusTimeline current={0} terminal/>
        <HostsCard/>
      </Body>
      <Footer secondary={{ label:'Book again', icon:'repeat' }}/>
    </Phone>
  );
}

function VisitNoShow() {
  return (
    <Phone label="Visit · No-show">
      <TopBar title="Visit" right={{ text:'Edit', muted:true }}/>
      <Body>
        <HeaderCard time="No-show · Jun 12" timeTone="warn" terminalChip={{ label:'No-show', icon:'user-x', bg:N.warningBg, fg:N.warning700 }}/>
        <Banner tone="warning" icon="user-x" title="Marked no-show">The visitor didn't arrive in the booked window.</Banner>
        <StatusTimeline current={2} terminal/>
        <HostsCard/>
        <AccessCard/>
      </Body>
      <Footer secondary={{ label:'Book again', icon:'repeat' }}/>
    </Phone>
  );
}

function VisitActiveLink() {
  return (
    <Phone label="Visit · Active link">
      <TopBar title="Visit" right={{ text:'Edit' }}/>
      <Body>
        <HeaderCard time="Awaiting a time" timeTone="muted"/>
        <StatusTimeline current={0}/>
        <ShareManage linkState="active" reserved={3} open={5}/>
        <HostsCard/>
      </Body>
      <Footer secondary={{ label:'Cancel', icon:'x' }} primary={{ label:'Reschedule', icon:'calendar-clock' }}/>
    </Phone>
  );
}

function VisitExpiredLink() {
  return (
    <Phone label="Visit · Expired link">
      <TopBar title="Visit" right={{ text:'Edit' }}/>
      <Body>
        <HeaderCard time="Awaiting a time" timeTone="muted"/>
        <Banner tone="amber" icon="clock" title="Booking link expired">Extend the window so the visitor can still pick a time.</Banner>
        <StatusTimeline current={0}/>
        <ShareManage linkState="expired" reserved={1} open={0}/>
      </Body>
      <Footer secondary={{ label:'Cancel', icon:'x' }} primary={{ label:'Reschedule', icon:'calendar-clock' }}/>
    </Phone>
  );
}

function VisitRevoked() {
  return (
    <Phone label="Visit · Revoked">
      <TopBar title="Visit" right={{ text:'Edit' }}/>
      <Body>
        <HeaderCard time="Awaiting a time" timeTone="muted"/>
        <Banner tone="error" icon="ban" title="Booking link revoked">No one can book this link. Re-issue a new one to keep offering times.</Banner>
        <StatusTimeline current={0}/>
        <ShareManage linkState="revoked" reserved={2} open={0}/>
      </Body>
      <Footer secondary={{ label:'Cancel', icon:'x' }} primary={{ label:'Reschedule', icon:'calendar-clock' }}/>
    </Phone>
  );
}

Object.assign(window, { VisitOffered, VisitReserved, VisitConfirmed, VisitCompleted, VisitCancelled, VisitNoShow, VisitActiveLink, VisitExpiredLink, VisitRevoked });
