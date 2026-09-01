// ============================================================
// Calendarly — booking notification fan-out.
// Channel is invitee-type-aware (the core fix from the review): app users get in-app + push;
// non-user invitees (invitee_user_id NULL — the common public-link case) get transactional email
// with an .ics attachment, since user-keyed channels cannot reach them.
// ============================================================

const { DateTime } = require('luxon');
const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const notificationService = require('../notificationService');
const emailService = require('../emailService');
const { buildIcs } = require('./icsService');
const { isEmailSuppressed } = require('./schedulingShared');
const notifyPrefs = require('./schedulingNotifyPrefs');

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Human-readable "Mon, Jul 6, 2026 · 9:00 AM – 9:30 AM EDT" in a given tz. */
function formatWhen(startIso, endIso, tz) {
  const zone = tz || 'UTC';
  const s = DateTime.fromISO(startIso, { zone });
  const e = DateTime.fromISO(endIso, { zone });
  if (!s.isValid) return startIso;
  return `${s.toFormat('cccc, LLL d, yyyy')} · ${s.toFormat('h:mm a')} – ${e.toFormat('h:mm a')} (${s.toFormat('ZZZZ')})`;
}

async function getUserContact(userId) {
  if (!userId) return null;
  const { data } = await supabaseAdmin.from('User').select('id, email, name').eq('id', userId).maybeSingle();
  return data || null;
}

function notifyAppUser(userId, { type, title, body, link, metadata }) {
  if (!userId) return Promise.resolve(null);
  return notificationService.createNotification({
    userId,
    type,
    title,
    body,
    icon: '📅',
    link: link || null,
    metadata: metadata || {},
    context: 'personal',
  });
}

function bookingEmailHtml({ heading, intro, whenLabel, locationLabel, manageUrl, footerNote }) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:#0284C7;padding:28px 32px 22px;text-align:center;">
      <div style="font-size:30px;margin-bottom:6px;">📅</div>
      <h1 style="color:#fff;font-size:19px;font-weight:600;margin:0;">${escapeHtml(heading)}</h1>
    </div>
    <div style="padding:30px 32px;">
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 18px;">${intro}</p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:0 0 18px;">
        <div style="font-size:15px;font-weight:600;color:#111827;">⏰ ${escapeHtml(whenLabel)}</div>
        ${locationLabel ? `<div style="font-size:13px;color:#6b7280;margin-top:6px;">📍 ${escapeHtml(locationLabel)}</div>` : ''}
      </div>
      ${manageUrl ? `<div style="text-align:center;margin:24px 0;">
        <a href="${manageUrl}" style="display:inline-block;background:#111827;color:#fff;font-size:15px;font-weight:600;padding:13px 30px;border-radius:10px;text-decoration:none;">Manage booking</a>
      </div>` : ''}
    </div>
    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center;">
      <p style="color:#9ca3af;font-size:11px;margin:0;">Pantopus — Your neighborhood, organized.</p>
      ${footerNote ? `<p style="color:#d1d5db;font-size:10px;margin:8px 0 0;">${escapeHtml(footerNote)}</p>` : ''}
    </div>
  </div>
</body></html>`;
}

/**
 * Build an .ics attachment for a booking.
 */
async function buildBookingIcs({ booking, eventType, method, organizer }) {
  const ics = buildIcs({
    uid: booking.id,
    start: booking.start_at,
    end: booking.end_at,
    summary: eventType ? eventType.name : 'Appointment',
    description: eventType ? eventType.description || '' : '',
    location: booking.location_detail || '',
    organizerEmail: organizer ? organizer.email : undefined,
    organizerName: organizer ? organizer.name : undefined,
    attendeeEmail: booking.invitee_email || undefined,
    method,
    // SEQUENCE bumps on each change so calendar clients accept the update.
    sequence: booking.ics_sequence || 0, // monotonic iTIP revision (migration 167)
  });
  return {
    filename: 'invite.ics',
    content: ics,
    contentType: `text/calendar; method=${method}; charset=utf-8`,
  };
}

/**
 * Fire notifications for a booking lifecycle transition.
 * @param {Object} args
 * @param {Object} args.booking    the (post-transition) booking row
 * @param {Object} args.eventType
 * @param {Object} [args.page]
 * @param {'request'|'confirmed'|'cancelled'|'declined'|'rescheduled'} args.kind
 * @param {string} [args.manageToken]  raw token for the invitee manage link
 */
async function notifyBookingEvent({ booking, eventType, page, kind, manageToken }) {
  try {
    const inviteeTz = booking.invitee_timezone || (page && page.timezone) || 'UTC';
    const whenInvitee = formatWhen(booking.start_at, booking.end_at, inviteeTz);
    const eventName = (eventType && eventType.name) || 'Appointment';
    const manageUrl = manageToken ? `${APP_URL}/booking/${manageToken}` : null;
    const locationLabel = booking.location_detail || null;

    // Copy keyed by transition.
    const copy = {
      request: {
        hostTitle: `New booking request: ${eventName}`,
        hostBody: `${booking.invitee_name || 'Someone'} requested ${eventName} — ${whenInvitee}.`,
        invSubject: `Request received: ${eventName}`,
        invHeading: 'Request received',
        invIntro: `Thanks${booking.invitee_name ? `, ${escapeHtml(booking.invitee_name)}` : ''}! Your request for <strong>${escapeHtml(eventName)}</strong> is pending the host's approval. We'll email you when it's confirmed.`,
        invType: 'booking_request',
        attachIcs: false,
      },
      confirmed: {
        hostTitle: `Booking confirmed: ${eventName}`,
        hostBody: `${booking.invitee_name || 'A guest'} — ${whenInvitee}.`,
        invSubject: `Confirmed: ${eventName}`,
        invHeading: "You're booked!",
        invIntro: `Your booking for <strong>${escapeHtml(eventName)}</strong> is confirmed. The invite is attached — add it to your calendar.`,
        invType: 'booking_confirmed',
        attachIcs: true,
        icsMethod: 'REQUEST',
      },
      rescheduled: {
        hostTitle: `Booking rescheduled: ${eventName}`,
        hostBody: `${booking.invitee_name || 'A guest'} — now ${whenInvitee}.`,
        invSubject: `Rescheduled: ${eventName}`,
        invHeading: 'Your booking moved',
        invIntro: `Your booking for <strong>${escapeHtml(eventName)}</strong> has been rescheduled. The updated invite is attached.`,
        invType: 'booking_rescheduled',
        attachIcs: true,
        icsMethod: 'REQUEST',
      },
      cancelled: {
        hostTitle: `Booking cancelled: ${eventName}`,
        hostBody: `${booking.invitee_name || 'A guest'} — was ${whenInvitee}.`,
        invSubject: `Cancelled: ${eventName}`,
        invHeading: 'Booking cancelled',
        invIntro: `Your booking for <strong>${escapeHtml(eventName)}</strong> (${escapeHtml(whenInvitee)}) has been cancelled.`,
        invType: 'booking_cancelled',
        attachIcs: true,
        icsMethod: 'CANCEL',
      },
      declined: {
        hostTitle: `Booking declined: ${eventName}`,
        hostBody: `You declined a request for ${eventName}.`,
        invSubject: `Not confirmed: ${eventName}`,
        invHeading: 'Request not confirmed',
        invIntro: `Unfortunately your request for <strong>${escapeHtml(eventName)}</strong> couldn't be confirmed. Feel free to pick another time.`,
        invType: 'booking_declined',
        attachIcs: false,
      },
      reschedule_proposed: {
        hostTitle: `Reschedule proposed: ${eventName}`,
        hostBody: 'Waiting on the guest to accept the new time.',
        invSubject: `A new time was proposed: ${eventName}`,
        invHeading: 'A new time was proposed',
        invIntro: `The host proposed a new time for <strong>${escapeHtml(eventName)}</strong>. Open your booking to accept or pick another time.`,
        invType: 'booking_rescheduled',
        attachIcs: false,
      },
    }[kind];

    if (!copy) return;

    const link = `/app/profile/schedule/bookings/${booking.id}`;

    // --- Host (always an app user, when assigned) — respect the host's notification prefs ---
    if (booking.host_user_id && (await notifyPrefs.hostWants(booking.host_user_id, kind))) {
      await notifyAppUser(booking.host_user_id, {
        type: copy.invType === 'booking_request' ? 'booking_request' : copy.invType,
        title: copy.hostTitle,
        body: copy.hostBody,
        link,
        metadata: { booking_id: booking.id, event_type_id: booking.event_type_id, kind },
      });
    }
    // Owner (personal pages where owner != host) — notify if distinct, respecting their prefs.
    if (booking.owner_user_id && booking.owner_user_id !== booking.host_user_id && (await notifyPrefs.hostWants(booking.owner_user_id, kind))) {
      await notifyAppUser(booking.owner_user_id, {
        type: copy.invType === 'booking_request' ? 'booking_request' : copy.invType,
        title: copy.hostTitle,
        body: copy.hostBody,
        link,
        metadata: { booking_id: booking.id, event_type_id: booking.event_type_id, kind },
      });
    }

    // --- Invitee ---
    if (booking.invitee_user_id) {
      await notifyAppUser(booking.invitee_user_id, {
        type: copy.invType,
        title: copy.invSubject,
        body: whenInvitee,
        link,
        metadata: { booking_id: booking.id, kind },
      });
    } else if (booking.invitee_email) {
      // Non-user invitee -> transactional email (always sent for these lifecycle events).
      let attachments;
      if (copy.attachIcs) {
        const organizer = await getUserContact(booking.host_user_id || booking.owner_user_id);
        attachments = [await buildBookingIcs({ booking, eventType, method: copy.icsMethod, organizer })];
      }
      const html = bookingEmailHtml({
        heading: copy.invHeading,
        intro: copy.invIntro,
        whenLabel: whenInvitee,
        locationLabel,
        manageUrl,
        footerNote: "If you didn't make this booking, you can ignore this email.",
      });
      await emailService.sendEmail({
        to: booking.invitee_email,
        subject: copy.invSubject,
        html,
        attachments,
      });
    }

    // --- Required attendees (collective/group members) — notify those not already notified ---
    const alreadyNotified = new Set([booking.host_user_id, booking.owner_user_id, booking.invitee_user_id].filter(Boolean));
    const { data: attendees } = await supabaseAdmin
      .from('BookingAttendee')
      .select('user_id')
      .eq('booking_id', booking.id)
      .not('user_id', 'is', null);
    for (const att of attendees || []) {
      if (alreadyNotified.has(att.user_id)) continue;
      alreadyNotified.add(att.user_id);
      await notifyAppUser(att.user_id, {
        type: copy.invType,
        title: copy.invSubject,
        body: whenInvitee,
        link,
        metadata: { booking_id: booking.id, kind, role: 'attendee' },
      });
    }
  } catch (err) {
    // Notifications are best-effort; never fail the booking transition because of them.
    logger.error('[bookingNotifyService] notifyBookingEvent failed', { error: err.message, kind, bookingId: booking && booking.id });
  }
}

/**
 * Reminder fan-out (called by the bookingReminders cron). Sends to host (app) and invitee
 * (app or email), respecting the email suppression list for non-user invitees.
 */
/** Human lead label for a reminder offset in minutes. */
function formatLead(min) {
  if (min >= 1440) {
    const d = Math.round(min / 1440);
    return d === 1 ? 'tomorrow' : `in ${d} days`;
  }
  if (min >= 60) {
    const h = Math.round(min / 60);
    return h === 1 ? 'in about an hour' : `in ${h} hours`;
  }
  return `in ${min} minutes`;
}

async function sendBookingReminder({ booking, eventType, page, kind, offsetMinutes }) {
  const eventName = (eventType && eventType.name) || 'Appointment';
  const inviteeTz = booking.invitee_timezone || (page && page.timezone) || 'UTC';
  const whenInvitee = formatWhen(booking.start_at, booking.end_at, inviteeTz);
  const label = Number.isFinite(offsetMinutes) ? formatLead(offsetMinutes) : (kind === 'reminder_1h' ? 'in about an hour' : 'tomorrow');
  const link = `/app/profile/schedule/bookings/${booking.id}`;

  // Host reminder respects the host's 'reminder' notify-me toggle.
  if (booking.host_user_id && (await notifyPrefs.hostWantsKey(booking.host_user_id, 'reminder'))) {
    await notifyAppUser(booking.host_user_id, {
      type: 'booking_reminder',
      title: `Reminder: ${eventName} ${label}`,
      body: whenInvitee,
      link,
      metadata: { booking_id: booking.id, kind },
    });
  }

  if (booking.invitee_user_id) {
    await notifyAppUser(booking.invitee_user_id, {
      type: 'booking_reminder',
      title: `Reminder: ${eventName} ${label}`,
      body: whenInvitee,
      link,
      metadata: { booking_id: booking.id, kind },
    });
  } else if (booking.invitee_email) {
    if (await isEmailSuppressed(booking.invitee_email, booking.owner_type, booking.owner_id)) return;
    const organizer = await getUserContact(booking.host_user_id || booking.owner_user_id);
    const attachments = [await buildBookingIcs({ booking, eventType, method: 'REQUEST', organizer })];
    const html = bookingEmailHtml({
      heading: `Reminder: ${eventName}`,
      intro: `This is a reminder for your upcoming <strong>${escapeHtml(eventName)}</strong>, ${label}.`,
      whenLabel: whenInvitee,
      locationLabel: booking.location_detail || null,
      manageUrl: null,
      footerNote: 'You are receiving this because you have an upcoming booking.',
    });
    await emailService.sendEmail({ to: booking.invitee_email, subject: `Reminder: ${eventName} ${label}`, html, attachments });
  }
}

module.exports = { notifyBookingEvent, sendBookingReminder, formatWhen, _internal: { bookingEmailHtml, buildBookingIcs } };
