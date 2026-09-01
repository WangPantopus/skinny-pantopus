// Pantopus — Calendarly · Timezone selector (bottom sheet) — 4 frames
// Archetype: ListOfRows in a searchable sheet (a popover/dropdown on web).
// Opens from the timezone control on the Date + time slot picker. Mirrors the
// A14 searchable settings-list (search field + checkmark rows). Invitee view —
// accent follows the host's pillar (Personal sky here) on the selected check.
//
// Non-negotiables: sky #0284C7 on functional chrome (Done, links); pillar
// accent on the selected checkmark. White surface, 1px borders, 16px sheet,
// shadow-sm, no left accents. Lucide stroke-2, no emoji. Voice plainspoken,
// sentence case, no exclamations.
//
// Frames: default · search-results · no-match · manually-overridden.

const { E, SH } = window;

const ACCENT = E.blue600;        // host pillar = Personal sky
const INFO_BG = '#F0F9FF', INFO = '#0369A1', INFO_BORDER = '#BAE6FD';

const ZONES = [
  { name:'Eastern Time — New York', off:'GMT-4', time:'5:14 PM' },
  { name:'Central Time — Chicago', off:'GMT-5', time:'4:14 PM' },
  { name:'Mountain Time — Denver', off:'GMT-6', time:'3:14 PM' },
  { name:'Pacific Time — Los Angeles', off:'GMT-7', time:'2:14 PM' },
  { name:'London — GMT', off:'GMT+1', time:'10:14 PM' },
  { name:'Central European — Paris', off:'GMT+2', time:'11:14 PM' },
];

// ─── White status bar over a dimmed app ───────────────────────────────────

function WhiteStatusBar() {
  const c = '#fff';
  return (
    <div style={{
      display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'12px 22px 0', height:34, boxSizing:'border-box', position:'relative', zIndex:30,
      fontFamily:'-apple-system, system-ui', fontWeight:600, fontSize:12.5, color:c, flexShrink:0,
    }}>
      <span>9:41</span>
      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
        <svg width="15" height="10" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={c}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={c}/><rect x="9" y="2" width="3" height="9" rx="0.6" fill={c}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={c}/></svg>
        <svg width="13" height="10" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={c}/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={c}/><circle cx="7.5" cy="9" r="1.3" fill={c}/></svg>
        <svg width="21" height="10" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={c} strokeOpacity="0.5" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill={c}/><path d="M22.5 3.8v3.4c.6-.2 1-.8 1-1.7s-.4-1.5-1-1.7z" fill={c} fillOpacity="0.5"/></svg>
      </div>
    </div>
  );
}

// ─── Dimmed slot-picker behind the sheet ──────────────────────────────────

function DimmedPicker() {
  return (
    <div style={{ position:'absolute', inset:0, background:E.bg, display:'flex', flexDirection:'column', zIndex:5 }}>
      <div style={{ height:34 }}/>
      <div style={{
        display:'flex', alignItems:'center', padding:'6px 8px', height:46, boxSizing:'border-box',
        background:E.surface, borderBottom:`1px solid ${E.border}`,
      }}>
        <i data-lucide="chevron-left" style={{ width:20, height:20, color:E.fg1 }}/>
        <div style={{ flex:1, textAlign:'center', fontSize:15, fontWeight:600, color:E.fg1, letterSpacing:-0.2 }}>Pick a time</div>
        <div style={{ width:20 }}/>
      </div>
      <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:10 }}>
        <div style={{
          display:'flex', alignItems:'center', gap:11, padding:'11px 12px',
          background:E.surface, border:`1px solid ${E.border}`, borderRadius:16,
        }}>
          <div style={{ width:34, height:34, borderRadius:9, background:E.blue50, color:E.blue600, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <i data-lucide="video" style={{ width:16, height:16 }}/>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13.5, fontWeight:600, color:E.fg1 }}>Intro call</div>
            <div style={{ fontSize:11, color:E.fg3, marginTop:1 }}>30 min · with Maria Kessler</div>
          </div>
        </div>
        <div style={{ height:150, background:E.surface, border:`1px solid ${E.border}`, borderRadius:16 }}/>
      </div>
    </div>
  );
}

// ─── Sheet shell ──────────────────────────────────────────────────────────

function SheetPhone({ label, children, scrim = 0.46 }) {
  return (
    <div style={{
      width:300, height:620, borderRadius:40, padding:8, background:'#0b0f17',
      boxShadow:'0 24px 50px rgba(17,24,39,0.20), 0 0 0 1px rgba(0,0,0,0.12)', flexShrink:0,
    }} data-screen-label={label}>
      <div style={{
        width:'100%', height:'100%', background:E.fg1, borderRadius:32,
        overflow:'hidden', position:'relative', display:'flex', flexDirection:'column',
        fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <DimmedPicker/>
        <div style={{ position:'absolute', inset:0, background:`rgba(11,15,23,${scrim})`, zIndex:10 }}/>
        <div style={{
          position:'absolute', top:7, left:'50%', transform:'translateX(-50%)',
          width:88, height:24, borderRadius:16, background:'#000', zIndex:40,
        }}/>
        <WhiteStatusBar/>
        {children}
        <div style={{
          position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)',
          width:100, height:4, borderRadius:4, background:'rgba(255,255,255,0.55)', zIndex:60,
        }}/>
      </div>
    </div>
  );
}

// ─── Sheet primitives ─────────────────────────────────────────────────────

function Grabber() {
  return (
    <div style={{ display:'flex', justifyContent:'center', padding:'9px 0 3px' }}>
      <div style={{ width:38, height:5, borderRadius:3, background:E.borderStrong }}/>
    </div>
  );
}

function SheetHeader() {
  return (
    <div style={{ display:'flex', alignItems:'center', padding:'4px 16px 10px' }}>
      <div style={{ width:48 }}/>
      <div style={{ flex:1, textAlign:'center', fontSize:15.5, fontWeight:700, color:E.fg1, letterSpacing:-0.2 }}>Time zone</div>
      <button style={{
        width:48, textAlign:'right', background:'transparent', border:'none', cursor:'pointer',
        color:ACCENT, fontSize:14.5, fontWeight:700, letterSpacing:-0.1, padding:0,
      }}>Done</button>
    </div>
  );
}

function SearchField({ value }) {
  return (
    <div style={{ padding:'0 16px 12px' }}>
      <div style={{
        display:'flex', alignItems:'center', gap:8, padding:'9px 12px',
        background:E.sunken, border:`1px solid ${E.border}`, borderRadius:10,
      }}>
        <i data-lucide="search" style={{ width:15, height:15, color:E.fg3, flexShrink:0 }}/>
        {value ? (
          <span style={{ flex:1, fontSize:13, color:E.fg1, fontWeight:500 }}>{value}</span>
        ) : (
          <span style={{ flex:1, fontSize:13, color:E.fg4 }}>Search city or time zone</span>
        )}
        {value && <i data-lucide="x" style={{ width:15, height:15, color:E.fg4, flexShrink:0 }}/>}
      </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize:9.5, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:E.fg3,
      padding:'10px 18px 6px',
    }}>{children}</div>
  );
}

// highlight a query substring (case-insensitive)
function Highlight({ text, query }) {
  if (!query) return text;
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark style={{ background:'#fde68a', color:'inherit', borderRadius:3, padding:'0 1px' }}>{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  );
}

function ZoneRow({ zone, selected, detected, query, last }) {
  return (
    <button
      aria-label={`${zone.name}, ${zone.off}, ${zone.time}${selected ? ', selected' : ''}${detected ? ', detected from your device' : ''}`}
      style={{
        width:'100%', display:'flex', alignItems:'center', gap:10, textAlign:'left', cursor:'pointer',
        background:'transparent', border:'none', padding:'11px 16px',
        borderBottom: last ? 'none' : `1px solid ${E.border}`,
      }}>
      <div style={{ width:18, flexShrink:0, display:'flex', justifyContent:'center' }}>
        {selected && <i data-lucide="check" style={{ width:18, height:18, color:ACCENT, strokeWidth:2.6 }}/>}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:13, fontWeight:600, color:E.fg1, letterSpacing:-0.1 }}>
            <Highlight text={zone.name} query={query}/>
          </span>
          {detected && (
            <span style={{
              fontSize:8.5, fontWeight:700, letterSpacing:0.04, textTransform:'uppercase',
              background:E.blue50, color:E.blue700, padding:'2px 6px', borderRadius:9999, flexShrink:0,
            }}>Detected</span>
          )}
        </div>
      </div>
      <div style={{ flexShrink:0, textAlign:'right' }}>
        <div style={{ fontSize:11.5, fontWeight:600, color:E.fg2, fontVariantNumeric:'tabular-nums' }}>{zone.off}</div>
        <div style={{ fontSize:10, color:E.fg4, fontVariantNumeric:'tabular-nums', marginTop:1 }}>{zone.time}</div>
      </div>
    </button>
  );
}

function ListCard({ children }) {
  return (
    <div style={{
      margin:'0 16px 12px', background:E.surface, border:`1px solid ${E.border}`, borderRadius:16,
      boxShadow:'0 1px 3px rgba(0,0,0,0.04)', overflow:'hidden',
    }}>{children}</div>
  );
}

function Sheet({ children, tall }) {
  return (
    <div style={{
      position:'absolute', left:0, right:0, bottom:0, top: tall ? 64 : 'auto', zIndex:20,
      maxHeight: tall ? 'none' : '82%',
      background:E.surface, borderRadius:'24px 24px 0 0',
      boxShadow:'0 -10px 40px rgba(11,15,23,0.22)',
      display:'flex', flexDirection:'column', overflow:'hidden',
    }}>
      <Grabber/>
      {children}
    </div>
  );
}

// ─── FRAME 1 · DEFAULT ────────────────────────────────────────────────────

function FrameDefault() {
  return (
    <SheetPhone label="Time zone · Default" scrim={0.5}>
      <Sheet tall>
        <SheetHeader/>
        <SearchField/>
        <div style={{ flex:1, overflow:'auto', paddingBottom:18 }}>
          <SectionLabel>Detected</SectionLabel>
          <ListCard>
            <ZoneRow zone={ZONES[3]} detected selected last/>
          </ListCard>
          <SectionLabel>Common</SectionLabel>
          <ListCard>
            {ZONES.map((z, i) => (
              <ZoneRow key={i} zone={z} selected={i === 3} last={i === ZONES.length - 1}/>
            ))}
          </ListCard>
        </div>
      </Sheet>
    </SheetPhone>
  );
}

// ─── FRAME 2 · SEARCH RESULTS ─────────────────────────────────────────────

function FrameSearch() {
  const matches = ZONES.filter(z => z.name.toLowerCase().includes('lon'));
  return (
    <SheetPhone label="Time zone · Search results" scrim={0.5}>
      <Sheet tall>
        <SheetHeader/>
        <SearchField value="lon"/>
        <div style={{ flex:1, overflow:'auto', paddingBottom:18 }}>
          <SectionLabel>Results</SectionLabel>
          <ListCard>
            {matches.map((z, i) => (
              <ZoneRow key={i} zone={z} query="lon" last={i === matches.length - 1}/>
            ))}
          </ListCard>
        </div>
      </Sheet>
    </SheetPhone>
  );
}

// ─── FRAME 3 · NO MATCH ───────────────────────────────────────────────────

function FrameNoMatch() {
  return (
    <SheetPhone label="Time zone · No match" scrim={0.5}>
      <Sheet tall>
        <SheetHeader/>
        <SearchField value="xyz"/>
        <div style={{ flex:1, overflow:'auto', padding:'24px 16px' }}>
          <div style={{
            background:E.surface, border:`1px dashed ${E.borderStrong}`, borderRadius:16,
            padding:'32px 24px', display:'flex', flexDirection:'column', alignItems:'center',
            textAlign:'center', gap:10,
          }}>
            <div style={{
              width:52, height:52, borderRadius:'50%', background:E.sunken, color:E.fg3,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}><i data-lucide="search-x" style={{ width:24, height:24, strokeWidth:1.85 }}/></div>
            <div style={{ fontSize:14.5, fontWeight:600, color:E.fg1, letterSpacing:-0.15 }}>No time zones match "xyz"</div>
            <div style={{ fontSize:12, color:E.fg3, lineHeight:'17px', maxWidth:190 }}>Try a city name.</div>
          </div>
        </div>
      </Sheet>
    </SheetPhone>
  );
}

// ─── FRAME 4 · MANUALLY OVERRIDDEN ────────────────────────────────────────

function FrameOverridden() {
  return (
    <SheetPhone label="Time zone · Overridden" scrim={0.5}>
      <Sheet tall>
        <SheetHeader/>
        <SearchField/>
        {/* override caption */}
        <div style={{ padding:'0 16px 12px' }}>
          <div style={{
            display:'flex', alignItems:'flex-start', gap:9, padding:'10px 12px',
            background:INFO_BG, border:`1px solid ${INFO_BORDER}`, borderRadius:12,
          }}>
            <i data-lucide="info" style={{ width:14, height:14, color:INFO, flexShrink:0, marginTop:1 }}/>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:11.5, color:INFO, fontWeight:600, lineHeight:'15px' }}>You changed this from your detected zone.</div>
              <button style={{
                marginTop:5, background:'transparent', border:'none', padding:0, cursor:'pointer',
                color:ACCENT, fontSize:11.5, fontWeight:700, letterSpacing:-0.05,
                display:'inline-flex', alignItems:'center', gap:4,
              }}>
                <i data-lucide="rotate-ccw" style={{ width:12, height:12, strokeWidth:2.4 }}/>
                Reset to detected
              </button>
            </div>
          </div>
        </div>
        <div style={{ flex:1, overflow:'auto', paddingBottom:18 }}>
          <SectionLabel>Detected</SectionLabel>
          <ListCard>
            <ZoneRow zone={ZONES[3]} detected last/>
          </ListCard>
          <SectionLabel>Common</SectionLabel>
          <ListCard>
            {ZONES.map((z, i) => (
              <ZoneRow key={i} zone={z} selected={i === 0} last={i === ZONES.length - 1}/>
            ))}
          </ListCard>
        </div>
      </Sheet>
    </SheetPhone>
  );
}

Object.assign(window, {
  FrameDefault, FrameSearch, FrameNoMatch, FrameOverridden,
});
