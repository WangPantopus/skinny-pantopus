// ─────────────────────────────────────────────────────────────
// Place — shared product-UI components
// Pantopus Design System. Home-green accent (#16A34A), sky CTAs.
// ─────────────────────────────────────────────────────────────

const HOME_GREEN = '#16A34A';
const HOME_GREEN_BG = '#DCFCE7';
const SKY = '#0284C7';
const INK = '#111827';
const INK2 = '#374151';
const MUTE = '#6b7280';
const FAINT = '#9ca3af';
const BORDER = '#e5e7eb';

// ── Lucide icon (renders one SVG per instance, size-safe) ──────
function Icon({ name, size = 20, color = 'currentColor', strokeWidth = 2, style = {} }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || !window.lucide) return;
    const pascal = name.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('');
    const node = (window.lucide.icons && window.lucide.icons[pascal]) || window.lucide[pascal];
    el.innerHTML = '';
    if (node) {
      const svg = window.lucide.createElement(node);
      svg.setAttribute('width', size);
      svg.setAttribute('height', size);
      svg.setAttribute('stroke', color);
      svg.setAttribute('stroke-width', strokeWidth);
      svg.style.display = 'block';
      el.appendChild(svg);
    }
  }, [name, size, color, strokeWidth]);
  return (
    <span ref={ref} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, color, flexShrink: 0, ...style }} />
  );
}

// ── Section icon tile ──────────────────────────────────────────
function IconTile({ name, tone = 'home', size = 34 }) {
  const map = {
    home: { bg: HOME_GREEN_BG, fg: HOME_GREEN },
    muted: { bg: '#f1f3f5', fg: FAINT },
    sky: { bg: '#E0F2FE', fg: SKY },
  };
  const c = map[tone] || map.home;
  return (
    <div style={{ width: size, height: size, borderRadius: 9, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon name={name} size={Math.round(size * 0.56)} color={c.fg} strokeWidth={2} />
    </div>
  );
}

// ── Chevron ────────────────────────────────────────────────────
function Chevron() {
  return <Icon name="chevron-right" size={18} color="#c4c8cf" strokeWidth={2.25} />;
}

// ── Semantic chip ──────────────────────────────────────────────
function Chip({ children, tone = 'neutral', icon }) {
  const tones = {
    success: { bg: '#F0FDF4', fg: '#15803d', bd: '#bbf7d0' },
    warning: { bg: '#FFFBEB', fg: '#b45309', bd: '#fde68a' },
    error: { bg: '#FEF2F2', fg: '#b91c1c', bd: '#fecaca' },
    sky: { bg: '#F0F9FF', fg: '#0369a1', bd: '#bae6fd' },
    neutral: { bg: '#f3f4f6', fg: '#4b5563', bd: '#e5e7eb' },
  };
  const c = tones[tone] || tones.neutral;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: icon ? '3px 9px 3px 7px' : '3px 9px', borderRadius: 9999, fontSize: 12, fontWeight: 600, lineHeight: '16px', background: c.bg, color: c.fg, border: `1px solid ${c.bd}`, whiteSpace: 'nowrap' }}>
      {icon && <Icon name={icon} size={13} color={c.fg} strokeWidth={2.25} />}
      {children}
    </span>
  );
}

// ── Verified avatar ────────────────────────────────────────────
function Avatar({ initials = 'RC', size = 38 }) {
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#22c55e,#15803d)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.34, letterSpacing: 0.2 }}>{initials}</div>
      <div style={{ position: 'absolute', right: -2, bottom: -2, width: size * 0.42, height: size * 0.42, background: HOME_GREEN, borderRadius: '50%', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="check" size={size * 0.24} color="#fff" strokeWidth={3.25} />
      </div>
    </div>
  );
}

// ── Sky text button (verbs-first CTA) ──────────────────────────
function TextButton({ children, onClick, arrow = true }) {
  return (
    <button onClick={onClick} className="pl-textbtn" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: SKY, fontWeight: 600, fontSize: 14, fontFamily: 'inherit', lineHeight: '20px' }}>
      {children}
      {arrow && <Icon name="arrow-right" size={15} color={SKY} strokeWidth={2.25} />}
    </button>
  );
}

// ── Shimmer skeleton primitive ─────────────────────────────────
function Skel({ w = '100%', h = 12, r = 6, style = {} }) {
  return <div className="pl-skel" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

// ─────────────────────────────────────────────────────────────
// THE SECTION-CARD ATOM
// states: loaded | empty | unavailable | stale | error | loading
// ─────────────────────────────────────────────────────────────
function SectionCard({
  icon = 'wind',
  title = 'Air quality',
  asOf,
  state = 'loaded',
  value,
  caption,
  chip,        // { tone, text, icon }
  sparkline,   // bool
  action,      // { label } -> renders as the value, sky tap-through
  onAction,
  onRetry,
  onRefresh,
  compact = false,
}) {
  const loading = state === 'loading';
  const locked = false;
  const tone = state === 'unavailable' || state === 'empty' ? 'muted' : 'home';

  let body;
  if (state === 'loading') {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, paddingTop: 2 }}>
        <Skel w="62%" h={15} />
        <Skel w="84%" h={12} />
      </div>
    );
  } else if (state === 'empty') {
    body = (
      <div>
        <div style={{ fontSize: 15, fontWeight: 500, color: MUTE }}>Nothing here yet</div>
        <div style={{ fontSize: 13, color: FAINT, marginTop: 3 }}>{caption || "We'll show readings once a sensor reports near you."}</div>
      </div>
    );
  } else if (state === 'unavailable') {
    body = (
      <div>
        <div style={{ fontSize: 15, fontWeight: 500, color: MUTE }}>Not available for your area yet.</div>
        <div style={{ fontSize: 13, color: FAINT, marginTop: 3 }}>{caption || 'Coverage is expanding. Check back later.'}</div>
      </div>
    );
  } else if (state === 'error') {
    body = (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Icon name="cloud-off" size={16} color={MUTE} strokeWidth={2} />
          <span style={{ fontSize: 15, fontWeight: 500, color: INK2 }}>Couldn't load this</span>
        </div>
        <div style={{ marginTop: 8 }}>
          <TextButton arrow={false} onClick={onRetry}>Try again</TextButton>
        </div>
      </div>
    );
  } else {
    // loaded / stale
    body = (
      <div>
        <div style={{ display: 'flex', alignItems: sparkline ? 'flex-end' : 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {action ? (
              <TextButton onClick={onAction}>{action.label}</TextButton>
            ) : (
              <div style={{ fontSize: 15, fontWeight: 500, color: INK, lineHeight: '21px' }}>{value}</div>
            )}
            {chip && (
              <div style={{ marginTop: 8 }}>
                <Chip tone={chip.tone} icon={chip.icon}>{chip.text}</Chip>
              </div>
            )}
            {caption && <div style={{ fontSize: 12.5, color: FAINT, marginTop: 6 }}>{caption}</div>}
          </div>
          {sparkline && <Sparkline />}
        </div>
      </div>
    );
  }

  return (
    <div className="pl-card" style={{ padding: compact ? 14 : 16 }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: loading || state === 'error' ? 12 : 11 }}>
        <IconTile name={icon} tone={tone} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: INK, letterSpacing: '-0.01em' }}>{title}</div>
        </div>
        {asOf && state !== 'loading' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: state === 'stale' ? '#9a7b2e' : FAINT, fontSize: 12 }}>
            {state === 'stale' && <Icon name="refresh-cw" size={13} color="#b08a2e" strokeWidth={2} />}
            <span style={{ whiteSpace: 'nowrap' }}>{asOf}</span>
          </div>
        )}
        {!loading && <Chevron />}
      </div>
      {body}
    </div>
  );
}

// ── Value sparkline (qualitative, home-value trend) ────────────
function Sparkline() {
  const pts = '0,26 14,24 28,25 42,20 56,21 70,15 84,13 98,8 112,9 126,4';
  return (
    <svg width="118" height="34" viewBox="0 0 126 30" style={{ flexShrink: 0, overflow: 'visible' }}>
      <defs>
        <linearGradient id="spkfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={HOME_GREEN} stopOpacity="0.16" />
          <stop offset="100%" stopColor={HOME_GREEN} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,30 ${pts} 126,30`} fill="url(#spkfill)" />
      <polyline points={pts} fill="none" stroke={HOME_GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="126" cy="4" r="2.6" fill={HOME_GREEN} />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// LOCKED CARD — tier-gated content
// ─────────────────────────────────────────────────────────────
function LockedCard({ icon = 'home', title, reason, cta, onClick }) {
  return (
    <div className="pl-card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 11 }}>
        <IconTile name={icon} tone="muted" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: INK2, letterSpacing: '-0.01em' }}>{title}</div>
        </div>
        <Icon name="lock" size={16} color={FAINT} strokeWidth={2} />
      </div>
      <div style={{ fontSize: 14, color: MUTE, lineHeight: '20px', marginBottom: 10 }}>{reason}</div>
      <TextButton onClick={onClick}>{cta}</TextButton>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DENSITY BUCKET CARD — bucket text only, never a number
// ─────────────────────────────────────────────────────────────
const DENSITY_BUCKETS = {
  forming: { label: 'Your block is starting to form', dots: 1 },
  few: { label: 'A few verified homes nearby', dots: 2 },
  growing: { label: 'Growing activity near this area', dots: 3 },
  none: { label: 'No activity shown yet', dots: 0 },
};
function DensityCard({ bucket = 'few', onClick }) {
  const b = DENSITY_BUCKETS[bucket] || DENSITY_BUCKETS.few;
  return (
    <div className="pl-card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 11 }}>
        <IconTile name="users" tone={b.dots === 0 ? 'muted' : 'home'} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: INK, letterSpacing: '-0.01em' }}>Verified homes nearby</div>
        </div>
        <Chevron />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
        <DensityDots level={b.dots} />
        <span style={{ fontSize: 15, fontWeight: 500, color: b.dots === 0 ? MUTE : INK }}>{b.label}</span>
      </div>
      <TextButton onClick={onClick}>Be one of the first to verify on your block</TextButton>
    </div>
  );
}
function DensityDots({ level = 2 }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: i < level ? HOME_GREEN : '#e2e6ea' }} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HERO — "Today's Pulse"  (allclear | alert)
// ─────────────────────────────────────────────────────────────
function HeroCard({ variant = 'allclear' }) {
  const alert = variant === 'alert';
  return (
    <div className="pl-card pl-hero" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: MUTE }}>Today's pulse</span>
        {alert
          ? <Chip tone="warning" icon="wind">Air quality</Chip>
          : <Chip tone="success" icon="check">All clear</Chip>}
      </div>

      <div style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: alert ? '#FFFBEB' : HOME_GREEN_BG, border: `1px solid ${alert ? '#fde68a' : '#bbf7d0'}` }}>
          <Icon name={alert ? 'wind' : 'shield-check'} size={21} color={alert ? '#b45309' : HOME_GREEN} strokeWidth={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: INK, lineHeight: '23px', letterSpacing: '-0.01em' }}>
            {alert
              ? 'Air quality is unhealthy for sensitive groups right now (112).'
              : "All clear on your block today. Air is good and there are no active alerts."}
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: BORDER, margin: '14px 0 12px' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon name={alert ? 'clock' : 'lightbulb'} size={17} color={MUTE} strokeWidth={2} />
        <div style={{ flex: 1, fontSize: 13.5, color: INK2, lineHeight: '19px' }}>
          {alert
            ? 'Limit time outdoors this afternoon. It should clear by evening.'
            : 'A heat-pump rebate may apply to your home. Worth a look.'}
        </div>
        <Icon name="chevron-right" size={17} color="#c4c8cf" strokeWidth={2.25} />
      </div>
    </div>
  );
}

// ── Group label (overline) ─────────────────────────────────────
function GroupLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: FAINT, padding: '0 2px', marginBottom: 9 }}>{children}</div>
  );
}

Object.assign(window, {
  Icon, IconTile, Chevron, Chip, Avatar, TextButton, Skel,
  SectionCard, Sparkline, LockedCard, DensityCard, DensityDots,
  HeroCard, GroupLabel,
  HOME_GREEN, SKY, INK, INK2, MUTE, FAINT, BORDER,
});
