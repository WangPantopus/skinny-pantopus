/**
 * Mail comes in the morning (Mail tab, SRV-1; founder decision 2026-10-27: ordinary mail arrives once a day,
 * time-sensitive pieces right away).
 *
 * The one delivery rule. Every writer of a Mail row asks deliveryFor() (or withDelivery() for several rows) before it
 * inserts, and stores the delivered_at and special_delivery it answers:
 *   - A special delivery lands now: certified, urgency time_sensitive or overdue, or due today or earlier in the
 *     mailbox's time zone.
 *   - Anything else lands at the next 7:00 a.m. in the mailbox's time zone: the Home's (from its location) for Home
 *     mail, the person's own (resolved like the briefings: their briefing location, else their saved zone) for theirs.
 *     A mailbox whose zone can't be told gets Pacific time, where the pilot is.
 * The database can't tell a Home's time zone, so the rule lives here; Mail.delivered_at defaults to now(), so a writer
 * that skipped it would deliver at once rather than lose a piece. Reads show only pieces whose delivered_at has come
 * (utils/homeMailAccess onlyDelivered), so delivery never waits on a scheduled job.
 */
const { DateTime } = require('luxon');
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { resolveHomeTimezone, validTimezone } = require('../utils/timezone');
const { visibleMailFilter, mailReaderIdsOrThrow, canAccessMail } = require('../utils/homeMailAccess');

const MORNING_HOUR = 7;
const FALLBACK_TIME_ZONE = 'America/Los_Angeles';
const ZONE_CACHE_MS = 10 * 60 * 1000;
const zoneCache = new Map();

/** The next morning round strictly after `now` in this zone: today's 7:00 if it hasn't come yet, else tomorrow's. */
function nextRound(timeZone, now = new Date()) {
  const local = DateTime.fromJSDate(now, { zone: timeZone });
  let round = local.set({ hour: MORNING_HOUR, minute: 0, second: 0, millisecond: 0 });
  if (round <= local) round = round.plus({ days: 1 }).set({ hour: MORNING_HOUR, minute: 0, second: 0, millisecond: 0 });
  return round.toJSDate();
}

/** This date in this zone, as YYYY-MM-DD. */
function localDate(date, timeZone) {
  return DateTime.fromJSDate(date, { zone: timeZone }).toISODate();
}

/** Whether a piece skips the morning round. `piece` carries certified, urgency and due_date (YYYY-MM-DD or ISO). */
function isSpecialDelivery(piece, timeZone, now = new Date()) {
  if (piece.certified === true) return true;
  if (piece.urgency === 'time_sensitive' || piece.urgency === 'overdue') return true;
  if (piece.due_date) {
    const due = String(piece.due_date).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(due) && due <= localDate(now, timeZone)) return true;
  }
  return false;
}

function cached(key, read) {
  const hit = zoneCache.get(key);
  if (hit && hit.until > Date.now()) return hit.zone;
  if (zoneCache.size > 5000) zoneCache.clear();
  const zone = read().then((value) => value, () => null);
  zoneCache.set(key, { zone, until: Date.now() + ZONE_CACHE_MS });
  return zone;
}

/** A Home's time zone from its location, or null when it has none. */
function homeTimeZone(homeId) {
  if (!homeId) return Promise.resolve(null);
  return cached(`home:${homeId}`, async () => {
    const { data, error } = await supabaseAdmin.from('Home')
      .select('id, location, map_center_lat, map_center_lng').eq('id', homeId).maybeSingle();
    if (error || !data) return null;
    return resolveHomeTimezone(data, null);
  });
}

/** A person's own time zone, the way the briefings resolve it, or null. */
function personTimeZone(userId) {
  if (!userId) return Promise.resolve(null);
  return cached(`user:${userId}`, async () => {
    // Loaded here: the location resolver pulls in the context services, which this module doesn't otherwise need.
    // eslint-disable-next-line global-require
    const { resolveNotificationTimezone } = require('./context/locationResolver');
    return validTimezone(await resolveNotificationTimezone(userId));
  });
}

/** The time zone of the mailbox a piece goes to: its Home's for Home mail, its person's otherwise. */
async function mailboxTimeZone(piece) {
  const zone = piece.recipient_home_id
    ? await homeTimeZone(piece.recipient_home_id)
    : await personTimeZone(piece.recipient_user_id);
  return zone || FALLBACK_TIME_ZONE;
}

// SRV-5's vacation hold plugs in here: given (piece, now), the time a hold keeps the piece until, or null. No hold yet.
async function heldUntil() {
  return null;
}

/**
 * When this piece goes into the box. `piece` has the recipient and the fields the rule reads (certified, urgency,
 * due_date). `immediate` lands it now without marking it special (a welcome letter on first open).
 * @returns {Promise<{ delivered_at: string, special_delivery: boolean }>}
 */
async function deliveryFor(piece, { now = new Date(), immediate = false } = {}) {
  if (immediate) return { delivered_at: now.toISOString(), special_delivery: false };
  let timeZone = FALLBACK_TIME_ZONE;
  try {
    timeZone = await mailboxTimeZone(piece);
  } catch (error) {
    logger.warn('mailDelivery: time zone unavailable, using the fallback', { error: error.message });
  }
  if (isSpecialDelivery(piece, timeZone, now)) return { delivered_at: now.toISOString(), special_delivery: true };
  const held = await heldUntil(piece, now);
  const at = held && held > nextRound(timeZone, now) ? held : nextRound(timeZone, now);
  return { delivered_at: at.toISOString(), special_delivery: false };
}

/** The rows with their delivery fields set, for a writer that inserts several at once. */
async function withDelivery(rows, options = {}) {
  const now = options.now || new Date();
  return Promise.all((rows || []).map(async (row) => ({ ...row, ...(await deliveryFor(row, { ...options, now })) })));
}

// Pieces a person can read, for the mailbox-wide numbers: their own and their readable Homes' (not Earn, which stays
// hidden with mail_extras), delivered by `now`, neither deleted nor shredded.
function readableDelivered(select, options, userId, homeIds, now) {
  return supabaseAdmin.from('Mail').select(select, options)
    .or(visibleMailFilter(userId, homeIds))
    .or('drawer.is.null,drawer.neq.earn')
    .or('lifecycle.is.null,lifecycle.neq.shredded')
    .is('deleted_at', null)
    .lte('delivered_at', now.toISOString());
}

/**
 * The mailbox's delivery line for GET /api/mailbox/v2/drawers: the latest morning round that brought this person a
 * piece they can read, how many came in the 24 hours up to it (special deliveries included) and how many of those are
 * unopened, and the next round of their own mailbox.
 * @returns {Promise<{ last_at: string|null, last_count: number, last_unopened: number, next_at: string, time_zone: string }>}
 */
async function deliverySummary({ userId, homeIds, now = new Date() }) {
  const timeZone = (await personTimeZone(userId)) || FALLBACK_TIME_ZONE;
  const summary = { last_at: null, last_count: 0, last_unopened: 0, next_at: nextRound(timeZone, now).toISOString(), time_zone: timeZone };
  const { data: latest, error } = await readableDelivered('delivered_at', undefined, userId, homeIds, now)
    .eq('special_delivery', false)
    .order('delivered_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  if (!latest?.length) return summary;
  const lastAt = new Date(latest[0].delivered_at);
  const windowStart = new Date(lastAt.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const inWindow = () => readableDelivered('id', { count: 'exact', head: true }, userId, homeIds, lastAt)
    .gt('delivered_at', windowStart);
  const [all, unopened] = await Promise.all([inWindow(), inWindow().eq('viewed', false).is('opened_at', null)]);
  if (all.error || unopened.error) throw new Error((all.error || unopened.error).message);
  return { ...summary, last_at: lastAt.toISOString(), last_count: all.count || 0, last_unopened: unopened.count || 0 };
}

/**
 * Tell the people who can read these special deliveries that they came, once, when they land (mail_delivered, which
 * opens the piece). Ordinary pieces wait for the morning notice instead. Each piece: { id, recipient_user_id,
 * recipient_home_id, senderName, mailType, mailIntent, amount, address, vendorName }; a household piece (no
 * recipient_user_id) goes to everyone the Home mail rule shows it to, except `excludeUserId` (its sender). Never
 * throws: a failed notice doesn't fail the write that stored the piece.
 */
async function announceSpecialDeliveries(pieces, { excludeUserId = null } = {}) {
  // eslint-disable-next-line global-require
  const notificationService = require('./notificationService');
  for (const piece of pieces || []) {
    if (!piece?.id) continue;
    try {
      let recipients = piece.recipient_user_id ? [piece.recipient_user_id] : [];
      if (!piece.recipient_user_id && piece.recipient_home_id) {
        const readers = await mailReaderIdsOrThrow(piece.recipient_home_id);
        const mail = { id: piece.id, recipient_user_id: null, recipient_home_id: piece.recipient_home_id };
        recipients = [];
        for (const reader of readers) if (await canAccessMail(mail, reader)) recipients.push(reader);
      }
      for (const recipientUserId of recipients.filter((id) => id && id !== excludeUserId)) {
        await notificationService.notifyMailDelivered({
          recipientUserId, senderName: piece.senderName || 'Someone', mailId: piece.id, mailIntent: piece.mailIntent,
          mailType: piece.mailType, address: piece.address, amount: piece.amount, vendorName: piece.vendorName, special: true,
        });
      }
    } catch (error) {
      logger.warn('Special delivery notice failed (non-blocking)', { mailId: piece.id, error: error.message });
    }
  }
}

module.exports = {
  MORNING_HOUR, FALLBACK_TIME_ZONE, nextRound, localDate, isSpecialDelivery, homeTimeZone, personTimeZone,
  mailboxTimeZone, deliveryFor, withDelivery, deliverySummary, announceSpecialDeliveries,
};
