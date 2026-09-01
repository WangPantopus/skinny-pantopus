// A09.4 — Invoice · Secondary state: PAID
// Same invoice, paid 4 days early. Status flips green, total recolored,
// payment receipt info inserted, dock becomes Download receipt + Share.

function FrameInvoicePaid() {
  return (
    <Phone>
      <TopNav title="Invoice" trailing={
        <button style={{
          width:36, height:36, borderRadius:'50%', background:'transparent',
          border:'none', cursor:'pointer', color:TX.fg1,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <i data-lucide="download" style={{width:18, height:18, strokeWidth:2}}/>
        </button>
      }/>

      <div style={{flex:1, overflow:'auto', paddingBottom:104, background:TX.surface}}>
        <div style={{padding:'6px 20px 0'}}>
          <Pill bg={TX.successBg} color={TX.success} icon="check-circle">Paid · Dec 14</Pill>
          <div style={{
            fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize:11, color:TX.fg3, marginTop:10, letterSpacing:0.04,
          }}>INV-00318 · issued Dec 4 · paid Dec 14</div>
          <h1 style={{
            margin:'6px 0 0', fontSize:22, fontWeight:700, color:TX.fg1,
            letterSpacing:-0.4, lineHeight:'27px',
          }}>Holiday lighting · install + takedown</h1>

          <div style={{display:'flex', alignItems:'center', gap:10, marginTop:18}}>
            <span style={{
              fontSize:32, fontWeight:800, color:TX.success, letterSpacing:-1.2,
              lineHeight:'34px', fontVariantNumeric:'tabular-nums',
            }}>$642.85</span>
            <div style={{
              width:28, height:28, borderRadius:'50%',
              background:TX.success, color:'#fff',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <i data-lucide="check" style={{width:15, height:15, strokeWidth:3}}/>
            </div>
            <span style={{fontSize:12, color:TX.fg3, fontWeight:500, marginLeft:'auto'}}>paid in full</span>
          </div>
        </div>

        <PayerPayeeRow
          from={{label:'From', name:'Brightside Outdoor', sub:'Business · Verified', color:TX.business}}
          to={{label:'To', name:'Marcus Chen', sub:'Personal', color:TX.primary600}}
        />

        <div style={{padding:'18px 20px 0'}}>
          <div style={{
            display:'flex', alignItems:'center', gap:10,
            padding:'12px 14px', borderRadius:12,
            background:'#ecfdf5', border:`1px solid #a7f3d0`,
          }}>
            <div style={{
              width:30, height:30, borderRadius:'50%',
              background:'#fff', border:`1.5px solid ${TX.success}`,
              color:TX.success, flexShrink:0,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <i data-lucide="zap" style={{width:14, height:14, strokeWidth:2.4, fill:TX.success}}/>
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:12.5, fontWeight:700, color:'#065f46', letterSpacing:-0.05}}>
                Paid via Pantopus Pay
              </div>
              <div style={{fontSize:11, color:'#047857', fontWeight:500, marginTop:1, fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace'}}>
                txn_3p4q9m · Dec 14
              </div>
            </div>
          </div>
        </div>

        <div style={{height:22}}/>
        <InvoiceItemsTable
          items={[
            {item:'Install labor · 3.5h',  qty:'3.5', unit:'$65',   total:'$227.50'},
            {item:'LED string lights',     qty:'8',   unit:'$28',   total:'$224.00'},
            {item:'Clips, timer, splitters', qty:'1', unit:'$45',   total:'$45.00'},
            {item:'Takedown · scheduled Jan 6', qty:'1', unit:'$95', total:'$95.00'},
          ]}
          fees={[
            {k:'Subtotal',         v:'$591.50'},
            {k:'Service fee (3%)', v:'$17.75'},
            {k:'Tax (5.7%)',       v:'$33.60'},
          ]}
          total="$642.85"
          totalLabel="Paid"
          totalColor={TX.success}
        />

        <div style={{height:18}}/>
        <SectionCard title="Note from sender" icon="message-square-quote">
          <div style={{
            padding:'10px 12px', background:TX.muted,
            border:`1px solid ${TX.border}`, borderRadius:10,
            fontSize:12.5, color:TX.fg2, fontStyle:'italic', lineHeight:'18px',
            letterSpacing:-0.05,
          }}>
            "Takedown is on the schedule for the first Tuesday in January — no need to be home. Thanks again Marcus, happy holidays."
          </div>
        </SectionCard>

        <div style={{height:30}}/>
      </div>

      {/* Paid dock: Share ghost + Download receipt primary */}
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
          <i data-lucide="share" style={{width:15, height:15, strokeWidth:2.2}}/>
          Share
        </button>
        <button style={{
          flex:1, height:48, borderRadius:12, border:'none',
          background:TX.primary600, color:'#fff', cursor:'pointer',
          fontSize:14.5, fontWeight:700, letterSpacing:-0.1,
          boxShadow:'0 8px 16px rgba(2,132,199,0.30)',
          display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
        }}>
          <i data-lucide="receipt" style={{width:15, height:15, strokeWidth:2.2}}/>
          Download receipt
        </button>
      </div>
    </Phone>
  );
}

Object.assign(window, { FrameInvoicePaid });
