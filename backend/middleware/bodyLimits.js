// ============================================================
// Request bodies: small by default, larger only where a client needs it.
//
// app.js mounts this on /api after the per-IP write limiters, so a flood is
// turned away before any body is read, and only writes have their bodies read.
// JSON is held to 1 MB, which every request the apps send fits in. The one
// exception is Snap & Sell (POST /api/ai/draft/listing-vision), whose photos
// travel as base64 JSON: it may send up to 10 MB when the sender's access token
// verifies on this server, and only a few bodies that size are held at a time.
// A body whose declared length is over its limit is refused before any of it is
// read. No client sends urlencoded bodies; they get 100 KB.
//
// Structure costs more than size: 1 MB of `[{},{},…]` is 333,000 objects (35 ms
// to parse and about 50 MB of memory), and 20 MB of it took 0.8 s and 780 MB.
// So each JSON body is scanned before it's parsed, and one nested deeper than 64
// levels or holding more than 10,000 objects and arrays is refused.
// ============================================================

const express = require('express');
const logger = require('../utils/logger');
const { verifyLocally } = require('../services/accessTokenVerifier');

const MB = 1024 * 1024;
const JSON_LIMIT = MB;
const URLENCODED_LIMIT = 100 * 1024;
const MAX_DEPTH = 64;
const MAX_CONTAINERS = 10000;

// iOS and Android send Snap & Sell's (at most five) photos as 1600-px JPEGs, up
// to about 7 MB of base64. The web sends them as picked, but its Next middleware
// passes on only the first 10 MB of a body, so nothing larger arrives from it.
// The body is a few fields and one array.
const LARGE_BODY_ROUTES = [
  { method: 'POST', path: '/api/ai/draft/listing-vision', limit: 10 * MB, maxContainers: 16 },
];
// A body over the default limit holds a few times its size in memory until its
// answer is sent; this many are held at once, process-wide.
const MAX_LARGE_BODIES = 3;
let largeBodies = 0;

const isRead = (req) => req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';

function tooLarge() {
  return Object.assign(new Error('Request body is too large.'), { status: 413, type: 'entity.too.large' });
}

/**
 * A body-parser `verify` hook: refuses JSON that isn't UTF-8, or that nests
 * deeper than MAX_DEPTH or holds more than `maxContainers` objects and arrays,
 * before it's parsed. Strings are skipped with indexOf, so a long base64 photo
 * costs a memchr, not a loop.
 */
function shapeCheck(maxContainers) {
  return (req, res, buf, encoding) => {
    if (encoding !== 'utf-8') {
      throw Object.assign(new Error('Request body must be UTF-8 JSON.'), { status: 415, type: 'charset.unsupported' });
    }
    let depth = 0;
    let containers = 0;
    for (let i = 0; i < buf.length; i += 1) {
      const c = buf[i];
      if (c === 0x22) {
        // The string ends at the first quote not escaped by an odd run of backslashes.
        let end = i;
        for (;;) {
          end = buf.indexOf(0x22, end + 1);
          if (end === -1) return; // unterminated: JSON.parse refuses it
          let slashes = 0;
          while (buf[end - 1 - slashes] === 0x5c) slashes += 1;
          if (slashes % 2 === 0) break;
        }
        i = end;
      } else if (c === 0x7b || c === 0x5b) {
        depth += 1;
        containers += 1;
        if (depth > MAX_DEPTH || containers > maxContainers) throw tooLarge();
      } else if (c === 0x7d || c === 0x5d) {
        depth -= 1;
      }
    }
  };
}

const defaultJson = express.json({ limit: JSON_LIMIT, verify: shapeCheck(MAX_CONTAINERS) });
const urlencoded = express.urlencoded({ extended: true, limit: URLENCODED_LIMIT });
for (const route of LARGE_BODY_ROUTES) {
  route.json = express.json({ limit: route.limit, verify: shapeCheck(route.maxContainers) });
}

/** The token verifyToken will read: the apps' Bearer first, then the web's access cookie. */
function accessToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return req.cookies?.pantopus_access || null;
}

async function bodyLimits(req, res, next) {
  if (isRead(req)) return next();
  const isJson = Boolean(req.is('application/json'));
  if (!isJson) {
    if (!req.is('application/x-www-form-urlencoded')) return next(); // multipart and others read their own
    if (Number(req.headers['content-length']) > URLENCODED_LIMIT) return next(tooLarge());
    return urlencoded(req, res, next);
  }

  const length = Number(req.headers['content-length']);
  const path = req.originalUrl.split('?')[0];
  const route = LARGE_BODY_ROUTES.find((r) => r.method === req.method && r.path === path);
  if (!(length > JSON_LIMIT)) return defaultJson(req, res, next); // chunked bodies get the default limit too
  if (!route || length > route.limit) return next(tooLarge());

  try {
    const token = accessToken(req);
    const check = token ? await verifyLocally(token) : { status: 'none' };
    // An expired token gets the 401 verifyToken would give, so the app refreshes and resends.
    if (check.status === 'expired') return res.status(401).json({ error: 'Invalid or expired token' });
    if (check.status !== 'valid') return next(tooLarge());
  } catch (err) {
    return next(err);
  }

  if (largeBodies >= MAX_LARGE_BODIES) {
    logger.warn('body_limits.large_bodies_busy', { path, length, held: largeBodies });
    res.set('Retry-After', '5');
    return res.status(503).json({ error: 'The server is busy. Please try again in a moment.', code: 'BODY_BUSY' });
  }
  largeBodies += 1;
  res.once('close', () => { largeBodies -= 1; });
  return route.json(req, res, next);
}

module.exports = bodyLimits;
