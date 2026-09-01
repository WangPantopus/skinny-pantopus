const {
  PLACE_GROUPS,
  PLACE_GROUP_LABELS,
  PLACE_SECTION_META,
  serializePlaceAddressRef,
  serializePlaceSection,
  serializePlaceIntelligence,
} = require('../../serializers/placeIntelligenceSerializer');

// The exact envelope contract (frontend/packages/types/src/placeIntelligence.ts).
const ENVELOPE_KEYS = [
  'id',
  'group',
  'band',
  'access',
  'status',
  'as_of',
  'source',
  'coverage',
  'unavailable_reason',
  'data',
].sort();

describe('placeIntelligenceSerializer — section envelope', () => {
  test('asserts the envelope shape for a sample (ready) section', () => {
    const floodData = {
      zone: 'X',
      zone_label: 'Zone X',
      risk_level: 'minimal',
      in_sfha: false,
      insurance_required: false,
      plain_meaning: 'Your home sits outside the high-risk flood zones.',
    };

    const section = serializePlaceSection('flood', {
      data: floodData,
      asOf: '2024-01-01T00:00:00.000Z',
    });

    // Exactly the contract keys, nothing more, nothing less.
    expect(Object.keys(section).sort()).toEqual(ENVELOPE_KEYS);

    expect(section).toEqual({
      id: 'flood',
      group: 'risk_readiness',
      band: 'A',
      access: 'available',
      status: 'ready',
      as_of: '2024-01-01T00:00:00.000Z',
      source: 'FEMA National Flood Hazard Layer',
      coverage: 'full',
      unavailable_reason: null,
      data: floodData,
    });
  });

  test('infers group, band, and source from the section meta', () => {
    const section = serializePlaceSection('air_quality', {
      data: { index: 38, category: 'good', category_label: 'Good', dominant_pollutant: 'pm25', health_message: 'Air quality is good.' },
    });
    expect(section.group).toBe('today');
    expect(section.band).toBe('A');
    expect(section.source).toBe(PLACE_SECTION_META.air_quality.source);
  });

  test('defaults status to ready when data is present, unavailable when absent', () => {
    const withData = serializePlaceSection('weather', { data: { current_temp_f: 62 } });
    expect(withData.status).toBe('ready');

    const withoutData = serializePlaceSection('weather');
    expect(withoutData.status).toBe('unavailable');
    expect(withoutData.data).toBeNull();
  });

  test('a coverage gap renders unavailable with a reason and no data', () => {
    const section = serializePlaceSection('drinking_water', {
      status: 'unavailable',
      coverage: 'none',
      unavailableReason: "Water-system records aren't published for your area yet.",
      data: { utility_name: 'should be dropped' },
    });
    expect(section.status).toBe('unavailable');
    expect(section.coverage).toBe('none');
    expect(section.unavailable_reason).toMatch(/published for your area/);
    expect(section.data).toBeNull();
  });

  test('a partial-coverage section keeps its data', () => {
    const section = serializePlaceSection('drinking_water', {
      status: 'partial',
      coverage: 'partial',
      data: { utility_name: 'Portland Water Bureau', pws_id: null, recent_health_violations: false, violation_count: 0, summary: '…' },
    });
    expect(section.status).toBe('partial');
    expect(section.coverage).toBe('partial');
    expect(section.data).not.toBeNull();
  });

  test('a stale section keeps its (last-known) data', () => {
    const section = serializePlaceSection('weather', {
      status: 'stale',
      asOf: '2026-01-01T00:00:00.000Z',
      data: { current_temp_f: 55 },
    });
    expect(section.status).toBe('stale');
    expect(section.data).toEqual({ current_temp_f: 55 });
  });

  test('an error section nulls its data', () => {
    const section = serializePlaceSection('environmental_hazards', {
      status: 'error',
      data: { facilities_within_mile: 2 },
    });
    expect(section.status).toBe('error');
    expect(section.data).toBeNull();
  });

  test('a locked (tier-gated) section nulls data regardless of payload', () => {
    const section = serializePlaceSection('rent_band', {
      access: 'locked',
      unavailableReason: 'Claim your place to add bills, maintenance, and your tools.',
      data: { bedrooms: 2, band_low: 2120, band_high: 2600 },
    });
    expect(section.access).toBe('locked');
    expect(section.status).toBe('unavailable');
    expect(section.data).toBeNull();
    expect(section.unavailable_reason).toMatch(/Claim your place/);
  });

  test('a T0 preview section may carry a one-shot snapshot', () => {
    const section = serializePlaceSection('flood', {
      access: 'preview',
      data: { zone: 'X', zone_label: 'Zone X', risk_level: 'minimal', in_sfha: false, insurance_required: false, plain_meaning: '…' },
    });
    expect(section.access).toBe('preview');
    expect(section.status).toBe('ready');
    expect(section.data).not.toBeNull();
  });

  test('block density is a k-anon bucket — it never carries a count (§4.1)', () => {
    const section = serializePlaceSection('block_density', {
      data: { bucket: 'few', label: 'A few verified homes nearby' },
    });
    expect(Object.keys(section.data).sort()).toEqual(['bucket', 'label']);
    expect(section.data).not.toHaveProperty('count');
    expect(section.data).not.toHaveProperty('neighbor_count');
  });

  test('throws on an unknown section id', () => {
    expect(() => serializePlaceSection('not_a_section', {})).toThrow(/unknown section id/);
  });

  test('throws on invalid access / status / coverage values', () => {
    expect(() => serializePlaceSection('flood', { access: 'sneaky' })).toThrow(/invalid access/);
    expect(() => serializePlaceSection('flood', { status: 'loading' })).toThrow(/invalid status/);
    expect(() => serializePlaceSection('flood', { coverage: 'most' })).toThrow(/invalid coverage/);
  });
});

describe('placeIntelligenceSerializer — address ref', () => {
  test('normalizes a raw address, including zipcode/zip aliases', () => {
    expect(
      serializePlaceAddressRef({ line1: '1421 SE Oak St', city: 'Portland', state: 'OR', zipcode: '97214' }),
    ).toEqual({
      label: '1421 SE Oak St, Portland',
      line1: '1421 SE Oak St',
      city: 'Portland',
      state: 'OR',
      postal_code: '97214',
    });
  });

  test('tolerates a missing address', () => {
    expect(serializePlaceAddressRef(undefined)).toEqual({
      label: '',
      line1: '',
      city: '',
      state: '',
      postal_code: null,
    });
  });
});

describe('placeIntelligenceSerializer — grouped response', () => {
  test('assembles groups in presentation order with labels', () => {
    const response = serializePlaceIntelligence({
      place: { line1: '1421 SE Oak St', city: 'Portland', state: 'OR', zip: '97214' },
      tier: 'T4',
      generatedAt: '2026-06-07T12:00:00.000Z',
      sections: [
        // Deliberately out of group order to prove the serializer re-orders.
        serializePlaceSection('bill_benchmark', { data: { utility: 'electric', your_amount: 142, band_low: 165, band_high: 210, comparison: 'lower', comparison_pct: -12, period: '12-month average', summary: '…' } }),
        serializePlaceSection('flood', { data: { zone: 'X', zone_label: 'Zone X', risk_level: 'minimal', in_sfha: false, insurance_required: false, plain_meaning: '…' } }),
        serializePlaceSection('weather', { data: { current_temp_f: 62, condition_code: 'clear', condition_label: 'Clear', feels_like_f: 60, high_f: 68, low_f: 49, hourly: [], daily: [] } }),
      ],
    });

    expect(response.tier).toBe('T4');
    expect(response.region_supported).toBe(true);
    expect(response.generated_at).toBe('2026-06-07T12:00:00.000Z');
    expect(response.place.label).toBe('1421 SE Oak St, Portland');

    // Only groups that have sections appear, and in PLACE_GROUPS order.
    expect(response.groups.map((g) => g.group)).toEqual(['today', 'risk_readiness', 'money_signals']);
    response.groups.forEach((g) => {
      expect(g.label).toBe(PLACE_GROUP_LABELS[g.group]);
      expect(Array.isArray(g.sections)).toBe(true);
    });
    expect(response.groups[0].sections[0].id).toBe('weather');
  });

  test('accepts raw `{ id, ... }` specs and serializes them inline', () => {
    const response = serializePlaceIntelligence({
      place: { line1: '1 Test St', city: 'Townsville', state: 'OR' },
      sections: [
        { id: 'block_density', data: { bucket: 'few', label: 'A few verified homes nearby' } },
        { id: 'census_context', status: 'unavailable' },
      ],
    });
    const block = response.groups.find((g) => g.group === 'your_block');
    expect(block.sections).toHaveLength(2);
    expect(block.sections[0].id).toBe('block_density');
    expect(block.sections[0].data.bucket).toBe('few');
    expect(block.sections[1].status).toBe('unavailable');
  });

  test('region_supported:false surfaces the "coming to your region" state', () => {
    const response = serializePlaceIntelligence({
      place: { line1: '10 Downing St', city: 'London', state: '' },
      tier: 'T1',
      regionSupported: false,
      sections: [],
    });
    expect(response.region_supported).toBe(false);
    expect(response.groups).toEqual([]);
  });

  test('defaults tier to T1 and stamps generated_at when omitted', () => {
    const before = Date.now();
    const response = serializePlaceIntelligence({ place: { line1: '1 A St' } });
    expect(response.tier).toBe('T1');
    expect(Number.isNaN(Date.parse(response.generated_at))).toBe(false);
    expect(Date.parse(response.generated_at)).toBeGreaterThanOrEqual(before - 1000);
  });

  test('throws on an invalid tier', () => {
    expect(() => serializePlaceIntelligence({ place: {}, tier: 'T9' })).toThrow(/invalid tier/);
  });
});

describe('placeIntelligenceSerializer — contract integrity', () => {
  test('every section has complete meta (group, band, source, layer)', () => {
    Object.entries(PLACE_SECTION_META).forEach(([, meta]) => {
      expect(PLACE_GROUPS).toContain(meta.group);
      expect(['A', 'B', 'C', 'D']).toContain(meta.band);
      expect(typeof meta.source).toBe('string');
      expect(meta.source.length).toBeGreaterThan(0);
      expect(meta.layer === null || typeof meta.layer === 'number').toBe(true);
    });
    // The 12 numbered launch layers are entirely Band A (§8.3 / §9.1).
    Object.values(PLACE_SECTION_META)
      .filter((m) => m.layer !== null)
      .forEach((m) => expect(m.band).toBe('A'));
    // your_home is the documented Band-B exception (exact property/valuation, W0.2).
    expect(PLACE_SECTION_META.your_home.band).toBe('B');
    // The 12 numbered launch layers are all represented.
    const layers = Object.values(PLACE_SECTION_META).map((m) => m.layer).filter((n) => n !== null);
    expect(new Set(layers)).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));
  });
});
