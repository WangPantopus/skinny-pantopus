/**
 * Legacy UI terms regression coverage.
 *
 * Two renames have happened on the broadcast-identity surface:
 *   1. P0.5 retired identityUiText() and migrated "Audience Profile" →
 *      "Public Profile" (and "Identity Center" → "Profiles & Privacy",
 *      "Broadcast channel" → "Updates") at source on every callsite.
 *   2. The follow-up rename retired "Public Profile" in favor of "Beacon".
 *
 * Coverage:
 *   1. identityUiText is gone from the web + mobile identityLabels modules.
 *   2. No source line in the scanned roots still uses the legacy
 *      "Audience Profile" / "Public Profile" / "audience member" /
 *      "Audience count" / "Identity Center" phrases (design-doc references
 *      in comments are allowlisted).
 *   3. The CI grep guard passes on the current tree, and its rule registry
 *      catches the phrases anyone tempted to type the old wording would
 *      use.
 *   4. Backend route error messages produced by the previously-rewritten
 *      modules now ship the current wording at source.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

function readSource(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
}

describe('identityUiText is gone', () => {
  // The native repo intentionally does not include the production React
  // Native app, and web can diverge; enforce this check only for modules
  // that are present in the active workspace.
  const optionalIdentityLabelModules = [
    'frontend/apps/web/src/lib/identityLabels.ts',
    'frontend/apps/mobile/src/utils/identityLabels.ts',
  ].filter((rel) => fs.existsSync(path.join(REPO_ROOT, rel)));

  for (const rel of optionalIdentityLabelModules) {
    test(`${rel} no longer exports identityUiText`, () => {
      const src = readSource(rel);
      expect(src).not.toMatch(/^\s*export\s+function\s+identityUiText\b/m);
      expect(src).not.toMatch(/^\s*export\s+const\s+identityUiText\b/m);
      // The function body itself is gone — `.replace(/\bAudience Profile\b/g, ...)`
      // was the dead giveaway.
      expect(src).not.toMatch(/\\bAudience Profile\\b/);
    });
  }
});

describe('backend error messages use the current wording', () => {
  test('routes/personas.js carries Beacon wording, not Audience Profile or Public Profile', () => {
    const src = readSource('backend/routes/personas.js');
    expect(src).not.toMatch(/Audience Profile/);
    expect(src).not.toMatch(/Public Profile/);
    expect(src).toMatch(/Beacon not found/);
    expect(src).toMatch(/'Failed to create Beacon'/);
  });

  test('middleware/rateLimiter.js carries Beacon wording', () => {
    const src = readSource('backend/middleware/rateLimiter.js');
    expect(src).not.toMatch(/Audience Profile/);
    expect(src).not.toMatch(/Public Profile/);
    expect(src).toMatch(/Beacon follow requests/);
  });

  test('utils/identityPolicy.js reasons reference Beacon', () => {
    const src = readSource('backend/utils/identityPolicy.js');
    expect(src).not.toMatch(/Audience Profile/);
    expect(src).not.toMatch(/Public Profile/);
    expect(src).toMatch(/Beacon posts cannot be shared/);
  });

  test('routes/identityCenter.js error message is the current wording', () => {
    const src = readSource('backend/routes/identityCenter.js');
    expect(src).not.toMatch(/Failed to load Identity Center/);
    expect(src).toMatch(/Failed to load Profiles & Privacy/);
  });

  test('routes/broadcastChannels.js no longer references "broadcast channel" in user copy', () => {
    const src = readSource('backend/routes/broadcastChannels.js');
    expect(src).not.toMatch(/'Broadcast channel not found'/);
    expect(src).not.toMatch(/'You cannot view this broadcast channel'/);
    expect(src).toMatch(/'Updates not found'/);
    expect(src).toMatch(/'You cannot view these updates'/);
  });
});

describe('CI grep guard against legacy UI terms', () => {
  const guard = require('../../scripts/ci/check-legacy-ui-terms');

  test('the current repo passes the guard', () => {
    // Ignore the transient synthetic fixtures that tests/unit/privacy/
    // privacyGates.test.js writes into the scanned roots to prove each gate
    // fires (e.g. `__p07_ui_term_violation__.js`). Jest runs test files in
    // parallel workers over one shared filesystem, so such a file can
    // momentarily exist while this scan walks the tree; it is never real
    // source, so a "the real repo is clean" assertion must exclude it to
    // stay deterministic. A genuine violation still fails this test.
    const SYNTHETIC_FIXTURE = /__\w*violation__\.[cm]?[jt]sx?$/;
    const violations = guard.scan().filter((v) => !SYNTHETIC_FIXTURE.test(v.file));
    expect(violations).toEqual([]);
  });

  test('rule registry covers all retired phrases', () => {
    const names = guard.FORBIDDEN_PHRASES.map((r) => r.name);
    expect(names.some((n) => n.startsWith('Audience Profile'))).toBe(true);
    expect(names.some((n) => n.startsWith('audience profile'))).toBe(true);
    expect(names.some((n) => /audience [Mm]ember/i.test(n))).toBe(true);
    expect(names.some((n) => /audience count/i.test(n))).toBe(true);
    expect(names).toContain('Identity Center');
    expect(names.some((n) => n.startsWith('Public Profile'))).toBe(true);
    expect(names.some((n) => n.startsWith('Public Profiles'))).toBe(true);
  });

  test('phrase rules accept current wording and reject retired wording', () => {
    const matches = (line) =>
      guard.FORBIDDEN_PHRASES.filter((rule) => rule.pattern.test(line)).map((r) => r.name);

    // Current wording is fine.
    expect(matches('throw new Error("Beacon not found");')).toEqual([]);
    expect(matches('Followers cannot be promoted to admins')).toEqual([]);
    expect(matches('return res.json({ title: "Profiles & Privacy" });')).toEqual([]);

    // Retired wording trips the guard.
    expect(matches('throw new Error("Audience Profile not found");').length).toBeGreaterThan(0);
    expect(matches('throw new Error("Public Profile not found");').length).toBeGreaterThan(0);
    expect(matches('return res.json({ error: "audience member not found" });').length).toBeGreaterThan(0);
    expect(matches('return res.json({ error: "Failed to load Identity Center" });').length).toBeGreaterThan(0);

    // Lowercase "public profile" is intentionally NOT forbidden — peer-to-peer
    // surfaces use that phrasing for the regular user profile in log strings
    // and JSDoc, and that is not the broadcast feature.
    expect(matches("logger.error('Home public profile error', err);")).toEqual([]);
  });

  test('comment-like lines and design-doc references are allowlisted', () => {
    expect(guard.COMMENT_LIKE_PATTERNS.some((re) => re.test('// Audience Profile design v2 §16 item 4'))).toBe(true);
    expect(guard.COMMENT_LIKE_PATTERNS.some((re) => re.test(' * Audience Profile design v2 §16 item 4'))).toBe(true);
  });
});
