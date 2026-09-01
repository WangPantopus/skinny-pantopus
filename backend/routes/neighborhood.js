'use strict';
/**
 * Neighborhood — the density-gated door.
 *
 * The four-tab IA presents every neighborhood surface (Pulse, Marketplace,
 * Tasks, Discover) behind one door whose state is a single honest number:
 * how many verified neighbors are around the viewer's place, against the
 * unlock threshold. This route serves that meter.
 *
 * Data source: NeighborhoodPreview (geohash-6 → verified_users_count),
 * refreshed by jobs/neighborhoodPreviewRefresh.js — the same substrate the
 * T0 public preview's density bucket reads. Privacy: below the k-anon
 * floor (densityReader.K_ANON_MIN) the exact count is withheld and the
 * meter reads 'forming', so the first few residents of a cell can't be
 * singled out; from K_ANON_MIN up, residents see the real aggregate.
 *
 * GET /api/neighborhood/meter → {
 *   state: 'no_place' | 'forming' | 'growing' | 'unlocked',
 *   verified_count: number | null,   // null below the k-anon floor
 *   k_anon_min: number,
 *   threshold: number,
 *   unlocked: boolean,
 *   area: { city, state } | null
 * }
 */

const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const logger = require('../utils/logger');
const { encodeGeohash6 } = require('../utils/geohash');
const { K_ANON_MIN, FEW_MAX } = require('../services/place/densityReader');

// Unlock threshold: aligned with densityReader.FEW_MAX so "unlocked" and
// the 'growing' density bucket agree (a cell reads 'growing' above FEW_MAX).
// Env-tunable for launch experiments without a deploy.
function unlockThreshold() {
  const n = parseInt(process.env.NEIGHBORHOOD_UNLOCK_THRESHOLD, 10);
  return Number.isFinite(n) && n > 0 ? n : FEW_MAX;
}

/**
 * Resolve the viewer's primary home (same ladder as GET /api/homes/primary:
 * active occupancy → verified owner → legacy owner_id), selecting only the
 * columns the meter needs.
 */
async function resolvePrimaryHome(userId) {
  const { data: occ } = await supabaseAdmin
    .from('HomeOccupancy')
    .select('home_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  let primaryHomeId = occ?.home_id || null;

  if (!primaryHomeId) {
    const { data: ownerRow } = await supabaseAdmin
      .from('HomeOwner')
      .select('home_id')
      .eq('subject_id', userId)
      .eq('owner_status', 'verified')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    primaryHomeId = ownerRow?.home_id || null;
  }

  if (!primaryHomeId) {
    const { data: owned } = await supabaseAdmin
      .from('Home')
      .select('id')
      .eq('owner_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    primaryHomeId = owned?.id || null;
  }

  if (!primaryHomeId) return null;

  const { data: home, error } = await supabaseAdmin
    .from('Home')
    .select('id, city, state, map_center_lat, map_center_lng')
    .eq('id', primaryHomeId)
    .maybeSingle();

  if (error || !home) return null;
  return home;
}

router.get('/meter', verifyToken, async (req, res) => {
  try {
    const threshold = unlockThreshold();
    const home = await resolvePrimaryHome(req.user.id);

    if (!home || home.map_center_lat == null || home.map_center_lng == null) {
      return res.json({
        state: 'no_place',
        verified_count: null,
        k_anon_min: K_ANON_MIN,
        threshold,
        unlocked: false,
        area: null,
      });
    }

    const geohash = encodeGeohash6(home.map_center_lat, home.map_center_lng);
    const { data: preview, error } = await supabaseAdmin
      .from('NeighborhoodPreview')
      .select('verified_users_count')
      .eq('geohash', geohash)
      .maybeSingle();

    if (error) {
      logger.warn('neighborhood/meter: NeighborhoodPreview read error', {
        error: error.message,
      });
    }

    const count = Math.max(0, Math.floor(Number(preview?.verified_users_count ?? 0)) || 0);
    const unlocked = count >= threshold;
    const state = unlocked ? 'unlocked' : count >= K_ANON_MIN ? 'growing' : 'forming';

    return res.json({
      state,
      // k-anon floor: exact counts appear only from K_ANON_MIN up.
      verified_count: count >= K_ANON_MIN ? count : null,
      k_anon_min: K_ANON_MIN,
      threshold,
      unlocked,
      area: { city: home.city || null, state: home.state || null },
    });
  } catch (err) {
    logger.error('neighborhood/meter failed', { error: err.message });
    return res.status(500).json({ error: 'Failed to load the neighborhood meter' });
  }
});

module.exports = router;
