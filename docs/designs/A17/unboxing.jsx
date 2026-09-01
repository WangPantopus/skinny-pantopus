// MailUnboxingScreen — A17 archetype × Unboxing variant.
// Scan-first capture flow: you point the camera at a just-delivered
// item (and its papers), Pantopus reads + classifies it, suggests a
// drawer, and you Confirm or re-route.
// Slots beyond the archetype:
//   - Camera capture (live viewfinder + shutter)
//   - Captured thumbnails (filmstrip of shots)
//   - AI-classified drawer suggestion (+ confidence, re-route)
//   - Extracted facts read off the receipt / label (OCR)
//   - Primary action: Confirm  ·  Secondary state: Filed

// ── Data ───────────────────────────────────────────────────
const UB = {
  accent:    '#0d9488',   // teal — scan / capture
  accentDk:  '#0f766e',
  accentBg:  '#f0fdfa',
  accentBd:  '#99f6e4',
  category:  'Unboxing',
  time:      'Just now',
  item:      'Breville Barista Express',
  itemSub:   'Espresso machine · model BES870XL',
};

// captured thumbnails — what the lens saw, in order
const SHOTS = [
  { tag: 'UNIT',    label: 'The machine', main: true },
  { tag: 'BOX',     label: 'Box + barcode' },
  { tag: 'RECEIPT', label: 'Store receipt' },
  { tag: 'LABEL',   label: 'Serial label' },
];

// the suggested drawer, plus re-route alternatives
const SUGGEST = {
  drawer: 'Home',
  folder: 'Warranties & Receipts',
  icon: 'home',
  swatch: 'var(--color-identity-home)',
  swatchBg: 'var(--color-identity-home-bg)',
  conf: 96,
};
const ALTS = [
  { drawer: 'Me',  folder: 'Receipts & purchases', icon: 'user',     swatch: 'var(--color-identity-personal)' },
  { drawer: 'Biz', folder: 'Equipment & assets',   icon: 'briefcase', swatch: 'var(--color-identity-business)' },
];

// facts Pantopus read straight off the receipt + label
const FACTS = [
  { icon: 'package',       label: 'Product',        value: 'Breville Barista Express', note: 'BES870XL · Stainless' },
  { icon: 'hash',          label: 'Serial',         value: 'BES870-22F-091473', mono: true },
  { icon: 'receipt',       label: 'Purchased',      value: 'May 28, 2026 · $699.95', note: 'Williams Sonoma · card ••4417' },
  { icon: 'shield-check',  label: 'Warranty until', value: 'May 28, 2028', tag: '2-yr', tagBg: 'var(--color-success-bg)', tagFg: '#047857' },
];

const ELF_CLASSIFY = {
  headline: 'Pantopus sorted this unboxing',
  summary: 'I read all four shots — this is your new Breville espresso machine with its receipt and serial label. It belongs in Home, under Warranties & Receipts. Confirm and I\u2019ll file the photos, register the product, and set a warranty reminder.',
  bullets: [
    { icon: 'scan-text',     label: 'Receipt + label read', text: 'price, date & serial pulled' },
    { icon: 'folder-check',  label: 'Best match: Home',     text: 'Warranties & Receipts · 96%' },
    { icon: 'shield-check',  label: '2-year warranty',      text: 'expires May 28, 2028' },
  ],
};
const ELF_FILED = {
  headline: 'Filed — here\u2019s what I set up',
  summary: 'All four photos are in your Vault and the espresso machine is now a tracked product in Home. I scheduled a reminder before the warranty lapses, so you\u2019ll never lose the receipt when you need it.',
  bullets: [
    { icon: 'box',            label: 'Product registered', text: 'Breville Barista Express' },
    { icon: 'calendar-clock', label: 'Warranty reminder',  text: 'Apr 28, 2028 · 30 days before' },
    { icon: 'archive',        label: '4 photos saved',      text: 'original scans kept in Vault' },
  ],
};

// ── Card shells ────────────────────────────────────────────
function UbCard({ children, style = {}, noPad = false }) {
  return (
    <div style={{
      position: 'relative', background: '#fff', border: '1px solid var(--app-border)',
      borderRadius: 16, padding: noPad ? 0 : 14, overflow: 'hidden',
      boxShadow: '0 1px 2px rgba(0,0,0,0.03)', ...style,
    }}>{children}</div>
  );
}
function UbLabel({ children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{children}</div>
      {right}
    </div>
  );
}

// striped placeholder fill (camera feed / thumbs) — never a hand-drawn object
function stripe(angle = 45, a = 'rgba(255,255,255,0.05)', b = 'transparent') {
  return `repeating-linear-gradient(${angle}deg, ${a} 0, ${a} 1px, ${b} 1px, ${b} 9px)`;
}

// ── Top nav ────────────────────────────────────────────────
function UnboxNav() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '6px 8px 8px 4px', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--app-border-subtle)', gap: 4,
    }}>
      <button style={ubNavBtn}>
        <i data-lucide="chevron-left" style={{ width: 22, height: 22 }}></i>
        <span style={{ fontSize: 15, fontWeight: 500, marginLeft: -2 }}>Mailbox</span>
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: UB.accent }}></span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg2)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Unboxing</span>
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        <button style={ubNavIco}><i data-lucide="image" style={{ width: 18, height: 18 }}></i></button>
        <button style={ubNavIco}><i data-lucide="more-horizontal" style={{ width: 18, height: 18 }}></i></button>
      </div>
    </div>
  );
}
const ubNavBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 2, border: 'none', background: 'transparent',
  color: 'var(--color-primary-600)', padding: '6px 6px', cursor: 'pointer', borderRadius: 8,
};
const ubNavIco = {
  width: 34, height: 34, borderRadius: 9999, border: 'none', background: 'var(--app-surface-sunken)',
  color: 'var(--fg2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
};

// status chip in the header row (replaces sender trust — this is a self-capture)
function StateChip({ icon, label, filed }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px 3px 7px',
      borderRadius: 9999, fontSize: 10, fontWeight: 700, lineHeight: 1,
      background: filed ? 'var(--color-success-bg)' : UB.accentBg,
      color: filed ? '#047857' : UB.accentDk,
      border: `1px solid ${filed ? '#bbf7d0' : UB.accentBd}`,
    }}>
      <i data-lucide={icon} style={{ width: 11, height: 11 }}></i>
      {label}
    </span>
  );
}

// ── Camera capture — live viewfinder (classified state) ────
function Viewfinder() {
  const corner = (pos) => ({
    position: 'absolute', width: 22, height: 22, borderColor: 'rgba(255,255,255,0.9)',
    borderStyle: 'solid', borderWidth: 0, ...pos,
  });
  return (
    <div style={{
      position: 'relative', borderRadius: 16, overflow: 'hidden',
      background: 'radial-gradient(120% 90% at 50% 0%, #2b2723 0%, #161412 70%)',
      border: '1px solid #0a0a0a', boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
    }}>
      {/* live feed area */}
      <div style={{ position: 'relative', height: 208, backgroundImage: stripe(45, 'rgba(255,255,255,0.05)') }}>
        {/* subtle object hint */}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em',
            color: 'rgba(255,255,255,0.34)', textTransform: 'uppercase',
          }}>live · rear camera</span>
        </div>

        {/* framing brackets */}
        <div style={{ position: 'absolute', inset: 22 }}>
          <div style={corner({ top: 0, left: 0, borderTopWidth: 2.5, borderLeftWidth: 2.5, borderTopLeftRadius: 6 })}></div>
          <div style={corner({ top: 0, right: 0, borderTopWidth: 2.5, borderRightWidth: 2.5, borderTopRightRadius: 6 })}></div>
          <div style={corner({ bottom: 0, left: 0, borderBottomWidth: 2.5, borderLeftWidth: 2.5, borderBottomLeftRadius: 6 })}></div>
          <div style={corner({ bottom: 0, right: 0, borderBottomWidth: 2.5, borderRightWidth: 2.5, borderBottomRightRadius: 6 })}></div>
        </div>
        {/* scan line */}
        <div style={{
          position: 'absolute', left: 22, right: 22, top: '54%', height: 2, borderRadius: 2,
          background: `linear-gradient(90deg, transparent, ${UB.accent}, transparent)`,
          boxShadow: `0 0 12px ${UB.accent}`,
        }}></div>

        {/* top overlay row */}
        <div style={{
          position: 'absolute', top: 10, left: 10, right: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 9999,
            background: 'rgba(13,148,136,0.9)', color: '#fff', fontSize: 10.5, fontWeight: 700,
            backdropFilter: 'blur(4px)',
          }}>
            <i data-lucide="scan-line" style={{ width: 12, height: 12 }}></i>
            Item detected
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 9999,
            background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: 10.5, fontWeight: 600, backdropFilter: 'blur(4px)',
          }}>
            <i data-lucide="zap" style={{ width: 11, height: 11 }}></i>
            Auto
          </span>
        </div>
      </div>

      {/* control deck */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 18px 14px', background: 'linear-gradient(180deg, #161412 0%, #000 100%)',
      }}>
        <button style={ubFeedBtn}>
          <i data-lucide="images" style={{ width: 18, height: 18 }}></i>
        </button>
        {/* shutter */}
        <button style={{
          width: 58, height: 58, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.85)',
          background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ width: 44, height: 44, borderRadius: '50%', background: '#fff' }}></span>
        </button>
        <button style={ubFeedBtn}>
          <i data-lucide="refresh-cw" style={{ width: 18, height: 18 }}></i>
        </button>
      </div>
    </div>
  );
}
const ubFeedBtn = {
  width: 40, height: 40, borderRadius: 12, border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.06)', color: '#fff',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
};

// ── Captured thumbnails filmstrip ──────────────────────────
function ThumbStrip() {
  return (
    <UbCard noPad>
      <div style={{ padding: '11px 14px 9px' }}>
        <UbLabel right={
          <span style={{ fontSize: 11, color: 'var(--fg3)', fontWeight: 600 }}>{SHOTS.length} shots</span>
        }>Captured</UbLabel>
      </div>
      <div style={{ display: 'flex', gap: 10, padding: '0 14px 14px', overflowX: 'auto' }}>
        {SHOTS.map((s, i) => (
          <div key={i} style={{ flexShrink: 0, width: 72 }}>
            <div style={{
              position: 'relative', width: 72, height: 88, borderRadius: 10, overflow: 'hidden',
              background: '#1d1b19', backgroundImage: stripe(45, 'rgba(255,255,255,0.06)'),
              border: s.main ? `2px solid ${UB.accent}` : '1px solid var(--app-border)',
            }}>
              <span style={{
                position: 'absolute', top: 5, left: 5, fontFamily: 'var(--font-mono)',
                fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.55)',
              }}>{s.tag}</span>
              {s.main && (
                <span style={{
                  position: 'absolute', bottom: 4, right: 4, width: 16, height: 16, borderRadius: '50%',
                  background: UB.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <i data-lucide="star" style={{ width: 9, height: 9 }}></i>
                </span>
              )}
            </div>
            <div style={{ fontSize: 10, color: 'var(--fg3)', marginTop: 5, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</div>
          </div>
        ))}
        {/* add shot */}
        <div style={{ flexShrink: 0, width: 72 }}>
          <button style={{
            width: 72, height: 88, borderRadius: 10, border: `1.5px dashed ${UB.accentBd}`,
            background: UB.accentBg, color: UB.accentDk, cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
          }}>
            <i data-lucide="plus" style={{ width: 18, height: 18 }}></i>
            <span style={{ fontSize: 9.5, fontWeight: 700 }}>Add</span>
          </button>
        </div>
      </div>
    </UbCard>
  );
}

// thin filed-state photo summary (collapsed capture)
function FiledShots() {
  return (
    <UbCard>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex' }}>
          {SHOTS.slice(0, 3).map((s, i) => (
            <div key={i} style={{
              width: 40, height: 48, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
              background: '#1d1b19', backgroundImage: stripe(45, 'rgba(255,255,255,0.07)'),
              border: '2px solid #fff', marginLeft: i ? -12 : 0, boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
            }}></div>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg1)' }}>{SHOTS.length} photos saved</div>
          <div style={{ fontSize: 11.5, color: 'var(--fg3)', marginTop: 1 }}>Originals kept in your Vault</div>
        </div>
        <span style={{ fontSize: 11.5, color: UB.accentDk, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          View
          <i data-lucide="chevron-right" style={{ width: 14, height: 14 }}></i>
        </span>
      </div>
    </UbCard>
  );
}

// ── AI elf ─────────────────────────────────────────────────
function UnboxElf({ data }) {
  return (
    <div style={{
      background: 'linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 100%)',
      border: '1px solid #bae6fd', borderRadius: 16, padding: '12px 14px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 8, background: 'var(--color-primary-600)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(2,132,199,0.3)',
        }}>
          <i data-lucide="sparkles" style={{ width: 13, height: 13 }}></i>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', flex: 1, letterSpacing: '-0.005em' }}>{data.headline}</div>
      </div>
      <div style={{ fontSize: 13, color: '#0c4a6e', lineHeight: 1.5, marginBottom: 10, textWrap: 'pretty' }}>{data.summary}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.bullets.map((b, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, lineHeight: 1.45, color: 'var(--fg1)' }}>
            <div style={{
              width: 16, height: 16, borderRadius: 4, background: '#fff', color: 'var(--color-primary-700)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, border: '1px solid #bae6fd',
            }}>
              <i data-lucide={b.icon} style={{ width: 10, height: 10 }}></i>
            </div>
            <span><strong style={{ fontWeight: 700 }}>{b.label}</strong>
              <span style={{ color: 'var(--fg2)' }}> — {b.text}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Drawer suggestion + re-route (classified state) ────────
function DrawerSuggestion() {
  return (
    <UbCard noPad>
      <div style={{ padding: '12px 14px 4px' }}>
        <UbLabel right={
          <span style={{ fontSize: 10, color: 'var(--fg3)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <i data-lucide="sparkles" style={{ width: 11, height: 11 }}></i>
            Suggested by Pantopus
          </span>
        }>File into</UbLabel>
      </div>

      {/* the recommended drawer — selected */}
      <div style={{ padding: '0 14px 12px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px',
          borderRadius: 12, border: `1.5px solid ${UB.accent}`, background: UB.accentBg,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: SUGGEST.swatchBg, color: SUGGEST.swatch,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i data-lucide={SUGGEST.icon} style={{ width: 19, height: 19 }}></i>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg1)' }}>
              {SUGGEST.drawer}
              <span style={{ color: 'var(--fg4)', fontWeight: 600 }}> › </span>
              {SUGGEST.folder}
            </div>
            <div style={{ fontSize: 11, color: UB.accentDk, marginTop: 2, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <i data-lucide="badge-check" style={{ width: 12, height: 12 }}></i>
              {SUGGEST.conf}% match
            </div>
          </div>
          <span style={{
            width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
            background: UB.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i data-lucide="check" style={{ width: 14, height: 14 }}></i>
          </span>
        </div>
      </div>

      {/* re-route alternatives */}
      <div style={{
        padding: '10px 14px 4px', borderTop: '1px solid var(--app-border-subtle)',
        fontSize: 10, fontWeight: 700, color: 'var(--fg4)', textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>Or re-route to</div>
      {ALTS.map((a, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
          borderTop: i ? '1px solid var(--app-border-subtle)' : 'none', cursor: 'pointer',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: 'var(--app-surface-sunken)', color: a.swatch,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i data-lucide={a.icon} style={{ width: 15, height: 15 }}></i>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg1)' }}>
              {a.drawer}<span style={{ color: 'var(--fg4)' }}> › </span>{a.folder}
            </div>
          </div>
          <span style={{ width: 20, height: 20, borderRadius: '50%', border: '1.5px solid var(--app-border-strong)', flexShrink: 0 }}></span>
        </div>
      ))}
      <div style={{ padding: '6px 14px 14px', borderTop: '1px solid var(--app-border-subtle)' }}>
        <button style={{
          background: 'transparent', border: 'none', padding: '4px 0', cursor: 'pointer',
          color: 'var(--color-primary-600)', fontSize: 12.5, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', gap: 5,
        }}>
          <i data-lucide="folder-plus" style={{ width: 14, height: 14 }}></i>
          Choose another drawer
        </button>
      </div>
    </UbCard>
  );
}

// filed-state drawer banner
function FiledBanner() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: 'var(--color-success-bg)', border: '1px solid var(--color-success-light)',
      borderRadius: 16, padding: '12px 14px',
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 11, flexShrink: 0,
        background: 'var(--color-success)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(5,150,105,0.3)',
      }}>
        <i data-lucide="check" style={{ width: 20, height: 20 }}></i>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#065f46' }}>Filed to Home › Warranties</div>
        <div style={{ fontSize: 11.5, color: '#047857', marginTop: 1 }}>Confirmed by you · Just now</div>
      </div>
      <span style={{
        fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 9999, flexShrink: 0,
        background: '#fff', color: '#047857', border: '1px solid #bbf7d0',
      }}>Undo</span>
    </div>
  );
}

// ── Extracted facts (OCR) ──────────────────────────────────
function ExtractedFacts({ locked }) {
  return (
    <UbCard noPad>
      <div style={{
        padding: '10px 14px 8px', borderBottom: '1px solid var(--app-border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Read from your scans
        </span>
        <span style={{ fontSize: 10, color: locked ? '#047857' : 'var(--fg3)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <i data-lucide={locked ? 'lock' : 'scan-text'} style={{ width: 11, height: 11 }}></i>
          {locked ? 'Saved' : 'Tap to edit'}
        </span>
      </div>
      <div>
        {FACTS.map((f, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', padding: '10px 14px', gap: 12,
            borderBottom: i < FACTS.length - 1 ? '1px solid var(--app-border-subtle)' : 'none',
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6, flexShrink: 0,
              background: 'var(--app-surface-sunken)', color: 'var(--fg2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <i data-lucide={f.icon} style={{ width: 13, height: 13 }}></i>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--fg3)', fontWeight: 600 }}>{f.label}</div>
              <div style={{
                fontSize: 13, color: 'var(--fg1)', fontWeight: 600, marginTop: 1, letterSpacing: '-0.005em',
                fontFamily: f.mono ? 'var(--font-mono)' : 'inherit',
              }}>{f.value}</div>
              {f.note && <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 1 }}>{f.note}</div>}
            </div>
            {f.tag && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 9999, flexShrink: 0, whiteSpace: 'nowrap',
                background: f.tagBg, color: f.tagFg,
              }}>{f.tag}</span>
            )}
          </div>
        ))}
      </div>
    </UbCard>
  );
}

// ── Scan-next launcher (filed state) ───────────────────────
function ScanNext() {
  return (
    <button style={{
      width: '100%', padding: '16px', borderRadius: 16, cursor: 'pointer',
      border: `1.5px dashed ${UB.accentBd}`, background: UB.accentBg,
      display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: UB.accent, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(13,148,136,0.3)',
      }}>
        <i data-lucide="scan-line" style={{ width: 20, height: 20 }}></i>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: UB.accentDk }}>Scan the next item</div>
        <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 1 }}>Keep unboxing — capture flows back to here</div>
      </div>
      <i data-lucide="chevron-right" style={{ width: 18, height: 18, color: UB.accentDk }}></i>
    </button>
  );
}

// ── Action bars ────────────────────────────────────────────
function UnboxActions() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button style={primaryBtn(UB.accent)}>
        <i data-lucide="check-check" style={{ width: 17, height: 17 }}></i>
        Confirm — file to Home
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        <UbChip icon="rotate-ccw" label="Retake" />
        <UbChip icon="pencil" label="Edit facts" />
        <UbChip icon="message-square-text" label="Add note" />
        <UbChip icon="trash-2" label="Discard" />
      </div>
    </div>
  );
}
function FiledActions() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button style={primaryBtn('var(--color-primary-600)')}>
        <i data-lucide="folder-open" style={{ width: 17, height: 17 }}></i>
        View in Home drawer
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        <UbChip icon="box" label="Open record" />
        <UbChip icon="share-2" label="Share" />
        <UbChip icon="bell" label="Reminders" />
        <UbChip icon="archive" label="Archive" />
      </div>
    </div>
  );
}
function primaryBtn(bg) {
  return {
    width: '100%', padding: '14px 16px', background: bg, color: '#fff', border: 'none', borderRadius: 14,
    fontSize: 15, fontWeight: 700, letterSpacing: '-0.005em',
    boxShadow: bg === UB.accent ? '0 6px 16px rgba(13,148,136,0.22)' : 'var(--shadow-primary)', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, whiteSpace: 'nowrap',
  };
}
function UbChip({ icon, label }) {
  return (
    <button style={{
      background: '#fff', border: '1px solid var(--app-border)', borderRadius: 12, padding: '10px 4px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      color: 'var(--fg2)', cursor: 'pointer', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      <i data-lucide={icon} style={{ width: 17, height: 17 }}></i>
      {label}
    </button>
  );
}

// ── Screen ─────────────────────────────────────────────────
function MailUnboxingScreen({ state = 'classified', dataLabel }) {
  const filed = state === 'filed';
  return (
    <div data-screen-label={dataLabel} style={{
      width: '100%', height: '100%', background: 'var(--app-bg)',
      display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden',
      paddingTop: 54,
    }}>
      <UnboxNav />

      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '12px 16px 96px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* header row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 2px' }}>
            {filed
              ? <StateChip icon="check-circle-2" label="Filed" filed />
              : <StateChip icon="scan-line" label="New capture" />}
            <CategoryChip label={UB.category} color={UB.accent} />
            <span style={{ flex: 1 }}></span>
            <span style={{ fontSize: 11, color: 'var(--fg3)', fontWeight: 500 }}>{UB.time}</span>
          </div>

          {filed ? (
            <>
              <FiledBanner />
              <FiledShots />
              <UnboxElf data={ELF_FILED} />
              <ExtractedFacts locked />
              <ScanNext />
              <FiledActions />
            </>
          ) : (
            <>
              <Viewfinder />
              <ThumbStrip />
              <UnboxElf data={ELF_CLASSIFY} />
              <DrawerSuggestion />
              <ExtractedFacts />
              <UnboxActions />
            </>
          )}
        </div>
      </div>

      <BottomTabBar active="mail" />
    </div>
  );
}

Object.assign(window, { MailUnboxingScreen });
