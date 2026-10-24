-- Backwards compatible: yes. Adds a defaulted room counter, maintains existing
-- unread counters and exposes a service-only statistics reader with old fields.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE public."ChatRoom" ADD COLUMN message_count bigint NOT NULL DEFAULT 0;
UPDATE public."ChatRoom" r SET message_count = counts.n
  FROM (SELECT room_id, count(*) AS n FROM public."ChatMessage" WHERE deleted = false GROUP BY room_id) counts
 WHERE r.id = counts.room_id;

CREATE FUNCTION public.maintain_chat_message_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  difference integer;
  row_value public."ChatMessage"%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    difference := CASE WHEN NEW.deleted = false THEN 1 ELSE 0 END;
    row_value := NEW;
  ELSIF TG_OP = 'DELETE' THEN
    difference := CASE WHEN OLD.deleted = false THEN -1 ELSE 0 END;
    row_value := OLD;
  ELSE
    difference := (CASE WHEN NEW.deleted = false THEN 1 ELSE 0 END)
                - (CASE WHEN OLD.deleted = false THEN 1 ELSE 0 END);
    row_value := NEW;
  END IF;
  IF difference = 0 THEN RETURN NULL; END IF;
  UPDATE public."ChatRoom" SET message_count = message_count + difference WHERE id = row_value.room_id;
  -- INSERT has its existing unread trigger. A removal/restoration changes only
  -- recipients whose read boundary has not passed this message. The row lock
  -- serializes the arithmetic with simultaneous reads and sends.
  IF TG_OP <> 'INSERT' THEN
    UPDATE public."ChatParticipant" p SET unread_count = greatest(0, coalesce(p.unread_count, 0) + difference)
     WHERE p.room_id = row_value.room_id AND p.is_active AND p.user_id <> row_value.user_id
       AND ((p.last_read_message_at IS NULL AND (p.last_read_at IS NULL OR row_value.created_at > p.last_read_at))
         OR (row_value.created_at, row_value.id) >
           (p.last_read_message_at, coalesce(p.last_read_message_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)));
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER maintain_chat_message_count AFTER INSERT OR UPDATE OR DELETE ON public."ChatMessage"
FOR EACH ROW EXECUTE FUNCTION public.maintain_chat_message_count();
REVOKE ALL ON FUNCTION public.maintain_chat_message_count() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.increment_unread_count() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.deleted = false THEN
    UPDATE public."ChatParticipant" p SET unread_count = coalesce(p.unread_count, 0) + 1
     WHERE p.room_id = NEW.room_id AND p.user_id <> NEW.user_id AND p.is_active
       AND ((p.last_read_message_at IS NULL AND (p.last_read_at IS NULL OR NEW.created_at > p.last_read_at))
         OR (NEW.created_at, NEW.id) >
           (p.last_read_message_at, coalesce(p.last_read_message_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)));
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.get_chat_statistics(p_user_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'total_chats', count(*), 'total_messages', coalesce(sum(r.message_count), 0),
    'total_unread', coalesce(sum(p.unread_count), 0),
    'direct_chats', count(*) FILTER (WHERE r.type = 'direct'),
    'gig_chats', count(*) FILTER (WHERE r.type = 'gig'),
    'home_chats', count(*) FILTER (WHERE r.type = 'home'))
  FROM public."ChatParticipant" p JOIN public."ChatRoom" r ON r.id = p.room_id
  LEFT JOIN public."Gig" g ON r.type = 'gig' AND g.id = r.gig_id
  WHERE p.user_id = p_user_id AND p.is_active
    AND (r.type <> 'gig' OR g.accepted_by IS NULL OR p_user_id IN (g.user_id, g.accepted_by)
      OR EXISTS (SELECT 1 FROM public."User" owner WHERE owner.id = g.user_id AND owner.account_type = 'business'
        AND (public.business_has_permission(g.user_id, 'gigs.manage', p_user_id)
          OR public.business_has_permission(g.user_id, 'gigs.post', p_user_id))));
$$;
REVOKE ALL ON FUNCTION public.get_chat_statistics(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_chat_statistics(uuid) TO service_role;
COMMIT;
