#!/usr/bin/env node
'use strict';

/**
 * Convenience wrapper for auditing the standard two-user Identity Firewall seed.
 *
 * Usage:
 *   IDENTITY_FIREWALL_AUDIT_BASE_URL=http://localhost:5001 \
 *   IDENTITY_FIREWALL_AUDIT_TOKEN='...' \
 *   npm run audit:identity-firewall:seed
 */

const path = require('path');
const { spawnSync } = require('child_process');

function normalizePrefix(prefix) {
  return String(prefix || 'ifw_seed').replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
}

function appendUniqueCsv(existing, values) {
  const seen = new Set();
  const all = [];
  for (const value of [
    ...String(existing || '').split(','),
    ...values,
  ]) {
    const trimmed = String(value || '').trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    all.push(trimmed);
  }
  return all.join(',');
}

function resolvePresetEnv(env = process.env) {
  const prefix = normalizePrefix(
    env.IDENTITY_FIREWALL_AUDIT_PRESET_PREFIX ||
    env.IDENTITY_FIREWALL_SEED_PREFIX ||
    'ifw_seed',
  );
  const nextEnv = { ...env };
  nextEnv.IDENTITY_FIREWALL_AUDIT_LOCAL_HANDLE =
    nextEnv.IDENTITY_FIREWALL_AUDIT_LOCAL_HANDLE || `${prefix}_local`;
  nextEnv.IDENTITY_FIREWALL_AUDIT_PERSONA_HANDLE =
    nextEnv.IDENTITY_FIREWALL_AUDIT_PERSONA_HANDLE || `${prefix}_audience`;
  nextEnv.IDENTITY_FIREWALL_FORBIDDEN_VALUES = appendUniqueCsv(
    nextEnv.IDENTITY_FIREWALL_FORBIDDEN_VALUES,
    [
      `${prefix}_owner@example.test`,
      `${prefix}_follower@example.test`,
      `${prefix}_owner`,
      `${prefix}_follower`,
      'Identity Owner',
      'Identity Follower',
      'Seed owner private/local account.',
      'Seed follower local account.',
      'local-only nearby post that must not appear on the Audience Profile',
    ],
  );
  return nextEnv;
}

function printHelp() {
  console.log(`Identity Firewall seed audit preset

Runs identity-firewall-raw-user-audit.js against the standard two-user seed handles.

Env:
  IDENTITY_FIREWALL_AUDIT_BASE_URL        API origin, default http://localhost:5001
  IDENTITY_FIREWALL_AUDIT_TOKEN           Optional bearer token for authenticated checks
  IDENTITY_FIREWALL_AUDIT_PRESET_PREFIX   Seed prefix, default IDENTITY_FIREWALL_SEED_PREFIX or ifw_seed
  IDENTITY_FIREWALL_AUDIT_LOCAL_HANDLE    Override local handle, default <prefix>_local
  IDENTITY_FIREWALL_AUDIT_PERSONA_HANDLE  Override persona handle, default <prefix>_audience
  IDENTITY_FIREWALL_FORBIDDEN_VALUES      Extra comma-separated private values to reject
`);
}

function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp();
    return;
  }

  const scriptPath = path.resolve(__dirname, 'identity-firewall-raw-user-audit.js');
  const result = spawnSync(process.execPath, [scriptPath, ...process.argv.slice(2)], {
    env: resolvePresetEnv(process.env),
    stdio: 'inherit',
  });

  if (result.error) {
    console.error('[FAIL]', result.error.message);
    process.exitCode = 1;
    return;
  }
  process.exitCode = result.status == null ? 1 : result.status;
}

if (require.main === module) {
  main();
}

module.exports = {
  appendUniqueCsv,
  normalizePrefix,
  resolvePresetEnv,
};
