// Pantopus — Calendarly · Review & Confirm / Checkout (invitee) — 9 frames
// Archetype: ContentDetail summary block + primary CTA; the paid path is the
// Wizard final step + CheckoutCoordinator (Stripe PaymentIntent + PaymentSheet).
// Lives at /book/[slug]/review — the last step before confirm, absorbing
// payment and package-credit redemption.
//
// Mirrors A09.4 Invoice.html for the money block (line-item fees table, hero
// total in primary-600, identity-tinted dots) and Form.html summary-card
// rhythm; the saved-card row matches A14.6 Payments BrandBadge + "Brand •• 4421".
// Host pillar = Personal sky on the active CTA + price hero accent. Lucide
// stroke-2, no emoji. Never mark paid client-side — copy says payment clears.
//
// Frames: free ready · full payment · deposit-only · package-credit-applied ·
// logged-in saved cards · confirming · slot-no-longer-available ·
// card-error/3DS · Stripe-unavailable.

const { E, SH } = window;

const ACCENT = E.blue600;
const PILLAR = E.blue600;          // host pillar = Personal sky
const INFO_BG = '#F0F9FF', INFO = '#0369A1', INFO_BORDER = '#BAE6FD';
const WARN_BG = '#FFFBEB', WARN = '#B45309', WARN_BORDER = '#FDE68A';
const ERR = E.error, ERR_BG = '#FEF2F2', ERR_BORDER = '#FCA5A5', ERR_DK = '#991B1B';
const SUCCESS = E.success600, SUCCESS_BG = '#ECFDF5', SUCCESS_BORDER = '#A7F3D0', SUCCESS_DK = '#047857';
const HOST_AV = 'linear-gradient(135deg,#38bdf8,#0369a1)';

// ─── Phone shell ────────────────────────────────────────────────────────────

function DarkStatusBar() {
  const c = E.fg1;
  return (
    <div style={{
      display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'12px 22px 0', height:34, boxSizing:'border-box', flexShrink:0,
      fontFamily:'-apple-system, system-ui', fontWeight:600, fontSize:12.5, color:c,
    }}>
      <span>9:41</span>
      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
        <svg width="15" height="10" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={c}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={c}/><rect x="9" y="2" width="3" height="9" rx="0.6" fill={c}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={c}/></svg>
        <svg width="13" height="10" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={c}/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={c}/><circle cx="7.5" cy="9" r="1.3" fill={c}/></svg>
        <svg width="21" height="10" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={c} strokeOpacity="0.35" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill={c}/><path d="M22.5 3.8v3.4c.6-.2 1-.8 1-1.7s-.4-1.5-1-1.7z" fill={c} fillOpacity="0.4"/></svg>
      </div>
    </div>
  );
}

function TopBar() {
  return (
    <div style={{
      display:'flex', alignItems:'center', padding:'6px 8px', height:46, boxSizing:'border-box',
      background:E.surface, borderBottom:`1px solid ${E.border}`, flexShrink:0, zIndex:5,
    }}>
      <button aria-label="Back" style={{
        width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center',
        background:'transparent', border:'none', cursor:'pointer', color:E.fg1, padding:0,
      }}><i data-lucide="chevron-left" style={{ width:20, height:20 }}/></button>
      <div style={{ flex:1, textAlign:'center', fontSize:15, fontWeight:600, color:E.fg1, letterSpacing:-0.2 }}>Review &amp; confirm</div>
      <div style={{ width:34 }}/>
    </div>
  );
}

function Phone({ label, children, footer }) {
  return (
    <div style={{
      width:300, height:620, borderRadius:40, padding:8, background:'#0b0f17',
      boxShadow:'0 24px 50px rgba(17,24,39,0.20), 0 0 0 1px rgba(0,0,0,0.12)', flexShrink:0,
    }} data-screen-label={label}>
      <div style={{
        width:'100%', height:'100%', background:E.bg, borderRadius:32,
        overflow:'hidden', position:'relative', display:'flex', flexDirection:'column',
        fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          position:'absolute', top:7, left:'50%', transform:'translateX(-50%)',
          width:88, height:24, borderRadius:16, background:'#000', zIndex:50,
        }}/>
        <DarkStatusBar/>
        <TopBar/>
        <div style={{ flex:1, overflow:'auto', padding:'12px 13px 104px', display:'flex', flexDirection:'column', gap:12 }}>
          {children}
        </div>
        {footer}
        <div style={{
          position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)',
          width:100, height:4, borderRadius:4, background:'rgba(0,0,0,0.22)', zIndex:70,
        }}/>
      </div>
    </div>
  );
}

function Overline({ children, style }) {
  return (
    <div style={{
      fontSize:11, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase',
      color:E.fg3, marginBottom:9, ...style,
    }}>{children}</div>
  );
}

// ─── Summary card (who / what / when / where) ───────────────────────────────

function DetailRow({ icon, children, last }) {
  return (
    <div style={{
      display:'flex', alignItems:'flex-start', gap:10, padding:'10px 0',
      borderBottom: last ? 'none' : `1px solid ${E.border}`,
    }}>
      <i data-lucide={icon} style={{ width:15, height:15, color:E.fg3, flexShrink:0, marginTop:1 }}/>
      <div style={{ flex:1, minWidth:0 }}>{children}</div>
    </div>
  );
}

function AnswersDisclosure({ open }) {
  return (
    <div style={{ paddingTop:2 }}>
      <button style={{
        width:'100%', display:'flex', alignItems:'center', gap:10, padding:'10px 0 0', textAlign:'left',
        background:'transparent', border:'none', cursor:'pointer',
      }}>
        <i data-lucide="message-square-text" style={{ width:15, height:15, color:E.fg3, flexShrink:0 }}/>
        <span style={{ flex:1, fontSize:12.5, fontWeight:600, color:E.fg1, letterSpacing:-0.1 }}>Your answers</span>
        <span style={{ fontSize:11, color:E.fg4, marginRight:2 }}>3</span>
        <i data-lucide={open ? 'chevron-up' : 'chevron-down'} style={{ width:15, height:15, color:E.fg4, flexShrink:0 }}/>
      </button>
      {open && (
        <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:9, paddingLeft:25 }}>
          {[
            ['What should we cover?', 'Want to walk through the Q3 rollout and where my team can plug in.'],
            ['Phone number', '(415) 555-0142'],
            ['How did you hear about us?', 'A friend or colleague'],
          ].map(([q, a], i) => (
            <div key={i}>
              <div style={{ fontSize:10.5, fontWeight:600, color:E.fg3, letterSpacing:-0.05 }}>{q}</div>
              <div style={{ fontSize:12, color:E.fg1, marginTop:2, lineHeight:'16px' }}>{a}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ answersOpen }) {
  return (
    <div style={{
      background:E.surface, border:`1px solid ${E.border}`, borderRadius:16,
      boxShadow:'0 1px 3px rgba(0,0,0,0.04)', padding:'12px 13px',
    }}>
      {/* identity */}
      <div style={{ display:'flex', alignItems:'center', gap:11, paddingBottom:11, borderBottom:`1px solid ${E.border}` }}>
        <div style={{
          width:38, height:38, borderRadius:'50%', flexShrink:0, background:HOST_AV,
          display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:13, fontWeight:700,
        }}>MK</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:700, color:E.fg1, letterSpacing:-0.2 }}>Intro call</div>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
            <span style={{ fontSize:11.5, color:E.fg3 }}>with Maria Kessler</span>
            <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:PILLAR }}/>
              <span style={{ fontSize:10, fontWeight:600, color:PILLAR }}>Personal</span>
            </span>
          </div>
        </div>
      </div>

      <DetailRow icon="calendar">
        <div style={{ fontSize:12.5, fontWeight:600, color:E.fg1, letterSpacing:-0.1, fontVariantNumeric:'tabular-nums' }}>Wed, Jun 17 · 9:30&ndash;10:00 AM</div>
        <div style={{
          display:'inline-flex', alignItems:'center', gap:6, marginTop:6, padding:'4px 9px', borderRadius:9999,
          background:E.blue100, color:E.blue700, fontSize:10.5, fontWeight:600,
        }}>
          <i data-lucide="globe" style={{ width:11, height:11, strokeWidth:2.2 }}/>Pacific time (PDT)
        </div>
      </DetailRow>

      <DetailRow icon="video">
        <div style={{ fontSize:12.5, fontWeight:600, color:E.fg1, letterSpacing:-0.1 }}>Pantopus video</div>
        <div style={{ fontSize:11, color:E.fg3, marginTop:1 }}>Join link is sent after you book.</div>
      </DetailRow>

      <DetailRow icon="users" last>
        <div style={{ fontSize:12.5, fontWeight:600, color:E.fg1, letterSpacing:-0.1 }}>Maya Chen <span style={{ color:E.fg3, fontWeight:500 }}>(you)</span></div>
        <div style={{ fontSize:11, color:E.fg3, marginTop:1 }}>+ Sam Rivera</div>
      </DetailRow>

      <AnswersDisclosure open={answersOpen}/>
    </div>
  );
}

// ─── Money block (mirrors A09.4 Invoice totals) ─────────────────────────────

function TotalsBox({ rows, mode = 'full' }) {
  return (
    <div style={{ border:`1px solid ${E.border}`, borderRadius:12, background:E.surface, overflow:'hidden' }}>
      <div style={{ background:'#fafbfc', padding:'10px 13px' }}>
        {rows.map((r, i) => (
          <div key={i} style={{
            display:'flex', justifyContent:'space-between', padding:'4px 0',
            fontSize:12.5, color: r.strong ? E.fg1 : E.fg2, fontWeight: r.strong ? 600 : 500, letterSpacing:-0.05,
          }}>
            <span>{r.k}</span>
            <span style={{ fontVariantNumeric:'tabular-nums', color: r.credit ? SUCCESS : undefined, fontWeight: r.credit ? 700 : undefined }}>{r.v}</span>
          </div>
        ))}
        <div style={{ height:1, background:E.border, margin:'8px 0 6px' }}/>

        {mode === 'full' && (
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', padding:'2px 0' }}>
            <span style={{ fontSize:13, fontWeight:700, color:E.fg1, letterSpacing:-0.1 }}>Total</span>
            <span style={{ fontSize:22, fontWeight:800, color:ACCENT, letterSpacing:-0.5, fontVariantNumeric:'tabular-nums' }}>$48.00</span>
          </div>
        )}

        {mode === 'deposit' && (
          <div style={{ display:'flex', flexDirection:'column', gap:6, padding:'2px 0' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
              <span style={{ fontSize:13, fontWeight:700, color:E.fg1, letterSpacing:-0.1 }}>Due now</span>
              <span style={{ fontSize:22, fontWeight:800, color:ACCENT, letterSpacing:-0.5, fontVariantNumeric:'tabular-nums' }}>$20.00</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
              <span style={{ fontSize:11.5, fontWeight:500, color:E.fg3 }}>Balance at your visit</span>
              <span style={{ fontSize:13, fontWeight:600, color:E.fg2, fontVariantNumeric:'tabular-nums' }}>$40.00</span>
            </div>
          </div>
        )}

        {mode === 'credit' && (
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', padding:'2px 0' }}>
            <span style={{ fontSize:13, fontWeight:700, color:E.fg1, letterSpacing:-0.1 }}>Total</span>
            <span style={{ display:'inline-flex', alignItems:'baseline', gap:8 }}>
              <span style={{ fontSize:13, fontWeight:600, color:E.fg4, textDecoration:'line-through', fontVariantNumeric:'tabular-nums' }}>$48.00</span>
              <span style={{ fontSize:22, fontWeight:800, color:SUCCESS, letterSpacing:-0.5, fontVariantNumeric:'tabular-nums' }}>$0.00</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function DepositNote() {
  return (
    <div style={{ fontSize:11, color:E.fg3, marginTop:8, lineHeight:'16px' }}>
      You pay a <b style={{ color:E.fg2, fontWeight:700 }}>$20 deposit</b> now. The rest is due at your visit.
    </div>
  );
}

function CreditChip() {
  return (
    <div style={{
      display:'inline-flex', alignItems:'center', gap:6, marginTop:8, padding:'5px 10px', borderRadius:9999,
      background:SUCCESS_BG, border:`1px solid ${SUCCESS_BORDER}`, color:SUCCESS_DK, fontSize:11, fontWeight:700,
    }}>
      <i data-lucide="ticket-check" style={{ width:13, height:13, strokeWidth:2.2 }}/>1 session credit applied
    </div>
  );
}

function RefundLink() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:9 }}>
      <i data-lucide="shield-check" style={{ width:13, height:13, color:E.fg4, flexShrink:0 }}/>
      <span style={{ fontSize:11, color:E.fg3 }}>Free cancellation up to 24h before.{' '}
        <span style={{ color:ACCENT, fontWeight:600 }}>Refund policy</span>
      </span>
    </div>
  );
}

function ApplyCreditRow({ note }) {
  return (
    <button style={{
      width:'100%', display:'flex', alignItems:'center', gap:10, marginTop:10, textAlign:'left',
      background:E.surface, border:`1px dashed ${E.borderStrong}`, borderRadius:10, padding:'10px 12px', cursor:'pointer',
    }}>
      <i data-lucide="tag" style={{ width:15, height:15, color:ACCENT, flexShrink:0 }}/>
      <span style={{ flex:1, fontSize:12, fontWeight:600, color:E.fg1, letterSpacing:-0.05 }}>{note || 'Apply package credit or promo code'}</span>
      <i data-lucide="chevron-right" style={{ width:15, height:15, color:E.fg4, flexShrink:0 }}/>
    </button>
  );
}

// ─── Payment region ─────────────────────────────────────────────────────────

function BrandBadge({ kind }) {
  const config = {
    visa:       { label:'VISA', bg:'#1A1F71', fg:'#fff' },
    mastercard: { label:'MC',   bg:'#fef3c7', fg:'#B45309', dot:true },
  }[kind];
  return (
    <div style={{
      width:38, height:26, borderRadius:6, background:config.bg, flexShrink:0, position:'relative',
      display:'flex', alignItems:'center', justifyContent:'center', color:config.fg,
      fontSize:10, fontWeight:800, letterSpacing:0.4, boxShadow:'inset 0 0 0 1px rgba(0,0,0,0.04)',
    }}>
      {config.dot && <span style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', width:10, height:10, borderRadius:'50%', background:'#EB001B', opacity:0.85 }}/>}
      {config.dot && <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', width:10, height:10, borderRadius:'50%', background:'#F79E1B', opacity:0.85 }}/>}
      {!config.dot && config.label}
    </div>
  );
}

function SavedCardRow({ kind = 'visa', label, sub, isDefault }) {
  return (
    <button style={{
      width:'100%', display:'flex', alignItems:'center', gap:11, textAlign:'left',
      background:E.surface, border:`1px solid ${E.border}`, borderRadius:10, padding:'11px 12px',
      cursor:'pointer', boxShadow:'0 1px 2px rgba(0,0,0,0.03)',
    }}>
      <BrandBadge kind={kind}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12.5, fontWeight:600, color:E.fg1, letterSpacing:-0.1 }}>{label}</div>
        <div style={{ fontSize:10.5, color:E.fg3, marginTop:1 }}>{sub}</div>
      </div>
      {isDefault && (
        <span style={{
          fontSize:9.5, fontWeight:700, letterSpacing:0.02, color:E.blue700, background:E.blue50,
          border:`1px solid ${E.blue100}`, padding:'2px 7px', borderRadius:9999,
        }}>Default</span>
      )}
      <i data-lucide="chevron-right" style={{ width:15, height:15, color:E.fg4, flexShrink:0 }}/>
    </button>
  );
}

// "Payment method" button — opens the native Stripe PaymentSheet. We never draw
// a custom card form.
function PaymentMethodButton({ locked }) {
  return (
    <button disabled={locked} style={{
      width:'100%', display:'flex', alignItems:'center', gap:11, textAlign:'left',
      background:E.surface, border:`1.5px solid ${locked ? E.border : E.blue200}`, borderRadius:10, padding:'11px 12px',
      cursor: locked ? 'default' : 'pointer', opacity: locked ? 0.7 : 1,
    }}>
      <div style={{
        width:30, height:30, borderRadius:8, flexShrink:0, background:E.blue50, color:ACCENT,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}><i data-lucide="credit-card" style={{ width:16, height:16, strokeWidth:2.1 }}/></div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12.5, fontWeight:600, color:E.fg1, letterSpacing:-0.1 }}>Payment method</div>
        <div style={{ fontSize:10.5, color:E.fg3, marginTop:1 }}>Choose a card or Apple Pay</div>
      </div>
      <i data-lucide="chevron-right" style={{ width:15, height:15, color:E.fg4, flexShrink:0 }}/>
    </button>
  );
}

function TrustRow() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginTop:11 }}>
      <i data-lucide="lock" style={{ width:12, height:12, color:E.fg4, flexShrink:0 }}/>
      <span style={{ fontSize:10.5, color:E.fg4, fontWeight:500 }}>Payments secured by Stripe</span>
    </div>
  );
}

function PaymentSection({ children }) {
  return (
    <div>
      <Overline>Payment</Overline>
      <div style={{ display:'flex', flexDirection:'column', gap:9 }}>{children}</div>
      <TrustRow/>
    </div>
  );
}

// ─── Banners ────────────────────────────────────────────────────────────────

function Banner({ tone, icon, title, body, linkLabel }) {
  const t = tone === 'error' ? { bg:ERR_BG, bd:ERR_BORDER, fg:ERR, dk:ERR_DK }
          : tone === 'warn'  ? { bg:WARN_BG, bd:WARN_BORDER, fg:WARN, dk:'#92400e' }
          :                    { bg:INFO_BG, bd:INFO_BORDER, fg:INFO, dk:'#0c4a6e' };
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'11px 12px', background:t.bg, border:`1px solid ${t.bd}`, borderRadius:12 }}>
      <i data-lucide={icon} style={{ width:16, height:16, color:t.fg, flexShrink:0, marginTop:1, strokeWidth:2.2 }}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:700, color:t.dk, letterSpacing:-0.1, lineHeight:'16px' }}>{title}</div>
        {body && <div style={{ fontSize:11, color:t.fg, marginTop:2, lineHeight:'15px' }}>{body}</div>}
        {linkLabel && (
          <button style={{
            marginTop:7, display:'inline-flex', alignItems:'center', gap:5, background:'transparent', border:'none',
            padding:0, cursor:'pointer', color:t.dk, fontSize:11.5, fontWeight:700, letterSpacing:-0.05,
          }}>{linkLabel}<i data-lucide="arrow-right" style={{ width:12, height:12, strokeWidth:2.4 }}/></button>
        )}
      </div>
    </div>
  );
}

// ─── Sticky footer ──────────────────────────────────────────────────────────

function Footer({ children, note }) {
  return (
    <div style={{
      position:'absolute', left:0, right:0, bottom:0, zIndex:15,
      background:'rgba(255,255,255,0.97)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
      borderTop:`1px solid ${E.border}`, padding:'10px 13px 18px',
      display:'flex', flexDirection:'column', gap:7,
    }}>
      {children}
      {note && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
          <i data-lucide="info" style={{ width:11, height:11, color:E.fg4, flexShrink:0 }}/>
          <span style={{ fontSize:10, color:E.fg4 }}>{note}</span>
        </div>
      )}
    </div>
  );
}

function CTA({ label, icon = 'check', tone = 'primary', disabled }) {
  const bg = tone === 'warn' ? E.warning : ACCENT;
  return (
    <button disabled={disabled} style={{
      width:'100%', height:48, borderRadius:12, cursor: disabled ? 'not-allowed' : 'pointer', border:'none',
      letterSpacing:-0.1, fontSize:14.5, fontWeight:700,
      background: disabled ? E.sunken : bg, color: disabled ? E.fg4 : '#fff',
      boxShadow: disabled ? 'none' : (tone === 'warn' ? '0 6px 16px rgba(217,119,6,0.26)' : '0 6px 16px rgba(2,132,199,0.28)'),
      display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8,
    }}>
      <i data-lucide={icon} style={{ width:16, height:16, strokeWidth:2.2 }}/>{label}
    </button>
  );
}

function ShimmerCTA() {
  return (
    <div style={{ width:'100%', height:48, borderRadius:12, ...SH, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <span style={{ fontSize:13, fontWeight:600, color:E.fg4, letterSpacing:-0.1 }}>Confirming your booking</span>
    </div>
  );
}

function PaidNote() { return 'We\u2019ll confirm once payment clears.'; }

// ─── FRAME 1 · FREE — READY ─────────────────────────────────────────────────

function FrameFree() {
  return (
    <Phone label="Review · Free ready" footer={<Footer><CTA label="Confirm booking" icon="check"/></Footer>}>
      <SummaryCard answersOpen/>
      <RefundLink/>
    </Phone>
  );
}

// ─── FRAME 2 · FULL PAYMENT ─────────────────────────────────────────────────

function FrameFullPayment() {
  return (
    <Phone label="Review · Full payment" footer={<Footer note={PaidNote()}><CTA label="Pay $48 & book" icon="lock"/></Footer>}>
      <SummaryCard/>
      <div>
        <Overline>Price</Overline>
        <TotalsBox mode="full" rows={[
          { k:'Intro call · 30 min', v:'$40.00', strong:true },
          { k:'Service fee', v:'$3.00' },
          { k:'Tax', v:'$5.00' },
        ]}/>
        <RefundLink/>
        <ApplyCreditRow/>
      </div>
      <PaymentSection>
        <PaymentMethodButton/>
      </PaymentSection>
    </Phone>
  );
}

// ─── FRAME 3 · DEPOSIT ONLY ─────────────────────────────────────────────────

function FrameDeposit() {
  return (
    <Phone label="Review · Deposit only" footer={<Footer note={PaidNote()}><CTA label="Pay $20 & book" icon="lock"/></Footer>}>
      <SummaryCard/>
      <div>
        <Overline>Price</Overline>
        <TotalsBox mode="deposit" rows={[
          { k:'Home visit · 1 hr', v:'$60.00', strong:true },
        ]}/>
        <DepositNote/>
        <RefundLink/>
        <ApplyCreditRow/>
      </div>
      <PaymentSection>
        <PaymentMethodButton/>
      </PaymentSection>
    </Phone>
  );
}

// ─── FRAME 4 · PACKAGE CREDIT APPLIED ($0 due) ──────────────────────────────

function FrameCredit() {
  return (
    <Phone label="Review · Package credit applied" footer={<Footer><CTA label="Confirm booking" icon="check"/></Footer>}>
      <SummaryCard/>
      <div>
        <Overline>Price</Overline>
        <TotalsBox mode="credit" rows={[
          { k:'Intro call · 30 min', v:'$40.00', strong:true },
          { k:'Service fee', v:'$3.00' },
          { k:'Tax', v:'$5.00' },
          { k:'Session credit', v:'\u2212$48.00', credit:true },
        ]}/>
        <CreditChip/>
        <RefundLink/>
        <ApplyCreditRow note="Credit applied · use a different one"/>
      </div>
    </Phone>
  );
}

// ─── FRAME 5 · LOGGED-IN SAVED CARDS ────────────────────────────────────────

function FrameSavedCards() {
  return (
    <Phone label="Review · Saved cards" footer={<Footer note={PaidNote()}><CTA label="Pay $48 & book" icon="lock"/></Footer>}>
      <SummaryCard/>
      <div>
        <Overline>Price</Overline>
        <TotalsBox mode="full" rows={[
          { k:'Intro call · 30 min', v:'$40.00', strong:true },
          { k:'Service fee', v:'$3.00' },
          { k:'Tax', v:'$5.00' },
        ]}/>
        <RefundLink/>
        <ApplyCreditRow/>
      </div>
      <PaymentSection>
        <SavedCardRow kind="visa" label="Visa •• 4421" sub="Expires 09/27" isDefault/>
        <SavedCardRow kind="mastercard" label="Mastercard •• 8830" sub="Expires 03/26"/>
        <button style={{
          display:'inline-flex', alignItems:'center', gap:6, alignSelf:'flex-start', background:'transparent',
          border:'none', padding:'2px 2px', cursor:'pointer', color:ACCENT, fontSize:12, fontWeight:700, letterSpacing:-0.05,
        }}>
          <i data-lucide="plus" style={{ width:13, height:13, strokeWidth:2.4 }}/>Use another method
        </button>
      </PaymentSection>
    </Phone>
  );
}

// ─── FRAME 6 · CONFIRMING ───────────────────────────────────────────────────

function FrameConfirming() {
  return (
    <Phone label="Review · Confirming" footer={<Footer note={PaidNote()}><ShimmerCTA/></Footer>}>
      <div style={{ pointerEvents:'none', opacity:0.85, display:'flex', flexDirection:'column', gap:12 }}>
        <SummaryCard/>
        <div>
          <Overline>Price</Overline>
          <TotalsBox mode="full" rows={[
            { k:'Intro call · 30 min', v:'$40.00', strong:true },
            { k:'Service fee', v:'$3.00' },
            { k:'Tax', v:'$5.00' },
          ]}/>
        </div>
        <PaymentSection>
          <SavedCardRow kind="visa" label="Visa •• 4421" sub="Expires 09/27" isDefault/>
        </PaymentSection>
      </div>
    </Phone>
  );
}

// ─── FRAME 7 · SLOT NO LONGER AVAILABLE ─────────────────────────────────────

function FrameSlotTaken() {
  return (
    <Phone label="Review · Slot taken" footer={<Footer><CTA label="See other times" icon="calendar-search"/></Footer>}>
      <Banner tone="error" icon="calendar-x"
        title="This time was just taken"
        body="Someone booked Wed, Jun 17 at 9:30 AM before you finished. Nothing was charged."
        linkLabel="See other times"/>
      <div style={{ pointerEvents:'none', opacity:0.5, display:'flex', flexDirection:'column', gap:12 }}>
        <SummaryCard/>
        <div>
          <Overline>Price</Overline>
          <TotalsBox mode="full" rows={[
            { k:'Intro call · 30 min', v:'$40.00', strong:true },
            { k:'Service fee', v:'$3.00' },
            { k:'Tax', v:'$5.00' },
          ]}/>
        </div>
      </div>
    </Phone>
  );
}

// ─── FRAME 8 · CARD ERROR / 3DS ─────────────────────────────────────────────

function FrameCardError() {
  return (
    <Phone label="Review · Card error / 3DS" footer={<Footer note={PaidNote()}><CTA label="Try again" icon="rotate-ccw" tone="warn"/></Footer>}>
      <SummaryCard/>
      <Banner tone="warn" icon="alert-triangle"
        title="Your card needs another step"
        body="We couldn't confirm the payment with your bank. Check the card or try a different one — your time is still held."/>
      <div>
        <Overline>Price</Overline>
        <TotalsBox mode="full" rows={[
          { k:'Intro call · 30 min', v:'$40.00', strong:true },
          { k:'Service fee', v:'$3.00' },
          { k:'Tax', v:'$5.00' },
        ]}/>
        <RefundLink/>
      </div>
      <PaymentSection>
        <SavedCardRow kind="visa" label="Visa •• 4421" sub="Declined · try another" isDefault/>
        <PaymentMethodButton/>
      </PaymentSection>
    </Phone>
  );
}

// ─── FRAME 9 · STRIPE UNAVAILABLE ───────────────────────────────────────────

function FrameStripeUnavailable() {
  return (
    <Phone label="Review · Stripe unavailable" footer={<Footer note="Your time is held — try again in a moment."><CTA label="Pay $48 & book" icon="lock" disabled/></Footer>}>
      <SummaryCard/>
      <Banner tone="info" icon="cloud-off"
        title="Card payments are briefly unavailable"
        body="Stripe isn't responding right now. Your time is held — we'll keep it while you wait, no need to start over."/>
      <div>
        <Overline>Price</Overline>
        <TotalsBox mode="full" rows={[
          { k:'Intro call · 30 min', v:'$40.00', strong:true },
          { k:'Service fee', v:'$3.00' },
          { k:'Tax', v:'$5.00' },
        ]}/>
        <RefundLink/>
      </div>
      <PaymentSection>
        <div style={{ opacity:0.55, pointerEvents:'none' }}><PaymentMethodButton locked/></div>
      </PaymentSection>
    </Phone>
  );
}

Object.assign(window, {
  FrameFree, FrameFullPayment, FrameDeposit, FrameCredit, FrameSavedCards,
  FrameConfirming, FrameSlotTaken, FrameCardError, FrameStripeUnavailable,
});
