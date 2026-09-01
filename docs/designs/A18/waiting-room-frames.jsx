// A18.4 — Waiting for approval (persistent waiting room)
// Two frames: populated (active wait) + secondary (more info requested · review paused)

const ST = {
  primary600:'#0284c7', primary50:'#f0f9ff', primary100:'#e0f2fe', primary700:'#0369a1', primary200:'#bae6fd', primary800:'#075985',
  fg1:'#111827', fg2:'#374151', fg3:'#6b7280', fg4:'#9ca3af',
  surface:'#ffffff', sunken:'#f3f4f6', muted:'#f8fafc',
  border:'#e5e7eb', borderSub:'#f3f4f6', borderStrong:'#d1d5db',
  success:'#16A34A', successDark:'#15803D', successBg:'#DCFCE7', success50:'#F0FDF4', success200:'#BBF7D0',
  warning:'#D97706', warningDark:'#B45309', warningBg:'#FEF3C7', warning50:'#FFFBEB', warning200:'#FDE68A', warning400:'#FBBF24',
  destructive:'#DC2626', destructiveSoft:'#FEE2E2',
};

function SBWR({ color = ST.fg1 }) {
  return (
    <div style={{
      display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'16px 28px 0', height:44, boxSizing:'border-box',
      fontFamily:'-apple-system, system-ui', fontWeight:600, fontSize:15, color,
      flexShrink:0, position:'relative', zIndex:5,
    }}>
      <span>9:41</span>
      <div style={{display:'flex', gap:5, alignItems:'center'}}>
        <svg width="17" height="11" viewBox="0 0 17 11">
          <rect x="0" y="7" width="3" height="4" rx="0.6" fill={color}/>
          <rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={color}/>
          <rect x="9" y="2" width="3" height="9" rx="0.6" fill={color}/>
          <rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={color}/>
        </svg>
        <svg width="15" height="11" viewBox="0 0 15 11">
          <path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={color}/>
          <path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={color}/>
          <circle cx="7.5" cy="9" r="1.3" fill={color}/>
        </svg>
        <svg width="24" height="11" viewBox="0 0 24 11">
          <rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={color} strokeOpacity="0.45" fill="none"/>
          <rect x="2" y="2" width="17" height="7" rx="1.5" fill={color}/>
        </svg>
      </div>
    </div>
  );
}

function PhoneWR({ children }) {
  return (
    <div style={{
      width:360, height:740, borderRadius:46, padding:10, background:'#0b0f17',
      boxShadow:'0 40px 80px rgba(17,24,39,0.22), 0 0 0 1px rgba(0,0,0,0.14)',
    }}>
      <div style={{
        width:'100%', height:'100%', background:ST.surface,
        borderRadius:36, overflow:'hidden', position:'relative',
        display:'flex', flexDirection:'column',
        fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          position:'absolute', top:9, left:'50%', transform:'translateX(-50%)',
          width:108, height:30, borderRadius:20, background:'#000', zIndex:50,
        }}/>
        <SBWR color={ST.fg1}/>
        {children}
        <div style={{
          position:'absolute', bottom:6, left:'50%', transform:'translateX(-50%)',
          width:120, height:4, borderRadius:4,
          background:'rgba(0,0,0,0.35)', zIndex:60,
        }}/>
      </div>
    </div>
  );
}

function TopBarWR({ title, kind = 'back', trailing }) {
  return (
    <div style={{
      padding:'6px 10px', boxSizing:'border-box', height:52,
      display:'flex', alignItems:'center', justifyContent:'space-between',
      background:ST.surface, flexShrink:0, position:'relative',
      borderBottom:`1px solid ${ST.borderSub}`,
    }}>
      <button style={{
        width:36, height:36, borderRadius:'50%', background:'transparent',
        border:'none', cursor:'pointer', color:ST.fg1,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <i data-lucide={kind === 'back' ? 'chevron-left' : 'x'}
          style={{width:20, height:20, strokeWidth:2.2}}/>
      </button>
      <span style={{
        fontSize:15, fontWeight:700, color:ST.fg1, letterSpacing:-0.15,
        position:'absolute', left:'50%', transform:'translateX(-50%)',
      }}>{title}</span>
      <button style={{
        width:36, height:36, borderRadius:'50%', background:'transparent',
        border:'none', cursor:'pointer', color:ST.fg2,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        {trailing && <i data-lucide={trailing} style={{width:18, height:18, strokeWidth:2.2}}/>}
      </button>
    </div>
  );
}

function HaloCircleWR({ kind = 'info', icon }) {
  const map = {
    info:    { ring:ST.primary200, bg:ST.primary50, color:ST.primary600, ringSoft:'#cfe8fa' },
    warning: { ring:ST.warning200, bg:ST.warning50, color:ST.warning,    ringSoft:'#fde9b8' },
  };
  const c = map[kind];
  return (
    <div style={{
      position:'relative', width:120, height:120,
      display:'flex', alignItems:'center', justifyContent:'center',
      flexShrink:0,
    }}>
      {/* Pulse rings (only on info / active wait) */}
      {kind === 'info' && (
        <>
          <div style={{
            position:'absolute', inset:0, borderRadius:'50%', background:c.bg, opacity:0.45,
            animation:'haloPulse 2.4s ease-out infinite',
          }}/>
          <div style={{
            position:'absolute', inset:8, borderRadius:'50%', background:c.bg, opacity:0.85,
            animation:'haloPulse 2.4s ease-out infinite 0.6s',
          }}/>
        </>
      )}
      {kind === 'warning' && (
        <>
          <div style={{position:'absolute', inset:0, borderRadius:'50%', background:c.bg, opacity:0.5}}/>
          <div style={{position:'absolute', inset:12, borderRadius:'50%', background:c.bg}}/>
        </>
      )}
      <div style={{
        position:'relative', width:96, height:96, borderRadius:'50%',
        background:c.bg, border:`2px solid ${c.ring}`,
        display:'flex', alignItems:'center', justifyContent:'center',
        color:c.color, boxShadow:`0 8px 20px ${c.bg}`,
      }}>
        <i data-lucide={icon} style={{width:44, height:44, strokeWidth:1.8}}/>
      </div>
    </div>
  );
}

function TimelineWR({ steps, paused = false }) {
  const currentIdx = steps.findIndex((s) => s.state === 'current');
  const allDone = steps.every((s) => s.state === 'done');
  const doneCount = steps.filter((s) => s.state === 'done').length;
  let lineWidth = '0%';
  if (allDone) lineWidth = '66.66%';
  else if (currentIdx === 1) lineWidth = '33.33%';
  else if (currentIdx === 2) lineWidth = '66.66%';
  else if (doneCount === 2) lineWidth = '66.66%';

  const activeColor = paused ? ST.warning : ST.primary600;
  const activeHalo  = paused ? ST.warning50 : ST.primary50;

  return (
    <div style={{
      width:'100%', padding:'4px 4px',
      display:'flex', alignItems:'flex-start', justifyContent:'space-between',
      position:'relative',
    }}>
      <div style={{
        position:'absolute', top:14, left:'16.66%', right:'16.66%',
        height:2, background:ST.border, zIndex:0,
      }}/>
      <div style={{
        position:'absolute', top:14, left:'16.66%',
        width: lineWidth,
        height:2, background: activeColor, zIndex:1,
        transition:'width 0.3s',
      }}/>

      {steps.map((s, i) => (
        <div key={i} style={{
          width:'33.33%', display:'flex', flexDirection:'column',
          alignItems:'center', gap:8, zIndex:2,
        }}>
          <div style={{
            width:30, height:30, borderRadius:'50%',
            background:
              s.state === 'done'    ? ST.success :
              s.state === 'current' ? activeColor :
                                       ST.surface,
            border:
              s.state === 'done'    ? 'none' :
              s.state === 'current' ? 'none' :
                                       `1.5px solid ${ST.borderStrong}`,
            color:'#fff',
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:
              s.state === 'current' ? `0 0 0 5px ${activeHalo}` :
              s.state === 'done'    ? `0 0 0 4px ${ST.success50}` : 'none',
          }}>
            {s.state === 'done' && (
              <i data-lucide="check" style={{width:15, height:15, strokeWidth:3, color:'#fff'}}/>
            )}
            {s.state === 'current' && !paused && (
              <span style={{
                width:8, height:8, borderRadius:'50%', background:'#fff',
                animation:'pulseGlow 1.6s ease-in-out infinite',
              }}/>
            )}
            {s.state === 'current' && paused && (
              <i data-lucide="alert-circle" style={{width:16, height:16, strokeWidth:2.6, color:'#fff'}}/>
            )}
          </div>
          <div style={{textAlign:'center', maxWidth:88}}>
            <div style={{
              fontSize:11, fontWeight: s.state !== 'pending' ? 700 : 500,
              color: s.state === 'pending' ? ST.fg3 : ST.fg1,
              letterSpacing:-0.05, lineHeight:'14px',
            }}>{s.label}</div>
            {s.sub && (
              <div style={{
                fontSize:9.5, color: s.state === 'current' && paused ? ST.warningDark : ST.fg3,
                marginTop:2, letterSpacing:0.02, fontWeight:600,
              }}>{s.sub}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function InlineActionsWR({ items }) {
  return (
    <div style={{
      width:'100%', display:'grid', gridTemplateColumns:'1fr 1fr', gap:8,
    }}>
      {items.map((it, i) => (
        <button key={i} style={{
          height:44, borderRadius:10,
          background: it.tone === 'danger' ? ST.surface : ST.surface,
          border:`1px solid ${it.tone === 'danger' ? '#fecaca' : it.tone === 'primary' ? ST.primary200 : ST.border}`,
          color: it.tone === 'danger' ? ST.destructive : it.tone === 'primary' ? ST.primary700 : ST.fg2,
          fontSize:12.5, fontWeight:700, letterSpacing:-0.05,
          display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
          cursor:'pointer', textAlign:'center',
          boxShadow: it.tone === 'primary' ? '0 1px 2px rgba(2,132,199,0.08)' : 'none',
        }}>
          <i data-lucide={it.icon} style={{width:14, height:14, strokeWidth:2.2}}/>
          {it.label}
        </button>
      ))}
    </div>
  );
}

function StickyDockWR({ primary, primaryIcon, secondary }) {
  return (
    <div style={{
      flexShrink:0, padding:'12px 16px 28px',
      background:ST.surface, borderTop:`1px solid ${ST.border}`,
      display:'flex', flexDirection:'column', gap:8,
    }}>
      <button style={{
        width:'100%', height:50, borderRadius:12, border:'none', cursor:'pointer',
        background:ST.primary600, color:'#fff',
        fontSize:14.5, fontWeight:700, letterSpacing:-0.1,
        boxShadow:'0 8px 18px rgba(2,132,199,0.30)',
        display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7,
      }}>
        {primaryIcon && <i data-lucide={primaryIcon} style={{width:15, height:15, strokeWidth:2.4}}/>}
        {primary}
      </button>
      {secondary && (
        <button style={{
          width:'100%', height:44, borderRadius:12,
          background:'transparent', border:'none', cursor:'pointer',
          color:ST.fg2, fontSize:13.5, fontWeight:600, letterSpacing:-0.05,
        }}>{secondary}</button>
      )}
    </div>
  );
}

// Shared chunk: address row with claim ref id
function AddressRowWR({ addr, claimRef }) {
  return (
    <div style={{
      display:'inline-flex', alignItems:'center', gap:8,
      padding:'8px 14px', borderRadius:9999,
      background:ST.muted, border:`1px solid ${ST.border}`,
      color:ST.fg1, fontSize:12, fontWeight:600, letterSpacing:-0.02,
      maxWidth:'94%',
    }}>
      <i data-lucide="home" style={{width:13, height:13, color:ST.primary600, strokeWidth:2.2, flexShrink:0}}/>
      <span style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{addr}</span>
      <span style={{
        marginLeft:2, paddingLeft:8, borderLeft:`1px solid ${ST.border}`,
        color:ST.fg3, fontSize:10.5, fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontWeight:600, letterSpacing:0.02,
      }}>{claimRef}</span>
    </div>
  );
}

// ─── FRAME A · POPULATED — active wait ─────────────────────────
function FrameWaitingRoomActive() {
  return (
    <PhoneWR>
      <TopBarWR title="Waiting for approval" kind="back" trailing="bell"/>

      <div style={{
        flex:1, overflow:'auto', padding:'18px 22px 18px',
        display:'flex', flexDirection:'column', alignItems:'center',
        gap:18, textAlign:'center',
      }}>
        <HaloCircleWR kind="info" icon="hourglass"/>

        <div>
          <h2 style={{
            margin:0, fontSize:23, fontWeight:700, color:ST.fg1,
            letterSpacing:-0.4, lineHeight:'28px',
          }}>Under review</h2>
          <p style={{
            margin:'8px 0 0', fontSize:13.5, color:ST.fg2,
            lineHeight:'19px', maxWidth:288, letterSpacing:-0.05,
          }}>
            Pantopus is checking your documents against county records. You'll get a push the moment we decide.
          </p>
        </div>

        <AddressRowWR addr="418 Linden Ave · Apt 3B" claimRef="CLM-4F2A"/>

        {/* Timeline card */}
        <div style={{
          width:'100%', padding:'18px 8px 16px',
          background:ST.surface, border:`1px solid ${ST.border}`, borderRadius:14,
          boxShadow:'0 1px 2px rgba(17,24,39,0.04)',
        }}>
          <TimelineWR steps={[
            {label:'Submitted',    state:'done',    sub:'Oct 24'},
            {label:'Under review', state:'current', sub:'Started 9h ago'},
            {label:'Approved',     state:'pending'},
          ]}/>
        </div>

        {/* ETA pill */}
        <div style={{
          display:'inline-flex', alignItems:'center', gap:6,
          padding:'7px 13px', borderRadius:9999,
          background:ST.primary50, color:ST.primary700,
          fontSize:11.5, fontWeight:700, letterSpacing:-0.02,
          border:`1px solid ${ST.primary100}`,
        }}>
          <i data-lucide="calendar-clock" style={{width:12, height:12, strokeWidth:2.4}}/>
          Decision usually within 24–48 hours
        </div>

        {/* Inline utility actions */}
        <div style={{width:'100%', marginTop:4}}>
          <div style={{
            fontSize:10.5, fontWeight:700, color:ST.fg4, letterSpacing:0.06,
            textTransform:'uppercase', textAlign:'left', marginBottom:8, paddingLeft:2,
          }}>
            Manage this claim
          </div>
          <InlineActionsWR items={[
            { label:'Update evidence', icon:'file-plus-2',  tone:'default' },
            { label:'Cancel claim',    icon:'x-circle',     tone:'danger'  },
          ]}/>
        </div>
      </div>

      <StickyDockWR primary="View claim" primaryIcon="file-text" secondary="Back to home"/>
    </PhoneWR>
  );
}

// ─── FRAME B · SECONDARY — more info requested ────────────────
function FrameWaitingRoomMoreInfo() {
  return (
    <PhoneWR>
      <TopBarWR title="Waiting for approval" kind="back" trailing="bell"/>

      <div style={{
        flex:1, overflow:'auto', padding:'18px 22px 18px',
        display:'flex', flexDirection:'column', alignItems:'center',
        gap:16, textAlign:'center',
      }}>
        <HaloCircleWR kind="warning" icon="file-warning"/>

        <div>
          <h2 style={{
            margin:0, fontSize:23, fontWeight:700, color:ST.fg1,
            letterSpacing:-0.4, lineHeight:'28px',
          }}>We need one more thing</h2>
          <p style={{
            margin:'8px 0 0', fontSize:13.5, color:ST.fg2,
            lineHeight:'19px', maxWidth:290, letterSpacing:-0.05,
          }}>
            Your utility bill is older than 90 days. Upload one from the last 60 days to continue the review.
          </p>
        </div>

        <AddressRowWR addr="418 Linden Ave · Apt 3B" claimRef="CLM-4F2A"/>

        {/* Reviewer note card */}
        <div style={{
          width:'100%', padding:'12px 14px',
          background:ST.warning50, border:`1px solid ${ST.warning200}`, borderRadius:12,
          display:'flex', gap:10, alignItems:'flex-start', textAlign:'left',
        }}>
          <div style={{
            width:26, height:26, borderRadius:'50%', flexShrink:0,
            background:ST.surface, border:`1px solid ${ST.warning200}`,
            color:ST.warning, display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <i data-lucide="user" style={{width:13, height:13, strokeWidth:2.2}}/>
          </div>
          <div style={{flex:1, minWidth:0}}>
            <div style={{
              fontSize:10.5, fontWeight:700, color:ST.warningDark, letterSpacing:0.04,
              textTransform:'uppercase', marginBottom:3,
            }}>Note from reviewer · Maya K.</div>
            <div style={{
              fontSize:12.5, color:ST.fg1, lineHeight:'17px', letterSpacing:-0.03,
              fontWeight:500,
            }}>
              "The PG&E bill you uploaded is dated July 14. Please upload one from August or later — anything within the last 60 days works."
            </div>
          </div>
        </div>

        {/* Timeline card — paused on Under review */}
        <div style={{
          width:'100%', padding:'18px 8px 16px',
          background:ST.surface, border:`1px solid ${ST.border}`, borderRadius:14,
          boxShadow:'0 1px 2px rgba(17,24,39,0.04)',
        }}>
          <TimelineWR paused steps={[
            {label:'Submitted',    state:'done',    sub:'Oct 24'},
            {label:'Under review', state:'current', sub:'Action needed'},
            {label:'Approved',     state:'pending'},
          ]}/>
        </div>

        {/* ETA pill — warning tone */}
        <div style={{
          display:'inline-flex', alignItems:'center', gap:6,
          padding:'7px 13px', borderRadius:9999,
          background:ST.warningBg, color:ST.warningDark,
          fontSize:11.5, fontWeight:700, letterSpacing:-0.02,
          border:`1px solid ${ST.warning200}`,
        }}>
          <i data-lucide="alert-circle" style={{width:12, height:12, strokeWidth:2.4}}/>
          Paused · respond within 7 days
        </div>

        {/* Inline utility actions — Update evidence elevated */}
        <div style={{width:'100%', marginTop:2}}>
          <div style={{
            fontSize:10.5, fontWeight:700, color:ST.fg4, letterSpacing:0.06,
            textTransform:'uppercase', textAlign:'left', marginBottom:8, paddingLeft:2,
          }}>
            Manage this claim
          </div>
          <InlineActionsWR items={[
            { label:'Update evidence', icon:'file-plus-2',  tone:'primary' },
            { label:'Cancel claim',    icon:'x-circle',     tone:'danger'  },
          ]}/>
        </div>
      </div>

      <StickyDockWR primary="View claim" primaryIcon="file-text" secondary="Back to home"/>
    </PhoneWR>
  );
}

Object.assign(window, { FrameWaitingRoomActive, FrameWaitingRoomMoreInfo });
