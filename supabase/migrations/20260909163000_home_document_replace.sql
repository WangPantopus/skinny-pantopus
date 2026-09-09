-- Backwards compatible: yes for existing records. New replacement is used only
-- with the matching API/worker version; old APIs fail closed on versioned paths.
-- Keep document and current File identities stable. Each byte version has a
-- unique storage key so cleanup of an older version cannot erase reused bytes.
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.claim_home_document_cleanup(p_file_id uuid, p_bucket text)
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
    OR v_file.file_path IS DISTINCT FROM (v_file.home_id::text || '/' || coalesce(v_file.metadata->>'storage_key_id', v_file.id::text) || '/' || (v_file.metadata->>'upload_sha256'))
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

CREATE FUNCTION public.replace_home_document_file(
  p_home_id uuid, p_document_id uuid, p_upload_id uuid, p_actor_id uuid,
  p_expected_version uuid, p_expected_fingerprint text, p_expected_visibility text,
  p_request_fingerprint text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_old public."File"%ROWTYPE;
  v_new public."File"%ROWTYPE;
  v_document public."HomeDocument"%ROWTYPE;
BEGIN
  IF p_upload_id IS NULL OR p_upload_id = p_document_id OR p_actor_id IS NULL
    OR p_expected_version IS NULL OR p_request_fingerprint IS NULL THEN
    RETURN jsonb_build_object('code', 'DOCUMENT_UPLOAD_CONFLICT');
  END IF;
  PERFORM 1 FROM public."File" WHERE id IN (p_document_id, p_upload_id) ORDER BY id FOR UPDATE;
  SELECT * INTO v_old FROM public."File" WHERE id = p_document_id;
  SELECT * INTO v_new FROM public."File" WHERE id = p_upload_id;
  SELECT * INTO v_document FROM public."HomeDocument" WHERE id = p_document_id FOR UPDATE;
  IF v_old.id IS NULL OR v_document.id IS NULL OR v_old.is_deleted IS DISTINCT FROM false
    OR v_old.home_id IS DISTINCT FROM p_home_id OR v_document.home_id IS DISTINCT FROM p_home_id
    OR v_document.file_id IS DISTINCT FROM v_old.id OR v_document.created_by IS DISTINCT FROM v_old.user_id
    OR v_old.metadata->>'storage_contract' IS DISTINCT FROM 'home_document_v1'
    OR v_new.home_id IS DISTINCT FROM p_home_id THEN
    RETURN jsonb_build_object('code', 'DOCUMENT_NOT_FOUND');
  END IF;
  IF v_new.is_deleted AND v_new.metadata->>'replacement_applied' = 'true'
    AND v_new.metadata->>'replacement_request_fingerprint' = p_request_fingerprint
    AND v_new.metadata->>'replacement_actor' = p_actor_id::text
    AND v_new.metadata->>'replacement_target' = p_document_id::text
    AND v_document.details->>'upload_version' = p_upload_id::text THEN
    RETURN jsonb_build_object('document', to_jsonb(v_document), 'reused', true);
  END IF;
  IF v_new.id IS NULL OR v_new.is_deleted IS DISTINCT FROM false
    OR v_new.user_id IS DISTINCT FROM p_actor_id
    OR v_new.metadata->>'storage_contract' IS DISTINCT FROM 'home_document_v1'
    OR v_new.metadata->>'replacement_pending' IS DISTINCT FROM 'true'
    OR v_new.metadata->>'replacement_target' IS DISTINCT FROM p_document_id::text
    OR v_new.metadata->>'replacement_expected_version' IS DISTINCT FROM p_expected_version::text
    OR v_new.metadata->>'storage_key_id' IS DISTINCT FROM p_upload_id::text
    OR coalesce(v_new.metadata->>'upload_sha256', '') !~ '^[0-9a-f]{64}$'
    OR v_new.file_path IS DISTINCT FROM (p_home_id::text || '/' || p_upload_id::text || '/' || (v_new.metadata->>'upload_sha256'))
    OR v_new.metadata->>'storage_bucket' IS DISTINCT FROM v_old.metadata->>'storage_bucket'
    OR v_new.metadata->>'upload_fingerprint' IS DISTINCT FROM p_request_fingerprint
    OR coalesce(v_document.details->>'upload_version', v_document.id::text) IS DISTINCT FROM p_expected_version::text
    OR v_old.metadata->>'upload_fingerprint' IS DISTINCT FROM p_expected_fingerprint
    OR v_document.details->>'upload_fingerprint' IS DISTINCT FROM p_expected_fingerprint
    OR v_document.visibility::text IS DISTINCT FROM p_expected_visibility THEN
    RETURN jsonb_build_object('code', 'DOCUMENT_CHANGED');
  END IF;

  -- The new upload already holds quota. Transfer it into the stable current
  -- File row, releasing only the old owner's charge. The UPDATE triggers do
  -- not charge or refund File quota, so this cannot double-count either version.
  UPDATE public."FileQuota" SET storage_used = greatest(storage_used - v_old.file_size, 0),
    file_count = greatest(file_count - 1, 0), updated_at = now() WHERE user_id = v_old.user_id;
  UPDATE public."File" SET user_id = v_new.user_id, filename = v_new.filename,
    original_filename = v_new.original_filename, file_path = v_new.file_path,
    file_size = v_new.file_size, mime_type = v_new.mime_type, file_extension = v_new.file_extension,
    processing_status = 'completed', updated_at = now(),
    metadata = v_new.metadata - 'replacement_pending' - 'replacement_expected_version' - 'replacement_target'
    WHERE id = p_document_id;
  UPDATE public."HomeDocument" SET created_by = v_new.user_id, mime_type = v_new.mime_type,
    size_bytes = v_new.file_size, storage_bucket = v_new.metadata->>'storage_bucket',
    storage_path = v_new.file_path, updated_at = now(),
    details = coalesce(details, '{}'::jsonb) || jsonb_build_object(
      'storage_contract', 'home_document_v1', 'upload_version', p_upload_id::text,
      'upload_fingerprint', p_request_fingerprint, 'upload_sha256', v_new.metadata->>'upload_sha256',
      'original_filename', v_new.original_filename
    ) WHERE id = p_document_id RETURNING * INTO v_document;

  -- The reservation UUID now retains the old private object's cleanup record
  -- plus enough request identity to reconcile a lost successful response.
  UPDATE public."File" SET user_id = v_old.user_id, filename = v_old.filename,
    original_filename = v_old.original_filename, file_path = v_old.file_path,
    file_size = v_old.file_size, mime_type = v_old.mime_type, file_extension = v_old.file_extension,
    processing_status = 'completed', is_deleted = true, deleted_at = now(), updated_at = now(),
    metadata = (v_old.metadata - 'storage_cleanup_claim') || jsonb_build_object(
      'storage_key_id', coalesce(v_old.metadata->>'storage_key_id', v_old.id::text),
      'deleted_document_visibility', v_document.visibility, 'storage_cleanup_pending', true,
      'replacement_applied', true, 'replacement_target', p_document_id::text,
      'replacement_actor', p_actor_id::text, 'replacement_request_fingerprint', p_request_fingerprint,
      'replacement_result_version', p_upload_id::text
    ) WHERE id = p_upload_id;
  RETURN jsonb_build_object('document', to_jsonb(v_document), 'reused', false);
END;
$$;

CREATE FUNCTION public.reject_home_document_replacement(p_upload_id uuid, p_actor_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_file public."File"%ROWTYPE;
BEGIN
  SELECT * INTO v_file FROM public."File" WHERE id = p_upload_id FOR UPDATE;
  IF NOT FOUND OR v_file.user_id IS DISTINCT FROM p_actor_id OR v_file.is_deleted IS DISTINCT FROM false
    OR v_file.metadata->>'storage_contract' IS DISTINCT FROM 'home_document_v1'
    OR v_file.metadata->>'replacement_pending' IS DISTINCT FROM 'true'
    OR v_file.metadata->>'replacement_target' = v_file.id::text
    OR EXISTS (SELECT 1 FROM public."HomeDocument" WHERE file_id = v_file.id) THEN
    RETURN false;
  END IF;
  UPDATE public."FileQuota" SET storage_used = greatest(storage_used - v_file.file_size, 0),
    file_count = greatest(file_count - 1, 0), updated_at = now() WHERE user_id = v_file.user_id;
  UPDATE public."File" SET is_deleted = true, deleted_at = now(), updated_at = now(),
    processing_status = 'failed', metadata = metadata || jsonb_build_object(
      'deleted_document_visibility', coalesce(metadata->>'upload_visibility', 'managers'),
      'storage_cleanup_pending', true, 'replacement_rejected', true
    ) WHERE id = p_upload_id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.replace_home_document_file(uuid, uuid, uuid, uuid, uuid, text, text, text),
  public.reject_home_document_replacement(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_home_document_file(uuid, uuid, uuid, uuid, uuid, text, text, text),
  public.reject_home_document_replacement(uuid, uuid) TO service_role;
