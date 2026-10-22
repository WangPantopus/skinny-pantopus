'use strict';

/**
 * "Plans you'd like" (docs/product/ai-assistant-phase3-contract-2026-10-22.md §10.1). A person
 * who asked Pantopus to tell them when a kind of plan is posted near them has a plan_alert
 * memory item ({ plan_kinds, within_miles }). When such a plan is posted, they get a
 * plan_you_like nudge with an Ask to join card, if:
 *   - their home is within `within_miles` of the plan's public area point;
 *   - they aren't the host or already in it, and they can see it and ask to join, as the
 *     viewer (the plan service's own visibility and eligibility: blocks either way, playdates);
 *   - every nudge rule allows it (Suggestions on, two a day, quiet hours, "Fewer like this"),
 *     and they had no plan_you_like yet today.
 * The nudge names the area, never the place. Runs in the 5-minute Plans tick (jobs/planJobs.js),
 * after the phase 2 nudges; deleting the memory item stops the alerts.
 */

const { DateTime } = require('luxon');
const supabaseAdmin = require('../../../config/supabaseAdmin');
const logger = require('../../../utils/logger');
const planService = require('../../plans/planService');
const { loadViewer } = require('../../plans/planViewer');
const { haversineMeters } = require('../../../utils/geo');
const { isAssistantOff } = require('../assistantBudget');
const { userTimeZone } = require('../chatContext');
const { KIND_LABELS } = require('../actionCards');
const { zoneOr } = require('../assistantKit');

/** The nudge engine, required when used (it loads the push services). */
const engine = () => require('./engine');

const KIND = 'plan_you_like';
const POSTED_WITHIN_MS = 15 * 60 * 1000;
const PEOPLE_PER_PLAN = 300;
const PLANS_PER_TICK = 50;
const METERS_PER_MILE = 1609.344;

async function newPlans(now) {
  const { data, error } = await supabaseAdmin.from('Plan')
    .select(planService.PLAN_SELECT)
    .eq('status', 'open')
    .gte('created_at', new Date(now - POSTED_WITHIN_MS).toISOString())
    .order('created_at', { ascending: true })
    .limit(PLANS_PER_TICK);
  if (error) throw new Error(`New plans read failed: ${error.message}`);
  return (data || []).filter((plan) => Date.parse(planService.startsAt(plan)) > now);
}

/** The alerts for this kind of plan, one per person (the widest distance they asked for). */
async function alertsFor(kind) {
  const { data, error } = await supabaseAdmin.from('AgentMemoryItem')
    .select('id, user_id, home_id, structured')
    .eq('kind', 'plan_alert')
    .contains('structured', { plan_kinds: [kind] })
    .order('created_at', { ascending: true })
    .limit(PEOPLE_PER_PLAN);
  if (error) throw new Error(`Plan alerts read failed: ${error.message}`);
  const byUser = new Map();
  for (const alert of data || []) {
    const miles = Number(alert.structured?.within_miles) || 3;
    const known = byUser.get(alert.user_id);
    if (!known || miles > known.miles) byUser.set(alert.user_id, { ...alert, miles });
  }
  return [...byUser.values()];
}

/** How far their home (the alert's, else any) is from the plan's area, in miles; null without a home point. */
function milesFromHome(viewer, alert, area) {
  const homes = viewer.homes.filter((home) => home.point && (!alert.home_id || home.id === alert.home_id));
  const pool = homes.length ? homes : viewer.homes.filter((home) => home.point);
  const distances = pool.map((home) => haversineMeters(home.point.latitude, home.point.longitude, area.latitude, area.longitude) / METERS_PER_MILE);
  return distances.length ? Math.min(...distances) : null;
}

/** Whether they already had a plan_you_like today, in their time zone (at most one a day). */
async function hadOneToday(userId, timeZone) {
  const midnight = DateTime.now().setZone(zoneOr(timeZone)).startOf('day').toUTC().toISO();
  const { data, error } = await supabaseAdmin.from('Notification')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'assistant_nudge')
    .eq('metadata->>kind', KIND)
    .gte('created_at', midnight)
    .limit(1);
  if (error) throw new Error(`Day count failed: ${error.message}`);
  return Boolean(data && data.length);
}

function distanceWords(miles) {
  if (miles < 0.75) return 'under a mile away';
  if (miles < 1.5) return 'about 1 mile away';
  return `about ${Math.round(miles)} miles away`;
}

function bodyOf(detail, miles, timeZone) {
  const start = detail.starts_at ? DateTime.fromISO(detail.starts_at, { zone: 'utc' }).setZone(zoneOr(timeZone)) : null;
  const spots = Number.isInteger(detail.spots_left) ? `${detail.spots_left} ${detail.spots_left === 1 ? 'spot' : 'spots'} left` : null;
  return [start && start.isValid ? start.toFormat('ccc h:mm a') : null, distanceWords(miles), spots].filter(Boolean).join(' · ');
}

/** One plan to one person who asked for its kind: sends at most one nudge. */
async function alertOne(plan, alert, area) {
  const userId = String(alert.user_id);
  if (userId === String(plan.host_user_id)) return false;
  const viewer = await loadViewer({ id: userId, role: null });
  const miles = milesFromHome(viewer, alert, area);
  if (miles == null || miles > alert.miles) return false;
  // As the viewer, through the plan service: visible to them, and theirs to ask (not in it, not blocked).
  const { body: detail } = await planService.getForViewer(plan.post_id, viewer);
  if (!detail || detail.viewer?.role !== 'none' || detail.my_request || !detail.viewer?.can_ask) return false;
  const subject = { type: 'plan', id: plan.post_id };
  const verdict = await engine().canNudge({ userId, kind: KIND, subject, checkpoint: 'new' });
  if (!verdict.ok) return false;
  const timeZone = await userTimeZone(userId);
  if (await hadOneToday(userId, timeZone)) return false;
  const expiresAt = new Date(detail.asking_closes_at || planService.startsAt(plan));
  const { card } = await engine().nudgeCard('draft_plan_ask', {
    plan_id: plan.post_id, party_size: 1, kids_count: null, kids_age_bands: null, ask_note: null, note: null,
  }, { userId, expiresAt });
  const result = await engine().sendNudge({
    userId,
    kind: KIND,
    subject,
    checkpoint: 'new',
    title: `${KIND_LABELS[plan.kind] || 'A plan'} near you`,
    body: bodyOf(detail, miles, timeZone),
    card: card || null,
    expiresAt,
  });
  if (!result.sent) logger.info('plans.alert.not_sent', { planId: plan.post_id, reason: result.reason });
  return Boolean(result.sent);
}

/** Every 5 minutes, in the Plans tick: plans posted in the last 15 minutes, to the people who asked for them. */
async function runPlanAlerts(now = Date.now()) {
  if (isAssistantOff()) return 0;
  let sent = 0;
  for (const plan of await newPlans(now)) {
    const area = planService.areaPoint(plan);
    if (!area) continue;
    let alerts;
    try {
      alerts = await alertsFor(plan.kind);
    } catch (err) {
      logger.warn('plans.alert.read_failed', { planId: plan.post_id, error: err.message });
      continue;
    }
    for (const alert of alerts) {
      try {
        if (await alertOne(plan, alert, area)) sent += 1;
      } catch (err) {
        logger.warn('plans.alert.failed', { planId: plan.post_id, userId: alert.user_id, error: err.message });
      }
    }
  }
  return sent;
}

module.exports = { runPlanAlerts, alertOne, bodyOf, distanceWords };
