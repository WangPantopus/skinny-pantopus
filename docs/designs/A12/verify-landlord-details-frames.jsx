// Pantopus — A12.6 · src/app/homes/[id]/verify-landlord/details.tsx
// Wizard step 2 (details) — "Verify landlord — Details"
// Two frames: populated (ready to submit) + validation-errors (blocked submit).

const D = {
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
  error50:    '#fef2f2',
  error100:   '#fee2e2',
  error600:   '#dc2626',
  error700:   '#b91c1c',
  homeBg:     '#dcfce7',
  home:       '#16a34a',
  business:   '#7c3aed',
  businessBg: '#f3e8ff',
};

// ─── Phone shell ──────────────────────────────────────────────

function DSB() {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '16px 28px 0', height: 44, boxSizing: 'border-box',
      fontFamily: '-apple-system, system-ui', fontWeight: 600, fontSize: 15, color: D.fg1,
    }}>
      <span>9:41</span>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={D.fg1}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={D.fg1}/><rect x="9" y="2" width="3" height="9" rx="0.6" fill={D.fg1}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={D.fg1}/></svg>
        <svg width="15" height="11" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={D.fg1}/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={D.fg1}/><circle cx="7.5" cy="9" r="1.3" fill={D.fg1}/></svg>
        <svg width="24" height="11" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={D.fg1} strokeOpacity="0.35" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill={D.fg1}/><path d="M22.5 3.8v3.4c.6-.2 1-.8 1-1.7s-.4-1.5-1-1.7z" fill={D.fg1} fillOpacity="0.4"/></svg>
      </div>
    </div>
  );
}

function DPhone({ children, label }) {
  return (
    <div style={{
      width: 360, height: 740, borderRadius: 46, padding: 10,
      background: '#0b0f17',
      boxShadow: '0 40px 80px rgba(17,24,39,0.22), 0 0 0 1px rgba(0,0,0,0.14)',
    }} data-screen-label={label}>
      <div style={{
        width: '100%', height: '100%', background: D.bg,
        borderRadius: 36, overflow: 'hidden', position: 'relative',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          position: 'absolute', top: 9, left: '50%', transform: 'translateX(-50%)',
          width: 108, height: 30, borderRadius: 20, background: '#000', zIndex: 50,
        }} />
        <DSB />
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

function DWizardHeader({ title, step, total }) {
  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', padding: '8px 8px',
        height: 48, boxSizing: 'border-box', background: D.surface, flexShrink: 0,
      }}>
        <button style={{
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer', color: D.fg1, padding: 0,
          borderRadius: 8,
        }}>
          <i data-lucide="arrow-left" style={{ width: 22, height: 22 }} />
        </button>
        <div style={{
          flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600,
          color: D.fg1, letterSpacing: -0.15,
        }}>{title}</div>
        <div style={{
          minWidth: 52, padding: '0 12px', fontSize: 12, fontWeight: 500,
          color: D.fg3, textAlign: 'right', letterSpacing: -0.05,
        }}>{step} of {total}</div>
      </div>
      <div style={{
        display: 'flex', gap: 4, padding: '0 16px 8px',
        background: D.surface, borderBottom: `1px solid ${D.border}`,
      }}>
        {Array.from({ length: total }, (_, i) => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 3,
            background: i < step ? D.primary600 : D.border,
          }} />
        ))}
      </div>
    </>
  );
}

function DScrollArea({ children, bottomPad = 116 }) {
  return (
    <div style={{
      flex: 1, overflow: 'auto',
      padding: `18px 16px ${bottomPad}px`,
      display: 'flex', flexDirection: 'column', gap: 18,
    }}>{children}</div>
  );
}

function DStickyBottom({ children }) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'rgba(255,255,255,0.96)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      borderTop: `1px solid ${D.border}`,
      padding: '10px 16px 28px', zIndex: 10,
      display: 'flex', gap: 8, alignItems: 'stretch', flexDirection: 'column',
    }}>{children}</div>
  );
}

function DPrimaryBtn({ children, icon, disabled, full }) {
  return (
    <button disabled={disabled} style={{
      width: full ? '100%' : undefined,
      height: 48, borderRadius: 12, border: 'none',
      background: disabled ? D.sunken : D.primary600,
      color: disabled ? D.fg4 : '#fff',
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

// ─── Form atoms ───────────────────────────────────────────────

function DSectionHeader({ overline, title, sub, right }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      gap: 12, marginBottom: 10,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: D.fg3, marginBottom: 4,
        }}>{overline}</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: D.fg1, letterSpacing: -0.15 }}>{title}</div>
        {sub && (
          <div style={{ fontSize: 11.5, color: D.fg3, marginTop: 2, lineHeight: '16px' }}>{sub}</div>
        )}
      </div>
      {right}
    </div>
  );
}

function DField({ label, optional, value, placeholder, icon, error, hint, focused, prefix }) {
  const empty = !value;
  const borderColor = error ? D.error600 : focused ? D.primary600 : D.border;
  const ring = focused ? `0 0 0 3px ${D.primary100}` : 'none';
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: 6,
      }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: D.fg2, letterSpacing: -0.05 }}>
          {label}
          {optional && (
            <span style={{
              marginLeft: 6, fontSize: 10, fontWeight: 500,
              color: D.fg4, textTransform: 'none',
            }}>· optional</span>
          )}
        </label>
        {error && (
          <span style={{ fontSize: 10.5, color: D.error600, fontWeight: 600 }}>
            <i data-lucide="alert-circle" style={{ width: 10, height: 10, marginRight: 3, verticalAlign: '-1px' }} />
            {error}
          </span>
        )}
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        height: 44, padding: '0 12px',
        background: D.surface, border: `1px solid ${borderColor}`,
        borderRadius: 10, boxShadow: ring,
        transition: 'border-color 120ms, box-shadow 120ms',
      }}>
        {icon && (
          <i data-lucide={icon} style={{ width: 15, height: 15, color: D.fg3, flexShrink: 0 }} />
        )}
        {prefix && (
          <span style={{ fontSize: 13.5, color: D.fg4 }}>{prefix}</span>
        )}
        <div style={{
          flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: 1.2,
          color: empty ? D.fg4 : D.fg1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {value || placeholder}
        </div>
        {focused && !error && (
          <div style={{
            width: 1.5, height: 16, background: D.primary600, borderRadius: 1,
            animation: 'caret 1s steps(2) infinite',
          }} />
        )}
      </div>
      {hint && !error && (
        <div style={{ fontSize: 11, color: D.fg3, marginTop: 5, lineHeight: '15px' }}>{hint}</div>
      )}
    </div>
  );
}

function DSelectField({ label, value, placeholder, icon }) {
  const empty = !value;
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 12, fontWeight: 600, color: D.fg2,
        letterSpacing: -0.05, marginBottom: 6,
      }}>{label}</label>
      <button style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
        height: 44, padding: '0 12px',
        background: D.surface, border: `1px solid ${D.border}`,
        borderRadius: 10, textAlign: 'left', cursor: 'pointer',
      }}>
        {icon && <i data-lucide={icon} style={{ width: 15, height: 15, color: D.fg3, flexShrink: 0 }} />}
        <span style={{
          flex: 1, fontSize: 13.5, color: empty ? D.fg4 : D.fg1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{value || placeholder}</span>
        <i data-lucide="chevron-down" style={{ width: 15, height: 15, color: D.fg3, flexShrink: 0 }} />
      </button>
    </div>
  );
}

// Card-style group container for sections
function DCard({ children }) {
  return (
    <div style={{
      background: D.surface, border: `1px solid ${D.border}`, borderRadius: 16,
      padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>{children}</div>
  );
}

// Compact PM toggle row
function DPMToggle({ on }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 0 4px',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: D.fg1, letterSpacing: -0.1 }}>
          Property manager handles this rental
        </div>
        <div style={{ fontSize: 11.5, color: D.fg3, marginTop: 2, lineHeight: '16px' }}>
          Add a PM if someone other than the owner collects rent or handles maintenance.
        </div>
      </div>
      <div style={{
        width: 38, height: 22, borderRadius: 9999, position: 'relative',
        background: on ? D.primary600 : D.borderStrong, flexShrink: 0,
        transition: 'background 120ms',
      }}>
        <div style={{
          position: 'absolute', top: 2, left: on ? 18 : 2,
          width: 18, height: 18, borderRadius: '50%', background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
          transition: 'left 120ms',
        }} />
      </div>
    </div>
  );
}

// Lease upload — done / error variants
function DLeaseUpload({ state, file, warning }) {
  if (state === 'done' || state === 'warn') {
    const isWarn = state === 'warn';
    return (
      <div style={{
        background: D.sunken,
        border: `1px solid ${isWarn ? D.warning100 : D.success100}`,
        borderRadius: 12, padding: '10px 12px',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 44, borderRadius: 5, flexShrink: 0,
            background: '#fef2f2', color: D.error600,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 8.5, fontWeight: 800, letterSpacing: 0.4,
          }}>PDF</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 12.5, fontWeight: 600, color: D.fg1, letterSpacing: -0.1,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{file.name}</div>
            <div style={{ fontSize: 11, color: D.fg3, marginTop: 1 }}>
              {file.size} · {file.pages} pages · Uploaded just now
            </div>
          </div>
          <button style={{
            width: 26, height: 26, borderRadius: 7, border: 'none',
            background: 'transparent', color: D.fg3, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <i data-lucide="trash-2" style={{ width: 13, height: 13 }} />
          </button>
        </div>

        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 7,
          padding: '7px 9px', borderRadius: 8,
          background: isWarn ? D.warning50 : D.success50,
        }}>
          <div style={{
            width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
            background: isWarn ? D.warning600 : D.success600,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', marginTop: 1,
          }}>
            <i data-lucide={isWarn ? 'alert-triangle' : 'check'}
               style={{ width: 10, height: 10, strokeWidth: 3 }} />
          </div>
          <div style={{
            flex: 1, fontSize: 11, lineHeight: '15px', fontWeight: 500,
            color: isWarn ? D.warning700 : D.success700,
          }}>
            {!isWarn && <span><b>Lease parsed.</b> Owner "M. Patel" and unit "Apt 3B" detected.</span>}
            {isWarn && warning}
          </div>
        </div>
      </div>
    );
  }

  // empty
  return (
    <button style={{
      width: '100%', background: 'transparent',
      border: `1.5px dashed ${D.borderStrong}`,
      borderRadius: 12, padding: '14px 14px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 9, background: D.primary50,
        color: D.primary600, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <i data-lucide="upload" style={{ width: 16, height: 16, strokeWidth: 2.2 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: D.fg1, letterSpacing: -0.1 }}>
          Attach lease or deed
        </div>
        <div style={{ fontSize: 11, color: D.fg3, marginTop: 2, lineHeight: '15px' }}>
          PDF, JPG, or PNG · up to 10 MB
        </div>
      </div>
      <i data-lucide="plus" style={{ width: 17, height: 17, color: D.fg3, flexShrink: 0 }} />
    </button>
  );
}

// ─── FRAME 1 · POPULATED (ready to submit) ────────────────────

function FrameVerifyLandlordDetailsPopulated() {
  return (
    <DPhone label="A12.6 Verify landlord — details (populated)">
      <DWizardHeader title="Verify landlord" step={2} total={3} />
      <DScrollArea>
        {/* Header copy */}
        <div>
          <h2 style={{
            margin: 0, fontSize: 20, fontWeight: 700, color: D.fg1,
            letterSpacing: -0.3, lineHeight: '26px',
          }}>Landlord & lease details</h2>
          <p style={{
            margin: '4px 0 0', fontSize: 13, color: D.fg3, lineHeight: '18px',
          }}>
            We'll email this person a one-time link to confirm the rental.
          </p>
        </div>

        {/* Business / Owner */}
        <DCard>
          <DSectionHeader
            overline="Business info"
            title="Who owns this rental?"
            right={
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 7px', borderRadius: 9999,
                background: D.businessBg, color: D.business,
                fontSize: 9.5, fontWeight: 700, letterSpacing: 0.06,
                textTransform: 'uppercase',
              }}>
                <i data-lucide="building-2" style={{ width: 9, height: 9 }} />
                Business
              </div>
            }
          />
          <DField label="Owner or business name"
                  value="Elm Street Holdings LLC" icon="building" />
          <DField label="Owner contact name"
                  value="Mira Patel" icon="user" />
          <DField label="Email"
                  value="mira@elmstholdings.com" icon="mail"
                  hint="We'll send a confirmation link here." />
          <DField label="Phone"
                  optional
                  value="(415) 555-0148" icon="phone" />
        </DCard>

        {/* Lease */}
        <DCard>
          <DSectionHeader
            overline="Lease or deed"
            title="Attach proof of the rental"
            sub="One document is enough — the lease you signed, or a deed showing the owner above."
          />
          <DLeaseUpload
            state="done"
            file={{ name: 'lease_apt3b_2025.pdf', size: '1.2 MB', pages: 6 }}
          />
        </DCard>

        {/* PM */}
        <DCard>
          <DSectionHeader
            overline="Property manager"
            title="If different from the owner"
          />
          <DPMToggle on />
          <DField label="PM contact name" value="Daniel Ortega" icon="user" />
          <DField label="PM email" value="dortega@anchorpm.co" icon="mail" />
          <DField label="PM phone" optional value="(415) 555-0922" icon="phone" />
        </DCard>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 11.5, color: D.fg3, padding: '0 2px',
        }}>
          <i data-lucide="lock" style={{ width: 12, height: 12, flexShrink: 0 }} />
          <span>Confirmation email goes only to the landlord. Your name and unit will be shown.</span>
        </div>
      </DScrollArea>

      <DStickyBottom>
        <DPrimaryBtn icon="arrow-right" full>Submit</DPrimaryBtn>
      </DStickyBottom>
    </DPhone>
  );
}

// ─── FRAME 2 · SECONDARY (validation errors) ──────────────────

function FrameVerifyLandlordDetailsErrors() {
  return (
    <DPhone label="A12.6 Verify landlord — details (errors)">
      <DWizardHeader title="Verify landlord" step={2} total={3} />
      <DScrollArea>
        {/* Summary banner */}
        <div style={{
          background: D.error50,
          border: `1px solid ${D.error100}`,
          borderRadius: 12, padding: '10px 12px',
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: '50%', background: D.error600,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', flexShrink: 0, marginTop: 1,
          }}>
            <i data-lucide="alert-circle" style={{ width: 13, height: 13, strokeWidth: 2.4 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: D.error700, letterSpacing: -0.1 }}>
              Fix 2 things to submit
            </div>
            <div style={{ fontSize: 11.5, color: D.error700, marginTop: 3, lineHeight: '16px', opacity: 0.9 }}>
              Email format · Lease unit mismatch
            </div>
          </div>
        </div>

        {/* Business / Owner */}
        <DCard>
          <DSectionHeader
            overline="Business info"
            title="Who owns this rental?"
            right={
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 7px', borderRadius: 9999,
                background: D.businessBg, color: D.business,
                fontSize: 9.5, fontWeight: 700, letterSpacing: 0.06,
                textTransform: 'uppercase',
              }}>
                <i data-lucide="building-2" style={{ width: 9, height: 9 }} />
                Business
              </div>
            }
          />
          <DField label="Owner or business name"
                  value="Elm Street Holdings LLC" icon="building" />
          <DField label="Owner contact name"
                  value="Mira Patel" icon="user" />
          <DField label="Email"
                  value="mira@elmstholdings"
                  icon="mail"
                  error="Missing top-level domain"
                  focused />
          <DField label="Phone"
                  optional
                  placeholder="(555) 123-4567"
                  icon="phone" />
        </DCard>

        {/* Lease — warning */}
        <DCard>
          <DSectionHeader
            overline="Lease or deed"
            title="Attach proof of the rental"
            sub="One document is enough — the lease you signed, or a deed showing the owner above."
          />
          <DLeaseUpload
            state="warn"
            file={{ name: 'old_lease_2023_apt2a.pdf', size: '980 KB', pages: 4 }}
            warning={<span><b>Unit doesn't match.</b> Detected "Apt 2A" — your home is registered as "Apt 3B". Re-upload the correct lease or update your home.</span>}
          />
        </DCard>

        {/* PM — off */}
        <DCard>
          <DSectionHeader
            overline="Property manager"
            title="If different from the owner"
          />
          <DPMToggle on={false} />
        </DCard>
      </DScrollArea>

      <DStickyBottom>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
          fontSize: 11.5, color: D.error600, fontWeight: 600,
        }}>
          <i data-lucide="alert-circle" style={{ width: 12, height: 12 }} />
          <span>2 fields need attention</span>
        </div>
        <DPrimaryBtn icon="arrow-right" full disabled>Submit</DPrimaryBtn>
      </DStickyBottom>
    </DPhone>
  );
}

Object.assign(window, { FrameVerifyLandlordDetailsPopulated, FrameVerifyLandlordDetailsErrors });
