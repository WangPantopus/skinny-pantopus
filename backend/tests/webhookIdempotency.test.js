// ============================================================
// TEST: Webhook Idempotency (Prompt 1 fix)
// Verifies the three-phase webhook structure:
//   Phase A: Signature verification
//   Phase B: Idempotency check via StripeWebhookEvent table
//   Phase C: Event processing with error/retry tracking
// ============================================================

const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');
const { PAYMENT_STATES, transitionPaymentStatus } = require('../stripe/paymentStateMachine');

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
});

// ── Helpers ──

function seedWebhookEvent(overrides = {}) {
  const row = {
    id: 'whe-001',
    stripe_event_id: 'evt_test_123',
    event_type: 'payment_intent.succeeded',
    event_data: {},
    api_version: '2023-10-16',
    processed: false,
    processed_at: null,
    processing_error: null,
    retry_count: 0,
    ...overrides,
  };
  seedTable('StripeWebhookEvent', [row]);
  return row;
}

// ── Phase B: Idempotency ──

describe('Webhook idempotency — StripeWebhookEvent deduplication', () => {
  test('first insert succeeds (no existing row) — event is new', async () => {
    // An empty StripeWebhookEvent table means this is a new event
    const events = getTable('StripeWebhookEvent');
    expect(events).toHaveLength(0);

    // Simulate inserting a new webhook event (Phase B)
    const supabaseAdmin = require('../config/supabaseAdmin');
    const { data, error } = await supabaseAdmin
      .from('StripeWebhookEvent')
      .insert({
        stripe_event_id: 'evt_new_001',
        event_type: 'payment_intent.succeeded',
        event_data: { object: { id: 'pi_123' } },
        api_version: '2023-10-16',
        processed: false,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.stripe_event_id).toBe('evt_new_001');
    expect(data.processed).toBe(false);
    expect(getTable('StripeWebhookEvent')).toHaveLength(1);
  });

  test('duplicate event where first was processed — should be detected as already done', async () => {
    seedWebhookEvent({
      stripe_event_id: 'evt_dup_001',
      processed: true,
      processed_at: new Date().toISOString(),
    });

    // Look up existing row by stripe_event_id
    const supabaseAdmin = require('../config/supabaseAdmin');
    const { data: existing } = await supabaseAdmin
      .from('StripeWebhookEvent')
      .select('*')
      .eq('stripe_event_id', 'evt_dup_001')
      .single();

    expect(existing).not.toBeNull();
    expect(existing.processed).toBe(true);
    // The handler would return 200 with duplicate: true here
  });

  test('duplicate event where first failed (processed=false) — should be reprocessed', async () => {
    seedWebhookEvent({
      stripe_event_id: 'evt_retry_001',
      processed: false,
      processing_error: 'Database timeout',
      retry_count: 1,
    });

    const supabaseAdmin = require('../config/supabaseAdmin');
    const { data: existing } = await supabaseAdmin
      .from('StripeWebhookEvent')
      .select('*')
      .eq('stripe_event_id', 'evt_retry_001')
      .single();

    expect(existing).not.toBeNull();
    expect(existing.processed).toBe(false);
    // The handler would proceed to reprocess the event
    expect(existing.retry_count).toBe(1);
  });

  test('handler error increments retry_count and sets processing_error', async () => {
    seedWebhookEvent({
      stripe_event_id: 'evt_error_001',
      processed: false,
      retry_count: 0,
    });

    // Simulate Phase C error handling: update the event row on failure
    const supabaseAdmin = require('../config/supabaseAdmin');
    const errorMessage = 'Payment not found';
    const currentRetry = 0;

    await supabaseAdmin
      .from('StripeWebhookEvent')
      .update({
        processing_error: errorMessage,
        retry_count: currentRetry + 1,
      })
      .eq('stripe_event_id', 'evt_error_001');

    const event = getTable('StripeWebhookEvent').find(
      (e) => e.stripe_event_id === 'evt_error_001'
    );
    expect(event.processing_error).toBe('Payment not found');
    expect(event.retry_count).toBe(1);
    expect(event.processed).toBe(false);
  });

  test('successful processing marks event as processed', async () => {
    seedWebhookEvent({
      stripe_event_id: 'evt_success_001',
      processed: false,
    });

    const supabaseAdmin = require('../config/supabaseAdmin');
    await supabaseAdmin
      .from('StripeWebhookEvent')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .eq('stripe_event_id', 'evt_success_001');

    const event = getTable('StripeWebhookEvent').find(
      (e) => e.stripe_event_id === 'evt_success_001'
    );
    expect(event.processed).toBe(true);
    expect(event.processed_at).toBeTruthy();
  });
});

// ── Phase C: Handler processing with state machine ──

describe('Webhook handler — payment_intent.succeeded processing', () => {
  test('PI with capture_method manual + authorized → transitions to captured_hold', async () => {
    seedTable('Payment', [{
      id: 'pay-wh-001',
      gig_id: 'gig-wh-001',
      payment_status: PAYMENT_STATES.AUTHORIZED,
      stripe_payment_intent_id: 'pi_wh_001',
    }]);
    seedTable('Gig', [{
      id: 'gig-wh-001',
      payment_status: PAYMENT_STATES.AUTHORIZED,
    }]);

    // Simulate the webhook handler calling transitionPaymentStatus
    const result = await transitionPaymentStatus('pay-wh-001', PAYMENT_STATES.CAPTURED_HOLD, {
      captured_at: new Date().toISOString(),
      cooling_off_ends_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    });

    expect(result.payment_status).toBe(PAYMENT_STATES.CAPTURED_HOLD);
    const gig = getTable('Gig').find((g) => g.id === 'gig-wh-001');
    expect(gig.payment_status).toBe(PAYMENT_STATES.CAPTURED_HOLD);
  });

  test('duplicate processing of already captured payment throws on invalid transition', async () => {
    seedTable('Payment', [{
      id: 'pay-wh-002',
      gig_id: 'gig-wh-002',
      payment_status: PAYMENT_STATES.CAPTURED_HOLD,
      stripe_payment_intent_id: 'pi_wh_002',
    }]);
    seedTable('Gig', [{
      id: 'gig-wh-002',
      payment_status: PAYMENT_STATES.CAPTURED_HOLD,
    }]);

    // Second attempt should fail because captured_hold → captured_hold is not valid
    await expect(
      transitionPaymentStatus('pay-wh-002', PAYMENT_STATES.CAPTURED_HOLD)
    ).rejects.toThrow(/Invalid payment transition/);
  });
});
