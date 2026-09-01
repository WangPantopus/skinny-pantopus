// Pantopus — Calendarly · Scheduling notification preferences
// NOT a standalone screen — the new "Scheduling & bookings" category card
// that slots into the existing A14.5 Notifications matrix, matched 1:1.
// Reuses A14 card chrome + row vocab (settings-archetype.jsx globals) and the
// channelTriad pattern: 22×22 P/E/S chips, tinted header band, mono legend,
// master-pause amber banner. Scheduling rows accent in the active pillar.
//
// 4 frames: loaded (real mix) · paused (master-pause) · SMS-locked ·
//           permission-gated (push off at OS level).

const ACCENT = '#0284c7';     // Personal sky pillar — on-chip fill
const ACCENT_BG = '#f0f9ff';  // tinted header band

// ─── Channel chip (P/E/S) ─────────────────────────────────────
// state: 'on' | 'off' | 'disabled' | 'locked'
function ChannelChip({ letter, state }) {
  let palette;
  if (state === 'disabled') palette = { bg:'#f3f4f6', fg:'#d1d5db', border:'#e5e7eb' };
  else if (state === 'on' || state === 'locked') palette = { bg:ACCENT, fg:'#fff', border:ACCENT };
  else palette = { bg:'#fff', fg:'#9ca3af', border:'#d1d5db' };
  return (
    <span style={{
      position:'relative', width:22, height:22, borderRadius:6,
      background:palette.bg, color:palette.fg, border:`1px solid ${palette.border}`,
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      fontSize:10, fontWeight:700, letterSpacing:0.04,
      fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace', flexShrink:0,
    }}>
      {letter}
      {state === 'locked' && (
        <span style={{
          position:'absolute', right:-3, bottom:-3, width:11, height:11, borderRadius:'50%',
          background:'#fff', border:`1px solid ${ACCENT}`, color:ACCENT,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <i data-lucide="lock" style={{ width:6.5, height:6.5, strokeWidth:3 }}/>
        </span>
      )}
    </span>
  );
}

// p/e are booleans; s is always coming-soon (disabled). pushOff grays P.
function ChannelToggles({ p, e, disabled, pushOff, lockConfirm }) {
  const pState = disabled ? 'disabled' : pushOff ? 'disabled' : (lockConfirm ? (p?'locked':'off') : (p?'on':'off'));
  const eState = disabled ? 'disabled' : (lockConfirm ? (e?'locked':'off') : (e?'on':'off'));
  return (
    <div style={{ display:'flex', gap:4, alignItems:'center', flexShrink:0 }}>
      <ChannelChip letter="P" state={pState}/>
      <ChannelChip letter="E" state={eState}/>
      <ChannelChip letter="S" state="disabled"/>
    </div>
  );
}

// Tinted header band: sub-group label (left) + P·E·S column letters (right).
function ChannelHeader({ label, smsHint }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', padding:'9px 16px 8px',
      borderBottom:`1px solid ${S.borderSub}`, background:ACCENT_BG,
      borderRadius:'11px 11px 0 0',
    }}>
      <div style={{
        flex:1, fontSize:10.5, fontWeight:700, color:ACCENT,
        letterSpacing:0.06, textTransform:'uppercase',
      }}>{label}</div>
      <div style={{ display:'flex', gap:4, flexShrink:0, position:'relative' }}>
        {['P','E'].map(l => (
          <div key={l} style={{
            width:22, textAlign:'center', fontSize:10, fontWeight:700, color:S.fg4,
            letterSpacing:0.06, fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}>{l}</div>
        ))}
        <div style={{
          width:22, textAlign:'center', fontSize:10, fontWeight:700, color:'#c4c8cf',
          letterSpacing:0.06, fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace',
          display:'inline-flex', alignItems:'center', justifyContent:'center', gap:1,
        }}>
          S<i data-lucide="lock" style={{ width:8, height:8, strokeWidth:2.6 }}/>
        </div>
        {smsHint && (
          <div style={{
            position:'absolute', top:-34, right:-6, zIndex:5,
            background:'#111827', color:'#fff', fontSize:10, fontWeight:600,
            padding:'5px 9px', borderRadius:7, whiteSpace:'nowrap',
            boxShadow:'0 6px 16px rgba(17,24,39,0.28)',
          }}>
            SMS coming soon
            <span style={{
              position:'absolute', bottom:-4, right:14, width:8, height:8, background:'#111827',
              transform:'rotate(45deg)',
            }}/>
          </div>
        )}
      </div>
    </div>
  );
}

// One matrix row.
function MatrixRow({ r, last, disabled, pushOff }) {
  return (
    <>
      <Row
        padY={11}
        label={r.l}
        sub={r.sub}
        right={
          <ChannelToggles
            p={!!r.v[0]} e={!!r.v[1]}
            disabled={disabled} pushOff={pushOff} lockConfirm={r.locked}
          />
        }
      />
      {!last && <div style={{ height:1, background:S.borderSub, marginLeft:16 }}/>}
    </>
  );
}

// A sub-grouped card (Notify me / Notify attendees).
function CategoryCard({ label, rows, helper, opacity=1, disabled, pushOff, smsHint, children }) {
  return (
    <div style={{ padding:'0 12px' }}>
      <div style={{
        background:S.surface, border:`1px solid ${S.border}`, borderRadius:12,
        overflow:'visible', opacity,
      }}>
        <ChannelHeader label={label} smsHint={smsHint}/>
        {rows.map((r, i) => (
          <MatrixRow key={i} r={r} last={i===rows.length-1 && !children} disabled={disabled} pushOff={pushOff}/>
        ))}
        {children}
      </div>
      {helper && (
        <div style={{ padding:'8px 4px 0', fontSize:11.5, color: disabled?S.fg4:S.fg3, lineHeight:'16px' }}>{helper}</div>
      )}
    </div>
  );
}

// Reminder lead-time chip row (host-facing), sits beneath Notify me.
function ReminderLeadTime({ disabled }) {
  const chips = [
    { label:'1 day', active:true },
    { label:'1 hr',  active:true },
    { label:'15 min', active:false },
  ];
  return (
    <div style={{
      padding:'12px 14px', borderTop:`1px solid ${S.borderSub}`,
    }}>
      <div style={{ fontSize:12.5, fontWeight:600, color:S.fg2, marginBottom:9, letterSpacing:-0.05 }}>
        Send reminders
      </div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {chips.map((c) => (
          <button key={c.label} style={{
            padding:'7px 13px', borderRadius:9999, cursor:'pointer',
            fontSize:12.5, fontWeight:600, letterSpacing:-0.05,
            border: c.active ? `1px solid ${ACCENT}` : `1px solid ${S.borderStrong}`,
            background: disabled ? '#f3f4f6' : (c.active ? ACCENT : '#fff'),
            color: disabled ? '#9ca3af' : (c.active ? '#fff' : S.fg2),
            display:'inline-flex', alignItems:'center', gap:5,
          }}>
            {c.active && !disabled && <i data-lucide="check" style={{ width:12, height:12, strokeWidth:3 }}/>}
            {c.label}
          </button>
        ))}
        <button style={{
          padding:'7px 13px', borderRadius:9999, cursor:'pointer',
          fontSize:12.5, fontWeight:600, letterSpacing:-0.05,
          border:`1px dashed ${S.borderStrong}`, background:'#fff', color:S.fg3,
          display:'inline-flex', alignItems:'center', gap:5,
        }}>
          <i data-lucide="plus" style={{ width:12, height:12, strokeWidth:2.4 }}/> Add
        </button>
      </div>
    </div>
  );
}

// Master-pause banner (A14.5).
function PauseBanner() {
  return (
    <div style={{ padding:'12px 12px 4px' }}>
      <div style={{
        background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:12,
        padding:'12px 14px', display:'flex', alignItems:'center', gap:12,
      }}>
        <div style={{
          width:32, height:32, borderRadius:'50%', background:'#fed7aa', color:'#9a3412',
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
        }}>
          <i data-lucide="bell-off" style={{ width:16, height:16, strokeWidth:2 }}/>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13.5, fontWeight:600, color:'#9a3412', lineHeight:'18px' }}>Paused for 2 hours</div>
          <div style={{ fontSize:11.5, color:'#b45309', marginTop:1, lineHeight:'15px' }}>Resumes 11:42 AM · Emergency alerts still come through</div>
        </div>
        <button style={{
          background:'#fff', border:'1px solid #fdba74', borderRadius:9999,
          padding:'5px 11px', fontSize:12, fontWeight:600, color:'#9a3412', cursor:'pointer',
        }}>Resume</button>
      </div>
    </div>
  );
}

// OS-level push-off notice.
function PushOffNotice() {
  return (
    <div style={{ padding:'12px 12px 0' }}>
      <div style={{
        background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10,
        padding:'10px 12px', display:'flex', alignItems:'center', gap:10,
      }}>
        <i data-lucide="bell-off" style={{ width:15, height:15, color:'#dc2626', flexShrink:0 }}/>
        <div style={{ flex:1, minWidth:0, fontSize:12, color:'#374151', lineHeight:'16px' }}>
          Push is off for Pantopus. Turn it on in Settings to get booking alerts.
        </div>
        <button style={{
          background:'#fff', border:'1px solid #fecaca', borderRadius:9999,
          padding:'5px 11px', fontSize:11.5, fontWeight:600, color:'#b91c1c', cursor:'pointer', flexShrink:0,
        }}>Settings</button>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div style={{
      padding:'18px 16px 4px', fontSize:11, color:S.fg4, textAlign:'center',
      fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace',
      display:'flex', alignItems:'center', justifyContent:'center', gap:14, flexWrap:'wrap',
    }}>
      <span>P · Push</span>
      <span>E · Email</span>
      <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}>
        S · SMS <i data-lucide="lock" style={{ width:9, height:9, strokeWidth:2.6 }}/> soon
      </span>
    </div>
  );
}

// ─── Data ─────────────────────────────────────────────────────

const NOTIFY_ME = [
  { l:'New booking',   sub:"We'll tell you the moment someone books.", v:[1,1,0] },
  { l:'Cancellation',                                                  v:[1,1,0] },
  { l:'Reschedule',                                                    v:[1,1,0] },
  { l:'Reminder sent', sub:'When your reminder goes out',              v:[1,0,0] },
  { l:'No-show',       sub:'Attendee missed the booking',              v:[1,0,0] },
  { l:'Daily agenda',  sub:'Each morning at 8am',                      v:[0,1,0] },
];
const NOTIFY_ATTENDEES = [
  { l:'Booking confirmation', sub:'Sent the moment they book', v:[0,1,0], locked:true },
  { l:'Reminder',             sub:'Before the booking starts', v:[0,1,0] },
  { l:'Reschedule notice',                                     v:[0,1,0] },
  { l:'Cancellation notice',                                   v:[0,1,0] },
];

// Faded sibling category beneath, to show the card slots into the matrix.
function SiblingHint({ disabled }) {
  return (
    <div style={{ opacity: disabled ? 0.35 : 0.5 }}>
      <Overline>Account &amp; security</Overline>
      <CategoryCard
        label="Notify me"
        rows={[
          { l:'New sign-in', v:[1,1,0] },
          { l:'Billing & receipts', v:[0,1,0] },
        ]}
      />
    </div>
  );
}

// ─── Frame composer ───────────────────────────────────────────

function NotifScreen({ mode }) {
  const paused = mode === 'paused';
  const pushOff = mode === 'pushoff';
  const smsHint = mode === 'sms';
  const op = paused ? 0.55 : 1;
  const labels = {
    loaded:'A4 Scheduling notifications — Loaded',
    paused:'A4 Scheduling notifications — Paused',
    sms:'A4 Scheduling notifications — SMS locked',
    pushoff:'A4 Scheduling notifications — Push off',
  };
  return (
    <Phone>
      <div data-screen-label={labels[mode]} style={{ display:'contents' }}/>
      <TopBar title="Notifications"/>
      <div style={{ flex:1, overflow:'auto', paddingBottom:24 }}>
        {paused && <PauseBanner/>}
        {pushOff && <PushOffNotice/>}

        <Overline>Scheduling &amp; bookings</Overline>

        <CategoryCard
          label="Notify me"
          rows={NOTIFY_ME}
          opacity={op}
          disabled={paused}
          pushOff={pushOff}
          smsHint={smsHint}
          helper="Only you see these. Pick the channel for each event."
        >
          <ReminderLeadTime disabled={paused}/>
        </CategoryCard>

        <div style={{ height:14 }}/>

        <CategoryCard
          label="Notify attendees"
          rows={NOTIFY_ATTENDEES}
          opacity={op}
          disabled={paused}
          pushOff={pushOff}
          helper="Attendees always get a confirmation — you choose the rest."
        />

        <div style={{ height:18 }}/>
        <SiblingHint disabled={paused}/>

        <Legend/>
      </div>
    </Phone>
  );
}

function FrameNotifLoaded()  { return <NotifScreen mode="loaded"/>; }
function FrameNotifPaused()  { return <NotifScreen mode="paused"/>; }
function FrameNotifSms()     { return <NotifScreen mode="sms"/>; }
function FrameNotifPushOff() { return <NotifScreen mode="pushoff"/>; }

Object.assign(window, { FrameNotifLoaded, FrameNotifPaused, FrameNotifSms, FrameNotifPushOff });
