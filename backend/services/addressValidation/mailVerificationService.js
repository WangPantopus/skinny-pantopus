/**
 * Mail Verification Service
 *
 * Manages the complete mail-based address verification lifecycle:
 *   startVerification(userId, addressId, unit?)   — initiate
 *   resendCode(attemptId, userId)                 — resend with new code
 *   getVerificationStatus(attemptId, userId)      — fetch public status metadata
 *   confirmCode(attemptId, code, userId)          — verify code entry
 *
 * Uses three tables:
 *   AddressVerificationAttempt — tracks each verification lifecycle
 *   AddressVerificationToken   — stores hashed codes with rate-limiting
 *   MailVerificationJob        — tracks vendor mail fulfillment
 *
 * Code hashing uses SHA-256 with a constant-time comparison (matching
 * the existing postcard verification pattern in homeOwnership.js).
 */

const crypto = require('crypto');
const logger = require('../../utils/logger');
const supabaseAdmin = require('../../config/supabaseAdmin');
const addressConfig = require('../../config/addressVerification');
const mailVendorService = require('./mailVendorService');
const observability = require('./addressVerificationObservability');
const { unitKey, destinationFor, destinationForHome, sameDestination } = require('./mailDestination');

// ── Constants (from config, with env-var overrides) ──────────

const mv = addressConfig.mailVerification;

/** How long a verification code remains valid. */
const CODE_EXPIRY_DAYS = mv.codeExpiryDays;

/** Cooldown period after a resend. */
const RESEND_COOLDOWN_HOURS = mv.cooldownHours;

/** Max resends per attempt. */
const MAX_RESENDS = mv.maxResends;

/** Max code entry attempts before lockout. */
const MAX_ATTEMPTS = mv.maxAttempts;

/** Per-user rate limit: max starts within the window. */
const USER_RATE_LIMIT = mv.userRateLimit;
const USER_RATE_WINDOW_HOURS = mv.userRateWindowHours;

/** Per-address rate limit: max attempts within the window. */
const ADDRESS_RATE_LIMIT = mv.addressRateLimit;
const ADDRESS_RATE_WINDOW_DAYS = mv.addressRateWindowDays;

/** Max attempts one user may make against one address inside the address window. */
const USER_ADDRESS_RATE_LIMIT = mv.userAddressRateLimit;

/** Active attempt statuses (not terminal). */
const ACTIVE_STATUSES = ['created', 'sent', 'delivered_unknown'];

class MailVerificationService {
  async _deleteAttemptArtifacts(attemptId) {
    if (!attemptId) return;

    await supabaseAdmin
      .from('MailVerificationJob')
      .delete()
      .eq('attempt_id', attemptId);

    await supabaseAdmin
      .from('AddressVerificationToken')
      .delete()
      .eq('attempt_id', attemptId);

    await supabaseAdmin
      .from('AddressVerificationAttempt')
      .delete()
      .eq('id', attemptId);
  }

  async _dispatchVerificationJob(jobId, code, context = {}) {
    if (!jobId) {
      return { success: false, error: 'Mail verification job not found' };
    }

    try {
      return await mailVendorService.dispatchPostcard(jobId, code);
    } catch (error) {
      logger.error('MailVerificationService: dispatch failed unexpectedly', {
        ...context,
        jobId,
        error: error.message,
      });
      return { success: false, deliveryUnknown: true, error: 'Mail dispatch outcome is unknown' };
    }
  }

  _deliveryUnknown(attemptId, addressId) {
    return {
      success: false,
      statusCode: 503,
      delivery_unknown: true,
      verification_id: attemptId,
      address_id: addressId,
      error: 'Mail delivery is not confirmed yet. Your verification is saved. '
        + 'If the postcard arrives, its code will still work. Please check again before requesting more mail.',
    };
  }

  async _latestMailJob(attemptId) {
    const { data, error } = await supabaseAdmin.from('MailVerificationJob')
      .select('*').eq('attempt_id', attemptId)
      .order('created_at', { ascending: false }).limit(MAX_RESENDS + 1);
    // Resend number breaks ties when two jobs share the same timestamp.
    const jobs = (data || []).sort((a, b) =>
      (b.metadata?.resend_number || 0) - (a.metadata?.resend_number || 0)
      || new Date(b.created_at) - new Date(a.created_at));
    return { job: jobs[0], error };
  }

  async _existingVerification(userId, addressId, unit) {
    const { data: attempts, error } = await supabaseAdmin
      .from('AddressVerificationAttempt')
      .select('*')
      .eq('user_id', userId)
      .eq('address_id', addressId)
      .eq('method', 'mail_code')
      .in('status', ACTIVE_STATUSES)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) return { success: false, statusCode: 503, error: 'Unable to check existing mail verification' };
    const attempt = attempts?.[0];
    if (!attempt) return null;
    const { job, error: jobError } = await this._latestMailJob(attempt.id);
    if (jobError || !job) {
      return this._deliveryUnknown(attempt.id, addressId);
    }
    if ((job.metadata?.unit || '') !== (unit || '')) {
      return { success: false, statusCode: 409, error: 'A mail verification is already active. Finish it before changing the unit.' };
    }
    if (!job.vendor_job_id) return this._deliveryUnknown(attempt.id, addressId);
    return this.getVerificationStatus(attempt.id, userId);
  }

  // ================================================================
  // startVerification
  // ================================================================

  /**
   * Initiate a mail-based address verification.
   *
   * @param {string} userId
   * @param {string} addressId
   * @param {string} [unit]
   * @returns {Promise<{success: boolean, error?: string, attempt_id?: string, verification_id?: string, address_id?: string, status?: string, expires_at?: string, cooldown_until?: string, max_resends?: number, resends_remaining?: number}>}
   */
  async startVerification(userId, addressId, unit) {
    // ── 1. Validate address is deliverable ───────────────────
    const { data: address } = await supabaseAdmin
      .from('HomeAddress')
      .select('*')
      .eq('id', addressId)
      .maybeSingle();

    if (!address) {
      return { success: false, error: 'Address not found' };
    }

    const delivery = destinationFor(address, unit);
    if (!delivery) return { success: false, error: 'Requested unit does not match the canonical address' };

    // Check deliverability via stored validation data
    if (address.validation_raw_response) {
      const raw = address.validation_raw_response;
      if (raw.dpv_match_code === 'N') {
        return { success: false, error: 'Address is not deliverable' };
      }
      if (raw.missing_secondary && !delivery.line2) {
        return { success: false, error: 'Address requires a unit number' };
      }
    }

    // ── 2. Check for household authority conflict ────────────
    const conflictCheck = await this._checkHouseholdConflict(addressId, userId, delivery.line2, address.address_line2_norm);
    if (conflictCheck.blocked) {
      return { success: false, error: conflictCheck.reason };
    }

    const existing = await this._existingVerification(userId, addressId, unit);
    if (existing) return existing;

    // ── 3. User rate limit (2 starts per 24 hours) ──────────
    const userRateCheck = await this._checkUserRateLimit(userId);
    if (userRateCheck.exceeded) {
      return { success: false, error: 'Rate limit exceeded: too many verification requests. Try again later.' };
    }

    // ── 4. Address rate limit (5 attempts per 7 days) ───────
    const addressRateCheck = await this._checkAddressRateLimit(addressId);
    if (addressRateCheck.exceeded) {
      return { success: false, error: 'Rate limit exceeded: too many verification attempts for this address.' };
    }

    // ── 4b. This user's share of that address's budget ──────
    const userAddressCheck = await this._checkUserAddressRateLimit(userId, addressId);
    if (userAddressCheck.exceeded) {
      return { success: false, error: 'Rate limit exceeded: too many verification attempts for this address.' };
    }

    // ── 5. Generate code + hash ─────────────────────────────
    const code = this._generateCode();
    const codeHash = this._hashCode(code);

    // Admission and both postage budgets are atomic across API processes.
    // There is deliberately no fallback to separate inserts if the matching
    // migration is missing or its transaction fails.
    const { data: admission, error: admissionError } = await supabaseAdmin.rpc('admit_mail_verification', {
      p_user_id: userId,
      p_address_id: addressId,
      p_job_id: crypto.randomUUID(),
      p_code_hash: codeHash,
      p_unit: unit || null,
      p_template_id: addressConfig.lob.postcardTemplateId || null,
      p_policy: {
        code_expiry_days: CODE_EXPIRY_DAYS,
        cooldown_hours: RESEND_COOLDOWN_HOURS,
        max_attempts: MAX_ATTEMPTS,
        user_rate_limit: USER_RATE_LIMIT,
        user_window_hours: USER_RATE_WINDOW_HOURS,
        address_rate_limit: ADDRESS_RATE_LIMIT,
        address_window_days: ADDRESS_RATE_WINDOW_DAYS,
        user_address_rate_limit: USER_ADDRESS_RATE_LIMIT,
      },
    });
    if (admissionError || !admission) {
      logger.error('MailVerificationService.startVerification: admission failed', { userId, addressId });
      return { success: false, statusCode: 503, error: 'Failed to create mail verification job' };
    }
    if (admission.error) {
      if (admission.error === 'ADDRESS_NOT_FOUND') return { success: false, error: 'Address not found' };
      if (['USER_RATE_LIMIT', 'ADDRESS_RATE_LIMIT', 'USER_ADDRESS_RATE_LIMIT'].includes(admission.error)) {
        return { success: false, statusCode: 429, error: 'Rate limit exceeded: too many verification requests. Try again later.' };
      }
      return { success: false, statusCode: 503, error: 'Failed to create mail verification job' };
    }
    if (admission.reused) {
      return await this._existingVerification(userId, addressId, unit)
        || this._deliveryUnknown(admission.attempt_id, addressId);
    }
    const { attempt, job } = admission;
    if (!attempt?.id || !job?.id) {
      return { success: false, statusCode: 503, error: 'Failed to create mail verification job' };
    }

    const dispatchResult = await this._dispatchVerificationJob(job?.id, code, {
      attemptId: attempt.id,
      addressId,
      userId,
      mode: 'start',
    });

    if (!dispatchResult.success) {
      logger.error('MailVerificationService.startVerification: dispatch failed', {
        attemptId: attempt.id,
        jobId: job?.id || null,
        error: dispatchResult.error,
      });
      await observability.recordMailLifecycleEvent({
        step: 'dispatch',
        status: 'failed',
        addressId,
        attemptId: attempt.id,
        reasons: [dispatchResult.error || 'dispatch_failed'],
      });

      if (dispatchResult.deliveryUnknown) {
        return this._deliveryUnknown(attempt.id, addressId);
      }
      await this._deleteAttemptArtifacts(attempt.id);
      return { success: false, error: 'Failed to send verification mail' };
    }

    logger.info('MailVerificationService.startVerification: created', {
      userId, addressId, attemptId: attempt.id,
    });

    await observability.recordMailLifecycleEvent({
      step: 'start',
      status: 'ok',
      addressId,
      attemptId: attempt.id,
      detail: { unit_supplied: !!unit },
    });

    return {
      success: true,
      attempt_id: attempt.id,
      verification_id: attempt.id,
      address_id: addressId,
      status: 'pending',
      expires_at: attempt.expires_at,
      cooldown_until: admission.cooldown_until,
      max_resends: MAX_RESENDS,
      resends_remaining: MAX_RESENDS,
    };
  }

  // ================================================================
  // resendCode
  // ================================================================

  /**
   * Resend a verification code with a new code value.
   *
   * @param {string} attemptId
   * @param {string} userId
   * @returns {Promise<{success: boolean, error?: string, verification_id?: string, address_id?: string, status?: string, expires_at?: string, new_expires_at?: string, cooldown_until?: string, max_resends?: number, resends_remaining?: number}>}
   */
  async resendCode(attemptId, userId) {
    // ── 1. Verify attempt belongs to user ────────────────────
    const { data: attempt } = await supabaseAdmin
      .from('AddressVerificationAttempt')
      .select('*')
      .eq('id', attemptId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!attempt) {
      return { success: false, error: 'Verification attempt not found' };
    }

    const attemptExpiredByTime =
      ACTIVE_STATUSES.includes(attempt.status) &&
      attempt.expires_at &&
      new Date(attempt.expires_at) < new Date();
    const allowExpiredRecovery =
      attempt.status === 'expired' || attemptExpiredByTime;

    if (!ACTIVE_STATUSES.includes(attempt.status) && !allowExpiredRecovery) {
      return { success: false, error: `Cannot resend: attempt is ${attempt.status}` };
    }

    // ── 2. Fetch token ───────────────────────────────────────
    const { data: token } = await supabaseAdmin
      .from('AddressVerificationToken')
      .select('*')
      .eq('attempt_id', attemptId)
      .maybeSingle();

    if (!token) {
      return { success: false, error: 'Verification token not found' };
    }

    const { job: previousJob, error: jobsError } = await this._latestMailJob(attemptId);
    if (jobsError || (previousJob && !previousJob.vendor_job_id)) {
      return this._deliveryUnknown(attemptId, attempt.address_id);
    }

    // ── 3. Check cooldown ────────────────────────────────────
    if (token.cooldown_until && new Date(token.cooldown_until) > new Date()) {
      return {
        success: false,
        error: 'Cooldown period has not passed',
        cooldown_until: token.cooldown_until,
      };
    }

    // ── 4. Check resend count ────────────────────────────────
    if (token.resend_count >= MAX_RESENDS) {
      return { success: false, error: 'Maximum resend limit reached' };
    }

    // ── 5. Generate new code + hash ──────────────────────────
    const newCode = this._generateCode();
    const newCodeHash = this._hashCode(newCode);
    const newCooldownUntil = new Date(Date.now() + RESEND_COOLDOWN_HOURS * 60 * 60 * 1000);
    const nextExpiresAt = allowExpiredRecovery
      ? new Date(Date.now() + CODE_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
      : new Date(attempt.expires_at);

    // ── 6. Update token with new code ────────────────────────
    const { data: rotated, error: updateErr } = await supabaseAdmin
      .from('AddressVerificationToken')
      .update({
        code_hash: newCodeHash,
        resend_count: token.resend_count + 1,
        cooldown_until: newCooldownUntil.toISOString(),
        attempt_count: 0, // reset entry attempts on resend
      })
      .eq('id', token.id)
      .eq('code_hash', token.code_hash)
      .eq('resend_count', token.resend_count)
      .eq('attempt_count', token.attempt_count)
      .is('used_at', null)
      .select('id');

    if (updateErr || !rotated?.length) {
      logger.error('MailVerificationService.resendCode: token update failed', {
        attemptId, error: updateErr?.message,
      });
      return { success: false, error: 'Failed to update verification token' };
    }

    const previousAttemptState = {
      status: attempt.status,
      expires_at: attempt.expires_at,
    };

    if (allowExpiredRecovery) {
      const { error: attemptUpdateErr } = await supabaseAdmin
        .from('AddressVerificationAttempt')
        .update({
          status: 'created',
          expires_at: nextExpiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', attemptId);

      if (attemptUpdateErr) {
        logger.error('MailVerificationService.resendCode: attempt refresh failed', {
          attemptId, error: attemptUpdateErr.message,
        });
        await supabaseAdmin
          .from('AddressVerificationToken')
          .update({
            code_hash: token.code_hash,
            resend_count: token.resend_count,
            cooldown_until: token.cooldown_until,
            attempt_count: token.attempt_count,
          })
          .eq('id', token.id);
        return { success: false, error: 'Failed to refresh verification attempt' };
      }
    }

    // ── 7. Create new MailVerificationJob ────────────────────
    const { data: job, error: jobErr } = await supabaseAdmin
      .from('MailVerificationJob')
      .insert({
        id: crypto.randomUUID(),
        attempt_id: attemptId,
        vendor: 'pending',
        vendor_job_id: null,
        template_id: addressConfig.lob.postcardTemplateId || null,
        vendor_status: 'pending',
        metadata: {
          address_id: attempt.address_id,
          unit: previousJob?.metadata?.unit || null,
          ...(previousJob?.metadata?.destination ? { destination: previousJob.metadata.destination } : {}),
          resend_number: token.resend_count + 1,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobErr) {
      logger.error('MailVerificationService.resendCode: job insert failed', {
        attemptId, error: jobErr.message,
      });
      await supabaseAdmin
        .from('AddressVerificationToken')
        .update({
          code_hash: token.code_hash,
          resend_count: token.resend_count,
          cooldown_until: token.cooldown_until,
          attempt_count: token.attempt_count,
        })
        .eq('id', token.id);

      if (allowExpiredRecovery) {
        await supabaseAdmin
          .from('AddressVerificationAttempt')
          .update({
            status: previousAttemptState.status,
            expires_at: previousAttemptState.expires_at,
            updated_at: new Date().toISOString(),
          })
          .eq('id', attemptId);
      }

      return { success: false, error: 'Failed to create mail verification job' };
    }

    const dispatchResult = await this._dispatchVerificationJob(job?.id, newCode, {
      attemptId,
      addressId: attempt.address_id,
      userId,
      mode: 'resend',
    });

    if (!dispatchResult.success) {
      logger.error('MailVerificationService.resendCode: dispatch failed', {
        attemptId,
        jobId: job?.id || null,
        error: dispatchResult.error,
      });
      if (dispatchResult.deliveryUnknown) {
        return this._deliveryUnknown(attemptId, attempt.address_id);
      }
      await supabaseAdmin
        .from('MailVerificationJob')
        .delete()
        .eq('id', job?.id);
      await supabaseAdmin
        .from('AddressVerificationToken')
        .update({
          code_hash: token.code_hash,
          resend_count: token.resend_count,
          cooldown_until: token.cooldown_until,
          attempt_count: token.attempt_count,
        })
        .eq('id', token.id);

      if (allowExpiredRecovery) {
        await supabaseAdmin
          .from('AddressVerificationAttempt')
          .update({
            status: previousAttemptState.status,
            expires_at: previousAttemptState.expires_at,
            updated_at: new Date().toISOString(),
          })
          .eq('id', attemptId);
      }

      return { success: false, error: 'Failed to send verification mail' };
    }

    logger.info('MailVerificationService.resendCode: new code generated', {
      attemptId, resendCount: token.resend_count + 1,
    });

    return {
      success: true,
      verification_id: attemptId,
      address_id: attempt.address_id,
      status: 'pending',
      expires_at: nextExpiresAt.toISOString(),
      new_expires_at: nextExpiresAt.toISOString(),
      cooldown_until: newCooldownUntil.toISOString(),
      max_resends: MAX_RESENDS,
      resends_remaining: Math.max(0, MAX_RESENDS - (token.resend_count + 1)),
    };
  }

  // ================================================================
  // getVerificationStatus
  // ================================================================

  /**
   * Return the public verification status payload used by the frontend.
   *
   * @param {string} attemptId
   * @param {string} userId
   * @returns {Promise<{success: boolean, error?: string, verification_id?: string, address_id?: string, status?: string, expires_at?: string, cooldown_until?: string, max_resends?: number, resends_remaining?: number}>}
   */
  async getVerificationStatus(attemptId, userId) {
    const { data: attempt } = await supabaseAdmin
      .from('AddressVerificationAttempt')
      .select('*')
      .eq('id', attemptId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!attempt) {
      return { success: false, error: 'Verification attempt not found' };
    }

    const { data: token } = await supabaseAdmin
      .from('AddressVerificationToken')
      .select('*')
      .eq('attempt_id', attemptId)
      .maybeSingle();

    if (!token) {
      return { success: false, error: 'Verification token not found' };
    }

    let status = this._mapAttemptStatus(attempt);

    if (
      status === 'pending'
      && attempt.expires_at
      && new Date(attempt.expires_at) < new Date()
    ) {
      status = 'expired';
      await supabaseAdmin
        .from('AddressVerificationAttempt')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', attemptId);
    }

    const { job, error: jobError } = ['pending', 'confirmed'].includes(status)
      ? await this._latestMailJob(attempt.id) : {};
    if (status === 'confirmed') {
      if (jobError) return { success: false, statusCode: 503, error: 'Could not check Home membership. Please retry.' };
      const membership = await this._readConfirmedMembership(job, attempt.address_id, userId);
      if (!membership.success) return membership;
    }
    const deliveryUnknown = status === 'pending' && (jobError || !job?.vendor_job_id);
    return {
      success: true,
      verification_id: attempt.id,
      address_id: attempt.address_id,
      status,
      ...(deliveryUnknown && { delivery_unknown: true }),
      expires_at: attempt.expires_at,
      cooldown_until: token.cooldown_until,
      max_resends: MAX_RESENDS,
      resends_remaining: Math.max(0, MAX_RESENDS - (token.resend_count || 0)),
    };
  }

  async _readConfirmedMembership(job, addressId, userId) {
    if (!job?.metadata?.confirmed_home_id || !job.metadata.confirmed_occupancy_id) {
      return { success: false, statusCode: 409, error: 'Your mailed proof needs membership recovery. Enter the same code again.' };
    }
    const homeId = job.metadata.confirmed_home_id;
    const reads = await Promise.all([
      supabaseAdmin.from('Home').select('id, address_id, address, address2, city, state, zipcode, security_state').eq('id', homeId).maybeSingle(),
      supabaseAdmin.from('HomeOccupancy').select('id, is_active, verification_status, end_at, access_start_at, access_end_at')
        .eq('id', job.metadata.confirmed_occupancy_id).eq('home_id', homeId).eq('user_id', userId).maybeSingle(),
      supabaseAdmin.from('HomeAddress').select('address_line1_norm, address_line2_norm, city_norm, state, postal_code, building_type, missing_secondary_flag')
        .eq('id', addressId).maybeSingle(),
      supabaseAdmin.from('AddressClaim').select('id, unit_number, claim_status, created_at')
        .eq('address_id', addressId).eq('user_id', userId),
    ]);
    if (reads.some(r => r.error)) return { success: false, statusCode: 503, error: 'Could not check Home membership. Please retry.' };
    const [home, occupancy, address, claims] = reads.map(r => r.data);
    const denied = { success: false, statusCode: 403, error: 'Home membership is no longer available.' };
    if (!home || !occupancy || !address || home.address_id !== addressId
      || ['frozen', 'frozen_silent'].includes(home.security_state) || occupancy.is_active !== true
      || occupancy.verification_status !== 'verified' || occupancy.end_at
      || new Date(occupancy.access_start_at) > new Date()
      || (occupancy.access_end_at && new Date(occupancy.access_end_at) <= new Date())) return denied;
    const current = destinationFor(address, job.metadata.unit);
    const legacy = current && !current.line2 && address.building_type !== 'multi_unit' && !address.missing_secondary_flag;
    const destination = job.metadata.destination || (legacy ? current : null);
    if (!sameDestination(destination, current)
      || !sameDestination(destination, destinationForHome(home, address))) return denied;
    const latestClaim = (claims || []).filter(claim =>
      unitKey(String(claim.unit_number || '').trim() || address.address_line2_norm) === unitKey(destination.line2))
      .sort((left, right) => (new Date(right.created_at) - new Date(left.created_at))
        || right.id.localeCompare(left.id))[0];
    if (latestClaim?.claim_status === 'rejected') return denied;
    return { success: true };
  }

  // ================================================================
  // confirmCode
  // ================================================================

  /**
   * Verify a code entry against the stored hash.
   *
   * @param {string} attemptId
   * @param {string} code — the 6-digit code the user entered
   * @param {string} userId
   * @returns {Promise<{verified: boolean, locked?: boolean, attempts_remaining?: number, error?: string, occupancy_id?: string}>}
   */
  async confirmCode(attemptId, code, userId) {
    const { applyOccupancyTemplate } = require('../../utils/homePermissions');
    const templates = {};
    for (const band of ['adult', 'child', 'teen']) {
      // dryRun computes policy without reading or writing a Home. The database
      // resolves and locks the exact mailed Home inside the confirmation.
      const prepared = await applyOccupancyTemplate(null, userId, 'member', 'verified', { dryRun: true, ageBand: band });
      templates[band] = prepared.template;
    }
    const { data, error } = await supabaseAdmin.rpc('confirm_mail_verification', {
      p_attempt_id: attemptId, p_user_id: userId, p_submitted_hash: this._hashCode(code),
      p_templates: templates, p_validity_days: require('../../utils/verificationAge').validityDays(),
    });
    if (error || !data) return {
      verified: false, statusCode: 503,
      error: 'Could not complete verification. Your code is preserved; please retry.',
    };
    if (data.error === 'WRONG_CODE') return { verified: false, attempts_remaining: data.attempts_remaining };
    if (data.error === 'LOCKED') return { verified: false, locked: true, error: 'Verification attempt is locked. Request a new code.' };
    const failures = {
      NOT_FOUND: [404, 'Verification attempt or proof not found'],
      EXPIRED: [410, 'Verification code has expired'],
      INACTIVE: [400, 'Verification attempt is inactive'],
      INCONSISTENT_PROOF: [503, 'The verified proof could not be reconciled. Please contact support.'],
      ADDRESS_CHANGED: [409, 'The mailing address changed. Contact support before requesting another code.'],
      UNBOUND_DESTINATION: [409, 'The original mailing unit cannot be confirmed. Please contact support.'],
      AMBIGUOUS_HOME: [409, 'We could not identify one Home for the mailed unit. Please contact support.'],
      ACCESS_REVOKED: [403, 'Home access is restricted. Contact the household for approval.'],
      HOME_OCCUPIED: [409, 'Someone already lives in this Home. Ask them to add you or request a review.'],
    };
    if (data.error) {
      const [statusCode, message] = failures[data.error] || [503, 'Could not complete verification. Please retry.'];
      return { verified: false, statusCode, error: message };
    }
    const occupancy = data.occupancy;
    if (!occupancy?.id || occupancy.user_id !== userId || occupancy.is_active !== true
      || occupancy.verification_status !== 'verified') {
      return { verified: false, statusCode: 503, error: 'Verification did not return usable Home membership. Please retry.' };
    }
    return { verified: true, occupancy_id: occupancy.id, reused: data.reused === true };
  }

  // ── Private: Rate Limiting ─────────────────────────────────────

  /**
   * Check if the user has exceeded the per-user start rate limit.
   * @param {string} userId
   * @returns {Promise<{exceeded: boolean}>}
   */
  async _checkUserRateLimit(userId) {
    const cutoff = new Date(Date.now() - USER_RATE_WINDOW_HOURS * 60 * 60 * 1000);

    const { count, error } = await supabaseAdmin
      .from('AddressVerificationAttempt')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', cutoff.toISOString());

    if (error) {
      // SEC-08: fail CLOSED. Every bypass of this limit costs a physical
      // postcard, so a transient DB error must not become free mail.
      logger.error('MailVerificationService._checkUserRateLimit: failing closed', {
        error: error.message,
      });
      return { exceeded: true };
    }

    return { exceeded: count >= USER_RATE_LIMIT };
  }

  /**
   * Check if the address has exceeded the per-address rate limit.
   * @param {string} addressId
   * @returns {Promise<{exceeded: boolean}>}
   */
  /**
   * How much of a single address's budget one user may consume.
   *
   * SEC-06: the address budget was keyed on address_id alone, so a handful of
   * throwaway accounts could exhaust a victim's budget and lock the genuine
   * resident out of verifying their own home (and bill us for the postcards).
   */
  async _checkUserAddressRateLimit(userId, addressId) {
    const cutoff = new Date(Date.now() - ADDRESS_RATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const { count, error } = await supabaseAdmin
      .from('AddressVerificationAttempt')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('address_id', addressId)
      .gte('created_at', cutoff.toISOString());

    if (error) {
      logger.error('MailVerificationService._checkUserAddressRateLimit: failing closed', {
        error: error.message,
      });
      return { exceeded: true };
    }

    return { exceeded: count >= USER_ADDRESS_RATE_LIMIT };
  }

  async _checkAddressRateLimit(addressId) {
    const cutoff = new Date(Date.now() - ADDRESS_RATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const { count, error } = await supabaseAdmin
      .from('AddressVerificationAttempt')
      .select('id', { count: 'exact', head: true })
      .eq('address_id', addressId)
      .gte('created_at', cutoff.toISOString());

    if (error) {
      logger.error('MailVerificationService._checkAddressRateLimit: failing closed', {
        error: error.message,
      });
      return { exceeded: true };
    }

    return { exceeded: count >= ADDRESS_RATE_LIMIT };
  }

  // ── Private: Household Conflict ────────────────────────────────

  /**
   * Check if the address is actively controlled by a verified household admin.
   * Looks up Home records by address_id, then checks HomeAuthority for any
   * verified owner/manager.
   *
   * @param {string} addressId
   * @returns {Promise<{blocked: boolean, reason?: string}>}
   */
  /**
   * Should a mail-code verification be refused because a household already
   * lives here?
   *
   * SCN-03: this used to key entirely on `HomeAuthority.status === 'verified'`.
   * Nothing in the codebase can set that status — the landlord/authority path
   * has no route that calls verifyAuthority — so the list was always empty,
   * the gate always returned blocked:false, and anyone holding a mailed code
   * joined an already-occupied household with no approval from anyone living
   * there. It also used .maybeSingle() on a query that returns one row per
   * admin, which errors when a home has more than one, failing open exactly
   * on the busiest households.
   *
   * The gate now keys on active occupancy, which is state the system actually
   * maintains. An address with existing residents routes through the claim and
   * approval flow instead of self-service mail.
   */
  async _checkHouseholdConflict(addressId, userId, unit, canonicalUnit) {
    const { data: homes, error: homesErr } = await supabaseAdmin
      .from('Home')
      .select('id, address2')
      .eq('address_id', addressId);

    if (homesErr) {
      logger.error('MailVerificationService._checkHouseholdConflict: failing closed', {
        addressId, error: homesErr.message,
      });
      return { blocked: true, reason: 'Unable to verify this address right now. Please try again.' };
    }

    if (!homes || homes.length === 0) {
      return { blocked: false };
    }

    if (!unit && homes.some(home => unitKey(home.address2))) {
      return { blocked: true, reason: 'Address requires a unit number' };
    }
    const homeIds = homes.filter(home => unitKey(home.address2 || canonicalUnit) === unitKey(unit)).map(home => home.id);
    if (!homeIds.length) return { blocked: false };

    const { data: occupants, error: occErr } = await supabaseAdmin
      .from('HomeOccupancy')
      .select('id, user_id, home_id')
      .in('home_id', homeIds)
      .eq('is_active', true);

    if (occErr) {
      logger.error('MailVerificationService._checkHouseholdConflict: occupancy lookup failed', {
        addressId, error: occErr.message,
      });
      return { blocked: true, reason: 'Unable to verify this address right now. Please try again.' };
    }

    const others = (occupants || []).filter((o) => o.user_id !== userId);
    if (others.length > 0) {
      return {
        blocked: true,
        reason: 'Someone already lives at this address on Pantopus. '
          + 'Ask them to add you, or file a claim for review.',
      };
    }

    return { blocked: false };
  }

  /**
   * Convert internal attempt states into the public mail verification status vocabulary.
   * @param {{ status?: string }} attempt
   * @returns {'pending' | 'confirmed' | 'expired' | 'locked'}
   */
  _mapAttemptStatus(attempt) {
    switch (attempt?.status) {
      case 'verified':
        return 'confirmed';
      case 'locked':
        return 'locked';
      case 'expired':
        return 'expired';
      default:
        return 'pending';
    }
  }

  // ── Private: Code Generation & Hashing ─────────────────────────

  /**
   * Generate a random 6-digit numeric code.
   * @returns {string}
   */
  _generateCode() {
    // Use crypto for unbiased randomness
    const bytes = crypto.randomBytes(4);
    const num = bytes.readUInt32BE(0) % 900000 + 100000;
    return String(num);
  }

  /**
   * SHA-256 hash a code string.
   * @param {string} code
   * @returns {string} hex digest
   */
  _hashCode(code) {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  /**
   * Constant-time comparison of two hex strings.
   * @param {string} a
   * @param {string} b
   * @returns {boolean}
   */
  _timingSafeCompare(a, b) {
    if (a.length !== b.length) return false;
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    return crypto.timingSafeEqual(bufA, bufB);
  }
}

// Export constants for testing
MailVerificationService.CODE_EXPIRY_DAYS = CODE_EXPIRY_DAYS;
MailVerificationService.RESEND_COOLDOWN_HOURS = RESEND_COOLDOWN_HOURS;
MailVerificationService.MAX_RESENDS = MAX_RESENDS;
MailVerificationService.MAX_ATTEMPTS = MAX_ATTEMPTS;
MailVerificationService.USER_RATE_LIMIT = USER_RATE_LIMIT;
MailVerificationService.USER_RATE_WINDOW_HOURS = USER_RATE_WINDOW_HOURS;
MailVerificationService.ADDRESS_RATE_LIMIT = ADDRESS_RATE_LIMIT;
MailVerificationService.USER_ADDRESS_RATE_LIMIT = USER_ADDRESS_RATE_LIMIT;
MailVerificationService.ADDRESS_RATE_WINDOW_DAYS = ADDRESS_RATE_WINDOW_DAYS;

module.exports = new MailVerificationService();
