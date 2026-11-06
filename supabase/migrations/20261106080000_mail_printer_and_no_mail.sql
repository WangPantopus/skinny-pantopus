-- Backwards compatible: yes. Additive columns, plus two service-only functions redefined with the
-- same signatures so another printer's name and receipts are accepted. Old server code ignores the
-- new columns and keeps working while a release runs.
--
-- A piece always finishes with the printer that accepted it, so the printer is recorded before it
-- is called. MailVerificationJob.vendor already holds this for address verification cards. The two
-- other mail rows get mail_provider. NULL means a row written before this migration.
SET LOCAL lock_timeout = '5s';

ALTER TABLE public."HomePostcardCode"
  ADD COLUMN mail_provider text,
  ADD COLUMN mail_outcome text,
  ADD COLUMN mail_outcome_at timestamptz,
  ADD CONSTRAINT home_postcard_mail_provider_check CHECK (mail_provider ~ '^[a-z0-9_]{1,40}$'),
  ADD CONSTRAINT home_postcard_mail_outcome_check CHECK (mail_outcome IN ('returned', 'rerouted', 'failed', 'canceled'));

-- An invitation's reservation stays when the printer's answer is unknown. card_fields holds what the
-- card printed, so asking the printer again sends the identical card.
ALTER TABLE public."BlockInvite"
  ADD COLUMN mail_provider text,
  ADD COLUMN dispatch_status text,
  ADD COLUMN card_fields jsonb,
  ADD COLUMN mail_outcome text,
  ADD COLUMN mail_outcome_at timestamptz,
  ADD CONSTRAINT block_invite_mail_provider_check CHECK (mail_provider ~ '^[a-z0-9_]{1,40}$'),
  ADD CONSTRAINT block_invite_dispatch_status_check CHECK (dispatch_status IN ('reserved', 'dispatching', 'accepted', 'delivery_unknown')),
  ADD CONSTRAINT block_invite_mail_outcome_check CHECK (mail_outcome IN ('returned', 'rerouted', 'failed', 'canceled'));

CREATE INDEX block_invite_unresolved_idx ON public."BlockInvite" (created_at)
  WHERE lob_id IS NULL AND dispatch_status IN ('dispatching', 'delivery_unknown');

-- 'invites' is today's permanent opt-out. 'all_mail' is a protected person's no-mail flag: every card
-- stops, verification cards included. Only the address hash is kept, never the address.
ALTER TABLE public."BlockInviteOptOut"
  ADD COLUMN scope text NOT NULL DEFAULT 'invites',
  ADD CONSTRAINT block_invite_opt_out_scope_check CHECK (scope IN ('invites', 'all_mail'));

CREATE OR REPLACE FUNCTION public.claim_mail_verification_dispatch(
  p_job_id uuid, p_vendor text, p_destination jsonb,
  p_expected_unit text, p_expected_destination jsonb
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp SET lock_timeout = '5s' AS $$
BEGIN
  IF p_job_id IS NULL OR p_vendor IS NULL OR p_vendor !~ '^[a-z0-9_]{1,40}$'
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

REVOKE ALL ON FUNCTION public.claim_mail_verification_dispatch(uuid, text, jsonb, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_mail_verification_dispatch(uuid, text, jsonb, text, jsonb) TO service_role;
