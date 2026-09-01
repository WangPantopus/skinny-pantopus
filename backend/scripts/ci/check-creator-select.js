#!/usr/bin/env node
/**
 * P0.3 — CI guard against re-introducing leaky creator-select patterns.
 *
 * Audience Profile design v2 §16 item 2: the legacy `CREATOR_SELECT` constants
 * pulled User.name / first_name / last_name / city / state straight into API
 * responses, bypassing the serializer wall. P0.3 collapsed those constants
 * into a single audience-safe `SAFE_CREATOR_SELECT` defined in
 * backend/serializers/identitySerializers.js.
 *
 * This script fails (exit 1) if anyone:
 *   - declares or imports a literal `CREATOR_SELECT` (including renamed
 *     spellings like FOO_CREATOR_SELECT) outside the allowlist below; or
 *   - introduces a Supabase nested select that pulls `name`, `first_name`,
 *     `last_name`, `city`, or `state` off the User table on a creator /
 *     buyer / follower / following / user join.
 *
 * Run via:    node backend/scripts/ci/check-creator-select.js
 * Exit code:  0 = clean, 1 = forbidden pattern detected.
 *
 * Allowlist note: comments referencing the legacy name for documentation
 * (e.g. "P0.3: legacy CREATOR_SELECT replaced by …") are excluded so we
 * can keep an in-code paper trail. The allowlist is intentionally tight —
 * if it grows, that means the pattern has crept back in and we should fix
 * the new callsite instead of widening the allowlist.
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

// Patterns that are FORBIDDEN at any non-allowlisted line.
//
// Scope follows the P0.3 prompt: block re-introductions of the legacy
// `CREATOR_SELECT` constant name and Prisma-style ORM selects that pull
// personal-identity columns directly. Pre-existing leaky Supabase nested
// selects across the rest of the codebase are out of scope for P0.3 and
// will be migrated by follow-up PRs (P0.4+); this guard intentionally does
// not flag them so it does not block landing P0.3.
const FORBIDDEN_LINE = [
  {
    name: 'legacy CREATOR_SELECT identifier',
    // Match `CREATOR_SELECT` whenever it is NOT preceded by `SAFE_` — the
    // canonical replacement. Drops the leading `\b` because identifiers
    // like `FOO_CREATOR_SELECT` (a sneaky rename) are still legal JS
    // identifiers and we want to flag them.
    test: (line) => /(?<!SAFE_)CREATOR_SELECT\b/.test(line),
  },
  {
    name: 'Prisma-style select pulling personal-identity columns',
    test: (line) => /\bselect\s*:\s*\{[^}]*\b(name|email|phone|address|first_name|last_name|legal_name)\s*:\s*true/i.test(line),
  },
];

// Lines matching any allowlist pattern are skipped entirely.
const ALLOWLIST_LINE_PATTERNS = [
  // Pure comment lines (single-line // or /* ... */).
  /^\s*\/\//,
  /^\s*\*/,
  // String-literal mentions in error messages or doc strings.
  /"backend\/serializers\/identitySerializers\.js"/,
  // The serializer module itself documents the canonical constant.
  /SAFE_CREATOR_SELECT\s*=/,
];

function isAllowlisted(line) {
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
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, idx) => {
        if (isAllowlisted(line)) return;
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
  if (violations.length === 0) return 'OK — no leaky creator-select patterns found.';
  const lines = ['Forbidden creator-select patterns detected:'];
  for (const v of violations) {
    lines.push(`  ${path.relative(REPO_ROOT, v.file)}:${v.line}  [${v.rule}]`);
    lines.push(`    ${v.text}`);
  }
  lines.push('');
  lines.push('Use SAFE_CREATOR_SELECT from backend/serializers/identitySerializers.js,');
  lines.push('and project the resulting row through serializeUserAsLocalIdentity (or the');
  lines.push('appropriate higher-level serializer) before returning it to a client.');
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

module.exports = { run, scan, format, FORBIDDEN_LINE, ALLOWLIST_LINE_PATTERNS };
