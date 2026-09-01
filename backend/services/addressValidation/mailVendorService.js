/**
 * Mail Vendor Service
 *
 * Orchestrator that selects the appropriate mail provider (Lob or Mock)
 * and manages the lifecycle of MailVerificationJob records.
 *
 * Provider selection:
 *   - LOB_API_KEY set → LobMailProvider
 *   - Otherwise       → MockMailProvider (logs code to console)
 *
 * Usage:
 *   const mailVendorService = require('./mailVendorService');
 *   await mailVendorService.dispatchPostcard(jobId);
 *   const status = await mailVendorService.pollJobStatus(vendorJobId);
 */

const logger = require('../../utils/logger');
const supabaseAdmin = require('../../config/supabaseAdmin');
const lobMailProvider = require('./lobMailProvider');
const mockMailProvider = require('./mockMailProvider');

class MailVendorService {
  /**
   * Return the active provider based on environment configuration.
   * @returns {object} provider with sendPostcard / getJobStatus methods
   */
  getProvider() {
    if (lobMailProvider.isAvailable()) {
      return lobMailProvider;
    }
    return mockMailProvider;
  }

  /**
   * Dispatch a postcard for a MailVerificationJob.
   *
   * Reads the job record, sends via the active provider, then updates
   * the job with vendor_job_id, vendor, vendor_status, and sent_at.
   *
   * @param {string} jobId - MailVerificationJob.id
   * @returns {Promise<{success: boolean, error?: string, vendorJobId?: string}>}
   */
  async dispatchPostcard(jobId) {
    // ── 1. Fetch the job ────────────────────────────────────
    const { data: job, error: jobErr } = await supabaseAdmin
      .from('MailVerificationJob')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();

    if (jobErr || !job) {
      logger.error('MailVendorService.dispatchPostcard: job not found', { jobId, error: jobErr?.message });
      return { success: false, error: 'Mail verification job not found' };
    }

    if (job.vendor_job_id) {
      logger.warn('MailVendorService.dispatchPostcard: already dispatched', { jobId, vendorJobId: job.vendor_job_id });
      return { success: true, vendorJobId: job.vendor_job_id };
    }

    // ── 2. Fetch the address ────────────────────────────────
    const { data: attempt } = await supabaseAdmin
      .from('AddressVerificationAttempt')
      .select('address_id')
      .eq('id', job.attempt_id)
      .maybeSingle();

    if (!attempt) {
      return { success: false, error: 'Verification attempt not found' };
    }

    const { data: address } = await supabaseAdmin
      .from('HomeAddress')
      .select('address_line1_norm, address_line2_norm, city_norm, state, postal_code')
      .eq('id', attempt.address_id)
      .maybeSingle();

    if (!address) {
      return { success: false, error: 'Address not found' };
    }

    const normalizedAddress = {
      line1: address.address_line1_norm,
      line2: address.address_line2_norm || job.metadata?.unit || undefined,
      city: address.city_norm,
      state: address.state,
      zip: address.postal_code,
    };

    // ── 3. Extract code from job metadata ───────────────────
    const code = job.metadata?.code;
    if (!code) {
      return { success: false, error: 'Verification code not found in job metadata' };
    }

    // ── 4. Send via provider ────────────────────────────────
    const provider = this.getProvider();
    const providerName = lobMailProvider.isAvailable() ? 'lob' : 'mock';

    let result;
    try {
      result = await provider.sendPostcard(normalizedAddress, code, job.template_id);
    } catch (err) {
      logger.error('MailVendorService.dispatchPostcard: provider error', {
        jobId,
        provider: providerName,
        error: err.message,
      });

      // Mark job as failed
      await supabaseAdmin
        .from('MailVerificationJob')
        .update({
          vendor: providerName,
          vendor_status: 'failed',
          metadata: { ...job.metadata, dispatch_error: err.message },
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      return { success: false, error: `Mail provider error: ${err.message}` };
    }

    // ── 5. Update job record ────────────────────────────────
    const { error: updateErr } = await supabaseAdmin
      .from('MailVerificationJob')
      .update({
        vendor: providerName,
        vendor_job_id: result.vendorJobId,
        vendor_status: result.status,
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (updateErr) {
      logger.error('MailVendorService.dispatchPostcard: job update failed', {
        jobId,
        error: updateErr.message,
      });
    }

    // ── 6. Update attempt status to 'sent' ──────────────────
    await supabaseAdmin
      .from('AddressVerificationAttempt')
      .update({ status: 'sent', updated_at: new Date().toISOString() })
      .eq('id', job.attempt_id)
      .in('status', ['created']); // only transition from 'created'

    logger.info('MailVendorService.dispatchPostcard: sent', {
      jobId,
      provider: providerName,
      vendorJobId: result.vendorJobId,
    });

    return { success: true, vendorJobId: result.vendorJobId };
  }

  /**
   * Poll the vendor for the current status of a postcard.
   *
   * @param {string} vendorJobId
   * @returns {Promise<{status: string, metadata: object}>}
   */
  async pollJobStatus(vendorJobId) {
    const provider = this.getProvider();
    return provider.getJobStatus(vendorJobId);
  }

  /**
   * Process a webhook event from the mail vendor.
   *
   * Updates MailVerificationJob.vendor_status and optionally transitions
   * AddressVerificationAttempt.status based on delivery tracking.
   *
   * @param {string} vendorJobId
   * @param {string} eventType - e.g. 'postcard.delivered', 'postcard.returned_to_sender'
   * @param {object} eventData - full webhook event payload
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async processWebhookEvent(vendorJobId, eventType, eventData) {
    // ── 1. Find the job by vendor_job_id ────────────────────
    const { data: job, error: jobErr } = await supabaseAdmin
      .from('MailVerificationJob')
      .select('*')
      .eq('vendor_job_id', vendorJobId)
      .maybeSingle();

    if (jobErr || !job) {
      logger.warn('MailVendorService.processWebhookEvent: job not found', {
        vendorJobId,
        eventType,
      });
      return { success: false, error: 'Job not found for vendor_job_id' };
    }

    // ── 2. Map event type to vendor_status ──────────────────
    const statusMap = {
      'postcard.created': 'created',
      'postcard.rendered_pdf': 'rendered',
      'postcard.rendered_thumbnails': 'rendered',
      'postcard.deleted': 'canceled',
      'postcard.delivered': 'delivered',
      'postcard.failed': 'failed',
      'postcard.re-routed': 'rerouted',
      'postcard.returned_to_sender': 'returned',
      'postcard.mailed': 'mailed',
      'postcard.in_transit': 'in_transit',
      'postcard.in_local_area': 'in_local_area',
      'postcard.international_exit': 'in_transit',
      'postcard.processed_for_delivery': 'out_for_delivery',
    };

    const newStatus = statusMap[eventType] || 'unknown';

    // ── 3. Update job ───────────────────────────────────────
    await supabaseAdmin
      .from('MailVerificationJob')
      .update({
        vendor_status: newStatus,
        metadata: {
          ...job.metadata,
          last_webhook_event: eventType,
          last_webhook_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    // ── 4. Transition attempt status on key events ──────────
    if (eventType === 'postcard.delivered') {
      await supabaseAdmin
        .from('AddressVerificationAttempt')
        .update({ status: 'delivered_unknown', updated_at: new Date().toISOString() })
        .eq('id', job.attempt_id)
        .in('status', ['created', 'sent']);
    }

    if (eventType === 'postcard.returned_to_sender') {
      await supabaseAdmin
        .from('AddressVerificationAttempt')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', job.attempt_id)
        .in('status', ['created', 'sent', 'delivered_unknown']);
    }

    logger.info('MailVendorService.processWebhookEvent: processed', {
      jobId: job.id,
      vendorJobId,
      eventType,
      newStatus,
    });

    return { success: true };
  }
}

module.exports = new MailVendorService();
module.exports.MailVendorService = MailVendorService;
