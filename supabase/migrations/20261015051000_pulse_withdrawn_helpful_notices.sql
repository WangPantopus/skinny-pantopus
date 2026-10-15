-- Backwards compatible: yes. Replaces one query-only service-role projection with the
-- same fields plus `withdrawn`; no table, grant or stored notification changes, and a
-- backend that does not read the new field behaves as before. Deploy before backend.
--
-- A "Your reply helped" notice is about one Helpful mark. When the asker unmarks the
-- reply, or unmarks and marks it again, the earlier notice no longer describes anything,
-- so the shared inbox predicate leaves it out of lists, counts, badges and pushes, as it
-- already does for a reply that is gone.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.pulse_notification_post_access(public."Notification")
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
  marked_at timestamptz;
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
    access_fields := access_fields || jsonb_build_object('reply_user_id', CASE WHEN reply_row.is_deleted THEN NULL ELSE reply_row.user_id END,
      'reply_moderation_state', CASE WHEN reply_row.id IS NULL OR reply_row.is_deleted THEN 'removed'
        ELSE reply_row.moderation_state END);
    IF $1.type = 'pulse_helpful' AND reply_row.id IS NOT NULL THEN
      BEGIN
        marked_at := ($1.metadata->>'helpful_at')::timestamptz;
      EXCEPTION WHEN others THEN
        marked_at := NULL;
      END;
      -- Only the notice for the reply's current mark stays; one without a readable mark
      -- time can't be matched to a mark and is left out too.
      IF reply_row.helpful_at IS NULL OR marked_at IS NULL OR reply_row.helpful_at <> marked_at THEN
        access_fields := access_fields || jsonb_build_object('withdrawn', true);
      END IF;
    END IF;
  END IF;
  RETURN access_fields;
END;
$$;

REVOKE ALL ON FUNCTION public.pulse_notification_post_access(public."Notification") FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_notification_post_access(public."Notification") TO service_role;
COMMIT;
