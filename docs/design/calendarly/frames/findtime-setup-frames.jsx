// F4 — Find a Time · Setup (sheet) · 300×620 · Home green
// The core engine screen — family composes personal availability.
// Frames: default(collective) · round-robin · invalid · computing · no-overlap · explainer-expanded

const { N, H, M } = window;
const { Sheet, SheetBar, SheetBody, Card, Overline, Field, Segmented, Stepper,
        Avatar, Check, Banner, Shimmer, MultiChip } = window;

// Pinned explainer banner (info, tappable "How this works").
function Explainer({ expanded }) {
  return (
    <div style={{ background:N.infoBg, border:`1px solid ${N.infoLight}`, borderRadius:12, padding:'10px 12px' }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:9 }}>
        <i data-lucide="info" style={{ width:15, height:15, color:N.info, flexShrink:0, marginTop:1 }}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:11.5, color:'#075985', lineHeight:'16px', fontWeight:500 }}>Times come from each member's personal availability. Pantopus finds the overlap — it never changes anyone's calendar.</div>
          {expanded && (
            <div style={{ marginTop:9, paddingTop:9, borderTop:`1px solid ${N.infoLight}`, display:'flex', flexDirection:'column', gap:7 }}>
              {[
                ['user-check', 'Each member sets their own free/busy hours in Personal.'],
                ['layers', 'Pantopus overlays everyone you pick and keeps only the shared free time.'],
                ['lock', 'No one\'s calendar is edited. Booking a slot adds one new event.'],
              ].map(([ic, tx], i) => (
                <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                  <i data-lucide={ic} style={{ width:13, height:13, color:N.info, flexShrink:0, marginTop:1 }}/>
                  <span style={{ fontSize:11, color:N.fg2, lineHeight:'15px' }}>{tx}</span>
                </div>
              ))}
            </div>
          )}
          <button style={{ marginTop:8, display:'inline-flex', alignItems:'center', gap:4, background:'transparent', border:'none', padding:0, cursor:'pointer', color:N.info, fontSize:11, fontWeight:700 }}>
            {expanded ? 'Hide' : 'How this works'}<i data-lucide={expanded?'chevron-up':'chevron-down'} style={{ width:12, height:12 }}/>
          </button>
        </div>
      </div>
    </div>
  );
}

function ReqOpt({ value, invalid }) {
  return (
    <div style={{ display:'flex', gap:3, padding:3, background: invalid?N.errorBg:N.sunken, borderRadius:8, border: invalid?`1px solid ${N.errorLight}`:'none' }}>
      {['Required', 'Optional'].map(o => {
        const on = o === value;
        return <button key={o} style={{ padding:'4px 9px', borderRadius:6, border:'none', background:on?(o==='Required'?H.accent:N.surface):'transparent', color:on?(o==='Required'?'#fff':N.fg2):N.fg4, fontSize:10.5, fontWeight:on?700:600, cursor:'pointer', whiteSpace:'nowrap', boxShadow: (on&&o==='Optional')?'0 1px 2px rgba(0,0,0,0.08)':'none' }}>{o}</button>;
      })}
    </div>
  );
}

function WhoRow({ m, value, last, invalid }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 2px', borderBottom: last?'none':`1px solid ${N.border}` }}>
      <div style={{ position:'relative' }}>
        <Avatar m={m} size={32}/>
        {value==='Required' && <div style={{ position:'absolute', bottom:-2, right:-3, width:15, height:15, borderRadius:'50%', background:H.accent, border:'2px solid #fff', display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="check" style={{ width:8, height:8, color:'#fff', strokeWidth:4 }}/></div>}
      </div>
      <div style={{ flex:1, minWidth:0, fontSize:13, fontWeight:600, color:N.fg1 }}>{m.full}</div>
      <ReqOpt value={value} invalid={invalid}/>
    </div>
  );
}

// Two big mode tiles.
function ModeTiles({ mode }) {
  const tiles = [
    { k:'collective', icon:'users', title:'Collective', line:'Everyone free' },
    { k:'round', icon:'repeat', title:'Round-robin', line:'One covers' },
  ];
  return (
    <div style={{ display:'flex', gap:9 }}>
      {tiles.map(t => {
        const on = t.k === mode;
        return (
          <button key={t.k} style={{ flex:1, padding:'12px 11px', textAlign:'left', cursor:'pointer', background:on?H.bg50:N.surface, border:`1.5px solid ${on?H.accent:N.border}`, borderRadius:12, boxShadow:on?`0 2px 8px ${H.bg200}`:'none', display:'flex', flexDirection:'column', gap:7 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <i data-lucide={t.icon} style={{ width:18, height:18, color:on?H.accent:N.fg3 }}/>
              <Check on={on}/>
            </div>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:on?H.accent700:N.fg1, letterSpacing:-0.1 }}>{t.title}</div>
              <div style={{ fontSize:11, color:N.fg3, marginTop:1 }}>{t.line}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DateWindow({ value='Sun Jun 15 — Sat Jun 21', error }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:9, padding:'10px 11px', background: error?N.errorBg:N.surface, border:`1.5px solid ${error?N.error:N.border}`, borderRadius:8 }}>
      <i data-lucide="calendar-range" style={{ width:16, height:16, color: error?N.error:H.accent, flexShrink:0 }}/>
      <span style={{ flex:1, fontSize:12.5, fontWeight:600, color: error?N.error:N.fg1 }}>{value}</span>
      <i data-lucide="chevron-right" style={{ width:15, height:15, color:N.fg4 }}/>
    </div>
  );
}

function TitleCat({ value, placeholder, cat='family' }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <Field label="Title" value={value} placeholder={placeholder}/>
      <div><div style={{ fontSize:11, fontWeight:600, color:N.fg2, marginBottom:5 }}>Category</div>
        <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 12px', borderRadius:9999, background:H.bg100, color:H.accent700, fontSize:12, fontWeight:700 }}><span style={{ width:8, height:8, borderRadius:'50%', background:'#7c3aed' }}/>Family</span>
      </div>
    </div>
  );
}

function Section({ overline, children }) {
  return <Card><Overline color={H.accent700} style={{ marginBottom:9 }}>{overline}</Overline>{children}</Card>;
}

const THREE = [M.mom, M.dad, M.ava];

// ─── FRAME 1 · DEFAULT (collective) ────────────────────────────
function FrameDefault() {
  return (
    <Sheet label="Find a time setup · Default">
      <SheetBar title="Find a time" action="Next"/>
      <SheetBody>
        <Explainer/>
        <Card><TitleCat value="Plan a family call"/></Card>
        <Section overline="Who's needed">
          <WhoRow m={M.mom} value="Required"/>
          <WhoRow m={M.dad} value="Required"/>
          <WhoRow m={M.ava} value="Optional" last/>
        </Section>
        <Section overline="How it works"><ModeTiles mode="collective"/><div style={{ fontSize:11, color:N.fg3, marginTop:9 }}>Finds times when everyone required is free at once.</div></Section>
        <Section overline="Duration"><Segmented options={['30 min', '1 hr', 'Custom']} value="30 min" full/></Section>
        <Section overline="Date window"><DateWindow/></Section>
      </SheetBody>
    </Sheet>
  );
}

// ─── FRAME 2 · ROUND-ROBIN (rule picker visible) ───────────────
function FrameRoundRobin() {
  return (
    <Sheet label="Find a time setup · Round-robin">
      <SheetBar title="Find a time" action="Next"/>
      <SheetBody>
        <Explainer/>
        <Card><TitleCat value="School pickup cover"/></Card>
        <Section overline="Who's needed">
          <WhoRow m={M.mom} value="Required"/>
          <WhoRow m={M.dad} value="Required"/>
          <WhoRow m={M.ava} value="Optional" last/>
        </Section>
        <Section overline="How it works"><ModeTiles mode="round"/><div style={{ fontSize:11, color:N.fg3, marginTop:9 }}>Whoever's free gets it. Pick a rule for who covers.</div></Section>
        <Section overline="Round-robin rule"><Segmented options={['Fair rotation', 'By role']} value="Fair rotation" full/></Section>
        <Section overline="Duration"><Segmented options={['30 min', '1 hr', 'Custom']} value="1 hr" full/></Section>
      </SheetBody>
    </Sheet>
  );
}

// ─── FRAME 3 · INVALID ─────────────────────────────────────────
function FrameInvalid() {
  return (
    <Sheet label="Find a time setup · Invalid">
      <SheetBar title="Find a time" action="Next" actionDisabled/>
      <SheetBody>
        <Explainer/>
        <Card><TitleCat value="Plan a family call"/></Card>
        <Section overline="Who's needed">
          <WhoRow m={M.mom} value="Optional" invalid/>
          <WhoRow m={M.dad} value="Optional" invalid/>
          <WhoRow m={M.ava} value="Optional" last invalid/>
          <div style={{ fontSize:10.5, color:N.error, display:'flex', alignItems:'center', gap:4, marginTop:8 }}><i data-lucide="circle-alert" style={{ width:11, height:11 }}/>Mark at least one member as required</div>
        </Section>
        <Section overline="Date window">
          <DateWindow value="Sat Jun 21 — Sun Jun 15" error/>
          <div style={{ fontSize:10.5, color:N.error, display:'flex', alignItems:'center', gap:4, marginTop:8 }}><i data-lucide="circle-alert" style={{ width:11, height:11 }}/>End date is before the start date</div>
        </Section>
      </SheetBody>
    </Sheet>
  );
}

// ─── FRAME 4 · COMPUTING ───────────────────────────────────────
function FrameComputing() {
  return (
    <Sheet label="Find a time setup · Computing">
      <SheetBar title="Find a time" action="Next" actionSaving/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px', gap:18 }}>
        <div style={{ position:'relative', width:64, height:64 }}>
          <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:`3px solid ${H.bg100}` }}/>
          <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'3px solid transparent', borderTopColor:H.accent, animation:'sh-spin 0.9s linear infinite' }}/>
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="users" style={{ width:24, height:24, color:H.accent }}/></div>
        </div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:14.5, fontWeight:700, color:N.fg1 }}>Checking everyone's availability</div>
          <div style={{ fontSize:12, color:N.fg3, marginTop:4 }}>Composing Mom, Dad and Ava's free time</div>
        </div>
        <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:9 }}>
          {[0,1,2].map(i => <div key={i} style={{ display:'flex', alignItems:'center', gap:10 }}><Shimmer w={30} h={30} r={15}/><Shimmer w="50%" h={11}/><div style={{ flex:1 }}/><Shimmer w={42} h={16} r={8}/></div>)}
        </div>
      </div>
    </Sheet>
  );
}

// ─── FRAME 5 · NO-OVERLAP WARNING ──────────────────────────────
function FrameNoOverlap() {
  return (
    <Sheet label="Find a time setup · No overlap">
      <SheetBar title="Find a time" action="Next"/>
      <SheetBody>
        <Banner tone="warning" icon="triangle-alert" title="No time works for all 3">Try making Dad optional, or widen the date window.</Banner>
        <Card><TitleCat value="Plan a family call"/></Card>
        <Section overline="Who's needed">
          <WhoRow m={M.mom} value="Required"/>
          <WhoRow m={M.dad} value="Required"/>
          <WhoRow m={M.ava} value="Required" last/>
          <button style={{ marginTop:9, width:'100%', height:38, borderRadius:9, border:`1px solid ${H.bg200}`, background:H.bg50, color:H.accent700, fontSize:12, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6 }}><i data-lucide="user-minus" style={{ width:14, height:14 }}/>Make Dad optional</button>
        </Section>
        <Section overline="Date window"><DateWindow/><button style={{ marginTop:9, width:'100%', height:38, borderRadius:9, border:`1px solid ${N.border}`, background:N.surface, color:N.fg2, fontSize:12, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6 }}><i data-lucide="calendar-plus" style={{ width:14, height:14 }}/>Widen to two weeks</button></Section>
      </SheetBody>
    </Sheet>
  );
}

// ─── FRAME 6 · EXPLAINER EXPANDED ──────────────────────────────
function FrameExplainer() {
  return (
    <Sheet label="Find a time setup · Explainer expanded">
      <SheetBar title="Find a time" action="Next"/>
      <SheetBody>
        <Explainer expanded/>
        <Card><TitleCat value="Plan a family call"/></Card>
        <Section overline="Who's needed">
          <WhoRow m={M.mom} value="Required"/>
          <WhoRow m={M.dad} value="Required"/>
          <WhoRow m={M.ava} value="Optional" last/>
        </Section>
        <Section overline="Duration"><Segmented options={['30 min', '1 hr', 'Custom']} value="30 min" full/></Section>
      </SheetBody>
    </Sheet>
  );
}

Object.assign(window, { FrameDefault, FrameRoundRobin, FrameInvalid, FrameComputing, FrameNoOverlap, FrameExplainer });
