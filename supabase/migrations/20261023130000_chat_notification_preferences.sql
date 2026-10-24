-- Backwards compatible: yes. Extends existing private notification preferences
-- and chat participants; keeps room settings and adds durable person mute state.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public."UserNotificationPreferences"
  ADD COLUMN IF NOT EXISTS chat_muted_user_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public."ChatParticipant"
  ADD COLUMN IF NOT EXISTS preferences_updated_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_chat_notifications(
  p_user_id uuid, p_room_ids uuid[], p_enabled boolean, p_other_user_id uuid DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF p_enabled IS NULL OR coalesce(cardinality(p_room_ids), 0) = 0 THEN
    RAISE EXCEPTION 'Invalid preferences' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_room_ids) r(id) WHERE NOT EXISTS (
    SELECT 1 FROM public."ChatParticipant" p
    WHERE p.room_id = r.id AND p.user_id = p_user_id AND p.is_active
  )) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501'; END IF;

  -- The person preference also applies to future task rooms with this sender.
  -- Concurrent changes to different people merge rather than overwriting a list.
  IF p_other_user_id IS NOT NULL THEN
    INSERT INTO public."UserNotificationPreferences"(user_id, chat_muted_user_ids)
    VALUES (p_user_id, CASE WHEN p_enabled THEN '{}'::uuid[] ELSE ARRAY[p_other_user_id] END)
    ON CONFLICT (user_id) DO UPDATE SET chat_muted_user_ids = CASE WHEN p_enabled
      THEN array_remove("UserNotificationPreferences".chat_muted_user_ids, p_other_user_id)
      ELSE array_append(array_remove("UserNotificationPreferences".chat_muted_user_ids, p_other_user_id), p_other_user_id) END,
      updated_at = now();
  END IF;
  UPDATE public."ChatParticipant" SET notifications_enabled = p_enabled, preferences_updated_at = now()
  WHERE room_id = ANY(p_room_ids) AND user_id = p_user_id AND is_active;
END;
$$;
REVOKE ALL ON FUNCTION public.set_chat_notifications(uuid, uuid[], boolean, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_chat_notifications(uuid, uuid[], boolean, uuid) TO service_role;
COMMIT;
