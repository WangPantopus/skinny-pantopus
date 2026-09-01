// Pantopus — A13.3 · Review ownership claim
// File: src/app/homes/[id]/owners/review-claim.tsx
// Archetype: A13 — Form (single screen), simple variant.
// The "form" here is a triage decision: review the claim and pick a verdict.
// Inherits Phone / TopBar / Section / Card / Textarea / OverlineLabel from form-frames.jsx.
//
// Two frames:
//   FrameReviewClaimPending — populated: claim is pending, three verdict buttons live
//   FrameReviewClaimChallenging — secondary state: organizer tapped "Challenge",
//                                 reason picker expanded, primary CTA becomes "Send challenge"

const {
  F, Phone, TopBar, OverlineLabel, FieldLabel,
  Textarea, Section, ScrollArea, Card,
} = window;

// ─── Local atoms ────────────────────────────────────────────────

function HomeContextStrip({ name = '412 Elm Street', sub = 'Bungalow · You + 2 owners · since 2019' }) {
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
        }}>{name}</div>
        <div style={{ fontSize: 11, color: F.fg3, marginTop: 1 }}>{sub}</div>
      </div>
    </div>
  );
}

function ClaimantCard() {
  return (
    <div style={{
      background: F.surface, border: `1px solid ${F.border}`,
      borderRadius: 12, padding: 14,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'linear-gradient(135deg,#fb923c,#c2410c)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 18, fontWeight: 700, letterSpacing: -0.4,
          flexShrink: 0,
          boxShadow: '0 4px 10px rgba(194,65,12,0.18)',
        }}>RD</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
          }}>
            <span style={{
              fontSize: 15, fontWeight: 600, color: F.fg1, letterSpacing: -0.15,
            }}>Rosa Delgado</span>
            <span style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: 0.08,
              color: '#92400e', background: '#fef3c7',
              border: `1px solid #fde68a`,
              padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase',
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              <i data-lucide="clock" style={{ width: 9, height: 9 }} />
              Pending 3d
            </span>
          </div>
          <div style={{
            fontSize: 12, color: F.fg3, marginTop: 2,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <i data-lucide="at-sign" style={{ width: 11, height: 11 }} />
            rosa.delgado@pantopus.app
          </div>
        </div>
      </div>

      {/* Claim summary line */}
      <div style={{
        marginTop: 12, padding: '10px 12px',
        background: F.muted, border: `1px solid ${F.border}`, borderRadius: 8,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: F.primary50, color: F.primary600,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <i data-lucide="key-round" style={{ width: 14, height: 14 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12, color: F.fg3, fontWeight: 500,
            letterSpacing: -0.05,
          }}>Claiming</div>
          <div style={{
            fontSize: 13.5, fontWeight: 600, color: F.fg1,
            letterSpacing: -0.1, marginTop: 1,
          }}>
            <span style={{
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: 14, color: F.primary700,
            }}>25%</span>
            <span style={{ color: F.fg2, fontWeight: 500 }}> ownership share</span>
          </div>
        </div>
      </div>

      {/* Trust signals */}
      <div style={{
        marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6,
      }}>
        <TrustChip icon="badge-check" tone="success" label="Verified ID" />
        <TrustChip icon="phone" tone="success" label="Phone verified" />
        <TrustChip icon="user-x" tone="warn" label="No mutual owners" />
      </div>
    </div>
  );
}

function TrustChip({ icon, label, tone }) {
  const palette = tone === 'success'
    ? { bg: F.successBg, fg: F.success, bd: '#a7f3d0' }
    : tone === 'warn'
      ? { bg: '#fef3c7', fg: '#92400e', bd: '#fde68a' }
      : { bg: F.sunken, fg: F.fg3, bd: F.border };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 9999,
      background: palette.bg, color: palette.fg,
      border: `1px solid ${palette.bd}`,
      fontSize: 11, fontWeight: 600, letterSpacing: -0.05,
    }}>
      <i data-lucide={icon} style={{ width: 11, height: 11 }} />
      {label}
    </span>
  );
}

function EvidenceThumb({ kind, title, meta, badge }) {
  // Synthetic document preview — no real images, all drawn
  const previews = {
    deed: (
      <div style={{
        position: 'absolute', inset: 8, borderRadius: 4,
        background: '#fff', border: `1px solid ${F.border}`,
        padding: '6px 5px', display: 'flex', flexDirection: 'column', gap: 2.5,
        overflow: 'hidden',
      }}>
        <div style={{ height: 4, width: '60%', borderRadius: 1, background: F.fg2 }} />
        <div style={{ height: 2, width: '85%', borderRadius: 1, background: F.borderStrong }} />
        <div style={{ height: 2, width: '78%', borderRadius: 1, background: F.borderStrong }} />
        <div style={{ height: 2, width: '90%', borderRadius: 1, background: F.borderStrong }} />
        <div style={{ height: 2, width: '40%', borderRadius: 1, background: F.borderStrong }} />
        <div style={{ flex: 1 }} />
        <div style={{
          height: 14, width: 22, borderRadius: 2,
          background: F.primary50, border: `1px solid ${F.primary100}`,
          alignSelf: 'flex-end',
        }} />
      </div>
    ),
    photo: (
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(160deg,#fde68a 0%,#fb923c 45%,#7c2d12 100%)',
      }}>
        {/* a little porch silhouette */}
        <div style={{
          position: 'absolute', left: '20%', right: '20%', bottom: '18%',
          height: '32%', background: '#451a03', borderRadius: '4px 4px 0 0',
        }} />
        <div style={{
          position: 'absolute', left: '38%', right: '38%', bottom: '18%',
          height: '20%', background: '#fef3c7',
        }} />
        <div style={{
          position: 'absolute', top: '14%', right: '22%',
          width: 10, height: 10, borderRadius: '50%',
          background: '#fef9c3',
          boxShadow: '0 0 12px rgba(254,249,195,0.7)',
        }} />
      </div>
    ),
    utility: (
      <div style={{
        position: 'absolute', inset: 8, borderRadius: 4,
        background: '#fff', border: `1px solid ${F.border}`,
        padding: '5px 5px', display: 'flex', flexDirection: 'column', gap: 2,
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2,
        }}>
          <div style={{ height: 5, width: 16, borderRadius: 1, background: '#0284c7' }} />
          <div style={{ height: 3, width: 10, borderRadius: 1, background: F.fg4 }} />
        </div>
        <div style={{ height: 2, width: '70%', borderRadius: 1, background: F.borderStrong }} />
        <div style={{ height: 2, width: '55%', borderRadius: 1, background: F.borderStrong }} />
        <div style={{ flex: 1 }} />
        <div style={{
          padding: '2px 0', textAlign: 'right',
          fontSize: 8, fontWeight: 700, color: F.fg2,
          fontFamily: 'ui-monospace, Menlo, monospace',
        }}>$184.20</div>
      </div>
    ),
  }[kind];

  return (
    <div style={{
      width: 96, flexShrink: 0,
      display: 'flex', flexDirection: 'column', gap: 6,
      cursor: 'pointer',
    }}>
      <div style={{
        position: 'relative', width: '100%', aspectRatio: '3 / 4',
        background: F.sunken, border: `1px solid ${F.border}`,
        borderRadius: 8, overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        {previews}
        {badge && (
          <span style={{
            position: 'absolute', top: 5, left: 5,
            fontSize: 8.5, fontWeight: 700, letterSpacing: 0.04,
            color: '#fff', background: 'rgba(17,24,39,0.78)',
            padding: '2px 5px', borderRadius: 3, textTransform: 'uppercase',
            backdropFilter: 'blur(4px)',
          }}>{badge}</span>
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 11.5, fontWeight: 600, color: F.fg1,
          letterSpacing: -0.05, lineHeight: '14px',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{title}</div>
        <div style={{
          fontSize: 10, color: F.fg4, marginTop: 1,
          letterSpacing: 0.02,
        }}>{meta}</div>
      </div>
    </div>
  );
}

function EvidenceStrip() {
  return (
    <div style={{
      display: 'flex', gap: 10, overflowX: 'auto',
      margin: '0 -16px', padding: '0 16px 4px',
      scrollbarWidth: 'none',
    }}>
      <EvidenceThumb kind="deed"    title="Recorded deed" meta="PDF · 1.4 MB" badge="2018" />
      <EvidenceThumb kind="photo"   title="Front porch" meta="JPG · 3.2 MB" badge="2024" />
      <EvidenceThumb kind="utility" title="ConEd bill" meta="PDF · 220 KB" badge="May" />
      {/* +1 more */}
      <div style={{
        width: 96, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        aspectRatio: 'auto', alignSelf: 'stretch',
      }}>
        <div style={{
          width: '100%', aspectRatio: '3 / 4',
          border: `1.5px dashed ${F.borderStrong}`,
          borderRadius: 8,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 4, color: F.fg3,
        }}>
          <i data-lucide="plus" style={{ width: 18, height: 18 }} />
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: -0.05 }}>+1 more</div>
        </div>
      </div>
    </div>
  );
}

function StatementBlock({ children }) {
  return (
    <div style={{
      position: 'relative',
      background: F.surface, border: `1px solid ${F.border}`,
      borderRadius: 12, padding: '14px 16px 14px 18px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {/* left accent */}
      <div style={{
        position: 'absolute', left: 0, top: 14, bottom: 14, width: 3,
        background: F.primary600, borderRadius: 2,
      }} />
      <div style={{
        fontSize: 13.5, color: F.fg1, lineHeight: '20px',
        letterSpacing: -0.05, fontStyle: 'italic',
      }}>
        "{children}"
      </div>
      <div style={{
        fontSize: 10.5, color: F.fg4, marginTop: 8,
        display: 'flex', alignItems: 'center', gap: 4,
        letterSpacing: 0.04,
      }}>
        <i data-lucide="quote" style={{ width: 10, height: 10 }} />
        SIGNED · ROSA DELGADO · MAY 22
      </div>
    </div>
  );
}

function VerdictButton({ icon, label, tone, primary, onClick }) {
  const palette =
    tone === 'accept'    ? { bg: F.success600, fg: '#fff', shadow: '0 6px 16px rgba(5,150,105,0.28)' } :
    tone === 'challenge' ? { bg: '#fff7ed', fg: '#9a3412', bd: '#fed7aa' } :
    tone === 'reject'    ? { bg: F.surface,  fg: F.error600, bd: F.errorLight } :
                           { bg: F.surface,  fg: F.fg2, bd: F.border };

  if (primary) {
    return (
      <button onClick={onClick} style={{
        width: '100%', height: 48, borderRadius: 12, border: 'none',
        background: palette.bg, color: palette.fg,
        fontSize: 15, fontWeight: 600, letterSpacing: -0.1,
        cursor: 'pointer',
        boxShadow: palette.shadow,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <i data-lucide={icon} style={{ width: 17, height: 17 }} />
        {label}
      </button>
    );
  }

  return (
    <button onClick={onClick} style={{
      flex: 1, height: 44, borderRadius: 10,
      background: palette.bg, color: palette.fg,
      border: `1px solid ${palette.bd || 'transparent'}`,
      fontSize: 13.5, fontWeight: 600, letterSpacing: -0.1,
      cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    }}>
      <i data-lucide={icon} style={{ width: 15, height: 15 }} />
      {label}
    </button>
  );
}

// Sticky verdict bar — three actions, Accept is primary
function VerdictBar({ active = 'accept' }) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'rgba(255,255,255,0.96)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      borderTop: `1px solid ${F.border}`,
      padding: '12px 16px 28px', zIndex: 10,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <VerdictButton primary icon="check-circle-2" label="Accept claim" tone="accept" />
      <div style={{ display: 'flex', gap: 8 }}>
        <VerdictButton icon="message-circle-question" label="Challenge" tone="challenge" />
        <VerdictButton icon="x-circle" label="Reject" tone="reject" />
      </div>
    </div>
  );
}

// ─── FRAME 1 · POPULATED ───────────────────────────────────────

function FrameReviewClaimPending() {
  return (
    <Phone>
      <TopBar title="Review ownership claim" />
      <ScrollArea bottomPad={150}>

        <HomeContextStrip />

        <Section overline="Claimant">
          <ClaimantCard />
        </Section>

        <Section overline="Evidence · 4 files">
          <EvidenceStrip />
          <div style={{
            fontSize: 11, color: F.fg3, lineHeight: '15px',
            display: 'flex', alignItems: 'flex-start', gap: 6,
          }}>
            <i data-lucide="shield-check" style={{ width: 12, height: 12, color: F.success600, marginTop: 1, flexShrink: 0 }} />
            County recorder cross-check found a matching deed from 2018. Tap any file to open.
          </div>
        </Section>

        <Section overline="Claim statement">
          <StatementBlock>
            I bought a 25% stake from Mateo when he moved out in 2018. We never got around to recording the transfer on Pantopus, but the deed is on file with Kings County and ConEd has been in my name since.
          </StatementBlock>
        </Section>

      </ScrollArea>
      <VerdictBar />
    </Phone>
  );
}

// ─── FRAME 2 · SECONDARY · CHALLENGE COMPOSER ──────────────────

function ReasonChip({ label, selected }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '7px 11px', borderRadius: 9999,
      background: selected ? '#fff7ed' : F.surface,
      color: selected ? '#9a3412' : F.fg2,
      border: selected ? `1px solid #fed7aa` : `1px solid ${F.border}`,
      fontSize: 12, fontWeight: selected ? 600 : 500,
      letterSpacing: -0.05, cursor: 'pointer',
    }}>
      {selected && <i data-lucide="check" style={{ width: 11, height: 11, strokeWidth: 3 }} />}
      {label}
    </span>
  );
}

function ChallengeComposerSheet() {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 30,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }}>
      {/* scrim */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(17,24,39,0.45)',
        backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
      }} />

      <div style={{
        position: 'relative', background: F.surface,
        borderTopLeftRadius: 22, borderTopRightRadius: 22,
        padding: '10px 16px 28px',
        boxShadow: '0 -12px 32px rgba(17,24,39,0.18)',
        maxHeight: '78%', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          width: 38, height: 4, borderRadius: 2, background: F.borderStrong,
          margin: '0 auto 14px', flexShrink: 0,
        }} />

        {/* Sheet header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexShrink: 0,
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: '#fff7ed', color: '#9a3412',
            border: `1px solid #fed7aa`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <i data-lucide="message-circle-question" style={{ width: 17, height: 17 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 16, fontWeight: 700, color: F.fg1, letterSpacing: -0.2,
            }}>Challenge Rosa's claim</div>
            <div style={{ fontSize: 11.5, color: F.fg3, marginTop: 1 }}>
              She'll get your questions and 14 days to respond.
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{
          flex: 1, overflow: 'auto',
          display: 'flex', flexDirection: 'column', gap: 16,
          paddingRight: 2,
        }}>
          {/* Reasons */}
          <div>
            <FieldLabel>Reasons (pick any)</FieldLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <ReasonChip label="Share % seems off" selected />
              <ReasonChip label="Need newer evidence" selected />
              <ReasonChip label="Date doesn't match" />
              <ReasonChip label="Want a video call" />
              <ReasonChip label="Other owners disagree" />
            </div>
          </div>

          {/* Composer */}
          <div>
            <FieldLabel required>Your questions for Rosa</FieldLabel>
            <Textarea
              value="Hey Rosa — happy to add you, but the 25% number is news to me. Mateo's notes say 20%. Could you share the original transfer doc you signed with him, and maybe hop on a call this week?"
              height={104}
              charCount="208 / 600"
            />
          </div>

          {/* Visibility row */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '10px 12px', background: F.muted,
            border: `1px solid ${F.border}`, borderRadius: 10,
          }}>
            <i data-lucide="eye" style={{
              width: 14, height: 14, color: F.fg3, marginTop: 2, flexShrink: 0,
            }} />
            <div style={{ fontSize: 11.5, color: F.fg2, lineHeight: '16px' }}>
              Rosa and the other 2 owners will see this. The claim stays pending until everyone weighs in or 14 days pass.
            </div>
          </div>
        </div>

        {/* Sticky actions inside sheet */}
        <div style={{
          display: 'flex', gap: 8, marginTop: 16, flexShrink: 0,
        }}>
          <button style={{
            flex: 1, height: 46, borderRadius: 12,
            background: F.surface, color: F.fg1,
            border: `1px solid ${F.border}`,
            fontSize: 14, fontWeight: 600, letterSpacing: -0.1, cursor: 'pointer',
          }}>Back</button>
          <button style={{
            flex: 1.4, height: 46, borderRadius: 12, border: 'none',
            background: '#c2410c', color: '#fff',
            fontSize: 14, fontWeight: 600, letterSpacing: -0.1, cursor: 'pointer',
            boxShadow: '0 6px 16px rgba(194,65,12,0.28)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          }}>
            <i data-lucide="send" style={{ width: 15, height: 15 }} />
            Send challenge
          </button>
        </div>
      </div>
    </div>
  );
}

function FrameReviewClaimChallenging() {
  return (
    <Phone>
      <TopBar title="Review ownership claim" />
      <ScrollArea bottomPad={150}>
        <HomeContextStrip />
        <Section overline="Claimant">
          <ClaimantCard />
        </Section>
        <Section overline="Evidence · 4 files">
          <EvidenceStrip />
        </Section>
        <Section overline="Claim statement">
          <StatementBlock>
            I bought a 25% stake from Mateo when he moved out in 2018. We never got around to recording the transfer on Pantopus, but the deed is on file with Kings County and ConEd has been in my name since.
          </StatementBlock>
        </Section>
      </ScrollArea>
      <ChallengeComposerSheet />
    </Phone>
  );
}

Object.assign(window, { FrameReviewClaimPending, FrameReviewClaimChallenging });
