// Commit notifications share the existing Postgres LISTEN connection. Only row
// keys travel through NOTIFY; the handler reads current, authorized chat data.
const syncChanged = require('./syncChangedService');
const logger = require('../utils/logger');
const processId = require('crypto').randomUUID();
const typingPending = new Map();
const typingRunning = new Set();
let typingHandler;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pending = new Map();
const delivered = new Map();
const running = new Set();
let io;
let handler;
let timer;
let subscribed = false;

function setHandler(value) { handler = value; }
function setTypingHandler(value) { typingHandler = value; }

function init(value) {
  io = value;
  if (subscribed) return;
  subscribed = true;
  syncChanged.onChange((change) => {
    if (change.t === 'ChatMessage' && change.m && change.op) announce(change);
    if (change.t === 'ChatRead' && change.u) announce(change);
    if (change.t === 'ChatTyping' && change.origin !== processId) queueTyping(change);
  });
}

function invalidate(roomId) {
  io?.to(roomId).emit('sync:changed', { topics: [`chat:${roomId}`, 'chats'], at: new Date().toISOString() });
}

function announce(change, prepared) {
  if (!io || !handler || !UUID.test(change.r || '') || !UUID.test(change.m || change.u || '')) return;
  const key = change.t === 'ChatRead' ? `read:${change.r}:${change.u}` : change.m;
  const previous = pending.get(key);
  if (pending.size >= 1000 && !previous) { invalidate(change.r); return; }
  const newer = !previous || Number(change.v || 0) >= Number(previous.change.v || 0);
  pending.set(key, {
    change: newer ? change : previous.change,
    inserted: change.op === 'INSERT' || previous?.inserted || false,
    prepared: newer ? prepared : previous.prepared,
  });
  if (!timer) timer = setTimeout(drain, 10);
}

function drain() {
  timer = null;
  for (const [key, item] of pending) {
    if (running.size >= 8) break;
    if (running.has(key)) continue;
    pending.delete(key);
    running.add(key);
    const seen = delivered.get(key);
    const version = Number(item.change.v || 0);
    const read = item.change.t === 'ChatRead';
    const insert = item.inserted && !seen?.inserted;
    Promise.resolve().then(async () => {
      if (!read && !insert && seen && version <= seen.version) return;
      const prepared = seen && version < seen.version ? null : item.prepared;
      const appliedVersion = await handler(io, { ...item.change, insert }, prepared);
      delivered.delete(key);
      delivered.set(key, { version: Math.max(version, appliedVersion || 0, seen?.version || 0), inserted: insert || seen?.inserted });
      while (delivered.size > 5000) delivered.delete(delivered.keys().next().value);
    }).catch((error) => {
      logger.warn('chat_realtime_delivery_failed', { code: error.code });
      invalidate(item.change.r);
    }).finally(() => {
      running.delete(key);
      if (pending.size && !timer) timer = setTimeout(drain, 0);
    });
  }
}

function publishTyping(roomId, userId, typing) {
  if (!UUID.test(roomId || '') || !UUID.test(userId || '')) return;
  const change = { t: 'ChatTyping', r: roomId, u: userId, typing, at: Date.now(), origin: processId };
  queueTyping(change);
  syncChanged.publishChatTyping(change);
}

function queueTyping(change) {
  if (!io || !typingHandler || !UUID.test(change.r || '') || !UUID.test(change.u || '')
    || typeof change.typing !== 'boolean' || !Number.isFinite(change.at)
    || Math.abs(Date.now() - change.at) > 5000) return;
  const key = `${change.r}:${change.u}`;
  if (typingPending.size >= 128 && !typingPending.has(key)) return;
  if ((typingPending.get(key)?.at || 0) > change.at) return;
  typingPending.set(key, change);
  drainTyping();
}

function drainTyping() {
  for (const [key, change] of typingPending) {
    if (typingRunning.size >= 4) break;
    if (typingRunning.has(key)) continue;
    typingPending.delete(key);
    typingRunning.add(key);
    Promise.resolve().then(() => {
      if (Date.now() - change.at <= 5000) return typingHandler(io, change);
    }).catch((error) => {
      logger.warn('chat_typing_unavailable', { code: error.code });
    }).finally(() => {
      typingRunning.delete(key);
      drainTyping();
    });
  }
}

module.exports = { init, setHandler, announce, setTypingHandler, publishTyping };
