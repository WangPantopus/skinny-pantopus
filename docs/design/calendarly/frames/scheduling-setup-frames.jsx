// Pantopus — Calendarly · Set up your booking link (first-run wizard)
// Copies A12.11 Start a Support Train wizard 1:1 — StepRail (numbered 22px
// discs, check on done, 2px connectors, "You're on step X of N" overline),
// 2-col tile picker, iOS visibility toggles, sticky CTA — recolored from the
// warm support-train tone to Personal sky (--color-identity-personal).
// SuccessHero borrows A18 status-screen pattern.
//
// 6 frames: Step 1 claim handle (default) · handle-taken conflict ·
//           availability loading · Step 3 hours + timezone · Step 4 success ·
//           resume (re-entered at step 3).

const P = {
  primary50:'#f0f9ff', primary100:'#e0f2fe', primary200:'#bae6fd',
  primary600:'#0284c7', primary700:'#0369a1',
  bg:'#f6f7f9', surface:'#ffffff', sunken:'#f3f4f6', raised:'#f9fafb',
  border:'#e5e7eb', borderStrong:'#d1d5db',
  fg1:'#111827', fg2:'#374151', fg3:'#6b7280', fg4:'#9ca3af',
  success50:'#f0fdf4', success100:'#d1fae5', success600:'#059669', success700:'#047857',
  error:'#dc2626', errorBg:'#fef2f2', errorBorder:'#fecaca',
  warning50:'#fffbeb', warning100:'#fde68a', warning600:'#d97706', warning700:'#b45309',
};

const STEPS = [
  { n:1, label:'Link' },
  { n:2, label:'Type' },
  { n:3, label:'Hours' },
  { n:4, label:'Share' },
];

// ─── Phone shell ───────────────────────────────────────────────

function SB() {
  const c = P.fg1;
  return (
    <div style={{
      display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'16px 28px 0', height:44, boxSizing:'border-box',
      fontFamily:'-apple-system, system-ui', fontWeight:600, fontSize:15, color:c, flexShrink:0,
    }}>
      <span>9:41</span>
      <div style={{ display:'flex', gap:5, alignItems:'center' }}>
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={c}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={c}/><rect x="9" y="2" width="3" height="9" rx="0.6" fill={c}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={c}/></svg>
        <svg width="15" height="11" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={c}/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={c}/><circle cx="7.5" cy="9" r="1.3" fill={c}/></svg>
        <svg width="24" height="11" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={c} strokeOpacity="0.35" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill={c}/><path d="M22.5 3.8v3.4c.6-.2 1-.8 1-1.7s-.4-1.5-1-1.7z" fill={c} fillOpacity="0.4"/></svg>
      </div>
    </div>
  );
}

function Phone({ children, label }) {
  return (
    <div style={{
      width:360, height:740, borderRadius:46, padding:10, background:'#0b0f17',
      boxShadow:'0 40px 80px rgba(17,24,39,0.22), 0 0 0 1px rgba(0,0,0,0.14)',
    }} data-screen-label={label}>
      <div style={{
        width:'100%', height:'100%', background:P.bg, borderRadius:36,
        overflow:'hidden', position:'relative', display:'flex', flexDirection:'column',
        fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          position:'absolute', top:9, left:'50%', transform:'translateX(-50%)',
          width:108, height:30, borderRadius:20, background:'#000', zIndex:50,
        }}/>
        <SB/>
        {children}
        <div style={{
          position:'absolute', bottom:6, left:'50%', transform:'translateX(-50%)',
          width:120, height:4, borderRadius:4, background:'rgba(0,0,0,0.25)', zIndex:60,
        }}/>
      </div>
    </div>
  );
}

// 56px top bar — back chevron, centered title, step count.
function TopBar({ title, step, total }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', padding:'8px 12px', height:56,
      boxSizing:'border-box', background:P.surface, borderBottom:`1px solid ${P.border}`, flexShrink:0,
    }}>
      <button style={{
        width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center',
        background:'transparent', border:'none', cursor:'pointer', color:P.fg1, padding:0,
      }}>
        <i data-lucide="chevron-left" style={{ width:22, height:22 }}/>
      </button>
      <div style={{ flex:1, textAlign:'center', minWidth:0 }}>
        <div style={{ fontSize:16, fontWeight:600, color:P.fg1, letterSpacing:-0.2 }}>{title}</div>
      </div>
      <div style={{ minWidth:36, padding:'0 4px', fontSize:12, fontWeight:600, color:P.fg3, textAlign:'right' }}>
        {step && total ? `${step}/${total}` : ''}
      </div>
    </div>
  );
}

function ScrollArea({ children, bottomPad=108 }) {
  return (
    <div style={{
      flex:1, overflow:'auto', padding:`16px 16px ${bottomPad}px`,
      display:'flex', flexDirection:'column', gap:16,
    }}>{children}</div>
  );
}

function StickyBottom({ children }) {
  return (
    <div style={{
      position:'absolute', bottom:0, left:0, right:0,
      background:'rgba(255,255,255,0.96)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
      borderTop:`1px solid ${P.border}`, padding:'12px 16px 28px', zIndex:10,
      display:'flex', gap:10, alignItems:'center',
    }}>{children}</div>
  );
}

function PrimaryBtn({ children, icon, disabled, flex=1, full }) {
  return (
    <button disabled={disabled} style={{
      flex, width:full?'100%':undefined, height:48, borderRadius:12, border:'none',
      background:disabled?P.sunken:P.primary600, color:disabled?P.fg4:'#fff',
      fontSize:14, fontWeight:600, cursor:disabled?'not-allowed':'pointer',
      boxShadow:disabled?'none':'0 6px 16px rgba(2,132,199,0.28)',
      display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, letterSpacing:-0.1,
    }}>
      {children}
      {icon && <i data-lucide={icon} style={{ width:16, height:16 }}/>}
    </button>
  );
}

function GhostBtn({ children, icon, flex }) {
  return (
    <button style={{
      flex, height:48, borderRadius:12, background:P.surface, color:P.fg2,
      border:`1px solid ${P.border}`, fontSize:13, fontWeight:600, cursor:'pointer',
      display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, letterSpacing:-0.1, padding:'0 14px',
    }}>
      {icon && <i data-lucide={icon} style={{ width:15, height:15 }}/>}
      {children}
    </button>
  );
}

function OverlineLabel({ children, style={} }) {
  return (
    <div style={{
      fontSize:10.5, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase',
      color:P.fg3, marginBottom:8, ...style,
    }}>{children}</div>
  );
}

function Headline({ title, sub }) {
  return (
    <div>
      <h2 style={{ margin:0, fontSize:22, fontWeight:700, color:P.fg1, letterSpacing:-0.3, lineHeight:'28px' }}>{title}</h2>
      <p style={{ margin:'6px 0 0', fontSize:13.5, color:P.fg3, lineHeight:'19px' }}>{sub}</p>
    </div>
  );
}

// ─── StepRail (numbered discs, recolored sky) ──────────────────

function StepRail({ current, done=[] }) {
  return (
    <div>
      <OverlineLabel style={{ marginBottom:6 }}>You're on step {current} of {STEPS.length}</OverlineLabel>
      <div style={{
        display:'flex', alignItems:'center', gap:4,
        background:P.surface, border:`1px solid ${P.border}`, borderRadius:12, padding:'10px 12px',
      }}>
        {STEPS.map((s, i) => {
          const isDone = done.includes(s.n) || s.n < current;
          const active = s.n === current;
          return (
            <React.Fragment key={s.n}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flex:'0 0 auto' }}>
                <div style={{
                  width:22, height:22, borderRadius:'50%',
                  background:(isDone||active)?P.primary600:P.sunken,
                  color:(isDone||active)?'#fff':P.fg4,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:10.5, fontWeight:700, letterSpacing:-0.1,
                  boxShadow:active?`0 0 0 2px ${P.primary600}, 0 0 0 4px ${P.primary100}`:'none',
                }}>{isDone ? <i data-lucide="check" style={{ width:11, height:11, strokeWidth:3 }}/> : s.n}</div>
                <div style={{
                  fontSize:9.5, fontWeight:active?700:500,
                  color:active?P.primary600:(isDone?P.fg2:P.fg4), letterSpacing:-0.05,
                }}>{s.label}</div>
              </div>
              {i < STEPS.length-1 && (
                <div style={{ flex:1, height:2, background:(s.n<current||done.includes(s.n))?P.primary600:P.border, marginBottom:14, borderRadius:2 }}/>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ─── Handle field (step 1) ─────────────────────────────────────

function Shimmer({ w='100%', h=12, r=6, style={} }) {
  return (
    <div style={{
      width:w, height:h, borderRadius:r,
      background:'linear-gradient(90deg, #eef0f3 0%, #f6f7f9 50%, #eef0f3 100%)',
      backgroundSize:'200% 100%', animation:'sh-shimmer 1.4s ease-in-out infinite', ...style,
    }}/>
  );
}

function HandleField({ state }) {
  const taken = state === 'taken';
  const borderColor = taken ? P.errorBorder : P.border;
  return (
    <div>
      <OverlineLabel>Your link</OverlineLabel>
      <div style={{
        display:'flex', alignItems:'center', gap:0,
        background:P.surface, border:`1.5px solid ${borderColor}`, borderRadius:8,
        padding:'12px 14px', boxShadow: taken ? 'none' : '0 1px 2px rgba(0,0,0,0.03)',
        fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace',
      }}>
        <span style={{ fontSize:13, color:P.fg3 }}>pantopus.com/book/</span>
        <span style={{ fontSize:13, color:P.fg1, fontWeight:600 }}>maria-k</span>
        <span style={{
          width:1.5, height:16, background:taken?P.error:P.primary600, marginLeft:1,
          display:'inline-block', borderRadius:1,
        }}/>
        <span style={{ flex:1 }}/>
        <i data-lucide={taken ? 'circle-alert' : 'pencil'} style={{ width:15, height:15, color: taken?P.error:P.fg4 }}/>
      </div>

      {/* status row */}
      {state === 'available' && (
        <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:8 }}>
          <span style={{
            display:'inline-flex', alignItems:'center', gap:5, padding:'4px 9px', borderRadius:9999,
            background:P.success100, color:P.success700, fontSize:11.5, fontWeight:700,
          }}>
            <i data-lucide="check" style={{ width:12, height:12, strokeWidth:3 }}/> Available
          </span>
          <span style={{ fontSize:11.5, color:P.fg3 }}>People will book you at this link.</span>
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
            <i data-lucide="circle-alert" style={{ width:13, height:13, color:P.error }}/>
            <span style={{ fontSize:12, fontWeight:600, color:P.error }}>That link is taken</span>
          </div>
          <div style={{ marginTop:10 }}>
            <div style={{ fontSize:11, color:P.fg3, marginBottom:7 }}>Try one of these:</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {['maria-k2','maria-kowalski','mariak-wa'].map((s) => (
                <button key={s} style={{
                  display:'inline-flex', alignItems:'center', gap:6, padding:'7px 11px', borderRadius:9999,
                  background:P.primary50, border:`1px solid ${P.primary100}`, color:P.primary700,
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

// ─── Timezone chip (step 3) ────────────────────────────────────

function TimezoneRow() {
  return (
    <div>
      <OverlineLabel>Timezone</OverlineLabel>
      <button style={{
        display:'inline-flex', alignItems:'center', gap:8, padding:'9px 12px', borderRadius:9999,
        background:P.primary50, border:`1px solid ${P.primary100}`, color:P.primary700,
        fontSize:13, fontWeight:600, cursor:'pointer', letterSpacing:-0.05,
      }}>
        <i data-lucide="globe" style={{ width:15, height:15 }}/>
        America/New_York
        <span style={{
          padding:'2px 7px', borderRadius:9999, background:P.surface, border:`1px solid ${P.primary100}`,
          fontSize:9.5, fontWeight:700, letterSpacing:0.04, textTransform:'uppercase', color:P.primary600,
        }}>Auto</span>
        <i data-lucide="chevron-down" style={{ width:14, height:14 }}/>
      </button>
    </div>
  );
}

// ─── Weekday + time-range grid (step 3) ────────────────────────

function DayRow({ day, on, range, last }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
      borderBottom: last ? 'none' : `1px solid ${P.border}`,
    }}>
      {/* toggle */}
      <div style={{
        width:32, height:18, borderRadius:9, background:on?P.primary600:P.borderStrong,
        position:'relative', flexShrink:0,
      }}>
        <div style={{
          position:'absolute', top:2, left:on?16:2, width:14, height:14, borderRadius:'50%',
          background:'#fff', boxShadow:'0 1px 2px rgba(0,0,0,0.2)',
        }}/>
      </div>
      <span style={{ width:78, fontSize:13.5, fontWeight:600, color:on?P.fg1:P.fg4, letterSpacing:-0.1 }}>{day}</span>
      {on ? (
        <button style={{
          marginLeft:'auto', display:'inline-flex', alignItems:'center', gap:7, padding:'7px 11px', borderRadius:9,
          background:P.surface, border:`1px solid ${P.border}`, color:P.fg1,
          fontSize:12.5, fontWeight:600, cursor:'pointer', letterSpacing:-0.05,
          fontVariantNumeric:'tabular-nums',
        }}>
          <i data-lucide="clock" style={{ width:13, height:13, color:P.primary600 }}/>
          {range}
          <i data-lucide="chevron-right" style={{ width:13, height:13, color:P.fg4 }}/>
        </button>
      ) : (
        <span style={{ marginLeft:'auto', fontSize:12, color:P.fg4, fontWeight:500 }}>Unavailable</span>
      )}
    </div>
  );
}

function WeekdayGrid() {
  const days = [
    { day:'Monday',    on:true,  range:'9:00 AM – 5:00 PM' },
    { day:'Tuesday',   on:true,  range:'9:00 AM – 5:00 PM' },
    { day:'Wednesday', on:true,  range:'9:00 AM – 5:00 PM' },
    { day:'Thursday',  on:true,  range:'9:00 AM – 5:00 PM' },
    { day:'Friday',    on:true,  range:'9:00 AM – 5:00 PM' },
    { day:'Saturday',  on:false },
    { day:'Sunday',    on:false },
  ];
  return (
    <div>
      <OverlineLabel>Weekly hours</OverlineLabel>
      <div style={{
        background:P.surface, border:`1px solid ${P.border}`, borderRadius:12, overflow:'hidden',
        boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
      }}>
        {days.map((d, i) => (
          <DayRow key={d.day} {...d} last={i===days.length-1}/>
        ))}
      </div>
    </div>
  );
}

// ─── Resume banner ─────────────────────────────────────────────

function ResumeBanner() {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
      background:P.primary50, border:`1px solid ${P.primary100}`, borderRadius:12,
    }}>
      <div style={{
        width:34, height:34, borderRadius:9, background:P.surface, color:P.primary600,
        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
        border:`1px solid ${P.primary100}`,
      }}>
        <i data-lucide="rotate-ccw" style={{ width:17, height:17 }}/>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:700, color:P.fg1, letterSpacing:-0.1 }}>Pick up where you left off</div>
        <div style={{ fontSize:11.5, color:P.fg3, marginTop:1 }}>Steps 1–2 are done. Set your hours to finish.</div>
      </div>
    </div>
  );
}

// ─── Success hero (A18) ────────────────────────────────────────

function SuccessHero() {
  return (
    <div style={{
      flex:1, display:'flex', flexDirection:'column', alignItems:'center',
      textAlign:'center', padding:'24px 28px 0',
    }}>
      <div style={{ position:'relative', width:96, height:96, marginBottom:22 }}>
        <div style={{
          position:'absolute', inset:0, borderRadius:'50%',
          background:`radial-gradient(circle at 30% 30%, ${P.primary50} 0%, ${P.primary100} 100%)`,
        }}/>
        <div style={{
          position:'absolute', inset:18, borderRadius:'50%', background:P.primary600,
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:'0 8px 20px rgba(2,132,199,0.32)',
        }}>
          <i data-lucide="check" style={{ width:32, height:32, color:'#fff', strokeWidth:3 }}/>
        </div>
      </div>
      <div style={{ fontSize:22, fontWeight:700, color:P.fg1, letterSpacing:-0.3, marginBottom:8 }}>You're all set</div>
      <div style={{ fontSize:13.5, color:P.fg3, lineHeight:'19px', maxWidth:280, marginBottom:22 }}>
        Your booking link is live. Share it and people can book a 30-minute meeting during your weekly hours.
      </div>

      {/* live link copy card */}
      <div style={{
        width:'100%', display:'flex', alignItems:'center', gap:10,
        background:P.surface, border:`1px solid ${P.border}`, borderRadius:12,
        padding:'12px 14px', boxShadow:'0 1px 3px rgba(0,0,0,0.05)',
      }}>
        <i data-lucide="link" style={{ width:16, height:16, color:P.primary600, flexShrink:0 }}/>
        <code style={{
          flex:1, minWidth:0, textAlign:'left',
          fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize:12.5, color:P.fg1,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        }}>pantopus.com/book/maria-k</code>
        <button style={{
          display:'inline-flex', alignItems:'center', gap:5, padding:'7px 11px', borderRadius:8,
          background:P.primary50, border:`1px solid ${P.primary100}`, color:P.primary700,
          fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0,
        }}>
          <i data-lucide="copy" style={{ width:13, height:13 }}/> Copy
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 1 · STEP 1 — claim handle (available)
// ═══════════════════════════════════════════════════════════════

function FrameStep1() {
  return (
    <Phone label="A2 Set up booking — Step 1 claim handle">
      <TopBar title="Set up booking" step={1} total={4}/>
      <ScrollArea>
        <StepRail current={1}/>
        <Headline title="Claim your booking link" sub="This is the link you'll share. People book you at it — pick something short and memorable." />
        <HandleField state="available"/>
      </ScrollArea>
      <StickyBottom>
        <PrimaryBtn icon="arrow-right" full>Continue · pick a type</PrimaryBtn>
      </StickyBottom>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 2 · STEP 1 — handle taken (inline error)
// ═══════════════════════════════════════════════════════════════

function FrameConflict() {
  return (
    <Phone label="A2 Set up booking — Step 1 handle taken">
      <TopBar title="Set up booking" step={1} total={4}/>
      <ScrollArea>
        <StepRail current={1}/>
        <Headline title="Claim your booking link" sub="This is the link you'll share. People book you at it — pick something short and memorable." />
        <HandleField state="taken"/>
      </ScrollArea>
      <StickyBottom>
        <PrimaryBtn icon="arrow-right" full disabled>Continue · pick a type</PrimaryBtn>
      </StickyBottom>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 3 · STEP 1 — availability check loading
// ═══════════════════════════════════════════════════════════════

function FrameLoading() {
  return (
    <Phone label="A2 Set up booking — availability check loading">
      <TopBar title="Set up booking" step={1} total={4}/>
      <ScrollArea>
        <StepRail current={1}/>
        <Headline title="Claim your booking link" sub="This is the link you'll share. People book you at it — pick something short and memorable." />
        <HandleField state="loading"/>
      </ScrollArea>
      <StickyBottom>
        <PrimaryBtn icon="arrow-right" full disabled>Continue · pick a type</PrimaryBtn>
      </StickyBottom>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 4 · STEP 3 — default weekly hours + timezone
// ═══════════════════════════════════════════════════════════════

function FrameStep3() {
  return (
    <Phone label="A2 Set up booking — Step 3 hours & timezone">
      <TopBar title="Set up booking" step={3} total={4}/>
      <ScrollArea>
        <StepRail current={3}/>
        <Headline title="Set your weekly hours" sub="People can only book inside these windows. You can fine-tune any day, or just use the defaults." />
        <TimezoneRow/>
        <WeekdayGrid/>
      </ScrollArea>
      <StickyBottom>
        <GhostBtn>Use defaults</GhostBtn>
        <PrimaryBtn icon="arrow-right" flex={1.5}>Continue</PrimaryBtn>
      </StickyBottom>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 5 · STEP 4 — success hero
// ═══════════════════════════════════════════════════════════════

function FrameSuccess() {
  return (
    <Phone label="A2 Set up booking — Step 4 success">
      <TopBar title="Set up booking" step={4} total={4}/>
      <div style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column', paddingBottom:112 }}>
        <div style={{ padding:'16px 16px 0' }}>
          <StepRail current={4} done={[1,2,3,4]}/>
        </div>
        <SuccessHero/>
      </div>
      <StickyBottom>
        <GhostBtn flex={1} icon="plus">Add type</GhostBtn>
        <PrimaryBtn icon="share-2" flex={1.5}>Share link</PrimaryBtn>
      </StickyBottom>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 6 · RESUME — re-entered at step 3, steps 1–2 done
// ═══════════════════════════════════════════════════════════════

function FrameResume() {
  return (
    <Phone label="A2 Set up booking — resume at step 3">
      <TopBar title="Set up booking" step={3} total={4}/>
      <ScrollArea>
        <StepRail current={3} done={[1,2]}/>
        <ResumeBanner/>
        <Headline title="Set your weekly hours" sub="Last step. Set your hours, then share your link." />
        <TimezoneRow/>
        <WeekdayGrid/>
      </ScrollArea>
      <StickyBottom>
        <GhostBtn>Use defaults</GhostBtn>
        <PrimaryBtn icon="arrow-right" flex={1.5}>Continue</PrimaryBtn>
      </StickyBottom>
    </Phone>
  );
}

Object.assign(window, {
  FrameStep1, FrameConflict, FrameLoading, FrameStep3, FrameSuccess, FrameResume,
});
