-- Add donation and event catalog item kinds, plus donation-specific columns.

-- Step 1: Drop existing kind CHECK and add updated one with donation + event
ALTER TABLE "public"."BusinessCatalogItem"
  DROP CONSTRAINT IF EXISTS "BusinessCatalogItem_kind_check";

ALTER TABLE "public"."BusinessCatalogItem"
  ADD CONSTRAINT "BusinessCatalogItem_kind_check"
  CHECK ("kind" IN ('service', 'product', 'menu_item', 'class', 'rental', 'membership', 'donation', 'event', 'other'));

-- Step 2: Add donation-specific columns
ALTER TABLE "public"."BusinessCatalogItem"
  ADD COLUMN IF NOT EXISTS "suggested_amounts" INTEGER[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "tax_deductible" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "suggested_description" TEXT DEFAULT NULL;

-- Step 3: Enforce that donation items cannot have a fixed price_cents
-- (they use suggested_amounts or open-amount input instead)
ALTER TABLE "public"."BusinessCatalogItem"
  ADD CONSTRAINT "BusinessCatalogItem_donation_no_price"
  CHECK ("kind" <> 'donation' OR "price_cents" IS NULL);
