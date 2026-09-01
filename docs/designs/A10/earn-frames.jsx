// A10.11 — Earn (src/app/mailbox/earn.tsx)
// Archetype: A10 — Detail: Content · variant: content detail (body + actions)
// Earn drawer dashboard. Two frames: populated (active earner) + empty (new, no earnings).
// Sibling of A10.10 Wallet — shares the dark balance hero vocabulary, but framed around
// MAKING money: weekly goal momentum, ways to earn, earnings list, payout settings, tax docs.

const E = {
  primary50:  '#f0f9ff',
  primary100: '#e0f2fe',
  primary200: '#bae6fd',
  primary400: '#38bdf8',
  primary500: '#0ea5e9',
  primary600: '#0284c7',
  primary700: '#0369a1',
  primary800: '#075985',
  primary900: '#0c4a6e',
  bg:      '#f6f7f9',
  surface: '#ffffff',
  sunken:  '#f3f4f6',
  border:  '#e5e7eb',
  borderSub: '#f3f4f6',
  fg1: '#111827',
  fg2: '#374151',
  fg3: '#6b7280',
  fg4: '#9ca3af',
  success600:'#059669',
  success700:'#047857',
  successBg: '#d1fae5',
  successSoft:'#ecfdf5',
  warning600:'#d97706',
  warningBg: '#fef3c7',
  amberDeep: '#92400e',
  homeBg:    '#dcfce7',
  home:      '#16a34a',
  homeDeep:  '#15803d',
};

// ─── Phone shell ──────────────────────────────────────────────

function EStatusBar() {
  const c = E.fg1;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '16px 28px 0', height: 44, boxSizing: 'border-box',
      fontFamily: '-apple-system, system-ui', fontWeight: 600, fontSize: 15, color: c,
    }}>
      <span>9:41</span>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={c}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={c}/><rect x="9" y="2" width="3" height="9" rx="0.6" fill={c}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={c}/></svg>
        <svg width="15" height="11" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={c}/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={c}/><circle cx="7.5" cy="9" r="1.3" fill={c}/></svg>
        <svg width="24" height="11" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={c} strokeOpacity="0.4" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill={c}/><path d="M22.5 3.8v3.4c.6-.2 1-.8 1-1.7s-.4-1.5-1-1.7z" fill={c} fillOpacity="0.4"/></svg>
      </div>
    </div>
  );
}

function EPhone({ children }) {
  return (
    <div style={{
      width: 360, height: 740, borderRadius: 46, padding: 10,
      background: '#0b0f17',
      boxShadow: '0 40px 80px rgba(17,24,39,0.22), 0 0 0 1px rgba(0,0,0,0.14)',
    }}>
      <div style={{
        width: '100%', height: '100%', background: E.bg,
        borderRadius: 36, overflow: 'hidden', position: 'relative',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          position: 'absolute', top: 9, left: '50%', transform: 'translateX(-50%)',
          width: 108, height: 30, borderRadius: 20, background: '#000', zIndex: 50,
        }} />
        <EStatusBar />
        {children}
        <div style={{
          position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)',
          width: 120, height: 4, borderRadius: 4, background: 'rgba(0,0,0,0.25)', zIndex: 60,
        }} />
      </div>
    </div>
  );
}

function ETopBar() {
  const Btn = ({ icon }) => (
    <button style={{
      width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'transparent', border: 'none', cursor: 'pointer', color: E.fg1, padding: 0, borderRadius: 8,
    }}>
      <i data-lucide={icon} style={{ width: 20, height: 20 }} />
    </button>
  );
  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '4px 8px', height: 48, boxSizing: 'border-box',
      background: E.surface, borderBottom: `1px solid ${E.border}`, flexShrink: 0, zIndex: 5,
    }}>
      <Btn icon="chevron-left" />
      <div style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600, color: E.fg1, letterSpacing: -0.15 }}>Earn</div>
      <Btn icon="circle-help" />
    </div>
  );
}

function EOverline({ children, action }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      marginTop: 16, marginBottom: 8,
    }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: 0.08,
        textTransform: 'uppercase', color: E.fg3,
      }}>{children}</div>
      {action && (
        <button style={{
          background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
          fontSize: 11.5, color: E.primary600, fontWeight: 600,
        }}>{action}</button>
      )}
    </div>
  );
}

// ─── Balance hero (with weekly-goal momentum) ────────────────

function EarnHero({ available, thisWeek, lifetime, lifetimeTasks, goal, empty }) {
  const pct = goal > 0 ? Math.min(100, Math.round((thisWeek / goal) * 100)) : 0;
  return (
    <div style={{
      position: 'relative', borderRadius: 18, overflow: 'hidden',
      background: `linear-gradient(155deg, ${E.primary800} 0%, ${E.primary700} 55%, ${E.primary600} 100%)`,
      boxShadow: '0 10px 24px rgba(2, 132, 199, 0.28)', color: '#fff', padding: '16px 18px 16px',
    }}>
      <svg width="200" height="200" viewBox="0 0 200 200" style={{ position: 'absolute', right: -40, top: -50, opacity: 0.18, pointerEvents: 'none' }}>
        <circle cx="100" cy="100" r="90" stroke="#fff" strokeWidth="1" fill="none" />
        <circle cx="100" cy="100" r="60" stroke="#fff" strokeWidth="1" fill="none" />
        <circle cx="100" cy="100" r="30" stroke="#fff" strokeWidth="1" fill="none" />
      </svg>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.1, textTransform: 'uppercase', color: '#bae6fd' }}>
          Available to cash out
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px 3px 6px', borderRadius: 9999,
          background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(8px)',
          fontSize: 10, fontWeight: 700, letterSpacing: 0.04, textTransform: 'uppercase', color: '#fff',
        }}>
          <i data-lucide="shield-check" style={{ width: 10, height: 10, strokeWidth: 2.5 }} /> USD
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
        <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4, color: '#bae6fd', alignSelf: 'flex-start', marginTop: 8 }}>$</span>
        <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1.4, color: '#fff', lineHeight: 1 }}>
          {available.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

      {/* glass: this week / lifetime + weekly goal bar */}
      <div style={{
        marginTop: 14, padding: '11px 13px',
        background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.14)', borderRadius: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          <div style={{ flex: 1, paddingRight: 12 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.06, textTransform: 'uppercase', color: '#bae6fd', opacity: 0.85, display: 'flex', alignItems: 'center', gap: 4 }}>
              <i data-lucide="calendar" style={{ width: 10, height: 10, strokeWidth: 2.5 }} /> This week
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: -0.25, marginTop: 2 }}>
              ${thisWeek.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.16)' }} />
          <div style={{ flex: 1, paddingLeft: 12 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.06, textTransform: 'uppercase', color: '#bae6fd', opacity: 0.85, display: 'flex', alignItems: 'center', gap: 4 }}>
              <i data-lucide="trending-up" style={{ width: 10, height: 10, strokeWidth: 2.5 }} /> Lifetime
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: -0.25, marginTop: 2 }}>
              ${lifetime.toLocaleString('en-US')}
            </div>
            <div style={{ fontSize: 10, color: '#bae6fd', opacity: 0.8, marginTop: 1 }}>{lifetimeTasks} tasks</div>
          </div>
        </div>

        {/* weekly goal progress */}
        <div style={{ marginTop: 11, paddingTop: 11, borderTop: '1px solid rgba(255,255,255,0.14)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: '#e0f2fe' }}>
              {empty ? 'Set a weekly goal' : `${pct}% to your $${goal} weekly goal`}
            </span>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#fff' }}>
              {empty ? '—' : `$${(goal - thisWeek).toFixed(0)} to go`}
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.18)', overflow: 'hidden' }}>
            <div style={{
              width: `${pct}%`, height: '100%', borderRadius: 4,
              background: 'linear-gradient(90deg, #5eead4, #34d399)',
            }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Ways to earn ────────────────────────────────────────────

function WaysToEarn() {
  const rows = [
    { featured: true, icon: 'search', title: 'Browse open tasks', meta: '28 near you · up to $140 today', accent: E.primary600 },
    { icon: 'gift', title: 'Refer a neighbor', meta: '+$10 when they finish a task', accent: E.home },
    { icon: 'store', title: 'Offer a service', meta: 'Get matched to repeat clients', accent: '#7c3aed' },
  ];
  return (
    <div style={{
      background: E.surface, border: `1px solid ${E.border}`, borderRadius: 14, overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
    }}>
      {rows.map((r, i) => (
        <div key={r.title} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer',
          background: r.featured ? E.primary50 : E.surface,
          borderBottom: i < rows.length - 1 ? `1px solid ${E.borderSub}` : 'none',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: r.featured ? E.primary600 : E.sunken,
            color: r.featured ? '#fff' : r.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i data-lucide={r.icon} style={{ width: 17, height: 17, strokeWidth: 2 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: E.fg1, letterSpacing: -0.1 }}>{r.title}</div>
            <div style={{ fontSize: 11, color: r.featured ? E.primary700 : E.fg3, marginTop: 1, fontWeight: r.featured ? 600 : 400 }}>{r.meta}</div>
          </div>
          <i data-lucide="chevron-right" style={{ width: 16, height: 16, color: E.fg4, flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}

// ─── Earnings list ───────────────────────────────────────────

const CAT_BG = { cleaning: '#dcfce7', 'child-care': '#fef3c7', handyman: '#ffedd5', 'pet-care': '#fee2e2', moving: '#ede9fe' };
const CAT_FG = { cleaning: '#15803d', 'child-care': '#92400e', handyman: '#9a3412', 'pet-care': '#b91c1c', moving: '#6d28d9' };
const CAT_ICON = { cleaning: 'sparkles', 'child-care': 'baby', handyman: 'wrench', 'pet-care': 'dog', moving: 'box' };

const EARNINGS = [
  { day: 'Today',     when: '2:14 pm',  amt: 140.00, who: 'Marcus P.',       desc: 'Patio cleanup · 3 hr', cat: 'cleaning',   status: 'paid' },
  { day: 'Yesterday', when: '6:40 pm',  amt:  41.00, who: 'Tom B.',          desc: 'Dog walk · 4 visits',  cat: 'pet-care',   status: 'paid' },
  { day: 'Dec 1',     when: '11:14 am', amt: 120.00, who: 'Reyes household', desc: 'IKEA assembly',        cat: 'handyman',   status: 'paid' },
  { day: 'Nov 29',    when: '8:31 pm',  amt:  60.00, who: 'The Hahns',       desc: 'Babysitting · 3 hr',   cat: 'child-care', status: 'pending', clears: 'Dec 3' },
];

function EarnRow({ e, last }) {
  const isPending = e.status === 'pending';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
      borderBottom: last ? 'none' : `1px solid ${E.borderSub}`,
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
        background: CAT_BG[e.cat] || E.sunken, color: CAT_FG[e.cat] || E.fg2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <i data-lucide={CAT_ICON[e.cat] || 'circle'} style={{ width: 16, height: 16, strokeWidth: 2 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: E.fg1, letterSpacing: -0.1 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.desc}</span>
          {isPending && (
            <span style={{ padding: '1px 6px', borderRadius: 9999, background: E.warningBg, color: E.amberDeep, fontSize: 9, fontWeight: 700, letterSpacing: 0.04, textTransform: 'uppercase' }}>Pending</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: E.fg3, marginTop: 1 }}>
          {e.who} · {e.when}{isPending ? ` · clears ${e.clears}` : ''}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: -0.2, color: isPending ? E.amberDeep : E.success700 }}>
          +${e.amt.toFixed(2)}
        </div>
        <div style={{ fontSize: 10, color: E.fg4, marginTop: 1 }}>{isPending ? 'On hold' : 'Paid'}</div>
      </div>
    </div>
  );
}

function EarningsList({ items }) {
  return (
    <div style={{ background: E.surface, border: `1px solid ${E.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
      {items.map((e, i) => (
        <React.Fragment key={i}>
          {(i === 0 || items[i - 1].day !== e.day) && (
            <div style={{
              padding: '8px 14px 4px', fontSize: 9.5, fontWeight: 700, letterSpacing: 0.08,
              textTransform: 'uppercase', color: E.fg4,
              borderTop: i === 0 ? 'none' : `1px solid ${E.borderSub}`,
            }}>{e.day}</div>
          )}
          <EarnRow e={e} last={i === items.length - 1} />
        </React.Fragment>
      ))}
    </div>
  );
}

function EmptyEarnings() {
  return (
    <div style={{
      background: E.surface, border: `1px dashed ${E.border}`, borderRadius: 14,
      padding: '26px 20px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
    }}>
      <div style={{
        width: 50, height: 50, borderRadius: 15, background: E.primary50, color: E.primary600,
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 11,
      }}>
        <i data-lucide="hand-coins" style={{ width: 24, height: 24, strokeWidth: 1.8 }} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: E.fg1, letterSpacing: -0.2, marginBottom: 4 }}>
        Start earning by completing tasks
      </div>
      <div style={{ fontSize: 12, color: E.fg3, lineHeight: '17px', maxWidth: 244 }}>
        Your paid tasks land here. The first cleared payment unlocks cash out to your bank.
      </div>
    </div>
  );
}

// ─── Payout settings ─────────────────────────────────────────

function Toggle({ on }) {
  return (
    <div style={{
      width: 38, height: 23, borderRadius: 9999, flexShrink: 0,
      background: on ? E.success600 : E.border, position: 'relative', transition: 'background .15s',
    }}>
      <div style={{
        position: 'absolute', top: 2, left: on ? 17 : 2, width: 19, height: 19, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
      }} />
    </div>
  );
}

function PayoutSettings() {
  return (
    <div style={{ background: E.surface, border: `1px solid ${E.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${E.borderSub}` }}>
        <div style={{
          width: 44, height: 30, borderRadius: 6, flexShrink: 0,
          background: 'linear-gradient(135deg, #1e3a8a, #2563eb)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)',
        }}>
          <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 0.06, color: '#fff' }}>CHASE</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: E.fg1, letterSpacing: -0.1, display: 'flex', alignItems: 'center', gap: 6 }}>
            Chase checking
            <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: E.fg3, fontWeight: 600 }}>•••• 7421</span>
          </div>
          <div style={{ fontSize: 11, marginTop: 1, color: E.fg3, display: 'flex', alignItems: 'center', gap: 4 }}>
            <i data-lucide="zap" style={{ width: 11, height: 11, strokeWidth: 2.3, color: E.home }} /> Instant payout · 1–3 minutes
          </div>
        </div>
        <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 11.5, color: E.primary600, fontWeight: 600, padding: 4 }}>Manage</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: E.sunken, color: E.fg2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i data-lucide="repeat" style={{ width: 16, height: 16, strokeWidth: 2 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: E.fg1, letterSpacing: -0.1 }}>Auto cash out</div>
          <div style={{ fontSize: 11, color: E.fg3, marginTop: 1 }}>Every Friday · cleared balance</div>
        </div>
        <Toggle on />
      </div>
    </div>
  );
}

function PayoutEmpty() {
  return (
    <div style={{
      background: E.surface, border: `1px dashed ${E.border}`, borderRadius: 14,
      padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: E.sunken, color: E.fg3, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <i data-lucide="building-2" style={{ width: 17, height: 17, strokeWidth: 2 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: E.fg1, letterSpacing: -0.1 }}>Add a payout method</div>
        <div style={{ fontSize: 11, color: E.fg3, marginTop: 1 }}>Link a bank so you can cash out later</div>
      </div>
      <button style={{
        height: 30, padding: '0 12px', borderRadius: 8, background: E.primary50, color: E.primary700,
        border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 600,
      }}>Add bank</button>
    </div>
  );
}

// ─── Tax docs row ────────────────────────────────────────────

function TaxDocsRow() {
  return (
    <div style={{ background: E.surface, border: `1px solid ${E.border}`, borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: E.sunken, color: E.fg2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <i data-lucide="file-text" style={{ width: 17, height: 17, strokeWidth: 2 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: E.fg1, letterSpacing: -0.1 }}>Tax documents</div>
        <div style={{ fontSize: 11, color: E.fg3, marginTop: 1 }}>YTD earnings $4,920 · 1099 available mid-Jan</div>
      </div>
      <i data-lucide="chevron-right" style={{ width: 16, height: 16, color: E.fg4 }} />
    </div>
  );
}

// ─── Sticky bottom bar ───────────────────────────────────────

function EBottomBar({ children }) {
  return (
    <div style={{
      flexShrink: 0, padding: '10px 16px 20px',
      background: 'linear-gradient(180deg, rgba(246,247,249,0) 0%, rgba(246,247,249,0.92) 30%, #f6f7f9 60%)',
      borderTop: `1px solid ${E.borderSub}`, zIndex: 4,
    }}>{children}</div>
  );
}

function CashOutCTA({ amount }) {
  return (
    <button style={{
      width: '100%', height: 52, borderRadius: 14, border: 'none',
      background: E.primary600, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px',
      letterSpacing: -0.15, boxShadow: '0 6px 16px rgba(2,132,199,.28)',
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <i data-lucide="arrow-down-to-line" style={{ width: 17, height: 17 }} /> Cash out
      </span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </button>
  );
}

function BrowseCTA() {
  return (
    <div>
      <button style={{
        width: '100%', height: 52, borderRadius: 14, border: 'none',
        background: E.primary600, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        letterSpacing: -0.15, boxShadow: '0 6px 16px rgba(2,132,199,.28)',
      }}>
        <i data-lucide="search" style={{ width: 17, height: 17 }} /> Browse open tasks
      </button>
      <div style={{ marginTop: 7, textAlign: 'center', fontSize: 10.5, color: E.fg3, lineHeight: '14px' }}>
        Cash out unlocks after your first paid task.
      </div>
    </div>
  );
}

// ─── FRAME 1 — Populated (active earner) ─────────────────────

function FrameEarnPopulated() {
  return (
    <EPhone>
      <ETopBar />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px 8px' }}>
          <EarnHero available={312.40} thisWeek={148.00} lifetime={4920} lifetimeTasks={64} goal={200} />

          <EOverline action="Find work">Ways to earn</EOverline>
          <WaysToEarn />

          <EOverline action="See all">Recent earnings</EOverline>
          <EarningsList items={EARNINGS} />

          <EOverline>Payout settings</EOverline>
          <PayoutSettings />

          <EOverline>Taxes</EOverline>
          <TaxDocsRow />

          <div style={{ height: 12 }} />
        </div>
        <EBottomBar>
          <CashOutCTA amount={312.40} />
        </EBottomBar>
      </div>
    </EPhone>
  );
}

// ─── FRAME 2 — Empty (new, no earnings) ──────────────────────

function FrameEarnEmpty() {
  return (
    <EPhone>
      <ETopBar />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px 8px' }}>
          <EarnHero available={0} thisWeek={0} lifetime={0} lifetimeTasks={0} goal={200} empty />

          <EOverline action="Find work">Ways to earn</EOverline>
          <WaysToEarn />

          <EOverline>Recent earnings</EOverline>
          <EmptyEarnings />

          <EOverline>Payout settings</EOverline>
          <PayoutEmpty />

          <div style={{ height: 12 }} />
        </div>
        <EBottomBar>
          <BrowseCTA />
        </EBottomBar>
      </div>
    </EPhone>
  );
}

Object.assign(window, { FrameEarnPopulated, FrameEarnEmpty });
