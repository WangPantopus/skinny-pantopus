// Pantopus — A13.9 · Edit profile
// File: src/app/profile/edit.tsx
//
// Multi-section variant of the Form archetype. Sections stack:
//   ① Avatar + cover  ② Identity (name + username + bio)
//   ③ Skills          ④ Languages          ⑤ Visibility
//
// "Save" is sticky-bottom because edits are typically partial and the user
// scrolls a lot — keeping Save anchored is friendlier than the top-bar text
// button used by lighter forms (Invite owner, Post gig v1).
//
// Two frames:
//   FrameEditProfileClean — last-saved state · Save disabled (no diff)
//   FrameEditProfileDirty — user edited avatar / bio / added a skill ·
//                           dirty dots on changed labels · Discard + Save bar
//
// Atoms come from form-frames.jsx; this file only adds the local pieces
// (avatar block, cover slot, skill chip with edit affordance, dirty marker,
// dual-button sticky bar).

const {
  F, Phone, TopBar, OverlineLabel, FieldLabel,
  Input, Textarea, Section, ScrollArea, Card,
  Toggle, ToggleRow, Chip,
} = window;

// ─── Local atoms ──────────────────────────────────────────────

function DirtyDot() {
  return (
    <span style={{
      display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
      background: '#f59e0b', marginLeft: 6, verticalAlign: 'middle',
      boxShadow: '0 0 0 2px #fef3c7',
    }} />
  );
}

function ProfileLabel({ children, required, dirty }) {
  return (
    <label style={{
      display: 'block', fontSize: 12, fontWeight: 600, color: F.fg2,
      marginBottom: 6, letterSpacing: -0.05,
    }}>
      {children}
      {required && <span style={{ color: F.error600, marginLeft: 3 }}>*</span>}
      {dirty && <DirtyDot />}
    </label>
  );
}

function AvatarBlock({ initials = 'MK', dirty }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ position: 'relative' }}>
        <div style={{
          width: 92, height: 92, borderRadius: '50%',
          background: 'linear-gradient(135deg,#0ea5e9 0%,#0369a1 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 30, fontWeight: 700, letterSpacing: -0.5,
          boxShadow: '0 6px 16px rgba(2,132,199,0.2)',
          border: dirty ? `2px solid #f59e0b` : 'none',
        }}>{initials}</div>
        <div style={{
          position: 'absolute', right: -2, bottom: -2,
          width: 30, height: 30, borderRadius: '50%',
          background: F.surface, border: `2px solid ${F.bg}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: F.primary600, boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
        }}>
          <i data-lucide="camera" style={{ width: 15, height: 15 }} />
        </div>
        {dirty && (
          <div style={{
            position: 'absolute', left: -4, top: -4,
            padding: '2px 6px', borderRadius: 9999,
            background: '#f59e0b', color: '#fff',
            fontSize: 9, fontWeight: 700, letterSpacing: 0.3,
            textTransform: 'uppercase',
            boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
          }}>New</div>
        )}
      </div>
      <button style={{
        background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
        color: F.primary600, fontSize: 13, fontWeight: 600, letterSpacing: -0.1,
      }}>{dirty ? 'Undo · revert photo' : 'Change photo'}</button>
    </div>
  );
}

function CoverSlot({ variant = 'sky' }) {
  // Pretty CSS-only cover — abstract neighborhood-evening composition
  if (variant === 'sky') {
    return (
      <div style={{
        aspectRatio: '16 / 8', borderRadius: 12, overflow: 'hidden',
        position: 'relative',
        background: 'linear-gradient(180deg, #fef3c7 0%, #fde68a 35%, #fbbf24 60%, #f59e0b 100%)',
      }}>
        {/* sun */}
        <div style={{
          position: 'absolute', right: 32, top: 18,
          width: 32, height: 32, borderRadius: '50%',
          background: '#fde68a',
          boxShadow: '0 0 40px 14px rgba(254, 243, 199, 0.7)',
        }} />
        {/* skyline silhouette */}
        <svg viewBox="0 0 320 80" preserveAspectRatio="none" style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: '55%',
        }}>
          <path d="M0 80 V52 H18 V40 H32 V48 H48 V28 H62 V38 H78 V20 H94 V40 H110 V48 H126 V32 H142 V44 H160 V24 H178 V42 H192 V52 H208 V36 H224 V48 H240 V28 H258 V40 H272 V46 H290 V32 H304 V44 H320 V80 Z"
            fill="rgba(17,24,39,0.78)" />
          <rect x="62" y="32" width="2" height="2" fill="#fbbf24" opacity="0.9" />
          <rect x="90" y="26" width="2" height="2" fill="#fbbf24" opacity="0.9" />
          <rect x="142" y="48" width="2" height="2" fill="#fbbf24" opacity="0.9" />
          <rect x="200" y="42" width="2" height="2" fill="#fbbf24" opacity="0.9" />
          <rect x="270" y="50" width="2" height="2" fill="#fbbf24" opacity="0.9" />
        </svg>
        {/* edit chip */}
        <button style={{
          position: 'absolute', right: 10, top: 10,
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '6px 10px', borderRadius: 9999,
          background: 'rgba(17,24,39,0.72)', color: '#fff',
          fontSize: 11, fontWeight: 600, letterSpacing: -0.05,
          border: 'none', cursor: 'pointer',
          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        }}>
          <i data-lucide="image" style={{ width: 12, height: 12 }} />
          Change cover
        </button>
      </div>
    );
  }
  // sea variant for dirty frame (user picked a different one)
  return (
    <div style={{
      aspectRatio: '16 / 8', borderRadius: 12, overflow: 'hidden',
      position: 'relative',
      background: 'linear-gradient(180deg,#bae6fd 0%,#7dd3fc 35%,#38bdf8 70%,#0284c7 100%)',
    }}>
      {/* gulls */}
      <svg viewBox="0 0 320 80" preserveAspectRatio="none" style={{
        position: 'absolute', inset: 0, width: '100%', height: '60%',
      }}>
        <path d="M80 24 q4 -5 8 0 q4 -5 8 0" stroke="rgba(17,24,39,0.55)" strokeWidth="1.4" fill="none" />
        <path d="M150 16 q3 -4 6 0 q3 -4 6 0" stroke="rgba(17,24,39,0.55)" strokeWidth="1.4" fill="none" />
        <path d="M220 30 q4 -5 8 0 q4 -5 8 0" stroke="rgba(17,24,39,0.55)" strokeWidth="1.4" fill="none" />
      </svg>
      {/* waves */}
      <svg viewBox="0 0 320 80" preserveAspectRatio="none" style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: '52%',
      }}>
        <path d="M0 80 V40 q40 -10 80 0 t80 0 t80 0 t80 0 V80 Z" fill="rgba(2,132,199,0.45)" />
        <path d="M0 80 V52 q40 -8 80 0 t80 0 t80 0 t80 0 V80 Z" fill="rgba(3,105,161,0.65)" />
        <path d="M0 80 V62 q40 -6 80 0 t80 0 t80 0 t80 0 V80 Z" fill="rgba(7,89,133,0.85)" />
      </svg>
      <div style={{
        position: 'absolute', left: 10, top: 10,
        padding: '3px 8px', borderRadius: 9999,
        background: '#f59e0b', color: '#fff',
        fontSize: 9.5, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase',
        boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
      }}>Changed</div>
      <button style={{
        position: 'absolute', right: 10, top: 10,
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '6px 10px', borderRadius: 9999,
        background: 'rgba(17,24,39,0.72)', color: '#fff',
        fontSize: 11, fontWeight: 600, letterSpacing: -0.05,
        border: 'none', cursor: 'pointer',
      }}>
        <i data-lucide="image" style={{ width: 12, height: 12 }} />
        Change cover
      </button>
    </div>
  );
}

// Skill chip — pill with optional "new" highlight
function SkillChip({ label, icon, fresh }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '6px 4px 6px 10px', borderRadius: 9999,
      background: fresh ? '#fef3c7' : F.primary50,
      color: fresh ? '#92400e' : F.primary700,
      border: `1px solid ${fresh ? '#fde68a' : F.primary100}`,
      fontSize: 12, fontWeight: 600,
    }}>
      {icon && (
        <i data-lucide={icon} style={{ width: 12, height: 12, opacity: 0.85, marginRight: 1 }} />
      )}
      {label}
      <span style={{
        width: 16, height: 16, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: fresh ? '#92400e' : F.primary600, cursor: 'pointer',
      }}>
        <i data-lucide="x" style={{ width: 12, height: 12, strokeWidth: 2.5 }} />
      </span>
    </span>
  );
}

function AddSkillChip() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '6px 10px', borderRadius: 9999,
      border: `1px dashed ${F.borderStrong}`,
      color: F.fg3, fontSize: 12, fontWeight: 500,
      background: 'transparent', cursor: 'pointer',
    }}>
      <i data-lucide="plus" style={{ width: 12, height: 12 }} />
      Add skill
    </span>
  );
}

// Language row — flag glyph + name + level pill
function LanguageRow({ flag, name, level, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      borderBottom: last ? 'none' : `1px solid ${F.borderSub}`,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 6, overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: F.sunken, fontSize: 16, flexShrink: 0,
        border: `1px solid ${F.borderSub}`,
      }}>{flag}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: F.fg1, letterSpacing: -0.1 }}>{name}</div>
        <div style={{ fontSize: 11, color: F.fg3, marginTop: 1 }}>{level}</div>
      </div>
      <i data-lucide="grip-vertical" style={{ width: 14, height: 14, color: F.fg4 }} />
    </div>
  );
}

function AddLanguageRow() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '12px 14px',
      color: F.primary600, fontSize: 13, fontWeight: 600,
      cursor: 'pointer',
    }}>
      <i data-lucide="plus-circle" style={{ width: 16, height: 16 }} />
      <span>Add language</span>
    </div>
  );
}

// Sticky save bar — clean (Save disabled) vs dirty (Discard + Save with count)
function StickySave({ dirty, count }) {
  if (dirty) {
    return (
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderTop: `1px solid ${F.border}`,
        padding: '10px 16px 26px',
        display: 'flex', gap: 10, alignItems: 'center',
        zIndex: 10,
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 9999,
          background: '#fef3c7', border: '1px solid #fde68a',
          color: '#92400e', fontSize: 11, fontWeight: 700, letterSpacing: 0.1,
          textTransform: 'uppercase',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: '#f59e0b',
          }} />
          {count} unsaved
        </div>
        <div style={{ flex: 1 }} />
        <button style={{
          height: 42, padding: '0 14px', borderRadius: 10,
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: F.fg2, fontSize: 13.5, fontWeight: 600, letterSpacing: -0.1,
        }}>Discard</button>
        <button style={{
          height: 42, padding: '0 22px', borderRadius: 10, border: 'none',
          background: F.primary600, color: '#fff',
          fontSize: 14, fontWeight: 600, letterSpacing: -0.1, cursor: 'pointer',
          boxShadow: '0 6px 16px rgba(2,132,199,0.28)',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <i data-lucide="check" style={{ width: 15, height: 15 }} />
          Save
        </button>
      </div>
    );
  }
  // clean state
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'rgba(255,255,255,0.96)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      borderTop: `1px solid ${F.border}`,
      padding: '10px 16px 26px',
      display: 'flex', gap: 10, alignItems: 'center',
      zIndex: 10,
    }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        color: F.fg3, fontSize: 11.5, fontWeight: 500,
      }}>
        <i data-lucide="check-circle-2" style={{ width: 13, height: 13, color: F.success600 }} />
        All changes saved · just now
      </div>
      <div style={{ flex: 1 }} />
      <button disabled style={{
        height: 42, padding: '0 22px', borderRadius: 10, border: 'none',
        background: '#e5e7eb', color: F.fg4,
        fontSize: 14, fontWeight: 600, letterSpacing: -0.1,
        cursor: 'not-allowed',
      }}>Save</button>
    </div>
  );
}

// ─── FRAME · CLEAN (last saved) ────────────────────────────────

function FrameEditProfileClean() {
  return (
    <Phone>
      <TopBar title="Edit profile" />
      <ScrollArea bottomPad={110}>

        <AvatarBlock initials="MK" />

        <div>
          <ProfileLabel>Cover photo</ProfileLabel>
          <CoverSlot variant="sky" />
        </div>

        <Section overline="Identity">
          <div>
            <ProfileLabel required>Display name</ProfileLabel>
            <Input value="Maria Kovács" state="valid" />
          </div>
          <div>
            <ProfileLabel required>Username</ProfileLabel>
            <Input
              value="mariak"
              leading="@"
              state="valid"
              helper="Lowercase, no spaces. Visible on your profile."
            />
          </div>
          <div>
            <ProfileLabel>Bio</ProfileLabel>
            <Textarea
              value="Elm Park since '19. Occasional handyman, occasional baker. Fixes squeaky floors, usually."
              height={92}
              charCount="88 / 240"
            />
          </div>
        </Section>

        <Section overline="Skills">
          <div>
            <ProfileLabel>What you can help with</ProfileLabel>
            <div style={{
              padding: 10, background: F.surface, border: `1px solid ${F.border}`,
              borderRadius: 8, display: 'flex', flexWrap: 'wrap', gap: 6,
              minHeight: 44, alignItems: 'center',
            }}>
              <SkillChip label="Handyman"  icon="hammer" />
              <SkillChip label="Tutoring"  icon="graduation-cap" />
              <SkillChip label="Pet care"  icon="paw-print" />
              <AddSkillChip />
            </div>
            <div style={{ fontSize: 11, color: F.fg3, marginTop: 6, fontStyle: 'italic' }}>
              Neighbors see these on your Pulse &amp; gig posts.
            </div>
          </div>
        </Section>

        <Section overline="Languages" gap={0}>
          <Card padding={0}>
            <LanguageRow flag="🇺🇸" name="English"  level="Native" />
            <LanguageRow flag="🇭🇺" name="Magyar"   level="Native" />
            <LanguageRow flag="🇪🇸" name="Español"  level="Conversational" last />
          </Card>
          <div style={{ marginTop: 6 }}>
            <Card padding={0}>
              <AddLanguageRow />
            </Card>
          </div>
        </Section>

        <Section overline="Visibility" gap={0}>
          <Card padding={0}>
            <ToggleRow
              label="Show my address to connections"
              sub="Verified neighbors you've chatted with see 412 Elm St."
              on={true}
            />
            <ToggleRow
              label="Show my phone"
              sub="Only for accepted gigs and marketplace deals."
              on={false}
            />
            <ToggleRow
              label="Appear in block directory"
              sub="Elm Park block only. Off hides you from neighbor search."
              on={true}
              last
            />
          </Card>
        </Section>

      </ScrollArea>
      <StickySave dirty={false} />
    </Phone>
  );
}

// ─── FRAME · DIRTY (unsaved edits) ─────────────────────────────

function FrameEditProfileDirty() {
  return (
    <Phone>
      <TopBar title="Edit profile" />
      <ScrollArea bottomPad={110}>

        <AvatarBlock initials="MK" dirty />

        <div>
          <ProfileLabel dirty>Cover photo</ProfileLabel>
          <CoverSlot variant="sea" />
        </div>

        <Section overline="Identity">
          <div>
            <ProfileLabel required>Display name</ProfileLabel>
            <Input value="Maria Kovács" state="valid" />
          </div>
          <div>
            <ProfileLabel required>Username</ProfileLabel>
            <Input
              value="mariak"
              leading="@"
              state="valid"
              helper="Lowercase, no spaces. Visible on your profile."
            />
          </div>
          <div>
            <ProfileLabel dirty>Bio</ProfileLabel>
            <Textarea
              value="Elm Park since '19. Handyman by trade, baker on weekends — squeaky floors, leaky faucets, sourdough swaps. Trade a loaf for a fix."
              height={96}
              charCount="131 / 240"
            />
          </div>
        </Section>

        <Section overline="Skills">
          <div>
            <ProfileLabel dirty>What you can help with</ProfileLabel>
            <div style={{
              padding: 10, background: F.surface, border: `1px solid ${F.border}`,
              borderRadius: 8, display: 'flex', flexWrap: 'wrap', gap: 6,
              minHeight: 44, alignItems: 'center',
            }}>
              <SkillChip label="Handyman" icon="hammer" />
              <SkillChip label="Tutoring" icon="graduation-cap" />
              <SkillChip label="Pet care" icon="paw-print" />
              <SkillChip label="Baking"   icon="croissant" fresh />
              <AddSkillChip />
            </div>
            <div style={{ fontSize: 11, color: F.fg3, marginTop: 6, fontStyle: 'italic' }}>
              Neighbors see these on your Pulse &amp; gig posts.
            </div>
          </div>
        </Section>

        <Section overline="Languages" gap={0}>
          <Card padding={0}>
            <LanguageRow flag="🇺🇸" name="English" level="Native" />
            <LanguageRow flag="🇭🇺" name="Magyar"  level="Native" />
            <LanguageRow flag="🇪🇸" name="Español" level="Conversational" last />
          </Card>
          <div style={{ marginTop: 6 }}>
            <Card padding={0}>
              <AddLanguageRow />
            </Card>
          </div>
        </Section>

        <Section overline="Visibility" gap={0}>
          <Card padding={0}>
            <ToggleRow
              label="Show my address to connections"
              sub="Verified neighbors you've chatted with see 412 Elm St."
              on={true}
            />
            <ToggleRow
              label="Show my phone"
              sub="Only for accepted gigs and marketplace deals."
              on={true}
            />
            <ToggleRow
              label="Appear in block directory"
              sub="Elm Park block only. Off hides you from neighbor search."
              on={true}
              last
            />
          </Card>
        </Section>

      </ScrollArea>
      <StickySave dirty count={4} />
    </Phone>
  );
}

Object.assign(window, { FrameEditProfileClean, FrameEditProfileDirty });
