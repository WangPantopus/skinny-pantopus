// Pantopus — Calendarly · Scheduling Onboarding (Home & Business) — shared shell
// Extends the A2 Personal setup-booking-link wizard 1:1 — same Phone shell,
// 56px TopBar with back chevron, StepRail (22px numbered discs, check-on-done,
// 2px connectors, "You're on step X of N" overline), 2-col tile pickers, iOS
// 32×18 toggles, sticky CTA, A18 SuccessHero — recolored per pillar.
//
// Each wizard passes its own pillar palette `P` so Home reads green
// (--color-identity-home) and Business reads violet (--color-identity-business).

// Neutral tokens shared by both pillars (from colors_and_type.css).
const N = {
  bg:'#f6f7f9', surface:'#ffffff', sunken:'#f3f4f6', raised:'#f9fafb',
  border:'#e5e7eb', borderStrong:'#d1d5db',
  fg1:'#111827', fg2:'#374151', fg3:'#6b7280', fg4:'#9ca3af',
  success100:'#d1fae5', success600:'#059669', success700:'#047857',
  error:'#dc2626', errorBg:'#fef2f2', errorBorder:'#fecaca',
};

// Pillar palettes — green Home, violet Business.
const HOME = {
  ...N, accent:'#16a34a', accent700:'#15803d',
  bg50:'#f0fdf4', bg100:'#dcfce7', bg200:'#bbf7d0', shadow:'rgba(22,163,74,0.28)',
};
const BIZ = {
  ...N, accent:'#7c3aed', accent700:'#6d28d9',
  bg50:'#faf5ff', bg100:'#f3e8ff', bg200:'#e9d5ff', shadow:'rgba(124,58,237,0.28)',
};

// ─── Phone shell ───────────────────────────────────────────────

function SB() {
  const c = N.fg1;
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
        width:'100%', height:'100%', background:N.bg, borderRadius:36,
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

// 56px top bar — back chevron, centered title, step count. Pillar chip on right.
function TopBar({ title, step, total }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', padding:'8px 12px', height:56,
      boxSizing:'border-box', background:N.surface, borderBottom:`1px solid ${N.border}`, flexShrink:0,
    }}>
      <button style={{
        width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center',
        background:'transparent', border:'none', cursor:'pointer', color:N.fg1, padding:0,
      }}>
        <i data-lucide="chevron-left" style={{ width:22, height:22 }}/>
      </button>
      <div style={{ flex:1, textAlign:'center', minWidth:0 }}>
        <div style={{ fontSize:16, fontWeight:600, color:N.fg1, letterSpacing:-0.2 }}>{title}</div>
      </div>
      <div style={{ minWidth:36, padding:'0 4px', fontSize:12, fontWeight:600, color:N.fg3, textAlign:'right' }}>
        {step && total ? `${step}/${total}` : ''}
      </div>
    </div>
  );
}

// Pillar identity chip (green Home / violet Business).
function PillarChip({ P, icon, label }) {
  return (
    <div style={{
      display:'inline-flex', alignItems:'center', gap:5, alignSelf:'flex-start',
      padding:'4px 10px', borderRadius:9999, background:P.bg100, color:P.accent700,
      fontSize:10.5, fontWeight:700, letterSpacing:0.06, textTransform:'uppercase',
    }}>
      <i data-lucide={icon} style={{ width:11, height:11, strokeWidth:2.4 }}/>
      {label}
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
      borderTop:`1px solid ${N.border}`, padding:'12px 16px 28px', zIndex:10,
      display:'flex', gap:10, alignItems:'center',
    }}>{children}</div>
  );
}

function PrimaryBtn({ P, children, icon, disabled, flex=1, full }) {
  return (
    <button disabled={disabled} style={{
      flex, width:full?'100%':undefined, height:48, borderRadius:12, border:'none',
      background:disabled?N.sunken:P.accent, color:disabled?N.fg4:'#fff',
      fontSize:14, fontWeight:600, cursor:disabled?'not-allowed':'pointer',
      boxShadow:disabled?'none':`0 6px 16px ${P.shadow}`,
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
      flex, height:48, borderRadius:12, background:N.surface, color:N.fg2,
      border:`1px solid ${N.border}`, fontSize:13, fontWeight:600, cursor:'pointer',
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
      color:N.fg3, marginBottom:8, ...style,
    }}>{children}</div>
  );
}

function Headline({ title, sub }) {
  return (
    <div>
      <h2 style={{ margin:0, fontSize:22, fontWeight:700, color:N.fg1, letterSpacing:-0.3, lineHeight:'28px' }}>{title}</h2>
      <p style={{ margin:'6px 0 0', fontSize:13.5, color:N.fg3, lineHeight:'19px' }}>{sub}</p>
    </div>
  );
}

// iOS 32×18 toggle, fill = pillar accent.
function Toggle({ P, on }) {
  return (
    <div style={{
      width:32, height:18, borderRadius:9, background:on?P.accent:N.borderStrong,
      position:'relative', flexShrink:0,
    }}>
      <div style={{
        position:'absolute', top:2, left:on?16:2, width:14, height:14, borderRadius:'50%',
        background:'#fff', boxShadow:'0 1px 2px rgba(0,0,0,0.2)',
      }}/>
    </div>
  );
}

function Shimmer({ w='100%', h=12, r=6, style={} }) {
  return (
    <div style={{
      width:w, height:h, borderRadius:r,
      background:'linear-gradient(90deg, #eef0f3 0%, #f6f7f9 50%, #eef0f3 100%)',
      backgroundSize:'200% 100%', animation:'sh-shimmer 1.4s ease-in-out infinite', ...style,
    }}/>
  );
}

// ─── StepRail (numbered discs, pillar-colored) ─────────────────

function StepRail({ P, steps, current, done=[] }) {
  return (
    <div>
      <OverlineLabel style={{ marginBottom:6 }}>You're on step {current} of {steps.length}</OverlineLabel>
      <div style={{
        display:'flex', alignItems:'center', gap:4,
        background:N.surface, border:`1px solid ${N.border}`, borderRadius:12, padding:'10px 12px',
      }}>
        {steps.map((s, i) => {
          const isDone = done.includes(s.n) || s.n < current;
          const active = s.n === current;
          return (
            <React.Fragment key={s.n}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flex:'0 0 auto' }}>
                <div style={{
                  width:22, height:22, borderRadius:'50%',
                  background:(isDone||active)?P.accent:N.sunken,
                  color:(isDone||active)?'#fff':N.fg4,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:10.5, fontWeight:700, letterSpacing:-0.1,
                  boxShadow:active?`0 0 0 2px ${P.accent}, 0 0 0 4px ${P.bg100}`:'none',
                }}>{isDone ? <i data-lucide="check" style={{ width:11, height:11, strokeWidth:3 }}/> : s.n}</div>
                <div style={{
                  fontSize:9.5, fontWeight:active?700:500,
                  color:active?P.accent700:(isDone?N.fg2:N.fg4), letterSpacing:-0.05,
                }}>{s.label}</div>
              </div>
              {i < steps.length-1 && (
                <div style={{ flex:1, height:2, background:(s.n<current||done.includes(s.n))?P.accent:N.border, marginBottom:14, borderRadius:2 }}/>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ─── Composed-availability explainer (always visible where members compose) ──

function ComposedAvailability({ P, body }) {
  return (
    <div style={{
      background:P.bg50, border:`1px solid ${P.bg200}`, borderRadius:12, padding:'12px 14px',
      display:'flex', flexDirection:'column', gap:10,
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
        <div style={{
          width:30, height:30, borderRadius:8, flexShrink:0, background:P.accent, color:'#fff',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <i data-lucide="calendar-clock" style={{ width:15, height:15, strokeWidth:2.2 }}/>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12.5, fontWeight:700, color:P.accent700, letterSpacing:-0.1, marginBottom:2 }}>Availability is composed automatically</div>
          <div style={{ fontSize:12, color:N.fg2, lineHeight:'17px', letterSpacing:-0.05 }}>{body}</div>
        </div>
      </div>
      {/* shared-timezone confirm chip */}
      <div style={{
        display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:9,
        background:N.surface, border:`1px solid ${P.bg200}`,
      }}>
        <i data-lucide="globe" style={{ width:14, height:14, color:P.accent }}/>
        <span style={{ fontSize:11.5, color:N.fg2, fontWeight:600, letterSpacing:-0.05, flex:1 }}>Everyone's set to America/New_York</span>
        <span style={{
          display:'inline-flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:9999,
          background:N.success100, color:N.success700, fontSize:10, fontWeight:700, letterSpacing:0.04, textTransform:'uppercase',
        }}>
          <i data-lucide="check" style={{ width:10, height:10, strokeWidth:3 }}/> Confirmed
        </span>
      </div>
    </div>
  );
}

// ─── SuccessHero (A18) — pillar-colored, with booking link ─────

function SuccessHero({ P, icon, title, sub, link }) {
  return (
    <div style={{
      flex:1, display:'flex', flexDirection:'column', alignItems:'center',
      textAlign:'center', padding:'24px 28px 0',
    }}>
      <div style={{ position:'relative', width:96, height:96, marginBottom:22 }}>
        <div style={{
          position:'absolute', inset:0, borderRadius:'50%',
          background:`radial-gradient(circle at 30% 30%, ${P.bg50} 0%, ${P.bg100} 100%)`,
        }}/>
        <div style={{
          position:'absolute', inset:18, borderRadius:'50%', background:P.accent,
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:`0 8px 20px ${P.shadow}`,
        }}>
          <i data-lucide={icon} style={{ width:32, height:32, color:'#fff', strokeWidth:3 }}/>
        </div>
      </div>
      <div style={{ fontSize:22, fontWeight:700, color:N.fg1, letterSpacing:-0.3, marginBottom:8 }}>{title}</div>
      <div style={{ fontSize:13.5, color:N.fg3, lineHeight:'19px', maxWidth:280, marginBottom:22 }}>{sub}</div>
      <div style={{
        width:'100%', display:'flex', alignItems:'center', gap:10,
        background:N.surface, border:`1px solid ${N.border}`, borderRadius:12,
        padding:'12px 14px', boxShadow:'0 1px 3px rgba(0,0,0,0.05)',
      }}>
        <i data-lucide="link" style={{ width:16, height:16, color:P.accent, flexShrink:0 }}/>
        <code style={{
          flex:1, minWidth:0, textAlign:'left',
          fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize:12.5, color:N.fg1,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        }}>{link}</code>
        <button style={{
          display:'inline-flex', alignItems:'center', gap:5, padding:'7px 11px', borderRadius:8,
          background:P.bg50, border:`1px solid ${P.bg200}`, color:P.accent700,
          fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0,
        }}>
          <i data-lucide="copy" style={{ width:13, height:13 }}/> Copy
        </button>
      </div>
    </div>
  );
}

Object.assign(window, {
  N, HOME, BIZ,
  SB, Phone, TopBar, PillarChip, ScrollArea, StickyBottom, PrimaryBtn, GhostBtn,
  OverlineLabel, Headline, Toggle, Shimmer, StepRail, ComposedAvailability, SuccessHero,
});
