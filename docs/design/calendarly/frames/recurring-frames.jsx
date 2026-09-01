// Pantopus — Calendarly · Recurring / multi-session booking setup — 5 frames
// Archetype: Wizard step inserted into the invitee picker flow, BETWEEN slot-pick
// and Review, when the event type allows recurrence. One decision lays down many
// linked slots ("every Tuesday for 6 weeks") — distinct from a package credit
// wallet.
//
// Reuses the Support Trains weekday+time-range grid + slot-row list for the
// occurrence rows, the Home calendar month strip for the series preview, and
// Review & Confirm for the summary recap. Host pillar = Personal sky on selected
// occurrences and the active CTA. Lucide stroke-2, no emoji. Every occurrence is
// a real labeled button (day, date, time, status). Voice: plainspoken, second
// person, sentence case, no exclamations.
//
// Frames: default · per-occurrence conflict · partial-series · series-summary ·
// count/interval picker open.

const { E, SH } = window;

const ACCENT = E.blue600, ACCENT_SOFT = E.blue50;
const SUCCESS = '#059669', SUCCESS_DK = '#047857', SUCCESS_BG = '#F0FDF4', SUCCESS_LIGHT = '#A7F3D0';
const WARN = '#B45309', WARN_DK = '#92400E', WARN_BG = '#FFFBEB', WARN_LIGHT = '#FDE68A';

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
      <button aria-label="Back to times" style={{ width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'none', cursor:'pointer', color:E.fg1, padding:0 }}>
        <i data-lucide="chevron-left" style={{ width:20, height:20 }}/>
      </button>
      <div style={{ flex:1, textAlign:'center', fontSize:15, fontWeight:600, color:E.fg1, letterSpacing:-0.2 }}>Set up your series</div>
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
        <div style={{ position:'absolute', top:7, left:'50%', transform:'translateX(-50%)', width:88, height:24, borderRadius:16, background:'#000', zIndex:50 }}/>
        <DarkStatusBar/>
        <TopBar/>
        <div style={{ flex:1, overflow:'auto', padding:'12px 13px 110px', display:'flex', flexDirection:'column', gap:13 }}>
          {children}
        </div>
        {footer}
        <div style={{ position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)', width:100, height:4, borderRadius:4, background:'rgba(0,0,0,0.22)', zIndex:70 }}/>
      </div>
    </div>
  );
}

function Card({ children }) {
  return <div style={{ background:E.surface, border:`1px solid ${E.border}`, borderRadius:16, boxShadow:'0 1px 3px rgba(0,0,0,0.04)', padding:'13px 13px', display:'flex', flexDirection:'column', gap:13 }}>{children}</div>;
}

function FieldLabel({ children }) {
  return <div style={{ fontSize:11, fontWeight:600, color:E.fg2, marginBottom:7, letterSpacing:-0.05 }}>{children}</div>;
}

// ─── Recurrence controls ────────────────────────────────────────────────────

function RepeatsSelect({ value = 'Weekly' }) {
  return (
    <div>
      <FieldLabel>Repeats</FieldLabel>
      <div style={{ display:'flex', alignItems:'center', gap:8, height:42, padding:'0 12px', background:E.surface, border:`1px solid ${E.border}`, borderRadius:8, boxShadow:'0 1px 2px rgba(0,0,0,0.03)' }}>
        <i data-lucide="repeat" style={{ width:15, height:15, color:ACCENT, flexShrink:0 }}/>
        <span style={{ flex:1, fontSize:13, fontWeight:600, color:E.fg1, letterSpacing:-0.1 }}>{value}</span>
        <i data-lucide="chevron-down" style={{ width:16, height:16, color:E.fg4 }}/>
      </div>
    </div>
  );
}

function WeekdayChips({ selected = 2 }) {
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return (
    <div>
      <FieldLabel>On</FieldLabel>
      <div style={{ display:'flex', gap:5 }}>
        {days.map((d, i) => {
          const on = i === selected;
          return (
            <div key={i} aria-label={`Weekday ${d}${on ? ', selected' : ''}`} style={{
              flex:1, height:32, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center',
              background: on ? ACCENT : E.surface, border:`1px solid ${on ? ACCENT : E.border}`, cursor:'pointer',
              fontSize:12, fontWeight:700, color: on ? '#fff' : E.fg3,
            }}>{d}</div>
          );
        })}
      </div>
    </div>
  );
}

function TimeChip() {
  return (
    <div>
      <FieldLabel>Time</FieldLabel>
      <div style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'8px 12px', borderRadius:9999, background:ACCENT_SOFT, border:`1px solid ${E.blue100}`, color:E.blue700, fontSize:12, fontWeight:700, cursor:'pointer' }}>
        <i data-lucide="clock" style={{ width:13, height:13 }}/>2:00 PM
        <i data-lucide="chevron-down" style={{ width:13, height:13, color:E.blue600 }}/>
      </div>
    </div>
  );
}

function CountStepper({ expanded }) {
  return (
    <div>
      <FieldLabel>How many</FieldLabel>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontSize:13, fontWeight:600, color:E.fg1, letterSpacing:-0.1 }}>for 6 sessions</span>
        <div style={{ display:'inline-flex', alignItems:'center', border:`1.5px solid ${E.border}`, borderRadius:8, overflow:'hidden', background:E.surface }}>
          <button aria-label="Fewer sessions" style={{ width:32, height:34, border:'none', background:'transparent', cursor:'pointer', color:E.fg2, display:'flex', alignItems:'center', justifyContent:'center', borderRight:`1px solid ${E.border}` }}><i data-lucide="minus" style={{ width:14, height:14 }}/></button>
          <div style={{ minWidth:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:E.fg1, fontVariantNumeric:'tabular-nums' }}>6</div>
          <button aria-label="More sessions" style={{ width:32, height:34, border:'none', background:'transparent', cursor:'pointer', color:ACCENT, display:'flex', alignItems:'center', justifyContent:'center', borderLeft:`1px solid ${E.border}` }}><i data-lucide="plus" style={{ width:14, height:14 }}/></button>
        </div>
      </div>
      {expanded && (
        <div style={{ marginTop:11, padding:'11px 11px', background:E.sunken, borderRadius:10, display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ display:'flex', gap:3, padding:3, background:E.surface, borderRadius:8, border:`1px solid ${E.border}` }}>
            {['Number of sessions', 'Until a date'].map((o, i) => (
              <button key={o} style={{ flex:1, height:30, borderRadius:6, border:'none', cursor:'pointer', background: i===0 ? ACCENT_SOFT : 'transparent', color: i===0 ? E.blue700 : E.fg3, fontSize:10.5, fontWeight:700, letterSpacing:-0.05 }}>{o}</button>
            ))}
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {[4, 6, 8, 12].map((n) => {
              const on = n === 6;
              return <button key={n} style={{ flex:1, height:34, borderRadius:8, cursor:'pointer', background: on ? ACCENT : E.surface, border:`1px solid ${on ? ACCENT : E.border}`, color: on ? '#fff' : E.fg2, fontSize:13, fontWeight:700, fontVariantNumeric:'tabular-nums' }}>{n}</button>;
            })}
          </div>
          <div style={{ fontSize:10.5, color:E.fg3, lineHeight:'14px' }}>We'll find 2:00 PM each week and flag any that's taken.</div>
        </div>
      )}
    </div>
  );
}

// ─── Series preview strip (Home calendar month strip) ───────────────────────

function SeriesStrip({ occ }) {
  return (
    <div style={{ background:E.surface, border:`1px solid ${E.border}`, borderRadius:14, boxShadow:'0 1px 2px rgba(0,0,0,0.03)', padding:'11px 8px 12px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:7, padding:'0 5px 9px' }}>
        <i data-lucide="calendar-range" style={{ width:13, height:13, color:E.fg3 }}/>
        <span style={{ fontSize:11, fontWeight:700, color:E.fg2, letterSpacing:-0.05 }}>Your 6 Tuesdays</span>
      </div>
      <div style={{ display:'flex', gap:6, overflowX:'auto', padding:'0 5px' }}>
        {occ.map((o, i) => {
          const conflict = o.status === 'conflict';
          return (
            <div key={i} style={{ flexShrink:0, width:42, display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
              <span style={{ fontSize:9, fontWeight:700, color:E.fg4, textTransform:'uppercase', letterSpacing:0.04 }}>{o.mon}</span>
              <div style={{
                width:34, height:34, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                background: conflict ? WARN_BG : ACCENT, border: conflict ? `1.5px solid ${WARN_LIGHT}` : 'none',
                color: conflict ? WARN : '#fff', fontSize:12.5, fontWeight:700, fontVariantNumeric:'tabular-nums',
              }}>{o.day}</div>
              {conflict
                ? <i data-lucide="alert-circle" style={{ width:11, height:11, color:WARN }}/>
                : <span style={{ width:5, height:5, borderRadius:'50%', background:ACCENT }}/>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Occurrence row (Support Trains slot-row) ───────────────────────────────

function OccurrenceRow({ weekday, date, time, status, removable, onPickInline }) {
  const conflict = status === 'conflict';
  const unavail = status === 'unavailable';
  return (
    <button aria-label={`${weekday} ${date}, ${time}, ${conflict ? 'needs a new time' : unavail ? 'fully booked' : 'open'}`} style={{
      width:'100%', display:'flex', alignItems:'center', gap:11, textAlign:'left',
      background:E.surface, border:`1px solid ${conflict ? WARN_LIGHT : E.border}`, borderRadius:12, padding:'10px 12px',
      cursor:'pointer', boxShadow:'0 1px 2px rgba(0,0,0,0.03)', opacity: unavail ? 0.6 : 1,
    }}>
      <div style={{ width:30, height:30, borderRadius:8, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background: conflict ? WARN_BG : unavail ? E.sunken : SUCCESS_BG, color: conflict ? WARN : unavail ? E.fg4 : SUCCESS }}>
        <i data-lucide={conflict ? 'alert-circle' : unavail ? 'calendar-x' : 'calendar-check'} style={{ width:15, height:15, strokeWidth:2 }}/>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12.5, fontWeight:700, color: unavail ? E.fg4 : E.fg1, letterSpacing:-0.1, textDecoration: unavail ? 'line-through' : 'none' }}>{weekday}, {date}</div>
        <div style={{ fontSize:10.5, color: conflict ? WARN : E.fg3, marginTop:1, fontVariantNumeric:'tabular-nums' }}>
          {conflict ? '2:00 PM is taken that week' : unavail ? 'Fully booked' : time}
        </div>
      </div>
      {conflict ? (
        <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10.5, fontWeight:700, color:ACCENT, letterSpacing:-0.05, flexShrink:0 }}>Pick another<i data-lucide="chevron-right" style={{ width:13, height:13 }}/></span>
      ) : unavail ? (
        <span style={{ fontSize:9.5, fontWeight:700, textTransform:'uppercase', letterSpacing:0.03, color:E.fg4, background:E.sunken, border:`1px solid ${E.border}`, padding:'2px 7px', borderRadius:9999, flexShrink:0 }}>Full</span>
      ) : (
        <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:0.03, color:SUCCESS_DK, background:SUCCESS_BG, border:`1px solid ${SUCCESS_LIGHT}`, padding:'2px 7px', borderRadius:9999, flexShrink:0 }}>
          <i data-lucide="check" style={{ width:10, height:10, strokeWidth:3 }}/>Open
        </span>
      )}
    </button>
  );
}

// Inline mini slot rows for resolving one occurrence's conflict.
function InlineSlotPicker() {
  return (
    <div style={{ background:WARN_BG, border:`1px solid ${WARN_LIGHT}`, borderRadius:12, padding:'10px 11px', display:'flex', flexDirection:'column', gap:8 }}>
      <div style={{ fontSize:10.5, fontWeight:700, color:WARN_DK, letterSpacing:-0.05 }}>New time for Tue, Jul 7</div>
      {['1:00 PM', '3:30 PM', '4:00 PM'].map((tm, i) => (
        <button key={i} style={{ width:'100%', display:'flex', alignItems:'center', gap:9, background:E.surface, border:`1px solid ${i===0 ? ACCENT : E.border}`, borderRadius:9, padding:'8px 11px', cursor:'pointer', boxShadow: i===0 ? `0 0 0 3px rgba(2,132,199,0.10)` : 'none' }}>
          <i data-lucide="clock" style={{ width:13, height:13, color: i===0 ? ACCENT : E.fg3, flexShrink:0 }}/>
          <span style={{ flex:1, textAlign:'left', fontSize:12.5, fontWeight:700, color: i===0 ? E.blue700 : E.fg1, fontVariantNumeric:'tabular-nums' }}>{tm}</span>
          {i===0 && <i data-lucide="check-circle-2" style={{ width:16, height:16, color:ACCENT }}/>}
        </button>
      ))}
    </div>
  );
}

function SummaryChip({ count = 6, total = '$240' }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:9, padding:'10px 12px', background:ACCENT_SOFT, border:`1px solid ${E.blue100}`, borderRadius:12 }}>
      <i data-lucide="repeat" style={{ width:15, height:15, color:ACCENT, flexShrink:0 }}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:700, color:E.blue700, letterSpacing:-0.1 }}>{count} sessions · Tue 2:00 PM</div>
        <div style={{ fontSize:10.5, color:E.fg3, marginTop:1, fontVariantNumeric:'tabular-nums' }}>Jun 16 – Jul 21 · {total} total</div>
      </div>
    </div>
  );
}

function Banner({ tone = 'warn', icon, title, body }) {
  const t = tone === 'warn' ? { bg:WARN_BG, bd:WARN_LIGHT, fg:WARN, dk:WARN_DK } : { bg:SUCCESS_BG, bd:SUCCESS_LIGHT, fg:SUCCESS, dk:SUCCESS_DK };
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'11px 12px', background:t.bg, border:`1px solid ${t.bd}`, borderRadius:12 }}>
      <i data-lucide={icon} style={{ width:16, height:16, color:t.fg, flexShrink:0, marginTop:1, strokeWidth:2.2 }}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:700, color:t.dk, letterSpacing:-0.1, lineHeight:'16px' }}>{title}</div>
        {body && <div style={{ fontSize:11, color:t.fg, marginTop:2, lineHeight:'15px' }}>{body}</div>}
      </div>
    </div>
  );
}

function Overline({ children }) {
  return <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:E.fg3, padding:'2px 2px' }}>{children}</div>;
}

function Footer({ children }) {
  return <div style={{ position:'absolute', left:0, right:0, bottom:0, zIndex:15, background:'rgba(255,255,255,0.97)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', borderTop:`1px solid ${E.border}`, padding:'10px 13px 18px', display:'flex', flexDirection:'column', gap:8 }}>{children}</div>;
}

function PrimaryCTA({ label, icon = 'arrow-right' }) {
  return <button style={{ width:'100%', height:46, borderRadius:12, border:'none', cursor:'pointer', background:ACCENT, color:'#fff', fontSize:14, fontWeight:700, letterSpacing:-0.1, boxShadow:'0 6px 16px rgba(2,132,199,0.28)', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7 }}>{label}<i data-lucide={icon} style={{ width:16, height:16, strokeWidth:2.2 }}/></button>;
}

function GhostCTA({ label }) {
  return <button style={{ width:'100%', height:42, borderRadius:12, background:E.surface, border:`1px solid ${E.border}`, color:E.fg1, fontSize:13, fontWeight:700, letterSpacing:-0.1, cursor:'pointer' }}>{label}</button>;
}

const OCC_OPEN = [
  { mon:'Jun', day:16, weekday:'Tue', date:'Jun 16', time:'2:00 – 2:30 PM', status:'open' },
  { mon:'Jun', day:23, weekday:'Tue', date:'Jun 23', time:'2:00 – 2:30 PM', status:'open' },
  { mon:'Jun', day:30, weekday:'Tue', date:'Jun 30', time:'2:00 – 2:30 PM', status:'open' },
  { mon:'Jul', day:7,  weekday:'Tue', date:'Jul 7',  time:'2:00 – 2:30 PM', status:'open' },
  { mon:'Jul', day:14, weekday:'Tue', date:'Jul 14', time:'2:00 – 2:30 PM', status:'open' },
  { mon:'Jul', day:21, weekday:'Tue', date:'Jul 21', time:'2:00 – 2:30 PM', status:'open' },
];

// ─── FRAME 1 · DEFAULT ──────────────────────────────────────────────────────

function FrameDefault() {
  return (
    <Phone label="Series · Default" footer={<Footer><PrimaryCTA label="Review 6 bookings"/></Footer>}>
      <div style={{ fontSize:11.5, color:E.fg3, lineHeight:'16px', padding:'0 2px' }}>Book the whole series in one go. We'll find the same time each week and flag any that's taken.</div>
      <Card>
        <RepeatsSelect/>
        <WeekdayChips/>
        <div style={{ display:'flex', gap:16 }}>
          <TimeChip/>
        </div>
        <CountStepper/>
      </Card>
      <SeriesStrip occ={OCC_OPEN}/>
      <Overline>All 6 open</Overline>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {OCC_OPEN.map((o, i) => <OccurrenceRow key={i} {...o}/>)}
      </div>
      <SummaryChip/>
    </Phone>
  );
}

// ─── FRAME 2 · PER-OCCURRENCE CONFLICT ──────────────────────────────────────

function FrameConflict() {
  const occ = OCC_OPEN.map((o, i) => i === 3 ? { ...o, status:'conflict' } : o);
  return (
    <Phone label="Series · Per-occurrence conflict" footer={<Footer><PrimaryCTA label="Review 6 bookings"/></Footer>}>
      <SeriesStrip occ={occ}/>
      <Overline>5 open · 1 needs a new time</Overline>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        <OccurrenceRow {...OCC_OPEN[0]}/>
        <OccurrenceRow {...OCC_OPEN[1]}/>
        <OccurrenceRow {...OCC_OPEN[2]}/>
        <OccurrenceRow {...OCC_OPEN[3]} status="conflict"/>
        <InlineSlotPicker/>
        <OccurrenceRow {...OCC_OPEN[4]}/>
        <OccurrenceRow {...OCC_OPEN[5]}/>
      </div>
      <SummaryChip/>
    </Phone>
  );
}

// ─── FRAME 3 · PARTIAL SERIES ───────────────────────────────────────────────

function FramePartial() {
  return (
    <Phone label="Series · Partial" footer={<Footer><PrimaryCTA label="Book the 4 that work"/><GhostCTA label="Adjust the series"/></Footer>}>
      <Banner tone="warn" icon="alert-circle" title="We can book 4 of 6" body="The other two weeks are full. Book the four that work, or adjust the pattern."/>
      <SeriesStrip occ={OCC_OPEN.map((o, i) => (i===3 || i===5) ? { ...o, status:'conflict' } : o)}/>
      <Overline>4 open · 2 full</Overline>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        <OccurrenceRow {...OCC_OPEN[0]}/>
        <OccurrenceRow {...OCC_OPEN[1]}/>
        <OccurrenceRow {...OCC_OPEN[2]}/>
        <OccurrenceRow {...OCC_OPEN[3]} status="unavailable"/>
        <OccurrenceRow {...OCC_OPEN[4]}/>
        <OccurrenceRow {...OCC_OPEN[5]} status="unavailable"/>
      </div>
      <SummaryChip count={4} total="$160"/>
    </Phone>
  );
}

// ─── FRAME 4 · SERIES SUMMARY (before confirm) ──────────────────────────────

function RecapRow({ weekday, date, time, last }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom: last ? 'none' : `1px solid ${E.border}` }}>
      <i data-lucide="calendar-check" style={{ width:15, height:15, color:SUCCESS, flexShrink:0 }}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12.5, fontWeight:700, color:E.fg1, letterSpacing:-0.1 }}>{weekday}, {date}</div>
        <div style={{ fontSize:10.5, color:E.fg3, marginTop:1, fontVariantNumeric:'tabular-nums' }}>{time} · $40</div>
      </div>
      <button aria-label={`Remove ${date}`} style={{ width:26, height:26, borderRadius:'50%', flexShrink:0, background:E.sunken, border:'none', cursor:'pointer', color:E.fg3, display:'flex', alignItems:'center', justifyContent:'center' }}><i data-lucide="x" style={{ width:13, height:13 }}/></button>
    </div>
  );
}

function FrameSummary() {
  return (
    <Phone label="Series · Summary" footer={<Footer><PrimaryCTA label="Confirm 6 bookings" icon="arrow-right"/></Footer>}>
      <div style={{ display:'flex', alignItems:'center', gap:9, padding:'0 2px' }}>
        <div style={{ width:34, height:34, borderRadius:9, background:ACCENT_SOFT, color:ACCENT, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i data-lucide="repeat" style={{ width:17, height:17 }}/></div>
        <div>
          <div style={{ fontSize:14, fontWeight:700, color:E.fg1, letterSpacing:-0.2 }}>6-session series</div>
          <div style={{ fontSize:11, color:E.fg3, marginTop:1 }}>Intro call · with Maria Kessler</div>
        </div>
      </div>
      <Card>
        <RecapRow weekday="Tue" date="Jun 16" time="2:00 – 2:30 PM"/>
        <RecapRow weekday="Tue" date="Jun 23" time="2:00 – 2:30 PM"/>
        <RecapRow weekday="Tue" date="Jun 30" time="2:00 – 2:30 PM"/>
        <RecapRow weekday="Tue" date="Jul 7" time="2:00 – 2:30 PM"/>
        <RecapRow weekday="Tue" date="Jul 14" time="2:00 – 2:30 PM"/>
        <RecapRow weekday="Tue" date="Jul 21" time="2:00 – 2:30 PM" last/>
      </Card>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'2px 4px' }}>
        <span style={{ fontSize:12, color:E.fg3 }}>6 sessions · $40 each</span>
        <span style={{ fontSize:18, fontWeight:800, color:ACCENT, letterSpacing:-0.4, fontVariantNumeric:'tabular-nums' }}>$240</span>
      </div>
    </Phone>
  );
}

// ─── FRAME 5 · COUNT / INTERVAL PICKER OPEN ─────────────────────────────────

function FramePickerOpen() {
  return (
    <Phone label="Series · Count picker open" footer={<Footer><PrimaryCTA label="Review 6 bookings"/></Footer>}>
      <div style={{ fontSize:11.5, color:E.fg3, lineHeight:'16px', padding:'0 2px' }}>Book the whole series in one go. We'll find the same time each week and flag any that's taken.</div>
      <Card>
        <RepeatsSelect/>
        <WeekdayChips/>
        <div style={{ display:'flex', gap:16 }}>
          <TimeChip/>
        </div>
        <CountStepper expanded/>
      </Card>
      <SummaryChip/>
    </Phone>
  );
}

Object.assign(window, { FrameDefault, FrameConflict, FramePartial, FrameSummary, FramePickerOpen });
