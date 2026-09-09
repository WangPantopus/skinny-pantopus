-- Clark County seeder rows: clarify Washington state (coordinates already SW WA / Vancouver area).

UPDATE "public"."seeder_config"
SET display_name = 'Clark County, WA'
WHERE region = 'clark_county'
  AND display_name = 'Clark County';

UPDATE "public"."seeder_sources"
SET display_name = 'Google News (Clark County, WA)'
WHERE region = 'clark_county'
  AND source_id = 'google_news:clark_county'
  AND display_name = 'Google News (Clark County)';

-- Only replace the historical default query; leave customized URLs untouched.
UPDATE "public"."seeder_sources"
SET url = (
  'Clark County Washington WA Vancouver Camas Washougal '
  'Battle Ground Ridgefield southwest Washington local news'
)
WHERE region = 'clark_county'
  AND source_id = 'google_news:clark_county'
  AND url = 'Clark County WA local news';

UPDATE "public"."seeder_sources"
SET display_name = 'NWS Weather Alerts (Clark County, WA)'
WHERE region = 'clark_county'
  AND source_id = 'nws_alerts:clark_county'
  AND display_name = 'NWS Weather Alerts';
