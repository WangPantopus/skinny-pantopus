-- Backwards compatible: yes. Adds one column to "User" (an empty list by default, so every existing row is valid) and
-- its check; no other table, function, constraint or grant changes. Deployed apps and the current backend never read
-- or write it.
--
-- Profile redesign, SRV-2 (the founder approved this database change on 2026-11-01, decision D1): the "Get to know
-- <name>" prompts on a profile. Up to three answers, each { "key": …, "answer": … }, the key from the apps' fixed
-- catalog, in the order the person chose. The backend checks the keys and answers; the database keeps the list shape.
SET LOCAL lock_timeout='5s';

ALTER TABLE public."User" ADD COLUMN profile_prompts jsonb NOT NULL DEFAULT '[]'::jsonb
  CONSTRAINT user_profile_prompts_list CHECK (
    CASE WHEN jsonb_typeof(profile_prompts) = 'array' THEN jsonb_array_length(profile_prompts) <= 3 ELSE false END
  );

COMMENT ON COLUMN public."User".profile_prompts IS
  'Profile prompts: at most three { key, answer } objects in the person''s order; keys from the apps'' catalog.';
