// Pantopus — Calendarly · Add to Calendar sheet (.ics + provider hand-off) — 5 frames
// Archetype: Action bottom sheet (picker rows) — the RsvpCluster chips promoted
// to a full sheet, plus the native EventKit write path. THIS sheet is the
// contract: it actually produces the calendar event promised across the
// confirmation screens.
//
// Lives in: surfaced from any booking surface — invitee booking-confirmed, host
// booking-detail, home-event-detail, visit-detail. Mirrors the A18 dock/sheet
// button rhythm and the Gig Picker Sheets list-row pattern (56px rows, leading
// icon disc, label + sub, trailing chevron, 1px dividers). Context-neutral
// chrome; accent inherits the opening surface. Lucide stroke-2, no emoji.
//
// Frames: web-default (3 providers + .ics) · native (EventKit primary) ·
// .ics-generating (skeleton) · added-success (morph) · multi-calendar picker.

const { E, SH } = window;

const ACCENT = E.blue600;
const SUCCESS = '#059669', SUCCESS_DK = '#047857', SUCCESS_BG = '#F0FDF4', SUCCESS_RING = '#A7F3D0';
const HOST_AV = 'linear-gradient(135deg,#38bdf8,#0369a1)';

// ─── Phone shell with dimmed Booking Confirmed backdrop + sheet ─────────────

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

function Backdrop() {
  return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', paddingTop:60 }}>
      <DarkStatusBar/>
      <div style={{ width:72, height:72, borderRadius:'50%', background:SUCCESS_BG, border:`2px solid ${SUCCESS_RING}`, display:'flex', alignItems:'center', justifyContent:'center', color:SUCCESS, marginTop:18 }}>
        <i data-lucide="check-circle-2" style={{ width:34, height:34, strokeWidth:1.9 }}/>
      </div>
      <div style={{ marginTop:14, fontSize:19, fontWeight:700, color:E.fg1, letterSpacing:-0.3 }}>You're booked</div>
      <div style={{ marginTop:6, fontSize:12, color:E.fg3 }}>We sent the details to maya@…</div>
    </div>
  );
}

function Phone({ label, children, sheetHeight = 452 }) {
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
        <div style={{ position:'absolute', top:7, left:'50%', transform:'translateX(-50%)', width:88, height:24, borderRadius:16, background:'#000', zIndex:50 }}/>
        <Backdrop/>
        <div style={{ position:'absolute', inset:0, background:'rgba(17,24,39,0.45)', zIndex:10 }}/>
        <div style={{
          position:'absolute', left:0, right:0, bottom:0, zIndex:20, height:sheetHeight,
          background:E.surface, borderTopLeftRadius:20, borderTopRightRadius:20,
          boxShadow:'0 -12px 40px rgba(17,24,39,0.22)', display:'flex', flexDirection:'column',
        }}>
          <div style={{ display:'flex', justifyContent:'center', paddingTop:9, paddingBottom:2, flexShrink:0 }}>
            <div style={{ width:38, height:4.5, borderRadius:9999, background:E.borderStrong }}/>
          </div>
          {children}
        </div>
        <div style={{ position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)', width:100, height:4, borderRadius:4, background:'rgba(255,255,255,0.5)', zIndex:70 }}/>
      </div>
    </div>
  );
}

// ─── Sheet header (title + event recap chip) ────────────────────────────────

function SheetHeader({ title = 'Add to your calendar', back }) {
  return (
    <div style={{ padding:'2px 14px 0', flexShrink:0 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, height:30 }}>
        {back && <i data-lucide="chevron-left" style={{ width:18, height:18, color:E.fg2, flexShrink:0 }}/>}
        <div style={{ fontSize:15, fontWeight:700, color:E.fg1, letterSpacing:-0.2 }}>{title}</div>
      </div>
    </div>
  );
}

function RecapChip() {
  return (
    <div style={{
      margin:'8px 14px 0', display:'flex', alignItems:'center', gap:8, padding:'9px 12px',
      background:E.blue50, border:`1px solid ${E.blue100}`, borderRadius:10,
    }}>
      <i data-lucide="calendar" style={{ width:14, height:14, color:E.blue700, flexShrink:0 }}/>
      <span style={{ fontSize:11.5, color:E.blue700, fontWeight:600, letterSpacing:-0.05, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
        Intro call · Wed, Jun 17 · 9:30 AM PDT
      </span>
    </div>
  );
}

// ─── Picker row (Gig Picker Sheets pattern, 56px) ───────────────────────────

function PickerRow({ icon, label, sub, last, state, dot, selected }) {
  const isSkeleton = state === 'skeleton';
  const isDone = state === 'done';
  return (
    <button disabled={isSkeleton} style={{
      width:'100%', height:56, display:'flex', alignItems:'center', gap:12, textAlign:'left',
      background:'transparent', border:'none', borderBottom: last ? 'none' : `1px solid ${E.border}`,
      padding:'0 14px', cursor: isSkeleton ? 'default' : 'pointer',
    }}>
      {dot ? (
        <span style={{ width:18, height:18, borderRadius:'50%', flexShrink:0, background:dot, boxShadow:'inset 0 0 0 1px rgba(0,0,0,0.08)' }}/>
      ) : (
        <div style={{
          width:36, height:36, borderRadius:10, flexShrink:0,
          background: isDone ? SUCCESS_BG : E.sunken, color: isDone ? SUCCESS : E.fg2,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <i data-lucide={isDone ? 'check' : icon} style={{ width:18, height:18, strokeWidth: isDone ? 2.6 : 2 }}/>
        </div>
      )}
      <div style={{ flex:1, minWidth:0 }}>
        {isSkeleton ? (
          <React.Fragment>
            <div style={{ fontSize:13.5, fontWeight:600, color:E.fg1, letterSpacing:-0.1 }}>{label}</div>
            <div style={{ display:'flex', alignItems:'center', gap:7, marginTop:5 }}>
              <div style={{ width:90, height:8, borderRadius:5, ...SH }}/>
              <span style={{ fontSize:10.5, color:E.fg3 }}>Preparing your file</span>
            </div>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <div style={{ fontSize:13.5, fontWeight:600, color: isDone ? SUCCESS_DK : E.fg1, letterSpacing:-0.1 }}>{label}</div>
            {sub && <div style={{ fontSize:10.5, color:E.fg3, marginTop:1 }}>{sub}</div>}
          </React.Fragment>
        )}
      </div>
      {isDone ? (
        <i data-lucide="check-circle-2" style={{ width:18, height:18, color:SUCCESS, flexShrink:0 }}/>
      ) : isSkeleton ? null : selected ? (
        <i data-lucide="check" style={{ width:18, height:18, color:ACCENT, flexShrink:0, strokeWidth:2.6 }}/>
      ) : (
        <i data-lucide="chevron-right" style={{ width:16, height:16, color:E.fg4, flexShrink:0 }}/>
      )}
    </button>
  );
}

function RowCard({ children }) {
  return (
    <div style={{ margin:'12px 14px 0', background:E.surface, border:`1px solid ${E.border}`, borderRadius:14, overflow:'hidden', boxShadow:'0 1px 2px rgba(0,0,0,0.03)' }}>
      {children}
    </div>
  );
}

function Caption({ children }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:7, margin:'11px 16px 0' }}>
      <i data-lucide="bell" style={{ width:13, height:13, color:E.fg4, flexShrink:0, marginTop:1 }}/>
      <span style={{ fontSize:11, color:E.fg3, lineHeight:'15px' }}>{children}</span>
    </div>
  );
}

function DoneBar() {
  return (
    <div style={{ flexShrink:0, marginTop:'auto', borderTop:`1px solid ${E.border}`, padding:'10px 14px 18px' }}>
      <button style={{ width:'100%', height:44, borderRadius:12, background:E.surface, border:`1px solid ${E.border}`, color:E.fg1, fontSize:13.5, fontWeight:700, letterSpacing:-0.1, cursor:'pointer' }}>Done</button>
    </div>
  );
}

function Body({ children }) {
  return <div style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column', paddingBottom:6 }}>{children}</div>;
}

// ─── FRAME 1 · WEB DEFAULT ──────────────────────────────────────────────────

function FrameWebDefault() {
  return (
    <Phone label="Add to calendar · Web">
      <SheetHeader/>
      <RecapChip/>
      <Body>
        <RowCard>
          <PickerRow icon="calendar" label="Apple Calendar" sub="Save to your iPhone"/>
          <PickerRow icon="calendar-plus" label="Google Calendar" sub="Opens in your browser"/>
          <PickerRow icon="calendar-plus" label="Outlook" sub="Opens in your browser"/>
          <PickerRow icon="download" label="Download .ics file" sub="Works with any calendar app" last/>
        </RowCard>
        <Caption>We'll add the event with the join link and a reminder.</Caption>
      </Body>
      <DoneBar/>
    </Phone>
  );
}

// ─── FRAME 2 · NATIVE (EventKit primary) ────────────────────────────────────

function FrameNative() {
  return (
    <Phone label="Add to calendar · Native" sheetHeight={476}>
      <SheetHeader/>
      <RecapChip/>
      <Body>
        <div style={{ margin:'12px 14px 0' }}>
          <button style={{
            width:'100%', height:48, borderRadius:12, border:'none', cursor:'pointer',
            background:ACCENT, color:'#fff', fontSize:14, fontWeight:700, letterSpacing:-0.1,
            boxShadow:'0 6px 16px rgba(2,132,199,0.28)', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8,
          }}>
            <i data-lucide="calendar-plus" style={{ width:17, height:17, strokeWidth:2.2 }}/>Add to iPhone Calendar
          </button>
        </div>
        <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:E.fg3, margin:'16px 16px 0' }}>More options</div>
        <RowCard>
          <PickerRow icon="calendar-plus" label="Google Calendar" sub="Opens in your browser"/>
          <PickerRow icon="calendar-plus" label="Outlook" sub="Opens in your browser"/>
          <PickerRow icon="download" label="Download .ics file" sub="Works with any calendar app" last/>
        </RowCard>
        <Caption>We'll add the event with the join link and a reminder.</Caption>
      </Body>
      <DoneBar/>
    </Phone>
  );
}

// ─── FRAME 3 · .ICS GENERATING (skeleton) ───────────────────────────────────

function FrameGenerating() {
  return (
    <Phone label="Add to calendar · Generating">
      <SheetHeader/>
      <RecapChip/>
      <Body>
        <RowCard>
          <PickerRow icon="calendar" label="Apple Calendar" sub="Save to your iPhone"/>
          <PickerRow icon="calendar-plus" label="Google Calendar" sub="Opens in your browser"/>
          <PickerRow icon="calendar-plus" label="Outlook" sub="Opens in your browser"/>
          <PickerRow icon="download" label="Download .ics file" state="skeleton" last/>
        </RowCard>
        <Caption>We'll add the event with the join link and a reminder.</Caption>
      </Body>
      <DoneBar/>
    </Phone>
  );
}

// ─── FRAME 4 · ADDED SUCCESS (morph) ────────────────────────────────────────

function FrameAdded() {
  return (
    <Phone label="Add to calendar · Added">
      <SheetHeader/>
      <RecapChip/>
      <Body>
        <RowCard>
          <PickerRow icon="calendar" label="Added to Apple Calendar" sub="With a reminder 10 minutes before" state="done"/>
          <PickerRow icon="calendar-plus" label="Google Calendar" sub="Opens in your browser"/>
          <PickerRow icon="calendar-plus" label="Outlook" sub="Opens in your browser"/>
          <PickerRow icon="download" label="Download .ics file" sub="Works with any calendar app" last/>
        </RowCard>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, margin:'12px 16px 0' }}>
          <i data-lucide="check-circle-2" style={{ width:13, height:13, color:SUCCESS, flexShrink:0 }}/>
          <span style={{ fontSize:11, color:E.fg3, fontWeight:600 }}>Added — closing in a moment</span>
        </div>
      </Body>
      <DoneBar/>
    </Phone>
  );
}

// ─── FRAME 5 · MULTI-CALENDAR PICKER (second level) ─────────────────────────

function FrameMultiCalendar() {
  return (
    <Phone label="Add to calendar · Pick calendar">
      <SheetHeader title="Choose a calendar" back/>
      <div style={{ margin:'6px 16px 0', fontSize:11.5, color:E.fg3, lineHeight:'16px' }}>Where should we add it on this iPhone?</div>
      <Body>
        <RowCard>
          <PickerRow dot="#0284c7" label="Personal" sub="maya@gmail.com" selected/>
          <PickerRow dot="#7c3aed" label="Work" sub="maya@acme.com"/>
          <PickerRow dot="#16a34a" label="Family" sub="Shared · 3 people" last/>
        </RowCard>
        <Caption>We'll add the event with the join link and a reminder.</Caption>
      </Body>
      <div style={{ flexShrink:0, marginTop:'auto', borderTop:`1px solid ${E.border}`, padding:'10px 14px 18px' }}>
        <button style={{
          width:'100%', height:46, borderRadius:12, border:'none', cursor:'pointer',
          background:ACCENT, color:'#fff', fontSize:14, fontWeight:700, letterSpacing:-0.1,
          boxShadow:'0 6px 16px rgba(2,132,199,0.28)', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7,
        }}>
          <i data-lucide="calendar-plus" style={{ width:16, height:16, strokeWidth:2.2 }}/>Add to Personal
        </button>
      </div>
    </Phone>
  );
}

Object.assign(window, { FrameWebDefault, FrameNative, FrameGenerating, FrameAdded, FrameMultiCalendar });
