-- Backwards compatible: additive service-only confirmation. No historical rows
-- are rewritten. Deploy with the matching backend; missing RPC must fail closed.
SET LOCAL lock_timeout='5s';
CREATE FUNCTION public.mail_address_text_key(p_value text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT upper(regexp_replace(btrim(normalize(coalesce(p_value,''),NFKC)),'[[:space:]]+',' ','g'))
$$;
CREATE FUNCTION public.mail_address_unit_key(p_value text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT regexp_replace(public.mail_address_text_key(p_value),'^(APARTMENT |APT\.? |UNIT |# *)','')
$$;
CREATE FUNCTION public.confirm_mail_verification(
 p_attempt_id uuid,p_user_id uuid,p_submitted_hash text,p_templates jsonb,p_validity_days integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE
 a public."AddressVerificationAttempt"%ROWTYPE; t public."AddressVerificationToken"%ROWTYPE;
 j public."MailVerificationJob"%ROWTYPE; adr public."HomeAddress"%ROWTYPE;
 h public."Home"%ROWTYPE; o public."HomeOccupancy"%ROWTYPE; c public."AddressClaim"%ROWTYPE;
 d jsonb; current_d jsonb; ids uuid[]; selected_home_id uuid; unit_key text; template jsonb;
 existing boolean; already_consumed boolean; has_destination boolean;
BEGIN
 IF p_attempt_id IS NULL OR p_user_id IS NULL OR p_submitted_hash IS NULL
 OR p_submitted_hash !~ '^[0-9a-f]{64}$' OR p_templates IS NULL
 OR p_validity_days IS NULL OR p_validity_days NOT BETWEEN 1 AND 3650 THEN
  RAISE EXCEPTION 'Invalid mail confirmation' USING ERRCODE='22023';
 END IF;
 SELECT * INTO a FROM public."AddressVerificationAttempt"
  WHERE id=p_attempt_id AND user_id=p_user_id AND method='mail_code' FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 IF a.status='locked' THEN RETURN jsonb_build_object('error','LOCKED'); END IF;
 IF a.status='expired' THEN RETURN jsonb_build_object('error','EXPIRED'); END IF;
 IF a.status NOT IN ('created','sent','delivered_unknown','verified') THEN RETURN jsonb_build_object('error','INACTIVE'); END IF;
 SELECT * INTO t FROM public."AddressVerificationToken" WHERE attempt_id=a.id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 already_consumed := a.status='verified' AND t.used_at IS NOT NULL;
 IF NOT already_consumed AND (t.used_at IS NOT NULL OR a.status='verified') THEN
  RETURN jsonb_build_object('error','INCONSISTENT_PROOF');
 END IF;
 IF NOT already_consumed AND t.attempt_count>=t.max_attempts THEN
  UPDATE public."AddressVerificationAttempt" SET status='locked',updated_at=now() WHERE id=a.id;
  RETURN jsonb_build_object('error','LOCKED');
 END IF;
 IF NOT already_consumed AND a.expires_at<=now() THEN
  UPDATE public."AddressVerificationAttempt" SET status='expired',updated_at=now() WHERE id=a.id;
  RETURN jsonb_build_object('error','EXPIRED');
 END IF;
 IF t.code_hash IS DISTINCT FROM p_submitted_hash THEN
  IF already_consumed THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
  IF a.expires_at<=now() THEN
   UPDATE public."AddressVerificationAttempt" SET status='expired',updated_at=now() WHERE id=a.id;
   RETURN jsonb_build_object('error','EXPIRED');
  END IF;
  UPDATE public."AddressVerificationToken" SET attempt_count=attempt_count+1 WHERE id=t.id;
  IF t.attempt_count+1>=t.max_attempts THEN
   UPDATE public."AddressVerificationAttempt" SET status='locked',updated_at=now() WHERE id=a.id;
   RETURN jsonb_build_object('error','LOCKED');
  END IF;
  RETURN jsonb_build_object('error','WRONG_CODE','attempts_remaining',t.max_attempts-t.attempt_count-1);
 END IF;
 SELECT * INTO j FROM public."MailVerificationJob" WHERE attempt_id=a.id
  ORDER BY coalesce((metadata->>'resend_number')::integer,0) DESC,created_at DESC,id DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 -- A completed retry only observes its original membership. Legacy consumed
 -- proofs without completion metadata can recover only before proof expiry.
 IF a.expires_at<=now() AND (NOT already_consumed OR j.metadata->>'confirmed_occupancy_id' IS NULL) THEN
  IF NOT already_consumed THEN UPDATE public."AddressVerificationAttempt" SET status='expired',updated_at=now() WHERE id=a.id; END IF;
  RETURN jsonb_build_object('error','EXPIRED');
 END IF;
 SELECT * INTO adr FROM public."HomeAddress" WHERE id=a.address_id FOR SHARE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','ADDRESS_CHANGED'); END IF;
 IF nullif(btrim(adr.address_line2_norm),'') IS NOT NULL AND nullif(btrim(j.metadata->>'unit'),'') IS NOT NULL
 AND public.mail_address_unit_key(adr.address_line2_norm)<>public.mail_address_unit_key(j.metadata->>'unit') THEN
  RETURN jsonb_build_object('error','ADDRESS_CHANGED');
 END IF;
 current_d:=jsonb_build_object('line1',adr.address_line1_norm,
  'line2',coalesce(nullif(btrim(adr.address_line2_norm),''),nullif(btrim(j.metadata->>'unit'),'')),
  'city',adr.city_norm,'state',adr.state,'zip',adr.postal_code);
 has_destination:=jsonb_typeof(j.metadata->'destination')='object';
 IF has_destination THEN d:=j.metadata->'destination';
 ELSIF current_d->>'line2' IS NULL AND adr.building_type IS DISTINCT FROM 'multi_unit'
 AND adr.missing_secondary_flag IS DISTINCT FROM true THEN d:=current_d;
 ELSE RETURN jsonb_build_object('error','UNBOUND_DESTINATION'); END IF;
 IF EXISTS(SELECT FROM unnest(ARRAY['line1','city','state','zip']) k
  WHERE public.mail_address_text_key(d->>k)<>public.mail_address_text_key(current_d->>k))
 OR public.mail_address_unit_key(d->>'line2')<>public.mail_address_unit_key(current_d->>'line2') THEN
  RETURN jsonb_build_object('error','ADDRESS_CHANGED');
 END IF;
 IF has_destination IS DISTINCT FROM true AND (SELECT count(*) FROM public."Home" WHERE address_id=a.address_id)<>1 THEN
  RETURN jsonb_build_object('error','UNBOUND_DESTINATION');
 END IF;
 unit_key:=public.mail_address_unit_key(d->>'line2');
 SELECT array_agg(id ORDER BY id) INTO ids FROM public."Home"
  WHERE address_id=a.address_id
   AND public.mail_address_unit_key(coalesce(nullif(btrim(address2),''),adr.address_line2_norm))=unit_key;
 IF coalesce(cardinality(ids),0)<>1 THEN RETURN jsonb_build_object('error','AMBIGUOUS_HOME'); END IF;
 selected_home_id:=ids[1];
 -- Share the native postcard Home lock; the row lock also blocks ordinary
 -- address edits and access transitions while confirmation commits.
 PERFORM pg_advisory_xact_lock(hashtextextended('home-postcard:home:'||selected_home_id::text,0));
 SELECT * INTO h FROM public."Home" WHERE id=selected_home_id FOR UPDATE;
 IF NOT FOUND OR h.address_id IS DISTINCT FROM a.address_id
 OR public.mail_address_unit_key(coalesce(nullif(btrim(h.address2),''),adr.address_line2_norm))<>unit_key THEN
  RETURN jsonb_build_object('error','ADDRESS_CHANGED');
 END IF;
 SELECT * INTO o FROM public."HomeOccupancy" WHERE "HomeOccupancy".home_id=h.id AND user_id=p_user_id FOR UPDATE;
 existing:=FOUND;
 SELECT * INTO c FROM public."AddressClaim" WHERE user_id=p_user_id AND address_id=a.address_id
  AND public.mail_address_unit_key(coalesce(nullif(btrim(unit_number),''),adr.address_line2_norm))=unit_key
  ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE;
 IF h.security_state IN ('frozen','frozen_silent') OR c.claim_status='rejected'
 OR (existing AND (o.is_active IS DISTINCT FROM true OR o.end_at IS NOT NULL
 OR o.access_start_at>now() OR o.access_end_at<=now()
 OR o.verification_status IN ('suspended','suspended_challenged','inactive','moved_out'))) THEN
  RETURN jsonb_build_object('error','ACCESS_REVOKED');
 END IF;
 IF already_consumed AND j.metadata->>'confirmed_occupancy_id' IS NOT NULL THEN
  IF NOT existing OR o.verification_status IS DISTINCT FROM 'verified'
  OR o.id::text IS DISTINCT FROM j.metadata->>'confirmed_occupancy_id'
  OR h.id::text IS DISTINCT FROM j.metadata->>'confirmed_home_id' THEN
   RETURN jsonb_build_object('error','ACCESS_REVOKED');
  END IF;
  RETURN jsonb_build_object('reused',true,'occupancy',to_jsonb(o));
 END IF;
 -- Admission sends occupied households to their existing residents. Recheck
 -- here if another resident/authority arrived after the postcard was sent.
 IF NOT (existing AND o.verification_status='verified') THEN
  IF (h.owner_id IS NOT NULL AND h.owner_id<>p_user_id)
  OR EXISTS(SELECT FROM public."HomeOwner" WHERE "HomeOwner".home_id=h.id AND owner_status='verified' AND subject_id<>p_user_id)
  OR EXISTS(SELECT FROM public."HomeOccupancy" WHERE "HomeOccupancy".home_id=h.id AND user_id<>p_user_id AND is_active=true) THEN
   RETURN jsonb_build_object('error','HOME_OCCUPIED');
  END IF;
  template:=p_templates->CASE WHEN o.age_band='child' THEN 'child' WHEN o.age_band='teen' THEN 'teen' ELSE 'adult' END;
  IF template IS NULL OR template->>'role_base' IS DISTINCT FROM 'member'
  OR (template->>'can_manage_home')::boolean IS DISTINCT FROM false
  OR (template->>'can_manage_access')::boolean IS DISTINCT FROM false
  OR (template->>'can_manage_finance')::boolean IS DISTINCT FROM false
  OR (template->>'can_manage_tasks')::boolean IS NULL OR (template->>'can_view_sensitive')::boolean IS NULL
  OR (o.age_band IN ('child','teen') AND (template->>'can_view_sensitive')::boolean) THEN
   RAISE EXCEPTION 'Invalid mail membership template' USING ERRCODE='22023';
  END IF;
  INSERT INTO public."HomeOccupancy" (home_id,user_id,role,role_base,is_active,verification_status,
   can_manage_home,can_manage_access,can_manage_finance,can_manage_tasks,can_view_sensitive,verified_at,verification_expires_at)
  VALUES (h.id,p_user_id,'member','member',true,'verified',false,false,false,
   (template->>'can_manage_tasks')::boolean,(template->>'can_view_sensitive')::boolean,now(),now()+p_validity_days*interval '1 day')
  ON CONFLICT (home_id,user_id) DO UPDATE SET
   role=excluded.role,role_base=excluded.role_base,verification_status=excluded.verification_status,
   can_manage_home=false,can_manage_access=false,can_manage_finance=false,
   can_manage_tasks=excluded.can_manage_tasks,can_view_sensitive=excluded.can_view_sensitive,
   verified_at=excluded.verified_at,verification_expires_at=excluded.verification_expires_at,updated_at=now()
  RETURNING * INTO o;
 END IF;
 UPDATE public."AddressVerificationAttempt" SET status='verified',updated_at=now() WHERE id=a.id;
 UPDATE public."AddressVerificationToken" SET used_at=coalesce(used_at,now()),
  attempt_count=attempt_count+CASE WHEN already_consumed THEN 0 ELSE 1 END WHERE id=t.id;
 UPDATE public."AddressClaim" SET claim_status='verified',verification_method='mail_code',updated_at=now()
  WHERE user_id=p_user_id AND address_id=a.address_id AND claim_status='pending'
  AND public.mail_address_unit_key(coalesce(nullif(btrim(unit_number),''),adr.address_line2_norm))=unit_key;
 UPDATE public."MailVerificationJob" SET metadata=metadata||jsonb_build_object('confirmed_home_id',h.id,'confirmed_occupancy_id',o.id),updated_at=now() WHERE id=j.id;
 UPDATE public."Home" SET vacancy_at=NULL,updated_at=now() WHERE id=h.id AND vacancy_at IS NOT NULL;
 INSERT INTO public."HomeAuditLog" (home_id,actor_user_id,action,target_type,target_id,metadata)
  VALUES(h.id,p_user_id,'MAIL_CODE_VERIFIED','AddressVerificationAttempt',a.id,
   jsonb_build_object('verification_status',o.verification_status,'role_base',o.role_base));
 RETURN jsonb_build_object('reused',false,'occupancy',to_jsonb(o));
END $$;
REVOKE ALL ON FUNCTION public.mail_address_text_key(text),public.mail_address_unit_key(text),public.confirm_mail_verification(uuid,uuid,text,jsonb,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mail_address_text_key(text),public.mail_address_unit_key(text),public.confirm_mail_verification(uuid,uuid,text,jsonb,integer) TO service_role;
