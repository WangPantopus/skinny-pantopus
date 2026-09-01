// Pantopus — Calendarly · Bookings Inbox (host & member) — 9 frames
// Archetype: ListOfRows (tabbed) — A08 tabbed-list-with-status-chips, the same
// shell as Support Trains "My trains" / My bids / My tasks / Offers. Top bar
// (not a tab root): back chevron + centered "Bookings" + search + filter icons.
// Scope pill row (All / Personal / Home:Riverside / Business:Acme) horizontally
// scrolling, active pill filled in that scope's identity color. Segmented:
// Upcoming / Pending approval / Past / Cancelled, count badge on Pending.
//
// Owner-polymorphic — accent follows the active scope pill (Personal sky /
// Home green / Business violet). "All" uses neutral primary-600.
//
// Frames: 1 Upcoming populated · 2 Pending-approval (badge + Approve/Decline)
// · 3 empty-Upcoming · 4 empty-Past · 5 loading skeleton · 6 error
// · 7 Business:Acme scoped (assigned-member glyphs) · 8 auto-confirm (no
// Pending segment) · 9 member-gated (own rows only, no approve actions).

const { E, SH } = window;

const ID = {
  all:      { color:'#0284c7', bg:'#e0f2fe', label:'All' },
  personal: { color:'#0284c7', bg:'#e0f2fe', label:'Personal' },
  home:     { color:'#16a34a', bg:'#dcfce7', label:'Home · Riverside' },
  business: { color:'#7c3aed', bg:'#f3e8ff', label:'Business · Acme Studio' },
};
const AV = {
  personal: 'linear-gradient(135deg,#38bdf8,#0369a1)',
  home:     'linear-gradient(135deg,#4ade80,#15803d)',
  business: 'linear-gradient(135deg,#a78bfa,#6d28d9)',
};
const SUCCESS = '#059669', SUCCESS_DK = '#047857', SUCCESS_BG = '#F0FDF4', SUCCESS_LIGHT = '#A7F3D0';
const WARN = '#B45309', WARN_BG = '#FFFBEB', WARN_LIGHT = '#FDE68A', WARN_SOLID = '#D97706';
const ERR = '#DC2626', ERR_BG = '#FEF2F2', ERR_LIGHT = '#FCA5A5';
const PRIMARY = E.blue600;

// ─── Phone shell ────────────────────────────────────────────────────────────

function DarkStatusBar() {
  const c = E.fg1;
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 22px 0', height:34, boxSizing:'border-box', flexShrink:0, fontFamily:'-apple-system, system-ui', fontWeight:600, fontSize:12.5, color:c }}>
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
    <div style={{ display:'flex', alignItems:'center', padding:'6px 6px', height:46, boxSizing:'border-box', background:E.surface, borderBottom:`1px solid ${E.border}`, flexShrink:0, zIndex:5 }}>
      <button aria-label="Back" style={{ width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'none', cursor:'pointer', color:E.fg1, padding:0 }}>
        <i data-lucide="chevron-left" style={{ width:21, height:21 }}/>
      </button>
      <div style={{ flex:1, textAlign:'center', fontSize:15.5, fontWeight:600, color:E.fg1, letterSpacing:-0.2 }}>Bookings</div>
      <button aria-label="Search bookings" style={{ width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'none', cursor:'pointer', color:E.fg2, padding:0 }}><i data-lucide="search" style={{ width:18, height:18 }}/></button>
      <button aria-label="Filter bookings" style={{ width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'none', cursor:'pointer', color:E.fg2, padding:0 }}><i data-lucide="sliders-horizontal" style={{ width:18, height:18 }}/></button>
    </div>
  );
}

function ScopePills({ active }) {
  const order = ['all', 'personal', 'home', 'business'];
  return (
    <div style={{ display:'flex', gap:7, padding:'11px 14px 3px', overflowX:'auto', flexShrink:0 }}>
      {order.map((k) => {
        const s = ID[k];
        const on = k === active;
        return (
          <button key={k} aria-label={`Scope ${s.label}`} style={{
            flexShrink:0, height:31, padding:'0 13px', borderRadius:9999, cursor:'pointer',
            border: on ? 'none' : `1px solid ${E.border}`,
            background: on ? s.color : E.surface,
            color: on ? '#fff' : E.fg2,
            fontSize:12, fontWeight: on ? 700 : 600, letterSpacing:-0.1, whiteSpace:'nowrap',
            display:'flex', alignItems:'center', gap:6,
          }}>
            {k !== 'all' && <span style={{ width:7, height:7, borderRadius:'50%', background: on ? 'rgba(255,255,255,0.9)' : s.color }}/>}
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

function Segmented({ value, pendingCount, accent, hidePending }) {
  let opts = ['Upcoming', 'Pending', 'Past', 'Cancelled'];
  if (hidePending) opts = ['Upcoming', 'Past', 'Cancelled'];
  return (
    <div style={{ display:'flex', gap:2, padding:3, margin:'10px 14px 0', background:E.sunken, borderRadius:10, flexShrink:0 }}>
      {opts.map((o) => {
        const on = o === value;
        const showBadge = o === 'Pending' && pendingCount > 0;
        return (
          <button key={o} aria-label={o === 'Pending' ? `Pending approval, ${pendingCount}` : o} style={{
            flex:1, height:32, borderRadius:7, border:'none', cursor:'pointer',
            background:on?E.surface:'transparent', color:on?(accent||E.blue700):E.fg3,
            boxShadow:on?'0 1px 2px rgba(0,0,0,0.08)':'none',
            fontSize:11.5, fontWeight:on?700:600, letterSpacing:-0.2,
            display:'flex', alignItems:'center', justifyContent:'center', gap:4, padding:0,
          }}>
            {o === 'Pending' ? 'Pending' : o}
            {showBadge && <span style={{ minWidth:15, height:15, padding:'0 4px', borderRadius:9999, background:WARN_SOLID, color:'#fff', fontSize:9, fontWeight:800, display:'inline-flex', alignItems:'center', justifyContent:'center' }}>{pendingCount}</span>}
          </button>
        );
      })}
    </div>
  );
}

function Phone({ label, children }) {
  return (
    <div style={{ width:300, height:620, borderRadius:40, padding:8, background:'#0b0f17', boxShadow:'0 24px 50px rgba(17,24,39,0.20), 0 0 0 1px rgba(0,0,0,0.12)', flexShrink:0 }} data-screen-label={label}>
      <div style={{ width:'100%', height:'100%', background:E.bg, borderRadius:32, overflow:'hidden', position:'relative', display:'flex', flexDirection:'column', fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div style={{ position:'absolute', top:7, left:'50%', transform:'translateX(-50%)', width:88, height:24, borderRadius:16, background:'#000', zIndex:50 }}/>
        <DarkStatusBar/>
        <TopBar/>
        {children}
        <div style={{ position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)', width:100, height:4, borderRadius:4, background:'rgba(0,0,0,0.22)', zIndex:70 }}/>
      </div>
    </div>
  );
}

// ─── Pieces ─────────────────────────────────────────────────────────────────

function Overline({ children, dot }) {
  return (
    <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:E.fg3, margin:'15px 4px 9px', display:'flex', alignItems:'center', gap:6 }}>
      {children}
      {dot && <span style={{ width:6, height:6, borderRadius:'50%', background:PRIMARY }}/>}
    </div>
  );
}

function Avatar({ pillar, initials }) {
  return (
    <div style={{ position:'relative', flexShrink:0 }}>
      <div style={{ width:34, height:34, borderRadius:'50%', background:AV[pillar], display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:11.5, fontWeight:700, letterSpacing:-0.3 }}>{initials}</div>
      <div style={{ position:'absolute', right:-2, bottom:-2, width:14, height:14, borderRadius:'50%', background:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <i data-lucide="badge-check" style={{ width:13, height:13, color:ID[pillar].color }}/>
      </div>
    </div>
  );
}

function StatusChip({ kind }) {
  const map = {
    confirmed: { label:'Confirmed', bg:SUCCESS_BG, fg:SUCCESS_DK, bd:SUCCESS_LIGHT },
    pending:   { label:'Pending', bg:WARN_BG, fg:WARN, bd:WARN_LIGHT },
    cancelled: { label:'Cancelled', bg:E.sunken, fg:E.fg3, bd:E.border },
    past:      { label:'Completed', bg:E.sunken, fg:E.fg3, bd:E.border },
    noshow:    { label:'No-show', bg:ERR_BG, fg:ERR, bd:ERR_LIGHT },
  }[kind];
  return <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:9999, background:map.bg, color:map.fg, border:`1px solid ${map.bd}`, fontSize:9.5, fontWeight:700, whiteSpace:'nowrap' }}>{map.label}</span>;
}

function OwnerGlyph({ pillar, text }) {
  const s = ID[pillar];
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, fontWeight:600, color:s.color }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:s.color }}/>{text}
    </span>
  );
}

function AssignedChip({ name }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'1px 7px 1px 4px', borderRadius:9999, background:ID.business.bg, color:'#6d28d9', fontSize:9.5, fontWeight:700 }}>
      <i data-lucide="user-round" style={{ width:10, height:10 }}/>{name}
    </span>
  );
}

function BookingRow({ pillar, initials, invitee, event, when, status, owner, assigned, unread, quickApprove, gated }) {
  const showActions = quickApprove && !gated;
  return (
    <div style={{ background:E.surface, border:`1px solid ${E.border}`, borderRadius:16, boxShadow:'0 1px 3px rgba(0,0,0,0.04)', padding:'11px 12px', display:'flex', flexDirection:'column', gap: showActions ? 10 : 0 }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
        <Avatar pillar={pillar} initials={initials}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            {unread && <span style={{ width:7, height:7, borderRadius:'50%', background:WARN_SOLID, flexShrink:0 }}/>}
            <div style={{ fontSize:13, fontWeight:700, color:E.fg1, letterSpacing:-0.1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{invitee}</div>
          </div>
          <div style={{ fontSize:11, color:E.fg2, marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{event}</div>
          <div style={{ fontSize:10.5, color:E.fg3, marginTop:1 }}>{when}</div>
          {(owner || assigned) && (
            <div style={{ display:'flex', alignItems:'center', gap:9, marginTop:7, flexWrap:'wrap' }}>
              {owner && <OwnerGlyph pillar={pillar} text={owner}/>}
              {assigned && <AssignedChip name={assigned}/>}
            </div>
          )}
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:7, flexShrink:0 }}>
          <StatusChip kind={status}/>
          <button aria-label="More actions" style={{ width:22, height:22, display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'none', cursor:'pointer', color:E.fg4, padding:0 }}><i data-lucide="more-vertical" style={{ width:16, height:16 }}/></button>
        </div>
      </div>
      {showActions && (
        <div style={{ display:'flex', gap:8, paddingTop:10, borderTop:`1px solid ${E.border}` }}>
          <button style={{ flex:1, height:34, borderRadius:9, border:`1px solid ${E.border}`, background:E.surface, color:E.fg2, fontSize:12, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:5 }}><i data-lucide="x" style={{ width:14, height:14 }}/>Decline</button>
          <button style={{ flex:1, height:34, borderRadius:9, border:'none', background:PRIMARY, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:5, boxShadow:'0 6px 16px rgba(2,132,199,0.22)' }}><i data-lucide="check" style={{ width:14, height:14 }}/>Approve</button>
        </div>
      )}
    </div>
  );
}

function List({ children }) {
  return <div style={{ flex:1, overflow:'auto', padding:'0 14px 92px' }}>{children}</div>;
}
function Group({ children }) {
  return <div style={{ display:'flex', flexDirection:'column', gap:9 }}>{children}</div>;
}

function FAB() {
  return (
    <button style={{ position:'absolute', bottom:22, right:16, zIndex:30, height:46, padding:'0 18px', borderRadius:9999, border:'none', cursor:'pointer', background:PRIMARY, color:'#fff', fontSize:13, fontWeight:700, letterSpacing:-0.1, boxShadow:'0 8px 20px rgba(2,132,199,0.34)', display:'inline-flex', alignItems:'center', gap:8 }}>
      <i data-lucide="link" style={{ width:17, height:17, strokeWidth:2.4 }}/>Share booking link
    </button>
  );
}

function MemberBanner() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:9, margin:'12px 14px 0', padding:'9px 12px', background:E.blue50, border:`1px solid ${E.blue200}`, borderRadius:12 }}>
      <i data-lucide="user-check" style={{ width:16, height:16, color:E.blue600, flexShrink:0 }}/>
      <span style={{ fontSize:11, color:E.fg2, fontWeight:600, lineHeight:'15px' }}>You're seeing bookings assigned to you</span>
    </div>
  );
}

// ─── FRAME 1 · UPCOMING POPULATED (All scope) ───────────────────────────────

function FrameUpcoming() {
  return (
    <Phone label="Bookings · Upcoming">
      <ScopePills active="all"/>
      <Segmented value="Upcoming" pendingCount={2} accent={E.blue700}/>
      <List>
        <Overline>Today</Overline>
        <Group>
          <BookingRow pillar="personal" initials="DA" invitee="Dana Whitfield" event="30-min intro call" when="Today · 2:00 PM · PT" status="confirmed" owner="Personal"/>
          <BookingRow pillar="home" initials="MR" invitee="Mara Reyes" event="Garden walkthrough" when="Today · 4:30 PM · PT" status="confirmed" owner="Home · Riverside"/>
        </Group>
        <Overline>Tomorrow</Overline>
        <Group>
          <BookingRow pillar="business" initials="TK" invitee="Theo Kemp" event="Studio consultation" when="Sat, Jun 14 · 10:00 AM · PT" status="confirmed" owner="Business · Acme" assigned="Priya"/>
          <BookingRow pillar="personal" initials="JL" invitee="Jordan Liu" event="Coffee chat" when="Sat, Jun 14 · 1:00 PM · PT" status="confirmed" owner="Personal"/>
        </Group>
        <Overline>Later this week</Overline>
        <Group>
          <BookingRow pillar="home" initials="SN" invitee="Sam Nguyen" event="Tool pickup" when="Mon, Jun 16 · 9:00 AM · PT" status="confirmed" owner="Home · Riverside"/>
        </Group>
      </List>
      <FAB/>
    </Phone>
  );
}

// ─── FRAME 2 · PENDING APPROVAL (inline approve/decline) ────────────────────

function FramePending() {
  return (
    <Phone label="Bookings · Pending approval">
      <ScopePills active="all"/>
      <Segmented value="Pending" pendingCount={2} accent={E.blue700}/>
      <List>
        <Overline dot>Needs your approval</Overline>
        <Group>
          <BookingRow pillar="business" initials="RC" invitee="Rosa Calderón" event="Studio consultation" when="Mon, Jun 16 · 11:00 AM · PT" status="pending" owner="Business · Acme" assigned="Priya" unread quickApprove/>
          <BookingRow pillar="personal" initials="EB" invitee="Eli Barnes" event="30-min intro call" when="Tue, Jun 17 · 3:30 PM · PT" status="pending" owner="Personal" unread quickApprove/>
        </Group>
      </List>
      <FAB/>
    </Phone>
  );
}

// ─── FRAME 3 · EMPTY (Upcoming) ─────────────────────────────────────────────

function EmptyState({ icon, title, body, cta, ctaIcon }) {
  return (
    <div style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'20px 30px 110px', gap:18 }}>
      <div style={{ width:72, height:72, borderRadius:'50%', background:E.blue50, color:E.blue600, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <i data-lucide={icon} style={{ width:32, height:32, strokeWidth:1.8 }}/>
      </div>
      <div>
        <h2 style={{ margin:0, fontSize:17, fontWeight:700, color:E.fg1, letterSpacing:-0.2 }}>{title}</h2>
        <p style={{ margin:'8px 0 0', fontSize:12.5, color:E.fg3, lineHeight:'18px', maxWidth:220, letterSpacing:-0.03 }}>{body}</p>
      </div>
      {cta && (
        <button style={{ height:44, padding:'0 18px', borderRadius:12, border:'none', cursor:'pointer', background:PRIMARY, color:'#fff', fontSize:13.5, fontWeight:700, letterSpacing:-0.1, boxShadow:'0 6px 16px rgba(2,132,199,0.28)', display:'inline-flex', alignItems:'center', gap:7 }}>
          <i data-lucide={ctaIcon} style={{ width:16, height:16, strokeWidth:2.2 }}/>{cta}
        </button>
      )}
    </div>
  );
}

function FrameEmptyUpcoming() {
  return (
    <Phone label="Bookings · Empty (Upcoming)">
      <ScopePills active="personal"/>
      <Segmented value="Upcoming" pendingCount={0} accent={E.blue700}/>
      <EmptyState icon="calendar-clock" title="No bookings yet" body="When neighbors book time with you, they show up here." cta="Share your booking link" ctaIcon="link"/>
    </Phone>
  );
}

// ─── FRAME 4 · EMPTY (Past) ─────────────────────────────────────────────────

function FrameEmptyPast() {
  return (
    <Phone label="Bookings · Empty (Past)">
      <ScopePills active="personal"/>
      <Segmented value="Past" pendingCount={0} accent={E.blue700}/>
      <EmptyState icon="history" title="Nothing in your history yet" body="Completed and past bookings will collect here once you've met with someone."/>
    </Phone>
  );
}

// ─── FRAME 5 · LOADING (skeleton) ───────────────────────────────────────────

function SkRow() {
  return (
    <div style={{ background:E.surface, border:`1px solid ${E.border}`, borderRadius:16, boxShadow:'0 1px 3px rgba(0,0,0,0.04)', padding:'11px 12px', display:'flex', alignItems:'flex-start', gap:10 }}>
      <div style={{ width:34, height:34, borderRadius:'50%', flexShrink:0, ...SH }}/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:7, paddingTop:2 }}>
        <div style={{ width:'58%', height:10, borderRadius:5, ...SH }}/>
        <div style={{ width:'72%', height:9, borderRadius:5, ...SH }}/>
        <div style={{ width:'40%', height:8, borderRadius:5, ...SH }}/>
      </div>
      <div style={{ width:54, height:16, borderRadius:9999, ...SH }}/>
    </div>
  );
}

function FrameLoading() {
  return (
    <Phone label="Bookings · Loading">
      <ScopePills active="all"/>
      <Segmented value="Upcoming" pendingCount={2} accent={E.blue700}/>
      <List>
        <div style={{ width:72, height:9, borderRadius:5, margin:'15px 4px 9px', ...SH }}/>
        <Group><SkRow/><SkRow/></Group>
        <div style={{ width:90, height:9, borderRadius:5, margin:'15px 4px 9px', ...SH }}/>
        <Group><SkRow/><SkRow/></Group>
      </List>
    </Phone>
  );
}

// ─── FRAME 6 · ERROR ────────────────────────────────────────────────────────

function FrameError() {
  return (
    <Phone label="Bookings · Error">
      <ScopePills active="all"/>
      <Segmented value="Upcoming" pendingCount={0} accent={E.blue700}/>
      <div style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'20px 30px 110px', gap:18 }}>
        <div style={{ width:72, height:72, borderRadius:'50%', background:ERR_BG, color:ERR, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <i data-lucide="cloud-off" style={{ width:32, height:32, strokeWidth:1.8 }}/>
        </div>
        <div>
          <h2 style={{ margin:0, fontSize:17, fontWeight:700, color:E.fg1, letterSpacing:-0.2 }}>Couldn't load bookings</h2>
          <p style={{ margin:'8px 0 0', fontSize:12.5, color:E.fg3, lineHeight:'18px', maxWidth:220, letterSpacing:-0.03 }}>Something went wrong on our end. Check your connection and try again.</p>
        </div>
        <button style={{ height:44, padding:'0 18px', borderRadius:12, border:`1px solid ${E.borderStrong}`, cursor:'pointer', background:E.surface, color:E.fg1, fontSize:13.5, fontWeight:700, letterSpacing:-0.1, display:'inline-flex', alignItems:'center', gap:7 }}>
          <i data-lucide="rotate-cw" style={{ width:16, height:16, strokeWidth:2.2 }}/>Try again
        </button>
      </div>
    </Phone>
  );
}

// ─── FRAME 7 · BUSINESS:ACME SCOPED (assigned-member glyphs) ────────────────

function FrameBusiness() {
  return (
    <Phone label="Bookings · Business scope">
      <ScopePills active="business"/>
      <Segmented value="Upcoming" pendingCount={3} accent="#7c3aed"/>
      <List>
        <Overline>Today</Overline>
        <Group>
          <BookingRow pillar="business" initials="TK" invitee="Theo Kemp" event="Studio consultation" when="Today · 10:00 AM · PT" status="confirmed" owner="Business · Acme" assigned="Priya"/>
          <BookingRow pillar="business" initials="LM" invitee="Lena Marsh" event="Brand strategy session" when="Today · 1:30 PM · PT" status="confirmed" owner="Business · Acme" assigned="Devon"/>
        </Group>
        <Overline>Tomorrow</Overline>
        <Group>
          <BookingRow pillar="business" initials="RC" invitee="Rosa Calderón" event="Studio consultation" when="Sat, Jun 14 · 9:00 AM · PT" status="confirmed" owner="Business · Acme" assigned="Priya"/>
          <BookingRow pillar="business" initials="WH" invitee="Wes Holt" event="Discovery call" when="Sat, Jun 14 · 3:00 PM · PT" status="confirmed" owner="Business · Acme" assigned="Unassigned"/>
        </Group>
      </List>
      <FAB/>
    </Phone>
  );
}

// ─── FRAME 8 · AUTO-CONFIRM (no Pending segment) ────────────────────────────

function FrameAutoConfirm() {
  return (
    <Phone label="Bookings · Auto-confirm">
      <ScopePills active="home"/>
      <Segmented value="Upcoming" pendingCount={0} accent="#16a34a" hidePending/>
      <List>
        <Overline>Today</Overline>
        <Group>
          <BookingRow pillar="home" initials="MR" invitee="Mara Reyes" event="Garden walkthrough" when="Today · 4:30 PM · PT" status="confirmed" owner="Home · Riverside"/>
          <BookingRow pillar="home" initials="SN" invitee="Sam Nguyen" event="Tool pickup" when="Today · 6:00 PM · PT" status="confirmed" owner="Home · Riverside"/>
        </Group>
        <Overline>This week</Overline>
        <Group>
          <BookingRow pillar="home" initials="BD" invitee="Bea Dunn" event="Carpool coordination" when="Mon, Jun 16 · 8:00 AM · PT" status="confirmed" owner="Home · Riverside"/>
        </Group>
      </List>
      <FAB/>
    </Phone>
  );
}

// ─── FRAME 9 · MEMBER-GATED (own rows, no approve actions) ──────────────────

function FrameMemberGated() {
  return (
    <Phone label="Bookings · Member-gated">
      <ScopePills active="business"/>
      <MemberBanner/>
      <Segmented value="Upcoming" pendingCount={0} accent="#7c3aed" hidePending/>
      <List>
        <Overline>Assigned to you · Today</Overline>
        <Group>
          <BookingRow pillar="business" initials="TK" invitee="Theo Kemp" event="Studio consultation" when="Today · 10:00 AM · PT" status="confirmed" owner="Business · Acme" assigned="You" gated/>
          <BookingRow pillar="business" initials="RC" invitee="Rosa Calderón" event="Studio consultation" when="Today · 2:00 PM · PT" status="confirmed" owner="Business · Acme" assigned="You" gated/>
        </Group>
        <Overline>Tomorrow</Overline>
        <Group>
          <BookingRow pillar="business" initials="WH" invitee="Wes Holt" event="Discovery call" when="Sat, Jun 14 · 3:00 PM · PT" status="confirmed" owner="Business · Acme" assigned="You" gated/>
        </Group>
      </List>
    </Phone>
  );
}

Object.assign(window, {
  FrameUpcoming, FramePending, FrameEmptyUpcoming, FrameEmptyPast,
  FrameLoading, FrameError, FrameBusiness, FrameAutoConfirm, FrameMemberGated,
});
