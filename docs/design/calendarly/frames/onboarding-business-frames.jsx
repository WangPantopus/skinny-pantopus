// Pantopus — Calendarly · Business scheduling onboarding wizard (booking first-run)
// Lives in: Business pillar Scheduling Hub empty state · src/app/scheduling/setup-business.tsx
// Pillar: Business violet (--color-identity-business). 4 steps: Link · Service · Team · Confirm.
// Reuses the A2 handle field (live availability check + conflict chips), the A12.10
// 2-col tile picker, and the Support-train member-invite rows recolored violet.

const BSTEPS = [
  { n:1, label:'Link' },
  { n:2, label:'Service' },
  { n:3, label:'Team' },
  { n:4, label:'Confirm' },
];

// ─── Business handle field (live check + conflict suggestions) ──

function BizHandleField({ state }) {
  const P = BIZ;
  const taken = state === 'taken';
  const borderColor = taken ? N.errorBorder : N.border;
  return (
    <div>
      <OverlineLabel>Your business link</OverlineLabel>
      <div style={{
        display:'flex', alignItems:'center',
        background:N.surface, border:`1.5px solid ${borderColor}`, borderRadius:8,
        padding:'12px 14px', boxShadow: taken ? 'none' : '0 1px 2px rgba(0,0,0,0.03)',
        fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace',
      }}>
        <span style={{ fontSize:13, color:N.fg3 }}>pantopus.com/book/</span>
        <span style={{ fontSize:13, color:N.fg1, fontWeight:600 }}>acme-co</span>
        <span style={{
          width:1.5, height:16, background:taken?N.error:P.accent, marginLeft:1,
          display:'inline-block', borderRadius:1,
        }}/>
        <span style={{ flex:1 }}/>
        <i data-lucide={taken ? 'circle-alert' : 'pencil'} style={{ width:15, height:15, color: taken?N.error:N.fg4 }}/>
      </div>

      {state === 'available' && (
        <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:8 }}>
          <span style={{
            display:'inline-flex', alignItems:'center', gap:5, padding:'4px 9px', borderRadius:9999,
            background:N.success100, color:N.success700, fontSize:11.5, fontWeight:700,
          }}>
            <i data-lucide="check" style={{ width:12, height:12, strokeWidth:3 }}/> Available
          </span>
          <span style={{ fontSize:11.5, color:N.fg3 }}>Clients will book your business here.</span>
        </div>
      )}

      {state === 'loading' && (
        <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:8 }}>
          <Shimmer w={92} h={22} r={9999}/>
          <Shimmer w={150} h={11} r={3}/>
        </div>
      )}

      {taken && (
        <>
          <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:6 }}>
            <i data-lucide="circle-alert" style={{ width:13, height:13, color:N.error }}/>
            <span style={{ fontSize:12, fontWeight:600, color:N.error }}>That link is taken</span>
          </div>
          <div style={{ marginTop:10 }}>
            <div style={{ fontSize:11, color:N.fg3, marginBottom:7 }}>Try one of these:</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {['acme-co-wa','acme-services','book-acme'].map((s) => (
                <button key={s} style={{
                  display:'inline-flex', alignItems:'center', gap:6, padding:'7px 11px', borderRadius:9999,
                  background:P.bg50, border:`1px solid ${P.bg200}`, color:P.accent700,
                  fontSize:12, fontWeight:600, cursor:'pointer',
                  fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace',
                }}>{s}<i data-lucide="arrow-up-right" style={{ width:12, height:12 }}/></button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Service tile picker (2-col, A12.10 shape) + fields ────────

function ServiceTile({ icon, label, active }) {
  const P = BIZ;
  return (
    <button style={{
      flex:1, padding:'13px 12px', textAlign:'left', cursor:'pointer',
      background:active?P.bg50:N.surface,
      border:`1.5px solid ${active?P.accent:N.border}`, borderRadius:12,
      boxShadow:active?`0 2px 6px ${P.bg200}`:'0 1px 2px rgba(0,0,0,0.03)',
      display:'flex', alignItems:'center', gap:10,
    }}>
      <div style={{
        width:30, height:30, borderRadius:8, flexShrink:0,
        background:active?P.accent:N.sunken, color:active?'#fff':N.fg2,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <i data-lucide={icon} style={{ width:15, height:15, strokeWidth:2.2 }}/>
      </div>
      <div style={{ fontSize:12.5, fontWeight:active?700:600, color:active?P.accent700:N.fg1, letterSpacing:-0.1, lineHeight:'15px' }}>{label}</div>
    </button>
  );
}

function Field({ label, value, mono, prefix, adorn }) {
  return (
    <div style={{ flex:1 }}>
      <OverlineLabel style={{ marginBottom:6 }}>{label}</OverlineLabel>
      <div style={{
        display:'flex', alignItems:'center', gap:6,
        background:N.surface, border:`1px solid ${N.border}`, borderRadius:8,
        padding:'10px 12px', boxShadow:'0 1px 2px rgba(0,0,0,0.03)',
      }}>
        {prefix && <span style={{ fontSize:13.5, color:N.fg3, fontWeight:600 }}>{prefix}</span>}
        <span style={{
          flex:1, fontSize:13.5, color:N.fg1, fontWeight:600, letterSpacing:-0.1,
          fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined,
          fontVariantNumeric:'tabular-nums',
        }}>{value}</span>
        {adorn && <i data-lucide={adorn} style={{ width:14, height:14, color:N.fg4 }}/>}
      </div>
    </div>
  );
}

function ServicePicker() {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div>
        <OverlineLabel>Service type</OverlineLabel>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ display:'flex', gap:8 }}>
            <ServiceTile icon="message-square" label="Consultation" active={true}/>
            <ServiceTile icon="home" label="Quote visit" active={false}/>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <ServiceTile icon="clipboard-check" label="Site survey" active={false}/>
            <ServiceTile icon="wrench" label="Service call" active={false}/>
          </div>
        </div>
      </div>
      <div style={{ display:'flex', gap:10 }}>
        <Field label="Duration" value="30 min" adorn="chevron-down"/>
        <Field label="Price" value="120" prefix="$" mono adorn="pencil"/>
      </div>
    </div>
  );
}

// ─── Team seating (rows with role chips + seat counter) ────────

function RoleChip({ role, P }) {
  const owner = role === 'Owner';
  return (
    <span style={{
      fontSize:9.5, fontWeight:700, letterSpacing:0.04, textTransform:'uppercase',
      padding:'2px 7px', borderRadius:9999,
      background: owner ? P.bg100 : N.sunken,
      color: owner ? P.accent700 : N.fg2,
    }}>{role}</span>
  );
}

function TeamRow({ name, role, initials, grad, on, last }) {
  const P = BIZ;
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:12, padding:'11px 13px',
      borderBottom: last ? 'none' : `1px solid ${N.border}`,
    }}>
      <div style={{
        width:40, height:40, borderRadius:'50%', background:grad, color:'#fff',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:14, fontWeight:700, letterSpacing:-0.3, flexShrink:0,
      }}>{initials}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
          <span style={{ fontSize:14, fontWeight:600, color:N.fg1, letterSpacing:-0.15 }}>{name}</span>
          <RoleChip role={role} P={P}/>
        </div>
        <div style={{ fontSize:11.5, color:N.fg3, marginTop:2 }}>{on ? 'Seated · bookable' : 'Not seated'}</div>
      </div>
      <Toggle P={P} on={on}/>
    </div>
  );
}

function TeamList() {
  const team = [
    { name:'You (Sam R.)', role:'Owner',     initials:'SR', grad:'linear-gradient(135deg, #a78bfa, #7c3aed)', on:true },
    { name:'Priya N.',     role:'Stylist',   initials:'PN', grad:'linear-gradient(135deg, #f472b6, #db2777)', on:true },
    { name:'Marcus L.',    role:'Stylist',   initials:'ML', grad:'linear-gradient(135deg, #38bdf8, #0284c7)', on:true },
    { name:'Dana W.',      role:'Front desk',initials:'DW', grad:'linear-gradient(135deg, #fbbf24, #d97706)', on:false },
  ];
  const P = BIZ;
  return (
    <div>
      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between' }}>
        <OverlineLabel style={{ marginBottom:8 }}>Team seats</OverlineLabel>
        <span style={{ fontSize:11, fontWeight:700, color:P.accent700, fontVariantNumeric:'tabular-nums' }}>3 of 5 seats used</span>
      </div>
      <div style={{
        background:N.surface, border:`1px solid ${N.border}`, borderRadius:12, overflow:'hidden',
        boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
      }}>
        {team.map((m) => <TeamRow key={m.name} {...m} last={false}/>)}
        <button style={{
          display:'flex', alignItems:'center', gap:12, padding:'11px 13px', width:'100%',
          background:'transparent', border:'none', borderTop:`1px solid ${N.border}`, cursor:'pointer', textAlign:'left',
        }}>
          <div style={{
            width:40, height:40, borderRadius:'50%', background:P.bg50, border:`1.5px dashed ${P.bg200}`,
            color:P.accent, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
          }}>
            <i data-lucide="user-plus" style={{ width:17, height:17 }}/>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:700, color:P.accent700, letterSpacing:-0.15 }}>Invite teammate</div>
            <div style={{ fontSize:11.5, color:N.fg3, marginTop:1 }}>2 seats left on your plan</div>
          </div>
          <i data-lucide="chevron-right" style={{ width:16, height:16, color:N.fg4 }}/>
        </button>
      </div>
    </div>
  );
}

// ─── Auto-confirm vs approve (segmented control) ───────────────

function SegmentedMode({ selected }) {
  const P = BIZ;
  const opts = [
    { id:'auto',    label:'Auto-confirm bookings', icon:'zap' },
    { id:'approve', label:'I approve each one',     icon:'user-check' },
  ];
  return (
    <div>
      <OverlineLabel>How bookings get confirmed</OverlineLabel>
      <div style={{
        display:'flex', gap:4, padding:4, background:N.sunken, borderRadius:12,
      }}>
        {opts.map((o) => {
          const active = o.id === selected;
          return (
            <button key={o.id} style={{
              flex:1, height:44, borderRadius:9, cursor:'pointer',
              border: active ? `1.5px solid ${P.accent}` : '1.5px solid transparent',
              background: active ? N.surface : 'transparent',
              color: active ? P.accent700 : N.fg3,
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              fontSize:12.5, fontWeight:active?700:600, letterSpacing:-0.1,
              display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
            }}>
              <i data-lucide={o.icon} style={{ width:14, height:14 }}/>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ApproveExplainer() {
  const P = BIZ;
  return (
    <div style={{
      background:P.bg50, border:`1px solid ${P.bg200}`, borderRadius:12, padding:'12px 14px',
      display:'flex', alignItems:'flex-start', gap:10,
    }}>
      <div style={{
        width:30, height:30, borderRadius:8, flexShrink:0, background:P.accent, color:'#fff',
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <i data-lucide="user-check" style={{ width:15, height:15, strokeWidth:2.2 }}/>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12.5, fontWeight:700, color:P.accent700, letterSpacing:-0.1, marginBottom:2 }}>You approve each booking</div>
        <div style={{ fontSize:12, color:N.fg2, lineHeight:'17px', letterSpacing:-0.05 }}>Requests land in your queue. The slot is held for 24 hours and the client is notified once you confirm.</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BUSINESS FRAME 1 · STEP 1 — claim slug (available)
// ═══════════════════════════════════════════════════════════════

function BizClaim() {
  return (
    <Phone label="Business setup — Step 1 claim link">
      <TopBar title="Business booking" step={1} total={4}/>
      <ScrollArea>
        <PillarChip P={BIZ} icon="briefcase" label="Business"/>
        <StepRail P={BIZ} steps={BSTEPS} current={1}/>
        <Headline title="Claim your business link" sub="This is where clients book you. Pick something short — your business name usually works best." />
        <BizHandleField state="available"/>
      </ScrollArea>
      <StickyBottom>
        <PrimaryBtn P={BIZ} icon="arrow-right" full>Continue · add a service</PrimaryBtn>
      </StickyBottom>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// BUSINESS FRAME 2 · STEP 1 — claim slug (taken + suggestions)
// ═══════════════════════════════════════════════════════════════

function BizClaimConflict() {
  return (
    <Phone label="Business setup — Step 1 link taken">
      <TopBar title="Business booking" step={1} total={4}/>
      <ScrollArea>
        <PillarChip P={BIZ} icon="briefcase" label="Business"/>
        <StepRail P={BIZ} steps={BSTEPS} current={1}/>
        <Headline title="Claim your business link" sub="This is where clients book you. Pick something short — your business name usually works best." />
        <BizHandleField state="taken"/>
      </ScrollArea>
      <StickyBottom>
        <PrimaryBtn P={BIZ} icon="arrow-right" full disabled>Continue · add a service</PrimaryBtn>
      </StickyBottom>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// BUSINESS FRAME 3 · STEP 2 — add first service
// ═══════════════════════════════════════════════════════════════

function BizService() {
  return (
    <Phone label="Business setup — Step 2 first service">
      <TopBar title="Business booking" step={2} total={4}/>
      <ScrollArea>
        <StepRail P={BIZ} steps={BSTEPS} current={2} done={[1]}/>
        <Headline title="Add your first service" sub="Clients pick a service when they book. Start with one — you can add more from settings." />
        <ServicePicker/>
      </ScrollArea>
      <StickyBottom>
        <GhostBtn>Use defaults</GhostBtn>
        <PrimaryBtn P={BIZ} icon="arrow-right" flex={1.5}>Continue</PrimaryBtn>
      </StickyBottom>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// BUSINESS FRAME 4 · STEP 3 — seat the team
// ═══════════════════════════════════════════════════════════════

function BizTeam() {
  return (
    <Phone label="Business setup — Step 3 seat team">
      <TopBar title="Business booking" step={3} total={4}/>
      <ScrollArea>
        <StepRail P={BIZ} steps={BSTEPS} current={3} done={[1,2]}/>
        <Headline title="Seat your team" sub="Seated teammates can take bookings. Front-desk roles manage the calendar without being booked." />
        <TeamList/>
        <ComposedAvailability P={BIZ} body="Booking times come from each seated teammate's personal availability — no one re-enters their hours." />
      </ScrollArea>
      <StickyBottom>
        <GhostBtn>Skip · just me</GhostBtn>
        <PrimaryBtn P={BIZ} icon="arrow-right" flex={1.5}>Continue</PrimaryBtn>
      </StickyBottom>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// BUSINESS FRAME 5 · STEP 4 — auto-confirm vs approve
// ═══════════════════════════════════════════════════════════════

function BizConfirm() {
  return (
    <Phone label="Business setup — Step 4 confirm mode">
      <TopBar title="Business booking" step={4} total={4}/>
      <ScrollArea>
        <StepRail P={BIZ} steps={BSTEPS} current={4} done={[1,2,3]}/>
        <Headline title="Auto-confirm or approve?" sub="Decide what happens when a client picks a time. You can change this any time." />
        <SegmentedMode selected="approve"/>
        <ApproveExplainer/>
      </ScrollArea>
      <StickyBottom>
        <PrimaryBtn P={BIZ} icon="check" full>Finish setup</PrimaryBtn>
      </StickyBottom>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// BUSINESS FRAME 6 — success hero (business booking link)
// ═══════════════════════════════════════════════════════════════

function BizSuccess() {
  return (
    <Phone label="Business setup — success">
      <TopBar title="Business booking" step={4} total={4}/>
      <div style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column', paddingBottom:112 }}>
        <div style={{ padding:'16px 16px 0' }}>
          <StepRail P={BIZ} steps={BSTEPS} current={4} done={[1,2,3,4]}/>
        </div>
        <SuccessHero
          P={BIZ} icon="check"
          title="Acme Co. is taking bookings"
          sub="Your link is live with one service and three seated teammates. You approve each booking before it's confirmed."
          link="pantopus.com/book/acme-co"/>
      </div>
      <StickyBottom>
        <GhostBtn flex={1} icon="plus">Add service</GhostBtn>
        <PrimaryBtn P={BIZ} icon="share-2" flex={1.5}>Share link</PrimaryBtn>
      </StickyBottom>
    </Phone>
  );
}

Object.assign(window, {
  BizClaim, BizClaimConflict, BizService, BizTeam, BizConfirm, BizSuccess,
});
