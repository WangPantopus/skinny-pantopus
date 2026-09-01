// Pantopus — Calendarly · G · Collective Event Setup — 4 frames
// Bottom sheet off the Service Editor (assignment mode "Collective"). Reuses the
// member multi-select + intersection engine; A10.7 seat rows, A12.11 tiles +
// stepper, A10.8 inline-note explainer. Business violet accent. Lucide stroke 2.
//
// Frames: 1 off (collapsed) · 2 on (members chosen) · 3 no-overlap warning ·
// 4 saving.

const { E, SH } = window;
const { C, SheetFrame, Card, Overline, Disc, Checkbox, IToggle, Stepper, Note,
        SeatRow, PrimaryBtn } = window;
const BIZ = C.biz, BIZ_BG = C.bizBg;

const MEMBERS = [
  { name:'Tara Okafor', grad:'linear-gradient(135deg,#a78bfa,#6d28d9)', initials:'TO' },
  { name:'Sam Whitfield', grad:'linear-gradient(135deg,#38bdf8,#0369a1)', initials:'SW' },
  { name:'Dana Reyes', grad:'linear-gradient(135deg,#34d399,#047857)', initials:'DR' },
];

function MasterToggle({ on }) {
  return (
    <Card pad="12px 13px">
      <div style={{ display:'flex', alignItems:'center', gap:11 }}>
        <div style={{ width:34, height:34, borderRadius:9, flexShrink:0, background:on?BIZ_BG:E.sunken, color:on?BIZ:E.fg3, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <i data-lucide="users-round" style={{ width:17, height:17 }}/>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13.5, fontWeight:700, color:E.fg1, letterSpacing:-0.1 }}>Require multiple staff</div>
          <div style={{ fontSize:11, color:E.fg3, marginTop:1, lineHeight:'14px' }}>Several members must be free at once.</div>
        </div>
        <IToggle on={on} color={BIZ}/>
      </div>
    </Card>
  );
}

function Tiles({ value }) {
  const opts = [
    { k:'Specific members', icon:'user-check' },
    { k:'Any N of a group', icon:'users' },
  ];
  return (
    <div style={{ display:'flex', gap:8 }}>
      {opts.map(o => {
        const on = o.k === value;
        return (
          <button key={o.k} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'flex-start', gap:7, padding:'11px 11px', borderRadius:13, cursor:'pointer', textAlign:'left', border:`${on?1.5:1}px solid ${on?BIZ:E.border}`, background:on?BIZ_BG:E.surface }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%' }}>
              <i data-lucide={o.icon} style={{ width:17, height:17, color:on?BIZ:E.fg3 }}/>
              {on && <i data-lucide="check" style={{ width:14, height:14, color:BIZ, strokeWidth:3 }}/>}
            </div>
            <span style={{ fontSize:11.5, fontWeight:700, color:E.fg1, lineHeight:'14px' }}>{o.k}</span>
          </button>
        );
      })}
    </div>
  );
}

function CountCard({ label, value, sub }) {
  return (
    <Card pad="11px 13px">
      <div style={{ display:'flex', alignItems:'center', gap:11 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:600, color:E.fg1 }}>{label}</div>
          {sub && <div style={{ fontSize:11, color:E.fg3, marginTop:1 }}>{sub}</div>}
        </div>
        <Stepper value={value} accent={BIZ}/>
      </div>
    </Card>
  );
}

function DimWrap({ on, children }) {
  return <div style={{ opacity:on?1:0.4, pointerEvents:on?'auto':'none', display:'flex', flexDirection:'column', gap:12 }}>{children}</div>;
}

const EXPLAIN = 'Times come from where every required member is free. Fewer common openings means fewer slots.';

// ─── FRAME 1 · OFF (default, collapsed) ─────────────────────────────────────

function FrameOff() {
  return (
    <SheetFrame label="Collective · Off" title="Collective booking" subhead="Every required member must be free at the same time."
      footer={<PrimaryBtn>Save</PrimaryBtn>}>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <MasterToggle on={false}/>
        <Note tone="info" icon="info">Turn on if a booking needs more than one person.</Note>
      </div>
    </SheetFrame>
  );
}

// ─── FRAME 2 · ON (members chosen) ──────────────────────────────────────────

function FrameOn() {
  return (
    <SheetFrame label="Collective · On" title="Collective booking" subhead="Every required member must be free at the same time."
      footer={<PrimaryBtn>Save</PrimaryBtn>}>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <MasterToggle on/>
        <DimWrap on>
          <CountCard label="Required staff" value="2" sub="How many must be free"/>
          <Tiles value="Specific members"/>
          <div>
            <Overline color={BIZ}>Members</Overline>
            <div style={{ marginTop:8 }}>
              <Card>
                {MEMBERS.map((m, i) => (
                  <SeatRow key={m.name} {...m} checked={i<2} last={i===MEMBERS.length-1}/>
                ))}
              </Card>
            </div>
          </div>
          <CountCard label="Seats per appointment" value="1" sub="Capacity for each slot"/>
          <Note tone="info" icon="git-merge">{EXPLAIN}</Note>
        </DimWrap>
      </div>
    </SheetFrame>
  );
}

// ─── FRAME 3 · NO OVERLAP (warning, Save still enabled) ─────────────────────

function FrameNoOverlap() {
  return (
    <SheetFrame label="Collective · No overlap" title="Collective booking" subhead="Every required member must be free at the same time."
      footer={<PrimaryBtn>Save</PrimaryBtn>}>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <MasterToggle on/>
        <CountCard label="Required staff" value="2" sub="How many must be free"/>
        <Tiles value="Specific members"/>
        <Note tone="warning" icon="alert-triangle">Tara and Sam have no shared openings this week. Widen their hours or drop a member.</Note>
        <div>
          <Overline color={BIZ}>Members</Overline>
          <div style={{ marginTop:8 }}>
            <Card>
              {MEMBERS.map((m, i) => (
                <SeatRow key={m.name} {...m} checked={i<2} last={i===MEMBERS.length-1}/>
              ))}
            </Card>
          </div>
        </div>
      </div>
    </SheetFrame>
  );
}

// ─── FRAME 4 · SAVING ───────────────────────────────────────────────────────

function FrameSaving() {
  return (
    <SheetFrame label="Collective · Saving" title="Collective booking" subhead="Every required member must be free at the same time."
      footer={<PrimaryBtn saving>Saving</PrimaryBtn>}>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <MasterToggle on/>
        <CountCard label="Required staff" value="2" sub="How many must be free"/>
        <Tiles value="Specific members"/>
        <div>
          <Overline color={BIZ}>Members</Overline>
          <div style={{ marginTop:8 }}>
            <Card>
              {MEMBERS.map((m, i) => (
                <SeatRow key={m.name} {...m} checked={i<2} last={i===MEMBERS.length-1}/>
              ))}
            </Card>
          </div>
        </div>
        <CountCard label="Seats per appointment" value="1" sub="Capacity for each slot"/>
        <Note tone="info" icon="git-merge">{EXPLAIN}</Note>
      </div>
    </SheetFrame>
  );
}

Object.assign(window, { CO_FrameOff:FrameOff, CO_FrameOn:FrameOn, CO_FrameNoOverlap:FrameNoOverlap, CO_FrameSaving:FrameSaving });
