-- Backwards compatible: yes. Serialize the existing five-question limit with task closure.
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION public.guard_gig_question_admission() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE g public."Gig";
BEGIN
 SELECT * INTO g FROM public."Gig" WHERE id=NEW.gig_id FOR UPDATE;
 IF NOT FOUND OR g.status NOT IN ('open','assigned','in_progress') THEN
  RAISE EXCEPTION 'GIG_QUESTION_CLOSED' USING ERRCODE='23514';
 END IF;
 IF EXISTS (SELECT FROM public."UserBlock" WHERE
   (blocker_user_id=g.user_id AND blocked_user_id=NEW.asked_by)
   OR (blocker_user_id=NEW.asked_by AND blocked_user_id=g.user_id)) THEN
  RAISE EXCEPTION 'GIG_QUESTION_BLOCKED' USING ERRCODE='23514';
 END IF;
 IF (SELECT count(*) FROM public."GigQuestion" WHERE gig_id=NEW.gig_id AND asked_by=NEW.asked_by) >= 5 THEN
  RAISE EXCEPTION 'GIG_QUESTION_LIMIT' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_gig_question_admission BEFORE INSERT ON public."GigQuestion"
 FOR EACH ROW EXECUTE FUNCTION public.guard_gig_question_admission();
REVOKE ALL ON FUNCTION public.guard_gig_question_admission() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guard_gig_question_admission() TO service_role;
