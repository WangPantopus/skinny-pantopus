// Pantopus — A13.11 · Professional profile
// File: src/app/professional.tsx
//
// NEW screen — Business-pillar identity editor, distinct from the personal
// /profile/edit screen (A13.9). Professional identity carries credentialing
// stakes (certifications, company affiliation, portfolio) so the Business
// pillar's violet accent runs through the whole form, and a verification
// status surfaces on every claim that needs proof.
//
// Sections:
//   ① Role          — Title + company (company can be claimed → verified)
//   ② Skills        — Trade chips (free-add, no verification)
//   ③ Certifications — Cards with issuer + expiry + verification status
//   ④ Portfolio links — URLs with auto-fetched site preview
//   ⑤ Visibility    — Who sees what · pricing visibility · DMs
//   ⑥ Sticky Save   — verification-aware
//
// Two frames:
//   FrameProProfileVerified — all claims verified, profile-strength 92%,
//                              Save disabled, sticky bar quiet.
//   FrameProProfilePending  — user added cert + company + portfolio link
//                              just now; strength 68%, pending badges,
//                              sticky bar shows the diff + Save.

const {
  F, Phone, TopBar, OverlineLabel, FieldLabel,
  Input, Textarea, Section, ScrollArea, Card,
  Toggle, ToggleRow,
} = window;

// ─── Business pillar palette (override accents) ────────────────
const B = {
  violet50:  '#f5f3ff',
  violet100: '#ede9fe',
  violet200: '#ddd6fe',
  violet400: '#a78bfa',
  violet500: '#8b5cf6',
  violet600: '#7c3aed',
  violet700: '#6d28d9',
  violet800: '#5b21b6',
  amber50:   '#fffbeb',
  amber100:  '#fef3c7',
  amber200:  '#fde68a',
  amber600:  '#d97706',
  amber700:  '#b45309',
};

// ─── Business top bar (violet title bar tint) ──────────────────

function ProTopBar({ title }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '8px 8px',
      height: 52, boxSizing: 'border-box', background: F.surface,
      borderBottom: `1px solid ${F.border}`, flexShrink: 0,
    }}>
      <button style={{
        width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: 'none', cursor: 'pointer', color: F.fg1, padding: 0,
      }}>
        <i data-lucide="x" style={{ width: 22, height: 22 }} />
      </button>
      <div style={{
        flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 1,
      }}>
        <div style={{ fontSize: 15.5, fontWeight: 600, color: F.fg1, letterSpacing: -0.2 }}>
          {title}
        </div>
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: 0.08,
          color: B.violet700, textTransform: 'uppercase',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <i data-lucide="briefcase" style={{ width: 9, height: 9 }} />
          Pantopus for Pros
        </div>
      </div>
      <div style={{ width: 36 }} />
    </div>
  );
}

// ─── Pillar header strip + strength meter ──────────────────────

function PillarStrip({ strength, complete }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
      border: `1px solid ${B.violet200}`,
      borderRadius: 14, padding: '14px 14px 12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 10px rgba(124,58,237,0.25)',
          flexShrink: 0,
        }}>
          <i data-lucide="briefcase" style={{ width: 18, height: 18 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: F.fg1, letterSpacing: -0.1 }}>
            Maria Kovács · Pro
          </div>
          <div style={{ fontSize: 11, color: B.violet700, marginTop: 1, fontWeight: 500 }}>
            Separate from your personal &amp; home identities
          </div>
        </div>
        <span style={{
          fontSize: 9.5, fontWeight: 700, letterSpacing: 0.1,
          color: '#fff', background: B.violet600,
          padding: '3px 7px', borderRadius: 4, textTransform: 'uppercase',
        }}>Business</span>
      </div>
      {/* strength meter */}
      <div style={{ marginTop: 12 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          marginBottom: 5,
        }}>
          <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.06,
                         textTransform: 'uppercase', color: B.violet700 }}>
            Profile strength
          </span>
          <span style={{
            fontSize: 13, fontWeight: 700, color: complete ? '#15803d' : B.violet700,
            fontFamily: 'ui-monospace, Menlo, monospace', letterSpacing: -0.2,
          }}>{strength}%</span>
        </div>
        <div style={{
          height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.7)',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${strength}%`, height: '100%',
            background: complete
              ? 'linear-gradient(90deg,#10b981,#059669)'
              : 'linear-gradient(90deg,#a78bfa,#7c3aed)',
            borderRadius: 3,
          }} />
        </div>
        <div style={{
          fontSize: 10.5, color: F.fg3, marginTop: 6, lineHeight: '14px',
        }}>
          {complete
            ? '4 of 4 claims verified · ready for high-trust clients.'
            : '2 claims pending verification · finish to reach Pro+ tier.'}
        </div>
      </div>
    </div>
  );
}

// ─── Verification badge variants ───────────────────────────────

function VerifyBadge({ status }) {
  if (status === 'verified') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        padding: '2px 6px 2px 4px', borderRadius: 9999,
        background: F.successBg, color: F.success,
        fontSize: 10, fontWeight: 700, letterSpacing: 0.05,
      }}>
        <i data-lucide="badge-check" style={{ width: 11, height: 11 }} />
        Verified
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        padding: '2px 6px 2px 4px', borderRadius: 9999,
        background: B.amber100, color: B.amber700,
        fontSize: 10, fontWeight: 700, letterSpacing: 0.05,
      }}>
        <i data-lucide="clock" style={{ width: 10, height: 10 }} />
        Pending
      </span>
    );
  }
  if (status === 'expiring') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        padding: '2px 6px 2px 4px', borderRadius: 9999,
        background: '#fff7ed', color: '#9a3412',
        fontSize: 10, fontWeight: 700, letterSpacing: 0.05,
        border: '1px solid #fed7aa',
      }}>
        <i data-lucide="alert-triangle" style={{ width: 10, height: 10 }} />
        Expiring
      </span>
    );
  }
  return null;
}

// ─── Pro field label with dirty + violet asterisk ──────────────

function ProLabel({ children, required, dirty, optional }) {
  return (
    <label style={{
      display: 'block', fontSize: 12, fontWeight: 600, color: F.fg2,
      marginBottom: 6, letterSpacing: -0.05,
    }}>
      {children}
      {required && <span style={{ color: B.violet600, marginLeft: 3 }}>*</span>}
      {optional && (
        <span style={{
          color: F.fg4, marginLeft: 6, fontWeight: 500, fontSize: 11,
        }}>(optional)</span>
      )}
      {dirty && (
        <span style={{
          display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
          background: '#f59e0b', marginLeft: 6, verticalAlign: 'middle',
          boxShadow: '0 0 0 2px #fef3c7',
        }} />
      )}
    </label>
  );
}

// ─── Company field with verification trailing ─────────────────

function CompanyField({ value, status, placeholder }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      height: 52, padding: '0 10px 0 10px',
      background: F.surface, border: `1px solid ${F.border}`,
      borderRadius: 8,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 6, flexShrink: 0,
        background: value
          ? 'linear-gradient(135deg,#fbbf24,#d97706)'
          : F.sunken,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 700, fontSize: 13,
        border: value ? 'none' : `1px dashed ${F.borderStrong}`,
      }}>
        {value ? (value[0] || 'B') : <i data-lucide="building-2" style={{ width: 14, height: 14, color: F.fg4 }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, color: value ? F.fg1 : F.fg4,
          fontWeight: value ? 600 : 400, letterSpacing: -0.1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{value || placeholder}</div>
        {value && (
          <div style={{ fontSize: 11, color: F.fg3, marginTop: 1,
                        display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Elm Park, NY</span>
            <span style={{ color: F.borderStrong }}>·</span>
            <VerifyBadge status={status} />
          </div>
        )}
      </div>
      <i data-lucide="chevron-right" style={{ width: 16, height: 16, color: F.fg4 }} />
    </div>
  );
}

// ─── Skill chips (Business pillar tint) ───────────────────────

function ProSkillChip({ label, icon, fresh }) {
  const bg = fresh ? B.amber100 : B.violet50;
  const fg = fresh ? B.amber700 : B.violet700;
  const bd = fresh ? B.amber200 : B.violet200;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '6px 4px 6px 10px', borderRadius: 9999,
      background: bg, color: fg, border: `1px solid ${bd}`,
      fontSize: 12, fontWeight: 600,
    }}>
      {icon && (
        <i data-lucide={icon} style={{ width: 12, height: 12, opacity: 0.9, marginRight: 1 }} />
      )}
      {label}
      <span style={{
        width: 16, height: 16, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
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
      Add
    </span>
  );
}

// ─── Certification card ────────────────────────────────────────

function CertCard({ name, issuer, issued, expires, status, fresh }) {
  const seal = status === 'verified' ? '#059669' :
               status === 'pending'  ? B.violet500 :
               status === 'expiring' ? '#ea580c' : F.fg4;
  return (
    <div style={{
      display: 'flex', gap: 12, padding: '12px 12px',
      background: F.surface, border: `1px solid ${fresh ? B.amber200 : F.border}`,
      borderRadius: 12,
      boxShadow: fresh ? '0 0 0 3px rgba(217,119,6,0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
      position: 'relative',
    }}>
      <div style={{
        width: 40, height: 48, borderRadius: 6, flexShrink: 0,
        background: 'linear-gradient(180deg,#fafafa,#f3f4f6)',
        border: `1px solid ${F.border}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        <i data-lucide="ribbon" style={{ width: 16, height: 16, color: seal }} />
        <div style={{
          position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)',
          width: 0, height: 0,
          borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
          borderTop: `6px solid ${seal}`, opacity: 0.85,
        }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: F.fg1, letterSpacing: -0.1 }}>
            {name}
          </span>
          <VerifyBadge status={status} />
        </div>
        <div style={{ fontSize: 11.5, color: F.fg2, marginTop: 2, fontWeight: 500 }}>{issuer}</div>
        <div style={{
          fontSize: 10.5, color: F.fg3, marginTop: 4,
          fontFamily: 'ui-monospace, Menlo, monospace',
          display: 'flex', gap: 10,
        }}>
          <span>Issued {issued}</span>
          <span style={{ color: F.borderStrong }}>·</span>
          <span style={{ color: status === 'expiring' ? '#9a3412' : F.fg3 }}>
            Expires {expires}
          </span>
        </div>
      </div>
      <button style={{
        background: 'transparent', border: 'none', padding: 4, cursor: 'pointer',
        color: F.fg4, alignSelf: 'flex-start',
      }}>
        <i data-lucide="more-horizontal" style={{ width: 16, height: 16 }} />
      </button>
    </div>
  );
}

function AddCertButton() {
  return (
    <button style={{
      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
      padding: '11px 14px', borderRadius: 10,
      background: 'transparent', border: `1.5px dashed ${B.violet200}`,
      color: B.violet700, fontSize: 13, fontWeight: 600, letterSpacing: -0.1,
      cursor: 'pointer', textAlign: 'left',
    }}>
      <i data-lucide="plus-circle" style={{ width: 15, height: 15 }} />
      <span style={{ flex: 1 }}>Upload certification</span>
      <span style={{ fontSize: 10, color: F.fg4, fontWeight: 500 }}>PDF · JPG</span>
    </button>
  );
}

// ─── Portfolio link card ──────────────────────────────────────

function LinkCard({ host, title, url, state, fresh }) {
  // state: 'ready' | 'loading' | 'error'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: 10, background: F.surface,
      border: `1px solid ${fresh ? B.amber200 : F.border}`,
      borderRadius: 10,
      boxShadow: fresh ? '0 0 0 3px rgba(217,119,6,0.08)' : 'none',
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 8, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: state === 'loading' ? F.sunken : '#fff',
        border: `1px solid ${F.border}`,
        color: F.fg2, position: 'relative', overflow: 'hidden',
      }}>
        {state === 'loading' ? (
          <i data-lucide="loader" style={{ width: 14, height: 14, color: B.violet500 }} />
        ) : (
          <i data-lucide={
            host.includes('github')  ? 'github' :
            host.includes('behance') ? 'palette' :
            host.includes('youtube') ? 'play-circle' :
            host.includes('linkedin')? 'linkedin' : 'link-2'
          } style={{ width: 16, height: 16, color: F.fg2 }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: F.fg1, letterSpacing: -0.1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{title}</div>
        <div style={{
          fontSize: 11, color: state === 'loading' ? B.violet600 : F.fg3,
          marginTop: 1, fontFamily: 'ui-monospace, Menlo, monospace',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{state === 'loading' ? 'Fetching preview…' : url}</div>
      </div>
      <i data-lucide="grip-vertical" style={{ width: 14, height: 14, color: F.fg4, flexShrink: 0 }} />
    </div>
  );
}

function AddLinkRow() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '11px 14px',
      color: B.violet700, fontSize: 13, fontWeight: 600,
      cursor: 'pointer',
    }}>
      <i data-lucide="plus-circle" style={{ width: 15, height: 15 }} />
      <span style={{ flex: 1 }}>Add link</span>
      <span style={{ fontSize: 10, color: F.fg4, fontWeight: 500 }}>up to 6</span>
    </div>
  );
}

// ─── Visibility row with extra "scope" sub-control ─────────────

function VisRow({ label, sub, on, scope, last }) {
  return (
    <div style={{
      padding: '12px 14px',
      borderBottom: last ? 'none' : `1px solid ${F.borderSub}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: F.fg1, letterSpacing: -0.1 }}>
            {label}
          </div>
          {sub && (
            <div style={{ fontSize: 11, color: F.fg3, marginTop: 2, lineHeight: '15px' }}>
              {sub}
            </div>
          )}
        </div>
        <Toggle on={on} />
      </div>
      {scope && on && (
        <div style={{
          marginTop: 8, padding: '6px 10px', borderRadius: 8,
          background: B.violet50, color: B.violet700,
          fontSize: 11, fontWeight: 600, letterSpacing: -0.05,
          display: 'inline-flex', alignItems: 'center', gap: 5,
        }}>
          <i data-lucide="users" style={{ width: 11, height: 11 }} />
          Visible to {scope}
        </div>
      )}
    </div>
  );
}

// ─── Sticky save bar (violet primary) ──────────────────────────

function ProSticky({ state, dirtyCount, pendingCount }) {
  // state: 'saved' | 'pending-save' | 'dirty'
  if (state === 'saved') {
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
          <i data-lucide="badge-check" style={{ width: 13, height: 13, color: F.success600 }} />
          Published · all claims verified
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
  // pending-save (the dirty + pending verification state)
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'rgba(255,255,255,0.96)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      borderTop: `1px solid ${F.border}`,
      padding: '10px 16px 26px',
      zIndex: 10,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 8, padding: '6px 10px', borderRadius: 8,
        background: B.amber50, border: `1px solid ${B.amber200}`,
      }}>
        <i data-lucide="clock" style={{ width: 13, height: 13, color: B.amber700, flexShrink: 0 }} />
        <span style={{ fontSize: 11.5, color: B.amber700, fontWeight: 600, flex: 1, lineHeight: '14px' }}>
          {pendingCount} new claims need verification · usually 1–2 business days
        </span>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 9999,
          background: B.violet50, border: `1px solid ${B.violet200}`,
          color: B.violet700, fontSize: 11, fontWeight: 700, letterSpacing: 0.1,
          textTransform: 'uppercase',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: B.violet600,
          }} />
          {dirtyCount} edits
        </div>
        <div style={{ flex: 1 }} />
        <button style={{
          height: 42, padding: '0 14px', borderRadius: 10,
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: F.fg2, fontSize: 13.5, fontWeight: 600, letterSpacing: -0.1,
        }}>Discard</button>
        <button style={{
          height: 42, padding: '0 22px', borderRadius: 10, border: 'none',
          background: B.violet600, color: '#fff',
          fontSize: 14, fontWeight: 600, letterSpacing: -0.1, cursor: 'pointer',
          boxShadow: '0 6px 16px rgba(124,58,237,0.32)',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <i data-lucide="check" style={{ width: 15, height: 15 }} />
          Save &amp; submit
        </button>
      </div>
    </div>
  );
}

// ─── FRAME · VERIFIED (published, clean) ───────────────────────

function FrameProProfileVerified() {
  return (
    <Phone>
      <ProTopBar title="Professional profile" />
      <ScrollArea bottomPad={120}>

        <PillarStrip strength={92} complete />

        <Section overline="Role">
          <div>
            <ProLabel required>Title</ProLabel>
            <Input value="Licensed General Handyman" />
          </div>
          <div>
            <ProLabel>Company</ProLabel>
            <CompanyField value="Kovács &amp; Co Handywork" status="verified" />
          </div>
          <div>
            <ProLabel optional>Tagline</ProLabel>
            <Input value="Squeaky floors, leaky faucets, locked doors — fixed by Wednesday." />
          </div>
        </Section>

        <Section overline="Skills">
          <div>
            <ProLabel>Specialties</ProLabel>
            <div style={{
              padding: 10, background: F.surface, border: `1px solid ${F.border}`,
              borderRadius: 8, display: 'flex', flexWrap: 'wrap', gap: 6,
              minHeight: 44, alignItems: 'center',
            }}>
              <ProSkillChip label="Carpentry"     icon="hammer" />
              <ProSkillChip label="Plumbing"      icon="droplets" />
              <ProSkillChip label="Electrical"    icon="zap" />
              <ProSkillChip label="Locksmith"     icon="key-round" />
              <ProSkillChip label="Floors"        icon="square" />
              <AddSkillChip />
            </div>
            <div style={{ fontSize: 11, color: F.fg3, marginTop: 6, fontStyle: 'italic' }}>
              Match jobs Pantopus shows you. Up to 8.
            </div>
          </div>
        </Section>

        <Section overline="Certifications">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <CertCard
              name="NY State General Contractor"
              issuer="New York State Dept. of Labor"
              issued="Mar 2021"
              expires="Mar 2027"
              status="verified"
            />
            <CertCard
              name="OSHA 30-Hour General Industry"
              issuer="OSHA Training Institute"
              issued="Aug 2023"
              expires="Aug 2028"
              status="verified"
            />
            <CertCard
              name="EPA Lead-Safe Renovator"
              issuer="U.S. Environmental Protection Agency"
              issued="Jan 2022"
              expires="Jan 2027"
              status="expiring"
            />
            <AddCertButton />
          </div>
        </Section>

        <Section overline="Portfolio">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <LinkCard
              host="kovacsco.work"
              title="kovacsco.work · Past projects"
              url="https://kovacsco.work"
              state="ready"
            />
            <LinkCard
              host="instagram"
              title="@kovacs.handywork"
              url="instagram.com/kovacs.handywork"
              state="ready"
            />
            <LinkCard
              host="youtube"
              title="Hardwood floor repair walk-through"
              url="youtu.be/_2j8…"
              state="ready"
            />
            <div style={{ marginTop: 4 }}>
              <Card padding={0}>
                <AddLinkRow />
              </Card>
            </div>
          </div>
        </Section>

        <Section overline="Visibility" gap={0}>
          <Card padding={0}>
            <VisRow
              label="Show on neighbor search"
              sub="Verified neighbors searching Pulse find your pro profile."
              on={true}
              scope="Elm Park · 0.6 mi radius"
            />
            <VisRow
              label="Show hourly rate publicly"
              sub="$85/hr · weekday daytime. Hides on gig posts when off."
              on={true}
            />
            <VisRow
              label="Open to direct messages"
              sub="Off restricts contact to gig threads only."
              on={true}
              last
            />
          </Card>
        </Section>

      </ScrollArea>
      <ProSticky state="saved" />
    </Phone>
  );
}

// ─── FRAME · PENDING (dirty + new claims to verify) ────────────

function FrameProProfilePending() {
  return (
    <Phone>
      <ProTopBar title="Professional profile" />
      <ScrollArea bottomPad={150}>

        <PillarStrip strength={68} />

        <Section overline="Role">
          <div>
            <ProLabel required>Title</ProLabel>
            <Input value="Licensed General Handyman" />
          </div>
          <div>
            <ProLabel dirty>Company</ProLabel>
            <CompanyField value="Elm Park Trades Co-op" status="pending" />
            <div style={{ fontSize: 11, color: B.amber700, marginTop: 6,
                          display: 'flex', alignItems: 'center', gap: 4 }}>
              <i data-lucide="info" style={{ width: 11, height: 11 }} />
              We'll email the co-op admin to confirm you're a member.
            </div>
          </div>
          <div>
            <ProLabel optional>Tagline</ProLabel>
            <Input value="Squeaky floors, leaky faucets, locked doors — fixed by Wednesday." />
          </div>
        </Section>

        <Section overline="Skills">
          <div>
            <ProLabel dirty>Specialties</ProLabel>
            <div style={{
              padding: 10, background: F.surface, border: `1px solid ${F.border}`,
              borderRadius: 8, display: 'flex', flexWrap: 'wrap', gap: 6,
              minHeight: 44, alignItems: 'center',
            }}>
              <ProSkillChip label="Carpentry"  icon="hammer" />
              <ProSkillChip label="Plumbing"   icon="droplets" />
              <ProSkillChip label="Electrical" icon="zap" />
              <ProSkillChip label="Locksmith"  icon="key-round" />
              <ProSkillChip label="Floors"     icon="square" />
              <ProSkillChip label="Tile work"  icon="grid-3x3" fresh />
              <AddSkillChip />
            </div>
            <div style={{ fontSize: 11, color: F.fg3, marginTop: 6, fontStyle: 'italic' }}>
              Match jobs Pantopus shows you. Up to 8.
            </div>
          </div>
        </Section>

        <Section overline="Certifications">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <CertCard
              name="NY State General Contractor"
              issuer="New York State Dept. of Labor"
              issued="Mar 2021"
              expires="Mar 2027"
              status="verified"
            />
            <CertCard
              name="OSHA 30-Hour General Industry"
              issuer="OSHA Training Institute"
              issued="Aug 2023"
              expires="Aug 2028"
              status="verified"
            />
            <CertCard
              name="Certified Tile Installer (CTI)"
              issuer="Ceramic Tile Education Foundation"
              issued="May 2026"
              expires="May 2031"
              status="pending"
              fresh
            />
            <CertCard
              name="EPA Lead-Safe Renovator"
              issuer="U.S. Environmental Protection Agency"
              issued="Jan 2022"
              expires="Jan 2027"
              status="expiring"
            />
            <AddCertButton />
          </div>
        </Section>

        <Section overline="Portfolio">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <LinkCard
              host="kovacsco.work"
              title="kovacsco.work · Past projects"
              url="https://kovacsco.work"
              state="ready"
            />
            <LinkCard
              host="instagram"
              title="@kovacs.handywork"
              url="instagram.com/kovacs.handywork"
              state="ready"
            />
            <LinkCard
              host="youtube"
              title="Hardwood floor repair walk-through"
              url="youtu.be/_2j8…"
              state="ready"
            />
            <LinkCard
              host="behance"
              title=""
              url="behance.net/mariak/tile-bathroom-2026"
              state="loading"
              fresh
            />
            <div style={{ marginTop: 4 }}>
              <Card padding={0}>
                <AddLinkRow />
              </Card>
            </div>
          </div>
        </Section>

        <Section overline="Visibility" gap={0}>
          <Card padding={0}>
            <VisRow
              label="Show on neighbor search"
              sub="Verified neighbors searching Pulse find your pro profile."
              on={true}
              scope="Elm Park · 0.6 mi radius"
            />
            <VisRow
              label="Show hourly rate publicly"
              sub="$85/hr · weekday daytime. Hides on gig posts when off."
              on={false}
            />
            <VisRow
              label="Open to direct messages"
              sub="Off restricts contact to gig threads only."
              on={true}
              last
            />
          </Card>
        </Section>

      </ScrollArea>
      <ProSticky state="pending-save" dirtyCount={5} pendingCount={2} />
    </Phone>
  );
}

Object.assign(window, { FrameProProfileVerified, FrameProProfilePending });
