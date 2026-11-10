// "Priya added a Moment": one push to the author's connections when a Moment goes live (a text card when it's posted, a
// photo or video when its upload and picture check finish). A push only: no Notification row, so nothing stays in the
// bell after the Moment ends. It says who and where in the words everyone reads on the ring (a place, a street's name
// or a town, never an address), and carries no picture, caption or card text.
//
// Who gets it: an accepted connection with Moments on, no block either way, who hasn't muted the author (everywhere or
// in Moments), with push on, the "Moments from your connections" switch on
// (UserNotificationPreferences.moments_enabled) and outside their quiet hours right now. A push that can't go now is
// dropped, not held: by the time quiet hours end the Moment may be over.
//
// Not too many: one author notifies at most once in 6 hours (three Moments in an hour are one push), and a person gets
// at most 5 of these in 24 hours. No table of its own: the Moment that notified carries
// post_metadata.moment.notify.sent_at, which gives the 6-hour rule exactly; the cap of 5 counts the notifying Moments
// of the person's connections in the last day, so it can only stop a little early, never late.
//
// Only people's Moments notify (not a business's or the curator's), never a held one, and none later when a hold is
// released. Runs after the answer to the app and never throws.

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const { timezoneFromCoordinates } = require('../../utils/timezone');
const store = require('./momentStore');

const HOUR_MS = 60 * 60 * 1000;
const AUTHOR_QUIET_MS = 6 * HOUR_MS;
const DAY_MS = 24 * HOUR_MS;
const DAILY_CAP = 5;
// Ids per read (they go in the request URL) and rows per page of a paged read.
const IDS_PER_READ = 100;
const PAGE = 1000;
// Recipients checked at once (each reads their quiet hours) and connections told per Moment at most.
const CHECKS_AT_ONCE = 8;
const MAX_RECIPIENTS = 5000;
// The notifying Moments of the last day the cap looks at; past this many it counts the newest.
const MAX_RECENT = 2000;
const SENT_AT = 'post_metadata->moment->notify->>sent_at';

function chunks(list, size = IDS_PER_READ) {
  const out = [];
  for (let at = 0; at < list.length; at += size) out.push(list.slice(at, at + size));
  return out;
}

async function rowsOf(query, what) {
  const { data, error } = await query;
  if (error) throw new Error(`Failed to read ${what}: ${error.message}`);
  return data || [];
}

/** Every row of a read too long for one answer (`page(from, to)` answers a query ordered the same each time). */
async function paged(page, what, most = MAX_RECIPIENTS) {
  const all = [];
  for (let from = 0; from < most; from += PAGE) {
    const rows = await rowsOf(page(from, from + PAGE - 1), what);
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

const otherOf = (link, userId) => (String(link.requester_id) === String(userId) ? link.addressee_id : link.requester_id);

/** The accounts `userId` is connected to (accepted both ways round). */
async function connectionIds(userId) {
  const links = await paged((from, to) => supabaseAdmin.from('Relationship').select('id, requester_id, addressee_id')
    .eq('status', 'accepted').or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order('id', { ascending: true }).range(from, to), 'connections');
  return [...new Set(links.map((link) => String(otherOf(link, userId))))].filter((id) => id !== String(userId));
}

/**
 * This Moment takes the author's turn to notify, or doesn't: false when another of their Moments notified within
 * AUTHOR_QUIET_MS. The stamp goes on first and is taken back if an earlier one stands, so two Moments going live at
 * the same instant never both notify. → the stamped row, or null.
 */
async function claimTurn(row) {
  const now = new Date();
  const sentAt = now.toISOString();
  const since = new Date(now.getTime() - AUTHOR_QUIET_MS).toISOString();
  const claimed = await store.updateMoment(row, { moment: { notify: { sent_at: sentAt } } },
    { 'post_metadata->moment->>notify': null, archived_at: null, moderation_state: 'live' });
  if (!claimed) return null;
  const others = await rowsOf(supabaseAdmin.from('Post').select(`id, sent_at:${SENT_AT}`)
    .eq('is_story', true).eq('user_id', row.user_id).neq('id', row.id).gt(SENT_AT, since).limit(20), 'the author\'s Moments');
  const earlier = others.some((other) => other.sent_at < sentAt || (other.sent_at === sentAt && other.id < row.id));
  if (!earlier) return claimed;
  await store.updateMoment(claimed, { moment: { notify: { skipped: 'recent' } } }).catch(() => null);
  return null;
}

/**
 * The people among `candidates` who already had DAILY_CAP of these pushes in the last day, counted as the notifying
 * Moments of their connections (each such Moment reached them at most once).
 */
async function overDailyCap(candidates, exceptMomentId) {
  const recent = await rowsOf(supabaseAdmin.from('Post').select('id, user_id')
    .eq('is_story', true).gt(SENT_AT, new Date(Date.now() - DAY_MS).toISOString()).neq('id', exceptMomentId)
    .order('created_at', { ascending: false }).limit(MAX_RECENT), 'recent Moments');
  const capped = new Set();
  if (recent.length < DAILY_CAP) return capped;
  const byAuthor = new Map();
  for (const post of recent) byAuthor.set(String(post.user_id), (byAuthor.get(String(post.user_id)) || 0) + 1);
  const wanted = new Set(candidates.map(String));
  const had = new Map();
  for (const authors of chunks([...byAuthor.keys()], 50)) {
    const list = authors.join(',');
    const links = await paged((from, to) => supabaseAdmin.from('Relationship').select('id, requester_id, addressee_id')
      .eq('status', 'accepted').or(`requester_id.in.(${list}),addressee_id.in.(${list})`)
      .order('id', { ascending: true }).range(from, to), 'connections', 20000);
    for (const link of links) {
      for (const [author, person] of [[link.requester_id, link.addressee_id], [link.addressee_id, link.requester_id]]) {
        const count = byAuthor.get(String(author));
        if (count && wanted.has(String(person))) had.set(String(person), (had.get(String(person)) || 0) + count);
      }
    }
  }
  for (const [person, count] of had) if (count >= DAILY_CAP) capped.add(person);
  return capped;
}

/** Splits the author's connections into the ones to tell and, by reason, the ones left out. */
async function recipientsOf(row, authorId) {
  const { getFlag, _flagAllowsUser } = require('../featureFlagService');
  const { blockedUserIds } = require('../blockService');
  const heldPushes = require('../heldPushes');
  const skipped = { blocked: [], muted: [], moments_off: [], push_off: [], switch_off: [], quiet_hours: [], daily_cap: [] };
  let left = (await connectionIds(authorId)).slice(0, MAX_RECIPIENTS);
  const connections = left.length;
  const drop = (reason, isOut) => {
    const kept = [];
    for (const id of left) (isOut(id) ? skipped[reason] : kept).push(id);
    left = kept;
  };
  if (!left.length) return { connections, recipients: [], skipped };

  const blocked = new Set([...await blockedUserIds(authorId)].map(String));
  drop('blocked', (id) => blocked.has(id));

  const [flag, people, mutes, global, own] = await Promise.all([
    getFlag('moments'),
    Promise.all(chunks(left).map((ids) => rowsOf(supabaseAdmin.from('User').select('id, role').in('id', ids), 'people'))),
    Promise.all(chunks(left).map((ids) => rowsOf(supabaseAdmin.from('PostMute').select('user_id')
      .eq('muted_entity_type', 'user').eq('muted_entity_id', authorId).in('user_id', ids), 'mutes'))),
    Promise.all(chunks(left).map((ids) => rowsOf(supabaseAdmin.from('MailPreferences').select('user_id, push_notifications')
      .in('user_id', ids), 'push settings'))),
    Promise.all(chunks(left).map((ids) => rowsOf(supabaseAdmin.from('UserNotificationPreferences')
      .select('user_id, moments_enabled').in('user_id', ids), 'notification settings'))),
  ]);
  const muted = new Set(mutes.flat().map((mute) => String(mute.user_id)));
  drop('muted', (id) => muted.has(id));
  const roles = new Map(people.flat().map((person) => [String(person.id), person]));
  drop('moments_off', (id) => !roles.has(id) || !_flagAllowsUser(flag, roles.get(id)));
  // No saved row means on, for push as a whole (notificationService.pushSwitchOn) and for this switch.
  const pushOff = new Set(global.flat().filter((prefs) => prefs.push_notifications === false).map((prefs) => String(prefs.user_id)));
  drop('push_off', (id) => pushOff.has(id));
  const switchOff = new Set(own.flat().filter((prefs) => prefs.moments_enabled === false).map((prefs) => String(prefs.user_id)));
  drop('switch_off', (id) => switchOff.has(id));

  if (left.length) {
    const capped = await overDailyCap(left, row.id);
    drop('daily_cap', (id) => capped.has(id));
  }

  // Quiet hours are each person's own (else 9 PM to 8 AM), in their own time zone, or the Moment's when theirs isn't
  // known (connections mostly live near each other). One that can't be read counts as quiet: no push rather than one
  // at night.
  const fallbackTz = timezoneFromCoordinates(row.latitude, row.longitude, 'UTC');
  const quiet = new Set();
  for (const ids of chunks(left, CHECKS_AT_ONCE)) {
    await Promise.all(ids.map(async (id) => {
      try {
        if ((await heldPushes.pushWindow(id, { fallbackTz })).until) quiet.add(id);
      } catch (_) {
        quiet.add(id);
      }
    }));
  }
  drop('quiet_hours', (id) => quiet.has(id));
  return { connections, recipients: left, skipped };
}

/** The push's words for a Moment and its author (CONTRACT "Push"). */
function pushText(row, author) {
  const m = store.meta(row);
  const place = String(row.location_name || '').trim();
  return {
    title: `${author.first_name} added a Moment`,
    body: place ? `${m.show_area || m.at_home ? 'In' : 'At'} ${place}` : 'Tap to watch it.',
  };
}

/**
 * Tells the author's connections about a Moment that just went live. Call it without awaiting, after the answer to the
 * app. Never throws; logs who was told and who was left out, by reason.
 */
async function notifyConnections(row) {
  try {
    if (!row || store.momentState(row) !== 'live' || store.meta(row).notify) return;
    const author = (await store.loadAuthors([row.user_id])).get(String(row.user_id));
    // Only people's Moments notify.
    if (!author || author.kind !== 'person') return;
    const claimed = await claimTurn(row);
    if (!claimed) {
      logger.info('moments.notify', { momentId: row.id, authorId: row.user_id, sent: 0, reason: 'author_notified_recently' });
      return;
    }
    const { connections, recipients, skipped } = await recipientsOf(claimed, String(row.user_id));
    const pushService = require('../pushService');
    const text = pushText(claimed, author);
    let failed = 0;
    for (const ids of chunks(recipients, CHECKS_AT_ONCE)) {
      await Promise.all(ids.map((userId) => pushService.sendToUser(userId, {
        ...text,
        data: {
          type: 'moment_new', link: `/app/moments/${row.id}`, moment_id: row.id, author_id: row.user_id,
          recipient_user_id: userId,
        },
      }).catch((error) => {
        failed += 1;
        logger.warn('moments.notify_push_failed', { momentId: row.id, userId, error: error.message });
      })));
    }
    const some = (ids) => (ids.length > 20 ? [...ids.slice(0, 20), `and ${ids.length - 20} more`] : ids);
    logger.info('moments.notify', {
      momentId: row.id, authorId: row.user_id, connections, sent: recipients.length - failed, failed,
      title: text.title, body: text.body, sentTo: some(recipients),
      skipped: Object.fromEntries(Object.entries(skipped).filter(([, ids]) => ids.length).map(([reason, ids]) => [reason, some(ids)])),
    });
  } catch (error) {
    logger.warn('moments.notify_failed', { momentId: row?.id, error: error.message });
  }
}

module.exports = { notifyConnections, pushText, AUTHOR_QUIET_MS, DAILY_CAP };
