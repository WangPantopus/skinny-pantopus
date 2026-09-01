// A10.1 — Home (src/app/homes/[id]/index.tsx)
// Archetype: A10 — Detail: Content · variant: home_hero + grid_tabs + fab_create
// Two frames: populated + empty

const D = {
  primary50:  '#f0f9ff',
  primary100: '#e0f2fe',
  primary200: '#bae6fd',
  primary500: '#0ea5e9',
  primary600: '#0284c7',
  primary700: '#0369a1',
  primary800: '#075985',
  primary900: '#0c4a6e',
  bg:      '#f6f7f9',
  surface: '#ffffff',
  sunken:  '#f3f4f6',
  border:  '#e5e7eb',
  borderStrong: '#d1d5db',
  borderSub: '#f3f4f6',
  fg1: '#111827',
  fg2: '#374151',
  fg3: '#6b7280',
  fg4: '#9ca3af',
  successBg: '#d1fae5',
  success600:'#059669',
  warningBg: '#fef3c7',
  warning600:'#d97706',
  amberBg:   '#fef3c7',
  amber:     '#b45309',
  errorBg:   '#fee2e2',
  error600:  '#dc2626',
  personalBg:'#dbeafe',
  personal:  '#1d4ed8',
  homeBg:    '#dcfce7',
  home:      '#16a34a',
  bizBg:     '#ede9fe',
  biz:       '#6d28d9',
};

// ─── Phone shell ──────────────────────────────────────────────

function SB() {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '16px 28px 0', height: 44, boxSizing: 'border-box',
      fontFamily: '-apple-system, system-ui', fontWeight: 600, fontSize: 15, color: D.fg1,
    }}>
      <span>9:41</span>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={D.fg1}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={D.fg1}/><rect x="9" y="2" width="3" height="9" rx="0.6" fill={D.fg1}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={D.fg1}/></svg>
        <svg width="15" height="11" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={D.fg1}/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={D.fg1}/><circle cx="7.5" cy="9" r="1.3" fill={D.fg1}/></svg>
        <svg width="24" height="11" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={D.fg1} strokeOpacity="0.35" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill={D.fg1}/><path d="M22.5 3.8v3.4c.6-.2 1-.8 1-1.7s-.4-1.5-1-1.7z" fill={D.fg1} fillOpacity="0.4"/></svg>
      </div>
    </div>
  );
}

function Phone({ children }) {
  return (
    <div style={{
      width: 360, height: 740, borderRadius: 46, padding: 10,
      background: '#0b0f17',
      boxShadow: '0 40px 80px rgba(17,24,39,0.22), 0 0 0 1px rgba(0,0,0,0.14)',
    }}>
      <div style={{
        width: '100%', height: '100%', background: D.bg,
        borderRadius: 36, overflow: 'hidden', position: 'relative',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          position: 'absolute', top: 9, left: '50%', transform: 'translateX(-50%)',
          width: 108, height: 30, borderRadius: 20, background: '#000', zIndex: 50,
        }} />
        <SB />
        {children}
        <div style={{
          position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)',
          width: 120, height: 4, borderRadius: 4, background: 'rgba(0,0,0,0.25)',
          zIndex: 60,
        }} />
      </div>
    </div>
  );
}

function TopBar({ centerNode }) {
  const Btn = ({ icon }) => (
    <button style={{
      width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'transparent', border: 'none', cursor: 'pointer', color: D.fg1, padding: 0,
      borderRadius: 8,
    }}>
      <i data-lucide={icon} style={{ width: 20, height: 20 }} />
    </button>
  );
  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '4px 8px',
      height: 48, boxSizing: 'border-box',
      background: D.surface, borderBottom: `1px solid ${D.border}`,
      flexShrink: 0, zIndex: 5,
    }}>
      <Btn icon="chevron-left" />
      <div style={{
        flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600,
        color: D.fg1, letterSpacing: -0.15,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        padding: '0 4px',
      }}>
        {centerNode}
      </div>
      <Btn icon="settings" />
    </div>
  );
}

function UnifiedFAB() {
  return (
    <div style={{
      position: 'absolute', right: 18, bottom: 24, zIndex: 15,
      width: 56, height: 56, borderRadius: '50%',
      background: D.primary600, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 10px 24px rgba(2,132,199,0.45), 0 2px 6px rgba(2,132,199,0.2)',
      border: `3px solid ${D.surface}`, boxSizing: 'border-box',
    }}>
      <i data-lucide="plus" style={{ width: 22, height: 22, strokeWidth: 2.4 }} />
    </div>
  );
}

function Avatar({ size, initials, bg }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700,
      fontSize: size >= 40 ? 15 : size >= 32 ? 12 : 10,
      flexShrink: 0,
    }}>{initials}</div>
  );
}

// ─── Hero (home_hero) ─────────────────────────────────────────

function HomeStatCell({ value, label, last, dim }) {
  return (
    <div style={{
      flex: 1, paddingRight: last ? 0 : 10,
      borderRight: last ? 'none' : '1px solid rgba(255,255,255,0.2)',
      marginRight: last ? 0 : 10,
    }}>
      <div style={{
        fontSize: 20, fontWeight: 700,
        color: dim ? 'rgba(255,255,255,0.55)' : '#fff',
        letterSpacing: -0.4, lineHeight: '24px',
      }}>{value}</div>
      <div style={{
        fontSize: 9.5, color: 'rgba(255,255,255,0.75)', marginTop: 3,
        textTransform: 'uppercase', letterSpacing: 0.06, fontWeight: 600,
      }}>{label}</div>
    </div>
  );
}

function HomeHero({ address, locality, members, stats }) {
  return (
    <div style={{ padding: '12px 16px 0' }}>
      <div style={{
        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 60%, #0c4a6e 100%)',
        borderRadius: 18, padding: 16, color: '#fff',
        boxShadow: '0 10px 24px rgba(2,132,199,0.25)', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', right: -40, top: -30, width: 160, height: 160, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 60%)',
        }} />
        <div style={{
          position: 'absolute', left: -20, bottom: -60, width: 140, height: 140, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(186,230,253,0.2) 0%, transparent 60%)',
        }} />

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 8px', borderRadius: 9999,
          background: 'rgba(255,255,255,0.18)',
          fontSize: 9.5, fontWeight: 700, letterSpacing: 0.08,
          textTransform: 'uppercase', position: 'relative',
        }}>
          <i data-lucide="shield-check" style={{ width: 10, height: 10 }} />
          Verified home
        </div>
        <div style={{
          fontSize: 20, fontWeight: 700, letterSpacing: -0.3,
          marginTop: 10, position: 'relative', lineHeight: '24px',
        }}>{address}</div>
        <div style={{
          fontSize: 11.5, color: 'rgba(255,255,255,0.8)', marginTop: 2,
          position: 'relative',
        }}>{locality} · {members}</div>

        <div style={{ display: 'flex', marginTop: 16, position: 'relative' }}>
          {stats.map((s, i) => (
            <HomeStatCell
              key={s.label}
              value={s.value}
              label={s.label}
              dim={s.dim}
              last={i === stats.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── grid_tabs body ───────────────────────────────────────────

function QuickAction({ icon, label, count, color, bg, muted }) {
  return (
    <button style={{
      flex: 1, background: D.surface, border: `1px solid ${D.border}`,
      borderRadius: 12, padding: '10px 4px', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      position: 'relative', opacity: muted ? 0.72 : 1,
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8,
        background: muted ? D.sunken : bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: muted ? D.fg4 : color,
      }}>
        <i data-lucide={icon} style={{ width: 16, height: 16, strokeWidth: 2 }} />
      </div>
      <div style={{
        fontSize: 10.5, fontWeight: 600,
        color: muted ? D.fg3 : D.fg1, letterSpacing: -0.05,
      }}>{label}</div>
      {count && (
        <span style={{
          position: 'absolute', top: 6, right: 8,
          minWidth: 16, height: 16, padding: '0 4px', borderRadius: 9999,
          background: D.error600, color: '#fff',
          fontSize: 9.5, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>{count}</span>
      )}
    </button>
  );
}

function TabStrip({ tabs }) {
  return (
    <div style={{
      display: 'flex', marginTop: 18, padding: '0 16px',
      gap: 20, borderBottom: `1px solid ${D.border}`,
      overflowX: 'auto', scrollbarWidth: 'none',
    }}>
      {tabs.map((t, i) => (
        <button key={t} style={{
          background: 'transparent', border: 'none', padding: '10px 0',
          borderBottom: i === 0 ? `2px solid ${D.primary600}` : '2px solid transparent',
          color: i === 0 ? D.primary700 : D.fg3,
          fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
          marginBottom: -1, whiteSpace: 'nowrap', flexShrink: 0,
          letterSpacing: -0.1,
        }}>{t}</button>
      ))}
    </div>
  );
}

function SectionCard({ title, action, children, accent }) {
  return (
    <div style={{
      background: D.surface, border: `1px solid ${D.border}`, borderRadius: 14,
      overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px 4px',
      }}>
        <div style={{
          fontSize: 10.5, fontWeight: 600, color: D.fg3,
          letterSpacing: 0.08, textTransform: 'uppercase',
          display: 'inline-flex', alignItems: 'center', gap: 5,
        }}>
          {accent && <span style={{ width: 6, height: 6, borderRadius: 9999, background: accent }} />}
          {title}
        </div>
        {action && (
          <button style={{
            background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
            color: D.primary600, fontSize: 11, fontWeight: 600,
          }}>{action}</button>
        )}
      </div>
      {children}
    </div>
  );
}

function UpcomingRow({ icon, color, bg, title, when, meta, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px',
      borderBottom: last ? 'none' : `1px solid ${D.borderSub}`,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, background: bg, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <i data-lucide={icon} style={{ width: 15, height: 15 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: D.fg1, letterSpacing: -0.1 }}>{title}</div>
        <div style={{ fontSize: 10.5, color: D.fg3, marginTop: 1 }}>{meta}</div>
      </div>
      <div style={{ fontSize: 10.5, color: D.fg3, fontWeight: 500, flexShrink: 0 }}>{when}</div>
    </div>
  );
}

function ActivityRow({ avatar, name, action, time, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px',
      borderBottom: last ? 'none' : `1px solid ${D.borderSub}`,
    }}>
      <Avatar size={28} initials={avatar.initials} bg={avatar.bg} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: D.fg2, lineHeight: '16px' }}>
          <span style={{ fontWeight: 600, color: D.fg1 }}>{name}</span>{' '}{action}
        </div>
        <div style={{ fontSize: 10, color: D.fg4, marginTop: 2 }}>{time}</div>
      </div>
    </div>
  );
}

// ─── Setup row (empty state) ──────────────────────────────────

function SetupRow({ icon, color, bg, title, body, cta, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      borderBottom: last ? 'none' : `1px solid ${D.borderSub}`,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, background: bg, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <i data-lucide={icon} style={{ width: 17, height: 17 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: D.fg1, letterSpacing: -0.1 }}>{title}</div>
        <div style={{ fontSize: 11, color: D.fg3, marginTop: 1, lineHeight: '15px' }}>{body}</div>
      </div>
      <button style={{
        height: 28, padding: '0 10px', borderRadius: 8,
        background: D.primary50, border: `1px solid ${D.primary100}`,
        color: D.primary700, fontSize: 11, fontWeight: 600,
        cursor: 'pointer', flexShrink: 0,
      }}>{cta}</button>
    </div>
  );
}

// ─── FRAMES ───────────────────────────────────────────────────

const TABS = ['Overview', 'Tasks', 'Bills', 'Packages', 'Members', 'Ownership'];

function HomeAddressTitle() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <i data-lucide="home" style={{ width: 13, height: 13, color: D.fg3 }} />
      412 Elm St
    </span>
  );
}

function FrameHomePopulated() {
  return (
    <Phone>
      <TopBar centerNode={<HomeAddressTitle />} />
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 100 }}>
        <HomeHero
          address="412 Elm St, Apt 3B"
          locality="Elm Park, NY 10013"
          members="3 members"
          stats={[
            { value: '4', label: 'Packages' },
            { value: '2', label: 'Access codes' },
            { value: '7', label: 'Tasks' },
          ]}
        />

        <div style={{ padding: '14px 16px 0', display: 'flex', gap: 8 }}>
          <QuickAction icon="check-square" label="Tasks"    count="7" color={D.amber}    bg={D.amberBg} />
          <QuickAction icon="receipt"      label="Bills"               color={D.error600} bg={D.errorBg} />
          <QuickAction icon="package"      label="Packages" count="4" color={D.biz}      bg={D.bizBg} />
          <QuickAction icon="users"        label="Members"             color={D.home}     bg={D.homeBg} />
        </div>

        <TabStrip tabs={TABS} />

        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionCard title="Upcoming" action="See all" accent={D.amber}>
            <UpcomingRow
              icon="droplet" color={D.personal} bg={D.personalBg}
              title="Plumber — kitchen sink"
              meta="Jorge · Elm St Plumbing"
              when="Today · 4pm"
            />
            <UpcomingRow
              icon="receipt" color={D.error600} bg={D.errorBg}
              title="ConEd bill due"
              meta="$142.80 · split 3 ways"
              when="Fri"
            />
            <UpcomingRow
              icon="package" color={D.biz} bg={D.bizBg}
              title="Amazon — waiting pickup"
              meta="4 packages · building lobby"
              when="—"
              last
            />
          </SectionCard>

          <SectionCard title="Recent activity" action="See all">
            <ActivityRow
              avatar={{ initials: 'MK', bg: 'linear-gradient(135deg,#0ea5e9,#0369a1)' }}
              name="Maria"
              action={<>marked <span style={{ fontWeight: 600, color: D.fg1 }}>"Take out trash"</span> done</>}
              time="18m ago"
            />
            <ActivityRow
              avatar={{ initials: 'AK', bg: 'linear-gradient(135deg,#16a34a,#15803d)' }}
              name="Alex"
              action={<>logged a new package from <span style={{ fontWeight: 600, color: D.fg1 }}>Uniqlo</span></>}
              time="2h ago"
              last
            />
          </SectionCard>

          <SectionCard title="Emergency info" accent={D.error600}>
            <div style={{
              padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: D.errorBg, color: D.error600,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i data-lucide="siren" style={{ width: 15, height: 15 }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: D.fg2 }}>
                  Tap to access <span style={{ fontWeight: 600, color: D.fg1 }}>shut-off valves</span>, landlord contacts, insurance.
                </div>
              </div>
              <i data-lucide="chevron-right" style={{ width: 16, height: 16, color: D.fg4 }} />
            </div>
          </SectionCard>
        </div>
      </div>
      <UnifiedFAB />
    </Phone>
  );
}

function FrameHomeEmpty() {
  return (
    <Phone>
      <TopBar centerNode={<HomeAddressTitle />} />
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 100 }}>
        <HomeHero
          address="412 Elm St, Apt 3B"
          locality="Elm Park, NY 10013"
          members="Just you"
          stats={[
            { value: '0', label: 'Packages', dim: true },
            { value: '0', label: 'Access codes', dim: true },
            { value: '0', label: 'Tasks', dim: true },
          ]}
        />

        <div style={{ padding: '14px 16px 0', display: 'flex', gap: 8 }}>
          <QuickAction icon="check-square" label="Tasks"    muted />
          <QuickAction icon="receipt"      label="Bills"    muted />
          <QuickAction icon="package"      label="Packages" muted />
          <QuickAction icon="users"        label="Members"  muted />
        </div>

        <TabStrip tabs={TABS} />

        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Welcome empty state */}
          <div style={{
            background: D.surface, border: `1px solid ${D.border}`, borderRadius: 16,
            padding: '20px 18px 8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'linear-gradient(135deg, #dcfce7 0%, #bae6fd 100%)',
              color: D.home,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 12,
            }}>
              <i data-lucide="party-popper" style={{ width: 22, height: 22, strokeWidth: 2 }} />
            </div>
            <div style={{
              fontSize: 17, fontWeight: 700, color: D.fg1,
              letterSpacing: -0.25, lineHeight: '22px', marginBottom: 4,
            }}>Welcome home</div>
            <div style={{
              fontSize: 13, color: D.fg3, lineHeight: '19px', marginBottom: 14,
            }}>
              Set up packages, bills, or members to get started.
            </div>

            <div style={{ margin: '0 -18px' }}>
              <div style={{ borderTop: `1px solid ${D.borderSub}` }} />
              <SetupRow
                icon="package" color={D.biz} bg={D.bizBg}
                title="Track packages"
                body="Get a lobby pin and never lose another delivery."
                cta="Set up"
              />
              <SetupRow
                icon="receipt" color={D.error600} bg={D.errorBg}
                title="Add a bill"
                body="Split rent, ConEd, internet — auto-remind everyone."
                cta="Add"
              />
              <SetupRow
                icon="users" color={D.home} bg={D.homeBg}
                title="Invite household"
                body="Roommates, family, or anyone with a key."
                cta="Invite"
                last
              />
            </div>
          </div>

          <SectionCard title="Emergency info" accent={D.error600}>
            <div style={{
              padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: D.sunken, color: D.fg4,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i data-lucide="siren" style={{ width: 15, height: 15 }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: D.fg3 }}>
                  Add shut-off valves, landlord contacts, insurance — for when it matters.
                </div>
              </div>
              <i data-lucide="chevron-right" style={{ width: 16, height: 16, color: D.fg4 }} />
            </div>
          </SectionCard>
        </div>
      </div>
      <UnifiedFAB />
    </Phone>
  );
}

// ─── Alert / "Needs attention" secondary state ───────────────

function AttentionBanner({ items }) {
  return (
    <div style={{
      background: D.surface, border: `1px solid ${D.error600}30`,
      borderRadius: 14, overflow: 'hidden',
      boxShadow: '0 4px 14px rgba(220,38,38,0.10), 0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px 6px',
        background: '#fef2f2',
        borderBottom: `1px solid ${D.errorBg}`,
      }}>
        <i data-lucide="alert-triangle" style={{ width: 13, height: 13, color: D.error600 }} />
        <div style={{
          fontSize: 10.5, fontWeight: 700, color: D.error600,
          letterSpacing: 0.08, textTransform: 'uppercase',
        }}>Needs attention · {items.length}</div>
      </div>
      {items.map((it, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px',
          borderBottom: i === items.length - 1 ? 'none' : `1px solid ${D.borderSub}`,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: it.bg, color: it.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <i data-lucide={it.icon} style={{ width: 15, height: 15 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: D.fg1, letterSpacing: -0.1 }}>{it.title}</div>
            <div style={{ fontSize: 10.5, color: D.fg3, marginTop: 1 }}>{it.meta}</div>
          </div>
          <button style={{
            height: 28, padding: '0 10px', borderRadius: 8,
            background: it.color, border: 'none',
            color: '#fff', fontSize: 11, fontWeight: 600,
            cursor: 'pointer', flexShrink: 0,
          }}>{it.cta}</button>
        </div>
      ))}
    </div>
  );
}

function FrameHomeAlert() {
  return (
    <Phone>
      <TopBar centerNode={<HomeAddressTitle />} />
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 100 }}>
        <HomeHero
          address="412 Elm St, Apt 3B"
          locality="Elm Park, NY 10013"
          members="3 members"
          stats={[
            { value: '4', label: 'Packages' },
            { value: '2', label: 'Access codes' },
            { value: '9', label: 'Tasks' },
          ]}
        />

        <div style={{ padding: '14px 16px 0', display: 'flex', gap: 8 }}>
          <QuickAction icon="check-square" label="Tasks"    count="9" color={D.amber}    bg={D.amberBg} />
          <QuickAction icon="receipt"      label="Bills"    count="2" color={D.error600} bg={D.errorBg} />
          <QuickAction icon="package"      label="Packages" count="4" color={D.biz}      bg={D.bizBg} />
          <QuickAction icon="users"        label="Members"            color={D.home}     bg={D.homeBg} />
        </div>

        <TabStrip tabs={TABS} />

        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <AttentionBanner items={[
            {
              icon: 'receipt', color: D.error600, bg: D.errorBg,
              title: 'ConEd bill overdue',
              meta: '$142.80 · 3 days late · split 3 ways',
              cta: 'Pay',
            },
            {
              icon: 'thermometer-snowflake', color: D.personal, bg: D.personalBg,
              title: 'Pipe freeze warning tonight',
              meta: 'NWS · drip taps in kitchen & bath',
              cta: 'Open',
            },
            {
              icon: 'key-round', color: D.warning600, bg: D.warningBg,
              title: 'Dog walker code expires Friday',
              meta: 'Rotate before 6pm or share new',
              cta: 'Rotate',
            },
          ]} />

          <SectionCard title="Upcoming" action="See all" accent={D.amber}>
            <UpcomingRow
              icon="droplet" color={D.personal} bg={D.personalBg}
              title="Plumber — kitchen sink"
              meta="Jorge · Elm St Plumbing"
              when="Today · 4pm"
            />
            <UpcomingRow
              icon="package" color={D.biz} bg={D.bizBg}
              title="Amazon — waiting pickup"
              meta="4 packages · building lobby"
              when="—"
              last
            />
          </SectionCard>

          <SectionCard title="Recent activity" action="See all">
            <ActivityRow
              avatar={{ initials: 'MK', bg: 'linear-gradient(135deg,#0ea5e9,#0369a1)' }}
              name="Maria"
              action={<>flagged the <span style={{ fontWeight: 600, color: D.fg1 }}>ConEd bill</span> as overdue</>}
              time="6m ago"
            />
            <ActivityRow
              avatar={{ initials: 'PA', bg: 'linear-gradient(135deg,#0ea5e9,#0369a1)' }}
              name="Pantopus"
              action={<>posted a freeze advisory for <span style={{ fontWeight: 600, color: D.fg1 }}>Elm Park</span></>}
              time="22m ago"
              last
            />
          </SectionCard>
        </div>
      </div>
      <UnifiedFAB />
    </Phone>
  );
}

Object.assign(window, { FrameHomePopulated, FrameHomeEmpty, FrameHomeAlert });
