// Pantopus — Calendarly · Scheduling Summary Card
// An at-a-glance "X bookings this month" pulse embedded at the TOP of the
// Scheduling Hub — not its own screen. Extends Me.html stats[] card: one
// white card, a row of metric cells split by 1px hairline dividers, labels
// keyed to the owner pillar. Powered by getBusinessInsights('30d').
//
// 5 frames: default (Personal) · empty (share CTA) · loading skeleton ·
//           error (retry) · single-event-type (Business violet).

const P = {
  bg:'#f6f7f9', surface:'#ffffff', sunken:'#f3f4f6',
  border:'#e5e7eb', borderSub:'#f3f4f6', borderStrong:'#d1d5db',
  fg1:'#111827', fg2:'#374151', fg3:'#6b7280', fg4:'#9ca3af',
  success:'#059669', successBg:'#d1fae5', error:'#b91c1c', errorBg:'#fef2f2',
};

const PILLAR = {
  personal: { key:'personal', label:'Personal', icon:'user',  accent:'#0284c7', bg:'#f0f9ff', soft:'#e0f2fe', ring:'#bae6fd', shadow:'rgba(2,132,199,0.28)' },
  home:     { key:'home',     label:'Home',     icon:'house', accent:'#16a34a', bg:'#f0fdf4', soft:'#dcfce7', ring:'#bbf7d0', shadow:'rgba(22,163,74,0.28)' },
  business: { key:'business', label:'Business', icon:'store', accent:'#7c3aed', bg:'#faf5ff', soft:'#f3e8ff', ring:'#e9d5ff', shadow:'rgba(124,58,237,0.28)' },
};

// ─── Shell ─────────────────────────────────────────────────────

function StatusBar() {
  const c = P.fg1;
  return (
    <div style={{
      display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'16px 28px 0', height:44, boxSizing:'border-box',
      fontFamily:'-apple-system, system-ui', fontWeight:600, fontSize:15, color:c, flexShrink:0,
    }}>
      <span>9:41</span>
      <div style={{ display:'flex', gap:5, alignItems:'center' }}>
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={c}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={c}/><rect x="9" y="2" width="3" height="9" rx="0.6" fill={c}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={c}/></svg>
        <svg width="15" height="11" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={c}/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={c}/><circle cx="7.5" cy="9" r="1.3" fill={c}/></svg>
        <svg width="24" height="11" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={c} strokeOpacity="0.35" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill={c}/><path d="M22.5 3.8v3.4c.6-.2 1-.8 1-1.7s-.4-1.5-1-1.7z" fill={c} fillOpacity="0.4"/></svg>
      </div>
    </div>
  );
}

function Phone({ children, label }) {
  return (
    <div style={{
      width:360, height:740, borderRadius:46, padding:10, background:'#0b0f17',
      boxShadow:'0 40px 80px rgba(17,24,39,0.22), 0 0 0 1px rgba(0,0,0,0.14)',
    }} data-screen-label={label}>
      <div style={{
        width:'100%', height:'100%', background:P.bg, borderRadius:36,
        overflow:'hidden', position:'relative', display:'flex', flexDirection:'column',
        fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{ position:'absolute', top:9, left:'50%', transform:'translateX(-50%)', width:108, height:30, borderRadius:20, background:'#000', zIndex:50 }}/>
        <StatusBar/>
        {children}
        <div style={{ position:'absolute', bottom:6, left:'50%', transform:'translateX(-50%)', width:120, height:4, borderRadius:4, background:'rgba(0,0,0,0.25)', zIndex:60 }}/>
      </div>
    </div>
  );
}

function TopBar({ title }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', padding:'8px 12px', height:56,
      boxSizing:'border-box', background:P.surface, borderBottom:`1px solid ${P.border}`, flexShrink:0,
    }}>
      <div style={{ width:36, height:36, flexShrink:0 }}/>
      <div style={{ flex:1, textAlign:'center', minWidth:0 }}>
        <div style={{ fontSize:16, fontWeight:600, color:P.fg1, letterSpacing:-0.2 }}>{title}</div>
      </div>
      <button style={{
        width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center',
        background:'transparent', border:'none', cursor:'pointer', color:P.fg1, padding:0,
      }}><i data-lucide="more-horizontal" style={{ width:22, height:22 }}/></button>
    </div>
  );
}

function IdentityPills({ active }) {
  const acc = PILLAR[active];
  return (
    <div style={{
      background:`linear-gradient(180deg, ${acc.bg} 0%, ${P.surface} 100%)`,
      padding:'12px 16px 14px', flexShrink:0, borderBottom:`1px solid ${P.borderSub}`,
    }}>
      <div style={{ display:'flex', gap:6, padding:3, background:P.surface, borderRadius:9999, border:`1px solid ${P.border}` }}>
        {Object.values(PILLAR).map((iden) => {
          const on = iden.key === active;
          return (
            <button key={iden.key} style={{
              flex:1, height:32, borderRadius:9999, border:'none', cursor:'pointer',
              background:on?iden.accent:'transparent', color:on?'#fff':P.fg2,
              fontSize:12, fontWeight:700, letterSpacing:-0.05,
              display:'inline-flex', alignItems:'center', justifyContent:'center', gap:5,
            }}>
              <i data-lucide={iden.icon} style={{ width:12, height:12, strokeWidth:2.4 }}/>{iden.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Shimmer({ w='100%', h=12, r=6, style={} }) {
  return (
    <div style={{
      width:w, height:h, borderRadius:r,
      background:'linear-gradient(90deg, #eef0f3 0%, #f6f7f9 50%, #eef0f3 100%)',
      backgroundSize:'200% 100%', animation:'sh-shimmer 1.4s ease-in-out infinite', ...style,
    }}/>
  );
}

// ─── Card pieces ───────────────────────────────────────────────

function CardHeader({ acc, period, showPeriod=true }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
      <div style={{ fontSize:11, fontWeight:700, color:acc.accent, letterSpacing:'0.08em', textTransform:'uppercase' }}>This month</div>
      {showPeriod && (
        <div style={{ display:'flex', gap:3, padding:3, background:P.sunken, borderRadius:9999 }}>
          {['This week','This month'].map((t) => {
            const on = t === period;
            return (
              <button key={t} style={{
                padding:'5px 11px', borderRadius:9999, border:'none', cursor:'pointer',
                background:on?acc.accent:'transparent', color:on?'#fff':P.fg3,
                fontSize:11, fontWeight:on?700:600, letterSpacing:-0.05, whiteSpace:'nowrap',
              }}>{t}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCell({ value, label, delta, accent }) {
  const color = delta === 'up' ? P.success : delta === 'down' ? P.error : (accent || P.fg1);
  return (
    <div style={{ flex:1, padding:'0 4px', textAlign:'left', minWidth:0 }}>
      <div style={{
        fontSize:22, fontWeight:700, color, letterSpacing:-0.5, lineHeight:'26px',
        display:'flex', alignItems:'center', gap:3,
        fontVariantNumeric:'tabular-nums',
      }}>
        {delta && <i data-lucide={delta==='up'?'arrow-up':'arrow-down'} style={{ width:16, height:16, strokeWidth:2.6 }}/>}
        {value}
      </div>
      <div style={{ fontSize:10.5, color:P.fg3, fontWeight:600, letterSpacing:0.02, marginTop:3, lineHeight:'13px' }}>{label}</div>
    </div>
  );
}

function Divider() {
  return <div style={{ width:1, alignSelf:'stretch', background:P.borderSub, margin:'2px 0' }}/>;
}

// Flat sparkline — polyline in pillar color over a faint baseline.
function Sparkline({ accent, data }) {
  const W = 296, H = 40, pad = 2;
  const max = Math.max(...data), min = Math.min(...data);
  const span = max - min || 1;
  const pts = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (W - pad * 2);
    const y = pad + (1 - (d - min) / span) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const areaPts = `${pad},${H} ${pts.join(' ')} ${W-pad},${H}`;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display:'block', height:40 }}>
      <line x1="0" y1={H-1} x2={W} y2={H-1} stroke={P.borderSub} strokeWidth="1"/>
      <polygon points={areaPts} fill={accent} fillOpacity="0.08"/>
      <polyline points={pts.join(' ')} fill="none" stroke={accent} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
      <circle cx={pts[pts.length-1].split(',')[0]} cy={pts[pts.length-1].split(',')[1]} r="3" fill={accent}/>
    </svg>
  );
}

function SeeInsights({ accent }) {
  return (
    <div style={{ display:'flex', justifyContent:'flex-end', marginTop:12 }}>
      <button style={{
        background:'transparent', border:'none', padding:0, cursor:'pointer',
        color:accent, fontSize:12.5, fontWeight:600, letterSpacing:-0.05,
        display:'inline-flex', alignItems:'center', gap:3,
      }}>See insights<i data-lucide="chevron-right" style={{ width:14, height:14 }}/></button>
    </div>
  );
}

function CardShell({ children, accent }) {
  return (
    <div style={{ padding:'16px 16px 0' }}>
      <div style={{
        background:P.surface, border:`1px solid ${P.border}`, borderRadius:16,
        padding:16, boxShadow:'0 1px 3px rgba(0,0,0,0.06)',
      }}>{children}</div>
    </div>
  );
}

// Faded hint that the card sits atop the rest of the Hub.
function HubHint() {
  return (
    <div style={{ padding:'22px 16px 0', opacity:0.45 }}>
      <div style={{ fontSize:10.5, fontWeight:700, color:P.fg3, letterSpacing:0.08, textTransform:'uppercase', marginBottom:8 }}>Today &amp; upcoming</div>
      <div style={{
        background:P.surface, border:`1px solid ${P.border}`, borderRadius:14, padding:12,
        display:'flex', alignItems:'center', gap:12,
      }}>
        <div style={{ width:40, height:40, borderRadius:10, background:P.sunken }}/>
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6 }}>
          <div style={{ width:'60%', height:11, borderRadius:3, background:P.sunken }}/>
          <div style={{ width:'40%', height:9, borderRadius:3, background:P.sunken }}/>
        </div>
      </div>
    </div>
  );
}

// ─── Card variants ─────────────────────────────────────────────

function CardDefault({ acc, breakdown=true }) {
  return (
    <CardShell accent={acc}>
      <CardHeader acc={acc} period="This month"/>
      <div style={{ display:'flex', alignItems:'stretch', gap:10 }}>
        <StatCell value="18" label="Bookings"/>
        <Divider/>
        <StatCell value="+24%" label="vs last month" delta="up"/>
        <Divider/>
        <StatCell value="5" label="Upcoming"/>
        <Divider/>
        <StatCell value="1" label="No-shows"/>
      </div>
      <div style={{ marginTop:16 }}>
        <Sparkline accent={acc.accent} data={[3,5,4,7,6,9,8,11,10,13,12,16,18]}/>
      </div>
      {breakdown && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:12 }}>
          {[['Intro call','12'],['Consult','4'],['Coffee chat','2']].map(([t,n]) => (
            <span key={t} style={{
              display:'inline-flex', alignItems:'center', gap:5, padding:'4px 9px', borderRadius:9999,
              background:P.sunken, color:P.fg2, fontSize:11, fontWeight:600,
            }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:acc.accent }}/>
              {t}<span style={{ color:P.fg4, fontWeight:700 }}>{n}</span>
            </span>
          ))}
        </div>
      )}
      <SeeInsights accent={acc.accent}/>
    </CardShell>
  );
}

function CardBusiness({ acc }) {
  return (
    <CardShell accent={acc}>
      <CardHeader acc={acc} period="This month"/>
      <div style={{ display:'flex', alignItems:'stretch', gap:10 }}>
        <StatCell value="42" label="Bookings"/>
        <Divider/>
        <StatCell value="+11%" label="vs last month" delta="up"/>
        <Divider/>
        <StatCell value="9" label="Upcoming"/>
        <Divider/>
        <StatCell value="2" label="No-shows"/>
      </div>
      <div style={{ marginTop:16 }}>
        <Sparkline accent={acc.accent} data={[6,8,7,10,12,11,14,13,16,18,20,19,22]}/>
      </div>
      <SeeInsights accent={acc.accent}/>
    </CardShell>
  );
}

function CardEmpty({ acc }) {
  return (
    <CardShell accent={acc}>
      <CardHeader acc={acc} period="This month" showPeriod={false}/>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:14, padding:'4px 0 2px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{
            width:44, height:44, borderRadius:12, background:acc.bg, color:acc.accent,
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
          }}>
            <i data-lucide="calendar-clock" style={{ width:22, height:22 }}/>
          </div>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:15, fontWeight:700, color:P.fg1, letterSpacing:-0.2 }}>No bookings yet</div>
            <div style={{ fontSize:12.5, color:P.fg3, marginTop:2, lineHeight:'17px' }}>Share your link to get your first one.</div>
          </div>
        </div>
        <button style={{
          width:'100%', height:44, borderRadius:12, border:'none', background:acc.accent, color:'#fff',
          fontSize:13.5, fontWeight:700, cursor:'pointer', letterSpacing:-0.1,
          display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8,
          boxShadow:`0 6px 16px ${acc.shadow}`,
        }}>
          <i data-lucide="share-2" style={{ width:16, height:16, strokeWidth:2.2 }}/>Share booking link
        </button>
      </div>
    </CardShell>
  );
}

function CardLoading({ acc }) {
  return (
    <CardShell accent={acc}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <Shimmer w={88} h={11} r={3}/>
        <Shimmer w={120} h={26} r={9999}/>
      </div>
      <div style={{ display:'flex', alignItems:'stretch', gap:10 }}>
        {[0,1,2,3].map(i => (
          <React.Fragment key={i}>
            <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6 }}>
              <Shimmer w="70%" h={22} r={5}/>
              <Shimmer w="90%" h={9} r={3}/>
            </div>
            {i<3 && <Divider/>}
          </React.Fragment>
        ))}
      </div>
      <div style={{ marginTop:16 }}><Shimmer w="100%" h={40} r={8}/></div>
      <div style={{ display:'flex', justifyContent:'flex-end', marginTop:12 }}><Shimmer w={86} h={12} r={3}/></div>
    </CardShell>
  );
}

function CardError({ acc }) {
  return (
    <CardShell accent={acc}>
      <CardHeader acc={acc} period="This month" showPeriod={false}/>
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'4px 0 2px' }}>
        <div style={{
          width:40, height:40, borderRadius:10, background:P.sunken, color:P.fg3,
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
        }}>
          <i data-lucide="cloud-off" style={{ width:20, height:20 }}/>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13.5, fontWeight:600, color:P.fg1, letterSpacing:-0.1 }}>Couldn't load your numbers</div>
          <div style={{ fontSize:11.5, color:P.fg3, marginTop:1 }}>Check your connection and try again.</div>
        </div>
        <button style={{
          padding:'8px 14px', borderRadius:9999, background:P.surface, border:`1px solid ${P.border}`,
          color:P.fg2, fontSize:12, fontWeight:600, cursor:'pointer', flexShrink:0,
          display:'inline-flex', alignItems:'center', gap:5,
        }}>
          <i data-lucide="rotate-ccw" style={{ width:13, height:13 }}/>Retry
        </button>
      </div>
    </CardShell>
  );
}

// ─── Frames ────────────────────────────────────────────────────

function FrameDefault() {
  return (
    <Phone label="A5 Summary card — Default (Personal)">
      <TopBar title="Scheduling"/>
      <IdentityPills active="personal"/>
      <div style={{ flex:1, overflow:'auto', paddingBottom:24 }}>
        <CardDefault acc={PILLAR.personal}/>
        <HubHint/>
      </div>
    </Phone>
  );
}

function FrameEmpty() {
  return (
    <Phone label="A5 Summary card — Empty">
      <TopBar title="Scheduling"/>
      <IdentityPills active="personal"/>
      <div style={{ flex:1, overflow:'auto', paddingBottom:24 }}>
        <CardEmpty acc={PILLAR.personal}/>
        <HubHint/>
      </div>
    </Phone>
  );
}

function FrameLoading() {
  return (
    <Phone label="A5 Summary card — Loading">
      <TopBar title="Scheduling"/>
      <IdentityPills active="personal"/>
      <div style={{ flex:1, overflow:'auto', paddingBottom:24 }}>
        <CardLoading acc={PILLAR.personal}/>
        <HubHint/>
      </div>
    </Phone>
  );
}

function FrameError() {
  return (
    <Phone label="A5 Summary card — Error">
      <TopBar title="Scheduling"/>
      <IdentityPills active="personal"/>
      <div style={{ flex:1, overflow:'auto', paddingBottom:24 }}>
        <CardError acc={PILLAR.personal}/>
        <HubHint/>
      </div>
    </Phone>
  );
}

function FrameSingle() {
  return (
    <Phone label="A5 Summary card — Single event type (Business)">
      <TopBar title="Scheduling"/>
      <IdentityPills active="business"/>
      <div style={{ flex:1, overflow:'auto', paddingBottom:24 }}>
        <CardBusiness acc={PILLAR.business}/>
        <HubHint/>
      </div>
    </Phone>
  );
}

Object.assign(window, { FrameDefault, FrameEmpty, FrameLoading, FrameError, FrameSingle });
