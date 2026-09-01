// Pantopus — A13.12 · Edit persona
// File: src/app/identity/persona.tsx
//
// NEW screen — third-identity editor for the optional Persona overlay. Personas
// sit on top of the three pillars (Personal · Home · Business) and are for
// people who want a public "channel" inside Pantopus — block-watch updates,
// neighborhood chronicler, repair-shop bulletin, sourdough-Saturday host.
//
// Fuchsia is the persona accent (distinct from sky/Personal, green/Home,
// violet/Business). The form inherits A13 atoms; the screen-specific pieces:
//
//   • Persona header strip — handle, fuchsia gradient, follower count
//   • Category policy block — what this persona is allowed to post about,
//     rendered as chip groups (Allow / Off-topic) so the user is explicit
//   • Tier card stack — Free tier (always) + Paid tiers, with a per-card
//     "Stripe ready" / "Connect required" state. Connecting Stripe is a
//     onboarding hook surfaced inline, not in a separate flow.
//   • Broadcast settings — frequency cap + quiet hours
//   • Share / QR — handle URL with a stamp-style QR card
//   • Analytics opt-in — toggle + scope chip
//   • Sticky save — persona-aware
//
// Two frames:
//   FramePersonaLive   — fully set up, Stripe connected, paid tiers active
//   FramePersonaSetup  — mid-setup, Stripe not connected (paid tiers locked),
//                         checklist 3/7, share link in private-preview mode.

const {
  F, Phone, TopBar, OverlineLabel, FieldLabel,
  Input, Textarea, Section, ScrollArea, Card,
  Toggle, ToggleRow,
} = window;

// ─── Persona pillar palette (fuchsia) ──────────────────────────
const P = {
  fuchsia50:  '#fdf4ff',
  fuchsia100: '#fae8ff',
  fuchsia200: '#f5d0fe',
  fuchsia300: '#f0abfc',
  fuchsia400: '#e879f9',
  fuchsia500: '#d946ef',
  fuchsia600: '#c026d3',
  fuchsia700: '#a21caf',
  fuchsia800: '#86198f',
  amber50:    '#fffbeb',
  amber100:   '#fef3c7',
  amber200:   '#fde68a',
  amber600:   '#d97706',
  amber700:   '#b45309',
  rose600:    '#e11d48',
};

// ─── Top bar (persona context tag) ─────────────────────────────

function PersonaTopBar({ title, handle }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '8px 8px',
      height: 52, boxSizing: 'border-box', background: F.surface,
      borderBottom: `1px solid ${F.border}`, flexShrink: 0,
    }}>
      <button style={{
        width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: 'none', cursor: 'pointer', color: F.fg1, padding: 0,
      }}>
        <i data-lucide="x" style={{ width: 22, height: 22 }} />
      </button>
      <div style={{
        flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 1,
      }}>
        <div style={{ fontSize: 15.5, fontWeight: 600, color: F.fg1, letterSpacing: -0.2 }}>
          {title}
        </div>
        <div style={{
          fontSize: 10, fontWeight: 600, letterSpacing: 0.04,
          color: P.fuchsia700,
          fontFamily: 'ui-monospace, Menlo, monospace',
        }}>{handle}</div>
      </div>
      <div style={{ width: 36 }} />
    </div>
  );
}

// ─── Header strip · live vs setup ──────────────────────────────

function PersonaHeader({ variant, followers, posts, tier, displayName }) {
  if (variant === 'live') {
    return (
      <div style={{
        background: 'linear-gradient(135deg,#a21caf 0%,#c026d3 55%,#e11d48 100%)',
        borderRadius: 14, padding: '14px 14px',
        color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        {/* halo dot */}
        <div style={{
          position: 'absolute', right: -30, top: -30,
          width: 160, height: 160, borderRadius: '50%',
          background: 'rgba(255,255,255,0.10)',
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(255,255,255,0.18)',
            border: '1.5px solid rgba(255,255,255,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, backdropFilter: 'blur(6px)',
          }}>
            <i data-lucide="radio" style={{ width: 19, height: 19, color: '#fff' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: -0.1 }}>
              {displayName}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.78)', marginTop: 2 }}>
              Live persona · published &amp; broadcasting
            </div>
          </div>
          <span style={{
            fontSize: 9.5, fontWeight: 700, letterSpacing: 0.1,
            padding: '3px 7px', borderRadius: 4, textTransform: 'uppercase',
            background: 'rgba(255,255,255,0.22)', color: '#fff',
            border: '1px solid rgba(255,255,255,0.3)',
          }}>{tier}</span>
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8, marginTop: 14, position: 'relative',
        }}>
          {[
            { v: followers, l: 'Followers' },
            { v: posts, l: 'Posts · 30d' },
            { v: '4.8★', l: 'Avg rating' },
          ].map(s => (
            <div key={s.l} style={{
              padding: '8px 10px', borderRadius: 9,
              background: 'rgba(255,255,255,0.14)',
              border: '1px solid rgba(255,255,255,0.18)',
            }}>
              <div style={{
                fontSize: 16, fontWeight: 700, letterSpacing: -0.3,
                fontFamily: 'ui-monospace, Menlo, monospace',
              }}>{s.v}</div>
              <div style={{
                fontSize: 9.5, fontWeight: 600, letterSpacing: 0.06,
                textTransform: 'uppercase', color: 'rgba(255,255,255,0.78)',
                marginTop: 1,
              }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  // setup variant — checklist progress
  return (
    <div style={{
      background: 'linear-gradient(135deg,#fdf4ff 0%,#fae8ff 100%)',
      border: `1px solid ${P.fuchsia200}`,
      borderRadius: 14, padding: '14px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'linear-gradient(135deg,#d946ef,#a21caf)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, boxShadow: '0 4px 10px rgba(192,38,211,0.25)',
        }}>
          <i data-lucide="sparkles" style={{ width: 18, height: 18 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: F.fg1, letterSpacing: -0.1 }}>
            Finish your persona
          </div>
          <div style={{ fontSize: 11, color: P.fuchsia700, marginTop: 1, fontWeight: 500 }}>
            3 of 7 steps · 4 more before you can publish
          </div>
        </div>
        <span style={{
          fontSize: 9.5, fontWeight: 700, letterSpacing: 0.1,
          color: '#fff', background: P.fuchsia600,
          padding: '3px 7px', borderRadius: 4, textTransform: 'uppercase',
        }}>Draft</span>
      </div>
      {/* segmented progress */}
      <div style={{
        marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4,
      }}>
        {[1,1,1,0,0,0,0].map((on,i) => (
          <div key={i} style={{
            height: 5, borderRadius: 3,
            background: on ? P.fuchsia600 : 'rgba(192,38,211,0.18)',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12 }}>
        {[
          { label: 'Handle reserved',      done: true },
          { label: 'Display name + bio',   done: true },
          { label: 'Category policy',      done: true },
          { label: 'Connect Stripe',       done: false, fresh: true },
          { label: 'Set tier prices',      done: false },
          { label: 'Broadcast schedule',   done: false },
          { label: 'Publish persona',      done: false },
        ].map(s => (
          <div key={s.label} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 11.5, color: s.done ? F.fg2 : F.fg3, fontWeight: s.fresh ? 600 : 500,
          }}>
            {s.done ? (
              <i data-lucide="check-circle-2" style={{ width: 12, height: 12, color: F.success600 }} />
            ) : (
              <span style={{
                width: 12, height: 12, borderRadius: '50%',
                border: `1.5px solid ${s.fresh ? P.fuchsia600 : F.borderStrong}`,
                background: s.fresh ? P.fuchsia50 : 'transparent',
                boxSizing: 'border-box',
              }} />
            )}
            <span style={{ color: s.fresh ? P.fuchsia700 : 'inherit' }}>{s.label}</span>
            {s.fresh && (
              <span style={{
                marginLeft: 'auto', fontSize: 9.5, fontWeight: 700, letterSpacing: 0.1,
                color: P.fuchsia700, textTransform: 'uppercase',
              }}>Next</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Field label, persona-tinted required ─────────────────────

function PLabel({ children, required, dirty, optional, hint }) {
  return (
    <label style={{
      display: 'block', fontSize: 12, fontWeight: 600, color: F.fg2,
      marginBottom: 6, letterSpacing: -0.05,
    }}>
      {children}
      {required && <span style={{ color: P.fuchsia600, marginLeft: 3 }}>*</span>}
      {optional && (
        <span style={{ color: F.fg4, marginLeft: 6, fontWeight: 500, fontSize: 11 }}>(optional)</span>
      )}
      {hint && (
        <span style={{ color: F.fg4, marginLeft: 6, fontWeight: 500, fontSize: 11, fontStyle: 'italic' }}>
          {hint}
        </span>
      )}
      {dirty && (
        <span style={{
          display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
          background: '#f59e0b', marginLeft: 6, verticalAlign: 'middle',
          boxShadow: '0 0 0 2px #fef3c7',
        }} />
      )}
    </label>
  );
}

// ─── Handle input · @prefix · live availability ───────────────

function HandleField({ value, status }) {
  const right = status === 'available' ? (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 11, fontWeight: 700, color: F.success,
    }}>
      <i data-lucide="check-circle-2" style={{ width: 13, height: 13 }} />
      Available
    </span>
  ) : status === 'reserved' ? (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 11, fontWeight: 700, color: P.fuchsia700,
    }}>
      <i data-lucide="lock" style={{ width: 12, height: 12 }} />
      Reserved
    </span>
  ) : null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      height: 44, padding: '0 12px 0 10px',
      background: F.surface,
      border: `1.5px solid ${status === 'available' ? F.success600 : P.fuchsia300}`,
      borderRadius: 8,
      boxShadow: status === 'available'
        ? '0 0 0 3px rgba(5,150,105,0.08)'
        : '0 0 0 3px rgba(216,70,239,0.10)',
    }}>
      <span style={{
        color: P.fuchsia600, fontSize: 14, fontWeight: 700, letterSpacing: -0.3,
        fontFamily: 'ui-monospace, Menlo, monospace',
      }}>@</span>
      <span style={{
        flex: 1, fontSize: 14, color: F.fg1, fontWeight: 600, letterSpacing: -0.1,
        fontFamily: 'ui-monospace, Menlo, monospace',
      }}>{value}</span>
      {right}
    </div>
  );
}

// ─── Category policy · allow + off-topic chip rows ────────────

function CatChip({ label, icon, kind = 'on' }) {
  // kind: on (allowed) | off (excluded) | empty (selectable)
  const styles = {
    on: { bg: P.fuchsia50, fg: P.fuchsia700, bd: P.fuchsia200 },
    off: { bg: F.sunken, fg: F.fg3, bd: F.borderSub },
    empty: { bg: F.surface, fg: F.fg2, bd: F.border },
  }[kind];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '6px 11px', borderRadius: 9999,
      background: styles.bg, color: styles.fg,
      border: `1px solid ${styles.bd}`,
      fontSize: 12, fontWeight: 600,
      textDecoration: kind === 'off' ? 'line-through' : 'none',
      textDecorationColor: 'rgba(107,114,128,0.5)',
    }}>
      {icon && (
        <i data-lucide={icon} style={{ width: 12, height: 12, opacity: 0.9 }} />
      )}
      {label}
    </span>
  );
}

function PolicyRow({ kind, title, sub, chips }) {
  const tint = kind === 'allow'
    ? { bg: '#f0fdf4', bd: '#bbf7d0', dot: F.success600, text: F.success, icon: 'check' }
    : { bg: F.sunken,  bd: F.border,  dot: F.fg4,        text: F.fg2,     icon: 'minus' };
  return (
    <div style={{
      border: `1px solid ${tint.bd}`, borderRadius: 12,
      background: tint.bg, padding: '10px 12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%',
          background: tint.dot, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i data-lucide={tint.icon} style={{ width: 11, height: 11, strokeWidth: 3 }} />
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: tint.text, letterSpacing: -0.05 }}>
          {title}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 10.5, color: F.fg3 }}>{sub}</div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {chips.map(c => (
          <CatChip key={c.label} {...c} kind={kind === 'allow' ? 'on' : 'off'} />
        ))}
      </div>
    </div>
  );
}

// ─── Tier card ────────────────────────────────────────────────

function TierCard({ name, kind, price, period, blurb, perks, stripeState, fresh }) {
  // kind: 'free' | 'paid' | 'paid-locked'
  const locked = kind === 'paid-locked';
  return (
    <div style={{
      background: F.surface,
      border: `1px solid ${fresh ? P.fuchsia200 : F.border}`,
      borderRadius: 12, padding: '12px 12px 14px',
      position: 'relative',
      boxShadow: fresh ? '0 0 0 3px rgba(216,70,239,0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
      opacity: locked ? 0.96 : 1,
    }}>
      {locked && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 12,
          background: 'rgba(249,250,251,0.55)', pointerEvents: 'none',
        }} />
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, position: 'relative' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8, flexShrink: 0,
          background: kind === 'free'
            ? F.sunken
            : 'linear-gradient(135deg,#fae8ff,#f5d0fe)',
          color: kind === 'free' ? F.fg2 : P.fuchsia700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: kind === 'free' ? `1px solid ${F.border}` : `1px solid ${P.fuchsia200}`,
        }}>
          <i data-lucide={kind === 'free' ? 'users' : (locked ? 'lock' : 'gem')}
             style={{ width: 16, height: 16 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: F.fg1, letterSpacing: -0.1 }}>
              {name}
            </span>
            {kind === 'free' && (
              <span style={{ fontSize: 11, color: F.fg3, fontWeight: 500 }}>Always free</span>
            )}
            {kind !== 'free' && (
              <span style={{
                fontSize: 14, fontWeight: 700, color: locked ? F.fg4 : F.fg1, letterSpacing: -0.2,
                fontFamily: 'ui-monospace, Menlo, monospace',
              }}>
                ${price}
                <span style={{ fontSize: 11, color: F.fg3, fontWeight: 500 }}> / {period}</span>
              </span>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: F.fg3, marginTop: 3, lineHeight: '15px' }}>
            {blurb}
          </div>
        </div>
        {!locked && (
          <button style={{
            background: 'transparent', border: 'none', padding: 4, cursor: 'pointer',
            color: F.fg4,
          }}>
            <i data-lucide="settings-2" style={{ width: 15, height: 15 }} />
          </button>
        )}
      </div>
      {perks && (
        <div style={{
          marginTop: 10, paddingLeft: 46,
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {perks.map(p => (
            <div key={p} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 11.5, color: F.fg2,
            }}>
              <i data-lucide="check" style={{ width: 12, height: 12, color: P.fuchsia600, flexShrink: 0 }} />
              {p}
            </div>
          ))}
        </div>
      )}
      {stripeState && (
        <div style={{
          marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${F.border}`,
          display: 'flex', alignItems: 'center', gap: 7,
          fontSize: 11, color: stripeState === 'ready' ? F.success : P.fuchsia700,
          fontWeight: 600, letterSpacing: -0.05,
        }}>
          <i data-lucide={stripeState === 'ready' ? 'shield-check' : 'plug-2'}
             style={{ width: 12, height: 12 }} />
          {stripeState === 'ready'
            ? 'Stripe ready · payouts every Friday'
            : 'Connect Stripe to enable paid tiers'}
        </div>
      )}
    </div>
  );
}

function AddTierRow({ disabled }) {
  return (
    <button disabled={disabled} style={{
      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
      padding: '11px 14px', borderRadius: 10,
      background: 'transparent',
      border: `1.5px dashed ${disabled ? F.border : P.fuchsia200}`,
      color: disabled ? F.fg4 : P.fuchsia700,
      fontSize: 13, fontWeight: 600, letterSpacing: -0.1,
      cursor: disabled ? 'not-allowed' : 'pointer', textAlign: 'left',
    }}>
      <i data-lucide="plus-circle" style={{ width: 15, height: 15 }} />
      <span style={{ flex: 1 }}>Add paid tier</span>
      <span style={{ fontSize: 10, color: F.fg4, fontWeight: 500 }}>up to 4</span>
    </button>
  );
}

// ─── Stripe Connect onboarding card ────────────────────────────

function StripeConnectCard({ state }) {
  if (state === 'connected') {
    return (
      <div style={{
        background: '#f0fdf4', border: '1px solid #bbf7d0',
        borderRadius: 10, padding: '10px 12px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 32, height: 22, borderRadius: 4,
          background: 'linear-gradient(135deg,#635bff,#4b46c6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
          flexShrink: 0,
          fontFamily: 'ui-sans-serif, system-ui',
        }}>stripe</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: F.fg1, letterSpacing: -0.05 }}>
            Connected · acct_1Lw…q9P
          </div>
          <div style={{ fontSize: 10.5, color: F.success, marginTop: 1, fontWeight: 600,
                        display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <i data-lucide="check-circle-2" style={{ width: 10, height: 10 }} />
            Charges enabled · payouts enabled
          </div>
        </div>
        <button style={{
          background: 'transparent', border: 'none', padding: 4, cursor: 'pointer',
          color: F.primary600, fontSize: 12, fontWeight: 600,
        }}>Manage</button>
      </div>
    );
  }
  // not connected
  return (
    <div style={{
      background: P.fuchsia50, border: `1px solid ${P.fuchsia200}`,
      borderRadius: 10, padding: '12px 12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 22, borderRadius: 4,
          background: 'linear-gradient(135deg,#635bff,#4b46c6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
          flexShrink: 0, fontFamily: 'ui-sans-serif, system-ui',
        }}>stripe</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: F.fg1, letterSpacing: -0.05 }}>
            Connect Stripe to charge for tiers
          </div>
          <div style={{ fontSize: 10.5, color: F.fg3, marginTop: 1, lineHeight: '14px' }}>
            ~3 min · ID + bank account · we never touch the money.
          </div>
        </div>
      </div>
      <button style={{
        marginTop: 10, width: '100%',
        height: 38, borderRadius: 8, border: 'none',
        background: '#635bff', color: '#fff',
        fontSize: 13, fontWeight: 600, letterSpacing: -0.1, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        boxShadow: '0 4px 10px rgba(99,91,255,0.28)',
      }}>
        <i data-lucide="external-link" style={{ width: 13, height: 13 }} />
        Connect with Stripe
      </button>
    </div>
  );
}

// ─── Broadcast settings · cap selector + quiet hours ──────────

function CapSelector({ value }) {
  const opts = ['1/wk', '3/wk', 'Daily', 'Unlimited'];
  return (
    <div style={{
      display: 'flex', padding: 3, background: F.sunken,
      borderRadius: 10, border: `1px solid ${F.border}`,
    }}>
      {opts.map(o => {
        const on = o === value;
        return (
          <button key={o} style={{
            flex: 1, height: 32, borderRadius: 7, border: 'none',
            background: on ? F.surface : 'transparent',
            color: on ? F.fg1 : F.fg3,
            fontSize: 12, fontWeight: on ? 700 : 500, letterSpacing: -0.1,
            cursor: 'pointer',
            boxShadow: on ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
          }}>{o}</button>
        );
      })}
    </div>
  );
}

function QuietHours({ on, range }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px', background: F.surface,
      border: `1px solid ${F.border}`, borderRadius: 8,
    }}>
      <i data-lucide="moon" style={{ width: 16, height: 16, color: F.fg3, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: F.fg1, letterSpacing: -0.1 }}>
          Quiet hours
        </div>
        <div style={{
          fontSize: 11, color: F.fg3, marginTop: 1,
          fontFamily: 'ui-monospace, Menlo, monospace',
        }}>
          {on ? range : 'Broadcasts allowed any time'}
        </div>
      </div>
      <Toggle on={on} />
    </div>
  );
}

// ─── Share / QR card ──────────────────────────────────────────

function ShareCard({ url, variant }) {
  return (
    <div style={{
      display: 'flex', gap: 12, padding: 12,
      background: F.surface, border: `1px solid ${F.border}`,
      borderRadius: 12,
    }}>
      {/* faux QR */}
      <div style={{
        width: 84, height: 84, borderRadius: 10, padding: 6,
        background: variant === 'live' ? '#fff' : F.sunken,
        border: `1px solid ${variant === 'live' ? F.border : F.borderSub}`,
        position: 'relative', flexShrink: 0,
      }}>
        <svg viewBox="0 0 21 21" width="72" height="72" shapeRendering="crispEdges">
          {/* corners */}
          <rect x="0" y="0" width="7" height="7" fill="#000"/>
          <rect x="1" y="1" width="5" height="5" fill="#fff"/>
          <rect x="2" y="2" width="3" height="3" fill="#000"/>
          <rect x="14" y="0" width="7" height="7" fill="#000"/>
          <rect x="15" y="1" width="5" height="5" fill="#fff"/>
          <rect x="16" y="2" width="3" height="3" fill="#000"/>
          <rect x="0" y="14" width="7" height="7" fill="#000"/>
          <rect x="1" y="15" width="5" height="5" fill="#fff"/>
          <rect x="2" y="16" width="3" height="3" fill="#000"/>
          {/* random data dots */}
          {[
            [8,1],[9,2],[10,1],[11,3],[12,1],[8,3],[10,4],[12,3],
            [1,8],[3,8],[5,8],[2,9],[4,10],[1,11],[3,12],[5,11],
            [8,8],[10,8],[12,9],[14,10],[16,11],[18,8],[20,9],
            [9,12],[11,11],[13,12],[15,13],[17,14],[19,12],
            [8,14],[10,15],[12,16],[14,17],[16,18],[18,17],[20,18],
            [9,18],[11,19],[13,20],[15,19],[17,20],
          ].map(([x,y],i) => (
            <rect key={i} x={x} y={y} width="1" height="1"
                  fill={variant === 'live' ? P.fuchsia700 : F.fg3} />
          ))}
        </svg>
        {/* center glyph */}
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%,-50%)',
          width: 22, height: 22, borderRadius: 6,
          background: variant === 'live' ? P.fuchsia600 : F.fg3,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', boxShadow: '0 0 0 3px #fff',
        }}>
          <i data-lucide="radio" style={{ width: 12, height: 12 }} />
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          fontSize: 10.5, fontWeight: 700, letterSpacing: 0.06,
          color: variant === 'live' ? P.fuchsia700 : F.fg3,
          textTransform: 'uppercase',
        }}>
          {variant === 'live' ? 'Public link · scan to follow' : 'Private preview · only you'}
        </div>
        <div style={{
          marginTop: 6, padding: '6px 8px',
          background: F.muted, border: `1px solid ${F.border}`,
          borderRadius: 6,
          fontSize: 11.5, color: F.fg2,
          fontFamily: 'ui-monospace, Menlo, monospace',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{url}</div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button style={{
            flex: 1, height: 30, borderRadius: 7,
            background: variant === 'live' ? F.surface : F.sunken,
            border: `1px solid ${F.border}`,
            color: variant === 'live' ? F.fg1 : F.fg4,
            fontSize: 11.5, fontWeight: 600, letterSpacing: -0.05,
            cursor: variant === 'live' ? 'pointer' : 'not-allowed',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}>
            <i data-lucide="copy" style={{ width: 12, height: 12 }} />
            Copy
          </button>
          <button style={{
            flex: 1, height: 30, borderRadius: 7,
            background: variant === 'live' ? F.surface : F.sunken,
            border: `1px solid ${F.border}`,
            color: variant === 'live' ? F.fg1 : F.fg4,
            fontSize: 11.5, fontWeight: 600, letterSpacing: -0.05,
            cursor: variant === 'live' ? 'pointer' : 'not-allowed',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}>
            <i data-lucide="share-2" style={{ width: 12, height: 12 }} />
            Share
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Analytics opt-in card ────────────────────────────────────

function AnalyticsRow({ on, scope }) {
  return (
    <div style={{ padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9,
          background: on ? P.fuchsia50 : F.sunken,
          color: on ? P.fuchsia600 : F.fg4,
          border: `1px solid ${on ? P.fuchsia200 : F.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <i data-lucide="bar-chart-3" style={{ width: 16, height: 16 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: F.fg1, letterSpacing: -0.1 }}>
            Audience analytics
          </div>
          <div style={{ fontSize: 11, color: F.fg3, marginTop: 2, lineHeight: '15px' }}>
            Aggregated reach &amp; growth — never individual followers.
          </div>
        </div>
        <Toggle on={on} />
      </div>
      {on && scope && (
        <div style={{
          marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6,
        }}>
          {scope.map(s => (
            <span key={s} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 9px', borderRadius: 9999,
              background: P.fuchsia50, color: P.fuchsia700,
              border: `1px solid ${P.fuchsia200}`,
              fontSize: 10.5, fontWeight: 600,
            }}>
              <i data-lucide="check" style={{ width: 10, height: 10 }} />
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sticky save · live vs setup ──────────────────────────────

function PersonaSticky({ variant }) {
  if (variant === 'live') {
    return (
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderTop: `1px solid ${F.border}`,
        padding: '10px 16px 26px',
        display: 'flex', gap: 10, alignItems: 'center',
        zIndex: 10,
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          color: F.fg3, fontSize: 11.5, fontWeight: 500,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', background: F.success600,
            boxShadow: '0 0 0 3px rgba(5,150,105,0.16)',
          }} />
          Live · saved 2m ago
        </div>
        <div style={{ flex: 1 }} />
        <button style={{
          height: 42, padding: '0 14px', borderRadius: 10,
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: F.fg2, fontSize: 13.5, fontWeight: 600, letterSpacing: -0.1,
          display: 'inline-flex', alignItems: 'center', gap: 5,
        }}>
          <i data-lucide="eye" style={{ width: 14, height: 14 }} />
          Preview
        </button>
        <button disabled style={{
          height: 42, padding: '0 22px', borderRadius: 10, border: 'none',
          background: '#e5e7eb', color: F.fg4,
          fontSize: 14, fontWeight: 600, letterSpacing: -0.1,
          cursor: 'not-allowed',
        }}>Save</button>
      </div>
    );
  }
  // setup
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'rgba(255,255,255,0.96)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      borderTop: `1px solid ${F.border}`,
      padding: '10px 16px 26px',
      zIndex: 10,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 8, padding: '6px 10px', borderRadius: 8,
        background: P.fuchsia50, border: `1px solid ${P.fuchsia200}`,
      }}>
        <i data-lucide="info" style={{ width: 13, height: 13, color: P.fuchsia700, flexShrink: 0 }} />
        <span style={{ fontSize: 11.5, color: P.fuchsia700, fontWeight: 600, flex: 1, lineHeight: '14px' }}>
          Save anytime — publish unlocks after Stripe + schedule
        </span>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 9999,
          background: '#fef3c7', border: '1px solid #fde68a',
          color: '#92400e', fontSize: 11, fontWeight: 700, letterSpacing: 0.1,
          textTransform: 'uppercase',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: '#f59e0b',
          }} />
          7 unsaved
        </div>
        <div style={{ flex: 1 }} />
        <button style={{
          height: 42, padding: '0 14px', borderRadius: 10,
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: F.fg2, fontSize: 13.5, fontWeight: 600, letterSpacing: -0.1,
        }}>Discard</button>
        <button style={{
          height: 42, padding: '0 22px', borderRadius: 10, border: 'none',
          background: P.fuchsia600, color: '#fff',
          fontSize: 14, fontWeight: 600, letterSpacing: -0.1, cursor: 'pointer',
          boxShadow: '0 6px 16px rgba(192,38,211,0.32)',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <i data-lucide="check" style={{ width: 15, height: 15 }} />
          Save draft
        </button>
      </div>
    </div>
  );
}

// ─── FRAME · LIVE (published, monetized) ───────────────────────

const LIVE_CATEGORIES_ALLOW = [
  { label: 'Block-watch updates', icon: 'shield' },
  { label: 'Lost & found',        icon: 'help-circle' },
  { label: 'Local events',        icon: 'calendar-days' },
  { label: 'Repair logs',         icon: 'wrench' },
  { label: 'Restoration photos',  icon: 'image' },
];
const LIVE_CATEGORIES_OFF = [
  { label: 'Politics',           icon: 'flag' },
  { label: 'Off-block listings', icon: 'ban' },
];

const SETUP_CATEGORIES_ALLOW = [
  { label: 'Block-watch updates', icon: 'shield' },
  { label: 'Lost & found',        icon: 'help-circle' },
  { label: 'Local events',        icon: 'calendar-days' },
];
const SETUP_CATEGORIES_OFF = [
  { label: 'Politics',     icon: 'flag' },
  { label: 'Sponsored',    icon: 'megaphone' },
];

function FramePersonaLive() {
  return (
    <Phone>
      <PersonaTopBar title="Edit persona" handle="@elmpark.watch" />
      <ScrollArea bottomPad={120}>

        <PersonaHeader
          variant="live"
          displayName="Elm Park Watch"
          followers="2,340"
          posts="46"
          tier="Live"
        />

        <Section overline="Identity">
          <div>
            <PLabel required hint="lowercase · 3–24 chars">Handle</PLabel>
            <HandleField value="elmpark.watch" status="reserved" />
          </div>
          <div>
            <PLabel required>Display name</PLabel>
            <Input value="Elm Park Watch" />
          </div>
          <div>
            <PLabel>Bio</PLabel>
            <Textarea
              value="Block-by-block updates for Elm Park. Lost cat? Open hydrant? Watch-meeting notes? It's here. Run by Maria K. since 2022."
              height={88}
              charCount="129 / 240"
            />
          </div>
        </Section>

        <Section overline="Category policy">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <PolicyRow
              kind="allow"
              title="Allowed on this persona"
              sub="5 of 12"
              chips={LIVE_CATEGORIES_ALLOW}
            />
            <PolicyRow
              kind="off"
              title="Off-topic — blocked auto-suggest"
              sub="2 of 12"
              chips={LIVE_CATEGORIES_OFF}
            />
          </div>
          <div style={{ fontSize: 11, color: F.fg3, marginTop: 4, fontStyle: 'italic' }}>
            Pantopus won't auto-suggest blocked categories when you compose.
          </div>
        </Section>

        <Section overline="Tiers">
          <StripeConnectCard state="connected" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <TierCard
              name="Neighbor"
              kind="free"
              blurb="Public posts, weekly digest, lost &amp; found alerts."
            />
            <TierCard
              name="Block Member"
              kind="paid"
              price="3"
              period="mo"
              blurb="Restoration photo set + member-only repair logs."
              perks={['Members-only photos', 'Monthly Q&A thread']}
              stripeState="ready"
            />
            <TierCard
              name="Patron"
              kind="paid"
              price="8"
              period="mo"
              blurb="Everything in Block Member plus quarterly print zine."
              perks={['Quarterly zine, mailed', 'Name in masthead']}
              stripeState="ready"
            />
            <AddTierRow />
          </div>
        </Section>

        <Section overline="Broadcast">
          <div>
            <PLabel hint="hard cap, not a target">Posts per week</PLabel>
            <CapSelector value="3/wk" />
          </div>
          <QuietHours on={true} range="10:00 PM → 7:00 AM · America/New_York" />
        </Section>

        <Section overline="Share">
          <ShareCard variant="live" url="pantopus.app/@elmpark.watch" />
        </Section>

        <Section overline="Analytics" gap={0}>
          <Card padding={0}>
            <AnalyticsRow
              on={true}
              scope={['Follower growth', 'Reach (aggregate)', 'Tier conversion']}
            />
          </Card>
        </Section>

      </ScrollArea>
      <PersonaSticky variant="live" />
    </Phone>
  );
}

// ─── FRAME · SETUP (draft, pre-Stripe) ─────────────────────────

function FramePersonaSetup() {
  return (
    <Phone>
      <PersonaTopBar title="Edit persona" handle="@sourdough.sat" />
      <ScrollArea bottomPad={150}>

        <PersonaHeader variant="setup" />

        <Section overline="Identity">
          <div>
            <PLabel required hint="lowercase · 3–24 chars" dirty>Handle</PLabel>
            <HandleField value="sourdough.sat" status="available" />
            <div style={{ fontSize: 11, color: F.success, marginTop: 6, fontWeight: 500,
                          display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <i data-lucide="check-circle-2" style={{ width: 11, height: 11 }} />
              Reserved for 24h while you finish setup.
            </div>
          </div>
          <div>
            <PLabel required dirty>Display name</PLabel>
            <Input value="Sourdough Saturdays" />
          </div>
          <div>
            <PLabel dirty>Bio</PLabel>
            <Textarea
              value="Weekend bake-swap on Elm Park. Trade a loaf, take a loaf. Bench fee feeds the starter."
              height={88}
              charCount="91 / 240"
            />
          </div>
        </Section>

        <Section overline="Category policy">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <PolicyRow
              kind="allow"
              title="Allowed on this persona"
              sub="3 of 12"
              chips={SETUP_CATEGORIES_ALLOW}
            />
            <PolicyRow
              kind="off"
              title="Off-topic — blocked auto-suggest"
              sub="2 of 12"
              chips={SETUP_CATEGORIES_OFF}
            />
          </div>
        </Section>

        <Section overline="Tiers">
          <StripeConnectCard state="not-connected" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <TierCard
              name="Crumb (free)"
              kind="free"
              blurb="Saturday swap location + bake-log photos."
            />
            <TierCard
              name="Loaf Patron"
              kind="paid-locked"
              price="—"
              period="mo"
              blurb="Set after Stripe is connected. Suggested: $4/mo."
              stripeState="needs-stripe"
              fresh
            />
            <AddTierRow disabled />
          </div>
        </Section>

        <Section overline="Broadcast">
          <div>
            <PLabel hint="hard cap, not a target">Posts per week</PLabel>
            <CapSelector value="1/wk" />
          </div>
          <QuietHours on={false} range="" />
        </Section>

        <Section overline="Share">
          <ShareCard
            variant="setup"
            url="pantopus.app/@sourdough.sat (draft)"
          />
        </Section>

        <Section overline="Analytics" gap={0}>
          <Card padding={0}>
            <AnalyticsRow on={false} />
          </Card>
        </Section>

      </ScrollArea>
      <PersonaSticky variant="setup" />
    </Phone>
  );
}

Object.assign(window, { FramePersonaLive, FramePersonaSetup });
