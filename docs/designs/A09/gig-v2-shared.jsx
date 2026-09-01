// Pantopus — A09 Transactional Detail · shared chrome
// Used by both A09.1 frames (populated + no-bids state)

const TX = {
  primary600:'#0284c7', primary50:'#f0f9ff', primary100:'#e0f2fe', primary700:'#0369a1',
  fg1:'#111827', fg2:'#374151', fg3:'#6b7280', fg4:'#9ca3af',
  surface:'#ffffff', sunken:'#f3f4f6', muted:'#f8fafc',
  border:'#e5e7eb', borderSub:'#f3f4f6',
  business:'#7C3AED', businessBg:'#F3E8FF',
  handyman:'#EA580C', handymanBg:'#FED7AA',
  success:'#16A34A', successBg:'#DCFCE7',
  amber:'#B45309', amberBg:'#FEF3C7',
  verified:'#0284c7',
};

function SB({ color = TX.fg1 }) {
  return (
    <div style={{
      display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'16px 28px 0', height:44, boxSizing:'border-box',
      fontFamily:'-apple-system, system-ui', fontWeight:600, fontSize:15, color,
      flexShrink:0, position:'relative', zIndex:5,
    }}>
      <span>9:41</span>
      <div style={{display:'flex', gap:5, alignItems:'center'}}>
        <svg width="17" height="11" viewBox="0 0 17 11">
          <rect x="0" y="7" width="3" height="4" rx="0.6" fill={color}/>
          <rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={color}/>
          <rect x="9" y="2" width="3" height="9" rx="0.6" fill={color}/>
          <rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={color}/>
        </svg>
        <svg width="15" height="11" viewBox="0 0 15 11">
          <path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={color}/>
          <path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={color}/>
          <circle cx="7.5" cy="9" r="1.3" fill={color}/>
        </svg>
        <svg width="24" height="11" viewBox="0 0 24 11">
          <rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={color} strokeOpacity="0.45" fill="none"/>
          <rect x="2" y="2" width="17" height="7" rx="1.5" fill={color}/>
        </svg>
      </div>
    </div>
  );
}

function Phone({ children, bg = TX.surface }) {
  return (
    <div style={{
      width:360, height:740, borderRadius:46, padding:10, background:'#0b0f17',
      boxShadow:'0 40px 80px rgba(17,24,39,0.22), 0 0 0 1px rgba(0,0,0,0.14)',
    }}>
      <div style={{
        width:'100%', height:'100%', background:bg,
        borderRadius:36, overflow:'hidden', position:'relative',
        display:'flex', flexDirection:'column',
        fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          position:'absolute', top:9, left:'50%', transform:'translateX(-50%)',
          width:108, height:30, borderRadius:20, background:'#000', zIndex:50,
        }}/>
        <SB color={TX.fg1}/>
        {children}
        <div style={{
          position:'absolute', bottom:6, left:'50%', transform:'translateX(-50%)',
          width:120, height:4, borderRadius:4,
          background:'rgba(0,0,0,0.35)', zIndex:60,
        }}/>
      </div>
    </div>
  );
}

function TopNav({ title, trailing }) {
  return (
    <div style={{
      padding:'8px 12px', boxSizing:'border-box',
      display:'grid', gridTemplateColumns:'36px 1fr auto', alignItems:'center',
      background:TX.surface, flexShrink:0, position:'relative', zIndex:1,
    }}>
      <button style={{
        width:36, height:36, borderRadius:'50%',
        background:'transparent', border:'none', cursor:'pointer', color:TX.fg1,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <i data-lucide="chevron-left" style={{width:20, height:20, strokeWidth:2.2}}/>
      </button>
      <div style={{
        fontSize:15, fontWeight:600, color:TX.fg1, letterSpacing:-0.1,
        textAlign:'center',
      }}>{title}</div>
      <div style={{minWidth:36, display:'flex', justifyContent:'flex-end'}}>{trailing}</div>
    </div>
  );
}

function Pill({ children, bg, color, icon = null }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5,
      padding:'4px 10px', borderRadius:9999,
      background:bg, color,
      fontSize:11, fontWeight:700, letterSpacing:0.02,
    }}>
      {icon && <i data-lucide={icon} style={{width:11, height:11, strokeWidth:2.4}}/>}
      {children}
    </span>
  );
}

function Avatar({ initials, color = '#94a3b8', verified = false, size = 36 }) {
  return (
    <div style={{position:'relative', width:size, height:size, flexShrink:0}}>
      <div style={{
        width:size, height:size, borderRadius:'50%', background:color,
        display:'flex', alignItems:'center', justifyContent:'center',
        color:'#fff', fontWeight:700, fontSize: size === 44 ? 14 : 12, letterSpacing:-0.2,
      }}>{initials}</div>
      {verified && (
        <div style={{
          position:'absolute', bottom:-1, right:-1,
          width: size === 44 ? 15 : 13, height: size === 44 ? 15 : 13, borderRadius:'50%',
          background:TX.verified, border:'2px solid #fff',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <svg width="7" height="7" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
    </div>
  );
}

function SectionCard({ title, icon, children, sub = null }) {
  return (
    <div style={{padding:'0 20px'}}>
      <div style={{
        display:'flex', alignItems:'center', gap:6,
        marginBottom:8,
      }}>
        {icon && <i data-lucide={icon} style={{width:13, height:13, color:TX.fg3, strokeWidth:2}}/>}
        <span style={{
          fontSize:10, fontWeight:700, letterSpacing:0.12,
          textTransform:'uppercase', color:TX.fg3,
        }}>{title}</span>
        {sub && (
          <span style={{
            fontSize:10, color:TX.fg4, fontWeight:500, letterSpacing:0,
          }}>· {sub}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function StatStrip({ cells }) {
  return (
    <div style={{padding:'18px 20px 0'}}>
      <div style={{
        display:'flex', alignItems:'stretch',
        background:TX.sunken, borderRadius:12, padding:10,
      }}>
        {cells.map((s, i, arr) => (
          <React.Fragment key={i}>
            <div style={{flex:1, textAlign:'center'}}>
              <div style={{fontSize:13.5, fontWeight:700, color:TX.fg1, letterSpacing:-0.1}}>{s.top}</div>
              <div style={{fontSize:10, color:TX.fg3, fontWeight:500, marginTop:2}}>{s.bot}</div>
            </div>
            {i < arr.length - 1 && (
              <div style={{width:1, background:'rgba(17,24,39,0.10)', margin:'2px 0'}}/>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function DockSplit({ primaryLabel, ghostLabel = 'Message' }) {
  return (
    <div style={{
      position:'absolute', bottom:0, left:0, right:0, zIndex:10,
      padding:'12px 16px 24px', boxSizing:'border-box',
      background:'rgba(255,255,255,0.97)', backdropFilter:'blur(12px)',
      borderTop:`1px solid ${TX.border}`,
      display:'flex', gap:10,
    }}>
      <button style={{
        flex:'0 0 auto', height:48, padding:'0 18px', borderRadius:12,
        background:TX.surface, border:`1px solid ${TX.border}`,
        color:TX.fg1, fontSize:14, fontWeight:700, cursor:'pointer',
        display:'inline-flex', alignItems:'center', gap:6,
      }}>
        <i data-lucide="message-circle" style={{width:15, height:15, strokeWidth:2.2}}/>
        {ghostLabel}
      </button>
      <button style={{
        flex:1, height:48, borderRadius:12, border:'none',
        background:TX.primary600, color:'#fff', cursor:'pointer',
        fontSize:14.5, fontWeight:700, letterSpacing:-0.1,
        boxShadow:'0 8px 16px rgba(2,132,199,0.30)',
      }}>
        {primaryLabel}
      </button>
    </div>
  );
}

Object.assign(window, { TX, Phone, TopNav, Pill, Avatar, SectionCard, StatStrip, DockSplit });
