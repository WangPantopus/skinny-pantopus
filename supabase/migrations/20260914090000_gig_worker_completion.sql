-- Backwards compatible: yes. One service-only RPC becomes active when the
-- existing backend adopts it. No table, column, trigger or historical rewrite.
-- Existing confirm_gig_completion handles owner capture/counters; it cannot
-- atomically save the separate worker proof and owner notice before confirmation.
SET LOCAL lock_timeout='5s';

CREATE FUNCTION public.mark_gig_completed(p_gig_id uuid,p_actor_id uuid,p_expected jsonb,p_proof jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE g public."Gig"%ROWTYPE; n public."Notification"%ROWTYPE; recipient uuid;
 notices jsonb:='[]'::jsonb; event_id uuid:=gen_random_uuid(); worker_name text;
BEGIN
 SELECT * INTO g FROM public."Gig" WHERE id=p_gig_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 IF p_actor_id IS NULL OR g.accepted_by IS DISTINCT FROM p_actor_id THEN
  RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
 IF p_expected IS NULL OR NOT (p_expected ?& ARRAY['user_id','accepted_by','price','payment_id','accepted_at','started_at'])
  OR ROW(g.user_id,g.accepted_by,g.price,g.payment_id,g.accepted_at,g.started_at) IS DISTINCT FROM
   ROW((p_expected->>'user_id')::uuid,(p_expected->>'accepted_by')::uuid,(p_expected->>'price')::numeric,
    (p_expected->>'payment_id')::uuid,(p_expected->>'accepted_at')::timestamptz,(p_expected->>'started_at')::timestamptz) THEN
  RETURN jsonb_build_object('error','COMPLETION_CHANGED'); END IF;
 IF jsonb_typeof(p_proof) IS DISTINCT FROM 'object'
  OR NOT (p_proof ?& ARRAY['completion_note','completion_photos','completion_checklist'])
  OR EXISTS(SELECT FROM jsonb_object_keys(p_proof) k WHERE k NOT IN ('completion_note','completion_photos','completion_checklist'))
  OR jsonb_typeof(p_proof->'completion_note') NOT IN ('string','null')
  OR length(coalesce(p_proof->>'completion_note',''))>2000
  OR jsonb_typeof(p_proof->'completion_photos') IS DISTINCT FROM 'array'
  OR jsonb_typeof(p_proof->'completion_checklist') IS DISTINCT FROM 'array' THEN
  RETURN jsonb_build_object('error','INVALID_COMPLETION_PROOF'); END IF;
 IF jsonb_array_length(p_proof->'completion_photos')>10 OR jsonb_array_length(p_proof->'completion_checklist')>20
  OR EXISTS(SELECT FROM jsonb_array_elements(p_proof->'completion_photos') v WHERE jsonb_typeof(v)<>'string')
  OR EXISTS(SELECT FROM jsonb_array_elements(p_proof->'completion_checklist') v
   WHERE jsonb_typeof(v)<>'object' OR jsonb_typeof(v->'item') IS DISTINCT FROM 'string') THEN
  RETURN jsonb_build_object('error','INVALID_COMPLETION_PROOF'); END IF;
 -- Recover exactly the stored receipt; do not reset or recreate user notices.
 IF g.status='completed' AND g.worker_completed_at IS NOT NULL AND isfinite(g.worker_completed_at)
  AND g.completion_note IS NOT DISTINCT FROM p_proof->>'completion_note'
  AND to_jsonb(coalesce(g.completion_photos,'{}'::text[]))=p_proof->'completion_photos'
  AND coalesce(g.completion_checklist,'[]'::jsonb)=p_proof->'completion_checklist' THEN
  RETURN jsonb_build_object('gig',to_jsonb(g),'notifications','[]'::jsonb,'reused',true); END IF;
 IF g.status IS DISTINCT FROM 'in_progress' OR g.worker_completed_at IS NOT NULL OR g.owner_confirmed_at IS NOT NULL THEN
  RETURN jsonb_build_object('error','COMPLETION_CHANGED'); END IF;
 UPDATE public."Gig" SET status='completed',worker_completed_at=clock_timestamp(),updated_at=clock_timestamp(),
  completion_note=p_proof->>'completion_note',
  completion_photos=ARRAY(SELECT jsonb_array_elements_text(p_proof->'completion_photos')),
  completion_checklist=p_proof->'completion_checklist' WHERE id=g.id RETURNING * INTO g;
 SELECT coalesce(nullif(name,''),nullif(username,''),'The worker') INTO worker_name FROM public."User" WHERE id=p_actor_id;
 FOR recipient IN
  SELECT owner_id FROM (
   SELECT g.user_id AS owner_id
   UNION
   SELECT t.user_id FROM public."BusinessTeam" t JOIN public."User" u ON u.id=t.business_user_id
   WHERE t.business_user_id=g.user_id AND u.account_type='business' AND t.is_active=true
    AND (public.business_has_permission(g.user_id,'gigs.manage'::public.business_permission,t.user_id)
     OR public.business_has_permission(g.user_id,'gigs.post'::public.business_permission,t.user_id))
  ) owners WHERE owner_id<>p_actor_id ORDER BY owner_id
 LOOP
  INSERT INTO public."Notification"(user_id,type,title,body,icon,link,metadata,context_type,context,idempotency_key)
  VALUES(recipient,'gig_completed',left('"'||coalesce(nullif(g.title,''),'Your gig')||'" marked as completed',255),
   coalesce(worker_name,'The worker')||' marked the gig as done'||
    CASE WHEN cardinality(g.completion_photos)>0 OR coalesce(g.completion_note,'')<>'' THEN ' with proof attached' ELSE '' END||
    '. Please review and confirm completion.','✅','/gigs/'||g.id,
   jsonb_build_object('gig_id',g.id,'has_photos',cardinality(g.completion_photos)>0,'has_note',coalesce(g.completion_note,'')<>''),
   'personal','personal','gig-worker-completion:'||event_id||':'||recipient) RETURNING * INTO n;
  notices:=notices||jsonb_build_array(to_jsonb(n));
 END LOOP;
 RETURN jsonb_build_object('gig',to_jsonb(g),'notifications',notices,'reused',false);
END $$;
REVOKE ALL ON FUNCTION public.mark_gig_completed(uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mark_gig_completed(uuid,uuid,jsonb,jsonb) TO service_role;
