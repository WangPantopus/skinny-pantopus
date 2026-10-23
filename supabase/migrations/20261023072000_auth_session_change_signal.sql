-- Backwards compatible: yes. Announces session revocation/deletion through the
-- existing sync_changed channel. Older listeners ignore AuthSession; no token,
-- personal data, table or column is added. User watermark changes already use
-- this channel. Periodic socket checks remain the fallback for missed signals.
SET LOCAL lock_timeout='5s';

CREATE TRIGGER auth_session_revoked_signal
  AFTER UPDATE OF revoked_at ON public."AuthSession"
  FOR EACH ROW WHEN (OLD.revoked_at IS DISTINCT FROM NEW.revoked_at)
  EXECUTE FUNCTION public.notify_sync_changed('u=user_id');

CREATE TRIGGER auth_session_deleted_signal
  AFTER DELETE ON public."AuthSession"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('u=user_id');
