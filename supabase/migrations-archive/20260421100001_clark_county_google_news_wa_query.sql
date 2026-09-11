-- Extend Clark County, WA Google News default query (Battle Ground / Ridgefield / SW WA anchors).

UPDATE "public"."seeder_sources"
SET url = (
  'Clark County Washington WA Vancouver Camas Washougal '
  'Battle Ground Ridgefield southwest Washington local news'
)
WHERE region = 'clark_county'
  AND source_id = 'google_news:clark_county'
  AND url IN (
    'Clark County WA local news',
    'Clark County Washington WA Vancouver Camas Washougal local news'
  );
