// Pantopus — A13.13 · Manage train (organizer controls)
// File: src/app/support-trains/[id]/manage.tsx
// Archetype: A13 — Form (single screen), simple variant.
// Inherits Phone / TopBar / Section / Input / Textarea / OverlineLabel from form-frames.jsx.
//
// Two frames:
//   FrameManageTrainPopulated — active train, draft update ready, all controls live
//   FrameManageTrainClosing   — close-train confirmation sheet over the screen (secondary state)

const {
  F, Phone, TopBar, OverlineLabel, FieldLabel,
  Input, Textarea, Section, ScrollArea, Card, Toggle,
} = window;

// ─── Local atoms ───────────────────────────────────────────────

function StatCell({ value, label, tone = 'default', last }) {
  const valueColor =
    tone === 'success' ? F.success600 :
    tone === 'warn'    ? '#b45309' :
                         F.fg1;
  return (
    <div style={{
      flex: 1, padding: '12px 4px',
      borderRight: last ? 'none' : `1px solid ${F.borderSub}`,
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: 19, fontWeight: 700, color: valueColor,
        letterSpacing: -0.4, fontFamily: 'ui-sans-serif, system-ui',
        fontVariantNumeric: 'tabular-nums', lineHeight: '22px',
      }}>{value}</div>
      <div style={{
        fontSize: 10, fontWeight: 600, color: F.fg3,
        textTransform: 'uppercase', letterSpacing: '0.06em',
        marginTop: 3,
      }}>{label}</div>
    </div>
  );
}

function TrainContextStrip({ active = true }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 12px',
      background: active ? '#fff7ed' : F.sunken,
      border: `1px solid ${active ? '#fed7aa' : F.border}`,
      borderRadius: 10,
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 9,
        background: active ? 'linear-gradient(135deg,#fb923c,#c2410c)'
                           : `linear-gradient(135deg,${F.fg4},${F.fg3})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', flexShrink: 0,
      }}>
        <i data-lucide="utensils" style={{ width: 16, height: 16 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 600, color: F.fg1,
          letterSpacing: -0.15,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>Meals for the Murphy family</div>
        <div style={{
          fontSize: 11, color: '#9a3412', marginTop: 1,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <i data-lucide="calendar" style={{ width: 10, height: 10 }} />
          May 18 → Jun 7 · 21 days
        </div>
      </div>
      <span style={{
        fontSize: 9.5, fontWeight: 700, letterSpacing: 0.1,
        color: active ? '#15803d' : F.fg3,
        background: active ? '#dcfce7' : F.sunken,
        border: `1px solid ${active ? '#bbf7d0' : F.border}`,
        padding: '3px 7px', borderRadius: 4, textTransform: 'uppercase',
        display: 'inline-flex', alignItems: 'center', gap: 4,
      }}>
        {active && (
          <span style={{
            width: 5, height: 5, borderRadius: '50%',
            background: '#15803d',
          }} />
        )}
        {active ? 'Active' : 'Closed'}
      </span>
    </div>
  );
}

function ControlRow({ icon, iconBg, iconFg, label, meta, sub, danger, last, trailing }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px', cursor: 'pointer',
      borderBottom: last ? 'none' : `1px solid ${F.borderSub}`,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: iconBg, color: iconFg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <i data-lucide={icon} style={{ width: 16, height: 16 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{
            fontSize: 13.5, fontWeight: 600,
            color: danger ? F.error600 : F.fg1,
            letterSpacing: -0.1,
          }}>{label}</span>
          {meta && (
            <span style={{
              fontSize: 10.5, fontWeight: 600,
              background: F.sunken, color: F.fg2,
              padding: '1px 6px', borderRadius: 9999,
              fontVariantNumeric: 'tabular-nums',
            }}>{meta}</span>
          )}
        </div>
        {sub && (
          <div style={{
            fontSize: 11, color: F.fg3, marginTop: 2, lineHeight: '15px',
          }}>{sub}</div>
        )}
      </div>
      {trailing || (
        <i data-lucide="chevron-right" style={{
          width: 16, height: 16, color: F.fg4, flexShrink: 0,
        }} />
      )}
    </div>
  );
}

function AudienceChip({ label, count, selected }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '7px 11px', borderRadius: 9999,
      background: selected ? F.primary50 : F.surface,
      color: selected ? F.primary700 : F.fg2,
      border: selected ? `1px solid ${F.primary100}` : `1px solid ${F.border}`,
      fontSize: 12.5, fontWeight: selected ? 600 : 500,
      letterSpacing: -0.1, cursor: 'pointer',
      boxShadow: selected ? '0 1px 2px rgba(2,132,199,0.10)' : 'none',
    }}>
      {selected && <i data-lucide="check" style={{ width: 12, height: 12, strokeWidth: 3 }} />}
      {label}
      <span style={{
        fontSize: 11, fontWeight: 600,
        color: selected ? F.primary600 : F.fg4,
        fontVariantNumeric: 'tabular-nums',
      }}>{count}</span>
    </span>
  );
}

function SlotPreview() {
  // 21 slot dots: 18 filled, 1 dropout, 2 open
  const dots = [
    ...Array(11).fill('filled'),
    'dropout',
    ...Array(7).fill('filled'),
    'open', 'open',
  ];
  const fillColor = (s) =>
    s === 'filled'  ? F.success600 :
    s === 'dropout' ? F.error600 :
                      F.borderStrong;
  return (
    <div style={{
      padding: '10px 12px',
      background: F.surface, border: `1px solid ${F.border}`,
      borderRadius: 10,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 8,
      }}>
        <span style={{
          fontSize: 11, fontWeight: 600, color: F.fg2, letterSpacing: -0.05,
        }}>Slot fill</span>
        <span style={{
          fontSize: 11, color: F.fg3, fontVariantNumeric: 'tabular-nums',
        }}>18 / 21 · 86%</span>
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {dots.map((s, i) => (
          <div key={i} style={{
            width: 10, height: 10, borderRadius: 3,
            background: fillColor(s),
            border: s === 'open' ? `1px dashed ${F.borderStrong}` : 'none',
            boxSizing: 'border-box',
          }} />
        ))}
      </div>
      <div style={{
        display: 'flex', gap: 12, marginTop: 8,
        fontSize: 10, color: F.fg3,
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 7, height: 7, borderRadius: 2, background: F.success600 }} /> Filled 18
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 7, height: 7, borderRadius: 2, background: F.error600 }} /> Drop 1
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 7, height: 7, borderRadius: 2, border: `1px dashed ${F.borderStrong}`, boxSizing: 'border-box' }} /> Open 2
        </span>
      </div>
    </div>
  );
}

function StickyCTA({ label, disabled, icon = 'send' }) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'rgba(255,255,255,0.96)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      borderTop: `1px solid ${F.border}`,
      padding: '12px 16px 28px', zIndex: 10,
    }}>
      <button disabled={disabled} style={{
        width: '100%', height: 46, borderRadius: 12, border: 'none',
        background: disabled ? '#e5e7eb' : F.primary600,
        color: disabled ? F.fg4 : '#fff',
        fontSize: 14, fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled ? 'none' : '0 6px 16px rgba(2,132,199,0.28)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        letterSpacing: -0.1,
      }}>
        <i data-lucide={icon} style={{ width: 16, height: 16 }} />
        {label}
      </button>
    </div>
  );
}

// ─── Shared management body (used by both frames; dimmed in frame 2) ───

function ManageBody({ dim }) {
  return (
    <ScrollArea bottomPad={110}>

      <TrainContextStrip active />

      {/* At-a-glance stats */}
      <Card padding={0}>
        <div style={{ display: 'flex' }}>
          <StatCell value="18/21" label="Slots" tone="success" />
          <StatCell value="12" label="Helpers" />
          <StatCell value="9d" label="Left" />
          <StatCell value="1" label="Dropout" tone="warn" last />
        </div>
      </Card>

      <SlotPreview />

      {/* Compose update — the form */}
      <Section overline="Send an update">
        <div>
          <FieldLabel>Message</FieldLabel>
          <Textarea
            value={`Quick note from Daniel — Theo had a rough night so we'll push Tuesday's drop to 6:30pm. Anything cold-friendly is perfect. Thank you all, truly.`}
            height={108}
            charCount="168 / 500"
          />
        </div>
        <div>
          <FieldLabel>Audience</FieldLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <AudienceChip label="All helpers" count="12" selected />
            <AudienceChip label="Upcoming only" count="6" />
            <AudienceChip label="Family" count="3" />
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', background: F.surface,
          border: `1px solid ${F.border}`, borderRadius: 10,
        }}>
          <i data-lucide="bell" style={{ width: 15, height: 15, color: F.fg3, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: F.fg1, letterSpacing: -0.1 }}>
              Push to phones
            </div>
            <div style={{ fontSize: 11, color: F.fg3, marginTop: 1 }}>
              Otherwise it lands in their inbox only.
            </div>
          </div>
          <Toggle on />
        </div>
      </Section>

      {/* Organize controls */}
      <Section overline="Organize">
        <Card padding={0}>
          <ControlRow
            icon="calendar-cog" iconBg="#fef3c7" iconFg="#b45309"
            label="Edit dates & slots"
            meta="21"
            sub="Add, swap, or remove cooking days. Helpers see live changes."
          />
          <ControlRow
            icon="user-plus" iconBg={F.primary50} iconFg={F.primary600}
            label="Invite more helpers"
            sub="Share a link or pick from neighbors who follow this train."
          />
          <ControlRow
            icon="bar-chart-3" iconBg={F.successBg} iconFg={F.success600}
            label="Analytics"
            sub="Fill rate, response time, top contributors — last 21 days."
            last
          />
        </Card>
      </Section>

      {/* Danger */}
      <Section overline="Wind down">
        <Card padding={0}>
          <ControlRow
            icon="archive" iconBg={F.errorBg} iconFg={F.error600}
            label="Close train"
            sub="Lock new signups and send a thank-you to everyone."
            danger last
          />
        </Card>
      </Section>

      {dim && <div style={{ height: 4 }} />}
    </ScrollArea>
  );
}

// ─── FRAME · POPULATED ─────────────────────────────────────────

function FrameManageTrainPopulated() {
  return (
    <Phone>
      <TopBar title="Manage train" />
      <ManageBody />
      <StickyCTA label="Send update" />
    </Phone>
  );
}

// ─── FRAME · SECONDARY (close confirmation sheet) ──────────────

function CloseTrainSheet() {
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

      {/* sheet */}
      <div style={{
        position: 'relative', background: F.surface,
        borderTopLeftRadius: 22, borderTopRightRadius: 22,
        padding: '10px 16px 28px',
        boxShadow: '0 -12px 32px rgba(17,24,39,0.18)',
      }}>
        {/* grabber */}
        <div style={{
          width: 38, height: 4, borderRadius: 2, background: F.borderStrong,
          margin: '0 auto 14px',
        }} />

        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: F.errorBg, color: F.error600,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <i data-lucide="archive" style={{ width: 17, height: 17 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 16, fontWeight: 700, color: F.fg1, letterSpacing: -0.2,
            }}>Close support train?</div>
            <div style={{ fontSize: 11.5, color: F.fg3, marginTop: 1 }}>
              Locks new signups · 9 days early
            </div>
          </div>
        </div>

        {/* Summary card — sent on close */}
        <div style={{
          padding: '12px 14px', background: F.muted,
          border: `1px solid ${F.border}`, borderRadius: 10,
          marginBottom: 14,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 600, color: F.fg3,
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
          }}>What helpers will see</div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 17, fontWeight: 700, color: F.fg1, letterSpacing: -0.3,
                fontVariantNumeric: 'tabular-nums',
              }}>18</div>
              <div style={{ fontSize: 10, color: F.fg3, marginTop: 1 }}>Meals delivered</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 17, fontWeight: 700, color: F.fg1, letterSpacing: -0.3,
                fontVariantNumeric: 'tabular-nums',
              }}>12</div>
              <div style={{ fontSize: 10, color: F.fg3, marginTop: 1 }}>Neighbors helped</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 17, fontWeight: 700, color: F.fg1, letterSpacing: -0.3,
                fontVariantNumeric: 'tabular-nums',
              }}>12d</div>
              <div style={{ fontSize: 10, color: F.fg3, marginTop: 1 }}>Of coverage</div>
            </div>
          </div>
          <div style={{
            fontSize: 12.5, color: F.fg2, lineHeight: '17px',
            padding: '8px 10px', background: F.surface,
            border: `1px solid ${F.border}`, borderRadius: 8,
            fontStyle: 'italic',
          }}>
            "Theo's eating, sleeping, and chubbing up. We can take it from here. From the bottom of our spoon drawer — thank you." — Daniel
          </div>
        </div>

        <div>
          <FieldLabel>Thank-you note (optional)</FieldLabel>
          <Textarea
            value=""
            placeholder="A few words for everyone who showed up…"
            height={66}
          />
        </div>

        {/* Action row */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button style={{
            flex: 1, height: 46, borderRadius: 12,
            background: F.surface, color: F.fg1,
            border: `1px solid ${F.border}`,
            fontSize: 14, fontWeight: 600, letterSpacing: -0.1, cursor: 'pointer',
          }}>Cancel</button>
          <button style={{
            flex: 1.4, height: 46, borderRadius: 12, border: 'none',
            background: F.error600, color: '#fff',
            fontSize: 14, fontWeight: 600, letterSpacing: -0.1, cursor: 'pointer',
            boxShadow: '0 6px 16px rgba(220,38,38,0.28)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          }}>
            <i data-lucide="archive" style={{ width: 15, height: 15 }} />
            Close & thank
          </button>
        </div>
      </div>
    </div>
  );
}

function FrameManageTrainClosing() {
  return (
    <Phone>
      <TopBar title="Manage train" />
      <ManageBody dim />
      <CloseTrainSheet />
    </Phone>
  );
}

Object.assign(window, { FrameManageTrainPopulated, FrameManageTrainClosing });
