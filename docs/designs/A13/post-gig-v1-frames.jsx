// Pantopus — A13.8 · Post gig (V1) — LEGACY
// File: src/app/gig/new.tsx
//
// Legacy gig creation form. Predates the modern Tasks composer. Carries the
// V1 ergonomics on purpose:
//   • Right-bar text-button "Post" (no sticky CTA, no shadow halo)
//   • Plain <select>-style category dropdown (no chip row, no icons)
//   • Bare radio row for price type (Flat / Hourly / Free)
//   • Date as a clickable text field, not a chip set
//   • Photo grid with simple "+" tiles, no drag reorder
//   • Server-side validation: a red banner appears after Post, not live inline
//
// Two frames:
//   FramePostGigV1Filled  — populated, ready to post
//   FramePostGigV1Errors  — secondary state: user hit Post, server rejected,
//                            three problems surfaced as a banner + red fields

const {
  F, Phone, TopBar, OverlineLabel, FieldLabel,
  Input, Textarea, Section, ScrollArea,
} = window;

// ─── V1 atoms (intentionally plain) ────────────────────────────

// Plain dropdown — chevron, no leading icon, no chip variants.
function SelectField({ value, placeholder, error }) {
  const borderColor = error ? F.error600 : F.border;
  const bw = error ? 1.5 : 1;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      height: 44, padding: '0 12px',
      background: F.surface, border: `${bw}px solid ${borderColor}`,
      borderRadius: 8,
    }}>
      <span style={{
        flex: 1, fontSize: 14,
        color: value ? F.fg1 : F.fg4,
        fontWeight: value ? 500 : 400, letterSpacing: -0.1,
      }}>{value || placeholder}</span>
      <i data-lucide="chevron-down" style={{ width: 16, height: 16, color: F.fg3 }} />
    </div>
  );
}

// Plain radio row (V1: no chips, no animation).
function RadioRow({ options, selected }) {
  return (
    <div style={{ display: 'flex', gap: 18, padding: '4px 2px' }}>
      {options.map(opt => {
        const on = opt === selected;
        return (
          <label key={opt} style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer',
          }}>
            <span style={{
              width: 18, height: 18, borderRadius: '50%',
              border: on ? `5px solid ${F.primary600}` : `1.5px solid ${F.borderStrong}`,
              background: F.surface, boxSizing: 'border-box', flexShrink: 0,
            }} />
            <span style={{
              fontSize: 13, color: F.fg1, fontWeight: on ? 600 : 500, letterSpacing: -0.1,
            }}>{opt}</span>
          </label>
        );
      })}
    </div>
  );
}

// Price input — prefix $, optional trailing /hr unit.
function PriceField({ value, unit, error, errorMsg }) {
  const borderColor = error ? F.error600 : F.border;
  const bw = error ? 1.5 : 1;
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center',
        height: 44, padding: '0 12px 0 14px',
        background: F.surface, border: `${bw}px solid ${borderColor}`,
        borderRadius: 8,
      }}>
        <span style={{
          fontSize: 16, fontWeight: 600,
          color: value ? F.fg2 : F.fg4, marginRight: 8,
        }}>$</span>
        <span style={{
          flex: 1, fontSize: 15, fontWeight: value ? 600 : 400,
          color: value ? F.fg1 : F.fg4, letterSpacing: -0.2,
          fontFeatureSettings: '"tnum"',
        }}>{value || '0'}</span>
        {unit && (
          <span style={{
            fontSize: 12, color: F.fg3, fontWeight: 500,
            paddingLeft: 8, borderLeft: `1px solid ${F.borderSub}`,
          }}>{unit}</span>
        )}
      </div>
      {error && errorMsg && (
        <div style={{
          fontSize: 11, color: F.error, marginTop: 6,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <i data-lucide="alert-circle" style={{ width: 11, height: 11 }} />
          {errorMsg}
        </div>
      )}
    </div>
  );
}

// Plain date field — leading calendar glyph, clickable.
function DateField({ value, placeholder, error, errorMsg }) {
  const borderColor = error ? F.error600 : F.border;
  const bw = error ? 1.5 : 1;
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        height: 44, padding: '0 12px',
        background: F.surface, border: `${bw}px solid ${borderColor}`,
        borderRadius: 8,
      }}>
        <i data-lucide="calendar" style={{ width: 16, height: 16, color: F.fg3, flexShrink: 0 }} />
        <span style={{
          flex: 1, fontSize: 14,
          color: value ? F.fg1 : F.fg4,
          fontWeight: value ? 500 : 400, letterSpacing: -0.1,
        }}>{value || placeholder}</span>
        <i data-lucide="chevron-down" style={{ width: 14, height: 14, color: F.fg4 }} />
      </div>
      {error && errorMsg && (
        <div style={{
          fontSize: 11, color: F.error, marginTop: 6,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <i data-lucide="alert-circle" style={{ width: 11, height: 11 }} />
          {errorMsg}
        </div>
      )}
    </div>
  );
}

// Photo grid tile — either a thumbnail or the empty "+" slot.
function PhotoTile({ kind = 'empty', img, primary }) {
  if (kind === 'add') {
    return (
      <div style={{
        aspectRatio: '1 / 1',
        border: `1.5px dashed ${F.borderStrong}`,
        borderRadius: 10, background: F.muted,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 4,
        color: F.fg3, cursor: 'pointer',
      }}>
        <i data-lucide="plus" style={{ width: 18, height: 18 }} />
        <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.05 }}>Add</span>
      </div>
    );
  }
  return (
    <div style={{
      aspectRatio: '1 / 1', borderRadius: 10, position: 'relative',
      background: img, overflow: 'hidden',
      border: `1px solid ${F.border}`,
    }}>
      {primary && (
        <span style={{
          position: 'absolute', left: 6, top: 6,
          fontSize: 9, fontWeight: 700, letterSpacing: 0.4,
          color: '#fff', background: 'rgba(17,24,39,0.78)',
          padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase',
        }}>Cover</span>
      )}
      <div style={{
        position: 'absolute', right: 5, top: 5,
        width: 22, height: 22, borderRadius: '50%',
        background: 'rgba(17,24,39,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', cursor: 'pointer',
      }}>
        <i data-lucide="x" style={{ width: 12, height: 12, strokeWidth: 2.4 }} />
      </div>
    </div>
  );
}

// V1 "legacy" footer chip — tiny version stamp at end of scroll
function LegacyStamp() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 6, padding: '4px 0 8px',
      color: F.fg4, fontSize: 10.5,
      fontFamily: 'ui-monospace, Menlo, monospace', letterSpacing: 0.2,
    }}>
      <i data-lucide="info" style={{ width: 11, height: 11 }} />
      <span>gig composer · v1.4.2</span>
    </div>
  );
}

// Error banner (server-side validation result)
function ErrorBanner({ count }) {
  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'flex-start',
      padding: '10px 12px',
      background: F.errorBg, border: `1px solid ${F.errorLight}`,
      borderRadius: 10,
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        background: F.error600, color: '#fff', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginTop: 1,
      }}>
        <i data-lucide="alert-triangle" style={{ width: 13, height: 13 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: F.error, letterSpacing: -0.1 }}>
          {count} problems — please fix
        </div>
        <div style={{ fontSize: 11.5, color: F.error, marginTop: 2, lineHeight: '15px' }}>
          We couldn't post your gig. See the highlighted fields below.
        </div>
      </div>
    </div>
  );
}

// Photo backgrounds — placeholders rendered as CSS gradients (no asset deps)
const SOFA   = 'linear-gradient(135deg,#cbd5e1 0%,#94a3b8 60%,#64748b 100%)';
const STAIRS = 'linear-gradient(160deg,#e7d7c1 0%,#c9a978 70%,#8c6a3b 100%)';
const STREET = 'linear-gradient(135deg,#fde68a 0%,#f59e0b 60%,#b45309 100%)';

// ─── FRAME · POPULATED ─────────────────────────────────────────

function FramePostGigV1Filled() {
  return (
    <Phone>
      <TopBar title="Post gig" rightLabel="Post" />
      <ScrollArea bottomPad={40}>

        <Section overline="Category">
          <div>
            <FieldLabel required>Category</FieldLabel>
            <SelectField value="Moving &amp; hauling" />
          </div>
        </Section>

        <Section overline="Details">
          <div>
            <FieldLabel required>Title</FieldLabel>
            <Input value="Help moving a sofa up 3 flights" />
          </div>
          <div>
            <FieldLabel required>Description</FieldLabel>
            <Textarea
              value={
                "Sleeper sofa from the curb up to apt 3B. Building has no elevator, the stairwell is wide but there's a tight corner on the 2nd-floor landing. Should take 30–45 min with two people. I'll buy pizza after."
              }
              height={108}
              charCount="218 / 600"
            />
          </div>
        </Section>

        <Section overline="Pay">
          <div>
            <FieldLabel required>Price</FieldLabel>
            <PriceField value="80" unit="flat" />
          </div>
          <div>
            <FieldLabel>Price type</FieldLabel>
            <RadioRow options={['Flat', 'Hourly', 'Free']} selected="Flat" />
          </div>
        </Section>

        <Section overline="When">
          <div>
            <FieldLabel required>Date &amp; time</FieldLabel>
            <DateField value="Sat, May 24 · 2:00 PM" />
          </div>
        </Section>

        <Section overline="Photos">
          <div>
            <FieldLabel>Photos <span style={{ color: F.fg4, fontWeight: 500 }}>(up to 6)</span></FieldLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              <PhotoTile img={SOFA}   primary />
              <PhotoTile img={STAIRS} />
              <PhotoTile img={STREET} />
              <PhotoTile kind="add" />
            </div>
            <div style={{ fontSize: 11, color: F.fg3, marginTop: 8, fontStyle: 'italic' }}>
              First photo is the cover. Tap × to remove.
            </div>
          </div>
        </Section>

        <LegacyStamp />

      </ScrollArea>
    </Phone>
  );
}

// ─── FRAME · ERROR (server-side validation) ────────────────────

function FramePostGigV1Errors() {
  return (
    <Phone>
      <TopBar title="Post gig" rightLabel="Post" />
      <ScrollArea bottomPad={40}>

        <ErrorBanner count={3} />

        <Section overline="Category">
          <div>
            <FieldLabel required>Category</FieldLabel>
            <SelectField value="Moving &amp; hauling" />
          </div>
        </Section>

        <Section overline="Details">
          <div>
            <FieldLabel required>Title</FieldLabel>
            <Input value="Sofa help" />
          </div>
          <div>
            <FieldLabel required>Description</FieldLabel>
            <Textarea
              value="Need help with sofa."
              height={108}
              charCount="20 / 600"
            />
            <div style={{
              fontSize: 11, color: F.error, marginTop: 6,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <i data-lucide="alert-circle" style={{ width: 11, height: 11 }} />
              Description must be at least 40 characters.
            </div>
          </div>
        </Section>

        <Section overline="Pay">
          <div>
            <FieldLabel required>Price</FieldLabel>
            <PriceField
              value=""
              error
              errorMsg="Enter a price, or pick Free."
            />
          </div>
          <div>
            <FieldLabel>Price type</FieldLabel>
            <RadioRow options={['Flat', 'Hourly', 'Free']} selected="Flat" />
          </div>
        </Section>

        <Section overline="When">
          <div>
            <FieldLabel required>Date &amp; time</FieldLabel>
            <DateField
              value="Mon, May 12 · 9:00 AM"
              error
              errorMsg="Date is in the past. Pick a future time."
            />
          </div>
        </Section>

        <Section overline="Photos">
          <div>
            <FieldLabel>Photos <span style={{ color: F.fg4, fontWeight: 500 }}>(up to 6)</span></FieldLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              <PhotoTile kind="add" />
              <PhotoTile kind="add" />
              <PhotoTile kind="add" />
              <PhotoTile kind="add" />
            </div>
            <div style={{ fontSize: 11, color: F.fg3, marginTop: 8, fontStyle: 'italic' }}>
              Photos help your gig get picked up faster.
            </div>
          </div>
        </Section>

        <LegacyStamp />

      </ScrollArea>
    </Phone>
  );
}

Object.assign(window, { FramePostGigV1Filled, FramePostGigV1Errors });
