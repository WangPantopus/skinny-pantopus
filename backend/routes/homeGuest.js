const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { clientIpKey } = require('../utils/clientIpKey');
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

// Per network (IP, IPv6 by its /64), so one IPv6 client can't step through its own /64 uncounted.
const viewLimiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false,
  keyGenerator: clientIpKey,
  message: { error: 'Too many share requests. Please try again shortly.' } });
// The web pages send the passcode percent-encoded in a header, so it stays out of
// URLs and the logs that record them. The query is still read for pages loaded
// before that change. A header that doesn't decode is refused as invalid.
function passcodeFrom(req) {
  const header = req.headers?.['x-pantopus-share-passcode'];
  if (header === undefined) return req.query?.passcode;
  try { return decodeURIComponent(header); } catch { return false; }
}
// A wrong passcode costs the guesser nothing else, so each link allows 10 wrong
// passcodes per 15 minutes, counted per link rather than per caller. Only a
// request that sends a passcode and is told it's wrong counts. Per process, like
// the other limiters.
const passcodeLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false,
  keyGenerator: req => `share-passcode:${crypto.createHash('sha256').update(String(req.params.token)).digest('hex')}`,
  skip: req => { const passcode = passcodeFrom(req); return passcode === undefined || passcode === null || passcode === ''; },
  skipSuccessfulRequests: true,
  requestWasSuccessful: (_req, res) => res.locals.shareCode !== 'SHARE_PASSCODE_REQUIRED',
  message: { error: 'Too many passcode attempts. Try again in 15 minutes.', code: 'SHARE_PASSCODE_ATTEMPTS' } });
function sendFailure(res, error) {
  res.locals.shareCode = error.code;
  return res.status(error.statusCode || 503).json({ error: error.code ? error.message : 'Could not load the share link. Please retry.',
    code: error.code || 'SHARE_UNAVAILABLE', ...(error.requiresPasscode ? { requiresPasscode: true } : {}) });
}
// The link names a document by its title, which has no extension, and a download
// without one doesn't open on a double-click. The stored type supplies it.
const EXTENSIONS = { 'application/pdf': '.pdf', 'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx', 'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx', 'text/plain': '.txt',
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/heic': '.heic', 'image/heif': '.heif' };
function downloadName(title, mimeType) {
  const name = String(title || 'Shared document').replace(/[\r\n]/g, ' ').slice(0,180);
  const extension = EXTENSIONS[mimeType];
  if (!extension) return name;
  const already = (extension === '.jpg' ? ['.jpg', '.jpeg'] : [extension]).some(end => name.toLowerCase().endsWith(end));
  return already ? name : `${name}${extension}`;
}
function privateResponse(res) {
  res.set('Cache-Control', 'private, no-store');
  res.set('Referrer-Policy', 'no-referrer');
  res.set('X-Content-Type-Options', 'nosniff');
}
for (const [path, kind] of [['/guest/:token', 'guest'], ['/shared/:token', 'scoped']]) {
  router.get(path, viewLimiter, optionalVerifiedRecipient, passcodeLimiter, async (req, res) => {
    privateResponse(res);
    try {
      return res.json(await share.read({ kind, token: req.params.token,
        recipientId: req.user?.id || null, passcode: passcodeFrom(req) }));
    } catch (error) { return sendFailure(res, error); }
  });
}
router.get('/shared-documents/:receipt/:documentId', viewLimiter, optionalVerifiedRecipient, async (req, res) => {
  privateResponse(res);
  try {
    const document = await share.download({ receipt: req.params.receipt, documentId: req.params.documentId,
      recipientId: req.user?.id || null });
    // Attachment prevents an uploaded document from executing in the app origin.
    res.attachment(downloadName(document.title, document.mimeType));
    // attachment() derives a type from the filename's extension, so the stored
    // MIME type must be applied after it or every download is octet-stream.
    res.type(document.mimeType || 'application/octet-stream');
    return res.send(document.bytes);
  } catch (error) { return sendFailure(res, error); }
});
module.exports = router;
