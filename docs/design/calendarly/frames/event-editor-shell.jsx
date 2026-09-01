// Pantopus — Calendarly · Event Type / Service Editor — form primitives
// Archetype: Form (one form for create + edit). Mirrors Form.html for field
// grouping and A13 Edit Business Page for the long sectioned settings form with
// a sticky bottom save bar; A14.8 Vacation hold toggle-row idiom for the switches.
// Lives in: Personal/Business → Scheduling → Event type → Edit. web
// /app/profile/schedule/event/:id. owner_type drives the pillar.
//
// Non-negotiables: product sky #0284C7 on all functional chrome; pillar accent
// (Personal sky / Business violet) ONLY on the header pill + section overlines.
// White cards, 1px border, 16px radius, shadow-sm, no left-border accents.
// Lucide stroke-2, no emoji, shimmer skeletons.

const E = {
  blue50:'#f0f9ff', blue100:'#e0f2fe', blue200:'#bae6fd', blue600:'#0284c7', blue700:'#0369a1',
  personal:'#0284c7', personalBg:'#dbeafe',
  business:'#7c3aed', businessBg:'#f3e8ff',
  bg:'#f6f7f9', surface:'#ffffff', sunken:'#f3f4f6', raised:'#f9fafb',
  border:'#e5e7eb', borderStrong:'#d1d5db',
  fg1:'#111827', fg2:'#374151', fg3:'#6b7280', fg4:'#9ca3af',
  error:'#dc2626', errorBg:'#fef2f2', errorBorder:'#fca5a5',
  success600:'#059669', success100:'#d1fae5', success700:'#047857',
  warning:'#d97706', warningBg:'#fffbeb', warningBorder:'#fde68a',
  stripe:'#635bff', stripeBg:'#f5f4ff',
};

const SWATCHES = ['#2980b9','#0284c7','#16a34a','#0d9488','#7c3aed','#d97706','#f97316','#e11d48'];

const SH = {
  background:'linear-gradient(90deg, #eef0f3 0%, #f6f7f9 50%, #eef0f3 100%)',
  backgroundSize:'200% 100%', animation:'sh-shimmer 1.4s ease-in-out infinite',
};

// ─── Phone shell (300×620) ─────────────────────────────────────

function StatusBar() {
  const c = E.fg1;
  return (
    <div style={{
      display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'12px 22px 0', height:34, boxSizing:'border-box',
      fontFamily:'-apple-system, system-ui', fontWeight:600, fontSize:12.5, color:c, flexShrink:0,
    }}>
      <span>9:41</span>
      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
        <svg width="15" height="10" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={c}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={c}/><rect x="9" y="2" width="3" height="9" rx="0.6" fill={c}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={c}/></svg>
        <svg width="13" height="10" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={c}/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={c}/><circle cx="7.5" cy="9" r="1.3" fill={c}/></svg>
        <svg width="21" height="10" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={c} strokeOpacity="0.35" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill={c}/><path d="M22.5 3.8v3.4c.6-.2 1-.8 1-1.7s-.4-1.5-1-1.7z" fill={c} fillOpacity="0.4"/></svg>
      </div>
    </div>
  );
}

function Phone({ children, label }) {
  return (
    <div style={{
      width:300, height:620, borderRadius:40, padding:8, background:'#0b0f17',
      boxShadow:'0 24px 50px rgba(17,24,39,0.20), 0 0 0 1px rgba(0,0,0,0.12)', flexShrink:0,
    }} data-screen-label={label}>
      <div style={{
        width:'100%', height:'100%', background:E.bg, borderRadius:32,
        overflow:'hidden', position:'relative', display:'flex', flexDirection:'column',
        fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          position:'absolute', top:7, left:'50%', transform:'translateX(-50%)',
          width:88, height:24, borderRadius:16, background:'#000', zIndex:50,
        }}/>
        <StatusBar/>
        {children}
        <div style={{
          position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)',
          width:100, height:4, borderRadius:4, background:'rgba(0,0,0,0.25)', zIndex:60,
        }}/>
      </div>
    </div>
  );
}

// Top bar: chevron back · "Event type" · Save text action.
function TopBar({ title='Event type', saving }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', padding:'6px 10px', height:46,
      boxSizing:'border-box', background:E.surface, borderBottom:`1px solid ${E.border}`, flexShrink:0,
    }}>
      <button style={{
        width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center',
        background:'transparent', border:'none', cursor:'pointer', color:E.fg1, padding:0,
      }}>
        <i data-lucide="chevron-left" style={{ width:20, height:20 }}/>
      </button>
      <div style={{ flex:1, textAlign:'center', fontSize:15, fontWeight:600, color:E.fg1, letterSpacing:-0.2 }}>{title}</div>
      <button style={{
        minWidth:32, height:30, padding:'0 8px', display:'flex', alignItems:'center', justifyContent:'flex-end',
        background:'transparent', border:'none', cursor:saving?'default':'pointer',
        color:saving?E.fg4:E.blue600, fontSize:14, fontWeight:700, letterSpacing:-0.1,
      }}>{saving ? 'Saving' : 'Save'}</button>
    </div>
  );
}

// Header pill (pillar color) — only place beside overlines that carries pillar.
function HeaderPill({ pillar='personal' }) {
  const isBiz = pillar === 'business';
  return (
    <div style={{ padding:'10px 12px 2px', flexShrink:0 }}>
      <div style={{
        display:'inline-flex', alignItems:'center', gap:5,
        padding:'3px 9px', borderRadius:9999,
        background:isBiz?E.businessBg:E.personalBg, color:isBiz?E.business:E.personal,
        fontSize:10, fontWeight:700, letterSpacing:0.05, textTransform:'uppercase',
      }}>
        <i data-lucide={isBiz?'briefcase':'user'} style={{ width:11, height:11, strokeWidth:2.4 }}/>
        {isBiz ? 'Business' : 'Personal'}
      </div>
    </div>
  );
}

function Body({ children }) {
  return (
    <div style={{
      flex:1, overflow:'auto', padding:'8px 12px 84px',
      display:'flex', flexDirection:'column', gap:12,
    }}>{children}</div>
  );
}

// White card with a pillar-colored overline label.
function Card({ overline, pillar='personal', action, children, collapsedChevron, open }) {
  const accent = pillar === 'business' ? E.business : E.personal;
  return (
    <div style={{
      background:E.surface, border:`1px solid ${E.border}`, borderRadius:16,
      boxShadow:'0 1px 3px rgba(0,0,0,0.04)', padding:'13px 13px',
      display:'flex', flexDirection:'column', gap:11,
    }}>
      {overline && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:accent }}>{overline}</div>
          {collapsedChevron != null
            ? <i data-lucide={open?'chevron-up':'chevron-down'} style={{ width:16, height:16, color:E.fg4 }}/>
            : (action || null)}
        </div>
      )}
      {children}
    </div>
  );
}

function FieldLabel({ children }) {
  return <div style={{ fontSize:11, fontWeight:600, color:E.fg2, marginBottom:5, letterSpacing:-0.05 }}>{children}</div>;
}

function TextInput({ label, value, placeholder, mono, disabled, error, helper, multiline }) {
  return (
    <div>
      {label && <FieldLabel>{label}</FieldLabel>}
      <div style={{
        background:disabled?E.raised:E.surface,
        border:`1.5px solid ${error?E.error:E.border}`, borderRadius:8,
        padding: multiline ? '9px 11px' : '10px 11px', minHeight: multiline ? 48 : undefined,
        boxShadow: error ? `0 0 0 3px ${E.errorBg}` : '0 1px 2px rgba(0,0,0,0.03)',
        opacity:disabled?0.7:1,
      }}>
        <span style={{
          fontSize:13, color: value ? E.fg1 : E.fg4, fontWeight: value ? 500 : 400,
          letterSpacing:-0.1, lineHeight:'18px',
          fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined,
        }}>{value || placeholder}</span>
      </div>
      {helper && (
        <div style={{
          marginTop:6, fontSize:10.5, color:error?E.error:E.fg3, lineHeight:'14px',
          display:'flex', alignItems:'flex-start', gap:4,
        }}>
          {error && <i data-lucide="circle-alert" style={{ width:11, height:11, flexShrink:0, marginTop:1 }}/>}
          {helper}
        </div>
      )}
    </div>
  );
}

function ColorSwatches({ selectedIndex=1 }) {
  return (
    <div>
      <FieldLabel>Color</FieldLabel>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {SWATCHES.map((c, i) => {
          const on = i === selectedIndex;
          return (
            <div key={c} style={{
              width:24, height:24, borderRadius:'50%', background:c, cursor:'pointer',
              boxShadow: on ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : 'none',
            }}/>
          );
        })}
      </div>
    </div>
  );
}

function Segmented({ options, value, disabled, small }) {
  return (
    <div style={{
      display:'flex', gap:3, padding:3, background:E.sunken, borderRadius:9, opacity:disabled?0.6:1,
    }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <button key={o} style={{
            flex:1, height: small?28:32, borderRadius:7, cursor:disabled?'not-allowed':'pointer', border:'none',
            background:on?E.surface:'transparent', color:on?E.blue700:E.fg3,
            boxShadow:on?'0 1px 2px rgba(0,0,0,0.08)':'none',
            fontSize: small?11:11.5, fontWeight:on?700:600, letterSpacing:-0.1, whiteSpace:'nowrap',
          }}>{o}</button>
        );
      })}
    </div>
  );
}

function Stepper({ value, unit, disabled, error }) {
  return (
    <div style={{
      display:'inline-flex', alignItems:'center', gap:0,
      border:`1.5px solid ${error?E.error:E.border}`, borderRadius:8, overflow:'hidden',
      background:disabled?E.raised:E.surface, opacity:disabled?0.7:1,
      boxShadow: error ? `0 0 0 3px ${E.errorBg}` : 'none',
    }}>
      <button style={{
        width:30, height:36, border:'none', background:'transparent', cursor:'pointer',
        color:E.fg2, display:'flex', alignItems:'center', justifyContent:'center', borderRight:`1px solid ${E.border}`,
      }}><i data-lucide="minus" style={{ width:14, height:14 }}/></button>
      <div style={{
        minWidth:46, padding:'0 8px', height:36, display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:13, fontWeight:700, color:E.fg1, letterSpacing:-0.1, fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap',
      }}>{value}{unit && <span style={{ color:E.fg3, fontWeight:600, marginLeft:3, fontSize:11 }}>{unit}</span>}</div>
      <button style={{
        width:30, height:36, border:'none', background:'transparent', cursor:'pointer',
        color:E.blue600, display:'flex', alignItems:'center', justifyContent:'center', borderLeft:`1px solid ${E.border}`,
      }}><i data-lucide="plus" style={{ width:14, height:14 }}/></button>
    </div>
  );
}

function QuickChip({ label }) {
  return (
    <button style={{
      display:'inline-flex', alignItems:'center', gap:4, padding:'7px 11px', borderRadius:9999,
      background:E.surface, border:`1px solid ${E.border}`, color:E.fg2,
      fontSize:11.5, fontWeight:600, cursor:'pointer',
    }}>
      <i data-lucide="plus" style={{ width:11, height:11, color:E.blue600 }}/>{label}
    </button>
  );
}

// Link-out row (chevron) — used for Availability + bottom links.
function LinkRow({ icon, label, value, last }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:11, padding:'11px 2px',
      borderBottom: last ? 'none' : `1px solid ${E.border}`, cursor:'pointer',
    }}>
      <div style={{
        width:30, height:30, borderRadius:8, flexShrink:0, background:E.sunken, color:E.fg2,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}><i data-lucide={icon} style={{ width:15, height:15, strokeWidth:2 }}/></div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600, color:E.fg1, letterSpacing:-0.1 }}>{label}</div>
        {value && <div style={{ fontSize:11, color:E.fg3, marginTop:1 }}>{value}</div>}
      </div>
      <i data-lucide="chevron-right" style={{ width:16, height:16, color:E.fg4 }}/>
    </div>
  );
}

// Toggle row (A14.8 idiom) — switch on the right.
function ToggleRow({ icon, label, sub, on, disabled, last }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:11, padding:'10px 2px',
      borderBottom: last ? 'none' : `1px solid ${E.border}`, opacity:disabled?0.7:1,
    }}>
      {icon && (
        <div style={{
          width:30, height:30, borderRadius:8, flexShrink:0,
          background:on?E.blue50:E.sunken, color:on?E.blue600:E.fg3,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}><i data-lucide={icon} style={{ width:15, height:15, strokeWidth:2 }}/></div>
      )}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12.5, fontWeight:600, color:E.fg1, letterSpacing:-0.1 }}>{label}</div>
        {sub && <div style={{ fontSize:10.5, color:E.fg3, marginTop:1, lineHeight:'14px' }}>{sub}</div>}
      </div>
      <Toggle on={on} disabled={disabled}/>
    </div>
  );
}

function Toggle({ on, disabled }) {
  return (
    <div style={{
      width:36, height:20, borderRadius:10, position:'relative', flexShrink:0,
      background: disabled ? E.sunken : (on ? E.blue600 : E.borderStrong), opacity:disabled?0.7:1,
    }}>
      <div style={{
        position:'absolute', top:2, left:on?18:2, width:16, height:16, borderRadius:'50%',
        background:'#fff', boxShadow:'0 1px 2px rgba(0,0,0,0.22)',
      }}/>
    </div>
  );
}

function MemberAvatars({ members, required }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <div style={{ display:'flex' }}>
        {members.map((m, i) => (
          <div key={i} style={{
            width:30, height:30, borderRadius:'50%', background:m.grad, color:'#fff',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700,
            border:'2px solid #fff', marginLeft: i===0?0:-8,
            opacity: m.dim ? 0.45 : 1,
          }}>{m.initials}</div>
        ))}
      </div>
      <span style={{ fontSize:11, color:E.fg3, fontWeight:500 }}>{required} of {members.length} hosts required</span>
    </div>
  );
}

// Sticky save bar.
function SaveBar({ saving, label='Save event type' }) {
  return (
    <div style={{
      position:'absolute', bottom:0, left:0, right:0,
      background:'rgba(255,255,255,0.96)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
      borderTop:`1px solid ${E.border}`, padding:'10px 12px 18px', zIndex:10,
    }}>
      {saving ? (
        <div style={{ height:44, borderRadius:12, ...SH, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <span style={{ fontSize:13, fontWeight:600, color:E.fg4, letterSpacing:-0.1 }}>Saving…</span>
        </div>
      ) : (
        <button style={{
          width:'100%', height:44, borderRadius:12, border:'none', background:E.blue600, color:'#fff',
          fontSize:13.5, fontWeight:700, cursor:'pointer', letterSpacing:-0.1,
          boxShadow:'0 6px 16px rgba(2,132,199,0.28)',
        }}>{label}</button>
      )}
    </div>
  );
}

// Stripe connect inline card.
function StripeCard() {
  return (
    <div style={{
      background:E.stripeBg, border:`1px solid #e0ddff`, borderRadius:12, padding:'11px 12px',
      display:'flex', flexDirection:'column', gap:10,
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
        <div style={{
          width:30, height:30, borderRadius:8, flexShrink:0, background:E.stripe, color:'#fff',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}><i data-lucide="credit-card" style={{ width:15, height:15, strokeWidth:2.2 }}/></div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12.5, fontWeight:700, color:E.fg1, letterSpacing:-0.1, marginBottom:2 }}>Connect payments to charge for bookings</div>
          <div style={{ fontSize:11, color:E.fg2, lineHeight:'15px' }}>Pantopus uses Stripe to collect payments and deposits. It takes about a minute.</div>
        </div>
      </div>
      <button style={{
        width:'100%', height:38, borderRadius:9, border:'none', background:E.blue600, color:'#fff',
        fontSize:12.5, fontWeight:700, cursor:'pointer', letterSpacing:-0.1,
        display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
      }}>
        <i data-lucide="external-link" style={{ width:14, height:14 }}/> Connect Stripe
      </button>
    </div>
  );
}

Object.assign(window, {
  E, SWATCHES, SH, Phone, StatusBar, TopBar, HeaderPill, Body, Card, FieldLabel,
  TextInput, ColorSwatches, Segmented, Stepper, QuickChip, LinkRow, ToggleRow, Toggle,
  MemberAvatars, SaveBar, StripeCard,
});
