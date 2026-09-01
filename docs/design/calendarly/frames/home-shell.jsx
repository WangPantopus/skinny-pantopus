// Pantopus — Calendarly · Family / Home scheduling — shared shell (300×620)
// All "F" family-scheduling screens compose from these primitives so the month
// strip, agenda rows, slot rows, avatars, banners, FAB and tab bar read the same
// everywhere. Home pillar = green (--color-identity-home #16a34a). Lucide
// stroke-2, no emoji, shimmer skeletons, white cards · 1px border · 16px radius ·
// shadow-sm · NO left-border accents (color lives in chips / dots / pills).

// ─── Tokens ────────────────────────────────────────────────────
const N = {
  bg:'#f6f7f9', surface:'#ffffff', sunken:'#f3f4f6', raised:'#f9fafb', muted:'#f8fafc',
  border:'#e5e7eb', borderStrong:'#d1d5db', borderSubtle:'#f3f4f6',
  fg1:'#111827', fg2:'#374151', fg3:'#6b7280', fg4:'#9ca3af',
  success:'#059669', successLight:'#D1FAE5', successBg:'#F0FDF4',
  warning:'#D97706', warningLight:'#FDE68A', warningBg:'#FFFBEB', warning700:'#B45309',
  error:'#DC2626', errorLight:'#FECACA', errorBg:'#FEF2F2',
  info:'#0284c7', infoLight:'#BAE6FD', infoBg:'#F0F9FF',
  blue600:'#0284c7', blue700:'#0369a1',
  personal:'#0284c7', personalBg:'#DBEAFE', personalBg50:'#f0f9ff',
};
// Home green pillar.
const H = {
  accent:'#16a34a', accent700:'#15803d', accent800:'#166534',
  bg50:'#f0fdf4', bg100:'#dcfce7', bg200:'#bbf7d0',
  shadow:'rgba(22,163,74,0.28)',
};

// Category accents (dots + chips on event rows).
const CAT = {
  health:  { c:'#e11d48', label:'Health' },
  chore:   { c:'#f97316', label:'Chores' },
  meal:    { c:'#d97706', label:'Meals' },
  family:  { c:'#7c3aed', label:'Family' },
  school:  { c:'#2980b9', label:'School' },
  visit:   { c:'#0d9488', label:'Visit' },
};

// Household members (consistent across all screens).
const M = {
  mom:  { name:'Mom',  full:'Maria',  initials:'MK', grad:'linear-gradient(135deg, #34d399, #16a34a)' },
  dad:  { name:'Dad',  full:'David',  initials:'DK', grad:'linear-gradient(135deg, #60a5fa, #2563eb)' },
  ava:  { name:'Ava',  full:'Ava',    initials:'AV', grad:'linear-gradient(135deg, #f472b6, #db2777)' },
  tom:  { name:'Tomek',full:'Tomek',  initials:'TK', grad:'linear-gradient(135deg, #fbbf24, #d97706)' },
};

const SH = {
  background:'linear-gradient(90deg, #eef0f3 0%, #f6f7f9 50%, #eef0f3 100%)',
  backgroundSize:'200% 100%', animation:'sh-shimmer 1.4s ease-in-out infinite',
};

// ─── Phone shell (300×620) ─────────────────────────────────────
function StatusBar() {
  const c = N.fg1;
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 22px 0', height:34, boxSizing:'border-box', fontFamily:'-apple-system, system-ui', fontWeight:600, fontSize:12.5, color:c, flexShrink:0 }}>
      <span>9:41</span>
      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
        <svg width="15" height="10" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={c}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={c}/><rect x="9" y="2" width="3" height="9" rx="0.6" fill={c}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={c}/></svg>
        <svg width="13" height="10" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={c}/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={c}/><circle cx="7.5" cy="9" r="1.3" fill={c}/></svg>
        <svg width="21" height="10" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={c} strokeOpacity="0.35" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill={c}/><path d="M22.5 3.8v3.4c.6-.2 1-.8 1-1.7s-.4-1.5-1-1.7z" fill={c} fillOpacity="0.4"/></svg>
      </div>
    </div>
  );
}

function Phone({ children, label, indicatorLight }) {
  return (
    <div style={{ width:300, height:620, borderRadius:40, padding:8, background:'#0b0f17', boxShadow:'0 24px 50px rgba(17,24,39,0.20), 0 0 0 1px rgba(0,0,0,0.12)', flexShrink:0 }} data-screen-label={label}>
      <div style={{ width:'100%', height:'100%', background:N.bg, borderRadius:32, overflow:'hidden', position:'relative', display:'flex', flexDirection:'column', fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div style={{ position:'absolute', top:7, left:'50%', transform:'translateX(-50%)', width:88, height:24, borderRadius:16, background:'#000', zIndex:50 }}/>
        <StatusBar/>
        {children}
        <div style={{ position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)', width:100, height:4, borderRadius:4, background: indicatorLight ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.25)', zIndex:60 }}/>
      </div>
    </div>
  );
}

// Top bar — left: 'back' chevron | null ; right: {icon} or {text} action.
function TopBar({ title, back=true, center=true, right }) {
  return (
    <div style={{ display:'flex', alignItems:'center', padding:'6px 8px', height:46, boxSizing:'border-box', background:N.surface, borderBottom:`1px solid ${N.border}`, flexShrink:0 }}>
      <div style={{ width:34, display:'flex', justifyContent:'flex-start' }}>
        {back && <button style={{ width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'none', cursor:'pointer', color:N.fg1, padding:0 }}><i data-lucide="chevron-left" style={{ width:21, height:21 }}/></button>}
      </div>
      <div style={{ flex:1, textAlign: center ? 'center' : 'left', fontSize:15.5, fontWeight:600, color:N.fg1, letterSpacing:-0.2, paddingLeft: center?0:4 }}>{title}</div>
      <div style={{ minWidth:34, display:'flex', justifyContent:'flex-end' }}>
        {right ? (
          right.icon ? (
            <button title={right.label} style={{ width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', background: right.fill?H.bg50:'transparent', border:'none', borderRadius:9, cursor:'pointer', color: right.muted?N.fg4:H.accent700, padding:0 }}><i data-lucide={right.icon} style={{ width:19, height:19, strokeWidth:2 }}/></button>
          ) : (
            <button style={{ height:30, padding:'0 6px', background:'transparent', border:'none', cursor:'pointer', color: right.muted?N.fg4:H.accent700, fontSize:14, fontWeight:700, letterSpacing:-0.1 }}>{right.text}</button>
          )
        ) : null}
      </div>
    </div>
  );
}

function Body({ children, pad='8px 12px 16px', gap=11, style={} }) {
  return <div style={{ flex:1, overflow:'auto', padding:pad, display:'flex', flexDirection:'column', gap, ...style }}>{children}</div>;
}

// ─── Banners (12px radius, filled, NOT left-accent) ────────────
function Banner({ tone='info', icon, title, children, dismiss }) {
  const map = {
    info:    { bg:N.infoBg, bd:N.infoLight, ic:N.info, tc:'#075985' },
    amber:   { bg:N.warningBg, bd:N.warningLight, ic:N.warning, tc:N.warning700 },
    warning: { bg:N.warningBg, bd:N.warningLight, ic:N.warning, tc:N.warning700 },
    error:   { bg:N.errorBg, bd:N.errorLight, ic:N.error, tc:'#b91c1c' },
    success: { bg:N.successBg, bd:N.successLight, ic:N.success, tc:'#047857' },
    home:    { bg:H.bg50, bd:H.bg200, ic:H.accent, tc:H.accent700 },
  }[tone];
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:9, padding:'9px 11px', background:map.bg, border:`1px solid ${map.bd}`, borderRadius:12 }}>
      <i data-lucide={icon || (tone==='info'?'info':tone==='success'?'check-circle-2':'triangle-alert')} style={{ width:15, height:15, color:map.ic, flexShrink:0, marginTop:1, strokeWidth:2.2 }}/>
      <div style={{ flex:1, minWidth:0 }}>
        {title && <div style={{ fontSize:12, fontWeight:700, color:map.tc, letterSpacing:-0.1, marginBottom: children?2:0 }}>{title}</div>}
        {children && <div style={{ fontSize:11.5, color:N.fg2, lineHeight:'16px' }}>{children}</div>}
      </div>
      {dismiss && <i data-lucide="x" style={{ width:14, height:14, color:map.ic, flexShrink:0 }}/>}
    </div>
  );
}

// ─── Cards ─────────────────────────────────────────────────────
function Card({ children, style={}, pad=13, onClick }) {
  return <div onClick={onClick} style={{ background:N.surface, border:`1px solid ${N.border}`, borderRadius:16, boxShadow:'0 1px 3px rgba(0,0,0,0.04)', padding:pad, boxSizing:'border-box', ...style }}>{children}</div>;
}
function Overline({ children, color=N.fg3, style={} }) {
  return <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color, ...style }}>{children}</div>;
}

// ─── Avatars ───────────────────────────────────────────────────
function Avatar({ m, size=28, dim, ring, border=true }) {
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:m.grad, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.38, fontWeight:700, letterSpacing:-0.3, flexShrink:0, border: border?'2px solid #fff':'none', opacity:dim?0.4:1, boxShadow: ring?`0 0 0 2px ${ring}`:'none' }}>{m.initials}</div>
  );
}
function AvatarStack({ members, size=28, plus }) {
  return (
    <div style={{ display:'flex', alignItems:'center' }}>
      {members.map((m, i) => (
        <div key={i} style={{ marginLeft: i===0?0:-9, zIndex: members.length-i }}><Avatar m={m} size={size}/></div>
      ))}
      {plus != null && (
        <div style={{ marginLeft:-9, width:size, height:size, borderRadius:'50%', background:N.sunken, color:N.fg3, display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.34, fontWeight:700, border:'2px solid #fff', flexShrink:0 }}>+{plus}</div>
      )}
    </div>
  );
}

// ─── Chips ─────────────────────────────────────────────────────
function CatChip({ cat, small }) {
  const c = CAT[cat];
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding: small?'2px 7px':'3px 8px', borderRadius:9999, background:N.sunken, fontSize: small?10:10.5, fontWeight:600, color:N.fg2 }}>
      <span style={{ width:7, height:7, borderRadius:'50%', background:c.c, flexShrink:0 }}/>{c.label}
    </span>
  );
}
function Chip({ label, on, onColorBg=H.bg100, onColorFg=H.accent700, icon }) {
  return (
    <button style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:9999, border:`1px solid ${on?'transparent':N.border}`, background:on?onColorBg:N.surface, color:on?onColorFg:N.fg2, fontSize:12, fontWeight:on?700:600, cursor:'pointer', whiteSpace:'nowrap' }}>
      {icon && <i data-lucide={icon} style={{ width:12, height:12 }}/>}{label}
    </button>
  );
}

// ─── Segmented control (home-green selected) ───────────────────
function Segmented({ options, value, small, accent=H.accent, full }) {
  return (
    <div style={{ display:'flex', gap:3, padding:3, background:N.sunken, borderRadius:9, width: full?'100%':undefined }}>
      {options.map((o) => {
        const on = o === value;
        return <button key={o} style={{ flex:1, height: small?28:34, borderRadius:7, cursor:'pointer', border:'none', background:on?accent:'transparent', color:on?'#fff':N.fg3, boxShadow:on?'0 1px 2px rgba(0,0,0,0.12)':'none', fontSize: small?11:12, fontWeight:on?700:600, letterSpacing:-0.1, whiteSpace:'nowrap' }}>{o}</button>;
      })}
    </div>
  );
}

// ─── Toggle (home-green) ───────────────────────────────────────
function Toggle({ on, disabled }) {
  return (
    <div style={{ width:36, height:20, borderRadius:10, position:'relative', flexShrink:0, background: disabled?N.sunken:(on?H.accent:N.borderStrong), opacity:disabled?0.6:1 }}>
      <div style={{ position:'absolute', top:2, left:on?18:2, width:16, height:16, borderRadius:'50%', background:'#fff', boxShadow:'0 1px 2px rgba(0,0,0,0.22)' }}/>
    </div>
  );
}

// ─── Buttons ───────────────────────────────────────────────────
function PrimaryBtn({ children, icon, disabled, full=true, onClick, style={} }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ width:full?'100%':undefined, height:46, borderRadius:12, border:'none', background:disabled?N.sunken:H.accent, color:disabled?N.fg4:'#fff', fontSize:14, fontWeight:700, cursor:disabled?'not-allowed':'pointer', boxShadow:disabled?'none':`0 6px 16px ${H.shadow}`, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7, letterSpacing:-0.1, ...style }}>
      {icon && <i data-lucide={icon} style={{ width:16, height:16 }}/>}{children}
    </button>
  );
}
function SecondaryBtn({ children, icon, full=true, onClick, style={} }) {
  return (
    <button onClick={onClick} style={{ width:full?'100%':undefined, height:46, borderRadius:12, background:N.surface, color:N.fg2, border:`1px solid ${N.borderStrong}`, fontSize:14, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7, letterSpacing:-0.1, ...style }}>
      {icon && <i data-lucide={icon} style={{ width:15, height:15 }}/>}{children}
    </button>
  );
}
function TextBtn({ children, icon, tone=N.fg3, onClick }) {
  return (
    <button onClick={onClick} style={{ height:38, padding:'0 8px', background:'transparent', border:'none', cursor:'pointer', color:tone, fontSize:13, fontWeight:700, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6 }}>
      {icon && <i data-lucide={icon} style={{ width:14, height:14 }}/>}{children}
    </button>
  );
}

// ─── Sticky footer ─────────────────────────────────────────────
function StickyFooter({ children, gap=9 }) {
  return <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(255,255,255,0.96)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', borderTop:`1px solid ${N.border}`, padding:'10px 12px 16px', zIndex:12, display:'flex', gap, alignItems:'center' }}>{children}</div>;
}

// ─── FAB (52×52 home-green) ────────────────────────────────────
function FAB({ icon='plus', bottom=88 }) {
  return (
    <button style={{ position:'absolute', right:14, bottom, width:52, height:52, borderRadius:'50%', background:H.accent, border:'none', boxShadow:`0 8px 20px ${H.shadow}`, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', zIndex:14 }}>
      <i data-lucide={icon} style={{ width:24, height:24, strokeWidth:2.4 }}/>
    </button>
  );
}

// ─── Tab bar (76px, Home active) ───────────────────────────────
function TabBar({ active='home' }) {
  const tabs = [
    { id:'home', icon:'house', label:'Home' },
    { id:'pulse', icon:'radio', label:'Pulse' },
    { id:'tasks', icon:'list-checks', label:'Tasks' },
    { id:'mail', icon:'mail', label:'Mailbox' },
    { id:'me', icon:'user', label:'You' },
  ];
  return (
    <div style={{ position:'absolute', bottom:0, left:0, right:0, height:76, background:'rgba(255,255,255,0.97)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', borderTop:`1px solid ${N.border}`, display:'flex', alignItems:'flex-start', paddingTop:9, zIndex:10 }}>
      {tabs.map(t => {
        const on = t.id === active;
        return (
          <div key={t.id} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, color: on?H.accent:N.fg4 }}>
            <i data-lucide={t.icon} style={{ width:21, height:21, strokeWidth: on?2.4:2 }}/>
            <span style={{ fontSize:9.5, fontWeight: on?700:500, letterSpacing:-0.1 }}>{t.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Month strip header (weekday initials + date pills) ────────
function MonthStrip({ selected=16, today=16 }) {
  const days = [
    { d:'S', n:14 }, { d:'M', n:15 }, { d:'T', n:16 }, { d:'W', n:17 }, { d:'T', n:18 }, { d:'F', n:19 }, { d:'S', n:20 },
  ];
  return (
    <div style={{ background:N.surface, borderBottom:`1px solid ${N.border}`, padding:'8px 10px 10px', flexShrink:0 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 4px 7px' }}>
        <div style={{ fontSize:13, fontWeight:700, color:N.fg1, letterSpacing:-0.2 }}>June 2026</div>
        <div style={{ display:'flex', gap:2 }}>
          <i data-lucide="chevron-left" style={{ width:17, height:17, color:N.fg4 }}/>
          <i data-lucide="chevron-right" style={{ width:17, height:17, color:N.fg3 }}/>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
        {days.map(day => {
          const sel = day.n === selected, isToday = day.n === today;
          return (
            <div key={day.n} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
              <span style={{ fontSize:10, fontWeight:600, color:N.fg4 }}>{day.d}</span>
              <div style={{ width:30, height:30, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight: sel?700:600, background: sel?H.accent:'transparent', color: sel?'#fff':N.fg1, boxShadow: (isToday&&!sel)?`0 0 0 1.5px ${H.accent}`:'none' }}>{day.n}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Day section header ────────────────────────────────────────
function DaySection({ children }) {
  return <div style={{ fontSize:11, fontWeight:700, color:N.fg3, letterSpacing:0.02, padding:'4px 2px 0', textTransform:'none' }}>{children}</div>;
}

// ─── Event row card (time · title+loc · cat chip · avatar stack) ─
function EventRow({ time, ampm, title, loc, cat, members, plus, dim, onClick }) {
  return (
    <Card pad="11px 12px" onClick={onClick} style={{ display:'flex', alignItems:'center', gap:11, opacity:dim?0.55:1, cursor:'pointer' }}>
      <div style={{ width:42, flexShrink:0, textAlign:'center' }}>
        <div style={{ fontSize:13, fontWeight:700, color:N.fg1, letterSpacing:-0.3, fontVariantNumeric:'tabular-nums' }}>{time}</div>
        <div style={{ fontSize:9.5, fontWeight:600, color:N.fg4, marginTop:1 }}>{ampm}</div>
      </div>
      <div style={{ width:1, alignSelf:'stretch', background:N.border }}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13.5, fontWeight:700, color:N.fg1, letterSpacing:-0.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{title}</div>
        <div style={{ display:'flex', alignItems:'center', gap:7, marginTop:4 }}>
          <CatChip cat={cat} small/>
          {loc && <span style={{ fontSize:10.5, color:N.fg3, display:'inline-flex', alignItems:'center', gap:3, minWidth:0, overflow:'hidden' }}><i data-lucide="map-pin" style={{ width:10, height:10, flexShrink:0 }}/>{loc}</span>}
        </div>
      </div>
      {members && <AvatarStack members={members} size={26} plus={plus}/>}
    </Card>
  );
}

// ─── Slot row (Find-a-time / resource booking) ────────────────
// availability mini-bar: dots green=free, grey=busy.
function AvailDots({ states }) {
  return (
    <div style={{ display:'flex', gap:3 }}>
      {states.map((s, i) => <span key={i} style={{ width:8, height:8, borderRadius:'50%', background: s?H.accent:N.borderStrong }}/>)}
    </div>
  );
}

function Shimmer({ w='100%', h=12, r=6, style={} }) {
  return <div style={{ width:w, height:h, borderRadius:r, ...SH, ...style }}/>;
}

function EmptyState({ icon, title, body, children }) {
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'24px 28px', gap:4 }}>
      <div style={{ width:56, height:56, borderRadius:'50%', background:H.bg50, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:10 }}>
        <i data-lucide={icon} style={{ width:26, height:26, color:H.accent, strokeWidth:2 }}/>
      </div>
      <div style={{ fontSize:15.5, fontWeight:700, color:N.fg1, letterSpacing:-0.2 }}>{title}</div>
      {body && <div style={{ fontSize:12.5, color:N.fg3, lineHeight:'18px', maxWidth:230 }}>{body}</div>}
      {children}
    </div>
  );
}

// Scrim dialog (confirm).
function Dialog({ icon, tone='warn', title, body, children }) {
  const ic = tone==='error'?N.error:tone==='warn'?N.warning:H.accent;
  const icbg = tone==='error'?N.errorBg:tone==='warn'?N.warningBg:H.bg50;
  return (
    <div style={{ position:'absolute', inset:0, background:'rgba(17,24,39,0.5)', zIndex:30, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 20px' }}>
      <div style={{ width:'100%', maxWidth:300, background:N.surface, borderRadius:20, boxShadow:'0 20px 50px rgba(0,0,0,0.3)', padding:'20px 18px 16px', boxSizing:'border-box' }}>
        {icon && <div style={{ display:'flex', justifyContent:'center', marginBottom:13 }}><div style={{ width:40, height:40, borderRadius:'50%', background:icbg, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide={icon} style={{ width:20, height:20, color:ic }}/></div></div>}
        <h3 style={{ margin:'0 0 8px', fontSize:16.5, fontWeight:700, color:N.fg1, textAlign:'center', letterSpacing:-0.2 }}>{title}</h3>
        {body && <p style={{ margin:'0 0 16px', fontSize:13, color:N.fg2, textAlign:'center', lineHeight:'19px' }}>{body}</p>}
        {children}
      </div>
    </div>
  );
}

// Sheet shell — grabber + sheet top bar (Cancel / title / action).
function Sheet({ children, label, scrimChild }) {
  return (
    <div style={{ width:300, height:620, borderRadius:40, padding:8, background:'#0b0f17', boxShadow:'0 24px 50px rgba(17,24,39,0.20), 0 0 0 1px rgba(0,0,0,0.12)', flexShrink:0 }} data-screen-label={label}>
      <div style={{ width:'100%', height:'100%', background:N.bg, borderRadius:32, overflow:'hidden', position:'relative', display:'flex', flexDirection:'column', fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div style={{ position:'absolute', top:7, left:'50%', transform:'translateX(-50%)', width:88, height:24, borderRadius:16, background:'#000', zIndex:50 }}/>
        <StatusBar/>
        {/* dimmed backdrop hint */}
        <div style={{ height:18, flexShrink:0 }}/>
        <div style={{ flex:1, background:N.surface, borderTopLeftRadius:28, borderTopRightRadius:28, boxShadow:'0 -8px 30px rgba(0,0,0,0.12)', display:'flex', flexDirection:'column', overflow:'hidden', position:'relative' }}>
          <div style={{ display:'flex', justifyContent:'center', paddingTop:8, flexShrink:0 }}><div style={{ width:36, height:5, borderRadius:3, background:N.borderStrong }}/></div>
          {children}
          {scrimChild}
        </div>
        <div style={{ position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)', width:100, height:4, borderRadius:4, background:'rgba(0,0,0,0.3)', zIndex:60 }}/>
      </div>
    </div>
  );
}

// Sheet top bar — Cancel left / title center / action right.
function SheetBar({ title, cancel='Cancel', action, actionDisabled, actionSaving }) {
  return (
    <div style={{ display:'flex', alignItems:'center', padding:'8px 12px 10px', flexShrink:0, borderBottom:`1px solid ${N.borderSubtle}` }}>
      <button style={{ background:'transparent', border:'none', cursor:'pointer', color:N.fg2, fontSize:13.5, fontWeight:600, padding:0, minWidth:50, textAlign:'left' }}>{cancel}</button>
      <div style={{ flex:1, textAlign:'center', fontSize:14.5, fontWeight:700, color:N.fg1, letterSpacing:-0.2 }}>{title}</div>
      <div style={{ minWidth:50, textAlign:'right' }}>
        {action && (actionSaving
          ? <span style={{ display:'inline-flex', alignItems:'center', gap:5, color:N.fg4, fontSize:13.5, fontWeight:700 }}><i data-lucide="loader-circle" style={{ width:14, height:14, animation:'sh-spin 0.8s linear infinite' }}/></span>
          : <button style={{ background:'transparent', border:'none', cursor:actionDisabled?'default':'pointer', color:actionDisabled?N.fg4:H.accent700, fontSize:13.5, fontWeight:700, padding:0 }}>{action}</button>)}
      </div>
    </div>
  );
}

function SheetBody({ children, pad='12px 14px 84px', gap=12 }) {
  return <div style={{ flex:1, overflow:'auto', padding:pad, display:'flex', flexDirection:'column', gap }}>{children}</div>;
}

// Member select row (avatar + name + trailing control).
function MemberSelectRow({ m, sub, trailing, last, dim }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:11, padding:'10px 2px', borderBottom: last?'none':`1px solid ${N.border}`, opacity:dim?0.5:1 }}>
      <Avatar m={m} size={32}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600, color:N.fg1, letterSpacing:-0.1 }}>{m.full || m.name}</div>
        {sub && <div style={{ fontSize:10.5, color:N.fg3, marginTop:1 }}>{sub}</div>}
      </div>
      {trailing}
    </div>
  );
}

function Check({ on, accent=H.accent }) {
  return (
    <div style={{ width:20, height:20, borderRadius:'50%', flexShrink:0, border:`1.5px solid ${on?accent:N.borderStrong}`, background:on?accent:'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
      {on && <i data-lucide="check" style={{ width:12, height:12, color:'#fff', strokeWidth:3 }}/>}
    </div>
  );
}

// Detail grid row (label over value).
function DetailRow({ icon, label, value, last }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:11, padding:'10px 2px', borderBottom: last?'none':`1px solid ${N.border}` }}>
      <div style={{ width:30, height:30, borderRadius:8, flexShrink:0, background:N.sunken, color:N.fg2, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide={icon} style={{ width:15, height:15 }}/></div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:N.fg4 }}>{label}</div>
        <div style={{ fontSize:13, fontWeight:600, color:N.fg1, marginTop:2, letterSpacing:-0.1 }}>{value}</div>
      </div>
    </div>
  );
}

// ─── Form primitives (shared across form sheets) ──────────────
function Field({ label, value, placeholder, error, helper, mono, multiline }) {
  return (
    <div>
      {label && <div style={{ fontSize:11, fontWeight:600, color:N.fg2, marginBottom:5, letterSpacing:-0.05 }}>{label}</div>}
      <div style={{ background:N.surface, border:`1.5px solid ${error?N.error:N.border}`, borderRadius:8, padding: multiline?'9px 11px':'10px 11px', minHeight: multiline?52:undefined, boxShadow: error?`0 0 0 3px ${N.errorBg}`:'0 1px 2px rgba(0,0,0,0.03)' }}>
        <span style={{ fontSize:13, color: value?N.fg1:N.fg4, fontWeight: value?500:400, letterSpacing:-0.1, lineHeight:'18px', fontFamily: mono?'ui-monospace, SFMono-Regular, Menlo, monospace':undefined }}>{value || placeholder}</span>
      </div>
      {helper && <div style={{ marginTop:6, fontSize:10.5, color:error?N.error:N.fg3, lineHeight:'14px', display:'flex', alignItems:'flex-start', gap:4 }}>{error && <i data-lucide="circle-alert" style={{ width:11, height:11, flexShrink:0, marginTop:1 }}/>}{helper}</div>}
    </div>
  );
}

// Category chip (selected = home-green-bg + green text + dot).
function CatPick({ cat, on }) {
  const c = CAT[cat];
  return (
    <button style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 12px', borderRadius:9999, border:`1px solid ${on?'transparent':N.border}`, background:on?H.bg100:N.surface, color:on?H.accent700:N.fg2, fontSize:12, fontWeight:on?700:600, cursor:'pointer' }}>
      <span style={{ width:8, height:8, borderRadius:'50%', background:c.c }}/>{c.label}
    </button>
  );
}

// Compact stepper.
function Stepper({ value, unit, error, disabled }) {
  return (
    <div style={{ display:'inline-flex', alignItems:'center', border:`1.5px solid ${error?N.error:N.border}`, borderRadius:8, overflow:'hidden', background:disabled?N.raised:N.surface, opacity:disabled?0.6:1 }}>
      <button style={{ width:30, height:34, border:'none', background:'transparent', cursor:'pointer', color:N.fg2, display:'flex', alignItems:'center', justifyContent:'center', borderRight:`1px solid ${N.border}` }}><i data-lucide="minus" style={{ width:14, height:14 }}/></button>
      <div style={{ minWidth:44, padding:'0 8px', height:34, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:N.fg1, fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap' }}>{value}{unit && <span style={{ color:N.fg3, fontWeight:600, marginLeft:3, fontSize:11 }}>{unit}</span>}</div>
      <button style={{ width:30, height:34, border:'none', background:'transparent', cursor:'pointer', color:H.accent, display:'flex', alignItems:'center', justifyContent:'center', borderLeft:`1px solid ${N.border}` }}><i data-lucide="plus" style={{ width:14, height:14 }}/></button>
    </div>
  );
}

// Inline value row (label left, value/control right).
function ValueRow({ label, children, last, error }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'10px 2px', borderBottom: last?'none':`1px solid ${N.border}` }}>
      <span style={{ fontSize:12.5, fontWeight:600, color:error?N.error:N.fg2 }}>{label}</span>
      {children}
    </div>
  );
}

// Reminder / multi-select chip (toggle-like).
function MultiChip({ label, on }) {
  return (
    <button style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'7px 12px', borderRadius:9999, border:`1px solid ${on?'transparent':N.border}`, background:on?H.bg100:N.surface, color:on?H.accent700:N.fg2, fontSize:12, fontWeight:on?700:600, cursor:'pointer' }}>
      {on && <i data-lucide="check" style={{ width:12, height:12, strokeWidth:3 }}/>}{label}
    </button>
  );
}

Object.assign(window, {
  N, H, CAT, M, SH,
  StatusBar, Phone, TopBar, Body, Banner, Card, Overline,
  Avatar, AvatarStack, CatChip, Chip, Segmented, Toggle,
  PrimaryBtn, SecondaryBtn, TextBtn, StickyFooter, FAB, TabBar,
  MonthStrip, DaySection, EventRow, AvailDots, Shimmer, EmptyState,
  Dialog, Sheet, SheetBar, SheetBody, MemberSelectRow, Check, DetailRow,
  Field, CatPick, Stepper, ValueRow, MultiChip,
});
