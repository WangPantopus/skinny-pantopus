-- Backwards compatible: yes. Widens one CHECK and adds one nullable column; every existing row
-- stays valid and keeps its meaning. Deploy migration before backend.
--
-- Pulse topics (docs/product/pulse-build/02-contract.md §1 and §4.1, slice S4):
--   * Post_topic_check allowed only 'sports' (the Sports lane). It now allows the twelve Pulse
--     topics; 'sports' keeps its id. Code from before this migration never writes the new values.
--   * PostMute.area_id: a topic muted in one area. Null (every existing row) means everywhere, as
--     today. The foreign key to PulseArea comes with that table.
--   * The unique index on PostMute gains area_id, so one topic can be muted in two areas. Rows
--     without an area are unique exactly as before.
SET LOCAL lock_timeout = '5s';

ALTER TABLE public."Post" DROP CONSTRAINT IF EXISTS "Post_topic_check";
ALTER TABLE public."Post" ADD CONSTRAINT "Post_topic_check" CHECK (topic IS NULL OR topic = ANY (ARRAY[
  'around_here'::text, 'outdoors'::text, 'gardening'::text, 'home_repairs'::text,
  'food'::text, 'kids_schools'::text, 'pets'::text, 'arts_culture'::text,
  'sports'::text, 'getting_around'::text, 'local_government'::text, 'volunteering'::text
]));

ALTER TABLE public."PostMute" ADD COLUMN IF NOT EXISTS area_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS "PostMute_user_entity_surface_area_unique" ON public."PostMute"
  USING btree (user_id, muted_entity_type, muted_entity_id, COALESCE(surface, '__global__'::text),
    COALESCE(area_id, '00000000-0000-0000-0000-000000000000'::uuid));
DROP INDEX IF EXISTS public."PostMute_user_entity_surface_unique";
