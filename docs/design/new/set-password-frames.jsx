// §1B-1 — src/screens/(auth)/reset-password.tsx
// "Set a new password" — the screen reached from a password-reset email link.
// Auth archetype variant (sibling to Auth Frame 4 · Reset password). Renders
// inside the shared beacon-family BPhone bezel so it is a pixel-true sibling.
// Slots: brand_lockup → kicker → headline → subcopy → fields[] (new + confirm,
// 44px, label-above, leading lock icon, eye toggle) → strength meter (3-bar) →
// primary 48px "Update password" CTA → secondary link → shield-check footer.
// 4 frames: Default · Validation (strength + mismatch) · Valid · Success.

// ── extra locals layered on top of BU (from beacon-shell.jsx) ────
const SP = {
  fieldBg: '#ffffff',
  errBg: '#FEF2F2',
  okBg: '#ECFDF5',
  halo: '0 8px 18px rgba(2,132,199,0.30)',
  ring: '0 0 0 3px rgba(2,132,199,0.15)',
  ringErr: '0 0 0 3px rgba(220,38,38,0.12)',
  ringOk: '0 0 0 3px rgba(5,150,105,0.12)',
};

// ── Brand lockup: favicon mark + wordmark ────────────────────────
function BrandLockup() {
  return (
    <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:10}}>
      <img src="favicon.svg" alt="" width={46} height={46}
        style={{borderRadius:12, boxShadow:'0 4px 12px rgba(2,132,199,0.22)'}}/>
      <div style={{
        fontSize:20, fontWeight:700, color:BU.fg1, letterSpacing:-0.4,
      }}>Pantopus</div>
    </div>
  );
}

// ── 3-bar strength meter ─────────────────────────────────────────
function StrengthMeter({ level, helper }) {
  // level: 0 none · 1 weak (error) · 2 fair (amber) · 3 strong (success)
  const map = {
    0: { label:'', color:BU.fg4 },
    1: { label:'Weak',   color:BU.error },
    2: { label:'Fair',   color:BU.amber },
    3: { label:'Strong', color:BU.success },
  };
  const m = map[level];
  return (
    <div style={{marginTop:8}}>
      <div style={{display:'flex', gap:5}}>
        {[1,2,3].map((n) => (
          <div key={n} style={{
            flex:1, height:4, borderRadius:9999,
            background: n <= level ? m.color : BU.sunken,
            transition:'background 150ms ease-out',
          }}/>
        ))}
      </div>
      <div style={{
        display:'flex', justifyContent:'space-between', alignItems:'center',
        marginTop:6, gap:8,
      }}>
        <span style={{fontSize:11, color:BU.fg3, letterSpacing:-0.05, lineHeight:'15px'}}>{helper}</span>
        {m.label && (
          <span style={{fontSize:11, fontWeight:700, color:m.color, letterSpacing:0.02, flexShrink:0}}>{m.label}</span>
        )}
      </div>
    </div>
  );
}

// ── One auth field (label-above, leading lock, eye toggle) ───────
function Field({
  label, value, placeholder, state = 'default', revealed = false,
  mono = false, message, messageIcon = 'alert-circle',
}) {
  const borderColor = {
    default: BU.border, focus: BU.primary600, valid: BU.success, error: BU.error,
  }[state];
  const ring = state === 'focus' ? SP.ring
    : state === 'error' ? SP.ringErr
    : state === 'valid' ? SP.ringOk : 'none';
  const fill = state === 'error' ? SP.errBg : SP.fieldBg;
  const msgColor = state === 'error' ? BU.error : BU.success;
  const empty = !value;
  return (
    <div style={{marginBottom:14}}>
      <label style={{
        display:'block', fontSize:12.5, fontWeight:600, color:BU.fg2,
        letterSpacing:-0.05, marginBottom:6,
      }}>{label} <span style={{color:BU.error}}>*</span></label>

      <div style={{
        display:'flex', alignItems:'center', gap:9, height:44,
        padding:'0 12px', boxSizing:'border-box',
        background:fill, border:`${state==='error'||state==='focus'?1.5:1}px solid ${borderColor}`,
        borderRadius:8, boxShadow:ring,
      }}>
        <i data-lucide="lock" style={{width:16, height:16, strokeWidth:2, color: state==='default'? BU.fg4 : borderColor, flexShrink:0}}/>
        <span style={{
          flex:1, minWidth:0, fontSize:14,
          fontFamily: mono && !empty ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit',
          color: empty ? BU.fg4 : BU.fg1, letterSpacing: mono && !empty ? 0.3 : -0.1,
          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
        }}>{empty ? placeholder : (revealed ? value : '•'.repeat(value.length))}</span>

        {state === 'valid' && (
          <i data-lucide="check" style={{width:16, height:16, strokeWidth:3, color:BU.success, flexShrink:0}}/>
        )}
        <button aria-label={revealed ? 'Hide' : 'Show'} style={{
          width:26, height:26, border:'none', background:'transparent', cursor:'pointer',
          color:BU.fg4, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
        }}>
          <i data-lucide={revealed ? 'eye-off' : 'eye'} style={{width:17, height:17, strokeWidth:2}}/>
        </button>
      </div>

      {message && (
        <div style={{
          display:'flex', alignItems:'center', gap:5, marginTop:6,
          color:msgColor, fontSize:11.5, fontWeight:500, letterSpacing:-0.05,
        }}>
          <i data-lucide={messageIcon} style={{width:13, height:13, strokeWidth:2.4}}/>
          <span>{message}</span>
        </div>
      )}
    </div>
  );
}

// ── Primary 48px CTA ─────────────────────────────────────────────
function PrimaryCTA({ label, icon = 'check', disabled = false }) {
  return (
    <button disabled={disabled} style={{
      width:'100%', height:48, border:'none', borderRadius:12, cursor: disabled ? 'not-allowed' : 'pointer',
      background: disabled ? '#bae0f5' : BU.primary600, color:'#fff',
      fontSize:15, fontWeight:700, letterSpacing:-0.1,
      display:'flex', alignItems:'center', justifyContent:'center', gap:8,
      boxShadow: disabled ? 'none' : SP.halo, opacity: disabled ? 0.85 : 1,
    }}>
      {label}
      <i data-lucide={icon} style={{width:17, height:17, strokeWidth:2.6}}/>
    </button>
  );
}

// ── Trust footer ─────────────────────────────────────────────────
function TrustFooter() {
  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'center', gap:7,
      padding:'14px 0 18px', color:BU.fg4,
    }}>
      <i data-lucide="shield-check" style={{width:14, height:14, strokeWidth:2, color:BU.success}}/>
      <span style={{fontSize:11.5, fontWeight:500, letterSpacing:-0.02}}>Verified by address · encrypted</span>
    </div>
  );
}

// ── Screen scaffold (centered column inside BPhone) ──────────────
function AuthScreen({ children, footer = true }) {
  return (
    <BPhone>
      <div style={{flex:1, display:'flex', flexDirection:'column', overflow:'hidden'}}>
        <div style={{
          flex:1, display:'flex', flexDirection:'column', justifyContent:'center',
          padding:'12px 28px 4px', minHeight:0,
        }}>{children}</div>
        {footer && <TrustFooter/>}
      </div>
    </BPhone>
  );
}

// ── Form header block (lockup → kicker → headline → subcopy) ─────
function FormHead({ subcopy }) {
  return (
    <>
      <BrandLockup/>
      <div style={{textAlign:'center', marginTop:22}}>
        <div style={{
          fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase',
          color:BU.primary600, marginBottom:7,
        }}>Almost done</div>
        <h1 style={{
          margin:0, fontSize:24, fontWeight:700, color:BU.fg1, letterSpacing:-0.5, lineHeight:1.15,
        }}>Set a new password</h1>
        <p style={{
          margin:'9px auto 0', fontSize:13.5, color:BU.fg3, lineHeight:'19px',
          letterSpacing:-0.05, maxWidth:264,
        }}>{subcopy}</p>
      </div>
    </>
  );
}

const SUB = 'Create a new password for your account — you’ll use it to sign in next time.';

// ════════════════════════════════════════════════════════════════
//  FRAME 1 — DEFAULT (empty, awaiting input)
// ════════════════════════════════════════════════════════════════
function FrameSetPwDefault() {
  return (
    <AuthScreen>
      <FormHead subcopy={SUB}/>
      <div style={{marginTop:24}}>
        <Field label="New password" value="" placeholder="Enter a new password"/>
        <StrengthMeter level={0} helper="Use 8+ characters with a number and a symbol."/>
        <div style={{height:14}}/>
        <Field label="Confirm password" value="" placeholder="Re-enter your password"/>
        <div style={{height:6}}/>
        <PrimaryCTA label="Update password" disabled/>
        <div style={{textAlign:'center', marginTop:16, fontSize:13, color:BU.fg3}}>
          <a style={{color:BU.primary600, fontWeight:600, textDecoration:'none'}}>← Back to sign in</a>
        </div>
      </div>
    </AuthScreen>
  );
}

// ════════════════════════════════════════════════════════════════
//  FRAME 2 — VALIDATION (strong new pw · confirm mismatch)
// ════════════════════════════════════════════════════════════════
function FrameSetPwValidation() {
  return (
    <AuthScreen>
      <FormHead subcopy={SUB}/>
      <div style={{marginTop:24}}>
        <Field label="New password" value="river-otter-92!" revealed mono state="focus"/>
        <StrengthMeter level={3} helper="Great — long, with a number and a symbol."/>
        <div style={{height:14}}/>
        <Field label="Confirm password" value="river-otter-9" state="error"
          message="Passwords don’t match" messageIcon="alert-circle"/>
        <div style={{height:6}}/>
        <PrimaryCTA label="Update password" disabled/>
        <div style={{textAlign:'center', marginTop:16, fontSize:13, color:BU.fg3}}>
          <a style={{color:BU.primary600, fontWeight:600, textDecoration:'none'}}>← Back to sign in</a>
        </div>
      </div>
    </AuthScreen>
  );
}

// ════════════════════════════════════════════════════════════════
//  FRAME 3 — VALID (strong + matched · button enabled)
// ════════════════════════════════════════════════════════════════
function FrameSetPwValid() {
  return (
    <AuthScreen>
      <FormHead subcopy={SUB}/>
      <div style={{marginTop:24}}>
        <Field label="New password" value="river-otter-92!" revealed mono state="valid"/>
        <StrengthMeter level={3} helper="Great — long, with a number and a symbol."/>
        <div style={{height:14}}/>
        <Field label="Confirm password" value="river-otter-92!" state="valid"
          message="Passwords match" messageIcon="check"/>
        <div style={{height:6}}/>
        <PrimaryCTA label="Update password"/>
        <div style={{textAlign:'center', marginTop:16, fontSize:13, color:BU.fg3}}>
          <a style={{color:BU.primary600, fontWeight:600, textDecoration:'none'}}>← Back to sign in</a>
        </div>
      </div>
    </AuthScreen>
  );
}

// ════════════════════════════════════════════════════════════════
//  FRAME 4 — SUCCESS ("Password updated")
// ════════════════════════════════════════════════════════════════
function FrameSetPwSuccess() {
  return (
    <AuthScreen>
      <div style={{display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center'}}>
        <div style={{
          width:80, height:80, borderRadius:'50%', background:BU.successBg,
          display:'flex', alignItems:'center', justifyContent:'center',
          color:BU.success, marginBottom:24,
          boxShadow:'0 0 0 8px rgba(5,150,105,0.06)',
        }}>
          <i data-lucide="check" style={{width:38, height:38, strokeWidth:3}}/>
        </div>
        <h1 style={{margin:0, fontSize:24, fontWeight:700, color:BU.fg1, letterSpacing:-0.5, lineHeight:1.15}}>
          Password updated
        </h1>
        <p style={{margin:'10px auto 0', fontSize:13.5, color:BU.fg3, lineHeight:'20px', letterSpacing:-0.05, maxWidth:262}}>
          Your password has been changed. Sign in with your new password to continue.
        </p>

        <div style={{
          marginTop:20, padding:'10px 14px', borderRadius:10,
          background:BU.surface, border:`1px solid ${BU.border}`,
          display:'inline-flex', alignItems:'center', gap:8, color:BU.fg3,
          fontSize:11.5, fontWeight:500, letterSpacing:-0.02,
        }}>
          <i data-lucide="shield-check" style={{width:14, height:14, color:BU.primary600, strokeWidth:2}}/>
          <span>Signed out of other devices for security</span>
        </div>

        <div style={{width:'100%', marginTop:28}}>
          <PrimaryCTA label="Continue to sign in" icon="arrow-right"/>
        </div>
      </div>
    </AuthScreen>
  );
}

Object.assign(window, {
  FrameSetPwDefault, FrameSetPwValidation, FrameSetPwValid, FrameSetPwSuccess,
});
