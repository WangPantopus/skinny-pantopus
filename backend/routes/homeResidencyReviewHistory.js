const router = require('express').Router();
const verifyToken = require('../middleware/verifyToken');
const { getRequestSessionScope, requireExpectedSessionScope } = require('../utils/requestSessionScope');
const service = require('../services/homeResidencyReviewHistoryService');
const { wantsDisplayNames, addDisplayNames } = require('../utils/householdDisplayNames');

// Even unauthenticated/error replies must not be cached as private history.
router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
router.use(verifyToken);
router.get('/session', (req, res) => {
  try { res.json({ session: getRequestSessionScope(req) }); }
  catch (error) { service.sendError(res, error); }
});
router.use((req, res, next) => { if (requireExpectedSessionScope(req, res, { required: true })) next(); });
router.get('/:homeId', async (req, res) => {
  try {
    if (Object.keys(req.query).some(key => key !== 'after')) {
      return service.sendError(res, { code: 'RESIDENCY_HISTORY_INVALID', statusCode: 400 });
    }
    const result = await service.list({ actorId: req.user.id, homeId: req.params.homeId, after: req.query.after });
    if (wantsDisplayNames(req)) await addDisplayNames(result.items.map(entry => entry.current.applicant));
    res.json({ ...result, session: getRequestSessionScope(req) });
  } catch (error) { service.sendError(res, error); }
});
router.get('/:homeId/:receiptId', async (req, res) => {
  try {
    if (Object.keys(req.query).length) return service.sendError(res, { code: 'RESIDENCY_HISTORY_INVALID', statusCode: 400 });
    const result = await service.read({ actorId: req.user.id, homeId: req.params.homeId, receiptId: req.params.receiptId });
    if (wantsDisplayNames(req)) await addDisplayNames([result.item.current.applicant]);
    res.json({ ...result, session: getRequestSessionScope(req) });
  } catch (error) { service.sendError(res, error); }
});
module.exports = router;
