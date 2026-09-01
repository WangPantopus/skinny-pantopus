// Pantopus — A13.16 · My Mail Day
// File: src/app/mailbox/mailday.tsx
//
// Simple variant of the Form archetype, used as a daily review editor.
// Each "field" is a routing decision against a piece of physical mail the
// household scanned during the day. The screen accumulates decisions
// top-down: items needing a call show first; the things you've already
// routed sit below in a compact reviewed list with one-tap undo. A scan
// button injects more mail mid-day; "Finish day" closes the ledger and
// produces a one-screen summary.
//
// Two frames:
//   FrameMailDayPopulated — 8-piece stack, 2 still need a decision, 6
//       routed (one with an active 5-second undo countdown). Finish-day
//       is secondary until everything's resolved.
//   FrameMailDayEmpty — "Nothing new today" hero · streak chip · last
//       scan time · yesterday's recap card · primary CTA is Scan now.

const {
  F, Phone, TopBar, OverlineLabel, FieldLabel, Section, ScrollArea, Card,
} = window;

// ─── Local palette ────────────────────────────────────────────

const MD = {
  cream:    '#f8f4ec',
  paper:    '#fcfaf3',
  rust:     '#b45309',
  rustBg:   '#fef3c7',
  rustFg:   '#92400e',
  stamp:    '#7c2d12',
  ribbon:   '#0284c7',
};

// ─── Mail thumbnails ──────────────────────────────────────────

// Tiny faux-photo of a mail piece. `kind` picks a treatment.
function MailThumb({ kind = 'envelope', size = 56, dim }) {
  const radius = 6;
  const wrap = {
    width: size, height: Math.round(size * 1.28),
    borderRadius: radius, overflow: 'hidden',
    position: 'relative',
    boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
    opacity: dim ? 0.55 : 1, flexShrink: 0,
  };
  if (kind === 'envelope') {
    return (
      <div style={{ ...wrap, background: MD.cream }}>
        <div style={{ position: 'absolute', inset: '14% 12% auto 12%', height: '12%',
          borderRadius: 1, background: '#c2b48a' }} />
        <div style={{ position: 'absolute', inset: '32% 12% auto 12%', height: '6%',
          background: '#2d2414', borderRadius: 1 }} />
        <div style={{ position: 'absolute', inset: '42% 12% auto 12%', height: '6%',
          background: '#5a4a30', borderRadius: 1, opacity: 0.7 }} />
        <div style={{ position: 'absolute', right: '8%', top: '8%',
          width: '24%', height: '32%', borderRadius: 1.5,
          border: `1px dashed ${MD.stamp}`, background: 'rgba(255,255,255,0.4)' }} />
      </div>
    );
  }
  if (kind === 'magazine') {
    return (
      <div style={{ ...wrap, background: 'linear-gradient(160deg,#fbbf24 0%,#dc2626 60%,#7c2d12 100%)' }}>
        <div style={{ position: 'absolute', inset: '8% 8% auto 8%', height: '8%',
          background: '#fff', borderRadius: 1, opacity: 0.9 }} />
        <div style={{ position: 'absolute', inset: '22% 8% auto 8%', height: '5%',
          background: '#fff', borderRadius: 1, opacity: 0.75 }} />
        <div style={{ position: 'absolute', inset: '60% 25% 12% 25%',
          background: 'rgba(0,0,0,0.35)', borderRadius: 1 }} />
        <div style={{ position: 'absolute', left: '50%', top: '36%',
          width: '40%', height: '20%', transform: 'translateX(-50%)',
          background: 'rgba(255,255,255,0.18)', borderRadius: '50%' }} />
      </div>
    );
  }
  if (kind === 'postcard') {
    return (
      <div style={{ ...wrap, background: 'linear-gradient(180deg,#bae6fd 0%,#0ea5e9 60%,#0369a1 100%)' }}>
        {/* horizon line */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: '62%', height: 1, background: '#0c4a6e' }} />
        {/* sun */}
        <div style={{ position: 'absolute', right: '20%', top: '20%',
          width: '22%', height: '18%', borderRadius: '50%', background: '#fde68a',
          boxShadow: '0 0 8px 2px rgba(254,243,199,0.8)' }} />
        {/* greeting */}
        <div style={{ position: 'absolute', left: '8%', bottom: '8%', right: '8%', height: '14%',
          background: '#fff', borderRadius: 1, opacity: 0.92 }} />
      </div>
    );
  }
  if (kind === 'bill') {
    // window envelope
    return (
      <div style={{ ...wrap, background: '#fff' }}>
        <div style={{ position: 'absolute', inset: '0', border: '0.5px solid #d1d5db', borderRadius: radius }} />
        {/* logo bar */}
        <div style={{ position: 'absolute', inset: '8% 10% auto 10%', height: '7%',
          background: F.primary600, borderRadius: 0.5, opacity: 0.85 }} />
        {/* window */}
        <div style={{ position: 'absolute', inset: '34% 10% 22% 10%',
          background: '#e0e7ff', borderRadius: 1,
          boxShadow: 'inset 0 0 0 0.5px rgba(99,102,241,0.4)' }}>
          <div style={{ position: 'absolute', inset: '20% 10% auto 10%', height: '14%', background: '#1e3a8a', borderRadius: 0.5 }} />
          <div style={{ position: 'absolute', inset: '40% 10% auto 10%', height: '10%', background: '#475569', borderRadius: 0.5 }} />
          <div style={{ position: 'absolute', inset: '56% 30% auto 10%', height: '10%', background: '#64748b', borderRadius: 0.5 }} />
        </div>
      </div>
    );
  }
  if (kind === 'package') {
    return (
      <div style={{ ...wrap, background: '#d6c193' }}>
        {/* tape cross */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: '46%', height: '8%', background: '#fcd34d', opacity: 0.9 }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '46%', width: '8%', background: '#fcd34d', opacity: 0.9 }} />
        {/* label */}
        <div style={{ position: 'absolute', inset: '12% 14% auto 14%', height: '24%',
          background: '#fff', borderRadius: 1 }}>
          <div style={{ position: 'absolute', inset: '20% 14% auto 14%', height: '20%', background: '#111827' }} />
          <div style={{ position: 'absolute', inset: '52% 14% auto 14%', height: '12%', background: '#374151' }} />
        </div>
      </div>
    );
  }
  if (kind === 'flyer') {
    return (
      <div style={{ ...wrap, background: 'linear-gradient(135deg,#22c55e 0%,#15803d 100%)' }}>
        <div style={{ position: 'absolute', inset: '14% 10% auto 10%', height: '8%', background: '#fff', borderRadius: 1, opacity: 0.95 }} />
        <div style={{ position: 'absolute', inset: '26% 10% auto 10%', height: '5%', background: '#fff', borderRadius: 1, opacity: 0.8 }} />
        <div style={{ position: 'absolute', inset: '40% 35% auto 35%', height: '20%', background: '#fef3c7', borderRadius: 1 }} />
        <div style={{ position: 'absolute', inset: '66% 12% 10% 12%', height: '6%', background: '#fff', borderRadius: 1, opacity: 0.85 }} />
        <div style={{ position: 'absolute', inset: '76% 12% 4% 12%', height: '5%', background: '#fff', borderRadius: 1, opacity: 0.75 }} />
      </div>
    );
  }
  return <div style={wrap} />;
}

// ─── Day header — count, progress ring, date ──────────────────

function ProgressRing({ done, total, size = 56 }) {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const pct = total === 0 ? 0 : done / total;
  const offset = c * (1 - pct);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={F.sunken} strokeWidth="4" />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={pct === 1 ? F.success600 : F.primary600} strokeWidth="4"
          strokeDasharray={c} strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, fontWeight: 700, color: F.fg1,
        letterSpacing: -0.4,
      }}>{done}<span style={{ color: F.fg4, fontWeight: 600, fontSize: 11 }}>/{total}</span></div>
    </div>
  );
}

function DayHeader({ date, streak, done, total }) {
  const remaining = total - done;
  return (
    <div style={{
      background: F.surface, borderRadius: 14,
      padding: '14px 14px',
      border: `1px solid ${F.border}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <ProgressRing done={done} total={total} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: F.fg1, letterSpacing: -0.2 }}>{date}</span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '1.5px 7px', borderRadius: 9999,
            background: MD.rustBg, color: MD.rustFg,
            fontSize: 10, fontWeight: 700, letterSpacing: 0.2,
          }}>
            <i data-lucide="flame" style={{ width: 9, height: 9 }} />
            Day {streak}
          </span>
        </div>
        <div style={{ fontSize: 12, color: F.fg3, letterSpacing: -0.05, lineHeight: '16px' }}>
          {remaining > 0
            ? <><span style={{ color: F.fg1, fontWeight: 700 }}>{remaining}</span> still need a call · <span style={{ color: F.success, fontWeight: 600 }}>{done}</span> routed</>
            : <>All <span style={{ color: F.success, fontWeight: 700 }}>{done}</span> routed. Ready to close out.</>
          }
        </div>
      </div>
    </div>
  );
}

// ─── Scan-more card ───────────────────────────────────────────

function ScanMoreCard({ since }) {
  return (
    <button style={{
      width: '100%', background: F.primary50,
      border: `1.5px dashed #7dd3fc`, borderRadius: 12,
      padding: '12px 14px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 12,
      textAlign: 'left',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: F.primary600, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, boxShadow: '0 4px 10px rgba(2,132,199,0.25)',
      }}>
        <i data-lucide="scan-line" style={{ width: 18, height: 18 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: F.primary700, letterSpacing: -0.1 }}>
          Scan more mail
        </div>
        <div style={{ fontSize: 11, color: F.primary700, opacity: 0.75, marginTop: 2 }}>
          Last scan {since}
        </div>
      </div>
      <i data-lucide="camera" style={{ width: 18, height: 18, color: F.primary600 }} />
    </button>
  );
}

// ─── Unreviewed item card ─────────────────────────────────────

function UnreviewedItem({ kind, label, sender, suggestedAvatar, suggestedName, confidence, secondary }) {
  return (
    <div style={{
      background: F.surface, border: `1px solid ${F.border}`, borderRadius: 12,
      padding: 12, display: 'flex', gap: 12,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <MailThumb kind={kind} size={56} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: F.fg1, letterSpacing: -0.15 }}>
              {label}
            </span>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: 0.3,
              padding: '1.5px 5px', borderRadius: 3,
              background: F.sunken, color: F.fg3, textTransform: 'uppercase',
            }}>New</span>
          </div>
          <div style={{ fontSize: 11.5, color: F.fg3, lineHeight: '15px' }}>
            From {sender}
          </div>
        </div>
        {/* AI suggestion strip */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 8px', borderRadius: 8,
          background: F.primary50, border: '1px solid #bae6fd',
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: '50%', background: suggestedAvatar,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 9.5, letterSpacing: -0.2,
            flexShrink: 0,
          }}>{suggestedName.split(' ').map(s => s[0]).join('')}</div>
          <div style={{ flex: 1, minWidth: 0, fontSize: 11, color: F.fg2, lineHeight: '14px' }}>
            Looks like it's for <span style={{ fontWeight: 700, color: F.fg1 }}>{suggestedName}</span>
            <span style={{
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: 10, color: F.primary700, marginLeft: 5,
            }}>· {confidence}%</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={{
            flex: 1, height: 32, borderRadius: 8, border: 'none',
            background: F.primary600, color: '#fff',
            fontSize: 12, fontWeight: 600, letterSpacing: -0.05, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            boxShadow: '0 3px 8px rgba(2,132,199,0.22)',
          }}>
            <i data-lucide="check" style={{ width: 13, height: 13 }} />
            Route to {suggestedName.split(' ')[0]}
          </button>
          <button style={{
            height: 32, padding: '0 11px', borderRadius: 8,
            background: F.surface, border: `1px solid ${F.border}`,
            color: F.fg2, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            {secondary}
            <i data-lucide="chevron-down" style={{ width: 12, height: 12 }} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reviewed item row (with undo) ────────────────────────────

function ReviewedRow({ kind, label, routedTo, routedBg, when, action = 'routed', undoCountdown, last }) {
  const isJunk = action === 'junked';
  const isReturn = action === 'returned';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px',
      borderBottom: last ? 'none' : `1px solid ${F.borderSub}`,
      background: undoCountdown ? '#fffbeb' : 'transparent',
    }}>
      <MailThumb kind={kind} size={36} dim={isJunk || isReturn} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12.5, fontWeight: 600, color: F.fg1, letterSpacing: -0.05,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          textDecoration: isJunk ? 'line-through' : 'none',
          textDecorationColor: F.fg4,
        }}>{label}</div>
        <div style={{
          fontSize: 11, color: F.fg3, marginTop: 1,
          display: 'inline-flex', alignItems: 'center', gap: 4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%',
        }}>
          <i data-lucide={
            isJunk ? 'trash-2' : isReturn ? 'undo-2' : 'arrow-right'
          } style={{ width: 10, height: 10, color: isJunk ? F.error600 : isReturn ? F.fg3 : F.fg2 }} />
          {action === 'routed' && (
            <>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '1px 6px', borderRadius: 9999,
                background: routedBg, color: F.fg1, fontWeight: 600, fontSize: 10.5,
              }}>{routedTo}</span>
            </>
          )}
          {isJunk && <span>Junked</span>}
          {isReturn && <span>Returned to sender</span>}
          <span style={{ color: F.fg4 }}>· {when}</span>
        </div>
      </div>
      {undoCountdown ? (
        <button style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '4px 10px', borderRadius: 9999,
          background: MD.rustBg, border: `1px solid #fcd34d`,
          color: MD.rustFg, fontSize: 11, fontWeight: 700, cursor: 'pointer',
          fontFamily: 'ui-monospace, Menlo, monospace',
        }}>
          <i data-lucide="undo-2" style={{ width: 11, height: 11 }} />
          Undo · {undoCountdown}s
        </button>
      ) : (
        <button style={{
          width: 28, height: 28, borderRadius: 7,
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: F.fg4,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i data-lucide="undo-2" style={{ width: 14, height: 14 }} />
        </button>
      )}
    </div>
  );
}

// ─── Finish-day sticky ────────────────────────────────────────

function FinishDay({ enabled, total, routed, junked, returned, remaining }) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'rgba(255,255,255,0.97)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      borderTop: `1px solid ${F.border}`,
      padding: '10px 16px 26px',
      zIndex: 10,
    }}>
      {/* mini summary line */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
        fontSize: 11, color: F.fg3, letterSpacing: -0.05,
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <i data-lucide="arrow-right" style={{ width: 11, height: 11, color: F.success }} />
          <span style={{ color: F.fg1, fontWeight: 700 }}>{routed}</span> routed
        </span>
        <span style={{ color: F.borderStrong }}>·</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <i data-lucide="trash-2" style={{ width: 11, height: 11, color: F.error600 }} />
          <span style={{ color: F.fg1, fontWeight: 700 }}>{junked}</span> junked
        </span>
        {returned > 0 && (
          <>
            <span style={{ color: F.borderStrong }}>·</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <i data-lucide="undo-2" style={{ width: 11, height: 11, color: F.fg3 }} />
              <span style={{ color: F.fg1, fontWeight: 700 }}>{returned}</span> returned
            </span>
          </>
        )}
        <span style={{ flex: 1 }} />
        {remaining > 0 && (
          <span style={{ color: MD.rustFg, fontWeight: 700 }}>
            {remaining} still pending
          </span>
        )}
      </div>
      <button disabled={!enabled} style={{
        width: '100%', height: 48, borderRadius: 12, border: 'none',
        background: enabled ? F.primary600 : F.sunken,
        color: enabled ? '#fff' : F.fg4,
        fontSize: 14.5, fontWeight: 600, cursor: enabled ? 'pointer' : 'not-allowed',
        boxShadow: enabled ? '0 6px 16px rgba(2,132,199,0.28)' : 'none',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        letterSpacing: -0.1,
      }}>
        <i data-lucide={enabled ? 'mail-check' : 'lock'} style={{ width: 16, height: 16 }} />
        Finish day · {total} pieces
      </button>
    </div>
  );
}

// ─── FRAME 1 · POPULATED ──────────────────────────────────────

function FrameMailDayPopulated() {
  return (
    <Phone>
      <TopBar title="My Mail Day" rightLabel="History" rightPrimary={false} />
      <ScrollArea bottomPad={130}>

        <DayHeader date="Thu · Oct 9" streak={12} done={6} total={8} />

        <ScanMoreCard since="22 min ago" />

        <Section overline={<>Needs a call <span style={{ color: F.fg4, fontWeight: 500 }}>· 2</span></>}>
          <UnreviewedItem
            kind="bill"
            label="Con Edison bill"
            sender="Con Edison · NY"
            suggestedAvatar="linear-gradient(135deg,#0ea5e9,#0369a1)"
            suggestedName="Maria Kovács"
            confidence={94}
            secondary="Other"
          />
          <UnreviewedItem
            kind="postcard"
            label="Postcard from Lisbon"
            sender="P. Almeida · Lisbon, PT"
            suggestedAvatar="linear-gradient(135deg,#16a34a,#15803d)"
            suggestedName="Marcus Khan"
            confidence={71}
            secondary="Route to…"
          />
        </Section>

        <Section overline={<>Reviewed today <span style={{ color: F.fg4, fontWeight: 500 }}>· 6</span></>} gap={0}>
          <Card padding={0}>
            <ReviewedRow
              kind="magazine"
              label="The New Yorker · Oct 9"
              routedTo="Marcus"
              routedBg={F.homeBg}
              when="2 min ago"
              undoCountdown={5}
            />
            <ReviewedRow
              kind="flyer"
              label="Whole Foods circular"
              when="14 min ago"
              action="junked"
            />
            <ReviewedRow
              kind="package"
              label="USPS package slip"
              routedTo="Maria"
              routedBg={F.primary100}
              when="38 min ago"
            />
            <ReviewedRow
              kind="envelope"
              label="Wedding invite · Costa Mesa"
              routedTo="Maria"
              routedBg={F.primary100}
              when="1 hr ago"
            />
            <ReviewedRow
              kind="bill"
              label="Spectrum statement"
              routedTo="House · Bills"
              routedBg={F.homeBg}
              when="2 hr ago"
            />
            <ReviewedRow
              kind="envelope"
              label="Unknown · no return address"
              when="3 hr ago"
              action="returned"
              last
            />
          </Card>
          <button style={{
            marginTop: 8, padding: '6px 10px', background: 'transparent', border: 'none',
            cursor: 'pointer', color: F.fg3, fontSize: 11.5, fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: 4,
            alignSelf: 'flex-start',
          }}>
            <i data-lucide="rotate-ccw" style={{ width: 12, height: 12 }} />
            Undo all from today
          </button>
        </Section>

      </ScrollArea>
      <FinishDay enabled={false} total={8} routed={4} junked={1} returned={1} remaining={2} />
    </Phone>
  );
}

// ─── FRAME 2 · EMPTY ──────────────────────────────────────────

function FrameMailDayEmpty() {
  return (
    <Phone>
      <TopBar title="My Mail Day" rightLabel="History" rightPrimary={false} />
      <ScrollArea bottomPad={130}>

        {/* Hero empty state */}
        <div style={{
          background: F.surface, borderRadius: 16,
          border: `1px solid ${F.border}`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          padding: '28px 20px 24px',
          textAlign: 'center', position: 'relative', overflow: 'hidden',
        }}>
          {/* tidy mailbox illustration */}
          <div style={{
            width: 120, height: 96, margin: '0 auto 16px', position: 'relative',
          }}>
            {/* shelf */}
            <div style={{
              position: 'absolute', bottom: 0, left: 6, right: 6, height: 8,
              background: '#a78bfa', borderRadius: 2, opacity: 0.7,
            }} />
            {/* mailbox body */}
            <div style={{
              position: 'absolute', left: 18, bottom: 8, width: 84, height: 64,
              background: 'linear-gradient(180deg,#f3f4f6 0%,#d1d5db 100%)',
              borderRadius: '6px 6px 4px 4px',
              border: '1px solid #9ca3af',
            }}>
              {/* slot */}
              <div style={{
                position: 'absolute', left: 14, top: 14, right: 14, height: 4,
                background: '#374151', borderRadius: 2,
              }} />
              {/* flag */}
              <div style={{
                position: 'absolute', right: -6, top: 18, width: 14, height: 12,
                background: '#dc2626', borderRadius: '0 2px 2px 0',
                boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
              }} />
              {/* "0" face */}
              <div style={{
                position: 'absolute', left: 0, right: 0, top: 24, textAlign: 'center',
                fontSize: 22, fontWeight: 800, color: '#9ca3af', letterSpacing: -1,
                fontFamily: 'ui-monospace, Menlo, monospace',
              }}>0</div>
            </div>
            {/* sparkles */}
            <div style={{
              position: 'absolute', left: 6, top: 10, width: 4, height: 4, borderRadius: '50%',
              background: '#fbbf24',
            }} />
            <div style={{
              position: 'absolute', right: 8, top: 6, width: 6, height: 6, borderRadius: '50%',
              background: '#fde68a',
            }} />
            <div style={{
              position: 'absolute', right: 2, top: 28, width: 3, height: 3, borderRadius: '50%',
              background: '#fbbf24',
            }} />
          </div>
          <div style={{
            fontSize: 19, fontWeight: 700, color: F.fg1, letterSpacing: -0.4, marginBottom: 6,
          }}>Nothing new today</div>
          <div style={{
            fontSize: 13, color: F.fg3, lineHeight: '18px', maxWidth: 240, margin: '0 auto',
          }}>
            No mail has been scanned since this morning. Drop today's stack on the scanner when you're ready.
          </div>

          {/* streak chip + last-scan */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 6, marginTop: 14,
          }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 9999,
              background: MD.rustBg, color: MD.rustFg,
              fontSize: 11, fontWeight: 700, letterSpacing: 0.1,
            }}>
              <i data-lucide="flame" style={{ width: 11, height: 11 }} />
              12-day streak
            </span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 9999,
              background: F.sunken, color: F.fg2,
              fontSize: 11, fontWeight: 600, letterSpacing: 0.05,
            }}>
              <i data-lucide="clock" style={{ width: 11, height: 11 }} />
              Last scan 9h ago
            </span>
          </div>
        </div>

        {/* Primary action — scan */}
        <button style={{
          width: '100%', height: 52, borderRadius: 14, border: 'none',
          background: F.primary600, color: '#fff',
          fontSize: 14.5, fontWeight: 600, cursor: 'pointer',
          boxShadow: '0 8px 18px rgba(2,132,199,0.3)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          letterSpacing: -0.1,
        }}>
          <i data-lucide="scan-line" style={{ width: 17, height: 17 }} />
          Scan today's stack
        </button>

        {/* Yesterday recap */}
        <Section overline="Yesterday's recap">
          <Card padding={0}>
            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${F.borderSub}` }}>
              <div style={{
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: F.fg1, letterSpacing: -0.1 }}>
                  Wed · Oct 8
                </div>
                <div style={{ fontSize: 11, color: F.fg3, letterSpacing: -0.05 }}>
                  7 pieces · closed 6:42 PM
                </div>
              </div>
              {/* stacked bar */}
              <div style={{
                height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex',
                background: F.sunken,
              }}>
                <div style={{ width: '57%', background: F.primary600 }} />
                <div style={{ width: '14%', background: F.home }} />
                <div style={{ width: '14%', background: F.error600 }} />
                <div style={{ width: '15%', background: F.fg4 }} />
              </div>
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8,
                fontSize: 10.5, color: F.fg3,
              }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: F.primary600 }} />
                  4 to Maria
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: F.home }} />
                  1 to Marcus
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: F.error600 }} />
                  1 junked
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: F.fg4 }} />
                  1 returned
                </span>
              </div>
            </div>
            <button style={{
              width: '100%', padding: '10px 14px', background: 'transparent',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: 12.5, fontWeight: 600, color: F.fg2, letterSpacing: -0.05,
            }}>
              <span>See full history</span>
              <i data-lucide="chevron-right" style={{ width: 15, height: 15, color: F.fg4 }} />
            </button>
          </Card>
        </Section>

        {/* Set-up nudge */}
        <Card padding={0}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px', borderBottom: `1px solid ${F.borderSub}`,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: F.primary50, color: F.primary600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <i data-lucide="bell" style={{ width: 16, height: 16 }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: F.fg1, letterSpacing: -0.05 }}>
                Daily reminder · 5:00 PM
              </div>
              <div style={{ fontSize: 11, color: F.fg3, marginTop: 1, lineHeight: '15px' }}>
                Ping me to scan before the day closes.
              </div>
            </div>
            <i data-lucide="chevron-right" style={{ width: 15, height: 15, color: F.fg4 }} />
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: F.homeBg, color: F.home,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <i data-lucide="users" style={{ width: 16, height: 16 }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: F.fg1, letterSpacing: -0.05 }}>
                Auto-route rules
              </div>
              <div style={{ fontSize: 11, color: F.fg3, marginTop: 1, lineHeight: '15px' }}>
                3 active · Con Ed always goes to Maria
              </div>
            </div>
            <i data-lucide="chevron-right" style={{ width: 15, height: 15, color: F.fg4 }} />
          </div>
        </Card>

      </ScrollArea>
    </Phone>
  );
}

Object.assign(window, { FrameMailDayPopulated, FrameMailDayEmpty });
