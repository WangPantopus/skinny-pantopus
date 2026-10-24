// Ephemeral presence uses the existing PG listener, with expiring per-process
// leases. No user activity or last-seen timestamps are persisted. Only explicit
// room subscribers hear it, after the same current authorization as typing.
const { randomUUID } = require('crypto');
const sync = require('./syncChangedService');
const db = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const origin = randomUUID();
const LEASE_MS = 45_000;
const local = new Set();
const remote = new Map(); // user -> process -> lease deadline
const watches = new Map(); // room -> subscribed socket IDs
const pending = new Map();
const running = new Set();
const changedUsers = new Set();
const resolvingUsers = new Set();
let io;
let emit;
let heartbeatRunning = false;
let initialized = false;
let remoteLeases = 0;

function online(user) {
  if (local.has(user)) return true;
  return [...remote.get(user)?.values() || []].some((until) => until > Date.now());
}

async function publish(users, state = true) {
  for (let offset = 0; offset < users.length; offset += 100) {
    const batch = users.slice(offset, offset + 100).filter((user) => local.has(user) === state);
    if (!batch.length) continue;
    await sync.publishChatSignal({ t: 'ChatPresence', origin, users: batch,
      online: state, at: Date.now() });
  }
}

function queue(room, user, state, socketId) {
  const key = `${room}:${user}:${socketId || '*'}`;
  if (pending.size >= 512 && !pending.has(key)) return;
  pending.set(key, { r: room, u: user, online: state, at: Date.now(), socketId });
  drain();
}

function drain() {
  for (const [key, change] of pending) {
    if (running.size >= 4) break;
    if (running.has(key)) continue;
    pending.delete(key);
    running.add(key);
    Promise.resolve().then(() => {
      if (Date.now() - change.at < 5000 && online(change.u) === change.online) {
        return emit(io, { ...change, isCurrent: () => online(change.u) === change.online });
      }
    }).catch((error) => logger.warn('Chat presence unavailable', { code: error.code }))
      .finally(() => { running.delete(key); drain(); });
  }
}

// Resolve a changed person's membership only in locally watched rooms. A user
// with thousands of unrelated conversations does not enlarge this query.
async function changed(user) {
  const rooms = [...watches.keys()];
  for (let offset = 0; offset < rooms.length; offset += 200) {
    const { data, error } = await db.from('ChatParticipant').select('room_id')
      .eq('user_id', user).eq('is_active', true).in('room_id', rooms.slice(offset, offset + 200));
    if (error) return;
    for (const row of data || []) queue(row.room_id, user, online(user));
  }
}

function scheduleChanged(user) {
  if (changedUsers.size < 512) changedUsers.add(user);
  for (const id of changedUsers) {
    if (resolvingUsers.size >= 4) break;
    if (resolvingUsers.has(id)) continue;
    changedUsers.delete(id);
    resolvingUsers.add(id);
    changed(id).catch(() => {}).finally(() => {
      resolvingUsers.delete(id);
      if (changedUsers.size) scheduleChanged(changedUsers.values().next().value);
    });
  }
}

function updateLocal(user, state) {
  const previous = online(user);
  if (state) local.add(user); else local.delete(user);
  if (previous !== online(user)) scheduleChanged(user);
  publish([user], state).catch(() => {});
}

function receive(change) {
  if (change.origin === origin || !UUID.test(change.origin || '') || !Array.isArray(change.users)
    || change.users.length > 100 || change.users.some((id) => !UUID.test(id))
    || !Number.isFinite(change.at) || Math.abs(Date.now() - change.at) > 5000) return;
  if (change.t === 'ChatPresenceQuery') {
    publish(change.users.filter((id) => local.has(id))).catch(() => {});
    return;
  }
  if (change.t !== 'ChatPresence' || typeof change.online !== 'boolean') return;
  for (const user of change.users) {
    const previous = online(user);
    const leases = remote.get(user) || new Map();
    if (change.online) {
      // Fixed memory ceiling. Overflow leaves unknown presence; it cannot block chat.
      if (!leases.has(change.origin) && remoteLeases >= 20_000) continue;
      if (!leases.has(change.origin)) remoteLeases += 1;
      leases.set(change.origin, change.at + LEASE_MS);
      remote.set(user, leases);
    } else {
      if (leases.delete(change.origin)) remoteLeases -= 1;
      if (!leases.size) remote.delete(user);
    }
    if (previous !== online(user)) scheduleChanged(user);
  }
}

async function heartbeat() {
  if (heartbeatRunning) return;
  heartbeatRunning = true;
  try {
    for (const [user, leases] of remote) {
      let expired = false;
      for (const [process, until] of leases) if (until <= Date.now()) {
        leases.delete(process); remoteLeases -= 1; expired = true;
      }
      if (!leases.size) remote.delete(user);
      if (expired && !online(user)) scheduleChanged(user);
    }
    await publish([...local]);
  } finally { heartbeatRunning = false; }
}

function init(value, handler) {
  io = value;
  emit = handler;
  if (initialized) return;
  initialized = true;
  sync.onChange(receive);
  const timer = setInterval(() => heartbeat().catch(() => {}), 15_000);
  timer.unref?.();
}

async function watch(socket, room) {
  if (!UUID.test(room || '') || !socket.connected) return;
  const previous = [...watches].filter(([, sockets]) => sockets.has(socket.id));
  if (!watches.get(room)?.has(socket.id) && previous.length >= 16) unwatch(socket, previous[0][0]);
  if (!watches.has(room) && watches.size >= 256) return;
  if (!watches.has(room)) watches.set(room, new Set());
  watches.get(room).add(socket.id);
  // Known live peers are returned immediately. Query other processes for peers
  // already connected before this process started, without a durable presence table.
  for (let cursor = null; socket.connected && watches.get(room)?.has(socket.id);) {
    let query = db.from('ChatParticipant').select('user_id').eq('room_id', room)
      .eq('is_active', true).order('user_id').limit(100);
    if (cursor) query = query.gt('user_id', cursor);
    const { data, error } = await query;
    if (error || !data?.length) return;
    const users = data.map((row) => row.user_id).filter((id) => id !== socket.userId);
    for (const user of users) if (online(user)) queue(room, user, true, socket.id);
    if (users.length) await sync.publishChatSignal({ t: 'ChatPresenceQuery', origin, users, at: Date.now() });
    if (data.length < 100) return;
    cursor = data[data.length - 1].user_id;
  }
}

function unwatch(socket, room) {
  for (const [id, sockets] of watches) if (!room || room === id) {
    sockets.delete(socket.id);
    if (!sockets.size) watches.delete(id);
  }
}

module.exports = { init, updateLocal, watch, unwatch };
