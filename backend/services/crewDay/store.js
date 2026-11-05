'use strict';

/**
 * Crew Day reads and writes that every part shares: days, their bookings, the event timeline, and the facts about a
 * crew's business (published, payouts, documents, rating, fee).
 */

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const { CrewDayError } = require('./rules');

function unavailable(where, error) {
  logger.error(`crewDay.${where}.read_failed`, { error: error?.message });
  return new CrewDayError(503, 'UNAVAILABLE', 'Crew Days are taking a moment to load. Please try again.');
}

async function getDay(id, { kind = null } = {}) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ''))) return null;
  let query = supabaseAdmin.from('CrewDay').select('*').eq('id', id);
  if (kind) query = query.eq('kind', kind);
  const { data, error } = await query.maybeSingle();
  if (error) throw unavailable('day', error);
  return data || null;
}

async function getDayByCode(code) {
  const { data, error } = await supabaseAdmin.from('CrewDay').select('*').eq('share_code', code).eq('kind', 'offer')
    .maybeSingle();
  if (error) throw unavailable('day_by_code', error);
  return data || null;
}

const BOOKING_STATS_COLUMNS = 'id, crew_day_id, household_user_id, status, price_cents, refunded_cents, service_date, '
  + 'problem_status, release_asked_at';

/** Bookings of the given days, grouped by day id. */
async function bookingsByDay(dayIds, columns = BOOKING_STATS_COLUMNS) {
  const map = new Map(dayIds.map((id) => [String(id), []]));
  if (dayIds.length === 0) return map;
  const { data, error } = await supabaseAdmin.from('CrewDayBooking').select(columns).in('crew_day_id', dayIds);
  if (error) throw unavailable('bookings', error);
  for (const row of data || []) map.get(String(row.crew_day_id))?.push(row);
  return map;
}

async function addEvent({ day, booking = null, actorUserId = null, actorRole, kind, data = {}, visibleTo }) {
  const { error } = await supabaseAdmin.from('CrewDayEvent').insert({
    crew_day_id: day.id,
    booking_id: booking ? booking.id : null,
    actor_user_id: actorUserId,
    actor_role: actorRole,
    kind,
    data,
    visible_to: visibleTo,
  });
  // The timeline is a record of what happened; a failed write is logged, never a reason to undo the action.
  if (error) logger.error('crewDay.event.write_failed', { crewDayId: day.id, kind, error: error.message });
}

/** Events of a day for one audience: 'crew', 'household' (of one booking), or 'operator' (everything). */
async function eventsFor(dayId, audience, { bookingId = null, limit = 200 } = {}) {
  let query = supabaseAdmin.from('CrewDayEvent').select('id, booking_id, actor_role, kind, data, visible_to, created_at')
    .eq('crew_day_id', dayId).order('created_at', { ascending: true }).limit(limit);
  if (audience === 'crew') query = query.in('visible_to', ['crew', 'both']);
  if (audience === 'household') query = query.in('visible_to', ['household', 'both']).eq('booking_id', bookingId);
  const { data, error } = await query;
  if (error) throw unavailable('events', error);
  return data || [];
}

/**
 * What a household, the crew and the operator see about a crew's business: name and page, the "Insured and
 * registered" mark (documents verified by Pantopus), reviews, and the operator's facts (published, payouts on).
 */
async function crewFacts(businessUserIds) {
  const ids = [...new Set(businessUserIds.filter(Boolean).map(String))];
  const facts = new Map();
  if (ids.length === 0) return facts;
  const [users, profiles, accounts] = await Promise.all([
    supabaseAdmin.from('User').select('id, name, username, profile_picture_url, average_rating, review_count').in('id', ids),
    supabaseAdmin.from('BusinessProfile')
      .select('business_user_id, is_published, verification_status, founding_badge, founding_benefit_expires_at')
      .in('business_user_id', ids),
    supabaseAdmin.from('StripeAccount').select('user_id, payouts_enabled, charges_enabled').in('user_id', ids),
  ]);
  for (const result of [users, profiles, accounts]) if (result.error) throw unavailable('crew_facts', result.error);
  const profileOf = new Map((profiles.data || []).map((p) => [String(p.business_user_id), p]));
  const accountOf = new Map((accounts.data || []).map((a) => [String(a.user_id), a]));
  for (const u of users.data || []) {
    const profile = profileOf.get(String(u.id)) || {};
    const account = accountOf.get(String(u.id)) || {};
    const count = Number(u.review_count) || 0;
    facts.set(String(u.id), {
      business_user_id: u.id,
      name: u.name,
      username: u.username,
      avatar_url: u.profile_picture_url || null,
      verified: ['document_verified', 'government_verified'].includes(profile.verification_status),
      rating: count > 0 && u.average_rating != null
        ? { average: Math.round(Number(u.average_rating) * 10) / 10, count } : null,
      published: Boolean(profile.is_published),
      payouts_enabled: Boolean(account.payouts_enabled),
      founding: Boolean(profile.founding_badge)
        && (!profile.founding_benefit_expires_at || new Date(profile.founding_benefit_expires_at) > new Date()),
    });
  }
  return facts;
}

/** Public crew row: no operator facts. */
function publicCrew(facts) {
  if (!facts) return null;
  const { business_user_id: businessUserId, name, username, avatar_url: avatarUrl, verified, rating } = facts;
  return { business_user_id: businessUserId, name, username, avatar_url: avatarUrl, verified, rating };
}

/**
 * Can this business run a Crew Day: a published page and payouts switched on. Documents are optional (they earn the
 * "Insured and registered" mark). A business whose payouts look off is asked Stripe once more, since the account can
 * finish onboarding before its webhook arrives.
 */
async function readiness(businessUserId) {
  let facts = (await crewFacts([businessUserId])).get(String(businessUserId));
  if (facts && !facts.payouts_enabled) {
    try {
      const { data: account } = await supabaseAdmin.from('StripeAccount').select('stripe_account_id')
        .eq('user_id', businessUserId).maybeSingle();
      if (account?.stripe_account_id) {
        const stripeService = require('../../stripe/stripeService');
        const synced = await stripeService.getConnectAccount(businessUserId);
        if (synced?.account?.payouts_enabled) facts = { ...facts, payouts_enabled: true };
      }
    } catch (err) {
      logger.warn('crewDay.readiness.stripe_sync_failed', { businessUserId, error: err.message });
    }
  }
  const missing = [];
  if (!facts?.published) missing.push('publish_page');
  if (!facts?.payouts_enabled) missing.push('set_up_payouts');
  return {
    published: Boolean(facts?.published),
    payouts_enabled: Boolean(facts?.payouts_enabled),
    documents_verified: Boolean(facts?.verified),
    missing,
    ready: missing.length === 0,
    facts,
  };
}

module.exports = {
  unavailable,
  getDay,
  getDayByCode,
  bookingsByDay,
  addEvent,
  eventsFor,
  crewFacts,
  publicCrew,
  readiness,
  BOOKING_STATS_COLUMNS,
};
