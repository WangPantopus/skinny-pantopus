const express = require('express');
const rateLimit = require('express-rate-limit');
const verifyToken = require('../middleware/verifyToken');
const share = require('../services/homeExternalShareService');
const router = express.Router();

// Bearer links allow an anonymous visitor only when no credentials were sent.
// Invalid supplied credentials must never remove a recipient's restrictions.
function optionalVerifiedRecipient(req, res, next) {
  if (req.headers?.authorization !== undefined || req.cookies?.pantopus_access !== undefined) {
    return verifyToken(req, res, next);
  }
  return next();
}

const viewLimiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'Too many share requests. Please try again shortly.' } });
function sendFailure(res, error) {
  return res.status(error.statusCode || 503).json({ error: error.code ? error.message : 'Could not load the share link. Please retry.',
    code: error.code || 'SHARE_UNAVAILABLE', ...(error.requiresPasscode ? { requiresPasscode: true } : {}) });
}
function privateResponse(res) {
  res.set('Cache-Control', 'private, no-store');
  res.set('Referrer-Policy', 'no-referrer');
  res.set('X-Content-Type-Options', 'nosniff');
}
for (const [path, kind] of [['/guest/:token', 'guest'], ['/shared/:token', 'scoped']]) {
  router.get(path, viewLimiter, optionalVerifiedRecipient, async (req, res) => {
    privateResponse(res);
    try {
      return res.json(await share.read({ kind, token: req.params.token,
        recipientId: req.user?.id || null, passcode: req.query.passcode }));
    } catch (error) { return sendFailure(res, error); }
  });
}
router.get('/shared-documents/:receipt/:documentId', viewLimiter, optionalVerifiedRecipient, async (req, res) => {
  privateResponse(res);
  try {
    const document = await share.download({ receipt: req.params.receipt, documentId: req.params.documentId,
      recipientId: req.user?.id || null });
    res.type(document.mimeType || 'application/octet-stream');
    // Attachment prevents an uploaded document from executing in the app origin.
    res.attachment(String(document.title || 'Shared document').replace(/[\r\n]/g, ' ').slice(0,180));
    return res.send(document.bytes);
  } catch (error) { return sendFailure(res, error); }
});
module.exports = router;
