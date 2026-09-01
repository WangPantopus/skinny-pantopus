// §1B-3 — src/screens/gig/_components/*  · composer picker sheets
// Bottom-sheet sub-modals invoked from the Gig composer (V1 legacy uses native
// controls; these are the designed pickers the composer fields open). Each is a
// rounded-top sheet (--radius-2xl) with grab handle · title · options · apply.
// Rendered over a dimmed composer backdrop in the shared beacon-family bezel.
// 5 sheets: Deadline · Cancellation policy · Urgency · Tags · Attachment source.
// (Category picker already covered by A12.8 Frame 2 — skipped.)

// ── extra locals on top of BU (beacon-shell.jsx) ─────────────────
const GP = {
  amber:'#B45309', amberBg:'#FEF3C7',
  halo:'0 8px 18px rgba(2,132,199,0.30)',
  r2xl:20, // --radius-2xl
};

// ── scrim ────────────────────────────────────────────────────────
function Scrim() {
  return <div style={{position:'absolute', inset:0, background:'rgba(17,24,39,0.45)', zIndex:40}}/>;
}

// ── docked bottom sheet (grab handle + title + body + apply) ─────
function Sheet({ title, subtitle, children, apply }) {
  return (
    <div style={{
      position:'absolute', left:0, right:0, bottom:0, zIndex:45,
      background:BU.surface, borderTopLeftRadius:GP.r2xl, borderTopRightRadius:GP.r2xl,
      boxShadow:'0 -8px 30px rgba(17,24,39,0.22)', overflow:'hidden',
      display:'flex', flexDirection:'column', maxHeight:'88%',
    }}>
      <div style={{display:'flex', justifyContent:'center', paddingTop:8, paddingBottom:2, flexShrink:0}}>
        <div style={{width:38, height:5, borderRadius:9999, background:BU.borderStrong}}/>
      </div>
      <div style={{padding:'10px 20px 0', flexShrink:0}}>
        <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10}}>
          <div>
            <h2 style={{margin:0, fontSize:17, fontWeight:700, color:BU.fg1, letterSpacing:-0.3}}>{title}</h2>
            {subtitle && <p style={{margin:'3px 0 0', fontSize:12.5, color:BU.fg3, letterSpacing:-0.05, lineHeight:'17px'}}>{subtitle}</p>}
          </div>
          <button aria-label="Close" style={{
            width:30, height:30, borderRadius:'50%', border:'none', background:BU.sunken,
            color:BU.fg3, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
          }}>
            <i data-lucide="x" style={{width:17, height:17, strokeWidth:2.4}}/>
          </button>
        </div>
      </div>
      <div style={{padding:'16px 20px 0', overflow:'auto', flex:1, minHeight:0}}>{children}</div>
      {apply && (
        <div style={{padding:'12px 20px 18px', flexShrink:0}}>
          <button style={{
            width:'100%', height:48, border:'none', borderRadius:12, cursor:'pointer',
            background:BU.primary600, color:'#fff', fontSize:15, fontWeight:700, letterSpacing:-0.1,
            display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:GP.halo,
          }}>{apply}</button>
        </div>
      )}
    </div>
  );
}

// ── faint composer backdrop behind the scrim ─────────────────────
function fieldRow(label, value, active) {
  return (
    <div style={{marginBottom:13}}>
      <div style={{fontSize:11.5, fontWeight:600, color:BU.fg3, marginBottom:5, letterSpacing:-0.05}}>{label}</div>
      <div style={{
        height:42, borderRadius:8, border:`1px solid ${active ? BU.primary600 : BU.border}`,
        background: active ? BU.primary50 : BU.surface,
        display:'flex', alignItems:'center', padding:'0 12px',
        fontSize:13.5, color: value ? BU.fg1 : BU.fg4, letterSpacing:-0.1,
        boxShadow: active ? '0 0 0 3px rgba(2,132,199,0.12)' : 'none',
      }}>{value || 'Tap to choose'}</div>
    </div>
  );
}
function Backdrop({ active }) {
  return (
    <div style={{flex:1, display:'flex', flexDirection:'column', overflow:'hidden'}}>
      <div style={{
        height:50, flexShrink:0, background:BU.surface, borderBottom:`1px solid ${BU.border}`,
        display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px',
      }}>
        <span style={{fontSize:14, color:BU.fg3}}>Cancel</span>
        <span style={{fontSize:16, fontWeight:700, color:BU.fg1, letterSpacing:-0.2}}>New gig</span>
        <span style={{fontSize:14, fontWeight:700, color:BU.primary600}}>Post</span>
      </div>
      <div style={{flex:1, overflow:'hidden', background:BU.muted, padding:'16px 16px 0'}}>
        {fieldRow('Category', 'Moving help', active === 'category')}
        {fieldRow('Title', 'Help moving a sofa', false)}
        {fieldRow('Deadline', active === 'deadline' ? 'Sat, Jun 14 · by 6 PM' : 'Sat, Jun 14', active === 'deadline')}
        {fieldRow('Cancellation policy', 'Moderate', active === 'policy')}
        {fieldRow('Urgency', 'Urgent', active === 'urgency')}
        {fieldRow('Tags', '#moving · #weekend · #2-person', active === 'tags')}
      </div>
    </div>
  );
}

function Phone({ active, children }) {
  return (
    <BPhone>
      <Backdrop active={active}/>
      <Scrim/>
      {children}
    </BPhone>
  );
}

// ── shared bits ──────────────────────────────────────────────────
function Chip({ label, active, onAccent }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5, padding:'7px 13px', borderRadius:9999,
      fontSize:12.5, fontWeight:600, letterSpacing:-0.05, cursor:'pointer',
      background: active ? BU.primary600 : BU.sunken,
      color: active ? '#fff' : BU.fg2,
      border: active ? 'none' : `1px solid ${BU.border}`,
    }}>{label}</span>
  );
}
function Radio({ on }) {
  return (
    <div style={{
      width:22, height:22, borderRadius:'50%', flexShrink:0,
      border:`2px solid ${on ? BU.primary600 : BU.borderStrong}`,
      background: on ? BU.primary600 : 'transparent',
      display:'flex', alignItems:'center', justifyContent:'center',
    }}>
      {on && <i data-lucide="check" style={{width:13, height:13, strokeWidth:3.4, color:'#fff'}}/>}
    </div>
  );
}
function Switch({ on }) {
  return (
    <div style={{
      width:48, height:29, borderRadius:9999, flexShrink:0,
      background: on ? BU.primary600 : BU.borderStrong, padding:2, boxSizing:'border-box',
      display:'flex', justifyContent: on ? 'flex-end' : 'flex-start', alignItems:'center',
    }}>
      <div style={{width:25, height:25, borderRadius:'50%', background:'#fff', boxShadow:'0 1px 3px rgba(0,0,0,0.3)'}}/>
    </div>
  );
}
function OptionCard({ icon, title, sub, on, accent }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:13, padding:'13px 14px', marginBottom:10,
      borderRadius:12, cursor:'pointer',
      border:`1.5px solid ${on ? BU.primary600 : BU.border}`,
      background: on ? BU.primary50 : BU.surface,
    }}>
      {icon && (
        <div style={{
          width:38, height:38, borderRadius:10, flexShrink:0,
          background: accent ? accent.bg : BU.sunken, color: accent ? accent.fg : BU.fg2,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <i data-lucide={icon} style={{width:19, height:19, strokeWidth:2}}/>
        </div>
      )}
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize:14.5, fontWeight:600, color:BU.fg1, letterSpacing:-0.2}}>{title}</div>
        {sub && <div style={{fontSize:12, color:BU.fg3, marginTop:2, letterSpacing:-0.05, lineHeight:'16px'}}>{sub}</div>}
      </div>
      <Radio on={on}/>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  SHEET 1 — DEADLINE / DATE PICKER
// ════════════════════════════════════════════════════════════════
const WEEKDAYS = ['S','M','T','W','T','F','S'];
function FrameSheetDeadline() {
  // June 2026 — Jun 1 is a Monday → 1 leading blank (Sunday-start)
  const cells = [null, ...Array.from({length:30}, (_, i) => i + 1)];
  return (
    <Phone active="deadline">
      <Sheet title="Deadline" subtitle="When do you need this done?" apply="Set deadline · Sat, Jun 14">
        <div style={{display:'flex', gap:8, marginBottom:18, flexWrap:'wrap'}}>
          <Chip label="Today"/>
          <Chip label="Tomorrow"/>
          <Chip label="This weekend" active/>
          <Chip label="Flexible"/>
        </div>

        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10}}>
          <span style={{fontSize:14, fontWeight:700, color:BU.fg1, letterSpacing:-0.2}}>June 2026</span>
          <div style={{display:'flex', gap:6}}>
            <button style={{width:30, height:30, borderRadius:8, border:`1px solid ${BU.border}`, background:BU.surface, color:BU.fg3, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center'}}>
              <i data-lucide="chevron-left" style={{width:17, height:17}}/>
            </button>
            <button style={{width:30, height:30, borderRadius:8, border:`1px solid ${BU.border}`, background:BU.surface, color:BU.fg2, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center'}}>
              <i data-lucide="chevron-right" style={{width:17, height:17}}/>
            </button>
          </div>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:'2px 0', marginBottom:4}}>
          {WEEKDAYS.map((d, i) => (
            <div key={i} style={{textAlign:'center', fontSize:11, fontWeight:700, color:BU.fg4, padding:'4px 0'}}>{d}</div>
          ))}
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:'4px 0'}}>
          {cells.map((n, i) => {
            const selected = n === 14;
            const today = n === 1;
            const past = n != null && n < 1; // none past in this month
            return (
              <div key={i} style={{display:'flex', justifyContent:'center'}}>
                {n == null ? <div style={{width:36, height:36}}/> : (
                  <div style={{
                    width:36, height:36, borderRadius:'50%',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:13.5, fontWeight: selected ? 700 : 500,
                    color: selected ? '#fff' : today ? BU.primary600 : BU.fg1,
                    background: selected ? BU.primary600 : 'transparent',
                    border: today && !selected ? `1.5px solid ${BU.primary300 || '#7dd3fc'}` : 'none',
                    boxShadow: selected ? GP.halo : 'none',
                  }}>{n}</div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:10,
          marginTop:16, padding:'12px 14px', borderRadius:12, border:`1px solid ${BU.border}`, background:BU.muted,
        }}>
          <div style={{display:'flex', alignItems:'center', gap:9}}>
            <i data-lucide="clock" style={{width:17, height:17, color:BU.fg3}}/>
            <span style={{fontSize:13.5, fontWeight:600, color:BU.fg1, letterSpacing:-0.1}}>By a specific time</span>
          </div>
          <span style={{fontSize:13.5, fontWeight:700, color:BU.primary600}}>6:00 PM</span>
        </div>
      </Sheet>
    </Phone>
  );
}

// ════════════════════════════════════════════════════════════════
//  SHEET 2 — CANCELLATION POLICY
// ════════════════════════════════════════════════════════════════
function FrameSheetPolicy() {
  return (
    <Phone active="policy">
      <Sheet title="Cancellation policy" subtitle="What happens if the booking is called off." apply="Save policy">
        <OptionCard title="Flexible" sub="Full refund up to 24 hours before the start time."/>
        <OptionCard title="Moderate" sub="50% refund up to 48 hours before. No refund after." on/>
        <OptionCard title="Strict" sub="No refund within 7 days of the start time."/>
        <div style={{
          display:'flex', gap:9, alignItems:'flex-start', marginTop:4, padding:'11px 13px',
          borderRadius:10, background:BU.primary50, color:BU.primary700,
        }}>
          <i data-lucide="info" style={{width:15, height:15, strokeWidth:2.2, flexShrink:0, marginTop:1}}/>
          <span style={{fontSize:11.5, lineHeight:'16px', letterSpacing:-0.02}}>Most neighbors pick Moderate — it protects you without scaring off bidders.</span>
        </div>
      </Sheet>
    </Phone>
  );
}

// ════════════════════════════════════════════════════════════════
//  SHEET 3 — URGENCY TOGGLE
// ════════════════════════════════════════════════════════════════
function FrameSheetUrgency() {
  return (
    <Phone active="urgency">
      <Sheet title="Urgency" subtitle="Boost a time-sensitive gig to the top." apply="Apply">
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
          padding:'15px 16px', borderRadius:12, border:`1.5px solid ${BU.primary600}`, background:BU.primary50,
        }}>
          <div style={{flex:1, minWidth:0}}>
            <div style={{display:'flex', alignItems:'center', gap:7}}>
              <i data-lucide="zap" style={{width:17, height:17, color:GP.amber, strokeWidth:2.4, fill:GP.amber}}/>
              <span style={{fontSize:15, fontWeight:700, color:BU.fg1, letterSpacing:-0.2}}>Mark as urgent</span>
            </div>
            <div style={{fontSize:12, color:BU.fg3, marginTop:3, letterSpacing:-0.05, lineHeight:'16px'}}>Pinned higher in the feed and flagged with an urgent badge.</div>
          </div>
          <Switch on/>
        </div>

        <div style={{marginTop:14, fontSize:11.5, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:BU.fg4, marginBottom:9}}>How soon</div>
        <div style={{display:'flex', gap:8}}>
          <div style={{flex:1}}><Chip label="Within hours" active/></div>
          <div style={{flex:1}}><Chip label="Today"/></div>
          <div style={{flex:1}}><Chip label="This week"/></div>
        </div>

        <div style={{
          display:'flex', gap:9, alignItems:'center', marginTop:16, padding:'11px 13px',
          borderRadius:10, background:GP.amberBg, color:GP.amber,
        }}>
          <i data-lucide="megaphone" style={{width:16, height:16, strokeWidth:2.2, flexShrink:0}}/>
          <span style={{fontSize:11.5, lineHeight:'16px', letterSpacing:-0.02, fontWeight:600}}>Urgent gigs get a visibility boost · +$2 promotion fee.</span>
        </div>
      </Sheet>
    </Phone>
  );
}

// ════════════════════════════════════════════════════════════════
//  SHEET 4 — TAGS INPUT
// ════════════════════════════════════════════════════════════════
function TagChip({ label, removable }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5, padding:'6px 8px 6px 11px', borderRadius:9999,
      fontSize:12.5, fontWeight:600, letterSpacing:-0.05,
      background:BU.primary600, color:'#fff',
    }}>
      {label}
      {removable && <i data-lucide="x" style={{width:13, height:13, strokeWidth:2.6, opacity:0.85}}/>}
    </span>
  );
}
function FrameSheetTags() {
  const suggested = ['#heavy-lifting','#truck-needed','#furniture','#1-hour','#stairs','#tip-included'];
  return (
    <Phone active="tags">
      <Sheet title="Tags" subtitle="Help the right neighbors find this gig." apply="Add 3 tags">
        <div style={{
          minHeight:48, borderRadius:10, border:`1.5px solid ${BU.primary600}`, background:BU.surface,
          padding:'9px 11px', display:'flex', flexWrap:'wrap', gap:7, alignItems:'center',
          boxShadow:'0 0 0 3px rgba(2,132,199,0.12)',
        }}>
          <TagChip label="#moving" removable/>
          <TagChip label="#weekend" removable/>
          <TagChip label="#2-person" removable/>
          <span style={{fontSize:13.5, color:BU.fg4, letterSpacing:-0.1}}>Add a tag…</span>
        </div>

        <div style={{marginTop:18, fontSize:11.5, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:BU.fg4, marginBottom:10}}>Suggested for moving</div>
        <div style={{display:'flex', flexWrap:'wrap', gap:9}}>
          {suggested.map((t) => (
            <span key={t} style={{
              display:'inline-flex', alignItems:'center', gap:5, padding:'7px 12px', borderRadius:9999,
              fontSize:12.5, fontWeight:600, letterSpacing:-0.05, cursor:'pointer',
              background:BU.surface, color:BU.fg2, border:`1px solid ${BU.borderStrong}`,
            }}>
              <i data-lucide="plus" style={{width:13, height:13, strokeWidth:2.6, color:BU.fg4}}/>
              {t}
            </span>
          ))}
        </div>
        <div style={{marginTop:16, fontSize:11.5, color:BU.fg4, letterSpacing:-0.02}}>Up to 5 tags · 2 remaining</div>
      </Sheet>
    </Phone>
  );
}

// ════════════════════════════════════════════════════════════════
//  SHEET 5 — ATTACHMENT SOURCE MENU (action sheet)
// ════════════════════════════════════════════════════════════════
function ActionRow({ icon, label, sub, accent }) {
  return (
    <div style={{display:'flex', alignItems:'center', gap:14, padding:'15px 16px', cursor:'pointer'}}>
      <div style={{
        width:40, height:40, borderRadius:11, flexShrink:0,
        background:accent.bg, color:accent.fg,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <i data-lucide={icon} style={{width:20, height:20, strokeWidth:2}}/>
      </div>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize:15.5, fontWeight:600, color:BU.fg1, letterSpacing:-0.2}}>{label}</div>
        {sub && <div style={{fontSize:12, color:BU.fg3, marginTop:1, letterSpacing:-0.05}}>{sub}</div>}
      </div>
      <i data-lucide="chevron-right" style={{width:18, height:18, color:BU.fg4}}/>
    </div>
  );
}
function FrameSheetAttachment() {
  return (
    <BPhone>
      <Backdrop active="category"/>
      <Scrim/>
      <div style={{position:'absolute', left:0, right:0, bottom:0, zIndex:45, padding:'0 8px 10px', boxSizing:'border-box'}}>
        <div style={{
          background:BU.surface, borderRadius:GP.r2xl, overflow:'hidden',
          boxShadow:'0 -2px 24px rgba(17,24,39,0.16)', marginBottom:8,
        }}>
          <div style={{padding:'14px 16px 12px', textAlign:'center', borderBottom:`1px solid ${BU.borderSub}`}}>
            <div style={{fontSize:13.5, fontWeight:700, color:BU.fg1, letterSpacing:-0.1}}>Add a photo or file</div>
            <div style={{fontSize:11.5, color:BU.fg3, marginTop:2}}>Up to 4 attachments · 10 MB each</div>
          </div>
          <ActionRow icon="camera" label="Take a photo" sub="Use the camera now"
            accent={{bg:BU.primary50, fg:BU.primary600}}/>
          <div style={{height:1, background:BU.borderSub, marginLeft:70}}/>
          <ActionRow icon="image" label="Photo library" sub="Choose existing photos"
            accent={{bg:'#ECFDF5', fg:BU.success}}/>
          <div style={{height:1, background:BU.borderSub, marginLeft:70}}/>
          <ActionRow icon="file-up" label="Choose a file" sub="PDF, doc, or spreadsheet"
            accent={{bg:'#EDE9FE', fg:BU.violet}}/>
        </div>
        <div style={{background:BU.surface, borderRadius:GP.r2xl, boxShadow:'0 -2px 20px rgba(17,24,39,0.10)'}}>
          <div style={{padding:'15px 16px', textAlign:'center', fontSize:15.5, fontWeight:700, color:BU.fg1, cursor:'pointer'}}>Cancel</div>
        </div>
      </div>
    </BPhone>
  );
}

Object.assign(window, {
  FrameSheetDeadline, FrameSheetPolicy, FrameSheetUrgency, FrameSheetTags, FrameSheetAttachment,
});
