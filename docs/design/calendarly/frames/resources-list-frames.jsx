// F9 — Bookable Home Resources · List (v2) · 300×620 · Home green
// Same ListOfRows recipe as Bills/Maintenance/Pets. owner_type=home.
// Frames: empty (templates) · loaded · loading · error · offline

const { N, H } = window;
const { Phone, TopBar, Card, FAB, Shimmer, Banner, EmptyState, PrimaryBtn } = window;

function ResourceRow({ icon, name, type, status, free, dim, onClick }) {
  return (
    <Card pad="11px 12px" onClick={onClick} style={{ display:'flex', alignItems:'center', gap:11, opacity:dim?0.55:1, cursor:'pointer' }}>
      <div style={{ width:40, height:40, borderRadius:11, flexShrink:0, background:H.bg50, color:H.accent, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide={icon} style={{ width:20, height:20, strokeWidth:2 }}/></div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13.5, fontWeight:700, color:N.fg1, letterSpacing:-0.2 }}>{name}</div>
        <span style={{ display:'inline-flex', marginTop:5, padding:'2px 8px', borderRadius:9999, background:N.sunken, color:N.fg3, fontSize:10, fontWeight:600 }}>{type}</span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
        <span style={{ width:7, height:7, borderRadius:'50%', background: free?N.success:N.fg4 }}/>
        <span style={{ fontSize:11, fontWeight:600, color: free?N.success:N.fg3, whiteSpace:'nowrap' }}>{status}</span>
      </div>
    </Card>
  );
}

const RESOURCES = [
  { icon:'bed-double', name:'Guest room', type:'Room', status:'Free now', free:true },
  { icon:'zap', name:'EV charger', type:'Charger', status:'Booked until 4 PM', free:false },
  { icon:'car', name:'Driveway', type:'Parking', status:'Free now', free:true },
  { icon:'wrench', name:'Power tools', type:'Tools', status:'Free now', free:true },
  { icon:'tent-tree', name:'Lake cabin', type:'Getaway', status:'Booked until Sun', free:false },
];

const TEMPLATES = [
  { icon:'bed-double', label:'Guest room' },
  { icon:'car', label:'Driveway' },
  { icon:'zap', label:'EV charger' },
  { icon:'wrench', label:'Tools' },
  { icon:'plus', label:'Other' },
];

function Body({ children }) {
  return <div style={{ flex:1, overflow:'auto', padding:'12px 12px 92px', display:'flex', flexDirection:'column', gap:9 }}>{children}</div>;
}

// ─── FRAME 1 · EMPTY (templates) ───────────────────────────────
function FrameEmpty() {
  return (
    <Phone label="Resources · Empty">
      <TopBar title="Resources" right={{ text:'Add' }}/>
      <Body>
        <Card pad="18px 16px" style={{ textAlign:'center' }}>
          <div style={{ width:50, height:50, borderRadius:14, background:H.bg50, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}><i data-lucide="package-open" style={{ width:24, height:24, color:H.accent }}/></div>
          <div style={{ fontSize:15, fontWeight:700, color:N.fg1 }}>Add what your household shares</div>
          <div style={{ fontSize:12, color:N.fg3, lineHeight:'17px', marginTop:5 }}>Anything members book — rooms, the driveway, tools. Start from a template.</div>
        </Card>
        <div style={{ fontSize:11, fontWeight:700, color:N.fg3, textTransform:'uppercase', letterSpacing:0.06, padding:'4px 2px 0' }}>Templates</div>
        {TEMPLATES.map((t, i) => (
          <button key={i} style={{ display:'flex', alignItems:'center', gap:11, width:'100%', padding:'11px 12px', background:N.surface, border:`1px solid ${N.border}`, borderRadius:14, boxShadow:'0 1px 3px rgba(0,0,0,0.04)', cursor:'pointer', textAlign:'left' }}>
            <div style={{ width:36, height:36, borderRadius:10, flexShrink:0, background:i===4?N.sunken:H.bg50, color:i===4?N.fg3:H.accent, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide={t.icon} style={{ width:18, height:18 }}/></div>
            <span style={{ flex:1, fontSize:13.5, fontWeight:700, color:N.fg1 }}>{t.label}</span>
            <i data-lucide="chevron-right" style={{ width:16, height:16, color:N.fg4 }}/>
          </button>
        ))}
      </Body>
      <FAB icon="plus" bottom={26}/>
    </Phone>
  );
}

// ─── FRAME 2 · LOADED ──────────────────────────────────────────
function FrameLoaded() {
  return (
    <Phone label="Resources · Loaded">
      <TopBar title="Resources" right={{ text:'Add' }}/>
      <Body>
        {RESOURCES.map((r, i) => <ResourceRow key={i} {...r}/>)}
      </Body>
      <FAB icon="plus" bottom={26}/>
    </Phone>
  );
}

// ─── FRAME 3 · LOADING ─────────────────────────────────────────
function FrameLoading() {
  return (
    <Phone label="Resources · Loading">
      <TopBar title="Resources" right={{ text:'Add', muted:true }}/>
      <Body>
        {[0,1,2,3,4].map(i => (
          <Card key={i} pad="11px 12px" style={{ display:'flex', alignItems:'center', gap:11 }}>
            <Shimmer w={40} h={40} r={11}/>
            <div style={{ flex:1 }}><Shimmer w="55%" h={12}/><Shimmer w={48} h={14} r={9} style={{ marginTop:7 }}/></div>
            <Shimmer w={56} h={11}/>
          </Card>
        ))}
      </Body>
    </Phone>
  );
}

// ─── FRAME 4 · ERROR ───────────────────────────────────────────
function FrameError() {
  return (
    <Phone label="Resources · Error">
      <TopBar title="Resources" right={{ text:'Add' }}/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'24px 28px' }}>
        <div style={{ width:56, height:56, borderRadius:'50%', background:N.errorBg, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12 }}><i data-lucide="cloud-off" style={{ width:26, height:26, color:N.error }}/></div>
        <div style={{ fontSize:15.5, fontWeight:700, color:N.fg1 }}>Couldn't load resources</div>
        <div style={{ fontSize:12.5, color:N.fg3, lineHeight:'18px', maxWidth:220, marginTop:5 }}>Check your connection and try again.</div>
        <div style={{ marginTop:16, width:160 }}><PrimaryBtn icon="rotate-cw">Retry</PrimaryBtn></div>
      </div>
    </Phone>
  );
}

// ─── FRAME 5 · OFFLINE ─────────────────────────────────────────
function FrameOffline() {
  return (
    <Phone label="Resources · Offline">
      <TopBar title="Resources" right={{ text:'Add', muted:true }}/>
      <div style={{ padding:'10px 12px 0' }}><Banner tone="amber" icon="wifi-off" title="You're offline">Showing cached resources. Availability may be out of date.</Banner></div>
      <Body>
        {RESOURCES.map((r, i) => <ResourceRow key={i} {...r} dim/>)}
      </Body>
    </Phone>
  );
}

Object.assign(window, { FrameEmpty, FrameLoaded, FrameLoading, FrameError, FrameOffline, ResourceRow });
