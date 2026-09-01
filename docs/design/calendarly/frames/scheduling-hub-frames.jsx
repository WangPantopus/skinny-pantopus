// Pantopus — Calendarly · Scheduling Hub (A · Set up & home base)
// Owner-polymorphic front door. Extends Me.html (IdentitySwitcherPillRow +
// grouped chevron rows) and Hub.html (stacked sections, amber setup banner,
// shimmer skeleton). Agenda rows reuse Home calendar.html row vocabulary.
//
// 6 frames: default (Personal) · empty/first-run · loading skeleton ·
//           paused · Home (composed availability) · permission-gated.

const P = {
  primary50:'#f0f9ff', primary100:'#e0f2fe', primary600:'#0284c7', primary700:'#0369a1',
  bg:'#f6f7f9', surface:'#ffffff', sunken:'#f3f4f6', muted:'#f8fafc',
  border:'#e5e7eb', borderSub:'#f3f4f6', borderStrong:'#d1d5db',
  fg1:'#111827', fg2:'#374151', fg3:'#6b7280', fg4:'#9ca3af',
  successBg:'#dcfce7', success:'#047857',
  warningBg:'#fef3c7', warningSoft:'#fffbeb', warning:'#b45309', warningBorder:'#fde68a',
  errorBg:'#fee2e2', error:'#b91c1c',
  infoBg:'#dbeafe', info:'#1d4ed8',
};

// Identity pillars — accent keys off the active pill.
const PILLAR = {
  personal: { key:'personal', label:'Personal', icon:'user',  accent:'#0284c7', bg:'#f0f9ff', soft:'#e0f2fe', ring:'#bae6fd', shadow:'rgba(2,132,199,0.28)' },
  home:     { key:'home',     label:'Home',     icon:'house', accent:'#16a34a', bg:'#f0fdf4', soft:'#dcfce7', ring:'#bbf7d0', shadow:'rgba(22,163,74,0.28)' },
  business: { key:'business', label:'Business', icon:'store', accent:'#7c3aed', bg:'#faf5ff', soft:'#f3e8ff', ring:'#e9d5ff', shadow:'rgba(124,58,237,0.28)' },
};

// Booking-type tiles — semantic by meeting kind, independent of pillar accent.
const BTYPE = {
  video:    { icon:'video',          bg:'#e0f2fe', fg:'#0284c7', label:'Video call' },
  call:     { icon:'phone',          bg:'#dbeafe', fg:'#1d4ed8', label:'Phone' },
  inperson: { icon:'map-pin',        bg:'#dcfce7', fg:'#15803d', label:'In person' },
  consult:  { icon:'clipboard-list', bg:'#ede9fe', fg:'#6d28d9', label:'Consult' },
};

// ─── Shell ────────────────────────────────────────────────────

function StatusBar() {
  const c = P.fg1;
  return (
    <div style={{
      display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'16px 28px 0', height:44, boxSizing:'border-box',
      fontFamily:'-apple-system, system-ui', fontWeight:600, fontSize:15, color:c, flexShrink:0,
    }}>
      <span>9:41</span>
      <div style={{display:'flex', gap:5, alignItems:'center'}}>
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={c}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={c}/><rect x="9" y="2" width="3" height="9" rx="0.6" fill={c}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={c}/></svg>
        <svg width="15" height="11" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={c}/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={c}/><circle cx="7.5" cy="9" r="1.3" fill={c}/></svg>
        <svg width="24" height="11" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={c} strokeOpacity="0.35" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill={c}/><path d="M22.5 3.8v3.4c.6-.2 1-.8 1-1.7s-.4-1.5-1-1.7z" fill={c} fillOpacity="0.4"/></svg>
      </div>
    </div>
  );
}

function Phone({ children }) {
  return (
    <div style={{
      width:360, height:740, borderRadius:46, padding:10, background:'#0b0f17',
      boxShadow:'0 40px 80px rgba(17,24,39,0.22), 0 0 0 1px rgba(0,0,0,0.14)',
    }}>
      <div style={{
        width:'100%', height:'100%', background:P.bg, borderRadius:36,
        overflow:'hidden', position:'relative', display:'flex', flexDirection:'column',
        fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          position:'absolute', top:9, left:'50%', transform:'translateX(-50%)',
          width:108, height:30, borderRadius:20, background:'#000', zIndex:50,
        }}/>
        <StatusBar/>
        {children}
        <div style={{
          position:'absolute', bottom:6, left:'50%', transform:'translateX(-50%)',
          width:120, height:4, borderRadius:4, background:'rgba(0,0,0,0.25)', zIndex:60,
        }}/>
      </div>
    </div>
  );
}

// Tab-root top bar — no back chevron; centered title; trailing overflow dots.
function TopBar({ title, right }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', padding:'8px 12px', height:56,
      boxSizing:'border-box', background:P.surface, borderBottom:`1px solid ${P.border}`,
      flexShrink:0,
    }}>
      <div style={{ width:36, height:36, flexShrink:0 }}/>
      <div style={{ flex:1, textAlign:'center', minWidth:0 }}>
        <div style={{ fontSize:16, fontWeight:600, color:P.fg1, letterSpacing:-0.2, lineHeight:'18px' }}>{title}</div>
      </div>
      <button style={{
        width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center',
        background:'transparent', border:'none', cursor:'pointer', color:P.fg1, padding:0,
      }}>{right || <i data-lucide="more-horizontal" style={{ width:22, height:22 }}/>}</button>
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

// ─── (1) Identity switcher pill row ───────────────────────────

function IdentityPills({ active }) {
  const acc = PILLAR[active];
  return (
    <div style={{
      background:`linear-gradient(180deg, ${acc.bg} 0%, ${P.surface} 100%)`,
      padding:'12px 16px 14px', flexShrink:0, borderBottom:`1px solid ${P.borderSub}`,
    }}>
      <div style={{
        display:'flex', gap:6, padding:3, background:P.surface,
        borderRadius:9999, border:`1px solid ${P.border}`,
      }}>
        {Object.values(PILLAR).map((iden) => {
          const on = iden.key === active;
          return (
            <button key={iden.key} style={{
              flex:1, height:32, borderRadius:9999, border:'none', cursor:'pointer',
              background:on ? iden.accent : 'transparent', color:on ? '#fff' : P.fg2,
              fontSize:12, fontWeight:700, letterSpacing:-0.05,
              display:'inline-flex', alignItems:'center', justifyContent:'center', gap:5,
            }}>
              <i data-lucide={iden.icon} style={{ width:12, height:12, strokeWidth:2.4 }}/>
              {iden.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Composed-availability explainer + member stack (Home / Business).
function ComposedNote({ accent, soft, members }) {
  const tones = [
    { bg:'#bae6fd', fg:'#075985' }, { bg:'#a7f3d0', fg:'#065f46' },
    { bg:'#fde68a', fg:'#92400e' }, { bg:'#fecdd3', fg:'#9f1239' },
  ];
  return (
    <div style={{
      margin:'0 16px 12px', display:'flex', alignItems:'center', gap:10,
      padding:'9px 12px', background:soft, borderRadius:10,
    }}>
      <i data-lucide="info" style={{ width:15, height:15, color:accent, flexShrink:0 }}/>
      <div style={{ flex:1, minWidth:0, fontSize:11.5, color:P.fg2, lineHeight:'15px' }}>
        Times come from each member's personal availability.
      </div>
      <div style={{ display:'flex', alignItems:'center', flexShrink:0 }}>
        {members.map((m, i) => (
          <div key={i} style={{
            marginLeft:i===0?0:-6, width:22, height:22, borderRadius:'50%',
            background:tones[i%tones.length].bg, color:tones[i%tones.length].fg,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:9, fontWeight:700, border:'2px solid #fff', boxSizing:'border-box',
          }}>{m}</div>
        ))}
      </div>
    </div>
  );
}

// ─── (2) Booking-link card ────────────────────────────────────

// Miniature live preview of the public /book page.
function LinkPreview({ acc, name, role, paused }) {
  return (
    <div style={{
      height:140, borderRadius:12, background:P.sunken, position:'relative',
      overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center',
      border:`1px solid ${P.borderSub}`,
    }}>
      <span style={{
        position:'absolute', top:8, left:8, zIndex:3,
        display:'inline-flex', alignItems:'center', gap:4, padding:'2px 7px',
        borderRadius:9999, background:'rgba(255,255,255,0.92)', color:P.fg3,
        fontSize:9, fontWeight:700, letterSpacing:0.04, textTransform:'uppercase',
        border:`1px solid ${P.border}`,
      }}>
        <span style={{ width:5, height:5, borderRadius:'50%', background:paused?P.fg4:P.success }}/>
        Live preview
      </span>
      {/* mini public page */}
      <div style={{
        width:188, background:P.surface, borderRadius:10, overflow:'hidden',
        boxShadow:'0 6px 16px rgba(17,24,39,0.10)', border:`1px solid ${P.border}`,
      }}>
        <div style={{ height:30, background:`linear-gradient(135deg, ${acc.accent} 0%, ${acc.accent}cc 100%)`, position:'relative' }}>
          <div style={{
            position:'absolute', left:12, bottom:-12, width:26, height:26, borderRadius:'50%',
            background:`linear-gradient(135deg, ${acc.accent}, ${acc.accent}aa)`, border:'2px solid #fff',
            display:'flex', alignItems:'center', justifyContent:'center',
            color:'#fff', fontSize:9, fontWeight:700,
          }}>{name.split(' ').map(s=>s[0]).join('').slice(0,2)}</div>
        </div>
        <div style={{ padding:'16px 12px 10px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:P.fg1, letterSpacing:-0.1 }}>{name}</div>
          <div style={{ fontSize:8, color:P.fg3, marginTop:1 }}>{role}</div>
          <div style={{ display:'flex', gap:4, marginTop:8 }}>
            {['9:00','9:30','10:00'].map((t,i)=>(
              <span key={i} style={{
                flex:1, textAlign:'center', padding:'4px 0', borderRadius:6,
                border:`1px solid ${paused?P.border:acc.ring}`,
                background:paused?P.sunken:acc.bg, color:paused?P.fg4:acc.accent,
                fontSize:8, fontWeight:700,
              }}>{t}</span>
            ))}
          </div>
        </div>
      </div>
      {paused && (
        <div style={{
          position:'absolute', inset:0, background:'rgba(246,247,249,0.55)',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <span style={{
            display:'inline-flex', alignItems:'center', gap:5, padding:'5px 11px',
            borderRadius:9999, background:P.surface, border:`1px solid ${P.warningBorder}`,
            color:P.warning, fontSize:11, fontWeight:700,
          }}>
            <i data-lucide="pause" style={{ width:12, height:12 }}/> Paused
          </span>
        </div>
      )}
    </div>
  );
}

function BookingLinkCard({ acc, handle, name, role, paused=false, readOnly=false }) {
  return (
    <div style={{
      margin:'14px 16px 0', background:P.surface, border:`1px solid ${P.border}`,
      borderRadius:16, padding:14, boxShadow:'0 1px 3px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
        <i data-lucide="link" style={{ width:14, height:14, color:acc.accent }}/>
        <span style={{ fontSize:11.5, fontWeight:700, color:P.fg2, letterSpacing:-0.05 }}>Your booking link</span>
        <span style={{ flex:1 }}/>
        <span style={{ fontSize:11, color:P.fg3 }}>Anyone with the link can book you</span>
      </div>
      <LinkPreview acc={acc} name={name} role={role} paused={paused}/>
      {/* monospace handle */}
      <div style={{
        display:'flex', alignItems:'center', gap:8, marginTop:12,
        padding:'9px 12px', background:P.sunken, borderRadius:10, border:`1px solid ${P.borderSub}`,
      }}>
        <code style={{
          flex:1, minWidth:0, fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize:12, color:P.fg1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        }}>{handle}</code>
        <button style={{
          width:30, height:30, borderRadius:8, border:`1px solid ${P.border}`, background:P.surface,
          color:P.fg2, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
        }}>
          <i data-lucide="qr-code" style={{ width:15, height:15 }}/>
        </button>
      </div>
      {/* ghost buttons */}
      <div style={{ display:'flex', gap:8, marginTop:10 }}>
        <button style={{
          flex:1, height:38, borderRadius:10, border:`1px solid ${P.border}`, background:P.surface,
          color:P.fg1, fontSize:12.5, fontWeight:600, cursor:'pointer',
          display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
        }}>
          <i data-lucide="copy" style={{ width:14, height:14, strokeWidth:2 }}/> Copy link
        </button>
        {!readOnly && (
          <button style={{
            flex:1, height:38, borderRadius:10, border:`1px solid ${P.border}`, background:P.surface,
            color:P.fg1, fontSize:12.5, fontWeight:600, cursor:'pointer',
            display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
          }}>
            <i data-lucide="share-2" style={{ width:14, height:14, strokeWidth:2 }}/> Share
          </button>
        )}
      </div>
    </div>
  );
}

// ─── (3) Master pause toggle ──────────────────────────────────

function Toggle({ on, accent }) {
  return (
    <div style={{
      width:32, height:18, borderRadius:9, background:on?accent:P.borderStrong,
      position:'relative', flexShrink:0, transition:'background 150ms ease',
    }}>
      <div style={{
        position:'absolute', top:2, left:on?16:2, width:14, height:14, borderRadius:'50%',
        background:'#fff', boxShadow:'0 1px 2px rgba(0,0,0,0.2)', transition:'left 150ms ease',
      }}/>
    </div>
  );
}

function PauseRow({ acc }) {
  return (
    <div style={{
      margin:'12px 16px 0', background:P.surface, border:`1px solid ${P.border}`,
      borderRadius:14, padding:'13px 14px', boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
      display:'flex', alignItems:'center', gap:12,
    }}>
      <div style={{
        width:34, height:34, borderRadius:9, background:acc.bg, color:acc.accent,
        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
      }}>
        <i data-lucide="calendar-check" style={{ width:18, height:18 }}/>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13.5, fontWeight:600, color:P.fg1, letterSpacing:-0.1 }}>Accepting bookings</div>
        <div style={{ fontSize:11.5, color:P.fg3, marginTop:1 }}>New bookings are open</div>
      </div>
      <Toggle on accent={acc.accent}/>
    </div>
  );
}

// Paused banner replaces the toggle card.
function PausedBanner() {
  return (
    <div style={{
      margin:'12px 16px 0', background:P.warningSoft, border:`1px solid ${P.warningBorder}`,
      borderRadius:14, padding:'13px 14px', display:'flex', alignItems:'center', gap:12,
    }}>
      <div style={{
        width:34, height:34, borderRadius:9, background:P.warningBg, color:P.warning,
        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
      }}>
        <i data-lucide="pause" style={{ width:18, height:18 }}/>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13.5, fontWeight:600, color:P.fg1, letterSpacing:-0.1 }}>Bookings are paused</div>
        <div style={{ fontSize:11.5, color:P.fg3, marginTop:1 }}>New bookings are turned off</div>
      </div>
      <button style={{
        padding:'8px 14px', borderRadius:9999, border:'none', background:P.warning, color:'#fff',
        fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0,
      }}>Resume</button>
    </div>
  );
}

// Read-only status line (permission-gated).
function ReadOnlyStatus({ acc }) {
  return (
    <div style={{
      margin:'12px 16px 0', background:P.surface, border:`1px solid ${P.border}`,
      borderRadius:14, padding:'13px 14px', boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
      display:'flex', alignItems:'center', gap:12,
    }}>
      <div style={{
        width:34, height:34, borderRadius:9, background:acc.bg, color:acc.accent,
        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
      }}>
        <i data-lucide="calendar-check" style={{ width:18, height:18 }}/>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13.5, fontWeight:600, color:P.fg1, letterSpacing:-0.1 }}>Accepting bookings</div>
        <div style={{ fontSize:11.5, color:P.fg3, marginTop:1 }}>Managed by the home owner</div>
      </div>
      <i data-lucide="lock" style={{ width:16, height:16, color:P.fg4, flexShrink:0 }}/>
    </div>
  );
}

// ─── (4) Agenda strip ─────────────────────────────────────────

function SectionHeader({ title, action }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 16px 8px' }}>
      <div style={{ fontSize:10.5, fontWeight:700, color:P.fg3, letterSpacing:0.08, textTransform:'uppercase' }}>{title}</div>
      {action && (
        <button style={{
          background:'transparent', border:'none', padding:0, cursor:'pointer',
          color:P.primary600, fontSize:12, fontWeight:600, letterSpacing:-0.05,
          display:'inline-flex', alignItems:'center', gap:2,
        }}>{action}<i data-lucide="chevron-right" style={{ width:13, height:13 }}/></button>
      )}
    </div>
  );
}

function DateHeader({ label, sub }) {
  return (
    <div style={{ display:'flex', alignItems:'baseline', gap:8, margin:'12px 2px 8px', padding:'0 16px' }}>
      <span style={{ fontSize:12, fontWeight:700, color:P.fg1, letterSpacing:0.02, textTransform:'uppercase' }}>{label}</span>
      <span style={{ fontSize:11, color:P.fg4, fontWeight:500 }}>{sub}</span>
    </div>
  );
}

function Avatar({ initials, tone }) {
  return (
    <div style={{
      width:20, height:20, borderRadius:'50%', background:tone.bg, color:tone.fg,
      display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, flexShrink:0,
    }}>{initials}</div>
  );
}

function BookingRow({ type, title, duration, time, booker, bookerTone, status, crossOwner, readOnly }) {
  const t = BTYPE[type] || BTYPE.video;
  const statusMap = {
    confirmed: { bg:P.successBg, fg:P.success, label:'Confirmed', icon:'check' },
    pending:   { bg:P.warningBg, fg:P.warning, label:'Needs approval', icon:'clock' },
  };
  const st = status ? statusMap[status] : null;
  return (
    <div style={{
      margin:'0 16px', background:P.surface, border:`1px solid ${P.border}`, borderRadius:14,
      padding:12, boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
        <div style={{
          width:40, height:40, borderRadius:10, background:t.bg, color:t.fg,
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
        }}>
          <i data-lucide={t.icon} style={{ width:20, height:20, strokeWidth:2 }}/>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:3 }}>
            <span style={{
              flex:1, minWidth:0, fontSize:13.5, fontWeight:600, color:P.fg1, letterSpacing:-0.1,
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
            }}>{title}</span>
            <span style={{ fontSize:13, fontWeight:700, color:P.fg1, letterSpacing:-0.2, flexShrink:0, fontVariantNumeric:'tabular-nums' }}>{time}</span>
          </div>
          <div style={{ fontSize:11.5, color:P.fg3, marginBottom:8, display:'flex', alignItems:'center', gap:5 }}>
            <i data-lucide="clock" style={{ width:11, height:11, color:P.fg4 }}/>{duration}
            {crossOwner && (
              <span style={{ display:'inline-flex', alignItems:'center', gap:3, marginLeft:2, color:crossOwner.color }}>
                <i data-lucide={crossOwner.icon} style={{ width:11, height:11 }}/>{crossOwner.label}
              </span>
            )}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:6, minWidth:0 }}>
              <Avatar initials={booker.split(' ').map(s=>s[0]).join('').slice(0,2)} tone={bookerTone}/>
              <span style={{ fontSize:11.5, color:P.fg2, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{booker}</span>
            </div>
            {st && (
              <span style={{
                marginLeft:'auto', display:'inline-flex', alignItems:'center', gap:4,
                padding:'3px 8px', borderRadius:9999, background:st.bg, color:st.fg,
                fontSize:10, fontWeight:700, flexShrink:0,
              }}>
                <i data-lucide={st.icon} style={{ width:10, height:10 }}/>{st.label}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── (5) Quick rows group (A14.3 chevron rows) ────────────────

function QuickRows({ items, readOnly }) {
  return (
    <div style={{
      margin:'8px 16px 0', background:P.surface, border:`1px solid ${P.border}`,
      borderRadius:14, overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {items.map((it, i) => (
        <div key={i} style={{
          display:'flex', alignItems:'center', gap:12, padding:'13px 14px',
          borderBottom: i < items.length-1 ? `1px solid ${P.borderSub}` : 'none',
        }}>
          <i data-lucide={it.icon} style={{ width:18, height:18, strokeWidth:2, color:P.fg2, flexShrink:0 }}/>
          <span style={{ flex:1, fontSize:13.5, fontWeight:600, color:P.fg1, letterSpacing:-0.05 }}>{it.label}</span>
          {it.value && (
            <span style={{
              fontSize:12, fontWeight: it.alert?700:500,
              color: it.alert ? P.warning : P.fg3,
            }}>{it.value}</span>
          )}
          {!readOnly && <i data-lucide="chevron-right" style={{ width:14, height:14, color:P.fg4, strokeWidth:2 }}/>}
        </div>
      ))}
    </div>
  );
}

// ─── (6) Pinned footer CTA ────────────────────────────────────

function FooterCTA({ acc, label='Share booking link', icon='share-2' }) {
  return (
    <div style={{
      position:'absolute', bottom:0, left:0, right:0, zIndex:15,
      padding:'12px 16px 24px', background:'rgba(255,255,255,0.94)',
      backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', borderTop:`1px solid ${P.border}`,
    }}>
      <button style={{
        width:'100%', height:48, borderRadius:12, border:'none', background:acc.accent, color:'#fff',
        fontSize:14.5, fontWeight:700, cursor:'pointer', letterSpacing:-0.1,
        display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8,
        boxShadow:`0 6px 16px ${acc.shadow}`,
      }}>
        <i data-lucide={icon} style={{ width:17, height:17, strokeWidth:2.2 }}/>{label}
      </button>
    </div>
  );
}

const TONES = {
  blue:{ bg:'#bae6fd', fg:'#075985' }, green:{ bg:'#a7f3d0', fg:'#065f46' },
  amber:{ bg:'#fde68a', fg:'#92400e' }, rose:{ bg:'#fecdd3', fg:'#9f1239' },
  violet:{ bg:'#ddd6fe', fg:'#5b21b6' },
};

// ═══════════════════════════════════════════════════════════════
// FRAME 1 · DEFAULT (Personal, active)
// ═══════════════════════════════════════════════════════════════

function FrameDefault() {
  const acc = PILLAR.personal;
  return (
    <Phone>
      <TopBar title="Scheduling"/>
      <IdentityPills active="personal"/>
      <div style={{ flex:1, overflow:'auto', paddingBottom:96 }}>
        <BookingLinkCard acc={acc} handle="pantopus.com/book/maria-k" name="Maria Kowalski" role="30 min meeting · video"/>
        <PauseRow acc={acc}/>

        <SectionHeader title="Today & upcoming" action="See all bookings"/>
        <DateHeader label="Today" sub="Sun Oct 12"/>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <BookingRow type="video" title="Intro call" duration="30 min" time="2:00 PM"
            booker="Daniel Reyes" bookerTone={TONES.blue} status="confirmed"/>
          <BookingRow type="inperson" title="Coffee chat" duration="45 min · Heights Cafe" time="4:30 PM"
            booker="Priya N." bookerTone={TONES.green} status="confirmed"/>
        </div>
        <DateHeader label="Tomorrow" sub="Mon Oct 13"/>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <BookingRow type="consult" title="Portfolio review" duration="45 min · video" time="11:00 AM"
            booker="Marcus K." bookerTone={TONES.amber} status="pending"/>
        </div>

        <SectionHeader title="Manage"/>
        <QuickRows items={[
          { icon:'layout-grid',     label:'Event types',         value:'3 active' },
          { icon:'clock',           label:'Availability',        value:'Mon–Fri, 9–5' },
          { icon:'calendar-sync',   label:'Connected calendars', value:'Google · iCloud' },
          { icon:'inbox',           label:'Bookings',            value:'2 need approval', alert:true },
          { icon:'settings',        label:'Settings' },
        ]}/>
        <div style={{ height:8 }}/>
      </div>
      <FooterCTA acc={acc}/>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 2 · EMPTY / FIRST-RUN  (sections collapse → setup banner)
// ═══════════════════════════════════════════════════════════════

function FrameEmpty() {
  const acc = PILLAR.personal;
  return (
    <Phone>
      <TopBar title="Scheduling"/>
      <IdentityPills active="personal"/>
      <div style={{ flex:1, overflow:'auto', padding:'0 0 40px' }}>
        <div style={{
          display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center',
          padding:'34px 28px 8px',
        }}>
          <div style={{ position:'relative', width:88, height:88, marginBottom:18 }}>
            <div style={{
              position:'absolute', inset:0, borderRadius:'50%',
              background:`radial-gradient(circle at 30% 30%, ${acc.bg} 0%, ${acc.soft} 100%)`,
            }}/>
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:acc.accent }}>
              <i data-lucide="calendar-plus" style={{ width:38, height:38, strokeWidth:1.7 }}/>
            </div>
          </div>
          <div style={{ fontSize:20, fontWeight:700, color:P.fg1, letterSpacing:-0.3, marginBottom:8 }}>Set up your booking link</div>
          <div style={{ fontSize:13, color:P.fg3, lineHeight:'19px', maxWidth:280, marginBottom:4 }}>
            Create a link anyone can use to book time with you. Pick your hours and the meeting types you offer.
          </div>
        </div>

        {/* single amber setup banner — the one primary CTA */}
        <div style={{
          margin:'18px 16px 0', background:P.warningSoft, border:`1px solid ${P.warningBorder}`,
          borderRadius:16, padding:'16px',
        }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
            <div style={{
              width:38, height:38, borderRadius:10, background:P.warningBg, color:P.warning,
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            }}>
              <i data-lucide="wand-2" style={{ width:19, height:19 }}/>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14, fontWeight:700, color:P.fg1, letterSpacing:-0.1 }}>Three quick steps</div>
              <div style={{ fontSize:12, color:P.fg2, marginTop:2, lineHeight:'17px' }}>Set your hours, add a meeting type, then share your link.</div>
            </div>
          </div>
          <button style={{
            width:'100%', height:46, marginTop:14, borderRadius:12, border:'none',
            background:acc.accent, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer',
            display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8,
            boxShadow:`0 6px 16px ${acc.shadow}`,
          }}>
            Set up your booking link
            <i data-lucide="arrow-right" style={{ width:16, height:16 }}/>
          </button>
        </div>

        {/* faint preview of collapsed sections */}
        <div style={{ padding:'22px 16px 0', display:'flex', flexDirection:'column', gap:8, opacity:0.5 }}>
          {[
            { icon:'layout-grid', label:'Event types' },
            { icon:'clock', label:'Availability' },
            { icon:'calendar-sync', label:'Connected calendars' },
          ].map((r,i)=>(
            <div key={i} style={{
              display:'flex', alignItems:'center', gap:12, padding:'13px 14px',
              background:P.surface, border:`1px dashed ${P.borderStrong}`, borderRadius:12,
            }}>
              <i data-lucide={r.icon} style={{ width:18, height:18, color:P.fg4 }}/>
              <span style={{ flex:1, fontSize:13, fontWeight:600, color:P.fg3 }}>{r.label}</span>
              <span style={{ fontSize:11, color:P.fg4, fontWeight:600 }}>Not set up</span>
            </div>
          ))}
        </div>
      </div>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 3 · LOADING SKELETON
// ═══════════════════════════════════════════════════════════════

function FrameSkeleton() {
  return (
    <Phone>
      <TopBar title="Scheduling"/>
      {/* pill row skeleton */}
      <div style={{ padding:'12px 16px 14px', background:P.surface, borderBottom:`1px solid ${P.borderSub}` }}>
        <Shimmer w="100%" h={38} r={9999}/>
      </div>
      <div style={{ flex:1, overflow:'auto', paddingBottom:30 }}>
        <div style={{ padding:'14px 16px 0' }}>
          <Shimmer w="100%" h={252} r={16}/>
        </div>
        <div style={{ padding:'12px 16px 0' }}>
          <Shimmer w="100%" h={60} r={14}/>
        </div>
        <div style={{ padding:'20px 16px 8px' }}>
          <Shimmer w={130} h={11} r={3}/>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8, padding:'0 16px' }}>
          {[0,1].map(i=>(
            <div key={i} style={{
              display:'flex', alignItems:'center', gap:12, padding:12,
              background:P.surface, border:`1px solid ${P.border}`, borderRadius:14,
            }}>
              <Shimmer w={40} h={40} r={10}/>
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6 }}>
                <Shimmer w="70%" h={11} r={3}/>
                <Shimmer w="42%" h={9} r={3}/>
                <Shimmer w="54%" h={9} r={3}/>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding:'20px 16px 8px' }}>
          <Shimmer w={80} h={11} r={3}/>
        </div>
        <div style={{ margin:'0 16px', background:P.surface, border:`1px solid ${P.border}`, borderRadius:14, overflow:'hidden' }}>
          {[0,1,2,3].map(i=>(
            <div key={i} style={{
              display:'flex', alignItems:'center', gap:12, padding:'13px 14px',
              borderBottom: i<3?`1px solid ${P.borderSub}`:'none',
            }}>
              <Shimmer w={18} h={18} r={5}/>
              <Shimmer w="40%" h={11} r={3}/>
              <div style={{ flex:1 }}/>
              <Shimmer w={48} h={10} r={3}/>
            </div>
          ))}
        </div>
      </div>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 4 · PAUSED (master toggle off)
// ═══════════════════════════════════════════════════════════════

function FramePaused() {
  const acc = PILLAR.personal;
  return (
    <Phone>
      <TopBar title="Scheduling"/>
      <IdentityPills active="personal"/>
      <div style={{ flex:1, overflow:'auto', paddingBottom:96 }}>
        <BookingLinkCard acc={acc} handle="pantopus.com/book/maria-k" name="Maria Kowalski" role="30 min meeting · video" paused/>
        <PausedBanner/>

        <SectionHeader title="Today & upcoming" action="See all bookings"/>
        <div style={{ padding:'4px 16px 0' }}>
          <div style={{
            display:'flex', alignItems:'center', gap:8, padding:'11px 12px',
            background:P.surface, border:`1px solid ${P.border}`, borderRadius:12,
            fontSize:12, color:P.fg3,
          }}>
            <i data-lucide="info" style={{ width:14, height:14, color:P.fg4 }}/>
            Existing bookings stay on your calendar while paused.
          </div>
        </div>
        <DateHeader label="Today" sub="Sun Oct 12"/>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <BookingRow type="video" title="Intro call" duration="30 min" time="2:00 PM"
            booker="Daniel Reyes" bookerTone={TONES.blue} status="confirmed"/>
        </div>

        <SectionHeader title="Manage"/>
        <QuickRows items={[
          { icon:'layout-grid',   label:'Event types',         value:'3 active' },
          { icon:'clock',         label:'Availability',        value:'Mon–Fri, 9–5' },
          { icon:'calendar-sync', label:'Connected calendars', value:'Google · iCloud' },
          { icon:'settings',      label:'Settings' },
        ]}/>
        <div style={{ height:8 }}/>
      </div>
      <FooterCTA acc={acc} label="Resume bookings" icon="play"/>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 5 · HOME (composed availability)
// ═══════════════════════════════════════════════════════════════

function FrameHome() {
  const acc = PILLAR.home;
  return (
    <Phone>
      <TopBar title="Scheduling"/>
      <IdentityPills active="home"/>
      <div style={{ flex:1, overflow:'auto', paddingBottom:96 }}>
        <div style={{ height:12 }}/>
        <ComposedNote accent={acc.accent} soft={acc.soft} members={['MK','JD','AV']}/>
        <BookingLinkCard acc={acc} handle="pantopus.com/book/birch-ln" name="412 Birch Ln" role="Household · 3 members"/>
        <PauseRow acc={acc}/>

        <SectionHeader title="Today & upcoming" action="See all bookings"/>
        <DateHeader label="Today" sub="Sun Oct 12"/>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <BookingRow type="inperson" title="Cleaning walk-through" duration="30 min · On site" time="10:00 AM"
            booker="Marlow & Co." bookerTone={TONES.green} status="confirmed"
            crossOwner={{ icon:'user', label:'John', color:P.fg3 }}/>
          <BookingRow type="call" title="Landlord check-in" duration="20 min · Phone" time="1:00 PM"
            booker="R. Alvarez" bookerTone={TONES.amber} status="pending"
            crossOwner={{ icon:'user', label:'Maria', color:P.fg3 }}/>
        </div>

        <SectionHeader title="Manage"/>
        <QuickRows items={[
          { icon:'layout-grid',   label:'Event types',         value:'2 active' },
          { icon:'users',         label:'Member availability', value:'3 members' },
          { icon:'calendar-sync', label:'Connected calendars', value:'Google' },
          { icon:'inbox',         label:'Bookings',            value:'1 needs approval', alert:true },
          { icon:'settings',      label:'Settings' },
        ]}/>
        <div style={{ height:8 }}/>
      </div>
      <FooterCTA acc={acc}/>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 6 · PERMISSION-GATED (member, read-only)
// ═══════════════════════════════════════════════════════════════

function FramePermission() {
  const acc = PILLAR.home;
  return (
    <Phone>
      <TopBar title="Scheduling" right={<i data-lucide="info" style={{ width:20, height:20 }}/>}/>
      <IdentityPills active="home"/>
      <div style={{ flex:1, overflow:'auto', paddingBottom:30 }}>
        {/* read-only banner */}
        <div style={{
          margin:'12px 16px 0', display:'flex', alignItems:'center', gap:10,
          padding:'11px 12px', background:P.infoBg, borderRadius:12,
        }}>
          <i data-lucide="eye" style={{ width:16, height:16, color:P.info, flexShrink:0 }}/>
          <div style={{ flex:1, minWidth:0, fontSize:11.5, color:P.fg2, lineHeight:'15px' }}>
            You have view-only access. Ask an owner to make changes.
          </div>
        </div>

        <BookingLinkCard acc={acc} handle="pantopus.com/book/birch-ln" name="412 Birch Ln" role="Household · 3 members" readOnly/>
        <ReadOnlyStatus acc={acc}/>

        <SectionHeader title="Today & upcoming"/>
        <DateHeader label="Today" sub="Sun Oct 12"/>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <BookingRow type="inperson" title="Cleaning walk-through" duration="30 min · On site" time="10:00 AM"
            booker="Marlow & Co." bookerTone={TONES.green} status="confirmed" readOnly/>
        </div>

        <SectionHeader title="Manage"/>
        <QuickRows readOnly items={[
          { icon:'layout-grid',   label:'Event types',         value:'2 active' },
          { icon:'clock',         label:'Availability',        value:'Mon–Fri, 9–5' },
          { icon:'calendar-sync', label:'Connected calendars', value:'Google' },
        ]}/>
        <div style={{ height:8 }}/>
      </div>
    </Phone>
  );
}

Object.assign(window, {
  FrameDefault, FrameEmpty, FrameSkeleton, FramePaused, FrameHome, FramePermission,
});
