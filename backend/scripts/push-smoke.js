#!/usr/bin/env node
/**
 * Manual push smoke test — send one real notification to a single device
 * token through the native transport, to verify APNs/FCM credentials and
 * round-trip delivery end-to-end. NOT run in CI (the unit suite mocks the
 * transport); this is a hands-on tool for whoever wires the secrets.
 *
 * Usage:
 *   node scripts/push-smoke.js --token <deviceToken> --platform ios|android \
 *     [--title "Hi"] [--body "Test"] [--link /chat/42]
 *
 *   # provider is inferred from platform (ios→apns, android→fcm) but can
 *   # be forced for an Expo token:
 *   node scripts/push-smoke.js --token ExponentPushToken[..] --provider expo
 *
 * Credentials are read from the same .env slots the backend uses
 * (see docs/push-native-migration.md §6). With none set, the matching
 * provider reports "not configured" and the script explains what's missing.
 */

require('dotenv').config();

const { classifyProvider } = require('../services/push/tokenRouting');
const apnsClient = require('../services/push/apnsClient');
const fcmClient = require('../services/push/fcmClient');
const expoClient = require('../services/push/expoClient');

const senders = { apns: apnsClient, fcm: fcmClient, expo: expoClient };

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key.startsWith('--')) {
      const name = key.slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[(i += 1)] : 'true';
      args[name] = value;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { token, platform, provider, link } = args;

  if (!token) {
    console.error('Missing --token. See the header of this file for usage.');
    process.exit(2);
  }

  const resolved = classifyProvider({ token, platform, provider });
  const sender = senders[resolved];

  console.log(`Provider: ${resolved}  (platform=${platform || '—'}, provider=${provider || 'derived'})`);

  if (!sender.isConfigured()) {
    console.error(
      `\n✗ The ${resolved.toUpperCase()} sender is not configured.\n` +
      '  Set the credentials in .env (see docs/push-native-migration.md §6) and retry.',
    );
    process.exit(1);
  }

  const message = {
    title: args.title || 'Pantopus push smoke test',
    body: args.body || 'If you can read this, native push works. 🎉',
    data: { type: 'system', link: link || '/notifications' },
  };

  console.log('Sending…', message);
  const { invalidTokens } = await sender.sendMany([token], message);

  if (invalidTokens.includes(token)) {
    console.error('\n✗ The provider rejected this token as invalid/unregistered.');
    process.exit(1);
  }
  console.log('\n✓ Accepted by the provider. Check the device.');
  if (sender.close) sender.close();
}

main().catch((err) => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
