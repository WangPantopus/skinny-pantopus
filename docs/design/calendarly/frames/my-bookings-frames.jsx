// Pantopus — Calendarly · My bookings (invitee/booker-side list) — 5 frames
// Archetype: ListOfRows (segmented Upcoming/Past). A signed-in app user's list
// of bookings THEY made across other people's hosts — the booker-side
// counterpart to the host bookings-inbox (NOT shown here), and distinct from
// my-packages-credits (credits only).
//
// Lives at /me/bookings under You/Me (a You/Me sub-root, so it carries the tab
// bar). Mirrors List of Rows exactly: top bar + centered title, a segmented
// Upcoming/Past control, and tappable booking rows (white cards, 1px border,
// 16px radius, shadow-sm, 72px+). Each row tinted by the host's pillar dot
// (sky/green/violet — you book across all three). A09 status-pill styling.
// Tapping a row opens Manage Your Booking. Lucide stroke-2, no emoji.
//
// Frames: populated upcoming · past tab · empty · loading · action-needed.

const { E, SH } = window;

const PILLARS = {
  personal: '#0284c7',
  home:     '#16a34a',
  business: '#7c3aed',
};
const AV = {
  personal: 'linear-gradient(135deg,#38bdf8,#0369a1)',
  home:     'linear-gradient(135deg,#4ade80,#15803d)',
  business: 'linear-gradient(135deg,#a78bfa,#6d28d9)',
};
const SUCCESS = '#059669', SUCCESS_DK = '#047857', SUCCESS_BG = '#F0FDF4', SUCCESS_LIGHT = '#A7F3D0';
const WARN = '#B45309', WARN_BG = '#FFFBEB', WARN_LIGHT = '#FDE68A';
const INFO = '#0369A1', INFO_BG = '#F0F9FF', INFO_LIGHT = '#BAE6FD';
const ACCENT = E.blue600;

// ─── Phone shell ────────────────────────────────────────────────────────────

function DarkStatusBar() {
  const c = E.fg1;
  return (
    <div style={{
      display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'12px 22px 0', height:34, boxSizing:'border-box', flexShrink:0,
      fontFamily:'-apple-system, system-ui', fontWeight:600, fontSize:12.5, color:c,
    }}>
      <span>9:41</span>
      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
        <svg width="15" height="10" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={c}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={c}/><rect x="9" y="2" width="3" height="9" rx="0.6" fill={c}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={c}/></svg>
        <svg width="13" height="10" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={c}/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={c}/><circle cx="7.5" cy="9" r="1.3" fill={c}/></svg>
        <svg width="21" height="10" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={c} strokeOpacity="0.35" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill={c}/><path d="M22.5 3.8v3.4c.6-.2 1-.8 1-1.7s-.4-1.5-1-1.7z" fill={c} fillOpacity="0.4"/></svg>
      </div>
    </div>
  );
}

function TopBar() {
  return (
    <div style={{
      display:'flex', alignItems:'center', padding:'6px 8px', height:46, boxSizing:'border-box',
      background:E.surface, borderBottom:`1px solid ${E.border}`, flexShrink:0, zIndex:5,
    }}>
      <button aria-label="Back" style={{ width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'none', cursor:'pointer', color:E.fg1, padding:0 }}>
        <i data-lucide="chevron-left" style={{ width:20, height:20 }}/>
      </button>
      <div style={{ flex:1, textAlign:'center', fontSize:15, fontWeight:600, color:E.fg1, letterSpacing:-0.2 }}>My bookings</div>
      <div style={{ width:34, display:'flex', alignItems:'center', justifyContent:'center', color:E.fg3 }}><i data-lucide="search" style={{ width:18, height:18 }}/></div>
    </div>
  );
}

function Segmented({ value }) {
  return (
    <div style={{ display:'flex', gap:3, padding:3, margin:'12px 14px 0', background:E.sunken, borderRadius:10 }}>
      {['Upcoming', 'Past'].map((o) => {
        const on = o === value;
        return (
          <button key={o} style={{
            flex:1, height:32, borderRadius:7, border:'none', cursor:'pointer',
            background:on?E.surface:'transparent', color:on?E.blue700:E.fg3,
            boxShadow:on?'0 1px 2px rgba(0,0,0,0.08)':'none',
            fontSize:12.5, fontWeight:on?700:600, letterSpacing:-0.1,
          }}>{o}</button>
        );
      })}
    </div>
  );
}

function TabBar() {
  const tabs = [
    { key:'home', label:'Home', icon:'house' },
    { key:'pulse', label:'Pulse', icon:'radio' },
    { key:'gigs', label:'Gigs', icon:'briefcase' },
    { key:'chat', label:'Chat', icon:'message-circle' },
    { key:'me', label:'Me', icon:'user' },
  ];
  return (
    <div style={{
      position:'absolute', bottom:0, left:0, right:0, zIndex:15, height:76, padding:'8px 6px 18px', boxSizing:'border-box',
      display:'flex', alignItems:'flex-start', justifyContent:'space-around',
      background:'rgba(255,255,255,0.96)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', borderTop:`1px solid ${E.border}`,
    }}>
      {tabs.map((t) => {
        const active = t.key === 'me';
        return (
          <button key={t.key} style={{ background:'transparent', border:'none', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'4px 6px', minWidth:42, color: active ? ACCENT : E.fg4 }}>
            <i data-lucide={t.icon} style={{ width:21, height:21, strokeWidth: active ? 2.4 : 2 }}/>
            <span style={{ fontSize:9.5, fontWeight:600, letterSpacing:-0.05 }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Phone({ label, children }) {
  return (
    <div style={{
      width:300, height:620, borderRadius:40, padding:8, background:'#0b0f17',
      boxShadow:'0 24px 50px rgba(17,24,39,0.20), 0 0 0 1px rgba(0,0,0,0.12)', flexShrink:0,
    }} data-screen-label={label}>
      <div style={{
        width:'100%', height:'100%', background:E.bg, borderRadius:32,
        overflow:'hidden', position:'relative', display:'flex', flexDirection:'column',
        fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{ position:'absolute', top:7, left:'50%', transform:'translateX(-50%)', width:88, height:24, borderRadius:16, background:'#000', zIndex:50 }}/>
        <DarkStatusBar/>
        <TopBar/>
        {children}
        <TabBar/>
        <div style={{ position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)', width:100, height:4, borderRadius:4, background:'rgba(0,0,0,0.22)', zIndex:70 }}/>
      </div>
    </div>
  );
}

// ─── Pieces ─────────────────────────────────────────────────────────────────

function Overline({ children, tone }) {
  const color = tone === 'attention' ? WARN : E.fg3;
  return <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color, margin:'14px 4px 8px', display:'flex', alignItems:'center', gap:6 }}>
    {tone === 'attention' && <i data-lucide="alert-circle" style={{ width:12, height:12, strokeWidth:2.4 }}/>}
    {children}
  </div>;
}

function HostAvatar({ pillar, initials, dim }) {
  return (
    <div style={{ position:'relative', flexShrink:0, opacity: dim ? 0.7 : 1 }}>
      <div style={{ width:42, height:42, borderRadius:'50%', background:AV[pillar], display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:13, fontWeight:700, letterSpacing:-0.3 }}>{initials}</div>
      <div style={{ position:'absolute', right:-1, bottom:-1, width:13, height:13, borderRadius:'50%', background:PILLARS[pillar], border:'2.5px solid #fff' }}/>
    </div>
  );
}

function StatusPill({ kind }) {
  const map = {
    confirmed: { label:'Confirmed', bg:SUCCESS_BG, fg:SUCCESS_DK, bd:SUCCESS_LIGHT },
    pending:   { label:'Pending', bg:INFO_BG, fg:INFO, bd:INFO_LIGHT },
    past:      { label:'Past', bg:E.sunken, fg:E.fg3, bd:E.border },
    balance:   { label:'Balance due', bg:WARN_BG, fg:WARN, bd:WARN_LIGHT },
    approve:   { label:'Approve pending', bg:INFO_BG, fg:INFO, bd:INFO_LIGHT },
  }[kind];
  return (
    <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:9999, background:map.bg, color:map.fg, border:`1px solid ${map.bd}`, fontSize:9.5, fontWeight:700, letterSpacing:0.01, whiteSpace:'nowrap' }}>{map.label}</span>
  );
}

function BookingRow({ pillar, initials, event, host, when, status, dim, bookAgain, payAffordance, balance }) {
  return (
    <div style={{
      background:E.surface, border:`1px solid ${E.border}`, borderRadius:16, boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
      padding:'12px 13px', display:'flex', flexDirection:'column', gap: (bookAgain || payAffordance) ? 10 : 0, opacity: dim ? 0.66 : 1, cursor:'pointer',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:11 }}>
        <HostAvatar pillar={pillar} initials={initials} dim={dim}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13.5, fontWeight:700, color:E.fg1, letterSpacing:-0.1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{event}</div>
          <div style={{ fontSize:11, color:E.fg3, marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{host} · {when}</div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0 }}>
          <StatusPill kind={status}/>
          {!bookAgain && !payAffordance && <i data-lucide="chevron-right" style={{ width:16, height:16, color:E.fg4 }}/>}
        </div>
      </div>
      {bookAgain && (
        <div style={{ display:'flex', justifyContent:'flex-end', paddingTop:9, borderTop:`1px solid ${E.border}` }}>
          <button style={{ display:'inline-flex', alignItems:'center', gap:5, background:'transparent', border:'none', padding:'2px 2px', cursor:'pointer', color:ACCENT, fontSize:11.5, fontWeight:700, letterSpacing:-0.05 }}>
            <i data-lucide="rotate-ccw" style={{ width:12, height:12, strokeWidth:2.3 }}/>Book again
          </button>
        </div>
      )}
      {payAffordance && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:9, borderTop:`1px solid ${E.border}` }}>
          <span style={{ fontSize:11, color:WARN, fontWeight:600 }}>{balance} due at confirm</span>
          <button style={{ display:'inline-flex', alignItems:'center', gap:5, height:28, padding:'0 14px', borderRadius:9999, border:'none', cursor:'pointer', background:ACCENT, color:'#fff', fontSize:11.5, fontWeight:700, letterSpacing:-0.05 }}>Pay {balance}</button>
        </div>
      )}
    </div>
  );
}

function List({ children, attention }) {
  return (
    <div style={{ flex:1, overflow:'auto', padding:'0 14px 88px' }}>
      {children}
    </div>
  );
}

function Tagline() {
  return <div style={{ fontSize:11, color:E.fg3, margin:'10px 4px 0', textAlign:'center' }}>Everything you've booked, in one place.</div>;
}

function Group({ children, gap = 9 }) {
  return <div style={{ display:'flex', flexDirection:'column', gap }}>{children}</div>;
}

// ─── FRAME 1 · POPULATED (UPCOMING) ─────────────────────────────────────────

function FrameUpcoming() {
  return (
    <Phone label="My bookings · Upcoming">
      <Segmented value="Upcoming"/>
      <List>
        <Tagline/>
        <Overline>This week</Overline>
        <Group>
          <BookingRow pillar="personal" initials="DL" event="30-min consult" host="with Dr. Lee" when="Thu, Jun 18 · 2:00 PM" status="confirmed"/>
          <BookingRow pillar="business" initials="GC" event="Home walkthrough" host="with Green &amp; Co" when="Fri, Jun 19 · 10:00 AM" status="pending"/>
        </Group>
        <Overline>Next week</Overline>
        <Group>
          <BookingRow pillar="personal" initials="MK" event="Garden consult" host="with Maria Kessler" when="Tue, Jun 23 · 9:30 AM" status="confirmed"/>
          <BookingRow pillar="home" initials="LH" event="Family planning session" host="with The Lee Home" when="Wed, Jun 24 · 4:00 PM" status="confirmed"/>
        </Group>
      </List>
    </Phone>
  );
}

// ─── FRAME 2 · PAST TAB ─────────────────────────────────────────────────────

function FramePast() {
  return (
    <Phone label="My bookings · Past">
      <Segmented value="Past"/>
      <List>
        <Overline>This month</Overline>
        <Group>
          <BookingRow pillar="personal" initials="DL" event="30-min consult" host="with Dr. Lee" when="Mon, Jun 8 · 2:00 PM" status="past" dim bookAgain/>
          <BookingRow pillar="business" initials="WS" event="Massage session" host="with Wellspring Spa" when="Sat, Jun 6 · 11:00 AM" status="past" dim bookAgain/>
        </Group>
        <Overline>Earlier</Overline>
        <Group>
          <BookingRow pillar="personal" initials="MK" event="Intro call" host="with Maria Kessler" when="Wed, Jun 3 · 9:30 AM" status="past" dim bookAgain/>
        </Group>
      </List>
    </Phone>
  );
}

// ─── FRAME 3 · EMPTY ────────────────────────────────────────────────────────

function FrameEmpty() {
  return (
    <Phone label="My bookings · Empty">
      <Segmented value="Upcoming"/>
      <div style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'20px 30px 100px', gap:16 }}>
        <div style={{ width:84, height:84, borderRadius:'50%', background:E.sunken, color:E.fg3, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <i data-lucide="calendar" style={{ width:36, height:36, strokeWidth:1.8 }}/>
        </div>
        <div>
          <h2 style={{ margin:0, fontSize:17, fontWeight:700, color:E.fg1, letterSpacing:-0.2 }}>You haven't booked anything yet</h2>
          <p style={{ margin:'8px 0 0', fontSize:12.5, color:E.fg3, lineHeight:'18px', maxWidth:210, letterSpacing:-0.03 }}>Bookings you make show up here — everything in one place.</p>
        </div>
        <button style={{ height:44, padding:'0 18px', borderRadius:12, border:'none', cursor:'pointer', background:ACCENT, color:'#fff', fontSize:13.5, fontWeight:700, letterSpacing:-0.1, boxShadow:'0 6px 16px rgba(2,132,199,0.28)', display:'inline-flex', alignItems:'center', gap:7 }}>
          <i data-lucide="search" style={{ width:16, height:16, strokeWidth:2.2 }}/>Find something to book
        </button>
      </div>
    </Phone>
  );
}

// ─── FRAME 4 · LOADING (skeleton) ───────────────────────────────────────────

function SkRow() {
  return (
    <div style={{ background:E.surface, border:`1px solid ${E.border}`, borderRadius:16, boxShadow:'0 1px 3px rgba(0,0,0,0.04)', padding:'12px 13px', display:'flex', alignItems:'center', gap:11 }}>
      <div style={{ width:42, height:42, borderRadius:'50%', flexShrink:0, ...SH }}/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:7 }}>
        <div style={{ width:'55%', height:11, borderRadius:5, ...SH }}/>
        <div style={{ width:'75%', height:9, borderRadius:5, ...SH }}/>
      </div>
      <div style={{ width:54, height:16, borderRadius:9999, ...SH }}/>
    </div>
  );
}

function FrameLoading() {
  return (
    <Phone label="My bookings · Loading">
      <Segmented value="Upcoming"/>
      <List>
        <div style={{ width:80, height:9, borderRadius:5, margin:'14px 4px 8px', ...SH }}/>
        <Group>
          <SkRow/>
          <SkRow/>
        </Group>
        <div style={{ width:64, height:9, borderRadius:5, margin:'14px 4px 8px', ...SH }}/>
        <Group>
          <SkRow/>
          <SkRow/>
        </Group>
      </List>
    </Phone>
  );
}

// ─── FRAME 5 · ACTION NEEDED ────────────────────────────────────────────────

function FrameActionNeeded() {
  return (
    <Phone label="My bookings · Action needed">
      <Segmented value="Upcoming"/>
      <List>
        <Overline tone="attention">Needs attention</Overline>
        <Group>
          <BookingRow pillar="business" initials="WS" event="Massage session" host="with Wellspring Spa" when="Sat, Jun 21 · 11:00 AM" status="balance" payAffordance balance="$40"/>
          <BookingRow pillar="personal" initials="DL" event="New patient visit" host="with Dr. Lee" when="Mon, Jun 23 · 3:00 PM" status="approve"/>
        </Group>
        <Overline>This week</Overline>
        <Group>
          <BookingRow pillar="personal" initials="MK" event="Garden consult" host="with Maria Kessler" when="Thu, Jun 18 · 9:30 AM" status="confirmed"/>
          <BookingRow pillar="home" initials="LH" event="Family planning session" host="with The Lee Home" when="Fri, Jun 19 · 4:00 PM" status="confirmed"/>
        </Group>
      </List>
    </Phone>
  );
}

Object.assign(window, { FrameUpcoming, FramePast, FrameEmpty, FrameLoading, FrameActionNeeded });
