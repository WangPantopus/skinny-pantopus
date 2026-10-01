-- Backwards compatible: yes. Adds four service-only functions. The existing toggle
-- functions and routes are unchanged, and clients that send no desired state keep the
-- toggle. A like, comment like or repost is set to the state the person chose, and a
-- repeated request (for example a request re-sent after its reply was lost) changes
-- nothing instead of flipping the state back. An external share counts once per
-- person, post and 10 minutes.
SET LOCAL lock_timeout = '5s';

-- The viewer's like on a post, set to p_liked. The like count changes only when the like
-- does, and the count returned is the one after this statement.
CREATE FUNCTION public.set_post_like(p_post_id uuid, p_user_id uuid, p_liked boolean)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_changed boolean;
  v_count integer;
BEGIN
  IF p_liked THEN
    INSERT INTO "PostLike" (post_id, user_id) VALUES (p_post_id, p_user_id)
    ON CONFLICT (post_id, user_id) DO NOTHING;
    v_changed := FOUND;
    IF v_changed THEN
      UPDATE "Post" SET like_count = like_count + 1 WHERE id = p_post_id RETURNING like_count INTO v_count;
    END IF;
  ELSE
    DELETE FROM "PostLike" WHERE post_id = p_post_id AND user_id = p_user_id;
    v_changed := FOUND;
    IF v_changed THEN
      UPDATE "Post" SET like_count = GREATEST(like_count - 1, 0) WHERE id = p_post_id RETURNING like_count INTO v_count;
    END IF;
  END IF;
  IF NOT v_changed THEN
    SELECT like_count INTO v_count FROM "Post" WHERE id = p_post_id;
  END IF;
  RETURN jsonb_build_object('liked', p_liked, 'likeCount', coalesce(v_count, 0), 'changed', v_changed);
END;
$$;

-- The viewer's like on a comment, set to p_liked, with the same rules.
CREATE FUNCTION public.set_comment_like(p_comment_id uuid, p_user_id uuid, p_liked boolean)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_changed boolean;
  v_count integer;
BEGIN
  IF p_liked THEN
    INSERT INTO "CommentLike" (comment_id, user_id) VALUES (p_comment_id, p_user_id)
    ON CONFLICT (comment_id, user_id) DO NOTHING;
    v_changed := FOUND;
    IF v_changed THEN
      UPDATE "PostComment" SET like_count = coalesce(like_count, 0) + 1 WHERE id = p_comment_id
      RETURNING like_count INTO v_count;
    END IF;
  ELSE
    DELETE FROM "CommentLike" WHERE comment_id = p_comment_id AND user_id = p_user_id;
    v_changed := FOUND;
    IF v_changed THEN
      UPDATE "PostComment" SET like_count = GREATEST(coalesce(like_count, 0) - 1, 0) WHERE id = p_comment_id
      RETURNING like_count INTO v_count;
    END IF;
  END IF;
  IF NOT v_changed THEN
    SELECT like_count INTO v_count FROM "PostComment" WHERE id = p_comment_id;
  END IF;
  RETURN jsonb_build_object('liked', p_liked, 'likeCount', coalesce(v_count, 0), 'changed', v_changed);
END;
$$;

-- The viewer's repost of a post, set to p_reposted. PostShare has no unique key for reposts
-- (production may already hold duplicates), so a transaction lock per person and post
-- serializes the check and the write. share_count follows PostShare through its trigger.
CREATE FUNCTION public.set_post_repost(p_post_id uuid, p_user_id uuid, p_reposted boolean)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_exists boolean;
  v_changed boolean := false;
  v_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('post_repost:' || p_post_id::text || ':' || p_user_id::text));
  SELECT EXISTS (
    SELECT 1 FROM "PostShare" WHERE post_id = p_post_id AND user_id = p_user_id AND share_type = 'repost'
  ) INTO v_exists;
  IF p_reposted AND NOT v_exists THEN
    INSERT INTO "PostShare" (post_id, user_id, share_type) VALUES (p_post_id, p_user_id, 'repost');
    v_changed := true;
  ELSIF NOT p_reposted AND v_exists THEN
    DELETE FROM "PostShare" WHERE post_id = p_post_id AND user_id = p_user_id AND share_type = 'repost';
    v_changed := true;
  END IF;
  SELECT share_count INTO v_count FROM "Post" WHERE id = p_post_id;
  RETURN jsonb_build_object('reposted', p_reposted, 'shareCount', coalesce(v_count, 0), 'changed', v_changed);
END;
$$;

-- Records one external share per person, post and window (10 minutes by default). A repeat
-- inside the window records nothing, so share_count isn't inflated by retries or double taps.
CREATE FUNCTION public.record_post_share(p_post_id uuid, p_user_id uuid, p_window_minutes integer DEFAULT 10)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_recorded boolean := false;
  v_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('post_share:' || p_post_id::text || ':' || p_user_id::text));
  IF NOT EXISTS (
    SELECT 1 FROM "PostShare"
    WHERE post_id = p_post_id AND user_id = p_user_id AND share_type = 'external'
      AND created_at > now() - make_interval(mins => p_window_minutes)
  ) THEN
    INSERT INTO "PostShare" (post_id, user_id, share_type) VALUES (p_post_id, p_user_id, 'external');
    v_recorded := true;
  END IF;
  SELECT share_count INTO v_count FROM "Post" WHERE id = p_post_id;
  RETURN jsonb_build_object('recorded', v_recorded, 'shareCount', coalesce(v_count, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.set_post_like(uuid, uuid, boolean),
  public.set_comment_like(uuid, uuid, boolean),
  public.set_post_repost(uuid, uuid, boolean),
  public.record_post_share(uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_post_like(uuid, uuid, boolean),
  public.set_comment_like(uuid, uuid, boolean),
  public.set_post_repost(uuid, uuid, boolean),
  public.record_post_share(uuid, uuid, integer)
  TO service_role;
