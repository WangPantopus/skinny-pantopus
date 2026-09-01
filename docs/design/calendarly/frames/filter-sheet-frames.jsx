// Pantopus — Calendarly · Booking Search & Filter (sheet) — 3 frames
// Archetype: FilterSheetShell (the shared shell GigFilterSheet projects over).
// Owner-polymorphic; active scope pre-selected in the owner-context facet.
//
// Frames: 1 default (nothing set, CTA "Show all") · 2 active-filters (3 chips
// set, removable summary, count in CTA) · 3 no-results (empty note, CTA disabled).

const { E, SH } = window;

const IDC = { personal:'#0284c7', home:'#16a34a', business:'#7c3aed' };
const IDB = { personal:'#e0f2fe', home:'#dcfce7', business:'#f3e8ff' };
const PRIMARY = E.blue600;

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

function Sheet({ label, children, cta, ctaDisabled, clearActive }) {
  return (
    <div style={{ width:300, height:620, borderRadius:40, padding:8, background:'#0b0f17', boxShadow:'0 24px 50px rgba(17,24,39,0.20), 0 0 0 1px rgba(0,0,0,0.12)', flexShrink:0 }} data-screen-label={label}>
      <div style={{ width:'100%', height:'100%', background:E.bg, borderRadius:32, overflow:'hidden', position:'relative', display:'flex', flexDirection:'column', fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div style={{ position:'absolute', top:7, left:'50%', transform:'translateX(-50%)', width:88, height:24, borderRadius:16, background:'#000', zIndex:50 }}/>
        <DarkStatusBar/>
        <div style={{ flex:1, opacity:0.4, padding:'14px 16px' }}>
          <div style={{ fontSize:15.5, fontWeight:600, color:E.fg1, textAlign:'center' }}>Bookings</div>
        </div>
        <div style={{ position:'absolute', inset:0, background:'rgba(17,24,39,0.42)', zIndex:18 }}/>
        <div style={{ position:'absolute', left:0, right:0, bottom:0, top:50, zIndex:20, background:E.surface, borderTopLeftRadius:24, borderTopRightRadius:24, boxShadow:'0 -8px 30px rgba(0,0,0,0.18)', display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', justifyContent:'center', paddingTop:9, paddingBottom:3, flexShrink:0 }}><div style={{ width:36, height:5, borderRadius:9999, background:E.borderStrong }}/></div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 16px 10px', flexShrink:0 }}>
            <span style={{ fontSize:16.5, fontWeight:700, color:E.fg1, letterSpacing:-0.2 }}>Filter bookings</span>
            <button style={{ background:'transparent', border:'none', cursor:clearActive?'pointer':'default', color: clearActive?PRIMARY:E.fg4, fontSize:13, fontWeight:700, padding:0 }}>Clear all</button>
          </div>
          <div style={{ flex:1, overflow:'auto', padding:'2px 16px 12px' }}>{children}</div>
          <div style={{ flexShrink:0, padding:'10px 16px 20px', borderTop:`1px solid ${E.border}`, background:E.surface }}>
            <button disabled={ctaDisabled} style={{ width:'100%', height:48, borderRadius:13, border:'none', background: ctaDisabled?E.sunken:PRIMARY, color: ctaDisabled?E.fg4:'#fff', fontSize:14.5, fontWeight:700, cursor:ctaDisabled?'default':'pointer', boxShadow: ctaDisabled?'none':'0 6px 16px rgba(2,132,199,0.28)' }}>{cta}</button>
          </div>
        </div>
        <div style={{ position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)', width:100, height:4, borderRadius:4, background:'rgba(255,255,255,0.5)', zIndex:70 }}/>
      </div>
    </div>
  );
}

function SearchField() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:9, padding:'0 12px', height:42, background:E.sunken, border:`1px solid ${E.border}`, borderRadius:8, marginBottom:16 }}>
      <i data-lucide="search" style={{ width:16, height:16, color:E.fg4 }}/>
      <span style={{ fontSize:12.5, color:E.fg4 }}>Search invitee or intake text</span>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:E.fg3, marginBottom:9 }}>{label}</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>{children}</div>
    </div>
  );
}

function Chip({ label, on, color, bg }) {
  return (
    <button style={{ height:34, padding:'0 14px', borderRadius:9999, cursor:'pointer', fontSize:12, fontWeight:700, border: on?'none':`1px solid ${E.border}`, background: on?(bg||E.blue50):E.surface, color: on?(color||PRIMARY):E.fg2, display:'inline-flex', alignItems:'center', gap:6 }}>
      {on && color && <span style={{ width:7, height:7, borderRadius:'50%', background:color }}/>}{label}
    </button>
  );
}

function ActiveSummary({ items }) {
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:E.fg3, marginBottom:9 }}>Active filters</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
        {items.map((it) => (
          <span key={it.l} style={{ height:30, padding:'0 7px 0 11px', borderRadius:9999, background: it.bg||E.blue50, color: it.color||PRIMARY, fontSize:11.5, fontWeight:700, display:'inline-flex', alignItems:'center', gap:6 }}>
            {it.l}<i data-lucide="x" style={{ width:13, height:13 }}/>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── FRAME 1 · DEFAULT ──────────────────────────────────────────────────────

function FrameDefault() {
  return (
    <Sheet label="Filter · Default" cta="Show all bookings">
      <SearchField/>
      <Section label="Status">
        <Chip label="Upcoming"/><Chip label="Pending"/><Chip label="Past"/><Chip label="Cancelled"/><Chip label="No-show"/>
      </Section>
      <Section label="Owner context">
        <Chip label="All"/><Chip label="Personal"/><Chip label="Home"/>
        <Chip label="Business" on color={IDC.business} bg={IDB.business}/>
      </Section>
      <Section label="Event type">
        <Chip label="30-min intro"/><Chip label="Consultation"/><Chip label="Group class"/>
      </Section>
      <Section label="Date range">
        <Chip label="Today"/><Chip label="This week"/><Chip label="This month"/><Chip label="Custom"/>
      </Section>
    </Sheet>
  );
}

// ─── FRAME 2 · ACTIVE FILTERS ───────────────────────────────────────────────

function FrameActive() {
  return (
    <Sheet label="Filter · Active" cta="Show 12 bookings" clearActive>
      <SearchField/>
      <ActiveSummary items={[
        { l:'Pending', color:'#B45309', bg:'#FFFBEB' },
        { l:'Business', color:IDC.business, bg:IDB.business },
        { l:'This week' },
      ]}/>
      <Section label="Status">
        <Chip label="Upcoming"/><Chip label="Pending" on color="#B45309" bg="#FFFBEB"/><Chip label="Past"/><Chip label="Cancelled"/>
      </Section>
      <Section label="Owner context">
        <Chip label="All"/><Chip label="Personal"/><Chip label="Home"/><Chip label="Business" on color={IDC.business} bg={IDB.business}/>
      </Section>
      <Section label="Date range">
        <Chip label="Today"/><Chip label="This week" on/><Chip label="This month"/><Chip label="Custom"/>
      </Section>
    </Sheet>
  );
}

// ─── FRAME 3 · NO RESULTS ───────────────────────────────────────────────────

function FrameNoResults() {
  return (
    <Sheet label="Filter · No results" cta="No matches" ctaDisabled clearActive>
      <SearchField/>
      <ActiveSummary items={[
        { l:'No-show', color:'#DC2626', bg:'#FEF2F2' },
        { l:'Personal', color:IDC.personal, bg:IDB.personal },
        { l:'Today' },
      ]}/>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', padding:'24px 24px 8px', gap:12 }}>
        <div style={{ width:60, height:60, borderRadius:'50%', background:E.sunken, color:E.fg3, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="search-x" style={{ width:26, height:26, strokeWidth:1.8 }}/></div>
        <div>
          <div style={{ fontSize:14, fontWeight:700, color:E.fg1 }}>No bookings match these filters</div>
          <button style={{ marginTop:9, background:'transparent', border:'none', color:PRIMARY, fontSize:12.5, fontWeight:700, cursor:'pointer' }}>Clear all</button>
        </div>
      </div>
    </Sheet>
  );
}

Object.assign(window, { FrameDefault, FrameActive, FrameNoResults });
