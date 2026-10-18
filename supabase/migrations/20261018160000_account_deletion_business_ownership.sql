-- Backwards compatible: yes. Add guard triggers only; no table, column or
-- existing row changes. Deploy before the account-deletion route update.
-- BusinessTeam is the canonical membership source. A personal User deletion
-- otherwise cascades its membership and leaves a separate business User and
-- published profile without an owner. Require explicit business retirement or
-- ownership handoff/leave first, for drafts and published businesses alike.
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION public.guard_business_owner_account_deletion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public."BusinessTeam" t
    JOIN public."User" b ON b.id = t.business_user_id
    WHERE t.user_id = OLD.id AND t.is_active AND t.role_base = 'owner'
      AND b.account_type = 'business'
  ) THEN
    RAISE EXCEPTION 'Close or hand over businesses before deleting the owner account'
      USING ERRCODE = '23514', CONSTRAINT = 'account_deletion_business_ownership';
  END IF;
  RETURN OLD;
END $$;

REVOKE ALL ON FUNCTION public.guard_business_owner_account_deletion() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER guard_business_owner_account_deletion
BEFORE DELETE ON public."User"
FOR EACH ROW EXECUTE FUNCTION public.guard_business_owner_account_deletion();

-- Role updates do not change the membership's user FK, so PostgreSQL need not
-- lock the personal User again. Explicitly serialize owner grants against its
-- deletion, including promotion of an existing member during a deletion.
CREATE FUNCTION public.lock_business_owner_account() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp SET lock_timeout = '5s' AS $$
BEGIN
  IF NEW.is_active AND NEW.role_base = 'owner' THEN
    PERFORM 1 FROM public."User" WHERE id = NEW.user_id FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Business owner account no longer exists'
        USING ERRCODE = '23503', CONSTRAINT = 'BusinessTeam_user_id_fkey';
    END IF;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.lock_business_owner_account() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER lock_business_owner_account
BEFORE INSERT OR UPDATE OF user_id, role_base, is_active ON public."BusinessTeam"
FOR EACH ROW EXECUTE FUNCTION public.lock_business_owner_account();
