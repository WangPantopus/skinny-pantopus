// ─────────────────────────────────────────────────────────────
// Place — C6 · Your Block detail (+ permit detail)
// ContentDetail. Density (qualitative) + a first-to-verify nudge,
// Census neighborhood context, and — in covered metros — a list of
// recent nearby permits. Each permit opens a plain-English leaf
// (what / where / when / status). Uncovered metros get the honest
// "Not available for your area yet." state.
// ─────────────────────────────────────────────────────────────

// ── Census / neighborhood context ──
// Two qualitative facts (median built, median value) + a plain line.
function CensusCard() {
  const stats = [
    { icon: 'calendar', label: 'Median year built', value: '1985' },
    { icon: 'home', label: 'Median home value', value: '$498k' },
  ];
  return (
    <div className="pl-card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 15 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: HOME_GREEN_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="map" size={20} color={HOME_GREEN} strokeWidth={2} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: INK, letterSpacing: '-0.01em' }}>This neighborhood</div>
          <div style={{ fontSize: 12.5, color: '#9ca3af', marginTop: 1 }}>Census tract around your block</div>
        </div>
      </div>
      <div style={{ display: 'flex' }}>
        {stats.map((s, i) => (
          <div key={s.label} style={{ flex: 1, padding: i === 0 ? '0 16px 0 0' : '0 0 0 16px', borderLeft: i === 1 ? '1px solid #f1f3f5' : 'none' }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase', color: '#9ca3af' }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: INK, letterSpacing: '-0.02em', marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 13.5, color: INK2, lineHeight: '20px', marginTop: 15, paddingTop: 15, borderTop: '1px solid #f1f3f5' }}>
        Most homes here went up in the mid-1980s, and the typical one is valued around half a million. Yours sits a little above that.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Permits — data + status meaning
// ─────────────────────────────────────────────────────────────
function permitStatus(s) {
  const m = {
    review: { tone: 'warning', label: 'In review', icon: 'clock', meaning: 'The city is still reviewing this application. No work has been approved yet.' },
    issued: { tone: 'sky', label: 'Issued', icon: 'badge-check', meaning: 'The permit is approved and active. Work can go ahead and will be inspected as it progresses.' },
    final: { tone: 'success', label: 'Final', icon: 'check', meaning: 'The work passed its final inspection and the permit is now closed.' },
  };
  return m[s] || m.issued;
}

const PERMITS = [
  {
    id: 'kitchen', type: 'Kitchen remodel', icon: 'utensils', kind: 'Residential alteration',
    number: '26-148820-RS', date: 'Mar 28', dist: 'Next door', where: 'On SE Oak St · next door',
    status: 'review',
    what: 'Interior remodel of an existing kitchen — new cabinets, counters, and updated plumbing and electrical in the same footprint.',
    steps: [
      { label: 'Filed', date: 'Mar 28, 2026' },
      { label: 'Issued', date: 'Awaiting review' },
      { label: 'Final inspection', date: 'Not yet' },
    ],
  },
  {
    id: 'solar', type: 'Solar panel install', icon: 'sun', kind: 'Residential electrical',
    number: '26-141077-RE', date: 'Mar 9', dist: '0.2 mi away', where: 'On SE Pine St · about 0.2 mi from you',
    status: 'issued',
    what: 'Roof-mounted solar array on a single-family home, with a new inverter and a tie-in to the existing electrical panel.',
    steps: [
      { label: 'Filed', date: 'Mar 9, 2026' },
      { label: 'Issued', date: 'Mar 16, 2026' },
      { label: 'Final inspection', date: 'Scheduled' },
    ],
  },
  {
    id: 'roof', type: 'Roof replacement', icon: 'home', kind: 'Residential alteration',
    number: '26-133904-RS', date: 'Feb 12', dist: '2 blocks away', where: 'On SE Oak St · about 2 blocks from you',
    status: 'final',
    what: 'Tear off the existing roof covering and install new asphalt-shingle roofing on a single-family home.',
    steps: [
      { label: 'Filed', date: 'Feb 12, 2026' },
      { label: 'Issued', date: 'Feb 19, 2026' },
      { label: 'Final inspection', date: 'May 2, 2026' },
    ],
  },
  {
    id: 'water', type: 'Water heater', icon: 'flame', kind: 'Residential plumbing',
    number: '26-130552-RP', date: 'Jan 24', dist: '1 block away', where: 'On SE Spruce St · about 1 block from you',
    status: 'final',
    what: 'Replace a failed gas water heater with a new tankless unit, including the required gas and venting work.',
    steps: [
      { label: 'Filed', date: 'Jan 24, 2026' },
      { label: 'Issued', date: 'Jan 24, 2026' },
      { label: 'Final inspection', date: 'Feb 3, 2026' },
    ],
  },
];

// ── A single permit row ──
function PermitRow({ permit, onClick, isLast }) {
  const st = permitStatus(permit.status);
  return (
    <button onClick={onClick} className="rk-row" style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', border: 'none', background: 'transparent', padding: '12px 14px', borderBottom: isLast ? 'none' : '1px solid #f4f5f7' }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, background: HOME_GREEN_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={permit.icon} size={18} color={HOME_GREEN} strokeWidth={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: INK, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{permit.type}</div>
        <div style={{ fontSize: 12.5, color: '#9ca3af', marginTop: 1 }}>{permit.date} · {permit.dist}</div>
      </div>
      <Chip tone={st.tone}>{st.label}</Chip>
      <Chevron />
    </button>
  );
}

// ── Permits section — covered list OR unavailable state ──
function PermitsList({ covered = true, onOpen }) {
  if (!covered) {
    return (
      <SectionCard
        icon="file-text"
        title="Recent permits"
        state="unavailable"
        caption="Permit records aren't published for your metro yet. Coverage is expanding."
      />
    );
  }
  return (
    <div className="pl-card" style={{ padding: 0, overflow: 'hidden' }}>
      {PERMITS.map((p, i) => (
        <PermitRow key={p.id} permit={p} isLast={i === PERMITS.length - 1} onClick={() => onOpen && onOpen(p)} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Permit detail leaf — what / where / when / status, plain English
// ─────────────────────────────────────────────────────────────
function PermitTimeline({ permit }) {
  const st = permit.status;
  // how far the work has progressed -> which steps are "done"
  const reached = st === 'final' ? 3 : st === 'issued' ? 2 : 1;
  return (
    <div className="pl-card" style={{ padding: '16px 16px 6px' }}>
      {permit.steps.map((step, i) => {
        const done = i < reached;
        const current = i === reached - 1;
        const last = i === permit.steps.length - 1;
        return (
          <div key={step.label} style={{ display: 'flex', gap: 13, position: 'relative' }}>
            {/* rail */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: done ? HOME_GREEN : '#fff', border: done ? `1px solid ${HOME_GREEN}` : '1.75px solid #d8dce1', flexShrink: 0, zIndex: 1 }}>
                {done && <Icon name="check" size={12} color="#fff" strokeWidth={3} />}
              </span>
              {!last && <span style={{ width: 2, flex: 1, minHeight: 26, background: i < reached - 1 ? HOME_GREEN : '#e7eaee' }} />}
            </div>
            {/* label */}
            <div style={{ paddingBottom: last ? 12 : 14, marginTop: -1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: done ? INK : '#9ca3af', letterSpacing: '-0.01em' }}>{step.label}</div>
              <div style={{ fontSize: 12.5, color: current && st !== 'final' ? permitStatus(st).tone === 'warning' ? '#b45309' : MUTE : '#9ca3af', marginTop: 1, fontWeight: current && st !== 'final' ? 600 : 400 }}>{step.date}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PermitDetail({ permit, onBack }) {
  const st = permitStatus(permit.status);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f6f7f9' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <DetailHeader title="Permit" address={permit.where} onBack={onBack} />

        <div style={{ padding: '6px 16px 40px' }}>
          {/* hero — what + status */}
          <div className="pl-card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, background: HOME_GREEN_BG, border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={permit.icon} size={24} color={HOME_GREEN} strokeWidth={2} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: INK, letterSpacing: '-0.015em' }}>{permit.type}</div>
                <div style={{ fontSize: 12.5, color: MUTE, marginTop: 2 }}>{permit.kind} · #{permit.number}</div>
              </div>
            </div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f1f3f5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#9ca3af' }}>Status</span>
              <Chip tone={st.tone} icon={st.icon}>{st.label}</Chip>
            </div>
          </div>

          <SectionLabel>What this is</SectionLabel>
          <div className="pl-card" style={{ padding: '15px 16px', fontSize: 14, color: INK2, lineHeight: '21px' }}>
            {permit.what}
          </div>

          <SectionLabel>Where</SectionLabel>
          <div className="pl-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: HOME_GREEN_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="map-pin" size={18} color={HOME_GREEN} strokeWidth={2} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: INK }}>{permit.where}</div>
              <div style={{ fontSize: 12.5, color: '#9ca3af', marginTop: 1 }}>Generalized to the block to protect privacy</div>
            </div>
          </div>

          <SectionLabel>Timeline</SectionLabel>
          <PermitTimeline permit={permit} />

          {/* plain-English status meaning */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 10, padding: '13px 14px', background: st.tone === 'success' ? '#F0FDF4' : st.tone === 'warning' ? '#FFFBEB' : '#F0F9FF', border: `1px solid ${st.tone === 'success' ? '#bbf7d0' : st.tone === 'warning' ? '#fde68a' : '#bae6fd'}`, borderRadius: 12 }}>
            <Icon name={st.icon} size={16} color={st.tone === 'success' ? '#15803d' : st.tone === 'warning' ? '#b45309' : '#0369a1'} strokeWidth={2} style={{ marginTop: 1 }} />
            <span style={{ fontSize: 13, color: INK2, lineHeight: '19px' }}><b style={{ fontWeight: 600 }}>{st.label}.</b> {st.meaning}</span>
          </div>

          <Source name="City of Portland · Permits & inspections" asOf="updated weekly" />

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 18, padding: '12px 14px', background: '#fff', border: '1px solid #eef0f2', borderRadius: 12 }}>
            <Icon name="info" size={15} color="#9ca3af" strokeWidth={2} style={{ marginTop: 1 }} />
            <span style={{ fontSize: 12.5, color: MUTE, lineHeight: '18px' }}>Building permits are public records published by the city. Shown here for nearby awareness — exact addresses are generalized to the block.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Assembled Your Block detail (navigates to permit leaf) ──
function BlockDetail({ covered = true }) {
  const { useState } = React;
  const [open, setOpen] = useState(null);

  if (open) return <PermitDetail permit={open} onBack={() => setOpen(null)} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f6f7f9' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <DetailHeader title="Your block" address="1421 SE Oak St · Portland" onBack={() => {}} />

        <div style={{ padding: '6px 16px 40px' }}>
          <SectionLabel>Verified homes nearby</SectionLabel>
          <DensityCard bucket="few" />

          <SectionLabel>Neighborhood</SectionLabel>
          <CensusCard />
          <Source name="U.S. Census · American Community Survey" asOf="2020–2024" />

          <SectionLabel>Recent permits nearby</SectionLabel>
          <PermitsList covered={covered} onOpen={setOpen} />
          {covered && <Source name="City of Portland · Permits & inspections" asOf="updated weekly" />}

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 18, padding: '12px 14px', background: '#fff', border: '1px solid #eef0f2', borderRadius: 12 }}>
            <Icon name="info" size={15} color="#9ca3af" strokeWidth={2} style={{ marginTop: 1 }} />
            <span style={{ fontSize: 12.5, color: MUTE, lineHeight: '18px' }}>{covered ? 'Neighborhood figures are typical values for your census tract, not your specific home. Permits are public city records, generalized to the block.' : 'Neighborhood figures are typical values for your census tract, not your specific home.'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  BlockDetail, PermitDetail, CensusCard, PermitsList, PermitRow, PermitTimeline,
  PERMITS, permitStatus,
});
