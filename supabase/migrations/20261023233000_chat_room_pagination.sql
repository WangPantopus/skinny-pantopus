-- Backwards compatible: yes. Adds a service-only paged overload; existing
-- two-argument room readers and response fields remain available.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION public.get_user_chat_rooms(
  p_user_id uuid, p_limit integer, p_before_at timestamptz,
  p_before_id uuid, p_type text, p_actor_id uuid
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
WITH eligible AS MATERIALIZED (
  SELECT r.id, cp.unread_count,
    jsonb_build_object('room_id', r.id, 'unread_count', cp.unread_count,
      'last_read_at', cp.last_read_at, 'notifications_enabled', cp.notifications_enabled,
      'preferences_updated_at', cp.preferences_updated_at, 'role', cp.role, 'is_active', cp.is_active,
      'room', jsonb_build_object('id', r.id, 'type', r.type, 'name', r.name,
        'description', r.description, 'gig_id', r.gig_id, 'home_id', r.home_id,
        'is_active', r.is_active, 'created_at', r.created_at, 'updated_at', r.updated_at)) AS membership,
    coalesce(latest.created_at, r.updated_at, r.created_at, 'epoch'::timestamptz) AS sort_at
  FROM public."ChatParticipant" cp
  JOIN public."ChatRoom" r ON r.id = cp.room_id
  LEFT JOIN public."Gig" g ON r.type = 'gig' AND g.id = r.gig_id
  LEFT JOIN LATERAL (
    SELECT m.created_at FROM public."ChatMessage" m
    WHERE m.room_id = r.id AND NOT m.deleted
    ORDER BY m.created_at DESC, m.id DESC LIMIT 1
  ) latest ON true
  WHERE cp.user_id = p_user_id AND cp.is_active
    AND (p_type IS NULL OR r.type = p_type)
    AND (r.type <> 'gig' OR g.accepted_by IS NULL
      OR p_user_id IN (g.user_id, g.accepted_by)
      OR p_actor_id IN (g.user_id, g.accepted_by)
      OR EXISTS (SELECT 1 FROM public."User" owner
        WHERE owner.id = g.user_id AND owner.account_type = 'business'
          AND (public.business_has_permission(g.user_id, 'gigs.manage', p_actor_id)
            OR public.business_has_permission(g.user_id, 'gigs.post', p_actor_id))))
), matching AS (
  SELECT * FROM eligible
  WHERE p_before_at IS NULL OR (sort_at, id) < (p_before_at, p_before_id)
  ORDER BY sort_at DESC, id DESC LIMIT least(greatest(p_limit, 1), 500) + 1
), page AS (
  SELECT * FROM matching ORDER BY sort_at DESC, id DESC LIMIT least(greatest(p_limit, 1), 500)
)
SELECT jsonb_build_object(
  'entries', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'sort_at', sort_at, 'membership', membership)
    ORDER BY sort_at DESC, id DESC) FROM page), '[]'::jsonb),
  'total', (SELECT count(*) FROM eligible),
  'totalUnread', coalesce((SELECT sum(unread_count) FROM eligible), 0),
  'hasMore', (SELECT count(*) > least(greatest(p_limit, 1), 500) FROM matching)
);
$$;
REVOKE ALL ON FUNCTION public.get_user_chat_rooms(uuid, integer, timestamptz, uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_chat_rooms(uuid, integer, timestamptz, uuid, text, uuid)
  TO service_role;
COMMIT;
