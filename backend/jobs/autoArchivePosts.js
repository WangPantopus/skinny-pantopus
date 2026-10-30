/**
 * Auto-Archive Posts Cron Job
 *
 * Ends posts when their window runs out (build spec §4, contract §1, §4.1 and §5):
 *   - A post with its own end time (`expires_at`; Pulse posts from S8, a Heads-up's is the
 *     time it names): at that time, whatever its audience.
 *   - Older posts (no `expires_at`), as before:
 *       - Stories:         24 hours
 *       - Events:          24 hours after the event ends (its end time, else its start time)
 *       - Deals/Promos:    3 days OR once the stated expiry day has ended in US Pacific
 *                          (deal_expires_at + 32h; see step 4), whichever first
 *       - Other types:     per PostCategoryTTL (Ask 7 days, Share 3, Offer 7, Heads-up 2,
 *                          Lost and found 14, ...)
 *       - Home Neighborhood: 7 days
 *     Only posts targeted to local audiences (nearby, neighborhood, saved_place,
 *     target_area); network/private posts do not auto-expire.
 *
 * Each post it ends gets its `resolution` with `state: 'archived'`: an Ask someone else
 * replied to `closed`, one nobody did `closed_unanswered`; Lost and found `closed`; an Event
 * `happened`; anything else `expired`. A post that already ended its own way (an answered Ask,
 * later a claimed Offer or a reunited pet) keeps its resolution and state. Asks marked solved
 * before resolutions existed get `answered`.
 *
 * Runs hourly at minute 15.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const {
  DAY_MS, LOCAL_AUDIENCES, askIdsWithReplies, resolutionWhenTimeRunsOut,
} = require('../services/pulse/lifecycle');

// End of a deal's stated expiry day in US Pacific, measured from the stored midnight (see step 4).
const DEAL_EXPIRY_GRACE_MS = 32 * 60 * 60 * 1000;
// Posts ended per read (their ids go in the request URL); each step takes up to MAX_BATCHES
// reads a run and the next run continues.
const BATCH_SIZE = 100;
const MAX_BATCHES = 10;
const ENDING_SELECT = 'id, user_id, post_type, resolution';

// Archives `posts`, giving each one that is still open its resolution. Returns how many it archived.
async function endPosts(posts, label) {
  const now = new Date().toISOString();
  const open = posts.filter((post) => !post.resolution);
  const repliedAskIds = await askIdsWithReplies(open.filter((post) => post.post_type === 'ask_local'));

  const idsByResolution = new Map();
  for (const post of posts) {
    const resolution = post.resolution ? null : resolutionWhenTimeRunsOut(post, repliedAskIds);
    if (!idsByResolution.has(resolution)) idsByResolution.set(resolution, []);
    idsByResolution.get(resolution).push(post.id);
  }

  let archived = 0;
  for (const [resolution, ids] of idsByResolution) {
    const archive = { is_archived: true, archived_at: now, archive_reason: 'expired' };
    let query = supabaseAdmin
      .from('Post')
      .update(resolution ? { ...archive, resolution, state: 'archived' } : archive)
      .in('id', ids)
      .is('archived_at', null);
    // A post its author resolved since it was read keeps that ending; the next run archives it.
    if (resolution) query = query.is('resolution', null);
    const { data, error } = await query.select('id');
    if (error) {
      logger.error(`[autoArchive] Error archiving ${label}`, { error: error.message, resolution });
    } else {
      archived += (data || []).length;
    }
  }
  if (archived) logger.info(`[autoArchive] Archived ${label}`, { count: archived });
  return archived;
}

// Ends the unarchived posts that `filter` picks, a batch at a time.
async function endMatching(label, filter) {
  let total = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const { data: posts, error } = await filter(
      supabaseAdmin.from('Post').select(ENDING_SELECT).is('archived_at', null),
    ).order('created_at', { ascending: true }).limit(BATCH_SIZE);
    if (error) {
      logger.error(`[autoArchive] Error reading ${label}`, { error: error.message });
      break;
    }
    if (!posts?.length) break;

    let archived;
    try {
      archived = await endPosts(posts, label);
    } catch (err) {
      // Without the replies an Ask's ending is unknown; leave these for the next run.
      logger.error(`[autoArchive] Error ending ${label}`, { error: err.message });
      break;
    }
    total += archived;
    if (posts.length < BATCH_SIZE || archived === 0) break;
  }
  return total;
}

async function autoArchivePosts() {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  let totalArchived = 0;

  // 0) An Ask marked solved before resolutions existed is an answered one (contract §4.1).
  const { data: answered, error: answeredErr } = await supabaseAdmin
    .from('Post')
    .update({ resolution: 'answered' })
    .eq('state', 'solved')
    .is('resolution', null)
    .select('id');
  if (answeredErr) {
    logger.error('[autoArchive] Error marking solved Asks answered', { error: answeredErr.message });
  } else if (answered?.length) {
    logger.info('[autoArchive] Marked solved Asks answered', { count: answered.length });
  }

  // 0b) Right now events neighbors stopped reporting end, with the Heads-ups waiting on them (§2.16).
  try {
    const quiet = await require('../services/pulse/rightNow').endQuiet(now);
    if (quiet) logger.info('[autoArchive] Ended quiet Right now events', { count: quiet });
  } catch (err) {
    logger.error('[autoArchive] Error ending quiet Right now events', { error: err.message });
  }

  // 1) Posts whose own end time has passed
  totalArchived += await endMatching('posts past their end time', (query) => query
    .not('expires_at', 'is', null)
    .lt('expires_at', nowIso));

  // 2) Stories (24h)
  totalArchived += await endMatching('stories', (query) => query
    .eq('is_story', true)
    .lt('story_expires_at', nowIso));

  // 3) Events 24h after they end (their end time, else their start time)
  const eventCutoff = new Date(now - DAY_MS).toISOString();
  totalArchived += await endMatching('events', (query) => query
    .eq('post_type', 'event')
    .in('audience', LOCAL_AUDIENCES)
    .is('expires_at', null)
    .or(`event_end_date.lt.${eventCutoff},and(event_end_date.is.null,event_date.lt.${eventCutoff})`));

  // 4) Archive deals once their stated expiry day has ended.
  //    Every client stores the day the poster picked as wall-clock time labelled UTC, not an instant:
  //    web sends the date ("2026-10-15" -> 2026-10-15T00:00Z) and the apps send 09:00Z of that date.
  //    Archiving at deal_expires_at took a deal "expiring Oct 15" down on the evening of Oct 14 in Pacific.
  //    Wait 32 hours past that midnight instead: the end of the stated day in US Pacific (UTC-8, so
  //    PDT is covered too), the launch region. A deal stays visible through its whole expiry day.
  const dealCutoff = new Date(now - DEAL_EXPIRY_GRACE_MS).toISOString();
  totalArchived += await endMatching('expired deals', (query) => query
    .eq('post_type', 'deal')
    .in('audience', LOCAL_AUDIENCES)
    .is('expires_at', null)
    .not('deal_expires_at', 'is', null)
    .lt('deal_expires_at', dealCutoff));

  // 5) By category TTL from the PostCategoryTTL table
  const { data: ttls, error: ttlErr } = await supabaseAdmin
    .from('PostCategoryTTL')
    .select('post_type, ttl_days');

  if (ttlErr) {
    logger.error('[autoArchive] Error fetching TTLs', { error: ttlErr.message });
  } else {
    for (const { post_type, ttl_days } of (ttls || [])) {
      // Events end by their own times (step 3)
      if (post_type === 'event') continue;

      const cutoff = new Date(now - ttl_days * DAY_MS).toISOString();
      totalArchived += await endMatching(post_type, (query) => query
        .eq('post_type', post_type)
        .in('audience', LOCAL_AUDIENCES)
        .is('expires_at', null)
        .lt('created_at', cutoff));
    }
  }

  // 6) Home Neighborhood posts older than 7 days
  const neighborhoodCutoff = new Date(now - 7 * DAY_MS).toISOString();
  totalArchived += await endMatching('home neighborhood posts', (query) => query
    .eq('post_as', 'home')
    .eq('audience', 'neighborhood')
    .is('expires_at', null)
    .lt('created_at', neighborhoodCutoff));

  logger.info('[autoArchive] Completed', { totalArchived });
}

module.exports = autoArchivePosts;
