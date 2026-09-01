// Pantopus — Calendarly · H · Default Reminders Quick-Setup — 4 frames
// Flagship simple reminder surface: pick lead-times that auto-attach to every
// event you own. Bottom sheet; Settings FRAME 2 toggle-card + Form ToggleRow /
// Chip add-button. Personal sky pillar (renders with other pillar accents too).
//
// Frames: 1 default (1 day + 1 hour pre-checked) · 2 empty/first-open ·
// 3 saved/success toast · 4 permission-gated (push disabled).

const { E } = window;
const { C, SheetFrame, Card, PrimaryBtn, Note } = window;
const SKY = E.blue600, SKY50 = E.blue50, SKY100 = E.blue100, SKY700 = E.blue700;

function ChannelChips() {
  return (
    <div style={{ display:'flex', gap:6, marginTop:8, marginLeft:31 }}>
      <span style={{ height:24, padding:'0 11px', borderRadius:9999, background:SKY50, color:SKY700, border:`1px solid ${SKY100}`, fontSize:10.5, fontWeight:700, display:'inline-flex', alignItems:'center', gap:4 }}><i data-lucide="bell" style={{ width:10, height:10 }}/>Push</span>
      <span style={{ height:24, padding:'0 11px', borderRadius:9999, background:E.surface, color:E.fg3, border:`1px solid ${E.border}`, fontSize:10.5, fontWeight:600, display:'inline-flex', alignItems:'center', gap:4 }}><i data-lucide="mail" style={{ width:10, height:10 }}/>Email</span>
    </div>
  );
}

function ReminderRow({ label, on, last }) {
  return (
    <div style={{ padding:'11px 2px', borderBottom: last?'none':`1px solid ${E.border}` }}>
      <div role="button" aria-label={`${label}, ${on?'on':'off'}`} style={{ display:'flex', alignItems:'center', gap:11, cursor:'pointer' }}>
        <i data-lucide={on?'check-circle-2':'circle'} style={{ width:21, height:21, color:on?SKY:E.borderStrong, strokeWidth:on?2.4:2, flexShrink:0 }}/>
        <span style={{ fontSize:14, fontWeight:on?600:500, color:on?E.fg1:E.fg2 }}>{label}</span>
      </div>
      {on && <ChannelChips/>}
    </div>
  );
}

function ReminderCard({ checks }) {
  const rows = ['1 week before','1 day before','1 hour before','30 minutes before','15 minutes before','At start'];
  return <Card>{rows.map((r, i) => <ReminderRow key={r} label={r} on={checks.includes(i)} last={i===rows.length-1}/>)}</Card>;
}

function AddCustom() {
  return <button style={{ alignSelf:'flex-start', display:'inline-flex', alignItems:'center', gap:6, height:34, padding:'0 14px', borderRadius:9999, background:E.surface, border:`1.5px dashed ${E.borderStrong}`, color:E.fg2, fontSize:12, fontWeight:600, cursor:'pointer' }}><i data-lucide="plus" style={{ width:13, height:13, color:SKY }}/>Add custom time</button>;
}

function Body({ helper, children }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ fontSize:11.5, color:E.fg3, lineHeight:'16px', padding:'0 2px' }}>{helper}</div>
      {children}
      <AddCustom/>
    </div>
  );
}

// ─── FRAME 1 · DEFAULT ──────────────────────────────────────────────────────

function FrameDefault() {
  return (
    <SheetFrame label="Reminders · Default" title="Default reminders" subhead="Times come from each event you own. Per-event overrides stay."
      footer={<PrimaryBtn>Save</PrimaryBtn>}>
      <Body helper="Pick the lead-times that attach to every event you own."><ReminderCard checks={[1,2]}/></Body>
    </SheetFrame>
  );
}

// ─── FRAME 2 · EMPTY / FIRST OPEN ───────────────────────────────────────────

function FrameFirst() {
  return (
    <SheetFrame label="Reminders · First open" title="Default reminders" subhead="Times come from each event you own. Per-event overrides stay."
      footer={<PrimaryBtn>Save</PrimaryBtn>}>
      <Body helper="We pre-picked two reminders most people keep. Change them anytime."><ReminderCard checks={[1,2]}/></Body>
    </SheetFrame>
  );
}

// ─── FRAME 3 · SAVED / SUCCESS TOAST ────────────────────────────────────────

function FrameSaved() {
  return (
    <SheetFrame label="Reminders · Saved" title="Default reminders" subhead="Times come from each event you own. Per-event overrides stay."
      footer={
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 12px', background:'#0f172a', borderRadius:11 }}>
            <i data-lucide="check-circle-2" style={{ width:15, height:15, color:'#34d399' }}/>
            <span style={{ fontSize:11.5, color:'#fff', fontWeight:600 }}>Reminders saved. They'll apply to new events.</span>
          </div>
          <PrimaryBtn>Save</PrimaryBtn>
        </div>
      }>
      <Body helper="Pick the lead-times that attach to every event you own."><ReminderCard checks={[1,2]}/></Body>
    </SheetFrame>
  );
}

// ─── FRAME 4 · PERMISSION GATED ─────────────────────────────────────────────

function FrameGated() {
  return (
    <SheetFrame label="Reminders · Push off" title="Default reminders" subhead="Times come from each event you own. Per-event overrides stay."
      footer={<PrimaryBtn>Save</PrimaryBtn>}>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:9, padding:'11px 12px', background:C.warnBg, border:`1px solid ${C.warnBorder}`, borderRadius:12 }}>
          <i data-lucide="bell-off" style={{ width:16, height:16, color:C.warn, flexShrink:0 }}/>
          <span style={{ flex:1, fontSize:11.5, color:C.warn, fontWeight:600, lineHeight:'15px' }}>Push is off in iOS Settings. Email still works.</span>
          <button style={{ background:'none', border:'none', color:SKY, fontSize:11.5, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>Enable</button>
        </div>
        <ReminderCard checks={[1,2]}/>
        <AddCustom/>
      </div>
    </SheetFrame>
  );
}

Object.assign(window, { RM_FrameDefault:FrameDefault, RM_FrameFirst:FrameFirst, RM_FrameSaved:FrameSaved, RM_FrameGated:FrameGated });
