// MailBookletScreen — A17 archetype × Booklet variant.
// Slots beyond the archetype: page indicator, swipeable image+OCR pages,
// and a thumbnail-grid secondary state for navigating a 28-page booklet.

// ── Booklet metadata ───────────────────────────────────────
const BOOKLET = {
  accent: '#2980b9',        // cat-tutoring blue
  trust: 'verified',
  category: 'Booklet',
  sender: 'League of Women Voters · Alameda County',
  time: '2d ago',
  title: 'June 2026 primary voter guide',
  reference: 'Vol. 47 · 28 pages · Nonpartisan',
};

const BOOKLET_SENDER = {
  initials: 'LV',
  avatarBg: 'linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)',
  name: 'League of Women Voters',
  dept: 'Alameda County chapter · Nonpartisan',
  kind: 'Verified nonprofit',
  proof: 'EIN on file',
};

// Sections drive the table-of-contents grid and the page chip nav.
const SECTIONS = [
  { id: 'cover',    label: 'Cover',          range: [1, 1],   color: '#0c4a6e' },
  { id: 'how',      label: 'How to vote',    range: [2, 4],   color: '#15803d' },
  { id: 'federal',  label: 'Federal races',  range: [5, 8],   color: '#9a3412' },
  { id: 'state',    label: 'State races',    range: [9, 14],  color: '#6d28d9' },
  { id: 'local',    label: 'Local races',    range: [15, 22], color: '#0369a1' },
  { id: 'measures', label: 'Ballot measures',range: [23, 28], color: '#b45623' },
];

const PAGE_COUNT = 28;

// Decide which mock page layout to render for a given page number, so
// the booklet feels like it has real shape instead of 28 identical cards.
function pageLayout(n) {
  if (n === 1) return 'cover';
  if (n <= 4) return 'steps';
  if (n <= 8 || (n >= 9 && n <= 14) || (n >= 15 && n <= 22)) return 'race';
  return 'measure';
}

function pageSection(n) {
  return SECTIONS.find(s => n >= s.range[0] && n <= s.range[1]);
}

// ── Top nav ────────────────────────────────────────────────
function BookletNav({ eyebrow, eyebrowColor, mode, onToggleMode }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '6px 8px 8px 4px',
      background: 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--app-border-subtle)',
      gap: 4,
    }}>
      <button style={{
        display: 'inline-flex', alignItems: 'center', gap: 2,
        border: 'none', background: 'transparent',
        color: 'var(--color-primary-600)',
        padding: '6px 6px', cursor: 'pointer',
        borderRadius: 8,
      }}>
        <i data-lucide="chevron-left" style={{ width: 22, height: 22 }}></i>
        <span style={{ fontSize: 15, fontWeight: 500, marginLeft: -2 }}>Mailbox</span>
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: eyebrowColor }}></span>
        <span style={{
          fontSize: 12, fontWeight: 700, color: 'var(--fg2)',
          letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>{eyebrow}</span>
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        <button style={{
          width: 34, height: 34, borderRadius: 9999,
          border: 'none',
          background: mode === 'grid' ? 'var(--color-primary-100)' : 'var(--app-surface-sunken)',
          color: mode === 'grid' ? 'var(--color-primary-700)' : 'var(--fg2)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}>
          <i data-lucide={mode === 'grid' ? 'book-open' : 'grid-2x2'} style={{ width: 17, height: 17 }}></i>
        </button>
        <button style={{
          width: 34, height: 34, borderRadius: 9999,
          border: 'none', background: 'var(--app-surface-sunken)',
          color: 'var(--fg2)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}>
          <i data-lucide="more-horizontal" style={{ width: 18, height: 18 }}></i>
        </button>
      </div>
    </div>
  );
}

// ── Card shell (local copy — keeps file self-contained) ────
function BCard({ children, accent, style = {}, noPad = false }) {
  return (
    <div style={{
      position: 'relative',
      background: '#fff',
      border: '1px solid var(--app-border)',
      borderRadius: 16,
      padding: noPad ? 0 : 14,
      overflow: 'hidden',
      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      ...style,
    }}>
      {accent && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 4, background: accent,
        }}></div>
      )}
      <div style={{ paddingLeft: accent ? 4 : 0 }}>{children}</div>
    </div>
  );
}

// ── Hero card (booklet) ────────────────────────────────────
function BookletHero({ item }) {
  return (
    <BCard accent={item.accent}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <TrustChip kind={item.trust} />
        <CategoryChip label={item.category} color={item.accent} />
        <span style={{ flex: 1 }}></span>
        <span style={{ fontSize: 11, color: 'var(--fg3)', fontWeight: 500 }}>{item.time}</span>
      </div>
      <div style={{
        fontSize: 11, fontWeight: 600, color: 'var(--fg3)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
      }}>{item.sender}</div>
      <div style={{
        fontSize: 19, fontWeight: 700, color: 'var(--fg1)',
        lineHeight: 1.25, letterSpacing: '-0.015em',
        textWrap: 'pretty',
      }}>{item.title}</div>
      <div style={{
        fontSize: 11, color: 'var(--fg3)', marginTop: 6,
        fontFamily: 'var(--font-mono)',
      }}>{item.reference}</div>
    </BCard>
  );
}

// ── Page indicator strip ───────────────────────────────────
function PageIndicator({ page, total }) {
  const section = pageSection(page);
  const pct = ((page - 1) / (total - 1)) * 100;
  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--app-border)',
      borderRadius: 14,
      padding: '12px 14px',
      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button style={pageArrow}>
          <i data-lucide="chevron-left" style={{ width: 16, height: 16 }}></i>
        </button>
        <div style={{ flex: 1, textAlign: 'center', lineHeight: 1.15 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg1)' }}>
            Page {page} <span style={{ color: 'var(--fg3)', fontWeight: 500 }}>of {total}</span>
          </div>
          <div style={{
            fontSize: 11, color: section.color, fontWeight: 600,
            marginTop: 1, letterSpacing: '0.01em',
          }}>{section.label}</div>
        </div>
        <button style={pageArrow}>
          <i data-lucide="chevron-right" style={{ width: 16, height: 16 }}></i>
        </button>
      </div>
      {/* scrubber */}
      <div style={{
        marginTop: 10, height: 4, borderRadius: 4,
        background: 'var(--app-surface-sunken)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${pct}%`, background: 'var(--color-primary-600)',
          borderRadius: 4,
          transition: 'width 200ms ease-out',
        }}></div>
        {/* section ticks */}
        {SECTIONS.slice(1).map((s, i) => {
          const left = ((s.range[0] - 1) / (total - 1)) * 100;
          return (
            <div key={i} style={{
              position: 'absolute', top: -2, bottom: -2, width: 1,
              left: `${left}%`,
              background: 'rgba(0,0,0,0.18)',
            }}></div>
          );
        })}
      </div>
      {/* section chips */}
      <div style={{
        display: 'flex', gap: 5, marginTop: 10,
        overflowX: 'hidden',
      }}>
        {SECTIONS.map(s => {
          const active = s.id === section.id;
          return (
            <span key={s.id} style={{
              flex: '0 0 auto',
              padding: '4px 8px',
              borderRadius: 9999,
              background: active ? s.color : '#fff',
              color: active ? '#fff' : 'var(--fg2)',
              border: active ? 'none' : '1px solid var(--app-border)',
              fontSize: 10, fontWeight: 700,
              letterSpacing: '0.01em',
              whiteSpace: 'nowrap',
            }}>{s.label}</span>
          );
        })}
      </div>
    </div>
  );
}
const pageArrow = {
  width: 32, height: 32, borderRadius: 9999,
  background: 'var(--app-surface-sunken)',
  color: 'var(--fg2)',
  border: 'none', cursor: 'pointer', flexShrink: 0,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};

// ── Booklet page mocks ─────────────────────────────────────
// Render a small "paper" mock that looks like a real booklet page.
// Used at large size in the viewer and at thumbnail size in the grid.
function PaperPage({ page, scale = 1, ribbon = false }) {
  const layout = pageLayout(page);
  const section = pageSection(page);

  const paperBg = '#FBF8F1';
  const ink = '#2A2723';
  const accent = section.color;

  const wrap = {
    position: 'relative',
    background: paperBg,
    borderRadius: 6 * scale,
    overflow: 'hidden',
    boxShadow: scale >= 1
      ? '0 6px 20px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.06), inset 0 0 0 1px rgba(0,0,0,0.06)'
      : '0 1px 3px rgba(0,0,0,0.08), inset 0 0 0 0.5px rgba(0,0,0,0.08)',
    color: ink,
    fontFamily: 'var(--font-serif)',
    height: '100%',
  };

  return (
    <div style={wrap}>
      {ribbon && scale >= 1 && (
        <div style={{
          position: 'absolute', top: 10, right: -28, transform: 'rotate(35deg)',
          background: 'var(--color-primary-600)', color: '#fff',
          fontFamily: 'var(--font-sans)',
          fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
          padding: '3px 30px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          zIndex: 2,
        }}>SCANNED</div>
      )}
      {layout === 'cover'    && <CoverLayout    section={section} accent={accent} ink={ink} scale={scale} />}
      {layout === 'steps'    && <StepsLayout    page={page} section={section} accent={accent} ink={ink} scale={scale} />}
      {layout === 'race'     && <RaceLayout     page={page} section={section} accent={accent} ink={ink} scale={scale} />}
      {layout === 'measure'  && <MeasureLayout  page={page} section={section} accent={accent} ink={ink} scale={scale} />}
      {/* page number footer */}
      <div style={{
        position: 'absolute', bottom: 6 * scale, left: 0, right: 0,
        textAlign: 'center',
        fontSize: 8 * Math.max(scale, 0.9),
        color: 'rgba(0,0,0,0.45)',
        fontFamily: 'var(--font-serif)',
        fontStyle: 'italic',
      }}>— {page} —</div>
    </div>
  );
}

function CoverLayout({ accent, ink, scale }) {
  return (
    <div style={{
      padding: `${28 * scale}px ${22 * scale}px`,
      height: '100%',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: 9 * scale, fontFamily: 'var(--font-sans)',
        letterSpacing: '0.16em', textTransform: 'uppercase',
        color: 'rgba(0,0,0,0.55)', fontWeight: 700,
      }}>League of Women Voters</div>
      <div style={{
        marginTop: 8 * scale, marginBottom: 8 * scale,
        display: 'flex', alignItems: 'center', gap: 6 * scale, width: '100%',
      }}>
        <div style={{ flex: 1, height: 1, background: ink, opacity: 0.4 }}></div>
        <i data-lucide="vote" style={{
          width: 14 * scale, height: 14 * scale, color: accent, flexShrink: 0,
        }}></i>
        <div style={{ flex: 1, height: 1, background: ink, opacity: 0.4 }}></div>
      </div>
      <div style={{
        fontSize: 22 * scale, fontWeight: 700, letterSpacing: '-0.01em',
        lineHeight: 1.05, color: ink, marginTop: 6 * scale,
      }}>JUNE 2026<br/>PRIMARY<br/>VOTER GUIDE</div>
      <div style={{
        marginTop: 14 * scale,
        width: 56 * scale, height: 56 * scale,
        borderRadius: '50%',
        border: `${1.5 * scale}px solid ${accent}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', flexShrink: 0,
        fontFamily: 'var(--font-serif)',
      }}>
        <div style={{ fontSize: 9 * scale, color: accent, fontWeight: 700, letterSpacing: '0.04em' }}>VOL.</div>
        <div style={{ fontSize: 20 * scale, color: accent, fontWeight: 700, lineHeight: 1, marginTop: 2 * scale }}>47</div>
      </div>
      <div style={{
        marginTop: 16 * scale,
        fontSize: 10 * scale, fontStyle: 'italic',
        color: 'rgba(0,0,0,0.7)', lineHeight: 1.4,
      }}>Polls open 7 AM – 8 PM<br/>Tuesday, June 2, 2026</div>
      <div style={{
        marginTop: 'auto',
        fontSize: 8 * scale, fontFamily: 'var(--font-sans)',
        color: 'rgba(0,0,0,0.5)', letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}>Alameda County · Nonpartisan</div>
    </div>
  );
}

function StepsLayout({ section, accent, ink, scale }) {
  const steps = [
    'Check that you are registered.',
    'Find your polling place.',
    'Bring your ID — or vote by mail.',
    'Mark, sign, and return your ballot.',
  ];
  return (
    <div style={{ padding: `${16 * scale}px ${18 * scale}px`, height: '100%' }}>
      <div style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 8 * scale, letterSpacing: '0.14em',
        color: accent, fontWeight: 700, textTransform: 'uppercase',
      }}>{section.label}</div>
      <div style={{
        fontSize: 18 * scale, fontWeight: 700,
        letterSpacing: '-0.01em', marginTop: 4 * scale, lineHeight: 1.15,
        color: ink,
      }}>Four steps to a ballot you trust.</div>
      <div style={{
        marginTop: 10 * scale, height: 1,
        background: ink, opacity: 0.3,
      }}></div>
      <div style={{ marginTop: 12 * scale, display: 'flex', flexDirection: 'column', gap: 10 * scale }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 10 * scale, alignItems: 'flex-start' }}>
            <div style={{
              width: 22 * scale, height: 22 * scale, borderRadius: '50%',
              background: accent, color: '#fff',
              fontFamily: 'var(--font-serif)',
              fontSize: 12 * scale, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>{i + 1}</div>
            <div style={{
              fontSize: 11 * scale, lineHeight: 1.4, color: ink,
              paddingTop: 3 * scale,
            }}>{s}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RaceLayout({ page, section, accent, ink, scale }) {
  return (
    <div style={{ padding: `${16 * scale}px ${18 * scale}px`, height: '100%' }}>
      <div style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 8 * scale, letterSpacing: '0.14em',
        color: accent, fontWeight: 700, textTransform: 'uppercase',
      }}>{section.label}</div>
      <div style={{
        fontSize: 14 * scale, fontWeight: 700,
        letterSpacing: '-0.01em', marginTop: 4 * scale, lineHeight: 1.2,
        color: ink,
      }}>State Assembly · District 18</div>
      <div style={{
        marginTop: 8 * scale, height: 1, background: ink, opacity: 0.3,
      }}></div>
      <div style={{ marginTop: 10 * scale, display: 'flex', flexDirection: 'column', gap: 9 * scale }}>
        {['M. Alvarez', 'C. Brooks', 'R. Tanaka'].map((name, i) => (
          <div key={i} style={{ display: 'flex', gap: 9 * scale }}>
            <div style={{
              width: 28 * scale, height: 34 * scale,
              background: 'rgba(0,0,0,0.12)',
              border: `0.5px solid rgba(0,0,0,0.2)`,
              flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11 * scale, color: 'rgba(0,0,0,0.5)',
              fontFamily: 'var(--font-serif)',
            }}>{name.split(' ')[0][0]}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 11 * scale, fontWeight: 700, color: ink, lineHeight: 1.1,
              }}>{name}</div>
              <div style={{ fontSize: 8 * scale, fontStyle: 'italic', color: 'rgba(0,0,0,0.55)', marginTop: 1 }}>
                {['Democrat', 'Republican', 'Green'][i]}
              </div>
              <div style={{
                marginTop: 3 * scale,
                fontSize: 8.5 * scale, color: ink, lineHeight: 1.35, opacity: 0.85,
              }}>
                {['Housing-first; expand transit corridors along East 14th.',
                  'Tax relief for small business; tougher on retail theft.',
                  'Climate emergency declaration; rent stabilization.'][i]}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MeasureLayout({ section, accent, ink, scale }) {
  return (
    <div style={{ padding: `${16 * scale}px ${18 * scale}px`, height: '100%' }}>
      <div style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 8 * scale, letterSpacing: '0.14em',
        color: accent, fontWeight: 700, textTransform: 'uppercase',
      }}>{section.label}</div>
      <div style={{
        fontSize: 14 * scale, fontWeight: 700,
        letterSpacing: '-0.01em', marginTop: 4 * scale, lineHeight: 1.2, color: ink,
      }}>Measure C · Library funding</div>
      <div style={{ marginTop: 8 * scale, height: 1, background: ink, opacity: 0.3 }}></div>
      <div style={{
        marginTop: 10 * scale, fontSize: 10 * scale, lineHeight: 1.45,
        color: ink, opacity: 0.9, fontStyle: 'italic',
      }}>Shall the city renew the 0.10% parcel tax for branch libraries through 2034?</div>
      <div style={{ display: 'flex', gap: 8 * scale, marginTop: 12 * scale }}>
        <div style={{
          flex: 1,
          border: `${1.5 * scale}px solid ${accent}`,
          padding: `${8 * scale}px ${6 * scale}px`,
          textAlign: 'center',
          background: 'rgba(255,255,255,0.4)',
        }}>
          <div style={{ fontSize: 11 * scale, fontWeight: 700, color: accent }}>YES</div>
          <div style={{ fontSize: 8 * scale, color: ink, opacity: 0.75, marginTop: 2 * scale, lineHeight: 1.3 }}>
            Keep branches open; renew funding.
          </div>
        </div>
        <div style={{
          flex: 1,
          border: `0.5px solid ${ink}`,
          padding: `${8 * scale}px ${6 * scale}px`,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 11 * scale, fontWeight: 700, color: ink, opacity: 0.7 }}>NO</div>
          <div style={{ fontSize: 8 * scale, color: ink, opacity: 0.65, marginTop: 2 * scale, lineHeight: 1.3 }}>
            Let the parcel tax sunset.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Big page viewer (with peek of next page) ───────────────
function PageViewer({ page }) {
  return (
    <div style={{
      position: 'relative',
      padding: '0 14px 0 0', // leave room on right for next-page peek
      marginRight: -14,
    }}>
      <div style={{ position: 'relative' }}>
        {/* current page */}
        <div style={{ width: '100%', aspectRatio: '3 / 4', position: 'relative' }}>
          <PaperPage page={page} scale={1} ribbon />
        </div>
        {/* peek of next page */}
        <div style={{
          position: 'absolute', right: -10, top: 14, bottom: 14, width: 14,
          background: '#F0EBE0',
          borderRadius: '0 6px 6px 0',
          boxShadow: 'inset 4px 0 6px -4px rgba(0,0,0,0.15)',
          opacity: 0.85,
        }}></div>
      </div>
    </div>
  );
}

// ── OCR transcript card ────────────────────────────────────
function OCRCard({ page }) {
  // Compose a transcript that matches the rendered cover.
  let lines = [];
  const layout = pageLayout(page);
  if (layout === 'cover') {
    lines = [
      ['overline', 'LEAGUE OF WOMEN VOTERS'],
      ['title',   'JUNE 2026 PRIMARY VOTER GUIDE'],
      ['body',    'Volume 47'],
      ['body',    'Polls open 7 AM – 8 PM · Tuesday, June 2, 2026'],
      ['caption', 'Alameda County · Nonpartisan'],
    ];
  } else if (layout === 'steps') {
    lines = [
      ['overline', 'HOW TO VOTE'],
      ['title',    'Four steps to a ballot you trust.'],
      ['body',     '1. Check that you are registered.'],
      ['body',     '2. Find your polling place.'],
      ['body',     '3. Bring your ID — or vote by mail.'],
      ['body',     '4. Mark, sign, and return your ballot.'],
    ];
  }
  return (
    <BCard>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 22, height: 22, borderRadius: 6,
          background: '#f3f4f6', color: 'var(--fg2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i data-lucide="scan-text" style={{ width: 13, height: 13 }}></i>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg1)', flex: 1 }}>
          Text from this page
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700,
          padding: '2px 7px', borderRadius: 9999,
          background: 'var(--color-success-bg)', color: '#047857',
        }}>OCR · 99%</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {lines.map(([kind, txt], i) => {
          const style = kind === 'title'    ? { fontSize: 14, fontWeight: 700, color: 'var(--fg1)', letterSpacing: '-0.01em' }
                      : kind === 'overline' ? { fontSize: 10, fontWeight: 700, color: 'var(--fg3)', letterSpacing: '0.08em', textTransform: 'uppercase' }
                      : kind === 'caption'  ? { fontSize: 11, color: 'var(--fg3)' }
                      :                       { fontSize: 12.5, color: 'var(--fg2)', lineHeight: 1.45 };
          return <div key={i} style={style}>{txt}</div>;
        })}
      </div>
      <div style={{
        marginTop: 10, paddingTop: 10,
        borderTop: '1px solid var(--app-border-subtle)',
        display: 'flex', gap: 14,
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary-600)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <i data-lucide="copy" style={{ width: 12, height: 12 }}></i>Copy text
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <i data-lucide="languages" style={{ width: 12, height: 12 }}></i>Translate
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <i data-lucide="volume-2" style={{ width: 12, height: 12 }}></i>Read aloud
        </span>
      </div>
    </BCard>
  );
}

// ── AI elf strip (local to file, slight variation in copy) ─
function BookletElf() {
  return (
    <div style={{
      background: 'linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 100%)',
      border: '1px solid #bae6fd',
      borderRadius: 16,
      padding: '12px 14px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 8,
          background: 'var(--color-primary-600)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 6px rgba(2,132,199,0.3)',
        }}>
          <i data-lucide="sparkles" style={{ width: 13, height: 13 }}></i>
        </div>
        <div style={{
          fontSize: 12, fontWeight: 700,
          color: 'var(--color-primary-800)', flex: 1,
          letterSpacing: '-0.005em',
        }}>Pantopus read the whole booklet</div>
        <span style={{
          fontSize: 10, fontWeight: 700,
          padding: '2px 7px', borderRadius: 9999,
          background: '#fff', color: 'var(--color-primary-700)',
          border: '1px solid #bae6fd',
        }}>2 min summary</span>
      </div>
      <div style={{
        fontSize: 13, color: '#0c4a6e', lineHeight: 1.5, marginBottom: 10,
        textWrap: 'pretty',
      }}>
        28 pages covering 6 federal & state races, 8 local races, and 3 ballot measures on your Alameda County ballot. Your polling place is the Elm Park branch library.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { icon: 'map-pin',  label: 'Your polling place', text: 'Elm Park Library, 240 Elm St' },
          { icon: 'list',     label: '17 races on your ballot', text: 'jump to your district' },
          { icon: 'gavel',    label: '3 measures', text: 'A · road repair · B · school bond · C · libraries' },
        ].map((b, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            fontSize: 12, lineHeight: 1.45, color: 'var(--fg1)',
          }}>
            <div style={{
              width: 16, height: 16, borderRadius: 4,
              background: '#fff', color: 'var(--color-primary-700)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, marginTop: 1,
              border: '1px solid #bae6fd',
            }}>
              <i data-lucide={b.icon} style={{ width: 10, height: 10 }}></i>
            </div>
            <span><strong style={{ fontWeight: 700 }}>{b.label}</strong>
              <span style={{ color: 'var(--fg2)' }}> — {b.text}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sender card (booklet) ──────────────────────────────────
function BookletSender() {
  const s = BOOKLET_SENDER;
  return (
    <BCard>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
      }}>Sender</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: s.avatarBg,
          color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, flexShrink: 0,
          position: 'relative',
        }}>
          {s.initials}
          <span style={{
            position: 'absolute', right: -3, bottom: -3,
            width: 16, height: 16, borderRadius: '50%',
            background: 'var(--color-success)', color: '#fff',
            border: '2px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i data-lucide="check" style={{ width: 9, height: 9 }}></i>
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg1)' }}>{s.name}</div>
          <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 1 }}>{s.dept}</div>
          <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 9999,
              background: '#dbeafe', color: '#1e40af',
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              <i data-lucide="heart" style={{ width: 9, height: 9 }}></i>
              {s.kind}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 9999,
              background: 'var(--color-success-bg)', color: '#047857',
            }}>{s.proof}</span>
          </div>
        </div>
        <i data-lucide="chevron-right" style={{ width: 16, height: 16, color: 'var(--fg4)' }}></i>
      </div>
    </BCard>
  );
}

// ── Action bar (booklet) ───────────────────────────────────
function BookletActions({ saved = false }) {
  const secondaries = [
    { icon: 'share-2',    label: 'Share' },
    { icon: 'printer',    label: 'Print' },
    { icon: 'download',   label: 'PDF' },
    { icon: 'archive',    label: 'Archive' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button style={{
        width: '100%',
        padding: '14px 16px',
        background: saved ? '#fff' : 'var(--color-primary-600)',
        color: saved ? 'var(--color-success)' : '#fff',
        border: saved ? '1.5px solid var(--color-success-light)' : 'none',
        borderRadius: 14,
        fontSize: 15, fontWeight: 700,
        boxShadow: saved ? 'none' : 'var(--shadow-primary)',
        cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <i data-lucide={saved ? 'lock' : 'archive'} style={{ width: 16, height: 16 }}></i>
        {saved ? 'Saved to Vault · Tap to remove' : 'Save to Vault'}
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {secondaries.map((s, i) => (
          <button key={i} style={{
            background: '#fff', border: '1px solid var(--app-border)',
            borderRadius: 12, padding: '10px 4px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            color: 'var(--fg2)', cursor: 'pointer',
            fontSize: 10.5, fontWeight: 600,
          }}>
            <i data-lucide={s.icon} style={{ width: 17, height: 17 }}></i>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Thumbnail grid (secondary state) ───────────────────────
function PagesGrid({ currentPage }) {
  return (
    <BCard noPad>
      <div style={{
        padding: '10px 14px 8px',
        borderBottom: '1px solid var(--app-border-subtle)',
        display: 'flex', alignItems: 'center',
      }}>
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>All pages</div>
          <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 1 }}>
            Tap a thumbnail to jump there
          </div>
        </div>
        <span style={{ flex: 1 }}></span>
        <span style={{
          fontSize: 11, fontWeight: 700, color: 'var(--fg2)',
          padding: '4px 8px', borderRadius: 9999,
          background: 'var(--app-surface-sunken)',
        }}>28 pages</span>
      </div>
      <div style={{ padding: '12px 14px' }}>
        {SECTIONS.map(section => {
          const pages = [];
          for (let p = section.range[0]; p <= section.range[1]; p++) pages.push(p);
          return (
            <div key={section.id} style={{ marginBottom: 18 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', background: section.color,
                }}></span>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: 'var(--fg2)',
                  letterSpacing: '0.04em', textTransform: 'uppercase',
                }}>{section.label}</span>
                <span style={{ fontSize: 10, color: 'var(--fg4)', fontWeight: 500 }}>
                  · pp. {section.range[0]}{section.range[0] !== section.range[1] ? `–${section.range[1]}` : ''}
                </span>
                <span style={{ flex: 1 }}></span>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
              }}>
                {pages.map(p => (
                  <Thumb key={p} page={p} active={p === currentPage} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </BCard>
  );
}

function Thumb({ page, active }) {
  return (
    <div style={{
      position: 'relative',
      borderRadius: 6,
      overflow: 'hidden',
      boxShadow: active
        ? '0 0 0 2.5px var(--color-primary-600), 0 4px 10px rgba(2,132,199,0.25)'
        : '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      <div style={{ aspectRatio: '3 / 4', position: 'relative' }}>
        <PaperPage page={page} scale={0.32} />
      </div>
      {active && (
        <div style={{
          position: 'absolute', top: 4, right: 4,
          width: 18, height: 18, borderRadius: '50%',
          background: 'var(--color-primary-600)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i data-lucide="eye" style={{ width: 10, height: 10 }}></i>
        </div>
      )}
    </div>
  );
}

// ── Screen ─────────────────────────────────────────────────
function MailBookletScreen({ mode = 'page', currentPage = 1, dataLabel }) {
  return (
    <div data-screen-label={dataLabel} style={{
      width: '100%', height: '100%',
      background: 'var(--app-bg)',
      display: 'flex', flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
      paddingTop: 54,
    }}>
      <BookletNav eyebrow={BOOKLET.category} eyebrowColor={BOOKLET.accent} mode={mode} />

      <div style={{
        flex: 1,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '12px 16px 96px',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <BookletHero item={BOOKLET} />
          {mode === 'page' ? (
            <>
              <PageIndicator page={currentPage} total={PAGE_COUNT} />
              <PageViewer page={currentPage} />
              <OCRCard page={currentPage} />
              <BookletElf />
            </>
          ) : (
            <>
              <BookletElf />
              <PagesGrid currentPage={currentPage} />
            </>
          )}
          <BookletSender />
          <BookletActions saved={false} />
        </div>
      </div>

      <BottomTabBar active="mail" />
    </div>
  );
}

Object.assign(window, { MailBookletScreen });
