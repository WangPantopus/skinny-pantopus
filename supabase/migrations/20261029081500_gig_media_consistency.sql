-- Backwards compatible: yes. Reuse GigMedia and Gig.attachments; preserve existing content.
SET LOCAL lock_timeout = '5s';
CREATE FUNCTION public.attach_gig_media(p_gig_id uuid,p_actor_id uuid,p_media jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE g public."Gig"; m public."GigMedia"; item jsonb; files jsonb:='[]'; used integer; position integer;
BEGIN
 SELECT * INTO g FROM public."Gig" WHERE id=p_gig_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 IF p_actor_id IS NULL OR g.user_id IS DISTINCT FROM p_actor_id THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
 IF jsonb_typeof(p_media) IS DISTINCT FROM 'array' OR jsonb_array_length(p_media) NOT BETWEEN 1 AND 10 THEN
  RETURN jsonb_build_object('error','GIG_MEDIA_LIMIT'); END IF;
 SELECT count(*) INTO used FROM (SELECT unnest(coalesce(g.attachments,'{}')) AS url
  UNION SELECT file_url FROM public."GigMedia" WHERE gig_id=g.id) urls WHERE url IS NOT NULL;
 IF used+jsonb_array_length(p_media)>10 THEN RETURN jsonb_build_object('error','GIG_MEDIA_LIMIT'); END IF;
 SELECT coalesce(max(display_order)+1,0) INTO position FROM public."GigMedia" WHERE gig_id=g.id;
 FOR item IN SELECT value FROM jsonb_array_elements(p_media) LOOP
  INSERT INTO public."GigMedia"(gig_id,uploaded_by,file_url,file_key,file_name,file_type,mime_type,file_size,thumbnail_url,display_order)
  VALUES(g.id,p_actor_id,item->>'file_url',item->>'file_key',item->>'file_name',item->>'file_type',item->>'mime_type',
   (item->>'file_size')::bigint,item->>'thumbnail_url',position) RETURNING * INTO m;
  files:=files||jsonb_build_array(to_jsonb(m)); position:=position+1;
 END LOOP;
 UPDATE public."Gig" SET attachments=coalesce(attachments,'{}')||ARRAY(SELECT value->>'file_url' FROM jsonb_array_elements(files)),
  updated_at=clock_timestamp() WHERE id=g.id;
 RETURN jsonb_build_object('media',files);
END $$;
REVOKE ALL ON FUNCTION public.attach_gig_media(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.attach_gig_media(uuid,uuid,jsonb) TO service_role;

CREATE FUNCTION public.sync_gig_media_removal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
BEGIN
 UPDATE public."Gig" SET attachments=array_remove(attachments,OLD.file_url),updated_at=clock_timestamp() WHERE id=OLD.gig_id;
 RETURN OLD;
END $$;
CREATE TRIGGER sync_gig_media_removal AFTER DELETE ON public."GigMedia"
 FOR EACH ROW EXECUTE FUNCTION public.sync_gig_media_removal();
REVOKE ALL ON FUNCTION public.sync_gig_media_removal() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sync_gig_media_removal() TO service_role;
