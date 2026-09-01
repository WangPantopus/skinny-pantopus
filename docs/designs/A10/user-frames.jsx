// A10.5 — User profile (src/app/user/[id].tsx)
// Archetype: A10 — Detail: Content · variant: profile (header + stats + tabs)
// Two frames: populated (about + reviews & activity) + secondary (new verified neighbor)

const U = {
  primary50:  '#f0f9ff',
  primary100: '#e0f2fe',
  primary200: '#bae6fd',
  primary400: '#38bdf8',
  primary500: '#0ea5e9',
  primary600: '#0284c7',
  primary700: '#0369a1',
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
  successBg: '#d1fae5',
  warning600:'#d97706',
  warningBg: '#fef3c7',
  amber:     '#b45309',
  amberBg:   '#fef3c7',
  errorBg:   '#fee2e2',
  error600:  '#dc2626',
  personalBg:'#e0f2fe',
  personal:  '#0369a1',
  homeBg:    '#dcfce7',
  home:      '#16a34a',
  bizBg:     '#ede9fe',
  biz:       '#6d28d9',
  star:      '#f59e0b',
};

// ─── Phone shell ──────────────────────────────────────────────

function USB() {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '16px 28px 0', height: 44, boxSizing: 'border-box',
      fontFamily: '-apple-system, system-ui', fontWeight: 600, fontSize: 15, color: U.fg1,
    }}>
      <span>9:41</span>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={U.fg1}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={U.fg1}/><rect x="9" y="2" width="3" height="9" rx="0.6" fill={U.fg1}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={U.fg1}/></svg>
        <svg width="15" height="11" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={U.fg1}/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={U.fg1}/><circle cx="7.5" cy="9" r="1.3" fill={U.fg1}/></svg>
        <svg width="24" height="11" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={U.fg1} strokeOpacity="0.35" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill={U.fg1}/><path d="M22.5 3.8v3.4c.6-.2 1-.8 1-1.7s-.4-1.5-1-1.7z" fill={U.fg1} fillOpacity="0.4"/></svg>
      </div>
    </div>
  );
}

function UPhone({ children }) {
  return (
    <div style={{
      width: 360, height: 740, borderRadius: 46, padding: 10,
      background: '#0b0f17',
      boxShadow: '0 40px 80px rgba(17,24,39,0.22), 0 0 0 1px rgba(0,0,0,0.14)',
    }}>
      <div style={{
        width: '100%', height: '100%', background: U.bg,
        borderRadius: 36, overflow: 'hidden', position: 'relative',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          position: 'absolute', top: 9, left: '50%', transform: 'translateX(-50%)',
          width: 108, height: 30, borderRadius: 20, background: '#000', zIndex: 50,
        }} />
        <USB />
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

function UTopBar() {
  const Btn = ({ icon }) => (
    <button style={{
      width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'transparent', border: 'none', cursor: 'pointer', color: U.fg1, padding: 0,
      borderRadius: 8,
    }}>
      <i data-lucide={icon} style={{ width: 20, height: 20 }} />
    </button>
  );
  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '4px 8px',
      height: 48, boxSizing: 'border-box',
      background: U.surface, borderBottom: `1px solid ${U.border}`,
      flexShrink: 0, zIndex: 5,
    }}>
      <Btn icon="chevron-left" />
      <div style={{
        flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600,
        color: U.fg1, letterSpacing: -0.15,
      }}>User profile</div>
      <Btn icon="share" />
      <Btn icon="more-horizontal" />
    </div>
  );
}

function UVerifBadge({ size = 22, color = U.primary600, ring = 3 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color,
      border: `${ring}px solid #fff`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxSizing: 'content-box',
      boxShadow: '0 1px 3px rgba(0,0,0,.18)',
    }}>
      <i data-lucide="check" style={{ width: size * 0.6, height: size * 0.6, color: '#fff', strokeWidth: 4 }} />
    </div>
  );
}

function UAvatar({ size, initials, bg, verified, verifColor, verifSize }) {
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: '50%', background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 700,
        fontSize: size >= 84 ? 30 : size >= 64 ? 24 : size >= 40 ? 15 : size >= 32 ? 12 : 10,
        boxShadow: size >= 64 ? '0 2px 8px rgba(2,132,199,0.18)' : 'none',
      }}>{initials}</div>
      {verified && (
        <div style={{ position: 'absolute', right: -2, bottom: -2 }}>
          <UVerifBadge size={verifSize || (size >= 64 ? 20 : 14)} color={verifColor || U.primary600} />
        </div>
      )}
    </div>
  );
}

function Chip({ children, icon, bg, fg, border, weight }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '4px 9px', borderRadius: 9999,
      background: bg || U.sunken, color: fg || U.fg2,
      border: border ? `1px solid ${border}` : '1px solid transparent',
      fontSize: 11, fontWeight: weight || 600,
      letterSpacing: -0.05, whiteSpace: 'nowrap',
    }}>
      {icon && <i data-lucide={icon} style={{ width: 11, height: 11, strokeWidth: 2.2 }} />}
      {children}
    </span>
  );
}

function Stars({ rating, size = 11, gap = 1 }) {
  // rating 0–5, may be fractional
  return (
    <span style={{ display: 'inline-flex', gap }}>
      {[0,1,2,3,4].map(i => {
        const fill = Math.max(0, Math.min(1, rating - i));
        return (
          <span key={i} style={{ position: 'relative', width: size, height: size, display: 'inline-block' }}>
            <i data-lucide="star" style={{
              width: size, height: size, color: U.border, position: 'absolute', inset: 0,
            }} />
            <span style={{
              position: 'absolute', inset: 0, overflow: 'hidden', width: `${fill * 100}%`,
            }}>
              <i data-lucide="star" style={{
                width: size, height: size, color: U.star, fill: U.star,
              }} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

// ─── Profile header (shared scaffold) ────────────────────────

function ProfileHeader({ name, initials, avatarBg, locality, identity, kicker, verified }) {
  const idMap = {
    personal: { bg: U.personalBg, fg: U.personal, label: 'Personal · Verified' },
    home:     { bg: U.homeBg,     fg: U.home,     label: 'Home · Verified' },
    business: { bg: U.bizBg,      fg: U.biz,      label: 'Business · Verified' },
    fresh:    { bg: U.warningBg,  fg: U.amber,    label: 'Verified · New here' },
  };
  const id = idMap[identity] || idMap.personal;
  return (
    <div style={{
      background: U.surface, padding: '20px 18px 18px',
      borderBottom: `1px solid ${U.border}`,
    }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <UAvatar size={72} initials={initials} bg={avatarBg} verified={verified} />
        <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
          <div style={{
            fontSize: 19, fontWeight: 700, color: U.fg1, letterSpacing: -0.4,
            lineHeight: '24px',
          }}>{name}</div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 12, color: U.fg3, marginTop: 2,
          }}>
            <i data-lucide="map-pin" style={{ width: 11, height: 11 }} />
            {locality}
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            <Chip
              icon="shield-check"
              bg={id.bg}
              fg={id.fg}
              weight={700}
            >{id.label}</Chip>
            {kicker && (
              <Chip bg={U.sunken} fg={U.fg2} weight={600}>{kicker}</Chip>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatStrip({ stats }) {
  return (
    <div style={{
      background: U.surface,
      borderBottom: `1px solid ${U.border}`,
      display: 'grid', gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
    }}>
      {stats.map((s, i) => (
        <div key={i} style={{
          padding: '12px 8px',
          borderLeft: i > 0 ? `1px solid ${U.borderSub}` : 'none',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 3,
            fontSize: 15, fontWeight: 700, color: s.color || U.fg1, letterSpacing: -0.3,
          }}>
            {s.icon && <i data-lucide={s.icon} style={{
              width: 12, height: 12, color: s.color || U.fg3,
              fill: s.iconFill ? s.color : 'none',
              strokeWidth: 2.2,
            }} />}
            {s.value}
          </div>
          <div style={{
            fontSize: 10, color: U.fg3, fontWeight: 600,
            letterSpacing: 0.04, textTransform: 'uppercase',
          }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function Tabs({ active, items }) {
  return (
    <div style={{
      display: 'flex', background: U.surface,
      borderBottom: `1px solid ${U.border}`,
      paddingTop: 4,
    }}>
      {items.map((t, i) => {
        const isActive = active === i;
        return (
          <div key={i} style={{
            flex: 1, textAlign: 'center', padding: '12px 4px 11px',
            fontSize: 12.5, fontWeight: 600,
            color: isActive ? U.primary600 : U.fg3,
            borderBottom: isActive ? `2px solid ${U.primary600}` : '2px solid transparent',
            marginBottom: -1,
            letterSpacing: -0.1,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}>
            {t.label}
            {t.count != null && (
              <span style={{
                fontSize: 10.5, fontWeight: 700,
                color: isActive ? U.primary600 : U.fg4,
                background: isActive ? U.primary50 : U.sunken,
                padding: '1px 6px', borderRadius: 9999,
                minWidth: 16,
              }}>{t.count}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SectionTitle({ children, action }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginTop: 14, marginBottom: 8,
    }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: 0.08,
        textTransform: 'uppercase', color: U.fg3,
      }}>{children}</div>
      {action && (
        <button style={{
          background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
          fontSize: 11.5, color: U.primary600, fontWeight: 600,
        }}>{action}</button>
      )}
    </div>
  );
}

// ─── Bottom action bar ───────────────────────────────────────

function ActionBar({ primary, secondary }) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      padding: '10px 14px 22px',
      background: 'rgba(255,255,255,0.96)',
      backdropFilter: 'blur(14px)',
      borderTop: `1px solid ${U.border}`,
      display: 'flex', gap: 8, zIndex: 4,
    }}>
      <button style={{
        flex: 1, height: 44, borderRadius: 12, border: `1px solid ${U.border}`,
        background: U.surface, color: U.fg1,
        fontSize: 14, fontWeight: 600, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        letterSpacing: -0.1,
      }}>
        <i data-lucide={secondary.icon} style={{ width: 16, height: 16 }} />
        {secondary.label}
      </button>
      <button style={{
        flex: 1.4, height: 44, borderRadius: 12, border: 'none',
        background: U.primary600, color: '#fff',
        fontSize: 14, fontWeight: 700, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        letterSpacing: -0.1,
        boxShadow: '0 6px 16px rgba(2,132,199,.28)',
      }}>
        <i data-lucide={primary.icon} style={{ width: 16, height: 16 }} />
        {primary.label}
      </button>
    </div>
  );
}

// ─── FRAME 1 — Populated ─────────────────────────────────────

function FrameUserPopulated() {
  return (
    <UPhone>
      <UTopBar />
      <div style={{ flex: 1, overflow: 'auto' }}>
        <ProfileHeader
          name="Derek Reyes"
          initials="DR"
          avatarBg="linear-gradient(135deg,#f97316,#c2410c)"
          locality="Elm Park · 5th & Elm"
          identity="personal"
          kicker="Neighbor since 2022"
          verified
        />

        <StatStrip
          stats={[
            { value: '4.9', label: '47 reviews', icon: 'star', color: U.star, iconFill: true },
            { value: '32',  label: 'Jobs done' },
            { value: '~45m', label: 'Response' },
          ]}
        />

        <Tabs
          active={0}
          items={[
            { label: 'About' },
            { label: 'Reviews', count: 47 },
            { label: 'Activity' },
          ]}
        />

        <div style={{ padding: '0 16px 110px' }}>
          {/* Bio */}
          <SectionTitle>Bio</SectionTitle>
          <div style={{
            fontSize: 13.5, color: U.fg2, lineHeight: '20px', letterSpacing: -0.05,
          }}>
            Handyman who lives two doors down. Hangs shelves, patches drywall, fixes the
            stuff your landlord won't. Bike-commutes everywhere — happy to drop a tool by
            on the way home. Weekend mornings work best.
          </div>

          {/* Skills */}
          <SectionTitle>Helps with</SectionTitle>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[
              { icon: 'hammer',       label: 'Handyman',       bg: '#fef3c7', fg: U.amber },
              { icon: 'paintbrush',   label: 'Patch & paint',  bg: U.sunken,  fg: U.fg2 },
              { icon: 'wrench',       label: 'Plumbing (light)', bg: U.sunken, fg: U.fg2 },
              { icon: 'bike',         label: 'Cycling',        bg: U.sunken,  fg: U.fg2 },
              { icon: 'truck',        label: 'Help moving',    bg: U.sunken,  fg: U.fg2 },
              { icon: 'languages',    label: 'EN · ES',        bg: U.sunken,  fg: U.fg2 },
            ].map(t => (
              <Chip key={t.label} icon={t.icon} bg={t.bg} fg={t.fg}>{t.label}</Chip>
            ))}
          </div>

          {/* Verifications */}
          <SectionTitle>Verifications</SectionTitle>
          <div style={{
            background: U.surface, border: `1px solid ${U.border}`,
            borderRadius: 14, padding: '4px 0',
          }}>
            {[
              { icon: 'home',       label: 'Address',  meta: 'Verified Mar 2022 · postcard',  ok: true },
              { icon: 'badge-check',label: 'Identity', meta: 'Government ID',                  ok: true },
              { icon: 'mail',       label: 'Email',    meta: 'derek@…',                        ok: true },
              { icon: 'phone',      label: 'Phone',    meta: '+1 ••• ••• 0193',                ok: true },
            ].map((v, i, arr) => (
              <div key={v.label} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px',
                borderBottom: i < arr.length - 1 ? `1px solid ${U.borderSub}` : 'none',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, background: U.primary50,
                  color: U.primary600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <i data-lucide={v.icon} style={{ width: 14, height: 14, strokeWidth: 2 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: U.fg1, letterSpacing: -0.1 }}>{v.label}</div>
                  <div style={{ fontSize: 10.5, color: U.fg3 }}>{v.meta}</div>
                </div>
                <UVerifBadge size={14} color={U.success600} ring={0} />
              </div>
            ))}
          </div>

          {/* Featured review */}
          <SectionTitle action="See all 47">Featured review</SectionTitle>
          <div style={{
            background: U.surface, border: `1px solid ${U.border}`,
            borderRadius: 14, padding: '12px 14px 13px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <UAvatar size={32} initials="MK" bg="linear-gradient(135deg,#0ea5e9,#0369a1)" verified />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: U.fg1, letterSpacing: -0.1 }}>
                  Maria K.
                </div>
                <div style={{ fontSize: 10.5, color: U.fg3 }}>2w · for "Hang 3 shelves"</div>
              </div>
              <Stars rating={5} size={12} />
            </div>
            <div style={{
              fontSize: 12.5, color: U.fg2, lineHeight: '18px',
              borderLeft: `2px solid ${U.primary200}`,
              paddingLeft: 10, marginTop: 6,
            }}>
              Showed up early, brought his own anchors, and noticed the stud finder was
              lying. Shelves are level a month later. Already booked him for the closet.
            </div>
          </div>

          {/* Block / report */}
          <div style={{
            marginTop: 14, display: 'flex', justifyContent: 'center', gap: 18,
            fontSize: 11, color: U.fg4,
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <i data-lucide="flag" style={{ width: 11, height: 11 }} /> Report
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <i data-lucide="ban" style={{ width: 11, height: 11 }} /> Block
            </span>
          </div>
        </div>
      </div>

      <ActionBar
        primary={{ icon: 'message-circle', label: 'Message' }}
        secondary={{ icon: 'user-plus', label: 'Connect' }}
      />
    </UPhone>
  );
}

// ─── FRAME 2 — Secondary (new verified neighbor, Reviews tab) ─

function FrameUserNewbie() {
  return (
    <UPhone>
      <UTopBar />
      <div style={{ flex: 1, overflow: 'auto' }}>
        <ProfileHeader
          name="Sasha Mendel"
          initials="SM"
          avatarBg="linear-gradient(135deg,#a78bfa,#6d28d9)"
          locality="Elm Park · 6th St"
          identity="fresh"
          kicker="Joined 4 days ago"
          verified
        />

        <StatStrip
          stats={[
            { value: '—',     label: 'No reviews yet', icon: 'star', color: U.fg4 },
            { value: '0',     label: 'Jobs done' },
            { value: 'New',   label: 'Response',       color: U.primary600 },
          ]}
        />

        <Tabs
          active={1}
          items={[
            { label: 'About' },
            { label: 'Reviews', count: 0 },
            { label: 'Activity' },
          ]}
        />

        <div style={{ padding: '0 16px 110px' }}>
          {/* Empty-state card for reviews */}
          <div style={{ marginTop: 16 }}>
            <div style={{
              background: U.surface, border: `1px dashed ${U.border}`, borderRadius: 14,
              padding: '22px 18px 20px',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              textAlign: 'center',
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: U.primary50, color: U.primary600,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 10,
              }}>
                <i data-lucide="sprout" style={{ width: 22, height: 22, strokeWidth: 1.8 }} />
              </div>
              <div style={{
                fontSize: 15, fontWeight: 700, color: U.fg1,
                letterSpacing: -0.2, marginBottom: 4,
              }}>No reviews yet</div>
              <div style={{
                fontSize: 12.5, color: U.fg3, lineHeight: '17px', maxWidth: 250,
              }}>
                Sasha verified their address 4 days ago. Reviews show up after the first
                hire, recommendation, or marketplace deal.
              </div>
            </div>
          </div>

          {/* Trust signals stand in for review history */}
          <SectionTitle>What we can vouch for</SectionTitle>
          <div style={{
            background: U.surface, border: `1px solid ${U.border}`,
            borderRadius: 14, padding: '4px 0',
          }}>
            {[
              { icon: 'home',        label: 'Address verified',  meta: 'Postcard delivered to 6th St',  status: 'Today' },
              { icon: 'badge-check', label: 'Identity verified', meta: 'Government ID matched',          status: '4d ago' },
              { icon: 'mail',        label: 'Email confirmed',   meta: 'sasha@…',                        status: '4d ago' },
            ].map((v, i, arr) => (
              <div key={v.label} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px',
                borderBottom: i < arr.length - 1 ? `1px solid ${U.borderSub}` : 'none',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, background: U.successBg,
                  color: U.success600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <i data-lucide={v.icon} style={{ width: 14, height: 14, strokeWidth: 2 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: U.fg1, letterSpacing: -0.1 }}>{v.label}</div>
                  <div style={{ fontSize: 10.5, color: U.fg3 }}>{v.meta}</div>
                </div>
                <span style={{ fontSize: 10.5, color: U.fg4 }}>{v.status}</span>
              </div>
            ))}
          </div>

          {/* Mutual neighbors — social proof when reviews don't exist yet */}
          <SectionTitle action="See all">Neighbors in common</SectionTitle>
          <div style={{
            background: U.surface, border: `1px solid ${U.border}`,
            borderRadius: 14, padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ display: 'flex' }}>
              {[
                { i: 'JT', bg: 'linear-gradient(135deg,#16a34a,#15803d)' },
                { i: 'RD', bg: 'linear-gradient(135deg,#f97316,#c2410c)' },
                { i: 'LP', bg: 'linear-gradient(135deg,#0ea5e9,#0369a1)' },
                { i: 'AS', bg: 'linear-gradient(135deg,#a78bfa,#6d28d9)' },
              ].map((a, i) => (
                <div key={i} style={{
                  marginLeft: i === 0 ? 0 : -8,
                  border: '2px solid #fff', borderRadius: '50%',
                }}>
                  <UAvatar size={28} initials={a.i} bg={a.bg} />
                </div>
              ))}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: U.fg1, letterSpacing: -0.1 }}>
                4 mutual neighbors
              </div>
              <div style={{ fontSize: 10.5, color: U.fg3 }}>
                Jamal, Ravi, Lena, Amina
              </div>
            </div>
            <i data-lucide="chevron-right" style={{ width: 16, height: 16, color: U.fg4 }} />
          </div>

          {/* Break-the-ice CTA */}
          <div style={{
            marginTop: 12,
            background: U.primary50, border: `1px solid ${U.primary200}`,
            borderRadius: 14, padding: '14px 16px',
            display: 'flex', alignItems: 'flex-start', gap: 12,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, background: U.primary600,
              color: '#fff', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <i data-lucide="hand" style={{ width: 16, height: 16, strokeWidth: 2.2 }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 700, color: U.primary700,
                letterSpacing: -0.1, marginBottom: 2,
              }}>Be the welcome wagon</div>
              <div style={{
                fontSize: 11.5, color: U.fg2, lineHeight: '16px',
              }}>
                Sasha just moved in. A quick "hi, welcome to the block" goes a long way —
                and first messages from verified neighbors travel fast.
              </div>
            </div>
          </div>

          <div style={{
            marginTop: 14, display: 'flex', justifyContent: 'center', gap: 18,
            fontSize: 11, color: U.fg4,
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <i data-lucide="flag" style={{ width: 11, height: 11 }} /> Report
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <i data-lucide="ban" style={{ width: 11, height: 11 }} /> Block
            </span>
          </div>
        </div>
      </div>

      <ActionBar
        primary={{ icon: 'message-circle', label: 'Say hi' }}
        secondary={{ icon: 'user-plus', label: 'Connect' }}
      />
    </UPhone>
  );
}

Object.assign(window, { FrameUserPopulated, FrameUserNewbie });
