// §1C — src/navigation/_components/ContextDrawer.tsx
// The left navigation drawer: an 82%-width panel sliding over a dimmed scrim,
// opened from the Hub top-bar menu. CONTEXT-AWARE — its body sections change
// with the active context (Personal / Home / Business) and it hosts the
// identity/context switcher in its header.
// One panel · four states (Personal · Home · Business · Switcher expanded).
//
// Builds on BU / BPhone / BAvatar (beacon-shell.jsx).

// ── pillar config (identity tints) ───────────────────────────────
const ND = {
  scrim:'rgba(17,24,39,0.45)',
  panelW:296,                 // ~82% of the 360 bezel
  rowH:46,
  halo:'0 16px 40px rgba(17,24,39,0.28)',
};
const PILLAR = {
  personal:     { color:'#0284C7', bg:'#DBEAFE', icon:'user',        ring:'rgba(2,132,199,0.16)' },
  professional: { color:'#475569', bg:'#E2E8F0', icon:'wrench',      ring:'rgba(71,85,105,0.16)' },
  home:         { color:'#16A34A', bg:'#DCFCE7', icon:'home',        ring:'rgba(22,163,74,0.16)' },
  business:     { color:'#7C3AED', bg:'#F3E8FF', icon:'building-2',  ring:'rgba(124,58,237,0.16)' },
};

// ── faint context Hub backdrop (dimmed behind the panel) ─────────
function NDBackdrop({ pillar }) {
  const p = PILLAR[pillar];
  const card = (k) => (
    <div key={k} style={{
      height:74, borderRadius:14, background:BU.surface, border:`1px solid ${BU.border}`,
    }}/>
  );
  return (
    <div style={{flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:BU.muted}}>
      <div style={{
        height:50, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 16px',
      }}>
        <i data-lucide="menu" style={{width:24, height:24, color:BU.fg1}}/>
        <div style={{
          width:30, height:30, borderRadius:'50%', background:p.color, color:'#fff',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <i data-lucide={p.icon} style={{width:15, height:15, strokeWidth:2.2}}/>
        </div>
      </div>
      <div style={{padding:'4px 16px 0'}}>
        <div style={{width:150, height:22, borderRadius:6, background:BU.sunken, marginBottom:18}}/>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
          {['a','b','c','d'].map(card)}
        </div>
      </div>
    </div>
  );
}

function NDScrim() {
  return <div style={{position:'absolute', inset:0, background:ND.scrim, zIndex:40}}/>;
}

// ── the sliding panel shell ──────────────────────────────────────
function NDPanel({ children }) {
  return (
    <div style={{
      position:'absolute', top:0, bottom:0, left:0, width:ND.panelW, zIndex:45,
      background:BU.surface, borderTopRightRadius:22, borderBottomRightRadius:22,
      boxShadow:ND.halo, overflow:'hidden', display:'flex', flexDirection:'column',
    }}>
      {children}
    </div>
  );
}

// ── header: collapsed / expanded context pill ────────────────────
function ContextPill({ pillar, title, sub, expanded, mode = 'expand' }) {
  const p = PILLAR[pillar];
  const launch = mode === 'launch';
  return (
    <div style={{padding:'52px 12px 12px', flexShrink:0}}>
      <button style={{
        width:'100%', display:'flex', alignItems:'center', gap:11, padding:'10px 12px',
        background:p.bg, border:`1px solid ${expanded ? p.color : 'transparent'}`,
        boxShadow: expanded ? `0 0 0 3px ${p.ring}` : 'none',
        borderRadius:14, cursor:'pointer', textAlign:'left',
      }}>
        <div style={{
          width:38, height:38, borderRadius:'50%', background:p.color, color:'#fff',
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
        }}>
          <i data-lucide={p.icon} style={{width:19, height:19, strokeWidth:2.2}}/>
        </div>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize:15, fontWeight:700, color:BU.fg1, letterSpacing:-0.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{title}</div>
          <div style={{fontSize:11.5, color:p.color, fontWeight:600, marginTop:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{sub}</div>
        </div>
        {launch ? (
          <span style={{
            display:'inline-flex', alignItems:'center', gap:3, flexShrink:0,
            padding:'4px 8px 4px 10px', borderRadius:9999, background:'#fff',
            border:`1px solid ${p.color}`, color:p.color, fontSize:11, fontWeight:700, letterSpacing:-0.1,
          }}>
            Switch
            <i data-lucide="chevron-right" style={{width:13, height:13, strokeWidth:2.8}}/>
          </span>
        ) : (
          <div style={{
            width:24, height:24, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
            color:p.color, flexShrink:0,
          }}>
            <i data-lucide={expanded ? 'chevron-up' : 'chevron-down'} style={{width:18, height:18, strokeWidth:2.6}}/>
          </div>
        )}
      </button>
    </div>
  );
}

// ── section overline ─────────────────────────────────────────────
function DOverline({ children }) {
  return (
    <div style={{
      fontSize:11, fontWeight:700, letterSpacing:'0.09em', textTransform:'uppercase',
      color:BU.fg4, padding:'16px 18px 6px',
    }}>{children}</div>
  );
}

// ── a full-width menu row ────────────────────────────────────────
function DRow({ icon, label, active }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:14, minHeight:ND.rowH,
      padding:'0 12px', margin:'0 8px', borderRadius:10,
      background: active ? BU.primary50 : 'transparent',
      cursor:'pointer',
    }}>
      <i data-lucide={icon} style={{
        width:20, height:20, strokeWidth:2, flexShrink:0,
        color: active ? BU.primary600 : BU.fg2,
      }}/>
      <span style={{
        fontSize:14.5, letterSpacing:-0.15,
        fontWeight: active ? 700 : 500,
        color: active ? BU.primary700 : BU.fg1,
      }}>{label}</span>
      {active && (
        <span style={{
          marginLeft:'auto', width:6, height:6, borderRadius:'50%', background:BU.primary600,
        }}/>
      )}
    </div>
  );
}

// ── the "Back to Hub" quiet-but-clear affordance ─────────────────
function BackToHub() {
  return (
    <div style={{padding:'10px 12px 16px', marginTop:4, borderTop:`1px solid ${BU.borderSub}`}}>
      <div style={{
        display:'flex', alignItems:'center', gap:12, padding:'11px 12px', borderRadius:12,
        background:BU.primary50, cursor:'pointer',
      }}>
        <div style={{
          width:32, height:32, borderRadius:'50%', background:'#fff', border:`1px solid ${BU.primary100}`,
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:BU.primary600,
        }}>
          <i data-lucide="arrow-left" style={{width:17, height:17, strokeWidth:2.4}}/>
        </div>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize:14, fontWeight:700, color:BU.primary700, letterSpacing:-0.1}}>Back to Hub</div>
          <div style={{fontSize:11.5, color:BU.fg3, marginTop:1}}>Return to your personal hub</div>
        </div>
        <i data-lucide="corner-up-left" style={{width:16, height:16, color:BU.primary600, strokeWidth:2.2}}/>
      </div>
    </div>
  );
}

// ── scrollable body wrapper ──────────────────────────────────────
function DBody({ children }) {
  return <div style={{flex:1, overflow:'auto', minHeight:0, paddingBottom:6}}>{children}</div>;
}

// ── switcher dropdown row ────────────────────────────────────────
function SwitchRow({ pillar, title, sub, checked, dashed, addIcon }) {
  if (dashed) {
    return (
      <div style={{
        display:'flex', alignItems:'center', gap:12, padding:'11px 12px', margin:'2px 8px',
        borderRadius:12, border:`1.5px dashed ${BU.borderStrong}`, background:BU.muted, cursor:'pointer',
      }}>
        <div style={{
          width:34, height:34, borderRadius:9, background:BU.sunken, color:BU.fg3,
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
        }}>
          <i data-lucide={addIcon} style={{width:17, height:17, strokeWidth:2.2}}/>
        </div>
        <span style={{fontSize:13.5, fontWeight:600, color:BU.fg2, letterSpacing:-0.1}}>{title}</span>
      </div>
    );
  }
  const p = PILLAR[pillar];
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:12, padding:'9px 12px', margin:'2px 8px',
      borderRadius:12, cursor:'pointer',
      background: checked ? BU.primary50 : 'transparent',
      boxShadow: checked ? `0 0 0 1px ${BU.primary100}` : 'none',
    }}>
      <div style={{
        width:38, height:38, borderRadius:10, background:p.bg, color:p.color,
        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
      }}>
        <i data-lucide={p.icon} style={{width:19, height:19, strokeWidth:2.2}}/>
      </div>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize:14, fontWeight:700, color:BU.fg1, letterSpacing:-0.15, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{title}</div>
        <div style={{fontSize:11.5, color:BU.fg3, marginTop:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{sub}</div>
      </div>
      {checked && (
        <div style={{
          width:22, height:22, borderRadius:'50%', background:BU.primary600, color:'#fff',
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
        }}>
          <i data-lucide="check" style={{width:13, height:13, strokeWidth:3.2}}/>
        </div>
      )}
    </div>
  );
}

function SwitchLabel({ children }) {
  return (
    <div style={{
      fontSize:11, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase',
      color:BU.fg4, padding:'14px 20px 6px',
    }}>{children}</div>
  );
}

// ════════════════════════════════════════════════════════════════
//  FRAME 1 — PERSONAL context (switcher collapsed)
// ════════════════════════════════════════════════════════════════
function FrameDrawerPersonal() {
  return (
    <BPhone>
      <NDBackdrop pillar="personal"/>
      <NDScrim/>
      <NDPanel>
        <ContextPill pillar="personal" title="Personal" sub="Maria Lopez · Your profile"/>
        <DBody>
          <DOverline>Manage</DOverline>
          <DRow icon="home" label="My Homes"/>
          <DRow icon="building-2" label="My Businesses"/>
          <DRow icon="users" label="Connections"/>
          <DRow icon="mail" label="Mailbox"/>
          <DRow icon="fingerprint" label="Profile & Privacy"/>

          <DOverline>Discover</DOverline>
          <DRow icon="rss" label="Beacon Updates"/>
          <DRow icon="search" label="Search"/>
          <DRow icon="compass" label="Discover Neighbors"/>

          <DOverline>Your Stuff</DOverline>
          <DRow icon="radio" label="My Beacon"/>
          <DRow icon="tag" label="My Listings"/>
          <DRow icon="newspaper" label="My Pulse"/>
          <DRow icon="list-checks" label="My Tasks"/>
          <DRow icon="hand" label="My Bids"/>
          <DRow icon="tags" label="Offers & Bids"/>
          <DRow icon="plus-circle" label="Post Task"/>
          <DRow icon="credit-card" label="Wallet & Payments"/>

          <DOverline>Settings</DOverline>
          <DRow icon="settings" label="Settings"/>
          <DRow icon="life-buoy" label="Help & Support"/>
          <div style={{height:14}}/>
        </DBody>
      </NDPanel>
    </BPhone>
  );
}

// ════════════════════════════════════════════════════════════════
//  FRAME 2 — HOME context
// ════════════════════════════════════════════════════════════════
function FrameDrawerHome() {
  return (
    <BPhone>
      <NDBackdrop pillar="home"/>
      <NDScrim/>
      <NDPanel>
        <ContextPill pillar="home" title="Maple Street" sub="123 Maple St"/>
        <DBody>
          <div style={{height:6}}/>
          <DRow icon="info" label="Property Details"/>
          <DRow icon="bar-chart-3" label="Overview" active/>
          <DRow icon="check-circle" label="Tasks"/>
          <DRow icon="wrench" label="Issues"/>
          <DRow icon="credit-card" label="Bills"/>
          <DRow icon="users" label="Members"/>
          <DRow icon="mail" label="Mailbox"/>

          <DOverline>More</DOverline>
          <DRow icon="package" label="Packages"/>
          <DRow icon="file-text" label="Documents"/>
          <DRow icon="hammer" label="Vendors"/>
          <DRow icon="alert-triangle" label="Emergency"/>

          <DOverline>Settings</DOverline>
          <DRow icon="settings" label="Home Settings"/>

          <BackToHub/>
        </DBody>
      </NDPanel>
    </BPhone>
  );
}

// ════════════════════════════════════════════════════════════════
//  FRAME 3 — BUSINESS context
// ════════════════════════════════════════════════════════════════
function FrameDrawerBusiness() {
  return (
    <BPhone>
      <NDBackdrop pillar="business"/>
      <NDScrim/>
      <NDPanel>
        <ContextPill pillar="business" title="Cortado Coffee" sub="Coffee shop · Downtown"/>
        <DBody>
          <div style={{height:6}}/>
          <DRow icon="bar-chart-3" label="Overview" active/>
          <DRow icon="user-circle" label="Profile"/>
          <DRow icon="map-pin" label="Locations & Hours"/>
          <DRow icon="tag" label="Catalog"/>
          <DRow icon="file" label="Pages"/>
          <DRow icon="plus-circle" label="Post Task"/>
          <DRow icon="messages-square" label="Business Chat"/>

          <DOverline>Manage</DOverline>
          <DRow icon="users" label="Team"/>
          <DRow icon="star" label="Reviews"/>
          <DRow icon="credit-card" label="Payments"/>

          <DOverline>Settings</DOverline>
          <DRow icon="settings" label="Settings"/>

          <BackToHub/>
        </DBody>
      </NDPanel>
    </BPhone>
  );
}

// ════════════════════════════════════════════════════════════════
//  FRAME 4 — SWITCHER EXPANDED (over Personal)
// ════════════════════════════════════════════════════════════════
function FrameDrawerSwitcher() {
  return (
    <BPhone>
      <NDBackdrop pillar="personal"/>
      <NDScrim/>
      <NDPanel>
        <ContextPill pillar="personal" title="Personal" sub="Maria Lopez · Your profile" expanded/>
        <DBody>
          <SwitchRow pillar="personal" title="Personal" sub="Your profile & tasks" checked/>
          <SwitchRow pillar="professional" title="Professional" sub="Skills & discoverability"/>

          <SwitchLabel>Your Homes</SwitchLabel>
          <SwitchRow pillar="home" title="Maple Street" sub="123 Maple St"/>
          <SwitchRow pillar="home" title="Lake Cabin" sub="88 Lakeshore Dr"/>
          <SwitchRow dashed title="Add a home" addIcon="plus"/>

          <SwitchLabel>Your Businesses</SwitchLabel>
          <SwitchRow pillar="business" title="Cortado Coffee" sub="Coffee shop · Downtown"/>
          <SwitchRow dashed title="Create a business" addIcon="plus"/>
          <div style={{height:14}}/>
        </DBody>
      </NDPanel>
    </BPhone>
  );
}

Object.assign(window, {
  FrameDrawerPersonal, FrameDrawerHome, FrameDrawerBusiness, FrameDrawerSwitcher,
  // shared helpers (reused by the launcher variant)
  PILLAR, NDScrim, NDPanel, NDBackdrop, ContextPill, DOverline, DRow, DBody, BackToHub,
});
