/**
 * `sync:changed`: the Instant Screens change signal (docs/product/instant-screens-contract-2026-10-09.md §8).
 *
 * The database announces changes itself. AFTER triggers on the household, chat, notification, profile and
 * Support Train tables send `NOTIFY sync_changed` with the table name and row ids only
 * (supabase/migrations/20261009085129_sync_changed_signal.sql), so writes from the API, the worker container,
 * SQL functions and the Lambdas all reach this one listener in the API process. It works out who is affected and
 * emits to each of their sockets:
 *
 *   socket.emit('sync:changed', { topics: ['home:3f2c…', 'today'], at: '2026-10-10T17:00:00.000Z' })
 *
 * Topic names only: no content and no names. Clients mark matching entries out of date and refresh what's on
 * screen; older apps ignore the event, and nothing depends on it arriving (after a reconnect clients refresh
 * anyway). Bursts are merged per user for FLUSH_MS.
 */

const { Client } = require('pg');
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { isGigRoomClosedTo } = require('./chatGigRoomAccess');

const CHANNEL = 'sync_changed';
const EVENT = 'sync:changed';
const FLUSH_MS = 150;
const HEARTBEAT_MS = 60_000;
const MAX_RETRY_MS = 30_000;
const CHUNK = 200;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Which people a changed row concerns, and which topics go stale for them.
//   home:  the home's active members, plus the row's own person (someone who just left)
//   room:  the conversation's active members, plus the row's own person
//   train: the Support Train's organizers, recipient and helpers, plus the row's own person
//   user:  the row's person only
const RULES = {
  HomeTask: { scope: 'home', topics: ({ h }) => [`home:${h}`, 'today'] },
  HomeOccupancy: { scope: 'home', topics: ({ h }) => [`home:${h}`, 'homes', 'today', `place:${h}`] },
  HomeOwner: { scope: 'home', topics: ({ h }) => [`home:${h}`, 'homes', 'today', `place:${h}`] },
  HomeOwnershipClaim: { scope: 'home', topics: ({ h }) => [`home:${h}`, 'homes', `place:${h}`] },
  HomeResidencyClaim: { scope: 'home', topics: ({ h }) => [`home:${h}`, 'homes', `place:${h}`] },
  HomeInvite: { scope: 'home', topics: ({ h }) => [`home:${h}`, 'homes'] },
  HomeHouseholdAccessRequest: { scope: 'home', topics: ({ h }) => [`home:${h}`, 'homes'] },
  Home: { scope: 'home', topics: ({ h }) => [`home:${h}`, 'homes', `place:${h}`] },
  // Only a household's own pickup days and calendar rows; city, county and state rows are shared reference data.
  AddressCalendarRule: { scope: 'home', when: ({ st }) => st === 'home', topics: ({ h }) => ['today', `home:${h}`] },
  HomeAccessSecret: { scope: 'home', topics: ({ h }) => [`home:${h}`] },
  HomeEmergency: { scope: 'home', topics: ({ h }) => [`home:${h}`] },
  HomeDocument: { scope: 'home', topics: ({ h }) => [`home:${h}`] },
  HomeIssue: { scope: 'home', topics: ({ h }) => [`home:${h}`] },
  // The Home screens' maintenance log, seasonal checklist, privacy, preferences and pending ownership votes.
  HomeMaintenanceLog: { scope: 'home', topics: ({ h }) => [`home:${h}`] },
  HomeSeasonalChecklistItem: { scope: 'home', topics: ({ h }) => [`home:${h}`] },
  HomePrivacy: { scope: 'home', topics: ({ h }) => [`home:${h}`] },
  HomePreference: { scope: 'home', topics: ({ h }) => [`home:${h}`] },
  HomeQuorumAction: { scope: 'home', topics: ({ h }) => [`home:${h}`] },
  HomeGuestPass: { scope: 'home', topics: ({ h }) => [`home:${h}`] },
  HomePermissionOverride: { scope: 'home', topics: ({ h }) => [`home:${h}`, 'today'] },
  HomeScopedGrant: { scope: 'home', topics: ({ h }) => [`home:${h}`] },
  SavedPlace: { scope: 'user', topics: ({ p }) => ['homes', 'today', ...(p ? [`place:${p}`] : [])] },
  ChatParticipant: { scope: 'room', topics: ({ r }) => ['chats', `chat:${r}`] },
  ChatMessage: { scope: 'room', topics: ({ r }) => [`chat:${r}`, 'chats'] },
  Notification: { scope: 'user', topics: () => ['notifications'] },
  User: { scope: 'user', topics: () => ['profile:me'] },
  UserNotificationPreferences: { scope: 'user', topics: () => ['profile:me', 'today'] },
  UserPrivacySettings: { scope: 'user', topics: () => ['profile:me'] },
  MailPreferences: { scope: 'user', topics: () => ['profile:me'] },
  UserViewingLocation: { scope: 'user', topics: () => ['profile:me', 'today'] },
  SupportTrain: { scope: 'train', topics: ({ s }) => [`supporttrain:${s}`] },
  SupportTrainSlot: { scope: 'train', topics: ({ s }) => [`supporttrain:${s}`] },
  SupportTrainReservation: { scope: 'train', topics: ({ s }) => [`supporttrain:${s}`] },
  SupportTrainOrganizer: { scope: 'train', topics: ({ s }) => [`supporttrain:${s}`] },
};
const SCOPE_KEY = { home: 'h', room: 'r', train: 's', user: 'u' };

let _io = null;
let _connectedUsers = null;

function init(io, connectedUsers) {
  _io = io;
  _connectedUsers = connectedUsers;
}

// ── Pending changes, merged until the next flush ────────────────────
// scope → Map<id, { topics: Set, users: Set }>
const pending = { home: new Map(), room: new Map(), train: new Map(), user: new Map() };
// Chat memberships to bring the person's live connections in line with: "<roomId>|<userId>"
let pendingMemberships = new Set();
let flushTimer = null;

function hasConnectedUsers() {
  return Boolean(_io && _connectedUsers && _connectedUsers.size > 0);
}

// In-process listeners (server memos) hear every change, whoever is connected.
const changeListeners = new Set();
function onChange(listener) {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

/** Queue one NOTIFY payload. Unknown tables and malformed ids are ignored. */
function handleNotification(raw) {
  let change;
  try { change = JSON.parse(raw); } catch { return; }
  if (!change || typeof change.t !== 'string') return;
  for (const listener of changeListeners) {
    try { listener(change); } catch (err) { logger.warn('sync:changed listener failed', { error: err.message }); }
  }
  if (!hasConnectedUsers()) return;
  const rule = RULES[change.t];
  if (!rule || (rule.when && !rule.when(change))) return;
  const id = change[SCOPE_KEY[rule.scope]];
  if (!UUID_RE.test(String(id || ''))) return;
  if (change.p !== undefined && !UUID_RE.test(String(change.p))) delete change.p;
  const map = pending[rule.scope];
  const key = String(id).toLowerCase();
  const entry = map.get(key) || { topics: new Set(), users: new Set() };
  for (const topic of rule.topics({ ...change, [SCOPE_KEY[rule.scope]]: key })) entry.topics.add(topic);
  if (UUID_RE.test(String(change.u || ''))) entry.users.add(String(change.u).toLowerCase());
  map.set(key, entry);
  // A chat joined, re-joined or left (whatever wrote it: a REST route, an SQL function, a socket event):
  // the person's open connections join or leave the room, so its live events reach exactly its members.
  if (change.t === 'ChatParticipant' && UUID_RE.test(String(change.u || ''))
    && _connectedUsers.has(String(change.u).toLowerCase())) {
    pendingMemberships.add(`${key}|${String(change.u).toLowerCase()}`);
  }
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flush().catch((err) => logger.warn('sync:changed flush failed', { error: err.message }));
    }, FLUSH_MS);
    if (typeof flushTimer.unref === 'function') flushTimer.unref();
  }
}

function chunks(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += CHUNK) out.push(ids.slice(i, i + CHUNK));
  return out;
}

// Map<scopeId, Set<userId>> for the given ids; a failed read leaves those ids with no extra people.
async function membersOf(table, keyColumn, ids, filter = (q) => q) {
  const members = new Map();
  for (const part of chunks(ids)) {
    const { data, error } = await filter(supabaseAdmin.from(table).select(`${keyColumn}, user_id`).in(keyColumn, part));
    if (error) {
      logger.warn('sync:changed recipients unavailable', { table, error: error.message });
      continue;
    }
    for (const row of data || []) {
      if (!row.user_id) continue;
      const key = String(row[keyColumn]).toLowerCase();
      if (!members.has(key)) members.set(key, new Set());
      members.get(key).add(String(row.user_id).toLowerCase());
    }
  }
  return members;
}

async function trainPeople(ids) {
  const people = await membersOf('SupportTrainOrganizer', 'support_train_id', ids);
  const helpers = await membersOf('SupportTrainReservation', 'support_train_id', ids);
  for (const [id, users] of helpers) {
    if (!people.has(id)) people.set(id, new Set());
    for (const user of users) people.get(id).add(user);
  }
  for (const part of chunks(ids)) {
    const { data, error } = await supabaseAdmin.from('SupportTrain')
      .select('id, organizer_user_id, recipient_user_id').in('id', part);
    if (error) {
      logger.warn('sync:changed recipients unavailable', { table: 'SupportTrain', error: error.message });
      continue;
    }
    for (const train of data || []) {
      const key = String(train.id).toLowerCase();
      if (!people.has(key)) people.set(key, new Set());
      for (const user of [train.organizer_user_id, train.recipient_user_id]) {
        if (user) people.get(key).add(String(user).toLowerCase());
      }
    }
  }
  return people;
}

// Join or leave each queued (room, person) for their open sockets, from the membership as it is now: an
// active member whose task room is still open to them joins; anyone else leaves.
async function syncMemberships(pairs) {
  if (pairs.length === 0) return;
  const rooms = [...new Set(pairs.map(([roomId]) => roomId))];
  const users = [...new Set(pairs.map(([, userId]) => userId))];
  const { data, error } = await supabaseAdmin.from('ChatParticipant')
    .select('room_id, user_id, is_active').in('room_id', rooms).in('user_id', users);
  if (error) {
    logger.warn('sync:changed chat membership unavailable', { error: error.message });
    return;
  }
  const active = new Set((data || []).filter((row) => row.is_active)
    .map((row) => `${String(row.room_id).toLowerCase()}|${String(row.user_id).toLowerCase()}`));
  for (const [roomId, userId] of pairs) {
    const socketIds = [..._connectedUsers.get(userId) || []];
    if (socketIds.length === 0) continue;
    let member = active.has(`${roomId}|${userId}`);
    if (member) {
      try { member = !(await isGigRoomClosedTo(roomId, userId)); } catch { member = false; }
    }
    for (const socketId of socketIds) {
      if (member) _io.in(socketId).socketsJoin(roomId);
      else _io.in(socketId).socketsLeave(roomId);
    }
  }
}

/** Resolve everyone the queued changes concern and emit one event per connected person. */
async function flush() {
  const batch = {};
  for (const scope of Object.keys(pending)) {
    batch[scope] = pending[scope];
    pending[scope] = new Map();
  }
  const memberships = [...pendingMemberships].map((pair) => pair.split('|'));
  pendingMemberships = new Set();
  if (!hasConnectedUsers()) return;
  // Before the topics go out, so a client that reloads its conversation is already in the room.
  await syncMemberships(memberships).catch((err) => logger.warn('sync:changed chat membership failed', { error: err.message }));

  const resolvers = {
    home: (ids) => membersOf('HomeOccupancy', 'home_id', ids, (q) => q.eq('is_active', true)),
    room: (ids) => membersOf('ChatParticipant', 'room_id', ids, (q) => q.eq('is_active', true)),
    train: trainPeople,
  };
  const byUser = new Map();
  const add = (userId, topics) => {
    if (!_connectedUsers.has(userId)) return;
    if (!byUser.has(userId)) byUser.set(userId, new Set());
    for (const topic of topics) byUser.get(userId).add(topic);
  };

  for (const [userId, entry] of batch.user) add(userId, entry.topics);
  for (const scope of ['home', 'room', 'train']) {
    const entries = batch[scope];
    if (entries.size === 0) continue;
    const members = await resolvers[scope]([...entries.keys()]);
    for (const [id, entry] of entries) {
      for (const userId of new Set([...(members.get(id) || []), ...entry.users])) add(userId, entry.topics);
    }
  }

  const at = new Date().toISOString();
  for (const [userId, topics] of byUser) {
    const payload = { topics: [...topics].sort(), at };
    for (const socketId of _connectedUsers.get(userId) || []) _io.to(socketId).emit(EVENT, payload);
  }
  if (byUser.size) logger.debug('sync:changed sent', { users: byUser.size });
}

// ── The LISTEN connection (API process only) ────────────────────────
let client = null;
let live = false;
let epoch = 0;
let stopped = true;
let retryMs = 1000;
let retryTimer = null;
let heartbeatTimer = null;

function scheduleReconnect(failed, reason) {
  if (failed._syncClosed) return;
  failed._syncClosed = true;
  if (client === failed) {
    client = null;
    live = false;
  }
  clearInterval(heartbeatTimer);
  failed.end().catch(() => {});
  if (stopped) return;
  logger.warn('sync:changed listener lost; reconnecting', { reason, retry_ms: retryMs });
  retryTimer = setTimeout(connect, retryMs);
  if (typeof retryTimer.unref === 'function') retryTimer.unref();
  retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
}

async function connect() {
  retryTimer = null;
  if (stopped) return;
  const listener = new Client({
    connectionString: process.env.DATABASE_URL,
    application_name: 'pantopus-sync-changed',
    keepAlive: true,
  });
  listener.on('notification', (msg) => {
    if (msg.channel === CHANNEL) handleNotification(msg.payload);
  });
  listener.on('error', (err) => scheduleReconnect(listener, err.message));
  listener.on('end', () => scheduleReconnect(listener, 'connection ended'));
  try {
    await listener.connect();
    await listener.query(`LISTEN ${CHANNEL}`);
  } catch (err) {
    scheduleReconnect(listener, err.message);
    return;
  }
  if (stopped) {
    listener._syncClosed = true;
    listener.end().catch(() => {});
    return;
  }
  client = listener;
  // Changes made while nothing listened were never heard: a new epoch retires everything memoized before.
  epoch += 1;
  live = true;
  retryMs = 1000;
  // A pooled or NATed connection can die quietly; a small query proves it is alive.
  clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('heartbeat timeout')), 10_000).unref());
    Promise.race([listener.query('SELECT 1'), timeout]).catch((err) => scheduleReconnect(listener, err.message));
  }, HEARTBEAT_MS);
  if (typeof heartbeatTimer.unref === 'function') heartbeatTimer.unref();
  logger.info('sync:changed listener ready');
}

/** Start listening (API process). Needs DATABASE_URL; never runs under tests. */
function start() {
  if (process.env.NODE_ENV === 'test' || !stopped) return;
  if (!process.env.DATABASE_URL) {
    logger.warn('sync:changed listener off: DATABASE_URL is not set');
    return;
  }
  stopped = false;
  connect();
}

async function stop() {
  stopped = true;
  live = false;
  clearTimeout(retryTimer);
  clearInterval(heartbeatTimer);
  const current = client;
  client = null;
  if (current) {
    current._syncClosed = true;
    await current.end().catch(() => {});
  }
}

/** True while the LISTEN connection is up, so every committed change is being heard. */
function isLive() {
  return live;
}

/** Bumped on every (re)connect; a memo made under an older epoch may have missed changes. */
function currentEpoch() {
  return epoch;
}

module.exports = { init, start, stop, onChange, isLive, currentEpoch, handleNotification, flush, RULES };
