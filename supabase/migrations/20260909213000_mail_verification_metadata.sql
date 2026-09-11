-- Backwards compatible: yes. Add service-only atomic metadata writers without
-- changing existing rows. Deploy before the matching mail vendor service.
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION public.claim_mail_verification_dispatch(
  p_job_id uuid, p_vendor text, p_destination jsonb,
  p_expected_unit text, p_expected_destination jsonb
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp SET lock_timeout = '5s' AS $$
BEGIN
  IF p_job_id IS NULL OR p_vendor IS NULL OR p_vendor NOT IN ('lob', 'mock')
    OR jsonb_typeof(p_destination) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_destination->'line1') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_destination->'city') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_destination->'state') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_destination->'zip') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'Invalid mail dispatch claim' USING ERRCODE = '22023';
  END IF;

  -- UPDATE rechecks these predicates after a concurrent row writer commits.
  -- Preserve its unrelated metadata, remove only the legacy plaintext code,
  -- and never replace an address snapshot changed after the caller's read.
  UPDATE public."MailVerificationJob"
  SET vendor = p_vendor, vendor_status = 'dispatching',
    metadata = (coalesce(metadata, '{}'::jsonb) - 'code') || jsonb_build_object(
      'destination', p_destination, 'dispatch_started_at', now()),
    updated_at = now()
  WHERE id = p_job_id AND vendor_status = 'pending' AND vendor_job_id IS NULL
    AND (metadata->>'unit') IS NOT DISTINCT FROM p_expected_unit
    AND nullif(metadata->'destination', 'null'::jsonb) IS NOT DISTINCT FROM p_expected_destination;
  RETURN FOUND;
END;
$$;

CREATE FUNCTION public.record_mail_verification_webhook(
  p_job_id uuid, p_vendor_job_id text, p_event_type text, p_vendor_status text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp SET lock_timeout = '5s' AS $$
BEGIN
  IF p_job_id IS NULL OR nullif(p_vendor_job_id, '') IS NULL
    OR nullif(p_event_type, '') IS NULL OR length(p_event_type) > 100
    OR nullif(p_vendor_status, '') IS NULL OR length(p_vendor_status) > 50 THEN
    RAISE EXCEPTION 'Invalid mail webhook status' USING ERRCODE = '22023';
  END IF;

  UPDATE public."MailVerificationJob"
  SET vendor_status = p_vendor_status,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'last_webhook_event', p_event_type, 'last_webhook_at', now()),
    updated_at = now()
  WHERE id = p_job_id AND vendor = 'lob' AND vendor_job_id = p_vendor_job_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_mail_verification_dispatch(uuid, text, jsonb, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_mail_verification_dispatch(uuid, text, jsonb, text, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.record_mail_verification_webhook(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_mail_verification_webhook(uuid, text, text, text) TO service_role;
