#!/usr/bin/env node
/**
 * P0.7 Gate 3 (extended): raw personal-identity SELECT guard.
 *
 * Audience Profile design v2 §16 item 2 + §6.1: raw User-personal columns
 * (name, first_name, last_name, email, phone, address, city, state) must
 * never be selected from the User table directly into an API response.
 * Routes use SAFE_CREATOR_SELECT (P0.3) for nested supabase joins, and
 * project the result through serializeUserAsLocalIdentity / equivalent
 * before returning.
 *
 * P0.3's check-creator-select.js targets the legacy CREATOR_SELECT
 * identifier and Prisma-style `select: { name: true, … }` patterns. This
 * script extends the perimeter to catch:
 *
 *   1. Raw SQL string literals that pull legal-name / contact / address
 *      columns off the User table:
 *        `SELECT u.name FROM ...`, `SELECT u.email, u.phone FROM ...`
 *   2. Prisma-style `include: { LocalProfile: ... }` from a file path
 *      that suggests an audience-side surface (any file under routes,
 *      services, or utils whose name contains `persona`, `audience`,
 *      `broadcast`, or `membership`). LocalProfile flowing into an
 *      audience-side response is a cross-context leak (§5.2 direction C).
 *
 * Comments and design-doc references in JSDoc are skipped.
 *
 * Run via:    node backend/scripts/ci/check-raw-personal-selects.js
 * Exit code:  0 = clean, 1 = forbidden pattern detected.
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

const LEAKY_USER_COLUMNS = ['name', 'first_name', 'last_name', 'email', 'phone', 'address', 'city', 'state', 'legal_name'];
const LEAKY_USER_COLUMN_RE = LEAKY_USER_COLUMNS.join('|');

const FORBIDDEN_LINE = [
  {
    name: 'raw SQL SELECT u.<personal-column> FROM User',
    // Match `SELECT u.name`, `SELECT u.email`, ... `FROM "User"` with optional
    // additional columns and any alias `u`. Catches both quoted and unquoted
    // table references.
    test: (line) => new RegExp(
      `(?:SELECT|select)\\b[^;]*\\bu\\.(?:${LEAKY_USER_COLUMN_RE})\\b`,
      'i',
    ).test(line),
  },
  {
    name: 'Prisma-style include of LocalProfile in an audience-side file',
    // Detection is per-file (see scopeForFile below) — the rule fires only
    // when the file path looks audience-side AND the line contains
    // `LocalProfile:` as a prisma include / select key.
    test: (line) => /\bLocalProfile\s*:\s*(?:\{|true\b)/.test(line),
    audienceOnly: true,
  },
];

const ALLOWLIST_LINE_PATTERNS = [
  /^\s*\/\//,
  /^\s*\*/,
  /^\s*\/\*/,
];

function isCommentLike(line) {
  return ALLOWLIST_LINE_PATTERNS.some((re) => re.test(line));
}

const AUDIENCE_FILE_HINTS = /(persona|audience|broadcast|membership)/i;
function fileLooksAudienceSide(absPath) {
  const rel = path.relative(REPO_ROOT, absPath);
  return AUDIENCE_FILE_HINTS.test(rel);
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
      const audienceSide = fileLooksAudienceSide(file);
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, idx) => {
        if (isCommentLike(line)) return;
        for (const rule of FORBIDDEN_LINE) {
          if (rule.audienceOnly && !audienceSide) continue;
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
  if (violations.length === 0) return 'OK — no raw personal-identity selects found.';
  const lines = ['Forbidden raw personal-identity SELECT patterns detected:'];
  for (const v of violations) {
    lines.push(`  ${path.relative(REPO_ROOT, v.file)}:${v.line}  [${v.rule}]`);
    lines.push(`    ${v.text}`);
  }
  lines.push('');
  lines.push('Use SAFE_CREATOR_SELECT for User joins (Audience Profile design v2 §16');
  lines.push('item 2) and project through serializeUserAsLocalIdentity / a serializer');
  lines.push('appropriate to the context. Audience-side files must NOT include or');
  lines.push('select LocalProfile data — see design v2 §5.2 direction C.');
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
  fileLooksAudienceSide,
};
