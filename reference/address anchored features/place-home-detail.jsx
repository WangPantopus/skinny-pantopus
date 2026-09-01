// ─────────────────────────────────────────────────────────────
// Place — C4 · Your Home detail (+ mortgage / equity)
// ContentDetail. Property facts, value estimate with range + a
// value-vs-block sparkline, assessment. A private mortgage input
// turns into an equity figure only the resident can see.
// ─────────────────────────────────────────────────────────────

const fmtUSD = (n) => '$' + Math.round(n).toLocaleString('en-US');
const fmtK = (n) => '$' + Math.round(n / 1000) + 'k';

// ── Property facts — 2×2 grid ──
const HOME_FACTS = [
  { icon: 'calendar', label: 'Year built', value: '1979' },
  { icon: 'ruler', label: 'Living area', value: '1,840 sqft' },
  { icon: 'bed', label: 'Bed · bath', value: '3 bd · 2 ba' },
  { icon: 'trees', label: 'Lot size', value: '5,200 sqft' },
];
function FactsCard() {
  return (
    <div className="pl-card" style={{ padding: 6 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        {HOME_FACTS.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 12px', borderRight: i % 2 === 0 ? '1px solid #f1f3f5' : 'none', borderBottom: i < 2 ? '1px solid #f1f3f5' : 'none' }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: HOME_GREEN_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name={f.icon} size={18} color={HOME_GREEN} strokeWidth={2} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase', color: '#9ca3af' }}>{f.label}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: INK, marginTop: 1 }}>{f.value}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Value vs block dual sparkline ──
function ValueSparkline() {
  const home = '0,30 24,28 48,26 72,21 96,18 120,12 144,9 168,4';
  const block = '0,33 24,32 48,31 72,29 96,28 120,26 144,25 168,23';
  return (
    <svg width="100%" height="62" viewBox="0 0 168 40" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="hmfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={HOME_GREEN} stopOpacity="0.14" />
          <stop offset="100%" stopColor={HOME_GREEN} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,40 ${home} 168,40`} fill="url(#hmfill)" />
      <polyline points={block} fill="none" stroke="#cbd2da" strokeWidth="1.6" strokeDasharray="3 3" strokeLinecap="round" />
      <polyline points={home} fill="none" stroke={HOME_GREEN} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="168" cy="4" r="3" fill={HOME_GREEN} stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}

function ValueCard() {
  return (
    <div className="pl-card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: MUTE }}>Estimated market value</div>
          <div style={{ fontSize: 34, fontWeight: 700, color: INK, letterSpacing: '-0.02em', lineHeight: '40px', marginTop: 3 }}>$612,000</div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 600, color: '#15803d', background: '#F0FDF4', border: '1px solid #bbf7d0', borderRadius: 9999, padding: '4px 10px' }}>
          <Icon name="trending-up" size={13} color="#15803d" strokeWidth={2.5} />
          +4.1% / yr
        </span>
      </div>
      <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 14 }}>Range $590k–$640k</div>

      <ValueSparkline />

      <div style={{ display: 'flex', gap: 18, marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f3f5' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 16, height: 3, borderRadius: 9999, background: HOME_GREEN }} />
          <span style={{ fontSize: 12.5, color: INK2, fontWeight: 500 }}>Your home</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 16, height: 3, borderRadius: 9999, background: '#cbd2da' }} />
          <span style={{ fontSize: 12.5, color: MUTE, fontWeight: 500 }}>Block median</span>
        </div>
      </div>
    </div>
  );
}

// ── Assessment (inline) ──
function AssessmentCard() {
  return (
    <div className="pl-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: HOME_GREEN_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name="landmark" size={18} color={HOME_GREEN} strokeWidth={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: INK }}>Assessed value</div>
        <div style={{ fontSize: 12.5, color: '#9ca3af', marginTop: 1 }}>2025 tax roll · Multnomah County</div>
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: INK }}>$438,200</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Mortgage → equity — private, resident-only input
// ─────────────────────────────────────────────────────────────
const HOME_VALUE = 612000;

function PrivacyNote({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginTop: 12, color: '#9ca3af', fontSize: 12, lineHeight: '17px' }}>
      <Icon name="lock" size={13} color="#b6bcc4" strokeWidth={2} style={{ marginTop: 1 }} />
      <span>{children}</span>
    </div>
  );
}

function MoneyField({ label, prefix, suffix, value, onChange, placeholder }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: INK2, marginBottom: 6 }}>{label}</label>
      <div className="hm-field" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', height: 46, background: '#fff', border: '1.5px solid #e2e6ea', borderRadius: 10 }}>
        {prefix && <span style={{ fontSize: 16, color: MUTE, fontWeight: 500 }}>{prefix}</span>}
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 16, fontWeight: 600, color: INK }}
        />
        {suffix && <span style={{ fontSize: 15, color: MUTE, fontWeight: 500 }}>{suffix}</span>}
      </div>
    </div>
  );
}

function MortgageEquity({ initialStage = 'prompt' }) {
  const { useState } = React;
  const [stage, setStage] = useState(initialStage); // prompt | form | result
  const [balance, setBalance] = useState('358,000');
  const [rate, setRate] = useState('6.5');

  const balanceNum = parseFloat(String(balance).replace(/[^0-9.]/g, '')) || 0;
  const equity = Math.max(0, HOME_VALUE - balanceNum);
  const equityPct = Math.min(100, Math.max(0, (equity / HOME_VALUE) * 100));

  const onBalanceChange = (v) => {
    const digits = v.replace(/[^0-9]/g, '');
    setBalance(digits ? Number(digits).toLocaleString('en-US') : '');
  };

  if (stage === 'prompt') {
    return (
      <button className="hm-prompt" onClick={() => setStage('form')} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,.04)', padding: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="calculator" size={21} color={SKY} strokeWidth={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: INK }}>Add your mortgage to see your equity</div>
          <div style={{ fontSize: 12.5, color: '#9ca3af', marginTop: 2 }}>Private to you — never shown to neighbors</div>
        </div>
        <Icon name="chevron-right" size={18} color="#c4c8cf" strokeWidth={2.25} />
      </button>
    );
  }

  if (stage === 'form') {
    return (
      <div className="pl-card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Icon name="calculator" size={19} color={SKY} strokeWidth={2} />
          <div style={{ fontSize: 16, fontWeight: 700, color: INK, letterSpacing: '-0.01em' }}>Your mortgage</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <MoneyField label="Current loan balance" prefix="$" value={balance} onChange={onBalanceChange} placeholder="0" />
          <MoneyField label="Interest rate" suffix="%" value={rate} onChange={(v) => setRate(v.replace(/[^0-9.]/g, ''))} placeholder="0.0" />
        </div>
        <button className="hm-cta" onClick={() => setStage('result')} style={{ width: '100%', marginTop: 18, height: 48, border: 'none', borderRadius: 12, background: SKY, color: '#fff', fontFamily: 'inherit', fontSize: 15.5, fontWeight: 600, cursor: 'pointer', boxShadow: '0 6px 16px rgba(2,132,199,.18)' }}>
          Calculate my equity
        </button>
        <PrivacyNote>These numbers are stored only on your account and are never shared with neighbors or shown on your public place.</PrivacyNote>
      </div>
    );
  }

  // result
  return (
    <div className="pl-card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: MUTE }}>
            <Icon name="lock" size={13} color="#9ca3af" strokeWidth={2} />
            Your estimated equity
          </div>
          <div style={{ fontSize: 34, fontWeight: 700, color: HOME_GREEN, letterSpacing: '-0.02em', lineHeight: '40px', marginTop: 4 }}>{fmtUSD(equity)}</div>
        </div>
        <button className="hm-edit" onClick={() => setStage('form')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#f1f3f5', border: 'none', borderRadius: 9999, padding: '7px 13px', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: INK2, cursor: 'pointer' }}>
          <Icon name="pencil" size={13} color={INK2} strokeWidth={2.25} />
          Edit
        </button>
      </div>

      <div style={{ fontSize: 13, color: '#9ca3af', margin: '4px 0 14px' }}>{fmtUSD(equity)} of {fmtUSD(HOME_VALUE)} estimated value</div>

      {/* equity vs loan bar */}
      <div style={{ display: 'flex', height: 12, borderRadius: 9999, overflow: 'hidden', background: '#eef1f4' }}>
        <div style={{ width: `${equityPct}%`, background: HOME_GREEN }} />
        <div style={{ flex: 1, background: '#d6dbe1' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 9 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: HOME_GREEN }} />
          <span style={{ fontSize: 12.5, color: INK2, fontWeight: 500 }}>Equity</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: '#d6dbe1' }} />
          <span style={{ fontSize: 12.5, color: MUTE, fontWeight: 500 }}>Loan {fmtUSD(balanceNum)} · {rate || '—'}%</span>
        </div>
      </div>

      <PrivacyNote>Private to you. Calculated from the value estimate minus the balance you entered — not an appraisal or an offer.</PrivacyNote>
    </div>
  );
}

// ── Assembled Your Home detail ──
function HomeDetail() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f6f7f9' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <DetailHeader title="Your home" address="1421 SE Oak St · Portland" onBack={() => {}} />

        <div style={{ padding: '6px 16px 40px' }}>
          <SectionLabel>Property</SectionLabel>
          <FactsCard />

          <SectionLabel>Value</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ValueCard />
            <AssessmentCard />
          </div>
          <Source name="County public records · estimate model" asOf="as of May 2026" />

          <SectionLabel>Equity</SectionLabel>
          <MortgageEquity />

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 22, padding: '12px 14px', background: '#fff', border: '1px solid #eef0f2', borderRadius: 12 }}>
            <Icon name="info" size={15} color="#9ca3af" strokeWidth={2} style={{ marginTop: 1 }} />
            <span style={{ fontSize: 12.5, color: MUTE, lineHeight: '18px' }}>Values are informational, drawn from public records and a pricing model. They aren't an appraisal, a guarantee, or an offer to buy or lend.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  HomeDetail, FactsCard, ValueCard, ValueSparkline, AssessmentCard,
  MortgageEquity, MoneyField, PrivacyNote, HOME_VALUE,
});
