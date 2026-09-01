// Pantopus — Calendarly · Double-Book Warning (modal) — 2 frames
// Archetype: Confirm modal (WizardCloseConfirm-style) — centered destructive-
// confirm dialog. Host-side; accent follows owner context. Home variant names
// the conflicting member.
//
// Frames: 1 soft-overlap (allow override — Cancel + Book anyway) · 2 hard-
// conflict (member unavailable — disabled primary, Pick another member link).

const { E, SH } = window;

const WARN = '#B45309', WARN_BG = '#FFFBEB', WARN_LIGHT = '#FDE68A', WARN_SOLID='#D97706';
const ERR = '#DC2626', ERR_BG = '#FEF2F2', ERR_LIGHT = '#FCA5A5';
const PRIMARY = E.blue600;
const HOME = '#16a34a', HOME_BG='#dcfce7';

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

function Modal({ label, children }) {
  return (
    <div style={{ width:300, height:620, borderRadius:40, padding:8, background:'#0b0f17', boxShadow:'0 24px 50px rgba(17,24,39,0.20), 0 0 0 1px rgba(0,0,0,0.12)', flexShrink:0 }} data-screen-label={label}>
      <div style={{ width:'100%', height:'100%', background:E.bg, borderRadius:32, overflow:'hidden', position:'relative', display:'flex', flexDirection:'column', fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div style={{ position:'absolute', top:7, left:'50%', transform:'translateX(-50%)', width:88, height:24, borderRadius:16, background:'#000', zIndex:50 }}/>
        <DarkStatusBar/>
        <div style={{ flex:1, padding:'14px 16px', opacity:0.4 }}>
          <div style={{ height:24 }}><i data-lucide="chevron-left" style={{ width:20, height:20, color:E.fg2 }}/></div>
          <div style={{ fontSize:18, fontWeight:700, color:E.fg1, marginTop:12 }}>New event</div>
          <div style={{ fontSize:13, color:E.fg2, marginTop:6 }}>Today · 2:00–3:00 PM</div>
        </div>
        <div style={{ position:'absolute', inset:0, background:'rgba(17,24,39,0.5)', zIndex:18, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 20px' }}>
          <div style={{ width:'100%', maxWidth:300, background:E.surface, borderRadius:20, boxShadow:'0 20px 50px rgba(0,0,0,0.3)', padding:'20px 18px 16px', boxSizing:'border-box' }}>{children}</div>
        </div>
        <div style={{ position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)', width:100, height:4, borderRadius:4, background:'rgba(255,255,255,0.5)', zIndex:70 }}/>
      </div>
    </div>
  );
}

function IconDisc({ tone }) {
  const bg = tone === 'error' ? ERR_BG : WARN_BG;
  const fg = tone === 'error' ? ERR : WARN_SOLID;
  const icon = tone === 'error' ? 'lock' : 'calendar-clock';
  return (
    <div style={{ display:'flex', justifyContent:'center', marginBottom:14 }}>
      <div style={{ width:40, height:40, borderRadius:'50%', background:bg, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide={icon} style={{ width:20, height:20, color:fg }}/></div>
    </div>
  );
}

function ConflictCard() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:11, padding:'10px 12px', background:E.sunken, border:`1px solid ${E.border}`, borderRadius:12, marginBottom:14, cursor:'pointer' }}>
      <div style={{ width:36, height:36, borderRadius:9, background:WARN_BG, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i data-lucide="wrench" style={{ width:18, height:18, color:WARN_SOLID }}/></div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:700, color:E.fg1 }}>Plumber visit</div>
        <div style={{ fontSize:11, color:E.fg3, marginTop:1 }}>2:00–3:00 PM · this calendar</div>
      </div>
      <i data-lucide="chevron-right" style={{ width:16, height:16, color:E.fg4 }}/>
    </div>
  );
}

// ─── FRAME 1 · SOFT OVERLAP ─────────────────────────────────────────────────

function FrameSoftOverlap() {
  return (
    <Modal label="Double-book · Soft overlap">
      <IconDisc tone="warn"/>
      <h3 style={{ margin:'0 0 8px', fontSize:16.5, fontWeight:700, color:E.fg1, textAlign:'center', letterSpacing:-0.2 }}>This time overlaps</h3>
      <p style={{ margin:'0 0 14px', fontSize:13, color:E.fg2, textAlign:'center', lineHeight:'19px' }}>You already have "Plumber visit" from 2:00–3:00 PM on this calendar.</p>
      <ConflictCard/>
      <div style={{ display:'flex', gap:9 }}>
        <button style={{ flex:1, height:44, borderRadius:12, border:`1px solid ${E.borderStrong}`, background:E.surface, color:E.fg2, fontSize:13.5, fontWeight:700, cursor:'pointer' }}>Cancel</button>
        <button style={{ flex:1, height:44, borderRadius:12, border:'none', background:PRIMARY, color:'#fff', fontSize:13.5, fontWeight:700, cursor:'pointer', boxShadow:'0 6px 16px rgba(2,132,199,0.28)' }}>Book anyway</button>
      </div>
    </Modal>
  );
}

// ─── FRAME 2 · HARD CONFLICT ────────────────────────────────────────────────

function FrameHardConflict() {
  return (
    <Modal label="Double-book · Hard conflict">
      <IconDisc tone="error"/>
      <h3 style={{ margin:'0 0 8px', fontSize:16.5, fontWeight:700, color:E.fg1, textAlign:'center', letterSpacing:-0.2 }}>Member is unavailable</h3>
      <p style={{ margin:'0 0 12px', fontSize:13, color:E.fg2, textAlign:'center', lineHeight:'19px' }}>This time conflicts with Mara's personal availability.</p>
      <div style={{ display:'flex', alignItems:'center', gap:9, padding:'9px 12px', background:HOME_BG, borderRadius:11, marginBottom:14 }}>
        <span style={{ width:8, height:8, borderRadius:'50%', background:HOME, flexShrink:0 }}/>
        <span style={{ fontSize:11.5, color:'#15803d', fontWeight:600 }}>Conflicts with Mara's availability</span>
      </div>
      <button disabled style={{ width:'100%', height:44, borderRadius:12, border:'none', background:E.sunken, color:E.fg4, fontSize:13, fontWeight:700, cursor:'default', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7, marginBottom:9 }}><i data-lucide="lock" style={{ width:15, height:15 }}/>Can't book — member unavailable</button>
      <div style={{ display:'flex', gap:9, alignItems:'center' }}>
        <button style={{ flex:1, height:44, borderRadius:12, border:`1px solid ${E.borderStrong}`, background:E.surface, color:E.fg2, fontSize:13.5, fontWeight:700, cursor:'pointer' }}>Cancel</button>
        <button style={{ flex:1, height:44, borderRadius:12, border:'none', background:'transparent', color:PRIMARY, fontSize:13, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6 }}><i data-lucide="users" style={{ width:15, height:15 }}/>Pick another member</button>
      </div>
    </Modal>
  );
}

Object.assign(window, { FrameSoftOverlap, FrameHardConflict });
