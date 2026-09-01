/**
 * Address Validation Routes
 *
 * API endpoints that wire together the address validation pipeline:
 *   POST /validate         — full pipeline: Google → Smarty → DecisionEngine → persist
 *   POST /validate/unit    — re-validate with a unit/apt number
 *   POST /claim            — create an AddressClaim after successful validation
 *
 * Mounted at /api/v1/address in app.js.
 */

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const logger = require('../utils/logger');
const { addressValidationLimiter, addressClaimLimiter } = require('../middleware/rateLimiter');
const addressConfig = require('../config/addressVerification');
const googleProvider = require('../services/addressValidation/googleProvider');
const smartyProvider = require('../services/addressValidation/smartyProvider');

const decisionEngine = require('../services/addressValidation/addressDecisionEngine');
const mailVerificationService = require('../services/addressValidation/mailVerificationService');
const pipelineService = require('../services/addressValidation/pipelineService');
const addressVerificationObservability = require('../services/addressValidation/addressVerificationObservability');
const { AddressVerdictStatus } = require('../services/addressValidation/types');

// ============================================================
// VALIDATION SCHEMAS
// ============================================================

// Reject PO Box variants: "PO Box", "P.O. Box", "P O Box", "POB", "Post Office Box"
const PO_BOX_PATTERN = /^\s*(?:p\.?\s*o\.?\s*b(?:ox)?|post\s+office\s+box)\b/i;

const validateAddressSchema = Joi.object({
  line1: Joi.string().trim().min(1).max(255)
    .custom((value, helpers) => {
      if (PO_BOX_PATTERN.test(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    }, 'PO Box rejection')
    .messages({ 'any.invalid': 'PO Box addresses are not accepted. Please enter a residential street address.' })
    .required(),
  line2: Joi.string().trim().max(100).allow('', null),
  city: Joi.string().trim().min(1).max(100).required(),
  state: Joi.string().trim().min(2).max(2).uppercase().required(),
  zip: Joi.string().trim().pattern(/^\d{5}(-\d{4})?$/).required(),
});

const validateUnitSchema = Joi.object({
  address_id: Joi.string().uuid().required(),
  unit: Joi.string().trim().min(1).max(100).required(),
});

const claimAddressSchema = Joi.object({
  address_id: Joi.string().uuid().required(),
  unit: Joi.string().trim().max(100).allow('', null),
});

function areValidationProvidersHealthy() {
  return googleProvider.isAvailable() && smartyProvider.isAvailable();
}

function buildOutageVerdict(reason) {
  return {
    status: AddressVerdictStatus.SERVICE_ERROR,
    reasons: [reason],
    confidence: 0,
    candidates: [],
    next_actions: ['manual_review'],
  };
}

// ============================================================
// POST /validate — Full address validation pipeline
// ============================================================

router.post(
  '/validate',
  verifyToken,
  addressValidationLimiter,
  validate(validateAddressSchema),
  async (req, res) => {
    const userId = req.user.id;
    const input = req.body;

    try {
      if (addressConfig.outageFallback.enabled && !areValidationProvidersHealthy()) {
        const verdict = buildOutageVerdict('Address verification providers unavailable');
        logger.warn('addressValidation.validate: providers unavailable', {
          userId,
          hasGoogle: googleProvider.isAvailable(),
          hasSmarty: smartyProvider.isAvailable(),
        });

        await addressVerificationObservability.recordValidationOutcome({
          addressId: null,
          verdict,
          trigger: 'validate',
          route: 'validate',
          source: 'provider_unavailable',
          errorCode: 'ADDRESS_VALIDATION_UNAVAILABLE',
          message: 'Address verification is temporarily unavailable. Please try again once verification is available.',
        });

        return res.json({
          verdict,
          address_id: null,
          error_code: 'ADDRESS_VALIDATION_UNAVAILABLE',
          message: 'Address verification is temporarily unavailable. Please try again once verification is available.',
        });
      }

      const result = await pipelineService.runValidationPipeline(input, {
        auditContext: { trigger: 'validate' },
      });

      return res.json({
        verdict: result.verdict,
        address_id: result.address_id,
      });
    } catch (err) {
      logger.error('addressValidation.validate: unhandled error', {
        userId,
        error: err.message,
        stack: err.stack,
      });
      return res.status(500).json({ error: 'Address validation failed' });
    }
  },
);

// ============================================================
// POST /validate/unit — Re-validate with unit number
// ============================================================

router.post(
  '/validate/unit',
  verifyToken,
  addressValidationLimiter,
  validate(validateUnitSchema),
  async (req, res) => {
    const userId = req.user.id;
    const { address_id, unit } = req.body;

    try {
      // ── Look up the canonical address ──────────────────────
      const { data: existing, error: lookupErr } = await supabaseAdmin
        .from('HomeAddress')
        .select('*')
        .eq('id', address_id)
        .maybeSingle();

      if (lookupErr) {
        logger.error('addressValidation.validateUnit: lookup failed', {
          userId,
          address_id,
          error: lookupErr.message,
        });
        return res.status(500).json({ error: 'Address lookup failed' });
      }

      if (!existing) {
        return res.status(404).json({ error: 'Address not found' });
      }

      if (addressConfig.outageFallback.enabled && !areValidationProvidersHealthy()) {
        const verdict = buildOutageVerdict('Address revalidation providers unavailable');
        logger.warn('addressValidation.validateUnit: providers unavailable', {
          userId,
          address_id,
          hasGoogle: googleProvider.isAvailable(),
          hasSmarty: smartyProvider.isAvailable(),
        });

        await addressVerificationObservability.recordValidationOutcome({
          addressId: address_id,
          verdict,
          trigger: 'validate_unit',
          route: 'validate_unit',
          source: 'provider_unavailable',
          errorCode: 'ADDRESS_REVALIDATION_UNAVAILABLE',
          message: 'Unit revalidation is temporarily unavailable. Please try again once verification is available.',
        });

        return res.json({
          verdict,
          address_id,
          error_code: 'ADDRESS_REVALIDATION_UNAVAILABLE',
          message: 'Unit revalidation is temporarily unavailable. Please try again once verification is available.',
        });
      }

      // ── Build full address input with unit ─────────────────
      const input = {
        line1: existing.address_line1_norm,
        line2: unit,
        city: existing.city_norm,
        state: existing.state,
        zip: existing.postal_code,
      };

      const result = await pipelineService.runValidationPipeline(input, {
        auditContext: { trigger: 'validate_unit' },
      });

      return res.json({
        verdict: result.verdict,
        address_id: result.address_id || address_id,
      });
    } catch (err) {
      logger.error('addressValidation.validateUnit: unhandled error', {
        userId,
        error: err.message,
        stack: err.stack,
      });
      return res.status(500).json({ error: 'Address validation failed' });
    }
  },
);

// ============================================================
// POST /claim — Create an AddressClaim
// ============================================================

/**
 * Confidence threshold: verdicts with confidence >= this value and status OK
 * are auto-verified; everything else enters pending/escalation.
 */
const AUTO_VERIFY_CONFIDENCE = 0.8;

router.post(
  '/claim',
  verifyToken,
  addressClaimLimiter,
  validate(claimAddressSchema),
  async (req, res) => {
    const userId = req.user.id;
    const { address_id, unit } = req.body;

    try {
      // ── Look up the canonical address ──────────────────────
      const { data: address, error: addrErr } = await supabaseAdmin
        .from('HomeAddress')
        .select('*')
        .eq('id', address_id)
        .maybeSingle();

      if (addrErr) {
        logger.error('addressValidation.claim: address lookup failed', {
          userId,
          address_id,
          error: addrErr.message,
        });
        return res.status(500).json({ error: 'Address lookup failed' });
      }

      if (!address) {
        return res.status(404).json({ error: 'Address not found' });
      }

      // ── Check for recent OK verdict via stored validation data ─
      const hasRecentValidation = !!(
        address.last_validated_at &&
        address.validation_raw_response
      );

      // Reconstruct a lightweight verdict from stored data
      let storedConfidence = 0;
      let storedStatus = AddressVerdictStatus.SERVICE_ERROR;

      if (hasRecentValidation) {
        const storedInputs = pipelineService.buildStoredDecisionInputs(address);

        const verdict = decisionEngine.classify({
          ...storedInputs,
          use_provider_place_for_business: addressConfig.rollout.enforcePlaceProviderBusiness,
          use_provider_unit_intelligence: addressConfig.rollout.enableSecondaryProvider,
          use_provider_parcel_for_classification: addressConfig.rollout.enforceParcelProviderClassification,
          provider_parcel_max_age_days: addressConfig.parcelIntel.cacheDays,
        });

        storedStatus = verdict.status;
        storedConfidence = verdict.confidence;
      }

      // ── Determine claim status ─────────────────────────────
      let claimStatus;
      let verificationMethod;

      if (storedStatus === AddressVerdictStatus.OK && storedConfidence >= AUTO_VERIFY_CONFIDENCE) {
        claimStatus = 'verified';
        verificationMethod = 'autocomplete_ok';
      } else if (
        storedStatus === AddressVerdictStatus.OK ||
        storedStatus === AddressVerdictStatus.MIXED_USE ||
        storedStatus === AddressVerdictStatus.LOW_CONFIDENCE
      ) {
        claimStatus = 'pending';
        verificationMethod = 'escalation_required';
      } else {
        // UNDELIVERABLE, BUSINESS, MISSING_UNIT, SERVICE_ERROR, CONFLICT, etc.
        const verdictMessages = {
          [AddressVerdictStatus.MISSING_UNIT]: 'Please provide a unit number first',
          [AddressVerdictStatus.MISSING_STREET_NUMBER]: 'Please provide a street number for this address',
          [AddressVerdictStatus.UNVERIFIED_STREET_NUMBER]: 'The street number could not be verified — please double-check your address',
          [AddressVerdictStatus.PO_BOX]: 'PO Box addresses are not accepted. Please enter a residential street address.',
          [AddressVerdictStatus.SERVICE_ERROR]: 'Address has not been validated yet',
        };

        return res.status(422).json({
          error: 'Address cannot be claimed in its current state',
          verdict_status: storedStatus,
          message: verdictMessages[storedStatus] || 'Address verification did not pass',
        });
      }

      // ── Check for existing claim by this user on this address ─
      const { data: existingClaim } = await supabaseAdmin
        .from('AddressClaim')
        .select('id, claim_status')
        .eq('user_id', userId)
        .eq('address_id', address_id)
        .maybeSingle();

      if (existingClaim) {
        return res.status(409).json({
          error: 'You already have a claim on this address',
          claim: existingClaim,
        });
      }

      // ── Create the AddressClaim ────────────────────────────
      const claim = {
        user_id: userId,
        address_id,
        unit_number: unit || null,
        claim_status: claimStatus,
        verification_method: verificationMethod,
        confidence: storedConfidence,
        verdict_status: storedStatus,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: created, error: insertErr } = await supabaseAdmin
        .from('AddressClaim')
        .insert(claim)
        .select()
        .single();

      if (insertErr) {
        logger.error('addressValidation.claim: insert failed', {
          userId,
          address_id,
          error: insertErr.message,
        });
        return res.status(500).json({ error: 'Failed to create address claim' });
      }

      logger.info('addressValidation.claim: created', {
        userId,
        address_id,
        claimStatus,
        verificationMethod,
      });

      return res.status(201).json({
        message: claimStatus === 'verified'
          ? 'Address claimed and verified'
          : 'Address claim created — verification pending',
        claim: {
          ...created,
          unit: created?.unit_number ?? null,
        },
      });
    } catch (err) {
      logger.error('addressValidation.claim: unhandled error', {
        userId,
        error: err.message,
        stack: err.stack,
      });
      return res.status(500).json({ error: 'Failed to process address claim' });
    }
  },
);

// ============================================================
// MAIL VERIFICATION SCHEMAS
// ============================================================

const mailStartSchema = Joi.object({
  address_id: Joi.string().uuid().required(),
  unit: Joi.string().trim().max(100).allow('', null),
});

const mailResendLegacySchema = Joi.object({
  attempt_id: Joi.string().uuid().required(),
});

const mailConfirmSchema = Joi.object({
  verification_id: Joi.string().uuid(),
  attempt_id: Joi.string().uuid(),
  code: Joi.string().trim().min(6).max(6).pattern(/^\d{6}$/).required(),
}).xor('verification_id', 'attempt_id');

// ============================================================
// POST /verify/mail/start — Start mail verification
// ============================================================

/**
 * Maps MailVerificationService error strings to HTTP status codes.
 */
function mapStartError(error) {
  if (error.includes('Rate limit')) return 429;
  if (error.includes('actively controlled')) return 409;
  if (error.includes('not found')) return 404;
  if (error.includes('send verification mail') || error.includes('create mail verification job')) return 503;
  // "not deliverable", "requires a unit", anything else → 400
  return 400;
}

function toMailVerificationResponse(result, fallbackAddressId) {
  return {
    verification_id: result.verification_id || result.attempt_id,
    address_id: result.address_id || fallbackAddressId,
    status: result.status || 'pending',
    expires_at: result.expires_at || result.new_expires_at,
    cooldown_until: result.cooldown_until,
    max_resends: typeof result.max_resends === 'number'
      ? result.max_resends
      : addressConfig.mailVerification.maxResends,
    resends_remaining: typeof result.resends_remaining === 'number'
      ? result.resends_remaining
      : addressConfig.mailVerification.maxResends,
  };
}

router.post(
  '/verify/mail/start',
  verifyToken,
  validate(mailStartSchema),
  async (req, res) => {
    const userId = req.user.id;
    const { address_id, unit } = req.body;

    try {
      const result = await mailVerificationService.startVerification(
        userId,
        address_id,
        unit || undefined,
      );

      if (!result.success) {
        const status = mapStartError(result.error);
        return res.status(status).json({ error: result.error });
      }

      return res.json(toMailVerificationResponse(result, address_id));
    } catch (err) {
      logger.error('addressValidation.verify.mail.start: unhandled error', {
        userId,
        error: err.message,
        stack: err.stack,
      });
      return res.status(500).json({ error: 'Failed to start mail verification' });
    }
  },
);

// ============================================================
// POST /verify/mail/resend — Resend verification code
// ============================================================

function mapResendError(error) {
  if (error.includes('Cooldown') || error.includes('Maximum resend')) return 429;
  if (error.includes('not found')) return 404;
  if (error.includes('send verification mail') || error.includes('create mail verification job')) return 503;
  // "Cannot resend: attempt is expired/locked/etc." → 400
  return 400;
}

async function handleMailResend(req, res) {
  const userId = req.user.id;
  const verificationId = req.params.verification_id || req.body.attempt_id;

  try {
    const result = await mailVerificationService.resendCode(verificationId, userId);

    if (!result.success) {
      const status = mapResendError(result.error);
      const body = { error: result.error };
      if (result.cooldown_until) body.cooldown_until = result.cooldown_until;
      return res.status(status).json(body);
    }

    return res.json(toMailVerificationResponse(result));
  } catch (err) {
    logger.error('addressValidation.verify.mail.resend: unhandled error', {
      userId,
      error: err.message,
      stack: err.stack,
    });
    return res.status(500).json({ error: 'Failed to resend verification code' });
  }
}

router.post(
  '/verify/mail/:verification_id/resend',
  verifyToken,
  handleMailResend,
);

// Legacy alias kept for older callers while the frontend moves to the path-param contract.
router.post(
  '/verify/mail/resend',
  verifyToken,
  validate(mailResendLegacySchema),
  handleMailResend,
);

// ============================================================
// GET /verify/mail/:verification_id — Check mail verification status
// ============================================================

router.get(
  '/verify/mail/:verification_id',
  verifyToken,
  async (req, res) => {
    const userId = req.user.id;
    const { verification_id } = req.params;

    try {
      const result = await mailVerificationService.getVerificationStatus(verification_id, userId);

      if (!result.success) {
        const status = result.error?.includes('not found') ? 404 : 400;
        return res.status(status).json({ error: result.error });
      }

      return res.json({
        verification_id: result.verification_id,
        status: result.status,
        expires_at: result.expires_at,
        cooldown_until: result.cooldown_until,
        resends_remaining: result.resends_remaining,
      });
    } catch (err) {
      logger.error('addressValidation.verify.mail.status: unhandled error', {
        userId,
        verificationId: verification_id,
        error: err.message,
        stack: err.stack,
      });
      return res.status(500).json({ error: 'Failed to fetch mail verification status' });
    }
  },
);

// ============================================================
// POST /verify/mail/confirm — Confirm verification code
// ============================================================

function mapConfirmResponse(result) {
  if (result.verified || result.error === 'Attempt is verified') {
    const body = { status: 'confirmed' };
    if (result.occupancy_id) body.occupancy_id = result.occupancy_id;
    return body;
  }

  if (
    result.locked
    || result.error === 'Attempt is locked'
    || (result.error && result.error.includes('Too many attempts'))
  ) {
    const body = { status: 'locked' };
    if (result.locked_until) body.locked_until = result.locked_until;
    return body;
  }

  if (result.error && result.error.includes('expired')) {
    return { status: 'expired' };
  }

  if (typeof result.attempts_remaining === 'number') {
    return {
      status: 'wrong_code',
      attempts_remaining: result.attempts_remaining,
    };
  }

  return null;
}

router.post(
  '/verify/mail/confirm',
  verifyToken,
  validate(mailConfirmSchema),
  async (req, res) => {
    const userId = req.user.id;
    const verificationId = req.body.verification_id || req.body.attempt_id;
    const { code } = req.body;

    try {
      const result = await mailVerificationService.confirmCode(verificationId, code, userId);

      const confirmResponse = mapConfirmResponse(result);
      if (confirmResponse) {
        return res.json(confirmResponse);
      }

      if (result.error && result.error.includes('not found')) {
        return res.status(404).json({ error: result.error });
      }

      return res.status(400).json({
        error: result.error || 'Verification confirmation failed',
      });
    } catch (err) {
      logger.error('addressValidation.verify.mail.confirm: unhandled error', {
        userId,
        error: err.message,
        stack: err.stack,
      });
      return res.status(500).json({ error: 'Failed to confirm verification code' });
    }
  },
);

module.exports = router;
