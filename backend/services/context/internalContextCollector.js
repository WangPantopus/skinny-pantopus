/**
 * Internal Context Collector
 *
 * Gathers Pantopus-internal context for a user: bills due, tasks due,
 * calendar events, unread mail, active gigs, and unread notifications.
 * Used by the briefing composer and Hub Today card.
 */

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');

/**
 * @typedef {Object} InternalContext
 * @property {Array<{id: string, provider_name: string, amount: number, currency: string, due_date: string, status: string}>} bills_due
 * @property {Array<{id: string, title: string, due_at: string, priority: string, status: string}>} tasks_due
 * @property {Array<{id: string, title: string, start_at: string, end_at: string, event_type: string}>} calendar_events
 * @property {number} unread_mail_count
 * @property {number} urgent_mail_count
 * @property {Array<{id: string, title: string, status: string, scheduled_date: string}>} active_gigs
 * @property {number} unread_notifications
 * @property {string} collected_at
 */

/**
 * Resolve the home IDs to query against.
 * If homeId is provided, use it. Otherwise, find all active homes for the user.
 */
async function resolveHomeIds(userId, homeId) {
  if (homeId) return [homeId];

  const { data, error } = await supabaseAdmin
    .from('HomeOccupancy')
    .select('home_id')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) {
    logger.warn('internalContextCollector: HomeOccupancy query failed', { userId, error: error.message });
    return [];
  }

  return (data || []).map((o) => o.home_id);
}

/**
 * Collect all internal Pantopus context for a user.
 *
 * @param {string} userId
 * @param {string|null} [homeId=null] - Specific home to scope to, or null for all active homes
 * @returns {Promise<InternalContext>}
 */
async function collectInternalContext(userId, homeId = null) {
  const now = new Date();
  const threeDaysOut = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const twoDaysOut = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  // Start of today and end of tomorrow in ISO
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfTomorrow = new Date(startOfToday);
  endOfTomorrow.setDate(endOfTomorrow.getDate() + 2);

  const homeIds = await resolveHomeIds(userId, homeId);
  const hasHomes = homeIds.length > 0;

  // ── Build all queries, run with Promise.allSettled ──
  const queries = {
    bills: hasHomes
      ? supabaseAdmin
          .from('HomeBill')
          .select('id, provider_name, amount, currency, due_date, status')
          .in('home_id', homeIds)
          .neq('status', 'paid')
          .gte('due_date', now.toISOString())
          .lte('due_date', threeDaysOut.toISOString())
          .order('due_date', { ascending: true })
          .limit(10)
      : Promise.resolve({ data: [] }),

    tasks: hasHomes
      ? supabaseAdmin
          .from('HomeTask')
          .select('id, title, due_at, priority, status')
          .in('home_id', homeIds)
          .not('status', 'in', '("completed","cancelled")')
          .gte('due_at', now.toISOString())
          .lte('due_at', twoDaysOut.toISOString())
          .order('due_at', { ascending: true })
          .limit(10)
      : Promise.resolve({ data: [] }),

    calendarEvents: hasHomes
      ? supabaseAdmin
          .from('HomeCalendarEvent')
          .select('id, title, start_at, end_at, event_type')
          .in('home_id', homeIds)
          .gte('start_at', startOfToday.toISOString())
          .lt('start_at', endOfTomorrow.toISOString())
          .order('start_at', { ascending: true })
          .limit(10)
      : Promise.resolve({ data: [] }),

    unreadMail: supabaseAdmin
      .from('Mail')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_user_id', userId)
      .in('lifecycle', ['delivered', 'opened'])
      .eq('archived', false),

    urgentMail: supabaseAdmin
      .from('Mail')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_user_id', userId)
      .in('lifecycle', ['delivered', 'opened'])
      .eq('archived', false)
      .neq('urgency', 'none'),

    activeGigs: supabaseAdmin
      .from('Gig')
      .select('id, title, status, scheduled_start')
      .or(`user_id.eq.${userId},accepted_by.eq.${userId}`)
      .in('status', ['open', 'assigned', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(5),

    unreadNotifications: supabaseAdmin
      .from('Notification')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false),
  };

  const keys = Object.keys(queries);
  const results = await Promise.allSettled(Object.values(queries));

  // Map results back to keys
  const resolved = {};
  keys.forEach((key, i) => {
    const result = results[i];
    if (result.status === 'fulfilled') {
      resolved[key] = result.value;
    } else {
      logger.warn('internalContextCollector: query failed', { key, userId, error: result.reason?.message });
      resolved[key] = { data: null, count: 0 };
    }
  });

  // Log any DB-level errors from fulfilled-but-errored queries
  for (const key of keys) {
    const r = resolved[key];
    if (r.error) {
      logger.warn('internalContextCollector: DB error', { key, userId, error: r.error.message });
    }
  }

  return {
    bills_due: (resolved.bills.data || []).map((b) => ({
      id: b.id,
      provider_name: b.provider_name || 'Bill',
      amount: b.amount != null ? Number(b.amount) : 0,
      currency: b.currency || 'USD',
      due_date: b.due_date,
      status: b.status,
    })),
    tasks_due: (resolved.tasks.data || []).map((t) => ({
      id: t.id,
      title: t.title,
      due_at: t.due_at,
      priority: t.priority || 'medium',
      status: t.status,
    })),
    calendar_events: (resolved.calendarEvents.data || []).map((e) => ({
      id: e.id,
      title: e.title,
      start_at: e.start_at,
      end_at: e.end_at || null,
      event_type: e.event_type || 'general',
    })),
    unread_mail_count: resolved.unreadMail.count || 0,
    urgent_mail_count: resolved.urgentMail.count || 0,
    active_gigs: (resolved.activeGigs.data || []).map((g) => ({
      id: g.id,
      title: g.title,
      status: g.status,
      scheduled_date: g.scheduled_start || null,
    })),
    unread_notifications: resolved.unreadNotifications.count || 0,
    collected_at: now.toISOString(),
  };
}

module.exports = { collectInternalContext };
