// ============================================================
// JOB: Refresh Discovery Cache
// Refreshes the geohash-based discovery cache for all recently
// active geohashes. Limits to 20 geohashes per run to avoid
// overload.
// Runs every 2 minutes.
// ============================================================

const logger = require('../utils/logger');
const discoveryCacheService = require('../services/marketplace/discoveryCacheService');

const MAX_GEOHASHES_PER_RUN = 20;

async function refreshDiscoveryCache() {
  try {
    const geohashes = await discoveryCacheService.getActiveGeohashes();

    if (geohashes.length === 0) {
      logger.info('[refreshDiscoveryCache] No active geohashes to refresh');
      return;
    }

    const batch = geohashes.slice(0, MAX_GEOHASHES_PER_RUN);
    logger.info('[refreshDiscoveryCache] Refreshing', { count: batch.length, total: geohashes.length });

    let refreshed = 0;
    for (const geohash of batch) {
      try {
        await discoveryCacheService.refreshDiscoveryForGeohash(geohash);
        refreshed++;
      } catch (err) {
        logger.warn('[refreshDiscoveryCache] Failed to refresh geohash', {
          geohash,
          error: err.message,
        });
      }
    }

    logger.info('[refreshDiscoveryCache] Done', { refreshed, total: batch.length });
  } catch (err) {
    logger.error('[refreshDiscoveryCache] Job failed', {
      error: err.message,
      stack: err.stack,
    });
  }
}

module.exports = refreshDiscoveryCache;
