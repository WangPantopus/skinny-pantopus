// Pantopus — Calendarly · Public booking page preview (owner mode flip) — 4 frames
// Archetype: OwnerPreviewFrame — the owner flips their Booking link screen into
// a read-only "Preview as invitee" render wrapped in dark preview chrome. Mirrors
// Place - Preview.html's PreviewBar, A10.6 Business profile + A21 persona header,
// and A10.9 Support train's public slot teaser. Zero owner affordances leak
// through; the whole render is inert. Owner pillar drives the accent; the render
// itself is the public /book/[slug] view. Sky primary, white cards, 1px border,
// 16px radius, shadow-sm, no left accents. Lucide stroke-2, no emoji.
//
// Frames: (1) rendered · (2) loading skeleton · (3) page paused · (4) all hidden.

const { E, SH } = window;

// ─── Preview phone wrapper (dark chrome over a light public render) ───

function WhiteStatusBar() {
  const c = '#fff';
  return (
    <div style={{
      display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'11px 22px 0', height:30, boxSizing:'border-box',
      fontFamily:'-apple-system, system-ui', fontWeight:600, fontSize:12.5, color:c, flexShrink:0,
    }}>
      <span>9:41</span>
      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
        <svg width="15" height="10" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={c}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={c}/><rect x="9" y="2" width="3" height="9" rx="0.6" fill={c}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={c}/></svg>
        <svg width="13" height="10" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={c}/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={c}/><circle cx="7.5" cy="9" r="1.3" fill={c}/></svg>
        <svg width="21" height="10" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={c} strokeOpacity="0.4" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill={c}/></svg>
      </div>
    </div>
  );
}

function PreviewBar() {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:9, padding:'9px 14px 12px',
      flexShrink:0,
    }}>
      <i data-lucide="eye" style={{ width:16, height:16, color:'#fff', strokeWidth:2, flexShrink:0 }}/>
      <span style={{ flex:1, fontSize:12.5, fontWeight:600, color:'#fff', letterSpacing:-0.1 }}>
        Previewing your booking page
      </span>
      <button style={{
        width:26, height:26, borderRadius:'50%', flexShrink:0,
        background:'rgba(255,255,255,0.12)', border:'none', cursor:'pointer',
        display:'flex', alignItems:'center', justifyContent:'center', color:'#fff',
      }}>
        <i data-lucide="x" style={{ width:15, height:15, strokeWidth:2.4 }}/>
      </button>
    </div>
  );
}

function PreviewPhone({ children, cta, label }) {
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
        {/* dark preview chrome — extends behind the status bar */}
        <div style={{ background:E.fg1, flexShrink:0, position:'relative' }}>
          <div style={{
            position:'absolute', top:7, left:'50%', transform:'translateX(-50%)',
            width:88, height:24, borderRadius:16, background:'#000', zIndex:50,
          }}/>
          <WhiteStatusBar/>
          <PreviewBar/>
        </div>

        {/* preview-only caption pill */}
        <div style={{
          display:'flex', justifyContent:'center', padding:'9px 0 3px', flexShrink:0,
        }}>
          <span style={{
            display:'inline-flex', alignItems:'center', gap:5, padding:'4px 11px',
            borderRadius:9999, background:E.sunken, color:E.fg3,
            fontSize:10.5, fontWeight:600, letterSpacing:-0.05,
          }}>
            <i data-lucide="eye-off" style={{ width:11, height:11, strokeWidth:2.2 }}/>
            Preview only. Nothing here is bookable.
          </span>
        </div>

        {/* the public render (inert) */}
        <div style={{
          flex:1, overflow:'auto', padding: cta ? '12px 16px 86px' : '12px 16px 22px',
          display:'flex', flexDirection:'column', gap:14,
        }}>
          {children}
        </div>

        {cta}

        <div style={{
          position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)',
          width:100, height:4, borderRadius:4, background:'rgba(0,0,0,0.25)', zIndex:60,
        }}/>
      </div>
    </div>
  );
}

// ─── Public render pieces ──────────────────────────────────────

function PublicHeader({ pillar='personal', name, headline, blurb, initials }) {
  const grad = pillar === 'business'
    ? 'linear-gradient(135deg,#a78bfa,#7c3aed)'
    : 'linear-gradient(135deg,#38bdf8,#0284c7)';
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', gap:3, paddingTop:4 }}>
      <div style={{
        width:64, height:64, borderRadius:'50%', background:grad, color:'#fff',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:22, fontWeight:700, letterSpacing:0.3, marginBottom:7,
        boxShadow:'0 4px 12px rgba(0,0,0,0.14)',
      }}>{initials}</div>
      <div style={{ fontSize:18, fontWeight:700, color:E.fg1, letterSpacing:-0.3 }}>{name}</div>
      <div style={{ fontSize:12.5, fontWeight:600, color:E.blue700 }}>{headline}</div>
      <div style={{ fontSize:12, color:E.fg3, lineHeight:'17px', maxWidth:230, marginTop:4 }}>{blurb}</div>
    </div>
  );
}

function ModeChip({ icon, label }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4, padding:'3px 8px',
      borderRadius:9999, background:E.blue50, color:E.blue700,
      fontSize:10, fontWeight:700, letterSpacing:0.02,
    }}>
      <i data-lucide={icon} style={{ width:10, height:10, strokeWidth:2.4 }}/>
      {label}
    </span>
  );
}

function EventTypeCard({ icon, name, dur, mode, modeIcon, selected }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:12, padding:'13px 13px',
      background:E.surface, borderRadius:16,
      border:`${selected ? 1.5 : 1}px solid ${selected ? E.blue600 : E.border}`,
      boxShadow: selected ? '0 0 0 3px rgba(2,132,199,0.10)' : '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        width:38, height:38, borderRadius:10, flexShrink:0,
        background: selected ? E.blue50 : E.sunken, color: selected ? E.blue600 : E.fg2,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <i data-lucide={icon} style={{ width:18, height:18, strokeWidth:2 }}/>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:14, fontWeight:600, color:E.fg1, letterSpacing:-0.1 }}>{name}</div>
        <div style={{ display:'flex', alignItems:'center', gap:7, marginTop:5, flexWrap:'wrap' }}>
          <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11.5, color:E.fg3, fontWeight:500 }}>
            <i data-lucide="clock" style={{ width:11, height:11 }}/>{dur}
          </span>
          <ModeChip icon={modeIcon} label={mode}/>
        </div>
      </div>
      <i data-lucide="chevron-right" style={{ width:18, height:18, color:E.fg4, flexShrink:0 }}/>
    </div>
  );
}

function PickTimeCTA() {
  return (
    <div style={{
      position:'absolute', bottom:0, left:0, right:0,
      background:'rgba(255,255,255,0.96)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
      borderTop:`1px solid ${E.border}`, padding:'10px 16px 18px', zIndex:10,
    }}>
      <button style={{
        width:'100%', height:44, borderRadius:12, border:'none',
        background:E.blue600, color:'#fff', fontSize:14, fontWeight:700, letterSpacing:-0.1,
        cursor:'default', boxShadow:'0 6px 16px rgba(2,132,199,0.28)',
        display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7,
      }}>
        Pick a time
        <i data-lucide="arrow-right" style={{ width:16, height:16 }}/>
      </button>
    </div>
  );
}

// ─── Skeleton + notice pieces ──────────────────────────────────

function Sk({ w, h, r=8, style }) {
  return <div style={{ width:w, height:h, borderRadius:r, ...SH, ...style }}/>;
}

function NoticeCard({ icon, title, body }) {
  return (
    <div style={{
      flex:1, display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', textAlign:'center', gap:12, padding:'30px 26px 60px',
    }}>
      <div style={{
        width:60, height:60, borderRadius:'50%', background:E.sunken, color:E.fg3,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <i data-lucide={icon} style={{ width:26, height:26, strokeWidth:1.75 }}/>
      </div>
      <div style={{ fontSize:16, fontWeight:600, color:E.fg1, letterSpacing:-0.2 }}>{title}</div>
      <div style={{ fontSize:12.5, color:E.fg3, lineHeight:'18px', maxWidth:220 }}>{body}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 1 · RENDERED — two event types populated
// ═══════════════════════════════════════════════════════════════

function FrameRendered() {
  return (
    <PreviewPhone label="Preview — rendered" cta={<PickTimeCTA/>}>
      <PublicHeader
        pillar="personal"
        name="Maria Kessler"
        headline="Brand strategy &amp; coaching"
        blurb="Book a time below and I'll send a calendar invite with the details."
        initials="MK"
      />
      <EventTypeCard icon="video" name="Intro call" dur="30 min" mode="Video call" modeIcon="video" selected/>
      <EventTypeCard icon="users" name="Strategy session" dur="60 min" mode="Video call" modeIcon="video"/>
    </PreviewPhone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 2 · LOADING — full render as shimmer skeleton
// ═══════════════════════════════════════════════════════════════

function FrameLoading() {
  return (
    <PreviewPhone label="Preview — loading">
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, paddingTop:6, marginBottom:6 }}>
        <Sk w={64} h={64} r="50%"/>
        <Sk w={150} h={16} r={6} style={{ marginTop:4 }}/>
        <Sk w={110} h={12} r={6}/>
      </div>
      <Sk w="100%" h={64} r={16}/>
      <Sk w="100%" h={64} r={16}/>
      <Sk w="100%" h={64} r={16}/>
    </PreviewPhone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 3 · PAGE OFF — paused notice (calm, muted, no red)
// ═══════════════════════════════════════════════════════════════

function FramePaused() {
  return (
    <PreviewPhone label="Preview — paused">
      <NoticeCard
        icon="moon"
        title="Your page is paused"
        body="Turn it back on in Booking link to take bookings."
      />
    </PreviewPhone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 4 · ALL TYPES HIDDEN — header shows, no services visible
// ═══════════════════════════════════════════════════════════════

function FrameHidden() {
  return (
    <PreviewPhone label="Preview — all services hidden">
      <PublicHeader
        pillar="personal"
        name="Maria Kessler"
        headline="Brand strategy &amp; coaching"
        blurb="Book a time below and I'll send a calendar invite with the details."
        initials="MK"
      />
      <div style={{
        background:E.surface, border:`1px dashed ${E.borderStrong}`, borderRadius:16,
        padding:'24px 20px', display:'flex', flexDirection:'column', alignItems:'center',
        textAlign:'center', gap:9,
      }}>
        <div style={{
          width:42, height:42, borderRadius:11, background:E.sunken, color:E.fg3,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <i data-lucide="calendar-off" style={{ width:20, height:20, strokeWidth:1.9 }}/>
        </div>
        <div style={{ fontSize:14, fontWeight:600, color:E.fg1, letterSpacing:-0.15 }}>No services are visible yet</div>
        <div style={{ fontSize:12, color:E.fg3, lineHeight:'17px', maxWidth:210 }}>
          Turn one on so people see something to book.
        </div>
      </div>
    </PreviewPhone>
  );
}

Object.assign(window, { FrameRendered, FrameLoading, FramePaused, FrameHidden });
