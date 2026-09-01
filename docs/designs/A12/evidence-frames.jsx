// Pantopus — A12.4 · src/app/homes/[id]/claim-owner/evidence.tsx
// Wizard step 2 (uploads) — "Claim ownership — Evidence"
// Two frames: populated (ready to submit) + in-progress (mid-upload, validation hint).

const E = {
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
  warning:    '#92400e',
  error50:    '#fef2f2',
  error100:   '#fee2e2',
  error600:   '#dc2626',
  homeBg:     '#dcfce7',
  home:       '#16a34a',
  home700:    '#15803d',
};

// ─── Phone shell ──────────────────────────────────────────────

function ESB() {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '16px 28px 0', height: 44, boxSizing: 'border-box',
      fontFamily: '-apple-system, system-ui', fontWeight: 600, fontSize: 15, color: E.fg1,
    }}>
      <span>9:41</span>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={E.fg1}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={E.fg1}/><rect x="9" y="2" width="3" height="9" rx="0.6" fill={E.fg1}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={E.fg1}/></svg>
        <svg width="15" height="11" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={E.fg1}/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={E.fg1}/><circle cx="7.5" cy="9" r="1.3" fill={E.fg1}/></svg>
        <svg width="24" height="11" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={E.fg1} strokeOpacity="0.35" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill={E.fg1}/><path d="M22.5 3.8v3.4c.6-.2 1-.8 1-1.7s-.4-1.5-1-1.7z" fill={E.fg1} fillOpacity="0.4"/></svg>
      </div>
    </div>
  );
}

function EPhone({ children, label }) {
  return (
    <div style={{
      width: 360, height: 740, borderRadius: 46, padding: 10,
      background: '#0b0f17',
      boxShadow: '0 40px 80px rgba(17,24,39,0.22), 0 0 0 1px rgba(0,0,0,0.14)',
    }} data-screen-label={label}>
      <div style={{
        width: '100%', height: '100%', background: E.bg,
        borderRadius: 36, overflow: 'hidden', position: 'relative',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          position: 'absolute', top: 9, left: '50%', transform: 'translateX(-50%)',
          width: 108, height: 30, borderRadius: 20, background: '#000', zIndex: 50,
        }} />
        <ESB />
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

function EWizardHeader({ title, step, total }) {
  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', padding: '8px 8px',
        height: 48, boxSizing: 'border-box', background: E.surface, flexShrink: 0,
      }}>
        <button style={{
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer', color: E.fg1, padding: 0,
          borderRadius: 8,
        }}>
          <i data-lucide="arrow-left" style={{ width: 22, height: 22 }} />
        </button>
        <div style={{
          flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600,
          color: E.fg1, letterSpacing: -0.15,
        }}>{title}</div>
        <div style={{
          minWidth: 52, padding: '0 12px', fontSize: 12, fontWeight: 500,
          color: E.fg3, textAlign: 'right', letterSpacing: -0.05,
        }}>{step} of {total}</div>
      </div>
      <div style={{
        display: 'flex', gap: 4, padding: '0 16px 8px',
        background: E.surface, borderBottom: `1px solid ${E.border}`,
      }}>
        {Array.from({ length: total }, (_, i) => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 3,
            background: i < step ? E.primary600 : E.border,
          }} />
        ))}
      </div>
    </>
  );
}

function EScrollArea({ children, bottomPad = 112 }) {
  return (
    <div style={{
      flex: 1, overflow: 'auto',
      padding: `18px 16px ${bottomPad}px`,
      display: 'flex', flexDirection: 'column', gap: 18,
    }}>{children}</div>
  );
}

function EStickyBottom({ children }) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'rgba(255,255,255,0.96)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      borderTop: `1px solid ${E.border}`,
      padding: '12px 16px 28px', zIndex: 10,
      display: 'flex', gap: 10, alignItems: 'center', flexDirection: 'column',
    }}>{children}</div>
  );
}

function EPrimaryBtn({ children, icon, disabled, full }) {
  return (
    <button disabled={disabled} style={{
      width: full ? '100%' : undefined,
      height: 48, borderRadius: 12, border: 'none',
      background: disabled ? E.sunken : E.primary600,
      color: disabled ? E.fg4 : '#fff',
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

function EOverline({ children, style = {} }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: E.fg3, ...style,
    }}>{children}</div>
  );
}

function EHomeChip() {
  return (
    <div style={{
      display: 'inline-flex', padding: '4px 10px', borderRadius: 9999,
      background: E.homeBg, color: E.home, fontSize: 10.5, fontWeight: 700,
      letterSpacing: 0.06, textTransform: 'uppercase', alignSelf: 'flex-start',
      alignItems: 'center', gap: 4,
    }}>
      <i data-lucide="home" style={{ width: 11, height: 11 }} />
      Home · 412 Elm St
    </div>
  );
}

// ─── Upload slot ──────────────────────────────────────────────
// state: 'empty' | 'uploading' | 'done' | 'warn'

function UploadSlot({ label, required, hint, state, file, progress, addressMatch, warning }) {
  if (state === 'empty') {
    return (
      <button style={{
        width: '100%', background: E.surface, border: `1.5px dashed ${E.borderStrong}`,
        borderRadius: 14, padding: '14px 14px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, background: E.primary50,
          color: E.primary600, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i data-lucide="upload" style={{ width: 18, height: 18, strokeWidth: 2.2 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 13.5, fontWeight: 600, color: E.fg1, letterSpacing: -0.1,
          }}>
            {label}
            {required && (
              <span style={{ color: E.error600, fontSize: 12, fontWeight: 700 }}>*</span>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: E.fg3, marginTop: 2, lineHeight: '15px' }}>{hint}</div>
        </div>
        <i data-lucide="plus" style={{ width: 18, height: 18, color: E.fg3, flexShrink: 0 }} />
      </button>
    );
  }

  if (state === 'uploading') {
    return (
      <div style={{
        background: E.surface, border: `1px solid ${E.primary200}`,
        borderRadius: 14, padding: '12px 14px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, background: E.primary50,
            color: E.primary600, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i data-lucide="image" style={{ width: 18, height: 18, strokeWidth: 2 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 600, color: E.fg1, letterSpacing: -0.1,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{file.name}</div>
            <div style={{ fontSize: 11, color: E.fg3, marginTop: 2 }}>
              Uploading · {file.size} · <b style={{ color: E.primary600 }}>{progress}%</b>
            </div>
          </div>
          <button style={{
            width: 28, height: 28, borderRadius: 8, border: 'none',
            background: E.sunken, color: E.fg3, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <i data-lucide="x" style={{ width: 14, height: 14 }} />
          </button>
        </div>
        <div style={{
          height: 4, borderRadius: 3, background: E.sunken, overflow: 'hidden',
        }}>
          <div style={{
            width: `${progress}%`, height: '100%', background: E.primary600,
            borderRadius: 3, transition: 'width 0.3s',
          }} />
        </div>
      </div>
    );
  }

  // done | warn — uploaded card
  const isWarn = state === 'warn';
  return (
    <div style={{
      background: E.surface,
      border: `1px solid ${isWarn ? E.warning100 : E.success100}`,
      borderRadius: 14, padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 48, borderRadius: 6, flexShrink: 0,
          background: file.kind === 'pdf' ? '#fef2f2' : E.primary50,
          color: file.kind === 'pdf' ? E.error600 : E.primary600,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 800, letterSpacing: 0.4,
          position: 'relative',
        }}>
          {file.kind === 'pdf' ? 'PDF' : (
            <i data-lucide="image" style={{ width: 20, height: 20, strokeWidth: 1.8 }} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: E.fg1, letterSpacing: -0.1,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{file.name}</div>
          <div style={{ fontSize: 11, color: E.fg3, marginTop: 2 }}>
            {file.size}{file.pages ? ` · ${file.pages} pages` : ''}
          </div>
        </div>
        <button style={{
          width: 28, height: 28, borderRadius: 8, border: 'none',
          background: 'transparent', color: E.fg3, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <i data-lucide="trash-2" style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {/* OCR check row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px', borderRadius: 9,
        background: isWarn ? E.warning50 : E.success50,
      }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
          background: isWarn ? E.warning600 : E.success600,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff',
        }}>
          <i data-lucide={isWarn ? 'alert-triangle' : 'check'}
             style={{ width: 11, height: 11, strokeWidth: 3 }} />
        </div>
        <div style={{
          flex: 1, fontSize: 11.5,
          color: isWarn ? E.warning700 : E.success700,
          lineHeight: '15px', fontWeight: 500,
        }}>
          {addressMatch && !isWarn && <span><b>Address matches.</b> "412 Elm St" detected on page 1.</span>}
          {isWarn && warning}
        </div>
      </div>
    </div>
  );
}

// ─── Claim statement ──────────────────────────────────────────

function ClaimStatement({ value, placeholder, maxChars = 500 }) {
  const used = value ? value.length : 0;
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: E.fg1, letterSpacing: -0.1,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          Your statement
          <span style={{
            fontSize: 10, fontWeight: 600, color: E.fg4, textTransform: 'uppercase',
            letterSpacing: 0.06,
          }}>Optional</span>
        </div>
        <div style={{ fontSize: 11, color: E.fg4, fontVariantNumeric: 'tabular-nums' }}>
          {used}/{maxChars}
        </div>
      </div>
      <div style={{
        background: E.surface, border: `1px solid ${E.border}`,
        borderRadius: 14, padding: '12px 14px',
        minHeight: value ? 96 : 64,
        fontSize: 13, lineHeight: '20px',
        color: value ? E.fg1 : E.fg4,
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
      }}>
        {value || placeholder}
      </div>
    </div>
  );
}

// ─── FRAME 1 · POPULATED (ready to submit) ────────────────────

function FrameEvidencePopulated() {
  return (
    <EPhone label="A12.4 Claim ownership — evidence (populated)">
      <EWizardHeader title="Claim ownership" step={2} total={3} />
      <EScrollArea>
        <EHomeChip />

        <div>
          <h2 style={{
            margin: 0, fontSize: 22, fontWeight: 700, color: E.fg1,
            letterSpacing: -0.3, lineHeight: '28px',
          }}>Upload your evidence</h2>
          <p style={{
            margin: '6px 0 0', fontSize: 13.5, color: E.fg3, lineHeight: '19px',
          }}>
            Two documents proving you live at and own 412 Elm St. We auto-check the
            address against your account.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <EOverline>Documents · 2 of 2 attached</EOverline>

          <UploadSlot
            label="Proof of ownership"
            required
            state="done"
            file={{ name: 'deed_of_trust_412elm.pdf', size: '1.4 MB', pages: 8, kind: 'pdf' }}
            addressMatch
          />

          <UploadSlot
            label="Recent utility or tax bill"
            required
            state="done"
            file={{ name: 'oct_2026_tax_statement.jpg', size: '820 KB', kind: 'image' }}
            addressMatch
          />
        </div>

        <ClaimStatement
          value={"I purchased the property at 412 Elm St in March 2022 and have lived here as the sole owner since closing. The deed is in my name; the tax statement reflects the same address as my Pantopus account."}
        />

        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 11.5, color: E.fg3, padding: '0 2px',
        }}>
          <i data-lucide="lock" style={{ width: 12, height: 12, flexShrink: 0 }} />
          <span>Encrypted in transit. Visible only to the reviewer assigned to your claim.</span>
        </div>
      </EScrollArea>

      <EStickyBottom>
        <EPrimaryBtn icon="arrow-right" full>Submit claim</EPrimaryBtn>
      </EStickyBottom>
    </EPhone>
  );
}

// ─── FRAME 2 · SECONDARY (upload-in-progress) ─────────────────

function FrameEvidenceInProgress() {
  return (
    <EPhone label="A12.4 Claim ownership — evidence (in progress)">
      <EWizardHeader title="Claim ownership" step={2} total={3} />
      <EScrollArea>
        <EHomeChip />

        <div>
          <h2 style={{
            margin: 0, fontSize: 22, fontWeight: 700, color: E.fg1,
            letterSpacing: -0.3, lineHeight: '28px',
          }}>Upload your evidence</h2>
          <p style={{
            margin: '6px 0 0', fontSize: 13.5, color: E.fg3, lineHeight: '19px',
          }}>
            Two documents proving you live at and own 412 Elm St. We auto-check the
            address against your account.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <EOverline>Documents · 1 of 2 attached</EOverline>

          {/* One done, with address-mismatch warning */}
          <UploadSlot
            label="Proof of ownership"
            required
            state="warn"
            file={{ name: 'mortgage_statement.pdf', size: '2.1 MB', pages: 4, kind: 'pdf' }}
            warning={<span><b>Address differs from your profile.</b> Doc reads "412 Elm Street"; your account has "412 Elm St, Apt 3B". You can still submit — the reviewer will resolve it.</span>}
          />

          {/* One uploading */}
          <UploadSlot
            label="Recent utility or tax bill"
            required
            state="uploading"
            file={{ name: 'pge_october_bill.jpg', size: '1.1 MB', kind: 'image' }}
            progress={62}
          />
        </div>

        <ClaimStatement
          value={"I purchased 412 Elm St in"}
          placeholder="Add a short statement to help the reviewer (e.g. how long you've owned, anyone else on title)…"
        />

        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 11.5, color: E.fg3, padding: '0 2px',
        }}>
          <i data-lucide="lock" style={{ width: 12, height: 12, flexShrink: 0 }} />
          <span>Encrypted in transit. Visible only to the reviewer assigned to your claim.</span>
        </div>
      </EScrollArea>

      <EStickyBottom>
        <div style={{
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          fontSize: 11.5, color: E.fg3, marginBottom: 2,
        }}>
          <i data-lucide="loader" style={{ width: 12, height: 12 }} />
          <span>Waiting for upload to finish</span>
        </div>
        <EPrimaryBtn icon="arrow-right" full disabled>Submit claim</EPrimaryBtn>
      </EStickyBottom>
    </EPhone>
  );
}

Object.assign(window, { FrameEvidencePopulated, FrameEvidenceInProgress });
