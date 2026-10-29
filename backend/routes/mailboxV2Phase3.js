// ============================================================
// MAILBOX V2 — PHASE 3 ROUTES
// "The Thing That Compounds"
// Records, Map, Community, Tasks, MailDay, Stamps, Memory,
// Wallet, Vacation, Translation
// Mounted at /api/mailbox/v2/p3
// ============================================================

const crypto = require('crypto');
const express = require('express');
const { DateTime } = require('luxon');
const multer = require('multer');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const homeRecordService = require('../services/homeRecordService');
const notificationService = require('../services/notificationService');
const taskMediaStorage = require('../services/homeTaskMediaStorage');
const { checkHomePermission } = require('../utils/homePermissions');
const { getAccessibleHomeIds, canAccessMail, readableMail, visibleMailFilter, onlyDelivered, householdHomeIds } = require('../utils/homeMailAccess');
// A vacation hold that holds (Mail tab, SRV-5), and the delivery rule's clock.
const mailVacation = require('../services/mailVacation');
const mailDelivery = require('../services/mailDelivery');
// A letter sent as a business names the business to everyone it reaches, never the person who sent it; a person who
// sent one in their own name is named as neighbors see them (their Local Profile).
const { presentMailSenders, nameMailSenders } = require('../utils/mailSenderView');

// Letters read with sender_name aliased from sender_display, each person who sent one named as neighbors see them; the
// sender fields read for that (MAIL_SENDER_FIELDS) stay out of the response.
const MAIL_SENDER_FIELDS = 'sender_user_id, sender_entity_id, sender_business_name';
async function withSenderNames(rows, viewerId) {
  return (await nameMailSenders(rows || [], viewerId, { field: 'sender_name' }))
    .map(({ sender_user_id: _u, sender_entity_id: _e, sender_business_name: _b, ...row }) => row);
}
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const Joi = require('joi');
const logger = require('../utils/logger');
const { isLaunchFeatureEnabled } = require('../utils/featureFlags');
const { AWARDED_STAMP_TYPES, STAMP_GOALS, countStampMetric: readStampMetric } = require('../jobs/stampAwarder');

// ============ VALIDATION SCHEMAS ============

// ── Records ──
const linkAssetSchema = Joi.object({
  mailId: Joi.string().uuid().required(),
  assetId: Joi.string().uuid().required(),
  linkType: Joi.string().valid('manual', 'auto_detected', 'warranty', 'receipt', 'repair').default('manual'),
});

const autoDetectSchema = Joi.object({
  homeId: Joi.string().uuid().required(),
});

// ── Map ──
const createPinSchema = Joi.object({
  homeId: Joi.string().uuid().required(),
  mailId: Joi.string().uuid().optional(),
  pinType: Joi.string().valid('permit', 'delivery', 'notice', 'civic', 'utility_work', 'community').required(),
  title: Joi.string().max(255).required(),
  body: Joi.string().max(2000).optional(),
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
  radiusMeters: Joi.number().min(0).max(50000).optional(),
  visibleTo: Joi.string().valid('personal', 'household', 'neighborhood', 'public').default('household'),
  expiresAt: Joi.string().isoDate().optional(),
});

// ── Community ──
const publishSchema = Joi.object({
  mailId: Joi.string().uuid().required(),
  commentary: Joi.string().max(500).optional(),
  publishedTo: Joi.string().valid('building', 'neighborhood', 'city').default('neighborhood'),
});

const reactSchema = Joi.object({
  communityItemId: Joi.string().uuid().required(),
  reactionType: Joi.string().valid('acknowledged', 'will_attend', 'concerned', 'thumbs_up').required(),
});

const rsvpSchema = Joi.object({
  communityItemId: Joi.string().uuid().required(),
});

const flagSchema = Joi.object({
  communityItemId: Joi.string().uuid().required(),
});

// ── Tasks ──
const createTaskSchema = Joi.object({
  mailId: Joi.string().uuid().required(),
  homeId: Joi.string().uuid().required(),
  title: Joi.string().max(255).required(),
  description: Joi.string().max(2000).optional(),
  dueAt: Joi.string().isoDate().optional(),
  priority: Joi.string().valid('low', 'medium', 'high').default('medium'),
});

const updateTaskSchema = Joi.object({
  status: Joi.string().valid('pending', 'in_progress', 'completed').optional(),
  title: Joi.string().max(255).optional(),
  priority: Joi.string().valid('low', 'medium', 'high').optional(),
  dueAt: Joi.string().isoDate().allow(null).optional(),
});

const taskToGigSchema = Joi.object({
  title: Joi.string().max(255).optional(),
  description: Joi.string().max(2000).optional(),
  compensation: Joi.number().min(0).optional(),
});

// ── MailDay ──
const updateMailDaySchema = Joi.object({
  // The GET returns the stored time column as HH:MM:SS; accept it back.
  delivery_time: Joi.string()
    .pattern(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/)
    .custom((value, helpers) => {
      const [hour, minute, second = 0] = value.split(':').map(Number);
      // The last quarter-hour job inside the existing daytime window is 19:45.
      if (hour * 60 + minute + second / 60 > 19 * 60 + 45) {
        return helpers.message({ custom: 'Delivery time must be 19:45 or earlier.' });
      }
      return value;
    })
    .optional(),
  timezone: Joi.string().max(50).optional(),
  enabled: Joi.boolean().optional(),
  sound_enabled: Joi.boolean().optional(),
  sound_type: Joi.string().valid('off', 'soft', 'classic').optional(),
  haptics_enabled: Joi.boolean().optional(),
  include_personal: Joi.boolean().optional(),
  include_home: Joi.boolean().optional(),
  include_business: Joi.boolean().optional(),
  include_earn_count: Joi.boolean().optional(),
  include_community: Joi.boolean().optional(),
  interrupt_time_sensitive: Joi.boolean().optional(),
  interrupt_packages_otd: Joi.boolean().optional(),
  interrupt_certified: Joi.boolean().optional(),
  current_theme: Joi.string().uuid().optional(),
});

// ── Stamps / Themes ──
const applyThemeSchema = Joi.object({
  // SeasonalTheme ids are text slugs ('autumn_2026'), not UUIDs.
  themeId: Joi.string().trim().max(64).required(),
});

// ── Memory ──
const dismissMemorySchema = Joi.object({
  // The read returns otd-* card IDs; UUIDs still identify existing stored rows.
  memoryId: Joi.alternatives().try(
    Joi.string().uuid(),
    Joi.string().pattern(/^otd-\d{4}-\d{1,2}-\d{1,2}$/),
  ).required(),
});

// ── Vacation ──
const vacationDay = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).custom((value, helpers) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return value.startsWith('0000-') || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
    ? helpers.error('date.base') : value;
});
const startVacationSchema = Joi.object({
  holdId: Joi.string().uuid().optional(),
  homeId: Joi.string().uuid().required(),
  startDate: vacationDay.required(),
  endDate: vacationDay.required(),
  holdAction: Joi.string().valid('hold_in_vault', 'forward_to_household', 'notify_urgent_only').required(),
  packageAction: Joi.string().valid('hold_at_carrier', 'ask_neighbor', 'locker').required(),
  autoNeighborRequest: Joi.boolean().default(false),
});

const cancelVacationSchema = Joi.object({
  holdId: Joi.string().uuid().required(),
});

// ============ HELPERS ============

async function logMailEvent(userId, eventType, mailId, metadata = {}) {
  try {
    await supabaseAdmin.from('MailEvent').insert({
      event_type: eventType,
      mail_id: mailId || null,
      user_id: userId,
      metadata,
    });
  } catch (err) {
    logger.error('[P3 MailEvent] Failed to log', { eventType, err: err.message });
  }
}

// Mail Day's "today" and greeting follow the person's push notification timezone, as the Mail
// Day push does (jobs/mailDayNotification.js); the server's own clock runs on UTC.
const { resolveNotificationTimezone } = require('../services/context/locationResolver');

async function mailDayNow(userId) {
  const { data: prefs } = await supabaseAdmin
    .from('UserNotificationPreferences')
    .select('daily_briefing_timezone')
    .eq('user_id', userId)
    .maybeSingle();
  return DateTime.now().setZone(await resolveNotificationTimezone(userId, prefs) || 'UTC');
}


function isUuid(value) {
  if (typeof value !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

function warrantyStatus(expiresAt) {
  if (!expiresAt) return 'none';
  const exp = new Date(expiresAt);
  const now = new Date();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  if (exp < now) return 'expired';
  if (exp - now < thirtyDays) return 'expiring_soon';
  return 'active';
}

// HomeAsset stores brand, model, purchase_date and warranty_expires_at. The
// records responses have always named them manufacturer, model_number,
// purchased_at and warranty_expires; those keys read columns that don't exist,
// so they were always empty and the warranty always "none".
function assetRecordFields(asset) {
  return {
    manufacturer: asset.brand,
    model_number: asset.model,
    purchased_at: asset.purchase_date,
    warranty_expires: asset.warranty_expires_at,
    warranty_status: warrantyStatus(asset.warranty_expires_at),
  };
}

// ====================================================================
//                      RECORDS ENDPOINTS
// ====================================================================

// ── Record photos ──
// A record's photos are stored in the private Home documents bucket, never at a public URL. AssetPhoto.url holds
// `storage:<object key>`. Reads replace it with a short-lived signed URL, and only for viewers with assets.view on the
// asset's Home; everyone else gets no photos.
const PHOTO_REF = 'storage:';
const PHOTO_URL_TTL_SECONDS = 300;
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const photoMultipart = multer({
  storage: multer.memoryStorage(),
  limits: { fieldNameSize: 100, fieldNestingDepth: 3, fieldArrayIndexLimit: 32, fileSize: taskMediaStorage.MAX_BYTES, files: 1, fields: 1, fieldSize: 100, parts: 3 },
}).single('file');

async function photoBucket() {
  const name = (process.env.HOME_DOCUMENTS_BUCKET || '').trim();
  if (!/^[a-z0-9][a-z0-9-]{2,62}$/.test(name)) return null;
  const { data, error } = await supabaseAdmin.storage.getBucket(name);
  // A public bucket would serve every photo without a Home permission check.
  if (error || !data || data.public !== false) return null;
  return supabaseAdmin.storage.from(name);
}

// The Homes, of those given, where the viewer may see records' photos.
async function photoViewHomes(homeIds, userId) {
  const allowed = new Set();
  await Promise.all([...new Set(homeIds)].map(async (homeId) => {
    if ((await checkHomePermission(homeId, userId, 'assets.view')).hasAccess) allowed.add(homeId);
  }));
  return allowed;
}

// The photos a viewer may see, each stored photo with a fresh signed URL. A photo whose URL can't be signed is left out.
async function presentPhotos(photos, homeOfAsset, viewHomes) {
  const visible = (photos || []).filter((p) => viewHomes.has(homeOfAsset(p.asset_id)));
  const isStored = (p) => typeof p.url === 'string' && p.url.startsWith(PHOTO_REF);
  const stored = visible.filter(isStored);
  const signed = new Map();
  if (stored.length) {
    const bucket = await photoBucket();
    if (bucket) {
      const { data, error } = await bucket.createSignedUrls(stored.map((p) => p.url.slice(PHOTO_REF.length)), PHOTO_URL_TTL_SECONDS);
      if (!error) (data || []).forEach((d, i) => { if (d && d.signedUrl && !d.error) signed.set(stored[i].id, d.signedUrl); });
    }
  }
  return visible.flatMap((p) => {
    if (!isStored(p)) return [p];
    return signed.has(p.id) ? [{ ...p, url: signed.get(p.id) }] : [];
  });
}

function photoError(res, status, message) {
  return res.status(status).json({ error: message });
}

// GET /records/assets — list home assets with mail link counts
router.get('/records/assets', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const homeId = req.query.homeId;
    // A requested Home narrows the caller's accessible Homes; it never widens them.
    const accessible = await getAccessibleHomeIds(userId);
    const homeIds = homeId && isUuid(homeId) ? accessible.filter((id) => id === homeId) : accessible;
    if (!homeIds.length) return res.json({ assets: [], rooms: [] });

    const { data: assets, error } = await supabaseAdmin
      .from('HomeAsset')
      .select('*')
      .in('home_id', homeIds)
      .order('name');

    if (error) throw error;

    // Get link counts
    const assetIds = (assets || []).map(a => a.id);
    let linkCounts = {};
    let gigCounts = {};
    if (assetIds.length) {
      const { data: links } = await supabaseAdmin
        .from('MailAssetLink')
        .select('asset_id')
        .in('asset_id', assetIds);
      (links || []).forEach(l => {
        linkCounts[l.asset_id] = (linkCounts[l.asset_id] || 0) + 1;
      });
    }

    // The assets' photos (AssetPhoto), newest first; cards show the first. Only viewers with assets.view see them.
    const photosByAsset = {};
    if (assetIds.length) {
      const { data: rows, error: photoReadError } = await supabaseAdmin
        .from('AssetPhoto')
        .select('id, asset_id, url, caption, taken_at')
        .in('asset_id', assetIds)
        .order('taken_at', { ascending: false });
      if (photoReadError) throw photoReadError;
      const homeOf = new Map((assets || []).map((a) => [a.id, a.home_id]));
      const viewHomes = await photoViewHomes([...homeOf.values()], userId);
      const photos = await presentPhotos(rows, (assetId) => homeOf.get(assetId), viewHomes);
      photos.forEach((p) => {
        (photosByAsset[p.asset_id] = photosByAsset[p.asset_id] || [])
          .push({ id: p.id, url: p.url, caption: p.caption, taken_at: p.taken_at });
      });
    }

    const rooms = [...new Set((assets || []).map(a => a.room).filter(Boolean))];

    const enriched = (assets || []).map(a => ({
      id: a.id,
      name: a.name,
      category: a.category || 'other',
      room: a.room,
      ...assetRecordFields(a),
      linked_mail_count: linkCounts[a.id] || 0,
      linked_gig_count: gigCounts[a.id] || 0,
      photo_url: photosByAsset[a.id]?.[0]?.url || null,
      photos: photosByAsset[a.id] || [],
    }));

    logMailEvent(userId, 'records_viewed', null, { homeIds });
    res.json({ assets: enriched, rooms });
  } catch (err) {
    logger.error('[P3] GET /records/assets failed', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// GET /records/asset/:id/mail — asset detail with linked mail + gigs
router.get('/records/asset/:id/mail', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const assetId = req.params.id;

    const { data: asset, error } = await supabaseAdmin
      .from('HomeAsset')
      .select('*')
      .eq('id', assetId)
      .single();

    if (error || !asset) return res.status(404).json({ error: 'Asset not found' });

    // Verify access
    const homeIds = await getAccessibleHomeIds(userId);
    if (!homeIds.includes(asset.home_id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get linked mail
    const { data: links } = await supabaseAdmin
      .from('MailAssetLink')
      .select('mail_id, link_type, created_at')
      .eq('asset_id', assetId)
      .order('created_at', { ascending: false });

    // Only linked mail the caller may see: their own, or Home letters the Home
    // mail rule shows them (utils/homeMailAccess, M01).
    const mailIds = (links || []).map(l => l.mail_id);
    let mail = [];
    if (mailIds.length) {
      const { data: mailItems, error: mailError } = await supabaseAdmin
        .from('Mail')
        .select('*')
        .in('id', mailIds)
        .or(visibleMailFilter(userId, homeIds))
        .lte('delivered_at', new Date().toISOString())
        .is('deleted_at', null);
      if (mailError) throw mailError;
      mail = mailItems || [];
    }

    // Get photos: only for viewers with assets.view on this Home, each with a fresh signed URL.
    const { data: photoRows, error: photoReadError } = await supabaseAdmin
      .from('AssetPhoto')
      .select('id, asset_id, url, caption, taken_at, uploaded_by, created_at')
      .eq('asset_id', assetId)
      .order('taken_at', { ascending: false });
    if (photoReadError) throw photoReadError;
    const photos = await presentPhotos(photoRows, () => asset.home_id, await photoViewHomes([asset.home_id], userId));

    const enrichedAsset = {
      ...asset,
      ...assetRecordFields(asset),
      linked_mail_count: mail.length,
      linked_gig_count: 0,
    };

    res.json({ asset: enrichedAsset, mail: presentMailSenders(await nameMailSenders(mail, userId), userId), gigs: [], photos: photos || [] });
  } catch (err) {
    logger.error('[P3] GET /records/asset/:id/mail failed', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch asset details' });
  }
});

// POST /records/asset/:id/photos — add a photo to a record (multipart field `file`). Needs assets.manage on the
// asset's Home. The photo goes to private storage; the response carries a signed URL for it.
router.post('/records/asset/:id/photos', verifyToken, async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return photoError(res, 404, 'Record not found');
    const { data: asset, error } = await supabaseAdmin
      .from('HomeAsset').select('id, home_id').eq('id', req.params.id).maybeSingle();
    if (error) throw error;
    // Someone outside the Home can't learn that the record exists.
    if (!asset || !(await checkHomePermission(asset.home_id, req.user.id)).hasAccess) {
      return photoError(res, 404, 'Record not found');
    }
    if (!(await checkHomePermission(asset.home_id, req.user.id, 'assets.manage')).hasAccess) {
      return photoError(res, 403, "You don't have permission to add photos to this record.");
    }
    req.photoAsset = asset;
    return next();
  } catch (err) {
    logger.error('[P3] POST /records/asset/:id/photos access check failed', { error: err.message });
    return photoError(res, 500, "Couldn't add this photo. Try again.");
  }
}, (req, res, next) => photoMultipart(req, res, (err) => {
  if (!err) return next();
  logger.warn('[P3] record photo upload rejected', { errorCode: err.code, message: err.message });
  return err.code === 'LIMIT_FILE_SIZE'
    ? photoError(res, 413, 'Choose a photo of 25 MB or less.')
    : photoError(res, 400, 'Choose one photo to upload.');
}), async (req, res) => {
  const asset = req.photoAsset;
  try {
    if (!req.file) return photoError(res, 400, 'Choose one photo to upload.');
    let meta;
    try {
      meta = taskMediaStorage.inspect(req.file);
    } catch (e) {
      if (e.status === 413) return photoError(res, 413, 'Choose a photo of 25 MB or less.');
      if (e.status === 415) return photoError(res, 415, 'Choose a JPEG, PNG, WebP or HEIC photo.');
      return photoError(res, 400, 'Choose one photo to upload.');
    }
    // inspect() has checked the bytes match the declared type; photos must also be images.
    if (!PHOTO_TYPES.has(meta.mime_type)) return photoError(res, 415, 'Choose a JPEG, PNG, WebP or HEIC photo.');
    const bucket = await photoBucket();
    if (!bucket) return photoError(res, 503, 'Photo storage is unavailable. Try again later.');
    const photoId = crypto.randomUUID();
    const key = `asset-photos/${asset.home_id}/${asset.id}/${photoId}/${meta.sha256}`;
    const uploaded = await bucket.upload(key, req.file.buffer, { contentType: meta.mime_type, cacheControl: '0', upsert: false });
    if (!uploaded || uploaded.error) return photoError(res, 503, "Couldn't upload this photo. Try again.");
    const { data: row, error: insertError } = await supabaseAdmin
      .from('AssetPhoto')
      .insert({ id: photoId, asset_id: asset.id, url: PHOTO_REF + key, uploaded_by: req.user.id })
      .select('id, asset_id, url, caption, taken_at')
      .single();
    if (insertError || !row) {
      await bucket.remove([key]).catch(() => {});
      return photoError(res, 500, "Couldn't save this photo. Try again.");
    }
    const [photo] = await presentPhotos([row], () => asset.home_id, new Set([asset.home_id]));
    return res.status(201).json({ photo: photo || { ...row, url: null } });
  } catch (err) {
    logger.error('[P3] POST /records/asset/:id/photos failed', { error: err.message });
    return photoError(res, 500, "Couldn't add this photo. Try again.");
  }
});

// POST /records/link — link a mail item to an asset
router.post('/records/link', verifyToken, validate(linkAssetSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { mailId, assetId, linkType } = req.body;

    // Link only mail the caller may read (utils/homeMailAccess canAccessMail:
    // their own mail, or their accessible Home's letters the Home mail rule
    // shows them) to an asset of a Home they can access.
    const accessible = await getAccessibleHomeIds(userId);
    const [assetRes, mailRes] = await Promise.all([
      supabaseAdmin.from('HomeAsset').select('home_id').eq('id', assetId).maybeSingle(),
      supabaseAdmin.from('Mail').select('id, recipient_user_id, recipient_home_id').eq('id', mailId).maybeSingle(),
    ]);
    if (assetRes.error || mailRes.error) throw assetRes.error || mailRes.error;
    if (!assetRes.data || !accessible.includes(assetRes.data.home_id)) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    const mail = mailRes.data;
    if (!mail || !(await canAccessMail(mail, userId))) {
      return res.status(404).json({ error: 'Mail not found' });
    }

    const { data: link, error } = await supabaseAdmin
      .from('MailAssetLink')
      .insert({
        mail_id: mailId,
        asset_id: assetId,
        linked_by: userId,
        link_type: linkType || 'manual',
        confidence: linkType === 'manual' ? 1.0 : 0.8,
      })
      .select()
      .single();

    if (error) throw error;
    logMailEvent(userId, 'asset_linked', mailId, { assetId, linkType });
    res.json({ link });
  } catch (err) {
    logger.error('[P3] POST /records/link failed', { error: err.message });
    res.status(500).json({ error: 'Failed to link' });
  }
});

// DELETE /records/unlink/:id — remove a link
router.delete('/records/unlink/:id', verifyToken, async (req, res) => {
  try {
    // Only the household whose asset carries the link may remove it.
    if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Link not found' });
    const { data: link, error: linkErr } = await supabaseAdmin
      .from('MailAssetLink')
      .select('asset_id')
      .eq('id', req.params.id)
      .maybeSingle();
    if (linkErr) throw linkErr;
    const assetRes = link
      ? await supabaseAdmin.from('HomeAsset').select('home_id').eq('id', link.asset_id).maybeSingle()
      : { data: null, error: null };
    if (assetRes.error) throw assetRes.error;
    const accessible = await getAccessibleHomeIds(req.user.id);
    if (!assetRes.data || !accessible.includes(assetRes.data.home_id)) {
      return res.status(404).json({ error: 'Link not found' });
    }

    const { error } = await supabaseAdmin
      .from('MailAssetLink')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Unlinked' });
  } catch (err) {
    logger.error('[P3] DELETE /records/unlink failed', { error: err.message });
    res.status(500).json({ error: 'Failed to unlink' });
  }
});

// POST /records/auto-detect — scan recent mail for asset mentions
router.post('/records/auto-detect', verifyToken, validate(autoDetectSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { homeId } = req.body;

    // Get recent mail with key_facts
    // Mail has no delivered_at/sender_name columns: read created_at and
    // sender_display (aliased to the existing response keys) and fail loudly
    // instead of reporting no detections.
    const { data: recentMail, error: recentErr } = await supabaseAdmin
      .from('Mail')
      .select('id, subject, key_facts, sender_name:sender_display')
      .eq('recipient_user_id', userId)
      .lte('delivered_at', new Date().toISOString())
      .is('deleted_at', null)
      .not('key_facts', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);
    if (recentErr) throw recentErr;

    // Simple keyword detection for appliances / assets
    const ASSET_KEYWORDS = ['warranty', 'appliance', 'model', 'serial number', 'installation', 'repair', 'maintenance', 'manual'];
    const detections = [];

    (recentMail || []).forEach(mail => {
      const kf = typeof mail.key_facts === 'string' ? mail.key_facts : JSON.stringify(mail.key_facts || {});
      const matchedKeywords = ASSET_KEYWORDS.filter(kw => kf.toLowerCase().includes(kw));
      if (matchedKeywords.length > 0) {
        detections.push({
          candidate_name: mail.subject || 'Unknown Item',
          candidate_brand: mail.sender_name,
          candidate_model: null,
          confidence: Math.min(0.5 + matchedKeywords.length * 0.15, 0.95),
          source_mail_id: mail.id,
          source_field: 'key_facts',
        });
      }
    });

    logMailEvent(userId, 'auto_detect_run', null, { homeId, found: detections.length });
    res.json({ detections, count: detections.length });
  } catch (err) {
    logger.error('[P3] POST /records/auto-detect failed', { error: err.message });
    res.status(500).json({ error: 'Auto-detect failed' });
  }
});

// GET /records/suggestions — get unlinked suggestions
router.get('/records/suggestions', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const homeId = req.query.homeId;

    // Find mail items with warranty/appliance keywords that aren't linked yet
    const { data: linkedMailIds, error: linkedErr } = await supabaseAdmin
      .from('MailAssetLink')
      .select('mail_id');
    if (linkedErr) throw linkedErr;
    const excludeIds = (linkedMailIds || []).map(l => l.mail_id);

    const { data: candidates, error: candidatesErr } = await supabaseAdmin
      .from('Mail')
      .select('id, subject, key_facts, sender_name:sender_display, category')
      .eq('recipient_user_id', userId)
      .lte('delivered_at', new Date().toISOString())
      .is('deleted_at', null)
      .not('key_facts', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30);
    if (candidatesErr) throw candidatesErr;

    const ASSET_KEYWORDS = ['warranty', 'appliance', 'model', 'serial', 'installation', 'repair'];
    const suggestions = [];

    (candidates || []).filter(m => !excludeIds.includes(m.id)).forEach(mail => {
      const kf = typeof mail.key_facts === 'string' ? mail.key_facts : JSON.stringify(mail.key_facts || {});
      const matched = ASSET_KEYWORDS.filter(kw => kf.toLowerCase().includes(kw));
      if (matched.length > 0) {
        suggestions.push({
          mail,
          detections: [{
            candidate_name: mail.subject || 'Unknown',
            candidate_brand: mail.sender_name,
            confidence: Math.min(0.5 + matched.length * 0.15, 0.95),
            source_mail_id: mail.id,
            source_field: 'key_facts',
          }],
        });
      }
    });

    res.json({ suggestions: suggestions.slice(0, 10) });
  } catch (err) {
    logger.error('[P3] GET /records/suggestions failed', { error: err.message });
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

// ====================================================================
//                        MAP ENDPOINTS
// ====================================================================

// Personal pins stay with their creator even inside a shared Home. A direct
// link must have the same audience and expiry as the map list.
function readableMapPins(userId, homeIds) {
  return supabaseAdmin.from('HomeMapPin').select('*')
    .in('home_id', homeIds)
    .or(`visible_to.is.null,visible_to.neq.personal,created_by.eq.${userId}`)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
}

async function readablePinMail(mailIds, userId, homeIds, select = 'id') {
  const ids = [...new Set(mailIds.filter(Boolean))];
  const rows = [];
  for (let offset = 0; offset < ids.length; offset += 100) {
    const { data, error } = await onlyDelivered(supabaseAdmin.from('Mail').select(select)
      .in('id', ids.slice(offset, offset + 100)).or(visibleMailFilter(userId, homeIds)))
      .is('deleted_at', null).or('lifecycle.is.null,lifecycle.neq.shredded');
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
}

// GET /map/pins — get pins within bounds
router.get('/map/pins', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const homeId = req.query.homeId;
    const pinType = req.query.type;
    // A requested Home narrows the caller's accessible Homes; it never widens them.
    const accessible = await getAccessibleHomeIds(userId);
    const homeIds = homeId && isUuid(homeId) ? accessible.filter((id) => id === homeId) : accessible;
    if (!homeIds.length) return res.json({ pins: [] });

    let query = readableMapPins(userId, homeIds)
      .order('created_at', { ascending: false });

    if (pinType) query = query.eq('pin_type', pinType);

    // Bounds filtering
    if (req.query.north && req.query.south && req.query.east && req.query.west) {
      query = query
        .gte('lat', parseFloat(req.query.south))
        .lte('lat', parseFloat(req.query.north))
        .gte('lng', parseFloat(req.query.west))
        .lte('lng', parseFloat(req.query.east));
    }

    const { data: pins, error } = await query;
    if (error) throw error;

    // The list supplies the apps' "View full notice" links. A shared pin
    // must not offer a link to another person's private or removed letter.
    const mail = await readablePinMail((pins || []).map(pin => pin.mail_id), userId, accessible);
    const readableIds = new Set(mail.map(row => row.id));
    const visiblePins = (pins || []).map(pin => ({
      ...pin, mail_id: readableIds.has(pin.mail_id) ? pin.mail_id : null,
    }));
    logMailEvent(userId, 'map_viewed', null, { homeIds, count: (pins || []).length });
    res.json({ pins: visiblePins });
  } catch (err) {
    logger.error('[P3] GET /map/pins failed', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch pins' });
  }
});

// POST /map/pin — create a new pin
router.post('/map/pin', verifyToken, validate(createPinSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { homeId, mailId, pinType, title, body, lat, lng, radiusMeters, visibleTo, expiresAt } = req.body;

    // Verify home access
    const homeIds = await getAccessibleHomeIds(userId);
    if (!homeIds.includes(homeId)) {
      return res.status(403).json({ error: 'Not a member of this home' });
    }
    // A pin may only link mail the caller may read (the mailbox per-item rule).
    if (mailId && !(await readableMail(mailId, userId))) return res.status(404).json({ error: 'Mail not found' });

    const { data: pin, error } = await supabaseAdmin
      .from('HomeMapPin')
      .insert({
        home_id: homeId,
        mail_id: mailId || null,
        created_by: userId,
        pin_type: pinType,
        title,
        body: body || null,
        lat,
        lng,
        radius_meters: radiusMeters || null,
        visible_to: visibleTo || 'household',
        expires_at: expiresAt || null,
      })
      .select()
      .single();

    if (error) throw error;
    logMailEvent(userId, 'map_pin_created', mailId, { pinType, pinId: pin.id });
    res.json({ pin });
  } catch (err) {
    logger.error('[P3] POST /map/pin failed', { error: err.message });
    res.status(500).json({ error: 'Failed to create pin' });
  }
});

// GET /map/pin/:id — pin detail
router.get('/map/pin/:id', verifyToken, async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Pin not found' });
    const accessible = await getAccessibleHomeIds(req.user.id);
    if (!accessible.length) return res.status(404).json({ error: 'Pin not found' });
    const { data: pin, error } = await readableMapPins(req.user.id, accessible)
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!pin) return res.status(404).json({ error: 'Pin not found' });

    // Sharing a pin never grants access to its source letter. Use the same
    // recipient, delivery and retention rules as the mailbox, and name the
    // sender through its public-facing identity.
    let linked_mail = null;
    if (pin.mail_id) {
      const [mail] = await readablePinMail([pin.mail_id], req.user.id, accessible,
        `id, subject, sender_name:sender_display, category, delivered_at, ${MAIL_SENDER_FIELDS}`);
      linked_mail = mail ? (await withSenderNames([mail], req.user.id))[0] : null;
    }

    res.json({ pin: { ...pin, mail_id: linked_mail ? pin.mail_id : null, linked_mail } });
  } catch (err) {
    logger.error('[P3] GET /map/pin/:id failed', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch pin' });
  }
});

// DELETE /map/pin/:id — delete a pin
router.delete('/map/pin/:id', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: pin } = await supabaseAdmin
      .from('HomeMapPin')
      .select('created_by')
      .eq('id', req.params.id)
      .single();

    if (!pin) return res.status(404).json({ error: 'Pin not found' });
    if (pin.created_by !== userId) return res.status(403).json({ error: 'Not your pin' });

    await supabaseAdmin.from('HomeMapPin').delete().eq('id', req.params.id);
    res.json({ message: 'Pin deleted' });
  } catch (err) {
    logger.error('[P3] DELETE /map/pin/:id failed', { error: err.message });
    res.status(500).json({ error: 'Failed to delete pin' });
  }
});

// ====================================================================
//                     COMMUNITY ENDPOINTS
// ====================================================================

// GET /community/feed — neighborhood mail feed
router.get('/community/feed', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const communityType = req.query.type;

    const homeIds = await getAccessibleHomeIds(userId);
    if (!homeIds.length) return res.json({ items: [], total: 0 });

    let query = supabaseAdmin
      .from('CommunityMailItem')
      .select('*', { count: 'exact' })
      .in('home_id', homeIds)
      .order('created_at', { ascending: false })
      // Mail delivered together shares created_at; the id keeps the order the same on every page.
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1);

    if (communityType) query = query.eq('community_type', communityType);

    const { data: items, count, error } = await query;
    if (error) throw error;

    // Enrich with reactions
    const itemIds = (items || []).map(i => i.id);
    let reactionMap = {};
    let userReactionMap = {};
    if (itemIds.length) {
      const { data: reactions } = await supabaseAdmin
        .from('CommunityReaction')
        .select('community_item_id, reaction_type, user_id')
        .in('community_item_id', itemIds);

      (reactions || []).forEach(r => {
        if (!reactionMap[r.community_item_id]) reactionMap[r.community_item_id] = {};
        reactionMap[r.community_item_id][r.reaction_type] = (reactionMap[r.community_item_id][r.reaction_type] || 0) + 1;
        if (r.user_id === userId) {
          if (!userReactionMap[r.community_item_id]) userReactionMap[r.community_item_id] = [];
          userReactionMap[r.community_item_id].push(r.reaction_type);
        }
      });
    }

    const enriched = (items || []).map(item => ({
      ...item,
      reactions: Object.entries(reactionMap[item.id] || {}).map(([reaction_type, count]) => ({
        reaction_type,
        count,
      })),
      user_reactions: userReactionMap[item.id] || [],
    }));

    logMailEvent(userId, 'community_feed_viewed', null, { count: enriched.length });
    res.json({ items: enriched, total: count || 0 });
  } catch (err) {
    logger.error('[P3] GET /community/feed failed', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

// POST /community/publish — share mail with community
router.post('/community/publish', verifyToken, validate(publishSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { mailId, commentary, publishedTo } = req.body;

    // Get the mail item
    const { data: mail } = await supabaseAdmin
      .from('Mail')
      .select('*')
      .eq('id', mailId)
      .eq('recipient_user_id', userId)
      .is('deleted_at', null)
      .single();

    if (!mail) return res.status(404).json({ error: 'Mail not found' });

    const homeIds = await getAccessibleHomeIds(userId);
    if (!homeIds.length) return res.status(400).json({ error: 'No home associated' });

    // Privacy: strip sensitive key_facts, only share subject + sender + category
    const { data: item, error } = await supabaseAdmin
      .from('CommunityMailItem')
      .insert({
        mail_id: mailId,
        published_by: userId,
        home_id: homeIds[0],
        community_type: categoryCommunityType(mail.category),
        published_to: publishedTo || 'neighborhood',
        title: mail.subject || 'Shared Mail',
        body: commentary || null,
        sender_display: mail.sender_name,
        sender_trust: mail.sender_trust || null,
        category: mail.category,
        verified_sender: ['verified_gov', 'verified_utility', 'verified_company'].includes(mail.sender_trust),
        views: 0,
        neighbors_received: 0,
        rsvp_count: 0,
      })
      .select()
      .single();

    if (error) throw error;

    // Mark mail as community_published
    await supabaseAdmin
      .from('Mail')
      .update({ community_published: true })
      .eq('id', mailId);

    // Estimate reach
    const { count: neighborCount } = await supabaseAdmin
      .from('HomeOccupancy')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    const reach = Math.min(neighborCount || 0, 50);
    await supabaseAdmin
      .from('CommunityMailItem')
      .update({ neighbors_received: reach })
      .eq('id', item.id);

    logMailEvent(userId, 'community_published', mailId, { itemId: item.id, publishedTo, reach });
    res.json({ item: { ...item, reactions: [], user_reactions: [], neighbors_received: reach }, reach });
  } catch (err) {
    logger.error('[P3] POST /community/publish failed', { error: err.message });
    res.status(500).json({ error: 'Failed to publish' });
  }
});

// POST /community/react — add a reaction
router.post('/community/react', verifyToken, validate(reactSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { communityItemId, reactionType } = req.body;

    // Toggle: if already reacted with same type, remove it
    const { data: existing } = await supabaseAdmin
      .from('CommunityReaction')
      .select('id')
      .eq('community_item_id', communityItemId)
      .eq('user_id', userId)
      .eq('reaction_type', reactionType);

    if (existing && existing.length > 0) {
      await supabaseAdmin
        .from('CommunityReaction')
        .delete()
        .eq('id', existing[0].id);
    } else {
      await supabaseAdmin
        .from('CommunityReaction')
        .insert({
          community_item_id: communityItemId,
          user_id: userId,
          reaction_type: reactionType,
        });
    }

    // Return updated counts
    const { data: allReactions } = await supabaseAdmin
      .from('CommunityReaction')
      .select('reaction_type')
      .eq('community_item_id', communityItemId);

    const counts = {};
    (allReactions || []).forEach(r => {
      counts[r.reaction_type] = (counts[r.reaction_type] || 0) + 1;
    });

    const reactions = Object.entries(counts).map(([reaction_type, count]) => ({
      reaction_type,
      count,
    }));

    res.json({ message: 'Reaction updated', reactions });
  } catch (err) {
    logger.error('[P3] POST /community/react failed', { error: err.message });
    res.status(500).json({ error: 'Failed to react' });
  }
});

// POST /community/rsvp — RSVP to a community event
router.post('/community/rsvp', verifyToken, validate(rsvpSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { communityItemId } = req.body;

    // Add will_attend reaction
    const { data: existing } = await supabaseAdmin
      .from('CommunityReaction')
      .select('id')
      .eq('community_item_id', communityItemId)
      .eq('user_id', userId)
      .eq('reaction_type', 'will_attend');

    if (!existing || existing.length === 0) {
      await supabaseAdmin
        .from('CommunityReaction')
        .insert({
          community_item_id: communityItemId,
          user_id: userId,
          reaction_type: 'will_attend',
        });
    }

    // Update rsvp_count
    const { count: rsvpCount } = await supabaseAdmin
      .from('CommunityReaction')
      .select('*', { count: 'exact', head: true })
      .eq('community_item_id', communityItemId)
      .eq('reaction_type', 'will_attend');

    await supabaseAdmin
      .from('CommunityMailItem')
      .update({ rsvp_count: rsvpCount || 0 })
      .eq('id', communityItemId);

    logMailEvent(userId, 'community_rsvp', null, { communityItemId });
    res.json({ message: 'RSVP confirmed', rsvpCount: rsvpCount || 0 });
  } catch (err) {
    logger.error('[P3] POST /community/rsvp failed', { error: err.message });
    res.status(500).json({ error: 'Failed to RSVP' });
  }
});

// POST /community/flag — flag a community item
router.post('/community/flag', verifyToken, validate(flagSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { communityItemId } = req.body;

    // Add concerned reaction as a flag
    await supabaseAdmin
      .from('CommunityReaction')
      .insert({
        community_item_id: communityItemId,
        user_id: userId,
        reaction_type: 'concerned',
      });

    logMailEvent(userId, 'community_flagged', null, { communityItemId });
    res.json({ message: 'Item flagged for review' });
  } catch (err) {
    logger.error('[P3] POST /community/flag failed', { error: err.message });
    res.status(500).json({ error: 'Failed to flag' });
  }
});

function categoryCommunityType(category) {
  const mapping = {
    government: 'civic_notice',
    permit: 'civic_notice',
    utility: 'civic_notice',
    event: 'neighborhood_event',
    community: 'neighborhood_event',
    business: 'local_business',
    hoa: 'building_announcement',
    building: 'building_announcement',
  };
  return mapping[category] || 'civic_notice';
}

// ====================================================================
//                       TASK ENDPOINTS
// ====================================================================

// The mail interface keeps its legacy pending/completed labels; persisted
// Home tasks use canonical open/done status and immutable source provenance.
const mailTaskDto = task => ({ ...task, status: ({ open: 'pending', done: 'completed' })[task.status] || task.status });
// get_home_records gives a task's letter as mail_sender, the name stored when the letter came: a person who sent it is
// named again as neighbors see them now (their Local Profile). A letter that can't be read keeps the stored name.
async function withTaskMailSenders(tasks, viewerId) {
  const mailIds = [...new Set(tasks.filter(t => t.mail_sender && t.source_mail_id).map(t => t.source_mail_id))];
  if (!mailIds.length) return tasks;
  const { data: stored, error } = await supabaseAdmin.from('Mail')
    .select(`id, sender_display, ${MAIL_SENDER_FIELDS}`).in('id', mailIds);
  if (error) {
    logger.warn('[P3] task letter senders not read', { error: error.message });
    return tasks;
  }
  const named = await nameMailSenders(stored || [], viewerId);
  const names = new Map(named.filter((letter, i) => letter !== stored[i]).map(letter => [letter.id, letter.sender_display]));
  return tasks.map(t => (t.mail_sender && names.has(t.source_mail_id) ? { ...t, mail_sender: names.get(t.source_mail_id) } : t));
}
router.get('/tasks', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const homeId = req.query.homeId;
    if (homeId && !isUuid(homeId)) return res.status(400).json({ error: 'Invalid Home id' });
    const homeIds = homeId ? [homeId] : await getAccessibleHomeIds(userId);
    const sets = await Promise.all(homeIds.map(id => homeId
      ? homeRecordService.list({ homeId: id, actorId: userId, kind: 'task', mailOnly: true }).then(r => r.records)
      : homeRecordService.visibleRecords({ homeId: id, actorId: userId, kind: 'task', mailOnly: true })));
    const tasks = (await withTaskMailSenders(sets.flat(), userId)).map(mailTaskDto);
    res.json({ active: tasks.filter(t => !['completed', 'canceled'].includes(t.status)),
      completed: tasks.filter(t => t.status === 'completed') });
  } catch (error) { homeRecordService.sendError(res, error); }
});
router.post('/tasks/from-mail', verifyToken, validate(createTaskSchema), async (req, res) => {
  try {
    const { mailId, homeId, title, description, dueAt, priority } = req.body;
    // A deleted letter can't source a task: the Home task rule checks the
    // letter itself but not its deletion (a missing letter is refused there).
    if (mailId) {
      const { data: source, error: sourceError } = await supabaseAdmin
        .from('Mail').select('deleted_at').eq('id', mailId).maybeSingle();
      if (sourceError || source?.deleted_at) return res.status(404).json({ error: 'Mail not found' });
    }
    const result = await homeRecordService.mutate({ homeId, actorId: req.user.id, kind: 'task', action: 'create',
      sourceMailId: mailId, payload: { task_type: 'reminder', title, description: description ?? null,
        due_at: dueAt ?? null, priority, status: 'open' } });
    // A creator re-submitting a mail that already has their task gets that task back; say so, so apps don't
    // announce a new one.
    res.json({ task: mailTaskDto(result.record), ...(result.replayed === true ? { replayed: true } : {}) });
  } catch (error) { homeRecordService.sendError(res, error); }
});
router.patch('/tasks/:id', verifyToken, validate(updateTaskSchema), async (req, res) => {
  try {
    const payload = {};
    for (const key of ['title', 'priority']) if (req.body[key] !== undefined) payload[key] = req.body[key];
    if (req.body.status !== undefined) payload.status = ({ pending: 'open', completed: 'done' })[req.body.status] || req.body.status;
    if (req.body.dueAt !== undefined) payload.due_at = req.body.dueAt;
    const result = await homeRecordService.mutateTaskById({ actorId: req.user.id, taskId: req.params.id, action: 'update', payload });
    if (result.task_completed === true && result.record.created_by && result.record.created_by !== req.user.id) {
      await notificationService.notifyTaskCompleted({ creatorUserId: result.record.created_by,
        homeId: result.record.home_id, taskId: result.record.id, completedAt: result.record.completed_at });
    }
    res.json({ task: mailTaskDto(result.record) });
  } catch (error) { homeRecordService.sendError(res, error); }
});
router.post('/tasks/:id/to-gig', verifyToken, validate(taskToGigSchema), async (req, res) => {
  try {
    await homeRecordService.mutateTaskById({ actorId: req.user.id, taskId: req.params.id, action: 'authorize_publication' });
    res.status(409).json({ error: 'Use the gig creation flow to publish this task.', code: 'HOME_TASK_GIG_FLOW_REQUIRED' });
  } catch (error) { homeRecordService.sendError(res, error); }
});

// ====================================================================
//                      MAIL DAY ENDPOINTS
// ====================================================================

// GET /mailday/summary — daily mail summary
router.get('/mailday/summary', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const [homeIds, now] = await Promise.all([getAccessibleHomeIds(userId), mailDayNow(userId)]);
    const todayStart = now.startOf('day').toJSDate();

    // Mail has no delivered_at/read columns (created_at and viewed are the
    // delivery time and read state); a failed read must not become "no mail".
    // New means what the drawer badges count: unread and still in Incoming
    // (not archived, filed or dismissed), here limited to today.
    const { data: newMail, error: newErr } = await supabaseAdmin
      .from('Mail')
      .select('*')
      .eq('recipient_user_id', userId)
      .is('deleted_at', null)
      .lte('delivered_at', new Date().toISOString())
      .eq('viewed', false)
      .eq('archived', false)
      .in('lifecycle', ['delivered', 'opened'])
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false });
    if (newErr) throw newErr;

    // Get needs attention (unread, overdue, certified), from what is still in Incoming
    const { data: attention, error: attentionErr } = await supabaseAdmin
      .from('Mail')
      .select('*')
      .eq('recipient_user_id', userId)
      .is('deleted_at', null)
      .lte('delivered_at', new Date().toISOString())
      .eq('viewed', false)
      .eq('archived', false)
      .in('lifecycle', ['delivered', 'opened'])
      .in('category', ['certified', 'government', 'bill', 'legal'])
      .order('created_at', { ascending: false })
      .limit(5);
    if (attentionErr) throw attentionErr;

    // Earn count: the same active, unexpired offers the Earn list shows
    // (EarnOffer has no is_published column). Earn is launch-cut with
    // mail_extras, so it isn't counted while that is off.
    let earnCount = 0;
    if (isLaunchFeatureEnabled('mail_extras')) {
      const { count, error: earnErr } = await supabaseAdmin
        .from('EarnOffer')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
      if (earnErr) throw earnErr;
      earnCount = count || 0;
    }

    // Community count (today)
    let communityCount = 0;
    if (homeIds.length) {
      const { count } = await supabaseAdmin
        .from('CommunityMailItem')
        .select('*', { count: 'exact', head: true })
        .in('home_id', homeIds)
        .gte('created_at', todayStart.toISOString());
      communityCount = count || 0;
    }

    // Get greeting based on the person's local time
    const hour = now.hour;
    let greeting;
    if (hour < 12) greeting = 'Good morning';
    else if (hour < 17) greeting = 'Good afternoon';
    else greeting = 'Good evening';

    // Memory (on this day, in the person's timezone)
    let memory = null;
    const oneYearAgo = now.minus({ years: 1 });
    const dayStr = `${oneYearAgo.month}-${oneYearAgo.day}`;
    const { data: oldMail, error: oldErr } = await supabaseAdmin
      .from('Mail')
      .select(`id, subject, sender_name:sender_display, delivered_at:created_at, ${MAIL_SENDER_FIELDS}`)
      .eq('recipient_user_id', userId)
      .is('deleted_at', null)
      .gte('created_at', oneYearAgo.startOf('day').toJSDate().toISOString())
      .lt('created_at', oneYearAgo.startOf('day').plus({ days: 1 }).toJSDate().toISOString())
      .limit(3);
    if (oldErr) throw oldErr;

    if (oldMail && oldMail.length > 0) {
      memory = {
        id: `otd-${dayStr}`,
        memory_type: 'on_this_day',
        reference_date: oneYearAgo.toJSDate().toISOString(),
        headline: `This day last year`,
        body: `You received ${oldMail.length} item${oldMail.length > 1 ? 's' : ''}`,
        mail_items: await withSenderNames(oldMail, userId),
        dismissed: false,
      };
    }

    logMailEvent(userId, 'mailday_summary_viewed', null);
    res.json({
      greeting,
      total_new: (newMail || []).length,
      arrivals: presentMailSenders(await nameMailSenders(newMail || [], userId), userId),
      needs_attention: presentMailSenders(await nameMailSenders(attention || [], userId), userId),
      earn_count: earnCount || 0,
      community_count: communityCount,
      memory,
    });
  } catch (err) {
    logger.error('[P3] GET /mailday/summary failed', { error: err.message });
    res.status(500).json({ error: 'Failed to get summary' });
  }
});

// GET /mailday/settings — user's mail day preferences
router.get('/mailday/settings', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: settings, error } = await supabaseAdmin
      .from('MailDaySettings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;

    if (!settings) {
      // Return defaults
      return res.json({
        delivery_time: '08:00',
        timezone: 'America/New_York',
        enabled: true,
        sound_enabled: true,
        sound_type: 'soft',
        haptics_enabled: true,
        include_personal: true,
        include_home: true,
        include_business: true,
        include_earn_count: true,
        include_community: true,
        interrupt_time_sensitive: true,
        interrupt_packages_otd: true,
        interrupt_certified: true,
        current_theme: null,
      });
    }

    res.json(settings);
  } catch (err) {
    logger.error('[P3] GET /mailday/settings failed', { error: err.message });
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// PATCH /mailday/settings — update settings
router.patch('/mailday/settings', verifyToken, validate(updateMailDaySchema), async (req, res) => {
  try {
    const userId = req.user.id;

    // Upsert. MailDaySettings is keyed by user_id and has no id column: the
    // old select('id') always failed, so every save after the first tried a
    // second insert and hit the primary key.
    const { data: existing, error: existingErr } = await supabaseAdmin
      .from('MailDaySettings')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (existingErr) throw existingErr;

    let settings;
    if (existing) {
      const { data, error } = await supabaseAdmin
        .from('MailDaySettings')
        .update(req.body)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) throw error;
      settings = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from('MailDaySettings')
        .insert({ user_id: userId, ...req.body })
        .select()
        .single();
      if (error) throw error;
      settings = data;
    }

    logMailEvent(userId, 'mailday_settings_updated', null, { fields: Object.keys(req.body) });
    res.json({ settings });
  } catch (err) {
    logger.error('[P3] PATCH /mailday/settings failed', { error: err.message });
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ====================================================================
//                      STAMP ENDPOINTS
// ====================================================================

// The count a stamp goal measures, read the way the stamp awarder reads it. null when the read fails,
// so the gallery shows the stamp without a progress bar rather than failing or showing a wrong number.
async function countStampMetric(userId, metric) {
  try {
    return await readStampMetric(userId, metric);
  } catch (error) {
    logger.warn('[P3] stamp progress count failed', { metric, error: error.message });
    return null;
  }
}

// GET /stamps — user's stamp gallery
router.get('/stamps', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: earned, error: earnedError } = await supabaseAdmin
      .from('Stamp')
      .select('*')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false });
    if (earnedError) throw earnedError;

    // Define all available stamps
    const ALL_STAMPS = [
      { stamp_type: 'first_mail', name: 'First Mail', description: 'Received your first mail item', rarity: 'common' },
      { stamp_type: 'ten_items', name: 'Mail Regular', description: 'Received 10 mail items', rarity: 'common' },
      { stamp_type: 'fifty_items', name: 'Mail Enthusiast', description: 'Received 50 mail items', rarity: 'uncommon' },
      { stamp_type: 'hundred_items', name: 'Mail Centurion', description: 'Received 100 mail items', rarity: 'rare' },
      { stamp_type: 'first_package', name: 'Package Day', description: 'Received your first package', rarity: 'common' },
      { stamp_type: 'first_certified', name: 'Certified', description: 'Handled your first certified mail', rarity: 'uncommon' },
      { stamp_type: 'first_gig', name: 'Good Neighbor', description: 'Created your first neighbor gig', rarity: 'uncommon' },
      { stamp_type: 'vault_organizer', name: 'Organized', description: 'Filed 10 items in vault', rarity: 'common' },
      { stamp_type: 'community_contributor', name: 'Community Voice', description: 'Shared with your community', rarity: 'uncommon' },
      { stamp_type: 'task_master', name: 'Task Master', description: 'Completed 5 mail tasks', rarity: 'uncommon' },
      { stamp_type: 'year_one', name: 'Anniversary', description: 'One year of mail management', rarity: 'rare' },
      { stamp_type: 'streak_30', name: 'Monthly Streak', description: '30-day mail check streak', rarity: 'rare' },
      { stamp_type: 'collector', name: 'Collector', description: 'Earned 10 stamps', rarity: 'legendary' },
    ];

    // Only stamps the stamp awarder can grant: the others (a gig, community
    // mail, signing certified mail, streaks) have no award path, and some
    // belong to features cut for launch, so they'd be goals nobody can reach.
    const available = ALL_STAMPS.filter(s => AWARDED_STAMP_TYPES.has(s.stamp_type));
    const earnedTypes = new Set((earned || []).map(s => s.stamp_type));
    const lockedStamps = available.filter(s => !earnedTypes.has(s.stamp_type));
    // Real progress toward each locked stamp ("Received 10 mail items" with 9 received reads 9 of 10;
    // it used to say 0 of 1 for every stamp). One count per measured metric, read together.
    const metrics = [...new Set(lockedStamps.map(s => STAMP_GOALS[s.stamp_type]?.metric).filter(Boolean))];
    const counts = Object.fromEntries(await Promise.all(
      metrics.map(async metric => [metric, await countStampMetric(userId, metric)]),
    ));
    const locked = lockedStamps.map((s) => {
      const goal = STAMP_GOALS[s.stamp_type];
      const count = goal ? counts[goal.metric] : null;
      return { ...s, progress: typeof count === 'number' ? Math.min(count, goal.target) : null, target: goal ? goal.target : null };
    });

    res.json({
      earned: earned || [],
      locked,
      total_earned: (earned || []).length,
      // Retained awards from a currently disabled feature still appear in the
      // collection, so the denominator must include them too.
      total_available: (earned || []).length + locked.length,
    });
  } catch (err) {
    logger.error('[P3] GET /stamps failed', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch stamps' });
  }
});

// A theme can be applied once it is unlocked: the default and seasonal themes
// always, the others inside their active window.
function isThemeUnlocked(theme, now) {
  return theme.unlock_condition === 'default' ||
    theme.unlock_condition === 'seasonal_auto' ||
    Boolean(theme.active_from && theme.active_until &&
      now >= new Date(theme.active_from) && now <= new Date(theme.active_until));
}

// GET /themes — seasonal themes
router.get('/themes', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // The themes and the user's active theme are read together.
    const [{ data: themes }, { data: settings }] = await Promise.all([
      supabaseAdmin
        .from('SeasonalTheme')
        .select('*')
        .order('name'),
      supabaseAdmin
        .from('MailDaySettings')
        .select('current_theme')
        .eq('user_id', userId)
        .single(),
    ]);

    const now = new Date();
    const enriched = (themes || []).map(t => ({
      ...t,
      unlocked: isThemeUnlocked(t, now),
    }));

    res.json({
      themes: enriched,
      active: settings?.current_theme || null,
    });
  } catch (err) {
    logger.error('[P3] GET /themes failed', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch themes' });
  }
});

// POST /themes/apply — apply a theme
router.post('/themes/apply', verifyToken, validate(applyThemeSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { themeId } = req.body;

    const { data: theme, error: themeErr } = await supabaseAdmin
      .from('SeasonalTheme')
      .select('*')
      .eq('id', themeId)
      .maybeSingle();
    if (themeErr) throw themeErr;
    if (!theme) return res.status(404).json({ error: 'Theme not found' });
    if (!isThemeUnlocked(theme, new Date())) {
      return res.status(403).json({ error: "This theme isn't unlocked yet" });
    }

    // Upsert. MailDaySettings is keyed by user_id and has no id column: the
    // old select('id') always failed, so once a settings row existed every
    // apply tried another insert, hit the primary key and still answered
    // "Theme applied".
    const { data: existing, error: existingErr } = await supabaseAdmin
      .from('MailDaySettings')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (existingErr) throw existingErr;

    const { error } = existing
      ? await supabaseAdmin
        .from('MailDaySettings')
        .update({ current_theme: themeId, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
      : await supabaseAdmin
        .from('MailDaySettings')
        .insert({ user_id: userId, current_theme: themeId });
    if (error) throw error;

    logMailEvent(userId, 'theme_applied', null, { themeId });
    res.json({ message: 'Theme applied' });
  } catch (err) {
    logger.error('[P3] POST /themes/apply failed', { error: err.message });
    res.status(500).json({ error: 'Failed to apply theme' });
  }
});

// ====================================================================
//                      MEMORY ENDPOINTS
// ====================================================================

// Memories use the same delivery clock as the mailbox, not when a row was
// queued. Keep the existing personal-recipient scope and omit removed mail
// and bundle containers, which are not additional letters.
async function memoryMail(userId, start, end, columns, { positiveOnly = false } = {}) {
  const rows = [];
  let afterId = null;
  const now = new Date();
  for (;;) {
    let query = onlyDelivered(supabaseAdmin.from('Mail').select(columns), now)
      .eq('recipient_user_id', userId).is('deleted_at', null)
      .or('lifecycle.is.null,lifecycle.neq.shredded')
      .or('mail_object_type.is.null,mail_object_type.neq.bundle')
      .gte('delivered_at', start.toUTC().toISO()).lt('delivered_at', end.toUTC().toISO())
      .order('id').limit(500);
    if (positiveOnly) query = query.in('category', ['postcard', 'package', 'personal', 'greeting', 'gift']);
    if (afterId) query = query.gt('id', afterId);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 500) return rows;
    afterId = data[data.length - 1].id;
  }
}

async function memoryNow(userId) {
  return DateTime.now().setZone((await mailDelivery.personTimeZone(userId)) || mailDelivery.FALLBACK_TIME_ZONE);
}

function memoryAnniversary(today, year) {
  // A February 29 anniversary has no February 29 in a non-leap year.
  return DateTime.fromObject({ year, month: today.month, day: today.day }, { zone: today.zoneName });
}

// GET /memory/on-this-day — memories from this date in previous years
router.get('/memory/on-this-day', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = await memoryNow(userId);
    const memories = [];

    for (let yearsBack = 1; yearsBack <= 5; yearsBack++) {
      const targetDate = memoryAnniversary(today, today.year - yearsBack);
      if (!targetDate.isValid) continue;
      const items = await memoryMail(userId, targetDate, targetDate.plus({ days: 1 }),
        `id, subject, sender_name:sender_display, category, delivered_at, ${MAIL_SENDER_FIELDS}`, { positiveOnly: true });
      items.sort((a, b) => Date.parse(a.delivered_at) - Date.parse(b.delivered_at) || a.id.localeCompare(b.id));
      if (items.length) {
        memories.push({
          id: `otd-${targetDate.year}-${today.month}-${today.day}`,
          memory_type: 'on_this_day',
          // A calendar label, independent of the UTC offset used to select mail.
          reference_date: `${targetDate.toISODate()}T00:00:00.000Z`,
          headline: `${yearsBack} year${yearsBack > 1 ? 's' : ''} ago today`,
          body: `You received ${items.length} item${items.length > 1 ? 's' : ''}`,
          mail_items: await withSenderNames(items, userId),
          mail_ids: items.map(item => item.id),
          dismissed: false,
        });
      }
    }

    const { data: dismissed, error: dismissedErr } = await supabaseAdmin
      .from('MailMemory').select('reference_date').eq('user_id', userId)
      .eq('memory_type', 'on_this_day').eq('dismissed', true);
    if (dismissedErr) throw dismissedErr;
    const dismissedDates = new Set((dismissed || []).map(d => d.reference_date));
    res.json({ memories: memories.map(m => ({
      ...m, dismissed: dismissedDates.has(m.reference_date.slice(0, 10)),
    })) });
  } catch (err) {
    logger.error('[P3] GET /memory/on-this-day failed', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch memories' });
  }
});

// GET /memory/year/:year — Year In Mail summary
router.get('/memory/year/:year', verifyToken, async (req, res) => {
  try {
    if (!/^[1-9]\d{3}$/.test(req.params.year) || Number(req.params.year) > 9998) {
      return res.status(400).json({ error: 'Choose a valid four-digit year.', code: 'MAIL_YEAR_INVALID' });
    }
    const userId = req.user.id;
    const year = Number(req.params.year);
    const today = await memoryNow(userId);
    const start = DateTime.fromObject({ year, month: 1, day: 1 }, { zone: today.zoneName });
    // Read every page once so totals, breakdowns and senders describe one set.
    // MailPackage is linked by mail_id; it has no recipient_user_id column.
    const items = await memoryMail(userId, start, start.plus({ years: 1 }),
      `id, drawer, category, delivered_at, sender_name:sender_display, sender_trust, ${MAIL_SENDER_FIELDS}, package:MailPackage(id)`);
    const drawers = new Map(), types = new Map(), senders = new Map();
    let totalPackages = 0, firstMailDate = null;
    for (const mail of await nameMailSenders(items, userId, { field: 'sender_name' })) {
      const drawer = mail.drawer || 'personal', type = mail.category || 'other';
      drawers.set(drawer, (drawers.get(drawer) || 0) + 1);
      types.set(type, (types.get(type) || 0) + 1);
      if (mail.package) totalPackages++;
      if (!firstMailDate || Date.parse(mail.delivered_at) < Date.parse(firstMailDate)) firstMailDate = mail.delivered_at;
      const name = mail.sender_name || mail.sender_business_name || 'Unknown';
      const sender = senders.get(name) || { count: 0, trust: mail.sender_trust, category: type };
      sender.count++;
      senders.set(name, sender);
    }
    const topSenders = [...senders.entries()]
      .sort(([, a], [, b]) => b.count - a.count).slice(0, 5)
      .map(([name, info]) => ({ sender_display: name, sender_trust: info.trust || 'unknown',
        item_count: info.count, category: info.category }));

    logMailEvent(userId, 'year_in_mail_viewed', null, { year });
    res.json({
      year, total_items: items.length, by_drawer: Object.fromEntries(drawers), by_type: Object.fromEntries(types),
      top_senders: topSenders, total_packages: totalPackages, total_earned: 0, total_saved: 0,
      first_mail_date: firstMailDate, most_active_month: null, share_card_url: null,
    });
  } catch (err) {
    logger.error('[P3] GET /memory/year/:year failed', { error: err.message });
    res.status(500).json({ error: 'Failed to generate year summary' });
  }
});

// POST /memory/dismiss — dismiss a memory card
router.post('/memory/dismiss', verifyToken, validate(dismissMemorySchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { memoryId } = req.body;

    if (!memoryId.startsWith('otd-')) {
      const { data, error } = await supabaseAdmin
        .from('MailMemory')
        .update({ dismissed: true })
        .eq('id', memoryId)
        .eq('user_id', userId)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Memory not found' });
      return res.json({ message: 'Memory dismissed' });
    }

    const today = await memoryNow(userId);
    const year = Number(memoryId.split('-')[1]);
    const yearsBack = today.year - year;
    const targetDate = memoryAnniversary(today, year);
    const expectedId = `otd-${year}-${today.month}-${today.day}`;
    if (!targetDate.isValid || yearsBack < 1 || yearsBack > 5 || memoryId !== expectedId) {
      return res.status(404).json({ error: 'Memory not found' });
    }
    // Dismiss precisely the same delivered anniversary shown by the read.
    const items = await memoryMail(userId, targetDate, targetDate.plus({ days: 1 }), 'id', { positiveOnly: true });
    if (!items.length) return res.status(404).json({ error: 'Memory not found' });

    const referenceDate = targetDate.toISODate();
    const { data: existing, error: existingErr } = await supabaseAdmin
      .from('MailMemory')
      .select('id')
      .eq('user_id', userId)
      .eq('memory_type', 'on_this_day')
      .eq('reference_date', referenceDate)
      .order('created_at')
      .limit(1)
      .maybeSingle();
    if (existingErr) throw existingErr;
    // Reuse existing rows; concurrent/retried first dismissals share one PK.
    // This uses the same bounded UUID-from-hash pattern as Home unit requests.
    const bytes = crypto.createHash('sha256')
      .update(`mail-memory:${userId}:on_this_day:${referenceDate}`).digest().subarray(0, 16);
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = bytes.toString('hex');
    const id = existing?.id || `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    const { error } = await supabaseAdmin
      .from('MailMemory')
      .upsert({
        id,
        user_id: userId,
        memory_type: 'on_this_day',
        reference_date: referenceDate,
        headline: `${yearsBack} year${yearsBack > 1 ? 's' : ''} ago today`,
        body: `You received ${items.length} item${items.length > 1 ? 's' : ''}`,
        mail_item_ids: items.map(item => item.id),
        dismissed: true,
      }, { onConflict: 'id' });
    if (error) throw error;

    res.json({ message: 'Memory dismissed' });
  } catch (err) {
    logger.error('[P3] POST /memory/dismiss failed', { error: err.message });
    res.status(500).json({ error: 'Failed to dismiss' });
  }
});

// POST /memory/year/:year/share — generate share card
router.post('/memory/year/:year/share', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const year = req.params.year;

    // In production, this would generate an image. For now, return a placeholder URL.
    const shareCardUrl = `https://pantopus.app/share/year-in-mail/${userId}/${year}`;

    logMailEvent(userId, 'year_in_mail_shared', null, { year });
    res.json({ shareCardUrl });
  } catch (err) {
    logger.error('[P3] POST /memory/year/:year/share failed', { error: err.message });
    res.status(500).json({ error: 'Failed to generate share card' });
  }
});

// ====================================================================
//                     VACATION ENDPOINTS
// ====================================================================

// GET /vacation/status — reconcile only this user's normal date lifecycle.
router.get('/vacation/status', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.rpc('vacation_hold_transition_in_zone', {
      p_user_id: req.user.id, p_action: 'status',
      p_time_zone: (await mailDelivery.personTimeZone(req.user.id)) || mailDelivery.FALLBACK_TIME_ZONE,
    });
    if (error) throw error;
    // held_count: the pieces the hold in effect (or the next one) keeps now (Mail tab, SRV-5).
    const line = await mailVacation.vacationLine(req.user.id);
    res.json({ active: data.active, upcoming: data.upcoming, held_count: line?.held_count ?? 0, hold: line });
  } catch (err) {
    logger.error('[P3] GET /vacation/status failed', { error: err.message });
    res.status(500).json({ error: "Couldn't load your vacation hold. Try again in a moment.", code: 'MAIL_UNAVAILABLE' });
  }
});

// POST /vacation/start — save dates and their summary in one transaction.
router.post('/vacation/start', verifyToken, validate(startVacationSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { holdId, homeId, startDate, endDate, holdAction, packageAction, autoNeighborRequest } = req.body;
    if (endDate < startDate) {
      return res.status(400).json({ error: 'Your return date must be on or after the day you leave.', code: 'VACATION_DATES_INVALID' });
    }
    // Dates are the person's own days: no hold starts or ends in the past (an active hold keeps the day it began).
    const timeZone = (await mailDelivery.personTimeZone(userId)) || mailDelivery.FALLBACK_TIME_ZONE;
    const today = mailDelivery.localDate(new Date(), timeZone);
    let keptStart = null;
    if (holdId) {
      const { data: current } = await supabaseAdmin.from('VacationHold').select('start_date')
        .eq('id', holdId).eq('user_id', userId).maybeSingle();
      keptStart = current?.start_date ? String(current.start_date).slice(0, 10) : null;
    }
    if (endDate < today) {
      return res.status(400).json({ error: 'Your return date has already passed. Choose a day from today on.', code: 'VACATION_DATES_INVALID' });
    }
    if (startDate < today && startDate !== keptStart) {
      return res.status(400).json({ error: 'Choose a day from today on for when you leave.', code: 'VACATION_DATES_INVALID' });
    }
    // The hold keeps the person's own mail; any Home they belong to names it (Home mail keeps arriving for the rest
    // of the household, whether or not they've proven the address).
    const homeIds = await householdHomeIds(userId);
    if (!homeIds.includes(String(homeId).toLowerCase())) {
      return res.status(403).json({ error: 'Choose a home you live at for this hold.', code: 'VACATION_HOME_INVALID' });
    }
    const { data, error } = await supabaseAdmin.rpc('vacation_hold_transition_in_zone', {
      p_user_id: userId, p_action: 'start', p_time_zone: timeZone, p_hold_id: holdId || null, p_home_id: homeId,
      p_start_date: startDate, p_end_date: endDate,
      p_hold_action: holdAction, p_package_action: packageAction,
      p_auto_neighbor_request: autoNeighborRequest || false,
    });
    if (error?.message === 'VACATION_HOLD_NOT_OWNED') {
      return res.status(403).json({ error: "This vacation hold isn't yours.", code: 'VACATION_HOLD_NOT_OWNED' });
    }
    if (error?.message === 'VACATION_HOLD_NOT_EDITABLE') {
      return res.status(409).json({ error: 'These travel dates are no longer editable. Reload to see your current dates.', code: 'VACATION_HOLD_NOT_EDITABLE' });
    }
    if (error?.message === 'VACATION_DATES_INVALID') {
      return res.status(400).json({ error: 'Your return date must be on or after the day you leave.', code: 'VACATION_DATES_INVALID' });
    }
    if (error) throw error;
    if (!data.reused) {
      logMailEvent(userId, 'vacation_started', null, {
        holdId: data.hold.id, startDate, endDate, holdAction, packageAction,
      });
    }
    // The hold holds: waiting mail moves to the morning they're back (and back out of a shortened hold).
    if (await mailVacation.syncHeldMailSafe(userId) === null) {
      return res.status(503).json({ error: 'Your dates were saved, but waiting mail could not be updated. Please retry.', code: 'MAIL_UNAVAILABLE' });
    }
    const line = await mailVacation.vacationLine(userId).catch(() => null);
    res.json({ hold: data.hold, held_count: line?.hold_id === data.hold.id ? line.held_count : 0 });
  } catch (err) {
    logger.error('[P3] POST /vacation/start failed', { error: err.message });
    res.status(500).json({ error: "Couldn't finish saving your vacation hold. Reload your dates and try again.", code: 'MAIL_UNAVAILABLE' });
  }
});

// POST /vacation/cancel — leave any other surviving hold's summary intact.
router.post('/vacation/cancel', verifyToken, validate(cancelVacationSchema), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.rpc('vacation_hold_transition_in_zone', {
      p_user_id: req.user.id, p_action: 'cancel', p_hold_id: req.body.holdId,
      p_time_zone: (await mailDelivery.personTimeZone(req.user.id)) || mailDelivery.FALLBACK_TIME_ZONE,
    });
    if (error?.message === 'VACATION_HOLD_NOT_OWNED') {
      return res.status(403).json({ error: "This vacation hold isn't yours.", code: 'VACATION_HOLD_NOT_OWNED' });
    }
    if (error) throw error;
    if (!data.reused) logMailEvent(req.user.id, 'vacation_cancelled', null, { holdId: req.body.holdId });
    // What the hold kept comes at the next round (or its own, if that's still ahead).
    if (await mailVacation.syncHeldMailSafe(req.user.id) === null) {
      return res.status(503).json({ error: 'Your hold was cancelled, but waiting mail could not be updated. Please retry.', code: 'MAIL_UNAVAILABLE' });
    }
    res.json({ message: 'Vacation hold cancelled' });
  } catch (err) {
    logger.error('[P3] POST /vacation/cancel failed', { error: err.message });
    res.status(500).json({ error: "Couldn't cancel your vacation hold. Try again in a moment.", code: 'MAIL_UNAVAILABLE' });
  }
});

// ====================================================================
//                     TRANSLATION ENDPOINTS
// ====================================================================

// POST /translate — disabled: there is no translation provider yet, and no app should show a translation.
// The route used to answer with a mock ("[Translated to <lang>] <subject>" followed by the letter's key facts), cache
// it on the Mail row (translation_text, translation_lang, translation_cached_at) and serve that cache later; the apps
// showed it as the letter's translation. It now answers 501 for every signed-in call, writes nothing and never reads
// those cached columns. A real implementation needs a translation provider (and its cost) and the Home mail read rule
// (utils/homeMailAccess) instead of the recipient_user_id-only lookup.
router.post('/translate', verifyToken, (req, res) => {
  res.status(501).json({ error: "Translation isn't available yet." });
});

// ====================================================================
//                     SEED DATA (dev)
// ====================================================================

router.post('/seed-p3', verifyToken, async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Route not found' });
    }
    const userId = req.user.id;
    const homeIds = await getAccessibleHomeIds(userId);
    if (!homeIds.length) return res.status(400).json({ error: 'No home found' });
    const homeId = homeIds[0];

    let assetsCreated = 0;
    let pinsCreated = 0;
    let communityCreated = 0;
    let stampsCreated = 0;

    // ── Seed home assets ──
    const SEED_ASSETS = [
      { name: 'Samsung Refrigerator', category: 'appliance', room: 'Kitchen', manufacturer: 'Samsung', model_number: 'RF28R7351SR' },
      { name: 'Carrier HVAC', category: 'system', room: 'Basement', manufacturer: 'Carrier', model_number: '24ACC636A003' },
      { name: 'Bosch Dishwasher', category: 'appliance', room: 'Kitchen', manufacturer: 'Bosch', model_number: 'SHPM88Z75N' },
      { name: 'Water Heater', category: 'system', room: 'Garage', manufacturer: 'Rheem', model_number: 'PROG50-38N' },
    ];

    for (const asset of SEED_ASSETS) {
      const { data } = await supabaseAdmin
        .from('HomeAsset')
        .insert({ ...asset, home_id: homeId })
        .select('id')
        .single();
      if (data) assetsCreated++;
    }

    // ── Seed map pins ──
    const SEED_PINS = [
      { pin_type: 'permit', title: 'Building Permit #2024-1234', lat: 37.7749, lng: -122.4194, visible_to: 'neighborhood' },
      { pin_type: 'utility_work', title: 'Water Main Repair', lat: 37.7752, lng: -122.4198, visible_to: 'neighborhood' },
      { pin_type: 'civic', title: 'City Council Notice: Parking Changes', lat: 37.7745, lng: -122.4190, visible_to: 'public' },
      { pin_type: 'delivery', title: 'Package Delivered', lat: 37.7749, lng: -122.4194, visible_to: 'household' },
    ];

    for (const pin of SEED_PINS) {
      const { data } = await supabaseAdmin
        .from('HomeMapPin')
        .insert({ ...pin, home_id: homeId, created_by: userId })
        .select('id')
        .single();
      if (data) pinsCreated++;
    }

    // ── Seed community items ──
    const SEED_COMMUNITY = [
      { community_type: 'civic_notice', title: 'Water Shut-Off Notice', published_to: 'neighborhood', verified_sender: true },
      { community_type: 'neighborhood_event', title: 'Block Party This Saturday', published_to: 'neighborhood', verified_sender: false },
      { community_type: 'local_business', title: 'New Coffee Shop Opening', published_to: 'neighborhood', verified_sender: true },
    ];

    for (const item of SEED_COMMUNITY) {
      const { data } = await supabaseAdmin
        .from('CommunityMailItem')
        .insert({
          ...item,
          published_by: userId,
          home_id: homeId,
          sender_display: 'City of San Francisco',
          views: Math.floor(Math.random() * 100),
          neighbors_received: Math.floor(Math.random() * 50),
          rsvp_count: 0,
        })
        .select('id')
        .single();
      if (data) communityCreated++;
    }

    // ── Seed stamps ──
    const SEED_STAMPS = [
      { stamp_type: 'first_mail', name: 'First Mail', rarity: 'common', earned_by: 'receiving_first_mail' },
      { stamp_type: 'ten_items', name: 'Mail Regular', rarity: 'common', earned_by: 'receiving_ten_items' },
      { stamp_type: 'first_package', name: 'Package Day', rarity: 'common', earned_by: 'receiving_first_package' },
      { stamp_type: 'vault_organizer', name: 'Organized', rarity: 'common', earned_by: 'filing_ten_items' },
    ];

    for (const stamp of SEED_STAMPS) {
      const { data } = await supabaseAdmin
        .from('Stamp')
        .insert({
          ...stamp,
          user_id: userId,
          displayed_in_gallery: true,
          color_palette: ['#7C3AED', '#F59E0B', '#10B981'],
        })
        .select('id')
        .single();
      if (data) stampsCreated++;
    }

    // ── Seed wallet ──
    await supabaseAdmin
      .from('EarnWallet')
      .upsert({
        user_id: userId,
        available_balance: 24.50,
        pending_balance: 5.00,
        lifetime_earned: 47.25,
        lifetime_saved: 12.00,
        withdrawal_method: 'pantopus_credit',
        withdrawal_threshold: 10,
      }, { onConflict: 'user_id' });

    // Seed some transactions
    const TX = [
      { type: 'earn', amount: 2.50, source: 'offer_engagement', status: 'completed', description: 'Viewed Best Buy offer' },
      { type: 'earn', amount: 5.00, source: 'offer_conversion', status: 'completed', description: 'Redeemed Costco coupon' },
      { type: 'bonus', amount: 1.00, source: 'milestone_bonus', status: 'completed', description: '10 offers milestone' },
      { type: 'coupon_saving', amount: 3.00, source: 'coupon', status: 'completed', description: 'Saved with USPS coupon' },
      { type: 'withdrawal', amount: -10.00, source: 'withdrawal', status: 'completed', description: 'Withdrawal to Pantopus credit' },
    ];
    await supabaseAdmin.from('WalletTransaction').insert(TX.map(tx => ({ ...tx, user_id: userId })));

    logger.info('[P3 Seed] Phase 3 data seeded', { userId, assetsCreated, pinsCreated, communityCreated, stampsCreated });
    res.json({
      message: 'Phase 3 seed data created',
      assets: assetsCreated,
      pins: pinsCreated,
      community: communityCreated,
      stamps: stampsCreated,
    });
  } catch (err) {
    logger.error('[P3 Seed] Failed', { error: err.message });
    res.status(500).json({ error: 'Seed failed' });
  }
});

module.exports = router;
