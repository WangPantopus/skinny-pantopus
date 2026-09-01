// ============================================================
// TEST: Business Verification — Flow Logic
// Validates the verification route handler logic: self-attestation,
// evidence upload dedup, and review with status upgrade.
//
// Tests the core business logic (DB queries and rules) that the
// verification route handlers execute.
// ============================================================

const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');
const supabaseAdmin = require('./__mocks__/supabaseAdmin');

beforeEach(() => resetTables());

// ── Constants mirroring businessVerification.js ──────────────
const VERIFICATION_RANK = {
  unverified: 0,
  self_attested: 1,
  document_verified: 2,
  government_verified: 3,
};

// ── Simulate route handler logic ─────────────────────────────

async function selfAttest(businessId, legalName) {
  // Fetch current status
  const { data: profile } = await supabaseAdmin
    .from('BusinessProfile')
    .select('verification_status')
    .eq('business_user_id', businessId)
    .single();

  const currentStatus = profile?.verification_status || 'unverified';

  // Idempotent: if already self_attested or higher, return current status
  if (VERIFICATION_RANK[currentStatus] >= VERIFICATION_RANK.self_attested) {
    return { status: 200, verification_status: currentStatus, idempotent: true };
  }

  // Upsert BusinessPrivate.legal_name
  const { data: existingPrivate } = await supabaseAdmin
    .from('BusinessPrivate')
    .select('business_user_id')
    .eq('business_user_id', businessId)
    .maybeSingle();

  if (existingPrivate) {
    await supabaseAdmin
      .from('BusinessPrivate')
      .update({ legal_name: legalName.trim(), updated_at: new Date().toISOString() })
      .eq('business_user_id', businessId);
  } else {
    await supabaseAdmin
      .from('BusinessPrivate')
      .insert({ business_user_id: businessId, legal_name: legalName.trim() });
  }

  // Insert evidence record
  await supabaseAdmin
    .from('BusinessVerificationEvidence')
    .insert({
      business_user_id: businessId,
      evidence_type: 'self_attestation',
      status: 'approved',
    });

  // Update profile verification status
  await supabaseAdmin
    .from('BusinessProfile')
    .update({ verification_status: 'self_attested', verification_tier: 'self_attested' })
    .eq('business_user_id', businessId);

  return { status: 200, verification_status: 'self_attested', idempotent: false };
}

async function uploadEvidence(businessId, evidenceType) {
  // Check for duplicate pending evidence
  const { data: pendingEvidence } = await supabaseAdmin
    .from('BusinessVerificationEvidence')
    .select('id')
    .eq('business_user_id', businessId)
    .eq('evidence_type', evidenceType)
    .eq('status', 'pending')
    .maybeSingle();

  if (pendingEvidence) {
    return { status: 409, code: 'DUPLICATE_PENDING' };
  }

  // Check for already-approved evidence
  const { data: approvedEvidence } = await supabaseAdmin
    .from('BusinessVerificationEvidence')
    .select('id')
    .eq('business_user_id', businessId)
    .eq('evidence_type', evidenceType)
    .eq('status', 'approved')
    .maybeSingle();

  if (approvedEvidence) {
    return { status: 409, code: 'ALREADY_VERIFIED' };
  }

  // Insert evidence
  const { data: evidence } = await supabaseAdmin
    .from('BusinessVerificationEvidence')
    .insert({
      business_user_id: businessId,
      evidence_type: evidenceType,
      status: 'pending',
    })
    .select()
    .single();

  return { status: 201, evidence_id: evidence.id, evidence_status: 'pending' };
}

async function reviewEvidence(businessId, evidenceId, decision) {
  // Fetch evidence row
  const { data: evidence, error: fetchErr } = await supabaseAdmin
    .from('BusinessVerificationEvidence')
    .select('id, business_user_id, status')
    .eq('id', evidenceId)
    .single();

  if (fetchErr || !evidence) {
    return { status: 404, error: 'Evidence not found' };
  }

  if (evidence.business_user_id !== businessId) {
    return { status: 403, error: 'Evidence does not belong to this business' };
  }

  if (evidence.status !== 'pending') {
    return { status: 400, error: `Evidence has already been ${evidence.status}` };
  }

  // Update evidence
  await supabaseAdmin
    .from('BusinessVerificationEvidence')
    .update({ status: decision, reviewed_at: new Date().toISOString() })
    .eq('id', evidenceId);

  let currentVerificationStatus = null;

  if (decision === 'approved') {
    await supabaseAdmin
      .from('BusinessProfile')
      .update({
        verification_status: 'document_verified',
        verification_tier: 'document_verified',
        verified_at: new Date().toISOString(),
      })
      .eq('business_user_id', businessId);

    currentVerificationStatus = 'document_verified';
  } else {
    const { data: profile } = await supabaseAdmin
      .from('BusinessProfile')
      .select('verification_status')
      .eq('business_user_id', businessId)
      .single();
    currentVerificationStatus = profile?.verification_status || 'unverified';
  }

  return { status: 200, verification_status: currentVerificationStatus, evidence_status: decision };
}

// ── Tests ───────────────────────────────────────────────────

describe('Verification — self-attestation', () => {
  test('updates unverified business to self_attested', async () => {
    seedTable('BusinessProfile', [{
      business_user_id: 'biz-1',
      verification_status: 'unverified',
    }]);
    seedTable('BusinessPrivate', []);
    seedTable('BusinessVerificationEvidence', []);

    const result = await selfAttest('biz-1', 'Acme LLC');

    expect(result.status).toBe(200);
    expect(result.verification_status).toBe('self_attested');
    expect(result.idempotent).toBe(false);

    // Check profile was updated
    const profiles = getTable('BusinessProfile');
    expect(profiles[0].verification_status).toBe('self_attested');

    // Check evidence was created
    const evidence = getTable('BusinessVerificationEvidence');
    expect(evidence).toHaveLength(1);
    expect(evidence[0].evidence_type).toBe('self_attestation');
    expect(evidence[0].status).toBe('approved');

    // Check legal_name was inserted
    const priv = getTable('BusinessPrivate');
    expect(priv).toHaveLength(1);
    expect(priv[0].legal_name).toBe('Acme LLC');
  });

  test('idempotent — already self_attested returns current status', async () => {
    seedTable('BusinessProfile', [{
      business_user_id: 'biz-1',
      verification_status: 'self_attested',
    }]);

    const result = await selfAttest('biz-1', 'Acme LLC');

    expect(result.status).toBe(200);
    expect(result.verification_status).toBe('self_attested');
    expect(result.idempotent).toBe(true);
  });

  test('idempotent — document_verified is higher than self_attested', async () => {
    seedTable('BusinessProfile', [{
      business_user_id: 'biz-1',
      verification_status: 'document_verified',
    }]);

    const result = await selfAttest('biz-1', 'Acme LLC');

    expect(result.status).toBe(200);
    expect(result.verification_status).toBe('document_verified');
    expect(result.idempotent).toBe(true);
  });
});

describe('Verification — evidence upload', () => {
  test('rejects duplicate pending evidence with DUPLICATE_PENDING', async () => {
    seedTable('BusinessVerificationEvidence', [{
      id: 'ev-1',
      business_user_id: 'biz-1',
      evidence_type: 'business_license',
      status: 'pending',
    }]);

    const result = await uploadEvidence('biz-1', 'business_license');
    expect(result.status).toBe(409);
    expect(result.code).toBe('DUPLICATE_PENDING');
  });

  test('rejects already-approved evidence with ALREADY_VERIFIED', async () => {
    seedTable('BusinessVerificationEvidence', [{
      id: 'ev-1',
      business_user_id: 'biz-1',
      evidence_type: 'business_license',
      status: 'approved',
    }]);

    const result = await uploadEvidence('biz-1', 'business_license');
    expect(result.status).toBe(409);
    expect(result.code).toBe('ALREADY_VERIFIED');
  });

  test('inserts new evidence as pending when no conflicts', async () => {
    seedTable('BusinessVerificationEvidence', []);

    const result = await uploadEvidence('biz-1', 'business_license');
    expect(result.status).toBe(201);
    expect(result.evidence_status).toBe('pending');

    const evidence = getTable('BusinessVerificationEvidence');
    expect(evidence).toHaveLength(1);
    expect(evidence[0].evidence_type).toBe('business_license');
    expect(evidence[0].status).toBe('pending');
  });
});

describe('Verification — review', () => {
  test('approval upgrades profile to document_verified', async () => {
    seedTable('BusinessProfile', [{
      business_user_id: 'biz-1',
      verification_status: 'self_attested',
    }]);
    seedTable('BusinessVerificationEvidence', [{
      id: 'ev-1',
      business_user_id: 'biz-1',
      status: 'pending',
      evidence_type: 'business_license',
    }]);

    const result = await reviewEvidence('biz-1', 'ev-1', 'approved');

    expect(result.status).toBe(200);
    expect(result.verification_status).toBe('document_verified');
    expect(result.evidence_status).toBe('approved');

    // Profile was upgraded
    const profiles = getTable('BusinessProfile');
    expect(profiles[0].verification_status).toBe('document_verified');

    // Evidence was updated
    const evidence = getTable('BusinessVerificationEvidence');
    expect(evidence[0].status).toBe('approved');
    expect(evidence[0].reviewed_at).toBeDefined();
  });

  test('rejection keeps current verification status', async () => {
    seedTable('BusinessProfile', [{
      business_user_id: 'biz-1',
      verification_status: 'self_attested',
    }]);
    seedTable('BusinessVerificationEvidence', [{
      id: 'ev-1',
      business_user_id: 'biz-1',
      status: 'pending',
      evidence_type: 'business_license',
    }]);

    const result = await reviewEvidence('biz-1', 'ev-1', 'rejected');

    expect(result.status).toBe(200);
    expect(result.verification_status).toBe('self_attested');
    expect(result.evidence_status).toBe('rejected');
  });

  test('rejects review of non-pending evidence', async () => {
    seedTable('BusinessProfile', [{
      business_user_id: 'biz-1',
      verification_status: 'self_attested',
    }]);
    seedTable('BusinessVerificationEvidence', [{
      id: 'ev-1',
      business_user_id: 'biz-1',
      status: 'approved',
      evidence_type: 'business_license',
    }]);

    const result = await reviewEvidence('biz-1', 'ev-1', 'approved');

    expect(result.status).toBe(400);
    expect(result.error).toMatch(/already been approved/);
  });
});
