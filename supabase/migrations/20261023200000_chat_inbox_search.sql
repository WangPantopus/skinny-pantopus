-- Backwards compatible: yes. Adds service-only search overloads while keeping
-- the existing inbox reader signature and response fields available.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- This returns candidate IDs only. The API must match their serialized public
-- identities before passing IDs to the inbox reader. Raw account-name matches
-- are never sufficient to expose a conversation in search results.
CREATE FUNCTION public.get_chat_inbox_search_candidates(p_user_id uuid, p_query text, p_after uuid DEFAULT NULL)
RETURNS TABLE(user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT DISTINCT other.user_id
    FROM public."ChatParticipant" mine
    JOIN public."ChatRoom" r ON r.id = mine.room_id AND r.type IN ('direct', 'gig')
    JOIN public."ChatParticipant" other ON other.room_id = r.id AND other.is_active AND other.user_id <> p_user_id
    JOIN public."User" u ON u.id = other.user_id
    LEFT JOIN public."LocalProfile" lp ON lp.user_id = u.id
    LEFT JOIN public."Gig" g ON r.type = 'gig' AND g.id = r.gig_id
   WHERE mine.user_id = p_user_id AND mine.is_active
     AND (p_after IS NULL OR other.user_id > p_after)
     AND (r.type <> 'gig' OR g.accepted_by IS NULL OR p_user_id IN (g.user_id, g.accepted_by)
       OR EXISTS (SELECT 1 FROM public."User" owner WHERE owner.id = g.user_id AND owner.account_type = 'business'
         AND (public.business_has_permission(g.user_id, 'gigs.manage', p_user_id)
           OR public.business_has_permission(g.user_id, 'gigs.post', p_user_id))))
     AND (r.type <> 'gig' OR g.accepted_by IS NULL OR other.user_id IN (g.user_id, g.accepted_by))
     AND strpos(lower(concat_ws(' ', lp.display_name, '@' || lp.handle, u.name, '@' || u.username,
       concat_ws(' ', nullif(btrim(u.first_name), ''), nullif(btrim(u.middle_name), ''), nullif(btrim(u.last_name), '')))),
       lower(p_query)) > 0
   ORDER BY other.user_id LIMIT 200;
$$;
REVOKE ALL ON FUNCTION public.get_chat_inbox_search_candidates(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_chat_inbox_search_candidates(uuid, text, uuid) TO service_role;

CREATE FUNCTION public.get_chat_inbox_page(
  p_user_id uuid, p_limit integer,
  p_before_at timestamptz, p_before_key text, p_since timestamptz,
  p_query text, p_matching_people uuid[]
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
WITH rooms AS MATERIALIZED (
  SELECT r.*, p.unread_count, p.notifications_enabled,
    greatest(r.updated_at, r.created_at, p.last_read_at, p.preferences_updated_at) AS changed_at,
    other.user_id AS other_id
  FROM public."ChatParticipant" p
  JOIN public."ChatRoom" r ON r.id = p.room_id
  LEFT JOIN public."Gig" g ON r.type = 'gig' AND g.id = r.gig_id
  LEFT JOIN LATERAL (
    SELECT cp.user_id FROM public."ChatParticipant" cp
    WHERE cp.room_id = r.id AND cp.is_active AND cp.user_id <> p_user_id
      AND (r.type <> 'gig' OR g.accepted_by IS NULL OR cp.user_id IN (g.user_id, g.accepted_by))
    ORDER BY cp.user_id LIMIT 1
  ) other ON r.type IN ('direct', 'gig')
  WHERE p.user_id = p_user_id AND p.is_active
    AND r.type IN ('direct', 'gig', 'group', 'home', 'plan', 'support_train')
    AND (r.type <> 'gig' OR g.accepted_by IS NULL OR p_user_id IN (g.user_id, g.accepted_by)
      OR EXISTS (SELECT 1 FROM public."User" owner WHERE owner.id = g.user_id AND owner.account_type = 'business'
        AND (public.business_has_permission(g.user_id, 'gigs.manage', p_user_id)
          OR public.business_has_permission(g.user_id, 'gigs.post', p_user_id))))
), previews AS MATERIALIZED (
  -- One index seek per room, instead of DISTINCT ON scanning every message.
  SELECT r.*, m.id AS message_id, m.created_at AS message_at,
    jsonb_build_object('message', left(m.message, 100), 'type', m.type, 'attachments', m.attachments) AS preview,
    CASE WHEN r.type IN ('direct', 'gig') THEN 'conversation:' || r.other_id::text ELSE 'room:' || r.id::text END AS entry_key,
    CASE WHEN r.type IN ('direct', 'gig') THEN coalesce(m.created_at, 'epoch'::timestamptz)
      ELSE coalesce(m.created_at, r.updated_at, r.created_at, 'epoch'::timestamptz) END AS sort_at
  FROM rooms r
  LEFT JOIN LATERAL (
    SELECT id, message, type, attachments, created_at FROM public."ChatMessage"
    WHERE room_id = r.id AND deleted = false ORDER BY created_at DESC, id DESC LIMIT 1
  ) m ON true
  WHERE r.type NOT IN ('direct', 'gig') OR r.other_id IS NOT NULL
), grouped AS MATERIALIZED (
  SELECT entry_key, max(other_id::text)::uuid AS other_id,
    array_agg(id ORDER BY id) AS room_ids,
    sum(coalesce(unread_count, 0)) AS total_unread,
    bool_or(notifications_enabled IS DISTINCT FROM false) AS notifications_enabled,
    max(message_at) AS last_message_at, max(sort_at) AS sort_at, max(changed_at) AS changed_at
  FROM previews GROUP BY entry_key
), matching AS (
  SELECT * FROM grouped c WHERE (p_since IS NULL OR c.changed_at > p_since
    OR (c.other_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public."ConversationTopic" t WHERE t.status = 'active'
        AND t.conversation_user_id_1 = least(p_user_id, c.other_id)
        AND t.conversation_user_id_2 = greatest(p_user_id, c.other_id)
        AND t.last_activity_at > p_since)))
    AND (p_query IS NULL OR c.other_id = ANY(p_matching_people)
      OR (c.other_id IS NULL AND EXISTS (
        SELECT 1 FROM rooms r
        LEFT JOIN public."SupportTrain" train ON train.id = r.support_train_id
        LEFT JOIN public."Activity" activity ON activity.id = train.activity_id
        WHERE r.id = ANY(c.room_ids)
          AND strpos(lower(coalesce(activity.title, r.name, '')), lower(p_query)) > 0))
      OR (c.other_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public."ConversationTopic" t WHERE t.status = 'active'
          AND t.conversation_user_id_1 = least(p_user_id, c.other_id)
          AND t.conversation_user_id_2 = greatest(p_user_id, c.other_id)
          AND strpos(lower(t.title), lower(p_query)) > 0)))
    AND (p_before_at IS NULL OR (c.sort_at, c.entry_key) < (p_before_at, p_before_key))
  ORDER BY sort_at DESC, entry_key DESC LIMIT least(greatest(p_limit, 1), 500) + 1
), page AS (
  SELECT * FROM matching ORDER BY sort_at DESC, entry_key DESC LIMIT least(greatest(p_limit, 1), 500)
), latest AS (
  SELECT DISTINCT ON (entry_key) entry_key, preview FROM previews
  WHERE message_id IS NOT NULL
  ORDER BY entry_key, message_at DESC, message_id DESC
), decorated AS (
  SELECT c.*, latest.preview AS last_message,
    CASE WHEN c.other_id IS NULL THEN to_jsonb(r) - ARRAY['unread_count','notifications_enabled','changed_at','other_id'] END AS room,
    coalesce(topics.items, '[]'::jsonb) AS topics
  FROM page c
  LEFT JOIN rooms r ON c.other_id IS NULL AND r.id = c.room_ids[1]
  LEFT JOIN latest ON latest.entry_key = c.entry_key
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(to_jsonb(t) ORDER BY t.last_activity_at DESC, t.id DESC) AS items FROM (
      SELECT id, topic_type, topic_ref_id, title, status, last_activity_at, conversation_user_id_1, conversation_user_id_2
      FROM public."ConversationTopic" WHERE c.other_id IS NOT NULL AND status = 'active'
        AND conversation_user_id_1 = least(p_user_id, c.other_id)
        AND conversation_user_id_2 = greatest(p_user_id, c.other_id)
      ORDER BY last_activity_at DESC, id DESC LIMIT 5
    ) t
  ) topics ON true
)
SELECT jsonb_build_object(
  'entries', coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.sort_at DESC, d.entry_key DESC) FROM decorated d), '[]'::jsonb),
  'total', (SELECT count(*) FROM grouped),
  'totalUnread', coalesce((SELECT sum(total_unread) FROM grouped), 0),
  'hasMore', (SELECT count(*) > least(greatest(p_limit, 1), 500) FROM matching)
);
$$;

REVOKE ALL ON FUNCTION public.get_chat_inbox_page(uuid, integer, timestamptz, text, timestamptz, text, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_chat_inbox_page(uuid, integer, timestamptz, text, timestamptz, text, uuid[]) TO service_role;

-- Old callers share the same reader without a search constraint.
CREATE OR REPLACE FUNCTION public.get_chat_inbox_page(
  p_user_id uuid, p_limit integer DEFAULT 100,
  p_before_at timestamptz DEFAULT NULL, p_before_key text DEFAULT NULL,
  p_since timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.get_chat_inbox_page(p_user_id, p_limit, p_before_at, p_before_key, p_since, NULL, '{}'::uuid[]);
$$;
COMMIT;
