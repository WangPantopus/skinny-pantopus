/**
 * Chat Metrics — lightweight in-memory counters, histograms, and gauges.
 *
 * No external dependency required. Exposes a snapshot via getSnapshot() that
 * can be served from a /api/chat/metrics endpoint.
 *
 * Histograms retain at most the latest 4,096 observations within five minutes.
 * Snapshot metadata makes that sample limit explicit under heavier traffic.
 */

const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_SAMPLES = 4096;

// ─── Counters ─────────────────────────────────────────────────────────────────
// Map<name, Map<labelsKey, number>>
const counters = new Map();

function incCounter(name, labels = {}) {
  if (!counters.has(name)) counters.set(name, new Map());
  const key = labelsKey(labels);
  const bucket = counters.get(name);
  bucket.set(key, (bucket.get(key) || 0) + 1);
}

// ─── Histograms ───────────────────────────────────────────────────────────────
// Fixed rings avoid traffic-dependent memory and quadratic Array.shift cleanup.
const histograms = new Map();

function recordHistogram(name, valueMs) {
  if (!Number.isFinite(valueMs) || valueMs < 0) return;
  if (!histograms.has(name)) {
    histograms.set(name, { values: new Float64Array(MAX_SAMPLES), timestamps: new Float64Array(MAX_SAMPLES),
      next: 0, count: 0, limitedUntil: 0 });
  }
  const h = histograms.get(name);
  const now = Date.now();
  if (h.count === MAX_SAMPLES && h.timestamps[h.next] > now - WINDOW_MS) {
    h.limitedUntil = Math.max(h.limitedUntil, h.timestamps[h.next] + WINDOW_MS);
  }
  h.values[h.next] = valueMs;
  h.timestamps[h.next] = now;
  h.next = (h.next + 1) % MAX_SAMPLES;
  h.count = Math.min(h.count + 1, MAX_SAMPLES);
}

// ─── Gauges ───────────────────────────────────────────────────────────────────
// Map<name, number>
const gauges = new Map();

function setGauge(name, value) {
  gauges.set(name, value);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function labelsKey(labels) {
  const keys = Object.keys(labels).sort();
  if (keys.length === 0) return '_total';
  return keys.map((k) => `${k}=${labels[k]}`).join(',');
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ─── Snapshot ─────────────────────────────────────────────────────────────────

function getSnapshot() {
  const snap = { counters: {}, histograms: {}, gauges: {} };

  // Counters
  for (const [name, bucket] of counters) {
    snap.counters[name] = {};
    for (const [key, val] of bucket) {
      snap.counters[name][key] = val;
    }
  }

  // Expire on read as well as overwrite, so a quiet service never reports an
  // old spike just because a cleanup timer has not fired yet.
  const now = Date.now();
  for (const [name, h] of histograms) {
    const sorted = [];
    for (let i = 0; i < h.count; i += 1) if (h.timestamps[i] >= now - WINDOW_MS) sorted.push(h.values[i]);
    sorted.sort((a, b) => a - b);
    snap.histograms[name] = {
      count: sorted.length,
      sample_capacity: MAX_SAMPLES,
      sample_limited: h.limitedUntil > now,
      window_ms: WINDOW_MS,
      p50_ms: Math.round(percentile(sorted, 50)),
      p95_ms: Math.round(percentile(sorted, 95)),
      p99_ms: Math.round(percentile(sorted, 99)),
      max_ms: Math.round(sorted[sorted.length - 1] || 0),
    };
  }

  // Gauges
  for (const [name, val] of gauges) {
    snap.gauges[name] = val;
  }

  return snap;
}

module.exports = {
  incCounter,
  recordHistogram,
  setGauge,
  getSnapshot,
};
