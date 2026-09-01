// A10.3 — Today (src/app/hub-today.tsx)
// Archetype: A10 — Detail: Content · variant: today_hero + section_list + share_action
// Two frames: populated + severe-weather (secondary state)

const TD = {
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
  personalBg:'#dbeafe',
  personal:  '#1d4ed8',
  homeBg:    '#dcfce7',
  home:      '#16a34a',
  bizBg:     '#ede9fe',
  biz:       '#6d28d9',
};

// ─── Phone shell (inherits archetype scaffolding) ─────────────

function TodaySB() {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '16px 28px 0', height: 44, boxSizing: 'border-box',
      fontFamily: '-apple-system, system-ui', fontWeight: 600, fontSize: 15, color: TD.fg1,
    }}>
      <span>9:41</span>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={TD.fg1}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={TD.fg1}/><rect x="9" y="2" width="3" height="9" rx="0.6" fill={TD.fg1}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={TD.fg1}/></svg>
        <svg width="15" height="11" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={TD.fg1}/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={TD.fg1}/><circle cx="7.5" cy="9" r="1.3" fill={TD.fg1}/></svg>
        <svg width="24" height="11" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={TD.fg1} strokeOpacity="0.35" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill={TD.fg1}/><path d="M22.5 3.8v3.4c.6-.2 1-.8 1-1.7s-.4-1.5-1-1.7z" fill={TD.fg1} fillOpacity="0.4"/></svg>
      </div>
    </div>
  );
}

function TodayPhone({ children }) {
  return (
    <div style={{
      width: 360, height: 740, borderRadius: 46, padding: 10,
      background: '#0b0f17',
      boxShadow: '0 40px 80px rgba(17,24,39,0.22), 0 0 0 1px rgba(0,0,0,0.14)',
    }}>
      <div style={{
        width: '100%', height: '100%', background: TD.bg,
        borderRadius: 36, overflow: 'hidden', position: 'relative',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          position: 'absolute', top: 9, left: '50%', transform: 'translateX(-50%)',
          width: 108, height: 30, borderRadius: 20, background: '#000', zIndex: 50,
        }} />
        <TodaySB />
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

function TodayTopBar({ centerNode }) {
  const Btn = ({ icon }) => (
    <button style={{
      width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'transparent', border: 'none', cursor: 'pointer', color: TD.fg1, padding: 0,
      borderRadius: 8,
    }}>
      <i data-lucide={icon} style={{ width: 20, height: 20 }} />
    </button>
  );
  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '4px 8px',
      height: 48, boxSizing: 'border-box',
      background: TD.surface, borderBottom: `1px solid ${TD.border}`,
      flexShrink: 0, zIndex: 5,
    }}>
      <Btn icon="chevron-left" />
      <div style={{
        flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600,
        color: TD.fg1, letterSpacing: -0.15,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        padding: '0 4px',
      }}>{centerNode}</div>
      <Btn icon="share" />
      <Btn icon="more-horizontal" />
    </div>
  );
}

// ─── today_hero (sibling of home_hero / wallet_hero) ──────────

function HeroChip({ icon, label, value, scale, dotColor }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 10px', borderRadius: 9999,
      background: 'rgba(255,255,255,0.15)',
      border: '1px solid rgba(255,255,255,0.22)',
      color: '#fff',
    }}>
      {dotColor && (
        <span style={{
          width: 7, height: 7, borderRadius: 9999, background: dotColor,
          boxShadow: '0 0 0 2px rgba(255,255,255,0.18)',
        }} />
      )}
      {icon && <i data-lucide={icon} style={{ width: 12, height: 12 }} />}
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.04, textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 700 }}>{value}</span>
      {scale && <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{scale}</span>}
    </div>
  );
}

function TodayHero({ gradient, kicker, kickerIcon, headline, headlineSub, sub, glyph, chips, ribbon }) {
  return (
    <div style={{ padding: '12px 16px 0' }}>
      <div style={{
        background: gradient, borderRadius: 18, padding: 16, color: '#fff',
        boxShadow: '0 10px 24px rgba(2,132,199,0.25)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', right: -40, top: -30, width: 180, height: 180, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 60%)',
        }} />
        <div style={{
          position: 'absolute', left: -20, bottom: -60, width: 140, height: 140, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 60%)',
        }} />

        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 8px', borderRadius: 9999,
              background: 'rgba(255,255,255,0.18)',
              fontSize: 9.5, fontWeight: 700, letterSpacing: 0.08,
              textTransform: 'uppercase',
            }}>
              {kickerIcon && <i data-lucide={kickerIcon} style={{ width: 10, height: 10 }} />}
              {kicker}
            </div>
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 8,
              fontSize: 40, fontWeight: 800, letterSpacing: -1.2,
              marginTop: 12, lineHeight: '40px',
            }}>
              <span>{headline}</span>
              {headlineSub && (
                <span style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.75)', letterSpacing: -0.2 }}>
                  {headlineSub}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.88)', marginTop: 4, fontWeight: 500 }}>
              {sub}
            </div>
          </div>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, marginLeft: 10,
          }}>
            <i data-lucide={glyph} style={{ width: 30, height: 30, strokeWidth: 1.6 }} />
          </div>
        </div>

        {ribbon}

        <div style={{
          display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', position: 'relative',
        }}>
          {chips.map((c, i) => <HeroChip key={i} {...c} />)}
        </div>
      </div>
    </div>
  );
}

// ─── Section primitives ──────────────────────────────────────

function TodaySectionCard({ title, action, accent, children }) {
  return (
    <div style={{
      background: TD.surface, border: `1px solid ${TD.border}`, borderRadius: 14,
      overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px 4px',
      }}>
        <div style={{
          fontSize: 10.5, fontWeight: 600, color: TD.fg3,
          letterSpacing: 0.08, textTransform: 'uppercase',
          display: 'inline-flex', alignItems: 'center', gap: 5,
        }}>
          {accent && <span style={{ width: 6, height: 6, borderRadius: 9999, background: accent }} />}
          {title}
        </div>
        {action && (
          <button style={{
            background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
            color: TD.primary600, fontSize: 11, fontWeight: 600,
          }}>{action}</button>
        )}
      </div>
      {children}
    </div>
  );
}

function SunArc({ progress = 0.42, sunrise, sunset, label, daylight }) {
  // SVG arc with a sun positioned along the curve.
  const W = 280, H = 90, pad = 14;
  const cx = W / 2;
  // arc params
  const r = (W - pad * 2) / 2;
  const startX = pad;
  const startY = H - 8;
  const endX = W - pad;
  const endY = H - 8;
  // sun position along the arc — quadratic bezier param t = progress
  const t = Math.min(1, Math.max(0, progress));
  const peakY = 8;
  const sunX = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * cx + t * t * endX;
  const sunY = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * peakY + t * t * endY;

  return (
    <div style={{ padding: '6px 14px 12px' }}>
      <div style={{ position: 'relative' }}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
          <defs>
            <linearGradient id="sunpath" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#fbbf24" stopOpacity="0.3" />
              <stop offset="0.5" stopColor="#fbbf24" stopOpacity="0.9" />
              <stop offset="1" stopColor="#fbbf24" stopOpacity="0.3" />
            </linearGradient>
          </defs>
          <line x1="0" y1={H - 8} x2={W} y2={H - 8} stroke={TD.border} strokeDasharray="2 4" />
          <path
            d={`M ${startX} ${startY} Q ${cx} ${peakY} ${endX} ${endY}`}
            stroke="url(#sunpath)" strokeWidth="2.5" fill="none" strokeLinecap="round"
          />
          {/* sun */}
          <circle cx={sunX} cy={sunY} r="10" fill="#fbbf24" />
          <circle cx={sunX} cy={sunY} r="14" fill="#fbbf24" fillOpacity="0.18" />
        </svg>
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', marginTop: 4,
        fontSize: 11, color: TD.fg3,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <span style={{ fontWeight: 700, color: TD.fg1, fontSize: 12.5 }}>{sunrise}</span>
          <span style={{ fontSize: 10, color: TD.fg4, textTransform: 'uppercase', letterSpacing: 0.05, fontWeight: 600 }}>Sunrise</span>
        </div>
        {label && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: TD.amber, fontWeight: 700, letterSpacing: 0.04, textTransform: 'uppercase' }}>{label}</div>
            <div style={{ fontSize: 10.5, color: TD.fg3, marginTop: 1 }}>{daylight}</div>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ fontWeight: 700, color: TD.fg1, fontSize: 12.5 }}>{sunset}</span>
          <span style={{ fontSize: 10, color: TD.fg4, textTransform: 'uppercase', letterSpacing: 0.05, fontWeight: 600 }}>Sunset</span>
        </div>
      </div>
    </div>
  );
}

function SignalRow({ icon, color, bg, title, body, when, last, severity }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '12px 14px',
      borderBottom: last ? 'none' : `1px solid ${TD.borderSub}`,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, background: bg, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <i data-lucide={icon} style={{ width: 15, height: 15 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2,
        }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: TD.fg1, letterSpacing: -0.1 }}>{title}</span>
          {severity && (
            <span style={{
              padding: '1px 6px', borderRadius: 9999,
              background: severity.bg, color: severity.color,
              fontSize: 9, fontWeight: 700, letterSpacing: 0.05, textTransform: 'uppercase',
            }}>{severity.label}</span>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: TD.fg3, lineHeight: '16px' }}>{body}</div>
      </div>
      <div style={{ fontSize: 10.5, color: TD.fg4, fontWeight: 500, flexShrink: 0, marginTop: 2 }}>{when}</div>
    </div>
  );
}

// ─── Share action (primary CTA) ───────────────────────────────

function ShareCard({ title, sub }) {
  return (
    <div style={{
      background: TD.surface, border: `1px solid ${TD.border}`, borderRadius: 14,
      padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: TD.primary50, color: TD.primary600,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <i data-lucide="share-2" style={{ width: 18, height: 18 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: TD.fg1, letterSpacing: -0.1 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: TD.fg3, marginTop: 1 }}>{sub}</div>
      </div>
      <button style={{
        height: 36, padding: '0 14px', borderRadius: 10,
        background: TD.primary600, border: 'none',
        color: '#fff', fontSize: 12.5, fontWeight: 600,
        cursor: 'pointer', flexShrink: 0, letterSpacing: -0.1,
        boxShadow: '0 4px 10px rgba(2,132,199,0.28)',
        display: 'inline-flex', alignItems: 'center', gap: 5,
      }}>
        <i data-lucide="send" style={{ width: 13, height: 13 }} />
        Share
      </button>
    </div>
  );
}

// ─── Today header (centered, kicker + date) ───────────────────

function TodayTitle({ day, date }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: TD.fg1, letterSpacing: -0.15 }}>{day}</span>
      <span style={{ fontSize: 10, color: TD.fg4, marginTop: 2, fontWeight: 500 }}>{date}</span>
    </div>
  );
}

// ─── FRAMES ───────────────────────────────────────────────────

function FrameTodayPopulated() {
  return (
    <TodayPhone>
      <TodayTopBar centerNode={<TodayTitle day="Today" date="Tue · May 20" />} />
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 24 }}>
        <TodayHero
          gradient="linear-gradient(135deg, #38bdf8 0%, #0284c7 55%, #0c4a6e 100%)"
          kicker="Elm Park"
          kickerIcon="map-pin"
          headline="67°"
          headlineSub="Mostly sunny"
          sub="High 74° · Low 58° · Feels like 65°"
          glyph="sun"
          chips={[
            { icon: 'leaf',    label: 'AQI',  value: '42', scale: 'Good',  dotColor: '#22c55e' },
            { icon: 'sun-dim', label: 'UV',   value: '6',  scale: 'High',  dotColor: '#f59e0b' },
            { icon: 'wind',    label: 'Wind', value: '8mph' },
          ]}
        />

        <div style={{ padding: '14px 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <TodaySectionCard title="Sun & sky">
            <SunArc
              progress={0.42}
              sunrise="6:14 AM"
              sunset="7:32 PM"
              label="Mid-morning"
              daylight="13h 18m of daylight"
            />
          </TodaySectionCard>

          <TodaySectionCard title="Signals · 4 today" action="Manage" accent={TD.primary600}>
            <SignalRow
              icon="cloud-rain" color={TD.personal} bg={TD.personalBg}
              title="Light shower expected"
              body="60% chance after 4pm. Pickup umbrella in foyer."
              when="4pm"
            />
            <SignalRow
              icon="flower" color={TD.warning600} bg={TD.warningBg}
              title="Tree pollen high"
              body="Oak & birch. Lena's allergy log is logging it as a 3-tissue day."
              when="All day"
              severity={{ label: 'High', bg: TD.warningBg, color: TD.warning600 }}
            />
            <SignalRow
              icon="bus" color={TD.fg2} bg={TD.sunken}
              title="M14 reroute through 2pm"
              body="Construction on 14th & 3rd. Add ~7m to your commute."
              when="9a–2p"
            />
            <SignalRow
              icon="trash-2" color={TD.home} bg={TD.homeBg}
              title="Recycling pickup"
              body="Bins curbside before 7am. Maria's on rotation."
              when="Tomorrow"
              last
            />
          </TodaySectionCard>

          <TodaySectionCard title="Around the block">
            <div style={{ padding: '4px 14px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: 9999, background: TD.home }} />
                <span style={{ fontSize: 12, color: TD.fg2 }}>Farmers market open 8a–2p · 92 St</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: 9999, background: TD.primary600 }} />
                <span style={{ fontSize: 12, color: TD.fg2 }}>Park cleanup volunteers · 10am, Elm Park entrance</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: 9999, background: TD.biz }} />
                <span style={{ fontSize: 12, color: TD.fg2 }}>Café Sol — pastry drop at 7:30am</span>
              </div>
            </div>
          </TodaySectionCard>

          <ShareCard title="Share today's briefing" sub="3 members · sent to your household chat" />
        </div>
      </div>
    </TodayPhone>
  );
}

function FrameTodayAlert() {
  return (
    <TodayPhone>
      <TodayTopBar centerNode={<TodayTitle day="Today" date="Thu · Jan 18" />} />
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 24 }}>
        <TodayHero
          gradient="linear-gradient(135deg, #312e81 0%, #1e3a8a 50%, #0c4a6e 100%)"
          kicker="Elm Park · Advisory"
          kickerIcon="alert-triangle"
          headline="19°"
          headlineSub="Hard freeze"
          sub="High 24° · Low 9° · Wind chill -4°"
          glyph="snowflake"
          chips={[
            { icon: 'leaf',    label: 'AQI',  value: '88', scale: 'Moderate', dotColor: '#f59e0b' },
            { icon: 'sun-dim', label: 'UV',   value: '2',  scale: 'Low',      dotColor: '#22c55e' },
            { icon: 'wind',    label: 'Wind', value: '22mph' },
          ]}
          ribbon={
            <div style={{
              marginTop: 14, padding: '10px 12px', borderRadius: 12,
              background: 'rgba(239, 68, 68, 0.22)',
              border: '1px solid rgba(254, 202, 202, 0.4)',
              display: 'flex', alignItems: 'flex-start', gap: 10, position: 'relative',
            }}>
              <i data-lucide="alert-triangle" style={{ width: 16, height: 16, color: '#fecaca', flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: -0.1 }}>
                  NWS hard-freeze warning · until 8am Fri
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2, lineHeight: '15px' }}>
                  Drip indoor taps. Bring pets in. Cover outdoor faucets.
                </div>
              </div>
            </div>
          }
        />

        <div style={{ padding: '14px 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <TodaySectionCard title="Sun & sky">
            <SunArc
              progress={0.42}
              sunrise="7:18 AM"
              sunset="4:53 PM"
              label="Shorter day"
              daylight="9h 35m of daylight"
            />
          </TodaySectionCard>

          <TodaySectionCard title="Signals · 5 today" action="Manage" accent={TD.error600}>
            <SignalRow
              icon="droplets" color={TD.personal} bg={TD.personalBg}
              title="Pipe freeze risk"
              body="Drip kitchen + bath taps. Open cabinet doors under sinks."
              when="Overnight"
              severity={{ label: 'Critical', bg: TD.errorBg, color: TD.error600 }}
            />
            <SignalRow
              icon="zap" color={TD.warning600} bg={TD.warningBg}
              title="Grid strain alert"
              body="ConEd: reduce heat to 68° between 6–9pm if possible."
              when="6–9pm"
              severity={{ label: 'Watch', bg: TD.warningBg, color: TD.warning600 }}
            />
            <SignalRow
              icon="dog" color={TD.home} bg={TD.homeBg}
              title="Pets inside"
              body="Wind chill -4°. Walk Murphy max 10 minutes."
              when="All day"
            />
            <SignalRow
              icon="bus" color={TD.fg2} bg={TD.sunken}
              title="MTA delays expected"
              body="Switch heater issues on the L. Allow +15 min."
              when="Morning"
            />
            <SignalRow
              icon="users" color={TD.biz} bg={TD.bizBg}
              title="Check on Mrs. Ono (3A)"
              body="Block check-in chain · you're up Thursday."
              when="By 8pm"
              last
            />
          </TodaySectionCard>

          <ShareCard title="Forward this advisory" sub="3 members · also nudges the building chat" />
        </div>
      </div>
    </TodayPhone>
  );
}

Object.assign(window, { FrameTodayPopulated, FrameTodayAlert });
