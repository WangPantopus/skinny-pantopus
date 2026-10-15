-- Backwards compatible: yes. Adds the approved private KnownEntry and KnownConfirmation tables
-- (contract §4.2, tables 5 and 6; founder approval of October 14, 2026) and one service-only
-- function; no existing table, column or endpoint changes, and older clients never read Known.
-- Deploy before backend.
--
-- Known (S12, contract §2.14): short, sourced answers for an area. Entries keep references to
-- the public posts and replies they came from; whether a reference may be shown is decided when
-- the entry is read, so a narrowed, held, removed or deleted post never feeds a quote or count.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE public."KnownEntry" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL REFERENCES public."PulseArea"(id),
  topic text CHECK (topic IS NULL OR topic IN ('around_here', 'outdoors', 'gardening', 'home_repairs', 'food',
    'kids_schools', 'pets', 'arts_culture', 'sports', 'getting_around', 'local_government', 'volunteering')),
  kind text NOT NULL CHECK (kind IN ('official', 'neighbor')),
  question text NOT NULL CHECK (char_length(question) BETWEEN 1 AND 200),
  answer text CHECK (answer IS NULL OR char_length(answer) <= 4000),
  -- Recommendations: [{ "name", "refs": [{ "post_id", "reply_id"?, "quote"? }] }]
  items jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(items) = 'array'),
  -- { "official": [{ "label", "url", "retrieved_at" }], "posts": ["<post id>", ...] }
  sources jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(sources) = 'object'),
  source_post_ids uuid[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'stale', 'retired')),
  last_confirmed_at timestamptz,
  review_by timestamptz,
  asked_post_id uuid REFERENCES public."Post"(id) ON DELETE SET NULL,
  asked_at timestamptz,
  created_by uuid REFERENCES public."User"(id) ON DELETE SET NULL,
  published_by uuid REFERENCES public."User"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  search tsvector GENERATED ALWAYS AS (to_tsvector('english', question || ' ' || coalesce(answer, '') || ' '
    || coalesce(jsonb_path_query_array(items, '$[*].name')::text, ''))) STORED
);
ALTER TABLE public."KnownEntry" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."KnownEntry" FROM anon, authenticated;
GRANT ALL ON public."KnownEntry" TO service_role;
CREATE INDEX ON public."KnownEntry" (area_id, status, last_confirmed_at DESC);
CREATE INDEX ON public."KnownEntry" USING gin (search);
CREATE INDEX ON public."KnownEntry" USING gin (source_post_ids);
CREATE INDEX ON public."KnownEntry" (asked_post_id) WHERE asked_post_id IS NOT NULL;

CREATE TABLE public."KnownConfirmation" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public."KnownEntry"(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  -- The verified home it counted for. No foreign key: Home's deletion policy owns every Home
  -- dependency, and a deleted home's earlier confirmation still counted when it was made.
  home_id uuid,
  kind text NOT NULL CHECK (kind IN ('confirm', 'correct', 'outdated')),
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public."User"(id) ON DELETE SET NULL
);
ALTER TABLE public."KnownConfirmation" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."KnownConfirmation" FROM anon, authenticated;
GRANT ALL ON public."KnownConfirmation" TO service_role;
CREATE INDEX ON public."KnownConfirmation" (entry_id, kind, created_at);
CREATE INDEX ON public."KnownConfirmation" (user_id);
CREATE INDEX ON public."KnownConfirmation" (entry_id) WHERE kind = 'correct' AND resolved_at IS NULL;

-- A resident's response (contract §2.14). The server checked the verified home first. Each person
-- counts once per kind until the entry is next confirmed (an open correction until staff resolve
-- it); two confirmations from different homes refresh the entry, two outdated flags make it stale.
-- The entry row is locked, so simultaneous responses share one outcome.
CREATE FUNCTION public.pulse_known_respond(
  p_entry_id uuid, p_user_id uuid, p_home_id uuid, p_kind text, p_note text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  entry public."KnownEntry";
  since timestamptz;
  homes integer;
BEGIN
  IF p_kind NOT IN ('confirm', 'correct', 'outdated') THEN RETURN jsonb_build_object('code', 'INVALID_KIND'); END IF;
  SELECT * INTO entry FROM public."KnownEntry" WHERE id = p_entry_id AND status IN ('published', 'stale') FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('code', 'KNOWN_NOT_FOUND'); END IF;
  since := COALESCE(entry.last_confirmed_at, '-infinity'::timestamptz);
  IF EXISTS (SELECT 1 FROM public."KnownConfirmation" c WHERE c.entry_id = entry.id AND c.user_id = p_user_id
      AND c.kind = p_kind AND c.resolved_at IS NULL AND (c.created_at > since OR p_kind = 'correct')) THEN
    RETURN jsonb_build_object('code', NULL, 'repeated', true);
  END IF;
  INSERT INTO public."KnownConfirmation" (entry_id, user_id, home_id, kind, note)
    VALUES (entry.id, p_user_id, p_home_id, p_kind, p_note);
  IF p_kind = 'correct' THEN RETURN jsonb_build_object('code', NULL, 'repeated', false); END IF;
  SELECT count(DISTINCT c.home_id) INTO homes FROM public."KnownConfirmation" c
    WHERE c.entry_id = entry.id AND c.kind = p_kind AND c.created_at > since AND c.home_id IS NOT NULL;
  IF p_kind = 'confirm' AND homes >= 2 THEN
    UPDATE public."KnownEntry" SET last_confirmed_at = now(), status = 'published', updated_at = now()
      WHERE id = entry.id;
  ELSIF p_kind = 'outdated' AND homes >= 2 AND entry.status = 'published' THEN
    UPDATE public."KnownEntry" SET status = 'stale', updated_at = now() WHERE id = entry.id;
  END IF;
  RETURN jsonb_build_object('code', NULL, 'repeated', false);
END;
$$;
REVOKE ALL ON FUNCTION public.pulse_known_respond(uuid, uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_known_respond(uuid, uuid, uuid, text, text) TO service_role;
COMMIT;
