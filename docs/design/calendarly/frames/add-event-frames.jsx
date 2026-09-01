// F3 — Home Add / Edit Event (sheet, existing extended) · 300×620 · Home green
// Frames: create · edit · invalid · saving · dirty-discard · offline

const { N, H, M } = window;
const { Sheet, SheetBar, SheetBody, Card, Overline, Field, CatPick, Segmented,
        Stepper, ValueRow, MultiChip, Toggle, Avatar, Check, MemberSelectRow, Banner, Dialog } = window;

const CATS = ['health', 'chore', 'meal', 'family', 'school'];

function Section({ overline, children }) {
  return (
    <Card>
      {overline && <Overline color={H.accent700} style={{ marginBottom:9 }}>{overline}</Overline>}
      {children}
    </Card>
  );
}

function ChipWrap({ children }) {
  return <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>{children}</div>;
}

function CategoryGroup({ selected }) {
  return <ChipWrap>{CATS.map(c => <CatPick key={c} cat={c} on={c===selected}/>)}</ChipWrap>;
}

function ScheduleGroup({ startV='Mon Jun 16 · 6:30 PM', endV='Mon Jun 16 · 7:30 PM', endError }) {
  return (
    <div>
      <ValueRow label="All-day"><Toggle on={false}/></ValueRow>
      <ValueRow label="Starts">
        <div style={{ display:'flex', gap:6 }}>
          <span style={{ fontSize:12, fontWeight:600, color:N.fg1, padding:'7px 10px', background:N.sunken, borderRadius:8 }}>{startV}</span>
        </div>
      </ValueRow>
      <ValueRow label="Ends" last error={endError}>
        <span style={{ fontSize:12, fontWeight:600, color:endError?N.error:N.fg1, padding:'7px 10px', background:endError?N.errorBg:N.sunken, borderRadius:8, border: endError?`1px solid ${N.errorLight}`:'none' }}>{endV}</span>
      </ValueRow>
      {endError && <div style={{ fontSize:10.5, color:N.error, display:'flex', alignItems:'center', gap:4, marginTop:6 }}><i data-lucide="circle-alert" style={{ width:11, height:11 }}/>End time is before the start time</div>}
    </div>
  );
}

const REMINDERS = ['At time', '10 min', '1 hour', '1 day'];

function AttendeesGroup({ selectedKeys=['mom','dad','ava'] }) {
  const all = [M.mom, M.dad, M.ava, M.tom];
  const keys = ['mom','dad','ava','tom'];
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
        <span style={{ fontSize:11.5, fontWeight:600, color:N.fg2 }}>Assign to</span>
        <span style={{ fontSize:10.5, fontWeight:700, color:H.accent700 }}>{selectedKeys.length} selected</span>
      </div>
      {all.map((m, i) => <MemberSelectRow key={i} m={m} last={i===all.length-1} trailing={<Check on={selectedKeys.includes(keys[i])}/>}/>)}
    </div>
  );
}

// ─── FRAME 1 · CREATE (empty, Save disabled) ───────────────────
function FrameCreate() {
  return (
    <Sheet label="Add event · Create">
      <SheetBar title="New event" action="Save" actionDisabled/>
      <SheetBody>
        <Section><Field label="Title" placeholder="Add a title"/></Section>
        <Section overline="Category"><CategoryGroup selected={null}/></Section>
        <Section overline="When"><ScheduleGroup startV="Mon Jun 16 · 9:00 AM" endV="Mon Jun 16 · 10:00 AM"/></Section>
        <Section overline="Repeats"><Segmented options={['No', 'Daily', 'Weekly', 'Monthly']} value="No" small full/></Section>
        <Section overline="Reminder"><ChipWrap>{REMINDERS.map(r => <MultiChip key={r} label={r} on={r==='10 min'}/>)}</ChipWrap></Section>
      </SheetBody>
    </Sheet>
  );
}

// ─── FRAME 2 · EDIT (prefilled, Save enabled) ──────────────────
function FrameEdit() {
  return (
    <Sheet label="Add event · Edit">
      <SheetBar title="Edit event" action="Save"/>
      <SheetBody>
        <Section><Field label="Title" value="Family dinner"/></Section>
        <Section overline="Category"><CategoryGroup selected="meal"/></Section>
        <Section overline="When"><ScheduleGroup/></Section>
        <Section overline="Repeats"><Segmented options={['No', 'Daily', 'Weekly', 'Monthly']} value="Weekly" small full/></Section>
        <Section overline="Assign to"><AttendeesGroup/></Section>
        <Section overline="Reminder"><ChipWrap>{REMINDERS.map(r => <MultiChip key={r} label={r} on={r==='1 hour'||r==='10 min'}/>)}</ChipWrap></Section>
        <Section><ValueRow label="Request RSVP from attendees" last><Toggle on={true}/></ValueRow><div style={{ fontSize:10.5, color:N.fg3, marginTop:2 }}>Members get a Going / Maybe / Can't prompt</div></Section>
        <Section overline="Notes"><Field value="Gran is bringing dessert." multiline/></Section>
      </SheetBody>
    </Sheet>
  );
}

// ─── FRAME 3 · INVALID ─────────────────────────────────────────
function FrameInvalid() {
  return (
    <Sheet label="Add event · Invalid">
      <SheetBar title="Edit event" action="Save" actionDisabled/>
      <SheetBody>
        <Section><Field label="Title" placeholder="Add a title" error helper="Add a title to save this event"/></Section>
        <Section overline="Category"><CategoryGroup selected="meal"/></Section>
        <Section overline="When"><ScheduleGroup startV="Mon Jun 16 · 7:30 PM" endV="Mon Jun 16 · 6:30 PM" endError/></Section>
        <Section overline="Assign to"><AttendeesGroup/></Section>
      </SheetBody>
    </Sheet>
  );
}

// ─── FRAME 4 · SAVING ──────────────────────────────────────────
function FrameSaving() {
  return (
    <Sheet label="Add event · Saving">
      <SheetBar title="Edit event" action="Save" actionSaving/>
      <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
        <div style={{ opacity:0.45, pointerEvents:'none' }}>
          <SheetBody pad="12px 14px 20px">
            <Section><Field label="Title" value="Family dinner"/></Section>
            <Section overline="Category"><CategoryGroup selected="meal"/></Section>
            <Section overline="When"><ScheduleGroup/></Section>
          </SheetBody>
        </div>
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, background:'rgba(255,255,255,0.9)', padding:'18px 24px', borderRadius:16, boxShadow:'0 8px 24px rgba(0,0,0,0.1)' }}>
            <i data-lucide="loader-circle" style={{ width:26, height:26, color:H.accent, animation:'sh-spin 0.8s linear infinite' }}/>
            <span style={{ fontSize:12.5, fontWeight:600, color:N.fg2 }}>Saving event</span>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

// ─── FRAME 5 · DIRTY-DISCARD CONFIRM ───────────────────────────
function FrameDiscard() {
  return (
    <Sheet label="Add event · Discard" scrimChild={
      <Dialog icon="circle-alert" tone="warn" title="Discard changes?" body="Your edits to this event won't be saved.">
        <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
          <button style={{ width:'100%', height:44, borderRadius:12, border:'none', background:N.error, color:'#fff', fontSize:13.5, fontWeight:700, cursor:'pointer' }}>Discard</button>
          <button style={{ width:'100%', height:44, borderRadius:12, border:`1px solid ${N.borderStrong}`, background:N.surface, color:N.fg2, fontSize:13.5, fontWeight:700, cursor:'pointer' }}>Keep editing</button>
        </div>
      </Dialog>
    }>
      <SheetBar title="Edit event" action="Save"/>
      <div style={{ opacity:0.5, pointerEvents:'none' }}>
        <SheetBody pad="12px 14px 20px">
          <Section><Field label="Title" value="Family dinner"/></Section>
          <Section overline="Category"><CategoryGroup selected="meal"/></Section>
        </SheetBody>
      </div>
    </Sheet>
  );
}

// ─── FRAME 6 · OFFLINE ─────────────────────────────────────────
function FrameOffline() {
  return (
    <Sheet label="Add event · Offline">
      <SheetBar title="New event" action="Save"/>
      <SheetBody>
        <Banner tone="amber" icon="wifi-off" title="You're offline">This event saves when you reconnect.</Banner>
        <Section><Field label="Title" value="Pediatrician — Ava"/></Section>
        <Section overline="Category"><CategoryGroup selected="health"/></Section>
        <Section overline="When"><ScheduleGroup startV="Wed Jun 18 · 3:30 PM" endV="Wed Jun 18 · 4:00 PM"/></Section>
        <Section overline="Reminder"><ChipWrap>{REMINDERS.map(r => <MultiChip key={r} label={r} on={r==='1 day'}/>)}</ChipWrap></Section>
      </SheetBody>
    </Sheet>
  );
}

Object.assign(window, { FrameCreate, FrameEdit, FrameInvalid, FrameSaving, FrameDiscard, FrameOffline });
