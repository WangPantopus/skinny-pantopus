/**
 * Feature flag routes — Phase 0 P0.8.
 *
 * Two endpoints:
 *
 *   GET /api/feature-flags/:flagName
 *     Authenticated. Returns ONLY `{ flagName, enabled }` for the
 *     calling user — never the full flag row, beta_user_ids, or any
 *     other user's enablement state.
 *
 *   POST /api/admin/feature-flags/:flagName
 *     Admin auth (verifyToken.requireAdmin). Accepts a JSON body with
 *     any subset of { enabled_globally, enabled_for_internal_team,
 *     beta_user_ids, description } and updates the flag, invalidating
 *     the in-process cache. Writes an IdentityAuditLog entry so the
 *     who-flipped-what record exists.
 */

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const Joi = require('joi');
const logger = require('../utils/logger');
const { isFeatureEnabled, getFlag, setFlag } = require('../services/featureFlagService');
const { writeIdentityAuditLog } = require('../utils/identityAudit');

const FLAG_NAME_RE = /^[a-z][a-z0-9_]{1,63}$/;

router.get('/feature-flags/:flagName', verifyToken, async (req, res) => {
  try {
    const { flagName } = req.params;
    if (!FLAG_NAME_RE.test(flagName)) {
      return res.status(400).json({ error: 'Invalid flag name' });
    }
    const enabled = await isFeatureEnabled(flagName, req.user);
    return res.json({ flagName, enabled });
  } catch (err) {
    logger.error('feature_flags.get.error', { error: err.message, flagName: req.params.flagName });
    return res.status(500).json({ error: 'Failed to read feature flag' });
  }
});

const adminUpdateSchema = Joi.object({
  enabled_globally: Joi.boolean().optional(),
  enabled_for_internal_team: Joi.boolean().optional(),
  beta_user_ids: Joi.array().items(Joi.string().uuid()).optional(),
  description: Joi.string().max(500).optional(),
}).min(1);

router.post(
  '/admin/feature-flags/:flagName',
  verifyToken,
  verifyToken.requireAdmin,
  validate(adminUpdateSchema),
  async (req, res) => {
    try {
      const { flagName } = req.params;
      if (!FLAG_NAME_RE.test(flagName)) {
        return res.status(400).json({ error: 'Invalid flag name' });
      }
      const existing = await getFlag(flagName);
      if (!existing) return res.status(404).json({ error: 'Feature flag not found' });

      const updated = await setFlag(flagName, req.body);
      if (!updated) return res.status(500).json({ error: 'Failed to update feature flag' });

      // Audit-log the change. Capture the diff at field granularity so the
      // record is useful when reviewing which admin enabled what when.
      const diff = {};
      for (const key of Object.keys(req.body)) {
        diff[key] = { previous: existing[key] ?? null, next: updated[key] ?? null };
      }
      await writeIdentityAuditLog({
        req,
        actorUserId: req.user.id,
        action: 'feature_flag.updated',
        targetType: 'FeatureFlag',
        targetId: flagName,
        metadata: { flag_name: flagName, diff },
      });

      // Public-shape response: never echo beta_user_ids back to the admin
      // who isn't part of the audit trail. The admin already knows what
      // they set; this prevents accidental logging of large beta cohorts.
      return res.json({
        flagName,
        enabled_globally: updated.enabled_globally,
        enabled_for_internal_team: updated.enabled_for_internal_team,
        beta_user_count: Array.isArray(updated.beta_user_ids) ? updated.beta_user_ids.length : 0,
        description: updated.description || null,
        updated_at: updated.updated_at,
      });
    } catch (err) {
      logger.error('feature_flags.admin_update.error', { error: err.message, flagName: req.params.flagName });
      return res.status(500).json({ error: 'Failed to update feature flag' });
    }
  },
);

module.exports = router;
