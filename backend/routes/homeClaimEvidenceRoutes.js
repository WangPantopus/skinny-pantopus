const multer = require('multer');
const evidence = require('../services/homeClaimEvidenceService');
const { MAX_BYTES } = require('../services/homeClaimEvidenceStorage');
const { getRequestSessionScope, requireExpectedSessionScope } = require('../utils/requestSessionScope');

const multipart = multer({ storage: multer.memoryStorage(), limits: {
  fileSize: MAX_BYTES, files: 1, fields: 2, fieldSize: 100, parts: 4,
} }).single('file');
function args(req) {
  return { homeId: req.params.homeId, claimId: req.params.claimId, actorId: req.user.id,
    uploadId: req.params.evidenceId, platformAdmin: req.query.review === 'platform' };
}
function expectedScope(req, res, next) {
  if (requireExpectedSessionScope(req, res, { required: true })) next();
}
module.exports = function registerHomeClaimEvidenceRoutes(router, { verifyToken, evidenceUploadLimiter }) {
  router.post('/ownership-evidence/:homeId/:claimId', verifyToken, evidenceUploadLimiter,
    (req, res, next) => { if (requireExpectedSessionScope(req, res)) next(); },
    async (req, res, next) => {
      try { await evidence.authorize(args(req), 'upload'); next(); } catch (error) { evidence.sendError(res, error); }
    }, (req, res, next) => multipart(req, res, error => {
      if (error) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400)
        .json({ code: 'CLAIM_EVIDENCE_INVALID', error: 'Choose one document of 25 MB or less.' });
      return next();
    }), async (req, res) => {
      try {
        const record = await evidence.upload({ ...args(req), uploadId: req.body?.upload_id,
          evidenceType: req.body?.evidence_type }, req.file);
        res.json({ message: 'Private evidence saved for review.', evidence: record });
      } catch (error) { evidence.sendError(res, error); }
    });
  router.get('/home-claim-evidence/:homeId/:claimId', verifyToken, async (req, res) => {
    try {
      if (!requireExpectedSessionScope(req, res)) return;
      res.set('Cache-Control', 'private, no-store');
      res.json({ ...await evidence.list(args(req)), claim_session: { ...getRequestSessionScope(req),
        home_id: req.params.homeId, claim_id: req.params.claimId } });
    } catch (error) { evidence.sendError(res, error); }
  });
  router.get('/home-claim-evidence/:homeId/:claimId/:evidenceId/download', verifyToken, expectedScope, async (req, res) => {
    try {
      const { record, bytes, inspection } = await evidence.download({ ...args(req), reviewToken: req.query.review_token });
      res.set('Cache-Control', 'private, no-store');
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('Content-Type', record.mime_type);
      if (inspection) {
        res.set('X-Claim-Evidence-Inspection', inspection);
        res.set('Access-Control-Expose-Headers', 'X-Claim-Evidence-Inspection');
      }
      const name = record.file_name.replace(/[^\x20-\x7e]|["\\]/g, '_');
      res.set('Content-Disposition', `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(record.file_name).replace(/['()*]/g,
        c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`);
      res.send(bytes);
    } catch (error) { evidence.sendError(res, error); }
  });
  router.post('/home-claim-evidence/:homeId/:claimId/:evidenceId/verify', verifyToken, expectedScope, async (req, res) => {
    try {
      res.json(await evidence.verify({ ...args(req), reviewToken: req.body?.review_token, inspection: req.body?.inspection }));
    } catch (error) { evidence.sendError(res, error); }
  });
  router.delete('/home-claim-evidence/:homeId/:claimId/:evidenceId', verifyToken, expectedScope, async (req, res) => {
    try { res.json({ evidence: await evidence.remove(args(req)) }); } catch (error) { evidence.sendError(res, error); }
  });
};
