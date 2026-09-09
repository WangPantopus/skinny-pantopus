-- Ownership dispute UX disabled in product: clear operational dispute flags on existing rows.

UPDATE "HomeOwner"
SET owner_status = 'verified', updated_at = NOW()
WHERE owner_status = 'disputed';

UPDATE "Home" AS h
SET
  security_state = CASE WHEN h.security_state = 'disputed' THEN 'normal' ELSE h.security_state END,
  ownership_state = CASE
    WHEN h.ownership_state = 'disputed' AND h.owner_id IS NOT NULL THEN 'owner_verified'
    WHEN h.ownership_state = 'disputed' THEN 'unclaimed'
    ELSE h.ownership_state
  END,
  household_resolution_state = CASE
    WHEN h.household_resolution_state = 'disputed' AND EXISTS (
      SELECT 1 FROM "HomeOwner" ho WHERE ho.home_id = h.id AND ho.owner_status = 'verified'
    ) THEN 'verified_household'
    WHEN h.household_resolution_state = 'disputed' THEN 'unclaimed'
    ELSE h.household_resolution_state
  END,
  updated_at = NOW()
WHERE h.security_state = 'disputed'
   OR h.ownership_state = 'disputed'
   OR h.household_resolution_state = 'disputed';
