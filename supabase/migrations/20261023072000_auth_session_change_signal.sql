-- Backwards compatible: yes. Announces session revocation/deletion and moves of
-- the sign-out watermark through the existing sync_changed channel. Older
-- listeners ignore AuthSession; no token, personal data, table or column is
-- added. Periodic socket checks remain the fallback for missed signals.
SET LOCAL lock_timeout='5s';

CREATE TRIGGER auth_session_revoked_signal
  AFTER UPDATE OF revoked_at ON public."AuthSession"
  FOR EACH ROW WHEN (OLD.revoked_at IS DISTINCT FROM NEW.revoked_at)
  EXECUTE FUNCTION public.notify_sync_changed('u=user_id');

CREATE TRIGGER auth_session_deleted_signal
  AFTER DELETE ON public."AuthSession"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('u=user_id');

-- The profile signal on "User" (20261009085129) leaves sessions_valid_after
-- out on purpose. Sign out everywhere and password resets move it, and other
-- API processes must hear that for sessions without a registry row too.
CREATE TRIGGER user_sessions_valid_after_signal
  AFTER UPDATE OF sessions_valid_after ON public."User"
  FOR EACH ROW WHEN (OLD.sessions_valid_after IS DISTINCT FROM NEW.sessions_valid_after)
  EXECUTE FUNCTION public.notify_sync_changed('u=id');
