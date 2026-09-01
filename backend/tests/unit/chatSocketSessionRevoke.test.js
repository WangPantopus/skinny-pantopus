// ============================================================
// TEST: socket/chatSocketio – persistent-login session hooks
//
// * handshake: session_id decoded onto socket.authSessionId; revoked
//   AuthSession rows and tokens older than the sessions_valid_after
//   watermark are refused (same policy as verifyToken)
// * authSessionService 'session_revoked' → sockets carrying that session are
//   told (`auth:session_revoked`) and disconnected; user-wide reasons
//   (lockdown / password_reset / account_deleted) drop every socket of the user
// ============================================================

const { resetTables, seedTable, setAuthMocks } = require('../__mocks__/supabaseAdmin');

jest.mock('../../services/badgeService', () => ({
  init: jest.fn(),
  emitBadgeUpdate: jest.fn(),
  emitBadgeUpdateToMany: jest.fn(),
}));

const authSessionService = require('../../services/authSessionService');
const chatSocketio = require('../../socket/chatSocketio');
const { kickRevokedSessions, connectedUsers } = chatSocketio;

const UID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const SID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const SID2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
const NOW = Math.floor(Date.now() / 1000);

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwtFor({ sub = UID, session_id = SID, iat = NOW } = {}) {
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, session_id, iat, exp: iat + 3600 })}.sig`;
}

/** Minimal io double: captures the auth middleware, exposes a socket map. */
function fakeIo() {
  const io = {
    _middlewares: [],
    _handlers: {},
    sockets: { sockets: new Map() },
    use(fn) { io._middlewares.push(fn); },
    on(evt, fn) { io._handlers[evt] = fn; },
  };
  return io;
}
function fakeSocket({ id, userId, authSessionId }) {
  return { id, userId, authSessionId, emit: jest.fn(), disconnect: jest.fn(), handshake: { auth: {}, headers: {} } };
}
function attach(io, socket) {
  io.sockets.sockets.set(socket.id, socket);
  if (!connectedUsers.has(socket.userId)) connectedUsers.set(socket.userId, new Set());
  connectedUsers.get(socket.userId).add(socket.id);
}

let io;
beforeEach(() => {
  resetTables();
  connectedUsers.clear();
  authSessionService.invalidateSessionStateCache();
  setAuthMocks({
    getUser: async (token) => {
      const parts = String(token).split('.');
      let sub = 'mock-user-id';
      if (parts.length === 3) {
        try { sub = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')).sub || sub; } catch { /* legacy */ }
      }
      return { data: { user: { id: sub, email: 'a@b.com' } }, error: null };
    },
  });
  seedTable('User', [{ id: UID, role: 'user', sessions_valid_after: null }]);
  io = fakeIo();
  chatSocketio(io);
});

async function runAuth(socket) {
  const auth = io._middlewares[0];
  return new Promise((resolve) => auth(socket, (err) => resolve(err || null)));
}

describe('handshake session policy', () => {
  test('active session: authSessionId decoded, userId attached', async () => {
    seedTable('AuthSession', [{ id: SID, user_id: UID, context: 'interactive', revoked_at: null }]);
    const socket = fakeSocket({ id: 's1' });
    socket.handshake.auth.token = jwtFor();
    const err = await runAuth(socket);
    expect(err).toBeNull();
    expect(socket.userId).toBe(UID);
    expect(socket.authSessionId).toBe(SID);
  });

  test('legacy opaque token (no session_id): accepted, authSessionId null', async () => {
    const socket = fakeSocket({ id: 's1' });
    socket.handshake.auth.token = 'token-user-1';
    const err = await runAuth(socket);
    expect(err).toBeNull();
    expect(socket.authSessionId).toBeNull();
  });

  test('revoked AuthSession → handshake refused', async () => {
    seedTable('AuthSession', [{ id: SID, user_id: UID, context: 'interactive', revoked_at: new Date().toISOString(), revoked_reason: 'device_revoked' }]);
    const socket = fakeSocket({ id: 's1' });
    socket.handshake.auth.token = jwtFor();
    const err = await runAuth(socket);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Session revoked');
    expect(socket.userId).toBeUndefined();
  });

  test('token issued before sessions_valid_after → handshake refused', async () => {
    seedTable('User', [{ id: UID, role: 'user', sessions_valid_after: new Date((NOW - 60) * 1000).toISOString() }]);
    const socket = fakeSocket({ id: 's1' });
    socket.handshake.auth.token = jwtFor({ iat: NOW - 120 });
    const err = await runAuth(socket);
    expect(err.message).toBe('Session revoked');
  });
});

describe('session_revoked → socket kick', () => {
  test('only sockets of the revoked session ids are told and disconnected', () => {
    const a = fakeSocket({ id: 'a', userId: UID, authSessionId: SID });
    const b = fakeSocket({ id: 'b', userId: UID, authSessionId: SID2 });
    const legacy = fakeSocket({ id: 'c', userId: UID, authSessionId: null });
    [a, b, legacy].forEach((s) => attach(io, s));

    const kicked = kickRevokedSessions(io, { userId: UID, sessionIds: [SID], reason: 'device_revoked' });
    expect(kicked).toBe(1);
    expect(a.emit).toHaveBeenCalledWith('auth:session_revoked', { sessionId: SID, reason: 'device_revoked', code: 'SESSION_REVOKED' });
    expect(a.disconnect).toHaveBeenCalledWith(true);
    expect(b.disconnect).not.toHaveBeenCalled();
    expect(legacy.disconnect).not.toHaveBeenCalled();
  });

  test('user-wide reasons (lockdown) drop every socket of the user, including legacy ones without a session id', () => {
    const a = fakeSocket({ id: 'a', userId: UID, authSessionId: SID });
    const legacy = fakeSocket({ id: 'c', userId: UID, authSessionId: null });
    const other = fakeSocket({ id: 'z', userId: 'someone-else', authSessionId: SID2 });
    [a, legacy, other].forEach((s) => attach(io, s));

    const kicked = kickRevokedSessions(io, { userId: UID, sessionIds: [SID], reason: 'lockdown' });
    expect(kicked).toBe(2);
    expect(a.disconnect).toHaveBeenCalled();
    expect(legacy.disconnect).toHaveBeenCalled();
    expect(other.disconnect).not.toHaveBeenCalled();
  });

  test('is wired to authSessionService.authEvents: revoking a row kicks the matching socket', async () => {
    seedTable('AuthSession', [{ id: SID, user_id: UID, context: 'interactive', revoked_at: null }]);
    const a = fakeSocket({ id: 'a', userId: UID, authSessionId: SID });
    attach(io, a);
    await authSessionService.revokeSessionRow(SID, 'logout', { userId: UID });
    expect(a.emit).toHaveBeenCalledWith('auth:session_revoked', expect.objectContaining({ sessionId: SID, reason: 'logout' }));
    expect(a.disconnect).toHaveBeenCalledWith(true);
  });

  test('no sockets for the user → no-op', () => {
    expect(kickRevokedSessions(io, { userId: 'nobody', sessionIds: [SID], reason: 'user' })).toBe(0);
  });
});
