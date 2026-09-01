// Pantopus — Calendarly · Slot taken / conflict-recovery sheet — 3 frames
// Archetype: ErrorState + SlotCalendar re-render; a bottom sheet that slides up
// over the booking flow on a 409 conflict at confirm (/book/[slug]/review), and
// in-app for app invitees. The cardinal rule: it never dead-ends, and it
// preserves every entered detail so nothing is retyped.
//
// Mirrors the Support Trains slot-row pattern 1:1 for the suggested nearest-open
// rows (real full-width buttons: weekday+date left, time-range+duration right,
// chevron, 1px border, 12px radius, host pillar on press) and the A18 error halo
// for the headline block. Host pillar = Personal sky. Lucide stroke-2, no emoji.
// Voice: calm, plainspoken, no blame, no exclamations.
//
// Frames: conflict-with-alternatives · conflict-fully-booked (waitlist) ·
// stale-grid auto-refresh (re-fetching skeleton).

const { E, SH } = window;

const ACCENT = E.blue600;
const WARN = '#D97706', WARN_DK = '#92400E', WARN_BG = '#FFFBEB', WARN_RING = '#FDE68A';
const HOST_AV = 'linear-gradient(135deg,#38bdf8,#0369a1)';

// ─── Phone shell with dimmed backdrop + sheet ───────────────────────────────

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

// Faint review screen behind the sheet — proves details are preserved.
function Backdrop() {
  return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', filter:'saturate(0.9)' }}>
      <DarkStatusBar/>
      <div style={{ display:'flex', alignItems:'center', padding:'6px 8px', height:46, boxSizing:'border-box', background:E.surface, borderBottom:`1px solid ${E.border}` }}>
        <i data-lucide="chevron-left" style={{ width:20, height:20, color:E.fg3, margin:'0 7px' }}/>
        <div style={{ flex:1, textAlign:'center', fontSize:15, fontWeight:600, color:E.fg2, letterSpacing:-0.2 }}>Review &amp; confirm</div>
        <div style={{ width:34 }}/>
      </div>
      <div style={{ padding:'12px 13px', display:'flex', flexDirection:'column', gap:12 }}>
        <div style={{ background:E.surface, border:`1px solid ${E.border}`, borderRadius:16, padding:'12px 13px', display:'flex', alignItems:'center', gap:11 }}>
          <div style={{ width:34, height:34, borderRadius:'50%', background:HOST_AV, flexShrink:0 }}/>
          <div style={{ flex:1 }}>
            <div style={{ height:11, width:'55%', background:E.sunken, borderRadius:5 }}/>
            <div style={{ height:9, width:'40%', background:E.sunken, borderRadius:5, marginTop:6 }}/>
          </div>
        </div>
        <div style={{ background:E.surface, border:`1px solid ${E.border}`, borderRadius:12, padding:'12px 13px', display:'flex', flexDirection:'column', gap:9 }}>
          <div style={{ height:10, width:'70%', background:E.sunken, borderRadius:5 }}/>
          <div style={{ height:10, width:'50%', background:E.sunken, borderRadius:5 }}/>
        </div>
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
        <div style={{ position:'absolute', top:7, left:'50%', transform:'translateX(-50%)', width:88, height:24, borderRadius:16, background:'#000', zIndex:50 }}/>
        <Backdrop/>
        {/* scrim */}
        <div style={{ position:'absolute', inset:0, background:'rgba(17,24,39,0.45)', zIndex:10 }}/>
        {/* sheet */}
        <div style={{
          position:'absolute', left:0, right:0, bottom:0, zIndex:20, height:474,
          background:E.surface, borderTopLeftRadius:20, borderTopRightRadius:20,
          boxShadow:'0 -12px 40px rgba(17,24,39,0.22)', display:'flex', flexDirection:'column',
        }}>
          <div style={{ display:'flex', justifyContent:'center', paddingTop:9, paddingBottom:2, flexShrink:0 }}>
            <div style={{ width:38, height:4.5, borderRadius:9999, background:E.borderStrong }}/>
          </div>
          {children}
        </div>
        <div style={{ position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)', width:100, height:4, borderRadius:4, background:'rgba(255,255,255,0.5)', zIndex:70 }}/>
      </div>
    </div>
  );
}

// ─── Error halo block (A18) ─────────────────────────────────────────────────

function ErrorBlock({ title, body }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', gap:11, padding:'6px 18px 2px' }}>
      <div style={{ position:'relative', width:64, height:64, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:WARN_BG, opacity:0.6 }}/>
        <div style={{ position:'relative', width:50, height:50, borderRadius:'50%', background:WARN_BG, border:`2px solid ${WARN_RING}`, display:'flex', alignItems:'center', justifyContent:'center', color:WARN }}>
          <i data-lucide="calendar-x" style={{ width:24, height:24, strokeWidth:2 }}/>
        </div>
      </div>
      <div>
        <h2 style={{ margin:0, fontSize:17, fontWeight:700, color:E.fg1, letterSpacing:-0.2, lineHeight:'22px' }}>{title}</h2>
        <p style={{ margin:'6px 0 0', fontSize:12, color:E.fg2, lineHeight:'17px', maxWidth:228, letterSpacing:-0.03 }}>{body}</p>
      </div>
    </div>
  );
}

// ─── Support Trains slot row (reused 1:1) ───────────────────────────────────

function SlotRow({ weekday, date, time, duration, soonest }) {
  return (
    <button style={{
      width:'100%', display:'flex', alignItems:'center', gap:9, textAlign:'left',
      background:E.surface, border:`1px solid ${E.border}`, borderRadius:12, padding:'9px 11px',
      cursor:'pointer', boxShadow:'0 1px 2px rgba(0,0,0,0.03)',
    }}>
      <i data-lucide="clock" style={{ width:14, height:14, color:E.fg3, flexShrink:0 }}/>
      <div style={{ flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ fontSize:12, fontWeight:700, color:E.fg1, letterSpacing:-0.1, whiteSpace:'nowrap' }}>{weekday}</span>
          {soonest && (
            <span style={{ fontSize:8, fontWeight:700, letterSpacing:0.03, textTransform:'uppercase', color:E.blue700, background:E.blue50, border:`1px solid ${E.blue100}`, padding:'1px 4px', borderRadius:9999, whiteSpace:'nowrap' }}>Soonest</span>
          )}
        </div>
        <div style={{ fontSize:10, color:E.fg3, marginTop:2, whiteSpace:'nowrap' }}>{date}</div>
      </div>
      <div style={{ flex:1 }}/>
      <div style={{ textAlign:'right', flexShrink:0 }}>
        <div style={{ fontSize:12, fontWeight:700, color:E.fg1, letterSpacing:-0.1, fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap' }}>{time}</div>
        <div style={{ fontSize:10, color:E.fg3, marginTop:2, whiteSpace:'nowrap' }}>{duration}</div>
      </div>
      <i data-lucide="chevron-right" style={{ width:15, height:15, color:E.fg4, flexShrink:0 }}/>
    </button>
  );
}

function SkeletonRow() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:11, background:E.surface, border:`1px solid ${E.border}`, borderRadius:12, padding:'10px 12px' }}>
      <div style={{ width:15, height:15, borderRadius:5, ...SH }}/>
      <div style={{ minWidth:0 }}>
        <div style={{ width:74, height:11, borderRadius:5, ...SH }}/>
        <div style={{ width:50, height:9, borderRadius:5, marginTop:5, ...SH }}/>
      </div>
      <div style={{ flex:1 }}/>
      <div style={{ width:64, height:11, borderRadius:5, ...SH }}/>
    </div>
  );
}

function SheetBody({ children }) {
  return <div style={{ flex:1, overflow:'auto', padding:'4px 14px 12px', display:'flex', flexDirection:'column', gap:14 }}>{children}</div>;
}

function GhostButton({ icon, label }) {
  return (
    <button style={{
      width:'100%', height:44, borderRadius:12, cursor:'pointer',
      background:E.surface, border:`1px solid ${E.border}`, color:E.fg1, fontSize:13, fontWeight:700, letterSpacing:-0.1,
      display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7,
    }}>
      <i data-lucide={icon} style={{ width:15, height:15, strokeWidth:2.1 }}/>{label}
    </button>
  );
}

function PrimaryButton({ icon, label }) {
  return (
    <button style={{
      width:'100%', height:46, borderRadius:12, border:'none', cursor:'pointer',
      background:ACCENT, color:'#fff', fontSize:14, fontWeight:700, letterSpacing:-0.1,
      boxShadow:'0 6px 16px rgba(2,132,199,0.28)', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7,
    }}>
      <i data-lucide={icon} style={{ width:16, height:16, strokeWidth:2.2 }}/>{label}
    </button>
  );
}

// Sticky "Your details are saved." footer.
function SavedNote() {
  return (
    <div style={{ flexShrink:0, borderTop:`1px solid ${E.border}`, padding:'10px 14px 18px', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
      <i data-lucide="shield-check" style={{ width:13, height:13, color:E.success600, flexShrink:0 }}/>
      <span style={{ fontSize:11, color:E.fg3, fontWeight:600, letterSpacing:-0.03 }}>Your details are saved.</span>
    </div>
  );
}

// ─── FRAME 1 · CONFLICT — WITH ALTERNATIVES ─────────────────────────────────

function FrameAlternatives() {
  return (
    <Phone label="Slot taken · Alternatives">
      <SheetBody>
        <ErrorBlock title="That time was just taken" body="Someone grabbed 2:00 PM first. Here are the closest open times — no problem, these are still open." />
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <SlotRow weekday="Wed Jun 17" date="30 min later" time="2:30–3:00 PM" duration="30 min" soonest/>
          <SlotRow weekday="Wed Jun 17" date="Same day" time="3:30–4:00 PM" duration="30 min"/>
          <SlotRow weekday="Thu Jun 18" date="Next day" time="9:00–9:30 AM" duration="30 min"/>
          <SlotRow weekday="Thu Jun 18" date="Next day" time="11:00–11:30 AM" duration="30 min"/>
        </div>
        <GhostButton icon="calendar-search" label="Pick another time"/>
      </SheetBody>
      <SavedNote/>
    </Phone>
  );
}

// ─── FRAME 2 · CONFLICT — FULLY BOOKED (waitlist) ───────────────────────────

function FrameFullyBooked() {
  return (
    <Phone label="Slot taken · Fully booked">
      <SheetBody>
        <ErrorBlock title="That time was just taken" body="And the rest of this day just filled up too." />
        <div style={{
          background:E.surface, border:`1px dashed ${E.borderStrong}`, borderRadius:14, padding:'22px 18px',
          display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', gap:9,
        }}>
          <div style={{ width:48, height:48, borderRadius:'50%', background:E.sunken, color:E.fg3, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <i data-lucide="calendar-x" style={{ width:22, height:22, strokeWidth:1.9 }}/>
          </div>
          <div style={{ fontSize:14, fontWeight:700, color:E.fg1, letterSpacing:-0.15 }}>This day is fully booked</div>
          <div style={{ fontSize:11.5, color:E.fg3, lineHeight:'16px', maxWidth:208 }}>Join the waitlist and we'll text you the moment a time opens up.</div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
          <PrimaryButton icon="bell-plus" label="Join the waitlist"/>
          <GhostButton icon="calendar-search" label="See another day"/>
        </div>
      </SheetBody>
      <SavedNote/>
    </Phone>
  );
}

// ─── FRAME 3 · STALE GRID — AUTO REFRESH ────────────────────────────────────

function FrameRefreshing() {
  return (
    <Phone label="Slot taken · Re-fetching">
      <SheetBody>
        <ErrorBlock title="That time was just taken" body="Checking which times are still open right now." />
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <SkeletonRow/>
          <SkeletonRow/>
          <SkeletonRow/>
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
          <span style={{ width:7, height:7, borderRadius:'50%', background:ACCENT, animation:'slotPulse 1.4s ease-in-out infinite' }}/>
          <span style={{ fontSize:11, color:E.fg3, fontWeight:600, letterSpacing:-0.03 }}>Checking live availability</span>
        </div>
        <GhostButton icon="calendar-search" label="Pick another time"/>
      </SheetBody>
      <SavedNote/>
    </Phone>
  );
}

Object.assign(window, { FrameAlternatives, FrameFullyBooked, FrameRefreshing });
