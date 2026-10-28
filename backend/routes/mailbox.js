const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const supabaseAdmin = require('../config/supabaseAdmin');
const homeRecordService = require('../services/homeRecordService');
// canAccessMail: the per-item rule, shared with the v2 mailbox routes.
const { getAccessibleHomeIds, trustedHomeIdsOrThrow, hasVerifiedSenderHome, canSendToMailHome, canAccessMail, readableMail, homeMailFilter, visibleMailFilter,
  restorableMail, removedMailInfo, sendHomeMailRemovedNotice, MAIL_RESTORE_DAYS,
  sendMailUnavailable, mailHomesOrThrow, MAIL_HOME_NEEDS_PROOF, onlyDelivered } = require('../utils/homeMailAccess');
// Mail comes in the morning (SRV-1): the delivery rule every writer follows.
const mailDelivery = require('../services/mailDelivery');
// What the apps read about a piece (SRV-2), and its kept "Pantopus read this for you" note.
const mailPiece = require('../services/mailPiece');
const mailSummaries = require('../services/mailSummaries');
// Private enclosures (SRV-4).
const mailEnclosures = require('../services/mailEnclosures');
// A bill's invoice, read live (SRV-7).
const { attachInvoices } = require('../services/invoiceBills');
const { HOME_DOCUMENT_TYPES } = require('../utils/homeDocumentAccess');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const Joi = require('joi');
const logger = require('../utils/logger');
const { checkHomePermission } = require('../utils/homePermissions');
const { getBusinessIdsWithPermissions } = require('../utils/businessPermissions');
const { VERIFICATION_RANK } = require('../utils/businessConstants');
const mailObjects = require('../services/mailObjectStorage');
const notificationService = require('../services/notificationService');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');
const { isBlocked } = require('../services/blockService');
const { skipForLaunchCut, areLaunchFeaturesEnabled } = require('../utils/featureFlags');
// Other people are named the way neighbors see them: by their Local Profile (a business by the business).
const { loadChatPeople } = require('../services/chatPeople');
const { localDisplayNames } = require('../utils/identityProfiles');
const { maskContact } = require('../jobs/mailEscrowExpiry');
// A letter sent as a business names the business to everyone it reaches, never the person who sent it.
const { presentMailSender, presentMailSenders, nameMailSender, nameMailSenders, objectForRecipient, payloadForRecipient,
  sentAsBusiness, claimPageSender } = require('../utils/mailSenderView');

// ============ VALIDATION SCHEMAS ============

const HOME_ADDRESS_VERIFICATION_REQUIRED_CODE = 'HOME_ADDRESS_VERIFICATION_REQUIRED';
const HOME_ADDRESS_VERIFICATION_REQUIRED_MESSAGE =
  'Verify your home address before sending mail.';
const HOME_ADDRESS_VERIFICATION_REQUIRED_DETAIL =
  'Verify your home address before sending mail. Open Homes and finish address verification, then try sending again.';

const sendMailSchema = Joi.object({
  recipientUserId: Joi.string().uuid().optional(),
  recipientHomeId: Joi.string().uuid().optional(),
  recipientEmail: Joi.string().email().max(320).optional(),
  recipientPhone: Joi.string().pattern(/^\+?[1-9]\d{6,14}$/).optional(),
  destination: Joi.object({
    deliveryTargetType: Joi.string().valid('home', 'user').required(),
    homeId: Joi.string().uuid().required(),
    userId: Joi.string().uuid().optional(),
    attnUserId: Joi.string().uuid().optional(),
    attnLabel: Joi.string().max(255).allow('').optional(),
    visibility: Joi.string().valid('home_members', 'attn_only', 'attn_plus_admins').optional()
  }).optional(),
  type: Joi.string().valid(
    'ad', 'letter', 'bill', 'statement', 'notice',
    'package', 'newsletter', 'promotion', 'document', 'other'
  ).optional(),
  subject: Joi.string().max(500).optional(),
  content: Joi.string().optional(),
  attachments: Joi.array().items(Joi.string().uri()).optional(),
  senderBusinessName: Joi.string().max(255).optional(),
  senderAddress: Joi.string().optional(),
  payoutAmount: Joi.number().min(0).max(10).optional(),
  ackRequired: Joi.boolean().optional(),
  category: Joi.string().max(100).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  priority: Joi.string().valid('low', 'normal', 'high', 'urgent').optional(),
  expiresAt: Joi.date().iso().optional(),
  recipient: Joi.object({
    mode: Joi.string().valid('self', 'user', 'home').optional(),
    userId: Joi.string().uuid().optional(),
    homeId: Joi.string().uuid().optional()
  }).optional(),
  envelope: Joi.object({
    type: Joi.string().valid(
      'ad', 'letter', 'bill', 'statement', 'notice',
      'package', 'newsletter', 'promotion', 'document', 'other'
    ).optional(),
    subject: Joi.string().max(500).optional(),
    attachments: Joi.array().items(Joi.string().uri()).optional(),
    senderBusinessName: Joi.string().max(255).optional(),
    senderAddress: Joi.string().optional(),
    payoutAmount: Joi.number().min(0).max(10).optional(),
    ackRequired: Joi.boolean().optional(),
    category: Joi.string().max(100).optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    priority: Joi.string().valid('low', 'normal', 'high', 'urgent').optional(),
    expiresAt: Joi.date().iso().optional()
  }).optional(),
  object: Joi.object({
    format: Joi.string().valid('mailjson_v1', 'html', 'markdown', 'plain_text', 'pdf', 'binary').optional(),
    mimeType: Joi.string().max(255).optional(),
    title: Joi.string().max(500).optional(),
    content: Joi.string().allow('').optional(),
    attachments: Joi.array().items(Joi.string().uri()).optional(),
    payload: Joi.object({
      stationeryTheme: Joi.string().max(100).optional(),
      inkSelection: Joi.string().max(100).optional(),
      outcomes: Joi.array().items(
        Joi.string().valid(
          'pay_now', 'acknowledge', 'remind_later',
          'save_to_records', 'create_task', 'sign_confirm', 'just_read'
        )
      ).optional(),
      voicePostscriptUri: Joi.string().uri().optional(),
    }).unknown(true).optional()
  }).optional(),
  policy: Joi.object({
    payoutAmount: Joi.number().min(0).max(10).optional(),
    ackRequired: Joi.boolean().optional()
  }).optional(),
  tracking: Joi.object().unknown(true).optional()
}).unknown(false);

const createCampaignSchema = Joi.object({
  name: Joi.string().min(3).max(255).required(),
  description: Joi.string().optional(),
  targetCities: Joi.array().items(Joi.string()).optional(),
  targetStates: Joi.array().items(Joi.string()).optional(),
  targetZipcodes: Joi.array().items(Joi.string()).optional(),
  targetLocation: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required()
  }).optional(),
  targetRadiusMeters: Joi.number().min(1000).max(100000).optional(),
  budgetTotal: Joi.number().min(10).required(),
  pricePerView: Joi.number().min(0.01).max(1).default(0.10),
  startsAt: Joi.date().iso().optional(),
  endsAt: Joi.date().iso().optional()
});

const updatePreferencesSchema = Joi.object({
  receiveAds: Joi.boolean().optional(),
  receive_ads: Joi.boolean().optional(),
  receivePromotions: Joi.boolean().optional(),
  receive_promotions: Joi.boolean().optional(),
  receiveNewsletters: Joi.boolean().optional(),
  receive_newsletters: Joi.boolean().optional(),
  maxAdsPerDay: Joi.number().min(0).max(20).optional(),
  max_ads_per_day: Joi.number().min(0).max(20).optional(),
  preferredAdCategories: Joi.array().items(Joi.string()).optional(),
  preferred_ad_categories: Joi.array().items(Joi.string()).optional(),
  blockedSenders: Joi.array().items(Joi.string().uuid()).optional(),
  blocked_senders: Joi.array().items(Joi.string().uuid()).optional(),
  emailNotifications: Joi.boolean().optional(),
  email_notifications: Joi.boolean().optional(),
  pushNotifications: Joi.boolean().optional(),
  push_notifications: Joi.boolean().optional()
});

const seedMailboxSchema = Joi.object({
  count: Joi.number().integer().min(1).max(100).default(12),
  clearExisting: Joi.boolean().default(false)
});

const startReadSessionSchema = Joi.object({
  clientMeta: Joi.object().optional().default({})
});

const closeReadSessionSchema = Joi.object({
  activeTimeMs: Joi.number().integer().min(0).max(86400000).default(0),
  maxScrollPercent: Joi.number().min(0).max(100).optional(),
  eventMeta: Joi.object().optional().default({})
});

const createMailLinkSchema = Joi.object({
  targetType: Joi.string().valid('bill', 'issue', 'package', 'document', 'task').required(),
  targetId: Joi.string().uuid().required(),
  createdBy: Joi.string().valid('system', 'user').optional()
});

// ============ HELPER FUNCTIONS ============

/**
 * Format location for PostGIS
 */
const formatLocationForDB = (latitude, longitude) => {
  return `POINT(${longitude} ${latitude})`;
};

/**
 * Get or create user mail preferences
 */
const getUserPreferences = async (userId) => {
  let { data: prefs, error } = await supabaseAdmin
    .from('MailPreferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code === 'PGRST116') {
    // Create default preferences
    const { data: newPrefs, error: createError } = await supabaseAdmin
      .from('MailPreferences')
      .insert({ user_id: userId })
      .select()
      .single();

    if (createError) {
      logger.error('Error creating preferences', { error: createError.message, userId });
      return null;
    }
    return newPrefs;
  }

  return prefs;
};

const TEST_MAIL_TYPES = [
  'letter',
  'bill',
  'statement',
  'notice',
  'package',
  'newsletter',
  'ad',
  'promotion',
  'document',
  'other'
];

const buildSeedMailItem = (userId, index) => {
  const type = TEST_MAIL_TYPES[index % TEST_MAIL_TYPES.length];
  const now = Date.now();
  const hoursAgo = index * 3;
  const createdAt = new Date(now - hoursAgo * 60 * 60 * 1000).toISOString();

  const subjectByType = {
    letter: 'Welcome to your digital mailbox',
    bill: 'Utility bill due reminder',
    statement: 'Monthly statement available',
    notice: 'Building maintenance notice',
    package: 'Package delivery update',
    newsletter: 'Neighborhood weekly digest',
    ad: 'Local offer: coffee and bakery',
    promotion: 'Limited-time neighborhood discount',
    document: 'Important document for your records',
    other: 'Mailbox test message'
  };

  const contentByType = {
    letter: 'This is a seeded personal letter used to test mailbox rendering.',
    bill: 'A sample bill with due date and amount sections for UI testing.',
    statement: 'This statement includes summary details and recent activity.',
    notice: 'Please note scheduled maintenance in your area tomorrow morning.',
    package: 'Your package is out for delivery and should arrive today.',
    newsletter: 'Top local updates and community highlights for this week.',
    ad: 'View this ad and earn mailbox credits in your test environment.',
    promotion: 'Use promo code LOCAL10 for a seeded mailbox test promotion.',
    document: 'Attached is a test document record for mailbox validation.',
    other: 'General seeded message used for mailbox state testing.'
  };

  const isAdType = type === 'ad';
  const isPromotion = type === 'promotion';
  const viewed = index % 4 === 0;
  const archived = index % 11 === 0;
  const starred = index % 5 === 0;

  return {
    recipient_user_id: userId,
    type,
    subject: subjectByType[type],
    content: contentByType[type],
    sender_business_name: isAdType || isPromotion ? 'Pantopus Local Partners' : 'Pantopus',
    sender_address: 'Pantopus HQ',
    attachments: [],
    viewed,
    viewed_at: viewed ? createdAt : null,
    archived,
    starred,
    payout_amount: isAdType ? 0.10 : null,
    payout_status: isAdType && viewed ? 'pending' : null,
    category: isAdType || isPromotion ? 'local-services' : 'general',
    tags: ['seed_mailbox'],
    priority: index % 9 === 0 ? 'high' : 'normal',
    expires_at: isAdType || isPromotion
      ? new Date(now + (72 - index) * 60 * 60 * 1000).toISOString()
      : null,
    created_at: createdAt
  };
};

/**
 * Log a mail event to the MailEvent table (fire-and-forget).
 */
async function logMailEvent(eventType, mailId, userId, metadata = {}) {
  try {
    await supabaseAdmin
      .from('MailEvent')
      .insert({ event_type: eventType, mail_id: mailId, user_id: userId, metadata });
  } catch (err) {
    logger.error('Failed to log mail event', { eventType, mailId, err: err.message });
  }
}

const DEFAULT_MAIL_TYPE = 'letter';
// What a person (not a business) can send: a letter. Bills, statements, notices, packages, newsletters, ads and
// promotions come from a business.
const PERSON_MAIL_TYPES = new Set(['letter']);
const DEFAULT_MAIL_PRIORITY = 'normal';
const MAIL_OBJECT_FORMATS = ['mailjson_v1', 'html', 'markdown', 'plain_text', 'pdf', 'binary'];
const MAILBOX_SCOPES = ['personal', 'home', 'all'];
const MIME_BY_MAIL_OBJECT_FORMAT = {
  mailjson_v1: 'application/json',
  html: 'text/html',
  markdown: 'text/markdown',
  plain_text: 'text/plain',
  pdf: 'application/pdf',
  binary: 'application/octet-stream'
};
const CONTENT_RENDER_FORMATS = ['plain_text', 'markdown', 'html'];
const MAIL_DELIVERY_TARGET_TYPES = ['home', 'user'];
const MAIL_DELIVERY_VISIBILITIES = ['home_members', 'attn_only', 'attn_plus_admins'];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAIL_TYPE_TO_DELIVERABLE_TYPE = {
  statement: 'bill',
  newsletter: 'book',
  document: 'packet',
  package: 'packet',
  promotion: 'promotion',
  ad: 'promotion',
  notice: 'notice',
  bill: 'bill',
  letter: 'letter',
  other: 'other'
};
const MAIL_TYPES_LABEL_FALLBACK = {
  ad: 'Ad',
  letter: 'Letter',
  bill: 'Bill',
  statement: 'Statement',
  notice: 'Notice',
  package: 'Package',
  newsletter: 'Newsletter',
  promotion: 'Promotion',
  document: 'Document',
  other: 'Mail'
};
const DELIVERABLE_PRIMARY_ACTION_BY_TYPE = {
  letter: 'open',
  bill: 'view_bill',
  packet: 'open_packet',
  book: 'read',
  notice: 'review',
  promotion: 'open',
  other: 'open'
};
const DELIVERABLE_ACTION_REQUIRED_TYPES = new Set(['bill', 'notice']);

// ── Escrow constants ─────────────────────────────────────────
const ESCROW_EXPIRY_DAYS = 90;
const ESCROW_MAX_UNIQUE_CONTACTS_PER_WEEK = 3;
const ESCROW_MAX_SENDS_PER_CONTACT_DAYS = 30;

/**
 * The link emailed or texted to someone not on Pantopus. It opens the web app's public page for the letter
 * (frontend/apps/web/src/app/open), on the same base as the other public pages' links
 * (services/residencyLetterService webBaseUrl).
 */
function escrowClaimLink(mailId, token) {
  const base = (process.env.PUBLIC_WEB_URL || process.env.APP_URL || 'https://pantopus.com').trim().replace(/\/+$/, '');
  return `${base}/open/${mailId}?token=${token}`;
}

/**
 * Constant-time comparison for claim tokens.
 * Prevents timing side-channel attacks on token validation.
 */
function timingSafeTokenCompare(stored, provided) {
  if (typeof stored !== 'string' || typeof provided !== 'string') return false;
  const storedBuf = Buffer.from(stored, 'utf8');
  const providedBuf = Buffer.from(provided, 'utf8');
  if (storedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(storedBuf, providedBuf);
}

// The claim token travels only in the link. The letter keeps its SHA-256 (escrow_claim_token_hash), so a Mail row
// read back by a route (most select '*') or a copy of the database never holds a working link.
function hashClaimToken(token) {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex');
}

// Letters stored before the hash kept the token itself.
function claimTokenMatches(mail, provided) {
  if (typeof provided !== 'string' || !provided) return false;
  if (mail.escrow_claim_token_hash) return timingSafeTokenCompare(mail.escrow_claim_token_hash, hashClaimToken(provided));
  return timingSafeTokenCompare(mail.escrow_claim_token, provided);
}

// A wrong id or token, and a letter that was never escrowed, get the same answer: the link doesn't work.
const sendClaimLinkInvalid = (res) =>
  res.status(404).json({ error: 'This letter link doesn’t work. Check that you opened the whole link.', code: 'MAIL_LINK_INVALID' });

// Why a claim link no longer opens its letter, or null while the letter waits. Past its 90 days it is expired even
// before the daily job (jobs/mailEscrowExpiry) marks it.
function closedEscrowReason(mail) {
  if (mail.escrow_status === 'claimed') {
    return { status: 409, error: 'This letter has already been added to a mailbox.', code: 'MAIL_CLAIMED' };
  }
  if (mail.escrow_status === 'withdrawn') {
    return { status: 410, error: 'The sender took this letter back.', code: 'MAIL_WITHDRAWN' };
  }
  if (mail.escrow_status === 'expired' || (mail.escrow_expires_at && new Date(mail.escrow_expires_at) <= new Date())) {
    return { status: 410, error: 'This letter waited 90 days for you and has expired.', code: 'MAIL_EXPIRED' };
  }
  return null;
}

/**
 * Normalize an escrow contact for consistent storage and comparison.
 * Emails: lowercased. Phones: digits only with leading +.
 */
function normalizeEscrowContact(contact) {
  if (!contact) return contact;
  if (contact.includes('@')) return contact.toLowerCase().trim();
  // Phone: keep only digits, prepend + if missing
  const digits = contact.replace(/\D/g, '');
  return `+${digits}`;
}

/**
 * Check escrow rate limits for non-user sends.
 * @param {string} senderId
 * @param {string} contact - email or phone
 * @returns {Promise<{ allowed: boolean, reason?: string }>}
 */
const checkEscrowRateLimits = async (senderId, contact) => {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - ESCROW_MAX_SENDS_PER_CONTACT_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Check: max 1 send to the same contact per 30 days
  const { count: sameContactCount } = await supabaseAdmin
    .from('Mail')
    .select('id', { count: 'exact', head: true })
    .eq('sender_user_id', senderId)
    .eq('escrow_recipient_contact', contact)
    .gte('created_at', thirtyDaysAgo);

  if (sameContactCount > 0) {
    return { allowed: false, reason: 'You can only send to the same non-Pantopus contact once every 30 days.' };
  }

  // Check: max 3 unique non-user contacts per week
  const { data: recentEscrows } = await supabaseAdmin
    .from('Mail')
    .select('escrow_recipient_contact')
    .eq('sender_user_id', senderId)
    .not('escrow_recipient_contact', 'is', null)
    .gte('created_at', oneWeekAgo);

  const uniqueContacts = new Set((recentEscrows || []).map(r => r.escrow_recipient_contact));
  // If this contact is already in the set, it doesn't count as a new unique contact
  if (!uniqueContacts.has(contact) && uniqueContacts.size >= ESCROW_MAX_UNIQUE_CONTACTS_PER_WEEK) {
    return { allowed: false, reason: 'You can send to at most 3 new non-Pantopus contacts per week.' };
  }

  return { allowed: true };
};

const buildMailExcerpt = (content, maxLength = 280) => {
  const normalized = String(content || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.slice(0, maxLength);
};

const toDeliverableType = (mailType) => {
  return MAIL_TYPE_TO_DELIVERABLE_TYPE[mailType] || 'other';
};

const toPrimaryAction = (deliverableType) => {
  return DELIVERABLE_PRIMARY_ACTION_BY_TYPE[deliverableType] || 'open';
};

const normalizeSendMailPayload = (rawBody, senderId) => {
  const body = rawBody || {};
  const structuredDestination = body.destination || {};
  const structuredRecipient = body.recipient || {};
  const structuredEnvelope = body.envelope || {};
  const structuredObject = body.object || {};
  const structuredPolicy = body.policy || {};

  let recipientUserId = body.recipientUserId || null;
  let recipientHomeId = body.recipientHomeId || null;
  // Someone who isn't on Pantopus, by email or phone: the letter waits in escrow until they claim it (POST /send).
  const contactRecipient = body.recipientEmail || body.recipientPhone || null;

  if (structuredRecipient.mode === 'self') {
    recipientUserId = senderId;
    recipientHomeId = null;
  } else if (structuredRecipient.mode === 'user') {
    recipientUserId = structuredRecipient.userId || recipientUserId;
    recipientHomeId = null;
  } else if (structuredRecipient.mode === 'home') {
    recipientHomeId = structuredRecipient.homeId || recipientHomeId;
    recipientUserId = null;
  } else {
    recipientUserId = structuredRecipient.userId || recipientUserId;
    recipientHomeId = structuredRecipient.homeId || recipientHomeId;
  }

  const hasStructuredDestination = Boolean(
    structuredDestination &&
    (
      structuredDestination.deliveryTargetType ||
      structuredDestination.homeId ||
      structuredDestination.userId ||
      structuredDestination.attnUserId ||
      structuredDestination.attnLabel ||
      structuredDestination.visibility
    )
  );

  let deliveryTargetType = null;
  let deliveryTargetId = null;
  let addressHomeId = null;
  let attnUserId = null;
  let attnLabel = null;
  let deliveryVisibility = null;

  if (hasStructuredDestination) {
    if (!MAIL_DELIVERY_TARGET_TYPES.includes(structuredDestination.deliveryTargetType)) {
      throw new Error('Please choose whether this mail goes to a home or a person.');
    }
    if (!structuredDestination.homeId) {
      throw new Error('Please choose which home to send this mail to.');
    }

    deliveryTargetType = structuredDestination.deliveryTargetType;
    addressHomeId = structuredDestination.homeId;
    attnUserId = structuredDestination.attnUserId || null;
    attnLabel = (structuredDestination.attnLabel || '').trim() || null;
    deliveryVisibility = structuredDestination.visibility || null;

    if (deliveryTargetType === 'home') {
      recipientHomeId = structuredDestination.homeId;
      recipientUserId = null;
      deliveryTargetId = structuredDestination.homeId;
      deliveryVisibility = deliveryVisibility || 'home_members';
      if (!attnLabel && !attnUserId) {
        attnLabel = 'Current Resident';
      }
    } else {
      const destinationUserId = structuredDestination.userId || structuredRecipient.userId || recipientUserId;
      if (!destinationUserId) {
        throw new Error('Please choose who this mail is for.');
      }
      recipientUserId = destinationUserId;
      recipientHomeId = null;
      deliveryTargetId = destinationUserId;
      attnUserId = attnUserId || destinationUserId;
      deliveryVisibility = deliveryVisibility || 'attn_only';
    }

    if (!MAIL_DELIVERY_VISIBILITIES.includes(deliveryVisibility)) {
      throw new Error('Please choose who can see this mail at the home.');
    }
  } else {
    if (!recipientUserId && !recipientHomeId && !contactRecipient) {
      throw new Error('Please choose who this mail is for.');
    }

    if (recipientUserId) {
      deliveryTargetType = 'user';
      deliveryTargetId = recipientUserId;
      addressHomeId = recipientHomeId || null;
      attnUserId = recipientUserId;
      deliveryVisibility = 'attn_only';
    } else if (recipientHomeId) {
      deliveryTargetType = 'home';
      deliveryTargetId = recipientHomeId;
      addressHomeId = recipientHomeId;
      deliveryVisibility = 'home_members';
      attnLabel = 'Current Resident';
    }
    // Otherwise the letter is for contactRecipient and has no delivery target until it is claimed.
  }

  if (!recipientUserId && !recipientHomeId && !contactRecipient) {
    throw new Error('Please choose who this mail is for.');
  }

  const type = structuredEnvelope.type || body.type || DEFAULT_MAIL_TYPE;
  const subject = structuredEnvelope.subject ?? body.subject ?? structuredObject.title ?? null;
  const priority = structuredEnvelope.priority || body.priority || DEFAULT_MAIL_PRIORITY;
  const category = structuredEnvelope.category ?? body.category ?? null;
  const tags = structuredEnvelope.tags || body.tags || [];
  const expiresAt = structuredEnvelope.expiresAt || body.expiresAt || null;
  const senderBusinessName = structuredEnvelope.senderBusinessName ?? body.senderBusinessName ?? null;
  const senderAddress = structuredEnvelope.senderAddress ?? body.senderAddress ?? null;
  const payoutAmount = structuredPolicy.payoutAmount ?? structuredEnvelope.payoutAmount ?? body.payoutAmount ?? null;
  const attachmentList =
    structuredObject.attachments ||
    structuredEnvelope.attachments ||
    body.attachments ||
    [];
  // Private enclosures (SRV-4): the sender's own uploads, by signed reference; anything else is an older public
  // address. A reference that isn't this sender's own upload refuses the send.
  const { urls: attachments, enclosures, refused } = mailEnclosures.fromAttachments(attachmentList, senderId);
  if (refused.length) {
    throw new Error("One of the files can't be sent with this letter. Attach it again and try once more.");
  }

  const contentCandidate = (
    structuredObject.content ??
    (structuredObject.payload && typeof structuredObject.payload.content === 'string' ? structuredObject.payload.content : undefined) ??
    body.content
  );
  const content = typeof contentCandidate === 'string' ? contentCandidate : '';

  if (!content.trim()) {
    throw new Error('Your mail needs a message. Please write something before sending.');
  }

  const requestedFormat = structuredObject.format || 'mailjson_v1';
  const objectFormat = MAIL_OBJECT_FORMATS.includes(requestedFormat) ? requestedFormat : 'mailjson_v1';
  const objectMimeType = structuredObject.mimeType || MIME_BY_MAIL_OBJECT_FORMAT[objectFormat] || 'application/json';
  const deliverableType = toDeliverableType(type);
  const primaryAction = toPrimaryAction(deliverableType);
  const displayTitle = subject || structuredObject.title || `${MAIL_TYPES_LABEL_FALLBACK[type] || 'Mail'} delivery`;
  const previewText = buildMailExcerpt(content, 140);
  const outcomes = Array.isArray(structuredObject?.payload?.outcomes) ? structuredObject.payload.outcomes : [];
  const actionRequired = DELIVERABLE_ACTION_REQUIRED_TYPES.has(deliverableType);
  const ackRequired = Boolean(
    body.ackRequired ||
    structuredEnvelope.ackRequired ||
    structuredPolicy.ackRequired ||
    structuredObject?.payload?.ackRequired ||
    outcomes.includes('acknowledge') ||
    outcomes.includes('sign_confirm')
  );
  const ackStatus = ackRequired ? 'pending' : null;

  // Override primary_action to 'pay' when pay_now outcome is set and amount is valid
  const hasPay = outcomes.includes('pay_now') && payoutAmount != null && payoutAmount > 0;
  const resolvedPrimaryAction = hasPay ? 'pay' : primaryAction;

  // Compose metadata — store stationery/ink in extractedData for quick access
  // A sender never sets what only the server writes (the kept note, Pantopus's mark, enclosures): services/mailPiece.
  const rawExtracted = mailPiece.withoutServerKeys(
    structuredObject?.payload?.extractedData || structuredObject?.payload?.extraction || null);
  const composeMetadata = {};
  if (structuredObject?.payload?.stationeryTheme) {
    composeMetadata.stationeryTheme = structuredObject.payload.stationeryTheme;
  }
  if (structuredObject?.payload?.inkSelection) {
    composeMetadata.inkSelection = structuredObject.payload.inkSelection;
  }
  if (structuredObject?.payload?.voicePostscriptUri) {
    composeMetadata.voicePostscriptUri = structuredObject.payload.voicePostscriptUri;
  }
  if (outcomes.length > 0) {
    composeMetadata.outcomes = outcomes;
  }
  if (enclosures.length > 0) {
    composeMetadata.enclosures = enclosures;
  }
  const extractedData = (rawExtracted || Object.keys(composeMetadata).length > 0)
    ? { ...(rawExtracted || {}), ...composeMetadata }
    : null;

  const objectPayload = {
    version: 'mailjson_v1',
    objectFormat,
    mimeType: objectMimeType,
    envelope: {
      type,
      subject,
      attachments,
      senderBusinessName,
      senderAddress,
      category,
      tags,
      priority,
      expiresAt
    },
    recipient: {
      mode: structuredRecipient.mode || (recipientHomeId ? 'home' : 'user'),
      userId: recipientUserId,
      homeId: recipientHomeId,
      deliveryTargetType,
      deliveryTargetId,
      addressHomeId,
      attnUserId,
      attnLabel,
      visibility: deliveryVisibility
    },
    policy: structuredPolicy,
    tracking: body.tracking || null,
    body: {
      content,
      payload: structuredObject.payload || null
    },
    createdAt: new Date().toISOString()
  };

  return {
    recipientUserId,
    recipientHomeId,
    deliveryTargetType,
    deliveryTargetId,
    addressHomeId,
    attnUserId,
    attnLabel,
    deliveryVisibility,
    deliverableType,
    displayTitle,
    previewText,
    primaryAction: resolvedPrimaryAction,
    actionRequired,
    ackRequired,
    ackStatus,
    extractedData,
    outcomes,
    type,
    subject,
    content,
    attachments,
    senderBusinessName,
    senderAddress,
    payoutAmount,
    category,
    tags,
    priority,
    expiresAt,
    objectPayload
  };
};


const getHomeForRouting = async (homeId) => {
  if (!homeId) return null;
  const { data: home } = await supabaseAdmin
    .from('Home')
    .select('id, owner_id, home_status, security_state')
    .eq('id', homeId)
    .single();

  if (!home || ['archived', 'merged'].includes(home.home_status)
    || ['frozen', 'frozen_silent', 'disputed'].includes(home.security_state)) return null;
  return home;
};

// Who may send a letter to a Home: anyone who can open the Home's mail (the
// Home mail rule), and its owners, the same test as isUserLinkedToHome. It used
// finance.view, which only owners hold, so a resident could not write to their
// own Home.
const hasHomeAccess = async (homeId, userId) => {
  const home = await getHomeForRouting(homeId);
  if (!home) {
    return { allowed: false, home: null };
  }

  return { allowed: await isUserLinkedToHome(home, userId)
    || (areLaunchFeaturesEnabled('mail_extras') && await canSendToMailHome(homeId, userId)), home };
};

// "Lives at this home" for a letter addressed to a person at a Home: they can
// open this Home's mail under the Home mail rule (utils/homeMailAccess), or
// they own it. It used finance.view, which only owners hold, so a letter to any
// other resident was refused.
const isUserLinkedToHome = async (home, userId) => {
  if (!home || !userId) return false;
  if ((await trustedHomeIdsOrThrow(userId)).includes(home.id)) return true;
  const access = await checkHomePermission(home.id, userId);
  return access.hasAccess === true && access.isOwner === true;
};


const sendHomeVerificationRequired = (res) =>
  res.status(403).json({
    error: HOME_ADDRESS_VERIFICATION_REQUIRED_MESSAGE,
    message: HOME_ADDRESS_VERIFICATION_REQUIRED_DETAIL,
    code: HOME_ADDRESS_VERIFICATION_REQUIRED_CODE,
  });

const normalizeBusinessName = (name) => String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();

// The businesses a user may send mail as: business IAM 'mail.send' (owners always may), each with its own name and
// whether it is verified (document- or government-verified). Compose lists them in its "Send as" picker.
const listSenderBusinesses = async (senderId) => {
  const businessIds = await getBusinessIdsWithPermissions(senderId, ['mail.send']);
  if (businessIds.length === 0) return [];
  const [{ data: businesses, error }, { data: profiles }] = await Promise.all([
    supabaseAdmin.from('User').select('id, name').in('id', businessIds).eq('account_type', 'business'),
    supabaseAdmin.from('BusinessProfile').select('business_user_id, verification_status').in('business_user_id', businessIds),
  ]);
  if (error) {
    logger.warn('Sender business lookup failed', { senderId, error: error.message });
    return [];
  }
  const statusById = new Map((profiles || []).map((profile) => [profile.business_user_id, profile.verification_status]));
  return (businesses || [])
    .filter((business) => typeof business.name === 'string' && business.name.trim())
    .map((business) => ({
      id: business.id,
      name: business.name.trim(),
      verified: (VERIFICATION_RANK[statusById.get(business.id)] || 0) >= VERIFICATION_RANK.document_verified,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

// A letter names a business as its sender only when it is one of listSenderBusinesses. The requested name only picks
// among them; the letter then carries the business's own name. It is 'verified_business' only when that business is
// verified. Otherwise the letter goes out under the sender's own name and the requested name is not stored.
const resolveSenderBusiness = async (senderId, requestedName) => {
  const wanted = normalizeBusinessName(requestedName);
  if (!wanted) return null;
  const businesses = await listSenderBusinesses(senderId);
  return businesses.find((business) => normalizeBusinessName(business.name) === wanted) || null;
};


// Home letters are filtered by the Home mail rule (utils/homeMailAccess, M01):
// a member sees the household's letters and their own, not a letter addressed
// to another member or for another member's attention only.
const applyMailboxScopeToQuery = (query, { scope, userId, homeId, accessibleHomeIds }) => {
  // Deleted letters (recoverable for 30 days) and dismissed ones leave the
  // lists and their counts, and a piece waiting for its morning round isn't
  // there yet (SRV-1).
  query = onlyDelivered(query.is('deleted_at', null).or('lifecycle.is.null,lifecycle.neq.shredded'));
  if (scope === 'home') {
    return query.eq('recipient_home_id', homeId).or(homeMailFilter(homeId, userId));
  }

  if (scope === 'all') {
    if (!accessibleHomeIds || accessibleHomeIds.length === 0) {
      return query.eq('recipient_user_id', userId);
    }
    return query.or(visibleMailFilter(userId, accessibleHomeIds));
  }

  return query.eq('recipient_user_id', userId);
};

// A letter sent as a business (businessId) names the business in its payload, which recipients read. The letter is
// stored privately under a key that names no one (services/mailObjectStorage); created_by_user_id keeps the person.
const createMailObject = async ({
  senderId,
  businessId = null,
  objectPayload
}) => {
  const payload = {
    ...objectPayload,
    sender: {
      ...(objectPayload?.sender || {}),
      senderUserId: businessId || senderId
    }
  };

  const serialized = JSON.stringify(payload || {});
  const buffer = Buffer.from(serialized, 'utf8');
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const id = crypto.randomUUID();
  const stored = await mailObjects.store(id, buffer, sha256);

  const { data: objectRow, error } = await supabaseAdmin
    .from('MailObject')
    .insert({
      id,
      created_by_user_id: senderId,
      ...stored,
      format: 'mailjson_v1',
      mime_type: 'application/json',
      size_bytes: buffer.length,
      sha256,
      status: 'ready',
      uploaded_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    await mailObjects.remove(stored);
    logger.error('MailObject insert failed', { error: error.message, objectId: id, senderId });
    throw new Error('Failed to persist mail object metadata');
  }

  return { objectId: objectRow.id };
};

const insertMailWithCompatibility = async (stored) => {
  // Every piece follows the morning delivery rule (SRV-1, services/mailDelivery): it goes into the box at the next
  // 7 a.m. where the mailbox is, or at once as a special delivery.
  const mailData = { ...stored, ...(await mailDelivery.deliveryFor(stored)) };
  const primaryInsert = await supabaseAdmin
    .from('Mail')
    .insert(mailData)
    .select()
    .single();

  if (!primaryInsert.error) {
    // A piece a vacation hold keeps joins its hold's bundle (SRV-5).
    await mailDelivery.afterStored([primaryInsert.data]);
    return primaryInsert;
  }

  // Retry without the newer columns only when the database lacks one of them:
  // PostgREST PGRST204 ("Could not find the 'x' column of 'Mail' in the schema
  // cache") or Postgres 42703 (undefined_column). A NOT NULL, CHECK or foreign-key
  // violation that merely names one of these columns (Mail_attn_user_id_fk for
  // an attention user whose account is gone) must fail the send; the retry would
  // store the letter without its attention and visibility fields, so a letter
  // for one person became readable by the whole household.
  const { code = '', message = '' } = primaryInsert.error;
  const columnMissing = code === 'PGRST204' || code === '42703';
  const missingObjectColumns = columnMissing && (
    message.includes('sender_display') ||
    message.includes('sender_trust') ||
    message.includes('object_id') ||
    message.includes('content_excerpt') ||
    message.includes('first_opened_at') ||
    message.includes('last_opened_at') ||
    message.includes('total_read_time_ms') ||
    message.includes('view_count') ||
    message.includes('delivery_target_type') ||
    message.includes('delivery_target_id') ||
    message.includes('address_home_id') ||
    message.includes('attn_user_id') ||
    message.includes('attn_label') ||
    message.includes('delivery_visibility') ||
    message.includes('mail_type') ||
    message.includes('display_title') ||
    message.includes('preview_text') ||
    message.includes('primary_action') ||
    message.includes('action_required') ||
    message.includes('ack_required') ||
    message.includes('ack_status') ||
    message.includes('recipient_type') ||
    message.includes('recipient_id') ||
    message.includes('address_id') ||
    message.includes('mail_extracted') ||
    message.includes('escrow_recipient_contact') ||
    message.includes('escrow_status') ||
    message.includes('escrow_expires_at') ||
    message.includes('escrow_claim_token'));

  if (!missingObjectColumns) {
    return primaryInsert;
  }

  const fallbackData = { ...mailData };
  delete fallbackData.sender_display;
  delete fallbackData.sender_trust;
  delete fallbackData.object_id;
  delete fallbackData.content_excerpt;
  delete fallbackData.delivery_target_type;
  delete fallbackData.delivery_target_id;
  delete fallbackData.address_home_id;
  delete fallbackData.attn_user_id;
  delete fallbackData.attn_label;
  delete fallbackData.delivery_visibility;
  delete fallbackData.mail_type;
  delete fallbackData.display_title;
  delete fallbackData.preview_text;
  delete fallbackData.primary_action;
  delete fallbackData.action_required;
  delete fallbackData.ack_required;
  delete fallbackData.ack_status;
  delete fallbackData.recipient_type;
  delete fallbackData.recipient_id;
  delete fallbackData.address_id;
  delete fallbackData.mail_extracted;
  delete fallbackData.escrow_recipient_contact;
  delete fallbackData.escrow_status;
  delete fallbackData.escrow_expires_at;
  delete fallbackData.escrow_claim_token;
  delete fallbackData.escrow_claim_token_hash;

  const fallbackInsert = await supabaseAdmin
    .from('Mail')
    .insert(fallbackData)
    .select()
    .single();

  return fallbackInsert;
};

const getMailObjectPayload = (objectId) => mailObjects.readPayload(objectId);

const getMailLinksSafely = async (mailId) => {
  const { data, error } = await supabaseAdmin
    .from('MailLink')
    .select('id, mail_item_id, target_type, target_id, created_by, status, created_at, updated_at')
    .eq('mail_item_id', mailId)
    .order('created_at', { ascending: false });

  if (error) {
    const message = error.message || '';
    if (
      error.code === 'PGRST205' ||
      message.includes('relation "MailLink" does not exist') ||
      message.includes('Could not find the table')
    ) {
      return [];
    }
    logger.warn('MailLink fetch failed', { mailId, error: error.message });
    return [];
  }

  return data || [];
};

const isMissingTableError = (error, tableName) => {
  const message = (error?.message || '').toLowerCase();
  return (
    error?.code === 'PGRST205' ||
    message.includes(`relation "${String(tableName).toLowerCase()}" does not exist`) ||
    message.includes('could not find the table')
  );
};

const getMailLinkByType = async (mailId, targetType) => {
  const { data, error } = await supabaseAdmin
    .from('MailLink')
    .select('id, mail_item_id, target_type, target_id, created_by, status, created_at, updated_at')
    .eq('mail_item_id', mailId)
    .eq('target_type', targetType)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error, 'MailLink')) {
      return null;
    }
    throw error;
  }

  return data || null;
};

const upsertMailLink = async ({
  mailId,
  targetType,
  targetId,
  createdBy = 'system'
}) => {
  const payload = {
    mail_item_id: mailId,
    target_type: targetType,
    target_id: targetId,
    created_by: createdBy,
    status: 'active'
  };

  const { data, error } = await supabaseAdmin
    .from('MailLink')
    .upsert(payload, {
      onConflict: 'mail_item_id,target_type,target_id',
      ignoreDuplicates: false
    })
    .select('id, mail_item_id, target_type, target_id, created_by, status, created_at, updated_at')
    .single();

  if (error) {
    if (isMissingTableError(error, 'MailLink')) {
      return null;
    }
    throw error;
  }

  return data || null;
};

const getExtractedObject = (mail) => {
  if (!mail || typeof mail.mail_extracted !== 'object' || mail.mail_extracted === null) {
    return {};
  }
  return mail.mail_extracted;
};

const pickExtractedString = (mail, keys) => {
  const extracted = getExtractedObject(mail);
  for (const key of keys) {
    const value = extracted?.[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
};

const pickExtractedNumber = (mail, keys) => {
  const extracted = getExtractedObject(mail);
  for (const key of keys) {
    const value = extracted?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
};

const pickExtractedDate = (mail, keys) => {
  const value = pickExtractedString(mail, keys);
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const createHomeBillFanoutTarget = async ({
  mail,
  homeId,
  senderId
}) => {
  // Prefer extracted amount, then fall back to payout_amount from compose flow
  const extractedAmount = pickExtractedNumber(mail, ['amount_due', 'amount', 'total', 'balance_due']);
  const amount = extractedAmount ?? (mail.payout_amount != null ? Number(mail.payout_amount) : 0);
  const billType =
    pickExtractedString(mail, ['bill_type', 'billType']) ||
    (mail.type === 'statement' ? 'statement' : 'other');
  const providerName =
    mail.sender_business_name ||
    pickExtractedString(mail, ['provider_name', 'providerName', 'payee', 'biller']);
  const currency = pickExtractedString(mail, ['currency']) || 'USD';
  const dueDate = pickExtractedDate(mail, ['due_date', 'dueDate', 'due_at', 'dueAt']);

  const { data, error } = await supabaseAdmin
    .from('HomeBill')
    .insert({
      home_id: homeId,
      bill_type: billType,
      provider_name: providerName || null,
      amount,
      currency,
      due_date: dueDate,
      details: {
        source: 'mailbox_fanout',
        sourceMailId: mail.id,
        sourceMailType: mail.type,
        sourceObjectId: mail.object_id || null,
        extracted: getExtractedObject(mail)
      },
      created_by: senderId
    })
    .select('id')
    .single();

  if (error) {
    if (isMissingTableError(error, 'HomeBill')) {
      return null;
    }
    throw error;
  }

  return data?.id || null;
};

const createHomeDocumentFanoutTarget = async ({
  mail,
  homeId,
  senderId
}) => {
  // HomeDocument_type_chk allows only HOME_DOCUMENT_TYPES; an unknown or missing
  // type is 'other' (it defaulted to 'mail_document', which failed every insert).
  const extractedDocType = pickExtractedString(mail, ['doc_type', 'docType']);
  const docType = HOME_DOCUMENT_TYPES.includes(extractedDocType) ? extractedDocType : 'other';
  const title = mail.display_title || mail.subject || 'Mailbox document';
  const mimeType = pickExtractedString(mail, ['mime_type', 'mimeType']);
  const sizeBytes = pickExtractedNumber(mail, ['size_bytes', 'sizeBytes']);

  const { data, error } = await supabaseAdmin
    .from('HomeDocument')
    .insert({
      home_id: homeId,
      doc_type: docType,
      title,
      mime_type: mimeType || null,
      size_bytes: sizeBytes,
      visibility: 'members',
      details: {
        source: 'mailbox_fanout',
        sourceMailId: mail.id,
        sourceMailType: mail.type,
        sourceObjectId: mail.object_id || null,
        attachments: Array.isArray(mail.attachments) ? mail.attachments : [],
        extracted: getExtractedObject(mail)
      },
      created_by: senderId
    })
    .select('id')
    .single();

  if (error) {
    if (isMissingTableError(error, 'HomeDocument')) {
      return null;
    }
    throw error;
  }

  return data?.id || null;
};

const createHomePackageFanoutTarget = async ({
  mail,
  homeId,
  senderId
}) => {
  const carrier = pickExtractedString(mail, ['carrier']);
  const trackingNumber = pickExtractedString(mail, ['tracking_number', 'trackingNumber']);
  const vendorName =
    mail.sender_business_name ||
    pickExtractedString(mail, ['vendor_name', 'vendorName', 'merchant']);
  const expectedAt = pickExtractedDate(mail, ['expected_at', 'expectedAt', 'delivery_date', 'deliveryDate']);

  const { data, error } = await supabaseAdmin
    .from('HomePackage')
    .insert({
      home_id: homeId,
      carrier: carrier || null,
      tracking_number: trackingNumber || null,
      vendor_name: vendorName || null,
      description: mail.display_title || mail.subject || mail.preview_text || null,
      delivery_instructions: `MAILBOX_FANOUT:${mail.id}`,
      expected_at: expectedAt,
      created_by: senderId
    })
    .select('id')
    .single();

  if (error) {
    if (isMissingTableError(error, 'HomePackage')) {
      return null;
    }
    throw error;
  }

  return data?.id || null;
};

const createHomeTaskFanoutTarget = async ({ mail, homeId, senderId }) => {
  const result = await homeRecordService.mutate({ homeId, actorId: senderId, kind: 'task', action: 'create',
    sourceMailId: mail.id, payload: { task_type: 'reminder', title: mail.display_title || mail.subject || 'Task from mail',
      description: mail.preview_text || mail.content_excerpt || null,
      due_at: pickExtractedDate(mail, ['due_date', 'dueDate', 'due_at', 'dueAt']),
      priority: mail.priority === 'urgent' ? 'urgent' : mail.priority === 'high' ? 'high' : 'medium', status: 'open' } });
  return result.record.id;
};

const autoFanoutMailTargets = async ({
  mail,
  homeId,
  senderId,
  outcomes: outcomesList,
  failed = [],
}) => {
  if (!mail || !homeId) return [];

  const rawType = String(mail.type || '').toLowerCase();
  const mailType = String(mail.mail_type || '').toLowerCase();
  const oc = Array.isArray(outcomesList) ? outcomesList : [];

  // Determine which fan-out targets to create based on type AND outcomes
  const targets = [];

  // A letter meant for one person (attn_only) creates no household record: a
  // HomeBill, HomeDocument, HomePackage or HomeTask is read by the household,
  // so the attention person keeps the letter in their mailbox instead.
  if (String(mail.delivery_visibility || '') === 'attn_only') {
    return [];
  }

  // Type-based fan-out
  if (rawType === 'bill' || rawType === 'statement' || mailType === 'bill' || oc.includes('pay_now')) {
    targets.push('bill');
  }
  if (rawType === 'package') {
    targets.push('package');
  }
  // A package letter's deliverable type is also 'packet'; its record is the
  // HomePackage, so only document letters and "save to records" add a HomeDocument.
  if (rawType === 'document' || (mailType === 'packet' && rawType !== 'package') || oc.includes('save_to_records')) {
    // Avoid duplicate if bill already covers document
    if (!targets.includes('document')) {
      targets.push('document');
    }
  }
  if (oc.includes('create_task')) {
    targets.push('task');
  }

  if (targets.length === 0) {
    return [];
  }

  const links = [];

  for (const targetType of targets) {
    // One failed target must not drop the others; the caller tells the sender
    // which ones failed instead of reporting a plain success.
    try {
      // Skip if link already exists for this target type
      const existingLink = await getMailLinkByType(mail.id, targetType);
      if (existingLink) {
        links.push(existingLink);
        continue;
      }

      let targetId = null;
      if (targetType === 'bill') {
        targetId = await createHomeBillFanoutTarget({ mail, homeId, senderId });
      } else if (targetType === 'document') {
        targetId = await createHomeDocumentFanoutTarget({ mail, homeId, senderId });
      } else if (targetType === 'package') {
        targetId = await createHomePackageFanoutTarget({ mail, homeId, senderId });
      } else if (targetType === 'task') {
        targetId = await createHomeTaskFanoutTarget({ mail, homeId, senderId });
      }

      if (!targetId) {
        failed.push(targetType);
        continue;
      }

      // A HomeTask records its letter itself (source_mail_id); MailLink has no
      // 'task' target type, so writing one failed after the task was created.
      if (targetType === 'task') {
        links.push({ target_type: 'task', target_id: targetId });
        continue;
      }

      const link = await upsertMailLink({
        mailId: mail.id,
        targetType,
        targetId,
        createdBy: 'system'
      });

      if (link) links.push(link);
    } catch (targetErr) {
      failed.push(targetType);
      logger.warn('Mailbox fanout target failed', { mailId: mail.id, homeId, targetType, error: targetErr.message });
    }
  }

  return links;
};

// ============ MAILBOX ROUTES ============

/**
 * GET /api/mailbox
 * Get user's inbox with filtering
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      type, 
      viewed, 
      archived = 'false',
      starred,
      limit = 50, 
      offset = 0,
      scope: rawScope,
      homeId: rawHomeId
    } = req.query;
    const scope = MAILBOX_SCOPES.includes(String(rawScope || '').toLowerCase())
      ? String(rawScope).toLowerCase()
      : 'personal';
    const homeId = rawHomeId ? String(rawHomeId) : null;

    if (homeId && !UUID_REGEX.test(homeId)) {
      return res.status(400).json({ error: 'Invalid homeId' });
    }

    const accessibleHomeIds = await getAccessibleHomeIds(userId);

    if (scope === 'home') {
      if (!homeId) {
        return res.status(400).json({ error: 'homeId is required when scope=home' });
      }
      if (!accessibleHomeIds.includes(homeId)) {
        // Someone who lives there but hasn't proven the address yet is told what opens it (D1).
        const homes = await mailHomesOrThrow(userId).catch(() => []);
        if (homes.some((h) => h.home_id === homeId.toLowerCase() && h.mail_access === 'needs_proof')) {
          return res.status(403).json(MAIL_HOME_NEEDS_PROOF);
        }
        return res.status(403).json({ error: "You can't open this home's mail.", code: 'MAIL_HOME_NOT_YOURS' });
      }
    }

    let query = supabaseAdmin
      .from('Mail')
      .select(`
        id,
        recipient_user_id,
        recipient_home_id,
        delivery_target_type,
        delivery_target_id,
        address_home_id,
        attn_user_id,
        attn_label,
        delivery_visibility,
        mail_type,
        display_title,
        preview_text,
        primary_action,
        action_required,
        ack_required,
        ack_status,
        recipient_type,
        recipient_id,
        address_id,
        mail_extracted,
        type,
        subject,
        content,
        sender_user_id,
        sender_entity_id,
        sender_display,
        sender_business_name,
        sender_trust,
        sender_address,
        viewed,
        viewed_at,
        archived,
        starred,
        payout_amount,
        payout_status,
        category,
        tags,
        priority,
        attachments,
        expires_at,
        created_at,
        delivered_at,
        special_delivery,
        sender:sender_user_id (
          id,
          username,
          name
        )
      `, { count: 'exact' })
      .eq('archived', archived === 'true')
      .order('delivered_at', { ascending: false })
      // Mail delivered together shares delivered_at; the id keeps the order the same on every page.
      .order('id', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    query = applyMailboxScopeToQuery(query, {
      scope,
      userId,
      homeId,
      accessibleHomeIds
    });

    // Apply filters
    if (type) {
      query = query.eq('type', type);
    }
    if (viewed !== undefined) {
      query = query.eq('viewed', viewed === 'true');
    }
    if (starred !== undefined) {
      query = query.eq('starred', starred === 'true');
    }

    // The summary counts (direct queries; MailboxSummary view may not exist) don't depend on
    // the page, so they're read alongside it.
    const countsRead = Promise.allSettled([
      applyMailboxScopeToQuery(
        supabaseAdmin.from('Mail').select('id', { count: 'exact', head: true }).eq('archived', false),
        { scope, userId, homeId, accessibleHomeIds }
      ),
      applyMailboxScopeToQuery(
        supabaseAdmin.from('Mail').select('id', { count: 'exact', head: true }).eq('viewed', false).eq('archived', false),
        { scope, userId, homeId, accessibleHomeIds }
      ),
      applyMailboxScopeToQuery(
        supabaseAdmin.from('Mail').select('id', { count: 'exact', head: true }).eq('starred', true),
        { scope, userId, homeId, accessibleHomeIds }
      ),
    ]);
    const [{ data: mail, error, count }, counts] = await Promise.all([query, countsRead]);

    if (error) {
      logger.error('Error fetching mailbox', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to fetch mailbox' });
    }

    let summary = {
      total_mail: 0,
      unread_count: 0,
      ad_count: 0,
      unread_ad_count: 0,
      starred_count: 0,
      total_earned: 0,
      pending_earnings: 0
    };

    try {
      const [totalRes, unreadRes, starredRes] = counts;

      summary.total_mail = totalRes.status === 'fulfilled' ? (totalRes.value.count || 0) : 0;
      summary.unread_count = unreadRes.status === 'fulfilled' ? (unreadRes.value.count || 0) : 0;
      summary.starred_count = starredRes.status === 'fulfilled' ? (starredRes.value.count || 0) : 0;
    } catch (e) {
      // Non-critical, proceed with zero summary
    }

    res.json({
      mail: presentMailSenders(await nameMailSenders(mail || [], userId), userId),
      summary,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: count || 0
      },
      scope,
      homeId: scope === 'home' ? homeId : null
    });

  } catch (err) {
    logger.error('Mailbox fetch error', { error: err.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to fetch mailbox' });
  }
});

// ============ PREFERENCES ROUTES ============

/**
 * GET /api/mailbox/preferences
 * Get user's mail preferences
 */
router.get('/preferences', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const prefs = await getUserPreferences(userId);

    if (!prefs) {
      return res.status(500).json({ error: 'Failed to fetch preferences' });
    }

    res.json({ preferences: prefs });

  } catch (err) {
    logger.error('Preferences fetch error', { error: err.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

/**
 * PATCH /api/mailbox/preferences
 * Update user's mail preferences
 */
router.patch('/preferences', verifyToken, validate(updatePreferencesSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = {
      ...req.body,
      updated_at: new Date().toISOString()
    };

    // Convert camelCase to snake_case
    const snakeCaseUpdates = {};
    for (const [key, value] of Object.entries(updates)) {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      snakeCaseUpdates[snakeKey] = value;
    }

    const { data: prefs, error } = await supabaseAdmin
      .from('MailPreferences')
      .upsert({
        user_id: userId,
        ...snakeCaseUpdates
      })
      .select()
      .single();

    if (error) {
      logger.error('Error updating preferences', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to update preferences' });
    }

    logger.info('Preferences updated', { userId });

    res.json({
      message: 'Preferences updated successfully',
      preferences: prefs
    });

  } catch (err) {
    logger.error('Preferences update error', { error: err.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

/**
 * GET /api/mailbox/sender-businesses
 * The businesses the signed-in user may send mail as, for compose's "Send as" picker (the list POST /send accepts).
 */
router.get('/sender-businesses', verifyToken, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    res.json({ businesses: await listSenderBusinesses(req.user.id) });
  } catch (err) {
    logger.error('Sender businesses fetch error', { error: err.message, userId: req.user.id });
    res.status(500).json({ error: "Couldn't load the businesses you can send as." });
  }
});

/**
 * GET /api/mailbox/deleted
 * Recently deleted: letters deleted in the last MAIL_RESTORE_DAYS that the
 * caller could see (their own, and Home letters the Home rule shows them),
 * newest first, with who deleted each and until when it can be restored.
 */
router.get('/deleted', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const accessibleHomeIds = await getAccessibleHomeIds(userId);
    const since = new Date(Date.now() - MAIL_RESTORE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from('Mail')
      .select('id, display_title, subject, preview_text, sender_business_name, sender_address, sender_user_id, sender_entity_id, sender_display, recipient_user_id, recipient_home_id, drawer, created_at, deleted_at, deleted_by')
      .not('deleted_at', 'is', null)
      .gte('deleted_at', since)
      .or(visibleMailFilter(userId, accessibleHomeIds))
      .order('deleted_at', { ascending: false })
      .limit(100);
    if (error) {
      logger.error('Error fetching deleted mail', { error: error.message, userId });
      return res.status(500).json({ error: "Couldn't load recently deleted mail." });
    }

    // Who deleted each one, by the name they show their household (a failed read names no one).
    const names = await localDisplayNames((rows || []).map((row) => row.deleted_by)).catch(() => new Map());

    res.json({
      mail: presentMailSenders(await nameMailSenders(rows || [], userId), userId).map((row) => ({
        ...row,
        deleted_by_name: names.get(String(row.deleted_by)) || null,
        deleted_by_me: row.deleted_by === userId,
        restorable_until: new Date(Date.parse(row.deleted_at) + MAIL_RESTORE_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      })),
    });
  } catch (err) {
    logger.error('Deleted mail fetch error', { error: err.message, userId: req.user?.id });
    res.status(500).json({ error: "Couldn't load recently deleted mail." });
  }
});

/**
 * GET /api/mailbox/:id
 * Get single mail item
 */
/**
 * GET /api/mailbox/campaigns
 * Get user's ad campaigns. Declared before GET /:id, which used to answer this path (Mail tab, SRV-3).
 */
router.get('/campaigns', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: campaigns, error } = await supabaseAdmin
      .from('AdCampaign')
      .select('*')
      .eq('business_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching campaigns', { error: error.message, userId });
      return res.status(500).json({ error: "Couldn't load your campaigns. Try again in a moment.", code: 'MAIL_UNAVAILABLE' });
    }

    res.json({ campaigns: campaigns || [] });

  } catch (err) {
    logger.error('Campaigns fetch error', { error: err.message, userId: req.user.id });
    res.status(500).json({ error: "Couldn't load your campaigns. Try again in a moment.", code: 'MAIL_UNAVAILABLE' });
  }
});

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: mail, error } = await supabaseAdmin
      .from('Mail')
      .select(`
        *,
        sender:sender_user_id (
          id,
          username,
          name
        )
      `)
      .eq('id', id)
      .single();

    // A deleted letter still opens for the members who could see it, so its
    // notice can offer Restore; a dismissed one says so too. A Home letter for
    // someone who hasn't proven the address answers 403 MAIL_HOME_NEEDS_PROOF;
    // anything else they can't open is not found (it doesn't say it exists).
    if (error || !mail || !(await canAccessMail(mail, userId, { includeDeleted: true }))) {
      return sendMailUnavailable(res, error ? null : mail, userId);
    }
    mail.removed = await removedMailInfo(mail);

    if (mail.object_id) {
      const objectData = await getMailObjectPayload(mail.object_id);
      if (objectData) {
        mail.object = objectData.metadata;
        const payloadBodyFormat = objectData.payload?.body?.payload?.bodyFormat;
        const payloadObjectFormat = objectData.payload?.objectFormat;
        const metadataFormat = objectData.metadata?.format;
        const contentFormatCandidate = [payloadBodyFormat, payloadObjectFormat, metadataFormat]
          .find((value) => typeof value === 'string' && CONTENT_RENDER_FORMATS.includes(value));
        mail.content_format = contentFormatCandidate || 'plain_text';

        if (objectData.payload) {
          const bodyContent =
            objectData.payload?.body?.content ||
            objectData.payload?.content;
          const objectAttachments =
            objectData.payload?.envelope?.attachments ||
            objectData.payload?.attachments;

          if (typeof bodyContent === 'string' && bodyContent.length > 0) {
            mail.content = bodyContent;
          }
          if ((!mail.attachments || mail.attachments.length === 0) && Array.isArray(objectAttachments)) {
            mail.attachments = objectAttachments;
          }
        }
      }
    } else {
      mail.content_format = mail.content?.includes('<') ? 'html' : 'plain_text';
    }
    mail.content_text = mailObjects.textContent(mail.content, mail.content_format);

    mail.links = await getMailLinksSafely(mail.id);
    // What the piece encloses, private ones included; each opens through GET /:id/enclosures/:enclosureId (SRV-4).
    mail.enclosures = mailEnclosures.listFor(mail, mail.attachments);

    // "Pantopus read this for you": the kept note, or one made now on this first open (never for a removed piece;
    // a failure leaves no note).
    if (!mail.removed && !mailPiece.summaryOf(mail)) {
      const note = await mailSummaries.ensureSummary(mail, userId);
      if (note) mail.mail_extracted = { ...(mail.mail_extracted || {}), summary: note.text };
      if (note && !mailPiece.keyFacts(mail.key_facts).length) mail.key_facts = note.key_facts;
    }

    const timeZone = (await mailDelivery.personTimeZone(userId)) || mailDelivery.FALLBACK_TIME_ZONE;
    res.json({ mail: await attachInvoices(await mailPiece.withBundleLabels(mailPiece.present(presentMailSender(await nameMailSender(mail, userId), userId), { timeZone }))) });

  } catch (err) {
    logger.error('Mail fetch error', { error: err.message, mailId: req.params.id });
    res.status(500).json({ error: "Couldn't open this mail. Try again in a moment.", code: 'MAIL_UNAVAILABLE' });
  }
});

/**
 * GET /api/mailbox/:id/enclosures/:enclosureId
 * A short-lived link to one enclosure of a piece the caller may read: { url, expires_at } (Mail tab, SRV-4). A
 * private enclosure's link is signed for a few minutes; ask again once it expires. An older piece's enclosure is its
 * address as it was stored (expires_at null).
 */
router.get('/:id/enclosures/:enclosureId', verifyToken, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    const userId = req.user.id;
    const { data: mail, error } = await supabaseAdmin.from('Mail').select('*').eq('id', req.params.id).maybeSingle();
    if (error || !mail || !(await canAccessMail(mail, userId))) {
      return sendMailUnavailable(res, error ? null : mail, userId);
    }
    let objectAttachments = null;
    if (mail.object_id) {
      const objectData = await getMailObjectPayload(mail.object_id);
      objectAttachments = objectData?.payload?.envelope?.attachments || objectData?.payload?.attachments || null;
    }
    const link = await mailEnclosures.linkFor(mail, req.params.enclosureId, objectAttachments);
    if (!link) {
      return res.status(404).json({ error: "This letter doesn't have that enclosure.", code: 'ENCLOSURE_NOT_FOUND' });
    }
    return res.json(link);
  } catch (err) {
    logger.error('Enclosure link error', { error: err.message, mailId: req.params.id });
    return res.status(503).json({ error: "Couldn't open this file just now. Try again in a moment.", code: 'ENCLOSURE_UNAVAILABLE' });
  }
});

router.get('/:id/links', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: mail, error: fetchError } = await supabaseAdmin
      .from('Mail')
      .select('id, recipient_user_id, recipient_home_id')
      .eq('id', id)
      .single();

    if (fetchError || !mail) {
      return res.status(404).json({ error: 'Mail not found' });
    }

    const allowed = await canAccessMail(mail, userId);
    if (!allowed) {
      return res.status(403).json({ error: 'You do not have access to this mail' });
    }

    const links = await getMailLinksSafely(id);
    res.json({ links });
  } catch (err) {
    logger.error('Mail link fetch error', { error: err.message, mailId: req.params.id });
    res.status(500).json({ error: 'Failed to fetch mail links' });
  }
});

router.post('/:id/links', verifyToken, validate(createMailLinkSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { targetType, targetId, createdBy = 'user' } = req.body;

    const { data: mail, error: fetchError } = await supabaseAdmin
      .from('Mail')
      .select('id, recipient_user_id, recipient_home_id')
      .eq('id', id)
      .single();

    if (fetchError || !mail) {
      return res.status(404).json({ error: 'Mail not found' });
    }

    const allowed = await canAccessMail(mail, userId);
    if (!allowed) {
      return res.status(403).json({ error: 'You do not have access to this mail' });
    }

    const link = await upsertMailLink({
      mailId: id,
      targetType,
      targetId,
      createdBy
    });

    if (!link) {
      return res.status(503).json({ error: 'MailLink migration not applied yet' });
    }

    res.status(201).json({
      message: 'Mail link created',
      link
    });
  } catch (err) {
    logger.error('Mail link create error', { error: err.message, mailId: req.params.id, userId: req.user.id });
    res.status(500).json({ error: 'Failed to create mail link' });
  }
});

/**
 * GET /api/mailbox/:id/object
 * Get object metadata + payload for a single mail item
 */
router.get('/:id/object', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: mail, error } = await supabaseAdmin
      .from('Mail')
      .select('id, object_id, recipient_user_id, recipient_home_id, sender_user_id, sender_entity_id, sender_business_name')
      .eq('id', id)
      .single();

    if (error || !mail) {
      return res.status(404).json({ error: 'Mail not found' });
    }

    const allowed = await canAccessMail(mail, userId);
    if (!allowed) {
      return res.status(403).json({ error: 'You do not have access to this mail' });
    }

    if (!mail.object_id) {
      return res.status(404).json({ error: 'No digital object found for this mail' });
    }

    const objectData = await getMailObjectPayload(mail.object_id);
    if (!objectData) {
      return res.status(404).json({ error: 'Mail object not found' });
    }

    // A letter sent as a business: see presentMailSender.
    const hideSender = sentAsBusiness(mail) && String(mail.sender_user_id) !== String(userId);
    res.json({
      object: hideSender ? objectForRecipient(objectData.metadata, mail.sender_entity_id || null) : objectData.metadata,
      payload: hideSender ? payloadForRecipient(objectData.payload, mail.sender_entity_id || null) : objectData.payload
    });
  } catch (err) {
    logger.error('Mail object fetch error', { error: err.message, mailId: req.params.id });
    res.status(500).json({ error: 'Failed to fetch mail object' });
  }
});

/**
 * POST /api/mailbox/send
 * Send mail (letter, ad, notice, etc)
 */
router.post('/send', verifyToken, validate(sendMailSchema), async (req, res) => {
  try {
    const senderId = req.user.id;
    let normalizedPayload;

    try {
      normalizedPayload = normalizeSendMailPayload(req.body, senderId);
    } catch (normalizeErr) {
      return res.status(400).json({ error: normalizeErr.message || "This mail can't be sent as it is. Check it and try again.", code: 'MAIL_SEND_INVALID' });
    }

    const {
      recipientUserId,
      recipientHomeId,
      deliveryTargetType,
      deliveryTargetId,
      addressHomeId,
      attnUserId,
      attnLabel,
      deliveryVisibility,
      deliverableType,
      displayTitle,
      previewText,
      primaryAction,
      actionRequired,
      ackRequired,
      ackStatus,
      extractedData,
      outcomes,
      type,
      subject,
      content,
      attachments,
      senderBusinessName: requestedSenderBusinessName,
      senderAddress,
      payoutAmount,
      category,
      tags,
      priority,
      expiresAt,
      objectPayload
    } = normalizedPayload;

    // Resolve sender identity once for consistent storage/display.
    // The client's senderBusinessName is only a request: see resolveSenderBusiness.
    const senderBusiness = await resolveSenderBusiness(senderId, requestedSenderBusinessName);
    const senderBusinessName = senderBusiness ? senderBusiness.name : null;
    objectPayload.envelope.senderBusinessName = senderBusinessName;
    // A letter in the sender's own name names them as neighbors see them (their Local Profile), in the email or text
    // and the notices it sends and in sender_display; the mailbox names the sender again whenever the letter is read.
    const senderPerson = senderBusinessName ? null : (await loadChatPeople([senderId])).get(String(senderId));
    const senderDisplayName = (senderBusinessName || senderPerson?.displayName || 'Someone').trim();
    const senderTrust = senderBusiness?.verified ? 'verified_business' : 'pantopus_user';

    // A person writes letters: nobody can dress one up as a bill or notice, give it a made-up return address, or
    // pay for it to be read (an ad's payout). Those come from a business.
    if (!senderBusiness) {
      if (!PERSON_MAIL_TYPES.has(type)) {
        return res.status(400).json({ error: 'Only a business can send bills, notices or ads.', code: 'MAIL_TYPE_NOT_ALLOWED' });
      }
      if (payoutAmount) {
        return res.status(400).json({ error: 'Only a business can pay people to read its mail.', code: 'MAIL_PAYOUT_NOT_ALLOWED' });
      }
    }
    const senderReturnAddress = senderBusiness ? (senderAddress || null) : null;
    objectPayload.envelope.senderAddress = senderReturnAddress;

    // ── Non-user escrow path ──────────────────────────────────
    const escrowContact = normalizeEscrowContact(req.body.recipientEmail || req.body.recipientPhone || null);
    const isEscrowSend = escrowContact && !recipientUserId && !recipientHomeId;

    const senderHasVerifiedHome = await hasVerifiedSenderHome(senderId);
    if (!senderHasVerifiedHome) {
      logger.info('Mailbox send blocked: sender home verification required', {
        senderId,
        recipientUserId: recipientUserId || null,
        recipientHomeId: recipientHomeId || null,
        addressHomeId: addressHomeId || null,
        deliveryTargetType: deliveryTargetType || null,
      });
      return sendHomeVerificationRequired(res);
    }

    if (isEscrowSend) {
      // Launch cuts #8 and #10: a letter to someone who isn't on Pantopus is a surface of both, and its page
      // (web /open) is hidden until both are on.
      if (!areLaunchFeaturesEnabled(['mailbox', 'mail_extras'])) {
        return res.status(403).json({ error: 'This isn\u2019t available yet.', code: 'MAIL_EXTRAS_UNAVAILABLE' });
      }

      // Pantopus emails or texts the person about it, so only a letter goes to someone who isn't on Pantopus: never
      // an ad, bill, notice or promotion to an address the sender typed in.
      if (type !== 'letter') {
        return res.status(400).json({ error: 'Only a letter can go to someone who isn’t on Pantopus yet.', code: 'MAIL_TYPE_NOT_ALLOWED' });
      }

      // Rate limit check
      const rateCheck = await checkEscrowRateLimits(senderId, escrowContact);
      if (!rateCheck.allowed) {
        return res.status(429).json({ error: rateCheck.reason, code: 'MAIL_SEND_LIMIT' });
      }

      // Generate unique claim token
      const escrowClaimToken = crypto.randomBytes(32).toString('hex');
      const escrowExpiresAt = new Date(Date.now() + ESCROW_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

      // Create mail object (S3) if applicable
      let objectResult = null;
      try {
        objectResult = await createMailObject({ senderId, businessId: senderBusiness?.id || null, objectPayload });
      } catch (objectErr) {
        logger.warn('Escrow mail object creation fallback to inline', { senderId, error: objectErr.message });
      }

      const contentExcerpt = buildMailExcerpt(content);

      const escrowMailData = {
        recipient_user_id: null,
        recipient_home_id: null,
        sender_user_id: senderId,
        // The business the letter is from (null: the sender's own letter); recipients see it, never the person.
        sender_entity_id: senderBusiness?.id || null,
        sender_display: senderDisplayName,
        sender_trust: senderTrust,
        sender_business_name: senderBusinessName || null,
        sender_address: senderReturnAddress,
        type,
        subject: subject || null,
        // Search uses this existing text column; the private object remains the
        // authoritative formatted letter. Keep previews in their own columns.
        content,
        attachments: attachments || [],
        payout_amount: payoutAmount || null,
        category: category || null,
        tags: tags || [],
        priority: priority || 'normal',
        expires_at: expiresAt || null,
        object_id: objectResult?.objectId || null,
        content_excerpt: contentExcerpt,
        mail_type: deliverableType,
        display_title: displayTitle || null,
        preview_text: previewText || contentExcerpt,
        primary_action: primaryAction || 'open',
        action_required: actionRequired,
        ack_required: ackRequired,
        ack_status: ackStatus,
        delivery_target_type: null,
        delivery_target_id: null,
        recipient_type: null,
        recipient_id: null,
        address_id: null,
        address_home_id: null,
        attn_user_id: null,
        attn_label: null,
        delivery_visibility: null,
        // NOT NULL DEFAULT '{}': null failed the insert.
        mail_extracted: extractedData || {},
        // Escrow-specific fields
        escrow_recipient_contact: escrowContact,
        escrow_status: 'pending',
        escrow_expires_at: escrowExpiresAt,
        escrow_claim_token_hash: hashClaimToken(escrowClaimToken),
      };

      const { data: escrowMail, error: escrowError } = await insertMailWithCompatibility(escrowMailData);

      if (escrowError) {
        logger.error('Error creating escrowed mail', { error: escrowError.message, senderId });
        return res.status(500).json({ error: "Couldn't send this mail. Try again in a moment.", code: 'MAIL_UNAVAILABLE' });
      }

      // The recipient's email address or phone number stays out of the log.
      logger.info('Escrowed mail created', {
        mailId: escrowMail.id,
        type,
        senderId,
        escrowExpiresAt,
      });

      // ── Notify non-user recipient (non-blocking) ────────────
      const claimLink = escrowClaimLink(escrowMail.id, escrowClaimToken);
      (async () => {
        // Launch cuts #8 and #10: no email or text about a letter goes to anyone while writing letters
        // (mail_extras) or the mailbox is off.
        if (skipForLaunchCut(['mailbox', 'mail_extras'], 'escrowLetterNotice')) return;
        try {
          if (req.body.recipientEmail) {
            const sent = await emailService.sendLetterWaitingEmail({
              toEmail: escrowContact,
              senderName: senderDisplayName,
              claimLink,
              expiresAt: escrowExpiresAt,
            });
            if (!sent?.success) {
              logger.warn('Escrow letter email not delivered', { mailId: escrowMail.id, error: sent?.error || null });
            }
          } else {
            const until = new Date(escrowExpiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
            await smsService.sendSms({
              to: escrowContact,
              body: `${senderDisplayName} sent you a letter on Pantopus. Open it by ${until}: ${claimLink}`,
            });
          }
        } catch (notifErr) {
          logger.warn('Escrow notification failed (non-blocking)', {
            error: notifErr.message,
            mailId: escrowMail.id,
          });
        }
      })();

      return res.status(201).json({
        message: 'Mail sent successfully (escrowed for non-user recipient)',
        mail: {
          id: escrowMail.id,
          type: escrowMail.type,
          subject: escrowMail.subject,
          mailType: escrowMail.mail_type || null,
          displayTitle: escrowMail.display_title || escrowMail.subject || null,
          previewText: escrowMail.preview_text || null,
          primaryAction: escrowMail.primary_action || null,
          actionRequired: Boolean(escrowMail.action_required),
          escrowStatus: 'pending',
          escrowExpiresAt: escrowExpiresAt,
          createdAt: escrowMail.created_at,
          objectId: objectResult?.objectId || escrowMail.object_id || null,
        },
      });
    }

    // Launch cut #8 (Mail extras): writing to someone else is a mail extra. With it off, the only letters anyone
    // sends go to themself or to their own Home with nobody else's name on it (the residency letter's copy).
    const otherPeople = [...new Set([recipientUserId, attnUserId].filter((id) => id && id !== senderId))];
    if (otherPeople.length && !areLaunchFeaturesEnabled('mail_extras')) {
      return res.status(403).json({ error: 'This isn’t available yet.', code: 'MAIL_EXTRAS_UNAVAILABLE' });
    }

    // Nobody mails a person who blocked them, or whom they blocked.
    for (const otherUserId of otherPeople) {
      try {
        if (await isBlocked(senderId, otherUserId)) {
          return res.status(403).json({ error: 'You can’t send mail to this person.', code: 'MAIL_RECIPIENT_BLOCKED' });
        }
      } catch (blockErr) {
        if (blockErr.code !== 'BLOCK_CHECK_UNAVAILABLE') throw blockErr;
        return res.status(503).json({ error: blockErr.message, code: blockErr.code });
      }
    }

    // Validate recipient exists
    if (recipientUserId) {
      const { data: user } = await supabaseAdmin
        .from('User')
        .select('id')
        .eq('id', recipientUserId)
        .single();

      if (!user) {
        return res.status(404).json({ error: 'We couldn\u2019t find that person. They may have deactivated their account.', code: 'MAIL_RECIPIENT_NOT_FOUND' });
      }
    }

    let addressHome = null;
    if (addressHomeId) {
      const homeAccess = await hasHomeAccess(addressHomeId, senderId);
      if (!homeAccess.home) {
        return res.status(404).json({ error: 'That home address wasn\u2019t found. It may have been removed.', code: 'MAIL_HOME_NOT_FOUND' });
      }
      if (!homeAccess.allowed) {
        logger.info('Mailbox send blocked: destination address not allowed', {
          senderId,
          addressHomeId,
          recipientUserId: recipientUserId || null,
          deliveryTargetType: deliveryTargetType || null,
        });
        return res.status(403).json({
          error: 'You don\u2019t have permission to send mail to this address.',
          code: 'MAILBOX_DESTINATION_ADDRESS_FORBIDDEN',
        });
      }
      addressHome = homeAccess.home;
    }

    if (recipientHomeId && !addressHomeId) {
      const homeAccess = await hasHomeAccess(recipientHomeId, senderId);
      if (!homeAccess.home) {
        return res.status(404).json({ error: 'That home wasn\u2019t found. It may have been removed.', code: 'MAIL_HOME_NOT_FOUND' });
      }
      if (!homeAccess.allowed) {
        logger.info('Mailbox send blocked: destination home not allowed', {
          senderId,
          recipientHomeId,
          recipientUserId: recipientUserId || null,
          deliveryTargetType: deliveryTargetType || null,
        });
        return res.status(403).json({
          error: 'You don\u2019t have permission to send mail to this home.',
          code: 'MAILBOX_DESTINATION_HOME_FORBIDDEN',
        });
      }
      addressHome = homeAccess.home;
    }

    if (deliveryTargetType === 'user' && addressHomeId && recipientUserId) {
      const linkedToHome = await isUserLinkedToHome(addressHome, recipientUserId);
      if (!linkedToHome) {
        return res.status(400).json({
          error: 'That person doesn\u2019t live at the selected home address.',
          code: 'MAIL_RECIPIENT_NOT_AT_HOME',
        });
      }
    }

    // A Home letter's attention person must be able to open this Home's mail
    // (the Home mail rule). Otherwise an attn_only letter was stored for nobody,
    // or failed the attention foreign key when the person's account was gone.
    if (deliveryTargetType === 'home' && attnUserId) {
      const attnHomeIds = await trustedHomeIdsOrThrow(attnUserId);
      if (!addressHome || !attnHomeIds.includes(addressHome.id)) {
        return res.status(400).json({
          error: 'That person doesn\u2019t live at the selected home address.',
          code: 'MAIL_RECIPIENT_NOT_AT_HOME',
        });
      }
    }

    // Check user preferences if sending ad
    if (type === 'ad' && recipientUserId) {
      const prefs = await getUserPreferences(recipientUserId);
      if (prefs && !prefs.receive_ads) {
        return res.status(400).json({ error: 'This person has opted out of receiving ads.', code: 'MAIL_ADS_OPTED_OUT' });
      }
    }

    let objectResult = null;
    try {
      objectResult = await createMailObject({
        senderId,
        businessId: senderBusiness?.id || null,
        objectPayload
      });
    } catch (objectErr) {
      logger.warn('Mail object creation fallback to inline', {
        senderId,
        error: objectErr.message
      });
    }

    const contentExcerpt = buildMailExcerpt(content);

    const mailData = {
      recipient_user_id: recipientUserId || null,
      recipient_home_id: recipientHomeId || null,
      sender_user_id: senderId,
      // The business the letter is from (null: the sender's own letter); recipients see it, never the person.
      sender_entity_id: senderBusiness?.id || null,
      sender_display: senderDisplayName,
      sender_trust: senderTrust,
      sender_business_name: senderBusinessName || null,
      sender_address: senderReturnAddress,
      type,
      subject: subject || null,
      content,
      attachments: attachments || [],
      payout_amount: payoutAmount || null,
      category: category || null,
      tags: tags || [],
      priority: priority || 'normal',
      expires_at: expiresAt || null,
      object_id: objectResult?.objectId || null,
      content_excerpt: contentExcerpt,
      mail_type: deliverableType,
      display_title: displayTitle || null,
      preview_text: previewText || contentExcerpt,
      primary_action: primaryAction || 'open',
      action_required: actionRequired,
      ack_required: ackRequired,
      ack_status: ackStatus,
      delivery_target_type: deliveryTargetType,
      delivery_target_id: deliveryTargetId,
      recipient_type: deliveryTargetType,
      recipient_id: deliveryTargetId,
      // Mail for a Home is Home mail. Left to the column default ('personal'), a household letter had no personal
      // recipient and sat outside the Home drawer, so the Mailbox drawers (native apps) listed it for nobody.
      drawer: deliveryTargetType === 'home' ? 'home' : 'personal',
      address_id: addressHomeId || recipientHomeId || null,
      address_home_id: addressHomeId || recipientHomeId || null,
      attn_user_id: attnUserId || null,
      attn_label: attnLabel || null,
      delivery_visibility: deliveryVisibility || null,
      // The column is NOT NULL DEFAULT '{}'. null failed the insert, and the
      // compatibility retry then stored the letter without its sender, delivery,
      // attention and visibility fields.
      mail_extracted: extractedData || {}
    };

    const { data: mail, error } = await insertMailWithCompatibility(mailData);

    if (error) {
      logger.error('Error sending mail', { error: error.message, senderId });
      return res.status(500).json({ error: "Couldn't send this mail. Try again in a moment.", code: 'MAIL_UNAVAILABLE' });
    }

    let fanoutLinks = [];
    const fanoutFailed = [];
    const fanoutHomeId = addressHomeId || recipientHomeId || null;
    // Fan out for home-targeted mail, or for user-targeted mail with outcome-based
    // fan-out triggers (save_to_records, create_task, pay_now) when a home is known
    const hasOutcomeFanout = outcomes.some(o =>
      ['save_to_records', 'create_task', 'pay_now'].includes(o)
    );
    const shouldAutoFanout = fanoutHomeId && (
      (deliveryTargetType === 'home') || hasOutcomeFanout
    );
    if (shouldAutoFanout) {
      try {
        fanoutLinks = await autoFanoutMailTargets({
          mail,
          homeId: fanoutHomeId,
          senderId,
          outcomes,
          failed: fanoutFailed,
        });
      } catch (fanoutErr) {
        fanoutFailed.push('home_records');
        logger.warn('Mailbox fanout failed', {
          mailId: mail.id,
          senderId,
          homeId: fanoutHomeId,
          error: fanoutErr.message
        });
      }
    }

    logger.info('Mail sent', {
      mailId: mail.id,
      type,
      senderId,
      recipientUserId,
      recipientHomeId,
      addressHomeId: addressHomeId || recipientHomeId || null,
      deliveryTargetType,
      fanoutLinkCount: fanoutLinks.length
    });

    // ── Notify recipient (non-blocking) ──────────────────────
    // Determine who to notify: the attn user, the direct recipient, or
    // all household members for home-targeted mail.
    const tracking = normalizedPayload.objectPayload?.tracking || {};
    const mailIntent = tracking.mailIntent || null;

    // ── Log compose analytics event (non-blocking) ──────────
    const composePayload = normalizedPayload.objectPayload?.body?.payload || {};
    logMailEvent('mail_composed_send', mail.id, senderId, {
      mailType: type,
      mailIntent,
      ceremonyTier: tracking.ceremonyTier || null,
      hasVoicePostscript: Boolean(composePayload.voicePostscriptUri),
      hasPhoto: Array.isArray(attachments) && attachments.some(a => /\.(jpe?g|png|gif|webp|heic)$/i.test(a)),
      outcomeTypes: outcomes,
      recipientIsOnPantopus: Boolean(recipientUserId),
      inkSelection: composePayload.inkSelection || null,
      stationeryTheme: composePayload.stationeryTheme || null,
    });

    // Fire-and-forget: fetch sender name + home address, then notify. Only a
    // special delivery is told now; a piece in the morning round is told in
    // the morning notice with the rest of that day's mail (SRV-1).
    (async () => {
      try {
        if (!mail.special_delivery) return;
        const senderName = senderDisplayName;

        // Fetch home address if available
        let homeAddress = null;
        const homeId = addressHomeId || recipientHomeId;
        if (homeId) {
          const { data: home } = await supabaseAdmin
            .from('Home')
            .select('city, state')
            .eq('id', homeId)
            .single();
          if (home) {
            homeAddress = [home.city, home.state].filter(Boolean).join(', ');
          }
        }

        // Extract vendor name (for package_pickup, stored in subject)
        const vendorName = mailIntent === 'package_pickup' ? (subject || null) : null;

        // Determine notification recipients
        const notifyUserIds = [];

        if (deliveryTargetType === 'home' && (addressHomeId || recipientHomeId)) {
          // Home-targeted mail: notify the household members, except the
          // sender, who may open this letter (canAccessMail: a trusted member
          // whom the Home mail rule shows it; M01). The notice carries the
          // sender and, for a bill, the amount.
          const { data: occupants } = await supabaseAdmin
            .from('HomeOccupancy')
            .select('user_id')
            .eq('home_id', addressHomeId || recipientHomeId)
            .eq('is_active', true);

          if (occupants) {
            for (const occ of occupants) {
              if (occ.user_id !== senderId && await canAccessMail(mail, occ.user_id)) {
                notifyUserIds.push(occ.user_id);
              }
            }
          }
        } else if (recipientUserId && recipientUserId !== senderId) {
          notifyUserIds.push(recipientUserId);
        }

        // Send notification to each recipient
        for (const userId of notifyUserIds) {
          await notificationService.notifyMailDelivered({
            recipientUserId: userId,
            senderName,
            mailId: mail.id,
            mailIntent,
            mailType: type,
            address: homeAddress,
            amount: payoutAmount != null ? payoutAmount : undefined,
            vendorName,
            special: true,
          });
        }
      } catch (notifErr) {
        logger.warn('Mail delivery notification failed (non-blocking)', {
          error: notifErr.message,
          mailId: mail.id,
        });
      }
    })();

    res.status(201).json({
      message: 'Mail sent successfully',
      fanoutLinks,
      // Home records (bill, document, package, task) the letter was meant to add but could not.
      fanoutFailed,
      mail: {
        id: mail.id,
        type: mail.type,
        subject: mail.subject,
        mailType: mail.mail_type || null,
        displayTitle: mail.display_title || mail.subject || null,
        previewText: mail.preview_text || null,
        primaryAction: mail.primary_action || null,
        actionRequired: Boolean(mail.action_required),
        recipientUserId: mail.recipient_user_id,
        recipientHomeId: mail.recipient_home_id,
        addressHomeId: mail.address_home_id || null,
        deliveryTargetType: mail.delivery_target_type || null,
        deliveryTargetId: mail.delivery_target_id || null,
        attnUserId: mail.attn_user_id || null,
        attnLabel: mail.attn_label || null,
        deliveryVisibility: mail.delivery_visibility || null,
        // The business the letter went out as (null: the sender's own name), so compose can tell a dropped choice.
        senderBusinessName: mail.sender_business_name || null,
        links: fanoutLinks,
        createdAt: mail.created_at,
        objectId: objectResult?.objectId || mail.object_id || null
      }
    });

  } catch (err) {
    logger.error('Mail send error', { error: err.message, userId: req.user.id });
    res.status(500).json({ error: "Couldn't send this mail. Try again in a moment.", code: 'MAIL_UNAVAILABLE' });
  }
});

// ============================================================
// ESCROW CLAIM ENDPOINTS
// ============================================================

/**
 * GET /api/mailbox/claim/:mailId?token=…
 * Public (no sign-in): what the link in a letter's email or text opens (the web app's /open/:mailId page). It shows
 * who the letter is from and its preview, never the letter itself, which the person reads once it is in their
 * mailbox (POST /claim/:mailId). A letter sent as a business shows the business, never the person who sent it.
 */
router.get('/claim/:mailId', async (req, res) => {
  try {
    const { mailId } = req.params;
    const { token } = req.query;
    if (!UUID_REGEX.test(mailId) || typeof token !== 'string' || !token) return sendClaimLinkInvalid(res);

    const { data: mail, error } = await supabaseAdmin
      .from('Mail')
      .select('id, sender_user_id, sender_entity_id, sender_business_name, sender_display, sender_trust, type, subject, content_excerpt, preview_text, display_title, mail_type, primary_action, ack_required, escrow_recipient_contact, escrow_status, escrow_claim_token, escrow_claim_token_hash, escrow_expires_at, created_at')
      .eq('id', mailId)
      .maybeSingle();
    if (error) {
      logger.error('Escrow claim preview read failed', { error: error.message, mailId });
      return res.status(500).json({ error: 'Failed to open this letter' });
    }
    if (!mail || !claimTokenMatches(mail, token)) return sendClaimLinkInvalid(res);

    const closed = closedEscrowReason(mail);
    if (closed) return res.status(closed.status).json({ error: closed.error, code: closed.code });

    let sender;
    if (sentAsBusiness(mail)) {
      sender = { ...claimPageSender(mail), senderKind: 'business' };
    } else {
      // The sender as neighbors see them (their Local Profile), like the email that brought the person here.
      const person = (await loadChatPeople([mail.sender_user_id])).get(String(mail.sender_user_id));
      sender = {
        senderName: person?.displayName || mail.sender_display || 'A neighbor',
        // A personal letter needs a verified home to be sent (POST /send); this says whether the sender still has one.
        senderVerified: await hasVerifiedSenderHome(mail.sender_user_id),
        senderKind: 'person',
      };
    }

    // Build outcome description
    let outcomeDescription = null;
    if (mail.primary_action === 'pay' || mail.mail_type === 'bill') {
      outcomeDescription = 'Payment requested';
    } else if (mail.ack_required) {
      outcomeDescription = 'Acknowledgement required';
    }

    // The preview (140 characters) ends at a whole word, with an ellipsis when the letter goes on.
    let previewText = mail.preview_text || mail.content_excerpt || null;
    if (previewText && (mail.content_excerpt || '').length > previewText.length) {
      previewText = `${previewText.replace(/\s+\S*$/, '')}…`;
    }

    return res.json({
      mail: {
        id: mail.id,
        senderName: sender.senderName,
        senderVerified: sender.senderVerified,
        senderKind: sender.senderKind,
        subject: mail.subject || mail.display_title || null,
        previewText,
        mailType: mail.mail_type || mail.type || null,
        outcomeDescription,
        // The address or number to sign in with, masked as in the sender's expiry notice.
        sentTo: maskContact(mail.escrow_recipient_contact || ''),
        createdAt: mail.created_at,
        expiresAt: mail.escrow_expires_at,
      },
    });
  } catch (err) {
    logger.error('Escrow claim preview error', { error: err.message, mailId: req.params.mailId });
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/mailbox/claim/:mailId  { token }
 * The signed-in person the letter was sent to puts it in their mailbox: their account's email (or phone number) must
 * be the one the sender typed. The letter arrives as their own, and the sender is told it was opened.
 */
router.post('/claim/:mailId', verifyToken, async (req, res) => {
  try {
    const { mailId } = req.params;
    const token = req.body?.token;
    const claimerId = req.user.id;
    if (!UUID_REGEX.test(mailId) || typeof token !== 'string' || !token) return sendClaimLinkInvalid(res);

    const { data: mail, error } = await supabaseAdmin
      .from('Mail')
      .select('id, sender_user_id, type, subject, mail_type, display_title, escrow_recipient_contact, escrow_status, escrow_claim_token, escrow_claim_token_hash, escrow_expires_at')
      .eq('id', mailId)
      .maybeSingle();
    if (error) {
      logger.error('Escrow claim read failed', { error: error.message, mailId });
      return res.status(500).json({ error: 'Failed to claim mail' });
    }
    if (!mail || !claimTokenMatches(mail, token)) return sendClaimLinkInvalid(res);

    const closed = closedEscrowReason(mail);
    if (closed) {
      if (closed.code === 'MAIL_EXPIRED' && mail.escrow_status === 'pending') {
        await supabaseAdmin
          .from('Mail')
          .update({ escrow_status: 'expired' })
          .eq('id', mailId)
          .eq('escrow_status', 'pending');
      }
      return res.status(closed.status).json({ error: closed.error, code: closed.code });
    }

    if (String(mail.sender_user_id) === String(claimerId)) {
      return res.status(400).json({ error: 'You sent this letter. It’s waiting for the person you wrote to.', code: 'MAIL_OWN_LETTER' });
    }

    // Profile contact fields are editable without proof. Only Auth-confirmed contacts establish ownership.
    const { data: authData, error: claimerError } = await supabaseAdmin.auth.admin.getUserById(claimerId);
    const claimer = authData?.user;
    if (claimerError || !claimer) {
      logger.error('Escrow claimer read failed', { error: claimerError?.message || 'no Auth user', mailId });
      return res.status(500).json({ error: 'Failed to claim mail' });
    }

    const escrowContact = normalizeEscrowContact(mail.escrow_recipient_contact);
    const contactMatches = Boolean(escrowContact) && (
      (claimer.email_confirmed_at && claimer.email && normalizeEscrowContact(claimer.email) === escrowContact) ||
      (claimer.phone_confirmed_at && claimer.phone && normalizeEscrowContact(claimer.phone) === escrowContact));

    if (!contactMatches) {
      return res.status(403).json({
        error: 'This letter was sent to a different email address or phone number. Sign in with the account that uses it.',
        code: 'MAIL_CONTACT_MISMATCH',
      });
    }

    // ── Claim the mail ─────────────────────────────────────────
    // It arrives as the claimer's own letter, for them alone (Personal drawer, attention only), not as mail for
    // everyone at their Home.
    const { data: updatedRows, error: updateError } = await supabaseAdmin
      .from('Mail')
      .update({
        escrow_status: 'claimed',
        recipient_user_id: claimerId,
        recipient_home_id: null,
        delivery_target_type: 'user',
        delivery_target_id: claimerId,
        recipient_type: 'user',
        recipient_id: claimerId,
        attn_user_id: claimerId,
        delivery_visibility: 'attn_only',
        drawer: 'personal',
        lifecycle: 'delivered',
        delivered_at: new Date().toISOString(),
      })
      .eq('id', mailId)
      .eq('escrow_status', 'pending')
      .select('id');

    if (updateError) {
      logger.error('Escrow claim update failed', { error: updateError.message, mailId });
      return res.status(500).json({ error: 'Failed to claim mail' });
    }

    if (!updatedRows || updatedRows.length === 0) {
      return res.status(409).json({ error: 'This letter has already been added to a mailbox.', code: 'MAIL_CLAIMED' });
    }

    logger.info('Escrowed mail claimed', { mailId, claimerId });

    // Notify the sender that their mail was claimed
    (async () => {
      try {
        // The person who opened it, as neighbors see them (their Local Profile).
        const claimerName = (await loadChatPeople([claimerId])).get(String(claimerId))?.displayName || 'Someone';

        await notificationService.createNotification({
          userId: mail.sender_user_id,
          type: 'mail_escrow_claimed',
          title: 'Your mail was opened',
          body: `${claimerName} claimed your letter. It's been delivered to their mailbox.`,
          icon: '✉️',
          link: `/app/mailbox/${mailId}`,
          metadata: { mail_id: mailId, claimer_id: claimerId },
        });
      } catch (notifErr) {
        logger.warn('Escrow claim notification failed', { error: notifErr.message, mailId });
      }
    })();

    return res.json({
      message: 'Mail claimed successfully',
      mail: {
        id: mail.id,
        type: mail.type,
        subject: mail.subject,
        mailType: mail.mail_type || null,
        displayTitle: mail.display_title || mail.subject || null,
        escrowStatus: 'claimed',
      },
    });
  } catch (err) {
    logger.error('Escrow claim error', { error: err.message, mailId: req.params.mailId });
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/mailbox/seed/test-data
 * Seed mailbox items for current user (development only)
 */
router.post('/seed/test-data', verifyToken, async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Mailbox seeding is disabled in production' });
    }

    const { error, value } = seedMailboxSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(detail => detail.message)
      });
    }

    const userId = req.user.id;
    const count = value.count;
    const clearExisting = value.clearExisting;

    if (clearExisting) {
      const { error: clearError } = await supabaseAdmin
        .from('Mail')
        .delete()
        .eq('recipient_user_id', userId)
        .contains('tags', ['seed_mailbox']);

      if (clearError) {
        logger.error('Error clearing seeded mailbox data', { error: clearError.message, userId });
        return res.status(500).json({ error: 'Failed to clear seeded mailbox data' });
      }
    }

    const seedData = Array.from({ length: count }, (_, index) => buildSeedMailItem(userId, index));

    const { data: seededMail, error: insertError } = await supabaseAdmin
      .from('Mail')
      .insert(seedData)
      .select('id, type, subject, viewed, archived, starred, payout_amount, created_at');

    if (insertError) {
      logger.error('Error seeding mailbox data', { error: insertError.message, userId, count });
      return res.status(500).json({ error: 'Failed to seed mailbox data' });
    }

    const seeded = seededMail || [];

    res.status(201).json({
      message: 'Mailbox test data created',
      insertedCount: seeded.length,
      summary: {
        unread: seeded.filter(item => !item.viewed && !item.archived).length,
        ads: seeded.filter(item => item.type === 'ad').length,
        starred: seeded.filter(item => item.starred).length
      },
      mail: seeded
    });
  } catch (err) {
    logger.error('Mailbox seed error', { error: err.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to seed mailbox data' });
  }
});

/**
 * POST /api/mailbox/:id/read/start
 * Start (or reuse) a read session for analytics
 */
router.post('/:id/read/start', verifyToken, validate(startReadSessionSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { clientMeta = {} } = req.body;

    // Use the same recipient, Home and delivery rule as the reader itself.
    const mail = await readableMail(id, userId);
    if (!mail) return res.status(404).json({ error: 'Mail not found' });
    await mailObjects.hydrateMail(mail);

    const { data, error } = await supabaseAdmin.rpc('open_mail_read_session_by_reader', {
      p_mail_id: id,
      p_user_id: userId,
      p_client_meta: clientMeta
    });

    if (error) {
      if (error.code === 'PGRST202' || (error.message || '').includes('open_mail_read_session')) {
        return res.status(503).json({
          error: 'Reading is temporarily unavailable. Please try again shortly.'
        });
      }

      logger.error('Error starting mail read session', {
        error: error.message,
        mailId: id,
        userId
      });
      return res.status(500).json({ error: 'Failed to start read session' });
    }

    if (!data?.success) {
      return res.status(400).json({ error: data?.error || 'Failed to start read session' });
    }

    res.json(data);
  } catch (err) {
    logger.error('Read session start error', { error: err.message, mailId: req.params.id });
    res.status(500).json({ error: 'Failed to start read session' });
  }
});

/**
 * POST /api/mailbox/read/:sessionId/close
 * Close a read session and store dwell-time analytics
 */
router.post('/read/:sessionId/close', verifyToken, validate(closeReadSessionSchema), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;
    const {
      activeTimeMs = 0,
      maxScrollPercent = null,
      eventMeta = {}
    } = req.body;

    const { data, error } = await supabaseAdmin.rpc('close_mail_read_session', {
      p_session_id: sessionId,
      p_user_id: userId,
      p_active_time_ms: activeTimeMs,
      p_max_scroll_percent: maxScrollPercent,
      p_event_meta: eventMeta
    });

    if (error) {
      if (error.code === 'PGRST202' || (error.message || '').includes('close_mail_read_session')) {
        return res.status(503).json({
          error: 'Reading is temporarily unavailable. Please try again shortly.'
        });
      }

      logger.error('Error closing mail read session', {
        error: error.message,
        sessionId,
        userId
      });
      return res.status(500).json({ error: 'Failed to close read session' });
    }

    if (!data?.success) {
      return res.status(400).json({ error: data?.error || 'Failed to close read session' });
    }

    res.json(data);
  } catch (err) {
    logger.error('Read session close error', { error: err.message, sessionId: req.params.sessionId });
    res.status(500).json({ error: 'Failed to close read session' });
  }
});

/**
 * PATCH /api/mailbox/:id/view
 * Mark mail as viewed (triggers payout for ads)
 */
router.patch('/:id/view', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // The Mailbox's own rule decides who may open a letter (the caller's own, or a Home letter the Home mail rule shows
    // them), as on every other mailbox route; a deleted letter (recoverable) can't be read or marked until restored.
    // mark_mail_viewed decided by the mailbox.view permission, which only owners have by default, so a household member
    // opening a household letter got 400 and it stayed unread.
    if (!(await readableMail(id, userId))) return res.status(404).json({ error: 'Mail not found' });

    const { data, error } = await supabaseAdmin.rpc('mark_mail_viewed_by_reader', {
      p_mail_id: id,
      p_user_id: userId
    });

    if (error) {
      logger.error('Error marking mail viewed', { error: error.message, mailId: id });
      return res.status(500).json({ error: 'Failed to mark mail as viewed' });
    }

    if (!data.success) {
      return res.status(400).json({ error: data.error });
    }

    logger.info('Mail viewed', { mailId: id, userId, payout: data.payout });

    res.json({
      message: 'Mail marked as viewed',
      alreadyViewed: data.alreadyViewed || false,
      payout: data.payout || 0,
      viewedAt: data.viewedAt
    });

  } catch (err) {
    logger.error('Mail view error', { error: err.message, mailId: req.params.id });
    res.status(500).json({ error: 'Failed to mark mail as viewed' });
  }
});

/**
 * PATCH /api/mailbox/:id/star
 * Toggle star status
 */
router.patch('/:id/star', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { starred } = req.body;

    // Get current mail
    const { data: mail, error: fetchError } = await supabaseAdmin
      .from('Mail')
      .select('id, starred, recipient_user_id, recipient_home_id')
      .eq('id', id)
      .single();

    if (fetchError || !mail) {
      return res.status(404).json({ error: 'Mail not found' });
    }

    const allowed = await canAccessMail(mail, userId);
    if (!allowed) {
      return res.status(403).json({ error: 'You do not have access to this mail' });
    }

    const { error } = await supabaseAdmin
      .from('Mail')
      .update({ starred: starred !== undefined ? starred : !mail.starred })
      .eq('id', id);

    if (error) {
      logger.error('Error starring mail', { error: error.message, mailId: id });
      return res.status(500).json({ error: 'Failed to star mail' });
    }

    // Record action
    await supabaseAdmin
      .from('MailAction')
      .insert({
        mail_id: id,
        user_id: userId,
        action_type: starred ? 'starred' : 'unstarred'
      });

    res.json({ message: 'Mail starred status updated' });

  } catch (err) {
    logger.error('Mail star error', { error: err.message, mailId: req.params.id });
    res.status(500).json({ error: 'Failed to star mail' });
  }
});

/**
 * PATCH /api/mailbox/:id/archive
 * Archive/unarchive mail
 */
router.patch('/:id/archive', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { archived } = req.body;

    const { data: mail, error: fetchError } = await supabaseAdmin
      .from('Mail')
      .select('id, archived, recipient_user_id, recipient_home_id')
      .eq('id', id)
      .single();

    if (fetchError || !mail) {
      return res.status(404).json({ error: 'Mail not found' });
    }

    const allowed = await canAccessMail(mail, userId);
    if (!allowed) {
      return res.status(403).json({ error: 'You do not have access to this mail' });
    }

    const { error } = await supabaseAdmin
      .from('Mail')
      .update({ archived: archived !== undefined ? archived : !mail.archived })
      .eq('id', id);

    if (error) {
      logger.error('Error archiving mail', { error: error.message, mailId: id });
      return res.status(500).json({ error: 'Failed to archive mail' });
    }

    // Record action
    await supabaseAdmin
      .from('MailAction')
      .insert({
        mail_id: id,
        user_id: userId,
        action_type: archived ? 'archived' : 'unarchived'
      });

    res.json({ message: 'Mail archived status updated' });

  } catch (err) {
    logger.error('Mail archive error', { error: err.message, mailId: req.params.id });
    res.status(500).json({ error: 'Failed to archive mail' });
  }
});

router.patch('/:id/ack', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: mail, error: fetchError } = await supabaseAdmin
      .from('Mail')
      .select('id, ack_required, ack_status, recipient_user_id, recipient_home_id')
      .eq('id', id)
      .single();

    if (fetchError || !mail) {
      return res.status(404).json({ error: 'Mail not found' });
    }

    const allowed = await canAccessMail(mail, userId);
    if (!allowed) {
      return res.status(403).json({ error: 'You do not have access to this mail' });
    }

    if (!mail.ack_required) {
      return res.status(400).json({ error: 'This mail item does not require acknowledgement' });
    }

    if (mail.ack_status === 'acknowledged') {
      return res.json({
        message: 'Mail already acknowledged',
        ackStatus: 'acknowledged'
      });
    }

    const { error } = await supabaseAdmin
      .from('Mail')
      .update({
        ack_status: 'acknowledged',
        action_required: false
      })
      .eq('id', id);

    if (error) {
      logger.error('Error acknowledging mail', { error: error.message, mailId: id, userId });
      return res.status(500).json({ error: 'Failed to acknowledge mail' });
    }

    try {
      await supabaseAdmin
        .from('MailAction')
        .insert({
          mail_id: id,
          user_id: userId,
          action_type: 'engaged',
          metadata: { type: 'acknowledged' }
        });
    } catch (actionError) {
      logger.warn('Failed to record mail acknowledgement action', {
        mailId: id,
        userId,
        error: actionError?.message
      });
    }

    res.json({
      message: 'Mail acknowledged',
      ackStatus: 'acknowledged'
    });
  } catch (err) {
    logger.error('Mail acknowledge error', { error: err.message, mailId: req.params.id });
    res.status(500).json({ error: 'Failed to acknowledge mail' });
  }
});

/**
 * DELETE /api/mailbox/:id
 * Delete mail. It hides for everyone at once and can be restored for
 * MAIL_RESTORE_DAYS (the nightly purge removes it after that). The other
 * members who could see a Home letter get a notice that opens it with Restore.
 */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: mail, error: fetchError } = await supabaseAdmin
      .from('Mail')
      .select('id, recipient_user_id, recipient_home_id, deleted_at')
      .eq('id', id)
      .single();

    if (fetchError || !mail || mail.deleted_at) {
      return res.status(404).json({ error: 'Mail not found' });
    }

    const allowed = await canAccessMail(mail, userId);
    if (!allowed) {
      return res.status(403).json({ error: 'You do not have access to this mail' });
    }

    const deletedAt = new Date().toISOString();
    const { data: deleted, error } = await supabaseAdmin
      .from('Mail')
      .update({ deleted_at: deletedAt, deleted_by: userId })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id');

    if (error) {
      logger.error('Error deleting mail', { error: error.message, mailId: id });
      return res.status(500).json({ error: 'Failed to delete mail' });
    }
    if (!deleted || deleted.length === 0) {
      return res.status(404).json({ error: 'Mail not found' });
    }

    logger.info('Mail deleted (restorable)', { mailId: id, userId });
    await sendHomeMailRemovedNotice(mail, userId, 'deleted');

    res.json({
      message: 'Mail deleted successfully',
      restorable_until: new Date(Date.parse(deletedAt) + MAIL_RESTORE_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    });

  } catch (err) {
    logger.error('Mail delete error', { error: err.message, mailId: req.params.id });
    res.status(500).json({ error: 'Failed to delete mail' });
  }
});

/**
 * POST /api/mailbox/:id/restore
 * Restore a deleted letter within MAIL_RESTORE_DAYS, or a dismissed one, for
 * any member who could see it.
 */
router.post('/:id/restore', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const mail = await restorableMail(id, req.user.id);
    if (!mail) return res.status(404).json({ error: 'Mail not found' });

    let update;
    let guard;
    if (mail.deleted_at) {
      if (Date.now() - Date.parse(mail.deleted_at) > MAIL_RESTORE_DAYS * 24 * 60 * 60 * 1000) {
        return res.status(410).json({ error: 'This letter can no longer be restored.' });
      }
      update = { deleted_at: null, deleted_by: null };
      guard = (query) => query.not('deleted_at', 'is', null);
    } else if (mail.lifecycle === 'shredded') {
      update = { lifecycle: mail.opened_at || mail.viewed_at ? 'opened' : 'delivered' };
      guard = (query) => query.eq('lifecycle', 'shredded');
    } else {
      return res.status(409).json({ error: 'This letter is not deleted.' });
    }

    const { data: restored, error } = await guard(
      supabaseAdmin.from('Mail').update(update).eq('id', id)
    ).select('id');
    if (error) {
      logger.error('Error restoring mail', { error: error.message, mailId: id });
      return res.status(500).json({ error: "Couldn't restore this letter. Please try again." });
    }
    if (!restored || restored.length === 0) {
      return res.status(409).json({ error: 'This letter is not deleted.' });
    }

    logger.info('Mail restored', { mailId: id, userId: req.user.id });
    res.json({ message: 'Mail restored' });
  } catch (err) {
    logger.error('Mail restore error', { error: err.message, mailId: req.params.id });
    res.status(500).json({ error: "Couldn't restore this letter. Please try again." });
  }
});

// ============ EARNINGS ROUTES ============

/**
 * GET /api/mailbox/earnings/summary
 * Get user's earnings summary
 */
router.get('/earnings/summary', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get pending earnings
    const { data: pending, error: pendingError } = await supabaseAdmin
      .rpc('get_user_pending_earnings', { p_user_id: userId });

    if (pendingError) {
      logger.error('Error fetching pending earnings', { error: pendingError.message, userId });
    }

    // Get total earned
    const { data: total, error: totalError } = await supabaseAdmin
      .rpc('get_user_total_earned', { p_user_id: userId });

    if (totalError) {
      logger.error('Error fetching total earned', { error: totalError.message, userId });
    }

    res.json({
      pendingEarnings: pending || 0,
      totalEarned: total || 0,
      currency: 'USD'
    });

  } catch (err) {
    logger.error('Earnings summary error', { error: err.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to fetch earnings summary' });
  }
});

/**
 * GET /api/mailbox/earnings/history
 * Get earnings history
 */
router.get('/earnings/history', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;

    const { data: earnings, error } = await supabaseAdmin
      .from('Mail')
      .select('id, type, subject, sender_business_name, payout_amount, payout_status, viewed_at, created_at')
      .eq('recipient_user_id', userId)
      .eq('type', 'ad')
      .eq('viewed', true)
      .not('payout_amount', 'is', null)
      .order('viewed_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) {
      logger.error('Error fetching earnings history', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to fetch earnings history' });
    }

    res.json({
      earnings: earnings || []
    });

  } catch (err) {
    logger.error('Earnings history error', { error: err.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to fetch earnings history' });
  }
});

// ============ AD CAMPAIGN ROUTES ============

/**
 * POST /api/mailbox/campaigns
 * Create ad campaign (business users)
 */
router.post('/campaigns', verifyToken, validate(createCampaignSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name,
      description,
      targetCities,
      targetStates,
      targetZipcodes,
      targetLocation,
      targetRadiusMeters,
      budgetTotal,
      pricePerView,
      startsAt,
      endsAt
    } = req.body;

    const campaignData = {
      business_user_id: userId,
      name,
      description: description || null,
      target_cities: targetCities || [],
      target_states: targetStates || [],
      target_zipcodes: targetZipcodes || [],
      target_location: targetLocation ? formatLocationForDB(targetLocation.latitude, targetLocation.longitude) : null,
      target_radius_meters: targetRadiusMeters || null,
      budget_total: budgetTotal,
      budget_remaining: budgetTotal,
      price_per_view: pricePerView || 0.10,
      starts_at: startsAt || null,
      ends_at: endsAt || null
    };

    const { data: campaign, error } = await supabaseAdmin
      .from('AdCampaign')
      .insert(campaignData)
      .select()
      .single();

    if (error) {
      logger.error('Error creating campaign', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to create campaign' });
    }

    logger.info('Campaign created', { campaignId: campaign.id, userId });

    res.status(201).json({
      message: 'Campaign created successfully',
      campaign
    });

  } catch (err) {
    logger.error('Campaign creation error', { error: err.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

module.exports = router;
