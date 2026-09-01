// ─────────────────────────────────────────────────────────────
// Place — C3 · Today / Environment detail (ContentDetail layout)
// Tap-through from the Today group. Current weather + hourly + 5-day,
// AQI with scale & plain meaning, NWS alerts (list or none), sun.
// Post-V1 rows shown unavailable. Source + "as of" captions throughout.
// ─────────────────────────────────────────────────────────────

// ── Detail header — back chevron + title + address ──
function DetailHeader({ title = 'Today', address = '1421 SE Oak St · Portland', onBack }) {
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 30, paddingTop: 52, background: 'rgba(246,247,249,0.86)', backdropFilter: 'blur(14px) saturate(180%)', WebkitBackdropFilter: 'blur(14px) saturate(180%)', borderBottom: '1px solid #ececef' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px 12px' }}>
        <button onClick={onBack} className="td-back" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 9999, border: 'none', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.06)', cursor: 'pointer', flexShrink: 0 }}>
          <Icon name="chevron-left" size={20} color={INK2} strokeWidth={2.5} />
        </button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: INK, letterSpacing: '-0.02em', lineHeight: '24px' }}>{title}</div>
          <div style={{ fontSize: 12.5, color: '#9ca3af', fontWeight: 500, marginTop: 1 }}>{address}</div>
        </div>
      </div>
    </div>
  );
}

// ── Source / as-of caption ──
function Source({ name, asOf }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, color: '#9ca3af', fontSize: 12 }}>
      <Icon name="circle-small" size={5} color="#cbd0d6" strokeWidth={6} style={{ display: 'none' }} />
      <span style={{ fontWeight: 500 }}>{name}</span>
      {asOf && <><span style={{ opacity: 0.5 }}>·</span><span>{asOf}</span></>}
    </div>
  );
}

function SectionLabel({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af', padding: '0 4px', margin: '26px 0 9px' }}>{children}</div>;
}

// ── Weather glyph ──
function Wx({ name, size = 22, color = '#6b7280' }) {
  return <Icon name={name} size={size} color={color} strokeWidth={2} />;
}

// ── Now / current conditions hero ──
function NowCard() {
  return (
    <div className="pl-card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: MUTE, letterSpacing: '0.01em' }}>Now</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 2, marginTop: 2 }}>
            <span style={{ fontSize: 56, fontWeight: 300, color: INK, lineHeight: '60px', letterSpacing: '-0.03em' }}>62</span>
            <span style={{ fontSize: 24, fontWeight: 300, color: INK, marginTop: 6 }}>°</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: INK2, marginTop: 2 }}>Clear</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
          <div style={{ width: 54, height: 54, borderRadius: 15, background: '#FEF9C3', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #fde68a' }}>
            <Wx name="sun" size={30} color="#D97706" />
          </div>
          <div style={{ textAlign: 'right', fontSize: 13.5, color: MUTE, lineHeight: '19px' }}>
            <div>H 68° · L 49°</div>
            <div>Feels like 60°</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Hourly strip ──
const HOURS = [
  { h: 'Now', t: 62, w: 'sun' },
  { h: '10a', t: 63, w: 'sun' },
  { h: '11a', t: 64, w: 'sun' },
  { h: '12p', t: 66, w: 'cloud-sun' },
  { h: '1p', t: 67, w: 'cloud-sun' },
  { h: '2p', t: 68, w: 'cloud' },
  { h: '3p', t: 67, w: 'cloud' },
  { h: '4p', t: 65, w: 'cloud-sun' },
  { h: '5p', t: 62, w: 'cloud-sun' },
];
function HourlyStrip() {
  return (
    <div className="pl-card" style={{ padding: '14px 4px' }}>
      <div className="td-hscroll" style={{ display: 'flex', overflowX: 'auto', gap: 2, paddingBottom: 2 }}>
        {HOURS.map((x, i) => (
          <div key={i} style={{ flex: '0 0 auto', width: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, padding: '2px 0' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: i === 0 ? INK : MUTE }}>{x.h}</span>
            <Wx name={x.w} size={21} color={x.w === 'sun' ? '#D97706' : '#94a3b8'} />
            <span style={{ fontSize: 15, fontWeight: 600, color: INK }}>{x.t}°</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 5-day forecast ──
const DAYS = [
  { d: 'Today', w: 'sun', p: null, lo: 49, hi: 68 },
  { d: 'Fri', w: 'cloud-sun', p: 10, lo: 51, hi: 70 },
  { d: 'Sat', w: 'cloud-rain', p: 60, lo: 50, hi: 64 },
  { d: 'Sun', w: 'cloud-rain', p: 40, lo: 48, hi: 61 },
  { d: 'Mon', w: 'cloud-sun', p: 10, lo: 49, hi: 66 },
];
const WK_LO = 46, WK_HI = 72;
function ForecastRow({ day, isLast }) {
  const left = ((day.lo - WK_LO) / (WK_HI - WK_LO)) * 100;
  const width = ((day.hi - day.lo) / (WK_HI - WK_LO)) * 100;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: isLast ? 'none' : '1px solid #f1f3f5' }}>
      <span style={{ width: 44, fontSize: 14.5, fontWeight: 600, color: INK, flexShrink: 0 }}>{day.d}</span>
      <div style={{ width: 30, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
        <Wx name={day.w} size={19} color={day.w === 'sun' ? '#D97706' : day.w === 'cloud-rain' ? '#3b82f6' : '#94a3b8'} />
      </div>
      <span style={{ width: 30, fontSize: 12.5, color: day.p ? '#3b82f6' : 'transparent', flexShrink: 0, fontWeight: 600 }}>{day.p ? `${day.p}%` : '–'}</span>
      <span style={{ width: 26, fontSize: 14.5, color: '#9ca3af', textAlign: 'right', flexShrink: 0 }}>{day.lo}°</span>
      <div style={{ flex: 1, height: 5, borderRadius: 9999, background: '#eef1f4', position: 'relative', minWidth: 40 }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${left}%`, width: `${width}%`, borderRadius: 9999, background: 'linear-gradient(90deg,#60a5fa,#fbbf24)' }} />
      </div>
      <span style={{ width: 26, fontSize: 14.5, fontWeight: 600, color: INK, textAlign: 'right', flexShrink: 0 }}>{day.hi}°</span>
    </div>
  );
}
function ForecastList() {
  return (
    <div className="pl-card" style={{ padding: 0, overflow: 'hidden' }}>
      {DAYS.map((d, i) => <ForecastRow key={i} day={d} isLast={i === DAYS.length - 1} />)}
    </div>
  );
}

// ── AQI with scale + plain meaning ──
const AQI_BANDS = [
  { label: 'Good', c: '#16A34A' },
  { label: 'Moderate', c: '#EAB308' },
  { label: 'USG', c: '#F97316' },
  { label: 'Unhealthy', c: '#DC2626' },
  { label: 'Very', c: '#7C3AED' },
  { label: 'Hazard', c: '#7f1d1d' },
];
function AqiCard() {
  const value = 38;
  const marker = ((value / 50) * (1 / 6)) * 100; // within the first (Good) band
  return (
    <div className="pl-card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 38, fontWeight: 600, color: INK, letterSpacing: '-0.02em', lineHeight: '40px' }}>{value}</span>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#15803d' }}>Good</span>
          </div>
          <div style={{ fontSize: 13, color: MUTE, marginTop: 3 }}>US Air Quality Index (PM2.5)</div>
        </div>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: HOME_GREEN_BG, border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="wind" size={23} color={HOME_GREEN} strokeWidth={2} />
        </div>
      </div>

      {/* scale */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <div style={{ display: 'flex', height: 8, borderRadius: 9999, overflow: 'hidden' }}>
          {AQI_BANDS.map((b, i) => <div key={i} style={{ flex: 1, background: b.c }} />)}
        </div>
        <div style={{ position: 'absolute', top: -3, left: `${marker}%`, transform: 'translateX(-50%)', width: 14, height: 14, borderRadius: '50%', background: '#fff', border: `3px solid ${HOME_GREEN}`, boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, fontWeight: 600, color: '#b6bcc4', letterSpacing: '0.01em', textTransform: 'uppercase' }}>
        <span>Good</span><span>Mod</span><span>USG</span><span>Unhlthy</span><span>V.Unhl</span><span>Hazard</span>
      </div>

      <div style={{ fontSize: 14, color: INK2, lineHeight: '20px', marginTop: 14, paddingTop: 14, borderTop: '1px solid #f1f3f5' }}>
        <b style={{ fontWeight: 600 }}>What it means:</b> Air quality is good. It's a fine day to be active outdoors, with no precautions needed.
      </div>
    </div>
  );
}

// ── Alerts — list or "No active alerts" ──
function AlertsCard({ active = false }) {
  if (!active) {
    return (
      <div className="pl-card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: HOME_GREEN_BG, border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="check" size={21} color={HOME_GREEN} strokeWidth={2.5} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: INK }}>No active alerts</div>
          <div style={{ fontSize: 13, color: MUTE, marginTop: 2 }}>No weather or hazard warnings for your area.</div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <AlertRow tone="warning" icon="wind" title="Wind Advisory" until="In effect until 6:00 PM today" body="Southwest winds 20–30 mph with gusts up to 45 mph. Secure loose outdoor objects." />
      <AlertRow tone="sky" icon="cloud-rain" title="Flood Watch" until="Through Saturday evening" body="Heavy rain may cause minor flooding in low-lying and poor-drainage areas." />
    </div>
  );
}
function AlertRow({ tone = 'warning', icon, title, until, body }) {
  const c = tone === 'warning'
    ? { bg: '#FFFBEB', bd: '#fde68a', fg: '#b45309', tile: '#fef3c7' }
    : { bg: '#F0F9FF', bd: '#bae6fd', fg: '#0369a1', tile: '#e0f2fe' };
  return (
    <div className="pl-card" style={{ padding: 15, background: c.bg, borderColor: c.bd }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 9 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: c.tile, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name={icon} size={18} color={c.fg} strokeWidth={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: INK, letterSpacing: '-0.01em' }}>{title}</div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: c.fg, marginTop: 1 }}>{until}</div>
        </div>
      </div>
      <div style={{ fontSize: 13.5, color: INK2, lineHeight: '19px' }}>{body}</div>
    </div>
  );
}

// ── Sun — sunrise / sunset with arc ──
function SunCard() {
  return (
    <div className="pl-card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ textAlign: 'center' }}>
          <Icon name="sunrise" size={22} color="#D97706" strokeWidth={2} />
          <div style={{ fontSize: 17, fontWeight: 600, color: INK, marginTop: 4 }}>6:42 AM</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>Sunrise</div>
        </div>
        <div style={{ flex: 1, padding: '0 18px' }}>
          <svg width="100%" height="50" viewBox="0 0 200 56" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
            <path d="M4 52 A 96 70 0 0 1 196 52" fill="none" stroke="#e7eaee" strokeWidth="2" strokeDasharray="2 4" />
            <path d="M4 52 A 96 70 0 0 1 130 12" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="130" cy="12" r="5.5" fill="#fbbf24" stroke="#fff" strokeWidth="2" />
          </svg>
          <div style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 2 }}>13h 29m of daylight</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <Icon name="sunset" size={22} color="#b45309" strokeWidth={2} />
          <div style={{ fontSize: 17, fontWeight: 600, color: INK, marginTop: 4 }}>8:11 PM</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>Sunset</div>
        </div>
      </div>
    </div>
  );
}

// ── Coming-soon (post-V1) row ──
function ComingSoonRow({ icon, title, sub }) {
  return (
    <div className="pl-card" style={{ padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 12, opacity: 0.92 }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, background: '#f1f3f5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={19} color="#9ca3af" strokeWidth={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#6b7280' }}>{title}</div>
        <div style={{ fontSize: 12.5, color: '#9ca3af', marginTop: 1 }}>{sub}</div>
      </div>
      <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#9ca3af', background: '#f1f3f5', border: '1px solid #e5e7eb', padding: '3px 9px', borderRadius: 9999, whiteSpace: 'nowrap' }}>Coming soon</span>
    </div>
  );
}

// ── Assembled detail screen ──
function TodayDetail({ alertsActive = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f6f7f9' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <DetailHeader title="Today" address="1421 SE Oak St · Portland" onBack={() => {}} />

        <div style={{ padding: '6px 16px 40px' }}>
          <SectionLabel>Weather</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <NowCard />
            <HourlyStrip />
            <ForecastList />
          </div>
          <Source name="National Weather Service" asOf="as of 9:12 AM" />

          <SectionLabel>Air quality</SectionLabel>
          <AqiCard />
          <Source name="AirNow · EPA" asOf="as of 9:00 AM" />

          <SectionLabel>Alerts</SectionLabel>
          <AlertsCard active={alertsActive} />
          <Source name="National Weather Service" asOf="live" />

          <SectionLabel>Sun</SectionLabel>
          <SunCard />
          <Source name="Your location" asOf="today" />

          <SectionLabel>Coming soon</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ComingSoonRow icon="flower-2" title="Allergen & pollen" sub="Tree, grass, and weed pollen counts" />
            <ComingSoonRow icon="trash-2" title="Trash & recycling" sub="Your pickup day and what goes out" />
            <ComingSoonRow icon="zap-off" title="Power outages" sub="Live outage map for your block" />
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  TodayDetail, DetailHeader, Source, SectionLabel,
  NowCard, HourlyStrip, ForecastList, AqiCard, AlertsCard, AlertRow, SunCard, ComingSoonRow,
});
