-- Backwards compatible: yes. Existing File/quota/Gig records gain a service-only
-- private completion contract. Legacy objects/rows and Home contracts are kept.
-- Home upload transactions cannot bind current Gig workers/assignment terms.
-- No table or replacement service; provider adoption is a separate release gate.
SET LOCAL lock_timeout='5s';

ALTER TABLE public."File" DROP CONSTRAINT file_owner_or_retired_lease_evidence;
ALTER TABLE public."File" ADD CONSTRAINT file_owner_or_retired_private_evidence CHECK
 (user_id IS NOT NULL OR coalesce(is_deleted AND metadata->>'storage_contract' IN ('home_lease_evidence_v1','gig_completion_v1'),false));
CREATE POLICY file_gig_completion_api_only ON public."File" AS RESTRICTIVE FOR SELECT TO PUBLIC
 USING(coalesce(metadata->>'storage_contract','')<>'gig_completion_v1');
CREATE INDEX gig_completion_file_recovery_due ON public."File"(updated_at,id)
 WHERE metadata->>'storage_contract'='gig_completion_v1';

CREATE FUNCTION public.protect_gig_completion_file() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE protected boolean;
BEGIN
 IF TG_OP='INSERT' THEN protected:=NEW.metadata->>'storage_contract'='gig_completion_v1';
 ELSIF TG_OP='DELETE' THEN protected:=OLD.metadata->>'storage_contract'='gig_completion_v1';
 ELSE protected:=OLD.metadata->>'storage_contract'='gig_completion_v1' OR NEW.metadata->>'storage_contract'='gig_completion_v1'; END IF;
 IF coalesce(protected,false) THEN
  IF current_user NOT IN ('postgres','service_role','supabase_admin') THEN RAISE EXCEPTION 'Use the completion file API' USING ERRCODE='42501'; END IF;
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Retain completion file cleanup records' USING ERRCODE='23514'; END IF;
  IF NEW.metadata->>'storage_contract' IS DISTINCT FROM 'gig_completion_v1'
   OR coalesce(NEW.metadata->>'original_gig_id','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   OR coalesce(NEW.metadata->>'original_user_id','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   OR coalesce(NEW.metadata->>'upload_sha256','') !~ '^[0-9a-f]{64}$'
   OR coalesce(NEW.metadata->>'storage_bucket','') !~ '^[a-z0-9][a-z0-9-]{2,62}$'
   OR NEW.file_path IS DISTINCT FROM 'gig-completion/'||(NEW.metadata->>'original_gig_id')||'/'||(NEW.metadata->>'original_user_id')||'/'||NEW.id::text||'/'||(NEW.metadata->>'upload_sha256')
   OR NEW.file_url IS DISTINCT FROM '/api/gigs/'||(NEW.metadata->>'original_gig_id')||'/completion-files/'||NEW.id::text
   OR NEW.file_type IS DISTINCT FROM 'gig_attachment' OR NEW.file_context IS DISTINCT FROM 'gig_completion' OR NEW.visibility IS DISTINCT FROM 'private'
   OR NEW.is_deleted IS NULL OR NEW.processing_status NOT IN ('uploading','completed','failed')
   OR NEW.file_size NOT BETWEEN 1 AND 104857600
   OR (NEW.gig_id IS NOT NULL AND NEW.gig_id::text IS DISTINCT FROM NEW.metadata->>'original_gig_id')
   OR (NEW.user_id IS NOT NULL AND NEW.user_id::text IS DISTINCT FROM NEW.metadata->>'original_user_id')
   OR (NOT NEW.is_deleted AND (NEW.gig_id IS NULL OR NEW.user_id IS NULL)) THEN
   RAISE EXCEPTION 'Invalid private completion file' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND (
   ROW(NEW.id,NEW.filename,NEW.original_filename,NEW.file_path,NEW.file_url,NEW.file_size,NEW.mime_type,NEW.created_at,
    NEW.metadata->>'storage_bucket',NEW.metadata->>'upload_sha256',NEW.metadata->>'original_gig_id',NEW.metadata->>'original_user_id',NEW.metadata->'assignment') IS DISTINCT FROM
   ROW(OLD.id,OLD.filename,OLD.original_filename,OLD.file_path,OLD.file_url,OLD.file_size,OLD.mime_type,OLD.created_at,
    OLD.metadata->>'storage_bucket',OLD.metadata->>'upload_sha256',OLD.metadata->>'original_gig_id',OLD.metadata->>'original_user_id',OLD.metadata->'assignment')
   OR OLD.metadata->>'storage_contract' IS DISTINCT FROM 'gig_completion_v1'
   OR (OLD.is_deleted AND NOT NEW.is_deleted)
   OR (NEW.gig_id IS DISTINCT FROM OLD.gig_id AND NEW.gig_id IS NOT NULL)
   OR (NEW.user_id IS DISTINCT FROM OLD.user_id AND NEW.user_id IS NOT NULL)) THEN
   RAISE EXCEPTION 'Private completion identity is immutable' USING ERRCODE='23514'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER protect_gig_completion_file BEFORE INSERT OR UPDATE OR DELETE ON public."File"
 FOR EACH ROW EXECUTE FUNCTION public.protect_gig_completion_file();

CREATE FUNCTION public.mutate_gig_completion_file(p_gig_id uuid,p_actor_id uuid,p_file_id uuid,p_action text,p_payload jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE g public."Gig"%ROWTYPE; f public."File"%ROWTYPE; assignment jsonb; object_path text; maximum bigint;
BEGIN
 IF p_file_id IS NULL OR p_actor_id IS NULL OR p_action IS NULL OR p_action NOT IN ('reserve','finalize')
  OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR (p_action='finalize' AND p_payload<>'{}') THEN
  RETURN '{"error":"INVALID_COMPLETION_FILE"}'::jsonb; END IF;
 SELECT * INTO g FROM public."Gig" WHERE id=p_gig_id FOR UPDATE;
 IF NOT FOUND THEN RETURN '{"error":"NOT_FOUND"}'::jsonb; END IF;
 IF g.accepted_by IS DISTINCT FROM p_actor_id THEN RETURN '{"error":"FORBIDDEN"}'::jsonb; END IF;
 SELECT * INTO f FROM public."File" WHERE id=p_file_id FOR UPDATE;
 assignment:=jsonb_build_object('user_id',g.user_id,'accepted_by',g.accepted_by,'accepted_at',g.accepted_at,'started_at',g.started_at,'price',g.price,'payment_id',g.payment_id);
 IF f.id IS NOT NULL AND (f.metadata->>'storage_contract' IS DISTINCT FROM 'gig_completion_v1'
  OR f.gig_id IS DISTINCT FROM g.id OR f.user_id IS DISTINCT FROM p_actor_id OR f.is_deleted
  OR f.metadata->'assignment' IS DISTINCT FROM assignment) THEN RETURN '{"error":"COMPLETION_FILE_CHANGED"}'::jsonb; END IF;
 IF p_action='reserve' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('sha256','bucket','mime_type','file_size','file_name'))
   OR coalesce(p_payload->>'sha256','') !~ '^[0-9a-f]{64}$' OR coalesce(p_payload->>'bucket','') !~ '^[a-z0-9][a-z0-9-]{2,62}$'
   OR coalesce(p_payload->>'file_size','') !~ '^[0-9]{1,9}$'
   OR length(coalesce(p_payload->>'file_name','')) NOT BETWEEN 1 AND 255 THEN RETURN '{"error":"INVALID_COMPLETION_FILE"}'::jsonb; END IF;
  maximum:=CASE WHEN p_payload->>'mime_type' IN ('image/jpeg','image/png','image/gif','image/webp','image/avif','image/heic','image/heif') THEN 10485760
   WHEN p_payload->>'mime_type' IN ('video/mp4','video/quicktime','video/x-msvideo','video/webm') THEN 104857600
   WHEN p_payload->>'mime_type' IN ('application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain') THEN 26214400 ELSE 0 END;
  IF (p_payload->>'file_size')::bigint NOT BETWEEN 1 AND maximum THEN RETURN '{"error":"INVALID_COMPLETION_FILE"}'::jsonb; END IF;
  IF f.id IS NOT NULL AND ROW(f.metadata->>'upload_sha256',f.metadata->>'storage_bucket',f.mime_type,f.file_size) IS DISTINCT FROM
   ROW(p_payload->>'sha256',p_payload->>'bucket',p_payload->>'mime_type',(p_payload->>'file_size')::bigint) THEN RETURN '{"error":"COMPLETION_FILE_CHANGED"}'::jsonb; END IF;
 END IF;
 -- An acknowledged ready file can be recovered after completion, but the
 -- caller cannot use a completed task to upload replacement proof.
 IF g.status='completed' AND f.processing_status='completed' AND f.file_url=ANY(coalesce(g.completion_photos,'{}')) THEN
  RETURN jsonb_build_object('file',to_jsonb(f),'reused',true); END IF;
 IF g.status IS DISTINCT FROM 'in_progress' OR g.worker_completed_at IS NOT NULL OR g.owner_confirmed_at IS NOT NULL THEN
  RETURN '{"error":"COMPLETION_FILE_CHANGED"}'::jsonb; END IF;
 IF p_action='reserve' AND f.id IS NULL THEN
  object_path:='gig-completion/'||g.id||'/'||p_actor_id||'/'||p_file_id||'/'||(p_payload->>'sha256');
  INSERT INTO public."File"(id,user_id,gig_id,filename,original_filename,file_path,file_url,file_size,mime_type,file_extension,
   file_type,file_context,visibility,processing_status,is_deleted,metadata)
  VALUES(p_file_id,p_actor_id,g.id,p_payload->>'file_name',p_payload->>'file_name',object_path,'/api/gigs/'||g.id||'/completion-files/'||p_file_id,
   (p_payload->>'file_size')::bigint,p_payload->>'mime_type','','gig_attachment','gig_completion','private','uploading',false,
   jsonb_build_object('storage_contract','gig_completion_v1','original_gig_id',g.id,'original_user_id',p_actor_id,
    'upload_sha256',p_payload->>'sha256','storage_bucket',p_payload->>'bucket','assignment',assignment)) RETURNING * INTO f;
 ELSIF f.id IS NULL THEN RETURN '{"error":"NOT_FOUND"}'::jsonb;
 END IF;
 IF p_action='finalize' AND f.processing_status='uploading' THEN
  UPDATE public."File" SET processing_status='completed',updated_at=clock_timestamp() WHERE id=f.id RETURNING * INTO f;
 ELSIF f.processing_status NOT IN ('uploading','completed') THEN RETURN '{"error":"COMPLETION_FILE_CHANGED"}'::jsonb; END IF;
 RETURN jsonb_build_object('file',to_jsonb(f),'reused',f.processing_status='completed');
END $$;

CREATE FUNCTION public.get_gig_completion_file(p_gig_id uuid,p_actor_id uuid,p_file_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE g public."Gig"%ROWTYPE; f public."File"%ROWTYPE; may_review boolean;
BEGIN
 SELECT * INTO g FROM public."Gig" WHERE id=p_gig_id FOR SHARE;
 IF NOT FOUND THEN RETURN '{"error":"NOT_FOUND"}'::jsonb; END IF;
 IF p_actor_id IS NULL THEN RETURN '{"error":"FORBIDDEN"}'::jsonb; END IF;
 SELECT * INTO f FROM public."File" WHERE id=p_file_id FOR SHARE;
 IF NOT FOUND OR f.metadata->>'storage_contract' IS DISTINCT FROM 'gig_completion_v1'
  OR f.gig_id IS DISTINCT FROM g.id OR f.is_deleted OR f.processing_status IS DISTINCT FROM 'completed' THEN RETURN '{"error":"NOT_FOUND"}'::jsonb; END IF;
 may_review:=g.user_id=p_actor_id OR g.accepted_by=p_actor_id
  OR public.business_has_permission(g.user_id,'gigs.manage'::public.business_permission,p_actor_id)
  OR public.business_has_permission(g.user_id,'gigs.post'::public.business_permission,p_actor_id);
 IF NOT coalesce(may_review,false) OR NOT (f.file_url=ANY(coalesce(g.completion_photos,'{}'))
  OR (f.user_id=p_actor_id AND g.accepted_by=p_actor_id AND g.status='in_progress'
   AND f.metadata->'assignment'=jsonb_build_object('user_id',g.user_id,'accepted_by',g.accepted_by,'accepted_at',g.accepted_at,'started_at',g.started_at,'price',g.price,'payment_id',g.payment_id))) THEN
  RETURN '{"error":"FORBIDDEN"}'::jsonb; END IF;
 RETURN jsonb_build_object('file',to_jsonb(f));
END $$;

CREATE FUNCTION public.bind_gig_completion_files() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE ref text; f public."File"%ROWTYPE;
BEGIN
 FOR ref IN SELECT unnest(coalesce(NEW.completion_photos,'{}')) LOOP
  IF ref LIKE '/api/gigs/%' THEN
   SELECT * INTO f FROM public."File" WHERE file_url=ref AND gig_id=NEW.id AND user_id=NEW.accepted_by FOR SHARE;
   IF NOT FOUND OR f.metadata->>'storage_contract' IS DISTINCT FROM 'gig_completion_v1' OR f.is_deleted
    OR f.processing_status IS DISTINCT FROM 'completed'
    OR f.metadata->'assignment' IS DISTINCT FROM jsonb_build_object('user_id',NEW.user_id,'accepted_by',NEW.accepted_by,'accepted_at',NEW.accepted_at,
     'started_at',NEW.started_at,'price',NEW.price,'payment_id',NEW.payment_id) THEN
    RAISE EXCEPTION 'Private completion file is unavailable' USING ERRCODE='23514'; END IF;
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER bind_gig_completion_files BEFORE UPDATE OF completion_photos ON public."Gig"
 FOR EACH ROW EXECUTE FUNCTION public.bind_gig_completion_files();

CREATE FUNCTION public.retire_gig_completion_file_parent() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE f public."File"%ROWTYPE;
BEGIN
 FOR f IN SELECT * FROM public."File" WHERE metadata->>'storage_contract'='gig_completion_v1'
  AND ((TG_TABLE_NAME='User' AND user_id=OLD.id) OR (TG_TABLE_NAME='Gig' AND gig_id=OLD.id)) ORDER BY id FOR UPDATE LOOP
  IF NOT f.is_deleted THEN
   UPDATE public."FileQuota" SET storage_used=greatest(storage_used-f.file_size,0),file_count=greatest(file_count-1,0),updated_at=clock_timestamp() WHERE user_id=f.user_id;
  END IF;
  UPDATE public."File" SET is_deleted=true,deleted_at=coalesce(deleted_at,clock_timestamp()),processing_status='failed',updated_at=clock_timestamp(),
   user_id=CASE WHEN TG_TABLE_NAME='User' THEN NULL ELSE user_id END,gig_id=CASE WHEN TG_TABLE_NAME='Gig' THEN NULL ELSE gig_id END,
   metadata=(metadata-'storage_cleanup_claim')||'{"storage_cleanup_pending":true}'::jsonb WHERE id=f.id;
 END LOOP;
 RETURN OLD;
END $$;
CREATE TRIGGER retire_gig_completion_file_user BEFORE DELETE ON public."User" FOR EACH ROW EXECUTE FUNCTION public.retire_gig_completion_file_parent();
CREATE TRIGGER retire_gig_completion_file_gig BEFORE DELETE ON public."Gig" FOR EACH ROW EXECUTE FUNCTION public.retire_gig_completion_file_parent();

CREATE FUNCTION public.gig_completion_file_cleanup_candidates(p_bucket text,p_limit integer DEFAULT 100) RETURNS SETOF uuid
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT f.id FROM public."File" f WHERE f.metadata->>'storage_contract'='gig_completion_v1' AND f.metadata->>'storage_bucket'=p_bucket
  AND f.updated_at<clock_timestamp()-(CASE WHEN f.is_deleted AND f.metadata->>'storage_cleanup_pending'='false' THEN interval '1 day' ELSE interval '10 minutes' END)
  AND (f.is_deleted OR (f.created_at<clock_timestamp()-interval '1 day'
   AND NOT EXISTS(SELECT FROM public."Gig" g WHERE g.id=f.gig_id AND f.file_url=ANY(coalesce(g.completion_photos,'{}')))))
 ORDER BY f.updated_at,f.id LIMIT greatest(1,least(coalesce(p_limit,100),100));
$$;
CREATE FUNCTION public.claim_gig_completion_file_cleanup(p_file_id uuid,p_bucket text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE f public."File"%ROWTYPE; g public."Gig"%ROWTYPE;
BEGIN
 SELECT * INTO f FROM public."File" WHERE id=p_file_id;
 IF NOT FOUND OR f.metadata->>'storage_contract' IS DISTINCT FROM 'gig_completion_v1' THEN RETURN NULL; END IF;
 -- Match completion's Gig -> File lock order and recheck publication under it.
 SELECT * INTO g FROM public."Gig" WHERE id=f.gig_id FOR UPDATE;
 SELECT * INTO f FROM public."File" WHERE id=p_file_id FOR UPDATE;
 IF f.metadata->>'storage_bucket' IS DISTINCT FROM p_bucket OR p_bucket IS NULL
  OR f.updated_at>=clock_timestamp()-(CASE WHEN f.is_deleted AND f.metadata->>'storage_cleanup_pending'='false' THEN interval '1 day' ELSE interval '10 minutes' END)
  OR (NOT f.is_deleted AND (f.created_at>=clock_timestamp()-interval '1 day' OR f.file_url=ANY(coalesce(g.completion_photos,'{}')))) THEN RETURN NULL; END IF;
 IF NOT f.is_deleted THEN
  UPDATE public."FileQuota" SET storage_used=greatest(storage_used-f.file_size,0),file_count=greatest(file_count-1,0),updated_at=clock_timestamp() WHERE user_id=f.user_id;
 END IF;
 UPDATE public."File" SET is_deleted=true,deleted_at=coalesce(deleted_at,clock_timestamp()),processing_status='failed',updated_at=clock_timestamp(),
  metadata=metadata||jsonb_build_object('storage_cleanup_pending',true,'storage_cleanup_claim',gen_random_uuid()) WHERE id=f.id RETURNING * INTO f;
 RETURN to_jsonb(f);
END $$;
CREATE FUNCTION public.finish_gig_completion_file_cleanup(p_file_id uuid,p_claim uuid,p_succeeded boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE public."File" SET metadata=(metadata-'storage_cleanup_claim')||jsonb_build_object('storage_cleanup_pending',NOT p_succeeded),updated_at=clock_timestamp()
 WHERE id=p_file_id AND metadata->>'storage_contract'='gig_completion_v1' AND is_deleted=true AND p_claim IS NOT NULL
  AND metadata->>'storage_cleanup_claim'=p_claim::text AND p_succeeded IS NOT NULL;
 RETURN FOUND;
END $$;

DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT oid::regprocedure signature FROM pg_proc WHERE pronamespace='public'::regnamespace
  AND proname IN ('mutate_gig_completion_file','get_gig_completion_file','gig_completion_file_cleanup_candidates',
   'claim_gig_completion_file_cleanup','finish_gig_completion_file_cleanup') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END $$;

-- Extend the existing generic cleanup exclusions; preserve all Home contracts.
CREATE OR REPLACE FUNCTION public.cleanup_old_deleted_files(days_old integer DEFAULT 30)
RETURNS TABLE(deleted_count integer, freed_space bigint)
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_deleted_count integer; v_freed_space bigint;
BEGIN
  WITH removed AS (
    DELETE FROM public."File" WHERE is_deleted = true
      AND deleted_at < now() - interval '1 day' * days_old
      AND coalesce(metadata->>'storage_contract', '') NOT IN ('home_document_v1','home_task_media_v1','home_claim_evidence_v1','home_lease_evidence_v1','gig_completion_v1')
    RETURNING file_size
  ) SELECT count(*)::integer, coalesce(sum(file_size), 0) INTO v_deleted_count, v_freed_space FROM removed;
  RETURN QUERY SELECT v_deleted_count, v_freed_space;
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_file(p_file_id uuid, p_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_file public."File"%ROWTYPE;
BEGIN
  SELECT * INTO v_file FROM public."File"
  WHERE id = p_file_id AND user_id = p_user_id AND is_deleted = false FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'File not found or already deleted');
  END IF;
  IF v_file.metadata->>'storage_contract' IN ('home_document_v1','home_task_media_v1','home_claim_evidence_v1','home_lease_evidence_v1','gig_completion_v1') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  UPDATE public."File" SET is_deleted = true, deleted_at = now(), updated_at = now() WHERE id = p_file_id;
  UPDATE public."FileQuota" SET storage_used = greatest(storage_used - v_file.file_size, 0),
    file_count = greatest(file_count - 1, 0), updated_at = now() WHERE user_id = p_user_id;
  RETURN jsonb_build_object('success', true, 'fileId', p_file_id, 'freedSpace', v_file.file_size);
END;
$$;
