// ─────────────────────────────────────────────────────────────
// Place — C7 · Money Signals detail (+ tax appeal info)
// ContentDetail. Everything informational, never advice.
//  • Bill benchmark — your electric bill vs similar homes, peer-relative.
//  • Incentives (DSIRE) — programs you may be eligible for; verify w/ provider.
//  • Rent band (HUD) — 2BR market band + your rent vs band (private input).
//  • Tax check — your assessment vs nearby comps + "How appeals work" leaf.
// ─────────────────────────────────────────────────────────────

const usd = (n) => '$' + Math.round(n).toLocaleString('en-US');

// ── Bill benchmark — peer-relative comparison bar ──
function BillBenchmark() {
  const low = 90, high = 280;
  const pos = (v) => ((v - low) / (high - low)) * 100;
  const your = 142, bandLo = 165, bandHi = 210;
  return (
    <div className="pl-card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: HOME_GREEN_BG, border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="zap" size={22} color={HOME_GREEN} strokeWidth={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: MUTE }}>Electric · monthly average</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginTop: 1 }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: INK, letterSpacing: '-0.02em' }}>$142</span>
            <span style={{ fontSize: 14.5, fontWeight: 600, color: '#15803d' }}>Lower than typical</span>
          </div>
        </div>
      </div>

      {/* comparison track */}
      <div style={{ position: 'relative', height: 14, marginTop: 20, marginBottom: 9 }}>
        <div style={{ position: 'absolute', top: 3, left: 0, right: 0, height: 8, borderRadius: 9999, background: '#eef1f4', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${pos(bandLo)}%`, width: `${pos(bandHi) - pos(bandLo)}%`, background: '#bbf7d0' }} />
        </div>
        <div style={{ position: 'absolute', top: 0, left: `${pos(your)}%`, transform: 'translateX(-50%)', width: 14, height: 14, borderRadius: '50%', background: '#fff', border: `3px solid ${HOME_GREEN}`, boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: '#b6bcc4', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
        <span>Lower</span><span>Typical for your area</span><span>Higher</span>
      </div>

      <div style={{ fontSize: 14, color: INK2, lineHeight: '20px', marginTop: 15, paddingTop: 15, borderTop: '1px solid #f1f3f5' }}>
        <b style={{ fontWeight: 600 }}>What this means:</b> Your bill runs lower than most homes like yours nearby — similar size, similar age. The shaded band is what comparable 3-bed homes typically pay.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Incentives — DSIRE programs you may be eligible for
// ─────────────────────────────────────────────────────────────
const INCENTIVES = [
  { id: 'fed', icon: 'sun', name: 'Residential Clean Energy Credit', meta: 'Federal · tax credit', detail: '30% of the cost of solar or battery storage, claimed on your federal return.' },
  { id: 'eto', icon: 'thermometer', name: 'Energy Trust of Oregon rebates', meta: 'Utility · rebate', detail: 'Cash back on heat pumps, insulation, and efficient windows.' },
  { id: 'storage', icon: 'battery-charging', name: 'Solar + Storage Rebate', meta: 'State · upfront rebate', detail: 'An upfront rebate for solar paired with home battery storage.' },
  { id: 'hpwh', icon: 'droplet', name: 'Heat-pump water heater discount', meta: 'Utility · instant discount', detail: 'Taken off at checkout through participating installers.' },
];

function IncentiveRow({ item, isLast }) {
  return (
    <div className="rk-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 14px', borderBottom: isLast ? 'none' : '1px solid #f4f5f7' }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, background: HOME_GREEN_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
        <Icon name={item.icon} size={18} color={HOME_GREEN} strokeWidth={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14.5, fontWeight: 600, color: INK, letterSpacing: '-0.01em' }}>{item.name}</span>
          <Chip tone="sky">You may be eligible</Chip>
        </div>
        <div style={{ fontSize: 12.5, color: '#9ca3af', marginTop: 2 }}>{item.meta}</div>
        <div style={{ fontSize: 13, color: INK2, lineHeight: '19px', marginTop: 5 }}>{item.detail}</div>
      </div>
    </div>
  );
}

function IncentivesList() {
  return (
    <div className="pl-card" style={{ padding: 0, overflow: 'hidden' }}>
      {INCENTIVES.map((it, i) => (
        <IncentiveRow key={it.id} item={it} isLast={i === INCENTIVES.length - 1} />
      ))}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '11px 14px', background: '#fafbfc', borderTop: '1px solid #f1f3f5' }}>
        <Icon name="info" size={14} color="#9ca3af" strokeWidth={2} style={{ marginTop: 1 }} />
        <span style={{ fontSize: 12.5, color: MUTE, lineHeight: '18px' }}>Eligibility is an estimate based on your address and home. Verify the details and amounts with each provider before counting on them.</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Rent band — HUD market band + private resident input
// ─────────────────────────────────────────────────────────────
function RentBand() {
  const { useState } = React;
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const [rent, setRent] = useState('2,350');

  const min = 1800, max = 2900;
  const pos = (v) => ((v - min) / (max - min)) * 100;
  const bandLo = 2120, bandHi = 2600;
  const rnum = parseFloat(String(rent).replace(/[^0-9.]/g, '')) || 0;
  const within = rnum >= bandLo && rnum <= bandHi;
  const verdict = within ? { text: 'Within the band', tone: 'success' } : rnum < bandLo ? { text: 'Below the band', tone: 'sky' } : { text: 'Above the band', tone: 'warning' };

  const onRentChange = (v) => {
    const d = v.replace(/[^0-9]/g, '');
    setRent(d ? Number(d).toLocaleString('en-US') : '');
  };

  return (
    <div className="pl-card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: HOME_GREEN_BG, border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="building" size={22} color={HOME_GREEN} strokeWidth={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: MUTE }}>2-bedroom market band</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: INK, letterSpacing: '-0.02em', marginTop: 1 }}>$2,120 – $2,600</div>
        </div>
      </div>
      <div style={{ fontSize: 13, color: '#9ca3af' }}>Typical asking rent for your area</div>

      {/* band track */}
      <div style={{ position: 'relative', height: 14, marginTop: 18, marginBottom: 9 }}>
        <div style={{ position: 'absolute', top: 3, left: 0, right: 0, height: 8, borderRadius: 9999, background: '#eef1f4', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${pos(bandLo)}%`, width: `${pos(bandHi) - pos(bandLo)}%`, background: '#bbf7d0' }} />
        </div>
        {shown && rnum > 0 && (
          <div style={{ position: 'absolute', top: 0, left: `${Math.min(100, Math.max(0, pos(rnum)))}%`, transform: 'translateX(-50%)', width: 14, height: 14, borderRadius: '50%', background: '#fff', border: `3px solid ${SKY}`, boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: '#b6bcc4' }}>
        <span>$1,800</span><span>Market band</span><span>$2,900</span>
      </div>

      {/* resident input */}
      {shown && rnum > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 15, borderTop: '1px solid #f1f3f5' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: MUTE }}>
              <Icon name="lock" size={12} color="#9ca3af" strokeWidth={2} /> Your rent
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: INK, marginTop: 2 }}>{usd(rnum)}<span style={{ fontSize: 13, fontWeight: 500, color: MUTE }}> /mo</span></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 7 }}>
            <Chip tone={verdict.tone}>{verdict.text}</Chip>
            <button onClick={() => setOpen(true) || setShown(false)} className="pl-textbtn" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: SKY, fontWeight: 600, fontSize: 13, fontFamily: 'inherit' }}>Edit</button>
          </div>
        </div>
      ) : open ? (
        <div style={{ marginTop: 16, paddingTop: 15, borderTop: '1px solid #f1f3f5' }}>
          <MoneyField label="Your monthly rent" prefix="$" value={rent} onChange={onRentChange} placeholder="0" />
          <button onClick={() => { setShown(true); setOpen(false); }} style={{ width: '100%', marginTop: 13, height: 46, border: 'none', borderRadius: 12, background: SKY, color: '#fff', fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer', boxShadow: '0 6px 16px rgba(2,132,199,.18)' }}>
            Show where I fall
          </button>
          <PrivacyNote>Stored only on your account — never shown to neighbors or on your public place.</PrivacyNote>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="hm-prompt" style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', marginTop: 16, textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', background: '#f8fafb', border: '1px solid #eef0f2', borderRadius: 12, padding: '12px 13px' }}>
          <Icon name="plus-circle" size={19} color={SKY} strokeWidth={2} />
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: INK2 }}>Add your rent to see where you fall</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#9ca3af', fontWeight: 500 }}><Icon name="lock" size={12} color="#9ca3af" strokeWidth={2} />Private</span>
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tax check — assessment vs nearby comps + appeals entry
// ─────────────────────────────────────────────────────────────
const TAX_COMPS = [
  { addr: 'SE Oak St · 2 doors down', v: 445600 },
  { addr: 'SE Oak St · across the street', v: 421300 },
  { addr: 'SE Pine St · 1 block over', v: 452800 },
];

function TaxCheck({ onAppeal }) {
  return (
    <>
      <div className="pl-card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: HOME_GREEN_BG, border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="landmark" size={22} color={HOME_GREEN} strokeWidth={2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: MUTE }}>Your assessed value</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: INK, letterSpacing: '-0.02em', marginTop: 1 }}>$438,200</div>
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: '#9ca3af', marginTop: 3 }}>2025 tax roll · Multnomah County</div>

        <div style={{ marginTop: 15, paddingTop: 14, borderTop: '1px solid #f1f3f5' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 9 }}>Nearby comparable assessments</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {TAX_COMPS.map((c) => (
              <div key={c.addr} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <Icon name="map-pin" size={14} color="#b6bcc4" strokeWidth={2} />
                  <span style={{ fontSize: 13.5, color: INK2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.addr}</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: INK, flexShrink: 0 }}>{usd(c.v)}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 14, color: INK2, lineHeight: '20px', marginTop: 15, paddingTop: 14, borderTop: '1px solid #f1f3f5' }}>
          <b style={{ fontWeight: 600 }}>What this means:</b> Your assessment sits in line with nearby homes of similar size and age. Assessed value is a county figure for taxes, not a market price.
        </div>
      </div>

      {/* appeals entry */}
      <button onClick={onAppeal} className="hm-prompt" style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', marginTop: 10, textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,.04)', padding: 15 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="scale" size={20} color={SKY} strokeWidth={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: INK }}>How appeals work in your county</div>
          <div style={{ fontSize: 12.5, color: '#9ca3af', marginTop: 2 }}>A plain walk-through of the process</div>
        </div>
        <Icon name="chevron-right" size={18} color="#c4c8cf" strokeWidth={2.25} />
      </button>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Appeal info leaf — plain process explanation, no advice
// ─────────────────────────────────────────────────────────────
const APPEAL_STEPS = [
  { title: 'Check your deadline', body: 'Appeals open after the county mails assessments in the fall. The window is short — often closing December 31.' },
  { title: 'File a petition', body: 'Submit a form to the county Board of Property Tax Appeals (BoPTA). The filing fee is small or none.' },
  { title: 'Gather your evidence', body: 'Recent sales of similar nearby homes, photos of the home’s condition, or an independent appraisal.' },
  { title: 'Attend the hearing', body: 'A short, informal review. You can appear in person or let the board consider your written materials.' },
  { title: 'Get a decision', body: 'The board either adjusts the value or leaves it as is. If you disagree, you can appeal to the Oregon Tax Court.' },
];

function AppealInfo({ onBack }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f6f7f9' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <DetailHeader title="Property tax appeals" address="Multnomah County, Oregon" onBack={onBack} />

        <div style={{ padding: '6px 16px 40px' }}>
          <div className="pl-card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#E0F2FE', border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="scale" size={22} color={SKY} strokeWidth={2} />
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: INK, letterSpacing: '-0.015em', lineHeight: '22px' }}>How an appeal works</div>
            </div>
            <div style={{ fontSize: 14, color: INK2, lineHeight: '21px' }}>If you believe your assessed value is too high, you can ask the county to review it. Here is the general process, step by step.</div>
          </div>

          <SectionLabel>The process</SectionLabel>
          <div className="pl-card" style={{ padding: '16px 16px 6px' }}>
            {APPEAL_STEPS.map((s, i) => {
              const last = i === APPEAL_STEPS.length - 1;
              return (
                <div key={s.title} style={{ display: 'flex', gap: 13 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#E0F2FE', color: '#0369a1', fontSize: 12.5, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                    {!last && <span style={{ width: 2, flex: 1, minHeight: 18, background: '#e7eaee' }} />}
                  </div>
                  <div style={{ paddingBottom: last ? 14 : 16, marginTop: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: INK, letterSpacing: '-0.01em' }}>{s.title}</div>
                    <div style={{ fontSize: 13, color: MUTE, lineHeight: '19px', marginTop: 3 }}>{s.body}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <Source name="Multnomah County Assessor · Oregon BoPTA" asOf="general process" />

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 18, padding: '13px 14px', background: '#FFFBEB', border: '1px solid #fde68a', borderRadius: 12 }}>
            <Icon name="info" size={16} color="#b45309" strokeWidth={2} style={{ marginTop: 1 }} />
            <span style={{ fontSize: 12.5, color: INK2, lineHeight: '18px' }}>Informational only. This explains the general process — it is not legal or tax advice, and it does not predict any change to your taxes. Check your county’s official site for exact dates and forms.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Assembled Money Signals detail (navigates to appeal leaf) ──
function MoneyDetail() {
  const { useState } = React;
  const [appeal, setAppeal] = useState(false);

  if (appeal) return <AppealInfo onBack={() => setAppeal(false)} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f6f7f9' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <DetailHeader title="Money signals" address="1421 SE Oak St · Portland" onBack={() => {}} />

        <div style={{ padding: '6px 16px 40px' }}>
          <SectionLabel>Bill benchmark</SectionLabel>
          <BillBenchmark />
          <Source name="Your utility · peer comparison" asOf="12-month average" />

          <SectionLabel>Incentives you may qualify for</SectionLabel>
          <IncentivesList />
          <Source name="DSIRE · Database of State Incentives for Renewables & Efficiency" />

          <SectionLabel>Rent</SectionLabel>
          <RentBand />
          <Source name="HUD Fair Market Rents" asOf="FY 2026" />

          <SectionLabel>Property tax</SectionLabel>
          <TaxCheck onAppeal={() => setAppeal(true)} />
          <Source name="County assessor · public records" asOf="2025 roll" />

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 18, padding: '12px 14px', background: '#fff', border: '1px solid #eef0f2', borderRadius: 12 }}>
            <Icon name="info" size={15} color="#9ca3af" strokeWidth={2} style={{ marginTop: 1 }} />
            <span style={{ fontSize: 12.5, color: MUTE, lineHeight: '18px' }}>Everything here is informational, drawn from public data and your own entries. It isn’t financial, tax, or legal advice, and amounts aren’t guarantees.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  MoneyDetail, AppealInfo, BillBenchmark, IncentivesList, IncentiveRow,
  RentBand, TaxCheck, INCENTIVES, TAX_COMPS, APPEAL_STEPS,
});
