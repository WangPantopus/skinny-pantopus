-- Backwards compatible: yes. Query-only service-role projection of a notification's
-- referenced post/reply, used by the shared server audience predicate. No client grant,
-- new table, rewritten notification or copied membership decision. Deploy before backend.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION public.pulse_notification_post_access(public."Notification")
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  post_ref text := COALESCE(NULLIF($1.metadata->>'post_id', ''), NULLIF($1.metadata->>'plan_id', ''),
    substring($1.link FROM '^/(?:app/)?(?:posts|plans)/([0-9a-fA-F-]{36})(?:/|$)'));
  reply_ref text := NULLIF($1.metadata->>'comment_id', '');
  post_row public."Post"%ROWTYPE;
  reply_row public."PostComment"%ROWTYPE;
  access_fields jsonb;
BEGIN
  -- Unrelated notifications keep their existing rules. A malformed or deleted
  -- reference cannot use that escape hatch to keep quoting inaccessible content.
  IF post_ref IS NULL THEN RETURN NULL; END IF;
  IF post_ref !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN jsonb_build_object('read_scope', 'missing');
  END IF;
  SELECT * INTO post_row FROM public."Post" WHERE id = post_ref::uuid;
  IF NOT FOUND THEN RETURN jsonb_build_object('read_scope', 'missing'); END IF;
  access_fields := jsonb_build_object('read_scope', post_row.read_scope, 'user_id', post_row.user_id,
    'area_id', post_row.area_id, 'pulse_post_town_id', public.pulse_area_town_id(post_row.area_id),
    'moderation_state', CASE WHEN post_row.archive_reason = 'moderation' THEN 'removed' ELSE post_row.moderation_state END);
  IF reply_ref IS NOT NULL THEN
    IF reply_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      SELECT * INTO reply_row FROM public."PostComment" WHERE id = reply_ref::uuid AND post_id = post_row.id;
    END IF;
    access_fields := access_fields || jsonb_build_object('reply_user_id', reply_row.user_id,
      'reply_moderation_state', CASE WHEN reply_row.id IS NULL OR reply_row.is_deleted THEN 'removed'
        ELSE reply_row.moderation_state END);
  END IF;
  RETURN access_fields;
END;
$$;

REVOKE ALL ON FUNCTION public.pulse_notification_post_access(public."Notification") FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_notification_post_access(public."Notification") TO service_role;
COMMIT;
