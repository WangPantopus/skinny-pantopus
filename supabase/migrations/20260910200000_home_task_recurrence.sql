-- Backwards compatible: yes. Saved RRULEs remain inert. Only an explicit,
-- versioned start command enables this new schedule; no historical backfill.
SET LOCAL lock_timeout='5s';

CREATE TABLE public."HomeTaskRecurrence" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id uuid NOT NULL REFERENCES public."Home"(id) ON DELETE CASCADE,
  source_task_id uuid NOT NULL UNIQUE,
  actor_user_id uuid NOT NULL,
  private_setup boolean NOT NULL,
  revision bigint NOT NULL CHECK(revision>0),
  state text NOT NULL CHECK(state IN ('active','paused','needs_review')),
  reason text,
  frequency text NOT NULL CHECK(frequency IN ('DAILY','WEEKLY','MONTHLY')),
  step integer NOT NULL CHECK(step BETWEEN 1 AND 365),
  timezone text NOT NULL,
  anchor_at timestamptz NOT NULL CHECK(isfinite(anchor_at)),
  source_hash text NOT NULL CHECK(source_hash ~ '^[a-f0-9]{64}$'),
  next_due_at timestamptz,
  last_due_at timestamptz,
  last_task_id uuid,
  generated_count bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK(state<>'active' OR next_due_at IS NOT NULL)
);
CREATE INDEX home_task_recurrence_due ON public."HomeTaskRecurrence"(next_due_at,id) WHERE state='active';
CREATE TABLE public."HomeTaskRecurrenceCommand" (
  home_id uuid NOT NULL REFERENCES public."Home"(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL,
  request_id uuid NOT NULL,
  source_task_id uuid NOT NULL,
  private_setup boolean NOT NULL,
  request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
  action text NOT NULL CHECK(action IN ('start','pause')),
  revision bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(home_id,actor_user_id,request_id)
);
ALTER TABLE public."HomeTaskRecurrence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HomeTaskRecurrenceCommand" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."HomeTaskRecurrence",public."HomeTaskRecurrenceCommand" FROM PUBLIC,anon,authenticated;
GRANT ALL ON public."HomeTaskRecurrence",public."HomeTaskRecurrenceCommand" TO service_role;

-- Due dates keep their local wall time. PostgreSQL resolves nonexistent spring
-- times forward and ambiguous autumn times to standard time. Monthly dates
-- absent from a month are skipped, never clamped into another calendar day.
-- The source task is occurrence zero; it is never generated again.
CREATE FUNCTION public.home_task_recurrence_window(p_anchor timestamptz,p_timezone text,
  p_frequency text,p_step integer,p_at timestamptz)
RETURNS TABLE(previous_due timestamptz,next_due timestamptz)
LANGUAGE plpgsql STABLE SET search_path=public,pg_temp AS $$
DECLARE a timestamp; z timestamp; estimate integer; candidate timestamp; due timestamptz;
BEGIN
  IF p_anchor IS NULL OR NOT isfinite(p_anchor) OR p_at IS NULL OR NOT isfinite(p_at)
    OR p_step IS NULL OR p_step NOT BETWEEN 1 AND 365
    OR p_frequency IS NULL OR p_frequency NOT IN ('DAILY','WEEKLY','MONTHLY')
    OR p_timezone IS NULL OR NOT EXISTS(SELECT FROM pg_timezone_names WHERE name=p_timezone)
    OR extract(year FROM p_anchor) NOT BETWEEN 1900 AND 2100
    OR extract(year FROM p_at) NOT BETWEEN 1900 AND 2100 THEN
    RAISE EXCEPTION 'Invalid Home recurrence dates' USING ERRCODE='22023'; END IF;
  a:=p_anchor AT TIME ZONE p_timezone; z:=p_at AT TIME ZONE p_timezone;
  estimate:=CASE p_frequency WHEN 'MONTHLY' THEN
    floor(((extract(year FROM z)-extract(year FROM a))*12+extract(month FROM z)-extract(month FROM a))/p_step)
    ELSE floor((z::date-a::date)::numeric/(p_step*CASE p_frequency WHEN 'WEEKLY' THEN 7 ELSE 1 END)) END;
  previous_due:=NULL; next_due:=NULL;
  -- At most 33 candidates, including leap-day monthly intervals. No unbounded
  -- RRULE expansion or loop proportional to the age of a saved task.
  FOR n IN greatest(1,estimate-16)..greatest(17,estimate+16) LOOP
    candidate:=CASE p_frequency WHEN 'MONTHLY' THEN a+make_interval(months=>n*p_step)
      WHEN 'WEEKLY' THEN a+make_interval(days=>n*p_step*7) ELSE a+make_interval(days=>n*p_step) END;
    IF p_frequency='MONTHLY' AND extract(day FROM candidate)<>extract(day FROM a) THEN CONTINUE; END IF;
    due:=candidate AT TIME ZONE p_timezone;
    IF due<=p_at THEN previous_due:=due;
    ELSE next_due:=due; EXIT; END IF;
  END LOOP;
  IF next_due IS NULL THEN RAISE EXCEPTION 'Home recurrence has no next date' USING ERRCODE='22023'; END IF;
  RETURN NEXT;
END $$;

CREATE FUNCTION public.home_task_recurrence_source_hash(t public."HomeTask") RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
  SELECT encode(sha256(convert_to(((to_jsonb(t)-ARRAY['id','home_id','created_at','updated_at','completed_at','status','due_at'])
    ||jsonb_build_object('due_epoch',extract(epoch FROM t.due_at)))::text,'UTF8')),'hex')
$$;

CREATE FUNCTION public.get_home_task_recurrence(p_home_id uuid,p_actor_id uuid,p_task_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE r jsonb; s public."HomeTaskRecurrence"; t public."HomeTask"; config jsonb;
BEGIN
  r:=public.get_home_records(p_home_id,p_actor_id,'task',p_task_id);
  IF r->>'ok' IS DISTINCT FROM 'true' THEN RETURN r; END IF;
  SELECT * INTO t FROM public."HomeTask" WHERE id=p_task_id AND home_id=p_home_id;
  SELECT * INTO s FROM public."HomeTaskRecurrence" WHERE source_task_id=p_task_id AND home_id=p_home_id;
  IF FOUND THEN
    config:=jsonb_build_object('id',s.id,'revision',s.revision,'state',s.state,'reason',s.reason,
      'frequency',s.frequency,'interval',s.step,'timezone',s.timezone,'anchor_at',s.anchor_at,
      'next_due_at',s.next_due_at,'last_due_at',s.last_due_at,'last_task_id',s.last_task_id,'generated_count',s.generated_count);
    IF s.state='active' AND (t.status='canceled' OR public.home_task_recurrence_source_hash(t)<>s.source_hash) THEN
      config:=config||'{"state":"needs_review","reason":"source_changed","next_due_at":null}'::jsonb;
    END IF;
  END IF;
  RETURN jsonb_build_object('ok',true,'home_id',p_home_id,'task_id',p_task_id,
    'can_manage',r->'records'->0->'capabilities'->'can_edit','task_updated_at',t.updated_at,
    'configuration',config,'revision',coalesce(s.revision,0));
END $$;

CREATE FUNCTION public.set_home_task_recurrence(p_home_id uuid,p_actor_id uuid,p_task_id uuid,
  p_request_id uuid,p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE r jsonb; c jsonb; s public."HomeTaskRecurrence"; t public."HomeTask";
  receipt public."HomeTaskRecurrenceCommand"; h text; action text; next_at timestamptz; old_revision bigint;
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL OR p_task_id IS NULL OR p_request_id IS NULL
    OR jsonb_typeof(p_command) IS DISTINCT FROM 'object'
    OR EXISTS(SELECT FROM jsonb_object_keys(p_command) k WHERE k NOT IN
      ('action','expected_revision','expected_task_updated_at','frequency','interval','timezone'))
    OR p_command->>'action' IS NULL OR p_command->>'action' NOT IN ('start','pause')
    OR jsonb_typeof(p_command->'expected_revision') IS DISTINCT FROM 'number'
    OR (p_command->>'expected_revision') !~ '^[0-9]{1,15}$' THEN
    RETURN '{"ok":false,"code":"HOME_RECORD_INVALID","status":400}'::jsonb; END IF;
  action:=p_command->>'action';
  IF action='pause' AND EXISTS(SELECT FROM jsonb_object_keys(p_command) k WHERE k NOT IN ('action','expected_revision')) THEN
    RETURN '{"ok":false,"code":"HOME_RECORD_INVALID","status":400}'::jsonb; END IF;
  r:=public.get_home_task_recurrence(p_home_id,p_actor_id,p_task_id);
  IF r->>'ok' IS DISTINCT FROM 'true' THEN RETURN r; END IF;
  IF r->>'can_manage' IS DISTINCT FROM 'true' THEN
    RETURN '{"ok":false,"code":"HOME_RECORD_WRITE_DENIED","status":403}'::jsonb; END IF;
  -- get_home_records already acquired Home/authority -> source-Mail -> task.
  SELECT * INTO t FROM public."HomeTask" WHERE id=p_task_id AND home_id=p_home_id FOR UPDATE;
  SELECT * INTO s FROM public."HomeTaskRecurrence" WHERE source_task_id=p_task_id AND home_id=p_home_id FOR UPDATE;
  old_revision:=coalesce(s.revision,0);
  c:=public.home_record_context(p_home_id,p_actor_id);
  h:=encode(sha256(convert_to(jsonb_build_object('task_id',p_task_id,'command',p_command)::text,'UTF8')),'hex');
  SELECT * INTO receipt FROM public."HomeTaskRecurrenceCommand" WHERE home_id=p_home_id
    AND actor_user_id=p_actor_id AND request_id=p_request_id FOR UPDATE;
  IF FOUND THEN
    IF receipt.request_hash<>h THEN RETURN '{"ok":false,"code":"HOME_TASK_RECURRENCE_CONFLICT","status":409}'::jsonb; END IF;
    -- A replay proves the old operation; it NEVER reapplies it over a later pause.
    RETURN r||jsonb_build_object('replayed',true,'receipt',jsonb_build_object('request_id',p_request_id,
      'actor_id',p_actor_id,'home_id',p_home_id,'task_id',p_task_id,'action',receipt.action,
      'revision',receipt.revision,'request_hash',receipt.request_hash,'created_at',receipt.created_at));
  END IF;
  IF (p_command->>'expected_revision')::bigint<>old_revision THEN
    RETURN '{"ok":false,"code":"HOME_TASK_RECURRENCE_STALE","status":409}'::jsonb; END IF;
  IF action='start' THEN
    IF jsonb_typeof(p_command->'expected_task_updated_at') IS DISTINCT FROM 'string'
      OR (p_command->>'expected_task_updated_at')::timestamptz IS DISTINCT FROM t.updated_at THEN
      RETURN '{"ok":false,"code":"HOME_TASK_RECURRENCE_STALE","status":409}'::jsonb; END IF;
    IF t.due_at IS NULL OR t.status='canceled' OR t.source_mail_id IS NOT NULL OR t.mail_id IS NOT NULL
      OR t.linked_gig_id IS NOT NULL OR t.converted_to_gig_id IS NOT NULL
      OR t.details ?| ARRAY['source','sourceMailId','source_mail_id','sourceMailType','sourceObjectId']
      OR jsonb_typeof(p_command->'interval') IS DISTINCT FROM 'number'
      OR (p_command->>'interval') !~ '^[0-9]{1,3}$' THEN
      RETURN '{"ok":false,"code":"HOME_RECORD_INVALID","status":400}'::jsonb; END IF;
    SELECT w.next_due INTO next_at FROM public.home_task_recurrence_window(t.due_at,p_command->>'timezone',
      p_command->>'frequency',(p_command->>'interval')::integer,clock_timestamp()) w;
    INSERT INTO public."HomeTaskRecurrence"(home_id,source_task_id,actor_user_id,private_setup,revision,state,
      frequency,step,timezone,anchor_at,source_hash,next_due_at)
      VALUES(p_home_id,p_task_id,p_actor_id,c->>'private'='true',old_revision+1,'active',p_command->>'frequency',
        (p_command->>'interval')::integer,p_command->>'timezone',t.due_at,public.home_task_recurrence_source_hash(t),next_at)
      ON CONFLICT(source_task_id) DO UPDATE SET actor_user_id=excluded.actor_user_id,private_setup=excluded.private_setup,
        revision=excluded.revision,state='active',reason=NULL,frequency=excluded.frequency,step=excluded.step,
        timezone=excluded.timezone,anchor_at=excluded.anchor_at,source_hash=excluded.source_hash,
        next_due_at=excluded.next_due_at,updated_at=clock_timestamp();
  ELSIF s.id IS NOT NULL THEN
    UPDATE public."HomeTaskRecurrence" SET state='paused',reason=NULL,next_due_at=NULL,
      revision=revision+1,updated_at=clock_timestamp() WHERE id=s.id;
  END IF;
  r:=public.get_home_task_recurrence(p_home_id,p_actor_id,p_task_id);
  INSERT INTO public."HomeTaskRecurrenceCommand"(home_id,actor_user_id,request_id,source_task_id,private_setup,request_hash,action,revision)
    VALUES(p_home_id,p_actor_id,p_request_id,p_task_id,c->>'private'='true',h,action,(r->>'revision')::bigint) RETURNING * INTO receipt;
  r:=public.get_home_task_recurrence(p_home_id,p_actor_id,p_task_id);
  IF r->>'ok' IS DISTINCT FROM 'true' OR r->>'can_manage' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Home recurrence authority changed' USING ERRCODE='40001'; END IF;
  RETURN r||jsonb_build_object('replayed',false,'receipt',jsonb_build_object('request_id',p_request_id,
    'actor_id',p_actor_id,'home_id',p_home_id,'task_id',p_task_id,'action',receipt.action,
    'revision',receipt.revision,'request_hash',receipt.request_hash,'created_at',receipt.created_at));
END $$;

CREATE FUNCTION public.due_home_task_recurrences(p_limit integer DEFAULT 25) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'revision',revision)),'[]'::jsonb) FROM
    (SELECT id,revision FROM public."HomeTaskRecurrence" WHERE state='active' AND next_due_at<=clock_timestamp()
      ORDER BY next_due_at,id LIMIT least(greatest(coalesce(p_limit,25),1),100)) s
$$;

CREATE FUNCTION public.generate_home_task_recurrence(p_id uuid,p_revision bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE s public."HomeTaskRecurrence"; t public."HomeTask"; r jsonb; c jsonb; v_reason text;
  due_at timestamptz; next_at timestamptz; request_id uuid; payload jsonb; v_now timestamptz;
BEGIN
  -- Unlocked routing read, then the same global lock order as task mutations.
  IF p_revision IS NULL OR p_revision<1 THEN RETURN '{"outcome":"unchanged"}'::jsonb; END IF;
  SELECT * INTO s FROM public."HomeTaskRecurrence" WHERE id=p_id;
  IF NOT FOUND THEN RETURN '{"outcome":"unchanged"}'::jsonb; END IF;
  IF NOT public.lock_home_record_scope(s.home_id) THEN RETURN '{"outcome":"unchanged"}'::jsonb; END IF;
  SELECT * INTO t FROM public."HomeTask" WHERE id=s.source_task_id AND home_id=s.home_id;
  PERFORM id FROM public."Mail" WHERE id=t.source_mail_id FOR SHARE;
  SELECT * INTO t FROM public."HomeTask" WHERE id=s.source_task_id AND home_id=s.home_id FOR UPDATE;
  SELECT * INTO s FROM public."HomeTaskRecurrence" WHERE id=p_id FOR UPDATE;
  v_now:=clock_timestamp();
  IF NOT FOUND OR s.state<>'active' OR s.revision<>p_revision OR s.next_due_at>v_now THEN
    RETURN '{"outcome":"unchanged"}'::jsonb; END IF;
  c:=public.home_record_context(s.home_id,s.actor_user_id);
  IF t.id IS NULL OR t.status='canceled' OR public.home_task_recurrence_source_hash(t)<>s.source_hash THEN v_reason:='source_changed';
  ELSIF NOT EXISTS(SELECT FROM auth.users WHERE id=s.actor_user_id AND deleted_at IS NULL
      AND (banned_until IS NULL OR banned_until<=clock_timestamp()))
    OR NOT coalesce(public.home_task_readable(t,s.actor_user_id),false)
    OR NOT coalesce(c->'permissions' ? 'tasks.manage' OR (c->'permissions' ? 'tasks.edit' AND t.created_by=s.actor_user_id),false)
    THEN v_reason:='access_changed'; END IF;
  IF v_reason IS NOT NULL THEN
    UPDATE public."HomeTaskRecurrence" SET state='needs_review',reason=v_reason,next_due_at=NULL,
      revision=revision+1,updated_at=v_now WHERE id=p_id;
    RETURN jsonb_build_object('outcome','paused','reason',v_reason);
  END IF;
  SELECT w.previous_due,w.next_due INTO due_at,next_at FROM public.home_task_recurrence_window(
    s.anchor_at,s.timezone,s.frequency,s.step,v_now) w;
  IF due_at IS NULL OR due_at<s.next_due_at THEN RAISE EXCEPTION 'Home recurrence date mismatch'; END IF;
  -- Coalesce missed dates into the latest due occurrence; advance directly to
  -- the future. The original creation receipt protects its UUID after deletion.
  request_id:=md5(s.id::text||':'||s.revision::text||':'||extract(epoch FROM due_at)::text)::uuid;
  payload:=jsonb_build_object('title',t.title,'description',t.description,'task_type',t.task_type,
    'assigned_to',t.assigned_to,'priority',t.priority,'budget',t.budget,'visibility',t.visibility,
    'viewer_user_ids',t.viewer_user_ids,'due_at',due_at,'status','open','recurrence_rule',NULL,'is_recurring',false);
  r:=public.create_home_task_with_receipt(s.home_id,s.actor_user_id,request_id,payload);
  IF r->>'ok' IS DISTINCT FROM 'true' THEN
    IF r->>'code' IN ('HOME_RECORD_DENIED','HOME_RECORD_WRITE_DENIED','HOME_RECORD_RECIPIENT_DENIED','HOME_TASK_SOURCE_DENIED') THEN
      UPDATE public."HomeTaskRecurrence" SET state='needs_review',reason='access_changed',next_due_at=NULL,
        revision=revision+1,updated_at=clock_timestamp() WHERE id=p_id;
      RETURN '{"outcome":"paused","reason":"access_changed"}'::jsonb;
    END IF;
    RAISE EXCEPTION 'Home recurrence creation unresolved' USING ERRCODE='40001';
  END IF;
  UPDATE public."HomeTaskRecurrence" SET next_due_at=next_at,last_due_at=due_at,last_task_id=(r->'record'->>'id')::uuid,
    generated_count=generated_count+1,updated_at=clock_timestamp() WHERE id=p_id;
  RETURN jsonb_build_object('outcome','generated','task_id',r->'record'->>'id','due_at',due_at,'next_due_at',next_at);
END $$;

REVOKE ALL ON FUNCTION public.home_task_recurrence_window(timestamptz,text,text,integer,timestamptz),
 public.home_task_recurrence_source_hash(public."HomeTask"),public.get_home_task_recurrence(uuid,uuid,uuid),
 public.set_home_task_recurrence(uuid,uuid,uuid,uuid,jsonb),public.due_home_task_recurrences(integer),
 public.generate_home_task_recurrence(uuid,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.home_task_recurrence_window(timestamptz,text,text,integer,timestamptz),
 public.home_task_recurrence_source_hash(public."HomeTask"),public.get_home_task_recurrence(uuid,uuid,uuid),
 public.set_home_task_recurrence(uuid,uuid,uuid,uuid,jsonb),public.due_home_task_recurrences(integer),
 public.generate_home_task_recurrence(uuid,bigint) TO service_role;

-- Review the new receipt/configuration history in both private Home policies.

CREATE OR REPLACE FUNCTION public.home_secret_context(p_home_id uuid,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_home public."Home"%ROWTYPE; v_occ public."HomeOccupancy"%ROWTYPE;
  v_access jsonb; v_role public.home_role_base; v_now timestamptz:=clock_timestamp();
  v_permissions text[]; v_denied constant jsonb:='{"allowed":false,"private":false,"permissions":[]}'::jsonb;
BEGIN
  IF p_actor_id IS NULL THEN RETURN v_denied; END IF;
  SELECT * INTO v_home FROM public."Home" WHERE id=p_home_id;
  IF NOT FOUND OR v_home.security_state IN ('frozen','frozen_silent') THEN RETURN v_denied; END IF;
  SELECT * INTO v_occ FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_actor_id;
  IF v_occ.id IS NOT NULL AND (v_occ.is_active IS DISTINCT FROM true OR v_occ.age_band IN ('child','teen')
    OR v_occ.start_at>v_now OR v_occ.end_at<=v_now OR v_occ.access_start_at>v_now OR v_occ.access_end_at<=v_now) THEN
    RETURN v_denied;
  END IF;
  v_access:=public.home_effective_access(p_home_id,p_actor_id);
  IF v_access->>'is_owner'='true' AND EXISTS (SELECT FROM public."HomeOwner" o WHERE o.home_id=p_home_id
    AND o.subject_type='user' AND o.subject_id=p_actor_id AND o.owner_status IN ('revoked','disputed'))
    AND NOT EXISTS (SELECT FROM public."HomeOwner" o WHERE o.home_id=p_home_id AND o.subject_type='user'
      AND o.subject_id=p_actor_id AND o.owner_status='verified') THEN RETURN v_denied; END IF;
  IF v_access->>'has_access'='true' THEN
    RETURN jsonb_build_object('allowed',true,'private',false,'permissions',v_access->'permissions',
      'role',v_access->>'effective_role_base');
  END IF;
  v_role:=coalesce(v_occ.role_base,CASE v_occ.role
    WHEN 'owner' THEN 'owner' WHEN 'admin' THEN 'admin' WHEN 'manager' THEN 'manager'
    WHEN 'property_manager' THEN 'manager' WHEN 'tenant' THEN 'lease_resident'
    WHEN 'renter' THEN 'lease_resident' WHEN 'lease_resident' THEN 'lease_resident'
    WHEN 'member' THEN 'member' WHEN 'roommate' THEN 'member' WHEN 'family' THEN 'member'
    WHEN 'restricted_member' THEN 'restricted_member' WHEN 'caregiver' THEN 'restricted_member'
    WHEN 'guest' THEN 'guest' WHEN 'service_provider' THEN 'service_provider' ELSE NULL END::public.home_role_base);
  IF v_home.created_by_user_id IS DISTINCT FROM p_actor_id
    OR (v_home.owner_id IS NOT NULL AND v_home.owner_id<>p_actor_id)
    OR v_occ.id IS NULL OR v_role IS NULL OR v_occ.verified_at IS NOT NULL
    OR v_occ.verification_status IS NULL OR v_occ.verification_status NOT IN ('pending_doc','provisional_bootstrap')
    OR EXISTS (SELECT FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id<>p_actor_id)
    OR EXISTS (SELECT FROM public."HomeOwner" WHERE home_id=p_home_id
      AND (subject_type<>'user' OR subject_id<>p_actor_id OR owner_status<>'pending')) THEN RETURN v_denied; END IF;
  -- Explicit private setup allowlist, separate from destructive deletion.
    IF EXISTS (SELECT FROM public."HomeOwnershipClaim" c WHERE home_id = p_home_id
        AND (claimant_user_id <> p_actor_id OR (state NOT IN ('draft','submitted')
          AND NOT public.home_claim_own_private_withdrawal(c,p_actor_id)) OR reviewed_by IS NOT NULL
          OR reviewed_at IS NOT NULL OR merged_into_claim_id IS NOT NULL))
      OR EXISTS (SELECT FROM public."HomeOwnershipClaim" foreign_claim JOIN public."HomeOwnershipClaim" own_claim
        ON foreign_claim.merged_into_claim_id = own_claim.id WHERE own_claim.home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeClaimReviewReceipt" receipt WHERE receipt.home_id=p_home_id
        AND NOT (receipt.actor_user_id=p_actor_id AND receipt.action='withdraw' AND receipt.private_setup
          AND NOT receipt.platform_admin AND EXISTS(SELECT FROM public."HomeOwnershipClaim" c
            WHERE c.id=receipt.claim_id AND c.home_id=p_home_id
              AND public.home_claim_own_private_withdrawal(c,p_actor_id))))
      OR EXISTS (SELECT FROM public."HomeTaskRecurrence" s WHERE s.home_id=p_home_id
        AND NOT (s.actor_user_id=p_actor_id AND s.private_setup))
      OR EXISTS (SELECT FROM public."HomeTaskRecurrenceCommand" s WHERE s.home_id=p_home_id
        AND NOT (s.actor_user_id=p_actor_id AND s.private_setup))
      OR EXISTS (SELECT FROM public."HomeTaskCreateReceipt" receipt WHERE receipt.home_id=p_home_id
        AND NOT (receipt.actor_user_id=p_actor_id AND receipt.private_setup))
      OR EXISTS (SELECT FROM public."HomeTaskAssignmentDelivery" d WHERE d.home_id=p_home_id)
      OR EXISTS (SELECT FROM public."HomeAuditLog" a WHERE a.home_id = p_home_id AND (
        a.actor_user_id IS DISTINCT FROM p_actor_id OR NOT coalesce(
          (a.action = 'OCCUPANCY_TEMPLATE_APPLIED' AND a.target_type = 'HomeOccupancy'
            AND a.target_id = v_occ.id
            AND a.metadata->>'verification_status' IN ('provisional_bootstrap','pending_doc'))
          OR public.home_secret_own_setup_audit(a,p_actor_id)
          OR public.home_record_own_setup_audit(a,p_actor_id)
          OR (a.action='OWNERSHIP_CLAIM_WITHDRAWN' AND a.target_type='HomeOwnershipClaim'
            AND EXISTS(SELECT FROM public."HomeOwnershipClaim" c WHERE c.id=a.target_id
              AND c.home_id=p_home_id AND public.home_claim_own_private_withdrawal(c,p_actor_id)))
          OR (a.action = 'OWNERSHIP_CLAIM_SUBMITTED' AND a.target_type = 'HomeOwnershipClaim'
            AND EXISTS (SELECT FROM public."HomeOwnershipClaim" c WHERE c.id = a.target_id
              AND c.home_id = p_home_id AND c.claimant_user_id = p_actor_id)),false)))
      OR EXISTS (SELECT FROM public."HomeAccessSecret" WHERE home_id = p_home_id AND created_by IS DISTINCT FROM p_actor_id)
      OR EXISTS (SELECT FROM public."HomePermissionOverride" WHERE home_id = p_home_id
        AND (user_id <> p_actor_id OR created_by IS DISTINCT FROM p_actor_id))
      OR EXISTS (SELECT FROM public."UnlistedRemoval" WHERE home_id = p_home_id AND user_id <> p_actor_id)
      OR EXISTS (SELECT FROM public."AddressCalendarRule" WHERE scope_type = 'home'
        AND public.home_calendar_scope_id(scope_key) = p_home_id AND created_by IS DISTINCT FROM p_actor_id)
      OR EXISTS (SELECT FROM public."HomeDocument" WHERE home_id=p_home_id)
      OR EXISTS (SELECT FROM public."CommunityMailItem" WHERE home_id=p_home_id)
      OR EXISTS (SELECT FROM public."HomeMapPin" WHERE home_id=p_home_id)
      OR EXISTS (SELECT FROM public."VacationHold" WHERE home_id=p_home_id)
      OR EXISTS (SELECT FROM public."MailDeliveryIntent" WHERE intended_home_id=p_home_id)
      OR EXISTS (SELECT FROM public."NeighborEndorsement" WHERE endorser_home_id=p_home_id)
      -- Own pending verification evidence does not confer shared-document access
      -- and does not make the creator lose access to their own Wi-Fi setup.
      OR EXISTS(SELECT FROM public."HomeClaimEvidenceIntent" i WHERE i.original_home_id=p_home_id
        AND NOT public.home_claim_evidence_own_setup(i,p_actor_id))
      OR EXISTS (SELECT FROM public."File" f WHERE f.home_id=p_home_id AND (
        f.user_id<>p_actor_id OR (NOT EXISTS (SELECT FROM public."HomeVerificationEvidence" e
          JOIN public."HomeOwnershipClaim" c ON c.id=e.claim_id WHERE c.home_id=p_home_id
            AND c.claimant_user_id=p_actor_id AND (c.state IN ('draft','submitted')
              OR public.home_claim_own_private_withdrawal(c,p_actor_id))
            AND c.reviewed_by IS NULL AND c.reviewed_at IS NULL AND e.storage_ref=f.file_path)
          AND NOT EXISTS(SELECT FROM public."HomeClaimEvidenceIntent" i WHERE i.id=f.id AND i.home_id=p_home_id
            AND f.metadata=jsonb_build_object('storage_contract','home_claim_evidence_v1','upload_id',i.id)
            AND public.home_claim_evidence_own_setup(i,p_actor_id))
          AND NOT EXISTS(SELECT FROM public."HomeTaskMediaIntent" i WHERE i.id=f.id AND i.home_id=p_home_id
            AND f.metadata=jsonb_build_object('storage_contract','home_task_media_v1','upload_id',i.id)
            AND public.home_task_media_own_setup(i,p_actor_id)))))
      OR EXISTS (SELECT FROM public."HomeVerificationEvidence" e JOIN public."HomeOwnershipClaim" c ON c.id=e.claim_id
        JOIN public."File" f ON f.file_path=e.storage_ref WHERE c.home_id=p_home_id
          AND (f.user_id<>p_actor_id OR (f.home_id IS NOT NULL AND f.home_id<>p_home_id)))
      OR EXISTS (SELECT FROM public."Activity" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."AddressReviewCase" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."AttomPropertyCache" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BlockFounder" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BlockInvite" WHERE sender_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BookingPackage" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BookingPage" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Booking" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BusinessProfileView" WHERE viewer_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."ChatRoom" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."EventType" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."FridgeCard" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeAsset" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeAuthority" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeBill" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeBusinessLink" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeCalendarEvent" e WHERE home_id = p_home_id
        AND (NOT public.home_event_private_setup(e,p_actor_id)
          OR EXISTS (SELECT FROM public."HomeCalendarEventAttendee" a WHERE a.event_id=e.id AND a.user_id<>p_actor_id)))
      OR EXISTS (SELECT FROM public."HomeDevice" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeDispute" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeEmergency" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeEstateFields" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeGuestPass" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeHouseholdAccessRequest" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeInvite" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeIssue" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeLeaseInvite" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeLease" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeMaintenanceLog" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeMaintenanceTemplate" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeMedia" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePackage" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePet" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePoll" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePostcardCode" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePrivacy" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePrivateData" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePublicData" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeQuorumAction" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeRecordWatch" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeRentReport" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeReputation" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeResidencyClaim" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeResource" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeRvStatus" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeScopedGrant" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeSeasonalChecklistItem" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeSubscription" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeSystem" WHERE home_id = p_home_id)
      OR EXISTS(SELECT FROM public."HomeTaskMediaIntent" i WHERE i.original_home_id=p_home_id
        AND NOT public.home_task_media_own_setup(i,p_actor_id))
      OR EXISTS (SELECT FROM public."HomeTaskMedia" m WHERE (home_id = p_home_id
        OR EXISTS(SELECT FROM public."HomeTask" t WHERE t.id=m.task_id AND t.home_id=p_home_id))
        AND NOT EXISTS(SELECT FROM public."HomeTaskMediaIntent" i WHERE i.id=m.private_upload_id AND i.id=m.id
          AND i.home_id=p_home_id AND i.task_id=m.task_id AND public.home_task_media_own_setup(i,p_actor_id)))
      OR EXISTS (SELECT FROM public."HomeTask" t WHERE home_id = p_home_id
        AND NOT public.home_task_private_setup(t,p_actor_id))
      OR EXISTS (SELECT FROM public."HomeVendor" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeVerification" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Home" WHERE parent_home_id = p_home_id OR canonical_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."ListingInventorySlot" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Listing" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MailAlias" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MailDayItem" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MailPartySession" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MailRoutingQueue" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Mail" WHERE address_home_id = p_home_id OR address_id = p_home_id OR recipient_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MessageTemplate" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."NeighborMessage" WHERE sender_home_id = p_home_id OR recipient_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Post" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."PropertyIntelligenceCache" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."ResidencyClaim" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."ResidencyLetter" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."SavedTaskTemplate" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."SchedulingPoll" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."SchedulingWorkflow" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."SupportTrain" WHERE recipient_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."VaultFolder" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Gig" WHERE origin_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Payment" WHERE home_id = p_home_id) THEN
      RETURN v_denied;
    END IF;
  SELECT coalesce(array_agg(p::text),'{}'::text[]) INTO v_permissions
    FROM unnest(ARRAY['access.view_wifi','access.view_codes','access.manage']::public.home_permission[]) p
    WHERE NOT EXISTS (SELECT FROM public."HomePermissionOverride" o WHERE o.home_id=p_home_id
      AND o.user_id=p_actor_id AND o.permission=p AND NOT o.allowed)
    AND NOT EXISTS (SELECT FROM public."HomeRolePermission" r WHERE r.role_base=v_role AND r.permission=p AND NOT r.allowed
      AND NOT EXISTS (SELECT FROM public."HomePermissionOverride" o WHERE o.home_id=p_home_id
        AND o.user_id=p_actor_id AND o.permission=p AND o.allowed));
  RETURN jsonb_build_object('allowed',true,'private',true,'permissions',v_permissions,'role',v_role);
END;
$$;

CREATE OR REPLACE FUNCTION public.home_delete_eligibility(p_home_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_home public."Home"%ROWTYPE; v_occ public."HomeOccupancy"%ROWTYPE;
  v_access jsonb; v_role public.home_role_base; v_primary boolean; v_private boolean := false;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_home_id IS NULL OR p_user_id IS NULL THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_ACCESS_DENIED','deleted',false);
  END IF;
  SELECT * INTO v_home FROM public."Home" WHERE id = p_home_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_NOT_FOUND','deleted',false);
  END IF;
  -- Destructive authority must not revive through an older Home.owner_id when
  -- the caller's ownership is disputed or revoked without a current verified
  -- record. Historical revoked rows may coexist with a legitimate reverified
  -- owner because the canonical uniqueness constraint excludes revoked rows.
  IF EXISTS (SELECT FROM public."HomeOwner" o WHERE o.home_id = p_home_id
    AND o.subject_type = 'user' AND o.subject_id = p_user_id
    AND (o.owner_status = 'disputed' OR (o.owner_status = 'revoked' AND NOT EXISTS (
      SELECT FROM public."HomeOwner" current_owner WHERE current_owner.home_id = p_home_id
        AND current_owner.subject_type = 'user' AND current_owner.subject_id = p_user_id
        AND current_owner.owner_status = 'verified')))) THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_ACCESS_DENIED','deleted',false);
  END IF;
  SELECT * INTO v_occ FROM public."HomeOccupancy" WHERE home_id = p_home_id AND user_id = p_user_id;
  -- This read-only RPC is VOLATILE deliberately: current time after lock waits
  -- fences an access window that ended while the transaction was waiting.
  -- Eligibility is advisory; the deletion RPC locks/rechecks before mutation.
  -- NULL age retains the existing adult compatibility.
  IF v_home.security_state IN ('frozen','frozen_silent') OR
    (v_occ.id IS NOT NULL AND (v_occ.is_active IS DISTINCT FROM true
      OR v_occ.age_band IN ('child','teen')
      OR v_occ.start_at > v_now OR v_occ.end_at <= v_now
      OR v_occ.access_start_at > v_now OR v_occ.access_end_at <= v_now)) THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_ACCESS_DENIED','deleted',false);
  END IF;
  v_primary := coalesce(v_home.owner_id = p_user_id, false) OR EXISTS (
    SELECT FROM public."HomeOwner" WHERE home_id = p_home_id AND subject_type = 'user'
      AND subject_id = p_user_id AND owner_status = 'verified' AND is_primary_owner);
  v_access := public.home_effective_access(p_home_id,p_user_id);
  IF v_primary AND coalesce((v_access->>'has_access')::boolean,false)
    AND coalesce((v_access->>'is_owner')::boolean,false) THEN
    IF NOT (v_access->'permissions' ?& ARRAY['home.edit','security.manage']) THEN
      RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_ACCESS_DENIED','deleted',false);
    END IF;
  ELSE
    -- This is removal of an exact creator's unfinished private setup. It is
    -- never generic provisional membership or authority over a household.
    v_role := coalesce(v_occ.role_base, CASE v_occ.role
      WHEN 'owner' THEN 'owner' WHEN 'admin' THEN 'admin'
      WHEN 'manager' THEN 'manager' WHEN 'property_manager' THEN 'manager'
      WHEN 'tenant' THEN 'lease_resident' WHEN 'renter' THEN 'lease_resident'
      WHEN 'lease_resident' THEN 'lease_resident' WHEN 'member' THEN 'member'
      WHEN 'roommate' THEN 'member' WHEN 'family' THEN 'member'
      WHEN 'restricted_member' THEN 'restricted_member' WHEN 'caregiver' THEN 'restricted_member'
      WHEN 'guest' THEN 'guest' WHEN 'service_provider' THEN 'service_provider'
      ELSE NULL END::public.home_role_base);
    IF v_home.created_by_user_id IS DISTINCT FROM p_user_id
      OR (v_home.owner_id IS NOT NULL AND v_home.owner_id <> p_user_id)
      OR v_occ.id IS NULL OR v_role IS NULL
      OR v_occ.verified_at IS NOT NULL
      OR v_occ.verification_status IS NULL
      OR v_occ.verification_status NOT IN ('provisional_bootstrap','pending_doc')
      OR EXISTS (SELECT FROM public."HomeOccupancy" WHERE home_id = p_home_id AND user_id <> p_user_id)
      OR EXISTS (SELECT FROM public."HomeOwner" WHERE home_id = p_home_id
        AND (subject_type <> 'user' OR subject_id <> p_user_id OR owner_status <> 'pending')) THEN
      RETURN jsonb_build_object('allowed',false,'code','DELETE_HOME_NOT_PRIMARY','deleted',false);
    END IF;
    IF EXISTS (SELECT FROM public."HomePermissionOverride" WHERE home_id = p_home_id
      AND user_id = p_user_id AND permission IN ('home.edit','security.manage') AND NOT allowed)
      OR EXISTS (SELECT FROM public."HomeRolePermission" r WHERE r.role_base = v_role
        AND r.permission IN ('home.edit','security.manage') AND NOT r.allowed
        AND NOT EXISTS (SELECT FROM public."HomePermissionOverride" o WHERE o.home_id = p_home_id
          AND o.user_id = p_user_id AND o.permission = r.permission AND o.allowed)) THEN
      RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_ACCESS_DENIED','deleted',false);
    END IF;
    v_private := true;
  END IF;

  -- Only protected task uploads have a proved retirement journey below.
  -- Documents, evidence and every legacy File remain independent blockers.
  IF EXISTS (SELECT FROM public."File" f WHERE home_id = p_home_id
    AND NOT public.home_task_media_file_bound(f))
    OR EXISTS (SELECT FROM public."HomeDocument" WHERE home_id = p_home_id)
    OR EXISTS (SELECT FROM public."HomeTaskMedia" m WHERE (home_id=p_home_id
      OR EXISTS(SELECT FROM public."HomeTask" t WHERE t.id=m.task_id AND t.home_id=p_home_id))
      AND NOT EXISTS(SELECT FROM public."HomeTaskMediaIntent" i WHERE i.id=m.id AND i.id=m.private_upload_id
        AND i.home_id=p_home_id AND i.task_id=m.task_id AND i.state='ready'))
    OR EXISTS(SELECT FROM public."HomeClaimEvidenceIntent" i WHERE i.original_home_id=p_home_id)
    OR EXISTS (SELECT FROM public."HomeVerificationEvidence" e JOIN public."HomeOwnershipClaim" c
      ON c.id = e.claim_id WHERE c.home_id = p_home_id) THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_STORAGE_CLEANUP_REQUIRED','deleted',false);
  END IF;
  IF EXISTS (SELECT FROM public."CommunityMailItem" WHERE home_id = p_home_id)
    OR EXISTS (SELECT FROM public."HomeMapPin" WHERE home_id = p_home_id)
    OR EXISTS (SELECT FROM public."VacationHold" WHERE home_id = p_home_id)
    OR EXISTS (SELECT FROM public."MailDeliveryIntent" WHERE intended_home_id = p_home_id)
    OR EXISTS (SELECT FROM public."NeighborEndorsement" WHERE endorser_home_id = p_home_id) THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_LINKED_DATA','deleted',false);
  END IF;

  IF v_private THEN
    -- Explicit setup allowlist matches POST /homes: the caller's occupancy,
    -- pending owner + unreviewed claim, its audit, preferences and own WiFi.
    -- Own Unlisted progress and pickup rules are also private first-use data.
    -- Any other relation is conservatively a household/established-data fence,
    -- even if its creator happens to be this caller. No dynamic table scan.
    IF EXISTS (SELECT FROM public."HomeOwnershipClaim" c WHERE home_id = p_home_id
        AND (claimant_user_id <> p_user_id OR (state NOT IN ('draft','submitted')
          AND NOT public.home_claim_own_private_withdrawal(c,p_user_id)) OR reviewed_by IS NOT NULL
          OR reviewed_at IS NOT NULL OR merged_into_claim_id IS NOT NULL))
      OR EXISTS (SELECT FROM public."HomeOwnershipClaim" foreign_claim JOIN public."HomeOwnershipClaim" own_claim
        ON foreign_claim.merged_into_claim_id = own_claim.id WHERE own_claim.home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeClaimReviewReceipt" receipt WHERE receipt.home_id=p_home_id
        AND NOT (receipt.actor_user_id=p_user_id AND receipt.action='withdraw' AND receipt.private_setup
          AND NOT receipt.platform_admin AND EXISTS(SELECT FROM public."HomeOwnershipClaim" c
            WHERE c.id=receipt.claim_id AND c.home_id=p_home_id
              AND public.home_claim_own_private_withdrawal(c,p_user_id))))
      OR EXISTS (SELECT FROM public."HomeTaskRecurrence" s WHERE s.home_id=p_home_id
        AND NOT (s.actor_user_id=p_user_id AND s.private_setup))
      OR EXISTS (SELECT FROM public."HomeTaskRecurrenceCommand" s WHERE s.home_id=p_home_id
        AND NOT (s.actor_user_id=p_user_id AND s.private_setup))
      OR EXISTS (SELECT FROM public."HomeTaskCreateReceipt" receipt WHERE receipt.home_id=p_home_id
        AND NOT (receipt.actor_user_id=p_user_id AND receipt.private_setup))
      OR EXISTS (SELECT FROM public."HomeTaskAssignmentDelivery" d WHERE d.home_id=p_home_id)
      OR EXISTS (SELECT FROM public."HomeAuditLog" a WHERE a.home_id = p_home_id AND (
        a.actor_user_id IS DISTINCT FROM p_user_id OR NOT coalesce(
          (a.action = 'OCCUPANCY_TEMPLATE_APPLIED' AND a.target_type = 'HomeOccupancy'
            AND a.target_id = v_occ.id
            AND a.metadata->>'verification_status' IN ('provisional_bootstrap','pending_doc'))
          OR public.home_secret_own_setup_audit(a,p_user_id)
          OR public.home_record_own_setup_audit(a,p_user_id)
          OR (a.action='OWNERSHIP_CLAIM_WITHDRAWN' AND a.target_type='HomeOwnershipClaim'
            AND EXISTS(SELECT FROM public."HomeOwnershipClaim" c WHERE c.id=a.target_id
              AND c.home_id=p_home_id AND public.home_claim_own_private_withdrawal(c,p_user_id)))
          OR (a.action = 'OWNERSHIP_CLAIM_SUBMITTED' AND a.target_type = 'HomeOwnershipClaim'
            AND EXISTS (SELECT FROM public."HomeOwnershipClaim" c WHERE c.id = a.target_id
              AND c.home_id = p_home_id AND c.claimant_user_id = p_user_id)),false)))
      OR EXISTS (SELECT FROM public."HomeAccessSecret" WHERE home_id = p_home_id AND created_by IS DISTINCT FROM p_user_id)
      OR EXISTS (SELECT FROM public."HomePermissionOverride" WHERE home_id = p_home_id
        AND (user_id <> p_user_id OR created_by IS DISTINCT FROM p_user_id))
      OR EXISTS (SELECT FROM public."UnlistedRemoval" WHERE home_id = p_home_id AND user_id <> p_user_id)
      OR EXISTS (SELECT FROM public."AddressCalendarRule" WHERE scope_type = 'home'
        AND public.home_calendar_scope_id(scope_key) = p_home_id AND created_by IS DISTINCT FROM p_user_id)
      OR EXISTS (SELECT FROM public."Activity" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."AddressReviewCase" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."AttomPropertyCache" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BlockFounder" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BlockInvite" WHERE sender_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BookingPackage" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BookingPage" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Booking" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BusinessProfileView" WHERE viewer_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."ChatRoom" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."EventType" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."FridgeCard" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeAsset" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeAuthority" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeBill" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeBusinessLink" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeCalendarEvent" e WHERE home_id = p_home_id
        AND (NOT public.home_event_private_setup(e,p_user_id)
          OR EXISTS (SELECT FROM public."HomeCalendarEventAttendee" a WHERE a.event_id=e.id AND a.user_id<>p_user_id)))
      OR EXISTS (SELECT FROM public."HomeDevice" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeDispute" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeEmergency" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeEstateFields" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeGuestPass" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeHouseholdAccessRequest" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeInvite" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeIssue" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeLeaseInvite" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeLease" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeMaintenanceLog" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeMaintenanceTemplate" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeMedia" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePackage" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePet" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePoll" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePostcardCode" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePrivacy" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePrivateData" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePublicData" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeQuorumAction" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeRecordWatch" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeRentReport" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeReputation" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeResidencyClaim" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeResource" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeRvStatus" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeScopedGrant" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeShareReadReceipt" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeSeasonalChecklistItem" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeSubscription" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeSystem" WHERE home_id = p_home_id)
      OR EXISTS(SELECT FROM public."HomeTaskMediaIntent" i WHERE i.original_home_id=p_home_id
        AND NOT public.home_task_media_own_setup(i,p_user_id))
      OR EXISTS (SELECT FROM public."HomeTask" t WHERE home_id = p_home_id
        AND NOT public.home_task_private_setup(t,p_user_id))
      OR EXISTS (SELECT FROM public."HomeVendor" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeVerification" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Home" WHERE parent_home_id = p_home_id OR canonical_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."ListingInventorySlot" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Listing" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MailAlias" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MailDayItem" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MailPartySession" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MailRoutingQueue" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Mail" WHERE address_home_id = p_home_id OR address_id = p_home_id OR recipient_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MessageTemplate" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."NeighborMessage" WHERE sender_home_id = p_home_id OR recipient_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Post" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."PropertyIntelligenceCache" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."ResidencyClaim" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."ResidencyLetter" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."SavedTaskTemplate" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."SchedulingPoll" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."SchedulingWorkflow" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."SupportTrain" WHERE recipient_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."VaultFolder" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Gig" WHERE origin_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Payment" WHERE home_id = p_home_id) THEN
      RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_ESTABLISHED_HOUSEHOLD','deleted',false);
    END IF;
  END IF;
  -- Deleting the Home cannot bypass a current task/source/sensitive deny.
  IF EXISTS(SELECT FROM public."HomeTask" t WHERE t.home_id=p_home_id
    AND EXISTS(SELECT FROM public."HomeTaskMediaIntent" i WHERE i.original_home_id=p_home_id AND i.original_task_id=t.id)
    AND (public.home_task_readable(t,p_user_id) IS DISTINCT FROM true
      OR NOT coalesce((public.home_record_context(p_home_id,p_user_id)->'permissions' ? 'tasks.manage')
        OR (t.created_by=p_user_id AND public.home_record_context(p_home_id,p_user_id)->'permissions' ? 'tasks.edit'),false))) THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_ACCESS_DENIED','deleted',false);
  END IF;
  RETURN jsonb_build_object('allowed',true,'code','HOME_DELETE_ALLOWED','deleted',false);
END;
$$;
