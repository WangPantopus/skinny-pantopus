// MailCertifiedScreen — A17 archetype × Certified mail variant.
// Slots beyond the archetype:
//   - Certified badge (stamp-style mark)
//   - Chain of custody timeline (postal scan events)
//   - Combined Sender + Carrier card
//   - Key facts highlighted with deadline + amount
//   - Acknowledge primary

// ── Data ───────────────────────────────────────────────────
const CERT = {
  accent: '#f97316',                  // cat-handyman orange — certified weight
  trust: 'verified',
  category: 'Certified',
  sender: 'Alameda County · Treasurer–Tax Collector',
  time: '4h ago',
  title: 'Supplemental property tax bill — APN 048-7521-019',
  reference: 'Bill SP-2026-188742 · USPS 7014 2026 0411 3344 5577',
};

const CARRIER = {
  service: 'USPS Certified Mail',
  trackingId: '7014 2026 0411 3344 5577',
  signature: 'Signature on delivery · Maria K.',
  insuredFor: null,
  postmark: { city: 'Sacramento, CA', date: 'May 12, 2026' },
};

const SENDER_INFO = {
  initials: 'AC',
  avatarBg: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
  name: 'Alameda County',
  dept: 'Treasurer–Tax Collector · Property Tax Bureau',
  kind: 'Verified government',
  proof: 'Sender domain checked',
};

const CHAIN_OPEN = [
  { icon: 'mailbox',  label: 'Delivered to your Pantopus mailbox', meta: 'Maria K. · scanned QR',                when: 'Today · 1:02 PM',     active: true },
  { icon: 'truck',    label: 'Out for delivery',                   meta: 'Oakland P.O. · 94601',                 when: 'Today · 10:38 AM' },
  { icon: 'building', label: 'Arrived at distribution center',     meta: 'Oakland P&DC',                         when: 'Mon · 7:08 PM' },
  { icon: 'plane',    label: 'In transit',                         meta: 'Sacramento P&DC → Oakland',            when: 'Sun · 5:42 PM' },
  { icon: 'package',  label: 'Accepted from sender',               meta: '1221 Oak St, Oakland CA · counter accept', when: 'Sun · 11:30 AM' },
  { icon: 'tag',      label: 'Certified label generated',          meta: 'Tax Collector mailroom',               when: 'Sun · 9:00 AM' },
];

const CHAIN_ACKED = [
  { icon: 'badge-check', label: 'Acknowledged on Pantopus',          meta: 'Cryptographic receipt OK-7c9d2a · admissible under CA EVD §1552', when: 'Today · 2:14 PM', active: true, pantopus: true },
  ...CHAIN_OPEN,
];

const BODY = [
  'This is a SUPPLEMENTAL property tax bill issued pursuant to §75 et seq. of the California Revenue and Taxation Code following a reassessment triggered by a change in ownership recorded on October 14, 2025.',
  'Your previously assessed value of $612,000 has been adjusted to $785,400, producing supplemental taxes for the partial year October 2025 – June 2026 in the amount shown below.',
  'Payment must be received or postmarked no later than the delinquency date or a 10% penalty plus 1.5% per month interest will accrue.',
];

const FACTS_OPEN = [
  {
    icon: 'badge-dollar-sign',
    label: 'Amount due',
    value: '$1,247.82',
    note: 'Installment 1 of 2 · Installment 2: $1,247.82 due Dec 10',
    tag: 'New charge', tagBg: '#fee2e2', tagFg: '#b91c1c',
    emphasis: true,
  },
  {
    icon: 'calendar-clock',
    label: 'Pay by',
    value: 'Tue, Jun 30, 2026',
    note: '5:00 PM Pacific · in person, by mail, or online',
    tag: '45 days left', tagBg: '#fef3c7', tagFg: '#92400e',
    emphasis: true,
  },
  { icon: 'home',         label: 'Property',          value: '412 Elm St, Oakland', note: 'APN 048-7521-019' },
  { icon: 'calendar-days',label: 'Tax year',          value: '2025–26 · supplemental' },
  { icon: 'history',      label: 'Reason for bill',   value: 'Reassessment after change of ownership',
                                                       note: 'Recorded Oct 14, 2025' },
  { icon: 'triangle-alert', label: 'Penalty if late', value: '10% penalty + 1.5%/mo interest' },
];

const FACTS_ACKED = [
  { icon: 'check-circle',  label: 'Status', value: 'Acknowledged on file',
    tag: 'Confirmed', tagBg: 'var(--color-success-bg)', tagFg: '#047857' },
  ...FACTS_OPEN.map((f, i) =>
    i === 0
      ? { ...f, note: 'Installment 1 of 2 · Scheduled to pay Jun 23 via bank ACH', tag: 'Scheduled', tagBg: 'var(--color-success-bg)', tagFg: '#047857' }
      : f
  ),
];

const ELF_OPEN = {
  headline: 'Pantopus read this for you',
  summary: 'Your supplemental property tax bill is $1,247.82 due Jun 30. This is in addition to your regular annual property tax — it covers the bump from the reassessment after you bought the house in October.',
  bullets: [
    { icon: 'badge-dollar-sign', label: '$1,247.82 owed', text: 'installment 1 of 2' },
    { icon: 'calendar',          label: 'Due Tue, Jun 30', text: '45 days from now' },
    { icon: 'info',              label: 'This is normal', text: 'every new owner gets one' },
  ],
};

const ELF_ACKED = {
  headline: 'What happens next',
  summary: 'Your acknowledgment is on file and timestamped on the chain of custody. Pantopus has scheduled the payment, the reminders, and saved a copy to your Vault.',
  bullets: [
    { icon: 'banknote', label: 'Pay reminder Jun 23',     text: 'one week before due' },
    { icon: 'bell',     label: 'Day-of reminder Jun 30', text: 'pay confirmation will land here' },
    { icon: 'archive',  label: 'Moved to Vault',         text: 'after second installment' },
  ],
};

// ── Card shell ─────────────────────────────────────────────
function CCard({ children, accent, style = {}, noPad = false }) {
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
function CertifiedNav({ acknowledged }) {
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
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: CERT.accent }}></span>
        <span style={{
          fontSize: 12, fontWeight: 700, color: 'var(--fg2)',
          letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>Certified mail</span>
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        <button style={iconBtn}><i data-lucide="bookmark" style={{ width: 18, height: 18 }}></i></button>
        <button style={iconBtn}><i data-lucide="more-horizontal" style={{ width: 18, height: 18 }}></i></button>
      </div>
    </div>
  );
}
const iconBtn = {
  width: 34, height: 34, borderRadius: 9999,
  border: 'none', background: 'var(--app-surface-sunken)',
  color: 'var(--fg2)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
};

// ── Certified stamp badge (signature visual) ───────────────
function CertifiedStamp() {
  // Postal-stamp style: bordered rect with "CERTIFIED MAIL" lockup,
  // small tracking + barcode hashmarks. Tilted slightly like a real
  // postmark for texture, but kept restrained.
  return (
    <div style={{
      position: 'relative',
      display: 'inline-flex',
      flexDirection: 'column',
      padding: '6px 9px 7px',
      border: '1.5px solid #B45623',
      color: '#7B2D0E',
      background: 'rgba(180, 86, 35, 0.04)',
      borderRadius: 4,
      transform: 'rotate(-1.5deg)',
      flexShrink: 0,
      fontFamily: 'var(--font-serif)',
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
        fontFamily: 'var(--font-sans)',
        textTransform: 'uppercase',
        lineHeight: 1,
      }}>USPS · Certified</div>
      <div style={{
        fontSize: 13, fontWeight: 700, letterSpacing: '0.05em',
        fontFamily: 'var(--font-sans)',
        lineHeight: 1.1, marginTop: 2,
      }}>MAIL™</div>
      <div style={{
        display: 'flex', gap: 1, marginTop: 4,
      }}>
        {[1.5, 2.5, 1, 3, 1.5, 2, 1, 2.5, 1.5, 3, 1, 2, 1.5].map((w, i) => (
          <span key={i} style={{
            width: w, height: 12, background: '#7B2D0E',
            display: 'inline-block',
          }}></span>
        ))}
      </div>
      <div style={{
        fontSize: 8, fontWeight: 600, letterSpacing: '0.08em',
        fontFamily: 'var(--font-mono)',
        marginTop: 2,
      }}>7014 2026 0411</div>
    </div>
  );
}

// ── Hero (with certified stamp) ────────────────────────────
function CertifiedHero({ item, acknowledged }) {
  return (
    <CCard accent={item.accent}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <TrustChip kind={item.trust} />
        <CategoryChip label={item.category} color={item.accent} />
        <span style={{ flex: 1 }}></span>
        <span style={{ fontSize: 11, color: 'var(--fg3)', fontWeight: 500 }}>{item.time}</span>
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: 'var(--fg3)',
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
          }}>{item.sender}</div>
          <div style={{
            fontSize: 18, fontWeight: 700, color: 'var(--fg1)',
            lineHeight: 1.25, letterSpacing: '-0.015em',
            textWrap: 'pretty',
          }}>{item.title}</div>
          <div style={{
            fontSize: 11, color: 'var(--fg3)', marginTop: 6,
            fontFamily: 'var(--font-mono)',
          }}>{item.reference}</div>
        </div>
        <CertifiedStamp />
      </div>

      {acknowledged && (
        <div style={{
          marginTop: 12, padding: '8px 10px 8px 9px',
          background: 'var(--color-success-bg)',
          border: '1px solid #bbf7d0', borderRadius: 10,
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12, color: '#065f46',
        }}>
          <div style={{
            width: 20, height: 20, borderRadius: '50%',
            background: 'var(--color-success)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <i data-lucide="check" style={{ width: 13, height: 13 }}></i>
          </div>
          <div>
            <span style={{ fontWeight: 700 }}>Acknowledged</span>
            <span style={{ color: '#047857', opacity: 0.85 }}> · Today 2:14 PM · receipt OK-7c9d2a</span>
          </div>
        </div>
      )}
    </CCard>
  );
}

// ── Sender + Carrier card ──────────────────────────────────
function SenderCarrier() {
  return (
    <CCard noPad>
      <div style={{
        padding: '10px 14px 8px',
        fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        borderBottom: '1px solid var(--app-border-subtle)',
      }}>Sender &amp; carrier</div>

      {/* Sender row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px',
        borderBottom: '1px dashed var(--app-border)',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, background: SENDER_INFO.avatarBg,
          color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, flexShrink: 0, position: 'relative',
        }}>
          {SENDER_INFO.initials}
          <span style={{
            position: 'absolute', right: -3, bottom: -3,
            width: 15, height: 15, borderRadius: '50%',
            background: 'var(--color-success)', color: '#fff',
            border: '2px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i data-lucide="check" style={{ width: 8, height: 8 }}></i>
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg3)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            From
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--fg1)', marginTop: 1 }}>
            {SENDER_INFO.name}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--fg3)', marginTop: 1 }}>
            {SENDER_INFO.dept}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 9999,
              background: '#dbeafe', color: '#1e40af',
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              <i data-lucide="landmark" style={{ width: 9, height: 9 }}></i>
              {SENDER_INFO.kind}
            </span>
            <span style={{
              fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 9999,
              background: 'var(--color-success-bg)', color: '#047857',
            }}>{SENDER_INFO.proof}</span>
          </div>
        </div>
      </div>

      {/* Carrier row */}
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: '#fff', border: '1.5px solid #B45623',
          color: '#7B2D0E',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <i data-lucide="mail-check" style={{ width: 18, height: 18 }}></i>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg3)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Delivered via
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--fg1)', marginTop: 1 }}>
            {CARRIER.service}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--fg3)', marginTop: 1, fontFamily: 'var(--font-mono)' }}>
            #{CARRIER.trackingId}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 9999,
              background: '#fff7ed', color: '#9a3412',
              border: '1px solid #fed7aa',
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              <i data-lucide="pen" style={{ width: 9, height: 9 }}></i>
              Signature required
            </span>
            <span style={{
              fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 9999,
              background: 'var(--color-success-bg)', color: '#047857',
            }}>Postmark verified</span>
          </div>
        </div>
      </div>
    </CCard>
  );
}

// ── Chain of custody timeline ──────────────────────────────
function ChainOfCustody({ events }) {
  return (
    <CCard noPad>
      <div style={{
        padding: '10px 14px 8px',
        borderBottom: '1px solid var(--app-border-subtle)',
        display: 'flex', alignItems: 'center',
      }}>
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>Chain of custody</div>
          <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 1 }}>
            Postal scans · cryptographic receipts
          </div>
        </div>
        <span style={{ flex: 1 }}></span>
        <span style={{
          fontSize: 10, fontWeight: 700,
          padding: '3px 7px', borderRadius: 9999,
          background: 'var(--color-success-bg)', color: '#047857',
        }}>Unbroken</span>
      </div>
      <div style={{ padding: '14px 14px 14px' }}>
        <div style={{ position: 'relative' }}>
          {/* track */}
          <div style={{
            position: 'absolute',
            left: 11, top: 8, bottom: 8,
            width: 2, background: 'var(--app-border)',
          }}></div>
          {events.map((e, i) => (
            <div key={i} style={{
              position: 'relative',
              display: 'flex', gap: 12, alignItems: 'flex-start',
              paddingBottom: i < events.length - 1 ? 14 : 0,
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: e.active
                  ? (e.pantopus ? 'var(--color-primary-600)' : 'var(--color-success)')
                  : '#fff',
                border: e.active
                  ? '2px solid ' + (e.pantopus ? 'var(--color-primary-700)' : 'var(--color-success)')
                  : '1.5px solid var(--app-border-strong)',
                color: e.active ? '#fff' : 'var(--fg2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, zIndex: 1,
              }}>
                <i data-lucide={e.icon} style={{ width: 12, height: 12 }}></i>
              </div>
              <div style={{ flex: 1, minWidth: 0, marginTop: 1 }}>
                <div style={{
                  display: 'flex', alignItems: 'baseline',
                  gap: 8, flexWrap: 'wrap',
                }}>
                  <div style={{
                    fontSize: 12.5,
                    fontWeight: e.active ? 700 : 600,
                    color: 'var(--fg1)',
                    letterSpacing: '-0.005em',
                  }}>{e.label}</div>
                  {e.pantopus && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 9999,
                      background: 'var(--color-primary-100)', color: 'var(--color-primary-700)',
                      letterSpacing: '0.02em',
                    }}>PANTOPUS</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 1, lineHeight: 1.4 }}>
                  {e.meta}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--fg4)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                  {e.when}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </CCard>
  );
}

// ── Key facts (with emphasis row treatment) ────────────────
function CertifiedFacts({ facts }) {
  return (
    <CCard noPad>
      <div style={{
        padding: '10px 14px 8px',
        fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        borderBottom: '1px solid var(--app-border-subtle)',
      }}>Key facts</div>
      <div>
        {facts.map((f, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start',
            padding: f.emphasis ? '14px' : '10px 14px',
            background: f.emphasis ? 'var(--color-warning-bg)' : 'transparent',
            borderBottom: i < facts.length - 1 ? '1px solid var(--app-border-subtle)' : 'none',
            gap: 12,
          }}>
            <div style={{
              width: f.emphasis ? 28 : 24, height: f.emphasis ? 28 : 24, borderRadius: 6,
              flexShrink: 0,
              background: f.emphasis ? '#fed7aa' : 'var(--app-surface-sunken)',
              color: f.emphasis ? '#9a3412' : 'var(--fg2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <i data-lucide={f.icon} style={{ width: f.emphasis ? 15 : 13, height: f.emphasis ? 15 : 13 }}></i>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 11, color: 'var(--fg3)', fontWeight: 600,
                letterSpacing: '0.01em',
              }}>{f.label}</div>
              <div style={{
                fontSize: f.emphasis ? 16 : 13,
                fontWeight: 700,
                color: 'var(--fg1)',
                marginTop: f.emphasis ? 2 : 1,
                letterSpacing: '-0.01em',
                lineHeight: 1.2,
              }}>{f.value}</div>
              {f.note && (
                <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 2, lineHeight: 1.4 }}>
                  {f.note}
                </div>
              )}
            </div>
            {f.tag && (
              <span style={{
                fontSize: 10, fontWeight: 700,
                padding: '3px 7px', borderRadius: 9999,
                background: f.tagBg || 'var(--color-warning-bg)',
                color: f.tagFg || 'var(--color-warning)',
                flexShrink: 0, whiteSpace: 'nowrap',
              }}>{f.tag}</span>
            )}
          </div>
        ))}
      </div>
    </CCard>
  );
}

// ── AI elf strip ───────────────────────────────────────────
function CertifiedElf({ data }) {
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

// ── Body ───────────────────────────────────────────────────
function CertifiedBody() {
  return (
    <CCard>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        marginBottom: 8,
      }}>Notice text</div>
      <div style={{
        fontSize: 13, color: 'var(--fg2)', lineHeight: 1.55,
        textWrap: 'pretty',
      }}>
        {BODY.map((p, i) => (
          <p key={i} style={{ margin: i ? '10px 0 0' : 0 }}>{p}</p>
        ))}
      </div>
      <button style={{
        marginTop: 10, padding: 0, background: 'transparent', border: 'none',
        color: 'var(--color-primary-600)', fontSize: 12, fontWeight: 600,
        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
      }}>
        Show full notice <i data-lucide="chevron-down" style={{ width: 13, height: 13 }}></i>
      </button>
    </CCard>
  );
}

// ── Action bar ─────────────────────────────────────────────
function CertifiedActions({ acknowledged }) {
  const secondaries = [
    { icon: 'banknote',      label: 'Pay $1,247.82' },
    { icon: 'calendar-plus', label: 'Calendar' },
    { icon: 'flag',          label: 'Dispute' },
    { icon: 'archive',       label: 'Archive' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button style={{
        width: '100%', padding: '14px 16px',
        background: acknowledged ? '#fff' : 'var(--color-primary-600)',
        color: acknowledged ? 'var(--color-success)' : '#fff',
        border: acknowledged ? '1.5px solid var(--color-success-light)' : 'none',
        borderRadius: 14,
        fontSize: 15, fontWeight: 700, letterSpacing: '-0.005em',
        boxShadow: acknowledged ? 'none' : 'var(--shadow-primary)',
        cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <i data-lucide={acknowledged ? 'check-circle-2' : 'check'} style={{ width: 16, height: 16 }}></i>
        {acknowledged ? 'Acknowledged · receipt OK-7c9d2a' : 'Acknowledge receipt'}
      </button>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8,
      }}>
        {secondaries.map((s, i) => (
          <button key={i} style={{
            background: '#fff', border: '1px solid var(--app-border)',
            borderRadius: 12, padding: '11px 10px',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-start', gap: 8,
            color: 'var(--fg1)', cursor: 'pointer',
            fontSize: 12.5, fontWeight: 600,
          }}>
            <i data-lucide={s.icon} style={{ width: 15, height: 15, color: 'var(--color-primary-600)' }}></i>
            {s.label}
          </button>
        ))}
      </div>
      <div style={{
        fontSize: 10.5, color: 'var(--fg4)', textAlign: 'center', marginTop: 2,
        lineHeight: 1.4, padding: '0 18px',
      }}>
        Acknowledging confirms receipt only · it does not waive your right to appeal or dispute the charge.
      </div>
    </div>
  );
}

// ── Screen ─────────────────────────────────────────────────
function MailCertifiedScreen({ state = 'open', dataLabel }) {
  const acknowledged = state === 'acknowledged';
  return (
    <div data-screen-label={dataLabel} style={{
      width: '100%', height: '100%',
      background: 'var(--app-bg)',
      display: 'flex', flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
      paddingTop: 54,
    }}>
      <CertifiedNav acknowledged={acknowledged} />

      <div style={{
        flex: 1,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '12px 16px 96px',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <CertifiedHero item={CERT} acknowledged={acknowledged} />
          <CertifiedElf data={acknowledged ? ELF_ACKED : ELF_OPEN} />
          <CertifiedFacts facts={acknowledged ? FACTS_ACKED : FACTS_OPEN} />
          <ChainOfCustody events={acknowledged ? CHAIN_ACKED : CHAIN_OPEN} />
          <SenderCarrier />
          <CertifiedBody />
          <CertifiedActions acknowledged={acknowledged} />
        </div>
      </div>

      <BottomTabBar active="mail" />
    </div>
  );
}

Object.assign(window, { MailCertifiedScreen });
