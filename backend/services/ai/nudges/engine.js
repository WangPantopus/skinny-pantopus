'use strict';

/**
 * Speaking first: the one way the assistant sends a nudge or the morning brief
 * (docs/product/ai-assistant-phase2-contract-2026-10-20.md §3).
 *
 * sendNudge checks the person's Suggestions switch, the kind's mute, the day's cap
 * (one brief and two nudges per local day, counted from Notification rows, held
 * pushes included) and the idempotency key, then:
 *   1. writes the Notification row: type assistant_nudge (or assistant_brief),
 *      opening pantopus://assistant?nudge=<id>;
 *   2. adds the nudge to the person's latest assistant conversation as an assistant
 *      message with its card(s), stored the way a card tool call is (agentLoop), so
 *      history shows it like any card and the next turn can act on it ("move it to
 *      Sunday");
 *   3. pushes it, or holds the push until quiet hours end (heldPushes.js); a push
 *      still held when the nudge expires is dropped and its row kept.
 * Every card gets "Fewer like this", which mutes the kind for 30 days.
 *
 * Titles and bodies are plain text the trigger writes from facts; nothing here
 * calls the model. A trigger that needs the model (a draft to guests, a judgment)
 * asks canNudge first, so a nudge that won't go out costs nothing, then makes the
 * call through background.js, which answers { ok: false, reason: 'budget' } over
 * its caps: send the plain-text version, or return that reason.
 *
 * Background work reads as the recipient: build cards with nudgeCard (the chat's
 * own card tools and checks, run as them), and check what they may see before
 * writing about it.
 */

const crypto = require('crypto');
const supabaseAdmin = require('../../../config/supabaseAdmin');
const logger = require('../../../utils/logger');
const notificationService = require('../../notificationService');
const pushService = require('../../pushService');
const heldPushes = require('../../heldPushes');
const { composeForHomeId } = require('../../addressCalendarService');
const { isFeatureEnabled } = require('../../featureFlagService');
const { canReadPost, POST_READ_SELECT } = require('../../pulse/readAccess');
const rules = require('../../plans/planRules');
const { compactForStorage } = require('../agentLoop');
const { describeNow, DEFAULT_TIMEZONE } = require('../llm');
const { linkFor } = require('../appGuide');
const { runCardTool, card: makeCard, action } = require('../actionCards');
const { isAssistantOff } = require('../assistantBudget');
const { userTimeZone } = require('../chatContext');
const { clip, isUuid } = require('../assistantKit');
const agentRecord = require('../agentRecord');

// ─── Kinds and limits ──────────────────────────────────────────────────────

// §3.7. A new kind is added here first.
const NUDGE_KINDS = [
  'plan_weather', 'plan_requests_waiting', 'plan_after', 'lost_found_match', 'question_answered',
  'home_overdue', 'home_paperwork', 'radon_follow_up',
  // Phase 3 (docs/product/ai-assistant-phase3-contract-2026-10-22.md §10.1): "Plans you'd like".
  'plan_you_like',
  // Phase 3 §7: a check-back the person asked for (sent with `requested`).
  'follow_up',
];
const KINDS = ['brief', ...NUDGE_KINDS];
// The brief is about the person's day: its subject is the person.
const SUBJECT_TYPES = ['plan', 'post', 'home', 'task', 'person'];
const TYPES = { brief: 'assistant_brief', nudge: 'assistant_nudge' };
const typeOf = (kind) => (kind === 'brief' ? TYPES.brief : TYPES.nudge);
// Per person, per local day.
const DAILY_CAP = { [TYPES.brief]: 1, [TYPES.nudge]: 2 };
const MUTE_MS = 30 * 24 * 60 * 60 * 1000;
const TITLE_MAX = 60;
const BODY_MAX = 160;
const MESSAGE_MAX = 1200;
const MAX_CARDS = 3;
const PICKUP_KINDS = new Set(['garbage', 'recycling', 'yard_waste', 'bulk_pickup']);
// The stored tool call that carries a nudge's card (never offered to the model as a tool).
const NUDGE_TOOL = 'pantopus_suggestion';
const NUDGE_TOOL_ID = /^toolu_nudge_/;
const ICON = '✨';

// The requests the apps send from a card (phase 1 contract §4.3 and phase 2 §8.1). A card
// asking for anything else is a bug in its trigger: the apps would refuse it.
const ID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const ALLOWED_REQUESTS = [
  ['POST', '/api/plans'], ['PATCH', `/api/plans/${ID}`], ['POST', `/api/plans/${ID}/cancel`],
  ['POST', `/api/plans/${ID}/requests`], ['POST', `/api/plans/${ID}/requests/${ID}/(?:accept|decline)`],
  ['POST', '/api/chat/messages'], ['POST', `/api/posts/${ID}/comments`], ['PATCH', `/api/posts/${ID}/solve`],
  ['POST', `/api/homes/${ID}/tasks`], ['POST', `/api/homes/${ID}/tasks/${ID}/recurrence`], ['PUT', '/api/hub/preferences'],
  ['PUT', `/api/homes/${ID}/systems/(?:roof|hvac|water_heater|electrical_panel|sewer_septic|windows)`],
  ['PUT', `/api/homes/${ID}/tasks/${ID}`], ['POST', `/api/ai/nudges/${ID}/fewer`],
].map(([method, path]) => [method, new RegExp(`^${path}$`, 'i')]);
const SAMPLE_ID = '00000000-0000-4000-8000-000000000000';

function allowedRequest(request) {
  if (!request || typeof request.path !== 'string') return false;
  // A follow-up's path is filled in from the first response ({{response.task.id}}).
  const path = request.path.replace(/\{\{response\.[a-z_.]+\}\}/gi, SAMPLE_ID);
  const headers = Object.keys(request.headers || {});
  return ALLOWED_REQUESTS.some(([method, pattern]) => method === request.method && pattern.test(path))
    && headers.every((name) => name.toLowerCase() === 'x-pantopus-session-scope');
}

function allowedAction(item) {
  return Boolean(item) && allowedRequest(item.request) && (!item.then || allowedRequest(item.then.request));
}

function checkCard(envelope) {
  const ok = envelope && typeof envelope === 'object' && isUuid(envelope.id) && typeof envelope.card === 'string'
    && typeof envelope.title === 'string' && Array.isArray(envelope.lines) && Array.isArray(envelope.actions)
    && envelope.actions.every(allowedAction)
    && (!envelope.items || (Array.isArray(envelope.items) && envelope.items.every((row) => Array.isArray(row.actions) && row.actions.every(allowedAction))));
  if (!ok) throw new TypeError(`sendNudge: card ${envelope?.card || '(none)'} is not an action card the apps can send`);
}

// ─── Input ─────────────────────────────────────────────────────────────────

function nudgeKey({ kind, userId, subject, checkpoint }) {
  return `nudge:${kind}:${userId}:${subject.id}:${checkpoint}`;
}

function checkTarget({ userId, kind, subject, checkpoint }) {
  if (!isUuid(userId)) throw new TypeError('sendNudge: userId must be a uuid');
  if (!KINDS.includes(kind)) throw new TypeError(`sendNudge: unknown kind ${kind}`);
  if (!subject || !SUBJECT_TYPES.includes(subject.type) || !isUuid(subject.id)) {
    throw new TypeError('sendNudge: subject must be { type: plan|post|home|task|person, id: uuid }');
  }
  const point = String(checkpoint ?? '').trim();
  if (!point || point.length > 40 || /[\s:]/.test(point)) {
    throw new TypeError('sendNudge: checkpoint must be a short word such as 2026-10-21, 48h or 3h');
  }
  return { userId, kind, subject: { type: subject.type, id: subject.id.toLowerCase() }, checkpoint: point };
}

function normalize(params) {
  const target = checkTarget(params);
  const title = clip(params.title, TITLE_MAX);
  const body = clip(params.body, BODY_MAX);
  if (!title || !body) throw new TypeError('sendNudge: title and body are required');
  const expiresAt = params.expiresAt instanceof Date ? params.expiresAt : new Date(params.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) throw new TypeError('sendNudge: expiresAt must be a date');
  // One card, or up to three (a weather nudge offers a message to guests and a move).
  const given = params.cards ?? params.card ?? null;
  const cards = (Array.isArray(given) ? given : [given]).filter(Boolean);
  if (cards.length > MAX_CARDS) throw new TypeError(`sendNudge: at most ${MAX_CARDS} cards`);
  cards.forEach(checkCard);
  // The conversation's text: the body, or longer lines (the brief).
  const message = typeof params.message === 'string' && params.message.trim()
    ? params.message.trim().slice(0, MESSAGE_MAX)
    : body;
  const pickup = params.pickup && isUuid(params.pickup.homeId) && /^\d{4}-\d{2}-\d{2}$/.test(params.pickup.date || '')
    ? { homeId: params.pickup.homeId, date: params.pickup.date }
    : null;
  if (params.pickup && !pickup) throw new TypeError('sendNudge: pickup must be { homeId: uuid, date: YYYY-MM-DD }');
  // Phase 3 §7.4: the person asked for it (a follow-up). Suggestions, a mute and the day's cap don't stop it.
  const requested = params.requested === true;
  if (requested && target.kind !== 'follow_up') throw new TypeError('sendNudge: only follow-ups are requested');
  return { ...target, title, body, message, expiresAt, cards, pickup, requested };
}

// ─── Checks ────────────────────────────────────────────────────────────────

/** The live entries of a mute map: { kind: ISO time it ends }. */
function activeMutes(muted, now = Date.now()) {
  if (!muted || typeof muted !== 'object' || Array.isArray(muted)) return {};
  return Object.fromEntries(Object.entries(muted).filter(([kind, until]) => KINDS.includes(kind) && Date.parse(until) > now));
}

async function suggestionPrefs(userId) {
  const { data, error } = await supabaseAdmin.from('UserNotificationPreferences')
    .select('suggestions_enabled, suggestions_muted')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`Suggestions preferences read failed: ${error.message}`);
  return { enabled: data?.suggestions_enabled === true, muted: activeMutes(data?.suggestions_muted) };
}

/** The start of the person's local day, as an instant. */
function localMidnight(timeZone, now = new Date()) {
  const today = rules.localParts(now, timeZone);
  return rules.zonedInstant(today.year, today.month, today.day, 0, 0, timeZone);
}

async function sentToday(userId, type, timeZone) {
  const { data, error } = await supabaseAdmin.from('Notification')
    .select('id')
    .eq('user_id', userId)
    .eq('type', type)
    .gte('created_at', localMidnight(timeZone).toISOString())
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(DAILY_CAP[type] + 10);
  if (error) throw new Error(`Day count failed: ${error.message}`);
  return (data || []).map((row) => row.id);
}

async function alreadySent(key) {
  const { data, error } = await supabaseAdmin.from('Notification').select('id').eq('idempotency_key', key).limit(1);
  if (error) throw new Error(`Idempotency read failed: ${error.message}`);
  return Boolean(data && data.length);
}

/** A pickup day the text names counts only when the household set its schedule (the address calendar's "home" rules). */
async function pickupConfirmed(userId, { homeId, date }) {
  try {
    const calendar = await composeForHomeId(homeId, { userId });
    return (calendar.upcoming || []).some((entry) => entry.scope === 'home' && PICKUP_KINDS.has(entry.kind) && entry.date === date);
  } catch (err) {
    logger.warn('nudge.pickup_check_failed', { userId, error: err.message });
    return false;
  }
}

/** A post subject is written about only while the recipient can read it (blocks, moderation, its audience). */
async function subjectReadable(subject, userId) {
  if (subject.type !== 'post') return true;
  const { data: post, error } = await supabaseAdmin.from('Post').select(POST_READ_SELECT).eq('id', subject.id).maybeSingle();
  if (error) throw new Error(`Post read failed: ${error.message}`);
  return Boolean(post) && await canReadPost(post, userId);
}

/**
 * Everything that decides whether a nudge may go, short of sending it.
 * @returns {Promise<{ ok: true, window: object }|{ ok: false, reason: string }>}
 */
async function check(nudge, { now = new Date() } = {}) {
  if (nudge.expiresAt && nudge.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: 'expired' };
  if (isAssistantOff()) return { ok: false, reason: 'off' };
  if (!nudge.requested) {
    const prefs = await suggestionPrefs(nudge.userId);
    if (!prefs.enabled) return { ok: false, reason: 'off' };
    if (prefs.muted[nudge.kind]) return { ok: false, reason: 'muted' };
  }
  if (nudge.pickup && !(await pickupConfirmed(nudge.userId, nudge.pickup))) return { ok: false, reason: 'unconfirmed_pickup' };
  if (await alreadySent(nudgeKey(nudge))) return { ok: false, reason: 'duplicate' };
  // The brief goes at the time they chose: only quiet hours of their own hold it.
  const window = await heldPushes.pushWindow(nudge.userId, { fallbackTz: DEFAULT_TIMEZONE, now, ownOnly: nudge.kind === 'brief' });
  const type = typeOf(nudge.kind);
  // A requested nudge isn't held back by the cap, but its row counts toward it for later suggestions.
  if (!nudge.requested && (await sentToday(nudge.userId, type, window.timeZone)).length >= DAILY_CAP[type]) return { ok: false, reason: 'cap' };
  if (!(await subjectReadable(nudge.subject, nudge.userId))) return { ok: false, reason: 'unreadable' };
  return { ok: true, window };
}

// ─── The conversation ──────────────────────────────────────────────────────

/**
 * The nudge as stored messages: a line saying Pantopus sent it, then the shape a card tool call leaves,
 * each dated when it was sent (`at`, which the apps' history shows).
 */
function transcriptOf({ notificationId, kind, message, cards, sentAt, timeZone }) {
  const base = `toolu_nudge_${notificationId.replace(/-/g, '')}`;
  // A nudge with no card (a requested follow-up) still stores one call, which marks it for history and ?nudge=.
  const shown = cards.length ? cards : [null];
  const uses = shown.map((envelope, i) => ({
    type: 'tool_use', id: `${base}_${i}`, name: NUDGE_TOOL, input: { kind, card: envelope ? envelope.card : null },
  }));
  const at = sentAt.toISOString();
  return [
    // A turn starts with a user message, and this one also says when the nudge came and where its facts
    // came from: without that, the next reply took a brief's facts back as ones it had "never looked up".
    // History hides the line (agentService APP_LINES), so it stays one line without a "]".
    { role: 'user', content: [{ type: 'text', text: `[Suggestion from Pantopus, sent as a notification: ${describeNow(timeZone, sentAt)}. Not a message from the person. Pantopus wrote the message after this from their data, looked up when it was sent, so its facts are real and newer than anything said before it. Stand by them as your own: never doubt or take one back because no tool call here shows it, and look one up again only when it may have changed since.]` }], at },
    { role: 'assistant', content: [{ type: 'text', text: message }, ...uses], at },
    {
      role: 'user',
      content: uses.map((use, i) => ({
        type: 'tool_result',
        tool_use_id: use.id,
        content: JSON.stringify(shown[i]
          ? { draftType: 'action', draft: shown[i], valid: true, nudge: { id: notificationId, kind } }
          : { nudge: { id: notificationId, kind }, shown: 'No card: the message is the whole nudge.' }),
      })),
      at,
    },
  ];
}

const nudgeIdsIn = (messages) => new Set((Array.isArray(messages) ? messages : []).flatMap((message) => (Array.isArray(message?.content) ? message.content : [])
  .filter((block) => block?.type === 'tool_use' && NUDGE_TOOL_ID.test(String(block.id))).map((block) => block.id)));

/**
 * The nudges stored in `latest` that `before` didn't hold, as their messages. A chat turn
 * reads the conversation when it starts and saves its whole transcript when it ends, so a
 * nudge that arrived meanwhile would be lost; the turn's save adds these back.
 */
function nudgesSentDuring(before, latest) {
  const had = nudgeIdsIn(before);
  const added = [];
  const stored = Array.isArray(latest) ? latest : [];
  for (let i = 1; i + 1 < stored.length; i++) {
    const ids = [...nudgeIdsIn([stored[i]])];
    if (stored[i].role !== 'assistant' || !ids.length || ids.some((id) => had.has(id))) continue;
    added.push(stored[i - 1], stored[i], stored[i + 1]);
  }
  return added;
}

/** The person's most recent conversation, or a new one titled for the nudge. */
async function latestConversation(userId, title) {
  const { data, error } = await supabaseAdmin.from('AIConversation')
    .select('id, messages, message_count, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Conversation read failed: ${error.message}`);
  if (data) return { conversation: data, created: false };
  const { data: created, error: createError } = await supabaseAdmin.from('AIConversation')
    .insert({ user_id: userId, title: clip(title, 60) || 'Pantopus' })
    .select('id, messages, message_count, updated_at')
    .single();
  if (createError) throw new Error(`Conversation create failed: ${createError.message}`);
  return { conversation: created, created: true };
}

/**
 * Whether a nudge's messages are in the conversation, read again after a save that failed.
 * A read that fails too counts as not stored: the row is then removed, as for any failed save.
 */
async function nudgeStored(conversationId, notificationId) {
  const ownId = `toolu_nudge_${notificationId.replace(/-/g, '')}_0`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabaseAdmin.from('AIConversation').select('messages').eq('id', conversationId).maybeSingle();
    if (!error) return Boolean(data) && nudgeIdsIn(data.messages).has(ownId);
    await new Promise((resolve) => { setTimeout(resolve, 1000); });
  }
  return false;
}

/** Append messages to a conversation, retrying when a chat turn or another nudge saved it meanwhile. */
async function appendToConversation(conversation, added) {
  let current = conversation;
  for (let attempt = 0; attempt < 3; attempt++) {
    const now = new Date().toISOString();
    const messages = compactForStorage([...(Array.isArray(current.messages) ? current.messages : []), ...added]);
    const { data, error } = await supabaseAdmin.from('AIConversation')
      .update({ messages, message_count: (current.message_count || 0) + 1, last_message_at: now, updated_at: now })
      .eq('id', current.id)
      .eq('updated_at', current.updated_at)
      .select('id');
    if (error) throw new Error(`Conversation save failed: ${error.message}`);
    if (data && data.length) return;
    const { data: fresh, error: readError } = await supabaseAdmin.from('AIConversation')
      .select('id, messages, message_count, updated_at').eq('id', current.id).maybeSingle();
    if (readError || !fresh) throw new Error('The conversation went away while the nudge was saved');
    current = fresh;
  }
  throw new Error('The conversation kept changing while the nudge was saved');
}

// ─── Push ──────────────────────────────────────────────────────────────────

// ─── Notification buttons (phase 3 §9) ─────────────────────────────────────

// The only card actions a notification button may run: Mark done (a task's status to done, nothing
// else) and Mark solved (the person's own question). "Fewer like this" is the category's own button.
const BUTTON_ACTIONS = [
  ['done', 'PUT', new RegExp(`^/api/homes/${ID}/tasks/${ID}$`, 'i'), (body) => JSON.stringify(body) === '{"status":"done"}'],
  ['solved', 'PATCH', new RegExp(`^/api/posts/${ID}/solve$`, 'i'), () => true],
];
const CATEGORIES = {
  suggestion: 'ASSISTANT_SUGGESTION', done: 'ASSISTANT_DONE', solved: 'ASSISTANT_SOLVED', done_only: 'ASSISTANT_DONE_ONLY', solved_only: 'ASSISTANT_SOLVED_ONLY',
};

/**
 * The push category and the one action a button runs (§9.2), from all of a nudge's cards: a button
 * only when exactly one action qualifies. A requested nudge (a follow-up) has no "Fewer like this".
 * @returns {{ push_category?: string, assistant_action?: string }}
 */
function pushButtons(cards, { requested = false } = {}) {
  const found = [];
  for (const envelope of cards) {
    const rows = [{ item: null, actions: envelope.actions || [] }, ...(envelope.items || []).map((item) => ({ item, actions: item.actions || [] }))];
    for (const { item, actions } of rows) {
      for (const candidate of actions) {
        const request = candidate?.request;
        const match = request && BUTTON_ACTIONS.find(([, method, path, body]) => request.method === method && path.test(String(request.path)) && body(request.body || {}));
        if (match && !candidate.then) found.push({ kind: match[0], envelope, item, candidate });
      }
    }
  }
  const one = found.length === 1 ? found[0] : null;
  if (!one) return requested ? {} : { push_category: CATEGORIES.suggestion };
  const { kind, envelope, item, candidate } = one;
  return {
    push_category: CATEGORIES[requested ? `${kind}_only` : kind],
    // A JSON string: FCM data values are strings. The card's own request, exactly.
    assistant_action: JSON.stringify({
      card_id: envelope.id, item_id: item ? item.id : null, action_id: candidate.id,
      method: candidate.request.method, path: candidate.request.path, body: candidate.request.body || {},
    }),
  };
}

/** The push carries what opens the nudge, never the card (a push holds about 4 KB). */
async function pushNudge(row) {
  if (!(await notificationService.isPushEnabled(row.user_id))) return;
  await pushService.sendToUser(row.user_id, {
    title: row.title,
    body: row.body || '',
    data: {
      notificationId: row.id,
      type: row.type,
      link: row.link,
      kind: row.metadata?.kind || null,
      conversation_id: row.metadata?.conversation_id || null,
      recipient_user_id: row.user_id,
      // Phase 3 §9.2: set from the stored row each time, so a push held through quiet hours carries them too.
      ...(row.metadata?.push_category ? { category: row.metadata.push_category } : {}),
      ...(row.metadata?.assistant_action ? { assistant_action: row.metadata.assistant_action } : {}),
      // A standing rule's pickup reminder (§18.4) is the evening briefing's push: its date and home, for Bins out.
      ...(row.metadata?.pickup_date ? { pickupDate: row.metadata.pickup_date, homeId: row.metadata.home_id || null } : {}),
    },
  });
}

// The yearly memory review (phase 3 §5.5) is released with the nudges, but it isn't one;
// neither are a standing rule's notices (§18.5): its runs, pauses and pickup reminders.
const MEMORY_REVIEW_TYPE = 'assistant_memory_review';
const RULE_TYPE = 'assistant_rule';

/** A held push goes only if the nudge is still current and wanted when quiet hours end. */
async function heldPushDropped(row) {
  if (!(Date.parse(row.metadata?.expires_at) > Date.now())) return true;
  // About the person's own data, a rule they turned on, or asked for by them (a follow-up): neither Suggestions
  // nor a mute drops it, only its expiry.
  if (row.type === MEMORY_REVIEW_TYPE || row.type === RULE_TYPE || row.metadata?.requested === true) return false;
  if (isAssistantOff()) return true;
  const prefs = await suggestionPrefs(row.user_id);
  return !prefs.enabled || Boolean(prefs.muted[row.metadata?.kind]);
}

/** A held push that went out or was dropped: the nudge's notify step says so (agentRecord.js). */
function recordReleased(row, { dropped }) {
  return agentRecord.notifyReleased(row.metadata?.agent_request_id, row.user_id, dropped ? 'dropped' : 'sent');
}

/** Every 5 minutes (jobs/index.js): held nudge and brief pushes whose quiet hours are over. */
async function releaseHeldNudges() {
  const result = await heldPushes.releaseHeldPushes({
    types: [...Object.values(TYPES), MEMORY_REVIEW_TYPE, RULE_TYPE], send: pushNudge, isDropped: heldPushDropped, onReleased: recordReleased,
  });
  if (result.sent || result.dropped) logger.info('nudges.held_pushes', result);
  return result;
}

// ─── Sending ───────────────────────────────────────────────────────────────

function withFewerLikeThis(cards, { notificationId, title, expiresAt }) {
  const expires = expiresAt.toISOString();
  const list = cards.map((envelope) => ({ ...envelope, expires_at: expires }));
  // A nudge without a card still gets one, to carry "Fewer like this".
  if (!list.length) list.push(makeCard('suggestion', { title, expiresAt: expires }));
  const fewer = action('fewer', 'Fewer like this', { method: 'POST', path: `/api/ai/nudges/${notificationId}/fewer`, body: {} },
    { label: "You'll see fewer like this", link: linkFor('notification_settings') }, { style: 'secondary' });
  const last = list[list.length - 1];
  list[list.length - 1] = { ...last, actions: [...last.actions, fewer] };
  return list;
}

async function deleteRow(table, id) {
  const { error } = await supabaseAdmin.from(table).delete().eq('id', id);
  if (error) logger.warn('nudge.cleanup_failed', { table, id, error: error.message });
}

async function deliver(nudge, { window }) {
  const { userId, kind, subject } = nudge;
  const type = typeOf(kind);
  const key = nudgeKey(nudge);
  const notificationId = crypto.randomUUID();
  // The nudge's AgentRequest (phase 3 contract §4.1), named on the row so a held push can update it.
  const requestId = crypto.randomUUID();
  const { conversation, created } = await latestConversation(userId, nudge.title);
  // A requested nudge carries no "Fewer like this" (and no card of its own just for it).
  const cards = nudge.requested
    ? nudge.cards.map((envelope) => ({ ...envelope, expires_at: nudge.expiresAt.toISOString() }))
    : withFewerLikeThis(nudge.cards, { notificationId, title: nudge.title, expiresAt: nudge.expiresAt });
  // A nudge that doesn't go out leaves nothing behind: its row, and a conversation made for it.
  const undo = async (reason, { row = false } = {}) => {
    if (row) await deleteRow('Notification', notificationId);
    if (created) await deleteRow('AIConversation', conversation.id);
    return { sent: false, reason };
  };

  const row = await notificationService.createNotification({
    id: notificationId,
    userId,
    type,
    title: nudge.title,
    body: nudge.body,
    icon: ICON,
    link: `${linkFor('assistant')}?nudge=${notificationId}`,
    metadata: {
      kind,
      conversation_id: conversation.id,
      subject,
      card: cards[0] || null,
      expires_at: nudge.expiresAt.toISOString(),
      push_deferred_until: null,
      push_sent_at: null,
      // The inbox shows a row about a post only while its reader still can read the post.
      ...(subject.type === 'post' ? { post_id: subject.id } : {}),
      agent_request_id: requestId,
      ...(nudge.requested ? { requested: true } : {}),
      ...pushButtons(cards, { requested: nudge.requested }),
    },
    idempotencyKey: key,
    sendPush: false,
  });
  if (!row) {
    const { data: mine } = await supabaseAdmin.from('Notification').select('id').eq('id', notificationId).maybeSingle();
    // Written, then hidden by the inbox's read check (the post became unreadable just now).
    if (mine) return undo('unreadable', { row: true });
    if (await alreadySent(key)) return undo('duplicate');
    logger.warn('nudge.create_failed', { userId, kind });
    return undo('error');
  }

  // Two triggers at once could both pass the day's count: the later rows step back.
  const today = await sentToday(userId, type, window.timeZone);
  if (!nudge.requested && today.indexOf(notificationId) >= DAILY_CAP[type]) return undo('cap', { row: true });

  try {
    await appendToConversation(conversation, transcriptOf({
      notificationId, kind, message: nudge.message, cards, sentAt: new Date(row.created_at), timeZone: window.timeZone,
    }));
  } catch (err) {
    // A save whose answer timed out may still have reached the database: then the nudge stands,
    // or its message would be left in the conversation with a "Fewer like this" that has no row.
    if (!(await nudgeStored(conversation.id, notificationId))) {
      logger.warn('nudge.conversation_failed', { userId, kind, error: err.message });
      return undo('error', { row: true });
    }
    logger.info('nudge.conversation_saved_late', { userId, kind, error: err.message });
  }

  let pushed = 'sent';
  try {
    const { heldUntil } = await heldPushes.pushOrHold(row, { send: pushNudge, fallbackTz: window.timeZone, ownOnly: kind === 'brief' });
    if (heldUntil) pushed = 'held';
  } catch (err) {
    // The row and the message stand; only the push is lost.
    logger.warn('nudge.push_failed', { userId, kind, error: err.message });
    pushed = 'dropped';
  }
  // Its request, cards and push, so the cards' done states can be reported (fail-open: never throws).
  await agentRecord.nudgeSent({
    id: requestId, userId, conversationId: conversation.id, kind, subject, notificationId, cards, notify: type, pushed,
  });
  return { sent: true, notificationId };
}

/**
 * Send a nudge (§3.5).
 * @param {object} p
 * @param {string} p.userId           The recipient.
 * @param {string} p.kind             One of KINDS (§3.7).
 * @param {{type: 'plan'|'post'|'home'|'task', id: string}} p.subject  What it is about.
 * @param {string} p.checkpoint       Part of the idempotency key: a local date or a named moment (48h, 24h, 3h).
 * @param {string} p.title            Plain text, up to 60 characters.
 * @param {string} p.body             Plain text, up to 160 characters; also the line in the conversation.
 * @param {object|object[]|null} p.card  An action-card envelope (nudgeCard builds one), up to three, or null.
 * @param {Date} p.expiresAt          Never delivered after this; also the cards' expiry.
 * @param {{homeId: string, date: string}} [p.pickup]  The pickup day the text names, if any; refused unless the household set it.
 * @param {string} [p.message]        Longer text for the conversation than the body (the brief's lines).
 * @returns {Promise<{sent: true, notificationId: string}|{sent: false, reason: string}>}
 *   reason: 'off' | 'muted' | 'cap' | 'duplicate' | 'expired' | 'unconfirmed_pickup' | 'unreadable' | 'error'
 *   ('budget' comes from background.js, for a trigger that needed the model).
 */
async function sendNudge(params) {
  const nudge = normalize(params);
  try {
    const verdict = await check(nudge);
    if (!verdict.ok) return { sent: false, reason: verdict.reason };
    return await deliver(nudge, verdict);
  } catch (err) {
    logger.warn('nudge.failed', { userId: nudge.userId, kind: nudge.kind, error: err.message });
    return { sent: false, reason: 'error' };
  }
}

/**
 * Send the morning brief (§4): a nudge of kind "brief" about the person's day, at most one a
 * local day, with up to three cards. Its push is held only by quiet hours they set themselves.
 * @param {{userId: string, date: string, lines: string[], cards: object[], expiresAt: Date, title?: string}} p
 *   date: their local date (YYYY-MM-DD), the brief's checkpoint.
 */
async function sendBrief({ userId, date, lines, cards = [], expiresAt, title = 'Your Morning Briefing' }) {
  return sendNudge({
    userId,
    kind: 'brief',
    subject: { type: 'person', id: userId },
    checkpoint: date,
    title,
    // The notification shows the first line (two when they fit); the conversation keeps them all.
    body: lines.length > 1 && `${lines[0]} ${lines[1]}`.length <= BODY_MAX ? `${lines[0]} ${lines[1]}` : lines[0],
    message: lines.join('\n'),
    card: cards,
    expiresAt,
  });
}

/**
 * Whether a nudge would go now, without sending it: ask before drafting with the model.
 * @param {{userId: string, kind: string, subject: object, checkpoint: string}} p
 * @returns {Promise<{ok: true}|{ok: false, reason: string}>}
 */
async function canNudge(params) {
  const target = checkTarget(params);
  try {
    const verdict = await check({ ...target, expiresAt: null, pickup: null });
    return verdict.ok ? { ok: true } : verdict;
  } catch (err) {
    logger.warn('nudge.check_failed', { userId: target.userId, kind: target.kind, error: err.message });
    return { ok: false, reason: 'error' };
  }
}

/**
 * A card for a nudge, built exactly as the chat builds it (actionCards.js), as the recipient:
 * the same fields, checks and requests. Session-scoped requests go without the scope header, so
 * a follow-up that requires it (starting a repeating task's recurrence) answers 409: build nudge
 * cards without repeats.
 *   const { card, error } = await nudgeCard('draft_plan_message', { plan_id, text, note: null }, { userId, expiresAt });
 * @returns {Promise<{card: object}|{error: string}>}
 */
async function nudgeCard(toolName, args, { userId, expiresAt = null }) {
  if (!isUuid(userId)) throw new TypeError('nudgeCard: userId must be a uuid');
  const [timeZone, plansEnabled] = await Promise.all([
    userTimeZone(userId),
    isFeatureEnabled('plans', userId).catch(() => false),
  ]);
  const result = await runCardTool(toolName, args, { userId, user: { id: userId, role: null }, timeZone, plansEnabled, sessionScope: null });
  if (!result) return { error: `Unknown card tool ${toolName}` };
  if (result.error || result.draftType !== 'action' || !result.draft) return { error: result.error || result.message || 'No card' };
  return { card: { ...result.draft, ...(expiresAt ? { expires_at: new Date(expiresAt).toISOString() } : {}) } };
}

// ─── "Fewer like this" ─────────────────────────────────────────────────────

/**
 * Mute the kind of one of the person's nudges (or briefs) for 30 days (§3.6).
 * @returns {Promise<{ok: true, kind: string, muted_until: string}|null>} null when it isn't theirs.
 */
async function fewerLikeThis(userId, notificationId) {
  if (!isUuid(notificationId)) return null;
  const { data: row, error } = await supabaseAdmin.from('Notification')
    .select('id, metadata')
    .eq('id', notificationId)
    .eq('user_id', userId)
    .in('type', Object.values(TYPES))
    .maybeSingle();
  if (error) throw new Error(`Nudge read failed: ${error.message}`);
  const kind = row?.metadata?.kind;
  if (!KINDS.includes(kind)) return null;

  const mutedUntil = new Date(Date.now() + MUTE_MS).toISOString();
  const { data: prefs, error: readError } = await supabaseAdmin.from('UserNotificationPreferences')
    .select('user_id, suggestions_muted').eq('user_id', userId).maybeSingle();
  if (readError) throw new Error(`Preferences read failed: ${readError.message}`);
  const muted = { ...activeMutes(prefs?.suggestions_muted), [kind]: mutedUntil };
  const write = prefs
    ? supabaseAdmin.from('UserNotificationPreferences').update({ suggestions_muted: muted, updated_at: new Date().toISOString() }).eq('user_id', userId)
    // As PUT /api/hub/preferences creates a row: both briefings on.
    : supabaseAdmin.from('UserNotificationPreferences').upsert({
      user_id: userId, daily_briefing_enabled: true, evening_briefing_enabled: true, suggestions_muted: muted,
    }, { onConflict: 'user_id' });
  const { error: writeError } = await write;
  if (writeError) throw new Error(`Mute failed: ${writeError.message}`);
  return { ok: true, kind, muted_until: mutedUntil };
}

module.exports = {
  sendNudge,
  sendBrief,
  canNudge,
  nudgeCard,
  fewerLikeThis,
  releaseHeldNudges,
  nudgesSentDuring,
  // The push a nudge sends, also for the memory review (memory.js).
  pushNudge,
  pushButtons,
  KINDS,
  NUDGE_KINDS,
  TYPES,
  DAILY_CAP,
};
