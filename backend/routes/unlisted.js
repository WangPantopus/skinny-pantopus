// ============================================================
// UNLISTED ROUTES (Wave 4 — the acquisition slice)
//
//   GET /api/homes/:id/unlisted                    profile + my progress
//   PUT /api/homes/:id/unlisted/removals/:brokerId record a step
//
// The anonymous half lives in routes/public.js
// (GET /api/public/unlisted?address=…) because it must sit behind the
// same preview limiter as the rest of T0 and must persist nothing.
//
// Progress is PERSONAL, not household: reads and writes are scoped to
// the caller inside the service. A household member must not be able to
// see that someone is erasing their address — that is precisely the
// fact most worth protecting here.
//
// Gate: home access only, NOT verification. Someone who has just claimed
// their address is exactly who needs this, and making them wait for a
// postcard to start removing themselves from people-search sites would
// invert the product.
// ============================================================

const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/verifyToken');
const { checkHomePermission } = require('../utils/homePermissions');
const supabaseAdmin = require('../config/supabaseAdmin');
const unlistedService = require('../services/unlistedService');
const logger = require('../utils/logger');

// GET /api/homes/:id/unlisted — the state profile plus my own progress
router.get('/:id/unlisted', verifyToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const access = await checkHomePermission(id, userId);
    // "We could not check" is not "you are not allowed". Telling a
    // resident they have no access to their own home because a query
    // failed is the more alarming of the two wrong answers, and 403 is
    // not auto-retried by either native client the way 5xx is.
    if (access.readFailed) {
      return res.status(500).json({ error: 'Could not load your removal list.' });
    }
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this place.' });
    }

    // PostgREST RESOLVES on both a transport failure and a non-2xx, so
    // `data` is null in both cases and the catch below is unreachable for
    // this read. Dropping `error` therefore turned a database blip into
    // "Home not found." — and the consequence is worse than the wrong
    // string: both native clients map 404 to a terminal error card with a
    // manual Try again, while a correctly typed 500 is auto-retried. So a
    // blip that should have been invisible becomes a dead end in front of
    // someone who came here under duress, unlogged and unpaged because
    // 404s are dashboard noise.
    const { data: home, error: homeError } = await supabaseAdmin
      .from('Home')
      .select('id, state')
      .eq('id', id)
      .maybeSingle();
    if (homeError) {
      logger.error('unlisted: home read failed', { homeId: id, userId, error: homeError.message });
      return res.status(500).json({ error: 'Could not load your removal list.' });
    }
    if (!home) return res.status(404).json({ error: 'Home not found.' });

    const profile = unlistedService.getExposureProfile(home.state);
    const removals = await unlistedService.listRemovals({ homeId: id, userId });
    return res.json({
      unlisted: {
        ...profile,
        // null (not []) when the read FAILED, so the client can say so
        // rather than showing a confident empty checklist.
        removals,
      },
    });
  } catch (err) {
    logger.error('unlisted: profile failed', { homeId: id, userId, error: err.message });
    return res.status(500).json({ error: 'Could not load your removal list.' });
  }
});

// PUT /api/homes/:id/unlisted/removals/:brokerId — record a step
router.put('/:id/unlisted/removals/:brokerId', verifyToken, async (req, res) => {
  const { id, brokerId } = req.params;
  const userId = req.user.id;
  try {
    const access = await checkHomePermission(id, userId);
    // "We could not check" is not "you are not allowed". Telling a
    // resident they have no access to their own home because a query
    // failed is the more alarming of the two wrong answers, and 403 is
    // not auto-retried by either native client the way 5xx is.
    if (access.readFailed) {
      return res.status(500).json({ error: 'Could not load your removal list.' });
    }
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this place.' });
    }
    const removal = await unlistedService.setRemovalStatus({
      homeId: id,
      userId,
      brokerId,
      status: req.body && req.body.status,
    });
    return res.json({ removal });
  } catch (err) {
    if (err instanceof unlistedService.UnlistedError) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    logger.error('unlisted: removal update failed', { homeId: id, userId, error: err.message });
    return res.status(500).json({ error: 'Could not save your progress.' });
  }
});

module.exports = router;
