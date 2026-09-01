// MailRecordsScreen — A17 archetype × Records variant.
// "Records mail" = an archival document delivery (financial statement,
// lab result, contract, EOB). The shape is "here's an official document
// + the few facts you'll want at a glance + file it where it belongs."
//
// This instance uses a quarterly investment statement to exercise the
// (account · date · amount) fact set, but the layout generalises to any
// financial / medical / legal record.
//
// Slots beyond the archetype:
//   - Document type badge (statement · invoice · lab result · etc.)
//   - Issuer card (institution + dept + the regulated identifier)
//   - Document preview (multi-page paper hero — looks like the doc itself)
//   - Key facts grid (account · period · amount · change · etc.)
//   - Body excerpt (the doctor's note · the cover letter · etc.)
//   - Vault destination breadcrumb (where it will be filed)
//   - Retention notice (how long Pantopus keeps it · regulatory)
//   - Related records strip (other items in the same series)
//   - Primary "File in vault" → secondary state "Filed" with vault path
//     and retention timer running.

// ── Data ───────────────────────────────────────────────────
const REC = {
  accent: '#475569',                  // slate-600 — institutional, archival
  accentDeep: '#1e293b',              // slate-800
  accentSoft: '#e2e8f0',              // slate-200
  accentBg: '#f8fafc',                // slate-50
  trust: 'verified',
  category: 'Records',
  sender: 'Meridian Wealth Management',
  time: '9h ago',
  title: 'Q1 2026 Investment Statement — Roth IRA',
  reference: 'Statement MWM-2026-Q1-9981842 · 4 pages · PDF + structured data',
};

const DOC_TYPE = {
  kind: 'Financial · Statement',
  classLabel: 'Quarterly Statement',
  icon: 'file-text',
  retention: 'Pantopus keeps this 7 years (IRS §6501)',
};

const ISSUER = {
  initials: 'MW',
  avatarBg: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
  name: 'Meridian Wealth Management',
  dept: 'Retirement Services · Roth IRA division',
  identifier: 'CRD# 814-2257 · FINRA member',
  trustNote: 'Sender domain DKIM-verified · matches SEC registration',
};

const FACTS = [
  {
    icon: 'hash',
    label: 'Account',
    value: 'Roth IRA ····4421',
    note: 'Holder: you · individual',
    mono: true,
  },
  {
    icon: 'calendar-range',
    label: 'Period covered',
    value: 'Jan 1 – Mar 31, 2026',
    note: 'Q1 2026 · 90 days',
  },
  {
    icon: 'dollar-sign',
    label: 'Ending balance',
    value: '$84,237.16',
    note: 'As of Mar 31, 4:00 PM ET',
    emphasis: true,
  },
  {
    icon: 'trending-up',
    label: 'Net change',
    value: '+$3,419.08',
    note: '+4.23% · contributions $1,500 · market $1,919',
    tone: 'positive',
    emphasis: true,
  },
  {
    icon: 'file-clock',
    label: 'Statement date',
    value: 'Apr 4, 2026',
    note: 'Delivered to Pantopus Apr 4 · 9:12 AM',
  },
];

const FACTS_FILED = [
  {
    icon: 'check-circle',
    label: 'Status',
    value: 'Filed in Vault',
    note: 'Locked · indexed · searchable',
    tone: 'positive',
    emphasis: true,
  },
  ...FACTS,
];

const BODY = [
  'This statement reports activity in your Roth IRA for the quarter ended March 31, 2026. It includes the account summary, positions, dividends, contributions, and performance attribution required under FINRA Rule 2231.',
  'Two contributions totalling $1,500.00 were credited during the quarter. No withdrawals were taken. Market appreciation accounted for the balance of the $3,419.08 net change.',
];

const VAULT_PATH = [
  { label: 'Mailbox',  icon: 'inbox' },
  { label: 'Vault',    icon: 'archive' },
  { label: 'Finance',  icon: 'landmark' },
  { label: 'Statements', icon: 'file-text' },
  { label: '2026',     icon: 'calendar', current: true },
];

const RELATED = [
  { period: 'Q4 2025', amount: '$80,818.08', when: 'Filed Jan 7', filed: true },
  { period: 'Q3 2025', amount: '$78,902.41', when: 'Filed Oct 6', filed: true },
  { period: 'Q2 2025', amount: '$76,118.66', when: 'Filed Jul 8', filed: true },
];

const ELF_OPEN = {
  headline: 'Pantopus opened this for you',
  summary: 'Standard quarterly statement from Meridian. Balance is up 4.2% on the quarter — that\'s in line with your other accounts. No action needed; just file it for tax season.',
  bullets: [
    { icon: 'file-check',    label: 'Authentic statement', text: 'DKIM + FINRA registry match' },
    { icon: 'trending-up',   label: 'Up 4.2% on the quarter', text: 'matches your other accounts' },
    { icon: 'archive',       label: 'Suggested: Vault › Finance › Statements › 2026', text: 'where last 3 quarters live' },
  ],
};

const ELF_FILED = {
  headline: 'Filed · here\'s where it lives',
  summary: 'Stored in Vault › Finance › Statements › 2026 with the rest of your Roth IRA quarterlies. Pantopus will keep it for 7 years per IRS §6501 and surface it during tax prep.',
  bullets: [
    { icon: 'lock',           label: 'Read-only copy locked',    text: 'original PDF + structured JSON · checksummed' },
    { icon: 'calendar-clock', label: 'Retention: 7 years',       text: 'auto-delete prompt Apr 2033' },
    { icon: 'search',         label: 'Indexed and searchable',   text: 'find it by account, ticker, or amount' },
  ],
};

// ── Card shell ────────────────────────────────────────────
function RcCard({ children, accent, style = {}, noPad = false }) {
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

// ── Top nav ────────────────────────────────────────────────
function RecordsNav() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '6px 8px 8px 4px',
      background: 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--app-border-subtle)',
      gap: 4,
    }}>
      <button style={rcNavBtn}>
        <i data-lucide="chevron-left" style={{ width: 22, height: 22 }}></i>
        <span style={{ fontSize: 15, fontWeight: 500, marginLeft: -2 }}>Mailbox</span>
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: REC.accent, transform: 'rotate(0deg)' }}></span>
        <span style={{
          fontSize: 12, fontWeight: 700, color: 'var(--fg2)',
          letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>Records</span>
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        <button style={rcNavIco}><i data-lucide="download" style={{ width: 18, height: 18 }}></i></button>
        <button style={rcNavIco}><i data-lucide="more-horizontal" style={{ width: 18, height: 18 }}></i></button>
      </div>
    </div>
  );
}
const rcNavBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 2,
  border: 'none', background: 'transparent',
  color: 'var(--color-primary-600)',
  padding: '6px 6px', cursor: 'pointer',
  borderRadius: 8,
};
const rcNavIco = {
  width: 34, height: 34, borderRadius: 9999,
  border: 'none', background: 'var(--app-surface-sunken)',
  color: 'var(--fg2)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
};

// ── Hero with embedded document preview ────────────────────
function RecordsHero({ filed }) {
  return (
    <RcCard accent={REC.accent}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <TrustChip kind={REC.trust} />
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 8px', borderRadius: 4,
          background: REC.accentBg, border: `1px solid ${REC.accentSoft}`,
          color: REC.accentDeep, fontSize: 10, fontWeight: 700,
          letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>
          <i data-lucide={DOC_TYPE.icon} style={{ width: 10, height: 10 }}></i>
          {DOC_TYPE.classLabel}
        </span>
        <span style={{ flex: 1 }}></span>
        <span style={{ fontSize: 11, color: 'var(--fg3)', fontWeight: 500 }}>{REC.time}</span>
      </div>

      <div style={{
        fontSize: 11, fontWeight: 600, color: 'var(--fg3)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
      }}>{REC.sender}</div>

      <div style={{
        fontSize: 18, fontWeight: 700, color: 'var(--fg1)',
        lineHeight: 1.25, letterSpacing: '-0.015em',
        textWrap: 'pretty',
      }}>{REC.title}</div>

      <div style={{
        fontSize: 11, color: 'var(--fg3)', marginTop: 6,
        fontFamily: 'var(--font-mono)', lineHeight: 1.4,
      }}>{REC.reference}</div>

      {/* Paper stack preview */}
      <PaperStack />

      {filed && (
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
            <i data-lucide="check" style={{ width: 13, height: 13 }}></i>
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 700 }}>Filed in Vault</span>
            <span style={{ color: '#047857', opacity: 0.85 }}> · Today 2:14 PM · retention 7y</span>
          </div>
        </div>
      )}
    </RcCard>
  );
}

// Paper stack: three pages with letterhead — pure decoration that
// communicates "this is an archival document, not just a notification."
function PaperStack() {
  return (
    <div style={{
      position: 'relative',
      marginTop: 14,
      height: 156,
      perspective: '600px',
    }}>
      {/* back page */}
      <PaperSheet
        x={-8} y={6} rot={-2.5}
        height={140}
        muted
      />
      {/* middle page */}
      <PaperSheet
        x={8} y={3} rot={1.8}
        height={144}
        muted
      />
      {/* front page — full letterhead */}
      <PaperSheet
        x={0} y={0} rot={0}
        height={148}
        front
      />
      {/* page count chip */}
      <div style={{
        position: 'absolute',
        right: 6, top: 6,
        background: REC.accentDeep,
        color: '#fff',
        padding: '3px 8px',
        borderRadius: 9999,
        fontSize: 10, fontWeight: 700,
        letterSpacing: '0.04em', textTransform: 'uppercase',
        display: 'inline-flex', alignItems: 'center', gap: 4,
        boxShadow: '0 2px 4px rgba(0,0,0,0.18)',
        zIndex: 4,
      }}>
        <i data-lucide="files" style={{ width: 10, height: 10 }}></i>
        4 pages · PDF
      </div>
    </div>
  );
}

function PaperSheet({ x, y, rot, height, front, muted }) {
  return (
    <div style={{
      position: 'absolute',
      left: '50%',
      top: 0,
      transform: `translateX(calc(-50% + ${x}px)) translateY(${y}px) rotate(${rot}deg)`,
      width: '78%',
      height,
      background: muted ? '#f3f4f6' : '#fff',
      border: '1px solid var(--app-border)',
      borderRadius: 4,
      boxShadow: front
        ? '0 6px 16px rgba(15, 23, 42, 0.14), 0 1px 2px rgba(0,0,0,0.06)'
        : '0 2px 6px rgba(15, 23, 42, 0.08)',
      overflow: 'hidden',
      zIndex: front ? 3 : muted ? 1 : 2,
    }}>
      {front && (
        <div style={{ padding: '10px 12px', height: '100%', position: 'relative' }}>
          {/* letterhead */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            paddingBottom: 6, borderBottom: `1.5px solid ${REC.accentDeep}`,
          }}>
            <div style={{
              width: 18, height: 18, borderRadius: 4,
              background: REC.accentDeep, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, fontWeight: 800, letterSpacing: '0.05em',
            }}>MW</div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, color: REC.accentDeep, letterSpacing: '0.02em', lineHeight: 1 }}>
                MERIDIAN WEALTH
              </div>
              <div style={{ fontSize: 6, color: 'var(--fg3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 1 }}>
                Retirement Services
              </div>
            </div>
            <span style={{ flex: 1 }}></span>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 7, color: 'var(--fg3)', letterSpacing: '0.04em' }}>STATEMENT</div>
              <div style={{ fontSize: 8, fontWeight: 700, color: REC.accentDeep, fontFamily: 'var(--font-mono)' }}>
                Q1 2026
              </div>
            </div>
          </div>
          {/* body type-shimmer lines */}
          <div style={{ marginTop: 9, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <ShimLine w="38%" h={5} dark />
            <ShimLine w="62%" h={3} />
            <ShimLine w="55%" h={3} />
            <div style={{ height: 4 }}></div>
            <ShimLine w="42%" h={5} dark />
            <ShimLine w="74%" h={3} />
            <ShimLine w="68%" h={3} />
            <ShimLine w="58%" h={3} />
          </div>
          {/* tabular footer */}
          <div style={{
            position: 'absolute', left: 12, right: 12, bottom: 8,
            display: 'flex', justifyContent: 'space-between',
            paddingTop: 6, borderTop: '1px solid var(--app-border)',
            fontSize: 7, fontFamily: 'var(--font-mono)',
            color: 'var(--fg3)',
          }}>
            <span>ACCT ····4421</span>
            <span style={{ color: REC.accentDeep, fontWeight: 700 }}>$84,237.16</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ShimLine({ w, h, dark }) {
  return (
    <div style={{
      width: w,
      height: h,
      background: dark ? REC.accentDeep : '#cbd5e1',
      borderRadius: 2,
      opacity: dark ? 0.85 : 1,
    }}></div>
  );
}

// ── Issuer card ────────────────────────────────────────────
function IssuerCard() {
  return (
    <RcCard>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
      }}>Issuer</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 46, height: 46, borderRadius: 10,
          background: ISSUER.avatarBg, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 800, flexShrink: 0,
          letterSpacing: '0.04em', position: 'relative',
        }}>
          {ISSUER.initials}
          <span style={{
            position: 'absolute', right: -3, bottom: -3,
            width: 18, height: 18, borderRadius: '50%',
            background: '#fff', color: REC.accentDeep,
            border: `1.5px solid ${REC.accentDeep}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i data-lucide="landmark" style={{ width: 10, height: 10 }}></i>
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--fg1)', letterSpacing: '-0.005em' }}>
            {ISSUER.name}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--fg3)', marginTop: 2, lineHeight: 1.35 }}>
            {ISSUER.dept}
          </div>
          <div style={{
            fontSize: 10.5, color: REC.accentDeep, marginTop: 4,
            fontFamily: 'var(--font-mono)', fontWeight: 600,
          }}>{ISSUER.identifier}</div>
        </div>
      </div>
      <div style={{
        marginTop: 10, padding: '7px 10px',
        background: REC.accentBg,
        border: `1px solid ${REC.accentSoft}`,
        borderRadius: 8,
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 11, color: REC.accentDeep,
      }}>
        <i data-lucide="shield-check" style={{ width: 12, height: 12 }}></i>
        {ISSUER.trustNote}
      </div>
    </RcCard>
  );
}

// ── Key facts ──────────────────────────────────────────────
function KeyFacts({ filed }) {
  const facts = filed ? FACTS_FILED : FACTS;
  return (
    <RcCard noPad>
      <div style={{
        padding: '10px 14px 8px',
        fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        borderBottom: '1px solid var(--app-border-subtle)',
      }}>Key facts</div>
      <div>
        {facts.map((f, i) => (
          <FactRow key={i} f={f} divider={i > 0} />
        ))}
      </div>
    </RcCard>
  );
}

function FactRow({ f, divider }) {
  const valueColor = f.tone === 'positive' ? '#047857' : 'var(--fg1)';
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '11px 14px',
      borderTop: divider ? '1px solid var(--app-border-subtle)' : 'none',
      background: f.emphasis ? REC.accentBg : '#fff',
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: 7,
        background: '#fff', color: REC.accentDeep,
        border: `1px solid ${REC.accentSoft}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, marginTop: 1,
      }}>
        <i data-lucide={f.icon} style={{ width: 13, height: 13 }}></i>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 10.5, fontWeight: 700, color: 'var(--fg3)',
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>{f.label}</div>
        <div style={{
          fontSize: f.emphasis ? 17 : 14, fontWeight: f.emphasis ? 800 : 700,
          color: valueColor, marginTop: 2, lineHeight: 1.2,
          letterSpacing: f.emphasis ? '-0.015em' : '-0.005em',
          fontFamily: f.mono ? 'var(--font-mono)' : 'inherit',
        }}>{f.value}</div>
        {f.note && (
          <div style={{ fontSize: 11.5, color: 'var(--fg3)', marginTop: 3, lineHeight: 1.4 }}>
            {f.note}
          </div>
        )}
      </div>
      {f.tone === 'positive' && f.emphasis && (
        <div style={{
          padding: '3px 6px', borderRadius: 6,
          background: 'var(--color-success-bg)',
          color: '#047857',
          fontSize: 10, fontWeight: 800, letterSpacing: '0.02em',
          flexShrink: 0,
        }}>
          <i data-lucide="trending-up" style={{ width: 10, height: 10, verticalAlign: -1 }}></i>
        </div>
      )}
    </div>
  );
}

// ── Body excerpt ───────────────────────────────────────────
function RecordsBody() {
  return (
    <RcCard>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
        display: 'flex', alignItems: 'center',
      }}>
        <span>Cover letter</span>
        <span style={{ flex: 1 }}></span>
        <span style={{
          fontSize: 10.5, color: 'var(--fg4)', fontFamily: 'var(--font-mono)',
          textTransform: 'none', letterSpacing: 0,
        }}>p. 1 / 4</span>
      </div>
      <div style={{
        fontSize: 13.5, color: 'var(--fg1)', lineHeight: 1.6,
        textWrap: 'pretty',
      }}>
        {BODY.map((p, i) => (
          <p key={i} style={{ margin: i ? '10px 0 0' : 0 }}>{p}</p>
        ))}
      </div>
      <button style={{
        marginTop: 12, width: '100%',
        background: '#fff',
        border: '1px solid var(--app-border)',
        color: 'var(--fg1)',
        borderRadius: 10,
        padding: '9px 12px',
        fontSize: 12.5, fontWeight: 700,
        cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}>
        <i data-lucide="book-open" style={{ width: 13, height: 13 }}></i>
        Read full document · 4 pages
      </button>
    </RcCard>
  );
}

// ── AI elf ─────────────────────────────────────────────────
function RecordsElf({ data }) {
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

// ── Vault destination ──────────────────────────────────────
function VaultDestination({ filed }) {
  return (
    <RcCard>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
        display: 'flex', alignItems: 'center',
      }}>
        <span>{filed ? 'Filed at' : 'Will be filed at'}</span>
        <span style={{ flex: 1 }}></span>
        <button style={{
          fontSize: 10.5, fontWeight: 700, color: 'var(--color-primary-600)',
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: 0, textTransform: 'none', letterSpacing: 0,
          display: 'inline-flex', alignItems: 'center', gap: 3,
        }}>
          <i data-lucide="folder-edit" style={{ width: 11, height: 11 }}></i>
          Change folder
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
        {VAULT_PATH.map((p, i) => (
          <React.Fragment key={i}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 8px', borderRadius: 7,
              background: p.current ? REC.accentDeep : REC.accentBg,
              color: p.current ? '#fff' : REC.accentDeep,
              border: p.current ? 'none' : `1px solid ${REC.accentSoft}`,
              fontSize: 11, fontWeight: 600,
            }}>
              <i data-lucide={p.icon} style={{ width: 11, height: 11 }}></i>
              {p.label}
            </span>
            {i < VAULT_PATH.length - 1 && (
              <i data-lucide="chevron-right" style={{ width: 11, height: 11, color: 'var(--fg4)' }}></i>
            )}
          </React.Fragment>
        ))}
      </div>
      <div style={{
        marginTop: 10, padding: '8px 10px',
        background: filed ? 'var(--color-success-bg)' : 'var(--app-surface-sunken)',
        border: filed ? '1px solid #bbf7d0' : '1px solid var(--app-border-subtle)',
        borderRadius: 8,
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 11.5, color: filed ? '#047857' : 'var(--fg2)',
      }}>
        <i data-lucide={filed ? 'lock' : 'clock'} style={{ width: 12, height: 12 }}></i>
        <span>
          <strong style={{ fontWeight: 700 }}>{DOC_TYPE.retention}.</strong>
          {filed ? ' Auto-delete prompt April 2033.' : ' Filing will start the retention clock.'}
        </span>
      </div>
    </RcCard>
  );
}

// ── Related records ────────────────────────────────────────
function RelatedRecords() {
  return (
    <RcCard noPad>
      <div style={{
        padding: '10px 14px 8px',
        borderBottom: '1px solid var(--app-border-subtle)',
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>Other statements · this account</div>
        <span style={{ flex: 1 }}></span>
        <span style={{
          fontSize: 11, color: 'var(--color-primary-600)', fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', gap: 3,
        }}>See all 8 <i data-lucide="chevron-right" style={{ width: 12, height: 12 }}></i></span>
      </div>
      {RELATED.map((r, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px',
          borderBottom: i < RELATED.length - 1 ? '1px solid var(--app-border-subtle)' : 'none',
        }}>
          <div style={{
            width: 30, height: 36, borderRadius: 4,
            background: '#fff',
            border: `1px solid ${REC.accentSoft}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <i data-lucide="file-text" style={{ width: 11, height: 11, color: REC.accentDeep }}></i>
            <div style={{ fontSize: 7, fontWeight: 800, color: REC.accentDeep, marginTop: 1, letterSpacing: '0.04em' }}>
              {r.period.split(' ')[0]}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg1)' }}>
              {r.period} Statement
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--fg3)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
              <i data-lucide="lock" style={{ width: 9, height: 9 }}></i>
              {r.when}
            </div>
          </div>
          <div style={{
            fontSize: 12.5, fontWeight: 700, color: REC.accentDeep,
            fontFamily: 'var(--font-mono)',
          }}>
            {r.amount}
          </div>
        </div>
      ))}
    </RcCard>
  );
}

// ── Actions ────────────────────────────────────────────────
function RecordsActions({ filed }) {
  if (filed) {
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
          Open in Vault
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <RcChip icon="download"   label="Download PDF" />
          <RcChip icon="share-2"    label="Share copy" />
          <RcChip icon="folder-input" label="Move folder" />
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button style={{
        width: '100%', padding: '14px 16px',
        background: REC.accentDeep, color: '#fff',
        border: 'none', borderRadius: 14,
        fontSize: 15, fontWeight: 700, letterSpacing: '-0.005em',
        boxShadow: '0 6px 14px rgba(15, 23, 42, 0.22)',
        cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <i data-lucide="archive" style={{ width: 16, height: 16 }}></i>
        File in Vault
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <SecondaryBtn icon="download"   label="Download PDF" />
        <SecondaryBtn icon="folder-input" label="Choose folder" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <RcChip icon="forward"     label="Forward" />
        <RcChip icon="flag"        label="Dispute" warn />
        <RcChip icon="trash-2"     label="Don't keep" warn />
      </div>
    </div>
  );
}

function SecondaryBtn({ icon, label }) {
  return (
    <button style={{
      padding: '11px 12px',
      background: '#fff',
      color: 'var(--fg1)',
      border: '1px solid var(--app-border)',
      borderRadius: 12,
      fontSize: 13, fontWeight: 700,
      cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    }}>
      <i data-lucide={icon} style={{ width: 14, height: 14 }}></i>
      {label}
    </button>
  );
}

function RcChip({ icon, label, warn }) {
  return (
    <button style={{
      background: '#fff',
      border: '1px solid var(--app-border)',
      borderRadius: 12,
      padding: '10px 4px',
      display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      color: warn ? 'var(--color-error)' : 'var(--fg2)',
      cursor: 'pointer',
      fontSize: 10.5, fontWeight: 600,
      textAlign: 'center',
      lineHeight: 1.2,
    }}>
      <i data-lucide={icon} style={{ width: 16, height: 16 }}></i>
      <span style={{ textWrap: 'balance' }}>{label}</span>
    </button>
  );
}

// ── Screen ─────────────────────────────────────────────────
function MailRecordsScreen({ state = 'open', dataLabel }) {
  const filed = state === 'filed';
  return (
    <div data-screen-label={dataLabel} style={{
      width: '100%', height: '100%',
      background: 'var(--app-bg)',
      display: 'flex', flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
      paddingTop: 54,
    }}>
      <RecordsNav />

      <div style={{
        flex: 1,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '12px 16px 96px',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <RecordsHero filed={filed} />
          <RecordsElf data={filed ? ELF_FILED : ELF_OPEN} />
          <IssuerCard />
          <KeyFacts filed={filed} />
          <RecordsBody />
          <VaultDestination filed={filed} />
          {filed && <RelatedRecords />}
          <RecordsActions filed={filed} />
        </div>
      </div>

      <BottomTabBar active="mail" />
    </div>
  );
}

Object.assign(window, { MailRecordsScreen });
