// MailCommunityScreen — A17 archetype × Community mail variant.
// Slots beyond the archetype:
//   - Community badge (the sender's neighborhood-group seal)
//   - Event/details card (visual: when/where/what to bring)
//   - Attendee strip (social proof)
//   - Related Pulse-thread card
//   - Action chips (RSVP yes / maybe / no, ask, dismiss)

// ── Data ───────────────────────────────────────────────────
const COMM = {
  accent: '#27ae60',                  // cat-cleaning green = community
  trust: 'verified',
  category: 'Community',
  sender: 'Elm Park HOA',
  time: '1d ago',
  title: 'Saturday playground cleanup — 9 to 11 AM',
  reference: 'Posted by Aliyah W. · Board chair · 4 days before event',
};

const COMMUNITY = {
  name: 'Elm Park HOA',
  tagline: '40 households on Elm, Maple & 14th',
  founded: 'Est. 2014',
  member: { verified: true, since: 'Mar 2024', role: 'Resident' },
  membersCount: 87,
  ring: '#27ae60',
};

const EVENT = {
  when: { day: 'Sat', date: 'May 24', range: '9:00 – 11:00 AM' },
  where: 'Elm Park playground',
  whereNote: 'Gather at the gazebo · 8:55 AM',
  bring: ['Work gloves (we have spares)', 'A reusable mug', 'Bug spray if you like'],
  weather: { temp: 64, summary: 'Partly sunny · gentle breeze' },
  organizer: 'Aliyah W.',
};

const ATTENDEES = [
  { initials: 'JT', name: 'Jamal T.',   bg: 'linear-gradient(135deg,#16A34A,#15803d)', block: 'Your block' },
  { initials: 'MK', name: 'Maria K.',   bg: 'linear-gradient(135deg,#0ea5e9,#0369a1)', block: 'Your block' },
  { initials: 'AW', name: 'Aliyah W.',  bg: 'linear-gradient(135deg,#7C3AED,#5b21b6)', block: 'Organizer' },
  { initials: 'DR', name: 'Derek R.',   bg: 'linear-gradient(135deg,#f97316,#c2410c)', block: 'Maple St' },
  { initials: 'LS', name: 'Lin S.',     bg: 'linear-gradient(135deg,#dc2626,#991b1b)', block: '14th Ave' },
  { initials: 'PC', name: 'Paul C.',    bg: 'linear-gradient(135deg,#0284c7,#075985)', block: 'Maple St' },
  { initials: 'SN', name: 'Sara N.',    bg: 'linear-gradient(135deg,#16A34A,#166534)', block: 'Your block' },
];

const BODY = [
  'Hi neighbors — quick reminder that we are doing the spring playground cleanup this Saturday from 9 to 11 AM. Coffee + donuts at the gazebo while we get going.',
  'If you have gardening gloves please bring them. We will have a handful of spares from the tool library and a few extra rakes thanks to Park & Rec.',
  'No need to RSVP, but it does help us order the right number of donuts. See you there!',
];

const PULSE_THREAD = {
  title: 'Talk about Saturday cleanup',
  count: 12,
  lastReply: { who: 'Jamal T.', when: '12m', preview: 'I can bring the leaf blower if anyone needs it.' },
  posters: ['JT', 'MK', 'AW'],
};

const ELF_OPEN = {
  headline: 'Pantopus read this for you',
  summary: 'Spring playground cleanup, Saturday morning, ~2 hours. 12 of your neighbors are already going — including 3 from your block. Weather looks pleasant.',
  bullets: [
    { icon: 'users',     label: '12 neighbors going',   text: '3 from your block' },
    { icon: 'cloud-sun', label: '64° partly sunny',     text: 'no rain in forecast' },
    { icon: 'calendar',  label: 'No conflicts',         text: 'your Saturday is clear' },
  ],
};

const ELF_GOING = {
  headline: 'You\'re going to this',
  summary: 'Saved to your calendar with a Friday-evening reminder. Aliyah was notified you\'re coming and added you to the day-of group thread.',
  bullets: [
    { icon: 'calendar-check', label: 'Calendar event added',  text: 'reminder Fri 6:00 PM' },
    { icon: 'message-square', label: 'Day-of thread joined',  text: 'so you can find folks when you arrive' },
    { icon: 'umbrella',       label: 'Weather watch on',      text: 'we\'ll ping if forecast changes' },
  ],
};

// ── Card shell ─────────────────────────────────────────────
function CmCard({ children, accent, style = {}, noPad = false }) {
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
function CommunityNav() {
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
      <button style={{
        display: 'inline-flex', alignItems: 'center', gap: 2,
        border: 'none', background: 'transparent',
        color: 'var(--color-primary-600)',
        padding: '6px 6px', cursor: 'pointer',
        borderRadius: 8,
      }}>
        <i data-lucide="chevron-left" style={{ width: 22, height: 22 }}></i>
        <span style={{ fontSize: 15, fontWeight: 500, marginLeft: -2 }}>Mailbox</span>
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: COMM.accent }}></span>
        <span style={{
          fontSize: 12, fontWeight: 700, color: 'var(--fg2)',
          letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>Community mail</span>
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        <button style={navIco}><i data-lucide="bookmark" style={{ width: 18, height: 18 }}></i></button>
        <button style={navIco}><i data-lucide="more-horizontal" style={{ width: 18, height: 18 }}></i></button>
      </div>
    </div>
  );
}
const navIco = {
  width: 34, height: 34, borderRadius: 9999,
  border: 'none', background: 'var(--app-surface-sunken)',
  color: 'var(--fg2)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
};

// ── Hero (community-flavored, lighter than certified) ──────
function CommunityHero({ item, going }) {
  return (
    <CmCard accent={item.accent}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <TrustChip kind={item.trust} />
        <CategoryChip label={item.category} color={item.accent} />
        <span style={{ flex: 1 }}></span>
        <span style={{ fontSize: 11, color: 'var(--fg3)', fontWeight: 500 }}>{item.time}</span>
      </div>
      <div style={{
        fontSize: 11, fontWeight: 600, color: 'var(--fg3)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
      }}>{item.sender}</div>
      <div style={{
        fontSize: 19, fontWeight: 700, color: 'var(--fg1)',
        lineHeight: 1.25, letterSpacing: '-0.015em',
        textWrap: 'pretty',
      }}>{item.title}</div>
      <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 6 }}>
        {item.reference}
      </div>
      {going && (
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
            <span style={{ fontWeight: 700 }}>You're going</span>
            <span style={{ color: '#047857', opacity: 0.85 }}> · RSVP'd Today 2:14 PM</span>
          </div>
        </div>
      )}
    </CmCard>
  );
}

// ── Community badge card ──────────────────────────────────
function CommunityBadge() {
  return (
    <div style={{
      position: 'relative',
      borderRadius: 16,
      overflow: 'hidden',
      background: '#fff',
      border: '1px solid var(--app-border)',
      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
    }}>
      {/* soft green wash + leaf hint behind crest */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(160deg, #f0fdf4 0%, #ffffff 60%)',
        pointerEvents: 'none',
      }}></div>
      <div style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 14px 14px',
      }}>
        {/* crest */}
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: '#fff',
          border: `2px solid ${COMMUNITY.ring}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          position: 'relative',
          boxShadow: '0 2px 8px rgba(22,163,74,0.15)',
        }}>
          <i data-lucide="trees" style={{ width: 26, height: 26, color: COMMUNITY.ring }}></i>
          <span style={{
            position: 'absolute', bottom: -3, right: -3,
            width: 18, height: 18, borderRadius: '50%',
            background: 'var(--color-success)', color: '#fff',
            border: '2px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i data-lucide="check" style={{ width: 10, height: 10 }}></i>
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--fg1)', letterSpacing: '-0.005em' }}>
              {COMMUNITY.name}
            </span>
            <span style={{
              fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 9999,
              background: 'var(--color-success-bg)', color: '#047857',
              letterSpacing: '0.02em',
            }}>VERIFIED HOA</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 2, lineHeight: 1.4 }}>
            {COMMUNITY.tagline}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 11, color: 'var(--fg2)', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600,
            }}>
              <i data-lucide="user-check" style={{ width: 12, height: 12, color: COMMUNITY.ring }}></i>
              {COMMUNITY.member.role} · since {COMMUNITY.member.since}
            </span>
            <span style={{ fontSize: 11, color: 'var(--fg3)' }}>
              {COMMUNITY.membersCount} members · {COMMUNITY.founded}
            </span>
          </div>
        </div>
        <i data-lucide="chevron-right" style={{ width: 16, height: 16, color: 'var(--fg4)', flexShrink: 0 }}></i>
      </div>
    </div>
  );
}

// ── Event detail card (when / where / bring / weather) ─────
function EventCard() {
  return (
    <CmCard noPad>
      <div style={{
        padding: '10px 14px 8px',
        fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        borderBottom: '1px solid var(--app-border-subtle)',
      }}>Event details</div>

      <div style={{ padding: '14px' }}>
        {/* When */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <DateChip day={EVENT.when.day} date={EVENT.when.date} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg3)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>When</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg1)', marginTop: 1, letterSpacing: '-0.005em' }}>
              {EVENT.when.day}, {EVENT.when.date}
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 1 }}>{EVENT.when.range}</div>
          </div>
        </div>

        {/* Where (with mini map preview) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <MiniMap />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg3)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Where</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg1)', marginTop: 1, letterSpacing: '-0.005em' }}>
              {EVENT.where}
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 1 }}>{EVENT.whereNote}</div>
            <div style={{
              fontSize: 11, fontWeight: 600, color: 'var(--color-primary-600)',
              marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              <i data-lucide="navigation" style={{ width: 11, height: 11 }}></i>
              0.3 mi · 6 min walk
            </div>
          </div>
        </div>

        {/* Bring */}
        <div style={{
          background: 'var(--app-surface-sunken)',
          border: '1px solid var(--app-border-subtle)',
          borderRadius: 10,
          padding: '10px 12px',
          marginBottom: 10,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg3)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>
            Bring if you can
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {EVENT.bring.map((b, i) => (
              <li key={i} style={{
                fontSize: 12.5, color: 'var(--fg2)', display: 'flex', alignItems: 'flex-start', gap: 6,
              }}>
                <i data-lucide="check" style={{ width: 12, height: 12, color: 'var(--color-success)', marginTop: 4, flexShrink: 0 }}></i>
                {b}
              </li>
            ))}
          </ul>
        </div>

        {/* Weather */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px',
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: 10,
        }}>
          <i data-lucide="cloud-sun" style={{ width: 20, height: 20, color: 'var(--color-primary-700)' }}></i>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary-800)' }}>{EVENT.weather.temp}°F</span>
            <span style={{ fontSize: 12, color: 'var(--color-primary-700)', marginLeft: 6 }}>{EVENT.weather.summary}</span>
          </div>
          <span style={{ fontSize: 10, color: 'var(--color-primary-700)', fontWeight: 600 }}>Forecast for Sat 9 AM</span>
        </div>
      </div>
    </CmCard>
  );
}

// Date chip — calendar-page style
function DateChip({ day, date }) {
  const [mon, dayNum] = date.split(' ');
  return (
    <div style={{
      width: 52, height: 56, borderRadius: 10,
      overflow: 'hidden', flexShrink: 0,
      border: '1px solid var(--app-border)',
      background: '#fff',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      <div style={{
        height: 16,
        background: COMM.accent, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
      }}>{mon.toUpperCase()}</div>
      <div style={{
        height: 40,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, color: 'var(--fg1)' }}>
          {dayNum}
        </div>
        <div style={{ fontSize: 9, color: 'var(--fg3)', fontWeight: 700, letterSpacing: '0.05em', marginTop: 1 }}>
          {day.toUpperCase()}
        </div>
      </div>
    </div>
  );
}

// Mini map — abstract block-and-pin
function MiniMap() {
  return (
    <div style={{
      width: 52, height: 56, borderRadius: 10,
      overflow: 'hidden', flexShrink: 0,
      border: '1px solid var(--app-border)',
      position: 'relative',
      background: '#e8f0e9',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      <svg width="52" height="56" viewBox="0 0 52 56" style={{ position: 'absolute', inset: 0 }}>
        {/* park green block */}
        <rect x="6" y="14" width="40" height="28" fill="#c6e9c2" />
        {/* paths */}
        <rect x="0" y="20" width="52" height="3" fill="#fff" />
        <rect x="20" y="0" width="3" height="56" fill="#fff" />
        {/* tree dots */}
        <circle cx="10" cy="18" r="2" fill="#7cb27a" />
        <circle cx="38" cy="36" r="2" fill="#7cb27a" />
        <circle cx="40" cy="18" r="1.5" fill="#7cb27a" />
      </svg>
      {/* pin */}
      <div style={{
        position: 'absolute',
        left: '50%', top: '52%',
        transform: 'translate(-50%, -100%)',
      }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50% 50% 50% 0',
          background: COMM.accent,
          transform: 'rotate(-45deg)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
          border: '2px solid #fff',
        }}></div>
      </div>
    </div>
  );
}

// ── Attendee strip ─────────────────────────────────────────
function Attendees({ going, organizer }) {
  // Sort: organizer first, then user's block, then others.
  const sorted = [...ATTENDEES];
  return (
    <CmCard noPad>
      <div style={{
        padding: '10px 14px 8px',
        borderBottom: '1px solid var(--app-border-subtle)',
        display: 'flex', alignItems: 'center',
      }}>
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>{going ? '13 going' : '12 going'}</div>
          <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 1 }}>
            {going ? 'Including you' : '3 from your block · all verified residents'}
          </div>
        </div>
        <span style={{ flex: 1 }}></span>
        <span style={{
          fontSize: 11, fontWeight: 700, color: 'var(--color-primary-600)',
          display: 'inline-flex', alignItems: 'center', gap: 3,
        }}>See all <i data-lucide="chevron-right" style={{ width: 12, height: 12 }}></i></span>
      </div>
      <div style={{ padding: '12px 14px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {going && <YouAvatar />}
        {sorted.map((a, i) => <Avatar key={i} a={a} />)}
        <div style={{
          width: 40, height: 56,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--app-surface-sunken)',
            color: 'var(--fg2)',
            fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1.5px dashed var(--app-border-strong)',
          }}>+{going ? 7 : 6}</div>
          <div style={{ fontSize: 9, color: 'var(--fg3)', marginTop: 4, fontWeight: 600, textAlign: 'center', lineHeight: 1.2 }}>
            more
          </div>
        </div>
      </div>
    </CmCard>
  );
}

function Avatar({ a }) {
  return (
    <div style={{
      width: 40,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: a.bg, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700,
        position: 'relative',
        flexShrink: 0,
      }}>
        {a.initials}
        <span style={{
          position: 'absolute', right: -2, bottom: -2,
          width: 12, height: 12, borderRadius: '50%',
          background: 'var(--color-success)', color: '#fff',
          border: '2px solid #fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i data-lucide="check" style={{ width: 7, height: 7 }}></i>
        </span>
      </div>
      <div style={{
        fontSize: 9, color: 'var(--fg3)', fontWeight: 600,
        textAlign: 'center', lineHeight: 1.1, whiteSpace: 'nowrap',
      }}>{a.name.split(' ')[0]}</div>
    </div>
  );
}

function YouAvatar() {
  return (
    <div style={{
      width: 40,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--color-primary-500), var(--color-primary-700))',
        color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700,
        position: 'relative',
        flexShrink: 0,
        boxShadow: '0 0 0 2.5px var(--color-primary-300)',
      }}>
        You
      </div>
      <div style={{
        fontSize: 9, color: 'var(--color-primary-700)', fontWeight: 700,
        textAlign: 'center', lineHeight: 1.1, whiteSpace: 'nowrap',
      }}>You</div>
    </div>
  );
}

// ── Body (lighter than certified body) ─────────────────────
function CommunityBody() {
  return (
    <CmCard>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'linear-gradient(135deg,#7C3AED,#5b21b6)',
          color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700,
          flexShrink: 0,
        }}>AW</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg1)' }}>Aliyah W.</div>
          <div style={{ fontSize: 10.5, color: 'var(--fg3)' }}>Board chair · posted yesterday at 4:18 PM</div>
        </div>
      </div>
      <div style={{
        fontSize: 14, color: 'var(--fg1)', lineHeight: 1.55,
        textWrap: 'pretty',
      }}>
        {BODY.map((p, i) => (
          <p key={i} style={{ margin: i ? '10px 0 0' : 0 }}>{p}</p>
        ))}
      </div>
    </CmCard>
  );
}

// ── AI elf ─────────────────────────────────────────────────
function CommunityElf({ data }) {
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

// ── Pulse thread cross-link ────────────────────────────────
function PulseThreadCard({ going }) {
  return (
    <div style={{
      borderRadius: 16,
      border: '1px solid var(--app-border)',
      background: '#fff',
      padding: 14,
      position: 'relative',
      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 6,
          background: 'var(--color-primary-100)', color: 'var(--color-primary-700)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i data-lucide="radio" style={{ width: 13, height: 13 }}></i>
        </div>
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
          letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>Pulse thread · Elm Park</div>
      </div>
      <div style={{
        fontSize: 14, fontWeight: 700, color: 'var(--fg1)', letterSpacing: '-0.005em',
      }}>{PULSE_THREAD.title}</div>
      <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 3 }}>
        {PULSE_THREAD.count} replies · last from {PULSE_THREAD.lastReply.who} {PULSE_THREAD.lastReply.when} ago
      </div>
      <div style={{
        marginTop: 10, padding: '8px 10px',
        background: 'var(--app-surface-sunken)',
        borderRadius: 10,
        fontSize: 12, color: 'var(--fg2)',
        lineHeight: 1.4,
        display: 'flex', gap: 8, alignItems: 'flex-start',
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          background: 'linear-gradient(135deg,#16A34A,#15803d)',
          color: '#fff', fontSize: 9, fontWeight: 700, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>JT</div>
        <div>
          <span style={{ fontWeight: 700, color: 'var(--fg1)' }}>{PULSE_THREAD.lastReply.who}</span>{' '}
          {PULSE_THREAD.lastReply.preview}
        </div>
      </div>
      <button style={{
        marginTop: 12, width: '100%',
        background: '#fff',
        border: '1.5px solid var(--color-primary-200)',
        color: 'var(--color-primary-700)',
        borderRadius: 10,
        padding: '9px 12px',
        fontSize: 13, fontWeight: 700,
        cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}>
        {going ? 'Open thread · you\'re in' : 'Join the thread'}
        <i data-lucide="arrow-right" style={{ width: 14, height: 14 }}></i>
      </button>
    </div>
  );
}

// ── Action chips ───────────────────────────────────────────
function CommunityActions({ going }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {going ? (
        <button style={{
          width: '100%', padding: '14px 16px',
          background: '#fff',
          color: 'var(--color-success)',
          border: '1.5px solid var(--color-success-light)',
          borderRadius: 14,
          fontSize: 15, fontWeight: 700,
          cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <i data-lucide="check-circle-2" style={{ width: 16, height: 16 }}></i>
          You're going · tap to change
        </button>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <RsvpBtn icon="check"      label="Going"     primary />
          <RsvpBtn icon="help-circle" label="Maybe" />
          <RsvpBtn icon="x"          label="Can't make it" />
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <ChipBtn icon="message-square-plus" label="Ask a question" />
        <ChipBtn icon="user-plus"          label="Add housemate" />
        <ChipBtn icon="bell-off"           label="Mute thread" />
      </div>
    </div>
  );
}

function RsvpBtn({ icon, label, primary }) {
  return (
    <button style={{
      padding: '12px 8px',
      background: primary ? 'var(--color-primary-600)' : '#fff',
      color: primary ? '#fff' : 'var(--fg1)',
      border: primary ? 'none' : '1px solid var(--app-border)',
      borderRadius: 12,
      fontSize: 12.5, fontWeight: 700,
      boxShadow: primary ? 'var(--shadow-primary)' : 'none',
      cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
      letterSpacing: '-0.005em',
    }}>
      <i data-lucide={icon} style={{ width: 14, height: 14 }}></i>
      {label}
    </button>
  );
}
function ChipBtn({ icon, label }) {
  return (
    <button style={{
      background: '#fff',
      border: '1px solid var(--app-border)',
      borderRadius: 12,
      padding: '10px 4px',
      display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      color: 'var(--fg2)',
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
function MailCommunityScreen({ state = 'open', dataLabel }) {
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
      <CommunityNav />

      <div style={{
        flex: 1,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '12px 16px 96px',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <CommunityHero item={COMM} going={going} />
          <CommunityBadge />
          <CommunityElf data={going ? ELF_GOING : ELF_OPEN} />
          <EventCard />
          <Attendees going={going} />
          <CommunityBody />
          <PulseThreadCard going={going} />
          <CommunityActions going={going} />
        </div>
      </div>

      <BottomTabBar active="mail" />
    </div>
  );
}

Object.assign(window, { MailCommunityScreen });
