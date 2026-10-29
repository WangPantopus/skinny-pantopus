const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
// canAccessMail / readableMail: the mailbox's per-item rule (own mail, or mail
// for a Home whose mail the caller may read), checked before any read or change.
const {
  getAccessibleHomeIds, canAccessMail, readableMail, visibleMailFilter, onlyDelivered,
} = require('../utils/homeMailAccess');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const Joi = require('joi');
const logger = require('../utils/logger');
const { escapeIlike } = require('../utils/escapeIlike');
// A letter sent as a business names the business to everyone it reaches, never the person who sent it.
const { presentMailSender, presentMailSenders, nameMailSender, nameMailSenders } = require('../utils/mailSenderView');

// A letter id as the database stores it; anything else names no letter.
const MAIL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============ VALIDATION SCHEMAS ============

const acknowledgeSchema = Joi.object({
  mailId: Joi.string().uuid().required(),
});

const createPartySchema = Joi.object({
  mailId: Joi.string().uuid().required(),
});

const joinPartySchema = Joi.object({
  sessionId: Joi.string().uuid().required(),
});

const partyReactionSchema = Joi.object({
  sessionId: Joi.string().uuid().required(),
  reaction: Joi.string().max(10).required(),
});

const partyAssignSchema = Joi.object({
  sessionId: Joi.string().uuid().required(),
  mailId: Joi.string().uuid().required(),
  assignToUserId: Joi.string().uuid().required(),
});

const createFolderSchema = Joi.object({
  drawer: Joi.string().valid('personal', 'home', 'business').required(),
  // A Home folder belongs to one Home whose mail the caller may read.
  home_id: Joi.string().uuid().optional(),
  label: Joi.string().max(100).required(),
  icon: Joi.string().max(10).optional(),
  color: Joi.string().max(20).optional(),
  autoFileRules: Joi.array().items(Joi.object({
    field: Joi.string().valid('category', 'sender_name', 'sender_trust', 'keyword').required(),
    operator: Joi.string().valid('equals', 'contains', 'starts_with').required(),
    value: Joi.string().max(255).required(),
  })).optional(),
});

const updateFolderSchema = Joi.object({
  label: Joi.string().max(100).optional(),
  icon: Joi.string().max(10).optional(),
  color: Joi.string().max(20).optional(),
  autoFileRules: Joi.array().items(Joi.object({
    field: Joi.string().valid('category', 'sender_name', 'sender_trust', 'keyword').required(),
    operator: Joi.string().valid('equals', 'contains', 'starts_with').required(),
    value: Joi.string().max(255).required(),
  })).optional(),
});

const vaultSearchSchema = Joi.object({
  q: Joi.string().trim().min(1).max(255).required(),
  drawer: Joi.string().valid('personal', 'home', 'business').optional(),
  folderId: Joi.string().uuid().optional(),
  limit: Joi.number().integer().min(1).max(50).default(20),
  offset: Joi.number().integer().min(0).default(0),
});

const fileToVaultSchema = Joi.object({
  mailId: Joi.string().uuid().required(),
  folderId: Joi.string().uuid().required(),
});

const bundleActionSchema = Joi.object({
  bundleId: Joi.string().uuid().required(),
  action: Joi.string().valid('file_all', 'open_all', 'extract_item').required(),
  folderId: Joi.string().uuid().optional(),
  itemId: Joi.string().uuid().optional(),
});

const packageUnboxingSchema = Joi.object({
  conditionPhotoUrl: Joi.string().uri().optional(),
  unboxingVideoUrl: Joi.string().uri().optional(),
  skip: Joi.boolean().optional(),
});

const packageGigSchema = Joi.object({
  gigType: Joi.string().valid('hold', 'inside', 'sign', 'custom', 'assembly').required(),
  title: Joi.string().max(255).optional(),
  description: Joi.string().max(1000).optional(),
  suggestedStart: Joi.string().optional(),
  compensation: Joi.number().optional(),
});

const couponBrowseSchema = Joi.object({
  offerId: Joi.string().uuid().required(),
});

const riskAppealSchema = Joi.object({
  appealText: Joi.string().max(2000).required(),
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
    logger.error('[MailEvent] Failed to log', { eventType, err: err.message });
  }
}


// The Vault's folders: Me and Biz folders are each person's, Home folders belong to the Home (services/mailVault).
const mailVault = require('../services/mailVault');
const { ensureSystemFolders } = mailVault;

function evaluateAutoFileRule(rule, item) {
  const { field, operator, value } = rule;
  let target = '';
  if (field === 'category') target = item.category || '';
  else if (field === 'sender_name') target = item.sender_display || '';
  else if (field === 'sender_trust') target = item.sender_trust || '';
  else if (field === 'keyword') {
    target = [item.subject, item.content, item.sender_display, item.preview_text]
      .filter(Boolean).join(' ');
  }
  target = target.toLowerCase();
  const val = value.toLowerCase();

  if (operator === 'equals') return target === val;
  if (operator === 'contains') return target.includes(val);
  if (operator === 'starts_with') return target.startsWith(val);
  return false;
}

// ============ RISK SCORE CALCULATOR ============

function calculateRiskScore(session) {
  let risk = 0;
  const durationMinutes = (Date.now() - new Date(session.session_start).getTime()) / 60000;
  const opensPerMinute = durationMinutes > 0 ? session.opens_count / durationMinutes : 0;
  const avgDwellMs = session.opens_count > 0 ? session.total_dwell_ms / session.opens_count : 0;
  const totalActions = session.saves_count + session.reveals_count;
  const conversionRate = session.opens_count > 0 ? totalActions / session.opens_count : 0;
  const offerDiversity = session.opens_count > 0 ? session.distinct_advertisers / session.opens_count : 1;

  if (opensPerMinute > 2.5) risk += 40;
  if (avgDwellMs < 8000) {
    const secondsBelow = Math.max(0, (8000 - avgDwellMs) / 1000);
    risk += Math.min(30 * secondsBelow, 90);
  }
  if (offerDiversity < 0.3) risk += 20;
  if (conversionRate < 0.05 && session.opens_count >= 5) risk += 15;

  return Math.min(risk, 100);
}

// ============ BUNDLE ROUTING ============

async function routeAndGroup(userId, addressId) {
  // Step 1: Get today's unprocessed items for this address
  const today = new Date().toISOString().split('T')[0];
  // Only letters the caller may see: an address also receives other members'
  // private mail, which must never land in the caller's bundle.
  const homeIds = await getAccessibleHomeIds(userId);
  const { data: items } = await onlyDelivered(supabaseAdmin
    .from('Mail')
    .select('*')
    .eq('recipient_address_id', addressId)
    .or(visibleMailFilter(userId, homeIds)))
    .is('deleted_at', null)
    .is('bundle_id', null)
    .neq('mail_object_type', 'bundle')
    .gte('created_at', today + 'T00:00:00Z')
    .order('created_at', { ascending: false });

  if (!items || items.length === 0) return { bundles: 0 };

  // Step 2: Group by sender + drawer + date
  const senderGroups = {};
  for (const item of items) {
    const key = `${item.sender_display || 'unknown'}|${item.drawer}`;
    if (!senderGroups[key]) senderGroups[key] = [];
    senderGroups[key].push(item);
  }

  let bundlesCreated = 0;
  for (const [key, group] of Object.entries(senderGroups)) {
    if (group.length >= 3) {
      const [sender, drawer] = key.split('|');
      // Create bundle wrapper
      // A wrapper is a Mail row like any other: type and content are required (the old insert lacked both and every
      // bundle failed silently). It is in the box at once, with the pieces it holds.
      const { data: bundle, error: bundleError } = await supabaseAdmin
        .from('Mail')
        .insert({
          recipient_user_id: userId,
          recipient_address_id: addressId,
          drawer,
          type: 'other',
          mail_type: 'other',
          content: `${group.length} pieces from ${sender}.`,
          subject: `${sender} · ${group.length} items`,
          mail_object_type: 'bundle',
          bundle_type: 'sender_grouped',
          bundle_label: `${sender} · ${group.length} items`,
          bundle_item_count: group.length,
          collapsed_by_default: true,
          sender_display: sender,
          sender_trust: group[0].sender_trust,
          lifecycle: 'delivered',
          urgency: group.some(i => i.urgency === 'time_sensitive') ? 'time_sensitive' :
                   group.some(i => i.urgency === 'due_soon') ? 'due_soon' : 'none',
        })
        .select()
        .single();
      if (bundleError) logger.error('Bundle create failed', { error: bundleError.message });

      if (bundle) {
        const ids = group.map(i => i.id);
        await supabaseAdmin
          .from('Mail')
          .update({ bundle_id: bundle.id })
          .in('id', ids);
        bundlesCreated++;
        await logMailEvent(userId, 'bundle_created', bundle.id, {
          item_count: group.length, bundle_type: 'sender_grouped',
        });
      }
    }
  }

  // Step 3: Category date grouping (5+ threshold)
  const catGroups = {};
  for (const item of items.filter(i => !i.bundle_id)) {
    const cat = item.category || 'other';
    if (['bill', 'promo', 'receipt'].includes(cat)) {
      const key = `${cat}|${item.drawer}`;
      if (!catGroups[key]) catGroups[key] = [];
      catGroups[key].push(item);
    }
  }

  for (const [key, group] of Object.entries(catGroups)) {
    if (group.length >= 5) {
      const [cat, drawer] = key.split('|');
      const label = `Today's ${cat.charAt(0).toUpperCase() + cat.slice(1)}s`;
      const { data: bundle, error: bundleError } = await supabaseAdmin
        .from('Mail')
        .insert({
          recipient_user_id: userId,
          recipient_address_id: addressId,
          drawer,
          type: 'other',
          mail_type: 'other',
          content: `${label}: ${group.length} pieces.`,
          subject: label,
          mail_object_type: 'bundle',
          bundle_type: 'date_grouped',
          bundle_label: label,
          bundle_item_count: group.length,
          collapsed_by_default: true,
          sender_display: label,
          lifecycle: 'delivered',
          urgency: 'none',
        })
        .select()
        .single();
      if (bundleError) logger.error('Bundle create failed', { error: bundleError.message });

      if (bundle) {
        const ids = group.map(i => i.id);
        await supabaseAdmin
          .from('Mail')
          .update({ bundle_id: bundle.id })
          .in('id', ids);
        bundlesCreated++;
      }
    }
  }

  return { bundles: bundlesCreated };
}

// ============================================================
// ROUTES
// ============================================================

// All routes require authentication
router.use(verifyToken);

// ── BOOKLET ───────────────────────────────────────────────

// GET /booklet/:mailId — get booklet with pages
router.get('/booklet/:mailId', async (req, res, next) => {
  try {
    const { mailId } = req.params;
    const { data: mail } = await supabaseAdmin
      .from('Mail')
      .select('*')
      .eq('id', mailId)
      .eq('mail_object_type', 'booklet')
      .single();

    if (!mail || !(await canAccessMail(mail, req.user.id))) return res.status(404).json({ error: 'Booklet not found' });

    const { data: pages } = await supabaseAdmin
      .from('BookletPage')
      .select('*')
      .eq('mail_id', mailId)
      .order('page_number', { ascending: true });

    await logMailEvent(req.user.id, 'booklet_opened', mailId, { page_count: mail.page_count });

    res.json({ booklet: presentMailSender(await nameMailSender(mail, req.user.id), req.user.id), pages: pages || [] });
  } catch (err) { next(err); }
});

// GET /booklet/:mailId/page/:pageNumber — get single page
router.get('/booklet/:mailId/page/:pageNumber', async (req, res, next) => {
  try {
    const { mailId, pageNumber } = req.params;
    if (!(await readableMail(mailId, req.user.id))) return res.status(404).json({ error: 'Page not found' });
    const { data: page } = await supabaseAdmin
      .from('BookletPage')
      .select('*')
      .eq('mail_id', mailId)
      .eq('page_number', parseInt(pageNumber))
      .single();

    if (!page) return res.status(404).json({ error: 'Page not found' });

    await logMailEvent(req.user.id, 'booklet_page_viewed', mailId, { page_number: parseInt(pageNumber) });

    res.json({ page });
  } catch (err) { next(err); }
});

// POST /booklet/:mailId/download — initiate booklet download
router.post('/booklet/:mailId/download', async (req, res, next) => {
  try {
    const { mailId } = req.params;
    const { data: mail } = await supabaseAdmin
      .from('Mail')
      .select('id, download_url, download_size_bytes, recipient_user_id, recipient_home_id')
      .eq('id', mailId)
      .single();

    if (!mail?.download_url || !(await canAccessMail(mail, req.user.id))) return res.status(404).json({ error: 'Download not available' });

    await logMailEvent(req.user.id, 'booklet_downloaded', mailId, {
      size_bytes: mail.download_size_bytes,
    });

    res.json({ downloadUrl: mail.download_url, sizeBytes: mail.download_size_bytes });
  } catch (err) { next(err); }
});

// ── BUNDLE ────────────────────────────────────────────────

// A bundle may contain more than PostgREST's response cap. Read a stable set
// before bulk changes and keep ID filters small enough for the HTTP gateway.
async function readableBundleItems(bundleId, userId, homeIds, select = '*') {
  const items = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await onlyDelivered(supabaseAdmin.from('Mail').select(select)
      .eq('bundle_id', bundleId).or(visibleMailFilter(userId, homeIds)))
      .is('deleted_at', null).or('lifecycle.is.null,lifecycle.neq.shredded')
      .order('urgency', { ascending: true }).order('created_at', { ascending: false }).order('id')
      .range(offset, offset + 499);
    if (error) throw error;
    items.push(...(data || []));
    if ((data || []).length < 500) return items;
  }
}

// GET /bundle/:bundleId/items — get items in a bundle
router.get('/bundle/:bundleId/items', async (req, res, next) => {
  try {
    const { bundleId } = req.params;
    const { data: bundle } = await supabaseAdmin
      .from('Mail')
      .select('*')
      .eq('id', bundleId)
      .eq('mail_object_type', 'bundle')
      .single();

    if (!bundle || !(await canAccessMail(bundle, req.user.id))) return res.status(404).json({ error: 'Bundle not found' });

    // Each item passes the per-item rule too: a bundle can hold letters the
    // caller may not read.
    const items = await readableBundleItems(bundleId, req.user.id, await getAccessibleHomeIds(req.user.id));

    await logMailEvent(req.user.id, 'bundle_expanded', bundleId, {
      item_count: (items || []).length,
    });

    res.json({
      bundle: presentMailSender(await nameMailSender(bundle, req.user.id), req.user.id),
      items: presentMailSenders(await nameMailSenders(items || [], req.user.id), req.user.id),
    });
  } catch (err) { next(err); }
});

// POST /bundle/action — bundle bulk actions
router.post('/bundle/action', validate(bundleActionSchema), async (req, res, next) => {
  try {
    const { bundleId, action, folderId, itemId } = req.body;
    // Only a bundle the caller may read (the mailbox per-item rule).
    const { data: bundleMail } = await supabaseAdmin
      .from('Mail')
      .select('id, recipient_user_id, recipient_home_id')
      .eq('id', bundleId)
      .eq('mail_object_type', 'bundle')
      .maybeSingle();
    if (!bundleMail || !(await canAccessMail(bundleMail, req.user.id))) return res.status(404).json({ error: 'Bundle not found' });
    // Bulk actions touch only the items the caller may read (the per-item rule).
    const homeIds = await getAccessibleHomeIds(req.user.id);
    const visibleItems = () => readableBundleItems(bundleId, req.user.id, homeIds);

    if (action === 'file_all') {
      if (!folderId) return res.status(400).json({ error: 'folderId required for file_all' });
      // The caller's own folder, or a folder of a Home whose mail they may read (services/mailVault).
      const ownFolder = await mailVault.resolveFolder(folderId, req.user.id, homeIds);
      if (!ownFolder) return res.status(404).json({ error: "This folder isn't in your Vault.", code: 'MAIL_FOLDER_NOT_FOUND' });
      const items = await visibleItems();
      if (items.some((item) => !mailVault.folderFits(ownFolder, item))) {
        return res.status(400).json({ error: 'Choose a Vault folder for the same mailbox as these letters.' });
      }
      const ids = items.map((item) => item.id);
      for (let offset = 0; offset < ids.length; offset += 100) {
        const { error } = await supabaseAdmin.from('Mail')
          .update({ lifecycle: 'filed', vault_folder_id: ownFolder.folder.id }).in('id', ids.slice(offset, offset + 100));
        if (error) throw error;
      }
      // Folder counts are derived from filed mail by mailVault, so retrying this
      // action cannot increment a stale counter a second time.

      await logMailEvent(req.user.id, 'bundle_filed_all', bundleId, {
        folder_id: folderId, count: ids.length,
      });

      return res.json({ message: `Filed ${ids.length} items`, count: ids.length });
    }

    if (action === 'open_all') {
      const items = await visibleItems();
      const ids = items.map((item) => item.id);
      const openedAt = new Date().toISOString();
      for (let offset = 0; offset < ids.length; offset += 100) {
        const batch = ids.slice(offset, offset + 100);
        const opened = await supabaseAdmin.from('Mail').update({ opened_at: openedAt })
          .in('id', batch).is('opened_at', null);
        if (opened.error) throw opened.error;
        const viewed = await supabaseAdmin.from('Mail').update({ viewed: true, viewed_at: openedAt })
          .in('id', batch).eq('viewed', false);
        if (viewed.error) throw viewed.error;
        const lifecycle = await supabaseAdmin.from('Mail').update({ lifecycle: 'opened' })
          .in('id', batch).eq('lifecycle', 'delivered');
        if (lifecycle.error) throw lifecycle.error;
      }

      return res.json({ message: `Opened ${ids.length} items`, count: ids.length });
    }

    if (action === 'extract_item') {
      if (!itemId) return res.status(400).json({ error: 'itemId required for extract_item' });
      if (!(await readableMail(itemId, req.user.id))) return res.status(404).json({ error: 'Mail not found' });
      const { error: extractError } = await supabaseAdmin
        .from('Mail')
        .update({ bundle_id: null })
        .eq('id', itemId)
        .eq('bundle_id', bundleId);
      if (extractError) {
        logger.error('Bundle extract_item failed', { bundleId, itemId, error: extractError.message });
        return res.status(500).json({ error: "Couldn't take this item out of the bundle. Please try again." });
      }

      // Update bundle item count
      const remaining = await visibleItems();

      await supabaseAdmin
        .from('Mail')
        .update({ bundle_item_count: (remaining || []).length })
        .eq('id', bundleId);

      await logMailEvent(req.user.id, 'bundle_item_extracted', bundleId, { item_id: itemId });

      return res.json({ message: 'Item extracted from bundle', remaining: (remaining || []).length });
    }

    res.status(400).json({ error: 'Invalid action' });
  } catch (err) { next(err); }
});

// POST /bundle/auto-group — trigger auto-bundling for user's address
router.post('/bundle/auto-group', async (req, res, next) => {
  try {
    const homeIds = await getAccessibleHomeIds(req.user.id);
    // Batch fetch all homes at once (1 query instead of N)
    const { data: homes } = homeIds.length > 0
      ? await supabaseAdmin.from('Home').select('id, address_id').in('id', homeIds)
      : { data: [] };
    let totalBundles = 0;
    for (const home of homes || []) {
      if (home?.address_id) {
        const result = await routeAndGroup(req.user.id, home.address_id);
        totalBundles += result.bundles;
      }
    }
    res.json({ message: `Created ${totalBundles} bundles`, bundles: totalBundles });
  } catch (err) { next(err); }
});

// ── CERTIFIED MAIL ────────────────────────────────────────

// A certified receipt is available only once the letter reaches the box.
// Keep the named-recipient check in each route; household access alone never
// grants permission to sign for somebody else.
function deliveredCertifiedMail(mailId) {
  return onlyDelivered(supabaseAdmin.from('Mail').select('*').eq('id', mailId).eq('certified', true))
    .is('deleted_at', null).or('lifecycle.is.null,lifecycle.neq.shredded');
}

// GET /certified/:mailId — get certified mail detail
router.get('/certified/:mailId', async (req, res, next) => {
  try {
    const { mailId } = req.params;
    const { data: mail, error } = await deliveredCertifiedMail(mailId).maybeSingle();
    if (error) throw error;

    if (!mail) return res.status(404).json({ error: 'Certified mail not found' });

    // Permission check: only named recipient
    if (mail.recipient_user_id !== req.user.id) {
      return res.status(403).json({
        error: 'Only the named recipient can view certified mail details',
      });
    }

    await logMailEvent(req.user.id, 'certified_mail_delivered', mailId);

    res.json({ mail: presentMailSender(await nameMailSender(mail, req.user.id), req.user.id) });
  } catch (err) { next(err); }
});

// POST /certified/acknowledge — acknowledge certified mail
router.post('/certified/acknowledge', validate(acknowledgeSchema), async (req, res, next) => {
  try {
    const { mailId } = req.body;
    const { data: mail, error } = await deliveredCertifiedMail(mailId).maybeSingle();
    if (error) throw error;

    if (!mail) return res.status(404).json({ error: 'Certified mail not found' });
    if (mail.recipient_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the named recipient can acknowledge' });
    }
    if (mail.acknowledged_at) {
      return res.status(400).json({ error: 'Already acknowledged' });
    }

    const now = new Date().toISOString();
    const auditTrail = Array.isArray(mail.audit_trail) ? mail.audit_trail : [];
    // Signing is the receipt. A letter read earlier (opened on the web, or
    // viewed in the apps) keeps the time it was first read.
    const readAt = mail.opened_at || mail.viewed_at || now;
    if (!auditTrail.some((entry) => entry?.event === 'opened')) {
      auditTrail.push({ event: 'opened', timestamp: readAt, actor_id: req.user.id });
    }
    auditTrail.push({ event: 'acknowledged', timestamp: now, actor_id: req.user.id });

    const { error: ackError } = await supabaseAdmin
      .from('Mail')
      .update({
        acknowledged_at: now,
        acknowledged_by: req.user.id,
        audit_trail: auditTrail,
        // A filed piece stays filed.
        ...(mail.opened_at ? {} : { opened_at: readAt, ...(!mail.lifecycle || mail.lifecycle === 'delivered' ? { lifecycle: 'opened' } : {}) }),
      })
      .eq('id', mailId);
    // supabase-js reports a failed write instead of throwing: without this
    // check the client was told the acknowledgement was on file when it was not.
    if (ackError) {
      logger.error('Certified acknowledge update failed', { mailId, error: ackError.message });
      return res.status(500).json({ error: "Couldn't record your acknowledgement. Please try again." });
    }

    await logMailEvent(req.user.id, 'certified_mail_acknowledged', mailId, { timestamp: now });

    // Auto-route: if action required → counter, else → vault
    const hasAction = mail.due_date || (mail.key_facts && JSON.stringify(mail.key_facts).includes('amount'));

    res.json({
      message: 'Certified mail acknowledged',
      acknowledgedAt: now,
      routedTo: hasAction ? 'counter' : 'vault',
      auditTrail,
    });
  } catch (err) { next(err); }
});

// POST /certified/:mailId/reject — reject certified mail
router.post('/certified/:mailId/reject', async (req, res, next) => {
  try {
    const { mailId } = req.params;
    const { data: mail, error } = await deliveredCertifiedMail(mailId).maybeSingle();
    if (error) throw error;

    if (!mail) return res.status(404).json({ error: 'Certified mail not found' });
    if (mail.recipient_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the named recipient can reject' });
    }

    const now = new Date().toISOString();
    const auditTrail = Array.isArray(mail.audit_trail) ? mail.audit_trail : [];
    auditTrail.push({ event: 'rejected', timestamp: now, actor_id: req.user.id });

    const { error: rejectError } = await supabaseAdmin
      .from('Mail')
      .update({ audit_trail: auditTrail })
      .eq('id', mailId);
    if (rejectError) {
      logger.error('Certified reject update failed', { mailId, error: rejectError.message });
      return res.status(500).json({ error: "Couldn't record the rejection. Please try again." });
    }

    await logMailEvent(req.user.id, 'certified_mail_rejected', mailId);

    res.json({ message: 'Certified mail rejected', auditTrail });
  } catch (err) { next(err); }
});

// GET /certified/:mailId/proof — download legal proof PDF
router.get('/certified/:mailId/proof', async (req, res, next) => {
  try {
    const { mailId } = req.params;
    const { data: stored, error } = await deliveredCertifiedMail(mailId).maybeSingle();
    if (error) throw error;

    // The proof names a person who sent it as neighbors see them (their Local Profile).
    const mail = await nameMailSender(stored, req.user.id);
    if (!mail) return res.status(404).json({ error: 'Certified mail not found' });
    // Same rule as the other certified routes: only the named recipient.
    if (mail.recipient_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the named recipient can download proof' });
    }
    if (!mail.acknowledged_at) {
      return res.status(400).json({ error: 'Must acknowledge before downloading proof' });
    }

    await logMailEvent(req.user.id, 'certified_proof_downloaded', mailId);

    // Phase 2 returns proof data; actual PDF generation is a future enhancement
    res.json({
      proof: {
        mailId,
        sender: mail.sender_display,
        senderTrust: mail.sender_trust,
        deliveredAt: mail.delivered_at,
        acknowledgedAt: mail.acknowledged_at,
        acknowledgedBy: mail.acknowledged_by,
        legalTimestamp: mail.legal_timestamp,
        auditTrail: mail.audit_trail,
      },
    });
  } catch (err) { next(err); }
});

// ── FAMILY MAIL PARTY ─────────────────────────────────────

// POST /party/create — initiate a mail party session
router.post('/party/create', validate(createPartySchema), async (req, res, next) => {
  try {
    const { mailId } = req.body;

    // Check the item is from Home drawer
    const { data: mail } = await supabaseAdmin
      .from('Mail')
      .select('*')
      .eq('id', mailId)
      .single();

    if (!mail || !(await canAccessMail(mail, req.user.id))) return res.status(404).json({ error: 'Mail not found' });
    if (mail.drawer !== 'home') {
      return res.status(400).json({ error: 'Mail Party only for Home drawer items' });
    }

    // Check user's and home's party preference
    const { data: user } = await supabaseAdmin
      .from('User')
      .select('mail_party_enabled')
      .eq('id', req.user.id)
      .single();

    if (!user?.mail_party_enabled) {
      return res.status(400).json({ error: 'Mail Party is disabled for your account' });
    }

    // The party belongs to the letter's Home: its members join, and the
    // letter can only be handed to one of them (POST /party/assign).
    const homeId = mail.recipient_home_id;
    if (!homeId || !(await getAccessibleHomeIds(req.user.id)).includes(homeId)) {
      return res.status(400).json({ error: 'No home found' });
    }

    const { data: home } = await supabaseAdmin
      .from('Home')
      .select('mail_party_enabled')
      .eq('id', homeId)
      .single();

    if (!home?.mail_party_enabled) {
      return res.status(400).json({ error: 'Mail Party is disabled for your household' });
    }

    // Create session
    const { data: session } = await supabaseAdmin
      .from('MailPartySession')
      .insert({
        mail_id: mailId,
        home_id: homeId,
        initiated_by: req.user.id,
        status: 'pending',
      })
      .select()
      .single();

    // Add initiator as participant
    await supabaseAdmin
      .from('MailPartyParticipant')
      .insert({
        session_id: session.id,
        user_id: req.user.id,
        present: true,
        joined_at: new Date().toISOString(),
      });

    await logMailEvent(req.user.id, 'mail_party_initiated', mailId, {
      session_id: session.id,
    });

    res.json({ session, expiresIn: 90 });
  } catch (err) { next(err); }
});

// POST /party/join — join an existing party session
router.post('/party/join', validate(joinPartySchema), async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    const { data: session } = await supabaseAdmin
      .from('MailPartySession')
      .select('*')
      .eq('id', sessionId)
      .in('status', ['pending', 'active'])
      .single();

    // Only the session's household may join (the rule GET /party/active lists by).
    if (!session || !(await getAccessibleHomeIds(req.user.id)).includes(session.home_id)) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    // Check 90-second expiry
    const elapsed = Date.now() - new Date(session.created_at).getTime();
    if (elapsed > 90000 && session.status === 'pending') {
      await supabaseAdmin
        .from('MailPartySession')
        .update({ status: 'expired' })
        .eq('id', sessionId);
      return res.status(400).json({ error: 'Session expired' });
    }

    // Add/update participant
    await supabaseAdmin
      .from('MailPartyParticipant')
      .upsert({
        session_id: sessionId,
        user_id: req.user.id,
        present: true,
        joined_at: new Date().toISOString(),
      }, { onConflict: 'session_id,user_id' });

    // Activate session
    await supabaseAdmin
      .from('MailPartySession')
      .update({
        status: 'active',
        opened_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    await logMailEvent(req.user.id, 'mail_party_joined', session.mail_id, {
      session_id: sessionId,
    });

    res.json({ session: { ...session, status: 'active' } });
  } catch (err) { next(err); }
});

// POST /party/decline — decline party invite
router.post('/party/decline', validate(joinPartySchema), async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    await logMailEvent(req.user.id, 'mail_party_declined', null, { session_id: sessionId });
    res.json({ message: 'Declined. You can still open the item solo.' });
  } catch (err) { next(err); }
});

// POST /party/reaction — send ephemeral reaction
router.post('/party/reaction', validate(partyReactionSchema), async (req, res, next) => {
  try {
    const { sessionId, reaction } = req.body;
    await logMailEvent(req.user.id, 'mail_party_reaction', null, {
      session_id: sessionId, reaction,
    });
    // In production, this would push via WebSocket. For Phase 2, log the event.
    res.json({ reaction, ttl: 5 });
  } catch (err) { next(err); }
});

// POST /party/assign — assign mail item to a household member
router.post('/party/assign', validate(partyAssignSchema), async (req, res, next) => {
  try {
    const { sessionId, mailId, assignToUserId } = req.body;
    const mail = await readableMail(mailId, req.user.id);
    if (!mail) return res.status(404).json({ error: 'Mail not found' });

    // Only a live party for this letter that the caller is part of may hand
    // it off, and only to a member of the letter's Home: any other session id
    // or recipient used to move the letter into that account's mailbox.
    const { data: session } = await supabaseAdmin
      .from('MailPartySession')
      .select('id')
      .eq('id', sessionId)
      .eq('mail_id', mailId)
      .in('status', ['pending', 'active'])
      .maybeSingle();
    const { data: participants } = session
      ? await supabaseAdmin
        .from('MailPartyParticipant')
        .select('user_id')
        .eq('session_id', sessionId)
      : { data: [] };
    if (!session || !(participants || []).some((p) => p.user_id === req.user.id)) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }
    if (!mail.recipient_home_id
      || !(await getAccessibleHomeIds(assignToUserId)).includes(mail.recipient_home_id)) {
      return res.status(400).json({ error: 'Choose someone in this household.' });
    }

    // Move to assigned user's Counter
    const { error: assignError } = await supabaseAdmin
      .from('Mail')
      .update({
        recipient_user_id: assignToUserId,
        lifecycle: 'delivered',
        drawer: 'personal',
      })
      .eq('id', mailId);
    if (assignError) {
      logger.error('Mail party assign failed', { mailId, sessionId, error: assignError.message });
      return res.status(500).json({ error: "Couldn't assign this mail. Please try again." });
    }

    // Complete session

    await supabaseAdmin
      .from('MailPartySession')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', sessionId);

    await logMailEvent(req.user.id, 'mail_party_assigned', mailId, {
      session_id: sessionId, assigned_to: assignToUserId,
    });

    await logMailEvent(req.user.id, 'mail_party_completed', mailId, {
      session_id: sessionId,
      participant_count: (participants || []).length,
    });

    res.json({ message: 'Item assigned', assignedTo: assignToUserId });
  } catch (err) { next(err); }
});

// GET /party/active — check for active party sessions in household
router.get('/party/active', async (req, res, next) => {
  try {
    const homeIds = await getAccessibleHomeIds(req.user.id);
    if (homeIds.length === 0) return res.json({ sessions: [] });

    const { data: sessions } = await supabaseAdmin
      .from('MailPartySession')
      .select('*, Mail!inner(id, sender_display, subject, sender_trust, sender_user_id, sender_entity_id, sender_business_name)')
      .in('home_id', homeIds)
      .is('Mail.deleted_at', null)
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: false });

    // Filter expired
    const active = (sessions || []).filter(s => {
      if (s.status === 'active') return true;
      const elapsed = Date.now() - new Date(s.created_at).getTime();
      return elapsed <= 90000;
    });

    // The letter's sender as the household sees them (a person by their Local Profile); the sender fields read for
    // that stay out of the response.
    const letters = await nameMailSenders(active.map((s) => s.Mail), req.user.id);
    res.json({
      sessions: active.map((s, i) => {
        const { sender_user_id: _u, sender_entity_id: _e, sender_business_name: _b, ...letter } = letters[i] || {};
        return { ...s, Mail: letter };
      }),
    });
  } catch (err) { next(err); }
});

// ── VAULT ─────────────────────────────────────────────────

// GET /vault/folders — get vault folders by drawer
router.get('/vault/folders', async (req, res, next) => {
  try {
    const { drawer } = req.query;
    const homeIds = await getAccessibleHomeIds(req.user.id);

    // Ensure system folders exist: the caller's own Me and Biz folders, and one cabinet per readable Home.
    await ensureSystemFolders(req.user.id, homeIds);

    // Home folders are shared by everyone who may read that Home's mail; item_count is what the caller can read.
    const folders = await mailVault.readableFolders(req.user.id, homeIds,
      { drawer: ['personal', 'home', 'business'].includes(drawer) ? drawer : undefined });

    // Group by drawer
    const grouped = {};
    for (const f of (folders || [])) {
      if (!grouped[f.drawer]) grouped[f.drawer] = [];
      grouped[f.drawer].push(f);
    }

    res.json({ folders: folders || [], grouped });
  } catch (err) { next(err); }
});

// POST /vault/folder — create custom folder
router.post('/vault/folder', validate(createFolderSchema), async (req, res, next) => {
  try {
    const { drawer, label, icon, color, autoFileRules } = req.body;
    // A Home folder goes in that Home's cabinet, which everyone who may read its mail shares.
    let homeId = null;
    if (drawer === 'home') {
      const homeIds = await getAccessibleHomeIds(req.user.id);
      homeId = req.body.home_id ? String(req.body.home_id).toLowerCase() : (homeIds.length === 1 ? homeIds[0] : null);
      if (!homeId || !homeIds.includes(homeId)) {
        return res.status(400).json({ error: "Choose a home whose mail you can open for this folder.", code: 'MAIL_FOLDER_INVALID' });
      }
    }

    const { data: folder, error } = await supabaseAdmin
      .from('VaultFolder')
      .insert({
        user_id: req.user.id,
        home_id: homeId,
        drawer,
        label,
        icon: icon || '📂',
        color: color || '#374151',
        system: false,
        auto_file_rules: autoFileRules || [],
      })
      .select()
      .single();
    if (error || !folder) {
      logger.error('Vault folder create failed', { error: error?.message });
      return res.status(500).json({ error: "Couldn't make this folder. Try again in a moment.", code: 'MAIL_UNAVAILABLE' });
    }

    await logMailEvent(req.user.id, 'vault_folder_created', null, {
      folder_id: folder.id, drawer,
    });

    res.json({ folder });
  } catch (err) { next(err); }
});

// PATCH /vault/folder/:folderId — update folder
router.patch('/vault/folder/:folderId', validate(updateFolderSchema), async (req, res, next) => {
  try {
    const { folderId } = req.params;
    const updates = {};
    if (req.body.label) updates.label = req.body.label;
    if (req.body.icon) updates.icon = req.body.icon;
    if (req.body.color) updates.color = req.body.color;
    if (req.body.autoFileRules) updates.auto_file_rules = req.body.autoFileRules;
    updates.updated_at = new Date().toISOString();

    // The caller's own folder, or a folder of a Home whose mail they may read (the Home's cabinet is shared).
    const resolved = await mailVault.resolveFolder(folderId, req.user.id, await getAccessibleHomeIds(req.user.id));
    if (!resolved) return res.status(404).json({ error: "This folder isn't in your Vault.", code: 'MAIL_FOLDER_NOT_FOUND' });
    const { data: folder } = await supabaseAdmin
      .from('VaultFolder')
      .update(updates)
      .eq('id', resolved.folder.id)
      .select()
      .single();

    res.json({ folder });
  } catch (err) { next(err); }
});

// GET /vault/folder/:folderId/items — get items in a folder
router.get('/vault/folder/:folderId/items', async (req, res, next) => {
  try {
    const { folderId } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    // The caller's own Me or Biz folder, or a folder of a Home whose mail they may read (shared by its readers).
    const homeIds = await getAccessibleHomeIds(req.user.id);
    const resolved = await mailVault.resolveFolder(folderId, req.user.id, homeIds);
    if (!resolved) return res.status(404).json({ error: "This folder isn't in your Vault.", code: 'MAIL_FOLDER_NOT_FOUND' });

    // Only letters the caller can still read: a Home letter filed here leaves with its Home (a member who was
    // removed, moved out or whose guest access ended no longer sees the household's letters).
    const { data: items, count } = await supabaseAdmin
      .from('Mail')
      .select('*', { count: 'exact' })
      .in('vault_folder_id', resolved.ids)
      .or(visibleMailFilter(req.user.id, homeIds))
      .lte('delivered_at', new Date().toISOString())
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      // Mail delivered together shares created_at; the id keeps the order the same on every page.
      .order('id', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    await logMailEvent(req.user.id, 'vault_folder_opened', null, {
      folder_id: folderId,
    });

    res.json({ items: presentMailSenders(await nameMailSenders(items || [], req.user.id), req.user.id), total: count || 0 });
  } catch (err) { next(err); }
});

// POST /vault/file — file an item to a vault folder
router.post('/vault/file', validate(fileToVaultSchema), async (req, res, next) => {
  try {
    const { mailId } = req.body;
    const readable = await readableMail(mailId, req.user.id);
    if (!readable) return res.status(404).json({ error: "This mail isn't in your mailbox. It may have been removed.", code: 'MAIL_NOT_FOUND' });
    // A Home letter goes in its own Home's folder (shared by the household); other mail in the caller's own folder.
    const resolved = await mailVault.resolveFolder(req.body.folderId, req.user.id, await getAccessibleHomeIds(req.user.id));
    if (!resolved) return res.status(404).json({ error: "This folder isn't in your Vault.", code: 'MAIL_FOLDER_NOT_FOUND' });
    const { data: piece } = await supabaseAdmin.from('Mail').select('drawer, recipient_home_id').eq('id', mailId).maybeSingle();
    if (!mailVault.folderFits(resolved, piece)) {
      return res.status(400).json({ error: "This mail can't go in that folder. Choose one in its own drawer.", code: 'MAIL_ACTION_INVALID' });
    }
    const folderId = resolved.folder.id;

    const { error: fileError } = await supabaseAdmin
      .from('Mail')
      .update({
        vault_folder_id: folderId,
        lifecycle: 'filed',
      })
      .eq('id', mailId);
    // supabase-js reports a failed write instead of throwing: without this
    // check the apps said "Saved to vault" for mail that did not move.
    if (fileError) {
      logger.error('Vault file update failed', { mailId, folderId, error: fileError.message });
      return res.status(500).json({ error: "Couldn't file this mail. Please try again." });
    }

    // Update folder count
    const { data: folder } = await supabaseAdmin
      .from('VaultFolder')
      .select('item_count, drawer')
      .eq('id', folderId)
      .single();

    if (folder) {
      await supabaseAdmin
        .from('VaultFolder')
        .update({ item_count: (folder.item_count || 0) + 1 })
        .eq('id', folderId);
    }

    await logMailEvent(req.user.id, 'vault_item_filed', mailId, {
      folder_id: folderId, method: 'manual',
    });

    res.json({ message: 'Item filed', folderId });
  } catch (err) { next(err); }
});

// POST /vault/auto-file — run auto-filing rules on delivered items. One call reads at most AUTO_FILE_MAX_PAGES pages of
// unfiled mail; when it stops there, nextAfter is the `after` a following call passes to go on.
const AUTO_FILE_MAX_PAGES = 10;
router.post('/vault/auto-file', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const after = req.body?.after;
    if (after !== undefined && !MAIL_ID.test(String(after))) {
      return res.status(400).json({ error: 'Go on auto-filing from the nextAfter of the last run.', code: 'MAIL_AUTO_FILE_INVALID' });
    }
    const homeIds = await getAccessibleHomeIds(userId);
    // Use the same cabinet as manual filing: Home folders belong to the Home,
    // not to the member who first created them.
    const folders = await mailVault.readableFolders(userId, homeIds);

    let filed = 0, afterId = after || null, nextAfter = null;
    // Scan past unmatched pages. A stable id cursor avoids skipping letters
    // when earlier matches leave the unfiled set during this same run.
    for (let page = 0; ; page += 1) {
      let query = onlyDelivered(supabaseAdmin.from('Mail').select('*')
        .or(visibleMailFilter(userId, homeIds)).is('vault_folder_id', null)
        .is('deleted_at', null).in('lifecycle', ['delivered', 'opened']))
        .order('id', { ascending: true }).limit(100);
      if (afterId) query = query.gt('id', afterId);
      const { data: items, error: itemsError } = await query;
      if (itemsError) throw itemsError;
      if (!items?.length) break;
      afterId = items[items.length - 1].id;

      const matches = [];
      for (const item of items) {
        for (const folder of folders) {
          if (!mailVault.folderFits({ folder }, item)) continue;
          const rules = Array.isArray(folder.auto_file_rules) ? folder.auto_file_rules : [];
          if (rules.some(rule => evaluateAutoFileRule(rule, item))) {
            matches.push({ itemId: item.id, folderId: folder.id });
            break;
          }
        }
      }

      // Do not overwrite a concurrent manual filing/removal or report a failed
      // write as success. Folder counts are derived from readable filed mail.
      const outcomes = await Promise.all(matches.map(async m => {
        const { data, error } = await supabaseAdmin.from('Mail')
          .update({ vault_folder_id: m.folderId, lifecycle: 'filed' }).eq('id', m.itemId)
          .is('vault_folder_id', null).is('deleted_at', null)
          .in('lifecycle', ['delivered', 'opened']).select('id');
        if (error) throw error;
        if (!data?.length) return 0;
        await logMailEvent(userId, 'vault_auto_filed', m.itemId, { folder_id: m.folderId });
        return 1;
      }));
      filed += outcomes.reduce((sum, count) => sum + count, 0);
      if (items.length < 100) break;
      // A mailbox with a lot left unfiled: stop here and say where the next call goes on.
      if (page === AUTO_FILE_MAX_PAGES - 1) {
        nextAfter = afterId;
        break;
      }
    }

    res.json({ message: `Auto-filed ${filed} items`, filed, nextAfter });
  } catch (err) { next(err); }
});

// GET /vault/search — semantic search across mail
router.get('/vault/search', async (req, res, next) => {
  try {
    const { error: validationError, value } = vaultSearchSchema.validate(req.query);
    if (validationError) {
      return res.status(400).json({ error: 'Enter a search of 1–255 characters and a valid drawer, folder and page.', code: 'MAIL_SEARCH_INVALID' });
    }
    const { q, drawer, folderId, limit, offset } = value;

    // The words searched are never logged or stored (Mail tab, SRV-3).
    await logMailEvent(req.user.id, 'vault_search_performed', null, {
      drawer_scope: drawer || 'all',
    });

    // Build search
    const homeIds = await getAccessibleHomeIds(req.user.id);
    let query = onlyDelivered(supabaseAdmin
      .from('Mail')
      .select('*', { count: 'exact' })
      .or(visibleMailFilter(req.user.id, homeIds))
      .or('drawer.is.null,drawer.neq.earn')
      .or('lifecycle.is.null,lifecycle.neq.shredded')
      .or('mail_object_type.is.null,mail_object_type.neq.bundle')
      .is('deleted_at', null));

    if (drawer) query = query.eq('drawer', drawer);
    if (folderId) {
      const resolved = await mailVault.resolveFolder(folderId, req.user.id, homeIds);
      if (!resolved) return res.status(404).json({ error: "This folder isn't in your Vault.", code: 'MAIL_FOLDER_NOT_FOUND' });
      query = query.in('vault_folder_id', resolved.ids);
    }

    // Only real month names are dates; an ordinary phrase ending in a year stays text.
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    const dateMatch = /^([a-z]+)\s+(\d{4})$/i.exec(q);
    const month = dateMatch ? monthNames.findIndex((name) => name === dateMatch[1].toLowerCase()
      || name.slice(0, 3) === dateMatch[1].toLowerCase()) : -1;

    // Amount search: "$87" or "$87.00"
    const amountMatch = q.match(/^\$(\d+(?:\.\d{1,2})?)$/);
    if (amountMatch) {
      const amount = amountMatch[1];
      // Search in key_facts jsonb for the amount value
      const facts = [amount, `$${amount}`].map((value) => `key_facts.cs.${JSON.stringify(JSON.stringify([{ value }]))}`);
      query = query.or([...facts, `subject.ilike.%${amount}%`, `content.ilike.%${amount}%`].join(','));
    }
    // Date search: "March 2025" or "Mar 2025"
    else if (month !== -1) {
      const startDate = new Date(`${dateMatch[2]}-${String(month + 1).padStart(2, '0')}-01T00:00:00.000Z`);
      const endDate = new Date(startDate);
      endDate.setUTCMonth(endDate.getUTCMonth() + 1);
      query = query.gte('created_at', startDate.toISOString()).lt('created_at', endDate.toISOString());
    }
    // General text search
    else {
      // Quote the complete pattern so commas, parentheses and quotes remain search text.
      const pattern = JSON.stringify(`%${escapeIlike(q)}%`);
      query = query.or(`subject.ilike.${pattern},content.ilike.${pattern},sender_display.ilike.${pattern}`);
    }

    query = query.order('created_at', { ascending: false })
      // Mail delivered together shares created_at; the id keeps the order the same on every page.
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: found, count, error: searchError } = await query;
    if (searchError) {
      logger.error('Vault search failed', { code: searchError.code });
      return res.status(500).json({ error: "Couldn't search your mail. Try again in a moment.", code: 'MAIL_UNAVAILABLE' });
    }
    // Each sender as neighbors see them now (their Local Profile). A text search matched the name stored when the
    // letter came: a letter only that older name matched is left out, so no one finds a sender by a name they no
    // longer show.
    const named = await nameMailSenders(found || [], req.user.id);
    const textSearch = !amountMatch && month === -1;
    const lq = q.toLowerCase();
    const results = textSearch
      ? named.filter((item) => [item.sender_display, item.subject, item.content].some((text) => text?.toLowerCase().includes(lq)))
      : named;

    // Add highlight info
    const enhanced = results.map(item => {
      let matchedField = '';
      let matchExcerpt = '';
      if (item.sender_display?.toLowerCase().includes(lq)) {
        matchedField = 'sender';
        matchExcerpt = item.sender_display;
      } else if (item.subject?.toLowerCase().includes(lq)) {
        matchedField = 'subject';
        matchExcerpt = item.subject;
      } else if (item.content?.toLowerCase().includes(lq)) {
        matchedField = 'content';
        const idx = item.content.toLowerCase().indexOf(lq);
        matchExcerpt = item.content.substring(Math.max(0, idx - 30), idx + q.length + 30);
      }
      return { ...presentMailSender(item, req.user.id), _matchField: matchedField, _matchExcerpt: matchExcerpt };
    });

    res.json({ results: enhanced, total: Math.max(0, (count || 0) - (named.length - results.length)), query: q });
  } catch (err) { next(err); }
});

// ── PACKAGE PHASE 2 ───────────────────────────────────────

// POST /package/:mailId/unboxing — virtual unboxing actions
router.post('/package/:mailId/unboxing', validate(packageUnboxingSchema), async (req, res, next) => {
  try {
    const { mailId } = req.params;
    if (!(await readableMail(mailId, req.user.id))) return res.status(404).json({ error: 'Package not found' });
    const { conditionPhotoUrl, unboxingVideoUrl, skip } = req.body;

    const updates = {};
    if (conditionPhotoUrl) {
      updates.condition_photo_url = conditionPhotoUrl;
      await logMailEvent(req.user.id, 'package_unboxing_photo_taken', mailId);
    }
    if (unboxingVideoUrl) {
      updates.unboxing_video_url = unboxingVideoUrl;
      await logMailEvent(req.user.id, 'package_unboxing_video_taken', mailId);
    }
    if (skip) {
      updates.unboxing_completed = true;
    }
    updates.unboxing_completed = true;

    await supabaseAdmin
      .from('MailPackage')
      .update(updates)
      .eq('mail_id', mailId);

    res.json({ message: 'Unboxing recorded', updates });
  } catch (err) { next(err); }
});

// POST /package/:mailId/save-warranty — save warranty/manual to vault
router.post('/package/:mailId/save-warranty', async (req, res, next) => {
  try {
    const { mailId } = req.params;
    if (!(await readableMail(mailId, req.user.id))) return res.status(404).json({ error: 'Package not found' });
    const { type } = req.body; // 'warranty' | 'manual'

    const updates = {};
    if (type === 'warranty') updates.warranty_saved = true;
    if (type === 'manual') updates.manual_saved = true;

    await supabaseAdmin
      .from('MailPackage')
      .update(updates)
      .eq('mail_id', mailId);

    // Auto-file to Home > Warranties folder
    const { data: folder } = await supabaseAdmin
      .from('VaultFolder')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('label', 'Warranties')
      .eq('drawer', 'home')
      .single();

    if (folder) {
      await logMailEvent(req.user.id, 'booklet_saved_to_vault', mailId, {
        folder_id: folder.id, type,
      });
    }

    res.json({ message: `${type} saved`, folder: folder?.id });
  } catch (err) { next(err); }
});

// Posting a task for a package isn't built yet. These routes used to answer "Gig created" with a made-up id (and
// store whatever neighbor the client named as the one who accepted), while no task existed, so the apps said "Task
// Posted!" for nothing. Until package tasks are real, refuse and write nothing.
const PACKAGE_GIG_UNAVAILABLE = "Posting a task for a package isn't available yet.";

// POST /package/:mailId/gig — create a gig from package (not available yet)
router.post('/package/:mailId/gig', validate(packageGigSchema), (req, res) => {
  res.status(501).json({ error: PACKAGE_GIG_UNAVAILABLE });
});

// POST /package/:mailId/gig-accepted — mark a package gig accepted (not available yet)
router.post('/package/:mailId/gig-accepted', (req, res) => {
  res.status(501).json({ error: PACKAGE_GIG_UNAVAILABLE });
});

// ── COUPON → ORDER PIPELINE ───────────────────────────────

// POST /coupon/browse — initiate browsing a merchant from an offer
router.post('/coupon/browse', validate(couponBrowseSchema), async (req, res, next) => {
  try {
    const { offerId } = req.body;

    const { data: offer } = await supabaseAdmin
      .from('EarnOffer')
      .select('*')
      .eq('id', offerId)
      .single();

    if (!offer) return res.status(404).json({ error: 'Offer not found' });

    await logMailEvent(req.user.id, 'coupon_browse_initiated', null, {
      offer_id: offerId, merchant_id: offer.merchant_id,
    });

    res.json({
      offer,
      merchantOnPantopus: offer.merchant_on_pantopus,
      discountType: offer.discount_type,
      discountValue: offer.discount_value,
    });
  } catch (err) { next(err); }
});

// POST /coupon/order — disabled: coupon orders aren't available yet, and no app calls this route.
// The previous handler set the caller's EarnTransaction for any existing offer to `available`. It did so with no
// checks, lifting risk holds (flagged, under_review, rejected), and it could be repeated. Nothing here writes
// EarnTransaction now. A real implementation needs at least:
//   - ownership: the offer was delivered to the caller and they opened it;
//   - a status filter: release only a transaction that passed the dwell check (`verified`), never a held
//     (`flagged`, `under_review`, `suspended`) or `rejected` one;
//   - idempotency: one order per user and offer, so a repeat can't add redemptions or re-release a payout;
//   - a price minimum: every item price must be positive;
//   - a valid receipt type: `Mail.type` 'receipt' fails Mail_type_check, so the receipt letter was never created.
router.post('/coupon/order', (req, res) => {
  res.status(410).json({ error: "Coupon orders aren't available yet." });
});

// POST /coupon/save — save offer for later/in-store use
router.post('/coupon/save', async (req, res, next) => {
  try {
    const { offerId } = req.body;

    await supabaseAdmin
      .from('OfferRedemption')
      .upsert({
        offer_id: offerId,
        user_id: req.user.id,
        redemption_type: 'save',
        status: 'pending',
      }, { onConflict: 'offer_id,user_id' });

    await logMailEvent(req.user.id, 'coupon_code_saved', null, { offer_id: offerId });

    res.json({ message: 'Offer saved' });
  } catch (err) { next(err); }
});

// GET /coupon/qr/:offerId — get QR code for in-store redemption
router.get('/coupon/qr/:offerId', async (req, res, next) => {
  try {
    const { offerId } = req.params;
    const { data: offer } = await supabaseAdmin
      .from('EarnOffer')
      .select('qr_code_url, offer_code')
      .eq('id', offerId)
      .single();

    if (!offer) return res.status(404).json({ error: 'Offer not found' });

    await logMailEvent(req.user.id, 'coupon_qr_shown', null, { offer_id: offerId });

    res.json({ qrCodeUrl: offer.qr_code_url, code: offer.offer_code });
  } catch (err) { next(err); }
});

// ── ADVANCED ANTI-GAMING ──────────────────────────────────

// GET /earn/risk-status — get user's current risk/suspension status
router.get('/earn/risk-status', async (req, res, next) => {
  try {
    const { data: suspension } = await supabaseAdmin
      .from('EarnSuspension')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const { data: recentSession } = await supabaseAdmin
      .from('EarnRiskSession')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Check pending reviews
    const { count: underReview } = await supabaseAdmin
      .from('EarnTransaction')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .eq('status', 'under_review');

    res.json({
      suspended: suspension ? {
        reason: suspension.reason,
        expiresAt: suspension.expires_at,
        canAppeal: !suspension.appealed,
      } : null,
      riskScore: recentSession?.risk_score || 0,
      underReviewCount: underReview || 0,
    });
  } catch (err) { next(err); }
});

// POST /earn/update-risk — update risk session (called per earn open)
router.post('/earn/update-risk', async (req, res, next) => {
  try {
    const { sessionId, offerId, dwellMs, advertiserId } = req.body;

    // Check for active suspension
    const { data: suspension } = await supabaseAdmin
      .from('EarnSuspension')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('resolved', false)
      .gte('expires_at', new Date().toISOString())
      .limit(1)
      .single();

    if (suspension) {
      return res.status(403).json({ error: 'Earn suspended', suspended: true });
    }

    // Get or create session
    let session;
    if (sessionId) {
      const { data } = await supabaseAdmin
        .from('EarnRiskSession')
        .select('*')
        .eq('id', sessionId)
        .single();
      session = data;
    }

    if (!session) {
      const { data } = await supabaseAdmin
        .from('EarnRiskSession')
        .insert({
          user_id: req.user.id,
        })
        .select()
        .single();
      session = data;
    }

    // Update session metrics
    const updates = {
      opens_count: (session.opens_count || 0) + 1,
      total_dwell_ms: (session.total_dwell_ms || 0) + (dwellMs || 0),
      updated_at: new Date().toISOString(),
    };

    // Track distinct advertisers
    if (advertiserId) {
      // Simple: use metadata approach
      updates.distinct_advertisers = (session.distinct_advertisers || 0) + 1;
    }

    if (req.body.saved) updates.saves_count = (session.saves_count || 0) + 1;
    if (req.body.revealed) updates.reveals_count = (session.reveals_count || 0) + 1;

    const updatedSession = { ...session, ...updates };
    const riskScore = calculateRiskScore(updatedSession);
    updates.risk_score = riskScore;

    await supabaseAdmin
      .from('EarnRiskSession')
      .update(updates)
      .eq('id', session.id);

    // Act on risk thresholds
    let action = 'normal';
    if (riskScore >= 85) {
      // Suspend
      const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
      await supabaseAdmin
        .from('EarnSuspension')
        .insert({
          user_id: req.user.id,
          reason: 'Unusual engagement patterns detected',
          risk_score: riskScore,
          duration_days: 7,
          expires_at: expiresAt,
        });

      await supabaseAdmin
        .from('User')
        .update({ earn_suspended_until: expiresAt })
        .eq('id', req.user.id);

      await logMailEvent(req.user.id, 'earn_suspended', null, {
        risk_score: riskScore, duration_days: 7,
      });
      action = 'suspended';
    } else if (riskScore >= 60) {
      // Flag for manual review
      await supabaseAdmin
        .from('EarnTransaction')
        .update({ status: 'under_review', risk_score: riskScore })
        .eq('user_id', req.user.id)
        .eq('status', 'pending');

      await logMailEvent(req.user.id, 'earn_risk_flagged', null, {
        risk_score: riskScore, session_id: session.id,
      });
      action = 'under_review';
    } else if (riskScore >= 30) {
      // 48h hold
      action = 'pending_review';
    }

    res.json({ sessionId: session.id, riskScore, action });
  } catch (err) { next(err); }
});

// POST /earn/appeal — submit appeal for suspension
router.post('/earn/appeal', validate(riskAppealSchema), async (req, res, next) => {
  try {
    const { appealText } = req.body;

    const { data: suspension } = await supabaseAdmin
      .from('EarnSuspension')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!suspension) return res.status(404).json({ error: 'No active suspension' });
    if (suspension.appealed) return res.status(400).json({ error: 'Already appealed' });

    await supabaseAdmin
      .from('EarnSuspension')
      .update({
        appealed: true,
        appeal_text: appealText,
        appeal_at: new Date().toISOString(),
      })
      .eq('id', suspension.id);

    await logMailEvent(req.user.id, 'earn_appeal_submitted', null, {
      suspension_id: suspension.id,
    });

    res.json({
      message: 'Appeal submitted. We\'ll review within 48 hours.',
      suspensionId: suspension.id,
    });
  } catch (err) { next(err); }
});

// ── SEED DATA (Phase 2) ──────────────────────────────────

router.post('/seed-p2', verifyToken, async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Route not found' });
    }
    const userId = req.user.id;
    const homeIds = await getAccessibleHomeIds(userId);
    const homeId = homeIds[0] || null;

    // Seed a booklet
    const { data: booklet } = await supabaseAdmin
      .from('Mail')
      .insert({
        recipient_user_id: userId,
        drawer: 'home',
        mail_object_type: 'booklet',
        sender_display: 'Camas HOA',
        sender_trust: 'verified_business',
        subject: 'Community Bulletin — March 2026',
        content: 'Annual meeting, landscaping schedule, parking policy',
        preview_text: 'March 2026 — Community updates enclosed',
        page_count: 14,
        cover_image_url: null,
        download_size_bytes: 4200000,
        streaming_available: true,
        lifecycle: 'delivered',
        urgency: 'none',
        key_facts: JSON.stringify([
          { field: 'Meeting date', value: 'March 15, 2026', confidence: 0.95 },
          { field: 'Pages', value: '14', confidence: 1 },
        ]),
      })
      .select()
      .single();

    // Add booklet pages
    if (booklet) {
      const pages = [];
      for (let i = 1; i <= 4; i++) {
        pages.push({
          mail_id: booklet.id,
          page_number: i,
          text_content: i === 1 ? 'Camas HOA Community Bulletin — March 2026' :
            i === 2 ? 'Annual meeting scheduled for March 15, 2026 at 7 PM.' :
            i === 3 ? 'Landscaping: Mon/Thu. Pool maintenance: Weekly Fridays.' :
            'Guest parking limited to 48 hours effective April 1, 2026.',
        });
      }
      await supabaseAdmin.from('BookletPage').insert(pages);
    }

    // Seed certified mail
    const { data: certified } = await supabaseAdmin
      .from('Mail')
      .insert({
        recipient_user_id: userId,
        drawer: 'personal',
        mail_object_type: 'envelope',
        certified: true,
        requires_acknowledgment: true,
        sender_display: 'Clark County Assessor',
        sender_trust: 'verified_gov',
        subject: 'Property Tax Assessment Notice 2026',
        content: 'Parcel ****8821 · $2,340.00 due April 30',
        preview_text: 'Property tax assessment — requires acknowledgment',
        lifecycle: 'delivered',
        urgency: 'time_sensitive',
        legal_timestamp: new Date().toISOString(),
        audit_trail: JSON.stringify([
          { event: 'delivered', timestamp: new Date().toISOString() },
        ]),
        key_facts: JSON.stringify([
          { field: 'Amount due', value: '$2,340.00', confidence: 0.98 },
          { field: 'Due date', value: 'April 30, 2026', confidence: 0.95 },
          { field: 'Parcel', value: '****8821', confidence: 1 },
          { field: 'Appeal deadline', value: 'March 15, 2026', confidence: 0.9 },
        ]),
      })
      .select()
      .single();

    // Seed bundle items (4 from same sender)
    const bundleItems = [];
    const pgeSender = {
      sender_display: 'Pacific Gas & Electric',
      sender_trust: 'verified_utility',
      drawer: 'home',
    };
    for (const item of [
      { subject: '$87.00 due Feb 28', category: 'bill', urgency: 'due_soon' },
      { subject: 'January usage summary — 412 kWh', category: 'statement', urgency: 'none' },
      { subject: 'Rate adjustment effective April 1', category: 'notice', urgency: 'none' },
      { subject: 'Auto-pay confirmation · $85.00', category: 'receipt', urgency: 'none' },
    ]) {
      const { data: m } = await supabaseAdmin
        .from('Mail')
        .insert({
          recipient_user_id: userId,
          recipient_home_id: homeId,
          mail_object_type: 'envelope',
          ...pgeSender,
          ...item,
          content: item.subject,
          preview_text: item.subject,
          lifecycle: 'delivered',
        })
        .select()
        .single();
      if (m) bundleItems.push(m);
    }

    // Seed an EarnOffer with merchant
    await supabaseAdmin
      .from('EarnOffer')
      .insert({
        advertiser_id: userId,
        business_name: 'Camas Brewing Co.',
        business_init: 'CB',
        business_color: '#78350F',
        offer_title: '15% off your entire order',
        offer_subtitle: 'Off your entire order · Expires Mar 15',
        payout_amount: 0.25,
        merchant_on_pantopus: true,
        discount_type: 'percentage',
        discount_value: 15,
        status: 'active',
      });

    // Ensure vault folders
    await ensureSystemFolders(userId, homeIds);

    res.json({
      message: 'Phase 2 test data seeded',
      booklet: booklet?.id,
      certified: certified?.id,
      bundleItems: bundleItems.length,
    });
  } catch (err) { next(err); }
});

module.exports = router;
