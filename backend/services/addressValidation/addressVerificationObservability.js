const supabaseAdmin = require('../../config/supabaseAdmin');
const addressConfig = require('../../config/addressVerification');
const logger = require('../../utils/logger');
const metrics = require('./addressVerificationMetrics');

function safeArray(value) {
  return Array.isArray(value) ? value.filter((item) => item !== undefined) : [];
}

function sanitizeJson(value) {
  if (value === undefined) return null;
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => sanitizeJson(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, sanitizeJson(entryValue)]),
    );
  }
  return value;
}

function isMetricsEnabled() {
  return addressConfig.observability?.enableMetrics !== false;
}

function areEventsEnabled() {
  return addressConfig.observability?.enableEvents !== false;
}

function safeMetric(operation, context) {
  if (!isMetricsEnabled()) return;

  try {
    operation();
  } catch (error) {
    logger.warn('addressVerificationObservability.metric_failed', {
      context,
      error: error.message,
    });
  }
}

function normalizeEvent(event) {
  return {
    address_id: event.address_id || null,
    event_type: event.event_type,
    provider: event.provider || null,
    status: event.status || 'unknown',
    reasons: safeArray(event.reasons),
    raw_response: sanitizeJson(event.raw_response) || {},
  };
}

async function insertEvents(events) {
  if (!areEventsEnabled() || !Array.isArray(events) || events.length === 0) return;

  try {
    const { error } = await supabaseAdmin
      .from('AddressVerificationEvent')
      .insert(events.map(normalizeEvent));

    if (error) {
      logger.warn('addressVerificationObservability.event_insert_failed', {
        error: error.message,
        event_count: events.length,
      });
    }
  } catch (error) {
    logger.warn('addressVerificationObservability.event_insert_failed', {
      error: error.message,
      event_count: events.length,
    });
  }
}

function recordProviderMetrics(providerCall) {
  const labels = {
    provider: providerCall.provider,
    status: providerCall.status,
    trigger: providerCall.trigger || 'unknown',
  };

  safeMetric(() => metrics.incCounter('address_verification_provider_calls_total', labels), 'provider_calls_total');
  safeMetric(() => metrics.recordHistogram(
    'address_verification_provider_latency_ms',
    providerCall.latency_ms,
    labels,
  ), 'provider_latency_ms');

  if (!['ok', 'cached', 'not_invoked', 'skipped_no_normalized_address'].includes(providerCall.status)) {
    safeMetric(() => metrics.incCounter('address_verification_provider_errors_total', {
      provider: providerCall.provider,
      trigger: providerCall.trigger || 'unknown',
    }), 'provider_errors_total');
  }

  if (providerCall.from_cache != null) {
    safeMetric(() => metrics.incCounter('address_verification_cache_total', {
      provider: providerCall.provider,
      result: providerCall.from_cache ? 'hit' : 'miss',
      trigger: providerCall.trigger || 'unknown',
    }), 'cache_total');
  }
}

function recordShadowMetrics(shadowComparison) {
  safeMetric(() => metrics.incCounter('address_verification_shadow_comparisons_total', {
    source: shadowComparison.source,
    provider: shadowComparison.provider || 'none',
    status: shadowComparison.provider_status || 'unknown',
    disagrees: shadowComparison.disagrees === null ? 'unknown' : String(!!shadowComparison.disagrees),
    trigger: shadowComparison.trigger || 'unknown',
  }), 'shadow_comparisons_total');
}

function recordVerdictMetrics(verdict, trigger) {
  safeMetric(() => metrics.incCounter('address_verification_verdicts_total', {
    status: verdict?.status || 'unknown',
    trigger: trigger || 'unknown',
  }), 'verdicts_total');

  for (const reason of safeArray(verdict?.reasons)) {
    safeMetric(() => metrics.incCounter('address_verification_verdict_reasons_total', {
      status: verdict?.status || 'unknown',
      reason,
      trigger: trigger || 'unknown',
    }), 'verdict_reasons_total');
  }
}

function recordCreateHomeMetrics(outcome) {
  safeMetric(() => metrics.incCounter('address_verification_create_home_outcomes_total', {
    outcome: outcome.outcome || 'unknown',
    verdict_status: outcome.verdict_status || 'none',
    validation_path: outcome.validation_path || 'unknown',
    code: outcome.code || 'none',
  }), 'create_home_outcomes_total');
}

function buildProviderCallEvent(providerCall, addressId) {
  return {
    address_id: addressId || null,
    event_type: 'provider_call',
    provider: providerCall.provider,
    status: providerCall.status,
    reasons: safeArray(providerCall.reasons),
    raw_response: {
      trigger: providerCall.trigger || 'unknown',
      latency_ms: providerCall.latency_ms ?? null,
      from_cache: providerCall.from_cache === true,
      lookup_mode: providerCall.lookup_mode || null,
      selectively_invoked: providerCall.selectively_invoked ?? null,
      details: sanitizeJson(providerCall.details) || {},
    },
  };
}

function buildShadowComparisonEvent(shadowComparison, addressId) {
  return {
    address_id: addressId || null,
    event_type: 'shadow_comparison',
    provider: shadowComparison.provider || null,
    status: shadowComparison.provider_status || 'unknown',
    reasons: safeArray(shadowComparison.disagreement_reasons),
    raw_response: {
      trigger: shadowComparison.trigger || 'unknown',
      source: shadowComparison.source,
      selectively_invoked: shadowComparison.selectively_invoked ?? null,
      disagrees: shadowComparison.disagrees,
      heuristic: sanitizeJson(shadowComparison.heuristic) || null,
      provider_comparison: sanitizeJson(shadowComparison.provider_comparison) || null,
      overlap_types: safeArray(shadowComparison.overlap_types),
    },
  };
}

function buildVerdictEvent({ verdict, addressId, trigger, route, source, errorCode, message }) {
  return {
    address_id: addressId || null,
    event_type: 'validation_outcome',
    provider: null,
    status: verdict?.status || 'unknown',
    reasons: safeArray(verdict?.reasons),
    raw_response: {
      trigger: trigger || 'unknown',
      route: route || null,
      source: source || 'pipeline',
      confidence: verdict?.confidence ?? null,
      next_actions: safeArray(verdict?.next_actions),
      error_code: errorCode || null,
      message: message || null,
    },
  };
}

function buildCreateHomeEvent(outcome) {
  return {
    address_id: outcome.address_id || null,
    event_type: 'create_home_outcome',
    provider: null,
    status: outcome.outcome || 'unknown',
    reasons: safeArray(outcome.reasons),
    raw_response: {
      verdict_status: outcome.verdict_status || null,
      code: outcome.code || null,
      status_code: outcome.status_code ?? null,
      validation_path: outcome.validation_path || null,
      fallback_reason: outcome.fallback_reason || null,
      step_up_reason: outcome.step_up_reason || null,
      message: outcome.message || null,
    },
  };
}

async function recordPipelineAudit({ addressId, providerCalls = [], shadowComparisons = [], verdict, trigger = 'unknown' }) {
  const events = [];

  for (const providerCall of providerCalls) {
    recordProviderMetrics(providerCall);
    logger.info('addressValidation.providerCall', {
      address_id: addressId || null,
      provider: providerCall.provider,
      status: providerCall.status,
      trigger,
      latency_ms: providerCall.latency_ms ?? null,
      from_cache: providerCall.from_cache === true,
      lookup_mode: providerCall.lookup_mode || null,
      selectively_invoked: providerCall.selectively_invoked ?? null,
      reasons: safeArray(providerCall.reasons),
      details: sanitizeJson(providerCall.details) || {},
    });
    events.push(buildProviderCallEvent(providerCall, addressId));
  }

  for (const shadowComparison of shadowComparisons) {
    recordShadowMetrics(shadowComparison);
    const message = shadowComparison.source === 'parcel'
      ? 'addressValidation.parcelProviderShadowComparison'
      : 'addressValidation.placeProviderShadowComparison';
    const payload = {
      address_id: addressId || null,
      provider_status: shadowComparison.provider_status || 'unknown',
      selectively_invoked: shadowComparison.selectively_invoked ?? null,
      disagrees: shadowComparison.disagrees,
      disagreement_reasons: safeArray(shadowComparison.disagreement_reasons),
      overlap_types: safeArray(shadowComparison.overlap_types),
    };

    if (shadowComparison.source === 'place') {
      payload.heuristic_place_classification = sanitizeJson(shadowComparison.heuristic) || null;
      payload.provider_place_classification = sanitizeJson(shadowComparison.provider_comparison) || null;
    } else {
      payload.heuristic_classification = sanitizeJson(shadowComparison.heuristic) || null;
      payload.parcel_intelligence = sanitizeJson(shadowComparison.provider_comparison) || null;
    }

    logger.info(message, payload);
    events.push(buildShadowComparisonEvent(shadowComparison, addressId));
  }

  if (verdict) {
    recordVerdictMetrics(verdict, trigger);
    logger.info('addressValidation.pipelineVerdict', {
      address_id: addressId || null,
      trigger,
      status: verdict.status,
      reasons: safeArray(verdict.reasons),
      confidence: verdict.confidence ?? null,
      next_actions: safeArray(verdict.next_actions),
    });
    events.push(buildVerdictEvent({
      verdict,
      addressId,
      trigger,
      source: 'pipeline',
    }));
  }

  await insertEvents(events);
}

async function recordValidationOutcome({ addressId, verdict, trigger = 'unknown', route = null, source = 'route', errorCode = null, message = null }) {
  if (!verdict) return;

  recordVerdictMetrics(verdict, trigger);
  logger.info('addressValidation.validationOutcome', {
    address_id: addressId || null,
    trigger,
    route,
    source,
    status: verdict.status,
    reasons: safeArray(verdict.reasons),
    confidence: verdict.confidence ?? null,
    error_code: errorCode,
  });

  await insertEvents([
    buildVerdictEvent({
      verdict,
      addressId,
      trigger,
      route,
      source,
      errorCode,
      message,
    }),
  ]);
}

async function recordCreateHomeOutcome(outcome) {
  recordCreateHomeMetrics(outcome);
  logger.info('addressValidation.createHomeOutcome', {
    address_id: outcome.address_id || null,
    outcome: outcome.outcome || 'unknown',
    verdict_status: outcome.verdict_status || null,
    code: outcome.code || null,
    status_code: outcome.status_code ?? null,
    validation_path: outcome.validation_path || null,
    fallback_reason: outcome.fallback_reason || null,
    step_up_reason: outcome.step_up_reason || null,
  });

  await insertEvents([buildCreateHomeEvent(outcome)]);
}

module.exports = {
  recordPipelineAudit,
  recordValidationOutcome,
  recordCreateHomeOutcome,
};
