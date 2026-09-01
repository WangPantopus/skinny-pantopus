// Pantopus — Calendarly · Booking limits & notice rules (sheet)
// Archetype: Form, in a bottom sheet over the dimmed editor. Mirrors Form.html
// for the stepper + segmented field groups, A13 Edit Business Page for numeric
// settings rows with units, and A14.8 for the toggle/row idiom on the cap rows.
// Lives in: Availability schedule editor → "Booking limits" row; also Event Type
// editor → Limits (per-type override, where the pillar follows the event type).
//
// Pillar: Personal sky — accent ONLY on the sheet overline. Every control stays
// product sky #0284C7. White cards, 1px border, 16px radius, shadow-sm, no
// left-border accents. Lucide stroke-2, no emoji. Shimmer skeletons.
//
// Reuses primitives from event-editor-shell.jsx (E, Phone, TopBar, HeaderPill,
// Card, Segmented, Stepper, Toggle).

// ─── Dimmed editor background ─────────────────────────────────

function DimDayRow({ day, hours, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 11, padding: '11px 0',
      borderBottom: last ? 'none' : `1px solid ${E.border}`,
    }}>
      <Toggle on={!!hours} />
      <span style={{ fontSize: 13, fontWeight: 600, color: hours ? E.fg1 : E.fg3, letterSpacing: -0.1 }}>{day}</span>
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: 12, color: hours ? E.fg2 : E.fg4, fontWeight: 500 }}>{hours || 'Unavailable'}</span>
    </div>
  );
}

function DimmedEditor() {
  return (
    <>
      <TopBar title="Edit schedule" />
      <HeaderPill pillar="personal" />
      <div style={{ flex: 1, overflow: 'hidden', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Card overline="Timezone" pillar="personal">
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, border: `1.5px solid ${E.border}`, borderRadius: 8, padding: '10px 11px' }}>
            <i data-lucide="globe" style={{ width: 15, height: 15, color: E.fg3 }} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: E.fg1 }}>Pacific Time <span style={{ color: E.fg4 }}>· auto</span></span>
          </div>
        </Card>
        <Card overline="Weekly hours" pillar="personal">
          <DimDayRow day="Monday" hours="9:00 AM – 5:00 PM" />
          <DimDayRow day="Tuesday" hours="9:00 AM – 5:00 PM" />
          <DimDayRow day="Wednesday" hours="9:00 AM – 5:00 PM" />
          <DimDayRow day="Thursday" hours="9:00 AM – 5:00 PM" last />
        </Card>
      </div>
    </>
  );
}

function Scrim() {
  return <div style={{ position: 'absolute', inset: 0, zIndex: 15, background: 'rgba(17,24,39,0.42)' }} />;
}

// ─── Sheet shell ──────────────────────────────────────────────

function Sheet({ children, doneDisabled, top = 92 }) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, top, zIndex: 20,
      background: E.surface, borderRadius: '24px 24px 0 0', boxShadow: '0 -10px 30px rgba(17,24,39,0.18)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 9, paddingBottom: 2, flexShrink: 0 }}>
        <div style={{ width: 38, height: 5, borderRadius: 9999, background: E.borderStrong }} />
      </div>
      <div style={{ padding: '8px 16px 6px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: E.personal, marginBottom: 3 }}>Personal · Working hours</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: E.fg1, letterSpacing: -0.3 }}>Booking limits</div>
          </div>
          <button style={{
            background: 'transparent', border: 'none', cursor: doneDisabled ? 'default' : 'pointer',
            padding: '2px 0 2px 12px', color: doneDisabled ? E.fg4 : E.blue600, fontSize: 14.5, fontWeight: 700, letterSpacing: -0.1,
          }}>Done</button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 16px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}

function Helper() {
  return (
    <div style={{ fontSize: 11.5, color: E.fg3, lineHeight: '16px', padding: '0 2px 2px' }}>
      Sensible defaults are set, so you usually don't need to touch these.
    </div>
  );
}

// ─── Rows ─────────────────────────────────────────────────────

function RowCard({ children }) {
  return (
    <div style={{
      background: E.surface, border: `1px solid ${E.border}`, borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: 8,
    }}>{children}</div>
  );
}

// Label + stepper on one line, caption (or error) below.
function StepperRow({ label, value, unit, caption, error, errorMsg }) {
  return (
    <RowCard>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: E.fg1, letterSpacing: -0.1 }}>{label}</span>
        <Stepper value={value} unit={unit} error={error} />
      </div>
      {error ? (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5, fontSize: 10.5, color: E.error, lineHeight: '15px' }}>
          <i data-lucide="circle-alert" style={{ width: 12, height: 12, flexShrink: 0, marginTop: 1 }} />
          <span>{errorMsg}</span>
        </div>
      ) : (
        <div style={{ fontSize: 11, color: E.fg3, lineHeight: '15px' }}>{caption}</div>
      )}
    </RowCard>
  );
}

// Label on top, full-width segmented, caption below.
function SegmentRow({ label, options, value, caption }) {
  return (
    <RowCard>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: E.fg1, letterSpacing: -0.1 }}>{label}</span>
      <Segmented options={options} value={value} small />
      <div style={{ fontSize: 11, color: E.fg3, lineHeight: '15px' }}>{caption}</div>
    </RowCard>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 1 · DEFAULTS
// ═══════════════════════════════════════════════════════════════

function FrameDefaults() {
  return (
    <Phone label="Booking limits — defaults">
      <DimmedEditor />
      <Scrim />
      <Sheet>
        <Helper />
        <StepperRow label="Minimum notice" value="4" unit="hours" caption="Can't be booked inside this window." />
        <StepperRow label="Book up to" value="60" unit="days" caption="How far ahead people can book." />
        <StepperRow label="Max per day" value="8" caption="Most bookings you'll take in a day." />
        <StepperRow label="Max per week" value="20" caption="Most bookings you'll take in a week." />
        <StepperRow label="Per-person limit" value="2" unit="bookings" caption="How many one person can hold at once." />
        <SegmentRow label="Start times" options={[':00 only', ':00 & :30', 'every 15 min']} value=":00 only" caption="Where bookings can start within the hour." />
      </Sheet>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 2 · CUSTOM (tighter values)
// ═══════════════════════════════════════════════════════════════

function FrameCustom() {
  return (
    <Phone label="Booking limits — custom">
      <DimmedEditor />
      <Scrim />
      <Sheet>
        <Helper />
        <StepperRow label="Minimum notice" value="12" unit="hours" caption="Can't be booked inside this window." />
        <StepperRow label="Book up to" value="14" unit="days" caption="How far ahead people can book." />
        <StepperRow label="Max per day" value="3" caption="Most bookings you'll take in a day." />
        <StepperRow label="Max per week" value="12" caption="Most bookings you'll take in a week." />
        <StepperRow label="Per-person limit" value="1" unit="booking" caption="How many one person can hold at once." />
        <SegmentRow label="Start times" options={[':00 only', ':00 & :30', 'every 15 min']} value=":00 & :30" caption="Where bookings can start within the hour." />
      </Sheet>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 3 · CONFLICT ERROR (window < minimum notice)
// ═══════════════════════════════════════════════════════════════

function FrameError() {
  return (
    <Phone label="Booking limits — conflict error">
      <DimmedEditor />
      <Scrim />
      <Sheet doneDisabled>
        <Helper />
        <StepperRow label="Minimum notice" value="12" unit="hours" caption="Can't be booked inside this window." />
        <StepperRow
          label="Book up to"
          value="0"
          unit="days"
          error
          errorMsg="Your booking window is shorter than your minimum notice, so no times will show."
        />
        <StepperRow label="Max per day" value="3" caption="Most bookings you'll take in a day." />
        <StepperRow label="Max per week" value="12" caption="Most bookings you'll take in a week." />
        <SegmentRow label="Start times" options={[':00 only', ':00 & :30', 'every 15 min']} value=":00 & :30" caption="Where bookings can start within the hour." />
      </Sheet>
    </Phone>
  );
}

Object.assign(window, {
  FrameDefaults, FrameCustom, FrameError,
});
