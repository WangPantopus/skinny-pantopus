// §1C-b — Navigation Drawer · LAUNCHER variant
// Alternative architecture: the drawer is a thin LAUNCHER. Its context pill
// does NOT expand inline — tapping it opens the existing Identity Center
// switch surface (a dedicated, richer screen) to change context. The body
// menu is identical to the inline variant; only the switching path differs.
// Three context drawers (launcher pill) + the Identity Center switch sheet.
//
// Reuses PILLAR / NDScrim / NDPanel / NDBackdrop / ContextPill / DBody /
// DOverline / DRow / BackToHub (nav-drawer-frames.jsx) and BPhone (beacon-shell.jsx).

// ── Personal launcher drawer ─────────────────────────────────────
function FrameLauncherPersonal() {
  return (
    <BPhone>
      <NDBackdrop pillar="personal"/>
      <NDScrim/>
      <NDPanel>
        <ContextPill pillar="personal" title="Personal" sub="Maria Lopez · Your profile" mode="launch"/>
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

// ── Home launcher drawer ─────────────────────────────────────────
function FrameLauncherHome() {
  return (
    <BPhone>
      <NDBackdrop pillar="home"/>
      <NDScrim/>
      <NDPanel>
        <ContextPill pillar="home" title="Maple Street" sub="123 Maple St" mode="launch"/>
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

// ── Business launcher drawer ─────────────────────────────────────
function FrameLauncherBusiness() {
  return (
    <BPhone>
      <NDBackdrop pillar="business"/>
      <NDScrim/>
      <NDPanel>
        <ContextPill pillar="business" title="Cortado Coffee" sub="Coffee shop · Downtown" mode="launch"/>
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
//  Identity Center · switch sheet (the surface the pill opens)
// ════════════════════════════════════════════════════════════════
function ICLabel({ children }) {
  return (
    <div style={{
      fontSize:11, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase',
      color:BU.fg4, padding:'16px 20px 8px',
    }}>{children}</div>
  );
}

function SwitchCard({ pillar, title, sub, selected, dashed, addIcon }) {
  if (dashed) {
    return (
      <div style={{
        display:'flex', alignItems:'center', gap:13, padding:'13px 14px', margin:'4px 16px',
        borderRadius:14, border:`1.5px dashed ${BU.borderStrong}`, background:BU.muted, cursor:'pointer',
      }}>
        <div style={{
          width:38, height:38, borderRadius:11, background:BU.sunken, color:BU.fg3,
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
        }}>
          <i data-lucide={addIcon} style={{width:18, height:18, strokeWidth:2.2}}/>
        </div>
        <span style={{fontSize:14, fontWeight:600, color:BU.fg2, letterSpacing:-0.1}}>{title}</span>
      </div>
    );
  }
  const p = PILLAR[pillar];
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:13, padding:'12px 14px', margin:'4px 16px',
      borderRadius:14, cursor:'pointer',
      background: selected ? BU.primary50 : BU.surface,
      border:`1.5px solid ${selected ? BU.primary600 : BU.border}`,
      boxShadow: selected ? '0 1px 2px rgba(2,132,199,0.12)' : 'none',
    }}>
      <div style={{
        width:42, height:42, borderRadius:12, background:p.bg, color:p.color,
        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
      }}>
        <i data-lucide={p.icon} style={{width:21, height:21, strokeWidth:2.2}}/>
      </div>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize:15, fontWeight:700, color:BU.fg1, letterSpacing:-0.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{title}</div>
        <div style={{fontSize:12, color:BU.fg3, marginTop:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{sub}</div>
      </div>
      <div style={{
        width:22, height:22, borderRadius:'50%', flexShrink:0,
        border:`2px solid ${selected ? BU.primary600 : BU.borderStrong}`,
        background: selected ? BU.primary600 : 'transparent',
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        {selected && <i data-lucide="check" style={{width:12, height:12, color:'#fff', strokeWidth:3.4}}/>}
      </div>
    </div>
  );
}

function FrameIdentityCenterSwitch() {
  return (
    <BPhone>
      <NDBackdrop pillar="personal"/>
      <div style={{position:'absolute', inset:0, background:'rgba(17,24,39,0.5)', backdropFilter:'blur(1.5px)', zIndex:40}}/>
      <div style={{
        position:'absolute', left:0, right:0, bottom:0, top:'13%', zIndex:45,
        background:BU.surface, borderTopLeftRadius:22, borderTopRightRadius:22,
        boxShadow:'0 -10px 36px rgba(17,24,39,0.26)', overflow:'hidden',
        display:'flex', flexDirection:'column',
      }}>
        <div style={{display:'flex', justifyContent:'center', paddingTop:9, paddingBottom:2, flexShrink:0}}>
          <div style={{width:38, height:5, borderRadius:9999, background:BU.borderStrong}}/>
        </div>
        <div style={{padding:'8px 20px 2px', flexShrink:0}}>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <div style={{
              width:26, height:26, borderRadius:7, background:BU.primary50, color:BU.primary600,
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            }}>
              <i data-lucide="user-cog" style={{width:15, height:15, strokeWidth:2.2}}/>
            </div>
            <span style={{fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:BU.primary600}}>Identity Center</span>
          </div>
          <h2 style={{margin:'10px 0 0', fontSize:21, fontWeight:700, color:BU.fg1, letterSpacing:-0.4}}>Switch context</h2>
          <p style={{margin:'5px 0 0', fontSize:13, color:BU.fg3, lineHeight:'19px', letterSpacing:-0.05}}>
            Pick who you’re acting as. This changes what the app shows and how neighbors see you.
          </p>
        </div>

        <div style={{flex:1, overflow:'auto', minHeight:0, paddingTop:6, paddingBottom:4}}>
          <ICLabel>You</ICLabel>
          <SwitchCard pillar="personal" title="Personal" sub="Your profile & tasks" selected/>
          <SwitchCard pillar="professional" title="Professional" sub="Skills & discoverability"/>

          <ICLabel>Your Homes</ICLabel>
          <SwitchCard pillar="home" title="Maple Street" sub="123 Maple St"/>
          <SwitchCard pillar="home" title="Lake Cabin" sub="88 Lakeshore Dr"/>
          <SwitchCard dashed title="Add a home" addIcon="plus"/>

          <ICLabel>Your Businesses</ICLabel>
          <SwitchCard pillar="business" title="Cortado Coffee" sub="Coffee shop · Downtown"/>
          <SwitchCard dashed title="Create a business" addIcon="plus"/>

          <div style={{
            display:'flex', alignItems:'center', gap:12, padding:'13px 16px', margin:'12px 16px 4px',
            borderRadius:12, background:BU.muted, border:`1px solid ${BU.border}`, cursor:'pointer',
          }}>
            <i data-lucide="sliders-horizontal" style={{width:18, height:18, color:BU.fg2, strokeWidth:2, flexShrink:0}}/>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:13.5, fontWeight:600, color:BU.fg1, letterSpacing:-0.1}}>Manage profiles & privacy</div>
              <div style={{fontSize:11.5, color:BU.fg3, marginTop:1}}>Audience, links, what each viewer sees</div>
            </div>
            <i data-lucide="chevron-right" style={{width:18, height:18, color:BU.fg4, strokeWidth:2.2}}/>
          </div>
        </div>

        <div style={{
          flexShrink:0, display:'flex', gap:10, padding:'12px 16px 18px',
          borderTop:`1px solid ${BU.borderSub}`, background:BU.surface,
        }}>
          <button style={{
            flex:'0 0 auto', height:48, padding:'0 18px', borderRadius:12, cursor:'pointer',
            background:BU.surface, border:`1px solid ${BU.border}`, color:BU.fg2,
            fontSize:14.5, fontWeight:600, letterSpacing:-0.1,
          }}>Cancel</button>
          <button style={{
            flex:1, height:48, border:'none', borderRadius:12, cursor:'pointer',
            background:BU.primary600, color:'#fff', fontSize:15, fontWeight:700, letterSpacing:-0.1,
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            boxShadow:'0 8px 18px rgba(2,132,199,0.30)',
          }}>
            Use this context
            <i data-lucide="check" style={{width:18, height:18, strokeWidth:2.8}}/>
          </button>
        </div>
      </div>
    </BPhone>
  );
}

Object.assign(window, {
  FrameLauncherPersonal, FrameLauncherHome, FrameLauncherBusiness, FrameIdentityCenterSwitch,
});
