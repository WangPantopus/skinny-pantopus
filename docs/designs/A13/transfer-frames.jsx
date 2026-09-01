// Pantopus — A13.4 · Transfer ownership
// File: src/app/homes/[id]/owners/transfer.tsx
// Archetype: A13 — Form (single screen), field-heavy variant.
// A consequential, irreversible form. Inherits Phone / TopBar / Section / Card /
// Input / Slider / Textarea / OverlineLabel from form-frames.jsx.
//
// Two frames:
//   FrameTransferReady   — populated: recipient picked, 25% slider, confirmation typed, CTA armed
//   FrameTransferConfirm — secondary: final hold-to-confirm sheet with diff + Face ID

const {
  F, Phone, TopBar, OverlineLabel, FieldLabel,
  Input, Slider, Textarea, Section, ScrollArea, Card,
} = window;

// ─── Home context strip ────────────────────────────────────────

function HomeStrip() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px', background: F.muted,
      border: `1px solid ${F.border}`, borderRadius: 10,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 9,
        background: 'linear-gradient(135deg,#22c55e,#15803d)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', flexShrink: 0,
      }}>
        <i data-lucide="home" style={{ width: 15, height: 15 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: F.fg1, letterSpacing: -0.1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>412 Elm Street</div>
        <div style={{ fontSize: 11, color: F.fg3, marginTop: 1 }}>You hold 60% · 3 co-owners</div>
      </div>
      <span style={{
        fontSize: 9.5, fontWeight: 700, letterSpacing: 0.1,
        color: '#b45309', background: '#fef3c7',
        border: '1px solid #fde68a',
        padding: '3px 7px', borderRadius: 4, textTransform: 'uppercase',
        display: 'inline-flex', alignItems: 'center', gap: 3,
      }}>
        <i data-lucide="alert-triangle" style={{ width: 9, height: 9 }} />
        Irreversible
      </span>
    </div>
  );
}

// ─── Recipient search field ────────────────────────────────────

function SearchField({ value }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      height: 44, padding: '0 12px',
      background: F.surface, border: `1px solid ${F.border}`,
      borderRadius: 10,
    }}>
      <i data-lucide="search" style={{ width: 16, height: 16, color: F.fg3, flexShrink: 0 }} />
      <span style={{
        flex: 1, fontSize: 14, color: value ? F.fg1 : F.fg4,
        fontWeight: value ? 500 : 400, letterSpacing: -0.1,
      }}>{value || 'Search neighbors by name, email, or @handle'}</span>
      {value && (
        <button style={{
          width: 20, height: 20, borderRadius: '50%', border: 'none',
          background: F.sunken, color: F.fg3, padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}>
          <i data-lucide="x" style={{ width: 12, height: 12 }} />
        </button>
      )}
    </div>
  );
}

// ─── Recipient card (selected result) ──────────────────────────

function RecipientCard() {
  return (
    <div style={{
      background: F.surface, border: `1.5px solid ${F.primary600}`,
      borderRadius: 12, padding: 14,
      boxShadow: '0 0 0 3px rgba(2,132,199,0.10), 0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'linear-gradient(135deg,#7c3aed,#5b21b6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 17, fontWeight: 700, letterSpacing: -0.3,
            boxShadow: '0 4px 10px rgba(91,33,182,0.18)',
          }}>MF</div>
          <div style={{
            position: 'absolute', right: -2, bottom: -2,
            width: 17, height: 17, borderRadius: '50%',
            background: F.home, border: '2px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i data-lucide="check" style={{ width: 9, height: 9, color: '#fff', strokeWidth: 4 }} />
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
          }}>
            <span style={{
              fontSize: 15, fontWeight: 600, color: F.fg1, letterSpacing: -0.15,
            }}>Maya Fortune</span>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 0.08,
              color: F.success, background: F.successBg,
              border: '1px solid #a7f3d0',
              padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase',
            }}>Verified</span>
          </div>
          <div style={{
            fontSize: 12, color: F.fg3, marginTop: 2,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <i data-lucide="at-sign" style={{ width: 11, height: 11 }} />
            mayaf · maya.fortune@pantopus.app
          </div>
        </div>
        {/* clear / change */}
        <button style={{
          background: 'transparent', border: 'none', padding: '4px 6px',
          color: F.primary600, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          letterSpacing: -0.1,
        }}>Change</button>
      </div>

      {/* meta strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1,
        marginTop: 12, background: F.borderSub,
        border: `1px solid ${F.borderSub}`, borderRadius: 8, overflow: 'hidden',
      }}>
        <Meta icon="home"          label="Owns" value="2 homes" />
        <Meta icon="shield-check"  label="On Pantopus" value="4 yrs" />
        <Meta icon="users"         label="Mutual" value="5" />
      </div>
    </div>
  );
}

function Meta({ icon, label, value }) {
  return (
    <div style={{
      background: F.surface, padding: '8px 4px', textAlign: 'center',
    }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        color: F.fg3, fontSize: 10, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: 0.04,
      }}>
        <i data-lucide={icon} style={{ width: 10, height: 10 }} />
        {label}
      </div>
      <div style={{
        fontSize: 12.5, fontWeight: 600, color: F.fg1,
        marginTop: 2, letterSpacing: -0.1,
      }}>{value}</div>
    </div>
  );
}

// ─── Before / After stake bars ─────────────────────────────────

function StakeBar({ segments, total = 100 }) {
  return (
    <div style={{
      display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden',
      background: F.sunken, border: `1px solid ${F.border}`,
    }}>
      {segments.map((s, i) => (
        <div key={i} title={`${s.who} ${s.pct}%`} style={{
          flexBasis: `${(s.pct / total) * 100}%`,
          background: s.color,
          borderRight: i < segments.length - 1 ? '1px solid rgba(255,255,255,0.7)' : 'none',
        }} />
      ))}
    </div>
  );
}

function SplitDiff({ amount }) {
  const before = [
    { who: 'You',     pct: 60, color: F.primary600 },
    { who: 'Mateo',   pct: 25, color: '#fb923c' },
    { who: 'Jin',     pct: 15, color: '#10b981' },
  ];
  const after = [
    { who: 'You',     pct: 60 - amount, color: F.primary600 },
    { who: 'Maya',    pct: amount,      color: '#7c3aed' },
    { who: 'Mateo',   pct: 25,          color: '#fb923c' },
    { who: 'Jin',     pct: 15,          color: '#10b981' },
  ];

  return (
    <div style={{
      padding: '12px 14px', background: F.surface,
      border: `1px solid ${F.border}`, borderRadius: 12,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {/* Before row */}
      <DiffRow label="Before" segments={before} legend={[
        { who: 'You', pct: 60, color: F.primary600 },
        { who: 'Mateo', pct: 25, color: '#fb923c' },
        { who: 'Jin', pct: 15, color: '#10b981' },
      ]} />

      {/* arrow */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0',
        color: F.fg4,
      }}>
        <div style={{ flex: 1, height: 1, background: F.borderSub }} />
        <i data-lucide="arrow-down" style={{ width: 14, height: 14 }} />
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.06, textTransform: 'uppercase' }}>
          Move {amount}% → Maya
        </span>
        <div style={{ flex: 1, height: 1, background: F.borderSub }} />
      </div>

      {/* After row */}
      <DiffRow label="After" segments={after} legend={[
        { who: 'You',   pct: 60 - amount, color: F.primary600, delta: -amount },
        { who: 'Maya',  pct: amount,      color: '#7c3aed',    delta: +amount, isNew: true },
        { who: 'Mateo', pct: 25,          color: '#fb923c' },
        { who: 'Jin',   pct: 15,          color: '#10b981' },
      ]} />
    </div>
  );
}

function DiffRow({ label, segments, legend }) {
  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 6,
      }}>
        <span style={{
          fontSize: 10.5, fontWeight: 600, color: F.fg3,
          textTransform: 'uppercase', letterSpacing: 0.06,
        }}>{label}</span>
      </div>
      <StakeBar segments={segments} />
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8,
        fontSize: 11, color: F.fg2,
      }}>
        {legend.map(p => (
          <span key={p.who} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
            <span style={{ fontWeight: 600, color: F.fg1 }}>{p.who}</span>
            <span style={{
              color: F.fg3,
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontVariantNumeric: 'tabular-nums',
              fontSize: 11,
            }}>{p.pct}%</span>
            {typeof p.delta === 'number' && (
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: p.delta < 0 ? F.error600 : F.success600,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: -0.05,
              }}>
                {p.delta > 0 ? `+${p.delta}` : p.delta}
              </span>
            )}
            {p.isNew && (
              <span style={{
                fontSize: 8.5, fontWeight: 700, letterSpacing: 0.08,
                color: '#5b21b6', background: '#ede9fe',
                padding: '1px 4px', borderRadius: 3, textTransform: 'uppercase',
              }}>New</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Sticky CTA ────────────────────────────────────────────────

function StickyCTA({ label, disabled, danger }) {
  const bg = disabled ? '#e5e7eb'
           : danger   ? F.error600
                      : F.primary600;
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'rgba(255,255,255,0.96)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      borderTop: `1px solid ${F.border}`,
      padding: '12px 16px 28px', zIndex: 10,
    }}>
      <button disabled={disabled} style={{
        width: '100%', height: 48, borderRadius: 12, border: 'none',
        background: bg, color: disabled ? F.fg4 : '#fff',
        fontSize: 15, fontWeight: 600, letterSpacing: -0.1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled ? 'none'
                  : danger ? '0 6px 16px rgba(220,38,38,0.28)'
                           : '0 6px 16px rgba(2,132,199,0.28)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <i data-lucide="arrow-right-left" style={{ width: 17, height: 17 }} />
        {label}
      </button>
      <div style={{
        textAlign: 'center', fontSize: 11, color: F.fg3,
        marginTop: 6, letterSpacing: -0.05,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: 4, width: '100%',
      }}>
        <i data-lucide="lock" style={{ width: 11, height: 11 }} />
        Confirmed with Face ID after tap
      </div>
    </div>
  );
}

// ─── FRAME 1 · POPULATED (Ready) ───────────────────────────────

function FrameTransferReady() {
  const amount = 25;
  return (
    <Phone>
      <TopBar title="Transfer ownership" />
      <ScrollArea bottomPad={140}>

        <HomeStrip />

        {/* Recipient search */}
        <Section overline="Recipient">
          <SearchField value="maya fortune" />
          <RecipientCard />
        </Section>

        {/* % to transfer */}
        <Section overline={`Share to transfer · ${amount}%`}>
          <div style={{
            padding: '14px 14px 12px',
            background: F.surface, border: `1px solid ${F.border}`,
            borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <Slider value={amount} max={60} />
            <div style={{
              display: 'flex', justifyContent: 'space-between', marginTop: 10,
              fontSize: 10.5, color: F.fg3,
              fontFamily: 'ui-monospace, Menlo, monospace',
            }}>
              <span>1%</span>
              <span>Max 60% (your stake)</span>
            </div>
            {/* preset chips */}
            <div style={{
              display: 'flex', gap: 6, marginTop: 12,
            }}>
              {[10, 25, 33, 50].map(p => (
                <button key={p} style={{
                  flex: 1, height: 30, borderRadius: 8,
                  background: p === amount ? F.primary50 : F.surface,
                  color:      p === amount ? F.primary700 : F.fg2,
                  border:    `1px solid ${p === amount ? F.primary100 : F.border}`,
                  fontSize: 12, fontWeight: 600, letterSpacing: -0.05,
                  cursor: 'pointer',
                  fontFamily: 'ui-monospace, Menlo, monospace',
                }}>{p}%</button>
              ))}
            </div>
          </div>

          <SplitDiff amount={amount} />
        </Section>

        {/* Confirmation typed */}
        <Section overline="Confirmation">
          <div>
            <FieldLabel required>Type <span style={{
              fontFamily: 'ui-monospace, Menlo, monospace',
              background: F.sunken, padding: '1px 5px', borderRadius: 3,
              color: F.fg1, fontSize: 11, letterSpacing: 0,
            }}>TRANSFER</span> to confirm</FieldLabel>
            <Input value="TRANSFER" state="valid" type="text" />
          </div>
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            padding: '10px 12px', background: '#fffbeb',
            border: '1px solid #fde68a', borderRadius: 10,
          }}>
            <i data-lucide="info" style={{
              width: 14, height: 14, color: '#b45309',
              marginTop: 2, flexShrink: 0,
            }} />
            <div style={{ fontSize: 11.5, color: '#78350f', lineHeight: '16px' }}>
              Mateo and Jin will be notified after this transfer. You cannot reclaim the {amount}% without Maya's signed transfer back.
            </div>
          </div>
        </Section>

      </ScrollArea>
      <StickyCTA label={`Transfer ${amount}% to Maya`} />
    </Phone>
  );
}

// ─── FRAME 2 · SECONDARY · FINAL CONFIRM SHEET ─────────────────

function ConfirmSheet() {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 30,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }}>
      {/* scrim */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(17,24,39,0.5)',
        backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
      }} />

      <div style={{
        position: 'relative', background: F.surface,
        borderTopLeftRadius: 22, borderTopRightRadius: 22,
        padding: '10px 16px 28px',
        boxShadow: '0 -12px 32px rgba(17,24,39,0.18)',
      }}>
        <div style={{
          width: 38, height: 4, borderRadius: 2, background: F.borderStrong,
          margin: '0 auto 14px',
        }} />

        {/* Title — Face ID prompt */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 8, marginBottom: 16,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'linear-gradient(135deg,#111827,#374151)',
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 20px rgba(17,24,39,0.25)',
          }}>
            <i data-lucide="scan-face" style={{ width: 28, height: 28 }} />
          </div>
          <div style={{
            fontSize: 17, fontWeight: 700, color: F.fg1,
            letterSpacing: -0.2, textAlign: 'center',
          }}>Final confirmation</div>
          <div style={{
            fontSize: 12.5, color: F.fg3, textAlign: 'center', lineHeight: '17px',
            maxWidth: 280,
          }}>
            Face ID will sign the transfer and record it on the home's chain.
          </div>
        </div>

        {/* Compact diff */}
        <div style={{
          padding: '12px 14px', background: F.muted,
          border: `1px solid ${F.border}`, borderRadius: 10,
          marginBottom: 14,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            paddingBottom: 10, borderBottom: `1px solid ${F.borderSub}`,
          }}>
            <Avatar bg="linear-gradient(135deg,#0ea5e9,#0369a1)" initials="DK" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: F.fg3, fontWeight: 500 }}>From</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: F.fg1, letterSpacing: -0.1 }}>You · Daniel Kovács</div>
            </div>
            <Pct from={60} to={35} negative />
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, paddingTop: 10,
          }}>
            <Avatar bg="linear-gradient(135deg,#7c3aed,#5b21b6)" initials="MF" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: F.fg3, fontWeight: 500 }}>To</div>
              <div style={{
                fontSize: 13.5, fontWeight: 600, color: F.fg1, letterSpacing: -0.1,
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}>
                Maya Fortune
                <i data-lucide="badge-check" style={{ width: 13, height: 13, color: F.success600 }} />
              </div>
            </div>
            <Pct from={0} to={25} positive />
          </div>
        </div>

        {/* Legal */}
        <div style={{
          fontSize: 11, color: F.fg3, lineHeight: '16px', marginBottom: 14,
          padding: '10px 12px', background: F.surface,
          border: `1px solid ${F.border}`, borderRadius: 10,
        }}>
          <span style={{ fontWeight: 600, color: F.fg1 }}>By confirming with Face ID:</span> you grant Maya 25% ownership of 412 Elm St. and forfeit that share. Mateo &amp; Jin keep their stakes. Recorded on chain at <span style={{
            fontFamily: 'ui-monospace, Menlo, monospace', color: F.fg2,
          }}>14:23 May 26</span>.
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{
            flex: 1, height: 48, borderRadius: 12,
            background: F.surface, color: F.fg1,
            border: `1px solid ${F.border}`,
            fontSize: 14, fontWeight: 600, letterSpacing: -0.1, cursor: 'pointer',
          }}>Cancel</button>
          <button style={{
            flex: 1.5, height: 48, borderRadius: 12, border: 'none',
            background: F.primary600, color: '#fff',
            fontSize: 14, fontWeight: 600, letterSpacing: -0.1, cursor: 'pointer',
            boxShadow: '0 6px 16px rgba(2,132,199,0.28)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          }}>
            <i data-lucide="scan-face" style={{ width: 16, height: 16 }} />
            Confirm with Face ID
          </button>
        </div>
      </div>
    </div>
  );
}

function Avatar({ bg, initials }) {
  return (
    <div style={{
      width: 34, height: 34, borderRadius: '50%', background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: -0.2,
      flexShrink: 0,
    }}>{initials}</div>
  );
}

function Pct({ from, to, negative, positive }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontFamily: 'ui-monospace, Menlo, monospace',
      fontVariantNumeric: 'tabular-nums',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 12, color: F.fg4, textDecoration: 'line-through' }}>{from}%</span>
      <i data-lucide="arrow-right" style={{ width: 11, height: 11, color: F.fg4 }} />
      <span style={{
        fontSize: 14, fontWeight: 700, letterSpacing: -0.2,
        color: positive ? F.success600 : negative ? F.fg1 : F.fg1,
      }}>{to}%</span>
    </div>
  );
}

function FrameTransferConfirm() {
  return (
    <Phone>
      <TopBar title="Transfer ownership" />
      <ScrollArea bottomPad={140}>
        <HomeStrip />
        <Section overline="Recipient">
          <SearchField value="maya fortune" />
          <RecipientCard />
        </Section>
        <Section overline="Share to transfer · 25%">
          <SplitDiff amount={25} />
        </Section>
      </ScrollArea>
      <ConfirmSheet />
    </Phone>
  );
}

Object.assign(window, { FrameTransferReady, FrameTransferConfirm });
