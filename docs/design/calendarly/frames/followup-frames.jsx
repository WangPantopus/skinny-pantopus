// Pantopus — Calendarly · Post-Meeting Follow-up (sheet) — 5 frames
// Archetype: Sheet reusing the Support Trains SendUpdateForm (textarea + outcome
// chips + push toggle) from ManageTrain. Host-side; accent follows owner context.
//
// Frames: 1 default (no outcome, neutral composer) · 2 completed-template · 3
// no-show-template · 4 sent (success toast) · 5 error.

const { E, SH } = window;

const ID = { home:{color:'#16a34a', bg:'#dcfce7'} };
const ERR = '#DC2626', ERR_BG = '#FEF2F2', ERR_LIGHT = '#FCA5A5';
const SUCCESS = '#059669', SUCCESS_DK='#047857', SUCCESS_BG='#F0FDF4', SUCCESS_LIGHT='#A7F3D0';
const ACCENT = '#16a34a';
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

function Sheet({ label, children, cta='Send follow-up', ctaIcon='send', ctaGhost, toast }) {
  return (
    <div style={{ width:300, height:620, borderRadius:40, padding:8, background:'#0b0f17', boxShadow:'0 24px 50px rgba(17,24,39,0.20), 0 0 0 1px rgba(0,0,0,0.12)', flexShrink:0 }} data-screen-label={label}>
      <div style={{ width:'100%', height:'100%', background:E.bg, borderRadius:32, overflow:'hidden', position:'relative', display:'flex', flexDirection:'column', fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div style={{ position:'absolute', top:7, left:'50%', transform:'translateX(-50%)', width:88, height:24, borderRadius:16, background:'#000', zIndex:50 }}/>
        <DarkStatusBar/>
        <div style={{ flex:1, padding:'14px 16px', opacity:0.4 }}>
          <div style={{ height:24 }}><i data-lucide="chevron-left" style={{ width:20, height:20, color:E.fg2 }}/></div>
          <div style={{ fontSize:21, fontWeight:700, color:E.fg1, marginTop:10 }}>Garden walkthrough</div>
          <div style={{ fontSize:13, color:E.fg2, marginTop:6 }}>Mon, Jun 9 · 4:30 PM · PT</div>
        </div>
        <div style={{ position:'absolute', inset:0, background:'rgba(17,24,39,0.42)', zIndex:18 }}/>
        {toast ? (
          <div style={{ position:'absolute', left:0, right:0, bottom:0, top:0, zIndex:22, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, padding:'0 30px' }}>
            <div style={{ width:72, height:72, borderRadius:'50%', background:SUCCESS_BG, border:`1px solid ${SUCCESS_LIGHT}`, color:SUCCESS, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="check" style={{ width:34, height:34, strokeWidth:2.6 }}/></div>
            <div style={{ fontSize:17, fontWeight:700, color:'#fff', textAlign:'center' }}>Follow-up sent</div>
            <div style={{ position:'absolute', bottom:34, left:16, right:16, display:'flex', alignItems:'center', gap:10, padding:'12px 14px', background:'#111827', borderRadius:13, boxShadow:'0 8px 24px rgba(0,0,0,0.3)' }}>
              <i data-lucide="check-circle-2" style={{ width:18, height:18, color:SUCCESS_LIGHT }}/>
              <span style={{ fontSize:12.5, color:'#fff', fontWeight:600 }}>Follow-up sent to Mara</span>
            </div>
          </div>
        ) : (
          <div style={{ position:'absolute', left:0, right:0, bottom:0, zIndex:20, background:E.surface, borderTopLeftRadius:24, borderTopRightRadius:24, boxShadow:'0 -8px 30px rgba(0,0,0,0.18)', maxHeight:'90%', display:'flex', flexDirection:'column' }}>
            <div style={{ display:'flex', justifyContent:'center', paddingTop:9, paddingBottom:4, flexShrink:0 }}><div style={{ width:36, height:5, borderRadius:9999, background:E.borderStrong }}/></div>
            <div style={{ flex:1, overflow:'auto', padding:'4px 16px 12px' }}>{children}</div>
            <div style={{ flexShrink:0, padding:'10px 16px 20px', borderTop:`1px solid ${E.border}`, background:E.surface }}>
              <button style={{ width:'100%', height:48, borderRadius:13, border: ctaGhost?`1px solid ${E.borderStrong}`:'none', background: ctaGhost?E.surface:PRIMARY, color: ctaGhost?E.fg1:'#fff', fontSize:14.5, fontWeight:700, cursor:'pointer', boxShadow: ctaGhost?'none':'0 6px 16px rgba(2,132,199,0.28)', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8 }}><i data-lucide={ctaIcon} style={{ width:17, height:17 }}/>{cta}</button>
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
      <div style={{ fontSize:16.5, fontWeight:700, color:E.fg1, letterSpacing:-0.2 }}>Follow up</div>
      <div style={{ fontSize:11.5, color:E.fg3, marginTop:4 }}>Garden walkthrough · Mara Reyes · Jun 9</div>
    </div>
  );
}

function OutcomeChips({ selected }) {
  const chips = ['Completed', 'No-show', 'Rebook needed'];
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:E.fg3, marginBottom:9 }}>Outcome</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
        {chips.map((c) => { const on = c === selected; return (
          <button key={c} style={{ height:34, padding:'0 14px', borderRadius:9999, cursor:'pointer', fontSize:12, fontWeight:700, border: on?'none':`1px solid ${E.border}`, background: on?ID.home.bg:E.surface, color: on?ACCENT:E.fg2 }}>{c}</button>
        ); })}
      </div>
    </div>
  );
}

function Composer({ text, placeholder }) {
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:E.fg3, marginBottom:8 }}>Message to Mara</div>
      <div style={{ width:'100%', minHeight:84, boxSizing:'border-box', padding:'11px 12px', background:E.sunken, border:`1px solid ${E.border}`, borderRadius:8, fontSize:12.5, color: text?E.fg1:E.fg4, lineHeight:'18px' }}>{text || placeholder}</div>
      <button style={{ display:'inline-flex', alignItems:'center', gap:6, marginTop:9, height:30, padding:'0 12px', borderRadius:9999, border:`1px solid ${E.border}`, background:E.surface, cursor:'pointer', fontSize:11.5, fontWeight:700, color:PRIMARY }}><i data-lucide="link" style={{ width:13, height:13 }}/>Send rebook link</button>
    </div>
  );
}

function PrivateNote() {
  return (
    <div style={{ marginBottom:14, paddingTop:13, borderTop:`1px solid ${E.border}` }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
        <i data-lucide="lock" style={{ width:13, height:13, color:E.fg4 }}/>
        <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:E.fg3 }}>Private note</span>
      </div>
      <div style={{ width:'100%', minHeight:46, boxSizing:'border-box', padding:'10px 12px', background:E.sunken, border:`1px solid ${E.border}`, borderRadius:8, fontSize:12, color:E.fg4 }}>Outcome notes, next steps…</div>
      <div style={{ fontSize:10, color:E.fg4, marginTop:6, display:'flex', alignItems:'center', gap:5 }}><i data-lucide="eye-off" style={{ width:11, height:11 }}/>Only you can see this</div>
    </div>
  );
}

function PushToggle() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:11, padding:'11px 12px', background:E.surface, border:`1px solid ${E.border}`, borderRadius:12 }}>
      <i data-lucide="bell" style={{ width:17, height:17, color:E.fg2 }}/>
      <div style={{ flex:1, fontSize:12.5, fontWeight:600, color:E.fg1 }}>Send via push + message</div>
      <div style={{ width:42, height:25, borderRadius:9999, background:PRIMARY, position:'relative', flexShrink:0 }}><div style={{ position:'absolute', top:2.5, right:2.5, width:20, height:20, borderRadius:'50%', background:'#fff' }}/></div>
    </div>
  );
}

// ─── FRAME 1 · DEFAULT ──────────────────────────────────────────────────────

function FrameDefault() {
  return (
    <Sheet label="Follow-up · Default" cta="Save note only" ctaIcon="lock" ctaGhost>
      <SheetHeader/>
      <OutcomeChips selected={null}/>
      <Composer placeholder="Write a message, or pick an outcome above to start from a template."/>
      <PrivateNote/>
      <PushToggle/>
    </Sheet>
  );
}

// ─── FRAME 2 · COMPLETED TEMPLATE ───────────────────────────────────────────

function FrameCompleted() {
  return (
    <Sheet label="Follow-up · Completed">
      <SheetHeader/>
      <OutcomeChips selected="Completed"/>
      <Composer text="Thanks for the time today — good to connect. Want to book again?"/>
      <PrivateNote/>
      <PushToggle/>
    </Sheet>
  );
}

// ─── FRAME 3 · NO-SHOW TEMPLATE ─────────────────────────────────────────────

function FrameNoShow() {
  return (
    <Sheet label="Follow-up · No-show">
      <SheetHeader/>
      <OutcomeChips selected="No-show"/>
      <Composer text="Sorry we missed each other today. Here's a link to grab another time."/>
      <PrivateNote/>
      <PushToggle/>
    </Sheet>
  );
}

// ─── FRAME 4 · SENT (toast) ─────────────────────────────────────────────────

function FrameSent() {
  return <Sheet label="Follow-up · Sent" toast/>;
}

// ─── FRAME 5 · ERROR ────────────────────────────────────────────────────────

function FrameError() {
  return (
    <Sheet label="Follow-up · Error" cta="Try again" ctaIcon="rotate-cw">
      <SheetHeader/>
      <OutcomeChips selected="Completed"/>
      <Composer text="Thanks for the time today — good to connect. Want to book again?"/>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14, padding:'10px 12px', background:ERR_BG, border:`1px solid ${ERR_LIGHT}`, borderRadius:12 }}>
        <i data-lucide="alert-circle" style={{ width:16, height:16, color:ERR, flexShrink:0 }}/>
        <span style={{ fontSize:11.5, color:ERR, fontWeight:600 }}>Couldn't send — try again</span>
      </div>
      <PushToggle/>
    </Sheet>
  );
}

Object.assign(window, { FrameDefault, FrameCompleted, FrameNoShow, FrameSent, FrameError });
