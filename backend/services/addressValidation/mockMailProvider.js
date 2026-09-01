/**
 * Mock Mail Provider
 *
 * Local development replacement for LobMailProvider. Logs the
 * verification code to the console and returns a fake job ID
 * with 'sent' status immediately.
 *
 * Useful for:
 *   - Local development without a Lob account
 *   - Integration tests that shouldn't hit external APIs
 *   - CI/CD pipelines
 */

const crypto = require('crypto');
const logger = require('../../utils/logger');

class MockMailProvider {
  constructor() {
    /** Stores every "sent" postcard for test assertions. */
    this.sentPostcards = [];
  }

  isAvailable() {
    return true;
  }

  /**
   * Simulate sending a postcard.
   * Logs the code, stores the record, and returns immediately.
   *
   * @param {object} address - NormalizedAddress { line1, line2?, city, state, zip }
   * @param {string} code    - 6-digit verification code
   * @param {string} [templateId]
   * @returns {Promise<{vendorJobId: string, status: string}>}
   */
  async sendPostcard(address, code, templateId) {
    const vendorJobId = `mock_psc_${crypto.randomBytes(8).toString('hex')}`;

    const record = {
      vendorJobId,
      address,
      code,
      templateId: templateId || null,
      sentAt: new Date().toISOString(),
    };

    this.sentPostcards.push(record);

    logger.info('MockMailProvider: postcard "sent" (dev mode)', {
      vendorJobId,
      code,
      to: `${address.line1}, ${address.city}, ${address.state} ${address.zip}`,
    });

    // Also log prominently so developers can grab the code easily
    logger.info(`\n========================================`);
    logger.info(`  MOCK VERIFICATION CODE: ${code}`);
    logger.info(`  To: ${address.line1}${address.line2 ? ', ' + address.line2 : ''}`);
    logger.info(`      ${address.city}, ${address.state} ${address.zip}`);
    logger.info(`========================================\n`);

    return {
      vendorJobId,
      status: 'sent',
    };
  }

  /**
   * Simulate checking job status.
   * Mock postcards are always "delivered".
   *
   * @param {string} vendorJobId
   * @returns {Promise<{status: string, metadata: object}>}
   */
  async getJobStatus(vendorJobId) {
    const record = this.sentPostcards.find((p) => p.vendorJobId === vendorJobId);

    return {
      status: record ? 'delivered' : 'unknown',
      metadata: {
        id: vendorJobId,
        mock: true,
        sentAt: record?.sentAt || null,
      },
    };
  }

  /**
   * Reset stored postcards (for test cleanup).
   */
  reset() {
    this.sentPostcards = [];
  }
}

module.exports = new MockMailProvider();
module.exports.MockMailProvider = MockMailProvider;
