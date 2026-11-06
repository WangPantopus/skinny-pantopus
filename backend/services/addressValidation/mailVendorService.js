/**
 * Mail Vendor Service
 *
 * The one door to every printer. Selects the printer for a new piece, finishes
 * each piece with the printer that accepted it, and manages the lifecycle of
 * MailVerificationJob records.
 *
 * Printer selection for a new piece:
 *   - MAIL_PROVIDER_<FLOW> names the printer for one flow (home_postcard,
 *     address_verification, block_founders), else MAIL_PROVIDER for all of them
 *   - Nothing set: Lob when configured, otherwise in local development the mock
 *     (logs code to console), otherwise in hosted environments Lob, which refuses to send
 *   - MAIL_FAILOVER_PROVIDER, when set, takes NEW pieces while the chosen printer keeps
 *     failing. Off by default. A piece already handed to a printer never moves.
 *   - BLOCK_FOUNDERS_MAIL_ENABLED=false stops invitations alone
 *
 * Usage:
 *   const mailVendorService = require('./mailVendorService');
 *   await mailVendorService.dispatchPostcard(jobId, code);
 *   const status = await mailVendorService.pollJobStatus(vendorJobId);
 */

const logger = require('../../utils/logger');
const { destinationFor, sameDestination } = require('./mailDestination');
const { noMailToDestination } = require('./mailSuppression');
const supabaseAdmin = require('../../config/supabaseAdmin');
const lobMailProvider = require('./lobMailProvider');
const mockMailProvider = require('./mockMailProvider');
const observability = require('./addressVerificationObservability');

const PROVIDERS = { lob: lobMailProvider, mock: mockMailProvider };
const FLOW_SETTINGS = {
  home_postcard: 'MAIL_PROVIDER_HOME_POSTCARD',
  address_verification: 'MAIL_PROVIDER_ADDRESS_VERIFICATION',
  block_founders: 'MAIL_PROVIDER_BLOCK_FOUNDERS',
};
const FAILOVER_AFTER_FAILURES = 3;
const FAILOVER_WINDOW_MS = 5 * 60 * 1000;

const isHosted = () => process.env.NODE_ENV === 'production' || ['staging', 'production'].includes(process.env.APP_ENV);

class MailVendorService {
  constructor() {
    /** Consecutive unanswered sends per printer, in this process. */
    this.sendFailures = new Map();
  }

  /** @returns {object} the printer used when nothing names one */
  _defaultProvider() {
    return lobMailProvider.isAvailable() || isHosted() ? lobMailProvider : mockMailProvider;
  }

  /** The mock prints codes to the log, so a hosted server never selects it. */
  _namedProvider(name) {
    const provider = PROVIDERS[name];
    if (!provider || (provider === mockMailProvider && isHosted())) {
      logger.error('MailVendorService: ignoring unusable printer setting', { name });
      return this._defaultProvider();
    }
    return provider;
  }

  _configuredProvider(flow) {
    const name = (flow && process.env[FLOW_SETTINGS[flow]]) || process.env.MAIL_PROVIDER;
    return name ? this._namedProvider(name) : this._defaultProvider();
  }

  /**
   * Return the printer for a new piece.
   * @param {'home_postcard'|'address_verification'|'block_founders'} [flow]
   * @returns {object} provider with sendPostcard / sendCustomPostcard / findPieces / getJobStatus methods
   */
  getProvider(flow) {
    const chosen = this._configuredProvider(flow);
    const fallback = PROVIDERS[process.env.MAIL_FAILOVER_PROVIDER];
    return fallback && fallback !== chosen && fallback.isAvailable() && this._isFailing(chosen.name) ? fallback : chosen;
  }

  /**
   * The printer a piece belongs to. A piece always finishes with the printer that
   * accepted it; rows from before printers were recorded go by the receipt's prefix.
   * @param {string|null} name - the row's stored printer
   * @param {string|null} [vendorJobId]
   * @returns {object}
   */
  providerForPiece(name, vendorJobId) {
    if (name && PROVIDERS[name]) return PROVIDERS[name];
    if (typeof vendorJobId === 'string' && vendorJobId.startsWith('mock_')) return mockMailProvider;
    return typeof vendorJobId === 'string' && vendorJobId.startsWith('psc_') ? lobMailProvider : this._defaultProvider();
  }

  /** A send that got no answer counts toward failover. A refusal is an answer. */
  noteSendResult(name, answered) {
    if (answered) {
      this.sendFailures.delete(name);
      return;
    }
    const failures = this.sendFailures.get(name);
    this.sendFailures.set(name, { count: (failures?.count || 0) + 1, at: Date.now() });
  }

  _isFailing(name) {
    const failures = this.sendFailures.get(name);
    return !!failures && failures.count >= FAILOVER_AFTER_FAILURES && Date.now() - failures.at < FAILOVER_WINDOW_MS;
  }

  /** The switch that stops invitations alone; verification cards keep going. */
  blockFoundersMailEnabled() {
    return String(process.env.BLOCK_FOUNDERS_MAIL_ENABLED).toLowerCase() !== 'false';
  }

  /**
   * Postcards can go out here: the printer is configured, or this is local development,
   * whose mock prints the code. A hosted server without one (production while
   * DEFER_ADDRESS_PROVIDER_SETUP holds) refuses to send them.
   * @returns {boolean}
   */
  canSendPostcards() {
    return !isHosted() || this._configuredProvider().isAvailable();
  }

  /**
   * Dispatch a postcard for a MailVerificationJob.
   *
   * Reads the job record, sends via the active provider, then updates
   * the job with vendor_job_id, vendor, vendor_status, and sent_at.
   *
   * The verification code is passed in memory by the caller and is never
   * persisted: storing it alongside the hash would defeat the hash, because
   * RLS lets the requesting user read their own MailVerificationJob row.
   *
   * @param {string} jobId - MailVerificationJob.id
   * @param {string} [code] - the plaintext code, held only for this call
   * @returns {Promise<{success: boolean, error?: string, vendorJobId?: string}>}
   */
  async dispatchPostcard(jobId, code) {
    if (!this.canSendPostcards()) {
      return { success: false, deliveryUnknown: false, error: 'Mail provider is not configured' };
    }

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
    // Once dispatch starts, neither another worker nor a later request may
    // blindly send again. The first worker performs bounded keyed retries;
    // an interrupted worker leaves a durable, reconcilable outcome.
    if (job.vendor_status !== 'pending') {
      return { success: false, deliveryUnknown: true, error: 'Mail delivery is not yet confirmed' };
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

    const destination = destinationFor(address, job.metadata?.unit);
    if (!destination) {
      return { success: false, error: 'Requested unit does not match the canonical address' };
    }
    if (job.metadata?.destination && !sameDestination(job.metadata.destination, destination)) {
      return { success: false, error: 'Mailing destination changed; request was not dispatched' };
    }
    const normalizedAddress = { ...destination, line2: destination.line2 || undefined };

    // ── 3. Resolve the code ─────────────────────────────────
    // Supplied by the caller. Legacy rows created before the code was removed
    // from metadata still carry one; accept it so in-flight jobs drain, but
    // record that it happened.
    let effectiveCode = code;
    if (!effectiveCode && job.metadata?.code) {
      effectiveCode = job.metadata.code;
      logger.warn('MailVendorService.dispatchPostcard: using legacy persisted code', { jobId });
    }
    if (!effectiveCode) {
      return { success: false, error: 'Verification code not supplied for dispatch' };
    }

    // Suppression runs before every send. A refusal says nothing about why.
    if (await noMailToDestination(destination)) {
      return { success: false, deliveryUnknown: false, error: 'Mail could not be sent to this address' };
    }

    // ── 4. Send via provider ────────────────────────────────
    const provider = this.getProvider('address_verification');
    const providerName = provider.name;

    // Merge only dispatch fields into the current row. Replacing the metadata
    // read above could erase a concurrent confirmation's membership binding.
    const { data: claimed, error: claimError } = await supabaseAdmin.rpc('claim_mail_verification_dispatch', {
      p_job_id: jobId,
      p_vendor: providerName,
      p_destination: destination,
      p_expected_unit: job.metadata?.unit ?? null,
      p_expected_destination: job.metadata?.destination ?? null,
    });
    if (claimError || claimed !== true) {
      return { success: false, deliveryUnknown: true, error: 'Mail dispatch could not be claimed' };
    }

    let result;
    try {
      result = await provider.sendPostcard(normalizedAddress, effectiveCode, job.template_id, { jobId });
      this.noteSendResult(providerName, true);
    } catch (err) {
      this.noteSendResult(providerName, err.definitelyRejected === true);
      logger.error('MailVendorService.dispatchPostcard: provider error', {
        jobId,
        provider: providerName,
        definitelyRejected: err.definitelyRejected === true,
      });

      // A network error is not evidence that no postcard was accepted. Keep
      // the token valid and the job available to the signed vendor webhook.
      await supabaseAdmin
        .from('MailVerificationJob')
        .update({
          vendor: providerName,
          vendor_status: err.definitelyRejected === true ? 'rejected' : 'delivery_unknown',
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      return {
        success: false,
        deliveryUnknown: err.definitelyRejected !== true,
        error: 'Mail provider did not confirm delivery',
      };
    }

    // ── 5. Update job record ────────────────────────────────
    const { data: saved, error: updateErr } = await supabaseAdmin
      .from('MailVerificationJob')
      .update({
        vendor: providerName,
        vendor_job_id: result.vendorJobId,
        vendor_status: result.status,
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .select('id');

    if (updateErr || !saved?.length) {
      logger.error('MailVendorService.dispatchPostcard: job update failed', {
        jobId,
        error: updateErr?.message,
      });
      return { success: false, deliveryUnknown: true, error: 'Mail receipt could not be saved' };
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
    return this.providerForPiece(null, vendorJobId).getJobStatus(vendorJobId);
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
    let { data: job, error: jobErr } = await supabaseAdmin
      .from('MailVerificationJob')
      .select('*')
      .eq('vendor_job_id', vendorJobId)
      .maybeSingle();

    // The signed Lob event carries our job ID even if its original HTTP
    // receipt was lost. Bind only an unresolved Lob job, never overwrite a
    // different receipt or use untrusted client-supplied correlation data.
    const correlationId = eventData?.body?.metadata?.pantopus_verification_job_id;
    if (!jobErr && !job && typeof correlationId === 'string'
      && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(correlationId)
      && eventData?.body?.id === vendorJobId && eventData?.body?.object === 'postcard') {
      const recovered = await supabaseAdmin.from('MailVerificationJob')
        .update({ vendor_job_id: vendorJobId, sent_at: new Date().toISOString() })
        .eq('id', correlationId).eq('vendor', 'lob').is('vendor_job_id', null)
        .in('vendor_status', ['dispatching', 'delivery_unknown'])
        .select('*').maybeSingle();
      job = recovered.data;
      jobErr = recovered.error;
    }

    if (jobErr || !job) {
      logger.warn('MailVendorService.processWebhookEvent: job not found', {
        vendorJobId,
        eventType,
      });
      return { success: false, retryable: !!jobErr, error: 'Job not found for vendor_job_id' };
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
    // The RPC merges into the row while holding its update lock, preserving
    // confirmation IDs (and other metadata) added since the lookup above.
    const { data: statusSaved, error: statusError } = await supabaseAdmin.rpc('record_mail_verification_webhook', {
      p_job_id: job.id,
      p_vendor_job_id: vendorJobId,
      p_event_type: eventType,
      p_vendor_status: newStatus,
    });
    if (statusError || statusSaved !== true) return { success: false, retryable: true, error: 'Could not save mail status' };

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

    // The delivery signal was previously collected from Lob and discarded.
    await observability.recordMailLifecycleEvent({
      step: 'vendor_status',
      status: newStatus,
      attemptId: job.attempt_id,
      vendor: job.vendor || null,
      detail: { event_type: eventType },
    });

    return { success: true };
  }
}

module.exports = new MailVendorService();
module.exports.MailVendorService = MailVendorService;
