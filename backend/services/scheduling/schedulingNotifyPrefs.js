// ============================================================
// Calendarly — host scheduling-notification preferences (backs the "Scheduling Notifications
// Preferences" screen). One row per host user in SchedulingNotificationPreference.prefs jsonb:
//   { notify_me: { new_booking, booking_request, cancellation, reschedule, no_show, reminder },
//     notify_attendees: {...}, reminder_lead_times: [...] }
// Gates only the HOST's own in-app/push scheduling notifications; invitee confirmations/reminders
// are transactional and unaffected.
// ============================================================

const supabaseAdmin = require('../../config/supabaseAdmin');

// Host "notify me" defaults — all on.
const DEFAULT_NOTIFY_ME = {
  new_booking: true,
  booking_request: true,
  cancellation: true,
  reschedule: true,
  no_show: true,
  reminder: true,
};

const DEFAULTS = {
  notify_me: { ...DEFAULT_NOTIFY_ME },
  notify_attendees: { confirmation: true, reminder: true, reschedule: true, cancellation: true },
  reminder_lead_times: [{ minutes: 1440, enabled: true }, { minutes: 60, enabled: true }],
};

async function getPrefs(userId) {
  if (!userId) return DEFAULTS;
  const { data } = await supabaseAdmin
    .from('SchedulingNotificationPreference')
    .select('prefs')
    .eq('user_id', userId)
    .maybeSingle();
  const p = (data && data.prefs) || {};
  return {
    notify_me: { ...DEFAULT_NOTIFY_ME, ...(p.notify_me || {}) },
    notify_attendees: { ...DEFAULTS.notify_attendees, ...(p.notify_attendees || {}) },
    reminder_lead_times: Array.isArray(p.reminder_lead_times) ? p.reminder_lead_times : DEFAULTS.reminder_lead_times,
  };
}

/** Map a booking lifecycle `kind` to a host notify_me key. */
function kindToHostKey(kind) {
  return {
    request: 'booking_request',
    confirmed: 'new_booking',
    cancelled: 'cancellation',
    declined: 'cancellation',
    rescheduled: 'reschedule',
    reminder_24h: 'reminder',
    reminder_1h: 'reminder',
  }[kind] || 'new_booking';
}

/** Does the host want an in-app/push notification for this lifecycle kind? (defaults true.) */
async function hostWants(userId, kind) {
  if (!userId) return false;
  const prefs = await getPrefs(userId);
  return prefs.notify_me[kindToHostKey(kind)] !== false;
}

/** Like hostWants but takes a resolved notify_me key directly (e.g. 'reminder'). */
async function hostWantsKey(userId, key) {
  if (!userId) return false;
  const prefs = await getPrefs(userId);
  return prefs.notify_me[key] !== false;
}

module.exports = { DEFAULTS, getPrefs, hostWants, hostWantsKey, kindToHostKey };
