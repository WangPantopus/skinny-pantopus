-- Backwards compatible: yes. Widens two Plans checks: Plan.join_requirement gains 'invited' and
-- PlanRequest.status gains 'invited'. Existing rows keep their values and older code never writes
-- the new ones. Deploy before backend.
--
-- "People I invite" (S14, contract §2.18): only the host and the invited people can see an invited
-- plan; each invitation is a request in the 'invited' state until the person says Going.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public."Plan" DROP CONSTRAINT "Plan_join_requirement_check";
ALTER TABLE public."Plan" ADD CONSTRAINT "Plan_join_requirement_check"
  CHECK (join_requirement IN ('located', 'verified', 'invited')) NOT VALID;
ALTER TABLE public."Plan" VALIDATE CONSTRAINT "Plan_join_requirement_check";

ALTER TABLE public."PlanRequest" DROP CONSTRAINT "PlanRequest_status_check";
ALTER TABLE public."PlanRequest" ADD CONSTRAINT "PlanRequest_status_check"
  CHECK (status IN ('pending', 'waitlisted', 'accepted', 'declined', 'withdrawn', 'left', 'removed', 'expired', 'invited')) NOT VALID;
ALTER TABLE public."PlanRequest" VALIDATE CONSTRAINT "PlanRequest_status_check";

COMMIT;
