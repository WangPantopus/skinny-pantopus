#!/usr/bin/env node
/**
 * gen-association-files.mjs — regenerate the two OS association files served
 * by the web app from `frontend/apps/web/public/.well-known/`:
 *
 *   apple-app-site-association   (Universal Links + Password AutoFill / passkeys)
 *   assetlinks.json              (Android App Links + Credential Manager)
 *
 * The native apps (`app.pantopus.ios`, `app.pantopus.android`) replaced the
 * Expo-era app (`com.pantopus.app`). During the transition BOTH sets of
 * identifiers must be present, so this script:
 *   - keeps every entry already in the files that it does not own
 *     (the legacy Expo entries and any hand-added ones), and
 *   - upserts the native entries from environment variables.
 *
 * Node >= 18, no dependencies. Idempotent — safe to re-run.
 *
 * Environment (all optional; unset ⇒ that native entry is left untouched):
 *   APPLE_TEAM_ID                Apple Developer Team ID (10 chars), e.g. 6UYZBA546R
 *   IOS_BUNDLE_ID                default app.pantopus.ios
 *   ANDROID_PACKAGE              default app.pantopus.android
 *   ANDROID_SHA256_FINGERPRINTS  comma-separated SHA-256 cert fingerprints
 *                                (colon-separated uppercase hex, 32 bytes each).
 *                                Include BOTH the Play App Signing certificate
 *                                and the upload certificate; add the debug
 *                                keystore fingerprint only for a debug build.
 *   AASA_PATHS                   optional comma-separated override of the
 *                                applinks paths (default: copy the legacy entry's
 *                                paths, or the built-in list if none exists)
 *   WELL_KNOWN_DIR               override output directory
 *   --check                      exit 1 if the files would change (CI mode)
 *
 * Usage:
 *   APPLE_TEAM_ID=6UYZBA546R \
 *   ANDROID_SHA256_FINGERPRINTS="AA:BB:...,CC:DD:..." \
 *   node tools/gen-association-files.mjs
 *
 * See docs/persistent-login/ASSOCIATION-FILES.md for where the values come from
 * and how to verify the hosted files.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_DIR = path.resolve(
  __dirname,
  '..',
  'frontend',
  'apps',
  'web',
  'public',
  '.well-known',
);

const LEGACY_IOS_APP_ID = '6UYZBA546R.com.pantopus.app';
const LEGACY_ANDROID_PACKAGE = 'com.pantopus.app';

// Fallback path list — must stay in sync with what the native apps route
// (frontend/apps/ios DeepLinkRouter / android deep-link intent filters).
const DEFAULT_AASA_PATHS = [
  '/post/*', '/posts/*', '/gig/*', '/gigs/*', '/listing/*', '/listings/*',
  '/marketplace/*', '/home', '/homes/*', '/user/*', '/users/*', '/business/*',
  '/businesses/*', '/b/*', '/u/*', '/mailbox/*', '/chat/*', '/messages/*',
  '/conversation/*', '/support-trains/*', '/connections', '/notifications',
  '/wallet', '/invite/*', '/join/*', '/auth/*', '/verify-email',
  '/verify-email/*', '/reset-password', '/reset-password/*',
  '/settings/payments',
];

const ANDROID_RELATIONS = [
  'delegate_permission/common.handle_all_urls',
  'delegate_permission/common.get_login_creds',
];

const FINGERPRINT_RE = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

function fail(msg) {
  console.error(`gen-association-files: ${msg}`);
  process.exit(2);
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    fail(`${file} is not valid JSON: ${err.message}`);
  }
}

function normalizeFingerprint(raw) {
  const cleaned = raw.trim().toUpperCase().replace(/[^0-9A-F]/g, '');
  if (cleaned.length !== 64) {
    fail(`fingerprint "${raw}" is not a 32-byte SHA-256 (got ${cleaned.length / 2} bytes)`);
  }
  const colon = cleaned.match(/.{2}/g).join(':');
  if (!FINGERPRINT_RE.test(colon)) fail(`fingerprint "${raw}" is malformed`);
  return colon;
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

// ---------------------------------------------------------------------------
// AASA
// ---------------------------------------------------------------------------
function buildAasa(existing, { teamId, bundleId, pathsOverride }) {
  const aasa = existing && typeof existing === 'object' ? existing : {};
  aasa.applinks = aasa.applinks && typeof aasa.applinks === 'object' ? aasa.applinks : {};
  if (!Array.isArray(aasa.applinks.apps)) aasa.applinks.apps = [];
  if (!Array.isArray(aasa.applinks.details)) aasa.applinks.details = [];
  aasa.webcredentials =
    aasa.webcredentials && typeof aasa.webcredentials === 'object' ? aasa.webcredentials : {};
  if (!Array.isArray(aasa.webcredentials.apps)) aasa.webcredentials.apps = [];

  if (!teamId) return aasa; // nothing to upsert; legacy content preserved verbatim

  const nativeAppId = `${teamId}.${bundleId}`;
  const legacy = aasa.applinks.details.find((d) => d && d.appID === LEGACY_IOS_APP_ID);
  const paths = pathsOverride?.length
    ? pathsOverride
    : legacy?.paths?.length
      ? [...legacy.paths]
      : [...DEFAULT_AASA_PATHS];

  const idx = aasa.applinks.details.findIndex((d) => d && d.appID === nativeAppId);
  const entry = { appID: nativeAppId, paths };
  if (idx === -1) aasa.applinks.details.push(entry);
  else aasa.applinks.details[idx] = entry;

  if (!aasa.webcredentials.apps.includes(nativeAppId)) {
    aasa.webcredentials.apps.push(nativeAppId);
  }
  return aasa;
}

// ---------------------------------------------------------------------------
// assetlinks.json
// ---------------------------------------------------------------------------
function buildAssetlinks(existing, { androidPackage, fingerprints }) {
  const list = Array.isArray(existing) ? existing : [];

  // Always keep the legacy Expo statement (and any others we do not own).
  if (!androidPackage || fingerprints.length === 0) return list;

  const isNative = (s) =>
    s && s.target && s.target.namespace === 'android_app' && s.target.package_name === androidPackage;

  const entry = {
    relation: [...ANDROID_RELATIONS],
    target: {
      namespace: 'android_app',
      package_name: androidPackage,
      sha256_cert_fingerprints: [...new Set(fingerprints)],
    },
  };

  const idx = list.findIndex(isNative);
  if (idx === -1) list.push(entry);
  else list[idx] = entry;

  // Sanity: the legacy entry must still be there unless the caller removed it on purpose.
  if (!list.some((s) => s?.target?.package_name === LEGACY_ANDROID_PACKAGE)) {
    console.warn(
      `gen-association-files: warning — legacy ${LEGACY_ANDROID_PACKAGE} statement not present ` +
        '(fine after the Expo app is retired; otherwise restore it).',
    );
  }
  return list;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
function main() {
  const check = process.argv.includes('--check');
  const dir = process.env.WELL_KNOWN_DIR || DEFAULT_DIR;
  const aasaFile = path.join(dir, 'apple-app-site-association');
  const assetFile = path.join(dir, 'assetlinks.json');

  const teamId = (process.env.APPLE_TEAM_ID || '').trim();
  if (teamId && !/^[A-Z0-9]{10}$/.test(teamId)) fail(`APPLE_TEAM_ID "${teamId}" is not a 10-char Team ID`);
  const bundleId = (process.env.IOS_BUNDLE_ID || 'app.pantopus.ios').trim();
  const androidPackage = (process.env.ANDROID_PACKAGE || 'app.pantopus.android').trim();
  const fingerprints = (process.env.ANDROID_SHA256_FINGERPRINTS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizeFingerprint);
  const pathsOverride = (process.env.AASA_PATHS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!teamId && fingerprints.length === 0) {
    console.error(
      'gen-association-files: nothing to do — set APPLE_TEAM_ID and/or ANDROID_SHA256_FINGERPRINTS.\n' +
        'See docs/persistent-login/ASSOCIATION-FILES.md',
    );
    process.exit(2);
  }

  const aasaBefore = fs.existsSync(aasaFile) ? fs.readFileSync(aasaFile, 'utf8') : '';
  const assetBefore = fs.existsSync(assetFile) ? fs.readFileSync(assetFile, 'utf8') : '';

  const aasa = buildAasa(readJson(aasaFile, {}), { teamId, bundleId, pathsOverride });
  const assetlinks = buildAssetlinks(readJson(assetFile, []), { androidPackage, fingerprints });

  const aasaAfter = stableJson(aasa);
  const assetAfter = stableJson(assetlinks);

  const changed = aasaAfter !== aasaBefore || assetAfter !== assetBefore;
  if (check) {
    if (changed) {
      console.error('gen-association-files: files are out of date (run without --check to rewrite).');
      process.exit(1);
    }
    console.log('gen-association-files: up to date.');
    return;
  }

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(aasaFile, aasaAfter);
  fs.writeFileSync(assetFile, assetAfter);
  console.log(`gen-association-files: wrote\n  ${aasaFile}\n  ${assetFile}`);
  if (teamId) console.log(`  iOS   ${teamId}.${bundleId} (applinks + webcredentials)`);
  if (fingerprints.length) {
    console.log(`  Android ${androidPackage} (${fingerprints.length} fingerprint(s), ${ANDROID_RELATIONS.join(' + ')})`);
  } else {
    console.log('  Android: ANDROID_SHA256_FINGERPRINTS unset — native assetlinks statement NOT written.');
  }
}

main();
