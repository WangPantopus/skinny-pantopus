-- Backwards compatible: yes. Private task attachments use new service-only
-- transactions. Existing public references remain quarantined and unchanged.
SET LOCAL lock_timeout='5s';

CREATE TABLE public."HomeTaskMediaIntent" (
  id uuid PRIMARY KEY,
  original_home_id uuid NOT NULL,
  original_task_id uuid NOT NULL,
  uploaded_by uuid NOT NULL,
  private_setup boolean NOT NULL DEFAULT false,
  home_id uuid REFERENCES public."Home"(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public."HomeTask"(id) ON DELETE SET NULL,
  file_id uuid REFERENCES public."File"(id) ON DELETE SET NULL,
  storage_bucket text NOT NULL CHECK(storage_bucket ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
  sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),
  file_name text NOT NULL CHECK(length(file_name) BETWEEN 1 AND 255),
  mime_type text NOT NULL CHECK(mime_type IN ('application/pdf','text/plain','image/jpeg','image/png','image/webp','image/heic','image/heif')),
  file_size bigint NOT NULL CHECK(file_size BETWEEN 1 AND 26214400),
  state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','ready','retired')),
  upload_attempt uuid,
  cleanup_claim uuid,
  cleanup_pending boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  retired_at timestamptz,
  CHECK(home_id IS NULL OR home_id=original_home_id),
  CHECK(task_id IS NULL OR task_id=original_task_id),
  CHECK(file_id IS NULL OR file_id=id),
  CHECK(state='retired' OR (home_id IS NOT NULL AND task_id IS NOT NULL)),
  CONSTRAINT home_task_media_intent_exact_task_fk FOREIGN KEY(task_id,home_id)
    REFERENCES public."HomeTask"(id,home_id) ON DELETE SET NULL (task_id)
);
ALTER TABLE public."HomeTaskMediaIntent" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."HomeTaskMediaIntent" FROM PUBLIC,anon,authenticated;
GRANT ALL ON public."HomeTaskMediaIntent" TO service_role;
CREATE INDEX home_task_media_intent_task ON public."HomeTaskMediaIntent"(original_home_id,original_task_id,id);
CREATE INDEX home_task_media_cleanup_due ON public."HomeTaskMediaIntent"(updated_at,id) WHERE state<>'ready';
ALTER TABLE public."HomeTaskMedia" ADD COLUMN private_upload_id uuid UNIQUE REFERENCES public."HomeTaskMediaIntent"(id);

-- A restrictive policy composes with document/evidence policy additions, rather
-- than replacing their protections. The API projects metadata without paths.
CREATE POLICY file_task_media_api_only ON public."File" AS RESTRICTIVE FOR SELECT TO PUBLIC
  USING (coalesce(metadata->>'storage_contract','')<>'home_task_media_v1');

CREATE FUNCTION public.home_task_media_key(i public."HomeTaskMediaIntent") RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
  SELECT 'task-media/'||i.original_home_id::text||'/'||i.original_task_id::text||'/'||i.id::text||'/'||i.sha256;
$$;
CREATE FUNCTION public.home_task_media_projection(i public."HomeTaskMediaIntent") RETURNS jsonb
LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
  SELECT jsonb_build_object('id',i.id,'home_id',i.original_home_id,'task_id',i.original_task_id,
    'uploaded_by',i.uploaded_by,'file_name',i.file_name,'mime_type',i.mime_type,'file_size',i.file_size,
    'file_type',CASE WHEN i.mime_type LIKE 'image/%' THEN 'image' ELSE 'document' END,
    'created_at',i.created_at,'state',i.state,'available',i.state='ready','cleanup_pending',i.cleanup_pending);
$$;
CREATE FUNCTION public.home_task_media_storage(i public."HomeTaskMediaIntent") RETURNS jsonb
LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
  SELECT jsonb_build_object('upload_id',i.id,'home_id',i.original_home_id,'task_id',i.original_task_id,
    'bucket',i.storage_bucket,'sha256',i.sha256,'size',i.file_size,'mime_type',i.mime_type,
    'upload_attempt',i.upload_attempt,'cleanup_claim',i.cleanup_claim);
$$;

CREATE FUNCTION public.protect_home_task_media_intent() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    RAISE EXCEPTION 'Task upload tombstones must be retained' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND (ROW(NEW.id,NEW.original_home_id,NEW.original_task_id,NEW.uploaded_by,NEW.private_setup,
      NEW.storage_bucket,NEW.sha256,NEW.file_name,NEW.mime_type,NEW.file_size,NEW.created_at)
    IS DISTINCT FROM ROW(OLD.id,OLD.original_home_id,OLD.original_task_id,OLD.uploaded_by,OLD.private_setup,
      OLD.storage_bucket,OLD.sha256,OLD.file_name,OLD.mime_type,OLD.file_size,OLD.created_at)
    OR (OLD.state='retired' AND NEW.state<>'retired') OR (OLD.state='ready' AND NEW.state='reserved')
    OR (OLD.home_id IS NULL AND NEW.home_id IS NOT NULL) OR (OLD.task_id IS NULL AND NEW.task_id IS NOT NULL)) THEN
    RAISE EXCEPTION 'Task upload identity and retirement are immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_home_task_media_intent BEFORE UPDATE OR DELETE ON public."HomeTaskMediaIntent"
  FOR EACH ROW EXECUTE FUNCTION public.protect_home_task_media_intent();

CREATE FUNCTION public.protect_home_task_media_file() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE i public."HomeTaskMediaIntent"%ROWTYPE;
BEGIN
  IF TG_OP<>'INSERT' AND OLD.metadata->>'storage_contract'='home_task_media_v1' THEN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Task upload File tombstones must be retained' USING ERRCODE='23514'; END IF;
    IF NEW.metadata->>'storage_contract' IS DISTINCT FROM 'home_task_media_v1' THEN
      RAISE EXCEPTION 'Task upload storage identity is immutable' USING ERRCODE='23514'; END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF NEW.metadata->>'storage_contract' IS DISTINCT FROM 'home_task_media_v1' THEN RETURN NEW; END IF;
  SELECT * INTO i FROM public."HomeTaskMediaIntent" WHERE id=NEW.id FOR SHARE;
  IF NOT FOUND OR NEW.user_id IS DISTINCT FROM i.uploaded_by OR NEW.home_id IS DISTINCT FROM i.home_id
    OR NEW.file_path IS DISTINCT FROM public.home_task_media_key(i) OR NEW.file_url<>''
    OR NEW.original_filename IS DISTINCT FROM i.file_name OR NEW.filename IS DISTINCT FROM i.file_name
    OR NEW.file_size IS DISTINCT FROM i.file_size OR NEW.mime_type IS DISTINCT FROM i.mime_type
    OR NEW.file_type IS DISTINCT FROM 'other' OR NEW.visibility IS DISTINCT FROM 'private'
    OR NEW.metadata IS DISTINCT FROM jsonb_build_object('storage_contract','home_task_media_v1','upload_id',i.id)
    OR NEW.is_deleted IS DISTINCT FROM (i.state='retired') OR NEW.post_id IS NOT NULL OR NEW.gig_id IS NOT NULL
    OR NEW.comment_id IS NOT NULL OR NEW.profile_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid private task File binding' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_home_task_media_file BEFORE INSERT OR UPDATE OR DELETE ON public."File"
 FOR EACH ROW EXECUTE FUNCTION public.protect_home_task_media_file();

CREATE FUNCTION public.protect_home_task_media_record() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE i public."HomeTaskMediaIntent"%ROWTYPE;
BEGIN
  IF TG_OP='UPDATE' AND OLD.private_upload_id IS NOT NULL AND NEW.private_upload_id IS DISTINCT FROM OLD.private_upload_id THEN
    RAISE EXCEPTION 'Task media binding is immutable' USING ERRCODE='23514'; END IF;
  IF NEW.private_upload_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO i FROM public."HomeTaskMediaIntent" WHERE id=NEW.private_upload_id FOR SHARE;
  IF NOT FOUND OR i.state<>'ready' OR NEW.id<>i.id OR NEW.home_id<>i.original_home_id OR NEW.task_id<>i.original_task_id
    OR NEW.uploaded_by<>i.uploaded_by OR NEW.file_url<>'' OR NEW.file_key<>'' OR NEW.thumbnail_url IS NOT NULL
    OR NEW.file_name IS DISTINCT FROM i.file_name OR NEW.mime_type IS DISTINCT FROM i.mime_type
    OR NEW.file_size IS DISTINCT FROM i.file_size THEN
    RAISE EXCEPTION 'Invalid private task attachment binding' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_home_task_media_record BEFORE INSERT OR UPDATE ON public."HomeTaskMedia"
 FOR EACH ROW EXECUTE FUNCTION public.protect_home_task_media_record();

-- Lock Home/current authority, exact source Mail, then Task before intent/File.
-- The Home lock serializes ordinary attachment and task deletion transactions.
CREATE FUNCTION public.authorize_home_task_media(p_home_id uuid,p_task_id uuid,p_actor_id uuid,p_write boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE t public."HomeTask"%ROWTYPE; c jsonb; v_source uuid; v_write boolean;
BEGIN
  IF p_actor_id IS NULL OR p_write IS NULL THEN RETURN '{"ok":false,"code":"HOME_RECORD_INVALID","status":400}'::jsonb; END IF;
  IF NOT public.lock_home_record_scope(p_home_id) THEN RETURN '{"ok":false,"code":"HOME_NOT_FOUND","status":404}'::jsonb; END IF;
  SELECT source_mail_id INTO v_source FROM public."HomeTask" WHERE id=p_task_id AND home_id=p_home_id;
  PERFORM id FROM public."Mail" WHERE id=v_source FOR SHARE;
  SELECT * INTO t FROM public."HomeTask" WHERE id=p_task_id AND home_id=p_home_id FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"HOME_RECORD_NOT_FOUND","status":404}'::jsonb; END IF;
  IF public.home_task_readable(t,p_actor_id) IS DISTINCT FROM true THEN RETURN '{"ok":false,"code":"HOME_RECORD_DENIED","status":403}'::jsonb; END IF;
  c:=public.home_record_context(p_home_id,p_actor_id);
  v_write:=coalesce((c->'permissions' ? 'tasks.manage' OR (c->'permissions' ? 'tasks.edit' AND t.created_by=p_actor_id))
    AND (c->>'private'<>'true' OR t.created_by=p_actor_id),false);
  IF p_write AND NOT v_write THEN RETURN '{"ok":false,"code":"HOME_RECORD_WRITE_DENIED","status":403}'::jsonb; END IF;
  RETURN jsonb_build_object('ok',true,'home_id',p_home_id,'task_id',p_task_id,'can_upload',v_write,'private_setup',c->'private');
END $$;

CREATE FUNCTION public.mutate_home_task_media(p_home_id uuid,p_task_id uuid,p_actor_id uuid,p_action text,p_upload_id uuid,p_payload jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE a jsonb; i public."HomeTaskMediaIntent"%ROWTYPE; f public."File"%ROWTYPE;
BEGIN
  IF p_upload_id IS NULL OR p_action IS NULL OR p_action NOT IN ('reserve','begin_upload','finalize','retire')
    OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
    OR (p_action<>'reserve' AND p_payload<>'{}') THEN RETURN '{"ok":false,"code":"HOME_RECORD_INVALID","status":400}'::jsonb; END IF;
  a:=public.authorize_home_task_media(p_home_id,p_task_id,p_actor_id,true);
  IF a->>'ok' IS DISTINCT FROM 'true' THEN RETURN a; END IF;
  SELECT * INTO i FROM public."HomeTaskMediaIntent" WHERE id=p_upload_id FOR UPDATE;
  IF FOUND AND (i.original_home_id<>p_home_id OR i.original_task_id<>p_task_id
    OR (p_action<>'retire' AND i.uploaded_by<>p_actor_id)) THEN RETURN '{"ok":false,"code":"HOME_TASK_UPLOAD_CONFLICT","status":409}'::jsonb; END IF;
  -- The intent lock may have waited behind cleanup; re-evaluate dates after it.
  a:=public.authorize_home_task_media(p_home_id,p_task_id,p_actor_id,true);
  IF a->>'ok' IS DISTINCT FROM 'true' THEN RETURN a; END IF;
  IF p_action='reserve' THEN
    IF EXISTS(SELECT FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('bucket','sha256','file_name','mime_type','file_size'))
      OR coalesce(p_payload->>'bucket','') !~ '^[a-z0-9][a-z0-9-]{2,62}$'
      OR coalesce(p_payload->>'sha256','') !~ '^[0-9a-f]{64}$'
      OR length(coalesce(p_payload->>'file_name','')) NOT BETWEEN 1 AND 255
      OR coalesce(p_payload->>'mime_type','') NOT IN ('application/pdf','text/plain','image/jpeg','image/png','image/webp','image/heic','image/heif')
      OR coalesce(p_payload->>'file_size','') !~ '^[0-9]{1,8}$' THEN RETURN '{"ok":false,"code":"HOME_RECORD_INVALID","status":400}'::jsonb; END IF;
    IF (p_payload->>'file_size')::bigint NOT BETWEEN 1 AND 26214400 THEN RETURN '{"ok":false,"code":"HOME_RECORD_INVALID","status":400}'::jsonb; END IF;
    IF i.id IS NOT NULL AND (i.storage_bucket IS DISTINCT FROM p_payload->>'bucket' OR i.sha256 IS DISTINCT FROM p_payload->>'sha256'
      OR i.file_name IS DISTINCT FROM p_payload->>'file_name' OR i.mime_type IS DISTINCT FROM p_payload->>'mime_type'
      OR i.file_size IS DISTINCT FROM (p_payload->>'file_size')::bigint) THEN
      RETURN '{"ok":false,"code":"HOME_TASK_UPLOAD_CONFLICT","status":409}'::jsonb; END IF;
    IF i.id IS NULL THEN
      -- File reservation and upload intent either both commit or neither does.
      INSERT INTO public."HomeTaskMediaIntent"(id,original_home_id,original_task_id,uploaded_by,private_setup,home_id,task_id,
        storage_bucket,sha256,file_name,mime_type,file_size)
      VALUES(p_upload_id,p_home_id,p_task_id,p_actor_id,coalesce((a->>'private_setup')::boolean,false),p_home_id,p_task_id,p_payload->>'bucket',p_payload->>'sha256',
        p_payload->>'file_name',p_payload->>'mime_type',(p_payload->>'file_size')::bigint) RETURNING * INTO i;
      INSERT INTO public."File"(id,user_id,home_id,filename,original_filename,file_path,file_url,file_size,mime_type,file_extension,
        file_type,visibility,processing_status,metadata)
      VALUES(i.id,i.uploaded_by,i.home_id,i.file_name,i.file_name,public.home_task_media_key(i),'',i.file_size,i.mime_type,'',
        'other','private','uploading',jsonb_build_object('storage_contract','home_task_media_v1','upload_id',i.id));
      UPDATE public."HomeTaskMediaIntent" SET file_id=id WHERE id=i.id RETURNING * INTO i;
    END IF;
  ELSIF i.id IS NULL THEN RETURN '{"ok":false,"code":"HOME_TASK_MEDIA_NOT_FOUND","status":404}'::jsonb;
  END IF;
  IF p_action<>'retire' AND i.state='retired' THEN RETURN '{"ok":false,"code":"HOME_TASK_UPLOAD_RETIRED","status":409}'::jsonb; END IF;
  SELECT * INTO f FROM public."File" WHERE id=i.file_id FOR UPDATE;
  IF NOT FOUND OR f.metadata->>'storage_contract' IS DISTINCT FROM 'home_task_media_v1'
    OR f.is_deleted IS DISTINCT FROM (i.state='retired') THEN RETURN '{"ok":false,"code":"HOME_TASK_MEDIA_UNAVAILABLE","status":503}'::jsonb; END IF;
  IF p_action='begin_upload' AND i.state='reserved' THEN
    UPDATE public."HomeTaskMediaIntent" SET upload_attempt=gen_random_uuid(),updated_at=clock_timestamp()
      WHERE id=i.id RETURNING * INTO i;
  ELSIF p_action='finalize' AND i.state='reserved' THEN
    IF i.upload_attempt IS NULL THEN RETURN '{"ok":false,"code":"HOME_TASK_UPLOAD_CONFLICT","status":409}'::jsonb; END IF;
    UPDATE public."HomeTaskMediaIntent" SET state='ready',updated_at=clock_timestamp() WHERE id=i.id RETURNING * INTO i;
    UPDATE public."File" SET processing_status='completed',updated_at=clock_timestamp() WHERE id=i.file_id;
    INSERT INTO public."HomeTaskMedia"(id,private_upload_id,home_id,task_id,uploaded_by,file_url,file_key,file_name,file_type,mime_type,file_size)
      VALUES(i.id,i.id,i.original_home_id,i.original_task_id,i.uploaded_by,'','',i.file_name,
        CASE WHEN i.mime_type LIKE 'image/%' THEN 'image' ELSE 'document' END,i.mime_type,i.file_size);
  ELSIF p_action='retire' AND i.state<>'retired' THEN
    UPDATE public."HomeTaskMediaIntent" SET state='retired',retired_at=clock_timestamp(),updated_at=clock_timestamp(),
      cleanup_pending=true,cleanup_claim=gen_random_uuid() WHERE id=i.id RETURNING * INTO i;
    DELETE FROM public."HomeTaskMedia" WHERE private_upload_id=i.id AND id=i.id;
    UPDATE public."File" SET is_deleted=true,deleted_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=i.file_id;
    UPDATE public."FileQuota" SET storage_used=greatest(storage_used-i.file_size,0),file_count=greatest(file_count-1,0),updated_at=clock_timestamp()
      WHERE user_id=i.uploaded_by;
  ELSIF p_action='retire' THEN
    UPDATE public."HomeTaskMediaIntent" SET cleanup_pending=true,cleanup_claim=gen_random_uuid(),updated_at=clock_timestamp()
      WHERE id=i.id RETURNING * INTO i;
  END IF;
  -- Quota/File locks can outlast the actor's access window. A caught exception
  -- rolls back this entire function's subtransaction, including the reservation.
  a:=public.authorize_home_task_media(p_home_id,p_task_id,p_actor_id,true);
  IF a->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Current task access expired' USING ERRCODE='PT403'; END IF;
  RETURN jsonb_build_object('ok',true,'record',public.home_task_media_projection(i),'storage',public.home_task_media_storage(i));
EXCEPTION WHEN SQLSTATE 'PT403' THEN
  RETURN '{"ok":false,"code":"HOME_RECORD_WRITE_DENIED","status":403}'::jsonb;
END $$;

CREATE FUNCTION public.get_home_task_media(p_home_id uuid,p_task_id uuid,p_actor_id uuid,p_upload_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE a jsonb; i public."HomeTaskMediaIntent"%ROWTYPE; v_records jsonb:='[]'::jsonb; v_row jsonb; v_storage jsonb;
BEGIN
  a:=public.authorize_home_task_media(p_home_id,p_task_id,p_actor_id,false);
  IF a->>'ok' IS DISTINCT FROM 'true' THEN RETURN a; END IF;
  PERFORM id FROM public."HomeTaskMediaIntent" WHERE original_home_id=p_home_id AND original_task_id=p_task_id
    AND (p_upload_id IS NULL OR id=p_upload_id) ORDER BY id FOR SHARE;
  a:=public.authorize_home_task_media(p_home_id,p_task_id,p_actor_id,false);
  IF a->>'ok' IS DISTINCT FROM 'true' THEN RETURN a; END IF;
  FOR i IN SELECT * FROM public."HomeTaskMediaIntent" WHERE home_id=p_home_id AND task_id=p_task_id
    AND (p_upload_id IS NULL OR id=p_upload_id) AND (state='ready' OR (uploaded_by=p_actor_id AND a->>'can_upload'='true'))
    ORDER BY created_at,id LOOP
    v_row:=public.home_task_media_projection(i);
    v_records:=v_records||jsonb_build_array(v_row);
    IF p_upload_id IS NOT NULL AND i.state='ready' AND EXISTS(SELECT FROM public."HomeTaskMedia" m WHERE m.id=i.id AND m.private_upload_id=i.id)
      THEN v_storage:=public.home_task_media_storage(i); END IF;
  END LOOP;
  IF p_upload_id IS NOT NULL AND v_storage IS NULL THEN RETURN '{"ok":false,"code":"HOME_TASK_MEDIA_NOT_FOUND","status":404}'::jsonb; END IF;
  IF p_upload_id IS NULL THEN
    SELECT v_records||coalesce(jsonb_agg(jsonb_build_object('id',id,'home_id',home_id,'task_id',task_id,'uploaded_by',uploaded_by,
      'file_name',coalesce(file_name,'Attachment'),'file_type',file_type,'mime_type',mime_type,'file_size',coalesce(file_size,0),'created_at',created_at,
      'state','legacy','available',false,'availability_code','HOME_TASK_MEDIA_REUPLOAD_REQUIRED') ORDER BY created_at,id),'[]')
    INTO v_records FROM public."HomeTaskMedia" WHERE home_id=p_home_id AND task_id=p_task_id AND private_upload_id IS NULL;
  END IF;
  RETURN jsonb_build_object('ok',true,'home_id',p_home_id,'task_id',p_task_id,'records',v_records,
    'can_upload',a->'can_upload','storage',v_storage);
END $$;

-- Recovery owns no read grant. It may only retire abandoned reservations or
-- re-remove exact retained tombstones, including late writes after deletion.
CREATE FUNCTION public.claim_home_task_media_cleanup(p_upload_id uuid,p_bucket text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE i public."HomeTaskMediaIntent"%ROWTYPE; v_home uuid;
BEGIN
  SELECT home_id INTO v_home FROM public."HomeTaskMediaIntent" WHERE id=p_upload_id;
  IF v_home IS NOT NULL THEN PERFORM public.lock_home_record_scope(v_home); END IF;
  SELECT * INTO i FROM public."HomeTaskMediaIntent" WHERE id=p_upload_id FOR UPDATE;
  IF NOT FOUND OR i.storage_bucket IS DISTINCT FROM p_bucket OR i.state='ready'
    OR (i.state='reserved' AND (i.created_at>clock_timestamp()-interval '1 day' OR i.updated_at>clock_timestamp()-interval '10 minutes'))
    OR (i.state='retired' AND i.updated_at>clock_timestamp()-CASE WHEN i.cleanup_pending THEN interval '10 minutes' ELSE interval '1 day' END)
    THEN RETURN NULL; END IF;
  IF i.state='reserved' THEN
    UPDATE public."HomeTaskMediaIntent" SET state='retired',retired_at=clock_timestamp() WHERE id=i.id;
    UPDATE public."File" SET is_deleted=true,deleted_at=clock_timestamp(),processing_status='failed',updated_at=clock_timestamp()
      WHERE id=i.file_id AND is_deleted=false;
    IF FOUND THEN UPDATE public."FileQuota" SET storage_used=greatest(storage_used-i.file_size,0),file_count=greatest(file_count-1,0),
      updated_at=clock_timestamp() WHERE user_id=i.uploaded_by; END IF;
  END IF;
  UPDATE public."HomeTaskMediaIntent" SET cleanup_pending=true,cleanup_claim=gen_random_uuid(),updated_at=clock_timestamp()
    WHERE id=i.id RETURNING * INTO i;
  RETURN public.home_task_media_storage(i);
END $$;
CREATE FUNCTION public.home_task_media_cleanup_candidates(p_bucket text,p_limit integer DEFAULT 100)
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT id FROM public."HomeTaskMediaIntent" WHERE storage_bucket=p_bucket AND state<>'ready'
    AND ((state='reserved' AND created_at<clock_timestamp()-interval '1 day' AND updated_at<clock_timestamp()-interval '10 minutes')
      OR (state='retired' AND updated_at<clock_timestamp()-CASE WHEN cleanup_pending THEN interval '10 minutes' ELSE interval '1 day' END))
  ORDER BY updated_at,id LIMIT greatest(1,least(coalesce(p_limit,100),100));
$$;
CREATE FUNCTION public.finish_home_task_media_cleanup(p_upload_id uuid,p_claim uuid,p_succeeded boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  UPDATE public."HomeTaskMediaIntent" SET cleanup_pending=NOT coalesce(p_succeeded,false),cleanup_claim=NULL,updated_at=clock_timestamp()
    WHERE id=p_upload_id AND state='retired' AND cleanup_claim=p_claim;
  RETURN FOUND;
END $$;
CREATE FUNCTION public.note_home_task_media_upload_finished(p_upload_id uuid,p_attempt uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
  UPDATE public."HomeTaskMediaIntent" SET cleanup_pending=true,cleanup_claim=NULL,updated_at=clock_timestamp()
    WHERE id=p_upload_id AND state='retired' AND upload_attempt=p_attempt;
$$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('home_task_media_key','home_task_media_projection','home_task_media_storage',
      'protect_home_task_media_intent','protect_home_task_media_file','protect_home_task_media_record','authorize_home_task_media',
      'mutate_home_task_media','get_home_task_media','claim_home_task_media_cleanup','home_task_media_cleanup_candidates',
      'finish_home_task_media_cleanup','note_home_task_media_upload_finished') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
  END LOOP;
END $$;

-- Retain all protected private storage contracts; this grants no evidence access.
CREATE OR REPLACE FUNCTION public.cleanup_old_deleted_files(days_old integer DEFAULT 30)
RETURNS TABLE(deleted_count integer, freed_space bigint)
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_deleted_count integer; v_freed_space bigint;
BEGIN
  WITH removed AS (
    DELETE FROM public."File" WHERE is_deleted = true
      AND deleted_at < now() - interval '1 day' * days_old
      AND coalesce(metadata->>'storage_contract', '') NOT IN ('home_document_v1','home_task_media_v1','home_claim_evidence_v1')
    RETURNING file_size
  ) SELECT count(*)::integer, coalesce(sum(file_size), 0) INTO v_deleted_count, v_freed_space FROM removed;
  RETURN QUERY SELECT v_deleted_count, v_freed_space;
END;
$$;

-- Retain all protected private storage contracts; this grants no evidence access.
CREATE OR REPLACE FUNCTION public.soft_delete_file(p_file_id uuid, p_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_file public."File"%ROWTYPE;
BEGIN
  SELECT * INTO v_file FROM public."File"
  WHERE id = p_file_id AND user_id = p_user_id AND is_deleted = false FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'File not found or already deleted');
  END IF;
  IF v_file.metadata->>'storage_contract' IN ('home_document_v1','home_task_media_v1','home_claim_evidence_v1') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  UPDATE public."File" SET is_deleted = true, deleted_at = now(), updated_at = now() WHERE id = p_file_id;
  UPDATE public."FileQuota" SET storage_used = greatest(storage_used - v_file.file_size, 0),
    file_count = greatest(file_count - 1, 0), updated_at = now() WHERE user_id = p_user_id;
  RETURN jsonb_build_object('success', true, 'fileId', p_file_id, 'freedSpace', v_file.file_size);
END;
$$;

CREATE FUNCTION public.retire_home_task_media_for_delete(p_home_id uuid,p_task_id uuid,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE a jsonb; i uuid; r jsonb; v_cleanup jsonb:='[]'::jsonb;
BEGIN
  a:=public.authorize_home_task_media(p_home_id,p_task_id,p_actor_id,true);
  IF a->>'ok' IS DISTINCT FROM 'true' THEN RETURN a; END IF;
  IF EXISTS(SELECT FROM public."HomeTaskMedia" WHERE home_id=p_home_id AND task_id=p_task_id AND private_upload_id IS NULL) THEN
    RETURN '{"ok":false,"code":"HOME_TASK_MEDIA_LEGACY_CLEANUP_REQUIRED","status":409}'::jsonb; END IF;
  FOR i IN SELECT id FROM public."HomeTaskMediaIntent" WHERE home_id=p_home_id AND task_id=p_task_id
    AND (state<>'retired' OR cleanup_pending) ORDER BY id LOOP
    r:=public.mutate_home_task_media(p_home_id,p_task_id,p_actor_id,'retire',i);
    IF r->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Attachment retirement denied' USING ERRCODE='PT403'; END IF;
    v_cleanup:=v_cleanup||jsonb_build_array(r->'storage');
  END LOOP;
  RETURN jsonb_build_object('ok',true,'home_id',p_home_id,'task_id',p_task_id,'cleanup',v_cleanup);
EXCEPTION WHEN SQLSTATE 'PT403' THEN RETURN r;
END $$;
CREATE FUNCTION public.delete_home_task_after_media(p_home_id uuid,p_task_id uuid,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE a jsonb;
BEGIN
  a:=public.authorize_home_task_media(p_home_id,p_task_id,p_actor_id,true);
  IF a->>'ok' IS DISTINCT FROM 'true' THEN RETURN a; END IF;
  IF EXISTS(SELECT FROM public."HomeTaskMediaIntent" WHERE home_id=p_home_id AND task_id=p_task_id AND (state<>'retired' OR cleanup_pending))
    OR EXISTS(SELECT FROM public."HomeTaskMedia" WHERE home_id=p_home_id AND task_id=p_task_id) THEN
    RETURN '{"ok":false,"code":"HOME_TASK_MEDIA_CLEANUP_REQUIRED","status":409}'::jsonb; END IF;
  RETURN public.mutate_home_record(p_home_id,p_actor_id,'task','delete',p_task_id);
END $$;
REVOKE ALL ON FUNCTION public.retire_home_task_media_for_delete(uuid,uuid,uuid),public.delete_home_task_after_media(uuid,uuid,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.retire_home_task_media_for_delete(uuid,uuid,uuid),public.delete_home_task_after_media(uuid,uuid,uuid) TO service_role;


-- Protected reservation provenance survives a private task's deletion. It never
-- turns formerly shared history or a changed live task into private setup.
CREATE FUNCTION public.home_task_media_own_setup(i public."HomeTaskMediaIntent",p_actor_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT coalesce(i.private_setup AND i.uploaded_by=p_actor_id AND (
    EXISTS(SELECT FROM public."HomeTask" t WHERE t.id=i.original_task_id AND t.home_id=i.original_home_id
      AND i.task_id=t.id AND public.home_task_private_setup(t,p_actor_id))
    OR (i.state='retired' AND i.task_id IS NULL AND NOT EXISTS(SELECT FROM public."HomeTask" t WHERE t.id=i.original_task_id))),false);
$$;
REVOKE ALL ON FUNCTION public.home_task_media_own_setup(public."HomeTaskMediaIntent",uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.home_task_media_own_setup(public."HomeTaskMediaIntent",uuid) TO service_role;

-- Forward context keeps all private evidence and protected withdrawal predicates.
CREATE OR REPLACE FUNCTION public.home_secret_context(p_home_id uuid,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_home public."Home"%ROWTYPE; v_occ public."HomeOccupancy"%ROWTYPE;
  v_access jsonb; v_role public.home_role_base; v_now timestamptz:=clock_timestamp();
  v_permissions text[]; v_denied constant jsonb:='{"allowed":false,"private":false,"permissions":[]}'::jsonb;
BEGIN
  IF p_actor_id IS NULL THEN RETURN v_denied; END IF;
  SELECT * INTO v_home FROM public."Home" WHERE id=p_home_id;
  IF NOT FOUND OR v_home.security_state IN ('frozen','frozen_silent') THEN RETURN v_denied; END IF;
  SELECT * INTO v_occ FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_actor_id;
  IF v_occ.id IS NOT NULL AND (v_occ.is_active IS DISTINCT FROM true OR v_occ.age_band IN ('child','teen')
    OR v_occ.start_at>v_now OR v_occ.end_at<=v_now OR v_occ.access_start_at>v_now OR v_occ.access_end_at<=v_now) THEN
    RETURN v_denied;
  END IF;
  v_access:=public.home_effective_access(p_home_id,p_actor_id);
  IF v_access->>'is_owner'='true' AND EXISTS (SELECT FROM public."HomeOwner" o WHERE o.home_id=p_home_id
    AND o.subject_type='user' AND o.subject_id=p_actor_id AND o.owner_status IN ('revoked','disputed'))
    AND NOT EXISTS (SELECT FROM public."HomeOwner" o WHERE o.home_id=p_home_id AND o.subject_type='user'
      AND o.subject_id=p_actor_id AND o.owner_status='verified') THEN RETURN v_denied; END IF;
  IF v_access->>'has_access'='true' THEN
    RETURN jsonb_build_object('allowed',true,'private',false,'permissions',v_access->'permissions',
      'role',v_access->>'effective_role_base');
  END IF;
  v_role:=coalesce(v_occ.role_base,CASE v_occ.role
    WHEN 'owner' THEN 'owner' WHEN 'admin' THEN 'admin' WHEN 'manager' THEN 'manager'
    WHEN 'property_manager' THEN 'manager' WHEN 'tenant' THEN 'lease_resident'
    WHEN 'renter' THEN 'lease_resident' WHEN 'lease_resident' THEN 'lease_resident'
    WHEN 'member' THEN 'member' WHEN 'roommate' THEN 'member' WHEN 'family' THEN 'member'
    WHEN 'restricted_member' THEN 'restricted_member' WHEN 'caregiver' THEN 'restricted_member'
    WHEN 'guest' THEN 'guest' WHEN 'service_provider' THEN 'service_provider' ELSE NULL END::public.home_role_base);
  IF v_home.created_by_user_id IS DISTINCT FROM p_actor_id
    OR (v_home.owner_id IS NOT NULL AND v_home.owner_id<>p_actor_id)
    OR v_occ.id IS NULL OR v_role IS NULL OR v_occ.verified_at IS NOT NULL
    OR v_occ.verification_status IS NULL OR v_occ.verification_status NOT IN ('pending_doc','provisional_bootstrap')
    OR EXISTS (SELECT FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id<>p_actor_id)
    OR EXISTS (SELECT FROM public."HomeOwner" WHERE home_id=p_home_id
      AND (subject_type<>'user' OR subject_id<>p_actor_id OR owner_status<>'pending')) THEN RETURN v_denied; END IF;
  -- Explicit private setup allowlist, separate from destructive deletion.
    IF EXISTS (SELECT FROM public."HomeOwnershipClaim" c WHERE home_id = p_home_id
        AND (claimant_user_id <> p_actor_id OR (state NOT IN ('draft','submitted')
          AND NOT public.home_claim_own_private_withdrawal(c,p_actor_id)) OR reviewed_by IS NOT NULL
          OR reviewed_at IS NOT NULL OR merged_into_claim_id IS NOT NULL))
      OR EXISTS (SELECT FROM public."HomeOwnershipClaim" foreign_claim JOIN public."HomeOwnershipClaim" own_claim
        ON foreign_claim.merged_into_claim_id = own_claim.id WHERE own_claim.home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeClaimReviewReceipt" receipt WHERE receipt.home_id=p_home_id
        AND NOT (receipt.actor_user_id=p_actor_id AND receipt.action='withdraw' AND receipt.private_setup
          AND NOT receipt.platform_admin AND EXISTS(SELECT FROM public."HomeOwnershipClaim" c
            WHERE c.id=receipt.claim_id AND c.home_id=p_home_id
              AND public.home_claim_own_private_withdrawal(c,p_actor_id))))
      OR EXISTS (SELECT FROM public."HomeAuditLog" a WHERE a.home_id = p_home_id AND (
        a.actor_user_id IS DISTINCT FROM p_actor_id OR NOT coalesce(
          (a.action = 'OCCUPANCY_TEMPLATE_APPLIED' AND a.target_type = 'HomeOccupancy'
            AND a.target_id = v_occ.id
            AND a.metadata->>'verification_status' IN ('provisional_bootstrap','pending_doc'))
          OR public.home_secret_own_setup_audit(a,p_actor_id)
          OR public.home_record_own_setup_audit(a,p_actor_id)
          OR (a.action='OWNERSHIP_CLAIM_WITHDRAWN' AND a.target_type='HomeOwnershipClaim'
            AND EXISTS(SELECT FROM public."HomeOwnershipClaim" c WHERE c.id=a.target_id
              AND c.home_id=p_home_id AND public.home_claim_own_private_withdrawal(c,p_actor_id)))
          OR (a.action = 'OWNERSHIP_CLAIM_SUBMITTED' AND a.target_type = 'HomeOwnershipClaim'
            AND EXISTS (SELECT FROM public."HomeOwnershipClaim" c WHERE c.id = a.target_id
              AND c.home_id = p_home_id AND c.claimant_user_id = p_actor_id)),false)))
      OR EXISTS (SELECT FROM public."HomeAccessSecret" WHERE home_id = p_home_id AND created_by IS DISTINCT FROM p_actor_id)
      OR EXISTS (SELECT FROM public."HomePermissionOverride" WHERE home_id = p_home_id
        AND (user_id <> p_actor_id OR created_by IS DISTINCT FROM p_actor_id))
      OR EXISTS (SELECT FROM public."UnlistedRemoval" WHERE home_id = p_home_id AND user_id <> p_actor_id)
      OR EXISTS (SELECT FROM public."AddressCalendarRule" WHERE scope_type = 'home'
        AND public.home_calendar_scope_id(scope_key) = p_home_id AND created_by IS DISTINCT FROM p_actor_id)
      OR EXISTS (SELECT FROM public."HomeDocument" WHERE home_id=p_home_id)
      OR EXISTS (SELECT FROM public."CommunityMailItem" WHERE home_id=p_home_id)
      OR EXISTS (SELECT FROM public."HomeMapPin" WHERE home_id=p_home_id)
      OR EXISTS (SELECT FROM public."VacationHold" WHERE home_id=p_home_id)
      OR EXISTS (SELECT FROM public."MailDeliveryIntent" WHERE intended_home_id=p_home_id)
      OR EXISTS (SELECT FROM public."NeighborEndorsement" WHERE endorser_home_id=p_home_id)
      -- Own pending verification evidence does not confer shared-document access
      -- and does not make the creator lose access to their own Wi-Fi setup.
      OR EXISTS(SELECT FROM public."HomeClaimEvidenceIntent" i WHERE i.original_home_id=p_home_id
        AND NOT public.home_claim_evidence_own_setup(i,p_actor_id))
      OR EXISTS (SELECT FROM public."File" f WHERE f.home_id=p_home_id AND (
        f.user_id<>p_actor_id OR (NOT EXISTS (SELECT FROM public."HomeVerificationEvidence" e
          JOIN public."HomeOwnershipClaim" c ON c.id=e.claim_id WHERE c.home_id=p_home_id
            AND c.claimant_user_id=p_actor_id AND (c.state IN ('draft','submitted')
              OR public.home_claim_own_private_withdrawal(c,p_actor_id))
            AND c.reviewed_by IS NULL AND c.reviewed_at IS NULL AND e.storage_ref=f.file_path)
          AND NOT EXISTS(SELECT FROM public."HomeClaimEvidenceIntent" i WHERE i.id=f.id AND i.home_id=p_home_id
            AND f.metadata=jsonb_build_object('storage_contract','home_claim_evidence_v1','upload_id',i.id)
            AND public.home_claim_evidence_own_setup(i,p_actor_id))
          AND NOT EXISTS(SELECT FROM public."HomeTaskMediaIntent" i WHERE i.id=f.id AND i.home_id=p_home_id
            AND f.metadata=jsonb_build_object('storage_contract','home_task_media_v1','upload_id',i.id)
            AND public.home_task_media_own_setup(i,p_actor_id)))))
      OR EXISTS (SELECT FROM public."HomeVerificationEvidence" e JOIN public."HomeOwnershipClaim" c ON c.id=e.claim_id
        JOIN public."File" f ON f.file_path=e.storage_ref WHERE c.home_id=p_home_id
          AND (f.user_id<>p_actor_id OR (f.home_id IS NOT NULL AND f.home_id<>p_home_id)))
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
        AND (NOT public.home_event_private_setup(e,p_actor_id)
          OR EXISTS (SELECT FROM public."HomeCalendarEventAttendee" a WHERE a.event_id=e.id AND a.user_id<>p_actor_id)))
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
      OR EXISTS (SELECT FROM public."HomeSeasonalChecklistItem" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeSubscription" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeSystem" WHERE home_id = p_home_id)
      OR EXISTS(SELECT FROM public."HomeTaskMediaIntent" i WHERE i.original_home_id=p_home_id
        AND NOT public.home_task_media_own_setup(i,p_actor_id))
      OR EXISTS (SELECT FROM public."HomeTaskMedia" m WHERE (home_id = p_home_id
        OR EXISTS(SELECT FROM public."HomeTask" t WHERE t.id=m.task_id AND t.home_id=p_home_id))
        AND NOT EXISTS(SELECT FROM public."HomeTaskMediaIntent" i WHERE i.id=m.private_upload_id AND i.id=m.id
          AND i.home_id=p_home_id AND i.task_id=m.task_id AND public.home_task_media_own_setup(i,p_actor_id)))
      OR EXISTS (SELECT FROM public."HomeTask" t WHERE home_id = p_home_id
        AND NOT public.home_task_private_setup(t,p_actor_id))
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
      RETURN v_denied;
    END IF;
  SELECT coalesce(array_agg(p::text),'{}'::text[]) INTO v_permissions
    FROM unnest(ARRAY['access.view_wifi','access.view_codes','access.manage']::public.home_permission[]) p
    WHERE NOT EXISTS (SELECT FROM public."HomePermissionOverride" o WHERE o.home_id=p_home_id
      AND o.user_id=p_actor_id AND o.permission=p AND NOT o.allowed)
    AND NOT EXISTS (SELECT FROM public."HomeRolePermission" r WHERE r.role_base=v_role AND r.permission=p AND NOT r.allowed
      AND NOT EXISTS (SELECT FROM public."HomePermissionOverride" o WHERE o.home_id=p_home_id
        AND o.user_id=p_actor_id AND o.permission=p AND o.allowed));
  RETURN jsonb_build_object('allowed',true,'private',true,'permissions',v_permissions,'role',v_role);
END;
$$;

-- Existing dashboard/AI/task DTOs now expose only the same safe private metadata.
CREATE OR REPLACE FUNCTION public.get_home_records(p_home_id uuid,p_actor_id uuid,p_kind text,
  p_record_id uuid DEFAULT NULL,p_start_after timestamptz DEFAULT NULL,p_start_before timestamptz DEFAULT NULL,
  p_mail_only boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE c jsonb; t public."HomeTask"%ROWTYPE; e public."HomeCalendarEvent"%ROWTYPE;
  b public."Booking"%ROWTYPE; v_records jsonb:='[]'::jsonb; v_row jsonb; v_media jsonb; v_attendees jsonb:='[]'::jsonb;
  v_source uuid; v_title text; v_edit boolean; v_manage boolean;
BEGIN
  IF p_kind IS NULL OR p_kind NOT IN ('task','event') OR p_actor_id IS NULL
    OR NOT isfinite(p_start_after) OR NOT isfinite(p_start_before)
    OR p_start_after>p_start_before THEN RETURN '{"ok":false,"code":"HOME_RECORD_INVALID","status":400}'::jsonb; END IF;
  IF NOT public.lock_home_record_scope(p_home_id) THEN RETURN '{"ok":false,"code":"HOME_NOT_FOUND","status":404}'::jsonb; END IF;
  -- Lock original sources before tasks, matching Mail's SET NULL FK order.
  IF p_kind='task' THEN
    FOR v_source IN SELECT DISTINCT source_mail_id FROM public."HomeTask" WHERE home_id=p_home_id
      AND (p_record_id IS NULL OR id=p_record_id) AND source_mail_id IS NOT NULL ORDER BY source_mail_id LOOP
      PERFORM id FROM public."Mail" WHERE id=v_source FOR SHARE;
    END LOOP;
    PERFORM id FROM public."HomeTask" WHERE home_id=p_home_id AND (p_record_id IS NULL OR id=p_record_id) ORDER BY id FOR SHARE;
    PERFORM m.id FROM public."HomeTaskMedia" m JOIN public."HomeTask" r ON r.id=m.task_id AND r.home_id=m.home_id
      WHERE r.home_id=p_home_id AND (p_record_id IS NULL OR r.id=p_record_id) ORDER BY m.id FOR SHARE OF m;
  ELSE
    PERFORM id FROM public."HomeCalendarEvent" WHERE home_id=p_home_id AND (p_record_id IS NULL OR id=p_record_id) ORDER BY id FOR SHARE;
    PERFORM a.id FROM public."HomeCalendarEventAttendee" a JOIN public."HomeCalendarEvent" r ON r.id=a.event_id
      WHERE r.home_id=p_home_id AND (p_record_id IS NULL OR r.id=p_record_id) ORDER BY a.id FOR SHARE OF a;
    IF p_record_id IS NULL THEN
      PERFORM id FROM public."Booking" WHERE home_id=p_home_id AND owner_type='home' AND owner_id=p_home_id ORDER BY id FOR SHARE;
      PERFORM id FROM public."EventType" WHERE home_id=p_home_id AND owner_type='home' AND owner_id=p_home_id ORDER BY id FOR SHARE;
    END IF;
  END IF;
  c:=public.home_record_context(p_home_id,p_actor_id);
  IF c->>'allowed' IS DISTINCT FROM 'true' OR NOT c->'permissions' ? (CASE p_kind WHEN 'task' THEN 'tasks.view' ELSE 'calendar.view' END) THEN
    RETURN '{"ok":false,"code":"HOME_RECORD_DENIED","status":403}'::jsonb; END IF;
  v_edit:=c->'permissions' ? (CASE p_kind WHEN 'task' THEN 'tasks.edit' ELSE 'calendar.edit' END);
  v_manage:=c->'permissions' ? (CASE p_kind WHEN 'task' THEN 'tasks.manage' ELSE 'calendar.manage' END);
  IF p_kind='task' THEN
    FOR t IN SELECT * FROM public."HomeTask" WHERE home_id=p_home_id AND (p_record_id IS NULL OR id=p_record_id)
      AND (NOT p_mail_only OR source_mail_id IS NOT NULL) ORDER BY created_at DESC,id LOOP
      IF NOT public.home_task_readable(t,p_actor_id) THEN CONTINUE; END IF;
      SELECT coalesce(jsonb_agg(CASE WHEN i.id IS NOT NULL AND i.state='ready' THEN public.home_task_media_projection(i)
        ELSE jsonb_build_object('id',m.id,'home_id',m.home_id,'task_id',m.task_id,'uploaded_by',m.uploaded_by,
          'file_name',coalesce(m.file_name,'Attachment'),'file_type',m.file_type,'mime_type',m.mime_type,
          'file_size',coalesce(m.file_size,0),'created_at',m.created_at,'state','legacy',
          'available',false,'availability_code','HOME_TASK_MEDIA_REUPLOAD_REQUIRED') END ORDER BY m.created_at,m.id),'[]')
        INTO v_media FROM public."HomeTaskMedia" m LEFT JOIN public."HomeTaskMediaIntent" i ON i.id=m.private_upload_id
          AND i.home_id=m.home_id AND i.task_id=m.task_id WHERE m.home_id=p_home_id AND m.task_id=t.id;
      v_row:=to_jsonb(t)||jsonb_build_object('media',v_media,'capabilities',jsonb_build_object(
        'can_edit',v_manage OR (v_edit AND t.created_by=p_actor_id),
        'can_complete',v_manage OR (v_edit AND (t.created_by=p_actor_id OR t.assigned_to IS NOT DISTINCT FROM p_actor_id)),
        'can_delete',(v_manage OR (v_edit AND t.created_by=p_actor_id))
          AND NOT EXISTS(SELECT FROM public."HomeTaskMedia" WHERE task_id=t.id AND private_upload_id IS NULL),
        'can_upload',v_manage OR (v_edit AND t.created_by=p_actor_id)));
      IF p_mail_only THEN
        SELECT v_row||jsonb_build_object('mail_preview',subject,'mail_sender',coalesce(sender_display,sender_business_name)) INTO v_row
          FROM public."Mail" WHERE id=t.source_mail_id;
      END IF;
      v_records:=v_records||jsonb_build_array(v_row);
    END LOOP;
  ELSE
    FOR e IN SELECT * FROM public."HomeCalendarEvent" WHERE home_id=p_home_id AND (p_record_id IS NULL OR id=p_record_id)
      AND (p_start_after IS NULL OR start_at>=p_start_after) AND (p_start_before IS NULL OR start_at<=p_start_before)
      ORDER BY start_at,id LOOP
      IF NOT public.home_record_visible(c,'event',e.created_by,e.visibility) THEN CONTINUE; END IF;
      v_records:=v_records||jsonb_build_array(to_jsonb(e)||jsonb_build_object('capabilities',jsonb_build_object(
        'can_edit',v_manage OR (v_edit AND e.created_by=p_actor_id),'can_delete',v_manage OR (v_edit AND e.created_by=p_actor_id),
        'can_rsvp',e.request_rsvp)));
      IF p_record_id IS NOT NULL THEN
        SELECT coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'rsvp_status',rsvp_status,'updated_at',updated_at) ORDER BY user_id),'[]')
          INTO v_attendees FROM public."HomeCalendarEventAttendee" WHERE event_id=e.id;
      END IF;
    END LOOP;
    -- Booking rows must agree on both owner and exact Home identity. EventType
    -- names also require the same Home; a foreign reference never leaks names.
    IF p_record_id IS NULL AND c->>'private'='false' THEN
      FOR b IN SELECT * FROM public."Booking" WHERE home_id=p_home_id AND owner_type='home' AND owner_id=p_home_id
        AND cohost_of_booking_id IS NULL AND status IN ('pending','confirmed')
        AND (p_start_after IS NULL OR start_at>=p_start_after) AND (p_start_before IS NULL OR start_at<=p_start_before)
        ORDER BY start_at,id LOOP
        SELECT name INTO v_title FROM public."EventType" WHERE id=b.event_type_id AND home_id=p_home_id AND owner_type='home' AND owner_id=p_home_id;
        v_title:=coalesce(v_title,CASE WHEN b.event_type_id IS NULL THEN 'Resource booking' ELSE 'Appointment' END);
        v_records:=v_records||jsonb_build_array(jsonb_build_object('id',b.id,'home_id',p_home_id,
          'event_type',CASE WHEN b.resource_id IS NULL THEN 'appointment' ELSE 'resource_booking' END,
          'title',v_title||CASE WHEN b.invitee_name IS NOT NULL AND b.invitee_name<>'' THEN ' — '||b.invitee_name ELSE '' END,
          'description',NULL,'start_at',b.start_at,'end_at',b.end_at,'location_notes',b.location_detail,
          'recurrence_rule',NULL,'assigned_to',CASE WHEN b.host_user_id IS NULL THEN NULL ELSE ARRAY[b.host_user_id] END,
          'alerts_enabled',true,'created_by',b.created_by,'visibility','members','source','booking',
          'booking_id',b.id,'booking_status',b.status,'capabilities',jsonb_build_object('can_edit',false,'can_delete',false,'can_rsvp',false)));
      END LOOP;
    END IF;
  END IF;
  -- No partial result if access expires while building the projection.
  c:=public.home_record_context(p_home_id,p_actor_id);
  IF c->>'allowed' IS DISTINCT FROM 'true' OR NOT c->'permissions' ? (CASE p_kind WHEN 'task' THEN 'tasks.view' ELSE 'calendar.view' END) THEN
    RETURN '{"ok":false,"code":"HOME_RECORD_DENIED","status":403}'::jsonb; END IF;
  IF p_record_id IS NOT NULL AND jsonb_array_length(v_records)=0 THEN
    RETURN '{"ok":false,"code":"HOME_RECORD_NOT_FOUND","status":404}'::jsonb; END IF;
  RETURN jsonb_build_object('ok',true,'records',v_records,'attendees',v_attendees);
END $$;


CREATE FUNCTION public.home_task_media_file_bound(f public."File") RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT coalesce(EXISTS(SELECT FROM public."HomeTaskMediaIntent" i WHERE i.id=f.id AND i.file_id=f.id
    AND i.home_id=f.home_id AND i.original_home_id=f.home_id AND i.uploaded_by=f.user_id
    AND f.metadata=jsonb_build_object('storage_contract','home_task_media_v1','upload_id',i.id)
    AND f.file_path=public.home_task_media_key(i) AND f.file_url='' AND f.visibility='private'
    AND f.file_size=i.file_size AND f.mime_type=i.mime_type AND f.is_deleted=(i.state='retired')),false);
$$;
REVOKE ALL ON FUNCTION public.home_task_media_file_bound(public."File") FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.home_task_media_file_bound(public."File") TO service_role;

CREATE FUNCTION public.lock_home_task_media_delete_scope(p_home_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE v_source uuid;
BEGIN
  IF NOT public.lock_home_record_scope(p_home_id) THEN RETURN false; END IF;
  LOCK TABLE public."AddressCalendarRule" IN SHARE ROW EXCLUSIVE MODE;
  FOR v_source IN SELECT DISTINCT source_mail_id FROM public."HomeTask" WHERE home_id=p_home_id
    AND source_mail_id IS NOT NULL ORDER BY source_mail_id LOOP
    PERFORM id FROM public."Mail" WHERE id=v_source FOR SHARE;
  END LOOP;
  PERFORM id FROM public."HomeTask" WHERE home_id=p_home_id ORDER BY id FOR UPDATE;
  PERFORM id FROM public."HomeTaskMediaIntent" WHERE original_home_id=p_home_id ORDER BY id FOR UPDATE;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.lock_home_task_media_delete_scope(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lock_home_task_media_delete_scope(uuid) TO service_role;

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

  -- Only protected task uploads have a proved retirement journey below.
  -- Documents, evidence and every legacy File remain independent blockers.
  IF EXISTS (SELECT FROM public."File" f WHERE home_id = p_home_id
    AND NOT public.home_task_media_file_bound(f))
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
      OR EXISTS (SELECT FROM public."HomeClaimReviewReceipt" receipt WHERE receipt.home_id=p_home_id
        AND NOT (receipt.actor_user_id=p_user_id AND receipt.action='withdraw' AND receipt.private_setup
          AND NOT receipt.platform_admin AND EXISTS(SELECT FROM public."HomeOwnershipClaim" c
            WHERE c.id=receipt.claim_id AND c.home_id=p_home_id
              AND public.home_claim_own_private_withdrawal(c,p_user_id))))
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
  RETURN jsonb_build_object('allowed',true,'code','HOME_DELETE_ALLOWED','deleted',false);
END;
$$;

-- Home deletion prepares only the exact trusted task retirement set. This
-- transaction leaves the Home present; provider bytes are drained by the API.
CREATE FUNCTION public.prepare_home_task_media_home_delete(p_home_id uuid,p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE e jsonb; r jsonb; i public."HomeTaskMediaIntent"%ROWTYPE; t uuid; v_cleanup jsonb:='[]'::jsonb;
BEGIN
  IF NOT public.lock_home_task_media_delete_scope(p_home_id) THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_NOT_FOUND','deleted',false); END IF;
  e:=public.home_delete_eligibility(p_home_id,p_user_id);
  IF e->>'allowed' IS DISTINCT FROM 'true' THEN RETURN e; END IF;
  FOR t IN SELECT DISTINCT task_id FROM public."HomeTaskMediaIntent" WHERE original_home_id=p_home_id AND task_id IS NOT NULL ORDER BY task_id LOOP
    r:=public.retire_home_task_media_for_delete(p_home_id,t,p_user_id);
    IF r->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Current task retirement denied' USING ERRCODE='PT403'; END IF;
    v_cleanup:=v_cleanup||(r->'cleanup');
  END LOOP;
  -- A previously deleted Task can retain a cleanup tombstone for a late PUT.
  -- Its retirement was already authorized; Home authority may finish cleanup.
  FOR i IN SELECT * FROM public."HomeTaskMediaIntent" WHERE original_home_id=p_home_id
    AND task_id IS NULL AND state='retired' AND cleanup_pending ORDER BY id LOOP
    UPDATE public."HomeTaskMediaIntent" SET cleanup_claim=gen_random_uuid(),updated_at=clock_timestamp()
      WHERE id=i.id RETURNING * INTO i;
    v_cleanup:=v_cleanup||jsonb_build_array(public.home_task_media_storage(i));
  END LOOP;
  e:=public.home_delete_eligibility(p_home_id,p_user_id);
  IF e->>'allowed' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Home authority changed' USING ERRCODE='PT403'; END IF;
  RETURN e||jsonb_build_object('home_id',p_home_id,'cleanup',v_cleanup);
EXCEPTION WHEN SQLSTATE 'PT403' THEN
  RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_ACCESS_DENIED','deleted',false);
END $$;

CREATE OR REPLACE FUNCTION public.delete_home_authorized(p_home_id uuid,p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE e jsonb;
BEGIN
  IF p_home_id IS NULL OR p_user_id IS NULL THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_ACCESS_DENIED','deleted',false); END IF;
  IF NOT public.lock_home_task_media_delete_scope(p_home_id) THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_NOT_FOUND','deleted',false); END IF;
  e:=public.home_delete_eligibility(p_home_id,p_user_id);
  IF e->>'allowed' IS DISTINCT FROM 'true' THEN RETURN e; END IF;
  IF EXISTS(SELECT FROM public."HomeTaskMediaIntent" WHERE original_home_id=p_home_id AND (state<>'retired' OR cleanup_pending))
    OR EXISTS(SELECT FROM public."HomeTaskMedia" WHERE home_id=p_home_id) THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_TASK_MEDIA_CLEANUP_REQUIRED','deleted',false);
  END IF;
  -- Every other File/evidence/document was refused above. Preserve only exact
  -- retired task tombstones outside the Home cascade; never detach legacy data.
  UPDATE public."HomeTaskMediaIntent" SET home_id=NULL WHERE home_id=p_home_id AND state='retired' AND NOT cleanup_pending;
  UPDATE public."File" f SET home_id=NULL WHERE f.home_id=p_home_id
    AND EXISTS(SELECT FROM public."HomeTaskMediaIntent" i WHERE i.id=f.id AND i.file_id=f.id AND i.original_home_id=p_home_id
      AND i.home_id IS NULL AND i.state='retired' AND NOT i.cleanup_pending
      AND f.metadata=jsonb_build_object('storage_contract','home_task_media_v1','upload_id',i.id));
  UPDATE public."Payment" SET home_id=NULL WHERE home_id=p_home_id;
  DELETE FROM public."AddressCalendarRule" WHERE scope_type='home' AND public.home_calendar_scope_id(scope_key)=p_home_id;
  e:=public.home_delete_eligibility(p_home_id,p_user_id);
  IF e->>'allowed' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Home authority changed' USING ERRCODE='PT403'; END IF;
  DELETE FROM public."Home" WHERE id=p_home_id;
  RETURN jsonb_build_object('allowed',true,'code','HOME_DELETED','deleted',true);
EXCEPTION
  WHEN SQLSTATE 'PT403' THEN RETURN e;
  WHEN lock_not_available OR serialization_failure OR deadlock_detected THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_RETRY','deleted',false);
  WHEN OTHERS THEN RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_FAILED','deleted',false);
END $$;
REVOKE ALL ON FUNCTION public.prepare_home_task_media_home_delete(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_home_task_media_home_delete(uuid,uuid) TO service_role;
