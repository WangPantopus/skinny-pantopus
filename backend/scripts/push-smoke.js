#!/usr/bin/env node
/**
 * Check push configuration without sending, or send one real test push to
 * a designated device. Never run a live send in CI.
 *
 *   node scripts/push-smoke.js --check --platform ios
 *   node scripts/push-smoke.js --platform ios --link /post/TEST_POST_ID
 *
 * Load PUSH_SMOKE_TOKEN before a live send. --token is also supported.
 * Prefer the environment variable to keep tokens
 * out of process arguments. DOTENV_CONFIG_PATH selects an explicit env file;
 * otherwise the backend's usual .env is loaded. See the staging runbook.
 */

const { parseArgs } = require('node:util');
const { classifyProvider, isExpoToken, PROVIDERS, PLATFORMS } = require('../services/push/tokenRouting');
const apnsClient = require('../services/push/apnsClient');
const fcmClient = require('../services/push/fcmClient');
const expoClient = require('../services/push/expoClient');

const defaultSenders = { apns: apnsClient, fcm: fcmClient, expo: expoClient };
const USAGE = 'Usage: push-smoke.js --platform ios|android (or --provider apns|fcm|expo) ' +
  '[--check | --token <deviceToken>] [--title <title>] [--body <body>] [--link <path>]';

async function runSmoke(argv, { senders = defaultSenders, env = process.env, output = console } = {}) {
  let args;
  try {
    ({ values: args } = parseArgs({
      args: argv,
      options: {
        token: { type: 'string' }, platform: { type: 'string' }, provider: { type: 'string' },
        title: { type: 'string' }, body: { type: 'string' }, link: { type: 'string' },
        check: { type: 'boolean' }, help: { type: 'boolean' },
      },
    }));
  } catch {
    output.error(USAGE);
    return 2;
  }
  if (args.help) {
    output.log(USAGE);
    return 0;
  }
  const token = (args.token || env.PUSH_SMOKE_TOKEN || '').trim();
  const { platform, provider, link } = args;
  if ((platform && !PLATFORMS.includes(platform)) || (provider && !PROVIDERS.includes(provider)) ||
      (!platform && !provider && !isExpoToken(token))) {
    output.error(USAGE);
    return 2;
  }
  if (!args.check && !token) {
    output.error('Missing device token. Set PUSH_SMOKE_TOKEN or pass --token.');
    return 2;
  }

  const resolved = classifyProvider({ token, platform, provider });
  const sender = senders[resolved];
  output.log(`Provider: ${resolved}`);
  try {
    if (!sender.isConfigured()) {
      output.error(`${resolved.toUpperCase()} is not configured. See docs/push-native-migration.md §6.`);
      return 1;
    }
    if (args.check) {
      output.log('Configuration present. No network request or notification sent; credentials are not yet verified.');
      return 0;
    }

    const message = {
      title: args.title || 'Pantopus push smoke test',
      body: args.body || 'Test notification for the designated device.',
      data: { type: 'system', link: link || '/notifications' },
    };
    output.log('Sending one test notification…');
    const result = await sender.sendMany([token], message);
    if (result?.invalidTokens?.includes(token)) {
      output.error('The provider rejected this token as invalid/unregistered.');
      return 1;
    }
    if (!result?.acceptedTokens?.includes(token)) {
      output.error('Provider acceptance was not confirmed. Check transport logs for authentication, timeout, or service errors.');
      return 1;
    }
    output.log('Accepted by the provider. Device delivery is still unverified; check display and tap destination on the device.');
    return 0;
  } catch {
    output.error('Push test failed before acceptance could be confirmed. Check transport logs.');
    return 1;
  } finally {
    if (sender.close) sender.close();
  }
}

if (require.main === module) {
  require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || '.env', quiet: true });
  runSmoke(process.argv.slice(2)).then((code) => { process.exitCode = code; }).catch(() => {
    console.error('Push test failed.');
    process.exitCode = 1;
  });
}

module.exports = { runSmoke };
