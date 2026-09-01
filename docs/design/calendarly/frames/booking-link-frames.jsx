// Pantopus — Calendarly · Booking link / public page management — 7 frames
// Archetype: Form / section reusing the A13 Edit Business Page block-editor +
// public-slug + A14 settings toggle-row patterns. Owner-polymorphic: Personal
// sky / Business violet pillar on the header pill + section overlines; the
// availability check, toggles, and CTAs stay sky. White cards, 1px border,
// 16px radius, shadow-sm, no left-border accents. Lucide stroke-2, no emoji.
//
// Frames: (1) live populated · (2) draft (business/violet) · (3) paused ·
// (4) saving (inline spinner, fields locked) · (5) saved (toast) ·
// (6) slug taken / conflict · (7) no-services warning.

const {
  E, Phone, TopBar, HeaderPill, Body, Card, FieldLabel,
  TextInput, Segmented, ToggleRow, Toggle, LinkRow,
} = window;

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

// ─── Status card (overline · chip · switch) ────────────────────

function StatusChip({ tone }) {
  const map = {
    live:   { bg:E.success100, fg:E.success700, label:'Live',   dot:E.success600 },
    paused: { bg:E.sunken,     fg:E.fg2,        label:'Paused', dot:E.fg4 },
    draft:  { bg:E.warningBg,  fg:'#92400e',    label:'Draft',  dot:E.warning },
  }[tone];
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5, padding:'3px 9px',
      borderRadius:9999, background:map.bg, color:map.fg,
      fontSize:10, fontWeight:700, letterSpacing:0.05, textTransform:'uppercase',
    }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:map.dot }}/>
      {map.label}
    </span>
  );
}

function StatusCard({ pillar='personal', state='live', disabled }) {
  const copy = {
    live:   'Anyone with this link can book you.',
    paused: 'Page is paused. People see a short note and cannot book.',
    draft:  'Not published yet. Finish setup, then publish to go live.',
  }[state];
  const on = state === 'live';
  return (
    <Card overline="Status" pillar={pillar}>
      <div style={{ display:'flex', alignItems:'center', gap:12, opacity:disabled?0.7:1 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <StatusChip tone={state}/>
          <div style={{ fontSize:11.5, color:E.fg3, lineHeight:'16px', marginTop:7 }}>{copy}</div>
        </div>
        <Toggle on={on} disabled={disabled}/>
      </div>
    </Card>
  );
}

// ─── Slug card (prefix + handle + live availability) ───────────

function SlugCard({ pillar='personal', handle='maria-k', status='available', disabled }) {
  const taken = status === 'taken';
  return (
    <Card overline="Your link" pillar={pillar}>
      <div style={{
        display:'flex', alignItems:'stretch',
        border:`1.5px solid ${taken ? E.error : E.border}`, borderRadius:8,
        background: disabled ? E.raised : E.surface, overflow:'hidden',
        boxShadow: taken ? `0 0 0 3px ${E.errorBg}` : '0 1px 2px rgba(0,0,0,0.03)',
        opacity: disabled ? 0.7 : 1,
      }}>
        <span style={{
          padding:'10px 1px 10px 11px', fontSize:12.5, color:E.fg3,
          fontFamily:MONO, whiteSpace:'nowrap', display:'flex', alignItems:'center',
        }}>pantopus.com/book/</span>
        <span style={{
          flex:1, padding:'10px 11px 10px 0', fontSize:12.5, fontWeight:600,
          color:E.fg1, fontFamily:MONO, display:'flex', alignItems:'center', minWidth:0,
        }}>{handle}</span>
      </div>

      {status === 'available' && (
        <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:7, fontSize:11.5, fontWeight:600, color:E.success700 }}>
          <i data-lucide="circle-check" style={{ width:13, height:13, strokeWidth:2.4 }}/>
          Available
        </div>
      )}

      {taken && (
        <>
          <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:7, fontSize:11.5, fontWeight:600, color:E.error }}>
            <i data-lucide="circle-alert" style={{ width:13, height:13, strokeWidth:2.4 }}/>
            That handle is taken. Try another.
          </div>
          <div style={{ display:'flex', gap:6, marginTop:9, flexWrap:'wrap' }}>
            {['maria-k','mariakessler','maria-co'].map(s => (
              <button key={s} style={{
                padding:'6px 11px', borderRadius:9999, background:E.surface,
                border:`1px solid ${E.border}`, color:E.fg2, fontSize:11.5, fontWeight:600,
                fontFamily:MONO, cursor:'pointer',
              }}>{s}</button>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

// ─── Page header card (avatar + name + tagline) ───────────────

function Avatar({ kind='personal', initials='MK' }) {
  const grad = kind === 'business'
    ? 'linear-gradient(135deg,#a78bfa,#7c3aed)'
    : 'linear-gradient(135deg,#38bdf8,#0284c7)';
  return (
    <div style={{
      width:48, height:48, borderRadius:'50%', background:grad, color:'#fff',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:16, fontWeight:700, letterSpacing:0.2, flexShrink:0,
      boxShadow:'0 2px 6px rgba(0,0,0,0.14)',
    }}>{initials}</div>
  );
}

function HeaderCard({ pillar='personal', name, tagline, initials, disabled }) {
  return (
    <Card overline="Page header" pillar={pillar}>
      <div style={{ display:'flex', alignItems:'center', gap:12, opacity:disabled?0.7:1 }}>
        <Avatar kind={pillar} initials={initials}/>
        <button disabled={disabled} style={{
          background:'transparent', border:'none', padding:0, cursor:disabled?'default':'pointer',
          color: disabled ? E.fg4 : E.blue600, fontSize:12.5, fontWeight:600, letterSpacing:-0.1,
        }}>Change photo</button>
      </div>
      <TextInput label="Display name" value={name} placeholder="Your name" disabled={disabled}/>
      <TextInput label="Tagline" value={tagline} placeholder="One short line" disabled={disabled}/>
    </Card>
  );
}

// ─── Services card (event-type toggle rows + warning note) ─────

function WarningNote({ children }) {
  return (
    <div style={{
      display:'flex', alignItems:'flex-start', gap:8, padding:'9px 11px',
      background:E.warningBg, border:`1px solid ${E.warningBorder}`, borderRadius:8,
      color:'#92400e', fontSize:11.5, fontWeight:500, lineHeight:'16px',
    }}>
      <i data-lucide="triangle-alert" style={{ width:14, height:14, flexShrink:0, marginTop:1 }}/>
      {children}
    </div>
  );
}

function ServicesCard({ pillar='personal', services, warn }) {
  return (
    <Card overline="Services people can book" pillar={pillar}>
      {warn && <WarningNote>Turn on at least one service so people can book</WarningNote>}
      {services.map((s, i) => (
        <ToggleRow key={s.name} icon={s.icon} label={s.name} sub={s.dur} on={s.on} last={i === services.length - 1}/>
      ))}
    </Card>
  );
}

// ─── Copy card (intro + confirmation) ──────────────────────────

function CopyCard({ pillar='personal' }) {
  return (
    <Card overline="Intro &amp; confirmation" pillar={pillar}>
      <TextInput label="Intro message" multiline
        value="Pick a time that works and I'll send a calendar invite."/>
      <TextInput label="Confirmation message" multiline
        value="Thanks for booking. You'll get a reminder a day before."/>
    </Card>
  );
}

// ─── Visibility card (segmented) ───────────────────────────────

function VisibilityCard({ pillar='personal', value='Listed' }) {
  return (
    <Card overline="Visibility" pillar={pillar}>
      <Segmented options={['Listed','Link-only']} value={value}/>
      <div style={{ fontSize:11, color:E.fg3, lineHeight:'15px' }}>
        {value === 'Listed'
          ? 'Shown on your Pantopus profile and in search.'
          : 'Only people with the link can find your page.'}
      </div>
    </Card>
  );
}

// ─── Links card (intake · payments) ────────────────────────────

function LinksCard({ pillar='personal' }) {
  return (
    <Card pillar={pillar}>
      <LinkRow icon="list-checks" label="Intake questions" value="2 questions"/>
      <LinkRow icon="credit-card" label="Connect Stripe to take paid bookings" last/>
    </Card>
  );
}

// ─── Footer action buttons (copy · share · QR) ─────────────────

function FooterButtons({ disabled }) {
  const items = [
    { icon:'copy', label:'Copy link' },
    { icon:'share-2', label:'Share' },
    { icon:'qr-code', label:'View QR' },
  ];
  return (
    <div style={{ display:'flex', gap:8, opacity:disabled?0.5:1 }}>
      {items.map(b => (
        <button key={b.label} disabled={disabled} style={{
          flex:1, height:40, borderRadius:10, background:E.surface,
          border:`1px solid ${E.border}`, color:E.fg2,
          fontSize:11.5, fontWeight:600, letterSpacing:-0.1, cursor:disabled?'default':'pointer',
          display:'inline-flex', alignItems:'center', justifyContent:'center', gap:5,
        }}>
          <i data-lucide={b.icon} style={{ width:13, height:13, color:disabled?E.fg4:E.blue600 }}/>
          {b.label}
        </button>
      ))}
    </div>
  );
}

// ─── Bottom save bar (spinner / disabled variants) ─────────────

function BLSaveBar({ saving, disabled, label='Save changes' }) {
  const dim = saving || disabled;
  return (
    <div style={{
      position:'absolute', bottom:0, left:0, right:0,
      background:'rgba(255,255,255,0.96)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
      borderTop:`1px solid ${E.border}`, padding:'10px 12px 18px', zIndex:10,
    }}>
      <button style={{
        width:'100%', height:44, borderRadius:12, border:'none',
        background: dim ? E.sunken : E.blue600, color: dim ? E.fg4 : '#fff',
        fontSize:13.5, fontWeight:700, letterSpacing:-0.1,
        cursor: dim ? 'default' : 'pointer',
        boxShadow: dim ? 'none' : '0 6px 16px rgba(2,132,199,0.28)',
        display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8,
      }}>
        {saving ? (
          <>
            <span style={{
              width:16, height:16, borderRadius:'50%', display:'inline-block',
              border:'2px solid rgba(17,24,39,0.18)', borderTopColor:E.fg3,
              animation:'spin 0.7s linear infinite',
            }}/>
            Saving
          </>
        ) : disabled ? (
          <>
            <i data-lucide="lock" style={{ width:14, height:14 }}/>
            Fix your link to save
          </>
        ) : label}
      </button>
    </div>
  );
}

// ─── "Saved" toast ─────────────────────────────────────────────

function SavedToast() {
  return (
    <div style={{
      position:'absolute', left:'50%', bottom:86, transform:'translateX(-50%)', zIndex:20,
      display:'inline-flex', alignItems:'center', gap:8, padding:'9px 15px', borderRadius:9999,
      background:'#111827', color:'#fff', fontSize:12.5, fontWeight:600, letterSpacing:-0.1,
      boxShadow:'0 10px 28px rgba(0,0,0,0.28)', whiteSpace:'nowrap',
    }}>
      <i data-lucide="check" style={{ width:15, height:15, strokeWidth:3, color:'#34d399' }}/>
      Saved
    </div>
  );
}

// ─── Shared data ───────────────────────────────────────────────

const SERVICES_LIVE = [
  { icon:'video',  name:'Intro call',        dur:'30 min', on:true },
  { icon:'users',  name:'Strategy session',  dur:'60 min', on:true },
  { icon:'coffee', name:'Coffee chat',       dur:'15 min', on:false },
];
const SERVICES_OFF = SERVICES_LIVE.map(s => ({ ...s, on:false }));

// ═══════════════════════════════════════════════════════════════
// FRAME 1 · DEFAULT — live, fully populated (personal · the full screen)
// ═══════════════════════════════════════════════════════════════

function FrameDefault() {
  return (
    <Phone label="Booking link — live">
      <TopBar title="Booking link"/>
      <HeaderPill pillar="personal"/>
      <Body>
        <StatusCard pillar="personal" state="live"/>
        <SlugCard pillar="personal" handle="maria-k" status="available"/>
        <HeaderCard pillar="personal" name="Maria Kessler" tagline="Brand strategy &amp; coaching" initials="MK"/>
        <ServicesCard pillar="personal" services={SERVICES_LIVE}/>
        <CopyCard pillar="personal"/>
        <VisibilityCard pillar="personal" value="Listed"/>
        <LinksCard pillar="personal"/>
        <FooterButtons/>
      </Body>
      <BLSaveBar/>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 2 · DRAFT — newly created, not yet published (business · violet)
// ═══════════════════════════════════════════════════════════════

function FrameDraft() {
  return (
    <Phone label="Booking link — draft (business)">
      <TopBar title="Booking link"/>
      <HeaderPill pillar="business"/>
      <Body>
        <StatusCard pillar="business" state="draft"/>
        <SlugCard pillar="business" handle="northlight" status="available"/>
        <HeaderCard pillar="business" name="Northlight Studio" tagline="" initials="NS"/>
        <VisibilityCard pillar="business" value="Link-only"/>
        <FooterButtons disabled/>
      </Body>
      <BLSaveBar label="Save draft"/>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 3 · PAUSED — live link held, bookings off (personal)
// ═══════════════════════════════════════════════════════════════

function FramePaused() {
  return (
    <Phone label="Booking link — paused">
      <TopBar title="Booking link"/>
      <HeaderPill pillar="personal"/>
      <Body>
        <StatusCard pillar="personal" state="paused"/>
        <SlugCard pillar="personal" handle="maria-k" status="available"/>
        <ServicesCard pillar="personal" services={SERVICES_LIVE}/>
        <FooterButtons/>
      </Body>
      <BLSaveBar/>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 4 · SAVING — inline spinner, every field locked (personal)
// ═══════════════════════════════════════════════════════════════

function FrameSaving() {
  return (
    <Phone label="Booking link — saving">
      <TopBar title="Booking link" saving/>
      <HeaderPill pillar="personal"/>
      <Body>
        <StatusCard pillar="personal" state="live" disabled/>
        <SlugCard pillar="personal" handle="maria-k" status="available" disabled/>
        <HeaderCard pillar="personal" name="Maria Kessler" tagline="Brand strategy &amp; coaching" initials="MK" disabled/>
      </Body>
      <BLSaveBar saving/>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 5 · SAVED — confirmation toast (personal)
// ═══════════════════════════════════════════════════════════════

function FrameSaved() {
  return (
    <Phone label="Booking link — saved">
      <TopBar title="Booking link"/>
      <HeaderPill pillar="personal"/>
      <Body>
        <StatusCard pillar="personal" state="live"/>
        <SlugCard pillar="personal" handle="maria-k" status="available"/>
        <HeaderCard pillar="personal" name="Maria Kessler" tagline="Brand strategy &amp; coaching" initials="MK"/>
      </Body>
      <SavedToast/>
      <BLSaveBar/>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 6 · CONFLICT — handle already taken (personal)
// ═══════════════════════════════════════════════════════════════

function FrameConflict() {
  return (
    <Phone label="Booking link — handle taken">
      <TopBar title="Booking link"/>
      <HeaderPill pillar="personal"/>
      <Body>
        <SlugCard pillar="personal" handle="maria" status="taken"/>
        <StatusCard pillar="personal" state="live"/>
        <HeaderCard pillar="personal" name="Maria Kessler" tagline="Brand strategy &amp; coaching" initials="MK"/>
      </Body>
      <BLSaveBar disabled/>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 7 · NO SERVICES — warning, nothing bookable (personal)
// ═══════════════════════════════════════════════════════════════

function FrameNoServices() {
  return (
    <Phone label="Booking link — no services on">
      <TopBar title="Booking link"/>
      <HeaderPill pillar="personal"/>
      <Body>
        <ServicesCard pillar="personal" services={SERVICES_OFF} warn/>
        <StatusCard pillar="personal" state="live"/>
        <SlugCard pillar="personal" handle="maria-k" status="available"/>
      </Body>
      <BLSaveBar/>
    </Phone>
  );
}

Object.assign(window, {
  FrameDefault, FrameDraft, FramePaused, FrameSaving, FrameSaved, FrameConflict, FrameNoServices,
});
