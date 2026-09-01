// Pantopus — A12.7 · src/app/homes/[id]/verify-postcard.tsx
// Physical postcard verification — single-screen wizard.
// Two frames: populated (delivered + code entered) + in-transit (waiting).

const P = {
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
  // Postcard paper
  paper:      '#fefcf6',
  paperEdge:  '#e8e3d4',
  ink:        '#1f1d18',
  inkSoft:    '#5a554c',
};

// ─── Phone shell ──────────────────────────────────────────────

function PSB() {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '16px 28px 0', height: 44, boxSizing: 'border-box',
      fontFamily: '-apple-system, system-ui', fontWeight: 600, fontSize: 15, color: P.fg1,
    }}>
      <span>9:41</span>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={P.fg1}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={P.fg1}/><rect x="9" y="2" width="3" height="9" rx="0.6" fill={P.fg1}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={P.fg1}/></svg>
        <svg width="15" height="11" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={P.fg1}/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={P.fg1}/><circle cx="7.5" cy="9" r="1.3" fill={P.fg1}/></svg>
        <svg width="24" height="11" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={P.fg1} strokeOpacity="0.35" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill={P.fg1}/><path d="M22.5 3.8v3.4c.6-.2 1-.8 1-1.7s-.4-1.5-1-1.7z" fill={P.fg1} fillOpacity="0.4"/></svg>
      </div>
    </div>
  );
}

function PPhone({ children, label }) {
  return (
    <div style={{
      width: 360, height: 740, borderRadius: 46, padding: 10,
      background: '#0b0f17',
      boxShadow: '0 40px 80px rgba(17,24,39,0.22), 0 0 0 1px rgba(0,0,0,0.14)',
    }} data-screen-label={label}>
      <div style={{
        width: '100%', height: '100%', background: P.bg,
        borderRadius: 36, overflow: 'hidden', position: 'relative',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          position: 'absolute', top: 9, left: '50%', transform: 'translateX(-50%)',
          width: 108, height: 30, borderRadius: 20, background: '#000', zIndex: 50,
        }} />
        <PSB />
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

function PHeader({ title }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '8px 8px',
      height: 48, boxSizing: 'border-box', background: P.surface, flexShrink: 0,
      borderBottom: `1px solid ${P.border}`,
    }}>
      <button style={{
        width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: 'none', cursor: 'pointer', color: P.fg1, padding: 0,
        borderRadius: 8,
      }}>
        <i data-lucide="arrow-left" style={{ width: 22, height: 22 }} />
      </button>
      <div style={{
        flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600,
        color: P.fg1, letterSpacing: -0.15,
      }}>{title}</div>
      <button style={{
        width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: 'none', cursor: 'pointer', color: P.fg3, padding: 0,
        borderRadius: 8,
      }}>
        <i data-lucide="help-circle" style={{ width: 20, height: 20 }} />
      </button>
    </div>
  );
}

function PScrollArea({ children, bottomPad = 110 }) {
  return (
    <div style={{
      flex: 1, overflow: 'auto',
      padding: `18px 16px ${bottomPad}px`,
      display: 'flex', flexDirection: 'column', gap: 18,
    }}>{children}</div>
  );
}

function PStickyBottom({ children }) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'rgba(255,255,255,0.96)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      borderTop: `1px solid ${P.border}`,
      padding: '12px 16px 28px', zIndex: 10,
      display: 'flex', gap: 8, alignItems: 'stretch', flexDirection: 'column',
    }}>{children}</div>
  );
}

function PPrimaryBtn({ children, icon, disabled, full }) {
  return (
    <button disabled={disabled} style={{
      width: full ? '100%' : undefined,
      height: 48, borderRadius: 12, border: 'none',
      background: disabled ? P.sunken : P.primary600,
      color: disabled ? P.fg4 : '#fff',
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

// ─── Postcard hero ────────────────────────────────────────────

function Postcard({ delivered, recipientName = 'Mira Patel', street = '412 Elm St, Apt 3B', cityZip = 'San Francisco, CA 94114' }) {
  return (
    <div style={{
      position: 'relative', display: 'flex', justifyContent: 'center',
      paddingTop: 8, paddingBottom: 4,
    }}>
      <div style={{
        position: 'relative', width: 268, height: 168,
        transform: 'rotate(-2.5deg)',
        filter: 'drop-shadow(0 12px 22px rgba(31,29,24,0.18))',
      }}>
        {/* Card body */}
        <div style={{
          position: 'absolute', inset: 0,
          background: P.paper,
          border: `1px solid ${P.paperEdge}`,
          borderRadius: 8,
          padding: 12, boxSizing: 'border-box',
          display: 'flex', flexDirection: 'column',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          overflow: 'hidden',
        }}>
          {/* Top row: logo + stamp area */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{
              fontSize: 8, fontWeight: 700, letterSpacing: '0.2em',
              color: P.primary700, textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span style={{
                width: 10, height: 10, borderRadius: 2, background: P.primary600,
                display: 'inline-block',
              }} />
              Pantopus
            </div>
            <div style={{
              width: 36, height: 42, border: `1px dashed ${P.inkSoft}`,
              borderRadius: 3, padding: 2, boxSizing: 'border-box',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                width: '100%', height: '100%', background: P.primary100,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 6.5, fontWeight: 700, color: P.primary700, lineHeight: 1.1,
                textAlign: 'center', letterSpacing: 0.04,
              }}>
                US<br/>POSTAGE<br/>$0.56
              </div>
            </div>
          </div>

          {/* Divider line down center */}
          <div style={{
            position: 'absolute', top: 12, bottom: 12, left: '46%',
            width: 1, background: P.paperEdge,
          }} />

          {/* Left: code area */}
          <div style={{
            position: 'absolute', left: 12, top: 38, bottom: 12,
            width: '38%',
            display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center',
          }}>
            <div style={{
              fontSize: 6.5, fontWeight: 700, letterSpacing: '0.18em',
              color: P.inkSoft, textTransform: 'uppercase',
            }}>Your code</div>
            <div style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 22, fontWeight: 700, color: P.ink, letterSpacing: '0.14em',
              lineHeight: 1,
            }}>4Q2-K7B</div>
            <div style={{
              fontSize: 6.5, color: P.inkSoft, lineHeight: '9px',
              marginTop: 2, fontFamily: 'ui-monospace, monospace',
            }}>
              Open Pantopus → enter at<br/>
              <i>Homes › Verify postcard</i>
            </div>
          </div>

          {/* Right: address block */}
          <div style={{
            position: 'absolute', right: 12, top: 56, bottom: 12,
            width: '46%',
            fontSize: 8.5, color: P.ink, lineHeight: '12px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}>
            <div style={{ fontWeight: 700 }}>{recipientName}</div>
            <div>{street}</div>
            <div>{cityZip}</div>
            {/* Barcode-ish */}
            <div style={{
              display: 'flex', gap: 0.6, marginTop: 8,
              alignItems: 'flex-end', height: 14,
            }}>
              {[2,3,1,2,1,3,1,2,2,1,3,1,2,3,1,1,2,3,1,2,1,3,2,1,2,3,1,2,1,3,2,1,3].map((h, i) => (
                <span key={i} style={{
                  width: 1.2, height: 4 + h * 2.5, background: P.ink,
                }} />
              ))}
            </div>
          </div>
        </div>

        {/* Cancellation marks if delivered */}
        {delivered && (
          <>
            <div style={{
              position: 'absolute', top: 14, right: 50,
              width: 50, height: 50, borderRadius: '50%',
              border: `1.5px solid ${P.success600}`, opacity: 0.55,
              transform: 'rotate(-12deg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 7, color: P.success700, fontWeight: 700,
              textAlign: 'center', lineHeight: 1.1, letterSpacing: 0.05,
              fontFamily: 'ui-monospace, monospace',
            }}>
              DELIVERED<br/>OCT 12<br/>2026
            </div>
            <div style={{
              position: 'absolute', top: 50, right: 60,
              width: 80, height: 1.5, background: P.success600, opacity: 0.4,
              transform: 'rotate(-12deg)',
            }} />
            <div style={{
              position: 'absolute', top: 60, right: 56,
              width: 75, height: 1.5, background: P.success600, opacity: 0.3,
              transform: 'rotate(-12deg)',
            }} />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Status timeline ──────────────────────────────────────────

function StatusTimeline({ stage }) {
  // stage: 0=mailed, 1=in-transit, 2=delivered
  const steps = [
    { label: 'Mailed',     date: 'Oct 9',  icon: 'send' },
    { label: 'In transit', date: 'Oct 11', icon: 'truck' },
    { label: 'Delivered',  date: 'Oct 12', icon: 'mailbox' },
  ];
  return (
    <div style={{
      background: P.surface, border: `1px solid ${P.border}`,
      borderRadius: 16, padding: '16px 14px 14px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 14,
      }}>
        <div style={{
          fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: P.fg3,
        }}>USPS tracking</div>
        <div style={{
          fontSize: 10.5, color: P.fg4, fontFamily: 'ui-monospace, monospace',
        }}>#9405 5036 …8421</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, position: 'relative' }}>
        {steps.map((s, i) => {
          const done = i <= stage;
          const current = i === stage;
          const isLast = i === steps.length - 1;
          return (
            <React.Fragment key={i}>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 6, flexShrink: 0, position: 'relative', zIndex: 1,
                minWidth: 0, flex: '0 0 auto',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: done ? (current && stage < 2 ? P.warning600 : P.success600) : P.sunken,
                  color: done ? '#fff' : P.fg4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: current && stage < 2 ? `3px solid ${P.warning100}` : 'none',
                  boxShadow: current && stage < 2 ? '0 0 0 2px ' + P.warning600 : 'none',
                  transition: 'all 200ms',
                }}>
                  <i data-lucide={s.icon} style={{ width: 16, height: 16, strokeWidth: 2 }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: 11, fontWeight: 600,
                    color: done ? P.fg1 : P.fg4, letterSpacing: -0.05,
                  }}>{s.label}</div>
                  <div style={{
                    fontSize: 10, color: done ? P.fg3 : P.fg4, marginTop: 1,
                    fontFamily: 'ui-monospace, monospace',
                  }}>{done ? s.date : '—'}</div>
                </div>
              </div>
              {!isLast && (
                <div style={{
                  flex: 1, height: 2, marginTop: 17, background: P.sunken,
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: i < stage ? P.success600 : 'transparent',
                    transition: 'background 200ms',
                  }} />
                  {i === stage && stage < 2 && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: `repeating-linear-gradient(90deg, ${P.warning600} 0 6px, ${P.sunken} 6px 12px)`,
                      opacity: 0.55,
                    }} />
                  )}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ─── Code input ───────────────────────────────────────────────

function CodeInput({ value = '', focused, disabled }) {
  // 6-char code, dash after 3rd
  const chars = value.padEnd(6, ' ').split('').slice(0, 6);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
      {chars.map((c, i) => {
        const filled = c.trim().length > 0;
        const isCaret = focused && !filled && i === value.length;
        return (
          <React.Fragment key={i}>
            <div style={{
              width: 38, height: 50, borderRadius: 10,
              background: disabled ? P.sunken : P.surface,
              border: `1.5px solid ${isCaret ? P.primary600 : (filled ? P.borderStrong : P.border)}`,
              boxShadow: isCaret ? `0 0 0 3px ${P.primary100}` : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 22, fontWeight: 700,
              color: disabled ? P.fg4 : P.fg1,
              transition: 'border-color 120ms, box-shadow 120ms',
            }}>
              {filled ? c : (isCaret ? (
                <div style={{
                  width: 1.5, height: 22, background: P.primary600, borderRadius: 1,
                  animation: 'caret 1s steps(2) infinite',
                }} />
              ) : null)}
            </div>
            {i === 2 && (
              <div style={{
                width: 8, height: 2, background: disabled ? P.borderStrong : P.fg4,
                borderRadius: 1, flexShrink: 0,
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── FRAME 1 · POPULATED (delivered + code entered) ───────────

function FrameVerifyPostcardDelivered() {
  return (
    <PPhone label="A12.7 Postcard verification — delivered">
      <PHeader title="Postcard verification" />
      <PScrollArea>
        <Postcard delivered />

        {/* Hero copy */}
        <div style={{ textAlign: 'center', padding: '0 8px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 9px', borderRadius: 9999,
            background: P.success50, color: P.success700,
            fontSize: 10, fontWeight: 700, letterSpacing: 0.06,
            textTransform: 'uppercase', marginBottom: 10,
          }}>
            <i data-lucide="check-circle-2" style={{ width: 11, height: 11 }} />
            Delivered Oct 12
          </div>
          <h2 style={{
            margin: 0, fontSize: 20, fontWeight: 700, color: P.fg1,
            letterSpacing: -0.3, lineHeight: '26px',
          }}>Enter the code from the card</h2>
          <p style={{
            margin: '6px auto 0', fontSize: 13, color: P.fg3, lineHeight: '18px',
            maxWidth: 280,
          }}>
            6 characters, printed on the left side. Case doesn't matter.
          </p>
        </div>

        <StatusTimeline stage={2} />

        <CodeInput value="4Q2K7B" />

        {/* Secondary actions */}
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14,
          fontSize: 12, color: P.fg3,
        }}>
          <button style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: P.fg3, fontSize: 12, padding: '4px 6px',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <i data-lucide="rotate-cw" style={{ width: 12, height: 12 }} />
            Resend
          </button>
          <div style={{ width: 1, height: 12, background: P.border }} />
          <button style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: P.fg3, fontSize: 12, padding: '4px 6px',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <i data-lucide="camera" style={{ width: 12, height: 12 }} />
            Scan code
          </button>
        </div>
      </PScrollArea>

      <PStickyBottom>
        <PPrimaryBtn icon="arrow-right" full>Verify code</PPrimaryBtn>
      </PStickyBottom>
    </PPhone>
  );
}

// ─── FRAME 2 · SECONDARY (in-transit, waiting) ────────────────

function FrameVerifyPostcardInTransit() {
  return (
    <PPhone label="A12.7 Postcard verification — in transit">
      <PHeader title="Postcard verification" />
      <PScrollArea>
        <Postcard delivered={false} />

        {/* Hero copy */}
        <div style={{ textAlign: 'center', padding: '0 8px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 9px', borderRadius: 9999,
            background: P.warning50, color: P.warning700,
            fontSize: 10, fontWeight: 700, letterSpacing: 0.06,
            textTransform: 'uppercase', marginBottom: 10,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: P.warning600,
              animation: 'pulse 1.6s ease-in-out infinite',
            }} />
            In transit
          </div>
          <h2 style={{
            margin: 0, fontSize: 20, fontWeight: 700, color: P.fg1,
            letterSpacing: -0.3, lineHeight: '26px',
          }}>Your card is on the way</h2>
          <p style={{
            margin: '6px auto 0', fontSize: 13, color: P.fg3, lineHeight: '18px',
            maxWidth: 280,
          }}>
            Estimated arrival <b style={{ color: P.fg1, fontWeight: 600 }}>Mon, Oct 12</b>.
            We'll push you a notification when it lands.
          </p>
        </div>

        <StatusTimeline stage={1} />

        {/* Code input — disabled with overlay hint */}
        <div style={{ position: 'relative' }}>
          <CodeInput value="" disabled />
          <div style={{
            position: 'absolute', inset: -4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <div style={{
              background: 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(2px)',
              borderRadius: 10, padding: '5px 11px',
              fontSize: 11, color: P.fg3, fontWeight: 500,
              display: 'inline-flex', alignItems: 'center', gap: 5,
              border: `1px solid ${P.border}`,
            }}>
              <i data-lucide="lock" style={{ width: 11, height: 11 }} />
              Code unlocks on delivery
            </div>
          </div>
        </div>

        {/* Help block */}
        <div style={{
          background: P.surface, border: `1px solid ${P.border}`,
          borderRadius: 14, padding: 4,
          display: 'flex', flexDirection: 'column',
        }}>
          {[
            { icon: 'rotate-cw',  title: 'Resend postcard',  sub: 'If it doesn\'t arrive by Oct 15.', disabled: true },
            { icon: 'edit-3',     title: 'Wrong address?',   sub: 'Update before next print run.' },
            { icon: 'globe',      title: 'Try email instead', sub: 'Available in some regions.' },
          ].map((row, i) => (
            <button key={i} disabled={row.disabled} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 12px', background: 'transparent',
              border: 'none', borderTop: i === 0 ? 'none' : `1px solid ${P.border}`,
              cursor: row.disabled ? 'not-allowed' : 'pointer',
              textAlign: 'left', width: '100%',
              opacity: row.disabled ? 0.5 : 1,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 9, background: P.sunken,
                color: P.fg2, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i data-lucide={row.icon} style={{ width: 14, height: 14 }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: P.fg1, letterSpacing: -0.1 }}>
                  {row.title}
                  {row.disabled && (
                    <span style={{ marginLeft: 6, fontSize: 10, color: P.fg4, fontWeight: 500 }}>
                      · available Oct 15
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: P.fg3, marginTop: 1, lineHeight: '15px' }}>{row.sub}</div>
              </div>
              <i data-lucide="chevron-right" style={{ width: 14, height: 14, color: P.fg4, flexShrink: 0 }} />
            </button>
          ))}
        </div>
      </PScrollArea>

      <PStickyBottom>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
          fontSize: 11.5, color: P.fg3,
        }}>
          <i data-lucide="bell" style={{ width: 12, height: 12 }} />
          <span>You'll be notified the moment it's delivered</span>
        </div>
        <PPrimaryBtn icon="arrow-right" full disabled>Verify code</PPrimaryBtn>
      </PStickyBottom>
    </PPhone>
  );
}

Object.assign(window, { FrameVerifyPostcardDelivered, FrameVerifyPostcardInTransit });
