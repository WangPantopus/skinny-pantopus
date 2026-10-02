-- Backwards compatible: yes. Retains existing File storage and quota contracts.
-- A forward migration is necessary: generic purge is applied history, and its
-- domain recovery RPCs do not serialize ordinary File/JSON reference binding.
-- No replacement table or applied migration is introduced.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- Ordinary ownership can be ambiguous, and deleting rows forgets pending bytes.
-- Keep compact managed tombstone identities, including old keyed send intents.
-- Home/completion workers retain their own existing selection/purge contracts.
CREATE OR REPLACE FUNCTION public.cleanup_old_deleted_files(days_old integer DEFAULT 30)
RETURNS TABLE(deleted_count integer, freed_space bigint)
LANGUAGE sql SET search_path=public,pg_temp AS $$ SELECT 0::integer,0::bigint; $$;

CREATE FUNCTION public.chat_file_has_live_reference(p_file_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE f public."File"%ROWTYPE; ref record; found_ref boolean;
BEGIN
 SELECT * INTO f FROM public."File" WHERE id=p_file_id;
 IF NOT FOUND THEN RETURN true; END IF;
 -- FileAccessLog is an audit record, not a live byte consumer. Thumbnails and
 -- all other File foreign keys remain protective, including future FK additions.
 FOR ref IN SELECT c.conrelid::regclass AS relation,a.attname AS col
  FROM pg_constraint c CROSS JOIN LATERAL unnest(c.conkey) k(attnum)
  JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum
  WHERE c.contype='f' AND c.confrelid='public."File"'::regclass
   AND c.conrelid<>'public."FileAccessLog"'::regclass
  ORDER BY c.conrelid,a.attname LOOP
  EXECUTE format('SELECT EXISTS(SELECT FROM %s WHERE %I=$1)',ref.relation,ref.col) INTO found_ref USING f.id;
  IF found_ref THEN RETURN true; END IF;
 END LOOP;
 -- Keep soft-deleted message references until the existing redaction policy
 -- actually removes them; both object ids and legacy string ids/URLs count.
 IF EXISTS(SELECT FROM public."ChatMessage" m CROSS JOIN LATERAL jsonb_array_elements(
   CASE WHEN jsonb_typeof(m.attachments)='array' THEN m.attachments ELSE '[]'::jsonb END) a
   WHERE lower(a->>'id')=f.id::text OR lower(a#>>'{}')=f.id::text
    OR a->>'file_url'=f.file_url OR a->>'url'=f.file_url OR a#>>'{}'=f.file_url)
  OR EXISTS(SELECT FROM public."User" u WHERE u.profile_picture_url=f.file_url OR u.cover_photo_url=f.file_url)
  OR EXISTS(SELECT FROM public."LocalProfile" l WHERE l.avatar_url=f.file_url)
 THEN RETURN true; END IF;
 RETURN false;
END $$;

CREATE FUNCTION public.chat_file_cleanup_candidates(p_bucket text,p_namespace text,p_limit integer DEFAULT 100)
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT f.id FROM public."File" f WHERE f.is_deleted=true AND f.deleted_at<clock_timestamp()-interval '30 days'
  AND f.file_type='chat_file' AND f.metadata->>'storage_contract'='chat_upload_s3_v1'
  AND f.metadata->>'storage_bucket'=p_bucket AND f.metadata->>'storage_namespace'=p_namespace
  AND f.updated_at<clock_timestamp()-(CASE WHEN f.metadata->>'storage_current_object_absent'='true' THEN interval '1 day' ELSE interval '10 minutes' END)
 ORDER BY f.updated_at,f.id LIMIT greatest(1,least(coalesce(p_limit,100),100));
$$;

CREATE FUNCTION public.claim_chat_file_cleanup(p_file_id uuid,p_bucket text,p_namespace text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE f public."File"%ROWTYPE;
BEGIN
 SELECT * INTO f FROM public."File" WHERE id=p_file_id FOR UPDATE;
 IF NOT FOUND OR f.is_deleted IS DISTINCT FROM true OR f.deleted_at IS NULL OR f.deleted_at>=clock_timestamp()-interval '30 days'
  OR f.file_type<>'chat_file' OR f.metadata->>'storage_contract' IS DISTINCT FROM 'chat_upload_s3_v1'
  OR f.metadata->>'storage_bucket' IS DISTINCT FROM p_bucket OR f.metadata->>'storage_namespace' IS DISTINCT FROM p_namespace
  OR f.metadata->>'storage_key' IS DISTINCT FROM f.file_path
  OR f.updated_at>=clock_timestamp()-interval '10 minutes'
  OR public.chat_file_has_live_reference(f.id) THEN RETURN NULL; END IF;
 UPDATE public."File" SET metadata=metadata||jsonb_build_object('storage_cleanup_fenced',true,
  'storage_cleanup_claim',gen_random_uuid()::text,'storage_cleanup_pending',true),updated_at=clock_timestamp()
 WHERE id=f.id RETURNING * INTO f;
 RETURN to_jsonb(f);
END $$;

CREATE FUNCTION public.finish_chat_file_cleanup(p_file_id uuid,p_claim text,p_current_absent boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE f public."File"%ROWTYPE;
BEGIN
 SELECT * INTO f FROM public."File" WHERE id=p_file_id FOR UPDATE;
 IF NOT FOUND OR f.metadata->>'storage_contract' IS DISTINCT FROM 'chat_upload_s3_v1'
  OR f.metadata->>'storage_cleanup_claim' IS DISTINCT FROM p_claim OR p_claim IS NULL
  OR f.is_deleted IS DISTINCT FROM true OR public.chat_file_has_live_reference(f.id) THEN RETURN false; END IF;
 UPDATE public."File" SET metadata=(metadata-'storage_cleanup_claim')||jsonb_build_object(
  'storage_cleanup_pending',NOT coalesce(p_current_absent,false),'storage_current_object_absent',coalesce(p_current_absent,false),
  'storage_version_history_verified',false),updated_at=clock_timestamp(),
  filename=CASE WHEN p_current_absent THEN 'deleted' ELSE filename END,
  original_filename=CASE WHEN p_current_absent THEN 'deleted' ELSE original_filename END,
  processing_error=CASE WHEN p_current_absent THEN NULL ELSE processing_error END
 WHERE id=f.id;
 RETURN true;
END $$;

CREATE FUNCTION public.invalidate_chat_file_cleanup(p_file_id uuid,p_key text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE public."File" SET metadata=(metadata-'storage_cleanup_claim')||jsonb_build_object(
   'storage_cleanup_pending',true,'storage_current_object_absent',false),updated_at=clock_timestamp()
 WHERE id=p_file_id AND is_deleted=true AND file_path=p_key
  AND metadata->>'storage_contract'='chat_upload_s3_v1';
 RETURN FOUND;
END $$;

-- New FK binds take File key-share locks in sorted UUID order. Existing binds
-- and private domain records are unchanged. Claim takes that same File lock
-- exclusively before checking references; no parent lock is taken by cleanup.
CREATE FUNCTION public.guard_claimed_chat_file_reference() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE ids uuid[]='{}'; col text; value text; file_id uuid; f public."File"%ROWTYPE;
BEGIN
 FOREACH col IN ARRAY TG_ARGV LOOP
  value=to_jsonb(NEW)->>col;
  IF value IS NOT NULL AND (TG_OP='INSERT' OR value IS DISTINCT FROM to_jsonb(OLD)->>col) THEN ids=array_append(ids,value::uuid); END IF;
 END LOOP;
 FOR file_id IN SELECT DISTINCT unnest(ids) ORDER BY 1 LOOP
  SELECT * INTO f FROM public."File" WHERE id=file_id FOR KEY SHARE;
  IF FOUND AND f.metadata->>'storage_contract'='chat_upload_s3_v1'
    AND f.metadata->>'storage_cleanup_fenced'='true' THEN
   RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='FILE_CLEANUP_REFERENCE_UNAVAILABLE';
  END IF;
 END LOOP;
 RETURN NEW;
END $$;

DO $$ DECLARE ref record;
BEGIN
 FOR ref IN SELECT c.conrelid::regclass relation,string_agg(DISTINCT quote_literal(a.attname),',' ORDER BY quote_literal(a.attname)) args
 FROM pg_constraint c CROSS JOIN LATERAL unnest(c.conkey) k(attnum)
 JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum
 WHERE c.contype='f' AND c.confrelid='public."File"'::regclass
  AND c.conrelid<>'public."FileAccessLog"'::regclass GROUP BY c.conrelid ORDER BY c.conrelid LOOP
  EXECUTE format('CREATE TRIGGER guard_claimed_chat_file_reference BEFORE INSERT OR UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION public.guard_claimed_chat_file_reference(%s)',ref.relation,ref.args);
 END LOOP;
END $$;

CREATE FUNCTION public.guard_chat_attachment_binding() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE file_id uuid; f public."File"%ROWTYPE; old_ids text[]='{}';
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.attachments IS NOT DISTINCT FROM OLD.attachments THEN RETURN NEW; END IF;
  SELECT coalesce(array_agg(lower(value)) FILTER(WHERE value IS NOT NULL),'{}') INTO old_ids FROM(
   SELECT coalesce(a->>'id',CASE WHEN jsonb_typeof(a)='string' THEN a#>>'{}' END) value
   FROM jsonb_array_elements(CASE WHEN jsonb_typeof(OLD.attachments)='array' THEN OLD.attachments ELSE '[]'::jsonb END) a) refs;
 END IF;
 FOR file_id IN SELECT DISTINCT value::uuid FROM(
   SELECT coalesce(a->>'id',CASE WHEN jsonb_typeof(a)='string' THEN a#>>'{}' END) value
   FROM jsonb_array_elements(CASE WHEN jsonb_typeof(NEW.attachments)='array' THEN NEW.attachments ELSE '[]'::jsonb END) a) refs
  WHERE value~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   AND NOT(lower(value)=ANY(old_ids)) ORDER BY 1 LOOP
  SELECT * INTO f FROM public."File" WHERE id=file_id FOR KEY SHARE;
  IF NOT FOUND OR (f.file_type='chat_file' AND (f.is_deleted OR f.metadata->>'storage_cleanup_fenced'='true')) THEN
   RAISE EXCEPTION USING ERRCODE='PT400',MESSAGE='CHAT_FILE_UNAVAILABLE';
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_chat_attachment_binding BEFORE INSERT OR UPDATE OF attachments ON public."ChatMessage"
 FOR EACH ROW EXECUTE FUNCTION public.guard_chat_attachment_binding();

CREATE FUNCTION public.guard_chat_file_cleanup_identity() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF OLD.metadata->>'storage_contract'='chat_upload_s3_v1' AND OLD.metadata->>'storage_cleanup_fenced'='true'
  AND (NEW.is_deleted IS DISTINCT FROM true OR NEW.id IS DISTINCT FROM OLD.id
   OR NEW.file_type IS DISTINCT FROM OLD.file_type OR NEW.file_url IS DISTINCT FROM OLD.file_url
   OR NEW.file_path IS DISTINCT FROM OLD.file_path
   OR NEW.metadata->>'storage_cleanup_fenced' IS DISTINCT FROM 'true'
   OR (NEW.metadata->>'storage_contract',NEW.metadata->>'storage_bucket',NEW.metadata->>'storage_namespace',NEW.metadata->>'storage_key',NEW.metadata->>'storage_sha256',NEW.metadata->>'room_id')
      IS DISTINCT FROM (OLD.metadata->>'storage_contract',OLD.metadata->>'storage_bucket',OLD.metadata->>'storage_namespace',OLD.metadata->>'storage_key',OLD.metadata->>'storage_sha256',OLD.metadata->>'room_id')) THEN
  RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Chat cleanup identity cannot be changed';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_chat_file_cleanup_identity BEFORE UPDATE ON public."File"
 FOR EACH ROW EXECUTE FUNCTION public.guard_chat_file_cleanup_identity();

DO $$ DECLARE f record;
BEGIN
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN('chat_file_has_live_reference','chat_file_cleanup_candidates','claim_chat_file_cleanup',
   'finish_chat_file_cleanup','invalidate_chat_file_cleanup','guard_claimed_chat_file_reference','guard_chat_attachment_binding','guard_chat_file_cleanup_identity') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
