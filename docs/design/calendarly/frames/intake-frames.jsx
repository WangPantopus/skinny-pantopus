// Pantopus — Calendarly · Intake questions editor (bottom sheet)
// Archetype: Form (nested) — a ListOfRows of reorderable question rows inside a
// sheet, with the Form field-group idiom for add/edit. Mirrors List of Rows for
// the reorderable list and Form.html for the inline field group.
// Lives in: Event type / Service editor → "Intake questions" row (and Booking
// Page Management → Intake questions). Inherits the parent event type's pillar
// (Personal sky / Business violet) — used ONLY on the sheet title overline.
//
// Non-negotiables: product sky #0284C7 on all functional chrome; white cards,
// 1px border, 16px radius, shadow-sm, no left-border accents; Lucide stroke-2,
// no emoji; plainspoken second-person sentence case; shimmer skeletons.
//
// Reuses primitives from event-editor-shell.jsx (Phone, TopBar, HeaderPill,
// Body, Card, FieldLabel, TextInput, Segmented, Toggle) and the editor section
// cards from event-editor-frames.jsx (BasicsCard, LocationCard, LinksCard) for
// the dimmed background.

const accentOf = (pillar) => (pillar === 'business' ? E.business : E.personal);

// ─── Dimmed event-type editor behind the sheet ────────────────

function DimmedEditor({ pillar = 'personal', name = 'Intro call' }) {
  return (
    <>
      <TopBar />
      <HeaderPill pillar={pillar} />
      <Body>
        <BasicsCard pillar={pillar} name={name} desc="A quick 30-minute call to see if we're a fit." swatch={pillar === 'business' ? 4 : 1} />
        <LocationCard pillar={pillar} value="Video" />
        <LinksCard pillar={pillar} />
      </Body>
      <SaveBar />
    </>
  );
}

function Scrim() {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 15,
      background: 'rgba(17,24,39,0.42)',
    }} />
  );
}

// ─── Sheet shell ──────────────────────────────────────────────

function Sheet({ pillar = 'personal', subtitle = 'Intro call', children, top = 116 }) {
  const accent = accentOf(pillar);
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, top,
      background: E.surface, borderRadius: '24px 24px 0 0', zIndex: 20,
      boxShadow: '0 -10px 30px rgba(17,24,39,0.18)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* grabber */}
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 9, paddingBottom: 2, flexShrink: 0 }}>
        <div style={{ width: 38, height: 5, borderRadius: 9999, background: E.borderStrong }} />
      </div>
      {/* header */}
      <div style={{ padding: '8px 16px 10px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: accent, marginBottom: 3 }}>
              {pillar === 'business' ? 'Business' : 'Personal'} · {subtitle}
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: E.fg1, letterSpacing: -0.3 }}>Intake questions</div>
          </div>
          <button style={{
            background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 0 2px 12px',
            color: E.blue600, fontSize: 14.5, fontWeight: 700, letterSpacing: -0.1,
          }}>Done</button>
        </div>
      </div>
      <div style={{
        flex: 1, overflow: 'auto', padding: '2px 16px 22px',
        display: 'flex', flexDirection: 'column',
      }}>{children}</div>
    </div>
  );
}

// Section caption line.
function Caption({ children, style }) {
  return (
    <div style={{ fontSize: 11, color: E.fg3, lineHeight: '15px', ...style }}>{children}</div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: E.border }} />;
}

// ─── Rows ─────────────────────────────────────────────────────

// Locked default row — lock icon, label, "Always asked" caption. No toggle, no drag.
function LockedRow({ icon, label, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0',
      borderBottom: last ? 'none' : `1px solid ${E.border}`,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: E.sunken, color: E.fg3,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}><i data-lucide={icon} style={{ width: 15, height: 15, strokeWidth: 2 }} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: E.fg1, letterSpacing: -0.1 }}>{label}</div>
        <div style={{ fontSize: 10.5, color: E.fg4, marginTop: 1 }}>Always asked</div>
      </div>
      <i data-lucide="lock" style={{ width: 14, height: 14, color: E.fg4, strokeWidth: 2 }} />
    </div>
  );
}

function RequiredPill() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 9999,
      background: E.blue50, color: E.blue700, fontSize: 9, fontWeight: 700,
      letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>Required</span>
  );
}

// Custom question row — label, type caption, Required pill, drag handle, delete.
function QuestionRow({ label, type, required, last, dragActive, lifted, placeholder }) {
  if (placeholder) {
    return (
      <div style={{
        height: 52, border: `1.5px dashed ${E.blue200}`, borderRadius: 10, background: E.blue50,
        margin: '4px 0',
      }} />
    );
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0',
      borderBottom: (last || lifted) ? 'none' : `1px solid ${E.border}`,
      ...(lifted ? {
        background: E.surface, border: `1px solid ${E.border}`, borderRadius: 12,
        padding: '11px 12px', margin: '0 -4px',
        boxShadow: '0 14px 30px rgba(17,24,39,0.22), 0 2px 6px rgba(17,24,39,0.10)',
        position: 'relative', zIndex: 5, transform: 'scale(1.015)',
      } : {}),
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: E.fg1, letterSpacing: -0.1, lineHeight: '17px' }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 3 }}>
          <span style={{ fontSize: 11, color: E.fg3 }}>{type}</span>
          {required && <RequiredPill />}
        </div>
      </div>
      <button style={{
        width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: 'none', padding: 0, color: E.fg4, cursor: 'pointer',
      }}><i data-lucide="trash-2" style={{ width: 15, height: 15, strokeWidth: 2 }} /></button>
      <div style={{
        width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: dragActive ? E.fg2 : E.fg4, cursor: 'grab',
      }}><i data-lucide="grip-vertical" style={{ width: 16, height: 16, strokeWidth: 2 }} /></div>
    </div>
  );
}

// Inline add/edit field group (Form.html idiom).
const TYPE_OPTIONS = ['Short text', 'Paragraph', 'Dropdown', 'Multi-select', 'Checkbox', 'Phone'];

function TypeSelector({ value }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, padding: 4,
      background: E.sunken, borderRadius: 10,
    }}>
      {TYPE_OPTIONS.map((o) => {
        const on = o === value;
        return (
          <button key={o} style={{
            height: 30, borderRadius: 7, border: 'none', cursor: 'pointer',
            background: on ? E.surface : 'transparent', color: on ? E.blue700 : E.fg3,
            boxShadow: on ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            fontSize: 11, fontWeight: on ? 700 : 600, letterSpacing: -0.2, whiteSpace: 'nowrap',
          }}>{o}</button>
        );
      })}
    </div>
  );
}

const isSelectType = (t) => ['Dropdown', 'Multi-select', 'Checkbox'].includes(t);

function OptionsList({ options }) {
  return (
    <div>
      <FieldLabel>Options</FieldLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {options.map((o, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 9,
            border: `1.5px solid ${E.border}`, borderRadius: 8, padding: '8px 10px', background: E.surface,
          }}>
            <i data-lucide="grip-vertical" style={{ width: 14, height: 14, color: E.fg4, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 12.5, color: E.fg1, fontWeight: 500 }}>{o}</span>
            <i data-lucide="x" style={{ width: 14, height: 14, color: E.fg4, cursor: 'pointer' }} />
          </div>
        ))}
        <button style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
          background: 'transparent', border: 'none', padding: '2px 0', cursor: 'pointer',
          color: E.blue600, fontSize: 12, fontWeight: 600,
        }}>
          <i data-lucide="plus" style={{ width: 13, height: 13 }} /> Add option
        </button>
      </div>
    </div>
  );
}

function EditGroup({ question, type, required, options }) {
  return (
    <div style={{
      background: E.blue50, border: `1.5px solid ${E.blue200}`, borderRadius: 12,
      padding: 12, margin: '4px 0', display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <TextInput label="Question" value={question} />
      <div>
        <FieldLabel>Answer type</FieldLabel>
        <TypeSelector value={type} />
      </div>
      {isSelectType(type) && <OptionsList options={options || ['Option one', 'Option two']} />}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: E.surface, border: `1px solid ${E.border}`, borderRadius: 8, padding: '9px 11px',
      }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: E.fg1, letterSpacing: -0.1 }}>Make this required</span>
        <Toggle on={required} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button style={{
          flex: 1, height: 40, borderRadius: 10, border: 'none', background: E.blue600, color: '#fff',
          fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: -0.1,
        }}>Save question</button>
        <button style={{
          height: 40, padding: '0 6px', display: 'inline-flex', alignItems: 'center', gap: 5,
          background: 'transparent', border: 'none', cursor: 'pointer', color: E.error,
          fontSize: 12.5, fontWeight: 600,
        }}>
          <i data-lucide="trash-2" style={{ width: 15, height: 15 }} /> Delete
        </button>
      </div>
    </div>
  );
}

function AddButton() {
  return (
    <button style={{
      width: '100%', height: 44, marginTop: 12, borderRadius: 12, border: 'none',
      background: E.blue600, color: '#fff', cursor: 'pointer',
      fontSize: 13.5, fontWeight: 700, letterSpacing: -0.1,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
      boxShadow: '0 6px 16px rgba(2,132,199,0.26)', flexShrink: 0,
    }}>
      <i data-lucide="plus" style={{ width: 17, height: 17, strokeWidth: 2.4 }} /> Add a question
    </button>
  );
}

// Group container for the locked defaults + custom list (single white card body).
function ListBlock({ children }) {
  return <div style={{ display: 'flex', flexDirection: 'column' }}>{children}</div>;
}

function GroupLabel({ children }) {
  return (
    <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: E.fg4, margin: '14px 0 4px' }}>{children}</div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 1 · DEFAULTS ONLY
// ═══════════════════════════════════════════════════════════════

function FrameDefaults() {
  return (
    <Phone label="Intake — defaults only">
      <DimmedEditor pillar="personal" />
      <Scrim />
      <Sheet pillar="personal" subtitle="Intro call">
        <Caption style={{ marginBottom: 8 }}>Ask people a few things when they book. Name and email are always asked.</Caption>
        <ListBlock>
          <LockedRow icon="user" label="Name" />
          <LockedRow icon="mail" label="Email" last />
        </ListBlock>
        <GroupLabel>Your questions</GroupLabel>
        <Caption style={{ marginBottom: 2 }}>You haven't added any yet.</Caption>
        <AddButton />
      </Sheet>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 2 · WITH CUSTOM QUESTIONS
// ═══════════════════════════════════════════════════════════════

function FrameCustom() {
  return (
    <Phone label="Intake — with custom questions">
      <DimmedEditor pillar="personal" />
      <Scrim />
      <Sheet pillar="personal" subtitle="Intro call">
        <Caption style={{ marginBottom: 8 }}>Name and email are always asked.</Caption>
        <ListBlock>
          <LockedRow icon="user" label="Name" />
          <LockedRow icon="mail" label="Email" last />
        </ListBlock>
        <GroupLabel>Your questions</GroupLabel>
        <ListBlock>
          <QuestionRow label="What should we cover?" type="Paragraph" required />
          <QuestionRow label="Phone number" type="Phone" required />
          <QuestionRow label="How did you hear about us?" type="Dropdown" last />
        </ListBlock>
        <AddButton />
      </Sheet>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 3 · EDITING A QUESTION (field group expanded)
// ═══════════════════════════════════════════════════════════════

function FrameEditing() {
  return (
    <Phone label="Intake — editing a question">
      <DimmedEditor pillar="personal" />
      <Scrim />
      <Sheet pillar="personal" subtitle="Intro call" top={92}>
        <ListBlock>
          <LockedRow icon="user" label="Name" />
          <LockedRow icon="mail" label="Email" last />
        </ListBlock>
        <GroupLabel>Your questions</GroupLabel>
        <EditGroup question="What should we cover?" type="Paragraph" required />
        <ListBlock>
          <QuestionRow label="Phone number" type="Phone" required />
          <QuestionRow label="How did you hear about us?" type="Dropdown" last />
        </ListBlock>
        <AddButton />
      </Sheet>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 4 · REORDERING (drag handles active, one row lifted)
// ═══════════════════════════════════════════════════════════════

function FrameReorder() {
  return (
    <Phone label="Intake — reordering">
      <DimmedEditor pillar="personal" />
      <Scrim />
      <Sheet pillar="personal" subtitle="Intro call">
        <Caption style={{ marginBottom: 8 }}>Drag to reorder. Name and email are always asked.</Caption>
        <ListBlock>
          <LockedRow icon="user" label="Name" />
          <LockedRow icon="mail" label="Email" last />
        </ListBlock>
        <GroupLabel>Your questions</GroupLabel>
        <ListBlock>
          <QuestionRow label="Phone number" type="Phone" required lifted dragActive />
          <QuestionRow label="What should we cover?" type="Paragraph" required dragActive />
          <QuestionRow placeholder />
          <QuestionRow label="How did you hear about us?" type="Dropdown" dragActive last />
        </ListBlock>
        <AddButton />
      </Sheet>
    </Phone>
  );
}

Object.assign(window, {
  FrameDefaults, FrameCustom, FrameEditing, FrameReorder,
});
