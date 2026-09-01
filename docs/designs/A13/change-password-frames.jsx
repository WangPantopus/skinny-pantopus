// Pantopus — A13.14 · Change password
// File: src/app/settings/password.tsx
//
// Simple variant of the Form archetype. Three masked fields + a live strength
// meter + a primary "Update password" button. Save lives in the body (large
// solid button at the end of the scroll) rather than the top bar — the form
// is short, every field is required, and the act of pressing Update is the
// reason the user opened this screen.
//
// Two frames:
//   FrameChangePasswordReady — fields filled, new password is strong,
//       confirm matches, button is enabled.
//   FrameChangePasswordError — submission attempted · server rejected the
//       current password AND the new password is weak (breached-list hit) ·
//       inline errors per field, strength meter at "Weak", button disabled
//       with a summary banner pinned to the top of the form.

const {
  F, Phone, TopBar, OverlineLabel, FieldLabel, Section, ScrollArea,
} = window;

// ─── Local atoms ──────────────────────────────────────────────

// Password field — masked dots, reveal toggle, optional left status icon
// for the "current" field after server validation.
function PasswordField({
  value, placeholder, state = 'default', revealed = false,
  error, helper, leftIcon, required,
}) {
  const borderColor =
    state === 'error' ? F.error600 :
    state === 'valid' ? F.success600 :
    state === 'focus' ? F.primary600 :
                        F.border;
  const borderWidth = state === 'default' ? 1 : 1.5;
  const ring =
    state === 'focus' ? '0 0 0 3px rgba(2,132,199,0.15)' :
    state === 'error' ? '0 0 0 3px rgba(220,38,38,0.10)' :
    state === 'valid' ? '0 0 0 3px rgba(5,150,105,0.08)' : 'none';

  // mask the chars as a row of fat dots so it reads as a password; if revealed,
  // show the literal value in mono.
  const masked = value ? '•'.repeat(value.length) : '';

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        height: 46, padding: '0 12px',
        background: F.surface, border: `${borderWidth}px solid ${borderColor}`,
        borderRadius: 10, boxShadow: ring, transition: 'all 120ms',
      }}>
        {leftIcon && (
          <i data-lucide={leftIcon}
            style={{ width: 16, height: 16, color: state === 'error' ? F.error600 : F.fg3, flexShrink: 0 }} />
        )}
        <span style={{
          flex: 1, fontSize: revealed ? 13.5 : 16,
          color: value ? F.fg1 : F.fg4,
          letterSpacing: revealed ? 0 : 2,
          fontFamily: revealed ? 'ui-monospace, Menlo, monospace' : 'inherit',
          fontWeight: value ? 600 : 400,
          lineHeight: '24px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{value ? (revealed ? value : masked) : placeholder}</span>
        {state === 'valid' && (
          <i data-lucide="check-circle-2" style={{ width: 18, height: 18, color: F.success600, flexShrink: 0 }} />
        )}
        {state === 'error' && (
          <i data-lucide="alert-circle" style={{ width: 18, height: 18, color: F.error600, flexShrink: 0 }} />
        )}
        <button style={{
          width: 32, height: 32, borderRadius: 6,
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: F.fg3, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, padding: 0,
        }}>
          <i data-lucide={revealed ? 'eye-off' : 'eye'} style={{ width: 17, height: 17 }} />
        </button>
      </div>
      {error && (
        <div style={{
          fontSize: 11.5, color: F.error, marginTop: 6,
          display: 'flex', alignItems: 'flex-start', gap: 5, lineHeight: '15px',
        }}>
          <i data-lucide="alert-circle" style={{ width: 12, height: 12, marginTop: 1, flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}
      {!error && helper && (
        <div style={{ fontSize: 11.5, color: F.fg3, marginTop: 6, lineHeight: '15px' }}>
          {helper}
        </div>
      )}
    </div>
  );
}

// Strength meter — 4 segments + label, with per-rule checklist below
function StrengthMeter({ level, rules, breached }) {
  // level: 0..4
  const palette = [
    { tint: F.sunken, label: 'Add a password',  color: F.fg4 },
    { tint: '#fecaca', label: 'Weak',           color: '#b91c1c' },
    { tint: '#fed7aa', label: 'Fair',           color: '#c2410c' },
    { tint: '#bbf7d0', label: 'Good',           color: '#047857' },
    { tint: '#86efac', label: 'Strong',         color: '#047857' },
  ];
  const cur = palette[level] || palette[0];

  return (
    <div style={{
      padding: '12px 12px 10px',
      background: F.surface, border: `1px solid ${F.border}`, borderRadius: 10,
      marginTop: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{
          flex: 1, display: 'flex', gap: 4,
        }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              flex: 1, height: 6, borderRadius: 3,
              background: i < level ? palette[level].color : F.sunken,
              opacity: i < level ? 0.9 : 1,
              transition: 'background 150ms',
            }} />
          ))}
        </div>
        <div style={{
          fontSize: 11.5, fontWeight: 700, color: cur.color,
          letterSpacing: 0.2, textTransform: 'uppercase',
          minWidth: 50, textAlign: 'right',
        }}>{cur.label}</div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 12, rowGap: 4 }}>
        {rules.map((r, i) => (
          <div key={i} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 11, color: r.met ? F.success : F.fg3,
            fontWeight: r.met ? 600 : 500,
          }}>
            <i data-lucide={r.met ? 'check' : 'circle'}
               style={{ width: 11, height: 11, strokeWidth: r.met ? 3 : 2 }} />
            {r.label}
          </div>
        ))}
      </div>
      {breached && (
        <div style={{
          marginTop: 10, padding: '8px 10px', borderRadius: 8,
          background: F.errorBg, border: `1px solid ${F.errorLight}`,
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <i data-lucide="shield-alert" style={{ width: 14, height: 14, color: F.error600, marginTop: 1, flexShrink: 0 }} />
          <div style={{ fontSize: 11.5, color: F.error, lineHeight: '15px' }}>
            <span style={{ fontWeight: 700 }}>Seen in a breach.</span> This password appeared in a public leak — pick a different one.
          </div>
        </div>
      )}
    </div>
  );
}

// Inline form-level alert banner (used by the error frame)
function FormBanner({ tone = 'error', title, sub }) {
  const palette = tone === 'error'
    ? { bg: F.errorBg, border: F.errorLight, fg: F.error, icon: 'alert-octagon' }
    : { bg: F.primary50, border: '#bae6fd', fg: F.primary700, icon: 'info' };
  return (
    <div style={{
      padding: '11px 12px', borderRadius: 10,
      background: palette.bg, border: `1px solid ${palette.border}`,
      display: 'flex', alignItems: 'flex-start', gap: 10,
    }}>
      <i data-lucide={palette.icon} style={{ width: 16, height: 16, color: palette.fg, marginTop: 1, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: palette.fg, letterSpacing: -0.05 }}>{title}</div>
        {sub && <div style={{ fontSize: 11.5, color: palette.fg, opacity: 0.85, marginTop: 2, lineHeight: '16px' }}>{sub}</div>}
      </div>
    </div>
  );
}

// Primary button (Update password) — in-form, full-width
function UpdateButton({ disabled, loading }) {
  return (
    <button disabled={disabled} style={{
      width: '100%', height: 50, borderRadius: 12, border: 'none',
      background: disabled ? F.sunken : F.primary600,
      color: disabled ? F.fg4 : '#fff',
      fontSize: 15, fontWeight: 600, letterSpacing: -0.1,
      cursor: disabled ? 'not-allowed' : 'pointer',
      boxShadow: disabled ? 'none' : '0 6px 16px rgba(2,132,199,0.28)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
      transition: 'all 120ms',
    }}>
      {loading ? (
        <i data-lucide="loader-2" style={{ width: 16, height: 16 }} />
      ) : (
        <i data-lucide={disabled ? 'lock' : 'key-round'} style={{ width: 16, height: 16 }} />
      )}
      Update password
    </button>
  );
}

// Secondary affordance — Cancel link below the primary button
function CancelLink() {
  return (
    <button style={{
      width: '100%', height: 38, background: 'transparent', border: 'none',
      cursor: 'pointer', color: F.fg3, fontSize: 13, fontWeight: 600,
      letterSpacing: -0.05, marginTop: 2,
    }}>Cancel</button>
  );
}

// Sign-in context band — quiet identity reminder under the top bar
function ContextBand({ email, lastChanged }) {
  return (
    <div style={{
      padding: '10px 14px',
      background: F.muted,
      borderBottom: `1px solid ${F.border}`,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: 'linear-gradient(135deg,#0ea5e9,#0369a1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 700, fontSize: 11, letterSpacing: -0.3,
      }}>MK</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: F.fg2, fontWeight: 600, letterSpacing: -0.05, lineHeight: '15px' }}>
          Signed in as {email}
        </div>
        <div style={{ fontSize: 10.5, color: F.fg4, marginTop: 1 }}>
          Last changed {lastChanged}
        </div>
      </div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '3px 8px', borderRadius: 9999,
        background: F.successBg, border: '1px solid #a7f3d0',
        color: F.success, fontSize: 10, fontWeight: 700,
        letterSpacing: 0.2, textTransform: 'uppercase',
      }}>
        <i data-lucide="shield-check" style={{ width: 10, height: 10 }} />
        2FA on
      </div>
    </div>
  );
}

// ─── FRAME 1 · READY (valid, strong, ready to submit) ─────────

function FrameChangePasswordReady() {
  return (
    <Phone>
      <TopBar title="Change password" />
      <ContextBand email="maria@pantopus.app" lastChanged="84 days ago" />
      <ScrollArea bottomPad={28}>

        <Section overline="Verify it's you">
          <div>
            <FieldLabel required>Current password</FieldLabel>
            <PasswordField value="autumn-river-2019" state="valid" leftIcon="lock" />
          </div>
        </Section>

        <Section overline="Choose a new one">
          <div>
            <FieldLabel required>New password</FieldLabel>
            <PasswordField
              value="bake-sourdough-friday-77"
              state="valid"
              revealed
            />
            <StrengthMeter
              level={4}
              rules={[
                { label: '12+ characters', met: true },
                { label: 'Mixed case',     met: true },
                { label: 'Number',         met: true },
                { label: 'Symbol',         met: true },
              ]}
            />
          </div>
          <div>
            <FieldLabel required>Confirm new password</FieldLabel>
            <PasswordField
              value="bake-sourdough-friday-77"
              state="valid"
              helper="Matches new password."
            />
          </div>
        </Section>

        <div style={{ marginTop: 4 }}>
          <UpdateButton />
          <CancelLink />
        </div>

        <div style={{
          padding: '10px 12px', borderRadius: 10,
          background: F.primary50, border: '1px solid #bae6fd',
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <i data-lucide="info" style={{ width: 13, height: 13, color: F.primary600, marginTop: 1, flexShrink: 0 }} />
          <div style={{ fontSize: 11.5, color: F.primary700, lineHeight: '16px' }}>
            You'll be signed out of other devices after updating.
          </div>
        </div>

      </ScrollArea>
    </Phone>
  );
}

// ─── FRAME 2 · ERROR (submission rejected) ────────────────────

function FrameChangePasswordError() {
  return (
    <Phone>
      <TopBar title="Change password" />
      <ContextBand email="maria@pantopus.app" lastChanged="84 days ago" />
      <ScrollArea bottomPad={28}>

        <FormBanner
          tone="error"
          title="Couldn't update password"
          sub="Fix the two highlighted fields and try again. Three more attempts before a 15-minute cooldown."
        />

        <Section overline="Verify it's you">
          <div>
            <FieldLabel required>Current password</FieldLabel>
            <PasswordField
              value="autum-river-2018"
              state="error"
              leftIcon="lock"
              error="That doesn't match the password on file."
            />
            <button style={{
              marginTop: 6, padding: 0, background: 'transparent', border: 'none',
              cursor: 'pointer', color: F.primary600, fontSize: 12, fontWeight: 600,
              letterSpacing: -0.05, display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              <i data-lucide="mail" style={{ width: 12, height: 12 }} />
              Email me a reset link instead
            </button>
          </div>
        </Section>

        <Section overline="Choose a new one">
          <div>
            <FieldLabel required>New password</FieldLabel>
            <PasswordField
              value="password123"
              state="error"
              revealed
              error="Too common — appeared in 2.3M public records."
            />
            <StrengthMeter
              level={1}
              breached
              rules={[
                { label: '12+ characters', met: false },
                { label: 'Mixed case',     met: false },
                { label: 'Number',         met: true },
                { label: 'Symbol',         met: false },
              ]}
            />
          </div>
          <div>
            <FieldLabel required>Confirm new password</FieldLabel>
            <PasswordField
              value="password12"
              state="error"
              error="Doesn't match the new password above."
            />
          </div>
        </Section>

        <div style={{ marginTop: 4 }}>
          <UpdateButton disabled />
          <CancelLink />
        </div>

      </ScrollArea>
    </Phone>
  );
}

Object.assign(window, { FrameChangePasswordReady, FrameChangePasswordError });
