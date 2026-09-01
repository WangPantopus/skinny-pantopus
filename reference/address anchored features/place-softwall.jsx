// ─────────────────────────────────────────────────────────────
// Place — A5 · Soft wall ("Save this place")
// A sheet over the public preview, shown when a signed-out user
// acts to save their one-time look. Recap chips → copy → form
// (email + Create account, then Apple / Google) → Sign in link.
// Reuses place-components atoms (Icon, Chip, colors) + the input
// and primary-button recipes. Home-green address, sky CTA.
// ─────────────────────────────────────────────────────────────

// ── Brand auth marks (Apple silhouette, Google G) ──────────────
function AppleMark({ color = '#fff', size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', marginTop: -2 }} aria-hidden="true">
      <path fill={color} d="M16.365 1.43c0 1.14-.49 2.27-1.18 3.08-.74.9-1.99 1.57-2.99 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.57-2.27 1.21-2.98.8-.94 2.14-1.64 3.25-1.68.03.13.05.28.05.43zm4.57 15.71c-.03.07-.46 1.58-1.52 3.12-.95 1.34-1.94 2.69-3.43 2.71-1.52.03-2.01-.88-3.71-.88-1.71 0-2.25.85-3.69.91-1.49.06-2.61-1.45-3.59-2.79-1.99-2.74-3.51-7.76-1.47-11.14 1.01-1.68 2.83-2.75 4.8-2.78 1.45-.03 2.83.98 3.72.98.88 0 2.56-1.21 4.32-1.03.73.03 2.79.3 4.11 2.22-.11.07-2.45 1.43-2.42 4.27.03 3.39 2.97 4.52 3 4.53z" />
    </svg>
  );
}
function GoogleMark({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }} aria-hidden="true">
      <path fill="#4285F4" d="M23.06 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h6.2a5.3 5.3 0 0 1-2.3 3.48v2.89h3.72c2.18-2 3.44-4.96 3.44-8.38z" />
      <path fill="#34A853" d="M12 24c3.11 0 5.72-1.03 7.62-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.54-2.03-6.45-4.75H1.7v2.98A11.5 11.5 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.55 14.67a6.9 6.9 0 0 1 0-4.42V7.27H1.7a11.5 11.5 0 0 0 0 10.38l3.85-2.98z" />
      <path fill="#EA4335" d="M12 5.38c1.69 0 3.21.58 4.4 1.72l3.3-3.3C17.72 1.99 15.11.96 12 .96A11.5 11.5 0 0 0 1.7 7.27l3.85 2.98C6.46 7.41 9 5.38 12 5.38z" />
    </svg>
  );
}

// ── Social auth button (apple | google) ────────────────────────
function SocialButton({ provider = 'apple', short = false }) {
  const apple = provider === 'apple';
  return (
    <button className={`sw-social ${apple ? 'apple' : 'google'}`} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
      width: '100%', height: 50, borderRadius: 13, cursor: 'pointer', fontFamily: 'inherit',
      fontSize: 15.5, fontWeight: 600, letterSpacing: '-0.01em',
      background: apple ? '#111827' : '#fff',
      color: apple ? '#fff' : INK,
      border: apple ? '1px solid #111827' : `1px solid ${BORDER}`,
      boxShadow: apple ? '0 1px 2px rgba(0,0,0,0.16)' : '0 1px 2px rgba(0,0,0,0.04)',
    }}>
      {apple ? <AppleMark /> : <GoogleMark />}
      {short ? (apple ? 'Apple' : 'Google') : `Continue with ${apple ? 'Apple' : 'Google'}`}
    </button>
  );
}

// ── Email input (the input recipe, mail adornment) ─────────────
function EmailInput({ value = '', focused = false }) {
  const active = focused;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, height: 52, padding: '0 14px',
      background: '#fff', borderRadius: 13,
      border: `1.5px solid ${active ? SKY : BORDER}`,
      boxShadow: active ? '0 0 0 4px rgba(2,132,199,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <Icon name="mail" size={18} color={active ? SKY : FAINT} strokeWidth={2} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: value ? 500 : 400, color: value ? INK : FAINT, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-flex', alignItems: 'center' }}>
        {value || 'you@email.com'}
        {focused && <span className="lx-caret" style={{ display: 'inline-block', width: 2, height: 20, background: SKY, marginLeft: 1, borderRadius: 1 }} />}
      </span>
    </div>
  );
}

// ── Primary CTA — "Create account" (sky) ───────────────────────
function SheetPrimary({ label = 'Create account' }) {
  return (
    <button className="sw-primary" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
      width: '100%', height: 52, background: SKY, color: '#fff', border: 'none', borderRadius: 13,
      fontFamily: 'inherit', fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', cursor: 'pointer',
      boxShadow: '0 6px 16px rgba(2,132,199,0.20)',
    }}>
      {label}
      <Icon name="arrow-right" size={17} color="#fff" strokeWidth={2.5} />
    </button>
  );
}

// ── "or" divider ───────────────────────────────────────────────
function OrDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '1px 0' }}>
      <div style={{ flex: 1, height: 1, background: '#ececef' }} />
      <span style={{ fontSize: 12, fontWeight: 600, color: FAINT, letterSpacing: '0.02em' }}>or</span>
      <div style={{ flex: 1, height: 1, background: '#ececef' }} />
    </div>
  );
}

// ── Recap chips — what the one-time look just showed ───────────
function RecapChips({ block = 'warm' }) {
  const nearby = block === 'cold'
    ? { tone: 'neutral', icon: 'sparkles', text: 'Be the first nearby' }
    : { tone: 'success', icon: 'users', text: 'A few verified nearby' };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
      <Chip tone="sky" icon="waves">Flood zone</Chip>
      <Chip tone={nearby.tone} icon={nearby.icon}>{nearby.text}</Chip>
      <Chip tone="neutral" icon="house">Area facts</Chip>
    </div>
  );
}

// ── Sign-in text link ──────────────────────────────────────────
function SignInLink() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, paddingTop: 2 }}>
      <span style={{ fontSize: 13.5, color: MUTE, letterSpacing: '-0.005em' }}>Already have an account?</span>
      <button className="pl-textbtn" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: SKY, fontWeight: 600, fontSize: 13.5, fontFamily: 'inherit' }}>Sign in</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SoftWallSheet — the sheet body
//   compact=true → keyboard is up; tighten and collapse socials
// ─────────────────────────────────────────────────────────────
function SoftWallSheet({ block = 'warm', compact = false, emailValue = '', emailFocused = false, address = '1421 SE Oak St, Portland' }) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 46,
      background: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22,
      boxShadow: '0 -10px 44px rgba(17,24,39,0.20)',
      padding: compact ? '8px 20px 14px' : '8px 20px 30px',
    }}>
      {/* grabber */}
      <div style={{ width: 40, height: 5, borderRadius: 9999, background: '#d8dce1', margin: '0 auto 12px' }} />

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: compact ? 12 : 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: HOME_GREEN_BG, border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="map-pinned" size={19} color={HOME_GREEN} strokeWidth={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17.5, fontWeight: 700, color: INK, letterSpacing: '-0.02em', lineHeight: '22px' }}>Save this place</div>
          <div style={{ fontSize: 13, color: MUTE, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{address}</div>
        </div>
        <button className="sw-x" style={{ width: 30, height: 30, borderRadius: 9999, background: '#f1f3f5', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <Icon name="x" size={16} color={MUTE} strokeWidth={2.5} />
        </button>
      </div>

      {/* recap + copy (hidden when keyboard collapses the sheet) */}
      {!compact && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: FAINT, marginBottom: 9 }}>From your one-time look</div>
          <RecapChips block={block} />
          <p style={{ margin: '13px 0 0', fontSize: 14, color: INK2, lineHeight: '20px', letterSpacing: '-0.005em' }}>
            Create a free account to save this place, get daily updates, and see your home's exact details and value.
          </p>
        </div>
      )}

      {/* form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <EmailInput value={emailValue} focused={emailFocused} />
        <SheetPrimary />
        <OrDivider />
        {compact ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <SocialButton provider="apple" short />
            <SocialButton provider="google" short />
          </div>
        ) : (
          <React.Fragment>
            <SocialButton provider="apple" />
            <SocialButton provider="google" />
          </React.Fragment>
        )}
        <SignInLink />
      </div>

      {/* trust line */}
      {!compact && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14 }}>
          <Icon name="lock" size={13} color={FAINT} strokeWidth={2} />
          <span style={{ fontSize: 12.5, color: MUTE, letterSpacing: '-0.005em' }}>Private by default. We never post without you.</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SoftWall — assembled screen: the preview, dimmed, with the sheet
// ─────────────────────────────────────────────────────────────
function SoftWall({ block = 'warm', compact = false, emailValue = '', emailFocused = false }) {
  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
      {/* the public preview, behind */}
      <PlacePreview block={block} />
      {/* scrim — starts below the status bar so the clock stays legible */}
      <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 0, background: 'rgba(17,24,39,0.42)', zIndex: 45 }} />
      {/* the sheet */}
      <SoftWallSheet block={block} compact={compact} emailValue={emailValue} emailFocused={emailFocused} />
    </div>
  );
}

Object.assign(window, {
  SoftWall, SoftWallSheet, RecapChips, EmailInput, SheetPrimary, OrDivider,
  SocialButton, SignInLink, AppleMark, GoogleMark,
});
