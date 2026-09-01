// Pantopus — Calendarly · Group G/H shared kit
// Built on event-editor-shell.jsx (window.E, SH). Provides the 300×620 device
// frames (full-screen + bottom-sheet), top bars, and the small atoms every
// Business/automation screen reuses. Load AFTER event-editor-shell.jsx.

const { E, SH } = window;

const C = {
  biz:E.business, bizBg:E.businessBg,
  personal:E.personal, personalBg:E.personalBg,
  home:'#16a34a', homeBg:'#dcfce7',
  warn:'#B45309', warnBg:'#FFFBEB', warnBorder:'#FDE68A', warnSolid:'#D97706',
  err:'#DC2626', errBg:'#FEF2F2', errBorder:'#FCA5A5',
  ok:'#059669', okDk:'#047857', okBg:'#F0FDF4', okBorder:'#A7F3D0',
  info:'#0284c7', infoBg:'#F0F9FF', infoBorder:'#BAE6FD',
  stripe:'#635bff', stripeBg:'#f5f4ff',
};

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

// Full-screen device frame (light app bg).
function Frame({ label, children, bg=E.bg }) {
  return (
    <div style={{ width:300, height:620, borderRadius:40, padding:8, background:'#0b0f17', boxShadow:'0 24px 50px rgba(17,24,39,0.20), 0 0 0 1px rgba(0,0,0,0.12)', flexShrink:0 }} data-screen-label={label}>
      <div style={{ width:'100%', height:'100%', background:bg, borderRadius:32, overflow:'hidden', position:'relative', display:'flex', flexDirection:'column', fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div style={{ position:'absolute', top:7, left:'50%', transform:'translateX(-50%)', width:88, height:24, borderRadius:16, background:'#000', zIndex:50 }}/>
        <DarkStatusBar/>
        {children}
        <div style={{ position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)', width:100, height:4, borderRadius:4, background:'rgba(0,0,0,0.25)', zIndex:60 }}/>
      </div>
    </div>
  );
}

// Bottom-sheet device frame over a dimmed backdrop.
function SheetFrame({ label, title, subhead, closeIcon='x', children, footer, height='90%', behind }) {
  return (
    <div style={{ width:300, height:620, borderRadius:40, padding:8, background:'#0b0f17', boxShadow:'0 24px 50px rgba(17,24,39,0.20), 0 0 0 1px rgba(0,0,0,0.12)', flexShrink:0 }} data-screen-label={label}>
      <div style={{ width:'100%', height:'100%', background:E.bg, borderRadius:32, overflow:'hidden', position:'relative', display:'flex', flexDirection:'column', fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div style={{ position:'absolute', top:7, left:'50%', transform:'translateX(-50%)', width:88, height:24, borderRadius:16, background:'#000', zIndex:50 }}/>
        <DarkStatusBar/>
        <div style={{ flex:1, padding:'14px 16px', opacity:0.4 }}>{behind || (
          <>
            <div style={{ height:22 }}><i data-lucide="chevron-left" style={{ width:20, height:20, color:E.fg2 }}/></div>
            <div style={{ fontSize:18, fontWeight:700, color:E.fg1, marginTop:10 }}>Service editor</div>
          </>
        )}</div>
        <div style={{ position:'absolute', inset:0, background:'rgba(17,24,39,0.42)', zIndex:18 }}/>
        <div style={{ position:'absolute', left:0, right:0, bottom:0, zIndex:20, background:E.surface, borderTopLeftRadius:24, borderTopRightRadius:24, boxShadow:'0 -8px 30px rgba(0,0,0,0.18)', height, display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', justifyContent:'center', paddingTop:9, paddingBottom:title?6:4, flexShrink:0 }}><div style={{ width:36, height:5, borderRadius:9999, background:E.borderStrong }}/></div>
          {title && (
            <div style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'2px 16px 8px', flexShrink:0 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:17, fontWeight:700, color:E.fg1, letterSpacing:-0.3 }}>{title}</div>
                {subhead && <div style={{ fontSize:12, color:E.fg3, marginTop:4, lineHeight:'16px' }}>{subhead}</div>}
              </div>
              {closeIcon && <button aria-label="Close" style={{ width:28, height:28, borderRadius:'50%', border:'none', background:E.sunken, color:E.fg2, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}><i data-lucide={closeIcon} style={{ width:16, height:16 }}/></button>}
            </div>
          )}
          <div style={{ flex:1, overflow:'auto', padding:'4px 16px 12px' }}>{children}</div>
          {footer && <div style={{ flexShrink:0, padding:'10px 16px 20px', borderTop:`1px solid ${E.border}`, background:E.surface }}>{footer}</div>}
        </div>
        <div style={{ position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)', width:100, height:4, borderRadius:4, background:'rgba(255,255,255,0.5)', zIndex:70 }}/>
      </div>
    </div>
  );
}

// Section/full-screen top bar: chevron back · centered title · trailing.
function TopBar({ title, trailing, back=true }) {
  return (
    <div style={{ display:'flex', alignItems:'center', padding:'6px 8px', height:46, boxSizing:'border-box', background:E.surface, borderBottom:`1px solid ${E.border}`, flexShrink:0 }}>
      <button aria-label="Back" style={{ width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'none', cursor:'pointer', color:E.fg1, padding:0, visibility:back?'visible':'hidden' }}>
        <i data-lucide="chevron-left" style={{ width:21, height:21 }}/>
      </button>
      <div style={{ flex:1, textAlign:'center', fontSize:15, fontWeight:600, color:E.fg1, letterSpacing:-0.2 }}>{title}</div>
      <span style={{ minWidth:34, height:34, display:'inline-flex', alignItems:'center', justifyContent:'flex-end', paddingRight:4 }}>{trailing}</span>
    </div>
  );
}

function Scroll({ children, pad='12px 14px 24px' }) {
  return <div style={{ flex:1, overflow:'auto', padding:pad, display:'flex', flexDirection:'column', gap:12 }}>{children}</div>;
}

function Overline({ children, color=E.fg3, top=0 }) {
  return <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color, margin:`${top}px 2px 0` }}>{children}</div>;
}

function Card({ children, pad='4px 13px', style }) {
  return <div style={{ background:E.surface, border:`1px solid ${E.border}`, borderRadius:16, boxShadow:'0 1px 3px rgba(0,0,0,0.04)', padding:pad, ...style }}>{children}</div>;
}

function Disc({ grad, initials, size=34, dim, square }) {
  return <div style={{ width:size, height:size, borderRadius:square?Math.round(size*0.3):'50%', flexShrink:0, background:grad, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.36, fontWeight:700, opacity:dim?0.5:1 }}>{initials}</div>;
}

function Checkbox({ on, color=C.biz }) {
  return (
    <span style={{ width:22, height:22, borderRadius:7, flexShrink:0, display:'inline-flex', alignItems:'center', justifyContent:'center', background:on?color:'transparent', border:on?'none':`1.5px solid ${E.borderStrong}` }}>
      {on && <i data-lucide="check" style={{ width:13, height:13, color:'#fff', strokeWidth:3.2 }}/>}
    </span>
  );
}

function RadioDot({ on, color=C.biz }) {
  return (
    <span style={{ width:22, height:22, borderRadius:'50%', flexShrink:0, display:'inline-flex', alignItems:'center', justifyContent:'center', border:`1.5px solid ${on?color:E.borderStrong}` }}>
      {on && <span style={{ width:11, height:11, borderRadius:'50%', background:color }}/>}
    </span>
  );
}

// iOS 51×31 toggle.
function IToggle({ on, color=E.blue600, disabled }) {
  return (
    <span style={{ width:46, height:28, borderRadius:9999, flexShrink:0, background:disabled?E.sunken:(on?color:'#e5e7eb'), position:'relative', opacity:disabled?0.6:1, transition:'background 120ms' }}>
      <span style={{ position:'absolute', top:2, left:on?20:2, width:24, height:24, borderRadius:'50%', background:'#fff', boxShadow:'0 2px 4px rgba(0,0,0,0.2)', transition:'left 120ms' }}/>
    </span>
  );
}

function Chip({ tone='neutral', children, icon }) {
  const p = {
    success:{bg:C.okBg,fg:C.ok}, warning:{bg:C.warnBg,fg:C.warn}, error:{bg:C.errBg,fg:C.err},
    info:{bg:C.infoBg,fg:C.info}, primary:{bg:E.blue50,fg:E.blue700},
    biz:{bg:C.bizBg,fg:C.biz}, personal:{bg:E.personalBg,fg:E.personal},
    neutral:{bg:E.sunken,fg:E.fg2},
  }[tone];
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:9999, background:p.bg, color:p.fg, fontSize:10, fontWeight:700, letterSpacing:0.04, textTransform:'uppercase', whiteSpace:'nowrap' }}>
      {icon && <i data-lucide={icon} style={{ width:10, height:10, strokeWidth:2.8 }}/>}
      {children}
    </span>
  );
}

function Spinner({ size=16, light }) {
  return <span style={{ width:size, height:size, borderRadius:'50%', border:`2.5px solid ${light?'rgba(255,255,255,0.4)':'rgba(2,132,199,0.25)'}`, borderTopColor:light?'#fff':E.blue600, display:'inline-block', animation:'sh-spin 0.7s linear infinite' }}/>;
}

// Full-width sky primary CTA (functional chrome).
function PrimaryBtn({ children, disabled, saving, icon }) {
  return (
    <button disabled={disabled||saving} style={{ width:'100%', height:46, borderRadius:13, border:'none', background:E.blue600, color:'#fff', fontSize:14.5, fontWeight:700, cursor:(disabled||saving)?'default':'pointer', opacity:disabled?0.45:1, boxShadow:disabled?'none':'0 6px 16px rgba(2,132,199,0.28)', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8 }}>
      {saving ? <><Spinner light/>{children}</> : <>{icon && <i data-lucide={icon} style={{ width:16, height:16 }}/>}{children}</>}
    </button>
  );
}

// Pill stepper (− value + ) with optional accent value chip.
function Stepper({ value, accent, small }) {
  const h = small?22:26, ic = small?11:13;
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:small?4:6, flexShrink:0 }}>
      <button aria-label="Decrease" style={{ width:h, height:h, borderRadius:9999, border:`1px solid ${E.border}`, background:E.surface, color:E.fg2, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}><i data-lucide="minus" style={{ width:ic, height:ic }}/></button>
      <span style={{ minWidth:small?28:34, textAlign:'center', fontSize:small?12:13.5, fontWeight:700, color:accent||E.fg1, fontVariantNumeric:'tabular-nums' }}>{value}</span>
      <button aria-label="Increase" style={{ width:h, height:h, borderRadius:9999, border:`1px solid ${E.border}`, background:E.surface, color:accent||E.blue600, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}><i data-lucide="plus" style={{ width:ic, height:ic }}/></button>
    </div>
  );
}

// Inline note (semantic-tinted) — SLA/warning/info row.
function Note({ tone='info', icon, children }) {
  const p = { info:{bg:C.bizBg,fg:E.fg2,ic:C.biz}, infoBlue:{bg:C.infoBg,fg:E.fg2,ic:C.info}, warning:{bg:C.warnBg,fg:C.warn,ic:C.warn}, error:{bg:C.errBg,fg:C.err,ic:C.err}, success:{bg:C.okBg,fg:C.okDk,ic:C.ok} }[tone];
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:9, padding:'11px 12px', background:p.bg, border:tone==='info'?'none':`1px solid ${tone==='warning'?C.warnBorder:tone==='error'?C.errBorder:tone==='success'?C.okBorder:C.infoBorder}`, borderRadius:12 }}>
      {icon && <i data-lucide={icon} style={{ width:16, height:16, color:p.ic, flexShrink:0, marginTop:1 }}/>}
      <span style={{ fontSize:11.5, color:p.fg, lineHeight:'16px', fontWeight:500 }}>{children}</span>
    </div>
  );
}

// Settings chevron/toggle row (A14.6 vocabulary): icon disc · label · sub · trailing.
function SRow({ icon, iconBg, iconColor, label, sub, trailing, last, dim, onLabel }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:11, padding:'11px 2px', borderBottom: last?'none':`1px solid ${E.border}`, opacity:dim?0.55:1, cursor:'pointer' }}>
      {icon && (
        <div style={{ width:32, height:32, borderRadius:9, flexShrink:0, background:iconBg||E.sunken, color:iconColor||E.fg2, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <i data-lucide={icon} style={{ width:16, height:16, strokeWidth:2 }}/>
        </div>
      )}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600, color:E.fg1, letterSpacing:-0.1 }}>{label}</div>
        {sub && <div style={{ fontSize:11, color:E.fg3, marginTop:1, lineHeight:'14px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sub}</div>}
      </div>
      {trailing !== undefined ? trailing : <i data-lucide="chevron-right" style={{ width:16, height:16, color:E.fg4, flexShrink:0 }}/>}
    </div>
  );
}

// Roster seat row (A10.7): checkbox · avatar · name · caption · trailing.
function SeatRow({ name, grad, initials, caption='Uses personal availability', checked, color=C.biz, trailing, last, dim, noCheck }) {
  return (
    <div role="button" aria-label={`${name}, ${caption}`} style={{ display:'flex', alignItems:'center', gap:11, padding:'10px 2px', borderBottom: last?'none':`1px solid ${E.border}`, opacity:dim?0.55:1, cursor:'pointer' }}>
      {!noCheck && <Checkbox on={checked} color={color}/>}
      <Disc grad={grad} initials={initials} dim={dim}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600, color:E.fg1, letterSpacing:-0.1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{name}</div>
        <div style={{ fontSize:10.5, color:E.fg3, marginTop:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{caption}</div>
      </div>
      {trailing}
    </div>
  );
}

// Empty-state hero (identity-tinted circle).
function EmptyHero({ icon, tintBg, tint, title, body, action }) {
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'24px 30px 60px', gap:12 }}>
      <div style={{ width:72, height:72, borderRadius:'50%', background:tintBg||E.sunken, color:tint||E.fg3, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:2 }}>
        <i data-lucide={icon} style={{ width:30, height:30, strokeWidth:1.8 }}/>
      </div>
      <div style={{ fontSize:17, fontWeight:700, color:E.fg1, letterSpacing:-0.2 }}>{title}</div>
      {body && <div style={{ fontSize:12.5, color:E.fg3, lineHeight:'18px', maxWidth:230 }}>{body}</div>}
      {action && <div style={{ marginTop:6 }}>{action}</div>}
    </div>
  );
}

// Skeleton bar.
function Sk({ w='100%', h=12, r=6, mt=0 }) {
  return <div style={{ width:w, height:h, borderRadius:r, marginTop:mt, ...SH }}/>;
}

Object.assign(window, {
  C, DarkStatusBar, Frame, SheetFrame, TopBar, Scroll, Overline, Card, Disc,
  Checkbox, RadioDot, IToggle, Chip, Spinner, PrimaryBtn, Stepper, Note, SRow,
  SeatRow, EmptyHero, Sk,
});
