// Pantopus — A12.5 · src/app/homes/[id]/verify-landlord/index.tsx
// Wizard step 1 (start) — "Verify landlord — Start"
// Two frames: canonical start (full doc-upload path) + fast-track (landlord already verified).

const V = {
  primary50:  '#f0f9ff',
  primary100: '#e0f2fe',
  primary200: '#bae6fd',
  primary500: '#0ea5e9',
  primary600: '#0284c7',
  primary700: '#0369a1',
  bg:      '#f6f7f9',
  surface: '#ffffff',
  sunken:  '#f3f4f6',
  border:  '#e5e7eb',
  borderStrong: '#d1d5db',
  fg1: '#111827',
  fg2: '#374151',
  fg3: '#6b7280',
  fg4: '#9ca3af',
  success50:  '#ecfdf5',
  success100: '#d1fae5',
  success600: '#059669',
  success700: '#047857',
  warning50:  '#fffbeb',
  warning100: '#fef3c7',
  warning600: '#d97706',
  warning700: '#b45309',
  homeBg:     '#dcfce7',
  home:       '#16a34a',
  home700:    '#15803d',
  business:   '#7c3aed',
  businessBg: '#f3e8ff',
};

// ─── Phone shell ──────────────────────────────────────────────

function VSB() {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '16px 28px 0', height: 44, boxSizing: 'border-box',
      fontFamily: '-apple-system, system-ui', fontWeight: 600, fontSize: 15, color: V.fg1,
    }}>
      <span>9:41</span>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={V.fg1}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={V.fg1}/><rect x="9" y="2" width="3" height="9" rx="0.6" fill={V.fg1}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={V.fg1}/></svg>
        <svg width="15" height="11" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={V.fg1}/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={V.fg1}/><circle cx="7.5" cy="9" r="1.3" fill={V.fg1}/></svg>
        <svg width="24" height="11" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={V.fg1} strokeOpacity="0.35" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill={V.fg1}/><path d="M22.5 3.8v3.4c.6-.2 1-.8 1-1.7s-.4-1.5-1-1.7z" fill={V.fg1} fillOpacity="0.4"/></svg>
      </div>
    </div>
  );
}

function VPhone({ children, label }) {
  return (
    <div style={{
      width: 360, height: 740, borderRadius: 46, padding: 10,
      background: '#0b0f17',
      boxShadow: '0 40px 80px rgba(17,24,39,0.22), 0 0 0 1px rgba(0,0,0,0.14)',
    }} data-screen-label={label}>
      <div style={{
        width: '100%', height: '100%', background: V.bg,
        borderRadius: 36, overflow: 'hidden', position: 'relative',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          position: 'absolute', top: 9, left: '50%', transform: 'translateX(-50%)',
          width: 108, height: 30, borderRadius: 20, background: '#000', zIndex: 50,
        }} />
        <VSB />
        {children}
        <div style={{
          position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)',
          width: 120, height: 4, borderRadius: 4, background: 'rgba(0,0,0,0.25)',
          zIndex: 60,
        }} />
      </div>
    </div>
  );
}

function VWizardHeader({ title, step, total }) {
  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', padding: '8px 8px',
        height: 48, boxSizing: 'border-box', background: V.surface, flexShrink: 0,
      }}>
        <button style={{
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer', color: V.fg1, padding: 0,
          borderRadius: 8,
        }}>
          <i data-lucide="x" style={{ width: 22, height: 22 }} />
        </button>
        <div style={{
          flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600,
          color: V.fg1, letterSpacing: -0.15,
        }}>{title}</div>
        <div style={{
          minWidth: 52, padding: '0 12px', fontSize: 12, fontWeight: 500,
          color: V.fg3, textAlign: 'right', letterSpacing: -0.05,
        }}>{step} of {total}</div>
      </div>
      <div style={{
        display: 'flex', gap: 4, padding: '0 16px 8px',
        background: V.surface, borderBottom: `1px solid ${V.border}`,
      }}>
        {Array.from({ length: total }, (_, i) => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 3,
            background: i < step ? V.primary600 : V.border,
          }} />
        ))}
      </div>
    </>
  );
}

function VScrollArea({ children, bottomPad = 112 }) {
  return (
    <div style={{
      flex: 1, overflow: 'auto',
      padding: `20px 16px ${bottomPad}px`,
      display: 'flex', flexDirection: 'column', gap: 18,
    }}>{children}</div>
  );
}

function VStickyBottom({ children }) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'rgba(255,255,255,0.96)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      borderTop: `1px solid ${V.border}`,
      padding: '12px 16px 28px', zIndex: 10,
      display: 'flex', gap: 10, alignItems: 'center',
    }}>{children}</div>
  );
}

function VPrimaryBtn({ children, icon, disabled, full }) {
  return (
    <button disabled={disabled} style={{
      width: full ? '100%' : undefined,
      height: 48, borderRadius: 12, border: 'none',
      background: disabled ? V.sunken : V.primary600,
      color: disabled ? V.fg4 : '#fff',
      fontSize: 14, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
      boxShadow: disabled ? 'none' : '0 6px 16px rgba(2,132,199,0.28)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      letterSpacing: -0.1, padding: '0 20px',
    }}>
      {children}
      {icon && <i data-lucide={icon} style={{ width: 16, height: 16 }} />}
    </button>
  );
}

function VOverline({ children, style = {} }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: V.fg3, marginBottom: 10, ...style,
    }}>{children}</div>
  );
}

function VHomeChip() {
  return (
    <div style={{
      display: 'inline-flex', padding: '4px 10px', borderRadius: 9999,
      background: V.homeBg, color: V.home, fontSize: 10.5, fontWeight: 700,
      letterSpacing: 0.06, textTransform: 'uppercase', alignSelf: 'flex-start',
      alignItems: 'center', gap: 4,
    }}>
      <i data-lucide="home" style={{ width: 11, height: 11 }} />
      Renting · 412 Elm St, Apt 3B
    </div>
  );
}

function VRequirementsCard({ items }) {
  return (
    <div style={{
      background: V.surface, border: `1px solid ${V.border}`, borderRadius: 16,
      padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <VOverline style={{ marginBottom: 10 }}>What you'll need</VOverline>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
              background: V.homeBg, color: V.home,
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
            }}>
              <i data-lucide={r.icon || 'check'} style={{ width: 13, height: 13, strokeWidth: 3 }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: V.fg1, letterSpacing: -0.1 }}>{r.title}</div>
              <div style={{ fontSize: 11.5, color: V.fg3, marginTop: 2, lineHeight: '16px' }}>{r.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VWhyWeAskRow() {
  return (
    <button style={{
      background: V.primary50, border: `1px solid ${V.primary100}`, borderRadius: 12,
      padding: '12px 14px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8, background: V.surface,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: V.primary600, flexShrink: 0,
      }}>
        <i data-lucide="shield-check" style={{ width: 15, height: 15, strokeWidth: 2.2 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: V.primary700, letterSpacing: -0.1 }}>Why verify your landlord?</div>
        <div style={{ fontSize: 11.5, color: V.fg3, marginTop: 2 }}>Verified rentals get safer payouts and dispute support.</div>
      </div>
      <i data-lucide="chevron-right" style={{ width: 16, height: 16, color: V.primary600, flexShrink: 0 }} />
    </button>
  );
}

// ─── FRAME 1 · POPULATED (canonical start) ────────────────────

function FrameVerifyLandlordStart() {
  const reqs = [
    { title: 'A signed lease agreement',     sub: 'PDF, photo, or scan. Current term only — older leases are fine if still active.' },
    { title: 'Landlord contact info',        sub: 'Their name, email, and phone. We send a one-time confirmation link to them.' },
    { title: 'A few minutes',                sub: 'Most verifications take 3–4 min on your side. Landlord confirms in their inbox.' },
  ];
  return (
    <VPhone label="A12.5 Verify landlord — start (full path)">
      <VWizardHeader title="Verify landlord" step={1} total={3} />
      <VScrollArea>
        <VHomeChip />

        <div>
          <h2 style={{
            margin: 0, fontSize: 22, fontWeight: 700, color: V.fg1,
            letterSpacing: -0.3, lineHeight: '28px',
          }}>Confirm who you rent from</h2>
          <p style={{
            margin: '8px 0 0', fontSize: 14, color: V.fg3, lineHeight: '20px',
          }}>
            Verifying your landlord links this rental to a real owner so you can send
            rent, raise maintenance tickets, and resolve disputes inside Pantopus.
            We'll ask them to confirm by email — they don't need an account.
          </p>
        </div>

        <VRequirementsCard items={reqs} />
        <VWhyWeAskRow />
      </VScrollArea>

      <VStickyBottom>
        <VPrimaryBtn icon="arrow-right" full>Start verification</VPrimaryBtn>
      </VStickyBottom>
    </VPhone>
  );
}

// ─── FRAME 2 · SECONDARY (fast-track: landlord already verified) ──

function FrameVerifyLandlordFastTrack() {
  const reqs = [
    { title: 'A signed lease — just one page', sub: 'Any page showing your name and unit number. We only need it to match you to the existing rental.' },
    { title: 'Confirm your move-in date',      sub: "We'll prefill what your landlord already submitted — you just confirm." },
    { title: 'About a minute',                 sub: 'No email to the landlord this time — they\'ve already verified.' },
  ];
  return (
    <VPhone label="A12.5 Verify landlord — start (fast-track)">
      <VWizardHeader title="Verify landlord" step={1} total={3} />
      <VScrollArea>
        <VHomeChip />

        {/* Fast-track notice */}
        <div style={{
          background: V.success50,
          border: `1px solid ${V.success100}`,
          borderRadius: 14, padding: 14,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', background: V.success600,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', flexShrink: 0,
            }}>
              <i data-lucide="badge-check" style={{ width: 16, height: 16, strokeWidth: 2.2 }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13.5, fontWeight: 700, color: V.success700,
                letterSpacing: -0.15,
              }}>Landlord already verified for this building</div>
              <div style={{
                fontSize: 12, color: V.success700, marginTop: 4, lineHeight: '17px',
                opacity: 0.9,
              }}>
                <b>2 other tenants</b> in this building have completed verification with the same landlord, so we can fast-track yours.
              </div>
            </div>
          </div>

          {/* Existing landlord chip */}
          <div style={{
            background: V.surface, borderRadius: 10, padding: '8px 10px',
            border: `1px solid ${V.success100}`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: V.businessBg, color: V.business,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <i data-lucide="building-2" style={{ width: 15, height: 15, strokeWidth: 2 }} />
            </div>
            <div style={{ flex: 1, minWidth: 0, lineHeight: '16px' }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: V.fg1, letterSpacing: -0.1 }}>
                Elm Street Holdings LLC
              </div>
              <div style={{ fontSize: 11, color: V.fg3, marginTop: 1 }}>
                Verified May 2025 · M. Patel, owner
              </div>
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '3px 7px', borderRadius: 9999,
              background: V.success50, color: V.success700,
              fontSize: 9.5, fontWeight: 700, letterSpacing: 0.06,
              textTransform: 'uppercase', flexShrink: 0,
            }}>
              <i data-lucide="check" style={{ width: 9, height: 9, strokeWidth: 3 }} />
              Verified
            </div>
          </div>
        </div>

        <div>
          <h2 style={{
            margin: 0, fontSize: 20, fontWeight: 700, color: V.fg1,
            letterSpacing: -0.3, lineHeight: '26px',
          }}>Join as a verified tenant</h2>
          <p style={{
            margin: '6px 0 0', fontSize: 13.5, color: V.fg3, lineHeight: '19px',
          }}>
            Shorter process — we just need to confirm you're really on the lease for
            <b style={{ color: V.fg1, fontWeight: 600 }}> Apt 3B</b>. No email to your landlord required.
          </p>
        </div>

        <VRequirementsCard items={reqs} />
        <VWhyWeAskRow />
      </VScrollArea>

      <VStickyBottom>
        <VPrimaryBtn icon="arrow-right" full>Start verification</VPrimaryBtn>
      </VStickyBottom>
    </VPhone>
  );
}

Object.assign(window, { FrameVerifyLandlordStart, FrameVerifyLandlordFastTrack });
