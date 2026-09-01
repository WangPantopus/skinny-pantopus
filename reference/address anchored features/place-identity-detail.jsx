// ─────────────────────────────────────────────────────────────
// Place — C9 · Identity detail (+ residency letter generator)
// ContentDetail. Verification status + the green badge, then a
// generator for a verified residency letter: edit the purpose,
// see a live product-UI preview (NOT stationery/serif), and
// deliver by Download PDF or Mail a copy via the mailbox.
// Portable ID sits below as a "Coming soon" row.
// ─────────────────────────────────────────────────────────────

const RESIDENT = {
  name: 'Riley Chen',
  address1: '1421 SE Oak St',
  address2: 'Portland, OR 97214',
  verifiedOn: 'Verified Apr 2, 2026',
  method: 'Confirmed by mailed postcard',
};

const ISSUE_DATE = 'May 7, 2026';

// ─────────────────────────────────────────────────────────────
// Verification status — the green badge
// ─────────────────────────────────────────────────────────────
function VerifiedStatus() {
  return (
    <div className="pl-card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: HOME_GREEN_BG, border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="badge-check" size={30} color={HOME_GREEN} strokeWidth={2} />
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: INK, letterSpacing: '-0.015em' }}>Verified resident</span>
            <Chip tone="success" icon="check">Active</Chip>
          </div>
          <div style={{ fontSize: 13.5, color: MUTE, marginTop: 2 }}>{RESIDENT.name} · {RESIDENT.address1}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 0, marginTop: 15, paddingTop: 15, borderTop: '1px solid #f1f3f5' }}>
        <div style={{ flex: 1, paddingRight: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase', color: '#9ca3af' }}>Verified on</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: INK, marginTop: 3 }}>Apr 2, 2026</div>
        </div>
        <div style={{ flex: 1, paddingLeft: 14, borderLeft: '1px solid #f1f3f5' }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase', color: '#9ca3af' }}>Method</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: INK, marginTop: 3 }}>Mailed postcard</div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// The letter preview — product-UI styled, sans-serif, branded
// (deliberately NOT the ceremonial stationery/serif surface)
// ─────────────────────────────────────────────────────────────
function LetterPreview({ purpose }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, boxShadow: '0 4px 16px rgba(17,24,39,0.06)', overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>
      {/* letterhead */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f3f5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: SKY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="layout-dashboard" size={15} color="#fff" strokeWidth={2.25} />
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: INK, letterSpacing: '-0.01em' }}>Pantopus</span>
        </div>
        <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9ca3af' }}>Verified residency</span>
      </div>

      <div style={{ padding: '18px 20px 20px' }}>
        <div style={{ fontSize: 11, color: '#9ca3af', letterSpacing: '0.02em' }}>{ISSUE_DATE}</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: INK, marginTop: 12, letterSpacing: '-0.01em' }}>To whom it may concern,</div>
        <div style={{ fontSize: 13.5, color: INK2, lineHeight: '21px', marginTop: 9 }}>
          This letter confirms that <b style={{ fontWeight: 700, color: INK }}>{RESIDENT.name}</b> is a verified resident at the address below, confirmed through Pantopus address verification.
        </div>

        {/* address block */}
        <div style={{ marginTop: 15, padding: '13px 15px', background: '#f8fafb', border: '1px solid #eef0f2', borderRadius: 11 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 5 }}>Verified address</div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: INK, lineHeight: '20px' }}>{RESIDENT.address1}<br />{RESIDENT.address2}</div>
        </div>

        {/* purpose line — reflects the field above */}
        <div style={{ marginTop: 13, fontSize: 13.5, color: INK2, lineHeight: '21px' }}>
          <span style={{ color: '#9ca3af' }}>Issued for: </span>
          <span style={{ fontWeight: 600, color: INK }}>{purpose && purpose.trim() ? purpose : 'General verification of residency'}</span>
        </div>

        {/* verification footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 18, paddingTop: 15, borderTop: '1px dashed #e2e5e9' }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: HOME_GREEN_BG, border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="badge-check" size={20} color={HOME_GREEN} strokeWidth={2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#15803d' }}>Address verified · {RESIDENT.verifiedOn.replace('Verified ', '')}</div>
            <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 1, fontFamily: 'var(--font-mono)' }}>Ref PTP-RC-2026-0418 · verify at pantopus.com/v</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Plain text field (product-UI; reused look from MoneyField) ──
function PurposeField({ value, onChange }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: MUTE, marginBottom: 7 }}>What is this letter for?</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. New library card application"
        style={{ width: '100%', height: 46, padding: '0 14px', fontSize: 15, fontFamily: 'inherit', color: INK, background: '#fff', border: `1.5px solid ${BORDER}`, borderRadius: 10, outline: 'none', boxSizing: 'border-box' }}
        onFocus={(e) => { e.target.style.borderColor = SKY; e.target.style.boxShadow = '0 0 0 4px rgba(2,132,199,0.12)'; }}
        onBlur={(e) => { e.target.style.borderColor = BORDER; e.target.style.boxShadow = 'none'; }}
      />
      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 7, lineHeight: '17px' }}>Appears on the letter as the stated purpose. Leave blank for general verification.</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Residency letter leaf — purpose field, live preview, delivery
// ─────────────────────────────────────────────────────────────
function ResidencyLetter({ onBack }) {
  const { useState } = React;
  const [purpose, setPurpose] = useState('');
  const [sent, setSent] = useState(null); // 'pdf' | 'mail' | null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f6f7f9' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <DetailHeader title="Residency letter" address={`${RESIDENT.address1} · Portland`} onBack={onBack} />

        <div style={{ padding: '6px 16px 24px' }}>
          <SectionLabel>Purpose</SectionLabel>
          <div className="pl-card" style={{ padding: 16 }}>
            <PurposeField value={purpose} onChange={(v) => { setPurpose(v); setSent(null); }} />
          </div>

          <SectionLabel>Preview</SectionLabel>
          <LetterPreview purpose={purpose} />

          {sent && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 12, padding: '12px 14px', background: '#F0FDF4', border: '1px solid #bbf7d0', borderRadius: 12 }}>
              <Icon name={sent === 'pdf' ? 'download' : 'send'} size={17} color="#15803d" strokeWidth={2} />
              <span style={{ fontSize: 13, color: '#15803d', fontWeight: 600 }}>
                {sent === 'pdf' ? 'Letter downloaded as PDF.' : 'A copy is on its way through your mailbox.'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* sticky delivery bar */}
      <div style={{ padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(14px) saturate(180%)', WebkitBackdropFilter: 'blur(14px) saturate(180%)', borderTop: '1px solid #eef0f2', display: 'flex', gap: 10 }}>
        <button onClick={() => setSent('mail')} className="id-secondary" style={{ flex: 1, height: 50, borderRadius: 13, border: `1.5px solid ${BORDER}`, background: '#fff', color: INK, fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Icon name="mailbox" size={18} color={INK2} strokeWidth={2} /> Mail a copy
        </button>
        <button onClick={() => setSent('pdf')} className="id-primary" style={{ flex: 1, height: 50, borderRadius: 13, border: 'none', background: SKY, color: '#fff', fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 6px 16px rgba(2,132,199,.22)' }}>
          <Icon name="download" size={18} color="#fff" strokeWidth={2.25} /> Download PDF
        </button>
      </div>
    </div>
  );
}

// ── Generate-letter entry card ──
function LetterEntry({ onOpen }) {
  return (
    <button onClick={onOpen} className="hm-prompt" style={{ display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,.04)', padding: 16 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name="file-text" size={22} color={SKY} strokeWidth={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15.5, fontWeight: 600, color: INK, letterSpacing: '-0.01em' }}>Generate a verified residency letter</div>
        <div style={{ fontSize: 12.5, color: '#9ca3af', marginTop: 2 }}>Proof of address you can download or mail</div>
      </div>
      <Icon name="chevron-right" size={18} color="#c4c8cf" strokeWidth={2.25} />
    </button>
  );
}

// ── Portable ID — Coming soon row ──
function PortableIdRow() {
  return (
    <div className="pl-card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 13 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: '#f1f3f5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name="scan-face" size={22} color="#9ca3af" strokeWidth={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15.5, fontWeight: 600, color: INK, letterSpacing: '-0.01em' }}>Portable ID</div>
        <div style={{ fontSize: 12.5, color: '#9ca3af', marginTop: 2 }}>Carry your verified status to other apps</div>
      </div>
      <Chip tone="neutral">Coming soon</Chip>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Assembled Identity detail (navigates to the letter leaf)
// ─────────────────────────────────────────────────────────────
function IdentityDetail() {
  const { useState } = React;
  const [letter, setLetter] = useState(false);

  if (letter) return <ResidencyLetter onBack={() => setLetter(false)} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f6f7f9' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <DetailHeader title="Identity" address="1421 SE Oak St · Portland" onBack={() => {}} />

        <div style={{ padding: '6px 16px 40px' }}>
          <SectionLabel>Verification</SectionLabel>
          <VerifiedStatus />
          <Source name="Address verification · Pantopus" asOf="active" />

          <SectionLabel>Residency letter</SectionLabel>
          <LetterEntry onOpen={() => setLetter(true)} />
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 10, padding: '12px 14px', background: '#fff', border: '1px solid #eef0f2', borderRadius: 12 }}>
            <Icon name="info" size={15} color="#9ca3af" strokeWidth={2} style={{ marginTop: 1 }} />
            <span style={{ fontSize: 12.5, color: MUTE, lineHeight: '18px' }}>A residency letter states your verified address for a purpose you choose — landlords, schools, libraries. It draws only on what you’ve already verified.</span>
          </div>

          <SectionLabel>Portable ID</SectionLabel>
          <PortableIdRow />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  IdentityDetail, ResidencyLetter, VerifiedStatus, LetterPreview, PurposeField,
  LetterEntry, PortableIdRow, RESIDENT, ISSUE_DATE,
});
