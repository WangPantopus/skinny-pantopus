-- Backwards compatible: yes. Restore the existing migration151 column contract
-- omitted from the application baseline; preserve previously adopted values.
-- Extend the existing owner confirmation transaction and HomeMaintenanceLog.
-- No new table/service/screen or historical confirmation replay.
SET LOCAL lock_timeout='5s';
DO $$ DECLARE old_columns text[];
BEGIN
 SELECT array_agg(attname::text) INTO old_columns FROM pg_attribute
  WHERE attrelid='public."HomeMaintenanceLog"'::regclass AND attnum>0 AND NOT attisdropped;
 ALTER TABLE public."HomeMaintenanceLog"
  ADD COLUMN IF NOT EXISTS task text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS vendor text,
  ADD COLUMN IF NOT EXISTS recurrence text NOT NULL DEFAULT 'one_time',
  ADD COLUMN IF NOT EXISTS due_date timestamptz,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by uuid;
 -- Older rows represent performed work. Do not turn them into scheduled tasks,
 -- overwrite already-adopted fields or reset their original time/author.
 IF NOT ('task'=ANY(old_columns)) THEN
  UPDATE public."HomeMaintenanceLog" SET task=left(coalesce(nullif(notes,''),'Completed maintenance'),200); END IF;
 IF NOT ('due_date'=ANY(old_columns)) THEN UPDATE public."HomeMaintenanceLog" SET due_date=performed_at; END IF;
 IF NOT ('updated_at'=ANY(old_columns)) THEN UPDATE public."HomeMaintenanceLog" SET updated_at=created_at; END IF;
 IF NOT ('created_by'=ANY(old_columns)) THEN UPDATE public."HomeMaintenanceLog" SET created_by=performed_by; END IF;
 ALTER TABLE public."HomeMaintenanceLog" ALTER COLUMN status SET DEFAULT 'scheduled';
 IF NOT EXISTS(SELECT FROM pg_constraint WHERE conrelid='public."HomeMaintenanceLog"'::regclass AND conname='HomeMaintenance_status_chk') THEN
  ALTER TABLE public."HomeMaintenanceLog" ADD CONSTRAINT "HomeMaintenance_status_chk"
   CHECK(status IN ('scheduled','in_progress','completed','cancelled')); END IF;
 IF NOT EXISTS(SELECT FROM pg_constraint WHERE conrelid='public."HomeMaintenanceLog"'::regclass AND conname='HomeMaintenance_recurrence_chk') THEN
  ALTER TABLE public."HomeMaintenanceLog" ADD CONSTRAINT "HomeMaintenance_recurrence_chk"
   CHECK(recurrence IN ('one_time','weekly','monthly','quarterly','yearly')); END IF;
 IF NOT EXISTS(SELECT FROM pg_constraint WHERE conrelid='public."HomeMaintenanceLog"'::regclass AND conname='HomeMaintenanceLog_created_by_fkey') THEN
  ALTER TABLE public."HomeMaintenanceLog" ADD CONSTRAINT "HomeMaintenanceLog_created_by_fkey"
   FOREIGN KEY(created_by) REFERENCES public."User"(id) ON DELETE SET NULL; END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_home_maint_log_status_due ON public."HomeMaintenanceLog"(home_id,status,due_date);

CREATE FUNCTION public.protect_completed_gig_history() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.gig_id IS NOT NULL THEN
  -- Preserve FK erasure when the original Gig/User is deleted. Other writes
  -- cannot turn an automatic receipt into another Home, job, cost or date.
  IF (NEW.gig_id IS DISTINCT FROM OLD.gig_id AND NOT (NEW.gig_id IS NULL AND pg_trigger_depth()>1))
   OR NEW.home_id IS DISTINCT FROM OLD.home_id OR NEW.cost IS DISTINCT FROM OLD.cost
   OR NEW.performed_at IS DISTINCT FROM OLD.performed_at OR NEW.created_at IS DISTINCT FROM OLD.created_at
   OR (NEW.created_by IS DISTINCT FROM OLD.created_by AND NOT (NEW.created_by IS NULL AND pg_trigger_depth()>1))
   OR (NEW.performed_by IS DISTINCT FROM OLD.performed_by AND NOT (NEW.performed_by IS NULL AND pg_trigger_depth()>1)) THEN
   RAISE EXCEPTION 'Completed job evidence is immutable' USING ERRCODE='42501'; END IF;
 END IF;
 IF NEW.gig_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.gig_id IS DISTINCT FROM OLD.gig_id)
  AND NOT (current_user IN ('postgres','service_role','supabase_admin')
   AND coalesce(current_setting('app.completed_gig_history',true),'')='on') THEN
  RAISE EXCEPTION 'Use the completion transaction for job evidence' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_completed_gig_history BEFORE INSERT OR UPDATE ON public."HomeMaintenanceLog"
 FOR EACH ROW EXECUTE FUNCTION public.protect_completed_gig_history();
REVOKE ALL ON FUNCTION public.protect_completed_gig_history() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.protect_completed_gig_history() TO service_role;

CREATE OR REPLACE FUNCTION public.confirm_gig_completion(
 p_gig_id uuid,p_actor_id uuid,p_expected jsonb,p_satisfaction integer,p_note text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE g public."Gig"%ROWTYPE; p public."Payment"%ROWTYPE;
 n public."Notification"%ROWTYPE; recipient uuid; notices jsonb:='[]'::jsonb;
 event_id uuid:=gen_random_uuid(); confirmed_at timestamptz;
 observed_home_id uuid; home_context jsonb;
BEGIN
 -- Match existing Home -> authority -> Gig lock order. A replaced origin is
 -- retried instead of attaching history under an unlocked Home scope.
 SELECT origin_home_id INTO observed_home_id FROM public."Gig" WHERE id=p_gig_id;
 IF observed_home_id IS NOT NULL THEN PERFORM public.lock_home_record_scope(observed_home_id); END IF;
 SELECT * INTO g FROM public."Gig" WHERE id=p_gig_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 IF NOT coalesce(public.paid_gig_actor_allowed(g.user_id,p_actor_id),false) THEN
  RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
 IF g.origin_home_id IS DISTINCT FROM observed_home_id OR p_expected IS NULL OR NOT (p_expected ?& ARRAY['user_id','accepted_by','price','payment_id',
   'accepted_at','started_at','worker_completed_at'])
  OR g.status IS DISTINCT FROM 'completed' OR g.worker_completed_at IS NULL
  OR ROW(g.user_id,g.accepted_by,g.price,g.payment_id,g.accepted_at,g.started_at,g.worker_completed_at)
   IS DISTINCT FROM ROW((p_expected->>'user_id')::uuid,(p_expected->>'accepted_by')::uuid,
    (p_expected->>'price')::numeric,(p_expected->>'payment_id')::uuid,
    (p_expected->>'accepted_at')::timestamptz,(p_expected->>'started_at')::timestamptz,
    (p_expected->>'worker_completed_at')::timestamptz) THEN
  RETURN jsonb_build_object('error','COMPLETION_CHANGED'); END IF;
 -- A concurrent/retried receipt never increments again or recreates read/deleted notices.
 IF g.owner_confirmed_at IS NOT NULL THEN
  RETURN jsonb_build_object('gig',to_jsonb(g),'notifications','[]'::jsonb,'reused',true); END IF;
 IF g.price IS NULL OR g.price<0 OR (g.price>0 AND g.payment_id IS NULL) THEN
  RETURN jsonb_build_object('error','PAYMENT_NOT_CAPTURED'); END IF;
 IF g.payment_id IS NOT NULL THEN
  SELECT * INTO p FROM public."Payment" WHERE id=g.payment_id FOR UPDATE;
  IF NOT FOUND OR p.gig_id IS DISTINCT FROM g.id OR p.payer_id IS DISTINCT FROM g.user_id
   OR p.payee_id IS DISTINCT FROM g.accepted_by OR p.payment_type IS DISTINCT FROM 'gig_payment'
   OR p.amount_total IS DISTINCT FROM round(g.price*100)::bigint OR lower(p.currency) IS DISTINCT FROM 'usd'
   OR p.payment_status IS DISTINCT FROM 'captured_hold' OR p.captured_at IS NULL
   OR p.stripe_payment_intent_id IS NULL OR p.stripe_charge_id IS NULL
   OR coalesce(p.refunded_amount,0)<>0 OR p.dispute_id IS NOT NULL THEN
   RETURN jsonb_build_object('error','PAYMENT_NOT_CAPTURED'); END IF;
 END IF;
 confirmed_at:=clock_timestamp();
 UPDATE public."Gig" SET owner_confirmed_at=confirmed_at,updated_at=confirmed_at,
  owner_confirmation_note=left(p_note,1000),
  owner_satisfaction=CASE WHEN p_satisfaction IS NULL THEN NULL ELSE least(5,greatest(1,p_satisfaction)) END
  WHERE id=g.id RETURNING * INTO g;
 IF g.accepted_by IS NOT NULL THEN
  UPDATE public."User" SET gigs_completed=coalesce(gigs_completed,0)+1 WHERE id=g.accepted_by;
  IF NOT FOUND THEN RAISE EXCEPTION 'Completion worker unavailable'; END IF;
  INSERT INTO public."Notification"(user_id,type,title,body,icon,link,metadata,context_type,context,idempotency_key)
  VALUES(g.accepted_by,'gig_confirmed','Gig "'||coalesce(nullif(g.title,''),'completed gig')||'" confirmed!',
   'The gig owner confirmed your work is complete. Great job!','🎉','/gigs/'||g.id,
   jsonb_build_object('gig_id',g.id),'personal','personal','gig-confirmation:'||event_id||':'||g.accepted_by)
  RETURNING * INTO n;
  notices:=notices||jsonb_build_array(to_jsonb(n));
 END IF;
 -- A client-supplied Home UUID is not Home authority. Only current adult
 -- maintenance editors can attach new confirmed work to the shared ledger.
 -- HomeTaskGigReceipt publications intentionally keep origin_home_id NULL.
 IF observed_home_id IS NOT NULL THEN
  home_context:=public.home_record_context(observed_home_id,p_actor_id);
  IF home_context->>'allowed'='true' AND home_context->>'private'='false'
   AND home_context->'permissions' ? 'maintenance.edit'
   AND NOT EXISTS(SELECT FROM public."HomeOccupancy" WHERE home_id=observed_home_id
    AND user_id=p_actor_id AND age_band IN ('child','teen')) THEN
   PERFORM set_config('app.completed_gig_history','on',true);
   INSERT INTO public."HomeMaintenanceLog"(home_id,task,performed_at,performed_by,cost,gig_id,
    status,recurrence,created_by,created_at,updated_at)
   VALUES(observed_home_id,left(coalesce(nullif(g.title,''),nullif(g.category,''),'Completed job'),200),
    confirmed_at,g.accepted_by,g.price,g.id,'completed','one_time',p_actor_id,confirmed_at,confirmed_at)
   ON CONFLICT(gig_id) WHERE gig_id IS NOT NULL DO NOTHING;
   PERFORM set_config('app.completed_gig_history','off',true);
  END IF;
 END IF;
 -- UPDATE RETURNING chooses only the bids this transaction actually closes.
 FOR recipient IN WITH closed AS (
  UPDATE public."GigBid" SET status='rejected',updated_at=confirmed_at
  WHERE gig_id=g.id AND status IN ('pending','countered') RETURNING user_id
 ) SELECT DISTINCT user_id FROM closed ORDER BY user_id LOOP
  INSERT INTO public."Notification"(user_id,type,title,body,icon,link,metadata,context_type,context,idempotency_key)
  VALUES(recipient,'bid_rejected','"'||coalesce(nullif(g.title,''),'a gig')||'" has been completed',
   'The gig "'||coalesce(nullif(g.title,''),'a gig')||'" has been completed by another worker. Your bid is now closed.',
   '✅','/gigs/'||g.id,jsonb_build_object('gig_id',g.id,'reason','gig_completed'),
   'personal','personal','gig-completion-bid:'||event_id||':'||recipient) RETURNING * INTO n;
  notices:=notices||jsonb_build_array(to_jsonb(n));
 END LOOP;
 RETURN jsonb_build_object('gig',to_jsonb(g),'notifications',notices,'reused',false);
END $$;
REVOKE ALL ON FUNCTION public.confirm_gig_completion(uuid,uuid,jsonb,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_gig_completion(uuid,uuid,jsonb,integer,text) TO service_role;
