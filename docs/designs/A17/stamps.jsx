// MailStampsScreen — A17 archetype × Stamps variant.
// Slots beyond the archetype:
//   - Stamp "book" hero (featured perforated stamp + balance ring)
//   - The sheet: grid of stamps in this book (available vs postmarked)
//   - Other stamps you own — horizontal rail of varied designs/inks
//   - Usage history (which send consumed which stamp)
//   - Buy-more action bar
//   - Empty state ("No stamps yet") with a previewed starter book

// ── One-time CSS injection (perforation + postmark) ────────
if (typeof document !== 'undefined' && !document.getElementById('pp-stamp-styles')) {
  const s = document.createElement('style');
  s.id = 'pp-stamp-styles';
  s.textContent = [
    // Perforated postage edge. A solid ink rect with half-circle holes
    // punched along all four edges via four 1-D repeating radial masks
    // XOR-composited against a solid base. --ink sets the paper ink,
    // --pf the perforation radius, --gap the spacing between teeth.
    '.pp-stamp{',
    '  --pf:4.5px; --gap:12px;',
    '  position:relative; background:var(--ink);',
    '  -webkit-mask:',
    '    radial-gradient(circle var(--pf) at center,#000 calc(var(--pf) - 0.6px),#0000 var(--pf)) top center / var(--gap) calc(var(--pf)*2) repeat-x,',
    '    radial-gradient(circle var(--pf) at center,#000 calc(var(--pf) - 0.6px),#0000 var(--pf)) bottom center / var(--gap) calc(var(--pf)*2) repeat-x,',
    '    radial-gradient(circle var(--pf) at center,#000 calc(var(--pf) - 0.6px),#0000 var(--pf)) left center / calc(var(--pf)*2) var(--gap) repeat-y,',
    '    radial-gradient(circle var(--pf) at center,#000 calc(var(--pf) - 0.6px),#0000 var(--pf)) right center / calc(var(--pf)*2) var(--gap) repeat-y,',
    '    linear-gradient(#000 0 0);',
    '  -webkit-mask-composite: xor, xor, xor, xor;',
    '          mask:',
    '    radial-gradient(circle var(--pf) at center,#000 calc(var(--pf) - 0.6px),#0000 var(--pf)) top center / var(--gap) calc(var(--pf)*2) repeat-x,',
    '    radial-gradient(circle var(--pf) at center,#000 calc(var(--pf) - 0.6px),#0000 var(--pf)) bottom center / var(--gap) calc(var(--pf)*2) repeat-x,',
    '    radial-gradient(circle var(--pf) at center,#000 calc(var(--pf) - 0.6px),#0000 var(--pf)) left center / calc(var(--pf)*2) var(--gap) repeat-y,',
    '    radial-gradient(circle var(--pf) at center,#000 calc(var(--pf) - 0.6px),#0000 var(--pf)) right center / calc(var(--pf)*2) var(--gap) repeat-y,',
    '    linear-gradient(#000 0 0);',
    '  mask-composite: exclude, exclude, exclude, exclude;',
    '}',
    // hide scrollbars on the rails
    '.pp-rail::-webkit-scrollbar{display:none}',
  ].join('\n');
  document.head.appendChild(s);
}

// ── Data ───────────────────────────────────────────────────
const STAMP = {
  accent: '#0e7490',           // philatelic teal-cyan
  category: 'Stamps',
  trust: 'verified',
  time: 'Today',
};

const SENDER = {
  initials: 'PP',
  avatarBg: 'linear-gradient(135deg, #0e7490 0%, #155e75 100%)',
  name: 'Pantopus Post',
  dept: 'Official postage · Pantopus Network',
  kind: 'Verified issuer',
  proof: 'Postage authority',
};

const BOOK = {
  series: 'Local · Forever Series',
  ink: '#0e7490',
  total: 12,
  used: 4,                     // remaining = 8
  purchased: 'Apr 2, 2026',
  validity: 'Never expires',
};

// other designs in the wallet — varied inks + denominations
const WALLET = [
  { name: 'Express',     tag: 'Priority',    ink: '#be123c', qty: 3,  denom: '×3 speed' },
  { name: 'Civic',       tag: 'Certified',   ink: '#4338ca', qty: 5,  denom: 'Official' },
  { name: 'Spring Bloom',tag: 'Collectible', ink: '#4d7c0f', qty: 2,  denom: 'Limited' },
  { name: 'Business',    tag: 'Biz drawer',  ink: '#b45309', qty: 6,  denom: 'Receipts' },
];

const HISTORY = [
  { to: 'Elm Park HOA',              kind: 'Community RSVP',   date: 'May 26', stamp: 'Local',   ink: '#0e7490' },
  { to: 'City of Oakland · Planning',kind: 'Certified reply',  date: 'May 22', stamp: 'Civic',   ink: '#4338ca' },
  { to: 'Marisol Vega',              kind: 'Thank-you note',   date: 'May 19', stamp: 'Local',   ink: '#0e7490' },
  { to: 'Riverside Linen Supply',    kind: 'Invoice dispute',  date: 'May 14', stamp: 'Express', ink: '#be123c' },
];

const ELF = {
  headline: 'Pantopus checked your stamps',
  summary: 'You\'ve used 4 of 12 in this book — mostly neighbor mail. At about 2 sends a week you\'ll run low in roughly 4 weeks. Heads up: Express is down to 3.',
  bullets: [
    { icon: 'gauge',          label: '~2 stamps / week',       text: 'over the last 30 days' },
    { icon: 'hourglass',      label: '~4 weeks of postage',    text: 'left at this pace' },
    { icon: 'triangle-alert', label: 'Express low — 3 left',   text: 'used for priority sends' },
  ],
};

// ── Card shell ─────────────────────────────────────────────
function StCard({ children, style = {}, noPad = false }) {
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
    }}>{children}</div>
  );
}

function CardLabel({ children, right }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 12,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>{children}</div>
      {right}
    </div>
  );
}

// ── Top nav ────────────────────────────────────────────────
function StampsNav() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '6px 8px 8px 4px',
      background: 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--app-border-subtle)',
      gap: 4,
    }}>
      <button style={stNavBtn}>
        <i data-lucide="chevron-left" style={{ width: 22, height: 22 }}></i>
        <span style={{ fontSize: 15, fontWeight: 500, marginLeft: -2 }}>Mailbox</span>
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: STAMP.accent }}></span>
        <span style={{
          fontSize: 12, fontWeight: 700, color: 'var(--fg2)',
          letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>Stamps</span>
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        <button style={stNavIco}><i data-lucide="gift" style={{ width: 18, height: 18 }}></i></button>
        <button style={stNavIco}><i data-lucide="more-horizontal" style={{ width: 18, height: 18 }}></i></button>
      </div>
    </div>
  );
}
const stNavBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 2,
  border: 'none', background: 'transparent',
  color: 'var(--color-primary-600)', padding: '6px 6px', cursor: 'pointer',
  borderRadius: 8,
};
const stNavIco = {
  width: 34, height: 34, borderRadius: 9999,
  border: 'none', background: 'var(--app-surface-sunken)', color: 'var(--fg2)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
};

// ── A perforated postage stamp ─────────────────────────────
// `w`/`h` size the paper; `ink` is the engraved ink; children render the
// artwork. `used` overlays a cancellation postmark.
function Stamp({ ink, w, h, pf = 4.5, gap = 12, used = false, children, style = {} }) {
  return (
    <div className="pp-stamp" style={{
      '--ink': ink, '--pf': pf + 'px', '--gap': gap + 'px',
      width: w, height: h, flexShrink: 0,
      ...style,
    }}>
      {/* engraved double frame */}
      <div style={{
        position: 'absolute', inset: 7,
        border: '1px solid rgba(255,255,255,0.30)',
        borderRadius: 2,
        pointerEvents: 'none',
      }}></div>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        color: 'rgba(255,255,255,0.95)',
      }}>{children}</div>
      {used && <PostMark />}
    </div>
  );
}

// Featured stamp artwork (Local · Forever)
function ForeverArt({ small = false }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'space-between',
      padding: small ? '12px 6px 9px' : '15px 10px 12px',
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: small ? 6 : 7.5, fontWeight: 800,
        letterSpacing: '0.14em', opacity: 0.92,
      }}>PANTOPUS POST</div>

      {/* engraved emblem — concentric rings */}
      <div style={{ position: 'relative', width: small ? 30 : 42, height: small ? 30 : 42 }}>
        <span style={ring(small ? 30 : 42)}></span>
        <span style={ring(small ? 21 : 30)}></span>
        <span style={ring(small ? 12 : 17)}></span>
        <span style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          fontSize: small ? 9 : 13, fontWeight: 800,
          fontFamily: 'var(--font-serif)', letterSpacing: '0.02em',
        }}>P</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: small ? 1 : 2 }}>
        <div style={{
          fontSize: small ? 9 : 12.5, fontWeight: 800,
          letterSpacing: '0.10em', lineHeight: 1,
        }}>FOREVER</div>
        <div style={{
          fontSize: small ? 5.5 : 7, fontWeight: 700,
          letterSpacing: '0.18em', opacity: 0.8,
        }}>LOCAL · 1 SEND</div>
      </div>
    </div>
  );
}
const ring = (d) => ({
  position: 'absolute', top: '50%', left: '50%',
  width: d, height: d, marginTop: -d / 2, marginLeft: -d / 2,
  borderRadius: '50%', border: '1px solid rgba(255,255,255,0.45)',
});

// generic small artwork for wallet designs
function MiniArt({ name, tag }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 5px 8px', textAlign: 'center', color: 'rgba(255,255,255,0.95)',
    }}>
      <div style={{ fontSize: 5.5, fontWeight: 800, letterSpacing: '0.12em', opacity: 0.85 }}>PANTOPUS POST</div>
      <div style={{ position: 'relative', width: 26, height: 26 }}>
        <span style={ring(26)}></span>
        <span style={ring(15)}></span>
      </div>
      <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.04em', lineHeight: 1 }}>{name}</div>
    </div>
  );
}

// cancellation postmark over a used stamp
function PostMark() {
  return (
    <div style={{
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%,-50%) rotate(-14deg)',
      width: '78%', height: '60%', maxWidth: 80,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: 0.55, pointerEvents: 'none',
    }}>
      <svg viewBox="0 0 90 70" width="100%" height="100%" fill="none" stroke="#fff" strokeWidth="2">
        <circle cx="45" cy="35" r="22"></circle>
        <circle cx="45" cy="35" r="16"></circle>
        {[20, 26, 32, 38].map((y, i) => (
          <path key={i} d={`M2 ${y} q11 -5 22 0 t22 0 t22 0 t22 0`} strokeWidth="1.6" style={{ opacity: 0.9 }}></path>
        ))}
        <text x="45" y="33" fontSize="6.5" fill="#fff" stroke="none" textAnchor="middle" fontWeight="700" letterSpacing="0.5">PANTOPUS</text>
        <text x="45" y="42" fontSize="5.5" fill="#fff" stroke="none" textAnchor="middle" letterSpacing="0.5">USED</text>
      </svg>
    </div>
  );
}

// ── Hero: book balance ─────────────────────────────────────
function BookHero() {
  const remaining = BOOK.total - BOOK.used;
  const pct = remaining / BOOK.total;
  const R = 30, C = 2 * Math.PI * R;
  return (
    <StCard style={{ overflow: 'visible' }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        {/* featured stamp */}
        <Stamp ink={BOOK.ink} w={104} h={132} pf={4.5} gap={12}
          style={{ boxShadow: '0 6px 16px rgba(14,116,144,0.28)' }}>
          <ForeverArt />
        </Stamp>

        {/* balance */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>{BOOK.series}</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
            {/* ring */}
            <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
              <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="36" cy="36" r={R} fill="none" stroke="var(--app-surface-sunken)" strokeWidth="8"></circle>
                <circle cx="36" cy="36" r={R} fill="none" stroke={STAMP.accent} strokeWidth="8"
                  strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)}></circle>
              </svg>
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--fg1)', letterSpacing: '-0.02em', lineHeight: 1 }}>{remaining}</span>
                <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--fg3)', marginTop: 1 }}>of {BOOK.total}</span>
              </div>
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg1)', letterSpacing: '-0.01em' }}>
                {remaining} stamps left
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 2, lineHeight: 1.4 }}>
                {BOOK.used} used since {BOOK.purchased}
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8,
                fontSize: 10.5, fontWeight: 700, color: '#047857',
                background: 'var(--color-success-bg)', padding: '3px 8px', borderRadius: 9999,
              }}>
                <i data-lucide="infinity" style={{ width: 12, height: 12 }}></i>
                {BOOK.validity}
              </div>
            </div>
          </div>
        </div>
      </div>
    </StCard>
  );
}

// ── The sheet ──────────────────────────────────────────────
function Sheet() {
  // 12 stamps, first BOOK.used postmarked
  const cells = Array.from({ length: BOOK.total }, (_, i) => i < BOOK.used);
  return (
    <StCard>
      <CardLabel right={
        <span style={{
          fontSize: 10.5, fontWeight: 700, color: 'var(--fg3)',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: 2, background: STAMP.accent }}></span>
          {BOOK.total - BOOK.used} available
          <span style={{ width: 7, height: 7, borderRadius: 2, background: 'var(--app-text-muted)', marginLeft: 6 }}></span>
          {BOOK.used} used
        </span>
      }>In this book</CardLabel>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
        background: 'var(--app-surface-sunken)',
        borderRadius: 12, padding: 10,
      }}>
        {cells.map((used, i) => (
          <Stamp key={i} ink={used ? '#94a3b8' : BOOK.ink} w="100%" h={68} pf={3} gap={9} used={used}
            style={used ? { opacity: 0.85 } : {}}>
            <ForeverArt small />
          </Stamp>
        ))}
      </div>
    </StCard>
  );
}

// ── Other stamps rail ──────────────────────────────────────
function WalletRail() {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        padding: '0 2px 8px',
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg1)', letterSpacing: '-0.005em' }}>
            Other stamps you own
          </div>
          <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 1 }}>16 stamps across 4 designs</div>
        </div>
        <button style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--color-primary-600)', fontSize: 11, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', gap: 3, padding: 0,
        }}>
          Collection
          <i data-lucide="chevron-right" style={{ width: 12, height: 12 }}></i>
        </button>
      </div>
      <div className="pp-rail" style={{
        display: 'flex', gap: 10, overflowX: 'auto',
        margin: '0 -16px', padding: '2px 16px 4px', scrollbarWidth: 'none',
      }}>
        {WALLET.map((d, i) => <WalletTile key={i} d={d} />)}
      </div>
    </div>
  );
}

function WalletTile({ d }) {
  return (
    <div style={{
      flexShrink: 0, width: 124,
      background: '#fff', border: '1px solid var(--app-border)',
      borderRadius: 14, overflow: 'hidden',
      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '12px 12px 4px', display: 'flex', justifyContent: 'center' }}>
        <Stamp ink={d.ink} w={74} h={94} pf={4} gap={11}>
          <MiniArt name={d.name} tag={d.tag} />
        </Stamp>
      </div>
      <div style={{ padding: '8px 12px 11px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg1)', letterSpacing: '-0.01em' }}>{d.name}</span>
          <span style={{
            fontSize: 11, fontWeight: 800, color: d.ink,
            background: d.ink + '14', padding: '1px 7px', borderRadius: 9999,
          }}>{d.qty}</span>
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--fg3)', marginTop: 2 }}>{d.tag} · {d.denom}</div>
      </div>
    </div>
  );
}

// ── Usage history ──────────────────────────────────────────
function UsageHistory() {
  return (
    <StCard noPad>
      <div style={{ padding: '12px 14px 4px' }}>
        <CardLabel right={
          <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--fg3)' }}>Last 30 days</span>
        }>Usage history</CardLabel>
      </div>
      <div>
        {HISTORY.map((h, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 14px',
            borderTop: i === 0 ? '1px solid var(--app-border-subtle)' : 'none',
            borderBottom: i < HISTORY.length - 1 ? '1px solid var(--app-border-subtle)' : 'none',
          }}>
            {/* tiny stamp chit */}
            <div className="pp-stamp" style={{
              '--ink': h.ink, '--pf': '2px', '--gap': '7px',
              width: 26, height: 32, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                position: 'absolute', inset: 3,
                border: '0.5px solid rgba(255,255,255,0.4)', borderRadius: 1,
              }}></span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: 'var(--fg1)', letterSpacing: '-0.005em',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{h.to}</div>
              <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 1 }}>
                {h.kind} · <span style={{ color: 'var(--fg2)', fontWeight: 600 }}>{h.stamp}</span> stamp
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg3)', fontWeight: 500, flexShrink: 0 }}>{h.date}</div>
          </div>
        ))}
      </div>
      <button style={{
        width: '100%', padding: '11px 14px',
        background: 'transparent', border: 'none', borderTop: '1px solid var(--app-border-subtle)',
        color: 'var(--color-primary-600)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
      }}>
        See all sends
        <i data-lucide="chevron-right" style={{ width: 13, height: 13 }}></i>
      </button>
    </StCard>
  );
}

// ── AI elf ─────────────────────────────────────────────────
function StampsElf({ data }) {
  return (
    <div style={{
      background: 'linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 100%)',
      border: '1px solid #bae6fd', borderRadius: 16, padding: '12px 14px 14px',
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
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', flex: 1, letterSpacing: '-0.005em' }}>
          {data.headline}
        </div>
      </div>
      <div style={{ fontSize: 13, color: '#0c4a6e', lineHeight: 1.5, marginBottom: 10, textWrap: 'pretty' }}>
        {data.summary}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.bullets.map((b, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            fontSize: 12, lineHeight: 1.45, color: 'var(--fg1)',
          }}>
            <div style={{
              width: 16, height: 16, borderRadius: 4,
              background: '#fff', color: 'var(--color-primary-700)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, marginTop: 1, border: '1px solid #bae6fd',
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

// ── Sender / issuer card ───────────────────────────────────
function IssuerCard() {
  return (
    <StCard>
      <CardLabel>From</CardLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: SENDER.avatarBg, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, flexShrink: 0, letterSpacing: '0.02em', position: 'relative',
        }}>
          {SENDER.initials}
          <span style={{
            position: 'absolute', right: -3, bottom: -3,
            width: 16, height: 16, borderRadius: '50%',
            background: 'var(--color-success)', color: '#fff', border: '2px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i data-lucide="check" style={{ width: 9, height: 9 }}></i>
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg1)' }}>{SENDER.name}</div>
          <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 1 }}>{SENDER.dept}</div>
          <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 9999,
              background: '#cffafe', color: '#0e7490',
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              <i data-lucide="stamp" style={{ width: 9, height: 9 }}></i>
              {SENDER.kind}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 9999,
              background: 'var(--color-success-bg)', color: '#047857',
            }}>{SENDER.proof}</span>
          </div>
        </div>
        <i data-lucide="chevron-right" style={{ width: 16, height: 16, color: 'var(--fg4)' }}></i>
      </div>
    </StCard>
  );
}

// ── Action bar ─────────────────────────────────────────────
function StampsActions() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button style={{
        width: '100%', padding: '14px 16px',
        background: 'var(--color-primary-600)', color: '#fff', border: 'none',
        borderRadius: 14, fontSize: 15, fontWeight: 700, letterSpacing: '-0.005em',
        boxShadow: 'var(--shadow-primary)', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <i data-lucide="plus" style={{ width: 16, height: 16 }}></i>
        Buy more stamps
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        <StChip icon="repeat" label="Auto-refill" />
        <StChip icon="gift" label="Gift" />
        <StChip icon="send" label="Send mail" />
        <StChip icon="archive" label="Archive" />
      </div>
    </div>
  );
}
function StChip({ icon, label }) {
  return (
    <button style={{
      background: '#fff', border: '1px solid var(--app-border)', borderRadius: 12,
      padding: '10px 4px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      color: 'var(--fg2)', cursor: 'pointer', fontSize: 10.5, fontWeight: 600,
    }}>
      <i data-lucide={icon} style={{ width: 17, height: 17 }}></i>
      {label}
    </button>
  );
}

// ── Empty state ────────────────────────────────────────────
function EmptyStamps() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center', paddingTop: 28,
      }}>
        {/* previewed stamp, faded */}
        <div style={{ position: 'relative', marginBottom: 22 }}>
          <Stamp ink={BOOK.ink} w={108} h={138} pf={4.5} gap={12}
            style={{ boxShadow: '0 10px 28px rgba(14,116,144,0.22)' }}>
            <ForeverArt />
          </Stamp>
          <div style={{
            position: 'absolute', right: -10, bottom: -8,
            width: 34, height: 34, borderRadius: '50%',
            background: '#fff', border: '1px solid var(--app-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-md)', color: 'var(--fg4)',
          }}>
            <i data-lucide="plus" style={{ width: 18, height: 18 }}></i>
          </div>
        </div>

        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.015em', color: 'var(--fg1)', marginBottom: 6 }}>
          No stamps yet
        </div>
        <div style={{ fontSize: 13, color: 'var(--fg3)', lineHeight: 1.5, maxWidth: 280, marginBottom: 20 }}>
          You'll need a stamp to send mail to a neighbor. Pick up a book and your postage lands here.
        </div>

        <button style={{
          background: 'var(--color-primary-600)', color: '#fff', border: 'none',
          padding: '12px 22px', borderRadius: 12, fontSize: 14, fontWeight: 700,
          letterSpacing: '-0.005em', boxShadow: 'var(--shadow-primary)',
          display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}>
          Buy stamps
          <i data-lucide="arrow-right" style={{ width: 15, height: 15 }}></i>
        </button>
      </div>

      {/* starter book offer */}
      <StCard noPad>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14 }}>
          <Stamp ink={BOOK.ink} w={58} h={74} pf={3} gap={9}>
            <ForeverArt small />
          </Stamp>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg1)', letterSpacing: '-0.005em' }}>
              Starter book
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--fg3)', marginTop: 2, lineHeight: 1.45 }}>
              12 Local Forever stamps · never expire
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--fg1)', letterSpacing: '-0.01em' }}>$4.80</div>
            <button style={{
              marginTop: 4, padding: '5px 12px', borderRadius: 9999,
              background: STAMP.accent, color: '#fff', border: 'none',
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}>Get book</button>
          </div>
        </div>
      </StCard>

      {/* how it works */}
      <div style={{
        background: '#fff', border: '1px solid var(--app-border)', borderRadius: 14,
        padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <div style={{
          width: 28, height: 28, flexShrink: 0, borderRadius: 8,
          background: 'var(--color-info-bg)', color: 'var(--color-primary-700)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i data-lucide="info" style={{ width: 15, height: 15 }}></i>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg1)', marginBottom: 2 }}>
            One stamp per send
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--fg3)', lineHeight: 1.5 }}>
            Replies to mail you receive are always free. Stamps are only spent when you start a new
            thread with a neighbor or business.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Screen ─────────────────────────────────────────────────
function MailStampsScreen({ state = 'populated', dataLabel }) {
  const empty = state === 'empty';
  return (
    <div data-screen-label={dataLabel} style={{
      width: '100%', height: '100%',
      background: 'var(--app-bg)',
      display: 'flex', flexDirection: 'column',
      position: 'relative', overflow: 'hidden',
      paddingTop: 54,
    }}>
      <StampsNav />

      <div style={{
        flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        padding: '12px 16px 96px',
      }}>
        {empty ? (
          <EmptyStamps />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* received-item header — same vocab as other A17 variants */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 2px' }}>
              <TrustChip kind={STAMP.trust} />
              <CategoryChip label={STAMP.category} color={STAMP.accent} />
              <span style={{ flex: 1 }}></span>
              <span style={{ fontSize: 11, color: 'var(--fg3)', fontWeight: 500 }}>{STAMP.time}</span>
            </div>

            <BookHero />
            <StampsElf data={ELF} />
            <Sheet />
            <WalletRail />
            <UsageHistory />
            <IssuerCard />
            <StampsActions />
          </div>
        )}
      </div>

      <BottomTabBar active="mail" />
    </div>
  );
}

Object.assign(window, { MailStampsScreen });
