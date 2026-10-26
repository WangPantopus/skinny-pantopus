'use strict';

/**
 * Standing rules (docs/product/ai-assistant-phase3-contract-2026-10-22.md §18), approved by the
 * founder on October 22: the one exception to "every action waits for a tap". The person reads a
 * rule's exact terms on a rule_save card and turns it on with one tap; from then on Pantopus does
 * that one thing on its own, within the rule's limits, and tells them.
 *
 * Two kinds. plan_repeat posts next week's plan once a week's plan has ended (the 5-minute Plans
 * tick), through planActions.createPlan as the host, so every Plans check and limit holds; it
 * reposts only at the host's home or within 3 miles of it, because a repost has no location fix.
 * pickup_reminder sends a household member the evening briefing's pickup push the evening before
 * each pickup day the household set (hourly), never for a city schedule nobody confirmed.
 *
 * Policy code runs them: the model only drafts the card and never decides a run, and while the
 * assistant is switched off, rules wait. A rule is saved only from its card as stored
 * (agentRecord.js), never from a request body. Each run is an AgentRequest (origin rule) with one
 * action step: those rows are the rule's history, kept a year (jobs/assistantAgentPurge.js).
 */

const crypto = require('crypto');
const { DateTime } = require('luxon');
const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const { resolveHomeTimezone, validTimezone } = require('../../utils/timezone');
const { localDisplayNames } = require('../../utils/identityProfiles');
const planService = require('../plans/planService');
const planActions = require('../plans/planActions');
const planRules = require('../plans/planRules');
const { repeatDetailsForViewer } = require('../plans/planGames');
const homeRecordService = require('../homeRecordService');
const homeDetailService = require('../homeDetailService');
const { composeForHomeId } = require('../addressCalendarService');
const { buildTomorrowPickupSignal } = require('../context/eveningBriefingService');
const { card, action, line } = require('./actionCards');
const { linkFor } = require('./appGuide');
const { DEFAULT_TIMEZONE } = require('./llm');
const { isAssistantOff } = require('./assistantBudget');
const agentRecord = require('./agentRecord');
const { isUuid, clip, homesOf, zoneOr, firstNameOf } = require('./assistantKit');

const KINDS = ['plan_repeat', 'pickup_reminder'];
const LIMIT = 5;
const PLAN_LIMIT = 3;
const WEEKS = 12;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
// A plan that ended this recently can still be asked for every week.
const RECENT_MS = 7 * DAY_MS;
// The next post is at least a day away, or it skips to the week after.
const NOTICE_AHEAD_MS = DAY_MS;
const CARD_DAYS = 7;
const EVENING_DEFAULT = '19:00';
// The job runs hourly at :12, so a later evening time would be missed before midnight.
const EVENING_LATEST = '23:00';
const RUNS_SHOWN = 5;
const BATCH = 100;
// While a run works, its rule's next_run_at moves this far ahead, so another server skips it.
const PLAN_CLAIM_MS = 15 * 60 * 1000;
const PICKUP_CLAIM_MS = 30 * 60 * 1000;
const NOTICE_TYPE = 'assistant_rule';
const NOTICE_EXPIRES_MS = 7 * DAY_MS;
const RULE_FIELDS = 'id, user_id, home_id, kind, summary, config, enabled, paused_reason, ends_at, next_run_at, last_run_at, run_count, source_request_id, created_at, updated_at';
const RUN_FIELDS = 'id, rule_id, status, summary, subject, outcome, created_at';
const HHMM = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const PLAN_NOUNS = { watch_party: 'watch party', pickup_game: 'pickup game', walk_coffee: 'walk', study_group: 'study group', playdate: 'playdate' };
const PICKUP_WORDS = { garbage: 'garbage', recycling: 'recycling', yard_waste: 'yard waste', bulk_pickup: 'bulk items' };
const PLAN_WARNING = 'Pantopus posts it each week without asking. People nearby see it on the map, and its entry rules let people in as they do now.';
const NOT_NEAR = "This plan's place is more than about 3 miles from their home. Pantopus posts a weekly plan without a location fix, so it can repeat one only at their home or within 3 miles of it. Say so in a sentence; no rule card.";

class RuleError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const rulesLink = () => linkFor('rules_settings');
const iso = (value) => (value ? new Date(value).toISOString() : null);
const inZone = (value, zone) => DateTime.fromISO(new Date(value).toISOString(), { zone: 'utc' }).setZone(zoneOr(zone));
const shortDay = (at) => at.toFormat('ccc LLL d');

// ─── Weekly times ──────────────────────────────────────────────────────────

/** A weekly plan's time slot, from one of its occurrences: { latest_plan_id, weekday, start_local, duration_minutes, timezone }. */
function slotOf(plan) {
  const zone = zoneOr(plan.timezone);
  const start = inZone(plan.post.event_date, zone);
  const end = inZone(plan.post.event_end_date, zone);
  return {
    latest_plan_id: plan.post_id,
    weekday: start.weekday,
    start_local: start.toFormat('HH:mm'),
    duration_minutes: Math.round(end.diff(start, 'minutes').minutes),
    timezone: zone,
  };
}

function validSlot(config) {
  return Boolean(config) && isUuid(config.latest_plan_id) && Number.isInteger(config.weekday) && config.weekday >= 1 && config.weekday <= 7
    && HHMM.test(String(config.start_local)) && Number.isInteger(config.duration_minutes)
    && config.duration_minutes >= 15 && config.duration_minutes <= 8 * 60 && Boolean(validTimezone(config.timezone));
}

/** The first occurrence of the slot strictly after `afterMs`, in the plan's time zone. */
function occurrenceAfter(config, afterMs) {
  const [hour, minute] = String(config.start_local).split(':').map(Number);
  let at = DateTime.fromMillis(afterMs, { zone: zoneOr(config.timezone) }).startOf('day').set({ hour, minute });
  at = at.plus({ days: (config.weekday - at.weekday + 7) % 7 });
  if (at.toMillis() <= afterMs) at = at.plus({ weeks: 1 });
  return at;
}

/** The last occurrence that starts by `endsMs`: what the card's Until shows. */
function lastBy(config, endsMs) {
  const at = occurrenceAfter(config, endsMs - WEEK_MS);
  return at.toMillis() > endsMs ? at.minus({ weeks: 1 }) : at;
}

function timeRange(start, end) {
  const oneHalf = start.toFormat('a') === end.toFormat('a') && start.hasSame(end, 'day');
  return `${start.toFormat(oneHalf ? 'h:mm' : 'h:mm a')}–${end.toFormat('h:mm a')}`;
}

/** What a weekly plan's card and list say: "Post 'Pickup game' every Saturday, 9:00–10:30 AM, at Crown Park". */
function planSentence(plan, config) {
  const start = occurrenceAfter(config, Date.now());
  const where = plan.place_kind === 'home' ? 'your place' : clip(plan.place_name, 60) || clip(plan.area_label, 60) || 'the same place';
  return clip(`Post '${clip(plan.post.title, 80)}' every ${WEEKDAYS[config.weekday - 1]}, ${timeRange(start, start.plus({ minutes: config.duration_minutes }))}, at ${where}`, 200);
}

const untilLabel = (config, endsMs) => `${lastBy(config, endsMs).toFormat('ccc, LLL d')} (${WEEKS} weeks)`;

/**
 * The next week's plan, copied from the latest occurrence with new times (the host's edits carry forward).
 * No hosted_again_from: the funnel's "hosted again" counts a host choosing to host again, not a rule's repost.
 */
async function repostInput(latest, start, end, user) {
  const details = await repeatDetailsForViewer(latest.kind, latest.details, start.toMillis(), user);
  return {
    kind: latest.kind,
    title: latest.post.title,
    about: latest.post.content || null,
    guest_note: latest.guest_note || null,
    starts_at: start.toUTC().toISO(),
    ends_at: end.toUTC().toISO(),
    spots: latest.spots,
    place: latest.place_kind === 'home'
      ? { kind: 'home', home_id: latest.place_home_id }
      : {
        kind: 'public', name: latest.place_name, address: latest.place_address,
        latitude: Number(latest.place_latitude), longitude: Number(latest.place_longitude),
      },
    auto_rules: Array.isArray(latest.auto_rules) ? latest.auto_rules : [],
    join_requirement: latest.join_requirement,
    details,
  };
}

/**
 * The Plans checks for a repost, as the host with no location fix (previewPlan runs createPlan's own
 * checks). The limits on upcoming plans are left to each post: the plan being repeated still counts now.
 */
async function checkRepost(user, plan, config) {
  const start = occurrenceAfter(config, Date.now() + HOUR_MS);
  try {
    await planActions.previewPlan(user, await repostInput(plan, start, start.plus({ minutes: config.duration_minutes }), user));
    return {};
  } catch (err) {
    if (!(err instanceof planActions.PlanError)) throw err;
    if (err.code === 'too_many_plans') return {};
    if (err.code === 'not_near') return { error: NOT_NEAR, reason: "This plan's place is more than 3 miles from your home, so Pantopus can't post it for you." };
    return { error: `It can't be posted again as it is: ${err.message} Say so; no rule card.`, reason: err.message };
  }
}

// ─── Households ────────────────────────────────────────────────────────────

const deniedRead = (err) => [403, 404].includes(err?.statusCode) || [403, 404].includes(err?.status);

/** Whether the person who set a pickup reminder can still assign tasks at the home, and the member still lives there. */
async function householdStanding(setterId, homeId, memberId) {
  let collection;
  try {
    collection = await homeRecordService.listCollection({ homeId, actorId: setterId, kind: 'task' });
  } catch (err) {
    if (deniedRead(err)) return { ok: false, who: 'setter' };
    throw err;
  }
  if (!collection.can_create) return { ok: false, who: 'setter' };
  let occupants;
  try {
    ({ occupants } = await homeDetailService.members(homeId, setterId));
  } catch (err) {
    if (deniedRead(err)) return { ok: false, who: 'setter' };
    throw err;
  }
  const member = (occupants || []).find((o) => String(o.user_id) === String(memberId) && o.is_active !== false);
  if (!member) return { ok: false, who: 'member' };
  return { ok: true, name: firstNameOf({ name: member.display_name }) || 'Your household member' };
}

async function homeRow(homeId) {
  if (!isUuid(homeId)) return null;
  const { data, error } = await supabaseAdmin.from('Home')
    .select('id, name, city, location, map_center_lat, map_center_lng').eq('id', homeId).maybeSingle();
  if (error) throw new Error(`Home read failed: ${error.message}`);
  return data;
}

async function firstName(userId) {
  const names = await localDisplayNames([userId]).catch(() => new Map());
  return firstNameOf({ name: names.get(String(userId)) }) || 'Someone in your household';
}

// ─── Reading rules ─────────────────────────────────────────────────────────

async function readRules(userId) {
  const { data, error } = await supabaseAdmin.from('AgentRule').select(RULE_FIELDS)
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(LIMIT + 10);
  if (error) throw new Error(`Rules read failed: ${error.message}`);
  return data || [];
}

async function ownRule(userId, id) {
  const missing = new RuleError(404, 'RULE_NOT_FOUND', "That rule isn't one of yours.");
  if (!isUuid(id)) throw missing;
  const { data, error } = await supabaseAdmin.from('AgentRule').select(RULE_FIELDS).eq('id', id).eq('user_id', userId).maybeSingle();
  if (error) throw new Error(`Rule read failed: ${error.message}`);
  if (!data) throw missing;
  return data;
}

/** The last runs of each rule, newest first: { at, status, label, link }, with how many are going to a posted plan. */
async function runsOf(rules) {
  const byRule = new Map();
  // One read per rule (a person has at most five), so a busy rule never crowds out an older one's runs.
  await Promise.all(rules.map(async (rule) => {
    const { data, error } = await supabaseAdmin.from('AgentRequest').select(RUN_FIELDS)
      .eq('rule_id', rule.id).eq('origin', 'rule').order('created_at', { ascending: false }).limit(RUNS_SHOWN);
    if (error) throw new Error(`Rule runs read failed: ${error.message}`);
    byRule.set(rule.id, data || []);
  }));
  const shown = [...byRule.values()].flat();
  const planIds = [...new Set(shown.map((run) => run.outcome?.plan_id).filter(isUuid))];
  const [steps, plans, going] = await Promise.all([
    shown.length
      ? supabaseAdmin.from('AgentStep').select('request_id, status').in('request_id', shown.map((run) => run.id)).eq('type', 'action')
      : { data: [] },
    planService.loadPlanRows(planIds),
    planIds.length
      ? supabaseAdmin.from('PlanRequest').select('post_id, party_size').in('post_id', planIds).eq('status', 'accepted')
      : { data: [] },
  ]);
  if (steps.error) throw new Error(`Rule run steps read failed: ${steps.error.message}`);
  if (going.error) throw new Error(`Rule run plans read failed: ${going.error.message}`);
  const stepStatus = new Map((steps.data || []).map((step) => [step.request_id, step.status]));
  const planById = new Map(plans.map((plan) => [plan.post_id, plan]));
  const seats = new Map();
  for (const request of going.data || []) {
    const plan = planById.get(request.post_id);
    seats.set(request.post_id, (seats.get(request.post_id) || 0) + planRules.seatsFor(plan?.kind, request.party_size));
  }
  for (const [ruleId, list] of byRule) {
    byRule.set(ruleId, list.map((run) => {
      const planId = run.outcome?.plan_id;
      const plan = isUuid(planId) ? planById.get(planId) : null;
      let label = run.summary || (run.status === 'done' ? 'Done' : "Couldn't run");
      if (plan) label += plan.status === 'cancelled' ? ' · cancelled' : ` · ${seats.get(planId) || 0} going`;
      return {
        at: iso(run.created_at),
        status: stepStatus.get(run.id) || (run.status === 'done' ? 'done' : 'error'),
        label,
        link: plan ? linkFor('plan', plan.post_id) : null,
      };
    }));
  }
  return byRule;
}

function ruleView(row, runs = []) {
  return {
    id: row.id,
    kind: row.kind,
    summary: row.summary,
    enabled: row.enabled,
    paused_reason: row.paused_reason || null,
    ends_at: iso(row.ends_at),
    next_run_at: row.enabled ? iso(row.next_run_at) : null,
    runs,
  };
}

async function viewsOf(rows) {
  const runs = await runsOf(rows);
  return rows.map((row) => ruleView(row, runs.get(row.id) || []));
}

/** GET /api/ai/rules (§18.5): every rule of theirs, newest first, with its last 5 runs. */
async function listRules(userId) {
  return { rules: await viewsOf(await readRules(userId)), limit: LIMIT };
}

// ─── The cards and the tools ───────────────────────────────────────────────

function cardResult(draft, note, closing) {
  const text = clip(note, 300);
  return { draftType: 'action', draft: { ...draft, note: text }, valid: true, note: text, closing };
}

/** A rule_save card. `rule` is what turning it on stores; the app shows the lines. */
function ruleCard({ lines, warning, rule }) {
  const draft = card('rule_save', {
    title: 'Do this on its own?',
    lines,
    warnings: [warning],
    actions: [],
    expiresAt: new Date(Date.now() + CARD_DAYS * DAY_MS).toISOString(),
  });
  draft.actions.push(action('turn_on', 'Turn on', { method: 'POST', path: '/api/ai/rules', body: { card_id: draft.id } }, { label: 'On', link: rulesLink() }));
  draft.rule = rule;
  return draft;
}

function sameRule(row, rule) {
  if (row.kind !== rule.kind) return false;
  if (rule.kind === 'plan_repeat') return row.config?.latest_plan_id === rule.config.latest_plan_id;
  return row.home_id === rule.home_id && row.config?.member_user_id === rule.config.member_user_id;
}

function limitReached(rows, kind) {
  if (rows.length >= LIMIT) return `Pantopus can do ${LIMIT} things for you at a time. Delete one in Settings first.`;
  if (kind === 'plan_repeat' && rows.filter((row) => row.kind === 'plan_repeat').length >= PLAN_LIMIT) {
    return `Pantopus can post ${PLAN_LIMIT} weekly plans for you at a time. Delete one in Settings first.`;
  }
  return null;
}

function alreadyThere(row) {
  return row.enabled
    ? { message: 'This rule is already on. Say so; no card. They see it in Settings → What Pantopus does for you (rules_settings).' }
    : { message: `They already have this rule, switched off${row.paused_reason ? ` (it paused: ${row.paused_reason})` : ''}. Offer to turn it back on with draft_rule_change instead.` };
}

async function draftPlanRule(args, ctx) {
  if (ctx.plansEnabled === false) return { error: "Plans aren't available for this person yet." };
  if (!isUuid(args.plan_id)) return { error: 'plan_id must be a plan they host, from the screen context or find_plans.' };
  const plan = await planService.loadPlanRow(args.plan_id);
  if (!plan || String(plan.host_user_id) !== String(ctx.userId)) return { error: 'Only a plan they host can repeat. Use find_plans for the plans they host.' };
  if (plan.status === 'cancelled') return { error: 'That plan was cancelled. Say so: they can host it again, then ask for it every week.' };
  if (Date.parse(plan.post.event_end_date) < Date.now() - RECENT_MS) {
    return { error: 'That plan ended more than a week ago. Say so: they can host it again, then ask for it every week.' };
  }
  const config = slotOf(plan);
  const rows = await readRules(ctx.userId);
  const rule = { kind: 'plan_repeat', home_id: null, config };
  const same = rows.find((row) => sameRule(row, rule));
  if (same) return alreadyThere(same);
  const full = limitReached(rows, 'plan_repeat');
  if (full) return { error: `${full} Say so, and link rules_settings.` };
  const checked = await checkRepost({ id: ctx.userId, role: ctx.user?.role || null }, plan, config);
  if (checked.error) return { error: checked.error };
  const endsAt = Date.now() + WEEKS * WEEK_MS;
  const what = planSentence(plan, config);
  const draft = ruleCard({
    lines: [line('What', what), line('Until', untilLabel(config, endsAt))],
    warning: PLAN_WARNING,
    rule: { ...rule, summary: what, ends_at: new Date(endsAt).toISOString() },
  });
  return cardResult(draft, args.note, 'Tap Turn on, and Pantopus posts it each week and tells you each time.');
}

async function draftPickupRule(args, ctx) {
  const own = 'No rule for their own pickup nights: their evening briefing reminds them the night before each pickup day their household set. Check get_notification_settings, and if it is off, offer draft_notification_settings to turn it on. No rule card.';
  if (args.member_user_id === ctx.userId) return { message: own };
  if (!isUuid(args.member_user_id)) return { error: `member_user_id must be another household member, from get_household. ${own}` };
  const { homes, defaultHomeId } = await homesOf(ctx.userId);
  const home = args.home_id != null
    ? homes.find((candidate) => candidate.id === args.home_id)
    : homes.find((candidate) => candidate.id === defaultHomeId) || homes[0];
  if (!home) return { error: args.home_id != null ? 'That home is not one of theirs. Use a home id from the context, or null.' : 'They have no home in Pantopus yet. Say so; no card.' };
  const standing = await householdStanding(ctx.userId, home.id, args.member_user_id);
  if (!standing.ok) {
    return standing.who === 'setter'
      ? { error: "They can't assign tasks at this home, and only someone who can may set a household member's reminder. Say so; no card." }
      : { error: "That person isn't an active member of this household. Use get_household for the members." };
  }
  let calendar;
  try {
    calendar = await composeForHomeId(home.id, { userId: args.member_user_id });
  } catch {
    return { error: `${standing.name} can't see this home's calendar, so Pantopus can't remind them. Say so; no card.` };
  }
  const kinds = (calendar.pickup_schedule?.collections || []).map((collection) => collection.kind).filter((kind) => PICKUP_WORDS[kind]);
  if (!kinds.length) {
    return {
      message: "Their household hasn't set its pickup days, and Pantopus never reminds anyone from a city schedule nobody confirmed. Offer to set the pickup days first (draft_pickup_schedule when they say the days); no rule card yet.",
    };
  }
  const rows = await readRules(ctx.userId);
  const rule = { kind: 'pickup_reminder', home_id: home.id, config: { member_user_id: args.member_user_id, kinds } };
  const same = rows.find((row) => sameRule(row, rule));
  if (same) return alreadyThere(same);
  const full = limitReached(rows, 'pickup_reminder');
  if (full) return { error: `${full} Say so, and link rules_settings.` };
  const label = homes.length > 1 ? clip(home.city, 60) : null;
  const what = `Remind ${standing.name} the night before pickup`;
  const draft = ruleCard({
    lines: [
      line('What', what),
      line('Who', standing.name),
      line('When', 'The night before each pickup day your household set'),
      label ? line('Home', label) : null,
    ],
    warning: `${standing.name} gets a reminder each pickup night and sees that you set it.`,
    rule: { ...rule, summary: clip(`Remind ${standing.name} the night before each pickup day${label ? ` (${label})` : ''}`, 200), ends_at: null },
  });
  return cardResult(draft, args.note, `Tap Turn on, and Pantopus reminds ${standing.name} each pickup night.`);
}

async function draftRule(args, ctx) {
  if (args.kind === 'plan_repeat') return draftPlanRule(args, ctx);
  if (args.kind === 'pickup_reminder') return draftPickupRule(args, ctx);
  return { error: `kind must be one of ${KINDS.join(', ')}.` };
}

/** Whether a rule could run if turned on now: null, or why not (in the person's words). */
async function whyItCantRun(row, user) {
  if (row.kind === 'plan_repeat') {
    const plan = validSlot(row.config) ? await planService.loadPlanRow(row.config.latest_plan_id) : null;
    if (!plan || String(plan.host_user_id) !== String(row.user_id)) return "The plan it copies isn't available anymore. Ask Pantopus again from a plan you host.";
    return (await checkRepost(user, plan, row.config)).reason || null;
  }
  const standing = await householdStanding(row.user_id, row.home_id, row.config?.member_user_id);
  if (standing.ok) return null;
  return standing.who === 'setter' ? "You can't assign tasks at this home anymore." : "They aren't in your household anymore.";
}

async function draftRuleChange(args, ctx) {
  let row;
  try {
    row = await ownRule(ctx.userId, args.rule_id);
  } catch (err) {
    if (err instanceof RuleError) return { error: 'That is not one of their rules. Use list_rules for the id.' };
    throw err;
  }
  const enabled = args.enabled === true;
  if (row.enabled === enabled) return { message: `It is already ${enabled ? 'on' : 'off'}. Say so; no card.` };
  if (enabled) {
    const why = await whyItCantRun(row, { id: ctx.userId, role: ctx.user?.role || null });
    if (why) return { error: `It can't be turned back on: ${why} Say so; no card.` };
  }
  const extends_ = enabled && row.kind === 'plan_repeat' && !(Date.parse(row.ends_at) > Date.now());
  const draft = card('rule_change', {
    title: enabled ? 'Turn this back on?' : 'Turn this off?',
    lines: [
      line('What', row.summary),
      extends_ && validSlot(row.config) ? line('Until', untilLabel(row.config, Date.now() + WEEKS * WEEK_MS)) : null,
    ],
    warnings: enabled ? [row.kind === 'plan_repeat' ? PLAN_WARNING : 'They get a reminder each pickup night and see that you set it.'] : [],
    actions: [],
  });
  draft.actions.push(action(enabled ? 'turn_on' : 'turn_off', enabled ? 'Turn on' : 'Turn off',
    { method: 'PATCH', path: `/api/ai/rules/${row.id}`, body: { enabled } }, { label: enabled ? 'On' : 'Off', link: rulesLink() }));
  return cardResult(draft, args.note, enabled ? 'Tap Turn on, and Pantopus picks it up again.' : 'Tap Turn off, and Pantopus stops.');
}

const PAUSED_WORDS = {
  nobody_came: 'paused: nobody joined two weeks in a row',
  cannot_post: "paused: Pantopus couldn't post it",
  ended: 'ended: its 12 weeks are up (Extend in Settings)',
  member_left: 'paused: that person left the household, or they can no longer assign tasks there',
};

async function listRulesTool(_args, ctx) {
  const rows = await readRules(ctx.userId);
  const runs = await runsOf(rows);
  return {
    rules: rows.map((row) => ({
      rule_id: row.id,
      kind: row.kind,
      summary_text: row.summary,
      state: row.enabled ? 'on' : (PAUSED_WORDS[row.paused_reason] || 'switched off by them'),
      ...(row.kind === 'plan_repeat' && row.ends_at && validSlot(row.config) ? { until: lastBy(row.config, Date.parse(row.ends_at)).toFormat('ccc, LLL d') } : {}),
      last_runs: (runs.get(row.id) || []).slice(0, 3).map((run) => run.label),
    })),
    limit: LIMIT,
    note: 'Their standing rules, in the words Pantopus wrote. To stop or restart one, draft_rule_change; to delete one or extend a weekly plan, Settings → What Pantopus does for you (rules_settings).',
  };
}

const nullable = (schema) => ({ ...schema, type: [schema.type, 'null'] });
const NOTE = 'One short sentence shown under the card, or null. Nothing starts until they tap Turn on, so never write as if it were already on.';

const ruleToolDefinitions = [
  {
    name: 'draft_rule',
    description: 'Offer a standing rule as a card they tap, only when they ask for something to happen every time ("post this every Saturday", "keep posting it", "remind Sam the night before pickup"). plan_repeat posts a plan they host again each week, with the same details on the plan\'s own weekday and time, for up to 12 weeks; it works only at their home or within 3 miles of it, which this tool checks (a card means it can). If they name another day or time, say it repeats the plan as it is (they can change the plan first). pickup_reminder reminds another household member the night before each pickup day the household set. Once they turn it on, Pantopus does it on its own and tells them. Never for accepting or declining people (each plan\'s own entry rules let people in), messages, money or anything else, and never for themselves: "remind me" before pickup is the evening briefing (draft_notification_settings).',
    input_schema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: KINDS },
        plan_id: nullable({ type: 'string', description: 'plan_repeat: a plan they host, from the screen context or find_plans. Otherwise null.' }),
        home_id: nullable({ type: 'string', description: 'pickup_reminder: the home (a home id from the context), or null for their default home.' }),
        member_user_id: nullable({ type: 'string', description: 'pickup_reminder: the household member to remind, from get_household. Otherwise null.' }),
        note: { type: ['string', 'null'], description: NOTE },
      },
      required: ['kind', 'plan_id', 'home_id', 'member_user_id', 'note'],
      additionalProperties: false,
    },
  },
  {
    name: 'draft_rule_change',
    description: 'Switch one of their standing rules off or back on ("stop posting the pickup game", "turn the reminder back on"), as a card they tap. The id comes from list_rules.',
    input_schema: {
      type: 'object',
      properties: {
        rule_id: { type: 'string' },
        enabled: { type: 'boolean', description: 'false to switch it off, true to turn it back on.' },
        note: { type: ['string', 'null'], description: 'One short sentence shown under the card, or null. Nothing changes until they tap.' },
      },
      required: ['rule_id', 'enabled', 'note'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_rules',
    description: 'What Pantopus does for them on its own: their standing rules, each on or off, with its last runs ("what are you doing for me?").',
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
];
const RULE_CARD_TOOLS = new Set(['draft_rule', 'draft_rule_change']);
const RULE_TOOL_NAMES = new Set(ruleToolDefinitions.map((tool) => tool.name));

async function runRuleTool(name, args, ctx) {
  const run = { draft_rule: draftRule, draft_rule_change: draftRuleChange, list_rules: listRulesTool }[name];
  if (!run) return null;
  try {
    return await run(args || {}, ctx);
  } catch (err) {
    logger.warn('assistant rule tool failed', { tool: name, userId: ctx.userId, error: err?.message });
    return { error: `That couldn't be done just now (${name}). Ask them to try again in a moment.` };
  }
}

// ─── Notices ───────────────────────────────────────────────────────────────

/**
 * An assistant_rule notice: plain text written from facts, held through quiet hours and released
 * with the nudges (dropped only once it expires). Never throws.
 */
async function notify(userId, { title, body, link, key, ruleId, kind, expiresAt = Date.now() + NOTICE_EXPIRES_MS, metadata = {}, push = true }) {
  try {
    const notificationService = require('../notificationService');
    const row = await notificationService.createNotification({
      userId,
      type: NOTICE_TYPE,
      title: clip(title, 120),
      body: clip(body, 300),
      icon: '✨',
      link,
      metadata: { kind, rule_id: ruleId, expires_at: new Date(expiresAt).toISOString(), push_deferred_until: null, push_sent_at: null, ...metadata },
      idempotencyKey: key,
      sendPush: false,
    });
    if (row && push) {
      const { pushNudge } = require('./nudges/engine');
      await require('../heldPushes').pushOrHold(row, { send: pushNudge, fallbackTz: DEFAULT_TIMEZONE });
    }
    return row;
  } catch (err) {
    logger.warn('rules.notice_failed', { ruleId, kind, error: err.message });
    return null;
  }
}

/** One run in the rule's history: an AgentRequest (origin rule) with one action step. Never throws. */
async function recordRun(rule, { ok, name, summary, subject = null, outcome = {}, ref = null, error = null }) {
  const id = crypto.randomUUID();
  const at = new Date().toISOString();
  const written = await agentRecord.insertRequest({
    id,
    user_id: rule.user_id,
    rule_id: rule.id,
    home_id: rule.home_id || null,
    origin: 'rule',
    kind: rule.kind,
    status: ok ? 'done' : 'couldnt',
    summary: clip(summary, 200),
    subject,
    outcome: ok ? outcome : { ...outcome, error: clip(error || 'error', 60) },
    created_at: at,
    updated_at: at,
    closed_at: at,
  });
  if (!written) return;
  await agentRecord.insertSteps([{
    request_id: id,
    user_id: rule.user_id,
    seq: 1,
    type: 'action',
    name,
    label: clip(summary, 120),
    status: ok ? 'done' : 'error',
    result: ref ? { ref } : {},
    error: ok ? null : clip(error || 'error', 200),
  }]);
}

/** A rule stops on its own: switched off with why, and the person is told. */
async function pause(rule, reason, notice) {
  const at = new Date().toISOString();
  const { data, error } = await supabaseAdmin.from('AgentRule')
    .update({ enabled: false, paused_reason: reason, updated_at: at })
    .eq('id', rule.id).eq('enabled', true).select('id');
  if (error) throw new Error(`Rule pause failed: ${error.message}`);
  // Switched off or deleted meanwhile: the person already stopped it.
  if (!(data && data.length)) return;
  logger.info('rules.paused', { ruleId: rule.id, kind: rule.kind, reason });
  // One notice per run that paused it (the run's scheduled time, from before it was claimed).
  await notify(rule.user_id, {
    ...notice, link: rulesLink(), key: `rule:${rule.id}:paused:${reason}:${iso(rule.next_run_at) || at}`, ruleId: rule.id, kind: rule.kind,
  });
}

async function moveOn(rule, fields) {
  const { error } = await supabaseAdmin.from('AgentRule').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', rule.id);
  if (error) throw new Error(`Rule update failed: ${error.message}`);
}

// ─── Routes (§18.5) ────────────────────────────────────────────────────────

function storedRule(payload) {
  const rule = payload?.rule;
  if (!rule || !KINDS.includes(rule.kind) || !clip(rule.summary, 200) || !rule.config || typeof rule.config !== 'object') return null;
  if (rule.kind === 'plan_repeat' && !validSlot(rule.config)) return null;
  if (rule.kind === 'pickup_reminder' && !(isUuid(rule.home_id) && isUuid(rule.config.member_user_id))) return null;
  return rule;
}

/** When a rule next runs, from now: a weekly plan once its latest occurrence ends, a reminder at once (the job picks the evening). */
async function firstRunAt(kind, config, now = Date.now()) {
  if (kind !== 'plan_repeat') return new Date(now).toISOString();
  const latest = await planService.loadPlanRow(config.latest_plan_id);
  const end = latest ? Date.parse(latest.post.event_end_date) : now;
  return new Date(Math.max(end, now)).toISOString();
}

/** POST /api/ai/rules (§18.3): turn on the rule a rule_save card showed, from the card as stored. */
async function saveFromCard(userId, cardId, attempt = 0) {
  const unknown = new RuleError(404, 'CARD_UNKNOWN', 'Pantopus has no record of this card. Ask again.');
  if (!isUuid(cardId)) throw unknown;
  const { data: step, error } = await supabaseAdmin.from('AgentStep')
    .select('id, request_id, payload, result, updated_at')
    .eq('user_id', userId).eq('idempotency_key', cardId).eq('type', 'proposal').eq('name', 'rule_save')
    .maybeSingle();
  if (error) throw new Error(`Card read failed: ${error.message}`);
  if (!step) throw unknown;
  // A repeat answers with the rule the first tap turned on, while it is there.
  if (isUuid(step.result?.ref)) {
    const { data: earlier } = await supabaseAdmin.from('AgentRule').select(RULE_FIELDS).eq('id', step.result.ref).eq('user_id', userId).maybeSingle();
    if (earlier) return { status: 200, rule: (await viewsOf([earlier]))[0] };
  }
  const stored = storedRule(step.payload);
  if (!stored) throw unknown;
  const rows = await readRules(userId);
  const same = rows.find((row) => sameRule(row, stored));
  if (same) return { status: 200, rule: (await viewsOf([same]))[0] };
  const full = limitReached(rows, stored.kind);
  if (full) throw new RuleError(409, 'RULE_LIMIT', full);

  const now = Date.now();
  // At most 12 weeks after it is turned on: the card's own Until, or less when it was tapped later.
  const endsAt = stored.kind === 'plan_repeat'
    ? new Date(Math.min(Date.parse(stored.ends_at) || Infinity, now + WEEKS * WEEK_MS)).toISOString()
    : null;
  const at = new Date(now).toISOString();
  const { data: rule, error: insertError } = await supabaseAdmin.from('AgentRule').insert({
    user_id: userId,
    home_id: stored.kind === 'pickup_reminder' ? stored.home_id : null,
    kind: stored.kind,
    summary: clip(stored.summary, 200),
    config: stored.config,
    enabled: true,
    ends_at: endsAt,
    next_run_at: await firstRunAt(stored.kind, stored.config, now),
    source_request_id: step.request_id,
    created_at: at,
    updated_at: at,
  }).select(RULE_FIELDS).single();
  if (insertError) throw new Error(`Rule save failed: ${insertError.message}`);

  // Two taps at once: the first to mark the card keeps its rule, the other's is removed.
  const { data: marked, error: markError } = await supabaseAdmin.from('AgentStep')
    .update({ result: { ...(step.result || {}), ref: rule.id }, updated_at: at })
    .eq('id', step.id).eq('updated_at', step.updated_at).select('id');
  if (markError) logger.warn('rules.card_mark_failed', { userId, error: markError.message });
  if (!markError && !(marked && marked.length) && attempt < 2) {
    await supabaseAdmin.from('AgentRule').delete().eq('id', rule.id).eq('user_id', userId);
    return saveFromCard(userId, cardId, attempt + 1);
  }
  logger.info('rules.turned_on', { ruleId: rule.id, kind: rule.kind });
  if (rule.kind === 'pickup_reminder') {
    // The member is told once who asked, and where home reminders can be turned off.
    const setter = await firstName(userId);
    await notify(rule.config.member_user_id, {
      title: 'Pickup reminders',
      body: `${setter} asked Pantopus to remind you the night before pickup. You can turn off home reminders in Settings → Notifications.`,
      link: linkFor('notification_settings'),
      key: `rule:${rule.id}:told`,
      ruleId: rule.id,
      kind: 'pickup_reminder_set',
    });
  }
  return { status: 201, rule: (await viewsOf([rule]))[0] };
}

/**
 * PATCH /api/ai/rules/:id: { enabled } switches it off or on (turning it on checks again that it can
 * run); { extend: true } gives a weekly plan 12 more weeks from now, and turns one that ended back on.
 */
async function changeRule(user, id, { enabled, extend } = {}) {
  const row = await ownRule(user.id, id);
  if (extend && row.kind !== 'plan_repeat') throw new RuleError(400, 'RULE_NOT_EXTENDABLE', 'Only a weekly plan runs for a set time.');
  const now = Date.now();
  const turnOn = enabled === true || (enabled !== false && extend && row.paused_reason === 'ended');
  const fields = {};
  if (enabled === false) Object.assign(fields, { enabled: false, paused_reason: null });
  if (extend || (turnOn && row.kind === 'plan_repeat' && !(Date.parse(row.ends_at) > now))) {
    fields.ends_at = new Date(now + WEEKS * WEEK_MS).toISOString();
  }
  if (turnOn && !row.enabled) {
    const why = await whyItCantRun(row, user);
    if (why) throw new RuleError(409, 'RULE_CANNOT_RUN', why);
    Object.assign(fields, { enabled: true, paused_reason: null, next_run_at: await firstRunAt(row.kind, row.config, now) });
  }
  if (!Object.keys(fields).length) return { rule: (await viewsOf([row]))[0] };
  const { data, error } = await supabaseAdmin.from('AgentRule').update({ ...fields, updated_at: new Date(now).toISOString() })
    .eq('id', row.id).eq('user_id', user.id).select(RULE_FIELDS).single();
  if (error) throw new Error(`Rule change failed: ${error.message}`);
  return { rule: (await viewsOf([data]))[0] };
}

/** DELETE /api/ai/rules/:id: the rule and its runs; the plans it posted stay. */
async function deleteRule(userId, id) {
  const row = await ownRule(userId, id);
  const { error } = await supabaseAdmin.from('AgentRule').delete().eq('id', row.id).eq('user_id', userId);
  if (error) throw new Error(`Rule delete failed: ${error.message}`);
}

// ─── Weekly plans (§18.4), in the 5-minute Plans tick ──────────────────────

/** Rules that are due, each claimed by moving next_run_at ahead, so two servers never run one. */
async function claimDue(kind, now, leaseMs) {
  const { data, error } = await supabaseAdmin.from('AgentRule').select(RULE_FIELDS)
    .eq('kind', kind).eq('enabled', true).lte('next_run_at', new Date(now).toISOString())
    .order('next_run_at', { ascending: true }).limit(BATCH);
  if (error) throw new Error(`Due rules read failed: ${error.message}`);
  const mine = [];
  for (const rule of data || []) {
    const { data: claimed } = await supabaseAdmin.from('AgentRule')
      .update({ next_run_at: new Date(now + leaseMs).toISOString(), updated_at: new Date().toISOString() })
      .eq('id', rule.id).eq('enabled', true).eq('next_run_at', rule.next_run_at).select('id');
    if (claimed && claimed.length) mine.push(rule);
  }
  return mine;
}

/** A plan this host already posted at that start (a run that stopped after posting), or null. */
async function postedAt(hostId, kind, start) {
  const { data, error } = await supabaseAdmin.from('Plan')
    .select('post_id, post:Post!inner(event_date)')
    .eq('host_user_id', hostId).eq('kind', kind).eq('status', 'open')
    .eq('post.event_date', start.toUTC().toISO())
    .limit(1);
  if (error) throw new Error(`Posted plan read failed: ${error.message}`);
  return data && data[0] ? { id: data[0].post_id } : null;
}

/** Both of the last two occurrences ran with nobody but the host going. */
async function twoEmptyWeeks(latest, previousId) {
  if (!isUuid(previousId)) return false;
  const previous = await planService.loadPlanRow(previousId);
  if (!previous || [latest, previous].some((plan) => plan.status === 'cancelled')) return false;
  const { data, error } = await supabaseAdmin.from('PlanRequest').select('id')
    .in('post_id', [latest.post_id, previous.post_id]).eq('status', 'accepted').limit(1);
  if (error) throw new Error(`Plan requests read failed: ${error.message}`);
  return !(data && data.length);
}

async function runPlanRepeat(rule, now) {
  const config = rule.config || {};
  const latest = validSlot(config) ? await planService.loadPlanRow(config.latest_plan_id) : null;
  const noun = PLAN_NOUNS[latest?.kind] || 'plan';
  if (!latest || String(latest.host_user_id) !== String(rule.user_id)) {
    return pause(rule, 'cannot_post', {
      title: `Couldn't post your weekly ${noun}`, body: "The plan it copies isn't available anymore, so Pantopus paused it.",
    });
  }
  const latestEnd = Date.parse(latest.post.event_end_date);
  // Moved later by an edit: wait for it to end.
  if (latest.status !== 'cancelled' && latestEnd > now) return moveOn(rule, { next_run_at: new Date(latestEnd).toISOString() });
  const title = clip(latest.post.title, 80);
  let start = occurrenceAfter(config, now);
  if (start.toMillis() - now < NOTICE_AHEAD_MS) start = start.plus({ weeks: 1 });
  if (!(start.toMillis() <= Date.parse(rule.ends_at))) {
    return pause(rule, 'ended', {
      title: `Your weekly ${noun} has ended`,
      body: `Pantopus posted "${title}" for ${WEEKS} weeks. Extend it to keep it going.`,
    });
  }
  if (await twoEmptyWeeks(latest, config.previous_plan_id)) {
    return pause(rule, 'nobody_came', {
      title: `Paused: your weekly ${noun}`,
      body: `Nobody joined "${title}" two weeks in a row, so Pantopus stopped posting it. Turn it back on anytime.`,
    });
  }
  const end = start.plus({ minutes: config.duration_minutes });
  const day = shortDay(start);
  let posted = await postedAt(rule.user_id, latest.kind, start);
  if (!posted) {
    try {
      posted = await planActions.createPlan({ id: rule.user_id, role: null }, await repostInput(latest, start, end, { id: rule.user_id }));
    } catch (err) {
      if (!(err instanceof planActions.PlanError)) throw err;
      await recordRun(rule, { ok: false, name: 'plan_create', summary: `Couldn't post ${day}`, error: err.code });
      return pause(rule, 'cannot_post', { title: `Couldn't post your weekly ${noun}`, body: `${err.message} Pantopus paused it.` });
    }
  }
  await recordRun(rule, {
    ok: true, name: 'plan_create', summary: `Posted ${day}`, subject: { type: 'plan', id: posted.id }, outcome: { plan_id: posted.id }, ref: posted.id,
  });
  await moveOn(rule, {
    config: { ...config, latest_plan_id: posted.id, previous_plan_id: latest.post_id },
    next_run_at: end.toUTC().toISO(),
    last_run_at: new Date(now).toISOString(),
    run_count: (rule.run_count || 0) + 1,
  });
  await notify(rule.user_id, {
    title: `Posted: ${title}, ${day} at ${start.toFormat('h:mm a')}`,
    body: 'Open it to change or cancel it.',
    link: linkFor('plan', posted.id),
    key: `rule:${rule.id}:posted:${posted.id}`,
    ruleId: rule.id,
    kind: rule.kind,
    expiresAt: Math.min(start.toMillis(), now + NOTICE_EXPIRES_MS),
    metadata: { plan_id: posted.id },
  });
  return true;
}

/** Every 5 minutes (jobs/planJobs.js): post next week's plan for each weekly rule whose latest plan has ended. */
async function runPlanRepeats({ now = Date.now() } = {}) {
  // While the assistant is off nothing is claimed; rules wait.
  if (isAssistantOff()) return { claimed: 0, posted: 0 };
  const due = await claimDue('plan_repeat', now, PLAN_CLAIM_MS);
  let posted = 0;
  for (const rule of due) {
    try {
      if ((await runPlanRepeat(rule, now)) === true) posted += 1;
    } catch (err) {
      // The claim runs out and the next tick tries again.
      logger.warn('rules.plan_repeat_failed', { ruleId: rule.id, error: err.message });
    }
  }
  if (due.length) logger.info('rules.plan_repeats', { claimed: due.length, posted });
  return { claimed: due.length, posted };
}

// ─── Pickup reminders (§18.4), hourly ──────────────────────────────────────

async function memberPrefs(userId) {
  const { data, error } = await supabaseAdmin.from('UserNotificationPreferences')
    .select('evening_briefing_time_local, home_reminders_enabled, daily_briefing_timezone').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(`Preferences read failed: ${error.message}`);
  return data || {};
}

/** The member's own evening briefing already carried this pickup tonight: no second push. */
async function briefingCovered(userId, prefs, date, now) {
  const today = DateTime.fromMillis(now, { zone: validTimezone(prefs.daily_briefing_timezone) || 'UTC' }).toISODate();
  const { data } = await supabaseAdmin.from('DailyBriefingDelivery').select('signals_snapshot')
    .eq('user_id', userId).eq('briefing_date_local', today).eq('briefing_kind', 'evening').eq('status', 'sent').maybeSingle();
  return (Array.isArray(data?.signals_snapshot) ? data.signals_snapshot : []).some((signal) => signal?.data?.identity === `pickup:${date}`);
}

function pickupWords(kinds) {
  const words = kinds.map((kind) => PICKUP_WORDS[kind]).filter(Boolean);
  const joined = words.length <= 1 ? words[0] || 'Your bins' : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
  const plural = words.length !== 1 || kinds[0] === 'bulk_pickup';
  return `${joined[0].toUpperCase()}${joined.slice(1)} ${plural ? 'go' : 'goes'} out tonight.`;
}

async function runPickupReminder(rule, now) {
  const memberId = rule.config?.member_user_id;
  const home = await homeRow(rule.home_id);
  const standing = home ? await householdStanding(rule.user_id, rule.home_id, memberId) : { ok: false, who: 'member' };
  if (!standing.ok) {
    const member = await firstName(memberId);
    return pause(rule, 'member_left', {
      title: `Paused: pickup reminders for ${member}`,
      body: standing.who === 'setter' ? "You can't assign tasks at this home anymore." : `${member} isn't in the household anymore.`,
    });
  }
  const zone = resolveHomeTimezone(home, DEFAULT_TIMEZONE);
  const prefs = await memberPrefs(memberId);
  const chosen = String(prefs.evening_briefing_time_local || '').slice(0, 5);
  const [hour, minute] = [HHMM.test(chosen) ? chosen : EVENING_DEFAULT, EVENING_LATEST].sort()[0].split(':').map(Number);
  const local = DateTime.fromMillis(now, { zone });
  const evening = local.set({ hour, minute, second: 0, millisecond: 0 });
  // Not evening yet (or a late run after midnight): look again at tonight's time.
  if (local < evening) return moveOn(rule, { next_run_at: evening.toUTC().toISO() });
  const tomorrow = { next_run_at: evening.plus({ days: 1 }).toUTC().toISO() };
  // The member turned home reminders off: nothing is sent.
  if (prefs.home_reminders_enabled === false) return moveOn(rule, tomorrow);
  // Only days the household set: a city schedule nobody confirmed never sends a reminder.
  const calendar = await composeForHomeId(home.id, { userId: memberId, now: new Date(now) });
  const signal = buildTomorrowPickupSignal(calendar, zone, [], new Date(now));
  if (!signal) return moveOn(rule, tomorrow);
  const { date, kinds = [], moved } = signal.data;
  const setter = await firstName(rule.user_id);
  const holiday = moved ? (moved.shift_days === 1 ? ` Moved a day for ${moved.holiday}.` : ` Moved for ${moved.holiday}.`) : '';
  const row = await notify(memberId, {
    title: signal.label,
    body: `${pickupWords(kinds)}${holiday} ${setter} asked Pantopus to remind you.`,
    link: linkFor('today'),
    key: `rule:pickup:${rule.id}:${date}`,
    ruleId: rule.id,
    kind: rule.kind,
    // "Tonight" is wrong after midnight: a push held past it is dropped.
    expiresAt: local.endOf('day').toMillis(),
    // The evening briefing's own push: its category, date and person, so Bins out works.
    metadata: { push_category: 'PICKUP_REMINDER', pickup_date: date, home_id: home.id },
    push: !(await briefingCovered(memberId, prefs, date, now).catch(() => false)),
  });
  // Already sent for this date (the idempotency key): nothing more.
  if (!row) return moveOn(rule, tomorrow);
  await recordRun(rule, {
    ok: true,
    name: 'pickup_reminder',
    summary: `Reminded ${standing.name} · ${shortDay(DateTime.fromISO(date, { zone }))} pickup`,
    subject: { type: 'home', id: home.id },
    outcome: { notification_id: row.id },
    ref: row.id,
  });
  await moveOn(rule, { ...tomorrow, last_run_at: new Date(now).toISOString(), run_count: (rule.run_count || 0) + 1 });
  return true;
}

/** Hourly (jobs/index.js): at the member's evening briefing time, remind them of tomorrow's household pickup. */
async function runPickupReminders({ now = Date.now() } = {}) {
  if (isAssistantOff()) return { claimed: 0, sent: 0 };
  const due = await claimDue('pickup_reminder', now, PICKUP_CLAIM_MS);
  let sent = 0;
  for (const rule of due) {
    try {
      if ((await runPickupReminder(rule, now)) === true) sent += 1;
    } catch (err) {
      logger.warn('rules.pickup_reminder_failed', { ruleId: rule.id, error: err.message });
    }
  }
  if (sent) logger.info('rules.pickup_reminders', { claimed: due.length, sent });
  return { claimed: due.length, sent };
}

module.exports = {
  ruleToolDefinitions,
  runRuleTool,
  RULE_CARD_TOOLS,
  RULE_TOOL_NAMES,
  listRules,
  saveFromCard,
  changeRule,
  deleteRule,
  runPlanRepeats,
  runPickupReminders,
  occurrenceAfter,
  RuleError,
  NOTICE_TYPE,
  LIMIT,
};
