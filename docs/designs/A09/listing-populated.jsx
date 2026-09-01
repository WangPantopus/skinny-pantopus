// A09.3 — Listing · Populated
// Marketplace detail. Transparent topnav over hero carousel.

function HeroCarousel({ active = 0, count = 4, sold = false }) {
  return (
    <div style={{
      position:'relative', width:'100%', height:300,
      background:'linear-gradient(135deg,#dbeafe 0%,#bfdbfe 45%,#a7f3d0 100%)',
    }}>
      {/* Bike illustration — minimal geometric */}
      <div style={{
        position:'absolute', inset:0,
        display:'flex', alignItems:'center', justifyContent:'center',
        filter: sold ? 'grayscale(0.85) brightness(0.92)' : 'none',
      }}>
        <svg width="240" height="160" viewBox="0 0 240 160" style={{
          filter:'drop-shadow(0 10px 20px rgba(0,0,0,0.18))',
        }}>
          {/* Frame */}
          <path d="M55 120 L120 60 L165 120 M120 60 L155 60 L165 120" stroke="#7c2d12" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M55 120 L100 60" stroke="#7c2d12" strokeWidth="6" fill="none" strokeLinecap="round"/>
          {/* Wheels */}
          <circle cx="55" cy="120" r="28" stroke="#1f2937" strokeWidth="4" fill="none"/>
          <circle cx="55" cy="120" r="4" fill="#1f2937"/>
          <circle cx="165" cy="120" r="28" stroke="#1f2937" strokeWidth="4" fill="none"/>
          <circle cx="165" cy="120" r="4" fill="#1f2937"/>
          {/* Spokes */}
          {[0,45,90,135].map(a => (
            <g key={a}>
              <line x1="55" y1="120" x2={55 + Math.cos(a*Math.PI/180)*26} y2={120 + Math.sin(a*Math.PI/180)*26} stroke="#9ca3af" strokeWidth="1"/>
              <line x1="55" y1="120" x2={55 - Math.cos(a*Math.PI/180)*26} y2={120 - Math.sin(a*Math.PI/180)*26} stroke="#9ca3af" strokeWidth="1"/>
              <line x1="165" y1="120" x2={165 + Math.cos(a*Math.PI/180)*26} y2={120 + Math.sin(a*Math.PI/180)*26} stroke="#9ca3af" strokeWidth="1"/>
              <line x1="165" y1="120" x2={165 - Math.cos(a*Math.PI/180)*26} y2={120 - Math.sin(a*Math.PI/180)*26} stroke="#9ca3af" strokeWidth="1"/>
            </g>
          ))}
          {/* Handlebars + seat */}
          <path d="M100 60 L92 50 M100 60 L108 56" stroke="#1f2937" strokeWidth="4" strokeLinecap="round"/>
          <ellipse cx="155" cy="58" rx="10" ry="3" fill="#1f2937"/>
        </svg>
      </div>

      {sold && (
        <div style={{
          position:'absolute', top:'50%', left:'50%',
          transform:'translate(-50%, -50%) rotate(-12deg)',
          padding:'10px 28px', borderRadius:6,
          border:'3px solid rgba(220,38,38,0.85)',
          color:'rgba(220,38,38,0.92)', background:'rgba(255,255,255,0.85)',
          fontSize:28, fontWeight:900, letterSpacing:4,
          textTransform:'uppercase',
        }}>Sold</div>
      )}

      <div style={{
        position:'absolute', bottom:14, left:'50%', transform:'translateX(-50%)',
        display:'flex', gap:5,
      }}>
        {Array.from({length:count}).map((_, i) => (
          <div key={i} style={{
            width: i === active ? 18 : 5, height:5, borderRadius:5,
            background: i === active ? '#fff' : 'rgba(255,255,255,0.6)',
            transition:'all 200ms',
          }}/>
        ))}
      </div>
    </div>
  );
}

function GlassTopNav({ trailing }) {
  return (
    <div style={{
      position:'absolute', top:44, left:0, right:0, zIndex:20,
      padding:'8px 12px', boxSizing:'border-box',
      display:'flex', alignItems:'center', justifyContent:'space-between',
    }}>
      <button style={{
        width:36, height:36, borderRadius:'50%',
        background:'rgba(255,255,255,0.85)', backdropFilter:'blur(8px)',
        border:'none', cursor:'pointer', color:TX.fg1,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <i data-lucide="chevron-left" style={{width:20, height:20, strokeWidth:2.2}}/>
      </button>
      <div style={{display:'flex', gap:4}}>{trailing}</div>
    </div>
  );
}

function GlassIcon({ icon }) {
  return (
    <button style={{
      width:36, height:36, borderRadius:'50%',
      background:'rgba(255,255,255,0.85)', backdropFilter:'blur(8px)',
      border:'none', cursor:'pointer', color:TX.fg1,
      display:'inline-flex', alignItems:'center', justifyContent:'center',
    }}>
      <i data-lucide={icon} style={{width:18, height:18, strokeWidth:2}}/>
    </button>
  );
}

const IDENTITY_STYLES = {
  Personal: { avatar: TX.primary600, chipBg: TX.primary50, chipFg: TX.primary700, icon: 'user' },
  Business: { avatar: TX.business,   chipBg: TX.businessBg, chipFg: TX.business,   icon: 'briefcase' },
  Home:     { avatar: '#16A34A',     chipBg: '#DCFCE7',     chipFg: '#15803D',     icon: 'home' },
};

function SellerCard({ name, initials = 'MR', identity = 'Personal', sub, dim = false }) {
  const idStyle = IDENTITY_STYLES[identity] || IDENTITY_STYLES.Personal;
  return (
    <div style={{padding:'18px 20px 0'}}>
      <div style={{
        display:'flex', alignItems:'center', gap:12,
        background:TX.muted, border:`1px solid ${TX.border}`,
        borderRadius:14, padding:'12px',
        opacity: dim ? 0.7 : 1,
      }}>
        <Avatar initials={initials} color={idStyle.avatar} verified size={44}/>
        <div style={{flex:1, minWidth:0}}>
          <div style={{display:'flex', alignItems:'center', gap:6}}>
            <span style={{fontSize:13.5, fontWeight:700, color:TX.fg1, letterSpacing:-0.1}}>{name}</span>
            <span style={{
              display:'inline-flex', alignItems:'center', gap:3,
              padding:'1px 6px', borderRadius:4,
              background:idStyle.chipBg, color:idStyle.chipFg,
              fontSize:9, fontWeight:700, letterSpacing:0.06, textTransform:'uppercase',
            }}>
              <i data-lucide={idStyle.icon} style={{width:8, height:8, strokeWidth:2.6}}/>
              {identity}
            </span>
          </div>
          <div style={{
            display:'inline-flex', alignItems:'center', gap:4, marginTop:2,
            fontSize:11.5, color:TX.fg3, fontWeight:500,
          }}>
            <i data-lucide="star" style={{width:10, height:10, fill:'#f59e0b', stroke:'none'}}/>
            {sub}
          </div>
        </div>
        <button style={{
          width:34, height:34, borderRadius:'50%',
          background:TX.surface, border:`1px solid ${TX.border}`,
          color:TX.fg2, cursor:'pointer',
          display:'inline-flex', alignItems:'center', justifyContent:'center',
        }}>
          <i data-lucide="message-circle" style={{width:14, height:14, strokeWidth:2.2}}/>
        </button>
      </div>
    </div>
  );
}

function SimilarRow({ items, label = 'Similar nearby', sub = '0.5 mi' }) {
  return (
    <SectionCard title={label} sub={sub}>
      <div style={{
        display:'flex', gap:10, overflowX:'auto',
        margin:'0 -20px', padding:'0 20px 4px',
      }}>
        {items.map((t, i) => (
          <div key={i} style={{width:120, flexShrink:0}}>
            <div style={{
              width:'100%', aspectRatio:'1 / 1', borderRadius:10, background:t.bg,
              marginBottom:6, display:'flex', alignItems:'center', justifyContent:'center',
              color:t.fg,
            }}>
              <i data-lucide={t.icon} style={{width:32, height:32, strokeWidth:1.6}}/>
            </div>
            <div style={{fontSize:11.5, fontWeight:600, color:TX.fg1, letterSpacing:-0.05}}>{t.name}</div>
            <div style={{fontSize:12, fontWeight:700, color:TX.primary600, marginTop:1}}>{t.price}</div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function FrameListingPopulated() {
  return (
    <Phone>
      <div style={{flex:1, overflow:'auto', paddingBottom:104, background:TX.surface}}>
        <HeroCarousel active={0} count={4}/>
        <GlassTopNav trailing={
          <>
            <GlassIcon icon="share"/>
            <GlassIcon icon="bookmark"/>
          </>
        }/>

        <div style={{padding:'18px 20px 0'}}>
          <div style={{
            fontSize:32, fontWeight:800, color:TX.primary600, letterSpacing:-1.2,
            lineHeight:'34px',
          }}>$410</div>
          <h1 style={{
            margin:'10px 0 0', fontSize:22, fontWeight:700, color:TX.fg1,
            letterSpacing:-0.4, lineHeight:'26px',
          }}>Vintage Bianchi road bike · 56cm</h1>
          <div style={{marginTop:10, display:'flex', flexWrap:'wrap', gap:6}}>
            <Pill bg={TX.successBg} color={TX.success} icon="sparkles">Excellent</Pill>
            <Pill bg={TX.sunken} color={TX.fg2} icon="hand">Pickup</Pill>
            <Pill bg={TX.sunken} color={TX.fg2}>0.8 mi</Pill>
          </div>
        </div>

        <SellerCard
          name="Manny R."
          identity="Personal"
          sub="4.9 · 28 listings · 0.8 mi"
        />

        <div style={{height:22}}/>
        <SectionCard title="Description" icon="text">
          <p style={{
            margin:0, fontSize:13.5, color:TX.fg2, lineHeight:'20px', letterSpacing:-0.05,
          }}>
            Late-80s Bianchi Sport SX, celeste paint, Campagnolo Veloce groupset. New tires last spring (Continental Gatorskins), recent tune, brand-new bar tape. 56cm c-t, fits ~5'10"–6'0". Pickup only — won't ship. Cash, Venmo, or Pantopus pay.
          </p>
        </SectionCard>

        <div style={{height:18}}/>
        <SectionCard title="Details" icon="info">
          <div style={{
            display:'grid', gridTemplateColumns:'auto 1fr', gap:'8px 16px',
            fontSize:12.5, letterSpacing:-0.05,
          }}>
            {[
              ['Brand','Bianchi'],
              ['Frame size','56cm c-t'],
              ['Condition','Excellent · 1 small chip'],
              ['Posted','3 days ago'],
            ].map(([k,v], i) => (
              <React.Fragment key={i}>
                <span style={{color:TX.fg3, fontWeight:500}}>{k}</span>
                <span style={{color:TX.fg1, fontWeight:600}}>{v}</span>
              </React.Fragment>
            ))}
          </div>
        </SectionCard>

        <div style={{height:22}}/>
        <SimilarRow items={[
          {bg:'linear-gradient(135deg,#fee2e2,#fca5a5)', fg:'#7f1d1d', icon:'bike', name:'Trek 520 · 54cm', price:'$340'},
          {bg:'linear-gradient(135deg,#e0e7ff,#a5b4fc)', fg:'#312e81', icon:'bike', name:'Cannondale CAAD',  price:'$520'},
          {bg:'linear-gradient(135deg,#dcfce7,#86efac)', fg:'#14532d', icon:'bike', name:'Surly Cross-Check', price:'$390'},
        ]}/>

        <div style={{height:30}}/>
      </div>

      {/* Listing dock: 3-button split — Message ghost, Make offer primary, Buy now secondary */}
      <div style={{
        position:'absolute', bottom:0, left:0, right:0, zIndex:10,
        padding:'12px 16px 24px', boxSizing:'border-box',
        background:'rgba(255,255,255,0.97)', backdropFilter:'blur(12px)',
        borderTop:`1px solid ${TX.border}`,
        display:'flex', gap:8,
      }}>
        <button style={{
          flex:'0 0 auto', width:48, height:48, borderRadius:12,
          background:TX.surface, border:`1px solid ${TX.border}`,
          color:TX.fg1, cursor:'pointer',
          display:'inline-flex', alignItems:'center', justifyContent:'center',
        }}>
          <i data-lucide="message-circle" style={{width:18, height:18, strokeWidth:2.2}}/>
        </button>
        <button style={{
          flex:1, height:48, borderRadius:12, border:'none',
          background:TX.primary600, color:'#fff', cursor:'pointer',
          fontSize:14.5, fontWeight:700, letterSpacing:-0.1,
          boxShadow:'0 8px 16px rgba(2,132,199,0.30)',
        }}>
          Make offer
        </button>
        <button style={{
          flex:'0 0 auto', height:48, padding:'0 16px', borderRadius:12,
          background:TX.surface, border:`1.5px solid ${TX.primary600}`,
          color:TX.primary700, fontSize:13.5, fontWeight:700, cursor:'pointer',
          letterSpacing:-0.05,
        }}>
          Buy $410
        </button>
      </div>
    </Phone>
  );
}

Object.assign(window, { FrameListingPopulated, HeroCarousel, GlassTopNav, GlassIcon, SellerCard, SimilarRow });
