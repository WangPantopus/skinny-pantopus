// A09.1 — Task (V2) · Populated frame
// gig detail variant of A09 Transactional Detail

function FrameTaskV2Populated() {
  return (
    <Phone>
      <TopNav title="Task (V2)" trailing={
        <button style={{
          width:36, height:36, borderRadius:'50%', background:'transparent',
          border:'none', cursor:'pointer', color:TX.fg1,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <i data-lucide="more-horizontal" style={{width:20, height:20, strokeWidth:2}}/>
        </button>
      }/>

      <div style={{flex:1, overflow:'auto', paddingBottom:104}}>
        <div style={{padding:'6px 20px 0'}}>
          <Pill bg={TX.amberBg} color={TX.amber} icon="circle-dot">Open · 6 bids</Pill>
          <h1 style={{
            margin:'12px 0 0', fontSize:22, fontWeight:700, color:TX.fg1,
            letterSpacing:-0.4, lineHeight:'27px',
          }}>Move queen mattress + frame</h1>
          <div style={{
            display:'flex', alignItems:'center', gap:8, marginTop:10,
          }}>
            <span style={{
              display:'inline-flex', alignItems:'center',
              padding:'2px 8px', borderRadius:9999,
              background:'rgba(168,85,247,0.12)', color:'#7C3AED',
              fontSize:10, fontWeight:700, letterSpacing:0.06, textTransform:'uppercase',
            }}>Moving</span>
            <span style={{fontSize:11, color:TX.fg3, fontWeight:500}}>
              0.6 mi · posted 4h ago
            </span>
          </div>

          <div style={{display:'flex', alignItems:'baseline', gap:8, marginTop:18}}>
            <span style={{
              fontSize:32, fontWeight:800, color:TX.fg1, letterSpacing:-1.2,
              lineHeight:'34px',
            }}>$85</span>
            <span style={{fontSize:12, color:TX.fg3, fontWeight:500}}>budget · cash or transfer</span>
          </div>
        </div>

        <StatStrip cells={[
          {top:'Sun Nov 17', bot:'fixed date'},
          {top:'~45 min',    bot:'duration'},
          {top:'2 helpers',  bot:'needed'},
        ]}/>

        <div style={{height:22}}/>
        <SectionCard title="What needs doing" icon="clipboard-list">
          <p style={{
            margin:0, fontSize:13.5, color:TX.fg2, lineHeight:'20px', letterSpacing:-0.05,
          }}>
            Queen mattress (Casper, ~70 lb) plus metal bed frame, disassembled. Apt is 2nd floor walk-up — straight shot, no tight turns. Truck or van required; I do not have one.
          </p>
        </SectionCard>

        <div style={{height:18}}/>
        <SectionCard title="Pickup → drop-off" icon="map-pin">
          <div style={{
            display:'flex', flexDirection:'column', gap:6,
            padding:'10px 12px', background:TX.muted,
            border:`1px solid ${TX.border}`, borderRadius:10,
          }}>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <span style={{
                width:14, height:14, borderRadius:'50%',
                background:TX.primary100, color:TX.primary700,
                display:'inline-flex', alignItems:'center', justifyContent:'center',
                fontSize:9, fontWeight:800,
              }}>A</span>
              <span style={{fontSize:12.5, color:TX.fg1, fontWeight:600, letterSpacing:-0.05}}>
                712 Maplewood, Apt 2B
              </span>
              <div style={{flex:1}}/>
              <span style={{fontSize:11, color:TX.fg3, fontWeight:500}}>0.6 mi</span>
            </div>
            <div style={{
              width:1, height:10, background:TX.border, marginLeft:6,
            }}/>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <span style={{
                width:14, height:14, borderRadius:'50%',
                background:'#dcfce7', color:'#16a34a',
                display:'inline-flex', alignItems:'center', justifyContent:'center',
                fontSize:9, fontWeight:800,
              }}>B</span>
              <span style={{fontSize:12.5, color:TX.fg1, fontWeight:600, letterSpacing:-0.05}}>
                209 Cedar Ave, Apt 7
              </span>
              <div style={{flex:1}}/>
              <span style={{fontSize:11, color:TX.fg3, fontWeight:500}}>2.1 mi</span>
            </div>
          </div>
        </SectionCard>

        <div style={{height:18}}/>
        <SectionCard title="When" icon="calendar">
          <span style={{fontSize:13, color:TX.fg2, fontWeight:500, letterSpacing:-0.05}}>
            Sun Nov 17 · 10am – 12pm window
          </span>
        </SectionCard>

        <div style={{height:18}}/>
        <SectionCard title="Photos" icon="image" sub="3">
          <div style={{display:'flex', gap:8}}>
            <div style={{
              flex:1, aspectRatio:'1 / 1', borderRadius:10,
              background:'linear-gradient(135deg,#e0e7ff,#c7d2fe)',
              display:'flex', alignItems:'center', justifyContent:'center', color:'#3730a3',
            }}>
              <i data-lucide="bed" style={{width:24, height:24, strokeWidth:1.8}}/>
            </div>
            <div style={{
              flex:1, aspectRatio:'1 / 1', borderRadius:10,
              background:'linear-gradient(135deg,#fef3c7,#fde68a)',
              display:'flex', alignItems:'center', justifyContent:'center', color:'#92400e',
            }}>
              <i data-lucide="package" style={{width:24, height:24, strokeWidth:1.8}}/>
            </div>
            <div style={{
              flex:1, aspectRatio:'1 / 1', borderRadius:10,
              background:'linear-gradient(135deg,#fce7f3,#fbcfe8)',
              display:'flex', alignItems:'center', justifyContent:'center', color:'#9d174d',
            }}>
              <i data-lucide="door-open" style={{width:24, height:24, strokeWidth:1.8}}/>
            </div>
          </div>
        </SectionCard>

        <div style={{padding:'20px 20px 0', display:'flex', flexWrap:'wrap', gap:6}}>
          <Pill bg={TX.primary50} color={TX.primary700} icon="shield-check">Verified address</Pill>
          <Pill bg={TX.amberBg} color={TX.amber} icon="star">5.0★ rating</Pill>
          <Pill bg={TX.successBg} color={TX.success} icon="check">14 jobs done</Pill>
        </div>

        <div style={{height:24}}/>
        <SectionCard title="6 bids" sub="low $55 · high $95">
          <div style={{
            background:TX.surface, border:`1px solid ${TX.border}`,
            borderRadius:12, overflow:'hidden',
          }}>
            {[
              {ini:'MK', col:'#0ea5e9', name:'Marcus K.',  rating:'5.0', jobs:'47', amt:'$55', tag:'fastest reply'},
              {ini:'AT', col:'#16a34a', name:'Aaliyah T.', rating:'4.9', jobs:'28', amt:'$70', tag:null},
              {ini:'BV', col:'#7c3aed', name:'Ben V.',     rating:'4.8', jobs:'63', amt:'$75', tag:'has van'},
              {ini:'PC', col:'#f59e0b', name:'Priya C.',   rating:'4.9', jobs:'12', amt:'$80', tag:null},
              {ini:'DN', col:'#ef4444', name:'Devon N.',   rating:'4.7', jobs:'31', amt:'$85', tag:null},
              {ini:'IH', col:'#06b6d4', name:'Isla H.',    rating:'5.0', jobs:'8',  amt:'$95', tag:null},
            ].map((b, i, arr) => (
              <div key={i} style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'10px 12px',
                borderBottom: i < arr.length - 1 ? `1px solid ${TX.borderSub}` : 'none',
              }}>
                <Avatar initials={b.ini} color={b.col} verified size={36}/>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{display:'flex', alignItems:'center', gap:6}}>
                    <span style={{fontSize:12.5, fontWeight:600, color:TX.fg1, letterSpacing:-0.05}}>{b.name}</span>
                    {b.tag && (
                      <span style={{
                        fontSize:9, fontWeight:700, color:TX.primary700, background:TX.primary50,
                        padding:'1px 5px', borderRadius:4, letterSpacing:0.04, textTransform:'uppercase',
                      }}>{b.tag}</span>
                    )}
                  </div>
                  <div style={{
                    display:'inline-flex', alignItems:'center', gap:4,
                    fontSize:10.5, color:TX.fg3, fontWeight:500, marginTop:1,
                  }}>
                    <i data-lucide="star" style={{width:9, height:9, fill:'#f59e0b', stroke:'none'}}/>
                    {b.rating} · {b.jobs} jobs
                  </div>
                </div>
                <div style={{fontSize:14, fontWeight:700, color:TX.primary600, letterSpacing:-0.1}}>
                  {b.amt}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <div style={{height:30}}/>
      </div>

      <DockSplit primaryLabel="Place bid"/>
    </Phone>
  );
}

Object.assign(window, { FrameTaskV2Populated });
