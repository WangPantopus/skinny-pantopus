const router = require('express').Router();
const verifyToken = require('../middleware/verifyToken');
const { getRequestSessionScope, requireExpectedSessionScope } = require('../utils/requestSessionScope');
const service = require('../services/homeResidencyClaimsService');
const noStore = (_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); };

// These specific routes apply private headers before authentication, including
// 401/errors. Mount before dynamic Home routes; do not affect unrelated routes.
router.get('/residency-claims/session', noStore, verifyToken, (req, res) => {
  try {
    if (Object.keys(req.query).length) return service.sendError(res, { code: 'RESIDENCY_CLAIMS_INVALID', statusCode: 400 });
    res.json({ session: getRequestSessionScope(req) });
  } catch (error) { service.sendError(res, error); }
});
router.get('/:homeId/claims', noStore, verifyToken, async (req, res) => {
  try {
    // Older callers may omit this consistency fence. Every caller still needs
    // authenticated current authority inside the transactional list RPC.
    if (!requireExpectedSessionScope(req, res)) return;
    if (Object.keys(req.query).length) return service.sendError(res, { code: 'RESIDENCY_CLAIMS_INVALID', statusCode: 400 });
    const session = getRequestSessionScope(req);
    const result = await service.list({ homeId: req.params.homeId, actorId: req.user.id });
    res.json({ ...result, residency_session: { ...session, home_id: result.home_id } });
  } catch (error) { service.sendError(res, error); }
});
module.exports = router;
