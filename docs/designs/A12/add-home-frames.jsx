// Pantopus — A12.2 · src/app/homes/new.tsx
// Wizard step 1 (start) — "Add home" · address form
// Two frames: populated (geocoded ✓) + secondary (address needs review).

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
  muted:   '#f8fafc',
  border:  '#e5e7eb',
  borderStrong: '#d1d5db',
  fg1: '#111827',
  fg2: '#374151',
  fg3: '#6b7280',
  fg4: '#9ca3af',
  successBg: '#d1fae5',
  success50: '#ecfdf5',
  success100: '#d1fae5',
  success600:'#059669',
  success700:'#047857',
  warning600:'#d97706',
  warningBg: '#fef3c7',
  warning:   '#92400e',
  errorBg:   '#fee2e2',
  error50:   '#fef2f2',
  error100:  '#fee2e2',
  error500:  '#ef4444',
  error600:  '#dc2626',
  error700:  '#b91c1c',
  homeBg:    '#dcfce7',
  home:      '#16a34a',
};

// ─── Phone + status bar ───────────────────────────────────────

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

// ─── Wizard header ────────────────────────────────────────────

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
      {step && total && <ProgressBar step={step} total={total} />}
    </>
  );
}

function ProgressBar({ step, total }) {
  return (
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
  );
}

// ─── Atoms ────────────────────────────────────────────────────

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

// ─── Form field ───────────────────────────────────────────────

function Field({ label, value, placeholder, optional, error, success, helper, focused, width = '100%', children }) {
  const borderColor = error ? W.error500
                    : focused ? W.primary500
                    : success ? W.success600
                    : W.border;
  const shadow = focused ? '0 0 0 4px rgba(2,132,199,0.12)'
               : error   ? '0 0 0 3px rgba(220,38,38,0.10)'
               : 'none';
  const hasValue = !!value;
  return (
    <div style={{ width, display: 'flex', flexDirection: 'column' }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: W.fg2,
        marginBottom: 6, letterSpacing: 0.02,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span>{label}</span>
        {optional && <span style={{ color: W.fg4, fontWeight: 500 }}>· Optional</span>}
      </div>
      <div style={{
        height: 44, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 8,
        background: W.surface, border: `1.5px solid ${borderColor}`, borderRadius: 10,
        boxShadow: shadow,
        fontSize: 14.5, color: hasValue ? W.fg1 : W.fg4, letterSpacing: -0.1,
      }}>
        <span style={{
          flex: 1, minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {hasValue ? value : placeholder}
          {focused && (
            <span style={{
              display: 'inline-block', width: 1.5, height: 17, background: W.primary600,
              verticalAlign: 'middle', marginLeft: 1, animation: 'caret 1s steps(2) infinite',
            }} />
          )}
        </span>
        {success && <i data-lucide="check" style={{ width: 16, height: 16, color: W.success600, strokeWidth: 3 }} />}
        {error && <i data-lucide="alert-circle" style={{ width: 16, height: 16, color: W.error600 }} />}
        {children}
      </div>
      {helper && !error && (
        <div style={{ fontSize: 11, color: W.fg3, marginTop: 6, lineHeight: '15px' }}>{helper}</div>
      )}
      {error && (
        <div style={{
          fontSize: 11.5, color: W.error700, marginTop: 6, lineHeight: '16px',
          display: 'flex', alignItems: 'flex-start', gap: 4, fontWeight: 500,
        }}>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

// Tiny map preview strip (procedural — no image)
function MapStrip({ lat, lng, dot = W.primary600 }) {
  return (
    <div style={{
      position: 'relative', height: 88, borderRadius: 12, overflow: 'hidden',
      background:
        `radial-gradient(circle at 30% 40%, ${W.primary50} 0%, transparent 60%),` +
        `linear-gradient(180deg, #eef2f5 0%, #e7ecf0 100%)`,
      border: `1px solid ${W.border}`,
    }}>
      {/* fake streets */}
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }} viewBox="0 0 320 88" preserveAspectRatio="none">
        <line x1="0" y1="22" x2="320" y2="22" stroke="#fff" strokeWidth="6" />
        <line x1="0" y1="56" x2="320" y2="56" stroke="#fff" strokeWidth="4" />
        <line x1="80" y1="0" x2="80" y2="88" stroke="#fff" strokeWidth="5" />
        <line x1="220" y1="0" x2="220" y2="88" stroke="#fff" strokeWidth="3" />
        <rect x="92" y="28" width="42" height="24" fill="#dde3e8" />
        <rect x="146" y="28" width="60" height="24" fill="#dde3e8" />
        <rect x="232" y="62" width="50" height="20" fill="#dde3e8" />
        <rect x="14" y="62" width="54" height="20" fill="#dde3e8" />
      </svg>
      {/* pin */}
      <div style={{
        position: 'absolute', left: 'calc(50% - 14px)', top: 22,
        width: 28, height: 28, borderRadius: '50% 50% 50% 0',
        background: dot, transform: 'rotate(-45deg)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%', background: '#fff',
          transform: 'rotate(45deg)',
        }} />
      </div>
      {/* coordinates badge */}
      <div style={{
        position: 'absolute', bottom: 8, right: 8,
        padding: '3px 8px', borderRadius: 6,
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(4px)',
        fontSize: 10, fontWeight: 600, color: W.fg2,
        fontFamily: 'ui-monospace, Menlo, monospace', letterSpacing: -0.2,
      }}>{lat}, {lng}</div>
    </div>
  );
}

// ─── FRAME 1 · POPULATED (geocoded ✓) ─────────────────────────

function FrameNewPopulated() {
  return (
    <Phone label="A12.2 Add home — populated">
      <WizardHeader title="Add home" step={1} total={3} />
      <ScrollArea>
        <div>
          <h2 style={{
            margin: 0, fontSize: 20, fontWeight: 700, color: W.fg1,
            letterSpacing: -0.3, lineHeight: '26px',
          }}>What's the address?</h2>
          <p style={{
            margin: '6px 0 0', fontSize: 13.5, color: W.fg3, lineHeight: '19px',
          }}>
            Where do you receive mail? This is the home you'll claim — we'll verify it on the next step.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Street address" value="412 Elm Street" success />
          <div style={{ display: 'flex', gap: 10 }}>
            <Field label="Apt / Unit" value="3B" optional width="40%" />
            <Field label="City" value="Brooklyn" width="60%" />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Field label="State" value="NY" width="40%">
              <i data-lucide="chevron-down" style={{ width: 14, height: 14, color: W.fg3 }} />
            </Field>
            <Field label="ZIP" value="11211" width="60%" success />
          </div>
        </div>

        {/* geocode confirmation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <MapStrip lat="40.7138°N" lng="73.9527°W" />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 10,
            background: W.success50, border: `1px solid ${W.success100}`,
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%', background: W.success600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <i data-lucide="check" style={{ width: 12, height: 12, color: '#fff', strokeWidth: 3.4 }} />
            </div>
            <div style={{ flex: 1, fontSize: 12, color: W.success700, lineHeight: '16px' }}>
              <b style={{ fontWeight: 700 }}>Address recognized.</b> Looks like Brooklyn, NY — multi-unit.
            </div>
          </div>
        </div>

        <button style={{
          background: 'transparent', border: 'none', padding: '4px 0',
          color: W.primary600, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 4,
          letterSpacing: -0.1, alignSelf: 'flex-start',
        }}>
          <i data-lucide="search" style={{ width: 14, height: 14 }} />
          Search for an address instead
        </button>
      </ScrollArea>

      <StickyBottom>
        <PrimaryBtn icon="arrow-right" full>Continue</PrimaryBtn>
      </StickyBottom>
    </Phone>
  );
}

// ─── FRAME 2 · SECONDARY (needs review) ───────────────────────

function FrameNewNeedsReview() {
  return (
    <Phone label="A12.2 Add home — needs review">
      <WizardHeader title="Add home" step={1} total={3} />
      <ScrollArea>
        <div>
          <h2 style={{
            margin: 0, fontSize: 20, fontWeight: 700, color: W.fg1,
            letterSpacing: -0.3, lineHeight: '26px',
          }}>What's the address?</h2>
          <p style={{
            margin: '6px 0 0', fontSize: 13.5, color: W.fg3, lineHeight: '19px',
          }}>
            Where do you receive mail? This is the home you'll claim — we'll verify it on the next step.
          </p>
        </div>

        {/* correction banner */}
        <div style={{
          padding: '12px 14px', borderRadius: 12,
          background: W.warningBg, border: `1px solid rgba(217,119,6,0.30)`,
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: '50%', background: W.warning600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            color: '#fff',
          }}>
            <i data-lucide="alert-triangle" style={{ width: 14, height: 14, strokeWidth: 2.4 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: W.warning, letterSpacing: -0.1 }}>
              We couldn't pinpoint this address
            </div>
            <div style={{ fontSize: 12, color: W.warning, marginTop: 3, lineHeight: '16px' }}>
              ZIP <b>11201</b> is in Brooklyn — but <b>412 Elm St</b> is in the <b>11211</b> ZIP. Did you mean:
            </div>
            <button style={{
              marginTop: 10, padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
              background: W.surface, border: `1px solid ${W.warning600}`,
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              textAlign: 'left',
            }}>
              <i data-lucide="map-pin" style={{ width: 14, height: 14, color: W.warning600, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 12.5, color: W.fg1, fontWeight: 600, letterSpacing: -0.1 }}>
                412 Elm St, Brooklyn NY <b style={{ color: W.warning600 }}>11211</b>
              </span>
              <span style={{
                fontSize: 11, fontWeight: 700, color: W.warning600,
                letterSpacing: 0.04, textTransform: 'uppercase', flexShrink: 0,
              }}>Apply</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Street address" value="412 Elm Street" />
          <div style={{ display: 'flex', gap: 10 }}>
            <Field label="Apt / Unit" value="3B" optional width="40%" />
            <Field label="City" value="Brooklyn" width="60%" />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Field label="State" value="NY" width="40%">
              <i data-lucide="chevron-down" style={{ width: 14, height: 14, color: W.fg3 }} />
            </Field>
            <Field
              label="ZIP"
              value="11201"
              width="60%"
              error="ZIP doesn't match Brooklyn for this street."
            />
          </div>
        </div>
      </ScrollArea>

      <StickyBottom>
        <PrimaryBtn icon="arrow-right" disabled full>Continue</PrimaryBtn>
      </StickyBottom>
    </Phone>
  );
}

// caret keyframes
if (typeof document !== 'undefined' && !document.getElementById('__caret_kf')) {
  const s = document.createElement('style');
  s.id = '__caret_kf';
  s.textContent = `@keyframes caret { 0%{opacity:1} 50%{opacity:0} 100%{opacity:1} }`;
  document.head.appendChild(s);
}

Object.assign(window, { FrameNewPopulated, FrameNewNeedsReview });
