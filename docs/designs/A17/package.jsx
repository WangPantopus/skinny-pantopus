// MailPackageScreen — A17 archetype × Package variant.
// Pantopus-specific: the courier ("Delivered") confirms arrival;
// the *neighbor* ("Logged as received") confirms it's actually in hand.
// Slots beyond the archetype:
//   - Courier mark + tracking # row (tap to copy)
//   - Big status hero (delivered / out for delivery / etc.)
//   - Delivery photo with timestamp watermark (when delivered)
//   - Stop-by-stop timeline
//   - Package contents (vendor, item summary)
//   - Primary action: "Log as received" (or "Notify me" pre-delivery)

// ── Data ───────────────────────────────────────────────────
const PKG = {
  accent: '#2563EB',                   // courier/postal blue
  category: 'Package',
  time: '12m ago',
  vendor: 'Lerina Books · Portland, OR',
  title: 'Package on your porch · USPS Priority Mail',
  titleTransit: 'Out for delivery — expected by 3 PM today',
  reference: 'USPS · weight 2.4 lb · 12×9×4 in',
  trackingNumber: '9505 5125 8841 6014 2203 17',
};

const TIMELINE_FULL = [
  { label: 'Delivered to front porch',     where: 'Oakland, CA · 1428 Elm St', when: 'Mon May 18 · 1:47 PM', icon: 'home',         active: true },
  { label: 'Out for delivery',              where: 'Oakland Branch · Route 22', when: 'Mon May 18 · 8:12 AM', icon: 'truck',        done: true },
  { label: 'Arrived at local facility',     where: 'Oakland, CA',               when: 'Mon May 18 · 5:03 AM', icon: 'building-2',   done: true },
  { label: 'In transit',                    where: 'Sacramento, CA',            when: 'Sat May 16 · 11:40 PM', icon: 'arrow-right', done: true },
  { label: 'Picked up by courier',          where: 'Portland, OR',              when: 'Thu May 14 · 4:21 PM', icon: 'package-2',    done: true },
  { label: 'Label created · Lerina Books',  where: 'Portland, OR',              when: 'Wed May 13 · 10:02 AM', icon: 'tag',         done: true },
];

const TIMELINE_TRANSIT = [
  { label: 'Delivered to front porch',     where: 'pending',                    when: 'Expected today · by 3 PM', icon: 'home',     pending: true },
  { label: 'Out for delivery',              where: 'Oakland Branch · Route 22', when: 'Mon May 18 · 8:12 AM',     icon: 'truck',    active: true },
  { label: 'Arrived at local facility',     where: 'Oakland, CA',               when: 'Mon May 18 · 5:03 AM',     icon: 'building-2', done: true },
  { label: 'In transit',                    where: 'Sacramento, CA',            when: 'Sat May 16 · 11:40 PM',    icon: 'arrow-right', done: true },
  { label: 'Picked up by courier',          where: 'Portland, OR',              when: 'Thu May 14 · 4:21 PM',     icon: 'package-2', done: true },
  { label: 'Label created · Lerina Books',  where: 'Portland, OR',              when: 'Wed May 13 · 10:02 AM',    icon: 'tag',      done: true },
];

const CONTENTS = {
  itemTitle: 'Lerina Books · order #LB-44218',
  items: [
    { qty: 1, name: 'Italo Calvino — Invisible Cities',  meta: 'paperback' },
    { qty: 1, name: 'Annie Dillard — Pilgrim at Tinker Creek', meta: 'paperback' },
  ],
  subtotal: '$28.40',
  ship:     '$5.20',
  total:    '$33.60',
};

const ELF_DELIVERED = {
  headline: 'On your porch, photo looks right',
  summary:  'USPS scanned this at the porch at 1:47 PM and snapped the photo below. The label matches your verified address and the box is sitting in your normal drop spot.',
  bullets: [
    { icon: 'camera',       label: 'Photo matches your porch', text: 'same angle as 7 prior deliveries' },
    { icon: 'map-pin',      label: 'Delivered to 1428 Elm St',  text: 'your verified address' },
    { icon: 'cloud-rain',   label: 'No rain in the forecast',   text: 'safe to grab after work' },
  ],
};

const ELF_TRANSIT = {
  headline: "Pantopus is watching this for you",
  summary:  'Out for delivery on Route 22, currently 6 stops away. USPS Priority typically lands here between 1 and 3 PM. You\'ll get a push the moment it scans delivered.',
  bullets: [
    { icon: 'truck',         label: 'On the truck, ~6 stops away', text: 'ETA window 1:00 – 3:00 PM' },
    { icon: 'bell',          label: 'Push on delivery is ON',      text: 'Pantopus + USPS scan' },
    { icon: 'shield-check',  label: 'No signature required',       text: 'will be left on porch' },
  ],
};

// ── Card shell ────────────────────────────────────────────
function PkCard({ children, accent, style = {}, noPad = false }) {
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

// ── Top nav ────────────────────────────────────────────────
function PkNav() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '6px 8px 8px 4px',
      background: 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--app-border-subtle)',
      gap: 4,
    }}>
      <button style={pkNavBtn}>
        <i data-lucide="chevron-left" style={{ width: 22, height: 22 }}></i>
        <span style={{ fontSize: 15, fontWeight: 500, marginLeft: -2 }}>Mailbox</span>
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: PKG.accent }}></span>
        <span style={{
          fontSize: 12, fontWeight: 700, color: 'var(--fg2)',
          letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>{PKG.category}</span>
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        <button style={pkNavIco}><i data-lucide="bookmark" style={{ width: 18, height: 18 }}></i></button>
        <button style={pkNavIco}><i data-lucide="more-horizontal" style={{ width: 18, height: 18 }}></i></button>
      </div>
    </div>
  );
}
const pkNavBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 2,
  border: 'none', background: 'transparent',
  color: 'var(--color-primary-600)',
  padding: '6px 6px', cursor: 'pointer', borderRadius: 8,
};
const pkNavIco = {
  width: 34, height: 34, borderRadius: 9999,
  border: 'none', background: 'var(--app-surface-sunken)',
  color: 'var(--fg2)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
};

// ── Stylized courier mark (USPS Priority — stamp-frame SVG) ─
function CourierMark({ size = 44 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 10, flexShrink: 0,
      background: '#0A2E60',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
      boxShadow: '0 2px 6px rgba(10,46,96,0.25)',
    }}>
      {/* red stripe — Priority Mail vibe */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: '52%',
        height: 3, background: '#D8232A',
      }}></div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontWeight: 800, fontSize: 11, color: '#fff',
        letterSpacing: '0.06em', lineHeight: 1,
        textAlign: 'center', position: 'relative',
      }}>
        <div>USPS</div>
        <div style={{ fontSize: 6.5, marginTop: 6, opacity: 0.85, letterSpacing: '0.12em' }}>PRIORITY</div>
      </div>
    </div>
  );
}

// ── Envelope-meta hero ────────────────────────────────────
function PkHero({ delivered }) {
  return (
    <PkCard accent={PKG.accent}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <TrustChip kind="verified" />
        <CategoryChip label={delivered ? 'Delivered' : 'Out for delivery'} color={PKG.accent} />
        <span style={{ flex: 1 }}></span>
        <span style={{ fontSize: 11, color: 'var(--fg3)', fontWeight: 500 }}>{PKG.time}</span>
      </div>
      <div style={{
        fontSize: 11, fontWeight: 600, color: 'var(--fg3)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
      }}>From {PKG.vendor}</div>
      <div style={{
        fontSize: 19, fontWeight: 700, color: 'var(--fg1)',
        lineHeight: 1.25, letterSpacing: '-0.015em',
        textWrap: 'pretty',
      }}>{delivered ? PKG.title : PKG.titleTransit}</div>
      <div style={{
        fontSize: 11, color: 'var(--fg3)', marginTop: 6,
        fontFamily: 'var(--font-mono)',
      }}>{PKG.reference}</div>
    </PkCard>
  );
}

// ── Status hero — courier + tracking # row + state banner ──
function StatusHero({ delivered, logged }) {
  return (
    <div style={{
      borderRadius: 16,
      overflow: 'hidden',
      border: '1px solid var(--app-border)',
      background: '#fff',
      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
    }}>
      {/* Top row: courier + tracking + copy */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px 12px',
        borderBottom: '1px solid var(--app-border-subtle)',
      }}>
        <CourierMark />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>USPS Priority Mail · Tracking #</div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 13, fontWeight: 700, color: 'var(--fg1)',
            letterSpacing: '-0.005em', marginTop: 2,
            wordBreak: 'break-all',
          }}>{PKG.trackingNumber}</div>
        </div>
        <button title="Copy tracking number" style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'var(--app-surface-sunken)',
          border: '1px solid var(--app-border)',
          color: 'var(--fg2)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', flexShrink: 0,
        }}>
          <i data-lucide="copy" style={{ width: 15, height: 15 }}></i>
        </button>
      </div>

      {/* Status banner */}
      {delivered ? (
        <div style={{
          padding: '14px 16px 16px',
          background: 'linear-gradient(180deg, #ecfdf5 0%, #f0fdf4 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: 'var(--color-success)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(5,150,105,0.3)',
            }}>
              <i data-lucide="check" style={{ width: 14, height: 14 }}></i>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#065f46', letterSpacing: '-0.01em' }}>
                {logged ? 'Logged as received' : 'Delivered to your porch'}
              </div>
              <div style={{ fontSize: 12, color: '#047857', marginTop: 1 }}>
                {logged ? 'Today · 2:30 PM by you' : 'Today · 1:47 PM · front porch · left in shade'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          padding: '14px 16px 16px',
          background: 'linear-gradient(180deg, #eff6ff 0%, #f0f9ff 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 8,
              background: PKG.accent, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <i data-lucide="truck" style={{ width: 14, height: 14 }}></i>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#1e3a8a', letterSpacing: '-0.005em' }}>
                Out for delivery · Route 22
              </div>
              <div style={{ fontSize: 12, color: '#1e40af', marginTop: 1 }}>
                ETA window 1:00 – 3:00 PM · ~6 stops away
              </div>
            </div>
          </div>

          {/* mini ETA progress bar */}
          <div style={{
            marginTop: 12,
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 10, fontWeight: 700, color: '#1e40af',
            letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>
            <span>Branch</span>
            <div style={{
              flex: 1, height: 5, borderRadius: 9999,
              background: '#dbeafe', overflow: 'hidden', position: 'relative',
            }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: '68%', background: PKG.accent, borderRadius: 9999,
              }}></div>
              <div style={{
                position: 'absolute', left: '68%', top: -3, width: 11, height: 11,
                background: '#fff', borderRadius: '50%',
                border: `2px solid ${PKG.accent}`,
                transform: 'translateX(-5px)',
              }}></div>
            </div>
            <span>Porch</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Delivery photo (security-cam style) ────────────────────
function DeliveryPhoto({ logged }) {
  return (
    <PkCard noPad>
      <div style={{
        padding: '10px 14px 8px',
        fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        borderBottom: '1px solid var(--app-border-subtle)',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <i data-lucide="camera" style={{ width: 12, height: 12 }}></i>
        <span>Courier proof photo</span>
        <span style={{ flex: 1 }}></span>
        <span style={{ color: 'var(--fg4)', fontWeight: 600 }}>1:47 PM</span>
      </div>

      <div style={{
        position: 'relative',
        width: '100%', aspectRatio: '4 / 3',
        overflow: 'hidden',
        background: '#1a1f2a',
      }}>
        <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice"
             style={{ display: 'block', width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="porchwall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#D6CDB7" />
              <stop offset="1" stopColor="#B2A88E" />
            </linearGradient>
            <linearGradient id="porchfloor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#7C5E3F" />
              <stop offset="1" stopColor="#5B4128" />
            </linearGradient>
            <linearGradient id="door" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3B5A6E" />
              <stop offset="1" stopColor="#23394A" />
            </linearGradient>
            <linearGradient id="box" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#C8A36F" />
              <stop offset="1" stopColor="#8B6638" />
            </linearGradient>
            <radialGradient id="vign" cx="0.5" cy="0.5" r="0.9">
              <stop offset="0.6" stopColor="#000" stopOpacity="0" />
              <stop offset="1" stopColor="#000" stopOpacity="0.35" />
            </radialGradient>
          </defs>

          {/* wall */}
          <rect x="0" y="0" width="400" height="190" fill="url(#porchwall)" />
          {/* horizontal siding */}
          <g stroke="#9E957C" strokeWidth="0.6" opacity="0.5">
            <line x1="0" y1="40"  x2="400" y2="40" />
            <line x1="0" y1="76"  x2="400" y2="76" />
            <line x1="0" y1="112" x2="400" y2="112" />
            <line x1="0" y1="148" x2="400" y2="148" />
            <line x1="0" y1="180" x2="400" y2="180" />
          </g>
          {/* floor */}
          <rect x="0" y="190" width="400" height="110" fill="url(#porchfloor)" />
          <g stroke="#3E2A18" strokeWidth="0.8" opacity="0.45">
            <line x1="0" y1="220" x2="400" y2="220" />
            <line x1="0" y1="250" x2="400" y2="250" />
            <line x1="0" y1="280" x2="400" y2="280" />
          </g>

          {/* door */}
          <rect x="246" y="42" width="120" height="190" fill="url(#door)" rx="3" />
          <rect x="256" y="56" width="100" height="170" fill="none" stroke="#4F7188" strokeWidth="1.2" opacity="0.55" rx="2" />
          {/* door knob */}
          <circle cx="356" cy="140" r="2.6" fill="#C9A24A" />
          {/* doormat */}
          <rect x="234" y="232" width="138" height="22" fill="#5C4A31" />
          <g stroke="#7A6747" strokeWidth="0.7" opacity="0.7">
            <line x1="240" y1="236" x2="368" y2="236" />
            <line x1="240" y1="242" x2="368" y2="242" />
            <line x1="240" y1="248" x2="368" y2="248" />
          </g>

          {/* planter, left */}
          <ellipse cx="60" cy="232" rx="26" ry="6" fill="#2A1D10" opacity="0.4" />
          <rect x="42" y="200" width="36" height="34" rx="2" fill="#7A4A2A" />
          <ellipse cx="60" cy="200" rx="20" ry="6" fill="#3A2718" />
          <g fill="#4B6240">
            <ellipse cx="50" cy="186" rx="10" ry="14" />
            <ellipse cx="64" cy="180" rx="12" ry="16" />
            <ellipse cx="76" cy="190" rx="9"  ry="13" />
          </g>

          {/* THE BOX */}
          <g transform="translate(135,202)">
            <rect x="0" y="0" width="78" height="58" fill="url(#box)" rx="2" />
            {/* shadow */}
            <ellipse cx="38" cy="62" rx="46" ry="4" fill="#000" opacity="0.35" />
            {/* tape */}
            <rect x="0" y="22" width="78" height="6" fill="#F7E7C0" opacity="0.85" />
            <rect x="35" y="0"  width="6"  height="58" fill="#F7E7C0" opacity="0.85" />
            {/* shipping label */}
            <rect x="6" y="6" width="34" height="14" fill="#fff" stroke="#B8AA7E" strokeWidth="0.6" />
            <line x1="9"  y1="10" x2="36" y2="10" stroke="#3A2A1A" strokeWidth="0.7" />
            <line x1="9"  y1="13" x2="32" y2="13" stroke="#3A2A1A" strokeWidth="0.6" />
            <line x1="9"  y1="16" x2="28" y2="16" stroke="#3A2A1A" strokeWidth="0.6" />
            {/* USPS strip */}
            <rect x="44" y="6" width="28" height="6" fill="#0A2E60" />
            <rect x="44" y="9" width="28" height="1.2" fill="#D8232A" />
            <text x="58" y="11.4" fill="#fff" fontFamily="ui-monospace, monospace" fontSize="3.3" fontWeight="700" textAnchor="middle" letterSpacing="0.4">USPS</text>
            {/* barcode-ish */}
            <g fill="#1a1a1a">
              {[44,46,47,48.5,49.5,51,52.5,54,55.5,57,58.5,60,61.5,63,64,65.5,67,68,69.5,71].map((x,i) => (
                <rect key={i} x={x} y="14" width={i%3===0?1.1:0.6} height="4.4" />
              ))}
            </g>
          </g>

          {/* subtle vignette */}
          <rect x="0" y="0" width="400" height="300" fill="url(#vign)" />
        </svg>

        {/* timestamp watermark */}
        <div style={{
          position: 'absolute', left: 10, bottom: 10,
          fontFamily: 'var(--font-mono)',
          fontSize: 11, fontWeight: 700,
          color: '#fff', letterSpacing: '0.04em',
          textShadow: '0 1px 2px rgba(0,0,0,0.7)',
          background: 'rgba(0,0,0,0.45)',
          padding: '3px 7px', borderRadius: 4,
        }}>
          USPS · 18/05/2026 13:47:08
        </div>

        {/* zoom + flag */}
        <div style={{
          position: 'absolute', right: 10, bottom: 10,
          display: 'flex', gap: 6,
        }}>
          <button style={photoBtn}><i data-lucide="zoom-in" style={{ width: 14, height: 14 }}></i></button>
          <button style={photoBtn}><i data-lucide="flag" style={{ width: 14, height: 14 }}></i></button>
        </div>

        {/* "I see it" check, only if logged */}
        {logged && (
          <div style={{
            position: 'absolute', right: 10, top: 10,
            background: 'rgba(5,150,105,0.95)',
            color: '#fff',
            fontSize: 11, fontWeight: 700,
            padding: '4px 9px 4px 7px', borderRadius: 9999,
            display: 'inline-flex', alignItems: 'center', gap: 4,
            letterSpacing: '0.02em',
            boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
          }}>
            <i data-lucide="check" style={{ width: 11, height: 11 }}></i>
            In your hands
          </div>
        )}
      </div>

      {/* photo caption row */}
      <div style={{
        padding: '10px 14px',
        background: 'var(--app-surface-sunken)',
        borderTop: '1px solid var(--app-border-subtle)',
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 11.5, color: 'var(--fg2)',
      }}>
        <i data-lucide="map-pin" style={{ width: 13, height: 13, color: 'var(--fg3)' }}></i>
        <span>Front porch · <strong style={{ color: 'var(--fg1)' }}>1428 Elm St</strong></span>
        <span style={{ flex: 1 }}></span>
        <span style={{
          fontSize: 10, fontWeight: 700,
          padding: '2px 7px', borderRadius: 9999,
          background: '#fff',
          color: 'var(--color-success)',
          border: '1px solid #bbf7d0',
        }}>GPS verified</span>
      </div>
    </PkCard>
  );
}
const photoBtn = {
  width: 28, height: 28, borderRadius: 8,
  background: 'rgba(255,255,255,0.92)',
  border: 'none',
  color: '#1a1f2a',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
};

// ── Timeline ───────────────────────────────────────────────
function PkTimeline({ events }) {
  return (
    <PkCard>
      <div style={{
        display: 'flex', alignItems: 'center', marginBottom: 12,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>Tracking timeline</div>
        <span style={{ flex: 1 }}></span>
        <span style={{
          fontSize: 11, color: 'var(--color-primary-600)', fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', gap: 3,
        }}>
          View on USPS
          <i data-lucide="external-link" style={{ width: 11, height: 11 }}></i>
        </span>
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute', left: 11, top: 6, bottom: 6,
          width: 2, background: 'var(--app-border)',
        }}></div>
        {events.map((e, i) => {
          const ringColor = e.active ? 'var(--color-success)'
                          : e.pending ? 'var(--color-primary-400)'
                          : 'var(--app-border-strong)';
          return (
            <div key={i} style={{
              position: 'relative',
              display: 'flex', alignItems: 'flex-start', gap: 12,
              paddingBottom: i < events.length - 1 ? 14 : 0,
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: e.active ? 'var(--color-success)' : '#fff',
                border: e.pending ? `2px dashed ${ringColor}` : `2px solid ${ringColor}`,
                color: e.active ? '#fff' : e.pending ? 'var(--color-primary-500)' : 'var(--fg2)',
                flexShrink: 0, zIndex: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i data-lucide={e.icon} style={{ width: 12, height: 12 }}></i>
              </div>
              <div style={{ flex: 1, minWidth: 0, marginTop: 2 }}>
                <div style={{
                  fontSize: 13, fontWeight: e.active ? 700 : 600,
                  color: e.active ? 'var(--fg1)' : e.pending ? 'var(--color-primary-700)' : 'var(--fg2)',
                  letterSpacing: '-0.005em',
                }}>{e.label}</div>
                <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 1 }}>
                  {e.where} · <span style={{ fontFamily: 'var(--font-mono)' }}>{e.when}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </PkCard>
  );
}

// ── Contents card ──────────────────────────────────────────
function ContentsCard() {
  return (
    <PkCard noPad>
      <div style={{
        padding: '10px 14px 8px',
        borderBottom: '1px solid var(--app-border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>What's inside</div>
        <span style={{
          fontSize: 10.5, color: 'var(--color-primary-600)', fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', gap: 3,
        }}>
          Open in Lerina
          <i data-lucide="external-link" style={{ width: 11, height: 11 }}></i>
        </span>
      </div>

      <div style={{ padding: '12px 14px 6px' }}>
        <div style={{
          fontSize: 12.5, fontWeight: 700, color: 'var(--fg1)',
          letterSpacing: '-0.005em',
        }}>{CONTENTS.itemTitle}</div>

        <div style={{ marginTop: 10 }}>
          {CONTENTS.items.map((it, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start',
              padding: '8px 0',
              borderBottom: i < CONTENTS.items.length - 1 ? '1px solid var(--app-border-subtle)' : 'none',
              gap: 10,
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: 5,
                background: 'var(--app-surface-sunken)',
                color: 'var(--fg2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 800,
                flexShrink: 0,
              }}>{it.qty}×</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: 'var(--fg1)', fontWeight: 600, lineHeight: 1.35 }}>
                  {it.name}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--fg3)', marginTop: 1 }}>{it.meta}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        padding: '8px 14px 10px',
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--app-surface-sunken)',
        borderTop: '1px solid var(--app-border-subtle)',
        fontSize: 11.5,
      }}>
        <span style={{ color: 'var(--fg3)' }}>Subtotal {CONTENTS.subtotal}</span>
        <span style={{ color: 'var(--fg4)' }}>·</span>
        <span style={{ color: 'var(--fg3)' }}>Ship {CONTENTS.ship}</span>
        <span style={{ flex: 1 }}></span>
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--fg1)' }}>{CONTENTS.total}</span>
      </div>
    </PkCard>
  );
}

// ── AI elf ─────────────────────────────────────────────────
function PkElf({ data }) {
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
          fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)',
          flex: 1, letterSpacing: '-0.005em',
        }}>{data.headline}</div>
      </div>
      <div style={{
        fontSize: 13, color: '#0c4a6e', lineHeight: 1.5, marginBottom: 10,
        textWrap: 'pretty',
      }}>{data.summary}</div>
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

// ── Actions ────────────────────────────────────────────────
function PkActions({ delivered, logged }) {
  if (!delivered) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button style={{
          width: '100%', padding: '14px 16px',
          background: 'var(--color-primary-600)', color: '#fff',
          border: 'none', borderRadius: 14,
          fontSize: 15, fontWeight: 700, letterSpacing: '-0.005em',
          boxShadow: 'var(--shadow-primary)',
          cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <i data-lucide="bell" style={{ width: 16, height: 16 }}></i>
          Notify me when it arrives
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          <PkChip icon="map"            label="Track on map" />
          <PkChip icon="user-plus"      label="Hand-off" />
          <PkChip icon="message-square" label="Note to courier" />
          <PkChip icon="archive"        label="Archive" />
        </div>
      </div>
    );
  }
  // Delivered
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button style={{
        width: '100%', padding: '14px 16px',
        background: logged ? '#fff' : 'var(--color-primary-600)',
        color: logged ? 'var(--color-success)' : '#fff',
        border: logged ? '1.5px solid var(--color-success-light)' : 'none',
        borderRadius: 14,
        fontSize: 15, fontWeight: 700, letterSpacing: '-0.005em',
        boxShadow: logged ? 'none' : 'var(--shadow-primary)',
        cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <i data-lucide={logged ? 'check-circle-2' : 'package-check'} style={{ width: 16, height: 16 }}></i>
        {logged ? 'Logged · Tap to undo' : 'Log as received'}
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        <PkChip icon="alert-triangle" label="Wrong photo" warn />
        <PkChip icon="user-plus"      label="Hand-off" />
        <PkChip icon="repeat-2"       label="Return" />
        <PkChip icon="archive"        label="Archive" />
      </div>
    </div>
  );
}
function PkChip({ icon, label, warn }) {
  return (
    <button style={{
      background: '#fff',
      border: '1px solid var(--app-border)',
      borderRadius: 12,
      padding: '10px 4px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      color: warn ? 'var(--color-error)' : 'var(--fg2)',
      cursor: 'pointer',
      fontSize: 10.5, fontWeight: 600,
    }}>
      <i data-lucide={icon} style={{ width: 16, height: 16 }}></i>
      {label}
    </button>
  );
}

// ── Screen ─────────────────────────────────────────────────
function MailPackageScreen({ state = 'delivered', dataLabel }) {
  const delivered = state === 'delivered' || state === 'logged';
  const logged = state === 'logged';
  const events = delivered ? TIMELINE_FULL : TIMELINE_TRANSIT;

  return (
    <div data-screen-label={dataLabel} style={{
      width: '100%', height: '100%',
      background: 'var(--app-bg)',
      display: 'flex', flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
      paddingTop: 54,
    }}>
      <PkNav />

      <div style={{
        flex: 1,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '12px 16px 96px',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <PkHero delivered={delivered} />
          <StatusHero delivered={delivered} logged={logged} />
          {delivered && <DeliveryPhoto logged={logged} />}
          <PkElf data={delivered ? ELF_DELIVERED : ELF_TRANSIT} />
          <PkTimeline events={events} />
          <ContentsCard />
          <PkActions delivered={delivered} logged={logged} />
        </div>
      </div>

      <BottomTabBar active="mail" />
    </div>
  );
}

Object.assign(window, { MailPackageScreen });
