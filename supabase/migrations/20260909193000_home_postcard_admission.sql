-- Backwards compatible: yes. Additive dispatch metadata and a service-only
-- admission transaction. Existing proofs are preserved; legacy unknown receipts
-- are not guessed. Deploy before the matching native postcard API.
SET LOCAL lock_timeout = '5s';
ALTER TABLE public."HomePostcardCode"
  ADD COLUMN dispatch_status text,
  ADD COLUMN vendor_job_id text,
  ADD COLUMN destination jsonb,
  ADD CONSTRAINT home_postcard_dispatch_status_check CHECK
    (dispatch_status IN ('pending','dispatching','accepted','delivery_unknown','rejected'));
CREATE UNIQUE INDEX home_postcard_vendor_receipt ON public."HomePostcardCode" (vendor_job_id)
  WHERE vendor_job_id IS NOT NULL;

CREATE FUNCTION public.admit_home_postcard(p_home_id uuid, p_user_id uuid, p_code_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp SET lock_timeout = '5s' AS $$
DECLARE v_card public."HomePostcardCode"%ROWTYPE; v_home public."Home"%ROWTYPE;
BEGIN
  IF p_home_id IS NULL OR p_user_id IS NULL OR p_code_hash IS NULL OR p_code_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid postcard admission' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('home-postcard:user:' || p_user_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('home-postcard:home:' || p_home_id::text, 0));
  SELECT * INTO v_home FROM public."Home" WHERE id=p_home_id FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','HOME_NOT_FOUND'); END IF;
  IF v_home.security_state IN ('frozen','frozen_silent')
    OR EXISTS(SELECT FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_user_id
      AND (is_active IS DISTINCT FROM true OR end_at IS NOT NULL OR access_end_at<=now()
        OR access_start_at>now() OR verification_status IN ('suspended','suspended_challenged','inactive','moved_out')))
    OR (SELECT status FROM public."HomeResidencyClaim" WHERE home_id=p_home_id AND user_id=p_user_id
      ORDER BY created_at DESC,id DESC LIMIT 1)='rejected' THEN
    RETURN jsonb_build_object('error','HOME_RESTRICTED');
  END IF;
  IF nullif(trim(v_home.address),'') IS NULL OR nullif(trim(v_home.city),'') IS NULL
    OR nullif(trim(v_home.state),'') IS NULL OR nullif(trim(v_home.zipcode),'') IS NULL THEN
    RETURN jsonb_build_object('error','ADDRESS_INCOMPLETE');
  END IF;
  -- Retire naturally expired pending rows so the existing partial unique index
  -- cannot trap this user forever. Never rotate an unexpired proof on retry.
  UPDATE public."HomePostcardCode" SET status='expired',updated_at=now()
    WHERE home_id=p_home_id AND status='pending' AND expires_at<=now();
  SELECT * INTO v_card FROM public."HomePostcardCode"
    WHERE home_id=p_home_id AND user_id=p_user_id AND status='pending';
  IF FOUND THEN RETURN jsonb_build_object('reused',true,'postcard',to_jsonb(v_card)); END IF;
  IF (SELECT count(*) FROM public."HomePostcardCode" WHERE home_id=p_home_id AND status='pending') >= 2 THEN
    RETURN jsonb_build_object('error','ADDRESS_LIMIT');
  END IF;
  IF (SELECT count(*) FROM public."HomePostcardCode" WHERE user_id=p_user_id AND requested_at>now()-interval '1 hour') >= 3 THEN
    RETURN jsonb_build_object('error','USER_LIMIT');
  END IF;
  INSERT INTO public."HomePostcardCode" (home_id,user_id,code_hash,dispatch_status,destination)
    VALUES (p_home_id,p_user_id,p_code_hash,'pending',jsonb_build_object(
      'address',v_home.address,'address2',v_home.address2,'city',v_home.city,'state',v_home.state,'zipcode',v_home.zipcode))
    RETURNING * INTO v_card;
  RETURN jsonb_build_object('reused',false,'postcard',to_jsonb(v_card));
END $$;
REVOKE ALL ON FUNCTION public.admit_home_postcard(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admit_home_postcard(uuid,uuid,text) TO service_role;
