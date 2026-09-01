// MailCouponScreen — A17 archetype × Coupon variant.
// Slots beyond the archetype:
//   - Ticket-style hero (brand, big discount, code, expiry strip)
//   - Fine-print accordion card
//   - Add-to-wallet primary action (swaps to "Open in Wallet" once added)
//   - Similar-offers horizontal rail
//   - Wallet-preview card on the secondary (added) state

// ── Data ───────────────────────────────────────────────────
const COUP = {
  accent: '#d97706',                    // amber — promo/coupon
  trust: 'verified',
  category: 'Coupon',
  sender: 'Brass Owl Bakery',
  time: '3h ago',
  title: '25% off your next visit',
  reference: 'Single-use · Pantopus offer · Sent to 412 verified neighbors',
};

const BRAND = {
  name: 'Brass Owl Bakery',
  tagline: '0.4 mi · Tuesday – Sunday · 7 AM – 6 PM',
  visits: 'You\'ve been there 3 times',
  rating: 4.8,
  ratingCount: 162,
  initials: 'BO',
};

const OFFER = {
  amount: '25% OFF',
  subline: 'Your next in-store purchase',
  code: 'BRASS25',
  expires: 'Sun, Jun 30, 2026',
  daysLeft: 14,
  minPurchase: '$8 minimum',
};

const FINE_PRINT = [
  'Valid for one (1) in-store transaction. Cannot be combined with other Pantopus offers, daily specials, or loyalty rewards.',
  'Excludes whole-cake orders, catering trays, gift cards, and items already marked down.',
  'Show the code at checkout — staff will scan or key it in. Code expires after a single use.',
  'Offer void if your Pantopus account becomes unverified before redemption.',
];

const ELF_OPEN = {
  headline: 'Pantopus checked this offer',
  summary: 'Brass Owl is a verified business 0.4 mi from you that you\'ve visited 3 times. Based on those baskets you\'d save about $4–8 here. Twelve neighbors have already claimed.',
  bullets: [
    { icon: 'piggy-bank', label: '~$6 typical savings',    text: 'against your average order' },
    { icon: 'users',      label: '12 neighbors claimed',   text: '4 are first-timers' },
    { icon: 'badge-check',label: 'Verified business',     text: 'state license on file' },
  ],
};

const ELF_ADDED = {
  headline: 'Saved to your wallet',
  summary: 'Pantopus added this to Apple Wallet and set a reminder for the weekend before it expires. Show the pass at checkout or read the code aloud — both work.',
  bullets: [
    { icon: 'wallet',    label: 'In Apple Wallet',         text: 'auto-surfaces near the bakery' },
    { icon: 'bell',      label: 'Reminder Sat Jun 27',     text: 'three days before expiry' },
    { icon: 'map-pin',   label: 'Geo-trigger on',          text: 'pings when within 200 ft' },
  ],
};

const SIMILAR = [
  { brand: 'Hazel Coffee',     initials: 'HC', dist: '0.2 mi', amount: '$2 off',  sub: 'any drip + pastry',  expires: 'Fri',    tone: '#0c4a6e', tint: '#e0f2fe' },
  { brand: 'Pier Florals',     initials: 'PF', dist: '0.6 mi', amount: 'BOGO',    sub: 'cut-flower bunches', expires: 'May 28', tone: '#6d28d9', tint: '#ede9fe' },
  { brand: 'North Bay Tackle', initials: 'NT', dist: '1.1 mi', amount: '15% off', sub: 'all bait & line',    expires: 'Jun 10', tone: '#15803d', tint: '#dcfce7' },
  { brand: 'Maple Wash',       initials: 'MW', dist: '0.9 mi', amount: '$10 off', sub: 'first full detail',  expires: 'Jul 04', tone: '#b91c1c', tint: '#fee2e2' },
];

const SENDER = {
  initials: 'BO',
  avatarBg: 'linear-gradient(135deg, #b45309 0%, #78350f 100%)',
  name: 'Brass Owl Bakery',
  dept: '218 Telegraph Ave · Verified small business',
  kind: 'Verified business',
  proof: 'Owner ID + license',
};

// ── Card shell (reused style) ──────────────────────────────
function CpCard({ children, accent, style = {}, noPad = false }) {
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
function CouponNav() {
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
      <button style={cpNavBtn}>
        <i data-lucide="chevron-left" style={{ width: 22, height: 22 }}></i>
        <span style={{ fontSize: 15, fontWeight: 500, marginLeft: -2 }}>Mailbox</span>
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: COUP.accent }}></span>
        <span style={{
          fontSize: 12, fontWeight: 700, color: 'var(--fg2)',
          letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>Coupon</span>
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        <button style={cpNavIco}><i data-lucide="share" style={{ width: 18, height: 18 }}></i></button>
        <button style={cpNavIco}><i data-lucide="more-horizontal" style={{ width: 18, height: 18 }}></i></button>
      </div>
    </div>
  );
}
const cpNavBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 2,
  border: 'none', background: 'transparent',
  color: 'var(--color-primary-600)',
  padding: '6px 6px', cursor: 'pointer',
  borderRadius: 8,
};
const cpNavIco = {
  width: 34, height: 34, borderRadius: 9999,
  border: 'none', background: 'var(--app-surface-sunken)',
  color: 'var(--fg2)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
};

// ── Ticket hero ────────────────────────────────────────────
// Two panels joined by a dashed perforation, with semicircular cutouts
// punched into the top and bottom of the divider — a real coupon shape.
function CouponTicket({ added }) {
  return (
    <div style={{
      position: 'relative',
      borderRadius: 18,
      overflow: 'hidden',
      boxShadow: '0 6px 18px rgba(217,119,6,0.18), 0 1px 2px rgba(0,0,0,0.04)',
      background: '#fff',
    }}>
      {/* Status ribbon — only on added state */}
      {added && (
        <div style={{
          position: 'absolute', top: 12, right: -34,
          transform: 'rotate(34deg)',
          background: 'var(--color-success)', color: '#fff',
          padding: '4px 40px',
          fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
          textTransform: 'uppercase',
          boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
          zIndex: 4,
        }}>In wallet</div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 130px',
        background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
        position: 'relative',
      }}>
        {/* LEFT — brand + offer */}
        <div style={{
          padding: '14px 16px 16px',
          display: 'flex', flexDirection: 'column',
          borderRight: '1.5px dashed #f59e0b',
          position: 'relative',
        }}>
          {/* Trust + days-left row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <TrustChip kind={COUP.trust} />
            <span style={{ flex: 1 }}></span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: 9999,
              background: OFFER.daysLeft <= 3 ? '#fef2f2' : '#fff',
              color: OFFER.daysLeft <= 3 ? '#b91c1c' : '#92400e',
              border: `1px solid ${OFFER.daysLeft <= 3 ? '#fecaca' : '#fcd34d'}`,
              fontSize: 10, fontWeight: 700, letterSpacing: '0.01em',
              whiteSpace: 'nowrap',
            }}>
              <i data-lucide="clock" style={{ width: 11, height: 11 }}></i>
              {OFFER.daysLeft}d left
            </span>
          </div>

          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'linear-gradient(135deg, #b45309 0%, #78350f 100%)',
              color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 800, letterSpacing: '0.04em',
              boxShadow: '0 2px 4px rgba(180,83,9,0.3)',
              flexShrink: 0,
            }}>{BRAND.initials}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 700, color: 'var(--fg1)',
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{BRAND.name}</div>
              <div style={{ fontSize: 10.5, color: 'var(--fg3)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                <i data-lucide="star" style={{ width: 10, height: 10, color: '#d97706', fill: '#d97706' }}></i>
                <span style={{ fontWeight: 700, color: 'var(--fg2)' }}>{BRAND.rating}</span>
                <span>·</span>
                <span>0.4 mi</span>
              </div>
            </div>
          </div>

          {/* Big amount */}
          <div style={{
            fontSize: 44, fontWeight: 800,
            color: '#b45309',
            letterSpacing: '-0.035em',
            lineHeight: 0.95,
            fontFamily: 'var(--font-sans)',
          }}>{OFFER.amount}</div>
          <div style={{
            fontSize: 13, color: '#78350f', marginTop: 5,
            fontWeight: 600, letterSpacing: '-0.005em',
          }}>{OFFER.subline}</div>

          {/* Code */}
          <div style={{
            marginTop: 14,
            display: 'flex', alignItems: 'stretch',
            border: '1.5px dashed #b45309',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.6)',
            overflow: 'hidden',
          }}>
            <div style={{
              flex: 1,
              padding: '8px 12px',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
            }}>
              <div style={{
                fontSize: 9, fontWeight: 700, color: '#92400e',
                letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>Code</div>
              <div style={{
                fontSize: 16, fontWeight: 800, color: '#78350f',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.05em', marginTop: 1,
              }}>{OFFER.code}</div>
            </div>
            <button style={{
              border: 'none',
              borderLeft: '1.5px dashed #b45309',
              background: 'transparent',
              padding: '0 14px',
              color: '#92400e',
              fontSize: 11, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: 4,
              cursor: 'pointer',
              letterSpacing: '0.02em', textTransform: 'uppercase',
            }}>
              <i data-lucide={added ? 'check' : 'copy'} style={{ width: 12, height: 12 }}></i>
              {added ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* RIGHT — stub */}
        <div style={{
          padding: '14px 12px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 8,
        }}>
          {/* fake barcode */}
          <div style={{
            display: 'flex', gap: 1.5, alignItems: 'stretch',
            height: 56,
            transform: 'rotate(90deg)',
            transformOrigin: 'center',
            marginTop: 14, marginBottom: 14,
          }}>
            {[3,1,2,4,1,3,1,1,4,2,1,3,2,1,4,1,2,3,1,2,1,4,1,2,3].map((w, i) => (
              <span key={i} style={{
                width: w, background: '#78350f', display: 'inline-block',
              }}></span>
            ))}
          </div>
          <div style={{
            fontSize: 8.5, fontWeight: 700, color: '#92400e',
            letterSpacing: '0.16em', textTransform: 'uppercase', textAlign: 'center',
          }}>Single<br/>use</div>
        </div>

        {/* notches in perforation */}
        <div style={{
          position: 'absolute', top: -10, left: 'calc(100% - 130px - 0.75px)',
          width: 20, height: 20, borderRadius: '50%',
          background: 'var(--app-bg)',
          transform: 'translateX(-50%)',
          border: '1px solid var(--app-border)',
        }}></div>
        <div style={{
          position: 'absolute', bottom: -10, left: 'calc(100% - 130px - 0.75px)',
          width: 20, height: 20, borderRadius: '50%',
          background: 'var(--app-bg)',
          transform: 'translateX(-50%)',
          border: '1px solid var(--app-border)',
        }}></div>
      </div>

      {/* footer strip */}
      <div style={{
        background: '#fff',
        borderTop: '1px solid var(--app-border-subtle)',
        padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <i data-lucide="calendar-clock" style={{ width: 13, height: 13, color: 'var(--fg3)' }}></i>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--fg3)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Expires</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg1)', letterSpacing: '-0.005em' }}>{OFFER.expires}</div>
          </div>
        </div>
        <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--app-border-subtle)' }}></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <i data-lucide="receipt" style={{ width: 13, height: 13, color: 'var(--fg3)' }}></i>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--fg3)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Minimum</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg1)', letterSpacing: '-0.005em' }}>{OFFER.minPurchase}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AI elf ─────────────────────────────────────────────────
function CouponElf({ data }) {
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

// ── Wallet preview card (added state) ──────────────────────
function WalletPreview() {
  return (
    <CpCard noPad>
      <div style={{
        padding: '10px 14px 8px',
        fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        borderBottom: '1px solid var(--app-border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>In your wallet</span>
        <span style={{
          fontSize: 10, color: 'var(--color-success)', fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', gap: 3,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)' }}></span>
          Active
        </span>
      </div>
      <div style={{ padding: 14 }}>
        {/* fake pkpass preview */}
        <div style={{
          background: 'linear-gradient(135deg, #78350f 0%, #b45309 100%)',
          color: '#fff',
          borderRadius: 12,
          padding: '12px 14px 14px',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(120,53,15,0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{
              width: 22, height: 22, borderRadius: 6,
              background: 'rgba(255,255,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 800, letterSpacing: '0.02em',
            }}>BO</div>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.02em' }}>Brass Owl Bakery</span>
            <span style={{ flex: 1 }}></span>
            <span style={{ fontSize: 9, opacity: 0.75, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Pass</span>
          </div>
          <div style={{
            fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}>25% off your next visit</div>
          <div style={{ display: 'flex', gap: 18, marginTop: 12 }}>
            <div>
              <div style={{ fontSize: 8.5, opacity: 0.75, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Code</div>
              <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', marginTop: 2 }}>BRASS25</div>
            </div>
            <div>
              <div style={{ fontSize: 8.5, opacity: 0.75, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Expires</div>
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>Jun 30</div>
            </div>
          </div>
          {/* decorative arc */}
          <svg width="100" height="100" viewBox="0 0 100 100" style={{ position: 'absolute', right: -22, bottom: -22, opacity: 0.12 }}>
            <circle cx="50" cy="50" r="48" fill="none" stroke="#fff" strokeWidth="2"></circle>
            <circle cx="50" cy="50" r="34" fill="none" stroke="#fff" strokeWidth="2"></circle>
          </svg>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <WalletAction icon="bell" label="Remind me" detail="Sat Jun 27" />
          <WalletAction icon="map-pin" label="At-arrival" detail="On · 200 ft" />
        </div>
      </div>
    </CpCard>
  );
}
function WalletAction({ icon, label, detail }) {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 10px',
      background: 'var(--app-surface-sunken)',
      borderRadius: 10,
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: 7,
        background: '#fff', color: 'var(--color-primary-700)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid var(--app-border)',
        flexShrink: 0,
      }}>
        <i data-lucide={icon} style={{ width: 13, height: 13 }}></i>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg1)', letterSpacing: '-0.005em' }}>{label}</div>
        <div style={{ fontSize: 10, color: 'var(--fg3)', marginTop: 1 }}>{detail}</div>
      </div>
    </div>
  );
}

// ── Fine print ─────────────────────────────────────────────
function FinePrint({ expanded }) {
  return (
    <CpCard noPad>
      <div style={{
        padding: '10px 14px 8px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--app-border-subtle)',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>Fine print</div>
        <span style={{
          fontSize: 10, color: 'var(--fg3)', fontWeight: 600,
          display: 'inline-flex', alignItems: 'center', gap: 3,
        }}>
          <i data-lucide="file-text" style={{ width: 11, height: 11 }}></i>
          From sender · not edited
        </span>
      </div>
      <ul style={{
        margin: 0, padding: '12px 14px 4px 14px',
        listStyle: 'none',
        display: 'flex', flexDirection: 'column', gap: 9,
      }}>
        {FINE_PRINT.map((line, i) => (
          <li key={i} style={{
            display: 'flex', gap: 9, alignItems: 'flex-start',
            fontSize: 12, color: 'var(--fg2)', lineHeight: 1.5,
            textWrap: 'pretty',
          }}>
            <span style={{
              flexShrink: 0, marginTop: 6,
              width: 4, height: 4, borderRadius: '50%',
              background: 'var(--fg4)',
            }}></span>
            {line}
          </li>
        ))}
      </ul>
      <button style={{
        width: '100%',
        padding: '10px 14px 12px',
        background: 'transparent', border: 'none',
        color: 'var(--color-primary-600)',
        fontSize: 12, fontWeight: 700,
        cursor: 'pointer',
        textAlign: 'left',
        display: 'inline-flex', alignItems: 'center', gap: 4,
      }}>
        Read the original notice
        <i data-lucide="external-link" style={{ width: 12, height: 12 }}></i>
      </button>
    </CpCard>
  );
}

// ── Sender / business card ─────────────────────────────────
function BusinessCard() {
  return (
    <CpCard>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
      }}>From</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: SENDER.avatarBg, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, flexShrink: 0,
          letterSpacing: '0.02em', position: 'relative',
        }}>
          {SENDER.initials}
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
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg1)' }}>{SENDER.name}</div>
          <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 1 }}>{SENDER.dept}</div>
          <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 10, fontWeight: 700,
              padding: '2px 6px', borderRadius: 9999,
              background: 'var(--color-identity-business-bg)',
              color: 'var(--color-identity-business)',
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              <i data-lucide="briefcase" style={{ width: 9, height: 9 }}></i>
              {SENDER.kind}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700,
              padding: '2px 6px', borderRadius: 9999,
              background: 'var(--color-success-bg)', color: '#047857',
            }}>{SENDER.proof}</span>
          </div>
        </div>
        <i data-lucide="chevron-right" style={{ width: 16, height: 16, color: 'var(--fg4)' }}></i>
      </div>
    </CpCard>
  );
}

// ── Similar offers rail ────────────────────────────────────
function SimilarOffers() {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        padding: '0 2px 8px',
      }}>
        <div>
          <div style={{
            fontSize: 13, fontWeight: 700, color: 'var(--fg1)',
            letterSpacing: '-0.005em',
          }}>Similar offers near you</div>
          <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 1 }}>
            From other verified neighbors and businesses
          </div>
        </div>
        <button style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--color-primary-600)', fontSize: 11, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', gap: 3, padding: 0,
        }}>
          See all
          <i data-lucide="chevron-right" style={{ width: 12, height: 12 }}></i>
        </button>
      </div>
      <div style={{
        display: 'flex', gap: 10,
        overflowX: 'auto',
        margin: '0 -16px',
        padding: '2px 16px 4px',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}>
        {SIMILAR.map((o, i) => <MiniCoupon key={i} o={o} />)}
      </div>
    </div>
  );
}

function MiniCoupon({ o }) {
  return (
    <div style={{
      flexShrink: 0,
      width: 168,
      borderRadius: 14,
      background: '#fff',
      border: '1px solid var(--app-border)',
      overflow: 'hidden',
      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '12px 12px 10px',
        background: o.tint,
        position: 'relative',
        borderBottom: '1.5px dashed rgba(0,0,0,0.12)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6,
            background: '#fff', color: o.tone,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 800, letterSpacing: '0.04em',
            border: `1px solid ${o.tone}33`,
          }}>{o.initials}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: 10.5, fontWeight: 700, color: o.tone,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              letterSpacing: '-0.005em',
            }}>{o.brand}</div>
            <div style={{ fontSize: 9, color: o.tone, opacity: 0.7, marginTop: 1 }}>{o.dist}</div>
          </div>
        </div>
        <div style={{
          fontSize: 20, fontWeight: 800, color: o.tone,
          letterSpacing: '-0.025em', lineHeight: 1,
        }}>{o.amount}</div>
        <div style={{
          fontSize: 10.5, color: o.tone, opacity: 0.85, marginTop: 4,
          fontWeight: 600,
        }}>{o.sub}</div>
        {/* notches */}
        <div style={{
          position: 'absolute', left: -7, bottom: -8,
          width: 14, height: 14, borderRadius: '50%',
          background: '#fff', border: '1px solid var(--app-border)',
        }}></div>
        <div style={{
          position: 'absolute', right: -7, bottom: -8,
          width: 14, height: 14, borderRadius: '50%',
          background: '#fff', border: '1px solid var(--app-border)',
        }}></div>
      </div>
      <div style={{
        padding: '8px 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 6,
      }}>
        <div style={{ fontSize: 10, color: 'var(--fg3)' }}>
          Expires <span style={{ color: 'var(--fg2)', fontWeight: 600 }}>{o.expires}</span>
        </div>
        <button style={{
          border: 'none', background: 'transparent',
          color: 'var(--color-primary-600)', fontSize: 10.5, fontWeight: 700,
          cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 2,
          padding: 0,
        }}>
          Claim
          <i data-lucide="arrow-right" style={{ width: 10, height: 10 }}></i>
        </button>
      </div>
    </div>
  );
}

// ── Action bar ─────────────────────────────────────────────
function CouponActions({ added }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button style={{
        width: '100%', padding: '14px 16px',
        background: added ? '#fff' : 'var(--color-primary-600)',
        color: added ? 'var(--color-primary-700)' : '#fff',
        border: added ? '1.5px solid var(--color-primary-200)' : 'none',
        borderRadius: 14,
        fontSize: 15, fontWeight: 700,
        letterSpacing: '-0.005em',
        boxShadow: added ? 'none' : 'var(--shadow-primary)',
        cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <i data-lucide={added ? 'wallet' : 'plus'} style={{ width: 16, height: 16 }}></i>
        {added ? 'Open in Wallet' : 'Add to Wallet'}
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        <CpActionChip icon="navigation" label="Directions" />
        <CpActionChip icon="share-2"    label="Share" />
        <CpActionChip icon="bookmark"   label="Save" />
        <CpActionChip icon="archive"    label="Archive" />
      </div>
    </div>
  );
}

function CpActionChip({ icon, label }) {
  return (
    <button style={{
      background: '#fff',
      border: '1px solid var(--app-border)',
      borderRadius: 12,
      padding: '10px 4px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      color: 'var(--fg2)',
      cursor: 'pointer',
      fontSize: 10.5, fontWeight: 600,
    }}>
      <i data-lucide={icon} style={{ width: 17, height: 17 }}></i>
      {label}
    </button>
  );
}

// ── Screen ─────────────────────────────────────────────────
function MailCouponScreen({ state = 'open', dataLabel }) {
  const added = state === 'added';
  return (
    <div data-screen-label={dataLabel} style={{
      width: '100%', height: '100%',
      background: 'var(--app-bg)',
      display: 'flex', flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
      paddingTop: 54,
    }}>
      <CouponNav />

      <div style={{
        flex: 1,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '12px 16px 96px',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* sender + subject row above the ticket — same vocab as other A17 variants */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 2px' }}>
            <CategoryChip label={COUP.category} color={COUP.accent} />
            <span style={{ flex: 1 }}></span>
            <span style={{ fontSize: 11, color: 'var(--fg3)', fontWeight: 500 }}>{COUP.time}</span>
          </div>

          <CouponTicket added={added} />

          <CouponElf data={added ? ELF_ADDED : ELF_OPEN} />

          {added && <WalletPreview />}

          <FinePrint />

          <BusinessCard />

          <SimilarOffers />

          <CouponActions added={added} />
        </div>
      </div>

      <BottomTabBar active="mail" />
    </div>
  );
}

Object.assign(window, { MailCouponScreen });
