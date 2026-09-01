// A09.3 — Listing · Secondary state: SOLD
// Same listing, terminal lifecycle. Hero gets a SOLD stamp + desaturation.
// Price shows final sale amount, dock CTA flips to "Find similar".

function FrameListingSold() {
  return (
    <Phone>
      <div style={{flex:1, overflow:'auto', paddingBottom:104, background:TX.surface}}>
        <HeroCarousel active={0} count={4} sold/>
        <GlassTopNav trailing={
          <>
            <GlassIcon icon="share"/>
            <GlassIcon icon="bookmark"/>
          </>
        }/>

        <div style={{padding:'18px 20px 0'}}>
          <div style={{display:'flex', alignItems:'center', gap:10}}>
            <Pill bg="#FEE2E2" color="#B91C1C" icon="x-circle">Sold</Pill>
            <span style={{fontSize:11, color:TX.fg3, fontWeight:500}}>
              · 6h ago
            </span>
          </div>
          <div style={{display:'flex', alignItems:'baseline', gap:10, marginTop:12}}>
            <div style={{
              fontSize:32, fontWeight:800, color:TX.fg3, letterSpacing:-1.2,
              lineHeight:'34px', textDecoration:'line-through',
              textDecorationThickness:'2px',
            }}>$410</div>
            <div style={{
              fontSize:14, fontWeight:700, color:TX.success, letterSpacing:-0.1,
            }}>Sold for $385</div>
          </div>
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
          sub="4.9 · 27 active listings · 0.8 mi"
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
              ['Sold','6 hours ago'],
            ].map(([k,v], i) => (
              <React.Fragment key={i}>
                <span style={{color:TX.fg3, fontWeight:500}}>{k}</span>
                <span style={{color:TX.fg1, fontWeight:600}}>{v}</span>
              </React.Fragment>
            ))}
          </div>
        </SectionCard>

        <div style={{height:22}}/>
        <SimilarRow
          label="Similar still available"
          sub="0.5 mi"
          items={[
            {bg:'linear-gradient(135deg,#fee2e2,#fca5a5)', fg:'#7f1d1d', icon:'bike', name:'Trek 520 · 54cm', price:'$340'},
            {bg:'linear-gradient(135deg,#e0e7ff,#a5b4fc)', fg:'#312e81', icon:'bike', name:'Cannondale CAAD',  price:'$520'},
            {bg:'linear-gradient(135deg,#dcfce7,#86efac)', fg:'#14532d', icon:'bike', name:'Surly Cross-Check', price:'$390'},
          ]}
        />

        <div style={{height:22}}/>
        <div style={{padding:'0 20px'}}>
          <div style={{
            border:`1px solid ${TX.border}`, borderRadius:12,
            background:TX.muted, padding:'14px',
            display:'flex', alignItems:'center', gap:12,
          }}>
            <div style={{
              width:36, height:36, borderRadius:10,
              background:TX.primary50, color:TX.primary600,
              display:'flex', alignItems:'center', justifyContent:'center',
              flexShrink:0,
            }}>
              <i data-lucide="bell" style={{width:17, height:17, strokeWidth:2}}/>
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:13, fontWeight:700, color:TX.fg1, letterSpacing:-0.05}}>
                Alert me when similar appears
              </div>
              <div style={{fontSize:11, color:TX.fg3, fontWeight:500, marginTop:1}}>
                Vintage road bike · 0.5 mi · under $450
              </div>
            </div>
            <button style={{
              height:30, padding:'0 12px', borderRadius:8,
              background:TX.surface, border:`1px solid ${TX.border}`,
              color:TX.fg1, fontSize:11.5, fontWeight:700, cursor:'pointer',
              letterSpacing:-0.05,
            }}>Set</button>
          </div>
        </div>

        <div style={{height:30}}/>
      </div>

      {/* Sold dock: primary disabled, secondary action takes over */}
      <div style={{
        position:'absolute', bottom:0, left:0, right:0, zIndex:10,
        padding:'12px 16px 24px', boxSizing:'border-box',
        background:'rgba(255,255,255,0.97)', backdropFilter:'blur(12px)',
        borderTop:`1px solid ${TX.border}`,
        display:'flex', gap:10,
      }}>
        <button style={{
          flex:'0 0 auto', height:48, padding:'0 18px', borderRadius:12,
          background:TX.surface, border:`1px solid ${TX.border}`,
          color:TX.fg1, fontSize:14, fontWeight:700, cursor:'pointer',
          display:'inline-flex', alignItems:'center', gap:6,
        }}>
          <i data-lucide="store" style={{width:15, height:15, strokeWidth:2.2}}/>
          Seller
        </button>
        <button style={{
          flex:1, height:48, borderRadius:12, border:'none',
          background:TX.primary600, color:'#fff', cursor:'pointer',
          fontSize:14.5, fontWeight:700, letterSpacing:-0.1,
          boxShadow:'0 8px 16px rgba(2,132,199,0.30)',
          display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
        }}>
          <i data-lucide="search" style={{width:15, height:15, strokeWidth:2.2}}/>
          Find similar
        </button>
      </div>
    </Phone>
  );
}

Object.assign(window, { FrameListingSold });
