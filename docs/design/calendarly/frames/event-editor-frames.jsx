// Pantopus — Calendarly · Event Type / Service Editor — 7 frames
// (1) create defaults · (2) edit populated, Advanced collapsed · (3) Advanced
// expanded · (4) business collective-mode revealed · (5) Stripe-not-connected ·
// (6) saving · (7) error (invalid duration). Each frame foregrounds the cards
// that tell its story; the form order and chrome stay identical throughout.

const MEMBERS = [
  { initials:'SR', grad:'linear-gradient(135deg,#a78bfa,#7c3aed)' },
  { initials:'PN', grad:'linear-gradient(135deg,#f472b6,#db2777)' },
  { initials:'ML', grad:'linear-gradient(135deg,#38bdf8,#0284c7)', dim:true },
];

// ─── Reusable section blocks ───────────────────────────────────

function BasicsCard({ pillar='personal', name, desc, swatch=1, disabled }) {
  return (
    <Card overline="Basics" pillar={pillar}>
      <TextInput label="Name" value={name} placeholder="e.g. Intro call" disabled={disabled}/>
      <TextInput label="Description" value={desc} placeholder="What should people expect?" multiline disabled={disabled}/>
      <ColorSwatches selectedIndex={swatch}/>
    </Card>
  );
}

function DurationCard({ pillar='personal', mode='Single', value='30', disabled, error }) {
  return (
    <Card overline="Duration" pillar={pillar}>
      <Segmented options={['Single','Multiple']} value={mode} disabled={disabled}/>
      <div>
        <FieldLabel>Length</FieldLabel>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <Stepper value={value} unit="min" disabled={disabled} error={error}/>
          <QuickChip label="15"/>
          <QuickChip label="45"/>
          <QuickChip label="60"/>
        </div>
        {error && (
          <div style={{ marginTop:8, fontSize:10.5, color:E.error, lineHeight:'14px', display:'flex', alignItems:'flex-start', gap:4 }}>
            <i data-lucide="circle-alert" style={{ width:11, height:11, flexShrink:0, marginTop:1 }}/>
            Enter a length between 5 and 480 minutes
          </div>
        )}
      </div>
    </Card>
  );
}

function LocationCard({ pillar='personal', value='Video', disabled }) {
  const fields = {
    'In person': { label:'Address', val:'412 Elm St, Suite 3', mono:false },
    'Phone':     { label:'Number',  val:'+1 (415) 555-0142',   mono:true  },
    'Video':     { label:'Meeting link', val:'meet.pantopus.com/maria-k', mono:true },
    'Custom':    { label:'Instructions', val:'Sent after booking', mono:false },
  };
  const f = fields[value];
  return (
    <Card overline="Location" pillar={pillar}>
      <Segmented options={['In person','Phone','Video','Custom']} value={value} disabled={disabled} small/>
      <TextInput label={f.label} value={f.val} mono={f.mono} disabled={disabled}/>
    </Card>
  );
}

function AvailabilityCard({ pillar='personal' }) {
  return (
    <Card overline="Availability" pillar={pillar}>
      <LinkRow icon="calendar-clock" label="Schedule" value="Working hours · Mon–Fri" last/>
    </Card>
  );
}

function AdvancedCard({ pillar='personal', open }) {
  return (
    <Card overline="Advanced" pillar={pillar} collapsedChevron open={open}>
      {open && (
        <>
          <div style={{ display:'flex', gap:10 }}>
            <div style={{ flex:1 }}>
              <FieldLabel>Buffer before</FieldLabel>
              <Stepper value="5" unit="min"/>
            </div>
            <div style={{ flex:1 }}>
              <FieldLabel>Buffer after</FieldLabel>
              <Stepper value="10" unit="min"/>
            </div>
          </div>
          <div>
            <FieldLabel>Minimum notice</FieldLabel>
            <Stepper value="4" unit="hrs"/>
          </div>
          <div>
            <FieldLabel>Booking horizon</FieldLabel>
            <Stepper value="60" unit="days"/>
          </div>
          <div>
            <FieldLabel>Per-day cap</FieldLabel>
            <Stepper value="8" unit="/day"/>
          </div>
        </>
      )}
    </Card>
  );
}

function ControlsCard({ pillar='personal', disabled }) {
  return (
    <Card pillar={pillar}>
      <ToggleRow icon="user-check" label="Require approval" sub="Approve each booking before it's confirmed" on={false} disabled={disabled}/>
      <ToggleRow icon="eye-off" label="Unlisted (link only)" sub="Hidden from your public page" on={false} disabled={disabled}/>
      <ToggleRow icon="circle-check" label="Active" sub="People can book this right now" on={true} disabled={disabled} last/>
    </Card>
  );
}

function AssignmentCard({ value='Anyone', collective }) {
  return (
    <Card overline="Assignment" pillar="business">
      <Segmented options={['Anyone','Specific','Collective']} value={value} small/>
      {collective ? (
        <>
          <div style={{ fontSize:11, color:E.fg3, lineHeight:'15px' }}>Everyone must be free. The booking goes on every required host's calendar.</div>
          <div>
            <FieldLabel>Required hosts</FieldLabel>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <Stepper value="2" unit="of 3"/>
              <span style={{ fontSize:11, color:E.fg3 }}>must be available</span>
            </div>
          </div>
          <MemberAvatars members={MEMBERS} required={2}/>
        </>
      ) : (
        <div style={{ fontSize:11, color:E.fg3, lineHeight:'15px' }}>Any seated teammate who's free can take the booking.</div>
      )}
    </Card>
  );
}

function PricingCard({ charge, stripe }) {
  return (
    <Card overline="Pricing &amp; payment" pillar="business">
      <ToggleRow label="Charge for this booking" sub="Collect payment when someone books" on={charge} last={!charge}/>
      {charge && (
        <>
          {stripe === 'connected' ? (
            <>
              <div style={{ display:'flex', gap:10 }}>
                <div style={{ flex:1.4 }}><TextInput label="Price" value="120" mono/></div>
                <div style={{ flex:1 }}>
                  <FieldLabel>Currency</FieldLabel>
                  <Segmented options={['USD','EUR']} value="USD" small/>
                </div>
              </div>
              <div>
                <FieldLabel>Collect</FieldLabel>
                <Segmented options={['Full amount','Deposit']} value="Full amount" small/>
              </div>
            </>
          ) : (
            <StripeCard/>
          )}
        </>
      )}
    </Card>
  );
}

function LinksCard({ pillar='personal' }) {
  return (
    <Card pillar={pillar}>
      <LinkRow icon="list-checks" label="Intake questions" value="2 questions"/>
      <LinkRow icon="gauge" label="Booking limits" value="Off"/>
      <LinkRow icon="bell" label="Reminders" value="1 day, 1 hour before" last/>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 1 · CREATE — defaults (personal)
// ═══════════════════════════════════════════════════════════════

function FrameCreate() {
  return (
    <Phone label="Editor — create (defaults)">
      <TopBar/>
      <HeaderPill pillar="personal"/>
      <Body>
        <BasicsCard pillar="personal" name="" desc="" swatch={1}/>
        <DurationCard pillar="personal"/>
        <LocationCard pillar="personal" value="Video"/>
      </Body>
      <SaveBar label="Create event type"/>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 2 · EDIT — populated, Advanced collapsed (personal)
// ═══════════════════════════════════════════════════════════════

function FrameEdit() {
  return (
    <Phone label="Editor — edit populated">
      <TopBar/>
      <HeaderPill pillar="personal"/>
      <Body>
        <BasicsCard pillar="personal" name="Intro call" desc="A quick 30-minute call to see if we're a fit." swatch={1}/>
        <LocationCard pillar="personal" value="Video"/>
        <AvailabilityCard pillar="personal"/>
        <AdvancedCard pillar="personal" open={false}/>
        <ControlsCard pillar="personal"/>
      </Body>
      <SaveBar/>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 3 · ADVANCED expanded (personal)
// ═══════════════════════════════════════════════════════════════

function FrameAdvanced() {
  return (
    <Phone label="Editor — Advanced expanded">
      <TopBar/>
      <HeaderPill pillar="personal"/>
      <Body>
        <AdvancedCard pillar="personal" open={true}/>
        <ControlsCard pillar="personal"/>
      </Body>
      <SaveBar/>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 4 · BUSINESS — collective mode revealed (violet)
// ═══════════════════════════════════════════════════════════════

function FrameCollective() {
  return (
    <Phone label="Editor — business collective">
      <TopBar/>
      <HeaderPill pillar="business"/>
      <Body>
        <AssignmentCard value="Collective" collective/>
        <BasicsCard pillar="business" name="Consultation" desc="A 30-minute intake with one of our specialists." swatch={4}/>
      </Body>
      <SaveBar/>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 5 · STRIPE not connected — inline CTA (business)
// ═══════════════════════════════════════════════════════════════

function FrameStripe() {
  return (
    <Phone label="Editor — Stripe not connected">
      <TopBar/>
      <HeaderPill pillar="business"/>
      <Body>
        <PricingCard charge={true} stripe="unconnected"/>
        <LinksCard pillar="business"/>
      </Body>
      <SaveBar/>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 6 · SAVING — save bar shimmer, fields disabled
// ═══════════════════════════════════════════════════════════════

function FrameSaving() {
  return (
    <Phone label="Editor — saving">
      <TopBar saving/>
      <HeaderPill pillar="personal"/>
      <Body>
        <BasicsCard pillar="personal" name="Intro call" desc="A quick 30-minute call to see if we're a fit." swatch={1} disabled/>
        <DurationCard pillar="personal" disabled/>
        <LocationCard pillar="personal" value="Video" disabled/>
      </Body>
      <SaveBar saving/>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 7 · ERROR — invalid duration
// ═══════════════════════════════════════════════════════════════

function FrameError() {
  return (
    <Phone label="Editor — duration error">
      <TopBar/>
      <HeaderPill pillar="personal"/>
      <Body>
        <DurationCard pillar="personal" value="600" error/>
        <BasicsCard pillar="personal" name="Intro call" desc="A quick 30-minute call to see if we're a fit." swatch={1}/>
        <LocationCard pillar="personal" value="Video"/>
      </Body>
      <SaveBar/>
    </Phone>
  );
}

Object.assign(window, {
  FrameCreate, FrameEdit, FrameAdvanced, FrameCollective, FrameStripe, FrameSaving, FrameError,
});
