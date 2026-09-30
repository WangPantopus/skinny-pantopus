-- Backwards compatible: yes. Changes the delete rules of three foreign keys on
-- the stop tables, adds one CHECK and one BEFORE DELETE trigger, and makes one
-- comparison in read_gig_stop_delivery null-safe; no rows change when this is
-- applied. Every existing stop request has an actor (the column was NOT NULL),
-- so the CHECK holds for existing data. The deployed backend and apps never
-- delete these rows, and only a stop's own actor reads its actor field, so
-- they work the same before and after.
--
-- Account deletion (DELETE /api/users/account) refused, with 409
-- ACCOUNT_RECORDS_RETAINED, everyone who ever stopped a task and every owner
-- whose task was stopped, even free tasks:
-- - GigStopRequest.actor_id (who cancelled or released) was NOT NULL with
--   ON DELETE RESTRICT, so the person who made a stop could never be deleted;
-- - GigStopRequest.gig_id was ON DELETE RESTRICT, so a stop receipt kept the
--   task from going with its owner's account (Gig.user_id cascades);
-- - GigStopDelivery.request_id was ON DELETE RESTRICT, so the receipt's
--   notice bookkeeping would then have blocked the receipt in turn.
--
-- Now:
-- 1. A finished stop keeps its receipt when its actor's account is deleted,
--    with the actor set to NULL, like the route's other attribution columns
--    (PaymentRefundRequest.actor_id, Gig.cancelled_by). A stop that hasn't
--    finished (pending or needs_review) is replayed as its actor, so it must
--    keep one: the CHECK makes the SET NULL fail (23514) and the deletion is
--    refused, with no race. The route's own check (TASK_STOP_IN_PROGRESS)
--    tells the person first.
-- 2. A stop receipt with no payment goes with its task when the task is
--    deleted (which happens only when an account is deleted), and so does its
--    notice bookkeeping. A stop tied to a Payment is kept, as before: deleting
--    it raises 23503, so the task and the account stay. People with payments
--    are refused earlier anyway (PAYMENT_HISTORY_RETAINED).
-- 3. The stop notice job checks that a cancelled task was cancelled by the
--    stop's actor. Once that person's account is deleted, both are NULL (the
--    route clears Gig.cancelled_by), so the check compares them null-safely and
--    the other person still gets the push. Only that comparison changes in
--    read_gig_stop_delivery (defined in 20260922020900_gig_stop_receipts.sql).
-- A task with no stop records is deleted exactly as before.
SET LOCAL lock_timeout='5s';

ALTER TABLE public."GigStopRequest"
  ALTER COLUMN actor_id DROP NOT NULL,
  ADD CONSTRAINT gig_stop_request_unfinished_actor CHECK (actor_id IS NOT NULL OR state='completed'),
  DROP CONSTRAINT "GigStopRequest_actor_id_fkey",
  ADD CONSTRAINT "GigStopRequest_actor_id_fkey"
    FOREIGN KEY (actor_id) REFERENCES public."User"(id) ON DELETE SET NULL,
  DROP CONSTRAINT "GigStopRequest_gig_id_fkey",
  ADD CONSTRAINT "GigStopRequest_gig_id_fkey"
    FOREIGN KEY (gig_id) REFERENCES public."Gig"(id) ON DELETE CASCADE;

ALTER TABLE public."GigStopDelivery"
  DROP CONSTRAINT "GigStopDelivery_request_id_fkey",
  ADD CONSTRAINT "GigStopDelivery_request_id_fkey"
    FOREIGN KEY (request_id) REFERENCES public."GigStopRequest"(id) ON DELETE CASCADE;

CREATE FUNCTION public.keep_paid_gig_stop_request() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 RAISE EXCEPTION 'A stop tied to a payment is kept with that payment' USING ERRCODE='23503',
  TABLE='GigStopRequest', CONSTRAINT='keep_paid_gig_stop_request';
END $$;

REVOKE ALL ON FUNCTION public.keep_paid_gig_stop_request() FROM PUBLIC,anon,authenticated;

CREATE TRIGGER keep_paid_gig_stop_request
 BEFORE DELETE ON public."GigStopRequest"
 FOR EACH ROW
 WHEN (OLD.payment_id IS NOT NULL)
 EXECUTE FUNCTION public.keep_paid_gig_stop_request();

CREATE OR REPLACE FUNCTION public.read_gig_stop_delivery(p_id uuid,p_lease_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE d public."GigStopDelivery"; r public."GigStopRequest"; g public."Gig"; n public."Notification"; eligible boolean;
BEGIN
 SELECT * INTO d FROM public."GigStopDelivery" WHERE id=p_id AND lease_id=p_lease_id AND state='processing' AND lease_until>clock_timestamp() FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','LEASE_LOST'); END IF;
 SELECT * INTO r FROM public."GigStopRequest" WHERE id=d.request_id;
 SELECT * INTO g FROM public."Gig" WHERE id=r.gig_id;
 SELECT * INTO n FROM public."Notification" WHERE id=d.notification_id;
 eligible:=r.state='completed' AND r.receipt IS NOT NULL AND n.id IS NOT NULL AND n.user_id=d.user_id
  AND public.gig_expiry_note_snapshot(n)=d.notification_snapshot AND g.user_id=(r.terms->>'ownerId')::uuid
  AND g.status=r.receipt->>'gigStatus' AND g.started_at IS NULL
  AND ((g.status='open' AND g.accepted_by IS NULL AND g.payment_id IS NULL) OR (g.status='cancelled' AND g.cancelled_by IS NOT DISTINCT FROM r.actor_id))
  AND (d.user_id IN ((r.terms->>'ownerId')::uuid,(r.terms->>'workerId')::uuid)
   OR EXISTS(SELECT FROM public."GigBid" WHERE gig_id=g.id AND user_id=d.user_id)
   OR public.paid_gig_actor_allowed(g.user_id,d.user_id));
 RETURN jsonb_build_object('eligible',coalesce(eligible,false),'notification',CASE WHEN eligible THEN to_jsonb(n) ELSE NULL END);
END $$;
