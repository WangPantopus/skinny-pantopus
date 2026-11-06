/**
 * Address Validation — Type Definitions
 *
 * JSDoc typedefs for the address validation pipeline.
 * These serve as the interface contracts for all providers and consumers.
 */

// ── Enums ────────────────────────────────────────────────────

/**
 * @readonly
 * @enum {string}
 */
const AddressVerdictStatus = Object.freeze({
  OK: 'OK',
  MISSING_UNIT: 'MISSING_UNIT',
  MISSING_STREET_NUMBER: 'MISSING_STREET_NUMBER',
  UNVERIFIED_STREET_NUMBER: 'UNVERIFIED_STREET_NUMBER',
  PO_BOX: 'PO_BOX',
  MULTIPLE_MATCHES: 'MULTIPLE_MATCHES',
  BUSINESS: 'BUSINESS',
  MIXED_USE: 'MIXED_USE',
  UNDELIVERABLE: 'UNDELIVERABLE',
  LOW_CONFIDENCE: 'LOW_CONFIDENCE',
  SERVICE_ERROR: 'SERVICE_ERROR',
  CONFLICT: 'CONFLICT',
  // Google postal source only. Apps that haven't asked for these (`?postal=2`) get MIXED_USE,
  // the status they already let through, so an old build never strands.
  UNIT_NOT_CONFIRMED: 'UNIT_NOT_CONFIRMED',
  POSTAL_PENDING: 'POSTAL_PENDING',
});

// ── Typedefs ─────────────────────────────────────────────────

/**
 * @typedef {object} RawAddressInput
 * @property {string} line1
 * @property {string} [line2]
 * @property {string} city
 * @property {string} state
 * @property {string} zip
 * @property {string} [country]
 */

/**
 * @typedef {object} NormalizedAddress
 * @property {string}  [id]
 * @property {string}  line1
 * @property {string}  [line2]
 * @property {string}  city
 * @property {string}  state
 * @property {string}  zip
 * @property {string}  [plus4]
 * @property {number}  lat
 * @property {number}  lng
 */

/**
 * @typedef {object} DeliverabilityResult
 * @property {string}  dpv_match_code      — Y/N/S/D from USPS DPV
 * @property {string}  rdi_type            — 'residential' | 'commercial'
 * @property {boolean} missing_secondary   — true if unit/apt is missing
 * @property {boolean} commercial_mailbox  — true if CMRA
 * @property {boolean} [vacant_flag]       — true if flagged vacant
 * @property {string[]} footnotes          — USPS footnote codes
 */

/**
 * @typedef {object} PlaceClassification
 * @property {string[]} google_place_types  — heuristic place tags used by the live decision engine
 * @property {string}   parcel_type         — residential | commercial | mixed | unknown
 * @property {string}   building_type       — single_family | multi_unit | commercial | mixed_use | unknown
 */

/**
 * @typedef {object} ProviderPlaceClassification
 * @property {string}   provider
 * @property {string}   [provider_version]
 * @property {string}   [place_id]
 * @property {string}   [primary_type]
 * @property {string[]} types
 * @property {string}   [business_status]
 * @property {string}   [display_name]
 * @property {number}   [confidence]
 * @property {boolean}  [is_named_poi]
 * @property {string}   [lookup_mode]
 * @property {string}   [verification_level]
 * @property {string[]} [risk_flags]
 * @property {string}   [validated_at]
 * @property {object}   [raw]
 */

/**
 * @typedef {object} SecondaryAddressIntelligence
 * @property {string}   provider
 * @property {string}   [provider_version]
 * @property {boolean}  [secondary_required]
 * @property {number}   [unit_count_estimate]
 * @property {number}   [confidence]
 * @property {boolean}  [submitted_unit_known]
 * @property {boolean}  [submitted_unit_evaluated]
 * @property {string}   [lookup_mode]
 * @property {string}   [verification_level]
 * @property {string}   [validated_at]
 * @property {object}   [raw]
 */

/**
 * @typedef {object} ParcelIntelligence
 * @property {string}   provider
 * @property {string}   [provider_version]
 * @property {string}   [parcel_id]
 * @property {string}   [land_use]
 * @property {string}   [property_type]
 * @property {number}   [building_count]
 * @property {number}   [residential_unit_count]
 * @property {number}   [non_residential_unit_count]
 * @property {string}   [usage_class]
 * @property {number}   [confidence]
 * @property {string}   [lookup_mode]
 * @property {boolean}  [from_cache]
 * @property {string}   [validated_at]
 * @property {object}   [raw]
 */

/**
 * @typedef {object} ExistingHousehold
 * @property {string}   home_id
 * @property {number}   member_count
 * @property {string[]} active_roles — e.g. ['owner', 'tenant']
 */

/**
 * @typedef {object} AddressCandidate
 * @property {NormalizedAddress} address
 * @property {number}            confidence
 */

/**
 * @typedef {object} AddressVerdict
 * @property {AddressVerdictStatus} status
 * @property {string[]}             reasons         — human-readable explanations
 * @property {number}               confidence      — 0-100
 * @property {NormalizedAddress}     [normalized]    — the validated/normalized address
 * @property {DeliverabilityResult}  [deliverability]
 * @property {PlaceClassification}   [classification]
 * @property {string}                [verification_level]
 * @property {string[]}              [risk_flags]
 * @property {object}                [provider_consensus]
 * @property {AddressCandidate[]}    candidates      — alternate matches (MISSING_UNIT, MULTIPLE_MATCHES)
 * @property {string[]}             next_actions     — e.g. ['prompt_unit', 'send_mail_code', 'manual_review']
 * @property {ExistingHousehold}     [existing_household]
 */

/**
 * @typedef {object} DecisionInput
 * @property {GoogleValidationResult}      [google]
 * @property {SmartyPostalResult}          [smarty]
 * @property {PlaceClassification}         [place]
 * @property {ProviderPlaceClassification} [provider_place]
 * @property {boolean}                     [use_provider_place_for_business]
 * @property {SecondaryAddressIntelligence} [unit_intelligence]
 * @property {boolean}                     [use_provider_unit_intelligence]
 * @property {ParcelIntelligence}          [parcel_intel]
 * @property {boolean}                     [use_provider_parcel_for_classification]
 * @property {number}                      [provider_parcel_max_age_days]
 * @property {ExistingHousehold}           [household]
 * @property {AddressCandidate[]}          [candidates]
 */

// ── Smarty-specific types ────────────────────────────────────

/**
 * @typedef {object} SmartyPostalResult
 * @property {boolean}  from_cache        — true if result was served from DB cache
 * @property {boolean}  inconclusive      — true if Smarty was unreachable / returned error
 * @property {string}   dpv_match_code    — Y/N/S/D or '' if inconclusive
 * @property {string}   rdi_type          — 'residential' | 'commercial' | 'unknown'
 * @property {boolean}  missing_secondary — true if footnote CC present
 * @property {boolean}  commercial_mailbox — true if dpv_cmra = 'Y'
 * @property {boolean}  vacant_flag       — true if dpv_vacant = 'Y'
 * @property {string[]} footnotes         — all dpv_footnotes + footnotes codes
 * @property {object}   [raw]             — raw Smarty response candidate (omitted for cache hits)
 */

/**
 * The postal input read from Google's own answer (postalAdapter.js): the Smarty shape, where a
 * field Google left out is null (unknown), never false.
 *
 * @typedef {object} GooglePostalInput
 * @property {'google'} source
 * @property {boolean}  from_cache
 * @property {boolean}  inconclusive      — always false: no USPS answer is pending, not an error
 * @property {string}   dpv_match_code    — Y/N/S/D, or '' when USPS gave no answer
 * @property {string}   rdi_type          — 'residential' | 'commercial' | 'unknown'
 * @property {boolean}  home_and_business — Google says both
 * @property {boolean}  missing_secondary — D, N1 or C1: USPS requires a unit
 * @property {boolean}  unconfirmed_secondary — S or CC: a unit USPS can't confirm
 * @property {?boolean} commercial_mailbox
 * @property {?boolean} vacant_flag
 * @property {?boolean} no_stat           — USPS doesn't deliver here (recorded; no refusal yet)
 * @property {?number}  no_stat_reason
 * @property {string[]} footnotes
 * @property {?string}  record_type       — F, G, H, P, R, S
 * @property {?string}  carrier_route_type — C, R, H, B, G
 * @property {?boolean} po_box_flag
 * @property {boolean}  po_box_only_zip
 * @property {boolean}  coming_soon       — USPS says this address will be in its file soon
 * @property {?boolean} cass_processed
 * @property {boolean}  usps_suspended    — Google stopped USPS checks for this account
 * @property {string}   checked_at
 */

// ── Google-specific types ────────────────────────────────────

/**
 * @typedef {object} GoogleValidationResult
 * @property {NormalizedAddress}  normalized
 * @property {object}            components       — raw address components from Google
 * @property {{lat: number, lng: number}} geocode
 * @property {string}            granularity      — PREMISE, SUB_PREMISE, ROUTE, etc.
 * @property {string[]}          missing_component_types — e.g. ['subpremise']
 * @property {object}            verdict          — raw Google verdict object
 * @property {object}            [usps_data]      — USPS data if available
 * @property {string}            [place_id]
 * @property {string[]}          [place_types]    — map place types from the same answer
 * @property {{residential: ?boolean, business: ?boolean, po_box: ?boolean}} [metadata] — unset is null
 */

module.exports = {
  AddressVerdictStatus,
};
