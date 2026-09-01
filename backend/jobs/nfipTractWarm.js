// ============================================================
// JOB: NFIP Tract Warm (Wave 2 — Flood Insurance, In Dollars)
//
// The OpenFEMA NfipPolicies v3 API is ~20 ms/row and 503s on any
// filter beyond a bare censusGeoid range — a tract fetch runs tens of
// seconds, so the flood composer never calls it. Instead the composer
// leaves `pending` markers in PlaceSectionCache, and this job does the
// slow fetches on a schedule: pending tracts first, then the oldest
// expired benchmarks.
//
// Budget: up to 3 tracts per run (~1–2 min worst case), every 15
// minutes. Runs on every instance without leader election, like its
// siblings — but each tract is CLAIMED before fetching (a conditional
// update in warmPendingTracts), so concurrent instances drain different
// tracts and fleet size adds throughput instead of duplicating the same
// three slow OpenFEMA pulls. Failed tracts rotate to the back of the
// queue and dead-letter after repeated failures rather than
// head-blocking the budget.
//
// The run also sweeps the shared PlaceSectionCache janitor: rows a full
// month past expiry (nothing refreshed OR read-through-refreshed them)
// are deleted in small batches — the cleanup migration 156 deferred.
// ============================================================

const { warmPendingTracts } = require('../services/nfipPremiumService');
const { cleanupLongExpired } = require('../services/placeSectionCache');

module.exports = async function nfipTractWarm() {
  const result = await warmPendingTracts({ limit: 3 });
  // Best-effort; the janitor never blocks or fails the warm pass.
  await cleanupLongExpired().catch(() => {});
  return result;
};
