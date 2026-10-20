-- Backwards compatible: yes. Two additive columns; existing rows read NULL
-- (never set, treated as off) and an empty mute map. Older apps neither read
-- nor write them, so their users get no suggestions and an unchanged briefing.
-- AI assistant phase 2 (docs/product/ai-assistant-phase2-contract-2026-10-20.md
-- sections 3.4 and 9): the Suggestions switch and "Fewer like this" mutes.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public."UserNotificationPreferences"
  ADD COLUMN suggestions_enabled boolean,
  ADD COLUMN suggestions_muted jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public."UserNotificationPreferences".suggestions_enabled IS
  'Suggestions from Pantopus: the AI morning brief and at most two nudges a day. NULL means never set and is treated as off; only new app builds set it.';
COMMENT ON COLUMN public."UserNotificationPreferences".suggestions_muted IS
  'Kinds muted with "Fewer like this": { "<kind>": "<ISO time the mute ends>" }. An empty object means none.';

COMMIT;
