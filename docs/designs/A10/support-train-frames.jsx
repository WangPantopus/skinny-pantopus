// A10.9 — Support train (src/app/support-trains/[id].tsx)
// Archetype: A10 — Detail: Content · variant: support_train_detail (recipient + slots + sign-up)
// Two frames: populated (partial coverage) + fully-covered (secondary state)

const ST = {
  primary50:  '#f0f9ff',
  primary100: '#e0f2fe',
  primary200: '#bae6fd',
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
  success700:'#047857',
  successBg: '#d1fae5',
  successSoft:'#ecfdf5',
  warning600:'#d97706',
  warningBg: '#fef3c7',
  amber:     '#b45309',
  amberDeep: '#92400e',
  errorBg:   '#fee2e2',
  error600:  '#dc2626',
  // identity
  homeBg:    '#dcfce7',
  home:      '#16a34a',
  homeDeep:  '#15803d',
  personalBg:'#dbeafe',
  personal:  '#1d4ed8',
  bizBg:     '#ede9fe',
  biz:       '#6d28d9',
};

// ─── Phone shell ──────────────────────────────────────────────

function STStatusBar() {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '16px 28px 0', height: 44, boxSizing: 'border-box',
      fontFamily: '-apple-system, system-ui', fontWeight: 600, fontSize: 15, color: ST.fg1,
    }}>
      <span>9:41</span>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={ST.fg1}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={ST.fg1}/><rect x="9" y="2" width="3" height="9" rx="0.6" fill={ST.fg1}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={ST.fg1}/></svg>
        <svg width="15" height="11" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={ST.fg1}/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={ST.fg1}/><circle cx="7.5" cy="9" r="1.3" fill={ST.fg1}/></svg>
        <svg width="24" height="11" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={ST.fg1} strokeOpacity="0.35" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill={ST.fg1}/><path d="M22.5 3.8v3.4c.6-.2 1-.8 1-1.7s-.4-1.5-1-1.7z" fill={ST.fg1} fillOpacity="0.4"/></svg>
      </div>
    </div>
  );
}

function STPhone({ children }) {
  return (
    <div style={{
      width: 360, height: 740, borderRadius: 46, padding: 10,
      background: '#0b0f17',
      boxShadow: '0 40px 80px rgba(17,24,39,0.22), 0 0 0 1px rgba(0,0,0,0.14)',
    }}>
      <div style={{
        width: '100%', height: '100%', background: ST.bg,
        borderRadius: 36, overflow: 'hidden', position: 'relative',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          position: 'absolute', top: 9, left: '50%', transform: 'translateX(-50%)',
          width: 108, height: 30, borderRadius: 20, background: '#000', zIndex: 50,
        }} />
        <STStatusBar />
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

function STTopBar({ trailing }) {
  const Btn = ({ icon }) => (
    <button style={{
      width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'transparent', border: 'none', cursor: 'pointer', color: ST.fg1, padding: 0,
      borderRadius: 8,
    }}>
      <i data-lucide={icon} style={{ width: 20, height: 20 }} />
    </button>
  );
  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '4px 8px',
      height: 48, boxSizing: 'border-box',
      background: ST.surface, borderBottom: `1px solid ${ST.border}`,
      flexShrink: 0, zIndex: 5,
    }}>
      <Btn icon="chevron-left" />
      <div style={{
        flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600,
        color: ST.fg1, letterSpacing: -0.15,
      }}>Support train</div>
      {trailing || <Btn icon="more-horizontal" />}
    </div>
  );
}

function STVerifBadge({ size = 12, color = ST.home }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color,
      border: `2px solid #fff`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxSizing: 'content-box',
    }}>
      <i data-lucide="check" style={{ width: size * 0.6, height: size * 0.6, color: '#fff', strokeWidth: 4 }} />
    </div>
  );
}

function STAvatar({ size, initials, bg, verified, verifColor, ring }) {
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: '50%', background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 700,
        fontSize: size >= 64 ? 24 : size >= 40 ? 15 : size >= 32 ? 11 : 9,
        boxShadow: ring ? `0 0 0 2px #fff, 0 0 0 ${ring}px ${ST.primary500}` : 'none',
      }}>{initials}</div>
      {verified && (
        <div style={{ position: 'absolute', right: -2, bottom: -2 }}>
          <STVerifBadge size={size >= 48 ? 13 : 10} color={verifColor || ST.home} />
        </div>
      )}
    </div>
  );
}

function STOverline({ children, action }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      marginTop: 16, marginBottom: 8,
    }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: 0.08,
        textTransform: 'uppercase', color: ST.fg3,
      }}>{children}</div>
      {action && (
        <button style={{
          background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
          fontSize: 11.5, color: ST.primary600, fontWeight: 600,
        }}>{action}</button>
      )}
    </div>
  );
}

// ─── Recipient card ───────────────────────────────────────────

function RecipientCard() {
  return (
    <div style={{
      background: ST.surface, border: `1px solid ${ST.border}`,
      borderRadius: 14, padding: '14px 14px 12px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <STAvatar size={48} initials="MR" bg="linear-gradient(135deg,#86efac,#16a34a)" verified verifColor={ST.home} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 14.5, fontWeight: 700, color: ST.fg1, letterSpacing: -0.15,
          }}>
            The Reyes household
          </div>
          <div style={{
            fontSize: 11.5, color: ST.fg3, marginTop: 2,
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <i data-lucide="map-pin" style={{ width: 11, height: 11, strokeWidth: 2 }} />
            418 Elm St · 2 blocks from you
          </div>
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          padding: '3px 8px 3px 6px', borderRadius: 9999,
          background: ST.homeBg, color: ST.homeDeep,
          fontSize: 9.5, fontWeight: 700, letterSpacing: 0.04, textTransform: 'uppercase',
        }}>
          <i data-lucide="house" style={{ width: 10, height: 10, strokeWidth: 2.5 }} />
          Home
        </span>
      </div>
      <div style={{
        marginTop: 12, padding: '10px 12px',
        background: ST.sunken, borderRadius: 10,
        fontSize: 12, color: ST.fg2, lineHeight: '17px',
        display: 'flex', gap: 8,
      }}>
        <i data-lucide="quote" style={{ width: 13, height: 13, color: ST.fg4, flexShrink: 0, marginTop: 2 }} />
        <span>
          Baby Mateo arrived Nov 18 — we’re home and overwhelmed in the best way.
          Soft foods, no peanuts, no fish. Thank you, Elm Park. <span style={{ color: ST.fg3 }}>— Ana & Jordan</span>
        </span>
      </div>
    </div>
  );
}

// ─── Type + dates strip ───────────────────────────────────────

function TypeDatesCard({ filled, total, daysLeft }) {
  const pct = Math.round((filled / total) * 100);
  return (
    <div style={{
      background: ST.surface, border: `1px solid ${ST.border}`,
      borderRadius: 14, overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
    }}>
      {/* head */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px 10px',
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, background: ST.homeBg,
          color: ST.homeDeep,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i data-lucide="utensils" style={{ width: 19, height: 19, strokeWidth: 2 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: ST.fg1, letterSpacing: -0.15,
          }}>Meal train · dinner for 4</div>
          <div style={{ fontSize: 11.5, color: ST.fg3, marginTop: 1 }}>
            Mon Nov 24 → Sun Dec 22 · {daysLeft} days left
          </div>
        </div>
        <div style={{
          padding: '3px 8px', borderRadius: 9999,
          background: filled === total ? ST.successBg : ST.primary50,
          color: filled === total ? ST.success700 : ST.primary700,
          fontSize: 10.5, fontWeight: 700, letterSpacing: 0.04, textTransform: 'uppercase',
        }}>
          {filled === total ? 'Covered' : 'Open'}
        </div>
      </div>

      {/* progress */}
      <div style={{ padding: '4px 14px 14px' }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          marginBottom: 6,
        }}>
          <div style={{
            fontSize: 12.5, color: ST.fg2,
          }}>
            <span style={{ fontWeight: 700, color: ST.fg1, fontSize: 13 }}>{filled}</span>
            <span style={{ color: ST.fg3 }}> of {total} slots covered</span>
          </div>
          <div style={{
            fontSize: 11, fontWeight: 600,
            color: filled === total ? ST.success700 : ST.primary700,
          }}>{pct}%</div>
        </div>
        <div style={{
          height: 7, borderRadius: 9999, background: ST.sunken,
          overflow: 'hidden', position: 'relative',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            width: `${pct}%`,
            background: filled === total
              ? `linear-gradient(90deg, ${ST.success600}, ${ST.home})`
              : `linear-gradient(90deg, ${ST.primary500}, ${ST.primary600})`,
            borderRadius: 9999,
          }} />
        </div>
        {/* small contributor strip */}
        <div style={{
          marginTop: 10, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{ display: 'flex' }}>
            {['SK','TP','MO','RJ'].map((ini, i) => (
              <div key={ini} style={{
                width: 22, height: 22, borderRadius: '50%',
                background: ['#f59e0b','#0ea5e9','#a855f7','#10b981'][i],
                color: '#fff', fontWeight: 700, fontSize: 9,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid #fff',
                marginLeft: i === 0 ? 0 : -7,
              }}>{ini}</div>
            ))}
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: ST.sunken, color: ST.fg2, fontWeight: 700, fontSize: 9,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid #fff', marginLeft: -7,
            }}>+{filled - 4}</div>
          </div>
          <div style={{ fontSize: 11.5, color: ST.fg3 }}>
            {filled === total
              ? 'All neighbors confirmed'
              : `${filled} neighbors signed up`}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Slot calendar ────────────────────────────────────────────

const CAL_DAYS = [
  // 4 weeks starting Mon Nov 24. state: 'past'|'today'|'filled'|'open'|'mine'
  // Row 1 — Nov 24..30
  { d: 24, m: 'Nov', s: 'filled' },
  { d: 25, m: 'Nov', s: 'filled' },
  { d: 26, m: 'Nov', s: 'filled' },
  { d: 27, m: 'Nov', s: 'filled' },
  { d: 28, m: 'Nov', s: 'filled' },
  { d: 29, m: 'Nov', s: 'filled' },
  { d: 30, m: 'Nov', s: 'filled' },
  // Row 2 — Dec 1..7  (Tue Dec 2 = today)
  { d: 1,  m: 'Dec', s: 'filled' },
  { d: 2,  m: 'Dec', s: 'today' },
  { d: 3,  m: 'Dec', s: 'filled' },
  { d: 4,  m: 'Dec', s: 'open' },
  { d: 5,  m: 'Dec', s: 'filled' },
  { d: 6,  m: 'Dec', s: 'open' },
  { d: 7,  m: 'Dec', s: 'filled' },
  // Row 3 — Dec 8..14
  { d: 8,  m: 'Dec', s: 'open' },
  { d: 9,  m: 'Dec', s: 'filled' },
  { d: 10, m: 'Dec', s: 'open' },
  { d: 11, m: 'Dec', s: 'filled' },
  { d: 12, m: 'Dec', s: 'open' },
  { d: 13, m: 'Dec', s: 'open' },
  { d: 14, m: 'Dec', s: 'filled' },
  // Row 4 — Dec 15..21
  { d: 15, m: 'Dec', s: 'open' },
  { d: 16, m: 'Dec', s: 'open' },
  { d: 17, m: 'Dec', s: 'open' },
  { d: 18, m: 'Dec', s: 'open' },
  { d: 19, m: 'Dec', s: 'open' },
  { d: 20, m: 'Dec', s: 'open' },
  { d: 21, m: 'Dec', s: 'open' },
];

function SlotCalendar({ fullCover, myDayIdx }) {
  // when fullCover, every cell becomes filled (except today stays today)
  return (
    <div style={{
      background: ST.surface, border: `1px solid ${ST.border}`,
      borderRadius: 14, padding: '12px 12px 14px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
    }}>
      {/* DOW header */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4,
        padding: '0 2px 6px',
      }}>
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <div key={i} style={{
            textAlign: 'center', fontSize: 9.5, fontWeight: 700, color: ST.fg4,
            letterSpacing: 0.06,
          }}>{d}</div>
        ))}
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4,
      }}>
        {CAL_DAYS.map((c, i) => {
          let state = c.s;
          if (fullCover && state === 'open') state = 'filled';
          if (myDayIdx === i) state = 'mine';

          const isToday = state === 'today';
          const isFilled = state === 'filled';
          const isOpen = state === 'open';
          const isMine = state === 'mine';
          const isPast = c.m === 'Nov' || (c.m === 'Dec' && c.d === 1);

          let bg = '#fff', fg = ST.fg1, border = `1px solid ${ST.border}`;
          if (isFilled && !isPast) { bg = ST.homeBg; fg = ST.homeDeep; border = `1px solid ${ST.homeBg}`; }
          if (isFilled && isPast)  { bg = ST.sunken; fg = ST.fg4; border = `1px solid ${ST.borderSub}`; }
          if (isOpen)   { bg = '#fff'; fg = ST.fg2; border = `1.5px dashed ${ST.border}`; }
          if (isToday)  { bg = ST.primary600; fg = '#fff'; border = `1px solid ${ST.primary600}`; }
          if (isMine)   { bg = ST.primary50; fg = ST.primary700; border = `1.5px solid ${ST.primary500}`; }

          return (
            <div key={i} style={{
              aspectRatio: '1 / 1', borderRadius: 8, background: bg, border,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}>
              <div style={{
                fontSize: 12.5, fontWeight: isToday || isMine ? 800 : isFilled ? 700 : 600,
                color: fg, lineHeight: 1,
              }}>{c.d}</div>
              {/* status dot */}
              <div style={{
                marginTop: 3, width: 4, height: 4, borderRadius: '50%',
                background: isToday ? '#fff'
                  : isMine ? ST.primary500
                  : isFilled && !isPast ? ST.home
                  : 'transparent',
              }} />
              {isToday && (
                <div style={{
                  position: 'absolute', top: 2, right: 2, width: 5, height: 5,
                  borderRadius: '50%', background: '#fff',
                }} />
              )}
            </div>
          );
        })}
      </div>
      {/* legend */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginTop: 12,
        paddingTop: 10, borderTop: `1px solid ${ST.borderSub}`,
        fontSize: 10.5, color: ST.fg3,
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2.5, background: ST.homeBg, border: `1px solid ${ST.home}` }} />
          Covered
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2.5, background: '#fff', border: `1.5px dashed ${ST.border}` }} />
          Open
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2.5, background: ST.primary600 }} />
          Today
        </span>
      </div>
    </div>
  );
}

// ─── Slot rows ────────────────────────────────────────────────

function SlotRow({ day, date, state, who, whoBg, dish, note, mine }) {
  const covered = state === 'covered';
  const open = state === 'open';

  return (
    <div style={{
      background: ST.surface, border: `1px solid ${mine ? '#7dd3fc' : ST.border}`,
      borderRadius: 12, padding: '10px 12px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: mine ? '0 1px 3px rgba(2,132,199,0.10)' : '0 1px 2px rgba(0,0,0,0.02)',
      position: 'relative',
    }}>
      {/* date column */}
      <div style={{
        width: 42, flexShrink: 0, textAlign: 'center',
        background: covered ? ST.homeBg : mine ? ST.primary50 : ST.sunken,
        color: covered ? ST.homeDeep : mine ? ST.primary700 : ST.fg2,
        borderRadius: 8, padding: '4px 0 5px',
        border: open ? `1.5px dashed ${ST.border}` : 'none',
      }}>
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: 0.06,
          textTransform: 'uppercase', opacity: 0.8,
        }}>{day}</div>
        <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1, marginTop: 1, letterSpacing: -0.3 }}>
          {date}
        </div>
      </div>
      {/* body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {covered ? (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12.5, fontWeight: 600, color: ST.fg1, letterSpacing: -0.1,
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%', background: whoBg || ST.primary500,
                color: '#fff', fontSize: 8, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>{who.split(' ').map(s => s[0]).join('').slice(0, 2)}</div>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {mine ? 'You' : who}
              </span>
              {mine && (
                <span style={{
                  padding: '1px 6px', borderRadius: 9999,
                  background: ST.primary50, color: ST.primary700,
                  fontSize: 9, fontWeight: 700, letterSpacing: 0.04, textTransform: 'uppercase',
                }}>Your slot</span>
              )}
            </div>
            <div style={{ fontSize: 11.5, color: ST.fg3, marginTop: 2 }}>
              {dish}{note ? ` · ${note}` : ''}
            </div>
          </>
        ) : (
          <>
            <div style={{
              fontSize: 12.5, fontWeight: 700, color: ST.fg2, letterSpacing: -0.1,
            }}>Open · dinner for 4</div>
            <div style={{ fontSize: 11.5, color: ST.fg3, marginTop: 2 }}>
              Drop off by 5:30 pm · porch shelf
            </div>
          </>
        )}
      </div>
      {/* trailing */}
      {open ? (
        <button style={{
          height: 30, padding: '0 12px', borderRadius: 8,
          background: ST.primary600, color: '#fff',
          fontSize: 11.5, fontWeight: 700, border: 'none', cursor: 'pointer',
          letterSpacing: -0.05,
        }}>
          Sign up
        </button>
      ) : mine ? (
        <button style={{
          height: 30, padding: '0 10px', borderRadius: 8,
          background: ST.surface, color: ST.primary700,
          fontSize: 11.5, fontWeight: 600,
          border: `1px solid ${ST.border}`, cursor: 'pointer',
        }}>Edit</button>
      ) : (
        <i data-lucide="check-circle-2" style={{ width: 18, height: 18, color: ST.home }} />
      )}
    </div>
  );
}

// ─── Sticky bottom action bar ─────────────────────────────────

function BottomBar({ children }) {
  return (
    <div style={{
      flexShrink: 0,
      padding: '10px 16px 20px',
      background: 'linear-gradient(180deg, rgba(246,247,249,0) 0%, rgba(246,247,249,0.92) 30%, #f6f7f9 60%)',
      borderTop: `1px solid ${ST.borderSub}`,
      zIndex: 4,
    }}>
      {children}
    </div>
  );
}

function PrimaryCTA({ icon = 'calendar-plus', label = 'Sign up for a slot' }) {
  return (
    <button style={{
      width: '100%', height: 50, borderRadius: 14, border: 'none',
      background: ST.primary600, color: '#fff',
      fontSize: 15, fontWeight: 700, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      letterSpacing: -0.15,
      boxShadow: '0 6px 16px rgba(2,132,199,.28)',
    }}>
      <i data-lucide={icon} style={{ width: 17, height: 17 }} />
      {label}
    </button>
  );
}

function SecondaryDuo() {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button style={{
        flex: 1, height: 46, borderRadius: 12,
        background: ST.surface, color: ST.fg1,
        border: `1px solid ${ST.border}`,
        fontSize: 13, fontWeight: 600, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        letterSpacing: -0.1,
      }}>
        <i data-lucide="mail" style={{ width: 14, height: 14 }} />
        Send a card
      </button>
      <button style={{
        flex: 1.1, height: 46, borderRadius: 12, border: 'none',
        background: ST.primary600, color: '#fff',
        fontSize: 13, fontWeight: 700, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        letterSpacing: -0.1,
        boxShadow: '0 4px 10px rgba(2,132,199,.22)',
      }}>
        <i data-lucide="user-plus" style={{ width: 14, height: 14 }} />
        Join as backup
      </button>
    </div>
  );
}

// ─── Hosted-by line ──────────────────────────────────────────

function HostedBy() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      marginTop: 10, padding: '8px 12px',
      background: ST.surface, border: `1px solid ${ST.borderSub}`,
      borderRadius: 10,
    }}>
      <STAvatar size={24} initials="DK" bg="linear-gradient(135deg,#fda4af,#e11d48)" />
      <div style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: ST.fg3 }}>
        Hosted by <span style={{ color: ST.fg2, fontWeight: 600 }}>Diane K.</span> · neighbor at 422 Elm
      </div>
      <i data-lucide="message-square" style={{ width: 14, height: 14, color: ST.fg4 }} />
    </div>
  );
}

// ─── Full-covered banner (Frame 2) ───────────────────────────

function FullyCoveredBanner() {
  return (
    <div style={{
      background: ST.successSoft,
      border: `1px solid ${ST.successBg}`,
      borderRadius: 14, padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, background: ST.success600,
        color: '#fff', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <i data-lucide="party-popper" style={{ width: 18, height: 18, strokeWidth: 2.2 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 700, color: ST.success700,
          letterSpacing: -0.15,
        }}>Every slot is covered</div>
        <div style={{
          fontSize: 11.5, color: ST.success700, opacity: 0.85, marginTop: 1, lineHeight: '15px',
        }}>
          Elm Park showed up — all 21 dinners are spoken for. Sign up as backup in case someone can’t make it.
        </div>
      </div>
    </div>
  );
}

// ─── FRAME 1 — Populated, partial coverage ───────────────────

function FrameSupportTrainPopulated() {
  return (
    <STPhone>
      <STTopBar />
      <div style={{
        flex: 1, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px 8px' }}>
          <STOverline>For</STOverline>
          <RecipientCard />

          <STOverline>The train</STOverline>
          <TypeDatesCard filled={12} total={21} daysLeft={20} />

          <STOverline>Slot calendar</STOverline>
          <SlotCalendar />

          <STOverline action="See all 9">Open slots near you</STOverline>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SlotRow day="Thu" date="4" state="open" />
            <SlotRow day="Sat" date="6" state="open" />
            <SlotRow day="Mon" date="8" state="open" />
          </div>

          <STOverline>Already on the train</STOverline>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SlotRow
              day="Tue" date="2" state="covered"
              who="Sam Kowalski" whoBg="#f59e0b"
              dish="Lentil soup + cornbread" note="drop 5pm"
            />
            <SlotRow
              day="Wed" date="3" state="covered"
              who="Tomás Pérez" whoBg="#0ea5e9"
              dish="Chicken & rice (mild)"
            />
            <SlotRow
              day="Fri" date="5" state="covered"
              who="Maya O." whoBg="#a855f7"
              dish="Veg lasagna + salad"
            />
          </div>

          <HostedBy />

          <div style={{ height: 12 }} />
        </div>
        <BottomBar>
          <PrimaryCTA />
        </BottomBar>
      </div>
    </STPhone>
  );
}

// ─── FRAME 2 — Secondary: fully covered ──────────────────────

function FrameSupportTrainCovered() {
  return (
    <STPhone>
      <STTopBar />
      <div style={{
        flex: 1, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px 8px' }}>
          <div style={{ marginTop: 8, marginBottom: 4 }}>
            <FullyCoveredBanner />
          </div>

          <STOverline>For</STOverline>
          <RecipientCard />

          <STOverline>The train</STOverline>
          <TypeDatesCard filled={21} total={21} daysLeft={20} />

          <STOverline>Slot calendar</STOverline>
          <SlotCalendar fullCover myDayIdx={10} />

          <STOverline>Your commitment</STOverline>
          <SlotRow
            day="Thu" date="4" state="covered" mine
            who="You" whoBg={ST.primary600}
            dish="Pad thai (no peanuts) + spring rolls" note="6:00 pm"
          />

          <STOverline action="See all 21">Next up</STOverline>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SlotRow
              day="Tue" date="2" state="covered"
              who="Sam Kowalski" whoBg="#f59e0b"
              dish="Lentil soup + cornbread" note="tonight 5pm"
            />
            <SlotRow
              day="Wed" date="3" state="covered"
              who="Tomás Pérez" whoBg="#0ea5e9"
              dish="Chicken & rice (mild)"
            />
          </div>

          <HostedBy />

          <div style={{ height: 12 }} />
        </div>
        <BottomBar>
          <SecondaryDuo />
        </BottomBar>
      </div>
    </STPhone>
  );
}

Object.assign(window, { FrameSupportTrainPopulated, FrameSupportTrainCovered });
