// §1B-2 — src/screens/(auth)/verify-email.tsx
// Email-verification DEEP-LINK LANDING — the screen shown AFTER the user taps
// the link in the verification email. Sibling to A18.1 "Verify Email Sent"
// (the pre-tap "we sent you an email" state). A18 status archetype, collapsed
// (no timeline — the check is instant): halo · headline · body · status pill ·
// CTA stack · footer. Rendered in the shared beacon-family BPhone bezel.
// 3 states: Verifying (loading) · Verified (success) · Expired (error).

// ── extra locals on top of BU (beacon-shell.jsx) ─────────────────
const VE = {
  amber:'#B45309', amberBg:'#FEF3C7', amberRing:'rgba(180,83,9,0.06)',
  halo:'0 8px 18px rgba(2,132,199,0.30)',
  okRing:'rgba(5,150,105,0.06)', infoRing:'rgba(2,132,199,0.07)',
};

// ── CSS ring spinner (robust, no icon dependency) ────────────────
function Ring({ size = 18, w = 2.5, track = BU.primary100, head = BU.primary600 }) {
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%',
      border:`${w}px solid ${track}`, borderTopColor:head,
      animation:'spin 0.8s linear infinite', flexShrink:0,
    }}/>
  );
}

// ── 80px status halo ─────────────────────────────────────────────
function Halo({ tone }) {
  if (tone === 'verifying') {
    return (
      <div style={{position:'relative', width:80, height:80, marginBottom:24}}>
        <div style={{
          position:'absolute', inset:0, borderRadius:'50%', background:BU.primary50,
          display:'flex', alignItems:'center', justifyContent:'center', color:BU.primary600,
        }}>
          <i data-lucide="mail" style={{width:34, height:34, strokeWidth:1.9}}/>
        </div>
        <div style={{
          position:'absolute', inset:-2, borderRadius:'50%',
          border:'3px solid transparent', borderTopColor:BU.primary600,
          animation:'spin 0.9s linear infinite',
        }}/>
      </div>
    );
  }
  if (tone === 'success') {
    return (
      <div style={{
        width:80, height:80, borderRadius:'50%', background:BU.successBg,
        display:'flex', alignItems:'center', justifyContent:'center', color:BU.success,
        marginBottom:24, boxShadow:`0 0 0 8px ${VE.okRing}`,
      }}>
        <i data-lucide="check" style={{width:38, height:38, strokeWidth:3}}/>
      </div>
    );
  }
  // expired
  return (
    <div style={{
      width:80, height:80, borderRadius:'50%', background:VE.amberBg,
      display:'flex', alignItems:'center', justifyContent:'center', color:VE.amber,
      marginBottom:24, boxShadow:`0 0 0 8px ${VE.amberRing}`,
    }}>
      <i data-lucide="link-2-off" style={{width:34, height:34, strokeWidth:2}}/>
    </div>
  );
}

// ── status pill ──────────────────────────────────────────────────
function Pill({ tone, label }) {
  const map = {
    verifying: { bg:BU.sunken, fg:BU.fg2, icon:'ring' },
    success:   { bg:BU.successBg, fg:'#065f46', icon:'check' },
    expired:   { bg:VE.amberBg, fg:VE.amber, icon:'clock' },
  };
  const m = map[tone];
  return (
    <div style={{
      display:'inline-flex', alignItems:'center', gap:7,
      padding:'6px 12px 6px 10px', borderRadius:9999,
      background:m.bg, color:m.fg, fontSize:12, fontWeight:600, letterSpacing:-0.02,
    }}>
      {m.icon === 'ring'
        ? <Ring size={13} w={2} track="rgba(55,65,81,0.18)" head={BU.fg2}/>
        : <i data-lucide={m.icon} style={{width:13, height:13, strokeWidth:2.6}}/>}
      {label}
    </div>
  );
}

// ── primary 48px CTA ─────────────────────────────────────────────
function PrimaryCTA({ label, icon }) {
  return (
    <button style={{
      width:'100%', height:48, border:'none', borderRadius:12, cursor:'pointer',
      background:BU.primary600, color:'#fff', fontSize:15, fontWeight:700, letterSpacing:-0.1,
      display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:VE.halo,
    }}>
      {label}
      {icon && <i data-lucide={icon} style={{width:17, height:17, strokeWidth:2.6}}/>}
    </button>
  );
}
function GhostCTA({ label, icon }) {
  return (
    <button style={{
      width:'100%', height:46, borderRadius:12, cursor:'pointer',
      background:'transparent', border:`1px solid ${BU.border}`, color:BU.fg2,
      fontSize:14, fontWeight:600, letterSpacing:-0.05,
      display:'flex', alignItems:'center', justifyContent:'center', gap:7, marginTop:10,
    }}>
      {icon && <i data-lucide={icon} style={{width:16, height:16, strokeWidth:2}}/>}
      {label}
    </button>
  );
}

// ── trust footer ─────────────────────────────────────────────────
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

// ── status screen scaffold ───────────────────────────────────────
function StatusScreen({ tone, headline, body, pill, children, footer = true }) {
  return (
    <BPhone>
      <div style={{flex:1, display:'flex', flexDirection:'column', overflow:'hidden'}}>
        <div style={{
          flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          textAlign:'center', padding:'12px 30px 4px', minHeight:0,
        }}>
          <Halo tone={tone}/>
          <h1 style={{margin:0, fontSize:24, fontWeight:700, color:BU.fg1, letterSpacing:-0.5, lineHeight:1.15}}>
            {headline}
          </h1>
          <p style={{margin:'10px auto 0', fontSize:13.5, color:BU.fg3, lineHeight:'20px', letterSpacing:-0.05, maxWidth:268}}>
            {body}
          </p>
          {pill && <div style={{marginTop:18}}>{pill}</div>}
          {children && <div style={{width:'100%', marginTop:26}}>{children}</div>}
        </div>
        {footer && <TrustFooter/>}
      </div>
    </BPhone>
  );
}

const EMAIL = 'jordan@hey.com';
const Bold = ({ children }) => <strong style={{color:BU.fg1, fontWeight:700}}>{children}</strong>;

// ════════════════════════════════════════════════════════════════
//  STATE 1 — VERIFYING (loading)
// ════════════════════════════════════════════════════════════════
function FrameVerifyEmailVerifying() {
  return (
    <StatusScreen
      tone="verifying"
      headline="Verifying your email…"
      body={<>Hold on while we confirm the link for <Bold>{EMAIL}</Bold>.</>}
      pill={<Pill tone="verifying" label="Checking your link…"/>}
    >
      <p style={{margin:0, fontSize:11.5, color:BU.fg4, letterSpacing:-0.02}}>
        This only takes a moment.
      </p>
    </StatusScreen>
  );
}

// ════════════════════════════════════════════════════════════════
//  STATE 2 — VERIFIED (success)
// ════════════════════════════════════════════════════════════════
function FrameVerifyEmailSuccess() {
  return (
    <StatusScreen
      tone="success"
      headline="Email verified"
      body={<><Bold>{EMAIL}</Bold> is confirmed. Your account is ready to go.</>}
      pill={<Pill tone="success" label="Verified · just now"/>}
    >
      <PrimaryCTA label="Continue" icon="arrow-right"/>
    </StatusScreen>
  );
}

// ════════════════════════════════════════════════════════════════
//  STATE 3 — EXPIRED (error)
// ════════════════════════════════════════════════════════════════
function FrameVerifyEmailExpired() {
  return (
    <StatusScreen
      tone="expired"
      headline="This link has expired"
      body={<>Verification links last 24 hours. We can send a fresh one to <Bold>{EMAIL}</Bold>.</>}
      pill={<Pill tone="expired" label="Link expired"/>}
    >
      <PrimaryCTA label="Resend verification" icon="refresh-cw"/>
      <GhostCTA label="Use a different email" icon="pencil"/>
    </StatusScreen>
  );
}

Object.assign(window, {
  FrameVerifyEmailVerifying, FrameVerifyEmailSuccess, FrameVerifyEmailExpired,
});
