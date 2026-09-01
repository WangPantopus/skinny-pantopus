const supabaseAdmin = require('../../config/supabaseAdmin');
const {
  resetTables,
  getTable,
} = require('../__mocks__/supabaseAdmin');

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const logger = require('../../utils/logger');
const addressConfig = require('../../config/addressVerification');
const metrics = require('../../services/addressValidation/addressVerificationMetrics');
const observability = require('../../services/addressValidation/addressVerificationObservability');

describe('addressVerificationObservability', () => {
  beforeEach(() => {
    resetTables();
    metrics.resetForTests();
    jest.clearAllMocks();
    addressConfig.observability.enableEvents = true;
    addressConfig.observability.enableMetrics = true;
  });

  test('records provider calls, shadow comparisons, and verdict events durably', async () => {
    await observability.recordPipelineAudit({
      addressId: 'address-1',
      trigger: 'validate',
      providerCalls: [
        {
          provider: 'google_address_validation',
          status: 'ok',
          trigger: 'validate',
          latency_ms: 120,
          details: { granularity: 'PREMISE' },
        },
        {
          provider: 'smarty_postal',
          status: 'ok',
          trigger: 'validate',
          latency_ms: 45,
          from_cache: true,
          details: { dpv_match_code: 'Y' },
        },
      ],
      shadowComparisons: [
        {
          source: 'place',
          provider: 'google_places',
          provider_status: 'ok',
          selectively_invoked: true,
          disagrees: true,
          disagreement_reasons: ['usage_class_mismatch'],
          heuristic: { parcel_type: 'residential' },
          provider_comparison: { primary_type: 'school' },
          overlap_types: ['premise'],
          trigger: 'validate',
        },
      ],
      verdict: {
        status: 'BUSINESS',
        reasons: ['PLACE_INSTITUTIONAL'],
        confidence: 0.91,
        next_actions: ['manual_review'],
      },
    });

    const events = getTable('AddressVerificationEvent');
    expect(events).toHaveLength(4);
    expect(events.map((event) => event.event_type)).toEqual([
      'provider_call',
      'provider_call',
      'shadow_comparison',
      'validation_outcome',
    ]);

    const snapshot = metrics.getSnapshot();
    expect(snapshot.counters.address_verification_provider_calls_total).toEqual(expect.objectContaining({
      'provider=google_address_validation,status=ok,trigger=validate': 1,
      'provider=smarty_postal,status=ok,trigger=validate': 1,
    }));
    expect(snapshot.counters.address_verification_cache_total).toEqual(expect.objectContaining({
      'provider=smarty_postal,result=hit,trigger=validate': 1,
    }));
    expect(snapshot.counters.address_verification_shadow_comparisons_total).toEqual(expect.objectContaining({
      'disagrees=true,provider=google_places,source=place,status=ok,trigger=validate': 1,
    }));
    expect(snapshot.counters.address_verification_verdicts_total).toEqual(expect.objectContaining({
      'status=BUSINESS,trigger=validate': 1,
    }));
  });

  test('records create-home fallout metrics and events', async () => {
    await observability.recordCreateHomeOutcome({
      address_id: 'address-2',
      outcome: 'blocked',
      verdict_status: 'MIXED_USE',
      reasons: ['RDI_COMMERCIAL'],
      code: 'ADDRESS_STEP_UP_REQUIRED',
      status_code: 422,
      validation_path: 'live_provider',
      step_up_reason: 'mixed_use',
      message: 'This address needs mail verification before creating a home.',
    });

    const events = getTable('AddressVerificationEvent');
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(expect.objectContaining({
      address_id: 'address-2',
      event_type: 'create_home_outcome',
      status: 'blocked',
      reasons: ['RDI_COMMERCIAL'],
    }));

    const snapshot = metrics.getSnapshot();
    expect(snapshot.counters.address_verification_create_home_outcomes_total).toEqual(expect.objectContaining({
      'code=ADDRESS_STEP_UP_REQUIRED,outcome=blocked,validation_path=live_provider,verdict_status=MIXED_USE': 1,
    }));
  });

  test('fails open when durable event writes fail', async () => {
    const originalFrom = supabaseAdmin.from;
    const fromSpy = jest.spyOn(supabaseAdmin, 'from').mockImplementation((tableName) => {
      if (tableName === 'AddressVerificationEvent') {
        return {
          insert: async () => ({ data: null, error: { message: 'write failed' } }),
        };
      }
      return originalFrom(tableName);
    });

    await expect(observability.recordValidationOutcome({
      addressId: null,
      verdict: {
        status: 'SERVICE_ERROR',
        reasons: ['Address verification providers unavailable'],
        confidence: 0,
        next_actions: ['manual_review'],
      },
      trigger: 'validate',
      route: 'validate',
      source: 'provider_unavailable',
      errorCode: 'ADDRESS_VALIDATION_UNAVAILABLE',
      message: 'Address verification is temporarily unavailable.',
    })).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledWith(
      'addressVerificationObservability.event_insert_failed',
      expect.objectContaining({
        error: 'write failed',
      }),
    );

    fromSpy.mockRestore();
  });
});
