// A10.6 — Business profile (src/app/business/[username].tsx)
// Archetype: A10 — Detail: Content · variant: content detail (body + actions)
// Two frames: populated (open, verified, full profile) + secondary (newly claimed + closed)

const B = {
  primary50:  '#f0f9ff',
  primary100: '#e0f2fe',
  primary200: '#bae6fd',
  primary400: '#38bdf8',
  primary500: '#0ea5e9',
  primary600: '#0284c7',
  primary700: '#0369a1',
  primary800: '#075985',
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
  errorBg:   '#fee2e2',
  error600:  '#dc2626',
  personalBg:'#e0f2fe',
  personal:  '#0369a1',
  homeBg:    '#dcfce7',
  home:      '#16a34a',
  bizBg:     '#ede9fe',
  biz:       '#6d28d9',
  bizDeep:   '#5b21b6',
  star:      '#f59e0b',
  // category accents
  catCleaning: '#16a34a',
  catCleaningBg: '#dcfce7',
  catHandyman: '#ea580c',
  catHandymanBg: '#ffedd5',
  catPet: '#dc2626',
  catPetBg: '#fee2e2',
};

// ─── Phone shell ──────────────────────────────────────────────

function BSB() {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '16px 28px 0', height: 44, boxSizing: 'border-box',
      fontFamily: '-apple-system, system-ui', fontWeight: 600, fontSize: 15, color: B.fg1,
    }}>
      <span>9:41</span>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={B.fg1}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={B.fg1}/><rect x="9" y="2" width="3" height="9" rx="0.6" fill={B.fg1}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={B.fg1}/></svg>
        <svg width="15" height="11" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={B.fg1}/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={B.fg1}/><circle cx="7.5" cy="9" r="1.3" fill={B.fg1}/></svg>
        <svg width="24" height="11" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={B.fg1} strokeOpacity="0.35" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill={B.fg1}/><path d="M22.5 3.8v3.4c.6-.2 1-.8 1-1.7s-.4-1.5-1-1.7z" fill={B.fg1} fillOpacity="0.4"/></svg>
      </div>
    </div>
  );
}

function BPhone({ children }) {
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
        <BSB />
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

function BTopBar({ transparent }) {
  const Btn = ({ icon, dark }) => (
    <button style={{
      width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: transparent ? 'rgba(17,24,39,0.32)' : 'transparent',
      border: 'none', cursor: 'pointer',
      color: transparent ? '#fff' : B.fg1, padding: 0,
      borderRadius: transparent ? '50%' : 8,
      backdropFilter: transparent ? 'blur(6px)' : 'none',
    }}>
      <i data-lucide={icon} style={{ width: 19, height: 19 }} />
    </button>
  );
  if (transparent) {
    // floating controls overlaid on the banner
    return (
      <div style={{
        position: 'absolute', top: 44, left: 0, right: 0, zIndex: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px',
      }}>
        <Btn icon="chevron-left" />
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn icon="share" />
          <Btn icon="more-horizontal" />
        </div>
      </div>
    );
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '4px 8px',
      height: 48, boxSizing: 'border-box',
      background: B.surface, borderBottom: `1px solid ${B.border}`,
      flexShrink: 0, zIndex: 5,
    }}>
      <Btn icon="chevron-left" />
      <div style={{
        flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600,
        color: B.fg1, letterSpacing: -0.15,
      }}>Business profile</div>
      <Btn icon="share" />
      <Btn icon="more-horizontal" />
    </div>
  );
}

function VerifBadge({ size = 22, color = B.primary600, ring = 3 }) {
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

function Avatar({ size, initials, bg, verified, verifColor, verifSize }) {
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: '50%', background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 700,
        fontSize: size >= 40 ? 15 : size >= 32 ? 12 : 10,
      }}>{initials}</div>
      {verified && (
        <div style={{ position: 'absolute', right: -2, bottom: -2 }}>
          <VerifBadge size={verifSize || 14} color={verifColor || B.primary600} />
        </div>
      )}
    </div>
  );
}

function Chip({ children, icon, bg, fg, border, weight, dot }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '4px 9px', borderRadius: 9999,
      background: bg || B.sunken, color: fg || B.fg2,
      border: border ? `1px solid ${border}` : '1px solid transparent',
      fontSize: 11, fontWeight: weight || 600,
      letterSpacing: -0.05, whiteSpace: 'nowrap',
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: fg }} />}
      {icon && <i data-lucide={icon} style={{ width: 11, height: 11, strokeWidth: 2.2 }} />}
      {children}
    </span>
  );
}

function Stars({ rating, size = 11, gap = 1 }) {
  return (
    <span style={{ display: 'inline-flex', gap }}>
      {[0,1,2,3,4].map(i => {
        const fill = Math.max(0, Math.min(1, rating - i));
        return (
          <span key={i} style={{ position: 'relative', width: size, height: size, display: 'inline-block' }}>
            <i data-lucide="star" style={{ width: size, height: size, color: B.border, position: 'absolute', inset: 0 }} />
            <span style={{ position: 'absolute', inset: 0, overflow: 'hidden', width: `${fill * 100}%` }}>
              <i data-lucide="star" style={{ width: size, height: size, color: B.star, fill: B.star }} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

function SectionTitle({ children, action, actionIcon }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginTop: 18, marginBottom: 8,
    }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: 0.08,
        textTransform: 'uppercase', color: B.fg3,
      }}>{children}</div>
      {action && (
        <button style={{
          background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
          fontSize: 11.5, color: B.primary600, fontWeight: 600,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          {actionIcon && <i data-lucide={actionIcon} style={{ width: 12, height: 12, strokeWidth: 2.2 }} />}
          {action}
        </button>
      )}
    </div>
  );
}

function Card({ children, pad = 0, dashed }) {
  return (
    <div style={{
      background: B.surface,
      border: dashed ? `1px dashed ${B.border}` : `1px solid ${B.border}`,
      borderRadius: 14, padding: pad,
    }}>{children}</div>
  );
}

// ─── Business header (banner + logo) ─────────────────────────

function BizHeader({ banner, logoBg, logoIcon, logoInitials, name, handle, locality, category, statusChip }) {
  return (
    <div style={{ background: B.surface, borderBottom: `1px solid ${B.border}` }}>
      {/* banner / cover */}
      <div style={{
        height: 116, background: banner, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.18) 100%)',
        }} />
      </div>
      <div style={{ padding: '0 18px 16px', position: 'relative' }}>
        {/* logo overlaps banner */}
        <div style={{ position: 'relative', marginTop: -30, marginBottom: 10, width: 'fit-content' }}>
          <div style={{
            width: 68, height: 68, borderRadius: 18, background: logoBg,
            border: '3px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 26, letterSpacing: -0.5,
            boxShadow: '0 4px 12px rgba(17,24,39,0.18)',
          }}>
            {logoIcon
              ? <i data-lucide={logoIcon} style={{ width: 30, height: 30, strokeWidth: 2 }} />
              : logoInitials}
          </div>
          <div style={{ position: 'absolute', right: -3, bottom: -3 }}>
            <VerifBadge size={18} color={B.biz} />
          </div>
        </div>

        <div style={{
          fontSize: 20, fontWeight: 800, color: B.fg1, letterSpacing: -0.5, lineHeight: '24px',
        }}>{name}</div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginTop: 4,
          fontSize: 12, color: B.fg3, flexWrap: 'wrap',
        }}>
          <span style={{ color: B.primary700, fontWeight: 600 }}>{handle}</span>
          <span style={{ width: 3, height: 3, borderRadius: '50%', background: B.fg4 }} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <i data-lucide="map-pin" style={{ width: 11, height: 11 }} />{locality}
          </span>
        </div>

        <div style={{ marginTop: 11, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Chip icon="shield-check" bg={B.bizBg} fg={B.bizDeep} weight={700}>Business · Verified</Chip>
          {statusChip}
        </div>
      </div>
    </div>
  );
}

function StatStrip({ stats }) {
  return (
    <div style={{
      background: B.surface, borderBottom: `1px solid ${B.border}`,
      display: 'grid', gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
    }}>
      {stats.map((s, i) => (
        <div key={i} style={{
          padding: '12px 8px',
          borderLeft: i > 0 ? `1px solid ${B.borderSub}` : 'none',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 3,
            fontSize: 15, fontWeight: 700, color: s.color || B.fg1, letterSpacing: -0.3,
          }}>
            {s.icon && <i data-lucide={s.icon} style={{
              width: 12, height: 12, color: s.color || B.fg3,
              fill: s.iconFill ? s.color : 'none', strokeWidth: 2.2,
            }} />}
            {s.value}
          </div>
          <div style={{
            fontSize: 10, color: B.fg3, fontWeight: 600,
            letterSpacing: 0.04, textTransform: 'uppercase',
          }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Category chips row ──────────────────────────────────────

function CategoryRow({ cats }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {cats.map(c => (
        <Chip key={c.label} icon={c.icon} bg={c.bg} fg={c.fg} weight={600}>{c.label}</Chip>
      ))}
    </div>
  );
}

// ─── Hours table ─────────────────────────────────────────────

function Hours({ open, statusLabel, statusSub, rows }) {
  const [expanded] = [false];
  return (
    <Card pad="0">
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
        borderBottom: `1px solid ${B.borderSub}`,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9,
          background: open ? B.successBg : B.warningBg,
          color: open ? B.success600 : B.warning600,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i data-lucide="clock" style={{ width: 15, height: 15, strokeWidth: 2 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 700,
            color: open ? B.success600 : B.warning600, letterSpacing: -0.1,
          }}>{statusLabel}</div>
          <div style={{ fontSize: 11, color: B.fg3 }}>{statusSub}</div>
        </div>
        <i data-lucide="chevron-down" style={{ width: 16, height: 16, color: B.fg4 }} />
      </div>
      <div style={{ padding: '4px 14px 6px' }}>
        {rows.map((r, i) => (
          <div key={r.day} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '6px 0',
            borderBottom: i < rows.length - 1 ? `1px solid ${B.borderSub}` : 'none',
          }}>
            <span style={{
              fontSize: 12.5, color: r.today ? B.fg1 : B.fg2,
              fontWeight: r.today ? 700 : 500,
            }}>{r.day}{r.today ? '  ·  Today' : ''}</span>
            <span style={{
              fontSize: 12.5, fontWeight: r.today ? 700 : 500,
              color: r.closed ? B.fg4 : (r.today ? B.fg1 : B.fg2),
            }}>{r.hours}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Address + map ───────────────────────────────────────────

function AddressMap({ address, sub, serviceArea, showPin = true }) {
  return (
    <Card pad="0">
      <div style={{ position: 'relative', height: 124, overflow: 'hidden' }}>
        <img src="assets/business-map.png" alt="" style={{
          width: '100%', height: '100%', objectFit: 'cover', display: 'block',
        }} />
        {showPin && (
          <div style={{
            position: 'absolute', left: '50%', top: '46%', transform: 'translate(-50%,-100%)',
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)',
              background: B.biz, border: '2px solid #fff',
              boxShadow: '0 2px 8px rgba(0,0,0,.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <i data-lucide="store" style={{ width: 13, height: 13, color: '#fff', transform: 'rotate(45deg)' }} />
            </div>
          </div>
        )}
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: B.fg1, letterSpacing: -0.1 }}>{address}</div>
          <div style={{ fontSize: 11, color: B.fg3, marginTop: 1 }}>{sub}</div>
          {serviceArea && (
            <div style={{
              fontSize: 11, color: B.success600, marginTop: 4,
              display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600,
            }}>
              <i data-lucide="route" style={{ width: 11, height: 11 }} />{serviceArea}
            </div>
          )}
        </div>
        <button style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          background: B.primary50, color: B.primary700, border: 'none',
          padding: '7px 11px', borderRadius: 9, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
        }}>
          <i data-lucide="navigation" style={{ width: 13, height: 13 }} />Directions
        </button>
      </div>
    </Card>
  );
}

// ─── Services list ───────────────────────────────────────────

function Services({ items }) {
  return (
    <Card pad="0">
      {items.map((s, i, arr) => (
        <div key={s.name} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
          borderBottom: i < arr.length - 1 ? `1px solid ${B.borderSub}` : 'none',
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, background: B.primary50,
            color: B.primary600, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i data-lucide={s.icon} style={{ width: 16, height: 16, strokeWidth: 2 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: B.fg1, letterSpacing: -0.1 }}>{s.name}</div>
            <div style={{ fontSize: 11, color: B.fg3, marginTop: 1 }}>{s.meta}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: B.fg1, letterSpacing: -0.2 }}>{s.price}</div>
            {s.unit && <div style={{ fontSize: 10, color: B.fg4 }}>{s.unit}</div>}
          </div>
        </div>
      ))}
    </Card>
  );
}

// ─── Gallery ─────────────────────────────────────────────────

function Gallery({ tiles }) {
  return (
    <div style={{
      display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2,
      margin: '0 -16px', padding: '0 16px',
    }}>
      {tiles.map((t, i) => (
        <div key={i} style={{
          position: 'relative', flexShrink: 0,
          width: 116, height: 92, borderRadius: 12, overflow: 'hidden',
          background: t.bg, border: `1px solid ${B.border}`,
          display: 'flex', alignItems: 'flex-end',
        }}>
          {t.icon && (
            <i data-lucide={t.icon} style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
              width: 24, height: 24, color: 'rgba(255,255,255,0.92)', strokeWidth: 1.6,
            }} />
          )}
          {t.more != null ? (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(17,24,39,0.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 16, fontWeight: 700,
            }}>+{t.more}</div>
          ) : (
            <div style={{
              position: 'relative', zIndex: 1, width: '100%',
              padding: '6px 8px', color: '#fff', fontSize: 10.5, fontWeight: 600,
              background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.4) 100%)',
            }}>{t.label}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Review block ────────────────────────────────────────────

function RatingSummary({ avg, count, dist }) {
  return (
    <Card pad="13px 14px">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: B.fg1, letterSpacing: -0.5, lineHeight: '32px' }}>{avg}</div>
          <Stars rating={avg} size={11} />
          <div style={{ fontSize: 10.5, color: B.fg3, marginTop: 3 }}>{count} reviews</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {dist.map(d => (
            <div key={d.n} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
              <span style={{ fontSize: 10.5, color: B.fg3, width: 8 }}>{d.n}</span>
              <div style={{ flex: 1, height: 5, borderRadius: 3, background: B.sunken, overflow: 'hidden' }}>
                <div style={{ width: `${d.pct}%`, height: '100%', background: B.star, borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function ReviewCard({ initials, avatarBg, name, meta, rating, body, verified }) {
  return (
    <Card pad="12px 14px 13px">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <Avatar size={32} initials={initials} bg={avatarBg} verified={verified} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: B.fg1, letterSpacing: -0.1 }}>{name}</div>
          <div style={{ fontSize: 10.5, color: B.fg3 }}>{meta}</div>
        </div>
        <Stars rating={rating} size={12} />
      </div>
      <div style={{ fontSize: 12.5, color: B.fg2, lineHeight: '18px' }}>{body}</div>
    </Card>
  );
}

// ─── Bottom action bar ───────────────────────────────────────

function ActionBar({ primary, secondary, note }) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      padding: note ? '8px 14px 22px' : '10px 14px 22px',
      background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(14px)',
      borderTop: `1px solid ${B.border}`, zIndex: 4,
    }}>
      {note && (
        <div style={{
          fontSize: 10.5, color: B.fg3, textAlign: 'center', marginBottom: 7,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        }}>
          <i data-lucide={note.icon} style={{ width: 11, height: 11, color: note.color || B.fg3 }} />
          {note.text}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={{
          flex: 1, height: 44, borderRadius: 12, border: `1px solid ${B.border}`,
          background: B.surface, color: B.fg1,
          fontSize: 14, fontWeight: 600, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          letterSpacing: -0.1,
        }}>
          <i data-lucide={secondary.icon} style={{ width: 16, height: 16 }} />
          {secondary.label}
        </button>
        <button style={{
          flex: 1.4, height: 44, borderRadius: 12, border: 'none',
          background: B.primary600, color: '#fff',
          fontSize: 14, fontWeight: 700, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          letterSpacing: -0.1, boxShadow: '0 6px 16px rgba(2,132,199,.28)',
        }}>
          <i data-lucide={primary.icon} style={{ width: 16, height: 16 }} />
          {primary.label}
        </button>
      </div>
    </div>
  );
}

// ─── FRAME 1 — Populated (open, verified, full profile) ──────

function FrameBizPopulated() {
  return (
    <BPhone>
      <BTopBar transparent />
      <div style={{ flex: 1, overflow: 'auto' }}>
        <BizHeader
          banner="linear-gradient(125deg, #0c4a6e 0%, #0284c7 52%, #22c1a6 100%)"
          logoBg="linear-gradient(135deg,#0ea5e9,#0369a1)"
          logoIcon="sparkles"
          name="Marlow & Co. Cleaning"
          handle="@marlowco"
          locality="Elm Park"
          statusChip={<Chip dot bg={B.successBg} fg={B.success600} weight={700}>Open now</Chip>}
        />

        <StatStrip stats={[
          { value: '4.9', label: '128 reviews', icon: 'star', color: B.star, iconFill: true },
          { value: '340', label: 'Jobs done' },
          { value: '~20m', label: 'Response' },
        ]} />

        <div style={{ padding: '14px 16px 130px' }}>
          {/* Category chips */}
          <CategoryRow cats={[
            { icon: 'sparkles', label: 'Cleaning', bg: B.catCleaningBg, fg: B.catCleaning },
            { icon: 'home', label: 'Home & apartment', bg: B.sunken, fg: B.fg2 },
            { icon: 'box', label: 'Move-out', bg: B.sunken, fg: B.fg2 },
            { icon: 'leaf', label: 'Eco products', bg: B.sunken, fg: B.fg2 },
          ]} />

          {/* Description */}
          <SectionTitle>About</SectionTitle>
          <div style={{ fontSize: 13.5, color: B.fg2, lineHeight: '20px', letterSpacing: -0.05 }}>
            Family-run cleaning crew that's worked Elm Park homes since 2019. Two-person teams,
            your own checklist, same crew each visit. We bring eco-safe supplies — you don't
            stock a thing. Bonded and insured.
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            <Chip icon="shield" bg={B.primary50} fg={B.primary700}>Bonded & insured</Chip>
            <Chip icon="users" bg={B.primary50} fg={B.primary700}>3 team members</Chip>
            <Chip icon="calendar-check" bg={B.primary50} fg={B.primary700}>Since 2019</Chip>
          </div>

          {/* Hours */}
          <SectionTitle>Hours</SectionTitle>
          <Hours
            open
            statusLabel="Open now"
            statusSub="Closes 6:00 PM"
            rows={[
              { day: 'Monday', hours: '8:00 AM – 6:00 PM', today: true },
              { day: 'Tuesday', hours: '8:00 AM – 6:00 PM' },
              { day: 'Wednesday', hours: '8:00 AM – 6:00 PM' },
              { day: 'Thursday', hours: '8:00 AM – 6:00 PM' },
              { day: 'Friday', hours: '8:00 AM – 5:00 PM' },
              { day: 'Saturday', hours: '9:00 AM – 2:00 PM' },
              { day: 'Sunday', hours: 'Closed', closed: true },
            ]}
          />

          {/* Address + map */}
          <SectionTitle>Service area</SectionTitle>
          <AddressMap
            address="Based near 5th & Birch"
            sub="Exact address shared after booking"
            serviceArea="Serves Elm Park & Cedar Heights — within 4 mi"
          />

          {/* Services */}
          <SectionTitle action="See all">Services</SectionTitle>
          <Services items={[
            { icon: 'spray-can', name: 'Standard clean', meta: '2 hr · 2-person team', price: 'from $90', unit: 'per visit' },
            { icon: 'sparkles', name: 'Deep clean', meta: '4 hr · baseboards, inside oven', price: 'from $180', unit: 'per visit' },
            { icon: 'box', name: 'Move-out clean', meta: 'Empty home · deposit-ready', price: 'from $240', unit: 'flat' },
          ]} />

          {/* Gallery */}
          <SectionTitle action="See all">Recent work</SectionTitle>
          <Gallery tiles={[
            { bg: 'linear-gradient(135deg,#0ea5e9,#0369a1)', label: 'Kitchen', icon: 'image' },
            { bg: 'linear-gradient(135deg,#22c1a6,#0e9488)', label: 'Bathroom', icon: 'image' },
            { bg: 'linear-gradient(135deg,#7c8da3,#475569)', label: 'Living room', icon: 'image' },
            { bg: 'linear-gradient(135deg,#0369a1,#075985)', more: 9 },
          ]} />

          {/* Reviews */}
          <SectionTitle action="See all 128">Reviews</SectionTitle>
          <RatingSummary avg={4.9} count={128} dist={[
            { n: 5, pct: 92 }, { n: 4, pct: 6 }, { n: 3, pct: 2 }, { n: 2, pct: 0 }, { n: 1, pct: 0 },
          ]} />
          <div style={{ marginTop: 8 }}>
            <ReviewCard
              initials="JT" avatarBg="linear-gradient(135deg,#16a34a,#15803d)"
              name="Jamal T." meta="1w · Standard clean" rating={5} verified
              body="Same two folks every time, which I love. They remember the dog and shut the gate. Place smells like nothing, which is exactly right."
            />
          </div>

          {/* Footer actions */}
          <div style={{
            marginTop: 16, display: 'flex', justifyContent: 'center', gap: 18,
            fontSize: 11, color: B.fg4,
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <i data-lucide="flag" style={{ width: 11, height: 11 }} /> Report
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <i data-lucide="share-2" style={{ width: 11, height: 11 }} /> Share
            </span>
          </div>
        </div>
      </div>

      <ActionBar
        primary={{ icon: 'message-circle', label: 'Contact' }}
        secondary={{ icon: 'calendar-plus', label: 'Book' }}
      />
    </BPhone>
  );
}

// ─── FRAME 2 — Secondary (newly claimed + closed) ────────────

function EmptyBlock({ icon, title, body, cta }) {
  return (
    <Card dashed pad="20px 18px 18px">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{
          width: 44, height: 44, borderRadius: 13, background: B.primary50, color: B.primary600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 9,
        }}>
          <i data-lucide={icon} style={{ width: 21, height: 21, strokeWidth: 1.8 }} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: B.fg1, letterSpacing: -0.2, marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 12, color: B.fg3, lineHeight: '17px', maxWidth: 248 }}>{body}</div>
        {cta && (
          <button style={{
            marginTop: 11, display: 'inline-flex', alignItems: 'center', gap: 5,
            background: B.surface, border: `1px solid ${B.border}`, color: B.fg1,
            padding: '7px 13px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            <i data-lucide={cta.icon} style={{ width: 13, height: 13 }} />{cta.label}
          </button>
        )}
      </div>
    </Card>
  );
}

function FrameBizNew() {
  return (
    <BPhone>
      <BTopBar transparent />
      <div style={{ flex: 1, overflow: 'auto' }}>
        <BizHeader
          banner="linear-gradient(125deg, #3f2d63 0%, #6d28d9 55%, #a78bfa 100%)"
          logoBg="linear-gradient(135deg,#a78bfa,#6d28d9)"
          logoIcon="paw-print"
          name="Tide Pool Pet Care"
          handle="@tidepoolpets"
          locality="Cedar Heights"
          statusChip={<Chip dot bg={B.warningBg} fg={B.warning600} weight={700}>Closed · opens 8 AM</Chip>}
        />

        <StatStrip stats={[
          { value: '—', label: 'No reviews yet', icon: 'star', color: B.fg4 },
          { value: '0', label: 'Jobs done' },
          { value: 'New', label: 'On Pantopus', color: B.primary600 },
        ]} />

        <div style={{ padding: '14px 16px 130px' }}>
          {/* Just-claimed trust note */}
          <div style={{
            background: B.primary50, border: `1px solid ${B.primary200}`, borderRadius: 14,
            padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 11,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, background: B.primary600, color: '#fff',
              flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <i data-lucide="badge-check" style={{ width: 16, height: 16, strokeWidth: 2.2 }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: B.primary700, letterSpacing: -0.1, marginBottom: 2 }}>
                Just opened on Pantopus
              </div>
              <div style={{ fontSize: 11.5, color: B.fg2, lineHeight: '16px' }}>
                Address and business identity are verified. Reviews and photos build up after
                the first few jobs — early neighbors set the tone.
              </div>
            </div>
          </div>

          {/* Category chips */}
          <CategoryRow cats={[
            { icon: 'paw-print', label: 'Pet care', bg: B.catPetBg, fg: B.catPet },
            { icon: 'dog', label: 'Dog walking', bg: B.sunken, fg: B.fg2 },
          ]} />

          {/* Description */}
          <SectionTitle>About</SectionTitle>
          <div style={{ fontSize: 13.5, color: B.fg2, lineHeight: '20px', letterSpacing: -0.05 }}>
            Drop-in visits, walks, and overnight sitting for dogs and cats in Cedar Heights.
            New to Pantopus, 8 years doing this around the block.
          </div>

          {/* Hours — closed today highlighted */}
          <SectionTitle>Hours</SectionTitle>
          <Hours
            open={false}
            statusLabel="Closed now"
            statusSub="Opens tomorrow at 8:00 AM"
            rows={[
              { day: 'Monday', hours: '8:00 AM – 7:00 PM' },
              { day: 'Tuesday', hours: '8:00 AM – 7:00 PM' },
              { day: 'Wednesday', hours: '8:00 AM – 7:00 PM', today: true, closed: true },
              { day: 'Thursday', hours: '8:00 AM – 7:00 PM' },
              { day: 'Friday', hours: '8:00 AM – 7:00 PM' },
              { day: 'Saturday', hours: '9:00 AM – 4:00 PM' },
              { day: 'Sunday', hours: 'Closed', closed: true },
            ]}
          />

          {/* Address + map */}
          <SectionTitle>Service area</SectionTitle>
          <AddressMap
            address="Cedar Heights"
            sub="Visits within a 2 mi radius"
            serviceArea="Walks & drop-ins · Cedar Heights only"
          />

          {/* Services — minimal */}
          <SectionTitle>Services</SectionTitle>
          <Services items={[
            { icon: 'footprints', name: '30-min dog walk', meta: 'Solo walk · your route', price: '$22', unit: 'per walk' },
            { icon: 'house', name: 'Drop-in visit', meta: 'Feed, water, playtime', price: '$20', unit: 'per visit' },
          ]} />

          {/* Gallery — empty */}
          <SectionTitle>Photos</SectionTitle>
          <EmptyBlock
            icon="image"
            title="No photos yet"
            body="Tide Pool hasn't added work photos. They'll appear here after the first visits."
          />

          {/* Reviews — empty */}
          <SectionTitle>Reviews</SectionTitle>
          <EmptyBlock
            icon="message-square-plus"
            title="No reviews yet"
            body="Be the first to hire Tide Pool. Your review helps the next neighbor decide."
            cta={{ icon: 'pen-line', label: 'Hire to review' }}
          />

          <div style={{
            marginTop: 16, display: 'flex', justifyContent: 'center', gap: 18,
            fontSize: 11, color: B.fg4,
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <i data-lucide="flag" style={{ width: 11, height: 11 }} /> Report
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <i data-lucide="share-2" style={{ width: 11, height: 11 }} /> Share
            </span>
          </div>
        </div>
      </div>

      <ActionBar
        note={{ icon: 'moon', text: 'Closed now — messages answered at 8 AM', color: B.warning600 }}
        primary={{ icon: 'message-circle', label: 'Contact' }}
        secondary={{ icon: 'phone', label: 'Call' }}
      />
    </BPhone>
  );
}

Object.assign(window, {
  FrameBizPopulated, FrameBizNew,
  B, BPhone, BTopBar, VerifBadge, Avatar, Chip, Stars, SectionTitle, Card,
  BizHeader, StatStrip, CategoryRow, Hours, AddressMap, Services, Gallery,
  RatingSummary, ReviewCard, ActionBar, EmptyBlock,
});
