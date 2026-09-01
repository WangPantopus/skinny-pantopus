// ============================================================
// TEST: Address Validation Pipeline — Integration Tests
//
// End-to-end pipeline tests covering all 9 verdict outcomes:
//   OK, MISSING_UNIT, BUSINESS, MIXED_USE, UNDELIVERABLE,
//   MULTIPLE_MATCHES, LOW_CONFIDENCE, SERVICE_ERROR, CONFLICT
//
// Mocks Google & Smarty providers with realistic responses.
// Exercises the full validation → decision → canonical flow.
// ============================================================

const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');

// ── Mock providers ──────────────────────────────────────────
jest.mock('../../services/addressValidation/googleProvider', () => ({
  isAvailable: jest.fn(() => true),
  validate: jest.fn(),
}));

jest.mock('../../services/addressValidation/smartyProvider', () => ({
  isAvailable: jest.fn(() => true),
  verify: jest.fn(),
}));

const googleProvider = require('../../services/addressValidation/googleProvider');
const smartyProvider = require('../../services/addressValidation/smartyProvider');
const decisionEngine = require('../../services/addressValidation/addressDecisionEngine');
const canonicalService = require('../../services/addressValidation/canonicalAddressService');

// ── Test data factories ─────────────────────────────────────

function makeGoogleResult(overrides = {}) {
  return {
    normalized: {
      line1: '123 Main St',
      line2: undefined,
      city: 'Portland',
      state: 'OR',
      zip: '97201',
      plus4: '1234',
      lat: 45.5152,
      lng: -122.6784,
    },
    components: {
      street_number: '123',
      route: 'Main St',
      locality: 'Portland',
      administrative_area_level_1: 'OR',
      postal_code: '97201',
    },
    geocode: { lat: 45.5152, lng: -122.6784 },
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

function makeSmartyResult(overrides = {}) {
  return {
    from_cache: false,
    inconclusive: false,
    dpv_match_code: 'Y',
    rdi_type: 'residential',
    missing_secondary: false,
    commercial_mailbox: false,
    vacant_flag: false,
    footnotes: ['AA', 'BB'],
    raw: {
      analysis: { dpv_match_code: 'Y', dpv_footnotes: 'AABB' },
      metadata: { rdi: 'Residential' },
    },
    ...overrides,
  };
}

// ── Pipeline runner ────────────────────────────────────────

/**
 * Executes the full validation pipeline:
 * Google → Smarty → DecisionEngine → CanonicalAddressService
 * Mirrors the POST /validate route handler logic.
 */
async function runPipeline(input, { place, household, candidates } = {}) {
  let googleResult = null;
  if (googleProvider.isAvailable()) {
    try {
      googleResult = await googleProvider.validate(input);
    } catch (_) { /* mirrors route error swallowing */ }
  }

  let smartyResult = null;
  if (smartyProvider.isAvailable() && googleResult?.normalized) {
    try {
      smartyResult = await smartyProvider.verify(googleResult.normalized);
    } catch (_) { /* mirrors route error swallowing */ }
  }

  const verdict = decisionEngine.classify({
    google: googleResult,
    smarty: smartyResult,
    place,
    household,
    candidates,
  });

  let canonicalAddress = null;
  if (googleResult?.normalized) {
    const { data } = await canonicalService.findOrCreate(
      googleResult.normalized,
      { google: googleResult, smarty: smartyResult },
    );
    canonicalAddress = data;
  }

  return { verdict, address_id: canonicalAddress?.id || null };
}

// ── Setup ──────────────────────────────────────────────────

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  googleProvider.isAvailable.mockReturnValue(true);
  googleProvider.validate.mockResolvedValue(makeGoogleResult());
  smartyProvider.isAvailable.mockReturnValue(true);
  smartyProvider.verify.mockResolvedValue(makeSmartyResult());
});

const validInput = { line1: '123 Main St', city: 'Portland', state: 'OR', zip: '97201' };

// ============================================================
// 1. OK — valid residential address
// ============================================================

describe('OK — valid residential address', () => {
  test('returns OK verdict with high confidence', async () => {
    const result = await runPipeline(validInput);

    expect(result.verdict.status).toBe('OK');
    expect(result.verdict.confidence).toBeGreaterThanOrEqual(0.8);
  });

  test('creates canonical HomeAddress record', async () => {
    const result = await runPipeline(validInput);

    expect(result.address_id).toBeTruthy();
    const addresses = getTable('HomeAddress');
    expect(addresses).toHaveLength(1);
    expect(addresses[0].address_line1_norm).toBe('123 Main St');
    expect(addresses[0].city_norm).toBe('Portland');
    expect(addresses[0].state).toBe('OR');
  });

  test('persists geocode coordinates', async () => {
    await runPipeline(validInput);

    const addresses = getTable('HomeAddress');
    expect(addresses[0].geocode_lat).toBe(45.5152);
    expect(addresses[0].geocode_lng).toBe(-122.6784);
  });

  test('verdict includes residential deliverability signals', async () => {
    const result = await runPipeline(validInput);

    expect(result.verdict.deliverability).toBeDefined();
    expect(result.verdict.deliverability.dpv_match_code).toBe('Y');
    expect(result.verdict.deliverability.rdi_type).toBe('residential');
  });

  test('suggests send_mail_code as next action', async () => {
    const result = await runPipeline(validInput);

    expect(result.verdict.next_actions).toContain('send_mail_code');
  });

  test('calls providers in sequence: Google → Smarty', async () => {
    await runPipeline(validInput);

    expect(googleProvider.validate).toHaveBeenCalledTimes(1);
    expect(smartyProvider.verify).toHaveBeenCalledTimes(1);
    expect(smartyProvider.verify).toHaveBeenCalledWith(
      expect.objectContaining({ line1: '123 Main St', city: 'Portland' }),
    );
  });
});

// ============================================================
// 2. MISSING_UNIT — multi-unit building needs secondary
// ============================================================

describe('MISSING_UNIT — multi-unit needs secondary', () => {
  beforeEach(() => {
    smartyProvider.verify.mockResolvedValue(makeSmartyResult({
      dpv_match_code: 'S',
      missing_secondary: true,
    }));
  });

  test('returns MISSING_UNIT verdict', async () => {
    const result = await runPipeline(validInput);

    expect(result.verdict.status).toBe('MISSING_UNIT');
  });

  test('confidence is low (< 0.5)', async () => {
    const result = await runPipeline(validInput);

    expect(result.verdict.confidence).toBeLessThan(0.5);
  });

  test('suggests prompt_unit as next action', async () => {
    const result = await runPipeline(validInput);

    expect(result.verdict.next_actions).toContain('prompt_unit');
  });

  test('still persists canonical address for re-validation', async () => {
    const result = await runPipeline(validInput);

    expect(result.address_id).toBeTruthy();
    expect(getTable('HomeAddress')).toHaveLength(1);
  });

  test('reasons include MISSING_SECONDARY', async () => {
    const result = await runPipeline(validInput);

    expect(result.verdict.reasons).toContain('MISSING_SECONDARY');
  });

  test('Google subpremise missing adds additional reason', async () => {
    googleProvider.validate.mockResolvedValue(makeGoogleResult({
      missing_component_types: ['subpremise'],
    }));

    const result = await runPipeline(validInput);

    expect(result.verdict.reasons).toContain('GOOGLE_SUBPREMISE_MISSING');
  });
});

// ============================================================
// 3. BUSINESS — commercial address detected
// ============================================================

describe('BUSINESS — commercial address', () => {
  beforeEach(() => {
    smartyProvider.verify.mockResolvedValue(makeSmartyResult({
      rdi_type: 'commercial',
      commercial_mailbox: true,
    }));
  });

  test('returns BUSINESS verdict with commercial RDI + CMRA', async () => {
    const place = {
      google_place_types: ['store', 'establishment'],
      parcel_type: 'commercial',
      building_type: 'commercial',
    };

    const result = await runPipeline(validInput, { place });

    expect(result.verdict.status).toBe('BUSINESS');
  });

  test('reasons include RDI_COMMERCIAL and CMRA_MAILBOX', async () => {
    const place = {
      google_place_types: ['store'],
      parcel_type: 'commercial',
      building_type: 'commercial',
    };

    const result = await runPipeline(validInput, { place });

    expect(result.verdict.reasons).toContain('RDI_COMMERCIAL');
    expect(result.verdict.reasons).toContain('CMRA_MAILBOX');
  });

  test('suggests manual_review for business address', async () => {
    const place = {
      google_place_types: ['store'],
      parcel_type: 'commercial',
      building_type: 'commercial',
    };

    const result = await runPipeline(validInput, { place });

    expect(result.verdict.next_actions).toContain('manual_review');
  });

  test('still creates address record for business address', async () => {
    const place = {
      google_place_types: ['store'],
      parcel_type: 'commercial',
      building_type: 'commercial',
    };

    const result = await runPipeline(validInput, { place });
    expect(result.address_id).toBeTruthy();
  });

  test('returns BUSINESS when Smarty marks the address commercial even without extra place hints', async () => {
    smartyProvider.verify.mockResolvedValue(makeSmartyResult({
      dpv_match_code: 'Y',
      rdi_type: 'commercial',
      commercial_mailbox: false,
    }));

    const result = await runPipeline(validInput);

    expect(result.verdict.status).toBe('BUSINESS');
    expect(result.verdict.reasons).toContain('RDI_COMMERCIAL');
  });
});

// ============================================================
// 4. MIXED_USE — residential + commercial signals
// ============================================================

describe('MIXED_USE — mixed residential/commercial', () => {
  test('returns MIXED_USE when parcel is mixed', async () => {
    const place = {
      google_place_types: ['premise'],
      parcel_type: 'mixed',
      building_type: 'mixed_use',
    };

    const result = await runPipeline(validInput, { place });

    expect(result.verdict.status).toBe('MIXED_USE');
  });

  test('returns MIXED_USE when RDI unknown with both residential and commercial signals', async () => {
    smartyProvider.verify.mockResolvedValue(makeSmartyResult({
      rdi_type: 'unknown',
    }));

    const place = {
      google_place_types: ['premise', 'store'],
      parcel_type: 'unknown',
      building_type: 'mixed_use',
    };

    const result = await runPipeline(validInput, { place });

    expect(result.verdict.status).toBe('MIXED_USE');
  });

  test('suggests both manual_review and send_mail_code', async () => {
    const place = {
      google_place_types: ['premise'],
      parcel_type: 'mixed',
      building_type: 'mixed_use',
    };

    const result = await runPipeline(validInput, { place });

    expect(result.verdict.next_actions).toContain('manual_review');
    expect(result.verdict.next_actions).toContain('send_mail_code');
  });
});

// ============================================================
// 5. UNDELIVERABLE — DPV says no match
// ============================================================

describe('UNDELIVERABLE — non-deliverable address', () => {
  test('returns UNDELIVERABLE when DPV is N', async () => {
    smartyProvider.verify.mockResolvedValue(makeSmartyResult({
      dpv_match_code: 'N',
    }));

    const result = await runPipeline(validInput);

    expect(result.verdict.status).toBe('UNDELIVERABLE');
    expect(result.verdict.confidence).toBeLessThanOrEqual(0.1);
  });

  test('reasons include DPV_NO_MATCH', async () => {
    smartyProvider.verify.mockResolvedValue(makeSmartyResult({
      dpv_match_code: 'N',
    }));

    const result = await runPipeline(validInput);

    expect(result.verdict.reasons).toContain('DPV_NO_MATCH');
  });

  test('flags vacant address in reasons', async () => {
    smartyProvider.verify.mockResolvedValue(makeSmartyResult({
      dpv_match_code: 'N',
      vacant_flag: true,
    }));

    const result = await runPipeline(validInput);

    expect(result.verdict.reasons).toContain('USPS_VACANT');
  });

  test('still persists address for audit trail', async () => {
    smartyProvider.verify.mockResolvedValue(makeSmartyResult({
      dpv_match_code: 'N',
    }));

    const result = await runPipeline(validInput);

    expect(result.address_id).toBeTruthy();
  });
});

// ============================================================
// 6. MULTIPLE_MATCHES — ambiguous input yields multiple candidates
// ============================================================

describe('MULTIPLE_MATCHES — multiple address candidates', () => {
  test('returns MULTIPLE_MATCHES when >1 candidates provided', async () => {
    const candidates = [
      { address: { line1: '123 Main St', city: 'Portland', state: 'OR', zip: '97201' } },
      { address: { line1: '123 Main St', city: 'Portland', state: 'OR', zip: '97202' } },
    ];

    const result = await runPipeline(validInput, { candidates });

    expect(result.verdict.status).toBe('MULTIPLE_MATCHES');
  });

  test('includes all candidates in verdict', async () => {
    const candidates = [
      { address: { line1: '123 Main St', city: 'Portland', state: 'OR', zip: '97201' } },
      { address: { line1: '123 Main St', city: 'Portland', state: 'OR', zip: '97202' } },
      { address: { line1: '123 Main St', city: 'Portland', state: 'OR', zip: '97203' } },
    ];

    const result = await runPipeline(validInput, { candidates });

    expect(result.verdict.candidates).toHaveLength(3);
  });

  test('suggests select_candidate as next action', async () => {
    const candidates = [
      { address: { line1: '123 Main St', city: 'Portland', state: 'OR', zip: '97201' } },
      { address: { line1: '123 Main St', city: 'Portland', state: 'OR', zip: '97202' } },
    ];

    const result = await runPipeline(validInput, { candidates });

    expect(result.verdict.next_actions).toContain('select_candidate');
  });
});

// ============================================================
// 7. LOW_CONFIDENCE — poor geocode granularity
// ============================================================

describe('LOW_CONFIDENCE — poor geocode granularity', () => {
  test('returns LOW_CONFIDENCE when Google granularity is ROUTE', async () => {
    googleProvider.validate.mockResolvedValue(makeGoogleResult({
      granularity: 'ROUTE',
    }));

    const result = await runPipeline(validInput);

    expect(result.verdict.status).toBe('LOW_CONFIDENCE');
  });

  test('returns LOW_CONFIDENCE when granularity is APPROXIMATE', async () => {
    googleProvider.validate.mockResolvedValue(makeGoogleResult({
      granularity: 'APPROXIMATE',
    }));

    const result = await runPipeline(validInput);

    expect(result.verdict.status).toBe('LOW_CONFIDENCE');
  });

  test('returns LOW_CONFIDENCE when granularity is GEOMETRIC_CENTER', async () => {
    googleProvider.validate.mockResolvedValue(makeGoogleResult({
      granularity: 'GEOMETRIC_CENTER',
    }));

    const result = await runPipeline(validInput);

    expect(result.verdict.status).toBe('LOW_CONFIDENCE');
  });

  test('confidence is low (≤ 0.3)', async () => {
    googleProvider.validate.mockResolvedValue(makeGoogleResult({
      granularity: 'ROUTE',
    }));

    const result = await runPipeline(validInput);

    expect(result.verdict.confidence).toBeLessThanOrEqual(0.3);
  });

  test('reasons include geocode granularity', async () => {
    googleProvider.validate.mockResolvedValue(makeGoogleResult({
      granularity: 'ROUTE',
    }));

    const result = await runPipeline(validInput);

    expect(result.verdict.reasons).toContain('GEOCODE_GRANULARITY_ROUTE');
  });
});

// ============================================================
// 8. SERVICE_ERROR — provider failure
// ============================================================

describe('SERVICE_ERROR — provider failures', () => {
  test('returns SERVICE_ERROR when Google is unavailable', async () => {
    googleProvider.isAvailable.mockReturnValue(false);

    const result = await runPipeline(validInput);

    expect(result.verdict.status).toBe('SERVICE_ERROR');
    expect(result.verdict.confidence).toBe(0);
    expect(result.address_id).toBeNull();
  });

  test('returns SERVICE_ERROR when Google throws error', async () => {
    googleProvider.validate.mockRejectedValue(new Error('API timeout'));

    const result = await runPipeline(validInput);

    expect(result.verdict.status).toBe('SERVICE_ERROR');
  });

  test('returns SERVICE_ERROR when Smarty throws error', async () => {
    smartyProvider.verify.mockRejectedValue(new Error('Rate limited'));

    const result = await runPipeline(validInput);

    expect(result.verdict.status).toBe('SERVICE_ERROR');
  });

  test('returns SERVICE_ERROR when Smarty is inconclusive', async () => {
    smartyProvider.verify.mockResolvedValue(makeSmartyResult({
      inconclusive: true,
    }));

    const result = await runPipeline(validInput);

    expect(result.verdict.status).toBe('SERVICE_ERROR');
  });

  test('does not persist address when Google is unavailable', async () => {
    googleProvider.isAvailable.mockReturnValue(false);

    await runPipeline(validInput);

    expect(getTable('HomeAddress')).toHaveLength(0);
  });

  test('suggests manual_review for service errors', async () => {
    googleProvider.isAvailable.mockReturnValue(false);

    const result = await runPipeline(validInput);

    expect(result.verdict.next_actions).toContain('manual_review');
  });
});

// ============================================================
// 9. CONFLICT — existing household at address
// ============================================================

describe('CONFLICT — existing household at canonical address', () => {
  test('returns CONFLICT when existing household passed', async () => {
    const household = {
      home_id: 'home-existing',
      name: 'The Smiths',
      occupant_count: 3,
    };

    const result = await runPipeline(validInput, { household });

    expect(result.verdict.status).toBe('CONFLICT');
  });

  test('includes existing_household in verdict', async () => {
    const household = {
      home_id: 'home-existing',
      name: 'The Smiths',
      occupant_count: 3,
    };

    const result = await runPipeline(validInput, { household });

    expect(result.verdict.existing_household).toBeDefined();
    expect(result.verdict.existing_household.home_id).toBe('home-existing');
  });

  test('suggests join_existing and dispute as next actions', async () => {
    const household = {
      home_id: 'home-existing',
      name: 'The Smiths',
      occupant_count: 3,
    };

    const result = await runPipeline(validInput, { household });

    expect(result.verdict.next_actions).toContain('join_existing');
    expect(result.verdict.next_actions).toContain('dispute');
  });

  test('still creates address record despite conflict', async () => {
    const household = { home_id: 'home-existing' };
    const result = await runPipeline(validInput, { household });

    expect(result.address_id).toBeTruthy();
  });
});

// ============================================================
// Priority ordering — higher-priority verdicts override lower
// ============================================================

describe('verdict priority ordering', () => {
  test('UNDELIVERABLE takes priority over MISSING_UNIT', async () => {
    smartyProvider.verify.mockResolvedValue(makeSmartyResult({
      dpv_match_code: 'N',
      missing_secondary: true,
    }));

    const result = await runPipeline(validInput);

    expect(result.verdict.status).toBe('UNDELIVERABLE');
  });

  test('MISSING_UNIT takes priority over BUSINESS', async () => {
    smartyProvider.verify.mockResolvedValue(makeSmartyResult({
      dpv_match_code: 'S',
      missing_secondary: true,
      rdi_type: 'commercial',
      commercial_mailbox: true,
    }));

    const result = await runPipeline(validInput);

    expect(result.verdict.status).toBe('MISSING_UNIT');
  });

  test('SERVICE_ERROR takes priority over all other verdicts', async () => {
    googleProvider.isAvailable.mockReturnValue(false);

    const result = await runPipeline(validInput, {
      household: { home_id: 'h1' },
      candidates: [{ address: {} }, { address: {} }],
    });

    expect(result.verdict.status).toBe('SERVICE_ERROR');
  });
});

// ============================================================
// Dedup — same address re-validated updates existing record
// ============================================================

describe('dedup — re-validation updates existing canonical address', () => {
  test('second validation with same address reuses canonical record', async () => {
    await runPipeline(validInput);
    expect(getTable('HomeAddress')).toHaveLength(1);

    // Validate same address again
    await runPipeline(validInput);
    expect(getTable('HomeAddress')).toHaveLength(1);
  });

  test('updates last_validated_at on re-validation', async () => {
    await runPipeline(validInput);
    const firstTimestamp = getTable('HomeAddress')[0].last_validated_at;

    // Slight delay then re-validate
    await runPipeline(validInput);
    const secondTimestamp = getTable('HomeAddress')[0].last_validated_at;

    expect(new Date(secondTimestamp).getTime()).toBeGreaterThanOrEqual(
      new Date(firstTimestamp).getTime(),
    );
  });
});
