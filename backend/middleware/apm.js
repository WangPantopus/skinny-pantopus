/**
 * Application Performance Monitoring (APM) middleware.
 *
 * Tracks response time per route and logs slow requests.
 * Also exposes a /api/health/metrics endpoint for monitoring.
 *
 * Features:
 *   - Per-route response time tracking (p50, p95, p99)
 *   - Slow request logging (configurable threshold)
 *   - In-memory metrics exposed via /api/health/metrics
 *   - Automatic cleanup of old metrics (rolling 5-minute window)
 */
const logger = require('../utils/logger');

const SLOW_THRESHOLD_MS = parseInt(process.env.APM_SLOW_THRESHOLD_MS) || 500;
const METRICS_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute
const MAX_SAMPLES_PER_ROUTE = 1000;

// ─── In-memory metrics store ────────────────────────────────────────────────

/**
 * Counts cover the rolling window in one-second buckets. Percentiles use at
 * most the latest 1,000 requests in that window, bounding memory and sorting
 * work even when a route is busy. Samples are overwritten in a ring.
 */
const metrics = new Map();

function getRouteKey(req) {
  // Never retain an unmatched request's literal path: metrics are publicly
  // readable, and arbitrary URLs may contain private identifiers or codes.
  // Grouping these requests also prevents a new metric key for every 404.
  let path = req.route?.path || 'unmatched';
  // Matched routes use Express's pattern (:id, :code), not the caller's URL.
  if (req.baseUrl && req.route?.path) {
    // baseUrl is already interpolated for the home scheduling and persona
    // subrouters. Hide that parent id even when validation rejects its value.
    // Mount paths match case-insensitively, but baseUrl keeps the caller's
    // casing; lower it so /API/Users cannot add a key per spelling.
    const baseUrl = req.baseUrl.toLowerCase().replace(/^(\/api\/(?:homes|personas))\/[^/]+(?=\/|$)/, '$1/:id');
    path = baseUrl + req.route.path;
  }
  return `${req.method} ${path}`;
}

function recordMetric(routeKey, durationMs, isError) {
  const now = Date.now();
  if (!metrics.has(routeKey)) {
    metrics.set(routeKey, { samples: [], nextSample: 0, buckets: new Map() });
  }
  const m = metrics.get(routeKey);
  m.samples[m.nextSample] = { durationMs, timestamp: now };
  m.nextSample = (m.nextSample + 1) % MAX_SAMPLES_PER_ROUTE;
  const second = Math.floor(now / 1000);
  if (!m.buckets.has(second)) {
    expireBuckets(m, now);
    m.buckets.set(second, { count: 0, errors: 0 });
  }
  const bucket = m.buckets.get(second);
  bucket.count++;
  if (isError) bucket.errors++;
}

function expireBuckets(m, now) {
  const cutoff = Math.floor((now - METRICS_WINDOW_MS) / 1000);
  for (const second of m.buckets.keys()) {
    if (second <= cutoff) m.buckets.delete(second);
  }
}

function cleanupOldMetrics(now = Date.now()) {
  for (const [key, m] of metrics) {
    expireBuckets(m, now);
    if (m.buckets.size === 0) metrics.delete(key);
  }
}

// Periodic cleanup
setInterval(cleanupOldMetrics, CLEANUP_INTERVAL_MS).unref();

// ─── Percentile calculation ─────────────────────────────────────────────────

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ─── Middleware ──────────────────────────────────────────────────────────────

/**
 * Express middleware that tracks response time and logs slow requests.
 * Mount this BEFORE your API routes.
 */
function apmMiddleware(req, res, next) {
  const startTime = process.hrtime.bigint();

  // Hook into response finish
  res.on('finish', () => {
    const durationNs = process.hrtime.bigint() - startTime;
    const durationMs = Number(durationNs) / 1e6;
    const routeKey = getRouteKey(req);
    const isError = res.statusCode >= 500;

    recordMetric(routeKey, durationMs, isError);

    // Log slow requests
    if (durationMs > SLOW_THRESHOLD_MS) {
      logger.warn('Slow request detected', {
        route: routeKey,
        duration_ms: Math.round(durationMs),
        status: res.statusCode,
        user_id: req.user?.id || 'anonymous',
        threshold_ms: SLOW_THRESHOLD_MS,
      });
    }
  });

  next();
}

/**
 * Returns current metrics snapshot.
 * Use this to build a /api/health/metrics endpoint.
 */
function getMetrics() {
  const now = Date.now();
  cleanupOldMetrics(now);
  const cutoff = (Math.floor((now - METRICS_WINDOW_MS) / 1000) + 1) * 1000;
  const snapshot = {};

  for (const [routeKey, m] of metrics) {
    const sorted = m.samples.filter(sample => sample.timestamp >= cutoff)
      .map(sample => sample.durationMs).sort((a, b) => a - b);
    let count = 0;
    let errors = 0;
    for (const bucket of m.buckets.values()) {
      count += bucket.count;
      errors += bucket.errors;
    }
    snapshot[routeKey] = {
      count,
      errors,
      p50_ms: Math.round(percentile(sorted, 50)),
      p95_ms: Math.round(percentile(sorted, 95)),
      p99_ms: Math.round(percentile(sorted, 99)),
      max_ms: Math.round(sorted[sorted.length - 1] || 0),
      window_samples: sorted.length,
      sample_limit: MAX_SAMPLES_PER_ROUTE,
    };
  }

  // Sort by p95 descending (slowest first)
  return Object.fromEntries(
    Object.entries(snapshot).sort(([, a], [, b]) => b.p95_ms - a.p95_ms)
  );
}

module.exports = { apmMiddleware, getMetrics };
