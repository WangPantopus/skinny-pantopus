/**
 * Notification Service
 *
 * Creates in-app notifications. Used by other routes/services
 * when events happen (invites, task assignments, bids, etc.).
 *
 * All methods are non-blocking — they log errors but don't throw,
 * so callers don't need try/catch.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const badgeService = require('./badgeService');
const pushService = require('./pushService');
const {
  CONTEXTS: NOTIFICATION_CONTEXT_LIST,
  registerTemplate,
} = require('./notificationTemplateRegistry');

// Set lookup for createNotification's `context` arg validation. The full
// allowed set comes from the registry so additions there flow here for free.
const NOTIFICATION_CONTEXTS = new Set(NOTIFICATION_CONTEXT_LIST);

// ============================================================
//  P0.6 — TEMPLATE REGISTRY
// ============================================================
// Every existing notification fires from one of the imperative notifyX
// helpers below. The registry pairs each one with a declared template that
// documents the placeholders the body MAY use, tagged with the firewall
// context. The imperative helpers still build their bodies with template
// literals (we are not refactoring user-visible behavior at P0.6); the
// registry exists so that:
//   1. A unit test can assert every template validates against its
//      context's field allowlist (catches cross-context placeholders
//      before deployment).
//   2. Phase 1 audience-side notifications can be added by registering
//      a new template + calling renderTemplate() — the firewall is
//      enforced by construction.
// Existing personal-side notifications remain context: 'personal'. Public
// Profile follower notifications are registered separately with audience
// context because the actor shown to the creator is a PersonaMembership fan
// identity, not the follower's private Local Profile identity.
const PERSONAL_TEMPLATES = [
  { name: 'home_invite', pushTitle: '{actor.displayName} invited you to join a home', pushBody: "You've been invited to {home.name} as a household member." },
  { name: 'home_invite_accepted', pushTitle: '{actor.displayName} joined your home', pushBody: '{actor.displayName} accepted your invitation to {home.name}.' },
  { name: 'task_assigned', pushTitle: '{actor.displayName} assigned you a task', pushBody: '{task.title}' },
  { name: 'task_completed', pushTitle: 'Task completed: {task.title}', pushBody: '{actor.displayName} marked this task as done.' },
  { name: 'bid_received', pushTitle: 'New bid on "{gig.title}"', pushBody: '{actor.displayName} placed a bid on your gig.' },
  { name: 'first_bid_received', pushTitle: 'Your first response! 🎉', pushBody: "{actor.displayName} wants to help with '{gig.title}'" },
  { name: 'bid_accepted', pushTitle: 'Your bid was accepted!', pushBody: 'Your bid on "{gig.title}" was accepted. You can start a chat to coordinate.' },
  { name: 'bid_rejected', pushTitle: 'Your bid was not selected', pushBody: 'Your bid on "{gig.title}" was declined.' },
  { name: 'bid_withdrawn', pushTitle: '{actor.displayName} withdrew their bid', pushBody: 'A bid on "{gig.title}" was withdrawn.' },
  { name: 'address_revealed', pushTitle: 'Address shared with you', pushBody: 'The seller shared their pickup address for "{listing.title}".' },
  { name: 'gig_started', pushTitle: 'Gig started: {gig.title}', pushBody: '{actor.displayName} has started your gig.' },
  { name: 'gig_completed', pushTitle: 'Gig completed: {gig.title}', pushBody: '{actor.displayName} marked the gig as completed.' },
  { name: 'gig_confirmed', pushTitle: 'Gig completion confirmed', pushBody: 'Your gig "{gig.title}" was confirmed complete.' },
  { name: 'payment_auth_failed', pushTitle: 'Payment failed for "{gig.title}"', pushBody: 'Please update your payment method to continue.' },
  { name: 'payment_captured', pushTitle: 'Payment captured', pushBody: '{amount} captured for "{gig.title}".' },
  { name: 'transfer_completed', pushTitle: 'Transfer completed', pushBody: '{amount} for "{gig.title}" has been transferred.' },
  { name: 'dispute_created', pushTitle: 'Dispute opened on "{gig.title}"', pushBody: 'A dispute was opened on your gig.' },
  { name: 'dispute_resolved', pushTitle: 'Dispute resolved on "{gig.title}"', pushBody: 'The dispute on your gig has been resolved.' },
  { name: 'gig_auto_cancelled', pushTitle: 'Gig auto-cancelled: "{gig.title}"', pushBody: '{reason}' },
  { name: 'setup_failed', pushTitle: 'Setup failed for "{gig.title}"', pushBody: 'We could not finish setting up your gig.' },
  { name: 'connection_request', pushTitle: 'New connection request', pushBody: '{actor.displayName} wants to connect with you.' },
  { name: 'connection_accepted', pushTitle: 'Connection accepted', pushBody: '{actor.displayName} accepted your connection request.' },
  { name: 'residency_claim', pushTitle: 'New residency claim', pushBody: '{actor.displayName} claims to live at {home.name}.' },
  { name: 'residency_approved', pushTitle: 'Residency approved at {home.name}', pushBody: 'Your residency claim was approved.' },
  { name: 'residency_rejected', pushTitle: 'Residency claim not approved', pushBody: '{reason}' },
  { name: 'ownership_verification_needed', pushTitle: 'Verify ownership of {home.name}', pushBody: 'Provide a proof document to continue.' },
  { name: 'ownership_claim_approved', pushTitle: 'Ownership approved at {home.name}', pushBody: 'Your ownership claim was approved.' },
  { name: 'ownership_claim_rejected', pushTitle: 'Ownership claim not approved', pushBody: '{reason}' },
  { name: 'ownership_claim_needs_more_info', pushTitle: 'More info needed', pushBody: 'We need additional details for {home.name}.' },
  { name: 'new_ownership_claim', pushTitle: 'New ownership claim', pushBody: '{actor.displayName} claims ownership of {home.name}.' },
  { name: 'ownership_dispute', pushTitle: 'Ownership dispute at {home.name}', pushBody: 'A counter-claim was filed.' },
  { name: 'mail_delivered', pushTitle: 'Mail delivered', pushBody: 'New mail at {mailbox.id}.' },
  { name: 'density_milestone', pushTitle: 'Neighborhood milestone reached', pushBody: '{message}' },
  { name: 'household_access_request', pushTitle: 'Household access request', pushBody: '{actor.displayName} requested access to your home.' },
  { name: 'household_access_request_rejected', pushTitle: 'Household request not approved', pushBody: 'Your request for {home.name} was not approved.' },
];

for (const tpl of PERSONAL_TEMPLATES) {
  registerTemplate({ ...tpl, context: 'personal', type: tpl.name });
}

const AUDIENCE_TEMPLATES = [
  { name: 'persona_follow', pushTitle: 'New follower', pushBody: '{fan.displayName} joined your Beacon.' },
  { name: 'persona_follow_request', pushTitle: 'Review a new audience request', pushBody: '{fan.displayName} wants to join your Beacon.' },
  { name: 'persona_follow_approved', pushTitle: 'Beacon request approved', pushBody: '{persona.displayName} approved your request.' },
  { name: 'persona_broadcast', pushTitle: 'Beacon update', pushBody: 'A Beacon shared an update.' },
  // P1.12 — DM lifecycle. Notifications consume the audience-side
  // identity allowlist only (fan.handle, persona.displayName, etc.);
  // never the personal-side display name or user_id of either party.
  {
    name: 'persona_dm_received_creator',
    pushTitle: 'New message from {fan.handle}',
    pushBody: '{message}',
    title: 'New message from {fan.handle}',
    body: '{message}',
    link: '/app/audience/inbox/{membership.id}',
  },
  {
    name: 'persona_dm_reply_fan',
    pushTitle: '{persona.displayName} replied',
    pushBody: '{message}',
    title: '{persona.displayName} replied',
    body: '{message}',
    link: '/app/audience/membership/{persona.id}/inbox',
  },
  {
    name: 'persona_member_joined',
    pushTitle: 'New {membership.tierName}: {fan.handle}',
    pushBody: 'Welcome them in your dashboard',
    title: '{fan.handle} joined as {membership.tierName}',
    link: '/app/audience/fans/{membership.id}',
  },
];

for (const tpl of AUDIENCE_TEMPLATES) {
  registerTemplate({ ...tpl, context: 'audience', type: tpl.name });
}

// P1.12 — platform-context billing notifications. Carry no identity
// of either side; only billing primitives (periodEnd, amount, etc.).
const PLATFORM_TEMPLATES = [
  {
    name: 'persona_subscription_canceled',
    pushTitle: 'Your subscription was canceled',
    pushBody: 'You can keep your access until {periodEnd}',
    title: 'Subscription canceled',
    body: 'Your access continues until {periodEnd}.',
  },
  {
    name: 'persona_payment_failed',
    pushTitle: 'Payment failed',
    pushBody: 'Update your payment method to keep your subscription',
  },
];

for (const tpl of PLATFORM_TEMPLATES) {
  registerTemplate({ ...tpl, context: 'platform', type: tpl.name });
}

// Socket.IO references — set by chatSocketio.js after connection
let _io = null;
let _connectedUsers = null;

/**
 * Initialize notification service with Socket.IO references
 * so we can push notification:new events to connected users.
 */
function init(io, connectedUsers) {
  _io = io;
  _connectedUsers = connectedUsers;
}

function getUserSocketIds(userId) {
  const entry = _connectedUsers?.get(userId);
  if (!entry) return [];
  if (entry instanceof Set) return Array.from(entry);
  return [entry];
}

/**
 * Check whether a user has push notifications enabled in their preferences.
 * Returns false if the preference row doesn't exist or push is disabled.
 */
async function isPushEnabled(userId) {
  try {
    const { data } = await supabaseAdmin
      .from('MailPreferences')
      .select('push_notifications')
      .eq('user_id', userId)
      .single();
    return data?.push_notifications === true;
  } catch {
    return false;
  }
}

// Notification types that map to each preference toggle.
// Types NOT in any set fall through to always-allowed (social, system, etc.)
const GIG_TYPES = new Set([
  // Bidding
  'bid_received', 'bid_accepted', 'bid_rejected', 'bid_withdrawn',
  'bid_on_standby', 'bid_reopened',
  'bid_countered', 'counter_accepted', 'counter_declined', 'counter_withdrawn',
  'gig_offer',
  // Gig lifecycle
  'gig_started', 'gig_completed', 'gig_confirmed',
  'gig_cancelled', 'gig_auto_cancelled', 'gig_reminder',
  'gig_question', 'gig_question_answered',
  'no_show_reported', 'urgent_status_update',
  // P6 — saved-search alerts ("new task matches your saved search").
  'gig_saved_search_match',
  // P6 — poster moved an assigned gig's start time.
  'gig_rescheduled',
  // Change orders
  'change_order', 'change_order_approved', 'change_order_rejected',
  // Payments
  'payment_auth_failed', 'payment_captured', 'payment_released',
  'payment_action_required', 'payment_setup_failed',
  'payout_sent', 'payout_onboarding_nudge',
  // Disputes
  'dispute_created', 'dispute_resolved',
  // Worker coordination
  'worker_cant_make_it',
  // Retention nudges
  'no_bid_gig_nudge',
]);
const HOME_TYPES = new Set([
  // Household
  'home_invite', 'home_invite_accepted',
  'member_moved_out', 'access_challenged', 'member_challenged',
  'home_access_request', 'home_access_request_rejected',
  // Tasks
  'task_assigned', 'task_completed',
  'bill_reminder', 'home_update',
  // Ownership / residency
  'residency_claim', 'residency_approved', 'residency_rejected',
  'ownership_verification_needed', 'ownership_claim_approved',
  'ownership_claim_rejected', 'ownership_claim_needs_more_info',
  'new_ownership_claim', 'ownership_dispute',
  'challenge_window_opened', 'ownership_transfer_received',
  'tenant_request',
]);
const MAIL_TYPES = new Set([
  'mail_new', 'mail_summary', 'mail_urgent', 'mail_interrupt',
]);

/**
 * Check whether a specific notification type is enabled for the user
 * via granular UserNotificationPreferences toggles.
 * Returns true by default if no preferences row exists.
 */
async function isTypeEnabled(userId, type) {
  try {
    let prefField = null;
    if (GIG_TYPES.has(type)) prefField = 'gig_updates_enabled';
    else if (HOME_TYPES.has(type)) prefField = 'home_reminders_enabled';
    else if (MAIL_TYPES.has(type)) prefField = 'mail_summary_enabled';

    // If not a categorized type, allow by default
    if (!prefField) return true;

    const { data } = await supabaseAdmin
      .from('UserNotificationPreferences')
      .select(prefField)
      .eq('user_id', userId)
      .maybeSingle();

    // Default to enabled if no row exists
    if (!data) return true;
    return data[prefField] !== false;
  } catch {
    return true; // Default enabled on error
  }
}

async function shouldSuppressAudienceNotification(userId, type, metadata) {
  if (!metadata?.persona_id) return false;
  try {
    const personaBlockService = require('./personaBlockService');
    const isBlocked = await personaBlockService.isFanBlockedFromPersona(
      metadata.persona_id, userId,
    );
    if (isBlocked) {
      logger.info('notification.suppressed_blocked', {
        userId, type, personaId: metadata.persona_id,
      });
      return true;
    }
  } catch (err) {
    // Suppression is a defense-in-depth check; an error reading the
    // block table should not block the notification entirely because
    // route/service gates already prevent new blocked-fan actions.
    logger.warn('notification.block_check_failed', {
      userId, type, personaId: metadata.persona_id, error: err.message,
    });
  }
  return false;
}

/**
 * Create a notification for a user.
 * @param {Object} opts
 * @param {string} opts.userId - recipient user ID
 * @param {string} opts.type - notification type (see migration for types)
 * @param {string} opts.title - short title
 * @param {string} [opts.body] - longer description
 * @param {string} [opts.icon] - emoji icon
 * @param {string} [opts.link] - in-app link to navigate to
 * @param {Object} [opts.metadata] - extra data (home_id, gig_id, etc.)
 * @param {string} [opts.contextType] - 'personal' or 'business' (Identity Firewall)
 * @param {string} [opts.contextId] - business_user_id when contextType='business'
 * @param {string} [opts.context] - 'personal' | 'audience' | 'platform'
 *   (P0.6 Notification firewall — defaults to 'personal'; every existing
 *   notifyX is personal-side and Phase 1 audience-side notifications must
 *   pass `context: 'audience'` explicitly).
 * @returns {Promise<Object|null>} notification or null on error
 */
async function createNotification({ userId, type, title, body, icon, link, metadata, contextType, contextId, context }) {
  if (!userId || !type || !title) {
    logger.warn('createNotification called with missing required fields', { userId, type, title });
    return null;
  }
  const resolvedContext = NOTIFICATION_CONTEXTS.has(context) ? context : 'personal';

  // P1.14 — audience-context notifications are suppressed when the
  // recipient is currently blocked from the originating persona. Per
  // audience-profile §9 + §6.2: a blocked fan must not receive a
  // "@personahandle replied to your message" push the moment they
  // get blocked. Lazy-required to avoid a circular dependency
  // (personaBlockService imports the lifecycle service which has
  // shared utilities; notificationService is loaded everywhere).
  if (resolvedContext === 'audience' && metadata?.persona_id) {
    if (await shouldSuppressAudienceNotification(userId, type, metadata)) return null;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('Notification')
      .insert({
        user_id: userId,
        type,
        title,
        body: body || null,
        icon: icon || '🔔',
        link: link || null,
        metadata: metadata || {},
        context_type: contextType || 'personal',
        context_id: contextId || null,
        context: resolvedContext,
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create notification', { error: error.message, userId, type });
      return null;
    }

    // Push updated badge counts to the user in real-time
    badgeService.emitBadgeUpdate(userId);

    // Push the notification itself so frontends can prepend it instantly
    if (_io && _connectedUsers) {
      const socketIds = getUserSocketIds(userId);
      for (const socketId of socketIds) {
        _io.to(socketId).emit('notification:new', data);
      }
    }

    // Send push notification only if:
    // 1. User has global push enabled (MailPreferences.push_notifications)
    // 2. User hasn't disabled this specific notification type (UserNotificationPreferences)
    Promise.all([isPushEnabled(userId), isTypeEnabled(userId, type)])
      .then(([pushEnabled, typeEnabled]) => {
        if (!pushEnabled || !typeEnabled) return;
        pushService.sendToUser(userId, {
          title,
          body: body || '',
          data: { notificationId: data.id, type, link: link || null, ...(metadata || {}) },
        });
      })
      .catch((err) => {
        logger.warn('Push delivery failed (non-blocking)', { error: err.message, userId });
      });

    return data;
  } catch (err) {
    logger.error('Notification creation error', { error: err.message, userId, type });
    return null;
  }
}

/**
 * Create notifications for multiple users at once.
 */
async function createBulkNotifications(notifications) {
  try {
    const rows = [];
    for (const n of notifications) {
      const resolvedContext = NOTIFICATION_CONTEXTS.has(n.context) ? n.context : 'personal';
      if (resolvedContext === 'audience'
          && await shouldSuppressAudienceNotification(n.userId, n.type, n.metadata || {})) {
        continue;
      }
      rows.push({
        user_id: n.userId,
        type: n.type,
        title: n.title,
        body: n.body || null,
        icon: n.icon || '🔔',
        link: n.link || null,
        metadata: n.metadata || {},
        context_type: n.contextType || 'personal',
        context_id: n.contextId || null,
        // P0.6: every row is tagged with the new firewall context. Existing
        // notifyX call sites are personal-side and inherit the default.
        context: resolvedContext,
      });
    }

    if (rows.length === 0) return [];

    const { data, error } = await supabaseAdmin
      .from('Notification')
      .insert(rows)
      .select();

    if (error) {
      logger.error('Failed to create bulk notifications', { error: error.message });
      return [];
    }

    // Push updated badge counts to all affected users
    const uniqueUserIds = [...new Set(rows.map((n) => n.user_id))];
    badgeService.emitBadgeUpdateToMany(uniqueUserIds);

    // Push each notification to its recipient if they're connected
    if (_io && _connectedUsers && data) {
      for (const notif of data) {
        const socketIds = getUserSocketIds(notif.user_id);
        for (const socketId of socketIds) {
          _io.to(socketId).emit('notification:new', notif);
        }
      }
    }

    // Send push notifications to all affected users' devices (respecting preferences)
    if (data && data.length > 0) {
      for (const notif of data) {
        Promise.all([isPushEnabled(notif.user_id), isTypeEnabled(notif.user_id, notif.type)])
          .then(([pushEnabled, typeEnabled]) => {
            if (!pushEnabled || !typeEnabled) return;
            pushService.sendToUser(notif.user_id, {
              title: notif.title,
              body: notif.body || '',
              data: { notificationId: notif.id, type: notif.type, link: notif.link || null, ...(notif.metadata || {}) },
            });
          })
          .catch((err) => {
            logger.warn('Bulk push delivery failed (non-blocking)', { error: err.message });
          });
      }
    }

    return data || [];
  } catch (err) {
    logger.error('Bulk notification error', { error: err.message });
    return [];
  }
}

// ============================================================
//  CONVENIENCE METHODS — specific notification types
// ============================================================

/**
 * Notify a user they've been invited to a home.
 */
async function notifyHomeInvite({ inviteeUserId, inviterName, homeName, homeId, inviteToken }) {
  return createNotification({
    userId: inviteeUserId,
    type: 'home_invite',
    title: `${inviterName} invited you to join a home`,
    body: `You've been invited to ${homeName} as a household member.`,
    icon: '🏠',
    link: `/invite/${inviteToken}`,
    metadata: { home_id: homeId, inviter_name: inviterName },
  });
}

/**
 * Notify the inviter that their invite was accepted.
 */
async function notifyHomeInviteAccepted({ inviterUserId, accepterName, homeName, homeId }) {
  return createNotification({
    userId: inviterUserId,
    type: 'home_invite_accepted',
    title: `${accepterName} joined your home`,
    body: `${accepterName} accepted your invitation to ${homeName}.`,
    icon: '🎉',
    link: `/app/homes/${homeId}/dashboard?tab=members`,
    metadata: { home_id: homeId, accepter_name: accepterName },
  });
}

/**
 * Notify a user that a task was assigned to them.
 */
async function notifyTaskAssigned({ assigneeUserId, assignerName, taskTitle, homeId, taskId }) {
  return createNotification({
    userId: assigneeUserId,
    type: 'task_assigned',
    title: `${assignerName} assigned you a task`,
    body: taskTitle,
    icon: '📋',
    link: `/app/homes/${homeId}/dashboard?tab=tasks`,
    metadata: { home_id: homeId, task_id: taskId },
  });
}

/**
 * Notify the task creator that it was completed.
 */
async function notifyTaskCompleted({ creatorUserId, completedByName, taskTitle, homeId }) {
  return createNotification({
    userId: creatorUserId,
    type: 'task_completed',
    title: `Task completed: ${taskTitle}`,
    body: `${completedByName} marked this task as done.`,
    icon: '✅',
    link: `/app/homes/${homeId}/dashboard?tab=tasks`,
    metadata: { home_id: homeId },
  });
}

/**
 * Notify the gig owner that they received a bid.
 */
async function notifyBidReceived({ gigOwnerId, bidderName, gigTitle, gigId, isFirstBid }) {
  const title = isFirstBid
    ? 'Your first response! 🎉'
    : `New bid on "${gigTitle}"`;
  const body = isFirstBid
    ? `${bidderName} wants to help with '${gigTitle}'`
    : `${bidderName} placed a bid on your gig.`;

  return createNotification({
    userId: gigOwnerId,
    type: isFirstBid ? 'first_bid_received' : 'bid_received',
    title,
    body,
    icon: isFirstBid ? '🎉' : '💰',
    link: `/gigs/${gigId}`,
    metadata: { gig_id: gigId, bidder_name: bidderName, is_first_bid: !!isFirstBid },
  });
}

/**
 * Notify the bidder that their bid was accepted.
 */
async function notifyBidAccepted({ bidderId, gigTitle, gigId, gigOwnerId, address }) {
  return createNotification({
    userId: bidderId,
    type: 'bid_accepted',
    title: `Your bid was accepted!`,
    body: address
      ? `Your bid on "${gigTitle}" was accepted. Open the gig to view the unlocked address.`
      : `Your bid on "${gigTitle}" was accepted. You can start a chat to coordinate.`,
    icon: '🎉',
    link: `/gigs/${gigId}`,
    metadata: { gig_id: gigId, address_unlocked: !!address },
  });
}

/**
 * Notify the bidder that their bid was rejected.
 */
async function notifyBidRejected({ bidderId, gigTitle, gigId }) {
  return createNotification({
    userId: bidderId,
    type: 'bid_rejected',
    title: 'Your bid was not selected',
    body: `Your bid on "${gigTitle}" was declined.`,
    icon: '😔',
    link: `/gigs/${gigId}`,
    metadata: { gig_id: gigId },
  });
}

/**
 * Notify a buyer that the listing seller shared their pickup address.
 */
async function notifyAddressRevealed({ granteeUserId, listingId, listingTitle }) {
  return createNotification({
    userId: granteeUserId,
    type: 'address_revealed',
    title: 'Address shared with you',
    body: `The seller shared their pickup address for "${listingTitle}".`,
    icon: '📍',
    link: `/marketplace/${listingId}`,
    metadata: { listing_id: listingId },
  });
}

/**
 * Notify the gig poster that a bidder withdrew their bid.
 */
async function notifyBidWithdrawn({ gigOwnerId, bidderName, gigTitle, gigId }) {
  return createNotification({
    userId: gigOwnerId,
    type: 'bid_withdrawn',
    title: `Bid withdrawn on "${gigTitle}"`,
    body: `${bidderName} withdrew their bid.`,
    icon: '↩️',
    link: `/gigs/${gigId}`,
    metadata: { gig_id: gigId },
  });
}

/**
 * Notify the gig poster that the worker started.
 */
async function notifyGigStarted({ gigOwnerId, workerName, gigTitle, gigId }) {
  return createNotification({
    userId: gigOwnerId,
    type: 'gig_started',
    title: `Work started on "${gigTitle}"`,
    body: `${workerName} has started working on your gig.`,
    icon: '🚀',
    link: `/gigs/${gigId}`,
    metadata: { gig_id: gigId },
  });
}

/**
 * Notify the gig poster that the worker marked it complete.
 */
async function notifyGigCompleted({ gigOwnerId, workerName, gigTitle, gigId }) {
  return createNotification({
    userId: gigOwnerId,
    type: 'gig_completed',
    title: `"${gigTitle}" marked as completed`,
    body: `${workerName} marked the gig as done. Please review and confirm completion.`,
    icon: '✅',
    link: `/gigs/${gigId}`,
    metadata: { gig_id: gigId },
  });
}

/**
 * Notify the worker that the gig owner confirmed completion.
 */
async function notifyGigConfirmed({ workerId, gigTitle, gigId }) {
  return createNotification({
    userId: workerId,
    type: 'gig_confirmed',
    title: `Gig "${gigTitle}" confirmed!`,
    body: 'The gig owner confirmed your work is complete. Great job!',
    icon: '🎉',
    link: `/gigs/${gigId}`,
    metadata: { gig_id: gigId },
  });
}

// ============================================================
//  PAYMENT NOTIFICATION HELPERS
// ============================================================

/**
 * Notify user that off-session payment authorization failed (SCA required).
 */
async function notifyPaymentAuthFailed({ userId, gigId, gigTitle }) {
  return createNotification({
    userId,
    type: 'payment_auth_failed',
    title: 'Payment authorization failed',
    body: `Your payment for "${gigTitle || 'a gig'}" requires your attention. Please update your payment to keep your booking.`,
    icon: '⚠️',
    link: `/gigs/${gigId}`,
    metadata: { gig_id: gigId },
  });
}

/**
 * Notify user that payment was captured (funds held).
 */
async function notifyPaymentCaptured({ userId, gigId, gigTitle, amount }) {
  const amountFormatted = amount ? `$${(amount / 100).toFixed(2)}` : '';
  return createNotification({
    userId,
    type: 'payment_captured',
    title: `Payment captured${amountFormatted ? ': ' + amountFormatted : ''}`,
    body: `Payment for "${gigTitle || 'a gig'}" has been captured. Provider payout will follow after the review period.`,
    icon: '💳',
    link: `/gigs/${gigId}`,
    metadata: { gig_id: gigId, amount },
  });
}

/**
 * Notify provider that transfer (payout) was completed.
 */
async function notifyTransferCompleted({ userId, gigId, gigTitle, amount }) {
  const amountFormatted = amount ? `$${(amount / 100).toFixed(2)}` : '';
  return createNotification({
    userId,
    type: 'payout_sent',
    title: `Payout complete${amountFormatted ? ': ' + amountFormatted : ''}`,
    body: `Your payout for "${gigTitle || 'a gig'}" has been sent to your bank account.`,
    icon: '💰',
    link: `/gigs/${gigId}`,
    metadata: { gig_id: gigId, amount },
  });
}

/**
 * Notify user about a dispute on their payment.
 */
async function notifyDisputeCreated({ userId, gigId, gigTitle, role }) {
  const isProvider = role === 'provider';
  return createNotification({
    userId,
    type: 'dispute_created',
    title: 'Payment dispute opened',
    body: isProvider
      ? `A dispute has been filed for "${gigTitle || 'a gig'}". Funds are frozen while we investigate.`
      : `Your payment for "${gigTitle || 'a gig'}" is under dispute. We'll keep you updated.`,
    icon: '⚖️',
    link: `/gigs/${gigId}`,
    metadata: { gig_id: gigId, role },
  });
}

/**
 * Notify user about a dispute resolution.
 */
async function notifyDisputeResolved({ userId, gigId, gigTitle, won }) {
  return createNotification({
    userId,
    type: 'dispute_resolved',
    title: won ? 'Dispute resolved in your favor' : 'Dispute resolved',
    body: won
      ? `The dispute for "${gigTitle || 'a gig'}" was resolved in your favor.`
      : `The dispute for "${gigTitle || 'a gig'}" has been resolved. Funds have been adjusted.`,
    icon: won ? '✅' : '📋',
    link: `/gigs/${gigId}`,
    metadata: { gig_id: gigId, won },
  });
}

/**
 * Notify user that a gig was auto-cancelled due to payment failure.
 */
async function notifyGigAutoCancelled({ userId, gigId, gigTitle, reason }) {
  return createNotification({
    userId,
    type: 'gig_auto_cancelled',
    title: `"${gigTitle || 'Your gig'}" was auto-cancelled`,
    body: reason || 'This gig was cancelled due to a payment issue.',
    icon: '🚫',
    link: `/gigs/${gigId}`,
    metadata: { gig_id: gigId, reason: reason || 'payment_failed' },
  });
}

/**
 * Notify user that their card setup failed.
 */
async function notifySetupFailed({ userId, gigId, gigTitle }) {
  return createNotification({
    userId,
    type: 'payment_setup_failed',
    title: 'Card setup failed',
    body: `We couldn't save your card for "${gigTitle || 'a gig'}". Please try again with a different payment method.`,
    icon: '❌',
    link: `/gigs/${gigId}`,
    metadata: { gig_id: gigId },
  });
}

// ============================================================
//  CONNECTION / RELATIONSHIP NOTIFICATION HELPERS
// ============================================================

/**
 * Notify a user they received a connection request.
 */
async function notifyConnectionRequest({ addresseeUserId, requesterName, requesterId }) {
  return createNotification({
    userId: addresseeUserId,
    type: 'connection_request',
    title: `${requesterName} wants to connect with you`,
    icon: '🤝',
    link: '/app/connections?tab=requests',
    metadata: { requester_id: requesterId },
  });
}

/**
 * Notify a user their connection request was accepted.
 */
async function notifyConnectionAccepted({ requesterUserId, accepterName, accepterId, accepterUsername }) {
  return createNotification({
    userId: requesterUserId,
    type: 'connection_accepted',
    title: `${accepterName} accepted your connection request`,
    icon: '🤝',
    link: `/${accepterUsername || accepterId}`,
    metadata: { user_id: accepterId },
  });
}

/**
 * Notify a Beacon owner when someone follows or requests access.
 */
async function notifyPersonaFollow({
  ownerUserId,
  fanDisplayName,
  fanHandle,
  membershipId,
  personaId,
  personaHandle,
  personaDisplayName,
  followId,
  followStatus,
}) {
  const isPending = followStatus === 'pending';
  const handle = String(personaHandle || '').replace(/^@/, '');
  const safeFanName = fanDisplayName || fanHandle || 'Someone';
  return createNotification({
    userId: ownerUserId,
    type: isPending ? 'persona_follow_request' : 'persona_follow',
    title: isPending
      ? `Review a new audience request`
      : `New follower`,
    body: isPending
      ? `${safeFanName} wants to join ${personaDisplayName || 'your Beacon'}. Approve, remove, or block them from Audience settings.`
      : `${safeFanName} joined ${personaDisplayName || 'your Beacon'}. You can manage followers from Audience settings.`,
    icon: '📣',
    link: '/app/persona?tab=followers',
    context: 'audience',
    metadata: {
      persona_id: personaId,
      persona_handle: handle || null,
      membership_id: membershipId || followId || null,
      fan_handle: fanHandle || null,
      follow_id: followId || null,
      follow_status: followStatus,
    },
  });
}

/**
 * Notify a fan that a Beacon owner approved their follow request.
 */
async function notifyPersonaFollowApproved({
  fanUserId,
  personaId,
  personaHandle,
  personaDisplayName,
  membershipId,
}) {
  const handle = String(personaHandle || '').replace(/^@/, '');
  const displayName = personaDisplayName || (handle ? `@${handle}` : 'A Beacon');
  return createNotification({
    userId: fanUserId,
    type: 'persona_follow_approved',
    title: 'Beacon request approved',
    body: `${displayName} approved your request. You can now view follower posts.`,
    icon: '📣',
    link: handle ? `/@${handle}` : null,
    context: 'audience',
    metadata: {
      persona_id: personaId,
      persona_handle: handle || null,
      membership_id: membershipId || null,
      follow_status: 'active',
    },
  });
}

/**
 * Notify Beacon followers about a new one-way broadcast.
 */
async function notifyPersonaBroadcast({
  recipientUserIds,
  personaId,
  personaHandle,
  personaDisplayName,
  messageId,
  postId,
  visibility,
  bodyPreview,
}) {
  const uniqueRecipientIds = [...new Set((recipientUserIds || []).filter(Boolean))];
  if (uniqueRecipientIds.length === 0) return [];

  const handle = String(personaHandle || '').replace(/^@/, '');
  const body = bodyPreview
    ? String(bodyPreview).slice(0, 180)
    : 'Open the Beacon to read the latest update.';

  return createBulkNotifications(uniqueRecipientIds.map((userId) => ({
    userId,
    type: 'persona_broadcast',
    title: `${personaDisplayName || 'A Beacon'} shared an update`,
    body,
    icon: '📣',
    link: postId ? `/post/${postId}` : (handle ? `/@${handle}` : null),
    context: 'audience',
    metadata: {
      persona_id: personaId,
      persona_handle: handle || null,
      broadcast_message_id: messageId,
      post_id: postId || null,
      visibility,
    },
  })));
}

/**
 * Notify home authorities about a new residency claim.
 */
async function notifyResidencyClaim({ authorityUserId, claimantName, homeName, homeId, claimantId, claimedRole }) {
  const roleLabel = claimedRole ? ` as ${claimedRole}` : '';
  return createNotification({
    userId: authorityUserId,
    type: 'residency_claim',
    title: 'New home access request',
    body: `${claimantName} is requesting to join ${homeName || 'your home'}${roleLabel}.`,
    icon: '📩',
    link: `/homes/${homeId}/owners/review-claim`,
    metadata: { home_id: homeId, claimant_id: claimantId, claimed_role: claimedRole },
  });
}

/**
 * Notify a user their residency claim was approved.
 */
async function notifyResidencyApproved({ userId, homeName, homeId }) {
  return createNotification({
    userId,
    type: 'residency_approved',
    title: 'Welcome home!',
    body: `You've been verified at ${homeName || 'your home'}.`,
    icon: '🏡',
    link: `/homes/${homeId}/dashboard`,
    metadata: { home_id: homeId },
  });
}

/**
 * Notify a user their residency claim was rejected (generic — silent deny).
 */
async function notifyResidencyRejected({ userId, homeName, homeId, reason }) {
  return createNotification({
    userId,
    type: 'residency_rejected',
    title: 'Claim update',
    body: `We couldn't verify you for ${homeName || 'this home'}. If you believe this is a mistake, verify using a mailed code.`,
    icon: '📋',
    link: `/homes/${homeId}/waiting-room`,
    metadata: { home_id: homeId },
  });
}

// ============================================================
//  OWNERSHIP NOTIFICATION HELPERS
// ============================================================

/**
 * Notify user to upload ownership verification documents after home creation.
 */
async function notifyOwnershipVerificationNeeded({ userId, homeName, homeId, claimId }) {
  return createNotification({
    userId,
    type: 'ownership_verification_needed',
    title: 'Verify your home ownership',
    body: `Upload a deed, closing disclosure, or property tax bill for ${homeName || 'your home'} to complete ownership verification.`,
    icon: '🏠',
    link: `/homes/${homeId}/claim-owner/evidence${claimId ? `?claimId=${claimId}` : ''}`,
    metadata: { home_id: homeId, claim_id: claimId },
  });
}

/**
 * Notify user that their ownership claim was approved.
 */
async function notifyOwnershipClaimApproved({ userId, homeName, homeId }) {
  return createNotification({
    userId,
    type: 'ownership_claim_approved',
    title: 'Ownership verified!',
    body: `Your ownership of ${homeName || 'your home'} has been verified.`,
    icon: '✅',
    link: `/app/homes/${homeId}/dashboard?tab=members`,
    metadata: { home_id: homeId },
  });
}

/**
 * Notify user that their ownership claim was rejected.
 */
async function notifyOwnershipClaimRejected({ userId, homeName, homeId, reason }) {
  return createNotification({
    userId,
    type: 'ownership_claim_rejected',
    title: 'Ownership verification update',
    body: reason || `Your ownership verification for ${homeName || 'your home'} requires additional documentation.`,
    icon: '📋',
    link: `/app/homes/${homeId}/dashboard`,
    metadata: { home_id: homeId },
  });
}

/**
 * Notify user that more information is needed for their ownership claim (upload proof again).
 */
async function notifyOwnershipClaimNeedsMoreInfo({ userId, homeName, homeId }) {
  return createNotification({
    userId,
    type: 'ownership_claim_needs_more_info',
    title: 'More information needed',
    body: `Your ownership verification for ${homeName || 'your home'} needs additional documentation. Please upload proof again.`,
    icon: '📋',
    link: `/app/homes/${homeId}/dashboard`,
    metadata: { home_id: homeId },
  });
}

/**
 * Notify existing owners about a new ownership claim on their home.
 */
async function notifyNewOwnershipClaim({ ownerUserId, claimantName, homeName, homeId, claimId }) {
  return createNotification({
    userId: ownerUserId,
    type: 'new_ownership_claim',
    title: 'New ownership claim',
    body: `${claimantName || 'Someone'} submitted an ownership claim for ${homeName || 'your home'}.`,
    icon: '⚠️',
    link: `/homes/${homeId}/owners/review-claim`,
    metadata: { home_id: homeId, claim_id: claimId },
  });
}

/**
 * Notify owners about a dispute being triggered on their home.
 */
async function notifyOwnershipDispute({ userId, homeName, homeId }) {
  return createNotification({
    userId,
    type: 'ownership_dispute',
    title: 'Ownership dispute detected',
    body: `A dispute has been detected for ${homeName || 'your home'}. Some actions may be restricted until resolved.`,
    icon: '⚖️',
    link: `/homes/${homeId}/dispute`,
    metadata: { home_id: homeId },
  });
}

// ============================================================
//  MAIL DELIVERY NOTIFICATION HELPERS
// ============================================================

/**
 * Build mail-type-specific notification title and body.
 * Uses the compose flow's mailIntent (from tracking metadata)
 * to select the correct template.
 *
 * @param {Object} opts
 * @param {string} opts.mailIntent - compose intent (personal_note, bill_request, etc.)
 * @param {string} opts.senderName - display name of the sender
 * @param {string} [opts.address] - recipient home address (city, state)
 * @param {number} [opts.amount] - bill amount (for bill_request)
 * @param {string} [opts.vendorName] - sender/vendor for packages
 */
function buildMailNotificationCopy({ mailIntent, senderName, address, amount, vendorName }) {
  const loc = address || 'your address';

  switch (mailIntent) {
    case 'personal_note':
      return {
        title: 'New mail arrived',
        body: `${senderName} left something for you at your door. Open it.`,
        icon: '✉️',
      };

    case 'bill_request': {
      const amountStr = amount ? `$${Number(amount).toFixed(2)}` : 'a bill';
      return {
        title: 'Bill received',
        body: `${senderName} sent you a bill for ${amountStr}. It's waiting at your address.`,
        icon: '💵',
      };
    }

    case 'certified_signature':
      return {
        title: 'Certified mail',
        body: `${senderName} sent you certified mail. Your signature is required.`,
        icon: '📜',
      };

    case 'household_notice':
      return {
        title: 'Household notice',
        body: `A notice just arrived for your home at ${loc}.`,
        icon: '📢',
      };

    case 'package_pickup': {
      const from = vendorName ? ` from ${vendorName}` : '';
      return {
        title: 'Package notice',
        body: `A package notice arrived at ${loc}${from}.`,
        icon: '📦',
      };
    }

    case 'document':
      return {
        title: 'Document received',
        body: `${senderName} sent a document to your home. Review it.`,
        icon: '📄',
      };

    case 'offer_promotion':
      return {
        title: 'New offer',
        body: `${senderName} sent you an offer at ${loc}.`,
        icon: '🏷️',
      };

    default:
      return {
        title: 'New mail',
        body: `${senderName} sent you mail. Check your mailbox.`,
        icon: '📬',
      };
  }
}

/**
 * Notify a recipient that mail has been delivered to them.
 * Generates mail-type-specific notification copy.
 *
 * @param {Object} opts
 * @param {string} opts.recipientUserId - recipient to notify
 * @param {string} opts.senderName - display name of sender
 * @param {string} opts.mailId - the created mail ID
 * @param {string} [opts.mailIntent] - compose intent (personal_note, bill_request, etc.)
 * @param {string} [opts.mailType] - backend envelope type (letter, bill, notice, etc.)
 * @param {string} [opts.address] - recipient home address
 * @param {number} [opts.amount] - bill amount
 * @param {string} [opts.vendorName] - sender/vendor for packages
 */
async function notifyMailDelivered({
  recipientUserId,
  senderName,
  mailId,
  mailIntent,
  mailType,
  address,
  amount,
  vendorName,
}) {
  // Determine the intent — prefer the compose flow's mailIntent,
  // fall back to mapping backend mail_type to an intent
  const intent = mailIntent || mapMailTypeToIntent(mailType);

  const { title, body, icon } = buildMailNotificationCopy({
    mailIntent: intent,
    senderName,
    address,
    amount,
    vendorName,
  });

  return createNotification({
    userId: recipientUserId,
    type: 'mail_delivered',
    title,
    body,
    icon,
    link: `/app/mailbox/${mailId}`,
    metadata: {
      mail_id: mailId,
      mail_intent: intent,
      sender_name: senderName,
    },
  });
}

/**
 * Map backend envelope type to compose intent.
 * Used as fallback when tracking.mailIntent is not available.
 */
function mapMailTypeToIntent(mailType) {
  switch (mailType) {
    case 'letter': return 'personal_note';
    case 'bill': return 'bill_request';
    case 'notice': return 'household_notice';
    case 'package': return 'package_pickup';
    case 'document': return 'document';
    case 'certified_signature': return 'certified_signature';
    case 'promotion': return 'offer_promotion';
    default: return null;
  }
}

// ============================================================
//  DENSITY MILESTONE NOTIFICATION
// ============================================================

/**
 * Notify a user that their neighborhood crossed a density milestone.
 */
async function notifyDensityMilestone({ userId, milestone, geohash }) {
  return createNotification({
    userId,
    type: 'density_milestone',
    title: '🎉 Neighborhood milestone!',
    body: `Your neighborhood just hit ${milestone} verified members!`,
    icon: '🎉',
    link: '/',
    metadata: { milestone, geohash },
  });
}

/**
 * Someone asked verified owner(s) to add them to the household (claim flow).
 */
async function notifyHouseholdAccessRequestRejected({ requesterUserId, homeLabel, resolverName }) {
  return createNotification({
    userId: requesterUserId,
    type: 'home_access_request_rejected',
    title: 'Request not approved',
    body: `${resolverName} declined your request to join ${homeLabel}.`,
    icon: '🏠',
    metadata: {},
  });
}

async function notifyHouseholdAccessRequest({
  ownerUserIds,
  requesterName,
  homeLabel,
  homeId,
  requesterUserId,
  requestedIdentity,
}) {
  const roleLabels = {
    owner: 'an owner',
    resident: 'a resident',
    household_member: 'a household member',
    guest: 'a guest',
  };
  const label = roleLabels[requestedIdentity] || 'a member';
  const link = `/app/homes/${homeId}/members?tab=requests&access_requester=${encodeURIComponent(requesterUserId)}`;
  for (const uid of ownerUserIds) {
    await createNotification({
      userId: uid,
      type: 'home_access_request',
      title: `${requesterName} asked to join your home`,
      body: `They want to be added as ${label} at ${homeLabel}. Open Members to add or invite them.`,
      icon: '🏠',
      link,
      metadata: {
        home_id: homeId,
        requester_user_id: requesterUserId,
        requested_identity: requestedIdentity,
      },
    });
  }
}


module.exports = {
  init,
  createNotification,
  createBulkNotifications,
  notifyHomeInvite,
  notifyHomeInviteAccepted,
  notifyTaskAssigned,
  notifyTaskCompleted,
  notifyBidReceived,
  notifyBidAccepted,
  notifyBidRejected,
  notifyBidWithdrawn,
  notifyAddressRevealed,
  notifyGigStarted,
  notifyGigCompleted,
  notifyGigConfirmed,
  // Payment notifications
  notifyPaymentAuthFailed,
  notifyPaymentCaptured,
  notifyTransferCompleted,
  notifyDisputeCreated,
  notifyDisputeResolved,
  notifyGigAutoCancelled,
  notifySetupFailed,
  // Connection/relationship notifications
  notifyConnectionRequest,
  notifyConnectionAccepted,
  notifyPersonaFollow,
  notifyPersonaFollowApproved,
  notifyPersonaBroadcast,
  // Residency notifications
  notifyResidencyClaim,
  notifyResidencyApproved,
  notifyResidencyRejected,
  // Ownership notifications
  notifyOwnershipVerificationNeeded,
  notifyOwnershipClaimApproved,
  notifyOwnershipClaimRejected,
  notifyOwnershipClaimNeedsMoreInfo,
  notifyNewOwnershipClaim,
  notifyOwnershipDispute,
  // Mail delivery notifications
  notifyMailDelivered,
  // Density milestone
  notifyDensityMilestone,
  notifyHouseholdAccessRequest,
  notifyHouseholdAccessRequestRejected,
};
