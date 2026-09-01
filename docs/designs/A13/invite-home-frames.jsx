// Pantopus — A13.7 · Invite to home
// File: src/app/homes/invite.tsx
// Archetype: A13 — Form (single screen), simple variant.
// Differs from A13.5 Invite Owner: this is the general invite — any role,
// any contact channel, and a freeform note. Pulled into homes/ root (not nested
// under owners/) because residents, helpers, and guests don't need the
// ownership-grant flow.
//
// Two frames:
//   FrameInviteHomeCompose — populated: contact, role, note all filled
//   FrameInviteHomeSent    — secondary: invite sent, delivery + next steps

const {
  F, Phone, TopBar, FieldLabel,
  Input, Textarea, Section, ScrollArea, Card,
} = window;

// ─── Home strip ────────────────────────────────────────────────

function HomeStrip() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px', background: F.muted,
      border: `1px solid ${F.border}`, borderRadius: 10,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 9,
        background: 'linear-gradient(135deg,#22c55e,#15803d)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', flexShrink: 0,
      }}>
        <i data-lucide="home" style={{ width: 15, height: 15 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: F.fg1, letterSpacing: -0.1 }}>
          412 Elm Street
        </div>
        <div style={{ fontSize: 11, color: F.fg3, marginTop: 1 }}>
          3 owners · 5 residents · 2 helpers
        </div>
      </div>
    </div>
  );
}

// ─── Channel toggle: Email | Phone ─────────────────────────────

function ChannelToggle({ value }) {
  return (
    <div style={{
      display: 'flex', padding: 3, background: F.sunken,
      border: `1px solid ${F.border}`, borderRadius: 10, gap: 2,
    }}>
      {[
        { id: 'email', label: 'Email', icon: 'mail' },
        { id: 'phone', label: 'Phone', icon: 'phone' },
      ].map(o => {
        const on = o.id === value;
        return (
          <button key={o.id} style={{
            flex: 1, height: 34, borderRadius: 8, border: 'none',
            background: on ? F.surface : 'transparent',
            color: on ? F.fg1 : F.fg3,
            fontSize: 13, fontWeight: on ? 600 : 500, letterSpacing: -0.05,
            cursor: 'pointer',
            boxShadow: on ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}>
            <i data-lucide={o.icon} style={{ width: 13, height: 13 }} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Contact suggestion (matched neighbor) ─────────────────────

function MatchedContact() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px',
      background: F.successBg, border: '1px solid #a7f3d0',
      borderRadius: 10,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: 'linear-gradient(135deg,#0ea5e9,#0369a1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 10.5, fontWeight: 700, letterSpacing: -0.2,
        flexShrink: 0,
      }}>JC</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12.5, fontWeight: 600, color: F.fg1, letterSpacing: -0.1,
          display: 'inline-flex', alignItems: 'center', gap: 5,
        }}>
          Jin Chen
          <i data-lucide="badge-check" style={{
            width: 12, height: 12, color: F.success600,
          }} />
        </div>
        <div style={{ fontSize: 10.5, color: F.fg3, marginTop: 1 }}>
          Already on Pantopus · 2 mutual friends
        </div>
      </div>
      <span style={{
        fontSize: 9, fontWeight: 700, letterSpacing: 0.08,
        color: F.success, background: '#fff',
        border: '1px solid #a7f3d0',
        padding: '3px 6px', borderRadius: 4, textTransform: 'uppercase',
      }}>Match</span>
    </div>
  );
}

// ─── Role picker rows ──────────────────────────────────────────

function RolePicker({ value = 'resident' }) {
  const roles = [
    {
      id: 'resident', icon: 'bed', name: 'Resident',
      sub: 'Lives at home. Can post, edit shared logs, invite guests.',
      color: F.primary600, tint: F.primary50, ring: F.primary100,
    },
    {
      id: 'helper', icon: 'sparkles', name: 'Helper',
      sub: 'Maintenance, dog-sit, cleaning. Scoped access only.',
      color: '#0e7490', tint: '#cffafe', ring: '#a5f3fc',
    },
    {
      id: 'guest', icon: 'door-open', name: 'Guest',
      sub: 'Short stays. Read-only on house notes, gets the entry code.',
      color: '#9a3412', tint: '#fff7ed', ring: '#fed7aa',
    },
  ];

  return (
    <Card padding={0}>
      {roles.map((r, i) => {
        const on = r.id === value;
        return (
          <label key={r.id} style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            padding: '12px 14px', cursor: 'pointer',
            borderBottom: i < roles.length - 1 ? `1px solid ${F.borderSub}` : 'none',
            background: on ? F.primary50 : 'transparent',
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: on ? r.color : F.sunken,
              color: on ? '#fff' : F.fg2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, marginTop: 1,
            }}>
              <i data-lucide={r.icon} style={{ width: 15, height: 15 }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13.5, fontWeight: 600,
                color: on ? F.primary700 : F.fg1, letterSpacing: -0.1,
              }}>{r.name}</div>
              <div style={{
                fontSize: 11.5, color: on ? F.primary600 : F.fg3,
                marginTop: 2, lineHeight: '16px',
              }}>{r.sub}</div>
            </div>
            <div style={{
              width: 18, height: 18, borderRadius: '50%',
              border: `1.5px solid ${on ? F.primary600 : F.borderStrong}`,
              background: on ? F.primary600 : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, marginTop: 4,
            }}>
              {on && <span style={{
                width: 7, height: 7, borderRadius: '50%', background: '#fff',
              }} />}
            </div>
          </label>
        );
      })}
    </Card>
  );
}

// ─── Sticky CTA ────────────────────────────────────────────────

function StickyCTA({ label, sub, icon = 'send', disabled }) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'rgba(255,255,255,0.96)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      borderTop: `1px solid ${F.border}`,
      padding: '12px 16px 28px', zIndex: 10,
    }}>
      <button disabled={disabled} style={{
        width: '100%', height: 48, borderRadius: 12, border: 'none',
        background: disabled ? '#e5e7eb' : F.primary600,
        color: disabled ? F.fg4 : '#fff',
        fontSize: 15, fontWeight: 600, letterSpacing: -0.1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled ? 'none' : '0 6px 16px rgba(2,132,199,0.28)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <i data-lucide={icon} style={{ width: 17, height: 17 }} />
        {label}
      </button>
      {sub && (
        <div style={{
          textAlign: 'center', fontSize: 11, color: F.fg3,
          marginTop: 6, letterSpacing: -0.05,
        }}>{sub}</div>
      )}
    </div>
  );
}

// ─── FRAME 1 · POPULATED ───────────────────────────────────────

function FrameInviteHomeCompose() {
  return (
    <Phone>
      <TopBar title="Invite to home" />
      <ScrollArea bottomPad={130}>

        <HomeStrip />

        <Section overline="Contact">
          <ChannelToggle value="email" />
          <div>
            <FieldLabel required>Email address</FieldLabel>
            <Input
              value="jin.chen@gmail.com"
              type="email"
              state="valid"
              leadingIcon="at-sign"
            />
          </div>
          <MatchedContact />
        </Section>

        <Section overline="Role">
          <RolePicker value="resident" />
        </Section>

        <Section overline="Note (optional)">
          <Textarea
            value="Hey Jin — finally getting around to adding you to the house roster. You'll get full resident access. The wifi password's pinned in the kitchen note."
            height={92}
            charCount="156 / 280"
          />
        </Section>

        {/* Expiry hint row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 12px', background: F.muted,
          border: `1px solid ${F.border}`, borderRadius: 10,
        }}>
          <i data-lucide="clock" style={{ width: 13, height: 13, color: F.fg3 }} />
          <span style={{ fontSize: 11.5, color: F.fg2, lineHeight: '15px' }}>
            Invite expires in <strong style={{ color: F.fg1, fontWeight: 600 }}>14 days</strong>. Jin won't see other residents' contact info until they accept.
          </span>
        </div>

      </ScrollArea>
      <StickyCTA label="Send invite" sub="Goes to Jin's email · resident role" />
    </Phone>
  );
}

// ─── FRAME 2 · SENT (secondary state) ──────────────────────────

function SentHero() {
  return (
    <div style={{
      padding: '20px 16px 18px',
      background: 'linear-gradient(180deg,#ecfdf5 0%,#f0fdf4 100%)',
      border: '1px solid #a7f3d0',
      borderRadius: 14,
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 54, height: 54, borderRadius: 14,
        background: F.success600, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 0 6px rgba(5,150,105,0.10)',
        flexShrink: 0,
      }}>
        <i data-lucide="mail-check" style={{ width: 26, height: 26 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 17, fontWeight: 700, color: F.fg1, letterSpacing: -0.2,
        }}>Invite on its way</div>
        <div style={{
          fontSize: 12.5, color: F.fg3, marginTop: 3, lineHeight: '17px',
        }}>
          Sent to <span style={{ color: F.fg1, fontWeight: 600 }}>jin.chen@gmail.com</span> · Resident
        </div>
      </div>
    </div>
  );
}

function StatusTimeline() {
  const steps = [
    { icon: 'send',         label: 'Sent',     time: 'Just now',     state: 'done' },
    { icon: 'mail-open',    label: 'Delivered', time: '2 seconds',    state: 'done' },
    { icon: 'eye',          label: 'Opened',   time: 'Waiting',      state: 'pending' },
    { icon: 'check-circle-2', label: 'Accepted', time: 'Waiting',    state: 'idle' },
  ];

  return (
    <div style={{
      padding: '14px 14px',
      background: F.surface, border: `1px solid ${F.border}`,
      borderRadius: 12,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 12,
      }}>
        <span style={{
          fontSize: 11, fontWeight: 600, color: F.fg3,
          textTransform: 'uppercase', letterSpacing: 0.06,
        }}>Status</span>
        <span style={{
          fontSize: 10.5, color: F.fg4,
          fontFamily: 'ui-monospace, Menlo, monospace',
        }}>14d to expiry</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {steps.map((s, i) => {
          const done = s.state === 'done';
          const pending = s.state === 'pending';
          return (
            <div key={s.label} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              position: 'relative',
            }}>
              {/* line + node */}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                flexShrink: 0, width: 22,
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: done ? F.success600
                            : pending ? '#fff' : F.sunken,
                  border: pending ? `1.5px dashed ${F.borderStrong}`
                                  : `1.5px solid ${done ? F.success600 : F.border}`,
                  color: done ? '#fff' : pending ? F.fg3 : F.fg4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 1,
                }}>
                  <i data-lucide={s.icon} style={{ width: 11, height: 11 }} />
                </div>
                {i < steps.length - 1 && (
                  <div style={{
                    width: 2, flex: 1, minHeight: 18,
                    background: done && steps[i + 1].state === 'done'
                      ? F.success600 : F.borderSub,
                    margin: '2px 0',
                  }} />
                )}
              </div>
              <div style={{ paddingBottom: i < steps.length - 1 ? 14 : 0, flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600,
                  color: done ? F.fg1 : pending ? F.fg2 : F.fg4,
                  letterSpacing: -0.1,
                }}>{s.label}</div>
                <div style={{
                  fontSize: 11, color: F.fg3, marginTop: 1,
                  fontVariantNumeric: 'tabular-nums',
                }}>{s.time}</div>
              </div>
              {pending && (
                <span style={{
                  fontSize: 9.5, fontWeight: 700, letterSpacing: 0.08,
                  color: '#b45309', background: '#fef3c7',
                  border: `1px solid #fde68a`,
                  padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase',
                  alignSelf: 'flex-start', marginTop: 2,
                }}>Waiting</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NextStepRow({ icon, label, sub, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px', cursor: 'pointer',
      borderBottom: last ? 'none' : `1px solid ${F.borderSub}`,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: F.primary50, color: F.primary600,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <i data-lucide={icon} style={{ width: 15, height: 15 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 600, color: F.fg1, letterSpacing: -0.1,
        }}>{label}</div>
        <div style={{ fontSize: 11, color: F.fg3, marginTop: 1, lineHeight: '15px' }}>{sub}</div>
      </div>
      <i data-lucide="chevron-right" style={{
        width: 16, height: 16, color: F.fg4, flexShrink: 0,
      }} />
    </div>
  );
}

function FrameInviteHomeSent() {
  return (
    <Phone>
      <TopBar title="Invite sent" />
      <ScrollArea bottomPad={120}>

        <SentHero />

        <Section overline="Delivery">
          <StatusTimeline />
        </Section>

        <Section overline="While you wait">
          <Card padding={0}>
            <NextStepRow
              icon="link"
              label="Copy invite link"
              sub="Send it through any chat — same scoped role, same expiry."
            />
            <NextStepRow
              icon="user-plus"
              label="Invite someone else"
              sub="Add another resident, helper, or guest."
            />
            <NextStepRow
              icon="rotate-ccw"
              label="Resend in 24h if no reply"
              sub="We'll bump Jin's inbox once. After that you can nudge again."
              last
            />
          </Card>
        </Section>

        {/* Manage row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', background: F.muted,
          border: `1px solid ${F.border}`, borderRadius: 10,
        }}>
          <i data-lucide="x-circle" style={{ width: 14, height: 14, color: F.fg3, flexShrink: 0 }} />
          <div style={{
            fontSize: 11.5, color: F.fg2, flex: 1, lineHeight: '16px',
          }}>
            Changed your mind? You can <button style={{
              background: 'transparent', border: 'none', padding: 0,
              color: F.error600, fontWeight: 600, cursor: 'pointer',
              fontSize: 11.5, letterSpacing: -0.05,
            }}>cancel this invite</button> any time before Jin accepts.
          </div>
        </div>

      </ScrollArea>

      {/* Done bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderTop: `1px solid ${F.border}`,
        padding: '12px 16px 28px', zIndex: 10,
      }}>
        <button style={{
          width: '100%', height: 48, borderRadius: 12, border: 'none',
          background: F.primary600, color: '#fff',
          fontSize: 15, fontWeight: 600, letterSpacing: -0.1, cursor: 'pointer',
          boxShadow: '0 6px 16px rgba(2,132,199,0.28)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <i data-lucide="arrow-left" style={{ width: 16, height: 16 }} />
          Back to home
        </button>
      </div>
    </Phone>
  );
}

Object.assign(window, { FrameInviteHomeCompose, FrameInviteHomeSent });
