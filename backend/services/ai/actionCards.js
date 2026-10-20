/**
 * Action cards: things the assistant fills in for the person to send with one tap.
 *
 * The contract is docs/product/ai-assistant-phase1-contract-2026-10-20.md. Each card
 * carries the exact request the app sends when the person taps, built here from
 * checked fields for a fixed list of endpoints the app already uses; the model only
 * supplies the fields. Nothing here writes: the person's tap does, through the
 * endpoint that owns the data, with its own permission checks and notifications.
 * Each drafter checks the same things that endpoint will (who may act, the plan's
 * rules, the household's permissions) so a card never offers a request that would
 * be refused.
 */
const crypto = require('crypto');
const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const { isFeatureEnabled } = require('../featureFlagService');
const { loadViewer } = require('../plans/planViewer');
const planService = require('../plans/planService');
const planActions = require('../plans/planActions');
const planPlaces = require('../plans/planPlaces');
const rules = require('../plans/planRules');
const { canReadPost, POST_READ_SELECT } = require('../pulse/readAccess');
const homeRecordService = require('../homeRecordService');
const homeDetailService = require('../homeDetailService');
const { localDisplayNames } = require('../../utils/identityProfiles');
const { planKinds } = require('./readTools');
const { linkFor } = require('./appGuide');
const {
  isUuid, clip, chosenHome, localToUtc, whenLabel, dayPartLabel, dayLabel, firstNameOf, distanceWords,
} = require('./assistantKit');

const NOTE = 'One short sentence shown under the card: the assumption that matters most or a detail worth adding. Nothing happens until they tap, so write about the card, never as if it were already done. Null when there is nothing to say.';
const HHMM = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const KIND_LABELS = {
  watch_party: 'Watch party', pickup_game: 'Pickup game', walk_coffee: 'Walk & coffee', study_group: 'Study group', playdate: 'Playdate',
};
// Kids' age bands as the apps write them (Android KidsAgeBand).
const AGE_LABELS = { under_2: 'Under 2', '2_3': '2–3', '4_5': '4–5', '6_8': '6–8', '9_12': '9–12' };
const agesText = (bands) => (Array.isArray(bands) && bands.length ? bands.map((band) => AGE_LABELS[band] || band).join(', ') : null);
const WHO_GETS_IN = {
  host_approves: { rules: [], text: 'You approve each person' },
  verified_neighbors: { rules: ['verified'], text: 'Verified neighbors get in right away; you approve everyone else' },
  verified_and_hosted: { rules: ['verified', 'hosted_before'], text: "Verified neighbors and people you've hosted get in right away; you approve everyone else" },
  hosted_before: { rules: ['hosted_before'], text: "People you've hosted before get in right away; you approve everyone else" },
  anyone_nearby: { rules: ['anyone_nearby'], text: 'Anyone nearby gets in right away' },
};

// ─── Definitions ───────────────────────────────────────────────────────────

const nullable = (schema) => ({ ...schema, type: [schema.type, 'null'] });
const kidsAges = (description) => ({ type: ['array', 'null'], items: { type: 'string', enum: rules.KIDS_AGE_BANDS }, description });

/** draft_plan; with `playdates`, for people who have plans_playdates (the kind, its kids' ages and its rules). */
function draftPlanDefinition({ playdates = false } = {}) {
  return {
    name: 'draft_plan',
    description: `Draft a new plan (a small meetup on the Plans map) for the person to post with one tap. Kinds: watch_party (a game or show to watch together), ${playdates ? 'playdate (kids play while their parents meet; only for people with a verified address), ' : ''}pickup_game (a sport), walk_coffee (a walk, dog walk, stroller walk or coffee), study_group (studying together; public places only). Plans start within the next 14 days and last 15 minutes to 8 hours. Pickup games, ${playdates ? 'playdates, ' : ''}study groups and walks in public need a public place: give its name and the server finds it near them. Watch parties and walks may be at their own home. ${playdates ? "A playdate needs the ages of the kids it's for (details.kids_age_bands): use what they said, or ask in one short question. Its host approves each family, and its spots count families. " : ''}Make sensible assumptions (an hour and a half for games, 8 spots${playdates ? '; for a playdate, an hour and a half and 4 families' : ''}) and name the main one in the note.`,
    input_schema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: planKinds(playdates) },
        title: { type: 'string', description: 'Short title, up to 80 characters, e.g. "Pickleball, need 3".' },
        starts_local: { type: 'string', description: 'Start in their local time, YYYY-MM-DDTHH:MM.' },
        ends_local: { type: 'string', description: 'End in their local time, YYYY-MM-DDTHH:MM.' },
        spots: { type: 'integer', minimum: 1, maximum: 30, description: `How many people can join, not counting the host${playdates ? ' (for a playdate, how many families besides theirs)' : ''}.` },
        place_name: nullable({ type: 'string', description: 'A public place near them (a park, court, library, café), or null when at_home.' }),
        at_home: nullable({ type: 'boolean', description: 'True to host at their own home (watch parties and walks only).' }),
        who_gets_in: nullable({ type: 'string', enum: Object.keys(WHO_GETS_IN), description: 'Who gets in without the host approving. Null for the usual: verified neighbors in public, approval at home.' }),
        details: {
          type: ['object', 'null'],
          properties: {
            sport: nullable({ type: 'string', enum: rules.SPORTS }),
            level: nullable({ type: 'string', enum: rules.LEVELS }),
            extra_gear: nullable({ type: 'boolean' }),
            walk_kind: nullable({ type: 'string', enum: rules.WALK_KINDS }),
            pace: nullable({ type: 'string', enum: rules.PACES }),
            dogs_welcome: nullable({ type: 'boolean' }),
            subject: nullable({ type: 'string', description: 'Study groups: what they study, up to 60 characters.' }),
            study_style: nullable({ type: 'string', enum: rules.STUDY_STYLES }),
            game_label: nullable({ type: 'string', description: 'Watch parties: the game or show, e.g. "Seahawks vs. 49ers".' }),
            ...(playdates ? { kids_age_bands: kidsAges("Playdates: the ages of the kids it's for.") } : {}),
          },
          additionalProperties: false,
        },
        about: nullable({ type: 'string', description: 'A line about the plan, up to 500 characters.' }),
        guest_note: nullable({ type: 'string', description: 'A note only people who get in see (where exactly to meet, what to bring).' }),
        note: { type: ['string', 'null'], description: NOTE },
      },
      required: ['kind', 'title', 'starts_local', 'ends_local', 'spots', 'place_name', 'at_home', 'who_gets_in', 'details', 'about', 'guest_note', 'note'],
      additionalProperties: false,
    },
  };
}

/** draft_plan_ask; with `playdates`, a playdate's ask carries the family's kids and their ages. */
function draftPlanAskDefinition({ playdates = false } = {}) {
  const kids = playdates ? {
    kids_count: nullable({ type: 'integer', minimum: 1, maximum: 8, description: 'Playdates: how many of their kids are coming. Null for other plans.' }),
    kids_age_bands: kidsAges("Playdates: their kids' ages. Null for other plans."),
  } : {};
  return {
    name: 'draft_plan_ask',
    description: `Draft asking to join someone else's plan, with an optional short note to the host.${playdates ? " For a playdate their family asks: give how many of their kids are coming and their ages, or ask in one short question. Parents stay with their kids, and the host sees the kids' ages, never their names." : ''}`,
    input_schema: {
      type: 'object',
      properties: {
        plan_id: { type: 'string' },
        party_size: { type: 'integer', minimum: 1, maximum: 4, description: 'People coming including them.' },
        ...kids,
        ask_note: nullable({ type: 'string', description: 'Up to 280 characters to the host.' }),
        note: { type: ['string', 'null'], description: NOTE },
      },
      required: ['plan_id', 'party_size', ...Object.keys(kids), 'ask_note', 'note'],
      additionalProperties: false,
    },
  };
}

const actionCardDefinitions = [
  draftPlanDefinition(),
  {
    name: 'draft_plan_change',
    description: 'Draft a change to a plan the person hosts: the time, the place, spots, title or notes. Only the fields that change. Moving the start more than 30 minutes or changing the place asks everyone who is in "Still coming?".',
    input_schema: {
      type: 'object',
      properties: {
        plan_id: { type: 'string' },
        title: nullable({ type: 'string' }),
        starts_local: nullable({ type: 'string', description: 'New start, local time YYYY-MM-DDTHH:MM.' }),
        ends_local: nullable({ type: 'string', description: 'New end, local time YYYY-MM-DDTHH:MM.' }),
        spots: nullable({ type: 'integer', minimum: 1, maximum: 30 }),
        place_name: nullable({ type: 'string', description: 'A new public place near them.' }),
        about: nullable({ type: 'string' }),
        guest_note: nullable({ type: 'string' }),
        note: { type: ['string', 'null'], description: NOTE },
      },
      required: ['plan_id', 'title', 'starts_local', 'ends_local', 'spots', 'place_name', 'about', 'guest_note', 'note'],
      additionalProperties: false,
    },
  },
  {
    name: 'draft_plan_cancel',
    description: 'Draft cancelling a plan the person hosts, with a kind note to everyone who asked or is in.',
    input_schema: {
      type: 'object',
      properties: {
        plan_id: { type: 'string' },
        cancel_note: nullable({ type: 'string', description: 'Up to 280 characters, e.g. "Rained out, sorry! Next week?"' }),
        note: { type: ['string', 'null'], description: NOTE },
      },
      required: ['plan_id', 'cancel_note', 'note'],
      additionalProperties: false,
    },
  },
  {
    name: 'show_plan_requests',
    description: "Show the people waiting to join a plan the person hosts as a card with Accept and Decline for each. Use your note to point out who looks like a good fit from the signals (verified address, distance, plans joined, mutual connections, hosted before), but leave the choice to them.",
    input_schema: {
      type: 'object',
      properties: { plan_id: { type: 'string' }, note: { type: ['string', 'null'], description: NOTE } },
      required: ['plan_id', 'note'],
      additionalProperties: false,
    },
  },
  draftPlanAskDefinition(),
  {
    name: 'draft_plan_message',
    description: "Draft a message to everyone in a plan's group chat (the host and the people who are in). The chat exists once the host has let someone in.",
    input_schema: {
      type: 'object',
      properties: {
        plan_id: { type: 'string' },
        text: { type: 'string', description: 'The message, in their voice.' },
        note: { type: ['string', 'null'], description: NOTE },
      },
      required: ['plan_id', 'text', 'note'],
      additionalProperties: false,
    },
  },
  {
    name: 'draft_post_reply',
    description: 'Draft a reply to a post on the Nearby feed, or to one reply on it.',
    input_schema: {
      type: 'object',
      properties: {
        post_id: { type: 'string' },
        reply_to: nullable({ type: 'string', description: 'The reply_id being answered, or null to reply to the post.' }),
        text: { type: 'string', description: 'The reply, in their voice, up to 2000 characters.' },
        note: { type: ['string', 'null'], description: NOTE },
      },
      required: ['post_id', 'reply_to', 'text', 'note'],
      additionalProperties: false,
    },
  },
  {
    name: 'draft_post_solve',
    description: 'Draft marking one of the person\'s own open questions (ask posts) as solved.',
    input_schema: {
      type: 'object',
      properties: { post_id: { type: 'string' }, note: { type: ['string', 'null'], description: NOTE } },
      required: ['post_id', 'note'],
      additionalProperties: false,
    },
  },
  {
    name: 'draft_home_task',
    description: "Draft a reminder or household task in one of the person's homes, optionally assigned to someone in the household and repeating. Use get_household for the person's id when they name someone.",
    input_schema: {
      type: 'object',
      properties: {
        home_id: nullable({ type: 'string', description: 'Null for the home Today shows.' }),
        title: { type: 'string', description: 'Up to 255 characters, e.g. "Change the furnace filter".' },
        description: nullable({ type: 'string' }),
        task_type: { type: 'string', enum: ['reminder', 'chore', 'repair', 'project', 'shopping'] },
        assignee_user_id: nullable({ type: 'string', description: 'A user_id from get_household, or null for no one in particular.' }),
        due_date: nullable({ type: 'string', description: 'Local date YYYY-MM-DD. Required when it repeats.' }),
        due_time: nullable({ type: 'string', description: 'Local time HH:MM, or null for 9:00 AM.' }),
        repeat: {
          type: ['object', 'null'],
          properties: {
            frequency: { type: 'string', enum: ['daily', 'weekly', 'monthly'] },
            every: { type: 'integer', minimum: 1, maximum: 365, description: '1 for every day/week/month, 2 for every other, and so on.' },
          },
          required: ['frequency', 'every'],
          additionalProperties: false,
        },
        priority: nullable({ type: 'string', enum: ['low', 'medium', 'high', 'urgent'] }),
        note: { type: ['string', 'null'], description: NOTE },
      },
      required: ['home_id', 'title', 'description', 'task_type', 'assignee_user_id', 'due_date', 'due_time', 'repeat', 'priority', 'note'],
      additionalProperties: false,
    },
  },
  {
    name: 'draft_notification_settings',
    description: 'Draft a change to the person\'s notification settings: quiet hours (HH:MM, 24-hour), the morning and evening briefings and their times, weather and air alerts, and home reminders. Only the fields that change.',
    input_schema: {
      type: 'object',
      properties: {
        quiet_hours_start: nullable({ type: 'string', description: 'HH:MM when quiet hours begin, e.g. "21:00".' }),
        quiet_hours_end: nullable({ type: 'string', description: 'HH:MM when they end, e.g. "08:00".' }),
        morning_briefing: nullable({ type: 'boolean' }),
        morning_briefing_time: nullable({ type: 'string', description: 'HH:MM.' }),
        evening_briefing: nullable({ type: 'boolean' }),
        evening_briefing_time: nullable({ type: 'string', description: 'HH:MM.' }),
        weather_alerts: nullable({ type: 'boolean' }),
        air_quality_alerts: nullable({ type: 'boolean' }),
        home_reminders: nullable({ type: 'boolean' }),
        note: { type: ['string', 'null'], description: NOTE },
      },
      required: ['quiet_hours_start', 'quiet_hours_end', 'morning_briefing', 'morning_briefing_time', 'evening_briefing', 'evening_briefing_time', 'weather_alerts', 'air_quality_alerts', 'home_reminders', 'note'],
      additionalProperties: false,
    },
  },
];

// The card tools that differ for people with plans_playdates.
const playdateCardDefinitions = [draftPlanDefinition({ playdates: true }), draftPlanAskDefinition({ playdates: true })];

const PLAN_CARD_TOOLS = new Set(['draft_plan', 'draft_plan_change', 'draft_plan_cancel', 'show_plan_requests', 'draft_plan_ask', 'draft_plan_message']);

// ─── Envelope ──────────────────────────────────────────────────────────────

function line(label, value) {
  const text = typeof value === 'string' ? clip(value, 300) : (value == null ? null : String(value));
  return text ? { label, value: text } : null;
}

function card(type, { title, lines = [], warnings = [], actions = [], items = null, expiresAt = null }) {
  return {
    id: crypto.randomUUID(),
    card: type,
    title: clip(title, 80) || 'Pantopus',
    lines: lines.filter(Boolean),
    warnings: warnings.filter(Boolean),
    note: null,
    expires_at: expiresAt,
    actions,
    ...(items ? { items } : {}),
  };
}

function action(id, label, request, done, { style = 'primary', then = null } = {}) {
  return { id, label, style, request, ...(then ? { then } : {}), done };
}

function finished(draft, note, closing) {
  const text = typeof note === 'string' && note.trim() ? clip(note, 300) : null;
  return { draftType: 'action', draft: { ...draft, note: text }, valid: true, note: text, closing };
}

const sessionHeaders = (ctx) => (ctx.sessionScope ? { 'x-pantopus-session-scope': ctx.sessionScope } : null);

async function plansOn(ctx) {
  if (typeof ctx.plansEnabled === 'boolean') return ctx.plansEnabled;
  return isFeatureEnabled('plans', ctx.user).catch(() => false);
}

const userFor = (ctx) => ({ id: ctx.userId, role: ctx.user?.role || null });

async function planFor(planId, ctx) {
  if (!isUuid(planId)) return { error: 'That is not a plan id. Use find_plans first.' };
  const viewer = await loadViewer(userFor(ctx));
  const { plan, body } = await planService.getForViewer(planId, viewer);
  if (!body) return { error: "That plan isn't available to them." };
  return { plan, body, viewer };
}

// ─── Plans ─────────────────────────────────────────────────────────────────

/**
 * The first public place matching `name` near the person, from the place picker's own search
 * (OpenStreetMap, cached for a day per area); never a bar for a playdate, as the picker
 * (PlanPlaceFit). { loading: true } when that search has no answer yet (an area seen for the
 * first time, or its servers are slow), so the person can be told.
 */
async function findPublicPlace(name, origin, kind = null) {
  const query = clip(name, 60);
  if (!query || !origin) return null;
  try {
    const result = await Promise.race([
      planPlaces.placesNear({ latitude: origin.latitude, longitude: origin.longitude, q: query }),
      new Promise((resolve) => { setTimeout(() => resolve({ places: [], loading: true }), 9000).unref?.(); }),
    ]);
    const places = (result?.places || []).filter((place) => kind !== 'playdate' || place.category !== 'bar');
    if (places.length) return places[0];
    return result?.loading ? { loading: true } : null;
  } catch (err) {
    logger.warn('assistant place search failed', { error: err.message });
    return { loading: true };
  }
}

const PLACES_LOADING = "Places near them aren't loading right now (the map's place search is slow or busy). Say so, and offer to try again in a minute, or link them to plan_new to pick the place themselves.";

function detailsInput(kind, details) {
  const d = details || {};
  if (kind === 'pickup_game') return { sport: d.sport || undefined, level: d.level || undefined, extra_gear: d.extra_gear ?? undefined };
  if (kind === 'walk_coffee') return { walk_kind: d.walk_kind || undefined, pace: d.pace || undefined, dogs_welcome: d.dogs_welcome ?? undefined };
  if (kind === 'study_group') return { subject: d.subject || undefined, study_style: d.study_style || undefined };
  if (kind === 'watch_party') return d.game_label ? { game: { label: d.game_label } } : {};
  if (kind === 'playdate') return { kids_age_bands: d.kids_age_bands || undefined };
  return {};
}

function detailLines(kind, details) {
  const d = details || {};
  if (kind === 'pickup_game') return [line('Sport', d.sport), line('Level', d.level), d.extra_gear ? line('Gear', 'Extra gear to share') : null];
  if (kind === 'walk_coffee') return [line('Kind', d.walk_kind && d.walk_kind.replace('_', ' ')), line('Pace', d.pace), d.dogs_welcome ? line('Dogs', 'Welcome') : null];
  if (kind === 'study_group') return [line('Subject', d.subject), line('Style', d.study_style === 'together' ? 'Working through it together' : 'Quiet study')];
  if (kind === 'watch_party') return [line('Watching', d.game?.label)];
  if (kind === 'playdate') return [line('Kids’ ages', agesText(d.kids_age_bands))];
  return [];
}

async function draftPlan(args, ctx) {
  if (!(await plansOn(ctx))) return { error: "Plans aren't available for this person yet." };
  if (!rules.KINDS.includes(args.kind)) return { error: 'Choose one of the plan kinds.' };
  const viewer = await loadViewer(userFor(ctx));
  // A playdate needs plans_playdates and a verified address (planActions checks both again, with the rest).
  const playdate = args.kind === 'playdate';
  if (playdate && !viewer.playdatesFlag) return { error: 'Choose one of the plan kinds.' };
  if (playdate && !viewer.verified) return { error: 'Verify your address to host a playdate.' };
  if (playdate && !args.details?.kids_age_bands?.length) {
    return { error: "A playdate needs the ages of the kids it's for. Ask how old the kids are, in one short question." };
  }
  const startsAt = localToUtc(args.starts_local, ctx.timeZone);
  const endsAt = localToUtc(args.ends_local, ctx.timeZone);
  if (!startsAt || !endsAt) return { error: 'Give the start and end as local times, YYYY-MM-DDTHH:MM.' };

  let place;
  if (args.at_home) {
    const home = viewer.homes.find((h) => h.trusted && h.point);
    if (!home) return { error: 'They have no home on Pantopus they can host at. Suggest a public place instead.' };
    place = { kind: 'home', home_id: home.id };
  } else {
    if (!args.place_name) return { error: 'A public place is needed. Ask where, or suggest a park, court, library or café near them.' };
    const found = await findPublicPlace(args.place_name, viewer.origin, args.kind);
    if (found?.loading) return { error: PLACES_LOADING };
    if (!found) return { error: `No public place called "${args.place_name}" was found near them. Ask for another place or a nearby landmark.` };
    place = { kind: 'public', name: found.name, address: found.address || null, latitude: found.latitude, longitude: found.longitude };
  }

  const who = WHO_GETS_IN[args.who_gets_in] || (place.kind === 'home' ? WHO_GETS_IN.host_approves : WHO_GETS_IN.verified_neighbors);
  const input = {
    kind: args.kind,
    title: args.title,
    about: args.about || null,
    guest_note: args.guest_note || null,
    starts_at: startsAt,
    ends_at: endsAt,
    spots: args.spots,
    place,
    auto_rules: who.rules,
    join_requirement: 'located',
    details: detailsInput(args.kind, args.details),
  };

  let checked;
  try {
    checked = await planActions.previewPlan(userFor(ctx), input);
  } catch (err) {
    if (err instanceof planActions.PlanError) return { error: err.message };
    throw err;
  }
  const appliedWho = Object.values(WHO_GETS_IN).find((w) => w.rules.join() === checked.autoRules.join()) || WHO_GETS_IN.host_approves;
  const body = {
    kind: checked.kind,
    title: checked.title,
    about: checked.about || null,
    guest_note: checked.guestNote,
    starts_at: checked.startsAt,
    ends_at: checked.endsAt,
    spots: checked.spots,
    place: checked.place.kind === 'home'
      ? { kind: 'home', home_id: checked.place.home_id }
      : { kind: 'public', name: checked.place.name, address: checked.place.address, latitude: checked.place.latitude, longitude: checked.place.longitude },
    auto_rules: checked.autoRules,
    join_requirement: checked.joinRequirement,
    details: checked.details,
  };
  const where = checked.place.kind === 'home'
    ? 'Your place'
    : [checked.place.name, checked.place.address].filter(Boolean).join(', ');
  const draft = card('plan_create', {
    title: checked.title,
    lines: [
      line('Kind', KIND_LABELS[checked.kind]),
      line('When', whenLabel(checked.startsAt, checked.endsAt, checked.timezone)),
      line('Where', where),
      line(playdate ? 'Families' : 'Spots', `${checked.spots}`),
      line('Who gets in', playdate ? 'You approve each family' : appliedWho.text),
      ...detailLines(checked.kind, checked.details),
      line(playdate ? 'Note for families' : 'Note for guests', checked.guestNote),
    ],
    warnings: playdate
      ? [
        'Only verified neighbors see playdates. Until you accept a family, they see only the neighborhood and the part of the day.',
        'Parents stay with their kids the whole time; only kids’ ages are shared, never names.',
      ]
      : [
        checked.place.kind === 'home'
          ? 'Only people you accept see your address.'
          : 'Neighbors see only the area until they get in; then they see the exact place.',
      ],
    actions: [action('confirm', 'Post plan', { method: 'POST', path: '/api/plans', body },
      { label: 'Plan posted', link: linkFor('plan', '{{response.id}}') })],
    expiresAt: checked.startsAt,
  });
  return finished(draft, args.note, "Here's your plan. Check it, then tap Post plan.");
}

async function draftPlanChange(args, ctx) {
  if (!(await plansOn(ctx))) return { error: "Plans aren't available for this person yet." };
  const found = await planFor(args.plan_id, ctx);
  if (found.error) return found;
  const { body: plan, viewer } = found;
  if (plan.viewer.role !== 'host') return { error: 'Only the host can change this plan.' };
  if (plan.state === 'ended' || plan.state === 'cancelled') return { error: 'This plan is over.' };

  const patch = {};
  const lines = [];
  const warnings = [];
  if (args.title) { patch.title = args.title; lines.push(line('Title', args.title)); }
  if (args.starts_local || args.ends_local) {
    const zone = plan.timezone || ctx.timeZone;
    const duration = new Date(plan.ends_at) - new Date(plan.starts_at);
    const startsAt = args.starts_local ? localToUtc(args.starts_local, zone) : plan.starts_at;
    let endsAt = args.ends_local ? localToUtc(args.ends_local, zone) : null;
    if (!startsAt) return { error: 'Give the new start as a local time, YYYY-MM-DDTHH:MM.' };
    if (!endsAt) endsAt = new Date(new Date(startsAt).getTime() + duration).toISOString();
    patch.starts_at = startsAt;
    patch.ends_at = endsAt;
    lines.push(line('When', whenLabel(startsAt, endsAt, zone)));
    if (Math.abs(new Date(startsAt) - new Date(plan.starts_at)) > 30 * 60 * 1000 && (plan.going || 0) > 0) {
      warnings.push('Everyone who is in will be asked "Still coming?".');
    }
  }
  if (Number.isInteger(args.spots)) {
    if (args.spots < (plan.going || 0)) return { error: `${plan.going} people are already in, so spots can't go below that.` };
    patch.spots = args.spots;
    lines.push(line('Spots', `${args.spots}`));
  }
  if (args.place_name) {
    const place = await findPublicPlace(args.place_name, viewer.origin, plan.kind);
    if (place?.loading) return { error: PLACES_LOADING };
    if (!place) return { error: `No public place called "${args.place_name}" was found near them.` };
    patch.place = { kind: 'public', name: place.name, address: place.address || null, latitude: place.latitude, longitude: place.longitude };
    lines.push(line('Where', [place.name, place.address].filter(Boolean).join(', ')));
    if ((plan.going || 0) > 0) warnings.push('Everyone who is in will be asked "Still coming?".');
  }
  if (args.about) { patch.about = args.about; lines.push(line('About', args.about)); }
  if (args.guest_note) { patch.guest_note = args.guest_note; lines.push(line('Note for guests', args.guest_note)); }
  if (!Object.keys(patch).length) return { error: 'Nothing to change. Ask what they want to change.' };

  const draft = card('plan_edit', {
    title: `Change "${clip(plan.title, 60)}"`,
    lines,
    warnings: [...new Set(warnings)],
    actions: [action('confirm', 'Save changes', { method: 'PATCH', path: `/api/plans/${plan.id}`, body: patch },
      { label: 'Plan updated', link: linkFor('plan', plan.id) })],
    expiresAt: plan.ends_at,
  });
  return finished(draft, args.note, 'Here are the changes. Tap Save changes to update the plan.');
}

async function draftPlanCancel(args, ctx) {
  if (!(await plansOn(ctx))) return { error: "Plans aren't available for this person yet." };
  const found = await planFor(args.plan_id, ctx);
  if (found.error) return found;
  const plan = found.body;
  if (plan.viewer.role !== 'host') return { error: 'Only the host can cancel this plan.' };
  if (plan.state === 'ended' || plan.state === 'cancelled') return { error: 'This plan is already over.' };
  const note = clip(args.cancel_note, 280);
  const draft = card('plan_cancel', {
    title: `Cancel "${clip(plan.title, 60)}"`,
    lines: [line('When', whenLabel(plan.starts_at, plan.ends_at, plan.timezone || ctx.timeZone)), line('Note', note)],
    warnings: ['Everyone who asked or is in will be told, and the plan comes off the map.'],
    actions: [action('confirm', 'Cancel plan', { method: 'POST', path: `/api/plans/${plan.id}/cancel`, body: note ? { note } : {} },
      { label: 'Plan cancelled' }, { style: 'destructive' })],
    expiresAt: plan.ends_at,
  });
  return finished(draft, args.note, 'Tap Cancel plan if you want to call it off.');
}

async function showPlanRequests(args, ctx) {
  if (!(await plansOn(ctx))) return { error: "Plans aren't available for this person yet." };
  const found = await planFor(args.plan_id, ctx);
  if (found.error) return found;
  const plan = found.body;
  if (plan.viewer.role !== 'host') return { error: 'Only the host sees who asked to join.' };
  const requests = await planActions.listRequests(userFor(ctx), plan.id);
  const waiting = [...requests.pending, ...requests.waitlisted];
  if (!waiting.length) return { message: 'Nobody is waiting to join this plan right now.' };

  let sharesAddress = false;
  if (found.plan?.place_kind === 'home') {
    const { count } = await supabaseAdmin.from('PlanRequest').select('id', { count: 'exact', head: true })
      .eq('post_id', plan.id).eq('decided_by', 'host').in('status', ['accepted', 'left', 'removed']);
    sharesAddress = !count;
  }
  const base = `/api/plans/${plan.id}/requests`;
  const items = waiting.slice(0, 10).map((r) => {
    const party = r.party_size > 1 ? ` + ${r.party_size - 1}` : '';
    return {
      id: r.id,
      title: `${r.user.display_name}${party}`,
      lines: [
        line('Address', r.user.verified_address ? 'Verified' : 'Not verified'),
        line('Distance', distanceWords(r.user.distance_band)),
        line('Plans joined', `${r.user.plans_joined}`),
        r.user.mutual_connections ? line('Mutual connections', `${r.user.mutual_connections}`) : null,
        r.user.hosted_before ? line('Before', "You've hosted them") : null,
        r.user.new_to_pantopus ? line('New', 'New to Pantopus') : null,
        line('Their note', r.note),
        requests.waitlisted.includes(r) ? line('Status', 'On the waitlist') : null,
      ].filter(Boolean),
      actions: [
        action('accept', 'Accept', { method: 'POST', path: `${base}/${r.id}/accept`, body: sharesAddress ? { confirm_shares_address: true } : {} }, { label: 'Accepted' }),
        action('decline', 'Decline', { method: 'POST', path: `${base}/${r.id}/decline`, body: {} }, { label: 'Declined' }, { style: 'secondary' }),
      ],
    };
  });
  const draft = card('plan_requests', {
    title: `Asking to join "${clip(plan.title, 50)}"`,
    lines: [line('Spots left', `${plan.spots_left} of ${plan.spots}`)],
    warnings: [sharesAddress ? 'Accepting someone shares your address with them.' : null],
    actions: [],
    items,
    expiresAt: plan.starts_at,
  });
  return finished(draft, args.note, waiting.length === 1 ? 'One person is waiting.' : `${waiting.length} people are waiting.`);
}

async function draftPlanAsk(args, ctx) {
  if (!(await plansOn(ctx))) return { error: "Plans aren't available for this person yet." };
  const found = await planFor(args.plan_id, ctx);
  if (found.error) return found;
  const plan = found.body;
  if (plan.viewer.role === 'host') return { error: 'They host this plan.' };
  if (!plan.viewer.can_ask) {
    return { error: `They can't ask to join this plan (${plan.viewer.cannot_ask_reason || 'not available'}).` };
  }
  const askNote = clip(args.ask_note, 280);
  // A playdate is asked for by a family: its kids and their ages, with the parent staying (planActions.cleanAsk).
  const playdate = plan.kind === 'playdate';
  const kids = Number(args.kids_count);
  const ages = Array.isArray(args.kids_age_bands) ? rules.KIDS_AGE_BANDS.filter((band) => args.kids_age_bands.includes(band)) : [];
  if (playdate && (!Number.isInteger(kids) || kids < 1 || kids > 8 || !ages.length)) {
    return { error: 'Asking to join a playdate needs how many of their kids are coming (1 to 8) and their ages. Ask them in one short question.' };
  }
  const partySize = playdate ? 1 : Math.min(Math.max(Number(args.party_size) || 1, 1), 4);
  const body = playdate
    ? { party_size: 1, kids_count: kids, kids_age_bands: ages, stays_with_kids: true, ...(askNote ? { note: askNote } : {}) }
    : { party_size: partySize, ...(askNote ? { note: askNote } : {}) };
  const zone = plan.timezone || ctx.timeZone;
  const draft = card('plan_ask', {
    title: `Ask to join "${clip(plan.title, 60)}"`,
    lines: [
      // A playdate shows its time only to families who are in: the day and its part until then.
      line('When', plan.starts_at ? whenLabel(plan.starts_at, plan.ends_at, zone) : dayPartLabel(plan.starts_on, plan.day_part)),
      line('Where', plan.area?.label ? `Near ${plan.area.label}` : null),
      line('Host', plan.host?.display_name),
      line('Coming', playdate ? `You + ${kids} ${kids === 1 ? 'kid' : 'kids'}` : (partySize > 1 ? `You + ${partySize - 1}` : 'Just you')),
      playdate ? line('Kids’ ages', agesText(ages)) : null,
      line('Your note', askNote),
      line('Getting in', plan.viewer.auto_rule ? 'You get in right away' : 'The host decides'),
    ],
    warnings: playdate ? [
      'You stay with your kids the whole time.',
      `${firstNameOf({ display_name: plan.host?.display_name }) || 'The host'} sees your first name, your verified badge, about how far away you live and your kids’ ages, never their names.`,
    ] : [],
    actions: [action('confirm', 'Ask to join', {
      method: 'POST', path: `/api/plans/${plan.id}/requests`, body,
    }, { label: 'Asked', link: linkFor('plan', plan.id) })],
    expiresAt: plan.asking_closes_at || plan.starts_at || (plan.starts_on ? localToUtc(`${plan.starts_on}T23:59`, zone) : null),
  });
  return finished(draft, args.note, 'Tap Ask to join to send it.');
}

async function draftPlanMessage(args, ctx) {
  if (!(await plansOn(ctx))) return { error: "Plans aren't available for this person yet." };
  const found = await planFor(args.plan_id, ctx);
  if (found.error) return found;
  const plan = found.body;
  if (plan.viewer.role !== 'host' && plan.viewer.role !== 'guest') return { error: 'Only the host and people who are in can message this plan.' };
  if (!plan.chat_room_id || !plan.chat_open) return { error: "This plan's chat isn't open (it opens when the host lets the first person in, and closes a day after the plan)." };
  const text = clip(args.text, 2000);
  if (!text) return { error: 'The message is empty.' };
  const draft = card('plan_message', {
    title: `Message "${clip(plan.title, 60)}"`,
    lines: [line('To', `Everyone in the plan (${(plan.people || []).length})`), line('Message', text)],
    actions: [],
    expiresAt: null,
  });
  draft.actions.push(action('confirm', 'Send', {
    method: 'POST', path: '/api/chat/messages',
    body: { roomId: plan.chat_room_id, messageText: text, messageType: 'text', clientMessageId: draft.id },
  }, { label: 'Sent', link: linkFor('chat', plan.chat_room_id) }));
  return finished(draft, args.note, 'Tap Send to post it in the plan chat.');
}

// ─── Posts ─────────────────────────────────────────────────────────────────

async function readablePost(postId, ctx) {
  if (!isUuid(postId)) return { error: 'That is not a post id.' };
  const { data: post, error } = await supabaseAdmin.from('Post')
    .select(`${POST_READ_SELECT}, title, content, post_type, state, created_at`)
    .eq('id', postId).maybeSingle();
  if (error) throw new Error(`Post read failed: ${error.message}`);
  if (!post || !(await canReadPost(post, ctx.userId))) return { error: "That post isn't available to them." };
  return { post };
}

async function draftPostReply(args, ctx) {
  const found = await readablePost(args.post_id, ctx);
  if (found.error) return found;
  const { post } = found;
  const text = clip(args.text, 2000);
  if (!text) return { error: 'The reply is empty.' };
  let replyingTo = clip(post.title, 80) || clip(post.content, 80);
  let parent = null;
  if (args.reply_to) {
    if (!isUuid(args.reply_to)) return { error: 'reply_to must be a reply_id from get_post.' };
    const { data: comment } = await supabaseAdmin.from('PostComment')
      .select('id, comment, post_id, is_deleted, user_id')
      .eq('id', args.reply_to).maybeSingle();
    if (!comment || comment.post_id !== post.id || comment.is_deleted) return { error: 'That reply is not on this post.' };
    parent = comment.id;
    const names = await localDisplayNames([comment.user_id]).catch(() => new Map());
    replyingTo = `${firstNameOf({ display_name: names.get(String(comment.user_id)) }) || 'A neighbor'}: ${clip(comment.comment, 80)}`;
  }
  const draft = card('post_reply', {
    title: 'Reply',
    lines: [line('Replying to', replyingTo), line('Reply', text)],
    actions: [],
  });
  draft.actions.push(action('confirm', 'Reply', {
    method: 'POST', path: `/api/posts/${post.id}/comments`,
    body: { comment: text, ...(parent ? { parentCommentId: parent } : {}), clientRequestId: draft.id },
  }, { label: 'Replied', link: linkFor('post', post.id) }));
  return finished(draft, args.note, 'Tap Reply to post it.');
}

async function draftPostSolve(args, ctx) {
  const found = await readablePost(args.post_id, ctx);
  if (found.error) return found;
  const { post } = found;
  if (String(post.user_id) !== String(ctx.userId)) return { error: 'Only the person who asked can mark it solved.' };
  if (post.post_type !== 'ask_local') return { error: 'Only questions can be marked solved.' };
  if (post.state === 'solved') return { message: 'It is already marked solved.' };
  const draft = card('post_solve', {
    title: 'Mark solved',
    lines: [line('Question', clip(post.title, 120) || clip(post.content, 120))],
    actions: [action('confirm', 'Mark solved', { method: 'PATCH', path: `/api/posts/${post.id}/solve`, body: {} },
      { label: 'Marked solved', link: linkFor('post', post.id) })],
  });
  return finished(draft, args.note, 'Tap Mark solved to close the question.');
}

// ─── Home tasks ────────────────────────────────────────────────────────────

const REPEAT_WORDS = { daily: ['day', 'DAILY'], weekly: ['week', 'WEEKLY'], monthly: ['month', 'MONTHLY'] };

async function draftHomeTask(args, ctx) {
  const home = await chosenHome(ctx.userId, args.home_id);
  if (!home) return { error: 'They have no home in Pantopus yet. Tasks belong to a home; they can add one on the Place tab.' };
  const title = clip(args.title, 255);
  if (!title) return { error: 'The task needs a title.' };

  const collection = await homeRecordService.listCollection({ homeId: home.id, actorId: ctx.userId, kind: 'task' })
    .catch(() => null);
  if (!collection) return { error: "They can't see this home's tasks." };
  if (!collection.can_create) return { error: "They can't add tasks in this home." };

  let assignee = null;
  if (args.assignee_user_id) {
    if (!isUuid(args.assignee_user_id)) return { error: 'assignee_user_id must come from get_household.' };
    const { occupants } = await homeDetailService.members(home.id, ctx.userId).catch(() => ({ occupants: [] }));
    const member = (occupants || []).find((o) => String(o.user_id) === args.assignee_user_id && o.is_active !== false);
    if (!member) return { error: "That person isn't in this household. Use get_household." };
    assignee = { id: member.user_id, name: firstNameOf({ name: member.display_name }) || 'Household member' };
  }

  const zone = ctx.timeZone;
  let dueAt = null;
  if (args.due_date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.due_date)) return { error: 'due_date must be YYYY-MM-DD.' };
    const time = args.due_time && HHMM.test(args.due_time) ? args.due_time : '09:00';
    dueAt = localToUtc(`${args.due_date}T${time}`, zone);
    if (!dueAt) return { error: 'That due date is not a real date.' };
  }
  const repeat = args.repeat && REPEAT_WORDS[args.repeat.frequency] ? args.repeat : null;
  if (repeat && !dueAt) return { error: 'A repeating task needs its first due date.' };

  const sessionScope = sessionHeaders(ctx);
  const body = {
    ...(sessionScope ? { request_id: null } : {}),
    task_type: args.task_type || 'reminder',
    title,
    ...(args.description ? { description: clip(args.description, 2000) } : {}),
    ...(assignee ? { assigned_to: assignee.id } : {}),
    ...(dueAt ? { due_at: dueAt } : {}),
    ...(args.priority ? { priority: args.priority } : {}),
  };
  const every = repeat ? Math.min(Math.max(Number(repeat.every) || 1, 1), 365) : null;
  const repeatText = repeat
    ? (every === 1 ? `Every ${REPEAT_WORDS[repeat.frequency][0]}` : `Every ${every} ${REPEAT_WORDS[repeat.frequency][0]}s`)
    : null;

  const draft = card('home_task', {
    title,
    lines: [
      line('For', assignee ? assignee.name : 'Anyone at home'),
      line('Due', dueAt ? `${dayLabel(dueAt, zone)}${args.due_time ? '' : ', 9:00 AM'}` : 'No date'),
      line('Repeats', repeatText),
      line('Home', [home.city, home.state].filter(Boolean).join(', ')),
      line('Details', args.description),
    ],
    warnings: assignee && String(assignee.id) !== String(ctx.userId) ? [`${assignee.name} gets a notification.`] : [],
    actions: [],
  });
  if (sessionScope) body.request_id = draft.id;
  const then = repeat ? {
    request: {
      method: 'POST',
      path: `/api/homes/${home.id}/tasks/{{response.task.id}}/recurrence`,
      body: {
        request_id: crypto.randomUUID(),
        action: 'start',
        expected_revision: 0,
        expected_task_updated_at: '{{response.task.updated_at}}',
        frequency: REPEAT_WORDS[repeat.frequency][1],
        interval: every,
        timezone: zone,
      },
      ...(sessionScope ? { headers: sessionScope } : {}),
    },
  } : null;
  draft.actions.push(action('confirm', 'Add task', {
    method: 'POST', path: `/api/homes/${home.id}/tasks`, body, ...(sessionScope ? { headers: sessionScope } : {}),
  }, { label: 'Added', link: linkFor('home_tasks', home.id) }, { then }));
  return finished(draft, args.note, 'Tap Add task to save it.');
}

// ─── Notification settings ─────────────────────────────────────────────────

function clock(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const hour = ((h + 11) % 12) + 1;
  return `${hour}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

async function draftNotificationSettings(args, ctx) {
  const body = {};
  const lines = [];
  const time = (value, label) => {
    if (value == null) return undefined;
    if (!HHMM.test(value)) throw Object.assign(new Error(`${label} must be HH:MM (24-hour).`), { userFacing: true });
    return value;
  };
  try {
    const start = time(args.quiet_hours_start, 'Quiet hours start');
    const end = time(args.quiet_hours_end, 'Quiet hours end');
    if (start !== undefined || end !== undefined) {
      if (start === undefined || end === undefined) return { error: 'Quiet hours need both a start and an end.' };
      body.quiet_hours_start_local = start;
      body.quiet_hours_end_local = end;
      lines.push(line('Quiet hours', `${clock(start)} – ${clock(end)}`));
    }
    const morningTime = time(args.morning_briefing_time, 'The morning briefing time');
    if (typeof args.morning_briefing === 'boolean') body.daily_briefing_enabled = args.morning_briefing;
    if (morningTime) body.daily_briefing_time_local = morningTime;
    if (typeof args.morning_briefing === 'boolean' || morningTime) {
      lines.push(line('Morning briefing', args.morning_briefing === false ? 'Off' : `On${morningTime ? ` at ${clock(morningTime)}` : ''}`));
    }
    const eveningTime = time(args.evening_briefing_time, 'The evening briefing time');
    if (typeof args.evening_briefing === 'boolean') body.evening_briefing_enabled = args.evening_briefing;
    if (eveningTime) body.evening_briefing_time_local = eveningTime;
    if (typeof args.evening_briefing === 'boolean' || eveningTime) {
      lines.push(line('Evening briefing', args.evening_briefing === false ? 'Off' : `On${eveningTime ? ` at ${clock(eveningTime)}` : ''}`));
    }
  } catch (err) {
    if (err.userFacing) return { error: err.message };
    throw err;
  }
  const toggles = [
    ['weather_alerts', 'weather_alerts_enabled', 'Weather alerts'],
    ['air_quality_alerts', 'aqi_alerts_enabled', 'Air quality alerts'],
    ['home_reminders', 'home_reminders_enabled', 'Home reminders'],
  ];
  for (const [arg, field, label] of toggles) {
    if (typeof args[arg] === 'boolean') {
      body[field] = args[arg];
      lines.push(line(label, args[arg] ? 'On' : 'Off'));
    }
  }
  if (!Object.keys(body).length) return { error: 'Nothing to change. Ask what they want to change.' };
  body.expected_user_id = ctx.userId;
  const draft = card('notification_settings', {
    title: 'Notification settings',
    lines,
    actions: [action('confirm', 'Save', { method: 'PUT', path: '/api/hub/preferences', body },
      { label: 'Saved', link: linkFor('notification_settings') })],
  });
  return finished(draft, args.note, 'Tap Save to change your settings.');
}

// ─── Dispatch ──────────────────────────────────────────────────────────────

const CARD_EXECUTORS = {
  draft_plan: draftPlan,
  draft_plan_change: draftPlanChange,
  draft_plan_cancel: draftPlanCancel,
  show_plan_requests: showPlanRequests,
  draft_plan_ask: draftPlanAsk,
  draft_plan_message: draftPlanMessage,
  draft_post_reply: draftPostReply,
  draft_post_solve: draftPostSolve,
  draft_home_task: draftHomeTask,
  draft_notification_settings: draftNotificationSettings,
};

async function runCardTool(name, args, ctx) {
  const executor = CARD_EXECUTORS[name];
  if (!executor) return null;
  try {
    return await executor(args || {}, ctx);
  } catch (err) {
    if (err instanceof planActions.PlanError) return { error: err.message };
    logger.warn('assistant card tool failed', { tool: name, userId: ctx.userId, error: err?.message });
    return { error: `That couldn't be drafted just now (${name}). Ask them to try again in a moment.` };
  }
}

module.exports = {
  actionCardDefinitions,
  playdateCardDefinitions,
  runCardTool,
  CARD_EXECUTORS,
  PLAN_CARD_TOOLS,
  KIND_LABELS,
  // For tests and scripts.
  card,
  action,
};
