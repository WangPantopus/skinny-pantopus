// Pantopus — Calendarly · G · Create / Edit Package (owner) — 4 frames
// One scrolling Form (not a wizard) with live per-session math. Reuses A14.6
// form rows + currency, A12.11 selectable tiles + steppers, A10.8 "keep terms"
// framing. Business violet accent.
//
// Frames: 1 create (defaults) · 2 edit (price change → new Stripe price) ·
// 3 validation error · 4 has-active-buyers (locks sessions + eligibility).

const { E } = window;
const { Phone, TopBar, Body, Card, TextInput, Stepper, Segmented, ToggleRow, SaveBar } = window;
const { C, Note } = window;
const BIZ = C.biz, BIZ_BG = C.bizBg;

function EventTile({ name, dur, on, locked }) {
  return (
    <button disabled={locked} style={{ flex:'1 1 calc(50% - 4px)', minWidth:0, textAlign:'left', display:'flex', flexDirection:'column', gap:5, padding:'10px 11px', borderRadius:12, cursor:locked?'default':'pointer', border:`${on?1.5:1}px solid ${on?BIZ:E.border}`, background:on?BIZ_BG:E.surface, opacity:locked?0.6:1 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <i data-lucide="scissors" style={{ width:15, height:15, color:on?BIZ:E.fg3 }}/>
        {on && <i data-lucide="check" style={{ width:14, height:14, color:BIZ, strokeWidth:3 }}/>}
      </div>
      <span style={{ fontSize:11.5, fontWeight:700, color:E.fg1, lineHeight:'14px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{name}</span>
      <span style={{ fontSize:10, color:E.fg3 }}>{dur}</span>
    </button>
  );
}

function Tiles({ locked }) {
  const items = [
    { name:'Haircut', dur:'45 min', on:true },
    { name:'Beard trim', dur:'20 min', on:true },
    { name:'Color & cut', dur:'90 min', on:false },
    { name:'Kids cut', dur:'30 min', on:false },
  ];
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
      {items.map(t => <EventTile key={t.name} {...t} locked={locked}/>)}
    </div>
  );
}

function PriceCard({ value, perSession, error }) {
  return (
    <Card overline="Price" pillar="business">
      <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
        <div style={{ flex:1 }}><TextInput value={value} placeholder="$0.00" error={error} helper={error?'Enter a price above $0':undefined}/></div>
        <div style={{ height:40, display:'flex', alignItems:'center', padding:'0 12px', borderRadius:8, background:E.sunken, fontSize:12.5, fontWeight:700, color:E.fg2, flexShrink:0 }}>USD</div>
      </div>
      {!error && <div style={{ fontSize:11.5, fontWeight:700, color:BIZ, marginTop:2 }}>{perSession} per session</div>}
    </Card>
  );
}

function SessionsCard({ value, locked }) {
  return (
    <Card overline="Sessions" pillar="business">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontSize:13, fontWeight:600, color:E.fg1 }}>Number of sessions</div>
        <Stepper value={value} disabled={locked}/>
      </div>
    </Card>
  );
}

function RedeemCard({ locked }) {
  return (
    <Card overline="Redeems against" pillar="business">
      <Tiles locked={locked}/>
    </Card>
  );
}

function DetailsCard({ name, desc }) {
  return (
    <Card overline="Details" pillar="business">
      <TextInput label="Name" value={name} placeholder="5-session cleaning"/>
      <TextInput label="Description" value={desc} placeholder="What's included" multiline/>
    </Card>
  );
}

function ExpiryCard() {
  return (
    <Card overline="Expiry" pillar="business">
      <Segmented options={['90 days','1 year','Never']} value="1 year"/>
    </Card>
  );
}

function ActiveToggle({ on=true }) {
  return <Card pillar="business"><ToggleRow icon="power" label="Active" sub="Buyers can purchase this package" on={on} last/></Card>;
}

// ─── FRAME 1 · CREATE (defaults) ────────────────────────────────────────────

function FrameCreate() {
  return (
    <Phone label="Package · Create">
      <TopBar title="New package"/>
      <Body>
        <div style={{ fontSize:11.5, color:E.fg3, lineHeight:'16px', padding:'0 2px' }}>Set a price and we'll do the per-session math.</div>
        <DetailsCard/>
        <RedeemCard/>
        <SessionsCard value="5"/>
        <PriceCard value="" perSession="$0.00"/>
        <ExpiryCard/>
        <ActiveToggle/>
      </Body>
      <SaveBar label="Save package"/>
    </Phone>
  );
}

// ─── FRAME 2 · EDIT (price change → new Stripe price) ───────────────────────

function FrameEdit() {
  return (
    <Phone label="Package · Edit">
      <TopBar title="Edit package"/>
      <Body>
        <DetailsCard name="5-session cleaning" desc="Five standard cleans, prepaid."/>
        <RedeemCard/>
        <SessionsCard value="5"/>
        <PriceCard value="$240.00" perSession="$48.00"/>
        <Note tone="infoBlue" icon="info">Changing the price creates a new Stripe price. Current buyers keep their terms.</Note>
        <ExpiryCard/>
        <ActiveToggle/>
      </Body>
      <SaveBar label="Save package"/>
    </Phone>
  );
}

// ─── FRAME 3 · VALIDATION ERROR ─────────────────────────────────────────────

function FrameError() {
  return (
    <Phone label="Package · Validation error">
      <TopBar title="New package"/>
      <Body>
        <DetailsCard name="5-session cleaning"/>
        <RedeemCard/>
        <SessionsCard value="5"/>
        <PriceCard value="$0" error/>
        <ExpiryCard/>
        <ActiveToggle/>
      </Body>
      <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(255,255,255,0.96)', backdropFilter:'blur(12px)', borderTop:`1px solid ${E.border}`, padding:'10px 12px 18px', zIndex:10 }}>
        <button disabled style={{ width:'100%', height:44, borderRadius:12, border:'none', background:E.blue600, color:'#fff', fontSize:13.5, fontWeight:700, opacity:0.45, cursor:'default' }}>Save package</button>
      </div>
    </Phone>
  );
}

// ─── FRAME 4 · HAS ACTIVE BUYERS ────────────────────────────────────────────

function FrameActiveBuyers() {
  return (
    <Phone label="Package · Has active buyers">
      <TopBar title="Edit package"/>
      <Body>
        <DetailsCard name="5-session cleaning" desc="Five standard cleans, prepaid."/>
        <Note tone="warning" icon="lock">12 people own credits — you can't change sessions or eligibility while credits are active.</Note>
        <RedeemCard locked/>
        <SessionsCard value="5" locked/>
        <PriceCard value="$220.00" perSession="$44.00"/>
        <ExpiryCard/>
        <ActiveToggle/>
      </Body>
      <SaveBar label="Save package"/>
    </Phone>
  );
}

Object.assign(window, { CP_FrameCreate:FrameCreate, CP_FrameEdit:FrameEdit, CP_FrameError:FrameError, CP_FrameActiveBuyers:FrameActiveBuyers });
