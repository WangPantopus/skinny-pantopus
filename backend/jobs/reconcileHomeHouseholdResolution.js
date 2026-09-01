const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const homeClaimRoutingService = require('../services/homeClaimRoutingService');

async function reconcileHomeHouseholdResolution(options = {}) {
  const {
    dryRun = false,
  } = options;

  const [homesResult, claimsResult, ownersResult] = await Promise.all([
    supabaseAdmin
      .from('Home')
      .select('id, household_resolution_state'),
    supabaseAdmin
      .from('HomeOwnershipClaim')
      .select('home_id'),
    supabaseAdmin
      .from('HomeOwner')
      .select('home_id')
      .eq('owner_status', 'verified'),
  ]);

  if (homesResult.error) throw homesResult.error;
  if (claimsResult.error) throw claimsResult.error;
  if (ownersResult.error) throw ownersResult.error;

  const candidateHomeIds = new Set([
    ...(homesResult.data || [])
      .filter((home) => ['contested', 'disputed', 'pending_single_claim', 'verified_household'].includes(home.household_resolution_state))
      .map((home) => home.id),
    ...(claimsResult.data || []).map((claim) => claim.home_id),
    ...(ownersResult.data || []).map((owner) => owner.home_id),
  ]);

  if (candidateHomeIds.size === 0) {
    logger.info('[reconcileHomeHouseholdResolution] No candidate homes to reconcile', { dry_run: dryRun });
    return { scanned: 0, changed: 0, unchanged: 0, dry_run: dryRun };
  }

  const homeStateMap = {};
  for (const home of homesResult.data || []) {
    homeStateMap[home.id] = home.household_resolution_state;
  }

  let changed = 0;
  let unchanged = 0;

  for (const homeId of candidateHomeIds) {
    const snapshot = await homeClaimRoutingService.getHomeResolutionSnapshot(homeId);
    const previousState = homeStateMap[homeId] || null;

    if (snapshot.householdResolutionState === previousState) {
      unchanged++;
      continue;
    }

    if (!dryRun) {
      await homeClaimRoutingService.recalculateHomeResolutionState(homeId);
    }

    changed++;
  }

  const summary = {
    scanned: candidateHomeIds.size,
    changed,
    unchanged,
    dry_run: dryRun,
  };

  logger.info('[reconcileHomeHouseholdResolution] Completed', summary);
  return summary;
}

module.exports = reconcileHomeHouseholdResolution;
