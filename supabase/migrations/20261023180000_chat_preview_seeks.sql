-- Backwards compatible: yes. Keeps the existing preview signature, invoker
-- permissions and row shape; each room now seeks its latest visible message.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.get_room_previews(p_room_ids uuid[])
RETURNS TABLE(room_id uuid, message text, created_at timestamptz, deleted boolean, type text, attachments jsonb)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
  SELECT m.room_id, m.message, m.created_at, m.deleted, m.type, m.attachments
    FROM (SELECT DISTINCT unnest(p_room_ids) AS id) rooms
    CROSS JOIN LATERAL (
      SELECT candidate.room_id, candidate.message, candidate.created_at,
             candidate.deleted, candidate.type, candidate.attachments
        FROM public."ChatMessage" candidate
       WHERE candidate.room_id = rooms.id AND candidate.deleted = false
       ORDER BY candidate.created_at DESC, candidate.id DESC
       LIMIT 1
    ) m
   ORDER BY m.room_id;
$$;
COMMIT;
