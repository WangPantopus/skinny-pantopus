-- Backwards compatible: yes. Four more change-signal triggers on the function from
-- 20261009085129_sync_changed_signal.sql (NOTIFY sync_changed with table name and ids only).
-- A member's permission overrides and scoped grants decide what they may see of a home, the role
-- templates decide it for every home, and the viewing location decides whose weather Today shows.
-- The API's Today memo (services/context/providerOrchestrator.js) is retired by these signals, and
-- the apps hear `home:{homeId}` / `today`. No table, column, row, policy or existing trigger changes.
SET LOCAL lock_timeout='5s';

CREATE TRIGGER sync_changed AFTER INSERT OR UPDATE OR DELETE ON public."HomePermissionOverride"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('h=home_id', 'u=user_id');
CREATE TRIGGER sync_changed AFTER INSERT OR DELETE ON public."HomeScopedGrant"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('h=home_id', 'u=grantee_user_id');
-- Opening a shared link counts a view; only the grant itself signals.
CREATE TRIGGER sync_changed_update AFTER UPDATE ON public."HomeScopedGrant"
  FOR EACH ROW WHEN ((to_jsonb(OLD) - ARRAY['view_count','updated_at'])
    IS DISTINCT FROM (to_jsonb(NEW) - ARRAY['view_count','updated_at']))
  EXECUTE FUNCTION public.notify_sync_changed('h=home_id', 'u=grantee_user_id');
-- Role templates apply to every home: the payload names only the role.
CREATE TRIGGER sync_changed AFTER INSERT OR UPDATE OR DELETE ON public."HomeRolePermission"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('g=role_base');
CREATE TRIGGER sync_changed AFTER INSERT OR UPDATE OR DELETE ON public."UserViewingLocation"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('u=user_id');
