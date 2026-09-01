// ─────────────────────────────────────────────────────────────
// Place — C2 · Multi-home switcher (Switch place)
// A bottom sheet for residents who hold more than one place.
// Each place = a row: address + status (Verified / Claimed) + chevron.
// "Add a place" closes the list. Tapping a place switches context.
// ─────────────────────────────────────────────────────────────

const SW_PLACES = [
  { id: 'oak', line1: '1421 SE Oak St', city: 'Portland, OR', status: 'verified', initials: 'RC' },
  { id: 'marine', line1: '88 Marine Dr', city: 'Astoria, OR', status: 'claimed', initials: 'RC' },
  { id: 'lovejoy', line1: '2207 NW Lovejoy St #4', city: 'Portland, OR', status: 'verified', initials: 'RC' },
];

// ── A status marker — Verified (green) or Claimed (amber) ──
function PlaceStatus({ status }) {
  if (status === 'verified') {
    return <Chip tone="success" icon="shield-check">Verified</Chip>;
  }
  return <Chip tone="warning" icon="home">Claimed</Chip>;
}

// ── One place row inside the sheet ──
function PlaceRow({ place, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="sw-row"
      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', border: 'none', padding: '13px 14px', borderRadius: 14, background: active ? '#F0F9FF' : 'transparent', boxShadow: active ? 'inset 0 0 0 1.5px #bae6fd' : 'none' }}
    >
      <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? '#E0F2FE' : '#f1f3f5' }}>
        <Icon name="house" size={21} color={active ? SKY : '#6b7280'} strokeWidth={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15.5, fontWeight: 600, color: INK, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{place.line1}</div>
        <div style={{ fontSize: 13, color: active ? '#0369a1' : '#9ca3af', marginTop: 2, fontWeight: active ? 600 : 500 }}>
          {active ? 'Current place' : place.city}
        </div>
      </div>
      <PlaceStatus status={place.status} />
      <Icon name="chevron-right" size={18} color="#c4c8cf" strokeWidth={2.25} />
    </button>
  );
}

// ── The switcher sheet ──
function SwitchPlaceSheet({ activeId, onPick, onClose }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, boxShadow: '0 -10px 40px rgba(17,24,39,0.16)', paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 9 }}>
        <div style={{ width: 38, height: 5, borderRadius: 9999, background: '#e2e6ea' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px 8px' }}>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: INK, letterSpacing: '-0.015em' }}>Switch place</h2>
        <button onClick={onClose} className="sw-close" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 9999, border: 'none', background: '#f1f3f5', cursor: 'pointer' }}>
          <Icon name="x" size={17} color="#6b7280" strokeWidth={2.25} />
        </button>
      </div>

      <div style={{ padding: '2px 12px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {SW_PLACES.map((p) => (
            <PlaceRow key={p.id} place={p} active={p.id === activeId} onClick={() => onPick(p.id)} />
          ))}
        </div>

        <div style={{ height: 1, background: '#eef0f2', margin: '8px 14px' }} />

        <button className="sw-row" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', border: 'none', padding: '13px 14px', borderRadius: 14, background: 'transparent' }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#E0F2FE' }}>
            <Icon name="plus" size={21} color={SKY} strokeWidth={2.25} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 600, color: SKY, letterSpacing: '-0.01em' }}>Add a place</div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2, fontWeight: 500 }}>Claim or verify another address</div>
          </div>
          <Icon name="chevron-right" size={18} color="#c4c8cf" strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );
}

// ── Dimmed dashboard peek behind the sheet (reflects the active place) ──
function PlacePeek({ place }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f6f7f9', paddingTop: 54 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '0 18px', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: '#111827', lineHeight: '32px' }}>Your Place</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5, color: '#6b7280' }}>
            <Icon name="map-pin" size={14} color="#9ca3af" strokeWidth={2} />
            <span style={{ fontSize: 14, fontWeight: 500 }}>{place.line1}, {place.city.split(',')[0]}</span>
          </div>
        </div>
        {place.status === 'verified'
          ? <Avatar initials={place.initials} size={40} />
          : <ClaimedAvatar initials={place.initials} size={40} />}
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        <HeroCard variant="allclear" />
      </div>
      <div style={{ padding: '20px 16px 0' }}>
        <GroupLabel>Today</GroupLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SectionCard icon="cloud-sun" title="Weather" value="62°, clear" inline />
          <SectionCard icon="wind" title="Air quality" value="Good (38)" statusDot="#16A34A" inline />
        </div>
      </div>
    </div>
  );
}

// ── Assembled screen: peek + scrim + sheet ──
function SwitchPlaceScreen() {
  const { useState } = React;
  const [activeId, setActiveId] = useState('oak');
  const active = SW_PLACES.find((p) => p.id === activeId);
  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <PlacePeek place={active} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(17,24,39,0.32)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <SwitchPlaceSheet
          activeId={activeId}
          onPick={(id) => setActiveId(id)}
          onClose={() => {}}
        />
      </div>
    </div>
  );
}

Object.assign(window, { SwitchPlaceSheet, PlaceRow, PlaceStatus, PlacePeek, SwitchPlaceScreen, SW_PLACES });
