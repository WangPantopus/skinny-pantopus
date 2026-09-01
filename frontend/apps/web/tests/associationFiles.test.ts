/**
 * Persistent login — OS association files (design §11 / Phase 0).
 *
 *   1. The hosted AASA lists BOTH the legacy Expo appID and the native
 *      `6UYZBA546R.app.pantopus.ios` in applinks + webcredentials, with the
 *      same paths; assetlinks.json keeps the legacy statement and, if a native
 *      statement exists, it carries handle_all_urls + get_login_creds.
 *   2. tools/gen-association-files.mjs regenerates both files from env vars,
 *      preserves legacy entries, is idempotent, validates fingerprints and
 *      supports --check.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

const WELL_KNOWN = path.resolve(__dirname, '../public/.well-known');
const GENERATOR = path.resolve(__dirname, '../../../../tools/gen-association-files.mjs');
const AASA = path.join(WELL_KNOWN, 'apple-app-site-association');
const ASSETLINKS = path.join(WELL_KNOWN, 'assetlinks.json');

const LEGACY_IOS = '6UYZBA546R.com.pantopus.app';
const NATIVE_IOS = '6UYZBA546R.app.pantopus.ios';
const LEGACY_ANDROID = 'com.pantopus.app';
const NATIVE_ANDROID = 'app.pantopus.android';

function readJson(file: string) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function runGenerator(env: Record<string, string>, args: string[] = []) {
  try {
    const stdout = execFileSync(process.execPath, [GENERATOR, ...args], {
      env: { ...process.env, ...env },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, stdout, stderr: '' };
  } catch (err: unknown) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? 1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

describe('hosted association files', () => {
  test('AASA carries legacy + native iOS appIDs with identical applinks paths and webcredentials', () => {
    const aasa = readJson(AASA);
    const ids = aasa.applinks.details.map((d: { appID: string }) => d.appID);
    expect(ids).toEqual(expect.arrayContaining([LEGACY_IOS, NATIVE_IOS]));

    const legacy = aasa.applinks.details.find((d: { appID: string }) => d.appID === LEGACY_IOS);
    const native = aasa.applinks.details.find((d: { appID: string }) => d.appID === NATIVE_IOS);
    expect(native.paths).toEqual(legacy.paths);
    expect(native.paths).toEqual(expect.arrayContaining(['/invite/*', '/join/*', '/auth/*', '/reset-password/*']));

    expect(aasa.webcredentials.apps).toEqual(expect.arrayContaining([LEGACY_IOS, NATIVE_IOS]));
    // No comments / trailing junk: it must be strict JSON (Apple's CDN rejects otherwise).
    expect(() => JSON.parse(fs.readFileSync(AASA, 'utf8'))).not.toThrow();
  });

  test('assetlinks.json keeps the legacy statement; a native one (if present) has both relations', () => {
    const list = readJson(ASSETLINKS);
    expect(Array.isArray(list)).toBe(true);
    const legacy = list.find((s: any) => s.target?.package_name === LEGACY_ANDROID);
    expect(legacy).toBeTruthy();
    expect(legacy.relation).toContain('delegate_permission/common.handle_all_urls');

    const native = list.find((s: any) => s.target?.package_name === NATIVE_ANDROID);
    if (native) {
      expect(native.relation).toEqual(
        expect.arrayContaining(['delegate_permission/common.handle_all_urls', 'delegate_permission/common.get_login_creds']),
      );
      for (const fp of native.target.sha256_cert_fingerprints) {
        expect(fp).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
      }
    }
  });
});

describe('tools/gen-association-files.mjs', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pantopus-wk-'));
    fs.copyFileSync(AASA, path.join(dir, 'apple-app-site-association'));
    fs.copyFileSync(ASSETLINKS, path.join(dir, 'assetlinks.json'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('upserts the native Android statement, keeps legacy entries, is idempotent, --check agrees', () => {
    const fp1 = 'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899';
    const fp2 = '11:22:33:44:55:66:77:88:99:00:aa:bb:cc:dd:ee:ff:11:22:33:44:55:66:77:88:99:00:aa:bb:cc:dd:ee:ff';
    const env = { WELL_KNOWN_DIR: dir, APPLE_TEAM_ID: '6UYZBA546R', ANDROID_SHA256_FINGERPRINTS: `${fp1}, ${fp2}` };

    expect(runGenerator(env, ['--check']).code).toBe(1); // out of date before the run
    expect(runGenerator(env).code).toBe(0);

    const list = readJson(path.join(dir, 'assetlinks.json'));
    expect(list.find((s: any) => s.target.package_name === LEGACY_ANDROID)).toBeTruthy();
    const native = list.find((s: any) => s.target.package_name === NATIVE_ANDROID);
    expect(native.relation).toEqual([
      'delegate_permission/common.handle_all_urls',
      'delegate_permission/common.get_login_creds',
    ]);
    expect(native.target.sha256_cert_fingerprints).toEqual([
      'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99',
      '11:22:33:44:55:66:77:88:99:00:AA:BB:CC:DD:EE:FF:11:22:33:44:55:66:77:88:99:00:AA:BB:CC:DD:EE:FF',
    ]);

    const aasa = readJson(path.join(dir, 'apple-app-site-association'));
    expect(aasa.applinks.details.map((d: any) => d.appID)).toEqual([LEGACY_IOS, NATIVE_IOS]);
    expect(aasa.webcredentials.apps).toEqual([LEGACY_IOS, NATIVE_IOS]);

    // idempotent + --check green
    const before = fs.readFileSync(path.join(dir, 'assetlinks.json'), 'utf8');
    expect(runGenerator(env).code).toBe(0);
    expect(fs.readFileSync(path.join(dir, 'assetlinks.json'), 'utf8')).toBe(before);
    expect(runGenerator(env, ['--check']).code).toBe(0);
  });

  test('a different Team ID adds a second native entry without touching the others', () => {
    const env = { WELL_KNOWN_DIR: dir, APPLE_TEAM_ID: 'ZZZZZZZZZZ' };
    expect(runGenerator(env).code).toBe(0);
    const aasa = readJson(path.join(dir, 'apple-app-site-association'));
    expect(aasa.applinks.details.map((d: any) => d.appID)).toEqual([LEGACY_IOS, NATIVE_IOS, 'ZZZZZZZZZZ.app.pantopus.ios']);
  });

  test('rejects malformed fingerprints / team ids and refuses to run with nothing to do', () => {
    expect(runGenerator({ WELL_KNOWN_DIR: dir, ANDROID_SHA256_FINGERPRINTS: 'zz' }).code).toBe(2);
    expect(runGenerator({ WELL_KNOWN_DIR: dir, APPLE_TEAM_ID: 'short' }).code).toBe(2);
    expect(runGenerator({ WELL_KNOWN_DIR: dir }).code).toBe(2);
    // files untouched on failure
    expect(fs.readFileSync(path.join(dir, 'assetlinks.json'), 'utf8')).toBe(fs.readFileSync(ASSETLINKS, 'utf8'));
  });
});
