// Pantopus — Public Beacon profile · shared primitives
// Extracted from the A21 archetype so each screen file inherits the scaffolding.
// All primitives are exposed on window.

const B = {
  primary50:  '#f0f9ff',
  primary100: '#e0f2fe',
  primary200: '#bae6fd',
  primary500: '#0ea5e9',
  primary600: '#0284c7',
  primary700: '#0369a1',
  primary800: '#075985',
  bg: '#f6f7f9', surface: '#ffffff', raised: '#f9fafb',
  sunken: '#f3f4f6', muted: '#f8fafc',
  border: '#e5e7eb', borderStrong: '#d1d5db', borderSub: '#f3f4f6',
  fg1: '#111827', fg2: '#374151', fg3: '#6b7280', fg4: '#9ca3af',
  personal:'#0284C7', personalBg:'#DBEAFE',
  home:    '#16A34A', homeBg:    '#DCFCE7',
  business:'#7C3AED', businessBg:'#F3E8FF',
  success:'#059669', successBg:'#D1FAE5',
  warning:'#D97706', warningBg:'#FDE68A',
  error:  '#DC2626', errorBg:  '#FECACA',
  bronze:'#a16207', bronzeBg:'#fef3c7',
  silver:'#475569', silverBg:'#e2e8f0',
  gold:  '#b45309', goldBg:  '#fde68a',
};

function SB() {
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '16px 28px 0', height: 44, boxSizing: 'border-box',
      fontFamily: '-apple-system, system-ui', fontWeight: 600, fontSize: 15, color: '#fff',
      zIndex: 40, mixBlendMode: 'difference',
    }}>
      <span>9:41</span>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill="#fff"/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill="#fff"/><rect x="9" y="2" width="3" height="9" rx="0.6" fill="#fff"/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill="#fff"/></svg>
        <svg width="15" height="11" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill="#fff"/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill="#fff"/><circle cx="7.5" cy="9" r="1.3" fill="#fff"/></svg>
        <svg width="24" height="11" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke="#fff" strokeOpacity="0.55" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill="#fff"/></svg>
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
        width: '100%', height: '100%', background: B.bg,
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

function FloatingBack({ right }) {
  return (
    <>
      <button style={{
        position: 'absolute', top: 50, left: 12, zIndex: 30,
        width: 36, height: 36, borderRadius: '50%',
        background: 'rgba(255,255,255,0.8)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: B.fg1, cursor: 'pointer', padding: 0,
      }}>
        <i data-lucide="chevron-left" style={{ width: 19, height: 19 }} />
      </button>
      {right && (
        <button style={{
          position: 'absolute', top: 50, right: 12, zIndex: 30,
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(255,255,255,0.8)',
          backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: B.fg1, cursor: 'pointer', padding: 0,
        }}>
          <i data-lucide={right} style={{ width: 17, height: 17 }} />
        </button>
      )}
    </>
  );
}

function Banner({ identity = 'personal', editable }) {
  const palette = identity === 'home'
    ? { c1: '#86efac', c2: '#16a34a', c3: '#15803d', orb: 'rgba(255,255,255,0.35)' }
    : identity === 'business'
    ? { c1: '#c4b5fd', c2: '#7c3aed', c3: '#5b21b6', orb: 'rgba(255,255,255,0.35)' }
    : { c1: '#7dd3fc', c2: '#0284c7', c3: '#075985', orb: 'rgba(255,255,255,0.35)' };
  return (
    <div style={{
      height: 160, position: 'relative', flexShrink: 0,
      background: `linear-gradient(135deg, ${palette.c1} 0%, ${palette.c2} 55%, ${palette.c3} 100%)`,
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -40, right: -30, width: 160, height: 160, borderRadius: '50%',
        background: `radial-gradient(circle, ${palette.orb} 0%, transparent 65%)`,
      }} />
      <div style={{
        position: 'absolute', bottom: -50, left: 30, width: 180, height: 180, borderRadius: '50%',
        background: `radial-gradient(circle, ${palette.orb} 0%, transparent 65%)`,
      }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%',
        background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.18) 100%)',
      }} />
      {editable && (
        <button style={{
          position: 'absolute', bottom: 10, right: 10, zIndex: 2,
          width: 30, height: 30, borderRadius: '50%',
          background: 'rgba(0,0,0,0.45)', border: 'none', color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(8px)',
        }}>
          <i data-lucide="pencil" style={{ width: 14, height: 14 }} />
        </button>
      )}
    </div>
  );
}

function VerifDot({ size = 22, color = B.primary600 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color,
      border: `2.5px solid ${B.surface}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxSizing: 'content-box', flexShrink: 0,
    }}>
      <i data-lucide="check" style={{ width: size * 0.55, height: size * 0.55, color: '#fff', strokeWidth: 4 }} />
    </div>
  );
}

function StatCell({ value, label, last }) {
  return (
    <div style={{
      flex: 1, textAlign: 'center', padding: '2px 0',
      borderRight: last ? 'none' : `1px solid ${B.border}`,
    }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: B.fg1, letterSpacing: -0.2 }}>{value}</div>
      <div style={{
        fontSize: 9.5, color: B.fg3, marginTop: 2, fontWeight: 600,
        letterSpacing: 0.05, textTransform: 'uppercase',
      }}>{label}</div>
    </div>
  );
}

function PrimaryBtn({ children, icon }) {
  return (
    <button style={{
      padding: '0 14px', height: 36, borderRadius: 10, border: 'none',
      background: B.primary600, color: '#fff',
      fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', gap: 5,
      boxShadow: '0 4px 10px rgba(2,132,199,0.25)',
      letterSpacing: -0.05,
    }}>
      {icon && <i data-lucide={icon} style={{ width: 14, height: 14, strokeWidth: 2.4 }} />}
      {children}
    </button>
  );
}

function GhostBtn({ children, icon, iconOnly }) {
  return (
    <button style={{
      padding: iconOnly ? 0 : '0 12px',
      width: iconOnly ? 36 : 'auto', height: 36, borderRadius: 10,
      background: B.surface, border: `1px solid ${B.border}`,
      color: B.fg1, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
      letterSpacing: -0.05,
    }}>
      {icon && <i data-lucide={icon} style={{ width: 14, height: 14 }} />}
      {children}
    </button>
  );
}

function TierBtn({ children, icon }) {
  return (
    <button style={{
      padding: '0 12px', height: 36, borderRadius: 10, border: `1px solid ${B.goldBg}`,
      background: '#fffbeb', color: B.gold,
      fontSize: 12, fontWeight: 700, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', gap: 5,
      letterSpacing: -0.05,
    }}>
      {icon && <i data-lucide={icon} style={{ width: 13, height: 13, strokeWidth: 2.4 }} />}
      {children}
    </button>
  );
}

function IdentityBlock({
  surface = 'persona', role = 'visitor',
  identity = 'personal',
  name, handle, bio,
  stats, tier, verifiedNeighbor,
  locality,
  // override the right-side action area
  actions,
  // avatar gradient override
  avatarGradient,
}) {
  const verifColor = identity === 'home' ? B.home : identity === 'business' ? B.business : B.primary600;
  const defaultGradient = identity === 'home'
    ? 'linear-gradient(135deg,#34d399,#15803d)'
    : identity === 'business'
    ? 'linear-gradient(135deg,#a78bfa,#5b21b6)'
    : 'linear-gradient(135deg,#0ea5e9,#0369a1)';
  return (
    <div style={{
      margin: '-40px 16px 0', background: B.surface,
      border: `1px solid ${B.border}`, borderRadius: 16,
      padding: 16, position: 'relative', zIndex: 5,
      boxShadow: '0 6px 20px rgba(17,24,39,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ position: 'relative', marginTop: -36 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: avatarGradient || defaultGradient,
            border: `3px solid ${B.surface}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 25, boxSizing: 'border-box',
            boxShadow: '0 4px 10px rgba(0,0,0,0.08)',
          }}>{name.slice(0,2)}</div>
          <div style={{ position: 'absolute', right: -2, bottom: -2 }}>
            <VerifDot size={20} color={verifColor} />
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {actions || (<>
            {role === 'visitor' && surface === 'persona' && (
              <>
                <GhostBtn iconOnly icon="share" />
                <PrimaryBtn icon="plus">Follow</PrimaryBtn>
              </>
            )}
            {role === 'visitor' && surface === 'local' && (
              <>
                <GhostBtn icon="user-plus">Connect</GhostBtn>
                <PrimaryBtn icon="message-square">Message</PrimaryBtn>
              </>
            )}
            {role === 'owner' && (
              <>
                <GhostBtn iconOnly icon="bar-chart-3" />
                <GhostBtn icon="pencil">Edit</GhostBtn>
              </>
            )}
            {role === 'current_member' && surface === 'persona' && (
              <>
                <GhostBtn iconOnly icon="share" />
                <TierBtn icon="crown">Bronze</TierBtn>
              </>
            )}
          </>)}
        </div>
      </div>

      <div style={{
        fontSize: 22, fontWeight: 700, color: B.fg1,
        letterSpacing: -0.3, marginTop: 10, lineHeight: '26px',
      }}>{name}</div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 12, color: B.fg3, letterSpacing: -0.05 }}>{handle}</span>
        {tier && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '2px 7px', borderRadius: 9999,
            background: B.goldBg, color: B.gold,
            fontSize: 9.5, fontWeight: 700, letterSpacing: 0.05, textTransform: 'uppercase',
          }}>
            <i data-lucide="crown" style={{ width: 10, height: 10 }} />
            {tier}
          </span>
        )}
        {verifiedNeighbor && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '2px 7px', borderRadius: 9999,
            background: B.homeBg, color: B.home,
            fontSize: 9.5, fontWeight: 700, letterSpacing: 0.05, textTransform: 'uppercase',
          }}>
            <i data-lucide="shield-check" style={{ width: 10, height: 10 }} />
            Verified neighbor
          </span>
        )}
        {locality && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: B.fg3,
          }}>
            <i data-lucide="map-pin" style={{ width: 11, height: 11 }} />
            {locality}
          </span>
        )}
      </div>

      {bio && (
        <div style={{
          fontSize: 13, color: B.fg2, marginTop: 10, lineHeight: '19px',
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{bio}</div>
      )}

      <div style={{
        display: 'flex', marginTop: 14, paddingTop: 12,
        borderTop: `1px solid ${B.borderSub}`,
      }}>
        {stats.map((s, i) => (
          <StatCell key={i} value={s.value} label={s.label} last={i === stats.length - 1} />
        ))}
      </div>
    </div>
  );
}

function CategoryChips({ chips }) {
  return (
    <div style={{
      display: 'flex', gap: 6, padding: '14px 16px 4px',
      overflowX: 'auto', scrollbarWidth: 'none',
    }}>
      {chips.map((c, i) => (
        <span key={i} style={{
          flexShrink: 0,
          padding: '5px 10px', borderRadius: 9999,
          background: c.bg, color: c.fg,
          fontSize: 11.5, fontWeight: 600, letterSpacing: -0.05,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          {c.icon && <i data-lucide={c.icon} style={{ width: 11, height: 11 }} />}
          {c.label}
        </span>
      ))}
    </div>
  );
}

function TabStrip({ tabs }) {
  return (
    <div style={{
      display: 'flex', margin: '14px 16px 0',
      borderBottom: `1px solid ${B.border}`, gap: 24,
    }}>
      {tabs.map((t, i) => (
        <button key={i} style={{
          background: 'transparent', border: 'none', padding: '10px 0',
          borderBottom: t.active ? `2px solid ${B.primary600}` : '2px solid transparent',
          color: t.active ? B.primary700 : B.fg3,
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
          marginBottom: -1, display: 'inline-flex', alignItems: 'center', gap: 4,
          letterSpacing: -0.1,
        }}>
          {t.label}
          {t.count != null && (
            <span style={{ fontSize: 10.5, color: B.fg4, fontWeight: 500 }}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function BroadcastCard({ time, visibility, body, hasMedia, mediaGradient, reactions, replies, locked, lockTier, kebab }) {
  return (
    <div style={{
      background: B.surface, border: `1px solid ${B.border}`, borderRadius: 16,
      padding: 12, marginBottom: 10, position: 'relative',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: B.fg3 }}>{time}</span>
        <span style={{ fontSize: 11, color: B.fg4 }}>·</span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          padding: '2px 7px', borderRadius: 9999,
          background: visibility === 'Free' ? B.successBg : B.bronzeBg,
          color: visibility === 'Free' ? B.success : B.bronze,
          fontSize: 9.5, fontWeight: 700, letterSpacing: 0.04, textTransform: 'uppercase',
        }}>
          <i data-lucide={visibility === 'Free' ? 'globe' : 'lock'} style={{ width: 9, height: 9 }} />
          {visibility}
        </span>
        <div style={{ flex: 1 }} />
        {kebab && (
          <button style={{
            width: 24, height: 24, borderRadius: 6, border: 'none',
            background: 'transparent', color: B.fg3, cursor: 'pointer', padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i data-lucide="more-horizontal" style={{ width: 15, height: 15 }} />
          </button>
        )}
      </div>
      <div style={{
        fontSize: 13.5, color: B.fg1, lineHeight: '19px', letterSpacing: -0.05,
        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        filter: locked ? 'blur(5px)' : 'none',
        userSelect: locked ? 'none' : 'auto',
      }}>{body}</div>
      {hasMedia && (
        <div style={{
          marginTop: 10, height: 110, borderRadius: 10,
          background: mediaGradient,
          filter: locked ? 'blur(8px)' : 'none', position: 'relative',
        }} />
      )}
      {!locked && (
        <div style={{
          display: 'flex', gap: 12, alignItems: 'center',
          marginTop: 10, paddingTop: 8, borderTop: `1px solid ${B.borderSub}`,
          fontSize: 11.5, color: B.fg3,
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <i data-lucide="heart" style={{ width: 13, height: 13 }} />{reactions}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <i data-lucide="message-circle" style={{ width: 13, height: 13 }} />{replies}
          </span>
          <div style={{ flex: 1 }} />
          <i data-lucide="bookmark" style={{ width: 13, height: 13 }} />
        </div>
      )}
      {locked && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 8,
          background: 'rgba(255,255,255,0.5)',
          backdropFilter: 'blur(2px)',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', background: B.goldBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: B.gold,
          }}>
            <i data-lucide="lock" style={{ width: 16, height: 16 }} />
          </div>
          <div style={{
            fontSize: 12, fontWeight: 700, color: B.fg1, letterSpacing: -0.1,
          }}>Subscribe to {lockTier} to view</div>
          <button style={{
            padding: '6px 14px', borderRadius: 9, border: 'none',
            background: B.gold, color: '#fff', cursor: 'pointer',
            fontSize: 11, fontWeight: 700, letterSpacing: 0.02,
          }}>Unlock · $4 / mo</button>
        </div>
      )}
    </div>
  );
}

function LocalPostCard({ time, locality, body, reactions, replies, intentChip, intentBg, intentColor, intentIcon }) {
  return (
    <div style={{
      background: B.surface, border: `1px solid ${B.border}`, borderRadius: 16,
      padding: 12, marginBottom: 10,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: B.fg3 }}>{time}</span>
        <span style={{ fontSize: 11, color: B.fg4 }}>·</span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: B.fg3,
        }}>
          <i data-lucide="map-pin" style={{ width: 11, height: 11 }} />
          {locality}
        </span>
        <div style={{ flex: 1 }} />
        {intentChip && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '2px 7px', borderRadius: 9999,
            background: intentBg, color: intentColor,
            fontSize: 9.5, fontWeight: 700, letterSpacing: 0.05, textTransform: 'uppercase',
          }}>
            <i data-lucide={intentIcon} style={{ width: 9, height: 9 }} />
            {intentChip}
          </span>
        )}
      </div>
      <div style={{
        fontSize: 13.5, color: B.fg1, lineHeight: '19px', letterSpacing: -0.05,
        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>{body}</div>
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center',
        marginTop: 10, paddingTop: 8, borderTop: `1px solid ${B.borderSub}`,
        fontSize: 11.5, color: B.fg3,
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <i data-lucide="lightbulb" style={{ width: 13, height: 13 }} />{reactions}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <i data-lucide="message-circle" style={{ width: 13, height: 13 }} />{replies}
        </span>
        <div style={{ flex: 1 }} />
        <i data-lucide="share" style={{ width: 13, height: 13 }} />
      </div>
    </div>
  );
}

function AnalyticsStrip() {
  return (
    <button style={{
      margin: '14px 16px 0', padding: '12px 14px',
      background: B.sunken, borderRadius: 12, border: 'none', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 12, width: 'calc(100% - 32px)',
      boxSizing: 'border-box',
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 9, background: B.primary50, color: B.primary600,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <i data-lucide="trending-up" style={{ width: 17, height: 17 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <div style={{ fontSize: 12, color: B.fg3, fontWeight: 500 }}>This week</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: B.fg1, marginTop: 1, letterSpacing: -0.05 }}>
          Reach <span style={{ color: B.primary700 }}>1.2K</span> · Net new beacons <span style={{ color: B.success }}>+18</span>
        </div>
      </div>
      <i data-lucide="chevron-right" style={{ width: 16, height: 16, color: B.fg4 }} />
    </button>
  );
}

// Reusable empty-state container for the broadcasts / posts area.
function EmptyState({ icon = 'radio-tower', title, body, ctaLabel, ctaIcon = 'bell-plus', tint = 'personal' }) {
  const c = tint === 'home' ? { bg: B.homeBg, fg: B.home, btn: B.home }
    : tint === 'business' ? { bg: B.businessBg, fg: B.business, btn: B.business }
    : { bg: B.primary50, fg: B.primary600, btn: B.primary600 };
  return (
    <div style={{
      padding: '48px 16px 30px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%', background: c.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: c.fg, marginBottom: 18,
      }}>
        <i data-lucide={icon} style={{ width: 32, height: 32, strokeWidth: 1.6 }} />
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, color: B.fg1, letterSpacing: -0.2 }}>{title}</div>
      <div style={{
        fontSize: 13, color: B.fg3, marginTop: 6, lineHeight: '19px', maxWidth: 260,
      }}>{body}</div>
      {ctaLabel && (
        <button style={{
          marginTop: 16, padding: '10px 16px', borderRadius: 10, border: 'none',
          background: c.btn, color: '#fff',
          fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          boxShadow: `0 4px 10px ${c.btn}40`, letterSpacing: -0.05,
        }}>
          {ctaIcon && <i data-lucide={ctaIcon} style={{ width: 14, height: 14, strokeWidth: 2.4 }} />}
          {ctaLabel}
        </button>
      )}
    </div>
  );
}

Object.assign(window, {
  B, SB, Phone, FloatingBack, Banner, VerifDot,
  StatCell, PrimaryBtn, GhostBtn, TierBtn,
  IdentityBlock, CategoryChips, TabStrip,
  BroadcastCard, LocalPostCard, AnalyticsStrip, EmptyState,
});
