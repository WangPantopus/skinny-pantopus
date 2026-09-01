/**
 * Postcard code helpers.
 *
 * Shared by the residency-claim cold-start paths (routes/home.js) and the
 * legacy postcard endpoint (routes/homeOwnership.js), which previously each
 * wrote a HomePostcardCode row, returned a message promising the code had been
 * mailed, and dispatched nothing. No dispatcher existed anywhere in the
 * repository (audit 2026-08-22, UX-01/SCN-02).
 */

const crypto = require('crypto');
const logger = require('./logger');
const mailVendorService = require('../services/addressValidation/mailVendorService');
const addressConfig = require('../config/addressVerification');

/**
 * Generate a postcard verification code.
 *
 * Six digits, matching every code-entry field in the product. The cold-start
 * paths used to mint 8-character alphanumeric codes that no client could
 * accept, because each strips non-digits and caps input at six.
 */
function generatePostcardCode() {
  return String(crypto.randomInt(100000, 1000000));
}

/** SHA-256 of a postcard code. Only the hash is ever persisted (migration 187). */
function hashPostcardCode(code) {
  return crypto.createHash('sha256').update(String(code).toUpperCase()).digest('hex');
}

/**
 * Mail a postcard code to a home's address.
 *
 * The code is passed in memory and never persisted alongside its hash.
 *
 * @param {{address: string, address2?: string, city: string, state: string, zipcode: string}} home
 * @param {string} code
 * @returns {Promise<{success: boolean, vendorJobId?: string, error?: string}>}
 */
async function dispatchPostcardCode(home, code) {
  if (!home || !home.address || !home.city || !home.state || !home.zipcode) {
    return { success: false, error: 'Home is missing a mailable address' };
  }

  try {
    const provider = mailVendorService.getProvider();
    const result = await provider.sendPostcard(
      {
        line1: home.address,
        line2: home.address2 || undefined,
        city: home.city,
        state: home.state,
        zip: home.zipcode,
      },
      code,
      addressConfig.lob.postcardTemplateId || null,
    );
    return { success: true, vendorJobId: result?.vendorJobId || null };
  } catch (err) {
    logger.error('dispatchPostcardCode: provider error', { error: err.message });
    return { success: false, error: err.message };
  }
}

module.exports = { generatePostcardCode, hashPostcardCode, dispatchPostcardCode };
