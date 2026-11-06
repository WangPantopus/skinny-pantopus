/**
 * Google Address Validation Provider (Layer 2)
 *
 * Calls the Google Address Validation API and returns a structured result
 * with normalized address, components, geocode, granularity, missing
 * component types, and the raw validation verdict.
 *
 * Environment variables:
 *   GOOGLE_ADDRESS_VALIDATION_API_KEY — API key for Google Address Validation
 */

const logger = require('../../utils/logger');
const addressConfig = require('../../config/addressVerification');
const { usesGooglePostal } = require('./postalAdapter');

/** @typedef {import('./types').RawAddressInput} RawAddressInput */
/** @typedef {import('./types').NormalizedAddress} NormalizedAddress */
/** @typedef {import('./types').GoogleValidationResult} GoogleValidationResult */

const API_BASE = 'https://addressvalidation.googleapis.com/v1:validateAddress';

// When Google is the only postal source: one quick retry after a fast failure, inside the same
// deadline, and during an outage nobody waits out the timeout on every check.
const RETRY_PAUSE_MIN_MS = 50;
const RETRY_PAUSE_SPREAD_MS = 100;
const RETRY_MIN_BUDGET_MS = 500;
const CIRCUIT_FAILURES = 5;
const CIRCUIT_OPEN_MS = 30000;

/**
 * Google Address Validation Provider
 *
 * Implements Layer 2 of the validation pipeline — calls Google's API,
 * extracts normalized address, geocode, granularity, and missing components.
 */
class GoogleAddressValidationProvider {
  constructor() {
    this.apiKey = addressConfig.google.apiKey;
    this.consecutiveFailures = 0;
    this.circuitOpenUntil = 0;
  }

  /**
   * Check if the provider is configured and usable.
   * @returns {boolean}
   */
  isAvailable() {
    return !!this.apiKey;
  }

  /**
   * Validate a raw address via the Google Address Validation API.
   *
   * @param {RawAddressInput} input
   * @returns {Promise<GoogleValidationResult | null>} null on API error
   */
  async validate(input) {
    if (!this.apiKey) {
      logger.error('GoogleAddressValidationProvider: GOOGLE_ADDRESS_VALIDATION_API_KEY not configured');
      return null;
    }

    const requestBody = this._buildRequest(input);
    const timeoutMs = addressConfig.google.timeoutMs;

    if (!usesGooglePostal()) {
      const { data } = await this._post(requestBody, timeoutMs);
      return data ? this._parseResponse(data) : null;
    }

    if (Date.now() < this.circuitOpenUntil) {
      logger.warn('Google Address Validation skipped: too many recent failures');
      return null;
    }

    const deadline = Date.now() + timeoutMs;
    let outcome = await this._post(requestBody, timeoutMs);
    if (outcome.retryable) {
      const pause = RETRY_PAUSE_MIN_MS + Math.floor(Math.random() * RETRY_PAUSE_SPREAD_MS);
      const left = deadline - Date.now() - pause;
      if (left >= RETRY_MIN_BUDGET_MS) {
        await new Promise((resolve) => setTimeout(resolve, pause));
        outcome = await this._post(requestBody, left);
      }
    }

    const parsed = outcome.data ? this._parseResponse(outcome.data) : null;
    if (parsed) {
      this.consecutiveFailures = 0;
    } else {
      this.consecutiveFailures += 1;
      if (this.consecutiveFailures >= CIRCUIT_FAILURES) {
        this.circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
        this.consecutiveFailures = 0;
      }
    }
    return parsed;
  }

  /**
   * One request to Google. `retryable` marks a fast failure worth one more try.
   *
   * @param {object} requestBody
   * @param {number} timeoutMs
   * @returns {Promise<{data: object|null, retryable: boolean}>}
   * @private
   */
  async _post(requestBody, timeoutMs) {
    let res;
    try {
      res = await fetch(`${API_BASE}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      logger.error('Google Address Validation API request failed', {
        error: err.message,
      });
      return { data: null, retryable: err.name !== 'TimeoutError' && err.name !== 'AbortError' };
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.warn('Google Address Validation API error', {
        status: res.status,
        body: text.slice(0, 500),
      });
      return { data: null, retryable: res.status === 429 || res.status >= 500 };
    }

    try {
      return { data: await res.json(), retryable: false };
    } catch (err) {
      logger.error('Google Address Validation API: invalid JSON response', {
        error: err.message,
      });
      return { data: null, retryable: false };
    }
  }

  /**
   * Build the Google API request body.
   *
   * @param {RawAddressInput} input
   * @returns {object}
   * @private
   */
  _buildRequest(input) {
    const addressLines = [input.line1];
    if (input.line2) addressLines.push(input.line2);

    return {
      address: {
        regionCode: input.country || 'US',
        locality: input.city,
        administrativeArea: input.state,
        postalCode: input.zip,
        addressLines,
      },
      enableUspsCass: true,
    };
  }

  /**
   * Parse the Google API response into a structured result.
   *
   * @param {object} data — raw Google API response
   * @returns {GoogleValidationResult | null}
   * @private
   */
  _parseResponse(data) {
    const result = data?.result;
    if (!result) {
      logger.warn('Google Address Validation API: empty result');
      return null;
    }

    const googleAddress = result.address || {};
    const geocode = result.geocode || {};
    const verdict = result.verdict || {};
    const uspsData = result.uspsData || null;

    const normalized = this._extractNormalized(googleAddress, geocode, uspsData);
    const components = this._extractComponents(googleAddress);
    const missingTypes = (googleAddress.missingComponentTypes || []).map(String);

    return {
      normalized,
      components,
      geocode: {
        lat: geocode.location?.latitude || 0,
        lng: geocode.location?.longitude || 0,
      },
      granularity: verdict.geocodeGranularity || googleAddress.addressGranularity || 'OTHER',
      missing_component_types: missingTypes,
      place_id: geocode.placeId || result.metadata?.placeId || null,
      place_types: (geocode.placeTypes || []).map(String),
      metadata: {
        residential: result.metadata?.residential ?? null,
        business: result.metadata?.business ?? null,
        po_box: result.metadata?.poBox ?? null,
      },
      verdict: {
        inputGranularity: verdict.inputGranularity || null,
        validationGranularity: verdict.validationGranularity || null,
        geocodeGranularity: verdict.geocodeGranularity || null,
        hasUnconfirmedComponents: verdict.hasUnconfirmedComponents || false,
        hasInferredComponents: verdict.hasInferredComponents || false,
        hasReplacedComponents: verdict.hasReplacedComponents || false,
      },
      usps_data: uspsData ? this._extractUspsData(uspsData) : undefined,
    };
  }

  /**
   * Extract a NormalizedAddress from the Google response.
   *
   * @param {object} googleAddress
   * @param {object} geocode
   * @param {object|null} uspsData
   * @returns {NormalizedAddress}
   * @private
   */
  _extractNormalized(googleAddress, geocode, uspsData) {
    const components = googleAddress.addressComponents || [];

    const getComponent = (type) => {
      const c = components.find((comp) =>
        comp.componentType === type
      );
      return c?.componentName?.text || '';
    };

    const streetNumber = getComponent('street_number');
    const route = getComponent('route');
    const subpremise = getComponent('subpremise');

    const line1 = `${streetNumber} ${route}`.trim();
    const line2 = subpremise || undefined;
    const city = getComponent('locality');
    const state = getComponent('administrative_area_level_1');
    const zip = getComponent('postal_code');
    const plus4 = uspsData?.standardizedAddress?.zipCodeExtension || undefined;

    return {
      line1,
      line2,
      city,
      state,
      zip,
      plus4,
      lat: geocode.location?.latitude || 0,
      lng: geocode.location?.longitude || 0,
    };
  }

  /**
   * Extract address components as a flat map for downstream processing.
   *
   * @param {object} googleAddress
   * @returns {object} — { component_type: { text, confirmed, inferred, replaced } }
   * @private
   */
  _extractComponents(googleAddress) {
    const components = googleAddress.addressComponents || [];
    const result = {};

    for (const comp of components) {
      result[comp.componentType] = {
        text: comp.componentName?.text || '',
        confirmed: comp.confirmationLevel === 'CONFIRMED',
        inferred: comp.inferred || false,
        replaced: comp.replaced || false,
      };
    }

    return result;
  }

  /**
   * Extract useful USPS CASS data from the response.
   *
   * @param {object} uspsData
   * @returns {object}
   * @private
   */
  _extractUspsData(uspsData) {
    // Y, N, or absent: absent is unknown, never false.
    const yesNo = (value) => (value === 'Y' ? true : value === 'N' ? false : null);

    return {
      dpv_match_code: uspsData.dpvConfirmation || null,
      dpv_footnote: uspsData.dpvFootnote || null,
      carrier_route: uspsData.carrierRoute || null,
      carrier_route_type: uspsData.carrierRoute ? uspsData.carrierRoute.charAt(0) : null,
      dpv_vacant: yesNo(uspsData.dpvVacant),
      dpv_cmra: yesNo(uspsData.dpvCmra),
      dpv_no_stat: yesNo(uspsData.dpvNoStat),
      dpv_no_stat_reason: uspsData.dpvNoStatReasonCode ?? null,
      address_record_type: uspsData.addressRecordType || null,
      post_office_city: uspsData.postOfficeCity || null,
      post_office_state: uspsData.postOfficeState || null,
      fips_county_code: uspsData.fipsCountyCode || null,
      ews_flag: uspsData.ewsNoMatch || false,
      po_box_only_zip: uspsData.poBoxOnlyPostalCode === true,
      cass_processed: uspsData.cassProcessed ?? null,
      // Google fills this when it has stopped USPS checks for the account.
      suspended: !!uspsData.errorMessage,
    };
  }
}

module.exports = new GoogleAddressValidationProvider();
