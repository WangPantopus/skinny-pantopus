/**
 * The morning notice (Mail tab, SRV-1): "Your mail is here", once per person per local morning, after a round brought
 * them at least one piece they can read, counting their own mail and their proven Homes' mail together. Nothing on a
 * morning when nothing came. It opens the Mail tab (/app/mailbox).
 *
 * The mail notification Lambda (pantopus-seeder mail_notifications.py) calls POST /api/internal/briefing/mail-morning
 * every five minutes; each call decides who is owed a notice now: people whose own clock reads 7:00 to 9:00 a.m. and
 * who have unopened pieces that came in the last 24 hours. The day is claimed in AlertNotificationHistory (unique per
 * person and local date) before the push and released if it doesn't go out, so the next run tries again.
 */
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { getAccessibleHomeIds, mailReaderIdsOrThrow, visibleMailFilter } = require('../utils/homeMailAccess');
const { personTimeZone, localDate, FALLBACK_TIME_ZONE } = require('./mailDelivery');

const LOOKBACK_MS = 24 * 60 * 60 * 1000;
const NOTICE_START_HOUR = 7;
const NOTICE_END_HOUR = 9;
const PAGE = 1000;
const MAX_ROWS = 20000;

// Unopened pieces that came in the window, as every mailbox read shows them (not Earn, not deleted, not shredded).
function newMail(select, options, since, now) {
  return supabaseAdmin.from('Mail').select(select, options)
    .gt('delivered_at', since.toISOString())
    .lte('delivered_at', now.toISOString())
    .eq('viewed', false)
    .is('opened_at', null)
    .eq('archived', false)
    .in('lifecycle', ['delivered', 'opened'])
    .is('deleted_at', null)
    .or('drawer.is.null,drawer.neq.earn')
    // A bundle is a wrapper: its pieces are what came.
    .or('mail_object_type.is.null,mail_object_type.neq.bundle');
}

async function pagedRows(build) {
  const rows = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

/** Everyone who may have new mail: recipients of their own new pieces, and the readers of Homes that got some. */
async function candidates(since, now) {
  const own = await pagedRows(() => newMail('recipient_user_id', undefined, since, now).not('recipient_user_id', 'is', null));
  const homes = await pagedRows(() => newMail('recipient_home_id', undefined, since, now).not('recipient_home_id', 'is', null));
  const people = new Set(own.map((row) => row.recipient_user_id));
  for (const homeId of new Set(homes.map((row) => row.recipient_home_id))) {
    for (const userId of await mailReaderIdsOrThrow(homeId)) people.add(userId);
  }
  return [...people];
}

/** What this person can read that came in the window: how many, and how many of them were special deliveries. */
async function countFor(userId, since, now) {
  const homeIds = await getAccessibleHomeIds(userId);
  const scoped = (q) => q.or(visibleMailFilter(userId, homeIds));
  const [all, special] = await Promise.all([
    scoped(newMail('id', { count: 'exact', head: true }, since, now)),
    scoped(newMail('id', { count: 'exact', head: true }, since, now)).eq('special_delivery', true),
  ]);
  if (all.error || special.error) throw new Error((all.error || special.error).message);
  return { total: all.count || 0, special: special.count || 0 };
}

/** The notice's words: plain, no emoji. */
function noticeText({ total, special }) {
  const pieces = total === 1 ? '1 piece came this morning' : `${total} pieces came this morning`;
  let including = '';
  if (special === 1) including = ', including one special delivery';
  else if (special > 1) including = `, including ${special} special deliveries`;
  return { title: 'Your mail is here', body: `${pieces}${including}.` };
}

const claimKey = (userId, date) => `mail_summary_${userId}_${date}`;

async function claimDay(userId, date) {
  const { error } = await supabaseAdmin.from('AlertNotificationHistory').insert({
    alert_type: 'mail', alert_id: claimKey(userId, date), geohash: 'global', headline: 'mail_summary', users_notified: 1,
    expires_at: new Date(Date.now() + 2 * LOOKBACK_MS).toISOString(),
  });
  if (!error) return true;
  if (error.code === '23505') return false; // already sent (or being sent) today
  throw new Error(error.message);
}

async function releaseDay(userId, date) {
  const { error } = await supabaseAdmin.from('AlertNotificationHistory').delete()
    .eq('alert_type', 'mail').eq('alert_id', claimKey(userId, date)).eq('geohash', 'global');
  if (error) logger.warn('Mail morning notice: claim not released', { error: error.message });
}

/**
 * One pass. `send({ userId, title, body, reminderType, data })` delivers a push and answers { status: 'sent' |
 * 'skipped' | 'failed', reason }. Returns counts only; never letter text or who got what.
 */
async function runMorningNotices({ now = new Date(), send }) {
  const since = new Date(now.getTime() - LOOKBACK_MS);
  const stats = { candidates: 0, sent: 0, skipped: 0, failed: 0, not_morning: 0, nothing_new: 0, already_sent: 0 };
  const people = await candidates(since, now);
  stats.candidates = people.length;
  for (const userId of people) {
    try {
      const timeZone = (await personTimeZone(userId)) || FALLBACK_TIME_ZONE;
      const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(now));
      if (hour < NOTICE_START_HOUR || hour >= NOTICE_END_HOUR) { stats.not_morning += 1; continue; }
      const counts = await countFor(userId, since, now);
      if (counts.total === 0) { stats.nothing_new += 1; continue; }
      const date = localDate(now, timeZone);
      if (!(await claimDay(userId, date))) { stats.already_sent += 1; continue; }
      const { title, body } = noticeText(counts);
      const result = await send({ userId, title, body, reminderType: 'mail_summary',
        data: { route: '/app/mailbox', link: '/app/mailbox' } });
      if (result?.status === 'sent') { stats.sent += 1; continue; }
      // Not sent (quiet hours, no device, push off, a provider failure): release the day so a later run can try.
      await releaseDay(userId, date);
      if (result?.status === 'skipped') stats.skipped += 1; else stats.failed += 1;
    } catch (error) {
      stats.failed += 1;
      logger.warn('Mail morning notice failed for one person', { error: error.message });
    }
  }
  return stats;
}

module.exports = { runMorningNotices, noticeText, NOTICE_START_HOUR, NOTICE_END_HOUR };
