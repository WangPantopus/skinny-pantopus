-- The existing owner Legal form and verification API accept these two
-- nonprofit document types, but the baseline constraint rejects their inserts.
-- Preserve every existing type, row and review state; only align the accepted
-- input set. This does not approve evidence or change verification/fee policy.
-- Backwards compatible: yes. Existing clients and evidence remain valid.
-- Applied baseline/archive history cannot be edited to repair a deployed schema.
SET LOCAL lock_timeout = '5s';

ALTER TABLE public."BusinessVerificationEvidence"
  DROP CONSTRAINT bve_evidence_type_check,
  ADD CONSTRAINT bve_evidence_type_check CHECK (
    evidence_type IN (
      'business_license', 'ein_letter', 'utility_bill', 'state_registration',
      'self_attestation', 'ein_verification', 'tax_exempt_letter'
    )
  );
