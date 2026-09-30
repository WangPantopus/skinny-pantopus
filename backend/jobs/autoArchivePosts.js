/**
 * Auto-Archive Posts Cron Job
 *
 * Archives Nearby/local posts based on category TTL rules:
 *   - Stories:         24 hours
 *   - Events:          24 hours after event_end_date
 *   - Deals/Promos:    3 days OR once the stated expiry day has ended in US Pacific
 *                      (deal_expires_at + 32h; see step 3), whichever first
 *   - Questions:       14 days (prompt "resolved" at 7 days)
 *   - Lost & Found:    14 days
 *   - Home Neighborhood: 7 days
 *   - Other categories: per PostCategoryTTL table
 *
 * Only archives posts targeted to local audiences
 * (nearby, neighborhood, saved_place, target_area).
 * Network/private posts do not auto-expire.
 *
 * Runs daily at 4:00 AM UTC.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

const LOCAL_AUDIENCES = ['nearby', 'neighborhood', 'saved_place', 'target_area'];
// End of a deal's stated expiry day in US Pacific, measured from the stored midnight (see step 3).
const DEAL_EXPIRY_GRACE_MS = 32 * 60 * 60 * 1000;

async function autoArchivePosts() {
  let totalArchived = 0;

  // 1) Archive expired stories (24h)
  const { data: stories, error: storyErr } = await supabaseAdmin
    .from('Post')
    .update({
      is_archived: true,
      archived_at: new Date().toISOString(),
      archive_reason: 'expired',
    })
    .eq('is_story', true)
    .is('archived_at', null)
    .lt('story_expires_at', new Date().toISOString())
    .select('id');

  if (storyErr) {
    logger.error('[autoArchive] Error archiving stories', { error: storyErr.message });
  } else {
    totalArchived += (stories || []).length;
    if (stories?.length) logger.info('[autoArchive] Archived stories', { count: stories.length });
  }

  // 2) Archive events past their end date + 24h buffer
  const eventCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: events, error: eventErr } = await supabaseAdmin
    .from('Post')
    .update({
      is_archived: true,
      archived_at: new Date().toISOString(),
      archive_reason: 'expired',
    })
    .eq('post_type', 'event')
    .is('archived_at', null)
    .in('audience', LOCAL_AUDIENCES)
    .not('event_end_date', 'is', null)
    .lt('event_end_date', eventCutoff)
    .select('id');

  if (eventErr) {
    logger.error('[autoArchive] Error archiving events', { error: eventErr.message });
  } else {
    totalArchived += (events || []).length;
    if (events?.length) logger.info('[autoArchive] Archived events', { count: events.length });
  }

  // 3) Archive deals once their stated expiry day has ended.
  //    Every client stores the day the poster picked as wall-clock time labelled UTC, not an instant:
  //    web sends the date ("2026-10-15" -> 2026-10-15T00:00Z) and the apps send 09:00Z of that date.
  //    Archiving at deal_expires_at took a deal "expiring Oct 15" down on the evening of Oct 14 in Pacific.
  //    Wait 32 hours past that midnight instead: the end of the stated day in US Pacific (UTC-8, so
  //    PDT is covered too), the launch region. A deal stays visible through its whole expiry day.
  const dealCutoff = new Date(Date.now() - DEAL_EXPIRY_GRACE_MS).toISOString();
  const { data: expiredDeals, error: dealErr } = await supabaseAdmin
    .from('Post')
    .update({
      is_archived: true,
      archived_at: new Date().toISOString(),
      archive_reason: 'expired',
    })
    .eq('post_type', 'deal')
    .is('archived_at', null)
    .in('audience', LOCAL_AUDIENCES)
    .not('deal_expires_at', 'is', null)
    .lt('deal_expires_at', dealCutoff)
    .select('id');

  if (dealErr) {
    logger.error('[autoArchive] Error archiving expired deals', { error: dealErr.message });
  } else {
    totalArchived += (expiredDeals || []).length;
    if (expiredDeals?.length) logger.info('[autoArchive] Archived expired deals', { count: expiredDeals.length });
  }

  // 4) Archive by category TTL from PostCategoryTTL table
  const { data: ttls, error: ttlErr } = await supabaseAdmin
    .from('PostCategoryTTL')
    .select('post_type, ttl_days');

  if (ttlErr) {
    logger.error('[autoArchive] Error fetching TTLs', { error: ttlErr.message });
    return;
  }

  for (const { post_type, ttl_days } of (ttls || [])) {
    // Skip events and deals — handled specially above
    if (post_type === 'event') continue;

    const cutoff = new Date(Date.now() - ttl_days * 24 * 60 * 60 * 1000).toISOString();

    const { data: archived, error: archiveErr } = await supabaseAdmin
      .from('Post')
      .update({
        is_archived: true,
        archived_at: new Date().toISOString(),
        archive_reason: 'expired',
      })
      .eq('post_type', post_type)
      .is('archived_at', null)
      .in('audience', LOCAL_AUDIENCES)
      .lt('created_at', cutoff)
      .select('id');

    if (archiveErr) {
      logger.error(`[autoArchive] Error archiving ${post_type}`, { error: archiveErr.message });
    } else if (archived?.length) {
      totalArchived += archived.length;
      logger.info(`[autoArchive] Archived ${post_type}`, { count: archived.length });
    }
  }

  // 5) Archive Home Neighborhood posts older than 7 days
  const neighborhoodCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: homeNeighborhood, error: hnErr } = await supabaseAdmin
    .from('Post')
    .update({
      is_archived: true,
      archived_at: new Date().toISOString(),
      archive_reason: 'expired',
    })
    .eq('post_as', 'home')
    .eq('audience', 'neighborhood')
    .is('archived_at', null)
    .lt('created_at', neighborhoodCutoff)
    .select('id');

  if (hnErr) {
    logger.error('[autoArchive] Error archiving home neighborhood posts', { error: hnErr.message });
  } else {
    totalArchived += (homeNeighborhood || []).length;
    if (homeNeighborhood?.length) {
      logger.info('[autoArchive] Archived home neighborhood posts', { count: homeNeighborhood.length });
    }
  }

  logger.info('[autoArchive] Completed', { totalArchived });
}

module.exports = autoArchivePosts;
