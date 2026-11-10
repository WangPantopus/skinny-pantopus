/**
 * Moments housekeeping (every 10 minutes; services/moments). Moments end on time without it: every read checks the end
 * time itself. This job:
 *   1. finishes a picture check an upload left running (the process restarted mid-check), and checks again the live
 *      Moments whose check couldn't run (no AI key, a timeout), until it gives up after momentCheck.MAX_ATTEMPTS;
 *   2. deletes the files of Moments that ended 7 days ago, unless a review holds them (held, or a report still open).
 * Each step leaves the rows it finishes behind (their state changes), and pages past the ones it can't finish yet, so
 * none can block the rest.
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
const MAX_PAGES = 8;

async function page(filter, offset) {
  const { data, error } = await filter(supabaseAdmin.from('Post').select(store.MOMENT_SELECT).eq('is_story', true))
    .order('story_expires_at', { ascending: true })
    .order('id', { ascending: true })
    .range(offset, offset + BATCH - 1);
  if (error) throw new Error(error.message);
  return data || [];
}

// Runs `handle(row)` (true: done, the row leaves the query) over every matching row, up to MAX_PAGES pages a run.
// Rows it couldn't finish stay in the query, so the next page starts past them.
async function each(filter, handle, label) {
  let offset = 0;
  let done = 0;
  for (let p = 0; p < MAX_PAGES; p += 1) {
    const rows = await page(filter, offset);
    let finished = 0;
    for (const row of rows) {
      try {
        if (await handle(row)) finished += 1;
      } catch (error) {
        logger.warn(`[momentsCleanup] ${label} failed`, { momentId: row.id, error: error.message });
      }
    }
    done += finished;
    if (rows.length < BATCH) break;
    offset += rows.length - finished;
  }
  return done;
}

// The pictures a stored Moment's check reads; when they can't be read the check counts as one that couldn't run.
async function checkStored(row) {
  try {
    return await momentCheck.checkPictures(await momentCheck.storedPictures(row));
  } catch (error) {
    logger.warn('[momentsCleanup] pictures unreadable', { momentId: row.id, error: error.message });
    return { status: 'unchecked', reasons: [], error: 'pictures unreadable' };
  }
}

function finishStuckChecks(nowIso) {
  const stuckBefore = new Date(Date.now() - STUCK_CHECK_MS).toISOString();
  return each((q) => q.gt('story_expires_at', nowIso).is('archived_at', null)
    .eq('post_metadata->moment->>state', 'checking')
    .lt('post_metadata->moment->>checking_since', stuckBefore),
  async (row) => Boolean(await momentCheck.finishUpload(row, await checkStored(row))), 'stuck check');
}

function recheck(nowIso) {
  return each((q) => q.gt('story_expires_at', nowIso).is('archived_at', null)
    .eq('moderation_state', 'live')
    .eq('post_metadata->moment->>state', 'live')
    .eq('post_metadata->moment->check->>status', 'unchecked'),
  async (row) => Boolean(await momentCheck.applyRecheck(row, await checkStored(row))), 'recheck');
}

// Photo and video Moments that ended KEEP_FILES_MS ago and still have files: recorded ones, or bytes an upload stored
// before it stopped (store.purgeFiles clears the whole folder). Held ones wait for review (a removed one doesn't).
function purgeEnded() {
  const endedBefore = new Date(Date.now() - KEEP_FILES_MS).toISOString();
  return each((q) => q.lt('story_expires_at', endedBefore)
    .neq('post_metadata->moment->>kind', 'text')
    .is('post_metadata->moment->>purged_at', null)
    .or('moderation_state.neq.held,archive_reason.eq.moderation'),
  (row) => store.purgeFiles(row), 'purge');
}

async function momentsCleanup() {
  const nowIso = new Date().toISOString();
  const stuck = await finishStuckChecks(nowIso);
  const rechecked = await recheck(nowIso);
  const purged = await purgeEnded();
  if (stuck || rechecked || purged) logger.info('[momentsCleanup] done', { stuck, rechecked, purged });
}

module.exports = momentsCleanup;
