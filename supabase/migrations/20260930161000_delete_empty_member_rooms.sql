-- Backwards compatible: yes. Adds one trigger function and one statement-level
-- AFTER DELETE trigger on "ChatParticipant"; no table or column changes, and no
-- rows change when this is applied. Rooms it removes have no members, so no
-- deployed client can reach them.
--
-- A direct chat whose two members both delete their accounts stayed behind as
-- an empty room: the account deletion removes each person's messages and their
-- membership rows cascade away, but nothing removed the room. The same happens to
-- a user-made group chat once its last member's row is deleted.
--
-- Now, when a delete leaves such a room with no members, the room is deleted
-- too. This covers direct rooms, and group rooms with no parent (no task, home or
-- support train). Task, home and train rooms are left alone; they belong to
-- their parent and go with it. The trigger runs once per DELETE statement, so it
-- also covers the cascade from an account deletion and the route's rolled-back
-- dry run. Nothing references ChatRoom with RESTRICT (messages, members and
-- typing rows cascade; GigPaymentAcceptance.room_id is SET NULL).
SET LOCAL lock_timeout='5s';

CREATE FUNCTION public.delete_empty_member_rooms() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
BEGIN
 DELETE FROM public."ChatRoom" AS r
  WHERE r.id IN (SELECT DISTINCT room_id FROM gone)
    AND (r.type='direct' OR (r.type='group' AND r.gig_id IS NULL AND r.home_id IS NULL AND r.support_train_id IS NULL))
    AND NOT EXISTS (SELECT FROM public."ChatParticipant" AS p WHERE p.room_id=r.id);
 RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.delete_empty_member_rooms() FROM PUBLIC,anon,authenticated;

CREATE TRIGGER delete_empty_member_rooms
 AFTER DELETE ON public."ChatParticipant"
 REFERENCING OLD TABLE AS gone
 FOR EACH STATEMENT
 EXECUTE FUNCTION public.delete_empty_member_rooms();
