// Pantopus — A12.8 · src/app/gig-v2/new.tsx
// Magic Task creation wizard — Step 1 (start)
// Frame 1: AI-assisted describe populated with live archetype + module parse
// Frame 2: Manual archetype picker (alternate entry, "Pick a category instead")

const PT = {
  primary50:  '#f0f9ff',
  primary100: '#e0f2fe',
  primary200: '#bae6fd',
  primary500: '#0ea5e9',
  primary600: '#0284c7',
  primary700: '#0369a1',
  bg:      '#f6f7f9',
  surface: '#ffffff',
  sunken:  '#f3f4f6',
  raised:  '#f9fafb',
  border:  '#e5e7eb',
  borderStrong: '#d1d5db',
  fg1: '#111827',
  fg2: '#374151',
  fg3: '#6b7280',
  fg4: '#9ca3af',
  success50: '#f0fdf4',
  success100: '#d1fae5',
  success600:'#059669',
  success700:'#047857',
  warning50: '#fffbeb',
  warning100:'#fde68a',
  warning600:'#d97706',
  warning700:'#b45309',
  // category accents
  catHandyman:  '#f97316',
  catHandymanBg:'#fff7ed',
  catCleaning:  '#27ae60',
  catCleaningBg:'#ecfdf5',
  catMoving:    '#8e44ad',
  catMovingBg:  '#f5f3ff',
  catPet:       '#e74c3c',
  catPetBg:     '#fef2f2',
  catChild:     '#f39c12',
  catChildBg:   '#fffbeb',
  catTutoring:  '#2980b9',
  catTutoringBg:'#eff6ff',
  catDelivery:  '#374151',
  catDeliveryBg:'#f3f4f6',
  catTech:      '#3498db',
  catTechBg:    '#eff6ff',
  // identity personal
  personal:    '#0284c7',
  personalBg:  '#dbeafe',
  // magic
  magic:       '#7c3aed',
  magicBg:     '#f5f3ff',
  magicBorder: '#ddd6fe',
};

// ─── Phone shell ───────────────────────────────────────────────

function SB() {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '16px 28px 0', height: 44, boxSizing: 'border-box',
      fontFamily: '-apple-system, system-ui', fontWeight: 600, fontSize: 15, color: PT.fg1,
    }}>
      <span>9:41</span>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={PT.fg1}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={PT.fg1}/><rect x="9" y="2" width="3" height="9" rx="0.6" fill={PT.fg1}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={PT.fg1}/></svg>
        <svg width="15" height="11" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={PT.fg1}/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={PT.fg1}/><circle cx="7.5" cy="9" r="1.3" fill={PT.fg1}/></svg>
        <svg width="24" height="11" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={PT.fg1} strokeOpacity="0.35" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill={PT.fg1}/><path d="M22.5 3.8v3.4c.6-.2 1-.8 1-1.7s-.4-1.5-1-1.7z" fill={PT.fg1} fillOpacity="0.4"/></svg>
      </div>
    </div>
  );
}

function Phone({ children, label }) {
  return (
    <div style={{
      width: 360, height: 740, borderRadius: 46, padding: 10,
      background: '#0b0f17',
      boxShadow: '0 40px 80px rgba(17,24,39,0.22), 0 0 0 1px rgba(0,0,0,0.14)',
    }} data-screen-label={label}>
      <div style={{
        width: '100%', height: '100%', background: PT.bg,
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

function WizardHeader({ title, step, total }) {
  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', padding: '8px 8px',
        height: 48, boxSizing: 'border-box', background: PT.surface, flexShrink: 0,
      }}>
        <button style={{
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer', color: PT.fg1, padding: 0,
          borderRadius: 8,
        }}>
          <i data-lucide="x" style={{ width: 22, height: 22 }} />
        </button>
        <div style={{
          flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600,
          color: PT.fg1, letterSpacing: -0.15,
        }}>{title}</div>
        <div style={{
          minWidth: 52, padding: '0 12px', fontSize: 12, fontWeight: 500,
          color: PT.fg3, textAlign: 'right', letterSpacing: -0.05,
        }}>{step && total ? `${step} of ${total}` : ''}</div>
      </div>
      {step && total && (
        <div style={{
          display: 'flex', gap: 4, padding: '0 16px 8px',
          background: PT.surface, borderBottom: `1px solid ${PT.border}`,
        }}>
          {Array.from({ length: total }, (_, i) => (
            <div key={i} style={{
              flex: 1, height: 4, borderRadius: 3,
              background: i < step ? PT.primary600 : PT.border,
            }} />
          ))}
        </div>
      )}
    </>
  );
}

function ScrollArea({ children, bottomPad = 108 }) {
  return (
    <div style={{
      flex: 1, overflow: 'auto',
      padding: `16px 16px ${bottomPad}px`,
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>{children}</div>
  );
}

function StickyBottom({ children }) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'rgba(255,255,255,0.96)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      borderTop: `1px solid ${PT.border}`,
      padding: '12px 16px 28px', zIndex: 10,
      display: 'flex', gap: 10, alignItems: 'center',
    }}>{children}</div>
  );
}

function PrimaryBtn({ children, icon, disabled, flex = 1, full }) {
  return (
    <button disabled={disabled} style={{
      flex, width: full ? '100%' : undefined,
      height: 48, borderRadius: 12, border: 'none',
      background: disabled ? PT.sunken : PT.primary600,
      color: disabled ? PT.fg4 : '#fff',
      fontSize: 14, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
      boxShadow: disabled ? 'none' : '0 6px 16px rgba(2,132,199,0.28)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      letterSpacing: -0.1,
    }}>
      {children}
      {icon && <i data-lucide={icon} style={{ width: 16, height: 16 }} />}
    </button>
  );
}

function GhostBtn({ children, icon, flex }) {
  return (
    <button style={{
      flex,
      height: 48, borderRadius: 12,
      background: PT.surface, color: PT.fg2,
      border: `1px solid ${PT.border}`,
      fontSize: 13, fontWeight: 600, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      letterSpacing: -0.1, padding: '0 14px',
    }}>
      {icon && <i data-lucide={icon} style={{ width: 15, height: 15 }} />}
      {children}
    </button>
  );
}

function OverlineLabel({ children, style = {} }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: PT.fg3, marginBottom: 10, ...style,
    }}>{children}</div>
  );
}

function IdentityChip() {
  return (
    <div style={{
      display: 'inline-flex', padding: '4px 10px', borderRadius: 9999,
      background: PT.personalBg, color: PT.personal, fontSize: 10.5, fontWeight: 700,
      letterSpacing: 0.06, textTransform: 'uppercase', alignSelf: 'flex-start',
      alignItems: 'center', gap: 4,
    }}>
      <i data-lucide="user" style={{ width: 11, height: 11 }} />
      Personal · You
    </div>
  );
}

// ─── AI describe card (Frame 1) ────────────────────────────────

function DescribeCard() {
  return (
    <div style={{
      background: PT.surface, border: `1px solid ${PT.border}`, borderRadius: 16,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden',
    }}>
      {/* Header strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '11px 14px',
        background: PT.magicBg, borderBottom: `1px solid ${PT.magicBorder}`,
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: 7,
          background: PT.magic, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i data-lucide="sparkles" style={{ width: 13, height: 13, strokeWidth: 2.4 }} />
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: PT.magic, letterSpacing: -0.1 }}>
          Magic Task
        </div>
        <div style={{ flex: 1 }} />
        <div style={{
          fontSize: 10, fontWeight: 600, color: PT.success600, letterSpacing: 0.04,
          textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: PT.success600,
            boxShadow: `0 0 0 3px ${PT.success100}`,
          }} />
          Parsed
        </div>
      </div>

      {/* Textarea body */}
      <div style={{ padding: '14px 14px 12px' }}>
        <div style={{
          fontSize: 14.5, color: PT.fg1, lineHeight: '21px', letterSpacing: -0.1,
          minHeight: 84,
        }}>
          Need someone to assemble an <span style={{ background: PT.magicBg, padding: '0 2px', borderRadius: 3, color: PT.magic, fontWeight: 600 }}>IKEA desk</span> this <span style={{ background: PT.magicBg, padding: '0 2px', borderRadius: 3, color: PT.magic, fontWeight: 600 }}>Saturday morning</span>. It's the big one with drawers — comes in 3 boxes, probably <span style={{ background: PT.magicBg, padding: '0 2px', borderRadius: 3, color: PT.magic, fontWeight: 600 }}>2 hours</span> of work. I can help carry boxes upstairs.
        </div>
      </div>

      {/* Tool row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 10px 10px',
        borderTop: `1px solid ${PT.border}`,
      }}>
        {['mic', 'image', 'paperclip'].map((ic) => (
          <button key={ic} style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'transparent', border: `1px solid ${PT.border}`,
            color: PT.fg2, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>
            <i data-lucide={ic} style={{ width: 15, height: 15 }} />
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: PT.fg4 }}>184 / 500</div>
      </div>
    </div>
  );
}

// ─── Archetype detected pill ───────────────────────────────────

function DetectedArchetype() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: PT.surface, border: `1px solid ${PT.border}`,
      borderRadius: 14, padding: '10px 12px',
      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: PT.catHandymanBg, color: PT.catHandyman,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <i data-lucide="wrench" style={{ width: 18, height: 18, strokeWidth: 2.2 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 10.5, fontWeight: 600, color: PT.fg3, letterSpacing: 0.06,
          textTransform: 'uppercase', marginBottom: 1,
        }}>Detected category</div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: PT.fg1, letterSpacing: -0.15 }}>
          Handyman <span style={{ color: PT.fg4, fontWeight: 500 }}>· Furniture assembly</span>
        </div>
      </div>
      <button style={{
        fontSize: 12, fontWeight: 600, color: PT.primary600,
        background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px',
        letterSpacing: -0.05,
      }}>Change</button>
    </div>
  );
}

// ─── Module prompts (JSONB modules) ────────────────────────────

function ModulePrompt({ icon, label, value, status }) {
  // status: 'filled' | 'needed'
  const filled = status === 'filled';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px',
      borderBottom: `1px solid ${PT.border}`,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        background: filled ? PT.success100 : PT.warning50,
        color: filled ? PT.success600 : PT.warning600,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <i data-lucide={icon} style={{ width: 14, height: 14, strokeWidth: 2.2 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: PT.fg3, letterSpacing: -0.05, marginBottom: 1 }}>{label}</div>
        <div style={{
          fontSize: 13, fontWeight: filled ? 600 : 500,
          color: filled ? PT.fg1 : PT.fg3, letterSpacing: -0.1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{value}</div>
      </div>
      {filled ? (
        <i data-lucide="check" style={{ width: 14, height: 14, color: PT.success600, strokeWidth: 2.6, flexShrink: 0 }} />
      ) : (
        <button style={{
          fontSize: 11, fontWeight: 700, color: PT.warning700,
          background: PT.warning50, border: `1px solid ${PT.warning100}`,
          borderRadius: 9999, padding: '4px 10px', cursor: 'pointer',
          letterSpacing: -0.05, flexShrink: 0,
        }}>Add</button>
      )}
    </div>
  );
}

function ModulePromptsCard() {
  const items = [
    { icon: 'calendar',  label: 'When',    value: 'Sat Oct 18 · Morning (8a–12p)', status: 'filled' },
    { icon: 'map-pin',   label: 'Where',   value: '412 Elm St · Inside, upstairs', status: 'filled' },
    { icon: 'timer',     label: 'Effort',  value: '~2 hours · 1 tasker',           status: 'filled' },
    { icon: 'camera',    label: 'Photos',  value: 'Recommended for better bids',   status: 'needed' },
    { icon: 'wallet',    label: 'Budget',  value: '$80–120 (suggested)',           status: 'filled' },
  ];
  return (
    <div style={{
      background: PT.surface, border: `1px solid ${PT.border}`, borderRadius: 16,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '11px 14px 9px',
      }}>
        <div style={{
          fontSize: 10.5, fontWeight: 600, color: PT.fg3, letterSpacing: 0.08,
          textTransform: 'uppercase',
        }}>Task details</div>
        <div style={{
          fontSize: 10.5, fontWeight: 600, color: PT.success700, letterSpacing: 0.04,
        }}>4 of 5 filled</div>
      </div>
      {items.map((it, i) => (
        <ModulePrompt key={i} {...it} />
      ))}
      {/* remove last border */}
      <style>{`.last-row{border-bottom:none}`}</style>
    </div>
  );
}

// ─── Engagement mode segmented control ─────────────────────────

function EngagementMode({ selected = 'one_time' }) {
  const opts = [
    { id: 'one_time',  label: 'One-time',  icon: 'circle-dot',   sub: 'Done once' },
    { id: 'recurring', label: 'Recurring', icon: 'repeat-2',     sub: 'Weekly +' },
    { id: 'open',      label: 'Open-ended',icon: 'infinity',     sub: 'Until done' },
  ];
  return (
    <div>
      <OverlineLabel style={{ marginBottom: 8 }}>Engagement mode</OverlineLabel>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6,
      }}>
        {opts.map((o) => {
          const active = o.id === selected;
          return (
            <button key={o.id} style={{
              padding: '10px 6px',
              background: active ? PT.primary50 : PT.surface,
              border: `1.5px solid ${active ? PT.primary600 : PT.border}`,
              borderRadius: 12, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
              <i data-lucide={o.icon} style={{
                width: 16, height: 16, color: active ? PT.primary600 : PT.fg2, strokeWidth: 2.2,
              }} />
              <div style={{
                fontSize: 12, fontWeight: 700, color: active ? PT.primary700 : PT.fg1, letterSpacing: -0.1,
              }}>{o.label}</div>
              <div style={{
                fontSize: 10, color: active ? PT.primary600 : PT.fg3, letterSpacing: -0.05,
              }}>{o.sub}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── FRAME 1 · POPULATED (Magic Task parsed) ───────────────────

function FramePostTask() {
  return (
    <Phone label="A12.8 Post a task — Magic describe">
      <WizardHeader title="Post a task" step={1} total={4} />
      <ScrollArea>
        <IdentityChip />

        <div>
          <h2 style={{
            margin: 0, fontSize: 22, fontWeight: 700, color: PT.fg1,
            letterSpacing: -0.3, lineHeight: '28px',
          }}>What do you need done?</h2>
          <p style={{
            margin: '6px 0 0', fontSize: 13.5, color: PT.fg3, lineHeight: '19px',
          }}>
            Describe it in your own words. Pantopus figures out the category, fills in the details, and posts it for bids.
          </p>
        </div>

        <DescribeCard />
        <DetectedArchetype />
        <ModulePromptsCard />
        <EngagementMode selected="one_time" />
      </ScrollArea>

      <StickyBottom>
        <GhostBtn icon="layout-grid">Pick category</GhostBtn>
        <PrimaryBtn icon="arrow-right" flex={1.4}>Review &amp; post</PrimaryBtn>
      </StickyBottom>
    </Phone>
  );
}

// ─── FRAME 2 · SECONDARY (manual archetype picker) ─────────────

function ArchetypeTile({ icon, label, examples, color, bg }) {
  return (
    <button style={{
      background: PT.surface, border: `1px solid ${PT.border}`, borderRadius: 14,
      padding: '12px 12px 11px', cursor: 'pointer', textAlign: 'left',
      display: 'flex', flexDirection: 'column', gap: 8,
      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10,
        background: bg, color: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <i data-lucide={icon} style={{ width: 17, height: 17, strokeWidth: 2.2 }} />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: PT.fg1, letterSpacing: -0.15 }}>{label}</div>
        <div style={{
          fontSize: 10.5, color: PT.fg3, marginTop: 2, lineHeight: '14px',
          letterSpacing: -0.03,
        }}>{examples}</div>
      </div>
    </button>
  );
}

function FramePostTaskPicker() {
  const cats = [
    { icon: 'wrench',       label: 'Handyman',   examples: 'Assembly · repairs · install', color: PT.catHandyman, bg: PT.catHandymanBg },
    { icon: 'sparkles',     label: 'Cleaning',   examples: 'Home · move-out · windows',    color: PT.catCleaning, bg: PT.catCleaningBg },
    { icon: 'truck',        label: 'Moving',     examples: 'Boxes · furniture · loading',  color: PT.catMoving,   bg: PT.catMovingBg },
    { icon: 'paw-print',    label: 'Pet care',   examples: 'Walks · sitting · grooming',   color: PT.catPet,      bg: PT.catPetBg },
    { icon: 'baby',         label: 'Child care', examples: 'Sitting · pickups · tutoring', color: PT.catChild,    bg: PT.catChildBg },
    { icon: 'graduation-cap', label: 'Tutoring', examples: 'Math · music · test prep',     color: PT.catTutoring, bg: PT.catTutoringBg },
    { icon: 'package',      label: 'Delivery',   examples: 'Pickups · drops · errands',    color: PT.catDelivery, bg: PT.catDeliveryBg },
    { icon: 'laptop',       label: 'Tech help',  examples: 'Wifi · setup · troubleshoot',  color: PT.catTech,     bg: PT.catTechBg },
  ];
  return (
    <Phone label="A12.8 Post a task — Category picker">
      <WizardHeader title="Post a task" step={1} total={4} />
      <ScrollArea>
        <IdentityChip />

        <div>
          <h2 style={{
            margin: 0, fontSize: 22, fontWeight: 700, color: PT.fg1,
            letterSpacing: -0.3, lineHeight: '28px',
          }}>Pick a category</h2>
          <p style={{
            margin: '6px 0 0', fontSize: 13.5, color: PT.fg3, lineHeight: '19px',
          }}>
            Skipping the describe step? Pick the archetype directly — we'll ask the questions that matter for it.
          </p>
        </div>

        {/* Back-to-magic banner */}
        <button style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: PT.magicBg, border: `1px solid ${PT.magicBorder}`,
          borderRadius: 12, padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: PT.magic, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <i data-lucide="sparkles" style={{ width: 14, height: 14, strokeWidth: 2.4 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: PT.magic, letterSpacing: -0.1 }}>
              Try Magic Task instead
            </div>
            <div style={{ fontSize: 11, color: PT.fg3, marginTop: 1 }}>
              Describe it in plain English — faster for most posts.
            </div>
          </div>
          <i data-lucide="arrow-right" style={{ width: 15, height: 15, color: PT.magic, flexShrink: 0 }} />
        </button>

        <OverlineLabel style={{ marginBottom: -4, marginTop: 4 }}>Popular near you</OverlineLabel>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
        }}>
          {cats.map((c, i) => <ArchetypeTile key={i} {...c} />)}
        </div>

        <button style={{
          background: PT.surface, border: `1px dashed ${PT.borderStrong}`,
          borderRadius: 12, padding: '12px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          color: PT.fg2, fontSize: 13, fontWeight: 600, letterSpacing: -0.1,
        }}>
          <i data-lucide="more-horizontal" style={{ width: 16, height: 16 }} />
          See all 14 categories
        </button>
      </ScrollArea>

      <StickyBottom>
        <PrimaryBtn disabled icon="arrow-right" full>Pick a category to continue</PrimaryBtn>
      </StickyBottom>
    </Phone>
  );
}

Object.assign(window, { FramePostTask, FramePostTaskPicker });
