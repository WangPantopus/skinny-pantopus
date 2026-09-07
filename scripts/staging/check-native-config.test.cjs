const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { checkConfig, readEnv } = require('./check-native-config.cjs');

const env = {
  PANTOPUS_API_BASE_URL: 'https://stage-api.pantopus.com',
  PANTOPUS_SOCKET_URL: 'https://stage-api.pantopus.com',
  STRIPE_PUBLISHABLE_KEY: 'pk_test_synthetic_not_a_real_key',
  PANTOPUS_ENV: 'staging',
  APS_ENVIRONMENT: 'production',
};
const firebase = {
  project_info: { project_id: 'pantopus-stage-fixture', project_number: '123456789' },
  client: [{ client_info: { mobilesdk_app_id: '1:123456789:android:abcdef123456',
    android_client_info: { package_name: 'app.pantopus.android.debug' } },
  api_key: [{ current_key: 'synthetic_not_a_real_key' }] }],
};
const android = { platform: 'android', env, firebase, projectId: 'pantopus-stage-fixture' };

test('accepts consistent public config for both signing environments and Android debug', () => {
  assert.deepEqual(checkConfig(android), []);
  for (const APS_ENVIRONMENT of ['development', 'production']) {
    assert.deepEqual(checkConfig({ platform: 'ios', env: { ...env, APS_ENVIRONMENT } }), []);
  }
});

test('rejects the committed Android CI placeholder', () => {
  const placeholder = require('../../frontend/apps/android/app/google-services.json');
  assert.ok(checkConfig({ ...android, firebase: placeholder }).some(e => e.includes('CI placeholder')));
});

test('rejects project and package mismatches before any push', () => {
  assert.ok(checkConfig({ ...android, projectId: 'wrong-project' }).some(e => e.includes('match')));
  const releaseOnly = structuredClone(firebase);
  releaseOnly.client[0].client_info.android_client_info.package_name = 'app.pantopus.android';
  assert.ok(checkConfig({ ...android, firebase: releaseOnly }).some(e => e.includes('app.pantopus.android.debug')));
  assert.ok(checkConfig({ ...android, firebase: undefined }).length);
});

test('checks Firebase sender number consistency and rejects empty keys', () => {
  for (const mutate of [
    f => { f.project_info.project_number = '987654321'; },
    f => { f.client[0].api_key = []; },
    f => { f.client[0].api_key[0].current_key = 'REPLACE_ME'; },
  ]) {
    const invalid = structuredClone(firebase);
    mutate(invalid);
    assert.ok(checkConfig({ ...android, firebase: invalid }).length);
  }
});

test('rejects local/default origins, live payments and wrong environment', () => {
  for (const origin of ['http://10.0.2.2:8000', 'https://localhost', 'https://192.168.1.42',
    'https://REPLACE_ME.invalid', 'https://user:password@stage-api.pantopus.com',
    'https://stage-api.pantopus.com/api', 'https://stage-api.pantopus.com?token=sensitive']) {
    assert.ok(checkConfig({ ...android, env: { ...env, PANTOPUS_API_BASE_URL: origin } }).length);
  }
  for (const key of ['pk_live_synthetic', 'pk_test_REPLACE_ME', '']) {
    assert.ok(checkConfig({ ...android, env: { ...env, STRIPE_PUBLISHABLE_KEY: key } }).length);
  }
  assert.ok(checkConfig({ ...android, env: { ...env, PANTOPUS_ENV: 'production' } }).length);
  assert.ok(checkConfig({ platform: 'ios', env: { ...env, APS_ENVIRONMENT: '' } }).length);
});

test('native env syntax stays consistent across Make and Properties; errors redact contents', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pantopus-staging-config-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, '.env.staging');
  fs.writeFileSync(file, '# Public config\r\nKEY=https://stage-api.pantopus.com\r\nEMPTY=\r\n');
  assert.deepEqual(readEnv(file), { KEY: 'https://stage-api.pantopus.com', EMPTY: '' });
  for (const contents of ['KEY=one\nKEY=two', 'KEY="quoted"', 'KEY=value # inline',
    'export KEY=one', 'KEY=escaped\\nvalue']) {
    fs.writeFileSync(file, contents);
    assert.throws(() => readEnv(file));
  }
  fs.writeFileSync(file, 'PRIVATE=\"sensitive-sentinel\"');
  const result = spawnSync(process.execPath, [path.join(__dirname, 'check-native-config.cjs'),
    '--platform', 'ios', '--env-file', file], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.ok(!`${result.stdout}${result.stderr}`.includes('sensitive-sentinel'));
});
