// F10 — Resource Editor (create/edit, sheet, v2) · 300×620 · Home green
// Mirrors AddEventForm grouped FormShell. Smart defaults from type.
// Frames: create · edit · invalid · saving · delete-confirm

const { N, H, M } = window;
const { Sheet, SheetBar, SheetBody, Card, Overline, Field, Segmented, Stepper,
        Toggle, ValueRow, MemberSelectRow, Check, Banner, Dialog, StickyFooter, TextBtn } = window;

const TYPES = ['Room', 'Vehicle', 'Tool', 'Charger', 'Other'];

function TypeChips({ selected }) {
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
      {TYPES.map(t => {
        const on = t === selected;
        return <button key={t} style={{ padding:'7px 13px', borderRadius:9999, border:`1px solid ${on?'transparent':N.border}`, background:on?H.bg100:N.surface, color:on?H.accent700:N.fg2, fontSize:12, fontWeight:on?700:600, cursor:'pointer' }}>{t}</button>;
      })}
    </div>
  );
}

function PhotoRow() {
  return (
    <button style={{ display:'flex', alignItems:'center', gap:11, width:'100%', padding:'11px 12px', background:N.surface, border:`1.5px dashed ${N.borderStrong}`, borderRadius:10, cursor:'pointer', textAlign:'left' }}>
      <div style={{ width:34, height:34, borderRadius:9, flexShrink:0, background:N.sunken, color:N.fg3, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="image-plus" style={{ width:17, height:17 }}/></div>
      <span style={{ flex:1, fontSize:12.5, fontWeight:600, color:N.fg2 }}>Add a photo</span>
      <span style={{ fontSize:10.5, color:N.fg4, fontWeight:600 }}>Optional</span>
    </button>
  );
}

function Section({ overline, children, action }) {
  return (
    <Card>
      {overline && <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:9 }}><Overline color={H.accent700}>{overline}</Overline>{action}</div>}
      {children}
    </Card>
  );
}

function RulesDisclosure({ open, defaultHelper, durError }) {
  return (
    <Card>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }}>
        <div>
          <Overline color={H.accent700}>Booking rules</Overline>
          {defaultHelper && !open && <div style={{ fontSize:10.5, color:N.fg3, marginTop:4 }}>{defaultHelper}</div>}
        </div>
        <i data-lucide={open?'chevron-up':'chevron-down'} style={{ width:18, height:18, color:N.fg4 }}/>
      </div>
      {open && (
        <div style={{ marginTop:11, display:'flex', flexDirection:'column', gap:2 }}>
          <ValueRow label="Max duration" error={durError}><Stepper value={durError?'0':'4'} unit="hr" error={durError}/></ValueRow>
          {durError && <div style={{ fontSize:10.5, color:N.error, display:'flex', alignItems:'center', gap:4, padding:'0 2px 6px' }}><i data-lucide="circle-alert" style={{ width:11, height:11 }}/>Set a max duration above zero</div>}
          <ValueRow label="Buffer between bookings"><Stepper value="15" unit="min"/></ValueRow>
          <ValueRow label="Requires approval" last><Toggle on={false}/></ValueRow>
        </div>
      )}
    </Card>
  );
}

function HoursWindow() {
  const days = ['S','M','T','W','T','F','S'];
  const on = [false,true,true,true,true,true,false];
  return (
    <div>
      <div style={{ display:'flex', gap:5, marginBottom:10 }}>
        {days.map((d, i) => (
          <div key={i} style={{ flex:1, height:30, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, background:on[i]?H.accent:N.sunken, color:on[i]?'#fff':N.fg4, cursor:'pointer' }}>{d}</div>
        ))}
      </div>
      <ValueRow label="Available hours" last>
        <span style={{ fontSize:12, fontWeight:600, color:N.fg1, padding:'6px 10px', background:N.sunken, borderRadius:8 }}>7 AM – 10 PM</span>
      </ValueRow>
    </div>
  );
}

function WhoCanBook({ value, specific }) {
  return (
    <div>
      <Segmented options={['All', 'Specific', 'Guest link']} value={value} small full/>
      {specific && (
        <div style={{ marginTop:11 }}>
          {[M.mom, M.dad, M.ava].map((m, i) => <MemberSelectRow key={i} m={m} last={i===2} trailing={<Check on={i<2}/>}/>)}
        </div>
      )}
    </div>
  );
}

// ─── FRAME 1 · CREATE ──────────────────────────────────────────
function FrameCreate() {
  return (
    <Sheet label="Resource editor · Create">
      <SheetBar title="New resource" action="Save" actionDisabled/>
      <SheetBody>
        <Section><Field label="Name" placeholder="Name this resource"/><div style={{ marginTop:11 }}><div style={{ fontSize:11, fontWeight:600, color:N.fg2, marginBottom:7 }}>Type</div><TypeChips selected="Charger"/></div></Section>
        <Section overline="Photo"><PhotoRow/></Section>
        <Section overline="Who can book"><WhoCanBook value="All"/></Section>
        <RulesDisclosure open={false} defaultHelper="Charger defaults: 4 hr max · No approval"/>
        <Section overline="Available hours"><HoursWindow/></Section>
      </SheetBody>
    </Sheet>
  );
}

// ─── FRAME 2 · EDIT ────────────────────────────────────────────
function FrameEdit() {
  return (
    <Sheet label="Resource editor · Edit">
      <SheetBar title="Edit resource" action="Save"/>
      <div style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:12 }}>
          <Section><Field label="Name" value="EV charger"/><div style={{ marginTop:11 }}><div style={{ fontSize:11, fontWeight:600, color:N.fg2, marginBottom:7 }}>Type</div><TypeChips selected="Charger"/></div></Section>
          <Section overline="Who can book"><WhoCanBook value="Specific" specific/></Section>
          <RulesDisclosure open defaultHelper="4 hr max · No approval"/>
          <Section overline="Available hours"><HoursWindow/></Section>
          <div style={{ display:'flex', justifyContent:'center', padding:'2px 0 8px' }}><TextBtn tone={N.error} icon="trash-2">Delete resource</TextBtn></div>
        </div>
      </div>
    </Sheet>
  );
}

// ─── FRAME 3 · INVALID ─────────────────────────────────────────
function FrameInvalid() {
  return (
    <Sheet label="Resource editor · Invalid">
      <SheetBar title="Edit resource" action="Save" actionDisabled/>
      <SheetBody>
        <Section><Field label="Name" placeholder="Name this resource" error helper="Give this resource a name"/><div style={{ marginTop:11 }}><div style={{ fontSize:11, fontWeight:600, color:N.fg2, marginBottom:7 }}>Type</div><TypeChips selected="Charger"/></div></Section>
        <RulesDisclosure open durError/>
        <Section overline="Available hours"><HoursWindow/></Section>
      </SheetBody>
    </Sheet>
  );
}

// ─── FRAME 4 · SAVING ──────────────────────────────────────────
function FrameSaving() {
  return (
    <Sheet label="Resource editor · Saving">
      <SheetBar title="Edit resource" action="Save" actionSaving/>
      <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
        <div style={{ opacity:0.45, pointerEvents:'none' }}>
          <SheetBody pad="12px 14px 20px">
            <Section><Field label="Name" value="EV charger"/></Section>
            <Section overline="Who can book"><WhoCanBook value="Specific"/></Section>
          </SheetBody>
        </div>
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, background:'rgba(255,255,255,0.9)', padding:'18px 24px', borderRadius:16, boxShadow:'0 8px 24px rgba(0,0,0,0.1)' }}>
            <i data-lucide="loader-circle" style={{ width:26, height:26, color:H.accent, animation:'sh-spin 0.8s linear infinite' }}/>
            <span style={{ fontSize:12.5, fontWeight:600, color:N.fg2 }}>Saving resource</span>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

// ─── FRAME 5 · DELETE CONFIRM ──────────────────────────────────
function FrameDelete() {
  return (
    <Sheet label="Resource editor · Delete confirm" scrimChild={
      <Dialog icon="trash-2" tone="error" title="Delete EV charger?" body="Existing bookings stay on the calendar. New bookings will be turned off.">
        <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
          <button style={{ width:'100%', height:44, borderRadius:12, border:'none', background:N.error, color:'#fff', fontSize:13.5, fontWeight:700, cursor:'pointer' }}>Delete</button>
          <button style={{ width:'100%', height:44, borderRadius:12, border:`1px solid ${N.borderStrong}`, background:N.surface, color:N.fg2, fontSize:13.5, fontWeight:700, cursor:'pointer' }}>Keep</button>
        </div>
      </Dialog>
    }>
      <SheetBar title="Edit resource" action="Save"/>
      <div style={{ opacity:0.5, pointerEvents:'none' }}>
        <SheetBody pad="12px 14px 20px">
          <Section><Field label="Name" value="EV charger"/></Section>
          <RulesDisclosure open/>
        </SheetBody>
      </div>
    </Sheet>
  );
}

Object.assign(window, { FrameCreate, FrameEdit, FrameInvalid, FrameSaving, FrameDelete });
