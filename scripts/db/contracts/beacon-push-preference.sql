-- Additive push-only preference: defaults, persistence and unrelated opt-outs.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
INSERT INTO auth.users (id, email)
VALUES ('eee00000-0000-4000-8000-000000000002', 'beacon-preference@example.invalid');
SET LOCAL ROLE service_role;
INSERT INTO public."User" (id, email, username, name)
VALUES ('eee00000-0000-4000-8000-000000000002', 'beacon-preference@example.invalid',
        'beacon_preference_contract', 'Beacon preference contract');
INSERT INTO public."MailPreferences" (user_id, push_notifications)
VALUES ('eee00000-0000-4000-8000-000000000002', false);
INSERT INTO public."UserNotificationPreferences" (user_id, gig_updates_enabled)
VALUES ('eee00000-0000-4000-8000-000000000002', false);
DO $$ BEGIN
  IF (SELECT beacon_push_enabled FROM public."UserNotificationPreferences"
      WHERE user_id='eee00000-0000-4000-8000-000000000002') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'A new preference row must default Beacon push to enabled';
  END IF;
  UPDATE public."UserNotificationPreferences" SET beacon_push_enabled=false
    WHERE user_id='eee00000-0000-4000-8000-000000000002';
  IF (SELECT beacon_push_enabled FROM public."UserNotificationPreferences"
      WHERE user_id='eee00000-0000-4000-8000-000000000002') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Beacon opt-out did not persist';
  END IF;
  UPDATE public."UserNotificationPreferences" SET beacon_push_enabled=true
    WHERE user_id='eee00000-0000-4000-8000-000000000002';
  IF (SELECT gig_updates_enabled FROM public."UserNotificationPreferences"
      WHERE user_id='eee00000-0000-4000-8000-000000000002') IS DISTINCT FROM false
    OR (SELECT push_notifications FROM public."MailPreferences"
      WHERE user_id='eee00000-0000-4000-8000-000000000002') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Beacon restore overwrote an unrelated/global opt-out';
  END IF;
  BEGIN
    UPDATE public."UserNotificationPreferences" SET beacon_push_enabled=NULL
      WHERE user_id='eee00000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'Beacon push preference accepted null';
  EXCEPTION WHEN not_null_violation THEN NULL;
  END;
END $$;
ROLLBACK;
