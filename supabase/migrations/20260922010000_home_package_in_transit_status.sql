-- Backwards compatible: yes. HomePackage.status also admits 'in_transit', the
-- status the existing web Edit Package panel already offers and the standalone
-- web Deliveries list already buckets with 'expected'. Reproduced 2026-09-22:
-- HomePackage_status_chk refused the option and PUT /api/homes/:id/packages/:id
-- answered 500. Every existing value stays valid, no row changes, and no column,
-- index, policy or RPC is created or altered. Native palettes roll unknown
-- statuses into their "In transit" (expected) bucket, so they keep rendering.
-- The check is re-added as a strict superset, so validating existing rows
-- cannot fail.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public."HomePackage" DROP CONSTRAINT "HomePackage_status_chk";
ALTER TABLE public."HomePackage" ADD CONSTRAINT "HomePackage_status_chk" CHECK (status = ANY (ARRAY[
  'expected'::text, 'in_transit'::text, 'out_for_delivery'::text, 'delivered'::text,
  'picked_up'::text, 'lost'::text, 'returned'::text]));
COMMIT;
