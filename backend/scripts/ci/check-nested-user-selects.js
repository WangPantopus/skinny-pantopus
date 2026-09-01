#!/usr/bin/env node
/**
 * P0.7 audit follow-up: broader nested-User-select guard.
 *
 * P0.3 (check-creator-select.js) covered the `CREATOR_SELECT` literal and
 * Prisma-style `select: { name: true, email: true }` patterns. The original
 * audit also surfaced ~30 pre-existing Supabase nested selects across
 * chats / gigs / home / professional / supportTrains / mailboxV2 /
 * businesses / offersV2 / posts that pull `name`, `first_name`,
 * `last_name`, `city`, or `state` off the User table directly.
 *
 * P0.3 narrowed scope to keep that PR focused. This gate locks in the
 * current pre-existing surface as a *file allowlist*: any new nested
 * select on User that pulls personal-identity columns FAILS the build,
 * unless it lives in one of the legacy files documented below. Reviewers
 * should reject growth of the allowlist.
 *
 * Run via:  node backend/scripts/ci/check-nested-user-selects.js
 * Exit 0 = clean, 1 = forbidden pattern in a non-allowlisted file.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SCAN_ROOTS = [
  path.join(REPO_ROOT, 'backend', 'routes'),
  path.join(REPO_ROOT, 'backend', 'services'),
  path.join(REPO_ROOT, 'backend', 'jobs'),
  path.join(REPO_ROOT, 'backend', 'middleware'),
  path.join(REPO_ROOT, 'backend', 'utils'),
];

// Files that already contain leaky nested selects on the User table as of
// the P0.7 follow-up audit. Each file's continuing offenders are accepted
// debt scheduled for a follow-up cleanup; new files cannot be added here.
//
// To remove a file from the allowlist, refactor every offending nested
// select inside it to use SAFE_CREATOR_SELECT (see
// backend/serializers/identitySerializers.js) and project through the
// appropriate serializer.
const ALLOWLISTED_FILES = new Set([
  path.join(REPO_ROOT, 'backend', 'routes', 'businesses.js'),
  path.join(REPO_ROOT, 'backend', 'routes', 'chats.js'),
  path.join(REPO_ROOT, 'backend', 'routes', 'gigs.js'),
  path.join(REPO_ROOT, 'backend', 'routes', 'home.js'),
  path.join(REPO_ROOT, 'backend', 'routes', 'homeOwnership.js'),
  path.join(REPO_ROOT, 'backend', 'routes', 'listings.js'),
  path.join(REPO_ROOT, 'backend', 'routes', 'mailboxV2.js'),
  path.join(REPO_ROOT, 'backend', 'routes', 'mailboxV2Phase3.js'),
  path.join(REPO_ROOT, 'backend', 'routes', 'offersV2.js'),
  path.join(REPO_ROOT, 'backend', 'routes', 'professional.js'),
  path.join(REPO_ROOT, 'backend', 'routes', 'supportTrains.js'),
  path.join(REPO_ROOT, 'backend', 'routes', 'blocks.js'),
  // posts.js still has 4 sites where `author:user_id (id, username, name,
  // first_name, last_name, profile_picture_url)` is used in admin / debug
  // surfaces. The user-facing feed paths were migrated by P0.3.
  path.join(REPO_ROOT, 'backend', 'routes', 'posts.js'),
]);

const FORBIDDEN_LINE = [
  {
    name: 'leaky nested User select (creator/buyer/follower/following/user/asker/answerer/reviewer/sender/recipient)',
    test: (line) =>
      /(?:creator|buyer|following|follower|user|User|asker|answerer|reviewer|sender|recipient|owner|claimant)\s*:\s*\w+_id\s*\([^)]*\b(name|first_name|last_name|city|state)\b/i.test(line),
  },
];

const COMMENT_LIKE = [/^\s*\/\//, /^\s*\*/, /^\s*\/\*/];

function isCommentLike(line) {
  return COMMENT_LIKE.some((re) => re.test(line));
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
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, idx) => {
        if (isCommentLike(line)) return;
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
  if (violations.length === 0) return 'OK — no new leaky nested User selects found.';
  const lines = ['Forbidden leaky nested User selects detected (NEW file):'];
  for (const v of violations) {
    lines.push(`  ${path.relative(REPO_ROOT, v.file)}:${v.line}  [${v.rule}]`);
    lines.push(`    ${v.text}`);
  }
  lines.push('');
  lines.push('Use SAFE_CREATOR_SELECT for User joins (Audience Profile design v2 §16');
  lines.push('item 2) and project the result through serializeUserAsLocalIdentity (or');
  lines.push('the appropriate higher-level serializer) before returning. The pre-');
  lines.push('existing surface is allowlisted in scripts/ci/check-nested-user-selects.js;');
  lines.push('reviewers will not accept growth of that list.');
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
  ALLOWLISTED_FILES,
};
