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
const zlib = require('node:zlib');
const ipaddr = require('ipaddr.js');
const rateLimit = require('express-rate-limit');
const verifyToken = require('../middleware/verifyToken');
const logger = require('../utils/logger');

// ── In-memory cache (1h TTL, max 500 entries) ────────────────
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const CACHE_MAX = 500;
const cache = new Map();

// A failed URL is remembered briefly, so a slow or broken link in a busy feed
// costs one fetch a minute instead of one per viewer.
const FAILURE_TTL = 60 * 1000;

/** @returns {{data:object}|{failure:{status:number, error:string}}|null} */
function getCached(url) {
  const entry = cache.get(url);
  if (!entry) return null;
  if (Date.now() - entry.ts > entry.ttl) {
    cache.delete(url);
    return null;
  }
  return entry;
}

function setCache(url, entry, ttl = CACHE_TTL) {
  if (cache.size >= CACHE_MAX) {
    // Evict oldest entry
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(url, { ...entry, ts: Date.now(), ttl });
}

const MAX_BODY_BYTES = 512 * 1024;
const MAX_URL_LENGTH = 2048;
const FETCH_DEADLINE_MS = 5000;
const previewLimiter = rateLimit({
  windowMs: 60_000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false,
  keyGenerator: req => req.user.id,
  message: { error: 'Too many preview requests. Please try again shortly.' },
});

// Fetch slots per API process. A feed asks for several previews at once, so a
// request over a person's share waits for a slot within its deadline instead of
// failing (the web caches a failed preview for the page's life). The share
// still bounds how much of the pool one account can hold with slow links.
const MAX_ACTIVE_FETCHES = 16;
const MAX_USER_ACTIVE_FETCHES = 3;
const MAX_USER_PENDING = 12;
const BUSY_MESSAGE = 'Preview service is busy. Please try again shortly.';
let activeFetches = 0;
const userActive = new Map();
const userPending = new Map();
const waiting = [];
// Concurrent requests for one URL share a single fetch, as the cache does.
const inflight = new Map();

function previewError(message, status = 502) {
  return Object.assign(new Error(message), { status });
}

function adjust(counts, key, delta) {
  const next = (counts.get(key) || 0) + delta;
  if (next > 0) counts.set(key, next); else counts.delete(key);
}

function canStart(userId) {
  return activeFetches < MAX_ACTIVE_FETCHES && (userActive.get(userId) || 0) < MAX_USER_ACTIVE_FETCHES;
}

function acquireSlot(userId, signal) {
  if ((userPending.get(userId) || 0) >= MAX_USER_PENDING) return Promise.reject(previewError(BUSY_MESSAGE, 429));
  if (signal.aborted) return Promise.reject(previewError(BUSY_MESSAGE, 503));
  adjust(userPending, userId, 1);
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      const index = waiting.indexOf(waiter);
      if (index >= 0) waiting.splice(index, 1);
      adjust(userPending, userId, -1);
      reject(previewError(BUSY_MESSAGE, 503));
    };
    const waiter = {
      userId,
      start() {
        signal.removeEventListener('abort', onAbort);
        activeFetches += 1;
        adjust(userActive, userId, 1);
        resolve();
      },
    };
    if (canStart(userId)) return waiter.start();
    signal.addEventListener('abort', onAbort, { once: true });
    waiting.push(waiter);
  });
}

function releaseSlot(userId) {
  activeFetches -= 1;
  adjust(userActive, userId, -1);
  adjust(userPending, userId, -1);
  for (let i = 0; i < waiting.length && activeFetches < MAX_ACTIVE_FETCHES;) {
    if (canStart(waiting[i].userId)) waiting.splice(i, 1)[0].start();
    else i += 1;
  }
}

function publicAddress(address) {
  try {
    // process also normalizes IPv4-mapped IPv6. Only global unicast is allowed:
    // no loopback, link-local/metadata, private, multicast or transition ranges.
    const parsed = ipaddr.process(address);
    // ipaddr.js calls the deprecated IPv4-compatible block (::/96, e.g.
    // ::7f00:1 for 127.0.0.1) unicast; no public host answers from it.
    if (parsed.kind() === 'ipv6' && parsed.parts.slice(0, 6).every(part => part === 0)) return false;
    return parsed.range() === 'unicast';
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

const DECODERS = {
  gzip: () => zlib.createGunzip(),
  'x-gzip': () => zlib.createGunzip(),
  deflate: () => zlib.createInflate(),
  br: () => zlib.createBrotliDecompress(),
};

function fetchHtml(url, signal) {
  return new Promise((resolve, reject) => {
    let decoder = null;
    const fail = error => { decoder?.destroy(); reject(error); };
    const request = (url.protocol === 'https:' ? https : http).get(url, {
      agent: false, lookup: publicLookup, signal, maxHeaderSize: 16 * 1024,
      headers: { 'User-Agent': 'PantopusBot/1.0 (+https://pantopus.com)',
        Accept: 'text/html,application/xhtml+xml', 'Accept-Encoding': 'gzip, deflate, br' },
    }, response => {
      const stop = error => { response.destroy(); fail(error); };
      response.on('error', fail);
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        const location = response.headers.location;
        response.destroy();
        return resolve({ location });
      }
      if (response.statusCode < 200 || response.statusCode >= 300) return stop(previewError('Failed to fetch URL'));
      if (!/^(text\/html|application\/xhtml\+xml)(?:\s*;|$)/i.test(response.headers['content-type'] || '')) {
        return stop(previewError('URL does not return HTML', 422));
      }
      const encoding = String(response.headers['content-encoding'] || 'identity').trim().toLowerCase();
      if (encoding !== 'identity' && !DECODERS[encoding]) return stop(previewError('Unsupported preview encoding', 422));
      // Preview tags live in <head>: read until it closes or the byte ceiling,
      // whichever comes first, and cancel the rest. Big pages (video, news,
      // code hosts) still preview; nothing past the ceiling is ever buffered.
      const chunks = [];
      let size = 0;
      let tail = '';
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        response.destroy();
        decoder?.destroy();
        resolve({ html: Buffer.concat(chunks, size).toString('utf8') });
      };
      let body = response;
      if (encoding !== 'identity') {
        // The ceiling covers the bytes received and the decoded HTML alike.
        let received = 0;
        response.on('data', chunk => {
          received += chunk.length;
          if (received >= MAX_BODY_BYTES) finish();
        });
        decoder = DECODERS[encoding]();
        decoder.on('error', () => stop(previewError('Failed to fetch URL')));
        body = response.pipe(decoder);
      }
      body.on('data', chunk => {
        if (done) return;
        const kept = chunk.subarray(0, MAX_BODY_BYTES - size);
        chunks.push(kept);
        size += kept.length;
        const text = tail + kept.toString('latin1');
        if (size >= MAX_BODY_BYTES || /<\/head[\s>]/i.test(text)) return finish();
        tail = text.slice(-8);
      });
      body.on('end', finish);
    });
    request.on('error', fail);
    request.on('upgrade', (_response, socket) => { socket.destroy(); fail(previewError('Failed to fetch URL')); });
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

async function loadPreview(url, target, userId) {
  const controller = new AbortController();
  // One deadline covers the wait for a slot, DNS, redirects, headers and the
  // entire streamed body.
  const timeout = setTimeout(() => controller.abort(), FETCH_DEADLINE_MS);
  const queuedAt = Date.now();
  try {
    await acquireSlot(userId, controller.signal);
    // A timeout after a long wait for a slot says nothing about the link.
    const fullWindow = Date.now() - queuedAt < 1000;
    try {
      let result;
      for (let redirects = 0; redirects <= 3; redirects += 1) {
        result = await fetchHtml(target, controller.signal);
        if (result.html !== undefined) break;
        if (!result.location || redirects === 3) throw previewError('Too many or invalid redirects');
        target = parsePublicUrl(new URL(result.location, target).href);
      }
      const metadata = { ...extractMetadata(result.html, target.href), url };
      setCache(url, { data: metadata });
      return metadata;
    } catch (err) {
      const failure = err.name === 'AbortError'
        ? { status: 504, error: 'Timeout fetching URL' }
        : { status: err.status || 502, error: err.status ? err.message : 'Failed to fetch URL' };
      if (failure.status !== 504 || fullWindow) setCache(url, { failure }, FAILURE_TTL);
      throw Object.assign(previewError(failure.error, failure.status), { code: err.code });
    } finally {
      releaseSlot(userId);
    }
  } finally {
    clearTimeout(timeout);
  }
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
  if (cached?.failure) return res.status(cached.failure.status).json({ error: cached.failure.error });
  if (cached) return res.json(cached.data);

  try {
    let pending = inflight.get(url);
    if (!pending) {
      pending = loadPreview(url, target, req.user.id).finally(() => inflight.delete(url));
      inflight.set(url, pending);
    }
    return res.json(await pending);
  } catch (err) {
    // URLs can contain private query strings; never put them in operator logs.
    logger.warn('link-preview fetch failed', { code: err.code || 'PREVIEW_FAILED', status: err.status || 502 });
    return res.status(err.status || 502).json({ error: err.status ? err.message : 'Failed to fetch URL' });
  }
});

module.exports = router;
