// ─────────────────────────────────────────────────────────────
// Place — C5 · Risk & Readiness detail (+ emergency plan)
// ContentDetail. Flood zone with plain meaning + FEMA source.
// Earthquake / Wildfire deferred. Emergency plan upgrades the old
// manual form into a calm, source-cited, checkable readiness list.
// ─────────────────────────────────────────────────────────────

// ── Flood — zone + plain meaning ──
function FloodCard() {
  return (
    <div className="pl-card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
        <div style={{ width: 46, height: 46, borderRadius: 13, background: HOME_GREEN_BG, border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="waves" size={24} color={HOME_GREEN} strokeWidth={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: INK, letterSpacing: '-0.015em' }}>Zone X</span>
            <Chip tone="success" icon="shield-check">Minimal risk</Chip>
          </div>
          <div style={{ fontSize: 13, color: MUTE, marginTop: 2 }}>FEMA flood hazard area</div>
        </div>
      </div>
      <div style={{ fontSize: 14, color: INK2, lineHeight: '20px', marginTop: 15, paddingTop: 15, borderTop: '1px solid #f1f3f5' }}>
        <b style={{ fontWeight: 600 }}>What this means:</b> Your home sits outside the high-risk flood zones. Flood insurance isn't federally required here — though low-risk areas still account for a meaningful share of claims, so it's worth considering.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Emergency plan — source-cited, checkable readiness list
// ─────────────────────────────────────────────────────────────
const PLAN_GROUPS = [
  {
    label: 'Go-bag essentials',
    icon: 'briefcase',
    items: [
      { id: 'water', title: 'Water', sub: 'One gallon per person per day, 3-day supply', done: true },
      { id: 'food', title: 'Non-perishable food', sub: '3-day supply that needs no cooking', done: true },
      { id: 'light', title: 'Flashlight & spare batteries', sub: 'One per person', done: true },
      { id: 'aid', title: 'First-aid kit', sub: 'Stocked and in-date', done: false },
      { id: 'meds', title: '7-day medication supply', sub: 'Plus copies of prescriptions', done: false },
      { id: 'docs', title: 'Copies of key documents', sub: 'ID, insurance, deed — sealed in a bag', done: false },
    ],
  },
  {
    label: 'Key contacts',
    icon: 'phone',
    items: [
      { id: 'outarea', title: 'Out-of-area contact', sub: 'Aunt Mei · (503) 555-0142', done: true },
      { id: 'utility', title: 'Utility shutoff info', sub: 'Gas, water, and electric main locations', done: false },
      { id: 'insure', title: 'Insurance & policy number', sub: 'Saved where you can reach it offline', done: false },
    ],
  },
  {
    label: 'Meeting point',
    icon: 'map-pin',
    items: [
      { id: 'near', title: 'Nearby spot', sub: 'The big oak at the end of SE Oak St', done: true },
      { id: 'far', title: 'Out-of-neighborhood spot', sub: 'Lincoln HS parking lot, NW 18th', done: false },
    ],
  },
];

function CheckRow({ item, checked, onToggle, isLast }) {
  return (
    <button onClick={onToggle} className="rk-row" style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', border: 'none', background: 'transparent', padding: '11px 14px', borderBottom: isLast ? 'none' : '1px solid #f4f5f7' }}>
      <span style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: checked ? HOME_GREEN : '#fff', border: checked ? `1px solid ${HOME_GREEN}` : '1.75px solid #d1d6dc', transition: 'background .14s ease, border-color .14s ease' }}>
        {checked && <Icon name="check" size={14} color="#fff" strokeWidth={3} />}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: checked ? INK : INK2, letterSpacing: '-0.01em' }}>{item.title}</div>
        <div style={{ fontSize: 12.5, color: '#9ca3af', marginTop: 1 }}>{item.sub}</div>
      </div>
    </button>
  );
}

function EmergencyPlan() {
  const { useState } = React;
  const allItems = PLAN_GROUPS.flatMap((g) => g.items);
  const [checked, setChecked] = useState(() => {
    const s = {};
    allItems.forEach((it) => { if (it.done) s[it.id] = true; });
    return s;
  });
  const doneCount = Object.values(checked).filter(Boolean).length;
  const total = allItems.length;
  const pct = (doneCount / total) * 100;
  const toggle = (id) => setChecked((c) => ({ ...c, [id]: !c[id] }));

  return (
    <div className="pl-card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* progress header */}
      <div style={{ padding: '16px 16px 15px', borderBottom: '1px solid #f1f3f5' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Icon name="life-buoy" size={19} color={HOME_GREEN} strokeWidth={2} />
            <span style={{ fontSize: 16, fontWeight: 700, color: INK, letterSpacing: '-0.01em' }}>Your household plan</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: doneCount === total ? '#15803d' : MUTE }}>{doneCount} of {total} ready</span>
        </div>
        <div style={{ height: 7, borderRadius: 9999, background: '#eef1f4', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 9999, background: HOME_GREEN, transition: 'width .2s ease' }} />
        </div>
      </div>

      {/* groups */}
      {PLAN_GROUPS.map((g, gi) => (
        <div key={g.label} style={{ borderBottom: gi === PLAN_GROUPS.length - 1 ? 'none' : '1px solid #f1f3f5' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 14px 7px' }}>
            <Icon name={g.icon} size={14} color="#9ca3af" strokeWidth={2} />
            <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9ca3af' }}>{g.label}</span>
          </div>
          {g.items.map((it, i) => (
            <CheckRow key={it.id} item={it} checked={!!checked[it.id]} onToggle={() => toggle(it.id)} isLast={i === g.items.length - 1} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Assembled Risk & Readiness detail ──
function RiskDetail() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f6f7f9' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <DetailHeader title="Risk & readiness" address="1421 SE Oak St · Portland" onBack={() => {}} />

        <div style={{ padding: '6px 16px 40px' }}>
          <SectionLabel>Flood</SectionLabel>
          <FloodCard />
          <Source name="FEMA National Flood Hazard Layer" asOf="as of 2024" />

          <SectionLabel>Other hazards</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ComingSoonRow icon="activity" title="Earthquake" sub="Seismic zone and liquefaction risk" />
            <ComingSoonRow icon="flame" title="Wildfire" sub="Wildland-urban interface rating" />
          </div>

          <SectionLabel>Emergency plan</SectionLabel>
          <EmergencyPlan />
          <Source name="Recommended items from Ready.gov & American Red Cross" />

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 18, padding: '12px 14px', background: '#fff', border: '1px solid #eef0f2', borderRadius: 12 }}>
            <Icon name="info" size={15} color="#9ca3af" strokeWidth={2} style={{ marginTop: 1 }} />
            <span style={{ fontSize: 12.5, color: MUTE, lineHeight: '18px' }}>Informational, not emergency instructions. In a real emergency, call 911 and follow guidance from local officials.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { RiskDetail, FloodCard, EmergencyPlan, CheckRow, PLAN_GROUPS });
