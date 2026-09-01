// MailboxScreen — Pantopus mobile Mailbox root archetype.
// One component, parameterized by drawer + tab + mode.

const MB = {
  // category accents (from --cat-* tokens)
  pkg:       '#374151',  // delivery / package
  certified: '#f97316',  // handyman orange — used for civic/certified weight
  coupon:    '#7c3aed',  // goods violet
  community: '#27ae60',  // cleaning green
  booklet:   '#2980b9',  // tutoring blue
  invoice:   '#16a34a',  // rentals/money
  legal:     '#dc2626',  // vehicles red — urgent legal
  contract:  '#7c3aed',
  notice:    '#374151',
  tax:       '#f97316',
};

// ── Drawer pill ────────────────────────────────────────────
function DrawerPill({ icon, label, active, unread }) {
  const pillStyle = {
    height: 40,
    padding: '0 14px 0 12px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    borderRadius: 9999,
    fontSize: 14,
    fontWeight: 600,
    border: active ? 'none' : '1px solid var(--app-border)',
    background: active ? 'var(--color-primary-600)' : '#fff',
    color: active ? '#fff' : 'var(--fg2)',
    position: 'relative',
    flex: '0 0 auto',
    boxShadow: active ? '0 1px 3px rgba(2,132,199,0.18)' : 'none',
  };
  return (
    <div style={pillStyle}>
      <i data-lucide={icon} style={{ width: 16, height: 16 }}></i>
      <span>{label}</span>
      {unread > 0 && (
        <span style={{
          position: 'absolute',
          top: -4,
          right: -4,
          minWidth: 18,
          height: 18,
          padding: '0 5px',
          borderRadius: 9999,
          background: active ? '#fff' : 'var(--color-primary-600)',
          color: active ? 'var(--color-primary-700)' : '#fff',
          fontSize: 10,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid #fff',
          lineHeight: 1,
        }}>{unread}</span>
      )}
    </div>
  );
}

// ── Trust badge chip ───────────────────────────────────────
function TrustChip({ kind }) {
  const map = {
    verified: { bg: '#ecfdf5', fg: '#047857', icon: 'shield-check', label: 'Verified' },
    partial:  { bg: '#fffbeb', fg: '#92400e', icon: 'shield-alert', label: 'Partial' },
    unverified:{ bg: '#fef2f2', fg: '#b91c1c', icon: 'shield-off', label: 'Unverified' },
  };
  const c = map[kind];
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '3px 8px 3px 7px',
      borderRadius: 9999,
      background: c.bg,
      color: c.fg,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.01em',
      lineHeight: 1,
    }}>
      <i data-lucide={c.icon} style={{ width: 11, height: 11 }}></i>
      {c.label}
    </span>
  );
}

// ── Category chip ──────────────────────────────────────────
function CategoryChip({ label, color }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '3px 8px',
      borderRadius: 9999,
      background: '#f3f4f6',
      color: 'var(--fg2)',
      fontSize: 10,
      fontWeight: 600,
      lineHeight: 1,
      letterSpacing: '0.01em',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: color, marginRight: 6,
        display: 'inline-block',
      }}></span>
      {label}
    </span>
  );
}

// ── Mail card ──────────────────────────────────────────────
function MailCard({ accent, trust, category, sender, time, title, body, actions }) {
  return (
    <div style={{
      position: 'relative',
      background: '#fff',
      border: '1px solid var(--app-border)',
      borderRadius: 16,
      padding: '14px 14px 12px 18px',
      overflow: 'hidden',
      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
    }}>
      {/* signature left accent strip */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: 4, background: accent,
      }}></div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <TrustChip kind={trust} />
        <CategoryChip label={category} color={accent} />
        <span style={{ flex: 1 }}></span>
        <span style={{ fontSize: 11, color: 'var(--fg3)', fontWeight: 500, flexShrink: 0 }}>{time}</span>
      </div>

      <div style={{
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--fg3)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: 2,
      }}>{sender}</div>

      <div style={{
        fontSize: 14,
        fontWeight: 600,
        color: 'var(--fg1)',
        lineHeight: 1.3,
        letterSpacing: '-0.005em',
        marginBottom: 4,
      }}>{title}</div>

      <div style={{
        fontSize: 12,
        color: 'var(--fg2)',
        lineHeight: 1.45,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>{body}</div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        marginTop: 10,
        paddingTop: 10,
        borderTop: '1px solid var(--app-border-subtle)',
      }}>
        {actions.map((a, i) => (
          <span key={i} style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 12,
            fontWeight: 600,
            color: a.primary ? 'var(--color-primary-600)' : 'var(--fg3)',
          }}>
            <i data-lucide={a.icon} style={{ width: 12, height: 12 }}></i>
            {a.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Top bar ────────────────────────────────────────────────
function TopBar({ }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 16px 10px',
      background: 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--app-border-subtle)',
    }}>
      <div style={{
        fontSize: 26,
        fontWeight: 700,
        letterSpacing: '-0.02em',
        color: 'var(--fg1)',
      }}>Mailbox</div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button style={iconBtn}><i data-lucide="search" style={{ width: 18, height: 18 }}></i></button>
        <button style={iconBtn}><i data-lucide="scan-line" style={{ width: 18, height: 18 }}></i></button>
      </div>
    </div>
  );
}
const iconBtn = {
  width: 36, height: 36, borderRadius: 9999,
  border: 'none', background: 'var(--app-surface-sunken)',
  color: 'var(--fg2)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
};

// ── Drawer row ─────────────────────────────────────────────
function DrawerRow({ active }) {
  const drawers = [
    { id: 'me',   icon: 'user',         label: 'Me',   unread: 5 },
    { id: 'home', icon: 'home',         label: 'Home', unread: 3 },
    { id: 'biz',  icon: 'briefcase',    label: 'Biz',  unread: 12 },
    { id: 'earn', icon: 'circle-dollar-sign', label: 'Earn', unread: 0 },
  ];
  return (
    <div style={{
      display: 'flex',
      gap: 8,
      padding: '12px 16px 14px',
      overflowX: 'hidden',
      background: '#fff',
      borderBottom: '1px solid var(--app-border-subtle)',
    }}>
      {drawers.map(d => (
        <DrawerPill key={d.id}
          icon={d.icon} label={d.label}
          active={d.id === active}
          unread={d.unread} />
      ))}
    </div>
  );
}

// ── Tab bar (3 tabs, underline) ────────────────────────────
function TabRow({ active }) {
  const tabs = [
    { id: 'incoming', label: 'Incoming', count: 14 },
    { id: 'counter',  label: 'Counter',  count: 3 },
    { id: 'vault',    label: 'Vault',    count: null },
  ];
  return (
    <div style={{
      display: 'flex',
      background: '#fff',
      borderBottom: '1px solid var(--app-border)',
      padding: '0 16px',
    }}>
      {tabs.map(t => {
        const isActive = t.id === active;
        return (
          <div key={t.id} style={{
            flex: 1,
            padding: '12px 0 11px',
            textAlign: 'center',
            position: 'relative',
            fontSize: 13,
            fontWeight: isActive ? 700 : 500,
            color: isActive ? 'var(--color-primary-600)' : 'var(--fg3)',
            letterSpacing: '-0.005em',
          }}>
            <span>{t.label}</span>
            {t.count != null && (
              <span style={{
                display: 'inline-flex',
                marginLeft: 6,
                minWidth: 18,
                height: 16,
                padding: '0 5px',
                borderRadius: 9999,
                background: isActive ? 'var(--color-primary-600)' : 'var(--app-surface-sunken)',
                color: isActive ? '#fff' : 'var(--fg3)',
                fontSize: 10,
                fontWeight: 700,
                alignItems: 'center',
                justifyContent: 'center',
                verticalAlign: 'middle',
                lineHeight: 1,
              }}>{t.count}</span>
            )}
            {isActive && (
              <div style={{
                position: 'absolute',
                bottom: -1,
                left: '15%', right: '15%',
                height: 2.5,
                background: 'var(--color-primary-600)',
                borderRadius: 2,
              }}></div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Bottom tab bar (app shell) ─────────────────────────────
function BottomTabBar({ active = 'mail' }) {
  const tabs = [
    { id: 'home', icon: 'home',         label: 'Home' },
    { id: 'pulse', icon: 'radio',       label: 'Pulse' },
    { id: 'market', icon: 'shopping-bag', label: 'Market' },
    { id: 'mail',  icon: 'mailbox',     label: 'Mail' },
    { id: 'me',    icon: 'user',        label: 'Me' },
  ];
  return (
    <div style={{
      position: 'absolute',
      bottom: 0, left: 0, right: 0,
      paddingTop: 8,
      paddingBottom: 28,
      background: 'rgba(255,255,255,0.95)',
      backdropFilter: 'blur(12px)',
      borderTop: '1px solid var(--app-border)',
      display: 'flex',
    }}>
      {tabs.map(t => {
        const isActive = t.id === active;
        return (
          <div key={t.id} style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
            color: isActive ? 'var(--color-primary-600)' : 'var(--fg3)',
            fontSize: 10,
            fontWeight: 600,
          }}>
            <i data-lucide={t.icon} style={{ width: 22, height: 22 }}></i>
            <span>{t.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Section group label ────────────────────────────────────
function SectionLabel({ text, accent }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '0 4px 6px',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: 'var(--fg3)',
    }}>
      <span>{text}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--app-border)' }}></div>
    </div>
  );
}

// ── Mail data ──────────────────────────────────────────────
const ME_INCOMING = [
  {
    section: 'Today',
    items: [
      {
        accent: MB.pkg, trust: 'verified', category: 'Package',
        sender: 'Amazon Logistics · USPS',
        time: '12m',
        title: 'Echo Pop arriving today by 8pm',
        body: 'Tracking #9405 5123 8746 0291 0042 18. Driver will leave at front porch and capture a photo. Signature not required.',
        actions: [
          { icon: 'map-pin', label: 'Track' },
          { icon: 'bell', label: 'Notify on drop' },
        ],
      },
      {
        accent: MB.certified, trust: 'verified', category: 'Certified',
        sender: 'City of Oakland · Planning',
        time: '1h',
        title: 'Notice of public hearing — 412 Elm St',
        body: 'Re: zoning variance ZA-2026-0188 (rear-yard setback). Hearing scheduled June 3, 2026 at 6:00 PM. Written comment accepted through May 30.',
        actions: [
          { icon: 'check', label: 'Acknowledge', primary: true },
          { icon: 'calendar-plus', label: 'Add to calendar' },
        ],
      },
    ],
  },
  {
    section: 'Yesterday',
    items: [
      {
        accent: MB.coupon, trust: 'partial', category: 'Coupon',
        sender: '4th & Market Bakery',
        time: '1d',
        title: '20% off your next dozen croissants',
        body: 'Show this at checkout. Valid through Sun May 17. Sender is address-verified but not identity-verified — Pantopus has not confirmed offer terms.',
        actions: [
          { icon: 'bookmark', label: 'Save' },
          { icon: 'eye-off', label: 'Mute sender' },
        ],
      },
      {
        accent: MB.community, trust: 'verified', category: 'Community',
        sender: 'Elm Park HOA',
        time: '1d',
        title: 'Saturday playground cleanup — 9 to 11am',
        body: 'Coffee + donuts at the gazebo. Bring gloves if you have them; we will have spares. RSVP by Friday so we can order enough food.',
        actions: [
          { icon: 'check-circle-2', label: 'RSVP', primary: true },
          { icon: 'users', label: '12 going' },
        ],
      },
      {
        accent: MB.booklet, trust: 'verified', category: 'Booklet',
        sender: 'League of Women Voters',
        time: '2d',
        title: 'June primary voter guide — 28 pages',
        body: 'Candidate questionnaires, ballot measure breakdowns, polling place lookup. Pickup also available at the Elm Park branch library.',
        actions: [
          { icon: 'book-open', label: 'Open booklet', primary: true },
          { icon: 'download', label: 'Save PDF' },
        ],
      },
    ],
  },
];

const BIZ_COUNTER = [
  {
    section: 'Due this week',
    items: [
      {
        accent: MB.tax, trust: 'verified', category: 'Tax',
        sender: 'CA Dept of Tax & Fee Admin',
        time: '2d left',
        title: 'Q1 2026 sales tax filing due May 17',
        body: 'Estimated liability $1,840.12 based on connected POS. File on time to avoid the 10% penalty and 0.5%/mo interest accrual.',
        actions: [
          { icon: 'file-text', label: 'File now', primary: true },
          { icon: 'calculator', label: 'Review estimate' },
        ],
      },
      {
        accent: MB.legal, trust: 'verified', category: 'Statement',
        sender: 'CA Secretary of State',
        time: '5d left',
        title: 'Statement of Information (SI-100) renewal',
        body: 'Annual filing required to keep "Pantopus Bakery Co LLC" in good standing. $25 filing fee. Late filing triggers a $250 penalty.',
        actions: [
          { icon: 'file-check-2', label: 'File · $25', primary: true },
          { icon: 'help-circle', label: 'What is this?' },
        ],
      },
    ],
  },
  {
    section: 'Awaiting your response',
    items: [
      {
        accent: MB.contract, trust: 'verified', category: 'Contract',
        sender: 'Cornerstone Realty · via DocuSign',
        time: '3h',
        title: 'Lease addendum — 1248 Oak Ave, suite 2',
        body: 'Mariah Chen requests your signature on Rider 3 (HVAC cost share). Two signature fields and one initial. Counter-party signed May 13.',
        actions: [
          { icon: 'pen-line', label: 'Review & sign', primary: true },
          { icon: 'message-square', label: 'Ask question' },
        ],
      },
      {
        accent: MB.invoice, trust: 'verified', category: 'Invoice',
        sender: 'Riverside Linen Supply',
        time: '5h',
        title: 'Invoice #4821 — $642.50 net 30',
        body: 'Auto-pay is disabled for this vendor. Confirm before May 28 to keep your on-time discount of 2%. Itemized: 24 tablecloths, 96 napkins.',
        actions: [
          { icon: 'credit-card', label: 'Pay', primary: true },
          { icon: 'flag', label: 'Dispute' },
        ],
      },
      {
        accent: MB.notice, trust: 'partial', category: 'Service',
        sender: 'Verizon Business',
        time: 'Yesterday',
        title: 'Service migration — install window required',
        body: 'Your line transitions from copper to fiber on June 4. Pick a 2-hour install window. Service will be down for ~45 min during the swap.',
        actions: [
          { icon: 'calendar', label: 'Schedule', primary: true },
          { icon: 'phone', label: 'Call rep' },
        ],
      },
    ],
  },
];

// ── Main screen ────────────────────────────────────────────
function MailboxScreen({ drawer, tab, mode = 'list', dataLabel }) {
  const data = drawer === 'me' ? ME_INCOMING
             : drawer === 'biz' ? BIZ_COUNTER
             : null;

  return (
    <div data-screen-label={dataLabel} style={{
      width: '100%', height: '100%',
      background: 'var(--app-bg)',
      display: 'flex', flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
      paddingTop: 54,
    }}>
      <TopBar />
      <DrawerRow active={drawer} />
      <TabRow active={tab} />

      {/* scrollable content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '14px 16px 110px',
      }}>
        {mode === 'empty' ? (
          <EmptyEarn />
        ) : (
          data && data.map((group, gi) => (
            <div key={gi} style={{ marginBottom: 16 }}>
              <SectionLabel text={group.section} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {group.items.map((item, ii) => <MailCard key={ii} {...item} />)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* FAB */}
      {mode !== 'empty' && (
        <div style={{
          position: 'absolute',
          right: 16,
          bottom: 92,
          width: 56, height: 56,
          borderRadius: 9999,
          background: 'var(--color-primary-600)',
          color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 20px rgba(2,132,199,0.35), 0 2px 6px rgba(2,132,199,0.2)',
          zIndex: 5,
        }}>
          <i data-lucide="scan-line" style={{ width: 22, height: 22 }}></i>
        </div>
      )}

      <BottomTabBar active="mail" />
    </div>
  );
}

function EmptyEarn() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      paddingTop: 80,
      paddingLeft: 16,
      paddingRight: 16,
    }}>
      <div style={{
        width: 96, height: 96,
        borderRadius: '50%',
        background: 'var(--color-primary-50)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20,
        border: '1px solid var(--color-primary-100)',
      }}>
        <i data-lucide="circle-dollar-sign" style={{
          width: 44, height: 44, color: 'var(--color-primary-600)',
        }}></i>
      </div>
      <div style={{
        fontSize: 19,
        fontWeight: 700,
        letterSpacing: '-0.015em',
        color: 'var(--fg1)',
        marginBottom: 6,
      }}>No earn items yet</div>
      <div style={{
        fontSize: 13,
        color: 'var(--fg3)',
        lineHeight: 1.5,
        maxWidth: 260,
        marginBottom: 22,
      }}>Complete gigs to see payouts, 1099s, and tax docs land here automatically.</div>

      <button style={{
        background: 'var(--color-primary-600)',
        color: '#fff',
        border: 'none',
        padding: '12px 22px',
        borderRadius: 12,
        fontSize: 14,
        fontWeight: 700,
        letterSpacing: '-0.005em',
        boxShadow: 'var(--shadow-primary)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
      }}>
        Browse gigs
        <i data-lucide="arrow-right" style={{ width: 15, height: 15 }}></i>
      </button>

      {/* hint row */}
      <div style={{
        marginTop: 36,
        background: '#fff',
        border: '1px solid var(--app-border)',
        borderRadius: 14,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        textAlign: 'left',
        width: '100%',
        maxWidth: 320,
      }}>
        <div style={{
          width: 28, height: 28, flexShrink: 0,
          borderRadius: 8,
          background: 'var(--color-info-bg)',
          color: 'var(--color-primary-700)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i data-lucide="info" style={{ width: 15, height: 15 }}></i>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg1)', marginBottom: 2 }}>
            Lands here automatically
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--fg3)', lineHeight: 1.5 }}>
            Payouts, year-end 1099s, and reimbursement receipts are routed to Earn — no setup needed once you accept your first gig.
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  MailboxScreen,
  TrustChip,
  CategoryChip,
  BottomTabBar,
  MB,
});
