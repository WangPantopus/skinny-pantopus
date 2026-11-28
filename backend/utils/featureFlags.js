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

// Around you (founder decision 2026-11-14): Today's second half lists local headlines that link to their outlets
// (services/aroundYouService.js), and the curator account's posts leave the Pulse list and map. AROUND_YOU is '1' (on)
// or '0' (off); unset, it is on for hosted staging and off everywhere else.
function aroundYouEnabled(env = process.env) {
  const value = String(env.AROUND_YOU || '').trim();
  if (value === '1') return true;
  if (value === '0') return false;
  return env.APP_ENV === 'staging';
}

// Sources for a new county (Around you everywhere layer, piece 4): the source finder asks Claude, with web search, for
// a county's own news and event sources and proposes them for review on /app/admin/sources. AROUND_YOU_SOURCE_FINDER is
// '1' (on) or '0' (off); unset, it is on for hosted staging and off everywhere else. Off, nothing calls Claude. It needs
// AROUND_YOU on too.
function aroundYouSourceFinderEnabled(env = process.env) {
  if (!aroundYouEnabled(env)) return false;
  const value = String(env.AROUND_YOU_SOURCE_FINDER || '').trim();
  if (value === '1') return true;
  if (value === '0') return false;
  return env.APP_ENV === 'staging';
}

// A profile with sources (founder approval 2026-11-23; ~/pantopus-profile-sources/SPEC.md). No switch: built and
// merged means available (the founder, 2026-11-24: "do not make a switch to this, this should be automatically turned
// on, nothing here should be turned off"; SPEC rule 4.12). Each answers true unless its variable is exactly "0", which
// stays only as an emergency off. PROFILE_SOURCES=0 turns off the whole profile with sources (every profile read is
// exactly as before); PROFILE_LINKS=0 links for one purpose; PROFILE_TIES=0 credits, signing, roles and the circle.
const isOn = (env, name) => String(env[name] || '').trim() !== '0';

function profileSourcesEnabled(env = process.env) {
  return isOn(env, 'PROFILE_SOURCES');
}

function profileLinksEnabled(env = process.env) {
  return profileSourcesEnabled(env) && isOn(env, 'PROFILE_LINKS');
}

function profileTiesEnabled(env = process.env) {
  return profileSourcesEnabled(env) && isOn(env, 'PROFILE_TIES');
}

// Known for (phase 3A; CONTRACT P3.2): on, as everything built and merged is; PROFILE_KNOWN_FOR=0 is its emergency off.
function profileKnownForEnabled(env = process.env) {
  return profileSourcesEnabled(env) && isOn(env, 'PROFILE_KNOWN_FOR');
}

// Guidance cards (founder approval 2026-11-16): the centre cards and pointer bubbles that explain the app to a new
// account. The apps show nothing unless the profile's `guidance.enabled` is true (routes/users.js). GUIDANCE_CARDS is
// '1' (on) or '0' (off); unset, it is on for hosted staging and off everywhere else.
function guidanceCardsEnabled(env = process.env) {
  const value = String(env.GUIDANCE_CARDS || '').trim();
  if (value === '1') return true;
  if (value === '0') return false;
  return env.APP_ENV === 'staging';
}

// The house on Today (founder approval 2026-11-21, JOURNEYS): Today's picture of the person's own house gains a
// mailbox, a note on the door and a lantern, each a button, and the "Needs you" card says the same things in words.
// The apps draw none of it unless the profile's `today_house` is true (routes/users.js). TODAY_HOUSE is '1' (on) or
// '0' (off); unset, it is on for hosted staging and off everywhere else.
function todayHouseEnabled(env = process.env) {
  const value = String(env.TODAY_HOUSE || '').trim();
  if (value === '1') return true;
  if (value === '0') return false;
  return env.APP_ENV === 'staging';
}

// A Christmas card by email's one reminder, three days after its email (founder, November 16; services/cardEmail).
// CARD_EMAIL_REMINDERS is '0' (off) or '1' (on); unset, it is on where the server runs as staging or production
// (NODE_ENV=production) and off on a laptop or in tests, so a local run never emails a reminder to a real address.
// Changing it takes a restart of the API and worker with the new value, not a new build.
function cardEmailRemindersEnabled(env = process.env) {
  const value = String(env.CARD_EMAIL_REMINDERS || '').trim().toLowerCase();
  if (DISABLED_VALUES.includes(value)) return false;
  if (['1', 'true', 'on'].includes(value)) return true;
  return env.NODE_ENV === 'production';
}

// The Christmas card round of November 28, 2026 (docs/product/card-improvements-2026-11-28/CONTRACT.md), all of it
// behind this one switch: opening a card before signing up, the sealed card's Christmas-morning reminder, the code
// email's return link, two free photo or voice cards, a photo or voice on a list, and what follows them. On unless
// CARD_IMPROVEMENTS=0. Off is sending and receiving cards exactly as before that round: the same answers (no new
// fields), refusals, emails and timing. The reads a screen draws from say `improved: true` while it is on, and the
// apps draw the new experience only from such a read. Cards already sent keep working either way: off changes what
// can be done next, never what was done. Changing it takes a restart of the API and worker.
function cardImprovementsOn(env = process.env) {
  return isOn(env, 'CARD_IMPROVEMENTS');
}

// Guest open-before-signup for unsealed Christmas card links and emails: recipients open the card on the browser table
// before creating an account, then join to save it, write back or pass it on. Ordinary letters, bills and sealed cards
// stay gated. Part of the card round (cardImprovementsOn): it counts only while that is on, where CARD_GUEST_OPEN=0 is
// its own emergency off.
function cardGuestOpenEnabled(env = process.env) {
  return cardImprovementsOn(env) && isOn(env, 'CARD_GUEST_OPEN');
}

// Year-round thank-you cards (the card round, Wave 5; docs/product/card-improvements-2026-11-28/CONTRACT-wave5.md):
// the "Thank You" collection that opens on January 1 and has no end. OFF unless CARD_EVERYDAY=1, because the app
// builds already in the stores print "CHRISTMAS" under every card they are sent. It counts only while
// cardImprovementsOn is on. The Christmas thank-you cards (December 26 to January 15) don't wait for it.
function cardEverydayOn(env = process.env) {
  return cardImprovementsOn(env) && String(env.CARD_EVERYDAY || '').trim() === '1';
}

// A card's own photo or voice greeting is free on a person's first cards that carry one (founder, November 28, 2026:
// two); past them each such card spends a bought stamp, as every one did before. How many: CARD_MEDIA_FREE_LIMIT
// (a whole number from 0 up; unset or unreadable, 2). CARD_MEDIA_FREE=0 is its emergency off (none are free). Part of
// the card round: none are free while cardImprovementsOn is off.
const DEFAULT_CARD_MEDIA_FREE_LIMIT = 2;
const MAX_CARD_MEDIA_FREE_LIMIT = 1000;
function cardMediaFreeLimit(env = process.env) {
  if (!cardImprovementsOn(env) || !isOn(env, 'CARD_MEDIA_FREE')) return 0;
  const raw = String(env.CARD_MEDIA_FREE_LIMIT ?? '').trim();
  if (!/^\d+$/.test(raw)) return DEFAULT_CARD_MEDIA_FREE_LIMIT;
  return Math.min(Number.parseInt(raw, 10), MAX_CARD_MEDIA_FREE_LIMIT);
}

// First-launch scope (founder direction, 2026-09-27). These features are
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
  'gift_funds', // 9. Support Train gift funds (no app can take a contribution yet)
  'mailbox', // 10. The mailbox: received mail, Mail Day, vault, vacation hold, Stamps (2026-10-09)
  'pulse_redesign', // 11. The Pulse redesign (PR 625), paused for launch (2026-10-15); the October 13 Pulse stays
  'holiday_cards', // 12. Christmas cards sent through Mail (2026-10-30); needs `mailbox` on too
  'card_table', // 13. The Christmas card on the table: full screen, sharing, sending by link, public card pages (2026-11-06); needs `mailbox` and `holiday_cards` on too
  'holiday_card_memories', // 14. A card's own photo and voice greeting (memories plan 2026-11-02, built 2026-11-10); needs `mailbox` on too
  'card_note_help', // 15. "Help me write it" on a Christmas card: three AI-written notes to pick from and edit (2026-11-11); needs `mailbox` and `holiday_cards` on too
  'card_share_video', // 16. Sharing a Christmas card as a video of it arriving (2026-11-14): one film per picture, never a note or a name; needs `mailbox`, `holiday_cards` and `card_table` on too
  'card_replies', // 17. "Write back to {first name}": one reply to a Christmas card, note only (founder's D4, 2026-11-17); server only, needs `mailbox` and `holiday_card_memories` on too
  'card_travel', // 18. The travelling card: pass a card on, free, to up to two people; postmarks and a public journey page (founder, 2026-11-21); server only, needs `mailbox`, `holiday_cards` and `card_table` on too
  'card_shelves', // 19. "Pick a card" and pantopus.com/cards as shelves: one card from each collection, a shelf per collection, a page per collection (founder, 2026-11-21); server only, needs `mailbox` and `holiday_cards` on too
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
// (task lifecycle, payments, scheduling) are deliberately absent.
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
  mail_escrow_expired: ['mailbox', 'mail_extras'],
  mail_escrow_claimed: ['mailbox', 'mail_extras'],
  mail_claimed: ['mailbox', 'mail_extras'],
  // 10. Mailbox: delivery notices, Mail Day, urgent and interrupt pushes, and a
  // Home letter another member deleted or dismissed.
  mail_delivered: ['mailbox'],
  mail_new: ['mailbox'],
  mail_summary: ['mailbox'],
  mail_urgent: ['mailbox'],
  mail_interrupt: ['mailbox'],
  home_mail_removed: ['mailbox'],
  // 12. Christmas cards by email: someone not on Pantopus joined and has the sender's card, its 90 days ended, or its
  // email didn't go out after every try (services/cardEmail).
  holiday_card_claimed: ['mailbox', 'holiday_cards'],
  holiday_card_expired: ['mailbox', 'holiday_cards'],
  holiday_card_email_failed: ['mailbox', 'holiday_cards'],
  // 18. The travelling card: a card someone held reached another town (services/cardTravel).
  holiday_card_travelled: ['mailbox', 'holiday_cards', 'card_table', 'card_travel'],
  // 11. The Pulse redesign: follow alerts, Helpful and thanks notices, offer requests and the
  // Ask reminder. The October 13 Pulse's reply and mention notices are not here.
  pulse_follow_reply: ['pulse_redesign'],
  pulse_helpful: ['pulse_redesign'],
  pulse_thanks: ['pulse_redesign'],
  offer_request: ['pulse_redesign'],
  offer_chosen: ['pulse_redesign'],
  offer_gone: ['pulse_redesign'],
  ask_still_open: ['pulse_redesign'],
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
  aroundYouEnabled,
  aroundYouSourceFinderEnabled,
  profileSourcesEnabled,
  profileLinksEnabled,
  profileTiesEnabled,
  profileKnownForEnabled,
  guidanceCardsEnabled,
  todayHouseEnabled,
  cardEmailRemindersEnabled,
  cardImprovementsOn,
  cardEverydayOn,
  cardGuestOpenEnabled,
  cardMediaFreeLimit,
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
