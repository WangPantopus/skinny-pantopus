#!/usr/bin/env node
/**
 * P0.7 — `npm run test:privacy` orchestrator.
 *
 * Runs every privacy CI guard sequentially and exits non-zero on the first
 * failure (or on the cumulative failure count). The Jest-based contract
 * suites (serializer forbidden-keys, notification template harness) are
 * NOT run from here — they ship under the default `npm test` runner so
 * Phase 1 PRs have one place to verify everything passes. Use
 * `npm run test:privacy` for fast local feedback that exercises only
 * the privacy gates.
 *
 * Gates:
 *   1. Serializer forbidden-keys contract test (jest)
 *   2. Notification template registration + cross-context harness (jest)
 *   3. Legacy identity-aliases CI guard (P0.4)
 *   4. Legacy UI terms CI guard (P0.5)
 *   5. Creator-select CI guard (P0.3)
 *   6. Raw personal-identity SELECT guard (P0.7 new)
 *   7. Phase 1 audience-profile end-to-end (P1.15) — the integration
 *      counterpart to the per-serializer privacy gate. Exercises the
 *      full creator-pays-fan loop end-to-end and asserts the firewall
 *      invariants on the actual wire shapes.
 */

const path = require('path');
const { spawnSync } = require('child_process');

const BACKEND_DIR = path.resolve(__dirname, '..', '..');

function runStep(label, command, args, opts = {}) {
  process.stdout.write(`\n=== ${label} ===\n`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    cwd: opts.cwd || BACKEND_DIR,
    env: { ...process.env, ...(opts.env || {}) },
  });
  return result.status === 0 ? 0 : (result.status || 1);
}

function runJestStep(label, testPath) {
  return runStep(
    label,
    'npx',
    ['--no-install', 'jest', '--forceExit', '--colors', testPath],
  );
}

function runNodeStep(label, scriptPath) {
  return runStep(label, 'node', [scriptPath]);
}

function main() {
  const failures = [];

  if (runJestStep('Gate 1: serializer forbidden-keys contract', 'tests/unit/privacy/serializerForbiddenKeys.test.js') !== 0) {
    failures.push('Gate 1: serializer forbidden-keys');
  }
  if (runJestStep('Gate 2: notification template + cross-context harness', 'tests/unit/notificationContextFirewall.test.js') !== 0) {
    failures.push('Gate 2: notification template harness');
  }
  if (runNodeStep('Gate 3a: legacy identity-aliases', path.join(BACKEND_DIR, 'scripts/ci/check-legacy-identity-aliases.js')) !== 0) {
    failures.push('Gate 3a: legacy identity-aliases');
  }
  if (runNodeStep('Gate 3b: legacy UI terms', path.join(BACKEND_DIR, 'scripts/ci/check-legacy-ui-terms.js')) !== 0) {
    failures.push('Gate 3b: legacy UI terms');
  }
  if (runNodeStep('Gate 3c: legacy CREATOR_SELECT', path.join(BACKEND_DIR, 'scripts/ci/check-creator-select.js')) !== 0) {
    failures.push('Gate 3c: legacy CREATOR_SELECT');
  }
  if (runNodeStep('Gate 3d: raw personal-identity SELECT', path.join(BACKEND_DIR, 'scripts/ci/check-raw-personal-selects.js')) !== 0) {
    failures.push('Gate 3d: raw personal-identity SELECT');
  }
  if (runNodeStep('Gate 3e: nested User select (file-allowlisted)', path.join(BACKEND_DIR, 'scripts/ci/check-nested-user-selects.js')) !== 0) {
    failures.push('Gate 3e: nested User select');
  }
  if (runJestStep('Gate 4: Phase 1 audience-profile E2E', 'tests/integration/audienceProfile.e2e.test.js') !== 0) {
    failures.push('Gate 4: Phase 1 E2E');
  }

  process.stdout.write('\n=================================\n');
  if (failures.length === 0) {
    process.stdout.write('OK — all privacy gates passed.\n');
    return 0;
  }
  process.stdout.write(`FAIL — ${failures.length} gate(s) failed:\n`);
  for (const f of failures) {
    process.stdout.write(`  - ${f}\n`);
  }
  return 1;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { main };
