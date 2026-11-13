-- Backwards compatible: yes. Adds two values to the business_permission enum. Nothing grants or checks them until
-- the next migration (their role defaults) and the backend that follows, and deployed apps list only the
-- permissions they know.
--
-- Plans with businesses, step 2 (the founder's go on 2026-11-12): a verified business hosts a plan in Plans.
--   plans.post     post a plan as the business
--   plans.manage   run the business's plans: change or cancel one, answer asks, see who is coming
--
-- A value added to an enum cannot be used in the transaction that adds it, so the role defaults that grant these
-- are in the next migration (the same split as 20260930184000_backfill_business_seats.sql).
SET LOCAL lock_timeout = '5s';

ALTER TYPE public.business_permission ADD VALUE IF NOT EXISTS 'plans.post';
ALTER TYPE public.business_permission ADD VALUE IF NOT EXISTS 'plans.manage';
