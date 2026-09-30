-- Backwards compatible: yes. Changes one foreign key's ON DELETE rule and adds one trigger
-- function with its BEFORE DELETE trigger on "User"; no table, column or row changes when applied.
--
-- A Support Train's primary organizer couldn't delete their account: SupportTrain.organizer_user_id
-- is ON DELETE RESTRICT, so the User delete failed (DELETE /api/users/account answers 409
-- SUPPORT_TRAIN_ORGANIZER since #931). Everything else about the train already goes with its
-- creator: Activity.creator_user_id is ON DELETE CASCADE and SupportTrain.activity_id cascades
-- from Activity; co-organizer, reservation, invite and fund rows cascade or set null.
--
-- Now:
-- 1. A published train (not a draft) that has a co-organizer is handed to its longest-standing
--    co-organizer before the delete: they become organizer_user_id and the Activity's creator,
--    so the recipient and the helpers keep their train.
-- 2. organizer_user_id is ON DELETE CASCADE, so every other train the person organizes (drafts,
--    and trains with no co-organizer) leaves with the account, as its Activity already does.
-- The trigger also runs inside account_deletion_dry_run (rolled back there), so the route's
-- pre-flight sees the same outcome.
SET LOCAL lock_timeout='5s';

ALTER TABLE public."SupportTrain" DROP CONSTRAINT "SupportTrain_organizer_user_id_fkey";
ALTER TABLE public."SupportTrain" ADD CONSTRAINT "SupportTrain_organizer_user_id_fkey"
  FOREIGN KEY (organizer_user_id) REFERENCES public."User"(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."SupportTrain" VALIDATE CONSTRAINT "SupportTrain_organizer_user_id_fkey";

CREATE FUNCTION public.support_train_hand_over_on_account_deletion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
BEGIN
 WITH heirs AS (
  SELECT DISTINCT ON (st.id) st.id AS train_id, st.activity_id, o.user_id AS heir
  FROM public."SupportTrain" st
  JOIN public."SupportTrainOrganizer" o
    ON o.support_train_id=st.id AND o.role='co_organizer' AND o.user_id<>OLD.id
  WHERE st.organizer_user_id=OLD.id AND st.status<>'draft'
  ORDER BY st.id, o.created_at, o.id
 ), moved AS (
  UPDATE public."SupportTrain" st SET organizer_user_id=h.heir, updated_at=now()
  FROM heirs h WHERE st.id=h.train_id
  RETURNING h.activity_id, h.heir
 )
 UPDATE public."Activity" a SET creator_user_id=m.heir, updated_at=now()
 FROM moved m WHERE a.id=m.activity_id AND a.creator_user_id=OLD.id;
 RETURN OLD;
END $$;

REVOKE ALL ON FUNCTION public.support_train_hand_over_on_account_deletion() FROM PUBLIC,anon,authenticated;

CREATE TRIGGER support_train_hand_over_on_account_deletion
 BEFORE DELETE ON public."User"
 FOR EACH ROW EXECUTE FUNCTION public.support_train_hand_over_on_account_deletion();
