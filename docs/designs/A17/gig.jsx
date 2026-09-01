// MailGigScreen — A17 archetype × Gig variant.
// Slots beyond the archetype:
//   - Bidder profile card (rating + jobs + identity verified)
//   - Gig summary card (the post being bid on — tappable to open thread)
//   - Bid card (amount + ETA + bidder's message)
//   - Three-way action (Accept · Counter · Decline)
//   - Other-bids comparison strip (lightweight)
//   - Secondary state: bid accepted (next-steps timeline + open thread CTA)

// ── Data ───────────────────────────────────────────────────
const GIG = {
  accent: '#f97316',                    // --cat-gigs orange
  trust: 'verified',
  category: 'Gig mail',
  sender: 'Marcus T.',
  time: '12m ago',
  title: 'New bid · $65 to move your sofa Saturday',
  reference: 'Bid GIG-4421 · on "Sofa move — garage → living room"',
};

const BIDDER = {
  initials: 'MT',
  avatarBg: 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)',
  name: 'Marcus T.',
  handle: '@marcus_t',
  blurb: 'Lives on Maple St · 0.8 mi from you',
  rating: 4.9,
  jobs: 47,
  responseTime: '~12 min',
  identityChip: { kind: 'Personal', tone: 'var(--color-identity-personal)', bg: 'var(--color-identity-personal-bg)' },
  badges: ['Moving · 24 jobs', 'Handyman · 15 jobs', 'Has truck'],
};

const BID = {
  amount: 65,
  unit: 'flat',
  eta: 'Saturday · 9–10 AM',
  expires: 'Expires in 22h',
  message: [
    "Hi! I can do this Saturday morning — I'll bring my pickup and two furniture dollies so we shouldn't need extra hands.",
    "Happy to wrap the sofa if you want, just have a sheet ready. $65 covers the whole job including drive time.",
  ],
};

const POST = {
  title: 'Sofa move — garage → living room',
  cat: { label: 'Moving', color: 'var(--cat-moving)', icon: 'truck' },
  posted: '2 days ago · by you',
  expires: 'Bids close in 4 days',
  budget: '$40–80 · flexible',
  schedule: 'This Saturday, May 24 · morning',
  where: '1428 Elm St (your address)',
  details: 'One 3-seater sofa, about 7 ft. Already has the legs unscrewed. Doorway clearance is fine — moved it through there once before.',
  photoBg: 'linear-gradient(135deg, #d4b896 0%, #a1815f 60%, #6b4f33 100%)',
};

const OTHER_BIDS = [
  { who: 'Devon R.',  amount: 55,  rating: 4.7, jobs: 18, when: '40m ago', initials: 'DR', avatarBg: '#0ea5e9', flag: 'cheapest' },
  { who: 'Sasha P.',  amount: 80,  rating: 5.0, jobs: 112, when: '1h ago', initials: 'SP', avatarBg: '#7C3AED', flag: 'top-rated' },
];

const ELF_OPEN = {
  headline: 'Pantopus sized this up',
  summary: 'Marcus is mid-range on price and the closest of three bidders — owns a truck and has 24 moving jobs on file. His Saturday 9 AM slot fits the window you posted.',
  bullets: [
    { icon: 'dollar-sign', label: '$65 is in your range', text: 'midpoint of three bids ($55 · $65 · $80)' },
    { icon: 'shield-check',label: 'Verified neighbor',    text: '0.8 mi · 47 jobs · 4.9★' },
    { icon: 'calendar',    label: 'Sat 9–10 AM works',    text: 'no conflicts on your calendar' },
  ],
};

const ELF_ACCEPTED = {
  headline: 'Bid accepted · here\'s what happens next',
  summary: 'Marcus has been notified and the gig thread is live. Funds for $65 are held by Pantopus and release when you both mark complete on Saturday.',
  bullets: [
    { icon: 'lock',        label: '$65 held in escrow',    text: 'released after both confirm' },
    { icon: 'message-square', label: 'Chat thread opened', text: 'Marcus will introduce himself' },
    { icon: 'calendar-check', label: 'Calendar saved',     text: 'Sat May 24 · 9:00 AM' },
  ],
};

const NEXT_STEPS = [
  { label: 'Bid accepted',                  when: 'Just now',            active: true },
  { label: 'Marcus confirms · expects 12m', when: 'Pending',             pending: true },
  { label: 'Job · Sat May 24, 9 AM',        when: 'Calendar reminder set' },
  { label: 'Both mark complete · funds release', when: 'After the job' },
  { label: 'Review each other',             when: 'Within 7 days' },
];

// ── Card shell ────────────────────────────────────────────
function GgCard({ children, accent, style = {}, noPad = false }) {
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
function GigNav() {
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
      <button style={ggNavBtn}>
        <i data-lucide="chevron-left" style={{ width: 22, height: 22 }}></i>
        <span style={{ fontSize: 15, fontWeight: 500, marginLeft: -2 }}>Mailbox</span>
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: GIG.accent }}></span>
        <span style={{
          fontSize: 12, fontWeight: 700, color: 'var(--fg2)',
          letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>Gig mail</span>
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        <button style={ggNavIco}><i data-lucide="bookmark" style={{ width: 18, height: 18 }}></i></button>
        <button style={ggNavIco}><i data-lucide="more-horizontal" style={{ width: 18, height: 18 }}></i></button>
      </div>
    </div>
  );
}
const ggNavBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 2,
  border: 'none', background: 'transparent',
  color: 'var(--color-primary-600)',
  padding: '6px 6px', cursor: 'pointer',
  borderRadius: 8,
};
const ggNavIco = {
  width: 34, height: 34, borderRadius: 9999,
  border: 'none', background: 'var(--app-surface-sunken)',
  color: 'var(--fg2)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
};

// ── Hero (bid arrival framing) ─────────────────────────────
function GigHero({ accepted }) {
  return (
    <GgCard accent={GIG.accent}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <TrustChip kind={GIG.trust} />
        <CategoryChip label="Bid received" color={GIG.accent} />
        <span style={{ flex: 1 }}></span>
        <span style={{ fontSize: 11, color: 'var(--fg3)', fontWeight: 500 }}>{GIG.time}</span>
      </div>
      <div style={{
        fontSize: 11, fontWeight: 600, color: 'var(--fg3)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
      }}>{GIG.sender}</div>
      <div style={{
        fontSize: 19, fontWeight: 700, color: 'var(--fg1)',
        lineHeight: 1.25, letterSpacing: '-0.015em',
        textWrap: 'pretty',
      }}>{GIG.title}</div>
      <div style={{
        fontSize: 11, color: 'var(--fg3)', marginTop: 6,
        fontFamily: 'var(--font-mono)',
      }}>{GIG.reference}</div>

      {accepted && (
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
          <div>
            <span style={{ fontWeight: 700 }}>Bid accepted</span>
            <span style={{ color: '#047857', opacity: 0.85 }}> · funds held in escrow</span>
          </div>
        </div>
      )}
    </GgCard>
  );
}

// ── Bidder profile card ────────────────────────────────────
function BidderCard() {
  return (
    <GgCard>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
      }}>Bidder</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: BIDDER.avatarBg, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 800, flexShrink: 0,
          letterSpacing: '0.02em', position: 'relative',
        }}>
          {BIDDER.initials}
          <span style={{
            position: 'absolute', right: -3, bottom: -3,
            width: 16, height: 16, borderRadius: '50%',
            background: 'var(--color-success)', color: '#fff',
            border: '2px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i data-lucide="check" style={{ width: 9, height: 9 }}></i>
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg1)', letterSpacing: '-0.01em' }}>
              {BIDDER.name}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700,
              padding: '2px 6px', borderRadius: 9999,
              background: BIDDER.identityChip.bg,
              color: BIDDER.identityChip.tone,
              letterSpacing: '0.02em',
            }}>{BIDDER.identityChip.kind}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 2 }}>{BIDDER.blurb}</div>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        gap: 0,
        marginTop: 12,
        padding: '10px 0',
        background: 'var(--app-surface-sunken)',
        borderRadius: 10,
      }}>
        <StatCell value={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <i data-lucide="star" style={{ width: 13, height: 13, color: '#f59e0b', fill: '#f59e0b' }}></i>
            {BIDDER.rating}
          </span>
        } label="Rating" />
        <StatCell value={BIDDER.jobs} label="Jobs done" divider />
        <StatCell value={BIDDER.responseTime} label="Responds" divider />
      </div>

      {/* Skill badges */}
      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        {BIDDER.badges.map((b, i) => (
          <span key={i} style={{
            fontSize: 10.5, fontWeight: 600,
            padding: '4px 8px', borderRadius: 9999,
            background: '#fff',
            color: 'var(--fg2)',
            border: '1px solid var(--app-border)',
            whiteSpace: 'nowrap',
          }}>{b}</span>
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
        See full profile
        <i data-lucide="arrow-right" style={{ width: 13, height: 13 }}></i>
      </button>
    </GgCard>
  );
}

function StatCell({ value, label, divider }) {
  return (
    <div style={{
      padding: '0 8px',
      borderLeft: divider ? '1px solid var(--app-border)' : 'none',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--fg1)', letterSpacing: '-0.015em' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--fg3)', fontWeight: 600, marginTop: 2, letterSpacing: '0.02em' }}>{label}</div>
    </div>
  );
}

// ── Bid card (amount + ETA + message) ──────────────────────
function BidCard({ accepted }) {
  return (
    <div style={{
      borderRadius: 16,
      overflow: 'hidden',
      border: '1.5px solid #fed7aa',
      background: 'linear-gradient(180deg, #fff7ed 0%, #fffbf5 100%)',
      boxShadow: '0 2px 6px rgba(249,115,22,0.08)',
    }}>
      <div style={{
        padding: '14px 16px 12px',
        display: 'flex', alignItems: 'flex-end', gap: 14,
        borderBottom: '1px dashed #fed7aa',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 10.5, fontWeight: 700, color: '#9a3412',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>Bid amount</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 2 }}>
            <span style={{ fontSize: 34, fontWeight: 800, color: '#7c2d12', letterSpacing: '-0.025em', lineHeight: 1 }}>
              ${BID.amount}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#9a3412' }}>· {BID.unit}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8 }}>
            <i data-lucide="clock" style={{ width: 12, height: 12, color: '#9a3412' }}></i>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#7c2d12' }}>{BID.eta}</span>
          </div>
        </div>
        <div style={{
          padding: '4px 10px', borderRadius: 9999,
          background: accepted ? 'var(--color-success-bg)' : '#fff',
          color: accepted ? '#065f46' : '#9a3412',
          border: accepted ? '1px solid #bbf7d0' : '1px solid #fed7aa',
          fontSize: 10, fontWeight: 800, letterSpacing: '0.04em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}>
          {accepted ? '✓ Locked in' : BID.expires}
        </div>
      </div>

      {/* Message from bidder */}
      <div style={{ padding: '12px 16px 14px' }}>
        <div style={{
          fontSize: 10.5, fontWeight: 700, color: '#9a3412',
          textTransform: 'uppercase', letterSpacing: '0.06em',
          marginBottom: 6,
        }}>Their message</div>
        <div style={{
          fontSize: 13, color: 'var(--fg1)', lineHeight: 1.5,
          textWrap: 'pretty',
        }}>
          {BID.message.map((p, i) => (
            <p key={i} style={{ margin: i ? '6px 0 0' : 0 }}>"{p}"</p>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Original gig summary card ──────────────────────────────
function GigSummary() {
  return (
    <GgCard noPad>
      <div style={{
        padding: '10px 14px 8px',
        borderBottom: '1px solid var(--app-border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>Your gig</div>
        <span style={{
          fontSize: 10.5, color: 'var(--color-primary-600)', fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', gap: 3,
        }}>
          <i data-lucide="external-link" style={{ width: 11, height: 11 }}></i>
          Open gig
        </span>
      </div>

      <div style={{ padding: 14, display: 'flex', gap: 12 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 10,
          flexShrink: 0,
          background: POST.photoBg,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* sofa shape */}
          <svg width="64" height="64" viewBox="0 0 64 64" style={{ position: 'absolute', inset: 0 }}>
            <rect x="10" y="32" width="44" height="18" rx="4" fill="#fff" opacity="0.85" />
            <rect x="8"  y="28" width="10" height="22" rx="3" fill="#fff" opacity="0.85" />
            <rect x="46" y="28" width="10" height="22" rx="3" fill="#fff" opacity="0.85" />
            <rect x="14" y="48" width="3" height="6" fill="#3f2912" />
            <rect x="47" y="48" width="3" height="6" fill="#3f2912" />
          </svg>
          <span style={{
            position: 'absolute', top: 4, left: 4,
            padding: '2px 5px', borderRadius: 6,
            background: 'rgba(255,255,255,0.92)',
            color: POST.cat.color,
            fontSize: 8.5, fontWeight: 800, letterSpacing: '0.04em',
            textTransform: 'uppercase',
            display: 'inline-flex', alignItems: 'center', gap: 3,
          }}>
            <i data-lucide={POST.cat.icon} style={{ width: 9, height: 9 }}></i>
            {POST.cat.label}
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg1)', letterSpacing: '-0.005em', lineHeight: 1.3 }}>
            {POST.title}
          </div>
          <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 3 }}>
            {POST.posted} · {POST.expires}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 7, flexWrap: 'wrap' }}>
            <SummaryChip icon="dollar-sign" text={POST.budget} />
            <SummaryChip icon="calendar"    text={POST.schedule} />
          </div>
        </div>
      </div>

      <div style={{
        padding: '0 14px 12px',
        fontSize: 12, color: 'var(--fg2)', lineHeight: 1.5,
        textWrap: 'pretty',
      }}>
        {POST.details}
      </div>

      <div style={{
        padding: '10px 14px',
        background: 'var(--app-surface-sunken)',
        borderTop: '1px solid var(--app-border-subtle)',
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 11, color: 'var(--fg2)',
      }}>
        <i data-lucide="users" style={{ width: 13, height: 13, color: 'var(--fg3)' }}></i>
        <span><strong style={{ color: 'var(--fg1)' }}>3 bids</strong> received · Marcus is the newest</span>
      </div>
    </GgCard>
  );
}

function SummaryChip({ icon, text }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px', borderRadius: 9999,
      background: 'var(--app-surface-sunken)',
      color: 'var(--fg2)',
      fontSize: 10.5, fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      <i data-lucide={icon} style={{ width: 11, height: 11 }}></i>
      {text}
    </span>
  );
}

// ── Other bids comparison ──────────────────────────────────
function OtherBids() {
  return (
    <GgCard noPad>
      <div style={{
        padding: '10px 14px 8px',
        borderBottom: '1px solid var(--app-border-subtle)',
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>The other 2 bids</div>
        <span style={{ flex: 1 }}></span>
        <span style={{
          fontSize: 11, color: 'var(--color-primary-600)', fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', gap: 3,
        }}>Compare all <i data-lucide="chevron-right" style={{ width: 12, height: 12 }}></i></span>
      </div>
      {OTHER_BIDS.map((b, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center',
          padding: '10px 14px',
          borderBottom: i < OTHER_BIDS.length - 1 ? '1px solid var(--app-border-subtle)' : 'none',
          gap: 10,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: b.avatarBg, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10.5, fontWeight: 700, flexShrink: 0,
          }}>{b.initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg1)' }}>{b.who}</span>
              {b.flag && (
                <span style={{
                  fontSize: 9, fontWeight: 700,
                  padding: '1.5px 5px', borderRadius: 9999,
                  background: b.flag === 'cheapest' ? '#dcfce7' : '#ede9fe',
                  color: b.flag === 'cheapest' ? '#166534' : '#5b21b6',
                  letterSpacing: '0.02em', textTransform: 'uppercase',
                }}>{b.flag}</span>
              )}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--fg3)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
              <i data-lucide="star" style={{ width: 9, height: 9, color: '#f59e0b', fill: '#f59e0b' }}></i>
              {b.rating} · {b.jobs} jobs · {b.when}
            </div>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--fg1)', letterSpacing: '-0.015em' }}>
            ${b.amount}
          </div>
        </div>
      ))}
    </GgCard>
  );
}

// ── AI elf ─────────────────────────────────────────────────
function GigElf({ data }) {
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

// ── Next steps timeline (accepted state) ───────────────────
function NextSteps() {
  return (
    <GgCard>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12,
      }}>What happens next</div>
      <div style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute', left: 7, top: 6, bottom: 6,
          width: 2, background: 'var(--app-border)',
        }}></div>
        {NEXT_STEPS.map((e, i) => (
          <div key={i} style={{
            position: 'relative',
            display: 'flex', alignItems: 'flex-start', gap: 12,
            paddingBottom: i < NEXT_STEPS.length - 1 ? 14 : 0,
          }}>
            <div style={{
              width: 16, height: 16, borderRadius: '50%',
              background: e.active ? 'var(--color-success)' : '#fff',
              border: e.active
                ? '2px solid var(--color-success)'
                : e.pending
                  ? '2px dashed var(--color-primary-400)'
                  : '2px solid var(--app-border-strong)',
              flexShrink: 0,
              zIndex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {e.active && <i data-lucide="check" style={{ width: 9, height: 9, color: '#fff' }}></i>}
            </div>
            <div style={{ flex: 1, minWidth: 0, marginTop: -1 }}>
              <div style={{
                fontSize: 12.5, fontWeight: e.active ? 700 : 600,
                color: e.active ? 'var(--fg1)' : e.pending ? 'var(--color-primary-700)' : 'var(--fg2)',
              }}>{e.label}</div>
              <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 1 }}>{e.when}</div>
            </div>
          </div>
        ))}
      </div>
    </GgCard>
  );
}

// ── Actions ────────────────────────────────────────────────
function GigActions({ accepted }) {
  if (accepted) {
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
          <i data-lucide="arrow-up-right" style={{ width: 16, height: 16 }}></i>
          Open gig · chat with Marcus
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <GgChip icon="message-square" label="Send a note" />
          <GgChip icon="calendar-plus"  label="Add to calendar" />
          <GgChip icon="user-x"         label="Cancel" warn />
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Three-way action — Accept is primary, Counter/Decline secondary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 8 }}>
        <BidBtn icon="check"        label="Accept · $65" primary />
        <BidBtn icon="git-pull-request-arrow" label="Counter" />
        <BidBtn icon="x"            label="Decline" />
      </div>
      {/* Open gig — the spec's named primary, here as a less-stressed link to the thread */}
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
        <i data-lucide="arrow-up-right" style={{ width: 14, height: 14 }}></i>
        Open gig to compare all bids
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <GgChip icon="message-square" label="Ask question" />
        <GgChip icon="bookmark"       label="Save bid" />
        <GgChip icon="flag"           label="Report" warn />
      </div>
    </div>
  );
}

function BidBtn({ icon, label, primary }) {
  return (
    <button style={{
      padding: '13px 8px',
      background: primary ? 'var(--color-primary-600)' : '#fff',
      color: primary ? '#fff' : 'var(--fg1)',
      border: primary ? 'none' : '1px solid var(--app-border)',
      borderRadius: 12,
      fontSize: 13, fontWeight: 700,
      boxShadow: primary ? 'var(--shadow-primary)' : 'none',
      cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
      letterSpacing: '-0.005em',
      whiteSpace: 'nowrap',
    }}>
      <i data-lucide={icon} style={{ width: 14, height: 14 }}></i>
      {label}
    </button>
  );
}
function GgChip({ icon, label, warn }) {
  return (
    <button style={{
      background: '#fff',
      border: '1px solid var(--app-border)',
      borderRadius: 12,
      padding: '10px 4px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      color: warn ? 'var(--color-error)' : 'var(--fg2)',
      cursor: 'pointer',
      fontSize: 10.5, fontWeight: 600,
    }}>
      <i data-lucide={icon} style={{ width: 16, height: 16 }}></i>
      {label}
    </button>
  );
}

// ── Screen ─────────────────────────────────────────────────
function MailGigScreen({ state = 'received', dataLabel }) {
  const accepted = state === 'accepted';
  return (
    <div data-screen-label={dataLabel} style={{
      width: '100%', height: '100%',
      background: 'var(--app-bg)',
      display: 'flex', flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
      paddingTop: 54,
    }}>
      <GigNav />

      <div style={{
        flex: 1,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '12px 16px 96px',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <GigHero accepted={accepted} />
          <GigElf data={accepted ? ELF_ACCEPTED : ELF_OPEN} />
          {accepted && <NextSteps />}
          <BidCard accepted={accepted} />
          <BidderCard />
          <GigSummary />
          {!accepted && <OtherBids />}
          <GigActions accepted={accepted} />
        </div>
      </div>

      <BottomTabBar active="mail" />
    </div>
  );
}

Object.assign(window, { MailGigScreen });
