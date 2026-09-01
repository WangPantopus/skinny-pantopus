// Pantopus — Calendarly · Send a Nudge / Manual Follow-up (sheet) — 4 frames
// Archetype: Reuses the Support Trains SendUpdateForm wholesale (textarea +
// char counter + audience chips + push toggle). Owner-polymorphic; accent
// follows owner context.
//
// Frames: 1 composing · 2 over-limit · 3 sent (toast) · 4 no-recipients (disabled).

const { E, SH } = window;

const ID = { personal:{color:'#0284c7', bg:'#e0f2fe'} };
const ACCENT = '#0284c7';
const ERR = '#DC2626', ERR_BG = '#FEF2F2', ERR_LIGHT = '#FCA5A5';
const SUCCESS = '#059669', SUCCESS_LIGHT='#A7F3D0', SUCCESS_BG='#F0FDF4';
const PRIMARY = E.blue600;

function DarkStatusBar() {
  const c = E.fg1;
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 22px 0', height:34, boxSizing:'border-box', flexShrink:0, fontFamily:'-apple-system, system-ui', fontWeight:600, fontSize:12.5, color:c }}>
      <span>9:41</span>
      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
        <svg width="15" height="10" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={c}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={c}/><rect x="9" y="2" width="3" height="9" rx="0.6" fill={c}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={c}/></svg>
        <svg width="13" height="10" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={c}/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={c}/><circle cx="7.5" cy="9" r="1.3" fill={c}/></svg>
        <svg width="21" height="10" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={c} strokeOpacity="0.35" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill={c}/><path d="M22.5 3.8v3.4c.6-.2 1-.8 1-1.7s-.4-1.5-1-1.7z" fill={c} fillOpacity="0.4"/></svg>
      </div>
    </div>
  );
}

function Sheet({ label, children, cta, ctaDisabled, toast }) {
  return (
    <div style={{ width:300, height:620, borderRadius:40, padding:8, background:'#0b0f17', boxShadow:'0 24px 50px rgba(17,24,39,0.20), 0 0 0 1px rgba(0,0,0,0.12)', flexShrink:0 }} data-screen-label={label}>
      <div style={{ width:'100%', height:'100%', background:E.bg, borderRadius:32, overflow:'hidden', position:'relative', display:'flex', flexDirection:'column', fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div style={{ position:'absolute', top:7, left:'50%', transform:'translateX(-50%)', width:88, height:24, borderRadius:16, background:'#000', zIndex:50 }}/>
        <DarkStatusBar/>
        <div style={{ flex:1, padding:'14px 16px', opacity:0.4 }}>
          <div style={{ fontSize:18, fontWeight:700, color:E.fg1 }}>Group class</div>
          <div style={{ fontSize:13, color:E.fg2, marginTop:6 }}>Sat, Jun 14 · 10:00 AM</div>
        </div>
        <div style={{ position:'absolute', inset:0, background:'rgba(17,24,39,0.42)', zIndex:18 }}/>
        {toast ? (
          <div style={{ position:'absolute', inset:0, zIndex:22, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, padding:'0 30px' }}>
            <div style={{ width:72, height:72, borderRadius:'50%', background:SUCCESS_BG, border:`1px solid ${SUCCESS_LIGHT}`, color:SUCCESS, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="check" style={{ width:34, height:34, strokeWidth:2.6 }}/></div>
            <div style={{ fontSize:16.5, fontWeight:700, color:'#fff', textAlign:'center' }}>Update sent</div>
            <div style={{ position:'absolute', bottom:34, left:16, right:16, display:'flex', alignItems:'center', gap:10, padding:'12px 14px', background:'#111827', borderRadius:13, boxShadow:'0 8px 24px rgba(0,0,0,0.3)' }}>
              <i data-lucide="check-circle-2" style={{ width:18, height:18, color:SUCCESS_LIGHT }}/>
              <span style={{ fontSize:12.5, color:'#fff', fontWeight:600 }}>Update sent to 12 attendees</span>
            </div>
          </div>
        ) : (
          <div style={{ position:'absolute', left:0, right:0, bottom:0, zIndex:20, background:E.surface, borderTopLeftRadius:24, borderTopRightRadius:24, boxShadow:'0 -8px 30px rgba(0,0,0,0.18)', maxHeight:'92%', display:'flex', flexDirection:'column' }}>
            <div style={{ display:'flex', justifyContent:'center', paddingTop:9, paddingBottom:4, flexShrink:0 }}><div style={{ width:36, height:5, borderRadius:9999, background:E.borderStrong }}/></div>
            <div style={{ flex:1, overflow:'auto', padding:'4px 16px 12px' }}>{children}</div>
            <div style={{ flexShrink:0, padding:'10px 16px 20px', borderTop:`1px solid ${E.border}`, background:E.surface }}>
              <button disabled={ctaDisabled} style={{ width:'100%', height:48, borderRadius:13, border:'none', background: ctaDisabled?E.sunken:PRIMARY, color: ctaDisabled?E.fg4:'#fff', fontSize:14.5, fontWeight:700, cursor:ctaDisabled?'default':'pointer', boxShadow: ctaDisabled?'none':'0 6px 16px rgba(2,132,199,0.28)', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8 }}><i data-lucide="send" style={{ width:17, height:17 }}/>{cta}</button>
            </div>
          </div>
        )}
        <div style={{ position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)', width:100, height:4, borderRadius:4, background:'rgba(255,255,255,0.5)', zIndex:70 }}/>
      </div>
    </div>
  );
}

function SheetHeader() {
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:16.5, fontWeight:700, color:E.fg1, letterSpacing:-0.2 }}>Message attendees</div>
      <div style={{ fontSize:11.5, color:E.fg3, marginTop:4 }}>Group class · Sat, Jun 14</div>
    </div>
  );
}

function Composer({ text, over, count, limit=280 }) {
  return (
    <div style={{ marginBottom:14 }}>
      <button style={{ display:'inline-flex', alignItems:'center', gap:6, marginBottom:9, height:28, padding:'0 11px', borderRadius:9999, border:`1px solid ${E.border}`, background:E.surface, cursor:'pointer', fontSize:11, fontWeight:700, color:PRIMARY }}><i data-lucide="file-text" style={{ width:13, height:13 }}/>Use a template</button>
      <div style={{ position:'relative' }}>
        <div style={{ width:'100%', minHeight:96, boxSizing:'border-box', padding:'11px 12px', background:E.sunken, border:`1px solid ${over?ERR_LIGHT:E.border}`, borderRadius:8, fontSize:12.5, color:E.fg1, lineHeight:'18px' }}>{text}</div>
        <span style={{ position:'absolute', bottom:8, right:11, fontSize:10, fontWeight:700, color: over?ERR:E.fg4, fontVariantNumeric:'tabular-nums' }}>{count}/{limit}</span>
      </div>
      {over && <div style={{ fontSize:11, color:ERR, fontWeight:600, marginTop:6, display:'flex', alignItems:'center', gap:5 }}><i data-lucide="alert-circle" style={{ width:13, height:13 }}/>Shorten your message</div>}
    </div>
  );
}

function Audience({ selected }) {
  const chips = [
    { l:'All attendees', n:12 }, { l:'Confirmed only', n:10 }, { l:'No-shows', n:0 },
  ];
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:E.fg3, marginBottom:9 }}>Audience</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
        {chips.map((c) => { const on = c.l === selected; return (
          <button key={c.l} style={{ height:34, padding:'0 13px', borderRadius:9999, cursor:'pointer', fontSize:11.5, fontWeight:700, border: on?'none':`1px solid ${E.border}`, background: on?ID.personal.bg:E.surface, color: on?ACCENT:E.fg2 }}>{c.l} · {c.n}</button>
        ); })}
      </div>
    </div>
  );
}

function Channels() {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
      {[['Push', 'bell', true], ['Email', 'mail', false]].map(([l, icon, on]) => (
        <div key={l} style={{ display:'flex', alignItems:'center', gap:11, padding:'11px 12px', background:E.surface, border:`1px solid ${E.border}`, borderRadius:12 }}>
          <i data-lucide={icon} style={{ width:17, height:17, color:E.fg2 }}/>
          <div style={{ flex:1, fontSize:12.5, fontWeight:600, color:E.fg1 }}>{l}</div>
          <div style={{ width:42, height:25, borderRadius:9999, background: on?PRIMARY:E.borderStrong, position:'relative', flexShrink:0 }}><div style={{ position:'absolute', top:2.5, [on?'right':'left']:2.5, width:20, height:20, borderRadius:'50%', background:'#fff' }}/></div>
        </div>
      ))}
    </div>
  );
}

// ─── FRAME 1 · COMPOSING ────────────────────────────────────────────────────

function FrameComposing() {
  return (
    <Sheet label="Nudge · Composing" cta="Send to 12">
      <SheetHeader/>
      <Composer text="Quick reminder — class is tomorrow at 10 AM. Bring a water bottle and arrive 5 minutes early." count={96}/>
      <Audience selected="All attendees"/>
      <Channels/>
    </Sheet>
  );
}

// ─── FRAME 2 · OVER LIMIT ───────────────────────────────────────────────────

function FrameOverLimit() {
  return (
    <Sheet label="Nudge · Over limit" cta="Send to 12" ctaDisabled>
      <SheetHeader/>
      <Composer over count={304} text="Quick reminder — class is tomorrow at 10 AM. Bring a water bottle, arrive 5 minutes early, wear comfortable clothing, and remember to bring your own mat. Parking is available behind the studio on 4th Street. If anything changes we'll message here. See you there." />
      <Audience selected="All attendees"/>
      <Channels/>
    </Sheet>
  );
}

// ─── FRAME 3 · SENT (toast) ─────────────────────────────────────────────────

function FrameSent() {
  return <Sheet label="Nudge · Sent" toast/>;
}

// ─── FRAME 4 · NO RECIPIENTS ────────────────────────────────────────────────

function FrameNoRecipients() {
  return (
    <Sheet label="Nudge · No recipients" cta="Send" ctaDisabled>
      <SheetHeader/>
      <Composer text="Sorry we missed you today — here's a link to grab another time." count={62}/>
      <Audience selected="No-shows"/>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:-4, marginBottom:14, padding:'10px 12px', background:E.sunken, border:`1px solid ${E.border}`, borderRadius:11 }}>
        <i data-lucide="users-round" style={{ width:15, height:15, color:E.fg4, flexShrink:0 }}/>
        <span style={{ fontSize:11, color:E.fg3, fontWeight:600 }}>No one to message in this group</span>
      </div>
      <Channels/>
    </Sheet>
  );
}

Object.assign(window, { FrameComposing, FrameOverLimit, FrameSent, FrameNoRecipients });
