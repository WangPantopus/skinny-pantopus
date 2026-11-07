-- Backwards compatible: yes. Existing nullable category_id and response shapes
-- are unchanged. Keep items and create-request identities; older clients already
-- support ungrouped items. The release applies this just before the API cutover.
-- Until then the running API answers a stale or foreign category selection with
-- its generic 500 and writes nothing (it used to save the item under the removed
-- group), and a replay of a create whose category is gone gets its 409. Both are
-- retryable, and the API in this change answers them with a 400 and the item.
-- A removed category leaves its items available and ungrouped. Keep the
-- category row for create-request replay, but clear assignments atomically.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE FUNCTION public.clear_inactive_catalog_category_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public."BusinessCatalogItem"
     SET category_id = NULL, updated_at = now()
   WHERE category_id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER clear_inactive_catalog_category_items
AFTER UPDATE OF is_active, business_user_id ON public."BusinessCatalogCategory"
FOR EACH ROW WHEN (NEW.is_active = false OR NEW.business_user_id IS DISTINCT FROM OLD.business_user_id)
EXECUTE FUNCTION public.clear_inactive_catalog_category_items();

CREATE FUNCTION public.require_active_catalog_item_category()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.category_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- SHARE conflicts with category deactivation, including an update that
  -- doesn't change its key. A concurrent item write either commits first
  -- and is ungrouped by the delete, or sees the inactive category and fails.
  PERFORM 1 FROM public."BusinessCatalogCategory"
   WHERE id = NEW.category_id
     AND business_user_id = NEW.business_user_id
     AND is_active = true
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'CATALOG_CATEGORY_UNAVAILABLE',
      DETAIL = 'Choose an active category from this business.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER require_active_catalog_item_category
BEFORE INSERT OR UPDATE OF category_id, business_user_id ON public."BusinessCatalogItem"
FOR EACH ROW EXECUTE FUNCTION public.require_active_catalog_item_category();

REVOKE ALL ON FUNCTION public.clear_inactive_catalog_category_items() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.require_active_catalog_item_category() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_inactive_catalog_category_items() TO service_role;
GRANT EXECUTE ON FUNCTION public.require_active_catalog_item_category() TO service_role;

-- Repair the assignments left by earlier soft-deletes, and prevent a category
-- from another business being displayed as this business's grouping.
UPDATE public."BusinessCatalogItem" AS item
   SET category_id = NULL, updated_at = now()
  FROM public."BusinessCatalogCategory" AS category
 WHERE item.category_id = category.id
   AND (NOT category.is_active OR category.business_user_id <> item.business_user_id);

COMMIT;
