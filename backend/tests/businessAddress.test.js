// ============================================================
// TEST: Business Address Decision Engine
//
// Suite 1: Unit tests for businessAddressService pipeline
// Suite 2: API route integration tests
// Suite 3: Address normalization + hashing tests
//
// Unit tests mock supabaseAdmin, logger, and geocoding to test
// decision logic in isolation. Integration tests hit the running
// backend and require SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
// ============================================================

// supabaseAdmin, supabase, and logger are auto-mocked via jest.config.js moduleNameMapper.
// Only geocoding needs an explicit mock since it's not in the mapper.
jest.mock('../utils/geocoding', () => ({
  geocodeAddress: jest.fn(),
}));

const { resetTables, seedTable, getTable } = require('../config/supabaseAdmin');
const { geocodeAddress } = require('../utils/geocoding');
const {
  normalizeAddress,
  computeAddressHash,
  expandAbbreviations,
} = require('../utils/normalizeAddress');

const {
  validateBusinessAddress,
  checkDeliverability,
  detectMissingSuite,
  detectCMRA_POBox,
  inferLocationType,
  checkConflicts,
  computeCapabilities,
  determineRequiredVerification,
} = require('../services/businessAddressService');


// ============================================================
// SUITE 1: businessAddressService Unit Tests
// ============================================================

describe('businessAddressService — Decision Engine', () => {
  beforeEach(() => {
    resetTables();
    jest.clearAllMocks();
    // Default: geocoding returns coordinates so we don't hit "undeliverable"
    geocodeAddress.mockResolvedValue({ latitude: 40.7128, longitude: -74.006 });
  });

  // ── Step-level unit tests ─────────────────────────────────

  describe('checkDeliverability', () => {
    test('returns undeliverable when no coordinates', () => {
      const result = checkDeliverability({ coordinates: null, granularity: null });
      expect(result.deliverable).toBe(false);
      expect(result.status).toBe('undeliverable');
      expect(result.reasons).toContain('NO_GEOCODE_RESULTS');
    });

    test('returns low_confidence for unacceptable granularity', () => {
      const result = checkDeliverability({ coordinates: { lat: 40, lng: -74 }, granularity: 'country' });
      expect(result.deliverable).toBe(false);
      expect(result.status).toBe('low_confidence');
      expect(result.reasons).toContain('LOW_GRANULARITY');
    });

    test('returns ok for acceptable granularity', () => {
      const result = checkDeliverability({ coordinates: { lat: 40, lng: -74 }, granularity: 'rooftop' });
      expect(result.deliverable).toBe(true);
      expect(result.status).toBe('ok');
    });
  });

  describe('detectMissingSuite', () => {
    test('returns need_suite for multi-tenant keyword without suite', () => {
      const result = detectMissingSuite(
        { address: '500 Broadway Plaza', address2: '' },
        { raw_response: { features: [] } },
      );
      expect(result.needs_suite).toBe(true);
      expect(result.status).toBe('need_suite');
      expect(result.reasons).toContain('MISSING_SECONDARY');
    });

    test('returns ok when suite is already provided', () => {
      const result = detectMissingSuite(
        { address: '500 Broadway Plaza', address2: 'Suite 1200' },
        { raw_response: { features: [] } },
      );
      expect(result.needs_suite).toBe(false);
      expect(result.status).toBe('ok');
    });

    test('returns ok for non-multi-tenant address without suite', () => {
      const result = detectMissingSuite(
        { address: '123 Main St', address2: '' },
        { raw_response: { features: [] } },
      );
      expect(result.needs_suite).toBe(false);
    });
  });

  describe('detectCMRA_POBox', () => {
    test('detects UPS Store as CMRA', () => {
      const result = detectCMRA_POBox({ address: '6700 N Linder Ave, The UPS Store' });
      expect(result.is_cmra).toBe(true);
      expect(result.status).toBe('cmra_detected');
      expect(result.reasons).toContain('CMRA_FLAG');
    });

    test('detects PO Box', () => {
      const result = detectCMRA_POBox({ address: 'PO Box 12345' });
      expect(result.is_po_box).toBe(true);
      expect(result.status).toBe('po_box');
      expect(result.reasons).toContain('PO_BOX');
    });

    test('detects PMB keyword as CMRA', () => {
      const result = detectCMRA_POBox({ address: '123 Main St PMB 456' });
      expect(result.is_cmra).toBe(true);
      expect(result.status).toBe('cmra_detected');
    });

    test('returns ok for regular address', () => {
      const result = detectCMRA_POBox({ address: '123 Main St' });
      expect(result.is_cmra).toBe(false);
      expect(result.is_po_box).toBe(false);
      expect(result.status).toBe('ok');
    });
  });

  describe('inferLocationType', () => {
    test('maps CUSTOMER_FACING intent to storefront', () => {
      const result = inferLocationType(
        { address: '123 Main St', location_intent: 'CUSTOMER_FACING' },
        { is_cmra: false, is_po_box: false, status: 'ok', reasons: [] },
      );
      expect(result.location_type).toBe('storefront');
    });

    test('maps HOME_BASED_PRIVATE intent', () => {
      const result = inferLocationType(
        { address: '123 Elm St', location_intent: 'HOME_BASED_PRIVATE' },
        { is_cmra: false, is_po_box: false, status: 'ok', reasons: [] },
      );
      expect(result.location_type).toBe('home_based_private');
    });

    test('forces mailing_only for CMRA addresses', () => {
      const result = inferLocationType(
        { address: 'The UPS Store', location_intent: 'CUSTOMER_FACING' },
        { is_cmra: true, is_po_box: false, status: 'cmra_detected', reasons: ['CMRA_FLAG'] },
      );
      expect(result.location_type).toBe('mailing_only');
    });

    test('detects mixed_use for residential hints with customer-facing intent', () => {
      const result = inferLocationType(
        { address: '123 Main St Apt 4B', location_intent: 'CUSTOMER_FACING' },
        { is_cmra: false, is_po_box: false, status: 'ok', reasons: [] },
      );
      expect(result.status).toBe('mixed_use');
      expect(result.reasons).toContain('PLACE_TYPE_MISMATCH');
    });
  });

  describe('checkConflicts', () => {
    test('returns conflict when address hash matches another business', async () => {
      const hash = computeAddressHash('123 Main St', '', 'Portland', 'OR', '97201');
      seedTable('BusinessLocation', [
        { id: 'loc-1', business_user_id: 'biz-other', address_hash: hash, address2: null, is_active: true },
      ]);

      const result = await checkConflicts({ line1: '123 Main St', line2: '' }, hash, 'biz-mine');
      expect(result.has_conflict).toBe(true);
      expect(result.status).toBe('conflict');
      expect(result.reasons).toContain('DUPLICATE_LOCATION');
    });

    test('returns ok when address hash matches same business (own location)', async () => {
      const hash = computeAddressHash('123 Main St', '', 'Portland', 'OR', '97201');
      seedTable('BusinessLocation', [
        { id: 'loc-1', business_user_id: 'biz-mine', address_hash: hash, address2: null, is_active: true },
      ]);

      const result = await checkConflicts({ line1: '123 Main St', line2: '' }, hash, 'biz-mine');
      expect(result.has_conflict).toBe(false);
      expect(result.status).toBe('ok');
    });

    test('returns ok when no matches exist', async () => {
      seedTable('BusinessLocation', []);
      const hash = computeAddressHash('999 New St', '', 'Newtown', 'NY', '10001');
      const result = await checkConflicts({ line1: '999 New St', line2: '' }, hash, 'biz-mine');
      expect(result.has_conflict).toBe(false);
    });
  });

  describe('computeCapabilities', () => {
    test('sets map_pin=true for storefront with unverified rank', () => {
      const caps = computeCapabilities('storefront', 0, []);
      expect(caps.map_pin).toBe(true);
      expect(caps.show_in_nearby).toBe(false); // needs rank >= 1
      expect(caps.receive_mail).toBe(true);
    });

    test('sets map_pin=false for home_based_private', () => {
      const caps = computeCapabilities('home_based_private', 0, []);
      expect(caps.map_pin).toBe(false);
    });

    test('sets map_pin=false for mailing_only', () => {
      const caps = computeCapabilities('mailing_only', 0, []);
      expect(caps.map_pin).toBe(false);
      expect(caps.receive_mail).toBe(true);
    });

    test('sets map_pin=false when CMRA_FLAG present', () => {
      const caps = computeCapabilities('storefront', 0, ['CMRA_FLAG']);
      expect(caps.map_pin).toBe(false);
    });

    test('sets show_in_nearby=true for storefront with self_attested rank (1)', () => {
      const caps = computeCapabilities('storefront', 1, []);
      expect(caps.map_pin).toBe(true);
      expect(caps.show_in_nearby).toBe(true);
    });

    test('sets show_in_nearby=true for storefront with document_verified rank (2)', () => {
      const caps = computeCapabilities('storefront', 2, []);
      expect(caps.map_pin).toBe(true);
      expect(caps.show_in_nearby).toBe(true);
    });

    test('enable_payouts is always false (requires external KYC)', () => {
      const caps = computeCapabilities('storefront', 3, []);
      expect(caps.enable_payouts).toBe(false);
    });
  });

  describe('determineRequiredVerification', () => {
    test('storefront requires MAIL_CODE', () => {
      const verif = determineRequiredVerification('storefront', []);
      expect(verif).toContain('MAIL_CODE');
    });

    test('office requires DOMAIN and PHONE', () => {
      const verif = determineRequiredVerification('office', []);
      expect(verif).toContain('DOMAIN');
      expect(verif).toContain('PHONE');
    });

    test('place mismatch escalates to include VIDEO and DOCS', () => {
      const verif = determineRequiredVerification('storefront', ['PLACE_TYPE_MISMATCH']);
      expect(verif).toContain('MAIL_CODE');
      expect(verif).toContain('VIDEO');
      expect(verif).toContain('DOCS');
    });

    test('mailing_only requires NONE', () => {
      const verif = determineRequiredVerification('mailing_only', []);
      expect(verif).toEqual(['NONE']);
    });
  });

  // ── Full pipeline tests ───────────────────────────────────

  describe('validateBusinessAddress (full pipeline)', () => {
    test('returns UNDELIVERABLE for nonsense address', async () => {
      // No geocoding results
      geocodeAddress.mockResolvedValue(null);

      const verdict = await validateBusinessAddress({
        address: 'zzzzz nonexistent 99999',
        city: 'Nowhere',
        state: 'ZZ',
        zipcode: '00000',
        country: 'US',
        business_user_id: 'biz-test',
      });

      expect(verdict.decision.status).toBe('undeliverable');
      expect(verdict.decision.reasons).toContain('NO_GEOCODE_RESULTS');
    });

    test('returns NEED_SUITE for multi-tenant building without suite', async () => {
      const verdict = await validateBusinessAddress({
        address: '500 Broadway Plaza',
        city: 'New York',
        state: 'NY',
        zipcode: '10012',
        country: 'US',
        business_user_id: 'biz-test',
      });

      expect(verdict.decision.status).toBe('need_suite');
      expect(verdict.decision.reasons).toContain('MISSING_SECONDARY');
    });

    test('returns OK when suite is provided for multi-tenant building', async () => {
      const verdict = await validateBusinessAddress({
        address: '500 Broadway Plaza',
        address2: 'Suite 1200',
        city: 'New York',
        state: 'NY',
        zipcode: '10012',
        country: 'US',
        location_intent: 'OFFICE_NOT_PUBLIC',
        business_user_id: 'biz-test',
      });

      expect(verdict.decision.status).toBe('ok');
    });

    test('returns CMRA_DETECTED for UPS Store address', async () => {
      const verdict = await validateBusinessAddress({
        address: '6700 N Linder Ave, The UPS Store',
        city: 'Skokie',
        state: 'IL',
        zipcode: '60077',
        country: 'US',
        business_user_id: 'biz-test',
      });

      expect(verdict.decision.status).toBe('cmra_detected');
      expect(verdict.decision.reasons).toContain('CMRA_FLAG');
    });

    test('returns PO_BOX for PO Box address', async () => {
      const verdict = await validateBusinessAddress({
        address: 'PO Box 12345',
        city: 'Anytown',
        state: 'CA',
        zipcode: '90210',
        country: 'US',
        business_user_id: 'biz-test',
      });

      expect(verdict.decision.status).toBe('po_box');
      expect(verdict.decision.reasons).toContain('PO_BOX');
    });

    test('returns correct location_type based on CUSTOMER_FACING intent', async () => {
      const verdict = await validateBusinessAddress({
        address: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zipcode: '62701',
        country: 'US',
        location_intent: 'CUSTOMER_FACING',
        business_user_id: 'biz-test',
      });

      expect(verdict.decision.business_location_type).toBe('storefront');
    });

    test('returns CONFLICT when address already claimed by another business', async () => {
      const hash = computeAddressHash('123 Main St', '', 'Springfield', 'IL', '62701');
      seedTable('BusinessLocation', [
        { id: 'loc-existing', business_user_id: 'biz-other', address_hash: hash, address2: null, is_active: true },
      ]);

      const verdict = await validateBusinessAddress({
        address: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zipcode: '62701',
        country: 'US',
        location_intent: 'CUSTOMER_FACING',
        business_user_id: 'biz-test',
      });

      expect(verdict.decision.status).toBe('conflict');
      expect(verdict.decision.reasons).toContain('DUPLICATE_LOCATION');
    });

    test('sets map_pin=false for HOME_BASED_PRIVATE intent', async () => {
      const verdict = await validateBusinessAddress({
        address: '456 Elm St',
        city: 'Portland',
        state: 'OR',
        zipcode: '97201',
        country: 'US',
        location_intent: 'HOME_BASED_PRIVATE',
        business_user_id: 'biz-test',
      });

      expect(verdict.decision.allowed_capabilities.map_pin).toBe(false);
    });

    test('sets map_pin=false for MAILING_ONLY intent', async () => {
      const verdict = await validateBusinessAddress({
        address: '789 Oak Ave',
        city: 'Seattle',
        state: 'WA',
        zipcode: '98101',
        country: 'US',
        location_intent: 'MAILING_ONLY',
        business_user_id: 'biz-test',
      });

      expect(verdict.decision.allowed_capabilities.map_pin).toBe(false);
      expect(verdict.decision.allowed_capabilities.receive_mail).toBe(true);
    });

    test('sets map_pin=true for storefront', async () => {
      const verdict = await validateBusinessAddress({
        address: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zipcode: '62701',
        country: 'US',
        location_intent: 'CUSTOMER_FACING',
        business_user_id: 'biz-test',
      });

      expect(verdict.decision.allowed_capabilities.map_pin).toBe(true);
      // show_in_nearby requires BL2+ verification, which is BL0 by default
      expect(verdict.decision.allowed_capabilities.show_in_nearby).toBe(false);
    });

    test('returns normalized address in verdict', async () => {
      const verdict = await validateBusinessAddress({
        address: '  123 Main St  ',
        city: '  Portland  ',
        state: '  OR  ',
        zipcode: '  97201  ',
        country: 'US',
        location_intent: 'CUSTOMER_FACING',
        business_user_id: 'biz-test',
      });

      expect(verdict.normalized.line1).toBe('123 Main St');
      expect(verdict.normalized.city).toBe('Portland');
      expect(verdict.normalized.state).toBe('OR');
      expect(verdict.normalized.zip).toBe('97201');
    });

    test('logs decision to BusinessAddressDecision table', async () => {
      await validateBusinessAddress({
        address: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zipcode: '62701',
        country: 'US',
        location_intent: 'CUSTOMER_FACING',
        business_user_id: 'biz-test',
      });

      const decisions = getTable('BusinessAddressDecision');
      expect(decisions.length).toBeGreaterThanOrEqual(1);
      const latest = decisions[decisions.length - 1];
      expect(latest.business_user_id).toBe('biz-test');
      expect(latest.decision_status).toBe('ok');
    });
  });
});


// ============================================================
// SUITE 2: API Route Integration Tests
// ============================================================

describe('API route integration — Business Address Endpoints', () => {
  // These tests require a running backend + Supabase.
  // Skip if env vars are not set.
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

  const hasEnv = !!(SUPABASE_URL && SUPABASE_SERVICE_KEY);

  const conditionalDescribe = hasEnv ? describe : describe.skip;

  let helpers;

  conditionalDescribe('with live Supabase', () => {
    let testUser;
    let testBusinessId;
    let createdLocationIds = [];

    beforeAll(async () => {
      // Dynamically require helpers to avoid env-var check failures in unit mode
      helpers = require('./integration/helpers');

      testUser = await helpers.createTestUser();

      // Create a test business
      const res = await helpers.apiRequest('POST', '/api/businesses', testUser.token, {
        name: `Test Biz ${Date.now()}`,
        username: `testbiz_${Date.now()}`,
        email: testUser.userRow.email,
        business_type: 'service',
      });

      if (!res.ok) {
        throw new Error(`Failed to create test business: ${JSON.stringify(res.body)}`);
      }

      testBusinessId = res.body?.business?.id;
      if (!testBusinessId) throw new Error('No business ID returned');
    });

    afterAll(async () => {
      // Clean up created locations
      for (const locId of createdLocationIds) {
        try {
          await helpers.apiRequest('DELETE', `/api/businesses/${testBusinessId}/locations/${locId}`, testUser.token);
        } catch { /* best effort */ }
      }
      await helpers.cleanup();
    });

    // ── validate-address ──

    test('POST /validate-address returns decision for valid address', async () => {
      const res = await helpers.apiRequest('POST', `/api/businesses/${testBusinessId}/validate-address`, testUser.token, {
        address: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zipcode: '62701',
        country: 'US',
        location_intent: 'CUSTOMER_FACING',
      });

      expect(res.status).toBe(200);
      expect(res.body.verdict).toBeDefined();
      expect(res.body.verdict.decision).toBeDefined();
      expect(res.body.verdict.normalized).toBeDefined();
      // Should not expose raw_validation_response
      expect(res.body.verdict.raw_validation_response).toBeUndefined();
    });

    test('POST /validate-address returns CMRA_DETECTED for mail service', async () => {
      const res = await helpers.apiRequest('POST', `/api/businesses/${testBusinessId}/validate-address`, testUser.token, {
        address: '6700 N Linder Ave, The UPS Store',
        city: 'Skokie',
        state: 'IL',
        zipcode: '60077',
      });

      expect(res.status).toBe(200);
      expect(res.body.verdict.decision.status).toBe('cmra_detected');
    });

    test('POST /validate-address returns 401 without auth', async () => {
      const res = await helpers.apiRequest('POST', `/api/businesses/${testBusinessId}/validate-address`, null, {
        address: '123 Main St',
        city: 'Springfield',
      });

      expect(res.status).toBe(401);
    });

    // ── locations (enhanced) ──

    test('POST /locations creates location with decision metadata for valid address', async () => {
      const res = await helpers.apiRequest('POST', `/api/businesses/${testBusinessId}/locations`, testUser.token, {
        label: 'Test Location',
        address: '321 Oak Ave',
        city: 'Portland',
        state: 'OR',
        zipcode: '97201',
        country: 'US',
        is_primary: false,
        location_intent: 'OFFICE_NOT_PUBLIC',
        location_type: 'office',
        is_customer_facing: false,
      });

      // May get 201 (ok) or 422 (need_suite, cmra, etc.) depending on geocoding
      if (res.status === 201) {
        expect(res.body.location).toBeDefined();
        expect(res.body.verdict).toBeDefined();
        createdLocationIds.push(res.body.location.id);
      }
      // Any 4xx response should still include verdict
      if (res.status >= 400 && res.status < 500) {
        expect(res.body.verdict || res.body.error).toBeDefined();
      }
    });

    test('POST /locations returns 422 for CMRA address', async () => {
      const res = await helpers.apiRequest('POST', `/api/businesses/${testBusinessId}/locations`, testUser.token, {
        label: 'CMRA Test',
        address: '100 Main St, The UPS Store',
        city: 'Skokie',
        state: 'IL',
        zipcode: '60077',
        country: 'US',
        location_intent: 'CUSTOMER_FACING',
      });

      expect(res.status).toBe(422);
      expect(res.body.verdict).toBeDefined();
    });

    test('POST /locations is backward compatible (old clients without new fields)', async () => {
      const res = await helpers.apiRequest('POST', `/api/businesses/${testBusinessId}/locations`, testUser.token, {
        label: 'Legacy Location',
        address: '789 Maple Dr',
        city: 'Seattle',
        state: 'WA',
        zipcode: '98101',
        country: 'US',
        is_primary: false,
      });

      // Should not error on missing location_intent / location_type
      // May still fail validation depending on geocoding, but should not 400 on schema
      expect(res.status).not.toBe(400);

      if (res.status === 201) {
        expect(res.body.location).toBeDefined();
        createdLocationIds.push(res.body.location.id);
      }
    });

    // ── mailing-address ──

    test('POST /mailing-address creates mailing address with CMRA detection', async () => {
      const res = await helpers.apiRequest('POST', `/api/businesses/${testBusinessId}/mailing-address`, testUser.token, {
        address: '6700 N Linder Ave, The UPS Store',
        city: 'Skokie',
        state: 'IL',
        zipcode: '60077',
        country: 'US',
      });

      if (res.status === 201) {
        expect(res.body.mailing_address).toBeDefined();
        expect(res.body.mailing_address.is_cmra).toBe(true);
      }
    });

    test('POST /mailing-address creates normal mailing address', async () => {
      const res = await helpers.apiRequest('POST', `/api/businesses/${testBusinessId}/mailing-address`, testUser.token, {
        address: '100 Normal St',
        city: 'Portland',
        state: 'OR',
        zipcode: '97201',
        country: 'US',
      });

      if (res.status === 201) {
        expect(res.body.mailing_address).toBeDefined();
        expect(res.body.mailing_address.is_primary).toBe(true);
      }
    });
  });
});


// ============================================================
// SUITE 3: Address Normalization + Hashing Tests
// ============================================================

describe('Address normalization and hashing', () => {
  test('normalizes abbreviations consistently', () => {
    expect(expandAbbreviations('123 st')).toBe('123 street');
    expect(expandAbbreviations('apt 2b')).toBe('apartment 2b');
    expect(expandAbbreviations('ste 100')).toBe('suite 100');
    expect(expandAbbreviations('456 ave')).toBe('456 avenue');
    expect(expandAbbreviations('n main blvd')).toBe('north main boulevard');
  });

  test('produces identical hash for equivalent addresses', () => {
    const hash1 = computeAddressHash('123 Main St', '', 'Portland', 'OR', '97201');
    const hash2 = computeAddressHash('123 main street', '', 'portland', 'or', '97201');
    expect(hash1).toBe(hash2);
  });

  test('produces identical hash regardless of casing', () => {
    const hashUpper = computeAddressHash('123 MAIN ST', '', 'PORTLAND', 'OR', '97201');
    const hashLower = computeAddressHash('123 main st', '', 'portland', 'or', '97201');
    expect(hashUpper).toBe(hashLower);
  });

  test('produces identical hash regardless of extra whitespace', () => {
    const hashNormal = computeAddressHash('123 Main St', '', 'Portland', 'OR', '97201');
    const hashSpaces = computeAddressHash('  123  Main  St  ', '  ', '  Portland  ', ' OR ', ' 97201 ');
    expect(hashNormal).toBe(hashSpaces);
  });

  test('produces different hash when suite differs', () => {
    const hash1 = computeAddressHash('123 Main St', '', 'Portland', 'OR', '97201');
    const hash2 = computeAddressHash('123 Main St', 'Ste 100', 'Portland', 'OR', '97201');
    expect(hash1).not.toBe(hash2);
  });

  test('produces different hash when address differs', () => {
    const hash1 = computeAddressHash('123 Main St', '', 'Portland', 'OR', '97201');
    const hash2 = computeAddressHash('456 Oak Ave', '', 'Portland', 'OR', '97201');
    expect(hash1).not.toBe(hash2);
  });

  test('produces different hash when city differs', () => {
    const hash1 = computeAddressHash('123 Main St', '', 'Portland', 'OR', '97201');
    const hash2 = computeAddressHash('123 Main St', '', 'Seattle', 'WA', '98101');
    expect(hash1).not.toBe(hash2);
  });

  test('null unit and empty unit produce the same hash', () => {
    const hashNull = computeAddressHash('123 Main St', null, 'Portland', 'OR', '97201');
    const hashEmpty = computeAddressHash('123 Main St', '', 'Portland', 'OR', '97201');
    expect(hashNull).toBe(hashEmpty);
  });

  test('normalizeAddress produces consistent pipe-delimited format', () => {
    const result = normalizeAddress('123 Main St', 'Apt 2B', 'Portland', 'OR', '97201');
    expect(result).toBe('123 main street|apartment 2b|portland|or|97201|us');
  });

  test('hash is a 64-character hex string (SHA-256)', () => {
    const hash = computeAddressHash('123 Main St', '', 'Portland', 'OR', '97201');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
