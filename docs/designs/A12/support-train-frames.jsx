// Pantopus — A12.11 · src/app/support-trains/new.tsx
// Support-train creation wizard — Step 1 (start)
// Frame 1: recipient picked (verified neighbor) + reason + message + privacy
// Frame 2: recipient not on Pantopus — invite-by-contact branch

const PT = {
  primary50:  '#f0f9ff',
  primary100: '#e0f2fe',
  primary200: '#bae6fd',
  primary500: '#0ea5e9',
  primary600: '#0284c7',
  primary700: '#0369a1',
  bg:      '#f6f7f9',
  surface: '#ffffff',
  sunken:  '#f3f4f6',
  raised:  '#f9fafb',
  border:  '#e5e7eb',
  borderStrong: '#d1d5db',
  fg1: '#111827',
  fg2: '#374151',
  fg3: '#6b7280',
  fg4: '#9ca3af',
  success50: '#f0fdf4',
  success100: '#d1fae5',
  success600:'#059669',
  success700:'#047857',
  warning50: '#fffbeb',
  warning100:'#fde68a',
  warning600:'#d97706',
  warning700:'#b45309',
  // identity
  personal:    '#0284c7',
  personalBg:  '#dbeafe',
  home:        '#16a34a',
  homeBg:      '#dcfce7',
  // support-train accent (warm porch tone)
  warm:        '#b45309',
  warmBg:      '#fef3c7',
  warmBorder:  '#fde68a',
  // misc
  rose:        '#e11d48',
  roseBg:      '#fff1f2',
};

// ─── Phone shell ───────────────────────────────────────────────

function SB() {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '16px 28px 0', height: 44, boxSizing: 'border-box',
      fontFamily: '-apple-system, system-ui', fontWeight: 600, fontSize: 15, color: PT.fg1,
    }}>
      <span>9:41</span>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={PT.fg1}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={PT.fg1}/><rect x="9" y="2" width="3" height="9" rx="0.6" fill={PT.fg1}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={PT.fg1}/></svg>
        <svg width="15" height="11" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={PT.fg1}/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={PT.fg1}/><circle cx="7.5" cy="9" r="1.3" fill={PT.fg1}/></svg>
        <svg width="24" height="11" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={PT.fg1} strokeOpacity="0.35" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill={PT.fg1}/><path d="M22.5 3.8v3.4c.6-.2 1-.8 1-1.7s-.4-1.5-1-1.7z" fill={PT.fg1} fillOpacity="0.4"/></svg>
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
        width: '100%', height: '100%', background: PT.bg,
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
        height: 48, boxSizing: 'border-box', background: PT.surface, flexShrink: 0,
      }}>
        <button style={{
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer', color: PT.fg1, padding: 0,
          borderRadius: 8,
        }}>
          <i data-lucide="x" style={{ width: 22, height: 22 }} />
        </button>
        <div style={{
          flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600,
          color: PT.fg1, letterSpacing: -0.15,
        }}>{title}</div>
        <div style={{
          minWidth: 52, padding: '0 12px', fontSize: 12, fontWeight: 500,
          color: PT.fg3, textAlign: 'right', letterSpacing: -0.05,
        }}>{step && total ? `${step} of ${total}` : ''}</div>
      </div>
      {step && total && (
        <div style={{
          display: 'flex', gap: 4, padding: '0 16px 8px',
          background: PT.surface, borderBottom: `1px solid ${PT.border}`,
        }}>
          {Array.from({ length: total }, (_, i) => (
            <div key={i} style={{
              flex: 1, height: 4, borderRadius: 3,
              background: i < step ? PT.warm : PT.border,
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
      padding: `16px 16px ${bottomPad}px`,
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>{children}</div>
  );
}

function StickyBottom({ children }) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'rgba(255,255,255,0.96)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      borderTop: `1px solid ${PT.border}`,
      padding: '12px 16px 28px', zIndex: 10,
      display: 'flex', gap: 10, alignItems: 'center',
    }}>{children}</div>
  );
}

function PrimaryBtn({ children, icon, disabled, flex = 1, full, warm }) {
  return (
    <button disabled={disabled} style={{
      flex, width: full ? '100%' : undefined,
      height: 48, borderRadius: 12, border: 'none',
      background: disabled ? PT.sunken : (warm ? PT.warm : PT.primary600),
      color: disabled ? PT.fg4 : '#fff',
      fontSize: 14, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
      boxShadow: disabled ? 'none' :
        (warm ? '0 6px 16px rgba(180,83,9,0.28)' : '0 6px 16px rgba(2,132,199,0.28)'),
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      letterSpacing: -0.1,
    }}>
      {children}
      {icon && <i data-lucide={icon} style={{ width: 16, height: 16 }} />}
    </button>
  );
}

function GhostBtn({ children, icon, flex }) {
  return (
    <button style={{
      flex,
      height: 48, borderRadius: 12,
      background: PT.surface, color: PT.fg2,
      border: `1px solid ${PT.border}`,
      fontSize: 13, fontWeight: 600, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      letterSpacing: -0.1, padding: '0 14px',
    }}>
      {icon && <i data-lucide={icon} style={{ width: 15, height: 15 }} />}
      {children}
    </button>
  );
}

function OverlineLabel({ children, style = {} }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: PT.fg3, marginBottom: 8, ...style,
    }}>{children}</div>
  );
}

function TrainChip() {
  // A small "Support train" identifier — warm tone
  return (
    <div style={{
      display: 'inline-flex', padding: '4px 10px', borderRadius: 9999,
      background: PT.warmBg, color: PT.warm, fontSize: 10.5, fontWeight: 700,
      letterSpacing: 0.06, textTransform: 'uppercase', alignSelf: 'flex-start',
      alignItems: 'center', gap: 5,
    }}>
      <i data-lucide="heart-handshake" style={{ width: 11, height: 11, strokeWidth: 2.4 }} />
      Support Train
    </div>
  );
}

// ─── Recipient — verified neighbor (Frame 1) ───────────────────

function RecipientCard() {
  return (
    <div>
      <OverlineLabel>Recipient</OverlineLabel>
      <div style={{
        background: PT.surface, border: `1px solid ${PT.border}`, borderRadius: 14,
        padding: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: 'linear-gradient(135deg, #fda4af, #f43f5e)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 700, letterSpacing: -0.3, flexShrink: 0,
          position: 'relative',
        }}>
          MP
          <div style={{
            position: 'absolute', bottom: -2, right: -2,
            width: 18, height: 18, borderRadius: '50%',
            background: PT.success600, color: '#fff', border: '2px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i data-lucide="check" style={{ width: 10, height: 10, strokeWidth: 3.5 }} />
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: PT.fg1, letterSpacing: -0.2 }}>
              Maya Patel
            </div>
            <div style={{
              fontSize: 9.5, fontWeight: 700, color: PT.success700,
              background: PT.success100, padding: '2px 6px', borderRadius: 9999,
              letterSpacing: 0.04, textTransform: 'uppercase',
            }}>Verified</div>
          </div>
          <div style={{ fontSize: 11.5, color: PT.fg3, marginTop: 2, lineHeight: '15px' }}>
            Neighbor · 418 Elm St, Apt 2
          </div>
          <div style={{
            fontSize: 10.5, color: PT.fg4, marginTop: 1,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <i data-lucide="users" style={{ width: 10, height: 10 }} />
            3 mutual friends on your block
          </div>
        </div>
        <button style={{
          fontSize: 12, fontWeight: 600, color: PT.primary600,
          background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px',
          letterSpacing: -0.05,
        }}>Change</button>
      </div>
    </div>
  );
}

// ─── Reason picker ─────────────────────────────────────────────

function ReasonPicker({ selected }) {
  const reasons = [
    { id: 'baby',     label: 'New baby',          icon: 'baby' },
    { id: 'surgery',  label: 'Surgery recovery',  icon: 'stethoscope' },
    { id: 'illness',  label: 'Illness',           icon: 'thermometer' },
    { id: 'loss',     label: 'Bereavement',       icon: 'flower-2' },
    { id: 'moving',   label: 'Just moved in',     icon: 'truck' },
    { id: 'other',    label: 'Something else',    icon: 'more-horizontal' },
  ];
  return (
    <div>
      <OverlineLabel>What's the occasion?</OverlineLabel>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
      }}>
        {reasons.map((r) => {
          const active = r.id === selected;
          return (
            <button key={r.id} style={{
              padding: '12px 12px',
              background: active ? PT.warmBg : PT.surface,
              border: `1.5px solid ${active ? PT.warm : PT.border}`,
              borderRadius: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
              boxShadow: active ? '0 2px 6px rgba(180,83,9,0.12)' : '0 1px 2px rgba(0,0,0,0.03)',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: active ? PT.warm : PT.sunken,
                color: active ? '#fff' : PT.fg2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i data-lucide={r.icon} style={{ width: 14, height: 14, strokeWidth: 2.2 }} />
              </div>
              <div style={{
                fontSize: 12.5, fontWeight: active ? 700 : 600,
                color: active ? PT.warm : PT.fg1, letterSpacing: -0.1,
                lineHeight: '15px',
              }}>{r.label}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Context message field ─────────────────────────────────────

function MessageField() {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <OverlineLabel style={{ marginBottom: 0 }}>Short note</OverlineLabel>
        <div style={{ fontSize: 10.5, color: PT.fg4, letterSpacing: -0.05 }}>Optional · helps people offer the right thing</div>
      </div>
      <div style={{
        background: PT.surface, border: `1px solid ${PT.border}`, borderRadius: 12,
        padding: '12px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      }}>
        <div style={{ fontSize: 13.5, color: PT.fg1, lineHeight: '20px', letterSpacing: -0.05 }}>
          Maya's home after knee surgery on the 12th. She'll be off her feet for ~2 weeks. Meals, dog walks for Pixel, and a few rides to PT would mean the world.
        </div>
        <div style={{
          marginTop: 8, display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 10.5, color: PT.fg4, letterSpacing: -0.05,
        }}>
          <i data-lucide="lock" style={{ width: 10, height: 10 }} />
          Shared only with people you invite
        </div>
      </div>
    </div>
  );
}

// ─── Visibility row ────────────────────────────────────────────

function VisibilityRow() {
  return (
    <div style={{
      background: PT.surface, border: `1px solid ${PT.border}`, borderRadius: 12,
      overflow: 'hidden',
    }}>
      {[
        { icon: 'users-round', label: 'Invite-only',  sub: 'Only people you add can see and sign up', on: true },
        { icon: 'home',        label: 'Show on home block', sub: 'Verified neighbors at 412 Elm can see and offer', on: false },
      ].map((row, i, arr) => (
        <div key={row.label} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 12px',
          borderBottom: i < arr.length - 1 ? `1px solid ${PT.border}` : 'none',
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: row.on ? PT.warmBg : PT.sunken,
            color: row.on ? PT.warm : PT.fg3,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i data-lucide={row.icon} style={{ width: 14, height: 14, strokeWidth: 2.2 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: PT.fg1, letterSpacing: -0.1 }}>{row.label}</div>
            <div style={{ fontSize: 11, color: PT.fg3, marginTop: 1, lineHeight: '15px' }}>{row.sub}</div>
          </div>
          <div style={{
            width: 32, height: 18, borderRadius: 9,
            background: row.on ? PT.warm : PT.borderStrong,
            position: 'relative', flexShrink: 0,
          }}>
            <div style={{
              position: 'absolute', top: 2, left: row.on ? 16 : 2,
              width: 14, height: 14, borderRadius: '50%', background: '#fff',
              boxShadow: '0 1px 2px rgba(0,0,0,0.2)', transition: 'left 120ms',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Wizard preview rail ───────────────────────────────────────

function StepRail({ current }) {
  const steps = [
    { n: 1, label: 'Recipient' },
    { n: 2, label: 'Type' },
    { n: 3, label: 'Dates' },
    { n: 4, label: 'Invites' },
    { n: 5, label: 'Review' },
  ];
  return (
    <div>
      <OverlineLabel style={{ marginBottom: 6 }}>You're on step {current} of 5</OverlineLabel>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        background: PT.surface, border: `1px solid ${PT.border}`, borderRadius: 12,
        padding: '10px 12px',
      }}>
        {steps.map((s, i) => {
          const done = s.n < current, active = s.n === current;
          return (
            <React.Fragment key={s.n}>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                flex: '0 0 auto',
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: done ? PT.warm : (active ? PT.warm : PT.sunken),
                  color: (done || active) ? '#fff' : PT.fg4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10.5, fontWeight: 700, letterSpacing: -0.1,
                  border: active ? `2px solid ${PT.warmBg}` : 'none',
                  boxShadow: active ? `0 0 0 2px ${PT.warm}` : 'none',
                }}>{done ? <i data-lucide="check" style={{ width: 11, height: 11, strokeWidth: 3 }} /> : s.n}</div>
                <div style={{
                  fontSize: 9.5, fontWeight: active ? 700 : 500,
                  color: active ? PT.warm : (done ? PT.fg2 : PT.fg4),
                  letterSpacing: -0.05,
                }}>{s.label}</div>
              </div>
              {i < steps.length - 1 && (
                <div style={{
                  flex: 1, height: 2, background: s.n < current ? PT.warm : PT.border,
                  marginBottom: 14, borderRadius: 2,
                }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ─── FRAME 1 · POPULATED (canonical start) ─────────────────────

function FrameTrainStart() {
  return (
    <Phone label="A12.11 Support train — Recipient & reason">
      <WizardHeader title="Start a support train" step={1} total={5} />
      <ScrollArea>
        <TrainChip />

        <div>
          <h2 style={{
            margin: 0, fontSize: 22, fontWeight: 700, color: PT.fg1,
            letterSpacing: -0.3, lineHeight: '28px',
          }}>Who is this for, and why?</h2>
          <p style={{
            margin: '6px 0 0', fontSize: 13.5, color: PT.fg3, lineHeight: '19px',
          }}>
            A support train coordinates meals, rides, and help around someone going through something. Pick the person and the moment — we'll handle the schedule.
          </p>
        </div>

        <RecipientCard />
        <ReasonPicker selected="surgery" />
        <MessageField />
        <VisibilityRow />
        <StepRail current={1} />
      </ScrollArea>

      <StickyBottom>
        <PrimaryBtn warm icon="arrow-right" full>Continue · pick a type</PrimaryBtn>
      </StickyBottom>
    </Phone>
  );
}

// ─── FRAME 2 · SECONDARY (recipient not on Pantopus) ───────────

function InviteRecipientCard() {
  return (
    <div>
      <OverlineLabel>Recipient</OverlineLabel>
      <div style={{
        background: PT.surface, border: `1px solid ${PT.border}`, borderRadius: 14,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden',
      }}>
        {/* Typed search row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 12px',
          borderBottom: `1px solid ${PT.border}`,
        }}>
          <i data-lucide="search" style={{ width: 14, height: 14, color: PT.fg4 }} />
          <div style={{ flex: 1, fontSize: 13.5, color: PT.fg1, letterSpacing: -0.1, fontWeight: 500 }}>
            David Chen
          </div>
          <button style={{
            width: 22, height: 22, borderRadius: '50%', background: PT.sunken,
            border: 'none', cursor: 'pointer', color: PT.fg3,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
          }}>
            <i data-lucide="x" style={{ width: 12, height: 12 }} />
          </button>
        </div>

        {/* No match found */}
        <div style={{
          padding: '12px 12px',
          background: PT.warning50,
          borderBottom: `1px solid ${PT.warning100}`,
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: PT.warning600, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <i data-lucide="user-search" style={{ width: 14, height: 14, strokeWidth: 2.2 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: PT.warning700, letterSpacing: -0.1 }}>
              No verified neighbor by that name
            </div>
            <div style={{ fontSize: 11.5, color: PT.warm, marginTop: 2, lineHeight: '16px' }}>
              We searched verified addresses within 0.5 mi of yours. You can still start a train and invite David directly.
            </div>
          </div>
        </div>

        {/* Invite options */}
        <div style={{ padding: '4px 0' }}>
          {[
            { icon: 'phone',  label: 'Invite by phone', value: '+1 (415) 555-0142', tag: 'Recommended' },
            { icon: 'mail',   label: 'Invite by email', value: 'd.chen@example.com', tag: null },
          ].map((opt, i, arr) => (
            <div key={opt.label} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 12px',
              borderBottom: i < arr.length - 1 ? `1px solid ${PT.border}` : 'none',
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                background: PT.primary50, color: PT.primary600,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i data-lucide={opt.icon} style={{ width: 14, height: 14, strokeWidth: 2.2 }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, marginBottom: 1,
                }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: PT.fg1, letterSpacing: -0.1 }}>{opt.label}</div>
                  {opt.tag && (
                    <div style={{
                      fontSize: 9, fontWeight: 700, color: PT.success700,
                      background: PT.success100, padding: '1px 6px', borderRadius: 9999,
                      letterSpacing: 0.04, textTransform: 'uppercase',
                    }}>{opt.tag}</div>
                  )}
                </div>
                <div style={{
                  fontSize: 12, color: PT.fg3, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  letterSpacing: -0.1,
                }}>{opt.value}</div>
              </div>
              <i data-lucide="chevron-right" style={{ width: 14, height: 14, color: PT.fg4 }} />
            </div>
          ))}
        </div>
      </div>

      <div style={{
        marginTop: 8, padding: '0 4px',
        fontSize: 11, color: PT.fg3, letterSpacing: -0.05, lineHeight: '16px',
        display: 'flex', gap: 6, alignItems: 'flex-start',
      }}>
        <i data-lucide="info" style={{ width: 12, height: 12, color: PT.fg4, flexShrink: 0, marginTop: 1 }} />
        <span>David gets a link to confirm the train and choose what's visible. He doesn't need a Pantopus account to receive help.</span>
      </div>
    </div>
  );
}

function FrameTrainInvite() {
  return (
    <Phone label="A12.11 Support train — Invite non-member">
      <WizardHeader title="Start a support train" step={1} total={5} />
      <ScrollArea>
        <TrainChip />

        <div>
          <h2 style={{
            margin: 0, fontSize: 22, fontWeight: 700, color: PT.fg1,
            letterSpacing: -0.3, lineHeight: '28px',
          }}>Who is this for, and why?</h2>
          <p style={{
            margin: '6px 0 0', fontSize: 13.5, color: PT.fg3, lineHeight: '19px',
          }}>
            Don't see them in the verified directory? You can still start a train — we'll invite them to claim it.
          </p>
        </div>

        <InviteRecipientCard />

        {/* Reason still required */}
        <ReasonPicker selected="baby" />

        {/* Visibility hint adapted to non-member case */}
        <div style={{
          background: PT.sunken, borderRadius: 12, padding: '10px 12px',
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <i data-lucide="shield" style={{ width: 14, height: 14, color: PT.fg3, marginTop: 1, flexShrink: 0 }} />
          <div style={{ fontSize: 11.5, color: PT.fg2, lineHeight: '16px', letterSpacing: -0.05 }}>
            <b style={{ color: PT.fg1, fontWeight: 700 }}>Invite-only by default.</b> The train stays private until David accepts. Other neighbors won't see it on the block.
          </div>
        </div>

        <StepRail current={1} />
      </ScrollArea>

      <StickyBottom>
        <GhostBtn icon="search">Search again</GhostBtn>
        <PrimaryBtn warm icon="send" flex={1.4}>Send invite &amp; continue</PrimaryBtn>
      </StickyBottom>
    </Phone>
  );
}

Object.assign(window, { FrameTrainStart, FrameTrainInvite });
