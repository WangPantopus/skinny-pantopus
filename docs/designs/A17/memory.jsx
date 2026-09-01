// MailMemoryScreen — A17 archetype × Memory variant.
// "Memory mail" = a keepsake delivery: a neighbor (or Pantopus itself) sends
// a photo + handwritten note marking an anniversary or moment. Slots beyond
// the archetype:
//   - Photograph as the hero (polaroid frame, handwritten date stamp)
//   - Serif handwritten note on stationery paper (the "letter")
//   - Memory context (when it happened · what it was about · who else)
//   - Anniversary card (Pantopus surfaced this because…)
//   - Primary "Save to vault" + Share. Saved state shows vault location.

// ── Data ───────────────────────────────────────────────────
const MEMORY = {
  accent: 'var(--stationery-summer-accent)',   // sun-amber #D9842E
  paper:  'var(--stationery-summer-paper)',    // pale rose #F6E6D3
  ink:    'var(--stationery-summer-ink)',      // mahogany
  sender: 'Mei L. · 4 doors down',
  time:   'Just arrived',
  category: 'Memory',
  title: 'One year ago, you found Pepper.',
  reference: 'Memory MEM-0518 · marked Mon May 18',
};

const PHOTO = {
  caption: 'Pepper, May 19 2025',
  // Soft photo composition rendered as SVG; "polaroid" frame wraps it.
};

const NOTE = [
  "It's been a year, can you believe it.",
  "I still think about how you walked back from the trail with Pepper under your arm, all muddy. He's nine now and getting slow but he still loses his mind when we pass your driveway.",
  "Thank you again. I baked you a loaf — it's on the porch.",
];
const NOTE_SIGN = 'Mei (and Pepper)';

const FACTS = [
  { icon: 'calendar-heart', label: 'A year ago today', value: 'Mon, May 19, 2025 · 7:42 PM' },
  { icon: 'message-square', label: 'Originally a Pulse post', value: '"Missing — small brown dog, Pepper"', note: 'tap to reopen the thread' },
  { icon: 'map-pin',        label: 'Where it happened',  value: 'Redwood Trail · Stop 4' },
  { icon: 'users',          label: 'Others on the thread', value: '6 neighbors helped search' },
];

const ELF_FRESH = {
  headline: 'Pantopus surfaced this memory',
  summary:  'A year ago today, Mei posted in the Pulse looking for Pepper and you brought him home. She marked this anniversary in her Mailbox a week ago — it released to you tonight.',
  bullets: [
    { icon: 'calendar',    label: 'Anniversary release', text: 'Mei scheduled this on May 11' },
    { icon: 'image',       label: '1 photograph attached', text: 'taken the night of, by Mei' },
    { icon: 'shield-check',label: 'Private mail',        text: 'sent only to you, not the Pulse' },
  ],
};

const ELF_SAVED = {
  headline: 'Saved to your Vault',
  summary:  'This memory lives in Mailbox › Vault › Memories · 2025. Only you can see it. Pantopus added a soft reminder for next May 18 so it can resurface again — you can turn that off.',
  bullets: [
    { icon: 'archive',         label: 'Mailbox › Vault › Memories', text: '12 items · 2025 folder' },
    { icon: 'eye-off',         label: 'Visible only to you',         text: 'Mei keeps her own copy' },
    { icon: 'bell',            label: 'Anniversary reminder set',    text: 'Mon May 18, 2027 · 7:00 PM' },
  ],
};

const VAULT_TRAIL = [
  { label: 'Mailbox',   icon: 'inbox' },
  { label: 'Vault',     icon: 'archive' },
  { label: 'Memories',  icon: 'heart' },
  { label: '2025',      icon: 'calendar', current: true },
];

// ── Card shell ────────────────────────────────────────────
function MemCard({ children, accent, style = {}, noPad = false }) {
  return (
    <div style={{
      position: 'relative',
      background: '#fff',
      border: '1px solid var(--app-border)',
      borderRadius: 16,
      padding: noPad ? 0 : 14,
      overflow: 'hidden',
      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      ...style,
    }}>
      {accent && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 4, background: accent,
        }}></div>
      )}
      <div style={{ paddingLeft: accent ? 4 : 0 }}>{children}</div>
    </div>
  );
}

// ── Top nav (matches archetype) ────────────────────────────
function MemNav() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '6px 8px 8px 4px',
      background: 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--app-border-subtle)',
      gap: 4,
    }}>
      <button style={memNavBtn}>
        <i data-lucide="chevron-left" style={{ width: 22, height: 22 }}></i>
        <span style={{ fontSize: 15, fontWeight: 500, marginLeft: -2 }}>Mailbox</span>
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: MEMORY.accent }}></span>
        <span style={{
          fontSize: 12, fontWeight: 700, color: 'var(--fg2)',
          letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>{MEMORY.category}</span>
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        <button style={memNavIco}><i data-lucide="bookmark" style={{ width: 18, height: 18 }}></i></button>
        <button style={memNavIco}><i data-lucide="more-horizontal" style={{ width: 18, height: 18 }}></i></button>
      </div>
    </div>
  );
}
const memNavBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 2,
  border: 'none', background: 'transparent',
  color: 'var(--color-primary-600)',
  padding: '6px 6px', cursor: 'pointer', borderRadius: 8,
};
const memNavIco = {
  width: 34, height: 34, borderRadius: 9999,
  border: 'none', background: 'var(--app-surface-sunken)',
  color: 'var(--fg2)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
};

// ── Envelope-meta hero (sender, arrival, title) ────────────
function MemHero({ saved }) {
  return (
    <MemCard accent={MEMORY.accent}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <TrustChip kind="verified" />
        <CategoryChip label={MEMORY.category} color={MEMORY.accent} />
        <span style={{ flex: 1 }}></span>
        <span style={{ fontSize: 11, color: 'var(--fg3)', fontWeight: 500 }}>{MEMORY.time}</span>
      </div>
      <div style={{
        fontSize: 11, fontWeight: 600, color: 'var(--fg3)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
      }}>From {MEMORY.sender}</div>
      <div style={{
        fontFamily: 'var(--font-serif)',
        fontSize: 22, fontWeight: 600, color: 'var(--fg1)',
        lineHeight: 1.2, letterSpacing: '-0.01em',
        textWrap: 'pretty',
      }}>{MEMORY.title}</div>
      <div style={{
        fontSize: 11, color: 'var(--fg3)', marginTop: 6,
        fontFamily: 'var(--font-mono)',
      }}>{MEMORY.reference}</div>

      {saved && (
        <div style={{
          marginTop: 12, padding: '8px 10px 8px 9px',
          background: 'var(--color-success-bg)',
          border: '1px solid #bbf7d0', borderRadius: 10,
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12, color: '#065f46',
        }}>
          <div style={{
            width: 20, height: 20, borderRadius: '50%',
            background: 'var(--color-success)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <i data-lucide="heart" style={{ width: 12, height: 12 }}></i>
          </div>
          <div>
            <span style={{ fontWeight: 700 }}>Kept in your Vault</span>
            <span style={{ color: '#047857', opacity: 0.85 }}> · only you can see it</span>
          </div>
        </div>
      )}
    </MemCard>
  );
}

// ── Polaroid (photograph hero) ─────────────────────────────
function Polaroid() {
  return (
    <div style={{
      // The stationery "table" the polaroid sits on
      padding: '28px 16px 20px',
      borderRadius: 16,
      background: MEMORY.paper,
      border: '1px solid rgba(74,31,26,0.10)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* paper grain */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'var(--paper-grain)',
        opacity: 0.4, pointerEvents: 'none',
      }}></div>

      {/* Tape strip */}
      <div style={{
        position: 'absolute', top: 6, left: '50%',
        width: 70, height: 18,
        transform: 'translateX(-50%) rotate(-2deg)',
        background: 'rgba(255,255,255,0.55)',
        borderLeft: '1px solid rgba(255,255,255,0.7)',
        borderRight: '1px solid rgba(255,255,255,0.7)',
        boxShadow: '0 1px 2px rgba(74,31,26,0.10)',
      }}></div>

      <div style={{
        width: 246, margin: '0 auto',
        background: '#fff',
        padding: '12px 12px 38px',
        boxShadow: '0 6px 18px rgba(74,31,26,0.18), 0 1px 2px rgba(74,31,26,0.10)',
        transform: 'rotate(-1.5deg)',
        position: 'relative',
        zIndex: 2,
      }}>
        {/* The "photo" */}
        <div style={{
          width: '100%', aspectRatio: '4 / 5',
          borderRadius: 1,
          overflow: 'hidden',
          position: 'relative',
        }}>
          <svg viewBox="0 0 200 250" preserveAspectRatio="xMidYMid slice"
               style={{ display: 'block', width: '100%', height: '100%' }}>
            <defs>
              <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#F8C97D" />
                <stop offset="0.55" stopColor="#F2B280" />
                <stop offset="1" stopColor="#C76E5A" />
              </linearGradient>
              <radialGradient id="sun" cx="0.72" cy="0.30" r="0.32">
                <stop offset="0" stopColor="#FFF2C8" stopOpacity="1" />
                <stop offset="0.5" stopColor="#FFD98A" stopOpacity="0.6" />
                <stop offset="1" stopColor="#FFD98A" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#7C8A4F" />
                <stop offset="1" stopColor="#4F5E33" />
              </linearGradient>
              <linearGradient id="dog" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#6B3A1C" />
                <stop offset="1" stopColor="#3D2010" />
              </linearGradient>
            </defs>

            {/* sky */}
            <rect x="0" y="0" width="200" height="170" fill="url(#sky)" />
            {/* sun */}
            <rect x="0" y="0" width="200" height="170" fill="url(#sun)" />
            {/* hills */}
            <path d="M0,150 Q60,120 110,140 T200,135 L200,170 L0,170 Z" fill="#9B6E50" opacity="0.6" />
            {/* trees, distant */}
            <g opacity="0.55" fill="#3F4D2A">
              <ellipse cx="22"  cy="148" rx="10" ry="14" />
              <ellipse cx="42"  cy="152" rx="8"  ry="11" />
              <ellipse cx="168" cy="146" rx="12" ry="16" />
              <ellipse cx="186" cy="150" rx="9"  ry="12" />
            </g>
            {/* grass */}
            <rect x="0" y="160" width="200" height="90" fill="url(#grass)" />
            {/* grass blades, near */}
            <g stroke="#3E4A26" strokeWidth="1.4" strokeLinecap="round" opacity="0.7">
              <line x1="12" y1="248" x2="14" y2="232" />
              <line x1="28" y1="248" x2="26" y2="234" />
              <line x1="46" y1="248" x2="48" y2="238" />
              <line x1="172" y1="248" x2="170" y2="234" />
              <line x1="186" y1="248" x2="188" y2="236" />
            </g>

            {/* Pepper — small brown dog, profile */}
            <g transform="translate(70,150)">
              {/* shadow */}
              <ellipse cx="33" cy="62" rx="32" ry="4" fill="#000" opacity="0.22" />
              {/* body */}
              <path d="M8,52 Q4,40 14,32 L52,30 Q62,30 62,42 L60,55 Q58,60 53,60 L52,55 L48,58 L42,58 L40,55 L22,55 L20,58 L14,58 L12,55 Q8,56 8,52 Z"
                    fill="url(#dog)" />
              {/* head */}
              <path d="M50,34 Q56,22 64,22 Q72,22 72,30 L70,38 Q68,42 64,42 L52,40 Z" fill="url(#dog)" />
              {/* ear, floppy */}
              <path d="M58,22 Q56,16 62,14 Q68,16 68,22 Q66,28 60,26 Z" fill="#2C170A" />
              {/* snout */}
              <path d="M65,34 L72,32 L72,37 L68,37 Z" fill="#2C170A" />
              {/* nose */}
              <circle cx="72" cy="33" r="1.6" fill="#1A0E06" />
              {/* eye */}
              <circle cx="63" cy="29" r="1.2" fill="#FFE7B8" />
              {/* tail, up */}
              <path d="M10,38 Q2,30 6,22 Q12,24 12,34 Z" fill="url(#dog)" />
              {/* collar tag */}
              <circle cx="54" cy="42" r="2.2" fill="#C9A24A" />
            </g>
          </svg>
        </div>

        {/* Polaroid caption — handwritten serif */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 10,
          textAlign: 'center',
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 13,
          color: '#4A1F1A',
          letterSpacing: '0.01em',
        }}>{PHOTO.caption}</div>
      </div>

      {/* small printed label below polaroid */}
      <div style={{
        textAlign: 'center', marginTop: 16,
        fontSize: 10.5, fontWeight: 700, color: '#7c2d12',
        letterSpacing: '0.16em', textTransform: 'uppercase',
        position: 'relative', zIndex: 2,
      }}>1 of 1 · sent by Mei</div>
    </div>
  );
}

// ── Note (the letter) ──────────────────────────────────────
function NoteLetter() {
  return (
    <div style={{
      borderRadius: 16,
      background: MEMORY.paper,
      border: '1px solid rgba(74,31,26,0.10)',
      padding: '20px 22px 22px',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 1px 2px rgba(74,31,26,0.06)',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'var(--paper-grain)',
        opacity: 0.4, pointerEvents: 'none',
      }}></div>
      <div style={{ position: 'relative', zIndex: 2 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
        }}>
          <div style={{
            width: 24, height: 1, background: MEMORY.accent,
          }}></div>
          <div style={{
            fontSize: 10, fontWeight: 700, color: '#7c2d12',
            letterSpacing: '0.16em', textTransform: 'uppercase',
          }}>The note</div>
          <div style={{ flex: 1, height: 1, background: 'rgba(124,45,18,0.18)' }}></div>
        </div>

        <div style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 16.5, lineHeight: 1.55,
          color: MEMORY.ink,
          textWrap: 'pretty',
        }}>
          {NOTE.map((p, i) => (
            <p key={i} style={{
              margin: i ? '12px 0 0' : 0,
              fontStyle: i === 0 ? 'normal' : 'normal',
            }}>{p}</p>
          ))}
          <div style={{
            marginTop: 18,
            fontStyle: 'italic',
            fontSize: 18,
            color: MEMORY.ink,
            letterSpacing: '0.005em',
          }}>— {NOTE_SIGN}</div>
        </div>
      </div>
    </div>
  );
}

// ── Memory context (facts row) ─────────────────────────────
function MemFacts() {
  return (
    <MemCard noPad>
      <div style={{
        padding: '10px 14px 8px',
        fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        borderBottom: '1px solid var(--app-border-subtle)',
      }}>The story behind it</div>
      <div>
        {FACTS.map((f, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start',
            padding: '10px 14px',
            borderBottom: i < FACTS.length - 1 ? '1px solid var(--app-border-subtle)' : 'none',
            gap: 12,
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6, flexShrink: 0,
              background: '#fef3e9',
              color: '#9a3412',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <i data-lucide={f.icon} style={{ width: 13, height: 13 }}></i>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 11, color: 'var(--fg3)', fontWeight: 600,
              }}>{f.label}</div>
              <div style={{
                fontSize: 13, color: 'var(--fg1)', fontWeight: 600,
                marginTop: 1, letterSpacing: '-0.005em',
                textWrap: 'pretty',
              }}>{f.value}</div>
              {f.note && (
                <div style={{ fontSize: 11, color: 'var(--color-primary-600)', marginTop: 2, fontWeight: 600 }}>
                  {f.note}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </MemCard>
  );
}

// ── Vault location card (saved state) ──────────────────────
function VaultCard() {
  return (
    <MemCard>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
      }}>Filed in your Vault</div>

      {/* breadcrumb */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap',
        padding: '8px 10px',
        background: 'var(--app-surface-sunken)',
        borderRadius: 10,
      }}>
        {VAULT_TRAIL.map((t, i) => (
          <React.Fragment key={i}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 8px', borderRadius: 9999,
              background: t.current ? '#fff' : 'transparent',
              border: t.current ? '1px solid var(--app-border)' : 'none',
              color: t.current ? 'var(--fg1)' : 'var(--fg2)',
              fontSize: 11.5, fontWeight: t.current ? 700 : 600,
              boxShadow: t.current ? '0 1px 1px rgba(0,0,0,0.03)' : 'none',
            }}>
              <i data-lucide={t.icon} style={{ width: 11, height: 11 }}></i>
              {t.label}
            </div>
            {i < VAULT_TRAIL.length - 1 && (
              <i data-lucide="chevron-right" style={{ width: 11, height: 11, color: 'var(--fg4)' }}></i>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Vault counters */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        gap: 0, marginTop: 10,
        padding: '10px 0',
        background: '#fff',
        border: '1px solid var(--app-border-subtle)',
        borderRadius: 10,
      }}>
        <VaultStat value="12" label="Memories" />
        <VaultStat value="2025" label="Folder" divider />
        <VaultStat value="Only you" label="Visibility" divider />
      </div>

      <button style={{
        marginTop: 10, width: '100%',
        background: '#fff',
        border: '1px solid var(--app-border)',
        color: 'var(--fg1)',
        borderRadius: 10,
        padding: '9px 12px',
        fontSize: 12.5, fontWeight: 700,
        cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}>
        Open Vault › Memories
        <i data-lucide="arrow-right" style={{ width: 13, height: 13 }}></i>
      </button>
    </MemCard>
  );
}
function VaultStat({ value, label, divider }) {
  return (
    <div style={{
      padding: '0 8px',
      borderLeft: divider ? '1px solid var(--app-border-subtle)' : 'none',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--fg1)', letterSpacing: '-0.015em' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--fg3)', fontWeight: 600, marginTop: 2, letterSpacing: '0.02em' }}>{label}</div>
    </div>
  );
}

// ── AI elf — same form as archetype, but warmer headline ───
function MemElf({ data }) {
  return (
    <div style={{
      background: 'linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 100%)',
      border: '1px solid #bae6fd',
      borderRadius: 16,
      padding: '12px 14px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 8,
          background: 'var(--color-primary-600)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 6px rgba(2,132,199,0.3)',
        }}>
          <i data-lucide="sparkles" style={{ width: 13, height: 13 }}></i>
        </div>
        <div style={{
          fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)',
          flex: 1, letterSpacing: '-0.005em',
        }}>{data.headline}</div>
      </div>
      <div style={{
        fontSize: 13, color: '#0c4a6e', lineHeight: 1.5, marginBottom: 10,
        textWrap: 'pretty',
      }}>{data.summary}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.bullets.map((b, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            fontSize: 12, lineHeight: 1.45, color: 'var(--fg1)',
          }}>
            <div style={{
              width: 16, height: 16, borderRadius: 4,
              background: '#fff', color: 'var(--color-primary-700)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, marginTop: 1, border: '1px solid #bae6fd',
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

// ── Actions ────────────────────────────────────────────────
function MemActions({ saved }) {
  if (saved) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button style={{
          width: '100%', padding: '14px 16px',
          background: '#fff',
          color: 'var(--color-success)',
          border: '1.5px solid var(--color-success-light)',
          borderRadius: 14,
          fontSize: 15, fontWeight: 700, letterSpacing: '-0.005em',
          cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <i data-lucide="heart" style={{ width: 16, height: 16 }}></i>
          Saved · Tap to remove from Vault
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          <MemChip icon="send"          label="Share back" />
          <MemChip icon="message-circle" label="Reply" />
          <MemChip icon="download"      label="Save photo" />
          <MemChip icon="bell-off"      label="Mute" />
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button style={{
        width: '100%', padding: '14px 16px',
        background: 'var(--color-primary-600)', color: '#fff',
        border: 'none', borderRadius: 14,
        fontSize: 15, fontWeight: 700, letterSpacing: '-0.005em',
        boxShadow: 'var(--shadow-primary)',
        cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <i data-lucide="archive" style={{ width: 16, height: 16 }}></i>
        Save to Vault
      </button>
      <button style={{
        width: '100%', padding: '12px 16px',
        background: '#fff',
        color: 'var(--color-primary-700)',
        border: '1.5px solid var(--color-primary-200)',
        borderRadius: 12,
        fontSize: 13.5, fontWeight: 700,
        cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}>
        <i data-lucide="send" style={{ width: 14, height: 14 }}></i>
        Share back with Mei
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <MemChip icon="message-circle" label="Reply" />
        <MemChip icon="download"       label="Save photo" />
        <MemChip icon="forward"        label="Forward" />
      </div>
    </div>
  );
}
function MemChip({ icon, label }) {
  return (
    <button style={{
      background: '#fff',
      border: '1px solid var(--app-border)',
      borderRadius: 12,
      padding: '10px 4px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      color: 'var(--fg2)',
      cursor: 'pointer',
      fontSize: 10.5, fontWeight: 600,
    }}>
      <i data-lucide={icon} style={{ width: 16, height: 16 }}></i>
      {label}
    </button>
  );
}

// ── Screen ─────────────────────────────────────────────────
function MailMemoryScreen({ state = 'fresh', dataLabel }) {
  const saved = state === 'saved';
  return (
    <div data-screen-label={dataLabel} style={{
      width: '100%', height: '100%',
      background: 'var(--app-bg)',
      display: 'flex', flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
      paddingTop: 54,
    }}>
      <MemNav />

      <div style={{
        flex: 1,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '12px 16px 96px',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <MemHero saved={saved} />
          <Polaroid />
          <NoteLetter />
          <MemElf data={saved ? ELF_SAVED : ELF_FRESH} />
          {saved ? <VaultCard /> : <MemFacts />}
          <MemActions saved={saved} />
        </div>
      </div>

      <BottomTabBar active="mail" />
    </div>
  );
}

Object.assign(window, { MailMemoryScreen });
