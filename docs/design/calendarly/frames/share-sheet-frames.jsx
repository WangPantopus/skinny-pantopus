// Pantopus — Calendarly · Share your link (bottom sheet) — 5 frames
// Archetype: SystemShareSheet — a rounded-top sheet (24px) floating over a
// dimmed app, with a grabber handle. Mirrors A13 Share Home's share + QR
// composition and A14.6 Payments' toggle-row idiom. Lives in: Scheduling Hub
// "Share booking link", first-run wizard success, event-type overflow, public
// profile "Book" (owner). Context label + accent follow the link's pillar
// (Personal sky / Home green / Business violet); functional chrome stays sky.
//
// Non-negotiables: sky #0284C7 on all functional chrome (Copy, toggles, share
// targets); pillar accent ONLY on the context overline + dot + QR caption.
// White cards, 1px border, 16px radius, shadow-sm, no left accents. Lucide
// stroke-2 16–24px, no emoji. Voice plainspoken, verbs-first, sentence case.
//
// Frames: default · draft-warning · copied-toast · QR-fullscreen · regenerate-confirm.

const { E, SH, Toggle } = window;

const PILLARS = {
  personal: { dot:'#0284C7', label:'Personal booking link' },
  home:     { dot:'#16A34A', label:'Home booking link' },
  business: { dot:'#7C3AED', label:'Business booking link' },
};

const SUCCESS = '#059669', SUCCESS_BG = '#ECFDF5', SUCCESS_BORDER = '#A7F3D0';
const WARNING = '#D97706', WARNING_BG = '#FFFBEB', WARNING_BORDER = '#FDE68A';
const ERROR = '#DC2626';

const URL_DISPLAY = 'pantopus.com/book/alexkim';

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

// Dark status bar (white fullscreen QR view)
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

// ─── Synthetic QR (decorative, not scannable) ─────────────────────────────

function QrCode({ size = 132, quiet = 0 }) {
  const N = 25;
  const cells = [];
  let seed = 13;
  for (let i = 0; i < N * N; i++) {
    seed = (seed * 9301 + 49297) % 233280;
    cells.push(seed / 233280 > 0.5);
  }
  const isFinder = (r, c) => {
    const inC = (r0, c0) => r >= r0 && r < r0 + 7 && c >= c0 && c < c0 + 7;
    return inC(0, 0) || inC(0, N - 7) || inC(N - 7, 0);
  };
  const finderOn = (r, c) => {
    const local = (r0, c0) => {
      const dr = r - r0, dc = c - c0;
      if (dr === 0 || dr === 6 || dc === 0 || dc === 6) return true;
      if (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4) return true;
      return false;
    };
    if (r < 7 && c < 7) return local(0, 0);
    if (r < 7 && c >= N - 7) return local(0, N - 7);
    if (r >= N - 7 && c < 7) return local(N - 7, 0);
    return false;
  };
  return (
    <svg width={size} height={size} viewBox={`${-quiet} ${-quiet} ${N + quiet * 2} ${N + quiet * 2}`} style={{ display:'block' }}>
      <rect x={-quiet} y={-quiet} width={N + quiet * 2} height={N + quiet * 2} fill="#fff" />
      {Array.from({ length: N * N }).map((_, i) => {
        const r = Math.floor(i / N), c = i % N;
        const on = isFinder(r, c) ? finderOn(r, c) : cells[i];
        if (!on) return null;
        return <rect key={i} x={c} y={r} width={1} height={1} fill="#111827" />;
      })}
    </svg>
  );
}

// ─── Phone shell that presents a sheet/overlay over a dimmed app ───────────

function DimmedApp() {
  const row = (label, value, on) => (
    <div style={{
      display:'flex', alignItems:'center', gap:10, padding:'11px 12px',
      background:E.surface, border:`1px solid ${E.border}`, borderRadius:14,
    }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12.5, fontWeight:600, color:E.fg1, letterSpacing:-0.1 }}>{label}</div>
        {value && <div style={{ fontSize:11, color:E.fg3, marginTop:2 }}>{value}</div>}
      </div>
      {on != null && <Toggle on={on}/>}
    </div>
  );
  return (
    <div style={{ position:'absolute', inset:0, background:E.bg, display:'flex', flexDirection:'column', zIndex:5 }}>
      <div style={{ height:34 }}/>
      {/* top bar */}
      <div style={{
        display:'flex', alignItems:'center', padding:'6px 10px', height:46, boxSizing:'border-box',
        background:E.surface, borderBottom:`1px solid ${E.border}`,
      }}>
        <i data-lucide="chevron-left" style={{ width:20, height:20, color:E.fg1 }}/>
        <div style={{ flex:1, textAlign:'center', fontSize:15, fontWeight:600, color:E.fg1, letterSpacing:-0.2 }}>Booking link</div>
        <span style={{ fontSize:14, fontWeight:700, color:E.blue600, paddingRight:6 }}>Save</span>
      </div>
      <div style={{ padding:'12px 12px', display:'flex', flexDirection:'column', gap:11 }}>
        {row('Page status', 'Live · accepting bookings', true)}
        {row('Public link', URL_DISPLAY)}
        {row('Listed in your profile', 'Visible to your connections', true)}
        {row('Intro message', 'Pick a time that works — booking takes a minute.')}
      </div>
    </div>
  );
}

function SheetPhone({ label, children, scrim = 0.46, showApp = true }) {
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
        {showApp && <DimmedApp/>}
        {/* scrim */}
        <div style={{ position:'absolute', inset:0, background:`rgba(11,15,23,${scrim})`, zIndex:10 }}/>
        {/* notch */}
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

// ─── Sheet building blocks ────────────────────────────────────────────────

function Grabber() {
  return (
    <div style={{ display:'flex', justifyContent:'center', padding:'9px 0 5px', flexShrink:0 }}>
      <div style={{ width:38, height:5, borderRadius:3, background:E.borderStrong }}/>
    </div>
  );
}

function ContextLabel({ pillar }) {
  const p = PILLARS[pillar];
  return (
    <div style={{ display:'flex', alignItems:'center', gap:7 }}>
      <span style={{ width:8, height:8, borderRadius:'50%', background:p.dot, flexShrink:0 }}/>
      <span style={{
        fontSize:10, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase', color:p.dot,
      }}>{p.label}</span>
    </div>
  );
}

function UrlCard({ copied }) {
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
        transition:'background 150ms',
      }}>
        <i data-lucide={copied ? 'check' : 'copy'} style={{ width:14, height:14, strokeWidth:2.4 }}/>
        {copied ? 'Copied' : 'Copy'}
      </button>
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
        width:'100%', aspectRatio:'1 / 1', maxWidth:52, borderRadius:14,
        background:E.surface, border:`1px solid ${E.border}`,
        display:'flex', alignItems:'center', justifyContent:'center', color:E.blue600,
        boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <i data-lucide={icon} style={{ width:21, height:21, strokeWidth:2 }}/>
      </div>
      <span style={{ fontSize:10.5, fontWeight:600, color:E.fg2, letterSpacing:-0.05 }}>{label}</span>
    </button>
  );
}

function ShareTargets() {
  return (
    <div style={{ display:'flex', gap:8 }}>
      <ShareTarget icon="share" label="Share"/>
      <ShareTarget icon="qr-code" label="QR code"/>
      <ShareTarget icon="message-circle" label="Messages"/>
      <ShareTarget icon="mail" label="Email"/>
    </div>
  );
}

function QrThumbCard() {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:11, padding:'9px 11px',
      background:E.surface, border:`1px solid ${E.border}`, borderRadius:16,
      boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        width:40, height:40, borderRadius:10, background:'#fff', border:`1px solid ${E.border}`,
        padding:4, boxSizing:'border-box', flexShrink:0,
      }}>
        <QrCode size={32}/>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12.5, fontWeight:600, color:E.fg1, letterSpacing:-0.1 }}>Scan to book</div>
        <div style={{ fontSize:10.5, color:E.fg3, marginTop:1 }}>Print it or show it at a desk.</div>
      </div>
      <button style={{
        flexShrink:0, padding:'7px 12px', borderRadius:9, cursor:'pointer',
        background:E.blue50, border:`1px solid ${E.blue100}`, color:E.blue700,
        fontSize:12, fontWeight:700, letterSpacing:-0.1,
      }}>Show QR</button>
    </div>
  );
}

function SettingsCard() {
  const Row = ({ icon, label, sub, on, last }) => (
    <div style={{
      display:'flex', alignItems:'center', gap:11, padding:'9px 0',
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
    <div style={{
      padding:'2px 12px', background:E.surface, border:`1px solid ${E.border}`, borderRadius:16,
      boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <Row icon="user-round" label="Show on my profile" sub="Neighbors see a Book button on your page." on={true}/>
      <Row icon="mail" label="Add to email signature" sub="Appends the link to outgoing mail." on={false} last/>
    </div>
  );
}

function RegenerateButton() {
  return (
    <div style={{ display:'flex', justifyContent:'center', paddingTop:2 }}>
      <button style={{
        display:'inline-flex', alignItems:'center', gap:6, padding:'8px 12px',
        background:'transparent', border:'none', cursor:'pointer',
        color:ERROR, fontSize:12.5, fontWeight:600, letterSpacing:-0.1,
      }}>
        <i data-lucide="rotate-ccw" style={{ width:14, height:14, strokeWidth:2.2 }}/>
        Regenerate link
      </button>
    </div>
  );
}

function DraftBanner() {
  return (
    <div style={{
      display:'flex', alignItems:'flex-start', gap:9, padding:'10px 11px',
      background:WARNING_BG, border:`1px solid ${WARNING_BORDER}`, borderRadius:12,
    }}>
      <i data-lucide="triangle-alert" style={{ width:15, height:15, strokeWidth:2.2, color:WARNING, flexShrink:0, marginTop:1 }}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:11.5, fontWeight:600, color:'#92400e', lineHeight:'15px' }}>
          This page isn't live yet. People can't book until you turn it on.
        </div>
        <button style={{
          marginTop:5, background:'transparent', border:'none', padding:0, cursor:'pointer',
          color:WARNING, fontSize:11.5, fontWeight:700, letterSpacing:-0.05,
          display:'inline-flex', alignItems:'center', gap:4,
        }}>
          Turn on
          <i data-lucide="arrow-right" style={{ width:12, height:12, strokeWidth:2.4 }}/>
        </button>
      </div>
    </div>
  );
}

// ─── The sheet body (shared by default / draft / copied) ──────────────────

function Sheet({ pillar = 'personal', draft = false, copied = false }) {
  return (
    <div style={{
      position:'absolute', left:0, right:0, bottom:0, zIndex:20,
      background:E.surface, borderRadius:'24px 24px 0 0',
      boxShadow:'0 -10px 40px rgba(11,15,23,0.22)',
      paddingBottom:18,
    }}>
      <Grabber/>
      <div style={{ padding:'2px 16px 0', display:'flex', flexDirection:'column', gap:11 }}>
        {draft && <DraftBanner/>}

        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <ContextLabel pillar={pillar}/>
          <UrlCard copied={copied}/>
          <div style={{ fontSize:11, color:E.fg3, letterSpacing:-0.05 }}>Anyone with this link can book you.</div>
        </div>

        <ShareTargets/>
        <QrThumbCard/>
        <SettingsCard/>
        <RegenerateButton/>
      </div>

      {/* copied toast — floats above the sheet content */}
      {copied && (
        <div style={{
          position:'absolute', left:'50%', bottom:64, transform:'translateX(-50%)',
          display:'inline-flex', alignItems:'center', gap:6, padding:'8px 14px',
          background:SUCCESS_BG, border:`1px solid ${SUCCESS_BORDER}`, borderRadius:9999,
          boxShadow:'0 6px 18px rgba(5,150,105,0.18)', whiteSpace:'nowrap',
        }}>
          <i data-lucide="check-circle-2" style={{ width:15, height:15, strokeWidth:2.4, color:SUCCESS }}/>
          <span style={{ fontSize:12.5, fontWeight:700, color:SUCCESS, letterSpacing:-0.1 }}>Link copied</span>
        </div>
      )}
    </div>
  );
}

// ─── FRAMES ───────────────────────────────────────────────────────────────

function FrameDefault() {
  return (
    <SheetPhone label="Share · Default">
      <Sheet pillar="personal"/>
    </SheetPhone>
  );
}

function FrameDraft() {
  return (
    <SheetPhone label="Share · Draft warning">
      <Sheet pillar="personal" draft/>
    </SheetPhone>
  );
}

function FrameCopied() {
  return (
    <SheetPhone label="Share · Copied">
      <Sheet pillar="personal" copied/>
    </SheetPhone>
  );
}

function FrameQr() {
  return (
    <div style={{
      width:300, height:620, borderRadius:40, padding:8, background:'#0b0f17',
      boxShadow:'0 24px 50px rgba(17,24,39,0.20), 0 0 0 1px rgba(0,0,0,0.12)', flexShrink:0,
    }} data-screen-label="Share · QR fullscreen">
      <div style={{
        width:'100%', height:'100%', background:E.surface, borderRadius:32,
        overflow:'hidden', position:'relative', display:'flex', flexDirection:'column',
        fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          position:'absolute', top:7, left:'50%', transform:'translateX(-50%)',
          width:88, height:24, borderRadius:16, background:'#000', zIndex:50,
        }}/>
        <DarkStatusBar/>
        {/* top bar — Done */}
        <div style={{
          display:'flex', alignItems:'center', padding:'6px 12px', height:46, boxSizing:'border-box',
        }}>
          <div style={{ flex:1 }}/>
          <button style={{
            background:'transparent', border:'none', cursor:'pointer',
            color:E.blue600, fontSize:15, fontWeight:700, letterSpacing:-0.1, padding:'4px 2px',
          }}>Done</button>
        </div>

        <div style={{
          flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          padding:'0 28px 40px', gap:0,
        }}>
          <ContextLabel pillar="personal"/>
          <div style={{ height:18 }}/>
          {/* QR plate */}
          <div style={{
            padding:18, background:'#fff', borderRadius:24,
            border:`1px solid ${E.border}`, boxShadow:'0 12px 32px rgba(17,24,39,0.12)',
          }}>
            <QrCode size={184}/>
          </div>
          <div style={{
            marginTop:22, fontSize:15, fontWeight:700, color:E.fg1, letterSpacing:-0.2,
          }}>Alex Kim</div>
          <div style={{
            marginTop:6, fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize:12.5, fontWeight:600, color:E.fg3, letterSpacing:-0.2,
          }}>{URL_DISPLAY}</div>
          <div style={{
            marginTop:14, fontSize:11.5, color:E.fg3, textAlign:'center', lineHeight:'16px', maxWidth:200,
          }}>Point a camera here to open the booking page.</div>
        </div>

        {/* footer action */}
        <div style={{ padding:'0 20px 26px', display:'flex', justifyContent:'center' }}>
          <button style={{
            display:'inline-flex', alignItems:'center', gap:7, padding:'10px 16px', borderRadius:11,
            background:E.surface, border:`1px solid ${E.border}`, color:E.fg2, cursor:'pointer',
            fontSize:13, fontWeight:700, letterSpacing:-0.1, boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <i data-lucide="download" style={{ width:15, height:15 }}/>
            Save to Photos
          </button>
        </div>

        <div style={{
          position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)',
          width:100, height:4, borderRadius:4, background:'rgba(0,0,0,0.25)', zIndex:60,
        }}/>
      </div>
    </div>
  );
}

function FrameRegenerate() {
  return (
    <SheetPhone label="Share · Regenerate confirm" scrim={0.62}>
      {/* the sheet sits behind, dimmed by the heavier scrim */}
      <Sheet pillar="personal"/>
      {/* confirm modal */}
      <div style={{
        position:'absolute', inset:0, zIndex:30,
        display:'flex', alignItems:'center', justifyContent:'center', padding:'0 26px',
      }}>
        <div style={{
          width:'100%', background:E.surface, borderRadius:18, padding:'20px 18px 16px',
          boxShadow:'0 24px 60px rgba(11,15,23,0.45)', textAlign:'center',
        }}>
          <div style={{
            width:44, height:44, borderRadius:'50%', background:'#FEF2F2', margin:'0 auto 12px',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <i data-lucide="rotate-ccw" style={{ width:20, height:20, strokeWidth:2.2, color:ERROR }}/>
          </div>
          <div style={{ fontSize:16, fontWeight:700, color:E.fg1, letterSpacing:-0.2 }}>Regenerate this link?</div>
          <div style={{ fontSize:12.5, color:E.fg3, marginTop:7, lineHeight:'18px' }}>
            The old link stops working. Anyone using it will need the new one.
          </div>
          <div style={{ display:'flex', gap:9, marginTop:18 }}>
            <button style={{
              flex:1, height:42, borderRadius:11, cursor:'pointer',
              background:E.surface, border:`1px solid ${E.border}`, color:E.fg1,
              fontSize:13.5, fontWeight:700, letterSpacing:-0.1,
            }}>Cancel</button>
            <button style={{
              flex:1, height:42, borderRadius:11, border:'none', cursor:'pointer',
              background:ERROR, color:'#fff', fontSize:13.5, fontWeight:700, letterSpacing:-0.1,
              boxShadow:'0 4px 12px rgba(220,38,38,0.26)',
            }}>Regenerate</button>
          </div>
        </div>
      </div>
    </SheetPhone>
  );
}

Object.assign(window, {
  FrameDefault, FrameDraft, FrameCopied, FrameQr, FrameRegenerate,
});
