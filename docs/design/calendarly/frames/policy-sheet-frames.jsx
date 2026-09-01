// Pantopus — Calendarly · G · Cancellation & Refund Policy Sheet — 3 frames
// Selector sheet (preset cards) like the Support Trains slot-preset config; custom
// fields reveal inline. A12.11 card picker, A10.8 plain-language footnote, A14.6
// settings rows. Business violet accent; no dark patterns.
//
// Frames: 1 default (Flexible) · 2 preset selected (Strict) · 3 custom (revealed).

const { E } = window;
const { C, SheetFrame, Card, Overline, IToggle, Stepper, PrimaryBtn } = window;
const BIZ = C.biz, BIZ_BG = C.bizBg;

const PRESETS = [
  { k:'Flexible', summary:'Full refund up to 24h before', preview:'Free cancellation up to 24 hours before. After that, no refund.' },
  { k:'Moderate', summary:'50% refund up to 48h before', preview:'50% refund up to 48 hours before. After that, no refund.' },
  { k:'Strict', summary:'No refund after booking', preview:'No refund once the booking is confirmed.' },
  { k:'Custom', summary:'Set your own rules', preview:'24 hours before: full refund. After that: 50% refund. Deposit is non-refundable.' },
];

function PresetCard({ p, selected }) {
  return (
    <button style={{ width:'100%', textAlign:'left', display:'flex', alignItems:'center', gap:11, cursor:'pointer', padding:'12px 13px', borderRadius:14, marginBottom:8, border:`${selected?1.5:1}px solid ${selected?BIZ:E.border}`, background:selected?BIZ_BG:E.surface, boxShadow:selected?'none':'0 1px 2px rgba(0,0,0,0.03)' }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13.5, fontWeight:700, color:E.fg1 }}>{p.k}</div>
        <div style={{ fontSize:11, color:E.fg3, marginTop:2 }}>{p.summary}</div>
      </div>
      <span style={{ width:20, height:20, borderRadius:'50%', flexShrink:0, display:'inline-flex', alignItems:'center', justifyContent:'center', background:selected?BIZ:'transparent', border:selected?'none':`1.5px solid ${E.borderStrong}` }}>
        {selected && <i data-lucide="check" style={{ width:12, height:12, color:'#fff', strokeWidth:3.2 }}/>}
      </span>
    </button>
  );
}

function CustomRows() {
  return (
    <Card>
      <div style={{ display:'flex', alignItems:'center', gap:11, padding:'11px 2px', borderBottom:`1px solid ${E.border}` }}>
        <div style={{ width:30, height:30, borderRadius:8, background:E.sunken, color:E.fg2, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i data-lucide="clock" style={{ width:15, height:15 }}/></div>
        <div style={{ flex:1, fontSize:12.5, fontWeight:600, color:E.fg1 }}>Free-cancellation cutoff</div>
        <Stepper value="24h" accent={BIZ} small/>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:11, padding:'11px 2px', borderBottom:`1px solid ${E.border}` }}>
        <div style={{ width:30, height:30, borderRadius:8, background:E.sunken, color:E.fg2, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i data-lucide="percent" style={{ width:15, height:15 }}/></div>
        <div style={{ flex:1, fontSize:12.5, fontWeight:600, color:E.fg1 }}>Refund after cutoff</div>
        <Stepper value="50%" accent={BIZ} small/>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:11, padding:'11px 2px', borderBottom:`1px solid ${E.border}` }}>
        <div style={{ width:30, height:30, borderRadius:8, background:E.sunken, color:E.fg2, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i data-lucide="lock" style={{ width:15, height:15 }}/></div>
        <div style={{ flex:1, fontSize:12.5, fontWeight:600, color:E.fg1 }}>Deposit is non-refundable</div>
        <IToggle on color={BIZ}/>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:11, padding:'11px 2px' }}>
        <div style={{ width:30, height:30, borderRadius:8, background:E.sunken, color:E.fg2, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i data-lucide="user-x" style={{ width:15, height:15 }}/></div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12.5, fontWeight:600, color:E.fg1 }}>No-show handling</div>
          <div style={{ fontSize:10.5, color:E.fg3, marginTop:1 }}>Charge full price</div>
        </div>
        <i data-lucide="chevron-right" style={{ width:16, height:16, color:E.fg4 }}/>
      </div>
    </Card>
  );
}

function Preview({ text }) {
  return (
    <div style={{ marginTop:4, padding:'12px 13px', background:BIZ_BG, borderRadius:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:7 }}>
        <i data-lucide="eye" style={{ width:13, height:13, color:BIZ }}/>
        <span style={{ fontSize:9.5, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:BIZ }}>What the invitee sees</span>
      </div>
      <div style={{ fontSize:12, color:E.fg2, lineHeight:'17px', fontWeight:500 }}>{text}</div>
    </div>
  );
}

function Sheet({ selected, custom }) {
  return (
    <SheetFrame label={`Policy · ${selected}`} title="Cancellation & refund policy" subhead="Pick how refunds work when someone cancels."
      footer={<PrimaryBtn>Save policy</PrimaryBtn>}>
      <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
        {PRESETS.map(p => <PresetCard key={p.k} p={p} selected={p.k===selected}/>)}
        {custom && <div style={{ marginTop:4, marginBottom:12 }}><CustomRows/></div>}
        <Preview text={PRESETS.find(p => p.k===selected).preview}/>
        <div style={{ fontSize:10.5, color:E.fg3, marginTop:9, padding:'0 2px', lineHeight:'15px' }}>{selected==='Flexible'?'Flexible is the friendliest — most people start here.':'Invitees see this wording before they pay.'}</div>
      </div>
    </SheetFrame>
  );
}

const FrameDefault = () => <Sheet selected="Flexible"/>;
const FramePreset = () => <Sheet selected="Strict"/>;
const FrameCustom = () => <Sheet selected="Custom" custom/>;

Object.assign(window, { POL_FrameDefault:FrameDefault, POL_FramePreset:FramePreset, POL_FrameCustom:FrameCustom });
