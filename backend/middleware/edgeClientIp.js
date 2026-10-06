const crypto = require('crypto');

/**
 * The visitor's address for requests the web forwards to this API.
 *
 * The web reaches the API through Vercel rewrites (`/api/*`, `/socket.io/*`): Vercel writes
 * the visitor's address into X-Forwarded-For and the server's own proxy appends Vercel's.
 * With only the server's proxies trusted (`trust proxy`), `req.ip` is therefore Vercel's
 * address, so every web visitor shares one rate-limit budget (sign-in, sign-up, anonymous
 * writes) and sessions record Vercel's address. The web's middleware adds the shared
 * EDGE_PROXY_SECRET to the requests it forwards; only then is the address one hop further
 * out trusted. Direct clients can't set it, so they can't choose their own address.
 */
const HEADER = 'x-pantopus-edge';

function secretMatches(given, secret) {
  const a = Buffer.from(String(given));
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function edgeClientIp(req, _res, next) {
  const given = req.headers[HEADER];
  if (given === undefined) return next();
  delete req.headers[HEADER];
  const secret = process.env.EDGE_PROXY_SECRET || '';
  if (!secret || !secretMatches(given, secret)) return next();

  const hops = String(req.headers['x-forwarded-for'] || '')
    .split(',')
    .map((hop) => hop.trim())
    .filter(Boolean);
  const edge = hops.lastIndexOf(req.ip);
  if (edge > 0) {
    Object.defineProperty(req, 'ip', { value: hops[edge - 1], configurable: true, enumerable: true, writable: true });
  }
  return next();
}

module.exports = edgeClientIp;
