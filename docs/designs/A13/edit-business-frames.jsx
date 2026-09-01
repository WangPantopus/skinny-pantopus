// Pantopus — A13.10 · Edit business page
// File: src/app/businesses/[id]/page-editor.tsx
//
// Multi-section variant of the Form archetype, applied to the public-facing
// business profile. Owners scroll a long stack of sections, each editable
// in-place. Save is sticky-bottom because edits are usually partial — most
// owners pop in to tweak hours or add a photo, then leave.
//
// Two frames:
//   FrameEditBusinessPopulated — established business · all sections filled ·
//       light edits underway (Mon hours adjusted, one new gallery shot) ·
//       sticky bar shows the dirty Discard + Save pair.
//
//   FrameEditBusinessSetup — newly claimed business · description blank,
//       hours unset, services empty, gallery empty, address unverified ·
//       completion meter pinned under the top bar · sticky bar shows
//       "Save draft" alongside a disabled "Publish · 4 to go".
//
// Business identity pillar uses purple (#7C3AED).

const {
  F, Phone, TopBar, OverlineLabel, Input, Textarea,
  Section, ScrollArea, Card, Toggle, ToggleRow, Chip,
} = window;

const BIZ = {
  accent:   '#7C3AED',
  accent50: '#F5F0FF',
  accent100:'#EDE0FF',
  accent700:'#5B21B6',
  amber:    '#f59e0b',
  amber50:  '#fef3c7',
  amber100: '#fde68a',
  amberFg:  '#92400e',
};

// ─── Local atoms ──────────────────────────────────────────────

function DirtyDot() {
  return (
    <span style={{
      display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
      background: BIZ.amber, marginLeft: 6, verticalAlign: 'middle',
      boxShadow: `0 0 0 2px ${BIZ.amber50}`,
    }} />
  );
}

function BizLabel({ children, required, dirty, hint }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: F.fg2, letterSpacing: -0.05 }}>
        {children}
        {required && <span style={{ color: F.error600, marginLeft: 3 }}>*</span>}
        {dirty && <DirtyDot />}
      </label>
      {hint && (
        <span style={{ fontSize: 10.5, color: F.fg4, letterSpacing: -0.05 }}>{hint}</span>
      )}
    </div>
  );
}

// Banner + logo composite — abstract café-window scene drawn in CSS/SVG.
// `state`: 'filled' | 'empty'  · `dirty` adds the amber edge.
function BannerLogo({ state = 'filled', dirty }) {
  if (state === 'empty') {
    return (
      <div style={{ position: 'relative', marginBottom: 44 }}>
        <div style={{
          aspectRatio: '16 / 7', borderRadius: 14,
          border: `1.5px dashed ${F.borderStrong}`, background: F.sunken,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 4, color: F.fg3,
        }}>
          <i data-lucide="image-plus" style={{ width: 22, height: 22 }} />
          <div style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: -0.1 }}>Add banner</div>
          <div style={{ fontSize: 10.5, color: F.fg4 }}>1600 × 700 · JPG or PNG</div>
        </div>
        <div style={{
          position: 'absolute', left: 16, bottom: -32,
          width: 76, height: 76, borderRadius: 18,
          border: `1.5px dashed ${F.borderStrong}`, background: F.surface,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 2, color: F.fg3,
          boxShadow: '0 4px 12px rgba(17,24,39,0.06)',
        }}>
          <i data-lucide="plus" style={{ width: 18, height: 18 }} />
          <div style={{ fontSize: 9.5, fontWeight: 600 }}>Logo</div>
        </div>
      </div>
    );
  }
  // filled — Roost Café exterior at golden hour
  return (
    <div style={{ position: 'relative', marginBottom: 44 }}>
      <div style={{
        aspectRatio: '16 / 7', borderRadius: 14, overflow: 'hidden',
        position: 'relative',
        background: 'linear-gradient(180deg,#fde68a 0%,#f59e0b 45%,#b45309 85%,#7c2d12 100%)',
        border: dirty ? `2px solid ${BIZ.amber}` : 'none',
      }}>
        {/* sun glow */}
        <div style={{
          position: 'absolute', right: 40, top: 16,
          width: 28, height: 28, borderRadius: '50%',
          background: '#fff7ed',
          boxShadow: '0 0 40px 16px rgba(254,243,199,0.75)',
        }} />
        {/* awning + storefront */}
        <svg viewBox="0 0 320 140" preserveAspectRatio="xMidYMax slice" style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: '78%',
        }}>
          {/* sidewalk */}
          <rect x="0" y="120" width="320" height="20" fill="#1f2937" />
          {/* facade */}
          <rect x="40" y="56" width="240" height="68" fill="#292524" />
          {/* windows */}
          <rect x="56"  y="72" width="50" height="42" fill="#fcd34d" opacity="0.92" />
          <rect x="116" y="72" width="50" height="42" fill="#fcd34d" opacity="0.92" />
          <rect x="214" y="72" width="50" height="42" fill="#fcd34d" opacity="0.92" />
          {/* door */}
          <rect x="174" y="68" width="32" height="56" fill="#451a03" />
          <rect x="178" y="74" width="24" height="22" fill="#fbbf24" opacity="0.9" />
          {/* awning stripes */}
          <path d="M32 56 L288 56 L276 40 L44 40 Z" fill="#dc2626" />
          <path d="M50 56 L72 56 L72 40 L50 40 Z" fill="#fef3c7" opacity="0.85"/>
          <path d="M96 56 L118 56 L118 40 L96 40 Z" fill="#fef3c7" opacity="0.85"/>
          <path d="M142 56 L164 56 L164 40 L142 40 Z" fill="#fef3c7" opacity="0.85"/>
          <path d="M188 56 L210 56 L210 40 L188 40 Z" fill="#fef3c7" opacity="0.85"/>
          <path d="M234 56 L256 56 L256 40 L234 40 Z" fill="#fef3c7" opacity="0.85"/>
          {/* figures */}
          <circle cx="100" cy="110" r="3" fill="#0f172a"/>
          <rect x="98"  y="110" width="4" height="14" fill="#0f172a"/>
          <circle cx="240" cy="108" r="3" fill="#0f172a"/>
          <rect x="238" y="108" width="4" height="14" fill="#0f172a"/>
        </svg>
        {/* change cover affordance */}
        <button style={{
          position: 'absolute', right: 10, top: 10,
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '6px 10px', borderRadius: 9999,
          background: 'rgba(17,24,39,0.7)', color: '#fff',
          fontSize: 11, fontWeight: 600, letterSpacing: -0.05,
          border: 'none', cursor: 'pointer',
          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        }}>
          <i data-lucide="image" style={{ width: 12, height: 12 }} />
          Change banner
        </button>
        {dirty && (
          <div style={{
            position: 'absolute', left: 10, top: 10,
            padding: '3px 8px', borderRadius: 9999,
            background: BIZ.amber, color: '#fff',
            fontSize: 9.5, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase',
            boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
          }}>New</div>
        )}
      </div>
      {/* logo well */}
      <div style={{
        position: 'absolute', left: 16, bottom: -32,
        width: 76, height: 76, borderRadius: 18,
        background: '#fff', border: '3px solid #fff',
        boxShadow: '0 6px 16px rgba(17,24,39,0.12)',
        overflow: 'hidden',
      }}>
        <div style={{
          width: '100%', height: '100%',
          background: 'radial-gradient(circle at 30% 30%, #fef3c7 0%, #f59e0b 50%, #b45309 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontFamily: 'Georgia, serif',
          fontWeight: 700, fontSize: 28, letterSpacing: -1,
          textShadow: '0 1px 2px rgba(0,0,0,0.25)',
        }}>R</div>
      </div>
      <button style={{
        position: 'absolute', left: 100, bottom: -22,
        background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
        color: BIZ.accent, fontSize: 12, fontWeight: 600, letterSpacing: -0.1,
      }}>Change logo</button>
    </div>
  );
}

// ─── Hours row ────────────────────────────────────────────────

function HoursRow({ day, open, close, closed, last, dirty }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '11px 14px',
      borderBottom: last ? 'none' : `1px solid ${F.borderSub}`,
      background: dirty ? '#fffbeb' : 'transparent',
    }}>
      <div style={{ width: 38, fontSize: 12.5, fontWeight: 600, color: F.fg1, letterSpacing: -0.1 }}>
        {day}
        {dirty && <DirtyDot />}
      </div>
      {closed ? (
        <>
          <div style={{ flex: 1, fontSize: 12, color: F.fg3, fontStyle: 'italic' }}>Closed</div>
          <button style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: BIZ.accent, fontSize: 11.5, fontWeight: 600, padding: 0,
          }}>Set hours</button>
        </>
      ) : (
        <>
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <TimePill value={open} />
            <span style={{ color: F.fg4, fontSize: 11 }}>—</span>
            <TimePill value={close} />
          </div>
          <button style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: F.fg3, padding: 4, borderRadius: 6,
            display: 'flex', alignItems: 'center',
          }}>
            <i data-lucide="more-horizontal" style={{ width: 14, height: 14 }} />
          </button>
        </>
      )}
    </div>
  );
}

function TimePill({ value }) {
  return (
    <span style={{
      padding: '4px 9px', borderRadius: 6,
      background: F.sunken, border: `1px solid ${F.border}`,
      fontFamily: 'ui-monospace, Menlo, monospace',
      fontSize: 11.5, fontWeight: 600, color: F.fg1,
      letterSpacing: -0.1,
    }}>{value}</span>
  );
}

function HoursEmptyRow({ day, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '11px 14px',
      borderBottom: last ? 'none' : `1px solid ${F.borderSub}`,
    }}>
      <div style={{ width: 38, fontSize: 12.5, fontWeight: 600, color: F.fg3, letterSpacing: -0.1 }}>
        {day}
      </div>
      <div style={{ flex: 1, fontSize: 12, color: F.fg4 }}>Not set</div>
      <button style={{
        background: BIZ.accent50, border: `1px solid ${BIZ.accent100}`, cursor: 'pointer',
        color: BIZ.accent700, fontSize: 11, fontWeight: 600, padding: '4px 10px',
        borderRadius: 9999,
      }}>Add</button>
    </div>
  );
}

// ─── Service chip ─────────────────────────────────────────────

function ServiceChip({ label, icon, fresh }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '7px 5px 7px 11px', borderRadius: 9999,
      background: fresh ? BIZ.amber50 : BIZ.accent50,
      color: fresh ? BIZ.amberFg : BIZ.accent700,
      border: `1px solid ${fresh ? BIZ.amber100 : BIZ.accent100}`,
      fontSize: 12, fontWeight: 600, letterSpacing: -0.05,
    }}>
      <i data-lucide={icon} style={{ width: 13, height: 13, opacity: 0.85 }} />
      {label}
      <span style={{
        width: 16, height: 16, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: fresh ? BIZ.amberFg : BIZ.accent, cursor: 'pointer',
      }}>
        <i data-lucide="x" style={{ width: 12, height: 12, strokeWidth: 2.5 }} />
      </span>
    </span>
  );
}

function AddServiceChip() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '7px 11px', borderRadius: 9999,
      border: `1px dashed ${F.borderStrong}`,
      color: F.fg3, fontSize: 12, fontWeight: 500,
      background: 'transparent', cursor: 'pointer',
    }}>
      <i data-lucide="plus" style={{ width: 12, height: 12 }} />
      Add service
    </span>
  );
}

// ─── Gallery tile ─────────────────────────────────────────────

function GalleryTile({ palette, label, cover }) {
  // simple CSS art per tile so the grid reads as real photos
  const tones = {
    croissant: { bg: 'linear-gradient(135deg,#fde68a 0%,#b45309 100%)', glyph: '🥐' },
    coffee:    { bg: 'linear-gradient(135deg,#92400e 0%,#1c1917 100%)', glyph: '☕' },
    interior:  { bg: 'linear-gradient(135deg,#fcd34d 0%,#7c2d12 100%)', glyph: null },
    bread:     { bg: 'linear-gradient(135deg,#fef3c7 0%,#d97706 100%)', glyph: '🥖' },
    latte:     { bg: 'linear-gradient(135deg,#e7d4b5 0%,#78350f 100%)', glyph: null },
    crowd:     { bg: 'linear-gradient(135deg,#fbbf24 0%,#581c87 100%)', glyph: null },
  }[palette] || { bg: F.sunken, glyph: null };
  return (
    <div style={{
      aspectRatio: '1 / 1', borderRadius: 10, overflow: 'hidden',
      background: tones.bg, position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 28,
      border: cover ? `2px solid ${BIZ.accent}` : 'none',
    }}>
      {tones.glyph && <span style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.25))' }}>{tones.glyph}</span>}
      {palette === 'interior' && (
        <svg viewBox="0 0 60 60" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <rect x="6"  y="22" width="14" height="22" fill="rgba(0,0,0,0.35)" />
          <rect x="24" y="22" width="14" height="22" fill="rgba(0,0,0,0.35)" />
          <rect x="42" y="22" width="14" height="22" fill="rgba(0,0,0,0.35)" />
          <rect x="6"  y="44" width="50" height="14" fill="rgba(0,0,0,0.6)" />
          <circle cx="14" cy="32" r="3" fill="#fde68a"/>
          <circle cx="32" cy="32" r="3" fill="#fde68a"/>
          <circle cx="50" cy="32" r="3" fill="#fde68a"/>
        </svg>
      )}
      {palette === 'latte' && (
        <svg viewBox="0 0 60 60" style={{ width: 38, height: 38 }}>
          <ellipse cx="30" cy="30" rx="18" ry="18" fill="#1c1917" />
          <path d="M22 26 Q30 18 38 26 Q34 32 30 30 Q26 32 22 26 Z" fill="#fef3c7" opacity="0.9"/>
          <ellipse cx="30" cy="30" rx="18" ry="3" fill="rgba(255,255,255,0.1)"/>
        </svg>
      )}
      {palette === 'crowd' && (
        <svg viewBox="0 0 60 60" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <circle cx="14" cy="22" r="4" fill="rgba(0,0,0,0.55)"/>
          <circle cx="30" cy="20" r="4" fill="rgba(0,0,0,0.55)"/>
          <circle cx="46" cy="24" r="4" fill="rgba(0,0,0,0.55)"/>
          <rect x="10" y="26" width="8" height="20" fill="rgba(0,0,0,0.55)"/>
          <rect x="26" y="24" width="8" height="22" fill="rgba(0,0,0,0.55)"/>
          <rect x="42" y="28" width="8" height="18" fill="rgba(0,0,0,0.55)"/>
        </svg>
      )}
      {cover && (
        <div style={{
          position: 'absolute', left: 6, top: 6,
          padding: '2px 6px', borderRadius: 4,
          background: BIZ.accent, color: '#fff',
          fontSize: 8.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
        }}>Cover</div>
      )}
      <button style={{
        position: 'absolute', right: 4, top: 4,
        width: 22, height: 22, borderRadius: '50%',
        background: 'rgba(17,24,39,0.65)', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff',
      }}>
        <i data-lucide="x" style={{ width: 12, height: 12, strokeWidth: 2.5 }} />
      </button>
    </div>
  );
}

function GalleryAddTile({ fresh }) {
  return (
    <div style={{
      aspectRatio: '1 / 1', borderRadius: 10,
      border: `1.5px dashed ${fresh ? BIZ.amber : F.borderStrong}`,
      background: fresh ? BIZ.amber50 : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 4,
      color: fresh ? BIZ.amberFg : F.fg3, cursor: 'pointer',
    }}>
      <i data-lucide="plus" style={{ width: 20, height: 20 }} />
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: -0.05 }}>
        {fresh ? 'Uploaded' : 'Add'}
      </span>
    </div>
  );
}

// ─── Location card ────────────────────────────────────────────

function MapPreview({ verified = true, pinDirty }) {
  return (
    <div style={{
      aspectRatio: '16 / 9', borderRadius: 12, overflow: 'hidden',
      position: 'relative',
      background: '#dbeafe',
    }}>
      {/* stylized streets */}
      <svg viewBox="0 0 320 180" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <rect x="0" y="0" width="320" height="180" fill="#e0e7ff"/>
        <rect x="0"   y="60"  width="320" height="14" fill="#f8fafc"/>
        <rect x="0"   y="120" width="320" height="10" fill="#f8fafc"/>
        <rect x="80"  y="0"   width="14"  height="180" fill="#f8fafc"/>
        <rect x="210" y="0"   width="10"  height="180" fill="#f8fafc"/>
        {/* park */}
        <rect x="100" y="80" width="100" height="36" fill="#bbf7d0"/>
        <circle cx="120" cy="98" r="6" fill="#22c55e" opacity="0.7"/>
        <circle cx="148" cy="92" r="5" fill="#22c55e" opacity="0.7"/>
        <circle cx="176" cy="100" r="5" fill="#22c55e" opacity="0.7"/>
        {/* blocks */}
        <rect x="12"  y="12" width="60" height="40" fill="#fef3c7" opacity="0.5"/>
        <rect x="232" y="14" width="60" height="36" fill="#fef3c7" opacity="0.5"/>
        <rect x="14"  y="140" width="58" height="30" fill="#fef3c7" opacity="0.5"/>
        <rect x="232" y="140" width="60" height="32" fill="#fef3c7" opacity="0.5"/>
        {/* street labels */}
        <text x="40" y="68" fontFamily="ui-sans-serif" fontSize="6" fill="#475569" fontWeight="600">ELM ST</text>
        <text x="84" y="22" fontFamily="ui-sans-serif" fontSize="6" fill="#475569" fontWeight="600" transform="rotate(90,84,22)">4TH AVE</text>
      </svg>
      {/* pin */}
      <div style={{
        position: 'absolute', left: '50%', top: '48%',
        transform: 'translate(-50%, -100%)',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50% 50% 50% 0',
          background: BIZ.accent,
          transform: 'rotate(-45deg)',
          boxShadow: '0 4px 10px rgba(124,58,237,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: pinDirty ? `2px solid ${BIZ.amber}` : 'none',
        }}>
          <i data-lucide="store" style={{
            width: 14, height: 14, color: '#fff',
            transform: 'rotate(45deg)',
          }} />
        </div>
        <div style={{
          width: 14, height: 5, borderRadius: '50%',
          background: 'rgba(17,24,39,0.25)',
          margin: '-2px auto 0',
        }} />
      </div>
      {/* zoom controls */}
      <div style={{
        position: 'absolute', right: 8, top: 8,
        display: 'flex', flexDirection: 'column',
        background: '#fff', borderRadius: 6, overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
      }}>
        <button style={{ width: 26, height: 24, border: 'none', background: 'transparent', cursor: 'pointer', borderBottom: `1px solid ${F.borderSub}`, color: F.fg2, fontSize: 14, fontWeight: 600 }}>+</button>
        <button style={{ width: 26, height: 24, border: 'none', background: 'transparent', cursor: 'pointer', color: F.fg2, fontSize: 14, fontWeight: 600 }}>−</button>
      </div>
      {/* verification chip */}
      <div style={{
        position: 'absolute', left: 8, bottom: 8,
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '4px 9px', borderRadius: 9999,
        background: verified ? F.successBg : '#fef3c7',
        border: verified ? `1px solid #a7f3d0` : `1px solid ${BIZ.amber100}`,
        color: verified ? F.success : BIZ.amberFg,
        fontSize: 10, fontWeight: 700, letterSpacing: 0.1, textTransform: 'uppercase',
      }}>
        <i data-lucide={verified ? 'shield-check' : 'shield-alert'} style={{ width: 10, height: 10 }} />
        {verified ? 'Verified' : 'Verify address'}
      </div>
    </div>
  );
}

// ─── Sticky save bar ──────────────────────────────────────────

function StickySave({ mode, count }) {
  // mode: 'dirty' (populated frame · user has unsaved tweaks)
  //       'draft' (setup frame · saving a draft, can't publish yet)
  if (mode === 'dirty') {
    return (
      <div style={stickyBase}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 9999,
          background: BIZ.amber50, border: `1px solid ${BIZ.amber100}`,
          color: BIZ.amberFg, fontSize: 11, fontWeight: 700, letterSpacing: 0.1,
          textTransform: 'uppercase',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: BIZ.amber }} />
          {count} unsaved
        </div>
        <div style={{ flex: 1 }} />
        <button style={ghostBtn}>Discard</button>
        <button style={primaryBtn}>
          <i data-lucide="check" style={{ width: 15, height: 15 }} />
          Save
        </button>
      </div>
    );
  }
  // draft / publish state
  return (
    <div style={stickyBase}>
      <button style={{
        ...ghostBtn, color: BIZ.accent, height: 42, padding: '0 14px',
        display: 'inline-flex', alignItems: 'center', gap: 5,
      }}>
        <i data-lucide="save" style={{ width: 14, height: 14 }} />
        Save draft
      </button>
      <div style={{ flex: 1 }} />
      <button disabled style={{
        height: 42, padding: '0 16px', borderRadius: 10, border: 'none',
        background: F.sunken, color: F.fg4,
        fontSize: 13.5, fontWeight: 600, letterSpacing: -0.1,
        cursor: 'not-allowed',
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
        <i data-lucide="lock" style={{ width: 13, height: 13 }} />
        Publish · 4 to go
      </button>
    </div>
  );
}

const stickyBase = {
  position: 'absolute', bottom: 0, left: 0, right: 0,
  background: 'rgba(255,255,255,0.96)',
  backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
  borderTop: `1px solid ${F.border}`,
  padding: '10px 16px 26px',
  display: 'flex', gap: 10, alignItems: 'center',
  zIndex: 10,
};
const ghostBtn = {
  height: 42, padding: '0 14px', borderRadius: 10,
  background: 'transparent', border: 'none', cursor: 'pointer',
  color: F.fg2, fontSize: 13.5, fontWeight: 600, letterSpacing: -0.1,
};
const primaryBtn = {
  height: 42, padding: '0 22px', borderRadius: 10, border: 'none',
  background: BIZ.accent, color: '#fff',
  fontSize: 14, fontWeight: 600, letterSpacing: -0.1, cursor: 'pointer',
  boxShadow: '0 6px 16px rgba(124,58,237,0.28)',
  display: 'inline-flex', alignItems: 'center', gap: 6,
};

// Identity strip (purple band under top bar). Setup frame replaces it
// with a completion meter; populated frame uses a quiet last-published note.
function IdentityStrip({ name, lastPublished }) {
  return (
    <div style={{
      padding: '8px 14px',
      background: BIZ.accent50,
      borderBottom: `1px solid ${BIZ.accent100}`,
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: 5, background: BIZ.accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <i data-lucide="store" style={{ width: 10, height: 10, color: '#fff' }} />
      </div>
      <div style={{ fontSize: 11.5, color: BIZ.accent700, fontWeight: 600, letterSpacing: -0.05 }}>
        {name}
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ fontSize: 10.5, color: BIZ.accent700, opacity: 0.7, letterSpacing: -0.05 }}>
        {lastPublished}
      </div>
    </div>
  );
}

function CompletionStrip({ done, total, items }) {
  const pct = Math.round((done / total) * 100);
  return (
    <div style={{
      padding: '10px 14px 12px',
      background: BIZ.accent50,
      borderBottom: `1px solid ${BIZ.accent100}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 18, height: 18, borderRadius: 5, background: BIZ.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i data-lucide="store" style={{ width: 10, height: 10, color: '#fff' }} />
        </div>
        <div style={{ fontSize: 11.5, color: BIZ.accent700, fontWeight: 700, letterSpacing: -0.05 }}>
          Setup · {done} of {total}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{
          fontFamily: 'ui-monospace, Menlo, monospace',
          fontSize: 11, color: BIZ.accent700, fontWeight: 700,
        }}>{pct}%</div>
      </div>
      <div style={{
        height: 6, borderRadius: 3, background: '#fff',
        overflow: 'hidden', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 3,
          background: `linear-gradient(90deg, ${BIZ.accent}, ${BIZ.accent700})`,
        }} />
      </div>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8,
      }}>
        {items.map((it, i) => (
          <span key={i} style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '2px 7px', borderRadius: 9999,
            fontSize: 10, fontWeight: 600, letterSpacing: -0.05,
            background: it.done ? F.successBg : '#fff',
            color: it.done ? F.success : F.fg3,
            border: `1px solid ${it.done ? '#a7f3d0' : F.border}`,
          }}>
            <i data-lucide={it.done ? 'check' : 'circle'} style={{ width: 9, height: 9, strokeWidth: 3 }} />
            {it.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// Empty / prompt block (used by the setup frame for description, services, gallery)
function PromptBlock({ icon, title, sub, cta }) {
  return (
    <div style={{
      border: `1.5px dashed ${F.borderStrong}`,
      borderRadius: 10, padding: '16px 14px',
      background: F.surface,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: BIZ.accent50, color: BIZ.accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <i data-lucide={icon} style={{ width: 18, height: 18 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: F.fg1, letterSpacing: -0.1, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: F.fg3, lineHeight: '15px' }}>{sub}</div>
      </div>
      <button style={{
        height: 30, padding: '0 12px', borderRadius: 8,
        background: BIZ.accent, color: '#fff', border: 'none', cursor: 'pointer',
        fontSize: 12, fontWeight: 600, letterSpacing: -0.05, flexShrink: 0,
      }}>{cta}</button>
    </div>
  );
}

// ─── FRAME 1 · POPULATED ──────────────────────────────────────

function FrameEditBusinessPopulated() {
  return (
    <Phone>
      <TopBar title="Edit business page" rightLabel="Preview" rightPrimary={false} />
      <IdentityStrip name="Roost Café · Elm Park" lastPublished="Published · 6 days ago" />
      <ScrollArea bottomPad={110}>

        <BannerLogo state="filled" dirty />

        <Section overline="Business name & tagline">
          <div>
            <BizLabel required>Name</BizLabel>
            <Input value="Roost Café" state="valid" />
          </div>
          <div>
            <BizLabel hint="Shows in search and on map pins">Tagline</BizLabel>
            <Input value="Slow mornings, strong coffee, warm bread." />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <BizLabel>Category</BizLabel>
              <Input value="Café · Bakery" trailing={
                <i data-lucide="chevron-down" style={{ width: 14, height: 14, color: F.fg3 }} />
              } />
            </div>
            <div style={{ width: 110 }}>
              <BizLabel>Price</BizLabel>
              <Input value="$$" />
            </div>
          </div>
        </Section>

        <Section overline="Description">
          <div>
            <BizLabel hint="Markdown supported">About</BizLabel>
            <Textarea
              value="A corner café tucked under the old elms on 4th. Family-run since 2011. House-baked sourdough, single-origin pour-over, and a back patio that's the best-kept secret on the block. Dogs and laptops welcome before noon."
              height={108}
              charCount="247 / 600"
            />
          </div>
        </Section>

        <Section overline="Hours" gap={0}>
          <Card padding={0}>
            <HoursRow day="Mon" open="7:00 AM" close="3:00 PM" dirty />
            <HoursRow day="Tue" open="7:00 AM" close="5:00 PM" />
            <HoursRow day="Wed" open="7:00 AM" close="5:00 PM" />
            <HoursRow day="Thu" open="7:00 AM" close="5:00 PM" />
            <HoursRow day="Fri" open="7:00 AM" close="9:00 PM" />
            <HoursRow day="Sat" open="8:00 AM" close="9:00 PM" />
            <HoursRow day="Sun" open="8:00 AM" close="2:00 PM" last />
          </Card>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
            fontSize: 11, color: F.fg3, fontStyle: 'italic',
          }}>
            <i data-lucide="info" style={{ width: 11, height: 11 }} />
            Holiday hours can be added per date — neighbors see a banner.
          </div>
        </Section>

        <Section overline="Services">
          <div>
            <BizLabel>What you offer</BizLabel>
            <div style={{
              padding: 10, background: F.surface, border: `1px solid ${F.border}`,
              borderRadius: 8, display: 'flex', flexWrap: 'wrap', gap: 6,
              minHeight: 44, alignItems: 'center',
            }}>
              <ServiceChip label="Dine-in"          icon="utensils" />
              <ServiceChip label="Takeaway"         icon="shopping-bag" />
              <ServiceChip label="Outdoor seating"  icon="trees" />
              <ServiceChip label="Free Wi-Fi"       icon="wifi" />
              <ServiceChip label="Dog-friendly"     icon="paw-print" />
              <ServiceChip label="Pre-order"        icon="clock" />
              <AddServiceChip />
            </div>
          </div>
        </Section>

        <Section overline="Gallery">
          <div>
            <BizLabel hint="6 of 20 · drag to reorder">Photos</BizLabel>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
            }}>
              <GalleryTile palette="croissant" cover />
              <GalleryTile palette="interior" />
              <GalleryTile palette="coffee" />
              <GalleryTile palette="bread" />
              <GalleryTile palette="latte" />
              <GalleryAddTile fresh />
            </div>
          </div>
        </Section>

        <Section overline="Contact">
          <div>
            <BizLabel>Phone</BizLabel>
            <Input value="(415) 555-0146" leading="+1" state="valid" />
          </div>
          <div>
            <BizLabel>Email</BizLabel>
            <Input value="hello@roostcafe.co" state="valid" />
          </div>
          <div>
            <BizLabel>Website</BizLabel>
            <Input value="roostcafe.co" leading="https://" />
          </div>
          <div>
            <BizLabel hint="Public on profile">Booking link</BizLabel>
            <Input value="resy.com/roost-elm-park" leading="https://" />
          </div>
        </Section>

        <Section overline="Location">
          <div>
            <BizLabel required>Address</BizLabel>
            <Input value="412 Elm St, Elm Park, NY 10013" state="valid"
              trailing={<i data-lucide="map-pin" style={{ width: 14, height: 14, color: F.fg3 }} />} />
          </div>
          <div>
            <BizLabel hint="Drag the pin to refine">Map</BizLabel>
            <MapPreview verified />
          </div>
          <Card padding={0}>
            <ToggleRow
              label="Hide exact address until contact"
              sub="Show street name only on the public page."
              on={false} last
            />
          </Card>
        </Section>

      </ScrollArea>
      <StickySave mode="dirty" count={3} />
    </Phone>
  );
}

// ─── FRAME 2 · SETUP (secondary state) ────────────────────────

function FrameEditBusinessSetup() {
  return (
    <Phone>
      <TopBar title="Edit business page" rightLabel="Preview" rightDisabled rightPrimary={false} />
      <CompletionStrip
        done={3}
        total={7}
        items={[
          { label: 'Name',        done: true },
          { label: 'Contact',     done: true },
          { label: 'Location',    done: true },
          { label: 'Banner',      done: false },
          { label: 'Description', done: false },
          { label: 'Hours',       done: false },
          { label: 'Services',    done: false },
        ]}
      />
      <ScrollArea bottomPad={110}>

        <BannerLogo state="empty" />

        <Section overline="Business name & tagline">
          <div>
            <BizLabel required>Name</BizLabel>
            <Input value="Patch & Paw Grooming" state="valid" />
          </div>
          <div>
            <BizLabel hint="Shows in search and on map pins">Tagline</BizLabel>
            <Input placeholder="One short line, no punctuation" />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <BizLabel required>Category</BizLabel>
              <Input placeholder="Pick a category"
                trailing={<i data-lucide="chevron-down" style={{ width: 14, height: 14, color: F.fg3 }} />} />
            </div>
            <div style={{ width: 110 }}>
              <BizLabel>Price</BizLabel>
              <Input placeholder="$ — $$$$" />
            </div>
          </div>
        </Section>

        <Section overline="Description">
          <PromptBlock
            icon="text"
            title="Tell neighbors what you do"
            sub="A short paragraph helps your page rank in local search."
            cta="Write"
          />
        </Section>

        <Section overline="Hours" gap={0}>
          <Card padding={0}>
            <HoursEmptyRow day="Mon" />
            <HoursEmptyRow day="Tue" />
            <HoursEmptyRow day="Wed" />
            <HoursEmptyRow day="Thu" />
            <HoursEmptyRow day="Fri" />
            <HoursEmptyRow day="Sat" />
            <HoursEmptyRow day="Sun" last />
          </Card>
          <div style={{
            display: 'flex', gap: 6, marginTop: 8,
          }}>
            <button style={{
              flex: 1, height: 34, borderRadius: 8,
              background: BIZ.accent50, border: `1px solid ${BIZ.accent100}`,
              color: BIZ.accent700, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}>
              <i data-lucide="calendar-clock" style={{ width: 13, height: 13 }} />
              Apply 9–5 weekdays
            </button>
            <button style={{
              flex: 1, height: 34, borderRadius: 8,
              background: F.surface, border: `1px solid ${F.border}`,
              color: F.fg2, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}>
              <i data-lucide="copy" style={{ width: 13, height: 13 }} />
              Copy from another biz
            </button>
          </div>
        </Section>

        <Section overline="Services">
          <PromptBlock
            icon="sparkles"
            title="Add at least one service"
            sub="Required to appear in category search results."
            cta="Add"
          />
        </Section>

        <Section overline="Gallery">
          <div>
            <BizLabel hint="0 of 20 · cover photo first">Photos</BizLabel>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
            }}>
              <div style={{
                aspectRatio: '1 / 1', borderRadius: 10,
                border: `1.5px dashed ${F.borderStrong}`,
                background: F.surface, position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 4,
                color: F.fg3, gridColumn: 'span 2', gridRow: 'span 2',
              }}>
                <i data-lucide="image-plus" style={{ width: 26, height: 26 }} />
                <div style={{ fontSize: 12, fontWeight: 600 }}>Add cover photo</div>
                <div style={{ fontSize: 10, color: F.fg4 }}>1080 × 1080</div>
                <div style={{
                  position: 'absolute', left: 6, top: 6,
                  padding: '2px 6px', borderRadius: 4,
                  background: BIZ.accent, color: '#fff',
                  fontSize: 8.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
                }}>Cover</div>
              </div>
              <GalleryAddTile />
              <GalleryAddTile />
            </div>
          </div>
        </Section>

        <Section overline="Contact">
          <div>
            <BizLabel>Phone</BizLabel>
            <Input value="(415) 555-0212" leading="+1" state="valid" />
          </div>
          <div>
            <BizLabel>Email</BizLabel>
            <Input value="lena@patchandpaw.co" state="valid" />
          </div>
          <div>
            <BizLabel>Website</BizLabel>
            <Input placeholder="example.com" leading="https://" />
          </div>
        </Section>

        <Section overline="Location">
          <div>
            <BizLabel required>Address</BizLabel>
            <Input
              value="218 4th Ave, Elm Park, NY"
              state="error"
              error="ZIP code missing — needed to verify"
            />
          </div>
          <div>
            <BizLabel>Map</BizLabel>
            <MapPreview verified={false} pinDirty />
          </div>
        </Section>

      </ScrollArea>
      <StickySave mode="draft" />
    </Phone>
  );
}

Object.assign(window, { FrameEditBusinessPopulated, FrameEditBusinessSetup });
