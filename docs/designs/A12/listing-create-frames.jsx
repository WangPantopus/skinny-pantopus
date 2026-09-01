// Pantopus — A12.9 · src/app/listing/create.tsx
// Snap-and-sell wizard — Step 1 (start)
// Frame 1: photos captured, AI suggestions populated, editable form ready to post
// Frame 2: camera capture in progress (viewfinder + framing tips)

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
  catGoods:    '#7c3aed',
  catGoodsBg:  '#f5f3ff',
  personal:    '#0284c7',
  personalBg:  '#dbeafe',
  magic:       '#7c3aed',
  magicBg:     '#f5f3ff',
  magicBorder: '#ddd6fe',
};

// ─── Phone shell ───────────────────────────────────────────────

function SB({ darkText }) {
  const c = darkText ? PT.fg1 : '#fff';
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '16px 28px 0', height: 44, boxSizing: 'border-box',
      fontFamily: '-apple-system, system-ui', fontWeight: 600, fontSize: 15, color: c,
      position: 'relative', zIndex: 60,
    }}>
      <span>9:41</span>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={c}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={c}/><rect x="9" y="2" width="3" height="9" rx="0.6" fill={c}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={c}/></svg>
        <svg width="15" height="11" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={c}/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={c}/><circle cx="7.5" cy="9" r="1.3" fill={c}/></svg>
        <svg width="24" height="11" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={c} strokeOpacity="0.35" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill={c}/><path d="M22.5 3.8v3.4c.6-.2 1-.8 1-1.7s-.4-1.5-1-1.7z" fill={c} fillOpacity="0.4"/></svg>
      </div>
    </div>
  );
}

function Phone({ children, label, dark }) {
  return (
    <div style={{
      width: 360, height: 740, borderRadius: 46, padding: 10,
      background: '#0b0f17',
      boxShadow: '0 40px 80px rgba(17,24,39,0.22), 0 0 0 1px rgba(0,0,0,0.14)',
    }} data-screen-label={label}>
      <div style={{
        width: '100%', height: '100%',
        background: dark ? '#0a0b0d' : PT.bg,
        borderRadius: 36, overflow: 'hidden', position: 'relative',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          position: 'absolute', top: 9, left: '50%', transform: 'translateX(-50%)',
          width: 108, height: 30, borderRadius: 20, background: '#000', zIndex: 100,
        }} />
        <SB darkText={!dark} />
        {children}
        <div style={{
          position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)',
          width: 120, height: 4, borderRadius: 4,
          background: dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.25)',
          zIndex: 90,
        }} />
      </div>
    </div>
  );
}

function WizardHeader({ title, step, total, dark }) {
  if (dark) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', padding: '8px 8px',
        height: 48, boxSizing: 'border-box',
        background: 'transparent', flexShrink: 0,
        position: 'relative', zIndex: 60,
      }}>
        <button style={{
          width: 36, height: 36, borderRadius: 18,
          background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)',
          border: 'none', cursor: 'pointer', color: '#fff', padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i data-lucide="x" style={{ width: 20, height: 20 }} />
        </button>
        <div style={{
          flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600,
          color: '#fff', letterSpacing: -0.15,
          textShadow: '0 1px 2px rgba(0,0,0,0.4)',
        }}>{title}</div>
        <div style={{
          minWidth: 52, padding: '0 12px', fontSize: 12, fontWeight: 500,
          color: 'rgba(255,255,255,0.75)', textAlign: 'right',
        }}>{step && total ? `${step} of ${total}` : ''}</div>
      </div>
    );
  }
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

function StickyBottom({ children, dark }) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: dark ? 'rgba(10,11,13,0.0)' : 'rgba(255,255,255,0.96)',
      backdropFilter: dark ? 'none' : 'blur(12px)',
      WebkitBackdropFilter: dark ? 'none' : 'blur(12px)',
      borderTop: dark ? 'none' : `1px solid ${PT.border}`,
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
      textTransform: 'uppercase', color: PT.fg3, marginBottom: 8, ...style,
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

// ─── Photo strip (Frame 1) ─────────────────────────────────────

function PhotoStrip() {
  // Hero photo + 2 thumbs + add-more tile
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <OverlineLabel style={{ marginBottom: 0 }}>Photos · 3 of 8</OverlineLabel>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 10.5, fontWeight: 600, color: PT.success700,
          background: PT.success100, padding: '3px 8px', borderRadius: 9999,
          letterSpacing: -0.05,
        }}>
          <i data-lucide="sparkles" style={{ width: 11, height: 11 }} />
          Good lighting
        </div>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 6,
        height: 168,
      }}>
        <div style={{
          gridRow: 'span 2', borderRadius: 14, overflow: 'hidden', position: 'relative',
          backgroundImage: 'url("assets/marketplace-hero-sofa.webp")',
          backgroundSize: 'cover', backgroundPosition: 'center',
          border: `1px solid ${PT.border}`,
        }}>
          <div style={{
            position: 'absolute', top: 8, left: 8,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
            color: '#fff', fontSize: 10, fontWeight: 700,
            padding: '3px 8px', borderRadius: 9999, letterSpacing: 0.04,
            textTransform: 'uppercase',
          }}>Cover</div>
        </div>
        <div style={{
          borderRadius: 12, overflow: 'hidden', position: 'relative',
          backgroundImage: 'url("assets/marketplace-hero-sofa.webp")',
          backgroundSize: '230%', backgroundPosition: '30% 70%',
          border: `1px solid ${PT.border}`,
        }} />
        <div style={{
          borderRadius: 12, overflow: 'hidden', position: 'relative',
          backgroundImage: 'url("assets/marketplace-hero-sofa.webp")',
          backgroundSize: '200%', backgroundPosition: '70% 40%',
          border: `1px solid ${PT.border}`,
        }} />
        <div style={{
          borderRadius: 12, overflow: 'hidden', position: 'relative',
          backgroundImage: 'url("assets/marketplace-hero-sofa.webp")',
          backgroundSize: '180%', backgroundPosition: '50% 100%',
          border: `1px solid ${PT.border}`,
        }} />
        <button style={{
          borderRadius: 12, border: `1px dashed ${PT.borderStrong}`,
          background: PT.raised, color: PT.fg3, cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 2,
        }}>
          <i data-lucide="plus" style={{ width: 20, height: 20 }} />
          <div style={{ fontSize: 10, fontWeight: 600, marginTop: 2 }}>Add photo</div>
        </button>
      </div>
    </div>
  );
}

// ─── AI suggestions banner ─────────────────────────────────────

function SuggestionsBanner() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: PT.magicBg, border: `1px solid ${PT.magicBorder}`,
      borderRadius: 12, padding: '10px 12px',
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
          Snap-and-sell suggested everything below
        </div>
        <div style={{ fontSize: 11, color: PT.fg3, marginTop: 1 }}>
          Tap any field to edit. Based on 47 similar comps within 3 mi.
        </div>
      </div>
    </div>
  );
}

// ─── Form field building blocks ────────────────────────────────

function FieldShell({ label, hint, suggested, children, multiline }) {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: 6,
      }}>
        <div style={{
          fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: PT.fg3,
        }}>{label}</div>
        {suggested && (
          <div style={{
            fontSize: 10, fontWeight: 600, color: PT.magic, letterSpacing: 0.04,
            display: 'inline-flex', alignItems: 'center', gap: 3,
          }}>
            <i data-lucide="sparkles" style={{ width: 10, height: 10 }} />
            AI suggested
          </div>
        )}
      </div>
      <div style={{
        background: PT.surface, border: `1px solid ${PT.border}`, borderRadius: 12,
        padding: multiline ? '10px 12px' : '0 12px',
        minHeight: multiline ? undefined : 44,
        display: 'flex', alignItems: multiline ? 'flex-start' : 'center',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      }}>
        {children}
      </div>
      {hint && (
        <div style={{ fontSize: 11, color: PT.fg3, marginTop: 4, letterSpacing: -0.05 }}>{hint}</div>
      )}
    </div>
  );
}

function TitleField() {
  return (
    <FieldShell label="Title" suggested hint="Snap-and-sell pulled this from the photos">
      <div style={{
        flex: 1, fontSize: 14, fontWeight: 600, color: PT.fg1, letterSpacing: -0.15,
        padding: '12px 0',
      }}>Sage green velvet sofa, 3-seater</div>
      <i data-lucide="pencil" style={{ width: 14, height: 14, color: PT.fg4 }} />
    </FieldShell>
  );
}

function CategoryField() {
  return (
    <FieldShell label="Category" suggested>
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0',
      }}>
        <div style={{
          width: 24, height: 24, borderRadius: 7,
          background: PT.catGoodsBg, color: PT.catGoods,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i data-lucide="sofa" style={{ width: 13, height: 13 }} />
        </div>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: PT.fg1, letterSpacing: -0.1 }}>
          Furniture · Sofas
        </span>
      </div>
      <i data-lucide="chevron-down" style={{ width: 14, height: 14, color: PT.fg4 }} />
    </FieldShell>
  );
}

function PriceField() {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: 6,
      }}>
        <div style={{
          fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: PT.fg3,
        }}>Price</div>
        <div style={{
          fontSize: 10, fontWeight: 600, color: PT.magic, letterSpacing: 0.04,
          display: 'inline-flex', alignItems: 'center', gap: 3,
        }}>
          <i data-lucide="sparkles" style={{ width: 10, height: 10 }} />
          AI suggested
        </div>
      </div>
      <div style={{
        background: PT.surface, border: `1px solid ${PT.border}`, borderRadius: 12,
        padding: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 4,
        }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: PT.fg1, letterSpacing: -0.4 }}>$</span>
          <span style={{ fontSize: 28, fontWeight: 700, color: PT.fg1, letterSpacing: -0.5 }}>280</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: PT.fg3 }}>USD · firm</span>
        </div>

        {/* Comp range track */}
        <div style={{ marginTop: 10 }}>
          <div style={{
            position: 'relative', height: 6, background: PT.sunken, borderRadius: 3,
            overflow: 'visible',
          }}>
            <div style={{
              position: 'absolute', left: '22%', right: '32%', top: 0, bottom: 0,
              background: PT.success100, borderRadius: 3,
            }} />
            <div style={{
              position: 'absolute', left: '52%', top: -3, width: 12, height: 12,
              borderRadius: '50%', background: PT.primary600,
              border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
              transform: 'translateX(-50%)',
            }} />
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', marginTop: 6,
            fontSize: 10.5, color: PT.fg3, letterSpacing: -0.05,
          }}>
            <span>$180 low</span>
            <span style={{ color: PT.success700, fontWeight: 600 }}>$240–$320 typical</span>
            <span>$420 high</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConditionField() {
  const conds = [
    { id: 'new',  label: 'New' },
    { id: 'like', label: 'Like new' },
    { id: 'good', label: 'Good', active: true },
    { id: 'fair', label: 'Fair' },
    { id: 'parts',label: 'Parts' },
  ];
  return (
    <div>
      <OverlineLabel>Condition</OverlineLabel>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4,
      }}>
        {conds.map((c) => (
          <button key={c.id} style={{
            padding: '9px 4px',
            background: c.active ? PT.primary50 : PT.surface,
            border: `1.5px solid ${c.active ? PT.primary600 : PT.border}`,
            borderRadius: 10, cursor: 'pointer',
            fontSize: 11.5, fontWeight: 700,
            color: c.active ? PT.primary700 : PT.fg2,
            letterSpacing: -0.1,
          }}>{c.label}</button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: PT.fg3, marginTop: 6, letterSpacing: -0.05 }}>
        Light wear on one cushion · minor sun fade. Add notes in description.
      </div>
    </div>
  );
}

function LocationField() {
  return (
    <div>
      <OverlineLabel>Pickup &amp; delivery</OverlineLabel>
      <div style={{
        background: PT.surface, border: `1px solid ${PT.border}`, borderRadius: 12,
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)', overflow: 'hidden',
      }}>
        {/* Location row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 12px', borderBottom: `1px solid ${PT.border}`,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: PT.primary50, color: PT.primary600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <i data-lucide="map-pin" style={{ width: 14, height: 14, strokeWidth: 2.2 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: PT.fg1, letterSpacing: -0.1 }}>
              412 Elm St · West Loop
            </div>
            <div style={{ fontSize: 11, color: PT.fg3 }}>Shown as approximate location to buyers</div>
          </div>
          <i data-lucide="chevron-right" style={{ width: 14, height: 14, color: PT.fg4 }} />
        </div>
        {/* Method toggles */}
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { icon: 'hand-coins', label: 'Local pickup', sub: 'Buyers come to you', on: true },
            { icon: 'truck',      label: 'Local delivery', sub: 'Up to 3 mi · $40 fee', on: true },
            { icon: 'package',    label: 'Ship nationwide', sub: 'Too large to ship', on: false, disabled: true },
          ].map((m) => (
            <div key={m.label} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              opacity: m.disabled ? 0.55 : 1,
            }}>
              <i data-lucide={m.icon} style={{ width: 15, height: 15, color: PT.fg3, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: PT.fg1, letterSpacing: -0.1 }}>{m.label}</div>
                <div style={{ fontSize: 10.5, color: PT.fg3 }}>{m.sub}</div>
              </div>
              <div style={{
                width: 32, height: 18, borderRadius: 9,
                background: m.on ? PT.primary600 : PT.borderStrong,
                position: 'relative', flexShrink: 0,
              }}>
                <div style={{
                  position: 'absolute', top: 2, left: m.on ? 16 : 2,
                  width: 14, height: 14, borderRadius: '50%', background: '#fff',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                  transition: 'left 120ms',
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── FRAME 1 · POPULATED (review state) ────────────────────────

function FrameListingCreate() {
  return (
    <Phone label="A12.9 List an item — Snap-and-sell review">
      <WizardHeader title="List an item" step={1} total={3} />
      <ScrollArea>
        <IdentityChip />

        <div>
          <h2 style={{
            margin: 0, fontSize: 22, fontWeight: 700, color: PT.fg1,
            letterSpacing: -0.3, lineHeight: '28px',
          }}>Review your listing</h2>
          <p style={{
            margin: '6px 0 0', fontSize: 13.5, color: PT.fg3, lineHeight: '19px',
          }}>
            We pulled title, category, and price from your photos. Edit anything that looks off — tap once to fix it.
          </p>
        </div>

        <PhotoStrip />
        <SuggestionsBanner />
        <TitleField />
        <CategoryField />
        <PriceField />
        <ConditionField />
        <LocationField />
      </ScrollArea>

      <StickyBottom>
        <GhostBtn icon="eye">Preview</GhostBtn>
        <PrimaryBtn icon="arrow-right" flex={1.4}>Post listing</PrimaryBtn>
      </StickyBottom>
    </Phone>
  );
}

// ─── FRAME 2 · SECONDARY (camera capture in progress) ──────────

function CameraViewfinder() {
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      background: '#0a0b0d',
    }}>
      {/* Faux camera "scene" — soft radial gradient suggesting a lit subject */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 80% 60% at 50% 60%, rgba(180,200,210,0.18), rgba(10,11,13,0) 70%), radial-gradient(circle at 30% 40%, rgba(255,255,255,0.05), rgba(0,0,0,0) 50%)',
      }} />
      {/* Subject silhouette — a sofa shape */}
      <svg width="100%" height="100%" viewBox="0 0 360 740" preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, opacity: 0.35 }}>
        <ellipse cx="180" cy="460" rx="150" ry="14" fill="rgba(0,0,0,0.4)" />
        <rect x="50" y="350" width="260" height="100" rx="30" fill="rgba(110,130,120,0.55)" />
        <rect x="50" y="330" width="260" height="50" rx="20" fill="rgba(120,140,130,0.6)" />
        <rect x="50" y="330" width="40" height="120" rx="14" fill="rgba(110,130,120,0.7)" />
        <rect x="270" y="330" width="40" height="120" rx="14" fill="rgba(110,130,120,0.7)" />
      </svg>

      {/* Framing brackets */}
      {[
        { top: 130, left: 28, rot: 0 },
        { top: 130, right: 28, rot: 90 },
        { bottom: 230, left: 28, rot: -90 },
        { bottom: 230, right: 28, rot: 180 },
      ].map((p, i) => (
        <div key={i} style={{
          position: 'absolute', width: 26, height: 26,
          top: p.top, bottom: p.bottom, left: p.left, right: p.right,
          transform: `rotate(${p.rot}deg)`,
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: 18, height: 2.5, background: '#fff', borderRadius: 2 }} />
          <div style={{ position: 'absolute', top: 0, left: 0, width: 2.5, height: 18, background: '#fff', borderRadius: 2 }} />
        </div>
      ))}

      {/* Grid lines */}
      <div style={{
        position: 'absolute', top: 130, left: 28, right: 28, bottom: 230,
        pointerEvents: 'none',
      }}>
        <div style={{ position: 'absolute', top: '33%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.18)' }} />
        <div style={{ position: 'absolute', top: '66%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.18)' }} />
        <div style={{ position: 'absolute', left: '33%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.18)' }} />
        <div style={{ position: 'absolute', left: '66%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.18)' }} />
      </div>
    </div>
  );
}

function FrameListingCapture() {
  return (
    <Phone label="A12.9 List an item — Photo capture" dark>
      <CameraViewfinder />
      <WizardHeader title="List an item" step={1} total={3} dark />

      {/* AI tip pill */}
      <div style={{
        position: 'absolute', top: 96, left: 16, right: 16, zIndex: 30,
        display: 'flex', justifyContent: 'center',
      }}>
        <div style={{
          background: 'rgba(124,58,237,0.92)', backdropFilter: 'blur(10px)',
          color: '#fff', padding: '8px 12px', borderRadius: 9999,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 11.5, fontWeight: 600, letterSpacing: -0.05,
          boxShadow: '0 8px 20px rgba(0,0,0,0.35)',
        }}>
          <i data-lucide="sparkles" style={{ width: 12, height: 12 }} />
          Center the whole sofa · step back a bit
        </div>
      </div>

      {/* Captured-so-far strip */}
      <div style={{
        position: 'absolute', top: 150, left: 16, right: 16, zIndex: 30,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)',
          letterSpacing: 0.08, textTransform: 'uppercase', marginBottom: 6,
        }}>1 of 4 angles · add 3 more</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{
            flex: 1, height: 56, borderRadius: 10, overflow: 'hidden',
            backgroundImage: 'url("assets/marketplace-hero-sofa.webp")',
            backgroundSize: 'cover', backgroundPosition: 'center',
            border: '1.5px solid #fff', position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: 3, left: 3, width: 14, height: 14, borderRadius: '50%',
              background: PT.success600, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <i data-lucide="check" style={{ width: 9, height: 9, strokeWidth: 3.5 }} />
            </div>
          </div>
          {['Wide', 'Detail', 'Tag'].map((label, i) => (
            <div key={i} style={{
              flex: 1, height: 56, borderRadius: 10,
              border: '1.5px dashed rgba(255,255,255,0.55)',
              background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(2px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(255,255,255,0.85)',
              fontSize: 10, fontWeight: 600, letterSpacing: 0.04,
              textTransform: 'uppercase',
            }}>{label}</div>
          ))}
        </div>
      </div>

      {/* Bottom control rail (camera controls) */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '0 0 24px', zIndex: 40,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
      }}>
        {/* Tips chip */}
        <div style={{
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)',
          color: '#fff', padding: '7px 12px', borderRadius: 9999,
          fontSize: 11, fontWeight: 500, letterSpacing: -0.05,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <i data-lucide="lightbulb" style={{ width: 12, height: 12 }} />
          Daylight · clutter-free background = better price
        </div>

        {/* Capture controls */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center',
          width: '100%', padding: '0 32px',
        }}>
          {/* Library */}
          <button style={{
            justifySelf: 'start',
            width: 48, height: 48, borderRadius: 12,
            background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.18)', color: '#fff',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', gap: 1, padding: 0,
          }}>
            <i data-lucide="image" style={{ width: 18, height: 18 }} />
            <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: 0.04, textTransform: 'uppercase' }}>Library</div>
          </button>

          {/* Shutter */}
          <button style={{
            justifySelf: 'center',
            width: 72, height: 72, borderRadius: '50%',
            background: 'transparent', border: '4px solid rgba(255,255,255,0.95)',
            padding: 4, cursor: 'pointer',
          }}>
            <div style={{
              width: '100%', height: '100%', borderRadius: '50%',
              background: '#fff', boxShadow: '0 0 24px rgba(255,255,255,0.35)',
            }} />
          </button>

          {/* Flash */}
          <button style={{
            justifySelf: 'end',
            width: 48, height: 48, borderRadius: 12,
            background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.18)', color: '#fff',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', gap: 1, padding: 0,
          }}>
            <i data-lucide="zap" style={{ width: 18, height: 18 }} />
            <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: 0.04, textTransform: 'uppercase' }}>Auto</div>
          </button>
        </div>

        {/* Skip → form */}
        <button style={{
          background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.75)',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 4, letterSpacing: -0.05,
        }}>
          Skip photos · enter manually
          <i data-lucide="arrow-right" style={{ width: 13, height: 13 }} />
        </button>
      </div>
    </Phone>
  );
}

Object.assign(window, { FrameListingCreate, FrameListingCapture });
