// A09.2 — Gig (V1) · Secondary state: Awarded
// Same gig, bid accepted. Status flips green, winning bid highlighted,
// losing bids dimmed, dock CTA disabled with award context.

function FrameGigV1Awarded() {
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
          <Pill bg={TX.successBg} color={TX.success} icon="check">Awarded</Pill>
          <h1 style={{
            margin:'12px 0 0', fontSize:22, fontWeight:700, color:TX.fg1,
            letterSpacing:-0.4, lineHeight:'27px',
          }}>Dog walk · 45 min</h1>

          <div style={{display:'flex', alignItems:'baseline', gap:8, marginTop:14}}>
            <span style={{
              fontSize:32, fontWeight:800, color:TX.fg1, letterSpacing:-1.2,
              lineHeight:'34px',
            }}>$22</span>
            <span style={{fontSize:12, color:TX.fg3, fontWeight:500}}>winning bid</span>
          </div>

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

        <div style={{padding:'18px 20px 0'}}>
          <div style={{
            display:'flex', alignItems:'center', gap:10,
            padding:'12px 14px', borderRadius:12,
            background:'#ecfdf5', border:`1px solid #a7f3d0`,
          }}>
            <div style={{
              width:30, height:30, borderRadius:'50%',
              background:TX.success, color:'#fff',
              display:'flex', alignItems:'center', justifyContent:'center',
              flexShrink:0,
            }}>
              <i data-lucide="check" style={{width:16, height:16, strokeWidth:2.6}}/>
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:12.5, fontWeight:700, color:'#065f46', letterSpacing:-0.05}}>
                Awarded to Tomás G.
              </div>
              <div style={{fontSize:11, color:'#047857', fontWeight:500, marginTop:1}}>
                14 min ago · bidding now closed
              </div>
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
        <SectionCard title="3 bids" sub="closed">
          <div style={{
            background:TX.surface, border:`1px solid ${TX.border}`,
            borderRadius:12, overflow:'hidden',
          }}>
            {[
              {ini:'TG', col:'#0ea5e9', name:'Tomás G.', rating:'4.9', jobs:'21', amt:'$20', won:true},
              {ini:'RN', col:'#16a34a', name:'Rae N.',   rating:'5.0', jobs:'6',  amt:'$22', won:false},
              {ini:'CW', col:'#7c3aed', name:'Carla W.', rating:'4.8', jobs:'34', amt:'$25', won:false},
            ].map((b, i, arr) => (
              <div key={i} style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'10px 12px',
                borderBottom: i < arr.length - 1 ? `1px solid ${TX.borderSub}` : 'none',
                background: b.won ? '#f0fdf4' : TX.surface,
                opacity: b.won ? 1 : 0.55,
              }}>
                <Avatar initials={b.ini} color={b.col} verified size={36}/>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{
                    display:'flex', alignItems:'center', gap:6,
                  }}>
                    <span style={{fontSize:12.5, fontWeight:600, color:TX.fg1, letterSpacing:-0.05}}>{b.name}</span>
                    {b.won && (
                      <span style={{
                        fontSize:9, fontWeight:700, color:'#065f46', background:'#a7f3d0',
                        padding:'1px 5px', borderRadius:4, letterSpacing:0.04, textTransform:'uppercase',
                      }}>Winner</span>
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
                <div style={{
                  fontSize:14, fontWeight:700, letterSpacing:-0.1,
                  color: b.won ? TX.success : TX.fg3,
                  textDecoration: b.won ? 'none' : 'line-through',
                }}>
                  {b.amt}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <div style={{height:30}}/>
      </div>

      {/* Dock — Message still active, primary disabled with award context */}
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
          <i data-lucide="message-circle" style={{width:15, height:15, strokeWidth:2.2}}/>
          Message
        </button>
        <button disabled style={{
          flex:1, height:48, borderRadius:12, border:`1px solid ${TX.border}`,
          background:TX.sunken, color:TX.fg3, cursor:'not-allowed',
          fontSize:14, fontWeight:700, letterSpacing:-0.1,
          display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
        }}>
          <i data-lucide="lock" style={{width:14, height:14, strokeWidth:2.2}}/>
          Bidding closed
        </button>
      </div>
    </Phone>
  );
}

Object.assign(window, { FrameGigV1Awarded });
