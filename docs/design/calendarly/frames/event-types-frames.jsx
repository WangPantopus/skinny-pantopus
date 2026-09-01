// Pantopus — Calendarly · Event types & availability — Event Type / Service List
// Archetype: ListOfRows. Row primitive mirrors List of Rows / A08 Support trains;
// screen chrome mirrors A08 (top bar + add affordance).
// Lives in: Personal → Scheduling → Event Types · Business → Catalog (bookable).
// web /app/profile/schedule.
//
// Non-negotiables: primary sky #0284C7 (product blue) on all functional chrome —
// toggles, active states, links, CTAs. Pillar accent (Personal sky / Business
// violet) appears ONLY on the identity pill + section overline. White cards,
// 1px border, 14px radius, shadow-sm, no left-border accents, flat shell.
// Lucide stroke-2; no emoji; shimmer skeletons, never "Loading…".

const P = {
  // product blue (primary) — functional chrome
  blue50:'#f0f9ff', blue100:'#e0f2fe', blue600:'#0284c7', blue700:'#0369a1',
  // pillar accents (pill + overline only)
  personal:'#0284c7', personalBg:'#dbeafe',
  business:'#7c3aed', businessBg:'#f3e8ff',
  // neutrals
  bg:'#f6f7f9', surface:'#ffffff', sunken:'#f3f4f6', raised:'#f9fafb',
  border:'#e5e7eb', borderStrong:'#d1d5db',
  fg1:'#111827', fg2:'#374151', fg3:'#6b7280', fg4:'#9ca3af',
  error:'#dc2626', errorBg:'#fef2f2',
  success600:'#059669', success100:'#d1fae5', success700:'#047857',
};

// Calm per-event-type dot colors (DS category accents).
const DOT = {
  blue:'#2980b9', orange:'#f97316', green:'#16a34a', violet:'#7c3aed',
  amber:'#d97706', rose:'#e11d48',
};

// ─── Phone shell (300×620) ─────────────────────────────────────

function StatusBar() {
  const c = P.fg1;
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
        width:'100%', height:'100%', background:P.bg, borderRadius:32,
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

// Top bar: chevron back · centered title · + action.
function TopBar({ title, plusDisabled }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', padding:'6px 8px', height:46,
      boxSizing:'border-box', background:P.surface, borderBottom:`1px solid ${P.border}`, flexShrink:0,
    }}>
      <button style={{
        width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center',
        background:'transparent', border:'none', cursor:'pointer', color:P.fg1, padding:0,
      }}>
        <i data-lucide="chevron-left" style={{ width:20, height:20 }}/>
      </button>
      <div style={{ flex:1, textAlign:'center', fontSize:15, fontWeight:600, color:P.fg1, letterSpacing:-0.2 }}>{title}</div>
      <button style={{
        width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center',
        background:'transparent', border:'none', cursor:plusDisabled?'not-allowed':'pointer',
        color:plusDisabled?P.fg4:P.blue600, padding:0, opacity:plusDisabled?0.5:1,
      }}>
        <i data-lucide="plus" style={{ width:21, height:21, strokeWidth:2.4 }}/>
      </button>
    </div>
  );
}

// Identity pill (pillar color) + segmented Active/Hidden filter.
function FilterHeader({ pillar='personal', active='Active' }) {
  const isBiz = pillar === 'business';
  const pillColor = isBiz ? P.business : P.personal;
  const pillBg = isBiz ? P.businessBg : P.personalBg;
  return (
    <div style={{
      padding:'10px 12px', background:P.surface, borderBottom:`1px solid ${P.border}`,
      display:'flex', flexDirection:'column', gap:9, flexShrink:0,
    }}>
      <div style={{
        display:'inline-flex', alignItems:'center', gap:5, alignSelf:'flex-start',
        padding:'3px 9px', borderRadius:9999, background:pillBg, color:pillColor,
        fontSize:10, fontWeight:700, letterSpacing:0.05, textTransform:'uppercase',
      }}>
        <i data-lucide={isBiz?'briefcase':'user'} style={{ width:11, height:11, strokeWidth:2.4 }}/>
        {isBiz ? 'Business' : 'Personal'}
      </div>
      <div style={{ display:'flex', gap:3, padding:3, background:P.sunken, borderRadius:9 }}>
        {['Active','Hidden'].map((t) => {
          const on = t === active;
          return (
            <button key={t} style={{
              flex:1, height:30, borderRadius:7, cursor:'pointer', border:'none',
              background:on?P.surface:'transparent', color:on?P.blue700:P.fg3,
              boxShadow:on?'0 1px 2px rgba(0,0,0,0.08)':'none',
              fontSize:12, fontWeight:on?700:600, letterSpacing:-0.05,
            }}>{t}</button>
          );
        })}
      </div>
    </div>
  );
}

function SectionOverline({ pillar='personal', children }) {
  const color = pillar === 'business' ? P.business : P.personal;
  return (
    <div style={{
      fontSize:9.5, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase',
      color, padding:'2px 2px 0',
    }}>{children}</div>
  );
}

// Product-blue toggle. 36×20.
function Toggle({ on, disabled }) {
  return (
    <div style={{
      width:36, height:20, borderRadius:10, position:'relative', flexShrink:0,
      background: disabled ? P.sunken : (on ? P.blue600 : P.borderStrong),
      opacity: disabled ? 0.6 : 1,
    }}>
      <div style={{
        position:'absolute', top:2, left:on?18:2, width:16, height:16, borderRadius:'50%',
        background:'#fff', boxShadow:'0 1px 2px rgba(0,0,0,0.22)',
      }}/>
    </div>
  );
}

// ─── Event row primitive (List of Rows) ────────────────────────

function EventRow({
  dot, name, meta, price, hosts, on, reorder, lifted, disabled, hideOverflow, dimmed,
}) {
  return (
    <div style={{
      background:P.surface, border:`1px solid ${lifted?P.blue200||P.blue100:P.border}`, borderRadius:14,
      padding:'10px 11px', display:'flex', alignItems:'center', gap:9,
      boxShadow: lifted ? '0 12px 28px rgba(17,24,39,0.16)' : '0 1px 3px rgba(0,0,0,0.04)',
      transform: lifted ? 'translateY(-2px) scale(1.012)' : 'none',
      opacity: dimmed ? 0.55 : 1,
      position:'relative', zIndex: lifted ? 3 : 1,
    }}>
      {reorder && (
        <i data-lucide="grip-vertical" style={{ width:16, height:16, color:P.fg4, flexShrink:0, cursor:'grab' }}/>
      )}
      <span style={{ width:6, height:6, borderRadius:'50%', background:dot, flexShrink:0 }}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{
            fontSize:13.5, fontWeight:600, color:disabled?P.fg2:P.fg1, letterSpacing:-0.15,
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
          }}>{name}</span>
          {hosts != null && (
            <span style={{
              display:'inline-flex', alignItems:'center', gap:3, padding:'1px 6px', borderRadius:9999,
              background:P.sunken, color:P.fg2, fontSize:9.5, fontWeight:700, flexShrink:0, lineHeight:'14px',
            }}>
              <i data-lucide="users" style={{ width:9, height:9, strokeWidth:2.4 }}/>
              {hosts}
            </span>
          )}
        </div>
        <div style={{
          fontSize:11, color:P.fg3, marginTop:2,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        }}>
          {meta}
          {price != null && (
            <>
              <span style={{ color:P.fg4 }}> · </span>
              <span style={{ fontWeight:700, color:P.fg2, fontVariantNumeric:'tabular-nums' }}>{price}</span>
            </>
          )}
        </div>
      </div>
      <Toggle on={on} disabled={disabled}/>
      {!hideOverflow && (
        <button style={{
          width:26, height:26, display:'flex', alignItems:'center', justifyContent:'center',
          background:'transparent', border:'none', cursor:disabled?'not-allowed':'pointer',
          color:disabled?P.fg4:P.fg3, padding:0, flexShrink:0, opacity:disabled?0.5:1,
        }}>
          <i data-lucide="ellipsis-vertical" style={{ width:17, height:17 }}/>
        </button>
      )}
    </div>
  );
}

// fix: blue200 token
P.blue200 = '#bae6fd';

// ─── Overflow menu (popover) ───────────────────────────────────

function OverflowMenu() {
  const items = [
    { icon:'link', label:'Copy booking link' },
    { icon:'copy', label:'Duplicate' },
    { icon:'share-2', label:'Share' },
    { icon:'eye-off', label:'Hide' },
    { icon:'trash-2', label:'Delete', danger:true },
  ];
  return (
    <div style={{
      position:'absolute', top:150, right:14, width:184, zIndex:30,
      background:P.surface, border:`1px solid ${P.border}`, borderRadius:12,
      boxShadow:'0 16px 40px rgba(17,24,39,0.22)', overflow:'hidden', padding:'4px',
    }}>
      {items.map((it, i) => (
        <div key={it.label} style={{
          display:'flex', alignItems:'center', gap:10, padding:'9px 10px', borderRadius:8,
          cursor:'pointer', background:i===0?P.blue50:'transparent',
          borderTop: it.danger ? `1px solid ${P.border}` : 'none', marginTop: it.danger ? 3 : 0,
        }}>
          <i data-lucide={it.icon} style={{ width:15, height:15, color: it.danger?P.error:(i===0?P.blue600:P.fg2), strokeWidth:2 }}/>
          <span style={{ fontSize:12.5, fontWeight: i===0?700:500, color: it.danger?P.error:(i===0?P.blue700:P.fg1), letterSpacing:-0.1 }}>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Shimmer skeleton row ──────────────────────────────────────

function SkeletonRow() {
  const sh = {
    background:'linear-gradient(90deg, #eef0f3 0%, #f6f7f9 50%, #eef0f3 100%)',
    backgroundSize:'200% 100%', animation:'sh-shimmer 1.4s ease-in-out infinite',
  };
  return (
    <div style={{
      background:P.surface, border:`1px solid ${P.border}`, borderRadius:14,
      padding:'10px 11px', display:'flex', alignItems:'center', gap:9,
      boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ width:6, height:6, borderRadius:'50%', ...sh }}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ width:'52%', height:11, borderRadius:5, ...sh }}/>
        <div style={{ width:'72%', height:9, borderRadius:5, marginTop:7, ...sh }}/>
      </div>
      <div style={{ width:36, height:20, borderRadius:10, ...sh }}/>
    </div>
  );
}

// ─── Body scroll wrap ──────────────────────────────────────────

function Body({ children, center }) {
  return (
    <div style={{
      flex:1, overflow:'auto', padding:'12px 12px 24px',
      display:'flex', flexDirection:'column', gap: center ? 0 : 8,
      justifyContent: center ? 'center' : 'flex-start',
    }}>{children}</div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 1 · POPULATED — personal (sky pill), overflow menu open
// ═══════════════════════════════════════════════════════════════

function FramePersonal() {
  return (
    <Phone label="Event types — populated (personal)">
      <TopBar title="Event types"/>
      <FilterHeader pillar="personal" active="Active"/>
      <div style={{ flex:1, overflow:'auto', padding:'12px 12px 24px', display:'flex', flexDirection:'column', gap:8, position:'relative' }}>
        <SectionOverline pillar="personal">Your event types</SectionOverline>
        <EventRow dot={DOT.blue}   name="Intro call"       meta="30 min · Video"     on={true}/>
        <EventRow dot={DOT.orange} name="Coffee chat"      meta="45 min · In person" on={true}/>
        <EventRow dot={DOT.green}  name="Strategy session" meta="60 min · Video"     on={false}/>
        <EventRow dot={DOT.violet} name="Quick sync"       meta="15 min · Phone"     on={false}/>
        {/* overflow popover demo + scrim */}
        <div style={{ position:'absolute', inset:0, background:'rgba(17,24,39,0.04)', zIndex:20 }}/>
        <OverflowMenu/>
      </div>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 2 · BUSINESS SERVICES — violet pill, prices + assignee badges
// ═══════════════════════════════════════════════════════════════

function FrameBusiness() {
  return (
    <Phone label="Event types — business services">
      <TopBar title="Services"/>
      <FilterHeader pillar="business" active="Active"/>
      <Body>
        <SectionOverline pillar="business">Bookable services</SectionOverline>
        <EventRow dot={DOT.violet} name="Consultation" meta="30 min · Video"   price="$120" hosts="3 hosts" on={true}/>
        <EventRow dot={DOT.blue}   name="Quote visit"  meta="45 min · On-site" price="Free" hosts="2 hosts" on={true}/>
        <EventRow dot={DOT.amber}  name="Site survey"  meta="60 min · On-site" price="$200" hosts="1 host"  on={true}/>
        <EventRow dot={DOT.green}  name="Follow-up"    meta="20 min · Phone"   price="$60"  hosts="3 hosts" on={false}/>
      </Body>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 3 · EMPTY — calm line, primary CTA, template chips
// ═══════════════════════════════════════════════════════════════

function FrameEmpty() {
  return (
    <Phone label="Event types — empty">
      <TopBar title="Event types"/>
      <FilterHeader pillar="personal" active="Active"/>
      <div style={{
        flex:1, display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', textAlign:'center', padding:'24px 26px',
      }}>
        <div style={{ position:'relative', width:84, height:84, marginBottom:16 }}>
          <div style={{
            position:'absolute', inset:0, borderRadius:'50%',
            background:`radial-gradient(circle at 30% 30%, ${P.blue50} 0%, ${P.blue100} 100%)`,
          }}/>
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:P.blue600 }}>
            <i data-lucide="calendar-plus" style={{ width:36, height:36, strokeWidth:1.7 }}/>
          </div>
        </div>
        <div style={{ fontSize:15.5, fontWeight:600, color:P.fg1, letterSpacing:-0.2, marginBottom:6 }}>
          You don't have any event types yet
        </div>
        <div style={{ fontSize:12, color:P.fg3, lineHeight:'17px', maxWidth:220, marginBottom:18 }}>
          An event type is something people can book — a call, a meeting, a visit. Start from a template or build your own.
        </div>
        <button style={{
          display:'inline-flex', alignItems:'center', gap:7, padding:'11px 18px', borderRadius:12,
          background:P.blue600, color:'#fff', border:'none', fontSize:13, fontWeight:600, cursor:'pointer',
          boxShadow:'0 6px 16px rgba(2,132,199,0.30)', marginBottom:16, whiteSpace:'nowrap',
        }}>
          <i data-lucide="plus" style={{ width:15, height:15, strokeWidth:2.4 }}/>
          Create your first event type
        </button>
        <div style={{ fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:P.fg4, marginBottom:9 }}>
          Start from a template
        </div>
        <div style={{ display:'flex', gap:7, justifyContent:'center' }}>
          {['15 min','30 min','60 min'].map((t) => (
            <button key={t} style={{
              display:'inline-flex', alignItems:'center', gap:5, padding:'7px 13px', borderRadius:9999,
              background:P.surface, border:`1px solid ${P.border}`, color:P.fg2,
              fontSize:12, fontWeight:600, cursor:'pointer',
            }}>
              <i data-lucide="clock" style={{ width:12, height:12, color:P.blue600 }}/>
              {t}
            </button>
          ))}
        </div>
      </div>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 4 · LOADING — three shimmer skeleton rows
// ═══════════════════════════════════════════════════════════════

function FrameLoading() {
  return (
    <Phone label="Event types — loading">
      <TopBar title="Event types"/>
      <FilterHeader pillar="personal" active="Active"/>
      <Body>
        <div style={{ width:88, height:9, borderRadius:5, marginBottom:2,
          background:'linear-gradient(90deg, #eef0f3 0%, #f6f7f9 50%, #eef0f3 100%)',
          backgroundSize:'200% 100%', animation:'sh-shimmer 1.4s ease-in-out infinite' }}/>
        <SkeletonRow/>
        <SkeletonRow/>
        <SkeletonRow/>
      </Body>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 5 · ALL HIDDEN — Active tab empty, switch-to-Hidden message
// ═══════════════════════════════════════════════════════════════

function FrameAllHidden() {
  return (
    <Phone label="Event types — all hidden">
      <TopBar title="Event types"/>
      <FilterHeader pillar="personal" active="Active"/>
      <div style={{
        flex:1, display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', textAlign:'center', padding:'24px 30px',
      }}>
        <div style={{
          width:60, height:60, borderRadius:'50%', background:P.sunken,
          display:'flex', alignItems:'center', justifyContent:'center', color:P.fg4, marginBottom:16,
        }}>
          <i data-lucide="eye-off" style={{ width:26, height:26, strokeWidth:1.8 }}/>
        </div>
        <div style={{ fontSize:14.5, fontWeight:600, color:P.fg1, letterSpacing:-0.2, marginBottom:6 }}>
          Everything's hidden
        </div>
        <div style={{ fontSize:12, color:P.fg3, lineHeight:'17px', maxWidth:210, marginBottom:18 }}>
          Switch to Hidden to bring one back, or create a new event type.
        </div>
        <button style={{
          display:'inline-flex', alignItems:'center', gap:6, padding:'9px 15px', borderRadius:10,
          background:P.surface, border:`1px solid ${P.border}`, color:P.blue700,
          fontSize:12.5, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap',
        }}>
          View hidden
          <i data-lucide="arrow-right" style={{ width:13, height:13 }}/>
        </button>
      </div>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 6 · REORDERING — drag handles visible, one row lifted
// ═══════════════════════════════════════════════════════════════

function FrameReorder() {
  return (
    <Phone label="Event types — reordering">
      <TopBar title="Reorder"/>
      <div style={{
        padding:'8px 12px', background:P.blue50, borderBottom:`1px solid ${P.blue100}`,
        display:'flex', alignItems:'center', gap:8, flexShrink:0,
      }}>
        <i data-lucide="move" style={{ width:15, height:15, color:P.blue700 }}/>
        <span style={{ fontSize:11.5, fontWeight:600, color:P.blue700, letterSpacing:-0.05, flex:1 }}>Drag to set the order people see</span>
        <span style={{ fontSize:12, fontWeight:700, color:P.blue700, cursor:'pointer' }}>Done</span>
      </div>
      <Body>
        <EventRow dot={DOT.orange} name="Coffee chat"      meta="45 min · In person" on={true}  reorder hideOverflow lifted/>
        <EventRow dot={DOT.blue}   name="Intro call"       meta="30 min · Video"     on={true}  reorder hideOverflow dimmed/>
        <EventRow dot={DOT.green}  name="Strategy session" meta="60 min · Video"     on={false} reorder hideOverflow dimmed/>
        <EventRow dot={DOT.violet} name="Quick sync"       meta="15 min · Phone"     on={false} reorder hideOverflow dimmed/>
      </Body>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 7 · PERMISSION-GATED — read-only, toggles disabled, banner
// ═══════════════════════════════════════════════════════════════

function FrameGated() {
  return (
    <Phone label="Event types — permission gated">
      <TopBar title="Services" plusDisabled/>
      <FilterHeader pillar="business" active="Active"/>
      <Body>
        <div style={{
          display:'flex', alignItems:'center', gap:9, padding:'10px 11px',
          background:P.sunken, border:`1px solid ${P.border}`, borderRadius:12,
        }}>
          <i data-lucide="lock" style={{ width:15, height:15, color:P.fg3, flexShrink:0 }}/>
          <span style={{ fontSize:11.5, color:P.fg2, fontWeight:500, lineHeight:'16px' }}>Only owners can edit this catalog.</span>
        </div>
        <EventRow dot={DOT.violet} name="Consultation" meta="30 min · Video"   price="$120" hosts="3 hosts" on={true}  disabled/>
        <EventRow dot={DOT.blue}   name="Quote visit"  meta="45 min · On-site" price="Free" hosts="2 hosts" on={true}  disabled/>
        <EventRow dot={DOT.amber}  name="Site survey"  meta="60 min · On-site" price="$200" hosts="1 host"  on={true}  disabled/>
        <EventRow dot={DOT.green}  name="Follow-up"    meta="20 min · Phone"   price="$60"  hosts="3 hosts" on={false} disabled/>
      </Body>
    </Phone>
  );
}

Object.assign(window, {
  FramePersonal, FrameBusiness, FrameEmpty, FrameLoading, FrameAllHidden, FrameReorder, FrameGated,
});
