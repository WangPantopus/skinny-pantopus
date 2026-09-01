// Pantopus — Calendarly · Public booking landing / booker profile (full screen) — 9 frames
// Archetype: ContentDetail + ListOfRows of event-type cards. The public
// /book/[slug] page (also reached in-app via deeplink pantopus://book/:slug,
// from the host's public profile "Book time", and from QR/email/SMS).
// Mirrors A21 persona/local profile header + A10.9 Support train's public
// event-type/slot list. Invitee view — auth-optional.
//
// Non-negotiables: sky #0284C7 on functional chrome (Pick a time, Save your
// spot, links); accent follows the host's pillar (Personal sky / Home green /
// Business violet) on the banner, headline, and chips. White cards, 1px border,
// 16px radius, shadow-sm, no left accents. Lucide stroke-2, no emoji. Voice
// plainspoken, second person, verbs-first, sentence case, no exclamations.
//
// Frames: loading · multi (default) · single · group-available · group-full ·
// team/composed · paused · empty · error.

const { E, SH } = window;

const SUCCESS = '#059669', SUCCESS_BG = '#ECFDF5', SUCCESS_BORDER = '#A7F3D0';

const PILLARS = {
  personal: { fg:'#0284C7', banner:['#7dd3fc','#0284c7','#075985'], avatar:'linear-gradient(135deg,#38bdf8,#0369a1)' },
  home:     { fg:'#16A34A', banner:['#86efac','#16a34a','#15803d'], avatar:'linear-gradient(135deg,#34d399,#15803d)' },
  business: { fg:'#7C3AED', banner:['#c4b5fd','#7c3aed','#5b21b6'], avatar:'linear-gradient(135deg,#a78bfa,#5b21b6)' },
};

// ─── Phone shell (full screen, no tab bar) ────────────────────────────────

function StatusBar() {
  // mixBlendMode:difference makes the glyphs white over the banner, dark over white
  return (
    <div style={{
      position:'absolute', top:0, left:0, right:0, zIndex:40,
      display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'12px 22px 0', height:34, boxSizing:'border-box', color:'#fff',
      mixBlendMode:'difference', pointerEvents:'none',
      fontFamily:'-apple-system, system-ui', fontWeight:600, fontSize:12.5,
    }}>
      <span>9:41</span>
      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
        <svg width="15" height="10" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill="#fff"/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill="#fff"/><rect x="9" y="2" width="3" height="9" rx="0.6" fill="#fff"/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill="#fff"/></svg>
        <svg width="13" height="10" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill="#fff"/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill="#fff"/><circle cx="7.5" cy="9" r="1.3" fill="#fff"/></svg>
        <svg width="21" height="10" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke="#fff" strokeOpacity="0.6" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill="#fff"/></svg>
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
        <StatusBar/>
        <div style={{ flex:1, overflow:'auto', position:'relative' }}>
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

// ─── Header ───────────────────────────────────────────────────────────────

function Banner({ pillar, plain }) {
  const p = PILLARS[pillar] || PILLARS.personal;
  if (plain) return <div style={{ height:96, background:E.sunken, flexShrink:0 }}/>;
  const [c1, c2, c3] = p.banner;
  return (
    <div style={{
      height:96, position:'relative', flexShrink:0, overflow:'hidden',
      background:`linear-gradient(135deg, ${c1} 0%, ${c2} 58%, ${c3} 100%)`,
    }}>
      <div style={{
        position:'absolute', top:-30, right:-20, width:120, height:120, borderRadius:'50%',
        background:'radial-gradient(circle, rgba(255,255,255,0.32) 0%, transparent 65%)',
      }}/>
      <div style={{
        position:'absolute', bottom:-40, left:24, width:130, height:130, borderRadius:'50%',
        background:'radial-gradient(circle, rgba(255,255,255,0.28) 0%, transparent 65%)',
      }}/>
    </div>
  );
}

function GreenCheck({ size = 20 }) {
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%', background:SUCCESS,
      border:'2.5px solid #fff', boxSizing:'content-box', flexShrink:0,
      display:'flex', alignItems:'center', justifyContent:'center',
    }}>
      <i data-lucide="check" style={{ width:size*0.55, height:size*0.55, color:'#fff', strokeWidth:4 }}/>
    </div>
  );
}

function Avatar({ pillar, initials, size = 64, verified }) {
  return (
    <div style={{ position:'relative', flexShrink:0 }}>
      <div style={{
        width:size, height:size, borderRadius:'50%', background:PILLARS[pillar].avatar,
        border:'3px solid #fff', boxSizing:'border-box',
        display:'flex', alignItems:'center', justifyContent:'center',
        color:'#fff', fontWeight:700, fontSize:size*0.36, letterSpacing:-0.3,
        boxShadow:'0 4px 10px rgba(0,0,0,0.08)',
      }}>{initials}</div>
      {verified && <div style={{ position:'absolute', right:-2, bottom:-2 }}><GreenCheck size={18}/></div>}
    </div>
  );
}

function TeamCluster({ pillar }) {
  const members = [
    { initials:'AR', grad:'linear-gradient(135deg,#a78bfa,#6d28d9)' },
    { initials:'JL', grad:'linear-gradient(135deg,#38bdf8,#0369a1)' },
    { initials:'MK', grad:'linear-gradient(135deg,#fdba74,#ea580c)' },
  ];
  return (
    <div style={{ position:'relative', flexShrink:0, height:64, display:'flex', alignItems:'center' }}>
      <div style={{ display:'flex' }}>
        {members.map((m, i) => (
          <div key={i} style={{
            width:52, height:52, borderRadius:'50%', background:m.grad, color:'#fff',
            border:'3px solid #fff', boxSizing:'border-box', marginLeft: i === 0 ? 0 : -18,
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:700,
            boxShadow:'0 2px 6px rgba(0,0,0,0.10)',
          }}>{m.initials}</div>
        ))}
      </div>
      <div style={{ position:'absolute', right:-2, bottom:-2 }}><GreenCheck size={18}/></div>
    </div>
  );
}

function Header({ pillar, name, headline, blurb, verified = true, team }) {
  const accent = PILLARS[pillar].fg;
  return (
    <div style={{
      margin:'-34px 14px 0', background:E.surface, border:`1px solid ${E.border}`,
      borderRadius:16, padding:14, position:'relative', zIndex:5,
      boxShadow:'0 6px 20px rgba(17,24,39,0.06)',
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
        <div style={{ marginTop:-36 }}>
          {team ? <TeamCluster pillar={pillar}/> : <Avatar pillar={pillar} initials={name.slice(0,2)} verified={verified}/>}
        </div>
        <div style={{ flex:1 }}/>
        <button style={{
          width:32, height:32, borderRadius:9, flexShrink:0, cursor:'pointer',
          background:E.surface, border:`1px solid ${E.border}`, color:E.fg2,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}><i data-lucide="share" style={{ width:15, height:15 }}/></button>
      </div>

      <div style={{ fontSize:18, fontWeight:700, color:E.fg1, letterSpacing:-0.3, marginTop:10 }}>{name}</div>
      <div style={{ fontSize:12.5, fontWeight:600, color:accent, marginTop:3 }}>
        {team ? 'Meet with the team' : headline}
      </div>
      <div style={{ fontSize:12.5, color:E.fg2, marginTop:8, lineHeight:'18px' }}>{blurb}</div>
    </div>
  );
}

// ─── Open-in-app banner ───────────────────────────────────────────────────

function OpenInApp() {
  return (
    <div style={{
      margin:'12px 14px 0', display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
      background:E.blue50, border:`1px solid ${E.blue100}`, borderRadius:14,
    }}>
      <div style={{
        width:30, height:30, borderRadius:8, flexShrink:0, background:'#fff', color:E.blue600,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}><i data-lucide="smartphone" style={{ width:16, height:16, strokeWidth:2 }}/></div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:11.5, fontWeight:700, color:E.fg1, letterSpacing:-0.1, lineHeight:'15px' }}>Get a faster booking experience</div>
      </div>
      <button style={{
        flexShrink:0, padding:'6px 11px', borderRadius:8, border:'none', cursor:'pointer',
        background:E.blue600, color:'#fff', fontSize:11.5, fontWeight:700, letterSpacing:-0.05,
      }}>Open</button>
      <button style={{
        width:22, height:22, borderRadius:'50%', flexShrink:0, cursor:'pointer',
        background:'transparent', border:'none', color:E.fg4,
        display:'flex', alignItems:'center', justifyContent:'center', padding:0,
      }}><i data-lucide="x" style={{ width:14, height:14 }}/></button>
    </div>
  );
}

// ─── Event-type list ──────────────────────────────────────────────────────

function ModeChip({ icon, label, accent }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:9999,
      background:E.blue50, color:E.blue700, fontSize:10, fontWeight:700, letterSpacing:0.02,
    }}>
      <i data-lucide={icon} style={{ width:10, height:10, strokeWidth:2.4 }}/>
      {label}
    </span>
  );
}

function EventTypeRow({ icon, name, dur, mode, modeIcon }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:12, padding:'12px 13px',
      background:E.surface, border:`1px solid ${E.border}`, borderRadius:16,
      boxShadow:'0 1px 3px rgba(0,0,0,0.04)', cursor:'pointer',
    }}>
      <div style={{
        width:38, height:38, borderRadius:10, flexShrink:0, background:E.sunken, color:E.fg2,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}><i data-lucide={icon} style={{ width:18, height:18, strokeWidth:2 }}/></div>
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

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize:9.5, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase',
      color:E.fg3, padding:'0 2px',
    }}>{children}</div>
  );
}

function ListArea({ children }) {
  return (
    <div style={{ padding:'14px 14px 0', display:'flex', flexDirection:'column', gap:10 }}>
      {children}
    </div>
  );
}

// ─── Group event card ─────────────────────────────────────────────────────

function GroupEventCard({ pillar, full }) {
  return (
    <div style={{
      background:E.surface, border:`1px solid ${E.border}`, borderRadius:16,
      boxShadow:'0 1px 3px rgba(0,0,0,0.04)', overflow:'hidden',
    }}>
      <div style={{ padding:'13px 13px 12px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{
            width:38, height:38, borderRadius:10, flexShrink:0, background:E.sunken, color:E.fg2,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}><i data-lucide="users-round" style={{ width:18, height:18, strokeWidth:2 }}/></div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:600, color:E.fg1, letterSpacing:-0.1 }}>Group workshop</div>
            <div style={{ display:'flex', alignItems:'center', gap:7, marginTop:4 }}>
              <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11.5, color:E.fg3, fontWeight:500 }}>
                <i data-lucide="clock" style={{ width:11, height:11 }}/>90 min
              </span>
              <ModeChip icon="video" label="Video call"/>
            </div>
          </div>
        </div>

        {/* fixed time */}
        <div style={{
          display:'flex', alignItems:'center', gap:10, marginTop:12, padding:'10px 12px',
          background:E.raised, border:`1px solid ${E.border}`, borderRadius:12,
        }}>
          <i data-lucide="calendar" style={{ width:15, height:15, color:E.fg2, flexShrink:0 }}/>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12.5, fontWeight:600, color:E.fg1, letterSpacing:-0.1, whiteSpace:'nowrap' }}>Sat, Jun 21</div>
            <div style={{ fontSize:11, color:E.fg3, marginTop:1 }}>10:00 – 11:30 AM</div>
          </div>
          <span style={{
            display:'inline-flex', alignItems:'center', gap:4, padding:'4px 8px', borderRadius:9999,
            fontSize:10, fontWeight:700, letterSpacing:-0.05, flexShrink:0, whiteSpace:'nowrap',
            background: full ? E.sunken : SUCCESS_BG,
            color: full ? E.fg3 : SUCCESS,
            border: full ? `1px solid ${E.border}` : `1px solid ${SUCCESS_BORDER}`,
          }}>
            <i data-lucide={full ? 'users' : 'user-check'} style={{ width:11, height:11, strokeWidth:2.4 }}/>
            {full ? 'Fully booked' : '4 of 8 spots left'}
          </span>
        </div>
      </div>

      <div style={{ padding:'0 13px 13px', display:'flex', flexDirection:'column', gap:8 }}>
        <button disabled={full} style={{
          width:'100%', height:44, borderRadius:12, border:'none', letterSpacing:-0.1,
          background: full ? E.sunken : E.blue600, color: full ? E.fg4 : '#fff',
          fontSize:14, fontWeight:700, cursor: full ? 'not-allowed' : 'pointer',
          boxShadow: full ? 'none' : '0 6px 16px rgba(2,132,199,0.28)',
          display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7,
        }}>
          <i data-lucide={full ? 'lock' : 'calendar-check'} style={{ width:16, height:16 }}/>
          {full ? 'Fully booked' : 'Save your spot'}
        </button>
        {full && (
          <button style={{
            width:'100%', height:42, borderRadius:12, cursor:'pointer', letterSpacing:-0.1,
            background:E.surface, border:`1px solid ${E.border}`, color:E.fg1,
            fontSize:13.5, fontWeight:700,
            display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
          }}>
            <i data-lucide="bell-plus" style={{ width:15, height:15 }}/>
            Join waitlist
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Composed-availability explainer ──────────────────────────────────────

function ComposedPill({ tag = 'Round-robin' }) {
  return (
    <div style={{
      margin:'12px 14px 0', display:'flex', alignItems:'center', gap:9, padding:'9px 12px',
      background:E.businessBg, border:'1px solid #e9d5ff', borderRadius:12,
    }}>
      <i data-lucide="calendar-range" style={{ width:15, height:15, color:E.business, flexShrink:0 }}/>
      <div style={{ flex:1, minWidth:0, fontSize:11.5, color:'#6b21a8', fontWeight:500, lineHeight:'15px' }}>
        Times come from each member's availability.
      </div>
      <span style={{
        flexShrink:0, padding:'3px 8px', borderRadius:9999, background:'#fff', color:E.business,
        fontSize:10, fontWeight:700, letterSpacing:-0.05, border:'1px solid #e9d5ff',
      }}>{tag}</span>
    </div>
  );
}

// ─── Caption note (single-type auto-skip) ─────────────────────────────────

function InlineNote({ icon, children }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:8, padding:'10px 12px',
      background:E.blue50, border:`1px solid ${E.blue100}`, borderRadius:12,
    }}>
      <i data-lucide={icon} style={{ width:14, height:14, color:E.blue600, flexShrink:0 }}/>
      <span style={{ fontSize:11.5, color:E.blue700, fontWeight:600, letterSpacing:-0.05 }}>{children}</span>
    </div>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────

function Footer({ name }) {
  return (
    <div style={{
      padding:'22px 16px 26px', display:'flex', flexDirection:'column', alignItems:'center', gap:10,
    }}>
      {name && (
        <button style={{
          display:'inline-flex', alignItems:'center', gap:5, background:'transparent', border:'none',
          padding:0, cursor:'pointer', color:E.blue600, fontSize:12, fontWeight:700, letterSpacing:-0.05,
        }}>
          <span>View {name}'s profile</span>
          <i data-lucide="arrow-up-right" style={{ width:13, height:13, strokeWidth:2.4 }}/>
        </button>
      )}
      <div style={{ display:'inline-flex', alignItems:'center', gap:5, color:E.fg4 }}>
        <i data-lucide="calendar-clock" style={{ width:12, height:12 }}/>
        <span style={{ fontSize:10.5, fontWeight:600, letterSpacing:0.02 }}>Powered by Pantopus</span>
      </div>
    </div>
  );
}

// ─── Notice (paused / empty / error) ──────────────────────────────────────

function Notice({ icon, title, body }) {
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      textAlign:'center', gap:12, padding:'70px 30px 40px', minHeight:300,
    }}>
      <div style={{
        width:60, height:60, borderRadius:'50%', background:E.sunken, color:E.fg3,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}><i data-lucide={icon} style={{ width:26, height:26, strokeWidth:1.75 }}/></div>
      <div style={{ fontSize:16, fontWeight:700, color:E.fg1, letterSpacing:-0.2 }}>{title}</div>
      <div style={{ fontSize:12.5, color:E.fg3, lineHeight:'18px', maxWidth:230 }}>{body}</div>
    </div>
  );
}

// ─── Skeleton helpers ─────────────────────────────────────────────────────

function Sk({ w, h, r = 8, style }) {
  return <div style={{ width:w, height:h, borderRadius:r, ...SH, ...style }}/>;
}

// ─── FRAME 1 · LOADING ────────────────────────────────────────────────────

function FrameLoading() {
  return (
    <Phone label="Booking landing · Loading">
      <Banner plain/>
      <div style={{
        margin:'-34px 14px 0', background:E.surface, border:`1px solid ${E.border}`,
        borderRadius:16, padding:14, boxShadow:'0 6px 20px rgba(17,24,39,0.06)',
      }}>
        <Sk w={64} h={64} r="50%" style={{ marginTop:-36, border:'3px solid #fff' }}/>
        <Sk w={150} h={16} r={6} style={{ marginTop:12 }}/>
        <Sk w={120} h={12} r={6} style={{ marginTop:9 }}/>
        <Sk w="92%" h={11} r={6} style={{ marginTop:10 }}/>
      </div>
      <div style={{ padding:'16px 14px 0', display:'flex', flexDirection:'column', gap:10 }}>
        <Sk w="100%" h={64} r={16}/>
        <Sk w="100%" h={64} r={16}/>
        <Sk w="100%" h={64} r={16}/>
      </div>
    </Phone>
  );
}

// ─── FRAME 2 · MULTI (default) ────────────────────────────────────────────

function FrameMulti() {
  return (
    <Phone label="Booking landing · Multiple types">
      <Banner pillar="personal"/>
      <Header
        pillar="personal" name="Maria Kessler" headline="Brand strategy & coaching"
        blurb="Pick a time that works for you and I'll send a calendar invite with the details."
      />
      <OpenInApp/>
      <ListArea>
        <SectionLabel>Book a time</SectionLabel>
        <EventTypeRow icon="video" name="Intro call" dur="30 min" mode="Video call" modeIcon="video"/>
        <EventTypeRow icon="users" name="Strategy session" dur="60 min" mode="In person" modeIcon="map-pin"/>
        <EventTypeRow icon="phone" name="Quick question" dur="15 min" mode="Phone" modeIcon="phone"/>
      </ListArea>
      <Footer name="Maria"/>
    </Phone>
  );
}

// ─── FRAME 3 · SINGLE (auto-skip) ─────────────────────────────────────────

function FrameSingle() {
  return (
    <Phone label="Booking landing · Single type">
      <Banner pillar="personal"/>
      <Header
        pillar="personal" name="Maria Kessler" headline="Brand strategy & coaching"
        blurb="Pick a time that works for you and I'll send a calendar invite with the details."
      />
      <ListArea>
        <SectionLabel>Book a time</SectionLabel>
        <EventTypeRow icon="video" name="Intro call" dur="30 min" mode="Video call" modeIcon="video"/>
        <InlineNote icon="arrow-right-circle">Going straight to pick a time.</InlineNote>
      </ListArea>
      <Footer name="Maria"/>
    </Phone>
  );
}

// ─── FRAME 4 · GROUP — seats available ────────────────────────────────────

function FrameGroup() {
  return (
    <Phone label="Booking landing · Group event">
      <Banner pillar="home"/>
      <Header
        pillar="home" name="Elm Park Garden" headline="Community workshops"
        blurb="Join a hands-on session with your neighbors. Spots are limited."
      />
      <ListArea>
        <SectionLabel>Upcoming session</SectionLabel>
        <GroupEventCard pillar="home"/>
      </ListArea>
      <Footer name="Elm Park Garden"/>
    </Phone>
  );
}

// ─── FRAME 5 · GROUP — full ───────────────────────────────────────────────

function FrameGroupFull() {
  return (
    <Phone label="Booking landing · Group full">
      <Banner pillar="home"/>
      <Header
        pillar="home" name="Elm Park Garden" headline="Community workshops"
        blurb="Join a hands-on session with your neighbors. Spots are limited."
      />
      <ListArea>
        <SectionLabel>Upcoming session</SectionLabel>
        <GroupEventCard pillar="home" full/>
      </ListArea>
      <Footer name="Elm Park Garden"/>
    </Phone>
  );
}

// ─── FRAME 6 · TEAM / COMPOSED ────────────────────────────────────────────

function FrameTeam() {
  return (
    <Phone label="Booking landing · Team">
      <Banner pillar="business"/>
      <Header
        pillar="business" name="Northside Studio" team
        blurb="Book design time with whoever's free first. We'll match you with the right person."
      />
      <ComposedPill tag="Round-robin"/>
      <ListArea>
        <SectionLabel>Book a time</SectionLabel>
        <EventTypeRow icon="video" name="Project kickoff" dur="45 min" mode="Video call" modeIcon="video"/>
        <EventTypeRow icon="users" name="Design review" dur="30 min" mode="Video call" modeIcon="video"/>
      </ListArea>
      <Footer name="Northside Studio"/>
    </Phone>
  );
}

// ─── FRAME 7 · PAUSED ─────────────────────────────────────────────────────

function FramePaused() {
  return (
    <Phone label="Booking landing · Paused">
      <Banner pillar="personal"/>
      <Header
        pillar="personal" name="Maria Kessler" headline="Brand strategy & coaching"
        blurb="Pick a time that works for you and I'll send a calendar invite with the details."
      />
      <ListArea>
        <div style={{
          background:E.surface, border:`1px solid ${E.border}`, borderRadius:16,
          padding:'24px 20px', display:'flex', flexDirection:'column', alignItems:'center',
          textAlign:'center', gap:9, boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{
            width:46, height:46, borderRadius:'50%', background:E.sunken, color:E.fg3,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}><i data-lucide="moon" style={{ width:21, height:21, strokeWidth:1.9 }}/></div>
          <div style={{ fontSize:14.5, fontWeight:600, color:E.fg1, letterSpacing:-0.15 }}>This page isn't taking bookings right now</div>
          <div style={{ fontSize:12, color:E.fg3, lineHeight:'17px', maxWidth:220 }}>
            Check back later, or reach out to Maria directly.
          </div>
        </div>
      </ListArea>
      <Footer name="Maria"/>
    </Phone>
  );
}

// ─── FRAME 8 · EMPTY ──────────────────────────────────────────────────────

function FrameEmpty() {
  return (
    <Phone label="Booking landing · Empty">
      <Banner pillar="personal"/>
      <Header
        pillar="personal" name="Maria Kessler" headline="Brand strategy & coaching"
        blurb="Pick a time that works for you and I'll send a calendar invite with the details."
      />
      <ListArea>
        <div style={{
          background:E.surface, border:`1px dashed ${E.borderStrong}`, borderRadius:16,
          padding:'24px 20px', display:'flex', flexDirection:'column', alignItems:'center',
          textAlign:'center', gap:9,
        }}>
          <div style={{
            width:46, height:46, borderRadius:11, background:E.sunken, color:E.fg3,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}><i data-lucide="calendar-off" style={{ width:21, height:21, strokeWidth:1.9 }}/></div>
          <div style={{ fontSize:14.5, fontWeight:600, color:E.fg1, letterSpacing:-0.15 }}>No times are set up yet</div>
          <div style={{ fontSize:12, color:E.fg3, lineHeight:'17px', maxWidth:220 }}>
            Maria hasn't added any availability. Check back soon.
          </div>
        </div>
      </ListArea>
      <Footer name="Maria"/>
    </Phone>
  );
}

// ─── FRAME 9 · ERROR (link disabled / host not found) ─────────────────────

function FrameError() {
  return (
    <Phone label="Booking landing · Error">
      <Notice
        icon="link-2-off"
        title="This link isn't available"
        body="It may have been turned off or moved. Double-check the link with whoever sent it."
      />
      <Footer/>
    </Phone>
  );
}

Object.assign(window, {
  FrameLoading, FrameMulti, FrameSingle, FrameGroup, FrameGroupFull,
  FrameTeam, FramePaused, FrameEmpty, FrameError,
});
