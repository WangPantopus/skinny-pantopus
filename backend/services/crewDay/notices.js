'use strict';

/**
 * Crew Day notices (docs/product/crew-day-build/02-contract.md §6): who gets each one, its copy and its link. Every
 * notice is a personal notification with metadata { crew_day_id, booking_id }; the launch-cut type map drops them while
 * `crew_day` is unlisted. Links are web paths; the apps map them to native screens by type.
 */

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const notificationService = require('../notificationService');
const { getBusinessPrimaryOwnerId, getActiveMembership } = require('../../utils/businessPermissions');

const links = {
  booking: (bookingId) => `/app/crew-days/bookings/${bookingId}`,
  mine: () => '/app/crew-days',
  crewList: (businessId) => `/app/businesses/${businessId}/dashboard?tab=crew-days`,
  crewDay: (businessId, crewDayId) => `/app/businesses/${businessId}/crew-days/${crewDayId}`,
  admin: (crewDayId) => (crewDayId ? `/app/admin/crew-days/${crewDayId}` : '/app/admin/crew-days'),
};

// Crew notices go to the business's primary owner and to the member who set the day up, while they still have access.
async function crewRecipients(day) {
  const ids = new Set();
  try {
    const owner = await getBusinessPrimaryOwnerId(day.business_user_id);
    if (owner) ids.add(String(owner));
  } catch (err) {
    logger.warn('crewDay.notices.owner_unavailable', { crewDayId: day.id, error: err.message });
  }
  if (day.created_by && !ids.has(String(day.created_by))) {
    const membership = await getActiveMembership(day.business_user_id, day.created_by);
    if (membership) ids.add(String(day.created_by));
  }
  return [...ids];
}

async function adminRecipients() {
  const { data, error } = await supabaseAdmin.from('User').select('id').eq('role', 'admin');
  if (error) {
    logger.warn('crewDay.notices.admins_unavailable', { error: error.message });
    return [];
  }
  return (data || []).map((u) => String(u.id));
}

async function send(userIds, notice, { day, booking = null, link, push = true, idempotencyKey = null }) {
  const metadata = { crew_day_id: day.id, ...(booking ? { booking_id: booking.id } : {}) };
  await Promise.all(userIds.map((userId) => notificationService.createNotification({
    userId,
    type: notice.type,
    title: notice.title,
    body: notice.body || null,
    icon: '🧰',
    link,
    metadata,
    context: 'personal',
    sendPush: push,
    ...(idempotencyKey ? { idempotencyKey: `${idempotencyKey}:${userId}` } : {}),
  }).catch((err) => {
    logger.warn('crewDay.notices.send_failed', { type: notice.type, crewDayId: day.id, error: err.message });
  })));
}

// ── Crew ───────────────────────────────────────────────────────

async function dayApproved(day, { bookedCount = 0 } = {}) {
  const recipients = await crewRecipients(day);
  await send(recipients, {
    type: 'crew_day_approved',
    title: 'Your Crew Day is open',
    body: `Share the link: ${bookedCount} of ${day.capacity} booked.`,
  }, { day, link: links.crewDay(day.business_user_id, day.id) });
}

async function dayDeclined(day) {
  const recipients = await crewRecipients(day);
  await send(recipients, {
    type: 'crew_day_declined',
    title: `Pantopus didn't approve ${day.title}`,
    body: day.review_note || null,
  }, { day, link: links.crewDay(day.business_user_id, day.id) });
}

// ── Operator ───────────────────────────────────────────────────

async function reviewNeeded(day, { businessName }) {
  const recipients = await adminRecipients();
  await send(recipients, {
    type: 'crew_day_review_needed',
    title: 'A Crew Day is waiting for approval',
    body: `${businessName || 'A crew'}: ${day.title}.`,
  }, { day, link: links.admin(day.id), push: false });
}

module.exports = {
  links,
  crewRecipients,
  adminRecipients,
  send,
  dayApproved,
  dayDeclined,
  reviewNeeded,
};
