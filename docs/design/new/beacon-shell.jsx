// Pantopus · Beacon-family shared shell
// Lifted verbatim from A03.2 beacons-frames.jsx so the Following screen
// (§1A①) is a pixel-true sibling: same phone bezel, status bar, avatar,
// and palette. Adds a centered-title nav bar + segmented sort control for
// the List-of-Rows archetype (sub-route chrome, no tab bar).

const BU = {
  primary600:'#0284c7', primary50:'#f0f9ff', primary100:'#e0f2fe', primary700:'#0369a1',
  fg1:'#111827', fg2:'#374151', fg3:'#6b7280', fg4:'#9ca3af',
  surface:'#ffffff', sunken:'#f3f4f6', muted:'#f8fafc',
  border:'#e5e7eb', borderStrong:'#d1d5db', borderSub:'#f3f4f6',
  success:'#059669', successBg:'#D1FAE5',
  amber:'#B45309', amberBg:'#FEF3C7',
  violet:'#6D28D9', violetBg:'#EDE9FE',
  rose:'#BE123C', roseBg:'#FFE4E6',
  slate:'#475569', slateBg:'#E2E8F0',
  business:'#7C3AED', businessBg:'#EDE9FE',
  error:'#DC2626', errorBg:'#FEF2F2',
};

// ── Status bar (9:41 + signal/wifi/battery) ──────────────────────
function BSB({ color = BU.fg1 }) {
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

// ── Phone bezel ──────────────────────────────────────────────────
function BPhone({ children }) {
  return (
    <div style={{
      width:360, height:740, borderRadius:46, padding:10, background:'#0b0f17',
      boxShadow:'0 40px 80px rgba(17,24,39,0.22), 0 0 0 1px rgba(0,0,0,0.14)',
    }}>
      <div style={{
        width:'100%', height:'100%', background:BU.muted,
        borderRadius:36, overflow:'hidden', position:'relative',
        display:'flex', flexDirection:'column',
        fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          position:'absolute', top:9, left:'50%', transform:'translateX(-50%)',
          width:108, height:30, borderRadius:20, background:'#000', zIndex:50,
        }}/>
        <BSB color={BU.fg1}/>
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

// ── Avatar with verified check ───────────────────────────────────
function BAvatar({ letter, color = '#a78bfa', verified = false, size = 32, dim = false }) {
  return (
    <div style={{position:'relative', width:size, height:size, flexShrink:0, opacity: dim ? 0.7 : 1}}>
      <div style={{
        width:size, height:size, borderRadius:'50%', background:color,
        color:'#fff', fontFamily:'ui-sans-serif, system-ui',
        fontWeight:600, fontSize: size >= 44 ? 16 : size === 32 ? 13 : 11,
        display:'flex', alignItems:'center', justifyContent:'center',
        letterSpacing:-0.3,
      }}>{letter}</div>
      {verified && (
        <span style={{
          position:'absolute', right:-1, bottom:-1,
          width: size >= 44 ? 16 : 13, height: size >= 44 ? 16 : 13, borderRadius:'50%',
          background:BU.primary600, color:'#fff',
          display:'flex', alignItems:'center', justifyContent:'center',
          border:'2px solid #fff',
        }}>
          <i data-lucide="check" style={{width: size >= 44 ? 8 : 7, height: size >= 44 ? 8 : 7, strokeWidth:4}}/>
        </span>
      )}
    </div>
  );
}

// ── Nav bar: back chevron (left) + centered title + count line ───
function BNavBar({ title, count }) {
  return (
    <div style={{
      position:'relative', height:54, flexShrink:0,
      background:BU.muted, borderBottom:`1px solid ${BU.border}`,
      display:'flex', alignItems:'center', justifyContent:'center',
    }}>
      <button aria-label="Back" style={{
        position:'absolute', left:6, top:'50%', transform:'translateY(-50%)',
        width:40, height:40, borderRadius:'50%', background:'transparent',
        border:'none', cursor:'pointer', color:BU.fg1,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <i data-lucide="chevron-left" style={{width:25, height:25, strokeWidth:2.2}}/>
      </button>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:17, fontWeight:700, color:BU.fg1, letterSpacing:-0.3, lineHeight:1.15}}>{title}</div>
        {count && (
          <div style={{fontSize:11.5, color:BU.fg3, marginTop:1, letterSpacing:-0.02}}>{count}</div>
        )}
      </div>
    </div>
  );
}

// ── Segmented sort control (Activity · Recent · A–Z · Unread) ─────
function BSortControl({ options, activeKey }) {
  return (
    <div style={{
      flexShrink:0, background:BU.muted, padding:'10px 16px 12px',
      borderBottom:`1px solid ${BU.border}`,
    }}>
      <div style={{
        display:'flex', background:BU.sunken, borderRadius:10, padding:3, gap:2,
      }}>
        {options.map((o) => {
          const active = o.key === activeKey;
          return (
            <div key={o.key} style={{
              flex:1, textAlign:'center', padding:'6px 4px', borderRadius:8,
              fontSize:12.5, fontWeight:600, letterSpacing:-0.1,
              color: active ? BU.fg1 : BU.fg3,
              background: active ? BU.surface : 'transparent',
              boxShadow: active ? '0 1px 2px rgba(0,0,0,0.10), 0 1px 1px rgba(0,0,0,0.04)' : 'none',
              whiteSpace:'nowrap',
            }}>{o.label}</div>
          );
        })}
      </div>
    </div>
  );
}

// ── Overline section header (NEW UPDATES / ACTIVE / QUIET) ────────
function BSectionHeader({ label, count, tint }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:8,
      padding:'18px 18px 8px',
    }}>
      <span style={{
        fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase',
        color: tint || BU.fg4,
      }}>{label}</span>
      {count != null && (
        <>
          <span style={{fontSize:11, fontWeight:700, color:BU.fg4}}>&middot;</span>
          <span style={{
            fontSize:11, fontWeight:700, color:BU.fg4, letterSpacing:0.02,
          }}>{count}</span>
        </>
      )}
      <div style={{flex:1, height:1, background:BU.borderSub}}/>
    </div>
  );
}

Object.assign(window, { BU, BSB, BPhone, BAvatar, BNavBar, BSortControl, BSectionHeader });
