/**
 * The morning notice (Mail tab, SRV-1): "Your mail is here", once per person per local morning, after a round brought
 * them at least one piece they can read, counting their own mail and their proven Homes' mail together. Nothing on a
 * morning when nothing came. It opens the Mail tab (/app/mailbox).
 *
 * The mail notification Lambda (pantopus-seeder mail_notifications.py) calls POST /api/internal/briefing/mail-morning
 * every five minutes; each call decides who is owed a notice now: people whose own clock reads 7:00 to 9:00 a.m. and
 * whose round came today with pieces they haven't opened, counted the way the Mail tab counts the round. The day is
 * claimed in AlertNotificationHistory (unique per person and local date) before the push and released if it doesn't go
 * out, so the next run tries again. A claim says whether its push went (users_notified 1) or is still going (0): one
 * left "still going" by a process that stopped mid-push is taken over by a later run after CLAIM_LEASE_MS, so a
 * restart never costs anyone their notice for the day.
 *
 * Built to keep up as the number of people grows: the people with new mail are read in a fixed order with no upper
 * limit that drops anyone, several people are worked on at once, a person already told today is passed over without
 * counting their mail again, and a run that is still going when the next call comes keeps going alone.
 *
 * Christmas cards sealed until Christmas morning were in the box already; the morning they open, the notice counts them
 * too ("2 sealed cards can be opened now"), so someone with only those still hears.
 */
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { getAccessibleHomeIds, mailReaderIdsOrThrow, visibleMailFilter } = require('../utils/homeMailAccess');
const { personTimeZone, localDate, FALLBACK_TIME_ZONE, countPieces, lastRoundAt } = require('./mailDelivery');

const LOOKBACK_MS = 24 * 60 * 60 * 1000;
const NOTICE_START_HOUR = 7;
const NOTICE_END_HOUR = 9;
const PAGE = 1000;
// A stop for a read that never ends, far above any real morning; reaching it is logged, never silent.
const MAX_ROWS = 2000000;
// People worked on at once: each one's reads and push don't wait for the person before them.
const WORKERS = 8;
// A run still going after this long is taken for stuck, and the next call starts a new one.
const RUN_STALE_MS = 30 * 60 * 1000;
// Someone with no phone to notify, or who turned the notice off, isn't asked again for two runs. Kept short: those
// answers can also come from a read that failed, and the morning is only two hours long.
const SETTLED_SKIPS = new Set(['preference_disabled', 'push_disabled', 'no_push_token']);
const SETTLED_SKIP_MS = 10 * 60 * 1000;
const settledSkips = new Map();
// A claim whose push hasn't been marked as gone after this long was left by a process that stopped: it can be taken.
const CLAIM_LEASE_MS = 5 * 60 * 1000;
let runningSince = 0;
// A person's time zone rarely changes and takes several reads to work out, so a zone that was read is kept here for an
// hour: a pass then doesn't read every candidate's zone again (mailDelivery keeps it ten minutes, for when a piece is
// sent). "No zone" isn't kept: it may be a read that failed, and mailDelivery already keeps a real one.
const ZONE_KEEP_MS = 60 * 60 * 1000;
const ZONES_MAX = 500000;
const zones = new Map();

async function zoneOf(userId) {
  const hit = zones.get(userId);
  if (hit && hit.until > Date.now()) return hit.zone;
  const zone = await personTimeZone(userId);
  if (zone) {
    if (zones.size >= ZONES_MAX) zones.clear();
    zones.set(userId, { zone, until: Date.now() + ZONE_KEEP_MS });
  }
  return zone;
}

/** Drop what ran out from the two memories this module keeps between runs. */
function forgetExpired(nowMs) {
  for (const [userId, until] of settledSkips) if (until <= nowMs) settledSkips.delete(userId);
  for (const [userId, hit] of zones) if (hit.until <= nowMs) zones.delete(userId);
}

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
    .or('mail_object_type.is.null,mail_object_type.neq.bundle')
    // A Christmas card that went right away had its own notice when it landed (services/cardNotice), and a card gets
    // exactly one: it neither brings this one nor is counted in it.
    .is('mail_extracted->card->>instant_day', null);
}

// Christmas cards whose seal lifted in the window and that nobody has opened yet (services/holidayCards).
function cardsOpening(select, options, since, now) {
  return supabaseAdmin.from('Mail').select(select, options)
    .contains('tags', ['holiday_card'])
    .gt('mail_extracted->card->>sealed_until', since.toISOString())
    .lte('mail_extracted->card->>sealed_until', now.toISOString())
    .lte('delivered_at', now.toISOString())
    .is('opened_at', null)
    .is('deleted_at', null)
    .not('recipient_user_id', 'is', null);
}

/**
 * Every value of `column` among the rows a query finds, added to `into`. The rows are read a page at a time in id
 * order, each page starting after the last id of the one before: without an order the database may hand the same row
 * to two pages and another to none, which left people out once there were more rows than one page. `build()` answers
 * the query, selecting `id` and `column`.
 */
async function distinctValues(build, column, into) {
  let after = null;
  for (let read = 0; read < MAX_ROWS;) {
    let query = build().order('id', { ascending: true }).limit(PAGE);
    if (after) query = query.gt('id', after);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const rows = data || [];
    for (const row of rows) into.add(row[column]);
    if (rows.length < PAGE) return into;
    read += rows.length;
    after = rows[rows.length - 1].id;
  }
  logger.error('Mail morning notice: stopped reading new mail at the row limit', { column, limit: MAX_ROWS });
  return into;
}

/** Run `work` for each item, `size` at a time. `work` never throws (it catches its own). */
async function inPool(items, size, work) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await work(item);
    }
  }));
}

/** Everyone who may have new mail: recipients of their own new pieces, and the readers of Homes that got some. */
async function candidates(since, now) {
  const people = new Set();
  const homes = new Set();
  await Promise.all([
    distinctValues(() => newMail('id, recipient_user_id', undefined, since, now).not('recipient_user_id', 'is', null),
      'recipient_user_id', people),
    distinctValues(() => cardsOpening('id, recipient_user_id', undefined, since, now), 'recipient_user_id', people),
    distinctValues(() => newMail('id, recipient_home_id', undefined, since, now).not('recipient_home_id', 'is', null),
      'recipient_home_id', homes),
  ]);
  // One Home whose readers can't be read just now is left for the next run; it doesn't stop everyone else's notice.
  await inPool([...homes], WORKERS, async (homeId) => {
    try {
      for (const userId of await mailReaderIdsOrThrow(homeId)) people.add(userId);
    } catch (error) {
      logger.warn('Mail morning notice: a Home\'s readers were not read', { error: error.message });
    }
  });
  return [...people];
}

/**
 * The days whose push went, as their claim keys, so a person told this morning is passed over without counting their
 * mail again on every later run. A claim is made in the person's 7 to 9 a.m., so the last few hours hold every one that
 * matters now. A claim still being sent isn't here: claimDay decides that one.
 */
async function claimedDays(now) {
  const claimed = new Set();
  const since = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString();
  await distinctValues(() => supabaseAdmin.from('AlertNotificationHistory').select('id, alert_id')
    .eq('alert_type', 'mail').eq('headline', 'mail_summary').gte('users_notified', 1).gt('created_at', since),
    'alert_id', claimed);
  return claimed;
}

/**
 * What this person can read from today's round, and how many of those pieces were special deliveries, counted the way
 * the Mail tab counts the round (mailDelivery.deliverySummary): what came in the 24 hours up to it. No round today, no
 * pieces: a special delivery or welcome letter that landed after yesterday's round would otherwise make a "came this
 * morning" notice that opens on "No mail today". Christmas cards count on the morning their seal lifts, round or not.
 */
async function countFor(userId, timeZone, now) {
  const homeIds = await getAccessibleHomeIds(userId);
  const since = new Date(now.getTime() - LOOKBACK_MS);
  const [roundAt, opening] = await Promise.all([
    lastRoundAt({ userId, homeIds, now }),
    cardsOpening('id', { count: 'exact', head: true }, since, now).eq('recipient_user_id', userId),
  ]);
  if (opening.error) throw new Error(opening.error.message);
  const cards = opening.count || 0;
  if (!roundAt || localDate(roundAt, timeZone) !== localDate(now, timeZone)) return { total: 0, special: 0, cards };
  const scoped = (select, options) => newMail(select, options, new Date(roundAt.getTime() - LOOKBACK_MS), roundAt)
    .or(visibleMailFilter(userId, homeIds));
  // A bundle is one piece, as the box shows it (SRV-5).
  const [total, special] = await Promise.all([
    countPieces(scoped),
    countPieces((select, options) => scoped(select, options).eq('special_delivery', true)),
  ]);
  return { total, special, cards };
}

/** The notice's words: plain, no emoji. */
function noticeText({ total, special, cards = 0 }) {
  const sealed = cards === 1 ? 'a sealed card' : `${cards} sealed cards`;
  if (!total) return { title: 'Your mail is here', body: `${cards === 1 ? 'A sealed card' : sealed} can be opened now.` };
  const pieces = total === 1 ? '1 piece came this morning' : `${total} pieces came this morning`;
  let including = '';
  if (special === 1) including = ', including one special delivery';
  else if (special > 1) including = `, including ${special} special deliveries`;
  const opening = cards ? `, and ${sealed} can be opened now` : '';
  return { title: 'Your mail is here', body: `${pieces}${including}${opening}.` };
}

const claimKey = (userId, date) => `mail_summary_${userId}_${date}`;

/**
 * Claim this person's day before their push. True when the day is this caller's to send: nobody claimed it, or the
 * claim was left "still going" longer than CLAIM_LEASE_MS ago by a process that stopped (taken over with a conditional
 * write, so only one caller gets it). False when it was sent, or is being sent right now.
 */
async function claimDay(userId, date) {
  const { error } = await supabaseAdmin.from('AlertNotificationHistory').insert({
    alert_type: 'mail', alert_id: claimKey(userId, date), geohash: 'global', headline: 'mail_summary', users_notified: 0,
    expires_at: new Date(Date.now() + 2 * LOOKBACK_MS).toISOString(),
  });
  if (!error) return true;
  if (error.code !== '23505') throw new Error(error.message);
  const { data: held, error: readError } = await supabaseAdmin.from('AlertNotificationHistory')
    .select('id, users_notified, created_at')
    .eq('alert_type', 'mail').eq('alert_id', claimKey(userId, date)).eq('geohash', 'global').maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!held || held.users_notified !== 0) return false; // sent today (or just released: the next run claims it)
  if (Date.now() - Date.parse(held.created_at) < CLAIM_LEASE_MS) return false; // being sent right now
  const { data: taken, error: takeError } = await supabaseAdmin.from('AlertNotificationHistory')
    .update({ created_at: new Date().toISOString() })
    .eq('id', held.id).eq('users_notified', 0).eq('created_at', held.created_at).select('id');
  if (takeError) throw new Error(takeError.message);
  return Boolean(taken?.length);
}

/** The push went: the claim stands for the day. Tried twice, since a claim left "still going" is sent again later. */
async function markSent(userId, date) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { error } = await supabaseAdmin.from('AlertNotificationHistory').update({ users_notified: 1 })
      .eq('alert_type', 'mail').eq('alert_id', claimKey(userId, date)).eq('geohash', 'global');
    if (!error) return;
    if (attempt) logger.warn('Mail morning notice: claim not marked sent', { error: error.message });
  }
}

async function releaseDay(userId, date) {
  const { error } = await supabaseAdmin.from('AlertNotificationHistory').delete()
    .eq('alert_type', 'mail').eq('alert_id', claimKey(userId, date)).eq('geohash', 'global').eq('users_notified', 0);
  if (error) logger.warn('Mail morning notice: claim not released', { error: error.message });
}

const newStats = () => ({ candidates: 0, sent: 0, skipped: 0, failed: 0, not_morning: 0, nothing_new: 0, already_sent: 0 });

async function noticeFor(userId, { clock, send, claimed, stats }) {
  let claimedDate = null;
  try {
    const timeZone = (await zoneOf(userId)) || FALLBACK_TIME_ZONE;
    // The time when this person's turn comes: a pass over many people can run for minutes.
    const now = clock();
    const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(now));
    if (hour < NOTICE_START_HOUR || hour >= NOTICE_END_HOUR) { stats.not_morning += 1; return; }
    const date = localDate(now, timeZone);
    if (claimed.has(claimKey(userId, date))) { stats.already_sent += 1; return; }
    if ((settledSkips.get(userId) || 0) > Date.now()) { stats.skipped += 1; return; }
    const counts = await countFor(userId, timeZone, now);
    if (counts.total === 0 && counts.cards === 0) { stats.nothing_new += 1; return; }
    if (!(await claimDay(userId, date))) { stats.already_sent += 1; return; }
    claimedDate = date;
    const { title, body } = noticeText(counts);
    const result = await send({ userId, title, body, reminderType: 'mail_summary',
      data: { route: '/app/mailbox', link: '/app/mailbox' } });
    if (result?.status === 'sent') {
      claimedDate = null;
      stats.sent += 1;
      await markSent(userId, date);
      return;
    }
    // Not sent (quiet hours, no device, push off, a provider failure): release the day so a later run can try.
    if (result?.status === 'skipped') {
      stats.skipped += 1;
      if (SETTLED_SKIPS.has(result.reason)) settledSkips.set(userId, Date.now() + SETTLED_SKIP_MS);
    } else {
      stats.failed += 1;
    }
  } catch (error) {
    stats.failed += 1;
    logger.warn('Mail morning notice failed for one person', { error: error.message });
  } finally {
    // A thrown provider error must release the claim too, or today's notice can never retry.
    if (claimedDate) await releaseDay(userId, claimedDate).catch((error) => {
      logger.warn('Mail morning notice: claim not released', { error: error.message });
    });
  }
}

/**
 * One pass. `send({ userId, title, body, reminderType, data })` delivers a push and answers { status: 'sent' |
 * 'skipped' | 'failed', reason }. Returns counts only; never letter text or who got what. While an earlier pass is
 * still going in this process, a new one does nothing ({ busy: true }): the day's claim already keeps two passes from
 * telling one person twice, and a second pass over the same people would only slow the first.
 */
async function runMorningNotices({ now, send }) {
  const stats = newStats();
  if (runningSince && Date.now() - runningSince < RUN_STALE_MS) return { ...stats, busy: true };
  const started = Date.now();
  runningSince = started;
  try {
    // A caller's `now` holds for the whole pass; without one, each person is judged by the time their turn comes.
    const clock = now ? () => now : () => new Date();
    const startedAt = clock();
    const since = new Date(startedAt.getTime() - LOOKBACK_MS);
    forgetExpired(started);
    const [people, claimed] = await Promise.all([candidates(since, startedAt), claimedDays(startedAt)]);
    stats.candidates = people.length;
    await inPool(people, WORKERS, (userId) => noticeFor(userId, { clock, send, claimed, stats }));
    return stats;
  } finally {
    if (runningSince === started) runningSince = 0;
  }
}

module.exports = { runMorningNotices, noticeText, NOTICE_START_HOUR, NOTICE_END_HOUR };
