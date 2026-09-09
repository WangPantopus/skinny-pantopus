-- Backwards compatible: yes. Adds an atomic service-only confirmation path.
-- No historical proof or membership rows are rewritten by this migration.
SET LOCAL lock_timeout = '5s';
CREATE FUNCTION public.confirm_home_postcard(
  p_home_id uuid, p_user_id uuid, p_submitted_hash text, p_templates jsonb, p_validity_days integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp SET lock_timeout = '5s' AS $$
DECLARE
 v_card public."HomePostcardCode"%ROWTYPE; v_home public."Home"%ROWTYPE;
 v_occ public."HomeOccupancy"%ROWTYPE; v_claim public."HomeResidencyClaim"%ROWTYPE;
 v_template jsonb; v_status text; v_has_authorities boolean; v_existing boolean;
BEGIN
 IF p_home_id IS NULL OR p_user_id IS NULL OR p_submitted_hash IS NULL
 OR p_submitted_hash !~ '^[0-9a-f]{64}$' OR p_templates IS NULL
 OR p_validity_days IS NULL OR p_validity_days NOT BETWEEN 1 AND 3650 THEN
 RAISE EXCEPTION 'Invalid postcard confirmation' USING ERRCODE='22023'; END IF;
 -- Same per-Home lock as admission. Row locks make guesses, successful retries
 -- and occupancy/proof writes one transaction, never read-then-increment guesses.
 PERFORM pg_advisory_xact_lock(hashtextextended('home-postcard:home:' || p_home_id::text,0));
 SELECT * INTO v_home FROM public."Home" WHERE id=p_home_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NO_POSTCARD'); END IF;
 SELECT * INTO v_card FROM public."HomePostcardCode" WHERE home_id=p_home_id AND user_id=p_user_id
 AND status IN ('pending','verified','expired')
 ORDER BY (status='pending') DESC,requested_at DESC,(code_hash=p_submitted_hash) DESC,id DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NO_POSTCARD'); END IF;
 SELECT * INTO v_occ FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_user_id FOR UPDATE;
 v_existing := FOUND;
 SELECT * INTO v_claim FROM public."HomeResidencyClaim" WHERE home_id=p_home_id AND user_id=p_user_id
 ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE;
 IF v_home.security_state IN ('frozen','frozen_silent') OR v_claim.status='rejected' OR (v_existing AND (v_occ.is_active IS DISTINCT FROM true OR v_occ.end_at IS NOT NULL
 OR v_occ.access_end_at<=now() OR v_occ.access_start_at>now()
 OR v_occ.verification_status IN ('suspended','suspended_challenged','inactive','moved_out'))) THEN
 RETURN jsonb_build_object('error','ACCESS_REVOKED'); END IF;
 IF v_card.destination IS NOT NULL AND v_card.destination IS DISTINCT FROM jsonb_build_object(
 'address',v_home.address,'address2',v_home.address2,'city',v_home.city,'state',v_home.state,'zipcode',v_home.zipcode) THEN
 RETURN jsonb_build_object('error','ADDRESS_CHANGED'); END IF;

 IF v_card.status='verified' THEN
  IF v_card.code_hash IS DISTINCT FROM p_submitted_hash OR NOT v_existing THEN
   RETURN jsonb_build_object('error','NO_POSTCARD');
  END IF;
  -- A retry observes current access; it never restores a removed row, resets a
  -- challenge clock, extends verification age, or re-grants privileges.
  RETURN jsonb_build_object('reused',true,'postcard_id',v_card.id,'occupancy',to_jsonb(v_occ));
 END IF;
 IF v_card.attempts>=5 THEN RETURN jsonb_build_object('error','LOCKED'); END IF;
 IF v_card.status='expired' OR v_card.expires_at<=now() THEN
  UPDATE public."HomePostcardCode" SET status='expired',updated_at=now() WHERE id=v_card.id;
  RETURN jsonb_build_object('error','EXPIRED');
 END IF;
 IF v_card.code_hash IS DISTINCT FROM p_submitted_hash THEN
  UPDATE public."HomePostcardCode" SET attempts=attempts+1,
   status=CASE WHEN attempts+1>=5 THEN 'expired' ELSE status END,updated_at=now() WHERE id=v_card.id;
  RETURN jsonb_build_object('error','WRONG_CODE','attempts_remaining',4-v_card.attempts);
 END IF;

 -- Existing verified membership is independently granted; a postcard neither
 -- promotes nor downgrades it. Pending/self-claimed owner roles are never trusted.
 IF NOT (v_existing AND v_occ.verification_status='verified') THEN
  SELECT (v_home.owner_id IS NOT NULL AND v_home.owner_id<>p_user_id)
   OR EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND owner_status='verified' AND subject_id<>p_user_id)
   OR EXISTS(SELECT FROM public."HomeOccupancy" WHERE home_id=p_home_id AND is_active=true
   AND user_id<>p_user_id AND role_base IN ('owner','admin','manager')) INTO v_has_authorities;
  v_status := CASE WHEN v_has_authorities THEN 'provisional' ELSE 'verified' END;
  v_template := p_templates->CASE WHEN v_has_authorities THEN 'provisional'
   WHEN v_occ.age_band='child' THEN 'child' WHEN v_occ.age_band='teen' THEN 'teen' ELSE 'adult' END;
  -- Templates originate in applyOccupancyTemplate(dryRun), the shared IAM
  -- policy. This transaction additionally caps every mail grant at member.
  IF v_template IS NULL OR v_template->>'role_base' IS DISTINCT FROM
   (CASE WHEN v_has_authorities THEN 'restricted_member' ELSE 'member' END)
   OR (v_template->>'can_manage_home')::boolean IS DISTINCT FROM false
   OR (v_template->>'can_manage_access')::boolean IS DISTINCT FROM false
   OR (v_template->>'can_manage_finance')::boolean IS DISTINCT FROM false
   OR (v_template->>'can_manage_tasks')::boolean IS NULL OR (v_template->>'can_view_sensitive')::boolean IS NULL
   OR (v_has_authorities AND ((v_template->>'can_manage_tasks')::boolean OR (v_template->>'can_view_sensitive')::boolean))
   OR (v_occ.age_band IN ('child','teen') AND (v_template->>'can_view_sensitive')::boolean) THEN
   RAISE EXCEPTION 'Invalid postcard occupancy template' USING ERRCODE='22023';
  END IF;
  INSERT INTO public."HomeOccupancy" (home_id,user_id,role,role_base,is_active,verification_status,
    can_manage_home,can_manage_access,can_manage_finance,can_manage_tasks,can_view_sensitive,
    verified_at,verification_expires_at,challenge_window_started_at,challenge_window_ends_at)
   VALUES (p_home_id,p_user_id,'member',(v_template->>'role_base')::public.home_role_base,true,v_status,
    false,false,false,(v_template->>'can_manage_tasks')::boolean,(v_template->>'can_view_sensitive')::boolean,
    CASE WHEN NOT v_has_authorities THEN now() END,
    CASE WHEN NOT v_has_authorities THEN now()+p_validity_days*interval '1 day' END,
    CASE WHEN v_has_authorities THEN now() END,CASE WHEN v_has_authorities THEN now()+interval '7 days' END)
   ON CONFLICT (home_id,user_id) DO UPDATE SET role=excluded.role,role_base=excluded.role_base,
    verification_status=excluded.verification_status,can_manage_home=false,can_manage_access=false,can_manage_finance=false,
    can_manage_tasks=excluded.can_manage_tasks,can_view_sensitive=excluded.can_view_sensitive,
    verified_at=excluded.verified_at,verification_expires_at=excluded.verification_expires_at,
    challenge_window_started_at=excluded.challenge_window_started_at,challenge_window_ends_at=excluded.challenge_window_ends_at,
    updated_at=now()
   RETURNING * INTO v_occ;
 END IF;
 UPDATE public."HomePostcardCode" SET status='verified',verified_at=now(),attempts=attempts+1,updated_at=now() WHERE id=v_card.id;
 IF v_claim.id IS NOT NULL AND v_claim.status='pending' THEN
  UPDATE public."HomeResidencyClaim" SET status='verified',review_note='Verified via postcard code',reviewed_at=now(),updated_at=now()
   WHERE id=v_claim.id;
 END IF;
 IF v_occ.verification_status='verified' THEN
  UPDATE public."Home" SET vacancy_at=NULL,updated_at=now() WHERE id=p_home_id AND vacancy_at IS NOT NULL;
 END IF;
 INSERT INTO public."HomeAuditLog" (home_id,actor_user_id,action,target_type,target_id,metadata)
  VALUES (p_home_id,p_user_id,'POSTCARD_CODE_VERIFIED','HomePostcardCode',v_card.id,
   jsonb_build_object('verification_status',v_occ.verification_status,'role_base',v_occ.role_base,
    'challenge_window',v_occ.challenge_window_ends_at));
 RETURN jsonb_build_object('reused',false,'postcard_id',v_card.id,'occupancy',to_jsonb(v_occ));
END $$;
REVOKE ALL ON FUNCTION public.confirm_home_postcard(uuid,uuid,text,jsonb,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_home_postcard(uuid,uuid,text,jsonb,integer) TO service_role;
