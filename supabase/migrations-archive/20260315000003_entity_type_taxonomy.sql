-- Migrate BusinessProfile.business_type from flat strings to structured entity taxonomy.
-- Maps legacy BIZ_TYPES values to their nearest entity type equivalent.

-- Step 1: Migrate existing data to new entity types
UPDATE "public"."BusinessProfile"
SET "business_type" = CASE
  WHEN "business_type" IN ('general', 'restaurant', 'salon', 'retail', 'venue', 'tech', 'creative', 'online') THEN 'for_profit'
  WHEN "business_type" IN ('home_services', 'services') THEN 'home_service'
  WHEN "business_type" IN ('health', 'fitness', 'education', 'automotive') THEN 'for_profit'
  WHEN "business_type" IN ('for_profit', 'home_service', 'nonprofit_501c3', 'religious_org', 'community_group', 'sole_proprietor', 'pop_up_temporary', 'franchise_location') THEN "business_type"
  ELSE 'for_profit'
END
WHERE "business_type" NOT IN ('for_profit', 'home_service', 'nonprofit_501c3', 'religious_org', 'community_group', 'sole_proprietor', 'pop_up_temporary', 'franchise_location');

-- Step 2: Add CHECK constraint to enforce valid entity types going forward
ALTER TABLE "public"."BusinessProfile"
  DROP CONSTRAINT IF EXISTS "business_profile_entity_type_check";

ALTER TABLE "public"."BusinessProfile"
  ADD CONSTRAINT "business_profile_entity_type_check"
  CHECK ("business_type" IN ('for_profit', 'home_service', 'nonprofit_501c3', 'religious_org', 'community_group', 'sole_proprietor', 'pop_up_temporary', 'franchise_location'));

-- Step 3: Update the default value
ALTER TABLE "public"."BusinessProfile"
  ALTER COLUMN "business_type" SET DEFAULT 'for_profit';
