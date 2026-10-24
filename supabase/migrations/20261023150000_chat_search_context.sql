-- Backwards compatible: yes. Adds an index and service-only readers; existing
-- history and search clients keep working without new required arguments.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- Substring search preserves the existing search semantics, including mixed
-- languages, without downloading every conversation's first page to the app.
CREATE INDEX chat_message_search_trgm_idx ON public."ChatMessage"
  USING gin (message gin_trgm_ops) WHERE deleted = false;

CREATE FUNCTION public.search_chat_messages(
  p_user_id uuid, p_room_ids uuid[], p_query text,
  p_before_at timestamptz DEFAULT NULL, p_before_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 51
) RETURNS SETOF public."ChatMessage"
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT m.* FROM public."ChatMessage" m
  JOIN public."ChatParticipant" p ON p.room_id = m.room_id AND p.user_id = p_user_id
  WHERE m.room_id = ANY(p_room_ids) AND m.deleted = false
    AND (p.is_active = true OR (p.left_at IS NOT NULL AND m.created_at <= p.left_at))
    AND length(trim(p_query)) BETWEEN 1 AND 200
    AND m.message ILIKE '%' || replace(replace(replace(trim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    AND (p_before_at IS NULL OR m.created_at < p_before_at
      OR (m.created_at = p_before_at AND p_before_id IS NOT NULL AND m.id < p_before_id))
  ORDER BY m.created_at DESC, m.id DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 101);
$$;

CREATE FUNCTION public.get_chat_message_context(
  p_user_id uuid, p_room_ids uuid[], p_message_id uuid, p_limit_each_side integer DEFAULT 25
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH visible AS NOT MATERIALIZED (
    SELECT m.* FROM public."ChatMessage" m
    JOIN public."ChatParticipant" p ON p.room_id = m.room_id AND p.user_id = p_user_id
    WHERE m.room_id = ANY(p_room_ids) AND m.deleted = false
      AND (p.is_active = true OR (p.left_at IS NOT NULL AND m.created_at <= p.left_at))
  ), anchor AS (SELECT * FROM visible WHERE id = p_message_id),
  older AS (
    SELECT m.* FROM visible m, anchor a
    WHERE (m.created_at, m.id) < (a.created_at, a.id)
    ORDER BY m.created_at DESC, m.id DESC LIMIT LEAST(GREATEST(p_limit_each_side, 1), 100) + 1
  ), newer AS (
    SELECT m.* FROM visible m, anchor a
    WHERE (m.created_at, m.id) > (a.created_at, a.id)
    ORDER BY m.created_at, m.id LIMIT LEAST(GREATEST(p_limit_each_side, 1), 100) + 1
  )
  SELECT jsonb_build_object(
    'anchor', (SELECT to_jsonb(a) FROM anchor a),
    'older', COALESCE((SELECT jsonb_agg(to_jsonb(o) ORDER BY o.created_at DESC, o.id DESC) FROM older o), '[]'::jsonb),
    'newer', COALESCE((SELECT jsonb_agg(to_jsonb(n) ORDER BY n.created_at, n.id) FROM newer n), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.search_chat_messages(uuid, uuid[], text, timestamptz, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_chat_message_context(uuid, uuid[], uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_chat_messages(uuid, uuid[], text, timestamptz, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_chat_message_context(uuid, uuid[], uuid, integer) TO service_role;
COMMIT;
