// F8 — My Household Availability Settings (sheet, MVP) · 300×620 · Home green
// Exposure-only boundary screen — never edits the source availability (Personal).
// Frames: default · personal-not-set-up · saving · opted-out-confirm

const { N, H, M } = window;
const { Phone, TopBar, Card, Overline, Toggle, Banner, PrimaryBtn, Dialog } = window;

const HOMEAV = { initials:'MS', grad:'linear-gradient(135deg, #34d399, #16a34a)' };

function ContextHeader() {
  return (
    <Card pad="12px 13px" style={{ display:'flex', alignItems:'center', gap:11 }}>
      <div style={{ width:40, height:40, borderRadius:12, background:H.bg100, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i data-lucide="house" style={{ width:20, height:20, color:H.accent }}/></div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:14, fontWeight:700, color:N.fg1, letterSpacing:-0.2 }}>Maple Street</div>
        <div style={{ fontSize:11.5, color:N.fg3, marginTop:1 }}>How you appear here</div>
      </div>
    </Card>
  );
}

// Deep-link row — Personal-sky leading icon signals it lives in Personal.
function DeepLinkRow({ saving }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:11, padding:'12px 13px', cursor:'pointer' }}>
      <div style={{ width:32, height:32, borderRadius:9, background:N.personalBg50, color:N.personal, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border:`1px solid ${N.infoLight}` }}><i data-lucide="calendar" style={{ width:16, height:16 }}/></div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600, color:N.fg1, letterSpacing:-0.1 }}>Edit my full availability in Personal</div>
        <div style={{ fontSize:10.5, color:N.fg3, marginTop:1, lineHeight:'14px' }}>Your source of truth — changes apply everywhere</div>
      </div>
      <i data-lucide="chevron-right" style={{ width:16, height:16, color:N.fg4, flexShrink:0 }}/>
    </div>
  );
}

function SettingToggle({ icon, label, sub, on, disabled, last, saving }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:11, padding:'11px 13px', borderTop:`1px solid ${N.border}`, opacity:disabled?0.5:1 }}>
      <div style={{ width:32, height:32, borderRadius:9, flexShrink:0, background:on&&!disabled?H.bg50:N.sunken, color:on&&!disabled?H.accent:N.fg3, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide={icon} style={{ width:16, height:16 }}/></div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12.5, fontWeight:600, color:N.fg1, letterSpacing:-0.1 }}>{label}</div>
        {sub && <div style={{ fontSize:10.5, color:N.fg3, marginTop:1, lineHeight:'14px' }}>{sub}</div>}
      </div>
      {saving ? <i data-lucide="loader-circle" style={{ width:16, height:16, color:H.accent, animation:'sh-spin 0.8s linear infinite' }}/> : <ToggleGreen on={on} disabled={disabled}/>}
    </div>
  );
}
function ToggleGreen({ on, disabled }) {
  return <div style={{ width:36, height:20, borderRadius:10, position:'relative', flexShrink:0, background: disabled?N.sunken:(on?H.accent:N.borderStrong) }}><div style={{ position:'absolute', top:2, left:on?18:2, width:16, height:16, borderRadius:'50%', background:'#fff', boxShadow:'0 1px 2px rgba(0,0,0,0.22)' }}/></div>;
}

function DisclosureRow({ icon, label, value, last, disabled }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:11, padding:'11px 13px', borderTop:`1px solid ${N.border}`, cursor:'pointer', opacity:disabled?0.5:1 }}>
      <div style={{ width:32, height:32, borderRadius:9, flexShrink:0, background:N.sunken, color:N.fg2, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide={icon} style={{ width:16, height:16 }}/></div>
      <div style={{ flex:1, minWidth:0, fontSize:12.5, fontWeight:600, color:N.fg1 }}>{label}</div>
      <span style={{ fontSize:11.5, color:N.fg3, fontWeight:500 }}>{value}</span>
      <i data-lucide="chevron-right" style={{ width:16, height:16, color:N.fg4, flexShrink:0 }}/>
    </div>
  );
}

function FootNote() {
  return <div style={{ fontSize:11, color:N.fg3, lineHeight:'16px', padding:'4px 4px 0' }}>This only controls what this household sees. It doesn't change your personal calendar.</div>;
}

function Bar({ title='My availability' }) {
  return <TopBar title={title}/>;
}
function Body({ children }) {
  return <div style={{ flex:1, overflow:'auto', padding:'12px 12px 24px', display:'flex', flexDirection:'column', gap:12 }}>{children}</div>;
}

// ─── FRAME 1 · DEFAULT ─────────────────────────────────────────
function FrameDefault() {
  return (
    <Phone label="My availability · Default">
      <Bar/>
      <Body>
        <ContextHeader/>
        <div>
          <Overline style={{ marginBottom:7, paddingLeft:4 }}>Source</Overline>
          <Card pad={0}><DeepLinkRow/></Card>
        </div>
        <div>
          <Overline style={{ marginBottom:7, paddingLeft:4 }}>What this household sees</Overline>
          <Card pad={0}>
            <div style={{ paddingTop:1 }}/>
            <SettingToggle icon="eye" label="Share my free/busy with this household" sub="Members see when you're free, never event details" on/>
            <SettingToggle icon="repeat" label="Include me in round-robin rotation" sub="You can be auto-assigned when more than one is free" on/>
            <DisclosureRow icon="moon" label="Household quiet hours" value="Weeknights 9 PM"/>
            <SettingToggle icon="calendar-x" label="Auto-decline conflicting invites" on={false} last/>
          </Card>
        </div>
        <FootNote/>
      </Body>
    </Phone>
  );
}

// ─── FRAME 2 · PERSONAL NOT SET UP ─────────────────────────────
function FrameNotSetUp() {
  return (
    <Phone label="My availability · Not set up">
      <Bar/>
      <Body>
        <ContextHeader/>
        <Banner tone="info" icon="info" title="Set up your availability in Personal first">Until you set your free/busy hours, this household can't see when you're free.</Banner>
        <PrimaryBtn icon="external-link">Set it up in Personal</PrimaryBtn>
        <div>
          <Overline style={{ marginBottom:7, paddingLeft:4 }}>What this household sees</Overline>
          <Card pad={0}>
            <div style={{ paddingTop:1 }}/>
            <SettingToggle icon="eye" label="Share my free/busy with this household" on={false} disabled/>
            <SettingToggle icon="repeat" label="Include me in round-robin rotation" on={false} disabled/>
            <SettingToggle icon="calendar-x" label="Auto-decline conflicting invites" on={false} disabled last/>
          </Card>
        </div>
      </Body>
    </Phone>
  );
}

// ─── FRAME 3 · SAVING ──────────────────────────────────────────
function FrameSaving() {
  return (
    <Phone label="My availability · Saving">
      <Bar/>
      <Body>
        <ContextHeader/>
        <div>
          <Overline style={{ marginBottom:7, paddingLeft:4 }}>Source</Overline>
          <Card pad={0}><DeepLinkRow/></Card>
        </div>
        <div>
          <Overline style={{ marginBottom:7, paddingLeft:4 }}>What this household sees</Overline>
          <Card pad={0}>
            <div style={{ paddingTop:1 }}/>
            <SettingToggle icon="eye" label="Share my free/busy with this household" sub="Members see when you're free, never event details" on/>
            <SettingToggle icon="repeat" label="Include me in round-robin rotation" on saving/>
            <SettingToggle icon="calendar-x" label="Auto-decline conflicting invites" on={false} last/>
          </Card>
        </div>
        <FootNote/>
      </Body>
    </Phone>
  );
}

// ─── FRAME 4 · OPTED-OUT CONFIRM ───────────────────────────────
function FrameOptOut() {
  return (
    <Phone label="My availability · Opt-out confirm" indicatorLight>
      <Bar/>
      <div style={{ opacity:0.5, pointerEvents:'none' }}>
        <Body>
          <ContextHeader/>
          <div><Overline style={{ marginBottom:7, paddingLeft:4 }}>What this household sees</Overline><Card pad={0}><div style={{ paddingTop:1 }}/><SettingToggle icon="eye" label="Share my free/busy with this household" on={false} last/></Card></div>
        </Body>
      </div>
      <div style={{ position:'absolute', inset:0, background:'rgba(17,24,39,0.5)', zIndex:30, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 20px' }}>
        <div style={{ width:'100%', maxWidth:300, background:N.surface, borderRadius:20, boxShadow:'0 20px 50px rgba(0,0,0,0.3)', padding:'20px 18px 16px', boxSizing:'border-box' }}>
          <div style={{ display:'flex', justifyContent:'center', marginBottom:13 }}><div style={{ width:40, height:40, borderRadius:'50%', background:N.warningBg, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="eye-off" style={{ width:20, height:20, color:N.warning }}/></div></div>
          <h3 style={{ margin:'0 0 8px', fontSize:16, fontWeight:700, color:N.fg1, textAlign:'center', letterSpacing:-0.2 }}>Hide your free/busy from Maple Street?</h3>
          <p style={{ margin:'0 0 16px', fontSize:12.5, color:N.fg2, textAlign:'center', lineHeight:'18px' }}>They won't be able to include you in Find a time.</p>
          <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
            <button style={{ width:'100%', height:44, borderRadius:12, border:'none', background:N.error, color:'#fff', fontSize:13.5, fontWeight:700, cursor:'pointer' }}>Hide</button>
            <button style={{ width:'100%', height:44, borderRadius:12, border:`1px solid ${N.borderStrong}`, background:N.surface, color:N.fg2, fontSize:13.5, fontWeight:700, cursor:'pointer' }}>Keep sharing</button>
          </div>
        </div>
      </div>
    </Phone>
  );
}

Object.assign(window, { FrameDefault, FrameNotSetUp, FrameSaving, FrameOptOut });
