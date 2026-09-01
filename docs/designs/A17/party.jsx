// MailPartyScreen — A17 archetype × Party / event invite variant.
// A neighbor or friend sends you an invite to a personal celebration
// (housewarming, birthday, dinner, etc.) — warmer + more festive than
// the Community HOA mail. Slots beyond the archetype:
//   - Festive event hero (title + date pill + location pill + confetti)
//   - Host card (the friend who sent it · personal, not institutional)
//   - RSVP chips (Going / Maybe / Can't make it) — three-way
//   - Plus-one stepper (Going state: bring a +1)
//   - +N going avatars (friends + their +1 counts)
//   - Add-to-calendar CTA (always present, prominent)
//   - Potluck "bring" list (claimable items, social proof)
//   - Personal handwritten note from the host
//   - Secondary state: "You're going" → calendar saved + item claimed +
//     plus-one count locked in, deck shifts to logistics
//
// Tone: friend-to-friend, lower-stakes than certified/gig, warmer than
// community. Visual signature: rose accent #db2777, confetti dot pattern
// on the hero, calendar-page tile with day-of-week, polaroid-ish host avatar.

// ── Data ───────────────────────────────────────────────────
const PARTY = {
  accent: '#db2777',                  // rose-600 (party magenta — distinct from gig orange / community green)
  accentBg: '#fdf2f8',
  accentSoft: '#fbcfe8',
  accentDeep: '#9d174d',
  trust: 'verified',
  category: 'Party',
  sender: 'Priya R.',
  time: '3h ago',
  title: 'Backyard housewarming · Sat May 24, 6 PM',
  reference: 'Invite EVT-0517 · 12 invited · personal',
};

const HOST = {
  initials: 'PR',
  avatarBg: 'linear-gradient(135deg, #db2777 0%, #9d174d 100%)',
  name: 'Priya Ramanathan',
  blurb: 'Maple St · moved in last month',
  relation: 'Friend · neighbor',
};

const EVENT = {
  what: 'Backyard housewarming',
  when: { weekday: 'Saturday', dayLabel: 'SAT', mon: 'MAY', day: '24', timeRange: '6:00 PM – late' },
  where: '1631 Maple St',
  whereNote: 'Side gate is open · look for the string lights',
  dress: 'Casual · bring a layer (it gets cool)',
  kids: 'Kids welcome until 9',
  weather: { temp: 71, summary: 'Clear · light breeze' },
};

const BRING = [
  { item: 'A bottle of something',  claimedBy: null,        emoji: '🍷' },
  { item: 'Side or salad',          claimedBy: 'Jamal',     emoji: '🥗' },
  { item: 'Dessert',                claimedBy: 'Maria + Lin', emoji: '🍰' },
  { item: 'Outdoor speaker',        claimedBy: 'Derek',     emoji: '🔊' },
];

const ATTENDEES = [
  { initials: 'JT', name: 'Jamal',   bg: 'linear-gradient(135deg,#16A34A,#15803d)', plus: 1, status: 'going' },
  { initials: 'MK', name: 'Maria',   bg: 'linear-gradient(135deg,#0ea5e9,#0369a1)', plus: 1, status: 'going' },
  { initials: 'LS', name: 'Lin',     bg: 'linear-gradient(135deg,#7C3AED,#5b21b6)', plus: 0, status: 'going' },
  { initials: 'DR', name: 'Derek',   bg: 'linear-gradient(135deg,#f97316,#c2410c)', plus: 1, status: 'going' },
  { initials: 'SN', name: 'Sara',    bg: 'linear-gradient(135deg,#dc2626,#991b1b)', plus: 0, status: 'going' },
  { initials: 'PC', name: 'Paul',    bg: 'linear-gradient(135deg,#0284c7,#075985)', plus: 0, status: 'maybe' },
  { initials: 'AW', name: 'Aliyah',  bg: 'linear-gradient(135deg,#16A34A,#166534)', plus: 0, status: 'going' },
];

const NOTE = [
  "Finally unpacked enough to have people over! It'd mean a lot if you came.",
  "Backyard, string lights, my brother is bringing his pizza oven. No need to bring anything but yourself — but if you want to claim a dish below, even better.",
];
const NOTE_SIGN = 'Priya x';

const ELF_OPEN = {
  headline: 'Pantopus mapped this out',
  summary: '5 of your friends are going already, Priya lives 3 doors down, and your Saturday evening is clear. Weather looks great.',
  bullets: [
    { icon: 'users',     label: '5 friends going',     text: 'including Jamal, Maria, Lin' },
    { icon: 'cloud-sun', label: '71° clear evening',   text: 'no rain · sunset 8:14 PM' },
    { icon: 'calendar',  label: 'Saturday is clear',   text: 'no conflicts after 4 PM' },
  ],
};

const ELF_GOING = {
  headline: 'You\'re in · here\'s what\'s set',
  summary: 'Priya was notified you\'re coming with a +1. Saturday 6 PM is on your calendar and you\'re bringing a bottle. We\'ll remind you Saturday at 4.',
  bullets: [
    { icon: 'calendar-check', label: 'Calendar saved',       text: 'Sat May 24 · 6:00 PM · reminder Sat 4 PM' },
    { icon: 'user-plus',      label: 'Bringing a +1',        text: 'Priya can see your headcount' },
    { icon: 'gift',           label: 'You claimed: bottle',  text: 'Priya marked off the dish list' },
  ],
};

// ── Card shell ────────────────────────────────────────────
function PtCard({ children, accent, style = {}, noPad = false }) {
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
function PartyNav() {
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
      <button style={ptNavBtn}>
        <i data-lucide="chevron-left" style={{ width: 22, height: 22 }}></i>
        <span style={{ fontSize: 15, fontWeight: 500, marginLeft: -2 }}>Mailbox</span>
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: PARTY.accent }}></span>
        <span style={{
          fontSize: 12, fontWeight: 700, color: 'var(--fg2)',
          letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>Party invite</span>
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        <button style={ptNavIco}><i data-lucide="bookmark" style={{ width: 18, height: 18 }}></i></button>
        <button style={ptNavIco}><i data-lucide="more-horizontal" style={{ width: 18, height: 18 }}></i></button>
      </div>
    </div>
  );
}
const ptNavBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 2,
  border: 'none', background: 'transparent',
  color: 'var(--color-primary-600)',
  padding: '6px 6px', cursor: 'pointer',
  borderRadius: 8,
};
const ptNavIco = {
  width: 34, height: 34, borderRadius: 9999,
  border: 'none', background: 'var(--app-surface-sunken)',
  color: 'var(--fg2)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
};

// ── Festive event hero ─────────────────────────────────────
// Confetti dots over a warm rose gradient. Date tile + location pill.
function PartyHero({ going }) {
  return (
    <div style={{
      position: 'relative',
      borderRadius: 16,
      overflow: 'hidden',
      border: '1px solid #fbcfe8',
      boxShadow: '0 4px 14px rgba(219, 39, 119, 0.10)',
      background: '#fff',
    }}>
      {/* Festive header band */}
      <div style={{
        position: 'relative',
        padding: '14px 16px 64px',
        background: 'linear-gradient(155deg, #fdf2f8 0%, #fce7f3 55%, #fbcfe8 100%)',
        overflow: 'hidden',
      }}>
        {/* Confetti */}
        <Confetti />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <TrustChip kind={PARTY.trust} />
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', borderRadius: 9999,
            background: '#fff',
            border: '1px solid #fbcfe8',
            color: PARTY.accentDeep,
            fontSize: 10, fontWeight: 700, letterSpacing: '0.02em',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: PARTY.accent }}></span>
            Party invite
          </span>
          <span style={{ flex: 1 }}></span>
          <span style={{ fontSize: 11, color: PARTY.accentDeep, fontWeight: 600, opacity: 0.7 }}>{PARTY.time}</span>
        </div>

        <div style={{
          position: 'relative',
          fontSize: 11, fontWeight: 700, color: PARTY.accentDeep,
          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
          opacity: 0.75,
        }}>You're invited by {PARTY.sender}</div>

        <div style={{
          position: 'relative',
          fontSize: 22, fontWeight: 800, color: '#3f0a23',
          lineHeight: 1.15, letterSpacing: '-0.02em',
          textWrap: 'pretty',
          fontFamily: 'var(--font-serif)',
        }}>{EVENT.what}</div>
      </div>

      {/* Date + location panel — overlaps the band */}
      <div style={{
        position: 'relative',
        margin: '-46px 14px 14px',
        padding: '12px 12px',
        background: '#fff',
        border: '1px solid var(--app-border)',
        borderRadius: 14,
        boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <PartyDateTile />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--fg1)', letterSpacing: '-0.01em', lineHeight: 1.25 }}>
            {EVENT.when.weekday} · {EVENT.when.timeRange}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5, color: 'var(--fg2)' }}>
            <i data-lucide="map-pin" style={{ width: 12, height: 12, color: PARTY.accent }}></i>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{EVENT.where}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 2, marginLeft: 17 }}>
            {EVENT.whereNote}
          </div>
        </div>
      </div>

      {going && (
        <div style={{
          margin: '0 14px 14px',
          padding: '9px 11px',
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
            <span style={{ fontWeight: 700 }}>You're going · +1</span>
            <span style={{ color: '#047857', opacity: 0.85 }}> · RSVP'd Today 2:14 PM</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Confetti() {
  // Deterministic confetti dots for a festive feel — purely decorative.
  const dots = [
    { x: '8%',  y: '20%', s: 4,  c: '#db2777', r: -15 },
    { x: '16%', y: '60%', s: 3,  c: '#fb923c', r: 30 },
    { x: '24%', y: '14%', s: 5,  c: '#f59e0b', r: 0 },
    { x: '34%', y: '70%', s: 3,  c: '#ec4899', r: 20 },
    { x: '46%', y: '12%', s: 4,  c: '#a855f7', r: -10 },
    { x: '58%', y: '64%', s: 3,  c: '#db2777', r: 25 },
    { x: '68%', y: '18%', s: 5,  c: '#0ea5e9', r: -8 },
    { x: '78%', y: '50%', s: 3,  c: '#f59e0b', r: 40 },
    { x: '88%', y: '24%', s: 4,  c: '#ec4899', r: 12 },
    { x: '92%', y: '68%', s: 3,  c: '#a855f7', r: -25 },
    { x: '12%', y: '38%', s: 2.5,c: '#fb923c', r: 0 },
    { x: '50%', y: '38%', s: 2.5,c: '#fff',    r: 0 },
    { x: '72%', y: '38%', s: 2.5,c: '#fff',    r: 0 },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {dots.map((d, i) => (
        <span key={i} style={{
          position: 'absolute',
          left: d.x, top: d.y,
          width: d.s * 2.4, height: d.s,
          background: d.c,
          borderRadius: 2,
          transform: `rotate(${d.r}deg)`,
          opacity: 0.8,
        }}></span>
      ))}
      {/* Streamers */}
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.35 }}>
        <path d="M -10 8 Q 30 24 70 12 T 150 18" stroke="#db2777" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M 240 6 Q 270 26 300 14 T 380 22" stroke="#a855f7" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function PartyDateTile() {
  return (
    <div style={{
      width: 56, height: 60, borderRadius: 12,
      overflow: 'hidden', flexShrink: 0,
      border: '1px solid var(--app-border)',
      background: '#fff',
      boxShadow: '0 2px 6px rgba(219, 39, 119, 0.15)',
    }}>
      <div style={{
        height: 18,
        background: PARTY.accent, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9.5, fontWeight: 800, letterSpacing: '0.12em',
      }}>{EVENT.when.mon}</div>
      <div style={{
        height: 42,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em',
          lineHeight: 1, color: 'var(--fg1)',
          fontFamily: 'var(--font-serif)',
        }}>{EVENT.when.day}</div>
        <div style={{
          fontSize: 9, color: 'var(--fg3)', fontWeight: 700,
          letterSpacing: '0.08em', marginTop: 2,
        }}>{EVENT.when.dayLabel}</div>
      </div>
    </div>
  );
}

// ── Host card ──────────────────────────────────────────────
function HostCard() {
  return (
    <PtCard>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
      }}>Host</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          background: HOST.avatarBg, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 800, flexShrink: 0,
          letterSpacing: '0.02em', position: 'relative',
          boxShadow: '0 2px 6px rgba(219, 39, 119, 0.25)',
        }}>
          {HOST.initials}
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
            <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--fg1)', letterSpacing: '-0.01em' }}>
              {HOST.name}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 9999,
              background: 'var(--color-identity-personal-bg)',
              color: 'var(--color-identity-personal)',
              letterSpacing: '0.02em',
            }}>{HOST.relation}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 2 }}>{HOST.blurb}</div>
        </div>
        <button style={{
          width: 32, height: 32, borderRadius: 9999,
          background: 'var(--app-surface-sunken)',
          color: 'var(--fg2)', border: 'none', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}>
          <i data-lucide="message-square" style={{ width: 14, height: 14 }}></i>
        </button>
      </div>
    </PtCard>
  );
}

// ── Event details (where + vibe + weather) ─────────────────
function EventDetails() {
  return (
    <PtCard noPad>
      <div style={{
        padding: '10px 14px 8px',
        fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        borderBottom: '1px solid var(--app-border-subtle)',
        display: 'flex', alignItems: 'center',
      }}>
        <span>The details</span>
        <span style={{ flex: 1 }}></span>
        <span style={{
          fontSize: 10.5, color: 'var(--color-primary-600)', fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', gap: 3,
          textTransform: 'none', letterSpacing: '0',
        }}>
          <i data-lucide="navigation" style={{ width: 11, height: 11 }}></i>
          0.2 mi · 4 min walk
        </span>
      </div>

      <div style={{ padding: 14 }}>
        {/* Map + address */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <PartyMap />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--fg1)' }}>{EVENT.where}</div>
            <div style={{ fontSize: 11.5, color: 'var(--fg3)', marginTop: 2, lineHeight: 1.4 }}>
              {EVENT.whereNote}
            </div>
          </div>
        </div>

        {/* Vibe rows */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr',
          background: 'var(--app-surface-sunken)',
          border: '1px solid var(--app-border-subtle)',
          borderRadius: 10,
          overflow: 'hidden',
        }}>
          <VibeRow icon="shirt"     label="Dress code"  value={EVENT.dress} />
          <VibeRow icon="baby"      label="Kids"        value={EVENT.kids} divider />
          <VibeRow icon="cloud-sun" label="Forecast"    value={`${EVENT.weather.temp}° · ${EVENT.weather.summary}`} divider />
        </div>
      </div>
    </PtCard>
  );
}

function VibeRow({ icon, label, value, divider }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 12px',
      borderTop: divider ? '1px solid var(--app-border-subtle)' : 'none',
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: 7,
        background: '#fff', color: PARTY.accent,
        border: '1px solid var(--app-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <i data-lucide={icon} style={{ width: 12, height: 12 }}></i>
      </div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--fg3)', letterSpacing: '0.04em', textTransform: 'uppercase', minWidth: 70 }}>
        {label}
      </div>
      <div style={{ flex: 1, fontSize: 12.5, color: 'var(--fg2)', textAlign: 'right' }}>
        {value}
      </div>
    </div>
  );
}

// Mini map — abstract street + pin
function PartyMap() {
  return (
    <div style={{
      width: 64, height: 64, borderRadius: 10,
      overflow: 'hidden', flexShrink: 0,
      border: '1px solid var(--app-border)',
      position: 'relative',
      background: '#f3f4f6',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      <svg width="64" height="64" viewBox="0 0 64 64" style={{ position: 'absolute', inset: 0 }}>
        {/* blocks */}
        <rect x="0" y="0" width="28" height="28" fill="#e7eaee" />
        <rect x="34" y="0" width="30" height="28" fill="#e7eaee" />
        <rect x="0" y="36" width="28" height="28" fill="#e7eaee" />
        <rect x="34" y="36" width="30" height="28" fill="#dde4d3" />
        {/* roads */}
        <rect x="28" y="0" width="6" height="64" fill="#fff" />
        <rect x="0" y="28" width="64" height="8" fill="#fff" />
        {/* center line */}
        <line x1="31" y1="0" x2="31" y2="64" stroke="#d1d5db" strokeDasharray="2 2" />
        <line x1="0" y1="32" x2="64" y2="32" stroke="#d1d5db" strokeDasharray="2 2" />
        {/* tiny house dots */}
        <rect x="6" y="6" width="6" height="6" fill="#cbd0d5" />
        <rect x="18" y="14" width="6" height="6" fill="#cbd0d5" />
        <rect x="44" y="6" width="6" height="6" fill="#cbd0d5" />
        <rect x="6" y="44" width="6" height="6" fill="#cbd0d5" />
      </svg>
      {/* pin */}
      <div style={{
        position: 'absolute',
        left: '74%', top: '78%',
        transform: 'translate(-50%, -100%)',
      }}>
        <div style={{
          width: 20, height: 20, borderRadius: '50% 50% 50% 0',
          background: PARTY.accent,
          transform: 'rotate(-45deg)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
          border: '2px solid #fff',
        }}></div>
      </div>
    </div>
  );
}

// ── +N going avatars ───────────────────────────────────────
function GoingStrip({ going }) {
  const list = ATTENDEES.filter(a => a.status === 'going');
  const totalHeads = list.reduce((n, a) => n + 1 + a.plus, 0);
  const maybe = ATTENDEES.filter(a => a.status === 'maybe').length;
  const youCount = going ? 2 : 0; // you + plus one
  const headcount = totalHeads + youCount;

  return (
    <PtCard noPad>
      <div style={{
        padding: '10px 14px 8px',
        borderBottom: '1px solid var(--app-border-subtle)',
        display: 'flex', alignItems: 'center',
      }}>
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            {headcount} going · {maybe} maybe
          </div>
          <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 1 }}>
            {going ? 'Including you + 1' : '5 friends · 2 plus-ones'}
          </div>
        </div>
        <span style={{ flex: 1 }}></span>
        <span style={{
          fontSize: 11, fontWeight: 700, color: 'var(--color-primary-600)',
          display: 'inline-flex', alignItems: 'center', gap: 3,
        }}>See all <i data-lucide="chevron-right" style={{ width: 12, height: 12 }}></i></span>
      </div>
      <div style={{ padding: '12px 14px', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {going && <PtYouAvatar />}
        {list.map((a, i) => <PtAvatar key={i} a={a} />)}
      </div>
    </PtCard>
  );
}

function PtAvatar({ a }) {
  return (
    <div style={{
      width: 44,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        background: a.bg, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700,
        position: 'relative',
        flexShrink: 0,
      }}>
        {a.initials}
        {a.plus > 0 && (
          <span style={{
            position: 'absolute', right: -4, bottom: -4,
            minWidth: 16, height: 16, borderRadius: 9999,
            padding: '0 4px',
            background: PARTY.accent, color: '#fff',
            border: '2px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 800,
          }}>+{a.plus}</span>
        )}
      </div>
      <div style={{
        fontSize: 9.5, color: 'var(--fg3)', fontWeight: 600,
        textAlign: 'center', lineHeight: 1.1, whiteSpace: 'nowrap',
      }}>{a.name}</div>
    </div>
  );
}

function PtYouAvatar() {
  return (
    <div style={{
      width: 44,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--color-primary-500), var(--color-primary-700))',
        color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700,
        position: 'relative',
        flexShrink: 0,
        boxShadow: '0 0 0 2.5px var(--color-primary-300)',
      }}>
        You
        <span style={{
          position: 'absolute', right: -4, bottom: -4,
          minWidth: 16, height: 16, borderRadius: 9999,
          padding: '0 4px',
          background: PARTY.accent, color: '#fff',
          border: '2px solid #fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 800,
        }}>+1</span>
      </div>
      <div style={{
        fontSize: 9.5, color: 'var(--color-primary-700)', fontWeight: 700,
        textAlign: 'center', lineHeight: 1.1, whiteSpace: 'nowrap',
      }}>You</div>
    </div>
  );
}

// ── Potluck "bring" list ───────────────────────────────────
function PotluckList({ going }) {
  return (
    <PtCard noPad>
      <div style={{
        padding: '10px 14px 8px',
        borderBottom: '1px solid var(--app-border-subtle)',
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>If you'd like to bring something</div>
        <span style={{ flex: 1 }}></span>
        <span style={{ fontSize: 11, color: 'var(--fg3)' }}>
          {BRING.filter(b => b.claimedBy).length} of {BRING.length} claimed
        </span>
      </div>
      <div>
        {BRING.map((b, i) => {
          const youClaimed = going && i === 0;
          const claimed = !!b.claimedBy || youClaimed;
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px',
              borderBottom: i < BRING.length - 1 ? '1px solid var(--app-border-subtle)' : 'none',
              background: youClaimed ? PARTY.accentBg : '#fff',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: claimed ? '#fff' : 'var(--app-surface-sunken)',
                border: youClaimed ? `1.5px solid ${PARTY.accent}` : '1px solid var(--app-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, flexShrink: 0,
              }}>{b.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600,
                  color: claimed && !youClaimed ? 'var(--fg3)' : 'var(--fg1)',
                  textDecoration: claimed && !youClaimed ? 'line-through' : 'none',
                }}>{b.item}</div>
                {(claimed || youClaimed) && (
                  <div style={{
                    fontSize: 10.5, color: youClaimed ? PARTY.accentDeep : 'var(--fg3)',
                    marginTop: 1, fontWeight: youClaimed ? 700 : 500,
                  }}>
                    {youClaimed ? 'You\'re bringing this' : `${b.claimedBy} has it`}
                  </div>
                )}
              </div>
              {!claimed ? (
                <button style={{
                  padding: '6px 12px', borderRadius: 9999,
                  background: '#fff', color: PARTY.accentDeep,
                  border: `1px solid ${PARTY.accentSoft}`,
                  fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}>I'll bring it</button>
              ) : youClaimed ? (
                <i data-lucide="check-circle-2" style={{ width: 18, height: 18, color: PARTY.accent }}></i>
              ) : (
                <i data-lucide="check" style={{ width: 16, height: 16, color: 'var(--fg4)' }}></i>
              )}
            </div>
          );
        })}
      </div>
    </PtCard>
  );
}

// ── Personal note ──────────────────────────────────────────
function PartyNote() {
  return (
    <div style={{
      borderRadius: 16,
      overflow: 'hidden',
      border: '1px solid #fbcfe8',
      background: 'linear-gradient(180deg, #fff7fa 0%, #fdf2f8 100%)',
      padding: '14px 16px 16px',
      position: 'relative',
    }}>
      <i data-lucide="quote" style={{
        position: 'absolute', top: 10, right: 12,
        width: 22, height: 22, color: PARTY.accentSoft,
      }}></i>
      <div style={{
        fontSize: 10.5, fontWeight: 700, color: PARTY.accentDeep,
        textTransform: 'uppercase', letterSpacing: '0.06em',
        marginBottom: 6, opacity: 0.75,
      }}>A note from Priya</div>
      <div style={{
        fontFamily: 'var(--font-serif)',
        fontSize: 14.5, color: '#3f0a23', lineHeight: 1.55,
        textWrap: 'pretty',
      }}>
        {NOTE.map((p, i) => (
          <p key={i} style={{ margin: i ? '8px 0 0' : 0 }}>{p}</p>
        ))}
        <p style={{
          marginTop: 12, fontStyle: 'italic', color: PARTY.accentDeep,
        }}>— {NOTE_SIGN}</p>
      </div>
    </div>
  );
}

// ── AI elf ─────────────────────────────────────────────────
function PartyElf({ data }) {
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

// ── RSVP cluster (chips + plus-one + add-to-calendar) ──────
function RsvpCluster({ going }) {
  if (going) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Locked-in confirmation, swap to logistics */}
        <button style={{
          width: '100%', padding: '14px 16px',
          background: PARTY.accent, color: '#fff',
          border: 'none', borderRadius: 14,
          fontSize: 15, fontWeight: 700, letterSpacing: '-0.005em',
          boxShadow: '0 6px 16px rgba(219, 39, 119, 0.28)',
          cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <i data-lucide="navigation" style={{ width: 16, height: 16 }}></i>
          Get directions · party in 2 days
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <PtChip icon="user-minus" label="Drop +1" />
          <PtChip icon="x-circle"   label="Can't make it" warn />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <PtChip icon="message-square" label="Message Priya" />
          <PtChip icon="share-2"        label="Share invite" />
          <PtChip icon="calendar-check" label="In calendar" muted />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Primary RSVP — three-way */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 8 }}>
        <RsvpBtn icon="party-popper" label="Going" primary />
        <RsvpBtn icon="help-circle"  label="Maybe" />
        <RsvpBtn icon="x"            label="Can't" />
      </div>

      {/* Plus-one stepper */}
      <PlusOneStepper />

      {/* Add to calendar (always present) */}
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
        <i data-lucide="calendar-plus" style={{ width: 15, height: 15 }}></i>
        Add to calendar (hold the date)
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <PtChip icon="message-square" label="Ask Priya" />
        <PtChip icon="user-plus"      label="Forward" />
        <PtChip icon="bell-off"       label="Mute" />
      </div>
    </div>
  );
}

function RsvpBtn({ icon, label, primary }) {
  return (
    <button style={{
      padding: '13px 8px',
      background: primary ? PARTY.accent : '#fff',
      color: primary ? '#fff' : 'var(--fg1)',
      border: primary ? 'none' : '1px solid var(--app-border)',
      borderRadius: 12,
      fontSize: 13.5, fontWeight: 700,
      boxShadow: primary ? '0 6px 16px rgba(219, 39, 119, 0.28)' : 'none',
      cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      letterSpacing: '-0.005em',
      whiteSpace: 'nowrap',
    }}>
      <i data-lucide={icon} style={{ width: 15, height: 15 }}></i>
      {label}
    </button>
  );
}

function PlusOneStepper() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px',
      background: '#fff',
      border: '1px solid var(--app-border)',
      borderRadius: 12,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8,
        background: PARTY.accentBg, color: PARTY.accentDeep,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <i data-lucide="user-plus" style={{ width: 14, height: 14 }}></i>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg1)' }}>Bring a +1?</div>
        <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 1 }}>Priya said plus-ones are welcome</div>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center',
        background: 'var(--app-surface-sunken)',
        borderRadius: 9999,
        padding: 3,
        gap: 4,
      }}>
        <button style={stepBtn}><i data-lucide="minus" style={{ width: 12, height: 12 }}></i></button>
        <span style={{
          minWidth: 18, textAlign: 'center',
          fontSize: 13, fontWeight: 800, color: 'var(--fg1)',
        }}>0</span>
        <button style={stepBtnPrimary}><i data-lucide="plus" style={{ width: 12, height: 12 }}></i></button>
      </div>
    </div>
  );
}
const stepBtn = {
  width: 24, height: 24, borderRadius: 9999,
  background: '#fff', color: 'var(--fg3)',
  border: '1px solid var(--app-border)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
};
const stepBtnPrimary = {
  width: 24, height: 24, borderRadius: 9999,
  background: '#db2777', color: '#fff',
  border: 'none',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
};

function PtChip({ icon, label, warn, muted }) {
  return (
    <button style={{
      background: muted ? 'var(--color-success-bg)' : '#fff',
      border: muted ? '1px solid #bbf7d0' : '1px solid var(--app-border)',
      borderRadius: 12,
      padding: '10px 4px',
      display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      color: warn ? 'var(--color-error)' : muted ? '#047857' : 'var(--fg2)',
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
function MailPartyScreen({ state = 'open', dataLabel }) {
  const going = state === 'going';
  return (
    <div data-screen-label={dataLabel} style={{
      width: '100%', height: '100%',
      background: 'var(--app-bg)',
      display: 'flex', flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
      paddingTop: 54,
    }}>
      <PartyNav />

      <div style={{
        flex: 1,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '12px 16px 96px',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <PartyHero going={going} />
          <PartyElf data={going ? ELF_GOING : ELF_OPEN} />
          <HostCard />
          <EventDetails />
          <GoingStrip going={going} />
          <PartyNote />
          <PotluckList going={going} />
          <RsvpCluster going={going} />
        </div>
      </div>

      <BottomTabBar active="mail" />
    </div>
  );
}

Object.assign(window, { MailPartyScreen });
