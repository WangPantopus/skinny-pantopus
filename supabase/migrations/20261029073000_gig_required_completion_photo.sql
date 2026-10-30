-- Backwards compatible: yes. Previously saved completion receipts remain replayable.
-- The API verifies image MIME types against stored bytes/metadata, including legacy uploads.
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION public.guard_gig_required_completion_photo() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.delivery_proof_required AND NEW.status='completed' AND OLD.status IS DISTINCT FROM 'completed'
  AND coalesce(cardinality(NEW.completion_photos),0)=0 THEN
  RAISE EXCEPTION 'GIG_COMPLETION_PHOTO_REQUIRED' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_gig_required_completion_photo BEFORE UPDATE ON public."Gig"
 FOR EACH ROW EXECUTE FUNCTION public.guard_gig_required_completion_photo();
REVOKE ALL ON FUNCTION public.guard_gig_required_completion_photo() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guard_gig_required_completion_photo() TO service_role;
