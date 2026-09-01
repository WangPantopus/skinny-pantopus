// Pantopus — Calendarly · H · Workflows List — 5 frames
// ListOfRows + GroupedList for automations. List-of-Rows chrome + A08 TabStrip
// scope selector + Chip status pills. Pinned Default-reminders card + workflow
// rows + FAB. Personal sky pillar (scope-dependent).
//
// Frames: 1 populated · 2 empty · 3 loading (shimmer) · 4 error/retry ·
// 5 permission-gated.

const { E, SH } = window;
const { C, Frame, TopBar, Scroll, Overline, Card, IToggle, Chip, Sk } = window;
const SKY = E.blue600, SKY50 = E.blue50;

function TabStrip({ active }) {
  const tabs = ['Global', 'This event type'];
  return (
    <div style={{ display:'flex', background:E.surface, borderBottom:`1px solid ${E.border}`, padding:'0 10px', flexShrink:0 }}>
      {tabs.map(t => { const on = t === active; return (
        <button key={t} style={{ flex:1, padding:'11px 2px', background:'transparent', border:'none', borderBottom: on?`2px solid ${SKY}`:'2px solid transparent', color:on?E.fg1:E.fg3, fontSize:12.5, fontWeight:on?700:600, cursor:'pointer', marginBottom:-1 }}>{t}</button>
      ); })}
    </div>
  );
}

function DefaultRemindersRow() {
  return (
    <Card pad="4px 13px">
      <div role="button" style={{ display:'flex', alignItems:'center', gap:11, padding:'11px 2px', cursor:'pointer' }}>
        <div style={{ width:34, height:34, borderRadius:9, background:SKY50, color:SKY, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i data-lucide="bell" style={{ width:17, height:17 }}/></div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:700, color:E.fg1 }}>Default reminders</div>
          <div style={{ fontSize:11, color:E.fg3, marginTop:1 }}>1 day + 1 hour before · Push</div>
        </div>
        <i data-lucide="chevron-right" style={{ width:16, height:16, color:E.fg4 }}/>
      </div>
    </Card>
  );
}

function WfRow({ icon, trigger, action, channels, status, on, last, gated }) {
  const st = { active:{tone:'success',label:'Active'}, paused:{tone:'neutral',label:'Paused'}, draft:{tone:'warning',label:'Draft'} }[status];
  return (
    <div style={{ display:'flex', alignItems:'center', gap:11, padding:'11px 2px', borderBottom: last?'none':`1px solid ${E.border}`, opacity:gated?0.5:1 }}>
      <div style={{ width:34, height:34, borderRadius:9, background:E.sunken, color:E.fg2, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i data-lucide={icon} style={{ width:16, height:16 }}/></div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12.5, fontWeight:600, color:E.fg1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{trigger}</div>
        <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:2 }}>
          {channels.map(c => <i key={c} data-lucide={c} style={{ width:12, height:12, color:E.fg4 }}/>)}
          <span style={{ fontSize:10.5, color:E.fg3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{action}</span>
        </div>
        <div style={{ marginTop:5 }}><Chip tone={st.tone}>{st.label}</Chip></div>
      </div>
      {!gated && <IToggle on={on} color={SKY}/>}
    </div>
  );
}

const WFS = [
  { icon:'calendar-plus', trigger:'When a booking is created', action:'Email attendees', channels:['mail'], status:'active', on:true },
  { icon:'clock', trigger:'1 hour before it starts', action:'Notify me', channels:['bell'], status:'active', on:true },
  { icon:'calendar-check-2', trigger:'After it ends', action:'Request a review', channels:['mail','smartphone'], status:'paused', on:false },
];

const Fab = (
  <button aria-label="New workflow" style={{ position:'absolute', right:16, bottom:24, width:52, height:52, borderRadius:'50%', border:'none', background:SKY, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', boxShadow:'0 6px 16px rgba(2,132,199,0.32)', zIndex:8 }}><i data-lucide="plus" style={{ width:24, height:24 }}/></button>
);

const PlusText = <button style={{ background:'none', border:'none', color:SKY, fontSize:13.5, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:3 }}><i data-lucide="plus" style={{ width:16, height:16 }}/></button>;

// ─── FRAME 1 · POPULATED ────────────────────────────────────────────────────

function FramePopulated() {
  return (
    <Frame label="Workflows · Populated">
      <TopBar title="Workflows" trailing={PlusText}/>
      <TabStrip active="Global"/>
      <Scroll>
        <div><Overline>Reminders</Overline><div style={{ marginTop:8 }}><DefaultRemindersRow/></div></div>
        <div><Overline>Your workflows</Overline><div style={{ marginTop:8 }}><Card>{WFS.map((w, i) => <WfRow key={i} {...w} last={i===WFS.length-1}/>)}</Card></div></div>
      </Scroll>
      {Fab}
    </Frame>
  );
}

// ─── FRAME 2 · EMPTY ────────────────────────────────────────────────────────

function FrameEmpty() {
  return (
    <Frame label="Workflows · Empty">
      <TopBar title="Workflows" trailing={PlusText}/>
      <TabStrip active="Global"/>
      <Scroll>
        <div><Overline>Reminders</Overline><div style={{ marginTop:8 }}><DefaultRemindersRow/></div></div>
        <div style={{ marginTop:14, display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', gap:10, padding:'20px 24px' }}>
          <div style={{ width:56, height:56, borderRadius:'50%', background:SKY50, color:SKY, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="workflow" style={{ width:25, height:25, strokeWidth:1.8 }}/></div>
          <div style={{ fontSize:14, fontWeight:700, color:E.fg1 }}>No follow-ups yet</div>
          <div style={{ fontSize:11.5, color:E.fg3, lineHeight:'16px', maxWidth:220 }}>Reminders are handled. Add a thank-you or a review request to run automatically.</div>
          <button style={{ marginTop:2, height:38, padding:'0 16px', borderRadius:10, border:`1px solid ${E.borderStrong}`, background:E.surface, color:E.fg1, fontSize:12.5, fontWeight:700, cursor:'pointer' }}>Add a follow-up</button>
        </div>
      </Scroll>
      {Fab}
    </Frame>
  );
}

// ─── FRAME 3 · LOADING ──────────────────────────────────────────────────────

function FrameLoading() {
  return (
    <Frame label="Workflows · Loading">
      <TopBar title="Workflows" trailing={PlusText}/>
      <TabStrip active="Global"/>
      <Scroll>
        <Card>{[0,1,2,3].map(i => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:11, padding:'13px 2px', borderBottom: i===3?'none':`1px solid ${E.border}` }}>
            <div style={{ width:34, height:34, borderRadius:9, ...SH }}/>
            <div style={{ flex:1 }}><Sk w="60%" h={11}/><Sk w="44%" h={8} mt={6}/></div>
            <div style={{ width:46, height:28, borderRadius:9999, ...SH }}/>
          </div>
        ))}</Card>
      </Scroll>
    </Frame>
  );
}

// ─── FRAME 4 · ERROR ────────────────────────────────────────────────────────

function FrameError() {
  return (
    <Frame label="Workflows · Error">
      <TopBar title="Workflows" trailing={PlusText}/>
      <TabStrip active="Global"/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'0 20px' }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', gap:11, padding:'22px', background:E.surface, border:`1px solid ${E.border}`, borderRadius:16, boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ width:48, height:48, borderRadius:'50%', background:E.sunken, color:E.fg3, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="cloud-off" style={{ width:23, height:23 }}/></div>
          <div style={{ fontSize:13.5, fontWeight:700, color:E.fg1 }}>Couldn't load workflows</div>
          <button style={{ height:38, padding:'0 18px', borderRadius:10, border:'none', background:SKY, color:'#fff', fontSize:12.5, fontWeight:700, cursor:'pointer' }}>Try again</button>
        </div>
      </div>
    </Frame>
  );
}

// ─── FRAME 5 · PERMISSION GATED ─────────────────────────────────────────────

function FrameGated() {
  return (
    <Frame label="Workflows · Gated">
      <TopBar title="Workflows" trailing={PlusText}/>
      <TabStrip active="Global"/>
      <Scroll>
        <div style={{ display:'flex', alignItems:'center', gap:9, padding:'11px 12px', background:C.warnBg, border:`1px solid ${C.warnBorder}`, borderRadius:12 }}>
          <i data-lucide="lock" style={{ width:16, height:16, color:C.warn, flexShrink:0 }}/>
          <span style={{ fontSize:11.5, color:C.warn, fontWeight:600 }}>Only admins can edit Home workflows.</span>
        </div>
        <div><Overline>Your workflows</Overline><div style={{ marginTop:8 }}><Card>{WFS.map((w, i) => <WfRow key={i} {...w} last={i===WFS.length-1} gated/>)}</Card></div></div>
      </Scroll>
    </Frame>
  );
}

Object.assign(window, { WF_FramePopulated:FramePopulated, WF_FrameEmpty:FrameEmpty, WF_FrameLoading:FrameLoading, WF_FrameError:FrameError, WF_FrameGated:FrameGated });
