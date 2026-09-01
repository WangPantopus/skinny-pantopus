// ============================================================
// JOB: Calendarly booking reminders — runs every 15 minutes (registered in jobs/index.js).
// Sends reminders for confirmed bookings at each lead offset configured on the booking's page
// (BookingPage.reminder_minutes, default [1440, 60] = 1 day + 1 hour). Recipients: host (subject
// to their notify prefs) + invitee (app or email). Deduped via BookingReminderLog UNIQUE(booking_id, kind).
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const notify = require('../services/scheduling/bookingNotifyService');
const notifyPrefs = require('../services/scheduling/schedulingNotifyPrefs');

const MIN = 60 * 1000;
const DEFAULT_REMINDER_MINUTES = [1440, 60];
const SCAN_AHEAD_MIN = 7 * 24 * 60 + 15; // scan confirmed bookings starting within the next 7 days
const MAX_OFFSET_MIN = 7 * 24 * 60; // honor configured offsets up to 7 days
// How far PAST an offset a late cron run may still deliver. The old band was exactly one cron
// cadence wide (15 min), so any missed/late run (deploy, downtime) skipped that offset forever.
const CATCHUP_MIN = 120;

async function alreadySent(bookingId, kind) {
  const { data } = await supabaseAdmin
    .from('BookingReminderLog')
    .select('id')
    .eq('booking_id', bookingId)
    .eq('kind', kind)
    .maybeSingle();
  return !!data;
}

async function logSent(bookingId, kind) {
  // Insert-first dedupe: the UNIQUE(booking_id, kind) index makes a concurrent duplicate fail.
  const { error } = await supabaseAdmin.from('BookingReminderLog').insert({ booking_id: bookingId, kind });
  return !error;
}

/**
 * Terminal sweep: confirmed bookings whose end time passed become 'completed'.
 *
 * Without this transition nothing in the system ever writes 'completed', which silently
 * breaks the insights math — getNoShowReport's denominator is completed + no_show, so the
 * no-show rate reads 100% forever. Hosts can still flip completed → no_show afterwards
 * (markNoShow allows it) when someone truly didn't turn up.
 */
async function completePastBookings(nowMs) {
  const { data, error } = await supabaseAdmin
    .from('Booking')
    .update({ status: 'completed', updated_at: new Date(nowMs).toISOString() })
    .eq('status', 'confirmed')
    .lt('end_at', new Date(nowMs).toISOString())
    .select('id');
  if (error) {
    logger.error('[bookingReminders] complete sweep failed', { error: error.message });
    return;
  }
  if (data && data.length) logger.info('[bookingReminders] bookings completed', { count: data.length });
}

async function runBookingReminders() {
  const now = Date.now();
  await completePastBookings(now);
  const fromIso = new Date(now + MIN).toISOString();
  const toIso = new Date(now + SCAN_AHEAD_MIN * MIN).toISOString();

  const { data: bookings, error } = await supabaseAdmin
    .from('Booking')
    .select('*')
    .eq('status', 'confirmed')
    .gte('start_at', fromIso)
    .lte('start_at', toIso);

  if (error) {
    logger.error('[bookingReminders] query failed', { error: error.message });
    return;
  }
  if (!bookings || !bookings.length) return;

  const etCache = new Map();
  const pageCache = new Map();
  const prefsCache = new Map();
  let sent = 0;

  for (const booking of bookings) {
    if (booking.page_id && !pageCache.has(booking.page_id)) {
      const { data: page } = await supabaseAdmin.from('BookingPage').select('*').eq('id', booking.page_id).maybeSingle();
      pageCache.set(booking.page_id, page || null);
    }
    const page = booking.page_id ? pageCache.get(booking.page_id) : null;

    // Offsets: an explicit page-level config wins; otherwise the host's "reminder lead times"
    // preference (Scheduling Notification Preferences screen — previously stored but never
    // read, so the setting was inert). getPrefs falls back to the [1d, 1h] defaults.
    const prefUserId = booking.host_user_id || booking.owner_user_id;
    if (prefUserId && !prefsCache.has(prefUserId)) {
      prefsCache.set(prefUserId, await notifyPrefs.getPrefs(prefUserId));
    }
    const prefs = prefUserId ? prefsCache.get(prefUserId) : null;
    const prefOffsets = prefs
      ? prefs.reminder_lead_times
        .filter((lt) => lt && lt.enabled !== false && Number.isFinite(Number(lt.minutes)))
        .map((lt) => Number(lt.minutes))
      : DEFAULT_REMINDER_MINUTES;
    const offsets = (page && Array.isArray(page.reminder_minutes) && page.reminder_minutes.length
      ? page.reminder_minutes
      : prefOffsets
    ).filter((m) => m > 0 && m <= MAX_OFFSET_MIN);

    const minutesUntil = (Date.parse(booking.start_at) - now) / MIN;
    for (const offset of offsets) {
      // Due once the offset instant is at most one cron cadence ahead; a CATCHUP band behind
      // covers late/missed runs so the reminder arrives late instead of never. Runs overlap
      // by design — the UNIQUE(booking_id, kind) log dedupes.
      if (minutesUntil > offset + 8) continue; // not due yet
      if (minutesUntil < offset - CATCHUP_MIN) continue; // stale beyond usefulness
      const kind = `reminder_${offset}m`;
      if (await alreadySent(booking.id, kind)) continue;
      if (!(await logSent(booking.id, kind))) continue;

      try {
        if (booking.event_type_id && !etCache.has(booking.event_type_id)) {
          const { data: et } = await supabaseAdmin.from('EventType').select('*').eq('id', booking.event_type_id).maybeSingle();
          etCache.set(booking.event_type_id, et || null);
        }
        await notify.sendBookingReminder({
          booking,
          eventType: booking.event_type_id ? etCache.get(booking.event_type_id) : null,
          page,
          kind,
          offsetMinutes: offset,
        });
        sent += 1;
      } catch (err) {
        logger.error('[bookingReminders] send failed', { bookingId: booking.id, kind, error: err.message });
        // The log row was claimed BEFORE the send (insert-first dedupe). Release it so the
        // next run retries a failed send — otherwise the reminder is lost forever. Erring on
        // the delete side risks a duplicate reminder at worst, never a silent drop.
        const { error: delErr } = await supabaseAdmin
          .from('BookingReminderLog')
          .delete()
          .eq('booking_id', booking.id)
          .eq('kind', kind);
        if (delErr) {
          logger.warn('[bookingReminders] failed to release reminder log for retry', { bookingId: booking.id, kind, error: delErr.message });
        }
      }
    }
  }

  if (sent > 0) logger.info('[bookingReminders] reminders sent', { count: sent });
}

module.exports = { runBookingReminders };
