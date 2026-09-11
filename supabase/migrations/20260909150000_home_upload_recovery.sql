-- Backwards compatible: yes. All shipped clients mutate files and quotas through
-- the authenticated backend using service_role. Direct browser SQL must not
-- rewrite limits/counters or forge file sizes around that accounting contract.
-- Existing rows and limits are preserved; no external objects are touched here.
SET LOCAL lock_timeout = '5s';

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public."File", public."FileQuota" FROM anon, authenticated;

ALTER TABLE public."File" ADD CONSTRAINT file_size_nonnegative
  CHECK (file_size >= 0) NOT VALID;

-- The preliminary can_upload_file check is only a user-facing hint. Enforce the
-- actual reservation while holding the shared quota row lock. Failed admission
-- rolls back the File insert too, including concurrent requests with different
-- upload IDs. Daily counters reset before checking the daily limit.
CREATE OR REPLACE FUNCTION public.update_quota_after_upload() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public."FileQuota" (user_id) VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public."FileQuota" SET
    storage_used = coalesce(storage_used, 0) + NEW.file_size,
    file_count = coalesce(file_count, 0) + 1,
    uploads_today = CASE WHEN uploads_today_reset_at <= now() THEN 1
      ELSE coalesce(uploads_today, 0) + 1 END,
    uploads_today_reset_at = CASE WHEN uploads_today_reset_at <= now()
      THEN date_trunc('day', now() + interval '1 day') ELSE uploads_today_reset_at END,
    updated_at = now()
  WHERE user_id = NEW.user_id
    AND coalesce(storage_used, 0) + NEW.file_size <= coalesce(storage_limit, 0)
    AND coalesce(file_count, 0) < coalesce(max_files, 0)
    AND (CASE WHEN uploads_today_reset_at <= now() THEN 0 ELSE coalesce(uploads_today, 0) END) < 100;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FILE_QUOTA_EXCEEDED' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

-- Retain upload UUID tombstones indefinitely. Completed removals are checked
-- daily too: a provider write may finish after deletion even if its API process
-- dies before marking cleanup pending. Bounded oldest-first work eventually
-- removes those late objects without guessing provider paths or listing a bucket.
CREATE INDEX home_document_recovery_due ON public."File" (updated_at, id)
WHERE metadata->>'storage_contract' = 'home_document_v1';

CREATE FUNCTION public.home_document_cleanup_candidates(p_bucket text, p_limit integer DEFAULT 100)
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT f.id FROM public."File" f
  WHERE f.metadata->>'storage_contract' = 'home_document_v1'
    AND f.metadata->>'storage_bucket' = p_bucket
    AND NOT EXISTS (SELECT 1 FROM public."HomeDocument" d WHERE d.file_id = f.id)
    AND ((f.is_deleted AND f.updated_at < now() - CASE
      WHEN f.metadata->>'storage_cleanup_pending' = 'false' THEN interval '1 day'
      ELSE interval '10 minutes' END)
      OR (f.is_deleted = false AND f.created_at < now() - interval '1 day'
        AND f.updated_at < now() - interval '10 minutes'))
  ORDER BY f.updated_at, f.id LIMIT greatest(1, least(coalesce(p_limit, 100), 100));
$$;

CREATE FUNCTION public.claim_home_document_cleanup(p_file_id uuid, p_bucket text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_file public."File"%ROWTYPE;
BEGIN
  -- Publication locks this same File in protect_home_document_record. Recheck
  -- the document only after that lock; expiry cannot remove a committed upload.
  SELECT * INTO v_file FROM public."File" WHERE id = p_file_id FOR UPDATE;
  IF NOT FOUND OR v_file.metadata->>'storage_contract' IS DISTINCT FROM 'home_document_v1'
    OR v_file.metadata->>'storage_bucket' IS DISTINCT FROM p_bucket
    OR p_bucket IS NULL OR v_file.home_id IS NULL
    OR coalesce(v_file.metadata->>'upload_sha256', '') !~ '^[0-9a-f]{64}$'
    OR v_file.file_path IS DISTINCT FROM (v_file.home_id::text || '/' || v_file.id::text || '/' || (v_file.metadata->>'upload_sha256'))
    OR EXISTS (SELECT 1 FROM public."HomeDocument" WHERE file_id = v_file.id)
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

-- A late upload invalidates a cleanup claim. Its older acknowledgement must not
-- erase the pending retry; only a matching worker attempt can acknowledge it.
CREATE FUNCTION public.mark_home_document_cleanup_pending(p_file_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE public."File" SET updated_at = now(),
    metadata = (metadata - 'storage_cleanup_claim') || '{"storage_cleanup_pending":true}'::jsonb
  WHERE id = p_file_id AND is_deleted AND metadata->>'storage_contract' = 'home_document_v1';
$$;

CREATE FUNCTION public.finish_home_document_cleanup(p_file_id uuid, p_claim text, p_succeeded boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public."File" SET updated_at = now(),
    metadata = (metadata - 'storage_cleanup_claim') || jsonb_build_object('storage_cleanup_pending', NOT coalesce(p_succeeded, false))
  WHERE id = p_file_id AND is_deleted AND metadata->>'storage_contract' = 'home_document_v1'
    AND metadata->>'storage_cleanup_claim' = p_claim;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.home_document_cleanup_candidates(text, integer),
  public.claim_home_document_cleanup(uuid, text), public.mark_home_document_cleanup_pending(uuid),
  public.finish_home_document_cleanup(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.home_document_cleanup_candidates(text, integer),
  public.claim_home_document_cleanup(uuid, text), public.mark_home_document_cleanup_pending(uuid),
  public.finish_home_document_cleanup(uuid, text, boolean) TO service_role;

-- Keep the preliminary check consistent with atomic daily admission and avoid
-- racing first-use quota creation. It never reserves capacity on its own.
CREATE OR REPLACE FUNCTION public.can_upload_file(p_user_id uuid, p_file_size bigint) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_quota RECORD;
BEGIN
  -- Get user quota
  SELECT * INTO v_quota
  FROM "FileQuota"
  WHERE user_id = p_user_id;
  
  -- Create quota if doesn't exist
  IF NOT FOUND THEN
    INSERT INTO "FileQuota" (user_id)
    VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
    
    SELECT * INTO v_quota
    FROM "FileQuota"
    WHERE user_id = p_user_id;
  END IF;
  
  -- Check storage limit
  IF v_quota.storage_used + p_file_size > v_quota.storage_limit THEN
    RETURN jsonb_build_object(
      'canUpload', false,
      'reason', 'storage_limit_exceeded',
      'storageUsed', v_quota.storage_used,
      'storageLimit', v_quota.storage_limit,
      'storageAvailable', v_quota.storage_limit - v_quota.storage_used
    );
  END IF;
  
  -- Check file count limit
  IF v_quota.file_count >= v_quota.max_files THEN
    RETURN jsonb_build_object(
      'canUpload', false,
      'reason', 'file_count_limit_exceeded',
      'fileCount', v_quota.file_count,
      'maxFiles', v_quota.max_files
    );
  END IF;
  
  -- Check daily upload limit (prevent abuse)
  IF v_quota.uploads_today_reset_at > now() AND v_quota.uploads_today >= 100 THEN
    RETURN jsonb_build_object(
      'canUpload', false,
      'reason', 'daily_upload_limit_exceeded',
      'uploadsToday', v_quota.uploads_today
    );
  END IF;
  
  -- All checks passed
  RETURN jsonb_build_object(
    'canUpload', true,
    'storageAvailable', v_quota.storage_limit - v_quota.storage_used
  );
END;
$$;
