#!/usr/bin/env node
/**
 * CI guard against re-introducing legacy UI terms.
 *
 * History — two renames have happened on the broadcast-identity surface:
 *   1. P0.5 retired identityUiText() and migrated "Audience Profile" →
 *      "Public Profile" (and "Identity Center" → "Profiles & Privacy",
 *      "Broadcast channel" → "Updates") at source on every callsite.
 *   2. The follow-up rename retired "Public Profile" in favor of "Beacon"
 *      across user-facing surfaces.
 *
 * This guard enforces both: any new occurrence of the legacy phrasing in
 * source string literals — not in design-doc comments — fails the build.
 *
 * Scope: backend user-facing surfaces (route error messages, notification
 * copy, rate-limiter messages) and frontend identityLabels modules. The
 * guard does NOT touch:
 *
 *   - schema column names like `audience_label`, `audience_mode`, the
 *     `'persona'` enum value, or the `/app/audience` URL — none of these
 *     contain the rewritten phrases.
 *   - design-doc references like "Audience Profile design v2 §16 item N",
 *     which are intentional paper trail.
 *   - generic words like "audience" (unqualified) and "broadcast" (in
 *     technical contexts such as table/column names) — only the specific
 *     phrases the rename retired.
 *   - lowercase "public profile" in backend logs / comments that refer to
 *     the *peer-to-peer* user profile, which is not the broadcast surface.
 *     Only the capitalized brand form "Public Profile" is forbidden.
 *
 * Run via:    node backend/scripts/ci/check-legacy-ui-terms.js
 * Exit code:  0 = clean, 1 = forbidden phrase detected.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SCAN_ROOTS = [
  path.join(REPO_ROOT, 'backend', 'routes'),
  path.join(REPO_ROOT, 'backend', 'services'),
  path.join(REPO_ROOT, 'backend', 'middleware'),
  path.join(REPO_ROOT, 'backend', 'utils'),
  path.join(REPO_ROOT, 'frontend', 'apps', 'web', 'src', 'lib'),
  path.join(REPO_ROOT, 'frontend', 'apps', 'mobile', 'src', 'utils'),
];

// Each rule matches a phrase one of the renames retired.
const FORBIDDEN_PHRASES = [
  { name: 'Audience Profile (capitalized)', pattern: /\bAudience Profile\b/ },
  { name: 'Audience Profiles (capitalized)', pattern: /\bAudience Profiles\b/ },
  { name: 'audience profile (lowercase)', pattern: /\baudience profile\b/ },
  { name: 'audience profiles (lowercase)', pattern: /\baudience profiles\b/ },
  { name: 'Audience Member / audience member', pattern: /\b[Aa]udience [Mm]ember(s)?\b/ },
  { name: 'Audience count / audience count', pattern: /\b[Aa]udience count\b/ },
  { name: 'Identity Center', pattern: /\bIdentity Center\b/ },
  // Public Profile → Beacon rename. Only the capitalized brand form is
  // forbidden; lowercase "public profile" in peer-to-peer log strings and
  // comments is intentionally permitted (see file docstring).
  { name: 'Public Profile (capitalized)', pattern: /\bPublic Profile\b/ },
  { name: 'Public Profiles (capitalized)', pattern: /\bPublic Profiles\b/ },
  // "Identity Firewall" appears throughout the audit log / privacy module
  // commentary — those are technical / architectural references, not
  // user-facing UI. Allowlisted by NOT including a phrase rule for it.
];

// Skip lines that are clearly comments — design-doc references are paper
// trail and intentional.
const COMMENT_LIKE_PATTERNS = [
  /^\s*\/\//,
  /^\s*\*/,
  /^\s*\/\*/,
  /^\s*#/,
];

function isCommentLike(line) {
  return COMMENT_LIKE_PATTERNS.some((re) => re.test(line));
}

function* walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile() && /\.(js|cjs|mjs|ts|tsx)$/.test(entry.name)) {
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
        if (isCommentLike(line)) return;
        // Skip lines that contain the design-doc reference phrase even if
        // they aren't pure comment lines (rare; the doc reference includes
        // "Audience Profile design").
        if (/Audience Profile design/.test(line)) return;
        for (const rule of FORBIDDEN_PHRASES) {
          if (rule.pattern.test(line)) {
            violations.push({ file, line: idx + 1, rule: rule.name, text: line.trim() });
          }
        }
      });
    }
  }
  return violations;
}

function format(violations) {
  if (violations.length === 0) return 'OK — no legacy UI terms found in user-facing strings.';
  const lines = ['Forbidden legacy UI terms detected:'];
  for (const v of violations) {
    lines.push(`  ${path.relative(REPO_ROOT, v.file)}:${v.line}  [${v.rule}]`);
    lines.push(`    ${v.text}`);
  }
  lines.push('');
  lines.push('User-facing strings must be written in their final form at source —');
  lines.push('Beacon, Follower, Profiles & Privacy, Updates — not rewritten at');
  lines.push('runtime and not via legacy phrasing.');
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
  FORBIDDEN_PHRASES,
  COMMENT_LIKE_PATTERNS,
  SCAN_ROOTS,
};
