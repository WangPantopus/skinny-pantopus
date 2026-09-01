// A09.4 — Invoice · Populated (Due in 7 days)
// Total elevated to hero per slot list; payer/payee cards; line items + tax/fees + total.

function PayerPayeeRow({ from, to }) {
  return (
    <div style={{padding:'18px 20px 0', display:'flex', gap:8}}>
      {[from, to].map((p, i) => (
        <div key={i} style={{
          flex:1, padding:12, border:`1px solid ${TX.border}`,
          borderRadius:12, background:TX.surface,
        }}>
          <div style={{
            fontSize:9, fontWeight:700, letterSpacing:0.12,
            textTransform:'uppercase', color:TX.fg4,
          }}>{p.label}</div>
          <div style={{
            fontSize:13, fontWeight:700, color:TX.fg1,
            marginTop:6, letterSpacing:-0.1,
          }}>{p.name}</div>
          <div style={{
            display:'inline-flex', alignItems:'center', gap:3, marginTop:4,
            fontSize:10, color:p.color, fontWeight:600,
          }}>
            <span style={{
              width:6, height:6, borderRadius:'50%', background:p.color,
            }}/>
            {p.sub}
          </div>
        </div>
      ))}
    </div>
  );
}

function InvoiceItemsTable({ items, fees, total, totalLabel = 'Total', totalColor }) {
  return (
    <SectionCard title="Line items" icon="list">
      <div style={{
        border:`1px solid ${TX.border}`, borderRadius:12,
        background:TX.surface, overflow:'hidden',
      }}>
        <div style={{
          display:'grid', gridTemplateColumns:'1fr 36px 64px 64px',
          padding:'8px 12px', background:TX.muted,
          borderBottom:`1px solid ${TX.border}`,
          fontSize:9, fontWeight:700, letterSpacing:0.1,
          textTransform:'uppercase', color:TX.fg4,
        }}>
          <span>Item</span>
          <span style={{textAlign:'center'}}>Qty</span>
          <span style={{textAlign:'right'}}>Unit</span>
          <span style={{textAlign:'right'}}>Total</span>
        </div>
        {items.map((r, i) => (
          <div key={i} style={{
            display:'grid', gridTemplateColumns:'1fr 36px 64px 64px',
            padding:'10px 12px',
            borderBottom: `1px solid ${TX.borderSub}`,
            fontSize:12, color:TX.fg1, alignItems:'center',
          }}>
            <span style={{fontWeight:500, letterSpacing:-0.05}}>{r.item}</span>
            <span style={{textAlign:'center', color:TX.fg3, fontWeight:500}}>{r.qty}</span>
            <span style={{textAlign:'right', color:TX.fg3, fontWeight:500, fontVariantNumeric:'tabular-nums'}}>{r.unit}</span>
            <span style={{textAlign:'right', fontWeight:600, fontVariantNumeric:'tabular-nums'}}>{r.total}</span>
          </div>
        ))}
        {/* Fees / tax block */}
        <div style={{background:TX.muted, padding:'8px 12px'}}>
          {fees.map((f, i) => (
            <div key={i} style={{
              display:'flex', justifyContent:'space-between',
              padding:'4px 0', fontSize:12, color:TX.fg2, fontWeight:500, letterSpacing:-0.05,
            }}>
              <span>{f.k}</span>
              <span style={{fontVariantNumeric:'tabular-nums'}}>{f.v}</span>
            </div>
          ))}
          <div style={{height:1, background:TX.border, margin:'6px 0 4px'}}/>
          <div style={{
            display:'flex', justifyContent:'space-between', alignItems:'baseline',
            padding:'2px 0',
          }}>
            <span style={{fontSize:13, fontWeight:700, color:TX.fg1, letterSpacing:-0.05}}>{totalLabel}</span>
            <span style={{
              fontSize:16, fontWeight:800, color:totalColor || TX.primary600,
              letterSpacing:-0.2, fontVariantNumeric:'tabular-nums',
            }}>{total}</span>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function FrameInvoicePopulated() {
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
          <Pill bg={TX.amberBg} color={TX.amber} icon="clock">Due in 7 days</Pill>
          <div style={{
            fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize:11, color:TX.fg3, marginTop:10, letterSpacing:0.04,
          }}>INV-00318 · issued Dec 4 · due Dec 18</div>
          <h1 style={{
            margin:'6px 0 0', fontSize:22, fontWeight:700, color:TX.fg1,
            letterSpacing:-0.4, lineHeight:'27px',
          }}>Holiday lighting · install + takedown</h1>

          {/* Total hero */}
          <div style={{display:'flex', alignItems:'baseline', gap:8, marginTop:18}}>
            <span style={{
              fontSize:32, fontWeight:800, color:TX.fg1, letterSpacing:-1.2,
              lineHeight:'34px', fontVariantNumeric:'tabular-nums',
            }}>$642.85</span>
            <span style={{fontSize:12, color:TX.fg3, fontWeight:500}}>total · USD</span>
          </div>
        </div>

        <PayerPayeeRow
          from={{label:'From', name:'Brightside Outdoor', sub:'Business · Verified', color:TX.business}}
          to={{label:'To', name:'Marcus Chen', sub:'Personal', color:TX.primary600}}
        />

        <div style={{height:22}}/>
        <InvoiceItemsTable
          items={[
            {item:'Install labor · 3.5h',  qty:'3.5', unit:'$65',   total:'$227.50'},
            {item:'LED string lights',     qty:'8',   unit:'$28',   total:'$224.00'},
            {item:'Clips, timer, splitters', qty:'1', unit:'$45',   total:'$45.00'},
            {item:'Takedown · scheduled Jan 6', qty:'1', unit:'$95', total:'$95.00'},
          ]}
          fees={[
            {k:'Subtotal',       v:'$591.50'},
            {k:'Service fee (3%)', v:'$17.75'},
            {k:'Tax (5.7%)',     v:'$33.60'},
          ]}
          total="$642.85"
        />

        <div style={{height:18}}/>
        <SectionCard title="Payment terms" icon="file-text">
          <div style={{fontSize:13, color:TX.fg2, fontWeight:500, lineHeight:'19px', letterSpacing:-0.05}}>
            Net 14 from issue. Pantopus Pay (instant), card, or ACH. Late fee 1.5%/mo applies after due date.
          </div>
        </SectionCard>

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

      {/* Single full-width Pay dock */}
      <div style={{
        position:'absolute', bottom:0, left:0, right:0, zIndex:10,
        padding:'12px 16px 24px', boxSizing:'border-box',
        background:'rgba(255,255,255,0.97)', backdropFilter:'blur(12px)',
        borderTop:`1px solid ${TX.border}`,
      }}>
        <button style={{
          width:'100%', height:50, borderRadius:12, border:'none',
          background:TX.primary600, color:'#fff', cursor:'pointer',
          fontSize:15, fontWeight:700, letterSpacing:-0.1,
          boxShadow:'0 8px 16px rgba(2,132,199,0.30)',
          display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8,
        }}>
          <i data-lucide="credit-card" style={{width:16, height:16, strokeWidth:2.2}}/>
          Pay $642.85
        </button>
      </div>
    </Phone>
  );
}

Object.assign(window, { FrameInvoicePopulated, PayerPayeeRow, InvoiceItemsTable });
