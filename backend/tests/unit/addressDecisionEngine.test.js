// ============================================================
// TEST: AddressDecisionEngine — Deterministic Classification
//
// Comprehensive tests for every classification bucket and edge
// cases, including mixed signals, priority ordering, and
// confidence scoring.
// ============================================================

const engine = require('../../services/addressValidation/addressDecisionEngine');
const { AddressVerdictStatus } = require('../../services/addressValidation/types');

// ── Test data factories ─────────────────────────────────────

function makeGoogle(overrides = {}) {
  return {
    normalized: {
      line1: '123 Main St',
      city: 'Portland',
      state: 'OR',
      zip: '97201',
      lat: 45.5,
      lng: -122.6,
    },
    components: {},
    geocode: { lat: 45.5, lng: -122.6 },
    granularity: 'PREMISE',
    missing_component_types: [],
    verdict: {
      inputGranularity: 'PREMISE',
      validationGranularity: 'PREMISE',
      geocodeGranularity: 'PREMISE',
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
    footnotes: [],
    ...overrides,
  };
}

function makePlace(overrides = {}) {
  return {
    google_place_types: [],
    parcel_type: 'unknown',
    building_type: 'unknown',
    ...overrides,
  };
}

function makeHousehold(overrides = {}) {
  return {
    home_id: 'home-uuid-123',
    member_count: 3,
    active_roles: ['owner', 'tenant'],
    ...overrides,
  };
}

// ── 1. SERVICE_ERROR ────────────────────────────────────────

describe('Rule 1: SERVICE_ERROR', () => {
  test('returns SERVICE_ERROR when Google result is missing', () => {
    const result = engine.classify({ smarty: makeSmarty() });
    expect(result.status).toBe(AddressVerdictStatus.SERVICE_ERROR);
    expect(result.reasons).toContain('Google validation result missing');
    expect(result.next_actions).toContain('manual_review');
    expect(result.confidence).toBe(0);
  });

  test('returns SERVICE_ERROR when Smarty result is missing', () => {
    const result = engine.classify({ google: makeGoogle() });
    expect(result.status).toBe(AddressVerdictStatus.SERVICE_ERROR);
    expect(result.reasons).toContain('Smarty postal result missing');
  });

  test('returns SERVICE_ERROR when Smarty is inconclusive', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ inconclusive: true }),
    });
    expect(result.status).toBe(AddressVerdictStatus.SERVICE_ERROR);
    expect(result.reasons).toContain('Smarty postal check was inconclusive');
  });

  test('returns SERVICE_ERROR when both providers are missing', () => {
    const result = engine.classify({});
    expect(result.status).toBe(AddressVerdictStatus.SERVICE_ERROR);
  });

  test('SERVICE_ERROR takes priority over all other signals', () => {
    // Even with missing_secondary, SERVICE_ERROR wins if Google is missing
    const result = engine.classify({
      smarty: makeSmarty({ missing_secondary: true }),
    });
    expect(result.status).toBe(AddressVerdictStatus.SERVICE_ERROR);
  });
});

// ── 2. UNDELIVERABLE ───────────────────────────────────────

describe('Rule 2: UNDELIVERABLE', () => {
  test('returns UNDELIVERABLE when DPV match code is N', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ dpv_match_code: 'N' }),
    });
    expect(result.status).toBe(AddressVerdictStatus.UNDELIVERABLE);
    expect(result.reasons).toContain('DPV_NO_MATCH');
    expect(result.next_actions).toContain('manual_review');
  });

  test('includes USPS_VACANT reason when vacant', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ dpv_match_code: 'N', vacant_flag: true }),
    });
    expect(result.status).toBe(AddressVerdictStatus.UNDELIVERABLE);
    expect(result.reasons).toContain('USPS_VACANT');
  });

  test('includes CMRA_MAILBOX reason when commercial mailbox', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ dpv_match_code: 'N', commercial_mailbox: true }),
    });
    expect(result.status).toBe(AddressVerdictStatus.UNDELIVERABLE);
    expect(result.reasons).toContain('CMRA_MAILBOX');
  });

  test('UNDELIVERABLE when DPV empty + Google unconfirmed + low granularity', () => {
    const result = engine.classify({
      google: makeGoogle({
        granularity: 'ROUTE',
        verdict: {
          hasUnconfirmedComponents: true,
          hasInferredComponents: false,
          hasReplacedComponents: false,
        },
      }),
      smarty: makeSmarty({ dpv_match_code: '' }),
    });
    expect(result.status).toBe(AddressVerdictStatus.UNDELIVERABLE);
  });

  test('UNDELIVERABLE takes priority over MISSING_UNIT', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ dpv_match_code: 'N', missing_secondary: true }),
    });
    expect(result.status).toBe(AddressVerdictStatus.UNDELIVERABLE);
  });
});

// ── 3. MISSING_STREET_NUMBER ─────────────────────────────────

describe('Rule 3: MISSING_STREET_NUMBER', () => {
  test('returns MISSING_STREET_NUMBER when Google reports street_number missing', () => {
    const result = engine.classify({
      google: makeGoogle({ missing_component_types: ['street_number'] }),
      smarty: makeSmarty(),
    });
    expect(result.status).toBe(AddressVerdictStatus.MISSING_STREET_NUMBER);
    expect(result.reasons).toContain('MISSING_STREET_NUMBER');
    expect(result.reasons).toContain('GOOGLE_STREET_NUMBER_MISSING');
    expect(result.next_actions).toContain('prompt_street_number');
    expect(result.confidence).toBe(0.15);
  });

  test('returns MISSING_STREET_NUMBER when normalized line1 has no leading digit', () => {
    const result = engine.classify({
      google: makeGoogle({
        normalized: {
          line1: 'Main St',
          city: 'Portland',
          state: 'OR',
          zip: '97201',
          lat: 45.5,
          lng: -122.6,
        },
      }),
      smarty: makeSmarty(),
    });
    expect(result.status).toBe(AddressVerdictStatus.MISSING_STREET_NUMBER);
    expect(result.reasons).toContain('MISSING_STREET_NUMBER');
  });

  test('does NOT return MISSING_STREET_NUMBER when line1 starts with a number', () => {
    const result = engine.classify({
      google: makeGoogle(), // default: '123 Main St'
      smarty: makeSmarty(),
    });
    expect(result.status).not.toBe(AddressVerdictStatus.MISSING_STREET_NUMBER);
  });

  test('MISSING_STREET_NUMBER takes priority over MISSING_UNIT', () => {
    const result = engine.classify({
      google: makeGoogle({
        missing_component_types: ['street_number', 'subpremise'],
      }),
      smarty: makeSmarty({ missing_secondary: true }),
    });
    expect(result.status).toBe(AddressVerdictStatus.MISSING_STREET_NUMBER);
  });

  test('UNDELIVERABLE takes priority over MISSING_STREET_NUMBER', () => {
    const result = engine.classify({
      google: makeGoogle({ missing_component_types: ['street_number'] }),
      smarty: makeSmarty({ dpv_match_code: 'N' }),
    });
    expect(result.status).toBe(AddressVerdictStatus.UNDELIVERABLE);
  });

  test('does NOT trigger when Google result is missing', () => {
    const result = engine.classify({
      smarty: makeSmarty(),
    });
    // Should be SERVICE_ERROR (no Google), not MISSING_STREET_NUMBER
    expect(result.status).toBe(AddressVerdictStatus.SERVICE_ERROR);
  });
});

// ── 4. MISSING_UNIT ─────────────────────────────────────────

describe('Rule 4: MISSING_UNIT', () => {
  test('returns MISSING_UNIT when Smarty missing_secondary is true', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ missing_secondary: true, dpv_match_code: 'S' }),
    });
    expect(result.status).toBe(AddressVerdictStatus.MISSING_UNIT);
    expect(result.reasons).toContain('MISSING_SECONDARY');
    expect(result.next_actions).toContain('prompt_unit');
  });

  test('returns MISSING_UNIT when DPV match code is S', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ dpv_match_code: 'S' }),
    });
    expect(result.status).toBe(AddressVerdictStatus.MISSING_UNIT);
    expect(result.reasons).toContain('DPV_SECONDARY_MISSING');
  });

  test('returns MISSING_UNIT when Google has missing subpremise', () => {
    const result = engine.classify({
      google: makeGoogle({ missing_component_types: ['subpremise'] }),
      smarty: makeSmarty({ dpv_match_code: 'Y' }),
    });
    expect(result.status).toBe(AddressVerdictStatus.MISSING_UNIT);
    expect(result.reasons).toContain('GOOGLE_SUBPREMISE_MISSING');
  });

  test('MISSING_UNIT hard rule: applies even with RDI=Business', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({
        missing_secondary: true,
        dpv_match_code: 'S',
        rdi_type: 'commercial',
      }),
      place: makePlace({
        google_place_types: ['store'],
        parcel_type: 'commercial',
      }),
    });
    expect(result.status).toBe(AddressVerdictStatus.MISSING_UNIT);
  });

  test('MISSING_UNIT confidence is 0.3', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ missing_secondary: true }),
    });
    expect(result.confidence).toBe(0.3);
  });

  test('does not return MISSING_UNIT when only provider unit intelligence rejects a supplied unit', () => {
    const result = engine.classify({
      google: makeGoogle({
        normalized: {
          line1: '123 Main St',
          line2: 'Apt 9Z',
          city: 'Portland',
          state: 'OR',
          zip: '97201',
          lat: 45.5,
          lng: -122.6,
        },
      }),
      smarty: makeSmarty({ dpv_match_code: 'Y', missing_secondary: false }),
      unit_intelligence: {
        provider: 'smarty_secondary',
        provider_version: 'us_enrichment_secondary_v1',
        secondary_required: true,
        unit_count_estimate: 24,
        confidence: 0.95,
        submitted_unit_evaluated: true,
        submitted_unit_known: false,
      },
      use_provider_unit_intelligence: true,
    });

    expect(result.status).not.toBe(AddressVerdictStatus.MISSING_UNIT);
    expect(result.reasons).not.toContain('MISSING_SECONDARY');
  });
});

// ── 4. BUSINESS ─────────────────────────────────────────────

describe('Rule 4: BUSINESS', () => {
  test('returns BUSINESS when RDI commercial + place commercial + no residential', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ rdi_type: 'commercial' }),
      place: makePlace({
        google_place_types: ['store', 'point_of_interest'],
        parcel_type: 'commercial',
      }),
    });
    expect(result.status).toBe(AddressVerdictStatus.BUSINESS);
    expect(result.reasons).toContain('RDI_COMMERCIAL');
    expect(result.reasons).toContain('PLACE_COMMERCIAL');
    expect(result.next_actions).toContain('manual_review');
  });

  test('returns BUSINESS when RDI commercial + building_type commercial', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ rdi_type: 'commercial' }),
      place: makePlace({ building_type: 'commercial' }),
    });
    expect(result.status).toBe(AddressVerdictStatus.BUSINESS);
  });

  test('returns BUSINESS when RDI commercial and there are no residential signals', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ rdi_type: 'commercial' }),
      place: makePlace(),
    });
    expect(result.status).toBe(AddressVerdictStatus.BUSINESS);
  });

  test('returns BUSINESS for institutional place signals even when RDI is unknown', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ rdi_type: 'unknown' }),
      place: makePlace({
        google_place_types: ['school'],
        parcel_type: 'commercial',
        building_type: 'commercial',
      }),
    });
    expect(result.status).toBe(AddressVerdictStatus.BUSINESS);
    expect(result.reasons).toContain('PLACE_INSTITUTIONAL');
  });

  test('returns BUSINESS when CMRA mailbox, regardless of RDI', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ rdi_type: 'residential', commercial_mailbox: true }),
    });
    expect(result.status).toBe(AddressVerdictStatus.BUSINESS);
    expect(result.reasons).toContain('CMRA_MAILBOX');
  });

  test('does NOT return BUSINESS when RDI commercial but residential place signals exist', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ rdi_type: 'commercial' }),
      place: makePlace({
        google_place_types: ['premise'],
        parcel_type: 'residential',
        building_type: 'single_family',
      }),
    });
    expect(result.status).toBe(AddressVerdictStatus.MIXED_USE);
  });

  test('does NOT return BUSINESS when RDI is residential', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ rdi_type: 'residential' }),
      place: makePlace({
        google_place_types: ['store'],
        parcel_type: 'commercial',
      }),
    });
    expect(result.status).not.toBe(AddressVerdictStatus.BUSINESS);
  });

  test('returns BUSINESS when RDI commercial but there are no residential signals', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ rdi_type: 'commercial' }),
      place: makePlace({
        google_place_types: [],
        parcel_type: 'unknown',
        building_type: 'unknown',
      }),
    });
    expect(result.status).toBe(AddressVerdictStatus.BUSINESS);
  });
});

// ── 5. MIXED_USE ────────────────────────────────────────────

describe('Rule 5: MIXED_USE', () => {
  test('returns MIXED_USE when parcel_type is mixed', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty(),
      place: makePlace({ parcel_type: 'mixed' }),
    });
    expect(result.status).toBe(AddressVerdictStatus.MIXED_USE);
    expect(result.next_actions).toContain('manual_review');
    expect(result.next_actions).toContain('send_mail_code');
  });

  test('returns MIXED_USE when building_type is mixed_use', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty(),
      place: makePlace({ building_type: 'mixed_use' }),
    });
    expect(result.status).toBe(AddressVerdictStatus.MIXED_USE);
  });

  test('returns MIXED_USE when RDI unknown + both residential and commercial place signals', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ rdi_type: 'unknown' }),
      place: makePlace({
        google_place_types: ['premise', 'restaurant'],
      }),
    });
    expect(result.status).toBe(AddressVerdictStatus.MIXED_USE);
  });

  test('edge case: RDI=Residential but place includes restaurant → MIXED_USE', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ rdi_type: 'residential' }),
      place: makePlace({
        google_place_types: ['premise', 'restaurant'],
      }),
    });
    expect(result.status).toBe(AddressVerdictStatus.MIXED_USE);
    expect(result.reasons).toContain('RDI_RESIDENTIAL');
    expect(result.reasons).toContain('PLACE_RESIDENTIAL');
    expect(result.reasons).toContain('PLACE_COMMERCIAL');
  });
});

// ── 6. LOW_CONFIDENCE ───────────────────────────────────────

describe('Rule 6: LOW_CONFIDENCE', () => {
  test('returns LOW_CONFIDENCE when granularity is ROUTE', () => {
    const result = engine.classify({
      google: makeGoogle({ granularity: 'ROUTE' }),
      smarty: makeSmarty(),
    });
    expect(result.status).toBe(AddressVerdictStatus.LOW_CONFIDENCE);
    expect(result.reasons).toContain('GEOCODE_GRANULARITY_ROUTE');
    expect(result.next_actions).toContain('manual_review');
  });

  test('returns LOW_CONFIDENCE when granularity is OTHER', () => {
    const result = engine.classify({
      google: makeGoogle({ granularity: 'OTHER' }),
      smarty: makeSmarty(),
    });
    expect(result.status).toBe(AddressVerdictStatus.LOW_CONFIDENCE);
  });

  test('returns LOW_CONFIDENCE when granularity is APPROXIMATE', () => {
    const result = engine.classify({
      google: makeGoogle({ granularity: 'APPROXIMATE' }),
      smarty: makeSmarty(),
    });
    expect(result.status).toBe(AddressVerdictStatus.LOW_CONFIDENCE);
  });

  test('edge case: DPV match but geocode is only route-level → LOW_CONFIDENCE', () => {
    const result = engine.classify({
      google: makeGoogle({ granularity: 'ROUTE' }),
      smarty: makeSmarty({ dpv_match_code: 'Y', rdi_type: 'residential' }),
    });
    // Even with good DPV, route-level geocode means LOW_CONFIDENCE
    expect(result.status).toBe(AddressVerdictStatus.LOW_CONFIDENCE);
    expect(result.reasons).toContain('DPV_Y');
    expect(result.reasons).toContain('RDI_RESIDENTIAL');
    expect(result.reasons).toContain('GEOCODE_GRANULARITY_ROUTE');
  });

  test('does NOT return LOW_CONFIDENCE for PREMISE granularity', () => {
    const result = engine.classify({
      google: makeGoogle({ granularity: 'PREMISE' }),
      smarty: makeSmarty(),
    });
    expect(result.status).not.toBe(AddressVerdictStatus.LOW_CONFIDENCE);
  });

  test('does NOT return LOW_CONFIDENCE for SUB_PREMISE granularity', () => {
    const result = engine.classify({
      google: makeGoogle({ granularity: 'SUB_PREMISE' }),
      smarty: makeSmarty(),
    });
    expect(result.status).not.toBe(AddressVerdictStatus.LOW_CONFIDENCE);
  });
});

// ── 7. MULTIPLE_MATCHES ─────────────────────────────────────

describe('Rule 7: MULTIPLE_MATCHES', () => {
  test('returns MULTIPLE_MATCHES when more than one candidate', () => {
    const candidates = [
      { address: { line1: '123 Main St', city: 'Portland', state: 'OR', zip: '97201', lat: 45.5, lng: -122.6 }, confidence: 0.8 },
      { address: { line1: '123 Main St', line2: 'Apt A', city: 'Portland', state: 'OR', zip: '97201', lat: 45.5, lng: -122.6 }, confidence: 0.7 },
    ];
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty(),
      candidates,
    });
    expect(result.status).toBe(AddressVerdictStatus.MULTIPLE_MATCHES);
    expect(result.reasons).toContain('MULTIPLE_CANDIDATES');
    expect(result.next_actions).toContain('select_candidate');
    expect(result.candidates).toHaveLength(2);
  });

  test('does NOT return MULTIPLE_MATCHES for single candidate', () => {
    const candidates = [
      { address: { line1: '123 Main St', city: 'Portland', state: 'OR', zip: '97201', lat: 45.5, lng: -122.6 }, confidence: 0.9 },
    ];
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty(),
      candidates,
    });
    expect(result.status).not.toBe(AddressVerdictStatus.MULTIPLE_MATCHES);
  });

  test('does NOT return MULTIPLE_MATCHES for empty candidates', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty(),
      candidates: [],
    });
    expect(result.status).not.toBe(AddressVerdictStatus.MULTIPLE_MATCHES);
  });
});

// ── 8. CONFLICT ─────────────────────────────────────────────

describe('Rule 8: CONFLICT', () => {
  test('returns CONFLICT when existing household found', () => {
    const household = makeHousehold();
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty(),
      household,
    });
    expect(result.status).toBe(AddressVerdictStatus.CONFLICT);
    expect(result.reasons).toContain('EXISTING_HOUSEHOLD');
    expect(result.existing_household).toEqual(household);
    expect(result.next_actions).toContain('join_existing');
    expect(result.next_actions).toContain('dispute');
  });

  test('CONFLICT confidence reflects underlying signal quality', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ dpv_match_code: 'Y', rdi_type: 'residential' }),
      household: makeHousehold(),
    });
    // Should have high confidence since DPV Y + RDI residential + PREMISE
    expect(result.confidence).toBeGreaterThan(0.8);
  });
});

// ── 9. OK ───────────────────────────────────────────────────

describe('Rule 9: OK', () => {
  test('returns OK when all checks pass', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty(),
    });
    expect(result.status).toBe(AddressVerdictStatus.OK);
    expect(result.next_actions).toContain('send_mail_code');
  });

  test('OK includes normalized address from Google', () => {
    const google = makeGoogle();
    const result = engine.classify({
      google,
      smarty: makeSmarty(),
    });
    expect(result.normalized).toEqual(google.normalized);
  });

  test('OK includes deliverability from Smarty', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty(),
    });
    expect(result.deliverability).toBeDefined();
    expect(result.deliverability.dpv_match_code).toBe('Y');
    expect(result.deliverability.rdi_type).toBe('residential');
  });

  test('OK includes classification when place provided', () => {
    const place = makePlace({
      google_place_types: ['premise'],
      parcel_type: 'residential',
    });
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty(),
      place,
    });
    expect(result.classification).toEqual(place);
  });

  test('OK with empty candidates array', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty(),
    });
    expect(result.candidates).toEqual([]);
  });
});

// ── Confidence scoring ──────────────────────────────────────

describe('Confidence scoring', () => {
  test('DPV Y + RDI residential + PREMISE → high confidence', () => {
    const result = engine.classify({
      google: makeGoogle({ granularity: 'PREMISE' }),
      smarty: makeSmarty({ dpv_match_code: 'Y', rdi_type: 'residential' }),
    });
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  test('DPV D (secondary not confirmed) → lower confidence than DPV Y', () => {
    const resultY = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ dpv_match_code: 'Y' }),
    });
    const resultD = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ dpv_match_code: 'D' }),
    });
    expect(resultY.confidence).toBeGreaterThan(resultD.confidence);
  });

  test('vacant flag reduces confidence', () => {
    const normal = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty(),
    });
    const vacant = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ vacant_flag: true }),
    });
    expect(normal.confidence).toBeGreaterThan(vacant.confidence);
  });

  test('Google replaced components reduce confidence', () => {
    const clean = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty(),
    });
    const replaced = engine.classify({
      google: makeGoogle({
        verdict: {
          hasUnconfirmedComponents: false,
          hasInferredComponents: false,
          hasReplacedComponents: true,
        },
      }),
      smarty: makeSmarty(),
    });
    expect(clean.confidence).toBeGreaterThan(replaced.confidence);
  });

  test('confidence is clamped to [0, 1]', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty(),
    });
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

// ── Priority ordering ───────────────────────────────────────

describe('Priority ordering', () => {
  test('UNDELIVERABLE beats MISSING_UNIT', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({
        dpv_match_code: 'N',
        missing_secondary: true,
      }),
    });
    expect(result.status).toBe(AddressVerdictStatus.UNDELIVERABLE);
  });

  test('MISSING_STREET_NUMBER beats MISSING_UNIT', () => {
    const result = engine.classify({
      google: makeGoogle({
        missing_component_types: ['street_number', 'subpremise'],
      }),
      smarty: makeSmarty({ missing_secondary: true }),
    });
    expect(result.status).toBe(AddressVerdictStatus.MISSING_STREET_NUMBER);
  });

  test('MISSING_UNIT beats BUSINESS', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({
        missing_secondary: true,
        rdi_type: 'commercial',
      }),
      place: makePlace({
        google_place_types: ['store'],
        parcel_type: 'commercial',
      }),
    });
    expect(result.status).toBe(AddressVerdictStatus.MISSING_UNIT);
  });

  test('BUSINESS beats MIXED_USE', () => {
    // CMRA is always BUSINESS
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({
        rdi_type: 'residential',
        commercial_mailbox: true,
      }),
      place: makePlace({ parcel_type: 'mixed' }),
    });
    expect(result.status).toBe(AddressVerdictStatus.BUSINESS);
  });

  test('LOW_CONFIDENCE beats MULTIPLE_MATCHES', () => {
    const result = engine.classify({
      google: makeGoogle({ granularity: 'ROUTE' }),
      smarty: makeSmarty(),
      candidates: [
        { address: { line1: '123', city: 'P', state: 'OR', zip: '97201', lat: 0, lng: 0 }, confidence: 0.8 },
        { address: { line1: '124', city: 'P', state: 'OR', zip: '97201', lat: 0, lng: 0 }, confidence: 0.7 },
      ],
    });
    expect(result.status).toBe(AddressVerdictStatus.LOW_CONFIDENCE);
  });

  test('MULTIPLE_MATCHES beats CONFLICT', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty(),
      candidates: [
        { address: { line1: '123', city: 'P', state: 'OR', zip: '97201', lat: 0, lng: 0 }, confidence: 0.8 },
        { address: { line1: '124', city: 'P', state: 'OR', zip: '97201', lat: 0, lng: 0 }, confidence: 0.7 },
      ],
      household: makeHousehold(),
    });
    expect(result.status).toBe(AddressVerdictStatus.MULTIPLE_MATCHES);
  });

  test('CONFLICT beats OK', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty(),
      household: makeHousehold(),
    });
    expect(result.status).toBe(AddressVerdictStatus.CONFLICT);
  });
});

// ── Edge cases ──────────────────────────────────────────────

describe('Edge cases', () => {
  test('RDI=Residential but place_type includes restaurant (mixed signals)', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ rdi_type: 'residential' }),
      place: makePlace({
        google_place_types: ['premise', 'restaurant'],
      }),
    });
    // Both residential (premise) and commercial (restaurant) signals → MIXED_USE
    expect(result.status).toBe(AddressVerdictStatus.MIXED_USE);
    expect(result.reasons).toContain('RDI_RESIDENTIAL');
    expect(result.reasons).toContain('PLACE_RESIDENTIAL');
    expect(result.reasons).toContain('PLACE_COMMERCIAL');
  });

  test('Missing secondary but RDI=Business (multi-unit commercial)', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({
        dpv_match_code: 'S',
        missing_secondary: true,
        rdi_type: 'commercial',
      }),
      place: makePlace({
        google_place_types: ['store'],
        parcel_type: 'commercial',
      }),
    });
    // MISSING_UNIT beats BUSINESS per priority
    expect(result.status).toBe(AddressVerdictStatus.MISSING_UNIT);
    expect(result.reasons).toContain('MISSING_SECONDARY');
  });

  test('DPV match but geocode is only route-level', () => {
    const result = engine.classify({
      google: makeGoogle({ granularity: 'ROUTE' }),
      smarty: makeSmarty({ dpv_match_code: 'Y', rdi_type: 'residential' }),
    });
    // Route-level geocode → LOW_CONFIDENCE despite good DPV
    expect(result.status).toBe(AddressVerdictStatus.LOW_CONFIDENCE);
    expect(result.reasons).toContain('DPV_Y');
    expect(result.reasons).toContain('GEOCODE_GRANULARITY_ROUTE');
  });

  test('RDI=Commercial with no place signals and no parcel data → BUSINESS', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ rdi_type: 'commercial' }),
    });
    expect(result.status).toBe(AddressVerdictStatus.BUSINESS);
    expect(result.reasons).toContain('RDI_COMMERCIAL');
  });

  test('RDI=unknown with only residential place signals → OK', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ rdi_type: 'unknown' }),
      place: makePlace({
        google_place_types: ['premise', 'street_address'],
      }),
    });
    expect(result.status).toBe(AddressVerdictStatus.OK);
  });

  test('DPV D with Google subpremise missing → MISSING_UNIT', () => {
    const result = engine.classify({
      google: makeGoogle({ missing_component_types: ['subpremise'] }),
      smarty: makeSmarty({ dpv_match_code: 'D' }),
    });
    expect(result.status).toBe(AddressVerdictStatus.MISSING_UNIT);
    expect(result.reasons).toContain('GOOGLE_SUBPREMISE_MISSING');
  });

  test('null input returns SERVICE_ERROR', () => {
    const result = engine.classify(null);
    expect(result.status).toBe(AddressVerdictStatus.SERVICE_ERROR);
  });

  test('vacant address with DPV Y still OK (just lower confidence)', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ vacant_flag: true, dpv_match_code: 'Y' }),
    });
    expect(result.status).toBe(AddressVerdictStatus.OK);
    expect(result.reasons).toContain('USPS_VACANT');
    expect(result.confidence).toBeLessThan(0.9);
  });

  test('vacant address with DPV D is OK (confirmed delivery point)', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ vacant_flag: true, dpv_match_code: 'D' }),
    });
    expect(result.status).toBe(AddressVerdictStatus.OK);
    expect(result.reasons).toContain('USPS_VACANT');
    expect(result.confidence).toBeLessThan(0.9);
  });

  test('BLOCK granularity is LOW_CONFIDENCE', () => {
    const result = engine.classify({
      google: makeGoogle({ granularity: 'BLOCK' }),
      smarty: makeSmarty(),
    });
    expect(result.status).toBe(AddressVerdictStatus.LOW_CONFIDENCE);
  });

  test('RANGE_INTERPOLATED granularity is LOW_CONFIDENCE', () => {
    const result = engine.classify({
      google: makeGoogle({ granularity: 'RANGE_INTERPOLATED' }),
      smarty: makeSmarty(),
    });
    expect(result.status).toBe(AddressVerdictStatus.LOW_CONFIDENCE);
  });

  test('ROOFTOP granularity is not LOW_CONFIDENCE', () => {
    const result = engine.classify({
      google: makeGoogle({ granularity: 'ROOFTOP' }),
      smarty: makeSmarty(),
    });
    expect(result.status).not.toBe(AddressVerdictStatus.LOW_CONFIDENCE);
  });
});

// ── Reasons array completeness ──────────────────────────────

describe('Reasons array', () => {
  test('OK verdict includes all positive signals', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ dpv_match_code: 'Y', rdi_type: 'residential' }),
      place: makePlace({
        google_place_types: ['premise'],
        parcel_type: 'residential',
        building_type: 'single_family',
      }),
    });
    expect(result.reasons).toContain('DPV_Y');
    expect(result.reasons).toContain('RDI_RESIDENTIAL');
    expect(result.reasons).toContain('PLACE_RESIDENTIAL');
    expect(result.reasons).toContain('PARCEL_RESIDENTIAL');
    expect(result.reasons).toContain('BUILDING_SINGLE_FAMILY');
  });

  test('BUSINESS verdict includes commercial signals', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ rdi_type: 'commercial', dpv_match_code: 'Y' }),
      place: makePlace({
        google_place_types: ['store'],
        parcel_type: 'commercial',
      }),
    });
    expect(result.reasons).toContain('RDI_COMMERCIAL');
    expect(result.reasons).toContain('PLACE_COMMERCIAL');
    expect(result.reasons).toContain('PARCEL_COMMERCIAL');
  });
});

// ── PO_BOX ──────────────────────────────────────────────────

describe('Rule 3: PO_BOX', () => {
  test('returns PO_BOX when USPS carrier route type is P', () => {
    const result = engine.classify({
      google: makeGoogle({
        usps_data: { carrier_route_type: 'P' },
      }),
      smarty: makeSmarty(),
    });
    expect(result.status).toBe(AddressVerdictStatus.PO_BOX);
    expect(result.reasons).toContain('PO_BOX');
    expect(result.reasons).toContain('USPS_PO_BOX_ROUTE');
    expect(result.next_actions).toContain('reject');
    expect(result.confidence).toBe(0);
  });

  test('returns PO_BOX when normalized line1 matches PO Box pattern', () => {
    const result = engine.classify({
      google: makeGoogle({
        normalized: {
          line1: 'PO Box 1234',
          city: 'Portland',
          state: 'OR',
          zip: '97201',
          lat: 45.5,
          lng: -122.6,
        },
      }),
      smarty: makeSmarty(),
    });
    expect(result.status).toBe(AddressVerdictStatus.PO_BOX);
    expect(result.reasons).toContain('PO_BOX_PATTERN');
  });

  test('returns PO_BOX for P.O. Box variant', () => {
    const result = engine.classify({
      google: makeGoogle({
        normalized: {
          line1: 'P.O. Box 567',
          city: 'Portland',
          state: 'OR',
          zip: '97201',
          lat: 45.5,
          lng: -122.6,
        },
      }),
      smarty: makeSmarty(),
    });
    expect(result.status).toBe(AddressVerdictStatus.PO_BOX);
  });

  test('returns PO_BOX for Post Office Box variant', () => {
    const result = engine.classify({
      google: makeGoogle({
        normalized: {
          line1: 'Post Office Box 99',
          city: 'Portland',
          state: 'OR',
          zip: '97201',
          lat: 45.5,
          lng: -122.6,
        },
      }),
      smarty: makeSmarty(),
    });
    expect(result.status).toBe(AddressVerdictStatus.PO_BOX);
  });

  test('does NOT flag regular addresses as PO_BOX', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty(),
    });
    expect(result.status).not.toBe(AddressVerdictStatus.PO_BOX);
  });

  test('UNDELIVERABLE takes priority over PO_BOX', () => {
    const result = engine.classify({
      google: makeGoogle({
        usps_data: { carrier_route_type: 'P' },
      }),
      smarty: makeSmarty({ dpv_match_code: 'N' }),
    });
    expect(result.status).toBe(AddressVerdictStatus.UNDELIVERABLE);
  });
});

// ── UNVERIFIED_STREET_NUMBER ────────────────────────────────

describe('Rule 5: UNVERIFIED_STREET_NUMBER', () => {
  test('returns UNVERIFIED_STREET_NUMBER when street_number is not confirmed', () => {
    const result = engine.classify({
      google: makeGoogle({
        components: {
          street_number: { text: '4016', confirmed: false, inferred: false, replaced: false },
          route: { text: 'Elm St', confirmed: true, inferred: false, replaced: false },
        },
        verdict: {
          inputGranularity: 'PREMISE',
          validationGranularity: 'PREMISE',
          geocodeGranularity: 'PREMISE',
          hasUnconfirmedComponents: true,
          hasInferredComponents: false,
          hasReplacedComponents: false,
        },
      }),
      smarty: makeSmarty(),
    });
    expect(result.status).toBe(AddressVerdictStatus.UNVERIFIED_STREET_NUMBER);
    expect(result.reasons).toContain('UNVERIFIED_STREET_NUMBER');
    expect(result.reasons).toContain('GOOGLE_UNCONFIRMED_COMPONENTS');
    expect(result.next_actions).toContain('manual_review');
    expect(result.confidence).toBe(0.2);
  });

  test('returns UNVERIFIED_STREET_NUMBER when street_number is inferred', () => {
    const result = engine.classify({
      google: makeGoogle({
        components: {
          street_number: { text: '4016', confirmed: false, inferred: true, replaced: false },
          route: { text: 'Elm St', confirmed: true, inferred: false, replaced: false },
        },
      }),
      smarty: makeSmarty(),
    });
    expect(result.status).toBe(AddressVerdictStatus.UNVERIFIED_STREET_NUMBER);
    expect(result.reasons).toContain('GOOGLE_STREET_NUMBER_INFERRED');
  });

  test('does NOT flag when street_number is confirmed', () => {
    const result = engine.classify({
      google: makeGoogle({
        components: {
          street_number: { text: '123', confirmed: true, inferred: false, replaced: false },
          route: { text: 'Main St', confirmed: true, inferred: false, replaced: false },
        },
      }),
      smarty: makeSmarty(),
    });
    expect(result.status).not.toBe(AddressVerdictStatus.UNVERIFIED_STREET_NUMBER);
  });

  test('does NOT flag when no street_number component exists', () => {
    // This case is handled by MISSING_STREET_NUMBER, not UNVERIFIED
    const result = engine.classify({
      google: makeGoogle({
        components: {
          route: { text: 'Main St', confirmed: true, inferred: false, replaced: false },
        },
      }),
      smarty: makeSmarty(),
    });
    expect(result.status).not.toBe(AddressVerdictStatus.UNVERIFIED_STREET_NUMBER);
  });

  test('MISSING_STREET_NUMBER takes priority over UNVERIFIED_STREET_NUMBER', () => {
    const result = engine.classify({
      google: makeGoogle({
        missing_component_types: ['street_number'],
        components: {
          street_number: { text: '', confirmed: false, inferred: true, replaced: false },
        },
      }),
      smarty: makeSmarty(),
    });
    expect(result.status).toBe(AddressVerdictStatus.MISSING_STREET_NUMBER);
  });

  test('UNVERIFIED_STREET_NUMBER takes priority over MISSING_UNIT', () => {
    const result = engine.classify({
      google: makeGoogle({
        components: {
          street_number: { text: '4016', confirmed: false, inferred: true, replaced: false },
        },
      }),
      smarty: makeSmarty({ missing_secondary: true }),
    });
    expect(result.status).toBe(AddressVerdictStatus.UNVERIFIED_STREET_NUMBER);
  });
});

// ── Lodging / Hotel detection ───────────────────────────────

describe('Lodging (hotel/motel) detection', () => {
  test('lodging place type without residential signals → BUSINESS', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty(),
      place: makePlace({
        google_place_types: ['lodging'],
      }),
    });
    expect(result.status).toBe(AddressVerdictStatus.BUSINESS);
    expect(result.reasons).toContain('PLACE_LODGING');
  });

  test('lodging with residential corroboration → MIXED_USE (not BUSINESS)', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty(),
      place: makePlace({
        google_place_types: ['lodging', 'premise'],
      }),
    });
    // Has both lodging and residential (premise), so not purely business
    expect(result.status).not.toBe(AddressVerdictStatus.BUSINESS);
  });

  test('lodging is NOT considered residential', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ rdi_type: 'commercial' }),
      place: makePlace({
        google_place_types: ['lodging'],
        parcel_type: 'commercial',
      }),
    });
    // lodging should not provide residential cover
    expect(result.status).toBe(AddressVerdictStatus.BUSINESS);
  });
});

// ── Vacant address handling ─────────────────────────────────

describe('Vacant address handling', () => {
  test('vacant + DPV Y → OK (mail still delivered)', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ vacant_flag: true, dpv_match_code: 'Y' }),
    });
    expect(result.status).toBe(AddressVerdictStatus.OK);
    expect(result.confidence).toBeLessThan(0.9);
  });

  test('vacant + DPV D → OK (confirmed delivery point)', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ vacant_flag: true, dpv_match_code: 'D' }),
    });
    expect(result.status).toBe(AddressVerdictStatus.OK);
    expect(result.confidence).toBeLessThan(0.9);
  });

  test('vacant + DPV S → UNDELIVERABLE', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ vacant_flag: true, dpv_match_code: 'S' }),
    });
    expect(result.status).toBe(AddressVerdictStatus.UNDELIVERABLE);
  });

  test('vacant + DPV empty → UNDELIVERABLE', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ vacant_flag: true, dpv_match_code: '' }),
    });
    expect(result.status).toBe(AddressVerdictStatus.UNDELIVERABLE);
  });

  test('vacant + DPV N → UNDELIVERABLE (DPV_NO_MATCH takes precedence)', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ vacant_flag: true, dpv_match_code: 'N' }),
    });
    expect(result.status).toBe(AddressVerdictStatus.UNDELIVERABLE);
    expect(result.reasons).toContain('DPV_NO_MATCH');
  });
});

// ── hasInferredComponents confidence penalty ────────────────

describe('hasInferredComponents penalty', () => {
  test('inferred components reduce confidence', () => {
    const clean = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty(),
    });
    const inferred = engine.classify({
      google: makeGoogle({
        verdict: {
          hasUnconfirmedComponents: false,
          hasInferredComponents: true,
          hasReplacedComponents: false,
        },
      }),
      smarty: makeSmarty(),
    });
    expect(clean.confidence).toBeGreaterThan(inferred.confidence);
  });

  test('inferred + replaced components stack penalties', () => {
    const inferredOnly = engine.classify({
      google: makeGoogle({
        verdict: {
          hasUnconfirmedComponents: false,
          hasInferredComponents: true,
          hasReplacedComponents: false,
        },
      }),
      smarty: makeSmarty(),
    });
    const both = engine.classify({
      google: makeGoogle({
        verdict: {
          hasUnconfirmedComponents: false,
          hasInferredComponents: true,
          hasReplacedComponents: true,
        },
      }),
      smarty: makeSmarty(),
    });
    expect(inferredOnly.confidence).toBeGreaterThan(both.confidence);
  });
});

// ── Updated priority ordering ───────────────────────────────

describe('Updated priority ordering', () => {
  test('UNDELIVERABLE beats PO_BOX', () => {
    const result = engine.classify({
      google: makeGoogle({
        usps_data: { carrier_route_type: 'P' },
      }),
      smarty: makeSmarty({ dpv_match_code: 'N' }),
    });
    expect(result.status).toBe(AddressVerdictStatus.UNDELIVERABLE);
  });

  test('PO_BOX beats MISSING_STREET_NUMBER', () => {
    const result = engine.classify({
      google: makeGoogle({
        normalized: {
          line1: 'PO Box 123',
          city: 'Portland',
          state: 'OR',
          zip: '97201',
          lat: 45.5,
          lng: -122.6,
        },
        missing_component_types: ['street_number'],
      }),
      smarty: makeSmarty(),
    });
    expect(result.status).toBe(AddressVerdictStatus.PO_BOX);
  });

  test('UNVERIFIED_STREET_NUMBER beats MISSING_UNIT', () => {
    const result = engine.classify({
      google: makeGoogle({
        components: {
          street_number: { text: '4016', confirmed: false, inferred: true, replaced: false },
        },
      }),
      smarty: makeSmarty({ missing_secondary: true }),
    });
    expect(result.status).toBe(AddressVerdictStatus.UNVERIFIED_STREET_NUMBER);
  });

  test('UNVERIFIED_STREET_NUMBER beats BUSINESS', () => {
    const result = engine.classify({
      google: makeGoogle({
        components: {
          street_number: { text: '4016', confirmed: false, inferred: true, replaced: false },
        },
      }),
      smarty: makeSmarty({ rdi_type: 'commercial' }),
      place: makePlace({
        google_place_types: ['store'],
        parcel_type: 'commercial',
      }),
    });
    expect(result.status).toBe(AddressVerdictStatus.UNVERIFIED_STREET_NUMBER);
  });
});
