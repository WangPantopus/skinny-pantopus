const WINDOW_MS = 5 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;

const counters = new Map();
const histograms = new Map();

function normalizeLabelValue(value) {
  if (value === undefined || value === null || value === '') return 'none';
  return String(value).replace(/[,\n\r]/g, '_');
}

function labelsKey(labels = {}) {
  const keys = Object.keys(labels).sort();
  if (keys.length === 0) return '_total';
  return keys.map((key) => `${key}=${normalizeLabelValue(labels[key])}`).join(',');
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function incCounter(name, labels = {}) {
  if (!counters.has(name)) counters.set(name, new Map());
  const bucket = counters.get(name);
  const key = labelsKey(labels);
  bucket.set(key, (bucket.get(key) || 0) + 1);
}

function recordHistogram(name, value, labels = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return;

  if (!histograms.has(name)) histograms.set(name, new Map());
  const metric = histograms.get(name);
  const key = labelsKey(labels);
  if (!metric.has(key)) {
    metric.set(key, { values: [], timestamps: [] });
  }

  const bucket = metric.get(key);
  bucket.values.push(parsed);
  bucket.timestamps.push(Date.now());
}

function cleanupHistograms() {
  const cutoff = Date.now() - WINDOW_MS;
  for (const metric of histograms.values()) {
    for (const bucket of metric.values()) {
      while (bucket.timestamps.length > 0 && bucket.timestamps[0] < cutoff) {
        bucket.timestamps.shift();
        bucket.values.shift();
      }
    }
  }
}

setInterval(cleanupHistograms, CLEANUP_INTERVAL_MS).unref();

function getSnapshot() {
  const snapshot = {
    counters: {},
    histograms: {},
  };

  for (const [name, metric] of counters.entries()) {
    snapshot.counters[name] = {};
    for (const [key, value] of metric.entries()) {
      snapshot.counters[name][key] = value;
    }
  }

  for (const [name, metric] of histograms.entries()) {
    snapshot.histograms[name] = {};
    for (const [key, bucket] of metric.entries()) {
      const sorted = [...bucket.values].sort((left, right) => left - right);
      snapshot.histograms[name][key] = {
        count: sorted.length,
        p50_ms: Math.round(percentile(sorted, 50)),
        p95_ms: Math.round(percentile(sorted, 95)),
        p99_ms: Math.round(percentile(sorted, 99)),
        max_ms: Math.round(sorted[sorted.length - 1] || 0),
      };
    }
  }

  return snapshot;
}

function resetForTests() {
  counters.clear();
  histograms.clear();
}

module.exports = {
  incCounter,
  recordHistogram,
  getSnapshot,
  resetForTests,
};
