-- Backwards compatible: yes. Adds a service-only admission function without
-- altering existing rows or legacy callers. The matching API requires this
-- function and fails closed when it is unavailable; deploy it before that API.
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION public.admit_mail_verification(
  p_user_id uuid, p_address_id uuid, p_job_id uuid, p_code_hash text,
  p_unit text, p_template_id text, p_policy jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp SET lock_timeout = '5s' AS $$
DECLARE
  v_attempt public."AddressVerificationAttempt"%ROWTYPE;
  v_job public."MailVerificationJob"%ROWTYPE;
  v_expiry_days integer := coalesce((p_policy->>'code_expiry_days')::integer, 30);
  v_cooldown_hours integer := coalesce((p_policy->>'cooldown_hours')::integer, 48);
  v_max_attempts integer := coalesce((p_policy->>'max_attempts')::integer, 5);
  v_user_limit integer := coalesce((p_policy->>'user_rate_limit')::integer, 2);
  v_user_hours integer := coalesce((p_policy->>'user_window_hours')::integer, 24);
  v_address_limit integer := coalesce((p_policy->>'address_rate_limit')::integer, 5);
  v_address_days integer := coalesce((p_policy->>'address_window_days')::integer, 7);
  v_user_address_limit integer := coalesce((p_policy->>'user_address_rate_limit')::integer, 2);
  v_cooldown_until timestamptz;
BEGIN
  IF p_user_id IS NULL OR p_address_id IS NULL OR p_job_id IS NULL
    OR p_code_hash IS NULL OR p_code_hash !~ '^[0-9a-f]{64}$'
    OR length(coalesce(p_unit, '')) > 100
    OR v_expiry_days NOT BETWEEN 1 AND 365 OR v_cooldown_hours NOT BETWEEN 1 AND 8760
    OR v_max_attempts NOT BETWEEN 1 AND 20 OR v_user_limit < 1
    OR v_user_hours < 1 OR v_address_limit < 1 OR v_address_days < 1
    OR v_user_address_limit < 1 THEN
    RAISE EXCEPTION 'Invalid mail verification admission' USING ERRCODE = '22023';
  END IF;

  -- Every admission takes these locks in the same order. The user lock also
  -- serializes different-address requests; the address lock serializes
  -- different-user requests. Budgets and creation share one transaction.
  PERFORM pg_advisory_xact_lock(hashtextextended('mail-verification:user:' || p_user_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('mail-verification:address:' || p_address_id::text, 0));
  PERFORM 1 FROM public."HomeAddress" WHERE id = p_address_id FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'ADDRESS_NOT_FOUND'); END IF;

  SELECT * INTO v_attempt FROM public."AddressVerificationAttempt"
    WHERE user_id = p_user_id AND address_id = p_address_id AND method = 'mail_code'
      AND status IN ('created', 'sent', 'delivered_unknown') AND expires_at > now()
    ORDER BY created_at DESC, id LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('reused', true, 'attempt_id', v_attempt.id);
  END IF;

  IF (SELECT count(*) FROM public."AddressVerificationAttempt" WHERE user_id = p_user_id
    AND created_at >= now() - v_user_hours * interval '1 hour') >= v_user_limit THEN
    RETURN jsonb_build_object('error', 'USER_RATE_LIMIT');
  END IF;
  IF (SELECT count(*) FROM public."AddressVerificationAttempt" WHERE address_id = p_address_id
    AND created_at >= now() - v_address_days * interval '1 day') >= v_address_limit THEN
    RETURN jsonb_build_object('error', 'ADDRESS_RATE_LIMIT');
  END IF;
  IF (SELECT count(*) FROM public."AddressVerificationAttempt" WHERE address_id = p_address_id
    AND user_id = p_user_id AND created_at >= now() - v_address_days * interval '1 day') >= v_user_address_limit THEN
    RETURN jsonb_build_object('error', 'USER_ADDRESS_RATE_LIMIT');
  END IF;

  v_cooldown_until := now() + v_cooldown_hours * interval '1 hour';
  INSERT INTO public."AddressVerificationAttempt" (user_id, address_id, method, status, risk_tier, expires_at)
    VALUES (p_user_id, p_address_id, 'mail_code', 'created', 'low', now() + v_expiry_days * interval '1 day')
    RETURNING * INTO v_attempt;
  INSERT INTO public."AddressVerificationToken" (attempt_id, code_hash, max_attempts, cooldown_until)
    VALUES (v_attempt.id, p_code_hash, v_max_attempts, v_cooldown_until);
  INSERT INTO public."MailVerificationJob" (id, attempt_id, vendor, template_id, vendor_status, metadata)
    VALUES (p_job_id, v_attempt.id, 'pending', p_template_id, 'pending',
      jsonb_build_object('address_id', p_address_id, 'unit', nullif(p_unit, '')))
    RETURNING * INTO v_job;

  RETURN jsonb_build_object('reused', false, 'attempt', to_jsonb(v_attempt),
    'job', to_jsonb(v_job), 'cooldown_until', v_cooldown_until);
END;
$$;

REVOKE ALL ON FUNCTION public.admit_mail_verification(uuid, uuid, uuid, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admit_mail_verification(uuid, uuid, uuid, text, text, text, jsonb) TO service_role;
