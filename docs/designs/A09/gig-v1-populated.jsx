// A09.2 — Gig (V1) · Legacy detail, populated
// Sparser than V2 on purpose: no Magic Task modules, no stat strip, no trust capsules.
// Same A09 chrome.

function FrameGigV1Populated() {
  return (
    <Phone>
      <TopNav title="Gig (V1)" trailing={
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
          <Pill bg={TX.amberBg} color={TX.amber} icon="circle-dot">Open</Pill>
          <h1 style={{
            margin:'12px 0 0', fontSize:22, fontWeight:700, color:TX.fg1,
            letterSpacing:-0.4, lineHeight:'27px',
          }}>Dog walk · 45 min</h1>

          <div style={{display:'flex', alignItems:'baseline', gap:8, marginTop:14}}>
            <span style={{
              fontSize:32, fontWeight:800, color:TX.fg1, letterSpacing:-1.2,
              lineHeight:'34px',
            }}>$22</span>
            <span style={{fontSize:12, color:TX.fg3, fontWeight:500}}>budget</span>
          </div>

          {/* Legacy meta — plain row, no chips */}
          <div style={{
            display:'flex', alignItems:'center', gap:14, marginTop:14,
            paddingTop:12, borderTop:`1px solid ${TX.borderSub}`,
          }}>
            <div style={{display:'inline-flex', alignItems:'center', gap:6, color:TX.fg2}}>
              <i data-lucide="map-pin" style={{width:13, height:13, strokeWidth:2, color:TX.fg3}}/>
              <span style={{fontSize:12.5, fontWeight:600, letterSpacing:-0.05}}>0.4 mi</span>
            </div>
            <div style={{width:1, height:12, background:TX.border}}/>
            <div style={{display:'inline-flex', alignItems:'center', gap:6, color:TX.fg2}}>
              <i data-lucide="calendar" style={{width:13, height:13, strokeWidth:2, color:TX.fg3}}/>
              <span style={{fontSize:12.5, fontWeight:600, letterSpacing:-0.05}}>
                Thu Nov 14 · 5:30pm
              </span>
            </div>
          </div>
        </div>

        <div style={{height:22}}/>
        <SectionCard title="Description">
          <p style={{
            margin:0, fontSize:13.5, color:TX.fg2, lineHeight:'20px', letterSpacing:-0.05,
          }}>
            Need someone to walk Biscuit (corgi, 24 lb, friendly) for ~45 min while I'm in a late meeting. Leash + poop bags by the door. Lockbox code shared after award. One-time, possibly recurring on Thursdays.
          </p>
        </SectionCard>

        <div style={{height:18}}/>
        <SectionCard title="Posted by">
          <div style={{fontSize:13, color:TX.fg2, fontWeight:500, letterSpacing:-0.05}}>
            <span style={{color:TX.fg1, fontWeight:600}}>Hana O.</span>
            <span style={{color:TX.fg3}}> · 3 gigs posted · 2h ago</span>
          </div>
        </SectionCard>

        <div style={{height:22}}/>
        <SectionCard title="3 bids">
          <div style={{
            background:TX.surface, border:`1px solid ${TX.border}`,
            borderRadius:12, overflow:'hidden',
          }}>
            {[
              {ini:'TG', col:'#0ea5e9', name:'Tomás G.', rating:'4.9', jobs:'21', amt:'$20'},
              {ini:'RN', col:'#16a34a', name:'Rae N.',   rating:'5.0', jobs:'6',  amt:'$22'},
              {ini:'CW', col:'#7c3aed', name:'Carla W.', rating:'4.8', jobs:'34', amt:'$25'},
            ].map((b, i, arr) => (
              <div key={i} style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'10px 12px',
                borderBottom: i < arr.length - 1 ? `1px solid ${TX.borderSub}` : 'none',
              }}>
                <Avatar initials={b.ini} color={b.col} verified size={36}/>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:12.5, fontWeight:600, color:TX.fg1, letterSpacing:-0.05}}>{b.name}</div>
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

Object.assign(window, { FrameGigV1Populated });
