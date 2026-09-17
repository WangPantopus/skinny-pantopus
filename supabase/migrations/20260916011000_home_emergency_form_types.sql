-- Backwards compatible: yes. HomeEmergency.type also admits the six categories
-- both native Add Emergency forms already send (Android
-- EmergencyFormCategory.backendType, iOS EmergencyFormCategory.rawValue):
-- allergy, medical_condition, medication, contact, pet_medical,
-- power_of_attorney. Reproduced 2026-09-16: HomeEmergency_type_chk refused six
-- of the seven form categories and the route answered 500. Every existing value
-- stays valid, no row changes, and no column, index, policy or RPC is created
-- or altered; readers that roll unknown types into a generic bucket keep
-- working. The check is re-added as a strict superset, so validating the
-- existing rows cannot fail.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public."HomeEmergency" DROP CONSTRAINT "HomeEmergency_type_chk";
ALTER TABLE public."HomeEmergency" ADD CONSTRAINT "HomeEmergency_type_chk" CHECK (type = ANY (ARRAY[
  'shutoff_water'::text, 'shutoff_gas'::text, 'shutoff_electric'::text, 'breaker_map'::text,
  'extinguisher'::text, 'first_aid'::text, 'evac_plan'::text, 'emergency_contacts'::text, 'other'::text,
  'allergy'::text, 'medical_condition'::text, 'medication'::text, 'contact'::text, 'pet_medical'::text,
  'power_of_attorney'::text]));
COMMIT;
