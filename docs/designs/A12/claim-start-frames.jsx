// Pantopus — A12.3 · src/app/homes/[id]/claim-owner/index.tsx
// Wizard step 1 (start) — "Claim ownership — Start"
// Two frames: canonical start (matches archetype) + contested-claim notice.

const W = {
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
  success50: '#ecfdf5',
  success100: '#d1fae5',
  success600:'#059669',
  success700:'#047857',
  warning50: '#fffbeb',
  warning100:'#fef3c7',
  warning600:'#d97706',
  warning700:'#b45309',
  warning:   '#92400e',
  warningBg: '#fef3c7',
  error50:   '#fef2f2',
  error600:  '#dc2626',
  errorBg:   '#fee2e2',
  homeBg:    '#dcfce7',
  home:      '#16a34a',
  home700:   '#15803d',
};

// ─── Phone shell ──────────────────────────────────────────────

function SB() {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '16px 28px 0', height: 44, boxSizing: 'border-box',
      fontFamily: '-apple-system, system-ui', fontWeight: 600, fontSize: 15, color: W.fg1,
    }}>
      <span>9:41</span>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={W.fg1}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={W.fg1}/><rect x="9" y="2" width="3" height="9" rx="0.6" fill={W.fg1}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={W.fg1}/></svg>
        <svg width="15" height="11" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={W.fg1}/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={W.fg1}/><circle cx="7.5" cy="9" r="1.3" fill={W.fg1}/></svg>
        <svg width="24" height="11" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={W.fg1} strokeOpacity="0.35" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill={W.fg1}/><path d="M22.5 3.8v3.4c.6-.2 1-.8 1-1.7s-.4-1.5-1-1.7z" fill={W.fg1} fillOpacity="0.4"/></svg>
      </div>
    </div>
  );
}

function Phone({ children, label }) {
  return (
    <div style={{
      width: 360, height: 740, borderRadius: 46, padding: 10,
      background: '#0b0f17',
      boxShadow: '0 40px 80px rgba(17,24,39,0.22), 0 0 0 1px rgba(0,0,0,0.14)',
    }} data-screen-label={label}>
      <div style={{
        width: '100%', height: '100%', background: W.bg,
        borderRadius: 36, overflow: 'hidden', position: 'relative',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          position: 'absolute', top: 9, left: '50%', transform: 'translateX(-50%)',
          width: 108, height: 30, borderRadius: 20, background: '#000', zIndex: 50,
        }} />
        <SB />
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

function WizardHeader({ title, step, total }) {
  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', padding: '8px 8px',
        height: 48, boxSizing: 'border-box', background: W.surface, flexShrink: 0,
      }}>
        <button style={{
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer', color: W.fg1, padding: 0,
          borderRadius: 8,
        }}>
          <i data-lucide="x" style={{ width: 22, height: 22 }} />
        </button>
        <div style={{
          flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600,
          color: W.fg1, letterSpacing: -0.15,
        }}>{title}</div>
        <div style={{
          minWidth: 52, padding: '0 12px', fontSize: 12, fontWeight: 500,
          color: W.fg3, textAlign: 'right', letterSpacing: -0.05,
        }}>{step && total ? `${step} of ${total}` : ''}</div>
      </div>
      {step && total && (
        <div style={{
          display: 'flex', gap: 4, padding: '0 16px 8px',
          background: W.surface, borderBottom: `1px solid ${W.border}`,
        }}>
          {Array.from({ length: total }, (_, i) => (
            <div key={i} style={{
              flex: 1, height: 4, borderRadius: 3,
              background: i < step ? W.primary600 : W.border,
            }} />
          ))}
        </div>
      )}
    </>
  );
}

function ScrollArea({ children, bottomPad = 108 }) {
  return (
    <div style={{
      flex: 1, overflow: 'auto',
      padding: `20px 16px ${bottomPad}px`,
      display: 'flex', flexDirection: 'column', gap: 18,
    }}>{children}</div>
  );
}

function StickyBottom({ children }) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'rgba(255,255,255,0.96)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      borderTop: `1px solid ${W.border}`,
      padding: '12px 16px 28px', zIndex: 10,
      display: 'flex', gap: 10, alignItems: 'center',
    }}>{children}</div>
  );
}

function PrimaryBtn({ children, icon, disabled, flex = 1, full }) {
  return (
    <button disabled={disabled} style={{
      flex, width: full ? '100%' : undefined,
      height: 48, borderRadius: 12, border: 'none',
      background: disabled ? W.sunken : W.primary600,
      color: disabled ? W.fg4 : '#fff',
      fontSize: 14, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
      boxShadow: disabled ? 'none' : '0 6px 16px rgba(2,132,199,0.28)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      letterSpacing: -0.1,
    }}>
      {children}
      {icon && <i data-lucide={icon} style={{ width: 16, height: 16 }} />}
    </button>
  );
}

function OverlineLabel({ children, style = {} }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: W.fg3, marginBottom: 10, ...style,
    }}>{children}</div>
  );
}

function HomeChip() {
  return (
    <div style={{
      display: 'inline-flex', padding: '4px 10px', borderRadius: 9999,
      background: W.homeBg, color: W.home, fontSize: 10.5, fontWeight: 700,
      letterSpacing: 0.06, textTransform: 'uppercase', alignSelf: 'flex-start',
      alignItems: 'center', gap: 4,
    }}>
      <i data-lucide="home" style={{ width: 11, height: 11 }} />
      Home · 412 Elm St
    </div>
  );
}

function RequirementsCard() {
  const reqs = [
    { title: 'Proof of ownership doc',     sub: 'Deed, mortgage statement, or property tax bill.' },
    { title: 'Address matching your account', sub: "412 Elm St, Apt 3B — same as what's verified on your profile." },
    { title: 'A few minutes',              sub: 'Most claims take 4–5 min end to end.' },
  ];
  return (
    <div style={{
      background: W.surface, border: `1px solid ${W.border}`, borderRadius: 16,
      padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <OverlineLabel style={{ marginBottom: 10 }}>What you'll need</OverlineLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {reqs.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
              background: W.homeBg, color: W.home,
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
            }}>
              <i data-lucide="check" style={{ width: 13, height: 13, strokeWidth: 3 }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: W.fg1, letterSpacing: -0.1 }}>{r.title}</div>
              <div style={{ fontSize: 11.5, color: W.fg3, marginTop: 2, lineHeight: '16px' }}>{r.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WhyWeAskRow() {
  return (
    <button style={{
      background: W.primary50, border: `1px solid ${W.primary100}`, borderRadius: 12,
      padding: '12px 14px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8, background: W.surface,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: W.primary600, flexShrink: 0,
      }}>
        <i data-lucide="shield-check" style={{ width: 15, height: 15, strokeWidth: 2.2 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: W.primary700, letterSpacing: -0.1 }}>Why we ask</div>
        <div style={{ fontSize: 11.5, color: W.fg3, marginTop: 2 }}>Address proof keeps Pantopus real-people only.</div>
      </div>
      <i data-lucide="chevron-right" style={{ width: 16, height: 16, color: W.primary600, flexShrink: 0 }} />
    </button>
  );
}

// ─── FRAME 1 · POPULATED (canonical start) ────────────────────

function FrameClaimStart() {
  return (
    <Phone label="A12.3 Claim ownership — start">
      <WizardHeader title="Claim ownership" step={1} total={3} />
      <ScrollArea>
        <HomeChip />

        <div>
          <h2 style={{
            margin: 0, fontSize: 22, fontWeight: 700, color: W.fg1,
            letterSpacing: -0.3, lineHeight: '28px',
          }}>Let's verify you own this home</h2>
          <p style={{
            margin: '8px 0 0', fontSize: 14, color: W.fg3, lineHeight: '20px',
          }}>
            Claiming ownership lets you invite residents, receive mail, post packages,
            and run the household's command center. Verification is a one-time step.
          </p>
        </div>

        <RequirementsCard />
        <WhyWeAskRow />
      </ScrollArea>

      <StickyBottom>
        <PrimaryBtn icon="arrow-right" full>Start claim</PrimaryBtn>
      </StickyBottom>
    </Phone>
  );
}

// ─── FRAME 2 · SECONDARY (contested claim) ────────────────────

function FrameClaimContested() {
  const reqs = [
    { title: 'Proof of ownership doc',     sub: 'Stronger docs (deed > tax bill) get prioritized in contested reviews.', emphasized: true },
    { title: 'Address matching your account', sub: '412 Elm St, Apt 3B — same as what\'s verified on your profile.' },
    { title: 'A statement (recommended)',  sub: 'Explain why your claim is the right one. Helps the reviewer.' },
  ];
  return (
    <Phone label="A12.3 Claim ownership — contested">
      <WizardHeader title="Claim ownership" step={1} total={3} />
      <ScrollArea>
        <HomeChip />

        {/* Contested-claim notice */}
        <div style={{
          background: W.warning50,
          border: `1px solid ${W.warning100}`,
          borderRadius: 14, padding: 14,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', background: W.warning600,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', flexShrink: 0,
            }}>
              <i data-lucide="users" style={{ width: 15, height: 15, strokeWidth: 2.2 }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13.5, fontWeight: 700, color: W.warning700,
                letterSpacing: -0.15,
              }}>Another claim is already in review</div>
              <div style={{
                fontSize: 12, color: W.warning, marginTop: 4, lineHeight: '17px',
              }}>
                A verified resident at this address filed an ownership claim <b>3 days ago</b>.
                You can still claim — both claims will be reviewed together, and the strongest wins.
              </div>
            </div>
          </div>

          {/* Existing claim chip */}
          <div style={{
            background: W.surface, borderRadius: 10, padding: '8px 10px',
            border: `1px solid ${W.warning100}`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'linear-gradient(135deg, #c4b5fd, #818cf8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0,
              letterSpacing: -0.2,
            }}>JR</div>
            <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: W.fg2, lineHeight: '16px' }}>
              <b style={{ fontWeight: 700, color: W.fg1 }}>J. R.</b>
              <span style={{ color: W.fg3 }}> · Filed Oct 9 · Under review</span>
            </div>
            <i data-lucide="lock" style={{ width: 13, height: 13, color: W.fg4 }} />
          </div>
        </div>

        <div>
          <h2 style={{
            margin: 0, fontSize: 20, fontWeight: 700, color: W.fg1,
            letterSpacing: -0.3, lineHeight: '26px',
          }}>File a competing claim</h2>
          <p style={{
            margin: '6px 0 0', fontSize: 13.5, color: W.fg3, lineHeight: '19px',
          }}>
            Same process — but the reviewer compares both submissions side-by-side.
            Bring your strongest documents.
          </p>
        </div>

        {/* Requirements — same shape, edited copy for contested context */}
        <div style={{
          background: W.surface, border: `1px solid ${W.border}`, borderRadius: 16,
          padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <OverlineLabel style={{ marginBottom: 10 }}>What you'll need</OverlineLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reqs.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: r.emphasized ? W.warning100 : W.homeBg,
                  color: r.emphasized ? W.warning600 : W.home,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
                }}>
                  {r.emphasized
                    ? <i data-lucide="zap" style={{ width: 12, height: 12, strokeWidth: 2.6 }} />
                    : <i data-lucide="check" style={{ width: 13, height: 13, strokeWidth: 3 }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: W.fg1, letterSpacing: -0.1 }}>{r.title}</div>
                  <div style={{ fontSize: 11.5, color: W.fg3, marginTop: 2, lineHeight: '16px' }}>{r.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <WhyWeAskRow />
      </ScrollArea>

      <StickyBottom>
        <PrimaryBtn icon="arrow-right" full>Start claim</PrimaryBtn>
      </StickyBottom>
    </Phone>
  );
}

Object.assign(window, { FrameClaimStart, FrameClaimContested });
