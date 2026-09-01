// Pantopus — Calendarly · Date + time slot picker (full screen) — 8 frames
// Archetype: SlotCalendar — calendar + slots STACK in one scroll (not a wizard
// split). Reached from the Booking landing after an event-type pick, via a
// single-type deep link, and from the reschedule CTA on Manage your booking.
// Mirrors A12.11 Support Train's weekday/time grid + A10.9 slot rows and Home
// calendar's month strip.
//
// Non-negotiables: sky #0284C7 on functional chrome; accent follows the host's
// pillar for today / selected (Personal sky here). White cards, 1px border,
// 16px radius, shadow-sm, no left accents. Lucide stroke-2, no emoji. Voice
// plainspoken, second person, verbs-first, sentence case, no exclamations.
// Every day is a real button with a full aria-label; cells are generous.
//
// Frames: loading · day-with-slots (default) · fully-booked · no-availability ·
// tz/DST hint · slot-just-taken · reschedule · reschedule-cutoff.

const { E, SH } = window;

const ACCENT = E.blue600;        // host pillar = Personal sky
const ACCENT_SOFT = E.blue50;
const INFO_BG = '#F0F9FF', INFO = '#0369A1', INFO_BORDER = '#BAE6FD';
const WARN_BG = '#FFFBEB', WARN = '#B45309', WARN_BORDER = '#FDE68A';
const WK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHNAMES = { 6: 'June' };

// June 2026: Jun 1 = Monday (grid index 1). Today = Jun 13 (Sat).
const TODAY = 13;
const AVAILABLE = [15, 16, 17, 18, 19, 22, 23, 24, 25, 26, 29, 30];

// ─── Phone shell ──────────────────────────────────────────────────────────

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
      background:E.surface, borderBottom:`1px solid ${E.border}`, flexShrink:0,
    }}>
      <button style={{
        width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center',
        background:'transparent', border:'none', cursor:'pointer', color:E.fg1, padding:0,
      }}><i data-lucide="chevron-left" style={{ width:20, height:20 }}/></button>
      <div style={{ flex:1, textAlign:'center', fontSize:15, fontWeight:600, color:E.fg1, letterSpacing:-0.2 }}>Pick a time</div>
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
        <div style={{ flex:1, overflow:'auto', padding:'12px 14px', display:'flex', flexDirection:'column', gap:12 }}>
          {children}
        </div>
        {footer}
        <div style={{
          position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)',
          width:100, height:4, borderRadius:4, background:'rgba(0,0,0,0.22)', zIndex:60,
        }}/>
      </div>
    </div>
  );
}

// ─── Summary header (event type + timezone chip) ──────────────────────────

function SummaryHeader({ tzHint }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <div style={{
        display:'flex', alignItems:'center', gap:11, padding:'11px 12px',
        background:E.surface, border:`1px solid ${E.border}`, borderRadius:16,
        boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{
          width:34, height:34, borderRadius:9, flexShrink:0, background:ACCENT_SOFT, color:ACCENT,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}><i data-lucide="video" style={{ width:16, height:16, strokeWidth:2 }}/></div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13.5, fontWeight:600, color:E.fg1, letterSpacing:-0.1 }}>Intro call</div>
          <div style={{ fontSize:11, color:E.fg3, marginTop:1 }}>30 min · with Maria Kessler</div>
        </div>
      </div>

      <button style={{
        display:'inline-flex', alignItems:'center', gap:7, alignSelf:'flex-start', padding:'7px 11px',
        background:E.surface, border:`1px solid ${E.border}`, borderRadius:9999, cursor:'pointer',
        color:E.fg2, fontSize:11.5, fontWeight:600, letterSpacing:-0.05, whiteSpace:'nowrap',
      }}>
        <i data-lucide="globe" style={{ width:13, height:13, color:E.fg3 }}/>
        Times shown in PDT
        <i data-lucide="chevron-down" style={{ width:13, height:13, color:E.fg4 }}/>
      </button>

      {tzHint && (
        <div style={{
          display:'flex', alignItems:'flex-start', gap:8, padding:'9px 11px',
          background:INFO_BG, border:`1px solid ${INFO_BORDER}`, borderRadius:11,
        }}>
          <i data-lucide="info" style={{ width:13, height:13, color:INFO, flexShrink:0, marginTop:1 }}/>
          <span style={{ fontSize:11, color:INFO, fontWeight:500, lineHeight:'15px' }}>
            Clocks change this weekend — times are adjusted.
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Month calendar ───────────────────────────────────────────────────────

function MonthCalendar({ month = 6, year = 2026, firstWeekday = 1, days = 30,
  selected, available = AVAILABLE, today = TODAY, disabled, allMuted }) {
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  const mName = MONTHNAMES[month] || 'June';

  return (
    <div style={{
      background:E.surface, border:`1px solid ${E.border}`, borderRadius:16,
      boxShadow:'0 1px 3px rgba(0,0,0,0.04)', padding:'12px 12px 14px', opacity: disabled ? 0.55 : 1,
    }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, padding:'0 2px' }}>
        <div style={{ fontSize:13.5, fontWeight:700, color:E.fg1, letterSpacing:-0.2 }}>{mName} {year}</div>
        <div style={{ display:'flex', alignItems:'center', gap:2 }}>
          {!allMuted && (
            <button style={{
              background:'transparent', border:'none', cursor:'pointer', padding:'4px 6px',
              color:ACCENT, fontSize:11, fontWeight:700, letterSpacing:-0.05,
            }}>Next available</button>
          )}
          <button aria-label="Previous month" style={{ width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'none', cursor:'pointer', color:E.fg3, padding:0 }}><i data-lucide="chevron-left" style={{ width:17, height:17 }}/></button>
          <button aria-label="Next month" style={{ width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'none', cursor:'pointer', color:E.fg3, padding:0 }}><i data-lucide="chevron-right" style={{ width:17, height:17 }}/></button>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:1, marginBottom:4 }}>
        {WK.map((w, i) => (
          <div key={i} style={{ textAlign:'center', fontSize:9.5, fontWeight:700, color:E.fg4, padding:'2px 0' }}>{w}</div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gridAutoRows:'36px', gap:1 }}>
        {cells.map((d, i) => {
          if (d == null) return <div key={i}/>;
          const isAvail = !allMuted && available.includes(d);
          const sel = d === selected;
          const isToday = d === today;
          const label = sel ? `${mName} ${d}, selected`
            : isAvail ? `${mName} ${d}, times available`
            : isToday ? `Today, ${mName} ${d}`
            : `${mName} ${d}, no availability`;
          return (
            <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
              <button
                aria-label={label}
                disabled={!isAvail && !sel}
                style={{
                  width:34, height:34, borderRadius:'50%', padding:0, position:'relative',
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                  background: sel ? ACCENT : 'transparent',
                  border: isToday && !sel ? `1.5px solid ${ACCENT}` : '1.5px solid transparent',
                  cursor: (isAvail || sel) ? 'pointer' : 'default',
                }}>
                <span style={{
                  fontSize:13, lineHeight:1, fontVariantNumeric:'tabular-nums',
                  fontWeight: sel || isToday ? 700 : isAvail ? 600 : 500,
                  color: sel ? '#fff' : isToday ? ACCENT : isAvail ? E.fg1 : E.fg4,
                }}>{d}</span>
                {isAvail && !sel && (
                  <span style={{ position:'absolute', bottom:4, width:4, height:4, borderRadius:'50%', background:ACCENT }}/>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Slot rows ────────────────────────────────────────────────────────────

function SlotGroupLabel({ children }) {
  return (
    <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:E.fg3, padding:'2px 2px 0' }}>{children}</div>
  );
}

function SlotRow({ time, chosen, hostHint, taken, disabled }) {
  const border = chosen ? `1.5px solid ${ACCENT}` : `1px solid ${E.border}`;
  return (
    <button
      disabled={taken || disabled}
      aria-label={taken ? `${time}, just taken` : `${time}${hostHint ? ', ' + hostHint : ''}`}
      style={{
        width:'100%', display:'flex', alignItems:'center', gap:10, textAlign:'left',
        background: chosen ? ACCENT_SOFT : E.surface, border, borderRadius:12,
        padding:'11px 13px', cursor: (taken || disabled) ? 'not-allowed' : 'pointer',
        boxShadow: chosen ? `0 0 0 3px rgba(2,132,199,0.10)` : '0 1px 2px rgba(0,0,0,0.03)',
        opacity: taken || disabled ? 0.55 : 1,
      }}>
      <i data-lucide="clock" style={{ width:14, height:14, color: chosen ? ACCENT : E.fg3, flexShrink:0 }}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{
          fontSize:13.5, fontWeight:700, letterSpacing:-0.1, fontVariantNumeric:'tabular-nums',
          color: taken ? E.fg4 : (chosen ? E.blue700 : E.fg1),
          textDecoration: taken ? 'line-through' : 'none',
        }}>{time}</div>
        {chosen && hostHint && (
          <div style={{ fontSize:10.5, color:E.fg3, marginTop:2 }}>{hostHint}</div>
        )}
      </div>
      {taken ? (
        <span style={{
          fontSize:9.5, fontWeight:700, letterSpacing:0.04, textTransform:'uppercase',
          color:WARN, background:WARN_BG, border:`1px solid ${WARN_BORDER}`, padding:'2px 7px', borderRadius:9999,
        }}>Just taken</span>
      ) : chosen ? (
        <i data-lucide="check-circle-2" style={{ width:18, height:18, color:ACCENT, flexShrink:0 }}/>
      ) : (
        <i data-lucide="chevron-right" style={{ width:17, height:17, color:E.fg4, flexShrink:0 }}/>
      )}
    </button>
  );
}

function DayHeading({ children }) {
  return (
    <div style={{ fontSize:13, fontWeight:700, color:E.fg1, letterSpacing:-0.1, padding:'2px 2px 0' }}>{children}</div>
  );
}

// ─── Quiet inline notice (fully booked / no availability) ─────────────────

function QuietNotice({ icon, title, body, linkLabel, big }) {
  return (
    <div style={{
      background:E.surface, border:`1px dashed ${E.borderStrong}`, borderRadius:16,
      padding: big ? '32px 22px' : '24px 20px',
      display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', gap:9,
    }}>
      <div style={{
        width: big ? 52 : 44, height: big ? 52 : 44, borderRadius:'50%', background:E.sunken, color:E.fg3,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}><i data-lucide={icon} style={{ width: big ? 24 : 20, height: big ? 24 : 20, strokeWidth:1.85 }}/></div>
      <div style={{ fontSize:14, fontWeight:600, color:E.fg1, letterSpacing:-0.15 }}>{title}</div>
      {body && <div style={{ fontSize:12, color:E.fg3, lineHeight:'17px', maxWidth:210 }}>{body}</div>}
      {linkLabel && (
        <button style={{
          marginTop:2, display:'inline-flex', alignItems:'center', gap:5, background:'transparent', border:'none',
          padding:'4px 6px', cursor:'pointer', color:ACCENT, fontSize:12.5, fontWeight:700, letterSpacing:-0.05,
        }}>
          {linkLabel}
          <i data-lucide="arrow-right" style={{ width:13, height:13, strokeWidth:2.4 }}/>
        </button>
      )}
    </div>
  );
}

// ─── Banners ──────────────────────────────────────────────────────────────

function Banner({ tone = 'info', icon, title, body }) {
  const t = tone === 'warn'
    ? { bg:WARN_BG, fg:WARN, bd:WARN_BORDER, sub:'#92400e' }
    : { bg:INFO_BG, fg:INFO, bd:INFO_BORDER, sub:'#0c4a6e' };
  return (
    <div style={{
      display:'flex', alignItems:'flex-start', gap:10, padding:'11px 12px',
      background:t.bg, border:`1px solid ${t.bd}`, borderRadius:14,
    }}>
      <i data-lucide={icon} style={{ width:15, height:15, color:t.fg, flexShrink:0, marginTop:1, strokeWidth:2.2 }}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:700, color:t.sub, letterSpacing:-0.1, lineHeight:'16px' }}>{title}</div>
        {body && <div style={{ fontSize:11, color:t.fg, marginTop:2, lineHeight:'15px' }}>{body}</div>}
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────

function Sk({ w, h, r = 8, style }) {
  return <div style={{ width:w, height:h, borderRadius:r, ...SH, ...style }}/>;
}

// ─── FRAME 1 · LOADING ────────────────────────────────────────────────────

function FrameLoading() {
  return (
    <Phone label="Slot picker · Loading">
      <SummaryHeader/>
      <MonthCalendar selected={17}/>
      <DayHeading>Wednesday, Jun 17</DayHeading>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        <Sk w="100%" h={44} r={12}/>
        <Sk w="100%" h={44} r={12}/>
        <Sk w="100%" h={44} r={12}/>
        <Sk w="100%" h={44} r={12}/>
      </div>
    </Phone>
  );
}

// ─── FRAME 2 · DAY WITH SLOTS (default) ───────────────────────────────────

function FrameDay() {
  return (
    <Phone label="Slot picker · Day with slots">
      <SummaryHeader/>
      <MonthCalendar selected={17}/>
      <DayHeading>Wednesday, Jun 17</DayHeading>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        <SlotGroupLabel>Morning</SlotGroupLabel>
        <SlotRow time="9:00 AM"/>
        <SlotRow time="9:30 AM" chosen hostHint="12:30 PM for Maria"/>
        <SlotRow time="10:00 AM"/>
        <SlotRow time="11:30 AM"/>
        <SlotGroupLabel>Afternoon</SlotGroupLabel>
        <SlotRow time="1:00 PM"/>
        <SlotRow time="2:30 PM"/>
      </div>
    </Phone>
  );
}

// ─── FRAME 3 · FULLY BOOKED ───────────────────────────────────────────────

function FrameFullyBooked() {
  return (
    <Phone label="Slot picker · Fully booked">
      <SummaryHeader/>
      <MonthCalendar selected={18}/>
      <DayHeading>Thursday, Jun 18</DayHeading>
      <QuietNotice
        icon="calendar-x"
        title="No times left this day"
        body="Every slot on this day is booked."
        linkLabel="See next available"
      />
    </Phone>
  );
}

// ─── FRAME 4 · NO AVAILABILITY IN MONTH ───────────────────────────────────

function FrameNoMonth() {
  return (
    <Phone label="Slot picker · No availability">
      <SummaryHeader/>
      <MonthCalendar allMuted available={[]} selected={null} today={null}/>
      <QuietNotice
        big
        icon="calendar-off"
        title="Nothing open in June"
        body="Maria has no times this month."
        linkLabel="Jump to next available"
      />
    </Phone>
  );
}

// ─── FRAME 5 · TZ / DST HINT ──────────────────────────────────────────────

function FrameTzHint() {
  return (
    <Phone label="Slot picker · Timezone hint">
      <SummaryHeader tzHint/>
      <MonthCalendar selected={20}/>
      <DayHeading>Saturday, Jun 20</DayHeading>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        <SlotGroupLabel>Morning</SlotGroupLabel>
        <SlotRow time="9:00 AM"/>
        <SlotRow time="10:30 AM"/>
        <SlotGroupLabel>Afternoon</SlotGroupLabel>
        <SlotRow time="1:30 PM"/>
        <SlotRow time="3:00 PM"/>
      </div>
    </Phone>
  );
}

// ─── FRAME 6 · SLOT JUST TAKEN (race) ─────────────────────────────────────

function FrameTaken() {
  return (
    <Phone
      label="Slot picker · Slot just taken"
      footer={
        <div style={{
          position:'absolute', left:0, right:0, bottom:0, padding:'12px 16px 22px', zIndex:15,
          display:'flex', justifyContent:'center', pointerEvents:'none',
        }}>
          <div style={{
            display:'inline-flex', alignItems:'center', gap:8, padding:'10px 14px', borderRadius:12,
            background:WARN_BG, border:`1px solid ${WARN_BORDER}`, boxShadow:'0 8px 24px rgba(180,83,9,0.18)',
          }}>
            <i data-lucide="triangle-alert" style={{ width:15, height:15, color:WARN, strokeWidth:2.2 }}/>
            <span style={{ fontSize:12.5, fontWeight:700, color:WARN, letterSpacing:-0.1 }}>That time was just taken</span>
          </div>
        </div>
      }
    >
      <SummaryHeader/>
      <MonthCalendar selected={17}/>
      <DayHeading>Wednesday, Jun 17</DayHeading>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        <SlotGroupLabel>Morning</SlotGroupLabel>
        <SlotRow time="9:00 AM"/>
        <SlotRow time="9:30 AM" taken/>
        <SlotRow time="10:00 AM"/>
        <SlotRow time="11:30 AM"/>
      </div>
    </Phone>
  );
}

// ─── FRAME 7 · RESCHEDULE MODE ────────────────────────────────────────────

function FrameReschedule() {
  return (
    <Phone label="Slot picker · Reschedule">
      <Banner tone="info" icon="calendar-clock"
        title="Currently booked for Wed, Jun 17 at 9:30 AM"
        body="Pick a new time below — your old slot is released once you confirm."/>
      <SummaryHeader/>
      <MonthCalendar selected={24}/>
      <DayHeading>Wednesday, Jun 24</DayHeading>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        <SlotGroupLabel>Morning</SlotGroupLabel>
        <SlotRow time="9:00 AM"/>
        <SlotRow time="10:00 AM" chosen hostHint="1:00 PM for Maria"/>
        <SlotGroupLabel>Afternoon</SlotGroupLabel>
        <SlotRow time="2:00 PM"/>
      </div>
    </Phone>
  );
}

// ─── FRAME 8 · RESCHEDULE CUTOFF (blocked) ────────────────────────────────

function FrameCutoff() {
  return (
    <Phone
      label="Slot picker · Reschedule cutoff"
      footer={
        <div style={{
          position:'absolute', left:0, right:0, bottom:0, zIndex:15,
          background:'rgba(255,255,255,0.97)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
          borderTop:`1px solid ${E.border}`, padding:'10px 16px 20px',
        }}>
          <button style={{
            width:'100%', height:44, borderRadius:12, cursor:'pointer', letterSpacing:-0.1,
            background:E.surface, border:`1px solid ${E.border}`, color:E.fg1, fontSize:13.5, fontWeight:700,
            display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7,
          }}>
            <i data-lucide="message-square" style={{ width:15, height:15 }}/>
            Message host
          </button>
        </div>
      }
    >
      <Banner tone="warn" icon="lock"
        title="This booking can't be moved anymore"
        body="It's past the reschedule cutoff. Message Maria if you need to change it."/>
      <div style={{ pointerEvents:'none' }}>
        <SummaryHeader/>
      </div>
      <div style={{ pointerEvents:'none', marginTop:12 }}>
        <MonthCalendar selected={17} disabled/>
      </div>
      <DayHeading>Wednesday, Jun 17</DayHeading>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        <SlotRow time="9:00 AM" disabled/>
        <SlotRow time="9:30 AM" disabled/>
      </div>
    </Phone>
  );
}

Object.assign(window, {
  FrameLoading, FrameDay, FrameFullyBooked, FrameNoMonth,
  FrameTzHint, FrameTaken, FrameReschedule, FrameCutoff,
});
