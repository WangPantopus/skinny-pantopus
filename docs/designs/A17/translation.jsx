// MailTranslationScreen — A17 archetype × Translation variant.
// A mail item auto-translated by Pantopus.
// Slots beyond the archetype:
//   - Language badge (detected source → target, confidence)
//   - View toggle: Translated · Original · Side by side
//   - Side-by-side comparison (paragraph-aligned, paper serif)
//   - Translator-notes glossary
//   - Primary action: Confirm translation
//   - Secondary "confirmed" state: confirmation banner + clean reading view

// ── Data ───────────────────────────────────────────────────
const TR = {
  accent: '#be185d',           // rose — translation / language
  category: 'Translation',
  trust: 'verified',
  time: '2h ago',
  src: { code: 'ES', name: 'Spanish (Mexico)', conf: 98 },
  tgt: { code: 'EN', name: 'English' },
};

const LETTER = [
  { es: 'Querida vecina,', en: 'Dear neighbor,', head: true },
  {
    es: 'Le escribo para invitarla a la posada del sábado en el parque Elm. Habrá tamales, ponche y música para las familias.',
    en: 'I\u2019m writing to invite you to Saturday\u2019s posada at Elm Park. There will be tamales, punch, and music for the families.',
  },
  {
    es: 'Si puede, traiga una vela para la procesión. Empezamos a las seis de la tarde, junto al quiosco.',
    en: 'If you can, bring a candle for the procession. We start at six in the evening, by the gazebo.',
  },
  { es: 'Con cariño, su vecina Lucía.', en: 'With love, your neighbor Lucía.', sign: true },
];

const GLOSSARY = [
  { term: 'posada', kind: 'kept in Spanish', note: 'A traditional neighborhood gathering in the weeks before Christmas — no single English word captures it.' },
  { term: 'quiosco → gazebo', kind: 'word choice', note: 'Rendered as “gazebo” for the bandstand on the park lawn.' },
];

const SENDER = {
  initials: 'LH',
  avatarBg: 'linear-gradient(135deg, #be185d 0%, #831843 100%)',
  name: 'Lucía Herrera',
  dept: 'Neighbor · Elm Park · 3 doors down',
  kind: 'Verified neighbor',
  proof: 'Address verified',
};

const ELF_MACHINE = {
  headline: 'Pantopus translated this letter',
  summary: 'I auto-detected Spanish (Mexico) and rendered it in English with high confidence. Two terms were judgment calls — I kept “posada” as-is and noted both below. Confirm when it reads right and I\u2019ll mark the translation trusted.',
  bullets: [
    { icon: 'languages',  label: 'Spanish → English', text: '98% confidence' },
    { icon: 'book-open',  label: '2 translator notes', text: 'see the glossary below' },
    { icon: 'volume-2',   label: 'Listen in either language', text: 'tap play on a column' },
  ],
};
const ELF_CONFIRMED = {
  headline: 'Translation confirmed',
  summary: 'You confirmed this English translation on May 28. Pantopus keeps both versions in your Vault, so the original Spanish is never lost. Any reply you send can auto-translate back for Lucía.',
  bullets: [
    { icon: 'badge-check', label: 'Confirmed by you', text: 'May 28 · 2:40 PM' },
    { icon: 'archive',     label: 'Both versions saved', text: 'original + English in Vault' },
    { icon: 'reply',       label: 'Reply in English',    text: 'we translate to Spanish on send' },
  ],
};

// ── Card shell ─────────────────────────────────────────────
function TrCard({ children, style = {}, noPad = false }) {
  return (
    <div style={{
      position: 'relative', background: '#fff', border: '1px solid var(--app-border)',
      borderRadius: 16, padding: noPad ? 0 : 14, overflow: 'hidden',
      boxShadow: '0 1px 2px rgba(0,0,0,0.03)', ...style,
    }}>{children}</div>
  );
}
function CardLabel({ children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{children}</div>
      {right}
    </div>
  );
}

// ── Top nav ────────────────────────────────────────────────
function TransNav() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '6px 8px 8px 4px', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--app-border-subtle)', gap: 4,
    }}>
      <button style={trNavBtn}>
        <i data-lucide="chevron-left" style={{ width: 22, height: 22 }}></i>
        <span style={{ fontSize: 15, fontWeight: 500, marginLeft: -2 }}>Mailbox</span>
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: TR.accent }}></span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg2)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Translation</span>
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        <button style={trNavIco}><i data-lucide="share" style={{ width: 18, height: 18 }}></i></button>
        <button style={trNavIco}><i data-lucide="more-horizontal" style={{ width: 18, height: 18 }}></i></button>
      </div>
    </div>
  );
}
const trNavBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 2, border: 'none', background: 'transparent',
  color: 'var(--color-primary-600)', padding: '6px 6px', cursor: 'pointer', borderRadius: 8,
};
const trNavIco = {
  width: 34, height: 34, borderRadius: 9999, border: 'none', background: 'var(--app-surface-sunken)',
  color: 'var(--fg2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
};

// ── Language badge ─────────────────────────────────────────
function LangBadge({ confirmed }) {
  return (
    <TrCard>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* ES → EN pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LangPill code={TR.src.code} muted />
          <i data-lucide="arrow-right" style={{ width: 16, height: 16, color: 'var(--fg4)' }}></i>
          <LangPill code={TR.tgt.code} accent />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg1)', letterSpacing: '-0.005em' }}>
            {TR.src.name} → {TR.tgt.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
            {confirmed ? (
              <>
                <i data-lucide="badge-check" style={{ width: 12, height: 12, color: 'var(--color-success)' }}></i>
                Confirmed translation
              </>
            ) : (
              <>
                <i data-lucide="scan-text" style={{ width: 12, height: 12 }}></i>
                Auto-detected · {TR.src.conf}% match
              </>
            )}
          </div>
        </div>
      </div>
    </TrCard>
  );
}
function LangPill({ code, muted, accent }) {
  return (
    <span style={{
      minWidth: 38, height: 34, padding: '0 10px', borderRadius: 9, display: 'inline-flex',
      alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, letterSpacing: '0.04em',
      background: accent ? TR.accent : 'var(--app-surface-sunken)',
      color: accent ? '#fff' : 'var(--fg2)',
      border: accent ? 'none' : '1px solid var(--app-border)',
    }}>{code}</span>
  );
}

// ── View toggle ────────────────────────────────────────────
function ViewToggle({ active }) {
  const opts = [
    { id: 'translated', label: 'Translated', icon: 'languages' },
    { id: 'original',   label: 'Original',   icon: 'file-text' },
    { id: 'side',       label: 'Side by side', icon: 'columns-2' },
  ];
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4,
      background: 'var(--app-surface-sunken)', borderRadius: 12, padding: 4,
    }}>
      {opts.map(o => {
        const on = o.id === active;
        return (
          <div key={o.id} style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            padding: '8px 4px', borderRadius: 9, cursor: 'pointer',
            background: on ? '#fff' : 'transparent',
            color: on ? TR.accent : 'var(--fg3)',
            fontSize: 12, fontWeight: on ? 700 : 600,
            boxShadow: on ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
          }}>
            <i data-lucide={o.icon} style={{ width: 14, height: 14 }}></i>
            {o.label}
          </div>
        );
      })}
    </div>
  );
}

// ── Side-by-side comparison ────────────────────────────────
function SideBySide() {
  return (
    <TrCard noPad>
      {/* column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid var(--app-border-subtle)' }}>
        <div style={colHead(false)}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--fg4)' }}></span>
          Original · {TR.src.code}
        </div>
        <div style={{ ...colHead(true), borderLeft: '1px solid var(--app-border-subtle)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: TR.accent }}></span>
          English
        </div>
      </div>
      {/* aligned paragraphs */}
      <div>
        {LETTER.map((p, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            borderBottom: i < LETTER.length - 1 ? '1px solid var(--app-border-subtle)' : 'none',
          }}>
            <div style={cell(false, p)}>{p.es}</div>
            <div style={{ ...cell(true, p), borderLeft: '1px solid var(--app-border-subtle)' }}>
              {renderEn(p)}
            </div>
          </div>
        ))}
      </div>
    </TrCard>
  );
}
const colHead = (accent) => ({
  display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px',
  fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
  color: accent ? TR.accent : 'var(--fg3)',
});
const cell = (translated, p) => ({
  padding: '11px 12px',
  fontFamily: 'var(--font-serif)',
  fontSize: p.head || p.sign ? 13 : 12.5,
  lineHeight: 1.5,
  color: translated ? 'var(--fg1)' : 'var(--fg3)',
  fontWeight: p.head ? 700 : 400,
  fontStyle: p.sign ? 'italic' : 'normal',
  textWrap: 'pretty',
});
// highlight the glossary term "posada" in the English cell
function renderEn(p) {
  if (p.en.includes('posada')) {
    const [a, b] = p.en.split('posada');
    return <span>{a}<mark style={{
      background: '#fce7f3', color: '#9d174d', padding: '0 2px', borderRadius: 3,
      fontStyle: 'italic', fontWeight: 600,
    }}>posada</mark>{b}</span>;
  }
  return p.en;
}

// ── Reading view (confirmed state) ─────────────────────────
function ReadingView() {
  return (
    <TrCard noPad>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: '1px solid var(--app-border-subtle)',
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: TR.accent, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: TR.accent }}></span>
          English translation
        </span>
        <span style={{ fontSize: 11, color: 'var(--color-primary-600)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <i data-lucide="arrow-left-right" style={{ width: 12, height: 12 }}></i>
          Show original
        </span>
      </div>
      {/* letter on faint paper */}
      <div style={{ background: '#fdf9f4', padding: '18px 18px 20px' }}>
        {LETTER.map((p, i) => (
          <div key={i} style={{
            fontFamily: 'var(--font-serif)',
            fontSize: p.head || p.sign ? 15 : 14.5,
            lineHeight: 1.6, color: '#3a2f2a',
            fontWeight: p.head ? 700 : 400,
            fontStyle: p.sign ? 'italic' : 'normal',
            marginBottom: i < LETTER.length - 1 ? (p.head ? 10 : 14) : 0,
            textWrap: 'pretty',
          }}>{renderEn(p)}</div>
        ))}
      </div>
    </TrCard>
  );
}

// ── Glossary ───────────────────────────────────────────────
function Glossary() {
  return (
    <TrCard noPad>
      <div style={{ padding: '12px 14px 4px' }}>
        <CardLabel right={
          <span style={{ fontSize: 10, color: 'var(--fg3)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <i data-lucide="sparkles" style={{ width: 11, height: 11 }}></i>
            From Pantopus
          </span>
        }>Translator notes</CardLabel>
      </div>
      <div>
        {GLOSSARY.map((g, i) => (
          <div key={i} style={{ padding: '11px 14px', borderTop: '1px solid var(--app-border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{
                fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 700,
                fontSize: 14, color: 'var(--fg1)',
              }}>{g.term}</span>
              <span style={{
                fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 9999,
                background: '#fce7f3', color: '#9d174d', textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>{g.kind}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg2)', lineHeight: 1.5, textWrap: 'pretty' }}>{g.note}</div>
          </div>
        ))}
      </div>
    </TrCard>
  );
}

// ── AI elf ─────────────────────────────────────────────────
function TransElf({ data }) {
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

// ── Confirm banner (confirmed state) ───────────────────────
function ConfirmBanner() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: 'var(--color-success-bg)', border: '1px solid var(--color-success-light)',
      borderRadius: 16, padding: '12px 14px',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: 'var(--color-success)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 6px rgba(5,150,105,0.3)',
      }}>
        <i data-lucide="check" style={{ width: 19, height: 19 }}></i>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#065f46' }}>Translation confirmed</div>
        <div style={{ fontSize: 11.5, color: '#047857', marginTop: 1 }}>Marked trusted by you · May 28 · 2:40 PM</div>
      </div>
    </div>
  );
}

// ── Sender card ────────────────────────────────────────────
function SenderCard() {
  return (
    <TrCard>
      <CardLabel>From</CardLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: SENDER.avatarBg, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, flexShrink: 0, letterSpacing: '0.02em', position: 'relative',
        }}>
          {SENDER.initials}
          <span style={{
            position: 'absolute', right: -3, bottom: -3, width: 16, height: 16, borderRadius: '50%',
            background: 'var(--color-success)', color: '#fff', border: '2px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i data-lucide="check" style={{ width: 9, height: 9 }}></i>
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg1)' }}>{SENDER.name}</div>
          <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 1 }}>{SENDER.dept}</div>
          <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 9999,
              background: 'var(--color-identity-personal-bg)', color: 'var(--color-identity-personal)',
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              <i data-lucide="user-check" style={{ width: 9, height: 9 }}></i>
              {SENDER.kind}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 9999,
              background: 'var(--color-success-bg)', color: '#047857',
            }}>{SENDER.proof}</span>
          </div>
        </div>
        <i data-lucide="chevron-right" style={{ width: 16, height: 16, color: 'var(--fg4)' }}></i>
      </div>
    </TrCard>
  );
}

// ── Action bars ────────────────────────────────────────────
function TransActions() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button style={{
        width: '100%', padding: '14px 16px', background: 'var(--color-primary-600)', color: '#fff',
        border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, letterSpacing: '-0.005em',
        boxShadow: 'var(--shadow-primary)', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, whiteSpace: 'nowrap',
      }}>
        <i data-lucide="check-check" style={{ width: 17, height: 17 }}></i>
        Confirm translation
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        <TrChip icon="pencil" label="Edit" />
        <TrChip icon="languages" label="Language" />
        <TrChip icon="volume-2" label="Listen" />
        <TrChip icon="archive" label="Archive" />
      </div>
    </div>
  );
}
function ConfirmedActions() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button style={{
        width: '100%', padding: '14px 16px', background: 'var(--color-primary-600)', color: '#fff',
        border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, letterSpacing: '-0.005em',
        boxShadow: 'var(--shadow-primary)', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, whiteSpace: 'nowrap',
      }}>
        <i data-lucide="reply" style={{ width: 17, height: 17 }}></i>
        Reply to Lucía
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        <TrChip icon="repeat" label="Re-translate" />
        <TrChip icon="file-text" label="Original" />
        <TrChip icon="share-2" label="Share" />
        <TrChip icon="archive" label="Archive" />
      </div>
    </div>
  );
}
function TrChip({ icon, label }) {
  return (
    <button style={{
      background: '#fff', border: '1px solid var(--app-border)', borderRadius: 12, padding: '10px 4px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      color: 'var(--fg2)', cursor: 'pointer', fontSize: 10.5, fontWeight: 600,
    }}>
      <i data-lucide={icon} style={{ width: 17, height: 17 }}></i>
      {label}
    </button>
  );
}

// ── Screen ─────────────────────────────────────────────────
function MailTranslationScreen({ state = 'machine', dataLabel }) {
  const confirmed = state === 'confirmed';
  return (
    <div data-screen-label={dataLabel} style={{
      width: '100%', height: '100%', background: 'var(--app-bg)',
      display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden',
      paddingTop: 54,
    }}>
      <TransNav />

      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '12px 16px 96px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* header row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 2px' }}>
            <TrustChip kind={TR.trust} />
            <CategoryChip label={TR.category} color={TR.accent} />
            <span style={{ flex: 1 }}></span>
            <span style={{ fontSize: 11, color: 'var(--fg3)', fontWeight: 500 }}>{TR.time}</span>
          </div>

          {confirmed && <ConfirmBanner />}
          <LangBadge confirmed={confirmed} />
          <ViewToggle active={confirmed ? 'translated' : 'side'} />

          {confirmed ? <ReadingView /> : <SideBySide />}

          <TransElf data={confirmed ? ELF_CONFIRMED : ELF_MACHINE} />
          <Glossary />
          <SenderCard />

          {confirmed ? <ConfirmedActions /> : <TransActions />}
        </div>
      </div>

      <BottomTabBar active="mail" />
    </div>
  );
}

Object.assign(window, { MailTranslationScreen });
