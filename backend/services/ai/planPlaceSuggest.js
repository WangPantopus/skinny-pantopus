/**
 * "Suggest places" in the host's place picker (board H6): up to three public places near the host
 * that suit the plan, best first, each with a short reason ("Lit courts, open until 10 PM").
 *
 * The places come from the picker's own list (planPlaces.placesNear: OpenStreetMap, ordered for
 * the plan's kind, with hours for the plan's time), so a suggestion is always a real public place
 * the host could have tapped; places closed for the whole plan are left out. The host may also
 * say what they're looking for ("big screens and food"), typed in the picker's search box.
 *
 * One short model call chooses and writes the reasons. It is inside the person's daily assistant
 * budget (assistantBudget.js counts `plan_place` as a turn), is logged to AIRequestLog as
 * `plan_place`, and is skipped when the switch or a cap says no, when Anthropic isn't set up, or
 * when it hasn't answered within 9 seconds. Then the list's own order chooses, and the reasons are
 * built from the places' facts (`source: "rules"`). The plan and the places reach the model as
 * quoted data; it may only answer with ids from the list.
 */
const logger = require('../../utils/logger');
const { getAnthropicClient, DRAFT_MODEL } = require('../../config/anthropic');
const { complete, AIRefusalError, isTimeoutError, describeNow } = require('./llm');
const { toClaudeSchema } = require('./schemas');
const { checkChatBudget } = require('./assistantBudget');
const { clip } = require('./assistantKit');
const prompts = require('./prompts');
const planPlaces = require('../plans/planPlaces');
const { MILE_METERS } = require('../plans/planRules');
const { timezoneFromCoordinates } = require('../../utils/timezone');

const ENDPOINT = 'plan_place';
// The host is waiting with the picker open.
const TIMEOUT_MS = 9000;
const MAX_TOKENS = 2048;
const MAX_CANDIDATES = 30;
const MAX_PICKS = 3;
const MAX_WHY = 100;
// A reason shorter than this ("x") says nothing; the list's own reason stands in.
const MIN_WHY = 12;

const KIND_WORDS = {
  watch_party: 'watch party', pickup_game: 'pickup game', walk_coffee: 'walk and coffee', study_group: 'study group', playdate: 'playdate',
};
const CATEGORY_WORDS = {
  bar: 'bar', restaurant: 'restaurant', cafe: 'café', community_center: 'community center', playground: 'playground',
  park: 'park', court: 'court or field', trail: 'trail', library: 'library',
};
const DETAIL_KEYS = ['sport', 'level', 'walk_kind', 'pace', 'dogs_welcome', 'study_style', 'subject', 'kids_age_bands', 'game'];

/** "0.4 mi", as the apps write a place's distance. */
function milesWords(meters) {
  const miles = Number(meters) / MILE_METERS;
  return miles < 0.03 ? 'here' : `${Math.max(miles, 0.1).toFixed(1)} mi`;
}

/** "Saturday, October 24, 7:00 PM to 10:00 PM" in the place's time zone. */
function whenWords(startsAt, endsAt, timezone) {
  const start = startsAt ? new Date(startsAt) : null;
  if (!start || Number.isNaN(start.getTime())) return null;
  const day = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long', month: 'long', day: 'numeric' }).format(start);
  const time = (date) => new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit' }).format(date);
  const end = endsAt ? new Date(endsAt) : null;
  return end && !Number.isNaN(end.getTime()) ? `${day}, ${time(start)} to ${time(end)}` : `${day}, ${time(start)}`;
}

const SUGGESTION_SCHEMA = (ids) => toClaudeSchema({
  type: 'object',
  properties: {
    picks: {
      type: 'array',
      maxItems: MAX_PICKS,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', enum: ids },
          why: { type: 'string', maxLength: MAX_WHY },
        },
        required: ['id', 'why'],
        additionalProperties: false,
      },
    },
  },
  required: ['picks'],
  additionalProperties: false,
});

/** The plan as the model reads it: only what helps choose a place. */
function planFacts(plan, timezone) {
  const details = {};
  for (const key of DETAIL_KEYS) {
    const value = plan.details?.[key];
    // Only short words, yes/no and short lists of words ("kids_age_bands") reach the model.
    if (key === 'game' && value && typeof value === 'object' && !Array.isArray(value)) {
      details.game = { label: clip(value.label, 80), opponent: clip(value.opponent, 80) };
    } else if (typeof value === 'string' && value.trim()) details[key] = clip(value, 60);
    else if (typeof value === 'boolean') details[key] = value;
    else if (Array.isArray(value) && value.length) {
      const words = value.filter((item) => typeof item === 'string').slice(0, 6).map((item) => clip(item, 20)).filter(Boolean);
      if (words.length) details[key] = words;
    }
  }
  return {
    kind: KIND_WORDS[plan.kind] || 'plan',
    title: clip(plan.title, 80) || null,
    about: clip(plan.about, 300) || null,
    when: whenWords(plan.startsAt, plan.endsAt, timezone),
    group: Number.isInteger(plan.spots) ? `the host and up to ${plan.spots} people` : null,
    ...(Object.keys(details).length ? { details } : {}),
  };
}

/** A reason from the list's own facts, when the model doesn't run: "Pickleball courts, open until 9 PM". */
function ruleWhy(place, plan) {
  const sport = plan.details?.sport;
  let fit;
  if (plan.kind === 'pickup_game' && sport && (place.categories || []).includes(sport)) {
    fit = `Courts marked for ${sport}`;
  } else {
    const noun = CATEGORY_WORDS[place.category] || 'public place';
    fit = `A ${noun} ${milesWords(place.distance_m)} away`;
  }
  const extra = place.hours?.status === 'open' ? place.hours.text.toLowerCase() : (place.facts || [])[0]?.toLowerCase();
  return extra ? `${fit}, ${extra}` : fit;
}

const rulePicks = (candidates, plan) => candidates.slice(0, MAX_PICKS).map((place) => ({ ...place, why: ruleWhy(place, plan) }));

/** The model's picks for the candidates, or null when it was skipped or failed. Never throws. */
async function modelPicks({ userId, plan, ask, candidates, timezone }) {
  const blocked = await checkChatBudget(userId);
  if (blocked) {
    logger.info('Plan place suggestions: model skipped', { userId, reason: blocked.error });
    return null;
  }
  const client = getAnthropicClient();
  if (!client) return null;

  // Required here: agentService loads the chat's tools, which nothing above needs.
  const { logRequest } = require('./agentService');
  const byId = new Map(candidates.map((place, i) => [`p${i + 1}`, place]));
  const list = [...byId].map(([id, place]) => ({
    id,
    name: clip(place.name, 80),
    kind: CATEGORY_WORDS[place.category] || place.category,
    ...(place.categories?.length > 1 ? { marked_for: place.categories.slice(1, 4) } : {}),
    distance: milesWords(place.distance_m),
    hours: place.hours ? place.hours.text : 'unknown',
    ...(place.facts?.length ? { facts: place.facts } : {}),
  }));
  const text = [
    `[Now: ${describeNow(timezone)}]`,
    `The plan (JSON): ${JSON.stringify(planFacts(plan, timezone))}`,
    ask ? `What the host is looking for, in their words (JSON): ${JSON.stringify(clip(ask, 120))}` : null,
    `Public places near the host, the picker's order (JSON): ${JSON.stringify(list)}`,
  ].filter(Boolean).join('\n');
  const started = Date.now();
  try {
    const result = await complete({
      client,
      model: DRAFT_MODEL,
      system: prompts.PLAN_PLACE_SYSTEM,
      messages: [{ role: 'user', content: [{ type: 'text', text }] }],
      schema: SUGGESTION_SCHEMA([...byId.keys()]),
      effort: 'low',
      maxTokens: MAX_TOKENS,
      timeoutMs: TIMEOUT_MS,
    });
    const answer = JSON.parse(result.text);
    const seen = new Set();
    const picks = [];
    for (const pick of Array.isArray(answer.picks) ? answer.picks : []) {
      const place = byId.get(pick?.id);
      if (!place || seen.has(pick.id) || picks.length >= MAX_PICKS) continue;
      seen.add(pick.id);
      const why = clip(String(pick.why || '').replace(/\s+/g, ' ').trim(), MAX_WHY);
      picks.push({ ...place, why: why && why.length >= MIN_WHY ? why : ruleWhy(place, plan) });
    }
    await logRequest({
      userId, endpoint: ENDPOINT, model: DRAFT_MODEL, promptVersion: prompts.VERSIONS.planPlace, status: 'ok',
      latencyMs: Date.now() - started, inputTokens: result.inputTokens, outputTokens: result.outputTokens,
    });
    return picks;
  } catch (err) {
    let status = 'error';
    if (err instanceof AIRefusalError) status = 'refusal';
    else if (isTimeoutError(err)) status = 'timeout';
    else if (err instanceof SyntaxError) status = 'invalid';
    logger.warn('Plan place suggestions: model failed', { userId, status, error: err.message });
    await logRequest({
      userId, endpoint: ENDPOINT, model: DRAFT_MODEL, promptVersion: prompts.VERSIONS.planPlace, status,
      latencyMs: Date.now() - started, errorMessage: err.message, schemaValid: status !== 'invalid',
    });
    return null;
  }
}

/**
 * Up to three public places for the plan, best first.
 *
 * @param {object} p
 * @param {string} p.userId
 * @param {number} p.latitude      Where the picker looks from (the host's fix or home).
 * @param {number} p.longitude
 * @param {object} p.plan          { kind, title, about, startsAt, endsAt, spots, details }
 * @param {string} [p.ask]         What the host is looking for, in their words.
 * @returns {Promise<{ loading: boolean, source: 'ai'|'rules', picks: object[] }>}
 *   Each pick is a place as the picker lists it, with `why`. `loading` while the area's places
 *   are still on their way (ask again). Throws planPlaces.PlacesUnavailableError like the list.
 */
async function suggestPlaces({ userId, latitude, longitude, plan, ask = '' }) {
  const list = await planPlaces.placesNear({
    latitude,
    longitude,
    kind: plan.kind,
    sport: plan.kind === 'pickup_game' ? plan.details?.sport : null,
    startsAt: plan.startsAt,
    endsAt: plan.endsAt,
    limit: MAX_CANDIDATES,
  });
  if (list.loading) return { loading: true, source: 'rules', picks: [] };
  const candidates = list.places.filter((place) => place.hours?.status !== 'closed');
  if (candidates.length === 0) return { loading: false, source: 'rules', picks: [] };
  const timezone = timezoneFromCoordinates(latitude, longitude, 'America/Los_Angeles');
  const chosen = await modelPicks({ userId, plan, ask: String(ask || '').trim(), candidates, timezone });
  if (chosen) return { loading: false, source: 'ai', picks: chosen };
  return { loading: false, source: 'rules', picks: rulePicks(candidates, plan) };
}

module.exports = { suggestPlaces, ruleWhy, ENDPOINT };
