// ============================================================
// MAILBOX V2 — PHASE 3 ROUTES
// "The Thing That Compounds"
// Records, Map, Community, Tasks, MailDay, Stamps, Memory,
// Wallet, Vacation, Translation
// Mounted at /api/mailbox/v2/p3
// ============================================================

const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const Joi = require('joi');
const logger = require('../utils/logger');

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
  delivery_time: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
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
  themeId: Joi.string().uuid().required(),
});

// ── Memory ──
const dismissMemorySchema = Joi.object({
  memoryId: Joi.string().uuid().required(),
});

// ── Vacation ──
const startVacationSchema = Joi.object({
  homeId: Joi.string().uuid().required(),
  startDate: Joi.string().isoDate().required(),
  endDate: Joi.string().isoDate().required(),
  holdAction: Joi.string().valid('hold_in_vault', 'forward_to_household', 'notify_urgent_only').required(),
  packageAction: Joi.string().valid('hold_at_carrier', 'ask_neighbor', 'locker').required(),
  autoNeighborRequest: Joi.boolean().default(false),
});

const cancelVacationSchema = Joi.object({
  holdId: Joi.string().uuid().required(),
});

// ── Translation ──
const translateSchema = Joi.object({
  mailId: Joi.string().uuid().required(),
  targetLang: Joi.string().max(10).optional(),
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

async function getAccessibleHomeIds(userId) {
  const { data } = await supabaseAdmin
    .from('HomeOccupancy')
    .select('home_id')
    .eq('user_id', userId)
    .eq('is_active', true);
  return (data || []).map(r => r.home_id);
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

// ====================================================================
//                      RECORDS ENDPOINTS
// ====================================================================

// GET /records/assets — list home assets with mail link counts
router.get('/records/assets', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const homeId = req.query.homeId;
    const homeIds =
      homeId && isUuid(homeId) ? [homeId] : await getAccessibleHomeIds(userId);
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

    const rooms = [...new Set((assets || []).map(a => a.room).filter(Boolean))];

    const enriched = (assets || []).map(a => ({
      id: a.id,
      name: a.name,
      category: a.category || 'other',
      room: a.room,
      manufacturer: a.manufacturer,
      model_number: a.model_number,
      purchased_at: a.purchased_at,
      warranty_expires: a.warranty_expires,
      warranty_status: warrantyStatus(a.warranty_expires),
      linked_mail_count: linkCounts[a.id] || 0,
      linked_gig_count: gigCounts[a.id] || 0,
      photo_url: a.photo_url,
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

    const mailIds = (links || []).map(l => l.mail_id);
    let mail = [];
    if (mailIds.length) {
      const { data: mailItems } = await supabaseAdmin
        .from('Mail')
        .select('*')
        .in('id', mailIds);
      mail = mailItems || [];
    }

    // Get photos
    const { data: photos } = await supabaseAdmin
      .from('AssetPhoto')
      .select('*')
      .eq('asset_id', assetId)
      .order('taken_at', { ascending: false });

    const enrichedAsset = {
      ...asset,
      warranty_status: warrantyStatus(asset.warranty_expires),
      linked_mail_count: mailIds.length,
      linked_gig_count: 0,
    };

    res.json({ asset: enrichedAsset, mail, gigs: [], photos: photos || [] });
  } catch (err) {
    logger.error('[P3] GET /records/asset/:id/mail failed', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch asset details' });
  }
});

// POST /records/link — link a mail item to an asset
router.post('/records/link', verifyToken, validate(linkAssetSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { mailId, assetId, linkType } = req.body;

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
    const { data: recentMail } = await supabaseAdmin
      .from('Mail')
      .select('id, subject, key_facts, sender_name')
      .eq('recipient_user_id', userId)
      .not('key_facts', 'is', null)
      .order('delivered_at', { ascending: false })
      .limit(50);

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
    const { data: linkedMailIds } = await supabaseAdmin
      .from('MailAssetLink')
      .select('mail_id');
    const excludeIds = (linkedMailIds || []).map(l => l.mail_id);

    const { data: candidates } = await supabaseAdmin
      .from('Mail')
      .select('id, subject, key_facts, sender_name, category')
      .eq('recipient_user_id', userId)
      .not('key_facts', 'is', null)
      .order('delivered_at', { ascending: false })
      .limit(30);

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

// GET /map/pins — get pins within bounds
router.get('/map/pins', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const homeId = req.query.homeId;
    const pinType = req.query.type;
    const homeIds =
      homeId && isUuid(homeId) ? [homeId] : await getAccessibleHomeIds(userId);
    if (!homeIds.length) return res.json({ pins: [] });

    let query = supabaseAdmin
      .from('HomeMapPin')
      .select('*')
      .in('home_id', homeIds)
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

    // Exclude expired
    query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

    const { data: pins, error } = await query;
    if (error) throw error;

    logMailEvent(userId, 'map_viewed', null, { homeIds, count: (pins || []).length });
    res.json({ pins: pins || [] });
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
    const { data: pin, error } = await supabaseAdmin
      .from('HomeMapPin')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !pin) return res.status(404).json({ error: 'Pin not found' });

    // If linked to mail, fetch it
    let linked_mail = null;
    if (pin.mail_id) {
      const { data: mail } = await supabaseAdmin
        .from('Mail')
        .select('id, subject, sender_name, category, delivered_at')
        .eq('id', pin.mail_id)
        .single();
      linked_mail = mail;
    }

    res.json({ pin: { ...pin, linked_mail } });
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

// GET /tasks — mail-linked tasks
router.get('/tasks', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const homeId = req.query.homeId;
    const homeIds =
      homeId && isUuid(homeId) ? [homeId] : await getAccessibleHomeIds(userId);
    if (!homeIds.length) return res.json({ active: [], completed: [] });

    const { data: tasks, error } = await supabaseAdmin
      .from('HomeTask')
      .select('*')
      .in('home_id', homeIds)
      .not('mail_id', 'is', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Enrich with mail preview
    const mailIds = (tasks || []).map(t => t.mail_id).filter(Boolean);
    let mailMap = {};
    if (mailIds.length) {
      const { data: mailItems } = await supabaseAdmin
        .from('Mail')
        .select('id, subject, sender_name')
        .in('id', mailIds);
      (mailItems || []).forEach(m => { mailMap[m.id] = m; });
    }

    const enriched = (tasks || []).map(t => ({
      id: t.id,
      home_id: t.home_id,
      mail_id: t.mail_id,
      title: t.title,
      description: t.description,
      due_at: t.due_at || t.due_date,
      priority: t.priority || 'medium',
      status: t.status || 'pending',
      assigned_to: t.assigned_to,
      converted_to_gig_id: t.converted_to_gig_id,
      created_at: t.created_at,
      mail_preview: mailMap[t.mail_id]?.subject,
      mail_sender: mailMap[t.mail_id]?.sender_name,
    }));

    const active = enriched.filter(t => t.status !== 'completed');
    const completed = enriched.filter(t => t.status === 'completed');

    res.json({ active, completed });
  } catch (err) {
    logger.error('[P3] GET /tasks failed', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// POST /tasks/from-mail — create a task from a mail item
router.post('/tasks/from-mail', verifyToken, validate(createTaskSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { mailId, homeId, title, description, dueAt, priority } = req.body;

    const { data: task, error } = await supabaseAdmin
      .from('HomeTask')
      .insert({
        home_id: homeId,
        created_by: userId,
        title,
        description: description || null,
        due_date: dueAt || null,
        priority: priority || 'medium',
        status: 'pending',
        mail_id: mailId,
      })
      .select()
      .single();

    if (error) throw error;

    // Update mail with linked task
    await supabaseAdmin
      .from('Mail')
      .update({ linked_task_id: task.id })
      .eq('id', mailId);

    logMailEvent(userId, 'task_created_from_mail', mailId, { taskId: task.id, title });
    res.json({
      task: {
        id: task.id,
        home_id: task.home_id,
        mail_id: task.mail_id,
        title: task.title,
        description: task.description,
        due_at: task.due_date,
        priority: task.priority,
        status: task.status,
        created_at: task.created_at,
      },
    });
  } catch (err) {
    logger.error('[P3] POST /tasks/from-mail failed', { error: err.message });
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PATCH /tasks/:id — update task
router.patch('/tasks/:id', verifyToken, validate(updateTaskSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const taskId = req.params.id;
    const updates = {};

    if (req.body.status) updates.status = req.body.status;
    if (req.body.title) updates.title = req.body.title;
    if (req.body.priority) updates.priority = req.body.priority;
    if (req.body.dueAt !== undefined) updates.due_date = req.body.dueAt;
    if (req.body.status === 'completed') updates.completed_at = new Date().toISOString();

    const { data: task, error } = await supabaseAdmin
      .from('HomeTask')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw error;

    logMailEvent(userId, 'task_updated', task.mail_id, { taskId, updates: Object.keys(updates) });
    res.json({
      task: {
        id: task.id,
        home_id: task.home_id,
        mail_id: task.mail_id,
        title: task.title,
        description: task.description,
        due_at: task.due_date,
        priority: task.priority,
        status: task.status,
        created_at: task.created_at,
      },
    });
  } catch (err) {
    logger.error('[P3] PATCH /tasks/:id failed', { error: err.message });
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// POST /tasks/:id/to-gig — convert task to neighbor gig
router.post('/tasks/:id/to-gig', verifyToken, validate(taskToGigSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const taskId = req.params.id;

    const { data: task } = await supabaseAdmin
      .from('HomeTask')
      .select('*')
      .eq('id', taskId)
      .single();

    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Create a gig placeholder (simplified — full gig creation uses gig routes)
    const gigTitle = req.body.title || task.title;
    const gigDesc = req.body.description || task.description || '';

    const { data: gig, error } = await supabaseAdmin
      .from('Gig')
      .insert({
        created_by: userId,
        title: gigTitle,
        description: gigDesc,
        status: 'open',
        home_id: task.home_id,
        gig_type: 'task',
        compensation: req.body.compensation || null,
      })
      .select('id, title')
      .single();

    if (error) throw error;

    // Link task to gig
    await supabaseAdmin
      .from('HomeTask')
      .update({ converted_to_gig_id: gig.id, status: 'in_progress' })
      .eq('id', taskId);

    logMailEvent(userId, 'task_converted_to_gig', task.mail_id, { taskId, gigId: gig.id });
    res.json({ gigId: gig.id, title: gig.title });
  } catch (err) {
    logger.error('[P3] POST /tasks/:id/to-gig failed', { error: err.message });
    res.status(500).json({ error: 'Failed to convert to gig' });
  }
});

// ====================================================================
//                      MAIL DAY ENDPOINTS
// ====================================================================

// GET /mailday/summary — daily mail summary
router.get('/mailday/summary', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const homeIds = await getAccessibleHomeIds(userId);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Get today's new mail
    const { data: newMail } = await supabaseAdmin
      .from('Mail')
      .select('*')
      .eq('recipient_user_id', userId)
      .gte('delivered_at', todayStart.toISOString())
      .order('delivered_at', { ascending: false });

    // Get needs attention (unread, overdue, certified)
    const { data: attention } = await supabaseAdmin
      .from('Mail')
      .select('*')
      .eq('recipient_user_id', userId)
      .eq('read', false)
      .in('category', ['certified', 'government', 'bill', 'legal'])
      .order('delivered_at', { ascending: false })
      .limit(5);

    // Earn count
    const { count: earnCount } = await supabaseAdmin
      .from('EarnOffer')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .eq('is_published', true);

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

    // Get greeting based on time
    const hour = new Date().getHours();
    let greeting;
    if (hour < 12) greeting = 'Good morning';
    else if (hour < 17) greeting = 'Good afternoon';
    else greeting = 'Good evening';

    // Memory (on this day)
    let memory = null;
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const dayStr = `${oneYearAgo.getMonth() + 1}-${oneYearAgo.getDate()}`;
    const { data: oldMail } = await supabaseAdmin
      .from('Mail')
      .select('id, subject, sender_name, delivered_at')
      .eq('recipient_user_id', userId)
      .gte('delivered_at', new Date(oneYearAgo.getFullYear(), oneYearAgo.getMonth(), oneYearAgo.getDate()).toISOString())
      .lt('delivered_at', new Date(oneYearAgo.getFullYear(), oneYearAgo.getMonth(), oneYearAgo.getDate() + 1).toISOString())
      .limit(3);

    if (oldMail && oldMail.length > 0) {
      memory = {
        id: `otd-${dayStr}`,
        memory_type: 'on_this_day',
        reference_date: oneYearAgo.toISOString(),
        headline: `This day last year`,
        body: `You received ${oldMail.length} item${oldMail.length > 1 ? 's' : ''}`,
        mail_items: oldMail,
        dismissed: false,
      };
    }

    logMailEvent(userId, 'mailday_summary_viewed', null);
    res.json({
      greeting,
      total_new: (newMail || []).length,
      arrivals: newMail || [],
      needs_attention: attention || [],
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

    const { data: settings } = await supabaseAdmin
      .from('MailDaySettings')
      .select('*')
      .eq('user_id', userId)
      .single();

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

    // Upsert
    const { data: existing } = await supabaseAdmin
      .from('MailDaySettings')
      .select('id')
      .eq('user_id', userId)
      .single();

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

// GET /stamps — user's stamp gallery
router.get('/stamps', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: earned } = await supabaseAdmin
      .from('Stamp')
      .select('*')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false });

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

    const earnedTypes = new Set((earned || []).map(s => s.stamp_type));
    const locked = ALL_STAMPS
      .filter(s => !earnedTypes.has(s.stamp_type))
      .map(s => ({ ...s, progress: 0, target: 1 }));

    res.json({
      earned: earned || [],
      locked,
      total_earned: (earned || []).length,
      total_available: ALL_STAMPS.length,
    });
  } catch (err) {
    logger.error('[P3] GET /stamps failed', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch stamps' });
  }
});

// GET /themes — seasonal themes
router.get('/themes', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: themes } = await supabaseAdmin
      .from('SeasonalTheme')
      .select('*')
      .order('name');

    // Check user's active theme
    const { data: settings } = await supabaseAdmin
      .from('MailDaySettings')
      .select('current_theme')
      .eq('user_id', userId)
      .single();

    const now = new Date();
    const enriched = (themes || []).map(t => ({
      ...t,
      unlocked: t.unlock_condition === 'default' ||
        t.unlock_condition === 'seasonal_auto' ||
        (t.active_from && t.active_until &&
          now >= new Date(t.active_from) && now <= new Date(t.active_until)),
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

    // Upsert mailday settings with theme
    const { data: existing } = await supabaseAdmin
      .from('MailDaySettings')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existing) {
      await supabaseAdmin
        .from('MailDaySettings')
        .update({ current_theme: themeId })
        .eq('user_id', userId);
    } else {
      await supabaseAdmin
        .from('MailDaySettings')
        .insert({ user_id: userId, current_theme: themeId });
    }

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

// GET /memory/on-this-day — memories from this date in previous years
router.get('/memory/on-this-day', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    const memories = [];

    // Check last 5 years
    for (let yearsBack = 1; yearsBack <= 5; yearsBack++) {
      const targetDate = new Date(today.getFullYear() - yearsBack, today.getMonth(), today.getDate());
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const { data: items } = await supabaseAdmin
        .from('Mail')
        .select('id, subject, sender_name, category, delivered_at')
        .eq('recipient_user_id', userId)
        .gte('delivered_at', targetDate.toISOString())
        .lt('delivered_at', nextDay.toISOString())
        // Positive items only
        .in('category', ['postcard', 'package', 'personal', 'greeting', 'gift']);

      if (items && items.length > 0) {
        memories.push({
          id: `otd-${targetDate.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`,
          memory_type: 'on_this_day',
          reference_date: targetDate.toISOString(),
          headline: `${yearsBack} year${yearsBack > 1 ? 's' : ''} ago today`,
          body: `You received ${items.length} item${items.length > 1 ? 's' : ''}`,
          mail_items: items,
          dismissed: false,
        });
      }
    }

    // Check for dismissed
    const { data: dismissed } = await supabaseAdmin
      .from('MailMemory')
      .select('reference_id')
      .eq('user_id', userId)
      .eq('dismissed', true);

    const dismissedIds = new Set((dismissed || []).map(d => d.reference_id));
    const filtered = memories.map(m => ({
      ...m,
      dismissed: dismissedIds.has(m.id),
    }));

    res.json({ memories: filtered });
  } catch (err) {
    logger.error('[P3] GET /memory/on-this-day failed', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch memories' });
  }
});

// GET /memory/year/:year — Year In Mail summary
router.get('/memory/year/:year', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const year = parseInt(req.params.year);
    const yearStart = new Date(year, 0, 1).toISOString();
    const yearEnd = new Date(year + 1, 0, 1).toISOString();

    // Total items
    const { count: totalItems } = await supabaseAdmin
      .from('Mail')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_user_id', userId)
      .gte('delivered_at', yearStart)
      .lt('delivered_at', yearEnd);

    // By drawer
    const { data: byDrawer } = await supabaseAdmin
      .from('Mail')
      .select('drawer')
      .eq('recipient_user_id', userId)
      .gte('delivered_at', yearStart)
      .lt('delivered_at', yearEnd);

    const drawerCounts = {};
    (byDrawer || []).forEach(m => {
      drawerCounts[m.drawer || 'personal'] = (drawerCounts[m.drawer || 'personal'] || 0) + 1;
    });

    // By type
    const { data: byType } = await supabaseAdmin
      .from('Mail')
      .select('category')
      .eq('recipient_user_id', userId)
      .gte('delivered_at', yearStart)
      .lt('delivered_at', yearEnd);

    const typeCounts = {};
    (byType || []).forEach(m => {
      typeCounts[m.category || 'other'] = (typeCounts[m.category || 'other'] || 0) + 1;
    });

    // Top senders
    const { data: senders } = await supabaseAdmin
      .from('Mail')
      .select('sender_name, sender_trust, category')
      .eq('recipient_user_id', userId)
      .gte('delivered_at', yearStart)
      .lt('delivered_at', yearEnd);

    const senderMap = {};
    (senders || []).forEach(m => {
      const key = m.sender_name || 'Unknown';
      if (!senderMap[key]) senderMap[key] = { count: 0, trust: m.sender_trust, category: m.category };
      senderMap[key].count++;
    });
    const topSenders = Object.entries(senderMap)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5)
      .map(([name, info]) => ({
        sender_display: name,
        sender_trust: info.trust || 'unknown',
        item_count: info.count,
        category: info.category || 'other',
      }));

    // Packages
    const { count: totalPackages } = await supabaseAdmin
      .from('MailPackage')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_user_id', userId)
      .gte('created_at', yearStart)
      .lt('created_at', yearEnd);

    // First mail date
    const { data: firstMail } = await supabaseAdmin
      .from('Mail')
      .select('delivered_at')
      .eq('recipient_user_id', userId)
      .gte('delivered_at', yearStart)
      .lt('delivered_at', yearEnd)
      .order('delivered_at')
      .limit(1);

    logMailEvent(userId, 'year_in_mail_viewed', null, { year });
    res.json({
      year,
      total_items: totalItems || 0,
      by_drawer: drawerCounts,
      by_type: typeCounts,
      top_senders: topSenders,
      total_packages: totalPackages || 0,
      total_earned: 0,
      total_saved: 0,
      first_mail_date: firstMail?.[0]?.delivered_at || null,
      most_active_month: null,
      share_card_url: null,
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

    await supabaseAdmin
      .from('MailMemory')
      .upsert({
        user_id: userId,
        reference_id: memoryId,
        memory_type: 'on_this_day',
        dismissed: true,
      }, { onConflict: 'user_id,reference_id' });

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

// GET /vacation/status — current vacation hold status
router.get('/vacation/status', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date().toISOString();

    const { data: holds } = await supabaseAdmin
      .from('VacationHold')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['scheduled', 'active'])
      .order('start_date');

    const active = (holds || []).find(h => h.status === 'active') || null;
    const upcoming = (holds || []).find(h => h.status === 'scheduled') || null;

    res.json({ active, upcoming });
  } catch (err) {
    logger.error('[P3] GET /vacation/status failed', { error: err.message });
    res.status(500).json({ error: 'Failed to get vacation status' });
  }
});

// POST /vacation/start — create vacation hold
router.post('/vacation/start', verifyToken, validate(startVacationSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { homeId, startDate, endDate, holdAction, packageAction, autoNeighborRequest } = req.body;

    // Verify home access
    const homeIds = await getAccessibleHomeIds(userId);
    if (!homeIds.includes(homeId)) {
      return res.status(403).json({ error: 'Not a member of this home' });
    }

    // Determine status
    const now = new Date();
    const start = new Date(startDate);
    const status = start <= now ? 'active' : 'scheduled';

    const { data: hold, error } = await supabaseAdmin
      .from('VacationHold')
      .insert({
        user_id: userId,
        home_id: homeId,
        start_date: startDate,
        end_date: endDate,
        hold_action: holdAction,
        package_action: packageAction,
        auto_neighbor_request: autoNeighborRequest || false,
        status,
        items_held_count: 0,
      })
      .select()
      .single();

    if (error) throw error;

    // Update user vacation mode
    await supabaseAdmin
      .from('User')
      .update({
        vacation_mode: true,
        vacation_start: startDate,
        vacation_end: endDate,
      })
      .eq('id', userId);

    logMailEvent(userId, 'vacation_started', null, {
      holdId: hold.id, startDate, endDate, holdAction, packageAction,
    });
    res.json({ hold });
  } catch (err) {
    logger.error('[P3] POST /vacation/start failed', { error: err.message });
    res.status(500).json({ error: 'Failed to start vacation' });
  }
});

// POST /vacation/cancel — cancel vacation hold
router.post('/vacation/cancel', verifyToken, validate(cancelVacationSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { holdId } = req.body;

    const { data: hold } = await supabaseAdmin
      .from('VacationHold')
      .select('user_id')
      .eq('id', holdId)
      .single();

    if (!hold || hold.user_id !== userId) {
      return res.status(403).json({ error: 'Not your vacation hold' });
    }

    await supabaseAdmin
      .from('VacationHold')
      .update({ status: 'cancelled' })
      .eq('id', holdId);

    // Clear user vacation mode
    await supabaseAdmin
      .from('User')
      .update({
        vacation_mode: false,
        vacation_start: null,
        vacation_end: null,
      })
      .eq('id', userId);

    logMailEvent(userId, 'vacation_cancelled', null, { holdId });
    res.json({ message: 'Vacation hold cancelled' });
  } catch (err) {
    logger.error('[P3] POST /vacation/cancel failed', { error: err.message });
    res.status(500).json({ error: 'Failed to cancel vacation' });
  }
});

// ====================================================================
//                     TRANSLATION ENDPOINTS
// ====================================================================

// POST /translate — translate a mail item
router.post('/translate', verifyToken, validate(translateSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { mailId, targetLang } = req.body;
    const lang = targetLang || 'en';

    // Check cache
    const { data: mail } = await supabaseAdmin
      .from('Mail')
      .select('id, subject, key_facts, translation_text, translation_lang, translation_cached_at')
      .eq('id', mailId)
      .eq('recipient_user_id', userId)
      .single();

    if (!mail) return res.status(404).json({ error: 'Mail not found' });

    // If cached translation exists and target matches
    if (mail.translation_text && mail.translation_lang === lang) {
      return res.json({
        translated_text: mail.translation_text,
        from_language: 'auto',
        to_language: lang,
        cached: true,
      });
    }

    // Mock translation (Phase 3 placeholder — real translation would use an API)
    const originalText = typeof mail.key_facts === 'string' ? mail.key_facts : JSON.stringify(mail.key_facts || {});
    const translatedText = `[Translated to ${lang}] ${mail.subject || ''}\n\n${originalText}`;

    // Cache
    await supabaseAdmin
      .from('Mail')
      .update({
        translation_text: translatedText,
        translation_lang: lang,
        translation_cached_at: new Date().toISOString(),
      })
      .eq('id', mailId);

    logMailEvent(userId, 'mail_translated', mailId, { targetLang: lang });
    res.json({
      translated_text: translatedText,
      from_language: 'auto',
      to_language: lang,
      cached: false,
    });
  } catch (err) {
    logger.error('[P3] POST /translate failed', { error: err.message });
    res.status(500).json({ error: 'Translation failed' });
  }
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
