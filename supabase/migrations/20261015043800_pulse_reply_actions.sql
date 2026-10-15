-- Backwards compatible: yes. Adds optional Helpful fields and the approved
-- private CommentThanks table. Existing comment/like APIs are unchanged.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public."PostComment"
  ADD COLUMN helpful_at timestamptz,
  ADD COLUMN helpful_by uuid REFERENCES public."User"(id) ON DELETE SET NULL;

-- Comment writes use the existing backend endpoints. Table-wide client grants
-- would otherwise let a reply's author set the asker's Helpful fields directly.
REVOKE INSERT, UPDATE ON public."PostComment" FROM anon, authenticated;

CREATE TABLE public."CommentThanks" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public."PostComment"(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, from_user_id),
  CHECK (from_user_id <> to_user_id)
);
ALTER TABLE public."CommentThanks" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."CommentThanks" FROM anon, authenticated;
GRANT ALL ON public."CommentThanks" TO service_role;
CREATE INDEX ON public."CommentThanks" (from_user_id);
CREATE INDEX ON public."CommentThanks" (to_user_id);

-- Lock the post before its reply: simultaneous marks share a single transition.
-- The server checks the shared audience wall first. A concurrent scope change
-- invalidates that snapshot; blocks and removal are also rechecked under the lock.
CREATE FUNCTION public.pulse_reply_action(
  p_post_id uuid, p_reply_id uuid, p_user_id uuid, p_action text,
  p_helpful boolean, p_read_scope text, p_area_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  post public."Post";
  reply public."PostComment";
  thanks public."CommentThanks";
  can_change_state boolean;
BEGIN
  SELECT * INTO post FROM public."Post" WHERE id = p_post_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('code', 'POST_NOT_FOUND'); END IF;
  IF post.read_scope IS DISTINCT FROM p_read_scope OR post.area_id IS DISTINCT FROM p_area_id
      OR post.moderation_state <> 'live' THEN
    RETURN jsonb_build_object('code', 'POST_CHANGED');
  END IF;
  SELECT * INTO reply FROM public."PostComment"
    WHERE id = p_reply_id AND post_id = p_post_id FOR UPDATE;
  IF NOT FOUND OR reply.is_deleted IS TRUE OR reply.user_id IS NULL OR reply.moderation_state <> 'live' THEN
    RETURN jsonb_build_object('code', 'REPLY_NOT_FOUND');
  END IF;
  IF EXISTS (SELECT 1 FROM public."UserBlock" b
    WHERE (b.blocker_user_id = p_user_id AND b.blocked_user_id IN (post.user_id, reply.user_id))
       OR (b.blocked_user_id = p_user_id AND b.blocker_user_id IN (post.user_id, reply.user_id))) THEN
    RETURN jsonb_build_object('code', 'REPLY_NOT_FOUND');
  END IF;

  IF p_action = 'helpful' THEN
    IF post.user_id <> p_user_id THEN RETURN jsonb_build_object('code', 'NOT_POST_AUTHOR'); END IF;
    IF post.post_type <> 'ask_local' THEN RETURN jsonb_build_object('code', 'NOT_AN_ASK'); END IF;
    IF p_helpful IS NULL THEN RETURN jsonb_build_object('code', 'INVALID_ACTION'); END IF;
    UPDATE public."PostComment" SET
      helpful_at = CASE WHEN p_helpful THEN COALESCE(helpful_at, now()) ELSE NULL END,
      helpful_by = CASE WHEN p_helpful THEN p_user_id ELSE NULL END
    WHERE id = p_reply_id RETURNING * INTO reply;

    can_change_state := post.archived_at IS NULL AND post.state IN ('open', 'solved')
      AND (post.resolution IS NULL OR post.resolution = 'answered')
      AND COALESCE(post.expires_at, post.created_at + make_interval(days =>
        COALESCE((SELECT ttl_days FROM public."PostCategoryTTL" WHERE post_type = 'ask_local'), 7))) > now();
    IF can_change_state THEN
      IF EXISTS (SELECT 1 FROM public."PostComment" c WHERE c.post_id = p_post_id
        AND c.helpful_at IS NOT NULL AND c.is_deleted IS NOT TRUE AND c.moderation_state = 'live') THEN
        UPDATE public."Post" SET state = 'solved', resolution = 'answered',
          resolved_at = COALESCE(resolved_at, now()) WHERE id = p_post_id;
      ELSIF post.resolution = 'answered' THEN
        UPDATE public."Post" SET state = 'open', resolution = NULL, resolved_at = NULL WHERE id = p_post_id;
      END IF;
    END IF;
    RETURN jsonb_build_object('helpful_at', reply.helpful_at, 'to_user_id', reply.user_id);
  ELSIF p_action = 'thanks' THEN
    IF reply.user_id = p_user_id THEN RETURN jsonb_build_object('code', 'OWN_REPLY'); END IF;
    INSERT INTO public."CommentThanks" (comment_id, from_user_id, to_user_id)
      VALUES (p_reply_id, p_user_id, reply.user_id)
      ON CONFLICT (comment_id, from_user_id) DO NOTHING;
    SELECT * INTO thanks FROM public."CommentThanks"
      WHERE comment_id = p_reply_id AND from_user_id = p_user_id;
    RETURN jsonb_build_object('thanks_id', thanks.id, 'to_user_id', thanks.to_user_id);
  END IF;
  RETURN jsonb_build_object('code', 'INVALID_ACTION');
END;
$$;
REVOKE ALL ON FUNCTION public.pulse_reply_action(uuid, uuid, uuid, text, boolean, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_reply_action(uuid, uuid, uuid, text, boolean, text, uuid) TO service_role;
COMMIT;
