-- Backwards compatible: yes. Adds one trigger function and one AFTER UPDATE
-- trigger on "Gig"; no table or column changes and no rows change when this
-- is applied. The deployed backend and apps already handle 'group' rooms and
-- ignore ChatRoom.is_active, so they keep working before the matching backend
-- change (which stops new messages in a retired room) is deployed.
--
-- A task's gig chat room is shared while the task is open (pre-bid questions)
-- and becomes the owner's and the accepted worker's conversation once the task
-- is assigned (PR #908). When that worker is released or bidding reopens
-- (finish_gig_stop sets accepted_by back to NULL), the same room used to reopen:
-- earlier askers could read it again, new askers were added to it by
-- get_or_create_gig_chat, and the next worker inherited it, so all of them could
-- read the private conversation with the previous worker.
--
-- Now, when a task's accepted worker changes from someone to anyone else, its gig
-- room is retired: it becomes a 'group' room (gig_id kept, " (closed)" added to
-- its name) marked inactive, and only the task owner and the previous worker stay
-- in it. Every lookup of a task's room (get_or_create_gig_chat, the paid
-- acceptance, the dispute evidence) selects type 'gig', so the task's next phase
-- starts in a fresh room. Messages stay where they are.
SET LOCAL lock_timeout='5s';

CREATE FUNCTION public.retire_gig_chat_room_on_worker_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
BEGIN
 WITH retired AS (
  UPDATE public."ChatRoom" SET type='group',is_active=false,name=left(coalesce(name,'Gig chat'),246)||' (closed)',updated_at=now()
   WHERE gig_id=OLD.id AND type='gig'
  RETURNING id
 )
 DELETE FROM public."ChatParticipant" AS p USING retired
  WHERE p.room_id=retired.id AND p.user_id<>OLD.user_id AND p.user_id<>OLD.accepted_by;
 RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.retire_gig_chat_room_on_worker_change() FROM PUBLIC,anon,authenticated;

CREATE TRIGGER retire_gig_chat_room_on_worker_change
 AFTER UPDATE OF accepted_by ON public."Gig"
 FOR EACH ROW
 WHEN (OLD.accepted_by IS NOT NULL AND NEW.accepted_by IS DISTINCT FROM OLD.accepted_by)
 EXECUTE FUNCTION public.retire_gig_chat_room_on_worker_change();
