-- Backwards compatible: yes. Existing checklist rows and statuses are preserved.
-- The server binds each update to its requested Home and current locked actor.
SET LOCAL lock_timeout = '5s';
REVOKE ALL ON public."HomeSeasonalChecklistItem" FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.update_home_seasonal_item(p_home_id uuid, p_actor_id uuid, p_item_id uuid, p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp SET lock_timeout = '5s' AS $$
DECLARE item public."HomeSeasonalChecklistItem"; context jsonb;
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL OR p_item_id IS NULL OR p_status IS NULL
    OR p_status NOT IN ('completed','skipped') THEN
    RETURN '{"ok":false,"code":"HOME_CHECKLIST_INVALID","status":400}'::jsonb;
  END IF;
  IF NOT public.lock_home_record_scope(p_home_id) THEN
    RETURN '{"ok":false,"code":"HOME_NOT_FOUND","status":404}'::jsonb;
  END IF;
  SELECT * INTO item FROM public."HomeSeasonalChecklistItem"
    WHERE id=p_item_id AND home_id=p_home_id FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"HOME_CHECKLIST_NOT_FOUND","status":404}'::jsonb; END IF;
  -- Re-evaluate membership after every lock wait, including a locked item.
  context := public.home_record_context(p_home_id,p_actor_id);
  IF context->>'allowed' IS DISTINCT FROM 'true' OR context->>'private'='true'
    OR NOT context->'permissions' ? 'home.edit' THEN
    RETURN '{"ok":false,"code":"HOME_CHECKLIST_DENIED","status":403}'::jsonb;
  END IF;
  -- An identical current status is an acknowledgement, not a new completion.
  IF item.status=p_status THEN RETURN jsonb_build_object('ok',true,'item',to_jsonb(item),'changed',false); END IF;
  IF item.status='hired' OR item.gig_id IS NOT NULL THEN
    RETURN '{"ok":false,"code":"HOME_CHECKLIST_LINKED","status":409}'::jsonb;
  END IF;
  IF item.status<>'pending' THEN
    RETURN '{"ok":false,"code":"HOME_CHECKLIST_CHANGED","status":409}'::jsonb;
  END IF;
  UPDATE public."HomeSeasonalChecklistItem" SET status=p_status,
    completed_at=clock_timestamp(),completed_by=p_actor_id
    WHERE id=p_item_id AND home_id=p_home_id RETURNING * INTO item;
  INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
    VALUES(p_home_id,p_actor_id,'home_checklist_updated','HomeSeasonalChecklistItem',p_item_id,
      jsonb_build_object('status',p_status));
  RETURN jsonb_build_object('ok',true,'item',to_jsonb(item),'changed',true);
END $$;
REVOKE ALL ON FUNCTION public.update_home_seasonal_item(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.update_home_seasonal_item(uuid,uuid,uuid,text) TO service_role;
