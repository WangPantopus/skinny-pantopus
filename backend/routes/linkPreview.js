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

// ── Allowed URL patterns ────────────────────────────────────
const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]']);

function isAllowedUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    if (BLOCKED_HOSTS.has(parsed.hostname)) return false;
    // Block private IPs
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(parsed.hostname)) return false;
    return true;
  } catch {
    return false;
  }
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
  let resolvedImage = image;
  if (image && !image.startsWith('http')) {
    try {
      resolvedImage = new URL(image, requestedUrl).href;
    } catch {
      resolvedImage = null;
    }
  }

  return {
    title: title ? title.slice(0, 300) : null,
    description: description ? description.slice(0, 500) : null,
    image: resolvedImage,
    siteName,
    url: requestedUrl,
  };
}

// ── Route ────────────────────────────────────────────────────
router.get('/', verifyToken, async (req, res) => {
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  if (!isAllowedUrl(url)) {
    return res.status(400).json({ error: 'Invalid or blocked URL' });
  }

  // Check cache
  const cached = getCached(url);
  if (cached) {
    return res.json(cached);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'PantopusBot/1.0 (+https://pantopus.com)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(502).json({ error: 'Failed to fetch URL', status: response.status });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return res.status(422).json({ error: 'URL does not return HTML' });
    }

    // Limit body to 512KB to avoid memory issues
    const text = await response.text();
    const html = text.slice(0, 512 * 1024);

    const metadata = extractMetadata(html, url);
    setCache(url, metadata);

    return res.json(metadata);
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Timeout fetching URL' });
    }
    logger.warn('link-preview fetch error', { url, error: err.message });
    return res.status(502).json({ error: 'Failed to fetch URL' });
  }
});

module.exports = router;
