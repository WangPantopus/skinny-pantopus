// A14.5 — Notifications (src/app/settings/notification-preferences.tsx)
// Toggle-heavy variant pushed further: each category row carries THREE
// channel toggles (Push / Email / SMS) instead of one. Tiny letter chips
// stand in for the iOS-style switch — they tile in the trailing slot
// where the normal Toggle would go, and the column headers live in the
// card overline rather than the row.
//
// Two frames:
//   1) Populated — a real mix. Tasks lean push-only, Pulse is quieter,
//      Marketplace mailed-only, Home gets the lot, Security locked on push.
//   2) Secondary — "Paused for 2h". Master pause banner, every channel chip
//      dimmed and disabled, but the configured pattern is still visible
//      underneath so the user knows what'll come back on.

// ─── Channel chip ────────────────────────────────────────────────────────
// Compact on/off pill stamped with the channel letter. Three of them
// tile into a 74px trailing slot — same footprint as the standard iOS
// toggle, but carries 3× the information.
function ChannelChip({ letter, on, disabled }) {
  const palette = disabled
    ? { bg: '#f3f4f6', fg: '#d1d5db', border: '#e5e7eb' }
    : on
      ? { bg: S.primary600, fg: '#fff', border: S.primary600 }
      : { bg: '#fff', fg: '#9ca3af', border: '#d1d5db' };
  return (
    <span style={{
      width: 22, height: 22, borderRadius: 6,
      background: palette.bg, color: palette.fg,
      border: `1px solid ${palette.border}`,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 10, fontWeight: 700, letterSpacing: 0.04,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      flexShrink: 0,
    }}>{letter}</span>
  );
}

function ChannelToggles({ p, e, s, disabled, lockedPush }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
      <ChannelChip letter="P" on={p} disabled={disabled}/>
      <ChannelChip letter="E" on={e} disabled={disabled || lockedPush}/>
      <ChannelChip letter="S" on={s} disabled={disabled || lockedPush}/>
    </div>
  );
}

// Column-header row that sits just below the card top, in line with the
// channel chips. Uses caption type — same letter, same x-position.
function ChannelHeader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '10px 16px 6px',
      borderBottom: `1px solid ${S.borderSub}`,
      background: '#fbfbfd',
    }}>
      <div style={{ flex: 1 }}/>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {['P','E','S'].map(l => (
          <div key={l} style={{
            width: 22, textAlign: 'center',
            fontSize: 10, fontWeight: 700, color: S.fg4,
            letterSpacing: 0.06, textTransform: 'uppercase',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}>{l}</div>
        ))}
      </div>
    </div>
  );
}

// ─── Data ────────────────────────────────────────────────────────────────
// Each row: label, sub, and a [push, email, sms] pattern.
const GROUPS = [
  {
    title: 'Tasks',
    rows: [
      { l: 'Bids on my tasks',   sub: 'Within 5 minutes of posting',  v: [1,0,0] },
      { l: 'New messages',       sub: 'From clients & taskers',       v: [1,1,0] },
      { l: 'Status updates',     sub: 'Accepted, on the way, done',   v: [1,0,0] },
      { l: 'Payment receipts',                                          v: [0,1,0] },
    ],
    helper: 'Push only for things that need a fast reply. Receipts go to email so they\'re searchable.',
  },
  {
    title: 'Pulse',
    rows: [
      { l: 'Replies to my posts',                                       v: [1,0,0] },
      { l: 'Mentions',           sub: 'When a neighbor @s you',         v: [1,0,0] },
      { l: 'Nearby Lost & Found',sub: 'Within 0.5 mi of your address',  v: [0,0,0] },
      { l: 'Weekly digest',      sub: 'Sundays, 8am',                   v: [0,1,0] },
    ],
    helper: 'Pulse is quiet by default. Mentions break through, browsing doesn\'t.',
  },
  {
    title: 'Marketplace',
    rows: [
      { l: 'Offers on my listings',                                     v: [1,1,0] },
      { l: 'Buyer messages',                                            v: [1,0,0] },
      { l: 'Price drops on saved items',                                v: [0,1,0] },
      { l: 'Listing expiring soon',  sub: '48h before auto-pause',      v: [0,1,0] },
    ],
  },
  {
    title: 'Home & Mailbox',
    rows: [
      { l: 'Package arrived',    sub: 'When carrier scans "delivered"', v: [1,1,1] },
      { l: 'Member activity',    sub: 'Check-ins, new passes, edits',   v: [1,0,0] },
      { l: 'Civic notices',      sub: 'Permits, service alerts',        v: [1,1,0] },
      { l: 'Emergency alerts',                                          v: [1,1,1] },
    ],
    helper: 'Emergency alerts can\'t be muted on push.',
  },
  {
    title: 'Account & security',
    rows: [
      { l: 'New sign-in',                                               v: [1,1,1] },
      { l: 'Verification status',                                       v: [1,1,0] },
      { l: 'Billing & receipts',                                        v: [0,1,0] },
    ],
    helper: 'Security alerts always come through. You can choose how.',
  },
];

// ─── Master pause card ───────────────────────────────────────────────────
function PauseBanner() {
  return (
    <div style={{padding:'12px 12px 0'}}>
      <div style={{
        background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12,
        padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: '#fed7aa', color: '#9a3412',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <i data-lucide="bell-off" style={{ width: 16, height: 16, strokeWidth: 2 }}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13.5, fontWeight: 600, color: '#9a3412', lineHeight: '18px',
          }}>Paused for 2 hours</div>
          <div style={{
            fontSize: 11.5, color: '#b45309', marginTop: 1, lineHeight: '15px',
          }}>Resumes 11:42 AM · Emergency alerts still come through</div>
        </div>
        <button style={{
          background: '#fff', border: '1px solid #fdba74', borderRadius: 9999,
          padding: '5px 11px', fontSize: 12, fontWeight: 600, color: '#9a3412',
          cursor: 'pointer', fontFamily: 'inherit',
        }}>Resume</button>
      </div>
    </div>
  );
}

// ─── Frame ───────────────────────────────────────────────────────────────
function NotificationsFrame({ paused }) {
  return (
    <Phone>
      <TopBar title="Notifications"/>
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 24 }}>

        {paused
          ? <PauseBanner/>
          : (
            <>
              <Overline>Master</Overline>
              <Card helper="Pause all silences every channel except emergency alerts. Quiet hours just delays them.">
                <Row
                  label="Pause all notifications"
                  sub="Snooze everything but emergencies"
                  right={<Toggle on={false}/>}
                />
                <Row
                  label="Quiet hours"
                  sub="10:00 PM – 7:00 AM · Weekdays"
                  right={
                    <div style={{display:'flex', alignItems:'center', gap:10}}>
                      <span style={{fontSize:13, color:S.fg3}}>On</span>
                      <Chevron/>
                    </div>
                  }
                />
              </Card>
            </>
          )
        }

        {GROUPS.map((g, gi) => (
          <React.Fragment key={gi}>
            <Overline>{g.title}</Overline>
            <div style={{padding:'0 12px'}}>
              <div style={{
                background: S.surface, border: `1px solid ${S.border}`,
                borderRadius: 12, overflow: 'hidden',
                opacity: paused ? 0.55 : 1,
              }}>
                <ChannelHeader/>
                {g.rows.map((r, i) => (
                  <React.Fragment key={i}>
                    <Row
                      padY={11}
                      label={r.l}
                      sub={r.sub}
                      right={
                        <ChannelToggles
                          p={!!r.v[0]} e={!!r.v[1]} s={!!r.v[2]}
                          disabled={paused}
                        />
                      }
                    />
                    {i < g.rows.length - 1 &&
                      <div style={{height:1, background:S.borderSub, marginLeft:16}}/>}
                  </React.Fragment>
                ))}
              </div>
              {g.helper && (
                <div style={{
                  padding:'8px 4px 0', fontSize:11.5,
                  color: paused ? S.fg4 : S.fg3, lineHeight:'16px',
                }}>{g.helper}</div>
              )}
            </div>
          </React.Fragment>
        ))}

        <MonoFooter>P · Push   E · Email   S · SMS</MonoFooter>
      </div>
    </Phone>
  );
}

function FrameNotificationsPopulated() { return <NotificationsFrame paused={false}/>; }
function FrameNotificationsPaused()    { return <NotificationsFrame paused={true}/>; }

Object.assign(window, { FrameNotificationsPopulated, FrameNotificationsPaused });
