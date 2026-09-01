// Pantopus — Calendarly · G · Business Scheduling Settings — 5 frames
// "Booking" settings section inside the Settings tab. Matches A14.6 grouped
// chevron-row cards exactly. Business violet accent on overlines + active
// segmented state; CTA chips stay sky.
//
// Frames: 1 saved (default) · 2 loading (shimmer) · 3 auto-confirm-on (hides
// Requests) · 4 payments-required (Stripe gate) · 5 permission-gated.

const { E, SH } = window;
const { C, Frame, TopBar, Scroll, Overline, Card, IToggle, Chip, Note, SRow, Sk } = window;
const BIZ = C.biz, BIZ_BG = C.bizBg;

function Group({ title, children }) {
  return <div><Overline color={BIZ}>{title}</Overline><div style={{ marginTop:8 }}><Card>{children}</Card></div></div>;
}

function SegConfirm({ value }) {
  const opts = ['Auto-confirm', 'Approve each request'];
  return (
    <div style={{ display:'flex', gap:3, padding:3, background:E.sunken, borderRadius:9, margin:'8px 0 9px' }}>
      {opts.map(o => {
        const on = o === value;
        return <button key={o} style={{ flex:1, height:32, borderRadius:7, border:'none', cursor:'pointer', background:on?'#fff':'transparent', color:on?BIZ:E.fg3, boxShadow:on?'0 1px 2px rgba(0,0,0,0.08)':'none', fontSize:11, fontWeight:on?700:600, whiteSpace:'nowrap' }}>{o}</button>;
      })}
    </div>
  );
}

function ConfirmCard({ mode, gated }) {
  const approve = mode === 'approve';
  return (
    <div>
      <Overline color={BIZ}>Confirmation</Overline>
      <div style={{ marginTop:8 }}>
        <Card pad="11px 13px">
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:2 }}>
            <div style={{ width:32, height:32, borderRadius:9, background:BIZ_BG, color:BIZ, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i data-lucide="calendar-check" style={{ width:16, height:16 }}/></div>
            <div style={{ fontSize:13, fontWeight:600, color:E.fg1 }}>New bookings</div>
          </div>
          <div style={{ opacity:gated?0.55:1 }}><SegConfirm value={approve?'Approve each request':'Auto-confirm'}/></div>
          <div style={{ fontSize:10.5, color:E.fg3, lineHeight:'14px', paddingLeft:2 }}>{approve ? 'You approve each request before it lands on your calendar.' : 'Auto-confirm sends the booking straight to your calendar.'}</div>
          {approve && (
            <div style={{ marginTop:9, borderTop:`1px solid ${E.border}`, paddingTop:2 }}>
              <SRow icon="hourglass" label="Approval window" sub="24h to respond" trailing={gated?null:undefined} last/>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Chevron({ gated }) { return gated ? null : <i data-lucide="chevron-right" style={{ width:16, height:16, color:E.fg4, flexShrink:0 }}/>; }

function Scheduling({ gated }) {
  return (
    <Group title="Scheduling">
      <SRow icon="clock" label="Minimum notice" sub="4 hours" trailing={<Chevron gated={gated}/>}/>
      <SRow icon="calendar-range" label="Booking horizon" sub="60 days out" trailing={<Chevron gated={gated}/>}/>
      <SRow icon="git-commit-horizontal" label="Buffers" sub="10 min before · 10 after" trailing={<Chevron gated={gated}/>}/>
      <SRow icon="globe" label="Time zone" sub="America/Los_Angeles" trailing={<Chevron gated={gated}/>} last/>
    </Group>
  );
}

function Policy({ gated }) {
  return (
    <Group title="Policy">
      <SRow icon="shield" label="Cancellation & no-show policy" sub="Flexible · 24h" trailing={<Chevron gated={gated}/>} last/>
    </Group>
  );
}

function Notifs({ gated }) {
  return (
    <Group title="Notifications">
      <SRow icon="bell" label="Notify the owner" trailing={<IToggle on color={BIZ} disabled={gated}/>}/>
      <SRow icon="user-check" label="Notify the assigned member" trailing={<IToggle on={false} color={BIZ} disabled={gated}/>} last/>
    </Group>
  );
}

function Payments({ state }) {
  if (state === 'connect') {
    return (
      <Group title="Payments">
        <SRow icon="credit-card" iconBg={C.stripeBg} iconColor={C.stripe} label="Stripe payments" sub="Not connected"
          trailing={<button style={{ height:28, padding:'0 13px', borderRadius:9999, border:'none', background:E.blue600, color:'#fff', fontSize:11.5, fontWeight:700, cursor:'pointer' }}>Connect</button>} last/>
      </Group>
    );
  }
  return (
    <Group title="Payments">
      <SRow icon="credit-card" iconBg={C.stripeBg} iconColor={C.stripe} label="Stripe payments" sub="Payout to ••4291"
        trailing={<div style={{ display:'flex', alignItems:'center', gap:7 }}><Chip tone="success" icon="check">Connected</Chip><i data-lucide="chevron-right" style={{ width:16, height:16, color:E.fg4 }}/></div>} last/>
    </Group>
  );
}

function Intro() {
  return <div style={{ fontSize:11.5, color:E.fg3, lineHeight:'16px', padding:'0 4px' }}>Defaults flow into each service — change them per service anytime.</div>;
}

// ─── FRAME 1 · SAVED (default) ──────────────────────────────────────────────

function FrameSaved() {
  return (
    <Frame label="Booking settings · Saved">
      <TopBar title="Booking"/>
      <Scroll>
        <Intro/>
        <ConfirmCard mode="approve"/>
        <Scheduling/>
        <Policy/>
        <Notifs/>
        <Payments state="connected"/>
      </Scroll>
    </Frame>
  );
}

// ─── FRAME 2 · LOADING ──────────────────────────────────────────────────────

function ShimGroup({ rows=3 }) {
  return (
    <div>
      <Sk w={90} h={9} mt={0}/>
      <div style={{ marginTop:8 }}><Card>
        {Array.from({length:rows}).map((_, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:11, padding:'13px 2px', borderBottom: i===rows-1?'none':`1px solid ${E.border}` }}>
            <div style={{ width:32, height:32, borderRadius:9, ...SH }}/>
            <div style={{ flex:1 }}><Sk w="44%" h={11}/><Sk w="60%" h={8} mt={6}/></div>
          </div>
        ))}
      </Card></div>
    </div>
  );
}

function FrameLoading() {
  return (
    <Frame label="Booking settings · Loading">
      <TopBar title="Booking"/>
      <Scroll>
        <Intro/>
        <ShimGroup rows={1}/>
        <ShimGroup rows={4}/>
        <ShimGroup rows={2}/>
      </Scroll>
    </Frame>
  );
}

// ─── FRAME 3 · AUTO-CONFIRM ON (hides Requests) ─────────────────────────────

function FrameAuto() {
  return (
    <Frame label="Booking settings · Auto-confirm">
      <TopBar title="Booking"/>
      <Scroll>
        <Intro/>
        <ConfirmCard mode="auto"/>
        <Scheduling/>
        <Policy/>
        <Notifs/>
        <Payments state="connected"/>
      </Scroll>
    </Frame>
  );
}

// ─── FRAME 4 · PAYMENTS REQUIRED ────────────────────────────────────────────

function FramePayments() {
  return (
    <Frame label="Booking settings · Payments required">
      <TopBar title="Booking"/>
      <Scroll>
        <Intro/>
        <ConfirmCard mode="approve"/>
        <Scheduling/>
        <Payments state="connect"/>
        <Note tone="warning" icon="alert-triangle">Connect payments to charge for services.</Note>
      </Scroll>
    </Frame>
  );
}

// ─── FRAME 5 · PERMISSION GATED ─────────────────────────────────────────────

function FrameGated() {
  return (
    <Frame label="Booking settings · Gated">
      <TopBar title="Booking"/>
      <Scroll>
        <Intro/>
        <ConfirmCard mode="approve" gated/>
        <div style={{ opacity:0.7 }}><Scheduling gated/></div>
        <div style={{ opacity:0.7 }}><Notifs gated/></div>
        <div style={{ display:'flex', alignItems:'center', gap:7, padding:'2px 4px', color:E.fg4 }}>
          <i data-lucide="lock" style={{ width:13, height:13 }}/>
          <span style={{ fontSize:11, fontWeight:500 }}>Only admins can change booking settings.</span>
        </div>
      </Scroll>
    </Frame>
  );
}

Object.assign(window, { BS_FrameSaved:FrameSaved, BS_FrameLoading:FrameLoading, BS_FrameAuto:FrameAuto, BS_FramePayments:FramePayments, BS_FrameGated:FrameGated });
