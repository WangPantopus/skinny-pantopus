-- Backwards compatible: yes. Extend File/private document recovery and the
-- existing lease transaction. No replacement tenancy or upload-intent table.
SET LOCAL lock_timeout='5s';

-- A retired lease upload must survive account deletion while provider cleanup
-- is pending. Every other File still requires its existing owner; the original
-- cascade FK and all existing rows remain unchanged.
ALTER TABLE public."File" ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public."File" ADD CONSTRAINT file_owner_or_retired_lease_evidence
  CHECK(user_id IS NOT NULL OR coalesce(is_deleted AND metadata->>'storage_contract'='home_lease_evidence_v1',false));
CREATE POLICY file_lease_evidence_api_only ON public."File" AS RESTRICTIVE FOR SELECT TO PUBLIC
  USING(coalesce(metadata->>'storage_contract','')<>'home_lease_evidence_v1');
CREATE INDEX home_lease_evidence_recovery_due ON public."File"(updated_at,id)
  WHERE metadata->>'storage_contract'='home_lease_evidence_v1';

CREATE FUNCTION public.protect_home_lease_evidence_file() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE protected boolean;
BEGIN
  IF TG_OP='INSERT' THEN protected:=NEW.metadata->>'storage_contract'='home_lease_evidence_v1';
  ELSIF TG_OP='DELETE' THEN protected:=OLD.metadata->>'storage_contract'='home_lease_evidence_v1';
  ELSE protected:=OLD.metadata->>'storage_contract'='home_lease_evidence_v1'
    OR NEW.metadata->>'storage_contract'='home_lease_evidence_v1'; END IF;
  IF coalesce(protected,false) THEN
    IF current_user NOT IN ('postgres','service_role','supabase_admin') THEN
      RAISE EXCEPTION 'Use the authenticated lease evidence API' USING ERRCODE='42501'; END IF;
    IF TG_OP='DELETE' THEN
      RAISE EXCEPTION 'Lease upload cleanup records must be retained' USING ERRCODE='23514'; END IF;
    IF NEW.metadata->>'storage_contract' IS DISTINCT FROM 'home_lease_evidence_v1'
      OR coalesce(NEW.metadata->>'original_home_id','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR coalesce(NEW.metadata->>'original_user_id','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR coalesce(NEW.metadata->>'upload_sha256','') !~ '^[0-9a-f]{64}$'
      OR coalesce(NEW.metadata->>'storage_bucket','') !~ '^[a-z0-9][a-z0-9-]{2,62}$'
      OR NEW.file_path IS DISTINCT FROM (NEW.metadata->>'original_home_id')||'/'||NEW.id::text||'/'||(NEW.metadata->>'upload_sha256')
      OR NEW.metadata ? 'storage_key_id'
      OR NEW.file_type IS DISTINCT FROM 'home_document' OR NEW.visibility IS DISTINCT FROM 'private'
      OR NEW.file_size NOT BETWEEN 1 AND 26214400
      OR coalesce(NEW.mime_type,'') NOT IN ('application/pdf','text/plain','image/jpeg','image/png','image/webp','image/heic','image/heif')
      OR (NEW.home_id IS NOT NULL AND NEW.home_id::text IS DISTINCT FROM NEW.metadata->>'original_home_id')
      OR (NEW.user_id IS NOT NULL AND NEW.user_id::text IS DISTINCT FROM NEW.metadata->>'original_user_id')
      OR (NOT NEW.is_deleted AND (NEW.home_id IS NULL OR NEW.user_id IS NULL)) THEN
      RAISE EXCEPTION 'Invalid private lease file' USING ERRCODE='23514'; END IF;
    IF TG_OP='UPDATE' AND (
      ROW(NEW.id,NEW.filename,NEW.original_filename,NEW.file_path,NEW.file_url,NEW.file_size,NEW.mime_type,NEW.created_at,
        NEW.metadata->>'storage_bucket',NEW.metadata->>'upload_sha256',NEW.metadata->>'original_home_id',
        NEW.metadata->>'original_user_id',NEW.metadata->'request_context') IS DISTINCT FROM
      ROW(OLD.id,OLD.filename,OLD.original_filename,OLD.file_path,OLD.file_url,OLD.file_size,OLD.mime_type,OLD.created_at,
        OLD.metadata->>'storage_bucket',OLD.metadata->>'upload_sha256',OLD.metadata->>'original_home_id',
        OLD.metadata->>'original_user_id',OLD.metadata->'request_context')
      OR OLD.metadata->>'storage_contract' IS DISTINCT FROM 'home_lease_evidence_v1'
      OR (OLD.is_deleted AND NOT NEW.is_deleted)
      OR (NEW.user_id IS DISTINCT FROM OLD.user_id AND NEW.user_id IS NOT NULL)
      OR (NEW.home_id IS DISTINCT FROM OLD.home_id AND NEW.home_id IS NOT NULL)
      OR (OLD.metadata ? 'lease_id' AND ROW(NEW.metadata->>'lease_id',NEW.metadata->'request_payload')
        IS DISTINCT FROM ROW(OLD.metadata->>'lease_id',OLD.metadata->'request_payload'))) THEN
      RAISE EXCEPTION 'Private lease file identity and retirement are immutable' USING ERRCODE='23514'; END IF;
    IF NEW.metadata ? 'lease_id' AND NOT NEW.is_deleted AND NOT EXISTS(
      SELECT FROM public."HomeLease" l WHERE l.id::text=NEW.metadata->>'lease_id'
        AND l.home_id=NEW.home_id AND l.primary_resident_user_id=NEW.user_id
        AND l.metadata->>'lease_file_id'=NEW.id::text AND l.source='tenant_request') THEN
      RAISE EXCEPTION 'Private lease file must bind its exact request' USING ERRCODE='23514'; END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_home_lease_evidence_file BEFORE INSERT OR UPDATE OR DELETE ON public."File"
  FOR EACH ROW EXECUTE FUNCTION public.protect_home_lease_evidence_file();

-- Detach only this new contract before a parent cascade. Retired records grant
-- no read access, retain immutable object keys, and cannot resurrect on retry.
CREATE FUNCTION public.retire_home_lease_evidence_parent() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE f public."File"%ROWTYPE;
BEGIN
  FOR f IN SELECT * FROM public."File" WHERE metadata->>'storage_contract'='home_lease_evidence_v1'
    AND ((TG_TABLE_NAME='User' AND user_id=OLD.id) OR (TG_TABLE_NAME='Home' AND home_id=OLD.id))
    ORDER BY id FOR UPDATE LOOP
    IF NOT f.is_deleted THEN
      UPDATE public."FileQuota" SET storage_used=greatest(storage_used-f.file_size,0),
        file_count=greatest(file_count-1,0),updated_at=now() WHERE user_id=f.user_id;
    END IF;
    UPDATE public."File" SET is_deleted=true,deleted_at=coalesce(deleted_at,now()),processing_status='failed',updated_at=now(),
      user_id=CASE WHEN TG_TABLE_NAME='User' THEN NULL ELSE user_id END,
      home_id=CASE WHEN TG_TABLE_NAME='Home' THEN NULL ELSE home_id END,
      metadata=(metadata-'storage_cleanup_claim')||'{"storage_cleanup_pending":true}'::jsonb WHERE id=f.id;
  END LOOP;
  RETURN OLD;
END $$;
CREATE TRIGGER retire_home_lease_evidence_user BEFORE DELETE ON public."User"
  FOR EACH ROW EXECUTE FUNCTION public.retire_home_lease_evidence_parent();
CREATE TRIGGER retire_home_lease_evidence_home BEFORE DELETE ON public."Home"
  FOR EACH ROW EXECUTE FUNCTION public.retire_home_lease_evidence_parent();

CREATE FUNCTION public.mutate_home_lease_evidence(p_home_id uuid,p_actor_id uuid,p_upload_id uuid,
  p_action text,p_payload jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE f public."File"%ROWTYPE; h public."Home"%ROWTYPE; latest public."HomeLease"%ROWTYPE; context jsonb;
BEGIN
  IF p_actor_id IS NULL OR p_upload_id IS NULL OR p_action IS NULL OR p_action NOT IN ('reserve','finalize','retire')
    OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR (p_action<>'reserve' AND p_payload<>'{}') THEN
    RETURN '{"success":false,"status":400,"error":"Invalid lease upload"}'::jsonb; END IF;
  PERFORM id FROM public."User" WHERE id=p_actor_id FOR KEY SHARE;
  IF NOT FOUND OR NOT public.lock_home_invitation_scope(p_home_id) THEN
    RETURN '{"success":false,"status":404,"error":"Home or account is unavailable"}'::jsonb; END IF;
  PERFORM id FROM public."HomeAuthority" WHERE home_id=p_home_id ORDER BY id FOR UPDATE;
  SELECT * INTO h FROM public."Home" WHERE id=p_home_id;
  SELECT * INTO f FROM public."File" WHERE id=p_upload_id FOR UPDATE;
  IF FOUND AND (f.home_id IS DISTINCT FROM p_home_id OR f.user_id IS DISTINCT FROM p_actor_id
    OR f.metadata->>'storage_contract' IS DISTINCT FROM 'home_lease_evidence_v1') THEN
    RETURN '{"success":false,"status":409,"error":"This upload belongs to a different request"}'::jsonb; END IF;
  IF p_action='retire' THEN
    IF f.id IS NULL THEN RETURN '{"success":false,"status":404,"error":"Lease upload not found"}'::jsonb; END IF;
    IF f.metadata ? 'lease_id' THEN
      RETURN '{"success":false,"status":409,"error":"This file is already part of a submitted request"}'::jsonb; END IF;
    IF NOT f.is_deleted THEN
      UPDATE public."FileQuota" SET storage_used=greatest(storage_used-f.file_size,0),file_count=greatest(file_count-1,0),updated_at=now()
        WHERE user_id=f.user_id;
      UPDATE public."File" SET is_deleted=true,deleted_at=now(),processing_status='failed',updated_at=now(),
        metadata=(metadata-'storage_cleanup_claim')||'{"storage_cleanup_pending":true}'::jsonb WHERE id=f.id RETURNING * INTO f;
    END IF;
    RETURN jsonb_build_object('success',true,'file',to_jsonb(f));
  END IF;
  IF f.is_deleted THEN RETURN '{"success":false,"status":409,"error":"This upload was removed or expired. Choose the file again"}'::jsonb; END IF;
  IF h.security_state IN ('frozen','frozen_silent') OR h.home_status IN ('merged','archived') OR h.home_type='multi_unit'
    OR EXISTS(SELECT FROM public."HomeAddress" WHERE id=h.address_id AND building_type='multi_unit' AND missing_secondary_flag)
    OR NOT EXISTS(SELECT FROM public."HomeAuthority" WHERE home_id=p_home_id AND status='verified') THEN
    RETURN '{"success":false,"status":403,"error":"This home cannot receive a lease request"}'::jsonb; END IF;
  SELECT * INTO latest FROM public."HomeLease" WHERE home_id=p_home_id AND primary_resident_user_id=p_actor_id
    ORDER BY created_at DESC,id DESC LIMIT 1;
  context:=jsonb_build_object('home_id',p_home_id,'actor_id',p_actor_id,'lease_id',latest.id,'lease_state',latest.state);
  IF p_action='reserve' THEN
    IF EXISTS(SELECT FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('bucket','sha256','file_name','mime_type','file_size','request_context'))
      OR coalesce(p_payload->>'bucket','') !~ '^[a-z0-9][a-z0-9-]{2,62}$'
      OR coalesce(p_payload->>'sha256','') !~ '^[0-9a-f]{64}$'
      OR length(coalesce(p_payload->>'file_name','')) NOT BETWEEN 1 AND 255
      OR coalesce(p_payload->>'mime_type','') NOT IN ('application/pdf','text/plain','image/jpeg','image/png','image/webp','image/heic','image/heif')
      OR coalesce(p_payload->>'file_size','') !~ '^[0-9]{1,8}$' THEN
      RETURN '{"success":false,"status":400,"error":"Invalid lease file details"}'::jsonb; END IF;
    IF (p_payload->>'file_size')::bigint NOT BETWEEN 1 AND 26214400 THEN
      RETURN '{"success":false,"status":413,"error":"Choose a nonempty file of 25 MB or less"}'::jsonb; END IF;
    IF f.id IS NOT NULL THEN
      IF ROW(f.metadata->>'storage_bucket',f.metadata->>'upload_sha256',f.original_filename,f.mime_type,f.file_size,f.metadata->'request_context')
        IS DISTINCT FROM ROW(p_payload->>'bucket',p_payload->>'sha256',p_payload->>'file_name',p_payload->>'mime_type',
          (p_payload->>'file_size')::bigint,p_payload->'request_context') THEN
        RETURN '{"success":false,"status":409,"error":"This upload identifier has different file details"}'::jsonb; END IF;
    ELSE
      IF context IS DISTINCT FROM p_payload->'request_context' OR latest.state='pending'
        OR (latest.state='active' AND (latest.end_at IS NULL OR latest.end_at>clock_timestamp())) THEN
        RETURN '{"success":false,"status":409,"error":"Your request status changed. Refresh before attaching a file"}'::jsonb; END IF;
      INSERT INTO public."File"(id,user_id,home_id,filename,original_filename,file_path,file_url,file_size,mime_type,file_extension,
        file_type,visibility,processing_status,metadata)
      VALUES(p_upload_id,p_actor_id,p_home_id,p_payload->>'file_name',p_payload->>'file_name',
        p_home_id::text||'/'||p_upload_id::text||'/'||(p_payload->>'sha256'),
        '/api/v1/tenant/home/'||p_home_id::text||'/lease-files/'||p_upload_id::text||'/content',
        (p_payload->>'file_size')::bigint,p_payload->>'mime_type',left(lower(coalesce(substring(p_payload->>'file_name' from '\.[^.]+$'),'')),10),
        'home_document','private','uploading',
        jsonb_build_object('storage_contract','home_lease_evidence_v1','storage_bucket',p_payload->>'bucket',
          'upload_sha256',p_payload->>'sha256','original_home_id',p_home_id,'original_user_id',p_actor_id,
          'request_context',context)) RETURNING * INTO f;
    END IF;
  ELSE
    IF f.id IS NULL THEN RETURN '{"success":false,"status":404,"error":"Lease upload not found"}'::jsonb; END IF;
    IF NOT (f.metadata ? 'lease_id') AND context IS DISTINCT FROM f.metadata->'request_context' THEN
      RETURN '{"success":false,"status":409,"error":"Your request status changed. Refresh before attaching a file"}'::jsonb; END IF;
    UPDATE public."File" SET processing_status='completed',updated_at=now() WHERE id=f.id RETURNING * INTO f;
  END IF;
  RETURN jsonb_build_object('success',true,'file',to_jsonb(f));
EXCEPTION WHEN unique_violation THEN
  RETURN '{"success":false,"status":409,"error":"This upload identifier is already in use. Retry the original file"}'::jsonb;
END $$;

-- The existing function still owns dates, request context, authority, audit and
-- tenant admission. This wrapper adds only the atomic File/request binding.
CREATE FUNCTION public.request_home_lease_with_evidence(p_action text,p_actor_id uuid,p_home_id uuid,p_file_id uuid,
  p_dates jsonb DEFAULT '{}',p_message text DEFAULT NULL,p_request_context jsonb DEFAULT NULL,p_validity_days integer DEFAULT 730)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE f public."File"%ROWTYPE; l public."HomeLease"%ROWTYPE; r jsonb; payload jsonb;
BEGIN
  IF p_action IS DISTINCT FROM 'request' OR p_actor_id IS NULL OR p_file_id IS NULL
    OR NOT public.lock_home_invitation_scope(p_home_id) THEN
    RETURN '{"success":false,"status":400,"error":"Invalid lease request"}'::jsonb; END IF;
  PERFORM id FROM public."HomeAuthority" WHERE home_id=p_home_id ORDER BY id FOR UPDATE;
  SELECT * INTO f FROM public."File" WHERE id=p_file_id FOR UPDATE;
  IF NOT FOUND OR f.user_id IS DISTINCT FROM p_actor_id OR f.home_id IS DISTINCT FROM p_home_id OR f.is_deleted
    OR f.processing_status IS DISTINCT FROM 'completed' OR f.metadata->>'storage_contract' IS DISTINCT FROM 'home_lease_evidence_v1'
    OR f.metadata->'request_context' IS DISTINCT FROM p_request_context THEN
    RETURN '{"success":false,"status":409,"error":"Attach a completed file for this request"}'::jsonb; END IF;
  payload:=jsonb_build_object('dates',p_dates,'message',nullif(trim(p_message),''),'context',p_request_context);
  IF f.metadata ? 'lease_id' THEN
    SELECT * INTO l FROM public."HomeLease" WHERE id::text=f.metadata->>'lease_id';
    IF NOT FOUND OR l.home_id<>p_home_id OR l.primary_resident_user_id<>p_actor_id
      OR l.metadata->>'lease_file_id' IS DISTINCT FROM p_file_id::text OR l.state NOT IN ('pending','active')
      OR (l.state='active' AND l.end_at<=clock_timestamp()) OR f.metadata->'request_payload' IS DISTINCT FROM payload THEN
      RETURN '{"success":false,"status":409,"error":"This file was submitted with a different or closed request"}'::jsonb; END IF;
  END IF;
  r:=public.decide_home_lease('request',p_actor_id,p_home_id:=p_home_id,p_dates:=p_dates,p_message:=p_message,
    p_request_context:=p_request_context,p_validity_days:=p_validity_days);
  IF f.metadata ? 'lease_id' THEN
    -- Current Home/authority checks precede the existing status-conflict result.
    IF r->>'status'='409' THEN RETURN jsonb_build_object('success',true,'lease',to_jsonb(l),'replayed',true); END IF;
    RETURN r;
  END IF;
  IF r->>'success' IS DISTINCT FROM 'true' THEN RETURN r; END IF;
  UPDATE public."HomeLease" SET metadata=metadata||jsonb_build_object('lease_file_id',f.id)
    WHERE id=(r->'lease'->>'id')::uuid RETURNING * INTO l;
  UPDATE public."File" SET updated_at=now(),metadata=metadata||jsonb_build_object('lease_id',l.id,'request_payload',payload) WHERE id=f.id;
  RETURN r||jsonb_build_object('lease',to_jsonb(l));
END $$;

REVOKE ALL ON FUNCTION public.protect_home_lease_evidence_file(),public.retire_home_lease_evidence_parent(),
  public.mutate_home_lease_evidence(uuid,uuid,uuid,text,jsonb),
  public.request_home_lease_with_evidence(text,uuid,uuid,uuid,jsonb,text,jsonb,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mutate_home_lease_evidence(uuid,uuid,uuid,text,jsonb),
  public.request_home_lease_with_evidence(text,uuid,uuid,uuid,jsonb,text,jsonb,integer) TO service_role;


-- Reuse the existing expiry/cleanup worker and acknowledgement protocol. A
-- submitted lease file is published only while both sides of its binding match.
CREATE FUNCTION public.home_document_cleanup_bound(f public."File") RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT CASE WHEN f.metadata->>'storage_contract'='home_document_v1' THEN
    EXISTS(SELECT FROM public."HomeDocument" d WHERE d.file_id=f.id)
  WHEN f.metadata->>'storage_contract'='home_lease_evidence_v1' THEN
    NOT f.is_deleted AND EXISTS(SELECT FROM public."HomeLease" l WHERE l.id::text=f.metadata->>'lease_id'
      AND l.home_id=f.home_id AND l.primary_resident_user_id=f.user_id AND l.metadata->>'lease_file_id'=f.id::text)
  ELSE true END;
$$;
REVOKE ALL ON FUNCTION public.home_document_cleanup_bound(public."File") FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.home_document_cleanup_bound(public."File") TO service_role;
CREATE OR REPLACE FUNCTION public.home_document_cleanup_candidates(p_bucket text, p_limit integer DEFAULT 100)
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT f.id FROM public."File" f
  WHERE f.metadata->>'storage_contract' IN ('home_document_v1','home_lease_evidence_v1')
    AND f.metadata->>'storage_bucket' = p_bucket
    AND NOT public.home_document_cleanup_bound(f)
    AND ((f.is_deleted AND f.updated_at < now() - CASE
      WHEN f.metadata->>'storage_cleanup_pending' = 'false' THEN interval '1 day'
      ELSE interval '10 minutes' END)
      OR (f.is_deleted = false AND f.created_at < now() - interval '1 day'
        AND f.updated_at < now() - interval '10 minutes'))
  ORDER BY f.updated_at, f.id LIMIT greatest(1, least(coalesce(p_limit, 100), 100));
$$;

CREATE OR REPLACE FUNCTION public.claim_home_document_cleanup(p_file_id uuid, p_bucket text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_file public."File"%ROWTYPE; v_home_id text;
BEGIN
  -- Publication locks this same File in protect_home_document_record. Recheck
  -- the document only after that lock; expiry cannot remove a committed upload.
  SELECT * INTO v_file FROM public."File" WHERE id = p_file_id FOR UPDATE;
  v_home_id:=CASE WHEN v_file.metadata->>'storage_contract'='home_lease_evidence_v1'
    THEN v_file.metadata->>'original_home_id' ELSE v_file.home_id::text END;
  IF NOT FOUND OR v_file.metadata->>'storage_contract' NOT IN ('home_document_v1','home_lease_evidence_v1')
    OR v_file.metadata->>'storage_bucket' IS DISTINCT FROM p_bucket
    OR p_bucket IS NULL OR v_home_id IS NULL
    OR coalesce(v_file.metadata->>'upload_sha256', '') !~ '^[0-9a-f]{64}$'
    OR v_file.file_path IS DISTINCT FROM (v_home_id || '/' || coalesce(v_file.metadata->>'storage_key_id', v_file.id::text) || '/' || (v_file.metadata->>'upload_sha256'))
    OR public.home_document_cleanup_bound(v_file)
    OR v_file.updated_at >= now() - interval '10 minutes'
    OR (v_file.is_deleted = false AND v_file.created_at >= now() - interval '1 day')
    OR (v_file.is_deleted AND v_file.metadata->>'storage_cleanup_pending' = 'false'
      AND v_file.updated_at >= now() - interval '1 day') THEN
    RETURN NULL;
  END IF;
  IF v_file.is_deleted = false THEN
    UPDATE public."FileQuota" SET storage_used = greatest(storage_used - v_file.file_size, 0),
      file_count = greatest(file_count - 1, 0), updated_at = now()
      WHERE user_id = v_file.user_id;
  END IF;
  UPDATE public."File" SET is_deleted = true, deleted_at = coalesce(deleted_at, now()),
    processing_status = CASE WHEN v_file.is_deleted THEN processing_status ELSE 'failed' END,
    updated_at = now(), metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'deleted_document_visibility', coalesce(metadata->>'deleted_document_visibility', metadata->>'upload_visibility', 'managers'),
      'storage_cleanup_pending', true, 'storage_cleanup_claim', gen_random_uuid()::text
    ) WHERE id = p_file_id RETURNING * INTO v_file;
  RETURN to_jsonb(v_file);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_home_document_cleanup_pending(p_file_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE public."File" SET updated_at = now(),
    metadata = (metadata - 'storage_cleanup_claim') || '{"storage_cleanup_pending":true}'::jsonb
  WHERE id = p_file_id AND is_deleted AND metadata->>'storage_contract' IN ('home_document_v1','home_lease_evidence_v1');
$$;

CREATE OR REPLACE FUNCTION public.finish_home_document_cleanup(p_file_id uuid, p_claim text, p_succeeded boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public."File" SET updated_at = now(),
    metadata = (metadata - 'storage_cleanup_claim') || jsonb_build_object('storage_cleanup_pending', NOT coalesce(p_succeeded, false))
  WHERE id = p_file_id AND is_deleted AND metadata->>'storage_contract' IN ('home_document_v1','home_lease_evidence_v1')
    AND metadata->>'storage_cleanup_claim' = p_claim;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_deleted_files(days_old integer DEFAULT 30)
RETURNS TABLE(deleted_count integer, freed_space bigint)
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_deleted_count integer; v_freed_space bigint;
BEGIN
  WITH removed AS (
    DELETE FROM public."File" WHERE is_deleted = true
      AND deleted_at < now() - interval '1 day' * days_old
      AND coalesce(metadata->>'storage_contract', '') NOT IN ('home_document_v1','home_task_media_v1','home_claim_evidence_v1','home_lease_evidence_v1')
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
  IF v_file.metadata->>'storage_contract' IN ('home_document_v1','home_task_media_v1','home_claim_evidence_v1','home_lease_evidence_v1') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  UPDATE public."File" SET is_deleted = true, deleted_at = now(), updated_at = now() WHERE id = p_file_id;
  UPDATE public."FileQuota" SET storage_used = greatest(storage_used - v_file.file_size, 0),
    file_count = greatest(file_count - 1, 0), updated_at = now() WHERE user_id = p_user_id;
  RETURN jsonb_build_object('success', true, 'fileId', p_file_id, 'freedSpace', v_file.file_size);
END;
$$;


CREATE OR REPLACE FUNCTION public.home_delete_eligibility(p_home_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_home public."Home"%ROWTYPE; v_occ public."HomeOccupancy"%ROWTYPE;
  v_access jsonb; v_role public.home_role_base; v_primary boolean; v_private boolean := false;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_home_id IS NULL OR p_user_id IS NULL THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_ACCESS_DENIED','deleted',false);
  END IF;
  SELECT * INTO v_home FROM public."Home" WHERE id = p_home_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_NOT_FOUND','deleted',false);
  END IF;
  -- Destructive authority must not revive through an older Home.owner_id when
  -- the caller's ownership is disputed or revoked without a current verified
  -- record. Historical revoked rows may coexist with a legitimate reverified
  -- owner because the canonical uniqueness constraint excludes revoked rows.
  IF EXISTS (SELECT FROM public."HomeOwner" o WHERE o.home_id = p_home_id
    AND o.subject_type = 'user' AND o.subject_id = p_user_id
    AND (o.owner_status = 'disputed' OR (o.owner_status = 'revoked' AND NOT EXISTS (
      SELECT FROM public."HomeOwner" current_owner WHERE current_owner.home_id = p_home_id
        AND current_owner.subject_type = 'user' AND current_owner.subject_id = p_user_id
        AND current_owner.owner_status = 'verified')))) THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_ACCESS_DENIED','deleted',false);
  END IF;
  SELECT * INTO v_occ FROM public."HomeOccupancy" WHERE home_id = p_home_id AND user_id = p_user_id;
  -- This read-only RPC is VOLATILE deliberately: current time after lock waits
  -- fences an access window that ended while the transaction was waiting.
  -- Eligibility is advisory; the deletion RPC locks/rechecks before mutation.
  -- NULL age retains the existing adult compatibility.
  IF v_home.security_state IN ('frozen','frozen_silent') OR
    (v_occ.id IS NOT NULL AND (v_occ.is_active IS DISTINCT FROM true
      OR v_occ.age_band IN ('child','teen')
      OR v_occ.start_at > v_now OR v_occ.end_at <= v_now
      OR v_occ.access_start_at > v_now OR v_occ.access_end_at <= v_now)) THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_ACCESS_DENIED','deleted',false);
  END IF;
  v_primary := coalesce(v_home.owner_id = p_user_id, false) OR EXISTS (
    SELECT FROM public."HomeOwner" WHERE home_id = p_home_id AND subject_type = 'user'
      AND subject_id = p_user_id AND owner_status = 'verified' AND is_primary_owner);
  v_access := public.home_effective_access(p_home_id,p_user_id);
  IF v_primary AND coalesce((v_access->>'has_access')::boolean,false)
    AND coalesce((v_access->>'is_owner')::boolean,false) THEN
    IF NOT (v_access->'permissions' ?& ARRAY['home.edit','security.manage']) THEN
      RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_ACCESS_DENIED','deleted',false);
    END IF;
  ELSE
    -- This is removal of an exact creator's unfinished private setup. It is
    -- never generic provisional membership or authority over a household.
    v_role := coalesce(v_occ.role_base, CASE v_occ.role
      WHEN 'owner' THEN 'owner' WHEN 'admin' THEN 'admin'
      WHEN 'manager' THEN 'manager' WHEN 'property_manager' THEN 'manager'
      WHEN 'tenant' THEN 'lease_resident' WHEN 'renter' THEN 'lease_resident'
      WHEN 'lease_resident' THEN 'lease_resident' WHEN 'member' THEN 'member'
      WHEN 'roommate' THEN 'member' WHEN 'family' THEN 'member'
      WHEN 'restricted_member' THEN 'restricted_member' WHEN 'caregiver' THEN 'restricted_member'
      WHEN 'guest' THEN 'guest' WHEN 'service_provider' THEN 'service_provider'
      ELSE NULL END::public.home_role_base);
    IF v_home.created_by_user_id IS DISTINCT FROM p_user_id
      OR (v_home.owner_id IS NOT NULL AND v_home.owner_id <> p_user_id)
      OR v_occ.id IS NULL OR v_role IS NULL
      OR v_occ.verified_at IS NOT NULL
      OR v_occ.verification_status IS NULL
      OR v_occ.verification_status NOT IN ('provisional_bootstrap','pending_doc')
      OR EXISTS (SELECT FROM public."HomeOccupancy" WHERE home_id = p_home_id AND user_id <> p_user_id)
      OR EXISTS (SELECT FROM public."HomeOwner" WHERE home_id = p_home_id
        AND (subject_type <> 'user' OR subject_id <> p_user_id OR owner_status <> 'pending')) THEN
      RETURN jsonb_build_object('allowed',false,'code','DELETE_HOME_NOT_PRIMARY','deleted',false);
    END IF;
    IF EXISTS (SELECT FROM public."HomePermissionOverride" WHERE home_id = p_home_id
      AND user_id = p_user_id AND permission IN ('home.edit','security.manage') AND NOT allowed)
      OR EXISTS (SELECT FROM public."HomeRolePermission" r WHERE r.role_base = v_role
        AND r.permission IN ('home.edit','security.manage') AND NOT r.allowed
        AND NOT EXISTS (SELECT FROM public."HomePermissionOverride" o WHERE o.home_id = p_home_id
          AND o.user_id = p_user_id AND o.permission = r.permission AND o.allowed)) THEN
      RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_ACCESS_DENIED','deleted',false);
    END IF;
    v_private := true;
  END IF;

  -- Task uploads retain their existing explicit cleanup journey. Private lease
  -- Files are retired/detached by the Home deletion trigger in this same
  -- transaction, so an applicant's abandoned draft cannot trap its Home owner.
  -- Documents, claim evidence and every legacy File remain independent blockers.
  IF EXISTS (SELECT FROM public."File" f WHERE home_id = p_home_id
    AND NOT (public.home_task_media_file_bound(f)
      OR coalesce(f.metadata->>'storage_contract','')='home_lease_evidence_v1'))
    OR EXISTS (SELECT FROM public."HomeDocument" WHERE home_id = p_home_id)
    OR EXISTS (SELECT FROM public."HomeTaskMedia" m WHERE (home_id=p_home_id
      OR EXISTS(SELECT FROM public."HomeTask" t WHERE t.id=m.task_id AND t.home_id=p_home_id))
      AND NOT EXISTS(SELECT FROM public."HomeTaskMediaIntent" i WHERE i.id=m.id AND i.id=m.private_upload_id
        AND i.home_id=p_home_id AND i.task_id=m.task_id AND i.state='ready'))
    OR EXISTS(SELECT FROM public."HomeClaimEvidenceIntent" i WHERE i.original_home_id=p_home_id)
    OR EXISTS (SELECT FROM public."HomeVerificationEvidence" e JOIN public."HomeOwnershipClaim" c
      ON c.id = e.claim_id WHERE c.home_id = p_home_id) THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_STORAGE_CLEANUP_REQUIRED','deleted',false);
  END IF;
  IF EXISTS (SELECT FROM public."CommunityMailItem" WHERE home_id = p_home_id)
    OR EXISTS (SELECT FROM public."HomeMapPin" WHERE home_id = p_home_id)
    OR EXISTS (SELECT FROM public."VacationHold" WHERE home_id = p_home_id)
    OR EXISTS (SELECT FROM public."MailDeliveryIntent" WHERE intended_home_id = p_home_id)
    OR EXISTS (SELECT FROM public."NeighborEndorsement" WHERE endorser_home_id = p_home_id) THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_LINKED_DATA','deleted',false);
  END IF;

  IF v_private THEN
    -- Explicit setup allowlist matches POST /homes: the caller's occupancy,
    -- pending owner + unreviewed claim, its audit, preferences and own WiFi.
    -- Own Unlisted progress and pickup rules are also private first-use data.
    -- Any other relation is conservatively a household/established-data fence,
    -- even if its creator happens to be this caller. No dynamic table scan.
    IF EXISTS (SELECT FROM public."HomeOwnershipClaim" c WHERE home_id = p_home_id
        AND (claimant_user_id <> p_user_id OR (state NOT IN ('draft','submitted')
          AND NOT public.home_claim_own_private_withdrawal(c,p_user_id)) OR reviewed_by IS NOT NULL
          OR reviewed_at IS NOT NULL OR merged_into_claim_id IS NOT NULL))
      OR EXISTS (SELECT FROM public."HomeOwnershipClaim" foreign_claim JOIN public."HomeOwnershipClaim" own_claim
        ON foreign_claim.merged_into_claim_id = own_claim.id WHERE own_claim.home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeClaimRelationshipReceipt" WHERE home_id=p_home_id)
      OR EXISTS (SELECT FROM public."HomeResidencyReviewReceipt" WHERE home_id=p_home_id)
      OR EXISTS (SELECT FROM public."HomeClaimReviewReceipt" receipt WHERE receipt.home_id=p_home_id
        AND NOT (receipt.actor_user_id=p_user_id AND receipt.action='withdraw' AND receipt.private_setup
          AND NOT receipt.platform_admin AND EXISTS(SELECT FROM public."HomeOwnershipClaim" c
            WHERE c.id=receipt.claim_id AND c.home_id=p_home_id
              AND public.home_claim_own_private_withdrawal(c,p_user_id))))
      OR EXISTS (SELECT FROM public."HomeTaskRecurrence" s WHERE s.home_id=p_home_id
        AND NOT (s.actor_user_id=p_user_id AND s.private_setup))
      OR EXISTS (SELECT FROM public."HomeTaskRecurrenceCommand" s WHERE s.home_id=p_home_id
        AND NOT (s.actor_user_id=p_user_id AND s.private_setup))
      OR EXISTS (SELECT FROM public."HomeTaskCreateReceipt" receipt WHERE receipt.home_id=p_home_id
        AND NOT (receipt.actor_user_id=p_user_id AND receipt.private_setup))
      OR EXISTS (SELECT FROM public."HomeTaskAssignmentDelivery" d WHERE d.home_id=p_home_id)
      OR EXISTS (SELECT FROM public."HomeAuditLog" a WHERE a.home_id = p_home_id AND (
        a.actor_user_id IS DISTINCT FROM p_user_id OR NOT coalesce(
          (a.action = 'OCCUPANCY_TEMPLATE_APPLIED' AND a.target_type = 'HomeOccupancy'
            AND a.target_id = v_occ.id
            AND a.metadata->>'verification_status' IN ('provisional_bootstrap','pending_doc'))
          OR public.home_secret_own_setup_audit(a,p_user_id)
          OR public.home_record_own_setup_audit(a,p_user_id)
          OR (a.action='OWNERSHIP_CLAIM_WITHDRAWN' AND a.target_type='HomeOwnershipClaim'
            AND EXISTS(SELECT FROM public."HomeOwnershipClaim" c WHERE c.id=a.target_id
              AND c.home_id=p_home_id AND public.home_claim_own_private_withdrawal(c,p_user_id)))
          OR (a.action = 'OWNERSHIP_CLAIM_SUBMITTED' AND a.target_type = 'HomeOwnershipClaim'
            AND EXISTS (SELECT FROM public."HomeOwnershipClaim" c WHERE c.id = a.target_id
              AND c.home_id = p_home_id AND c.claimant_user_id = p_user_id)),false)))
      OR EXISTS (SELECT FROM public."HomeAccessSecret" WHERE home_id = p_home_id AND created_by IS DISTINCT FROM p_user_id)
      OR EXISTS (SELECT FROM public."HomePermissionOverride" WHERE home_id = p_home_id
        AND (user_id <> p_user_id OR created_by IS DISTINCT FROM p_user_id))
      OR EXISTS (SELECT FROM public."UnlistedRemoval" WHERE home_id = p_home_id AND user_id <> p_user_id)
      OR EXISTS (SELECT FROM public."AddressCalendarRule" WHERE scope_type = 'home'
        AND public.home_calendar_scope_id(scope_key) = p_home_id AND created_by IS DISTINCT FROM p_user_id)
      OR EXISTS (SELECT FROM public."Activity" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."AddressReviewCase" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."AttomPropertyCache" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BlockFounder" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BlockInvite" WHERE sender_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BookingPackage" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BookingPage" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Booking" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BusinessProfileView" WHERE viewer_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."ChatRoom" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."EventType" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."FridgeCard" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeAsset" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeAuthority" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeBill" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeBusinessLink" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeCalendarEvent" e WHERE home_id = p_home_id
        AND (NOT public.home_event_private_setup(e,p_user_id)
          OR EXISTS (SELECT FROM public."HomeCalendarEventAttendee" a WHERE a.event_id=e.id AND a.user_id<>p_user_id)))
      OR EXISTS (SELECT FROM public."HomeDevice" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeDispute" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeEmergency" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeEstateFields" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeGuestPass" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeHouseholdAccessRequest" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeInvite" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeIssue" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeLeaseInvite" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeLease" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeMaintenanceLog" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeMaintenanceTemplate" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeMedia" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePackage" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePet" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePoll" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePostcardCode" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePrivacy" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePrivateData" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePublicData" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeQuorumAction" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeRecordWatch" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeRentReport" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeReputation" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeResidencyClaim" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeResource" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeRvStatus" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeScopedGrant" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeShareReadReceipt" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeSeasonalChecklistItem" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeSubscription" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeSystem" WHERE home_id = p_home_id)
      OR EXISTS(SELECT FROM public."HomeTaskMediaIntent" i WHERE i.original_home_id=p_home_id
        AND NOT public.home_task_media_own_setup(i,p_user_id))
      OR EXISTS (SELECT FROM public."HomeTask" t WHERE home_id = p_home_id
        AND NOT public.home_task_private_setup(t,p_user_id))
      OR EXISTS (SELECT FROM public."HomeVendor" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeVerification" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Home" WHERE parent_home_id = p_home_id OR canonical_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."ListingInventorySlot" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Listing" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MailAlias" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MailDayItem" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MailPartySession" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MailRoutingQueue" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Mail" WHERE address_home_id = p_home_id OR address_id = p_home_id OR recipient_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MessageTemplate" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."NeighborMessage" WHERE sender_home_id = p_home_id OR recipient_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Post" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."PropertyIntelligenceCache" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."ResidencyClaim" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."ResidencyLetter" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."SavedTaskTemplate" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."SchedulingPoll" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."SchedulingWorkflow" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."SupportTrain" WHERE recipient_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."VaultFolder" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Gig" WHERE origin_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Payment" WHERE home_id = p_home_id) THEN
      RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_ESTABLISHED_HOUSEHOLD','deleted',false);
    END IF;
  END IF;
  -- Deleting the Home cannot bypass a current task/source/sensitive deny.
  IF EXISTS(SELECT FROM public."HomeTask" t WHERE t.home_id=p_home_id
    AND EXISTS(SELECT FROM public."HomeTaskMediaIntent" i WHERE i.original_home_id=p_home_id AND i.original_task_id=t.id)
    AND (public.home_task_readable(t,p_user_id) IS DISTINCT FROM true
      OR NOT coalesce((public.home_record_context(p_home_id,p_user_id)->'permissions' ? 'tasks.manage')
        OR (t.created_by=p_user_id AND public.home_record_context(p_home_id,p_user_id)->'permissions' ? 'tasks.edit'),false))) THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_ACCESS_DENIED','deleted',false);
  END IF;
  IF EXISTS(SELECT FROM public."HomeTaskGigReceipt" WHERE home_id=p_home_id) THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_ESTABLISHED_HOUSEHOLD','deleted',false);
  END IF;
  RETURN jsonb_build_object('allowed',true,'code','HOME_DELETE_ALLOWED','deleted',false);
END;
$$;
