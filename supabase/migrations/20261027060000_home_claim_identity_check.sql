-- Backwards compatible: yes. Adds two service-only functions; no table, column, constraint or data change.
-- Deployed apps and the current backend never call them, and approval keeps its current rule.
--
-- An ownership or residency claim can't be approved until the claimant's identity is confirmed
-- (mutate_home_claim_review), and until now nothing could confirm one. The only identity evidence
-- approval accepts is a verified Stripe Identity check (provider 'stripe_identity', evidence_type
-- 'idv'; home_claim_review_verified_evidence), and nothing created it. The backend now starts a
-- Stripe Identity document and selfie check for the claimant and records each result here.
--
--   record_home_claim_identity_check  one 'idv' evidence row per Stripe verification session, and the
--                                     claim's identity_status kept in step with those rows.
--   home_claim_approval_progress      what still stands between each claim and approval, using the
--                                     tests approval uses: the claimant's checklist and the reviewer's
--                                     screen read it, so neither can disagree with approval.
--
-- Only the check's state, the Stripe session and report ids, its mode, the number of attempts and the
-- name on the ID are kept. Stripe keeps the ID images and other details; nothing else is stored here.
SET LOCAL lock_timeout='5s';

CREATE FUNCTION public.record_home_claim_identity_check(p_claim_id uuid,p_user_id uuid,p_session_id text,
  p_status text,p_livemode boolean,p_observed_at timestamptz,p_error_code text DEFAULT NULL,p_verified_name text DEFAULT NULL,
  p_report_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE h uuid; c public."HomeOwnershipClaim"%ROWTYPE; e public."HomeVerificationEvidence"%ROWTYPE;
  v_status text; v_identity public.identity_status; v_changed boolean:=false; v_meta jsonb; v_attempts integer;
BEGIN
  -- started: a session nobody has submitted yet; processing: Stripe is checking it; requires_input: the
  -- last attempt failed and the same session can be tried again; canceled: the session is closed.
  IF p_claim_id IS NULL OR p_user_id IS NULL OR p_session_id IS NULL OR p_session_id !~ '^vs_[A-Za-z0-9]{1,200}$'
    OR p_status IS NULL OR p_status NOT IN ('started','processing','verified','requires_input','canceled')
    OR p_livemode IS NULL OR p_observed_at IS NULL OR length(p_error_code)>100 OR length(p_verified_name)>200
    OR (p_report_id IS NOT NULL AND p_report_id !~ '^vr_[A-Za-z0-9]{1,200}$') THEN
    RETURN '{"ok":false,"code":"IDENTITY_CHECK_INVALID","status":400}'::jsonb; END IF;
  SELECT home_id INTO h FROM public."HomeOwnershipClaim" WHERE id=p_claim_id;
  IF h IS NULL OR NOT public.lock_home_claim_scope(h) THEN RETURN '{"ok":false,"code":"CLAIM_NOT_FOUND","status":404}'::jsonb; END IF;
  SELECT * INTO c FROM public."HomeOwnershipClaim" WHERE id=p_claim_id AND home_id=h;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"CLAIM_NOT_FOUND","status":404}'::jsonb; END IF;
  IF c.claimant_user_id<>p_user_id THEN RETURN '{"ok":false,"code":"CLAIM_RECIPIENT_MISMATCH","status":403}'::jsonb; END IF;
  SELECT * INTO e FROM public."HomeVerificationEvidence" WHERE claim_id=p_claim_id AND provider='stripe_identity'
    AND evidence_type='idv' AND metadata->>'session_id'=p_session_id ORDER BY created_at,id LIMIT 1;
  -- A decided, withdrawn or expired claim keeps its history; a late result changes nothing on it.
  IF NOT public.home_claim_is_active(c) OR c.expires_at<=clock_timestamp() THEN
    RETURN jsonb_build_object('ok',true,'claimId',p_claim_id,'homeId',h,'recorded',false,'identityStatus',c.identity_status);
  END IF;
  IF e.id IS NOT NULL AND (e.metadata->>'livemode')::boolean IS DISTINCT FROM p_livemode THEN
    RETURN '{"ok":false,"code":"IDENTITY_CHECK_INVALID","status":400}'::jsonb; END IF;
  v_status:=CASE p_status WHEN 'verified' THEN 'verified' WHEN 'requires_input' THEN 'failed' WHEN 'canceled' THEN 'failed' ELSE 'pending' END;
  -- Stripe can deliver results out of order. A verified or canceled session never changes again, and an
  -- older observation never replaces a newer one. attempts counts the submissions seen (Stripe makes a
  -- verification report for each, and bills each); the backend stops offering a session after a few.
  IF e.id IS NULL THEN
    INSERT INTO public."HomeVerificationEvidence"(claim_id,evidence_type,provider,status,redaction_status,storage_ref,metadata)
      VALUES(p_claim_id,'idv','stripe_identity',v_status,'ok',NULL,jsonb_strip_nulls(jsonb_build_object('session_id',p_session_id,
        'livemode',p_livemode,'check_status',p_status,'observed_at',p_observed_at,'error_code',p_error_code,
        'last_report',p_report_id,'attempts',CASE WHEN p_report_id IS NULL THEN 0 ELSE 1 END,
        'verified_name',CASE WHEN p_status='verified' THEN nullif(btrim(p_verified_name),'') END)))
      RETURNING * INTO e;
    v_changed:=true;
  ELSIF e.metadata->>'check_status' NOT IN ('verified','canceled')
    AND (p_status IN ('verified','canceled') OR (e.metadata->>'observed_at')::timestamptz<=p_observed_at)
    AND (e.metadata->>'check_status' IS DISTINCT FROM p_status OR e.metadata->>'error_code' IS DISTINCT FROM p_error_code
      OR (p_report_id IS NOT NULL AND p_report_id IS DISTINCT FROM e.metadata->>'last_report')) THEN
    v_attempts:=coalesce((e.metadata->>'attempts')::integer,0)
      +CASE WHEN p_report_id IS NOT NULL AND p_report_id IS DISTINCT FROM e.metadata->>'last_report' THEN 1 ELSE 0 END;
    v_meta:=jsonb_strip_nulls(jsonb_build_object('session_id',p_session_id,'livemode',p_livemode,'check_status',p_status,
      'observed_at',greatest(p_observed_at,(e.metadata->>'observed_at')::timestamptz),'error_code',p_error_code,
      'last_report',coalesce(p_report_id,e.metadata->>'last_report'),'attempts',v_attempts,
      'verified_name',CASE WHEN p_status='verified' THEN nullif(btrim(p_verified_name),'') END));
    UPDATE public."HomeVerificationEvidence" SET status=v_status,metadata=v_meta,updated_at=clock_timestamp()
      WHERE id=e.id RETURNING * INTO e;
    v_changed:=true;
  END IF;
  -- The claim's identity_status follows its checks: confirmed once any check is verified (or already
  -- confirmed, as a platform admin's attestation does), pending while a check is open or can be tried
  -- again, and never started when every check is closed, so the claimant can start again. A failed
  -- attempt isn't 'failed': approval treats that as final, and Stripe lets the person retry.
  SELECT CASE WHEN c.identity_status='verified' OR bool_or(x.status='verified') THEN 'verified'
    WHEN bool_or(x.status='pending' OR x.metadata->>'check_status'='requires_input') THEN 'pending'
    WHEN c.identity_status='failed' THEN 'failed'
    ELSE 'not_started' END::public.identity_status
    INTO v_identity FROM public."HomeVerificationEvidence" x
    WHERE x.claim_id=p_claim_id AND x.provider='stripe_identity' AND x.evidence_type='idv';
  IF v_identity IS DISTINCT FROM c.identity_status THEN
    UPDATE public."HomeOwnershipClaim" SET identity_status=v_identity,updated_at=clock_timestamp() WHERE id=p_claim_id;
    v_changed:=true;
  END IF;
  IF v_changed THEN
    INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
      VALUES(h,p_user_id,'OWNERSHIP_CLAIM_IDENTITY_CHECK','HomeOwnershipClaim',p_claim_id,
        jsonb_build_object('check_status',p_status,'identity_status',v_identity,'livemode',p_livemode));
  END IF;
  RETURN jsonb_build_object('ok',true,'claimId',p_claim_id,'homeId',h,'recorded',v_changed,'identityStatus',v_identity,
    'checkStatus',e.metadata->>'check_status');
END $$;

-- identity_confirmed and proof='verified' are exactly the two evidence tests in mutate_home_claim_review's
-- approve branch. identity tells the claimant where their check stands; proof='pending' means a private
-- upload is waiting for a reviewer, and a legacy document that needs a private re-upload counts as missing.
CREATE FUNCTION public.home_claim_approval_progress(p_claim_ids uuid[]) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('claim_id',c.id,'claim_type',c.claim_type,
    'active',public.home_claim_is_active(c) AND (c.expires_at IS NULL OR c.expires_at>now()),'identity_confirmed',v.identity_confirmed,
    'identity',CASE WHEN v.identity_confirmed THEN 'verified' WHEN c.identity_status='failed' AND v.latest IS NULL THEN 'requires_input'
      ELSE coalesce(nullif(v.latest,'verified'),'not_started') END,
    'identity_checked_at',v.checked_at,
    'proof',CASE WHEN v.proof_verified THEN 'verified' WHEN v.proof_pending THEN 'pending' ELSE 'missing' END) ORDER BY c.id),'[]'::jsonb)
  FROM public."HomeOwnershipClaim" c
  CROSS JOIN LATERAL (SELECT
    c.identity_status<>'failed' AND (c.identity_status='verified' OR EXISTS(SELECT FROM public."HomeVerificationEvidence" e
      WHERE e.claim_id=c.id AND e.evidence_type='idv' AND public.home_claim_review_verified_evidence(e))) AS identity_confirmed,
    (SELECT e.metadata->>'check_status' FROM public."HomeVerificationEvidence" e WHERE e.claim_id=c.id
      AND e.provider='stripe_identity' AND e.evidence_type='idv' AND e.metadata->>'check_status'<>'canceled'
      ORDER BY (e.metadata->>'observed_at')::timestamptz DESC NULLS LAST,e.created_at DESC LIMIT 1) AS latest,
    (SELECT max(e.updated_at) FROM public."HomeVerificationEvidence" e WHERE e.claim_id=c.id
      AND e.provider='stripe_identity' AND e.evidence_type='idv' AND e.status='verified') AS checked_at,
    EXISTS(SELECT FROM public."HomeVerificationEvidence" e WHERE e.claim_id=c.id AND public.home_claim_review_verified_evidence(e)
      AND (e.evidence_type IN ('deed','closing_disclosure','tax_bill','escrow_attestation','title_match')
        OR (c.claim_type='resident' AND e.evidence_type IN ('utility_bill','lease')))) AS proof_verified,
    EXISTS(SELECT FROM public."HomeVerificationEvidence" e WHERE e.claim_id=c.id AND e.status='pending' AND e.private_upload_id IS NOT NULL
      AND (e.evidence_type IN ('deed','closing_disclosure','tax_bill','escrow_attestation','title_match')
        OR (c.claim_type='resident' AND e.evidence_type IN ('utility_bill','lease')))) AS proof_pending) v
  WHERE c.id=ANY(p_claim_ids);
$$;

REVOKE ALL ON FUNCTION public.record_home_claim_identity_check(uuid,uuid,text,text,boolean,timestamptz,text,text,text),
  public.home_claim_approval_progress(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_home_claim_identity_check(uuid,uuid,text,text,boolean,timestamptz,text,text,text),
  public.home_claim_approval_progress(uuid[]) TO service_role;
