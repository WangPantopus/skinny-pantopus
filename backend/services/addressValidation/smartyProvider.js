/**
 * Smarty Postal Provider (Layer 3 — DPV + RDI)
 *
 * Calls the Smarty US Street Address API to obtain USPS-grade deliverability
 * data: DPV match code, RDI (residential/commercial), missing-secondary
 * flag, CMRA flag, vacant flag, and footnotes.
 *
 * Includes a database cache: if the same normalized address (by address_hash)
 * was validated within the last 90 days, the cached result from
 * HomeAddress.validation_raw_response is returned instead of calling Smarty.
 *
 * Environment variables:
 *   SMARTY_AUTH_ID    — Smarty auth-id
 *   SMARTY_AUTH_TOKEN — Smarty auth-token
 *
 * @see https://www.smarty.com/docs/cloud/us-street-api
 */

const logger = require('../../utils/logger');
const supabaseAdmin = require('../../config/supabaseAdmin');
const { computeAddressHash } = require('../../utils/normalizeAddress');
const addressConfig = require('../../config/addressVerification');

/** @typedef {import('./types').NormalizedAddress} NormalizedAddress */
/** @typedef {import('./types').SmartyPostalResult} SmartyPostalResult */

const API_BASE = 'https://us-street.api.smarty.com/street-address';

function buildSmartyBasicAuthHeader(authId, authToken) {
  return `Basic ${Buffer.from(`${authId}:${authToken}`).toString('base64')}`;
}

class SmartyPostalProvider {
  constructor() {
    this.authId = addressConfig.smarty.authId;
    this.authToken = addressConfig.smarty.authToken;
    this.cacheTtlDays = addressConfig.cache.smartyCacheDays;
  }

  /**
   * Check if the provider is configured and usable.
   * @returns {boolean}
   */
  isAvailable() {
    return !!(this.authId && this.authToken);
  }

  /**
   * Verify a normalized address via Smarty, returning DPV/RDI data.
   * Checks the DB cache first; falls back to calling the Smarty API.
   * Never throws — returns an inconclusive result on errors.
   *
   * @param {NormalizedAddress} address
   * @returns {Promise<SmartyPostalResult>}
   */
  async verify(address) {
    // ── Try cache first ──────────────────────────────────────
    const cached = await this._checkCache(address);
    if (cached) return cached;

    // ── Call Smarty ──────────────────────────────────────────
    if (!this.isAvailable()) {
      logger.warn('SmartyPostalProvider: SMARTY_AUTH_ID / SMARTY_AUTH_TOKEN not configured');
      return this._inconclusive('Smarty credentials not configured');
    }

    let res;
    try {
      res = await fetch(this._buildUrl(address), {
        method: 'GET',
        headers: this._buildHeaders(),
      });
    } catch (err) {
      logger.error('SmartyPostalProvider: network error', { error: err.message });
      return this._inconclusive(`Network error: ${err.message}`);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.warn('SmartyPostalProvider: API error', {
        status: res.status,
        body: text.slice(0, 500),
      });
      return this._inconclusive(`Smarty API returned ${res.status}`);
    }

    let data;
    try {
      data = await res.json();
    } catch (err) {
      logger.error('SmartyPostalProvider: invalid JSON response', { error: err.message });
      return this._inconclusive('Invalid JSON from Smarty');
    }

    if (!Array.isArray(data) || data.length === 0) {
      logger.warn('SmartyPostalProvider: no candidates returned');
      return this._inconclusive('Smarty returned no candidates');
    }

    const result = this._parseCandidate(data[0]);

    // ── Persist to cache ─────────────────────────────────────
    await this._writeCache(address, data[0]);

    return result;
  }

  // ── Private: API ─────────────────────────────────────────────

  /**
   * Build the Smarty US Street API URL.
   *
   * @param {NormalizedAddress} addr
   * @returns {string}
   * @private
   */
  _buildUrl(addr) {
    const params = new URLSearchParams({
      street: addr.line1,
      city: addr.city,
      state: addr.state,
      zipcode: addr.zip,
      candidates: '1',
      match: 'enhanced',
    });

    if (addr.line2) params.set('secondary', addr.line2);

    return `${API_BASE}?${params}`;
  }

  _buildHeaders() {
    return {
      Accept: 'application/json',
      Authorization: buildSmartyBasicAuthHeader(this.authId, this.authToken),
    };
  }

  /**
   * Parse a single Smarty candidate into a SmartyPostalResult.
   *
   * @param {object} candidate — Smarty US Street API candidate object
   * @returns {SmartyPostalResult}
   * @private
   */
  _parseCandidate(candidate) {
    const analysis = candidate.analysis || {};

    const dpvMatchCode = analysis.dpv_match_code || '';
    const dpvFootnotes = (analysis.dpv_footnotes || '').match(/.{1,2}/g) || [];
    const footnotes = (analysis.footnotes || '').match(/.{1,2}/g) || [];
    const allFootnotes = [...new Set([...dpvFootnotes, ...footnotes])];

    const rdiRaw = (analysis.rdi || '').trim();
    let rdiType = 'unknown';
    if (rdiRaw === 'Residential') rdiType = 'residential';
    else if (rdiRaw === 'Commercial') rdiType = 'commercial';

    return {
      from_cache: false,
      inconclusive: false,
      dpv_match_code: dpvMatchCode,
      rdi_type: rdiType,
      missing_secondary: dpvFootnotes.includes('CC'),
      commercial_mailbox: analysis.dpv_cmra === 'Y',
      vacant_flag: analysis.dpv_vacant === 'Y',
      footnotes: allFootnotes,
      raw: candidate,
    };
  }

  // ── Private: Cache ───────────────────────────────────────────

  /**
   * Check if a recent Smarty result exists for this address in the DB.
   * Uses HomeAddress.address_hash + last_validated_at + validation_vendor.
   *
   * @param {NormalizedAddress} addr
   * @returns {Promise<SmartyPostalResult | null>}
   * @private
   */
  async _checkCache(addr) {
    try {
      const hash = computeAddressHash(
        addr.line1, addr.line2 || '', addr.city, addr.state, addr.zip
      );

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - this.cacheTtlDays);

      const { data, error } = await supabaseAdmin
        .from('HomeAddress')
        .select('validation_raw_response, last_validated_at')
        .eq('address_hash', hash)
        .eq('validation_vendor', 'smarty')
        .gte('last_validated_at', cutoff.toISOString())
        .order('last_validated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        logger.warn('SmartyPostalProvider: cache lookup error', { error: error.message });
        return null;
      }

      if (!data || !data.validation_raw_response) return null;

      const cached = data.validation_raw_response;
      if (!cached.smarty_candidate) return null;

      logger.info('SmartyPostalProvider: returning cached result', {
        hash,
        validated_at: data.last_validated_at,
      });

      const result = this._parseCandidate(cached.smarty_candidate);
      result.from_cache = true;
      delete result.raw; // omit raw payload from cache hits
      return result;
    } catch (err) {
      logger.warn('SmartyPostalProvider: cache check failed', { error: err.message });
      return null;
    }
  }

  /**
   * Write the Smarty result to HomeAddress.validation_raw_response
   * for future cache hits. Updates the row matched by address_hash.
   *
   * @param {NormalizedAddress} addr
   * @param {object} smartyCandidate — raw Smarty candidate object
   * @private
   */
  async _writeCache(addr, smartyCandidate) {
    try {
      const hash = computeAddressHash(
        addr.line1, addr.line2 || '', addr.city, addr.state, addr.zip
      );

      const { error } = await supabaseAdmin
        .from('HomeAddress')
        .update({
          validation_raw_response: { smarty_candidate: smartyCandidate },
          validation_vendor: 'smarty',
          last_validated_at: new Date().toISOString(),
        })
        .eq('address_hash', hash);

      if (error) {
        logger.warn('SmartyPostalProvider: cache write error', { error: error.message });
      }
    } catch (err) {
      logger.warn('SmartyPostalProvider: cache write failed', { error: err.message });
    }
  }

  // ── Private: Fallback ────────────────────────────────────────

  /**
   * Build an inconclusive result for when Smarty is unreachable or errored.
   *
   * @param {string} reason
   * @returns {SmartyPostalResult}
   * @private
   */
  _inconclusive(reason) {
    logger.info('SmartyPostalProvider: inconclusive', { reason });
    return {
      from_cache: false,
      inconclusive: true,
      dpv_match_code: '',
      rdi_type: 'unknown',
      missing_secondary: false,
      commercial_mailbox: false,
      vacant_flag: false,
      footnotes: [],
    };
  }
}

module.exports = new SmartyPostalProvider();
