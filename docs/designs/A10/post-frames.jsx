// A10.4 — Post (src/app/post/[id].tsx)
// Archetype: A10 — Detail: Content · variant: post_author + body_reactions + inline_reply
// Two frames: populated + empty ("Be the first to reply")

const P = {
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
  warningBg: '#fef3c7',
  warning600:'#d97706',
  amberBg:   '#fef3c7',
  amber:     '#b45309',
  errorBg:   '#fee2e2',
  error600:  '#dc2626',
  homeBg:    '#dcfce7',
  home:      '#16a34a',
  bizBg:     '#ede9fe',
  biz:       '#6d28d9',
};

// ─── Phone shell ──────────────────────────────────────────────

function PSB() {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '16px 28px 0', height: 44, boxSizing: 'border-box',
      fontFamily: '-apple-system, system-ui', fontWeight: 600, fontSize: 15, color: P.fg1,
    }}>
      <span>9:41</span>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={P.fg1}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={P.fg1}/><rect x="9" y="2" width="3" height="9" rx="0.6" fill={P.fg1}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={P.fg1}/></svg>
        <svg width="15" height="11" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={P.fg1}/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={P.fg1}/><circle cx="7.5" cy="9" r="1.3" fill={P.fg1}/></svg>
        <svg width="24" height="11" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={P.fg1} strokeOpacity="0.35" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill={P.fg1}/><path d="M22.5 3.8v3.4c.6-.2 1-.8 1-1.7s-.4-1.5-1-1.7z" fill={P.fg1} fillOpacity="0.4"/></svg>
      </div>
    </div>
  );
}

function PPhone({ children }) {
  return (
    <div style={{
      width: 360, height: 740, borderRadius: 46, padding: 10,
      background: '#0b0f17',
      boxShadow: '0 40px 80px rgba(17,24,39,0.22), 0 0 0 1px rgba(0,0,0,0.14)',
    }}>
      <div style={{
        width: '100%', height: '100%', background: P.bg,
        borderRadius: 36, overflow: 'hidden', position: 'relative',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          position: 'absolute', top: 9, left: '50%', transform: 'translateX(-50%)',
          width: 108, height: 30, borderRadius: 20, background: '#000', zIndex: 50,
        }} />
        <PSB />
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

function PTopBar() {
  const Btn = ({ icon }) => (
    <button style={{
      width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'transparent', border: 'none', cursor: 'pointer', color: P.fg1, padding: 0,
      borderRadius: 8,
    }}>
      <i data-lucide={icon} style={{ width: 20, height: 20 }} />
    </button>
  );
  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '4px 8px',
      height: 48, boxSizing: 'border-box',
      background: P.surface, borderBottom: `1px solid ${P.border}`,
      flexShrink: 0, zIndex: 5,
    }}>
      <Btn icon="chevron-left" />
      <div style={{
        flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600,
        color: P.fg1, letterSpacing: -0.15,
      }}>Post</div>
      <Btn icon="share" />
      <Btn icon="more-horizontal" />
    </div>
  );
}

function PVerifBadge({ size = 14, color = P.primary600 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color,
      border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxSizing: 'content-box',
    }}>
      <i data-lucide="check" style={{ width: size * 0.55, height: size * 0.55, color: '#fff', strokeWidth: 4 }} />
    </div>
  );
}

function PAvatar({ size, initials, bg, verified, verifColor }) {
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
          <PVerifBadge size={size >= 40 ? 14 : 11} color={verifColor || P.primary600} />
        </div>
      )}
    </div>
  );
}

function IntentChip({ label, icon, bg, fg }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '4px 9px', borderRadius: 9999,
      background: bg, color: fg, fontSize: 10.5, fontWeight: 700,
      letterSpacing: 0.04, textTransform: 'uppercase',
    }}>
      {icon && <i data-lucide={icon} style={{ width: 10, height: 10, strokeWidth: 2.5 }} />}
      {label}
    </span>
  );
}

function ReactionBtn({ icon, count, active, color }) {
  return (
    <button style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '6px 10px', borderRadius: 9999,
      background: active ? (color ? color + '15' : P.primary50) : 'transparent',
      border: active ? `1px solid ${color ? color + '40' : P.primary200}` : `1px solid ${P.border}`,
      color: active ? (color || P.primary700) : P.fg3,
      fontSize: 12, fontWeight: 600, cursor: 'pointer',
    }}>
      <i data-lucide={icon} style={{ width: 14, height: 14, strokeWidth: active ? 2.2 : 1.8 }} />
      {count}
    </button>
  );
}

function Comment({ avatar, name, time, body, reply, nested, reactions }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginLeft: nested ? 36 : 0 }}>
      <PAvatar size={nested ? 24 : 28} initials={avatar.initials} bg={avatar.bg} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12,
          padding: '8px 12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: P.fg1, letterSpacing: -0.05 }}>{name}</span>
            <span style={{ fontSize: 10, color: P.fg4 }}>· {time}</span>
          </div>
          <div style={{ fontSize: 12, color: P.fg2, lineHeight: '17px' }}>{body}</div>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 4, marginLeft: 4, alignItems: 'center' }}>
          <button style={{
            background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
            fontSize: 10.5, fontWeight: 600, color: P.fg3,
          }}>Reply</button>
          <button style={{
            background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
            fontSize: 10.5, color: P.fg3, display: 'inline-flex', alignItems: 'center', gap: 3,
          }}>
            <i data-lucide="heart" style={{ width: 11, height: 11 }} />
            {reactions || 0}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Composer (inline_reply) ─────────────────────────────────

function Composer({ placeholder = "Add a comment…", focused = false }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <PAvatar size={32} initials="MK" bg="linear-gradient(135deg,#0ea5e9,#0369a1)" />
      <div style={{
        flex: 1, height: 40, borderRadius: 9999,
        background: P.surface,
        border: focused ? `1.5px solid ${P.primary500}` : `1px solid ${P.border}`,
        display: 'flex', alignItems: 'center', padding: '0 14px', gap: 8,
        boxShadow: focused ? `0 0 0 4px ${P.primary500}22` : 'none',
      }}>
        <span style={{ flex: 1, fontSize: 13, color: focused ? P.fg1 : P.fg4 }}>
          {placeholder}
        </span>
        <button style={{
          width: 28, height: 28, borderRadius: '50%', border: 'none',
          background: focused ? P.primary600 : P.sunken,
          color: focused ? '#fff' : P.fg4, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i data-lucide="arrow-up" style={{ width: 14, height: 14, strokeWidth: 2.5 }} />
        </button>
      </div>
    </div>
  );
}

// ─── Post body (shared by both frames) ───────────────────────

function PostBody() {
  return (
    <>
      {/* Author */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <PAvatar size={44} initials="NV" bg="linear-gradient(135deg,#f59e0b,#b45309)" verified />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: P.fg1, letterSpacing: -0.1 }}>Nadia Velez</div>
          <div style={{ fontSize: 11, color: P.fg3, marginTop: 1 }}>22m · Elm Park · 5th &amp; Elm</div>
        </div>
        <IntentChip label="Lost &amp; Found" icon="search" bg={P.errorBg} fg={P.error600} />
      </div>

      {/* Body */}
      <div style={{
        fontSize: 15, color: P.fg1, lineHeight: '22px',
        letterSpacing: -0.1, marginBottom: 12,
      }}>
        Has anyone seen a tortoise-shell cat near 5th &amp; Elm tonight? She slipped out of
        a window around 9pm. Her name is <b>Mochi</b>, she's about 8 lb, no collar but she's
        chipped. Very friendly — will come if you crouch and click your tongue. Please DM
        if you spot her. Will be out walking the block until midnight.
      </div>

      {/* Media grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
        borderRadius: 14, overflow: 'hidden', marginBottom: 14,
      }}>
        <div style={{
          aspectRatio: '1',
          background: 'radial-gradient(ellipse at 35% 35%, #fbbf24 0%, #b45309 35%, #44403c 65%, #292524 100%)',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(circle at 65% 45%, rgba(0,0,0,0.5) 0%, transparent 25%)',
          }} />
          <div style={{
            position: 'absolute', top: 28, right: 22, width: 6, height: 6,
            borderRadius: '50%', background: '#fde68a',
          }} />
        </div>
        <div style={{
          aspectRatio: '1',
          background: 'linear-gradient(160deg,#1f2937 0%,#374151 40%,#0c4a6e 100%)',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'radial-gradient(circle at 55% 70%, rgba(251,191,36,0.5) 0%, transparent 25%)',
          }} />
          <div style={{
            position: 'absolute', left: 14, bottom: 14, padding: '3px 8px',
            background: 'rgba(0,0,0,0.55)', borderRadius: 6,
            fontSize: 10, color: '#fff', fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <i data-lucide="map-pin" style={{ width: 10, height: 10 }} />
            5th &amp; Elm
          </div>
        </div>
      </div>
    </>
  );
}

// ─── FRAMES ───────────────────────────────────────────────────

function FramePostPopulated() {
  return (
    <PPhone>
      <PTopBar />
      <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px 100px' }}>
        <PostBody />

        {/* Reactions */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <ReactionBtn icon="heart" count="18" active color={P.error600} />
          <ReactionBtn icon="hand" count="7" />
          <ReactionBtn icon="eye" count="2" />
          <div style={{ flex: 1 }} />
          <button style={{
            background: 'transparent', border: 'none', color: P.fg3,
            fontSize: 11, cursor: 'pointer', padding: '6px 6px',
            display: 'inline-flex', alignItems: 'center', gap: 3,
          }}>
            <i data-lucide="message-circle" style={{ width: 13, height: 13 }} />
            5 comments
          </button>
        </div>

        <div style={{ height: 1, background: P.border, marginBottom: 14 }} />

        <div style={{ marginBottom: 16 }}>
          <Composer />
        </div>

        {/* Thread */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Comment
            avatar={{ initials: 'LP', bg: 'linear-gradient(135deg,#16a34a,#15803d)' }}
            name="Lena P."
            time="18m"
            reactions="4"
            body="I think I saw her under the Subaru parked across from 514 Elm — small + scared, ran when I got close. Going to try again with treats."
          />
          <Comment
            avatar={{ initials: 'NV', bg: 'linear-gradient(135deg,#f59e0b,#b45309)' }}
            name="Nadia Velez"
            time="15m"
            reactions="2"
            body="Oh thank you — heading there now with her favorite churu pouch."
            nested
          />
          <Comment
            avatar={{ initials: 'RD', bg: 'linear-gradient(135deg,#f97316,#c2410c)' }}
            name="Ravi D."
            time="11m"
            reactions="1"
            body="Posted to the building chat at 510 + 514. Doorman says he'll keep an eye out tonight."
          />
          <Comment
            avatar={{ initials: 'MK', bg: 'linear-gradient(135deg,#7c3aed,#5b21b6)' }}
            name="Marco K."
            time="6m"
            reactions="0"
            body="If you need a humane trap I have one in the basement — text me, 555-0193."
          />
          <Comment
            avatar={{ initials: 'NV', bg: 'linear-gradient(135deg,#f59e0b,#b45309)' }}
            name="Nadia Velez"
            time="2m"
            reactions="6"
            body="UPDATE: GOT HER. She was under the Subaru after all. Thank you Lena, Ravi, Marco, this block."
            nested
          />
        </div>
      </div>
    </PPhone>
  );
}

function FramePostEmpty() {
  return (
    <PPhone>
      <PTopBar />
      <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px 100px' }}>
        <PostBody />

        {/* Reactions (sparse) */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <ReactionBtn icon="heart" count="0" />
          <ReactionBtn icon="hand" count="0" />
          <ReactionBtn icon="eye" count="0" />
          <div style={{ flex: 1 }} />
          <span style={{
            color: P.fg4, fontSize: 11,
            display: 'inline-flex', alignItems: 'center', gap: 3, padding: '6px 6px',
          }}>
            <i data-lucide="message-circle" style={{ width: 13, height: 13 }} />
            0 comments · just posted
          </span>
        </div>

        <div style={{ height: 1, background: P.border, marginBottom: 14 }} />

        {/* Focused composer — primary action */}
        <div style={{ marginBottom: 16 }}>
          <Composer placeholder="Be the first to reply…" focused />
        </div>

        {/* Empty thread state */}
        <div style={{
          background: P.surface, border: `1px dashed ${P.border}`, borderRadius: 14,
          padding: '24px 18px 22px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          textAlign: 'center',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: P.primary50,
            color: P.primary600,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 12,
          }}>
            <i data-lucide="message-square-plus" style={{ width: 22, height: 22, strokeWidth: 1.8 }} />
          </div>
          <div style={{
            fontSize: 15, fontWeight: 700, color: P.fg1,
            letterSpacing: -0.2, marginBottom: 4,
          }}>Be the first to reply</div>
          <div style={{
            fontSize: 12.5, color: P.fg3, lineHeight: '17px', maxWidth: 240, marginBottom: 14,
          }}>
            Nadia just posted. A neighbor sighting, a tip, or even a "looking" matters in
            the first hour.
          </div>

          {/* Quick reply prompts */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
            {[
              { icon: 'eye',       label: "I'll keep an eye out" },
              { icon: 'map-pin',   label: 'I saw a cat near…' },
              { icon: 'help-circle', label: 'Need a humane trap?' },
            ].map(s => (
              <button key={s.label} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '6px 10px', borderRadius: 9999,
                background: P.sunken, border: `1px solid ${P.border}`,
                color: P.fg2, fontSize: 11.5, fontWeight: 600,
                cursor: 'pointer',
              }}>
                <i data-lucide={s.icon} style={{ width: 12, height: 12, color: P.fg3 }} />
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </PPhone>
  );
}

Object.assign(window, { FramePostPopulated, FramePostEmpty });
