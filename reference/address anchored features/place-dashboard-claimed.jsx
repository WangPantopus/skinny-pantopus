// ─────────────────────────────────────────────────────────────
// Place — C1 · the ProfileDashboard, CLAIMED (T3, unverified)
// Identical to the verified archetype EXCEPT:
//   • avatar carries a "Claimed" badge, not the green verified check
//   • a gentle verify banner nudge sits above the pulse (routes to B1)
//   • the Band-D items render as LockedCards (messaging / badge / mailbox)
// Everything else is the live verified dashboard, reused verbatim.
// ─────────────────────────────────────────────────────────────

const AMBER = '#D97706';
const AMBER_BG = '#FFFBEB';
const AMBER_BD = '#fde68a';
const B1_HREF = 'Place - Verify Prompt.html';
const goVerify = () => { window.location.href = B1_HREF; };

// ── Claimed avatar — slate disc, amber "Claimed" pill for a badge ──
function ClaimedAvatar({ initials = 'RC', size = 40 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#94a3b8,#64748b)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.34, letterSpacing: 0.2 }}>{initials}</div>
        <div style={{ position: 'absolute', right: -2, bottom: -2, width: size * 0.42, height: size * 0.42, background: AMBER, borderRadius: '50%', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="home" size={size * 0.22} color="#fff" strokeWidth={2.75} />
        </div>
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: AMBER, background: AMBER_BG, border: `1px solid ${AMBER_BD}`, padding: '2px 7px', borderRadius: 9999, lineHeight: '13px' }}>Claimed</span>
    </div>
  );
}

// ── Header — same as verified, claimed avatar on the right ──
function ClaimedHeader() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '0 18px', gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: '#111827', lineHeight: '32px' }}>Your Place</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5, color: '#6b7280' }}>
          <Icon name="map-pin" size={14} color="#9ca3af" strokeWidth={2} />
          <span style={{ fontSize: 14, fontWeight: 500 }}>1421 SE Oak St, Portland</span>
        </div>
      </div>
      <ClaimedAvatar initials="RC" size={40} />
    </div>
  );
}

// ── Verify banner — the gentle nudge, sky/personal toned, routes to B1 ──
function VerifyBanner() {
  return (
    <button
      onClick={goVerify}
      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', padding: '13px 14px', borderRadius: 16, background: '#F0F9FF', border: '1px solid #bae6fd', boxShadow: '0 1px 2px rgba(2,132,199,.06)' }}
      className="pl-verify-banner"
    >
      <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#E0F2FE', border: '1px solid #bae6fd' }}>
        <Icon name="shield-check" size={20} color={SKY} strokeWidth={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: '#0c4a6e', lineHeight: '20px', letterSpacing: '-0.01em' }}>Verify your address to message neighbors and get your badge.</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, color: SKY, fontWeight: 600, fontSize: 13.5 }}>
          Verify address
          <Icon name="arrow-right" size={14} color={SKY} strokeWidth={2.5} />
        </div>
      </div>
      <Icon name="chevron-right" size={18} color="#7dc8ef" strokeWidth={2.25} />
    </button>
  );
}

function ClaimedGroup({ label, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <GroupLabel>{label}</GroupLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  );
}

function PlaceDashboardClaimed({ hero = 'allclear' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'auto', background: '#f6f7f9', paddingTop: 54, paddingBottom: 96 }}>
        <ClaimedHeader />

        {/* the gentle nudge sits above the live pulse */}
        <div style={{ padding: '14px 16px 0' }}>
          <VerifyBanner />
        </div>

        <div style={{ padding: '12px 16px 2px' }}>
          <HeroCard variant={hero} />
        </div>

        <div style={{ padding: '20px 16px 0' }}>
          <ClaimedGroup label="Today">
            <SectionCard icon="cloud-sun" title="Weather" value="62°, clear" inline />
            <SectionCard icon="wind" title="Air quality" value="Good (38)" statusDot="#16A34A" inline />
            <SectionCard icon="bell" title="Alerts" value="None" statusDot="#16A34A" inline />
            <SectionCard icon="sunrise" title="Sunrise & sunset" value="6:42a · 8:11p" inline />
          </ClaimedGroup>

          <ClaimedGroup label="Health & environment">
            <SectionCard icon="test-tube" title="Lead & radon" value="Built 1979 — lead paint possible; test before renovation" caption="Screening, not a diagnosis" />
            <SectionCard icon="droplets" title="Water" value="Portland Water Bureau · no recent health-based violations" />
            <SectionCard icon="factory" title="Environment" state="loading" />
          </ClaimedGroup>

          <ClaimedGroup label="Your home">
            <SectionCard icon="house" title="Your home" value="Built 1979 · 1,840 sqft · est. value $612,000" sparkline asOf="May 2026" />
          </ClaimedGroup>

          <ClaimedGroup label="Risk & readiness">
            <SectionCard icon="waves" title="Flood" chip={{ tone: 'success', text: 'Minimal risk' }} inline />
            <SectionCard icon="life-buoy" title="Emergency plan" action={{ label: 'Build your household plan' }} caption="Not set up yet · 3 quick steps" />
          </ClaimedGroup>

          <ClaimedGroup label="Your block">
            <DensityCard bucket="few" />
            <SectionCard icon="hard-hat" title="Permits" state="unavailable" />
          </ClaimedGroup>

          <ClaimedGroup label="Money signals">
            <SectionCard icon="zap" title="Bill benchmark" value="Your electric bill is 12% above neighbors" chip={{ tone: 'warning', text: '12% above', icon: 'trending-up' }} />
            <SectionCard icon="badge-percent" title="Incentives" value="Heat-pump rebate may apply — you may be eligible, verify" />
            <SectionCard icon="building-2" title="Rent band" state="loading" />
          </ClaimedGroup>

          <ClaimedGroup label="Civic">
            <SectionCard icon="landmark" title="Your districts" action={{ label: 'View your federal, state, and city districts' }} />
            <SectionCard icon="vote" title="Next election" chip={{ tone: 'sky', text: 'In 34 days' }} inline />
          </ClaimedGroup>

          {/* Band-D — verification-gated, shown locked to motivate B1 */}
          <ClaimedGroup label="Locked until you verify">
            <LockedCard icon="message-circle" title="Neighbor messaging" reason="Verify your address to message neighbors." cta="Verify address" onClick={goVerify} />
            <LockedCard icon="badge-check" title="Verified badge" reason="Verify your address to get your verified badge." cta="Verify address" onClick={goVerify} />
            <LockedCard icon="mailbox" title="Your mailbox" reason="Verify your address for your mailbox — packages, civic notices, and permits." cta="Verify address" onClick={goVerify} />
          </ClaimedGroup>
        </div>
      </div>

      <PlaceTabBar active="place" />
    </div>
  );
}

Object.assign(window, { PlaceDashboardClaimed, ClaimedAvatar, VerifyBanner });
