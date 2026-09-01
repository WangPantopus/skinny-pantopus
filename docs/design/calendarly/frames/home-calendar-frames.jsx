// F1 — Home Calendar / Agenda (existing, extended) · 300×620 · Home green
// Frames: default (populated) · empty · loading · error · offline · filtered-empty · create-menu

const { N, H, CAT, M } = window;
const { Phone, TopBar, Body, Banner, Card, MonthStrip, DaySection, EventRow,
        FAB, TabBar, Shimmer, EmptyState, PrimaryBtn, SecondaryBtn, Sheet } = window;

const FILTERS = ['All', 'Mine', 'Mom', 'Dad', 'Ava'];

function FilterRow({ active='All' }) {
  return (
    <div style={{ display:'flex', gap:7, overflowX:'auto', padding:'9px 12px', background:N.surface, borderBottom:`1px solid ${N.border}`, flexShrink:0 }}>
      {FILTERS.map(f => {
        const on = f === active;
        return <button key={f} style={{ flexShrink:0, padding:'6px 13px', borderRadius:9999, border:`1px solid ${on?'transparent':N.border}`, background:on?H.bg100:N.surface, color:on?H.accent700:N.fg2, fontSize:12, fontWeight:on?700:600, cursor:'pointer' }}>{f}</button>;
      })}
    </div>
  );
}

const DAY1 = [
  { time:'8:00', ampm:'AM', title:'Trash out', loc:'Curb', cat:'chore', members:[M.dad] },
  { time:'3:30', ampm:'PM', title:'Pediatrician — Ava', loc:'Northside Clinic', cat:'health', members:[M.mom, M.ava] },
  { time:'6:30', ampm:'PM', title:'Family dinner', loc:'Kitchen', cat:'meal', members:[M.mom, M.dad, M.ava] },
];
const DAY2 = [
  { time:'9:00', ampm:'AM', title:'School drop-off', loc:'Lincoln Elementary', cat:'school', members:[M.dad] },
  { time:'7:00', ampm:'PM', title:'Soccer practice', loc:'Field 3', cat:'family', members:[M.ava] },
];
const DAY3 = [
  { time:'5:00', ampm:'PM', title:'Plumber visit', loc:'Front door', cat:'visit', members:[M.mom] },
];

function AgendaBody({ children }) {
  return <div style={{ flex:1, overflow:'auto', padding:'10px 12px 92px', display:'flex', flexDirection:'column', gap:8 }}>{children}</div>;
}

// ─── FRAME 1 · DEFAULT (populated) ─────────────────────────────
function FrameDefault() {
  return (
    <Phone label="Home calendar · Default">
      <TopBar title="Calendar" back={false} center={false} right={{ icon:'users', label:"Who's free" }}/>
      <MonthStrip/>
      <FilterRow active="All"/>
      <AgendaBody>
        <DaySection>Today · Mon Jun 16</DaySection>
        {DAY1.map((e, i) => <EventRow key={i} {...e}/>)}
        <DaySection>Tomorrow · Tue Jun 17</DaySection>
        {DAY2.map((e, i) => <EventRow key={i} {...e}/>)}
        <DaySection>Wed Jun 18</DaySection>
        {DAY3.map((e, i) => <EventRow key={i} {...e}/>)}
      </AgendaBody>
      <FAB icon="plus"/>
      <TabBar active="home"/>
    </Phone>
  );
}

// ─── FRAME 2 · EMPTY ───────────────────────────────────────────
function FrameEmpty() {
  return (
    <Phone label="Home calendar · Empty">
      <TopBar title="Calendar" back={false} center={false} right={{ icon:'users', label:"Who's free" }}/>
      <MonthStrip/>
      <FilterRow active="All"/>
      <EmptyState icon="calendar" title="Nothing scheduled" body="Add your first event and it shows up here for the whole household.">
        <div style={{ marginTop:14, width:200 }}><PrimaryBtn icon="plus">Add an event</PrimaryBtn></div>
      </EmptyState>
      <FAB icon="plus"/>
      <TabBar active="home"/>
    </Phone>
  );
}

// ─── FRAME 3 · LOADING (shimmer) ───────────────────────────────
function SkeletonRow() {
  return (
    <Card pad="11px 12px" style={{ display:'flex', alignItems:'center', gap:11 }}>
      <div style={{ width:42, flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}><Shimmer w={30} h={11}/><Shimmer w={20} h={8}/></div>
      <div style={{ width:1, alignSelf:'stretch', background:N.border }}/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6 }}><Shimmer w="70%" h={11}/><Shimmer w="45%" h={9}/></div>
      <Shimmer w={26} h={26} r={13}/>
    </Card>
  );
}
function FrameLoading() {
  return (
    <Phone label="Home calendar · Loading">
      <TopBar title="Calendar" back={false} center={false} right={{ icon:'users', label:"Who's free" }}/>
      <MonthStrip/>
      <FilterRow active="All"/>
      <AgendaBody>
        <Shimmer w={130} h={11} style={{ margin:'4px 2px' }}/>
        <SkeletonRow/><SkeletonRow/><SkeletonRow/>
        <Shimmer w={110} h={11} style={{ margin:'8px 2px 4px' }}/>
        <SkeletonRow/><SkeletonRow/>
      </AgendaBody>
      <TabBar active="home"/>
    </Phone>
  );
}

// ─── FRAME 4 · ERROR ───────────────────────────────────────────
function FrameError() {
  return (
    <Phone label="Home calendar · Error">
      <TopBar title="Calendar" back={false} center={false} right={{ icon:'users', label:"Who's free" }}/>
      <MonthStrip/>
      <FilterRow active="All"/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'24px 28px' }}>
        <div style={{ width:56, height:56, borderRadius:'50%', background:N.errorBg, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12 }}><i data-lucide="cloud-off" style={{ width:26, height:26, color:N.error }}/></div>
        <div style={{ fontSize:15.5, fontWeight:700, color:N.fg1, letterSpacing:-0.2 }}>Couldn't load the calendar</div>
        <div style={{ fontSize:12.5, color:N.fg3, lineHeight:'18px', maxWidth:220, marginTop:5 }}>Something went wrong on our side. Check your connection and try again.</div>
        <div style={{ marginTop:16, width:160 }}><PrimaryBtn icon="rotate-cw">Retry</PrimaryBtn></div>
      </div>
      <TabBar active="home"/>
    </Phone>
  );
}

// ─── FRAME 5 · OFFLINE ─────────────────────────────────────────
function FrameOffline() {
  return (
    <Phone label="Home calendar · Offline">
      <TopBar title="Calendar" back={false} center={false} right={{ icon:'users', label:"Who's free", muted:true }}/>
      <div style={{ padding:'8px 12px 0', background:N.surface, flexShrink:0 }}>
        <Banner tone="amber" icon="wifi-off" title="You're offline">Showing the last synced schedule. Changes save when you reconnect.</Banner>
      </div>
      <MonthStrip/>
      <FilterRow active="All"/>
      <AgendaBody>
        <DaySection>Today · Mon Jun 16</DaySection>
        {DAY1.map((e, i) => <EventRow key={i} {...e} dim/>)}
        <DaySection>Tomorrow · Tue Jun 17</DaySection>
        {DAY2.map((e, i) => <EventRow key={i} {...e} dim/>)}
      </AgendaBody>
      <TabBar active="home"/>
    </Phone>
  );
}

// ─── FRAME 6 · FILTERED-EMPTY ──────────────────────────────────
function FrameFiltered() {
  return (
    <Phone label="Home calendar · Filtered-empty">
      <TopBar title="Calendar" back={false} center={false} right={{ icon:'users', label:"Who's free" }}/>
      <MonthStrip/>
      <FilterRow active="Ava"/>
      <EmptyState icon="calendar-search" title="No events for Ava this week" body="Ava has nothing scheduled in this range.">
        <button style={{ marginTop:14, display:'inline-flex', alignItems:'center', gap:6, padding:'9px 16px', borderRadius:9999, background:H.bg50, border:`1px solid ${H.bg200}`, color:H.accent700, fontSize:12.5, fontWeight:700, cursor:'pointer' }}><i data-lucide="x" style={{ width:13, height:13 }}/>Clear filter</button>
      </EmptyState>
      <FAB icon="plus"/>
      <TabBar active="home"/>
    </Phone>
  );
}

// ─── FRAME 7 · CREATE MENU (FAB sheet) ─────────────────────────
function CreateMenuItem({ icon, label, sub }) {
  return (
    <button style={{ display:'flex', alignItems:'center', gap:12, width:'100%', padding:'12px 12px', background:'transparent', border:'none', borderRadius:12, cursor:'pointer', textAlign:'left' }}>
      <div style={{ width:38, height:38, borderRadius:10, flexShrink:0, background:H.bg50, color:H.accent, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide={icon} style={{ width:19, height:19, strokeWidth:2 }}/></div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:14, fontWeight:700, color:N.fg1, letterSpacing:-0.15 }}>{label}</div>
        <div style={{ fontSize:11, color:N.fg3, marginTop:1 }}>{sub}</div>
      </div>
      <i data-lucide="chevron-right" style={{ width:16, height:16, color:N.fg4 }}/>
    </button>
  );
}
function FrameCreateMenu() {
  return (
    <Phone label="Home calendar · Create menu" indicatorLight>
      <div style={{ position:'absolute', inset:0, top:34, opacity:0.45, pointerEvents:'none' }}>
        <MonthStrip/>
        <FilterRow active="All"/>
      </div>
      <div style={{ position:'absolute', inset:0, background:'rgba(17,24,39,0.45)', zIndex:20 }}/>
      <div style={{ position:'absolute', bottom:0, left:0, right:0, background:N.surface, borderTopLeftRadius:28, borderTopRightRadius:28, zIndex:21, padding:'10px 10px 22px', boxShadow:'0 -8px 30px rgba(0,0,0,0.18)' }}>
        <div style={{ display:'flex', justifyContent:'center', paddingBottom:8 }}><div style={{ width:36, height:5, borderRadius:3, background:N.borderStrong }}/></div>
        <div style={{ fontSize:13, fontWeight:700, color:N.fg1, padding:'2px 6px 8px', letterSpacing:-0.2 }}>Create</div>
        <CreateMenuItem icon="calendar-plus" label="Add event" sub="A one-off or repeating event"/>
        <CreateMenuItem icon="users" label="Find a time" sub="Pick a slot that works for everyone"/>
        <CreateMenuItem icon="package" label="Book a resource" sub="Guest room, EV charger, tools"/>
        <CreateMenuItem icon="door-open" label="Schedule a visit" sub="Offer a vendor or guest a window"/>
      </div>
    </Phone>
  );
}

Object.assign(window, { FrameDefault, FrameEmpty, FrameLoading, FrameError, FrameOffline, FrameFiltered, FrameCreateMenu });
