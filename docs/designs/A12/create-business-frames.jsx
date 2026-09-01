// Pantopus — A12.10 · src/app/businesses/new.tsx
// Wizard step 1 (start) — "Create business" — pick a category.
// Two frames: populated grid (Home Services selected) + active search (typeahead match).

const B = {
  primary50:  '#f0f9ff',
  primary100: '#e0f2fe',
  primary200: '#bae6fd',
  primary500: '#0ea5e9',
  primary600: '#0284c7',
  primary700: '#0369a1',
  bg:      '#f6f7f9',
  surface: '#ffffff',
  sunken:  '#f3f4f6',
  border:  '#e5e7eb',
  borderStrong: '#d1d5db',
  fg1: '#111827',
  fg2: '#374151',
  fg3: '#6b7280',
  fg4: '#9ca3af',
  success50:  '#ecfdf5',
  success100: '#d1fae5',
  success600: '#059669',
  warning50:  '#fffbeb',
  warning100: '#fef3c7',
  warning600: '#d97706',
  business:   '#7c3aed',
  businessBg: '#f3e8ff',
  businessSoft:'#ede9fe',
  business700:'#6d28d9',
  // Category accent palette (matches design system)
  handyman:   '#f97316',
  cleaning:   '#27ae60',
  moving:     '#8e44ad',
  petCare:    '#e74c3c',
  childCare:  '#f39c12',
  tutoring:   '#2980b9',
  delivery:   '#374151',
  tech:       '#3498db',
  goods:      '#7c3aed',
  rentals:    '#16a34a',
  vehicles:   '#dc2626',
};

// ─── Phone shell (compact reuse) ──────────────────────────────

function BSB() {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '16px 28px 0', height: 44, boxSizing: 'border-box',
      fontFamily: '-apple-system, system-ui', fontWeight: 600, fontSize: 15, color: B.fg1,
    }}>
      <span>9:41</span>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={B.fg1}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={B.fg1}/><rect x="9" y="2" width="3" height="9" rx="0.6" fill={B.fg1}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={B.fg1}/></svg>
        <svg width="15" height="11" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={B.fg1}/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={B.fg1}/><circle cx="7.5" cy="9" r="1.3" fill={B.fg1}/></svg>
        <svg width="24" height="11" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={B.fg1} strokeOpacity="0.35" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill={B.fg1}/><path d="M22.5 3.8v3.4c.6-.2 1-.8 1-1.7s-.4-1.5-1-1.7z" fill={B.fg1} fillOpacity="0.4"/></svg>
      </div>
    </div>
  );
}

function BPhone({ children, label }) {
  return (
    <div style={{
      width: 360, height: 740, borderRadius: 46, padding: 10,
      background: '#0b0f17',
      boxShadow: '0 40px 80px rgba(17,24,39,0.22), 0 0 0 1px rgba(0,0,0,0.14)',
    }} data-screen-label={label}>
      <div style={{
        width: '100%', height: '100%', background: B.bg,
        borderRadius: 36, overflow: 'hidden', position: 'relative',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          position: 'absolute', top: 9, left: '50%', transform: 'translateX(-50%)',
          width: 108, height: 30, borderRadius: 20, background: '#000', zIndex: 50,
        }} />
        <BSB />
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

function BWizardHeader({ title, step, total }) {
  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', padding: '8px 8px',
        height: 48, boxSizing: 'border-box', background: B.surface, flexShrink: 0,
      }}>
        <button style={{
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer', color: B.fg1, padding: 0,
          borderRadius: 8,
        }}>
          <i data-lucide="x" style={{ width: 22, height: 22 }} />
        </button>
        <div style={{
          flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600,
          color: B.fg1, letterSpacing: -0.15,
        }}>{title}</div>
        <div style={{
          minWidth: 52, padding: '0 12px', fontSize: 12, fontWeight: 500,
          color: B.fg3, textAlign: 'right', letterSpacing: -0.05,
        }}>{step} of {total}</div>
      </div>
      <div style={{
        display: 'flex', gap: 4, padding: '0 16px 8px',
        background: B.surface, borderBottom: `1px solid ${B.border}`,
      }}>
        {Array.from({ length: total }, (_, i) => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 3,
            background: i < step ? B.business : B.border,
          }} />
        ))}
      </div>
    </>
  );
}

function BScrollArea({ children, bottomPad = 112 }) {
  return (
    <div style={{
      flex: 1, overflow: 'auto',
      padding: `18px 16px ${bottomPad}px`,
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>{children}</div>
  );
}

function BStickyBottom({ children }) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'rgba(255,255,255,0.96)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      borderTop: `1px solid ${B.border}`,
      padding: '12px 16px 28px', zIndex: 10,
      display: 'flex', gap: 10, alignItems: 'center',
    }}>{children}</div>
  );
}

function BPrimaryBtn({ children, icon, disabled, full }) {
  return (
    <button disabled={disabled} style={{
      width: full ? '100%' : undefined,
      height: 48, borderRadius: 12, border: 'none',
      background: disabled ? B.sunken : B.business,
      color: disabled ? B.fg4 : '#fff',
      fontSize: 14, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
      boxShadow: disabled ? 'none' : '0 6px 16px rgba(124,58,237,0.28)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      letterSpacing: -0.1, padding: '0 20px',
    }}>
      {children}
      {icon && <i data-lucide={icon} style={{ width: 16, height: 16 }} />}
    </button>
  );
}

// ─── Business identity chip (purple) ──────────────────────────

function BIdentityChip() {
  return (
    <div style={{
      display: 'inline-flex', padding: '4px 10px', borderRadius: 9999,
      background: B.businessBg, color: B.business, fontSize: 10.5, fontWeight: 700,
      letterSpacing: 0.06, textTransform: 'uppercase', alignSelf: 'flex-start',
      alignItems: 'center', gap: 4,
    }}>
      <i data-lucide="building-2" style={{ width: 11, height: 11 }} />
      Business · new
    </div>
  );
}

// ─── Category cards ───────────────────────────────────────────

const CATEGORIES = [
  { id: 'home',     label: 'Home services',      sub: 'Handyman · cleaning · moving',         icon: 'wrench',         color: 'handyman'  },
  { id: 'personal', label: 'Personal services',  sub: 'Tutoring · childcare · pet care',      icon: 'graduation-cap', color: 'tutoring'  },
  { id: 'tech',     label: 'Tech & repair',      sub: 'Devices · networks · break-fix',       icon: 'cpu',            color: 'tech'      },
  { id: 'delivery', label: 'Delivery & errands', sub: 'Last-mile · courier · grocery',        icon: 'truck',          color: 'delivery'  },
  { id: 'goods',    label: 'Goods & retail',     sub: 'Selling new or pre-loved items',       icon: 'shopping-bag',   color: 'goods'     },
  { id: 'rentals',  label: 'Rentals',            sub: 'Short or long-term · gear · vehicles', icon: 'key-round',      color: 'rentals'   },
  { id: 'vehicles', label: 'Vehicles & rideshare', sub: 'Driving · towing · fleet',           icon: 'car',            color: 'vehicles'  },
  { id: 'other',    label: 'Something else',     sub: 'Tell us what you do',                  icon: 'sparkles',       color: 'business'  },
];

function CategoryCard({ cat, selected, dim, onPress, compact }) {
  const accent = B[cat.color] || B.business;
  return (
    <button onClick={onPress} style={{
      flex: 1, minWidth: 0,
      background: selected ? '#fff' : B.surface,
      border: `1.5px solid ${selected ? accent : B.border}`,
      borderRadius: 14, padding: compact ? '10px 12px' : '12px 12px',
      cursor: 'pointer', textAlign: 'left',
      display: 'flex', flexDirection: compact ? 'row' : 'column', gap: compact ? 10 : 8,
      alignItems: compact ? 'center' : 'flex-start',
      boxShadow: selected ? `0 6px 16px ${accent}22` : '0 1px 2px rgba(0,0,0,0.03)',
      opacity: dim ? 0.45 : 1,
      transition: 'border-color 120ms, box-shadow 120ms, opacity 120ms',
      position: 'relative',
    }}>
      <div style={{
        width: compact ? 32 : 34, height: compact ? 32 : 34, borderRadius: compact ? 9 : 10,
        background: selected ? accent : `${accent}1a`,
        color: selected ? '#fff' : accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        transition: 'background 120ms',
      }}>
        <i data-lucide={cat.icon} style={{ width: compact ? 15 : 16, height: compact ? 15 : 16, strokeWidth: 2 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: B.fg1, letterSpacing: -0.1,
          lineHeight: '17px',
        }}>{cat.label}</div>
        <div style={{ fontSize: 11, color: B.fg3, marginTop: 2, lineHeight: '14px' }}>{cat.sub}</div>
      </div>
      {selected && !compact && (
        <div style={{
          position: 'absolute', top: 10, right: 10,
          width: 18, height: 18, borderRadius: '50%', background: accent,
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i data-lucide="check" style={{ width: 11, height: 11, strokeWidth: 3.5 }} />
        </div>
      )}
    </button>
  );
}

function CategoryGrid({ selectedId }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
    }}>
      {CATEGORIES.map(cat => (
        <CategoryCard key={cat.id} cat={cat} selected={selectedId === cat.id} />
      ))}
    </div>
  );
}

// ─── "What you get" preview strip (shown when a category is selected) ──

function WhatYouGet({ cat }) {
  if (!cat) return null;
  const items = {
    home: [
      { icon: 'list-checks', label: 'Service listings',  sub: 'Set rates per hour or per job' },
      { icon: 'file-text',   label: '1099/W-9 ready',    sub: 'We collect tax info in step 2' },
      { icon: 'shield',      label: 'Insurance hint',    sub: 'Optional but boosts trust score' },
    ],
  }[cat.id] || [];
  return (
    <div style={{
      background: B.businessSoft, border: `1px solid ${B.businessBg}`,
      borderRadius: 14, padding: '12px 14px',
    }}>
      <div style={{
        fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: B.business700, marginBottom: 10,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <i data-lucide="sparkles" style={{ width: 11, height: 11 }} />
        What you'll get with {cat.label.toLowerCase()}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
            <div style={{
              width: 20, height: 20, borderRadius: 6, background: '#fff',
              color: B.business, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginTop: 1,
            }}>
              <i data-lucide={it.icon} style={{ width: 11, height: 11, strokeWidth: 2.4 }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: B.fg1, letterSpacing: -0.05 }}>{it.label}</div>
              <div style={{ fontSize: 11, color: B.fg3, marginTop: 1, lineHeight: '15px' }}>{it.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Search input (active) ────────────────────────────────────

function SearchField({ value, focused }) {
  const empty = !value;
  const borderColor = focused ? B.business : B.border;
  const ring = focused ? `0 0 0 3px ${B.businessBg}` : 'none';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      height: 44, padding: '0 12px',
      background: B.surface, border: `1px solid ${borderColor}`,
      borderRadius: 12, boxShadow: ring,
      transition: 'border-color 120ms, box-shadow 120ms',
    }}>
      <i data-lucide="search" style={{ width: 16, height: 16, color: B.fg3, flexShrink: 0 }} />
      <div style={{
        flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.2,
        color: empty ? B.fg4 : B.fg1,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        display: 'flex', alignItems: 'center', gap: 2,
      }}>
        <span>{value || 'Search categories — e.g. "tutor", "lawn care"'}</span>
        {focused && !empty && (
          <span style={{
            width: 1.5, height: 16, background: B.business, borderRadius: 1,
            display: 'inline-block', marginLeft: 1,
            animation: 'caret 1s steps(2) infinite',
          }} />
        )}
      </div>
      {!empty && (
        <button style={{
          width: 22, height: 22, borderRadius: '50%', border: 'none',
          background: B.sunken, color: B.fg3, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <i data-lucide="x" style={{ width: 12, height: 12 }} />
        </button>
      )}
    </div>
  );
}

// Highlight matching substring inside a label
function Highlighted({ text, q }) {
  if (!q) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ background: B.businessBg, color: B.business700, borderRadius: 3, padding: '0 1px' }}>
        {text.slice(idx, idx + q.length)}
      </span>
      {text.slice(idx + q.length)}
    </>
  );
}

// Search result row
function SearchResult({ cat, sub, selected, q }) {
  const accent = B[cat.color] || B.business;
  return (
    <button style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 12px', width: '100%', background: selected ? '#fff' : B.surface,
      border: `1px solid ${selected ? accent : B.border}`, borderRadius: 12,
      cursor: 'pointer', textAlign: 'left',
      boxShadow: selected ? `0 6px 16px ${accent}22` : '0 1px 2px rgba(0,0,0,0.03)',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: selected ? accent : `${accent}1a`,
        color: selected ? '#fff' : accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <i data-lucide={cat.icon} style={{ width: 16, height: 16 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: B.fg1, letterSpacing: -0.1 }}>
          <Highlighted text={sub || cat.label} q={q} />
        </div>
        <div style={{ fontSize: 11, color: B.fg3, marginTop: 2 }}>
          in <b style={{ color: B.fg2, fontWeight: 600 }}>{cat.label}</b>
        </div>
      </div>
      {selected && (
        <div style={{
          width: 20, height: 20, borderRadius: '50%', background: accent,
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <i data-lucide="check" style={{ width: 12, height: 12, strokeWidth: 3 }} />
        </div>
      )}
    </button>
  );
}

// ─── FRAME 1 · POPULATED (Home Services selected) ─────────────

function FrameCreateBusinessPopulated() {
  const homeCat = CATEGORIES[0];
  return (
    <BPhone label="A12.10 Create business — category (populated)">
      <BWizardHeader title="Create business" step={1} total={4} />
      <BScrollArea>
        <BIdentityChip />

        <div>
          <h2 style={{
            margin: 0, fontSize: 22, fontWeight: 700, color: B.fg1,
            letterSpacing: -0.3, lineHeight: '28px',
          }}>What does your business do?</h2>
          <p style={{
            margin: '6px 0 0', fontSize: 13.5, color: B.fg3, lineHeight: '19px',
          }}>
            Pick the closest fit — this shapes your listings, tax setup, and the badges
            customers see. You can refine the specifics on step 3.
          </p>
        </div>

        <CategoryGrid selectedId="home" />

        <WhatYouGet cat={homeCat} />

        {/* Step preview */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', background: B.surface,
          border: `1px solid ${B.border}`, borderRadius: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: B.fg3 }}>
            <i data-lucide="map" style={{ width: 13, height: 13 }} />
            <span style={{ fontSize: 11.5 }}>
              Next: <b style={{ color: B.fg2, fontWeight: 600 }}>legal info</b> · <b style={{ color: B.fg2, fontWeight: 600 }}>profile</b> · <b style={{ color: B.fg2, fontWeight: 600 }}>confirm</b>
            </span>
          </div>
          <span style={{
            fontSize: 10, fontWeight: 600, color: B.fg4,
            fontFamily: 'ui-monospace, monospace',
          }}>~6 min</span>
        </div>
      </BScrollArea>

      <BStickyBottom>
        <BPrimaryBtn icon="arrow-right" full>Continue</BPrimaryBtn>
      </BStickyBottom>
    </BPhone>
  );
}

// ─── FRAME 2 · SECONDARY (search-as-you-type) ─────────────────

function FrameCreateBusinessSearching() {
  const q = 'tutor';
  // Matches against "tutoring" sub-area in Personal Services
  const personal = CATEGORIES.find(c => c.id === 'personal');
  const tech = CATEGORIES.find(c => c.id === 'tech');
  const other = CATEGORIES.find(c => c.id === 'other');
  return (
    <BPhone label="A12.10 Create business — category (search)">
      <BWizardHeader title="Create business" step={1} total={4} />
      <BScrollArea>
        <BIdentityChip />

        <div>
          <h2 style={{
            margin: 0, fontSize: 22, fontWeight: 700, color: B.fg1,
            letterSpacing: -0.3, lineHeight: '28px',
          }}>What does your business do?</h2>
          <p style={{
            margin: '6px 0 0', fontSize: 13.5, color: B.fg3, lineHeight: '19px',
          }}>
            Pick the closest fit — this shapes your listings, tax setup, and the badges
            customers see.
          </p>
        </div>

        <SearchField value={q} focused />

        {/* Results header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: -4,
        }}>
          <div style={{
            fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: B.fg3,
          }}>3 matches for "{q}"</div>
          <button style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontSize: 11.5, color: B.business, fontWeight: 600,
          }}>Browse all</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SearchResult cat={personal} sub="Tutoring · K-12, test prep, music" q={q} selected />
          <SearchResult cat={personal} sub="Tutoring centers"            q={q} />
          <SearchResult cat={tech}     sub="Tutoring — tech & coding"    q={q} />
        </div>

        {/* Custom fallback */}
        <button style={{
          background: B.businessSoft, border: `1px dashed ${B.business}55`, borderRadius: 12,
          padding: '12px 14px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, background: '#fff',
            color: B.business, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i data-lucide="plus" style={{ width: 14, height: 14, strokeWidth: 2.5 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: B.business700, letterSpacing: -0.1 }}>
              Add "{q}" as a custom category
            </div>
            <div style={{ fontSize: 11, color: B.fg3, marginTop: 1, lineHeight: '14px' }}>
              We'll review it within a day · listings stay private until approved.
            </div>
          </div>
          <i data-lucide="arrow-right" style={{ width: 14, height: 14, color: B.business, flexShrink: 0 }} />
        </button>
      </BScrollArea>

      <BStickyBottom>
        <BPrimaryBtn icon="arrow-right" full>Continue</BPrimaryBtn>
      </BStickyBottom>
    </BPhone>
  );
}

Object.assign(window, { FrameCreateBusinessPopulated, FrameCreateBusinessSearching });
