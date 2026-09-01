/**
 * Address Validation Service
 *
 * Provider-agnostic orchestrator that implements the AddressValidationService
 * interface.  Currently delegates Layer 2 (API validation) to the
 * GoogleAddressValidationProvider, then maps the result into an AddressVerdict
 * with status, reasons, confidence, candidates, and next_actions.
 *
 * Methods:
 *   validate(input)                    — full validation pipeline
 *   revalidateWithUnit(addressId, unit) — re-run validation after user supplies a unit
 */

const logger = require('../../utils/logger');
const { AddressVerdictStatus } = require('./types');
const googleProvider = require('./googleProvider');

/** @typedef {import('./types').RawAddressInput} RawAddressInput */
/** @typedef {import('./types').AddressVerdict} AddressVerdict */

class AddressValidationService {
  /**
   * Validate a raw address through the full pipeline.
   *
   * @param {RawAddressInput} input
   * @returns {Promise<AddressVerdict>}
   */
  async validate(input) {
    if (!googleProvider.isAvailable()) {
      return this._serviceError('Google Address Validation API key not configured');
    }

    let googleResult;
    try {
      googleResult = await googleProvider.validate(input);
    } catch (err) {
      logger.error('AddressValidationService: provider threw', { error: err.message });
      return this._serviceError(`Provider error: ${err.message}`);
    }

    if (!googleResult) {
      return this._serviceError('Address validation provider returned no result');
    }

    return this._buildVerdict(googleResult);
  }

  /**
   * Re-validate a previously validated address with a unit/apt number appended.
   *
   * @param {string} addressId — the original address ID (for logging/context)
   * @param {string} unit — the unit/apt number supplied by the user
   * @returns {Promise<AddressVerdict>}
   */
  async revalidateWithUnit(addressId, unit) {
    // In a full implementation this would load the stored address by ID,
    // append the unit, and re-run validation. For now we require the caller
    // to provide the full address through validate() with line2 set.
    // This stub logs intent so downstream wiring can call it.
    logger.info('AddressValidationService.revalidateWithUnit', { addressId, unit });

    // Callers should construct a RawAddressInput with line2 = unit and call validate().
    // This method exists so the interface contract is established.
    return {
      status: AddressVerdictStatus.SERVICE_ERROR,
      reasons: ['revalidateWithUnit requires address lookup — not yet wired to persistence'],
      confidence: 0,
      candidates: [],
      next_actions: [],
    };
  }

  // ── Private helpers ──────────────────────────────────────────

  /**
   * Map a GoogleValidationResult into an AddressVerdict.
   *
   * @param {import('./types').GoogleValidationResult} result
   * @returns {AddressVerdict}
   * @private
   */
  _buildVerdict(result) {
    const reasons = [];
    const nextActions = [];
    const candidates = [];
    let status = AddressVerdictStatus.OK;
    let confidence = 90; // start optimistic, deduct for issues

    const { normalized, granularity, missing_component_types, verdict, usps_data } = result;

    // ── Missing street number ──────────────────────────────────
    if (missing_component_types.includes('street_number')) {
      status = AddressVerdictStatus.MISSING_STREET_NUMBER;
      reasons.push('Address is missing a street number');
      nextActions.push('prompt_street_number');
      confidence = Math.min(confidence, 15);
    }

    // ── Missing unit / subpremise ─────────────────────────────
    if (missing_component_types.includes('subpremise')) {
      status = AddressVerdictStatus.MISSING_UNIT;
      reasons.push('Address is missing a unit or apartment number');
      nextActions.push('prompt_unit');
      confidence = Math.min(confidence, 50);
    }

    // ── Unconfirmed / replaced components ─────────────────────
    if (verdict.hasUnconfirmedComponents) {
      reasons.push('Some address components could not be confirmed');
      confidence -= 15;
    }
    if (verdict.hasReplacedComponents) {
      reasons.push('Some address components were replaced by the validation service');
      confidence -= 10;
    }

    // ── Granularity check ─────────────────────────────────────
    if (granularity === 'ROUTE' || granularity === 'OTHER') {
      if (status === AddressVerdictStatus.OK) {
        status = AddressVerdictStatus.LOW_CONFIDENCE;
      }
      reasons.push(`Address could only be validated to ${granularity} level`);
      confidence = Math.min(confidence, 30);
      nextActions.push('manual_review');
    }

    // ── USPS deliverability signals ───────────────────────────
    if (usps_data) {
      const { dpv_match_code, dpv_vacant, dpv_cmra } = usps_data;

      if (dpv_match_code === 'N') {
        status = AddressVerdictStatus.UNDELIVERABLE;
        reasons.push('USPS DPV confirms address is not deliverable');
        confidence = Math.min(confidence, 10);
        nextActions.push('manual_review');
      } else if (dpv_match_code === 'S') {
        // Secondary (unit) number missing
        if (status === AddressVerdictStatus.OK) {
          status = AddressVerdictStatus.MISSING_UNIT;
        }
        reasons.push('USPS DPV indicates a secondary number is needed');
        confidence = Math.min(confidence, 45);
        if (!nextActions.includes('prompt_unit')) nextActions.push('prompt_unit');
      } else if (dpv_match_code === 'D') {
        reasons.push('USPS DPV matched to primary but secondary not confirmed');
        confidence -= 10;
      }

      if (dpv_vacant) {
        reasons.push('USPS flags this address as vacant');
        confidence -= 20;
      }

      if (dpv_cmra) {
        status = AddressVerdictStatus.BUSINESS;
        reasons.push('Address is a Commercial Mail Receiving Agency (CMRA/mailbox store)');
        confidence = Math.min(confidence, 20);
        nextActions.push('manual_review');
      }
    }

    // ── Clamp confidence ──────────────────────────────────────
    confidence = Math.max(0, Math.min(100, confidence));

    // ── Default next action for OK ────────────────────────────
    if (status === AddressVerdictStatus.OK && nextActions.length === 0) {
      nextActions.push('send_mail_code');
    }

    return {
      status,
      reasons,
      confidence,
      normalized,
      deliverability: usps_data ? {
        dpv_match_code: usps_data.dpv_match_code || '',
        rdi_type: 'residential', // will be enriched by Layer 3
        missing_secondary: missing_component_types.includes('subpremise'),
        commercial_mailbox: usps_data.dpv_cmra || false,
        vacant_flag: usps_data.dpv_vacant || false,
        footnotes: [],
      } : undefined,
      candidates,
      next_actions: nextActions,
    };
  }

  /**
   * Build a SERVICE_ERROR verdict.
   *
   * @param {string} reason
   * @returns {AddressVerdict}
   * @private
   */
  _serviceError(reason) {
    logger.warn('AddressValidationService: service error', { reason });
    return {
      status: AddressVerdictStatus.SERVICE_ERROR,
      reasons: [reason],
      confidence: 0,
      candidates: [],
      next_actions: ['manual_review'],
    };
  }
}

module.exports = new AddressValidationService();
