const multer = require('multer');
const media = require('../services/homeTaskMediaService');
const { MAX_BYTES } = require('../services/homeTaskMediaStorage');
const { UUID } = require('../services/homeTaskMediaStorage');
const { getRequestSessionScope, requireExpectedSessionScope } = require('../utils/requestSessionScope');
const multipart = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1, fields: 1, fieldSize: 100, parts: 3 } }).single('file');
const args = req => ({ homeId: req.params.homeId, taskId: req.params.taskId, actorId: req.user.id, uploadId: req.params.mediaId });

module.exports = function registerHomeTaskMediaRoutes(router, { verifyToken, uploadLimiter }) {
  const scopeGuard = (req, res, next) => { if (requireExpectedSessionScope(req, res)) next(); };
  router.get('/home-task-media-session/:homeId', verifyToken, scopeGuard, (req, res) => {
    if (!UUID.test(req.params.homeId) || (req.query.task_id !== undefined && !UUID.test(req.query.task_id))) return res.status(400).json({ code: 'HOME_RECORD_INVALID' });
    res.set('Cache-Control', 'private, no-store');
    return res.json({ ...getRequestSessionScope(req), home_id: req.params.homeId, task_id: req.query.task_id || null });
  });
  router.post('/home-task-media/:homeId/:taskId', verifyToken, scopeGuard, uploadLimiter, async (req, res, next) => {
    try { await media.authorize(args(req), true); next(); } catch (error) { media.sendError(res, error); }
  }, (req, res, next) => multipart(req, res, error => {
    if (error) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400)
      .json({ error: 'Choose one attachment of 25 MB or less.', code: 'HOME_TASK_MEDIA_INVALID' });
    return next();
  }), async (req, res) => {
    try {
      const record = await media.upload({ ...args(req), uploadId: req.body?.upload_id }, req.file);
      res.json({ media: [record] });
    } catch (error) { media.sendError(res, error); }
  });
  router.get('/home-task-media/:homeId/:taskId', verifyToken, scopeGuard, async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    try { res.json(await media.list(args(req))); } catch (error) { media.sendError(res, error); }
  });
  router.get('/home-task-media/:homeId/:taskId/:mediaId/download', verifyToken, scopeGuard, async (req, res) => {
    try {
      const { record, bytes } = await media.download(args(req));
      res.set('Cache-Control', 'private, no-store');
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('Content-Type', record.mime_type);
      const name = record.file_name.replace(/[^\x20-\x7e]|["\\]/g, '_');
      res.set('Content-Disposition', `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(record.file_name).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`);
      res.send(bytes);
    } catch (error) { media.sendError(res, error); }
  });
  router.delete('/home-task-media/:homeId/:taskId/:mediaId', verifyToken, scopeGuard, async (req, res) => {
    try { res.json({ media: await media.remove(args(req)) }); } catch (error) { media.sendError(res, error); }
  });
};
