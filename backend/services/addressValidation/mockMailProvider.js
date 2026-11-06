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
    this.name = 'mock';
    /** Stores every "sent" postcard for test assertions. */
    this.sentPostcards = [];
  }

  /** A repeat of the same reference returns the first piece, like a printer's repeat key. */
  _repeat(metadata) {
    if (!metadata) return null;
    const [[key, value]] = Object.entries(metadata);
    return this.sentPostcards.find((p) => p.metadata?.[key] === value) || null;
  }

  /** Dev-mode counterpart of LobMailProvider.findPieces. */
  async findPieces(metadataKey, metadataValue) {
    return this.sentPostcards
      .filter((p) => p.metadata?.[metadataKey] === metadataValue)
      .map((p) => ({ vendorJobId: p.vendorJobId, status: 'created' }));
  }

  /** Dev-mode counterpart of LobMailProvider.cancelPiece. */
  async cancelPiece(vendorJobId) {
    const before = this.sentPostcards.length;
    this.sentPostcards = this.sentPostcards.filter((p) => p.vendorJobId !== vendorJobId);
    return this.sentPostcards.length < before;
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
  /** Dev-mode counterpart of LobMailProvider.sendCustomPostcard. */
  async sendCustomPostcard(address, card, options = {}) {
    const metadata = options.inviteId ? { pantopus_block_invite_id: options.inviteId } : null;
    const repeat = this._repeat(metadata);
    if (repeat) return { vendorJobId: repeat.vendorJobId, status: 'created' };
    const vendorJobId = `mock_psc_${crypto.randomBytes(8).toString('hex')}`;
    this.sentPostcards.push({
      vendorJobId,
      address,
      metadata,
      description: (card && card.description) || 'Pantopus postcard',
      sentAt: new Date().toISOString(),
    });
    logger.info('MockMailProvider: custom postcard "sent" (dev mode)', {
      vendorJobId,
      to: `${address.line1}, ${address.city}, ${address.state} ${address.zip}`,
    });
    return { vendorJobId, status: 'created' };
  }

  async sendPostcard(address, code, templateId, options = {}) {
    const metadata = options.homePostcardId ? { pantopus_home_postcard_id: options.homePostcardId }
      : options.jobId ? { pantopus_verification_job_id: options.jobId } : null;
    const repeat = this._repeat(metadata);
    if (repeat) return { vendorJobId: repeat.vendorJobId, status: 'sent' };
    const vendorJobId = `mock_psc_${crypto.randomBytes(8).toString('hex')}`;

    const record = {
      vendorJobId,
      address,
      metadata,
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
