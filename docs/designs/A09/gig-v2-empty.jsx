// A09.1 — Task (V2) · Secondary state: just posted, no bids yet
// Same gig, fresh — empty bid-list slot becomes a "Be first" capsule.

function FrameTaskV2NoBids() {
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
          <Pill bg={TX.amberBg} color={TX.amber} icon="circle-dot">Open · No bids yet</Pill>
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
              0.6 mi · posted 8 min ago
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
            <div style={{width:1, height:10, background:TX.border, marginLeft:6}}/>
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
        <SectionCard title="Bids" sub="0 so far">
          <div style={{
            border:`1.5px dashed ${TX.border}`, borderRadius:12,
            background:TX.muted, padding:'20px 18px',
            display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center',
          }}>
            <div style={{
              width:42, height:42, borderRadius:'50%',
              background:TX.primary50, color:TX.primary600,
              display:'flex', alignItems:'center', justifyContent:'center',
              marginBottom:10,
            }}>
              <i data-lucide="hand-coins" style={{width:20, height:20, strokeWidth:2}}/>
            </div>
            <div style={{fontSize:14, fontWeight:700, color:TX.fg1, letterSpacing:-0.1}}>
              Be the first to bid
            </div>
            <div style={{
              fontSize:12, color:TX.fg3, fontWeight:500,
              marginTop:4, maxWidth:240, lineHeight:'17px',
            }}>
              Fresh posts usually get a hire in the first hour. First three bids land at the top of the list.
            </div>
            <div style={{
              display:'inline-flex', alignItems:'center', gap:5,
              marginTop:12, padding:'4px 10px', borderRadius:9999,
              background:TX.surface, border:`1px solid ${TX.border}`,
              fontSize:10.5, fontWeight:600, color:TX.fg3,
            }}>
              <i data-lucide="eye" style={{width:11, height:11, strokeWidth:2}}/>
              7 neighbors viewing
            </div>
          </div>
        </SectionCard>

        <div style={{height:30}}/>
      </div>

      <DockSplit primaryLabel="Place bid"/>
    </Phone>
  );
}

Object.assign(window, { FrameTaskV2NoBids });
