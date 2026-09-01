'use strict';
/**
 * Place — neighborhood density read helper (W0.4)
 *
 * Reads the per-geohash-6 verified-neighbor count written by the
 * `neighborhoodPreviewRefresh` job (NeighborhoodPreview table) and floors it
 * into a k-anonymous bucket enum. The raw count is NEVER returned — only the
 * bucket — so a single cell can't be used to single out the first few
 * residents on a block.
 *
 * Consumed by the Place preview (W0.2) and dashboard (W0.3) composers, which
 * map the bucket enum to the signed-out copy (§4.1 of the Place product doc)
 * and the DensityCard design:
 *   none    → "No activity shown yet"            (0 dots)
 *   forming → "Your block is starting to form"   (1 dot)
 *   few     → "A few verified homes nearby"       (2 dots)
 *   growing → "Growing activity near this area"   (3 dots)
 *
 * @module services/place/densityReader
 */

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');

// Bucket enum — ordered none < forming < few < growing.
const DENSITY_BUCKET = Object.freeze({
  NONE: 'none',
  FORMING: 'forming',
  FEW: 'few',
  GROWING: 'growing',
});

// k-anon floor: a non-empty cell with fewer than K_ANON_MIN verified
// neighbors never reveals more than 'forming', so counts of 1..K_ANON_MIN-1
// are indistinguishable from one another. k=5 matches the privacy floors used
// elsewhere (BillBenchmark write floor 3 / display floor 10) and the semantic
// ladder ("starting to form" → "a few" → "growing").
const K_ANON_MIN = 5;
// Upper edge of the 'few' band; above it the cell reads as 'growing'. Bands
// stay wide on purpose so no exact count can be inferred from the bucket.
const FEW_MAX = 20;

/**
 * Floor a raw verified-neighbor count into a k-anon bucket enum.
 *
 * Pure + synchronous so it can be unit-tested without a database. Always
 * returns one of the DENSITY_BUCKET strings — never a number — so callers
 * cannot accidentally surface the underlying count.
 *
 * @param {number} count  raw verified_users_count for the cell
 * @returns {'none'|'forming'|'few'|'growing'}
 */
function bucketForCount(count) {
  const n = Math.floor(Number(count));
  if (!Number.isFinite(n) || n <= 0) return DENSITY_BUCKET.NONE;
  if (n < K_ANON_MIN) return DENSITY_BUCKET.FORMING; // 1 .. 4
  if (n <= FEW_MAX) return DENSITY_BUCKET.FEW;        // 5 .. 20
  return DENSITY_BUCKET.GROWING;                       // 21+
}

/**
 * Read the density bucket for a geohash-6 cell.
 *
 * Returns the floored bucket only — never the underlying count. A missing
 * cell or a read error fails closed to 'none' so nothing leaks and composers
 * always get a valid bucket.
 *
 * @param {string} geohash  geohash-6 prefix
 * @returns {Promise<{ geohash: (string|null), bucket: string }>}
 */
async function getDensityBucket(geohash) {
  if (!geohash || typeof geohash !== 'string') {
    return { geohash: geohash || null, bucket: DENSITY_BUCKET.NONE };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('NeighborhoodPreview')
      .select('verified_users_count')
      .eq('geohash', geohash)
      .maybeSingle();

    if (error) {
      logger.warn('placeDensityReader: NeighborhoodPreview read error', {
        geohash,
        error: error.message,
      });
      return { geohash, bucket: DENSITY_BUCKET.NONE };
    }

    return { geohash, bucket: bucketForCount(data ? data.verified_users_count : 0) };
  } catch (err) {
    logger.error('placeDensityReader: getDensityBucket failed', {
      geohash,
      error: err.message,
    });
    return { geohash, bucket: DENSITY_BUCKET.NONE };
  }
}

module.exports = {
  getDensityBucket,
  bucketForCount,
  DENSITY_BUCKET,
  K_ANON_MIN,
  FEW_MAX,
};
