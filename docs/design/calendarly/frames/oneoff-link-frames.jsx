// Pantopus — Calendarly · One-off / single-use link generator (bottom sheet) — 4 frames
// Archetype: Form (compact) reusing token-invite infra (crypto random + SHA-256
// + expiry) presented in an iOS share sheet. Mirrors A12.11 Start a Support
// Train's compact config layout and A13 Share Home's generated-link block.
// Lives in: Bookings Inbox FAB, Booking Detail follow-up, Messages compose
// (attach booking link), pillar booking settings. Accent follows the host's
// pillar (Personal sky / Business violet); functional chrome stays product sky.
//
// Non-negotiables: sky #0284C7 on functional chrome (Generate, Copy, chips,
// toggles); pillar accent ONLY on the identity chip. White cards, 1px border,
// 16px radius, shadow-sm, no left accents. Lucide stroke-2, no emoji. Voice
// plainspoken, verbs-first, sentence case, no exclamations.
//
// Frames: configuring (default) · generated · copied · error.

const { E, SH, Toggle } = window;

const PILLARS = {
  personal: { dot:'#0284C7', bg:E.personalBg, fg:E.personal, label:'Personal', icon:'user' },
  business: { dot:'#7C3AED', bg:E.businessBg, fg:E.business, label:'Business', icon:'briefcase' },
};

const SUCCESS = '#059669', SUCCESS_BG = '#ECFDF5', SUCCESS_BORDER = '#A7F3D0';
const ERROR = '#DC2626', ERROR_BG = '#FEF2F2', ERROR_BORDER = '#FCA5A5';

const URL_DISPLAY = 'pantopus.com/book/x/7gq4f2';

// ─── White status bar (over a dimmed app) ─────────────────────────────────

function WhiteStatusBar() {
  const c = '#fff';
  return (
    <div style={{
      display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'12px 22px 0', height:34, boxSizing:'border-box', position:'relative', zIndex:30,
      fontFamily:'-apple-system, system-ui', fontWeight:600, fontSize:12.5, color:c, flexShrink:0,
    }}>
      <span>9:41</span>
      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
        <svg width="15" height="10" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={c}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={c}/><rect x="9" y="2" width="3" height="9" rx="0.6" fill={c}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={c}/></svg>
        <svg width="13" height="10" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={c}/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={c}/><circle cx="7.5" cy="9" r="1.3" fill={c}/></svg>
        <svg width="21" height="10" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={c} strokeOpacity="0.5" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill={c}/><path d="M22.5 3.8v3.4c.6-.2 1-.8 1-1.7s-.4-1.5-1-1.7z" fill={c} fillOpacity="0.5"/></svg>
      </div>
    </div>
  );
}

// ─── Dimmed Bookings inbox behind the sheet ───────────────────────────────

function DimmedBookings() {
  const row = (initials, grad, name, detail, status, statusBg, statusFg) => (
    <div style={{
      display:'flex', alignItems:'center', gap:11, padding:'11px 12px',
      background:E.surface, border:`1px solid ${E.border}`, borderRadius:14,
    }}>
      <div style={{
        width:38, height:38, borderRadius:'50%', background:grad, color:'#fff',
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, flexShrink:0,
      }}>{initials}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12.5, fontWeight:600, color:E.fg1, letterSpacing:-0.1 }}>{name}</div>
        <div style={{ fontSize:11, color:E.fg3, marginTop:2 }}>{detail}</div>
      </div>
      <span style={{
        fontSize:9.5, fontWeight:700, letterSpacing:0.04, textTransform:'uppercase',
        background:statusBg, color:statusFg, padding:'3px 7px', borderRadius:9999,
      }}>{status}</span>
    </div>
  );
  return (
    <div style={{ position:'absolute', inset:0, background:E.bg, display:'flex', flexDirection:'column', zIndex:5 }}>
      <div style={{ height:34 }}/>
      <div style={{
        display:'flex', alignItems:'center', padding:'6px 12px', height:46, boxSizing:'border-box',
        background:E.surface, borderBottom:`1px solid ${E.border}`,
      }}>
        <i data-lucide="chevron-left" style={{ width:20, height:20, color:E.fg1 }}/>
        <div style={{ flex:1, textAlign:'center', fontSize:15, fontWeight:600, color:E.fg1, letterSpacing:-0.2 }}>Bookings</div>
        <i data-lucide="search" style={{ width:18, height:18, color:E.fg2 }}/>
      </div>
      <div style={{ padding:'12px 12px', display:'flex', flexDirection:'column', gap:10 }}>
        <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:E.fg3 }}>Upcoming</div>
        {row('RP','linear-gradient(135deg,#38bdf8,#0284c7)','Intro call · Riley P.','Today · 2:00–2:30 PM','Confirmed','#dcfce7','#15803d')}
        {row('JM','linear-gradient(135deg,#a78bfa,#7c3aed)','Strategy · Jordan M.','Tomorrow · 10:00 AM','Confirmed','#dcfce7','#15803d')}
        {row('SK','linear-gradient(135deg,#fdba74,#ea580c)','Consult · Sam K.','Thu · 4:15 PM','Pending','#fef3c7','#b45309')}
      </div>
    </div>
  );
}

// ─── Phone shell presenting a sheet over the dimmed inbox ─────────────────

function SheetPhone({ label, children, scrim = 0.46 }) {
  return (
    <div style={{
      width:300, height:620, borderRadius:40, padding:8, background:'#0b0f17',
      boxShadow:'0 24px 50px rgba(17,24,39,0.20), 0 0 0 1px rgba(0,0,0,0.12)', flexShrink:0,
    }} data-screen-label={label}>
      <div style={{
        width:'100%', height:'100%', background:E.fg1, borderRadius:32,
        overflow:'hidden', position:'relative', display:'flex', flexDirection:'column',
        fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <DimmedBookings/>
        <div style={{ position:'absolute', inset:0, background:`rgba(11,15,23,${scrim})`, zIndex:10 }}/>
        <div style={{
          position:'absolute', top:7, left:'50%', transform:'translateX(-50%)',
          width:88, height:24, borderRadius:16, background:'#000', zIndex:40,
        }}/>
        <WhiteStatusBar/>
        {children}
        <div style={{
          position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)',
          width:100, height:4, borderRadius:4, background:'rgba(255,255,255,0.55)', zIndex:60,
        }}/>
      </div>
    </div>
  );
}

// ─── Sheet primitives ─────────────────────────────────────────────────────

function Grabber() {
  return (
    <div style={{ display:'flex', justifyContent:'center', padding:'9px 0 4px', flexShrink:0 }}>
      <div style={{ width:38, height:5, borderRadius:3, background:E.borderStrong }}/>
    </div>
  );
}

function PillarChip({ pillar }) {
  const p = PILLARS[pillar];
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4, padding:'3px 9px', borderRadius:9999,
      background:p.bg, color:p.fg, fontSize:9.5, fontWeight:700, letterSpacing:0.05, textTransform:'uppercase',
    }}>
      <i data-lucide={p.icon} style={{ width:11, height:11, strokeWidth:2.4 }}/>
      {p.label}
    </span>
  );
}

function SheetTitle({ pillar, title, caption }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:17, fontWeight:700, color:E.fg1, letterSpacing:-0.3 }}>{title}</div>
        <div style={{ fontSize:12, color:E.fg3, marginTop:3, lineHeight:'16px' }}>{caption}</div>
      </div>
      <div style={{ flexShrink:0, marginTop:2 }}><PillarChip pillar={pillar}/></div>
    </div>
  );
}

function SectionLabel({ children, right }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:7 }}>
      <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:E.fg3 }}>{children}</div>
      {right}
    </div>
  );
}

function Card({ children, pad = '11px 12px' }) {
  return (
    <div style={{
      background:E.surface, border:`1px solid ${E.border}`, borderRadius:16,
      boxShadow:'0 1px 3px rgba(0,0,0,0.04)', padding:pad,
    }}>{children}</div>
  );
}

// Pill chip group (Support Train time-range chip idiom)
function Chips({ options, value }) {
  return (
    <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
      {options.map(o => {
        const on = o === value;
        return (
          <button key={o} style={{
            padding:'7px 12px', borderRadius:9999, cursor:'pointer', whiteSpace:'nowrap',
            background: on ? E.blue600 : E.surface,
            border: `1px solid ${on ? E.blue600 : E.border}`,
            color: on ? '#fff' : E.fg2, fontSize:12, fontWeight:on ? 700 : 600, letterSpacing:-0.1,
            boxShadow: on ? '0 2px 6px rgba(2,132,199,0.22)' : 'none',
          }}>{o}</button>
        );
      })}
    </div>
  );
}

function EventTypeRow() {
  return (
    <Card pad="0">
      <div style={{ display:'flex', alignItems:'center', gap:11, padding:'11px 12px', cursor:'pointer' }}>
        <div style={{
          width:34, height:34, borderRadius:9, flexShrink:0, background:E.blue50, color:E.blue600,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}><i data-lucide="phone" style={{ width:16, height:16, strokeWidth:2 }}/></div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:600, color:E.fg1, letterSpacing:-0.1 }}>Intro call</div>
          <div style={{ fontSize:11, color:E.fg3, marginTop:1 }}>30 min · video</div>
        </div>
        <i data-lucide="chevron-right" style={{ width:16, height:16, color:E.fg4 }}/>
      </div>
      <div style={{ borderTop:`1px solid ${E.border}`, padding:'10px 12px' }}>
        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:8 }}>
          <span style={{ fontSize:11, fontWeight:600, color:E.fg2, letterSpacing:-0.05 }}>Custom duration</span>
          <span style={{ fontSize:10, color:E.fg4, letterSpacing:-0.05 }}>minutes</span>
        </div>
        <Chips options={['15','30','45','60']} value="30"/>
      </div>
    </Card>
  );
}

function SlotRow({ weekday, date, time, last }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:11, padding:'10px 12px',
      borderBottom: last ? 'none' : `1px solid ${E.border}`,
    }}>
      <div style={{
        width:30, height:30, borderRadius:8, flexShrink:0, background:E.blue50, color:E.blue600,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}><i data-lucide="calendar" style={{ width:14, height:14, strokeWidth:2 }}/></div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12.5, fontWeight:600, color:E.fg1, letterSpacing:-0.1 }}>{weekday} · {date}</div>
        <div style={{ fontSize:11, color:E.fg3, marginTop:1 }}>{time}</div>
      </div>
      <i data-lucide="x" style={{ width:15, height:15, color:E.fg4 }}/>
    </div>
  );
}

function OfferTimesCard({ on }) {
  return (
    <Card pad="0">
      <div style={{ display:'flex', alignItems:'center', gap:11, padding:'11px 12px',
        borderBottom: on ? `1px solid ${E.border}` : 'none' }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12.5, fontWeight:600, color:E.fg1, letterSpacing:-0.1 }}>Offer specific times</div>
          <div style={{ fontSize:10.5, color:E.fg3, marginTop:1, lineHeight:'14px' }}>
            {on ? 'They pick from the times you propose.' : "We'll show your full availability."}
          </div>
        </div>
        <Toggle on={on}/>
      </div>
      {on && (
        <div>
          <SlotRow weekday="Tue" date="Jun 17" time="9:00 – 11:00 AM"/>
          <SlotRow weekday="Wed" date="Jun 18" time="2:00 – 4:30 PM"/>
          <div style={{ padding:'9px 12px' }}>
            <button style={{
              display:'inline-flex', alignItems:'center', gap:5, background:'transparent', border:'none',
              padding:0, cursor:'pointer', color:E.blue600, fontSize:12, fontWeight:700, letterSpacing:-0.05,
            }}>
              <i data-lucide="plus" style={{ width:13, height:13, strokeWidth:2.4 }}/>
              Add a time
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

function OptionsCard() {
  const Row = ({ icon, label, sub, on, last }) => (
    <div style={{
      display:'flex', alignItems:'center', gap:11, padding:'10px 12px',
      borderBottom: last ? 'none' : `1px solid ${E.border}`,
    }}>
      <div style={{
        width:30, height:30, borderRadius:8, flexShrink:0,
        background:on ? E.blue50 : E.sunken, color:on ? E.blue600 : E.fg3,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}><i data-lucide={icon} style={{ width:15, height:15, strokeWidth:2 }}/></div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12.5, fontWeight:600, color:E.fg1, letterSpacing:-0.1 }}>{label}</div>
        <div style={{ fontSize:10.5, color:E.fg3, marginTop:1, lineHeight:'14px' }}>{sub}</div>
      </div>
      <Toggle on={on}/>
    </div>
  );
  return (
    <Card pad="0">
      <Row icon="ticket" label="Single use" sub="Link stops working after one booking." on={true}/>
      <Row icon="clipboard-list" label="Ask intake questions" sub="Collect details before they book." on={false} last/>
    </Card>
  );
}

function GenerateBar({ label = 'Generate link', icon = 'link' }) {
  return (
    <div style={{
      position:'absolute', bottom:0, left:0, right:0,
      background:'rgba(255,255,255,0.97)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
      borderTop:`1px solid ${E.border}`, padding:'10px 16px 20px', zIndex:10,
    }}>
      <button style={{
        width:'100%', height:46, borderRadius:12, border:'none', background:E.blue600, color:'#fff',
        fontSize:14, fontWeight:700, cursor:'pointer', letterSpacing:-0.1,
        boxShadow:'0 6px 16px rgba(2,132,199,0.28)',
        display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7,
      }}>
        <i data-lucide={icon} style={{ width:16, height:16 }}/>
        {label}
      </button>
    </div>
  );
}

// ─── FRAME 1 · CONFIGURING (default) ──────────────────────────────────────

function FrameConfig() {
  return (
    <SheetPhone label="One-off · Configuring" scrim={0.5}>
      <div style={{
        position:'absolute', left:0, right:0, bottom:0, top:54, zIndex:20,
        background:E.surface, borderRadius:'24px 24px 0 0',
        boxShadow:'0 -10px 40px rgba(11,15,23,0.22)',
        display:'flex', flexDirection:'column', overflow:'hidden',
      }}>
        <Grabber/>
        <div style={{ flex:1, overflow:'auto', padding:'2px 16px 78px', display:'flex', flexDirection:'column', gap:14 }}>
          <SheetTitle pillar="personal" title="Create a one-off link" caption="Send a private link for one person."/>

          <div>
            <SectionLabel>Event type</SectionLabel>
            <EventTypeRow/>
          </div>

          <div>
            <SectionLabel>Availability</SectionLabel>
            <OfferTimesCard on={true}/>
          </div>

          <div>
            <SectionLabel>Link expires</SectionLabel>
            <Chips options={['24 hours','7 days','30 days','No expiry']} value="7 days"/>
          </div>

          <div>
            <SectionLabel>Options</SectionLabel>
            <OptionsCard/>
          </div>
        </div>
        <GenerateBar/>
      </div>
    </SheetPhone>
  );
}

// ─── Generated result pieces ──────────────────────────────────────────────

function ResultHero() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:11 }}>
      <div style={{
        width:40, height:40, borderRadius:'50%', background:SUCCESS, color:'#fff', flexShrink:0,
        display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:'0 0 0 5px rgba(5,150,105,0.12)',
      }}><i data-lucide="check" style={{ width:20, height:20, strokeWidth:3 }}/></div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:16, fontWeight:700, color:E.fg1, letterSpacing:-0.2 }}>Link ready</div>
        <div style={{ fontSize:11.5, color:E.fg3, marginTop:1 }}>A private link for one person.</div>
      </div>
    </div>
  );
}

function ResultUrl({ copied }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:8, padding:'8px 8px 8px 12px',
      background:E.surface, border:`1px solid ${E.border}`, borderRadius:16,
      boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <span style={{
        flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize:13, fontWeight:600, color:E.fg1, letterSpacing:-0.2,
      }}>{URL_DISPLAY}</span>
      <button style={{
        display:'inline-flex', alignItems:'center', gap:5, flexShrink:0,
        padding:'9px 14px', borderRadius:10, border:'none', cursor:'pointer',
        background: copied ? SUCCESS : E.blue600, color:'#fff',
        fontSize:13, fontWeight:700, letterSpacing:-0.1,
        boxShadow: copied ? '0 4px 12px rgba(5,150,105,0.26)' : '0 4px 12px rgba(2,132,199,0.26)',
      }}>
        <i data-lucide={copied ? 'check' : 'copy'} style={{ width:14, height:14, strokeWidth:2.4 }}/>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function MetaChip() {
  return (
    <div style={{
      display:'inline-flex', alignItems:'center', gap:8, padding:'6px 11px', borderRadius:9999,
      background:E.sunken, color:E.fg2, fontSize:11, fontWeight:600, letterSpacing:-0.05, alignSelf:'flex-start',
    }}>
      <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
        <i data-lucide="calendar-clock" style={{ width:12, height:12 }}/> Expires in 7 days
      </span>
      <span style={{ width:3, height:3, borderRadius:'50%', background:E.fg4 }}/>
      <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
        <i data-lucide="ticket" style={{ width:12, height:12 }}/> Single use
      </span>
    </div>
  );
}

function ShareTarget({ icon, label }) {
  return (
    <button style={{
      flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6,
      background:'transparent', border:'none', cursor:'pointer', padding:0,
    }}>
      <div style={{
        width:'100%', aspectRatio:'1 / 1', maxWidth:54, borderRadius:14,
        background:E.surface, border:`1px solid ${E.border}`,
        display:'flex', alignItems:'center', justifyContent:'center', color:E.blue600,
        boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
      }}><i data-lucide={icon} style={{ width:21, height:21, strokeWidth:2 }}/></div>
      <span style={{ fontSize:10.5, fontWeight:600, color:E.fg2, letterSpacing:-0.05 }}>{label}</span>
    </button>
  );
}

function GeneratedSheet({ copied }) {
  return (
    <div style={{
      position:'absolute', left:0, right:0, bottom:0, zIndex:20,
      background:E.surface, borderRadius:'24px 24px 0 0',
      boxShadow:'0 -10px 40px rgba(11,15,23,0.22)', paddingBottom:20,
    }}>
      <Grabber/>
      <div style={{ padding:'4px 16px 0', display:'flex', flexDirection:'column', gap:13 }}>
        <ResultHero/>
        <ResultUrl copied={copied}/>
        <MetaChip/>
        <div>
          <SectionLabel>Send via</SectionLabel>
          <div style={{ display:'flex', gap:10 }}>
            <ShareTarget icon="share" label="Share"/>
            <ShareTarget icon="message-circle" label="Messages"/>
            <ShareTarget icon="mail" label="Email"/>
          </div>
        </div>
        <div style={{ display:'flex', justifyContent:'center', paddingTop:2 }}>
          <button style={{
            display:'inline-flex', alignItems:'center', gap:6, padding:'8px 12px',
            background:'transparent', border:'none', cursor:'pointer',
            color:E.blue600, fontSize:12.5, fontWeight:700, letterSpacing:-0.05,
          }}>
            <i data-lucide="plus" style={{ width:14, height:14, strokeWidth:2.2 }}/>
            Create another
          </button>
        </div>
      </div>

      {copied && (
        <div style={{
          position:'absolute', left:'50%', bottom:'100%', transform:'translate(-50%, -12px)',
          display:'inline-flex', alignItems:'center', gap:6, padding:'8px 14px',
          background:SUCCESS_BG, border:`1px solid ${SUCCESS_BORDER}`, borderRadius:9999,
          boxShadow:'0 6px 18px rgba(5,150,105,0.18)', whiteSpace:'nowrap', zIndex:25,
        }}>
          <i data-lucide="check-circle-2" style={{ width:15, height:15, strokeWidth:2.4, color:SUCCESS }}/>
          <span style={{ fontSize:12.5, fontWeight:700, color:SUCCESS, letterSpacing:-0.1 }}>Link copied</span>
        </div>
      )}
    </div>
  );
}

// ─── FRAME 2 · GENERATED ──────────────────────────────────────────────────

function FrameGenerated() {
  return (
    <SheetPhone label="One-off · Generated">
      <GeneratedSheet/>
    </SheetPhone>
  );
}

// ─── FRAME 3 · COPIED ─────────────────────────────────────────────────────

function FrameCopied() {
  return (
    <SheetPhone label="One-off · Copied">
      <GeneratedSheet copied/>
    </SheetPhone>
  );
}

// ─── FRAME 4 · ERROR ──────────────────────────────────────────────────────

function FrameError() {
  return (
    <SheetPhone label="One-off · Error" scrim={0.5}>
      <div style={{
        position:'absolute', left:0, right:0, bottom:0, zIndex:20,
        background:E.surface, borderRadius:'24px 24px 0 0',
        boxShadow:'0 -10px 40px rgba(11,15,23,0.22)', paddingBottom:22,
      }}>
        <Grabber/>
        <div style={{ padding:'4px 16px 0', display:'flex', flexDirection:'column', gap:14 }}>
          <SheetTitle pillar="personal" title="Create a one-off link" caption="Send a private link for one person."/>

          <div>
            <SectionLabel>Event type</SectionLabel>
            <EventTypeRow/>
          </div>

          {/* inline error note */}
          <div style={{
            display:'flex', alignItems:'flex-start', gap:10, padding:'12px 13px',
            background:ERROR_BG, border:`1px solid ${ERROR_BORDER}`, borderRadius:14,
          }}>
            <i data-lucide="circle-alert" style={{ width:16, height:16, strokeWidth:2.2, color:ERROR, flexShrink:0, marginTop:1 }}/>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12.5, fontWeight:700, color:'#991b1b', letterSpacing:-0.1 }}>Couldn't create the link. Try again</div>
              <div style={{ fontSize:11, color:'#b91c1c', marginTop:2, lineHeight:'15px' }}>Your settings are saved — nothing was lost.</div>
              <button style={{
                marginTop:7, display:'inline-flex', alignItems:'center', gap:5,
                background:'transparent', border:'none', padding:0, cursor:'pointer',
                color:ERROR, fontSize:12, fontWeight:700, letterSpacing:-0.05,
              }}>
                <i data-lucide="rotate-ccw" style={{ width:13, height:13, strokeWidth:2.4 }}/>
                Try again
              </button>
            </div>
          </div>

          {/* inline generate button (kept in flow so the note never sits under it) */}
          <button style={{
            width:'100%', height:46, borderRadius:12, border:'none', background:E.blue600, color:'#fff',
            fontSize:14, fontWeight:700, cursor:'pointer', letterSpacing:-0.1, marginTop:2,
            boxShadow:'0 6px 16px rgba(2,132,199,0.28)',
            display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7,
          }}>
            <i data-lucide="link" style={{ width:16, height:16 }}/>
            Generate link
          </button>
        </div>
      </div>
    </SheetPhone>
  );
}

Object.assign(window, {
  FrameConfig, FrameGenerated, FrameCopied, FrameError,
});
