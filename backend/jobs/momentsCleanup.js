/**
 * Moments housekeeping (every 10 minutes; services/moments). Moments end on time without it: every read checks the end
 * time itself. This job:
 *   1. finishes a picture check an upload left running (the process restarted mid-check), and checks again the live
 *      Moments whose check couldn't run (no AI key, a timeout), up to momentCheck.MAX_ATTEMPTS times;
 *   2. deletes the files of Moments that ended 7 days ago, unless a review holds them (held, or a report still open).
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const store = require('../services/moments/momentStore');
const momentCheck = require('../services/moments/momentCheck');

const DAY_MS = 24 * 60 * 60 * 1000;
const KEEP_FILES_MS = 7 * DAY_MS;
// An upload's answer waits 12 s for the check; one still checking after this was left behind.
const STUCK_CHECK_MS = 2 * 60 * 1000;
const BATCH = 25;

async function rows(filter) {
  const { data, error } = await filter(supabaseAdmin.from('Post').select(store.MOMENT_SELECT).eq('is_story', true)).limit(BATCH);
  if (error) throw new Error(error.message);
  return data || [];
}

async function finishStuckChecks(nowIso) {
  const stuckBefore = new Date(Date.now() - STUCK_CHECK_MS).toISOString();
  const stuck = await rows((q) => q.gt('story_expires_at', nowIso).is('archived_at', null)
    .eq('post_metadata->moment->>state', 'checking')
    .lt('post_metadata->moment->>checking_since', stuckBefore));
  for (const row of stuck) {
    try {
      const result = await momentCheck.checkPictures(await momentCheck.storedPictures(row));
      await momentCheck.finishUpload(row, result);
    } catch (error) {
      logger.warn('[momentsCleanup] stuck check failed', { momentId: row.id, error: error.message });
    }
  }
  return stuck.length;
}

async function recheck(nowIso) {
  const unchecked = await rows((q) => q.gt('story_expires_at', nowIso).is('archived_at', null)
    .eq('moderation_state', 'live')
    .eq('post_metadata->moment->>state', 'live')
    .eq('post_metadata->moment->check->>status', 'unchecked'));
  let checked = 0;
  for (const row of unchecked) {
    if ((Number(store.meta(row).check?.attempts) || 0) > momentCheck.MAX_ATTEMPTS) continue;
    try {
      const result = await momentCheck.checkPictures(await momentCheck.storedPictures(row));
      await momentCheck.applyRecheck(row, result);
      checked += 1;
    } catch (error) {
      logger.warn('[momentsCleanup] recheck failed', { momentId: row.id, error: error.message });
    }
  }
  return checked;
}

async function purgeEnded() {
  const endedBefore = new Date(Date.now() - KEEP_FILES_MS).toISOString();
  const ended = await rows((q) => q.lt('story_expires_at', endedBefore)
    .not('post_metadata->moment->>media', 'is', null)
    .is('post_metadata->moment->>purged_at', null)
    .order('story_expires_at', { ascending: true }));
  let purged = 0;
  for (const row of ended) {
    try {
      if (await store.purgeFiles(row)) purged += 1;
    } catch (error) {
      logger.warn('[momentsCleanup] purge failed', { momentId: row.id, error: error.message });
    }
  }
  return purged;
}

async function momentsCleanup() {
  const nowIso = new Date().toISOString();
  const stuck = await finishStuckChecks(nowIso);
  const rechecked = await recheck(nowIso);
  const purged = await purgeEnded();
  if (stuck || rechecked || purged) logger.info('[momentsCleanup] done', { stuck, rechecked, purged });
}

module.exports = momentsCleanup;
