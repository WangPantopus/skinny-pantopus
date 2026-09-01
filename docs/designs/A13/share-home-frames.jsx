// Pantopus — A13.6 · Share home
// File: src/app/homes/[id]/share.tsx
// Archetype: A13 — Form (single screen), simple variant.
// Generate a scoped, expiring share link to a Pantopus home.
// Inherits Phone / TopBar / Section / Card / Input / Toggle from form-frames.jsx.
//
// Two frames:
//   FrameShareConfig — populated: tier + expiration + preview, "Create link" armed
//   FrameShareCreated — secondary: link created, copy + QR + share-targets state

const {
  F, Phone, TopBar, FieldLabel,
  Input, Section, ScrollArea, Card, Toggle,
} = window;

// ─── Home strip (re-used pattern) ──────────────────────────────

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
        <div style={{ fontSize: 11, color: F.fg3, marginTop: 1 }}>Bungalow · Park Slope, Brooklyn</div>
      </div>
    </div>
  );
}

// ─── Permission tier radio cards ───────────────────────────────

function TierRow({ icon, name, sub, badge, selected, last }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '12px 14px', cursor: 'pointer',
      borderBottom: last ? 'none' : `1px solid ${F.borderSub}`,
      background: selected ? F.primary50 : 'transparent',
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8,
        background: selected ? F.primary600 : F.sunken,
        color: selected ? '#fff' : F.fg2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, marginTop: 1,
      }}>
        <i data-lucide={icon} style={{ width: 15, height: 15 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        }}>
          <span style={{
            fontSize: 13.5, fontWeight: 600,
            color: selected ? F.primary700 : F.fg1,
            letterSpacing: -0.1,
          }}>{name}</span>
          {badge && (
            <span style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: 0.08,
              color: badge.fg, background: badge.bg, border: `1px solid ${badge.bd}`,
              padding: '2px 5px', borderRadius: 3, textTransform: 'uppercase',
            }}>{badge.label}</span>
          )}
        </div>
        <div style={{
          fontSize: 11.5, color: selected ? F.primary600 : F.fg3,
          marginTop: 2, lineHeight: '16px',
        }}>{sub}</div>
      </div>
      <div style={{
        width: 18, height: 18, borderRadius: '50%',
        border: `1.5px solid ${selected ? F.primary600 : F.borderStrong}`,
        background: selected ? F.primary600 : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, marginTop: 4,
      }}>
        {selected && (
          <span style={{
            width: 7, height: 7, borderRadius: '50%', background: '#fff',
          }} />
        )}
      </div>
    </label>
  );
}

// ─── Expiration segmented control ──────────────────────────────

function ExpirationPicker({ value }) {
  const options = ['24h', '7d', '30d', 'Never'];
  return (
    <div style={{
      display: 'flex', padding: 3, background: F.sunken,
      border: `1px solid ${F.border}`, borderRadius: 10, gap: 2,
    }}>
      {options.map(o => {
        const on = o === value;
        return (
          <button key={o} style={{
            flex: 1, height: 36, borderRadius: 8, border: 'none',
            background: on ? F.surface : 'transparent',
            color: on ? F.fg1 : F.fg3,
            fontSize: 13, fontWeight: on ? 600 : 500, letterSpacing: -0.05,
            cursor: 'pointer',
            boxShadow: on ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            fontFamily: o === 'Never' ? 'inherit' : 'ui-monospace, Menlo, monospace',
            fontVariantNumeric: 'tabular-nums',
          }}>{o}</button>
        );
      })}
    </div>
  );
}

// ─── Preview card (what recipient sees) ────────────────────────

function PreviewCard({ tier = 'view' }) {
  const canSee = {
    view:  { address: true,  history: false, owners: 'count', notes: false },
    contribute: { address: true, history: true, owners: 'names', notes: true },
    coowner: { address: true, history: true, owners: 'full', notes: true },
  }[tier];

  return (
    <div style={{
      background: F.surface, border: `1px solid ${F.border}`,
      borderRadius: 12, overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {/* Mini browser/app chrome */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 12px', background: F.muted,
        borderBottom: `1px solid ${F.border}`,
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fca5a5' }} />
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fcd34d' }} />
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#86efac' }} />
        </div>
        <div style={{
          flex: 1, height: 18, borderRadius: 4,
          background: F.surface, border: `1px solid ${F.border}`,
          display: 'flex', alignItems: 'center', padding: '0 8px',
          fontSize: 10, color: F.fg3,
          fontFamily: 'ui-monospace, Menlo, monospace',
        }}>
          <i data-lucide="lock" style={{ width: 9, height: 9, marginRight: 5, color: F.success600 }} />
          pantopus.app/h/elm-412/sh/k7q
        </div>
      </div>

      {/* Preview body */}
      <div style={{ padding: '14px 14px 16px' }}>
        {/* Hero — house thumbnail */}
        <div style={{
          height: 86, borderRadius: 8, marginBottom: 12,
          background: 'linear-gradient(160deg,#fde68a 0%,#fb923c 45%,#7c2d12 100%)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', left: '22%', right: '22%', bottom: '14%',
            height: '50%', background: '#451a03', borderRadius: '4px 4px 0 0',
          }} />
          <div style={{
            position: 'absolute', left: '40%', right: '40%', bottom: '14%',
            height: '28%', background: '#fef3c7',
          }} />
          <div style={{
            position: 'absolute', top: '14%', right: '20%',
            width: 14, height: 14, borderRadius: '50%',
            background: '#fef9c3',
            boxShadow: '0 0 16px rgba(254,249,195,0.7)',
          }} />
        </div>

        <div style={{
          fontSize: 14, fontWeight: 700, color: F.fg1, letterSpacing: -0.15,
        }}>412 Elm Street</div>
        <div style={{ fontSize: 11, color: F.fg3, marginTop: 1 }}>
          {canSee.address ? 'Park Slope, Brooklyn · NY 11215' : '·····················'}
        </div>

        {/* Permission rows */}
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Row label="Address" allowed value={canSee.address ? 'Visible' : 'Hidden'} />
          <Row label="Maintenance log" allowed={canSee.history}
               value={canSee.history ? 'Read access' : 'Hidden'} />
          <Row label="Co-owners" allowed
               value={canSee.owners === 'full' ? '3 owners + contact'
                    : canSee.owners === 'names' ? '3 names'
                    : 'Count only'} />
          <Row label="Internal notes" allowed={canSee.notes}
               value={canSee.notes ? 'Read & comment' : 'Hidden'} />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, allowed }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      fontSize: 11.5,
    }}>
      <i data-lucide={allowed ? 'check' : 'minus'} style={{
        width: 12, height: 12, strokeWidth: 3,
        color: allowed ? F.success600 : F.fg4,
        flexShrink: 0,
      }} />
      <span style={{ color: F.fg2, fontWeight: 500, flex: 1 }}>{label}</span>
      <span style={{
        color: allowed ? F.fg1 : F.fg4,
        fontWeight: 500, letterSpacing: -0.05,
      }}>{value}</span>
    </div>
  );
}

// ─── Sticky CTA ────────────────────────────────────────────────

function StickyCTA({ label, icon = 'link', disabled }) {
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
        background: disabled ? '#e5e7eb' : F.primary600,
        color: disabled ? F.fg4 : '#fff',
        fontSize: 15, fontWeight: 600, letterSpacing: -0.1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled ? 'none' : '0 6px 16px rgba(2,132,199,0.28)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <i data-lucide={icon} style={{ width: 17, height: 17 }} />
        {label}
      </button>
    </div>
  );
}

// ─── FRAME 1 · CONFIGURING ─────────────────────────────────────

function FrameShareConfig() {
  return (
    <Phone>
      <TopBar title="Share home" />
      <ScrollArea bottomPad={120}>

        <HomeStrip />

        {/* Tier */}
        <Section overline="Permission tier">
          <Card padding={0}>
            <TierRow
              icon="eye"
              name="Viewer"
              sub="Sees address, photos, and a count of co-owners. No history, no notes."
            />
            <TierRow
              icon="message-square-plus"
              name="Contributor"
              sub="Adds maintenance entries and reads owner names. Can't change membership."
              badge={{ label: 'Recommended', fg: F.primary700, bg: F.primary50, bd: F.primary100 }}
              selected
            />
            <TierRow
              icon="key-round"
              name="Co-owner (sponsored)"
              sub="Full read/write. They accept an invite and join the deed."
              last
            />
          </Card>
        </Section>

        {/* Expiration */}
        <Section overline="Link expires">
          <ExpirationPicker value="7d" />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', background: F.surface,
            border: `1px solid ${F.border}`, borderRadius: 10,
          }}>
            <i data-lucide="user-check" style={{
              width: 15, height: 15, color: F.fg3, flexShrink: 0,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: F.fg1, letterSpacing: -0.1 }}>
                Require sign-in to open
              </div>
              <div style={{ fontSize: 11, color: F.fg3, marginTop: 1 }}>
                Recipient must have a Pantopus account.
              </div>
            </div>
            <Toggle on />
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', background: F.surface,
            border: `1px solid ${F.border}`, borderRadius: 10,
          }}>
            <i data-lucide="bell-ring" style={{
              width: 15, height: 15, color: F.fg3, flexShrink: 0,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: F.fg1, letterSpacing: -0.1 }}>
                Notify me on first open
              </div>
              <div style={{ fontSize: 11, color: F.fg3, marginTop: 1 }}>
                Get a ping when the link is used.
              </div>
            </div>
            <Toggle on={false} />
          </div>
        </Section>

        {/* Preview */}
        <Section overline="What they'll see">
          <PreviewCard tier="contribute" />
        </Section>

      </ScrollArea>
      <StickyCTA label="Create share link" />
    </Phone>
  );
}

// ─── FRAME 2 · LINK CREATED (secondary state) ──────────────────

function ShareTarget({ icon, label, bg, fg }) {
  return (
    <button style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 6, padding: '10px 4px', background: 'transparent', border: 'none',
      cursor: 'pointer',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: bg, color: fg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        <i data-lucide={icon} style={{ width: 19, height: 19 }} />
      </div>
      <div style={{
        fontSize: 10.5, fontWeight: 600, color: F.fg2, letterSpacing: -0.05,
      }}>{label}</div>
    </button>
  );
}

// Synthetic QR — modular grid of small squares (decorative, not scannable)
function QrCode({ size = 132 }) {
  // 21x21 modules — fixed pattern derived from a seed so it looks like a real QR
  const N = 21;
  const cells = [];
  let seed = 7;
  for (let i = 0; i < N * N; i++) {
    // LCG-ish
    seed = (seed * 9301 + 49297) % 233280;
    cells.push(seed / 233280 > 0.5);
  }
  // Finder patterns at three corners
  const isFinder = (r, c) => {
    const inCorner = (r0, c0) => r >= r0 && r < r0 + 7 && c >= c0 && c < c0 + 7;
    return inCorner(0, 0) || inCorner(0, N - 7) || inCorner(N - 7, 0);
  };
  const finderOn = (r, c) => {
    const local = (r0, c0) => {
      const dr = r - r0, dc = c - c0;
      if (dr === 0 || dr === 6 || dc === 0 || dc === 6) return true;
      if (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4) return true;
      return false;
    };
    if (r < 7 && c < 7) return local(0, 0);
    if (r < 7 && c >= N - 7) return local(0, N - 7);
    if (r >= N - 7 && c < 7) return local(N - 7, 0);
    return false;
  };
  const cell = size / N;

  return (
    <div style={{
      width: size, height: size, position: 'relative',
      background: '#fff', padding: 6, boxSizing: 'content-box',
      borderRadius: 8, border: `1px solid ${F.border}`,
    }}>
      <svg width={size} height={size} viewBox={`0 0 ${N} ${N}`} style={{ display: 'block' }}>
        {Array.from({ length: N * N }).map((_, i) => {
          const r = Math.floor(i / N);
          const c = i % N;
          const on = isFinder(r, c) ? finderOn(r, c) : cells[i];
          if (!on) return null;
          return <rect key={i} x={c} y={r} width={1} height={1} fill="#111827" />;
        })}
      </svg>
    </div>
  );
}

function CreatedHero() {
  return (
    <div style={{
      padding: '16px 14px 18px',
      background: 'linear-gradient(180deg,#ecfeff 0%, #f0fdf4 100%)',
      border: `1px solid ${F.successBg}`,
      borderRadius: 14,
    }}>
      {/* check ring */}
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        background: F.success600, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 0 6px rgba(5,150,105,0.10)',
        marginBottom: 12,
      }}>
        <i data-lucide="check" style={{ width: 22, height: 22, strokeWidth: 3 }} />
      </div>

      <div style={{
        fontSize: 17, fontWeight: 700, color: F.fg1, letterSpacing: -0.2,
      }}>Link ready</div>
      <div style={{ fontSize: 12, color: F.fg3, marginTop: 2, lineHeight: '17px' }}>
        Contributor access · expires in 7 days · sign-in required
      </div>

      {/* URL row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginTop: 14, padding: '10px 12px',
        background: F.surface, border: `1px solid ${F.border}`,
        borderRadius: 10,
      }}>
        <i data-lucide="link" style={{ width: 14, height: 14, color: F.fg3, flexShrink: 0 }} />
        <span style={{
          flex: 1, minWidth: 0, overflow: 'hidden',
          fontFamily: 'ui-monospace, Menlo, monospace',
          fontSize: 12.5, color: F.fg1, letterSpacing: -0.05,
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>pantopus.app/h/elm-412/sh/k7q9-rf</span>
        <button style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '5px 9px', borderRadius: 7, border: 'none',
          background: F.primary600, color: '#fff',
          fontSize: 11.5, fontWeight: 600, letterSpacing: -0.05,
          cursor: 'pointer',
          boxShadow: '0 1px 3px rgba(2,132,199,0.30)',
        }}>
          <i data-lucide="copy" style={{ width: 12, height: 12 }} />
          Copy
        </button>
      </div>

      {/* tiny meta row */}
      <div style={{
        display: 'flex', gap: 14, marginTop: 12,
        fontSize: 11, color: F.fg3,
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <i data-lucide="eye-off" style={{ width: 11, height: 11 }} />
          0 opens
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <i data-lucide="calendar-clock" style={{ width: 11, height: 11 }} />
          Expires Jun 2
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
          <button style={{
            background: 'transparent', border: 'none', padding: 0,
            color: F.error600, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 3,
          }}>
            <i data-lucide="rotate-ccw" style={{ width: 11, height: 11 }} />
            Revoke
          </button>
        </span>
      </div>
    </div>
  );
}

function FrameShareCreated() {
  return (
    <Phone>
      <TopBar title="Share home" />
      <ScrollArea bottomPad={120}>

        <CreatedHero />

        {/* QR */}
        <Section overline="Scan to open">
          <div style={{
            display: 'flex', gap: 14, alignItems: 'center',
            padding: 14, background: F.surface,
            border: `1px solid ${F.border}`, borderRadius: 12,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <QrCode size={120} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: F.fg1, letterSpacing: -0.1,
              }}>Hand it across the porch</div>
              <div style={{
                fontSize: 11.5, color: F.fg3, marginTop: 4, lineHeight: '16px',
              }}>
                Anyone with the QR opens the same scoped link. Same 7-day clock.
              </div>
              <button style={{
                marginTop: 10,
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '6px 10px', borderRadius: 8,
                background: F.surface, border: `1px solid ${F.border}`,
                color: F.fg2, fontSize: 11.5, fontWeight: 600,
                cursor: 'pointer', letterSpacing: -0.05,
              }}>
                <i data-lucide="download" style={{ width: 12, height: 12 }} />
                Save QR
              </button>
            </div>
          </div>
        </Section>

        {/* Share targets */}
        <Section overline="Send via">
          <div style={{
            display: 'flex', gap: 4, padding: '6px 4px',
            background: F.surface, border: `1px solid ${F.border}`,
            borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <ShareTarget icon="message-circle" label="Messages" bg="#dcfce7" fg="#15803d" />
            <ShareTarget icon="mail"           label="Mail"     bg="#dbeafe" fg="#1d4ed8" />
            <ShareTarget icon="send"           label="Telegram" bg="#cffafe" fg="#0e7490" />
            <ShareTarget icon="qr-code"        label="AirDrop"  bg={F.sunken} fg={F.fg2} />
            <ShareTarget icon="more-horizontal" label="More"    bg={F.sunken} fg={F.fg2} />
          </div>
        </Section>

        {/* Activity placeholder */}
        <Section overline="Activity">
          <div style={{
            padding: '14px 14px',
            background: F.surface, border: `1px dashed ${F.borderStrong}`,
            borderRadius: 12,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: F.sunken, color: F.fg3,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <i data-lucide="footprints" style={{ width: 15, height: 15 }} />
            </div>
            <div style={{ fontSize: 12, color: F.fg3, lineHeight: '16px' }}>
              No opens yet. We'll list everyone who follows the link here.
            </div>
          </div>
        </Section>

      </ScrollArea>

      {/* Sticky — done / new link */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderTop: `1px solid ${F.border}`,
        padding: '12px 16px 28px', zIndex: 10,
        display: 'flex', gap: 8,
      }}>
        <button style={{
          flex: 1, height: 46, borderRadius: 12,
          background: F.surface, color: F.fg1,
          border: `1px solid ${F.border}`,
          fontSize: 14, fontWeight: 600, letterSpacing: -0.1, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <i data-lucide="plus" style={{ width: 14, height: 14 }} />
          Another link
        </button>
        <button style={{
          flex: 1.4, height: 46, borderRadius: 12, border: 'none',
          background: F.primary600, color: '#fff',
          fontSize: 14, fontWeight: 600, letterSpacing: -0.1, cursor: 'pointer',
          boxShadow: '0 6px 16px rgba(2,132,199,0.28)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        }}>
          <i data-lucide="check" style={{ width: 15, height: 15 }} />
          Done
        </button>
      </div>
    </Phone>
  );
}

Object.assign(window, { FrameShareConfig, FrameShareCreated });
