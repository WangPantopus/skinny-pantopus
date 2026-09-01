// ============================================================
// PAYMENT STATE MACHINE
// Defines payment lifecycle states and valid transitions.
// Keeps payment state decoupled from gig state.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

// Payment lifecycle states
const PAYMENT_STATES = {
  NONE: 'none',
  SETUP_PENDING: 'setup_pending',
  READY_TO_AUTHORIZE: 'ready_to_authorize',
  AUTHORIZE_PENDING: 'authorize_pending',
  AUTHORIZED: 'authorized',
  AUTHORIZATION_FAILED: 'authorization_failed',
  CAPTURE_PENDING: 'capture_pending',
  CAPTURED_HOLD: 'captured_hold',
  TRANSFER_SCHEDULED: 'transfer_scheduled',
  TRANSFER_PENDING: 'transfer_pending',
  TRANSFERRED: 'transferred',
  REFUND_PENDING: 'refund_pending',
  REFUNDED_PARTIAL: 'refunded_partial',
  REFUNDED_FULL: 'refunded_full',
  DISPUTED: 'disputed',
  CANCELED: 'canceled',
};

// Valid state transitions: { fromState: [allowedToStates] }
const VALID_TRANSITIONS = {
  [PAYMENT_STATES.NONE]: [
    PAYMENT_STATES.SETUP_PENDING,
    PAYMENT_STATES.AUTHORIZE_PENDING,
  ],
  [PAYMENT_STATES.SETUP_PENDING]: [
    PAYMENT_STATES.READY_TO_AUTHORIZE,
    PAYMENT_STATES.CANCELED,
  ],
  [PAYMENT_STATES.READY_TO_AUTHORIZE]: [
    PAYMENT_STATES.AUTHORIZE_PENDING,
    PAYMENT_STATES.CANCELED,
  ],
  [PAYMENT_STATES.AUTHORIZE_PENDING]: [
    PAYMENT_STATES.AUTHORIZED,
    PAYMENT_STATES.AUTHORIZATION_FAILED,
    PAYMENT_STATES.CAPTURED_HOLD,  // Auto-capture PIs (tips, cancellation fees) skip authorized
    PAYMENT_STATES.CANCELED,
  ],
  [PAYMENT_STATES.AUTHORIZATION_FAILED]: [
    PAYMENT_STATES.AUTHORIZE_PENDING,
    PAYMENT_STATES.AUTHORIZED,
    PAYMENT_STATES.CANCELED,
  ],
  [PAYMENT_STATES.AUTHORIZED]: [
    PAYMENT_STATES.CAPTURE_PENDING,
    PAYMENT_STATES.CAPTURED_HOLD,
    PAYMENT_STATES.CANCELED,
  ],
  [PAYMENT_STATES.CAPTURE_PENDING]: [
    PAYMENT_STATES.CAPTURED_HOLD,
    PAYMENT_STATES.CANCELED,
  ],
  [PAYMENT_STATES.CAPTURED_HOLD]: [
    PAYMENT_STATES.TRANSFER_SCHEDULED,
    PAYMENT_STATES.REFUND_PENDING,
    PAYMENT_STATES.DISPUTED,
  ],
  [PAYMENT_STATES.TRANSFER_SCHEDULED]: [
    PAYMENT_STATES.TRANSFER_PENDING,
    PAYMENT_STATES.TRANSFERRED,       // direct transition for synchronous wallet credits
    PAYMENT_STATES.REFUND_PENDING,
    PAYMENT_STATES.DISPUTED,
  ],
  [PAYMENT_STATES.TRANSFER_PENDING]: [
    PAYMENT_STATES.TRANSFERRED,
    PAYMENT_STATES.REFUND_PENDING,
    PAYMENT_STATES.DISPUTED,
  ],
  [PAYMENT_STATES.TRANSFERRED]: [
    PAYMENT_STATES.REFUND_PENDING,
    PAYMENT_STATES.DISPUTED,
  ],
  [PAYMENT_STATES.REFUND_PENDING]: [
    PAYMENT_STATES.REFUNDED_PARTIAL,
    PAYMENT_STATES.REFUNDED_FULL,
  ],
  [PAYMENT_STATES.REFUNDED_PARTIAL]: [
    PAYMENT_STATES.REFUND_PENDING,
    PAYMENT_STATES.DISPUTED,
  ],
  [PAYMENT_STATES.REFUNDED_FULL]: [],
  [PAYMENT_STATES.DISPUTED]: [
    PAYMENT_STATES.REFUND_PENDING,
    PAYMENT_STATES.CAPTURED_HOLD,
    PAYMENT_STATES.TRANSFERRED,
  ],
  [PAYMENT_STATES.CANCELED]: [],
};

/**
 * Check if a state transition is valid.
 */
function canTransition(fromState, toState) {
  const allowed = VALID_TRANSITIONS[fromState];
  if (!allowed) return false;
  return allowed.includes(toState);
}

/**
 * Transition a payment to a new state.
 * Validates the transition, updates the Payment record, and syncs
 * the denormalized payment_status on the linked Gig.
 *
 * @param {string} paymentId - Payment UUID
 * @param {string} newStatus - Target payment state
 * @param {object} extraUpdates - Additional columns to update on Payment
 * @returns {object} Updated payment record
 * @throws {Error} If transition is invalid or payment not found
 */
async function transitionPaymentStatus(paymentId, newStatus, extraUpdates = {}) {
  // Fetch current payment
  const { data: payment, error: fetchErr } = await supabaseAdmin
    .from('Payment')
    .select('id, payment_status, gig_id')
    .eq('id', paymentId)
    .single();

  if (fetchErr || !payment) {
    throw new Error(`Payment not found: ${paymentId}`);
  }

  const currentStatus = payment.payment_status;

  // Validate transition
  if (!canTransition(currentStatus, newStatus)) {
    throw new Error(
      `Invalid payment transition: ${currentStatus} → ${newStatus} (payment ${paymentId})`
    );
  }

  // Update Payment record
  const updateData = {
    payment_status: newStatus,
    updated_at: new Date().toISOString(),
    ...extraUpdates,
  };

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('Payment')
    .update(updateData)
    .eq('id', paymentId)
    .select()
    .single();

  if (updateErr) {
    logger.error('Failed to transition payment status', {
      paymentId,
      from: currentStatus,
      to: newStatus,
      error: updateErr.message,
    });
    throw new Error(`Failed to update payment: ${updateErr.message}`);
  }

  // Sync denormalized status on Gig
  if (payment.gig_id) {
    await supabaseAdmin
      .from('Gig')
      .update({
        payment_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.gig_id);
  }

  logger.info('Payment status transitioned', {
    paymentId,
    from: currentStatus,
    to: newStatus,
  });

  return updated;
}

/**
 * Get display info for a payment status (for frontend rendering).
 */
function getPaymentStateInfo(status) {
  const stateMap = {
    [PAYMENT_STATES.NONE]: {
      label: 'No Payment',
      color: 'gray',
      description: 'No payment has been set up for this gig.',
    },
    [PAYMENT_STATES.SETUP_PENDING]: {
      label: 'Saving Card',
      color: 'yellow',
      description: 'Card is being saved for future authorization.',
    },
    [PAYMENT_STATES.READY_TO_AUTHORIZE]: {
      label: 'Card Saved',
      color: 'blue',
      description: 'Card is saved. Payment will be authorized before the gig starts.',
    },
    [PAYMENT_STATES.AUTHORIZE_PENDING]: {
      label: 'Authorizing',
      color: 'yellow',
      description: 'Payment authorization is in progress.',
    },
    [PAYMENT_STATES.AUTHORIZED]: {
      label: 'Authorized',
      color: 'green',
      description: 'Payment is authorized. Funds are held on your card.',
    },
    [PAYMENT_STATES.AUTHORIZATION_FAILED]: {
      label: 'Authorization Failed',
      color: 'red',
      description: 'Payment authorization failed. Please update your payment method.',
    },
    [PAYMENT_STATES.CAPTURE_PENDING]: {
      label: 'Capturing',
      color: 'yellow',
      description: 'Payment is being captured.',
    },
    [PAYMENT_STATES.CAPTURED_HOLD]: {
      label: 'Payment Captured',
      color: 'green',
      description: 'Payment has been captured. Provider payout is pending.',
    },
    [PAYMENT_STATES.TRANSFER_SCHEDULED]: {
      label: 'Transfer Scheduled',
      color: 'blue',
      description: 'Provider payout has been scheduled.',
    },
    [PAYMENT_STATES.TRANSFER_PENDING]: {
      label: 'Transferring',
      color: 'yellow',
      description: 'Provider payout is being processed.',
    },
    [PAYMENT_STATES.TRANSFERRED]: {
      label: 'Paid Out',
      color: 'green',
      description: 'Provider has been paid.',
    },
    [PAYMENT_STATES.REFUND_PENDING]: {
      label: 'Refund Pending',
      color: 'yellow',
      description: 'A refund is being processed.',
    },
    [PAYMENT_STATES.REFUNDED_PARTIAL]: {
      label: 'Partially Refunded',
      color: 'orange',
      description: 'A partial refund has been issued.',
    },
    [PAYMENT_STATES.REFUNDED_FULL]: {
      label: 'Refunded',
      color: 'gray',
      description: 'A full refund has been issued.',
    },
    [PAYMENT_STATES.DISPUTED]: {
      label: 'Disputed',
      color: 'red',
      description: 'This payment is under dispute.',
    },
    [PAYMENT_STATES.CANCELED]: {
      label: 'Canceled',
      color: 'gray',
      description: 'Payment has been canceled.',
    },
  };

  return stateMap[status] || { label: status, color: 'gray', description: '' };
}

module.exports = {
  PAYMENT_STATES,
  VALID_TRANSITIONS,
  canTransition,
  transitionPaymentStatus,
  getPaymentStateInfo,
};
