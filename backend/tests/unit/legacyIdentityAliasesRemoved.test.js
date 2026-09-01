/**
 * P0.4 — Drop withLegacyPublicIdentityAliases helper.
 *
 * Audience Profile design v2 §16 item 3.
 *
 * Coverage:
 *   1. The helper is gone from the serializer module's exports / source.
 *   2. The three serializers it used to wrap
 *      (serializeLocalProfileForViewer, serializeAudienceProfileForViewer,
 *      serializeBusinessSeatForViewer) no longer emit any of the legacy
 *      alias keys (username, name, first_name, profile_picture_url).
 *   3. Higher-level serializers that compose the three (e.g.
 *      serializeUserAsLocalIdentity, serializePostAuthorForViewer) inherit
 *      the no-aliases contract.
 *   4. The CI grep guard rejects a re-introduction of the helper or any
 *      manual alias-injection that would re-publish the legacy keys.
 */

const fs = require('fs');
const path = require('path');

const serializers = require('../../serializers/identitySerializers');
const {
  serializeLocalProfileForViewer,
  serializeAudienceProfileForViewer,
  serializeBusinessSeatForViewer,
  serializeUserAsLocalIdentity,
  serializePostAuthorForViewer,
} = serializers;

const FORBIDDEN_LEGACY_KEYS = ['username', 'name', 'first_name', 'last_name', 'profile_picture_url'];

function expectNoLegacyKeys(out) {
  expect(out).not.toBeNull();
  for (const key of FORBIDDEN_LEGACY_KEYS) {
    expect(out).not.toHaveProperty(key);
  }
}

describe('P0.4 — withLegacyPublicIdentityAliases is gone', () => {
  test('the helper is not exported from the serializer module', () => {
    expect(serializers).not.toHaveProperty('withLegacyPublicIdentityAliases');
  });

  test('the helper is not defined in the serializer module source', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'serializers', 'identitySerializers.js'),
      'utf8'
    );
    // Match a function definition only — comments referencing the helper
    // by name (for the paper trail) are fine.
    expect(source).not.toMatch(/^\s*function\s+withLegacyPublicIdentityAliases\b/m);
    expect(source).not.toMatch(/^\s*const\s+withLegacyPublicIdentityAliases\b/m);
  });
});

describe('P0.4 — serializeLocalProfileForViewer drops legacy aliases', () => {
  test('output contains handle / displayName / avatarUrl, none of the legacy keys', () => {
    const out = serializeLocalProfileForViewer({
      id: 'lp-1',
      user_id: 'u-1',
      handle: 'mayabuilds',
      display_name: 'mayabuilds',
      avatar_url: 'https://cdn.example/maya.jpg',
      user: {
        id: 'u-1',
        username: 'mayabuilds',
        name: 'Maya Builder',
        first_name: 'Maya',
        last_name: 'Builder',
        profile_picture_url: 'https://cdn.example/maya.jpg',
      },
    });
    expect(out.handle).toBe('mayabuilds');
    expect(out.displayName).toBe('Maya Builder');
    expect(out.avatarUrl).toBe('https://cdn.example/maya.jpg');
    expectNoLegacyKeys(out);
  });
});

describe('P0.4 — serializeAudienceProfileForViewer drops legacy aliases', () => {
  test('output contains handle / displayName / avatarUrl, none of the legacy keys', () => {
    const out = serializeAudienceProfileForViewer({
      id: 'persona-1',
      handle: 'mayabuilds',
      display_name: 'Maya Builds',
      avatar_url: 'https://cdn.example/maya.jpg',
      banner_url: null,
      bio: null,
      public_links: [],
      category: 'creator',
      audience_label: 'followers',
      audience_mode: 'open',
      follower_count: 0,
      post_count: 0,
      broadcast_enabled: true,
    });
    expect(out.handle).toBe('mayabuilds');
    expect(out.displayName).toBe('Maya Builds');
    expect(out.avatarUrl).toBe('https://cdn.example/maya.jpg');
    expectNoLegacyKeys(out);
  });
});

describe('P0.4 — serializeBusinessSeatForViewer drops legacy aliases', () => {
  test('output contains handle / displayName / avatarUrl, none of the legacy keys', () => {
    const out = serializeBusinessSeatForViewer({
      id: 'seat-1',
      business_user_id: 'biz-1',
      business_username: 'corner_cafe',
      display_name: 'Corner Cafe',
      display_avatar_url: 'https://cdn.example/biz.jpg',
      role_base: 'owner',
    });
    expect(out.handle).toBe('corner_cafe');
    expect(out.displayName).toBe('Corner Cafe');
    expect(out.avatarUrl).toBe('https://cdn.example/biz.jpg');
    expectNoLegacyKeys(out);
  });
});

describe('P0.4 — composed serializers inherit the no-aliases contract', () => {
  test('serializeUserAsLocalIdentity output has no legacy keys', () => {
    const out = serializeUserAsLocalIdentity({
      id: 'u-1',
      username: 'cooluser',
      name: 'John Q. Public',
      first_name: 'John',
      last_name: 'Public',
      email: 'john@example.test',
      profile_picture_url: 'https://cdn.example/avatar.jpg',
    });
    expect(out.handle).toBe('cooluser');
    expect(out.displayName).toBe('John Q. Public');
    expectNoLegacyKeys(out);
  });

  test('serializePostAuthorForViewer (local context) has no legacy keys', () => {
    const out = serializePostAuthorForViewer({
      identity_context_type: 'local',
      creator: {
        id: 'u-1',
        username: 'cooluser',
        name: 'John Q. Public',
        profile_picture_url: 'https://cdn.example/avatar.jpg',
      },
    });
    expectNoLegacyKeys(out);
    expect(out.handle).toBe('cooluser');
  });

  test('serializePostAuthorForViewer (persona context) has no legacy keys', () => {
    const out = serializePostAuthorForViewer({
      identity_context_type: 'persona',
      persona: {
        id: 'persona-1',
        handle: 'mayabuilds',
        display_name: 'Maya Builds',
        avatar_url: 'https://cdn.example/maya.jpg',
        public_links: [],
      },
    });
    expectNoLegacyKeys(out);
    expect(out.handle).toBe('mayabuilds');
  });
});

describe('P0.4 — CI guard rejects re-introduction of the helper', () => {
  const guard = require('../../scripts/ci/check-legacy-identity-aliases');

  test('the current repo passes the guard', () => {
    // Ignore the transient synthetic fixtures that tests/unit/privacy/
    // privacyGates.test.js writes into the scanned roots to prove each gate
    // fires (e.g. `__p07_legacy_alias_violation__.js`). Jest runs test files
    // in parallel workers over one shared filesystem, so such a file can
    // momentarily exist while this scan walks the tree; it is never real
    // source, so a "the real repo is clean" assertion must exclude it to
    // stay deterministic. A genuine violation still fails this test.
    const SYNTHETIC_FIXTURE = /__\w*violation__\.[cm]?[jt]sx?$/;
    const violations = guard.scan().filter((v) => !SYNTHETIC_FIXTURE.test(v.file));
    expect(violations).toEqual([]);
  });

  test('rule registry includes the legacy helper + alias-injection patterns', () => {
    const names = guard.FORBIDDEN_LINE.map((r) => r.name);
    expect(names).toContain('withLegacyPublicIdentityAliases function');
    expect(names.some((n) => n.startsWith('manual identity alias injection'))).toBe(true);
  });

  test('helper rule rejects a re-introduction', () => {
    const rule = guard.FORBIDDEN_LINE.find(
      (r) => r.name === 'withLegacyPublicIdentityAliases function'
    );
    expect(rule).toBeDefined();
    expect(rule.test('function withLegacyPublicIdentityAliases(identity) {')).toBe(true);
    expect(rule.test('const withLegacyPublicIdentityAliases = (i) => i;')).toBe(true);
    // A comment mention is fine (allowlisted).
    expect(rule.test('// withLegacyPublicIdentityAliases was removed in P0.4')).toBe(false);
  });

  test('alias-injection rule rejects manual re-aliasing on identity outputs', () => {
    const rule = guard.FORBIDDEN_LINE.find((r) => r.name.startsWith('manual identity alias injection'));
    expect(rule).toBeDefined();
    expect(rule.test('username: identity.handle,')).toBe(true);
    expect(rule.test('name: identity.displayName,')).toBe(true);
    expect(rule.test('first_name: identity.displayName,')).toBe(true);
    expect(rule.test('profile_picture_url: identity.avatarUrl,')).toBe(true);
    // Manual construction from raw User columns (out of P0.4 scope) is fine.
    expect(rule.test('name: user.name,')).toBe(false);
    expect(rule.test('username: user.username,')).toBe(false);
    expect(rule.test('profile_picture_url: row.profile_picture_url,')).toBe(false);
    // Other declarations that just happen to use these names are fine.
    expect(rule.test('const username = req.body.username;')).toBe(false);
    expect(rule.test('user.profile_picture_url = url;')).toBe(false);
  });

  test('per-line allowlist documents the known pre-existing manual injections', () => {
    // P0.4 audit follow-up: localProfiles.js + personas.js entries dropped
    // (those creator slots now mirror author with the new identity shape).
    // Only the users.js compat-search response remains.
    expect(guard.ALLOWLIST_LINE_KEYS.size).toBeGreaterThan(0);
    expect([...guard.ALLOWLIST_LINE_KEYS].some((k) => k.startsWith('backend/routes/users.js:'))).toBe(true);
    expect([...guard.ALLOWLIST_LINE_KEYS].some((k) => k.startsWith('backend/routes/localProfiles.js:'))).toBe(false);
    expect([...guard.ALLOWLIST_LINE_KEYS].some((k) => k.startsWith('backend/routes/personas.js:'))).toBe(false);
  });
});
