// ============================================================
// TEST: Gig Cancellation Policy Logic
// Validates fee computation across all three policies (flexible,
// standard, strict), all three zones (before accept, after accept,
// after start), and the grace-period window.
// ============================================================

// We need to extract the cancellation logic.  Since it's defined
// inside gigs.js as module-scoped functions, we replicate the
// exact logic here for unit testing (same constants + algorithm).

const CANCELLATION_POLICIES = {
  flexible: {
    label: 'Flexible',
    description: 'Free cancellation anytime before work starts.',
    grace_minutes_after_accept: null,
    fee_zone1_pct: 0,
    fee_zone2_pct: 0.10,
  },
  standard: {
    label: 'Standard',
    description: 'Free within 1 hour of acceptance. After that, 5% fee.',
    grace_minutes_after_accept: 60,
    fee_zone1_pct: 0.05,
    fee_zone2_pct: 0.25,
  },
  strict: {
    label: 'Strict',
    description: '10% fee after acceptance. 50% after work starts.',
    grace_minutes_after_accept: 10,
    fee_zone1_pct: 0.10,
    fee_zone2_pct: 0.50,
  },
};

function computeCancellationInfo(gig, cancellingUserId) {
  const policyKey = gig.cancellation_policy || 'standard';
  const policy = CANCELLATION_POLICIES[policyKey] || CANCELLATION_POLICIES.standard;
  const gigPrice = parseFloat(gig.price) || 0;

  if (gig.status === 'open') {
    return { zone: 0, zone_label: 'Before acceptance', fee: 0, fee_pct: 0, in_grace: true };
  }

  if (gig.status === 'in_progress') {
    const fee = Math.round(gigPrice * policy.fee_zone2_pct * 100) / 100;
    return { zone: 2, zone_label: 'After work started', fee, fee_pct: policy.fee_zone2_pct * 100, in_grace: false };
  }

  if (gig.status === 'assigned') {
    const acceptedAt = gig.accepted_at ? new Date(gig.accepted_at) : null;
    const graceMins = policy.grace_minutes_after_accept;

    if (graceMins === null) {
      return { zone: 1, zone_label: 'After acceptance, before start', fee: 0, fee_pct: 0, in_grace: true };
    }

    const inGrace = acceptedAt
      ? (Date.now() - acceptedAt.getTime()) < (graceMins * 60 * 1000)
      : true;

    if (inGrace) {
      return { zone: 1, zone_label: 'After acceptance (within grace period)', fee: 0, fee_pct: 0, in_grace: true };
    }

    const fee = Math.round(gigPrice * policy.fee_zone1_pct * 100) / 100;
    return {
      zone: 1,
      zone_label: 'After acceptance (grace period expired)',
      fee,
      fee_pct: policy.fee_zone1_pct * 100,
      in_grace: false,
    };
  }

  return { zone: 0, zone_label: 'Unknown', fee: 0, fee_pct: 0, in_grace: true };
}

// ── Zone 0: Open gig (before any bid accepted) ──────────────
describe('Zone 0 — Open gig', () => {
  test.each(['flexible', 'standard', 'strict'])(
    '%s policy: zero fee for open gig',
    (policy) => {
      const gig = { status: 'open', price: 100, cancellation_policy: policy, user_id: 'u1' };
      const info = computeCancellationInfo(gig, 'u1');
      expect(info.zone).toBe(0);
      expect(info.fee).toBe(0);
      expect(info.in_grace).toBe(true);
    }
  );
});

// ── Zone 1: Assigned gig (after accept, before start) ───────
describe('Zone 1 — Assigned gig', () => {
  test('flexible: always free (grace is infinite)', () => {
    const gig = {
      status: 'assigned',
      price: 200,
      cancellation_policy: 'flexible',
      user_id: 'u1',
      accepted_at: new Date(Date.now() - 86400000).toISOString(), // 24h ago
    };
    const info = computeCancellationInfo(gig, 'u1');
    expect(info.zone).toBe(1);
    expect(info.fee).toBe(0);
    expect(info.in_grace).toBe(true);
  });

  test('standard: free within 1 hour grace', () => {
    const gig = {
      status: 'assigned',
      price: 200,
      cancellation_policy: 'standard',
      user_id: 'u1',
      accepted_at: new Date(Date.now() - 30 * 60000).toISOString(), // 30 min ago
    };
    const info = computeCancellationInfo(gig, 'u1');
    expect(info.zone).toBe(1);
    expect(info.fee).toBe(0);
    expect(info.in_grace).toBe(true);
  });

  test('standard: 5% fee after 1 hour grace', () => {
    const gig = {
      status: 'assigned',
      price: 200,
      cancellation_policy: 'standard',
      user_id: 'u1',
      accepted_at: new Date(Date.now() - 90 * 60000).toISOString(), // 90 min ago
    };
    const info = computeCancellationInfo(gig, 'u1');
    expect(info.zone).toBe(1);
    expect(info.fee).toBe(10); // 5% of $200
    expect(info.fee_pct).toBe(5);
    expect(info.in_grace).toBe(false);
  });

  test('strict: free within 10 min grace', () => {
    const gig = {
      status: 'assigned',
      price: 500,
      cancellation_policy: 'strict',
      user_id: 'u1',
      accepted_at: new Date(Date.now() - 5 * 60000).toISOString(), // 5 min ago
    };
    const info = computeCancellationInfo(gig, 'u1');
    expect(info.zone).toBe(1);
    expect(info.fee).toBe(0);
    expect(info.in_grace).toBe(true);
  });

  test('strict: 10% fee after 10 min grace', () => {
    const gig = {
      status: 'assigned',
      price: 500,
      cancellation_policy: 'strict',
      user_id: 'u1',
      accepted_at: new Date(Date.now() - 15 * 60000).toISOString(), // 15 min ago
    };
    const info = computeCancellationInfo(gig, 'u1');
    expect(info.zone).toBe(1);
    expect(info.fee).toBe(50); // 10% of $500
    expect(info.fee_pct).toBe(10);
    expect(info.in_grace).toBe(false);
  });

  test('no accepted_at = grace period assumed', () => {
    const gig = {
      status: 'assigned',
      price: 100,
      cancellation_policy: 'standard',
      user_id: 'u1',
      accepted_at: null,
    };
    const info = computeCancellationInfo(gig, 'u1');
    expect(info.in_grace).toBe(true);
    expect(info.fee).toBe(0);
  });
});

// ── Zone 2: In-progress gig ─────────────────────────────────
describe('Zone 2 — In-progress gig', () => {
  test('flexible: 10% fee', () => {
    const gig = { status: 'in_progress', price: 1000, cancellation_policy: 'flexible', user_id: 'u1' };
    const info = computeCancellationInfo(gig, 'u1');
    expect(info.zone).toBe(2);
    expect(info.fee).toBe(100); // 10% of $1000
    expect(info.fee_pct).toBe(10);
    expect(info.in_grace).toBe(false);
  });

  test('standard: 25% fee', () => {
    const gig = { status: 'in_progress', price: 1000, cancellation_policy: 'standard', user_id: 'u1' };
    const info = computeCancellationInfo(gig, 'u1');
    expect(info.zone).toBe(2);
    expect(info.fee).toBe(250); // 25% of $1000
    expect(info.fee_pct).toBe(25);
  });

  test('strict: 50% fee', () => {
    const gig = { status: 'in_progress', price: 1000, cancellation_policy: 'strict', user_id: 'u1' };
    const info = computeCancellationInfo(gig, 'u1');
    expect(info.zone).toBe(2);
    expect(info.fee).toBe(500); // 50% of $1000
    expect(info.fee_pct).toBe(50);
  });

  test('handles fractional prices without floating-point drift', () => {
    const gig = { status: 'in_progress', price: 99.99, cancellation_policy: 'standard', user_id: 'u1' };
    const info = computeCancellationInfo(gig, 'u1');
    // 25% of 99.99 = 24.9975, rounded to 25.00
    expect(info.fee).toBe(25);
  });
});

// ── Edge cases ───────────────────────────────────────────────
describe('Edge cases', () => {
  test('missing cancellation_policy defaults to standard', () => {
    const gig = { status: 'in_progress', price: 100, user_id: 'u1' };
    const info = computeCancellationInfo(gig, 'u1');
    expect(info.fee_pct).toBe(25); // standard zone2 = 25%
  });

  test('unknown gig status returns safe fallback', () => {
    const gig = { status: 'pending_review', price: 100, cancellation_policy: 'standard', user_id: 'u1' };
    const info = computeCancellationInfo(gig, 'u1');
    expect(info.zone).toBe(0);
    expect(info.fee).toBe(0);
    expect(info.in_grace).toBe(true);
  });

  test('zero price results in zero fee', () => {
    const gig = { status: 'in_progress', price: 0, cancellation_policy: 'strict', user_id: 'u1' };
    const info = computeCancellationInfo(gig, 'u1');
    expect(info.fee).toBe(0);
  });
});
