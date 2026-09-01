// Pantopus — A12.1 · src/app/homes/find.tsx
// Wizard step 1 (start) — "Find your home"
// Two frames: populated (nearby results, one selected) + searching (autocomplete).
// Shell (header, progress, sticky CTA) matches A12 archetype exactly.

const W = {
  primary50:  '#f0f9ff',
  primary100: '#e0f2fe',
  primary200: '#bae6fd',
  primary500: '#0ea5e9',
  primary600: '#0284c7',
  primary700: '#0369a1',
  bg:      '#f6f7f9',
  surface: '#ffffff',
  sunken:  '#f3f4f6',
  muted:   '#f8fafc',
  border:  '#e5e7eb',
  borderStrong: '#d1d5db',
  fg1: '#111827',
  fg2: '#374151',
  fg3: '#6b7280',
  fg4: '#9ca3af',
  successBg: '#d1fae5',
  success600:'#059669',
  warning600:'#d97706',
  warningBg: '#fef3c7',
  warning:   '#92400e',
  homeBg:    '#dcfce7',
  home:      '#16a34a',
  home700:   '#15803d',
};

// ─── Phone + status bar ───────────────────────────────────────

function SB() {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '16px 28px 0', height: 44, boxSizing: 'border-box',
      fontFamily: '-apple-system, system-ui', fontWeight: 600, fontSize: 15, color: W.fg1,
    }}>
      <span>9:41</span>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={W.fg1}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={W.fg1}/><rect x="9" y="2" width="3" height="9" rx="0.6" fill={W.fg1}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={W.fg1}/></svg>
        <svg width="15" height="11" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={W.fg1}/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={W.fg1}/><circle cx="7.5" cy="9" r="1.3" fill={W.fg1}/></svg>
        <svg width="24" height="11" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={W.fg1} strokeOpacity="0.35" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill={W.fg1}/><path d="M22.5 3.8v3.4c.6-.2 1-.8 1-1.7s-.4-1.5-1-1.7z" fill={W.fg1} fillOpacity="0.4"/></svg>
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
        width: '100%', height: '100%', background: W.bg,
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

// ─── Wizard header (archetype) ────────────────────────────────

function WizardHeader({ title, step, total }) {
  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', padding: '8px 8px',
        height: 48, boxSizing: 'border-box', background: W.surface,
        flexShrink: 0,
      }}>
        <button style={{
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer', color: W.fg1, padding: 0,
          borderRadius: 8,
        }}>
          <i data-lucide="x" style={{ width: 22, height: 22 }} />
        </button>
        <div style={{
          flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600,
          color: W.fg1, letterSpacing: -0.15,
        }}>{title}</div>
        <div style={{
          minWidth: 52, padding: '0 12px', fontSize: 12, fontWeight: 500,
          color: W.fg3, textAlign: 'right', letterSpacing: -0.05,
        }}>{step && total ? `${step} of ${total}` : ''}</div>
      </div>
      {step && total && <ProgressBar step={step} total={total} />}
      {!step && <div style={{ height: 1, background: W.border }} />}
    </>
  );
}

function ProgressBar({ step, total }) {
  return (
    <div style={{
      display: 'flex', gap: 4, padding: '0 16px 8px',
      background: W.surface, borderBottom: `1px solid ${W.border}`,
    }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          flex: 1, height: 4, borderRadius: 3,
          background: i < step ? W.primary600 : W.border,
        }} />
      ))}
    </div>
  );
}

// ─── Atoms ────────────────────────────────────────────────────

function ScrollArea({ children, bottomPad = 108 }) {
  return (
    <div style={{
      flex: 1, overflow: 'auto',
      padding: `20px 16px ${bottomPad}px`,
      display: 'flex', flexDirection: 'column', gap: 18,
    }}>{children}</div>
  );
}

function StickyBottom({ children }) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'rgba(255,255,255,0.96)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      borderTop: `1px solid ${W.border}`,
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
      background: disabled ? W.sunken : W.primary600,
      color: disabled ? W.fg4 : '#fff',
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

function OverlineLabel({ children, style = {} }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: W.fg3, marginBottom: 10, ...style,
    }}>{children}</div>
  );
}

// ─── Search field ─────────────────────────────────────────────

function SearchField({ value, placeholder, focused, onClear }) {
  const hasValue = !!value;
  return (
    <div style={{
      position: 'relative',
      background: W.surface,
      border: `1.5px solid ${focused ? W.primary500 : W.border}`,
      borderRadius: 12,
      boxShadow: focused ? '0 0 0 4px rgba(2,132,199,0.12)' : '0 1px 2px rgba(0,0,0,0.03)',
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '0 12px', height: 48,
    }}>
      <i data-lucide="search" style={{ width: 18, height: 18, color: focused ? W.primary600 : W.fg3, flexShrink: 0 }} />
      <div style={{
        flex: 1, fontSize: 15, letterSpacing: -0.15, lineHeight: '20px',
        color: hasValue ? W.fg1 : W.fg4, minWidth: 0,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {hasValue ? value : placeholder}
        {focused && hasValue && (
          <span style={{
            display: 'inline-block', width: 1.5, height: 18, background: W.primary600,
            verticalAlign: 'middle', marginLeft: 1, animation: 'caret 1s steps(2) infinite',
          }} />
        )}
      </div>
      {hasValue && (
        <button onClick={onClear} style={{
          width: 22, height: 22, borderRadius: '50%', border: 'none',
          background: W.sunken, color: W.fg3,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', flexShrink: 0,
        }}>
          <i data-lucide="x" style={{ width: 12, height: 12, strokeWidth: 3 }} />
        </button>
      )}
    </div>
  );
}

function LocationButton() {
  return (
    <button style={{
      width: '100%', height: 44, borderRadius: 10,
      background: W.primary50, border: `1px solid ${W.primary100}`,
      color: W.primary700, fontSize: 13, fontWeight: 600, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      letterSpacing: -0.1,
    }}>
      <i data-lucide="locate-fixed" style={{ width: 15, height: 15, strokeWidth: 2.2 }} />
      Use my current location
    </button>
  );
}

// ─── Nearby result row ────────────────────────────────────────

function NearbyResult({ line1, line2, distance, selected, claimed }) {
  return (
    <button style={{
      width: '100%', textAlign: 'left', cursor: 'pointer',
      background: selected ? W.primary50 : W.surface,
      border: selected ? `1.5px solid ${W.primary500}` : `1px solid ${W.border}`,
      borderRadius: 14, padding: 12,
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: selected
        ? '0 0 0 3px rgba(2,132,199,0.10), 0 1px 3px rgba(0,0,0,0.04)'
        : '0 1px 2px rgba(0,0,0,0.03)',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: selected ? W.primary600 : W.sunken,
        color: selected ? '#fff' : W.fg2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <i data-lucide="home" style={{ width: 18, height: 18, strokeWidth: 2 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 600, color: W.fg1, letterSpacing: -0.15,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{line1}</div>
        <div style={{
          fontSize: 11.5, color: W.fg3, marginTop: 2,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span>{line2}</span>
          <span style={{ color: W.fg4 }}>·</span>
          <span>{distance}</span>
        </div>
      </div>
      {selected ? (
        <div style={{
          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
          background: W.primary600, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i data-lucide="check" style={{ width: 14, height: 14, strokeWidth: 3.2 }} />
        </div>
      ) : claimed ? (
        <span style={{
          fontSize: 10.5, fontWeight: 600, color: W.fg3,
          padding: '4px 8px', background: W.sunken, borderRadius: 9999,
          letterSpacing: 0.04, textTransform: 'uppercase', flexShrink: 0,
        }}>Claimed</span>
      ) : (
        <span style={{
          fontSize: 12, fontWeight: 600, color: W.primary600, letterSpacing: -0.1,
          flexShrink: 0, padding: '0 4px',
        }}>This is mine</span>
      )}
    </button>
  );
}

// ─── FRAME 1 · POPULATED (nearby + selection) ─────────────────

function FrameFindPopulated() {
  const nearby = [
    { line1: '412 Elm St, Apt 3B',  line2: 'Brooklyn, NY',  distance: '12 ft',  selected: true },
    { line1: '412 Elm St, Apt 3A',  line2: 'Brooklyn, NY',  distance: '14 ft' },
    { line1: '412 Elm St, Apt 4B',  line2: 'Brooklyn, NY',  distance: '18 ft', claimed: true },
    { line1: '414 Elm St',          line2: 'Brooklyn, NY',  distance: '42 ft' },
    { line1: '410 Elm St',          line2: 'Brooklyn, NY',  distance: '48 ft' },
  ];
  return (
    <Phone label="A12.1 Find your home — populated">
      <WizardHeader title="Find your home" step={1} total={3} />
      <ScrollArea>
        <div>
          <h2 style={{
            margin: 0, fontSize: 20, fontWeight: 700, color: W.fg1,
            letterSpacing: -0.3, lineHeight: '26px',
          }}>Where do you live?</h2>
          <p style={{
            margin: '6px 0 0', fontSize: 13.5, color: W.fg3, lineHeight: '19px',
          }}>
            Pick your address to start. You'll verify it next.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SearchField placeholder="Street address, ZIP, or building name" />
          <LocationButton />
        </div>

        <div>
          <OverlineLabel style={{
            marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <i data-lucide="map-pin" style={{ width: 11, height: 11 }} />
            Nearby · Brooklyn, NY
          </OverlineLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {nearby.map((r, i) => <NearbyResult key={i} {...r} />)}
          </div>
        </div>

        <button style={{
          background: 'transparent', border: 'none', padding: '4px 0',
          color: W.primary600, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 4,
          letterSpacing: -0.1, alignSelf: 'flex-start',
        }}>
          <i data-lucide="plus" style={{ width: 14, height: 14 }} />
          Add address manually
        </button>
      </ScrollArea>

      <StickyBottom>
        <PrimaryBtn icon="arrow-right" full>Claim this home</PrimaryBtn>
      </StickyBottom>
    </Phone>
  );
}

// ─── FRAME 2 · SECONDARY (autocomplete searching) ─────────────

function AutocompleteRow({ primary, secondary, match }) {
  // Render primary with highlighted match substring
  const idx = primary.toLowerCase().indexOf(match.toLowerCase());
  const before = idx >= 0 ? primary.slice(0, idx) : primary;
  const hit    = idx >= 0 ? primary.slice(idx, idx + match.length) : '';
  const after  = idx >= 0 ? primary.slice(idx + match.length) : '';
  return (
    <button style={{
      width: '100%', textAlign: 'left', cursor: 'pointer',
      background: 'transparent', border: 'none', padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
      borderBottom: `1px solid #f3f4f6`,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: W.sunken, color: W.fg3,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <i data-lucide="map-pin" style={{ width: 15, height: 15 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, color: W.fg2, letterSpacing: -0.15, lineHeight: '19px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {before}
          <span style={{ fontWeight: 700, color: W.fg1 }}>{hit}</span>
          {after}
        </div>
        <div style={{
          fontSize: 11.5, color: W.fg3, marginTop: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{secondary}</div>
      </div>
      <i data-lucide="corner-down-left" style={{ width: 14, height: 14, color: W.fg4, flexShrink: 0 }} />
    </button>
  );
}

function FrameFindSearching() {
  const match = '412 elm';
  const suggestions = [
    { primary: '412 Elm St, Apt 3B', secondary: 'Brooklyn, NY 11211' },
    { primary: '412 Elm St, Apt 3A', secondary: 'Brooklyn, NY 11211' },
    { primary: '412 Elm Street',      secondary: 'Cambridge, MA 02139' },
    { primary: '412 Elmwood Ave',     secondary: 'Buffalo, NY 14222' },
    { primary: '4120 Elm Ridge Rd',   secondary: 'Sacramento, CA 95821' },
  ];
  return (
    <Phone label="A12.1 Find your home — searching">
      <WizardHeader title="Find your home" step={1} total={3} />
      <ScrollArea bottomPad={108}>
        <div>
          <h2 style={{
            margin: 0, fontSize: 20, fontWeight: 700, color: W.fg1,
            letterSpacing: -0.3, lineHeight: '26px',
          }}>Where do you live?</h2>
          <p style={{
            margin: '6px 0 0', fontSize: 13.5, color: W.fg3, lineHeight: '19px',
          }}>
            Pick your address to start. You'll verify it next.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative' }}>
          <SearchField value="412 Elm" focused />

          {/* autocomplete dropdown */}
          <div style={{
            marginTop: 8, background: W.surface,
            border: `1px solid ${W.border}`, borderRadius: 14,
            boxShadow: '0 8px 24px rgba(17,24,39,0.10), 0 2px 6px rgba(17,24,39,0.06)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '8px 14px 6px',
              fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: W.fg4,
              background: W.muted, borderBottom: `1px solid ${W.border}`,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <i data-lucide="search" style={{ width: 10, height: 10 }} />
              5 matches
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {suggestions.map((s, i) => (
                <div key={i} style={{
                  borderBottom: i < suggestions.length - 1 ? `1px solid ${W.border}` : 'none',
                }}>
                  <AutocompleteRow {...s} match={match} />
                </div>
              ))}
            </div>
            <button style={{
              width: '100%', textAlign: 'left', cursor: 'pointer',
              background: W.primary50, border: 'none', padding: '12px 14px',
              borderTop: `1px solid ${W.primary100}`,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: W.surface, color: W.primary600,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i data-lucide="plus" style={{ width: 16, height: 16, strokeWidth: 2.4 }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: W.primary700, letterSpacing: -0.15 }}>
                  Can't find it? Add manually
                </div>
                <div style={{ fontSize: 11.5, color: W.fg3, marginTop: 2 }}>
                  We'll geocode it and mail a verification code.
                </div>
              </div>
              <i data-lucide="chevron-right" style={{ width: 16, height: 16, color: W.primary600 }} />
            </button>
          </div>
        </div>

        <div style={{
          display: 'flex', gap: 10, alignItems: 'flex-start',
          padding: '10px 12px', background: W.sunken, borderRadius: 10,
          marginTop: 4,
        }}>
          <i data-lucide="info" style={{ width: 14, height: 14, color: W.fg3, flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 11.5, color: W.fg2, lineHeight: '16px' }}>
            Tip: try a street number + first 3 letters. Apt &amp; unit pickers come on the next step.
          </div>
        </div>
      </ScrollArea>

      <StickyBottom>
        <PrimaryBtn icon="arrow-right" disabled full>Claim this home</PrimaryBtn>
      </StickyBottom>
    </Phone>
  );
}

// add caret blink keyframes once
if (typeof document !== 'undefined' && !document.getElementById('__caret_kf')) {
  const s = document.createElement('style');
  s.id = '__caret_kf';
  s.textContent = `@keyframes caret { 0%{opacity:1} 50%{opacity:0} 100%{opacity:1} }`;
  document.head.appendChild(s);
}

Object.assign(window, { FrameFindPopulated, FrameFindSearching });
