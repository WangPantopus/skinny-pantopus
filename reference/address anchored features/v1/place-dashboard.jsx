// ─────────────────────────────────────────────────────────────
// Place — the assembled ProfileDashboard (verified tier)
// ─────────────────────────────────────────────────────────────

function PlaceHeader() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '0 18px', gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: '#111827', lineHeight: '32px' }}>Your Place</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5, color: '#6b7280' }}>
          <Icon name="map-pin" size={14} color="#9ca3af" strokeWidth={2} />
          <span style={{ fontSize: 14, fontWeight: 500 }}>1421 SE Oak St, Portland</span>
        </div>
      </div>
      <Avatar initials="RC" size={40} />
    </div>
  );
}

function PlaceTabBar({ active = 'place' }) {
  const tabs = [
    { id: 'place', label: 'Place', icon: 'house' },
    { id: 'neighborhood', label: 'Neighborhood', icon: 'map' },
    { id: 'beacon', label: 'Beacon', icon: 'radio-tower' },
    { id: 'inbox', label: 'Inbox', icon: 'inbox' },
  ];
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 40, height: 78, paddingBottom: 22, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(14px) saturate(180%)', WebkitBackdropFilter: 'blur(14px) saturate(180%)', borderTop: '1px solid #ececef', display: 'flex', alignItems: 'flex-start', paddingTop: 9 }}>
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <div key={t.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: on ? HOME_GREEN : '#9ca3af' }}>
            <Icon name={t.icon} size={23} color={on ? HOME_GREEN : '#9ca3af'} strokeWidth={on ? 2.25 : 2} />
            <span style={{ fontSize: 10.5, fontWeight: on ? 700 : 500, letterSpacing: '-0.01em' }}>{t.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function Group({ label, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <GroupLabel>{label}</GroupLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}

function PlaceDashboard({ hero = 'allclear' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'auto', background: '#f6f7f9', paddingTop: 54, paddingBottom: 96 }}>
        <PlaceHeader />

        <div style={{ padding: '16px 16px 0' }}>
          <HeroCard variant={hero} />
        </div>

        <div style={{ padding: '18px 16px 0' }}>
          <Group label="Today">
            <SectionCard icon="cloud-sun" title="Weather" value="62°, clear" asOf="9:40 AM" compact />
            <SectionCard icon="wind" title="Air quality" value="Good (38)" chip={{ tone: 'success', text: 'Good', icon: 'check' }} />
            <SectionCard icon="bell" title="Alerts" value="No active alerts" />
            <SectionCard icon="sunrise" title="Sunrise & sunset" value="6:42 AM · 8:11 PM" compact />
          </Group>

          <Group label="Health & environment">
            <SectionCard icon="test-tube" title="Lead & radon" value="Built 1979 — lead paint possible; test before renovation" caption="Screening, not a diagnosis" />
            <SectionCard icon="droplets" title="Water" value="Portland Water Bureau · no recent health-based violations" />
            <SectionCard icon="factory" title="Environment" state="loading" />
          </Group>

          <Group label="Your home">
            <SectionCard icon="house" title="Your home" value="Built 1979 · 1,840 sqft · est. value $612,000" sparkline asOf="May 2026" />
          </Group>

          <Group label="Risk & readiness">
            <SectionCard icon="waves" title="Flood" value="Zone X — minimal risk" chip={{ tone: 'success', text: 'Minimal risk' }} />
            <SectionCard icon="life-buoy" title="Emergency plan" action={{ label: 'Build your household plan' }} caption="Not set up yet · 3 quick steps" />
          </Group>

          <Group label="Your block">
            <DensityCard bucket="few" />
            <SectionCard icon="hard-hat" title="Permits" state="unavailable" />
          </Group>

          <Group label="Money signals">
            <SectionCard icon="zap" title="Bill benchmark" value="Your electric bill is 12% above neighbors" chip={{ tone: 'warning', text: '12% above', icon: 'trending-up' }} />
            <SectionCard icon="badge-percent" title="Incentives" value="Heat-pump rebate may apply — you may be eligible, verify" />
            <SectionCard icon="building-2" title="Rent band" state="loading" />
          </Group>

          <Group label="Civic">
            <SectionCard icon="landmark" title="Your districts" action={{ label: 'View your federal, state, and city districts' }} />
            <SectionCard icon="vote" title="Next election" value="In 34 days · view your ballot" chip={{ tone: 'sky', text: '34 days' }} />
          </Group>

          <Group label="Identity">
            <SectionCard icon="badge-check" title="Identity" value="Verified" chip={{ tone: 'success', text: 'Address-proven', icon: 'shield-check' }} />
            <SectionCard icon="file-text" title="Residency letter" action={{ label: 'Generate a residency letter' }} />
          </Group>
        </div>
      </div>

      <PlaceTabBar active="place" />
    </div>
  );
}

Object.assign(window, { PlaceDashboard, PlaceHeader, PlaceTabBar, Group });
