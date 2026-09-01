// Pantopus — Calendarly · Home scheduling onboarding wizard (family first-run)
// Lives in: Home pillar Scheduling Hub empty state · src/app/scheduling/setup-home.tsx
// Pillar: Home green (--color-identity-home). 3 steps: Members · Combine · Share.
// Reuses the Support-train member-invite step (toggle rows + invite row) and the
// A12.11 2-col tile picker for the collective/round-robin mode choice.

const HSTEPS = [
  { n:1, label:'Members' },
  { n:2, label:'Combine' },
  { n:3, label:'Share' },
];

// ─── Household member multi-select (reused from Support Train invite step) ──

function MemberRow({ name, rel, initials, grad, on, last }) {
  const P = HOME;
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:12, padding:'11px 13px',
      borderBottom: last ? 'none' : `1px solid ${N.border}`,
    }}>
      <div style={{
        width:40, height:40, borderRadius:'50%', background:grad, color:'#fff',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:14, fontWeight:700, letterSpacing:-0.3, flexShrink:0, position:'relative',
      }}>
        {initials}
        <div style={{
          position:'absolute', bottom:-2, right:-2, width:16, height:16, borderRadius:'50%',
          background:N.success600, color:'#fff', border:'2px solid #fff',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <i data-lucide="check" style={{ width:9, height:9, strokeWidth:3.5 }}/>
        </div>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:14, fontWeight:600, color:N.fg1, letterSpacing:-0.15 }}>{name}</div>
        <div style={{ fontSize:11.5, color:N.fg3, marginTop:1 }}>{rel}</div>
      </div>
      <Toggle P={P} on={on}/>
    </div>
  );
}

function MemberList() {
  const members = [
    { name:'You (Maria)',   rel:'Verified · household admin', initials:'MK', grad:'linear-gradient(135deg, #34d399, #16a34a)', on:true },
    { name:'David Kowalski',rel:'Verified household member',  initials:'DK', grad:'linear-gradient(135deg, #60a5fa, #2563eb)', on:true },
    { name:'Lena Kowalski', rel:'Verified household member',  initials:'LK', grad:'linear-gradient(135deg, #f472b6, #db2777)', on:true },
    { name:'Tomek Kowalski',rel:'Verified · teen',            initials:'TK', grad:'linear-gradient(135deg, #fbbf24, #d97706)', on:false },
  ];
  const P = HOME;
  return (
    <div>
      <OverlineLabel>Household members</OverlineLabel>
      <div style={{
        background:N.surface, border:`1px solid ${N.border}`, borderRadius:12, overflow:'hidden',
        boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
      }}>
        {members.map((m, i) => <MemberRow key={m.name} {...m} last={false}/>)}
        {/* Invite-someone row */}
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
            <div style={{ fontSize:14, fontWeight:700, color:P.accent700, letterSpacing:-0.15 }}>Invite someone</div>
            <div style={{ fontSize:11.5, color:N.fg3, marginTop:1 }}>Add a family member by phone or email</div>
          </div>
          <i data-lucide="chevron-right" style={{ width:16, height:16, color:N.fg4 }}/>
        </button>
      </div>
    </div>
  );
}

// ─── Mode tile diagrams ────────────────────────────────────────

function CollectiveGlyph({ active }) {
  const c = active ? HOME.accent : N.fg4;
  return (
    <svg width="40" height="26" viewBox="0 0 40 26" fill="none">
      <circle cx="15" cy="13" r="9.5" stroke={c} strokeWidth="1.6" opacity="0.55"/>
      <circle cx="25" cy="13" r="9.5" stroke={c} strokeWidth="1.6" opacity="0.55"/>
      <path d="M20 5.2a9.5 9.5 0 0 1 0 15.6 9.5 9.5 0 0 1 0-15.6Z" fill={c} fillOpacity={active?0.9:0.35}/>
    </svg>
  );
}

function RoundRobinGlyph({ active }) {
  const c = active ? HOME.accent : N.fg4;
  return (
    <svg width="40" height="26" viewBox="0 0 40 26" fill="none">
      <circle cx="9" cy="13" r="4.5" fill={c} fillOpacity={active?0.9:0.4}/>
      <circle cx="20" cy="13" r="4.5" fill={c} fillOpacity="0.3"/>
      <circle cx="31" cy="13" r="4.5" fill={c} fillOpacity="0.3"/>
      <path d="M14 13h2.5M25 13h2" stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M9 5.5a7.5 7.5 0 0 1 0 15" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeDasharray="2 2.4" opacity="0.6"/>
    </svg>
  );
}

function ModeTile({ mode, title, line, glyph, active }) {
  const P = HOME;
  return (
    <button style={{
      flex:1, padding:'14px 13px', textAlign:'left', cursor:'pointer',
      background:active?P.bg50:N.surface,
      border:`1.5px solid ${active?P.accent:N.border}`, borderRadius:12,
      boxShadow:active?`0 2px 8px ${P.bg200}`:'0 1px 2px rgba(0,0,0,0.03)',
      display:'flex', flexDirection:'column', gap:9, position:'relative',
    }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        {glyph}
        <div style={{
          width:18, height:18, borderRadius:'50%', flexShrink:0,
          border:`1.5px solid ${active?P.accent:N.borderStrong}`, background:active?P.accent:'transparent',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          {active && <i data-lucide="check" style={{ width:11, height:11, color:'#fff', strokeWidth:3 }}/>}
        </div>
      </div>
      <div>
        <div style={{ fontSize:13.5, fontWeight:700, color:active?P.accent700:N.fg1, letterSpacing:-0.15 }}>{title}</div>
        <div style={{ fontSize:11.5, color:N.fg3, lineHeight:'16px', marginTop:3 }}>{line}</div>
      </div>
    </button>
  );
}

function ModePicker({ selected }) {
  return (
    <div>
      <OverlineLabel>How times combine</OverlineLabel>
      <div style={{ display:'flex', gap:10 }}>
        <ModeTile
          mode="collective" title="Collective"
          line="Everyone must be free. Times are the overlap of all selected members."
          glyph={<CollectiveGlyph active={selected==='collective'}/>}
          active={selected==='collective'}/>
        <ModeTile
          mode="round-robin" title="Round-robin"
          line="Whoever's free gets the booking. Times are the union, assigned by a rule."
          glyph={<RoundRobinGlyph active={selected==='round-robin'}/>}
          active={selected==='round-robin'}/>
      </div>
    </div>
  );
}

// Round-robin assignment rule (only shows when round-robin is picked).
function RoundRobinRule() {
  const P = HOME;
  return (
    <div>
      <OverlineLabel>Assignment rule</OverlineLabel>
      <div style={{
        background:N.surface, border:`1px solid ${N.border}`, borderRadius:12, overflow:'hidden',
      }}>
        {[
          { label:'Balanced — even out who hosts', icon:'scale', on:true },
          { label:'By priority order', icon:'list-ordered', on:false },
        ].map((r, i, arr) => (
          <div key={r.label} style={{
            display:'flex', alignItems:'center', gap:11, padding:'11px 13px',
            borderBottom: i < arr.length-1 ? `1px solid ${N.border}` : 'none',
          }}>
            <div style={{
              width:28, height:28, borderRadius:8, flexShrink:0,
              background:r.on?P.bg50:N.sunken, color:r.on?P.accent:N.fg3,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <i data-lucide={r.icon} style={{ width:14, height:14, strokeWidth:2.2 }}/>
            </div>
            <div style={{ flex:1, fontSize:13, fontWeight:600, color:N.fg1, letterSpacing:-0.1 }}>{r.label}</div>
            <div style={{
              width:18, height:18, borderRadius:'50%', flexShrink:0,
              border:`1.5px solid ${r.on?P.accent:N.borderStrong}`, background:r.on?P.accent:'transparent',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              {r.on && <div style={{ width:7, height:7, borderRadius:'50%', background:'#fff' }}/>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HOME FRAME 1 · STEP 1 — Choose who's scheduled
// ═══════════════════════════════════════════════════════════════

function HomeMembers() {
  return (
    <Phone label="Home setup — Step 1 pick members">
      <TopBar title="Family scheduling" step={1} total={3}/>
      <ScrollArea>
        <PillarChip P={HOME} icon="house" label="Home"/>
        <StepRail P={HOME} steps={HSTEPS} current={1}/>
        <Headline title="Choose who's scheduled" sub="Pick the household members people can book. Family scheduling uses everyone's own hours — no one sets times twice." />
        <MemberList/>
      </ScrollArea>
      <StickyBottom>
        <PrimaryBtn P={HOME} icon="arrow-right" full>Continue · 3 selected</PrimaryBtn>
      </StickyBottom>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// HOME FRAME 2 · STEP 2 — Collective selected
// ═══════════════════════════════════════════════════════════════

function HomeCollective() {
  return (
    <Phone label="Home setup — Step 2 collective">
      <TopBar title="Family scheduling" step={2} total={3}/>
      <ScrollArea>
        <StepRail P={HOME} steps={HSTEPS} current={2} done={[1]}/>
        <Headline title="How should times combine?" sub="Three members are scheduled. Choose how their availability turns into one set of bookable times." />
        <ModePicker selected="collective"/>
        <ComposedAvailability P={HOME} body="Times come from each member's personal availability — you're not setting hours twice." />
      </ScrollArea>
      <StickyBottom>
        <GhostBtn>Use defaults</GhostBtn>
        <PrimaryBtn P={HOME} icon="arrow-right" flex={1.5}>Continue</PrimaryBtn>
      </StickyBottom>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// HOME FRAME 3 · STEP 2 — Round-robin selected (rule appears)
// ═══════════════════════════════════════════════════════════════

function HomeRoundRobin() {
  return (
    <Phone label="Home setup — Step 2 round-robin">
      <TopBar title="Family scheduling" step={2} total={3}/>
      <ScrollArea>
        <StepRail P={HOME} steps={HSTEPS} current={2} done={[1]}/>
        <Headline title="How should times combine?" sub="Whoever's free gets the booking. Pick a rule for who hosts when more than one person is open." />
        <ModePicker selected="round-robin"/>
        <RoundRobinRule/>
        <ComposedAvailability P={HOME} body="Times come from each member's personal availability — you're not setting hours twice." />
      </ScrollArea>
      <StickyBottom>
        <GhostBtn>Use defaults</GhostBtn>
        <PrimaryBtn P={HOME} icon="arrow-right" flex={1.5}>Continue</PrimaryBtn>
      </StickyBottom>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// HOME FRAME 4 · STEP 3 — Success hero (family booking link)
// ═══════════════════════════════════════════════════════════════

function HomeSuccess() {
  return (
    <Phone label="Home setup — Step 3 success">
      <TopBar title="Family scheduling" step={3} total={3}/>
      <div style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column', paddingBottom:112 }}>
        <div style={{ padding:'16px 16px 0' }}>
          <StepRail P={HOME} steps={HSTEPS} current={3} done={[1,2,3]}/>
        </div>
        <SuccessHero
          P={HOME} icon="check"
          title="Your family link is live"
          sub="Share it and people can book any free member during their own hours. Bookings show up on the family schedule."
          link="pantopus.com/book/kowalski-home"/>
      </div>
      <StickyBottom>
        <GhostBtn flex={1} icon="users">Members</GhostBtn>
        <PrimaryBtn P={HOME} icon="share-2" flex={1.5}>Share link</PrimaryBtn>
      </StickyBottom>
    </Phone>
  );
}

Object.assign(window, { HomeMembers, HomeCollective, HomeRoundRobin, HomeSuccess });
