const crypto = require('crypto');

/**
 * Attach a unique requestId to every incoming request.
 * Downstream handlers can read req.requestId for structured logging.
 */
function requestId(req, _res, next) {
  req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
  next();
}

module.exports = requestId;
