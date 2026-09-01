/**
 * Chat Metrics — lightweight in-memory counters, histograms, and gauges.
 *
 * No external dependency required. Exposes a snapshot via getSnapshot() that
 * can be served from a /api/chat/metrics endpoint.
 *
 * Histograms keep a rolling 5-minute window (configurable) so percentile
 * calculations stay bounded in memory.
 */

const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

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
// Map<name, { values: number[], timestamps: number[] }>
const histograms = new Map();

function recordHistogram(name, valueMs) {
  if (!histograms.has(name)) {
    histograms.set(name, { values: [], timestamps: [] });
  }
  const h = histograms.get(name);
  h.values.push(valueMs);
  h.timestamps.push(Date.now());
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

function cleanupHistograms() {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [, h] of histograms) {
    while (h.timestamps.length > 0 && h.timestamps[0] < cutoff) {
      h.timestamps.shift();
      h.values.shift();
    }
  }
}

setInterval(cleanupHistograms, CLEANUP_INTERVAL_MS).unref();

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

  // Histograms
  for (const [name, h] of histograms) {
    const sorted = [...h.values].sort((a, b) => a - b);
    snap.histograms[name] = {
      count: sorted.length,
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
