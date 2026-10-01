const logger = require('./logger');

const DISABLED_VALUES = ['0', 'false', 'off', 'disabled'];

function enabled(name, defaultValue = true) {
  const value = process.env[name];
  if (value == null || value === '') return defaultValue;
  return !DISABLED_VALUES.includes(String(value).toLowerCase());
}

function isIdentityFirewallEnabled() {
  return enabled('IDENTITY_FIREWALL_ENABLED');
}

function isPersonaEnabled() {
  return isIdentityFirewallEnabled() && enabled('PERSONA_ENABLED');
}

function isPersonaBroadcastEnabled() {
  return isPersonaEnabled() && enabled('PERSONA_BROADCAST_ENABLED');
}

// First-launch scope (founder direction, 2026-09-27). These eight features are
// hidden for the first launch; their code stays. A feature is OFF unless its
// key is listed in LAUNCH_FEATURES (comma-separated, or "all"). The same keys
// drive the web app (NEXT_PUBLIC_LAUNCH_FEATURES) and the native apps.
const LAUNCH_FEATURE_KEYS = [
  'beacon', // 1. Beacon and creator tools
  'personas', // 2. Personas and identity switching
  'marketplace', // 3. Marketplace
  'open_gigs', // 4. Open Gigs marketplace
  'public_scheduling', // 5. Public scheduling for general businesses
  'business_directory', // 6. General business directory
  'household_extras', // 7. Polls, packages, pet section, family calendar, bill management
  'mail_extras', // 8. Letters, e-signing, community mail, event invitations by mail
];

function isLaunchFeatureEnabled(key) {
  if (!LAUNCH_FEATURE_KEYS.includes(key)) {
    throw new Error(`Unknown launch feature: ${key}`);
  }
  const listed = String(process.env.LAUNCH_FEATURES || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return listed.includes('all') || listed.includes(key);
}

// True when every listed feature is on. A surface that belongs to two cut
// features stays hidden unless both are on.
function areLaunchFeaturesEnabled(keys) {
  return [].concat(keys).every(isLaunchFeatureEnabled);
}

// Background senders that exist only for a cut feature call this first: it
// returns true (logging once per sender) while the feature is off.
const loggedLaunchSkips = new Set();
function skipForLaunchCut(keys, senderName) {
  if (areLaunchFeaturesEnabled(keys)) return false;
  if (!loggedLaunchSkips.has(senderName)) {
    loggedLaunchSkips.add(senderName);
    logger.info(`[launch-cut] ${senderName} skipped: ${[].concat(keys).join('+')} is off for the first launch`);
  }
  return true;
}

// Notification types that only a cut feature produces. While the feature is
// off, createNotification drops them and the notification list, unread counts
// and Hub activity leave them out. Types an in-scope flow can also produce
// (task lifecycle, payments, scheduling, mail delivery) are deliberately absent.
const LAUNCH_NOTIFICATION_TYPE_FEATURES = {
  // 1–2. Beacon and personas: the audience stream and Beacon billing.
  persona_follow: ['beacon', 'personas'],
  persona_follow_request: ['beacon', 'personas'],
  persona_follow_approved: ['beacon', 'personas'],
  persona_broadcast: ['beacon', 'personas'],
  persona_new_post: ['beacon', 'personas'],
  persona_dm_received_creator: ['beacon', 'personas'],
  persona_dm_reply_fan: ['beacon', 'personas'],
  persona_member_joined: ['beacon', 'personas'],
  persona_subscription_canceled: ['beacon', 'personas'],
  persona_payment_failed: ['beacon', 'personas'],
  // 3. Marketplace.
  listing_offer_received: ['marketplace'],
  listing_offer_countered: ['marketplace'],
  listing_offer_accepted: ['marketplace'],
  listing_offer_declined: ['marketplace'],
  listing_offer_expired: ['marketplace'],
  listing_trade_proposed: ['marketplace'],
  listing_trade_accepted: ['marketplace'],
  listing_trade_declined: ['marketplace'],
  listing_question: ['marketplace'],
  listing_question_answered: ['marketplace'],
  saved_search_match: ['marketplace'],
  address_revealed: ['marketplace'],
  transaction_review_prompt: ['marketplace'],
  // 4. Open Gigs: bids and counters, task Q&A, saved-search and nearby alerts.
  bid_received: ['open_gigs'],
  first_bid_received: ['open_gigs'],
  bid_withdrawn: ['open_gigs'],
  bid_rejected: ['open_gigs'],
  bid_on_standby: ['open_gigs'],
  bid_reopened: ['open_gigs'],
  bid_countered: ['open_gigs'],
  counter_accepted: ['open_gigs'],
  counter_declined: ['open_gigs'],
  counter_withdrawn: ['open_gigs'],
  gig_question: ['open_gigs'],
  gig_question_answered: ['open_gigs'],
  gig_saved_search_match: ['open_gigs'],
  urgent_gig_nearby: ['open_gigs'],
  urgent_task_nearby: ['open_gigs'],
  no_bid_gig_nudge: ['open_gigs'],
  // 7. Household extras: bill reminders.
  bill_reminder: ['household_extras'],
  // 8. Mail extras: letters sent to a contact (escrow).
  mail_escrow_expired: ['mail_extras'],
  mail_escrow_claimed: ['mail_extras'],
  mail_claimed: ['mail_extras'],
};

// The audience stream (context 'audience') is Beacon/persona only.
function isAudienceNotificationStreamEnabled() {
  return areLaunchFeaturesEnabled(['beacon', 'personas']);
}

function hiddenLaunchNotificationTypes() {
  return Object.keys(LAUNCH_NOTIFICATION_TYPE_FEATURES)
    .filter((type) => !areLaunchFeaturesEnabled(LAUNCH_NOTIFICATION_TYPE_FEATURES[type]));
}

function isLaunchNotificationHidden(type, context) {
  if (context === 'audience' && !isAudienceNotificationStreamEnabled()) return true;
  const keys = LAUNCH_NOTIFICATION_TYPE_FEATURES[type];
  return Boolean(keys) && !areLaunchFeaturesEnabled(keys);
}

// Leaves hidden notifications out of a Notification query (list or count).
function excludeHiddenLaunchNotifications(query) {
  let next = query;
  const types = hiddenLaunchNotificationTypes();
  if (types.length) next = next.not('type', 'in', `(${types.join(',')})`);
  if (!isAudienceNotificationStreamEnabled()) next = next.neq('context', 'audience');
  return next;
}

// Home activity rows about records of a cut feature (launch cut #7). Only the
// activity feeds leave them out; the Members & Security audit log keeps every
// row, since it is a security record. Rows without a target type stay.
const HOUSEHOLD_EXTRA_TARGET_TYPES = ['HomeBill', 'HomePackage', 'HomePet', 'HomePoll', 'HomeCalendarEvent'];
function excludeHiddenHomeActivity(query) {
  if (isLaunchFeatureEnabled('household_extras')) return query;
  return query.or(`target_type.is.null,target_type.not.in.(${HOUSEHOLD_EXTRA_TARGET_TYPES.join(',')})`);
}

function disabledResponse(res) {
  return res.status(404).json({ error: 'Not found' });
}

function requireIdentityFirewallEnabled(_req, res, next) {
  if (!isIdentityFirewallEnabled()) return disabledResponse(res);
  return next();
}

function requirePersonaEnabled(_req, res, next) {
  if (!isPersonaEnabled()) return disabledResponse(res);
  return next();
}

function requirePersonaBroadcastEnabled(_req, res, next) {
  if (!isPersonaBroadcastEnabled()) return disabledResponse(res);
  return next();
}

module.exports = {
  LAUNCH_FEATURE_KEYS,
  isLaunchFeatureEnabled,
  areLaunchFeaturesEnabled,
  skipForLaunchCut,
  LAUNCH_NOTIFICATION_TYPE_FEATURES,
  isAudienceNotificationStreamEnabled,
  hiddenLaunchNotificationTypes,
  isLaunchNotificationHidden,
  excludeHiddenLaunchNotifications,
  excludeHiddenHomeActivity,
  isIdentityFirewallEnabled,
  isPersonaEnabled,
  isPersonaBroadcastEnabled,
  requireIdentityFirewallEnabled,
  requirePersonaEnabled,
  requirePersonaBroadcastEnabled,
};
