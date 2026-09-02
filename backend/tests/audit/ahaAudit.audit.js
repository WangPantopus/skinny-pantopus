// THE AHA AUDIT (Wedge v2, Phase 1.5 open item) — real addresses through the
// real preview pipeline, keyless sources only. Not a regression test: it
// hits the network and prints what a stranger would see. Run on demand:
//   npx jest --testMatch "**/tests/audit/*.audit.js" -i
const express = require('express');
const request = require('supertest');
const { resetTables } = require('../__mocks__/supabaseAdmin');

// Mapbox needs a key; the Census geocoder does not. Same lat/lng contract.
jest.mock('../../services/geo', () => ({
  forwardGeocode: async (address) => {
    const url = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address='
      + encodeURIComponent(address) + '&benchmark=Public_AR_Current&format=json';
    const res = await fetch(url);
    const json = await res.json();
    const m = json && json.result && json.result.addressMatches && json.result.addressMatches[0];
    if (!m) return null;
    const parts = m.matchedAddress.split(',').map((s) => s.trim()); // "2518 NW LACAMAS DR, CAMAS, WA, 98607"
    const title = (t) => t.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\b(Nw|Ne|Sw|Se|Dr|St|Ave|Blvd|Ct|Rd|Ln|Pl|Way)\b/g, (c) => c.toUpperCase());
    return {
      latitude: m.coordinates.y, longitude: m.coordinates.x,
      address: title(parts[0]), city: title(parts[1] || ''), state: parts[2] || '', zipcode: parts[3] || '',
    };
  },
}));
jest.mock('../../services/propertyDataService', () => ({ isAvailable: () => false, verifyPropertyOwnership: jest.fn() }));

const publicRouter = require('../../routes/public');

const ADDRESSES = [
  '2518 NW Lacamas Dr, Camas, WA 98607',
  '616 NE 4th Ave, Camas, WA 98607',          // Camas City Hall
  '625 NE 4th Ave, Camas, WA 98607',          // Camas Public Library
  '227 NE Lake Rd, Camas, WA 98607',          // Lacamas Lake Lodge, at the lake
];

jest.setTimeout(180000);

function app() { const a = express(); a.use(express.json()); a.use('/api/public', publicRouter); return a; }

const { seedTable } = require('../__mocks__/supabaseAdmin');

beforeAll(() => {
  resetTables();
  // The county tables ship with migration 158; the local mock is empty, so
  // seed Clark County's REAL rows (EPA radon zone 1; HUD FY2026 FMR).
  seedTable('CountyRadonZone', [{ county_fips: '53011', zone: 1, county_name: 'Clark County' }]);
  seedTable('HudFmr', [{ county_fips: '53011', fiscal_year: 2026, county_name: 'Clark County', state_abbr: 'WA', area_name: 'Portland-Vancouver-Hillsboro, OR-WA MSA', fmr_lo: [1570, 1677, 1922, 2619, 3109], fmr_hi: [1570, 1677, 1922, 2619, 3109] }]);
  process.env.PLACE_PREVIEW_SECTION_BUDGET_MS = '20000';
  delete process.env.AIRNOW_API_KEY;
  delete process.env.WALKSCORE_API_KEY;
});

for (const address of ADDRESSES) {
  it(`audit: ${address}`, async () => {
    publicRouter.__clearPreviewCaches();
    const t0 = Date.now();
    const res = await request(app()).get('/api/public/place').query({ address });
    const ms = Date.now() - t0;
    const b = res.body;
    const lines = [];
    lines.push(`\n════════ ${address}  (${res.status}, ${ms} ms, status=${b.status})`);
    if (b.place) lines.push(`place: ${b.place.address}, ${b.place.city}, ${b.place.state} ${b.place.zipcode}`);
    if (b.aha) lines.push(`AHA  [${b.aha.tone}] ${b.aha.grade || ''} — ${b.aha.headline}\n     ${b.aha.detail}\n     → ${b.aha.follow_up}`);
    lines.push(`money_lead: ${b.money_lead ? b.money_lead.headline : 'null'}`);
    lines.push(`density: ${b.free && b.free.density.bucket} — ${b.free && b.free.density.label}`);
    for (const s of b.sections || []) {
      const d = s.data || {};
      let summary = '';
      switch (s.id) {
        case 'weather': summary = d.current_temp_f != null ? `${d.current_temp_f}°F ${d.condition_label} (hi ${d.high_f} / lo ${d.low_f})` : ''; break;
        case 'air_quality': summary = d.index != null ? `AQI ${d.index} ${d.category_label}` : ''; break;
        case 'alerts': summary = Array.isArray(d.active) ? `${d.active.length} active${d.active[0] ? ': ' + d.active[0].event : ''}` : ''; break;
        case 'sunrise_sunset': summary = d.sunrise ? `${d.sunrise} → ${d.sunset}` : JSON.stringify(d).slice(0, 80); break;
        case 'flood': summary = d.zone ? `${d.zone_label} · ${d.risk_level}` : ''; break;
        case 'seismic': summary = d.design_category ? `SDC ${d.design_category} (SDS ${d.sds})` : ''; break;
        case 'wildfire': summary = d.hazard_label ? `${d.hazard_label} (class ${d.hazard_class})` : ''; break;
        case 'lead_radon': summary = d.radon_zone != null ? `radon zone ${d.radon_zone}` : ''; break;
        case 'drinking_water': summary = d.utility_name ? `${d.utility_name}: ${d.summary}` : ''; break;
        case 'environmental_hazards': summary = d.summary ? `${d.summary}${d.facilities && d.facilities[0] ? ' · top: ' + d.facilities[0].name + (d.facilities[0].violation_quarters_3yr ? ` (${d.facilities[0].violation_quarters_3yr} NC quarters)` : '') : ''}` : ''; break;
        case 'block_density': summary = `${d.bucket} — ${d.label}`; break;
        case 'census_context': summary = d.summary || ''; break;
        case 'rent_band': summary = d.band_low ? `$${d.band_low}–$${d.band_high} (${d.period})` : ''; break;
        case 'civic_districts': summary = Array.isArray(d.districts) ? d.districts.map((x) => x.name).join(' · ') : ''; break;
        case 'civic_election': summary = d.name ? `${d.name} in ${d.days_until} d` : ''; break;
        default: summary = '';
      }
      lines.push(`  ${s.status.padEnd(11)} ${s.id.padEnd(22)} ${summary || (s.unavailable_reason || '')}`);
    }
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    expect(res.status).toBe(200);
  });
}
