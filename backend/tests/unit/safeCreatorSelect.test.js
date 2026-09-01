/**
 * P0.3 — Replace CREATOR_SELECT raw selects with serializer calls.
 *
 * Audience Profile design v2 §16 item 2.
 *
 * Coverage:
 *   1. SAFE_CREATOR_SELECT contains only audience-safe columns; legacy
 *      personal-identity columns (name, first_name, last_name, city, state,
 *      email, phone) are absent.
 *   2. feedService.normalizeFeedPostRow projects raw `creator` rows through
 *      serializeUserAsLocalIdentity so raw User columns never surface as
 *      legacy response keys; readable names only flow through displayName.
 *   3. marketplaceService.normalizeListingRow does the same for listings.
 *   4. The CI grep guard (scripts/ci/check-creator-select.js) accepts the
 *      current codebase, rejects a re-introduction of the legacy
 *      `CREATOR_SELECT` identifier, and rejects a Prisma-style
 *      `select: { name: true }` pattern.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

const {
  SAFE_CREATOR_SELECT,
  serializeUserAsLocalIdentity,
} = require('../../serializers/identitySerializers');

describe('P0.3 — SAFE_CREATOR_SELECT column whitelist', () => {
  test('exists and is exported', () => {
    expect(typeof SAFE_CREATOR_SELECT).toBe('string');
    expect(SAFE_CREATOR_SELECT.length).toBeGreaterThan(0);
  });

  test.each([
    'name',
    'first_name',
    'last_name',
    'city',
    'state',
    'email',
    'phone',
    'phone_number',
    'address',
    'legal_name',
  ])('does NOT include the personal-identity column %s', (column) => {
    const tokens = SAFE_CREATOR_SELECT.split(',').map((t) => t.trim());
    expect(tokens).not.toContain(column);
  });

  test('keeps the audience-safe columns the serializers need', () => {
    const tokens = SAFE_CREATOR_SELECT.split(',').map((t) => t.trim());
    expect(tokens).toEqual(expect.arrayContaining(['id', 'username', 'profile_picture_url']));
  });
});

describe('P0.3 — feedService.normalizeFeedPostRow projects raw creator', () => {
  // Pull the real module (no jest.mock); normalizeFeedPostRow is pure JS.
  const { normalizeFeedPostRow } = jest.requireActual('../../services/feedService');

  function rawRowWithLegalName() {
    return {
      id: 'p1',
      user_id: 'u1',
      created_at: new Date().toISOString(),
      content: 'hello',
      // SAFE_CREATOR_SELECT excludes name/city/state, but a defensive serializer
      // still has to refuse to echo them if a row somehow carries them through.
      creator: {
        id: 'u1',
        username: 'cooluser',
        name: 'John Q. Public',
        first_name: 'John',
        last_name: 'Public',
        email: 'john@example.test',
        phone: '+1-555-0100',
        city: 'Camas',
        state: 'WA',
        profile_picture_url: 'https://example.test/avatar.jpg',
      },
    };
  }

  test('strips raw User identity keys / locality / contact fields from creator', () => {
    const row = rawRowWithLegalName();
    const out = normalizeFeedPostRow(row);

    expect(out.creator).not.toBeNull();
    expect(out.creator.name).toBeUndefined();
    expect(out.creator.first_name).toBeUndefined();
    expect(out.creator.last_name).toBeUndefined();
    expect(out.creator.email).toBeUndefined();
    expect(out.creator.phone).toBeUndefined();
    expect(out.creator.city).toBeUndefined();
    expect(out.creator.state).toBeUndefined();
    expect(out.creator.address).toBeUndefined();
  });

  test('passes audience-safe identifiers through (handle, displayName, avatarUrl)', () => {
    const out = normalizeFeedPostRow(rawRowWithLegalName());
    expect(out.creator.handle).toBe('cooluser');
    expect(out.creator.displayName).toBe('John Q. Public');
    expect(out.creator.avatarUrl).toBe('https://example.test/avatar.jpg');
  });

  test('returns null creator when the row has none', () => {
    const out = normalizeFeedPostRow({ id: 'p2', user_id: 'u2', created_at: '2026-01-01' });
    expect(out.creator).toBeNull();
  });
});

describe('P0.3 — marketplaceService.normalizeListingRow projects raw creator', () => {
  const { normalizeListingRow } = jest.requireActual('../../services/marketplace/marketplaceService');

  test('strips legal-name + locality columns from listing.creator', () => {
    const out = normalizeListingRow({
      id: 'l1',
      user_id: 'u1',
      title: 'Couch',
      price: 100,
      creator: {
        id: 'u1',
        username: 'cooluser',
        name: 'John Q. Public',
        first_name: 'John',
        city: 'Camas',
        state: 'WA',
        profile_picture_url: 'https://example.test/avatar.jpg',
        email: 'john@example.test',
      },
    });

    expect(out.creator.name).toBeUndefined();
    expect(out.creator.first_name).toBeUndefined();
    expect(out.creator.city).toBeUndefined();
    expect(out.creator.state).toBeUndefined();
    expect(out.creator.email).toBeUndefined();
    expect(out.creator.handle).toBe('cooluser');
    expect(out.creator.avatarUrl).toBe('https://example.test/avatar.jpg');
  });
});

describe('P0.3 — serializeUserAsLocalIdentity contract', () => {
  test('a viewer never receives User.name / city / state from a User row', () => {
    const out = serializeUserAsLocalIdentity({
      id: 'u1',
      username: 'cooluser',
      name: 'John Q. Public',
      first_name: 'John',
      last_name: 'Public',
      email: 'john@example.test',
      phone: '+1-555-0100',
      city: 'Camas',
      state: 'WA',
      profile_picture_url: 'https://example.test/avatar.jpg',
    });

    expect(out.email).toBeUndefined();
    expect(out.phone).toBeUndefined();
    expect(out.address).toBeUndefined();
    expect(out.displayName).toBe('John Q. Public');
    expect(out.handle).toBe('cooluser');
    // P0.4: the legacy `username` / `name` / `first_name` /
    // `profile_picture_url` aliases are gone. Consumers read
    // `handle` / `displayName` / `avatarUrl`.
    expect(out).not.toHaveProperty('username');
    expect(out).not.toHaveProperty('name');
    expect(out).not.toHaveProperty('first_name');
    expect(out).not.toHaveProperty('profile_picture_url');
  });
});

describe('P0.3 — CI guard against re-introducing CREATOR_SELECT', () => {
  const guard = require('../../scripts/ci/check-creator-select');

  test('the current repo passes the guard', () => {
    // Ignore the transient synthetic fixtures that tests/unit/privacy/
    // privacyGates.test.js writes into the scanned roots to prove each gate
    // fires (e.g. `__p07_creator_select_violation__.js`). Jest runs test
    // files in parallel workers over one shared filesystem, so such a file
    // can momentarily exist while this scan walks the tree; it is never real
    // source, so a "the real repo is clean" assertion must exclude it to
    // stay deterministic. A genuine violation still fails this test.
    const SYNTHETIC_FIXTURE = /__\w*violation__\.[cm]?[jt]sx?$/;
    const violations = guard.scan().filter((v) => !SYNTHETIC_FIXTURE.test(v.file));
    expect(violations).toEqual([]);
  });

  test('rule registry includes the legacy identifier and the Prisma-style select', () => {
    const names = guard.FORBIDDEN_LINE.map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining([
      'legacy CREATOR_SELECT identifier',
      'Prisma-style select pulling personal-identity columns',
    ]));
  });

  test('legacy identifier rule rejects a re-introduction', () => {
    const rule = guard.FORBIDDEN_LINE.find((r) => r.name === 'legacy CREATOR_SELECT identifier');
    expect(rule).toBeDefined();
    expect(rule.test("const CREATOR_SELECT = 'id, username';")).toBe(true);
    expect(rule.test("const FOO_CREATOR_SELECT = 'id, username';")).toBe(true);
    // SAFE_CREATOR_SELECT is the canonical replacement and must NOT be flagged.
    expect(rule.test("const { SAFE_CREATOR_SELECT } = require('../serializers/identitySerializers');")).toBe(false);
  });

  test('Prisma-style rule rejects select: { name: true } / select: { email: true }', () => {
    const rule = guard.FORBIDDEN_LINE.find(
      (r) => r.name === 'Prisma-style select pulling personal-identity columns'
    );
    expect(rule).toBeDefined();
    expect(rule.test('await prisma.user.findFirst({ select: { name: true, id: true } })')).toBe(true);
    expect(rule.test('await prisma.user.findFirst({ select: { email: true } })')).toBe(true);
    expect(rule.test('await prisma.user.findFirst({ select: { phone: true } })')).toBe(true);
    // Selecting only audience-safe columns is fine.
    expect(rule.test('await prisma.user.findFirst({ select: { id: true, username: true } })')).toBe(false);
  });

  test('format() reports a useful error and points at the serializer module', () => {
    const out = guard.format([
      { file: '/repo/foo.js', line: 7, rule: 'legacy CREATOR_SELECT identifier', text: 'bad' },
    ]);
    expect(out).toContain('Forbidden creator-select patterns detected');
    expect(out).toContain('SAFE_CREATOR_SELECT');
    expect(out).toContain('backend/serializers/identitySerializers.js');
  });

  test('comment lines are skipped (allowlist)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p03-guard-'));
    const file = path.join(dir, 'comment_only.js');
    fs.writeFileSync(file, '// references CREATOR_SELECT in a comment is fine\n');
    // The guard's scan walks fixed roots; we test the allowlist regex directly.
    const isAllowlisted = (line) =>
      guard.ALLOWLIST_LINE_PATTERNS.some((re) => re.test(line));
    expect(isAllowlisted('// references CREATOR_SELECT in a comment is fine')).toBe(true);
    expect(isAllowlisted("const CREATOR_SELECT = 'id';")).toBe(false);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
