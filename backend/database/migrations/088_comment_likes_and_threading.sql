-- Migration: Comment likes toggle function + comment rate limiting
-- Enables: threaded comment likes, spam prevention for rapid commenting

-- ============================================================
-- toggle_comment_like RPC  (mirrors toggle_post_like pattern)
-- ============================================================
CREATE OR REPLACE FUNCTION "public"."toggle_comment_like"(
  "p_comment_id" uuid,
  "p_user_id" uuid
) RETURNS jsonb
  LANGUAGE plpgsql
  SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_exists BOOLEAN;
  v_new_count INT;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM "CommentLike"
    WHERE comment_id = p_comment_id AND user_id = p_user_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM "CommentLike"
    WHERE comment_id = p_comment_id AND user_id = p_user_id;

    UPDATE "PostComment"
    SET like_count = GREATEST(like_count - 1, 0)
    WHERE id = p_comment_id
    RETURNING like_count INTO v_new_count;

    RETURN jsonb_build_object(
      'liked', false,
      'likeCount', COALESCE(v_new_count, 0)
    );
  ELSE
    INSERT INTO "CommentLike" (comment_id, user_id)
    VALUES (p_comment_id, p_user_id);

    UPDATE "PostComment"
    SET like_count = like_count + 1
    WHERE id = p_comment_id
    RETURNING like_count INTO v_new_count;

    RETURN jsonb_build_object(
      'liked', true,
      'likeCount', v_new_count
    );
  END IF;
END;
$$;

ALTER FUNCTION "public"."toggle_comment_like"("p_comment_id" uuid, "p_user_id" uuid) OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."toggle_comment_like"("p_comment_id" uuid, "p_user_id" uuid) TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_comment_like"("p_comment_id" uuid, "p_user_id" uuid) TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_comment_like"("p_comment_id" uuid, "p_user_id" uuid) TO "service_role";
