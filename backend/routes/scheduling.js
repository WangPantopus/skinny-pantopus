// ============================================================
// Calendarly — host-authed scheduling APIs.
// Mounted at BOTH /api/scheduling (personal/business via owner_type) and
// /api/homes/:id/scheduling (home via :id; router uses mergeParams). Availability schedules are
// always personal (req.user) — the source of truth that home/business compose.
// ============================================================

const express = require('express');
const Joi = require('joi');

const router = express.Router({ mergeParams: true });
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const { asyncHandler } = require('../errorHandler');
const logger = require('../utils/logger');
const availabilityService = require('../services/scheduling/availabilityService');
const bookingService = require('../services/scheduling/bookingService');
const bookingMetrics = require('../services/scheduling/bookingMetricsService');
const schedulingNotifyPrefs = require('../services/scheduling/schedulingNotifyPrefs');
const packages = require('../services/scheduling/packageService');
const notificationService = require('../services/notificationService');
const emailService = require('../services/emailService');
const { resolveOwner, assertCanManageOwner, ownerColumns, normalizeEmail, generateToken } = require('../services/scheduling/schedulingShared');

router.use(verifyToken);

// ---------- owner context middleware ----------
function withOwner(level) {
  return asyncHandler(async (req, _res, next) => {
    const { ownerType, ownerId } = resolveOwner(req);
    await assertCanManageOwner(ownerType, ownerId, req.user.id, level);
    req.scheduling = { ownerType, ownerId, oc: ownerColumns(ownerType, ownerId) };
    next();
  });
}

// ---------- helpers ----------
async function ensureDefaultSchedule(userId) {
  const { data: existing } = await supabaseAdmin
    .from('AvailabilitySchedule')
    .select('id')
    .eq('user_id', userId)
    .eq('is_default', true)
    .maybeSingle();
  if (existing) return existing.id;
  const { data: sched } = await supabaseAdmin
    .from('AvailabilitySchedule')
    .insert({ user_id: userId, name: 'Working hours', timezone: 'America/New_York', is_default: true })
    .select('id')
    .single();
  await supabaseAdmin
    .from('AvailabilityRule')
    .insert([1, 2, 3, 4, 5].map((wd) => ({ schedule_id: sched.id, weekday: wd, start_time: '09:00:00', end_time: '17:00:00' })));
  return sched.id;
}

// Find an owner's booking page. (owner_type, owner_id) is indexed but NOT
// unique (see migration 159 — only lower(slug) is unique), so an owner can
// accidentally accumulate duplicate rows; order + limit(1) keeps a plain
// maybeSingle() from erroring on "multiple rows returned" and deterministically
// returns the oldest page.
async function findPage(ownerType, ownerId) {
  const { data, error } = await supabaseAdmin
    .from('BookingPage')
    .select('*')
    .eq('owner_type', ownerType)
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Get-or-create the booking page for an owner. Guarantees a non-null page or
// throws — every caller dereferences page.id, so a silent null here surfaces
// as an opaque "Cannot read properties of null" 500 (the original bug). The
// auto-create races with itself (the iOS client GETs then immediately PUTs the
// page): if the insert loses a slug-unique race we re-read the now-existing row
// instead of returning null, and any non-collision insert error is surfaced
// loudly rather than swallowed.
async function ensurePage({ ownerType, ownerId, oc }, userId) {
  const existing = await findPage(ownerType, ownerId);
  if (existing) return existing;

  const baseSlug = `${ownerType}-${String(ownerId).slice(0, 8)}`;
  const insertPage = (slug) => supabaseAdmin
    .from('BookingPage')
    .insert({ ...oc, slug, is_live: false, created_by: userId })
    .select('*')
    .single();

  const first = await insertPage(baseSlug);
  if (!first.error) return first.data;
  if (!uniqueViolation(first.error)) throw first.error; // transient/structural — don't mask it

  // Unique violation: either this owner's page was created concurrently
  // (re-read it) or the auto base slug collides with another owner's page
  // (retry once with a unique suffix).
  const raced = await findPage(ownerType, ownerId);
  if (raced) return raced;

  // Random (not time-based) suffix so two requests retrying in the same
  // millisecond don't regenerate the same slug — matches the slug-reset idiom.
  const retry = await insertPage(`${baseSlug}-${Math.random().toString(36).slice(2, 10)}`);
  if (!retry.error) return retry.data;
  if (!uniqueViolation(retry.error)) throw retry.error;

  const racedAgain = await findPage(ownerType, ownerId);
  if (racedAgain) return racedAgain;
  throw retry.error; // give up loudly rather than returning null
}

function uniqueViolation(error) {
  return error && (error.code === '23505' || /duplicate key|unique/i.test(error.message || ''));
}

// ============================================================
// BOOKING PAGE
// ============================================================

router.get('/booking-page', withOwner('view'), asyncHandler(async (req, res) => {
  const page = await ensurePage(req.scheduling, req.user.id);
  res.json({ page });
}));

const pageUpdateSchema = Joi.object({
  owner_type: Joi.string().valid('user', 'home', 'business'),
  owner_id: Joi.string(),
  title: Joi.string().allow('', null).max(200),
  tagline: Joi.string().allow('', null).max(300),
  avatar_url: Joi.string().allow('', null).max(1000),
  intro: Joi.string().allow('', null).max(2000),
  confirmation_message: Joi.string().allow('', null).max(2000),
  timezone: Joi.string().max(64),
  is_live: Joi.boolean(),
  is_paused: Joi.boolean(),
  reminder_minutes: Joi.array().items(Joi.number().integer().min(0).max(43200)).max(5),
  // Structured policies (preset + windows, saved by the mobile custom-policy editors) or a
  // plain text blurb. Column is jsonb since migration 166; plain strings are stored as JSON
  // strings, so both shapes round-trip unchanged.
  cancellation_policy: Joi.alternatives().try(
    Joi.string().allow('', null).max(1000),
    Joi.object().unknown(true)
  ),
  visibility: Joi.string().valid('listed', 'unlisted'),
  branding: Joi.object().unknown(true),
});

router.put('/booking-page', withOwner('edit'), validate(pageUpdateSchema), asyncHandler(async (req, res) => {
  const page = await ensurePage(req.scheduling, req.user.id);
  const patch = { ...req.body, updated_at: new Date().toISOString() };
  delete patch.owner_type;
  delete patch.owner_id;
  const { data, error } = await supabaseAdmin.from('BookingPage').update(patch).eq('id', page.id).select('*').single();
  if (error) throw error;
  res.json({ page: data });
}));

const slugSchema = Joi.object({
  owner_type: Joi.string().valid('user', 'home', 'business'),
  owner_id: Joi.string(),
  slug: Joi.string().trim().lowercase().pattern(/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/).required(),
});

router.put('/booking-page/slug', withOwner('edit'), validate(slugSchema), asyncHandler(async (req, res) => {
  const page = await ensurePage(req.scheduling, req.user.id);
  const { data, error } = await supabaseAdmin
    .from('BookingPage')
    .update({ slug: req.body.slug, updated_at: new Date().toISOString() })
    .eq('id', page.id)
    .select('*')
    .single();
  if (uniqueViolation(error)) return res.status(409).json({ error: 'SLUG_TAKEN', message: 'That link is already taken.' });
  if (error) throw error;
  res.json({ page: data });
}));

// Inline slug availability check (first-run wizard) — no side effects.
router.get('/booking-page/check-slug', withOwner('view'), asyncHandler(async (req, res) => {
  const slug = String(req.query.slug || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug)) {
    return res.status(400).json({ available: false, error: 'INVALID_SLUG', message: 'Use 3–50 letters, numbers, or hyphens.' });
  }
  const { ownerType, ownerId } = req.scheduling;
  const [{ data: existing }, { data: ownPages }] = await Promise.all([
    supabaseAdmin.from('BookingPage').select('id').ilike('slug', slug).maybeSingle(),
    // Same duplicate-tolerance as findPage: oldest row wins, and limit(1) keeps a stray
    // duplicate from erroring the whole check.
    supabaseAdmin.from('BookingPage').select('id').eq('owner_type', ownerType).eq('owner_id', ownerId)
      .order('created_at', { ascending: true }).limit(1),
  ]);
  const ownPage = (ownPages || [])[0] || null;
  // `!!` matters: with no own page this expression is `null`, and `res.json({available:null})`
  // reads as falsy on some clients and as "missing key" on others — the mobile apps then
  // showed "taken" for every slug a NEW user checked.
  const available = !existing || !!(ownPage && existing.id === ownPage.id);
  const suggestions = available ? [] : [`${slug}-1`, `${slug}-2`, `${slug}${Math.floor(Math.random() * 90 + 10)}`];
  res.json({ available, suggestions });
}));

// Danger zone — regenerate the public slug (invalidates the old link).
router.post('/booking-page/reset-slug', withOwner('edit'), asyncHandler(async (req, res) => {
  const page = await ensurePage(req.scheduling, req.user.id);
  let newSlug;
  let updated;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    newSlug = `${req.scheduling.ownerType}-${Math.random().toString(36).slice(2, 10)}`;
    const { data, error } = await supabaseAdmin
      .from('BookingPage')
      .update({ slug: newSlug, updated_at: new Date().toISOString() })
      .eq('id', page.id)
      .select('*')
      .single();
    if (!error) { updated = data; break; }
    if (!uniqueViolation(error)) throw error;
  }
  if (!updated) return res.status(500).json({ error: 'RESET_FAILED', message: 'Could not generate a new link.' });
  res.json({ page: updated });
}));

// Disable scheduling — take the public page offline (reversible via PUT is_live=true).
router.post('/booking-page/disable', withOwner('edit'), asyncHandler(async (req, res) => {
  const page = await ensurePage(req.scheduling, req.user.id);
  const { data, error } = await supabaseAdmin
    .from('BookingPage')
    .update({ is_live: false, updated_at: new Date().toISOString() })
    .eq('id', page.id)
    .select('*')
    .single();
  if (error) throw error;
  res.json({ page: data });
}));

// ============================================================
// EVENT TYPES
// ============================================================

router.get('/event-types', withOwner('view'), asyncHandler(async (req, res) => {
  const { ownerType, ownerId } = req.scheduling;
  const { data, error } = await supabaseAdmin
    .from('EventType')
    .select('*')
    .eq('owner_type', ownerType)
    .eq('owner_id', ownerId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  const eventTypes = data || [];
  // Hosts pill on list rows ("N hosts", design event-types-frames.jsx EventRow):
  // one aggregate fetch across the whole page so clients never need an N+1.
  if (eventTypes.length) {
    const { data: assigneeRows, error: assigneeError } = await supabaseAdmin
      .from('EventTypeAssignee')
      .select('event_type_id')
      .in('event_type_id', eventTypes.map((et) => et.id))
      .eq('is_active', true);
    if (assigneeError) throw assigneeError;
    const counts = {};
    for (const row of assigneeRows || []) {
      counts[row.event_type_id] = (counts[row.event_type_id] || 0) + 1;
    }
    for (const et of eventTypes) et.assignee_count = counts[et.id] || 0;
  }
  res.json({ eventTypes });
}));

const eventTypeSchema = Joi.object({
  owner_type: Joi.string().valid('user', 'home', 'business'),
  owner_id: Joi.string(),
  name: Joi.string().trim().min(1).max(200).required(),
  slug: Joi.string().trim().lowercase().pattern(/^[a-z0-9][a-z0-9-]{0,60}$/).required(),
  description: Joi.string().allow('', null).max(2000),
  color: Joi.string().allow('', null).max(20),
  durations: Joi.array().items(Joi.number().integer().min(5).max(1440)).min(1).default([30]),
  default_duration: Joi.number().integer().min(5).max(1440).default(30),
  location_mode: Joi.string().valid('video', 'phone', 'in_person', 'custom', 'ask').default('video'),
  location_detail: Joi.string().allow('', null).max(500),
  assignment_mode: Joi.string().valid('one_on_one', 'collective', 'round_robin', 'group').default('one_on_one'),
  requires_approval: Joi.boolean().default(false),
  visibility: Joi.string().valid('public', 'secret').default('public'),
  buffer_before_min: Joi.number().integer().min(0).max(720).default(0),
  buffer_after_min: Joi.number().integer().min(0).max(720).default(0),
  min_notice_min: Joi.number().integer().min(0).max(525600).default(0),
  max_horizon_days: Joi.number().integer().min(1).max(730).default(60),
  slot_interval_min: Joi.number().integer().min(5).max(240).default(15),
  daily_cap: Joi.number().integer().min(0).allow(null),
  per_booker_cap: Joi.number().integer().min(0).allow(null),
  seat_cap: Joi.number().integer().min(1).max(1000).default(1),
  price_cents: Joi.number().integer().min(0).default(0),
  currency: Joi.string().length(3).uppercase().default('USD'),
  deposit_cents: Joi.number().integer().min(0).default(0),
  deposit_refundable: Joi.boolean().default(true),
  cancellation_window_min: Joi.number().integer().min(0).default(0),
  reschedule_cutoff_min: Joi.number().integer().min(0).default(0),
  no_show_fee_cents: Joi.number().integer().min(0).default(0),
  refund_policy: Joi.string().valid('full', 'partial', 'none', 'deposit_only').default('full'),
  allow_invitee_cancel: Joi.boolean().default(true),
  allow_invitee_reschedule: Joi.boolean().default(true),
  schedule_id: Joi.string().uuid().allow(null),
  is_active: Joi.boolean().default(true),
  sort_order: Joi.number().integer().default(0),
});

router.post('/event-types', withOwner('edit'), validate(eventTypeSchema), asyncHandler(async (req, res) => {
  const { ownerType, oc } = req.scheduling;
  const page = await ensurePage(req.scheduling, req.user.id);
  const body = { ...req.body };
  delete body.owner_type;
  delete body.owner_id;

  // Ensure default_duration is one of durations.
  if (!body.durations.includes(body.default_duration)) body.durations.unshift(body.default_duration);

  // Personal event types attach to the owner's default schedule unless one is provided.
  if (ownerType === 'user' && !body.schedule_id) {
    body.schedule_id = await ensureDefaultSchedule(req.user.id);
  }

  const { data, error } = await supabaseAdmin
    .from('EventType')
    .insert({ ...oc, page_id: page.id, ...body })
    .select('*')
    .single();
  if (uniqueViolation(error)) return res.status(409).json({ error: 'SLUG_TAKEN', message: 'An event type with that link already exists.' });
  if (error) throw error;
  res.status(201).json({ eventType: data });
}));

async function loadOwnedEventType(req) {
  const { data } = await supabaseAdmin.from('EventType').select('*').eq('id', req.params.id).maybeSingle();
  if (!data) {
    const err = new Error('Event type not found.');
    err.statusCode = 404;
    throw err;
  }
  await assertCanManageOwner(data.owner_type, data.owner_id, req.user.id, 'view');
  return data;
}

// NB: these :id routes live under a distinct prefix to avoid clashing with /homes/:id mounts —
// they are matched relative to this router's mount point.
router.get('/event-types/:id', asyncHandler(async (req, res) => {
  const et = await loadOwnedEventType(req);
  const [{ data: assignees }, { data: questions }] = await Promise.all([
    supabaseAdmin.from('EventTypeAssignee').select('*').eq('event_type_id', et.id),
    supabaseAdmin.from('EventTypeQuestion').select('*').eq('event_type_id', et.id).order('sort_order'),
  ]);
  res.json({ eventType: et, assignees: assignees || [], questions: questions || [] });
}));

// Partial-update schema: every field optional, NO defaults (so omitted fields are left untouched).
const eventTypePatchSchema = Joi.object({
  owner_type: Joi.string().valid('user', 'home', 'business'),
  owner_id: Joi.string(),
  name: Joi.string().trim().min(1).max(200),
  slug: Joi.string().trim().lowercase().pattern(/^[a-z0-9][a-z0-9-]{0,60}$/),
  description: Joi.string().allow('', null).max(2000),
  color: Joi.string().allow('', null).max(20),
  durations: Joi.array().items(Joi.number().integer().min(5).max(1440)).min(1),
  default_duration: Joi.number().integer().min(5).max(1440),
  location_mode: Joi.string().valid('video', 'phone', 'in_person', 'custom', 'ask'),
  location_detail: Joi.string().allow('', null).max(500),
  assignment_mode: Joi.string().valid('one_on_one', 'collective', 'round_robin', 'group'),
  requires_approval: Joi.boolean(),
  visibility: Joi.string().valid('public', 'secret'),
  buffer_before_min: Joi.number().integer().min(0).max(720),
  buffer_after_min: Joi.number().integer().min(0).max(720),
  min_notice_min: Joi.number().integer().min(0).max(525600),
  max_horizon_days: Joi.number().integer().min(1).max(730),
  slot_interval_min: Joi.number().integer().min(5).max(240),
  daily_cap: Joi.number().integer().min(0).allow(null),
  per_booker_cap: Joi.number().integer().min(0).allow(null),
  seat_cap: Joi.number().integer().min(1).max(1000),
  price_cents: Joi.number().integer().min(0),
  currency: Joi.string().length(3).uppercase(),
  deposit_cents: Joi.number().integer().min(0),
  deposit_refundable: Joi.boolean(),
  cancellation_window_min: Joi.number().integer().min(0),
  reschedule_cutoff_min: Joi.number().integer().min(0),
  no_show_fee_cents: Joi.number().integer().min(0),
  refund_policy: Joi.string().valid('full', 'partial', 'none', 'deposit_only'),
  allow_invitee_cancel: Joi.boolean(),
  allow_invitee_reschedule: Joi.boolean(),
  schedule_id: Joi.string().uuid().allow(null),
  is_active: Joi.boolean(),
  sort_order: Joi.number().integer(),
}).min(1);

router.put('/event-types/:id', validate(eventTypePatchSchema), asyncHandler(async (req, res) => {
  const et = await loadOwnedEventType(req);
  await assertCanManageOwner(et.owner_type, et.owner_id, req.user.id, 'edit');
  const body = { ...req.body };
  delete body.owner_type;
  delete body.owner_id;
  if (body.durations && body.default_duration && !body.durations.includes(body.default_duration)) {
    body.durations.unshift(body.default_duration);
  }
  const { data, error } = await supabaseAdmin
    .from('EventType')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', et.id)
    .select('*')
    .single();
  if (uniqueViolation(error)) return res.status(409).json({ error: 'SLUG_TAKEN' });
  if (error) throw error;
  res.json({ eventType: data });
}));

router.delete('/event-types/:id', asyncHandler(async (req, res) => {
  const et = await loadOwnedEventType(req);
  await assertCanManageOwner(et.owner_type, et.owner_id, req.user.id, 'edit');
  // Refuse to hard-delete if ANY booking references this event type: Booking_event_type_id_fkey
  // is ON DELETE CASCADE, so deleting would silently destroy past/paid booking history. Deactivate
  // (is_active=false) instead to retire it while preserving the record.
  const { count } = await supabaseAdmin
    .from('Booking')
    .select('id', { count: 'exact', head: true })
    .eq('event_type_id', et.id);
  if ((count || 0) > 0) {
    return res.status(409).json({ error: 'HAS_BOOKINGS', message: 'This event type has booking history. Deactivate it instead of deleting.' });
  }
  await supabaseAdmin.from('EventType').delete().eq('id', et.id);
  res.json({ ok: true });
}));

const assigneesSchema = Joi.object({
  assignees: Joi.array()
    .items(Joi.object({
      subject_id: Joi.string().uuid().required(),
      subject_type: Joi.string().valid('user', 'business_team').default('user'),
      weight: Joi.number().integer().min(0).default(1),
      priority: Joi.number().integer().default(0),
      is_active: Joi.boolean().default(true),
    }))
    .required(),
});

// Returns the subset of subjectIds that are NOT legitimate assignees for this owner.
// (Prevents pulling a non-member's personal availability into an owner's slots — identity firewall —
// and round-robin assigning bookings to people outside the home/team.)
async function invalidAssignees(et, subjectIds) {
  const ids = [...new Set(subjectIds)];
  if (!ids.length) return [];
  if (et.owner_type === 'user') {
    return ids.filter((id) => id !== et.owner_id); // personal event types: only the owner
  }
  if (et.owner_type === 'home') {
    const { data } = await supabaseAdmin.from('HomeOccupancy').select('user_id').eq('home_id', et.owner_id).eq('is_active', true).in('user_id', ids);
    const ok = new Set((data || []).map((r) => r.user_id));
    return ids.filter((id) => !ok.has(id));
  }
  if (et.owner_type === 'business') {
    const { data } = await supabaseAdmin.from('BusinessTeam').select('user_id').eq('business_user_id', et.owner_id).eq('is_active', true).in('user_id', ids);
    const ok = new Set((data || []).map((r) => r.user_id));
    ok.add(et.owner_id); // the business owner may serve too
    return ids.filter((id) => !ok.has(id));
  }
  return ids;
}

router.put('/event-types/:id/assignees', validate(assigneesSchema), asyncHandler(async (req, res) => {
  const et = await loadOwnedEventType(req);
  await assertCanManageOwner(et.owner_type, et.owner_id, req.user.id, 'edit');
  // Every assignee must be a member of this owner (active home occupant / business team member / the owner).
  const invalid = await invalidAssignees(et, req.body.assignees.map((a) => a.subject_id));
  if (invalid.length) {
    return res.status(400).json({ error: 'INVALID_ASSIGNEE', message: 'Assignees must be members of this home or team.', invalid });
  }
  // Replace the assignee set.
  await supabaseAdmin.from('EventTypeAssignee').delete().eq('event_type_id', et.id);
  const rows = req.body.assignees.map((a) => ({ ...a, event_type_id: et.id }));
  const { data, error } = await supabaseAdmin.from('EventTypeAssignee').insert(rows).select('*');
  if (error) throw error;
  res.json({ assignees: data });
}));

const questionsSchema = Joi.object({
  questions: Joi.array()
    .items(Joi.object({
      label: Joi.string().trim().min(1).max(300).required(),
      field_type: Joi.string().valid('text', 'textarea', 'select', 'multiselect', 'checkbox', 'phone').default('text'),
      options: Joi.array().items(Joi.string()).default([]),
      required: Joi.boolean().default(false),
      sort_order: Joi.number().integer().default(0),
    }))
    .required(),
});

router.put('/event-types/:id/questions', validate(questionsSchema), asyncHandler(async (req, res) => {
  const et = await loadOwnedEventType(req);
  await assertCanManageOwner(et.owner_type, et.owner_id, req.user.id, 'edit');
  await supabaseAdmin.from('EventTypeQuestion').delete().eq('event_type_id', et.id);
  const rows = req.body.questions.map((q, i) => ({ ...q, options: q.options || [], event_type_id: et.id, sort_order: q.sort_order || i }));
  const { data, error } = await supabaseAdmin.from('EventTypeQuestion').insert(rows).select('*');
  if (error) throw error;
  res.json({ questions: data });
}));

// ============================================================
// AVAILABILITY (always personal — req.user)
// ============================================================

router.get('/availability', asyncHandler(async (req, res) => {
  await ensureDefaultSchedule(req.user.id);
  const { data: schedules } = await supabaseAdmin
    .from('AvailabilitySchedule')
    .select('*')
    .eq('user_id', req.user.id)
    .order('is_default', { ascending: false });
  const ids = (schedules || []).map((s) => s.id);
  let rules = [];
  let overrides = [];
  if (ids.length) {
    [{ data: rules }, { data: overrides }] = await Promise.all([
      supabaseAdmin.from('AvailabilityRule').select('*').in('schedule_id', ids),
      supabaseAdmin.from('AvailabilityOverride').select('*').in('schedule_id', ids),
    ]);
  }
  res.json({ schedules: schedules || [], rules: rules || [], overrides: overrides || [] });
}));

const scheduleSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).default('Working hours'),
  timezone: Joi.string().max(64).required(),
  is_default: Joi.boolean().default(false),
});

router.post('/availability', validate(scheduleSchema), asyncHandler(async (req, res) => {
  if (req.body.is_default) {
    await supabaseAdmin.from('AvailabilitySchedule').update({ is_default: false }).eq('user_id', req.user.id).eq('is_default', true);
  }
  const { data, error } = await supabaseAdmin
    .from('AvailabilitySchedule')
    .insert({ ...req.body, user_id: req.user.id })
    .select('*')
    .single();
  if (error) throw error;
  res.status(201).json({ schedule: data });
}));

async function loadOwnedSchedule(req) {
  const { data } = await supabaseAdmin.from('AvailabilitySchedule').select('*').eq('id', req.params.id).maybeSingle();
  if (!data || data.user_id !== req.user.id) {
    const err = new Error('Schedule not found.');
    err.statusCode = 404;
    throw err;
  }
  return data;
}

const schedulePatchSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120),
  timezone: Joi.string().max(64),
  is_default: Joi.boolean(),
}).min(1);

router.put('/availability/:id', validate(schedulePatchSchema), asyncHandler(async (req, res) => {
  const sched = await loadOwnedSchedule(req);
  if (req.body.is_default) {
    await supabaseAdmin.from('AvailabilitySchedule').update({ is_default: false }).eq('user_id', req.user.id).eq('is_default', true);
  }
  const { data, error } = await supabaseAdmin
    .from('AvailabilitySchedule')
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq('id', sched.id)
    .select('*')
    .single();
  if (error) throw error;
  res.json({ schedule: data });
}));

router.delete('/availability/:id', asyncHandler(async (req, res) => {
  const sched = await loadOwnedSchedule(req);
  if (sched.is_default) return res.status(409).json({ error: 'CANNOT_DELETE_DEFAULT', message: 'Set another schedule as default first.' });
  await supabaseAdmin.from('AvailabilitySchedule').delete().eq('id', sched.id);
  res.json({ ok: true });
}));

const rulesSchema = Joi.object({
  rules: Joi.array()
    .items(Joi.object({
      weekday: Joi.number().integer().min(0).max(6).required(),
      start_time: Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).required(),
      end_time: Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).required(),
    }))
    .required(),
});

router.put('/availability/:id/rules', validate(rulesSchema), asyncHandler(async (req, res) => {
  const sched = await loadOwnedSchedule(req);
  await supabaseAdmin.from('AvailabilityRule').delete().eq('schedule_id', sched.id);
  const rows = req.body.rules.map((r) => ({ ...r, schedule_id: sched.id }));
  const { data, error } = await supabaseAdmin.from('AvailabilityRule').insert(rows).select('*');
  if (error) throw error;
  res.json({ rules: data });
}));

const overridesSchema = Joi.object({
  overrides: Joi.array()
    .items(Joi.object({
      date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
      is_unavailable: Joi.boolean().default(false),
      start_time: Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).allow(null),
      end_time: Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).allow(null),
    }))
    .required(),
});

router.put('/availability/:id/overrides', validate(overridesSchema), asyncHandler(async (req, res) => {
  const sched = await loadOwnedSchedule(req);
  await supabaseAdmin.from('AvailabilityOverride').delete().eq('schedule_id', sched.id);
  const rows = req.body.overrides.map((o) => ({ ...o, schedule_id: sched.id }));
  const { data, error } = await supabaseAdmin.from('AvailabilityOverride').insert(rows).select('*');
  if (error) throw error;
  res.json({ overrides: data });
}));

const blockSchema = Joi.object({
  title: Joi.string().allow('', null).max(200),
  start_at: Joi.string().isoDate().required(),
  end_at: Joi.string().isoDate().required(),
  recurrence_rule: Joi.string().allow('', null).max(500),
  timezone: Joi.string().max(64).allow('', null),
});

router.post('/availability/blocks', validate(blockSchema), asyncHandler(async (req, res) => {
  // Persist the zone the block was authored in so a RECURRING block expands at the intended
  // wall-clock time across DST (migration 167 §5). Default: the creator's default schedule's
  // timezone — the zone their working hours already live in.
  let timezone = req.body.timezone || null;
  if (!timezone) {
    const { data: sched } = await supabaseAdmin
      .from('AvailabilitySchedule')
      .select('timezone')
      .eq('user_id', req.user.id)
      .eq('is_default', true)
      .maybeSingle();
    timezone = (sched && sched.timezone) || 'UTC';
  }
  const { data, error } = await supabaseAdmin
    .from('AvailabilityBlock')
    .insert({ ...req.body, timezone, user_id: req.user.id })
    .select('*')
    .single();
  if (error) throw error;
  res.status(201).json({ block: data });
}));

router.delete('/availability/blocks/:blockId', asyncHandler(async (req, res) => {
  const { data } = await supabaseAdmin.from('AvailabilityBlock').select('user_id').eq('id', req.params.blockId).maybeSingle();
  if (!data || data.user_id !== req.user.id) return res.status(404).json({ error: 'NOT_FOUND' });
  await supabaseAdmin.from('AvailabilityBlock').delete().eq('id', req.params.blockId);
  res.json({ ok: true });
}));

// ============================================================
// BOOKINGS — inbox + detail + lifecycle
// ============================================================

router.get('/bookings', withOwner('view'), asyncHandler(async (req, res) => {
  const { ownerType, ownerId } = req.scheduling;
  // Collective co-host reservation shadows (cohost_of_booking_id) mirror a primary row that is
  // already in this owner-scoped list — including them would show one meeting N times.
  let q = supabaseAdmin.from('Booking').select('*').eq('owner_type', ownerType).eq('owner_id', ownerId).is('cohost_of_booking_id', null);
  const status = req.query.status;
  const nowIso = new Date().toISOString();
  if (status === 'upcoming') q = q.in('status', ['confirmed']).gte('start_at', nowIso).order('start_at', { ascending: true });
  else if (status === 'pending') q = q.eq('status', 'pending').order('start_at', { ascending: true });
  else if (status === 'past') q = q.in('status', ['confirmed', 'completed', 'no_show']).lt('start_at', nowIso).order('start_at', { ascending: false });
  else if (status === 'cancelled') q = q.in('status', ['cancelled', 'declined']).order('start_at', { ascending: false });
  else q = q.order('start_at', { ascending: false });
  // Optional filters (Booking Search & Filter screen). Malformed values 400 instead of
  // reaching PostgREST, where a bad uuid/timestamp becomes an opaque 500.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (req.query.event_type_id) {
    if (!UUID_RE.test(String(req.query.event_type_id))) return res.status(400).json({ error: 'BAD_FILTER', message: 'event_type_id must be a UUID.' });
    q = q.eq('event_type_id', req.query.event_type_id);
  }
  if (req.query.from) {
    if (!Number.isFinite(Date.parse(req.query.from))) return res.status(400).json({ error: 'BAD_FILTER', message: 'from must be an ISO datetime.' });
    q = q.gte('start_at', req.query.from);
  }
  if (req.query.to) {
    if (!Number.isFinite(Date.parse(req.query.to))) return res.status(400).json({ error: 'BAD_FILTER', message: 'to must be an ISO datetime.' });
    q = q.lte('start_at', req.query.to);
  }
  if (req.query.q) q = q.ilike('invitee_name', `%${String(req.query.q).slice(0, 200).replace(/[%_]/g, '')}%`);
  const { data, error } = await q.limit(200);
  if (error) throw error;
  res.json({ bookings: data || [] });
}));

// Stats card for the Scheduling Hub / Summary Card. Registered BEFORE /bookings/:id so 'summary'
// isn't captured as an id.
router.get('/bookings/summary', withOwner('view'), asyncHandler(async (req, res) => {
  const summary = await bookingMetrics.getSummary({ ownerType: req.scheduling.ownerType, ownerId: req.scheduling.ownerId });
  res.json(summary);
}));

async function loadOwnedBooking(req) {
  const { data } = await supabaseAdmin.from('Booking').select('*').eq('id', req.params.id).maybeSingle();
  if (!data) {
    const err = new Error('Booking not found.');
    err.statusCode = 404;
    throw err;
  }
  await assertCanManageOwner(data.owner_type, data.owner_id, req.user.id, 'view');
  return data;
}

router.get('/bookings/:id', asyncHandler(async (req, res) => {
  const booking = await loadOwnedBooking(req);
  const [{ data: attendees }, { data: et }] = await Promise.all([
    supabaseAdmin.from('BookingAttendee').select('*').eq('booking_id', booking.id),
    supabaseAdmin.from('EventType').select('id, name, location_mode').eq('id', booking.event_type_id).maybeSingle(),
  ]);
  res.json({ booking, attendees: attendees || [], eventType: et || null });
}));

// Slot grid for the host Reschedule/Reassign sheet — composed availability excluding this booking.
router.get('/bookings/:id/available-slots', asyncHandler(async (req, res) => {
  const booking = await loadOwnedBooking(req);
  if (!req.query.from || !req.query.to) return res.status(400).json({ error: 'MISSING_RANGE', message: 'from and to are required.' });
  if (!booking.event_type_id) return res.json({ slots: [] }); // resource bookings have no event-type grid
  const et = await bookingService.getEventTypeById(booking.event_type_id);
  if (!et) return res.json({ slots: [] });
  const slots = await availabilityService.computeSlots({
    ownerType: booking.owner_type,
    ownerId: booking.owner_id,
    eventType: et,
    from: req.query.from,
    to: req.query.to,
    viewerTimezone: req.query.tz || booking.invitee_timezone,
    excludeBookingId: booking.id,
  });
  res.json({ slots: slots.map((s) => ({ start: s.start, end: s.end, startLocal: s.startLocal, eligibleHosts: s.eligibleHosts })) });
}));

const manualBookingSchema = Joi.object({
  owner_type: Joi.string().valid('user', 'home', 'business'),
  owner_id: Joi.string(),
  event_type_id: Joi.string().uuid().required(),
  start_at: Joi.string().isoDate().required(),
  duration_min: Joi.number().integer().min(5).max(1440),
  invitee_name: Joi.string().trim().max(200).allow('', null),
  invitee_email: Joi.string().email().max(320).allow('', null),
  invitee_phone: Joi.string().max(40).allow('', null),
  invitee_timezone: Joi.string().max(64).allow('', null),
  intake_answers: Joi.object().unknown(true).default({}),
});

router.post('/bookings', withOwner('edit'), validate(manualBookingSchema), asyncHandler(async (req, res) => {
  const et = await bookingService.getEventTypeById(req.body.event_type_id);
  if (!et) return res.status(404).json({ error: 'EVENT_TYPE_NOT_FOUND' });
  if (et.owner_type !== req.scheduling.ownerType || et.owner_id !== req.scheduling.ownerId) {
    return res.status(403).json({ error: 'OWNER_MISMATCH' });
  }
  try {
    const result = await bookingService.createBooking({
      eventType: et,
      startIso: req.body.start_at,
      durationMin: req.body.duration_min,
      invitee: {
        name: req.body.invitee_name,
        email: req.body.invitee_email ? normalizeEmail(req.body.invitee_email) : null,
        phone: req.body.invitee_phone,
        timezone: req.body.invitee_timezone,
      },
      intakeAnswers: req.body.intake_answers,
      createdVia: 'manual',
      actorUserId: req.user.id,
    });
    res.status(201).json(result);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.code || 'ERROR', message: err.message });
    throw err;
  }
}));

const actionSchema = Joi.object({
  reason: Joi.string().max(500).allow('', null),
  start_at: Joi.string().isoDate(),
  host_user_id: Joi.string().uuid(),
}).unknown(true);

async function lifecycleHandler(req, res, fn) {
  const booking = await loadOwnedBooking(req);
  await assertCanManageOwner(booking.owner_type, booking.owner_id, req.user.id, 'edit');
  try {
    const updated = await fn(booking);
    res.json({ booking: updated });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.code || 'ERROR', message: err.message });
    throw err;
  }
}

router.post('/bookings/:id/approve', asyncHandler((req, res) => lifecycleHandler(req, res, (b) => bookingService.approveBooking(b.id, req.user.id))));
router.post('/bookings/:id/decline', validate(actionSchema), asyncHandler((req, res) => lifecycleHandler(req, res, (b) => bookingService.declineBooking(b.id, req.user.id, req.body.reason))));
router.post('/bookings/:id/cancel', validate(actionSchema), asyncHandler((req, res) => lifecycleHandler(req, res, (b) => bookingService.cancelBooking(b.id, req.user.id, req.body.reason, 'host'))));
router.post('/bookings/:id/reschedule', validate(actionSchema), asyncHandler((req, res) => lifecycleHandler(req, res, (b) => bookingService.rescheduleBooking(b.id, req.user.id, req.body.start_at, 'host', req.body.host_user_id))));
router.post('/bookings/:id/no-show', asyncHandler((req, res) => lifecycleHandler(req, res, (b) => bookingService.markNoShow(b.id, req.user.id))));
router.post('/bookings/:id/reassign', validate(actionSchema), asyncHandler((req, res) => lifecycleHandler(req, res, (b) => bookingService.reassignBooking(b.id, req.user.id, req.body.host_user_id))));

// RSVP — attendee self-service (not owner-gated): the signed-in user updates their own response.
const rsvpSchema = Joi.object({ status: Joi.string().valid('going', 'maybe', 'declined', 'pending').required() });
router.post('/bookings/:id/rsvp', validate(rsvpSchema), asyncHandler(async (req, res) => {
  const { data: attendee } = await supabaseAdmin
    .from('BookingAttendee')
    .select('id')
    .eq('booking_id', req.params.id)
    .eq('user_id', req.user.id)
    .maybeSingle();
  if (!attendee) return res.status(403).json({ error: 'NOT_AN_ATTENDEE', message: 'You are not an attendee of this booking.' });
  const { data, error } = await supabaseAdmin
    .from('BookingAttendee')
    .update({ rsvp_status: req.body.status })
    .eq('id', attendee.id)
    .select('*')
    .single();
  if (error) throw error;
  res.json({ attendee: data });
}));

// ============================================================
// HOME — find-a-time, who's-free, resources (home owner_type only)
// ============================================================

function requireHome(req) {
  if (req.scheduling.ownerType !== 'home') {
    const err = new Error('This endpoint is only available for the home pillar.');
    err.statusCode = 400;
    throw err;
  }
}

const findATimeSchema = Joi.object({
  owner_type: Joi.string().valid('home'),
  owner_id: Joi.string(),
  member_ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
  mode: Joi.string().valid('collective', 'round_robin').default('collective'),
  duration_min: Joi.number().integer().min(5).max(1440).default(30),
  from: Joi.string().isoDate().required(),
  to: Joi.string().isoDate().required(),
  slot_interval_min: Joi.number().integer().min(5).max(240).default(30),
  timezone: Joi.string().max(64),
});

router.post('/find-a-time', withOwner('view'), validate(findATimeSchema), asyncHandler(async (req, res) => {
  requireHome(req);
  const { ownerType, ownerId } = req.scheduling;
  // Identity firewall: only compose the availability of ACTIVE members of this home. Without this,
  // a home member could probe any user's personal free/busy by passing arbitrary UUIDs.
  const { data: occ } = await supabaseAdmin
    .from('HomeOccupancy')
    .select('user_id')
    .eq('home_id', ownerId)
    .eq('is_active', true)
    .in('user_id', req.body.member_ids);
  const memberSet = new Set((occ || []).map((r) => r.user_id));
  const invalidMembers = req.body.member_ids.filter((id) => !memberSet.has(id));
  if (invalidMembers.length) {
    return res.status(400).json({ error: 'INVALID_MEMBER', message: 'All members must belong to this home.', invalid: invalidMembers });
  }
  // Synthesize an ephemeral event type for the compute call.
  const pseudoEventType = {
    id: null,
    owner_type: ownerType,
    owner_id: ownerId,
    assignment_mode: req.body.mode,
    default_duration: req.body.duration_min,
    slot_interval_min: req.body.slot_interval_min,
    buffer_before_min: 0,
    buffer_after_min: 0,
    min_notice_min: 0,
    max_horizon_days: 365,
    schedule_id: null,
  };
  const slots = await availabilityService.computeSlots({
    ownerType,
    ownerId,
    eventType: pseudoEventType,
    from: req.body.from,
    to: req.body.to,
    viewerTimezone: req.body.timezone,
    memberOverride: req.body.member_ids,
  });
  res.json({ slots });
}));

router.get('/whos-free', withOwner('view'), asyncHandler(async (req, res) => {
  requireHome(req);
  const { ownerId } = req.scheduling;
  const from = req.query.from;
  const to = req.query.to;
  if (!from || !to) return res.status(400).json({ error: 'MISSING_RANGE', message: 'from and to are required.' });
  // Active home members.
  const { data: members } = await supabaseAdmin
    .from('HomeOccupancy')
    .select('user_id')
    .eq('home_id', ownerId)
    .eq('is_active', true);
  const memberIds = [...new Set((members || []).map((m) => m.user_id))];
  const grid = {};
  for (const id of memberIds) {
    grid[id] = await availabilityService.computeSlots({
      ownerType: 'user',
      ownerId: id,
      eventType: { default_duration: 30, slot_interval_min: 30, buffer_before_min: 0, buffer_after_min: 0, min_notice_min: 0, max_horizon_days: 365, assignment_mode: 'one_on_one', schedule_id: null },
      from,
      to,
      viewerTimezone: req.query.tz,
    });
  }
  res.json({ members: memberIds, freeByMember: grid });
}));

const resourceSchema = Joi.object({
  owner_type: Joi.string().valid('home'),
  owner_id: Joi.string(),
  name: Joi.string().trim().min(1).max(200).required(),
  resource_type: Joi.string().valid('room', 'vehicle', 'tool', 'charger', 'other').default('other'),
  photo_url: Joi.string().allow('', null).max(1000),
  who_can_book: Joi.string().valid('members', 'specific', 'guests').default('members'),
  max_duration_min: Joi.number().integer().min(5).allow(null),
  buffer_min: Joi.number().integer().min(0).default(0),
  requires_approval: Joi.boolean().default(false),
  available_hours: Joi.object().unknown(true).default({}),
});

router.get('/resources', withOwner('view'), asyncHandler(async (req, res) => {
  requireHome(req);
  const { data, error } = await supabaseAdmin.from('HomeResource').select('*').eq('home_id', req.scheduling.ownerId).eq('is_active', true);
  if (error) throw error;
  res.json({ resources: data || [] });
}));

router.post('/resources', withOwner('edit'), validate(resourceSchema), asyncHandler(async (req, res) => {
  requireHome(req);
  const body = { ...req.body };
  delete body.owner_type;
  delete body.owner_id;
  const { data, error } = await supabaseAdmin
    .from('HomeResource')
    .insert({ ...body, home_id: req.scheduling.ownerId, created_by: req.user.id })
    .select('*')
    .single();
  if (error) throw error;
  res.status(201).json({ resource: data });
}));

const resourcePatchSchema = Joi.object({
  owner_type: Joi.string().valid('home'),
  owner_id: Joi.string(),
  name: Joi.string().trim().min(1).max(200),
  resource_type: Joi.string().valid('room', 'vehicle', 'tool', 'charger', 'other'),
  photo_url: Joi.string().allow('', null).max(1000),
  who_can_book: Joi.string().valid('members', 'specific', 'guests'),
  max_duration_min: Joi.number().integer().min(5).allow(null),
  buffer_min: Joi.number().integer().min(0),
  requires_approval: Joi.boolean(),
  available_hours: Joi.object().unknown(true),
}).min(1);

router.put('/resources/:rid', withOwner('edit'), validate(resourcePatchSchema), asyncHandler(async (req, res) => {
  requireHome(req);
  const body = { ...req.body };
  delete body.owner_type;
  delete body.owner_id;
  const { data, error } = await supabaseAdmin
    .from('HomeResource')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', req.params.rid)
    .eq('home_id', req.scheduling.ownerId)
    .select('*')
    .maybeSingle(); // .single() turned "no such resource in this home" into an opaque 500
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'RESOURCE_NOT_FOUND' });
  res.json({ resource: data });
}));

router.delete('/resources/:rid', withOwner('edit'), asyncHandler(async (req, res) => {
  requireHome(req);
  await supabaseAdmin.from('HomeResource').update({ is_active: false }).eq('id', req.params.rid).eq('home_id', req.scheduling.ownerId);
  res.json({ ok: true });
}));

const resourceBookSchema = Joi.object({
  owner_type: Joi.string().valid('home'),
  owner_id: Joi.string(),
  start_at: Joi.string().isoDate().required(),
  duration_min: Joi.number().integer().min(5).max(1440),
  name: Joi.string().max(200).allow('', null),
});

// Book a resource. withOwner('view') gates on an active home member (who_can_book='members').
// NOTE: 'specific'/'guests' policies are a follow-up; v1 allows active members.
router.post('/resources/:rid/book', withOwner('view'), validate(resourceBookSchema), asyncHandler(async (req, res) => {
  requireHome(req);
  const { data: resource } = await supabaseAdmin
    .from('HomeResource')
    .select('*')
    .eq('id', req.params.rid)
    .eq('home_id', req.scheduling.ownerId)
    .eq('is_active', true)
    .maybeSingle();
  if (!resource) return res.status(404).json({ error: 'RESOURCE_NOT_FOUND' });
  try {
    const booking = await bookingService.createResourceBooking({
      resource,
      startIso: req.body.start_at,
      durationMin: req.body.duration_min,
      booker: { id: req.user.id, name: req.body.name || null, email: req.user.email },
    });
    res.status(201).json({ booking });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.code || 'ERROR', message: err.message });
    throw err;
  }
}));

// Schedule a vendor/guest visit. Modeled as a HomeCalendarEvent (event_type vendor/guest) so it
// lands on the household calendar and counts as busy in availability. who_is_home tags the members
// expected to be present (stored in assigned_to, which the engine treats as that member's busy).
const visitSchema = Joi.object({
  owner_type: Joi.string().valid('home'),
  owner_id: Joi.string(),
  visit_type: Joi.string().valid('vendor', 'guest').default('vendor'),
  title: Joi.string().trim().min(1).max(200).required(),
  description: Joi.string().allow('', null).max(2000),
  start_at: Joi.string().isoDate().required(),
  end_at: Joi.string().isoDate().required(),
  who_is_home: Joi.array().items(Joi.string().uuid()).default([]),
  location_notes: Joi.string().allow('', null).max(500),
});

router.post('/visits', withOwner('edit'), validate(visitSchema), asyncHandler(async (req, res) => {
  requireHome(req);
  const { start_at, end_at } = req.body;
  const spanMs = new Date(end_at).getTime() - new Date(start_at).getTime();
  if (spanMs <= 0) {
    return res.status(400).json({ error: 'BAD_RANGE', message: 'end_at must be after start_at.' });
  }
  if (spanMs > 30 * 24 * 60 * 60 * 1000) {
    return res.status(400).json({ error: 'BAD_RANGE', message: 'A visit cannot span more than 30 days.' });
  }
  const { data, error } = await supabaseAdmin
    .from('HomeCalendarEvent')
    .insert({
      home_id: req.scheduling.ownerId,
      event_type: req.body.visit_type,
      title: req.body.title,
      description: req.body.description || null,
      start_at,
      end_at,
      location_notes: req.body.location_notes || null,
      assigned_to: req.body.who_is_home && req.body.who_is_home.length ? req.body.who_is_home : null,
      created_by: req.user.id,
    })
    .select('*')
    .single();
  if (error) throw error;
  res.status(201).json({ visit: data });
}));

// ============================================================
// SCHEDULING NOTIFICATION PREFERENCES (per host user)
// ============================================================
router.get('/notification-preferences', asyncHandler(async (req, res) => {
  res.json({ prefs: await schedulingNotifyPrefs.getPrefs(req.user.id) });
}));

router.put('/notification-preferences', validate(Joi.object({ prefs: Joi.object().unknown(true).required() })), asyncHandler(async (req, res) => {
  const { data: existing } = await supabaseAdmin
    .from('SchedulingNotificationPreference')
    .select('id')
    .eq('user_id', req.user.id)
    .maybeSingle();
  if (existing) {
    await supabaseAdmin
      .from('SchedulingNotificationPreference')
      .update({ prefs: req.body.prefs, updated_at: new Date().toISOString() })
      .eq('user_id', req.user.id);
  } else {
    await supabaseAdmin.from('SchedulingNotificationPreference').insert({ user_id: req.user.id, prefs: req.body.prefs });
  }
  res.json({ prefs: await schedulingNotifyPrefs.getPrefs(req.user.id) });
}));

// ============================================================
// ONE-OFF / SINGLE-USE LINKS
// ============================================================
const oneOffSchema = Joi.object({
  owner_type: Joi.string().valid('user', 'home', 'business'),
  owner_id: Joi.string(),
  event_type_id: Joi.string().uuid().required(),
  // Explicit null = never expires (BookingToken.expires_at NULL; the public redemption
  // checks are already null-tolerant). Omitting the key keeps the 7-day default.
  expires_in_min: Joi.number().integer().min(5).max(525600).allow(null).default(10080),
  single_use: Joi.boolean().default(true),
  offered_slots: Joi.array()
    .items(Joi.object({ start: Joi.string().isoDate().required(), end: Joi.string().isoDate().required() }))
    .max(50),
});

router.post('/booking-page/one-off-links', withOwner('edit'), validate(oneOffSchema), asyncHandler(async (req, res) => {
  const et = await bookingService.getEventTypeById(req.body.event_type_id);
  if (!et || et.owner_type !== req.scheduling.ownerType || et.owner_id !== req.scheduling.ownerId) {
    return res.status(404).json({ error: 'EVENT_TYPE_NOT_FOUND' });
  }
  const { token, hash } = generateToken();
  const { data, error } = await supabaseAdmin
    .from('BookingToken')
    .insert({
      event_type_id: et.id,
      token_hash: hash,
      kind: 'one_off',
      single_use: req.body.single_use,
      expires_at: req.body.expires_in_min == null ? null : new Date(Date.now() + req.body.expires_in_min * 60 * 1000).toISOString(),
      offered_slots: req.body.offered_slots && req.body.offered_slots.length ? req.body.offered_slots : null,
    })
    .select('id, expires_at, single_use')
    .single();
  if (error) throw error;
  // Raw token returned once; the public flow is GET/POST /api/public/book/o/:token.
  res.status(201).json({ token, path: `/book/o/${token}`, expires_at: data.expires_at, single_use: data.single_use });
}));

// ============================================================
// WORKFLOWS (automations) — owner-scoped CRUD over SchedulingWorkflow
// ============================================================
const workflowSchema = Joi.object({
  owner_type: Joi.string().valid('user', 'home', 'business'),
  owner_id: Joi.string(),
  event_type_id: Joi.string().uuid().allow(null),
  name: Joi.string().trim().min(1).max(200).required(),
  trigger: Joi.string().valid('booking_created', 'cancelled', 'rescheduled', 'before_start', 'after_end').required(),
  offset_minutes: Joi.number().integer().min(0).max(525600).default(0),
  action: Joi.string().valid('email', 'push', 'in_app', 'sms').required(),
  message_template: Joi.string().allow('', null).max(5000),
  is_active: Joi.boolean().default(true),
});

router.get('/workflows', withOwner('view'), asyncHandler(async (req, res) => {
  const { data } = await supabaseAdmin.from('SchedulingWorkflow').select('*')
    .eq('owner_type', req.scheduling.ownerType).eq('owner_id', req.scheduling.ownerId).order('created_at', { ascending: false });
  res.json({ workflows: data || [] });
}));
router.post('/workflows', withOwner('edit'), validate(workflowSchema), asyncHandler(async (req, res) => {
  const body = { ...req.body }; delete body.owner_type; delete body.owner_id;
  const { data, error } = await supabaseAdmin.from('SchedulingWorkflow').insert({ ...req.scheduling.oc, ...body }).select('*').single();
  if (error) throw error;
  res.status(201).json({ workflow: data });
}));
async function loadOwnedRow(req, table) {
  const { data } = await supabaseAdmin.from(table).select('*').eq('id', req.params.id).maybeSingle();
  if (!data) { const e = new Error('Not found.'); e.statusCode = 404; throw e; }
  await assertCanManageOwner(data.owner_type, data.owner_id, req.user.id, 'edit');
  return data;
}
// Partial-update schema. Deliberately NOT `workflowSchema.fork(...)`: fork only lifts
// `required()`, it keeps every `.default()` — so a body of `{is_active:false}` would be
// validated into `{is_active:false, offset_minutes:0}` and silently zero the trigger offset
// on every pause/resume. Same pattern as eventTypePatchSchema.
const workflowPatchSchema = Joi.object({
  event_type_id: Joi.string().uuid().allow(null),
  name: Joi.string().trim().min(1).max(200),
  trigger: Joi.string().valid('booking_created', 'cancelled', 'rescheduled', 'before_start', 'after_end'),
  offset_minutes: Joi.number().integer().min(0).max(525600),
  action: Joi.string().valid('email', 'push', 'in_app', 'sms'),
  message_template: Joi.string().allow('', null).max(5000),
  is_active: Joi.boolean(),
}).min(1);

router.put('/workflows/:id', validate(workflowPatchSchema), asyncHandler(async (req, res) => {
  const row = await loadOwnedRow(req, 'SchedulingWorkflow');
  const body = { ...req.body }; delete body.owner_type; delete body.owner_id;
  const { data, error } = await supabaseAdmin.from('SchedulingWorkflow').update({ ...body, updated_at: new Date().toISOString() }).eq('id', row.id).select('*').single();
  if (error) throw error;
  res.json({ workflow: data });
}));
router.delete('/workflows/:id', asyncHandler(async (req, res) => {
  const row = await loadOwnedRow(req, 'SchedulingWorkflow');
  await supabaseAdmin.from('SchedulingWorkflow').delete().eq('id', row.id);
  res.json({ ok: true });
}));

// ============================================================
// MESSAGE TEMPLATES — owner-scoped CRUD + preview
// ============================================================
const templateSchema = Joi.object({
  owner_type: Joi.string().valid('user', 'home', 'business'),
  owner_id: Joi.string(),
  name: Joi.string().trim().min(1).max(200).required(),
  channel: Joi.string().valid('email', 'push', 'in_app', 'sms').default('email'),
  subject: Joi.string().allow('', null).max(300),
  body: Joi.string().trim().min(1).max(5000).required(),
  is_active: Joi.boolean().default(true),
});
router.get('/message-templates', withOwner('view'), asyncHandler(async (req, res) => {
  const { data } = await supabaseAdmin.from('MessageTemplate').select('*')
    .eq('owner_type', req.scheduling.ownerType).eq('owner_id', req.scheduling.ownerId).order('created_at', { ascending: false });
  res.json({ templates: data || [] });
}));
router.post('/message-templates', withOwner('edit'), validate(templateSchema), asyncHandler(async (req, res) => {
  const body = { ...req.body }; delete body.owner_type; delete body.owner_id;
  const { data, error } = await supabaseAdmin.from('MessageTemplate').insert({ ...req.scheduling.oc, ...body, created_by: req.user.id }).select('*').single();
  if (error) throw error;
  res.status(201).json({ template: data });
}));
router.post('/message-templates/preview', validate(Joi.object({ subject: Joi.string().allow('', null), body: Joi.string().required(), variables: Joi.object().unknown(true).default({}) })), asyncHandler(async (req, res) => {
  const fill = (str) => String(str || '').replace(/\{\{?\s*([\w.]+)\s*\}?\}/g, (m, k) => (req.body.variables[k] != null ? String(req.body.variables[k]) : m));
  res.json({ subject: fill(req.body.subject), body: fill(req.body.body) });
}));
// Defaults-free partial update — see workflowPatchSchema for why fork() is wrong here
// (fork keeps defaults; `{subject:'x'}` would also flip channel back to 'email').
const templatePatchSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200),
  channel: Joi.string().valid('email', 'push', 'in_app', 'sms'),
  subject: Joi.string().allow('', null).max(300),
  body: Joi.string().trim().min(1).max(5000),
  is_active: Joi.boolean(),
}).min(1);

router.put('/message-templates/:id', validate(templatePatchSchema), asyncHandler(async (req, res) => {
  const row = await loadOwnedRow(req, 'MessageTemplate');
  const body = { ...req.body }; delete body.owner_type; delete body.owner_id;
  const { data, error } = await supabaseAdmin.from('MessageTemplate').update({ ...body, updated_at: new Date().toISOString() }).eq('id', row.id).select('*').single();
  if (error) throw error;
  res.json({ template: data });
}));
router.delete('/message-templates/:id', asyncHandler(async (req, res) => {
  const row = await loadOwnedRow(req, 'MessageTemplate');
  await supabaseAdmin.from('MessageTemplate').delete().eq('id', row.id);
  res.json({ ok: true });
}));

// ============================================================
// INSIGHTS (no-show report + team performance; overall = /bookings/summary)
// ============================================================
router.get('/insights/no-shows', withOwner('view'), asyncHandler(async (req, res) => {
  const days = Math.min(parseInt(req.query.days, 10) || 90, 365);
  res.json(await bookingMetrics.getNoShowReport({ ownerType: req.scheduling.ownerType, ownerId: req.scheduling.ownerId, days }));
}));
router.get('/insights/team', withOwner('view'), asyncHandler(async (req, res) => {
  if (req.scheduling.ownerType !== 'business') return res.status(400).json({ error: 'BUSINESS_ONLY' });
  const days = Math.min(parseInt(req.query.days, 10) || 90, 365);
  res.json(await bookingMetrics.getTeamPerformance({ businessUserId: req.scheduling.ownerId, days }));
}));

// ============================================================
// INVOICES (reuse BusinessInvoice — business owner only)
// ============================================================
router.get('/invoices', withOwner('view'), asyncHandler(async (req, res) => {
  if (req.scheduling.ownerType !== 'business') return res.json({ invoices: [] });
  const { data } = await supabaseAdmin.from('BusinessInvoice').select('*').eq('business_user_id', req.scheduling.ownerId).order('created_at', { ascending: false }).limit(200);
  res.json({ invoices: data || [] });
}));
router.get('/invoices/:id', withOwner('view'), asyncHandler(async (req, res) => {
  const { data } = await supabaseAdmin.from('BusinessInvoice').select('*').eq('id', req.params.id).maybeSingle();
  if (!data || data.business_user_id !== req.scheduling.ownerId) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({ invoice: data });
}));
router.post('/invoices/:id/send', withOwner('edit'), asyncHandler(async (req, res) => {
  const { data: inv } = await supabaseAdmin.from('BusinessInvoice').select('*').eq('id', req.params.id).maybeSingle();
  if (!inv || inv.business_user_id !== req.scheduling.ownerId) return res.status(404).json({ error: 'NOT_FOUND' });
  // Notify the recipient in-app (no status mutation — avoid touching the gig invoice state machine).
  if (inv.recipient_user_id) {
    await notificationService.createNotification({
      userId: inv.recipient_user_id, type: 'invoice_sent', title: 'You have a new invoice',
      body: `Invoice for ${(inv.total_cents / 100).toFixed(2)} ${inv.currency || 'USD'}`, icon: '🧾',
      link: `/app/invoices/${inv.id}`, metadata: { invoice_id: inv.id }, context: 'personal',
    });
  }
  res.json({ ok: true });
}));

// ============================================================
// PACKAGES (owner CRUD) + buy/credits/apply (customer)
// ============================================================
const packageSchema = Joi.object({
  owner_type: Joi.string().valid('user', 'home', 'business'),
  owner_id: Joi.string(),
  name: Joi.string().trim().min(1).max(200).required(),
  sessions_count: Joi.number().integer().min(1).max(1000).required(),
  price_cents: Joi.number().integer().min(0).default(0),
  currency: Joi.string().length(3).uppercase().default('USD'),
  event_type_id: Joi.string().uuid().allow(null),
  is_active: Joi.boolean().default(true),
});
router.get('/packages', withOwner('view'), asyncHandler(async (req, res) => {
  const { data } = await supabaseAdmin.from('BookingPackage').select('*, credits:PackageCredit(count)')
    .eq('owner_type', req.scheduling.ownerType).eq('owner_id', req.scheduling.ownerId).order('created_at', { ascending: false });
  // `sold_count` = granted credits (one PackageCredit row per purchase). Credits are granted
  // optimistically at purchase and honored system-wide (my-packages, redemption), so this is the
  // count of package instances customers hold — the meaningful "sold" signal for the owner badge.
  // PostgREST returns the embedded aggregate as `credits: [{ count }]`; flatten it onto each row so
  // the list renders "· N sold" without an N+1 fetch.
  // Caveat (deliberate): a paid checkout inserts the credit at payment-intent time (packageService
  // .purchasePackage), so abandoned paid intents can inflate the count until package payment
  // settlement/reconciliation is wired — currently the documented deferral in packageService.js.
  // We do NOT filter on Payment capture here: package settlement is deferred, so paid credits never
  // reach a captured state and such a filter would under-count real sales to ~zero.
  const packages = (data || []).map(({ credits, ...pkg }) => ({
    ...pkg,
    sold_count: Array.isArray(credits) ? (credits[0]?.count ?? 0) : 0,
  }));
  res.json({ packages });
}));
router.post('/packages', withOwner('edit'), validate(packageSchema), asyncHandler(async (req, res) => {
  const body = { ...req.body }; delete body.owner_type; delete body.owner_id;
  const { data, error } = await supabaseAdmin.from('BookingPackage').insert({ ...req.scheduling.oc, ...body }).select('*').single();
  if (error) throw error;
  res.status(201).json({ package: data });
}));
// Defaults-free partial update — see workflowPatchSchema for why fork() is wrong here.
// With fork, restoring an archived package (`{is_active:true}`) also validated in
// `price_cents:0` + `currency:'USD'` and wiped the package's real price.
const packagePatchSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200),
  sessions_count: Joi.number().integer().min(1).max(1000),
  price_cents: Joi.number().integer().min(0),
  currency: Joi.string().length(3).uppercase(),
  event_type_id: Joi.string().uuid().allow(null),
  is_active: Joi.boolean(),
}).min(1);

router.put('/packages/:id', validate(packagePatchSchema), asyncHandler(async (req, res) => {
  const row = await loadOwnedRow(req, 'BookingPackage');
  const body = { ...req.body }; delete body.owner_type; delete body.owner_id;
  const { data, error } = await supabaseAdmin.from('BookingPackage').update({ ...body, updated_at: new Date().toISOString() }).eq('id', row.id).select('*').single();
  if (error) throw error;
  res.json({ package: data });
}));
router.delete('/packages/:id', asyncHandler(async (req, res) => {
  const row = await loadOwnedRow(req, 'BookingPackage');
  await supabaseAdmin.from('BookingPackage').update({ is_active: false }).eq('id', row.id);
  res.json({ ok: true });
}));
// Customer buys a package (authed; not owner-gated).
router.post('/packages/:id/buy', asyncHandler(async (req, res) => {
  const { data: pkg } = await supabaseAdmin.from('BookingPackage').select('*').eq('id', req.params.id).eq('is_active', true).maybeSingle();
  if (!pkg) return res.status(404).json({ error: 'PACKAGE_NOT_FOUND' });
  const result = await packages.purchasePackage({ pkg, buyerUserId: req.user.id });
  if (!result.success) return res.status(400).json({ error: result.error, message: result.message });
  res.status(201).json({ credit: result.credit, clientSecret: result.clientSecret || null });
}));
// Customer's remaining credits.
router.get('/my-packages', asyncHandler(async (req, res) => {
  const { data } = await supabaseAdmin.from('PackageCredit')
    .select('*, BookingPackage:package_id ( name, sessions_count, owner_type, owner_id, event_type_id )')
    .eq('buyer_user_id', req.user.id).order('purchased_at', { ascending: false });
  res.json({ credits: data || [] });
}));

// ============================================================
// MY BOOKINGS (invitee/customer list across owners)
// ============================================================
router.get('/my-bookings', asyncHandler(async (req, res) => {
  const email = req.user.email ? normalizeEmail(req.user.email) : null;
  // Two parameterized queries (no filter-string interpolation), merged + deduped — matches by
  // linked user id OR exact invitee_email (stored normalized at booking time).
  const byUser = supabaseAdmin.from('Booking').select('*').eq('invitee_user_id', req.user.id).order('start_at', { ascending: false }).limit(200);
  const byEmail = email
    ? supabaseAdmin.from('Booking').select('*').eq('invitee_email', email).order('start_at', { ascending: false }).limit(200)
    : Promise.resolve({ data: [] });
  const [r1, r2] = await Promise.all([byUser, byEmail]);
  if (r1.error) throw r1.error;
  const seen = new Set();
  const merged = [...(r1.data || []), ...(r2.data || [])]
    .filter((b) => (seen.has(b.id) ? false : seen.add(b.id)))
    .sort((a, b) => new Date(b.start_at) - new Date(a.start_at))
    .slice(0, 200);
  res.json({ bookings: merged });
}));

// ============================================================
// BOOKING extras: nudge, propose-reschedule, apply-credit, recurring
// ============================================================
router.post('/bookings/:id/nudge', validate(Joi.object({ message: Joi.string().max(1000).allow('', null) })), asyncHandler(async (req, res) => {
  const booking = await loadOwnedBooking(req);
  await assertCanManageOwner(booking.owner_type, booking.owner_id, req.user.id, 'edit');
  const msg = req.body.message || 'A reminder about your upcoming booking.';
  if (booking.invitee_user_id) {
    await notificationService.createNotification({ userId: booking.invitee_user_id, type: 'booking_nudge', title: 'A note about your booking', body: msg, icon: '📅', link: `/app/profile/schedule/bookings/${booking.id}`, metadata: { booking_id: booking.id }, context: 'personal' });
  } else if (booking.invitee_email) {
    await emailService.sendEmail({ to: booking.invitee_email, subject: 'A note about your booking', html: `<p>${msg.replace(/</g, '&lt;')}</p>` });
  }
  res.json({ ok: true });
}));
router.post('/bookings/:id/propose-reschedule', validate(Joi.object({ start_at: Joi.string().isoDate().required(), host_user_id: Joi.string().uuid() })), asyncHandler((req, res) => lifecycleHandler(req, res, (b) => bookingService.proposeReschedule(b.id, req.user.id, req.body.start_at, req.body.host_user_id))));
// Customer applies a package credit to their own booking (not owner-gated).
router.post('/bookings/:id/apply-credit', validate(Joi.object({ credit_id: Joi.string().uuid().required() })), asyncHandler(async (req, res) => {
  const { data: booking } = await supabaseAdmin
    .from('Booking')
    .select('id, invitee_user_id, payment_id, package_credit_id, event_type_id, owner_type, owner_id, status')
    .eq('id', req.params.id)
    .maybeSingle();
  if (!booking) return res.status(404).json({ error: 'NOT_FOUND' });
  if (booking.invitee_user_id !== req.user.id) return res.status(403).json({ error: 'NOT_YOUR_BOOKING' });
  if (booking.package_credit_id) return res.status(409).json({ error: 'ALREADY_APPLIED' });
  if (booking.payment_id) return res.status(409).json({ error: 'ALREADY_PAID', message: 'This booking is already being paid for.' });
  if (!['pending', 'confirmed'].includes(booking.status)) return res.status(409).json({ error: 'BAD_STATE', message: 'This booking can no longer take a credit.' });
  // The credit must come from a package sold by this booking's owner, and (if the package is scoped
  // to a specific event type) must match that event type.
  const { data: credit } = await supabaseAdmin
    .from('PackageCredit')
    .select('id, buyer_user_id, BookingPackage:package_id ( owner_type, owner_id, event_type_id )')
    .eq('id', req.body.credit_id)
    .maybeSingle();
  if (!credit || credit.buyer_user_id !== req.user.id) return res.status(404).json({ error: 'CREDIT_NOT_FOUND' });
  const pkg = credit.BookingPackage;
  if (pkg && (pkg.owner_type !== booking.owner_type || pkg.owner_id !== booking.owner_id)) {
    return res.status(400).json({ error: 'CREDIT_WRONG_OWNER', message: 'This credit cannot be used here.' });
  }
  if (pkg && pkg.event_type_id && pkg.event_type_id !== booking.event_type_id) {
    return res.status(400).json({ error: 'CREDIT_WRONG_EVENT_TYPE', message: 'This credit is for a different appointment type.' });
  }
  const result = await packages.redeemForBooking({ bookingId: booking.id, creditId: req.body.credit_id, userId: req.user.id });
  if (!result.success) return res.status(409).json({ error: result.error, message: result.message });
  res.json({ ok: true, remaining: result.remaining });
}));
const recurringSchema = Joi.object({
  owner_type: Joi.string().valid('user', 'home', 'business'),
  owner_id: Joi.string(),
  event_type_id: Joi.string().uuid().required(),
  sessions: Joi.array().items(Joi.string().isoDate()).min(1).max(52).required(),
  invitee_name: Joi.string().max(200).allow('', null),
  invitee_email: Joi.string().email().max(320).allow('', null),
  invitee_timezone: Joi.string().max(64).allow('', null),
});
router.post('/bookings/recurring', withOwner('edit'), validate(recurringSchema), asyncHandler(async (req, res) => {
  const et = await bookingService.getEventTypeById(req.body.event_type_id);
  if (!et || et.owner_type !== req.scheduling.ownerType || et.owner_id !== req.scheduling.ownerId) return res.status(404).json({ error: 'EVENT_TYPE_NOT_FOUND' });
  try {
    const result = await bookingService.createRecurringBookings({
      eventType: et, sessions: req.body.sessions,
      invitee: { name: req.body.invitee_name, email: req.body.invitee_email ? normalizeEmail(req.body.invitee_email) : null, timezone: req.body.invitee_timezone },
      createdVia: 'manual', actorUserId: req.user.id,
    });
    res.status(201).json(result);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.code || 'ERROR', message: err.message });
    throw err;
  }
}));

// ============================================================
// PAYMENTS STATUS + CONNECTED CALENDARS (read; OAuth sync deferred)
// ============================================================
router.get('/payments/status', withOwner('view'), asyncHandler(async (req, res) => {
  const userId = req.scheduling.oc.owner_user_id; // null for home
  if (!userId) return res.json({ connected: false, applicable: false });
  const { data: acct } = await supabaseAdmin.from('StripeAccount').select('charges_enabled, payouts_enabled, stripe_account_id').eq('user_id', userId).maybeSingle();
  res.json({ applicable: true, connected: !!acct, charges_enabled: !!(acct && acct.charges_enabled), payouts_enabled: !!(acct && acct.payouts_enabled) });
}));
router.get('/connected-calendars', asyncHandler(async (req, res) => {
  const { data } = await supabaseAdmin.from('ConnectedCalendar').select('id, provider, external_account, check_conflicts, write_target, status, last_synced_at').eq('user_id', req.user.id);
  res.json({ calendars: data || [] });
}));
router.post('/connected-calendars/connect', asyncHandler(async (req, res) => {
  // External calendar OAuth/sync is deferred (Tier C). Surface a clear not-yet-available signal.
  res.status(501).json({ error: 'NOT_AVAILABLE', message: 'External calendar sync is coming soon.' });
}));

// ============================================================
// WAITLIST (host side) + MEETING POLLS
// ============================================================
router.get('/event-types/:id/waitlist', asyncHandler(async (req, res) => {
  const et = await loadOwnedEventType(req);
  const { data } = await supabaseAdmin.from('SchedulingWaitlist').select('*').eq('event_type_id', et.id).eq('status', 'waiting').order('created_at');
  res.json({ waitlist: data || [] });
}));
router.post('/waitlist/:id/promote', asyncHandler(async (req, res) => {
  const { data: entry } = await supabaseAdmin.from('SchedulingWaitlist').select('*').eq('id', req.params.id).maybeSingle();
  if (!entry) return res.status(404).json({ error: 'NOT_FOUND' });
  await assertCanManageOwner(entry.owner_type, entry.owner_id, req.user.id, 'edit');
  await supabaseAdmin.from('SchedulingWaitlist').update({ status: 'promoted', notified_at: new Date().toISOString() }).eq('id', entry.id);
  if (entry.invitee_user_id) {
    await notificationService.createNotification({ userId: entry.invitee_user_id, type: 'waitlist_promoted', title: 'A slot opened up', body: 'A spot is now available — book it before it fills.', icon: '🎟️', metadata: { event_type_id: entry.event_type_id }, context: 'personal' });
  } else if (entry.invitee_email) {
    await emailService.sendEmail({ to: entry.invitee_email, subject: 'A slot opened up', html: '<p>A spot is now available — book it before it fills.</p>' });
  }
  res.json({ ok: true });
}));

const pollSchema = Joi.object({
  owner_type: Joi.string().valid('user', 'home', 'business'),
  owner_id: Joi.string(),
  title: Joi.string().trim().min(1).max(200).required(),
  description: Joi.string().allow('', null).max(2000),
  duration_min: Joi.number().integer().min(5).max(1440).default(30),
  options: Joi.array().items(Joi.object({ start: Joi.string().isoDate().required(), end: Joi.string().isoDate().required() })).min(1).max(20).required(),
});
router.post('/polls', withOwner('edit'), validate(pollSchema), asyncHandler(async (req, res) => {
  const { data: poll, error } = await supabaseAdmin.from('SchedulingPoll').insert({ ...req.scheduling.oc, title: req.body.title, description: req.body.description || null, duration_min: req.body.duration_min, created_by: req.user.id }).select('*').single();
  if (error) throw error;
  const options = req.body.options.map((o) => ({ poll_id: poll.id, start_at: o.start, end_at: o.end }));
  const { data: opts, error: optErr } = await supabaseAdmin.from('SchedulingPollOption').insert(options).select('*');
  if (optErr) {
    // A poll without its options is unusable and unfixable from the client (options are only
    // written here) — roll back the parent rather than 201-ing a half-created poll.
    await supabaseAdmin.from('SchedulingPoll').delete().eq('id', poll.id);
    throw optErr;
  }
  res.status(201).json({ poll, options: opts || [] });
}));
router.get('/polls', withOwner('view'), asyncHandler(async (req, res) => {
  const { data } = await supabaseAdmin.from('SchedulingPoll').select('*').eq('owner_type', req.scheduling.ownerType).eq('owner_id', req.scheduling.ownerId).order('created_at', { ascending: false });
  res.json({ polls: data || [] });
}));
router.get('/polls/:id', asyncHandler(async (req, res) => {
  const { data: poll } = await supabaseAdmin.from('SchedulingPoll').select('*').eq('id', req.params.id).maybeSingle();
  if (!poll) return res.status(404).json({ error: 'NOT_FOUND' });
  await assertCanManageOwner(poll.owner_type, poll.owner_id, req.user.id, 'view');
  const [{ data: options }, { data: votes }] = await Promise.all([
    supabaseAdmin.from('SchedulingPollOption').select('*').eq('poll_id', poll.id).order('start_at'),
    supabaseAdmin.from('SchedulingPollVote').select('option_id, voter_name, value').eq('poll_id', poll.id),
  ]);
  res.json({ poll, options: options || [], votes: votes || [] });
}));
// Team availability (business round-robin pool) — per-member free grids.
router.get('/team-availability', withOwner('view'), asyncHandler(async (req, res) => {
  if (req.scheduling.ownerType !== 'business') return res.status(400).json({ error: 'BUSINESS_ONLY' });
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'MISSING_RANGE', message: 'from and to are required.' });
  const { data: team } = await supabaseAdmin.from('BusinessTeam').select('user_id').eq('business_user_id', req.scheduling.ownerId).eq('is_active', true);
  const memberIds = [...new Set((team || []).map((m) => m.user_id))];
  const probe = { default_duration: 30, slot_interval_min: 30, buffer_before_min: 0, buffer_after_min: 0, min_notice_min: 0, max_horizon_days: 365, assignment_mode: 'one_on_one', schedule_id: null };
  const freeByMember = {};
  for (const id of memberIds) {
    freeByMember[id] = await availabilityService.computeSlots({ ownerType: 'user', ownerId: id, eventType: probe, from, to, viewerTimezone: req.query.tz });
  }
  res.json({ members: memberIds, freeByMember });
}));

router.post('/polls/:id/finalize', validate(Joi.object({ option_id: Joi.string().uuid().required() })), asyncHandler(async (req, res) => {
  const { data: poll } = await supabaseAdmin.from('SchedulingPoll').select('*').eq('id', req.params.id).maybeSingle();
  if (!poll) return res.status(404).json({ error: 'NOT_FOUND' });
  await assertCanManageOwner(poll.owner_type, poll.owner_id, req.user.id, 'edit');
  const { data: opt } = await supabaseAdmin.from('SchedulingPollOption').select('*').eq('id', req.body.option_id).eq('poll_id', poll.id).maybeSingle();
  if (!opt) return res.status(404).json({ error: 'OPTION_NOT_FOUND' });
  const { data: updated } = await supabaseAdmin.from('SchedulingPoll').update({ status: 'closed', finalized_start_at: opt.start_at, updated_at: new Date().toISOString() }).eq('id', poll.id).select('*').single();
  res.json({ poll: updated, finalized_start_at: opt.start_at });
}));

module.exports = router;
// Exposed for unit tests (see tests/unit/schedulingLogic.test.js).
module.exports._internal = { ensurePage, findPage };
