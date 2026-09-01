// F6 — Find a Time · Member Poll Response (sheet, v2) · 300×620 · Home green
// Built on the Polls module — time-slot options with a 3-way vote control.
// Frames: unanswered · answered · expired/closed · conflicts-detected

const { N, H, M } = window;
const { Sheet, SheetBar, SheetBody, Card, Avatar, PrimaryBtn, StickyFooter, Banner } = window;

// 3-way vote control: Works (green) / If needed (amber) / Can't (red).
function VoteControl({ value, locked }) {
  const opts = [
    { k:'works', label:'Works', on:H.accent },
    { k:'maybe', label:'If needed', on:N.warning },
    { k:'cant', label:"Can't", on:N.error },
  ];
  return (
    <div style={{ display:'flex', gap:3, padding:3, background:N.sunken, borderRadius:9, opacity:locked?0.7:1 }}>
      {opts.map(o => {
        const sel = o.k === value;
        return <button key={o.k} style={{ flex:1, height:30, borderRadius:7, border:'none', background:sel?o.on:'transparent', color:sel?'#fff':N.fg3, fontSize:11, fontWeight:sel?700:600, cursor:locked?'default':'pointer', whiteSpace:'nowrap', boxShadow:sel?'0 1px 2px rgba(0,0,0,0.12)':'none' }}>{o.label}</button>;
      })}
    </div>
  );
}

function OrganizerHeader() {
  return (
    <Card pad="12px 13px" style={{ display:'flex', alignItems:'center', gap:11 }}>
      <Avatar m={M.mom} size={38}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13.5, fontWeight:700, color:N.fg1, letterSpacing:-0.15 }}>Mom is finding a time</div>
        <div style={{ fontSize:11.5, color:N.fg3, marginTop:2 }}>Family call · 30 min · respond by Fri</div>
      </div>
      <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:9999, background:H.bg100, color:H.accent700, fontSize:9.5, fontWeight:700, textTransform:'uppercase' }}><i data-lucide="vote" style={{ width:10, height:10 }}/>Poll</span>
    </Card>
  );
}

function PollSlot({ day, date, time, value, conflict, locked }) {
  return (
    <Card pad="11px 13px">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:9 }}>
        <span style={{ fontSize:13, fontWeight:700, color:N.fg1, letterSpacing:-0.15 }}>{day} {date} · {time}</span>
        {conflict && <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 7px', borderRadius:9999, background:N.errorBg, color:'#b91c1c', fontSize:9.5, fontWeight:700 }}><i data-lucide="alert-triangle" style={{ width:10, height:10 }}/>Conflicts: Dentist</span>}
      </div>
      <VoteControl value={value} locked={locked}/>
      {conflict && <div style={{ fontSize:10, color:N.fg3, marginTop:7, display:'flex', alignItems:'center', gap:4 }}><i data-lucide="calendar" style={{ width:11, height:11 }}/>From your personal calendar</div>}
    </Card>
  );
}

// ─── FRAME 1 · UNANSWERED ──────────────────────────────────────
function FrameUnanswered() {
  return (
    <Sheet label="Poll response · Unanswered">
      <SheetBar title="Respond" cancel="Close"/>
      <SheetBody>
        <OrganizerHeader/>
        <div style={{ fontSize:11, fontWeight:700, color:N.fg3, textTransform:'uppercase', letterSpacing:0.06, padding:'2px 2px' }}>Mark which times work</div>
        <PollSlot day="Sun" date="Jun 22" time="2:00 PM" value={null}/>
        <PollSlot day="Sun" date="Jun 22" time="6:00 PM" value={null}/>
        <PollSlot day="Tue" date="Jun 24" time="7:30 PM" value={null}/>
      </SheetBody>
      <StickyFooter><PrimaryBtn icon="send" disabled>Submit response</PrimaryBtn></StickyFooter>
    </Sheet>
  );
}

// ─── FRAME 2 · ANSWERED ────────────────────────────────────────
function FrameAnswered() {
  return (
    <Sheet label="Poll response · Answered">
      <SheetBar title="Respond" cancel="Close"/>
      <SheetBody>
        <OrganizerHeader/>
        <div style={{ fontSize:11, fontWeight:700, color:N.fg3, textTransform:'uppercase', letterSpacing:0.06, padding:'2px 2px' }}>Mark which times work</div>
        <PollSlot day="Sun" date="Jun 22" time="2:00 PM" value="works"/>
        <PollSlot day="Sun" date="Jun 22" time="6:00 PM" value="maybe"/>
        <PollSlot day="Tue" date="Jun 24" time="7:30 PM" value="cant"/>
      </SheetBody>
      <StickyFooter><PrimaryBtn icon="send">Submit response</PrimaryBtn></StickyFooter>
    </Sheet>
  );
}

// ─── FRAME 3 · CONFLICTS-DETECTED ──────────────────────────────
function FrameConflicts() {
  return (
    <Sheet label="Poll response · Conflicts">
      <SheetBody pad="0 0 20px">
        <SheetBar title="Respond" cancel="Close"/>
        <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:12 }}>
          <OrganizerHeader/>
          <Banner tone="info" icon="info">We pre-filled a "Can't" where you're already busy. Change any you can still make.</Banner>
          <PollSlot day="Sun" date="Jun 22" time="2:00 PM" value="works"/>
          <PollSlot day="Sun" date="Jun 22" time="6:00 PM" value="cant" conflict/>
          <PollSlot day="Tue" date="Jun 24" time="7:30 PM" value={null}/>
        </div>
      </SheetBody>
      <StickyFooter><PrimaryBtn icon="send">Submit response</PrimaryBtn></StickyFooter>
    </Sheet>
  );
}

// ─── FRAME 4 · EXPIRED / CLOSED ────────────────────────────────
function FrameExpired() {
  return (
    <Sheet label="Poll response · Expired">
      <SheetBar title="Respond" cancel="Close"/>
      <SheetBody pad="12px 14px 24px">
        <OrganizerHeader/>
        <Banner tone="home" icon="check-circle-2" title="This proposal closed">Mom booked Sun Jun 22 · 2:00 PM. It's on the family calendar.</Banner>
        <div style={{ fontSize:11, fontWeight:700, color:N.fg4, textTransform:'uppercase', letterSpacing:0.06, padding:'2px 2px' }}>Proposed times</div>
        <div style={{ opacity:0.55, pointerEvents:'none', display:'flex', flexDirection:'column', gap:12 }}>
          <PollSlot day="Sun" date="Jun 22" time="2:00 PM" value="works" locked/>
          <PollSlot day="Sun" date="Jun 22" time="6:00 PM" value="maybe" locked/>
          <PollSlot day="Tue" date="Jun 24" time="7:30 PM" value="cant" locked/>
        </div>
      </SheetBody>
    </Sheet>
  );
}

Object.assign(window, { FrameUnanswered, FrameAnswered, FrameConflicts, FrameExpired });
