// Pantopus — A13.1 · Add guest (simple form variant)
// File: src/app/homes/[id]/members/add-guest.tsx
// Inherits the Form (single screen) archetype: top bar (X + title), sectioned
// fields, 44px inputs, 8px radius, overlines. Issuing a guest pass = weighted
// commit → uses optional sticky-bottom CTA instead of a top-bar text button.
//
// Two frames:
//   FrameAddGuestFilled  — populated + valid, CTA enabled
//   FrameAddGuestInitial — pristine, first field focused, CTA disabled
//
// Atoms imported from form-frames.jsx via window globals.

const {
  F, Phone, TopBar, OverlineLabel, FieldLabel,
  Input, Textarea, Section, ScrollArea,
} = window;

// ─── Local atoms (specific to chip pickers used here) ──────────

function SelectChip({ label, leading, selected, dashed }) {
  const bg = selected ? F.primary50 : F.surface;
  const fg = selected ? F.primary700 : F.fg2;
  const bd = selected ? F.primary100 : (dashed ? 'transparent' : F.border);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '8px 12px', borderRadius: 9999,
      background: bg, color: fg,
      border: dashed && !selected ? `1px dashed ${F.borderStrong}` : `1px solid ${bd}`,
      fontSize: 12.5, fontWeight: selected ? 600 : 500,
      letterSpacing: -0.1, cursor: 'pointer',
      boxShadow: selected ? '0 1px 2px rgba(2,132,199,0.10)' : 'none',
      transition: 'all 120ms',
    }}>
      {leading && <i data-lucide={leading} style={{ width: 13, height: 13, color: selected ? F.primary600 : F.fg3 }} />}
      {label}
    </span>
  );
}

function ChipRow({ children, wrap = true }) {
  return (
    <div style={{
      display: 'flex', flexWrap: wrap ? 'wrap' : 'nowrap', gap: 8,
    }}>{children}</div>
  );
}

function StickyCTA({ label, disabled, icon = 'key-round' }) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'rgba(255,255,255,0.96)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      borderTop: `1px solid ${F.border}`,
      padding: '12px 16px 28px', zIndex: 10,
    }}>
      <button disabled={disabled} style={{
        width: '100%', height: 46, borderRadius: 12, border: 'none',
        background: disabled ? '#e5e7eb' : F.primary600,
        color: disabled ? F.fg4 : '#fff',
        fontSize: 14, fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled ? 'none' : '0 6px 16px rgba(2,132,199,0.28)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        letterSpacing: -0.1,
      }}>
        <i data-lucide={icon} style={{ width: 16, height: 16 }} />
        {label}
      </button>
    </div>
  );
}

// Inline helper: house-context strip above the form (which home this pass is for)
function HomeContextStrip({ label = '412 Elm St · Apt 3B', sub = 'Kovács household' }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px', background: F.primary50,
      border: `1px solid ${F.primary100}`,
      borderRadius: 10,
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8,
        background: 'linear-gradient(135deg,#16a34a,#15803d)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', flexShrink: 0,
      }}>
        <i data-lucide="home" style={{ width: 15, height: 15 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: F.fg1, letterSpacing: -0.1 }}>{label}</div>
        <div style={{ fontSize: 11, color: F.fg3, marginTop: 1 }}>{sub}</div>
      </div>
      <span style={{
        fontSize: 9.5, fontWeight: 700, letterSpacing: 0.1,
        color: '#15803d', background: '#dcfce7',
        padding: '3px 7px', borderRadius: 4, textTransform: 'uppercase',
      }}>Guest pass</span>
    </div>
  );
}

// ─── FRAME · POPULATED ─────────────────────────────────────────

function FrameAddGuestFilled() {
  const durationOptions = ['2 hours', 'Today', 'Weekend', 'Custom…'];
  const selectedDuration = 'Weekend';

  const areaOptions = [
    { label: 'Front door',  icon: 'door-open' },
    { label: 'Garage',      icon: 'car' },
    { label: 'Mailroom',    icon: 'mailbox' },
    { label: 'Backyard',    icon: 'trees' },
    { label: 'Garden shed', icon: 'warehouse' },
  ];
  const selectedAreas = ['Front door', 'Garage'];

  return (
    <Phone>
      <TopBar title="Add guest" />
      <ScrollArea bottomPad={110}>

        <HomeContextStrip />

        <Section overline="Guest">
          <div>
            <FieldLabel required>Name</FieldLabel>
            <Input value="Sasha Petrov" state="valid" />
          </div>
          <div>
            <FieldLabel required>Email or phone</FieldLabel>
            <Input
              value="sasha@petrov.co"
              state="valid"
              type="email"
              helper="We'll text or email them a one-tap pass link."
            />
          </div>
        </Section>

        <Section overline="Access window">
          <div>
            <FieldLabel required>Duration</FieldLabel>
            <ChipRow>
              {durationOptions.map(opt => (
                <SelectChip
                  key={opt}
                  label={opt}
                  selected={opt === selectedDuration}
                />
              ))}
            </ChipRow>
            <div style={{
              fontSize: 11, color: F.fg3, marginTop: 10, fontStyle: 'italic',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              <i data-lucide="clock" style={{ width: 11, height: 11, fontStyle: 'normal' }} />
              <span>Sat 12:00 AM → Sun 11:59 PM · auto-revokes after</span>
            </div>
          </div>
          <div>
            <FieldLabel>Allowed areas</FieldLabel>
            <ChipRow>
              {areaOptions.map(a => (
                <SelectChip
                  key={a.label}
                  label={a.label}
                  leading={a.icon}
                  selected={selectedAreas.includes(a.label)}
                />
              ))}
            </ChipRow>
            <div style={{ fontSize: 11, color: F.fg3, marginTop: 8, fontStyle: 'italic' }}>
              Sasha's pass unlocks only what you pick.
            </div>
          </div>
        </Section>

        <Section overline="Note">
          <div>
            <FieldLabel>Welcome message (optional)</FieldLabel>
            <Textarea
              value="Hey Sasha — plants twice this weekend, water bowl is in the kitchen. Pass also opens the garage if you park inside."
              height={92}
              charCount="124 / 240"
            />
          </div>
        </Section>

      </ScrollArea>
      <StickyCTA label="Send pass" />
    </Phone>
  );
}

// ─── FRAME · INITIAL (pristine) ────────────────────────────────

function FrameAddGuestInitial() {
  const durationOptions = ['2 hours', 'Today', 'Weekend', 'Custom…'];
  const areaOptions = [
    { label: 'Front door',  icon: 'door-open' },
    { label: 'Garage',      icon: 'car' },
    { label: 'Mailroom',    icon: 'mailbox' },
    { label: 'Backyard',    icon: 'trees' },
    { label: 'Garden shed', icon: 'warehouse' },
  ];

  return (
    <Phone>
      <TopBar title="Add guest" />
      <ScrollArea bottomPad={110}>

        <HomeContextStrip />

        <Section overline="Guest">
          <div>
            <FieldLabel required>Name</FieldLabel>
            <Input value="" placeholder="Sasha Petrov" state="focus" />
          </div>
          <div>
            <FieldLabel required>Email or phone</FieldLabel>
            <Input
              value=""
              placeholder="sasha@petrov.co or (415) 555-…"
              helper="We'll text or email them a one-tap pass link."
            />
          </div>
        </Section>

        <Section overline="Access window">
          <div>
            <FieldLabel required>Duration</FieldLabel>
            <ChipRow>
              {durationOptions.map(opt => (
                <SelectChip key={opt} label={opt} selected={false} />
              ))}
            </ChipRow>
            <div style={{ fontSize: 11, color: F.fg3, marginTop: 10, fontStyle: 'italic' }}>
              Pick how long the pass is good for.
            </div>
          </div>
          <div>
            <FieldLabel>Allowed areas</FieldLabel>
            <ChipRow>
              {areaOptions.map(a => (
                <SelectChip
                  key={a.label}
                  label={a.label}
                  leading={a.icon}
                  selected={false}
                />
              ))}
            </ChipRow>
            <div style={{ fontSize: 11, color: F.fg3, marginTop: 8, fontStyle: 'italic' }}>
              Front door only, unless you add more.
            </div>
          </div>
        </Section>

        <Section overline="Note">
          <div>
            <FieldLabel>Welcome message (optional)</FieldLabel>
            <Textarea
              value=""
              placeholder="Anything they should know when they accept…"
              height={92}
            />
          </div>
        </Section>

      </ScrollArea>
      <StickyCTA label="Send pass" disabled />
    </Phone>
  );
}

Object.assign(window, { FrameAddGuestFilled, FrameAddGuestInitial });
