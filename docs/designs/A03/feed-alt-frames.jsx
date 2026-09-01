// A03.3 — src/app/feed.tsx  (Pulse alt — non-tab route)
// DUPLICATE of (tabs)/feed.tsx, reached as a pushed stack route (deep link / legacy path).
// 2 frames: Populated · Loading skeleton (no empty state — route is always populated).
// Inherits A03 archetype exactly. Only chrome difference: back chevron (pushed route).

const PA = {
  primary600:'#0284c7', primary50:'#f0f9ff', primary100:'#e0f2fe', primary700:'#0369a1',
  fg1:'#111827', fg2:'#374151', fg3:'#6b7280', fg4:'#9ca3af',
  surface:'#ffffff', sunken:'#f3f4f6', muted:'#f8fafc',
  border:'#e5e7eb', borderStrong:'#d1d5db', borderSub:'#f3f4f6',
  success:'#059669', successBg:'#D1FAE5',
  amber:'#B45309', amberBg:'#FEF3C7',
  violet:'#6D28D9', violetBg:'#EDE9FE',
  rose:'#BE123C', roseBg:'#FFE4E6',
  slate:'#475569', slateBg:'#E2E8F0',
};

function PASB({ color = PA.fg1 }) {
  return (
    <div style={{
      display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'16px 28px 0', height:44, boxSizing:'border-box',
      fontFamily:'-apple-system, system-ui', fontWeight:600, fontSize:15, color,
      flexShrink:0, position:'relative', zIndex:5,
    }}>
      <span>9:41</span>
      <div style={{display:'flex', gap:5, alignItems:'center'}}>
        <svg width="17" height="11" viewBox="0 0 17 11">
          <rect x="0" y="7" width="3" height="4" rx="0.6" fill={color}/>
          <rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={color}/>
          <rect x="9" y="2" width="3" height="9" rx="0.6" fill={color}/>
          <rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={color}/>
        </svg>
        <svg width="15" height="11" viewBox="0 0 15 11">
          <path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={color}/>
          <path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={color}/>
          <circle cx="7.5" cy="9" r="1.3" fill={color}/>
        </svg>
        <svg width="24" height="11" viewBox="0 0 24 11">
          <rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={color} strokeOpacity="0.45" fill="none"/>
          <rect x="2" y="2" width="17" height="7" rx="1.5" fill={color}/>
        </svg>
      </div>
    </div>
  );
}

function PAPhone({ children }) {
  return (
    <div style={{
      width:360, height:740, borderRadius:46, padding:10, background:'#0b0f17',
      boxShadow:'0 40px 80px rgba(17,24,39,0.22), 0 0 0 1px rgba(0,0,0,0.14)',
    }}>
      <div style={{
        width:'100%', height:'100%', background:PA.muted,
        borderRadius:36, overflow:'hidden', position:'relative',
        display:'flex', flexDirection:'column',
        fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          position:'absolute', top:9, left:'50%', transform:'translateX(-50%)',
          width:108, height:30, borderRadius:20, background:'#000', zIndex:50,
        }}/>
        <PASB color={PA.fg1}/>
        {children}
        <div style={{
          position:'absolute', bottom:6, left:'50%', transform:'translateX(-50%)',
          width:120, height:4, borderRadius:4,
          background:'rgba(0,0,0,0.35)', zIndex:60,
        }}/>
      </div>
    </div>
  );
}

// Pushed-route top bar: back chevron + title (the one legit difference from the tab route)
function PATopBar({ title }) {
  return (
    <div style={{
      height:52, padding:'0 8px 0 6px', boxSizing:'border-box',
      display:'flex', alignItems:'center', justifyContent:'space-between',
      background:PA.muted, flexShrink:0, borderBottom:`1px solid ${PA.border}`,
    }}>
      <div style={{display:'flex', alignItems:'center', gap:2, minWidth:0}}>
        <button style={{
          width:36, height:36, borderRadius:'50%', background:'transparent',
          border:'none', cursor:'pointer', color:PA.fg1,
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
        }}>
          <i data-lucide="chevron-left" style={{width:24, height:24, strokeWidth:2.2}}/>
        </button>
        <div style={{
          fontSize:22, fontWeight:700, color:PA.fg1, letterSpacing:-0.4,
          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
        }}>{title}</div>
      </div>
      <div style={{display:'flex', gap:2, flexShrink:0}}>
        <button style={{
          width:36, height:36, borderRadius:'50%', background:'transparent',
          border:'none', cursor:'pointer', color:PA.fg1,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <i data-lucide="search" style={{width:19, height:19, strokeWidth:2}}/>
        </button>
        <button style={{
          width:36, height:36, borderRadius:'50%', background:'transparent',
          border:'none', cursor:'pointer', color:PA.fg1,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <i data-lucide="sliders-horizontal" style={{width:18, height:18, strokeWidth:2}}/>
        </button>
      </div>
    </div>
  );
}

const PAINTENTS = [
  {key:'all', label:'All'}, {key:'ask', label:'Ask'}, {key:'recommend', label:'Recommend'},
  {key:'event', label:'Event'}, {key:'lost', label:'Lost & Found'}, {key:'announce', label:'Announce'},
];

function PAChipRow({ activeKey = 'all', skeleton = false }) {
  return (
    <div style={{
      display:'flex', gap:8, overflowX:'auto', padding:'12px 16px',
      background:PA.muted, flexShrink:0, borderBottom:`1px solid ${PA.border}`,
    }}>
      {PAINTENTS.map((it, i) => {
        if (skeleton) {
          return (
            <div key={i} style={{
              height:28, width: i === 0 ? 44 : 70 + (i % 3) * 14, borderRadius:9999,
              background:'linear-gradient(90deg,#eef2f7,#f8fafc,#eef2f7)',
              backgroundSize:'200% 100%', animation:'shimmer 1.4s ease-in-out infinite',
              flexShrink:0,
            }}/>
          );
        }
        const active = it.key === activeKey;
        return (
          <button key={i} style={{
            height:28, padding:'0 14px', borderRadius:9999,
            background: active ? PA.primary600 : PA.surface,
            color: active ? '#fff' : PA.fg2,
            border: active ? 'none' : `1px solid ${PA.border}`,
            fontSize:12.5, fontWeight:600, letterSpacing:-0.05,
            cursor:'pointer', flexShrink:0, whiteSpace:'nowrap',
          }}>{it.label}</button>
        );
      })}
    </div>
  );
}

function PAIntentChip({ kind }) {
  const map = {
    ask:       {label:'Ask',     fg:PA.amber,   bg:PA.amberBg,  icon:'help-circle'},
    recommend: {label:'Rec',     fg:PA.success, bg:PA.successBg, icon:'thumbs-up'},
    event:     {label:'Event',   fg:PA.violet,  bg:PA.violetBg, icon:'calendar'},
    lost:      {label:'Lost',    fg:PA.rose,    bg:PA.roseBg,   icon:'search'},
    announce:  {label:'Announce',fg:PA.slate,   bg:PA.slateBg,  icon:'megaphone'},
  };
  const c = map[kind];
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      padding:'2px 8px 2px 6px', borderRadius:9999, background:c.bg, color:c.fg,
      fontSize:10, fontWeight:700, letterSpacing:0.04, textTransform:'uppercase', flexShrink:0,
    }}>
      <i data-lucide={c.icon} style={{width:10, height:10, strokeWidth:2.5}}/>
      {c.label}
    </span>
  );
}

function PAAvatar({ letter, color = '#a78bfa', verified = false, size = 32 }) {
  return (
    <div style={{position:'relative', width:size, height:size, flexShrink:0}}>
      <div style={{
        width:size, height:size, borderRadius:'50%', background:color,
        color:'#fff', fontFamily:'ui-sans-serif, system-ui',
        fontWeight:600, fontSize:size === 32 ? 13 : 11,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>{letter}</div>
      {verified && (
        <span style={{
          position:'absolute', right:-2, bottom:-2, width:13, height:13, borderRadius:'50%',
          background:PA.primary600, color:'#fff',
          display:'flex', alignItems:'center', justifyContent:'center', border:'1.5px solid #fff',
        }}>
          <i data-lucide="check" style={{width:7, height:7, strokeWidth:4}}/>
        </span>
      )}
    </div>
  );
}

function PAReactionBar({ items }) {
  return (
    <div style={{display:'flex', alignItems:'center', gap:14, marginTop:10}}>
      {items.map((r, i) => (
        <div key={i} style={{
          display:'inline-flex', alignItems:'center', gap:4,
          color:PA.fg3, fontSize:11.5, fontWeight:500, letterSpacing:-0.02,
        }}>
          <i data-lucide={r.icon} style={{width:12, height:12, strokeWidth:2}}/>
          <span>{r.label} {r.count}</span>
        </div>
      ))}
      <div style={{flex:1}}/>
      <button style={{
        background:'transparent', border:'none', color:PA.fg3, cursor:'pointer',
        display:'flex', alignItems:'center', gap:4, fontSize:11.5, fontWeight:500, padding:0,
      }}>
        <i data-lucide="message-circle" style={{width:12, height:12, strokeWidth:2}}/>
        <span>Reply</span>
      </button>
    </div>
  );
}

function PAPostCard({ children }) {
  return (
    <div style={{
      background:PA.surface, border:`1px solid ${PA.border}`, borderRadius:16, padding:12,
    }}>{children}</div>
  );
}

function PAPostHeader({ name, color, letter, meta, intent, verified = false }) {
  return (
    <div style={{display:'flex', alignItems:'center', gap:9, marginBottom:8}}>
      <PAAvatar letter={letter} color={color} verified={verified}/>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize:13, fontWeight:600, color:PA.fg1, letterSpacing:-0.1, lineHeight:1.2}}>{name}</div>
        <div style={{fontSize:10.5, color:PA.fg3, marginTop:2, letterSpacing:0.01}}>{meta}</div>
      </div>
      <PAIntentChip kind={intent}/>
    </div>
  );
}

function PAFAB() {
  return (
    <button style={{
      position:'absolute', right:18, bottom:84, zIndex:30,
      width:52, height:52, borderRadius:'50%', background:PA.primary600, color:'#fff',
      border:'none', cursor:'pointer',
      display:'flex', alignItems:'center', justifyContent:'center',
      boxShadow:'0 12px 24px rgba(2,132,199,0.36), 0 4px 8px rgba(2,132,199,0.2)',
    }}>
      <i data-lucide="pencil" style={{width:20, height:20, strokeWidth:2.2}}/>
    </button>
  );
}

function PATabBar({ activeKey = 'pulse' }) {
  const tabs = [
    {key:'home', label:'Home', icon:'home'},
    {key:'pulse', label:'Pulse', icon:'radio'},
    {key:'mail', label:'Mail', icon:'mail'},
    {key:'gigs', label:'Gigs', icon:'briefcase'},
    {key:'me', label:'Me', icon:'user'},
  ];
  return (
    <div style={{
      position:'absolute', bottom:0, left:0, right:0, zIndex:10,
      height:82, padding:'8px 8px 24px', boxSizing:'border-box',
      display:'flex', alignItems:'center', justifyContent:'space-around',
      background:'rgba(255,255,255,0.96)', backdropFilter:'blur(12px)',
      borderTop:`1px solid ${PA.border}`,
    }}>
      {tabs.map((t) => {
        const active = t.key === activeKey;
        return (
          <button key={t.key} style={{
            background:'transparent', border:'none', cursor:'pointer',
            display:'flex', flexDirection:'column', alignItems:'center', gap:3,
            padding:'4px 8px', minWidth:48, color: active ? PA.primary600 : PA.fg4,
          }}>
            <i data-lucide={t.icon} style={{width:22, height:22, strokeWidth: active ? 2.4 : 2}}/>
            <span style={{fontSize:10, fontWeight:600, letterSpacing:-0.05}}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Skeleton primitives (lifted verbatim from archetype loading variant) ──
function PAShimmerBlock({ w, h, r = 6, style = {} }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background:'linear-gradient(90deg,#eef2f7,#f8fafc,#eef2f7)',
      backgroundSize:'200% 100%', animation:'shimmer 1.4s ease-in-out infinite',
      ...style,
    }}/>
  );
}

function PASkeletonCard({ withTitle = false }) {
  return (
    <div style={{
      background:PA.surface, border:`1px solid ${PA.border}`, borderRadius:16, padding:12,
    }}>
      <div style={{display:'flex', alignItems:'center', gap:9, marginBottom:10}}>
        <PAShimmerBlock w={32} h={32} r={16}/>
        <div style={{flex:1, display:'flex', flexDirection:'column', gap:5}}>
          <PAShimmerBlock w={110} h={10}/>
          <PAShimmerBlock w={70} h={8}/>
        </div>
        <PAShimmerBlock w={42} h={16} r={9999}/>
      </div>
      {withTitle && (
        <div style={{marginBottom:6}}>
          <PAShimmerBlock w="60%" h={11}/>
        </div>
      )}
      <div style={{display:'flex', flexDirection:'column', gap:5}}>
        <PAShimmerBlock w="100%" h={9}/>
        <PAShimmerBlock w="86%" h={9}/>
      </div>
      <div style={{display:'flex', gap:14, marginTop:12}}>
        <PAShimmerBlock w={56} h={10}/>
        <PAShimmerBlock w={56} h={10}/>
        <div style={{flex:1}}/>
        <PAShimmerBlock w={42} h={10}/>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 1 — POPULATED  (identical content to the tab route — it's a duplicate)
// ═══════════════════════════════════════════════════════════════
function FramePulseAltPopulated() {
  return (
    <PAPhone>
      <PATopBar title="Pulse (alt)"/>
      <PAChipRow activeKey="all"/>

      <div style={{
        flex:1, overflow:'auto', padding:'12px 12px 100px',
        display:'flex', flexDirection:'column', gap:10, background:PA.muted,
      }}>
        <PAPostCard>
          <PAPostHeader name="Maria L." letter="M" color="#0ea5e9" verified
            meta="2h · Elm Park" intent="ask"/>
          <div style={{
            fontSize:12.5, color:PA.fg2, lineHeight:'17px', letterSpacing:-0.02,
            display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden',
          }}>
            Anyone know a good dog-walker in Burnside? Our 1-year-old shepherd mix needs midday walks Tue/Thu and our regular just moved. References appreciated.
          </div>
          <PAReactionBar items={[
            {icon:'lightbulb', label:'helpful', count:12},
            {icon:'heart', label:'', count:4},
          ]}/>
        </PAPostCard>

        <PAPostCard>
          <PAPostHeader name="Jordan A." letter="J" color="#059669"
            meta="5h · Elm Park" intent="recommend"/>
          <div style={{
            fontSize:12.5, color:PA.fg2, lineHeight:'17px', letterSpacing:-0.02,
            display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden',
          }}>
            Sourdough at 4th &amp; Market is legit — family-run, opens at 7. The country loaf is gone by 10. Cash only.
          </div>
          <PAReactionBar items={[
            {icon:'heart', label:'', count:30},
            {icon:'lightbulb', label:'helpful', count:8},
          ]}/>
        </PAPostCard>

        <PAPostCard>
          <PAPostHeader name="Anika R." letter="A" color="#6D28D9" verified
            meta="Yesterday · Elm Park" intent="event"/>
          <div style={{
            fontSize:13.5, fontWeight:600, color:PA.fg1, letterSpacing:-0.1, marginBottom:4,
          }}>Playground cleanup Saturday</div>
          <div style={{
            fontSize:12.5, color:PA.fg2, lineHeight:'17px', letterSpacing:-0.02,
            display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden',
          }}>
            9–11am at Burnside Park. Bring gloves; we'll have bags + coffee. Kids welcome — there's a craft table by the slide.
          </div>
          <div style={{
            display:'flex', alignItems:'center', gap:8, marginTop:9,
            paddingTop:9, borderTop:`1px solid ${PA.borderSub}`,
          }}>
            <div style={{display:'flex'}}>
              {[{l:'K',c:'#f97316'},{l:'P',c:'#0ea5e9'},{l:'S',c:'#6D28D9'},{l:'T',c:'#059669'}].map((a, i) => (
                <div key={i} style={{
                  marginLeft: i === 0 ? 0 : -8, zIndex: 10 - i,
                  border:`2px solid ${PA.surface}`, borderRadius:'50%',
                }}>
                  <PAAvatar letter={a.l} color={a.c} size={22}/>
                </div>
              ))}
            </div>
            <span style={{fontSize:11, color:PA.fg3, fontWeight:500}}>+ 14 going</span>
            <div style={{flex:1}}/>
            <button style={{
              height:26, padding:'0 12px', borderRadius:9999, border:'none', cursor:'pointer',
              background:PA.violetBg, color:PA.violet, fontSize:11, fontWeight:700, letterSpacing:0.02,
              display:'inline-flex', alignItems:'center', gap:4,
            }}>
              <i data-lucide="plus" style={{width:10, height:10, strokeWidth:3}}/>
              RSVP
            </button>
          </div>
          <PAReactionBar items={[
            {icon:'calendar-check', label:'going', count:18},
            {icon:'heart', label:'', count:9},
          ]}/>
        </PAPostCard>

        <PAPostCard>
          <PAPostHeader name="Devon S." letter="D" color="#BE123C"
            meta="Yesterday · Burnside" intent="lost"/>
          <div style={{
            fontSize:12.5, color:PA.fg2, lineHeight:'17px', letterSpacing:-0.02,
            display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden',
          }}>
            Tortoiseshell cat missing near Maple &amp; 8th. Tag says "Pippin". Reward — please DM.
          </div>
          <PAReactionBar items={[
            {icon:'eye', label:'seen', count:42},
            {icon:'share', label:'shared', count:6},
          ]}/>
        </PAPostCard>
      </div>

      <PAFAB/>
      <PATabBar activeKey="pulse"/>
    </PAPhone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 2 — LOADING SKELETON  (route mounts fresh from deep link / redirect)
// ═══════════════════════════════════════════════════════════════
function FramePulseAltLoading() {
  return (
    <PAPhone>
      <PATopBar title="Pulse (alt)"/>
      <PAChipRow skeleton/>

      <div style={{
        flex:1, overflow:'hidden', padding:'12px 12px 100px',
        display:'flex', flexDirection:'column', gap:10, background:PA.muted,
      }}>
        <PASkeletonCard/>
        <PASkeletonCard withTitle/>
        <PASkeletonCard/>
        <PASkeletonCard/>
      </div>

      <PAFAB/>
      <PATabBar activeKey="pulse"/>
    </PAPhone>
  );
}

Object.assign(window, { FramePulseAltPopulated, FramePulseAltLoading });
