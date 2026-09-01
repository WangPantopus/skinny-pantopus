'use strict';
/**
 * Place — internal read helpers (W0.4)
 *
 * Thin, reusable readers over the geohash-keyed tables that the refresh jobs
 * populate, for the Place preview (W0.2) and dashboard (W0.3) composers.
 * These are internal helpers only — they add no new public/HTTP surface.
 *
 *   getDensityBucket(geohash)          → k-anon density bucket (never a count)
 *   getBillBenchmark(geohash, type, …) → peer-relative neighborhood bill view
 *
 * @module services/place
 */

const {
  getDensityBucket,
  bucketForCount,
  DENSITY_BUCKET,
  K_ANON_MIN,
  FEW_MAX,
} = require('./densityReader');

const {
  getBillBenchmark,
  relativeToPeers,
  BENCHMARK_DISPLAY_MIN,
  TYPICAL_PCT,
} = require('./billBenchmarkReader');

module.exports = {
  // density
  getDensityBucket,
  bucketForCount,
  DENSITY_BUCKET,
  K_ANON_MIN,
  FEW_MAX,
  // bill benchmark
  getBillBenchmark,
  relativeToPeers,
  BENCHMARK_DISPLAY_MIN,
  TYPICAL_PCT,
};
