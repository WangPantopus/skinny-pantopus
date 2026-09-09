-- Backwards compatible: yes. The service-only deletion RPC is additive; existing
-- API document storage uses service_role. Legacy non-document File access stays
-- available. Direct client access was never part of the Home byte contract.
SET LOCAL lock_timeout = '5s';

-- Home document bytes are owned by the authenticated API contract. Client SQL
-- must not bypass its current Home/visibility checks through generic File CRUD.
ALTER POLICY file_select_own ON public."File" USING (
  coalesce(metadata->>'storage_contract', '') <> 'home_document_v1'
  AND (user_id = auth.uid() OR visibility = 'public')
);

CREATE FUNCTION public.protect_home_document_file() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_protected boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_protected := NEW.metadata->>'storage_contract' = 'home_document_v1';
  ELSIF TG_OP = 'DELETE' THEN
    v_protected := OLD.metadata->>'storage_contract' = 'home_document_v1';
  ELSE
    v_protected := OLD.metadata->>'storage_contract' = 'home_document_v1'
      OR NEW.metadata->>'storage_contract' = 'home_document_v1';
  END IF;
  IF coalesce(v_protected, false) AND current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    RAISE EXCEPTION 'Use the authenticated Home document API' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- Generic retention cleanup must keep Home upload UUID tombstones. Removing
-- one would let an old multipart retry recreate a document after 30 days.
CREATE OR REPLACE FUNCTION public.cleanup_old_deleted_files(days_old integer DEFAULT 30)
RETURNS TABLE(deleted_count integer, freed_space bigint)
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_deleted_count integer; v_freed_space bigint;
BEGIN
  WITH removed AS (
    DELETE FROM public."File" WHERE is_deleted = true
      AND deleted_at < now() - interval '1 day' * days_old
      AND coalesce(metadata->>'storage_contract', '') <> 'home_document_v1'
    RETURNING file_size
  ) SELECT count(*)::integer, coalesce(sum(file_size), 0) INTO v_deleted_count, v_freed_space FROM removed;
  RETURN QUERY SELECT v_deleted_count, v_freed_space;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_home_document_file() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER protect_home_document_file
BEFORE INSERT OR UPDATE OR DELETE ON public."File"
FOR EACH ROW EXECUTE FUNCTION public.protect_home_document_file();

-- Lock the File when publishing its document so an upload that was in flight
-- during deletion cannot recreate the list row after its tombstone commits.
-- Client SQL also cannot edit/remove trusted byte metadata around the API.
CREATE FUNCTION public.protect_home_document_record() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_protected boolean; v_file public."File"%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_protected := NEW.details->>'storage_contract' = 'home_document_v1';
  ELSIF TG_OP = 'DELETE' THEN
    v_protected := OLD.details->>'storage_contract' = 'home_document_v1';
  ELSE
    v_protected := OLD.details->>'storage_contract' = 'home_document_v1'
      OR NEW.details->>'storage_contract' = 'home_document_v1';
  END IF;
  IF coalesce(v_protected, false) THEN
    IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
      RAISE EXCEPTION 'Use the authenticated Home document API' USING ERRCODE = '42501';
    END IF;
    IF TG_OP <> 'DELETE' THEN
      SELECT * INTO v_file FROM public."File" WHERE id = NEW.file_id FOR UPDATE;
      IF NOT FOUND OR v_file.is_deleted IS DISTINCT FROM false
        OR v_file.id IS DISTINCT FROM NEW.id OR v_file.home_id IS DISTINCT FROM NEW.home_id
        OR v_file.user_id IS DISTINCT FROM NEW.created_by
        OR v_file.metadata->>'storage_contract' IS DISTINCT FROM 'home_document_v1'
        OR v_file.metadata->>'upload_fingerprint' IS DISTINCT FROM NEW.details->>'upload_fingerprint' THEN
        RAISE EXCEPTION 'Home document upload is unavailable or changed' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_home_document_record() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER protect_home_document_record
BEFORE INSERT OR UPDATE OR DELETE ON public."HomeDocument"
FOR EACH ROW EXECUTE FUNCTION public.protect_home_document_record();

-- Only the trusted backend can call this after current docs.manage and
-- visibility authorization. The fingerprint prevents deleting a version that
-- changed after that check. File is retained as a retry tombstone; an old upload
-- UUID cannot recreate the document. Quota and document removal commit together.
CREATE FUNCTION public.delete_home_document_file(
  p_home_id uuid, p_document_id uuid, p_actor_id uuid, p_expected_fingerprint text, p_expected_visibility text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_file public."File"%ROWTYPE;
  v_document public."HomeDocument"%ROWTYPE;
BEGIN
  IF p_actor_id IS NULL OR p_expected_fingerprint IS NULL OR p_expected_visibility IS NULL THEN
    RETURN jsonb_build_object('code', 'DOCUMENT_ACCESS_DENIED');
  END IF;
  SELECT * INTO v_file FROM public."File" WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND OR v_file.home_id IS DISTINCT FROM p_home_id
    OR v_file.metadata->>'storage_contract' IS DISTINCT FROM 'home_document_v1' THEN
    RETURN jsonb_build_object('code', 'DOCUMENT_NOT_FOUND');
  END IF;
  IF v_file.metadata->>'upload_fingerprint' IS DISTINCT FROM p_expected_fingerprint THEN
    RETURN jsonb_build_object('code', 'DOCUMENT_CHANGED');
  END IF;
  IF v_file.is_deleted AND v_file.metadata ? 'deleted_document_visibility' THEN
    IF v_file.metadata->>'deleted_document_visibility' IS DISTINCT FROM p_expected_visibility THEN
      RETURN jsonb_build_object('code', 'DOCUMENT_CHANGED');
    END IF;
    RETURN jsonb_build_object('file', to_jsonb(v_file), 'reused', true);
  END IF;
  SELECT * INTO v_document FROM public."HomeDocument" WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND OR v_document.home_id IS DISTINCT FROM p_home_id
    OR v_document.file_id IS DISTINCT FROM v_file.id
    OR v_document.created_by IS DISTINCT FROM v_file.user_id
    OR v_document.visibility::text IS DISTINCT FROM p_expected_visibility
    OR v_document.details->>'upload_fingerprint' IS DISTINCT FROM p_expected_fingerprint THEN
    RETURN jsonb_build_object('code', 'DOCUMENT_CHANGED');
  END IF;
  IF NOT v_file.is_deleted THEN
    UPDATE public."FileQuota" SET
      storage_used = greatest(storage_used - v_file.file_size, 0),
      file_count = greatest(file_count - 1, 0), updated_at = now()
    WHERE user_id = v_file.user_id;
  END IF;
  UPDATE public."File" SET is_deleted = true, deleted_at = coalesce(deleted_at, now()),
    updated_at = now(), metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'deleted_document_visibility', v_document.visibility,
      'document_deleted_by', p_actor_id, 'storage_cleanup_pending', true
    ) WHERE id = p_document_id RETURNING * INTO v_file;
  DELETE FROM public."HomeDocument" WHERE id = p_document_id;
  RETURN jsonb_build_object('file', to_jsonb(v_file), 'reused', false);
END;
$$;
REVOKE ALL ON FUNCTION public.delete_home_document_file(uuid, uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_home_document_file(uuid, uuid, uuid, text, text) TO service_role;

-- The generic legacy RPC stays an invoker function and cannot remove private
-- Home files. Lock before reading is_deleted so concurrent legacy requests also
-- cannot subtract the same file from quota twice.
CREATE OR REPLACE FUNCTION public.soft_delete_file(p_file_id uuid, p_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_file public."File"%ROWTYPE;
BEGIN
  SELECT * INTO v_file FROM public."File"
  WHERE id = p_file_id AND user_id = p_user_id AND is_deleted = false FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'File not found or already deleted');
  END IF;
  IF v_file.metadata->>'storage_contract' = 'home_document_v1' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  UPDATE public."File" SET is_deleted = true, deleted_at = now(), updated_at = now() WHERE id = p_file_id;
  UPDATE public."FileQuota" SET storage_used = greatest(storage_used - v_file.file_size, 0),
    file_count = greatest(file_count - 1, 0), updated_at = now() WHERE user_id = p_user_id;
  RETURN jsonb_build_object('success', true, 'fileId', p_file_id, 'freedSpace', v_file.file_size);
END;
$$;
