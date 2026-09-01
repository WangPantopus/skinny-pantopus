// Pantopus — A13.15 · Disambiguate mail recipient
// File: src/app/mailbox/disambiguate.tsx
//
// Field-heavy variant of the Form archetype. The user has just scanned a
// piece of physical mail addressed to "M. Kovács" or similar; the OCR pass
// returned a name that matches multiple residents at the address. This
// screen pairs the captured image with a ranked candidate list so the
// recipient can be resolved in one tap.
//
// Two frames:
//   FrameDisambiguateStrong — clean scan · "97% read confidence" · one
//       strong match pre-selected · Confirm enabled.
//   FrameDisambiguateUnclear — partial / smudged scan · "31% read
//       confidence" · all candidates weak · no auto-pick · fallback
//       row offers Re-scan / Type name / Return to sender / Junk ·
//       Confirm disabled until a path is chosen.
//
// The two frames share the same scaffold (image preview · OCR strip ·
// candidates · sticky CTA) — the secondary state is the same surface in a
// degraded-input mode.

const {
  F, Phone, TopBar, OverlineLabel, FieldLabel, Section, ScrollArea, Card,
} = window;

// ─── Envelope preview ─────────────────────────────────────────

// Clean scan — addressed clearly to "Maria K." at 412 Elm St
function EnvelopeClean() {
  return (
    <div style={{
      aspectRatio: '16 / 10',
      background: 'linear-gradient(135deg, #f8f4ec 0%, #f0e7d3 100%)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* return service line */}
      <div style={{
        position: 'absolute', left: 16, top: 16, right: 88,
        fontFamily: 'ui-monospace, Menlo, monospace',
      }}>
        <div style={{ fontSize: 9, color: '#6b5f4a', letterSpacing: 0.5, marginBottom: 5 }}>
          GLOBAL BANK · RETURN SERVICE
        </div>
        <div style={{ height: 2, width: 90, background: '#c2b48a', marginBottom: 14 }} />
        <div style={{ fontSize: 13, color: '#2d2414', fontWeight: 600, lineHeight: '17px' }}>
          Maria K.<br/>
          <span style={{ fontSize: 11, fontWeight: 500 }}>412 Elm St, Apt 3B</span><br/>
          <span style={{ fontSize: 11, fontWeight: 500 }}>Elm Park, NY 10013</span>
        </div>
      </div>
      {/* postage */}
      <div style={{
        position: 'absolute', right: 14, top: 14,
        width: 54, height: 64, border: '1.5px dashed #a08d5e',
        background: 'rgba(255,255,255,0.5)', borderRadius: 3,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: '#6b5f4a', fontFamily: 'ui-monospace, Menlo, monospace',
        transform: 'rotate(3deg)',
      }}>
        <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: 0.3 }}>USA</div>
        <div style={{ fontSize: 14, fontWeight: 800 }}>68¢</div>
        <div style={{ fontSize: 6, opacity: 0.7 }}>FOREVER</div>
      </div>
      {/* OCR overlay — bounding box on the name */}
      <div style={{
        position: 'absolute', left: 14, top: 53,
        width: 64, height: 18,
        border: `1.5px solid ${F.primary600}`,
        background: 'rgba(2,132,199,0.08)',
        borderRadius: 2,
      }}>
        <div style={{
          position: 'absolute', left: -1, top: -16,
          fontSize: 8, fontWeight: 700, letterSpacing: 0.3,
          color: '#fff', background: F.primary600,
          padding: '1px 5px', borderRadius: 2,
          textTransform: 'uppercase', fontFamily: 'ui-monospace, Menlo, monospace',
        }}>name · 97%</div>
      </div>
    </div>
  );
}

// Damaged scan — water stain + smudge over the name area
function EnvelopeUnclear() {
  return (
    <div style={{
      aspectRatio: '16 / 10',
      background: 'linear-gradient(135deg, #ede4d0 0%, #d8c89e 100%)',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', left: 16, top: 16, right: 88,
        fontFamily: 'ui-monospace, Menlo, monospace',
      }}>
        <div style={{ fontSize: 9, color: '#6b5f4a', letterSpacing: 0.5, marginBottom: 5 }}>
          ELM PARK UTILITIES · BILL ENCLOSED
        </div>
        <div style={{ height: 2, width: 90, background: '#a08960', marginBottom: 14 }} />
        <div style={{ fontSize: 13, color: '#2d2414', fontWeight: 600, lineHeight: '17px' }}>
          M<span style={{ opacity: 0.2 }}>___</span>a K<span style={{ opacity: 0.2 }}>___</span><br/>
          <span style={{ fontSize: 11, fontWeight: 500 }}>4<span style={{ opacity: 0.25 }}>__</span> Elm St</span><br/>
          <span style={{ fontSize: 11, fontWeight: 500 }}>Elm Park, NY 10013</span>
        </div>
      </div>
      {/* postage */}
      <div style={{
        position: 'absolute', right: 14, top: 14,
        width: 54, height: 64, border: '1.5px dashed #a08d5e',
        background: 'rgba(255,255,255,0.4)', borderRadius: 3,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: '#6b5f4a', fontFamily: 'ui-monospace, Menlo, monospace',
        transform: 'rotate(3deg)',
      }}>
        <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: 0.3 }}>USA</div>
        <div style={{ fontSize: 14, fontWeight: 800 }}>68¢</div>
        <div style={{ fontSize: 6, opacity: 0.7 }}>FOREVER</div>
      </div>
      {/* water stain — soft brown radial blob covering part of the name */}
      <div style={{
        position: 'absolute', left: 36, top: 36, width: 120, height: 60,
        borderRadius: '50%',
        background: 'radial-gradient(ellipse at 40% 50%, rgba(120,53,15,0.55) 0%, rgba(120,53,15,0.25) 45%, rgba(120,53,15,0) 75%)',
        filter: 'blur(2px)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', left: 60, top: 52, width: 70, height: 28,
        borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(68,32,5,0.6), rgba(68,32,5,0) 70%)',
        filter: 'blur(1px)',
        pointerEvents: 'none',
      }} />
      {/* OCR overlay — amber low-confidence bounding box */}
      <div style={{
        position: 'absolute', left: 14, top: 53,
        width: 64, height: 18,
        border: `1.5px dashed #d97706`,
        background: 'rgba(217,119,6,0.12)',
        borderRadius: 2,
      }}>
        <div style={{
          position: 'absolute', left: -1, top: -16,
          fontSize: 8, fontWeight: 700, letterSpacing: 0.3,
          color: '#fff', background: '#d97706',
          padding: '1px 5px', borderRadius: 2,
          textTransform: 'uppercase', fontFamily: 'ui-monospace, Menlo, monospace',
        }}>name · 31%</div>
      </div>
      {/* re-scan tip ribbon */}
      <div style={{
        position: 'absolute', right: 10, bottom: 10,
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '4px 8px', borderRadius: 9999,
        background: 'rgba(17,24,39,0.8)', color: '#fff',
        fontSize: 10, fontWeight: 600, letterSpacing: -0.05,
        backdropFilter: 'blur(4px)',
      }}>
        <i data-lucide="alert-triangle" style={{ width: 10, height: 10 }} />
        Low light · smudge
      </div>
    </div>
  );
}

// ─── OCR strip ────────────────────────────────────────────────

function OcrStrip({ tone = 'good', detected, confidence, sub }) {
  const palette = tone === 'good'
    ? { bg: F.primary50, border: '#bae6fd', fg: F.fg2, accent: F.primary600, icon: 'scan-text', strong: F.fg1, pillBg: F.successBg, pillFg: F.success, pillBorder: '#a7f3d0' }
    : { bg: '#fffbeb', border: '#fde68a', fg: '#78350f', accent: '#d97706', icon: 'scan-line', strong: '#451a03', pillBg: '#fef3c7', pillFg: '#92400e', pillBorder: '#fcd34d' };
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 10,
      background: palette.bg, border: `1px solid ${palette.border}`,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: '#fff', border: `1px solid ${palette.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: palette.accent, flexShrink: 0,
      }}>
        <i data-lucide={palette.icon} style={{ width: 16, height: 16 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, color: palette.fg, lineHeight: '15px', marginBottom: 2 }}>
          OCR detected
        </div>
        <div style={{
          fontFamily: 'ui-monospace, Menlo, monospace',
          fontSize: 13, color: palette.strong, fontWeight: 700, letterSpacing: -0.2,
        }}>
          "{detected}"
        </div>
        {sub && (
          <div style={{ fontSize: 10.5, color: palette.fg, marginTop: 3, opacity: 0.85 }}>{sub}</div>
        )}
      </div>
      <div style={{
        padding: '3px 8px', borderRadius: 9999,
        background: palette.pillBg, border: `1px solid ${palette.pillBorder}`,
        color: palette.pillFg, fontSize: 10, fontWeight: 700, letterSpacing: 0.2,
        flexShrink: 0, fontFamily: 'ui-monospace, Menlo, monospace',
      }}>{confidence}%</div>
    </div>
  );
}

// ─── Candidate row ────────────────────────────────────────────

function Candidate({
  initials, name, role, roleBg, roleFg, grant, avatarBg, verified,
  match,            // 'strong' | 'partial' | 'weak'
  matchLabel,
  selected, onClick,
  presence,         // tiny status line ("Owner since 2019", "Out of town")
}) {
  const matchPalette = {
    strong:  { bg: F.successBg,  fg: F.success,  border: '#a7f3d0' },
    partial: { bg: '#fef3c7',    fg: '#92400e',  border: '#fcd34d' },
    weak:    { bg: F.sunken,     fg: F.fg3,      border: F.border },
  }[match] || { bg: F.sunken, fg: F.fg3, border: F.border };

  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: F.surface,
      border: selected ? `1.5px solid ${F.primary600}` : `1px solid ${F.border}`,
      borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
      boxShadow: selected
        ? '0 0 0 3px rgba(2,132,199,0.12), 0 1px 3px rgba(0,0,0,0.04)'
        : '0 1px 3px rgba(0,0,0,0.04)',
      transition: 'all 120ms', textAlign: 'left', width: '100%',
      position: 'relative',
    }}>
      {/* radio */}
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        border: selected ? `6px solid ${F.primary600}` : `2px solid ${F.borderStrong}`,
        background: F.surface, flexShrink: 0, boxSizing: 'border-box',
        transition: 'all 120ms',
      }} />
      {/* avatar */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          width: 42, height: 42, borderRadius: '50%', background: avatarBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 700, fontSize: 14, letterSpacing: -0.3,
        }}>{initials}</div>
        {verified && (
          <div style={{
            position: 'absolute', right: -2, bottom: -2,
            width: 15, height: 15, borderRadius: '50%', background: F.home,
            border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i data-lucide="check" style={{ width: 9, height: 9, color: '#fff', strokeWidth: 4 }} />
          </div>
        )}
      </div>
      {/* info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: F.fg1, letterSpacing: -0.1 }}>{name}</span>
          {matchLabel && (
            <span style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: 0.1,
              color: matchPalette.fg, background: matchPalette.bg,
              border: `1px solid ${matchPalette.border}`,
              padding: '1.5px 6px', borderRadius: 4, textTransform: 'uppercase',
            }}>{matchLabel}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 10.5, fontWeight: 600,
            background: roleBg, color: roleFg,
            padding: '2px 7px', borderRadius: 9999,
          }}>{role}</span>
          <span style={{ fontSize: 11, color: F.fg3, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <i data-lucide={grant === 'No mail access' ? 'mail-x' : 'mail-check'} style={{ width: 11, height: 11 }} />
            {grant}
          </span>
        </div>
        {presence && (
          <div style={{
            fontSize: 10.5, color: F.fg3, marginTop: 4, fontStyle: 'italic',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <i data-lucide="circle" style={{ width: 6, height: 6, fill: F.fg4, color: F.fg4, strokeWidth: 0 }} />
            {presence}
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Fallback row (unclear frame) ─────────────────────────────

function FallbackRow({ icon, title, sub, action }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      borderBottom: `1px solid ${F.borderSub}`,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 9,
        background: F.sunken, color: F.fg2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <i data-lucide={icon} style={{ width: 17, height: 17 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: F.fg1, letterSpacing: -0.1 }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: F.fg3, marginTop: 2, lineHeight: '15px' }}>{sub}</div>}
      </div>
      <i data-lucide="chevron-right" style={{ width: 16, height: 16, color: F.fg4, flexShrink: 0 }} />
    </div>
  );
}

// ─── Sticky CTA ───────────────────────────────────────────────

function StickyConfirm({ disabled, label = 'Confirm recipient', hint }) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'rgba(255,255,255,0.96)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      borderTop: `1px solid ${F.border}`,
      padding: '10px 16px 28px',
      zIndex: 10,
    }}>
      {hint && (
        <div style={{
          fontSize: 11, color: F.fg3, textAlign: 'center', marginBottom: 8,
          fontStyle: 'italic',
        }}>{hint}</div>
      )}
      <button disabled={disabled} style={{
        width: '100%', height: 46, borderRadius: 12, border: 'none',
        background: disabled ? F.sunken : F.primary600,
        color: disabled ? F.fg4 : '#fff',
        fontSize: 14, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled ? 'none' : '0 6px 16px rgba(2,132,199,0.28)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        letterSpacing: -0.1,
      }}>
        <i data-lucide={disabled ? 'lock' : 'check'} style={{ width: 16, height: 16 }} />
        {label}
      </button>
    </div>
  );
}

// Quick action chip — used for "This is me" and "Route to..." shortcuts
function QuickActionChip({ icon, label, primary }) {
  return (
    <button style={{
      flex: 1, height: 44, padding: '0 12px', borderRadius: 10,
      background: primary ? F.primary50 : F.surface,
      border: primary ? `1px solid #bae6fd` : `1px solid ${F.border}`,
      color: primary ? F.primary700 : F.fg2,
      fontSize: 13, fontWeight: 600, letterSpacing: -0.05, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    }}>
      <i data-lucide={icon} style={{ width: 15, height: 15 }} />
      {label}
    </button>
  );
}

// ─── FRAME 1 · STRONG MATCH ───────────────────────────────────

function FrameDisambiguateStrong() {
  const [selected, setSelected] = React.useState(0);
  const candidates = [
    {
      initials: 'MK', name: 'Maria Kovács',
      role: 'Owner', roleBg: F.primary100, roleFg: F.primary700,
      grant: 'Receives mail',
      avatarBg: 'linear-gradient(135deg,#0ea5e9,#0369a1)',
      verified: true,
      match: 'strong', matchLabel: 'Strong match · 97%',
      presence: 'Owner since 2019 · Apt 3B',
    },
    {
      initials: 'MK', name: 'Marcus Khan',
      role: 'Resident', roleBg: F.homeBg, roleFg: F.home,
      grant: 'Receives mail',
      avatarBg: 'linear-gradient(135deg,#16a34a,#15803d)',
      verified: true,
      match: 'weak', matchLabel: 'Weak · 22%',
      presence: 'Moved in Jan · Apt 3B',
    },
    {
      initials: 'MK', name: 'Mika Kim',
      role: 'Guest', roleBg: F.sunken, roleFg: F.fg2,
      grant: 'No mail access',
      avatarBg: 'linear-gradient(135deg,#f97316,#c2410c)',
      verified: false,
      match: 'weak', matchLabel: 'Weak · 18%',
      presence: 'Visiting until Sun',
    },
  ];

  return (
    <Phone>
      <TopBar title="Disambiguate" />
      <ScrollArea bottomPad={120}>

        <Section overline="Scanned envelope">
          <Card padding={0} style={{ borderRadius: 14 }}>
            <EnvelopeClean />
          </Card>
          <OcrStrip
            tone="good"
            detected="Maria K. · 412 Elm St"
            confidence={97}
            sub="Address matches this household."
          />
        </Section>

        <Section overline="Who is this for?">
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <QuickActionChip icon="user-check" label="This is me" primary />
            <QuickActionChip icon="forward" label="Route to…" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {candidates.map((c, i) => (
              <Candidate
                key={i} {...c}
                selected={selected === i}
                onClick={() => setSelected(i)}
              />
            ))}
          </div>
          <button style={{
            marginTop: 4, background: 'transparent', border: 'none', padding: '8px 4px',
            color: F.primary600, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <i data-lucide="plus" style={{ width: 13, height: 13 }} />
            None of these — add new person
          </button>
        </Section>

      </ScrollArea>
      <StickyConfirm />
    </Phone>
  );
}

// ─── FRAME 2 · UNCLEAR SCAN ───────────────────────────────────

function FrameDisambiguateUnclear() {
  const candidates = [
    {
      initials: 'MK', name: 'Maria Kovács',
      role: 'Owner', roleBg: F.primary100, roleFg: F.primary700,
      grant: 'Receives mail',
      avatarBg: 'linear-gradient(135deg,#0ea5e9,#0369a1)',
      verified: true,
      match: 'partial', matchLabel: 'Partial · 41%',
      presence: 'Owner since 2019 · Apt 3B',
    },
    {
      initials: 'MK', name: 'Marcus Khan',
      role: 'Resident', roleBg: F.homeBg, roleFg: F.home,
      grant: 'Receives mail',
      avatarBg: 'linear-gradient(135deg,#16a34a,#15803d)',
      verified: true,
      match: 'partial', matchLabel: 'Partial · 38%',
    },
    {
      initials: 'MK', name: 'Mika Kim',
      role: 'Guest', roleBg: F.sunken, roleFg: F.fg2,
      grant: 'No mail access',
      avatarBg: 'linear-gradient(135deg,#f97316,#c2410c)',
      verified: false,
      match: 'weak', matchLabel: 'Weak · 19%',
      presence: 'Visiting until Sun',
    },
  ];

  return (
    <Phone>
      <TopBar title="Disambiguate" />
      <ScrollArea bottomPad={120}>

        <Section overline="Scanned envelope">
          <Card padding={0} style={{ borderRadius: 14 }}>
            <EnvelopeUnclear />
          </Card>
          <OcrStrip
            tone="warn"
            detected="M___ K___ · 4__ Elm St"
            confidence={31}
            sub="Smudge on the name line. Try a brighter re-scan for a sharper read."
          />
        </Section>

        <Section overline="Best guesses · none confident">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {candidates.map((c, i) => (
              <Candidate key={i} {...c} selected={false} />
            ))}
          </div>
        </Section>

        <Section overline="Or resolve another way">
          <Card padding={0}>
            <FallbackRow
              icon="scan-line"
              title="Re-scan envelope"
              sub="Hold under brighter light. Most-used fix."
            />
            <FallbackRow
              icon="keyboard"
              title="Type recipient name"
              sub="Skip OCR, enter the name yourself."
            />
            <FallbackRow
              icon="undo-2"
              title="Return to sender"
              sub="Mark as undeliverable — sender notified."
            />
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9,
                background: F.errorBg, color: F.error600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <i data-lucide="trash-2" style={{ width: 17, height: 17 }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: F.fg1, letterSpacing: -0.1 }}>
                  Mark as junk
                </div>
                <div style={{ fontSize: 11, color: F.fg3, marginTop: 2, lineHeight: '15px' }}>
                  Skip routing. Sender added to junk filter.
                </div>
              </div>
              <i data-lucide="chevron-right" style={{ width: 16, height: 16, color: F.fg4 }} />
            </div>
          </Card>
        </Section>

      </ScrollArea>
      <StickyConfirm disabled hint="Pick a recipient — or choose a fallback above." />
    </Phone>
  );
}

Object.assign(window, { FrameDisambiguateStrong, FrameDisambiguateUnclear });
