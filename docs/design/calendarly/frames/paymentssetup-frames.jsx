// Pantopus — Calendarly · G · Payments Setup / Stripe Connect & Tax — 5 frames
// Settings section + Connect Express onboarding. Reuses A14.6 Stripe-state row
// vocab; A18 returned-from-Stripe / needs-verification framing. Business violet
// accent; CTA rows sky.
//
// Frames: 1 not connected · 2 onboarding incomplete (resume) · 3 ready ·
// 4 restricted/needs-verification · 5 returned-from-Stripe success.

const { E, SH } = window;
const { C, Frame, TopBar, Scroll, Overline, Card, Chip, Note, SRow } = window;
const BIZ = C.biz, BIZ_BG = C.bizBg;

function StripeBadge({ size=34 }) {
  return <div style={{ width:size, height:size, borderRadius:9, background:C.stripe, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:size*0.5, fontWeight:800, letterSpacing:-0.5 }}>S</div>;
}

function ReadyPill({ label, state }) {
  // state: on | off | warn
  const p = { on:{bg:C.okBg,fg:C.ok,ic:'check'}, off:{bg:E.sunken,fg:E.fg4,ic:'minus'}, warn:{bg:C.warnBg,fg:C.warn,ic:'clock'} }[state];
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4, padding:'8px 4px', background:p.bg, borderRadius:10 }}>
      <i data-lucide={p.ic} style={{ width:14, height:14, color:p.fg, strokeWidth:2.6 }}/>
      <span style={{ fontSize:9.5, fontWeight:700, color:p.fg, textTransform:'uppercase', letterSpacing:0.03 }}>{label}</span>
    </div>
  );
}

function StatusHero({ headline, body, chip, pills }) {
  return (
    <Card pad="13px 13px">
      <div style={{ display:'flex', alignItems:'flex-start', gap:11, marginBottom:11 }}>
        <StripeBadge/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            <span style={{ fontSize:13.5, fontWeight:700, color:E.fg1 }}>{headline}</span>
            {chip}
          </div>
          <div style={{ fontSize:11, color:E.fg3, marginTop:3, lineHeight:'15px' }}>{body}</div>
        </div>
      </div>
      <div style={{ display:'flex', gap:7 }}>
        <ReadyPill label="Charges" state={pills[0]}/>
        <ReadyPill label="Payouts" state={pills[1]}/>
        <ReadyPill label="Details" state={pills[2]}/>
      </div>
    </Card>
  );
}

function ActionRow({ icon='external-link', label, last }) {
  return (
    <div role="button" style={{ display:'flex', alignItems:'center', gap:11, padding:'13px 2px', borderTop:`1px solid ${E.border}`, cursor:'pointer' }}>
      <div style={{ width:32, height:32, borderRadius:9, background:E.blue50, color:E.blue600, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i data-lucide={icon} style={{ width:16, height:16 }}/></div>
      <div style={{ flex:1, fontSize:13, fontWeight:700, color:E.blue600 }}>{label}</div>
      <i data-lucide="chevron-right" style={{ width:16, height:16, color:E.blue600, opacity:0.6 }}/>
    </div>
  );
}

function Receipt({ value }) {
  return (
    <div style={{ flex:1, minWidth:0 }}>
      <div style={{ fontSize:13, fontWeight:600, color:E.fg1 }}>Statement descriptor</div>
      <div style={{ display:'inline-flex', alignItems:'center', gap:5, marginTop:3, padding:'2px 7px', borderRadius:6, background:E.sunken, fontSize:10, fontWeight:700, color:E.fg2, fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
        <i data-lucide="receipt" style={{ width:10, height:10 }}/>{value}
      </div>
    </div>
  );
}

function AccountCard({ gated, action }) {
  const dash = <span style={{ fontSize:13, color:E.fg4 }}>—</span>;
  return (
    <div>
      <Overline color={BIZ}>Account</Overline>
      <div style={{ marginTop:8 }}>
        <Card>
          <SRow icon="circle-dollar-sign" label="Default currency" sub={gated?null:'USD'} trailing={gated?dash:<i data-lucide="chevron-right" style={{ width:16, height:16, color:E.fg4 }}/>}/>
          <div style={{ display:'flex', alignItems:'center', gap:11, padding:'11px 2px', borderBottom:`1px solid ${E.border}` }}>
            <div style={{ width:32, height:32, borderRadius:9, background:E.sunken, color:E.fg2, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i data-lucide="text-cursor-input" style={{ width:16, height:16 }}/></div>
            {gated ? <div style={{ flex:1, fontSize:13, fontWeight:600, color:E.fg1 }}>Statement descriptor</div> : <Receipt value="MARLOW CO"/>}
            {gated ? dash : <i data-lucide="chevron-right" style={{ width:16, height:16, color:E.fg4 }}/>}
          </div>
          {!gated && <SRow icon="banknote" label="Payouts" sub="Bank ••4291 · daily" trailing={<i data-lucide="chevron-right" style={{ width:16, height:16, color:E.fg4 }}/>}/>}
          {action}
        </Card>
      </div>
    </div>
  );
}

function TaxCard({ gated }) {
  const dash = <span style={{ fontSize:13, color:E.fg4 }}>—</span>;
  return (
    <div>
      <Overline color={BIZ}>Tax</Overline>
      <div style={{ marginTop:8 }}>
        <Card>
          <SRow icon="percent" label="Collect tax" trailing={gated?dash:<window.IToggle on color={BIZ}/>}/>
          <SRow icon="file-text" label="Tax rate · Stripe Tax" sub={gated?null:'5.7% · automatic'} trailing={gated?dash:<i data-lucide="chevron-right" style={{ width:16, height:16, color:E.fg4 }}/>} last/>
        </Card>
      </div>
    </div>
  );
}

function Intro({ children }) {
  return <div style={{ fontSize:11.5, color:E.fg3, lineHeight:'16px', padding:'0 4px' }}>{children}</div>;
}

// ─── FRAME 1 · NOT CONNECTED ────────────────────────────────────────────────

function FrameNotConnected() {
  return (
    <Frame label="Payments · Not connected">
      <TopBar title="Payments"/>
      <Scroll>
        <Intro>Connect Stripe to take payments and get paid out.</Intro>
        <StatusHero headline="Not connected" chip={<Chip tone="neutral">Off</Chip>} body="Pantopus uses Stripe to charge for bookings and pay you out." pills={['off','off','off']}/>
        <AccountCard gated action={<ActionRow icon="external-link" label="Connect Stripe"/>}/>
        <TaxCard gated/>
      </Scroll>
    </Frame>
  );
}

// ─── FRAME 2 · ONBOARDING INCOMPLETE ────────────────────────────────────────

function FrameIncomplete() {
  return (
    <Frame label="Payments · Onboarding incomplete">
      <TopBar title="Payments"/>
      <Scroll>
        <Intro>Verification keeps your payouts flowing.</Intro>
        <StatusHero headline="Setup unfinished" chip={<Chip tone="warning">In review</Chip>} body="A few details are still needed before you can charge." pills={['warn','off','warn']}/>
        <Note tone="warning" icon="alert-triangle">Finish setup on Stripe to start charging.</Note>
        <AccountCard action={<ActionRow icon="arrow-right" label="Resume verification"/>}/>
        <TaxCard/>
      </Scroll>
    </Frame>
  );
}

// ─── FRAME 3 · READY ────────────────────────────────────────────────────────

function FrameReady() {
  return (
    <Frame label="Payments · Ready">
      <TopBar title="Payments"/>
      <Scroll>
        <Intro>Connect Stripe to take payments and get paid out.</Intro>
        <StatusHero headline="Stripe" chip={<Chip tone="success" icon="check">Connected</Chip>} body="Charges and payouts are on. You're ready to take bookings." pills={['on','on','on']}/>
        <AccountCard/>
        <TaxCard/>
      </Scroll>
    </Frame>
  );
}

// ─── FRAME 4 · RESTRICTED / NEEDS VERIFICATION ──────────────────────────────

function FrameRestricted() {
  return (
    <Frame label="Payments · Restricted">
      <TopBar title="Payments"/>
      <Scroll>
        <Intro>Verification keeps your payouts flowing.</Intro>
        <StatusHero headline="Action needed" chip={<Chip tone="error">Restricted</Chip>} body="Charges still work, but payouts are paused until you verify." pills={['on','warn','warn']}/>
        <Note tone="error" icon="shield-alert">Stripe needs more info to keep payouts on.</Note>
        <AccountCard action={<ActionRow icon="arrow-right" label="Finish verification"/>}/>
        <TaxCard/>
      </Scroll>
    </Frame>
  );
}

// ─── FRAME 5 · RETURNED FROM STRIPE (success) ───────────────────────────────

function FrameReturned() {
  return (
    <Frame label="Payments · Returned success">
      <TopBar title="Payments"/>
      <Scroll>
        <div style={{ display:'flex', alignItems:'center', gap:11, padding:'12px 13px', background:C.okBg, border:`1px solid ${C.okBorder}`, borderRadius:14 }}>
          <div style={{ width:34, height:34, borderRadius:'50%', background:C.ok, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i data-lucide="check" style={{ width:18, height:18, strokeWidth:3 }}/></div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.okDk }}>You're set up to take payments.</div>
            <div style={{ fontSize:11, color:C.okDk, opacity:0.85, marginTop:1 }}>Welcome back from Stripe.</div>
          </div>
        </div>
        <StatusHero headline="Stripe" chip={<Chip tone="success" icon="check">Connected</Chip>} body="Charges and payouts are on. You're ready to take bookings." pills={['on','on','on']}/>
        <AccountCard/>
        <TaxCard/>
      </Scroll>
    </Frame>
  );
}

Object.assign(window, { PS_FrameNotConnected:FrameNotConnected, PS_FrameIncomplete:FrameIncomplete, PS_FrameReady:FrameReady, PS_FrameRestricted:FrameRestricted, PS_FrameReturned:FrameReturned });
