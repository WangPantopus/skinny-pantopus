// A14.6 — Payments (src/app/settings/payments.tsx)
// Grouped chevron-row variant. Three groups: Payment methods · Payouts ·
// Activity. The "Add payment method" primary action lives as a final
// blue row inside the Payment methods card (iOS convention) — keeps the
// flow within the archetype's chrome rather than floating a CTA.
//
// Two frames:
//   1) Populated — three saved methods, Stripe connected, weekly payouts.
//   2) Empty — "No payment methods yet" inline hero inside the methods
//      card; Stripe not connected (primary chip CTA); Activity disabled.

// ─── Leading brand badge ─────────────────────────────────────────────────
// 38×26 rounded-corner brand mark. Small wordmark in the brand's actual
// color on a tinted background — readable at row height without faking
// the proprietary card art.
function BrandBadge({ kind }) {
  const config = {
    visa:        { label:'VISA',   bg:'#1A1F71', fg:'#fff'   },
    mastercard:  { label:'MC',     bg:'#fef3c7', fg:'#B45309', dot:true },
    amex:        { label:'AMEX',   bg:'#006FCF', fg:'#fff'   },
    apple:       { label:'Pay',    bg:'#0b0f17', fg:'#fff',   icon:'apple' },
    bank:        { label:'',       bg:'#e0f2fe', fg:'#0369A1', icon:'landmark' },
  }[kind];
  return (
    <div style={{
      width:38, height:26, borderRadius:6, background:config.bg,
      display:'flex', alignItems:'center', justifyContent:'center',
      color:config.fg, fontSize:10, fontWeight:800, letterSpacing:0.4,
      fontFamily:'ui-sans-serif, system-ui',
      flexShrink:0, position:'relative',
      boxShadow:'inset 0 0 0 1px rgba(0,0,0,0.04)',
    }}>
      {config.dot && (
        <span style={{
          position:'absolute', left:8, top:'50%', transform:'translateY(-50%)',
          width:10, height:10, borderRadius:'50%', background:'#EB001B', opacity:0.85,
        }}/>
      )}
      {config.dot && (
        <span style={{
          position:'absolute', left:14, top:'50%', transform:'translateY(-50%)',
          width:10, height:10, borderRadius:'50%', background:'#F79E1B', opacity:0.85,
        }}/>
      )}
      {config.icon
        ? <i data-lucide={config.icon} style={{width:14, height:14, strokeWidth:2}}/>
        : !config.dot && config.label}
    </div>
  );
}

// ─── "Add payment method" inline CTA row ─────────────────────────────────
// iOS-style blue row that lives inside a card as its last item.
function AddMethodRow({ label = 'Add payment method' }) {
  return (
    <div style={{
      minHeight:48, padding:'13px 16px', display:'flex',
      alignItems:'center', gap:12, cursor:'pointer',
    }}>
      <div style={{
        width:38, height:26, borderRadius:6,
        background:S.primary50, color:S.primary600,
        display:'flex', alignItems:'center', justifyContent:'center',
        flexShrink:0,
      }}>
        <i data-lucide="plus" style={{width:16, height:16, strokeWidth:2.5}}/>
      </div>
      <div style={{
        fontSize:15, fontWeight:600, color:S.primary600, letterSpacing:-0.1,
      }}>{label}</div>
    </div>
  );
}

// ─── Inline empty hero (sits inside a card) ──────────────────────────────
// Smaller than the full-screen EmptyState — used when a section is empty
// but the rest of the screen is still active.
function InlineEmpty({ icon, title, body }) {
  return (
    <div style={{
      padding:'28px 20px 22px', display:'flex', flexDirection:'column',
      alignItems:'center', textAlign:'center', gap:8,
    }}>
      <div style={{
        width:48, height:48, borderRadius:'50%', background:S.sunken,
        display:'flex', alignItems:'center', justifyContent:'center',
        color:S.fg3, marginBottom:2,
      }}>
        <i data-lucide={icon} style={{width:22, height:22, strokeWidth:1.75}}/>
      </div>
      <div style={{fontSize:15, fontWeight:600, color:S.fg1}}>{title}</div>
      {body && (
        <div style={{
          fontSize:12.5, color:S.fg3, lineHeight:'18px', maxWidth:240,
        }}>{body}</div>
      )}
    </div>
  );
}

// ─── Frame 1 — Populated ─────────────────────────────────────────────────
function FramePaymentsPopulated() {
  return (
    <Phone>
      <TopBar title="Payments"/>
      <div style={{flex:1, overflow:'auto', paddingBottom:24}}>

        {/* Balance summary card — sets context for the rest. */}
        <div style={{padding:'14px 12px 0'}}>
          <div style={{
            background:'linear-gradient(140deg, #0284C7 0%, #075985 100%)',
            color:'#fff', borderRadius:16, padding:'16px 18px',
            boxShadow:'0 6px 16px rgba(2,132,199,.18)',
          }}>
            <div style={{
              fontSize:10.5, fontWeight:700, letterSpacing:0.08,
              textTransform:'uppercase', color:'rgba(255,255,255,0.7)',
            }}>Available to pay out</div>
            <div style={{
              fontSize:28, fontWeight:700, letterSpacing:-0.5, marginTop:4,
              fontVariantNumeric:'tabular-nums',
            }}>$124.50</div>
            <div style={{
              marginTop:10, display:'flex', justifyContent:'space-between',
              alignItems:'center', fontSize:12,
            }}>
              <span style={{color:'rgba(255,255,255,0.85)'}}>Next payout · Mon, May 27</span>
              <span style={{
                background:'rgba(255,255,255,0.18)', color:'#fff',
                padding:'3px 9px', borderRadius:9999, fontSize:10.5,
                fontWeight:700, letterSpacing:0.04,
              }}>Weekly</span>
            </div>
          </div>
        </div>

        <Overline>Payment methods</Overline>
        <Card>
          <Row
            leading={<BrandBadge kind="visa"/>}
            label="Visa •• 4421"
            sub="Expires 09/27"
            right={<ChipChevron><Chip tone="primary">Default</Chip></ChipChevron>}
          />
          <Row
            leading={<BrandBadge kind="mastercard"/>}
            label="Mastercard •• 8830"
            sub="Expires 03/26"
            right={<Chevron/>}
          />
          <Row
            leading={<BrandBadge kind="apple"/>}
            label="Apple Pay"
            sub="iPhone 15 Pro"
            right={<Chevron/>}
          />
          <AddMethodRow/>
        </Card>

        <Overline>Payouts</Overline>
        <Card helper="Stripe handles payouts. Funds clear to your bank in 1–2 business days.">
          <Row
            leading={
              <div style={{
                width:38, height:26, borderRadius:6, background:'#635BFF',
                display:'flex', alignItems:'center', justifyContent:'center',
                color:'#fff', fontSize:10, fontWeight:800, letterSpacing:0.4,
                flexShrink:0,
              }}>stripe</div>
            }
            label="Stripe Connect"
            sub="Connected Mar 12, 2024"
            right={<ChipChevron><Chip tone="success" icon="shield-check">Connected</Chip></ChipChevron>}
          />
          <Row
            leading={<BrandBadge kind="bank"/>}
            label="Payout to Chase •• 1023"
            sub="Personal checking"
            right={<Chevron/>}
          />
          <Row
            label="Payout schedule"
            sub="Weekly · Mondays"
            right={<Chevron/>}
          />
          <Row
            label="Tax info"
            sub="W-9 on file"
            right={<ChipChevron><Chip tone="success" icon="shield-check">On file</Chip></ChipChevron>}
          />
        </Card>

        <Overline>Activity</Overline>
        <Card>
          <Row label="Transactions" sub="$2,340 earned · 47 in 2024" right={<Chevron/>}/>
          <Row label="Statements" sub="Monthly PDFs" right={<Chevron/>}/>
          <Row label="Disputes" sub="None" right={<Chevron/>}/>
        </Card>

        <div style={{height:18}}/>
        <Card>
          <Row label="Close payment account" destructive/>
        </Card>

        <MonoFooter>Stripe acct_1OqK… · Maria Lewin · ID 8174</MonoFooter>
      </div>
    </Phone>
  );
}

// ─── Frame 2 — Empty ─────────────────────────────────────────────────────
function FramePaymentsEmpty() {
  return (
    <Phone>
      <TopBar title="Payments"/>
      <div style={{flex:1, overflow:'auto', paddingBottom:24}}>

        <Overline>Payment methods</Overline>
        <Card>
          <InlineEmpty
            icon="credit-card"
            title="No payment methods yet"
            body="Add a card or bank account to hire neighbors and pay for marketplace listings."
          />
          <AddMethodRow/>
        </Card>

        <Overline>Payouts</Overline>
        <Card helper="Required before you can post paid tasks or sell on Marketplace.">
          <Row
            leading={
              <div style={{
                width:38, height:26, borderRadius:6, background:'#635BFF',
                display:'flex', alignItems:'center', justifyContent:'center',
                color:'#fff', fontSize:10, fontWeight:800, letterSpacing:0.4,
                flexShrink:0,
              }}>stripe</div>
            }
            label="Stripe Connect"
            sub="Receive payments from neighbors"
            right={<ChipChevron><Chip tone="primary">Connect</Chip></ChipChevron>}
          />
          <Row
            label="Payout method"
            sub="Add after connecting Stripe"
            right={<span style={{fontSize:13, color:S.fg4}}>—</span>}
          />
          <Row
            label="Tax info"
            sub="W-9 collected during setup"
            right={<span style={{fontSize:13, color:S.fg4}}>—</span>}
          />
        </Card>

        <Overline>Activity</Overline>
        <Card>
          <div style={{padding:'18px 16px', display:'flex', alignItems:'center', gap:12}}>
            <div style={{
              width:32, height:32, borderRadius:'50%', background:S.sunken,
              display:'flex', alignItems:'center', justifyContent:'center',
              color:S.fg4, flexShrink:0,
            }}>
              <i data-lucide="receipt" style={{width:16, height:16, strokeWidth:1.75}}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:14, fontWeight:500, color:S.fg2}}>No transactions yet</div>
              <div style={{fontSize:12, color:S.fg4, marginTop:2, lineHeight:'16px'}}>
                Hires and sales will appear here.
              </div>
            </div>
          </div>
        </Card>

        <MonoFooter>elena.park@gmail.com · Joined 3 days ago</MonoFooter>
      </div>
    </Phone>
  );
}

Object.assign(window, { FramePaymentsPopulated, FramePaymentsEmpty });
