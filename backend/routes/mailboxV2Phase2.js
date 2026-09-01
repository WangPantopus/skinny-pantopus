const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const Joi = require('joi');
const logger = require('../utils/logger');

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
  q: Joi.string().min(1).max(255).required(),
  drawer: Joi.string().valid('personal', 'home', 'business').optional(),
  folderId: Joi.string().uuid().optional(),
  limit: Joi.number().integer().min(1).max(50).optional(),
  offset: Joi.number().integer().min(0).optional(),
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

const couponOrderSchema = Joi.object({
  offerId: Joi.string().uuid().required(),
  items: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    price: Joi.number().required(),
    quantity: Joi.number().integer().min(1).default(1),
  })).min(1).required(),
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

async function getAccessibleHomeIds(userId) {
  const { data } = await supabaseAdmin
    .from('HomeOccupancy')
    .select('home_id')
    .eq('user_id', userId)
    .eq('is_active', true);
  return (data || []).map(r => r.home_id);
}

async function ensureSystemFolders(userId, homeIds) {
  const SYSTEM_FOLDERS = {
    personal: [
      { label: 'Taxes', icon: '📋', color: '#1E40AF' },
      { label: 'Medical', icon: '🏥', color: '#065F46' },
      { label: 'School', icon: '🎓', color: '#6D28D9' },
      { label: 'Receipts', icon: '🧾', color: '#D97706' },
      { label: 'Bank', icon: '🏦', color: '#374151' },
    ],
    home: [
      { label: 'Utilities', icon: '⚡', color: '#065F46' },
      { label: 'Warranties', icon: '🔧', color: '#7C3AED' },
      { label: 'Permits', icon: '📜', color: '#B91C1C' },
      { label: 'HOA', icon: '🏘', color: '#0C4A6E' },
      { label: 'Mortgage', icon: '🏡', color: '#78350F' },
    ],
    business: [
      { label: 'Invoices', icon: '📩', color: '#1E40AF' },
      { label: 'Contracts', icon: '📝', color: '#065F46' },
      { label: 'Government', icon: '🏛', color: '#991B1B' },
      { label: 'Subscriptions', icon: '💳', color: '#7C3AED' },
    ],
  };

  const AUTO_RULES = {
    'personal:Taxes': [
      { field: 'sender_name', operator: 'contains', value: 'IRS' },
      { field: 'sender_trust', operator: 'equals', value: 'verified_gov' },
    ],
    'personal:Receipts': [
      { field: 'category', operator: 'equals', value: 'receipt' },
    ],
    'personal:Medical': [
      { field: 'keyword', operator: 'contains', value: 'EOB' },
      { field: 'keyword', operator: 'contains', value: 'explanation of benefits' },
    ],
    'personal:Bank': [
      { field: 'keyword', operator: 'contains', value: 'bank statement' },
    ],
    'home:Utilities': [
      { field: 'sender_trust', operator: 'equals', value: 'verified_utility' },
    ],
    'home:Warranties': [
      { field: 'keyword', operator: 'contains', value: 'warranty' },
      { field: 'keyword', operator: 'contains', value: 'manual' },
    ],
    'home:Permits': [
      { field: 'keyword', operator: 'contains', value: 'permit' },
      { field: 'keyword', operator: 'contains', value: 'variance' },
    ],
    'home:HOA': [
      { field: 'sender_name', operator: 'contains', value: 'HOA' },
    ],
    'home:Mortgage': [
      { field: 'keyword', operator: 'contains', value: 'mortgage' },
      { field: 'keyword', operator: 'contains', value: 'escrow' },
    ],
    'business:Invoices': [
      { field: 'category', operator: 'equals', value: 'invoice' },
      { field: 'category', operator: 'equals', value: 'receipt' },
    ],
    'business:Contracts': [
      { field: 'keyword', operator: 'contains', value: 'contract' },
      { field: 'keyword', operator: 'contains', value: 'NDA' },
      { field: 'keyword', operator: 'contains', value: 'agreement' },
    ],
    'business:Government': [
      { field: 'sender_trust', operator: 'equals', value: 'verified_gov' },
    ],
    'business:Subscriptions': [
      { field: 'keyword', operator: 'contains', value: 'subscription' },
      { field: 'keyword', operator: 'contains', value: 'renewal' },
    ],
  };

  // Check if folders exist
  const { data: existing } = await supabaseAdmin
    .from('VaultFolder')
    .select('id, drawer, label')
    .eq('user_id', userId)
    .eq('system', true);

  const existingSet = new Set((existing || []).map(f => `${f.drawer}:${f.label}`));

  const inserts = [];
  for (const [drawer, folders] of Object.entries(SYSTEM_FOLDERS)) {
    for (let i = 0; i < folders.length; i++) {
      const f = folders[i];
      const key = `${drawer}:${f.label}`;
      if (!existingSet.has(key)) {
        inserts.push({
          user_id: userId,
          home_id: drawer === 'home' ? (homeIds[0] || null) : null,
          drawer,
          label: f.label,
          icon: f.icon,
          color: f.color,
          system: true,
          sort_order: i,
          auto_file_rules: AUTO_RULES[key] || [],
        });
      }
    }
  }

  if (inserts.length > 0) {
    await supabaseAdmin.from('VaultFolder').insert(inserts);
  }
}

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
  const { data: items } = await supabaseAdmin
    .from('Mail')
    .select('*')
    .eq('recipient_address_id', addressId)
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
      const { data: bundle } = await supabaseAdmin
        .from('Mail')
        .insert({
          recipient_user_id: userId,
          recipient_address_id: addressId,
          drawer,
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
      const { data: bundle } = await supabaseAdmin
        .from('Mail')
        .insert({
          recipient_user_id: userId,
          recipient_address_id: addressId,
          drawer,
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

    if (!mail) return res.status(404).json({ error: 'Booklet not found' });

    const { data: pages } = await supabaseAdmin
      .from('BookletPage')
      .select('*')
      .eq('mail_id', mailId)
      .order('page_number', { ascending: true });

    await logMailEvent(req.user.id, 'booklet_opened', mailId, { page_count: mail.page_count });

    res.json({ booklet: mail, pages: pages || [] });
  } catch (err) { next(err); }
});

// GET /booklet/:mailId/page/:pageNumber — get single page
router.get('/booklet/:mailId/page/:pageNumber', async (req, res, next) => {
  try {
    const { mailId, pageNumber } = req.params;
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
      .select('download_url, download_size_bytes')
      .eq('id', mailId)
      .single();

    if (!mail?.download_url) return res.status(404).json({ error: 'Download not available' });

    await logMailEvent(req.user.id, 'booklet_downloaded', mailId, {
      size_bytes: mail.download_size_bytes,
    });

    res.json({ downloadUrl: mail.download_url, sizeBytes: mail.download_size_bytes });
  } catch (err) { next(err); }
});

// ── BUNDLE ────────────────────────────────────────────────

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

    if (!bundle) return res.status(404).json({ error: 'Bundle not found' });

    const { data: items } = await supabaseAdmin
      .from('Mail')
      .select('*')
      .eq('bundle_id', bundleId)
      .order('urgency', { ascending: true })
      .order('created_at', { ascending: false });

    await logMailEvent(req.user.id, 'bundle_expanded', bundleId, {
      item_count: (items || []).length,
    });

    res.json({ bundle, items: items || [] });
  } catch (err) { next(err); }
});

// POST /bundle/action — bundle bulk actions
router.post('/bundle/action', validate(bundleActionSchema), async (req, res, next) => {
  try {
    const { bundleId, action, folderId, itemId } = req.body;

    if (action === 'file_all') {
      if (!folderId) return res.status(400).json({ error: 'folderId required for file_all' });
      const { data: items } = await supabaseAdmin
        .from('Mail')
        .select('id')
        .eq('bundle_id', bundleId);

      const ids = (items || []).map(i => i.id);
      await supabaseAdmin
        .from('Mail')
        .update({ lifecycle: 'filed', vault_folder_id: folderId })
        .in('id', ids);

      // Update folder count
      const { data: folderData } = await supabaseAdmin
        .from('VaultFolder')
        .select('item_count')
        .eq('id', folderId)
        .single();
      if (folderData) {
        await supabaseAdmin.from('VaultFolder').update({
          item_count: (folderData.item_count || 0) + ids.length,
        }).eq('id', folderId);
      }

      await logMailEvent(req.user.id, 'bundle_filed_all', bundleId, {
        folder_id: folderId, count: ids.length,
      });

      return res.json({ message: `Filed ${ids.length} items`, count: ids.length });
    }

    if (action === 'open_all') {
      const { data: items } = await supabaseAdmin
        .from('Mail')
        .select('id')
        .eq('bundle_id', bundleId);

      const ids = (items || []).map(i => i.id);
      await supabaseAdmin
        .from('Mail')
        .update({ lifecycle: 'opened', opened_at: new Date().toISOString() })
        .in('id', ids);

      return res.json({ message: `Opened ${ids.length} items`, count: ids.length });
    }

    if (action === 'extract_item') {
      if (!itemId) return res.status(400).json({ error: 'itemId required for extract_item' });
      await supabaseAdmin
        .from('Mail')
        .update({ bundle_id: null })
        .eq('id', itemId);

      // Update bundle item count
      const { data: remaining } = await supabaseAdmin
        .from('Mail')
        .select('id')
        .eq('bundle_id', bundleId);

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

// GET /certified/:mailId — get certified mail detail
router.get('/certified/:mailId', async (req, res, next) => {
  try {
    const { mailId } = req.params;
    const { data: mail } = await supabaseAdmin
      .from('Mail')
      .select('*')
      .eq('id', mailId)
      .eq('certified', true)
      .single();

    if (!mail) return res.status(404).json({ error: 'Certified mail not found' });

    // Permission check: only named recipient
    if (mail.recipient_user_id !== req.user.id) {
      return res.status(403).json({
        error: 'Only the named recipient can view certified mail details',
      });
    }

    await logMailEvent(req.user.id, 'certified_mail_delivered', mailId);

    res.json({ mail });
  } catch (err) { next(err); }
});

// POST /certified/acknowledge — acknowledge certified mail
router.post('/certified/acknowledge', validate(acknowledgeSchema), async (req, res, next) => {
  try {
    const { mailId } = req.body;
    const { data: mail } = await supabaseAdmin
      .from('Mail')
      .select('*')
      .eq('id', mailId)
      .eq('certified', true)
      .single();

    if (!mail) return res.status(404).json({ error: 'Certified mail not found' });
    if (mail.recipient_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the named recipient can acknowledge' });
    }
    if (mail.acknowledged_at) {
      return res.status(400).json({ error: 'Already acknowledged' });
    }

    const now = new Date().toISOString();
    const auditTrail = Array.isArray(mail.audit_trail) ? mail.audit_trail : [];
    auditTrail.push(
      { event: 'opened', timestamp: now, actor_id: req.user.id },
      { event: 'acknowledged', timestamp: now, actor_id: req.user.id },
    );

    await supabaseAdmin
      .from('Mail')
      .update({
        acknowledged_at: now,
        acknowledged_by: req.user.id,
        audit_trail: auditTrail,
        lifecycle: 'opened',
        opened_at: now,
      })
      .eq('id', mailId);

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
    const { data: mail } = await supabaseAdmin
      .from('Mail')
      .select('*')
      .eq('id', mailId)
      .eq('certified', true)
      .single();

    if (!mail) return res.status(404).json({ error: 'Certified mail not found' });
    if (mail.recipient_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the named recipient can reject' });
    }

    const now = new Date().toISOString();
    const auditTrail = Array.isArray(mail.audit_trail) ? mail.audit_trail : [];
    auditTrail.push({ event: 'rejected', timestamp: now, actor_id: req.user.id });

    await supabaseAdmin
      .from('Mail')
      .update({ audit_trail: auditTrail })
      .eq('id', mailId);

    await logMailEvent(req.user.id, 'certified_mail_rejected', mailId);

    res.json({ message: 'Certified mail rejected', auditTrail });
  } catch (err) { next(err); }
});

// GET /certified/:mailId/proof — download legal proof PDF
router.get('/certified/:mailId/proof', async (req, res, next) => {
  try {
    const { mailId } = req.params;
    const { data: mail } = await supabaseAdmin
      .from('Mail')
      .select('*')
      .eq('id', mailId)
      .eq('certified', true)
      .single();

    if (!mail) return res.status(404).json({ error: 'Certified mail not found' });
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
        deliveredAt: mail.created_at,
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

    if (!mail) return res.status(404).json({ error: 'Mail not found' });
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

    const homeIds = await getAccessibleHomeIds(req.user.id);
    if (homeIds.length === 0) {
      return res.status(400).json({ error: 'No home found' });
    }

    const homeId = homeIds[0]; // Primary home

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

    if (!session) return res.status(404).json({ error: 'Session not found or expired' });

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

    // Move to assigned user's Counter
    await supabaseAdmin
      .from('Mail')
      .update({
        recipient_user_id: assignToUserId,
        lifecycle: 'delivered',
        drawer: 'personal',
      })
      .eq('id', mailId);

    // Complete session
    const { data: participants } = await supabaseAdmin
      .from('MailPartyParticipant')
      .select('user_id')
      .eq('session_id', sessionId);

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
      .select('*, Mail!inner(id, sender_display, subject, sender_trust)')
      .in('home_id', homeIds)
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: false });

    // Filter expired
    const active = (sessions || []).filter(s => {
      if (s.status === 'active') return true;
      const elapsed = Date.now() - new Date(s.created_at).getTime();
      return elapsed <= 90000;
    });

    res.json({ sessions: active });
  } catch (err) { next(err); }
});

// ── VAULT ─────────────────────────────────────────────────

// GET /vault/folders — get vault folders by drawer
router.get('/vault/folders', async (req, res, next) => {
  try {
    const { drawer } = req.query;
    const homeIds = await getAccessibleHomeIds(req.user.id);

    // Ensure system folders exist
    await ensureSystemFolders(req.user.id, homeIds);

    let query = supabaseAdmin
      .from('VaultFolder')
      .select('*')
      .eq('user_id', req.user.id)
      .order('system', { ascending: false })
      .order('sort_order', { ascending: true });

    if (drawer) query = query.eq('drawer', drawer);

    const { data: folders } = await query;

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

    const { data: folder } = await supabaseAdmin
      .from('VaultFolder')
      .insert({
        user_id: req.user.id,
        drawer,
        label,
        icon: icon || '📂',
        color: color || '#374151',
        system: false,
        auto_file_rules: autoFileRules || [],
      })
      .select()
      .single();

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

    const { data: folder } = await supabaseAdmin
      .from('VaultFolder')
      .update(updates)
      .eq('id', folderId)
      .eq('user_id', req.user.id)
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

    const { data: items, count } = await supabaseAdmin
      .from('Mail')
      .select('*', { count: 'exact' })
      .eq('vault_folder_id', folderId)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    await logMailEvent(req.user.id, 'vault_folder_opened', null, {
      folder_id: folderId,
    });

    res.json({ items: items || [], total: count || 0 });
  } catch (err) { next(err); }
});

// POST /vault/file — file an item to a vault folder
router.post('/vault/file', validate(fileToVaultSchema), async (req, res, next) => {
  try {
    const { mailId, folderId } = req.body;

    await supabaseAdmin
      .from('Mail')
      .update({
        vault_folder_id: folderId,
        lifecycle: 'filed',
      })
      .eq('id', mailId);

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

// POST /vault/auto-file — run auto-filing rules on delivered items
router.post('/vault/auto-file', async (req, res, next) => {
  try {
    const { data: folders } = await supabaseAdmin
      .from('VaultFolder')
      .select('*')
      .eq('user_id', req.user.id);

    // Get unfiled delivered items
    const { data: items } = await supabaseAdmin
      .from('Mail')
      .select('*')
      .eq('recipient_user_id', req.user.id)
      .is('vault_folder_id', null)
      .in('lifecycle', ['delivered', 'opened'])
      .order('created_at', { ascending: false })
      .limit(100);

    // First pass: compute all matches in memory (no DB ops)
    const matches = []; // { itemId, folderId }
    const folderCountInc = {}; // folderId -> increment
    for (const item of (items || [])) {
      for (const folder of (folders || [])) {
        if (folder.drawer !== item.drawer) continue;
        const rules = Array.isArray(folder.auto_file_rules) ? folder.auto_file_rules : [];
        if (rules.some(rule => evaluateAutoFileRule(rule, item))) {
          matches.push({ itemId: item.id, folderId: folder.id });
          folderCountInc[folder.id] = (folderCountInc[folder.id] || (folder.item_count || 0)) + 1;
          break;
        }
      }
    }

    // Batch execute all updates in parallel
    if (matches.length > 0) {
      await Promise.all([
        // Update all matched mail items
        ...matches.map(m =>
          supabaseAdmin.from('Mail').update({ vault_folder_id: m.folderId, lifecycle: 'filed' }).eq('id', m.itemId)
        ),
        // Update folder item_counts
        ...Object.entries(folderCountInc).map(([fId, count]) =>
          supabaseAdmin.from('VaultFolder').update({ item_count: count }).eq('id', fId)
        ),
        // Log events
        ...matches.map(m =>
          logMailEvent(req.user.id, 'vault_auto_filed', m.itemId, { folder_id: m.folderId })
        ),
      ]);
    }
    const filed = matches.length;

    res.json({ message: `Auto-filed ${filed} items`, filed });
  } catch (err) { next(err); }
});

// GET /vault/search — semantic search across mail
router.get('/vault/search', async (req, res, next) => {
  try {
    const { q, drawer, folderId, limit = 20, offset = 0 } = req.query;

    if (!q || q.length < 1) {
      return res.status(400).json({ error: 'Query required' });
    }

    await logMailEvent(req.user.id, 'vault_search_performed', null, {
      query: q, drawer_scope: drawer || 'all',
    });

    // Build search
    let query = supabaseAdmin
      .from('Mail')
      .select('*', { count: 'exact' })
      .eq('recipient_user_id', req.user.id);

    if (drawer) query = query.eq('drawer', drawer);
    if (folderId) query = query.eq('vault_folder_id', folderId);

    // Amount search: "$87" or "$87.00"
    const amountMatch = q.match(/^\$(\d+(?:\.\d{1,2})?)$/);
    if (amountMatch) {
      const amount = amountMatch[1];
      // Search in key_facts jsonb for the amount value
      query = query.or(`key_facts.cs.{"value":"${amount}"},key_facts.cs.{"value":"$${amount}"},subject.ilike.%${amount}%,content.ilike.%${amount}%`);
    }
    // Date search: "March 2025" or "Mar 2025"
    else if (/^[a-z]+ \d{4}$/i.test(q)) {
      const [month, year] = q.split(' ');
      const monthNum = new Date(`${month} 1, ${year}`).getMonth();
      const startDate = new Date(parseInt(year), monthNum, 1).toISOString();
      const endDate = new Date(parseInt(year), monthNum + 1, 0).toISOString();
      query = query.gte('created_at', startDate).lte('created_at', endDate);
    }
    // General text search
    else {
      query = query.or(`subject.ilike.%${q}%,content.ilike.%${q}%,sender_display.ilike.%${q}%`);
    }

    query = query.order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data: results, count } = await query;

    // Add highlight info
    const enhanced = (results || []).map(item => {
      let matchedField = '';
      let matchExcerpt = '';
      const lq = q.toLowerCase();
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
      return { ...item, _matchField: matchedField, _matchExcerpt: matchExcerpt };
    });

    res.json({ results: enhanced, total: count || 0, query: q });
  } catch (err) { next(err); }
});

// ── PACKAGE PHASE 2 ───────────────────────────────────────

// POST /package/:mailId/unboxing — virtual unboxing actions
router.post('/package/:mailId/unboxing', validate(packageUnboxingSchema), async (req, res, next) => {
  try {
    const { mailId } = req.params;
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

// POST /package/:mailId/gig — create a gig from package
router.post('/package/:mailId/gig', validate(packageGigSchema), async (req, res, next) => {
  try {
    const { mailId } = req.params;
    const { gigType, title, description, suggestedStart, compensation } = req.body;

    const { data: pkg } = await supabaseAdmin
      .from('MailPackage')
      .select('*, Mail!inner(sender_display, recipient_address_id)')
      .eq('mail_id', mailId)
      .single();

    if (!pkg) return res.status(404).json({ error: 'Package not found' });

    const isPreDelivery = pkg.status !== 'delivered';
    const gigTitle = title || (isPreDelivery
      ? `${gigType === 'hold' ? 'Hold' : gigType === 'inside' ? 'Bring inside' : gigType === 'sign' ? 'Sign for' : 'Help with'} my package`
      : `Help assembling ${pkg.inferred_item_name || 'package item'}`);

    // Placeholder: in production this creates an actual Gig record
    const gigId = require('crypto').randomUUID();

    await supabaseAdmin
      .from('MailPackage')
      .update({
        gig_id: gigId,
        gig_type: isPreDelivery ? `pre_${gigType}` : `post_${gigType}`,
      })
      .eq('mail_id', mailId);

    const eventType = isPreDelivery
      ? 'package_gig_pre_delivery_created'
      : 'package_gig_post_delivery_created';

    await logMailEvent(req.user.id, eventType, mailId, {
      gig_id: gigId, gig_type: gigType,
    });

    res.json({
      message: 'Gig created',
      gigId,
      title: gigTitle,
      preDelivery: isPreDelivery,
    });
  } catch (err) { next(err); }
});

// POST /package/:mailId/gig-accepted — mark gig as accepted by neighbor
router.post('/package/:mailId/gig-accepted', async (req, res, next) => {
  try {
    const { mailId } = req.params;
    const { neighborId, neighborName } = req.body;

    await supabaseAdmin
      .from('MailPackage')
      .update({
        gig_accepted_by: neighborId,
        gig_accepted_at: new Date().toISOString(),
        neighbor_helper_name: neighborName,
      })
      .eq('mail_id', mailId);

    await logMailEvent(req.user.id, 'package_gig_accepted', mailId, {
      neighbor_id: neighborId,
    });

    res.json({ message: `${neighborName || 'Neighbor'} accepted the gig` });
  } catch (err) { next(err); }
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

// POST /coupon/order — place an order with coupon
router.post('/coupon/order', validate(couponOrderSchema), async (req, res, next) => {
  try {
    const { offerId, items } = req.body;

    const { data: offer } = await supabaseAdmin
      .from('EarnOffer')
      .select('*')
      .eq('id', offerId)
      .single();

    if (!offer) return res.status(404).json({ error: 'Offer not found' });

    const subtotal = items.reduce((s, i) => s + i.price * (i.quantity || 1), 0);
    let discount = 0;
    if (offer.discount_type === 'percentage' && offer.discount_value) {
      discount = +(subtotal * offer.discount_value / 100).toFixed(2);
    } else if (offer.discount_type === 'fixed' && offer.discount_value) {
      discount = Math.min(offer.discount_value, subtotal);
    }
    const total = +(subtotal - discount).toFixed(2);

    const orderId = require('crypto').randomUUID();

    // Create redemption record
    const { data: redemption } = await supabaseAdmin
      .from('OfferRedemption')
      .insert({
        offer_id: offerId,
        user_id: req.user.id,
        merchant_id: offer.merchant_id,
        redemption_type: 'in_app_order',
        order_id: orderId,
        order_total: total,
        discount_applied: discount,
        status: 'redeemed',
        redeemed_at: new Date().toISOString(),
      })
      .select()
      .single();

    // Release earn payout immediately for converted offers
    await supabaseAdmin
      .from('EarnTransaction')
      .update({
        status: 'available',
        verified_at: new Date().toISOString(),
      })
      .eq('user_id', req.user.id)
      .eq('offer_id', offerId);

    // Auto-create receipt in personal drawer
    const { data: receipt } = await supabaseAdmin
      .from('Mail')
      .insert({
        recipient_user_id: req.user.id,
        drawer: 'personal',
        mail_object_type: 'envelope',
        type: 'receipt',
        category: 'receipt',
        sender_display: offer.business_name,
        sender_trust: 'verified_business',
        subject: `Order receipt from ${offer.business_name}`,
        content: `Order #${orderId.slice(0, 8)} · Total: $${total} · Saved: $${discount}`,
        preview_text: `$${total} order · Saved $${discount} with mailbox coupon`,
        lifecycle: 'delivered',
        urgency: 'none',
        key_facts: JSON.stringify([
          { field: 'Amount', value: `$${total}`, confidence: 1 },
          { field: 'Discount', value: `$${discount}`, confidence: 1 },
          { field: 'Order ID', value: orderId.slice(0, 8), confidence: 1 },
        ]),
      })
      .select()
      .single();

    // Auto-file receipt to Receipts folder
    if (receipt) {
      const { data: receiptFolder } = await supabaseAdmin
        .from('VaultFolder')
        .select('id')
        .eq('user_id', req.user.id)
        .eq('label', 'Receipts')
        .eq('drawer', 'personal')
        .single();

      if (receiptFolder) {
        await supabaseAdmin
          .from('Mail')
          .update({ vault_folder_id: receiptFolder.id, lifecycle: 'filed' })
          .eq('id', receipt.id);
      }
    }

    await logMailEvent(req.user.id, 'coupon_order_placed', null, {
      offer_id: offerId, order_id: orderId, total, discount_applied: discount,
    });

    res.json({
      orderId,
      subtotal,
      discount,
      total,
      receiptMailId: receipt?.id,
      earnPayoutReleased: true,
    });
  } catch (err) { next(err); }
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
