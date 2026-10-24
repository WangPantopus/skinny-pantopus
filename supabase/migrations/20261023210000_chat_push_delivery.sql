-- Backwards compatible: yes. Founder approved this private delivery table on
-- October 23. Old API inserts default to the existing push path; new writers
-- explicitly request transactional delivery. No message text or device tokens.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public."ChatMessage" ADD COLUMN push_delivery_requested boolean NOT NULL DEFAULT false;
CREATE TABLE public."ChatPushDelivery" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public."ChatMessage"(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  identity_user_id uuid NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  business_notice boolean NOT NULL DEFAULT false,
  push_allowed_at_send boolean NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','leased','done','suppressed','expired')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_id uuid, lease_until timestamptz,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  completed_at timestamptz,
  accepted_registration_ids uuid[] NOT NULL DEFAULT '{}',
  notification_id uuid,
  UNIQUE (message_id, recipient_user_id)
);
ALTER TABLE public."ChatPushDelivery" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."ChatPushDelivery" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."ChatPushDelivery" TO service_role;
CREATE INDEX chat_push_recipient ON public."ChatPushDelivery"(recipient_user_id);
CREATE INDEX chat_push_identity ON public."ChatPushDelivery"(identity_user_id);
CREATE INDEX chat_push_pending ON public."ChatPushDelivery"(next_attempt_at, id) WHERE status = 'pending';
CREATE INDEX chat_push_leases ON public."ChatPushDelivery"(lease_until, id) WHERE status = 'leased';
CREATE INDEX chat_push_completed ON public."ChatPushDelivery"(completed_at, id) WHERE completed_at IS NOT NULL;

-- Same active membership, business permission and assigned-task boundary as chat.
CREATE FUNCTION public.chat_push_recipient_allowed(p_room uuid, p_recipient uuid, p_identity uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
SELECT EXISTS (
 SELECT 1 FROM public."ChatParticipant" cp JOIN public."ChatRoom" r ON r.id = cp.room_id
 LEFT JOIN public."Gig" g ON g.id = r.gig_id
 WHERE cp.room_id = p_room AND cp.user_id = p_identity AND cp.is_active
 AND (p_recipient = p_identity OR EXISTS (
   SELECT 1 FROM public."BusinessTeam" t JOIN public."User" b ON b.id = t.business_user_id
   WHERE t.business_user_id = p_identity AND t.user_id = p_recipient AND t.is_active AND b.account_type = 'business'
   AND (public.business_has_permission(p_identity, 'gigs.manage', p_recipient)
     OR public.business_has_permission(p_identity, 'gigs.post', p_recipient))))
 AND (r.type <> 'gig' OR g.accepted_by IS NULL OR p_identity IN (g.user_id, g.accepted_by)
   OR (public.business_has_permission(g.user_id, 'gigs.manage', p_recipient)
     OR public.business_has_permission(g.user_id, 'gigs.post', p_recipient)))
);
$$;

CREATE FUNCTION public.capture_chat_push_delivery() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
 IF NOT NEW.push_delivery_requested OR NEW.deleted THEN RETURN NEW; END IF;
 WITH members AS MATERIALIZED (
   SELECT cp.user_id, cp.notifications_enabled, u.account_type FROM public."ChatParticipant" cp
   JOIN public."User" u ON u.id = cp.user_id WHERE cp.room_id = NEW.room_id AND cp.is_active
 ), targets AS (
   SELECT user_id AS recipient, user_id AS identity, false AS business_notice, notifications_enabled FROM members
   UNION ALL
   SELECT t.user_id, m.user_id, true, m.notifications_enabled FROM members m
   JOIN public."BusinessTeam" t ON t.business_user_id = m.user_id AND t.is_active
   WHERE m.account_type = 'business' AND NOT EXISTS (SELECT 1 FROM members WHERE user_id = t.user_id)
 ), eligible AS (
   SELECT DISTINCT ON (t.recipient) t.* FROM targets t
   WHERE t.recipient NOT IN (NEW.user_id, coalesce(NEW.actor_user_id, NEW.user_id))
     AND t.identity <> NEW.user_id
     AND public.chat_push_recipient_allowed(NEW.room_id, t.recipient, t.identity)
     AND NOT EXISTS (SELECT 1 FROM public."UserBlock" b
       WHERE (b.blocker_user_id = NEW.user_id AND b.blocked_user_id IN (t.recipient,t.identity))
          OR (b.blocked_user_id = NEW.user_id AND b.blocker_user_id IN (t.recipient,t.identity)))
   ORDER BY t.recipient, t.business_notice, t.identity
 )
 INSERT INTO public."ChatPushDelivery"(message_id,recipient_user_id,identity_user_id,business_notice,push_allowed_at_send)
 SELECT NEW.id, e.recipient, e.identity, e.business_notice,
   e.notifications_enabled IS DISTINCT FROM false AND mp.push_notifications IS DISTINCT FROM false
   AND NOT (r.type IN ('direct','gig') AND NEW.user_id = ANY(coalesce(np.chat_muted_user_ids,'{}'::uuid[])))
 FROM eligible e JOIN public."ChatRoom" r ON r.id = NEW.room_id
 LEFT JOIN public."MailPreferences" mp ON mp.user_id = e.recipient
 LEFT JOIN public."UserNotificationPreferences" np ON np.user_id = e.identity
 ON CONFLICT (message_id,recipient_user_id) DO NOTHING;
 IF FOUND THEN PERFORM pg_notify('sync_changed','{"t":"ChatPushDelivery"}'); END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER capture_chat_push AFTER INSERT ON public."ChatMessage"
FOR EACH ROW EXECUTE FUNCTION public.capture_chat_push_delivery();

CREATE FUNCTION public.claim_chat_push_delivery(p_limit integer DEFAULT 4)
RETURNS SETOF public."ChatPushDelivery" LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
 -- Bounded retention; no full-table cleanup in the send transaction.
 DELETE FROM public."ChatPushDelivery" WHERE id IN (
   SELECT id FROM public."ChatPushDelivery" WHERE completed_at < now() - interval '7 days'
   ORDER BY completed_at LIMIT 200 FOR UPDATE SKIP LOCKED);
 UPDATE public."ChatPushDelivery" SET status = 'expired', completed_at = now(), lease_id = NULL, lease_until = NULL
 WHERE id IN (SELECT id FROM public."ChatPushDelivery"
   WHERE ((status = 'pending' AND next_attempt_at <= now()) OR (status = 'leased' AND lease_until <= now()))
   AND (expires_at <= now() OR attempts >= 12) LIMIT 200 FOR UPDATE SKIP LOCKED);
 RETURN QUERY WITH candidates AS (
   SELECT id FROM public."ChatPushDelivery"
   WHERE ((status = 'pending' AND next_attempt_at <= now()) OR (status = 'leased' AND lease_until <= now()))
   AND expires_at > now() AND attempts < 12 ORDER BY next_attempt_at, id
   LIMIT least(greatest(p_limit,1),4) FOR UPDATE SKIP LOCKED
 ) UPDATE public."ChatPushDelivery" j SET status = 'leased', attempts = attempts + 1,
   lease_id = gen_random_uuid(), lease_until = now() + interval '2 minutes'
 FROM candidates c WHERE j.id = c.id RETURNING j.*;
END;
$$;

CREATE FUNCTION public.read_chat_push_delivery(p_id uuid, p_lease uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
SELECT jsonb_build_object('message', to_jsonb(m), 'pushAllowed',
 j.push_allowed_at_send AND cp.notifications_enabled IS DISTINCT FROM false
 AND mp.push_notifications IS DISTINCT FROM false
 AND NOT (r.type IN ('direct','gig') AND m.user_id = ANY(coalesce(np.chat_muted_user_ids,'{}'::uuid[]))))
FROM public."ChatPushDelivery" j JOIN public."ChatMessage" m ON m.id = j.message_id
JOIN public."ChatRoom" r ON r.id = m.room_id
JOIN public."ChatParticipant" cp ON cp.room_id = m.room_id AND cp.user_id = j.identity_user_id
LEFT JOIN public."MailPreferences" mp ON mp.user_id = j.recipient_user_id
LEFT JOIN public."UserNotificationPreferences" np ON np.user_id = j.identity_user_id
WHERE j.id = p_id AND j.lease_id = p_lease AND j.status = 'leased' AND j.lease_until > now() AND j.expires_at > now()
 AND NOT m.deleted AND r.is_active IS DISTINCT FROM false
 AND public.chat_push_recipient_allowed(m.room_id, j.recipient_user_id, j.identity_user_id)
 AND (cp.last_read_message_at IS NULL OR (m.created_at,m.id) > (cp.last_read_message_at,cp.last_read_message_id))
 AND (cp.last_read_message_at IS NOT NULL OR cp.last_read_at IS NULL OR m.created_at > cp.last_read_at)
 AND NOT EXISTS (SELECT 1 FROM public."UserBlock" b
   WHERE (b.blocker_user_id = m.user_id AND b.blocked_user_id IN (j.recipient_user_id,j.identity_user_id))
      OR (b.blocked_user_id = m.user_id AND b.blocker_user_id IN (j.recipient_user_id,j.identity_user_id)))
 AND NOT EXISTS (SELECT 1 FROM public."Plan" p WHERE p.chat_room_id = r.id
   AND (p.status = 'cancelled' OR p.chat_closed_at IS NOT NULL));
$$;

-- The bell row and its durable reference commit together. Deleting/read-marking
-- an existing bell cannot cause a retry to recreate it or reset its read state.
CREATE FUNCTION public.prepare_chat_push_notice(p_id uuid,p_lease uuid,p_title text,p_body text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE j public."ChatPushDelivery"; m public."ChatMessage"; n public."Notification"; fresh boolean := false;
BEGIN
 SELECT * INTO j FROM public."ChatPushDelivery" WHERE id = p_id AND lease_id = p_lease AND status = 'leased'
   AND lease_until > now() FOR UPDATE;
 IF NOT FOUND OR NOT j.business_notice OR public.read_chat_push_delivery(p_id,p_lease) IS NULL THEN RETURN NULL; END IF;
 IF j.notification_id IS NULL THEN
   SELECT * INTO m FROM public."ChatMessage" WHERE id = j.message_id;
   INSERT INTO public."Notification"(id,user_id,type,title,body,icon,link,metadata,context_type,context_id,context,idempotency_key)
   VALUES (j.id,j.recipient_user_id,'business_message',p_title,p_body,'💬',
     '/app/businesses/' || j.identity_user_id || '/chat/' || m.room_id,
     jsonb_build_object('business_user_id',j.identity_user_id,'room_id',m.room_id,'user_id',m.user_id,'message_id',m.id),
     'business',j.identity_user_id,'personal','business-message:' || m.id || ':' || j.identity_user_id || ':' || j.recipient_user_id)
   ON CONFLICT DO NOTHING RETURNING * INTO n;
   fresh := FOUND;
   IF NOT fresh THEN SELECT * INTO n FROM public."Notification"
     WHERE idempotency_key = 'business-message:' || m.id || ':' || j.identity_user_id || ':' || j.recipient_user_id; END IF;
   IF n.id IS NULL THEN RAISE EXCEPTION 'Business notice unavailable'; END IF;
   UPDATE public."ChatPushDelivery" SET notification_id = n.id WHERE id = j.id;
 ELSE SELECT * INTO n FROM public."Notification" WHERE id = j.notification_id;
 END IF;
 RETURN jsonb_build_object('notice',CASE WHEN n.id IS NULL THEN NULL ELSE to_jsonb(n) END,'created',fresh);
END;
$$;

CREATE FUNCTION public.renew_chat_push_delivery(p_id uuid,p_lease uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
 UPDATE public."ChatPushDelivery" SET lease_until = now() + interval '2 minutes'
 WHERE id = p_id AND lease_id = p_lease AND status = 'leased' AND lease_until > now() AND expires_at > now();
 RETURN FOUND;
END;
$$;

CREATE FUNCTION public.finish_chat_push_delivery(p_id uuid,p_lease uuid,p_status text,p_accepted uuid[] DEFAULT '{}')
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
 IF p_status NOT IN ('pending','done','suppressed') THEN RAISE EXCEPTION 'Invalid delivery state'; END IF;
 UPDATE public."ChatPushDelivery" j SET status = p_status, lease_id = NULL, lease_until = NULL,
   completed_at = CASE WHEN p_status = 'pending' THEN NULL ELSE now() END,
   next_attempt_at = now() + make_interval(secs => least(900,5 * (2 ^ least(j.attempts,8))::integer)),
   accepted_registration_ids = ARRAY(SELECT DISTINCT x FROM unnest(j.accepted_registration_ids || coalesce(p_accepted,'{}')) x)
 WHERE j.id = p_id AND j.lease_id = p_lease AND j.status = 'leased' AND j.lease_until > now();
 RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.chat_push_recipient_allowed(uuid,uuid,uuid), public.capture_chat_push_delivery(),
 public.claim_chat_push_delivery(integer),public.read_chat_push_delivery(uuid,uuid),public.renew_chat_push_delivery(uuid,uuid),
 public.prepare_chat_push_notice(uuid,uuid,text,text),public.finish_chat_push_delivery(uuid,uuid,text,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.chat_push_recipient_allowed(uuid,uuid,uuid),public.claim_chat_push_delivery(integer),
 public.read_chat_push_delivery(uuid,uuid),public.renew_chat_push_delivery(uuid,uuid),public.prepare_chat_push_notice(uuid,uuid,text,text),
 public.finish_chat_push_delivery(uuid,uuid,text,uuid[]) TO service_role;
COMMIT;
