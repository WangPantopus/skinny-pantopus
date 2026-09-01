// Pantopus — Calendarly · Block off time (personal busy override, MVP)
// Archetype: Form (sheet). Reuses the add-event date/time fields but writes a
// personal busy HOLD — not a bookable event, not a whole-day date override. It
// drops an ad-hoc busy block onto personal availability so the engine stops
// offering that slot. Mirrors A14.8 Vacation hold for the date-block frame, the
// A12.11 Support Train time-range picker for the window, and Form.html for the
// recurrence + note field group.
// Lives in: Availability editor → "Block off time"; Home calendar overflow;
// Scheduling hub FAB.
//
// Pillar: Personal sky — accent ONLY on the sheet overline. Conflicts ride on a
// semantic warning chip + icon, never a flood-fill or left-border. White cards,
// 1px border, 16px radius, shadow-sm. Lucide stroke-2, no emoji. Shimmer skeletons.
//
// Reuses primitives from event-editor-shell.jsx (E, Phone, TopBar, HeaderPill,
// Card, FieldLabel, TextInput, Toggle, ToggleRow, SH).

// ─── Dimmed Availability editor (background) ─────────────────

function DimDayRow({ day, hours, last }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 0', borderBottom: last ? 'none' : `1px solid ${E.border}` }}>
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

// ─── Sheet shell (Save top-right) ────────────────────────────

function Sheet({ children, saving, top = 92 }) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, top, zIndex: 20,
      background: E.surface, borderRadius: '24px 24px 0 0', boxShadow: '0 -10px 30px rgba(17,24,39,0.18)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 9, paddingBottom: 2, flexShrink: 0 }}>
        <div style={{ width: 38, height: 5, borderRadius: 9999, background: E.borderStrong }} />
      </div>
      <div style={{ padding: '8px 16px 8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: E.personal, marginBottom: 3 }}>Personal · Availability</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: E.fg1, letterSpacing: -0.3 }}>Block off time</div>
          </div>
          <button style={{ background: 'transparent', border: 'none', cursor: saving ? 'default' : 'pointer', padding: '2px 0 2px 12px', color: saving ? E.fg4 : E.blue600, fontSize: 14.5, fontWeight: 700, letterSpacing: -0.1 }}>{saving ? 'Saving' : 'Save'}</button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
      {/* bottom save bar / footnote */}
      <div style={{ borderTop: `1px solid ${E.border}`, padding: '10px 16px 16px', flexShrink: 0, background: E.surface }}>
        {saving ? (
          <div style={{ height: 24, borderRadius: 8, ...SH, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: E.fg4 }}>Saving…</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <i data-lucide="lock" style={{ width: 12, height: 12, color: E.fg4, strokeWidth: 2, flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 10.5, color: E.fg3, lineHeight: '15px' }}>This time won't be offered for booking. It's private to you.</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Field button (date / time — REAL labeled buttons) ───────

function FieldButton({ icon, value, ariaLabel, disabled }) {
  return (
    <button aria-label={ariaLabel} disabled={disabled} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 9,
      background: disabled ? E.raised : E.surface, border: `1.5px solid ${E.border}`, borderRadius: 8, padding: '10px 11px',
      cursor: disabled ? 'default' : 'pointer', textAlign: 'left', boxShadow: '0 1px 2px rgba(0,0,0,0.03)', opacity: disabled ? 0.7 : 1,
    }}>
      <i data-lucide={icon} style={{ width: 15, height: 15, color: E.blue600, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: E.fg1, letterSpacing: -0.1, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <i data-lucide="chevron-down" style={{ width: 15, height: 15, color: E.fg4 }} />
    </button>
  );
}

// ─── Conflict warning card (chip-led, semantic) ─────────────

function ConflictCard() {
  return (
    <div style={{
      background: E.warningBg, border: `1px solid ${E.warningBorder}`, borderRadius: 16, padding: '12px 13px',
      display: 'flex', flexDirection: 'column', gap: 9,
    }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start', padding: '3px 8px', borderRadius: 9999,
        background: E.warning, color: '#fff', fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
      }}>
        <i data-lucide="triangle-alert" style={{ width: 10, height: 10, strokeWidth: 2.6 }} /> Booking overlap
      </span>
      <div style={{ fontSize: 12, color: '#78350f', lineHeight: '16px' }}>
        This overlaps a confirmed 2:30 PM booking. Blocking won't cancel it.
      </div>
      <button style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
        background: 'transparent', border: 'none', padding: '1px 0', cursor: 'pointer', color: '#92400e', fontSize: 12, fontWeight: 700,
      }}>
        <i data-lucide="arrow-up-right" style={{ width: 13, height: 13 }} /> View booking
      </button>
    </div>
  );
}

// ─── Details card ─────────────────────────────────────────────

function DetailsCard({ reason, date, allDay, starts, ends, disabled }) {
  return (
    <Card pillar="personal">
      <TextInput label="Reason" value={reason} placeholder="Dentist" helper="Optional · only you can see this." disabled={disabled} />
      <div>
        <FieldLabel>Date</FieldLabel>
        <FieldButton icon="calendar" value={date} ariaLabel={`Date, ${date}`} disabled={disabled} />
      </div>
      <ToggleRow icon="sun" label="All day" sub="Block the whole day" on={allDay} disabled={disabled} last={allDay} />
      {!allDay && (
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <FieldLabel>Starts</FieldLabel>
            <FieldButton icon="clock" value={starts} ariaLabel={`Starts ${date} at ${starts}`} disabled={disabled} />
          </div>
          <div style={{ flex: 1 }}>
            <FieldLabel>Ends</FieldLabel>
            <FieldButton icon="clock" value={ends} ariaLabel={`Ends ${date} at ${ends}`} disabled={disabled} />
          </div>
        </div>
      )}
    </Card>
  );
}

function RepeatCard({ value, caption, disabled }) {
  return (
    <Card pillar="personal">
      <div>
        <FieldLabel>Repeats</FieldLabel>
        <FieldButton icon="repeat" value={value} ariaLabel={`Repeats, ${value}`} disabled={disabled} />
        {caption && <div style={{ fontSize: 11, color: E.fg3, marginTop: 7, lineHeight: '15px' }}>{caption}</div>}
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 1 · DEFAULT (single one-off block)
// ═══════════════════════════════════════════════════════════════

function FrameDefault() {
  return (
    <Phone label="Block off time — default">
      <DimmedEditor />
      <Scrim />
      <Sheet>
        <DetailsCard reason="Dentist" date="Thu, Jun 18" allDay={false} starts="2:00 PM" ends="3:00 PM" />
        <RepeatCard value="Does not repeat" />
      </Sheet>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 2 · RECURRING
// ═══════════════════════════════════════════════════════════════

function FrameRecurring() {
  return (
    <Phone label="Block off time — recurring">
      <DimmedEditor />
      <Scrim />
      <Sheet>
        <DetailsCard reason="Out Friday afternoons" date="Fri, Jun 19" allDay={false} starts="1:00 PM" ends="5:00 PM" />
        <RepeatCard value="Weekly" caption="Repeats every Friday · Ends never. Tap to add an end date." />
      </Sheet>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 3 · ALL DAY
// ═══════════════════════════════════════════════════════════════

function FrameAllDay() {
  return (
    <Phone label="Block off time — all day">
      <DimmedEditor />
      <Scrim />
      <Sheet>
        <DetailsCard reason="Conference" date="Thu, Jun 18" allDay={true} />
        <RepeatCard value="Does not repeat" />
      </Sheet>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 4 · CONFLICT WARNING
// ═══════════════════════════════════════════════════════════════

function FrameConflict() {
  return (
    <Phone label="Block off time — conflict warning">
      <DimmedEditor />
      <Scrim />
      <Sheet>
        <DetailsCard reason="Dentist" date="Thu, Jun 18" allDay={false} starts="2:00 PM" ends="3:00 PM" />
        <ConflictCard />
        <RepeatCard value="Does not repeat" />
      </Sheet>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 5 · SAVING
// ═══════════════════════════════════════════════════════════════

function FrameSaving() {
  return (
    <Phone label="Block off time — saving">
      <DimmedEditor />
      <Scrim />
      <Sheet saving>
        <DetailsCard reason="Dentist" date="Thu, Jun 18" allDay={false} starts="2:00 PM" ends="3:00 PM" disabled />
        <RepeatCard value="Does not repeat" disabled />
      </Sheet>
    </Phone>
  );
}

Object.assign(window, {
  FrameDefault, FrameRecurring, FrameAllDay, FrameConflict, FrameSaving,
});
