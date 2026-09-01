// F13 — Schedule a Visit (vendor/guest) · Setup (sheet, v2) · 300×620 · Home green
// Offer-slots-from-composed-availability engine + external audience + link.
// Frames: default · invalid · no-host-available · generating · link-created

const { N, H, M } = window;
const { Sheet, SheetBar, SheetBody, Card, Overline, Field, Stepper, ValueRow,
        MemberSelectRow, Check, Toggle, Banner, Shimmer, PrimaryBtn } = window;

const VTYPES = [
  { k:'Vendor', icon:'wrench' }, { k:'Guest', icon:'user-round' }, { k:'Delivery', icon:'package' }, { k:'Service', icon:'hard-hat' },
];

function VisitTypeChips({ selected }) {
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
      {VTYPES.map(t => {
        const on = t.k === selected;
        return <button key={t.k} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 12px', borderRadius:9999, border:`1px solid ${on?'transparent':N.border}`, background:on?H.bg100:N.surface, color:on?H.accent700:N.fg2, fontSize:12, fontWeight:on?700:600, cursor:'pointer' }}><i data-lucide={t.icon} style={{ width:13, height:13 }}/>{t.k}</button>;
      })}
    </div>
  );
}

function WeekdayGrid({ on=[false,true,true,true,true,true,false], error }) {
  const days = ['S','M','T','W','T','F','S'];
  return (
    <div style={{ display:'flex', gap:5 }}>
      {days.map((d, i) => (
        <div key={i} style={{ flex:1, height:30, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, background:on[i]?H.accent:(error?N.errorBg:N.sunken), color:on[i]?'#fff':(error?N.error:N.fg4), border: error&&!on[i]?`1px solid ${N.errorLight}`:'none', cursor:'pointer' }}>{d}</div>
      ))}
    </div>
  );
}

function Section({ overline, children, action }) {
  return <Card>{overline && <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:9 }}><Overline color={H.accent700}>{overline}</Overline>{action}</div>}{children}</Card>;
}

function VisitExplainer() {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:9, padding:'10px 12px', background:N.infoBg, border:`1px solid ${N.infoLight}`, borderRadius:12 }}>
      <i data-lucide="info" style={{ width:15, height:15, color:N.info, flexShrink:0, marginTop:1 }}/>
      <span style={{ fontSize:11.5, color:'#075985', lineHeight:'16px', fontWeight:500 }}>Slots come from when your chosen hosts are personally free.</span>
    </div>
  );
}

function AccessNote({ value }) {
  return (
    <div>
      <Field placeholder="Entry note for the visitor" value={value}/>
      <button style={{ display:'flex', alignItems:'center', gap:9, width:'100%', padding:'10px 11px', marginTop:9, background:N.surface, border:`1px solid ${N.border}`, borderRadius:10, cursor:'pointer', textAlign:'left' }}>
        <div style={{ width:30, height:30, borderRadius:8, flexShrink:0, background:N.sunken, color:N.fg2, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="key-round" style={{ width:15, height:15 }}/></div>
        <span style={{ flex:1, fontSize:12.5, fontWeight:600, color:N.fg1 }}>Link an access code</span>
        <i data-lucide="chevron-right" style={{ width:16, height:16, color:N.fg4 }}/>
      </button>
    </div>
  );
}

function WindowDuration({ winError }) {
  return (
    <div>
      <ValueRow label="Offered window" error={winError}>
        <span style={{ fontSize:12, fontWeight:600, color:winError?N.error:N.fg1, padding:'7px 10px', background:winError?N.errorBg:N.sunken, borderRadius:8, border: winError?`1px solid ${N.errorLight}`:'none' }}>{winError?'Not set':'Jun 16 – Jun 27'}</span>
      </ValueRow>
      <ValueRow label="Visit length" last><Stepper value="1" unit="hr"/></ValueRow>
    </div>
  );
}

// ─── FRAME 1 · DEFAULT ─────────────────────────────────────────
function FrameDefault() {
  return (
    <Sheet label="Schedule a visit · Default">
      <SheetBar title="Schedule a visit" action="Next"/>
      <SheetBody>
        <VisitExplainer/>
        <Section><Field label="Title" value="Plumber visit"/><div style={{ marginTop:11 }}><div style={{ fontSize:11, fontWeight:600, color:N.fg2, marginBottom:7 }}>Visit type</div><VisitTypeChips selected="Vendor"/></div></Section>
        <Section overline="Who must be home"><MemberSelectRow m={M.dad} sub="Required at home" last trailing={<Check on/>}/></Section>
        <Section overline="When"><WindowDuration/></Section>
        <Section overline="Offer these times"><WeekdayGrid/><div style={{ display:'flex', gap:7, marginTop:10 }}><span style={{ fontSize:12, fontWeight:700, color:H.accent700, padding:'6px 11px', background:H.bg100, borderRadius:9999 }}>Mornings only</span><span style={{ fontSize:12, fontWeight:600, color:N.fg2, padding:'6px 11px', background:N.surface, border:`1px solid ${N.border}`, borderRadius:9999 }}>9 AM – 12 PM</span></div></Section>
        <Section overline="Access"><AccessNote value="Front door code on arrival"/></Section>
        <Section><ValueRow label="Generate a shareable booking link" last><Toggle on/></ValueRow></Section>
      </SheetBody>
    </Sheet>
  );
}

// ─── FRAME 2 · INVALID ─────────────────────────────────────────
function FrameInvalid() {
  return (
    <Sheet label="Schedule a visit · Invalid">
      <SheetBar title="Schedule a visit" action="Next" actionDisabled/>
      <SheetBody>
        <VisitExplainer/>
        <Section><Field label="Title" value="Plumber visit"/><div style={{ marginTop:11 }}><div style={{ fontSize:11, fontWeight:600, color:N.fg2, marginBottom:7 }}>Visit type</div><VisitTypeChips selected="Vendor"/></div></Section>
        <Section overline="Who must be home">
          <MemberSelectRow m={M.dad} sub="Required at home" last trailing={<Check on={false}/>}/>
          <div style={{ fontSize:10.5, color:N.error, display:'flex', alignItems:'center', gap:4, marginTop:8 }}><i data-lucide="circle-alert" style={{ width:11, height:11 }}/>Pick at least one host who must be home</div>
        </Section>
        <Section overline="When">
          <WindowDuration winError/>
          <div style={{ fontSize:10.5, color:N.error, display:'flex', alignItems:'center', gap:4, marginTop:8 }}><i data-lucide="circle-alert" style={{ width:11, height:11 }}/>Set an offered date window</div>
        </Section>
      </SheetBody>
    </Sheet>
  );
}

// ─── FRAME 3 · NO-HOST-AVAILABLE ───────────────────────────────
function FrameNoHost() {
  return (
    <Sheet label="Schedule a visit · No host free">
      <SheetBar title="Schedule a visit" action="Next"/>
      <SheetBody>
        <Banner tone="warning" icon="triangle-alert" title="Nobody you picked is free those days">Widen the window, or add another host who can be home.</Banner>
        <Section><Field label="Title" value="Plumber visit"/></Section>
        <Section overline="Who must be home">
          <MemberSelectRow m={M.dad} sub="Free: none in this window" last trailing={<Check on/>}/>
          <button style={{ marginTop:9, width:'100%', height:38, borderRadius:9, border:`1px solid ${H.bg200}`, background:H.bg50, color:H.accent700, fontSize:12, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6 }}><i data-lucide="user-plus" style={{ width:14, height:14 }}/>Add another host</button>
        </Section>
        <Section overline="When"><WindowDuration/><button style={{ marginTop:9, width:'100%', height:38, borderRadius:9, border:`1px solid ${N.border}`, background:N.surface, color:N.fg2, fontSize:12, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6 }}><i data-lucide="calendar-plus" style={{ width:14, height:14 }}/>Widen the window</button></Section>
      </SheetBody>
    </Sheet>
  );
}

// ─── FRAME 4 · GENERATING ──────────────────────────────────────
function FrameGenerating() {
  return (
    <Sheet label="Schedule a visit · Generating">
      <SheetBar title="Schedule a visit" action="Next" actionSaving/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px', gap:18 }}>
        <div style={{ position:'relative', width:64, height:64 }}>
          <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:`3px solid ${H.bg100}` }}/>
          <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'3px solid transparent', borderTopColor:H.accent, animation:'sh-spin 0.9s linear infinite' }}/>
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="door-open" style={{ width:24, height:24, color:H.accent }}/></div>
        </div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:14.5, fontWeight:700, color:N.fg1 }}>Building the slots you'll offer</div>
          <div style={{ fontSize:12, color:N.fg3, marginTop:4 }}>Composing Dad's free mornings</div>
        </div>
        <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:9 }}>{[0,1,2].map(i => <Shimmer key={i} h={42} r={12}/>)}</div>
      </div>
    </Sheet>
  );
}

// ─── FRAME 5 · LINK-CREATED SUCCESS ────────────────────────────
function FrameLinkCreated() {
  return (
    <Sheet label="Schedule a visit · Link created">
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'24px 26px' }}>
        <div style={{ position:'relative', width:84, height:84, marginBottom:20 }}>
          <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:`radial-gradient(circle at 30% 30%, ${H.bg50}, ${H.bg100})` }}/>
          <div style={{ position:'absolute', inset:16, borderRadius:'50%', background:H.accent, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 8px 20px ${H.shadow}` }}><i data-lucide="check" style={{ width:28, height:28, color:'#fff', strokeWidth:3 }}/></div>
        </div>
        <div style={{ fontSize:18, fontWeight:700, color:N.fg1, letterSpacing:-0.3 }}>Visit window ready</div>
        <div style={{ fontSize:13, color:N.fg3, lineHeight:'19px', maxWidth:240, marginTop:7 }}>Share the link so they can pick a time that works.</div>
        <div style={{ width:'100%', display:'flex', alignItems:'center', gap:10, background:N.surface, border:`1px solid ${N.border}`, borderRadius:12, padding:'11px 13px', boxShadow:'0 1px 3px rgba(0,0,0,0.05)', marginTop:18 }}>
          <i data-lucide="link" style={{ width:16, height:16, color:H.accent, flexShrink:0 }}/>
          <code style={{ flex:1, minWidth:0, textAlign:'left', fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize:12, color:N.fg1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>pantopus.com/visit/maple-plumber</code>
          <button style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'7px 11px', borderRadius:8, background:H.bg50, border:`1px solid ${H.bg200}`, color:H.accent700, fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0 }}><i data-lucide="copy" style={{ width:13, height:13 }}/>Copy</button>
        </div>
        <div style={{ marginTop:14, width:'100%' }}><PrimaryBtn icon="share-2">Share link</PrimaryBtn></div>
      </div>
    </Sheet>
  );
}

Object.assign(window, { FrameDefault, FrameInvalid, FrameNoHost, FrameGenerating, FrameLinkCreated });
