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
const { encodeGeohash6, decodeGeohashBbox } = require('../utils/geohash');
const { K_ANON_MIN, FEW_MAX, bucketForCount } = require('../services/place/densityReader');

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

// ── GET /api/neighborhood/cells — the window (Wedge v2 §4) ──
// The Nearby tab is alive from the first minute: the 5×5 grid of
// geohash-6 cells (~1.2 km × 0.6 km each) around the viewer's place,
// each carrying ONLY its density bucket from the same floored reader the
// public preview uses. Never a count, never a point: nobody's home is a
// dot on this map, including the viewer's — their cell is flagged, its
// centre is the cell's centre.
const GRID_RADIUS = 2;

function bucketLabels() {
  return {
    none: 'No verified homes yet',
    forming: `Forming (under ${K_ANON_MIN})`,
    few: `A few (${K_ANON_MIN}–${FEW_MAX})`,
    growing: `Growing (${FEW_MAX + 1}+)`,
  };
}

function gridAround(lat, lng) {
  const home = encodeGeohash6(lat, lng);
  const b = decodeGeohashBbox(home);
  const dLat = b.maxLat - b.minLat;
  const dLng = b.maxLng - b.minLng;
  const cLat = (b.minLat + b.maxLat) / 2;
  const cLng = (b.minLng + b.maxLng) / 2;
  const hashes = [];
  for (let i = -GRID_RADIUS; i <= GRID_RADIUS; i += 1) {
    for (let j = -GRID_RADIUS; j <= GRID_RADIUS; j += 1) {
      const h = encodeGeohash6(cLat + i * dLat, cLng + j * dLng);
      if (!hashes.includes(h)) hashes.push(h);
    }
  }
  return { home, center: { lat: cLat, lng: cLng }, hashes };
}

router.get('/cells', verifyToken, async (req, res) => {
  try {
    const home = await resolvePrimaryHome(req.user.id);
    if (!home || home.map_center_lat == null || home.map_center_lng == null) {
      return res.json({ state: 'no_place', home_cell: null, center: null, cells: [], buckets: bucketLabels(), k_anon_min: K_ANON_MIN });
    }
    const grid = gridAround(Number(home.map_center_lat), Number(home.map_center_lng));
    const { data, error } = await supabaseAdmin
      .from('NeighborhoodPreview')
      .select('geohash, verified_users_count')
      .in('geohash', grid.hashes);
    if (error) logger.warn('neighborhood/cells: NeighborhoodPreview read error', { error: error.message });
    const counts = new Map((data || []).map((r) => [r.geohash, r.verified_users_count]));
    const cells = grid.hashes.map((h) => {
      const b = decodeGeohashBbox(h);
      return {
        geohash: h,
        bounds: [[b.minLat, b.minLng], [b.maxLat, b.maxLng]],
        bucket: bucketForCount(counts.get(h) ?? 0), // floored enum — never the count
        is_home: h === grid.home,
      };
    });
    return res.json({ state: 'ready', home_cell: grid.home, center: grid.center, cells, buckets: bucketLabels(), k_anon_min: K_ANON_MIN });
  } catch (err) {
    logger.error('neighborhood/cells failed', { error: err.message });
    return res.status(500).json({ error: 'Failed to load the nearby map' });
  }
});

module.exports = router;
module.exports.gridAround = gridAround;
