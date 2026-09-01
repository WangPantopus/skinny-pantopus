/**
 * Address Verification Configuration
 *
 * Centralises every environment variable used by the address-verification
 * pipeline and mail-verification flow.  Providers and services import
 * this module instead of reading process.env directly.
 *
 * Behaviour:
 *   - In production (NODE_ENV === 'production') the three vendor API keys
 *     (Google, Smarty, Lob) are REQUIRED.  If any are missing the process
 *     exits with a clear error message.
 *   - In development/test mode missing keys are tolerated.  Providers
 *     should call `config.isProviderAvailable('google')` etc. and fall
 *     back to mock behaviour when false.
 *   - Tuning constants (expiry days, rate limits, cache TTL) have sensible
 *     defaults that can be overridden via env vars.
 *
 * Usage:
 *   const addressConfig = require('../config/addressVerification');
 *   if (addressConfig.isProviderAvailable('google')) { ... }
 */

const logger = require('../utils/logger');

// ── Helpers ────────────────────────────────────────────────────

function envStr(key, fallback = '') {
  return (process.env[key] || '').trim() || fallback;
}

function envInt(key, fallback) {
  const raw = (process.env[key] || '').trim();
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envFloat(key, fallback) {
  const raw = (process.env[key] || '').trim();
  if (!raw) return fallback;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envBool(key, fallback = false) {
  const raw = (process.env[key] || '').trim().toLowerCase();
  if (!raw) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
  if (['0', 'false', 'no', 'off'].includes(raw)) return false;
  return fallback;
}

// ── Build config object ────────────────────────────────────────

function buildConfig() {
  return {
    // ── Google Address Validation ─────────────────────────────
    google: {
      apiKey: envStr('GOOGLE_ADDRESS_VALIDATION_API_KEY'),
    },

    googlePlaces: {
      apiKey: envStr('GOOGLE_PLACES_API_KEY', envStr('GOOGLE_ADDRESS_VALIDATION_API_KEY')),
      timeoutMs: envInt('ADDRESS_PLACE_PROVIDER_TIMEOUT_MS', 1500),
    },

    // ── Smarty (DPV / RDI) ───────────────────────────────────
    smarty: {
      authId: envStr('SMARTY_AUTH_ID'),
      authToken: envStr('SMARTY_AUTH_TOKEN'),
    },

    secondaryAddress: {
      timeoutMs: envInt('ADDRESS_SECONDARY_PROVIDER_TIMEOUT_MS', 1500),
    },

    parcelIntel: {
      provider: envStr('ADDRESS_PARCEL_PROVIDER', 'none').toLowerCase(),
      timeoutMs: envInt('ADDRESS_PARCEL_PROVIDER_TIMEOUT_MS', 1500),
      cacheDays: envInt('ADDRESS_PARCEL_CACHE_DAYS', 30),
    },

    // ── Lob (physical mail) ──────────────────────────────────
    lob: {
      apiKey: envStr('LOB_API_KEY'),
      env: envStr('LOB_ENV', 'test'),
      webhookSecret: envStr('LOB_WEBHOOK_SECRET'),
      from: {
        name: envStr('LOB_FROM_NAME', 'Pantopus'),
        addressLine1: envStr('LOB_FROM_ADDRESS_LINE1', '123 Verification Ln'),
        city: envStr('LOB_FROM_CITY', 'San Francisco'),
        state: envStr('LOB_FROM_STATE', 'CA'),
        zip: envStr('LOB_FROM_ZIP', '94107'),
      },
    },

    // ── Mail verification tuning ─────────────────────────────
    mailVerification: {
      codeExpiryDays: envInt('MAIL_VERIFY_CODE_EXPIRY_DAYS', 30),
      maxAttempts: envInt('MAIL_VERIFY_MAX_ATTEMPTS', 5),
      cooldownHours: envInt('MAIL_VERIFY_COOLDOWN_HOURS', 48),
      maxResends: envInt('MAIL_VERIFY_MAX_RESENDS', 3),
      userRateLimit: envInt('MAIL_VERIFY_USER_RATE_LIMIT', 2),
      userRateWindowHours: envInt('MAIL_VERIFY_USER_RATE_WINDOW_HOURS', 24),
      addressRateLimit: envInt('MAIL_VERIFY_ADDRESS_RATE_LIMIT', 5),
      addressRateWindowDays: envInt('MAIL_VERIFY_ADDRESS_RATE_WINDOW_DAYS', 7),
      stepUpMaxAgeDays: envInt('ADDRESS_STEP_UP_MAX_AGE_DAYS', 90),
    },

    // ── Cache ────────────────────────────────────────────────
    cache: {
      smartyCacheDays: envInt('ADDRESS_VERIFY_CACHE_DAYS', 90),
    },

    outageFallback: {
      enabled: envBool('ENABLE_SAFE_ADDRESS_OUTAGE_FALLBACK', true),
      maxValidationAgeDays: envInt('ADDRESS_OUTAGE_FALLBACK_MAX_AGE_DAYS', 30),
      minConfidence: envFloat('ADDRESS_OUTAGE_FALLBACK_MIN_CONFIDENCE', 0.8),
    },

    observability: {
      enableEvents: envBool('ENABLE_ADDRESS_VERIFICATION_EVENTS', true),
      enableMetrics: envBool('ENABLE_ADDRESS_VERIFICATION_METRICS', true),
    },

    rollout: {
      enablePlaceProvider: envBool('ENABLE_ADDRESS_PLACE_PROVIDER', false),
      enforcePlaceProviderBusiness: envBool('ENABLE_ADDRESS_PLACE_PROVIDER_BUSINESS_ENFORCEMENT', false),
      enableSecondaryProvider: envBool('ENABLE_ADDRESS_SECONDARY_PROVIDER', false),
      enableParcelProvider: envBool('ENABLE_ADDRESS_PARCEL_PROVIDER', false),
      enforceParcelProviderClassification: envBool('ENABLE_ADDRESS_PARCEL_PROVIDER_CLASSIFICATION_ENFORCEMENT', false),
      requireAddressIdForHomeCreate: envBool('REQUIRE_ADDRESS_ID_FOR_HOME_CREATE', false),
      enforceMixedUseStepUp: envBool('ENFORCE_MIXED_USE_STEP_UP', false),
      enforceLowConfidenceStepUp: envBool('ENFORCE_LOW_CONFIDENCE_STEP_UP', false),
    },
  };
}

// ── Singleton ──────────────────────────────────────────────────

const config = buildConfig();

// ── Provider availability checks ───────────────────────────────

const PROVIDER_CHECKS = {
  google: () => !!config.google.apiKey,
  smarty: () => !!(config.smarty.authId && config.smarty.authToken),
  lob: () => !!config.lob.apiKey,
};

/**
 * Check whether a specific provider is configured.
 * @param {'google' | 'smarty' | 'lob'} name
 * @returns {boolean}
 */
function isProviderAvailable(name) {
  const check = PROVIDER_CHECKS[name];
  return check ? check() : false;
}

// ── Startup validation ─────────────────────────────────────────

const PRODUCTION_REQUIRED = [
  { key: 'GOOGLE_ADDRESS_VALIDATION_API_KEY', label: 'Google Address Validation API key', provider: 'google' },
  { key: 'SMARTY_AUTH_ID', label: 'Smarty auth-id', provider: 'smarty' },
  { key: 'SMARTY_AUTH_TOKEN', label: 'Smarty auth-token', provider: 'smarty' },
  { key: 'LOB_API_KEY', label: 'Lob API key', provider: 'lob' },
];

/**
 * Validate configuration and log status.
 * Call once at startup (e.g. from app.js).
 *
 * In production, exits the process if required keys are missing.
 * In development, logs warnings and notes which mock providers will be used.
 */
function validate() {
  const isProd = process.env.NODE_ENV === 'production';
  const missing = [];

  for (const req of PRODUCTION_REQUIRED) {
    if (!process.env[req.key]?.trim()) {
      missing.push(req);
    }
  }

  if (isProd && missing.length > 0) {
    const list = missing.map((m) => `  - ${m.key} (${m.label})`).join('\n');
    logger.error(
      `Address verification configuration error: missing required environment variables in production:\n${list}\n` +
      'Set these variables or switch to NODE_ENV=development for mock providers.',
    );
    process.exit(1);
  }

  // Log status for each provider
  const status = {
    google: isProviderAvailable('google') ? 'live' : 'mock/disabled',
    googlePlaces: config.rollout.enablePlaceProvider
      ? (config.googlePlaces.apiKey ? 'shadow-configured' : 'shadow-misconfigured')
      : 'disabled',
    smarty: isProviderAvailable('smarty') ? 'live' : 'mock/disabled',
    secondaryAddress: config.rollout.enableSecondaryProvider
      ? (isProviderAvailable('smarty') ? 'shadow-configured' : 'shadow-misconfigured')
      : 'disabled',
    parcelIntel: config.rollout.enableParcelProvider
      ? (
          config.parcelIntel.provider === 'attom' && !!process.env.ATTOM_API_KEY
            ? 'shadow-configured'
            : 'shadow-misconfigured'
        )
      : 'disabled',
    lob: isProviderAvailable('lob') ? (config.lob.env === 'live' ? 'live' : 'test') : 'mock',
  };

  logger.info('Address verification configuration loaded', {
    providers: status,
    mailVerification: {
      codeExpiryDays: config.mailVerification.codeExpiryDays,
      maxAttempts: config.mailVerification.maxAttempts,
      cooldownHours: config.mailVerification.cooldownHours,
      maxResends: config.mailVerification.maxResends,
      stepUpMaxAgeDays: config.mailVerification.stepUpMaxAgeDays,
    },
    cacheDays: {
      smarty: config.cache.smartyCacheDays,
      parcel: config.parcelIntel.cacheDays,
    },
    outageFallback: config.outageFallback,
    observability: config.observability,
    rollout: config.rollout,
  });

  if (!isProd && missing.length > 0) {
    const providers = [...new Set(missing.map((m) => m.provider))];
    logger.info(
      `Dev mode: ${providers.join(', ')} provider(s) will use mock/fallback behaviour ` +
      `(${missing.map((m) => m.key).join(', ')} not set)`,
    );
  }
}

module.exports = {
  ...config,
  isProviderAvailable,
  validate,
};
