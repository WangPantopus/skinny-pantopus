// Pantopus — Calendarly · G · Packages List (owner) — 5 frames
// ListOfRows where a business sells N-session bundles. Reuses Wallet row styling
// + A10.8 paper-card feel; A14.6 inline-empty + Stripe gate. Business violet.
//
// Frames: 1 active · 2 empty · 3 empty + payouts-not-connected · 4 archived ·
// 5 loading (shimmer).

const { E, SH } = window;
const { C, Frame, TopBar, Scroll, Card, Chip, Note, EmptyHero, PrimaryBtn, Sk } = window;
const BIZ = C.biz, BIZ_BG = C.bizBg;

function FilterSeg({ value }) {
  const opts = ['Active', 'Archived'];
  return (
    <div style={{ display:'flex', gap:3, padding:3, background:E.sunken, borderRadius:9 }}>
      {opts.map(o => { const on = o === value; return <button key={o} style={{ flex:1, height:30, borderRadius:7, border:'none', cursor:'pointer', background:on?'#fff':'transparent', color:on?BIZ:E.fg3, boxShadow:on?'0 1px 2px rgba(0,0,0,0.08)':'none', fontSize:12, fontWeight:on?700:600 }}>{o}</button>; })}
    </div>
  );
}

function PkgRow({ name, sub, sold, status, last, archived }) {
  return (
    <div role="button" style={{ display:'flex', alignItems:'center', gap:11, padding:'12px 2px', borderBottom: last?'none':`1px solid ${E.border}`, cursor:'pointer', opacity:archived?0.6:1 }}>
      <div style={{ width:38, height:38, borderRadius:11, background:archived?E.sunken:BIZ_BG, color:archived?E.fg3:BIZ, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i data-lucide="layers" style={{ width:19, height:19 }}/></div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13.5, fontWeight:700, color:E.fg1, letterSpacing:-0.1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{name}</div>
        <div style={{ fontSize:11, color:E.fg3, marginTop:2 }}>{sub}</div>
        <div style={{ display:'flex', alignItems:'center', gap:7, marginTop:5 }}>
          {status==='active' ? <Chip tone="success">Active</Chip> : <Chip tone="neutral">Archived</Chip>}
          <span style={{ fontSize:10.5, color:E.fg4, fontWeight:600, whiteSpace:'nowrap' }}>· {sold} sold</span>
        </div>
      </div>
      {archived
        ? <button style={{ height:28, padding:'0 12px', borderRadius:9999, border:`1px solid ${E.border}`, background:E.surface, color:E.fg2, fontSize:11, fontWeight:700, cursor:'pointer', flexShrink:0 }}>Restore</button>
        : <i data-lucide="ellipsis-vertical" style={{ width:18, height:18, color:E.fg4, flexShrink:0 }}/>}
    </div>
  );
}

const PKGS = [
  { name:'5-session cleaning', sub:'5 sessions · $220 · $44 each', sold:12, status:'active' },
  { name:'10 dog walks', sub:'10 sessions · $180 · $18 each', sold:34, status:'active' },
  { name:'3 deep cleans', sub:'3 sessions · $330 · $110 each', sold:7, status:'active' },
];

const PlusBtn = <button aria-label="Create a package" style={{ width:32, height:32, borderRadius:'50%', border:'none', background:'transparent', color:E.blue600, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}><i data-lucide="plus" style={{ width:21, height:21 }}/></button>;

function Intro() { return <div style={{ fontSize:11.5, color:E.fg3, lineHeight:'16px', padding:'0 4px' }}>Sell a bundle of sessions at a better rate. Buyers keep their price if you change it later.</div>; }

// ─── FRAME 1 · ACTIVE ───────────────────────────────────────────────────────

function FrameActive() {
  return (
    <Frame label="Packages · Active">
      <TopBar title="Packages" trailing={PlusBtn}/>
      <Scroll>
        <FilterSeg value="Active"/>
        <Intro/>
        <Card>{PKGS.map((p, i) => <PkgRow key={p.name} {...p} last={i===PKGS.length-1}/>)}</Card>
      </Scroll>
    </Frame>
  );
}

// ─── FRAME 2 · EMPTY ────────────────────────────────────────────────────────

function FrameEmpty() {
  return (
    <Frame label="Packages · Empty">
      <TopBar title="Packages" trailing={PlusBtn}/>
      <Scroll>
        <FilterSeg value="Active"/>
        <EmptyHero icon="layers" tintBg={BIZ_BG} tint={BIZ} title="Sell a package of sessions"
          body="Bundle sessions so regulars can prepay and rebook fast."
          action={<div style={{ width:200 }}><PrimaryBtn icon="plus">Create a package</PrimaryBtn></div>}/>
      </Scroll>
    </Frame>
  );
}

// ─── FRAME 3 · EMPTY + PAYOUTS NOT CONNECTED ────────────────────────────────

function FrameGate() {
  return (
    <Frame label="Packages · Payouts gate">
      <TopBar title="Packages" trailing={PlusBtn}/>
      <Scroll>
        <FilterSeg value="Active"/>
        <EmptyHero icon="layers" tintBg={BIZ_BG} tint={BIZ} title="Sell a package of sessions"
          body="Bundle sessions so regulars can prepay and rebook fast."
          action={
            <div style={{ width:240, background:C.warnBg, border:`1px solid ${C.warnBorder}`, borderRadius:14, padding:'13px 14px', display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:9 }}>
                <i data-lucide="lock" style={{ width:16, height:16, color:C.warn, flexShrink:0, marginTop:1 }}/>
                <span style={{ fontSize:11.5, color:C.warn, fontWeight:600, lineHeight:'16px', textAlign:'left' }}>Set up payouts to sell packages.</span>
              </div>
              <button style={{ width:'100%', height:38, borderRadius:9, border:'none', background:E.blue600, color:'#fff', fontSize:12.5, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6 }}><i data-lucide="external-link" style={{ width:14, height:14 }}/>Connect payments</button>
            </div>
          }/>
      </Scroll>
    </Frame>
  );
}

// ─── FRAME 4 · ARCHIVED ─────────────────────────────────────────────────────

function FrameArchived() {
  return (
    <Frame label="Packages · Archived">
      <TopBar title="Packages" trailing={PlusBtn}/>
      <Scroll>
        <FilterSeg value="Archived"/>
        <Card>
          <PkgRow name="Summer 4-pack" sub="4 sessions · $160 · $40 each" sold={21} status="archived" archived/>
          <PkgRow name="2-session trial" sub="2 sessions · $70 · $35 each" sold={9} status="archived" archived last/>
        </Card>
      </Scroll>
    </Frame>
  );
}

// ─── FRAME 5 · LOADING ──────────────────────────────────────────────────────

function FrameLoading() {
  return (
    <Frame label="Packages · Loading">
      <TopBar title="Packages" trailing={PlusBtn}/>
      <Scroll>
        <FilterSeg value="Active"/>
        <Card>
          {[0,1,2].map(i => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:11, padding:'13px 2px', borderBottom: i===2?'none':`1px solid ${E.border}` }}>
              <div style={{ width:38, height:38, borderRadius:11, ...SH }}/>
              <div style={{ flex:1 }}><Sk w="56%" h={12}/><Sk w="72%" h={9} mt={6}/><Sk w={64} h={15} r={9999} mt={7}/></div>
            </div>
          ))}
        </Card>
      </Scroll>
    </Frame>
  );
}

Object.assign(window, { PL_FrameActive:FrameActive, PL_FrameEmpty:FrameEmpty, PL_FrameGate:FrameGate, PL_FrameArchived:FrameArchived, PL_FrameLoading:FrameLoading });
