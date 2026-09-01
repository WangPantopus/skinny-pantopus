// ============================================================
// TEST: Before-You-Sign Scout (Wave 4)
//
// Scout is the one surface where the person asking is NOT the person the
// data is about — they are considering an address somebody else
// currently lives at. So the invariants are mostly about restraint:
//   * facts about land and buildings only, never about the occupants;
//   * every generated line is a QUESTION or a fact, never advice;
//   * a fact the CALLER supplied is attributed to them, not presented as
//     something we looked up;
//   * the copy states exactly what happens to the typed address —
//     checking out a place you might rent is not consent to a record of
//     having looked, and it is also not a promise we can make in the
//     absolute, since placing an address requires a geocoder.
// ============================================================

const express = require('express');
const request = require('supertest');
const { askBeforeYouSign, LEAD_DISCLOSURE_YEAR } = require('../services/scoutService');

const FLOOD_HIGH = { zone: 'AE', in_sfha: true };
const FLOOD_LOW = { zone: 'X', in_sfha: false };
const NFIP = { premium_p25: 480, premium_median: 760, premium_p75: 1240, policy_count: 128 };
const RENT = { band_low: 2120, band_high: 2600, period: 'FY 2026' };

describe('the question list is the product', () => {
  test('every question carries the fact that generated it', () => {
    const asks = askBeforeYouSign({
      flood: FLOOD_HIGH, nfip: NFIP, radon: { radon_zone: 1, year_built: 1961 },
      water: { violation_count: 2 }, rentBand: RENT, askingRent: 2900,
    });
    expect(asks.length).toBeGreaterThan(4);
    for (const a of asks) {
      expect(a.id).toBeTruthy();
      expect(a.question).toBeTruthy();
      // A question without its reason is a checklist off the internet.
      expect(a.because).toBeTruthy();
      expect(a.because.length).toBeGreaterThan(20);
    }
  });

  test('nothing reads as advice, an instruction, or a legal opinion', () => {
    const asks = askBeforeYouSign({
      flood: FLOOD_HIGH, nfip: NFIP, radon: { radon_zone: 1, year_built: 1961 },
      water: { violation_count: 2 }, rentBand: RENT, askingRent: 2900,
    });
    const text = asks.map((a) => `${a.question} ${a.because}`).join(' ');
    // We are not the reader's lawyer, agent, or inspector.
    expect(text).not.toMatch(/\byou should\b/i);
    expect(text).not.toMatch(/\bdemand\b/i);
    expect(text).not.toMatch(/\bwe recommend\b/i);
    expect(text).not.toMatch(/\bdo not sign\b/i);
    expect(text).not.toMatch(/\bwalk away\b/i);
    // And never a verdict on the price.
    expect(text).not.toMatch(/\boverpriced\b|\bbad deal\b|\brip.?off\b/i);
  });

  test('a high-risk flood zone asks who pays, and prices it from real policies', () => {
    const asks = askBeforeYouSign({ flood: FLOOD_HIGH, nfip: NFIP });
    const ids = asks.map((a) => a.id);
    expect(ids).toContain('flood_insurance_required');
    expect(ids).toContain('flood_premium_benchmark');
    const priced = asks.find((a) => a.id === 'flood_premium_benchmark');
    expect(priced.because).toMatch(/\$760/);
    // A benchmark, never a quote for this address.
    expect(priced.because).toMatch(/could differ/i);
  });

  test('a low-risk zone asks the opposite question — is there a policy at all', () => {
    const ids = askBeforeYouSign({ flood: FLOOD_LOW }).map((a) => a.id);
    expect(ids).toContain('flood_history');
    expect(ids).not.toContain('flood_insurance_required');
  });

  test('the lead-paint question attributes the year to the CALLER', () => {
    // We do not look up a build year for an address we have no claim on
    // — the reader supplied it from the listing, and the copy says so.
    const ask = askBeforeYouSign({ radon: { year_built: LEAD_DISCLOSURE_YEAR - 1 } })
      .find((a) => a.id === 'lead_disclosure');
    expect(ask).toBeTruthy();
    expect(ask.because).toMatch(/you told us/i);
  });

  test('no lead question when the year is unknown or after the rule', () => {
    expect(askBeforeYouSign({ radon: { year_built: null } }).some((a) => a.id === 'lead_disclosure')).toBe(false);
    expect(askBeforeYouSign({ radon: {} }).some((a) => a.id === 'lead_disclosure')).toBe(false);
    expect(askBeforeYouSign({ radon: { year_built: LEAD_DISCLOSURE_YEAR } }).some((a) => a.id === 'lead_disclosure')).toBe(false);
  });

  test('an above-band rent is framed as a thing to have an answer for, not a verdict', () => {
    const ask = askBeforeYouSign({ rentBand: RENT, askingRent: 3200 }).find((a) => a.id === 'rent_above_band');
    expect(ask).toBeTruthy();
    expect(ask.because).toMatch(/not by itself a problem/i);
  });

  test('an in-band rent raises no pricing question at all', () => {
    const ids = askBeforeYouSign({ rentBand: RENT, askingRent: 2300 }).map((a) => a.id);
    expect(ids).not.toContain('rent_above_band');
  });

  test('the one question everyone gets is always present', () => {
    // Even with nothing known about the address.
    expect(askBeforeYouSign({}).map((a) => a.id)).toContain('whats_changed');
  });

  test('a quiet address produces a short list, not padding', () => {
    const asks = askBeforeYouSign({ flood: null, radon: { radon_zone: 3 }, water: { violation_count: 0 } });
    expect(asks.length).toBeLessThanOrEqual(2);
  });
});

// ── An unmapped area is not a high-risk one ─────────────────
//
// `in_sfha` was `zone.startsWith('A') || zone.startsWith('V')`. FEMA's
// FLD_ZONE domain contains the literal string "AREA NOT INCLUDED", which
// that prefix test reads as a Special Flood Hazard Area — producing "a
// federally backed mortgage requires flood insurance here" for a place
// FEMA has not mapped. It is a false statement about a legal
// requirement, and it points the opposite way from the truth: unmapped
// means the risk is UNKNOWN, not established.
describe('the flood-zone classification', () => {
  const { isSpecialFloodHazardArea } = require('../services/scoutService');

  test('the real high-risk zones are high-risk, INCLUDING the AR dual zones', () => {
    // The AR duals are written with a slash and are SFHAs — FEMA's own
    // flood-zone glossary lists AR/AE, AR/AO, AR/A1-A30 and AR/A next to
    // A and V. The first version of this function missed all of them,
    // which is a FALSE NEGATIVE on genuinely high-risk land: worse than
    // the "AREA NOT INCLUDED" bug it was written to fix, because it
    // suppresses the question about who pays for insurance a federally
    // backed mortgage actually requires.
    const zones = [
      'A', 'AE', 'AH', 'AO', 'AR', 'A99', 'A12', 'V', 'VE', 'V30',
      'AR/A', 'AR/AE', 'AR/AH', 'AR/AO', 'AR/A12',
    ];
    for (const zone of zones) {
      expect({ zone, sfha: isSpecialFloodHazardArea(zone) }).toEqual({ zone, sfha: true });
    }
  });

  test('an AR dual zone still raises the insurance-is-required question', () => {
    // The classification only matters through what it generates.
    const asks = askBeforeYouSign({ flood: { zone: 'AR/AE', in_sfha: isSpecialFloodHazardArea('AR/AE') } });
    expect(asks.map((a) => a.id)).toContain('flood_insurance_required');
  });

  test('unmapped, undetermined and low-risk zones are not', () => {
    // "AREA NOT INCLUDED" and "D" are the two that matter: the first was
    // the bug, and the second is explicitly "undetermined", which must
    // not be dressed as either answer.
    for (const zone of ['AREA NOT INCLUDED', 'OPEN WATER', 'X', 'X500', 'B', 'C', 'D', '', null]) {
      expect({ zone, sfha: isSpecialFloodHazardArea(zone) }).toEqual({ zone, sfha: false });
    }
  });

  test('an unmapped area gets neither false sentence, and says nobody assessed it', () => {
    // The FIRST version of this test only asserted the absence of
    // "requires flood insurance" — and passed, while the payload it built
    // contained the OPPOSITE falsehood: "The address is outside the
    // high-risk zone (AREA NOT INCLUDED)". Reassurance is the more
    // tempting error and the easier one to miss, so it is asserted here
    // explicitly, along with the positive content that replaces it.
    const asks = askBeforeYouSign({
      flood: { zone: 'AREA NOT INCLUDED', in_sfha: isSpecialFloodHazardArea('AREA NOT INCLUDED') },
    });
    const ids = asks.map((a) => a.id);
    const text = asks.map((a) => `${a.question} ${a.because}`).join(' ');

    expect(ids).not.toContain('flood_insurance_required');
    expect(text).not.toMatch(/requires flood insurance/i);
    // The false-reassurance half.
    expect(ids).not.toContain('flood_history');
    expect(text).not.toMatch(/outside the high-risk/i);
    expect(text).not.toMatch(/usually optional/i);

    // And what it must say instead.
    expect(ids).toContain('flood_undetermined');
    expect(text).toMatch(/has not made a flood-risk determination/i);
    expect(text).toMatch(/not the same as low risk/i);
  });

  test('zone D — "undetermined" — is not dressed as low risk either', () => {
    // D is FEMA explicitly declining to make a finding. It reads like an
    // ordinary letter zone and is the easiest to lump in with X.
    const asks = askBeforeYouSign({ flood: { zone: 'D', in_sfha: false } });
    expect(asks.map((a) => a.id)).toContain('flood_undetermined');
    expect(asks.map((a) => a.because).join(' ')).not.toMatch(/outside the high-risk/i);
  });

  test('a genuine low-risk zone still gets the ordinary history question', () => {
    // The three-way split must not swallow the real low-risk answer.
    const asks = askBeforeYouSign({ flood: { zone: 'X', in_sfha: false } });
    expect(asks.map((a) => a.id)).toContain('flood_history');
    expect(asks.map((a) => a.id)).not.toContain('flood_undetermined');
  });
});

describe('Scout never describes the people who live there', () => {
  test('no generated line mentions an occupant, owner, or neighbour', () => {
    const asks = askBeforeYouSign({
      flood: FLOOD_HIGH, nfip: NFIP, radon: { radon_zone: 1, year_built: 1961 },
      water: { violation_count: 2 }, rentBand: RENT, askingRent: 2900,
    });
    const text = JSON.stringify(asks).toLowerCase();
    // "current occupant" appears once, deliberately, as someone to ASK —
    // never as a subject we describe. Everything else is off-limits.
    expect(text).not.toMatch(/\bowner'?s? name\b|\bresident'?s? name\b/);
    expect(text).not.toMatch(/\bneighbou?rs? (pay|earn|are)\b/);
    expect(text).not.toMatch(/\bhousehold\b/);
    expect(text).not.toMatch(/\bverified (homes?|neighbou?rs?)\b/);
  });
});

// ── The promise in the copy must be true in the code ─────────
//
// Scout's scope_note once told the reader "we did not tell anyone you
// looked." That was false in TWO places, and the first fix only caught
// one of them:
//
//   1. getScoutReport called neighborhoodProfileService.getProfile,
//      which passes the address into a WalkScore query string. Removed —
//      Scout only ever wanted the flood zone and the tract id, and both
//      come from coordinates. That is what this block pins.
//
//   2. The ROUTE geocodes the address through Mapbox before calling
//      getScoutReport at all. That one is unavoidable: Scout answers
//      nothing without coordinates, and an address only becomes
//      coordinates by asking someone. So the copy changed instead.
//
// The invariant is therefore narrower than "never leaves the process",
// and stating it accurately is the point: getScoutReport itself makes no
// outbound call carrying the address, and the copy discloses the one hop
// that does happen rather than denying it.
describe('the composer makes no outbound call carrying the address', () => {
  const { resetTables } = require('./__mocks__/supabaseAdmin');
  const scoutService = require('../services/scoutService');

  const PLACE = {
    lat: 45.51,
    lng: -122.65,
    // Distinctive enough that any appearance in an outbound URL is proof.
    line: '1421 ZZQUNIQUEADDR St',
    city: 'Portland',
    state: 'OR',
    zipcode: '97214',
  };

  test('no outbound request carries the address, in any encoding', async () => {
    resetTables();
    const seen = [];
    const realFetch = global.fetch;
    // The tract geocode must SUCCEED, or a leak downstream of it is never
    // reached and the test proves nothing — which is exactly what a
    // blanket-503 mock did on the first attempt.
    global.fetch = jest.fn(async (url) => {
      const u = String(url);
      seen.push(u);
      if (u.includes('geocoding.geo.census.gov')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            result: { geographies: { 'Census Tracts': [{ STATE: '41', COUNTY: '051', TRACT: '001902' }] } },
          }),
        };
      }
      return { ok: false, status: 503, json: async () => ({}) };
    });
    process.env.WALKSCORE_API_KEY = 'test-key-that-would-enable-the-leak';

    try {
      await scoutService.getScoutReport(PLACE, { askingRent: 2400 });
    } finally {
      global.fetch = realFetch;
      delete process.env.WALKSCORE_API_KEY;
    }

    expect(seen.length).toBeGreaterThan(0); // it really did call out
    for (const url of seen) {
      const decoded = decodeURIComponent(url).toLowerCase();
      expect(decoded).not.toContain('zzquniqueaddr');
      // And never to the service that took the address before.
      expect(url).not.toContain('walkscore.com');
    }
  });

  test('the scope note claims only what is true, and discloses the hop that is real', async () => {
    resetTables();
    const report = await scoutService.getScoutReport(PLACE, {});

    // This assertion is written against the FAILURE MODE, not against a
    // sentence, because the sentence has been wrong twice and a test that
    // pinned the wording is what let the second one through.
    //
    // Both errors were exclusivity claims — "we did not tell anyone",
    // "that is the one company that sees it". An exclusive is a promise
    // about everything the code does not do, and every outbound call
    // added later falsifies it silently. So: no exclusives, ever.
    expect(report.scope_note).not.toMatch(/did not tell anyone/i);
    expect(report.scope_note).not.toMatch(/\bthe only (company|one|service)\b/i);
    expect(report.scope_note).not.toMatch(/\bthe one company\b/i);
    expect(report.scope_note).not.toMatch(/\bno ?one else\b|\bnobody else\b/i);
    expect(report.scope_note).not.toMatch(/we (do not|don't) (send|share) (it|the address)/i);

    // What it must say: the assurance this reader actually wants (the
    // people at the address are not told), and an honest account of where
    // the lookup goes — naming the agencies, since the COORDINATES reach
    // them and a coordinate is the address to anyone who can reverse it.
    expect(report.scope_note).toMatch(/nobody at the address is told/i);
    expect(report.scope_note).toMatch(/mapping provider/i);
    expect(report.scope_note).toMatch(/FEMA/);
    expect(report.scope_note).toMatch(/Census/i);
    expect(report.scope_note).toMatch(/EPA/);

    // Degrading to no external data must still produce the question list.
    expect(report.ask_before_you_sign.length).toBeGreaterThan(0);
  });
});

// ── One report per address, not one per deployment ───────────
//
// `homeCountyFips` cached the Census geocode under `home:${home.id}`.
// Scout's synthetic home carries `id: null` on purpose — nothing may
// resolve to a real Home row — so that template literal produced the
// literal string "home:null": ONE global cache row, TTL a year, shared
// by every Scout request in the deployment.
//
// The first address anyone scouted pinned its county forever. Every
// later report then priced rent, screened radon and named the water
// utility for that stranger's county. A Brooklyn scout was told Travis
// County's rent band — inverting "above band" and "below band" on the
// single most decision-relevant line of a page whose whole premise is
// checking before you sign.
describe('two addresses in one process are two different places', () => {
  const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');
  const scoutService = require('../services/scoutService');

  // Travis County, TX and Kings County, NY — real FIPS, distinct rent
  // bands, distinct radon zones.
  const AUSTIN = { lat: 30.2672, lng: -97.7431, line: '1 Congress Ave', city: 'Austin', state: 'TX', zipcode: '78701' };
  const BROOKLYN = { lat: 40.6782, lng: -73.9442, line: '1 Bedford Ave', city: 'Brooklyn', state: 'NY', zipcode: '11211' };

  function seedCounties() {
    seedTable('HudFmr', [
      {
        county_fips: '48453', fiscal_year: 2026, county_name: 'Travis County', state_abbr: 'TX',
        area_name: 'Austin', fmr_lo: [1200, 1400, 1600, 2000, 2400], fmr_hi: [1200, 1400, 1600, 2000, 2400],
      },
      {
        county_fips: '36047', fiscal_year: 2026, county_name: 'Kings County', state_abbr: 'NY',
        area_name: 'New York', fmr_lo: [2100, 2400, 2800, 3500, 3900], fmr_hi: [2100, 2400, 2800, 3500, 3900],
      },
    ]);
    seedTable('CountyRadonZone', [
      { county_fips: '48453', zone: 1 },
      { county_fips: '36047', zone: 3 },
    ]);
  }

  // The Census geocoder answers per-coordinate; everything else is down,
  // so the only thing under test is which county each address resolves to.
  function mockGeocoderByCoordinate() {
    return jest.fn(async (url) => {
      const u = String(url);
      if (u.includes('geocoding.geo.census.gov')) {
        const isAustin = u.includes('30.2672') || u.includes('-97.7431');
        return {
          ok: true,
          status: 200,
          json: async () => ({
            result: {
              geographies: {
                'Census Tracts': isAustin
                  ? [{ STATE: '48', COUNTY: '453', TRACT: '001100' }]
                  : [{ STATE: '36', COUNTY: '047', TRACT: '050300' }],
              },
            },
          }),
        };
      }
      return { ok: false, status: 503, json: async () => ({}) };
    });
  }

  test('the second scout gets its OWN county, not the first one’s', async () => {
    resetTables();
    seedCounties();
    const realFetch = global.fetch;
    global.fetch = mockGeocoderByCoordinate();

    let austin;
    let brooklyn;
    try {
      austin = await scoutService.getScoutReport(AUSTIN, { askingRent: 1800, yearBuilt: 1970 });
      brooklyn = await scoutService.getScoutReport(BROOKLYN, { askingRent: 2400, yearBuilt: 1970 });
    } finally {
      global.fetch = realFetch;
    }

    expect(austin.rent.band_low).toBe(1600);
    expect(brooklyn.rent.band_low).toBe(2800);
    // The line that flipped: $2,400 is BELOW Kings County's band, and was
    // reported as above it while Travis County's band was being served.
    expect(austin.rent.position).toBe('in_band');
    expect(brooklyn.rent.position).toBe('below_band');

    expect(austin.environment.radon.radon_zone).toBe(1);
    expect(brooklyn.environment.radon.radon_zone).toBe(3);
  });

  test('no cache row is keyed on a null home id', async () => {
    resetTables();
    seedCounties();
    const realFetch = global.fetch;
    global.fetch = mockGeocoderByCoordinate();
    try {
      await scoutService.getScoutReport(AUSTIN, {});
    } finally {
      global.fetch = realFetch;
    }
    for (const row of getTable('PlaceSectionCache')) {
      expect(row.cache_key).not.toMatch(/null/);
    }
  });
});

// ── The never-advice rules apply to the WHOLE payload ────────
//
// They were only ever enforced on `askBeforeYouSign`. Everything else in
// the report came from the dashboard composers, which write for a reader
// who LIVES there: "Your county has the highest radon potential (zone 1)
// — test before renovating." Forwarded whole, that addressed a
// non-resident as the occupant and issued an instruction, straight past
// the rules two describe blocks up.
// ── A county fact should not need the reader's homework ─────
//
// The EPA radon zone is a COUNTY lookup and does not depend on the build
// year. But composeLeadRadon returns 'partial' when it has only one of
// its two inputs, and Scout's shared `dataOf` accepts only ready/stale —
// so a reader who could not state a year got no radon zone at all, even
// in an EPA Zone 1 county, and the "optional" form field was effectively
// mandatory on the one surface built for people about to sign.
describe('the radon zone survives a missing build year', () => {
  const { resetTables, seedTable } = require('./__mocks__/supabaseAdmin');
  const scoutService = require('../services/scoutService');
  const AUSTIN = { lat: 30.2672, lng: -97.7431, line: '1 Congress Ave', city: 'Austin', state: 'TX', zipcode: '78701' };

  function censusOnly() {
    return jest.fn(async (url) => {
      if (String(url).includes('geocoding.geo.census.gov')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ result: { geographies: { 'Census Tracts': [{ STATE: '48', COUNTY: '453', TRACT: '001100' }] } } }),
        };
      }
      return { ok: false, status: 503, json: async () => ({}) };
    });
  }

  async function scoutAustin(opts) {
    resetTables();
    seedTable('CountyRadonZone', [{ county_fips: '48453', zone: 1 }]);
    const realFetch = global.fetch;
    global.fetch = censusOnly();
    try {
      return await scoutService.getScoutReport(AUSTIN, opts);
    } finally {
      global.fetch = realFetch;
    }
  }

  test('a Zone 1 county raises the radon question with NO year supplied', async () => {
    const report = await scoutAustin({});
    expect(report.environment.radon).not.toBeNull();
    expect(report.environment.radon.radon_zone).toBe(1);
    // The assertion that matters is the QUESTION, not the field.
    expect(report.ask_before_you_sign.map((a) => a.id)).toContain('radon_tested');
  });

  test('supplying a year still works, and adds the lead question', async () => {
    const report = await scoutAustin({ yearBuilt: 1961 });
    const ids = report.ask_before_you_sign.map((a) => a.id);
    expect(ids).toContain('radon_tested');
    expect(ids).toContain('lead_disclosure');
  });
});

describe('nothing in the report speaks to the reader as a resident', () => {
  const { resetTables, seedTable } = require('./__mocks__/supabaseAdmin');
  const scoutService = require('../services/scoutService');

  const PLACE = { lat: 30.2672, lng: -97.7431, line: '1 Congress Ave', city: 'Austin', state: 'TX', zipcode: '78701' };

  function censusOnly() {
    return jest.fn(async (url) => {
      if (String(url).includes('geocoding.geo.census.gov')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ result: { geographies: { 'Census Tracts': [{ STATE: '48', COUNTY: '453', TRACT: '001100' }] } } }),
        };
      }
      return { ok: false, status: 503, json: async () => ({}) };
    });
  }

  test('the serialized payload carries no possessive and no imperative', async () => {
    resetTables();
    seedTable('CountyRadonZone', [{ county_fips: '48453', zone: 1 }]);
    seedTable('HudFmr', [{
      county_fips: '48453', fiscal_year: 2026, county_name: 'Travis County', state_abbr: 'TX',
      area_name: 'Austin', fmr_lo: [1200, 1400, 1600, 2000, 2400], fmr_hi: [1200, 1400, 1600, 2000, 2400],
    }]);

    const realFetch = global.fetch;
    global.fetch = censusOnly();
    let report;
    try {
      report = await scoutService.getScoutReport(PLACE, { askingRent: 1800, yearBuilt: 1961 });
    } finally {
      global.fetch = realFetch;
    }

    // The composer really did run — otherwise this proves nothing.
    expect(report.environment.radon.radon_zone).toBe(1);

    const text = JSON.stringify(report);
    // The reader does not live here. Nothing may call it theirs.
    expect(text).not.toMatch(/\byour (county|area|home|building|water|neighbou?rhood)\b/i);
    // And nothing may tell them what to do.
    expect(text).not.toMatch(/\btest before renovating\b/i);
    expect(text).not.toMatch(/\byou should\b|\bwe recommend\b|\bdemand\b/i);
  });

  test('a caller-supplied build year still raises the lead question with no radon coverage', async () => {
    // Radon coverage is county-by-county. Where it is missing the
    // composer degrades to `partial`, which `dataOf` drops — and that
    // used to take the build year with it, losing a federally mandated
    // disclosure question that was never the composer's fact to begin
    // with.
    resetTables(); // no CountyRadonZone rows at all
    const realFetch = global.fetch;
    global.fetch = censusOnly();
    let report;
    try {
      report = await scoutService.getScoutReport(PLACE, { yearBuilt: 1961 });
    } finally {
      global.fetch = realFetch;
    }
    expect(report.ask_before_you_sign.map((a) => a.id)).toContain('lead_disclosure');
  });
});

// ── The route's two dead ends are different dead ends ────────
//
// `geocodeUsAddress` fails for four reasons and only ONE of them means
// "not in the United States". The route collapsed all four into "Scout
// is U.S.-only for now", so a geocoder outage — which hits every US user
// at once — told them the product was not for them, and gave no hint
// that a fuller address would work. Scout genuinely cannot proceed
// without coordinates, so both are still a dead end; they must at least
// be the right one.
describe('the route distinguishes "could not place" from "not in the US"', () => {
  const publicRoutes = require('../routes/public');

  function buildScoutApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/scout', require('../routes/scout'));
    return app;
  }

  afterEach(() => jest.restoreAllMocks());

  test('a geocoder failure is could_not_place, not a geographic denial', async () => {
    jest.spyOn(publicRoutes, 'geocodeUsAddress')
      .mockResolvedValue({ ok: false, reason: 'unplaceable' });

    const res = await request(buildScoutApp())
      .get('/api/scout')
      .set('x-test-user-id', 'scout-user-1')
      .query({ address: '1421 SE Oak St' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('could_not_place');
    expect(res.body.status).not.toBe('unsupported_region');
    // The message must not tell a US resident they are somewhere else.
    expect(res.body.message).not.toMatch(/U\.S\.-only/i);
    // And it must say what would help, since a fuller address often works.
    expect(res.body.message).toMatch(/city and state/i);
  });

  test('the report is not storable on the reader\'s own device', async () => {
    // Express sends 200 + ETag + no Cache-Control, which is storable, and
    // the cache key is the full URL — which on this route carries the
    // typed address. /api/public/unlisted got this header in the same
    // wave; Scout, the surface whose entire promise is discretion about
    // a place you have not committed to, was left out.
    jest.spyOn(publicRoutes, 'geocodeUsAddress')
      .mockResolvedValue({ ok: false, reason: 'unplaceable' });

    const res = await request(buildScoutApp())
      .get('/api/scout')
      .set('x-test-user-id', 'scout-user-1')
      .query({ address: '1421 SE Oak St' });

    expect(res.headers['cache-control']).toMatch(/no-store/);
  });

  test('an address genuinely outside the US still gets the geographic answer', async () => {
    jest.spyOn(publicRoutes, 'geocodeUsAddress')
      .mockResolvedValue({ ok: false, reason: 'outside_us' });

    const res = await request(buildScoutApp())
      .get('/api/scout')
      .set('x-test-user-id', 'scout-user-1')
      .query({ address: '10 Downing Street, London' });

    expect(res.body.status).toBe('unsupported_region');
    // NOT "U.S.-only": Puerto Rico, the U.S. Virgin Islands and Guam ARE
    // the United States and fail the mainland bounding box, so that
    // phrasing tells a resident of a U.S. territory they are not in
    // their own country. Say what is true — no coverage — without
    // asserting where the reader is.
    expect(res.body.message).toMatch(/does not cover that area/i);
    expect(res.body.message).not.toMatch(/U\.S\.-only/i);
  });
});

// ── The verdict is meaningless without the unit size ─────────
//
// `rent.position` is the only personalised judgement Scout makes. It was
// computed against the county's 2-BEDROOM HUD band regardless of what the
// reader was actually looking at, and the bedroom count was dropped from
// the payload — so a studio asking $1,400 came back `below_band` against
// a $1,600–$1,920 two-bedroom band. There is no way for a client to
// render that as anything but "a good deal", and it is not one.
describe('the rent verdict is tied to a stated unit size', () => {
  const { resetTables, seedTable } = require('./__mocks__/supabaseAdmin');
  const scoutService = require('../services/scoutService');

  const AUSTIN = { lat: 30.2672, lng: -97.7431, line: '1 Congress Ave', city: 'Austin', state: 'TX', zipcode: '78701' };

  function seedTravis() {
    seedTable('HudFmr', [{
      county_fips: '48453', fiscal_year: 2026, county_name: 'Travis County', state_abbr: 'TX',
      area_name: 'Austin',
      // efficiency 1200 · 1br 1400 · 2br 1600 · 3br 2000 · 4br 2400
      fmr_lo: [1200, 1400, 1600, 2000, 2400], fmr_hi: [1200, 1400, 1600, 2000, 2400],
    }]);
  }

  function censusOnly() {
    return jest.fn(async (url) => {
      if (String(url).includes('geocoding.geo.census.gov')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ result: { geographies: { 'Census Tracts': [{ STATE: '48', COUNTY: '453', TRACT: '001100' }] } } }),
        };
      }
      return { ok: false, status: 503, json: async () => ({}) };
    });
  }

  async function scout(opts) {
    resetTables();
    seedTravis();
    const realFetch = global.fetch;
    global.fetch = censusOnly();
    try {
      return await scoutService.getScoutReport(AUSTIN, opts);
    } finally {
      global.fetch = realFetch;
    }
  }

  test('a studio at $1,400 is NOT reported as under the market', async () => {
    // THE ASSERTION THAT MATTERS is on `position`, not on `bedrooms`.
    // Echoing the count while still judging against the 2-bedroom band
    // would satisfy a `bedrooms === 0` check and still mislead the reader.
    const report = await scout({ askingRent: 1400, bedrooms: 0 });
    expect(report.rent.bedrooms).toBe(0);
    // HUD prices this county at a single figure, so composeRentBand
    // extends the efficiency band to $1,200–$1,440 and $1,400 sits
    // inside it. The old code judged the same rent against the county's
    // 2-bedroom band of $1,600–$1,920 and returned `below_band` — the
    // one answer that reads as "you are getting a deal".
    expect(report.rent.position).not.toBe('below_band');
    expect(report.rent.position).toBe('in_band');
    expect(report.rent.band_low).toBe(1200);
  });

  test('a studio well over its own band is reported as over it', async () => {
    const report = await scout({ askingRent: 1900, bedrooms: 0 });
    expect(report.rent.position).toBe('above_band');
    // Against the 2-bedroom band ($1,600–$1,920) the same rent would have
    // been `in_band` — silence where a question belonged.
    expect(report.ask_before_you_sign.map((a) => a.id)).toContain('rent_above_band');
  });

  test('the same rent against a 2-bedroom is a different answer, and says which', async () => {
    const report = await scout({ askingRent: 1400, bedrooms: 2 });
    expect(report.rent.bedrooms).toBe(2);
    expect(report.rent.band_low).toBe(1600);
    expect(report.rent.position).toBe('below_band');
  });

  test('an unstated bedroom count is flagged as ours, not the reader’s', async () => {
    // Defaulting is fine; presenting the default as the reader's own
    // input is not. A client needs to be able to label the difference.
    const report = await scout({ askingRent: 1400 });
    expect(report.rent.bedrooms).toBe(2);
    expect(report.rent.bedrooms_stated).toBe(false);

    const stated = await scout({ askingRent: 1400, bedrooms: 2 });
    expect(stated.rent.bedrooms_stated).toBe(true);
  });

  test('the generated question names the unit size it judged', async () => {
    const report = await scout({ askingRent: 5000, bedrooms: 0 });
    const ask = report.ask_before_you_sign.find((a) => a.id === 'rent_above_band');
    expect(ask).toBeTruthy();
    expect(ask.because).toMatch(/studios/i);
    // And must not silently imply the default.
    expect(ask.because).not.toMatch(/2-bedroom/i);
  });
});

// ── The route hands the service the unit size the reader chose ──
//
// `bedroomCount` had exactly one call site and no test. Swapping it for
// `positiveNumber` — which rejects 0 — reinstates this wave's own bug in
// one character: a studio silently becomes "not stated", the band
// defaults to 2-bedroom, and the verdict is about a unit twice the size
// of the one the reader is standing in.
describe('the route coerces the bedroom count itself', () => {
  const publicRoutes = require('../routes/public');
  const scoutService = require('../services/scoutService');

  function buildApp2() {
    const app = express();
    app.use(express.json());
    app.use('/api/scout', require('../routes/scout'));
    return app;
  }

  async function optsFor(query) {
    const spyGeo = jest.spyOn(publicRoutes, 'geocodeUsAddress').mockResolvedValue({
      ok: true, lat: 30.2672, lng: -97.7431, line: '1 Congress Ave', city: 'Austin', state: 'TX', zipcode: '78701',
    });
    const spyScout = jest.spyOn(scoutService, 'getScoutReport').mockResolvedValue({
      place: {}, flood: null, flood_cost: null, environment: { radon: null, water: null },
      rent: null, ask_before_you_sign: [], scope_note: 'x',
    });
    try {
      await request(buildApp2()).get('/api/scout').set('x-test-user-id', 'u1').query(query);
      return spyScout.mock.calls[0][1];
    } finally {
      spyGeo.mockRestore();
      spyScout.mockRestore();
    }
  }

  test('a STUDIO (0) reaches the service as 0, not as "not stated"', async () => {
    const opts = await optsFor({ address: 'x', bedrooms: '0' });
    expect(opts.bedrooms).toBe(0);
  });

  test('an ordinary count passes through', async () => {
    expect((await optsFor({ address: 'x', bedrooms: '3' })).bedrooms).toBe(3);
  });

  test('junk, negatives and out-of-range values become undefined, not a wrong band', async () => {
    // HUD publishes bands for 0-4 only, so anything else must be absent
    // rather than clamped into a band the reader did not choose.
    for (const v of ['abc', '-1', '9', '']) {
      const opts = await optsFor({ address: 'x', bedrooms: v });
      expect({ v, bedrooms: opts.bedrooms }).toEqual({ v, bedrooms: undefined });
    }
  });
});

// ── The SFHA classifier is wired to the thing that uses it ──
//
// Every flood test above drives the exported helper directly, so
// mutating the PRODUCTION call site — the one line that decides what a
// reader is actually told — left the whole suite green.
describe('the report itself classifies the zone', () => {
  const { resetTables } = require('./__mocks__/supabaseAdmin');
  const scoutService = require('../services/scoutService');
  const neighborhood = require('../services/ai/neighborhoodProfileService');
  const PLACE = { lat: 30.2672, lng: -97.7431, line: '1 Congress Ave', city: 'Austin', state: 'TX', zipcode: '78701' };

  async function reportForZone(zone) {
    resetTables();
    const spy = jest.spyOn(neighborhood, 'fetchFloodZone').mockResolvedValue({ flood_zone: zone });
    const realFetch = global.fetch;
    global.fetch = jest.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }));
    try {
      return await scoutService.getScoutReport(PLACE, {});
    } finally {
      spy.mockRestore();
      global.fetch = realFetch;
    }
  }

  test('an unmapped zone reaches the payload as undetermined, not high-risk', async () => {
    const report = await reportForZone('AREA NOT INCLUDED');
    expect(report.flood.in_sfha).toBe(false);
    expect(report.flood.determination).toBe('undetermined');
    expect(report.ask_before_you_sign.map((a) => a.id)).toContain('flood_undetermined');
  });

  test('a real SFHA reaches the payload as high-risk', async () => {
    const report = await reportForZone('AE');
    expect(report.flood.in_sfha).toBe(true);
    expect(report.flood.determination).toBe('high_risk');
    expect(report.ask_before_you_sign.map((a) => a.id)).toContain('flood_insurance_required');
  });
});
