// Pantopus — Calendarly · Intake / Booking details form (full screen) — 6 frames
// Archetype: Form (A13 single-screen form shell) — the step after an invitee
// picks a time on the slot picker. Extends the web GuestSignupModal form step
// into a full public intake surface. Lives at /book/[slug]/details.
//
// Mirrors Form.html exactly: 44px inputs, 8px radius, 1px border, section
// overlines (11px/600 uppercase 0.08em), red * on required, italic helper text,
// validation vocabulary (1.5px red border + alert-circle + 11px error), and a
// sticky-bottom full-width primary CTA. Host pillar = Personal sky on focus
// rings / hold chip. Lucide stroke-2, no emoji, shimmer skeletons (never
// "Loading…"). Voice: plainspoken, second person, sentence case.
//
// Frames: default (empty) · prefilled (logged-in) · validation errors ·
// existing-account-detected · submitting · slot-expired.

const { E, SH } = window;

const ACCENT = E.blue600;          // host pillar = Personal sky
const ACCENT_SOFT = E.blue50;
const INFO_BG = '#F0F9FF', INFO = '#0369A1', INFO_BORDER = '#BAE6FD';
const WARN_BG = '#FFFBEB', WARN = '#B45309', WARN_BORDER = '#FDE68A';
const ERR = E.error, ERR_BG = E.errorBg, ERR_BORDER = '#FCA5A5';

const HOST_AV = 'linear-gradient(135deg,#38bdf8,#0369a1)';
const INV_AV = 'linear-gradient(135deg,#a78bfa,#7c3aed)';

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
      <button aria-label="Back to times" style={{
        width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center',
        background:'transparent', border:'none', cursor:'pointer', color:E.fg1, padding:0,
      }}><i data-lucide="chevron-left" style={{ width:20, height:20 }}/></button>
      <div style={{ flex:1, textAlign:'center', fontSize:15, fontWeight:600, color:E.fg1, letterSpacing:-0.2 }}>Your details</div>
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
        <div style={{ flex:1, overflow:'auto', padding:'12px 13px 96px', display:'flex', flexDirection:'column', gap:14 }}>
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

// ─── Booking summary header ─────────────────────────────────────────────────

function SummaryCard() {
  return (
    <div style={{
      background:E.surface, border:`1px solid ${E.border}`, borderRadius:16,
      boxShadow:'0 1px 3px rgba(0,0,0,0.04)', padding:'12px 13px',
      display:'flex', flexDirection:'column', gap:11,
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:11 }}>
        <div style={{
          width:36, height:36, borderRadius:'50%', flexShrink:0, background:HOST_AV,
          display:'flex', alignItems:'center', justifyContent:'center',
          color:'#fff', fontSize:13, fontWeight:700, letterSpacing:-0.3,
        }}>MK</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13.5, fontWeight:700, color:E.fg1, letterSpacing:-0.15 }}>Intro call</div>
          <div style={{ fontSize:11, color:E.fg3, marginTop:2 }}>30 min · with Maria Kessler</div>
        </div>
        <button style={{
          background:'transparent', border:'none', padding:'2px 2px', cursor:'pointer',
          color:ACCENT, fontSize:11.5, fontWeight:700, letterSpacing:-0.05, flexShrink:0,
        }}>Edit</button>
      </div>

      <div style={{ height:1, background:E.border }}/>

      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <i data-lucide="calendar" style={{ width:15, height:15, color:E.fg3, flexShrink:0 }}/>
        <span style={{ fontSize:12.5, fontWeight:600, color:E.fg1, letterSpacing:-0.1, fontVariantNumeric:'tabular-nums' }}>
          Wed, Jun 17 · 9:30&ndash;10:00 AM
        </span>
      </div>

      <button style={{
        display:'inline-flex', alignItems:'center', gap:7, alignSelf:'flex-start',
        padding:'5px 10px', borderRadius:9999, cursor:'pointer',
        background:E.blue100, border:'none', color:E.blue700,
        fontSize:11, fontWeight:600, letterSpacing:-0.05, whiteSpace:'nowrap',
      }}>
        <i data-lucide="globe" style={{ width:12, height:12, strokeWidth:2.2 }}/>
        Pacific time (PDT)
        <span style={{ color:ACCENT, fontWeight:700 }}>Change</span>
      </button>
    </div>
  );
}

// Thin slot-hold countdown row.
function HoldRow({ time = '4:32' }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'center', gap:6,
      margin:'-4px 0 0', padding:'0 2px',
    }}>
      <i data-lucide="clock" style={{ width:13, height:13, color:E.fg3, flexShrink:0 }}/>
      <span style={{ fontSize:11, color:E.fg3, fontWeight:500 }}>
        We&rsquo;re holding this time for <b style={{ color:E.fg2, fontWeight:700, fontVariantNumeric:'tabular-nums' }}>{time}</b>
      </span>
    </div>
  );
}

// ─── Form atoms (mirror Form.html) ──────────────────────────────────────────

function Overline({ children, style }) {
  return (
    <div style={{
      fontSize:11, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase',
      color:E.fg3, marginBottom:10, ...style,
    }}>{children}</div>
  );
}

function FieldLabel({ children, required }) {
  return (
    <label style={{ display:'block', fontSize:11.5, fontWeight:600, color:E.fg2, marginBottom:6, letterSpacing:-0.05 }}>
      {children}
      {required && <span style={{ color:ERR, marginLeft:3 }}>*</span>}
    </label>
  );
}

function Input({ value, placeholder, leading, state = 'default', error, helper, dimmed }) {
  const borderColor = state === 'error' ? ERR : state === 'valid' ? E.success600 : state === 'focus' ? ACCENT : E.border;
  const borderWidth = state === 'default' ? 1 : 1.5;
  const ring = state === 'focus' ? `0 0 0 3px rgba(2,132,199,0.15)` :
               state === 'error' ? `0 0 0 3px rgba(220,38,38,0.10)` :
               state === 'valid' ? `0 0 0 3px rgba(5,150,105,0.08)` : '0 1px 2px rgba(0,0,0,0.03)';
  return (
    <div style={{ opacity:dimmed?0.55:1 }}>
      <div style={{
        display:'flex', alignItems:'center', gap:7, height:44, boxSizing:'border-box',
        padding: leading ? '0 14px 0 11px' : '0 14px',
        background:E.surface, border:`${borderWidth}px solid ${borderColor}`, borderRadius:8, boxShadow:ring,
      }}>
        {leading && <span style={{ color:E.fg4, fontSize:13, fontWeight:500, flexShrink:0 }}>{leading}</span>}
        <span style={{
          flex:1, fontSize:13.5, color: value ? E.fg1 : E.fg4, fontWeight: value ? 500 : 400,
          letterSpacing:-0.1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        }}>{value || placeholder}</span>
        {state === 'valid' && <i data-lucide="check-circle-2" style={{ width:17, height:17, color:E.success600, flexShrink:0 }}/>}
        {state === 'error' && <i data-lucide="alert-circle" style={{ width:17, height:17, color:ERR, flexShrink:0 }}/>}
      </div>
      {error && (
        <div style={{ fontSize:11, color:ERR, marginTop:6, display:'flex', alignItems:'center', gap:4 }}>
          <i data-lucide="alert-circle" style={{ width:11, height:11, strokeWidth:2.3, flexShrink:0 }}/>{error}
        </div>
      )}
      {!error && helper && (
        <div style={{ fontSize:11, color:E.fg3, marginTop:6, fontStyle:'italic', lineHeight:'15px' }}>{helper}</div>
      )}
    </div>
  );
}

function Textarea({ value, placeholder, state = 'default', error, height = 78 }) {
  const borderColor = state === 'error' ? ERR : E.border;
  const borderWidth = state === 'error' ? 1.5 : 1;
  return (
    <div>
      <div style={{
        padding:'11px 14px', minHeight:height, boxSizing:'border-box',
        background:E.surface, border:`${borderWidth}px solid ${borderColor}`, borderRadius:8,
        boxShadow: state === 'error' ? `0 0 0 3px rgba(220,38,38,0.10)` : '0 1px 2px rgba(0,0,0,0.03)',
        fontSize:13.5, color: value ? E.fg1 : E.fg4, fontWeight: value ? 500 : 400,
        letterSpacing:-0.1, lineHeight:'19px',
      }}>{value || placeholder}</div>
      {error && (
        <div style={{ fontSize:11, color:ERR, marginTop:6, display:'flex', alignItems:'center', gap:4 }}>
          <i data-lucide="alert-circle" style={{ width:11, height:11, strokeWidth:2.3, flexShrink:0 }}/>{error}
        </div>
      )}
    </div>
  );
}

function Select({ value, placeholder }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', height:44, boxSizing:'border-box', padding:'0 14px',
      background:E.surface, border:`1px solid ${E.border}`, borderRadius:8, boxShadow:'0 1px 2px rgba(0,0,0,0.03)',
    }}>
      <span style={{ flex:1, fontSize:13.5, color: value ? E.fg1 : E.fg4, fontWeight: value ? 500 : 400, letterSpacing:-0.1 }}>
        {value || placeholder}
      </span>
      <i data-lucide="chevron-down" style={{ width:16, height:16, color:E.fg4, flexShrink:0 }}/>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      {children}
    </div>
  );
}

function Section({ overline, children, gap = 13 }) {
  return (
    <div>
      <Overline>{overline}</Overline>
      <div style={{ display:'flex', flexDirection:'column', gap }}>{children}</div>
    </div>
  );
}

// Schema-driven host custom questions. `errors` = which are invalid.
function HostQuestions({ errors = {}, filled }) {
  return (
    <Section overline="A few questions">
      <Field label="What should we cover?" required>
        <Textarea
          placeholder="A sentence or two helps Maria prepare."
          value={filled ? "Want to walk through the Q3 rollout and where my team can plug in." : ''}
          state={errors.cover ? 'error' : 'default'}
          error={errors.cover}
        />
      </Field>
      <Field label="Phone number" required>
        <Input
          leading="+1"
          placeholder="(555) 000-0000"
          value={filled ? "(415) 555-0142" : ''}
          state={errors.phone ? 'error' : (filled ? 'valid' : 'default')}
          error={errors.phone}
          helper={errors.phone ? undefined : "For a text reminder before the call."}
        />
      </Field>
      <Field label="How did you hear about us?">
        <Select placeholder="Select one" value={filled ? "A friend or colleague" : ''}/>
      </Field>
    </Section>
  );
}

// ─── Add guests ─────────────────────────────────────────────────────────────

function AddGuestsCollapsed() {
  return (
    <div>
      <button style={{
        width:'100%', display:'flex', alignItems:'center', gap:10, textAlign:'left',
        background:E.surface, border:`1px solid ${E.border}`, borderRadius:8,
        padding:'11px 13px', cursor:'pointer', boxShadow:'0 1px 2px rgba(0,0,0,0.03)',
      }}>
        <div style={{
          width:28, height:28, borderRadius:8, flexShrink:0, background:E.blue50, color:ACCENT,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}><i data-lucide="user-plus" style={{ width:15, height:15, strokeWidth:2.2 }}/></div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12.5, fontWeight:600, color:E.fg1, letterSpacing:-0.1 }}>Add guests</div>
          <div style={{ fontSize:10.5, color:E.fg3, marginTop:1 }}>Add up to 5 guests.</div>
        </div>
        <i data-lucide="plus" style={{ width:17, height:17, color:ACCENT, flexShrink:0 }}/>
      </button>
    </div>
  );
}

function GuestEmailRow({ value, placeholder }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ flex:1, minWidth:0 }}>
        <Input value={value} placeholder={placeholder}/>
      </div>
      <button aria-label="Remove guest" style={{
        width:32, height:32, borderRadius:8, flexShrink:0, cursor:'pointer',
        background:E.surface, border:`1px solid ${E.border}`, color:E.fg3,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}><i data-lucide="x" style={{ width:15, height:15 }}/></button>
    </div>
  );
}

function AddGuestsExpanded({ guests }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
      <div style={{ display:'flex', alignItems:'center', gap:7 }}>
        <i data-lucide="users" style={{ width:14, height:14, color:E.fg3 }}/>
        <span style={{ fontSize:12, fontWeight:600, color:E.fg1, letterSpacing:-0.1 }}>Guests</span>
      </div>
      {guests.map((g, i) => <GuestEmailRow key={i} value={g}/>)}
      <GuestEmailRow placeholder="guest@email.com"/>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <button style={{
          display:'inline-flex', alignItems:'center', gap:5, background:'transparent', border:'none',
          padding:'2px 2px', cursor:'pointer', color:ACCENT, fontSize:12, fontWeight:700, letterSpacing:-0.05,
        }}>
          <i data-lucide="plus" style={{ width:13, height:13, strokeWidth:2.4 }}/>Add another
        </button>
        <span style={{ fontSize:10.5, color:E.fg4 }}>{guests.length + 1} of 5</span>
      </div>
    </div>
  );
}

// ─── Banners ────────────────────────────────────────────────────────────────

function InfoBanner() {
  return (
    <div style={{
      display:'flex', alignItems:'flex-start', gap:9, padding:'10px 12px',
      background:INFO_BG, border:`1px solid ${INFO_BORDER}`, borderRadius:10,
    }}>
      <i data-lucide="info" style={{ width:15, height:15, color:INFO, flexShrink:0, marginTop:1, strokeWidth:2.1 }}/>
      <div style={{ fontSize:11.5, color:'#0c4a6e', lineHeight:'16px' }}>
        You have an account.{' '}
        <span style={{ color:ACCENT, fontWeight:700, textDecoration:'underline', textDecorationColor:'rgba(2,132,199,0.4)' }}>Open in app</span>
        {' '}to use your saved details.
      </div>
    </div>
  );
}

function ExpiredBanner() {
  return (
    <div style={{
      display:'flex', alignItems:'flex-start', gap:10, padding:'11px 12px',
      background:WARN_BG, border:`1px solid ${WARN_BORDER}`, borderRadius:12,
    }}>
      <i data-lucide="clock-alert" style={{ width:16, height:16, color:WARN, flexShrink:0, marginTop:1, strokeWidth:2.2 }}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'#92400e', letterSpacing:-0.1, lineHeight:'16px' }}>This held time just expired</div>
        <div style={{ fontSize:11, color:WARN, marginTop:2, lineHeight:'15px' }}>Someone else can book it now. Pick another time to keep going.</div>
      </div>
    </div>
  );
}

// ─── Sticky footer CTA ──────────────────────────────────────────────────────

function Footer({ children }) {
  return (
    <div style={{
      position:'absolute', left:0, right:0, bottom:0, zIndex:15,
      background:'rgba(255,255,255,0.97)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
      borderTop:`1px solid ${E.border}`, padding:'10px 13px 20px',
    }}>{children}</div>
  );
}

function PrimaryCTA({ label = 'Review booking', disabled, icon }) {
  return (
    <button disabled={disabled} style={{
      width:'100%', height:46, borderRadius:12, cursor: disabled ? 'not-allowed' : 'pointer',
      border:'none', letterSpacing:-0.1, fontSize:14, fontWeight:700,
      background: disabled ? E.sunken : ACCENT, color: disabled ? E.fg4 : '#fff',
      boxShadow: disabled ? 'none' : '0 6px 16px rgba(2,132,199,0.28)',
      display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7,
    }}>
      {icon && <i data-lucide={icon} style={{ width:16, height:16 }}/>}
      {label}
    </button>
  );
}

function ShimmerCTA() {
  return (
    <div style={{
      width:'100%', height:46, borderRadius:12, ...SH,
      display:'flex', alignItems:'center', justifyContent:'center',
    }}>
      <span style={{ fontSize:13, fontWeight:600, color:E.fg4, letterSpacing:-0.1 }}>Submitting your booking</span>
    </div>
  );
}

// Prefilled "Booking as" chip — replaces the Your info section when logged in.
function BookingAsChip() {
  return (
    <Section overline="Your info">
      <div style={{
        display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
        background:E.surface, border:`1px solid ${E.border}`, borderRadius:10, boxShadow:'0 1px 2px rgba(0,0,0,0.03)',
      }}>
        <div style={{
          width:34, height:34, borderRadius:'50%', flexShrink:0, background:INV_AV,
          display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:12, fontWeight:700,
        }}>MC</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12.5, fontWeight:700, color:E.fg1, letterSpacing:-0.1 }}>Booking as Maya Chen</div>
          <div style={{ fontSize:11, color:E.fg3, marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>maya.chen@gmail.com</div>
        </div>
        <button style={{
          background:'transparent', border:'none', padding:'2px 2px', cursor:'pointer',
          color:ACCENT, fontSize:11, fontWeight:700, letterSpacing:-0.05, flexShrink:0,
        }}>Not you?</button>
      </div>
    </Section>
  );
}

// ─── FRAME 1 · DEFAULT (empty) ──────────────────────────────────────────────

function FrameDefault() {
  return (
    <Phone label="Intake · Default (empty)" footer={<Footer><PrimaryCTA disabled/></Footer>}>
      <SummaryCard/>
      <HoldRow time="4:32"/>
      <Section overline="Your info">
        <div style={{ display:'flex', gap:9 }}>
          <div style={{ flex:1 }}><Field label="First name" required><Input placeholder="Maya"/></Field></div>
          <div style={{ flex:1 }}><Field label="Last name" required><Input placeholder="Chen"/></Field></div>
        </div>
        <Field label="Email" required>
          <Input placeholder="you@email.com" helper="We'll only email you about this booking."/>
        </Field>
      </Section>
      <HostQuestions/>
      <AddGuestsCollapsed/>
    </Phone>
  );
}

// ─── FRAME 2 · PREFILLED (logged in) ────────────────────────────────────────

function FramePrefilled() {
  return (
    <Phone label="Intake · Prefilled (logged in)" footer={<Footer><PrimaryCTA/></Footer>}>
      <SummaryCard/>
      <HoldRow time="4:18"/>
      <BookingAsChip/>
      <HostQuestions filled/>
      <AddGuestsExpanded guests={["sam.rivera@gmail.com"]}/>
    </Phone>
  );
}

// ─── FRAME 3 · VALIDATION ERRORS ────────────────────────────────────────────

function FrameErrors() {
  return (
    <Phone label="Intake · Validation errors" footer={<Footer><PrimaryCTA disabled/></Footer>}>
      <SummaryCard/>
      <HoldRow time="3:54"/>
      <Section overline="Your info">
        <div style={{ display:'flex', gap:9 }}>
          <div style={{ flex:1 }}><Field label="First name" required><Input placeholder="Maya" state="error" error="Enter your first name"/></Field></div>
          <div style={{ flex:1 }}><Field label="Last name" required><Input value="Chen" state="valid"/></Field></div>
        </div>
        <Field label="Email" required>
          <Input value="maya.chen@" state="error" error="Enter a valid email address"/>
        </Field>
      </Section>
      <HostQuestions errors={{ cover: 'This question is required' }}/>
      <AddGuestsCollapsed/>
    </Phone>
  );
}

// ─── FRAME 4 · EXISTING ACCOUNT DETECTED ────────────────────────────────────

function FrameExistingAccount() {
  return (
    <Phone label="Intake · Existing account detected" footer={<Footer><PrimaryCTA/></Footer>}>
      <SummaryCard/>
      <HoldRow time="4:05"/>
      <Section overline="Your info">
        <div style={{ display:'flex', gap:9 }}>
          <div style={{ flex:1 }}><Field label="First name" required><Input value="Maya" state="valid"/></Field></div>
          <div style={{ flex:1 }}><Field label="Last name" required><Input value="Chen" state="valid"/></Field></div>
        </div>
        <Field label="Email" required>
          <Input value="maya.chen@gmail.com" state="valid"/>
        </Field>
        <InfoBanner/>
      </Section>
      <HostQuestions/>
      <AddGuestsCollapsed/>
    </Phone>
  );
}

// ─── FRAME 5 · SUBMITTING ───────────────────────────────────────────────────

function FrameSubmitting() {
  return (
    <Phone label="Intake · Submitting" footer={<Footer><ShimmerCTA/></Footer>}>
      <SummaryCard/>
      <HoldRow time="3:41"/>
      <div style={{ pointerEvents:'none', opacity:0.85, display:'flex', flexDirection:'column', gap:14 }}>
        <BookingAsChip/>
        <HostQuestions filled/>
      </div>
    </Phone>
  );
}

// ─── FRAME 6 · SLOT EXPIRED WHILE FILLING ───────────────────────────────────

function FrameExpired() {
  return (
    <Phone label="Intake · Slot expired" footer={<Footer><PrimaryCTA label="Pick another time" icon="calendar-search"/></Footer>}>
      <ExpiredBanner/>
      <div style={{ pointerEvents:'none', opacity:0.5, display:'flex', flexDirection:'column', gap:14 }}>
        <SummaryCard/>
        <Section overline="Your info">
          <div style={{ display:'flex', gap:9 }}>
            <div style={{ flex:1 }}><Field label="First name" required><Input value="Maya" dimmed/></Field></div>
            <div style={{ flex:1 }}><Field label="Last name" required><Input value="Chen" dimmed/></Field></div>
          </div>
          <Field label="Email" required>
            <Input value="maya.chen@gmail.com" dimmed/>
          </Field>
        </Section>
        <HostQuestions filled/>
      </div>
    </Phone>
  );
}

Object.assign(window, {
  FrameDefault, FramePrefilled, FrameErrors, FrameExistingAccount, FrameSubmitting, FrameExpired,
});
