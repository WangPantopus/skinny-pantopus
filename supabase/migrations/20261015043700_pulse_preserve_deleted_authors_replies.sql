-- Backwards compatible: yes. Account deletion keeps anonymous, soft-deleted
-- reply placeholders. Legacy reply endpoints already exclude is_deleted rows.
-- Posts still cascade normally; other people's replies on surviving posts stay.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public."PostComment" ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public."PostComment" DROP CONSTRAINT "PostComment_user_id_fkey";
ALTER TABLE public."PostComment" ADD CONSTRAINT "PostComment_user_id_fkey"
  FOREIGN KEY (user_id) REFERENCES public."User"(id) ON DELETE SET NULL;

-- Scrub in the same transaction as the User delete, including administrative
-- deletion. A failed deletion rolls back the scrub as well. File ownership's
-- existing User cascade removes the deleting person's attachment rows.
CREATE FUNCTION public.pulse_scrub_deleted_author_replies()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public."PostComment"
  SET comment = '', is_deleted = true, is_edited = false, edited_at = NULL,
      mentioned_business_ids = '{}'::uuid[], like_count = 0,
      moderation_state = 'live', moderation_rule = NULL
  WHERE user_id = OLD.id;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.pulse_scrub_deleted_author_replies() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_scrub_deleted_author_replies() TO service_role;
CREATE TRIGGER pulse_scrub_deleted_author_replies
  BEFORE DELETE ON public."User"
  FOR EACH ROW EXECUTE FUNCTION public.pulse_scrub_deleted_author_replies();

-- Preserve the existing atomic count increments, but a removed placeholder is
-- not a reply in legacy cards. Do not decrement it again when its post is deleted.
CREATE OR REPLACE FUNCTION public.sync_post_comment_count() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  delta integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    delta := CASE WHEN NEW.is_deleted IS TRUE THEN 0 ELSE 1 END;
  ELSIF TG_OP = 'DELETE' THEN
    delta := CASE WHEN OLD.is_deleted IS TRUE THEN 0 ELSE -1 END;
  ELSE
    delta := CASE WHEN NEW.is_deleted IS TRUE THEN 0 ELSE 1 END
           - CASE WHEN OLD.is_deleted IS TRUE THEN 0 ELSE 1 END;
  END IF;
  IF delta <> 0 THEN
    UPDATE public."Post" SET comment_count = GREATEST(COALESCE(comment_count, 0) + delta, 0)
    WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.post_id ELSE NEW.post_id END;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER trg_sync_comment_count ON public."PostComment";
CREATE TRIGGER trg_sync_comment_count
  AFTER INSERT OR DELETE OR UPDATE OF is_deleted ON public."PostComment"
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_comment_count();

COMMIT;
