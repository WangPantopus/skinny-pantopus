// Pantopus — Calendarly · G · Member Working-Hours Editor — 6 frames
// Bottom sheet reusing the Support Trains weekday + time-range grid 1:1. Edits
// one member's bookable weekly hours + date overrides; read-only deferral when
// bound to personal availability. Business violet accent; range chips pill,
// violet-bg when active.
//
// Frames: 1 editing · 2 date-override · 3 blocked-out · 4 inherits-personal
// (read-only) · 5 saving · 6 loading (shimmer).

const { E, SH } = window;
const { C, SheetFrame, Card, Overline, Note, PrimaryBtn, Sk } = window;
const BIZ = C.biz, BIZ_BG = C.bizBg;

const WEEK = [
  { d:'Mon', ranges:['9:00 AM–5:00 PM'] },
  { d:'Tue', ranges:['9:00 AM–5:00 PM'] },
  { d:'Wed', ranges:['9:00 AM–12:00 PM','1:00–5:00 PM'] },
  { d:'Thu', ranges:['9:00 AM–5:00 PM'] },
  { d:'Fri', ranges:['9:00 AM–5:00 PM'] },
  { d:'Sat', ranges:['10:00 AM–2:00 PM'] },
  { d:'Sun', ranges:[] },
];

function TzChip() {
  return (
    <button style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 11px', borderRadius:9999, background:BIZ_BG, color:BIZ, border:'none', cursor:'pointer', fontSize:11.5, fontWeight:700 }}>
      <i data-lucide="globe" style={{ width:13, height:13 }}/>America/Los_Angeles
      <i data-lucide="chevron-down" style={{ width:13, height:13 }}/>
    </button>
  );
}

function RangeChip({ text, readonly }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 9px', borderRadius:9999, background:readonly?E.sunken:BIZ_BG, color:readonly?E.fg2:BIZ, fontSize:11, fontWeight:700, whiteSpace:'nowrap' }}>
      {text}
      {!readonly && <i data-lucide="x" style={{ width:11, height:11, strokeWidth:2.6 }}/>}
    </span>
  );
}

function DayRow({ d, ranges, readonly, last }) {
  const off = ranges.length === 0;
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'11px 2px', borderBottom: last?'none':`1px solid ${E.border}` }}>
      <div style={{ width:30, flexShrink:0, fontSize:12, fontWeight:700, color:off?E.fg4:E.fg2, paddingTop:5 }}>{d}</div>
      <div style={{ flex:1, minWidth:0, display:'flex', flexWrap:'wrap', gap:6 }}>
        {off
          ? <span style={{ fontSize:11.5, color:E.fg4, fontWeight:500, paddingTop:5 }}>Unavailable</span>
          : ranges.map((r, i) => <RangeChip key={i} text={r} readonly={readonly}/>)}
      </div>
      {!readonly && (
        <button aria-label={`Add a range to ${d}`} style={{ width:26, height:26, borderRadius:9999, border:`1px solid ${E.border}`, background:E.surface, color:BIZ, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
          <i data-lucide="plus" style={{ width:13, height:13 }}/>
        </button>
      )}
    </div>
  );
}

function WeekGrid({ readonly }) {
  return (
    <Card>
      {WEEK.map((w, i) => <DayRow key={w.d} {...w} readonly={readonly} last={i===WEEK.length-1}/>)}
    </Card>
  );
}

function CopyLink() {
  return (
    <button style={{ alignSelf:'flex-start', display:'inline-flex', alignItems:'center', gap:6, background:'none', border:'none', color:E.blue600, fontSize:12, fontWeight:700, cursor:'pointer', padding:'2px 2px' }}>
      <i data-lucide="copy" style={{ width:13, height:13 }}/>Copy Monday to weekdays
    </button>
  );
}

function OverrideRows() {
  const rows = [
    { icon:'calendar-plus', label:'Add a date override' },
    { icon:'ban', label:'Block out time' },
  ];
  return (
    <Card>
      {rows.map((r, i) => (
        <div key={r.label} style={{ display:'flex', alignItems:'center', gap:11, padding:'12px 2px', borderBottom: i===rows.length-1?'none':`1px solid ${E.border}`, cursor:'pointer' }}>
          <div style={{ width:32, height:32, borderRadius:9, background:E.sunken, color:E.fg2, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i data-lucide={r.icon} style={{ width:16, height:16 }}/></div>
          <div style={{ flex:1, fontSize:13, fontWeight:600, color:E.fg1 }}>{r.label}</div>
          <i data-lucide="chevron-right" style={{ width:16, height:16, color:E.fg4 }}/>
        </div>
      ))}
    </Card>
  );
}

function DatedCard({ tone, icon, title, sub }) {
  const bg = tone==='error'?C.errBg:E.surface, bd = tone==='error'?C.errBorder:E.border, ic = tone==='error'?C.err:BIZ, icbg = tone==='error'?'#fff':BIZ_BG;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:11, padding:'12px 13px', background:bg, border:`1px solid ${bd}`, borderRadius:16, boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ width:34, height:34, borderRadius:9, background:icbg, color:ic, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i data-lucide={icon} style={{ width:16, height:16 }}/></div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12.5, fontWeight:700, color:tone==='error'?C.err:E.fg1 }}>{title}</div>
        <div style={{ fontSize:11, color:tone==='error'?C.err:E.fg3, marginTop:1 }}>{sub}</div>
      </div>
      <i data-lucide="chevron-right" style={{ width:16, height:16, color:E.fg4 }}/>
    </div>
  );
}

function Header({ children }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div><TzChip/></div>
      {children}
    </div>
  );
}

const TITLE = "Marisol's booking hours";

// ─── FRAME 1 · EDITING ──────────────────────────────────────────────────────

function FrameEditing() {
  return (
    <SheetFrame label="Member hours · Editing" title={TITLE} footer={<PrimaryBtn>Save hours</PrimaryBtn>}>
      <Header>
        <WeekGrid/>
        <CopyLink/>
        <Overline color={BIZ}>Date overrides</Overline>
        <OverrideRows/>
      </Header>
    </SheetFrame>
  );
}

// ─── FRAME 2 · DATE OVERRIDE ────────────────────────────────────────────────

function FrameOverride() {
  return (
    <SheetFrame label="Member hours · Override" title={TITLE} footer={<PrimaryBtn>Save hours</PrimaryBtn>}>
      <Header>
        <DatedCard icon="calendar-clock" title="Fri Jun 20 · 12:00–3:00 only" sub="Overrides the weekly hours for this date"/>
        <WeekGrid/>
        <CopyLink/>
        <Overline color={BIZ}>Date overrides</Overline>
        <OverrideRows/>
      </Header>
    </SheetFrame>
  );
}

// ─── FRAME 3 · BLOCKED OUT ──────────────────────────────────────────────────

function FrameBlocked() {
  return (
    <SheetFrame label="Member hours · Blocked" title={TITLE} footer={<PrimaryBtn>Save hours</PrimaryBtn>}>
      <Header>
        <DatedCard tone="error" icon="ban" title="Jul 1–5 · Time off" sub="No bookings during these days"/>
        <WeekGrid/>
        <CopyLink/>
        <Overline color={BIZ}>Date overrides</Overline>
        <OverrideRows/>
      </Header>
    </SheetFrame>
  );
}

// ─── FRAME 4 · INHERITS PERSONAL (read-only) ────────────────────────────────

function FrameInherits() {
  return (
    <SheetFrame label="Member hours · Inherits" title={TITLE}>
      <Header>
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 13px', background:BIZ_BG, borderRadius:14 }}>
          <i data-lucide="link" style={{ width:16, height:16, color:BIZ, flexShrink:0 }}/>
          <div style={{ flex:1, fontSize:11.5, color:E.fg2, fontWeight:500, lineHeight:'15px' }}>These hours come from Marisol's personal availability.</div>
          <button style={{ background:'none', border:'none', color:E.blue600, fontSize:11.5, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>View personal</button>
        </div>
        <div style={{ opacity:0.6 }}><WeekGrid readonly/></div>
      </Header>
    </SheetFrame>
  );
}

// ─── FRAME 5 · SAVING ───────────────────────────────────────────────────────

function FrameSaving() {
  return (
    <SheetFrame label="Member hours · Saving" title={TITLE} footer={<PrimaryBtn saving>Saving</PrimaryBtn>}>
      <Header>
        <WeekGrid/>
        <CopyLink/>
        <Overline color={BIZ}>Date overrides</Overline>
        <OverrideRows/>
      </Header>
    </SheetFrame>
  );
}

// ─── FRAME 6 · LOADING (shimmer day rows) ───────────────────────────────────

function FrameLoading() {
  return (
    <SheetFrame label="Member hours · Loading" title={TITLE} footer={<PrimaryBtn disabled>Save hours</PrimaryBtn>}>
      <Header>
        <Card>
          {WEEK.map((w, i) => (
            <div key={w.d} style={{ display:'flex', alignItems:'center', gap:10, padding:'13px 2px', borderBottom: i===WEEK.length-1?'none':`1px solid ${E.border}` }}>
              <Sk w={30} h={11}/>
              <div style={{ flex:1 }}><Sk w="60%" h={22} r={9999}/></div>
              <div style={{ width:26, height:26, borderRadius:9999, ...SH }}/>
            </div>
          ))}
        </Card>
      </Header>
    </SheetFrame>
  );
}

Object.assign(window, { MH_FrameEditing:FrameEditing, MH_FrameOverride:FrameOverride, MH_FrameBlocked:FrameBlocked, MH_FrameInherits:FrameInherits, MH_FrameSaving:FrameSaving, MH_FrameLoading:FrameLoading });
