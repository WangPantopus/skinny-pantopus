// Pantopus — Single-screen Form archetype
// Three frames: Simple (Send invite), Multi-section (Edit profile), Field-heavy (Disambiguate)
// Validated fields: green check. Errored: 1.5px red border + inline msg.
// Required fields: small * in label.

const F = {
  primary50:  '#f0f9ff',
  primary100: '#e0f2fe',
  primary500: '#0ea5e9',
  primary600: '#0284c7',
  primary700: '#0369a1',
  bg:      '#f6f7f9',
  surface: '#ffffff',
  sunken:  '#f3f4f6',
  muted:   '#f8fafc',
  border:  '#e5e7eb',
  borderStrong: '#d1d5db',
  borderSub: '#f3f4f6',
  fg1: '#111827',
  fg2: '#374151',
  fg3: '#6b7280',
  fg4: '#9ca3af',
  successBg: '#d1fae5',
  success:   '#047857',
  success600:'#059669',
  errorBg:   '#fee2e2',
  errorLight:'#fecaca',
  error:     '#b91c1c',
  error600:  '#dc2626',
  personalBg:'#dbeafe',
  personal:  '#1d4ed8',
  homeBg:    '#dcfce7',
  home:      '#16a34a',
};

// ─── Shell pieces ─────────────────────────────────────────────

function SB() {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '16px 28px 0', height: 44, boxSizing: 'border-box',
      fontFamily: '-apple-system, system-ui', fontWeight: 600, fontSize: 15, color: F.fg1,
    }}>
      <span>9:41</span>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={F.fg1}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={F.fg1}/><rect x="9" y="2" width="3" height="9" rx="0.6" fill={F.fg1}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={F.fg1}/></svg>
        <svg width="15" height="11" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={F.fg1}/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={F.fg1}/><circle cx="7.5" cy="9" r="1.3" fill={F.fg1}/></svg>
        <svg width="24" height="11" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={F.fg1} strokeOpacity="0.35" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill={F.fg1}/><path d="M22.5 3.8v3.4c.6-.2 1-.8 1-1.7s-.4-1.5-1-1.7z" fill={F.fg1} fillOpacity="0.4"/></svg>
      </div>
    </div>
  );
}

function Phone({ children }) {
  return (
    <div style={{
      width: 360, height: 740, borderRadius: 46, padding: 10,
      background: '#0b0f17',
      boxShadow: '0 40px 80px rgba(17,24,39,0.22), 0 0 0 1px rgba(0,0,0,0.14)',
    }}>
      <div style={{
        width: '100%', height: '100%', background: F.bg,
        borderRadius: 36, overflow: 'hidden', position: 'relative',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          position: 'absolute', top: 9, left: '50%', transform: 'translateX(-50%)',
          width: 108, height: 30, borderRadius: 20, background: '#000', zIndex: 50,
        }} />
        <SB />
        {children}
        <div style={{
          position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)',
          width: 120, height: 4, borderRadius: 4, background: 'rgba(0,0,0,0.25)',
          zIndex: 60,
        }} />
      </div>
    </div>
  );
}

function TopBar({ title, rightLabel, rightDisabled, rightPrimary = true, rightAction }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '8px 8px',
      height: 52, boxSizing: 'border-box', background: F.surface,
      borderBottom: `1px solid ${F.border}`, flexShrink: 0,
    }}>
      <button style={{
        width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: 'none', cursor: 'pointer', color: F.fg1, padding: 0,
        borderRadius: 8,
      }}>
        <i data-lucide="x" style={{ width: 22, height: 22 }} />
      </button>
      <div style={{
        flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 600,
        color: F.fg1, letterSpacing: -0.2,
      }}>{title}</div>
      {rightLabel ? (
        <button disabled={rightDisabled} onClick={rightAction} style={{
          minWidth: 52, height: 32, padding: '0 12px', borderRadius: 9,
          background: 'transparent', border: 'none', cursor: rightDisabled ? 'not-allowed' : 'pointer',
          color: rightDisabled ? F.fg4 : (rightPrimary ? F.primary600 : F.fg2),
          fontSize: 15, fontWeight: 600, letterSpacing: -0.1,
        }}>{rightLabel}</button>
      ) : <div style={{ width: 36 }} />}
    </div>
  );
}

// ─── Form atoms ───────────────────────────────────────────────

function OverlineLabel({ children, style = {} }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: F.fg3, marginBottom: 10, ...style,
    }}>{children}</div>
  );
}

function FieldLabel({ children, required }) {
  return (
    <label style={{
      display: 'block', fontSize: 12, fontWeight: 600, color: F.fg2,
      marginBottom: 6, letterSpacing: -0.05,
    }}>
      {children}
      {required && <span style={{ color: F.error600, marginLeft: 3 }}>*</span>}
    </label>
  );
}

function Input({ value, placeholder, leading, trailing, state = 'default', error, helper, type = 'text' }) {
  const borderColor =
    state === 'error'   ? F.error600 :
    state === 'valid'   ? F.success600 :
    state === 'focus'   ? F.primary600 :
                          F.border;
  const borderWidth = state === 'default' ? 1 : 1.5;
  const ring = state === 'focus' ? '0 0 0 3px rgba(2,132,199,0.15)' :
               state === 'error' ? '0 0 0 3px rgba(220,38,38,0.10)' :
               state === 'valid' ? '0 0 0 3px rgba(5,150,105,0.08)' : 'none';
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        height: 44, padding: leading ? '0 12px 0 10px' : '0 12px',
        background: F.surface, border: `${borderWidth}px solid ${borderColor}`,
        borderRadius: 8, boxShadow: ring, transition: 'all 120ms',
      }}>
        {leading && <span style={{ color: F.fg4, fontSize: 14, fontWeight: 500 }}>{leading}</span>}
        <span style={{
          flex: 1, fontSize: 14, color: value ? F.fg1 : F.fg4,
          letterSpacing: -0.1, fontWeight: value ? 500 : 400,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{value || placeholder}</span>
        {state === 'valid' && (
          <i data-lucide="check-circle-2" style={{ width: 18, height: 18, color: F.success600, flexShrink: 0 }} />
        )}
        {state === 'error' && (
          <i data-lucide="alert-circle" style={{ width: 18, height: 18, color: F.error600, flexShrink: 0 }} />
        )}
        {trailing && !['valid', 'error'].includes(state) && trailing}
      </div>
      {error && (
        <div style={{ fontSize: 11, color: F.error, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
          <i data-lucide="alert-circle" style={{ width: 11, height: 11 }} />
          {error}
        </div>
      )}
      {!error && helper && (
        <div style={{ fontSize: 11, color: F.fg3, marginTop: 6, fontStyle: 'italic' }}>
          {helper}
        </div>
      )}
    </div>
  );
}

function Textarea({ value, placeholder, height = 80, charCount }) {
  return (
    <div>
      <div style={{
        padding: 12, background: F.surface, border: `1px solid ${F.border}`,
        borderRadius: 8, minHeight: height, position: 'relative',
        fontSize: 14, color: value ? F.fg1 : F.fg4, letterSpacing: -0.1,
        lineHeight: '20px',
      }}>
        {value || placeholder}
        {charCount && (
          <div style={{
            position: 'absolute', right: 10, bottom: 8,
            fontSize: 11, color: F.fg4,
            fontFamily: 'ui-monospace, Menlo, monospace',
          }}>{charCount}</div>
        )}
      </div>
    </div>
  );
}

function Slider({ value = 25, max = 100 }) {
  const pct = (value / max) * 100;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ flex: 1, position: 'relative', height: 24, display: 'flex', alignItems: 'center' }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2,
          background: F.sunken,
        }} />
        <div style={{
          position: 'absolute', left: 0, width: `${pct}%`, height: 4, borderRadius: 2,
          background: F.primary600,
        }} />
        <div style={{
          position: 'absolute', left: `calc(${pct}% - 12px)`, width: 24, height: 24,
          borderRadius: '50%', background: F.surface,
          border: `2px solid ${F.primary600}`,
          boxShadow: '0 2px 6px rgba(2,132,199,0.25), 0 1px 2px rgba(0,0,0,0.08)',
        }} />
      </div>
      <div style={{
        minWidth: 44, padding: '4px 10px', borderRadius: 9999,
        background: F.primary50, color: F.primary700,
        fontSize: 13, fontWeight: 700, textAlign: 'center', letterSpacing: -0.1,
        fontFamily: 'ui-monospace, Menlo, monospace',
      }}>{value}%</div>
    </div>
  );
}

function Toggle({ on }) {
  return (
    <div style={{
      width: 44, height: 26, borderRadius: 13, padding: 2, boxSizing: 'border-box',
      background: on ? F.primary600 : F.borderStrong, flexShrink: 0,
      transition: 'background 150ms', position: 'relative',
      boxShadow: on ? 'inset 0 1px 2px rgba(0,0,0,0.06)' : 'inset 0 1px 2px rgba(0,0,0,0.08)',
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%', background: '#fff',
        transform: `translateX(${on ? 18 : 0}px)`,
        transition: 'transform 150ms',
        boxShadow: '0 2px 4px rgba(0,0,0,0.18), 0 0 0 0.5px rgba(0,0,0,0.04)',
      }} />
    </div>
  );
}

function ToggleRow({ label, sub, on, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      borderBottom: last ? 'none' : `1px solid ${F.borderSub}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: F.fg1, letterSpacing: -0.1 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: F.fg3, marginTop: 2, lineHeight: '15px' }}>{sub}</div>}
      </div>
      <Toggle on={on} />
    </div>
  );
}

function Chip({ label, removable, addBtn }) {
  if (addBtn) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '6px 10px', borderRadius: 9999,
        border: `1px dashed ${F.borderStrong}`,
        color: F.fg3, fontSize: 12, fontWeight: 500,
        background: 'transparent', cursor: 'pointer',
      }}>
        <i data-lucide="plus" style={{ width: 12, height: 12 }} />
        {label}
      </span>
    );
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '6px 4px 6px 10px', borderRadius: 9999,
      background: F.primary50, color: F.primary700,
      border: `1px solid ${F.primary100}`,
      fontSize: 12, fontWeight: 600,
    }}>
      {label}
      {removable && (
        <span style={{
          width: 16, height: 16, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: F.primary600, cursor: 'pointer',
        }}>
          <i data-lucide="x" style={{ width: 12, height: 12, strokeWidth: 2.5 }} />
        </span>
      )}
    </span>
  );
}

function Card({ children, padding = 0, style = {} }) {
  return (
    <div style={{
      background: F.surface, border: `1px solid ${F.border}`,
      borderRadius: 12, padding, overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      ...style,
    }}>{children}</div>
  );
}

function ScrollArea({ children, bottomPad = 24 }) {
  return (
    <div style={{
      flex: 1, overflow: 'auto',
      padding: `16px 16px ${bottomPad}px`,
      display: 'flex', flexDirection: 'column', gap: 20,
    }}>{children}</div>
  );
}

function Section({ overline, children, gap = 12 }) {
  return (
    <div>
      {overline && <OverlineLabel>{overline}</OverlineLabel>}
      <div style={{ display: 'flex', flexDirection: 'column', gap }}>
        {children}
      </div>
    </div>
  );
}

// ─── FRAME 1 · SIMPLE (Send invite) ───────────────────────────

function FrameInvite() {
  return (
    <Phone>
      <TopBar title="Invite owner" rightLabel="Send" rightDisabled={false} />
      <ScrollArea bottomPad={40}>
        <Section overline="Contact info">
          <div>
            <FieldLabel required>Email</FieldLabel>
            <Input value="maya.fortune@pantopus.app" state="valid" type="email" />
          </div>
          <div>
            <FieldLabel>Phone (optional)</FieldLabel>
            <Input value="(415) 555-0198" leading="+1" helper="Used only for SMS verification code." />
          </div>
        </Section>

        <Section overline="Ownership">
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <FieldLabel required>Ownership share</FieldLabel>
            </div>
            <Slider value={25} />
            <div style={{ fontSize: 11, color: F.fg3, marginTop: 8, fontStyle: 'italic' }}>
              Used for bill splits and decision quorum. You keep 75%.
            </div>
          </div>
        </Section>

        <Section overline="Message">
          <div>
            <FieldLabel>Personal note (optional)</FieldLabel>
            <Textarea value="Hey Maya — adding you to 412 Elm. Accept anytime, the household waits." height={86} />
          </div>
        </Section>
      </ScrollArea>
    </Phone>
  );
}

// ─── FRAME 2 · MULTI-SECTION (Edit profile) ──────────────────

function FrameEditProfile() {
  return (
    <Phone>
      <TopBar title="Edit profile" rightLabel="Save" />
      <ScrollArea bottomPad={32}>
        {/* Avatar upload */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              width: 96, height: 96, borderRadius: '50%',
              background: 'linear-gradient(135deg,#0ea5e9,#0369a1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 32, fontWeight: 700, letterSpacing: -0.5,
              boxShadow: '0 6px 16px rgba(2,132,199,0.2)',
            }}>MK</div>
            <div style={{
              position: 'absolute', right: -2, bottom: -2,
              width: 30, height: 30, borderRadius: '50%',
              background: F.surface, border: `2px solid ${F.bg}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: F.primary600,
              boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
            }}>
              <i data-lucide="camera" style={{ width: 15, height: 15 }} />
            </div>
          </div>
          <button style={{
            background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
            color: F.primary600, fontSize: 13, fontWeight: 600, letterSpacing: -0.1,
          }}>Change photo</button>
        </div>

        {/* Cover photo */}
        <div>
          <FieldLabel>Cover photo</FieldLabel>
          <div style={{
            aspectRatio: '16 / 9', borderRadius: 12, overflow: 'hidden',
            background: 'linear-gradient(135deg,#bae6fd 0%,#0284c7 60%,#0369a1 100%)',
            position: 'relative', cursor: 'pointer',
          }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 6, color: '#fff', fontSize: 13, fontWeight: 600,
            }}>
              <i data-lucide="image-plus" style={{ width: 18, height: 18 }} />
              Add cover
            </div>
          </div>
        </div>

        <Section overline="About you">
          <div>
            <FieldLabel required>Display name</FieldLabel>
            <Input value="Maria Kovács" state="valid" />
          </div>
          <div>
            <FieldLabel required>Username</FieldLabel>
            <Input value="mariak" leading="@" state="valid" helper="Lowercase, no spaces. Visible on your profile." />
          </div>
          <div>
            <FieldLabel>Bio</FieldLabel>
            <Textarea
              value="Elm Park since '19. Occasional handyman. Fixes squeaky floors, usually."
              height={96}
              charCount="68 / 240"
            />
          </div>
        </Section>

        <Section overline="Skills">
          <div>
            <FieldLabel>What you can help with</FieldLabel>
            <div style={{
              padding: 10, background: F.surface, border: `1px solid ${F.border}`,
              borderRadius: 8, display: 'flex', flexWrap: 'wrap', gap: 6,
              minHeight: 44, alignItems: 'center',
            }}>
              <Chip label="Handyman" removable />
              <Chip label="Tutoring" removable />
              <Chip label="Pet care" removable />
              <Chip label="Add skill" addBtn />
            </div>
            <div style={{ fontSize: 11, color: F.fg3, marginTop: 6, fontStyle: 'italic' }}>
              Neighbors see these on your Pulse &amp; task posts.
            </div>
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
              sub="Only for accepted tasks and marketplace deals."
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
    </Phone>
  );
}

// ─── FRAME 3 · FIELD-HEAVY (Disambiguate mail recipient) ──────

function FrameDisambiguate() {
  const [selected, setSelected] = React.useState(0);
  const candidates = [
    { initials: 'MK', name: 'Maria Kovács',  role: 'Owner',    roleBg: F.primary100, roleFg: F.primary700,
      grant: 'Receives mail', avatarBg: 'linear-gradient(135deg,#0ea5e9,#0369a1)', verified: true, match: 'Strong match' },
    { initials: 'MK', name: 'Marcus Khan',   role: 'Resident', roleBg: F.homeBg,     roleFg: F.home,
      grant: 'Receives mail', avatarBg: 'linear-gradient(135deg,#16a34a,#15803d)', verified: true },
    { initials: 'MK', name: 'Mika Kim',      role: 'Guest',    roleBg: F.sunken,     roleFg: F.fg2,
      grant: 'No mail access', avatarBg: 'linear-gradient(135deg,#f97316,#c2410c)', verified: false },
  ];

  return (
    <Phone>
      <TopBar title="Who is this for?" />
      <ScrollArea bottomPad={110}>
        {/* Scanned mail preview */}
        <div>
          <FieldLabel>Scanned envelope</FieldLabel>
          <Card padding={0} style={{ borderRadius: 14 }}>
            <div style={{
              aspectRatio: '16 / 9',
              background: 'linear-gradient(135deg, #f8f4ec 0%, #f0e7d3 100%)',
              position: 'relative', overflow: 'hidden',
            }}>
              {/* stylized envelope */}
              <div style={{
                position: 'absolute', left: 16, top: 18, right: 88,
                fontFamily: 'ui-monospace, Menlo, monospace',
              }}>
                <div style={{ fontSize: 9, color: '#6b5f4a', letterSpacing: 0.5, marginBottom: 6 }}>GLOBAL BANK · RETURN SERVICE</div>
                <div style={{ height: 2, width: 90, background: '#c2b48a', marginBottom: 14 }} />
                <div style={{ fontSize: 13, color: '#2d2414', fontWeight: 600, lineHeight: '17px' }}>
                  Maria K.<br/>
                  <span style={{ fontSize: 11, fontWeight: 500 }}>412 Elm St, Apt 3B</span><br/>
                  <span style={{ fontSize: 11, fontWeight: 500 }}>Elm Park, NY 10013</span>
                </div>
              </div>
              {/* postage */}
              <div style={{
                position: 'absolute', right: 14, top: 14,
                width: 54, height: 64, border: '1.5px dashed #a08d5e',
                background: 'rgba(255,255,255,0.5)', borderRadius: 3,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                color: '#6b5f4a', fontFamily: 'ui-monospace, Menlo, monospace',
                transform: 'rotate(3deg)',
              }}>
                <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: 0.3 }}>USA</div>
                <div style={{ fontSize: 14, fontWeight: 800 }}>68¢</div>
                <div style={{ fontSize: 6, opacity: 0.7 }}>FOREVER</div>
              </div>
            </div>
          </Card>

          {/* OCR result */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginTop: 10,
            padding: '8px 12px', background: F.primary50, borderRadius: 8,
          }}>
            <i data-lucide="scan-text" style={{ width: 14, height: 14, color: F.primary600, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: F.fg2, flex: 1, lineHeight: '16px' }}>
              OCR detected <span style={{ fontWeight: 600, color: F.fg1 }}>"Addressed to: Maria K."</span>
            </span>
          </div>
        </div>

        {/* Candidates */}
        <div>
          <OverlineLabel>Select recipient <span style={{ color: F.error600 }}>*</span></OverlineLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {candidates.map((c, i) => {
              const on = selected === i;
              return (
                <button key={i} onClick={() => setSelected(i)} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: F.surface,
                  border: on ? `1.5px solid ${F.primary600}` : `1px solid ${F.border}`,
                  borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
                  boxShadow: on ? '0 0 0 3px rgba(2,132,199,0.12), 0 1px 3px rgba(0,0,0,0.04)' : '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'all 120ms', textAlign: 'left', width: '100%',
                  position: 'relative',
                }}>
                  {/* radio */}
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    border: on ? `6px solid ${F.primary600}` : `2px solid ${F.borderStrong}`,
                    background: F.surface, flexShrink: 0, boxSizing: 'border-box',
                    transition: 'all 120ms',
                  }} />
                  {/* avatar */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%', background: c.avatarBg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 700, fontSize: 13,
                    }}>{c.initials}</div>
                    {c.verified && (
                      <div style={{
                        position: 'absolute', right: -2, bottom: -2,
                        width: 15, height: 15, borderRadius: '50%', background: F.home,
                        border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <i data-lucide="check" style={{ width: 9, height: 9, color: '#fff', strokeWidth: 4 }} />
                      </div>
                    )}
                  </div>
                  {/* info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: F.fg1, letterSpacing: -0.1 }}>{c.name}</span>
                      {c.match && (
                        <span style={{
                          fontSize: 9.5, fontWeight: 700, letterSpacing: 0.1,
                          color: F.success, background: F.successBg,
                          padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase',
                        }}>{c.match}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 10.5, fontWeight: 600,
                        background: c.roleBg, color: c.roleFg,
                        padding: '2px 7px', borderRadius: 9999,
                      }}>{c.role}</span>
                      <span style={{ fontSize: 11, color: F.fg3, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <i data-lucide={c.grant === 'No mail access' ? 'mail-x' : 'mail-check'} style={{ width: 11, height: 11 }} />
                        {c.grant}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <button style={{
            marginTop: 10, background: 'transparent', border: 'none', padding: '8px 4px',
            color: F.primary600, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <i data-lucide="plus" style={{ width: 13, height: 13 }} />
            None of these — add new person
          </button>
        </div>
      </ScrollArea>

      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderTop: `1px solid ${F.border}`,
        padding: '12px 16px 28px', zIndex: 10,
      }}>
        <button style={{
          width: '100%', height: 46, borderRadius: 12, border: 'none',
          background: F.primary600, color: '#fff',
          fontSize: 14, fontWeight: 600, cursor: 'pointer',
          boxShadow: '0 6px 16px rgba(2,132,199,0.28)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          letterSpacing: -0.1,
        }}>
          <i data-lucide="check" style={{ width: 16, height: 16 }} />
          Confirm recipient
        </button>
      </div>
    </Phone>
  );
}

Object.assign(window, {
  FrameInvite, FrameEditProfile, FrameDisambiguate,
  // atoms — for downstream screens inheriting the archetype
  F, Phone, TopBar, OverlineLabel, FieldLabel, Input, Textarea,
  Slider, Toggle, ToggleRow, Chip, Card, ScrollArea, Section,
});
