-- Backwards compatible: yes. Widens one CHECK; every existing value stays valid,
-- no rows, columns or grants change. Deploy migration before backend/web.
-- Records on web, iOS and Android offer structure, system and vehicle assets,
-- but HomeAsset_cat_chk allowed only the household-inventory categories, so
-- saving one of those failed ("Failed to create asset"). Keep every existing
-- category and add the three the Records screens offer.
ALTER TABLE public."HomeAsset" DROP CONSTRAINT IF EXISTS "HomeAsset_cat_chk";
ALTER TABLE public."HomeAsset" ADD CONSTRAINT "HomeAsset_cat_chk" CHECK (category = ANY (ARRAY[
  'appliance'::text, 'electronics'::text, 'furniture'::text, 'tool'::text, 'valuable'::text,
  'consumable'::text, 'fixture'::text, 'other'::text, 'structure'::text, 'system'::text, 'vehicle'::text
]));
