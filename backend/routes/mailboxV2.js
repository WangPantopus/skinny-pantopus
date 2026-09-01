const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const Joi = require('joi');
const logger = require('../utils/logger');
const s3 = require('../services/s3Service');

// ============ VALIDATION SCHEMAS ============

const resolveRoutingSchema = Joi.object({
  mailId: Joi.string().uuid().required(),
  drawer: Joi.string().valid('personal', 'home', 'business').required(),
  addAlias: Joi.boolean().optional(),
  aliasString: Joi.string().max(255).optional(),
});

const updatePackageStatusSchema = Joi.object({
  status: Joi.string().valid('pre_receipt', 'in_transit', 'out_for_delivery', 'delivered', 'exception').required(),
  location: Joi.string().max(500).optional(),
  photoUrl: Joi.string().uri().optional(),
  deliveryLocationNote: Joi.string().max(500).optional(),
});

const openOfferSchema = Joi.object({
  offerId: Joi.string().uuid().required(),
});

const closeOfferSchema = Joi.object({
  dwellMs: Joi.number().integer().min(0).required(),
});

const logEventSchema = Joi.object({
  eventType: Joi.string().max(100).required(),
  mailId: Joi.string().uuid().optional().allow(null),
  metadata: Joi.object().unknown(true).optional(),
});

// ============ HELPERS ============

async function getAccessibleHomeIds(userId) {
  const { data } = await supabaseAdmin
    .from('HomeOccupancy')
    .select('home_id')
    .eq('user_id', userId)
    .eq('is_active', true);
  return (data || []).map(r => r.home_id);
}

async function getHomeResidents(homeId) {
  const { data } = await supabaseAdmin
    .from('HomeOccupancy')
    .select('user_id, User!inner(id, name, username)')
    .eq('home_id', homeId)
    .eq('is_active', true);
  return data || [];
}

async function getHomeAliases(homeId) {
  const { data } = await supabaseAdmin
    .from('MailAlias')
    .select('*')
    .eq('home_id', homeId);
  return data || [];
}

function normalizeNameForMatch(name) {
  return (name || '').trim().toLowerCase().replace(/[^a-z\s]/g, '');
}

function fuzzyNameScore(input, target) {
  const a = normalizeNameForMatch(input);
  const b = normalizeNameForMatch(target);
  if (a === b) return 1.0;
  if (b.includes(a) || a.includes(b)) return 0.9;
  // Simple word overlap
  const aWords = a.split(/\s+/).filter(Boolean);
  const bWords = b.split(/\s+/).filter(Boolean);
  const overlap = aWords.filter(w => bWords.includes(w)).length;
  const maxLen = Math.max(aWords.length, bWords.length);
  return maxLen > 0 ? overlap / maxLen : 0;
}

const HOUSEHOLD_PATTERNS = [
  'resident', 'household', 'occupant', 'current resident',
  'the family', 'or current resident',
];

function isHouseholdAddressed(recipientName) {
  const n = normalizeNameForMatch(recipientName);
  return HOUSEHOLD_PATTERNS.some(p => n.includes(p)) || /the\s+\w+\s+family/.test(n);
}

// ============ ROUTING ENGINE ============

async function routeMail(recipientName, recipientAddressId, homeId) {
  // Step 1: Get home profile
  if (!homeId && recipientAddressId) {
    const { data: home } = await supabaseAdmin
      .from('Home')
      .select('id')
      .eq('id', recipientAddressId)
      .single();
    if (!home) return { drawer: null, method: 'unknown_address', confidence: 0 };
    homeId = home.id;
  }
  if (!homeId) return { drawer: null, method: 'unknown_address', confidence: 0 };

  // Step 2: Check if addressed to household
  if (isHouseholdAddressed(recipientName)) {
    return { drawer: 'home', privacy: 'shared_household', method: 'household_pattern', confidence: 1.0, homeId };
  }

  // Step 3: Check business match
  const { data: businesses } = await supabaseAdmin
    .from('Business')
    .select('id, name, username')
    .eq('home_id', homeId);

  if (businesses && businesses.length > 0) {
    for (const biz of businesses) {
      const score = fuzzyNameScore(recipientName, biz.name);
      if (score >= 0.85) {
        return { drawer: 'business', privacy: 'business_team', method: 'business_match', confidence: score, homeId, businessId: biz.id };
      }
    }
  }

  // Step 4: Check resident match
  const residents = await getHomeResidents(homeId);
  const aliases = await getHomeAliases(homeId);
  let bestMatch = null;
  let bestScore = 0;

  for (const r of residents) {
    const user = r.User;
    if (!user) continue;
    const score = fuzzyNameScore(recipientName, user.name);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = { userId: user.id, name: user.name };
    }
  }

  // Check aliases
  for (const alias of aliases) {
    const score = fuzzyNameScore(recipientName, alias.alias);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = { userId: alias.user_id, name: alias.alias };
    }
  }

  if (bestScore >= 0.85) {
    return {
      drawer: 'personal', privacy: 'private_to_person', method: 'resident_match',
      confidence: bestScore, homeId, userId: bestMatch.userId,
    };
  }

  if (bestScore >= 0.6) {
    return {
      drawer: null, method: 'disambiguation_needed', confidence: bestScore,
      homeId, bestMatchUserId: bestMatch?.userId, bestMatchName: bestMatch?.name,
    };
  }

  return { drawer: null, method: 'no_match', confidence: bestScore, homeId };
}

async function logMailEvent(eventType, mailId, userId, metadata = {}) {
  try {
    await supabaseAdmin
      .from('MailEvent')
      .insert({ event_type: eventType, mail_id: mailId, user_id: userId, metadata });
  } catch (err) {
    logger.error('Failed to log mail event', { eventType, mailId, err: err.message });
  }
}

function resolveSenderDisplay(mail) {
  const senderDisplay = typeof mail?.sender_display === 'string' ? mail.sender_display.trim() : '';
  if (senderDisplay) return senderDisplay;

  const senderName = typeof mail?.sender?.name === 'string' ? mail.sender.name.trim() : '';
  if (senderName) return senderName;

  const senderUsername = typeof mail?.sender?.username === 'string' ? mail.sender.username.trim() : '';
  if (senderUsername) return senderUsername;

  const senderBusiness = typeof mail?.sender_business_name === 'string' ? mail.sender_business_name.trim() : '';
  if (senderBusiness) return senderBusiness;

  return 'Someone';
}

function resolveSenderTrust(mail) {
  const trust = typeof mail?.sender_trust === 'string' ? mail.sender_trust.trim() : '';
  if (['verified_gov', 'verified_utility', 'verified_business', 'pantopus_user', 'unknown'].includes(trust)) {
    return trust;
  }

  const senderBusiness = typeof mail?.sender_business_name === 'string' ? mail.sender_business_name.trim() : '';
  if (senderBusiness) return 'verified_business';

  if (mail?.sender_user_id || mail?.sender?.name || mail?.sender?.username) return 'pantopus_user';
  return 'unknown';
}

// ============ ROUTES ============

// GET /api/mailbox/v2/drawers — Get drawer metadata (unread counts, icons)
router.get('/drawers', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const homeIds = await getAccessibleHomeIds(userId);

    // Count unread + urgent per drawer in parallel
    const countForDrawer = async (drawer, filter) => {
      let query = supabaseAdmin
        .from('Mail')
        .select('id, priority, created_at', { count: 'exact', head: false })
        .eq('drawer', drawer)
        .eq('viewed', false);

      if (filter) filter(query);

      if (drawer === 'personal') {
        query = query.eq('recipient_user_id', userId);
      } else if (drawer === 'home') {
        if (homeIds.length > 0) {
          query = query.in('recipient_home_id', homeIds);
        } else {
          return { unread_count: 0, urgent_count: 0, last_item_at: null };
        }
      } else if (drawer === 'business') {
        query = query.eq('recipient_user_id', userId);
      } else if (drawer === 'earn') {
        query = query.eq('recipient_user_id', userId);
      }

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        logger.error(`Failed to count drawer ${drawer}`, { error: error.message });
        return { unread_count: 0, urgent_count: 0, last_item_at: null };
      }

      const urgentCount = (data || []).filter(m => m.priority === 'urgent' || m.priority === 'high').length;
      const lastItemAt = data?.[0]?.created_at || null;

      return { unread_count: count || 0, urgent_count: urgentCount, last_item_at: lastItemAt };
    };

    const [personal, home, business, earn] = await Promise.all([
      countForDrawer('personal'),
      countForDrawer('home'),
      countForDrawer('business'),
      countForDrawer('earn'),
    ]);

    res.json({
      drawers: [
        { drawer: 'personal', display_name: 'Personal', icon: '📬', ...personal },
        { drawer: 'home', display_name: 'Home', icon: '🏠', ...home },
        { drawer: 'business', display_name: 'Business', icon: '💼', ...business },
        { drawer: 'earn', display_name: 'Earn', icon: '💰', ...earn },
      ],
    });
  } catch (err) {
    logger.error('GET /drawers failed', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to load drawer metadata' });
  }
});

// GET /api/mailbox/v2/drawer/:drawer — Get mail for a specific drawer
router.get('/drawer/:drawer', verifyToken, async (req, res) => {
  try {
    const { drawer } = req.params;
    const { tab, limit = 50, offset = 0 } = req.query;
    const userId = req.user.id;

    if (!['personal', 'home', 'business', 'earn'].includes(drawer)) {
      return res.status(400).json({ error: 'Invalid drawer' });
    }

    const homeIds = await getAccessibleHomeIds(userId);

    let query = supabaseAdmin
      .from('Mail')
      .select('*, sender:sender_user_id(name, username)', { count: 'exact' })
      .eq('drawer', drawer)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    // Scope by user or home
    if (drawer === 'personal') {
      query = query.eq('recipient_user_id', userId);
    } else if (drawer === 'home') {
      if (homeIds.length > 0) {
        query = query.in('recipient_home_id', homeIds);
      } else {
        return res.json({ mail: [], total: 0, drawer });
      }
    } else if (drawer === 'business') {
      query = query.or(`recipient_user_id.eq.${userId},recipient_home_id.in.(${homeIds.join(',')})`);
    }

    // Tab filter: incoming vs counter vs vault
    if (tab === 'incoming') {
      query = query.in('lifecycle', ['delivered', 'opened']).eq('archived', false);
    } else if (tab === 'counter') {
      query = query.not('due_date', 'is', null).in('lifecycle', ['delivered', 'opened']).eq('archived', false);
    } else if (tab === 'vault') {
      query = query.eq('lifecycle', 'filed');
    }

    const { data: mail, error, count } = await query;
    if (error) {
      logger.error('Failed to fetch drawer mail', { error: error.message, drawer });
      return res.status(500).json({ error: 'Failed to fetch mail' });
    }

    // For packages, join MailPackage data
    const packageMailIds = (mail || []).filter(m => m.mail_object_type === 'package').map(m => m.id);
    let packageData = {};
    if (packageMailIds.length > 0) {
      const { data: pkgs } = await supabaseAdmin
        .from('MailPackage')
        .select('*')
        .in('mail_id', packageMailIds);
      if (pkgs) {
        for (const pkg of pkgs) {
          packageData[pkg.mail_id] = pkg;
        }
      }
    }

    const enrichedMail = (mail || []).map(m => ({
      ...m,
      sender_display: resolveSenderDisplay(m),
      sender_trust: resolveSenderTrust(m),
      package: packageData[m.id] || null,
    }));

    // Sort by urgency then recency
    enrichedMail.sort((a, b) => {
      const urgencyOrder = { time_sensitive: 0, overdue: 1, due_soon: 2, none: 3 };
      const ua = urgencyOrder[a.urgency] ?? 3;
      const ub = urgencyOrder[b.urgency] ?? 3;
      if (ua !== ub) return ua - ub;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    return res.json({ mail: enrichedMail, total: count || 0, drawer });
  } catch (err) {
    logger.error('Drawer fetch error', { error: err.message });
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/mailbox/v2/item/:id — Get mail item detail
router.get('/item/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: mail, error } = await supabaseAdmin
      .from('Mail')
      .select('*, sender:sender_user_id(name, username)')
      .eq('id', id)
      .single();

    if (error || !mail) return res.status(404).json({ error: 'Mail not found' });

    // Enrich with package data if needed
    let packageInfo = null;
    let packageTimeline = [];
    if (mail.mail_object_type === 'package') {
      const { data: pkg } = await supabaseAdmin
        .from('MailPackage')
        .select('*')
        .eq('mail_id', id)
        .single();
      packageInfo = pkg;

      if (pkg) {
        const { data: events } = await supabaseAdmin
          .from('PackageEvent')
          .select('*')
          .eq('package_id', pkg.id)
          .order('occurred_at', { ascending: true });
        packageTimeline = events || [];
      }
    }

    // Mark as opened if not already
    if (!mail.opened_at) {
      await supabaseAdmin
        .from('Mail')
        .update({ opened_at: new Date().toISOString(), lifecycle: 'opened', viewed: true, viewed_at: new Date().toISOString() })
        .eq('id', id);
      await logMailEvent('mail_opened', id, userId, {
        drawer: mail.drawer,
        time_since_delivered_ms: Date.now() - new Date(mail.created_at).getTime(),
      });
    }

    // Fetch object payload (stationery metadata) if object_id is present
    let objectPayload = null;
    if (mail.object_id) {
      try {
        const { data: objectRow } = await supabaseAdmin
          .from('MailObject')
          .select('object_key, bucket_name')
          .eq('id', mail.object_id)
          .single();

        if (objectRow?.object_key) {
          const objectText = await s3.getObjectAsString(
            objectRow.object_key,
            objectRow.bucket_name || undefined,
          );
          try {
            objectPayload = JSON.parse(objectText);
          } catch {
            objectPayload = null;
          }
        }
      } catch (err) {
        logger.warn('Object payload fetch failed for item detail', {
          mailId: id,
          objectId: mail.object_id,
          error: err.message,
        });
      }
    }

    return res.json({
      mail: {
        ...mail,
        sender_display: resolveSenderDisplay(mail),
        sender_trust: resolveSenderTrust(mail),
        package: packageInfo,
        timeline: packageTimeline,
        object_payload: objectPayload,
      },
    });
  } catch (err) {
    logger.error('Item fetch error', { error: err.message });
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/mailbox/v2/item/:id/action — Perform an action on a mail item
router.post('/item/:id/action', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;
    const userId = req.user.id;

    const validActions = ['pay', 'sign', 'forward', 'file', 'shred', 'remind', 'split', 'acknowledge', 'share_household', 'create_task', 'dispute'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    // Update lifecycle based on action
    const lifecycleMap = { file: 'filed', shred: 'shredded', forward: 'forwarded' };
    if (lifecycleMap[action]) {
      await supabaseAdmin
        .from('Mail')
        .update({ lifecycle: lifecycleMap[action] })
        .eq('id', id);
    }

    await logMailEvent(`mail_action_clicked`, id, userId, { action_type: action });
    return res.json({ message: `Action '${action}' recorded`, action });
  } catch (err) {
    logger.error('Action error', { error: err.message });
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/mailbox/v2/route — Route a new mail item
router.post('/route', verifyToken, async (req, res) => {
  try {
    const { mailId } = req.body;

    const { data: mail } = await supabaseAdmin
      .from('Mail')
      .select('*')
      .eq('id', mailId)
      .single();

    if (!mail) return res.status(404).json({ error: 'Mail not found' });

    const result = await routeMail(
      mail.recipient_name,
      mail.recipient_address_id,
      mail.address_home_id || mail.recipient_home_id
    );

    if (result.drawer) {
      // Auto-route
      await supabaseAdmin
        .from('Mail')
        .update({
          drawer: result.drawer,
          privacy: result.privacy,
          routing_confidence: result.confidence,
          routing_method: result.method,
        })
        .eq('id', mailId);

      await logMailEvent('mail_delivered', mailId, req.user.id, {
        drawer: result.drawer,
        type: mail.mail_object_type,
        sender_trust: mail.sender_trust,
        category: mail.category,
      });

      return res.json({ routed: true, drawer: result.drawer, confidence: result.confidence, method: result.method });
    }

    // Needs disambiguation
    if (result.method === 'disambiguation_needed') {
      await supabaseAdmin
        .from('MailRoutingQueue')
        .upsert({
          mail_id: mailId,
          home_id: result.homeId,
          recipient_name_raw: mail.recipient_name,
          best_match_user_id: result.bestMatchUserId,
          best_match_confidence: result.confidence,
        }, { onConflict: 'mail_id' });
    }

    return res.json({
      routed: false,
      method: result.method,
      confidence: result.confidence,
      bestMatchUserId: result.bestMatchUserId,
      bestMatchName: result.bestMatchName,
    });
  } catch (err) {
    logger.error('Route error', { error: err.message });
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/mailbox/v2/resolve — Resolve routing disambiguation
router.post('/resolve', verifyToken, validate(resolveRoutingSchema), async (req, res) => {
  try {
    const { mailId, drawer, addAlias, aliasString } = req.body;
    const userId = req.user.id;

    const { data: mail } = await supabaseAdmin
      .from('Mail')
      .select('*')
      .eq('id', mailId)
      .single();

    if (!mail) return res.status(404).json({ error: 'Mail not found' });

    const privacyMap = { personal: 'private_to_person', home: 'shared_household', business: 'business_team' };
    await supabaseAdmin
      .from('Mail')
      .update({
        drawer,
        privacy: privacyMap[drawer] || 'private_to_person',
        routing_confidence: 1.0,
        routing_method: 'user_resolved',
        recipient_user_id: drawer === 'personal' ? userId : mail.recipient_user_id,
      })
      .eq('id', mailId);

    // Mark routing queue as resolved
    await supabaseAdmin
      .from('MailRoutingQueue')
      .update({ resolved: true, resolved_drawer: drawer, resolved_by: userId, resolved_at: new Date().toISOString() })
      .eq('mail_id', mailId);

    await logMailEvent('disambiguation_resolved', mailId, userId, { resolved_to_drawer: drawer });

    // Add alias if requested
    if (addAlias && aliasString) {
      const homeIds = await getAccessibleHomeIds(userId);
      if (homeIds.length > 0) {
        await supabaseAdmin
          .from('MailAlias')
          .upsert({
            user_id: userId,
            home_id: homeIds[0],
            alias: aliasString,
            alias_normalized: normalizeNameForMatch(aliasString),
          }, { onConflict: 'home_id,alias_normalized' });
        await logMailEvent('alias_added', null, userId, { alias_string: aliasString });
      }
    }

    return res.json({ message: 'Routing resolved', drawer });
  } catch (err) {
    logger.error('Resolve error', { error: err.message });
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/mailbox/v2/pending — Get pending disambiguation items
router.get('/pending', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const homeIds = await getAccessibleHomeIds(userId);

    if (homeIds.length === 0) return res.json({ pending: [] });

    const { data } = await supabaseAdmin
      .from('MailRoutingQueue')
      .select('*, Mail!inner(*)')
      .in('home_id', homeIds)
      .eq('resolved', false)
      .order('created_at', { ascending: false });

    return res.json({ pending: data || [] });
  } catch (err) {
    logger.error('Pending fetch error', { error: err.message });
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/mailbox/v2/package/:mailId — Get package dashboard data
router.get('/package/:mailId', verifyToken, async (req, res) => {
  try {
    const { mailId } = req.params;

    const { data: pkg } = await supabaseAdmin
      .from('MailPackage')
      .select('*')
      .eq('mail_id', mailId)
      .single();

    if (!pkg) return res.status(404).json({ error: 'Package not found' });

    const { data: events } = await supabaseAdmin
      .from('PackageEvent')
      .select('*')
      .eq('package_id', pkg.id)
      .order('occurred_at', { ascending: true });

    const { data: mail } = await supabaseAdmin
      .from('Mail')
      .select('sender_display, sender_trust, created_at')
      .eq('id', mailId)
      .single();

    return res.json({
      package: pkg,
      timeline: events || [],
      sender: mail ? { display: mail.sender_display, trust: mail.sender_trust } : null,
    });
  } catch (err) {
    logger.error('Package fetch error', { error: err.message });
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/mailbox/v2/package/:mailId/status — Update package status
router.patch('/package/:mailId/status', verifyToken, validate(updatePackageStatusSchema), async (req, res) => {
  try {
    const { mailId } = req.params;
    const { status, location, photoUrl, deliveryLocationNote } = req.body;

    const { data: pkg } = await supabaseAdmin
      .from('MailPackage')
      .select('*')
      .eq('mail_id', mailId)
      .single();

    if (!pkg) return res.status(404).json({ error: 'Package not found' });

    const previousStatus = pkg.status;
    const updates = { status, updated_at: new Date().toISOString() };
    if (status === 'delivered') {
      if (photoUrl) updates.delivery_photo_url = photoUrl;
      if (deliveryLocationNote) updates.delivery_location_note = deliveryLocationNote;
    }

    await supabaseAdmin
      .from('MailPackage')
      .update(updates)
      .eq('id', pkg.id);

    // Add timeline event
    await supabaseAdmin
      .from('PackageEvent')
      .insert({
        package_id: pkg.id,
        status,
        location,
        occurred_at: new Date().toISOString(),
        photo_url: photoUrl || null,
      });

    // Update mail urgency based on status
    if (status === 'out_for_delivery') {
      await supabaseAdmin
        .from('Mail')
        .update({ urgency: 'due_soon' })
        .eq('id', mailId);
    }

    await logMailEvent('package_status_updated', mailId, req.user.id, {
      status,
      previous_status: previousStatus,
    });

    return res.json({ message: 'Package status updated', status, previousStatus });
  } catch (err) {
    logger.error('Package status error', { error: err.message });
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/mailbox/v2/package/:mailId/share-eta — Share ETA with household
router.post('/package/:mailId/share-eta', verifyToken, async (req, res) => {
  try {
    const { mailId } = req.params;
    const userId = req.user.id;

    const { data: mail } = await supabaseAdmin
      .from('Mail')
      .select('recipient_home_id, address_home_id, sender_display')
      .eq('id', mailId)
      .single();

    if (!mail) return res.status(404).json({ error: 'Mail not found' });

    const homeId = mail.recipient_home_id || mail.address_home_id;
    if (!homeId) return res.status(400).json({ error: 'No home associated' });

    // Get household members
    const residents = await getHomeResidents(homeId);
    const otherResidents = residents.filter(r => r.user_id !== userId);

    // Create notification mail items for all household members (batch insert)
    if (otherResidents.length > 0) {
      const mailRows = otherResidents.map((resident) => ({
        recipient_user_id: resident.user_id,
        recipient_home_id: homeId,
        drawer: 'home',
        mail_object_type: 'envelope',
        sender_display: 'Pantopus',
        sender_trust: 'verified_business',
        type: 'notice',
        category: 'notice',
        subject: `Package from ${mail.sender_display} arriving soon`,
        content: `A household member shared an ETA update for a package from ${mail.sender_display}.`,
        urgency: 'none',
        privacy: 'shared_household',
        lifecycle: 'delivered',
        sender_user_id: userId,
      }));
      await supabaseAdmin.from('Mail').insert(mailRows);
    }

    await logMailEvent('package_eta_shared', mailId, userId, { household_members_notified: otherResidents.length });
    return res.json({ message: 'ETA shared with household', notified: otherResidents.length });
  } catch (err) {
    logger.error('Share ETA error', { error: err.message });
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/mailbox/v2/package/:mailId/neighbor-gig — Create gig for neighbor help
router.post('/package/:mailId/neighbor-gig', verifyToken, async (req, res) => {
  try {
    const { mailId } = req.params;
    const userId = req.user.id;

    // Placeholder for P2 full integration — just logs event and returns success
    await logMailEvent('package_neighbor_gig_created', mailId, userId, { gig_id: null });
    return res.json({ message: 'Neighbor gig request created (placeholder)', gigId: null });
  } catch (err) {
    logger.error('Neighbor gig error', { error: err.message });
    return res.status(500).json({ error: 'Server error' });
  }
});

// ============ EARN ENDPOINTS ============

// GET /api/mailbox/v2/earn/offers — Get available offers for user
router.get('/earn/offers', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: offers } = await supabaseAdmin
      .from('EarnOffer')
      .select('*')
      .eq('status', 'active')
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })
      .limit(20);

    // Get user's existing transactions to check opened status
    const { data: transactions } = await supabaseAdmin
      .from('EarnTransaction')
      .select('offer_id, status, dwell_ms, amount')
      .eq('user_id', userId);

    const txMap = {};
    for (const tx of (transactions || [])) {
      txMap[tx.offer_id] = tx;
    }

    const enrichedOffers = (offers || []).map(o => ({
      ...o,
      opened: !!txMap[o.id],
      transaction: txMap[o.id] || null,
    }));

    return res.json({ offers: enrichedOffers });
  } catch (err) {
    logger.error('Earn offers error', { error: err.message });
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/mailbox/v2/earn/balance — Get earn balance
router.get('/earn/balance', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data } = await supabaseAdmin
      .from('EarnTransaction')
      .select('amount, status')
      .eq('user_id', userId);

    const available = (data || [])
      .filter(t => t.status === 'available' || t.status === 'paid')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const pending = (data || [])
      .filter(t => t.status === 'pending' || t.status === 'verified')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const total = available + pending;

    return res.json({ balance: { total, available, pending } });
  } catch (err) {
    logger.error('Earn balance error', { error: err.message });
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/mailbox/v2/earn/open — Open an offer envelope
router.post('/earn/open', verifyToken, validate(openOfferSchema), async (req, res) => {
  try {
    const { offerId } = req.body;
    const userId = req.user.id;

    // Check daily cap
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: todayCount } = await supabaseAdmin
      .from('EarnTransaction')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', today.toISOString());

    if (todayCount >= 10) {
      await logMailEvent('offer_caps_reached', null, userId, {});
      return res.status(429).json({ error: 'Daily offer cap reached (10/day)', capped: true });
    }

    // Check rapid-open pattern (5+ in 2 minutes)
    const twoMinAgo = new Date(Date.now() - 120000).toISOString();
    const { count: recentCount } = await supabaseAdmin
      .from('EarnTransaction')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', twoMinAgo);

    if (recentCount >= 5) {
      await logMailEvent('offer_fraud_flagged', null, userId, { pattern: 'rapid_open' });
      // Flag but still allow — hold all pending
      await supabaseAdmin
        .from('EarnTransaction')
        .update({ status: 'flagged' })
        .eq('user_id', userId)
        .eq('status', 'pending');
    }

    // Check if already opened
    const { data: existing } = await supabaseAdmin
      .from('EarnTransaction')
      .select('id')
      .eq('user_id', userId)
      .eq('offer_id', offerId)
      .single();

    if (existing) return res.json({ message: 'Already opened', alreadyOpened: true });

    // Get offer
    const { data: offer } = await supabaseAdmin
      .from('EarnOffer')
      .select('*')
      .eq('id', offerId)
      .single();

    if (!offer) return res.status(404).json({ error: 'Offer not found' });

    // Create transaction
    await supabaseAdmin
      .from('EarnTransaction')
      .insert({
        user_id: userId,
        offer_id: offerId,
        amount: offer.payout_amount,
        status: 'pending',
        dwell_ms: 0,
      });

    // Increment redemption count
    await supabaseAdmin
      .from('EarnOffer')
      .update({ current_redemptions: (offer.current_redemptions || 0) + 1 })
      .eq('id', offerId);

    await logMailEvent('offer_opened', null, userId, { offer_id: offerId, dwell_ms: 0 });
    return res.json({ message: 'Offer opened', amount: offer.payout_amount, status: 'pending' });
  } catch (err) {
    logger.error('Earn open error', { error: err.message });
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/mailbox/v2/earn/close/:offerId — Close offer engagement (dwell complete)
router.post('/earn/close/:offerId', verifyToken, validate(closeOfferSchema), async (req, res) => {
  try {
    const { offerId } = req.params;
    const { dwellMs } = req.body;
    const userId = req.user.id;

    const { data: tx } = await supabaseAdmin
      .from('EarnTransaction')
      .select('*')
      .eq('user_id', userId)
      .eq('offer_id', offerId)
      .single();

    if (!tx) return res.status(404).json({ error: 'No transaction found' });

    const MIN_DWELL_MS = 15000; // 15 seconds
    const consumed = dwellMs >= MIN_DWELL_MS;

    await supabaseAdmin
      .from('EarnTransaction')
      .update({
        dwell_ms: dwellMs,
        status: consumed && tx.status !== 'flagged' ? 'verified' : tx.status,
        verified_at: consumed ? new Date().toISOString() : null,
      })
      .eq('id', tx.id);

    if (consumed) {
      await logMailEvent('offer_consumed', null, userId, { offer_id: offerId, dwell_ms: dwellMs });
    }

    return res.json({ consumed, dwellMs, status: consumed ? 'verified' : tx.status });
  } catch (err) {
    logger.error('Earn close error', { error: err.message });
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/mailbox/v2/earn/save/:offerId — Save an offer
router.post('/earn/save/:offerId', verifyToken, async (req, res) => {
  try {
    await logMailEvent('offer_saved', null, req.user.id, { offer_id: req.params.offerId });
    return res.json({ message: 'Offer saved' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/mailbox/v2/earn/reveal/:offerId — Reveal offer code
router.post('/earn/reveal/:offerId', verifyToken, async (req, res) => {
  try {
    const { data: offer } = await supabaseAdmin
      .from('EarnOffer')
      .select('offer_code')
      .eq('id', req.params.offerId)
      .single();

    await logMailEvent('offer_code_revealed', null, req.user.id, { offer_id: req.params.offerId });
    return res.json({ code: offer?.offer_code || null });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// ============ EVENT LOGGING ============

// POST /api/mailbox/v2/event — Log a client-side event
router.post('/event', verifyToken, validate(logEventSchema), async (req, res) => {
  try {
    const { eventType, mailId, metadata } = req.body;
    await logMailEvent(eventType, mailId || null, req.user.id, metadata || {});
    return res.json({ logged: true });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// ============ MAIL DAY SUMMARY ============

// GET /api/mailbox/v2/summary — Get daily mail summary for notifications
router.get('/summary', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const homeIds = await getAccessibleHomeIds(userId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Count by drawer
    const drawers = ['personal', 'home', 'business'];
    const summary = {};

    for (const drawer of drawers) {
      let query = supabaseAdmin
        .from('Mail')
        .select('category, urgency, mail_object_type', { count: 'exact' })
        .eq('drawer', drawer)
        .in('lifecycle', ['delivered', 'opened'])
        .eq('archived', false);

      if (drawer === 'personal') {
        query = query.eq('recipient_user_id', userId);
      } else if (drawer === 'home' && homeIds.length > 0) {
        query = query.in('recipient_home_id', homeIds);
      }

      const { data, count } = await query;
      summary[drawer] = {
        total: count || 0,
        bills: (data || []).filter(m => m.category === 'bill').length,
        packages: (data || []).filter(m => m.mail_object_type === 'package').length,
        urgent: (data || []).filter(m => m.urgency !== 'none').length,
      };
    }

    // Earn offers count
    const { count: offerCount } = await supabaseAdmin
      .from('EarnOffer')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    summary.earn = { offers: offerCount || 0 };

    // Most urgent drawer
    let mostUrgent = 'personal';
    let maxUrgent = 0;
    for (const d of drawers) {
      if (summary[d].urgent > maxUrgent) {
        maxUrgent = summary[d].urgent;
        mostUrgent = d;
      }
    }

    return res.json({ summary, mostUrgentDrawer: mostUrgent });
  } catch (err) {
    logger.error('Summary error', { error: err.message });
    return res.status(500).json({ error: 'Server error' });
  }
});

// ============ SEED TEST DATA (dev only) ============

router.post('/seed', verifyToken, async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Route not found' });
    }
    const userId = req.user.id;
    const homeIds = await getAccessibleHomeIds(userId);
    const homeId = homeIds[0] || null;

    const now = new Date();
    const daysAgo = (d) => new Date(now - d * 86400000).toISOString();
    const hoursAgo = (h) => new Date(now - h * 3600000).toISOString();

    // Sample mail items
    const items = [
      // Personal drawer
      {
        recipient_user_id: userId, recipient_home_id: homeId, drawer: 'personal',
        mail_object_type: 'envelope', type: 'bill', category: 'bill',
        sender_display: 'Pacific Gas & Electric', sender_trust: 'verified_utility',
        subject: 'Monthly Electricity Statement', urgency: 'due_soon',
        content: 'Your monthly electricity statement is ready. Account ending ****4521.',
        preview_text: 'Your monthly electricity statement is ready. Account ending ****4521.',
        key_facts: JSON.stringify([
          { field: 'Amount due', value: '$87.00', confidence: 0.97 },
          { field: 'Due date', value: 'Feb 28, 2026', confidence: 0.95 },
          { field: 'Account', value: '****4521', confidence: 0.99 },
        ]),
        due_date: '2026-02-28', privacy: 'private_to_person', lifecycle: 'delivered',
        created_at: hoursAgo(2), sender_user_id: userId,
      },
      {
        recipient_user_id: userId, recipient_home_id: homeId, drawer: 'personal',
        mail_object_type: 'postcard', type: 'letter', category: 'community',
        sender_display: 'Grandma Ruth', sender_trust: 'pantopus_user',
        subject: 'Postcard from Hawaii', urgency: 'none',
        content: 'Thinking of you all! Hawaii is so beautiful. Miss the little ones. Love you!',
        preview_text: 'Thinking of you all! Hawaii is so beautiful...',
        key_facts: '[]',
        privacy: 'private_to_person', lifecycle: 'delivered',
        created_at: daysAgo(1), sender_user_id: userId,
      },
      {
        recipient_user_id: userId, recipient_home_id: homeId, drawer: 'personal',
        mail_object_type: 'package', type: 'package', category: 'other',
        sender_display: 'Amazon', sender_trust: 'verified_business',
        subject: 'Package from Amazon', urgency: 'none',
        content: 'Your package is on the way.',
        preview_text: 'Your package is on the way.',
        key_facts: '[]',
        privacy: 'private_to_person', lifecycle: 'delivered',
        created_at: hoursAgo(0.5), sender_user_id: userId,
      },
      {
        recipient_user_id: userId, recipient_home_id: homeId, drawer: 'personal',
        mail_object_type: 'envelope', type: 'notice', category: 'receipt',
        sender_display: 'Regence BlueCross', sender_trust: 'verified_business',
        subject: 'Explanation of Benefits', urgency: 'none',
        content: 'Explanation of Benefits — service date Jan 15, 2026. Your cost: $0.00.',
        preview_text: 'Explanation of Benefits — service date Jan 15, 2026. Your cost: $0.00.',
        key_facts: JSON.stringify([
          { field: 'Service date', value: 'Jan 15, 2026', confidence: 0.95 },
          { field: 'Billed amount', value: '$340.00', confidence: 0.91 },
          { field: 'Your cost', value: '$0.00', confidence: 0.98 },
        ]),
        privacy: 'private_to_person', lifecycle: 'delivered',
        created_at: daysAgo(5), sender_user_id: userId,
      },
      // Home drawer
      {
        recipient_user_id: userId, recipient_home_id: homeId, drawer: 'home',
        mail_object_type: 'envelope', type: 'notice', category: 'notice',
        sender_display: 'Camas HOA', sender_trust: 'verified_business',
        subject: 'Annual Meeting Notice', urgency: 'none',
        content: 'Annual meeting scheduled for March 15. Agenda includes landscaping and new parking policy.',
        preview_text: 'Annual meeting scheduled for March 15. Agenda includes landscaping and new parking policy.',
        key_facts: JSON.stringify([
          { field: 'Meeting date', value: 'March 15, 2026', confidence: 0.96 },
          { field: 'RSVP by', value: 'March 1', confidence: 0.94 },
        ]),
        privacy: 'shared_household', lifecycle: 'delivered',
        created_at: hoursAgo(4), sender_user_id: userId,
      },
      {
        recipient_user_id: userId, recipient_home_id: homeId, drawer: 'home',
        mail_object_type: 'envelope', type: 'bill', category: 'legal',
        sender_display: 'Clark County Assessor', sender_trust: 'verified_gov',
        subject: 'Property Tax Assessment 2026', urgency: 'due_soon',
        content: 'Property tax assessment 2026. First installment due April 30, 2026.',
        preview_text: 'Property tax assessment 2026. First installment due April 30, 2026.',
        key_facts: JSON.stringify([
          { field: 'Amount due', value: '$2,340.00', confidence: 0.98 },
          { field: 'Due date', value: 'April 30, 2026', confidence: 0.97 },
          { field: 'Parcel', value: '****8821', confidence: 0.99 },
        ]),
        due_date: '2026-04-30', privacy: 'shared_household', lifecycle: 'delivered',
        created_at: daysAgo(1), sender_user_id: userId,
      },
      {
        recipient_user_id: userId, recipient_home_id: homeId, drawer: 'home',
        mail_object_type: 'package', type: 'package', category: 'other',
        sender_display: 'Home Depot', sender_trust: 'verified_business',
        subject: 'Package from Home Depot', urgency: 'none',
        content: 'Your Home Depot order is on the way.',
        preview_text: 'Your Home Depot order is on the way.',
        key_facts: '[]',
        privacy: 'shared_household', lifecycle: 'delivered',
        created_at: hoursAgo(2), sender_user_id: userId,
      },
      // Business drawer
      {
        recipient_user_id: userId, recipient_home_id: homeId, drawer: 'business',
        mail_object_type: 'envelope', type: 'bill', category: 'bill',
        sender_display: 'Amazon Web Services', sender_trust: 'verified_business',
        subject: 'Invoice #INV-2026-0219', urgency: 'due_soon',
        content: 'Invoice #INV-2026-0219 for January cloud services. Entity: Pantopus LLC.',
        preview_text: 'Invoice #INV-2026-0219 for January cloud services. Entity: Pantopus LLC.',
        key_facts: JSON.stringify([
          { field: 'Amount due', value: '$342.18', confidence: 0.99 },
          { field: 'Due date', value: 'Mar 5, 2026', confidence: 0.97 },
          { field: 'Invoice #', value: 'INV-2026-0219', confidence: 0.99 },
        ]),
        due_date: '2026-03-05', privacy: 'business_team', lifecycle: 'delivered',
        created_at: hoursAgo(1), sender_user_id: userId,
      },
      {
        recipient_user_id: userId, recipient_home_id: homeId, drawer: 'business',
        mail_object_type: 'envelope', type: 'notice', category: 'legal',
        sender_display: 'WA Secretary of State', sender_trust: 'verified_gov',
        subject: 'Annual Report Filing Required', urgency: 'time_sensitive',
        content: 'Annual report filing required — Pantopus LLC. Failure to file by March 1 may result in dissolution.',
        preview_text: 'Annual report filing required — Pantopus LLC. Failure to file by March 1 may result in dissolution.',
        key_facts: JSON.stringify([
          { field: 'Filing deadline', value: 'March 1, 2026', confidence: 0.99 },
          { field: 'Filing fee', value: '$60.00', confidence: 0.97 },
          { field: 'Entity', value: 'Pantopus LLC', confidence: 0.99 },
        ]),
        due_date: '2026-03-01', privacy: 'business_team', lifecycle: 'delivered',
        created_at: daysAgo(2), sender_user_id: userId,
      },
    ];

    // Insert mail items
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('Mail')
      .insert(items)
      .select('id, mail_object_type, sender_display, drawer');

    if (insertError) {
      logger.error('Seed insert error', { error: insertError.message });
      return res.status(500).json({ error: 'Failed to seed mail', details: insertError.message });
    }

    // Create package records for package items
    const packageItems = (inserted || []).filter(m => m.mail_object_type === 'package');
    for (const pkg of packageItems) {
      const isAmazon = pkg.sender_display === 'Amazon';
      const pkgData = {
        mail_id: pkg.id,
        carrier: isAmazon ? 'UPS' : 'FedEx',
        tracking_id_masked: isAmazon ? '****7823' : '****3341',
        status: isAmazon ? 'out_for_delivery' : 'in_transit',
        eta_confidence: isAmazon ? 'high' : 'medium',
        eta_earliest: isAmazon ? hoursAgo(-2) : daysAgo(-2),
        eta_latest: isAmazon ? hoursAgo(-6) : daysAgo(-3),
      };

      const { data: pkgInserted } = await supabaseAdmin
        .from('MailPackage')
        .insert(pkgData)
        .select('id')
        .single();

      if (pkgInserted) {
        const events = isAmazon
          ? [
              { package_id: pkgInserted.id, status: 'Order placed', occurred_at: daysAgo(3) },
              { package_id: pkgInserted.id, status: 'Departed facility', occurred_at: daysAgo(1) },
              { package_id: pkgInserted.id, status: 'Out for delivery', occurred_at: hoursAgo(5) },
            ]
          : [
              { package_id: pkgInserted.id, status: 'Order placed', occurred_at: daysAgo(1) },
              { package_id: pkgInserted.id, status: 'In transit', occurred_at: hoursAgo(12) },
            ];

        await supabaseAdmin.from('PackageEvent').insert(events);
      }
    }

    // Seed earn offers
    const offers = [
      {
        advertiser_id: userId, business_name: 'Camas Brewing Co.', business_init: 'CB',
        business_color: '#78350F', offer_title: '15% off your next visit',
        offer_subtitle: 'Valid dine-in & pickup', offer_code: 'BREW15',
        payout_amount: 0.12, expires_at: '2026-03-15T23:59:59Z', status: 'active',
      },
      {
        advertiser_id: userId, business_name: 'Fred Meyer', business_init: 'FM',
        business_color: '#991B1B', offer_title: '$5 off $50+ grocery order',
        offer_subtitle: 'Apply at checkout', offer_code: 'FRED5OFF',
        payout_amount: 0.20, expires_at: '2026-02-28T23:59:59Z', status: 'active',
      },
      {
        advertiser_id: userId, business_name: 'Gresham Auto Care', business_init: 'GA',
        business_color: '#0C4A6E', offer_title: 'Free tire rotation w/ oil change',
        offer_subtitle: 'Appointment required', offer_code: 'ROTATE2026',
        payout_amount: 0.08, expires_at: '2026-03-31T23:59:59Z', status: 'active',
      },
    ];

    await supabaseAdmin.from('EarnOffer').insert(offers);

    return res.json({
      message: 'Mailbox Phase 1 test data seeded',
      mail: inserted?.length || 0,
      packages: packageItems.length,
      offers: offers.length,
    });
  } catch (err) {
    logger.error('Seed error', { error: err.message });
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
});

module.exports = router;
