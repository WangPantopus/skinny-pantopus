// A18.5 — View as (identity preview · viewer picker + live render)
// Two frames: Connection viewer (rich) + Public viewer (heavily redacted)

const VA = {
  p600:'#0284c7', p50:'#f0f9ff', p100:'#e0f2fe', p200:'#bae6fd', p700:'#0369a1', p400:'#38bdf8',
  fg1:'#111827', fg2:'#374151', fg3:'#6b7280', fg4:'#9ca3af',
  surface:'#ffffff', sunken:'#f3f4f6', muted:'#f8fafc', raised:'#f9fafb', appbg:'#f6f7f9',
  border:'#e5e7eb', borderSub:'#f3f4f6', borderStrong:'#d1d5db',
  success:'#059669', successBg:'#F0FDF4', successLight:'#D1FAE5',
  home:'#16A34A', homeBg:'#DCFCE7',
  business:'#7C3AED', businessBg:'#F3E8FF',
  personal:'#0284C7', personalBg:'#DBEAFE',
  warning:'#D97706', warningBg:'#FFFBEB', warningLight:'#FDE68A',
};

function SBVA({ color = VA.fg1 }) {
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

function PhoneVA({ children }) {
  return (
    <div style={{
      width:360, height:740, borderRadius:46, padding:10, background:'#0b0f17',
      boxShadow:'0 40px 80px rgba(17,24,39,0.22), 0 0 0 1px rgba(0,0,0,0.14)',
    }}>
      <div style={{
        width:'100%', height:'100%', background:VA.appbg,
        borderRadius:36, overflow:'hidden', position:'relative',
        display:'flex', flexDirection:'column',
        fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          position:'absolute', top:9, left:'50%', transform:'translateX(-50%)',
          width:108, height:30, borderRadius:20, background:'#000', zIndex:50,
        }}/>
        <SBVA color={VA.fg1}/>
        {children}
        <div style={{
          position:'absolute', bottom:6, left:'50%', transform:'translateX(-50%)',
          width:120, height:4, borderRadius:4, background:'rgba(0,0,0,0.35)', zIndex:60,
        }}/>
      </div>
    </div>
  );
}

function TopBarVA({ title }) {
  return (
    <div style={{
      padding:'6px 10px', boxSizing:'border-box', height:52,
      display:'flex', alignItems:'center', justifyContent:'space-between',
      background:VA.surface, flexShrink:0, position:'relative',
      borderBottom:`1px solid ${VA.borderSub}`, zIndex:4,
    }}>
      <button style={{
        width:36, height:36, borderRadius:'50%', background:'transparent',
        border:'none', cursor:'pointer', color:VA.fg1,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <i data-lucide="chevron-left" style={{width:20, height:20, strokeWidth:2.2}}/>
      </button>
      <span style={{
        fontSize:15, fontWeight:700, color:VA.fg1, letterSpacing:-0.15,
        position:'absolute', left:'50%', transform:'translateX(-50%)',
      }}>{title}</span>
      <button style={{
        height:30, padding:'0 12px', borderRadius:9999, background:VA.sunken,
        border:'none', cursor:'pointer', color:VA.fg2, fontSize:12.5, fontWeight:600,
        display:'flex', alignItems:'center', gap:4,
      }}>
        <i data-lucide="settings-2" style={{width:13, height:13, strokeWidth:2.2}}/>
        Edit
      </button>
    </div>
  );
}

// Viewer-context picker chip row (horizontal scroll)
const VIEWERS = [
  { id:'public',     label:'Public',           icon:'globe' },
  { id:'persona',    label:'Persona audience',  icon:'megaphone' },
  { id:'neighbor',   label:'Neighbor',          icon:'map-pin' },
  { id:'connection', label:'Connection',        icon:'user-check' },
  { id:'household',  label:'Household',         icon:'home' },
  { id:'gig',        label:'Gig participant',    icon:'briefcase' },
];

function ChipRowVA({ active }) {
  return (
    <div style={{
      flexShrink:0, background:VA.surface, borderBottom:`1px solid ${VA.border}`,
      padding:'12px 0 13px',
    }}>
      <div style={{
        padding:'0 14px 8px', display:'flex', alignItems:'center', gap:6,
      }}>
        <i data-lucide="eye" style={{width:13, height:13, strokeWidth:2.2, color:VA.fg3}}/>
        <span style={{
          fontSize:10.5, fontWeight:700, color:VA.fg4, letterSpacing:0.06,
          textTransform:'uppercase',
        }}>Preview your profile as</span>
      </div>
      <div style={{
        display:'flex', gap:8, overflowX:'auto', padding:'0 14px',
        scrollbarWidth:'none',
      }}>
        {VIEWERS.map((v) => {
          const on = v.id === active;
          return (
            <div key={v.id} style={{
              flexShrink:0, height:34, padding:'0 13px', borderRadius:9999,
              display:'inline-flex', alignItems:'center', gap:6,
              background: on ? VA.p600 : VA.surface,
              border:`1.5px solid ${on ? VA.p600 : VA.border}`,
              color: on ? '#fff' : VA.fg2,
              fontSize:12.5, fontWeight:600, letterSpacing:-0.05,
              cursor:'pointer', whiteSpace:'nowrap',
              boxShadow: on ? '0 4px 10px rgba(2,132,199,0.22)' : 'none',
            }}>
              <i data-lucide={v.icon} style={{width:13, height:13, strokeWidth:2.3}}/>
              {v.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// "What X sees" banner above the live render
function PreviewBannerVA({ icon, viewerLabel, tone = 'info' }) {
  const c = tone === 'restricted'
    ? { bg:VA.warningBg, border:VA.warningLight, fg:'#92400E', dot:VA.warning }
    : { bg:VA.p50, border:VA.p100, fg:VA.p700, dot:VA.p600 };
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:9,
      padding:'9px 13px', background:c.bg, borderBottom:`1px solid ${c.border}`,
    }}>
      <div style={{
        width:26, height:26, borderRadius:'50%', background:VA.surface,
        border:`1px solid ${c.border}`, color:c.dot,
        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
      }}>
        <i data-lucide={icon} style={{width:14, height:14, strokeWidth:2.2}}/>
      </div>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize:12.5, fontWeight:700, color:c.fg, letterSpacing:-0.05}}>
          Viewing as {viewerLabel}
        </div>
        <div style={{fontSize:10.5, color:c.fg, opacity:0.8, fontWeight:500}}>
          {tone === 'restricted' ? 'Most details are hidden' : 'This is what they see'}
        </div>
      </div>
      <span style={{
        fontSize:9.5, fontWeight:700, color:c.fg, padding:'3px 8px',
        background:VA.surface, borderRadius:9999, border:`1px solid ${c.border}`,
        letterSpacing:0.03, textTransform:'uppercase',
      }}>Live</span>
    </div>
  );
}

// Identity badge pill (verification)
function VBadge({ icon, label, on = true }) {
  return (
    <div style={{
      display:'inline-flex', alignItems:'center', gap:5,
      height:26, padding:'0 10px', borderRadius:9999,
      background: on ? VA.successBg : VA.sunken,
      border:`1px solid ${on ? VA.successLight : VA.border}`,
      color: on ? '#047857' : VA.fg4,
      fontSize:11, fontWeight:600, letterSpacing:-0.02,
    }}>
      <i data-lucide={on ? icon : 'lock'} style={{width:12, height:12, strokeWidth:2.3}}/>
      {label}
    </div>
  );
}

// A field row in the preview render — visible or redacted
function FieldVA({ icon, label, value, hidden = false, partial = false }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:11,
      padding:'11px 0', borderBottom:`1px solid ${VA.borderSub}`,
    }}>
      <div style={{
        width:30, height:30, borderRadius:8, flexShrink:0,
        background: hidden ? VA.sunken : VA.p50,
        color: hidden ? VA.fg4 : VA.p600,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <i data-lucide={hidden ? 'lock' : icon} style={{width:14, height:14, strokeWidth:2.2}}/>
      </div>
      <div style={{flex:1, minWidth:0}}>
        <div style={{
          fontSize:10.5, fontWeight:700, color:VA.fg4, letterSpacing:0.04,
          textTransform:'uppercase', marginBottom:2,
        }}>{label}</div>
        {hidden ? (
          <div style={{display:'flex', alignItems:'center', gap:7}}>
            <div style={{
              height:9, width:partial ? 64 : 104, borderRadius:3,
              background:`repeating-linear-gradient(90deg, ${VA.borderStrong} 0 7px, ${VA.sunken} 7px 12px)`,
              opacity:0.55,
            }}/>
            <span style={{fontSize:11, color:VA.fg4, fontWeight:600, fontStyle:'italic'}}>
              Hidden
            </span>
          </div>
        ) : (
          <div style={{
            fontSize:13.5, fontWeight:600, color:VA.fg1, letterSpacing:-0.05,
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
          }}>{value}</div>
        )}
      </div>
      {!hidden && (
        <i data-lucide="eye" style={{width:14, height:14, strokeWidth:2, color:VA.p400, flexShrink:0}}/>
      )}
    </div>
  );
}

// The live profile render container (screen-within-screen)
function PreviewRenderVA({ children, tone }) {
  return (
    <div style={{
      margin:'14px', borderRadius:18, background:VA.surface,
      border:`1.5px solid ${tone === 'restricted' ? VA.warningLight : VA.p200}`,
      boxShadow:'0 6px 20px rgba(17,24,39,0.08)', overflow:'hidden',
    }}>
      {children}
    </div>
  );
}

// Profile header inside the render
function ProfileHeadVA({ name, handle, sub, avatarBg, initials, identity = 'personal', verifiedTag = true }) {
  const idMap = {
    personal: { c:VA.personal, bg:VA.personalBg, label:'Personal' },
    home:     { c:VA.home,     bg:VA.homeBg,     label:'Home' },
  };
  const idc = idMap[identity];
  return (
    <div style={{padding:'16px 16px 4px', display:'flex', gap:13, alignItems:'center'}}>
      <div style={{
        width:60, height:60, borderRadius:'50%', flexShrink:0,
        background:avatarBg, color:'#fff',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:22, fontWeight:700, letterSpacing:-0.5,
        boxShadow:'0 2px 8px rgba(17,24,39,0.12)', position:'relative',
      }}>
        {initials}
        {verifiedTag && (
          <div style={{
            position:'absolute', bottom:-2, right:-2,
            width:22, height:22, borderRadius:'50%', background:VA.p600,
            border:'2.5px solid #fff', display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <i data-lucide="check" style={{width:11, height:11, strokeWidth:3.4, color:'#fff'}}/>
          </div>
        )}
      </div>
      <div style={{flex:1, minWidth:0}}>
        <div style={{
          fontSize:18, fontWeight:700, color:VA.fg1, letterSpacing:-0.3,
          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
        }}>{name}</div>
        {handle && (
          <div style={{fontSize:12.5, color:VA.fg3, fontWeight:500, marginTop:1}}>{handle}</div>
        )}
        <div style={{marginTop:6, display:'inline-flex', alignItems:'center', gap:5,
          height:21, padding:'0 8px', borderRadius:9999, background:idc.bg, color:idc.c,
          fontSize:10.5, fontWeight:700, letterSpacing:0.02,
        }}>
          <i data-lucide="user" style={{width:11, height:11, strokeWidth:2.4}}/>
          {idc.label}
        </div>
      </div>
    </div>
  );
}

function PrivacyFooterVA({ text }) {
  return (
    <div style={{
      flexShrink:0, background:VA.surface, borderTop:`1px solid ${VA.border}`,
      padding:'12px 18px 26px', display:'flex', gap:10, alignItems:'flex-start',
    }}>
      <i data-lucide="shield-check" style={{width:16, height:16, strokeWidth:2, color:VA.p600, flexShrink:0, marginTop:1}}/>
      <div style={{fontSize:11.5, color:VA.fg3, lineHeight:'16px', letterSpacing:-0.02, flex:1}}>
        {text} <span style={{color:VA.p600, fontWeight:700}}>Manage privacy</span>
      </div>
    </div>
  );
}

// ─── FRAME A · POPULATED — Connection viewer (rich) ────────────
function FrameViewAsConnection() {
  return (
    <PhoneVA>
      <TopBarVA title="View as"/>
      <ChipRowVA active="connection"/>

      <div style={{flex:1, overflow:'auto'}}>
        <PreviewRenderVA tone="info">
          <PreviewBannerVA icon="user-check" viewerLabel="a connection" tone="info"/>

          <ProfileHeadVA
            name="Dana Okafor"
            handle="@dana.o · Maple Heights"
            avatarBg="linear-gradient(145deg,#0ea5e9,#0369a1)"
            initials="DO"
            identity="personal"
          />

          {/* Verification badges */}
          <div style={{padding:'8px 16px 14px', display:'flex', flexWrap:'wrap', gap:6}}>
            <VBadge icon="map-pin" label="Address verified"/>
            <VBadge icon="badge-check" label="ID verified"/>
            <VBadge icon="phone" label="Phone verified"/>
          </div>

          {/* Field rows */}
          <div style={{padding:'0 16px 4px'}}>
            <FieldVA icon="map-pin" label="Location" value="Maple Heights · 2 blocks away"/>
            <FieldVA icon="calendar" label="Member since" value="March 2023 · 2 yrs"/>
            <FieldVA icon="star" label="Rating" value="4.9 · 38 reviews"/>
            <FieldVA icon="users" label="Mutual connections" value="6 neighbors in common"/>
            <FieldVA icon="phone" label="Contact" value="Available on request"/>
          </div>

          {/* Shared context strip */}
          <div style={{
            margin:'6px 16px 16px', padding:'11px 13px', borderRadius:12,
            background:VA.p50, border:`1px solid ${VA.p100}`,
            display:'flex', alignItems:'center', gap:9,
          }}>
            <i data-lucide="handshake" style={{width:16, height:16, strokeWidth:2, color:VA.p600, flexShrink:0}}/>
            <div style={{fontSize:11.5, color:VA.p700, fontWeight:600, lineHeight:'15px'}}>
              You completed 2 tasks together. Connections see your shared history.
            </div>
          </div>
        </PreviewRenderVA>
      </div>

      <PrivacyFooterVA text="Connections see more because you've interacted before."/>
    </PhoneVA>
  );
}

// ─── FRAME B · SECONDARY — Public viewer (redacted) ────────────
function FrameViewAsPublic() {
  return (
    <PhoneVA>
      <TopBarVA title="View as"/>
      <ChipRowVA active="public"/>

      <div style={{flex:1, overflow:'auto'}}>
        <PreviewRenderVA tone="restricted">
          <PreviewBannerVA icon="globe" viewerLabel="the public" tone="restricted"/>

          <ProfileHeadVA
            name="Dana O."
            handle="Maple Heights area"
            avatarBg="linear-gradient(145deg,#94a3b8,#475569)"
            initials="D"
            identity="personal"
          />

          {/* Verification badges — only the trust signal shows */}
          <div style={{padding:'8px 16px 14px', display:'flex', flexWrap:'wrap', gap:6}}>
            <VBadge icon="badge-check" label="Verified neighbor"/>
            <VBadge icon="lock" label="ID verified" on={false}/>
            <VBadge icon="lock" label="Phone verified" on={false}/>
          </div>

          {/* Field rows — most hidden */}
          <div style={{padding:'0 16px 4px'}}>
            <FieldVA icon="map-pin" label="Location" value="Maple Heights district" partial/>
            <FieldVA icon="calendar" label="Member since" value="2023"/>
            <FieldVA icon="star" label="Rating" value="4.9 · 38 reviews"/>
            <FieldVA icon="users" label="Mutual connections" value="" hidden/>
            <FieldVA icon="phone" label="Contact" value="" hidden/>
          </div>

          {/* Restricted strip */}
          <div style={{
            margin:'6px 16px 16px', padding:'11px 13px', borderRadius:12,
            background:VA.warningBg, border:`1px solid ${VA.warningLight}`,
            display:'flex', alignItems:'center', gap:9,
          }}>
            <i data-lucide="eye-off" style={{width:16, height:16, strokeWidth:2, color:VA.warning, flexShrink:0}}/>
            <div style={{fontSize:11.5, color:'#92400E', fontWeight:600, lineHeight:'15px'}}>
              Exact address, contacts, and connections stay private to the public.
            </div>
          </div>
        </PreviewRenderVA>
      </div>

      <PrivacyFooterVA text="Anyone not connected to you sees only this minimal card."/>
    </PhoneVA>
  );
}

Object.assign(window, { FrameViewAsConnection, FrameViewAsPublic });
