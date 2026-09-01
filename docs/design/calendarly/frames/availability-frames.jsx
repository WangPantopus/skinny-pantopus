// Pantopus — Calendarly · Availability schedule list (MVP)
// Archetype: ListOfRows. Mirrors List of Rows for the named-schedule rows (default
// badge + set-as-default action) and A08 Support trains for the screen chrome
// (top bar + add). Empty/seed state borrows the A18 calm-empty idiom.
// Lives in: Personal → Scheduling → Availability. web /app/profile/schedule/availability.
// Also reached from the event-type schedule picker.
//
// Pillar: Personal sky — accent ONLY on the identity pill + overline. Every control
// stays product sky #0284C7. White cards, 1px border, 16px radius, shadow-sm, no
// left-border accents. Lucide stroke-2, no emoji. Shimmer skeletons.
//
// Reuses primitives from event-editor-shell.jsx (E, Phone, StatusBar, HeaderPill, SH).

// ─── Screen chrome ────────────────────────────────────────────

function SchedTopBar() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '6px 10px', height: 46,
      boxSizing: 'border-box', background: E.surface, borderBottom: `1px solid ${E.border}`, flexShrink: 0,
    }}>
      <button style={{
        width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: 'none', cursor: 'pointer', color: E.fg1, padding: 0,
      }}>
        <i data-lucide="chevron-left" style={{ width: 20, height: 20 }} />
      </button>
      <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 600, color: E.fg1, letterSpacing: -0.2 }}>Availability</div>
      <button style={{
        width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: 'none', cursor: 'pointer', color: E.blue600, padding: 0,
      }}>
        <i data-lucide="plus" style={{ width: 21, height: 21, strokeWidth: 2.2 }} />
      </button>
    </div>
  );
}

function HelperLine() {
  return (
    <div style={{ padding: '8px 14px 4px', flexShrink: 0 }}>
      <div style={{ fontSize: 11.5, color: E.fg3, lineHeight: '16px' }}>
        Times here are the source your home and business pages build from.
      </div>
    </div>
  );
}

function ScreenBody({ children, center }) {
  return (
    <div style={{
      flex: 1, overflow: 'auto', padding: center ? '0 16px' : '8px 14px 24px',
      display: 'flex', flexDirection: 'column', gap: 10,
      justifyContent: center ? 'center' : 'flex-start',
    }}>{children}</div>
  );
}

// ─── Default pill (filled sky) ───────────────────────────────

function DefaultPill() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 9999,
      background: E.blue600, color: '#fff', fontSize: 9, fontWeight: 700,
      letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>Default</span>
  );
}

// ─── Overflow menu ────────────────────────────────────────────

function MenuItem({ icon, label, danger, divider }) {
  return (
    <>
      {divider && <div style={{ height: 1, background: E.border, margin: '4px 0' }} />}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer',
        color: danger ? E.error : E.fg1,
      }}>
        <i data-lucide={icon} style={{ width: 15, height: 15, strokeWidth: 2, color: danger ? E.error : E.fg2 }} />
        <span style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: -0.1 }}>{label}</span>
      </div>
    </>
  );
}

function OverflowMenu({ showSetDefault = true }) {
  return (
    <div style={{
      position: 'absolute', top: 38, right: 6, width: 168, zIndex: 30,
      background: E.surface, border: `1px solid ${E.border}`, borderRadius: 12,
      boxShadow: '0 12px 30px rgba(17,24,39,0.18), 0 2px 6px rgba(17,24,39,0.08)',
      padding: '4px 0', overflow: 'hidden',
    }}>
      {showSetDefault && <MenuItem icon="calendar-check" label="Set as default" />}
      <MenuItem icon="pencil" label="Rename" />
      <MenuItem icon="copy" label="Duplicate" />
      <MenuItem icon="trash-2" label="Delete" danger divider />
    </div>
  );
}

// ─── Schedule row (white card) ───────────────────────────────

function ScheduleRow({ name, summary, tz, isDefault, menuOpen }) {
  return (
    <div style={{
      position: 'relative',
      background: E.surface, border: `1px solid ${E.border}`, borderRadius: 16,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '12px 12px',
      display: 'flex', alignItems: 'flex-start', gap: 11,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 9, flexShrink: 0, background: E.blue50, color: E.blue600,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}><i data-lucide="calendar-clock" style={{ width: 18, height: 18, strokeWidth: 2 }} /></div>

      <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, paddingRight: 28 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: E.fg1, letterSpacing: -0.1, whiteSpace: 'nowrap' }}>{name}</span>
          {isDefault && <DefaultPill />}
        </div>
        <div style={{ fontSize: 11.5, color: E.fg3, marginTop: 4, lineHeight: '16px' }}>
          {summary}<span style={{ color: E.fg4 }}> · </span><span style={{ fontWeight: 600, color: E.fg2 }}>{tz}</span>
        </div>
      </div>

      <button style={{
        position: 'absolute', top: 9, right: 7,
        width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: E.fg4,
      }}><i data-lucide="ellipsis-vertical" style={{ width: 18, height: 18, strokeWidth: 2 }} /></button>

      {menuOpen && <OverflowMenu showSetDefault={!isDefault} />}
    </div>
  );
}

// ─── Spec footnote (single-schedule shortcut) ────────────────

function SpecNote({ children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 7, padding: '10px 12px', marginTop: 2,
      background: E.raised, border: `1px solid ${E.border}`, borderRadius: 12,
    }}>
      <i data-lucide="info" style={{ width: 14, height: 14, color: E.fg4, strokeWidth: 2, flexShrink: 0, marginTop: 1 }} />
      <span style={{ fontSize: 11, color: E.fg3, lineHeight: '15px' }}>{children}</span>
    </div>
  );
}

// ─── Skeleton row (shimmer) ──────────────────────────────────

function SkeletonRow() {
  return (
    <div style={{
      background: E.surface, border: `1px solid ${E.border}`, borderRadius: 16,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '12px 12px',
      display: 'flex', alignItems: 'center', gap: 11,
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, ...SH }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ width: '52%', height: 12, borderRadius: 6, ...SH }} />
        <div style={{ width: '78%', height: 10, borderRadius: 6, ...SH }} />
      </div>
      <div style={{ width: 4, height: 18, borderRadius: 4, ...SH, flexShrink: 0 }} />
    </div>
  );
}

// ─── Empty state (A18 calm idiom) ────────────────────────────

function EmptyState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 6px 40px' }}>
      <div style={{
        width: 60, height: 60, borderRadius: 18, background: E.blue50, color: E.blue600,
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
      }}><i data-lucide="calendar-clock" style={{ width: 28, height: 28, strokeWidth: 1.9 }} /></div>
      <div style={{ fontSize: 16, fontWeight: 700, color: E.fg1, letterSpacing: -0.2, marginBottom: 6 }}>You don't have a schedule yet</div>
      <div style={{ fontSize: 12.5, color: E.fg3, lineHeight: '18px', maxWidth: 224, marginBottom: 20 }}>
        Set the hours you're open to bookings. Your home and business pages build from this.
      </div>
      <button style={{
        height: 44, padding: '0 20px', borderRadius: 12, border: 'none', background: E.blue600, color: '#fff',
        fontSize: 13.5, fontWeight: 700, cursor: 'pointer', letterSpacing: -0.1,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        boxShadow: '0 6px 16px rgba(2,132,199,0.26)',
      }}>
        <i data-lucide="plus" style={{ width: 17, height: 17, strokeWidth: 2.4 }} /> Add working hours
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 1 · SINGLE SCHEDULE
// ═══════════════════════════════════════════════════════════════

function FrameSingle() {
  return (
    <Phone label="Availability — single schedule">
      <SchedTopBar />
      <HeaderPill pillar="personal" />
      <HelperLine />
      <ScreenBody>
        <ScheduleRow name="Working hours" summary="Mon–Fri, 9:00 AM – 5:00 PM" tz="PT" isDefault />
        <SpecNote>With one schedule, this list is skipped — opening Availability drops you straight into the editor.</SpecNote>
      </ScreenBody>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 2 · MULTIPLE SCHEDULES (overflow menu open)
// ═══════════════════════════════════════════════════════════════

function FrameMultiple() {
  return (
    <Phone label="Availability — multiple schedules">
      <SchedTopBar />
      <HeaderPill pillar="personal" />
      <HelperLine />
      <ScreenBody>
        <ScheduleRow name="Working hours" summary="Mon–Fri, 9:00 AM – 5:00 PM" tz="PT" isDefault />
        <ScheduleRow name="Evenings" summary="Mon–Thu, 6:00 – 9:00 PM" tz="PT" menuOpen />
        <ScheduleRow name="Weekends" summary="Sat–Sun, 10:00 AM – 4:00 PM" tz="ET" />
      </ScreenBody>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 3 · EMPTY (seed default)
// ═══════════════════════════════════════════════════════════════

function FrameEmpty() {
  return (
    <Phone label="Availability — empty">
      <SchedTopBar />
      <HeaderPill pillar="personal" />
      <ScreenBody center>
        <EmptyState />
      </ScreenBody>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 4 · LOADING (shimmer skeleton)
// ═══════════════════════════════════════════════════════════════

function FrameLoading() {
  return (
    <Phone label="Availability — loading">
      <SchedTopBar />
      <HeaderPill pillar="personal" />
      <HelperLine />
      <ScreenBody>
        <SkeletonRow />
        <SkeletonRow />
      </ScreenBody>
    </Phone>
  );
}

Object.assign(window, {
  FrameSingle, FrameMultiple, FrameEmpty, FrameLoading,
});
