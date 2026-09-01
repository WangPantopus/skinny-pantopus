// Pantopus — Calendarly · Date overrides & holidays (sheet)
// Archetype: ListOfRows + date picker, in a bottom sheet over the dimmed
// Availability editor. Mirrors A14.8 Vacation hold for the date-block / date-range
// mechanic, List of Rows for the existing-overrides list, and Form.html for the
// per-date custom-hours field group.
// Lives in: Availability schedule editor → "Date overrides & holidays" row.
//
// Pillar: Personal sky — accent ONLY on the sheet overline. Every control stays
// product sky #0284C7. White cards, 1px border, 16px radius, shadow-sm, no
// left-border accents. Lucide stroke-2, no emoji. Shimmer skeletons.
//
// Reuses primitives from event-editor-shell.jsx (E, Phone, StatusBar, TopBar,
// HeaderPill, Card, FieldLabel, Segmented, Toggle, ToggleRow, SH).

// ─── Dimmed Availability editor (background) ─────────────────

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

function DimmedAvailability() {
  return (
    <>
      <TopBar title="Edit schedule" />
      <HeaderPill pillar="personal" />
      <div style={{ flex: 1, overflow: 'hidden', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Card overline="Timezone" pillar="personal">
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9, border: `1.5px solid ${E.border}`, borderRadius: 8, padding: '10px 11px',
          }}>
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

function Sheet({ children, top = 92 }) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, top, zIndex: 20,
      background: E.surface, borderRadius: '24px 24px 0 0', boxShadow: '0 -10px 30px rgba(17,24,39,0.18)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 9, paddingBottom: 2, flexShrink: 0 }}>
        <div style={{ width: 38, height: 5, borderRadius: 9999, background: E.borderStrong }} />
      </div>
      <div style={{ padding: '8px 16px 10px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: E.personal, marginBottom: 3 }}>Personal · Working hours</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: E.fg1, letterSpacing: -0.3 }}>Date overrides</div>
          </div>
          <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 0 2px 12px', color: E.blue600, fontSize: 14.5, fontWeight: 700, letterSpacing: -0.1 }}>Done</button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '2px 16px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  );
}

// ─── Month calendar ───────────────────────────────────────────

const WK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function MonthCalendar({ title = 'July 2026', firstWeekday = 1, days = 31, selected, range, holidays = [] }) {
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  const inRange = (d) => range && d >= range[0] && d <= range[1];
  return (
    <div style={{
      background: E.surface, border: `1px solid ${E.border}`, borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      padding: '12px 12px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 2px' }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: E.fg1, letterSpacing: -0.2 }}>{title}</div>
        <div style={{ display: 'flex', gap: 2 }}>
          <button style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: E.fg3, padding: 0 }}><i data-lucide="chevron-left" style={{ width: 17, height: 17 }} /></button>
          <button style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: E.fg3, padding: 0 }}><i data-lucide="chevron-right" style={{ width: 17, height: 17 }} /></button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 4 }}>
        {WK.map((w, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 9.5, fontWeight: 700, color: E.fg4, padding: '2px 0' }}>{w}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: '30px', gap: 1 }}>
        {cells.map((d, i) => {
          if (d == null) return <div key={i} />;
          const sel = d === selected;
          const rng = inRange(d);
          const hol = holidays.includes(d);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: rng && !sel ? E.blue50 : 'transparent', borderRadius: rng ? 0 : undefined }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: sel ? E.blue600 : 'transparent', cursor: 'pointer', position: 'relative',
              }}>
                <span style={{ fontSize: 12, fontWeight: sel ? 700 : 500, color: sel ? '#fff' : E.fg1, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{d}</span>
                {hol && !sel && <span style={{ position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: '50%', background: E.blue600 }} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Time-range picker (custom hours) ────────────────────────

function TimeRangeButton({ range = '10:00 AM – 2:00 PM' }) {
  const [start, end] = range.split(' – ');
  return (
    <button aria-label={`Custom hours, ${start} to ${end}. Edit time range.`} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
      background: E.surface, border: `1.5px solid ${E.border}`, borderRadius: 9, padding: '9px 11px',
      cursor: 'pointer', textAlign: 'left', boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
    }}>
      <i data-lucide="clock" style={{ width: 14, height: 14, color: E.blue600, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: E.fg1, letterSpacing: -0.1, fontVariantNumeric: 'tabular-nums' }}>{range}</span>
      <i data-lucide="chevron-down" style={{ width: 15, height: 15, color: E.fg4 }} />
    </button>
  );
}

// ─── Picker block: segmented choice + action for the selected date ──

function PickerBlock({ dateLabel = 'Saturday, Jul 4', choice = 'Unavailable' }) {
  const custom = choice === 'Custom hours';
  return (
    <div style={{
      background: E.surface, border: `1px solid ${E.border}`, borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      padding: '13px 13px', display: 'flex', flexDirection: 'column', gap: 11,
    }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: E.personal }}>{dateLabel}</div>
      <Segmented options={['Unavailable', 'Custom hours']} value={choice} />
      {custom ? (
        <>
          <FieldLabel>Hours for this day</FieldLabel>
          <TimeRangeButton />
          <button style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
            background: 'transparent', border: 'none', padding: '1px 0', cursor: 'pointer', color: E.blue600, fontSize: 12, fontWeight: 600,
          }}><i data-lucide="plus" style={{ width: 13, height: 13, strokeWidth: 2.4 }} /> Add a block</button>
        </>
      ) : (
        <div style={{ fontSize: 11.5, color: E.fg3, lineHeight: '16px' }}>People can't book you on this date.</div>
      )}
      <button style={{
        width: '100%', height: 42, borderRadius: 11, border: 'none', background: E.blue600, color: '#fff',
        fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: -0.1,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        boxShadow: '0 6px 16px rgba(2,132,199,0.26)',
      }}>
        <i data-lucide={custom ? 'clock' : 'calendar-off'} style={{ width: 15, height: 15 }} />
        {custom ? 'Add custom hours for this day' : 'Block this date'}
      </button>
    </div>
  );
}

function RangeLink() {
  return (
    <button style={{
      display: 'flex', alignItems: 'center', gap: 9, width: '100%',
      background: 'transparent', border: 'none', padding: '4px 2px', cursor: 'pointer', textAlign: 'left',
    }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: E.sunken, color: E.fg2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <i data-lucide="calendar-range" style={{ width: 15, height: 15 }} />
      </div>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: E.fg1, letterSpacing: -0.1 }}>Block a date range</span>
      <i data-lucide="chevron-right" style={{ width: 16, height: 16, color: E.fg4 }} />
    </button>
  );
}

// ─── Overrides list ──────────────────────────────────────────

function SectionLabel({ children }) {
  return <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: E.fg4, margin: '4px 2px 0' }}>{children}</div>;
}

function OverrideRow({ date, detail, custom, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 11, padding: '11px 0',
      borderBottom: last ? 'none' : `1px solid ${E.border}`,
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
        background: custom ? E.blue50 : E.sunken, color: custom ? E.blue600 : E.fg3,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}><i data-lucide={custom ? 'clock' : 'calendar-off'} style={{ width: 16, height: 16, strokeWidth: 2 }} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: E.fg1, letterSpacing: -0.1 }}>{date}</div>
        <div style={{ fontSize: 11.5, color: E.fg3, marginTop: 2 }}>{detail}</div>
      </div>
      <button aria-label={`Delete override for ${date}`} style={{
        width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: 'none', cursor: 'pointer', color: E.fg4, padding: 0,
      }}><i data-lucide="trash-2" style={{ width: 15, height: 15, strokeWidth: 2 }} /></button>
    </div>
  );
}

function OverridesCard({ children }) {
  return (
    <div style={{ background: E.surface, border: `1px solid ${E.border}`, borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '4px 13px' }}>{children}</div>
  );
}

function EmptyOverrides() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '16px 12px 8px' }}>
      <div style={{ width: 44, height: 44, borderRadius: 13, background: E.sunken, color: E.fg4, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
        <i data-lucide="calendar-x" style={{ width: 21, height: 21, strokeWidth: 1.9 }} />
      </div>
      <div style={{ fontSize: 12.5, color: E.fg3, lineHeight: '17px', maxWidth: 210 }}>No date overrides yet. Pick a date to add one.</div>
    </div>
  );
}

// ─── Holiday sets ─────────────────────────────────────────────

function HolidaySetsCard({ on }) {
  return (
    <Card overline="Holiday sets" pillar="personal">
      <ToggleRow
        icon="flag"
        label="US public holidays"
        sub={on ? 'Adds 11 days off this year' : 'Block major US holidays automatically'}
        on={on}
        last
      />
    </Card>
  );
}

function HolidayRow({ date, name, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0',
      borderBottom: last ? 'none' : `1px solid ${E.border}`,
    }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: E.sunken, color: E.fg3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <i data-lucide="calendar-off" style={{ width: 16, height: 16, strokeWidth: 2 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: E.fg1, letterSpacing: -0.1 }}>{date}</div>
        <div style={{ fontSize: 11.5, color: E.fg3, marginTop: 2 }}>{name}</div>
      </div>
      <span style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: E.fg3,
        background: E.sunken, borderRadius: 9999, padding: '3px 8px', whiteSpace: 'nowrap',
      }}>Holiday</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 1 · NONE (empty)
// ═══════════════════════════════════════════════════════════════

function FrameEmpty() {
  return (
    <Phone label="Date overrides — empty">
      <DimmedAvailability />
      <Scrim />
      <Sheet>
        <MonthCalendar selected={4} />
        <PickerBlock dateLabel="Thursday, Jul 4" choice="Unavailable" />
        <RangeLink />
        <SectionLabel>Overrides</SectionLabel>
        <OverridesCard><EmptyOverrides /></OverridesCard>
      </Sheet>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 2 · WITH OVERRIDES
// ═══════════════════════════════════════════════════════════════

function FrameOverrides() {
  return (
    <Phone label="Date overrides — with overrides">
      <DimmedAvailability />
      <Scrim />
      <Sheet>
        <SectionLabel>Overrides</SectionLabel>
        <OverridesCard>
          <OverrideRow date="Thu, Jul 4" detail="Unavailable" />
          <OverrideRow date="Fri, Aug 1" detail="10:00 AM – 2:00 PM" custom />
          <OverrideRow date="Dec 24–26" detail="Unavailable" last />
        </OverridesCard>
        <HolidaySetsCard on={false} />
        <RangeLink />
        <MonthCalendar selected={4} holidays={[4]} />
      </Sheet>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 3 · EDITING (custom hours)
// ═══════════════════════════════════════════════════════════════

function FrameEditing() {
  return (
    <Phone label="Date overrides — custom hours">
      <DimmedAvailability />
      <Scrim />
      <Sheet>
        <MonthCalendar selected={1} title="August 2026" firstWeekday={5} days={31} />
        <PickerBlock dateLabel="Friday, Aug 1" choice="Custom hours" />
        <RangeLink />
      </Sheet>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 4 · HOLIDAY-SET IMPORT
// ═══════════════════════════════════════════════════════════════

function FrameHolidays() {
  return (
    <Phone label="Date overrides — holiday import">
      <DimmedAvailability />
      <Scrim />
      <Sheet>
        <HolidaySetsCard on={true} />
        <SectionLabel>From US public holidays</SectionLabel>
        <OverridesCard>
          <HolidayRow date="Jan 1" name="New Year's Day" />
          <HolidayRow date="Jul 4" name="Independence Day" />
          <HolidayRow date="Nov 26" name="Thanksgiving" />
          <HolidayRow date="Dec 25" name="Christmas Day" last />
        </OverridesCard>
        <div style={{ fontSize: 11, color: E.fg3, lineHeight: '15px', padding: '0 2px' }}>
          Holidays are blocked as a set. Turn the set off to remove them all at once.
        </div>
      </Sheet>
    </Phone>
  );
}

Object.assign(window, {
  FrameEmpty, FrameOverrides, FrameEditing, FrameHolidays,
});
