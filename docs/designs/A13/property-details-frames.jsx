// Pantopus — A13.5 · Property details (read-mostly variant of Form archetype)
// File: src/app/homes/[id]/property-details.tsx
// Inherits A13 scaffolding (top bar, overlines, section rhythm, card style) but
// the "fields" are read-only DataRows because property facts come from external
// sources (county records, mail verification). Edit happens via a
// "Request correction" affordance — quiet inline when clean, sticky-bottom when
// there's a mismatch.
//
// Two frames:
//   FramePropertyDetailsClean    — populated, all sources agree
//   FramePropertyDetailsMismatch — county vs owner-confirmed disagree on beds

const {
  F, Phone, TopBar, OverlineLabel,
  Section, ScrollArea, Card,
} = window;

// ─── Local atoms ───────────────────────────────────────────────

// Read-only "field": label on the left, value on the right.
// `flag` triggers the mismatch row treatment (amber tint, alert icon).
function DataRow({ label, value, sub, mono, flag, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '12px 14px',
      borderBottom: last ? 'none' : `1px solid ${F.borderSub}`,
      background: flag ? '#fffbeb' : 'transparent',
      position: 'relative',
    }}>
      {flag && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 3, background: '#d97706',
        }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: F.fg3, letterSpacing: -0.05,
          textTransform: 'none',
        }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: F.fg4, marginTop: 2, lineHeight: '15px' }}>{sub}</div>}
      </div>
      <div style={{
        textAlign: 'right', maxWidth: '60%',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {flag && <i data-lucide="alert-triangle" style={{ width: 13, height: 13, color: '#d97706' }} />}
        <span style={{
          fontSize: 14, fontWeight: 600, color: F.fg1, letterSpacing: -0.1,
          fontFamily: mono ? 'ui-monospace, Menlo, monospace' : 'inherit',
        }}>{value}</span>
      </div>
    </div>
  );
}

// Property hero — address + tiny rendered map
function PropertyHero({ line1, line2, lat = 40.7128, lng = -74.0058 }) {
  return (
    <Card padding={0} style={{ borderRadius: 14 }}>
      <div style={{ display: 'flex', gap: 12, padding: 14, alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: F.fg1, letterSpacing: -0.2 }}>{line1}</div>
          <div style={{ fontSize: 12, color: F.fg3, marginTop: 2 }}>{line2}</div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8,
            padding: '2px 8px', borderRadius: 4,
            background: F.homeBg, color: F.home,
            fontSize: 9.5, fontWeight: 700, letterSpacing: 0.1, textTransform: 'uppercase',
          }}>
            <i data-lucide="home" style={{ width: 10, height: 10 }} />
            Household
          </div>
        </div>
        {/* tiny map */}
        <div style={{
          width: 72, height: 72, borderRadius: 10, flexShrink: 0,
          background: '#dbeafe',
          position: 'relative', overflow: 'hidden',
          border: `1px solid ${F.border}`,
        }}>
          {/* faux streets */}
          <div style={{ position: 'absolute', left: -10, top: 18, width: 100, height: 8, background: '#fff', transform: 'rotate(-12deg)' }} />
          <div style={{ position: 'absolute', left: -10, top: 44, width: 100, height: 6, background: '#fff', transform: 'rotate(-12deg)' }} />
          <div style={{ position: 'absolute', left: 28, top: -10, width: 6, height: 100, background: '#fff', transform: 'rotate(-12deg)' }} />
          {/* parcel highlight */}
          <div style={{
            position: 'absolute', left: 32, top: 22, width: 22, height: 16,
            background: 'rgba(2,132,199,0.25)', border: '1.5px solid #0284c7',
            borderRadius: 2, transform: 'rotate(-12deg)',
          }} />
          {/* pin */}
          <div style={{
            position: 'absolute', left: 36, top: 22, width: 12, height: 12, borderRadius: '50%',
            background: '#0284c7', border: '2px solid #fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          }} />
        </div>
      </div>
    </Card>
  );
}

// Source pill shown after each verification line
function SourcePill({ label, tone = 'neutral', icon }) {
  const tones = {
    success: { bg: F.successBg, fg: F.success },
    warning: { bg: '#fef3c7', fg: '#a16207' },
    neutral: { bg: F.sunken,    fg: F.fg2 },
  };
  const t = tones[tone];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 9999,
      background: t.bg, color: t.fg,
      fontSize: 10.5, fontWeight: 700, letterSpacing: 0.1, textTransform: 'uppercase',
    }}>
      {icon && <i data-lucide={icon} style={{ width: 10, height: 10 }} />}
      {label}
    </span>
  );
}

// Sticky CTA — same shape as A13.1, can be tinted by tone
function StickyCTA({ label, icon = 'check', tone = 'primary' }) {
  const toneMap = {
    primary: { bg: F.primary600, sh: '0 6px 16px rgba(2,132,199,0.28)' },
    warning: { bg: '#d97706',   sh: '0 6px 16px rgba(217,119,6,0.30)'  },
  };
  const t = toneMap[tone];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'rgba(255,255,255,0.96)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      borderTop: `1px solid ${F.border}`,
      padding: '12px 16px 28px', zIndex: 10,
    }}>
      <button style={{
        width: '100%', height: 46, borderRadius: 12, border: 'none',
        background: t.bg, color: '#fff',
        fontSize: 14, fontWeight: 600, cursor: 'pointer',
        boxShadow: t.sh,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        letterSpacing: -0.1,
      }}>
        <i data-lucide={icon} style={{ width: 16, height: 16 }} />
        {label}
      </button>
    </div>
  );
}

// Mismatch banner above the card whose row is flagged
function MismatchBanner({ summary, detail }) {
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 10,
      background: '#fffbeb', border: '1px solid #fde68a',
      marginBottom: 8,
    }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: 8, flexShrink: 0,
          background: '#fde68a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i data-lucide="alert-triangle" style={{ width: 14, height: 14, color: '#92400e' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#78350f', letterSpacing: -0.1 }}>{summary}</div>
          <div style={{ fontSize: 12, color: '#92400e', marginTop: 3, lineHeight: '17px' }}>{detail}</div>
        </div>
      </div>
    </div>
  );
}

// ─── FRAME · CLEAN (everything matches) ────────────────────────

function FramePropertyDetailsClean() {
  return (
    <Phone>
      <TopBar title="Property details" />
      <ScrollArea bottomPad={40}>

        <PropertyHero line1="412 Elm St · Apt 3B" line2="Elm Park, NY 10013" />

        <Section overline="Property">
          <Card padding={0}>
            <DataRow label="Type"        value="Apartment" />
            <DataRow label="Year built"  value="1924" mono />
            <DataRow label="Bedrooms"    value="2" mono />
            <DataRow label="Bathrooms"   value="1" mono />
            <DataRow label="Interior"    value="845 sq ft" mono />
            <DataRow label="Lot share"   value="1/6" mono sub="6-unit building" last />
          </Card>
        </Section>

        <Section overline="Records">
          <Card padding={0}>
            <DataRow label="Parcel ID"      value="NY-013-0042-019" mono />
            <DataRow label="Property class" value="Residential" sub="Multi-family · 4–6 unit" />
            <DataRow label="Zoning"         value="R5" mono />
            <DataRow label="Last assessed"  value="$1.24M" sub="2025 county roll" mono last />
          </Card>
        </Section>

        <Section overline="Verification">
          <Card padding={0}>
            <div style={{ padding: '14px 14px', borderBottom: `1px solid ${F.borderSub}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: F.fg1, letterSpacing: -0.1 }}>NY county records</span>
                <SourcePill label="Synced" tone="success" icon="check" />
              </div>
              <div style={{ fontSize: 11, color: F.fg3 }}>Last synced Apr 4, 2026 · auto-refresh quarterly</div>
            </div>
            <div style={{ padding: '14px 14px', borderBottom: `1px solid ${F.borderSub}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: F.fg1, letterSpacing: -0.1 }}>Mail verification</span>
                <SourcePill label="Verified" tone="success" icon="mail-check" />
              </div>
              <div style={{ fontSize: 11, color: F.fg3 }}>Postcard confirmed Mar 18, 2026</div>
            </div>
            <div style={{ padding: '14px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: F.fg1, letterSpacing: -0.1 }}>Owner confirmation</span>
                <SourcePill label="You" tone="success" icon="user-check" />
              </div>
              <div style={{ fontSize: 11, color: F.fg3 }}>You confirmed every field Apr 4, 2026</div>
            </div>
          </Card>
        </Section>

        {/* Quiet inline edit-trigger — no sticky CTA needed when clean */}
        <div style={{
          textAlign: 'center', padding: '4px 8px 16px',
          fontSize: 12, color: F.fg3, lineHeight: '17px',
        }}>
          Notice something off?{' '}
          <button style={{
            background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
            color: F.primary600, fontSize: 12, fontWeight: 600, letterSpacing: -0.1,
          }}>Request a correction</button>
        </div>

      </ScrollArea>
    </Phone>
  );
}

// ─── FRAME · MISMATCH (county vs owner-confirmed disagree) ─────

function FramePropertyDetailsMismatch() {
  return (
    <Phone>
      <TopBar title="Property details" />
      <ScrollArea bottomPad={110}>

        <PropertyHero line1="412 Elm St · Apt 3B" line2="Elm Park, NY 10013" />

        <MismatchBanner
          summary="Two sources disagree on bedrooms"
          detail="NY county lists 3, you confirmed 2 after the wall came down in '22. Pick one to keep."
        />

        <Section overline="Property">
          <Card padding={0}>
            <DataRow label="Type"        value="Apartment" />
            <DataRow label="Year built"  value="1924" mono />
            <DataRow
              label="Bedrooms"
              value="2 · county says 3"
              sub="Edited Apr 4, 2026"
              mono
              flag
            />
            <DataRow label="Bathrooms"   value="1" mono />
            <DataRow label="Interior"    value="845 sq ft" mono />
            <DataRow label="Lot share"   value="1/6" mono sub="6-unit building" last />
          </Card>
        </Section>

        <Section overline="Records">
          <Card padding={0}>
            <DataRow label="Parcel ID"      value="NY-013-0042-019" mono />
            <DataRow label="Property class" value="Residential" sub="Multi-family · 4–6 unit" />
            <DataRow label="Zoning"         value="R5" mono />
            <DataRow label="Last assessed"  value="$1.24M" sub="2025 county roll" mono last />
          </Card>
        </Section>

        <Section overline="Verification">
          <Card padding={0}>
            <div style={{ padding: '14px 14px', borderBottom: `1px solid ${F.borderSub}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: F.fg1, letterSpacing: -0.1 }}>NY county records</span>
                <SourcePill label="Mismatch" tone="warning" icon="alert-triangle" />
              </div>
              <div style={{ fontSize: 11, color: F.fg3 }}>Last synced Apr 4, 2026 · 1 field differs from owner-confirmed</div>
            </div>
            <div style={{ padding: '14px 14px', borderBottom: `1px solid ${F.borderSub}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: F.fg1, letterSpacing: -0.1 }}>Mail verification</span>
                <SourcePill label="Verified" tone="success" icon="mail-check" />
              </div>
              <div style={{ fontSize: 11, color: F.fg3 }}>Postcard confirmed Mar 18, 2026</div>
            </div>
            <div style={{ padding: '14px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: F.fg1, letterSpacing: -0.1 }}>Owner confirmation</span>
                <SourcePill label="You" tone="success" icon="user-check" />
              </div>
              <div style={{ fontSize: 11, color: F.fg3 }}>You confirmed every field Apr 4, 2026</div>
            </div>
          </Card>
        </Section>

      </ScrollArea>
      <StickyCTA label="Request correction" icon="file-text" tone="warning" />
    </Phone>
  );
}

Object.assign(window, { FramePropertyDetailsClean, FramePropertyDetailsMismatch });
