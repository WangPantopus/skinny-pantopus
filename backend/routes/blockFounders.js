// ============================================================
// BLOCK FOUNDERS ROUTES (Wave 3, final slice)
//
//   GET  /api/homes/:id/block-founders           rank + meters + budget
//   POST /api/homes/:id/block-founders/invites   send one postcard invite
//
// Mounted at /api/homes BEFORE the generic home router. Both routes
// are hard-gated to VERIFIED occupants: the rank is a claim only a
// verified home can hold, the meters surface the raw insider count
// (densityReader.readRawCountForVerifiedInsider's contract), and
// invites spend real money in the sender's name.
//
// The recipient-controlled opt-out lives in routes/public.js
// (POST /api/public/block-invites/opt-out/:code).
// ============================================================

const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/verifyToken');
const { checkHomePermission, isVerifiedResident } = require('../utils/homePermissions');
const { homeOutboundLimiter } = require('../middleware/rateLimiter');
const blockFoundersService = require('../services/blockFoundersService');
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

async function gatedHome(req, res) {
  const { id } = req.params;
  const userId = req.user.id;
  const access = await checkHomePermission(id, userId);
  if (!access.hasAccess) {
    res.status(403).json({ error: 'You do not have access to this place.' });
    return null;
  }
  if (!isVerifiedResident(access)) {
    res.status(403).json({
      error: 'Verify your address to see your block’s founders.',
      code: 'VERIFICATION_REQUIRED',
    });
    return null;
  }
  const { data: home } = await supabaseAdmin
    .from('Home')
    .select('id, address, map_center_lat, map_center_lng')
    .eq('id', id)
    .maybeSingle();
  if (!home) {
    res.status(404).json({ error: 'Home not found.' });
    return null;
  }
  return { home, userId };
}

// GET /api/homes/:id/block-founders
router.get('/:id/block-founders', verifyToken, async (req, res) => {
  try {
    const gated = await gatedHome(req, res);
    if (!gated) return undefined;
    const status = await blockFoundersService.getBlockStatus(gated);
    return res.json({ block: status });
  } catch (err) {
    logger.error('blockFounders: status failed', { homeId: req.params.id, error: err.message });
    return res.status(500).json({ error: 'Could not load your block.' });
  }
});

// POST /api/homes/:id/block-founders/invites
// homeOutboundLimiter: this is the ONE route in the Place surface that
// spends real money and puts physical mail in front of a stranger. The
// weekly cap bounds successful sends; this bounds ATTEMPTS, which the
// cap does not — a rejected send still costs a vendor round-trip.
router.post('/:id/block-founders/invites', verifyToken, homeOutboundLimiter, async (req, res) => {
  try {
    const gated = await gatedHome(req, res);
    if (!gated) return undefined;
    const result = await blockFoundersService.sendInvite({
      ...gated,
      recipient: req.body && req.body.recipient,
    });
    return res.status(201).json(result);
  } catch (err) {
    if (err instanceof blockFoundersService.BlockFoundersError) {
      const status = err.code === 'WEEKLY_CAP' ? 429 : err.code === 'SEND_FAILED' ? 502 : 400;
      return res.status(status).json({ error: err.message, code: err.code });
    }
    logger.error('blockFounders: invite failed', { homeId: req.params.id, error: err.message });
    return res.status(500).json({ error: 'Could not send the invitation.' });
  }
});

module.exports = router;
