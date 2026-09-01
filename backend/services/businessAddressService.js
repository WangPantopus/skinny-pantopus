/**
 * Business Address Decision Engine
 *
 * Evaluates business addresses through a multi-step pipeline:
 *   0. Normalize + geocode
 *   1. Deliverability check
 *   2. Missing suite detection
 *   3. CMRA / PO Box detection
 *   4. Location type inference
 *   5. Conflict / duplicate check
 *   6. Compute capabilities
 *   7. Determine required verification
 *
 * Returns a deterministic verdict that drives UI flows, map visibility,
 * and verification requirements.
 */

const logger = require('../utils/logger');
const { normalizeAddress, computeAddressHash } = require('../utils/normalizeAddress');
const { geocodeAddress } = require('../utils/geocoding');
const supabaseAdmin = require('../config/supabaseAdmin');
const { VERIFICATION_RANK } = require('../utils/businessConstants');

// ── Constants ────────────────────────────────────────────────

/** Keywords suggesting a multi-tenant commercial building. */
const MULTI_TENANT_KEYWORDS = /\b(tower|towers|plaza|center|centre|building|bldg|complex|mall|atrium|pavilion|suites|offices|professional\s+(?:building|center|centre|park))\b/i;

/** Known CMRA business name patterns (case-insensitive). */
const CMRA_BUSINESS_NAMES = [
  'ups store',
  'the ups store',
  'mailboxes etc',
  'pak mail',
  'postnet',
  'postal connections',
  'aim mail center',
  'ipostal1',
  'regus',
  'davinci',
];

/** Regex for CMRA / mailbox keywords in address line 1. */
const CMRA_KEYWORDS = /\b(pmb|mailbox|mail\s*box|cmra)\b/i;

/** Regex for PO Box patterns. */
const PO_BOX_PATTERN = /^p\.?\s*o\.?\s*box\s+\d|^box\s+\d/i;
const PO_BOX_ANYWHERE = /\bp\.?\s*o\.?\s*box\b/i;

/** Map from user-facing intent to business_location_type DB enum. */
const INTENT_TO_TYPE = {
  CUSTOMER_FACING: 'storefront',
  OFFICE_NOT_PUBLIC: 'office',
  WAREHOUSE: 'warehouse',
  HOME_BASED_PRIVATE: 'home_based_private',
  SERVICE_AREA_ONLY: 'service_area_only',
  MAILING_ONLY: 'mailing_only',
};

/** Granularity values we consider sufficiently precise. */
const ACCEPTABLE_GRANULARITY = new Set(['rooftop', 'parcel', 'point', 'address', 'interpolation', 'intersection', 'street']);

// ── Step 0: Normalize + Geocode ──────────────────────────────

/**
 * Normalize the input address, compute its hash, and geocode via Mapbox.
 */
async function normalizeAndGeocode(input) {
  const { address, address2, city, state, zipcode, country = 'US' } = input;

  const normalized = {
    line1: (address || '').trim(),
    line2: (address2 || '').trim(),
    city: (city || '').trim(),
    state: (state || '').trim().toUpperCase(),
    zip: (zipcode || '').trim(),
    plus4: '',
  };

  const hash = computeAddressHash(
    normalized.line1,
    normalized.line2,
    normalized.city,
    normalized.state,
    normalized.zip,
    country,
  );

  // Attempt geocode via shared utility (mockable in tests)
  let coordinates = null;
  let granularity = null;
  let rawResponse = null;

  try {
    const result = await geocodeAddress(
      normalized.line1 + (normalized.line2 ? ', ' + normalized.line2 : ''),
      normalized.city,
      normalized.state,
      normalized.zip,
      country,
    );

    if (result && result.latitude != null && result.longitude != null) {
      coordinates = { lat: result.latitude, lng: result.longitude };
      granularity = 'address';
    }
  } catch (err) {
    logger.warn('Geocode failed in business address pipeline', { error: err.message });
  }

  return {
    normalized,
    hash,
    coordinates,
    granularity,
    raw_response: rawResponse,
  };
}

// ── Step 1: Deliverability Check ─────────────────────────────

function checkDeliverability(geocodeResult) {
  const reasons = [];

  if (!geocodeResult.coordinates) {
    return { deliverable: false, status: 'undeliverable', reasons: ['NO_GEOCODE_RESULTS'] };
  }

  if (geocodeResult.granularity && !ACCEPTABLE_GRANULARITY.has(geocodeResult.granularity)) {
    reasons.push('LOW_GRANULARITY');
    return { deliverable: false, status: 'low_confidence', reasons };
  }

  return { deliverable: true, status: 'ok', reasons: [] };
}

// ── Step 2: Missing Suite Detection ──────────────────────────

function detectMissingSuite(input, geocodeResult) {
  const addr = (input.address || '').toLowerCase();
  const addr2 = (input.address2 || '').trim();
  const reasons = [];

  // If suite/unit already provided, no issue
  if (addr2) {
    return { needs_suite: false, status: 'ok', reasons: [] };
  }

  // Check multi-tenant keywords in the address
  if (MULTI_TENANT_KEYWORDS.test(addr)) {
    reasons.push('MISSING_SECONDARY');
    return { needs_suite: true, status: 'need_suite', reasons };
  }

  // Check if Mapbox returned multiple features at the same street with different units
  if (geocodeResult.raw_response?.features?.length > 1) {
    const features = geocodeResult.raw_response.features;
    const firstText = (features[0].text || '').toLowerCase();
    const sameStreetDiffUnit = features.some((f, i) => {
      if (i === 0) return false;
      const t = (f.text || '').toLowerCase();
      return t === firstText && f.address !== features[0].address;
    });
    if (sameStreetDiffUnit) {
      reasons.push('MISSING_SECONDARY');
      return { needs_suite: true, status: 'need_suite', reasons };
    }
  }

  return { needs_suite: false, status: 'ok', reasons: [] };
}

// ── Step 3: CMRA / PO Box Detection ─────────────────────────

function detectCMRA_POBox(input) {
  const addr = (input.address || '').toLowerCase();
  const reasons = [];

  // Check PO Box first (more specific)
  if (PO_BOX_PATTERN.test(addr) || PO_BOX_ANYWHERE.test(addr)) {
    return { is_cmra: false, is_po_box: true, status: 'po_box', reasons: ['PO_BOX'] };
  }

  // Check CMRA keyword patterns
  if (CMRA_KEYWORDS.test(addr)) {
    return { is_cmra: true, is_po_box: false, status: 'cmra_detected', reasons: ['CMRA_FLAG'] };
  }

  // Check known CMRA business names in the address
  for (const name of CMRA_BUSINESS_NAMES) {
    if (addr.includes(name)) {
      return { is_cmra: true, is_po_box: false, status: 'cmra_detected', reasons: ['CMRA_FLAG'] };
    }
  }

  return { is_cmra: false, is_po_box: false, status: 'ok', reasons: [] };
}

// ── Step 4: Location Type Inference ──────────────────────────

function inferLocationType(input, cmraResult) {
  const intent = (input.location_intent || '').toUpperCase();
  const reasons = [];

  // CMRA/PO Box overrides intent — force mailing_only
  if (cmraResult.is_cmra || cmraResult.is_po_box) {
    return {
      location_type: 'mailing_only',
      status: cmraResult.status,
      reasons: cmraResult.reasons,
    };
  }

  // Map intent to type
  const locationType = INTENT_TO_TYPE[intent] || 'unknown';

  // Heuristic: if claiming customer-facing but address looks residential
  // (very basic — check for common residential street type patterns without commercial signals)
  if (intent === 'CUSTOMER_FACING') {
    const addr = (input.address || '').toLowerCase();
    const residentialHints = /\b(apt|apartment|unit|#\d|residence|condo|townhouse)\b/i;
    if (residentialHints.test(addr)) {
      reasons.push('PLACE_TYPE_MISMATCH');
      return { location_type: 'storefront', status: 'mixed_use', reasons };
    }
  }

  return { location_type: locationType, status: 'ok', reasons: [] };
}

// ── Step 5: Conflict / Duplicate Check ───────────────────────

async function checkConflicts(normalized, hash, businessUserId) {
  try {
    let query = supabaseAdmin
      .from('BusinessLocation')
      .select('id, business_user_id, address_hash, address2')
      .eq('address_hash', hash)
      .eq('is_active', true);

    // Match on address2 (suite) for exact conflict detection
    if (normalized.line2) {
      query = query.eq('address2', normalized.line2);
    } else {
      query = query.or('address2.is.null,address2.eq.');
    }

    const { data: existing, error } = await query;

    if (error) {
      logger.warn('Conflict check query failed', { error: error.message });
      return { has_conflict: false, conflicting_location_ids: [], status: 'ok', reasons: [] };
    }

    if (!existing || existing.length === 0) {
      return { has_conflict: false, conflicting_location_ids: [], status: 'ok', reasons: [] };
    }

    // Check if all matches belong to the same business (updating own location)
    const otherBusiness = existing.filter(loc => loc.business_user_id !== businessUserId);

    if (otherBusiness.length > 0) {
      return {
        has_conflict: true,
        conflicting_location_ids: otherBusiness.map(loc => loc.id),
        status: 'conflict',
        reasons: ['DUPLICATE_LOCATION'],
      };
    }

    // Same business owns it — no conflict
    return { has_conflict: false, conflicting_location_ids: [], status: 'ok', reasons: [] };
  } catch (err) {
    logger.warn('Conflict check failed', { error: err.message });
    return { has_conflict: false, conflicting_location_ids: [], status: 'ok', reasons: [] };
  }
}

// ── Step 6: Compute Capabilities ─────────────────────────────

function computeCapabilities(locationType, verificationRank, statusOverrides) {
  const isPhysical = ['storefront', 'office', 'warehouse'].includes(locationType);
  const isCmraOrPo = statusOverrides.includes('CMRA_FLAG') || statusOverrides.includes('PO_BOX');

  // verificationRank is a numeric identity verification rank (0-3):
  //   0 = unverified, 1 = self_attested, 2 = document_verified, 3 = government_verified
  const rank = typeof verificationRank === 'number' ? verificationRank : 0;

  return {
    map_pin: isPhysical && !isCmraOrPo,
    show_in_nearby: isPhysical && !isCmraOrPo && rank >= 1,
    receive_mail: true,
    enable_payouts: false, // always false until KYC is verified externally
  };
}

// ── Step 7: Required Verification ────────────────────────────

function determineRequiredVerification(locationType, allReasons) {
  const hasMismatch = allReasons.includes('PLACE_TYPE_MISMATCH');

  const base = {
    storefront: ['MAIL_CODE'],
    office: ['DOMAIN', 'PHONE'],
    warehouse: ['DOMAIN', 'PHONE'],
    home_based_private: ['PHONE'],
    service_area_only: ['PHONE'],
    mailing_only: ['NONE'],
    unknown: ['DOCS'],
  };

  const verification = [...(base[locationType] || ['DOCS'])];

  // Escalate for mixed-use / place mismatch
  if (hasMismatch) {
    if (!verification.includes('VIDEO')) verification.push('VIDEO');
    if (!verification.includes('DOCS')) verification.push('DOCS');
  }

  return verification;
}

// ── Helper: Find or Create Canonical Address ─────────────────

async function findOrCreateCanonicalAddress(normalized, hash, coordinates, validationData) {
  try {
    // Look up existing
    const { data: existing, error: selectErr } = await supabaseAdmin
      .from('BusinessAddress')
      .select('id')
      .eq('address_hash', hash)
      .maybeSingle();

    if (selectErr) {
      logger.warn('BusinessAddress lookup failed', { error: selectErr.message });
      return null;
    }

    if (existing) return existing.id;

    // Insert new canonical address
    const record = {
      address_line1_norm: normalized.line1,
      address_line2_norm: normalized.line2 || '',
      city_norm: normalized.city,
      state: normalized.state,
      postal_code: normalized.zip,
      plus4: normalized.plus4 || '',
      country: 'US',
      address_hash: hash,
      geocode_lat: coordinates?.lat || null,
      geocode_lng: coordinates?.lng || null,
      is_multi_tenant: validationData.is_multi_tenant || false,
      is_cmra: validationData.is_cmra || false,
      is_po_box: validationData.is_po_box || false,
      validation_provider: validationData.provider || null,
      validation_granularity: validationData.granularity || null,
      // Geocode provenance
      geocode_provider: validationData.provider || 'mapbox',
      geocode_mode: 'verified',
      geocode_accuracy: validationData.granularity || 'address',
      geocode_place_id: validationData.place_id || null,
      geocode_source_flow: 'business_address_validation',
      geocode_created_at: new Date().toISOString(),
    };

    // Build PostGIS point if we have coordinates
    if (coordinates?.lat && coordinates?.lng) {
      record.location = `SRID=4326;POINT(${coordinates.lng} ${coordinates.lat})`;
    }

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('BusinessAddress')
      .insert(record)
      .select('id')
      .single();

    if (insertErr) {
      // Handle race condition: another request may have inserted in the meantime
      if (insertErr.code === '23505') {
        const { data: retry } = await supabaseAdmin
          .from('BusinessAddress')
          .select('id')
          .eq('address_hash', hash)
          .maybeSingle();
        return retry?.id || null;
      }
      logger.warn('BusinessAddress insert failed', { error: insertErr.message });
      return null;
    }

    return inserted?.id || null;
  } catch (err) {
    logger.error('findOrCreateCanonicalAddress failed', { error: err.message });
    return null;
  }
}

// ── Helper: Log Decision to Audit Table ──────────────────────

async function logDecision(input, verdict) {
  try {
    await supabaseAdmin
      .from('BusinessAddressDecision')
      .insert({
        business_user_id: input.business_user_id || null,
        input_address: input.address || '',
        input_address2: input.address2 || '',
        input_city: input.city || '',
        input_state: input.state || '',
        input_zipcode: input.zipcode || '',
        input_place_id: input.place_id || null,
        input_location_intent: input.location_intent || null,
        decision_status: verdict.decision.status,
        decision_reasons: verdict.decision.reasons,
        business_location_type: verdict.decision.business_location_type,
        capabilities: verdict.decision.allowed_capabilities,
        required_verification: verdict.decision.required_verification,
        canonical_address_id: verdict.canonical_address_id || null,
        candidates: verdict.candidates,
      });
  } catch (err) {
    // Audit logging should never break the main flow
    logger.warn('BusinessAddressDecision audit insert failed', { error: err.message });
  }
}

// ── Orchestrator: Run Decision Pipeline ──────────────────────

async function validateBusinessAddress(input) {
  try {
    const { address, address2, city, state, zipcode, country, place_id, location_intent, business_user_id } = input;

    // ── Step 0: Normalize + Geocode ──
    const geocodeResult = await normalizeAndGeocode({ address, address2, city, state, zipcode, country });

    // Collect all reasons across steps
    const allReasons = [];

    // ── Step 1: Deliverability ──
    const deliverability = checkDeliverability(geocodeResult);
    allReasons.push(...deliverability.reasons);

    if (!deliverability.deliverable) {
      const verdict = buildVerdict(
        null,
        geocodeResult.normalized,
        geocodeResult.coordinates,
        deliverability.status,
        'unknown',
        { map_pin: false, show_in_nearby: false, receive_mail: false, enable_payouts: false },
        ['NONE'],
        allReasons,
        [],
      );
      await logDecision(input, verdict);
      return verdict;
    }

    // ── Step 2: Missing Suite ──
    const suiteCheck = detectMissingSuite(input, geocodeResult);
    allReasons.push(...suiteCheck.reasons);

    if (suiteCheck.needs_suite) {
      // Still create canonical address for partial match
      const canonicalId = await findOrCreateCanonicalAddress(
        geocodeResult.normalized, geocodeResult.hash, geocodeResult.coordinates,
        { is_multi_tenant: true, is_cmra: false, is_po_box: false, provider: 'mapbox', granularity: geocodeResult.granularity },
      );

      const verdict = buildVerdict(
        canonicalId,
        geocodeResult.normalized,
        geocodeResult.coordinates,
        'need_suite',
        'unknown',
        { map_pin: false, show_in_nearby: false, receive_mail: true, enable_payouts: false },
        ['NONE'],
        allReasons,
        [],
      );
      await logDecision(input, verdict);
      return verdict;
    }

    // ── Step 3: CMRA / PO Box ──
    const cmraCheck = detectCMRA_POBox(input);
    allReasons.push(...cmraCheck.reasons);

    // ── Step 4: Location Type ──
    const typeResult = inferLocationType(input, cmraCheck);
    allReasons.push(...typeResult.reasons);

    // ── Step 5: Conflicts ──
    const conflictResult = await checkConflicts(geocodeResult.normalized, geocodeResult.hash, business_user_id);
    allReasons.push(...conflictResult.reasons);

    // ── Determine final status ──
    // Priority: cmra/po_box > conflict > mixed_use/place_mismatch > ok
    let finalStatus = 'ok';
    if (cmraCheck.status !== 'ok') {
      finalStatus = cmraCheck.status;
    } else if (conflictResult.status !== 'ok') {
      finalStatus = conflictResult.status;
    } else if (typeResult.status !== 'ok') {
      finalStatus = typeResult.status;
    }

    // ── Step 6: Capabilities ──
    // Fetch the business's actual identity verification rank (not location tier)
    let verificationRank = 0;
    if (business_user_id) {
      try {
        const { data: bizProfile } = await supabaseAdmin
          .from('BusinessProfile')
          .select('verification_status')
          .eq('business_user_id', business_user_id)
          .maybeSingle();
        const status = bizProfile?.verification_status || 'unverified';
        verificationRank = VERIFICATION_RANK[status] ?? 0;
      } catch (err) {
        logger.warn('Failed to fetch verification status for capabilities', { error: err.message, business_user_id });
      }
    }
    const capabilities = computeCapabilities(typeResult.location_type, verificationRank, allReasons);

    // ── Step 7: Required Verification ──
    const requiredVerification = determineRequiredVerification(typeResult.location_type, allReasons);

    // ── Upsert canonical address ──
    const canonicalId = await findOrCreateCanonicalAddress(
      geocodeResult.normalized, geocodeResult.hash, geocodeResult.coordinates,
      {
        is_multi_tenant: suiteCheck.needs_suite,
        is_cmra: cmraCheck.is_cmra,
        is_po_box: cmraCheck.is_po_box,
        provider: 'mapbox',
        granularity: geocodeResult.granularity,
      },
    );

    const verdict = buildVerdict(
      canonicalId,
      geocodeResult.normalized,
      geocodeResult.coordinates,
      finalStatus,
      typeResult.location_type,
      capabilities,
      requiredVerification,
      allReasons,
      [],
    );

    await logDecision(input, verdict);
    return verdict;
  } catch (err) {
    logger.error('validateBusinessAddress pipeline failed', { error: err.message, stack: err.stack });

    return buildVerdict(
      null,
      { line1: input.address || '', line2: input.address2 || '', city: input.city || '', state: input.state || '', zip: input.zipcode || '', plus4: '' },
      null,
      'service_error',
      'unknown',
      { map_pin: false, show_in_nearby: false, receive_mail: false, enable_payouts: false },
      ['NONE'],
      ['SERVICE_ERROR'],
      [],
    );
  }
}

// ── Build Verdict Object ─────────────────────────────────────

function buildVerdict(canonicalAddressId, normalized, coordinates, status, locationType, capabilities, requiredVerification, reasons, candidates) {
  return {
    canonical_address_id: canonicalAddressId || null,
    normalized: {
      line1: normalized.line1 || '',
      line2: normalized.line2 || '',
      city: normalized.city || '',
      state: normalized.state || '',
      zip: normalized.zip || '',
      plus4: normalized.plus4 || '',
    },
    coordinates: coordinates || null,
    decision: {
      status,
      business_location_type: locationType,
      allowed_capabilities: capabilities,
      required_verification: requiredVerification,
      reasons,
    },
    candidates: candidates || [],
  };
}

// ── Exports ──────────────────────────────────────────────────

module.exports = {
  validateBusinessAddress,
  findOrCreateCanonicalAddress,
  // Exposed for unit testing
  normalizeAndGeocode,
  checkDeliverability,
  detectMissingSuite,
  detectCMRA_POBox,
  inferLocationType,
  checkConflicts,
  computeCapabilities,
  determineRequiredVerification,
};

/*
 * ── Test Cases ──────────────────────────────────────────────
 *
 * 1. "500 Broadway, New York, NY 10012" with no suite
 *    → status = 'need_suite', reasons includes 'MISSING_SECONDARY'
 *    (Broadway is not a multi-tenant keyword, but if Mapbox returns multiple
 *     sub-address features this would trigger. For keyword-based detection,
 *     use "500 Broadway Plaza" or similar.)
 *
 * 2. "6700 N Linder Ave, Skokie, IL 60077" (UPS Store address)
 *    → status = 'cmra_detected', reasons includes 'CMRA_FLAG'
 *    (Triggered when address line contains "UPS Store" or similar CMRA name.)
 *
 * 3. "PO Box 12345, Anytown, CA 90210"
 *    → status = 'po_box', reasons includes 'PO_BOX'
 *
 * 4. "123 Main St, Springfield, IL 62701" with intent = CUSTOMER_FACING
 *    → status = 'ok', business_location_type = 'storefront',
 *      capabilities.map_pin = true, required_verification includes 'MAIL_CODE'
 *
 * 5. "123 Main St, Springfield, IL 62701" same address already claimed by another business
 *    → status = 'conflict', reasons includes 'DUPLICATE_LOCATION'
 *
 * 6. Invalid/nonexistent address (e.g. "99999 Nonexistent Blvd, Nowhere, ZZ 00000")
 *    → status = 'undeliverable', reasons includes 'NO_GEOCODE_RESULTS'
 */
