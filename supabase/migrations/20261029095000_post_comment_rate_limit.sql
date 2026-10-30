-- Backwards compatible: yes. Enforces the existing five-comments-per-minute
-- rule on the existing table, including concurrent writes and draft retries.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE INDEX IF NOT EXISTS idx_post_comment_author_recent
  ON public."PostComment" (post_id, user_id, created_at);

CREATE FUNCTION public.enforce_post_comment_rate_limit()
RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'post-comment:' || NEW.post_id::text || ':' || NEW.user_id::text, 0));

  -- INSERT ... ON CONFLICT runs BEFORE INSERT triggers even for a retry.
  -- The route verifies that the saved draft's author, post and content match.
  IF EXISTS (SELECT 1 FROM public."PostComment" WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;
  IF (SELECT count(*) FROM public."PostComment"
      WHERE post_id = NEW.post_id AND user_id = NEW.user_id
        AND created_at >= clock_timestamp() - interval '60 seconds') >= 5 THEN
    RAISE EXCEPTION 'POST_COMMENT_RATE_LIMIT' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_post_comment_rate_limit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_post_comment_rate_limit() TO service_role;

CREATE TRIGGER trg_post_comment_rate_limit
  BEFORE INSERT ON public."PostComment"
  FOR EACH ROW EXECUTE FUNCTION public.enforce_post_comment_rate_limit();

COMMIT;
