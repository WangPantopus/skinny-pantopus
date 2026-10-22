'use strict';

/**
 * A card's done state, kept on the server (docs/product/ai-assistant-phase3-contract-2026-10-22.md
 * §4.2, §4.3), so a card used on one phone shows as done on another, and after a reinstall.
 *
 * Each action card the assistant shows is an AgentStep proposal keyed by the card's id
 * (agentRecord.js). The apps report what ran (POST /api/ai/cards/:cardId/state), and history
 * returns each card's state to apps that list "state" in `cards`. The report is checked
 * against the stored card: an action it doesn't have is refused, and a link is kept only
 * when it is the action's own done link. A card with no recorded step (older than phase 3,
 * or its recording failed) has no state; the apps keep their own record for it.
 */

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const { isUuid } = require('./assistantKit');

// "Fewer like this", which the nudge engine adds to a nudge's last card: it mutes the kind
// and is kept in `done`, but leaves the card's own buttons open.
const FEWER_ACTION = 'fewer';
const STEP_FIELDS = 'id, status, payload, result, expires_at, updated_at';
const UUID_PATTERN = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';

const sameItem = (a, b) => String(a ?? '') === String(b ?? '');
const doneList = (step) => (Array.isArray(step?.result?.done) ? step.result.done : []);

/** The state the apps get: open, done, dismissed or expired (open, nothing done, past its expiry). */
function stateOf(step, now = Date.now()) {
  const done = doneList(step);
  let status = step.status;
  if (status === 'open' && !done.length && step.expires_at && Date.parse(step.expires_at) <= now) status = 'expired';
  return {
    status,
    done: done.map((entry) => ({ item_id: entry.item_id ?? null, action_id: entry.action_id, at: entry.at, link: entry.link ?? null })),
  };
}

/** The card's action named by the report: a top-level one, or one in the item row it names. */
function findAction(payload, itemId, actionId) {
  if (!payload || typeof payload !== 'object') return null;
  const actions = itemId == null
    ? payload.actions
    : (Array.isArray(payload.items) ? payload.items : []).find((item) => sameItem(item?.id, itemId))?.actions;
  return (Array.isArray(actions) ? actions : []).find((candidate) => candidate?.id === actionId) || null;
}

/** Whether `link` is the action's done link, with each {{…}} placeholder filled by a uuid. */
function isDoneLink(template, link) {
  if (typeof template !== 'string' || typeof link !== 'string' || !template) return false;
  const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = template.split(/\{\{[^{}]*\}\}/).map(escape).join(UUID_PATTERN);
  return new RegExp(`^${pattern}$`).test(link);
}

/** Done once a top-level action ran ("Fewer like this" aside), or every item has a done action. */
function isComplete(payload, done) {
  if (done.some((entry) => entry.item_id == null && entry.action_id !== FEWER_ACTION)) return true;
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return items.length > 0 && items.every((item) => done.some((entry) => entry.item_id != null && sameItem(entry.item_id, item.id)));
}

const refusal = (status, code, message) => ({ status, code, message });

async function readStep(userId, cardId) {
  const { data, error } = await supabaseAdmin.from('AgentStep')
    .select(STEP_FIELDS)
    .eq('user_id', userId)
    .eq('idempotency_key', cardId)
    .eq('type', 'proposal')
    .maybeSingle();
  if (error) throw new Error(`Card state read failed: ${error.message}`);
  return data;
}

/**
 * Record what ran on one of the person's cards (§4.2).
 * @param {string} userId
 * @param {string} cardId  The card's id.
 * @param {{status: 'done'|'dismissed', action_id?: string, item_id?: string|null, link?: string|null}} report
 * @returns {Promise<{state: object}|{status: number, code: string, message: string}>}
 */
async function reportState(userId, cardId, report) {
  const unknown = refusal(404, 'CARD_UNKNOWN', 'Pantopus has no record of this card.');
  if (!isUuid(cardId)) return unknown;
  const itemId = report.item_id ?? null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const step = await readStep(userId, cardId);
    if (!step) return unknown;
    const done = doneList(step);
    let status = step.status;
    if (report.status === 'done') {
      const ran = findAction(step.payload, itemId, report.action_id);
      if (!ran) return refusal(400, 'CARD_ACTION_UNKNOWN', 'That card has no such action.');
      // The first report of an action is kept; a repeat changes nothing.
      if (!done.some((entry) => sameItem(entry.item_id, itemId) && entry.action_id === report.action_id)) {
        done.push({
          item_id: itemId,
          action_id: report.action_id,
          at: new Date().toISOString(),
          link: isDoneLink(ran.done?.link, report.link) ? report.link : null,
        });
      }
      status = isComplete(step.payload, done) ? 'done' : 'open';
    } else if (step.status === 'open' && !done.length) {
      status = 'dismissed';
    }
    const changed = status !== step.status || done.length !== doneList(step).length;
    if (!changed) return { state: stateOf(step) };

    const now = new Date().toISOString();
    const update = {
      status,
      result: { ...(step.result || {}), done },
      updated_at: now,
      done_at: status === 'open' ? null : now,
    };
    // Two reports at once (two phones, or a retry) must not lose one: write only over what was read.
    const { data, error } = await supabaseAdmin.from('AgentStep')
      .update(update)
      .eq('id', step.id)
      .eq('updated_at', step.updated_at)
      .select(STEP_FIELDS);
    if (error) throw new Error(`Card state write failed: ${error.message}`);
    if (data && data.length) return { state: stateOf(data[0]) };
  }
  return refusal(409, 'CARD_BUSY', 'That card changed just now. Try again.');
}

/**
 * Add each action card's state to history items (§4.3), read in one query for the page.
 * A card with no recorded step gets none. A failed read leaves every card without one.
 */
async function attachStates(userId, items) {
  const cards = items.filter((item) => item.draft?.type === 'action' && isUuid(item.draft.draft?.id));
  if (!cards.length) return items;
  try {
    const ids = [...new Set(cards.map((item) => item.draft.draft.id))];
    const { data, error } = await supabaseAdmin.from('AgentStep')
      .select('idempotency_key, status, result, expires_at')
      .eq('user_id', userId)
      .eq('type', 'proposal')
      .in('idempotency_key', ids);
    if (error) throw new Error(error.message);
    const now = Date.now();
    const states = new Map((data || []).map((row) => [row.idempotency_key, stateOf(row, now)]));
    for (const item of cards) {
      const state = states.get(item.draft.draft.id);
      if (state) item.state = state;
    }
  } catch (err) {
    logger.warn('agent.card_states_failed', { userId, error: err.message });
  }
  return items;
}

module.exports = {
  reportState,
  attachStates,
  stateOf,
  findAction,
  isDoneLink,
  isComplete,
  FEWER_ACTION,
};
