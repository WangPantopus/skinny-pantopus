-- Backwards compatible: yes. Adds one new server-only table, "PulseArea" (the towns,
-- neighborhoods, streets and places Pulse posts are about; docs/product/pulse-build/02-contract.md
-- §4.2 row 1), a nullable Post.area_id that points at it, and the foreign key the existing
-- PostMute.area_id (added with S4) was waiting for. No existing row changes;
-- deployed apps never read the table (RLS on, no policies, no client grants).
--
-- Founder approved all eleven Pulse tables and the Census download on October 14, 2026.
-- The approval is recorded in docs/product/pulse-build/README.md (hold point H3).
--
-- An area's edge is its boundary (towns: US Census place boundaries, public domain, simplified)
-- or a labeled radius around its centroid (places and short streets). opened_at null means the
-- area is closed: nobody can scope a post to it yet. The launch rows (Camas, Washougal and
-- Vancouver WA) come in the next migration, with their source.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE public."PulseArea" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('town', 'neighborhood', 'street', 'place')),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  -- Readable, stable ids for links and seeds: 'camas-wa', 'camas-wa/prune-hill'.
  slug text NOT NULL UNIQUE
    CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*(/[a-z0-9]+(-[a-z0-9]+)*)*$' AND char_length(slug) <= 160),
  -- Neighborhoods, streets and places sit inside a town; a town has no parent.
  parent_id uuid REFERENCES public."PulseArea"(id) ON DELETE RESTRICT,
  -- The US state, two letters.
  state text NOT NULL CHECK (state ~ '^[A-Z]{2}$'),
  boundary geography(MultiPolygon,4326),
  centroid geography(Point,4326) NOT NULL,
  -- Labeled-radius areas only.
  radius_m integer CHECK (radius_m IS NULL OR radius_m BETWEEN 25 AND 20000),
  opened_at timestamptz,
  -- Where the shape came from, in words ("US Census Bureau, TIGER/Line places") and as a link.
  source text NOT NULL CHECK (char_length(source) BETWEEN 1 AND 160),
  source_url text CHECK (source_url IS NULL OR (source_url ~ '^https://' AND char_length(source_url) <= 500)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "PulseArea_edge_check" CHECK (boundary IS NOT NULL OR radius_m IS NOT NULL),
  CONSTRAINT "PulseArea_town_parent_check" CHECK ((kind = 'town') = (parent_id IS NULL))
);

CREATE INDEX "PulseArea_boundary_idx" ON public."PulseArea" USING gist (boundary);
CREATE INDEX "PulseArea_centroid_idx" ON public."PulseArea" USING gist (centroid);
CREATE INDEX "PulseArea_parent_id_idx" ON public."PulseArea" (parent_id);

ALTER TABLE public."PulseArea" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."PulseArea" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."PulseArea" TO service_role;

-- The area a Pulse post is about (contract §4.1); null on every older post. An area that is
-- removed leaves its posts in place, about no area.
ALTER TABLE public."Post" ADD COLUMN IF NOT EXISTS area_id uuid
  REFERENCES public."PulseArea"(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "Post_area_id_idx" ON public."Post" (area_id) WHERE area_id IS NOT NULL;

-- A topic mute for one area (S4) goes with that area. S4 accepted arbitrary area UUIDs,
-- so do not reject or rewrite an existing mute when installing the table. NOT VALID
-- preserves those rows while enforcing the reference on new writes; legacy mutes
-- can still be listed and removed. Validate only after legacy references are reconciled.
ALTER TABLE public."PostMute" ADD CONSTRAINT "PostMute_area_id_fkey"
  FOREIGN KEY (area_id) REFERENCES public."PulseArea"(id) ON DELETE CASCADE NOT VALID;

COMMIT;
