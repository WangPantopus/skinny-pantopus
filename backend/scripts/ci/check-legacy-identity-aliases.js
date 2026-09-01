#!/usr/bin/env node
/**
 * P0.4 — CI guard against re-introducing the legacy public-identity aliases.
 *
 * Audience Profile design v2 §16 item 3: the `withLegacyPublicIdentityAliases`
 * helper used to re-inject `username`, `name`, `first_name`, and
 * `profile_picture_url` onto every public identity object so legacy
 * mobile/web clients could keep reading the old shape. P0.4 deleted the
 * helper; consumers now read `handle`, `displayName`, `avatarUrl` directly.
 *
 * This script fails (exit 1) if anyone:
 *   1. re-introduces the helper (function or const) under that name; or
 *   2. manually injects the same alias mapping on an identity object,
 *      e.g. `username: identity.handle || identity.username` /
 *      `name: identity.displayName || identity.name` /
 *      `profile_picture_url: identity.avatarUrl`.
 *
 * Run via:    node backend/scripts/ci/check-legacy-identity-aliases.js
 * Exit code:  0 = clean, 1 = forbidden pattern detected.
 *
 * Allowlist note: comments referencing the helper for documentation are
 * skipped, and the legacyCreatorFromAuthor helper in feedService — which is
 * a separate legacy-shape bridge for feed `creator` slots that follow-up
 * cleanup will retire — is allowlisted by file. Any new file violating
 * either rule fails the build.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SCAN_ROOTS = [
  path.join(REPO_ROOT, 'backend', 'serializers'),
  path.join(REPO_ROOT, 'backend', 'routes'),
  path.join(REPO_ROOT, 'backend', 'middleware'),
  path.join(REPO_ROOT, 'backend', 'utils'),
];

// File-level allowlist for known legacy bridges that have a separate
// scheduled removal (not P0.4). Adding a new file here means we are
// accepting more legacy debt; reviewers should reject that.
// Empty as of the P0.4 audit follow-up: legacyCreatorFromAuthor was retired
// alongside its frontend consumers, so feedService.js no longer needs an
// allowlist exemption. Reviewers should reject growth of this list.
const ALLOWLISTED_FILES = new Set([]);

const FORBIDDEN_LINE = [
  {
    name: 'withLegacyPublicIdentityAliases function',
    test: (line) =>
      /\b(function|const|let|var)\s+withLegacyPublicIdentityAliases\b/.test(line),
  },
  {
    // Catches the inverse mapping the deleted helper performed —
    // `username: <var>.handle`, `name: <var>.displayName`,
    // `first_name: <var>.displayName`, `profile_picture_url: <var>.avatarUrl` —
    // exactly the lines anyone tempted to hand-roll the helper would write.
    // Manual construction of User/Business/Home shapes from raw columns
    // (e.g. `name: row.name`) is out of P0.4 scope and intentionally not
    // flagged here.
    name: 'manual identity alias injection (handle->username, displayName->name/first_name, avatarUrl->profile_picture_url)',
    test: (line) => (
      /\busername\s*:\s*\w+\.handle\b/.test(line)
      || /\bname\s*:\s*\w+\.displayName\b/.test(line)
      || /\bfirst_name\s*:\s*\w+\.displayName\b/.test(line)
      || /\bprofile_picture_url\s*:\s*\w+\.avatarUrl\b/.test(line)
    ),
  },
];

// Per-line allowlist: pre-existing manual alias injections in legacy code
// paths that have a separate scheduled cleanup. Each entry must include a
// brief justification; reviewers should reject growth of this list.
//
// P0.4 audit follow-up: localProfiles.js + personas.js entries removed —
// those creator slots now mirror author with the new identity shape
// (handle / displayName / avatarUrl). Only the users.js compat-search
// response remains, and its legacy shape is intentional (it mimics the
// pre-Identity-Firewall User search response so existing search consumers
// keep working).
const ALLOWLIST_LINE_KEYS = new Set([
  // routes/users.js:serializeCompatibilitySearchUser projects
  // profile.handle into a legacy `username` key for the v1 search response
  // shape. The whole response is a legacy compat surface; retiring it is
<<<<<<< ours
  // a separate audit item. (Line shifted 298 → 299 by the wedge Phase-1
  // funnel-events import at the top of the file; the site is unchanged.)
  'backend/routes/users.js:299',
=======
  // a separate audit item. (Line moved 298 → 304 when the persistent-login
  // requires were added at the top of routes/users.js.)
  'backend/routes/users.js:304',
>>>>>>> theirs
]);

const ALLOWLIST_LINE_PATTERNS = [
  // Pure comment lines.
  /^\s*\/\//,
  /^\s*\*/,
];

function isCommentLike(line) {
  return ALLOWLIST_LINE_PATTERNS.some((re) => re.test(line));
}

function* walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile() && /\.(js|cjs|mjs|ts)$/.test(entry.name)) {
      yield full;
    }
  }
}

function scan() {
  const violations = [];
  for (const root of SCAN_ROOTS) {
    for (const file of walk(root)) {
      if (ALLOWLISTED_FILES.has(file)) continue;
      const relFile = path.relative(REPO_ROOT, file);
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, idx) => {
        if (isCommentLike(line)) return;
        const key = `${relFile}:${idx + 1}`;
        if (ALLOWLIST_LINE_KEYS.has(key)) return;
        for (const rule of FORBIDDEN_LINE) {
          if (rule.test(line)) {
            violations.push({ file, line: idx + 1, rule: rule.name, text: line.trim() });
          }
        }
      });
    }
  }
  return violations;
}

function format(violations) {
  if (violations.length === 0) return 'OK — no legacy identity-alias patterns found.';
  const lines = ['Forbidden legacy identity-alias patterns detected:'];
  for (const v of violations) {
    lines.push(`  ${path.relative(REPO_ROOT, v.file)}:${v.line}  [${v.rule}]`);
    lines.push(`    ${v.text}`);
  }
  lines.push('');
  lines.push('withLegacyPublicIdentityAliases was removed in P0.4. Public identity');
  lines.push('objects expose handle / displayName / avatarUrl only — never the');
  lines.push('legacy username / name / first_name / profile_picture_url aliases.');
  return lines.join('\n');
}

function run() {
  const violations = scan();
  console.log(format(violations));
  return violations.length === 0 ? 0 : 1;
}

if (require.main === module) {
  process.exit(run());
}

module.exports = {
  run,
  scan,
  format,
  FORBIDDEN_LINE,
  ALLOWLIST_LINE_PATTERNS,
  ALLOWLISTED_FILES,
  ALLOWLIST_LINE_KEYS,
};
