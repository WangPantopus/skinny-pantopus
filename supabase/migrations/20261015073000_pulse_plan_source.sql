-- Backwards compatible: yes. Adds nullable Plan.source_post_id (no default, so no rewrite) and its
-- index; no existing row or endpoint changes, and older clients never read it. Deploy before backend.
--
-- A plan suggested from a Pulse conversation keeps that conversation (S14, contract §2.18). No
-- foreign key: Plan already references Post through post_id, and a second one would make the
-- existing `post:Post` embeds ambiguous for PostgREST. Readers see the link only while they can
-- read the conversation, so a deleted one simply stops linking.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public."Plan" ADD COLUMN source_post_id uuid;
CREATE INDEX "Plan_source_post_idx" ON public."Plan" (source_post_id) WHERE source_post_id IS NOT NULL;

COMMIT;
