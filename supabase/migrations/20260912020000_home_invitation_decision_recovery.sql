-- Backwards compatible: yes. Additive service-only ordinary invitation commands.
-- Historical decisions grant no current Home access. Existing invitation routes,
-- memberships, role defaults and migration ledger are not rewritten.
SET LOCAL lock_timeout='5s';

CREATE TABLE public."HomeInvitationDecisionCommand" (
  actor_user_id uuid NOT NULL,
  request_id uuid NOT NULL,
  invitation_id uuid NOT NULL,
  home_id uuid NOT NULL,
  token_hash text NOT NULL CHECK(token_hash ~ '^[a-f0-9]{64}$'),
  intent_hash text NOT NULL CHECK(intent_hash ~ '^[a-f0-9]{64}$'),
  action text NOT NULL CHECK(action IN ('accept','decline')),
  decision_token text NOT NULL CHECK(decision_token ~ '^[a-f0-9]{64}$'),
  state text NOT NULL CHECK(state IN ('pending','completed','rejected','cancelled')),
  occupancy_id uuid,
  error_code text,
  error_status integer,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(actor_user_id,request_id),
  CHECK((occupancy_id IS NOT NULL)=(state='completed' AND action='accept')),
  CHECK((state='rejected')=(error_code IS NOT NULL AND error_status IS NOT NULL)),
  CHECK((error_code IS NULL)=(error_status IS NULL)),
  CHECK(error_status IS NULL OR error_status IN (400,403,404,409,410,422)),
  CHECK(error_code IS NULL OR error_code ~ '^[A-Z][A-Z0-9_]{1,79}$')
);
-- No FK deletes historical proof when a Home, invitation or occupancy is removed.
-- Retain no raw invitation token, address, email, profile or access permissions.
ALTER TABLE public."HomeInvitationDecisionCommand" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."HomeInvitationDecisionCommand" FROM PUBLIC,anon,authenticated;
GRANT ALL ON public."HomeInvitationDecisionCommand" TO service_role;

CREATE FUNCTION public.home_invitation_decision_projection(c public."HomeInvitationDecisionCommand")
RETURNS jsonb LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
  SELECT jsonb_build_object('ok',true,'state',c.state,'home_id',c.home_id,
    'invitation_id',c.invitation_id,'action',c.action,'decision_token',c.decision_token,
    'occupancy_id',c.occupancy_id,'code',c.error_code,'status',c.error_status,
    'command',jsonb_build_object('actor_id',c.actor_user_id,'request_id',c.request_id,
      'created_at',c.created_at,'updated_at',c.updated_at));
$$;

CREATE FUNCTION public.prepare_home_invitation_decision(p_actor_id uuid,p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE r jsonb; i public."HomeInvite"%ROWTYPE; v_hash text;
BEGIN
  IF p_actor_id IS NULL OR p_token IS NULL OR length(p_token) NOT BETWEEN 1 AND 512 THEN
    RETURN '{"ok":false,"code":"INVITE_INVALID","status":400}'::jsonb; END IF;
  PERFORM 1 FROM public."User" WHERE id=p_actor_id FOR SHARE;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"INVITE_ACCOUNT_UNAVAILABLE","status":403}'::jsonb; END IF;
  -- Existing preview checks token uniqueness and retains the whole invitation
  -- scope lock through this function, including current policy and access dates.
  r:=public.act_on_home_invitation(NULL,p_token,p_actor_id,'preview',365);
  IF r->>'ok' IS DISTINCT FROM 'true' THEN RETURN r; END IF;
  SELECT * INTO i FROM public."HomeInvite" WHERE id=(r->'invitation'->>'id')::uuid;
  IF i.id IS NULL THEN RAISE EXCEPTION 'Invitation preview identity unavailable'; END IF;
  IF NOT coalesce(public.home_invite_is_recipient(i,p_actor_id),false)
    AND NOT (i.is_open_invite IS TRUE AND i.invitee_user_id IS NULL AND i.invitee_email IS NULL) THEN
    RETURN '{"ok":false,"code":"INVITE_EMAIL_MISMATCH","status":403}'::jsonb; END IF;
  IF i.proposed_preset_key LIKE 'claim_merge:%' OR public.home_invite_role(i.proposed_role)='owner' THEN
    RETURN '{"ok":false,"code":"OWNERSHIP_FLOW_REQUIRED","status":409}'::jsonb; END IF;
  IF r->>'expired'='true' OR i.expires_at<=clock_timestamp() THEN
    RETURN '{"ok":false,"code":"INVITE_EXPIRED","status":410}'::jsonb; END IF;
  IF i.status<>'pending' THEN RETURN '{"ok":false,"code":"INVITE_ALREADY_USED","status":409}'::jsonb; END IF;
  v_hash:=encode(sha256(convert_to(jsonb_build_object('version',1,'actor_id',p_actor_id,
    'invitation',to_jsonb(i)-'token'-'token_hash','home',r->'home')::text,'UTF8')),'hex');
  RETURN jsonb_build_object('ok',true,'preview',r-'ok','invitation_id',i.id,
    'home_id',i.home_id,'decision_token',v_hash);
END $$;

CREATE FUNCTION public.get_home_invitation_decision(p_actor_id uuid,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE c public."HomeInvitationDecisionCommand"%ROWTYPE;
BEGIN
  IF p_actor_id IS NULL OR p_request_id IS NULL THEN
    RETURN '{"ok":false,"code":"INVITE_INVALID","status":400}'::jsonb; END IF;
  PERFORM 1 FROM public."User" WHERE id=p_actor_id FOR SHARE;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"INVITE_ACCOUNT_UNAVAILABLE","status":403}'::jsonb; END IF;
  SELECT * INTO c FROM public."HomeInvitationDecisionCommand" WHERE actor_user_id=p_actor_id AND request_id=p_request_id;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"INVITE_DECISION_NOT_FOUND","status":404}'::jsonb; END IF;
  RETURN public.home_invitation_decision_projection(c);
END $$;

CREATE FUNCTION public.resolve_home_invitation_decision(p_actor_id uuid,p_request_id uuid,p_token text,
  p_intent jsonb,p_cancel boolean DEFAULT false,p_validity_days integer DEFAULT 365)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE c public."HomeInvitationDecisionCommand"%ROWTYPE; v_intent_hash text; v_token_hash text;
  v_home_id uuid; v_invitation_id uuid; r jsonb; v_context jsonb; v_error text; v_status integer;
BEGIN
  IF p_actor_id IS NULL OR p_request_id IS NULL OR p_token IS NULL OR length(p_token) NOT BETWEEN 1 AND 512
    OR p_cancel IS NULL OR p_validity_days IS NULL OR p_validity_days NOT BETWEEN 1 AND 3650
    OR jsonb_typeof(p_intent) IS DISTINCT FROM 'object' THEN
    RETURN '{"ok":false,"code":"INVITE_INVALID","status":400}'::jsonb; END IF;
  IF EXISTS(SELECT FROM jsonb_object_keys(p_intent) k WHERE k NOT IN ('home_id','invitation_id','action','decision_token'))
    OR EXISTS(SELECT FROM unnest(ARRAY['home_id','invitation_id','action','decision_token']) k WHERE jsonb_typeof(p_intent->k) IS DISTINCT FROM 'string')
    OR (p_intent->>'home_id') IS NULL OR (p_intent->>'home_id') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
    OR (p_intent->>'invitation_id') IS NULL OR (p_intent->>'invitation_id') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
    OR (p_intent->>'action') IS NULL OR (p_intent->>'action') NOT IN ('accept','decline')
    OR (p_intent->>'decision_token') IS NULL OR (p_intent->>'decision_token') !~ '^[a-f0-9]{64}$' THEN
    RETURN '{"ok":false,"code":"INVITE_INVALID","status":400}'::jsonb; END IF;
  v_home_id:=(p_intent->>'home_id')::uuid; v_invitation_id:=(p_intent->>'invitation_id')::uuid;
  v_intent_hash:=encode(sha256(convert_to(p_intent::text,'UTF8')),'hex');
  v_token_hash:=encode(sha256(convert_to(p_token,'UTF8')),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended('home-invitation-decision:'||p_actor_id::text,0));
  PERFORM 1 FROM public."User" WHERE id=p_actor_id FOR SHARE;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"INVITE_ACCOUNT_UNAVAILABLE","status":403}'::jsonb; END IF;
  SELECT * INTO c FROM public."HomeInvitationDecisionCommand"
    WHERE actor_user_id=p_actor_id AND request_id=p_request_id FOR UPDATE;
  IF FOUND THEN
    IF c.intent_hash<>v_intent_hash OR c.token_hash<>v_token_hash THEN
      RETURN '{"ok":false,"code":"INVITE_DECISION_CONFLICT","status":409}'::jsonb; END IF;
    RETURN public.home_invitation_decision_projection(c)||'{"replayed":true}'::jsonb;
  END IF;
  INSERT INTO public."HomeInvitationDecisionCommand"(actor_user_id,request_id,invitation_id,home_id,
    token_hash,intent_hash,action,decision_token,state)
    VALUES(p_actor_id,p_request_id,v_invitation_id,v_home_id,v_token_hash,v_intent_hash,
      p_intent->>'action',p_intent->>'decision_token',CASE WHEN p_cancel THEN 'cancelled' ELSE 'pending' END)
    RETURNING * INTO c;
  -- An unseen original is cancelled under the same lock as submission. A late
  -- submit cannot commit after this tombstone; cancelling never declines a link.
  IF p_cancel THEN RETURN public.home_invitation_decision_projection(c)||'{"replayed":false}'::jsonb; END IF;
  v_context:=public.prepare_home_invitation_decision(p_actor_id,p_token);
  IF v_context->>'ok' IS DISTINCT FROM 'true' THEN r:=v_context;
  ELSIF v_context->>'invitation_id'<>v_invitation_id::text OR v_context->>'home_id'<>v_home_id::text
    OR v_context->>'decision_token'<>p_intent->>'decision_token' THEN
    r:='{"ok":false,"code":"INVITE_DECISION_CHANGED","status":409}'::jsonb;
  ELSE
    r:=public.act_on_home_invitation(NULL,p_token,p_actor_id,p_intent->>'action',p_validity_days);
  END IF;
  IF r->>'ok' IS DISTINCT FROM 'true' THEN
    v_error:=r->>'code'; v_status:=(r->>'status')::integer;
    IF v_error IS NULL OR v_error !~ '^[A-Z][A-Z0-9_]{1,79}$'
      OR v_status IS NULL OR v_status NOT IN (400,403,404,409,410,422) THEN
      RAISE EXCEPTION 'Invitation decision unavailable'; END IF;
    UPDATE public."HomeInvitationDecisionCommand" SET state='rejected',error_code=v_error,error_status=v_status,
      updated_at=clock_timestamp() WHERE actor_user_id=p_actor_id AND request_id=p_request_id RETURNING * INTO c;
  ELSE
    IF r->>'kind'='claim_merge' OR jsonb_typeof(r->'replayed') IS DISTINCT FROM 'boolean'
      OR (c.action='accept' AND (r->>'homeId' IS DISTINCT FROM c.home_id::text
        OR r->'occupancy'->>'home_id' IS DISTINCT FROM c.home_id::text
        OR r->'occupancy'->>'user_id' IS DISTINCT FROM p_actor_id::text
        OR r->'occupancy'->>'id' IS NULL)) THEN
      RAISE EXCEPTION 'Invitation decision result mismatch'; END IF;
    UPDATE public."HomeInvitationDecisionCommand" SET state='completed',
      occupancy_id=CASE WHEN c.action='accept' THEN (r->'occupancy'->>'id')::uuid ELSE NULL END,
      updated_at=clock_timestamp() WHERE actor_user_id=p_actor_id AND request_id=p_request_id RETURNING * INTO c;
  END IF;
  -- Receipt failures roll back the decision and audit in the same transaction.
  -- Notification hints are transient and returned only to the service after a
  -- new acceptance; historical reads/replays never recover private Home labels.
  RETURN public.home_invitation_decision_projection(c)||jsonb_build_object('replayed',false)
    || CASE WHEN c.state='completed' AND c.action='accept' AND r->>'replayed'='false'
      THEN jsonb_build_object('notification',jsonb_build_object('inviter_id',r->'inviter_id','home_label',r->'home_label'))
      ELSE '{}'::jsonb END;
END $$;

REVOKE ALL ON FUNCTION public.home_invitation_decision_projection(public."HomeInvitationDecisionCommand"),
  public.prepare_home_invitation_decision(uuid,text),public.get_home_invitation_decision(uuid,uuid),
  public.resolve_home_invitation_decision(uuid,uuid,text,jsonb,boolean,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.home_invitation_decision_projection(public."HomeInvitationDecisionCommand"),
  public.prepare_home_invitation_decision(uuid,text),public.get_home_invitation_decision(uuid,uuid),
  public.resolve_home_invitation_decision(uuid,uuid,text,jsonb,boolean,integer) TO service_role;
