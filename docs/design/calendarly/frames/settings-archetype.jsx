// Pantopus — A14 Settings list archetype primitives
// Shared across all settings-archetype screen mocks.
// Components expose to window so child JSX files can use them as globals.

const S = {
  primary600:'#0284c7', primary50:'#f0f9ff', primary100:'#e0f2fe', primary700:'#0369a1',
  fg1:'#111827', fg2:'#374151', fg3:'#6b7280', fg4:'#9ca3af',
  surface:'#ffffff', sunken:'#f3f4f6', muted:'#f8fafc',
  border:'#e5e7eb', borderStrong:'#d1d5db', borderSub:'#f3f4f6',
  success:'#059669', successBg:'#D1FAE5',
  warning:'#B45309', warningBg:'#FEF3C7',
  identityHome:'#15803D', identityHomeBg:'#DCFCE7',
  identityPersonal:'#0369A1', identityPersonalBg:'#E0F2FE',
  identityBusiness:'#6D28D9', identityBusinessBg:'#EDE9FE',
  error:'#DC2626',
};

function SB({ color = S.fg1 }) {
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

function Phone({ children }) {
  return (
    <div style={{
      width:360, height:740, borderRadius:46, padding:10, background:'#0b0f17',
      boxShadow:'0 40px 80px rgba(17,24,39,0.22), 0 0 0 1px rgba(0,0,0,0.14)',
    }}>
      <div style={{
        width:'100%', height:'100%', background:S.muted,
        borderRadius:36, overflow:'hidden', position:'relative',
        display:'flex', flexDirection:'column',
        fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          position:'absolute', top:9, left:'50%', transform:'translateX(-50%)',
          width:108, height:30, borderRadius:20, background:'#000', zIndex:50,
        }}/>
        <SB color={S.fg1}/>
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

function TopBar({ title, back = true, trailing = null }) {
  return (
    <div style={{
      height:52, padding:'0 12px', boxSizing:'border-box',
      display:'flex', alignItems:'center', justifyContent:'space-between',
      background:S.muted, borderBottom:`1px solid ${S.border}`,
      flexShrink:0,
    }}>
      <button style={{
        width:36, height:36, borderRadius:'50%', background:'transparent',
        border:'none', cursor:'pointer', color:S.fg1,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <i data-lucide={back ? 'chevron-left' : 'menu'} style={{width:22, height:22, strokeWidth:2}}/>
      </button>
      <div style={{
        fontSize:16, fontWeight:600, color:S.fg1, letterSpacing:-0.1,
      }}>{title}</div>
      <span style={{minWidth:36, height:36, display:'inline-flex', alignItems:'center', justifyContent:'flex-end'}}>
        {trailing}
      </span>
    </div>
  );
}

function Overline({ children }) {
  return (
    <div style={{
      padding:'18px 16px 8px', fontSize:11, fontWeight:700, color:S.fg3,
      letterSpacing:'0.08em', textTransform:'uppercase',
    }}>{children}</div>
  );
}

function Card({ children, helper }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <div style={{padding:'0 12px'}}>
      <div style={{
        background:S.surface, border:`1px solid ${S.border}`,
        borderRadius:12, overflow:'hidden',
      }}>
        {items.map((c, i) => (
          <React.Fragment key={i}>
            {c}
            {i < items.length - 1 && (
              <div style={{height:1, background:S.borderSub, marginLeft:16}}/>
            )}
          </React.Fragment>
        ))}
      </div>
      {helper && (
        <div style={{
          padding:'8px 4px 0', fontSize:11.5, color:S.fg3, lineHeight:'16px',
        }}>{helper}</div>
      )}
    </div>
  );
}

function Row({ label, sub, right, leading, destructive, padY = 14 }) {
  return (
    <div style={{
      minHeight:48, padding:`${padY}px 16px`, display:'flex',
      alignItems:'center', gap:12, cursor:'pointer', boxSizing:'border-box',
    }}>
      {leading && (
        <div style={{flexShrink:0, display:'flex', alignItems:'center'}}>{leading}</div>
      )}
      <div style={{flex:1, minWidth:0}}>
        <div style={{
          fontSize:15, fontWeight:500, lineHeight:'20px',
          color: destructive ? S.error : S.fg1, letterSpacing:-0.1,
        }}>{label}</div>
        {sub && (
          <div style={{fontSize:12, color:S.fg3, marginTop:2, lineHeight:'16px'}}>{sub}</div>
        )}
      </div>
      {right}
    </div>
  );
}

// Round avatar with initials — used by people-listing rows.
function Avatar({ name, size = 36, palette }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  // Stable color from name
  const colors = [
    { bg:'#E0F2FE', fg:'#0369A1' },
    { bg:'#DCFCE7', fg:'#15803D' },
    { bg:'#EDE9FE', fg:'#6D28D9' },
    { bg:'#FEF3C7', fg:'#B45309' },
    { bg:'#FCE7F3', fg:'#BE185D' },
    { bg:'#FEE2E2', fg:'#B91C1C' },
  ];
  const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  const p = palette || colors[hash % colors.length];
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%', background:p.bg,
      color:p.fg, display:'flex', alignItems:'center', justifyContent:'center',
      fontSize: size * 0.36, fontWeight:700, letterSpacing:0.02,
      flexShrink:0,
    }}>{initials}</div>
  );
}

// Small pill button — neutral / outline. Used inline in rows.
function PillButton({ children, tone = 'neutral', onClick }) {
  const palette = {
    neutral: { bg:'#fff', border:'#d1d5db', fg:'#374151' },
    primary: { bg:S.primary600, border:S.primary600, fg:'#fff' },
    danger:  { bg:'#fff', border:'#FECACA', fg:S.error },
  }[tone];
  return (
    <button onClick={onClick} style={{
      padding:'6px 14px', borderRadius:9999,
      border:`1px solid ${palette.border}`, background:palette.bg,
      fontSize:13, fontWeight:600, color:palette.fg,
      cursor:'pointer', whiteSpace:'nowrap',
      fontFamily:'inherit',
    }}>{children}</button>
  );
}

// Centered empty-state hero — icon, headline, body. Sits inside the
// scroll area below the TopBar; no card chrome.
function EmptyState({ icon = 'inbox', title, body, action }) {
  return (
    <div style={{
      flex:1, display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      padding:'40px 32px 80px', textAlign:'center', gap:14,
    }}>
      <div style={{
        width:64, height:64, borderRadius:'50%', background:S.sunken,
        display:'flex', alignItems:'center', justifyContent:'center',
        color:S.fg3, marginBottom:4,
      }}>
        <i data-lucide={icon} style={{width:28, height:28, strokeWidth:1.75}}/>
      </div>
      <div style={{
        fontSize:18, fontWeight:600, color:S.fg1, letterSpacing:-0.2,
      }}>{title}</div>
      {body && (
        <div style={{
          fontSize:13.5, color:S.fg3, lineHeight:'20px', maxWidth:260,
        }}>{body}</div>
      )}
      {action && <div style={{marginTop:8}}>{action}</div>}
    </div>
  );
}

function Chevron() {
  return <i data-lucide="chevron-right" style={{width:16, height:16, color:S.fg3, strokeWidth:2.2}}/>;
}

function Chip({ tone = 'success', children, icon }) {
  const palette = {
    success: { bg:S.successBg, fg:S.success },
    warning: { bg:S.warningBg, fg:S.warning },
    primary: { bg:S.primary50, fg:S.primary700 },
    home: { bg:S.identityHomeBg, fg:S.identityHome },
    personal: { bg:S.identityPersonalBg, fg:S.identityPersonal },
    business: { bg:S.identityBusinessBg, fg:S.identityBusiness },
    neutral: { bg:'#f3f4f6', fg:'#374151' },
  }[tone];
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      padding:'3px 8px', borderRadius:9999,
      background:palette.bg, color:palette.fg,
      fontSize:10.5, fontWeight:700, letterSpacing:0.04,
      textTransform:'uppercase', whiteSpace:'nowrap',
    }}>
      {icon && <i data-lucide={icon} style={{width:10, height:10, strokeWidth:3}}/>}
      {children}
    </span>
  );
}

function Toggle({ on }) {
  return (
    <span style={{
      width:51, height:31, borderRadius:9999, flexShrink:0,
      background: on ? S.primary600 : '#e5e7eb',
      position:'relative', transition:'background 120ms',
      boxShadow: on ? 'inset 0 0 0 0.5px rgba(0,0,0,0.04)' : 'inset 0 0 0 0.5px rgba(0,0,0,0.06)',
    }}>
      <span style={{
        position:'absolute', top:2, left: on ? 22 : 2, width:27, height:27,
        borderRadius:'50%', background:'#fff',
        boxShadow:'0 2px 4px rgba(0,0,0,0.18), 0 0 0 0.5px rgba(0,0,0,0.04)',
        transition:'left 120ms',
      }}/>
    </span>
  );
}

function Radio({ selected }) {
  return (
    <span style={{
      width:22, height:22, borderRadius:'50%',
      border: selected ? `1.5px solid ${S.primary600}` : `1.5px solid ${S.borderStrong}`,
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      flexShrink:0,
    }}>
      {selected && <span style={{width:11, height:11, borderRadius:'50%', background:S.primary600}}/>}
    </span>
  );
}

// Convenience composite for chevron rows that also carry a status chip
function ChipChevron({ children }) {
  return (
    <div style={{display:'flex', alignItems:'center', gap:8}}>
      {children}
      <Chevron/>
    </div>
  );
}

// Mono footer line — used at the bottom of settings index screens
function MonoFooter({ children }) {
  return (
    <div style={{
      padding:'18px 16px 4px', fontSize:11, color:S.fg4, textAlign:'center',
      fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace',
    }}>{children}</div>
  );
}

Object.assign(window, {
  S, SB, Phone, TopBar, Overline, Card, Row, Chevron, Chip, ChipChevron,
  Toggle, Radio, MonoFooter, Avatar, PillButton, EmptyState,
});
