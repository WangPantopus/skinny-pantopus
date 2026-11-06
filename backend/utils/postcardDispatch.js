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
const supabaseAdmin = require('../config/supabaseAdmin');
const mailVendorService = require('../services/addressValidation/mailVendorService');
const { noMailToDestination } = require('../services/addressValidation/mailSuppression');
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
async function dispatchPostcardCode(home, code, homePostcardId, homeId) {
  if (!homePostcardId || !homeId) return { success: false, deliveryUnknown: false, error: 'Postcard admission is required' };
  if (!home || !home.address || !home.city || !home.state || !home.zipcode) {
    return { success: false, deliveryUnknown: false, error: 'Home is missing a mailable address' };
  }

  if (!mailVendorService.canSendPostcards()) {
    return { success: false, deliveryUnknown: false, error: 'Mail provider is not configured' };
  }

  const destination = {
    line1: home.address,
    line2: home.address2 || undefined,
    city: home.city,
    state: home.state,
    zip: home.zipcode,
  };
  // Suppression runs before every send. A refusal says nothing about why.
  if (await noMailToDestination(destination)) {
    return { success: false, deliveryUnknown: false, error: 'Mail could not be sent to this address' };
  }

  const provider = mailVendorService.getProvider('home_postcard');
  // A piece finishes with the printer that accepted it, so the printer goes on
  // the row before it is called. Without that record there is no send.
  const { error: intentError } = await supabaseAdmin.from('HomePostcardCode')
    .update({ mail_provider: provider.name }).eq('id', homePostcardId);
  if (intentError) {
    logger.error('dispatchPostcardCode: printer could not be recorded', { error: intentError.message });
    return { success: false, deliveryUnknown: false, error: 'Mail could not be sent right now' };
  }

  try {
    const result = await provider.sendPostcard(
      destination,
      code,
      addressConfig.lob.postcardTemplateId || null,
      { homePostcardId, homeId },
    );
    mailVendorService.noteSendResult(provider.name, true);
    if (!result?.vendorJobId) return { success: false, deliveryUnknown: true, error: 'Mail receipt is not confirmed' };
    return { success: true, vendorJobId: result.vendorJobId };
  } catch (err) {
    mailVendorService.noteSendResult(provider.name, err.definitelyRejected === true);
    logger.error('dispatchPostcardCode: provider error', { definitelyRejected: err.definitelyRejected === true });
    return { success: false, deliveryUnknown: err.definitelyRejected !== true, error: 'Mail provider did not confirm delivery' };
  }
}

module.exports = { generatePostcardCode, hashPostcardCode, dispatchPostcardCode };
