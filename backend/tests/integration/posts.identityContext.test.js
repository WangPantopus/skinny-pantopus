/**
 * P2.4 — defense-in-depth on POST /api/posts.
 *
 * Per unified-IA §4.1, the personal-zone composer never offers persona;
 * P2.5's audience composer targets /api/personas/:id/posts and the
 * broadcast routes. Even so, /api/posts must refuse postAs='persona' so
 * a buggy or hostile client can never create cross-zone Post rows here.
 *
 * Coverage:
 *   1. POST /api/posts with postAs='persona' returns 400 + code='wrong_post_route'
 *   2. POST /api/posts with postAs='personal' goes through normal validation
 *   3. GET /api/posts/identities omits any persona row from the picker
 *   4. POST /api/posts with postAs='business' cannot target removed followers audience
 */

jest.mock('../../middleware/rateLimiter', () => {
  const noop = (_req, _res, next) => next();
  return new Proxy({}, { get: () => noop });
});

// Minimal stubs for trustState — getPostingIdentities + isPostingAllowed
// so the GET /identities and POST / handlers don't pull the live Supabase
// joins. The point is to test the firewall, not the rest of the post flow.
jest.mock('../../utils/trustState', () => ({
  getPostingIdentities: jest.fn(),
  isPostingAllowed: jest.fn().mockResolvedValue(true),
  resolveTrustState: jest.fn().mockResolvedValue({ canPost: true, accessLevel: 'verified_resident' }),
}));

const express = require('express');
const request = require('supertest');

const supabaseAdmin = require('../__mocks__/supabaseAdmin');
const { resetTables } = supabaseAdmin;

const trustState = require('../../utils/trustState');
const postsRouter = require('../../routes/posts');

const USER_ID = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/posts', postsRouter);
  return app;
}

function asUser(req) {
  return req.set('x-test-user-id', USER_ID);
}

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
});

describe('P2.4 — POST /api/posts persona enforcement', () => {
  let app;
  beforeAll(() => { app = buildApp(); });

  test('postAs=persona is rejected with 400 + code=wrong_post_route', async () => {
    const res = await asUser(request(app).post('/api/posts').send({
      content: 'Hi from my persona',
      postType: 'general',
      postAs: 'persona',
      identityContextId: '11111111-1111-4111-8111-111111111111',
    }));
    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({
      code: 'wrong_post_route',
    }));
    expect(res.body.error).toMatch(/\/api\/personas\/:id\/posts/);
  });

  test('postAs=personal passes the firewall check (continues to normal post-creation flow)', async () => {
    // The firewall MUST NOT return code=wrong_post_route for any
    // non-persona postAs value. Downstream Joi/permission/DB errors are
    // unrelated to this rule and intentionally not asserted here.
    const res = await asUser(request(app).post('/api/posts').send({
      content: 'Hi from my personal profile',
      postType: 'general',
      postAs: 'personal',
    }));
    expect(res.body.code).not.toBe('wrong_post_route');
  });

  test('postAs=home and postAs=business also bypass the persona firewall', async () => {
    for (const postAs of ['home', 'business']) {
      const res = await asUser(request(app).post('/api/posts').send({
        content: `Hi from my ${postAs} identity`,
        postType: 'general',
        postAs,
      }));
      expect(res.body.code).not.toBe('wrong_post_route');
    }
  });

  test('postAs=business rejects the removed followers audience instead of remapping to connections', async () => {
    const res = await asUser(request(app).post('/api/posts').send({
      content: 'Business update for stale followers client',
      postType: 'deal',
      postAs: 'business',
      audience: 'followers',
    }));

    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({
      code: 'business_followers_audience_removed',
    }));
  });
});

describe('P2.4 — GET /api/posts/identities filters persona out', () => {
  let app;
  beforeAll(() => { app = buildApp(); });

  test('persona-typed identities are stripped from the picker', async () => {
    trustState.getPostingIdentities.mockResolvedValue([
      { type: 'personal', id: 'u1', name: 'Maya', imageUrl: null },
      { type: 'home',     id: 'h1', name: 'Riverside', role: 'owner', imageUrl: null },
      { type: 'persona',  id: 'p1', name: '@mayabuilds', role: 'followers', imageUrl: null },
      { type: 'business', id: 'b1', name: 'Bakery', role: 'owner', imageUrl: null },
    ]);

    const res = await asUser(request(app).get('/api/posts/identities'));
    expect(res.status).toBe(200);
    const types = (res.body.identities || []).map((i) => i.type);
    expect(types).toEqual(['personal', 'home', 'business']);
    expect(types).not.toContain('persona');
  });
});
