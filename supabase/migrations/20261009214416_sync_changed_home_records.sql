-- Backwards compatible: yes. Five more change-signal triggers on the function from
-- 20261009085129_sync_changed_signal.sql (NOTIFY sync_changed with table name and ids only).
-- The Home screens the apps now keep (Instant Screens) also show the maintenance log, the seasonal
-- checklist, the privacy settings, the home preferences and pending ownership votes; another member's or
-- device's change to these never reached them, so open screens and kept copies stayed out of date until
-- their window passed. The API relays `home:{homeId}` to the household. No table, column, row, policy or
-- existing trigger changes.
SET LOCAL lock_timeout='5s';

CREATE TRIGGER sync_changed AFTER INSERT OR UPDATE OR DELETE ON public."HomeMaintenanceLog"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('h=home_id');
CREATE TRIGGER sync_changed AFTER INSERT OR UPDATE OR DELETE ON public."HomeSeasonalChecklistItem"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('h=home_id');
CREATE TRIGGER sync_changed AFTER INSERT OR UPDATE OR DELETE ON public."HomePrivacy"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('h=home_id');
CREATE TRIGGER sync_changed AFTER INSERT OR UPDATE OR DELETE ON public."HomePreference"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('h=home_id');
CREATE TRIGGER sync_changed AFTER INSERT OR UPDATE OR DELETE ON public."HomeQuorumAction"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('h=home_id');
