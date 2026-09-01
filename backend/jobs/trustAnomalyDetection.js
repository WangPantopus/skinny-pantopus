// ============================================================
// TRUST ANOMALY DETECTION
//
// Flags providers whose neighbor_count grew suspiciously fast
// from recently-created homes. Routes to manual review queue.
//
// Runs every 6 hours. Non-blocking, advisory only.
//
// Detection rules:
//   - neighbor_count grew by >5 in 7 days
//   - growth sourced from homes created within 60 days
//   - Uses completed gigs with real payments only
//
// When flagged:
//   - Creates a TrustAnomalyFlag record
//   - Logs for admin review
//   - Does NOT auto-suspend (manual review required)
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

const LOOKBACK_DAYS = 7;         // Check growth in last 7 days
const GROWTH_THRESHOLD = 5;      // Flag if >5 new trust-counting completions
const NEW_HOME_MAX_AGE_DAYS = 60; // Only count homes created within 60 days
const BATCH_SIZE = 100;          // Max providers to check per run

/**
 * Main anomaly detection job.
 */
async function trustAnomalyDetection() {
  const lookbackDate = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const newHomeDate = new Date(Date.now() - NEW_HOME_MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // 1. Find providers who received gig completions in the lookback window
  //    from homes that were created within the last 60 days.
  const { data: suspiciousProviders, error: queryErr } = await supabaseAdmin.rpc(
    'detect_trust_anomalies',
    {
      p_lookback_date: lookbackDate,
      p_new_home_date: newHomeDate,
      p_growth_threshold: GROWTH_THRESHOLD,
      p_limit: BATCH_SIZE,
    },
  );

  if (queryErr) {
    // If the RPC doesn't exist yet, fall back to a simpler query
    if (queryErr.message.includes('does not exist')) {
      logger.info('[trustAnomaly] RPC not yet deployed, running fallback query');
      await runFallbackDetection(lookbackDate, newHomeDate);
      return;
    }
    logger.error('[trustAnomaly] Detection query failed', { error: queryErr.message });
    return;
  }

  const flagged = suspiciousProviders || [];
  if (flagged.length === 0) {
    logger.info('[trustAnomaly] No anomalies detected');
    return;
  }

  logger.warn('[trustAnomaly] Anomalies detected', { count: flagged.length });

  // 2. Create/update anomaly flags
  for (const provider of flagged) {
    try {
      // Check if already flagged (within last 30 days)
      const { data: existing } = await supabaseAdmin
        .from('TrustAnomalyFlag')
        .select('id, status')
        .eq('business_user_id', provider.business_user_id)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        // Already flagged recently — update with latest data
        await supabaseAdmin
          .from('TrustAnomalyFlag')
          .update({
            recent_growth: provider.growth_count,
            new_home_count: provider.new_home_count,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        logger.info('[trustAnomaly] Updated existing flag', {
          businessUserId: provider.business_user_id,
          growth: provider.growth_count,
        });
      } else {
        // New flag
        await supabaseAdmin
          .from('TrustAnomalyFlag')
          .insert({
            business_user_id: provider.business_user_id,
            reason: 'rapid_growth_new_homes',
            recent_growth: provider.growth_count,
            new_home_count: provider.new_home_count,
            lookback_days: LOOKBACK_DAYS,
            status: 'pending_review',
          });

        logger.warn('[trustAnomaly] New flag created', {
          businessUserId: provider.business_user_id,
          growth: provider.growth_count,
          newHomeCount: provider.new_home_count,
        });
      }
    } catch (flagErr) {
      logger.error('[trustAnomaly] Failed to create flag', {
        businessUserId: provider.business_user_id,
        error: flagErr.message,
      });
    }
  }
}

/**
 * Fallback detection when the RPC function is not yet deployed.
 * Uses direct Supabase queries instead.
 */
async function runFallbackDetection(lookbackDate, newHomeDate) {
  try {
    // Find recent gig completions from new homes
    const { data: recentGigs, error } = await supabaseAdmin
      .from('Gig')
      .select(`
        accepted_by,
        origin_home_id,
        origin_home:origin_home_id (created_at)
      `)
      .gte('completed_at', lookbackDate)
      .in('status', ['completed', 'reviewed'])
      .in('payment_status', ['captured_hold', 'transfer_scheduled', 'transfer_pending', 'transferred'])
      .gte('price', 1000) // $10 minimum in cents
      .not('origin_home_id', 'is', null);

    if (error) {
      logger.error('[trustAnomaly] Fallback query failed', { error: error.message });
      return;
    }

    if (!recentGigs || recentGigs.length === 0) {
      logger.info('[trustAnomaly] Fallback: No recent completions');
      return;
    }

    // Group by provider, count completions from new homes
    const providerMap = {};
    for (const gig of recentGigs) {
      const provId = gig.accepted_by;
      const homeCreatedAt = gig.origin_home?.created_at;
      if (!provId || !homeCreatedAt) continue;

      if (!providerMap[provId]) {
        providerMap[provId] = { total: 0, fromNewHomes: 0 };
      }
      providerMap[provId].total += 1;
      if (new Date(homeCreatedAt) >= new Date(newHomeDate)) {
        providerMap[provId].fromNewHomes += 1;
      }
    }

    // Flag providers exceeding threshold
    let flagCount = 0;
    for (const [provId, counts] of Object.entries(providerMap)) {
      if (counts.total > GROWTH_THRESHOLD && counts.fromNewHomes >= 3) {
        logger.warn('[trustAnomaly] Fallback flagged provider', {
          businessUserId: provId,
          totalGrowth: counts.total,
          fromNewHomes: counts.fromNewHomes,
        });
        flagCount++;
      }
    }

    logger.info('[trustAnomaly] Fallback detection complete', {
      totalProviders: Object.keys(providerMap).length,
      flagged: flagCount,
    });
  } catch (err) {
    logger.error('[trustAnomaly] Fallback detection error', { error: err.message });
  }
}

module.exports = trustAnomalyDetection;
