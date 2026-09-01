// ============================================================
// TEST: CanonicalAddressService — Canonical Address Dedup
//
// Tests normalizeAndHash, findOrCreate (insert + update paths),
// findByHash, and mergeAliases including FK repointing and
// archive logic.
// ============================================================

const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');
const service = require('../../services/addressValidation/canonicalAddressService');
const { computeAddressHash } = require('../../utils/normalizeAddress');

beforeEach(() => resetTables());

// ── Test data factories ─────────────────────────────────────

function makeNormalized(overrides = {}) {
  return {
    line1: '123 Main St',
    line2: undefined,
    city: 'Portland',
    state: 'OR',
    zip: '97201',
    plus4: '1234',
    lat: 45.5,
    lng: -122.6,
    ...overrides,
  };
}

function makeGoogle(overrides = {}) {
  return {
    normalized: makeNormalized(),
    components: {},
    geocode: { lat: 45.5, lng: -122.6 },
    granularity: 'PREMISE',
    missing_component_types: [],
    verdict: {
      hasUnconfirmedComponents: false,
      hasInferredComponents: false,
      hasReplacedComponents: false,
    },
    ...overrides,
  };
}

function makeSmarty(overrides = {}) {
  return {
    from_cache: false,
    inconclusive: false,
    dpv_match_code: 'Y',
    rdi_type: 'residential',
    missing_secondary: false,
    commercial_mailbox: false,
    vacant_flag: false,
    footnotes: ['AA', 'BB'],
    raw: { analysis: { dpv_match_code: 'Y' } },
    ...overrides,
  };
}

function makePlace(overrides = {}) {
  return {
    google_place_types: ['premise'],
    parcel_type: 'residential',
    building_type: 'single_family',
    ...overrides,
  };
}

function makeProviderPlace(overrides = {}) {
  return {
    provider: 'google_places',
    provider_version: 'places_v1',
    place_id: 'place-123',
    primary_type: 'school',
    types: ['school', 'point_of_interest'],
    business_status: 'OPERATIONAL',
    display_name: 'Roosevelt High School',
    confidence: 0.93,
    is_named_poi: true,
    verification_level: 'shadow_provider_observed',
    risk_flags: ['named_poi'],
    validated_at: '2026-04-02T12:00:00.000Z',
    ...overrides,
  };
}

function makeUnitIntelligence(overrides = {}) {
  return {
    provider: 'smarty_secondary',
    provider_version: 'us_enrichment_secondary_v1',
    secondary_required: true,
    unit_count_estimate: 24,
    confidence: 0.92,
    submitted_unit_known: null,
    submitted_unit_evaluated: false,
    lookup_mode: 'secondary_count',
    verification_level: 'secondary_provider_observed',
    validated_at: '2026-04-02T16:00:00.000Z',
    ...overrides,
  };
}

function makeParcelIntel(overrides = {}) {
  return {
    provider: 'attom',
    provider_version: 'parcel_shadow_v1',
    parcel_id: 'R123456',
    land_use: 'Commercial',
    property_type: 'Office Building',
    building_count: 2,
    residential_unit_count: 0,
    non_residential_unit_count: 1,
    usage_class: 'commercial',
    confidence: 0.8,
    lookup_mode: 'property_detail',
    from_cache: false,
    validated_at: '2026-04-02T18:00:00.000Z',
    ...overrides,
  };
}

function makeHomeAddressRow(overrides = {}) {
  const addr = makeNormalized();
  return {
    id: 'ha-uuid-1',
    address_hash: computeAddressHash(addr.line1, addr.line2 || '', addr.city, addr.state, addr.zip),
    address_line1_norm: addr.line1,
    address_line2_norm: null,
    city_norm: addr.city,
    state: addr.state,
    postal_code: addr.zip,
    country: 'US',
    geocode_lat: 45.5,
    geocode_lng: -122.6,
    place_type: 'unknown',
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ── normalizeAndHash ────────────────────────────────────────

describe('normalizeAndHash', () => {
  test('produces a 64-char hex SHA-256 hash', () => {
    const hash = service.normalizeAndHash(makeNormalized());
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test('same address always produces the same hash', () => {
    const addr = makeNormalized();
    expect(service.normalizeAndHash(addr)).toBe(service.normalizeAndHash(addr));
  });

  test('different addresses produce different hashes', () => {
    const hash1 = service.normalizeAndHash(makeNormalized({ line1: '123 Main St' }));
    const hash2 = service.normalizeAndHash(makeNormalized({ line1: '456 Oak Ave' }));
    expect(hash1).not.toBe(hash2);
  });

  test('abbreviation variants produce the same hash', () => {
    const hashAbbrev = service.normalizeAndHash(makeNormalized({ line1: '123 Main St' }));
    const hashFull = service.normalizeAndHash(makeNormalized({ line1: '123 Main Street' }));
    expect(hashAbbrev).toBe(hashFull);
  });

  test('case insensitive', () => {
    const hashUpper = service.normalizeAndHash(makeNormalized({ line1: '123 MAIN ST' }));
    const hashLower = service.normalizeAndHash(makeNormalized({ line1: '123 main st' }));
    expect(hashUpper).toBe(hashLower);
  });

  test('handles empty line2 vs undefined line2', () => {
    const hash1 = service.normalizeAndHash(makeNormalized({ line2: '' }));
    const hash2 = service.normalizeAndHash(makeNormalized({ line2: undefined }));
    expect(hash1).toBe(hash2);
  });

  test('line2 changes the hash', () => {
    const hash1 = service.normalizeAndHash(makeNormalized({ line2: '' }));
    const hash2 = service.normalizeAndHash(makeNormalized({ line2: 'Apt 2B' }));
    expect(hash1).not.toBe(hash2);
  });

  test('delegates to shared computeAddressHash', () => {
    const addr = makeNormalized();
    const expected = computeAddressHash(addr.line1, addr.line2 || '', addr.city, addr.state, addr.zip);
    expect(service.normalizeAndHash(addr)).toBe(expected);
  });
});

// ── findOrCreate — create path ──────────────────────────────

describe('findOrCreate — create', () => {
  test('creates a new HomeAddress when none exists', async () => {
    const addr = makeNormalized();
    const result = await service.findOrCreate(addr, {
      google: makeGoogle(),
      smarty: makeSmarty(),
    });

    expect(result.error).toBeNull();
    expect(result.created).toBe(true);
    expect(result.data).toBeTruthy();
    expect(result.data.address_hash).toBe(service.normalizeAndHash(addr));
    expect(result.data.address_line1_norm).toBe('123 Main St');
    expect(result.data.city_norm).toBe('Portland');
    expect(result.data.state).toBe('OR');
    expect(result.data.postal_code).toBe('97201');
    expect(result.data.country).toBe('US');
  });

  test('populates geocode from Google', async () => {
    const result = await service.findOrCreate(makeNormalized(), {
      google: makeGoogle({ geocode: { lat: 45.52, lng: -122.68 } }),
      smarty: makeSmarty(),
    });

    expect(result.data.geocode_lat).toBe(45.52);
    expect(result.data.geocode_lng).toBe(-122.68);
  });

  test('populates Smarty validation data', async () => {
    const result = await service.findOrCreate(makeNormalized(), {
      google: makeGoogle(),
      smarty: makeSmarty({ dpv_match_code: 'Y', rdi_type: 'residential' }),
    });

    expect(result.data.validation_vendor).toBe('smarty');
    expect(result.data.last_validated_at).toBeTruthy();
    expect(result.data.validation_raw_response).toBeDefined();
    expect(result.data.validation_raw_response.dpv_match_code).toBe('Y');
    expect(result.data.validation_raw_response.rdi_type).toBe('residential');
  });

  test('persists postal and classification fields used by later claim checks', async () => {
    const result = await service.findOrCreate(makeNormalized({ line2: 'Apt 4A' }), {
      google: makeGoogle(),
      smarty: makeSmarty({
        dpv_match_code: 'S',
        rdi_type: 'residential',
        missing_secondary: true,
        commercial_mailbox: false,
      }),
      place: makePlace({
        google_place_types: ['premise', 'subpremise'],
        parcel_type: 'residential',
        building_type: 'multi_unit',
      }),
    });

    expect(result.data.postal_code_plus4).toBe('1234');
    expect(result.data.dpv_match_code).toBe('S');
    expect(result.data.rdi_type).toBe('residential');
    expect(result.data.missing_secondary_flag).toBe(true);
    expect(result.data.commercial_mailbox_flag).toBe(false);
    expect(result.data.deliverability_status).toBe('partial');
    expect(result.data.parcel_type).toBe('residential');
    expect(result.data.building_type).toBe('multi_unit');
    expect(result.data.google_place_types).toEqual(['premise', 'subpremise']);
  });

  test('persists provider-backed place shadow fields without changing live heuristic classification', async () => {
    const result = await service.findOrCreate(makeNormalized(), {
      google: makeGoogle(),
      smarty: makeSmarty(),
      place: makePlace({
        google_place_types: ['premise'],
        parcel_type: 'residential',
        building_type: 'single_family',
      }),
      providerPlace: makeProviderPlace(),
    });

    expect(result.data.google_place_id).toBe('place-123');
    expect(result.data.google_place_primary_type).toBe('school');
    expect(result.data.google_business_status).toBe('OPERATIONAL');
    expect(result.data.google_place_name).toBe('Roosevelt High School');
    expect(result.data.verification_level).toBe('shadow_provider_observed');
    expect(result.data.risk_flags).toEqual(['named_poi']);
    expect(result.data.last_place_validated_at).toBe('2026-04-02T12:00:00.000Z');
    expect(result.data.provider_versions).toEqual({
      place_classification: {
        provider: 'google_places',
        version: 'places_v1',
        shadow_only: true,
      },
    });
    expect(result.data.google_place_types).toEqual(['premise']);
    expect(result.data.provider_place_types).toEqual(['school', 'point_of_interest']);
    expect(result.data.validation_raw_response.place_provider.types).toEqual(['school', 'point_of_interest']);
    expect(result.data.validation_raw_response.heuristic_place.google_place_types).toEqual(['premise']);
  });

  test('persists compact unit-intelligence metadata without storing a full unit list', async () => {
    const result = await service.findOrCreate(makeNormalized(), {
      google: makeGoogle(),
      smarty: makeSmarty(),
      place: makePlace({
        google_place_types: ['premise'],
        parcel_type: 'residential',
        building_type: 'single_family',
      }),
      unitIntelligence: makeUnitIntelligence({
        submitted_unit_known: false,
        submitted_unit_evaluated: true,
      }),
    });

    expect(result.data.secondary_required).toBe(true);
    expect(result.data.unit_count_estimate).toBe(24);
    expect(result.data.unit_intelligence_confidence).toBe(0.92);
    expect(result.data.last_secondary_validated_at).toBe('2026-04-02T16:00:00.000Z');
    expect(result.data.provider_versions.secondary_address).toEqual({
      provider: 'smarty_secondary',
      version: 'us_enrichment_secondary_v1',
      shadow_only: true,
    });
    expect(result.data.validation_raw_response.secondary_provider).toEqual({
      provider: 'smarty_secondary',
      provider_version: 'us_enrichment_secondary_v1',
      secondary_required: true,
      unit_count_estimate: 24,
      confidence: 0.92,
      submitted_unit_known: false,
      submitted_unit_evaluated: true,
      lookup_mode: 'secondary_count',
      verification_level: 'secondary_provider_observed',
      validated_at: '2026-04-02T16:00:00.000Z',
    });
    expect(result.data.validation_raw_response.secondary_provider.units).toBeUndefined();
  });

  test('persists compact parcel/property metadata without changing heuristic parcel fields', async () => {
    const result = await service.findOrCreate(makeNormalized(), {
      google: makeGoogle(),
      smarty: makeSmarty(),
      place: makePlace({
        google_place_types: ['premise'],
        parcel_type: 'residential',
        building_type: 'single_family',
      }),
      parcelIntel: makeParcelIntel(),
    });

    expect(result.data.parcel_provider).toBe('attom');
    expect(result.data.parcel_id).toBe('R123456');
    expect(result.data.parcel_land_use).toBe('Commercial');
    expect(result.data.parcel_property_type).toBe('Office Building');
    expect(result.data.parcel_confidence).toBe(0.8);
    expect(result.data.building_count).toBe(2);
    expect(result.data.residential_unit_count).toBe(0);
    expect(result.data.non_residential_unit_count).toBe(1);
    expect(result.data.usage_class).toBe('commercial');
    expect(result.data.last_parcel_validated_at).toBe('2026-04-02T18:00:00.000Z');
    expect(result.data.provider_versions.parcel_intel).toEqual({
      provider: 'attom',
      version: 'parcel_shadow_v1',
      shadow_only: true,
    });
    expect(result.data.parcel_type).toBe('residential');
    expect(result.data.validation_raw_response.parcel_provider).toEqual({
      provider: 'attom',
      provider_version: 'parcel_shadow_v1',
      parcel_id: 'R123456',
      land_use: 'Commercial',
      property_type: 'Office Building',
      building_count: 2,
      residential_unit_count: 0,
      non_residential_unit_count: 1,
      usage_class: 'commercial',
      confidence: 0.8,
      lookup_mode: 'property_detail',
      from_cache: false,
      validated_at: '2026-04-02T18:00:00.000Z',
    });
  });

  test('populates place_type from classification', async () => {
    const result = await service.findOrCreate(makeNormalized(), {
      google: makeGoogle(),
      smarty: makeSmarty(),
      place: makePlace({ parcel_type: 'residential' }),
    });

    expect(result.data.place_type).toBe('single_family');
  });

  test('populates Google granularity and verdict', async () => {
    const result = await service.findOrCreate(makeNormalized(), {
      google: makeGoogle({
        granularity: 'SUB_PREMISE',
        verdict: {
          hasUnconfirmedComponents: false,
          hasInferredComponents: true,
          hasReplacedComponents: false,
        },
      }),
      smarty: makeSmarty(),
    });

    expect(result.data.geocode_granularity).toBe('SUB_PREMISE');
    expect(result.data.google_verdict.hasInferredComponents).toBe(true);
  });

  test('handles line2 in address', async () => {
    const addr = makeNormalized({ line2: 'Apt 4A' });
    const result = await service.findOrCreate(addr, {
      google: makeGoogle(),
      smarty: makeSmarty(),
    });

    expect(result.data.address_line2_norm).toBe('Apt 4A');
  });

  test('does not set validation_vendor when Smarty is inconclusive', async () => {
    const result = await service.findOrCreate(makeNormalized(), {
      google: makeGoogle(),
      smarty: makeSmarty({ inconclusive: true }),
    });

    expect(result.data.validation_vendor).toBeUndefined();
    expect(result.data.validation_raw_response).toBeUndefined();
  });

  test('does not set place_type when parcel_type is unknown', async () => {
    const result = await service.findOrCreate(makeNormalized(), {
      google: makeGoogle(),
      smarty: makeSmarty(),
      place: makePlace({ parcel_type: 'unknown', building_type: 'unknown' }),
    });

    // place_type should not be overwritten to 'unknown' — omitted from postal fields
    expect(result.data.place_type).toBeUndefined();
  });

  test('inserts record into HomeAddress table', async () => {
    await service.findOrCreate(makeNormalized(), {
      google: makeGoogle(),
      smarty: makeSmarty(),
    });

    const table = getTable('HomeAddress');
    expect(table).toHaveLength(1);
  });
});

// ── findOrCreate — update path ──────────────────────────────

describe('findOrCreate — update', () => {
  test('updates existing record when hash matches', async () => {
    const existingRow = makeHomeAddressRow();
    seedTable('HomeAddress', [existingRow]);

    const addr = makeNormalized();
    const result = await service.findOrCreate(addr, {
      google: makeGoogle({ geocode: { lat: 45.53, lng: -122.69 } }),
      smarty: makeSmarty({ rdi_type: 'commercial' }),
    });

    expect(result.error).toBeNull();
    expect(result.created).toBe(false);
    expect(result.data.id).toBe('ha-uuid-1');
    expect(result.data.geocode_lat).toBe(45.53);
    expect(result.data.validation_raw_response.rdi_type).toBe('commercial');
  });

  test('bumps updated_at on update', async () => {
    const existingRow = makeHomeAddressRow({ updated_at: '2024-01-01T00:00:00.000Z' });
    seedTable('HomeAddress', [existingRow]);

    const result = await service.findOrCreate(makeNormalized(), {
      google: makeGoogle(),
      smarty: makeSmarty(),
    });

    expect(new Date(result.data.updated_at).getTime())
      .toBeGreaterThan(new Date('2024-01-01').getTime());
  });

  test('does not create a duplicate record', async () => {
    seedTable('HomeAddress', [makeHomeAddressRow()]);

    await service.findOrCreate(makeNormalized(), {
      google: makeGoogle(),
      smarty: makeSmarty(),
    });

    const table = getTable('HomeAddress');
    expect(table).toHaveLength(1);
  });

  test('preserves existing shadow provider metadata when later validations omit provider results', async () => {
    seedTable('HomeAddress', [makeHomeAddressRow({
      google_place_id: 'place-123',
      google_place_primary_type: 'school',
      google_business_status: 'OPERATIONAL',
      google_place_name: 'Roosevelt High School',
      google_place_types: ['premise'],
      provider_place_types: ['school', 'point_of_interest'],
      verification_level: 'shadow_provider_observed',
      risk_flags: ['named_poi'],
      provider_versions: {
        place_classification: {
          provider: 'google_places',
          version: 'places_v1',
          shadow_only: true,
        },
      },
      last_place_validated_at: '2026-04-02T12:00:00.000Z',
      validation_raw_response: {
        place_provider: {
          provider: 'google_places',
          provider_version: 'places_v1',
          place_id: 'place-123',
          primary_type: 'school',
          types: ['school', 'point_of_interest'],
        },
      },
    })]);

    const result = await service.findOrCreate(makeNormalized(), {
      google: makeGoogle(),
      smarty: makeSmarty(),
      place: makePlace({
        google_place_types: ['premise'],
        parcel_type: 'residential',
        building_type: 'single_family',
      }),
    });

    expect(result.data.google_place_id).toBe('place-123');
    expect(result.data.google_place_types).toEqual(['premise']);
    expect(result.data.provider_place_types).toEqual(['school', 'point_of_interest']);
    expect(result.data.provider_versions.place_classification.provider).toBe('google_places');
    expect(result.data.validation_raw_response.place_provider.types).toEqual(['school', 'point_of_interest']);
    expect(result.data.validation_raw_response.heuristic_place.google_place_types).toEqual(['premise']);
  });

  test('preserves existing unit-intelligence metadata when later validations omit secondary-provider results', async () => {
    seedTable('HomeAddress', [makeHomeAddressRow({
      secondary_required: true,
      unit_count_estimate: 24,
      unit_intelligence_confidence: 0.92,
      last_secondary_validated_at: '2026-04-02T16:00:00.000Z',
      provider_versions: {
        secondary_address: {
          provider: 'smarty_secondary',
          version: 'us_enrichment_secondary_v1',
          shadow_only: true,
        },
      },
      validation_raw_response: {
        secondary_provider: {
          provider: 'smarty_secondary',
          provider_version: 'us_enrichment_secondary_v1',
          secondary_required: true,
          unit_count_estimate: 24,
          confidence: 0.92,
        },
      },
    })]);

    const result = await service.findOrCreate(makeNormalized(), {
      google: makeGoogle(),
      smarty: makeSmarty(),
    });

    expect(result.data.secondary_required).toBe(true);
    expect(result.data.unit_count_estimate).toBe(24);
    expect(result.data.unit_intelligence_confidence).toBe(0.92);
    expect(result.data.provider_versions.secondary_address.provider).toBe('smarty_secondary');
    expect(result.data.validation_raw_response.secondary_provider.unit_count_estimate).toBe(24);
  });

  test('preserves existing parcel metadata when later validations omit parcel-provider results', async () => {
    seedTable('HomeAddress', [makeHomeAddressRow({
      parcel_provider: 'attom',
      parcel_id: 'R123456',
      parcel_land_use: 'Commercial',
      parcel_property_type: 'Office Building',
      parcel_confidence: 0.8,
      building_count: 2,
      residential_unit_count: 0,
      non_residential_unit_count: 1,
      usage_class: 'commercial',
      last_parcel_validated_at: '2026-04-02T18:00:00.000Z',
      provider_versions: {
        parcel_intel: {
          provider: 'attom',
          version: 'parcel_shadow_v1',
          shadow_only: true,
        },
      },
      validation_raw_response: {
        parcel_provider: {
          provider: 'attom',
          provider_version: 'parcel_shadow_v1',
          parcel_id: 'R123456',
          land_use: 'Commercial',
          property_type: 'Office Building',
          confidence: 0.8,
        },
      },
    })]);

    const result = await service.findOrCreate(makeNormalized(), {
      google: makeGoogle(),
      smarty: makeSmarty(),
      place: makePlace({
        google_place_types: ['premise'],
        parcel_type: 'residential',
        building_type: 'single_family',
      }),
    });

    expect(result.data.parcel_provider).toBe('attom');
    expect(result.data.parcel_id).toBe('R123456');
    expect(result.data.usage_class).toBe('commercial');
    expect(result.data.provider_versions.parcel_intel.provider).toBe('attom');
    expect(result.data.validation_raw_response.parcel_provider.parcel_id).toBe('R123456');
  });
});

// ── findByHash ──────────────────────────────────────────────

describe('findByHash', () => {
  test('returns existing record by hash', async () => {
    const row = makeHomeAddressRow();
    seedTable('HomeAddress', [row]);

    const result = await service.findByHash(row.address_hash);
    expect(result.error).toBeNull();
    expect(result.data).toBeTruthy();
    expect(result.data.id).toBe('ha-uuid-1');
  });

  test('returns null data when hash not found', async () => {
    const result = await service.findByHash('nonexistent-hash');
    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });

  test('returns null data with empty table', async () => {
    const result = await service.findByHash('any-hash');
    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });
});

// ── mergeAliases ────────────────────────────────────────────

describe('mergeAliases', () => {
  test('repoints Home.address_id from alias to primary', async () => {
    seedTable('HomeAddress', [
      makeHomeAddressRow({ id: 'primary-1', address_hash: 'hash-primary' }),
      makeHomeAddressRow({ id: 'alias-1', address_hash: 'hash-alias' }),
    ]);
    seedTable('Home', [
      { id: 'home-A', address_id: 'alias-1', address: '123 Main St', city: 'Portland', state: 'OR', zipcode: '97201', owner_id: 'user-1' },
      { id: 'home-B', address_id: 'alias-1', address: '123 Main Street', city: 'Portland', state: 'OR', zipcode: '97201', owner_id: 'user-2' },
      { id: 'home-C', address_id: 'primary-1', address: '123 Main St', city: 'Portland', state: 'OR', zipcode: '97201', owner_id: 'user-3' },
    ]);

    const result = await service.mergeAliases('primary-1', 'alias-1');

    expect(result.success).toBe(true);
    expect(result.error).toBeNull();
    expect(result.repointed.homes).toBe(2);

    // All homes now point to primary
    const homes = getTable('Home');
    expect(homes.every((h) => h.address_id === 'primary-1')).toBe(true);
  });

  test('archives the alias record with merged_into pointer', async () => {
    seedTable('HomeAddress', [
      makeHomeAddressRow({ id: 'primary-1', address_hash: 'hash-primary' }),
      makeHomeAddressRow({ id: 'alias-1', address_hash: 'hash-alias' }),
    ]);
    seedTable('Home', []);

    await service.mergeAliases('primary-1', 'alias-1');

    const addresses = getTable('HomeAddress');
    const alias = addresses.find((a) => a.id === 'alias-1');
    expect(alias.address_hash).toBe('merged:alias-1');
    expect(alias.merged_into).toBe('primary-1');
  });

  test('preserves the primary record unchanged', async () => {
    seedTable('HomeAddress', [
      makeHomeAddressRow({ id: 'primary-1', address_hash: 'hash-primary' }),
      makeHomeAddressRow({ id: 'alias-1', address_hash: 'hash-alias' }),
    ]);
    seedTable('Home', []);

    await service.mergeAliases('primary-1', 'alias-1');

    const primary = getTable('HomeAddress').find((a) => a.id === 'primary-1');
    expect(primary.address_hash).toBe('hash-primary');
    expect(primary.merged_into).toBeUndefined();
  });

  test('succeeds with no homes to repoint', async () => {
    seedTable('HomeAddress', [
      makeHomeAddressRow({ id: 'primary-1', address_hash: 'hash-primary' }),
      makeHomeAddressRow({ id: 'alias-1', address_hash: 'hash-alias' }),
    ]);
    seedTable('Home', []);

    const result = await service.mergeAliases('primary-1', 'alias-1');
    expect(result.success).toBe(true);
    expect(result.repointed.homes).toBe(0);
  });

  test('fails when primaryId equals aliasId', async () => {
    const result = await service.mergeAliases('same-id', 'same-id');
    expect(result.success).toBe(false);
    expect(result.error.message).toContain('must differ');
  });

  test('fails when primary record not found', async () => {
    seedTable('HomeAddress', [
      makeHomeAddressRow({ id: 'alias-1', address_hash: 'hash-alias' }),
    ]);

    const result = await service.mergeAliases('nonexistent', 'alias-1');
    expect(result.success).toBe(false);
    expect(result.error.message).toContain('not found');
  });

  test('fails when alias record not found', async () => {
    seedTable('HomeAddress', [
      makeHomeAddressRow({ id: 'primary-1', address_hash: 'hash-primary' }),
    ]);

    const result = await service.mergeAliases('primary-1', 'nonexistent');
    expect(result.success).toBe(false);
    expect(result.error.message).toContain('not found');
  });

  test('updates updated_at on the archived alias', async () => {
    seedTable('HomeAddress', [
      makeHomeAddressRow({ id: 'primary-1', address_hash: 'hash-primary' }),
      makeHomeAddressRow({ id: 'alias-1', address_hash: 'hash-alias', updated_at: '2024-01-01T00:00:00.000Z' }),
    ]);
    seedTable('Home', []);

    await service.mergeAliases('primary-1', 'alias-1');

    const alias = getTable('HomeAddress').find((a) => a.id === 'alias-1');
    expect(new Date(alias.updated_at).getTime())
      .toBeGreaterThan(new Date('2024-01-01').getTime());
  });
});

// ── Integration: findOrCreate + findByHash roundtrip ────────

describe('roundtrip: create then lookup', () => {
  test('findByHash returns the record created by findOrCreate', async () => {
    const addr = makeNormalized();
    const createResult = await service.findOrCreate(addr, {
      google: makeGoogle(),
      smarty: makeSmarty(),
    });

    const hash = service.normalizeAndHash(addr);
    const lookupResult = await service.findByHash(hash);

    expect(lookupResult.data).toBeTruthy();
    expect(lookupResult.data.id).toBe(createResult.data.id);
  });

  test('second findOrCreate updates rather than duplicates', async () => {
    const addr = makeNormalized();
    const first = await service.findOrCreate(addr, {
      google: makeGoogle(),
      smarty: makeSmarty({ rdi_type: 'residential' }),
    });

    const second = await service.findOrCreate(addr, {
      google: makeGoogle(),
      smarty: makeSmarty({ rdi_type: 'commercial' }),
    });

    expect(second.created).toBe(false);
    expect(second.data.id).toBe(first.data.id);
    expect(second.data.validation_raw_response.rdi_type).toBe('commercial');
    expect(getTable('HomeAddress')).toHaveLength(1);
  });
});

// ── Edge cases ──────────────────────────────────────────────

describe('edge cases', () => {
  test('findOrCreate with no validationResult', async () => {
    const result = await service.findOrCreate(makeNormalized(), null);
    expect(result.error).toBeNull();
    expect(result.created).toBe(true);
    expect(result.data.address_line1_norm).toBe('123 Main St');
  });

  test('findOrCreate with empty validationResult', async () => {
    const result = await service.findOrCreate(makeNormalized(), {});
    expect(result.error).toBeNull();
    expect(result.created).toBe(true);
  });

  test('findOrCreate with only Google, no Smarty', async () => {
    const result = await service.findOrCreate(makeNormalized(), {
      google: makeGoogle(),
    });
    expect(result.data.geocode_granularity).toBe('PREMISE');
    expect(result.data.validation_vendor).toBeUndefined();
  });

  test('findOrCreate with only Smarty, no Google', async () => {
    const result = await service.findOrCreate(makeNormalized(), {
      smarty: makeSmarty(),
    });
    expect(result.data.validation_vendor).toBe('smarty');
    expect(result.data.geocode_granularity).toBeUndefined();
  });

  test('geocode falls back to address lat/lng when Google has no geocode', async () => {
    const result = await service.findOrCreate(
      makeNormalized({ lat: 40.7, lng: -74.0 }),
      {},
    );
    expect(result.data.geocode_lat).toBe(40.7);
    expect(result.data.geocode_lng).toBe(-74.0);
  });
});
