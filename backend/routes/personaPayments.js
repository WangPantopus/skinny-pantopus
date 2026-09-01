// Stripe Connect onboarding + status routes for persona owners.
// Audience Profile design v2 §8.1, §10.
//
// Mounted at /api/personas/:id/payments. Mirrors the personaTiers.js
// router pattern: top-level UUID gate so non-UUID URLs fall through to
// the personas.js public router; verifyToken + requireFeatureFlag
// gate the rest. Owner-only — non-owners get 404.

const express = require('express');
const router = express.Router({ mergeParams: true });

const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const requireFeatureFlag = require('../middleware/requireFeatureFlag');
const logger = require('../utils/logger');
const personaPaymentsService = require('../services/personaPaymentsService');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
router.use((req, _res, next) => {
  if (!UUID_RE.test(req.params.id || '')) return next('router');
  return next();
});

router.use(verifyToken, requireFeatureFlag('audience_profile'));

async function loadOwnedPersona(req, res) {
  const { data: persona, error } = await supabaseAdmin
    .from('PublicPersona')
    .select('id, user_id, handle, display_name, status')
    .eq('id', req.params.id)
    .maybeSingle();
  if (error) {
    logger.error('persona_payments.lookup_error', {
      personaId: req.params.id, error: error.message,
    });
    res.status(500).json({ error: 'Internal error' });
    return null;
  }
  if (!persona) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }
  if (persona.user_id !== req.user.id) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }
  return persona;
}

// POST /api/personas/:id/payments/onboard
//
// Ensures a Connect Express account exists with persona-aware business
// profile, then returns a fresh onboarding link. The wizard's Step 3
// (P1.6) opens the URL in the same tab; Stripe sends the user back to
// /app/audience/setup?step=stripe&done=1 after onboarding.
router.post('/onboard', async (req, res) => {
  const persona = await loadOwnedPersona(req, res);
  if (!persona) return;
  try {
    await personaPaymentsService.ensureConnectAccountForPersona(persona);
    const link = await personaPaymentsService.createOnboardingLinkForPersona(persona);
    return res.json({ url: link.url, expiresAt: link.expiresAt });
  } catch (err) {
    logger.error('persona_payments.onboard_error', {
      personaId: persona.id, error: err.message,
    });
    return res.status(500).json({ error: 'Could not start Stripe onboarding' });
  }
});

// GET /api/personas/:id/payments/status
router.get('/status', async (req, res) => {
  const persona = await loadOwnedPersona(req, res);
  if (!persona) return;
  try {
    const status = await personaPaymentsService.getOnboardingStatus(persona);
    return res.json({ status });
  } catch (err) {
    logger.error('persona_payments.status_error', {
      personaId: persona.id, error: err.message,
    });
    return res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
