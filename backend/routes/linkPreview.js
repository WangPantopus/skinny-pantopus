/**
 * Link Preview endpoint — fetches a URL and extracts Open Graph metadata.
 *
 * GET /api/link-preview?url=https://example.com/article
 *
 * Returns: { title, description, image, siteName, url }
 *
 * Requires authentication (verifyToken) to prevent abuse.
 * Results are cached in-memory for 1 hour.
 */

const express = require('express');
const router = express.Router();
const cheerio = require('cheerio');
const http = require('node:http');
const https = require('node:https');
const dns = require('node:dns');
const net = require('node:net');
const ipaddr = require('ipaddr.js');
const rateLimit = require('express-rate-limit');
const verifyToken = require('../middleware/verifyToken');
const logger = require('../utils/logger');

// ── In-memory cache (1h TTL, max 500 entries) ────────────────
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const CACHE_MAX = 500;
const cache = new Map();

function getCached(url) {
  const entry = cache.get(url);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    cache.delete(url);
    return null;
  }
  return entry.data;
}

function setCache(url, data) {
  if (cache.size >= CACHE_MAX) {
    // Evict oldest entry
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(url, { data, ts: Date.now() });
}

const MAX_BODY_BYTES = 512 * 1024;
const MAX_URL_LENGTH = 2048;
const previewLimiter = rateLimit({
  windowMs: 60_000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false,
  keyGenerator: req => req.user.id,
  message: { error: 'Too many preview requests. Please try again shortly.' },
});
let activeFetches = 0;
const userFetches = new Map();

function previewError(message, status = 502) {
  return Object.assign(new Error(message), { status });
}

function publicAddress(address) {
  try {
    // process also normalizes IPv4-mapped IPv6. Only global unicast is allowed:
    // no loopback, link-local/metadata, private, multicast or transition ranges.
    return ipaddr.process(address).range() === 'unicast';
  } catch { return false; }
}

function parsePublicUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw previewError('Invalid or blocked URL', 400); }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (value.length > MAX_URL_LENGTH || !['http:', 'https:'].includes(url.protocol)
      || url.username || url.password || (net.isIP(host) && !publicAddress(host))) {
    throw previewError('Invalid or blocked URL', 400);
  }
  return url;
}

// Validate DNS at the actual connection's lookup, and return only those checked
// addresses to the socket. There is no second lookup between checking and using
// them. New connections and redirects repeat the check; TLS still verifies the
// original hostname. Mixed public/private answers are refused in their entirety.
function publicLookup(hostname, options, callback) {
  dns.lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
    if (error) return callback(error);
    if (!addresses.length || addresses.some(({ address }) => !publicAddress(address))) {
      return callback(previewError('Invalid or blocked URL', 400));
    }
    if (options.all) return callback(null, addresses);
    return callback(null, addresses[0].address, addresses[0].family);
  });
}

function fetchHtml(url, signal) {
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? https : http).get(url, {
      agent: false, lookup: publicLookup, signal, maxHeaderSize: 16 * 1024,
      headers: { 'User-Agent': 'PantopusBot/1.0 (+https://pantopus.com)',
        Accept: 'text/html,application/xhtml+xml', 'Accept-Encoding': 'identity' },
    }, response => {
      const stop = error => { response.destroy(); reject(error); };
      response.on('error', reject);
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        const location = response.headers.location;
        response.destroy();
        return resolve({ location });
      }
      if (response.statusCode < 200 || response.statusCode >= 300) return stop(previewError('Failed to fetch URL'));
      if (!/^(text\/html|application\/xhtml\+xml)(?:\s*;|$)/i.test(response.headers['content-type'] || '')) {
        return stop(previewError('URL does not return HTML', 422));
      }
      if (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity') {
        return stop(previewError('Unsupported preview encoding', 422));
      }
      if (Number(response.headers['content-length']) > MAX_BODY_BYTES) return stop(previewError('Preview is too large', 422));
      const chunks = [];
      let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) return stop(previewError('Preview is too large', 422));
        chunks.push(chunk);
      });
      response.on('end', () => resolve({ html: Buffer.concat(chunks, size).toString('utf8') }));
    });
    request.on('error', reject);
    request.on('upgrade', (_response, socket) => { socket.destroy(); reject(previewError('Failed to fetch URL')); });
  });
}

// ── Extract OG metadata from HTML ────────────────────────────
function extractMetadata(html, requestedUrl) {
  const $ = cheerio.load(html);

  const get = (selectors) => {
    for (const sel of selectors) {
      const val = $(sel).attr('content') || $(sel).attr('value');
      if (val && val.trim()) return val.trim();
    }
    return null;
  };

  const title = get([
    'meta[property="og:title"]',
    'meta[name="twitter:title"]',
  ]) || $('title').text().trim() || null;

  const description = get([
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
    'meta[name="description"]',
  ]) || null;

  const image = get([
    'meta[property="og:image"]',
    'meta[name="twitter:image"]',
    'meta[name="twitter:image:src"]',
  ]) || null;

  const siteName = get([
    'meta[property="og:site_name"]',
  ]) || null;

  // Resolve relative image URLs
  let resolvedImage = null;
  if (image && image.length <= MAX_URL_LENGTH) {
    try {
      resolvedImage = parsePublicUrl(new URL(image, requestedUrl).href).href;
    } catch {
      resolvedImage = null;
    }
  }

  return {
    title: title ? title.slice(0, 300) : null,
    description: description ? description.slice(0, 500) : null,
    image: resolvedImage,
    siteName: siteName ? siteName.slice(0, 200) : null,
    url: requestedUrl,
  };
}

// ── Route ────────────────────────────────────────────────────
router.get('/', verifyToken, previewLimiter, async (req, res) => {
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  let target;
  try { target = parsePublicUrl(url); } catch {
    return res.status(400).json({ error: 'Invalid or blocked URL' });
  }

  // Check cache
  const cached = getCached(url);
  if (cached) {
    return res.json(cached);
  }

  const userId = req.user.id;
  if (activeFetches >= 8 || (userFetches.get(userId) || 0) >= 2) {
    return res.status(429).json({ error: 'Preview service is busy. Please try again shortly.' });
  }
  activeFetches += 1;
  userFetches.set(userId, (userFetches.get(userId) || 0) + 1);
  const controller = new AbortController();
  // One deadline covers DNS, redirects, headers and the entire streamed body.
  const timeout = setTimeout(() => controller.abort(), 5000);
  const onClose = () => controller.abort();
  res.on('close', onClose);
  try {
    let result;
    for (let redirects = 0; redirects <= 3; redirects += 1) {
      result = await fetchHtml(target, controller.signal);
      if (result.html !== undefined) break;
      if (!result.location || redirects === 3) throw previewError('Too many or invalid redirects');
      target = parsePublicUrl(new URL(result.location, target).href);
    }
    const metadata = { ...extractMetadata(result.html, target.href), url };
    setCache(url, metadata);

    return res.json(metadata);
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Timeout fetching URL' });
    }
    // URLs can contain private query strings; never put them in operator logs.
    logger.warn('link-preview fetch failed', { code: err.code || 'PREVIEW_FAILED' });
    return res.status(err.status || 502).json({ error: err.status ? err.message : 'Failed to fetch URL' });
  } finally {
    clearTimeout(timeout);
    res.off('close', onClose);
    activeFetches -= 1;
    const remaining = userFetches.get(userId) - 1;
    if (remaining) userFetches.set(userId, remaining); else userFetches.delete(userId);
  }
});

module.exports = router;
