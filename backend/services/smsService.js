/**
 * SMS Service (Placeholder)
 *
 * Logs SMS messages in development. In production, this should be
 * wired to Twilio, AWS SNS, or another SMS provider.
 *
 * Required env vars for production (future):
 *   SMS_PROVIDER, SMS_API_KEY, SMS_FROM_NUMBER
 */

const logger = require('../utils/logger');

/**
 * Send an SMS message.
 * Currently a placeholder — logs the message instead of sending.
 *
 * @param {Object} opts
 * @param {string} opts.to - Recipient phone number (E.164 format)
 * @param {string} opts.body - Message text
 * @returns {Promise<{ success: boolean, messageId?: string }>}
 */
async function sendSms({ to, body }) {
  logger.info('📱 [SMS] Would send SMS:', { to, body });
  return { success: true, messageId: `sms-placeholder-${Date.now()}` };
}

module.exports = { sendSms };
