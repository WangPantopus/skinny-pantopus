// A03.1 — src/app/(tabs)/feed.tsx
// Pulse tab — intent-driven local feed
// 2 frames: Populated · Empty
// Inherits A03 archetype scaffolding exactly; only content + empty copy differ.

const PU = {
  primary600:'#0284c7', primary50:'#f0f9ff', primary100:'#e0f2fe', primary700:'#0369a1',
  fg1:'#111827', fg2:'#374151', fg3:'#6b7280', fg4:'#9ca3af',
  surface:'#ffffff', sunken:'#f3f4f6', muted:'#f8fafc',
  border:'#e5e7eb', borderStrong:'#d1d5db', borderSub:'#f3f4f6',
  success:'#059669', successBg:'#D1FAE5',
  amber:'#B45309', amberBg:'#FEF3C7',
  violet:'#6D28D9', violetBg:'#EDE9FE',
  rose:'#BE123C', roseBg:'#FFE4E6',
  slate:'#475569', slateBg:'#E2E8F0',
  error:'#DC2626',
};

function SB({ color = PU.fg1 }) {
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

function Phone({ children }) {
  return (
    <div style={{
      width:360, height:740, borderRadius:46, padding:10, background:'#0b0f17',
      boxShadow:'0 40px 80px rgba(17,24,39,0.22), 0 0 0 1px rgba(0,0,0,0.14)',
    }}>
      <div style={{
        width:'100%', height:'100%', background:PU.muted,
        borderRadius:36, overflow:'hidden', position:'relative',
        display:'flex', flexDirection:'column',
        fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          position:'absolute', top:9, left:'50%', transform:'translateX(-50%)',
          width:108, height:30, borderRadius:20, background:'#000', zIndex:50,
        }}/>
        <SB color={PU.fg1}/>
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

function TopBar({ title, showSearch = true }) {
  return (
    <div style={{
      height:52, padding:'0 8px 0 16px', boxSizing:'border-box',
      display:'flex', alignItems:'center', justifyContent:'space-between',
      background:PU.muted, flexShrink:0, borderBottom:`1px solid ${PU.border}`,
    }}>
      <div style={{
        fontSize:22, fontWeight:700, color:PU.fg1, letterSpacing:-0.4,
      }}>{title}</div>
      {showSearch && (
        <div style={{display:'flex', gap:2}}>
          <button style={{
            width:36, height:36, borderRadius:'50%', background:'transparent',
            border:'none', cursor:'pointer', color:PU.fg1,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <i data-lucide="search" style={{width:19, height:19, strokeWidth:2}}/>
          </button>
          <button style={{
            width:36, height:36, borderRadius:'50%', background:'transparent',
            border:'none', cursor:'pointer', color:PU.fg1,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <i data-lucide="sliders-horizontal" style={{width:18, height:18, strokeWidth:2}}/>
          </button>
        </div>
      )}
    </div>
  );
}

const INTENTS = [
  {key:'all',       label:'All'},
  {key:'ask',       label:'Ask',         fg:PU.amber,  bg:PU.amberBg},
  {key:'recommend', label:'Recommend',   fg:PU.success, bg:PU.successBg},
  {key:'event',     label:'Event',       fg:PU.violet, bg:PU.violetBg},
  {key:'lost',      label:'Lost & Found',fg:PU.rose,   bg:PU.roseBg},
  {key:'announce',  label:'Announce',    fg:PU.slate,  bg:PU.slateBg},
];

function ChipRow({ activeKey = 'all' }) {
  return (
    <div style={{
      display:'flex', gap:8, overflowX:'auto', padding:'12px 16px',
      background:PU.muted, flexShrink:0,
      borderBottom:`1px solid ${PU.border}`,
    }}>
      {INTENTS.map((it, i) => {
        const active = it.key === activeKey;
        return (
          <button key={i} style={{
            height:28, padding:'0 14px', borderRadius:9999,
            background: active ? PU.primary600 : PU.surface,
            color: active ? '#fff' : PU.fg2,
            border: active ? 'none' : `1px solid ${PU.border}`,
            fontSize:12.5, fontWeight:600, letterSpacing:-0.05,
            cursor:'pointer', flexShrink:0, whiteSpace:'nowrap',
          }}>{it.label}</button>
        );
      })}
    </div>
  );
}

function IntentChip({ kind }) {
  const map = {
    ask:       {label:'Ask',     fg:PU.amber,   bg:PU.amberBg,  icon:'help-circle'},
    recommend: {label:'Rec',     fg:PU.success, bg:PU.successBg, icon:'thumbs-up'},
    event:     {label:'Event',   fg:PU.violet,  bg:PU.violetBg, icon:'calendar'},
    lost:      {label:'Lost',    fg:PU.rose,    bg:PU.roseBg,   icon:'search'},
    announce:  {label:'Announce',fg:PU.slate,   bg:PU.slateBg,  icon:'megaphone'},
  };
  const c = map[kind];
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      padding:'2px 8px 2px 6px', borderRadius:9999,
      background:c.bg, color:c.fg,
      fontSize:10, fontWeight:700, letterSpacing:0.04, textTransform:'uppercase',
      flexShrink:0,
    }}>
      <i data-lucide={c.icon} style={{width:10, height:10, strokeWidth:2.5}}/>
      {c.label}
    </span>
  );
}

function Avatar({ letter, color = '#a78bfa', verified = false, size = 32 }) {
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
          position:'absolute', right:-2, bottom:-2,
          width:13, height:13, borderRadius:'50%',
          background:PU.primary600, color:'#fff',
          display:'flex', alignItems:'center', justifyContent:'center',
          border:'1.5px solid #fff',
        }}>
          <i data-lucide="check" style={{width:7, height:7, strokeWidth:4}}/>
        </span>
      )}
    </div>
  );
}

function ReactionBar({ items }) {
  return (
    <div style={{display:'flex', alignItems:'center', gap:14, marginTop:10}}>
      {items.map((r, i) => (
        <div key={i} style={{
          display:'inline-flex', alignItems:'center', gap:4,
          color:PU.fg3, fontSize:11.5, fontWeight:500, letterSpacing:-0.02,
        }}>
          <i data-lucide={r.icon} style={{width:12, height:12, strokeWidth:2}}/>
          <span>{r.label} {r.count}</span>
        </div>
      ))}
      <div style={{flex:1}}/>
      <button style={{
        background:'transparent', border:'none', color:PU.fg3, cursor:'pointer',
        display:'flex', alignItems:'center', gap:4,
        fontSize:11.5, fontWeight:500, padding:0,
      }}>
        <i data-lucide="message-circle" style={{width:12, height:12, strokeWidth:2}}/>
        <span>Reply</span>
      </button>
    </div>
  );
}

function PostCard({ children }) {
  return (
    <div style={{
      background:PU.surface, border:`1px solid ${PU.border}`,
      borderRadius:16, padding:12,
    }}>{children}</div>
  );
}

function PostHeader({ name, color, letter, meta, intent, verified = false }) {
  return (
    <div style={{display:'flex', alignItems:'center', gap:9, marginBottom:8}}>
      <Avatar letter={letter} color={color} verified={verified}/>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize:13, fontWeight:600, color:PU.fg1, letterSpacing:-0.1, lineHeight:1.2}}>{name}</div>
        <div style={{fontSize:10.5, color:PU.fg3, marginTop:2, letterSpacing:0.01}}>{meta}</div>
      </div>
      <IntentChip kind={intent}/>
    </div>
  );
}

function FAB() {
  return (
    <button style={{
      position:'absolute', right:18, bottom:84, zIndex:30,
      width:52, height:52, borderRadius:'50%',
      background:PU.primary600, color:'#fff',
      border:'none', cursor:'pointer',
      display:'flex', alignItems:'center', justifyContent:'center',
      boxShadow:'0 12px 24px rgba(2,132,199,0.36), 0 4px 8px rgba(2,132,199,0.2)',
    }}>
      <i data-lucide="pencil" style={{width:20, height:20, strokeWidth:2.2}}/>
    </button>
  );
}

function TabBar({ activeKey = 'pulse' }) {
  const tabs = [
    {key:'home',    label:'Home',    icon:'home'},
    {key:'pulse',   label:'Pulse',   icon:'radio'},
    {key:'mail',    label:'Mail',    icon:'mail'},
    {key:'gigs',    label:'Gigs',    icon:'briefcase'},
    {key:'me',      label:'Me',      icon:'user'},
  ];
  return (
    <div style={{
      position:'absolute', bottom:0, left:0, right:0, zIndex:10,
      height:82, padding:'8px 8px 24px', boxSizing:'border-box',
      display:'flex', alignItems:'center', justifyContent:'space-around',
      background:'rgba(255,255,255,0.96)', backdropFilter:'blur(12px)',
      borderTop:`1px solid ${PU.border}`,
    }}>
      {tabs.map((t) => {
        const active = t.key === activeKey;
        return (
          <button key={t.key} style={{
            background:'transparent', border:'none', cursor:'pointer',
            display:'flex', flexDirection:'column', alignItems:'center', gap:3,
            padding:'4px 8px', minWidth:48,
            color: active ? PU.primary600 : PU.fg4,
          }}>
            <i data-lucide={t.icon} style={{width:22, height:22, strokeWidth: active ? 2.4 : 2}}/>
            <span style={{fontSize:10, fontWeight:600, letterSpacing:-0.05}}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Pull-to-refresh indicator (peeked, mid-gesture)
function PullToRefresh() {
  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'center',
      height:30, marginTop:-2, marginBottom:6,
      color:PU.fg4,
    }}>
      <i data-lucide="loader-2" style={{width:16, height:16, strokeWidth:2.4,
        animation:'spin 1s linear infinite'}}/>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 1 — POPULATED  (pull-to-refresh peeking at top)
// ═══════════════════════════════════════════════════════════════
function FrameFeedPopulated() {
  return (
    <Phone>
      <TopBar title="Pulse"/>
      <ChipRow activeKey="all"/>

      <div style={{
        flex:1, overflow:'auto',
        padding:'8px 12px 100px',
        display:'flex', flexDirection:'column', gap:10,
        background:PU.muted,
      }}>
        <PullToRefresh/>

        {/* Post 1 — Ask */}
        <PostCard>
          <PostHeader name="Maria L." letter="M" color="#0ea5e9" verified
            meta="2h · Elm Park" intent="ask"/>
          <div style={{
            fontSize:12.5, color:PU.fg2, lineHeight:'17px', letterSpacing:-0.02,
            display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden',
          }}>
            Anyone know a good dog-walker in Burnside? Our 1-year-old shepherd mix needs midday walks Tue/Thu and our regular just moved. References appreciated.
          </div>
          <ReactionBar items={[
            {icon:'lightbulb', label:'helpful', count:12},
            {icon:'heart',     label:'',        count:4},
          ]}/>
        </PostCard>

        {/* Post 2 — Rec */}
        <PostCard>
          <PostHeader name="Jordan A." letter="J" color="#059669"
            meta="5h · Elm Park" intent="recommend"/>
          <div style={{
            fontSize:12.5, color:PU.fg2, lineHeight:'17px', letterSpacing:-0.02,
            display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden',
          }}>
            Sourdough at 4th &amp; Market is legit — family-run, opens at 7. The country loaf is gone by 10. Cash only.
          </div>
          <ReactionBar items={[
            {icon:'heart',     label:'',        count:30},
            {icon:'lightbulb', label:'helpful', count:8},
          ]}/>
        </PostCard>

        {/* Post 3 — Event */}
        <PostCard>
          <PostHeader name="Anika R." letter="A" color="#6D28D9" verified
            meta="Yesterday · Elm Park" intent="event"/>
          <div style={{
            fontSize:13.5, fontWeight:600, color:PU.fg1, letterSpacing:-0.1, marginBottom:4,
          }}>Playground cleanup Saturday</div>
          <div style={{
            fontSize:12.5, color:PU.fg2, lineHeight:'17px', letterSpacing:-0.02,
            display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden',
          }}>
            9–11am at Burnside Park. Bring gloves; we'll have bags + coffee. Kids welcome — there's a craft table by the slide.
          </div>
          <div style={{
            display:'flex', alignItems:'center', gap:8, marginTop:9,
            paddingTop:9, borderTop:`1px solid ${PU.borderSub}`,
          }}>
            <div style={{display:'flex'}}>
              {[
                {l:'K', c:'#f97316'},
                {l:'P', c:'#0ea5e9'},
                {l:'S', c:'#6D28D9'},
                {l:'T', c:'#059669'},
              ].map((a, i) => (
                <div key={i} style={{
                  marginLeft: i === 0 ? 0 : -8, zIndex: 10 - i,
                  border:`2px solid ${PU.surface}`, borderRadius:'50%',
                }}>
                  <Avatar letter={a.l} color={a.c} size={22}/>
                </div>
              ))}
            </div>
            <span style={{fontSize:11, color:PU.fg3, fontWeight:500}}>+ 14 going</span>
            <div style={{flex:1}}/>
            <button style={{
              height:26, padding:'0 12px', borderRadius:9999, border:'none', cursor:'pointer',
              background:PU.violetBg, color:PU.violet,
              fontSize:11, fontWeight:700, letterSpacing:0.02,
              display:'inline-flex', alignItems:'center', gap:4,
            }}>
              <i data-lucide="plus" style={{width:10, height:10, strokeWidth:3}}/>
              RSVP
            </button>
          </div>
          <ReactionBar items={[
            {icon:'calendar-check', label:'going',   count:18},
            {icon:'heart',          label:'',        count:9},
          ]}/>
        </PostCard>

        {/* Post 4 — Lost */}
        <PostCard>
          <PostHeader name="Devon S." letter="D" color="#BE123C"
            meta="Yesterday · Burnside" intent="lost"/>
          <div style={{
            fontSize:12.5, color:PU.fg2, lineHeight:'17px', letterSpacing:-0.02,
            display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden',
          }}>
            Tortoiseshell cat missing near Maple &amp; 8th. Tag says "Pippin". Reward — please DM.
          </div>
          <ReactionBar items={[
            {icon:'eye',   label:'seen',   count:42},
            {icon:'share', label:'shared', count:6},
          ]}/>
        </PostCard>

        {/* Post 5 — Announce */}
        <PostCard>
          <PostHeader name="Elm Park Council" letter="E" color="#475569" verified
            meta="2d · Elm Park" intent="announce"/>
          <div style={{
            fontSize:12.5, color:PU.fg2, lineHeight:'17px', letterSpacing:-0.02,
            display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden',
          }}>
            Street sweeping shifts to Thursdays starting next week. Move vehicles by 7am or get ticketed. Posted signs go up Wednesday.
          </div>
          <ReactionBar items={[
            {icon:'eye',  label:'seen',  count:127},
            {icon:'heart', label:'',     count:3},
          ]}/>
        </PostCard>
      </div>

      <FAB/>
      <TabBar activeKey="pulse"/>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 2 — EMPTY
// ═══════════════════════════════════════════════════════════════
function FrameFeedEmpty() {
  return (
    <Phone>
      <TopBar title="Pulse"/>
      <ChipRow activeKey="all"/>

      <div style={{
        flex:1, overflow:'hidden', padding:'24px 24px 100px',
        display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', textAlign:'center', gap:14,
        background:PU.muted,
      }}>
        <div style={{
          width:72, height:72, borderRadius:'50%', background:PU.primary50,
          display:'flex', alignItems:'center', justifyContent:'center',
          color:PU.primary600, marginBottom:2,
        }}>
          <i data-lucide="radio" style={{width:32, height:32, strokeWidth:1.8}}/>
        </div>
        <h2 style={{
          margin:0, fontSize:20, fontWeight:700, color:PU.fg1, letterSpacing:-0.3,
        }}>No posts yet</h2>
        <p style={{
          margin:0, fontSize:13.5, color:PU.fg3, lineHeight:'20px',
          maxWidth:260, letterSpacing:-0.05,
        }}>Be the first to share. Ask a question, recommend a spot, or announce something local.</p>
        <button style={{
          marginTop:8, height:44, padding:'0 22px', borderRadius:9999, border:'none',
          background:PU.primary600, color:'#fff', cursor:'pointer',
          fontSize:14, fontWeight:700, letterSpacing:-0.1,
          display:'inline-flex', alignItems:'center', gap:8,
          boxShadow:'0 8px 18px rgba(2,132,199,0.30)',
        }}>
          <i data-lucide="pencil" style={{width:15, height:15, strokeWidth:2.4}}/>
          Create post
        </button>

        <div style={{
          marginTop:24, padding:'10px 14px', borderRadius:10,
          background:PU.surface, border:`1px solid ${PU.border}`,
          display:'inline-flex', alignItems:'center', gap:8, color:PU.fg3,
          fontSize:11.5, fontWeight:500, maxWidth:280,
        }}>
          <i data-lucide="map-pin" style={{width:13, height:13, color:PU.fg4}}/>
          Showing posts within <strong style={{color:PU.fg2, fontWeight:700, margin:'0 2px'}}>Elm Park</strong> · change in filter
        </div>
      </div>

      <FAB/>
      <TabBar activeKey="pulse"/>
    </Phone>
  );
}

Object.assign(window, { FrameFeedPopulated, FrameFeedEmpty });
