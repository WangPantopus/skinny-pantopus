#!/usr/bin/env node
// Local public-config checks only. No network, credentials, device tokens or sends.
const fs = require('node:fs');
const { parseArgs } = require('node:util');

function readEnv(file) {
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    // Use the single-line KEY=value syntax understood by both the iOS Makefile
    // and Android's Properties loader; reject syntax they interpret differently.
    const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!match || /["'\\$#]/.test(match[2]) || Object.hasOwn(env, match[1])) {
      throw new Error('Use unique, unquoted KEY=value lines with comments on separate lines.');
    }
    env[match[1]] = match[2].trim();
  }
  return env;
}

const placeholder = (value) => !value || /replace|placeholder|example|your[-_]/i.test(value);
function httpsOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      !url.search && !url.hash && url.pathname === '/' &&
      !/^(localhost|127\.|10\.|192\.168\.|\[)/i.test(url.hostname) &&
      !/\.(local|invalid|test)$/.test(url.hostname) && !placeholder(value);
  } catch { return false; }
}

function checkConfig({ platform, env, firebase, projectId }) {
  const errors = [];
  if (!['ios', 'android'].includes(platform)) return ['Choose ios or android.'];
  for (const name of ['PANTOPUS_API_BASE_URL', 'PANTOPUS_SOCKET_URL']) {
    if (!httpsOrigin(env[name])) errors.push(`${name} must be the designated public staging HTTPS origin.`);
  }
  if (!env.STRIPE_PUBLISHABLE_KEY?.startsWith('pk_test_') || placeholder(env.STRIPE_PUBLISHABLE_KEY)) {
    errors.push('STRIPE_PUBLISHABLE_KEY must be a real test publishable key.');
  }
  if (platform === 'ios') {
    if (!['development', 'production'].includes(env.APS_ENVIRONMENT)) {
      errors.push('APS_ENVIRONMENT must explicitly match the intended signing profile.');
    }
  } else {
    if (env.PANTOPUS_ENV !== 'staging') errors.push('PANTOPUS_ENV must be staging.');
    if (placeholder(projectId)) errors.push('Supply the designated backend FCM project ID.');
    if (!firebase?.project_info?.project_id || firebase.project_info.project_id !== projectId) {
      errors.push('Android Firebase project must match the backend FCM project ID.');
    }
    const client = firebase?.client?.find(c =>
      c.client_info?.android_client_info?.package_name === 'app.pantopus.android.debug');
    const number = firebase?.project_info?.project_number;
    const appId = client?.client_info?.mobilesdk_app_id;
    if (!/^\d+$/.test(number || '') || /^0+$/.test(number) ||
        placeholder(appId) || !appId?.startsWith(`1:${number}:android:`) ||
        !client?.api_key?.some(key => !placeholder(key.current_key))) {
      errors.push('Use a real google-services.json for app.pantopus.android.debug; the CI placeholder cannot receive push.');
    }
  }
  return errors;
}

function main(argv) {
  try {
    const { values } = parseArgs({ args: argv, options: {
      platform: { type: 'string' }, 'env-file': { type: 'string' },
      'firebase-config': { type: 'string' }, 'fcm-project-id': { type: 'string' },
    } });
    if (!values['env-file']) throw new Error('An explicit native env file is required.');
    const env = readEnv(values['env-file']);
    const firebase = values['firebase-config'] ? JSON.parse(fs.readFileSync(values['firebase-config'], 'utf8')) : undefined;
    const errors = checkConfig({ platform: values.platform, env, firebase, projectId: values['fcm-project-id'] });
    for (const error of errors) console.error(error);
    if (errors.length) return 1;
    console.log('Public staging configuration checks passed. Host isolation, signing, provider credentials and physical delivery still require verification. No network request or notification sent.');
    return 0;
  } catch {
    // Parsing errors can quote file contents. Never echo them (or native keys).
    console.error('Cannot validate configuration. Supply --platform ios|android, --env-file, and for Android --firebase-config and --fcm-project-id. Use readable files and unique, unquoted KEY=value lines.');
    return 2;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { checkConfig, readEnv, main };
