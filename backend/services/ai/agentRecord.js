'use strict';

/**
 * The assistant's record of what it was asked and what it did
 * (docs/product/ai-assistant-phase3-contract-2026-10-22.md §3, §4.1).
 *
 * Every chat turn, brief, nudge and follow-up is one AgentRequest. Its steps
 * (AgentStep) are the tool calls (name, status line, outcome and time; never
 * their inputs or outputs), the cards shown (`proposal`, keyed by the card's id,
 * which is how a card's done state is found later: cardState.js) and the pushes
 * sent, held or dropped (`notify`).
 *
 * Recording never blocks. A write that fails is logged as agent.record_failed and
 * the turn or nudge goes on as before; its cards simply have no server state.
 * Only the backend's service role reads or writes these tables, and every query
 * names the person.
 */

const crypto = require('crypto');
const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const { isUuid, clip } = require('./assistantKit');

// The chat keeps a card's stored result whole up to this (agentLoop MAX_STORED_CARD_CHARS);
// a bigger card isn't recorded, so it keeps only the app's own record.
const MAX_CARD_CHARS = 32000;

function recordFailed(what, err, fields = {}) {
  logger.warn('agent.record_failed', { what, error: err?.message || String(err), ...fields });
}

const isoOrNull = (value) => {
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
};

/** A short code for a tool call that failed: never its inputs, outputs or anyone's words. */
function toolErrorCode(result, known) {
  if (!known) return 'unknown_tool';
  const text = String(result?.error || '');
  if (/timed out/i.test(text)) return 'timeout';
  if (/failed:/i.test(text)) return 'failed';
  return 'refused';
}

/** The proposal step for an action card's envelope, or null when it can't be recorded. */
function proposalFields(envelope) {
  if (!envelope || typeof envelope !== 'object' || !isUuid(envelope.id) || typeof envelope.card !== 'string') return null;
  let size;
  try {
    size = JSON.stringify(envelope).length;
  } catch {
    return null;
  }
  if (size > MAX_CARD_CHARS) return null;
  return {
    type: 'proposal',
    name: clip(envelope.card, 60) || 'card',
    label: clip(envelope.title, 120),
    status: 'open',
    payload: envelope,
    idempotency_key: envelope.id,
    expires_at: isoOrNull(envelope.expires_at),
  };
}

async function insertRequest(row) {
  try {
    const { error } = await supabaseAdmin.from('AgentRequest').insert(row);
    if (error) throw new Error(error.message);
    return true;
  } catch (err) {
    recordFailed('request', err, { origin: row.origin, userId: row.user_id });
    return false;
  }
}

async function insertSteps(rows) {
  if (!rows.length) return;
  try {
    const { error } = await supabaseAdmin.from('AgentStep').insert(rows);
    if (error) throw new Error(error.message);
  } catch (err) {
    recordFailed('steps', err, { requestId: rows[0].request_id, types: [...new Set(rows.map((row) => row.type))].join(',') });
  }
}

/** Whether the person still lives in (can see) this home: a chat turn's request names only such a home. */
async function visibleHome(userId, homeId) {
  if (!isUuid(homeId)) return null;
  const { data, error } = await supabaseAdmin.from('HomeOccupancy')
    .select('home_id')
    .eq('user_id', userId)
    .eq('home_id', homeId)
    .eq('is_active', true)
    .limit(1);
  if (error) throw new Error(error.message);
  return data && data.length ? homeId : null;
}

/**
 * One chat turn's request (§4.1). The request is written as soon as the conversation is
 * known, without waiting; each tool call and card adds a step once it exists; close() ends it.
 *
 *   const record = chatTurn({ userId, conversationId });
 *   record.tool(name, { label, result, latencyMs });
 *   record.card(envelope);
 *   await record.close({ status: 'done' });                       // or 'couldnt', error: 'timeout'
 *   const id = await record.ready();                              // the id, or null when it wasn't written
 */
function chatTurn({ userId, conversationId }) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const created = insertRequest({
    id, user_id: userId, conversation_id: conversationId || null, origin: 'chat', status: 'working', created_at: now, updated_at: now,
  });
  let seq = 0;
  const writes = [];
  const add = (fields) => {
    const step = { request_id: id, user_id: userId, seq: ++seq, ...fields };
    writes.push(created.then((ok) => (ok ? insertSteps([step]) : null)));
  };
  let closed = false;
  return {
    id,
    ready: async () => ((await created) ? id : null),
    tool(name, { label = null, result = null, latencyMs = null, known = true } = {}) {
      const failed = Boolean(result?.error);
      add({
        type: 'tool',
        name: clip(String(name || 'unknown'), 60) || 'unknown',
        label: clip(label, 120),
        status: failed ? 'error' : 'ok',
        latency_ms: Number.isFinite(latencyMs) ? Math.round(latencyMs) : null,
        error: failed ? toolErrorCode(result, known) : null,
      });
    },
    card(envelope) {
      const fields = proposalFields(envelope);
      if (fields) add(fields);
    },
    /** End the request: done, or couldnt with a short error code. The screen's home is kept when it is theirs. */
    async close({ status = 'done', error = null, homeId = null } = {}) {
      if (closed) return;
      closed = true;
      await Promise.allSettled(writes);
      if (!(await created)) return;
      try {
        const home = homeId ? await visibleHome(userId, homeId).catch(() => null) : null;
        const at = new Date().toISOString();
        const { error: updateError } = await supabaseAdmin.from('AgentRequest')
          .update({
            status, closed_at: at, updated_at: at, outcome: error ? { error: clip(error, 60) } : {}, ...(home ? { home_id: home } : {}),
          })
          .eq('id', id)
          .eq('user_id', userId);
        if (updateError) throw new Error(updateError.message);
      } catch (err) {
        recordFailed('close', err, { requestId: id });
      }
    },
  };
}

/**
 * A brief or nudge the engine sent (§4.1): its request, one proposal step per card and one
 * notify step. Never throws.
 * @param {object} p
 * @param {string} p.id              The request's id, chosen before the Notification row was written.
 * @param {string} p.userId
 * @param {string} p.conversationId  The conversation the nudge went into.
 * @param {string} p.kind
 * @param {object} p.subject         { type, id }
 * @param {string} p.notificationId
 * @param {object[]} p.cards         The envelopes as sent ("Fewer like this" included).
 * @param {string} p.notify          The notification type (assistant_nudge, assistant_brief, ...).
 * @param {'sent'|'held'|'dropped'} p.pushed
 */
async function nudgeSent({ id, userId, conversationId, kind, subject, notificationId, cards = [], notify, pushed }) {
  const at = new Date().toISOString();
  const home = subject?.type === 'home' && isUuid(subject.id) ? subject.id : null;
  const ok = await insertRequest({
    id,
    user_id: userId,
    conversation_id: conversationId || null,
    home_id: home,
    origin: 'nudge',
    kind: clip(kind, 40),
    status: 'done',
    subject: subject || null,
    outcome: { notification_id: notificationId },
    created_at: at,
    updated_at: at,
    closed_at: at,
  });
  if (!ok) return false;
  const steps = cards.map(proposalFields).filter(Boolean);
  steps.push({ type: 'notify', name: clip(notify, 60) || 'notification', label: null, status: pushed });
  await insertSteps(steps.map((fields, i) => ({ request_id: id, user_id: userId, seq: i + 1, ...fields })));
  return true;
}

/** A held push went out, or was dropped, when quiet hours ended: its notify step says so. Never throws. */
async function notifyReleased(requestId, userId, status) {
  if (!isUuid(requestId) || !isUuid(userId)) return;
  try {
    const { error } = await supabaseAdmin.from('AgentStep')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('request_id', requestId)
      .eq('user_id', userId)
      .eq('type', 'notify')
      .eq('status', 'held');
    if (error) throw new Error(error.message);
  } catch (err) {
    recordFailed('notify', err, { requestId });
  }
}

module.exports = {
  chatTurn,
  nudgeSent,
  notifyReleased,
  proposalFields,
  insertRequest,
  insertSteps,
  recordFailed,
  MAX_CARD_CHARS,
};
