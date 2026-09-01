/**
 * P0.7 — privacy gates registry tests.
 *
 * The actual contract checks live in their respective gate modules; this
 * file's job is to assert the gate registry itself stays sound:
 *   - The current repo passes every gate.
 *   - Each gate's rule registry rejects representative violations and
 *     accepts representative valid lines.
 *
 * Audience Profile design v2 §13 + §16. See
 * `backend/scripts/ci/run-privacy-gates.js` for the orchestrator and
 * `npm run test:privacy` for the local entry point.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

const creatorSelect = require('../../../scripts/ci/check-creator-select');
const legacyAliases = require('../../../scripts/ci/check-legacy-identity-aliases');
const legacyUiTerms = require('../../../scripts/ci/check-legacy-ui-terms');
const rawPersonalSelects = require('../../../scripts/ci/check-raw-personal-selects');
const nestedUserSelects = require('../../../scripts/ci/check-nested-user-selects');

describe('P0.7 — privacy gates: current repo is clean', () => {
  test('Gate 3a: legacy identity-aliases passes', () => {
    expect(legacyAliases.run()).toBe(0);
  });

  test('Gate 3b: legacy UI terms passes', () => {
    expect(legacyUiTerms.run()).toBe(0);
  });

  test('Gate 3c: legacy CREATOR_SELECT passes', () => {
    expect(creatorSelect.run()).toBe(0);
  });

  test('Gate 3d: raw personal-identity SELECT passes', () => {
    expect(rawPersonalSelects.run()).toBe(0);
  });

  test('Gate 3e: nested User select (file-allowlisted) passes', () => {
    expect(nestedUserSelects.run()).toBe(0);
  });
});

describe('P0.7 — Gate 3d (raw personal-identity SELECT) rule registry', () => {
  test('detects a raw SQL "SELECT u.name FROM User" pattern', () => {
    const rule = rawPersonalSelects.FORBIDDEN_LINE.find(
      (r) => r.name === 'raw SQL SELECT u.<personal-column> FROM User',
    );
    expect(rule).toBeDefined();
    expect(rule.test('SELECT u.name, u.username FROM "public"."User" u')).toBe(true);
    expect(rule.test('SELECT u.email FROM "public"."User" u WHERE u.id = $1')).toBe(true);
    expect(rule.test('SELECT u.phone, u.address FROM "User" u')).toBe(true);
    // SAFE columns alone don't trip — we only flag personal-identity columns.
    expect(rule.test('SELECT u.id, u.username FROM "public"."User" u')).toBe(false);
    expect(rule.test('SELECT u.id, u.profile_picture_url FROM "public"."User" u')).toBe(false);
  });

  test('detects audience-side files including LocalProfile via Prisma', () => {
    const rule = rawPersonalSelects.FORBIDDEN_LINE.find(
      (r) => r.name === 'Prisma-style include of LocalProfile in an audience-side file',
    );
    expect(rule).toBeDefined();
    expect(rule.audienceOnly).toBe(true);
    expect(rule.test('  include: { LocalProfile: { select: { handle: true } } }')).toBe(true);
    expect(rule.test('  LocalProfile: true,')).toBe(true);
    // Mentioning LocalProfile in a non-include context (a comment, a type
    // import) is fine.
    expect(rule.test("import type { LocalProfile } from '@pantopus/types';")).toBe(false);
  });

  test('audience-side file detection recognises persona / audience / broadcast / membership names', () => {
    const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
    expect(rawPersonalSelects.fileLooksAudienceSide(path.join(repoRoot, 'backend/routes/personas.js'))).toBe(true);
    expect(rawPersonalSelects.fileLooksAudienceSide(path.join(repoRoot, 'backend/routes/broadcastChannels.js'))).toBe(true);
    expect(rawPersonalSelects.fileLooksAudienceSide(path.join(repoRoot, 'backend/services/audienceFeed.js'))).toBe(true);
    expect(rawPersonalSelects.fileLooksAudienceSide(path.join(repoRoot, 'backend/routes/gigs.js'))).toBe(false);
    expect(rawPersonalSelects.fileLooksAudienceSide(path.join(repoRoot, 'backend/routes/listings.js'))).toBe(false);
  });
});

describe('P0.7 — synthetic violations fire the gates', () => {
  // Create a temp file that violates the raw-SELECT rule, drop it under one
  // of the scan roots, run the gate, and verify it reports the violation.
  // Clean up after.
  const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
  const tmpFiles = [];
  afterEach(() => {
    for (const f of tmpFiles) {
      try { fs.unlinkSync(f); } catch (_) { /* already removed */ }
    }
    tmpFiles.length = 0;
  });

  test('a synthetic raw-SQL SELECT violation is caught by Gate 3d', () => {
    const dir = path.join(REPO_ROOT, 'backend/utils');
    const synthetic = path.join(dir, '__p07_test_violation__.js');
    fs.writeFileSync(synthetic, "module.exports = `SELECT u.name FROM \"public\".\"User\" u WHERE u.id = $1`;\n");
    tmpFiles.push(synthetic);
    const violations = rawPersonalSelects.scan();
    const hit = violations.find((v) => v.file === synthetic);
    expect(hit).toBeDefined();
    expect(hit.rule).toMatch(/raw SQL/i);
  });

  test('a synthetic audience-side LocalProfile include is caught by Gate 3d', () => {
    const dir = path.join(REPO_ROOT, 'backend/routes');
    const synthetic = path.join(dir, '__p07_persona_test_violation__.js');
    fs.writeFileSync(
      synthetic,
      'module.exports = { findUnique: { include: { LocalProfile: true } } };\n',
    );
    tmpFiles.push(synthetic);
    const violations = rawPersonalSelects.scan();
    const hit = violations.find((v) => v.file === synthetic);
    expect(hit).toBeDefined();
    expect(hit.rule).toMatch(/LocalProfile/);
  });

  test('a synthetic CREATOR_SELECT re-introduction is caught by Gate 3c', () => {
    const dir = path.join(REPO_ROOT, 'backend/utils');
    const synthetic = path.join(dir, '__p07_creator_select_violation__.js');
    fs.writeFileSync(synthetic, "const FOO_CREATOR_SELECT = 'id, username, name, email';\n");
    tmpFiles.push(synthetic);
    const violations = creatorSelect.scan();
    const hit = violations.find((v) => v.file === synthetic);
    expect(hit).toBeDefined();
  });

  test('a synthetic withLegacyPublicIdentityAliases re-introduction is caught by Gate 3a', () => {
    const dir = path.join(REPO_ROOT, 'backend/utils');
    const synthetic = path.join(dir, '__p07_legacy_alias_violation__.js');
    fs.writeFileSync(
      synthetic,
      'function withLegacyPublicIdentityAliases(identity) { return identity; }\nmodule.exports = withLegacyPublicIdentityAliases;\n',
    );
    tmpFiles.push(synthetic);
    const violations = legacyAliases.scan();
    const hit = violations.find((v) => v.file === synthetic);
    expect(hit).toBeDefined();
  });

  test('a synthetic legacy-UI-term re-introduction is caught by Gate 3b', () => {
    const dir = path.join(REPO_ROOT, 'backend/utils');
    const synthetic = path.join(dir, '__p07_ui_term_violation__.js');
    fs.writeFileSync(
      synthetic,
      "module.exports = { error: 'Audience Profile not found' };\n",
    );
    tmpFiles.push(synthetic);
    const violations = legacyUiTerms.scan();
    const hit = violations.find((v) => v.file === synthetic);
    expect(hit).toBeDefined();
  });

  test('a synthetic nested User select in a NEW file is caught by Gate 3e', () => {
    const dir = path.join(REPO_ROOT, 'backend/utils');
    const synthetic = path.join(dir, '__p07_nested_user_select_violation__.js');
    fs.writeFileSync(
      synthetic,
      "module.exports = `select('id, creator:user_id (id, username, name, city)')`;\n",
    );
    tmpFiles.push(synthetic);
    const violations = nestedUserSelects.scan();
    const hit = violations.find((v) => v.file === synthetic);
    expect(hit).toBeDefined();
  });

  test('a synthetic nested User select in an ALLOWLISTED file is NOT caught by Gate 3e', () => {
    // routes/chats.js is on the allowlist (it has pre-existing offenders).
    // A new offender added to it would not trip the gate — that's the
    // documented technical-debt acceptance. Demonstrate with a temp file
    // path that matches an allowlisted file name.
    const synthetic = path.join(REPO_ROOT, 'backend/routes', 'chats.js');
    // We do NOT actually mutate chats.js — just verify the allowlist
    // contains the entry, which proves the rule would skip it.
    expect(nestedUserSelects.ALLOWLISTED_FILES.has(synthetic)).toBe(true);
  });
});
