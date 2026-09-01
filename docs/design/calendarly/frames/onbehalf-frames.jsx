// Pantopus — Calendarly · Manual / On-Behalf Booking (wizard) — 8 frames
// Archetype: A12 Wizard (multi-step) wrapping the shared availability slot
// picker — same 5-step rail + slot rows as Start a Support Train and the booking
// flow. Host or member; accent follows the active scope pill.
//
// Frames: 1 step1 event-type · 2 step2 slot (composed availability) · 3 step3
// invitee details (verified) · 4 step3 not-on-Pantopus branch · 5 step4 review
// (skip toggles) · 6 created confirmation · 7 loading-availability · 8 error.

const { E, SH } = window;

const ID = { business:{color:'#7c3aed', bg:'#f3e8ff'} };
const AV = { business:'linear-gradient(135deg,#a78bfa,#6d28d9)' };
const ACCENT = '#7c3aed';
const ERR = '#DC2626', ERR_BG = '#FEF2F2', ERR_LIGHT = '#FCA5A5';
const SUCCESS = '#059669', SUCCESS_LIGHT='#A7F3D0', SUCCESS_BG='#F0FDF4';
const PRIMARY = E.blue600;

function DarkStatusBar() {
  const c = E.fg1;
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 22px 0', height:34, boxSizing:'border-box', flexShrink:0, fontFamily:'-apple-system, system-ui', fontWeight:600, fontSize:12.5, color:c }}>
      <span>9:41</span>
      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
        <svg width="15" height="10" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={c}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={c}/><rect x="9" y="2" width="3" height="9" rx="0.6" fill={c}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={c}/></svg>
        <svg width="13" height="10" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={c}/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={c}/><circle cx="7.5" cy="9" r="1.3" fill={c}/></svg>
        <svg width="21" height="10" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={c} strokeOpacity="0.35" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill={c}/><path d="M22.5 3.8v3.4c.6-.2 1-.8 1-1.7s-.4-1.5-1-1.7z" fill={c} fillOpacity="0.4"/></svg>
      </div>
    </div>
  );
}

function StepRail({ step }) {
  const steps = ['Event', 'Time', 'Details', 'Review'];
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 14px', flexShrink:0 }}>
      {steps.map((s, i) => {
        const idx = i + 1;
        const on = idx === step;
        const done = idx < step;
        return (
          <React.Fragment key={s}>
            <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
              <div style={{ width:22, height:22, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', background: on?ACCENT:(done?ID.business.bg:E.sunken), color: on?'#fff':(done?ACCENT:E.fg4), fontSize:10.5, fontWeight:700, flexShrink:0 }}>{done ? <i data-lucide="check" style={{ width:12, height:12, strokeWidth:3 }}/> : idx}</div>
              {on && <span style={{ fontSize:11.5, fontWeight:700, color:ACCENT, whiteSpace:'nowrap' }}>{s}</span>}
            </div>
            {i < steps.length - 1 && <div style={{ flex:1, height:2, background: done?ID.business.bg:E.border, borderRadius:2, minWidth:6 }}/>}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function TopBar() {
  return (
    <div style={{ display:'flex', alignItems:'center', padding:'6px 8px', height:42, boxSizing:'border-box', background:E.surface, flexShrink:0 }}>
      <button aria-label="Back" style={{ width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'none', cursor:'pointer', color:E.fg1, padding:0 }}><i data-lucide="chevron-left" style={{ width:21, height:21 }}/></button>
      <div style={{ flex:1, textAlign:'center', fontSize:14.5, fontWeight:600, color:E.fg1 }}>Book someone in</div>
      <div style={{ width:34 }}/>
    </div>
  );
}

function Phone({ label, step, children, cta, ctaIcon, ctaTone, noChrome }) {
  return (
    <div style={{ width:300, height:620, borderRadius:40, padding:8, background:'#0b0f17', boxShadow:'0 24px 50px rgba(17,24,39,0.20), 0 0 0 1px rgba(0,0,0,0.12)', flexShrink:0 }} data-screen-label={label}>
      <div style={{ width:'100%', height:'100%', background:E.bg, borderRadius:32, overflow:'hidden', position:'relative', display:'flex', flexDirection:'column', fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div style={{ position:'absolute', top:7, left:'50%', transform:'translateX(-50%)', width:88, height:24, borderRadius:16, background:'#000', zIndex:50 }}/>
        <DarkStatusBar/>
        {!noChrome && <TopBar/>}
        {!noChrome && <StepRail step={step}/>}
        <div style={{ flex:1, overflow:'auto', padding: noChrome ? 0 : '4px 16px 14px' }}>{children}</div>
        {cta && (
          <div style={{ flexShrink:0, padding:'10px 16px 20px', borderTop:`1px solid ${E.border}`, background:E.surface }}>
            <button style={{ width:'100%', height:48, borderRadius:13, border:'none', background: ctaTone==='ghost'?E.surface:ACCENT, color: ctaTone==='ghost'?E.fg1:'#fff', fontSize:14.5, fontWeight:700, cursor:'pointer', boxShadow: ctaTone==='ghost'?'none':'0 6px 16px rgba(124,58,237,0.28)', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8, ...(ctaTone==='ghost'?{border:`1px solid ${E.borderStrong}`}:{}) }}>{ctaIcon && <i data-lucide={ctaIcon} style={{ width:17, height:17 }}/>}{cta}</button>
          </div>
        )}
        <div style={{ position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)', width:100, height:4, borderRadius:4, background:'rgba(0,0,0,0.22)', zIndex:70 }}/>
      </div>
    </div>
  );
}

function StepTitle({ children }) { return <div style={{ fontSize:17, fontWeight:700, color:E.fg1, letterSpacing:-0.2, margin:'4px 2px 14px' }}>{children}</div>; }

function EventTypeTile({ name, dur, mode, modeIcon, on }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 13px', background: on?ID.business.bg:E.surface, border:`1.5px solid ${on?ACCENT:E.border}`, borderRadius:14, cursor:'pointer' }}>
      <div style={{ width:38, height:38, borderRadius:10, background: on?'#fff':E.sunken, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i data-lucide={modeIcon} style={{ width:18, height:18, color: on?ACCENT:E.fg2 }}/></div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13.5, fontWeight:700, color:E.fg1 }}>{name}</div>
        <div style={{ fontSize:11, color:E.fg3, marginTop:2 }}>{dur} · {mode}</div>
      </div>
      {on && <i data-lucide="check-circle-2" style={{ width:19, height:19, color:ACCENT }}/>}
    </div>
  );
}

function TzChip() {
  return <button style={{ display:'inline-flex', alignItems:'center', gap:6, height:28, padding:'0 11px', borderRadius:9999, border:`1px solid ${E.border}`, background:E.surface, cursor:'pointer', fontSize:11, fontWeight:600, color:E.fg2, marginBottom:11 }}><i data-lucide="globe" style={{ width:13, height:13 }}/>Times in Pacific · tap to change</button>;
}

function DayStrip() {
  const days = [{ d:'Mon', n:'20' }, { d:'Tue', n:'21', on:true }, { d:'Wed', n:'22' }, { d:'Thu', n:'23' }, { d:'Fri', n:'24' }];
  return (
    <div style={{ display:'flex', gap:8, overflowX:'auto', marginBottom:13, paddingBottom:2 }}>
      {days.map((x) => (
        <div key={x.n} style={{ flexShrink:0, width:48, height:58, borderRadius:13, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, cursor:'pointer', background: x.on?ACCENT:E.surface, border: x.on?'none':`1px solid ${E.border}`, color: x.on?'#fff':E.fg2 }}>
          <span style={{ fontSize:10.5, fontWeight:600, opacity:0.8 }}>{x.d}</span><span style={{ fontSize:16, fontWeight:700 }}>{x.n}</span>
        </div>
      ))}
    </div>
  );
}

function SlotRow({ label, on }) {
  return (
    <button style={{ width:'100%', minHeight:46, padding:'0 14px', borderRadius:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, background: on?ID.business.bg:E.surface, border:`1.5px solid ${on?ACCENT:E.border}`, color:E.fg1 }}>
      <span style={{ fontSize:12.5, fontWeight: on?700:600 }}>{label}</span>{on && <i data-lucide="check-circle-2" style={{ width:18, height:18, color:ACCENT }}/>}
    </button>
  );
}

function Field({ label, value, placeholder, icon }) {
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ fontSize:10.5, fontWeight:700, color:E.fg3, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
      <div style={{ display:'flex', alignItems:'center', gap:9, padding:'0 12px', height:44, background:E.surface, border:`1px solid ${E.border}`, borderRadius:8 }}>
        {icon && <i data-lucide={icon} style={{ width:16, height:16, color:E.fg4 }}/>}
        <span style={{ fontSize:13, color: value?E.fg1:E.fg4, fontWeight: value?600:400 }}>{value || placeholder}</span>
      </div>
    </div>
  );
}

function Toggle({ label, sub, on }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:11, padding:'11px 12px', background:E.surface, border:`1px solid ${E.border}`, borderRadius:12, marginBottom:9 }}>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:12.5, fontWeight:600, color:E.fg1 }}>{label}</div>
        {sub && <div style={{ fontSize:10.5, color:E.fg3, marginTop:1 }}>{sub}</div>}
      </div>
      <div style={{ width:42, height:25, borderRadius:9999, background: on?ACCENT:E.borderStrong, position:'relative', flexShrink:0 }}><div style={{ position:'absolute', top:2.5, [on?'right':'left']:2.5, width:20, height:20, borderRadius:'50%', background:'#fff' }}/></div>
    </div>
  );
}

// ─── FRAME 1 · STEP 1 EVENT TYPE ────────────────────────────────────────────

function FrameStep1() {
  return (
    <Phone label="On-behalf · Step 1 Event" step={1} cta="Continue" ctaIcon="arrow-right">
      <StepTitle>Pick an event type</StepTitle>
      <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
        <EventTypeTile name="Studio consultation" dur="45 min" mode="In person" modeIcon="map-pin" on/>
        <EventTypeTile name="Discovery call" dur="30 min" mode="Video" modeIcon="video"/>
        <EventTypeTile name="Brand strategy session" dur="60 min" mode="In person" modeIcon="map-pin"/>
        <EventTypeTile name="Quick check-in" dur="15 min" mode="Phone" modeIcon="phone"/>
      </div>
    </Phone>
  );
}

// ─── FRAME 2 · STEP 2 SLOT ──────────────────────────────────────────────────

function FrameStep2() {
  return (
    <Phone label="On-behalf · Step 2 Time" step={2} cta="Continue" ctaIcon="arrow-right">
      <StepTitle>Choose a time</StepTitle>
      <TzChip/>
      <DayStrip/>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        <SlotRow label="Tue Oct 21 · 1:00–1:45 PM · PT"/>
        <SlotRow label="Tue Oct 21 · 2:00–2:45 PM · PT" on/>
        <SlotRow label="Tue Oct 21 · 3:30–4:15 PM · PT"/>
      </div>
      <div style={{ fontSize:10.5, color:E.fg3, marginTop:11, lineHeight:'15px', display:'flex', gap:6, alignItems:'flex-start' }}><i data-lucide="info" style={{ width:12, height:12, marginTop:1, flexShrink:0 }}/>Times come from each member's personal availability.</div>
    </Phone>
  );
}

// ─── FRAME 3 · STEP 3 INVITEE (verified) ────────────────────────────────────

function FrameStep3() {
  return (
    <Phone label="On-behalf · Step 3 Details" step={3} cta="Continue" ctaIcon="arrow-right">
      <StepTitle>Who's it for?</StepTitle>
      <div style={{ display:'flex', alignItems:'center', gap:9, padding:'0 12px', height:42, background:E.sunken, border:`1px solid ${E.border}`, borderRadius:8, marginBottom:13 }}>
        <i data-lucide="search" style={{ width:16, height:16, color:E.fg4 }}/><span style={{ fontSize:12.5, color:E.fg1, fontWeight:600 }}>Dana</span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:11, padding:'11px 12px', background:ID.business.bg, border:`1.5px solid ${ACCENT}`, borderRadius:14, marginBottom:14 }}>
        <div style={{ position:'relative', flexShrink:0 }}>
          <div style={{ width:38, height:38, borderRadius:'50%', background:AV.business, color:'#fff', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>DW</div>
          <div style={{ position:'absolute', right:-2, bottom:-2, width:15, height:15, borderRadius:'50%', background:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="badge-check" style={{ width:14, height:14, color:ACCENT }}/></div>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13.5, fontWeight:700, color:E.fg1 }}>Dana Whitfield</div>
          <div style={{ fontSize:11, color:E.fg3, marginTop:1 }}>Verified neighbor · Riverside</div>
        </div>
        <i data-lucide="check-circle-2" style={{ width:19, height:19, color:ACCENT }}/>
      </div>
      <Field label="Note for the invitee" placeholder="Add a note (optional)" icon="message-square"/>
    </Phone>
  );
}

// ─── FRAME 4 · STEP 3 NOT ON PANTOPUS ───────────────────────────────────────

function FrameStep3Invite() {
  return (
    <Phone label="On-behalf · Invite branch" step={3} cta="Continue" ctaIcon="arrow-right">
      <StepTitle>Who's it for?</StepTitle>
      <div style={{ display:'flex', alignItems:'center', gap:9, padding:'0 12px', height:42, background:E.sunken, border:`1px solid ${E.border}`, borderRadius:8, marginBottom:11 }}>
        <i data-lucide="search" style={{ width:16, height:16, color:E.fg4 }}/><span style={{ fontSize:12.5, color:E.fg1, fontWeight:600 }}>Casey Brooks</span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', background:E.blue50, border:`1px solid ${E.blue200}`, borderRadius:12, marginBottom:14 }}>
        <i data-lucide="user-plus" style={{ width:16, height:16, color:E.blue600, flexShrink:0 }}/>
        <span style={{ fontSize:11, color:E.fg2, fontWeight:600, lineHeight:'15px' }}>Not on Pantopus yet — invite them to book</span>
      </div>
      <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:E.fg3, marginBottom:9 }}>Invite by</div>
      <div style={{ display:'flex', flexDirection:'column', gap:9, marginBottom:13 }}>
        <div style={{ display:'flex', alignItems:'center', gap:11, padding:'11px 12px', background:ID.business.bg, border:`1.5px solid ${ACCENT}`, borderRadius:13 }}>
          <i data-lucide="phone" style={{ width:17, height:17, color:ACCENT }}/>
          <div style={{ flex:1 }}><div style={{ fontSize:12.5, fontWeight:700, color:E.fg1 }}>Phone</div><div style={{ fontSize:10, color:E.fg3 }}>Recommended</div></div>
          <i data-lucide="check-circle-2" style={{ width:18, height:18, color:ACCENT }}/>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:11, padding:'11px 12px', background:E.surface, border:`1px solid ${E.border}`, borderRadius:13 }}>
          <i data-lucide="mail" style={{ width:17, height:17, color:E.fg2 }}/>
          <div style={{ flex:1, fontSize:12.5, fontWeight:700, color:E.fg1 }}>Email</div>
        </div>
      </div>
      <Field label="Phone number" value="(555) 012-3948" icon="phone"/>
    </Phone>
  );
}

// ─── FRAME 5 · STEP 4 REVIEW ────────────────────────────────────────────────

function FrameStep4() {
  return (
    <Phone label="On-behalf · Step 4 Review" step={4} cta="Create booking" ctaIcon="check">
      <StepTitle>Review &amp; confirm</StepTitle>
      <div style={{ background:E.surface, border:`1px solid ${E.border}`, borderRadius:14, padding:'13px', marginBottom:14 }}>
        {[['Event', 'Studio consultation · 45 min'], ['Time', 'Tue Oct 21 · 2:00–2:45 PM · PT'], ['Invitee', 'Dana Whitfield · verified'], ['Member', 'Priya R.']].map(([k, v], i) => (
          <div key={k} style={{ display:'flex', justifyContent:'space-between', gap:12, padding:'7px 0', borderTop: i>0?`1px solid ${E.border}`:'none' }}>
            <span style={{ fontSize:11.5, color:E.fg3, fontWeight:600, flexShrink:0 }}>{k}</span>
            <span style={{ fontSize:12, color:E.fg1, fontWeight:600, textAlign:'right' }}>{v}</span>
          </div>
        ))}
      </div>
      <Toggle label="Skip approval" sub="Confirm the booking now" on/>
      <Toggle label="Skip notifications" sub="Don't notify the invitee"/>
    </Phone>
  );
}

// ─── FRAME 6 · CREATED ──────────────────────────────────────────────────────

function FrameCreated() {
  return (
    <Phone label="On-behalf · Created" noChrome>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'0 30px 40px', gap:18 }}>
        <div style={{ width:78, height:78, borderRadius:'50%', background:SUCCESS_BG, border:`1px solid ${SUCCESS_LIGHT}`, color:SUCCESS, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="check" style={{ width:36, height:36, strokeWidth:2.6 }}/></div>
        <div>
          <div style={{ fontSize:19, fontWeight:700, color:E.fg1, letterSpacing:-0.3 }}>Booking created</div>
          <div style={{ fontSize:13, color:E.fg3, marginTop:8, maxWidth:220, lineHeight:'19px' }}>We've added it and notified Dana.</div>
        </div>
        <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:9, marginTop:8 }}>
          <button style={{ width:'100%', height:46, borderRadius:13, border:'none', background:ACCENT, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', boxShadow:'0 6px 16px rgba(124,58,237,0.28)' }}>View booking</button>
          <button style={{ width:'100%', height:46, borderRadius:13, border:`1px solid ${E.borderStrong}`, background:E.surface, color:E.fg1, fontSize:14, fontWeight:700, cursor:'pointer' }}>Book another</button>
        </div>
      </div>
    </Phone>
  );
}

// ─── FRAME 7 · LOADING AVAILABILITY ─────────────────────────────────────────

function FrameLoading() {
  return (
    <Phone label="On-behalf · Loading" step={2}>
      <StepTitle>Choose a time</StepTitle>
      <div style={{ display:'flex', gap:8, marginBottom:13 }}>{[0,1,2,3,4].map(i=><div key={i} style={{ width:48, height:58, borderRadius:13, ...SH }}/>)}</div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>{[0,1,2,3].map(i=><div key={i} style={{ width:'100%', height:46, borderRadius:12, ...SH }}/>)}</div>
    </Phone>
  );
}

// ─── FRAME 8 · ERROR ────────────────────────────────────────────────────────

function FrameError() {
  return (
    <Phone label="On-behalf · Error" step={2} cta="Try again" ctaIcon="rotate-cw">
      <StepTitle>Choose a time</StepTitle>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', padding:'40px 24px', gap:16 }}>
        <div style={{ width:64, height:64, borderRadius:'50%', background:ERR_BG, color:ERR, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="cloud-off" style={{ width:28, height:28, strokeWidth:1.8 }}/></div>
        <div>
          <div style={{ fontSize:14.5, fontWeight:700, color:E.fg1 }}>Couldn't load availability</div>
          <div style={{ fontSize:12, color:E.fg3, marginTop:6, maxWidth:200, lineHeight:'17px' }}>Check your connection and try again.</div>
        </div>
      </div>
    </Phone>
  );
}

Object.assign(window, { FrameStep1, FrameStep2, FrameStep3, FrameStep3Invite, FrameStep4, FrameCreated, FrameLoading, FrameError });
