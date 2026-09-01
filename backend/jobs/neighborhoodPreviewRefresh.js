/**
 * Neighborhood Preview Refresh Job
 *
 * Runs every 15 minutes. For each geohash-6 cell that contains at least
 * one active home, counts the verified (active) users in that cell and
 * upserts into NeighborhoodPreview.
 *
 * After upserting, checks for milestone crossings (10, 25, 50, 100, 200, 500).
 * When a milestone is crossed, sends a one-time notification + push to all
 * active users in that cell. Only the highest crossed milestone is notified.
 *
 * Anti-spam:
 *   - last_milestone_notified on the preview row prevents re-notification
 *   - Only one milestone notification per user per day (checked via Notification table)
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const notificationService = require('../services/notificationService');
const { encodeGeohash6 } = require('../utils/geohash');

const MILESTONES = [500, 200, 100, 50, 25, 10];

// ── Main job ──────────────────────────────────────────────────────────────

module.exports = async function neighborhoodPreviewRefresh() {
  // 1. Fetch all active homes with coordinates
  const { data: homes, error: homesErr } = await supabaseAdmin
    .from('Home')
    .select('id, map_center_lat, map_center_lng')
    .not('map_center_lat', 'is', null)
    .not('map_center_lng', 'is', null);

  if (homesErr) {
    logger.error('neighborhoodPreviewRefresh: failed to fetch homes', { error: homesErr.message });
    return;
  }

  if (!homes || homes.length === 0) {
    logger.info('neighborhoodPreviewRefresh: no homes with coordinates found');
    return;
  }

  // 2. Group homes by geohash-6
  const geohashToHomeIds = new Map();
  for (const home of homes) {
    const gh = encodeGeohash6(home.map_center_lat, home.map_center_lng);
    if (!geohashToHomeIds.has(gh)) geohashToHomeIds.set(gh, []);
    geohashToHomeIds.get(gh).push(home.id);
  }

  // 3. Count distinct active users per geohash cell (single batch query)
  const allHomeIds = homes.map((h) => h.id);
  const { data: occupancies, error: occErr } = await supabaseAdmin
    .from('HomeOccupancy')
    .select('home_id, user_id')
    .in('home_id', allHomeIds)
    .eq('is_active', true);

  if (occErr) {
    logger.error('neighborhoodPreviewRefresh: failed to fetch occupancies', { error: occErr.message });
    return;
  }

  // Build home_id → geohash lookup
  const homeToGeohash = new Map();
  for (const home of homes) {
    homeToGeohash.set(home.id, encodeGeohash6(home.map_center_lat, home.map_center_lng));
  }

  // Count distinct users per geohash (a user in multiple homes within the same cell counts once)
  const geohashCounts = new Map(); // geohash -> count of distinct users
  const geohashUserSets = new Map(); // geohash -> Set<user_id>
  for (const occ of occupancies || []) {
    const gh = homeToGeohash.get(occ.home_id);
    if (!gh) continue;
    if (!geohashUserSets.has(gh)) geohashUserSets.set(gh, new Set());
    geohashUserSets.get(gh).add(occ.user_id);
  }
  for (const [gh, userSet] of geohashUserSets) {
    geohashCounts.set(gh, userSet.size);
  }
  // Ensure geohashes with homes but no occupants get count=0
  for (const gh of geohashToHomeIds.keys()) {
    if (!geohashCounts.has(gh)) geohashCounts.set(gh, 0);
  }

  // 4. Fetch existing preview rows for comparison BEFORE upserting
  const geohashes = Array.from(geohashCounts.keys());
  if (geohashes.length === 0) return;

  const { data: existingRows, error: fetchErr } = await supabaseAdmin
    .from('NeighborhoodPreview')
    .select('geohash, verified_users_count, last_milestone_notified')
    .in('geohash', geohashes);

  if (fetchErr) {
    logger.warn('neighborhoodPreviewRefresh: failed to fetch existing previews', { error: fetchErr.message });
  }

  const existingByGeohash = new Map();
  for (const row of existingRows || []) {
    existingByGeohash.set(row.geohash, row);
  }

  // 5. Upsert all preview rows
  const upsertRows = geohashes.map((gh) => ({
    geohash: gh,
    verified_users_count: geohashCounts.get(gh),
    updated_at: new Date().toISOString(),
  }));

  const { error: upsertErr } = await supabaseAdmin
    .from('NeighborhoodPreview')
    .upsert(upsertRows, { onConflict: 'geohash', ignoreDuplicates: false });

  if (upsertErr) {
    logger.error('neighborhoodPreviewRefresh: upsert failed', { error: upsertErr.message });
    return;
  }

  // 6. Detect milestone crossings and notify
  const milestoneCrossings = []; // { geohash, milestone, newCount }

  for (const gh of geohashes) {
    const newCount = geohashCounts.get(gh);
    const existing = existingByGeohash.get(gh);
    const lastNotified = existing?.last_milestone_notified || 0;

    // Find the highest milestone at or below newCount that hasn't been notified yet.
    // This handles both fresh crossings AND catch-up (e.g., row created with count already above milestone).
    for (const m of MILESTONES) {
      if (newCount >= m && m > lastNotified) {
        milestoneCrossings.push({ geohash: gh, milestone: m, newCount });
        break; // only highest un-notified milestone
      }
    }
  }

  if (milestoneCrossings.length === 0) {
    logger.info('neighborhoodPreviewRefresh: no milestone crossings detected', {
      cellsProcessed: geohashes.length,
    });
    return;
  }

  logger.info('neighborhoodPreviewRefresh: milestone crossings detected', {
    crossings: milestoneCrossings.length,
  });

  // 7. For each crossing, find affected users and notify
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD for daily limit check

  for (const { geohash, milestone } of milestoneCrossings) {
    const homeIds = geohashToHomeIds.get(geohash) || [];
    if (homeIds.length === 0) continue;

    // Get active users in these homes
    const { data: occupants, error: occErr } = await supabaseAdmin
      .from('HomeOccupancy')
      .select('user_id')
      .in('home_id', homeIds)
      .eq('is_active', true);

    if (occErr || !occupants || occupants.length === 0) continue;

    const userIds = [...new Set(occupants.map((o) => o.user_id))];

    // Check which users already received a density_milestone notification today
    const { data: recentNotifs } = await supabaseAdmin
      .from('Notification')
      .select('user_id')
      .eq('type', 'density_milestone')
      .in('user_id', userIds)
      .gte('created_at', `${today}T00:00:00Z`);

    const alreadyNotified = new Set((recentNotifs || []).map((n) => n.user_id));
    const eligibleUserIds = userIds.filter((id) => !alreadyNotified.has(id));

    if (eligibleUserIds.length === 0) continue;

    // Send notifications (bulk)
    const notifications = eligibleUserIds.map((userId) => ({
      userId,
      type: 'density_milestone',
      title: '🎉 Neighborhood milestone!',
      body: `Your neighborhood just hit ${milestone} verified members!`,
      icon: '🎉',
      link: '/',
      metadata: { milestone, geohash },
    }));

    await notificationService.createBulkNotifications(notifications);

    // Update last_milestone_notified on the preview row
    await supabaseAdmin
      .from('NeighborhoodPreview')
      .update({ last_milestone_notified: milestone })
      .eq('geohash', geohash);

    logger.info('neighborhoodPreviewRefresh: milestone notifications sent', {
      geohash,
      milestone,
      usersNotified: eligibleUserIds.length,
    });
  }
};
