// Pantopus — Calendarly · Availability schedule editor (weekly hours, MVP)
// Archetype: Form. Reuses the Support Train weekday + time-range grid primitive:
// one row per weekday with a left on/off toggle and, when on, one or more REAL
// labeled time-range buttons (full label: day, start, end) plus a "+ Add a block".
// A per-row "Copy to other days" clones hours. Mirrors Form.html for the timezone
// selector, link-out rows, and save bar; A14.8 for the date-block link idiom.
//
// This is the atomic source of truth for the "home & business compose personal
// availability" model — it must read as the canonical input.
//
// Pillar: Personal sky — accent ONLY on the pill + overline. Every control stays
// product sky #0284C7. White cards, 1px border, 16px radius, shadow-sm, no
// left-border accents. Lucide stroke-2, no emoji. Shimmer skeletons.
//
// Reuses primitives from event-editor-shell.jsx (E, Phone, TopBar, HeaderPill,
// Body, Card, FieldLabel, TextInput, Toggle, ToggleRow, LinkRow, SaveBar, SH).

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ─── Name card ────────────────────────────────────────────────

function NameCard({ disabled }) {
  return (
    <Card overline="Schedule" pillar="personal">
      <TextInput label="Name" value="Working hours" disabled={disabled} />
    </Card>
  );
}

// ─── Timezone card ────────────────────────────────────────────

function TimezoneCard({ locked, disabled }) {
  return (
    <Card overline="Timezone" pillar="personal">
      <div>
        <FieldLabel>Time zone</FieldLabel>
        <button style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 9,
          background: disabled ? E.raised : E.surface, border: `1.5px solid ${E.border}`, borderRadius: 8,
          padding: '10px 11px', cursor: disabled ? 'default' : 'pointer', textAlign: 'left',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)', opacity: disabled ? 0.7 : 1,
        }}>
          <i data-lucide="globe" style={{ width: 15, height: 15, color: E.fg3, flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: E.fg1, letterSpacing: -0.1 }}>
            Pacific Time <span style={{ color: E.fg4, fontWeight: 400 }}>· auto</span>
          </span>
          <i data-lucide="chevron-down" style={{ width: 16, height: 16, color: E.fg4 }} />
        </button>
      </div>
      <ToggleRow icon="lock" label="Lock to my timezone" sub="Keep these hours even when you travel" on={locked} disabled={disabled} last />
    </Card>
  );
}

// ─── Time-range picker button (a REAL labeled button) ─────────

function TimeRangeButton({ day, range, removable, disabled }) {
  const [start, end] = range.split(' – ');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <button
        aria-label={`${day}, ${start} to ${end}. Edit time range.`}
        style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 8,
          background: disabled ? E.raised : E.surface, border: `1.5px solid ${E.border}`, borderRadius: 9,
          padding: '9px 11px', cursor: disabled ? 'default' : 'pointer', textAlign: 'left',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)', opacity: disabled ? 0.7 : 1,
        }}>
        <i data-lucide="clock" style={{ width: 14, height: 14, color: E.blue600, flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: E.fg1, letterSpacing: -0.1, fontVariantNumeric: 'tabular-nums' }}>{range}</span>
        <i data-lucide="chevron-down" style={{ width: 15, height: 15, color: E.fg4 }} />
      </button>
      {removable && !disabled && (
        <button aria-label={`Remove ${range}`} style={{
          width: 30, height: 30, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer', color: E.fg4, padding: 0,
        }}><i data-lucide="x" style={{ width: 15, height: 15 }} /></button>
      )}
    </div>
  );
}

function AddBlockButton({ disabled }) {
  return (
    <button style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
      background: 'transparent', border: 'none', padding: '3px 0', cursor: disabled ? 'default' : 'pointer',
      color: disabled ? E.fg4 : E.blue600, fontSize: 12, fontWeight: 600, opacity: disabled ? 0.6 : 1,
    }}>
      <i data-lucide="plus" style={{ width: 13, height: 13, strokeWidth: 2.4 }} /> Add a block
    </button>
  );
}

// ─── Copy-to-other-days popover ──────────────────────────────

function CopyMenu({ sourceDay, up }) {
  const targets = DAYS.filter((d) => d !== sourceDay);
  const checked = ['Tuesday', 'Wednesday', 'Thursday', 'Friday'].filter((d) => d !== sourceDay);
  return (
    <div style={{
      position: 'absolute', ...(up ? { bottom: 34 } : { top: 34 }), right: 0, width: 192, zIndex: 30,
      background: E.surface, border: `1px solid ${E.border}`, borderRadius: 12,
      boxShadow: '0 12px 30px rgba(17,24,39,0.18), 0 2px 6px rgba(17,24,39,0.08)',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '10px 12px 8px', borderBottom: `1px solid ${E.border}` }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: E.fg1, letterSpacing: -0.1 }}>Copy to other days</div>
        <div style={{ fontSize: 10.5, color: E.fg3, marginTop: 1 }}>{sourceDay}'s hours</div>
      </div>
      <div style={{ padding: '4px 0', maxHeight: 168, overflow: 'auto' }}>
        {targets.map((d) => {
          const on = checked.includes(d);
          return (
            <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 12px', cursor: 'pointer' }}>
              <div style={{
                width: 17, height: 17, borderRadius: 5, flexShrink: 0,
                background: on ? E.blue600 : E.surface, border: `1.5px solid ${on ? E.blue600 : E.borderStrong}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{on && <i data-lucide="check" style={{ width: 11, height: 11, color: '#fff', strokeWidth: 3 }} />}</div>
              <span style={{ fontSize: 12.5, color: E.fg1, fontWeight: 500 }}>{d}</span>
            </div>
          );
        })}
      </div>
      <div style={{ padding: 8, borderTop: `1px solid ${E.border}` }}>
        <button style={{
          width: '100%', height: 34, borderRadius: 8, border: 'none', background: E.blue600, color: '#fff',
          fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: -0.1,
        }}>Copy to {checked.length} days</button>
      </div>
    </div>
  );
}

// ─── Weekday row ──────────────────────────────────────────────

function DayRow({ day, on, blocks, last, disabled, copyMenu }) {
  const ranges = blocks || ['9:00 AM – 5:00 PM'];
  return (
    <div style={{
      padding: '11px 0', borderBottom: last ? 'none' : `1px solid ${E.border}`,
      opacity: disabled ? 0.7 : 1,
    }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 11 }}>
        <Toggle on={on} disabled={disabled} />
        <span style={{ fontSize: 13, fontWeight: 600, color: on ? E.fg1 : E.fg3, letterSpacing: -0.1 }}>{day}</span>
        <span style={{ flex: 1 }} />
        {on ? (
          <button aria-label={`Copy ${day}'s hours to other days`} style={{
            width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none', cursor: disabled ? 'default' : 'pointer', color: E.fg4, padding: 0,
          }}><i data-lucide="copy" style={{ width: 15, height: 15, strokeWidth: 2 }} /></button>
        ) : (
          <span style={{ fontSize: 11.5, color: E.fg4, fontWeight: 500 }}>Unavailable</span>
        )}
        {copyMenu && <CopyMenu sourceDay={day} up={copyMenu === 'up'} />}
      </div>
      {on && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10, paddingLeft: 47 }}>
          {ranges.map((r, i) => (
            <TimeRangeButton key={i} day={day} range={r} removable={ranges.length > 1} disabled={disabled} />
          ))}
          <AddBlockButton disabled={disabled} />
        </div>
      )}
    </div>
  );
}

function WeekGrid({ days, disabled }) {
  return (
    <Card overline="Weekly hours" pillar="personal">
      {DAYS.map((d, i) => {
        const cfg = days[d] || { on: false };
        return <DayRow key={d} day={d} on={cfg.on} blocks={cfg.blocks} copyMenu={cfg.copyMenu} disabled={disabled} last={i === DAYS.length - 1} />;
      })}
    </Card>
  );
}

// ─── Quick-default button ─────────────────────────────────────

function QuickDefaultButton({ block }) {
  const Btn = (
    <button style={{
      width: '100%', height: 42, borderRadius: 10, cursor: 'pointer',
      background: E.blue50, border: `1px solid ${E.blue200}`, color: E.blue700,
      fontSize: 13, fontWeight: 700, letterSpacing: -0.1,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    }}>
      <i data-lucide="wand-sparkles" style={{ width: 15, height: 15 }} /> Use 9–5, Mon–Fri
    </button>
  );
  return block ? <div>{Btn}</div> : Btn;
}

// ─── Warning card (all day off) ──────────────────────────────

function WarningCard() {
  return (
    <div style={{
      background: E.warningBg, border: `1px solid ${E.warningBorder}`, borderRadius: 16, padding: '13px 13px',
      display: 'flex', flexDirection: 'column', gap: 11,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <i data-lucide="triangle-alert" style={{ width: 17, height: 17, color: E.warning, strokeWidth: 2, flexShrink: 0, marginTop: 1 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#92400e', letterSpacing: -0.1, marginBottom: 2 }}>No hours set</div>
          <div style={{ fontSize: 11.5, color: '#78350f', lineHeight: '16px' }}>People can't book you until you add at least one block.</div>
        </div>
      </div>
      <QuickDefaultButton />
    </div>
  );
}

// ─── Composition-gap explainer (empty entry from Home scheduler) ──

function CompositionGapCard() {
  return (
    <div style={{
      background: E.blue50, border: `1px solid ${E.blue200}`, borderRadius: 16, padding: '13px 13px',
      display: 'flex', alignItems: 'flex-start', gap: 10,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: E.blue100, color: E.blue700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}><i data-lucide="layers" style={{ width: 16, height: 16, strokeWidth: 2 }} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: E.fg1, letterSpacing: -0.1, marginBottom: 2 }}>Start with your hours</div>
        <div style={{ fontSize: 11.5, color: E.fg2, lineHeight: '16px' }}>Your family and business pages build on these hours, so set them first.</div>
      </div>
    </div>
  );
}

// ─── Empty hero ───────────────────────────────────────────────

function EmptyHero() {
  return (
    <Card pillar="personal">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '8px 4px 4px' }}>
        <div style={{
          width: 54, height: 54, borderRadius: 16, background: E.blue50, color: E.blue600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
        }}><i data-lucide="calendar-clock" style={{ width: 26, height: 26, strokeWidth: 1.9 }} /></div>
        <div style={{ fontSize: 16, fontWeight: 700, color: E.fg1, letterSpacing: -0.2, marginBottom: 6 }}>Set your hours</div>
        <div style={{ fontSize: 12.5, color: E.fg3, lineHeight: '18px', maxWidth: 226, marginBottom: 16 }}>
          Tell people the days and times you're open to bookings. You can fine-tune any day after.
        </div>
        <QuickDefaultButton block />
      </div>
    </Card>
  );
}

// ─── Link-out card (Form idiom) ──────────────────────────────

function LinksCard() {
  return (
    <Card pillar="personal">
      <LinkRow icon="calendar-x" label="Date overrides & holidays" value="None set" />
      <LinkRow icon="sliders-horizontal" label="Booking limits & notice rules" value="Defaults" last />
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 1 · DEFAULT (Mon–Fri 9–5, copy menu open on Monday)
// ═══════════════════════════════════════════════════════════════

const WEEKDAYS_9_5 = {
  Monday: { on: true }, Tuesday: { on: true }, Wednesday: { on: true },
  Thursday: { on: true }, Friday: { on: true }, Saturday: { on: false }, Sunday: { on: false },
};

function FrameDefault() {
  return (
    <Phone label="Weekly hours — default 9–5">
      <TopBar title="Edit schedule" />
      <HeaderPill pillar="personal" />
      <Body>
        <NameCard />
        <TimezoneCard locked={false} />
        <WeekGrid days={WEEKDAYS_9_5} />
        <LinksCard />
      </Body>
      <SaveBar label="Save schedule" />
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 2 · MULTI-BLOCK DAY (Wednesday split)
// ═══════════════════════════════════════════════════════════════

function FrameMultiBlock() {
  const days = {
    Monday: { on: true }, Tuesday: { on: true },
    Wednesday: { on: true, blocks: ['9:00 AM – 12:00 PM', '1:00 PM – 5:00 PM'], copyMenu: 'up' },
    Thursday: { on: true }, Friday: { on: true }, Saturday: { on: false }, Sunday: { on: false },
  };
  return (
    <Phone label="Weekly hours — multi-block day">
      <TopBar title="Edit schedule" />
      <HeaderPill pillar="personal" />
      <Body>
        <WeekGrid days={days} />
        <LinksCard />
      </Body>
      <SaveBar label="Save schedule" />
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 3 · ALL-DAY-OFF WARNING
// ═══════════════════════════════════════════════════════════════

function FrameWarning() {
  const days = Object.fromEntries(DAYS.map((d) => [d, { on: false }]));
  return (
    <Phone label="Weekly hours — all days off warning">
      <TopBar title="Edit schedule" />
      <HeaderPill pillar="personal" />
      <Body>
        <WarningCard />
        <WeekGrid days={days} />
      </Body>
      <SaveBar label="Save schedule" />
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 4 · EMPTY / UNSET (composition-gap entry)
// ═══════════════════════════════════════════════════════════════

function FrameEmpty() {
  return (
    <Phone label="Weekly hours — empty / unset">
      <TopBar title="Set hours" />
      <HeaderPill pillar="personal" />
      <Body>
        <CompositionGapCard />
        <EmptyHero />
        <LinksCard />
      </Body>
      <SaveBar label="Save schedule" />
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 5 · SAVING (grid disabled, save bar shimmer)
// ═══════════════════════════════════════════════════════════════

function FrameSaving() {
  return (
    <Phone label="Weekly hours — saving">
      <TopBar title="Edit schedule" saving />
      <HeaderPill pillar="personal" />
      <Body>
        <NameCard disabled />
        <TimezoneCard locked={false} disabled />
        <WeekGrid days={WEEKDAYS_9_5} disabled />
      </Body>
      <SaveBar saving />
    </Phone>
  );
}

Object.assign(window, {
  FrameDefault, FrameMultiBlock, FrameWarning, FrameEmpty, FrameSaving,
});
