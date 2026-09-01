/**
 * Push token routing helpers (pure, dependency-free).
 *
 * A single `PushToken` row carries a transport `provider`:
 *   - `apns` — Apple Push Notification service (iOS device tokens)
 *   - `fcm`  — Firebase Cloud Messaging (Android registration tokens)
 *   - `expo` — legacy Expo tokens (`ExponentPushToken[…]`), kept alive
 *              behind a flag during the dual-write migration window.
 *
 * These helpers decide the provider both at registration time (from the
 * platform/provider the client declared) and at send time (from the
 * stored row, falling back to token-format sniffing for legacy rows that
 * predate the `provider` column).
 *
 * See docs/push-native-migration.md.
 */

// Expo tokens look like `ExponentPushToken[xxxx]` or `ExpoPushToken[xxxx]`.
const EXPO_TOKEN_RE = /^Expo(nent)?PushToken\[.+\]$/;

const PROVIDERS = ['apns', 'fcm', 'expo'];
const PLATFORMS = ['ios', 'android'];

/** True when the token is an Expo push token. */
function isExpoToken(token) {
  return typeof token === 'string' && EXPO_TOKEN_RE.test(token.trim());
}

function normalize(value) {
  return value == null ? null : String(value).toLowerCase();
}

/**
 * Resolve the `{ platform, provider }` to persist for a registration.
 * Explicit values win; otherwise we derive the pair from whichever side
 * the client supplied, special-casing Expo tokens by their format.
 *
 *   ios   → apns        android → fcm
 *   apns  → ios         fcm     → android
 *   ExponentPushToken[…] → expo
 */
function resolveRegistration({ token, platform, provider } = {}) {
  let plat = normalize(platform);
  let prov = normalize(provider);

  if (plat && !PLATFORMS.includes(plat)) plat = null;
  if (prov && !PROVIDERS.includes(prov)) prov = null;

  // Expo tokens are unambiguous from their shape — trust the format over
  // any (likely stale) client-declared platform/provider.
  if (isExpoToken(token)) {
    return { platform: plat, provider: 'expo' };
  }

  if (!prov) {
    if (plat === 'ios') prov = 'apns';
    else if (plat === 'android') prov = 'fcm';
  }
  if (!plat) {
    if (prov === 'apns') plat = 'ios';
    else if (prov === 'fcm') plat = 'android';
  }

  return { platform: plat, provider: prov };
}

/**
 * Decide which transport to send a stored token row through. The stored
 * `provider` column wins; legacy rows (written before the column existed)
 * are sniffed from the token format and default to Expo.
 */
function classifyProvider({ token, platform, provider } = {}) {
  const prov = normalize(provider);
  if (prov && PROVIDERS.includes(prov)) return prov;

  if (isExpoToken(token)) return 'expo';

  const plat = normalize(platform);
  if (plat === 'ios') return 'apns';
  if (plat === 'android') return 'fcm';

  // Legacy rows had Expo-only tokens; default there for back-compat.
  return 'expo';
}

module.exports = {
  EXPO_TOKEN_RE,
  PROVIDERS,
  PLATFORMS,
  isExpoToken,
  resolveRegistration,
  classifyProvider,
};
