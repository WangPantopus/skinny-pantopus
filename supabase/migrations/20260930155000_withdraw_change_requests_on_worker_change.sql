-- Backwards compatible: yes. Adds one trigger function and one AFTER UPDATE
-- trigger on "Gig"; no table or column changes and no rows change when this is
-- applied. The deployed backend and apps already show withdrawn change requests
-- (web also shows the reason), and approving or declining one returns "Change
-- order is already withdrawn".
--
-- A change request is made between a task's poster and its current helper: the
-- helper asks to add scope or time, or the poster asks the helper for it. When
-- the helper changed (they released themselves, or the poster reopened the
-- task), the pending requests stayed pending. The next helper saw the previous
-- helper's requests and could approve them, including the poster's request made
-- to the previous helper, and the poster could approve a request from a helper
-- who had already left.
--
-- Now, when a task's accepted helper changes from someone to anyone else (the
-- same condition as retire_gig_chat_room_on_worker_change), its pending change
-- requests are withdrawn, with the reason "The helper on this task changed."
-- Approved, declined and withdrawn requests stay as they are.
SET LOCAL lock_timeout='5s';

CREATE FUNCTION public.withdraw_change_requests_on_worker_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
BEGIN
 UPDATE public."GigChangeOrder"
  SET status='withdrawn',rejection_reason='The helper on this task changed.',updated_at=now()
  WHERE gig_id=NEW.id AND status='pending';
 RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.withdraw_change_requests_on_worker_change() FROM PUBLIC,anon,authenticated;

CREATE TRIGGER withdraw_change_requests_on_worker_change
 AFTER UPDATE OF accepted_by ON public."Gig"
 FOR EACH ROW
 WHEN (OLD.accepted_by IS NOT NULL AND NEW.accepted_by IS DISTINCT FROM OLD.accepted_by)
 EXECUTE FUNCTION public.withdraw_change_requests_on_worker_change();
