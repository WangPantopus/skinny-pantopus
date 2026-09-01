// MailDetailScreen — A17 archetype: Mailbox item detail
// Slots: nav bar, hero card (trust + category + sender + title),
//        AI elf strip, key-facts panel, body card, attachments,
//        sender card, action buttons. Bottom tab bar matches root.

// ── Top nav bar ────────────────────────────────────────────
function DetailNav({ eyebrow, eyebrowColor }) {
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
      <button style={navBtn}>
        <i data-lucide="chevron-left" style={{ width: 22, height: 22 }}></i>
        <span style={{ fontSize: 15, fontWeight: 500, marginLeft: -2 }}>Mailbox</span>
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: eyebrowColor,
        }}></span>
        <span style={{
          fontSize: 12, fontWeight: 700, color: 'var(--fg2)',
          letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>{eyebrow}</span>
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        <button style={navIconBtn}><i data-lucide="bookmark" style={{ width: 18, height: 18 }}></i></button>
        <button style={navIconBtn}><i data-lucide="more-horizontal" style={{ width: 18, height: 18 }}></i></button>
      </div>
    </div>
  );
}
const navBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 2,
  border: 'none', background: 'transparent',
  color: 'var(--color-primary-600)',
  padding: '6px 6px', cursor: 'pointer',
  borderRadius: 8,
};
const navIconBtn = {
  width: 34, height: 34, borderRadius: 9999,
  border: 'none', background: 'var(--app-surface-sunken)',
  color: 'var(--fg2)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
};

// ── Card shell ─────────────────────────────────────────────
function Card({ children, accent, style = {}, noPad = false }) {
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

// ── Hero card ──────────────────────────────────────────────
function HeroCard({ item, acknowledged }) {
  return (
    <Card accent={item.accent}>
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
      {item.reference && (
        <div style={{
          fontSize: 11, color: 'var(--fg3)', marginTop: 6,
          fontFamily: 'var(--font-mono)',
        }}>{item.reference}</div>
      )}

      {acknowledged && (
        <div style={{
          marginTop: 12,
          padding: '8px 10px 8px 9px',
          background: 'var(--color-success-bg)',
          border: '1px solid #bbf7d0',
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          color: '#065f46',
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
            <span style={{ fontWeight: 700 }}>Acknowledged</span>
            <span style={{ color: '#047857', opacity: 0.85 }}> · Today 2:14 PM by you</span>
          </div>
        </div>
      )}
    </Card>
  );
}

// ── AI elf strip ───────────────────────────────────────────
function ElfStrip({ summary, bullets, headline = 'Pantopus read this for you' }) {
  return (
    <div style={{
      background: 'linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 100%)',
      border: '1px solid #bae6fd',
      borderRadius: 16,
      padding: '12px 14px 14px',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 8,
          background: 'var(--color-primary-600)',
          color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 6px rgba(2,132,199,0.3)',
        }}>
          <i data-lucide="sparkles" style={{ width: 13, height: 13 }}></i>
        </div>
        <div style={{
          fontSize: 12, fontWeight: 700,
          color: 'var(--color-primary-800)',
          letterSpacing: '-0.005em',
          flex: 1,
        }}>{headline}</div>
        <button style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--color-primary-700)', fontSize: 11, fontWeight: 600,
          display: 'inline-flex', alignItems: 'center', gap: 3,
          padding: 0,
        }}>
          <i data-lucide="refresh-cw" style={{ width: 11, height: 11 }}></i>
          Redo
        </button>
      </div>
      <div style={{
        fontSize: 13, color: '#0c4a6e', lineHeight: 1.5, marginBottom: 10,
        textWrap: 'pretty',
      }}>{summary}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {bullets.map((b, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            fontSize: 12, lineHeight: 1.45, color: 'var(--fg1)',
          }}>
            <div style={{
              width: 16, height: 16, borderRadius: 4,
              background: '#fff',
              color: 'var(--color-primary-700)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, marginTop: 1,
              border: '1px solid #bae6fd',
            }}>
              <i data-lucide={b.icon} style={{ width: 10, height: 10 }}></i>
            </div>
            <span><strong style={{ fontWeight: 700 }}>{b.label}</strong>{b.text && <span style={{ color: 'var(--fg2)' }}> — {b.text}</span>}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Key facts panel ────────────────────────────────────────
function KeyFacts({ facts }) {
  return (
    <Card noPad>
      <div style={{
        padding: '10px 14px 8px',
        fontSize: 11, fontWeight: 700,
        color: 'var(--fg3)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        borderBottom: '1px solid var(--app-border-subtle)',
      }}>Key facts</div>
      <div>
        {facts.map((f, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start',
            padding: '10px 14px',
            borderBottom: i < facts.length - 1 ? '1px solid var(--app-border-subtle)' : 'none',
            gap: 12,
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6, flexShrink: 0,
              background: 'var(--app-surface-sunken)',
              color: 'var(--fg2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <i data-lucide={f.icon} style={{ width: 13, height: 13 }}></i>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 11, color: 'var(--fg3)', fontWeight: 600,
                letterSpacing: '0.01em',
              }}>{f.label}</div>
              <div style={{
                fontSize: 13, color: 'var(--fg1)', fontWeight: 600,
                marginTop: 1, letterSpacing: '-0.005em',
              }}>{f.value}</div>
              {f.note && (
                <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 1 }}>
                  {f.note}
                </div>
              )}
            </div>
            {f.tag && (
              <span style={{
                fontSize: 10, fontWeight: 700,
                padding: '3px 7px', borderRadius: 9999,
                background: f.tagBg || 'var(--color-warning-bg)',
                color: f.tagFg || 'var(--color-warning)',
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}>{f.tag}</span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Body card ──────────────────────────────────────────────
function BodyCard({ body }) {
  return (
    <Card>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        marginBottom: 8,
      }}>Notice text</div>
      <div style={{
        fontSize: 13, color: 'var(--fg2)', lineHeight: 1.55,
        textWrap: 'pretty',
      }}>
        {body.map((p, i) => (
          <p key={i} style={{ margin: i ? '10px 0 0' : 0 }}>{p}</p>
        ))}
      </div>
      <button style={{
        marginTop: 10, padding: 0, background: 'transparent', border: 'none',
        color: 'var(--color-primary-600)', fontSize: 12, fontWeight: 600,
        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
      }}>
        Show full notice
        <i data-lucide="chevron-down" style={{ width: 13, height: 13 }}></i>
      </button>
    </Card>
  );
}

// ── Attachments row ────────────────────────────────────────
function Attachments({ files }) {
  return (
    <Card noPad>
      <div style={{
        padding: '10px 14px 8px',
        fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        borderBottom: '1px solid var(--app-border-subtle)',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span>Attachments</span>
        <span style={{ color: 'var(--fg4)', fontWeight: 600 }}>· {files.length}</span>
      </div>
      {files.map((f, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center',
          padding: '10px 14px',
          borderBottom: i < files.length - 1 ? '1px solid var(--app-border-subtle)' : 'none',
          gap: 12,
        }}>
          <div style={{
            width: 36, height: 44, borderRadius: 6,
            background: '#fee2e2',
            color: '#b91c1c',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            border: '1px solid #fecaca',
            fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
          }}>PDF</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg1)' }}>{f.name}</div>
            <div style={{ fontSize: 11, color: 'var(--fg3)' }}>{f.meta}</div>
          </div>
          <button style={{
            border: 'none', background: 'var(--app-surface-sunken)',
            color: 'var(--fg2)',
            width: 32, height: 32, borderRadius: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>
            <i data-lucide="download" style={{ width: 14, height: 14 }}></i>
          </button>
        </div>
      ))}
    </Card>
  );
}

// ── Sender card ────────────────────────────────────────────
function SenderCard({ sender }) {
  return (
    <Card>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
      }}>Sender</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: sender.avatarBg,
          color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, flexShrink: 0,
          letterSpacing: '0.02em',
          position: 'relative',
        }}>
          {sender.initials}
          <span style={{
            position: 'absolute', right: -3, bottom: -3,
            width: 16, height: 16, borderRadius: '50%',
            background: 'var(--color-success)',
            color: '#fff',
            border: '2px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i data-lucide="check" style={{ width: 9, height: 9 }}></i>
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg1)' }}>
            {sender.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 1 }}>
            {sender.dept}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 10, fontWeight: 700,
              padding: '2px 6px', borderRadius: 9999,
              background: '#dbeafe', color: '#1e40af',
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              <i data-lucide="landmark" style={{ width: 9, height: 9 }}></i>
              {sender.kind}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700,
              padding: '2px 6px', borderRadius: 9999,
              background: 'var(--color-success-bg)', color: '#047857',
            }}>{sender.proof}</span>
          </div>
        </div>
        <i data-lucide="chevron-right" style={{ width: 16, height: 16, color: 'var(--fg4)' }}></i>
      </div>
    </Card>
  );
}

// ── Timeline (acknowledged state) ──────────────────────────
function Timeline({ events }) {
  return (
    <Card>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12,
      }}>Activity</div>
      <div style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute', left: 7, top: 6, bottom: 6,
          width: 2, background: 'var(--app-border)',
        }}></div>
        {events.map((e, i) => (
          <div key={i} style={{
            position: 'relative',
            display: 'flex', alignItems: 'flex-start', gap: 12,
            paddingBottom: i < events.length - 1 ? 14 : 0,
          }}>
            <div style={{
              width: 16, height: 16, borderRadius: '50%',
              background: e.active ? 'var(--color-success)' : '#fff',
              border: e.active ? '2px solid var(--color-success)' : '2px solid var(--app-border-strong)',
              flexShrink: 0,
              zIndex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {e.active && <i data-lucide="check" style={{ width: 9, height: 9, color: '#fff' }}></i>}
            </div>
            <div style={{ flex: 1, minWidth: 0, marginTop: -1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg1)' }}>{e.label}</div>
              <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 1 }}>{e.when}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Action bar ─────────────────────────────────────────────
function ActionBar({ acknowledged }) {
  const secondaries = [
    { icon: 'calendar-plus', label: 'Calendar' },
    { icon: 'reply',         label: 'Reply' },
    { icon: 'forward',       label: 'Forward' },
    { icon: 'archive',       label: 'Archive' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button style={{
        width: '100%',
        padding: '14px 16px',
        background: acknowledged ? '#fff' : 'var(--color-primary-600)',
        color: acknowledged ? 'var(--color-success)' : '#fff',
        border: acknowledged ? '1.5px solid var(--color-success-light)' : 'none',
        borderRadius: 14,
        fontSize: 15, fontWeight: 700,
        letterSpacing: '-0.005em',
        boxShadow: acknowledged ? 'none' : 'var(--shadow-primary)',
        cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <i data-lucide={acknowledged ? 'check-circle-2' : 'check'} style={{ width: 16, height: 16 }}></i>
        {acknowledged ? 'Acknowledged · Tap to undo' : 'Acknowledge receipt'}
      </button>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
      }}>
        {secondaries.map((s, i) => (
          <button key={i} style={{
            background: '#fff',
            border: '1px solid var(--app-border)',
            borderRadius: 12,
            padding: '10px 4px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            color: 'var(--fg2)',
            cursor: 'pointer',
            fontSize: 10.5, fontWeight: 600,
          }}>
            <i data-lucide={s.icon} style={{ width: 17, height: 17 }}></i>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Data for the example item ──────────────────────────────
const ITEM = {
  accent: '#f97316',       // certified orange
  trust: 'verified',
  category: 'Certified',
  sender: 'City of Oakland · Planning',
  time: '1h ago',
  title: 'Notice of public hearing — Zoning variance ZA-2026-0188',
  reference: 'Case ZA-2026-0188 · Cert # 7014-2026-0411',
};

const ELF = {
  summary: 'Your neighbor at 412 Elm wants a 2-foot rear-yard setback variance to extend their garage. The city is holding a public hearing June 3 — you can comment in writing or show up in person.',
  bullets: [
    { icon: 'map-pin',  label: 'Affects 412 Elm St',         text: 'next door to you' },
    { icon: 'calendar', label: 'Hearing Tue Jun 3, 6:00 PM', text: 'City Hall, Room 1' },
    { icon: 'pencil',   label: 'Written comment by May 30',  text: 'optional' },
  ],
};

const ELF_ACK = {
  summary: 'You acknowledged this notice — your name is on the record for case ZA-2026-0188. Pantopus has scheduled the two key dates and saved this in your Vault.',
  bullets: [
    { icon: 'bell',         label: 'Comment-window reminder', text: 'Fri May 30, 9:00 AM' },
    { icon: 'calendar',     label: 'Hearing reminder',         text: 'Tue Jun 3, 5:00 PM' },
    { icon: 'archive',      label: 'Moved to Vault',           text: 'after hearing closes' },
  ],
};

const FACTS = [
  { icon: 'calendar',      label: 'Hearing date',     value: 'Tue, Jun 3, 2026 · 6:00 PM' },
  { icon: 'map-pin',       label: 'Location',         value: 'Oakland City Hall, Room 1' },
  { icon: 'home',          label: 'Subject property', value: '412 Elm St', note: '2 doors down from you' },
  { icon: 'user',          label: 'Filed by',         value: 'J. Reyes (412 Elm St)' },
  { icon: 'clock',         label: 'Comment deadline', value: 'Fri, May 30, 2026', tag: '15 days left' },
  { icon: 'circle-check',  label: 'Required action',  value: 'None — acknowledgment is courteous', tag: 'Optional', tagBg: '#e0f2fe', tagFg: '#0369a1' },
];

const FACTS_ACK = [
  { icon: 'check-circle',  label: 'Status',           value: 'Acknowledged on file', tag: 'Confirmed', tagBg: 'var(--color-success-bg)', tagFg: '#047857' },
  ...FACTS,
];

const BODY = [
  'NOTICE IS HEREBY GIVEN that the Oakland Planning Commission will hold a public hearing on Tuesday, June 3, 2026, at 6:00 PM in Room 1 of City Hall, One Frank H. Ogawa Plaza.',
  'The purpose of this hearing is to consider a request for a variance from Section 17.108.020 of the Planning Code, to permit a two-foot reduction of the required rear-yard setback at 412 Elm Street, to accommodate a single-story garage extension.',
  'Written comments must be received by the Bureau of Planning no later than 5:00 PM on May 30, 2026. Comments may be submitted by mail to 250 Frank H. Ogawa Plaza, Suite 3315, or by email to planning-hearings@oaklandca.gov.',
];

const FILES = [
  { name: 'Public notice ZA-2026-0188.pdf', meta: '2 pages · 84 KB · stamped May 12' },
  { name: 'Site plan and elevation.pdf',    meta: '1 page · 220 KB · J. Reyes, architect' },
];

const SENDER = {
  initials: 'CO',
  avatarBg: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
  name: 'City of Oakland',
  dept: 'Bureau of Planning · Hearings Division',
  kind: 'Verified government',
  proof: 'Sender domain checked',
};

const TIMELINE = [
  { label: 'Acknowledged by you',                when: 'Today · 2:14 PM',  active: true },
  { label: 'Delivered to your Mailbox',          when: 'Today · 1:02 PM' },
  { label: 'Pantopus drafted plain-language TL;DR', when: 'Today · 1:02 PM' },
  { label: 'Certified mail postmark',            when: 'Mon May 12 · Oakland, CA' },
];

// ── Screen composition ────────────────────────────────────
function MailDetailScreen({ state = 'open', dataLabel }) {
  const acknowledged = state === 'acknowledged';
  return (
    <div data-screen-label={dataLabel} style={{
      width: '100%', height: '100%',
      background: 'var(--app-bg)',
      display: 'flex', flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
      paddingTop: 54,
    }}>
      <DetailNav eyebrow={ITEM.category} eyebrowColor={ITEM.accent} />

      <div style={{
        flex: 1,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '12px 16px 96px',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <HeroCard item={ITEM} acknowledged={acknowledged} />
          <ElfStrip
            headline={acknowledged ? 'What happens next' : 'Pantopus read this for you'}
            summary={acknowledged ? ELF_ACK.summary : ELF.summary}
            bullets={acknowledged ? ELF_ACK.bullets : ELF.bullets}
          />
          {/* On acknowledged state, lead with the timeline so the post-action
              signal lands above the fold; defer key facts + body below. */}
          {acknowledged && <Timeline events={TIMELINE} />}
          <KeyFacts facts={acknowledged ? FACTS_ACK : FACTS} />
          <BodyCard body={BODY} />
          <Attachments files={FILES} />
          <SenderCard sender={SENDER} />
          <ActionBar acknowledged={acknowledged} />
        </div>
      </div>

      <BottomTabBar active="mail" />
    </div>
  );
}

Object.assign(window, { MailDetailScreen });
