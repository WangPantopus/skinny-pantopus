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

// ─── In-memory metrics store ────────────────────────────────────────────────

/**
 * Map<routeKey, { durations: number[], timestamps: number[], count: number, errors: number }>
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
    const baseUrl = req.baseUrl.replace(/^(\/api\/(?:homes|personas))\/[^/]+(?=\/|$)/i, '$1/:id');
    path = baseUrl + req.route.path;
  }
  return `${req.method} ${path}`;
}

function recordMetric(routeKey, durationMs, isError) {
  const now = Date.now();
  if (!metrics.has(routeKey)) {
    metrics.set(routeKey, { durations: [], timestamps: [], count: 0, errors: 0 });
  }
  const m = metrics.get(routeKey);
  m.durations.push(durationMs);
  m.timestamps.push(now);
  m.count++;
  if (isError) m.errors++;
}

function cleanupOldMetrics() {
  const cutoff = Date.now() - METRICS_WINDOW_MS;
  for (const [key, m] of metrics) {
    // Remove entries older than the window
    while (m.timestamps.length > 0 && m.timestamps[0] < cutoff) {
      m.timestamps.shift();
      m.durations.shift();
    }
    if (m.timestamps.length === 0) {
      metrics.delete(key);
    }
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
  const snapshot = {};

  for (const [routeKey, m] of metrics) {
    const sorted = [...m.durations].sort((a, b) => a - b);
    snapshot[routeKey] = {
      count: m.count,
      errors: m.errors,
      p50_ms: Math.round(percentile(sorted, 50)),
      p95_ms: Math.round(percentile(sorted, 95)),
      p99_ms: Math.round(percentile(sorted, 99)),
      max_ms: Math.round(sorted[sorted.length - 1] || 0),
      window_samples: sorted.length,
    };
  }

  // Sort by p95 descending (slowest first)
  return Object.fromEntries(
    Object.entries(snapshot).sort(([, a], [, b]) => b.p95_ms - a.p95_ms)
  );
}

module.exports = { apmMiddleware, getMetrics };
