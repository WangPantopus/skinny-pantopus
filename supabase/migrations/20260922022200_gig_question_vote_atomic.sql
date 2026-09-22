-- Backwards compatible: yes. Preserve the existing authenticated toggle contract.
-- Separate API writes can save a vote without its count or lose concurrent counts.
-- Reuse both existing tables; serialize each question and commit both changes together.
-- Apply before deploying the upvote handler that calls this function.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION public.toggle_gig_question_upvote(
  p_gig_id uuid, p_question_id uuid, p_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public, pg_temp
SET lock_timeout = '5s'
AS $$
DECLARE
  existing_vote_id uuid;
  was_upvoted boolean;
  vote_count integer;
BEGIN
  PERFORM 1 FROM public."GigQuestion"
  WHERE id = p_question_id AND gig_id = p_gig_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'QUESTION_NOT_FOUND');
  END IF;

  SELECT id INTO existing_vote_id FROM public."GigQuestionUpvote"
  WHERE question_id = p_question_id AND user_id = p_user_id;
  was_upvoted := FOUND;
  IF was_upvoted THEN
    DELETE FROM public."GigQuestionUpvote" WHERE id = existing_vote_id;
  ELSE
    INSERT INTO public."GigQuestionUpvote" (question_id, user_id)
    VALUES (p_question_id, p_user_id);
  END IF;

  SELECT count(*)::integer INTO vote_count FROM public."GigQuestionUpvote"
  WHERE question_id = p_question_id;
  UPDATE public."GigQuestion" SET upvote_count = vote_count
  WHERE id = p_question_id;

  RETURN jsonb_build_object('upvoted', NOT was_upvoted, 'upvote_count', vote_count);
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_gig_question_upvote(uuid, uuid, uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_gig_question_upvote(uuid, uuid, uuid)
TO service_role;
COMMIT;
