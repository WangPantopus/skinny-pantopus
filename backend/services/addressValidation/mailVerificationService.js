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

  async _dispatchVerificationJob(jobId, context = {}) {
    if (!jobId) {
      return { success: false, error: 'Mail verification job not found' };
    }

    try {
      return await mailVendorService.dispatchPostcard(jobId);
    } catch (error) {
      logger.error('MailVerificationService: dispatch failed unexpectedly', {
        ...context,
        jobId,
        error: error.message,
      });
      return { success: false, error: `Mail provider error: ${error.message}` };
    }
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

    // Check deliverability via stored validation data
    if (address.validation_raw_response) {
      const raw = address.validation_raw_response;
      if (raw.dpv_match_code === 'N') {
        return { success: false, error: 'Address is not deliverable' };
      }
      if (raw.missing_secondary && !unit) {
        return { success: false, error: 'Address requires a unit number' };
      }
    }

    // ── 2. Check for household authority conflict ────────────
    const conflictCheck = await this._checkHouseholdConflict(addressId);
    if (conflictCheck.blocked) {
      return { success: false, error: conflictCheck.reason };
    }

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

    // ── 5. Generate code + hash ─────────────────────────────
    const code = this._generateCode();
    const codeHash = this._hashCode(code);

    const expiresAt = new Date(Date.now() + CODE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const cooldownUntil = new Date(Date.now() + RESEND_COOLDOWN_HOURS * 60 * 60 * 1000);

    // ── 6. Create AddressVerificationAttempt ─────────────────
    const { data: attempt, error: attemptErr } = await supabaseAdmin
      .from('AddressVerificationAttempt')
      .insert({
        user_id: userId,
        address_id: addressId,
        method: 'mail_code',
        status: 'created',
        risk_tier: 'low',
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (attemptErr) {
      logger.error('MailVerificationService.startVerification: attempt insert failed', {
        userId, addressId, error: attemptErr.message,
      });
      return { success: false, error: 'Failed to create verification attempt' };
    }

    // ── 7. Create AddressVerificationToken ───────────────────
    const { error: tokenErr } = await supabaseAdmin
      .from('AddressVerificationToken')
      .insert({
        attempt_id: attempt.id,
        code_hash: codeHash,
        max_attempts: MAX_ATTEMPTS,
        attempt_count: 0,
        resend_count: 0,
        cooldown_until: cooldownUntil.toISOString(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (tokenErr) {
      logger.error('MailVerificationService.startVerification: token insert failed', {
        attemptId: attempt.id, error: tokenErr.message,
      });
      await supabaseAdmin
        .from('AddressVerificationAttempt')
        .delete()
        .eq('id', attempt.id);
      return { success: false, error: 'Failed to create verification token' };
    }

    // ── 8. Create MailVerificationJob ────────────────────────
    const { data: job, error: jobErr } = await supabaseAdmin
      .from('MailVerificationJob')
      .insert({
        attempt_id: attempt.id,
        vendor: 'pending',
        template_id: 'address_verification_v1',
        vendor_status: 'pending',
        metadata: {
          code,
          address_id: addressId,
          unit: unit || null,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobErr) {
      logger.error('MailVerificationService.startVerification: job insert failed', {
        attemptId: attempt.id, error: jobErr.message,
      });
      await this._deleteAttemptArtifacts(attempt.id);
      return { success: false, error: 'Failed to create mail verification job' };
    }

    const dispatchResult = await this._dispatchVerificationJob(job?.id, {
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
      await this._deleteAttemptArtifacts(attempt.id);
      return { success: false, error: 'Failed to send verification mail' };
    }

    logger.info('MailVerificationService.startVerification: created', {
      userId, addressId, attemptId: attempt.id,
    });

    return {
      success: true,
      attempt_id: attempt.id,
      verification_id: attempt.id,
      address_id: addressId,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
      cooldown_until: cooldownUntil.toISOString(),
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
    const { error: updateErr } = await supabaseAdmin
      .from('AddressVerificationToken')
      .update({
        code_hash: newCodeHash,
        resend_count: token.resend_count + 1,
        cooldown_until: newCooldownUntil.toISOString(),
        attempt_count: 0, // reset entry attempts on resend
      })
      .eq('id', token.id);

    if (updateErr) {
      logger.error('MailVerificationService.resendCode: token update failed', {
        attemptId, error: updateErr.message,
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
        attempt_id: attemptId,
        vendor: 'pending',
        template_id: 'address_verification_v1',
        vendor_status: 'pending',
        metadata: {
          code: newCode,
          address_id: attempt.address_id,
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

    const dispatchResult = await this._dispatchVerificationJob(job?.id, {
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

    return {
      success: true,
      verification_id: attempt.id,
      address_id: attempt.address_id,
      status,
      expires_at: attempt.expires_at,
      cooldown_until: token.cooldown_until,
      max_resends: MAX_RESENDS,
      resends_remaining: Math.max(0, MAX_RESENDS - (token.resend_count || 0)),
    };
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
    // ── 1. Verify attempt belongs to user ────────────────────
    const { data: attempt } = await supabaseAdmin
      .from('AddressVerificationAttempt')
      .select('*')
      .eq('id', attemptId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!attempt) {
      return { verified: false, error: 'Verification attempt not found' };
    }

    if (!ACTIVE_STATUSES.includes(attempt.status)) {
      return { verified: false, error: `Attempt is ${attempt.status}` };
    }

    // ── 2. Check expiry ──────────────────────────────────────
    if (new Date(attempt.expires_at) < new Date()) {
      await supabaseAdmin
        .from('AddressVerificationAttempt')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', attemptId);
      return { verified: false, error: 'Verification code has expired' };
    }

    // ── 3. Fetch token ───────────────────────────────────────
    const { data: token } = await supabaseAdmin
      .from('AddressVerificationToken')
      .select('*')
      .eq('attempt_id', attemptId)
      .maybeSingle();

    if (!token) {
      return { verified: false, error: 'Verification token not found' };
    }

    // ── 4. Increment attempt count ───────────────────────────
    const newAttemptCount = token.attempt_count + 1;

    // ── 5. Check lockout (before comparison) ─────────────────
    if (token.attempt_count >= token.max_attempts) {
      await supabaseAdmin
        .from('AddressVerificationAttempt')
        .update({ status: 'locked', updated_at: new Date().toISOString() })
        .eq('id', attemptId);
      return { verified: false, locked: true, error: 'Too many attempts. Request a new code.' };
    }

    // ── 6. Compare code (timing-safe) ────────────────────────
    const submittedHash = this._hashCode(code);
    const match = this._timingSafeCompare(submittedHash, token.code_hash);

    // Always increment attempt_count regardless of result
    await supabaseAdmin
      .from('AddressVerificationToken')
      .update({ attempt_count: newAttemptCount })
      .eq('id', token.id);

    if (!match) {
      // Check if this attempt now triggers lockout
      if (newAttemptCount >= token.max_attempts) {
        await supabaseAdmin
          .from('AddressVerificationAttempt')
          .update({ status: 'locked', updated_at: new Date().toISOString() })
          .eq('id', attemptId);
        return { verified: false, locked: true, error: 'Too many attempts. Request a new code.' };
      }

      return {
        verified: false,
        attempts_remaining: token.max_attempts - newAttemptCount,
      };
    }

    // ── 7. Code matches — mark verified ──────────────────────
    await supabaseAdmin
      .from('AddressVerificationAttempt')
      .update({ status: 'verified', updated_at: new Date().toISOString() })
      .eq('id', attemptId);

    await supabaseAdmin
      .from('AddressVerificationToken')
      .update({ used_at: new Date().toISOString() })
      .eq('id', token.id);

    // ── 8. Create/update HomeOccupancy ───────────────────────
    const occupancyResult = await this._attachOccupancy(userId, attempt.address_id);

    logger.info('MailVerificationService.confirmCode: verified', {
      attemptId, userId, occupancyId: occupancyResult.occupancy_id,
    });

    return {
      verified: true,
      occupancy_id: occupancyResult.occupancy_id || null,
    };
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
      logger.warn('MailVerificationService._checkUserRateLimit: error', { error: error.message });
      return { exceeded: false }; // fail open
    }

    return { exceeded: count >= USER_RATE_LIMIT };
  }

  /**
   * Check if the address has exceeded the per-address rate limit.
   * @param {string} addressId
   * @returns {Promise<{exceeded: boolean}>}
   */
  async _checkAddressRateLimit(addressId) {
    const cutoff = new Date(Date.now() - ADDRESS_RATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const { count, error } = await supabaseAdmin
      .from('AddressVerificationAttempt')
      .select('id', { count: 'exact', head: true })
      .eq('address_id', addressId)
      .gte('created_at', cutoff.toISOString());

    if (error) {
      logger.warn('MailVerificationService._checkAddressRateLimit: error', { error: error.message });
      return { exceeded: false };
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
  async _checkHouseholdConflict(addressId) {
    // Find homes at this address
    const { data: homes } = await supabaseAdmin
      .from('Home')
      .select('id')
      .eq('address_id', addressId);

    if (!homes || homes.length === 0) {
      return { blocked: false };
    }

    const homeIds = homes.map((h) => h.id);

    // Check for verified authority (owner or manager) on any home
    const { data: authorities } = await supabaseAdmin
      .from('HomeAuthority')
      .select('id, home_id, role, status')
      .in('home_id', homeIds)
      .eq('status', 'verified');

    if (authorities && authorities.length > 0) {
      // There's at least one verified authority — check active occupancy
      for (const auth of authorities) {
        const { data: occupancy } = await supabaseAdmin
          .from('HomeOccupancy')
          .select('id, user_id')
          .eq('home_id', auth.home_id)
          .eq('is_active', true)
          .in('role_base', ['owner', 'admin', 'manager'])
          .maybeSingle();

        if (occupancy) {
          return {
            blocked: true,
            reason: 'Address is actively controlled by a verified household admin',
          };
        }
      }
    }

    return { blocked: false };
  }

  // ── Private: Occupancy Attachment ──────────────────────────────

  /**
   * After successful verification, create or update a HomeOccupancy
   * for the user at the address.
   *
   * Delegates to the centralized OccupancyAttachService.
   *
   * @param {string} userId
   * @param {string} addressId
   * @returns {Promise<{occupancy_id: string|null}>}
   */
  async _attachOccupancy(userId, addressId) {
    // Find the Home linked to this address
    const { data: home } = await supabaseAdmin
      .from('Home')
      .select('id')
      .eq('address_id', addressId)
      .maybeSingle();

    if (!home) {
      logger.info('MailVerificationService._attachOccupancy: no Home for address', { addressId });
      return { occupancy_id: null };
    }

    const occupancyAttachService = require('../occupancyAttachService');
    const result = await occupancyAttachService.attach({
      homeId: home.id,
      userId,
      method: 'mail_code',
      claimType: 'resident',
      actorId: userId,
      metadata: { source: 'mail_verification' },
    });

    if (!result.success) {
      logger.error('MailVerificationService._attachOccupancy: attach failed', {
        userId, homeId: home.id, error: result.error,
      });
      return { occupancy_id: null };
    }

    return { occupancy_id: result.occupancy?.id || null };
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
MailVerificationService.ADDRESS_RATE_WINDOW_DAYS = ADDRESS_RATE_WINDOW_DAYS;

module.exports = new MailVerificationService();
