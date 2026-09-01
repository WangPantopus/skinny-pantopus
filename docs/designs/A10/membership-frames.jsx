// A10.8 — Fan membership manage (src/app/audience/membership/[personaId]/index.tsx)
// Archetype: A10 — Detail: Content · variant: membership_manage (header + tier + actions)
// Two frames: populated (happy path) + SLA-missed (refund-eligible secondary state)

const M = {
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
  successBg: '#d1fae5',
  warning600:'#d97706',
  warningBg: '#fef3c7',
  warningRing:'#fcd34d',
  amber:     '#b45309',
  amberDeep: '#92400e',
  errorBg:   '#fee2e2',
  error600:  '#dc2626',
  bizBg:     '#ede9fe',
  biz:       '#6d28d9',
  bizDeep:   '#5b21b6',
  // tier tokens
  bronzeBg:  '#fef3c7', bronzeOn: '#92400e',
  silverBg:  '#f1f3f5', silverOn: '#374151', silverAccent: '#6b7280',
  goldBg:    '#fef9c3', goldOn:   '#854d0e', goldAccent:   '#ca8a04',
};

// ─── Phone shell ──────────────────────────────────────────────

function MSB() {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '16px 28px 0', height: 44, boxSizing: 'border-box',
      fontFamily: '-apple-system, system-ui', fontWeight: 600, fontSize: 15, color: M.fg1,
    }}>
      <span>9:41</span>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={M.fg1}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={M.fg1}/><rect x="9" y="2" width="3" height="9" rx="0.6" fill={M.fg1}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={M.fg1}/></svg>
        <svg width="15" height="11" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={M.fg1}/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={M.fg1}/><circle cx="7.5" cy="9" r="1.3" fill={M.fg1}/></svg>
        <svg width="24" height="11" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={M.fg1} strokeOpacity="0.35" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill={M.fg1}/><path d="M22.5 3.8v3.4c.6-.2 1-.8 1-1.7s-.4-1.5-1-1.7z" fill={M.fg1} fillOpacity="0.4"/></svg>
      </div>
    </div>
  );
}

function MPhone({ children }) {
  return (
    <div style={{
      width: 360, height: 740, borderRadius: 46, padding: 10,
      background: '#0b0f17',
      boxShadow: '0 40px 80px rgba(17,24,39,0.22), 0 0 0 1px rgba(0,0,0,0.14)',
    }}>
      <div style={{
        width: '100%', height: '100%', background: M.bg,
        borderRadius: 36, overflow: 'hidden', position: 'relative',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          position: 'absolute', top: 9, left: '50%', transform: 'translateX(-50%)',
          width: 108, height: 30, borderRadius: 20, background: '#000', zIndex: 50,
        }} />
        <MSB />
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

function MTopBar() {
  const Btn = ({ icon }) => (
    <button style={{
      width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'transparent', border: 'none', cursor: 'pointer', color: M.fg1, padding: 0,
      borderRadius: 8,
    }}>
      <i data-lucide={icon} style={{ width: 20, height: 20 }} />
    </button>
  );
  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '4px 8px',
      height: 48, boxSizing: 'border-box',
      background: M.surface, borderBottom: `1px solid ${M.border}`,
      flexShrink: 0, zIndex: 5,
    }}>
      <Btn icon="chevron-left" />
      <div style={{
        flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600,
        color: M.fg1, letterSpacing: -0.15,
      }}>Fan membership</div>
      <Btn icon="more-horizontal" />
    </div>
  );
}

function MVerifBadge({ size = 14, color = M.biz, ring = 2 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color,
      border: `${ring}px solid #fff`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxSizing: 'content-box',
    }}>
      <i data-lucide="check" style={{ width: size * 0.6, height: size * 0.6, color: '#fff', strokeWidth: 4 }} />
    </div>
  );
}

function MAvatar({ size, initials, bg, verified, verifColor }) {
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: '50%', background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 700,
        fontSize: size >= 64 ? 24 : size >= 40 ? 15 : size >= 32 ? 12 : 10,
      }}>{initials}</div>
      {verified && (
        <div style={{ position: 'absolute', right: -2, bottom: -2 }}>
          <MVerifBadge size={size >= 48 ? 14 : 11} color={verifColor || M.biz} />
        </div>
      )}
    </div>
  );
}

function Overline({ children, action }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      marginTop: 16, marginBottom: 8,
    }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: 0.08,
        textTransform: 'uppercase', color: M.fg3,
      }}>{children}</div>
      {action && (
        <button style={{
          background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
          fontSize: 11.5, color: M.primary600, fontWeight: 600,
        }}>{action}</button>
      )}
    </div>
  );
}

// ─── Persona block ───────────────────────────────────────────

function PersonaCard() {
  return (
    <div style={{
      background: M.surface, border: `1px solid ${M.border}`,
      borderRadius: 14, padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <MAvatar size={44} initials="LC" bg="linear-gradient(135deg,#a78bfa,#6d28d9)" verified />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 14, fontWeight: 700, color: M.fg1, letterSpacing: -0.15,
        }}>
          Lara Chen
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '1px 6px 1px 5px', borderRadius: 9999,
            background: M.bizBg, color: M.bizDeep,
            fontSize: 9.5, fontWeight: 700, letterSpacing: 0.04, textTransform: 'uppercase',
          }}>
            <i data-lucide="briefcase" style={{ width: 9, height: 9, strokeWidth: 2.5 }} />
            Business
          </span>
        </div>
        <div style={{ fontSize: 11.5, color: M.fg3, marginTop: 1 }}>
          Elm Park Eats · food critic · 1,240 members
        </div>
      </div>
      <i data-lucide="chevron-right" style={{ width: 16, height: 16, color: M.fg4 }} />
    </div>
  );
}

// ─── Tier card ───────────────────────────────────────────────

function TierCard({ name, price, period, renewsOn, paymentLast4, statusTone }) {
  return (
    <div style={{
      background: M.surface, border: `1px solid ${M.border}`,
      borderRadius: 16, overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
    }}>
      {/* Tier head — silver tone strip */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px',
        background: M.silverBg,
        borderBottom: `1px solid ${M.border}`,
      }}>
        <div>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 0.08,
            textTransform: 'uppercase', color: M.silverAccent,
          }}>Your tier</div>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2,
          }}>
            <div style={{
              fontSize: 22, fontWeight: 800, color: M.silverOn,
              letterSpacing: -0.4,
            }}>{name}</div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '2px 8px', borderRadius: 9999,
              background: '#fff', color: M.silverAccent,
              border: `1px solid ${M.border}`,
              fontSize: 10, fontWeight: 700, letterSpacing: 0.04, textTransform: 'uppercase',
            }}>
              <i data-lucide="medal" style={{ width: 10, height: 10, strokeWidth: 2.2 }} />
              2 of 3
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 22, fontWeight: 800, color: M.fg1, letterSpacing: -0.4,
          }}>
            ${price}
          </div>
          <div style={{ fontSize: 11, color: M.fg3 }}>/ {period}</div>
        </div>
      </div>

      {/* Renewal row */}
      <div style={{
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: `1px solid ${M.borderSub}`,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, background: M.primary50,
          color: M.primary600,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i data-lucide="calendar-clock" style={{ width: 15, height: 15, strokeWidth: 2 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: M.fg3 }}>Next renewal</div>
          <div style={{
            fontSize: 13, fontWeight: 600, color: statusTone === 'warn' ? M.amberDeep : M.fg1,
            letterSpacing: -0.1, marginTop: 1,
          }}>
            {renewsOn}
          </div>
        </div>
      </div>

      {/* Payment row */}
      <div style={{
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, background: M.sunken,
          color: M.fg2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i data-lucide="credit-card" style={{ width: 15, height: 15, strokeWidth: 2 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: M.fg3 }}>Payment</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: M.fg1, letterSpacing: -0.1, marginTop: 1 }}>
            Visa •••• {paymentLast4}
          </div>
        </div>
        <span style={{
          fontSize: 11.5, color: M.primary600, fontWeight: 600,
        }}>Manage</span>
        <i data-lucide="chevron-right" style={{ width: 14, height: 14, color: M.fg4 }} />
      </div>
    </div>
  );
}

// ─── Benefits ────────────────────────────────────────────────

function Benefits() {
  const perks = [
    { icon: 'mail',            label: 'Weekly newsletter',           meta: 'Sunday mornings' },
    { icon: 'message-circle',  label: 'Monthly inbox AMA',           meta: 'Reply within 48h · SLA' },
    { icon: 'camera-off',      label: 'Behind-the-scenes photos',    meta: '~6 posts / month' },
    { icon: 'percent',         label: '10% off Lara\u2019s tastings', meta: 'Code auto-applied' },
  ];
  return (
    <div style={{
      background: M.surface, border: `1px solid ${M.border}`,
      borderRadius: 14, padding: '4px 0',
    }}>
      {perks.map((p, i) => (
        <div key={p.label} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 14px',
          borderBottom: i < perks.length - 1 ? `1px solid ${M.borderSub}` : 'none',
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7, background: M.successBg,
            color: M.success600,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <i data-lucide="check" style={{ width: 14, height: 14, strokeWidth: 2.5 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 12.5, fontWeight: 600, color: M.fg1, letterSpacing: -0.1,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <i data-lucide={p.icon} style={{ width: 13, height: 13, color: M.fg3, strokeWidth: 2 }} />
              {p.label}
            </div>
            <div style={{ fontSize: 10.5, color: M.fg3, marginTop: 1, paddingLeft: 19 }}>{p.meta}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Inbox row ───────────────────────────────────────────────

function InboxRow({ unread }) {
  return (
    <div style={{
      background: M.surface, border: `1px solid ${M.border}`,
      borderRadius: 14, padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, background: M.primary50,
        color: M.primary600, position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <i data-lucide="inbox" style={{ width: 18, height: 18, strokeWidth: 2 }} />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            minWidth: 16, height: 16, padding: '0 4px', borderRadius: 9999,
            background: M.error600, color: '#fff',
            border: '2px solid #fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9.5, fontWeight: 700,
          }}>{unread}</span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: M.fg1, letterSpacing: -0.1,
        }}>Membership inbox</div>
        <div style={{ fontSize: 11, color: M.fg3, marginTop: 1 }}>
          {unread > 0
            ? `${unread} new reply from Lara · 2h ago`
            : 'No new messages'}
        </div>
      </div>
      <i data-lucide="chevron-right" style={{ width: 16, height: 16, color: M.fg4 }} />
    </div>
  );
}

// ─── Primary CTA ─────────────────────────────────────────────

function ChangeTierCTA() {
  return (
    <button style={{
      width: '100%', height: 50, borderRadius: 14, border: 'none',
      background: M.primary600, color: '#fff',
      fontSize: 15, fontWeight: 700, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      letterSpacing: -0.15,
      boxShadow: '0 6px 16px rgba(2,132,199,.28)',
    }}>
      <i data-lucide="arrow-up-down" style={{ width: 17, height: 17 }} />
      Change tier
    </button>
  );
}

// ─── Cancel block (single-tap by policy) ─────────────────────

function CancelBlock() {
  return (
    <div style={{ marginTop: 16, textAlign: 'center' }}>
      <button style={{
        background: 'transparent', border: 'none', padding: '6px 8px',
        cursor: 'pointer',
        fontSize: 13, color: M.fg3, fontWeight: 600,
        display: 'inline-flex', alignItems: 'center', gap: 6,
        letterSpacing: -0.05,
      }}>
        <i data-lucide="log-out" style={{ width: 13, height: 13 }} />
        Cancel membership
      </button>
      <div style={{
        marginTop: 6,
        fontSize: 10.5, color: M.fg4, lineHeight: '14px', maxWidth: 260, margin: '6px auto 0',
      }}>
        Single-tap cancel. No retention questions, no last-second offers.
        <br />
        <span style={{ color: M.fg3, fontWeight: 600 }}>— Pantopus policy</span>
      </div>
    </div>
  );
}

// ─── SLA-missed banner (Frame 2) ─────────────────────────────

function SLABanner() {
  return (
    <div style={{
      background: M.warningBg, border: `1px solid ${M.warningRing}`,
      borderRadius: 14, padding: '14px 14px 13px',
      boxShadow: '0 1px 3px rgba(217,119,6,0.08)',
    }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10, background: M.warning600,
          color: '#fff', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i data-lucide="alert-triangle" style={{ width: 17, height: 17, strokeWidth: 2.3 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13.5, fontWeight: 700, color: M.amberDeep,
            letterSpacing: -0.15, marginBottom: 3,
          }}>Lara owes you a reply</div>
          <div style={{
            fontSize: 12, color: M.amberDeep, lineHeight: '16px', opacity: 0.9,
          }}>
            Silver promises a 48h inbox reply. Your last 2 messages have gone unanswered
            for <b>5 days</b>. You’re eligible for a one-month refund.
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button style={{
          flex: 1.4, height: 38, borderRadius: 10, border: 'none',
          background: M.amberDeep, color: '#fff',
          fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          letterSpacing: -0.05,
        }}>
          <i data-lucide="undo-2" style={{ width: 13, height: 13 }} />
          Refund this month · $8
        </button>
        <button style={{
          flex: 1, height: 38, borderRadius: 10,
          border: `1px solid ${M.warningRing}`,
          background: 'transparent', color: M.amberDeep,
          fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
          letterSpacing: -0.05,
        }}>
          Give it a week
        </button>
      </div>
    </div>
  );
}

// ─── FRAME 1 — Populated, happy path ─────────────────────────

function FrameMembershipPopulated() {
  return (
    <MPhone>
      <MTopBar />
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px 32px' }}>
        <Overline>You support</Overline>
        <PersonaCard />

        <Overline>Your membership</Overline>
        <TierCard
          name="Silver"
          price="8"
          period="month"
          renewsOn="Dec 12, 2026 · in 22 days"
          paymentLast4="4242"
        />

        <Overline>What you get</Overline>
        <Benefits />

        <div style={{ marginTop: 20 }}>
          <ChangeTierCTA />
        </div>

        <Overline>Talk to Lara</Overline>
        <InboxRow unread={1} />

        <CancelBlock />
      </div>
    </MPhone>
  );
}

// ─── FRAME 2 — Secondary: SLA-missed, refund eligible ───────

function FrameMembershipSLA() {
  return (
    <MPhone>
      <MTopBar />
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px 32px' }}>
        {/* SLA banner pinned above everything */}
        <div style={{ marginTop: 8, marginBottom: 4 }}>
          <SLABanner />
        </div>

        <Overline>You support</Overline>
        <PersonaCard />

        <Overline>Your membership</Overline>
        <TierCard
          name="Silver"
          price="8"
          period="month"
          renewsOn="Dec 12, 2026 · in 22 days"
          paymentLast4="4242"
          statusTone="warn"
        />

        <Overline>What you get</Overline>
        <Benefits />

        <div style={{ marginTop: 20 }}>
          <ChangeTierCTA />
        </div>

        <Overline>Talk to Lara</Overline>
        <InboxRow unread={0} />

        <CancelBlock />
      </div>
    </MPhone>
  );
}

Object.assign(window, { FrameMembershipPopulated, FrameMembershipSLA });
