-- Backwards compatible: yes. Adds an expression index for Pulse search over a post's title and
-- text, and one service-only candidate function; no column, row or endpoint changes. Deploy
-- before backend.
--
-- Search (S12, contract §2.17): the same area candidates as the feed, matched with
-- websearch_to_tsquery, which reads any input as words and never raises a syntax error. The
-- caller applies moderation, the shared audience wall, mutes, hides and blocks before paging.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE INDEX "Post_pulse_search_idx" ON public."Post"
  USING gin (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, '')));

CREATE FUNCTION public.pulse_search_area_candidates(p_area_id uuid, p_query text)
RETURNS SETOF public."Post"
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT p.* FROM public.pulse_feed_area_candidates(p_area_id) p
  WHERE to_tsvector('english', coalesce(p.title, '') || ' ' || coalesce(p.content, ''))
    @@ websearch_to_tsquery('english', p_query);
$$;

REVOKE ALL ON FUNCTION public.pulse_search_area_candidates(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_search_area_candidates(uuid, text) TO service_role;
COMMIT;
