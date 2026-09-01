/**
 * My Mail Day — physical-mail triage routes (P3F / A13.16).
 *
 * Rebuilds the triage backend the screen renders (the prior one was removed
 * from the repo). The shape is defined directly from the MailDayViewModel /
 * MailDayContent render models so the clients decode it straight:
 *
 *   GET  /today                  → the full day frame (date, streak, last
 *                                  scan, unreviewed[], reviewed[], yesterday
 *                                  recap, setup nudges).
 *   POST /items                  → ingest a scanned piece (scanner hook;
 *                                  also used by tests/integration).
 *   POST /items/:itemId/route    → route to a recipient (→ reviewed/routed).
 *   POST /items/:itemId/junk     → junk a piece (→ reviewed/junked).
 *   POST /items/:itemId/return   → return to sender (→ reviewed/returned).
 *   POST /items/:itemId/undo     → move a reviewed piece back to unreviewed.
 *   POST /finish                 → close the day, bump the streak, snapshot
 *                                  the recap.
 *   POST /seed                   → dev-only fixtures.
 *
 * Reuses the digital-mail routing primitives where applicable: GET /today
 * best-effort backfills today's queue from the unresolved `MailRoutingQueue`
 * (the same source the old stop-gap read via /pending), and a routed/junked
 * decision on a linked piece clears that queue row + routes the `Mail`.
 *
 * Mounted at /api/mailbox/v2/mailday.
 */

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const logger = require('../utils/logger');

const UNDO_SECONDS = 5;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ============ HELPERS (mirrors of the mailboxV2 primitives) ============

async function getAccessibleHomeIds(userId) {
  const { data } = await supabaseAdmin
    .from('HomeOccupancy')
    .select('home_id')
    .eq('user_id', userId)
    .eq('is_active', true);
  return (data || []).map((r) => r.home_id);
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

function todayDate() {
  return new Date().toISOString().slice(0, 10); // UTC YYYY-MM-DD
}

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function dayLabel(date) {
  return `${DAY_NAMES[date.getUTCDay()]} · ${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

function relativeLabel(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 60000) return 'just now';
  const min = Math.floor(diffMs / 60000);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

function clockLabel(iso) {
  const d = new Date(iso);
  let h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h %= 12;
  if (h === 0) h = 12;
  return `closed ${h}:${m} ${ampm}`;
}

function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || '';
}

function tintForAvatar(avatar) {
  return avatar === 'household_green' ? 'household_home' : 'person_primary';
}

// Mirror of the Android `kindFor` mapping (mail object type / category →
// the faux-photo MailDayKind the screen renders).
function kindFor(objectType, category) {
  if (category && String(category).toLowerCase().includes('bill')) return 'bill';
  switch (objectType) {
    case 'package': return 'package';
    case 'postcard': return 'postcard';
    case 'booklet': return 'magazine';
    case 'bundle': return 'flyer';
    default: return 'envelope';
  }
}

// ============ SERIALIZERS (snake_case mirror of MailDayContent) ============

function serializeUnreviewed(row) {
  return {
    id: row.id,
    kind: row.kind,
    label: row.label,
    sender: row.sender || '',
    suggested_name: row.suggested_name || '',
    suggested_avatar: row.suggested_avatar || 'personal_sky',
    confidence_percent: row.confidence_percent || 0,
    secondary_label: row.secondary_label || 'Other',
  };
}

function serializeReviewed(row, isLatest) {
  const inWindow =
    isLatest &&
    row.reviewed_at &&
    Date.now() - new Date(row.reviewed_at).getTime() < UNDO_SECONDS * 1000;
  return {
    id: row.id,
    kind: row.kind,
    label: row.label,
    action: row.action,
    routed_to: row.routed_to || null,
    routed_tint: row.routed_tint || null,
    when_label: relativeLabel(row.reviewed_at),
    undo_countdown: inWindow ? UNDO_SECONDS : null,
  };
}

// ============ DAY-SESSION DERIVATIONS ============

/**
 * The streak shown before today is finished: today's session streak if it
 * exists, else yesterday's carried streak when yesterday was finished.
 */
async function currentStreak(userId, today) {
  const { data: todaySession } = await supabaseAdmin
    .from('MailDaySession')
    .select('streak_days, finished_at')
    .eq('user_id', userId)
    .eq('day_date', today)
    .maybeSingle();
  if (todaySession) return todaySession.streak_days || 0;

  const { data: ySession } = await supabaseAdmin
    .from('MailDaySession')
    .select('streak_days, finished_at')
    .eq('user_id', userId)
    .eq('day_date', addDays(today, -1))
    .maybeSingle();
  if (ySession && ySession.finished_at) return ySession.streak_days || 0;
  return 0;
}

/** Yesterday's recap card — only when yesterday's session was finished. */
async function yesterdayRecap(userId, today) {
  const yDate = addDays(today, -1);
  const { data: session } = await supabaseAdmin
    .from('MailDaySession')
    .select('*')
    .eq('user_id', userId)
    .eq('day_date', yDate)
    .maybeSingle();
  if (!session || !session.finished_at) return null;

  const { data: items } = await supabaseAdmin
    .from('MailDayItem')
    .select('*')
    .eq('user_id', userId)
    .eq('day_date', yDate)
    .eq('status', 'reviewed');
  const rows = items || [];
  const pieces = session.pieces || rows.length;

  const segments = [];
  const byRecipient = {};
  for (const r of rows.filter((x) => x.action === 'routed')) {
    const name = r.routed_to || 'Routed';
    if (!byRecipient[name]) {
      byRecipient[name] = { count: 0, tint: r.routed_tint === 'household_home' ? 'household' : 'person_primary' };
    }
    byRecipient[name].count += 1;
  }
  for (const [name, info] of Object.entries(byRecipient)) {
    segments.push({
      id: `rcp-${name}`,
      percent: pieces ? info.count / pieces : 0,
      label: `${info.count} to ${name}`,
      tint: info.tint,
    });
  }
  const junked = rows.filter((x) => x.action === 'junked').length;
  if (junked > 0) {
    segments.push({ id: 'junked', percent: pieces ? junked / pieces : 0, label: `${junked} junked`, tint: 'junked' });
  }
  const returned = rows.filter((x) => x.action === 'returned').length;
  if (returned > 0) {
    segments.push({ id: 'returned', percent: pieces ? returned / pieces : 0, label: `${returned} returned`, tint: 'returned' });
  }

  return {
    date_label: dayLabel(new Date(`${yDate}T00:00:00Z`)),
    pieces,
    closed_at_label: clockLabel(session.finished_at),
    segments,
  };
}

/**
 * Empty-state setup nudges. The copy + dynamic auto-route count come from
 * the server; the icon/tint are owned by the client's design (mapped from
 * the stable `id`), so this stays UI-agnostic.
 */
async function setupNudges(userId) {
  let aliasCount = 0;
  const homeIds = await getAccessibleHomeIds(userId);
  if (homeIds.length > 0) {
    const { count } = await supabaseAdmin
      .from('MailAlias')
      .select('*', { count: 'exact', head: true })
      .in('home_id', homeIds);
    aliasCount = count || 0;
  }
  return [
    {
      id: 'daily-reminder',
      title: 'Daily reminder · 5:00 PM',
      subtitle: 'Ping me to scan before the day closes.',
    },
    {
      id: 'auto-route',
      title: 'Auto-route rules',
      subtitle: aliasCount > 0 ? `${aliasCount} active` : 'Set up auto-routing',
    },
  ];
}

/**
 * Best-effort: if today has no triage items yet, pull the user's unresolved
 * digital routing queue into today's triage (reuse of the /pending source).
 * Idempotent — only runs when today is empty. Never throws.
 */
async function ensureTodayItems(userId, today) {
  try {
    const { data: existing } = await supabaseAdmin
      .from('MailDayItem')
      .select('id')
      .eq('user_id', userId)
      .eq('day_date', today);
    if (existing && existing.length > 0) return;

    const homeIds = await getAccessibleHomeIds(userId);
    if (homeIds.length === 0) return;

    const { data: queue } = await supabaseAdmin
      .from('MailRoutingQueue')
      .select('*, Mail!inner(*)')
      .in('home_id', homeIds)
      .eq('resolved', false);
    const rows = queue || [];
    if (rows.length === 0) return;

    const nowIso = new Date().toISOString();
    const inserts = rows.map((q) => {
      const mail = q.Mail || {};
      return {
        user_id: userId,
        home_id: q.home_id || null,
        mail_id: q.mail_id,
        kind: kindFor(mail.mail_object_type, mail.category),
        label: (mail.subject && String(mail.subject).trim()) || 'Mail',
        sender: mail.sender_display || mail.sender_business_name || null,
        suggested_name: q.recipient_name_raw || mail.recipient_name || '',
        suggested_avatar: 'personal_sky',
        confidence_percent: Math.round(Math.min(1, Math.max(0, q.best_match_confidence || 0)) * 100),
        secondary_label: 'Other',
        status: 'unreviewed',
        action: null,
        day_date: today,
        scanned_at: mail.created_at || nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      };
    });
    await supabaseAdmin.from('MailDayItem').insert(inserts);
  } catch (err) {
    logger.warn('Mail day backfill failed (non-fatal)', { error: err.message });
  }
}

/**
 * When a triaged piece is linked to a digital `Mail`, reuse the resolve
 * primitive: route the Mail + clear its `MailRoutingQueue` row so it doesn't
 * re-backfill. Best-effort; never throws.
 */
async function resolveLinkedMail(item, action, drawer, userId) {
  if (!item.mail_id) return;
  try {
    const nowIso = new Date().toISOString();
    if (action === 'routed') {
      const privacyMap = { personal: 'private_to_person', home: 'shared_household', business: 'business_team' };
      const d = ['personal', 'home', 'business'].includes(drawer) ? drawer : 'personal';
      const update = {
        drawer: d,
        privacy: privacyMap[d] || 'private_to_person',
        routing_confidence: 1.0,
        routing_method: 'mailday_resolved',
      };
      if (d === 'personal') update.recipient_user_id = userId;
      await supabaseAdmin.from('Mail').update(update).eq('id', item.mail_id);
    } else if (action === 'junked') {
      await supabaseAdmin.from('Mail').update({ lifecycle: 'shredded' }).eq('id', item.mail_id);
    }
    await supabaseAdmin
      .from('MailRoutingQueue')
      .update({
        resolved: true,
        resolved_drawer: action === 'routed' ? drawer : null,
        resolved_by: userId,
        resolved_at: nowIso,
      })
      .eq('mail_id', item.mail_id);
  } catch (err) {
    logger.warn('resolveLinkedMail failed (non-fatal)', { error: err.message });
  }
}

async function loadOwnedItem(itemId, userId) {
  const { data: item } = await supabaseAdmin
    .from('MailDayItem')
    .select('*')
    .eq('id', itemId)
    .eq('user_id', userId)
    .maybeSingle();
  return item || null;
}

// ============ VALIDATION ============

const createItemSchema = Joi.object({
  kind: Joi.string().valid('envelope', 'magazine', 'postcard', 'bill', 'package', 'flyer').default('envelope'),
  label: Joi.string().max(200).allow('').default(''),
  sender: Joi.string().max(200).allow('', null),
  suggested_name: Joi.string().max(200).allow('', null),
  suggested_avatar: Joi.string().valid('personal_sky', 'household_green').default('personal_sky'),
  confidence_percent: Joi.number().integer().min(0).max(100).default(0),
  secondary_label: Joi.string().max(100).allow('', null),
  home_id: Joi.string().uuid().allow(null),
  mail_id: Joi.string().uuid().allow(null),
});

// ============ ROUTES ============

// GET /today — the full day frame.
router.get('/today', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = todayDate();

    await ensureTodayItems(userId, today);

    const { data: items } = await supabaseAdmin
      .from('MailDayItem')
      .select('*')
      .eq('user_id', userId)
      .eq('day_date', today);
    const all = items || [];

    const unreviewed = all
      .filter((i) => i.status === 'unreviewed')
      .sort((a, b) => String(b.scanned_at || '').localeCompare(String(a.scanned_at || '')))
      .map(serializeUnreviewed);

    const reviewed = all
      .filter((i) => i.status === 'reviewed')
      .sort((a, b) => String(b.reviewed_at || '').localeCompare(String(a.reviewed_at || '')))
      .map((row, idx) => serializeReviewed(row, idx === 0));

    const scanDates = all.map((i) => i.scanned_at).filter(Boolean).sort();
    const lastScan = scanDates.length ? scanDates[scanDates.length - 1] : null;

    return res.json({
      date_label: dayLabel(new Date()),
      streak_days: await currentStreak(userId, today),
      last_scan_label: relativeLabel(lastScan),
      unreviewed,
      reviewed,
      yesterday_recap: await yesterdayRecap(userId, today),
      setup_nudges: await setupNudges(userId),
    });
  } catch (err) {
    logger.error('Mail day today error', { error: err.message });
    return res.status(500).json({ error: 'Failed to load mail day' });
  }
});

// POST /items — ingest a scanned piece into today's triage queue.
router.post('/items', verifyToken, validate(createItemSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const today = todayDate();
    const b = req.body;

    if (b.home_id) {
      const homeIds = await getAccessibleHomeIds(userId);
      if (!homeIds.includes(b.home_id)) {
        return res.status(403).json({ error: 'Not a member of that home' });
      }
    }

    const nowIso = new Date().toISOString();
    const { data: item, error } = await supabaseAdmin
      .from('MailDayItem')
      .insert({
        user_id: userId,
        home_id: b.home_id || null,
        mail_id: b.mail_id || null,
        kind: b.kind,
        label: b.label || '',
        sender: b.sender || null,
        suggested_name: b.suggested_name || '',
        suggested_avatar: b.suggested_avatar,
        confidence_percent: b.confidence_percent,
        secondary_label: b.secondary_label || 'Other',
        status: 'unreviewed',
        action: null,
        day_date: today,
        scanned_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select()
      .single();

    if (error) {
      logger.error('Mail day ingest error', { error: error.message });
      return res.status(500).json({ error: 'Failed to add mail item' });
    }
    return res.status(201).json({ item: serializeUnreviewed(item) });
  } catch (err) {
    logger.error('Mail day ingest error', { error: err.message });
    return res.status(500).json({ error: 'Failed to add mail item' });
  }
});

function buildDecision(item, action, body) {
  const nowIso = new Date().toISOString();
  const decision = { status: 'reviewed', action, reviewed_at: nowIso, updated_at: nowIso };
  if (action === 'routed') {
    decision.routed_tint = ['person_primary', 'household_home'].includes(body.tint)
      ? body.tint
      : tintForAvatar(item.suggested_avatar);
    const recipient =
      typeof body.recipient === 'string' && body.recipient.trim()
        ? body.recipient.trim()
        : firstName(item.suggested_name);
    decision.routed_to = recipient || null;
  } else {
    decision.routed_tint = null;
    decision.routed_to = null;
  }
  return decision;
}

async function applyDecision(req, res, action) {
  try {
    const userId = req.user.id;
    const item = await loadOwnedItem(req.params.itemId, userId);
    if (!item) return res.status(404).json({ error: 'Mail item not found' });

    const body = req.body || {};
    const decision = buildDecision(item, action, body);

    const { data: updated, error } = await supabaseAdmin
      .from('MailDayItem')
      .update(decision)
      .eq('id', item.id)
      .select()
      .single();

    if (error) {
      logger.error('Mail day decision error', { error: error.message, action });
      return res.status(500).json({ error: 'Failed to record decision' });
    }

    const drawer = ['personal', 'home', 'business'].includes(body.drawer)
      ? body.drawer
      : decision.routed_tint === 'household_home' ? 'home' : 'personal';
    await resolveLinkedMail(item, action, drawer, userId);
    await logMailEvent(`mailday_${action}`, item.mail_id || null, userId, { item_id: item.id });

    return res.json({ item: serializeReviewed(updated, true) });
  } catch (err) {
    logger.error('Mail day decision error', { error: err.message, action });
    return res.status(500).json({ error: 'Failed to record decision' });
  }
}

router.post('/items/:itemId/route', verifyToken, (req, res) => applyDecision(req, res, 'routed'));
router.post('/items/:itemId/junk', verifyToken, (req, res) => applyDecision(req, res, 'junked'));
router.post('/items/:itemId/return', verifyToken, (req, res) => applyDecision(req, res, 'returned'));

// POST /items/:itemId/undo — back to unreviewed.
router.post('/items/:itemId/undo', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const item = await loadOwnedItem(req.params.itemId, userId);
    if (!item) return res.status(404).json({ error: 'Mail item not found' });

    const { data: updated, error } = await supabaseAdmin
      .from('MailDayItem')
      .update({
        status: 'unreviewed',
        action: null,
        routed_to: null,
        routed_tint: null,
        reviewed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id)
      .select()
      .single();

    if (error) {
      logger.error('Mail day undo error', { error: error.message });
      return res.status(500).json({ error: 'Failed to undo' });
    }
    return res.json({ item: serializeUnreviewed(updated) });
  } catch (err) {
    logger.error('Mail day undo error', { error: err.message });
    return res.status(500).json({ error: 'Failed to undo' });
  }
});

// POST /finish — close the day, bump the streak, snapshot the recap.
router.post('/finish', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = todayDate();

    const { data: items } = await supabaseAdmin
      .from('MailDayItem')
      .select('*')
      .eq('user_id', userId)
      .eq('day_date', today);
    const all = items || [];
    const remaining = all.filter((i) => i.status === 'unreviewed').length;
    const reviewed = all.filter((i) => i.status === 'reviewed');

    if (all.length === 0 || remaining > 0) {
      return res.status(400).json({ error: 'Day not ready to finish', remaining });
    }

    const routedCount = reviewed.filter((i) => i.action === 'routed').length;
    const junkedCount = reviewed.filter((i) => i.action === 'junked').length;
    const returnedCount = reviewed.filter((i) => i.action === 'returned').length;

    const { data: ySession } = await supabaseAdmin
      .from('MailDaySession')
      .select('*')
      .eq('user_id', userId)
      .eq('day_date', addDays(today, -1))
      .maybeSingle();
    const streakDays = ySession && ySession.finished_at ? (ySession.streak_days || 0) + 1 : 1;

    const nowIso = new Date().toISOString();
    const { data: existing } = await supabaseAdmin
      .from('MailDaySession')
      .select('*')
      .eq('user_id', userId)
      .eq('day_date', today)
      .maybeSingle();

    const payload = {
      ...(existing || {}),
      user_id: userId,
      day_date: today,
      finished_at: nowIso,
      streak_days: streakDays,
      pieces: reviewed.length,
      routed_count: routedCount,
      junked_count: junkedCount,
      returned_count: returnedCount,
      updated_at: nowIso,
    };
    if (!existing) payload.created_at = nowIso;

    const { data: saved, error } = await supabaseAdmin
      .from('MailDaySession')
      .upsert(payload, { onConflict: 'user_id,day_date' })
      .select()
      .single();

    if (error) {
      logger.error('Mail day finish error', { error: error.message });
      return res.status(500).json({ error: 'Failed to finish day' });
    }

    await logMailEvent('mailday_finished', null, userId, {
      pieces: reviewed.length,
      routed: routedCount,
      junked: junkedCount,
      returned: returnedCount,
      streak: streakDays,
    });

    return res.json({
      streak_days: saved.streak_days,
      pieces: saved.pieces,
      routed_count: saved.routed_count,
      junked_count: saved.junked_count,
      returned_count: saved.returned_count,
      finished_at: saved.finished_at,
    });
  } catch (err) {
    logger.error('Mail day finish error', { error: err.message });
    return res.status(500).json({ error: 'Failed to finish day' });
  }
});

// POST /seed — dev-only fixtures so the screen renders live data locally.
router.post('/seed', verifyToken, async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Route not found' });
    }
    const userId = req.user.id;
    const today = todayDate();
    const homeIds = await getAccessibleHomeIds(userId);
    const homeId = homeIds[0] || null;
    const nowIso = new Date().toISOString();

    const samples = [
      { kind: 'bill', label: 'Con Edison bill', sender: 'Con Edison · NY', suggested_name: 'Maria Kovács', suggested_avatar: 'personal_sky', confidence_percent: 94, secondary_label: 'Other' },
      { kind: 'postcard', label: 'Postcard from Lisbon', sender: 'P. Almeida · Lisbon, PT', suggested_name: 'Marcus Khan', suggested_avatar: 'household_green', confidence_percent: 71, secondary_label: 'Route to…' },
    ];
    const inserts = samples.map((s) => ({
      user_id: userId,
      home_id: homeId,
      mail_id: null,
      kind: s.kind,
      label: s.label,
      sender: s.sender,
      suggested_name: s.suggested_name,
      suggested_avatar: s.suggested_avatar,
      confidence_percent: s.confidence_percent,
      secondary_label: s.secondary_label,
      status: 'unreviewed',
      action: null,
      day_date: today,
      scanned_at: nowIso,
      created_at: nowIso,
      updated_at: nowIso,
    }));
    await supabaseAdmin.from('MailDayItem').insert(inserts);
    return res.json({ seeded: inserts.length });
  } catch (err) {
    logger.error('Mail day seed error', { error: err.message });
    return res.status(500).json({ error: 'Failed to seed' });
  }
});

module.exports = router;
