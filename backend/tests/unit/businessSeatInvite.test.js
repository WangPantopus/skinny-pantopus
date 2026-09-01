// ============================================================
// TEST: Business Seat Invite – Identity Binding & Expiry (AUTH-1.6)
// ============================================================

const crypto = require('crypto');
const { resetTables, seedTable } = require('../__mocks__/supabaseAdmin');

// ── Mock seatPermissions ────────────────────────────────────
jest.mock('../../utils/seatPermissions', () => ({
  getSeatForUser: jest.fn().mockResolvedValue(null),
  getBusinessSeats: jest.fn().mockResolvedValue([]),
  getAllSeatsForUser: jest.fn().mockResolvedValue([]),
  writeSeatAuditLog: jest.fn(),
  getRoleRank: jest.fn((r) => ({ viewer: 10, staff: 20, editor: 30, admin: 40, owner: 50 }[r] || 0)),
  BUSINESS_ROLE_RANK: { viewer: 10, staff: 20, editor: 30, admin: 40, owner: 50 },
}));

// ── Mock verifyToken ────────────────────────────────────────
jest.mock('../../middleware/verifyToken', () => {
  const mw = (req, res, next) => {
    req.user = { id: 'user-1', email: 'alice@example.com', role: 'user' };
    next();
  };
  mw.requireAdmin = (req, res, next) => next();
  return mw;
});

// ── Mock requireBusinessSeat ────────────────────────────────
jest.mock('../../middleware/requireBusinessSeat', () => {
  return () => (req, res, next) => {
    req.businessSeat = { id: 'caller-seat-1', role_base: 'admin' };
    next();
  };
});

// ── Mock validate (pass-through) ────────────────────────────
jest.mock('../../middleware/validate', () => {
  return () => (req, res, next) => next();
});

// ── Mock logger ─────────────────────────────────────────────
jest.mock('../../utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

// ── Import router + extract handlers ────────────────────────
const router = require('../../routes/businessSeats');

function findHandler(method, path) {
  for (const layer of router.stack) {
    if (
      layer.route &&
      layer.route.path === path &&
      layer.route.methods[method.toLowerCase()]
    ) {
      const stack = layer.route.stack;
      return stack[stack.length - 1].handle;
    }
  }
  throw new Error(`Handler not found: ${method} ${path}`);
}

const acceptInviteHandler = findHandler('POST', '/seats/accept-invite');
const inviteDetailsHandler = findHandler('GET', '/seats/invite-details');

// ── Helpers ─────────────────────────────────────────────────

const RAW_TOKEN = 'test-invite-token-abc123';
const TOKEN_HASH = crypto.createHash('sha256').update(RAW_TOKEN).digest('hex');

function makePendingSeat(overrides = {}) {
  return {
    id: 'seat-1',
    business_user_id: 'biz-1',
    display_name: 'Alice',
    display_avatar_file_id: null,
    role_base: 'staff',
    contact_method: null,
    is_active: true,
    invite_status: 'pending',
    invite_email: 'alice@example.com',
    invite_token_hash: TOKEN_HASH,
    invite_expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    invited_by_seat_id: 'caller-seat-1',
    accepted_at: null,
    deactivated_at: null,
    deactivated_reason: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function mockReq(overrides = {}) {
  return {
    params: {},
    body: { token: RAW_TOKEN },
    query: {},
    user: { id: 'user-1', email: 'alice@example.com' },
    ...overrides,
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    _json: null,
    status(code) { res.statusCode = code; return res; },
    json(data) { res._json = data; return res; },
  };
  return res;
}

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  const { getSeatForUser } = require('../../utils/seatPermissions');
  getSeatForUser.mockResolvedValue(null);
});

// ============================================================
// POST /seats/accept-invite
// ============================================================

describe('POST /seats/accept-invite – identity & expiry', () => {
  test('user with matching email can accept invite (200)', async () => {
    seedTable('BusinessSeat', [makePendingSeat()]);

    const req = mockReq();
    const res = mockRes();
    await acceptInviteHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._json.message).toMatch(/invite accepted/i);
  });

  test('user with non-matching email cannot accept invite (403)', async () => {
    seedTable('BusinessSeat', [makePendingSeat()]);

    const req = mockReq({ user: { id: 'user-1', email: 'intruder@evil.com' } });
    const res = mockRes();
    await acceptInviteHandler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res._json.error).toMatch(/different email/i);
  });

  test('expired invite cannot be accepted (410)', async () => {
    seedTable('BusinessSeat', [makePendingSeat({
      invite_expires_at: new Date(Date.now() - 86400000).toISOString(), // -1 day
    })]);

    const req = mockReq();
    const res = mockRes();
    await acceptInviteHandler(req, res);

    expect(res.statusCode).toBe(410);
    expect(res._json.error).toMatch(/expired/i);
  });

  test('already-accepted invite cannot be replayed (410)', async () => {
    seedTable('BusinessSeat', [makePendingSeat({ invite_status: 'accepted' })]);

    const req = mockReq();
    const res = mockRes();
    await acceptInviteHandler(req, res);

    expect(res.statusCode).toBe(410);
    expect(res._json.error).toMatch(/accepted/i);
  });

  test('already-declined invite cannot be accepted (410)', async () => {
    seedTable('BusinessSeat', [makePendingSeat({ invite_status: 'declined' })]);

    const req = mockReq();
    const res = mockRes();
    await acceptInviteHandler(req, res);

    expect(res.statusCode).toBe(410);
    expect(res._json.error).toMatch(/declined/i);
  });
});

// ============================================================
// GET /seats/invite-details
// ============================================================

describe('GET /seats/invite-details – expiry', () => {
  test('expired invite cannot be previewed (410)', async () => {
    seedTable('BusinessSeat', [makePendingSeat({
      invite_expires_at: new Date(Date.now() - 86400000).toISOString(),
    })]);

    const req = mockReq({ query: { token: RAW_TOKEN }, body: {} });
    const res = mockRes();
    await inviteDetailsHandler(req, res);

    expect(res.statusCode).toBe(410);
    expect(res._json.error).toMatch(/expired/i);
  });
});
