// §1B-4 — src/screens/gig-v2/_components/DeliveryProofSheet.tsx
// Proof-of-delivery / completion sheet a worker uses to mark a V2 task delivered.
// Bottom sheet on A13 Form patterns: title · upload (proof) · optional note ·
// primary "Mark as delivered" → submitted "Delivery confirmed" state.
// Rendered over a dimmed Task-V2 detail backdrop in the shared bezel.
// One sheet · two states (Entry · Submitted).

// ── extra locals on top of BU (beacon-shell.jsx) ─────────────────
const DP = {
  amber:'#B45309', amberBg:'#FEF3C7',
  halo:'0 8px 18px rgba(2,132,199,0.30)',
  okRing:'rgba(5,150,105,0.06)',
  r2xl:20,
};

function DScrim() {
  return <div style={{position:'absolute', inset:0, background:'rgba(17,24,39,0.45)', zIndex:40}}/>;
}

// ── faint Task-V2 detail backdrop ────────────────────────────────
function DBackdrop() {
  const chip = (icon, label) => (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5, padding:'4px 9px', borderRadius:9999,
      background:BU.sunken, color:BU.fg2, fontSize:11.5, fontWeight:600,
    }}>
      <i data-lucide={icon} style={{width:12, height:12, strokeWidth:2.2}}/>{label}
    </span>
  );
  return (
    <div style={{flex:1, display:'flex', flexDirection:'column', overflow:'hidden'}}>
      <div style={{
        height:50, flexShrink:0, background:BU.surface, borderBottom:`1px solid ${BU.border}`,
        display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 14px',
      }}>
        <i data-lucide="chevron-left" style={{width:24, height:24, color:BU.fg1}}/>
        <span style={{
          display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:9999,
          background:DP.amberBg, color:DP.amber, fontSize:11.5, fontWeight:700,
        }}>
          <i data-lucide="loader" style={{width:12, height:12, strokeWidth:2.4}}/>In progress
        </span>
        <i data-lucide="more-horizontal" style={{width:22, height:22, color:BU.fg2}}/>
      </div>
      <div style={{flex:1, overflow:'hidden', background:BU.muted, padding:'18px 16px 0'}}>
        <div style={{fontSize:30, fontWeight:800, color:BU.fg1, letterSpacing:-1}}>$85</div>
        <div style={{fontSize:18, fontWeight:700, color:BU.fg1, letterSpacing:-0.3, marginTop:2}}>Move a mattress</div>
        <div style={{display:'flex', gap:7, marginTop:12}}>
          {chip('package','Moving')}
          {chip('map-pin','0.6 mi')}
          {chip('user','Hired · Rae')}
        </div>
        <div style={{
          marginTop:16, height:64, borderRadius:14, background:BU.surface, border:`1px solid ${BU.border}`,
        }}/>
        <div style={{
          marginTop:12, height:120, borderRadius:14, background:BU.surface, border:`1px solid ${BU.border}`,
        }}/>
      </div>
    </div>
  );
}

// ── docked sheet scaffold ────────────────────────────────────────
function DSheet({ title, subtitle, children, cta, ctaIcon, ctaDisabled }) {
  return (
    <div style={{
      position:'absolute', left:0, right:0, bottom:0, zIndex:45,
      background:BU.surface, borderTopLeftRadius:DP.r2xl, borderTopRightRadius:DP.r2xl,
      boxShadow:'0 -8px 30px rgba(17,24,39,0.22)', overflow:'hidden',
      display:'flex', flexDirection:'column', maxHeight:'90%',
    }}>
      <div style={{display:'flex', justifyContent:'center', paddingTop:8, paddingBottom:2, flexShrink:0}}>
        <div style={{width:38, height:5, borderRadius:9999, background:BU.borderStrong}}/>
      </div>
      <div style={{padding:'10px 20px 0', flexShrink:0}}>
        <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10}}>
          <div>
            <h2 style={{margin:0, fontSize:18, fontWeight:700, color:BU.fg1, letterSpacing:-0.3}}>{title}</h2>
            {subtitle && <p style={{margin:'3px 0 0', fontSize:12.5, color:BU.fg3, letterSpacing:-0.05, lineHeight:'17px'}}>{subtitle}</p>}
          </div>
          <button aria-label="Close" style={{
            width:30, height:30, borderRadius:'50%', border:'none', background:BU.sunken,
            color:BU.fg3, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
          }}>
            <i data-lucide="x" style={{width:17, height:17, strokeWidth:2.4}}/>
          </button>
        </div>
      </div>
      <div style={{padding:'18px 20px 0', overflow:'auto', flex:1, minHeight:0}}>{children}</div>
      <div style={{padding:'14px 20px 18px', flexShrink:0}}>
        <button disabled={ctaDisabled} style={{
          width:'100%', height:50, border:'none', borderRadius:12, cursor: ctaDisabled ? 'not-allowed' : 'pointer',
          background: ctaDisabled ? '#bae0f5' : BU.primary600, color:'#fff',
          fontSize:15.5, fontWeight:700, letterSpacing:-0.1, opacity: ctaDisabled ? 0.85 : 1,
          display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          boxShadow: ctaDisabled ? 'none' : DP.halo,
        }}>
          {cta}
          {ctaIcon && <i data-lucide={ctaIcon} style={{width:18, height:18, strokeWidth:2.6}}/>}
        </button>
      </div>
    </div>
  );
}

function Overline({ children }) {
  return (
    <div style={{
      fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase',
      color:BU.fg4, marginBottom:10,
    }}>{children}</div>
  );
}

// ── proof photo thumbnail (mock — no real asset) ─────────────────
function PhotoThumb() {
  return (
    <div style={{
      position:'relative', height:96, borderRadius:12, overflow:'hidden',
      background:'linear-gradient(135deg, #cbd5e1 0%, #94a3b8 55%, #64748b 100%)',
      display:'flex', alignItems:'center', justifyContent:'center',
    }}>
      <i data-lucide="image" style={{width:26, height:26, color:'rgba(255,255,255,0.85)', strokeWidth:1.8}}/>
      <span style={{
        position:'absolute', top:6, right:6, width:20, height:20, borderRadius:'50%',
        background:BU.success, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
        border:'2px solid #fff',
      }}>
        <i data-lucide="check" style={{width:10, height:10, strokeWidth:4}}/>
      </span>
      <button aria-label="Remove" style={{
        position:'absolute', bottom:6, right:6, width:22, height:22, borderRadius:'50%',
        background:'rgba(17,24,39,0.6)', color:'#fff', border:'none', cursor:'pointer',
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <i data-lucide="x" style={{width:12, height:12, strokeWidth:2.6}}/>
      </button>
    </div>
  );
}
function AddTile() {
  return (
    <div style={{
      height:96, borderRadius:12, border:`1.5px dashed ${BU.borderStrong}`, background:BU.muted,
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:5,
      color:BU.fg3, cursor:'pointer',
    }}>
      <i data-lucide="camera" style={{width:22, height:22, strokeWidth:2}}/>
      <span style={{fontSize:11.5, fontWeight:600, letterSpacing:-0.05}}>Add</span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  STATE 1 — ENTRY (compose proof)
// ════════════════════════════════════════════════════════════════
function FrameDeliveryProofEntry() {
  return (
    <BPhone>
      <DBackdrop/>
      <DScrim/>
      <DSheet
        title="Confirm delivery"
        subtitle="Add a photo so the poster can release your payment."
        cta="Mark as delivered" ctaIcon="check-check"
      >
        <Overline>Photo proof *</Overline>
        <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8}}>
          <PhotoThumb/>
          <AddTile/>
        </div>
        <p style={{margin:'8px 0 20px', fontSize:11, fontStyle:'italic', color:BU.fg3, lineHeight:'15px'}}>
          Show the completed work or the drop-off spot. At least one photo.
        </p>

        <Overline>Note (optional)</Overline>
        <div style={{
          minHeight:74, borderRadius:8, border:`1px solid ${BU.border}`, background:BU.surface,
          padding:'11px 12px', fontSize:13.5, color:BU.fg4, lineHeight:'19px', letterSpacing:-0.05,
        }}>e.g. Left it by the side door as we agreed — thanks!</div>
        <p style={{margin:'8px 0 18px', fontSize:11, fontStyle:'italic', color:BU.fg3, lineHeight:'15px'}}>
          The poster sees this with your proof.
        </p>

        <div style={{
          display:'flex', gap:9, alignItems:'center', padding:'11px 13px', marginBottom:4,
          borderRadius:10, background:BU.primary50, color:BU.primary700,
        }}>
          <i data-lucide="shield-check" style={{width:16, height:16, strokeWidth:2.2, flexShrink:0}}/>
          <span style={{fontSize:11.5, lineHeight:'16px', letterSpacing:-0.02}}>Payment is released once the poster confirms — usually within a few hours.</span>
        </div>
      </DSheet>
    </BPhone>
  );
}

// ════════════════════════════════════════════════════════════════
//  STATE 2 — SUBMITTED (delivery confirmed)
// ════════════════════════════════════════════════════════════════
function FrameDeliveryProofSubmitted() {
  return (
    <BPhone>
      <DBackdrop/>
      <DScrim/>
      <div style={{
        position:'absolute', left:0, right:0, bottom:0, zIndex:45,
        background:BU.surface, borderTopLeftRadius:DP.r2xl, borderTopRightRadius:DP.r2xl,
        boxShadow:'0 -8px 30px rgba(17,24,39,0.22)', overflow:'hidden',
      }}>
        <div style={{display:'flex', justifyContent:'center', paddingTop:8}}>
          <div style={{width:38, height:5, borderRadius:9999, background:BU.borderStrong}}/>
        </div>
        <div style={{padding:'24px 28px 22px', display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center'}}>
          <div style={{
            width:78, height:78, borderRadius:'50%', background:BU.successBg,
            display:'flex', alignItems:'center', justifyContent:'center', color:BU.success,
            marginBottom:20, boxShadow:`0 0 0 8px ${DP.okRing}`,
          }}>
            <i data-lucide="check" style={{width:36, height:36, strokeWidth:3}}/>
          </div>
          <h2 style={{margin:0, fontSize:22, fontWeight:700, color:BU.fg1, letterSpacing:-0.4}}>Delivery confirmed</h2>
          <p style={{margin:'10px auto 0', fontSize:13.5, color:BU.fg3, lineHeight:'20px', letterSpacing:-0.05, maxWidth:268}}>
            We’ve let the poster know. Payment releases once they confirm — usually within a few hours.
          </p>

          {/* recap card */}
          <div style={{
            width:'100%', marginTop:20, display:'flex', alignItems:'center', gap:12,
            padding:'12px 14px', borderRadius:12, border:`1px solid ${BU.border}`, background:BU.muted,
          }}>
            <div style={{
              width:46, height:46, borderRadius:9, flexShrink:0,
              background:'linear-gradient(135deg, #cbd5e1 0%, #94a3b8 55%, #64748b 100%)',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <i data-lucide="image" style={{width:18, height:18, color:'rgba(255,255,255,0.9)'}}/>
            </div>
            <div style={{flex:1, minWidth:0, textAlign:'left'}}>
              <div style={{fontSize:13.5, fontWeight:600, color:BU.fg1, letterSpacing:-0.1}}>Proof sent · 1 photo, note</div>
              <div style={{fontSize:11.5, color:BU.fg3, marginTop:1}}>Today at 2:14 PM</div>
            </div>
            <i data-lucide="check-check" style={{width:18, height:18, color:BU.success, strokeWidth:2.2}}/>
          </div>
        </div>

        <div style={{padding:'0 20px 18px'}}>
          <button style={{
            width:'100%', height:50, border:'none', borderRadius:12, cursor:'pointer',
            background:BU.primary600, color:'#fff', fontSize:15.5, fontWeight:700, letterSpacing:-0.1,
            display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:DP.halo,
          }}>
            Back to task
            <i data-lucide="arrow-right" style={{width:18, height:18, strokeWidth:2.6}}/>
          </button>
        </div>
      </div>
    </BPhone>
  );
}

Object.assign(window, { FrameDeliveryProofEntry, FrameDeliveryProofSubmitted });
