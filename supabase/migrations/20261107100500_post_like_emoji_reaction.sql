-- Backwards compatible: yes. Adds one nullable column to "PostLike" (with a length check every existing row passes)
-- and two new service-only functions. No existing function, row, index or grant changes: set_post_like and
-- toggle_post_like still add and remove a row without a reaction, so the deployed backend and older apps keep working,
-- and a reaction someone already chose stays when an older app likes the post again.
--
-- Pulse posts take an emoji reaction instead of the one Helpful mark (the founder's request, November 7). Each person
-- has at most one reaction on a post (the existing unique post_id, user_id), and Post.like_count still counts the
-- people who reacted. NULL is a mark made before emoji reactions or by an older app; the backend shows it as 👍. The
-- backend accepts only the emoji set in backend/utils/postReaction.js; the database only keeps the value short.
SET LOCAL lock_timeout = '5s';

ALTER TABLE public."PostLike" ADD COLUMN reaction text
  CONSTRAINT post_like_reaction_length CHECK (char_length(reaction) BETWEEN 1 AND 16);

COMMENT ON COLUMN public."PostLike".reaction IS
  'The emoji this person reacted with, or null for a mark made before emoji reactions (shown as a thumbs up).';

-- The viewer's reaction on a post, set to p_reaction; NULL removes it. like_count changes only when the person starts
-- or stops reacting, not when they switch emoji, and the count returned is the one after this statement. `added` is
-- true only when the person had no reaction before (the author is told once), `changed` when anything changed.
CREATE FUNCTION public.set_post_reaction(p_post_id uuid, p_user_id uuid, p_reaction text)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_added boolean := false;
  v_changed boolean := false;
  v_count integer;
BEGIN
  IF p_reaction IS NULL THEN
    DELETE FROM "PostLike" WHERE post_id = p_post_id AND user_id = p_user_id;
    v_changed := FOUND;
    IF v_changed THEN
      UPDATE "Post" SET like_count = GREATEST(like_count - 1, 0) WHERE id = p_post_id RETURNING like_count INTO v_count;
    END IF;
  ELSE
    -- xmax is 0 on a row this statement inserted and set on one it updated. A row that already has this reaction is
    -- left alone and returns nothing.
    INSERT INTO "PostLike" AS existing (post_id, user_id, reaction) VALUES (p_post_id, p_user_id, p_reaction)
    ON CONFLICT (post_id, user_id) DO UPDATE SET reaction = EXCLUDED.reaction
      WHERE existing.reaction IS DISTINCT FROM EXCLUDED.reaction
    RETURNING (existing.xmax = 0) INTO v_added;
    v_changed := FOUND;
    v_added := coalesce(v_added, false);
    IF v_added THEN
      UPDATE "Post" SET like_count = like_count + 1 WHERE id = p_post_id RETURNING like_count INTO v_count;
    END IF;
  END IF;
  IF v_count IS NULL THEN
    SELECT like_count INTO v_count FROM "Post" WHERE id = p_post_id;
  END IF;
  RETURN jsonb_build_object('reaction', p_reaction, 'likeCount', coalesce(v_count, 0), 'changed', v_changed,
    'added', v_added);
END;
$$;

-- How many people reacted with each emoji on each of these posts. A NULL reaction is a mark from before emoji
-- reactions; the backend counts it as 👍.
CREATE FUNCTION public.post_reaction_counts(p_post_ids uuid[])
RETURNS TABLE (post_id uuid, reaction text, reaction_count integer)
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT pl.post_id, pl.reaction, count(*)::integer
  FROM "PostLike" pl
  WHERE pl.post_id = ANY (p_post_ids)
  GROUP BY pl.post_id, pl.reaction
$$;

REVOKE ALL ON FUNCTION public.set_post_reaction(uuid, uuid, text), public.post_reaction_counts(uuid[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_post_reaction(uuid, uuid, text), public.post_reaction_counts(uuid[])
  TO service_role;
