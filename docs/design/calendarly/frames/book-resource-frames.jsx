// F12 — Book a Resource (flow, sheet, v2) · 300×620 · Home green
// SlotRow + Support-train reservation; approval reuses A18 Waiting for Approval.
// Frames: default · conflict · violates-rule · submitting · confirmed · approval-requested

const { N, H, M } = window;
const { Sheet, SheetBar, SheetBody, Card, Overline, Avatar, PrimaryBtn, StickyFooter, Field } = window;

function RulesReminder() {
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
      {['4 hr max', 'No approval', 'All members'].map((c, i) => (
        <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'4px 9px', borderRadius:9999, background:N.sunken, color:N.fg3, fontSize:10.5, fontWeight:600 }}><i data-lucide={['timer','check','users'][i]} style={{ width:11, height:11 }}/>{c}</span>
      ))}
    </div>
  );
}

const HOURS = ['8a','9a','10a','11a','12p','1p','2p','3p','4p','5p','6p','7p'];

function TimeGrid({ states }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:6 }}>
      {HOURS.map((h, i) => {
        const s = states[i];
        let style = { height:34, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11.5, fontWeight:700, cursor:'pointer', border:'1px solid transparent' };
        if (s === 'sel') { style.background = H.accent; style.color = '#fff'; }
        else if (s === 'selErr') { style.background = N.errorBg; style.color = N.error; style.border = `1px solid ${N.error}`; }
        else if (s === 'taken') { style.background = N.sunken; style.color = N.fg4; style.textDecoration = 'line-through'; style.cursor = 'not-allowed'; }
        else if (s === 'off') { style.background = '#f9fafb'; style.color = N.fg4; style.opacity = 0.5; style.cursor = 'not-allowed'; }
        else { style.background = N.surface; style.color = N.fg2; style.border = `1px solid ${N.border}`; }
        return <div key={i} style={style}>{h}</div>;
      })}
    </div>
  );
}

function ConflictLine({ tone, text }) {
  const map = { ok:{ c:N.success, bg:N.successBg, ic:'check-circle-2' }, err:{ c:N.error, bg:N.errorBg, ic:'circle-x' }, warn:{ c:N.warning, bg:N.warningBg, ic:'triangle-alert' } }[tone];
  return (
    <div style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 11px', background:map.bg, borderRadius:9, marginTop:10 }}>
      <i data-lucide={map.ic} style={{ width:14, height:14, color:map.c, flexShrink:0 }}/>
      <span style={{ fontSize:11.5, fontWeight:600, color:map.c }}>{text}</span>
    </div>
  );
}

function DateRow() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 2px 11px' }}>
      <i data-lucide="chevron-left" style={{ width:18, height:18, color:N.fg4 }}/>
      <span style={{ fontSize:13.5, fontWeight:700, color:N.fg1 }}>Sat · Jun 21</span>
      <i data-lucide="chevron-right" style={{ width:18, height:18, color:N.fg3 }}/>
    </div>
  );
}

function ForWhom({ m, name='Dad' }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 11px', background:N.surface, border:`1px solid ${N.border}`, borderRadius:10, cursor:'pointer' }}>
      <Avatar m={m} size={28}/>
      <span style={{ flex:1, fontSize:13, fontWeight:600, color:N.fg1 }}>{name}</span>
      <i data-lucide="chevron-down" style={{ width:16, height:16, color:N.fg4 }}/>
    </div>
  );
}

function Section({ overline, children }) {
  return <Card><Overline color={H.accent700} style={{ marginBottom:9 }}>{overline}</Overline>{children}</Card>;
}

const FREE = ['free','sel','sel','free','free','free','taken','taken','free','free','free','off'];

// ─── FRAME 1 · DEFAULT ─────────────────────────────────────────
function FrameDefault() {
  return (
    <Sheet label="Book resource · Default">
      <SheetBar title="Book EV charger" action="Submit"/>
      <SheetBody>
        <RulesReminder/>
        <Section overline="When"><DateRow/><TimeGrid states={FREE}/><ConflictLine tone="ok" text="This slot is free · 9–11 AM"/></Section>
        <Section overline="For whom"><ForWhom m={M.dad} name="Dad"/></Section>
        <Section overline="Notes"><Field placeholder="Add a note (optional)" multiline/></Section>
      </SheetBody>
      <StickyFooter><PrimaryBtn icon="check">Submit booking</PrimaryBtn></StickyFooter>
    </Sheet>
  );
}

// ─── FRAME 2 · CONFLICT ────────────────────────────────────────
function FrameConflict() {
  const states = ['free','free','free','free','free','free','selErr','selErr','free','free','free','off'];
  return (
    <Sheet label="Book resource · Conflict">
      <SheetBar title="Book EV charger" action="Submit" actionDisabled/>
      <SheetBody>
        <RulesReminder/>
        <Section overline="When"><DateRow/><TimeGrid states={states}/><ConflictLine tone="err" text="Taken — Dad has it 2–4 PM · pick another time"/></Section>
        <Section overline="For whom"><ForWhom m={M.mom} name="Mom"/></Section>
      </SheetBody>
      <StickyFooter><PrimaryBtn icon="check" disabled>Submit booking</PrimaryBtn></StickyFooter>
    </Sheet>
  );
}

// ─── FRAME 3 · VIOLATES-RULE ───────────────────────────────────
function FrameViolates() {
  const states = ['sel','sel','sel','sel','sel','free','taken','taken','free','free','free','off'];
  return (
    <Sheet label="Book resource · Violates rule">
      <SheetBar title="Book EV charger" action="Submit" actionDisabled/>
      <SheetBody>
        <RulesReminder/>
        <Section overline="When"><DateRow/><TimeGrid states={states}/><ConflictLine tone="warn" text="That's longer than the 4 hr max"/></Section>
        <Section overline="For whom"><ForWhom m={M.dad} name="Dad"/></Section>
      </SheetBody>
      <StickyFooter><PrimaryBtn icon="check" disabled>Submit booking</PrimaryBtn></StickyFooter>
    </Sheet>
  );
}

// ─── FRAME 4 · SUBMITTING ──────────────────────────────────────
function FrameSubmitting() {
  return (
    <Sheet label="Book resource · Submitting">
      <SheetBar title="Book EV charger" action="Submit" actionSaving/>
      <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
        <div style={{ opacity:0.45, pointerEvents:'none' }}>
          <SheetBody pad="12px 14px 20px">
            <RulesReminder/>
            <Section overline="When"><DateRow/><TimeGrid states={FREE}/></Section>
          </SheetBody>
        </div>
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, background:'rgba(255,255,255,0.9)', padding:'18px 24px', borderRadius:16, boxShadow:'0 8px 24px rgba(0,0,0,0.1)' }}>
            <i data-lucide="loader-circle" style={{ width:26, height:26, color:H.accent, animation:'sh-spin 0.8s linear infinite' }}/>
            <span style={{ fontSize:12.5, fontWeight:600, color:N.fg2 }}>Booking the charger</span>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function SuccessSheet({ label, icon, tone, title, body, note }) {
  const c = tone==='warn'?N.warning:H.accent;
  const cbg = tone==='warn'?N.warningBg:H.bg50;
  const cbg2 = tone==='warn'?N.warningLight:H.bg100;
  const shadow = tone==='warn'?'rgba(217,119,6,0.28)':H.shadow;
  return (
    <Sheet label={label}>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'24px 28px' }}>
        <div style={{ position:'relative', width:84, height:84, marginBottom:20 }}>
          <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:`radial-gradient(circle at 30% 30%, ${cbg}, ${cbg2})` }}/>
          <div style={{ position:'absolute', inset:16, borderRadius:'50%', background:c, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 8px 20px ${shadow}` }}><i data-lucide={icon} style={{ width:28, height:28, color:'#fff', strokeWidth:2.6 }}/></div>
        </div>
        <div style={{ fontSize:18, fontWeight:700, color:N.fg1, letterSpacing:-0.3 }}>{title}</div>
        <div style={{ fontSize:13, color:N.fg3, lineHeight:'19px', maxWidth:240, marginTop:7 }}>{body}</div>
        {note && <div style={{ marginTop:14, display:'inline-flex', alignItems:'center', gap:6, padding:'7px 12px', borderRadius:9999, background:H.bg50, color:H.accent700, fontSize:11.5, fontWeight:700 }}><i data-lucide="calendar-check" style={{ width:13, height:13 }}/>{note}</div>}
        <div style={{ marginTop:18, width:'100%' }}><PrimaryBtn icon="house">Back to calendar</PrimaryBtn></div>
      </div>
    </Sheet>
  );
}

// ─── FRAME 5 · CONFIRMED ───────────────────────────────────────
function FrameConfirmed() {
  return <SuccessSheet label="Book resource · Confirmed" icon="check" tone="ok" title="Booked" body="EV charger · Sat 9–11 AM" note="Added to the home calendar"/>;
}

// ─── FRAME 6 · APPROVAL-REQUESTED ──────────────────────────────
function FrameApproval() {
  return <SuccessSheet label="Book resource · Approval requested" icon="clock" tone="warn" title="Request sent to an admin" body="We'll notify you when your booking is approved." note="EV charger · Sat 9–11 AM"/>;
}

Object.assign(window, { FrameDefault, FrameConflict, FrameViolates, FrameSubmitting, FrameConfirmed, FrameApproval });
