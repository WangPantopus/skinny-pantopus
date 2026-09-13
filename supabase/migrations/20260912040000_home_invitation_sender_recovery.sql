-- Backwards compatible: yes. Service-only sender commands and additional hashed
-- capabilities preserve every existing invite, recipient command and membership.
SET LOCAL lock_timeout='5s';
CREATE TABLE public."HomeInvitationCapability" (
 token_hash text PRIMARY KEY CHECK(token_hash ~ '^[a-f0-9]{64}$'),
 invitation_id uuid NOT NULL REFERENCES public."HomeInvite"(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX ON public."HomeInvitationCapability"(invitation_id);
ALTER TABLE public."HomeInvitationCapability" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."HomeInvitationCapability" FROM PUBLIC,anon,authenticated;
GRANT ALL ON public."HomeInvitationCapability" TO service_role;
CREATE TABLE public."HomeInvitationSenderCommand" (
 actor_user_id uuid NOT NULL, request_id uuid NOT NULL, home_id uuid NOT NULL,
 invitation_id uuid, action text NOT NULL CHECK(action IN ('create','resend','withdraw')),
 intent_hash text NOT NULL CHECK(intent_hash ~ '^[a-f0-9]{64}$'),
 token_hash text CHECK(token_hash ~ '^[a-f0-9]{64}$'),
 decision_token text NOT NULL CHECK(decision_token ~ '^[a-f0-9]{64}$'),
 state text NOT NULL CHECK(state IN ('pending','completed','rejected','cancelled')),
 email_status text NOT NULL DEFAULT 'not_requested' CHECK(email_status IN ('not_requested','unconfirmed','provider_accepted')),
 in_app_status text NOT NULL DEFAULT 'not_requested' CHECK(in_app_status IN ('not_requested','unconfirmed','saved')),
 dispatch_claimed boolean NOT NULL DEFAULT false, delivery_recorded boolean NOT NULL DEFAULT false,
 error_code text, error_status integer,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(actor_user_id,request_id),
 CHECK((token_hash IS NULL)=(action='withdraw')),
 CHECK(state<>'completed' OR invitation_id IS NOT NULL),
 CHECK((state='rejected')=(error_code IS NOT NULL AND error_status IS NOT NULL)),
 CHECK((error_code IS NULL)=(error_status IS NULL)),
 CHECK(error_status IS NULL OR error_status IN (400,403,404,409,410,422)),
 CHECK(error_code IS NULL OR error_code ~ '^[A-Z][A-Z0-9_]{1,79}$')
);
-- No foreign key erases historical proof. No raw capability or recipient details.
ALTER TABLE public."HomeInvitationSenderCommand" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."HomeInvitationSenderCommand" FROM PUBLIC,anon,authenticated;
GRANT ALL ON public."HomeInvitationSenderCommand" TO service_role;
CREATE FUNCTION public.home_invitation_sender_projection(c public."HomeInvitationSenderCommand") RETURNS jsonb
LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('ok',true,'state',c.state,'home_id',c.home_id,'invitation_id',c.invitation_id,
  'action',c.action,'decision_token',c.decision_token,'code',c.error_code,'status',c.error_status,
  'delivery',jsonb_build_object('email',c.email_status,'in_app',c.in_app_status),
  'command',jsonb_build_object('actor_id',c.actor_user_id,'request_id',c.request_id,'created_at',c.created_at,'updated_at',c.updated_at));
$$;
CREATE FUNCTION public.prepare_home_invitation_sender(p_actor_id uuid,p_intent jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE h uuid; a text; i public."HomeInvite"%ROWTYPE; v_policy jsonb; v_target jsonb; v_snapshot jsonb; v_home jsonb; v_target_id uuid; v_targets uuid[]; v_invitee jsonb; v_source_id uuid; v_source_suffix text;
BEGIN
 IF p_actor_id IS NULL OR jsonb_typeof(p_intent) IS DISTINCT FROM 'object'
  OR jsonb_typeof(p_intent->'home_id') IS DISTINCT FROM 'string'
  OR (p_intent->>'home_id') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
  OR jsonb_typeof(p_intent->'action') IS DISTINCT FROM 'string'
  OR (p_intent->>'action') NOT IN ('create','resend','withdraw') THEN
  RETURN '{"ok":false,"code":"INVITE_INVALID","status":400}'::jsonb; END IF;
 h:=(p_intent->>'home_id')::uuid; a:=p_intent->>'action';
 IF EXISTS(SELECT FROM jsonb_object_keys(p_intent)k WHERE k NOT IN ('home_id','action',CASE WHEN a='create' THEN 'payload' ELSE 'invitation_id' END)) THEN
  RETURN '{"ok":false,"code":"INVITE_INVALID","status":400}'::jsonb; END IF;
 PERFORM 1 FROM public."User" WHERE id=p_actor_id FOR SHARE;
 IF NOT FOUND THEN RETURN '{"ok":false,"code":"INVITE_ACCOUNT_UNAVAILABLE","status":403}'::jsonb; END IF;
 IF NOT public.lock_home_invitation_scope(h) THEN RETURN '{"ok":false,"code":"HOME_NOT_FOUND","status":404}'::jsonb; END IF;
 IF public.home_invite_authority(h,p_actor_id) IS NULL THEN RETURN '{"ok":false,"code":"MEMBERS_MANAGE_REQUIRED","status":403}'::jsonb; END IF;
 SELECT jsonb_build_object('id',id,'name',name,'city',city,'state',state) INTO v_home FROM public."Home" WHERE id=h;
 IF a='create' THEN
  IF jsonb_typeof(p_intent->'payload') IS DISTINCT FROM 'object'
   OR EXISTS(SELECT FROM jsonb_object_keys(p_intent->'payload')k WHERE k NOT IN ('email','user_id','username','relationship','preset_key','start_at','end_at','message'))
   OR EXISTS(SELECT FROM jsonb_each(p_intent->'payload')e WHERE jsonb_typeof(e.value) NOT IN ('string','null')) THEN
   RETURN '{"ok":false,"code":"INVITE_INVALID","status":400}'::jsonb; END IF;
  IF nullif(btrim(p_intent->'payload'->>'username'),'') IS NOT NULL THEN
   SELECT array_agg(id ORDER BY id) INTO v_targets FROM (SELECT id FROM public."User"
    WHERE lower(username)=lower(btrim(p_intent->'payload'->>'username')) ORDER BY id FOR SHARE) matched;
   IF coalesce(cardinality(v_targets),0)<>1 THEN RETURN '{"ok":false,"code":"USER_NOT_FOUND","status":404}'::jsonb; END IF;
   v_target_id:=v_targets[1];
   IF nullif(p_intent->'payload'->>'user_id','') IS NOT NULL AND p_intent->'payload'->>'user_id'<>v_target_id::text THEN
    RETURN '{"ok":false,"code":"INVITE_RECIPIENT_MISMATCH","status":400}'::jsonb; END IF;
  END IF;
  v_policy:=public.home_invite_policy(coalesce(nullif(p_intent->'payload'->>'relationship',''),'member'),nullif(p_intent->'payload'->>'preset_key',''));
  IF v_policy IS NULL THEN RETURN '{"ok":false,"code":"INVITE_POLICY_INVALID","status":400}'::jsonb; END IF;
 ELSE
  IF jsonb_typeof(p_intent->'invitation_id') IS DISTINCT FROM 'string'
   OR (p_intent->>'invitation_id') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN
   RETURN '{"ok":false,"code":"INVITE_INVALID","status":400}'::jsonb; END IF;
  SELECT * INTO i FROM public."HomeInvite" WHERE home_id=h AND id=(p_intent->>'invitation_id')::uuid;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"INVITE_NOT_FOUND","status":404}'::jsonb; END IF;
  IF i.proposed_preset_key LIKE 'claim_merge:%' OR i.proposed_role_base='owner' OR public.home_invite_role(i.proposed_role)='owner' THEN
   RETURN '{"ok":false,"code":"OWNERSHIP_FLOW_REQUIRED","status":409}'::jsonb; END IF;
  IF i.status<>'pending' THEN RETURN '{"ok":false,"code":"INVITE_ALREADY_USED","status":409}'::jsonb; END IF;
  IF a='resend' THEN
   IF i.expires_at<=clock_timestamp() THEN RETURN '{"ok":false,"code":"INVITE_EXPIRED","status":410}'::jsonb; END IF;
   -- Match recipient admission's canonical role and legacy null-snapshot rule.
   -- A legacy access_request prefix is useful only with a genuine approved
   -- source; older rows may predate source_request_id without a backfill.
   v_source_id:=i.source_request_id;
   IF i.proposed_preset_key LIKE 'access_request:%' THEN
    v_source_suffix:=substring(i.proposed_preset_key FROM length('access_request:')+1);
    IF v_source_suffix !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN
     RETURN '{"ok":false,"code":"INVITE_SOURCE_CHANGED","status":409}'::jsonb; END IF;
    IF v_source_id IS NOT NULL AND v_source_id<>(v_source_suffix)::uuid THEN
     RETURN '{"ok":false,"code":"INVITE_SOURCE_CHANGED","status":409}'::jsonb; END IF;
    v_source_id:=(v_source_suffix)::uuid;
   END IF;
   IF v_source_id IS NOT NULL AND NOT EXISTS(
    SELECT FROM public."HomeHouseholdAccessRequest" WHERE id=v_source_id AND home_id=h
     AND requester_user_id=i.invitee_user_id AND status='approved' AND resolved_by=i.invited_by
     AND CASE requested_identity WHEN 'resident' THEN 'lease_resident' WHEN 'guest' THEN 'guest'
       WHEN 'household_member' THEN 'member' ELSE 'owner' END=CASE WHEN i.source_request_id IS NULL
        THEN coalesce(i.proposed_role_base,public.home_invite_role(i.proposed_role))::text ELSE i.proposed_role_base::text END) THEN
    RETURN '{"ok":false,"code":"INVITE_SOURCE_CHANGED","status":409}'::jsonb; END IF;
   v_policy:=public.home_invite_policy(coalesce(i.proposed_role_base::text,i.proposed_role),
    CASE WHEN i.proposed_preset_key LIKE 'access_request:%' THEN NULL ELSE i.proposed_preset_key END);
   IF v_policy IS NULL OR (i.admission_policy IS NOT NULL AND i.admission_policy IS DISTINCT FROM v_policy) THEN
    RETURN '{"ok":false,"code":"INVITE_POLICY_CHANGED","status":409}'::jsonb; END IF;
   IF public.home_invite_authority(h,i.invited_by) IS NULL THEN RETURN '{"ok":false,"code":"INVITER_ACCESS_CHANGED","status":403}'::jsonb; END IF;
   v_target:=public.home_invite_target_policy(h,p_actor_id,i.invitee_user_id,v_policy,i.access_start_at,i.access_end_at);
   IF v_target->>'ok' IS DISTINCT FROM 'true' THEN RETURN v_target; END IF;
   IF v_target->>'existing_verified'='true' THEN RETURN '{"ok":false,"code":"MEMBER_ALREADY_EXISTS","status":409}'::jsonb; END IF;
  END IF;
  IF i.invitee_user_id IS NOT NULL THEN
   SELECT jsonb_build_object('id',id,'username',username,'name',name) INTO v_invitee FROM public."User" WHERE id=i.invitee_user_id FOR SHARE;
   IF v_invitee IS NULL THEN RETURN '{"ok":false,"code":"USER_NOT_FOUND","status":404}'::jsonb; END IF;
  END IF;
  v_snapshot:=(to_jsonb(i)-ARRAY['token','token_hash'])||jsonb_build_object('invitee',v_invitee);
 END IF;
 RETURN jsonb_build_object('ok',true,'home_id',h,'action',a,'target_id',v_target_id,'invitation',CASE WHEN i.id IS NULL THEN NULL ELSE v_snapshot-'admission_policy' END,
  'decision_token',encode(sha256(convert_to(jsonb_build_object('version',1,'actor_id',p_actor_id,'intent',p_intent,
    'home',v_home,'invitation',v_snapshot,'policy',v_policy,'target_id',v_target_id)::text,'UTF8')),'hex'));
END $$;
-- Current sender roster identity is intentionally separate from recipient lists
-- and historical commands. Only the current manager sees these safe labels.
CREATE FUNCTION public.list_home_invitation_sender(p_actor_id uuid,p_home_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE v_rows jsonb;
BEGIN
 IF p_actor_id IS NULL OR p_home_id IS NULL THEN RETURN '{"ok":false,"code":"INVITE_INVALID","status":400}'::jsonb; END IF;
 IF NOT public.lock_home_invitation_scope(p_home_id) THEN RETURN '{"ok":false,"code":"HOME_NOT_FOUND","status":404}'::jsonb; END IF;
 IF public.home_invite_authority(p_home_id,p_actor_id) IS NULL THEN RETURN '{"ok":false,"code":"MEMBERS_MANAGE_REQUIRED","status":403}'::jsonb; END IF;
 -- Expired pending invites and invitations from a former manager stay visible
 -- for explicit withdrawal. Current authority still gates every command.
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'home_id',i.home_id,'invited_by',i.invited_by,
  'invitee_user_id',i.invitee_user_id,'invitee_email',i.invitee_email,'proposed_role',i.proposed_role,
  'proposed_role_base',i.proposed_role_base,'proposed_preset_key',i.proposed_preset_key,'status',i.status,
  'created_at',i.created_at,'expires_at',i.expires_at,'is_open_invite',i.is_open_invite,
  'access_start_at',i.access_start_at,'access_end_at',i.access_end_at,
  'invitee',CASE WHEN u.id IS NULL THEN NULL ELSE jsonb_build_object('id',u.id,'username',u.username,'name',u.name) END)
  ORDER BY i.created_at DESC,i.id),'[]'::jsonb) INTO v_rows FROM public."HomeInvite"i
  LEFT JOIN public."User"u ON u.id=i.invitee_user_id WHERE i.home_id=p_home_id AND i.status='pending';
 RETURN jsonb_build_object('ok',true,'invitations',v_rows);
END $$;
CREATE FUNCTION public.get_home_invitation_sender(p_actor_id uuid,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE c public."HomeInvitationSenderCommand"%ROWTYPE;
BEGIN
 PERFORM 1 FROM public."User" WHERE id=p_actor_id FOR SHARE;
 IF NOT FOUND THEN RETURN '{"ok":false,"code":"INVITE_ACCOUNT_UNAVAILABLE","status":403}'::jsonb; END IF;
 SELECT * INTO c FROM public."HomeInvitationSenderCommand" WHERE actor_user_id=p_actor_id AND request_id=p_request_id;
 IF NOT FOUND THEN RETURN '{"ok":false,"code":"INVITE_SENDER_NOT_FOUND","status":404}'::jsonb; END IF;
 RETURN public.home_invitation_sender_projection(c);
END $$;
CREATE FUNCTION public.resolve_home_invitation_sender(p_actor_id uuid,p_request_id uuid,p_token text,p_intent jsonb,p_cancel boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE c public."HomeInvitationSenderCommand"%ROWTYPE; r jsonb; v_context jsonb; v_hash text; v_token_hash text; h uuid; a text;
 i public."HomeInvite"%ROWTYPE; v_email text; v_payload jsonb; v_target_id uuid;
BEGIN
 IF p_actor_id IS NULL OR p_request_id IS NULL OR p_cancel IS NULL OR jsonb_typeof(p_intent) IS DISTINCT FROM 'object'
  OR jsonb_typeof(p_intent->'decision_token') IS DISTINCT FROM 'string' OR (p_intent->>'decision_token') !~ '^[a-f0-9]{64}$'
  OR jsonb_typeof(p_intent->'home_id') IS DISTINCT FROM 'string' OR (p_intent->>'home_id') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
  OR jsonb_typeof(p_intent->'action') IS DISTINCT FROM 'string' OR (p_intent->>'action') NOT IN ('create','resend','withdraw') THEN
  RETURN '{"ok":false,"code":"INVITE_INVALID","status":400}'::jsonb; END IF;
 h:=(p_intent->>'home_id')::uuid; a:=p_intent->>'action';
 IF EXISTS(SELECT FROM jsonb_object_keys(p_intent)k WHERE k NOT IN ('home_id','action','decision_token',CASE WHEN a='create' THEN 'payload' ELSE 'invitation_id' END))
  OR (a='create' AND jsonb_typeof(p_intent->'payload') IS DISTINCT FROM 'object')
  OR (a<>'create' AND (jsonb_typeof(p_intent->'invitation_id') IS DISTINCT FROM 'string' OR (p_intent->>'invitation_id') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'))
  OR (a='withdraw' AND p_token IS NOT NULL) OR (a<>'withdraw' AND (p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$')) THEN
  RETURN '{"ok":false,"code":"INVITE_INVALID","status":400}'::jsonb; END IF;
 v_hash:=encode(sha256(convert_to(p_intent::text,'UTF8')),'hex');
 v_token_hash:=CASE WHEN p_token IS NULL THEN NULL ELSE encode(sha256(convert_to(p_token,'UTF8')),'hex') END;
 PERFORM pg_advisory_xact_lock(hashtextextended('home-invitation-sender:'||p_actor_id::text,0));
 PERFORM 1 FROM public."User" WHERE id=p_actor_id FOR SHARE;
 IF NOT FOUND THEN RETURN '{"ok":false,"code":"INVITE_ACCOUNT_UNAVAILABLE","status":403}'::jsonb; END IF;
 SELECT * INTO c FROM public."HomeInvitationSenderCommand" WHERE actor_user_id=p_actor_id AND request_id=p_request_id FOR UPDATE;
 IF FOUND THEN
  IF c.intent_hash<>v_hash OR c.token_hash IS DISTINCT FROM v_token_hash THEN RETURN '{"ok":false,"code":"INVITE_SENDER_CONFLICT","status":409}'::jsonb; END IF;
  RETURN public.home_invitation_sender_projection(c)||'{"replayed":true}'::jsonb;
 END IF;
 INSERT INTO public."HomeInvitationSenderCommand"(actor_user_id,request_id,home_id,invitation_id,action,intent_hash,token_hash,decision_token,state)
  VALUES(p_actor_id,p_request_id,h,CASE WHEN a='create' THEN NULL ELSE (p_intent->>'invitation_id')::uuid END,a,v_hash,v_token_hash,p_intent->>'decision_token',CASE WHEN p_cancel THEN 'cancelled' ELSE 'pending' END) RETURNING * INTO c;
 IF p_cancel THEN RETURN public.home_invitation_sender_projection(c)||'{"replayed":false}'::jsonb; END IF;
 v_context:=public.prepare_home_invitation_sender(p_actor_id,p_intent-'decision_token');
 IF a<>'withdraw' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('home-invitation-capability:'||v_token_hash,0));
  IF EXISTS(SELECT FROM public."HomeInvite" WHERE token_hash=v_token_hash OR (token_hash IS NULL AND token=p_token))
   OR EXISTS(SELECT FROM public."HomeInvitationCapability" WHERE token_hash=v_token_hash) THEN
   v_context:='{"ok":false,"code":"INVITE_INVALID","status":400}'; END IF;
 END IF;
 IF v_context->>'ok' IS DISTINCT FROM 'true' THEN r:=v_context;
 ELSIF v_context->>'decision_token'<>p_intent->>'decision_token' THEN r:='{ "ok":false,"code":"INVITE_SENDER_CHANGED","status":409}';
 ELSIF a='create' THEN
  v_payload:=p_intent->'payload';
  IF nullif(btrim(v_payload->>'username'),'') IS NOT NULL THEN
   v_target_id:=(v_context->>'target_id')::uuid;
   IF v_target_id IS NULL THEN RAISE EXCEPTION 'Prepared invitation recipient unavailable'; END IF;
   v_payload:=v_payload||jsonb_build_object('user_id',v_target_id);
  END IF;
  r:=public.write_home_invitation(h,p_actor_id,'create',v_payload,p_token);
 ELSE
  SELECT * INTO i FROM public."HomeInvite" WHERE id=c.invitation_id;
  IF a='withdraw' THEN
   UPDATE public."HomeInvite" SET status='revoked' WHERE id=i.id;
   INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
    VALUES(h,p_actor_id,'HOME_INVITE_WITHDRAWN','HomeInvite',i.id,'{}');
  ELSE
   INSERT INTO public."HomeInvitationCapability"(token_hash,invitation_id) VALUES(v_token_hash,i.id);
   INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
    VALUES(h,p_actor_id,'HOME_INVITE_RESEND_CREATED','HomeInvite',i.id,'{}');
  END IF;
  r:=jsonb_build_object('ok',true,'invitation',jsonb_build_object('id',i.id));
 END IF;
 IF r->>'ok' IS DISTINCT FROM 'true' THEN
  IF r->>'code' IS NULL OR (r->>'status')::integer NOT IN (400,403,404,409,410,422) THEN RAISE EXCEPTION 'Invitation sender unavailable'; END IF;
  UPDATE public."HomeInvitationSenderCommand" SET state='rejected',error_code=r->>'code',error_status=(r->>'status')::integer,updated_at=clock_timestamp()
   WHERE actor_user_id=p_actor_id AND request_id=p_request_id RETURNING * INTO c;
 ELSE
  SELECT * INTO i FROM public."HomeInvite" WHERE id=(r->'invitation'->>'id')::uuid;
  IF i.id IS NULL OR i.home_id<>h THEN RAISE EXCEPTION 'Invitation sender identity mismatch'; END IF;
  IF i.invitee_user_id IS NOT NULL THEN SELECT email INTO v_email FROM auth.users WHERE id=i.invitee_user_id; ELSE v_email:=i.invitee_email; END IF;
  UPDATE public."HomeInvitationSenderCommand" SET state='completed',invitation_id=i.id,
   email_status=CASE WHEN a<>'withdraw' AND v_email IS NOT NULL THEN 'unconfirmed' ELSE 'not_requested' END,
   in_app_status=CASE WHEN a<>'withdraw' AND i.invitee_user_id IS NOT NULL THEN 'unconfirmed' ELSE 'not_requested' END,
   updated_at=clock_timestamp() WHERE actor_user_id=p_actor_id AND request_id=p_request_id RETURNING * INTO c;
 END IF;
 RETURN public.home_invitation_sender_projection(c)||'{"replayed":false}'::jsonb;
END $$;
-- A one-shot claim immediately before the external side effect rechecks current
-- authority and invitation state. Neither lost RPC replies nor retries dispatch.
CREATE FUNCTION public.claim_home_invitation_sender_delivery(p_actor_id uuid,p_request_id uuid,p_token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE c public."HomeInvitationSenderCommand"%ROWTYPE; i public."HomeInvite"%ROWTYPE; v_email text; v_actor text; v_label text; v_city text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('home-invitation-sender:'||p_actor_id::text,0));
 SELECT * INTO c FROM public."HomeInvitationSenderCommand" WHERE actor_user_id=p_actor_id AND request_id=p_request_id FOR UPDATE;
 IF NOT FOUND OR c.state<>'completed' OR c.action='withdraw' OR c.dispatch_claimed OR c.token_hash IS DISTINCT FROM encode(sha256(convert_to(p_token,'UTF8')),'hex') THEN RETURN '{"ok":true,"dispatch":false}'::jsonb; END IF;
 IF (public.prepare_home_invitation_sender(p_actor_id,jsonb_build_object('home_id',c.home_id,'action','resend','invitation_id',c.invitation_id))->>'ok') IS DISTINCT FROM 'true' THEN
  RETURN '{"ok":true,"dispatch":false}'::jsonb; END IF;
 SELECT * INTO i FROM public."HomeInvite" WHERE id=c.invitation_id;
 IF i.id IS NULL OR i.status<>'pending' OR i.expires_at<=clock_timestamp() OR public.home_invite_authority(c.home_id,i.invited_by) IS NULL THEN RETURN '{"ok":true,"dispatch":false}'::jsonb; END IF;
 UPDATE public."HomeInvitationSenderCommand" SET dispatch_claimed=true WHERE actor_user_id=p_actor_id AND request_id=p_request_id;
 IF i.invitee_user_id IS NOT NULL THEN SELECT email INTO v_email FROM auth.users WHERE id=i.invitee_user_id; ELSE v_email:=i.invitee_email; END IF;
 SELECT coalesce(name,first_name,username,'Someone') INTO v_actor FROM public."User" WHERE id=i.invited_by;
 SELECT coalesce(name,'A home'),concat_ws(', ',city,state) INTO v_label,v_city FROM public."Home" WHERE id=c.home_id;
 RETURN jsonb_build_object('ok',true,'dispatch',true,'delivery_email',v_email,'actor_name',v_actor,'home_label',v_label,'home_city',v_city,
  'invitation',jsonb_build_object('id',i.id,'home_id',i.home_id,'invitee_user_id',i.invitee_user_id,'proposed_role',coalesce(i.proposed_role_base::text,i.proposed_role),'token',p_token));
END $$;
CREATE FUNCTION public.record_home_invitation_sender_delivery(p_actor_id uuid,p_request_id uuid,p_email text,p_in_app text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE c public."HomeInvitationSenderCommand"%ROWTYPE;
BEGIN
 IF p_email IS NULL OR p_email NOT IN ('not_requested','unconfirmed','provider_accepted') OR p_in_app IS NULL OR p_in_app NOT IN ('not_requested','unconfirmed','saved') THEN RETURN '{"ok":false,"code":"INVITE_INVALID","status":400}'::jsonb; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('home-invitation-sender:'||p_actor_id::text,0));
 SELECT * INTO c FROM public."HomeInvitationSenderCommand" WHERE actor_user_id=p_actor_id AND request_id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN RETURN '{"ok":false,"code":"INVITE_SENDER_NOT_FOUND","status":404}'::jsonb; END IF;
 IF c.dispatch_claimed AND NOT c.delivery_recorded THEN
  UPDATE public."HomeInvitationSenderCommand" SET delivery_recorded=true,
   email_status=CASE WHEN email_status='unconfirmed' AND p_email='provider_accepted' THEN p_email ELSE email_status END,
   in_app_status=CASE WHEN in_app_status='unconfirmed' AND p_in_app='saved' THEN p_in_app ELSE in_app_status END,
   updated_at=clock_timestamp() WHERE actor_user_id=p_actor_id AND request_id=p_request_id RETURNING * INTO c;
 END IF;
 RETURN public.home_invitation_sender_projection(c);
END $$;
REVOKE ALL ON FUNCTION public.home_invitation_sender_projection(public."HomeInvitationSenderCommand"),
 public.prepare_home_invitation_sender(uuid,jsonb),public.list_home_invitation_sender(uuid,uuid),public.get_home_invitation_sender(uuid,uuid),
 public.resolve_home_invitation_sender(uuid,uuid,text,jsonb,boolean),public.claim_home_invitation_sender_delivery(uuid,uuid,text),
 public.record_home_invitation_sender_delivery(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.home_invitation_sender_projection(public."HomeInvitationSenderCommand"),
 public.prepare_home_invitation_sender(uuid,jsonb),public.list_home_invitation_sender(uuid,uuid),public.get_home_invitation_sender(uuid,uuid),
 public.resolve_home_invitation_sender(uuid,uuid,text,jsonb,boolean),public.claim_home_invitation_sender_delivery(uuid,uuid,text),
 public.record_home_invitation_sender_delivery(uuid,uuid,text,text) TO service_role;

-- Preserve recipient transactions; extend only capability resolution. Aliases
-- share invitation state, policy, expiry and withdrawal under the same lock.
CREATE OR REPLACE FUNCTION public.act_on_home_invitation(p_invite_id uuid,p_token text,p_actor_id uuid,
  p_action text,p_validity_days integer DEFAULT 365) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE v_invite public."HomeInvite"%ROWTYPE; v_home public."Home"%ROWTYPE;
  v_occupancy public."HomeOccupancy"%ROWTYPE; v_inviter public."User"%ROWTYPE;
  v_policy jsonb; v_target_policy jsonb; v_permissions jsonb; v_hash text; v_count integer;
  v_now timestamptz; v_recipient boolean; v_open boolean; v_permission public.home_permission;
BEGIN
  IF p_action IS NULL OR p_action NOT IN ('preview','accept','decline')
    OR (p_invite_id IS NULL)=(p_token IS NULL) OR (p_action<>'preview' AND p_actor_id IS NULL)
    OR p_validity_days IS NULL OR p_validity_days NOT BETWEEN 1 AND 3650 OR length(p_token)>512 THEN
    RETURN jsonb_build_object('ok',false,'code','INVITE_INVALID','status',400); END IF;
  IF p_token IS NOT NULL THEN v_hash:=encode(sha256(convert_to(p_token,'UTF8')),'hex'); END IF;
  SELECT count(*) INTO v_count FROM public."HomeInvite" WHERE
    (p_invite_id IS NOT NULL AND id=p_invite_id) OR (p_token IS NOT NULL AND
      (token_hash=v_hash OR (token_hash IS NULL AND token=p_token) OR id IN (SELECT invitation_id FROM public."HomeInvitationCapability" WHERE token_hash=v_hash)));
  IF v_count=0 THEN RETURN jsonb_build_object('ok',false,'code','INVITE_NOT_FOUND','status',404); END IF;
  IF v_count<>1 THEN RETURN jsonb_build_object('ok',false,'code','INVITE_UNAVAILABLE','status',503); END IF;
  SELECT * INTO v_invite FROM public."HomeInvite" WHERE
    (p_invite_id IS NOT NULL AND id=p_invite_id) OR (p_token IS NOT NULL AND
      (token_hash=v_hash OR (token_hash IS NULL AND token=p_token) OR id IN (SELECT invitation_id FROM public."HomeInvitationCapability" WHERE token_hash=v_hash)));
  IF NOT public.lock_home_invitation_scope(v_invite.home_id) THEN
    RETURN jsonb_build_object('ok',false,'code','INVITE_NOT_FOUND','status',404); END IF;
  -- Recheck the exact token after locking, including legacy hash-null fallback.
  SELECT * INTO v_invite FROM public."HomeInvite" WHERE id=v_invite.id AND
    (p_token IS NULL OR token_hash=v_hash OR (token_hash IS NULL AND token=p_token) OR id IN (SELECT invitation_id FROM public."HomeInvitationCapability" WHERE token_hash=v_hash));
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','INVITE_NOT_FOUND','status',404); END IF;
  SELECT * INTO v_home FROM public."Home" WHERE id=v_invite.home_id;
  -- Serialize confirmation/email changes with email-bound redemption. The
  -- application never substitutes a mutable public-profile email here.
  IF v_invite.invitee_user_id IS NULL AND v_invite.invitee_email IS NOT NULL AND p_actor_id IS NOT NULL THEN
    PERFORM id FROM auth.users WHERE id=p_actor_id FOR SHARE;
  END IF;
  v_now:=clock_timestamp();
  v_recipient:=public.home_invite_is_recipient(v_invite,p_actor_id);
  v_open:=v_invite.is_open_invite IS TRUE AND v_invite.invitee_user_id IS NULL AND v_invite.invitee_email IS NULL;
  IF p_action='decline' THEN
    IF NOT coalesce(v_recipient,false)
      AND public.home_invite_authority(v_invite.home_id,p_actor_id) IS NULL THEN
      -- Declining an open link is this viewer's decision, not authority to
      -- revoke the invitation for every other potential recipient.
      IF v_open AND p_token IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'replayed',true); END IF;
      RETURN jsonb_build_object('ok',false,'code','INVITE_EMAIL_MISMATCH','status',403); END IF;
    IF v_invite.status='revoked' THEN RETURN jsonb_build_object('ok',true,'replayed',true); END IF;
    IF v_invite.status<>'pending' THEN RETURN jsonb_build_object('ok',false,'code','INVITE_ALREADY_USED','status',409); END IF;
    UPDATE public."HomeInvite" SET status='revoked' WHERE id=v_invite.id;
    INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
      VALUES(v_invite.home_id,p_actor_id,'HOME_INVITE_REVOKED','HomeInvite',v_invite.id,'{}');
    RETURN jsonb_build_object('ok',true,'replayed',false);
  END IF;
  IF p_action='accept' AND NOT coalesce(v_recipient,false) AND NOT (v_open AND p_token IS NOT NULL) THEN
    RETURN jsonb_build_object('ok',false,'code','INVITE_EMAIL_MISMATCH','status',403); END IF;
  IF p_action='preview' AND (v_invite.status<>'pending' OR v_invite.expires_at<=v_now) THEN
    RETURN jsonb_build_object('ok',true,'invitation',jsonb_build_object('id',v_invite.id,
      'status',CASE WHEN v_invite.status='pending' THEN 'expired' ELSE v_invite.status END),
      'expired',v_invite.status='expired' OR (v_invite.status='pending' AND v_invite.expires_at<=v_now),
      'alreadyUsed',v_invite.status='accepted'); END IF;
  IF p_action='accept' AND v_invite.status='accepted' THEN
    -- A committed admission is independent of its former inviter. An exact
    -- winner retry may return only their current occupancy, never reapply it.
    SELECT * INTO v_occupancy FROM public."HomeOccupancy" WHERE home_id=v_invite.home_id AND user_id=p_actor_id;
    IF v_invite.accepted_by_user_id=p_actor_id AND v_occupancy.is_active IS TRUE
      AND v_occupancy.verification_status='verified'
      AND coalesce(v_occupancy.role_base,public.home_invite_role(v_occupancy.role)) IS NOT NULL
      AND (v_occupancy.end_at IS NULL OR v_occupancy.end_at>v_now)
      AND (v_occupancy.access_end_at IS NULL OR v_occupancy.access_end_at>v_now) THEN
      RETURN jsonb_build_object('ok',true,'replayed',true,'homeId',v_invite.home_id,'occupancy',to_jsonb(v_occupancy)); END IF;
    RETURN jsonb_build_object('ok',false,'code','INVITE_ALREADY_USED','status',409);
  END IF;
  IF v_invite.status<>'pending' THEN RETURN jsonb_build_object('ok',false,'code','INVITE_ALREADY_USED','status',409); END IF;
  IF v_invite.expires_at<=v_now THEN RETURN jsonb_build_object('ok',false,'code','INVITE_EXPIRED','status',410); END IF;
  IF public.home_invite_authority(v_invite.home_id,v_invite.invited_by) IS NULL THEN
    RETURN jsonb_build_object('ok',false,'code','INVITER_ACCESS_CHANGED','status',403); END IF;
  IF p_action='preview' THEN
    SELECT * INTO v_inviter FROM public."User" WHERE id=v_invite.invited_by;
    RETURN jsonb_build_object('ok',true,'invitation',jsonb_build_object('id',v_invite.id,'status',v_invite.status,
      'proposed_role',v_invite.proposed_role,'invitee_email',v_invite.invitee_email,'invitee_user_id',v_invite.invitee_user_id,
      'created_at',v_invite.created_at,'expires_at',v_invite.expires_at,
      'access_start_at',v_invite.access_start_at,'access_end_at',v_invite.access_end_at),
      'home',jsonb_build_object('id',v_home.id,'name',coalesce(v_home.name,'A Home'),
        'city',concat_ws(', ',v_home.city,v_home.state),'home_type',v_home.home_type),
      'inviter',jsonb_build_object('name',coalesce(v_inviter.name,v_inviter.first_name,v_inviter.username,'Someone'),
        'username',v_inviter.username,'profilePicture',v_inviter.profile_picture_url));
  END IF;
  IF p_actor_id=v_invite.invited_by THEN
    RETURN jsonb_build_object('ok',false,'code','SELF_ADMISSION_FORBIDDEN','status',403); END IF;
  IF v_invite.proposed_preset_key LIKE 'claim_merge:%' THEN
    -- Dedicated ownership enrollment remains a distinct service. Never let a
    -- disabled feature flag fall through to ordinary owner-template creation.
    RETURN jsonb_build_object('ok',true,'kind','claim_merge','invitation',to_jsonb(v_invite)); END IF;
  IF v_invite.source_request_id IS NOT NULL AND NOT EXISTS(
    SELECT FROM public."HomeHouseholdAccessRequest" WHERE id=v_invite.source_request_id
      AND home_id=v_invite.home_id AND requester_user_id=p_actor_id AND status='approved'
      AND resolved_by=v_invite.invited_by
      AND CASE requested_identity WHEN 'resident' THEN 'lease_resident' WHEN 'guest' THEN 'guest'
        WHEN 'household_member' THEN 'member' ELSE 'owner' END=v_invite.proposed_role_base::text) THEN
    RETURN jsonb_build_object('ok',false,'code','INVITE_SOURCE_CHANGED','status',409); END IF;
  v_policy:=public.home_invite_policy(coalesce(v_invite.proposed_role_base::text,v_invite.proposed_role),
    CASE WHEN v_invite.proposed_preset_key LIKE 'access_request:%' THEN NULL ELSE v_invite.proposed_preset_key END);
  IF v_policy IS NULL OR (v_invite.admission_policy IS NOT NULL AND v_invite.admission_policy IS DISTINCT FROM v_policy) THEN
    RETURN jsonb_build_object('ok',false,'code','INVITE_POLICY_CHANGED','status',409); END IF;
  v_target_policy:=public.home_invite_target_policy(v_invite.home_id,v_invite.invited_by,p_actor_id,
    v_policy,v_invite.access_start_at,v_invite.access_end_at);
  IF v_target_policy->>'ok'<>'true' THEN RETURN v_target_policy; END IF;
  IF v_target_policy->>'existing_verified'='true' THEN
    SELECT * INTO v_occupancy FROM public."HomeOccupancy" WHERE home_id=v_invite.home_id AND user_id=p_actor_id;
  ELSE
    SELECT * INTO v_occupancy FROM public."HomeOccupancy" WHERE home_id=v_invite.home_id AND user_id=p_actor_id;
    IF FOUND THEN
      UPDATE public."HomeOccupancy" SET role=v_policy->>'role_base',role_base=(v_policy->>'role_base')::public.home_role_base,
        age_band=(v_target_policy->>'age_band')::public.home_age_band,
        access_start_at=(v_target_policy->>'access_start_at')::timestamptz,
        access_end_at=(v_target_policy->>'access_end_at')::timestamptz,
        verification_status='verified',verified_at=v_now,verification_expires_at=v_now+make_interval(days=>p_validity_days),
        updated_at=v_now WHERE id=v_occupancy.id RETURNING * INTO v_occupancy;
    ELSE
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,is_active,start_at,
        access_start_at,access_end_at,added_by_user_id,verification_status,verified_at,verification_expires_at,
        can_manage_home,can_manage_access,can_manage_finance,can_manage_tasks,can_view_sensitive)
        VALUES(v_invite.home_id,p_actor_id,v_policy->>'role_base',(v_policy->>'role_base')::public.home_role_base,
          (v_target_policy->>'age_band')::public.home_age_band,true,now(),
          (v_target_policy->>'access_start_at')::timestamptz,(v_target_policy->>'access_end_at')::timestamptz,
          v_invite.invited_by,'verified',v_now,v_now+make_interval(days=>p_validity_days),false,false,false,false,false)
        RETURNING * INTO v_occupancy;
    END IF;
    FOR v_permission IN SELECT jsonb_array_elements_text(v_policy->'grant_perms')::public.home_permission LOOP
      INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed,created_by)
        VALUES(v_invite.home_id,p_actor_id,v_permission,true,v_invite.invited_by)
        ON CONFLICT(home_id,user_id,permission) DO NOTHING;
    END LOOP;
    FOR v_permission IN SELECT jsonb_array_elements_text(v_policy->'deny_perms')::public.home_permission LOOP
      INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed,created_by)
        VALUES(v_invite.home_id,p_actor_id,v_permission,false,v_invite.invited_by)
        ON CONFLICT(home_id,user_id,permission) DO UPDATE SET allowed=false,created_by=v_invite.invited_by,updated_at=v_now;
    END LOOP;
    v_permissions:=CASE WHEN (v_occupancy.start_at IS NULL OR v_occupancy.start_at<=v_now)
      AND (v_occupancy.access_start_at IS NULL OR v_occupancy.access_start_at<=v_now)
      THEN v_target_policy->'permissions' ELSE '[]'::jsonb END;
    UPDATE public."HomeOccupancy" SET can_manage_home=v_permissions ? 'home.edit',
      can_manage_access=v_permissions ?| ARRAY['access.manage','members.manage'],
      can_manage_finance=v_permissions ? 'finance.manage',can_manage_tasks=v_permissions ?| ARRAY['tasks.edit','tasks.manage'],
      can_view_sensitive=v_permissions ? 'sensitive.view' WHERE id=v_occupancy.id RETURNING * INTO v_occupancy;
    UPDATE public."Home" SET vacancy_at=NULL,updated_at=v_now WHERE id=v_invite.home_id AND vacancy_at IS NOT NULL;
  END IF;
  UPDATE public."HomeInvite" SET status='accepted',accepted_by_user_id=p_actor_id,accepted_at=v_now WHERE id=v_invite.id;
  INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
    VALUES(v_invite.home_id,p_actor_id,'HOME_INVITE_ACCEPTED','HomeInvite',v_invite.id,
      jsonb_build_object('inviter_id',v_invite.invited_by,'occupancy_id',v_occupancy.id));
  RETURN jsonb_build_object('ok',true,'replayed',false,'homeId',v_invite.home_id,'occupancy',to_jsonb(v_occupancy),
    'inviter_id',v_invite.invited_by,'home_label',coalesce(v_home.name,'A home'));
END $$;
