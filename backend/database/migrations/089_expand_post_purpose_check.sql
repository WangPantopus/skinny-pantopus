-- Expand Post_purpose_check to include new purpose values:
-- lost_found, local_update, neighborhood_win, visitor_guide

ALTER TABLE "public"."Post"
  DROP CONSTRAINT IF EXISTS "Post_purpose_check";

ALTER TABLE "public"."Post"
  ADD CONSTRAINT "Post_purpose_check"
    CHECK (purpose IS NULL OR purpose IN (
      'ask', 'offer', 'heads_up', 'recommend', 'lost_found', 'local_update',
      'neighborhood_win', 'visitor_guide', 'learn', 'showcase', 'story', 'event', 'deal'
    ));
