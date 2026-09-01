const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const supabase = require('../config/supabase');
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const Joi = require('joi');
const logger = require('../utils/logger');
const { checkHomePermission } = require('../utils/homePermissions');
const s3 = require('../services/s3Service');
const notificationService = require('../services/notificationService');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');

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

const MAIL_OBJECT_FOLDER = 'mailbox-objects';
const DEFAULT_MAIL_TYPE = 'letter';
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
const ESCROW_CLAIM_LINK_BASE = 'https://mail.pantopus.com/open';

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

/**
 * Normalize an escrow contact for consistent storage and comparison.
 * Emails: lowercased. Phones: digits only with leading +.
 */
/**
 * Escape HTML special characters to prevent XSS in email bodies.
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
    if (!recipientUserId && !recipientHomeId) {
      throw new Error('Please choose who this mail is for.');
    }

    if (recipientUserId) {
      deliveryTargetType = 'user';
      deliveryTargetId = recipientUserId;
      addressHomeId = recipientHomeId || null;
      attnUserId = recipientUserId;
      deliveryVisibility = 'attn_only';
    } else {
      deliveryTargetType = 'home';
      deliveryTargetId = recipientHomeId;
      addressHomeId = recipientHomeId;
      deliveryVisibility = 'home_members';
      attnLabel = 'Current Resident';
    }
  }

  if (!recipientUserId && !recipientHomeId) {
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
  const attachments =
    structuredObject.attachments ||
    structuredEnvelope.attachments ||
    body.attachments ||
    [];

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
  const rawExtracted = structuredObject?.payload?.extractedData || structuredObject?.payload?.extraction || null;
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

const canAccessMail = async (mail, userId) => {
  if (mail.recipient_user_id === userId) return true;
  if (!mail.recipient_home_id) return false;

  const { data: occupancy } = await supabaseAdmin
    .from('HomeOccupancy')
    .select('id')
    .eq('home_id', mail.recipient_home_id)
    .eq('user_id', userId)
    .single();

  return !!occupancy;
};

const getHomeForRouting = async (homeId) => {
  if (!homeId) return null;
  const { data: home } = await supabaseAdmin
    .from('Home')
    .select('id, owner_id')
    .eq('id', homeId)
    .single();

  return home || null;
};

const hasHomeAccess = async (homeId, userId) => {
  const home = await getHomeForRouting(homeId);
  if (!home) {
    return { allowed: false, home: null };
  }

  const mailAccess = await checkHomePermission(homeId, userId, 'finance.view');
  if (mailAccess.hasAccess) {
    return { allowed: true, home };
  }

  return { allowed: false, home };
};

const isUserLinkedToHome = async (home, userId) => {
  if (!home || !userId) return false;

  const mailAccess = await checkHomePermission(home.id, userId, 'finance.view');
  return mailAccess.hasAccess;
};

const hasVerifiedSenderHome = async (userId) => {
  const [occupancyRes, ownerRes] = await Promise.allSettled([
    supabaseAdmin
      .from('HomeOccupancy')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('verification_status', 'verified')
      .limit(1),
    supabaseAdmin
      .from('HomeOwner')
      .select('home_id')
      .eq('subject_id', userId)
      .eq('owner_status', 'verified')
      .limit(1),
  ]);

  const verifiedOccupancies =
    occupancyRes.status === 'fulfilled' ? occupancyRes.value?.data || [] : [];
  const verifiedOwnerRows =
    ownerRes.status === 'fulfilled' ? ownerRes.value?.data || [] : [];

  return verifiedOccupancies.length > 0 || verifiedOwnerRows.length > 0;
};

const sendHomeVerificationRequired = (res) =>
  res.status(403).json({
    error: HOME_ADDRESS_VERIFICATION_REQUIRED_MESSAGE,
    message: HOME_ADDRESS_VERIFICATION_REQUIRED_DETAIL,
    code: HOME_ADDRESS_VERIFICATION_REQUIRED_CODE,
  });

const getAccessibleHomeIds = async (userId) => {
  const homeIdSet = new Set();

  const [occupancyRes, ownerRes] = await Promise.allSettled([
    supabaseAdmin
      .from('HomeOccupancy')
      .select('home_id')
      .eq('user_id', userId),
    supabaseAdmin
      .from('Home')
      .select('id')
      .eq('owner_id', userId)
  ]);

  if (occupancyRes.status === 'fulfilled') {
    const rows = occupancyRes.value?.data || [];
    rows.forEach((row) => {
      if (row?.home_id) homeIdSet.add(row.home_id);
    });
  }

  if (ownerRes.status === 'fulfilled') {
    const rows = ownerRes.value?.data || [];
    rows.forEach((row) => {
      if (row?.id) homeIdSet.add(row.id);
    });
  }

  return Array.from(homeIdSet);
};

const applyMailboxScopeToQuery = (query, { scope, userId, homeId, accessibleHomeIds }) => {
  if (scope === 'home') {
    return query.eq('recipient_home_id', homeId);
  }

  if (scope === 'all') {
    if (!accessibleHomeIds || accessibleHomeIds.length === 0) {
      return query.eq('recipient_user_id', userId);
    }
    return query.or(`recipient_user_id.eq.${userId},recipient_home_id.in.(${accessibleHomeIds.join(',')})`);
  }

  return query.eq('recipient_user_id', userId);
};

const createMailObject = async ({
  senderId,
  objectPayload
}) => {
  const payload = {
    ...objectPayload,
    sender: {
      ...(objectPayload?.sender || {}),
      senderUserId: senderId
    }
  };

  const serialized = JSON.stringify(payload || {});
  const buffer = Buffer.from(serialized, 'utf8');
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  const { url, key } = await s3.uploadGeneral(
    buffer,
    'mail.json',
    senderId,
    MAIL_OBJECT_FOLDER,
    'application/json'
  );

  const bucketName =
    process.env.AWS_S3_BUCKET_NAME ||
    process.env.AWS_BUCKET_NAME ||
    process.env.AWS_S3_BUCKET ||
    null;

  const { data: objectRow, error } = await supabaseAdmin
    .from('MailObject')
    .insert({
      created_by_user_id: senderId,
      storage_provider: 's3',
      bucket_name: bucketName,
      object_key: key,
      format: 'mailjson_v1',
      mime_type: 'application/json',
      size_bytes: buffer.length,
      sha256,
      status: 'ready',
      uploaded_at: new Date().toISOString(),
      object_meta: {
        publicUrl: url
      }
    })
    .select()
    .single();

  if (error) {
    logger.error('MailObject insert failed', { error: error.message, key, senderId });
    throw new Error('Failed to persist mail object metadata');
  }

  return {
    objectId: objectRow.id,
    objectKey: key,
    objectUrl: url
  };
};

const insertMailWithCompatibility = async (mailData) => {
  const primaryInsert = await supabaseAdmin
    .from('Mail')
    .insert(mailData)
    .select()
    .single();

  if (!primaryInsert.error) {
    return primaryInsert;
  }

  const message = primaryInsert.error.message || '';
  const missingObjectColumns =
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
    message.includes('escrow_claim_token');

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

  const fallbackInsert = await supabaseAdmin
    .from('Mail')
    .insert(fallbackData)
    .select()
    .single();

  return fallbackInsert;
};

const getMailObjectPayload = async (objectId) => {
  const { data: objectRow, error } = await supabaseAdmin
    .from('MailObject')
    .select('*')
    .eq('id', objectId)
    .single();

  if (error || !objectRow) {
    logger.warn('MailObject fetch failed', { objectId, error: error?.message });
    return null;
  }

  if (!objectRow.object_key) {
    return { metadata: objectRow, payload: null };
  }

  try {
    const objectText = await s3.getObjectAsString(
      objectRow.object_key,
      objectRow.bucket_name || undefined
    );
    let payload = null;
    try {
      payload = JSON.parse(objectText);
    } catch {
      payload = { body: { content: objectText } };
    }
    return { metadata: objectRow, payload };
  } catch (err) {
    logger.error('MailObject read failed', { objectId, error: err.message });
    return { metadata: objectRow, payload: null };
  }
};

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
  const docType = pickExtractedString(mail, ['doc_type', 'docType']) || 'mail_document';
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

const createHomeTaskFanoutTarget = async ({
  mail,
  homeId,
  senderId
}) => {
  const title = mail.display_title || mail.subject || 'Task from mail';
  const description = mail.preview_text || mail.content_excerpt || null;
  const dueDate = pickExtractedDate(mail, ['due_date', 'dueDate', 'due_at', 'dueAt']);
  const priority = mail.priority === 'urgent' ? 'urgent' : (mail.priority === 'high' ? 'high' : 'medium');

  const { data, error } = await supabaseAdmin
    .from('HomeTask')
    .insert({
      home_id: homeId,
      task_type: 'reminder',
      title,
      description,
      due_at: dueDate,
      priority,
      status: 'open',
      mail_id: mail.id,
      details: {
        source: 'mailbox_fanout',
        sourceMailId: mail.id,
        sourceMailType: mail.type,
        sourceObjectId: mail.object_id || null,
      },
      created_by: senderId
    })
    .select('id')
    .single();

  if (error) {
    if (isMissingTableError(error, 'HomeTask')) {
      return null;
    }
    throw error;
  }

  return data?.id || null;
};

const autoFanoutMailTargets = async ({
  mail,
  homeId,
  senderId,
  outcomes: outcomesList
}) => {
  if (!mail || !homeId) return [];

  const rawType = String(mail.type || '').toLowerCase();
  const mailType = String(mail.mail_type || '').toLowerCase();
  const oc = Array.isArray(outcomesList) ? outcomesList : [];

  // Determine which fan-out targets to create based on type AND outcomes
  const targets = [];

  // Type-based fan-out
  if (rawType === 'bill' || rawType === 'statement' || mailType === 'bill' || oc.includes('pay_now')) {
    targets.push('bill');
  }
  if (rawType === 'package') {
    targets.push('package');
  }
  if (rawType === 'document' || mailType === 'packet' || oc.includes('save_to_records')) {
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

    if (!targetId) continue;

    const link = await upsertMailLink({
      mailId: mail.id,
      targetType,
      targetId,
      createdBy: 'system'
    });

    if (link) links.push(link);
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
        return res.status(403).json({ error: 'You don\u2019t have permission to send mail to this home.' });
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
        sender_business_name,
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
        created_at
      `, { count: 'exact' })
      .eq('archived', archived === 'true')
      .order('created_at', { ascending: false })
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

    const { data: mail, error, count } = await query;

    if (error) {
      logger.error('Error fetching mailbox', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to fetch mailbox' });
    }

    // Compute summary from direct queries (MailboxSummary view may not exist)
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
      const [totalRes, unreadRes, starredRes] = await Promise.allSettled([
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

      summary.total_mail = totalRes.status === 'fulfilled' ? (totalRes.value.count || 0) : 0;
      summary.unread_count = unreadRes.status === 'fulfilled' ? (unreadRes.value.count || 0) : 0;
      summary.starred_count = starredRes.status === 'fulfilled' ? (starredRes.value.count || 0) : 0;
    } catch (e) {
      // Non-critical, proceed with zero summary
    }

    res.json({
      mail: mail || [],
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

/**
 * GET /api/mailbox/:id
 * Get single mail item
 */
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

    if (error || !mail) {
      return res.status(404).json({ error: 'Mail not found' });
    }

    const allowed = await canAccessMail(mail, userId);
    if (!allowed) {
      return res.status(403).json({ error: 'You do not have access to this mail' });
    }

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

    mail.links = await getMailLinksSafely(mail.id);

    res.json({ mail });

  } catch (err) {
    logger.error('Mail fetch error', { error: err.message, mailId: req.params.id });
    res.status(500).json({ error: 'Failed to fetch mail' });
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
      .select('id, object_id, recipient_user_id, recipient_home_id')
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

    res.json({
      object: objectData.metadata,
      payload: objectData.payload
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
      return res.status(400).json({ error: normalizeErr.message || 'Invalid mail payload' });
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
      senderBusinessName,
      senderAddress,
      payoutAmount,
      category,
      tags,
      priority,
      expiresAt,
      objectPayload
    } = normalizedPayload;

    // Resolve sender identity once for consistent storage/display.
    const { data: senderProfile } = await supabaseAdmin
      .from('User')
      .select('name, username')
      .eq('id', senderId)
      .maybeSingle();
    const senderDisplayName = (
      senderBusinessName ||
      senderProfile?.name ||
      senderProfile?.username ||
      'Someone'
    ).trim();
    const senderTrust = senderBusinessName ? 'verified_business' : 'pantopus_user';

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
      // Rate limit check
      const rateCheck = await checkEscrowRateLimits(senderId, escrowContact);
      if (!rateCheck.allowed) {
        return res.status(429).json({ error: rateCheck.reason });
      }

      // Generate unique claim token
      const escrowClaimToken = crypto.randomBytes(32).toString('hex');
      const escrowExpiresAt = new Date(Date.now() + ESCROW_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

      // Create mail object (S3) if applicable
      let objectResult = null;
      try {
        objectResult = await createMailObject({ senderId, objectPayload });
      } catch (objectErr) {
        logger.warn('Escrow mail object creation fallback to inline', { senderId, error: objectErr.message });
      }

      const contentExcerpt = buildMailExcerpt(content);

      const escrowMailData = {
        recipient_user_id: null,
        recipient_home_id: null,
        sender_user_id: senderId,
        sender_display: senderDisplayName,
        sender_trust: senderTrust,
        sender_business_name: senderBusinessName || null,
        sender_address: senderAddress || null,
        type,
        subject: subject || null,
        content: objectResult ? contentExcerpt : content,
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
        mail_extracted: extractedData || null,
        // Escrow-specific fields
        escrow_recipient_contact: escrowContact,
        escrow_status: 'pending',
        escrow_expires_at: escrowExpiresAt,
        escrow_claim_token: escrowClaimToken,
      };

      const { data: escrowMail, error: escrowError } = await insertMailWithCompatibility(escrowMailData);

      if (escrowError) {
        logger.error('Error creating escrowed mail', { error: escrowError.message, senderId });
        return res.status(500).json({ error: 'Failed to send mail' });
      }

      logger.info('Escrowed mail created', {
        mailId: escrowMail.id,
        type,
        senderId,
        escrowContact,
        escrowExpiresAt,
      });

      // ── Notify non-user recipient (non-blocking) ────────────
      const claimLink = `${ESCROW_CLAIM_LINK_BASE}/${escrowMail.id}?token=${escrowClaimToken}`;
      (async () => {
        try {
          const senderName = senderDisplayName;
          const notifBody = `${senderName} sent you a letter to your home. Open it on Pantopus: ${claimLink}`;

          if (req.body.recipientEmail) {
            await emailService.sendEmail({
              to: escrowContact,
              subject: `${senderName} sent you mail on Pantopus`,
              text: notifBody,
              html: `<p>${escapeHtml(senderName)} sent you a letter to your home.</p><p><a href="${claimLink}">Open it on Pantopus</a></p>`,
            });
          } else {
            await smsService.sendSms({
              to: escrowContact,
              body: notifBody,
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

    // Validate recipient exists
    if (recipientUserId) {
      const { data: user } = await supabaseAdmin
        .from('User')
        .select('id')
        .eq('id', recipientUserId)
        .single();

      if (!user) {
        return res.status(404).json({ error: 'We couldn\u2019t find that person. They may have deactivated their account.' });
      }
    }

    let addressHome = null;
    if (addressHomeId) {
      const homeAccess = await hasHomeAccess(addressHomeId, senderId);
      if (!homeAccess.home) {
        return res.status(404).json({ error: 'That home address wasn\u2019t found. It may have been removed.' });
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
        return res.status(404).json({ error: 'That home wasn\u2019t found. It may have been removed.' });
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
          error: 'That person doesn\u2019t live at the selected home address.'
        });
      }
    }

    // Check user preferences if sending ad
    if (type === 'ad' && recipientUserId) {
      const prefs = await getUserPreferences(recipientUserId);
      if (prefs && !prefs.receive_ads) {
        return res.status(400).json({ error: 'This person has opted out of receiving ads.' });
      }
    }

    let objectResult = null;
    try {
      objectResult = await createMailObject({
        senderId,
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
      sender_display: senderDisplayName,
      sender_trust: senderTrust,
      sender_business_name: senderBusinessName || null,
      sender_address: senderAddress || null,
      type,
      subject: subject || null,
      content: objectResult ? contentExcerpt : content,
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
      address_id: addressHomeId || recipientHomeId || null,
      address_home_id: addressHomeId || recipientHomeId || null,
      attn_user_id: attnUserId || null,
      attn_label: attnLabel || null,
      delivery_visibility: deliveryVisibility || null,
      mail_extracted: extractedData || null
    };

    const { data: mail, error } = await insertMailWithCompatibility(mailData);

    if (error) {
      logger.error('Error sending mail', { error: error.message, senderId });
      return res.status(500).json({ error: 'Failed to send mail' });
    }

    let fanoutLinks = [];
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
          outcomes
        });
      } catch (fanoutErr) {
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

    // Fire-and-forget: fetch sender name + home address, then notify
    (async () => {
      try {
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
          // Home-targeted mail: notify all household members except sender
          const { data: occupants } = await supabaseAdmin
            .from('HomeOccupancy')
            .select('user_id')
            .eq('home_id', addressHomeId || recipientHomeId)
            .eq('is_active', true);

          if (occupants) {
            for (const occ of occupants) {
              if (occ.user_id !== senderId) {
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
        links: fanoutLinks,
        createdAt: mail.created_at,
        objectId: objectResult?.objectId || mail.object_id || null
      }
    });

  } catch (err) {
    logger.error('Mail send error', { error: err.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to send mail' });
  }
});

// ============================================================
// ESCROW CLAIM ENDPOINTS
// ============================================================

/**
 * GET /api/mailbox/claim/:mailId
 * Public endpoint (no auth required) — previews escrowed mail.
 * Requires ?token= query param matching the mail's claim token.
 * Returns safe subset of mail content for the web receiving page.
 */
router.get('/claim/:mailId', async (req, res) => {
  try {
    const { mailId } = req.params;
    const { token } = req.query;

    if (!mailId || !UUID_REGEX.test(mailId)) {
      return res.status(400).json({ error: 'Invalid mail ID format' });
    }
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Claim token is required' });
    }

    const { data: mail, error } = await supabaseAdmin
      .from('Mail')
      .select('id, sender_user_id, sender_business_name, type, subject, content, content_excerpt, preview_text, display_title, mail_type, primary_action, ack_required, attachments, object_id, escrow_recipient_contact, escrow_status, escrow_claim_token, escrow_expires_at, created_at')
      .eq('id', mailId)
      .single();

    if (error || !mail) {
      return res.status(404).json({ error: 'Mail not found' });
    }

    // Validate claim token (timing-safe to prevent side-channel leaks)
    if (!mail.escrow_claim_token || !timingSafeTokenCompare(mail.escrow_claim_token, token)) {
      return res.status(403).json({ error: 'Invalid claim token' });
    }

    // Check escrow status
    if (mail.escrow_status === 'expired') {
      return res.status(410).json({ error: 'This mail has expired and is no longer available.' });
    }
    if (mail.escrow_status === 'withdrawn') {
      return res.status(410).json({ error: 'This mail was withdrawn by the sender.' });
    }
    if (mail.escrow_status === 'claimed') {
      return res.status(409).json({ error: 'This mail has already been claimed.' });
    }

    // Fetch sender display name (safe — no address or private data)
    const { data: senderUser } = await supabaseAdmin
      .from('User')
      .select('name, username')
      .eq('id', mail.sender_user_id)
      .single();

    const senderName = senderUser?.name || senderUser?.username || mail.sender_business_name || 'Someone';

    // Fetch sender verification status
    const { data: senderProfile } = await supabaseAdmin
      .from('UserProfile')
      .select('identity_verified')
      .eq('user_id', mail.sender_user_id)
      .single();

    // Fetch object payload (stationery metadata) if available
    let stationeryTheme = null;
    let inkSelection = null;
    let voicePostscriptUri = null;
    let outcomes = null;
    let bodyContent = mail.content || mail.content_excerpt || '';

    if (mail.object_id) {
      const objectPayload = await getMailObjectPayload(mail.object_id);
      if (objectPayload?.payload) {
        const p = objectPayload.payload;
        // Extract stationery from payload (may be nested at .payload or .body.payload)
        const stationeryData = p.payload || p.body?.payload || {};
        stationeryTheme = stationeryData.stationeryTheme || null;
        inkSelection = stationeryData.inkSelection || null;
        voicePostscriptUri = stationeryData.voicePostscriptUri || null;
        outcomes = stationeryData.outcomes || null;
        // Use full content from object if available
        if (p.body?.content) bodyContent = p.body.content;
        else if (p.content) bodyContent = p.content;
      }
    }

    // Filter attachments — only return photo URLs (not internal refs)
    const photoAttachments = (mail.attachments || []).filter(
      a => a && !a.includes('voice') && (a.startsWith('http') || a.startsWith('/'))
    );

    // Build outcome description
    let outcomeDescription = null;
    if (mail.primary_action === 'pay' || mail.mail_type === 'bill') {
      outcomeDescription = 'Payment requested';
    } else if (mail.ack_required) {
      outcomeDescription = 'Acknowledgement required';
    } else if (mail.primary_action === 'sign') {
      outcomeDescription = 'Signature required';
    }

    return res.json({
      mail: {
        id: mail.id,
        senderName,
        senderVerified: Boolean(senderProfile?.identity_verified),
        subject: mail.subject || mail.display_title || null,
        previewText: mail.preview_text || mail.content_excerpt || null,
        mailType: mail.mail_type || mail.type || null,
        stationeryTheme,
        inkSelection,
        voicePostscriptUri,
        photoAttachments,
        outcomeDescription,
        outcomes,
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
 * POST /api/mailbox/claim/:mailId
 * Auth required — claims escrowed mail for the authenticated user.
 * Validates claim token and (optionally) address proximity.
 * Updates escrow status to 'claimed' and delivers the mail.
 */
router.post('/claim/:mailId', verifyToken, async (req, res) => {
  try {
    const { mailId } = req.params;
    const { token } = req.body;
    const claimerId = req.user.id;

    if (!mailId || !UUID_REGEX.test(mailId)) {
      return res.status(400).json({ error: 'Invalid mail ID format' });
    }
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Claim token is required' });
    }

    // Fetch the escrowed mail
    const { data: mail, error } = await supabaseAdmin
      .from('Mail')
      .select('*')
      .eq('id', mailId)
      .single();

    if (error || !mail) {
      return res.status(404).json({ error: 'Mail not found' });
    }

    // Validate claim token (timing-safe to prevent side-channel leaks)
    if (!mail.escrow_claim_token || !timingSafeTokenCompare(mail.escrow_claim_token, token)) {
      return res.status(403).json({ error: 'Invalid claim token' });
    }

    // Check escrow status
    if (mail.escrow_status !== 'pending') {
      return res.status(409).json({
        error: `This mail has already been ${mail.escrow_status}.`,
      });
    }

    // Check expiry
    if (mail.escrow_expires_at && new Date(mail.escrow_expires_at) < new Date()) {
      // Auto-expire if past deadline
      await supabaseAdmin
        .from('Mail')
        .update({ escrow_status: 'expired' })
        .eq('id', mailId);
      return res.status(410).json({ error: 'This mail has expired.' });
    }

    // Prevent sender from claiming their own mail
    if (mail.sender_user_id === claimerId) {
      return res.status(400).json({ error: 'You cannot claim mail you sent.' });
    }

    // Verify the claimer's contact matches the escrow contact (email or phone)
    const { data: claimer } = await supabaseAdmin
      .from('User')
      .select('email, phone')
      .eq('id', claimerId)
      .single();

    if (!claimer) {
      return res.status(404).json({ error: 'User not found' });
    }

    const escrowContact = mail.escrow_recipient_contact;
    const normalizedEscrow = normalizeEscrowContact(escrowContact);
    const contactMatches =
      (claimer.email && normalizeEscrowContact(claimer.email) === normalizedEscrow) ||
      (claimer.phone && normalizeEscrowContact(claimer.phone) === normalizedEscrow);

    if (!contactMatches) {
      return res.status(403).json({
        error: 'Your account contact does not match the intended recipient.',
      });
    }

    // ── Claim the mail ─────────────────────────────────────────
    // Look up the claimer's home for delivery
    const { data: claimerOccupancy } = await supabaseAdmin
      .from('HomeOccupancy')
      .select('home_id')
      .eq('user_id', claimerId)
      .eq('is_active', true)
      .limit(1)
      .single();

    const claimerHomeId = claimerOccupancy?.home_id || null;

    const { data: updatedRows, error: updateError } = await supabaseAdmin
      .from('Mail')
      .update({
        escrow_status: 'claimed',
        recipient_user_id: claimerId,
        recipient_home_id: claimerHomeId,
        delivery_target_type: claimerHomeId ? 'home' : 'user',
        delivery_target_id: claimerHomeId || claimerId,
        recipient_type: claimerHomeId ? 'home' : 'user',
        recipient_id: claimerHomeId || claimerId,
        address_home_id: claimerHomeId,
        lifecycle: 'delivered',
      })
      .eq('id', mailId)
      .eq('escrow_status', 'pending')
      .select('id');

    if (updateError) {
      logger.error('Escrow claim update failed', { error: updateError.message, mailId });
      return res.status(500).json({ error: 'Failed to claim mail' });
    }

    if (!updatedRows || updatedRows.length === 0) {
      return res.status(409).json({ error: 'This mail has already been claimed.' });
    }

    logger.info('Escrowed mail claimed', {
      mailId,
      claimerId,
      claimerHomeId,
      escrowContact,
    });

    // Notify the sender that their mail was claimed
    (async () => {
      try {
        const { data: claimerUser } = await supabaseAdmin
          .from('User')
          .select('name, username')
          .eq('id', claimerId)
          .single();
        const claimerName = claimerUser?.name || claimerUser?.username || 'Someone';

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

    const { data, error } = await supabaseAdmin.rpc('open_mail_read_session', {
      p_mail_id: id,
      p_user_id: userId,
      p_client_meta: clientMeta
    });

    if (error) {
      if (error.code === 'PGRST202' || (error.message || '').includes('open_mail_read_session')) {
        return res.status(501).json({
          error: 'Read session function not available. Run mailbox_object_storage_migration.sql first.'
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
        return res.status(501).json({
          error: 'Read session function not available. Run mailbox_object_storage_migration.sql first.'
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

    // Use the SQL function to mark as viewed
    const { data, error } = await supabaseAdmin.rpc('mark_mail_viewed', {
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
      .select('starred, recipient_user_id, recipient_home_id')
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
      .select('archived, recipient_user_id, recipient_home_id')
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
      .select('ack_required, ack_status, recipient_user_id, recipient_home_id')
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
 * Delete mail
 */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: mail, error: fetchError } = await supabaseAdmin
      .from('Mail')
      .select('recipient_user_id, recipient_home_id')
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
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Error deleting mail', { error: error.message, mailId: id });
      return res.status(500).json({ error: 'Failed to delete mail' });
    }

    logger.info('Mail deleted', { mailId: id, userId });

    res.json({ message: 'Mail deleted successfully' });

  } catch (err) {
    logger.error('Mail delete error', { error: err.message, mailId: req.params.id });
    res.status(500).json({ error: 'Failed to delete mail' });
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

/**
 * GET /api/mailbox/campaigns
 * Get user's ad campaigns
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
      return res.status(500).json({ error: 'Failed to fetch campaigns' });
    }

    res.json({ campaigns: campaigns || [] });

  } catch (err) {
    logger.error('Campaigns fetch error', { error: err.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// GET /api/mailbox/summary — counts by type for InboxEarnCard
router.get('/summary', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const scope = req.query.scope || 'personal';
    const homeId = req.query.homeId;

    let query = supabaseAdmin
      .from('Mail')
      .select('id, type, viewed')
      .eq('archived', false);

    if (scope === 'home' && homeId) {
      query = query.eq('home_id', homeId);
    } else {
      query = query.eq('recipient_user_id', userId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const items = data || [];
    const unread = items.filter(m => !m.viewed).length;
    const bills = items.filter(m => m.type === 'bill' || m.type === 'statement').length;
    const notices = items.filter(m => m.type === 'notice').length;
    const offers = items.filter(m => m.type === 'ad' || m.type === 'promotion' || m.type === 'newsletter').length;

    res.json({
      total: items.length,
      unread,
      bills,
      notices,
      offers,
    });
  } catch (err) {
    logger.error('Failed to fetch mailbox summary:', err);
    res.status(500).json({ error: 'Failed to fetch mailbox summary' });
  }
});

module.exports = router;
