// A18.2 — Claim submitted (post-submit confirmation)
// Two frames: populated (just submitted) + secondary (approved · final state)

const ST = {
  primary600:'#0284c7', primary50:'#f0f9ff', primary100:'#e0f2fe', primary700:'#0369a1', primary200:'#bae6fd',
  fg1:'#111827', fg2:'#374151', fg3:'#6b7280', fg4:'#9ca3af',
  surface:'#ffffff', sunken:'#f3f4f6', muted:'#f8fafc',
  border:'#e5e7eb', borderSub:'#f3f4f6', borderStrong:'#d1d5db',
  success:'#16A34A', successDark:'#15803D', successBg:'#DCFCE7', success50:'#F0FDF4', success200:'#BBF7D0',
  destructive:'#DC2626',
};

function SBClaim({ color = ST.fg1 }) {
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

function PhoneClaim({ children }) {
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
        <SBClaim color={ST.fg1}/>
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

function TopBarClaim({ kind = 'close', title }) {
  return (
    <div style={{
      padding:'6px 10px', boxSizing:'border-box', height:52,
      display:'flex', alignItems:'center', justifyContent: title ? 'space-between' : 'flex-start',
      background:ST.surface, flexShrink:0, position:'relative',
    }}>
      <button style={{
        width:36, height:36, borderRadius:'50%', background:'transparent',
        border:'none', cursor:'pointer', color:ST.fg1,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <i data-lucide={kind === 'back' ? 'chevron-left' : 'x'}
          style={{width:20, height:20, strokeWidth:2.2}}/>
      </button>
      {title && (
        <span style={{
          fontSize:15, fontWeight:700, color:ST.fg1, letterSpacing:-0.15,
          position:'absolute', left:'50%', transform:'translateX(-50%)',
        }}>{title}</span>
      )}
      <span style={{width:36, height:36}}/>
    </div>
  );
}

function HaloCircleClaim({ kind = 'success', icon }) {
  const map = {
    success: { ring:ST.success200, bg:ST.success50, color:ST.success },
    info:    { ring:ST.primary200, bg:ST.primary50, color:ST.primary600 },
  };
  const c = map[kind];
  return (
    <div style={{
      position:'relative', width:120, height:120,
      display:'flex', alignItems:'center', justifyContent:'center',
      flexShrink:0,
    }}>
      <div style={{position:'absolute', inset:0, borderRadius:'50%', background:c.bg, opacity:0.5}}/>
      <div style={{position:'absolute', inset:12, borderRadius:'50%', background:c.bg}}/>
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

function TimelineClaim({ steps }) {
  const currentIdx = steps.findIndex((s) => s.state === 'current');
  const allDone = steps.every((s) => s.state === 'done');
  const lineWidth = allDone ? '66.66%' : currentIdx > 0 ? '33.33%' : '0%';
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
        height:2, background: allDone ? ST.success : ST.primary600, zIndex:1,
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
              s.state === 'current' ? ST.primary600 :
                                       ST.surface,
            border:
              s.state === 'done'    ? 'none' :
              s.state === 'current' ? 'none' :
                                       `1.5px solid ${ST.borderStrong}`,
            color:'#fff',
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:
              s.state === 'current' ? `0 0 0 5px ${ST.primary50}` :
              s.state === 'done'    ? `0 0 0 4px ${ST.success50}` : 'none',
          }}>
            {s.state === 'done' && (
              <i data-lucide="check" style={{width:15, height:15, strokeWidth:3, color:'#fff'}}/>
            )}
            {s.state === 'current' && (
              <span style={{
                width:8, height:8, borderRadius:'50%', background:'#fff',
                animation:'pulseGlow 1.6s ease-in-out infinite',
              }}/>
            )}
          </div>
          <div style={{textAlign:'center', maxWidth:84}}>
            <div style={{
              fontSize:11, fontWeight: s.state !== 'pending' ? 700 : 500,
              color: s.state === 'pending' ? ST.fg3 : ST.fg1,
              letterSpacing:-0.05, lineHeight:'14px',
            }}>{s.label}</div>
            {s.sub && (
              <div style={{
                fontSize:9.5, color:ST.fg3, marginTop:2, letterSpacing:0.02,
                fontWeight:500,
              }}>{s.sub}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function StickyDockClaim({ primary, secondary, icon }) {
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
        {icon && <i data-lucide={icon} style={{width:15, height:15, strokeWidth:2.4}}/>}
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

// ─── FRAME A · POPULATED — fresh submission ────────────────────
function FrameClaimSubmitted() {
  return (
    <PhoneClaim>
      <TopBarClaim kind="close" title="Claim submitted"/>

      <div style={{
        flex:1, overflow:'auto', padding:'4px 22px 0',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        gap:22, textAlign:'center',
      }}>
        <HaloCircleClaim kind="success" icon="check"/>

        <div>
          <h2 style={{
            margin:0, fontSize:24, fontWeight:700, color:ST.fg1,
            letterSpacing:-0.4, lineHeight:'29px',
          }}>Claim submitted</h2>
          <p style={{
            margin:'10px 0 0', fontSize:14, color:ST.fg2,
            lineHeight:'20px', maxWidth:280, letterSpacing:-0.05,
          }}>
            We'll review your deed and address match within 3 business days and send you a decision.
          </p>
        </div>

        {/* Address chip — names what was claimed */}
        <div style={{
          display:'inline-flex', alignItems:'center', gap:8,
          padding:'8px 14px', borderRadius:9999,
          background:ST.muted, border:`1px solid ${ST.border}`,
          color:ST.fg1, fontSize:12, fontWeight:600, letterSpacing:-0.02,
          maxWidth:'92%',
        }}>
          <i data-lucide="home" style={{width:13, height:13, color:ST.primary600, strokeWidth:2.2, flexShrink:0}}/>
          <span style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
            418 Linden Ave, Oakland CA
          </span>
        </div>

        <div style={{
          width:'100%', padding:'18px 12px 16px',
          background:ST.surface, border:`1px solid ${ST.border}`, borderRadius:14,
          boxShadow:'0 1px 2px rgba(17,24,39,0.04)',
        }}>
          <TimelineClaim steps={[
            {label:'Submitted',    state:'done',    sub:'Oct 10'},
            {label:'Under review', state:'pending'},
            {label:'Decision',     state:'pending'},
          ]}/>
        </div>

        <div style={{
          display:'inline-flex', alignItems:'center', gap:6,
          padding:'6px 12px', borderRadius:9999,
          background:ST.successBg, color:ST.successDark,
          fontSize:11.5, fontWeight:700, letterSpacing:-0.02,
          border:`1px solid ${ST.success200}`,
        }}>
          <i data-lucide="calendar-clock" style={{width:12, height:12, strokeWidth:2.4}}/>
          Decision expected by Oct 17
        </div>
      </div>

      <StickyDockClaim primary="View status" secondary="Back to home" icon="arrow-right"/>
    </PhoneClaim>
  );
}

// ─── FRAME B · SECONDARY — approved (final state, same screen revisited) ─────
function FrameClaimApproved() {
  return (
    <PhoneClaim>
      <TopBarClaim kind="close" title="Claim submitted"/>

      <div style={{
        flex:1, overflow:'auto', padding:'4px 22px 0',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        gap:22, textAlign:'center',
      }}>
        <HaloCircleClaim kind="success" icon="badge-check"/>

        <div>
          <h2 style={{
            margin:0, fontSize:24, fontWeight:700, color:ST.fg1,
            letterSpacing:-0.4, lineHeight:'29px',
          }}>You're the owner</h2>
          <p style={{
            margin:'10px 0 0', fontSize:14, color:ST.fg2,
            lineHeight:'20px', maxWidth:280, letterSpacing:-0.05,
          }}>
            Your ownership claim was approved. The Home badge now shows on your profile and household.
          </p>
        </div>

        <div style={{
          display:'inline-flex', alignItems:'center', gap:8,
          padding:'8px 14px', borderRadius:9999,
          background:ST.muted, border:`1px solid ${ST.border}`,
          color:ST.fg1, fontSize:12, fontWeight:600, letterSpacing:-0.02,
          maxWidth:'92%',
        }}>
          <i data-lucide="home" style={{width:13, height:13, color:ST.primary600, strokeWidth:2.2, flexShrink:0}}/>
          <span style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
            418 Linden Ave, Oakland CA
          </span>
        </div>

        <div style={{
          width:'100%', padding:'18px 12px 16px',
          background:ST.surface, border:`1px solid ${ST.border}`, borderRadius:14,
          boxShadow:'0 1px 2px rgba(17,24,39,0.04)',
        }}>
          <TimelineClaim steps={[
            {label:'Submitted',    state:'done', sub:'Oct 10'},
            {label:'Under review', state:'done', sub:'Oct 11'},
            {label:'Approved',     state:'done', sub:'Oct 14'},
          ]}/>
        </div>

        <div style={{
          display:'inline-flex', alignItems:'center', gap:6,
          padding:'6px 12px', borderRadius:9999,
          background:ST.successBg, color:ST.successDark,
          fontSize:11.5, fontWeight:700, letterSpacing:-0.02,
          border:`1px solid ${ST.success200}`,
        }}>
          <i data-lucide="check-circle-2" style={{width:12, height:12, strokeWidth:2.4}}/>
          Approved · 3 days ago
        </div>
      </div>

      <StickyDockClaim primary="Open your home" secondary="See your Home badge" icon="arrow-right"/>
    </PhoneClaim>
  );
}

Object.assign(window, { FrameClaimSubmitted, FrameClaimApproved });
