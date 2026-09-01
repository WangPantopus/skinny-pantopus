// Pantopus — Calendarly · Slot loading + no-availability states (invitee) — 5 frames
// Archetype: SlotCalendar interim + empty states, extending the Date + time
// slot picker. The interim of /book/[slug] while the engine composes
// availability — especially the Home collective-intersect path. Mirrors A10.9
// Support train slot rows (skeletoned) and A18 status screens. Reuses the Place
// dashboard shimmer recipe exactly (linear-gradient + `shimmer` keyframes).
//
// The summary header + month calendar stay visible; only the slot region
// changes. Accent follows the host's pillar — Personal sky / Business violet,
// Home find-a-time uses Home green. No alarm styling anywhere: empty here is a
// normal, expected outcome. Voice plainspoken, second person, no exclamations.
//
// Frames: loading-skeleton · composing · no-times-in-range · no-times-anywhere ·
// composed-empty (home intersect).

const { E } = window;

const PILLARS = {
  personal: { accent:E.blue600, soft:E.blue50 },
  home:     { accent:'#16A34A', soft:'#F0FDF4' },
  business: { accent:'#7C3AED', soft:'#F5F3FF' },
};

// Place dashboard shimmer recipe — reused exactly
const SKEL = {
  background:'linear-gradient(90deg,#eef2f7,#f8fafc,#eef2f7)',
  backgroundSize:'200% 100%',
  animation:'shimmer 1.4s ease-in-out infinite',
};

const WK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const TODAY = 13;
const AVAILABLE = [15, 16, 17, 18, 19, 22, 23, 24, 25, 26, 29, 30];

// ─── Phone shell ──────────────────────────────────────────────────────────

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
        <div style={{
          position:'absolute', top:7, left:'50%', transform:'translateX(-50%)',
          width:88, height:24, borderRadius:16, background:'#000', zIndex:50,
        }}/>
        <DarkStatusBar/>
        <div style={{
          display:'flex', alignItems:'center', padding:'6px 8px', height:46, boxSizing:'border-box',
          background:E.surface, borderBottom:`1px solid ${E.border}`, flexShrink:0,
        }}>
          <i data-lucide="chevron-left" style={{ width:20, height:20, color:E.fg1 }}/>
          <div style={{ flex:1, textAlign:'center', fontSize:15, fontWeight:600, color:E.fg1, letterSpacing:-0.2 }}>Pick a time</div>
          <div style={{ width:20 }}/>
        </div>
        <div style={{ flex:1, overflow:'auto', padding:'12px 14px', display:'flex', flexDirection:'column', gap:12 }}>
          {children}
        </div>
        <div style={{
          position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)',
          width:100, height:4, borderRadius:4, background:'rgba(0,0,0,0.22)', zIndex:60,
        }}/>
      </div>
    </div>
  );
}

// ─── Picker chrome (kept visible across all states) ───────────────────────

function SummaryHeader({ pillar }) {
  const p = PILLARS[pillar];
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <div style={{
        display:'flex', alignItems:'center', gap:11, padding:'11px 12px',
        background:E.surface, border:`1px solid ${E.border}`, borderRadius:16,
        boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{
          width:34, height:34, borderRadius:9, flexShrink:0, background:p.soft, color:p.accent,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}><i data-lucide={pillar === 'home' ? 'users-round' : 'video'} style={{ width:16, height:16, strokeWidth:2 }}/></div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13.5, fontWeight:600, color:E.fg1, letterSpacing:-0.1 }}>
            {pillar === 'home' ? 'Garden work day' : pillar === 'business' ? 'Design review' : 'Intro call'}
          </div>
          <div style={{ fontSize:11, color:E.fg3, marginTop:1 }}>
            {pillar === 'home' ? '2 hours · with the household' : pillar === 'business' ? '30 min · with the team' : '30 min · with Maria Kessler'}
          </div>
        </div>
      </div>
      <button style={{
        display:'inline-flex', alignItems:'center', gap:7, alignSelf:'flex-start', padding:'7px 11px',
        background:E.surface, border:`1px solid ${E.border}`, borderRadius:9999, cursor:'pointer',
        color:E.fg2, fontSize:11.5, fontWeight:600, letterSpacing:-0.05, whiteSpace:'nowrap',
      }}>
        <i data-lucide="globe" style={{ width:13, height:13, color:E.fg3 }}/>
        Times shown in PDT
        <i data-lucide="chevron-down" style={{ width:13, height:13, color:E.fg4 }}/>
      </button>
    </div>
  );
}

function MonthCalendar({ pillar, selected, available = AVAILABLE, today = TODAY, dim }) {
  const p = PILLARS[pillar];
  const cells = [];
  for (let i = 0; i < 1; i++) cells.push(null); // Jun 1 = Monday
  for (let d = 1; d <= 30; d++) cells.push(d);
  return (
    <div style={{
      background:E.surface, border:`1px solid ${E.border}`, borderRadius:16,
      boxShadow:'0 1px 3px rgba(0,0,0,0.04)', padding:'12px 12px 14px', opacity: dim ? 0.92 : 1,
    }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, padding:'0 2px' }}>
        <div style={{ fontSize:13.5, fontWeight:700, color:E.fg1, letterSpacing:-0.2 }}>June 2026</div>
        <div style={{ display:'flex', alignItems:'center', gap:2 }}>
          <button aria-label="Previous month" style={{ width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'none', cursor:'pointer', color:E.fg3, padding:0 }}><i data-lucide="chevron-left" style={{ width:17, height:17 }}/></button>
          <button aria-label="Next month" style={{ width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'none', cursor:'pointer', color:E.fg3, padding:0 }}><i data-lucide="chevron-right" style={{ width:17, height:17 }}/></button>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:1, marginBottom:4 }}>
        {WK.map((w, i) => <div key={i} style={{ textAlign:'center', fontSize:9.5, fontWeight:700, color:E.fg4, padding:'2px 0' }}>{w}</div>)}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gridAutoRows:'36px', gap:1 }}>
        {cells.map((d, i) => {
          if (d == null) return <div key={i}/>;
          const isAvail = available.includes(d);
          const sel = d === selected;
          const isToday = d === today;
          return (
            <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
              <button
                aria-label={sel ? `June ${d}, selected` : isAvail ? `June ${d}, times available` : isToday ? `Today, June ${d}` : `June ${d}, no availability`}
                disabled={!isAvail && !sel}
                style={{
                  width:34, height:34, borderRadius:'50%', padding:0, position:'relative',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  background: sel ? p.accent : 'transparent',
                  border: isToday && !sel ? `1.5px solid ${p.accent}` : '1.5px solid transparent',
                  cursor: (isAvail || sel) ? 'pointer' : 'default',
                }}>
                <span style={{
                  fontSize:13, lineHeight:1, fontVariantNumeric:'tabular-nums',
                  fontWeight: sel || isToday ? 700 : isAvail ? 600 : 500,
                  color: sel ? '#fff' : isToday ? p.accent : isAvail ? E.fg1 : E.fg4,
                }}>{d}</span>
                {isAvail && !sel && <span style={{ position:'absolute', bottom:4, width:4, height:4, borderRadius:'50%', background:p.accent }}/>}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayHeading({ children }) {
  return <div style={{ fontSize:13, fontWeight:700, color:E.fg1, letterSpacing:-0.1, padding:'2px 2px 0' }}>{children}</div>;
}

// ─── Skeleton slot rows (same width/height as real A10.9 slot rows) ───────

function SkelSlotRow() {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:10,
      background:E.surface, border:`1px solid ${E.border}`, borderRadius:12, padding:'11px 13px',
    }}>
      <div style={{ width:14, height:14, borderRadius:4, ...SKEL, flexShrink:0 }}/>
      <div style={{ width:66, height:13, borderRadius:4, ...SKEL }}/>
      <div style={{ flex:1 }}/>
      <div style={{ width:16, height:16, borderRadius:4, ...SKEL, flexShrink:0 }}/>
    </div>
  );
}

function SkelSlotList({ n = 6 }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {Array.from({ length: n }).map((_, i) => <SkelSlotRow key={i}/>)}
    </div>
  );
}

// ─── Member avatar cluster ────────────────────────────────────────────────

const MEMBERS = [
  { initials:'AR', grad:'linear-gradient(135deg,#a78bfa,#6d28d9)' },
  { initials:'JL', grad:'linear-gradient(135deg,#38bdf8,#0369a1)' },
  { initials:'MK', grad:'linear-gradient(135deg,#fdba74,#ea580c)' },
];

function AvatarCluster({ size = 24 }) {
  return (
    <div style={{ display:'flex' }}>
      {MEMBERS.map((m, i) => (
        <div key={i} style={{
          width:size, height:size, borderRadius:'50%', background:m.grad, color:'#fff',
          border:'2px solid #fff', boxSizing:'border-box', marginLeft: i === 0 ? 0 : -8,
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.36, fontWeight:700,
        }}>{m.initials}</div>
      ))}
    </div>
  );
}

// ─── Empty card ───────────────────────────────────────────────────────────

function EmptyCard({ pillar, icon, title, body, primary, primaryIcon, secondary, secondaryIcon, chip, framed }) {
  const p = PILLARS[pillar];
  return (
    <div style={{
      background: framed ? p.soft : E.surface,
      border: framed ? `1px solid ${p.accent}33` : `1px dashed ${E.borderStrong}`,
      borderRadius:16, padding:'24px 18px 18px',
      display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', gap:10,
    }}>
      <div style={{
        width:50, height:50, borderRadius:'50%',
        background: framed ? '#fff' : E.sunken, color: framed ? p.accent : E.fg3,
        display:'flex', alignItems:'center', justifyContent:'center',
        border: framed ? `1px solid ${p.accent}33` : 'none',
      }}><i data-lucide={icon} style={{ width:23, height:23, strokeWidth:1.85 }}/></div>

      <div style={{ fontSize:15, fontWeight:700, color:E.fg1, letterSpacing:-0.2, lineHeight:'20px', maxWidth:230 }}>{title}</div>
      <div style={{ fontSize:12, color:E.fg3, lineHeight:'17px', maxWidth:225 }}>{body}</div>

      {/* required-member free-dot row (composed-empty only) */}
      {framed && (
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'center', gap:14,
          padding:'10px 0 2px', width:'100%',
        }}>
          {[
            { initials:'AR', grad:MEMBERS[0].grad, free:true },
            { initials:'JL', grad:MEMBERS[1].grad, free:false },
            { initials:'MK', grad:MEMBERS[2].grad, free:true },
          ].map((m, i) => (
            <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
              <div style={{ position:'relative' }}>
                <div style={{
                  width:34, height:34, borderRadius:'50%', background:m.grad, color:'#fff',
                  border:'2px solid #fff', boxSizing:'border-box',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700,
                }}>{m.initials}</div>
                <span style={{
                  position:'absolute', right:-1, bottom:-1, width:11, height:11, borderRadius:'50%',
                  border:'2px solid #fff', background: m.free ? '#16A34A' : E.borderStrong,
                }}/>
              </div>
              <span style={{ fontSize:9, fontWeight:600, color: m.free ? '#15803d' : E.fg4 }}>{m.free ? 'Free' : 'Busy'}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:8, width:'100%', marginTop:2 }}>
        <button style={{
          width:'100%', height:42, borderRadius:11, border:'none', cursor:'pointer', letterSpacing:-0.1,
          background:p.accent, color:'#fff', fontSize:13, fontWeight:700,
          boxShadow:`0 4px 12px ${p.accent}3d`,
          display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7,
        }}>
          {primaryIcon && <i data-lucide={primaryIcon} style={{ width:15, height:15 }}/>}
          {primary}
        </button>
        {secondary && (
          <button style={{
            width:'100%', height:40, borderRadius:11, cursor:'pointer', letterSpacing:-0.1,
            background:E.surface, border:`1px solid ${E.border}`, color:E.fg1, fontSize:12.5, fontWeight:700,
            display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7,
          }}>
            {secondaryIcon && <i data-lucide={secondaryIcon} style={{ width:14, height:14 }}/>}
            {secondary}
            {chip && (
              <span style={{
                marginLeft:2, padding:'2px 7px', borderRadius:9999, background:E.sunken, color:E.fg3,
                fontSize:10, fontWeight:700, letterSpacing:-0.05,
              }}>{chip}</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Composed-availability explainer pill ─────────────────────────────────

function ComposedPill({ pillar }) {
  const p = PILLARS[pillar];
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:9, padding:'9px 12px',
      background:p.soft, border:`1px solid ${p.accent}33`, borderRadius:12,
    }}>
      <i data-lucide="calendar-range" style={{ width:15, height:15, color:p.accent, flexShrink:0 }}/>
      <span style={{ flex:1, minWidth:0, fontSize:11.5, color:E.fg2, fontWeight:500, lineHeight:'15px' }}>
        Times come from each member's availability.
      </span>
    </div>
  );
}

// ─── FRAME 1 · LOADING SKELETON ───────────────────────────────────────────

function FrameLoading() {
  return (
    <Phone label="Slot states · Loading skeleton">
      <SummaryHeader pillar="personal"/>
      <MonthCalendar pillar="personal" selected={17}/>
      <DayHeading>Wednesday, Jun 17</DayHeading>
      <SkelSlotList n={6}/>
    </Phone>
  );
}

// ─── FRAME 2 · COMPOSING (team intersect) ─────────────────────────────────

function FrameComposing() {
  const p = PILLARS.business;
  return (
    <Phone label="Slot states · Composing">
      <SummaryHeader pillar="business"/>
      <MonthCalendar pillar="business" selected={17}/>
      <DayHeading>Wednesday, Jun 17</DayHeading>
      {/* composing caption with member cluster */}
      <div style={{ display:'flex', alignItems:'center', gap:9, padding:'2px 2px' }}>
        <AvatarCluster/>
        <span style={{ fontSize:12, fontWeight:600, color:E.fg2, letterSpacing:-0.05 }}>Finding times that work for everyone</span>
      </div>
      <SkelSlotList n={4}/>
      <ComposedPill pillar="business"/>
    </Phone>
  );
}

// ─── FRAME 3 · NO TIMES IN RANGE ──────────────────────────────────────────

function FrameNoRange() {
  return (
    <Phone label="Slot states · No times in range">
      <SummaryHeader pillar="personal"/>
      <MonthCalendar pillar="personal" selected={null} available={[]} today={TODAY}/>
      <EmptyCard
        pillar="personal"
        icon="calendar-search"
        title="No open times in June"
        body="Availability changes often. Try a later month."
        primary="See July" primaryIcon="arrow-right"
        secondary="Get notified when times open" secondaryIcon="bell"
      />
    </Phone>
  );
}

// ─── FRAME 4 · NO TIMES ANYWHERE ──────────────────────────────────────────

function FrameNoAnywhere() {
  return (
    <Phone label="Slot states · No times anywhere">
      <SummaryHeader pillar="personal"/>
      <MonthCalendar pillar="personal" selected={null} available={[]} today={TODAY}/>
      <EmptyCard
        pillar="personal"
        icon="calendar-clock"
        title="No times are open right now"
        body="We'll let you know the moment something frees up."
        primary="Notify me" primaryIcon="bell"
        secondary="Join waitlist" secondaryIcon="users-round" chip="3 waiting"
      />
    </Phone>
  );
}

// ─── FRAME 5 · COMPOSED EMPTY (home intersect) ────────────────────────────

function FrameComposedEmpty() {
  return (
    <Phone label="Slot states · Composed empty">
      <SummaryHeader pillar="home"/>
      <MonthCalendar pillar="home" selected={17} available={[15,16,17,18,19,22,23]}/>
      <DayHeading>Wednesday, Jun 17</DayHeading>
      <EmptyCard
        framed
        pillar="home"
        icon="calendar-x"
        title="Everyone's calendars don't overlap in this window"
        body="These times need every required member free at once. Try widening the range."
        primary="Try next month" primaryIcon="arrow-right"
        secondary="Notify me" secondaryIcon="bell"
      />
    </Phone>
  );
}

Object.assign(window, {
  FrameLoading, FrameComposing, FrameNoRange, FrameNoAnywhere, FrameComposedEmpty,
});
